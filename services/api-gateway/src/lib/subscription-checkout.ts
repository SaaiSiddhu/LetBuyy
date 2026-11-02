import {planImmediateSubscriptionChargeSchedule,planSubscriptionRecurringTaxSnapshots} from '@letbuyy/billing-core';
import {z} from 'zod';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    createRazorpayOrder,
    createRazorpaySubscription,
    fetchRazorpayOrdersByReceipt,
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
import { isFreeSubscriptionCheckoutCharge, subscriptionCheckoutRpc, requireSubscriptionTaxSnapshot, requireConfiguredSubscriptionPlan, resolveNewSubscriptionTaxSnapshot, subscriptionTaxSummary, type SubscriptionCheckoutCharge } from './subscription-checkout-source';
import { AppError, NotFoundError } from './errors';
import { errorBody } from './supabase';

type SubscriptionCheckoutEnv = {
    RAZORPAY_KEY_ID?: string;
    RAZORPAY_KEY_SECRET?: string;
    LETBUYY_SUBSCRIPTION_TAX_PROFILE?: string;
};

export type SubscriptionCheckoutResult = {
    body: Record<string, unknown>;
    status?: 200 | 201 | 400 | 500 | 502 | 503;
};

type SubscriptionCheckoutInput = {
    db: SupabaseClient;
    idempotencyKey: string;
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
    if(input.idempotencyKey.trim().length<8||input.idempotencyKey.length>200)
        throw new AppError('A valid idempotency key is required for subscription checkout.',400,'IDEMPOTENCY_KEY_REQUIRED');
    const request={plan_slug:input.planSlug,site_type:input.siteType,billing_period:input.billingPeriod,
        approved_usage_charges:normalizeMerchantApprovedUsageCharges(input.approvedUsageCharges),coupon_code:input.couponCode||null};
    const claimArgs={p_actor:input.userId,p_site:input.storeId,p_key:input.idempotencyKey,p_request:request};
    const retained=await subscriptionCheckoutRpc(input.db,'read_merchant_subscription_checkout_key_v1',claimArgs);
    if(retained.charge)return resumeCheckout(input,retained.charge,false);
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
        const claimed=await subscriptionCheckoutRpc(input.db,'claim_merchant_subscription_checkout_v1',{...claimArgs,p_quote:{
            mode:checkout.mode,plan,amount_minor:0,currency:checkout.currency,
            response:{checkout_mode:checkout.mode,amount:0,currency:checkout.currency,plan:checkout.plan_payload,
                billing_period:checkout.billing_period,is_promo:false,recurring:false}}});
        if(!claimed.charge||!isFreeSubscriptionCheckoutCharge(claimed.charge))
            throw new AppError('Checkout state is unavailable.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
        return resumeCheckout(input,claimed.charge,claimed.claimed===true);
    }

    if (!input.env.RAZORPAY_KEY_ID || !input.env.RAZORPAY_KEY_SECRET) {
        return {
            status: 503,
            body: { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
        };
    }

    if (checkout.mode === 'razorpay_subscription' && checkout.subscription) {
        const chargeSchedule=planImmediateSubscriptionChargeSchedule(checkout.amount_minor,input.approvedUsageCharges||[]);
        if(input.couponCode)return {status:400,body:errorBody('COUPON_NOT_SUPPORTED','Coupons are not supported for auto-renewing subscriptions on this plan')};
        const baseTax=await resolveNewSubscriptionTaxSnapshot(input.db,input.env,{actor:input.userId,site:input.storeId,key:input.idempotencyKey,plan:effectivePlan,period:input.billingPeriod,gross:checkout.amount_minor,beforeDiscount:checkout.amount_minor});
        const taxSources=planSubscriptionRecurringTaxSnapshots(baseTax,input.approvedUsageCharges||[]),tax=taxSources.initial;
        // Existing provider-plan/addon behavior is not silently changed. A stored
        // source must cover the exact consented charge before provider creation.
        const providerPlanBinding=await requireConfiguredSubscriptionPlan({keyId:input.env.RAZORPAY_KEY_ID,keySecret:input.env.RAZORPAY_KEY_SECRET},{planId:checkout.subscription.plan_id,baseGross:chargeSchedule.base_gross_minor,period:input.billingPeriod});
        const claimed=await subscriptionCheckoutRpc(input.db,'claim_merchant_subscription_checkout_v1',{...claimArgs,p_quote:{
            mode:checkout.mode,plan:effectivePlan,subscription_tax_snapshot:tax,recurring_tax_snapshot:taxSources.recurring,charge_schedule:chargeSchedule,provider_plan_binding:providerPlanBinding,amount_minor:chargeSchedule.initial_gross_minor,currency:checkout.currency,
            provider_input:checkout.subscription,response:{checkout_mode:checkout.mode,amount:chargeSchedule.initial_gross_minor,currency:checkout.currency,
                plan:checkout.plan_payload,billing_period:checkout.billing_period,is_promo:checkout.is_promo,recurring:true,tax:subscriptionTaxSummary(tax)}}});
        if(!claimed.charge)throw new AppError('Checkout state is unavailable.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
        return resumeCheckout(input,claimed.charge,claimed.claimed===true);
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

    const tax=await resolveNewSubscriptionTaxSnapshot(input.db,input.env,{actor:input.userId,site:input.storeId,key:input.idempotencyKey,plan:effectivePlan,period:input.billingPeriod,gross:orderSpec.amount,beforeDiscount:baseOrderAmount,coupon:couponData?.code});
    const claimed=await subscriptionCheckoutRpc(input.db,'claim_merchant_subscription_checkout_v1',{...claimArgs,p_quote:{
        mode:checkout.mode,plan:effectivePlan,subscription_tax_snapshot:tax,amount_minor:orderSpec.amount,currency:checkout.currency,provider_input:orderSpec,
        response:{checkout_mode:checkout.mode,amount:orderSpec.amount,currency:checkout.currency,plan:checkout.plan_payload,
            billing_period:checkout.billing_period,is_promo:checkout.is_promo,recurring:false,tax:subscriptionTaxSummary(tax),...(couponData?{coupon:couponData}:{})}}});
    if(!claimed.charge)throw new AppError('Checkout state is unavailable.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
    return resumeCheckout(input,claimed.charge,claimed.claimed===true);
}

async function resumeCheckout(input:SubscriptionCheckoutInput,charge:SubscriptionCheckoutCharge,claimed:boolean):Promise<SubscriptionCheckoutResult>{
    // Free results are backed by the same canonical checkout source, without
    // provider credentials or a clock-derived activation identity.
    if(isFreeSubscriptionCheckoutCharge(charge)){
        const quote=charge.subscription_checkout;
        const subscription=await new SubscriptionExecutionAdapter(input.db).activateMerchantSubscription({
            userId:input.userId,storeId:input.storeId,plan:quote.plan as BillingPlanCatalogRecord,
            billingPeriod:quote.response.billing_period,amountPaid:0,paymentGateway:null,
            externalSubscriptionId:charge.subscription_checkout_reference,
            freeCheckout:{id:charge.id,key:charge.subscription_checkout_key,request:charge.subscription_checkout_request},
        });
        return {status:201,body:{data:{...quote.response,razorpay_order_id:null,razorpay_subscription_id:null,
            key_id:null,activated:true,subscription}}};
    }
    requireSubscriptionTaxSnapshot(charge);
    const quote=charge.subscription_checkout;
    if(!input.env.RAZORPAY_KEY_ID||!input.env.RAZORPAY_KEY_SECRET)throw new AppError('Razorpay is not configured.',503,'PAYMENT_UNAVAILABLE');
    const credentials={keyId:input.env.RAZORPAY_KEY_ID,keySecret:input.env.RAZORPAY_KEY_SECRET};
    let reference=charge.subscription_checkout_reference,shortUrl=typeof quote.short_url==='string'?quote.short_url:null;
    const receipt='sub-'+charge.id;
    const pending=()=>new AppError('Checkout creation is awaiting provider reconciliation. Retry this same request key; no new payment was created by this retry.',503,'SUBSCRIPTION_CHECKOUT_PENDING');
    if(!reference){
        if(!quote.provider_input||!charge.id)throw pending();
        const notes={...((quote.provider_input.notes||{}) as Record<string,string>),subscription_checkout_id:charge.id};
        if(!claimed){
            // A missing result never authorizes another POST. Reconcile an exact order receipt.
            if(quote.mode!=='razorpay_order')throw pending();
            const found=await fetchRazorpayOrdersByReceipt(credentials,receipt).catch(()=>null);
            const matches=found?.items?.filter(row=>row.receipt===receipt&&row.amount===charge.amount&&row.currency===charge.currency
                &&row.notes?.subscription_checkout_id===charge.id&&row.notes?.store_id===input.storeId&&row.notes?.user_id===input.userId);
            if(found?.error||found?.items?.length!==1||matches?.length!==1||!matches[0].id)throw pending();
            reference=matches[0].id;
        }else{
            try{
                if(quote.mode==='razorpay_subscription'){
                    const created=await createRazorpaySubscription(credentials,{...z.object({plan_id:z.string(),total_count:z.number().int().positive(),quantity:z.number().optional(),customer_notify:z.boolean().optional(),addons:z.array(z.object({item:z.object({name:z.string(),amount:z.number(),currency:z.string()}),quantity:z.number().optional()})).optional()}).parse(quote.provider_input),notes});
                    if(!created.id||created.error||created.plan_id!==quote.provider_input.plan_id)throw pending();
                    reference=created.id;shortUrl=created.short_url||null;
                }else{
                    const created=await createRazorpayOrder(credentials,{...z.object({amount:z.number().int().positive(),currency:z.literal('INR')}).parse(quote.provider_input),receipt,notes});
                    if(!created.id||created.error||created.amount!==charge.amount||created.currency!==charge.currency)throw pending();
                    reference=created.id;
                }
            }catch{throw pending();}
        }
        await subscriptionCheckoutRpc(input.db,'bind_merchant_subscription_checkout_v1',{p_actor:input.userId,p_site:input.storeId,
            p_charge:charge.id,p_reference:reference,p_short_url:shortUrl});
    }
    return {body:{data:{...quote.response,key_id:input.env.RAZORPAY_KEY_ID,
        provider_mode:input.env.RAZORPAY_KEY_ID.startsWith('rzp_test_')?'sandbox':input.env.RAZORPAY_KEY_ID.startsWith('rzp_live_')?'live':null,
        razorpay_order_id:quote.mode==='razorpay_order'?reference:null,
        razorpay_subscription_id:quote.mode==='razorpay_subscription'?reference:null,...(shortUrl?{short_url:shortUrl}:{})}}};
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
    checkoutSource: SubscriptionCheckoutCharge;
    razorpayOrderId?: string | null;
    razorpayPaymentId: string;
}): Promise<void> {
    try {
        const snapshot=requireSubscriptionTaxSnapshot(input.checkoutSource),saved=snapshot.source;
        if(saved.coupon_code!==input.couponCode||saved.actor_id!==input.userId||saved.site_id!==input.storeId)return;
        const discountMinor=saved.discount_minor,finalMinor=snapshot.gross_minor;
        await input.db.rpc('redeem_subscription_coupon', {
            p_code: input.couponCode,
            p_site_id: input.storeId,
            p_user_id: input.userId,
            p_plan_slug: input.planSlug,
            p_billing_period: input.billingPeriod,
            p_amount_before_minor: saved.gross_before_discount_minor,
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
