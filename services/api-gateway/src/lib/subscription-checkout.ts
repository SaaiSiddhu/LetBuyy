import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    createRazorpayOrder,
    createRazorpaySubscription,
} from '@letbuyy/infrastructure/razorpay-adapter';
import {
    applyStorePlanTierDefaults,
    applyFoundingLockToPlan,
    normalizeMerchantApprovedUsageCharges,
    planBillingAmountMinor,
    planMerchantRazorpayBillingCheckout,
    type BillingPlanCatalogRecord,
    type CreateSubscriptionOrderInput,
} from '@letbuyy/billing-core';
import { resolveFoundingCheckoutLock, isPlanPurchasable } from './founding-pricing';
import { SubscriptionExecutionAdapter } from '../execution/subscription-execution.adapter';
import { NotFoundError } from './errors';
import { errorBody } from './supabase';

type SubscriptionCheckoutEnv = {
    RAZORPAY_KEY_ID?: string;
    RAZORPAY_KEY_SECRET?: string;
};

export type SubscriptionCheckoutResult = {
    body: Record<string, unknown>;
    status?: 200 | 201 | 400 | 500 | 502 | 503;
};

type SubscriptionCheckoutInput = {
    db: SupabaseClient;
    env: SubscriptionCheckoutEnv;
    userId: string;
    storeId: string;
    siteType: string;
    planSlug: string;
    billingPeriod: CreateSubscriptionOrderInput['billing_period'];
    approvedUsageCharges?: CreateSubscriptionOrderInput['approved_usage_charges'];
    couponCode?: string;
};

export async function createMerchantSubscriptionCheckout(input: SubscriptionCheckoutInput): Promise<SubscriptionCheckoutResult> {
    const { data: rawPlan } = await input.db
        .from('plans')
        .select('*')
        .eq('site_type', input.siteType)
        .eq('slug', input.planSlug)
        .eq('is_active', true)
        .single();

    if (!rawPlan) {
        throw new NotFoundError('Plan not found');
    }

    const plan = applyStorePlanTierDefaults(rawPlan as BillingPlanCatalogRecord) as BillingPlanCatalogRecord & Record<string, unknown>;

    if (plan.requires_contact) {
        return {
            status: 400,
            body: { error: { code: 'PLAN_REQUIRES_SALES', message: 'This plan requires contacting sales' } },
        };
    }

    if (!isPlanPurchasable(plan)) {
        return {
            status: 400,
            body: { error: { code: 'PLAN_NOT_PURCHASABLE', message: 'This plan is not available for purchase' } },
        };
    }

    // Founding price lock: founders (and eligible founding-offer merchants while slots
    // remain) check out at the locked/founding price. applyFoundingLockToPlan also nulls
    // razorpay_plan_id so checkout uses server-authoritative order mode (never a
    // catalog-priced native subscription). See docs/v1/PRICE_LOCK_VERIFICATION.md.
    const foundingLock = await resolveFoundingCheckoutLock(input.db, input.storeId, plan);
    const effectivePlan = applyFoundingLockToPlan(plan, foundingLock) as BillingPlanCatalogRecord & Record<string, unknown>;

    const checkout = planMerchantRazorpayBillingCheckout({
        plan: effectivePlan,
        storeId: input.storeId,
        userId: input.userId,
        billingPeriod: input.billingPeriod,
        approvedUsageCharges: normalizeMerchantApprovedUsageCharges(input.approvedUsageCharges),
    });

    if (checkout.mode === 'free_activation') {
        const subscription = await new SubscriptionExecutionAdapter(input.db).activateMerchantSubscription({
            userId: input.userId,
            storeId: input.storeId,
            plan,
            billingPeriod: input.billingPeriod,
            amountPaid: 0,
            paymentGateway: null,
            externalSubscriptionId: `free:${input.storeId}:${Date.now()}`,
        });

        return {
            status: 201,
            body: {
                data: {
                    razorpay_order_id: null,
                    razorpay_subscription_id: null,
                    checkout_mode: checkout.mode,
                    amount: 0,
                    currency: checkout.currency,
                    key_id: null,
                    plan: checkout.plan_payload,
                    billing_period: checkout.billing_period,
                    is_promo: false,
                    recurring: false,
                    activated: true,
                    subscription,
                },
            },
        };
    }

    if (!input.env.RAZORPAY_KEY_ID || !input.env.RAZORPAY_KEY_SECRET) {
        return {
            status: 503,
            body: { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
        };
    }

    if (checkout.mode === 'razorpay_subscription' && checkout.subscription) {
        if (input.couponCode) {
            return {
                status: 400,
                body: errorBody('COUPON_NOT_SUPPORTED', 'Coupons are not supported for auto-renewing subscriptions on this plan'),
            };
        }
        const subscription = await createRazorpaySubscription(
            { keyId: input.env.RAZORPAY_KEY_ID, keySecret: input.env.RAZORPAY_KEY_SECRET },
            checkout.subscription,
        );

        if (!subscription.id) {
            return {
                status: 502,
                body: errorBody('PAYMENT_PROVIDER_ERROR', subscription.error?.description || 'Failed to create recurring subscription'),
            };
        }

        return {
            body: {
                data: {
                    razorpay_order_id: null,
                    razorpay_subscription_id: subscription.id,
                    checkout_mode: checkout.mode,
                    amount: checkout.amount_minor,
                    currency: checkout.currency,
                    key_id: input.env.RAZORPAY_KEY_ID,
                    plan: checkout.plan_payload,
                    billing_period: checkout.billing_period,
                    is_promo: checkout.is_promo,
                    recurring: true,
                    short_url: subscription.short_url || null,
                },
            },
        };
    }

    if (!checkout.order) {
        return {
            status: 500,
            body: errorBody('PAYMENT_PROVIDER_ERROR', 'Subscription checkout could not be planned'),
        };
    }

    // Server-authoritative coupon discount: validate against the server-computed
    // order amount, then discount the one-time Razorpay order before it is created.
    const baseOrderAmount = checkout.order.amount;
    let orderSpec = checkout.order;
    let couponData: { code: string; discount_minor: number; original_minor: number; final_minor: number } | null = null;
    if (input.couponCode) {
        const { data: verdict, error: couponError } = await input.db.rpc('validate_subscription_coupon', {
            p_code: input.couponCode,
            p_plan_slug: input.planSlug,
            p_billing_period: input.billingPeriod,
            p_amount_minor: baseOrderAmount,
            p_site_id: input.storeId,
        });
        if (couponError) {
            return { status: 400, body: errorBody('COUPON_INVALID', 'Could not validate coupon') };
        }
        const v = (verdict ?? {}) as Record<string, unknown>;
        if (v.valid !== true) {
            return {
                status: 400,
                body: errorBody('COUPON_INVALID', typeof v.message === 'string' ? v.message : 'Coupon is not valid'),
            };
        }
        const finalMinor = Number(v.final_minor);
        couponData = {
            code: String(v.code),
            discount_minor: Number(v.discount_minor) || 0,
            original_minor: baseOrderAmount,
            final_minor: Number.isFinite(finalMinor) ? finalMinor : baseOrderAmount,
        };
        orderSpec = {
            ...checkout.order,
            amount: couponData.final_minor,
            notes: { ...checkout.order.notes, coupon_code: couponData.code },
        };
    }

    const order = await createRazorpayOrder(
        { keyId: input.env.RAZORPAY_KEY_ID, keySecret: input.env.RAZORPAY_KEY_SECRET },
        orderSpec,
    );

    if (!order.id) {
        return {
            status: 502,
            body: errorBody('PAYMENT_PROVIDER_ERROR', 'Failed to create subscription payment order'),
        };
    }

    return {
        body: {
            data: {
                razorpay_order_id: order.id,
                razorpay_subscription_id: null,
                checkout_mode: checkout.mode,
                amount: order.amount ?? orderSpec.amount,
                currency: order.currency || 'INR',
                key_id: input.env.RAZORPAY_KEY_ID,
                plan: checkout.plan_payload,
                billing_period: checkout.billing_period,
                is_promo: checkout.is_promo,
                recurring: false,
                ...(couponData ? { coupon: couponData } : {}),
            },
        },
    };
}

/**
 * Read-only coupon preview for the checkout form. Computes the same
 * server-authoritative base amount the order would use (plan + founding lock),
 * then validates the coupon against it. Creates no Razorpay order.
 */
export async function previewSubscriptionCoupon(input: {
    db: SupabaseClient;
    storeId: string;
    siteType: string;
    planSlug: string;
    billingPeriod: SubscriptionCheckoutInput['billingPeriod'];
    couponCode: string;
}): Promise<SubscriptionCheckoutResult> {
    const { data: rawPlan } = await input.db
        .from('plans')
        .select('*')
        .eq('site_type', input.siteType)
        .eq('slug', input.planSlug)
        .eq('is_active', true)
        .single();

    if (!rawPlan) {
        throw new NotFoundError('Plan not found');
    }

    const plan = applyStorePlanTierDefaults(rawPlan as BillingPlanCatalogRecord) as BillingPlanCatalogRecord & Record<string, unknown>;
    const foundingLock = await resolveFoundingCheckoutLock(input.db, input.storeId, plan);
    const effectivePlan = applyFoundingLockToPlan(plan, foundingLock) as BillingPlanCatalogRecord;
    const base = planBillingAmountMinor(effectivePlan, input.billingPeriod);

    if (base.amountMinor <= 0) {
        return { status: 200, body: { data: { valid: false, message: 'This plan has no charge to discount', amount_minor: 0 } } };
    }

    const { data: verdict, error } = await input.db.rpc('validate_subscription_coupon', {
        p_code: input.couponCode,
        p_plan_slug: input.planSlug,
        p_billing_period: input.billingPeriod,
        p_amount_minor: base.amountMinor,
        p_site_id: input.storeId,
    });

    if (error) {
        return { status: 200, body: { data: { valid: false, message: 'Could not validate coupon', amount_minor: base.amountMinor } } };
    }

    const v = (verdict ?? {}) as Record<string, unknown>;
    return { status: 200, body: { data: { ...v, amount_minor: base.amountMinor } } };
}

/**
 * Record a subscription coupon redemption after a verified payment. Best-effort:
 * never throws into the activation path. Idempotent on the Razorpay payment id.
 */
export async function recordSubscriptionCouponRedemption(input: {
    db: SupabaseClient;
    storeId: string;
    userId: string;
    siteType: string;
    planSlug: string;
    billingPeriod: SubscriptionCheckoutInput['billingPeriod'];
    couponCode: string;
    razorpayOrderId?: string | null;
    razorpayPaymentId: string;
}): Promise<void> {
    try {
        const { data: rawPlan } = await input.db
            .from('plans')
            .select('*')
            .eq('site_type', input.siteType)
            .eq('slug', input.planSlug)
            .eq('is_active', true)
            .single();
        if (!rawPlan) return;

        const plan = applyStorePlanTierDefaults(rawPlan as BillingPlanCatalogRecord) as BillingPlanCatalogRecord & Record<string, unknown>;
        const foundingLock = await resolveFoundingCheckoutLock(input.db, input.storeId, plan);
        const effectivePlan = applyFoundingLockToPlan(plan, foundingLock) as BillingPlanCatalogRecord;
        const base = planBillingAmountMinor(effectivePlan, input.billingPeriod);
        if (base.amountMinor <= 0) return;

        const { data: verdict } = await input.db.rpc('validate_subscription_coupon', {
            p_code: input.couponCode,
            p_plan_slug: input.planSlug,
            p_billing_period: input.billingPeriod,
            p_amount_minor: base.amountMinor,
            p_site_id: input.storeId,
        });
        const v = (verdict ?? {}) as Record<string, unknown>;
        if (v.valid !== true) return;

        const discountMinor = Number(v.discount_minor) || 0;
        const finalMinorRaw = Number(v.final_minor);
        const finalMinor = Number.isFinite(finalMinorRaw) ? finalMinorRaw : base.amountMinor;

        await input.db.rpc('redeem_subscription_coupon', {
            p_code: input.couponCode,
            p_site_id: input.storeId,
            p_user_id: input.userId,
            p_plan_slug: input.planSlug,
            p_billing_period: input.billingPeriod,
            p_amount_before_minor: base.amountMinor,
            p_discount_minor: discountMinor,
            p_amount_after_minor: finalMinor,
            p_razorpay_order_id: input.razorpayOrderId ?? null,
            p_razorpay_payment_id: input.razorpayPaymentId,
            p_idempotency_key: input.razorpayPaymentId,
        });
    } catch {
        // Best-effort bookkeeping — never block subscription activation.
    }
}
