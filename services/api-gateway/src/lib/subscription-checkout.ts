import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    createRazorpayOrder,
    createRazorpaySubscription,
} from '@letbuyy/infrastructure/razorpay-adapter';
import {
    applyStorePlanTierDefaults,
    normalizeMerchantApprovedUsageCharges,
    planMerchantRazorpayBillingCheckout,
    type BillingPlanCatalogRecord,
    type CreateSubscriptionOrderInput,
} from '@letbuyy/billing-core';
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

    const checkout = planMerchantRazorpayBillingCheckout({
        plan,
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

    const order = await createRazorpayOrder(
        { keyId: input.env.RAZORPAY_KEY_ID, keySecret: input.env.RAZORPAY_KEY_SECRET },
        checkout.order,
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
                amount: order.amount ?? checkout.amount_minor,
                currency: order.currency || 'INR',
                key_id: input.env.RAZORPAY_KEY_ID,
                plan: checkout.plan_payload,
                billing_period: checkout.billing_period,
                is_promo: checkout.is_promo,
                recurring: false,
            },
        },
    };
}
