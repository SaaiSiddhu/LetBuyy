import {subscriptionCheckoutRpc,requireSubscriptionTaxSnapshot,resolveNewSubscriptionTaxSnapshot,subscriptionTaxSummary,publicSubscriptionBillingRecord} from '../lib/subscription-checkout-source';
import {createMerchantSubscriptionCheckout} from '../lib/subscription-checkout';
import { Hono } from 'hono';
import {
    BillingInvoiceQuerySchema,
    BillingMandateQuerySchema,
    BillingMandateSchema,
    BillingSubscribeSchema,
    applyStorePlanTierDefaults,
    applyFoundingLockToPlan,
    planBillingAmountMinor,
    planBillingDunning,
    planSandboxUpiAutopayMandate,
    type BillingInvoiceQueryInput,
    type BillingMandateInput,
    type BillingMandateQueryInput,
    type BillingPlanCatalogRecord,
    type BillingSubscribeInput,
} from '@letbuyy/billing-core';
import { resolveFoundingCheckoutLock, isPlanPurchasable } from '../lib/founding-pricing';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { SubscriptionExecutionAdapter, subscriptionPeriodEnd } from '../execution/subscription-execution.adapter';
import { HumanRequiredError, NotFoundError, AppError } from '../lib/errors';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { createRazorpayOrder } from '@letbuyy/infrastructure/razorpay-adapter';
import { verifyRazorpayPayment } from '../lib/provider-payment-verification';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

type JsonRecord = Record<string, unknown>;
type BillingEventType = 'billing.charged' | 'billing.failed' | 'billing.plan_changed';

function autopayMode(env: Env): 'sandbox' | 'live' {
    return env.LETBUYY_AUTOPAY_MODE === 'live' ? 'live' : 'sandbox';
}

function assertAutopayReady(env: Env, providerMode: 'sandbox' | 'live') {
    if (providerMode !== 'live' && autopayMode(env) !== 'live') return;
    // [HUMAN-REQUIRED] HR-AUTOPAY-LIVE: provider production activation and a
    // verified mandate flow are required before live billing can be enabled.
    // The route only records a synthetic mandate. Credentials alone cannot
    // prove a provider-created or verified live mandate.
    throw new HumanRequiredError('Live AutoPay mandates require a verified provider flow.');
}

function autopaySetupError(c: import('hono').Context<{ Bindings: Env }>) {
    return c.json({
        error: {
            code: 'AUTOPAY_PROVIDER_SETUP_REQUIRED',
            message: 'Billing mandate provider setup is not enabled for this environment.',
        },
    }, 503);
}

async function loadPlan(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteType: string,
    slug: string,
): Promise<BillingPlanCatalogRecord> {
    const { data, error } = await db
        .from('plans')
        .select('*')
        .eq('site_type', siteType)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

    if (error) throw new Error(`Billing plan lookup failed: ${error.message}`);
    if (!data) throw new NotFoundError('Plan not found');
    return applyStorePlanTierDefaults(data as BillingPlanCatalogRecord);
}

async function loadStoreSiteType(db: ReturnType<typeof getSupabaseAdmin>, siteId: string): Promise<string> {
    const { data, error } = await db
        .from('sites')
        .select('site_type')
        .eq('id', siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`Store lookup failed: ${error.message}`);
    return typeof data?.site_type === 'string' && data.site_type ? data.site_type : 'store';
}

async function emitBillingEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        eventType: BillingEventType;
        aggregateId: string;
        idempotencyKey: string;
        actorId?: string | null;
        requestId?: string | null;
        payload?: JsonRecord;
    },
) {
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'billing',
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: {
            site_id: input.siteId,
            subscription_id: input.aggregateId,
            ...input.payload,
        },
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId || null,
        actorId: input.actorId || null,
    });
}

async function createMerchantBillingInvoice(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        subscriptionId: string;
        billingHistoryId: string | null;
        invoiceNumber: string;
        amountMinor: number;
        taxMinor: number;
        totalMinor: number;
        periodStart: string;
        periodEnd: string;
        paymentStatus: 'paid' | 'failed';
        userId: string;
        metadata?: JsonRecord;
    },
) {
    // The atomic source writer owns invoice creation and component allocation.
    // This route reads its result; it cannot upsert or rewrite an issued invoice.
    const {data,error}=await db.from('merchant_billing_invoices').select('*')
        .eq('site_id',input.siteId).eq('billing_history_id',input.billingHistoryId).single();
    if(error||!data)throw new AppError('The canonical billing invoice needs recovery.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');

    return data;
}

router.post('/mandate', validate('json', BillingMandateSchema), async (c) => {
    const body = c.get('validatedBody') as BillingMandateInput;
    try {
        assertAutopayReady(c.env, body.provider_mode);
    } catch (error) {
        if (error instanceof HumanRequiredError) return autopaySetupError(c);
        throw error;
    }

    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const mandateConflict = () => c.json({ error: {
        code: 'BILLING_MANDATE_INTENT_CONFLICT',
        message: 'This mandate request belongs to different details. Review the existing mandate before trying again.',
    } }, 409);
    const replayMandate = (record: Record<string, unknown>) => {
        if (record.deleted_at || record.plan_slug !== body.plan_slug || record.billing_period !== body.billing_period
            || record.provider_mode !== body.provider_mode || record.upi_vpa_hash) return mandateConflict();
        return c.json(success({ mandate: record, replayed: true }));
    };
    const existing = await db
        .from('billing_mandates')
        .select('*')
        .eq('site_id', tenant.siteId)
        .eq('idempotency_key', body.idempotency_key)
        .maybeSingle();
    if (existing.error) throw new Error(`Billing mandate idempotency lookup failed: ${existing.error.message}`);
    if (existing.data) return replayMandate(existing.data);

    const siteType = await loadStoreSiteType(db, tenant.siteId);
    const plan = await loadPlan(db, siteType, body.plan_slug);
    if (!isPlanPurchasable(plan)) {
        return c.json({ error: { code: 'PLAN_NOT_PURCHASABLE', message: 'This plan is not available for purchase' } }, 400);
    }
    const mandateFoundingLock = await resolveFoundingCheckoutLock(db, tenant.siteId, plan);
    const mandate = planSandboxUpiAutopayMandate({
        plan: applyFoundingLockToPlan(plan, mandateFoundingLock),
        billingPeriod: body.billing_period,
        providerMode: body.provider_mode,
        idempotencyKey: body.idempotency_key,
    });
    const { data, error } = await db
        .from('billing_mandates')
        .insert({
            site_id: tenant.siteId,
            provider: mandate.provider,
            provider_mode: mandate.provider_mode,
            status: mandate.status,
            plan_slug: body.plan_slug,
            billing_period: body.billing_period,
            currency: 'INR',
            amount_minor: mandate.amount_minor,
            external_mandate_id: mandate.external_mandate_id,
            upi_vpa_hash: null,
            idempotency_key: body.idempotency_key,
            metadata: { ...body.metadata, sandbox: mandate.sandbox },
            created_by: tenant.userId,
            updated_by: tenant.userId,
        })
        .select('*')
        .single();

    if (error?.code === '23505') {
        // The unique (site_id, idempotency_key) constraint arbitrates races.
        // Recover its committed winner only when the same intent won.
        const winner = await db.from('billing_mandates').select('*')
            .eq('site_id', tenant.siteId).eq('idempotency_key', body.idempotency_key).maybeSingle();
        if (winner.error) throw new Error(`Billing mandate retry lookup failed: ${winner.error.message}`);
        if (winner.data) return replayMandate(winner.data);
        return mandateConflict();
    }
    if (error || !data) throw new Error(`Billing mandate create failed: ${error?.message || 'unknown error'}`);
    return c.json(success({ mandate: data }), 201);
});

router.post('/subscribe', validate('json', BillingSubscribeSchema), async (c) => {
    const body = c.get('validatedBody') as BillingSubscribeInput;

    // F-BILL-1. This route decides "paid" from body.sandbox_payment_status -- a CLIENT-SUPPLIED field
    // that defaults to 'paid' -- and then activates the subscription with a fabricated provider
    // reference (`sandbox_autopay_payment:<key>`). There is no provider call, no signature check and
    // no amount verification anywhere below. In sandbox that is a deliberate simulation and stays
    // exactly as it was; in LIVE mode it would let an authenticated merchant activate any purchasable
    // plan without paying, which is "never trust client payment status" and "a client-supplied
    // payment identifier is never sufficient proof of payment" in one request.
    //
    // So live mode REFUSES rather than fabricating. What it should do instead -- an orders row for a
    // platform charge, a second verification path, or a real autopay mandate -- is OWNER DECISION
    // D-PLATFORM-CHARGE, and picking one here would be answering it by implementation. Note that
    // The /mandate guard does not cover this separate /subscribe route. Keep
    // this refusal before any database or synthetic-payment work.
    if (autopayMode(c.env) === 'live') {
        return c.json({
            error: {
                code: 'AUTOPAY_PROVIDER_SETUP_REQUIRED',
                message: 'Live subscription billing requires a verified payment path; sandbox activation is refused in live mode.',
            },
        }, 503);
    }

    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const existing = await db
        .from('subscriptions')
        .select('id, plan, status, billing_period, current_period_end, idempotency_key')
        .eq('store_id', tenant.siteId)
        .eq('idempotency_key', body.idempotency_key)
        .maybeSingle();
    if (existing.error) throw new Error(`Billing subscription idempotency lookup failed: ${existing.error.message}`);
    if (existing.data) return c.json(success({ subscription: existing.data, replayed: true }));

    const siteType = await loadStoreSiteType(db, tenant.siteId);
    const plan = await loadPlan(db, siteType, body.plan_slug);
    if (!isPlanPurchasable(plan)) {
        return c.json({ error: { code: 'PLAN_NOT_PURCHASABLE', message: 'This plan is not available for purchase' } }, 400);
    }
    const request={plan_slug:body.plan_slug,site_type:siteType,billing_period:body.billing_period,
        approved_usage_charges:[],coupon_code:null,sandbox_payment_status:body.sandbox_payment_status,mandate_id:body.mandate_id||null};
    const claimArgs={p_actor:tenant.userId,p_site:tenant.siteId,p_key:body.idempotency_key,p_request:request};
    const retained=await subscriptionCheckoutRpc(db,'read_merchant_subscription_checkout_key_v1',claimArgs);
    const foundingLock=retained.charge?null:await resolveFoundingCheckoutLock(db,tenant.siteId,plan);
    const effectivePlan=retained.charge?retained.charge.subscription_checkout.plan as BillingPlanCatalogRecord:applyFoundingLockToPlan(plan,foundingLock);
    const amount=retained.charge?{amountMinor:retained.charge.amount,isPromo:false}:planBillingAmountMinor(effectivePlan,body.billing_period);
    if(amount.amountMinor===0){
        const free=await createMerchantSubscriptionCheckout({db,env:c.env,userId:tenant.userId||'',storeId:tenant.siteId,
            siteType,planSlug:body.plan_slug,billingPeriod:body.billing_period,idempotencyKey:body.idempotency_key});
        return c.json(free.body,free.status);
    }
    const tax=retained.charge?requireSubscriptionTaxSnapshot(retained.charge):await resolveNewSubscriptionTaxSnapshot(db,c.env,{
        actor:tenant.userId||'',site:tenant.siteId,key:body.idempotency_key,plan:effectivePlan,period:body.billing_period,
        gross:amount.amountMinor,beforeDiscount:amount.amountMinor});
    const claimed=retained.charge?retained:await subscriptionCheckoutRpc(db,'claim_merchant_subscription_checkout_v1',{...claimArgs,p_quote:{
        mode:'sandbox_activation',plan:effectivePlan,amount_minor:amount.amountMinor,currency:'INR',subscription_tax_snapshot:tax,
        response:{checkout_mode:'sandbox_activation',amount:amount.amountMinor,currency:'INR',billing_period:body.billing_period,tax:subscriptionTaxSummary(tax)}}});
    if(!claimed.charge?.id)throw new AppError('Subscription source is unavailable.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
    const source=claimed.charge;
    if(!source.subscription_checkout_reference)await subscriptionCheckoutRpc(db,'bind_merchant_subscription_checkout_v1',{
        p_actor:tenant.userId,p_site:tenant.siteId,p_charge:source.id,p_reference:`sandbox_autopay:${tenant.siteId}:${body.idempotency_key}`});
    const now = new Date();
    const periodEnd = subscriptionPeriodEnd(now, body.billing_period);
    const dunning = planBillingDunning({ paymentStatus: body.sandbox_payment_status });

    if (body.sandbox_payment_status === 'failed') {
        const invoiceNumber=`MBI-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
        const {data:failed,error:failedError}=await db.rpc('record_merchant_subscription_failure_v1',{p_input:{
            user_id:tenant.userId,store_id:tenant.siteId,source_id:source.id,payment_id:`sandbox_failed:${body.idempotency_key}`,
            invoice_number:invoiceNumber,description:`${plan.name} plan - ${body.billing_period}`,
            period_start:now.toISOString(),period_end:periodEnd.toISOString(),mandate_id:body.mandate_id||null,
            dunning_status:dunning.status,dunning_attempts:dunning.dunning_attempts,next_dunning_at:dunning.next_dunning_at,
        }});
        if(failedError||!failed||failed.accepted!==true||!failed.subscription||!failed.invoice)
            throw new AppError('Failed subscription billing source needs recovery.',503,'SUBSCRIPTION_STORAGE_UNAVAILABLE');
        const subscription=failed.subscription,history=failed.invoice,taxMinor=tax.tax_minor;

        await createMerchantBillingInvoice(db, {
            siteId: tenant.siteId,
            subscriptionId: subscription.id,
            billingHistoryId: history.id,
            invoiceNumber,
            amountMinor: amount.amountMinor,
            taxMinor,
            totalMinor: amount.amountMinor,
            periodStart: now.toISOString(),
            periodEnd: periodEnd.toISOString(),
            paymentStatus: 'failed',
            userId: tenant.userId || '',
            metadata: { dunning_status: dunning.status },
        });
        await db.from('billing_dunning_events').insert({
            site_id: tenant.siteId,
            subscription_id: subscription.id,
            billing_history_id: history.id,
            status: 'scheduled',
            attempt_number: dunning.dunning_attempts,
            next_attempt_at: dunning.next_dunning_at,
            reason: 'sandbox_autopay_failed',
            metadata: body.metadata,
            created_by: tenant.userId,
            updated_by: tenant.userId,
        });
        await emitBillingEvent(db, {
            siteId: tenant.siteId,
            aggregateId: subscription.id,
            eventType: 'billing.failed',
            idempotencyKey: `event:billing.failed:${subscription.id}`,
            actorId: tenant.userId,
            requestId: c.req.header('X-Request-ID') || null,
            payload: { invoice_id: history.id, amount: { amount_minor: amount.amountMinor, currency: 'INR' } },
        });
        return c.json(success({ subscription:publicSubscriptionBillingRecord(subscription), dunning, invoice:publicSubscriptionBillingRecord(history) }), 201);
    }

    const subscription = await new SubscriptionExecutionAdapter(db).activateMerchantSubscription({
        userId: tenant.userId || '',
        storeId: tenant.siteId,
        plan,
        billingPeriod: body.billing_period,
        amountPaid: amount.amountMinor,
        paymentGateway: amount.amountMinor > 0 ? 'razorpay' : null,
        externalSubscriptionId: `sandbox_autopay:${tenant.siteId}:${body.idempotency_key}`,
        razorpayPaymentId: amount.amountMinor > 0 ? `sandbox_autopay_payment:${body.idempotency_key}` : null,
        taxSource:source,
        now,
    });
    await db
        .from('subscriptions')
        .update({
            mandate_id: body.mandate_id || null,
            idempotency_key: body.idempotency_key,
            dunning_status: dunning.status,
            dunning_attempts: dunning.dunning_attempts,
            next_dunning_at: dunning.next_dunning_at,
        })
        .eq('id', subscription.id)
        .eq('store_id', tenant.siteId);

    const { data: history } = await db
        .from('billing_history')
        .select('*')
        .eq('subscription_id', subscription.id)
        .eq('site_id', tenant.siteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (history) {
        await createMerchantBillingInvoice(db, {
            siteId: tenant.siteId,
            subscriptionId: subscription.id,
            billingHistoryId: history.id,
            invoiceNumber: history.invoice_number,
            amountMinor: Number(history.amount || 0),
            taxMinor: Number(history.tax_amount || 0),
            totalMinor: Number(history.total_amount || 0),
            periodStart: history.period_start || now.toISOString(),
            periodEnd: history.period_end || periodEnd.toISOString(),
            paymentStatus: 'paid',
            userId: tenant.userId || '',
            metadata: body.metadata,
        });
    }

    await emitBillingEvent(db, {
        siteId: tenant.siteId,
        aggregateId: subscription.id,
        eventType: 'billing.plan_changed',
        idempotencyKey: `event:billing.plan_changed:${subscription.id}`,
        actorId: tenant.userId,
        requestId: c.req.header('X-Request-ID') || null,
        payload: { plan_id: plan.id, amount: { amount_minor: amount.amountMinor, currency: 'INR' } },
    });
    await emitBillingEvent(db, {
        siteId: tenant.siteId,
        aggregateId: subscription.id,
        eventType: 'billing.charged',
        idempotencyKey: `event:billing.charged:${subscription.id}`,
        actorId: tenant.userId,
        requestId: c.req.header('X-Request-ID') || null,
        payload: { invoice_id: history?.id, amount: { amount_minor: amount.amountMinor, currency: 'INR' } },
    });

    return c.json(success({ subscription, dunning, invoice: history?publicSubscriptionBillingRecord(history):null }), 201);
});

// GET /billing/mandates — list the store's billing payment methods (Razorpay UPI
// AutoPay mandates: how the merchant pays LetBuyy). Read-only, ownership-checked.
// Distinct from the storefront payment config (how the merchant collects from THEIR
// customers), which lives under /stores/:id/payment-config.
router.get('/mandates', validate('query', BillingMandateQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as BillingMandateQueryInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const { data, error } = await db
        .from('billing_mandates')
        .select('id, provider, provider_mode, status, plan_slug, billing_period, currency, amount_minor, external_mandate_id, created_at, updated_at')
        .eq('site_id', tenant.siteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Billing mandate lookup failed: ${error.message}`);
    return c.json(success({ mandates: data || [] }));
});

router.get('/invoices', validate('query', BillingInvoiceQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as BillingInvoiceQueryInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const { data, error } = await db
        .from('billing_history')
        .select('*, merchant_billing_invoices(*)')
        .eq('site_id', tenant.siteId)
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (error) throw new Error(`Billing invoice lookup failed: ${error.message}`);
    return c.json(success({ invoices: (data||[]).map(row=>publicSubscriptionBillingRecord(row)) }));
});

// ---------------------------------------------------------------------------
// Ad credit purchase (D-PLATFORM-CHARGE, F-CHARGE-2)
// ---------------------------------------------------------------------------
// `record_ad_credit_purchase` has had no caller since F-ADS-1a: it requires a VERIFIED payment
// reference, and the only verified Razorpay path in this repository was welded to `orders`. The
// owner's decision was to extract that verifier (F-CHARGE-1) and bind platform charges to
// `billing`, which is what these two routes do.
//
// WHY THEY ARE HERE AND NOT IN routes/ads.ts: that file has a tested property that it contains NO
// service-role path at all — every route runs inside the tenant transaction — and these need the
// admin client for the provider call and the billing row. Adding them there would have quietly
// broken that contract.
//
// The shape mirrors the storefront order path exactly, which is the point of having one verifier:
// the server creates the provider order and stores ITS id, and verification later requires the
// presented id to equal the stored one. A signature alone only proves Razorpay signed something.

const AD_CREDIT_MIN_MINOR = 10000;      // INR 100 — below this the provider fee dominates the top-up.
const AD_CREDIT_MAX_MINOR = 100000000;  // INR 10,00,000 — a ceiling, so a typo cannot open a huge order.

// POST /billing/ad-credits/intent — create the provider order and the PENDING billing row.
router.post('/ad-credits/intent', async (c) => {
    let body: { store_id?: unknown; amount_minor?: unknown };
    try {
        body = (await c.req.json()) as typeof body;
    } catch {
        return c.json({ error: { code: 'VALIDATION', message: 'A JSON body is required.' } }, 400);
    }
    if (typeof body.store_id !== 'string') {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required.' } }, 400);
    }
    const amountMinor = Number(body.amount_minor);
    if (!Number.isInteger(amountMinor) || amountMinor < AD_CREDIT_MIN_MINOR || amountMinor > AD_CREDIT_MAX_MINOR) {
        return c.json({ error: { code: 'VALIDATION', message: `amount_minor must be an integer between ${AD_CREDIT_MIN_MINOR} and ${AD_CREDIT_MAX_MINOR}.` } }, 400);
    }

    // Fails closed, exactly as the storefront order path does.
    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
        return c.json({ error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } }, 503);
    }

    const db = getSupabaseAdmin(c);
    // Ownership: the site is resolved from the caller's own scope, never taken from the body beyond
    // choosing WHICH owned store to resolve.
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);

    const providerOrder = await createRazorpayOrder(
        { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
        { amount: amountMinor, currency: 'INR', receipt: `adcredit-${tenant.siteId}`, notes: { purpose: 'ad_credits', site_id: tenant.siteId } },
    );
    if (!providerOrder.id) {
        return c.json({ error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment order' } }, 502);
    }

    // payment_id holds the SERVER-created provider order id. That is the reference verification
    // binds against, and storing it here is what makes this row the platform-charge equivalent of
    // orders.payment_id.
    const { data: row, error } = await db
        .from('billing_history')
        .insert({
            user_id: tenant.userId,
            store_id: tenant.siteId,
            site_id: tenant.siteId,
            invoice_number: `ADC-${providerOrder.id}`,
            description: 'Prepaid ad credits',
            amount: amountMinor,
            currency: 'INR',
            tax_amount: 0,
            total_amount: amountMinor,
            payment_gateway: 'razorpay',
            payment_id: providerOrder.id,
            payment_status: 'pending',
        })
        .select('id, payment_id, amount, payment_status')
        .single();
    if (error || !row) throw new Error(`Ad credit intent create failed: ${error?.message || 'unknown error'}`);

    return c.json(success({
        billing_history_id: row.id,
        provider: 'razorpay',
        provider_order_id: providerOrder.id,
        amount_minor: amountMinor,
        key_id: c.env.RAZORPAY_KEY_ID,
    }), 201);
});

// POST /billing/ad-credits/verify — verify, then credit.
router.post('/ad-credits/verify', async (c) => {
    let body: { store_id?: unknown; razorpay_order_id?: unknown; razorpay_payment_id?: unknown; razorpay_signature?: unknown };
    try {
        body = (await c.req.json()) as typeof body;
    } catch {
        return c.json({ error: { code: 'VALIDATION', message: 'A JSON body is required.' } }, 400);
    }
    for (const field of ['store_id', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'] as const) {
        if (typeof body[field] !== 'string' || !body[field]) {
            return c.json({ error: { code: 'VALIDATION', message: `${field} is required.` } }, 400);
        }
    }

    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id as string);

    // The row is looked up by the provider order id AND the resolved site. Scoping by the reference
    // alone would let a merchant present someone else's provider order and have the credit land in
    // their own balance — the site must come from ownership, and the row must belong to it.
    const { data: charge, error: chargeError } = await db
        .from('billing_history')
        .select('id, amount, payment_id, payment_status')
        .eq('payment_id', body.razorpay_order_id as string)
        .eq('site_id', tenant.siteId)
        .maybeSingle();
    if (chargeError) throw new Error(`Ad credit charge lookup failed: ${chargeError.message}`);
    if (!charge) throw new NotFoundError('Ad credit charge not found');

    const verification = await verifyRazorpayPayment(c.env.RAZORPAY_KEY_SECRET, {
        providerOrderId: body.razorpay_order_id as string,
        providerPaymentId: body.razorpay_payment_id as string,
        signature: body.razorpay_signature as string,
        // The SERVER-stored reference. Never anything from the request.
        storedProviderOrderId: (charge as { payment_id: string | null }).payment_id,
    });
    if (!verification.ok) {
        if (verification.reason === 'provider_not_configured') {
            return c.json({ error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } }, 503);
        }
        return c.json({ error: { code: 'PAYMENT_ERROR', message: 'Invalid payment signature' } }, 400);
    }

    // The AMOUNT comes from the stored row, never the request: a caller-supplied amount is a
    // caller-chosen number of credits.
    const amountMinor = Number((charge as { amount: number }).amount);
    const paymentId = body.razorpay_payment_id as string;

    // One SQL transaction locks and finalizes this billing row together with the prepaid credit.
    // The provider payment id is the idempotency key; a lost response can replay the same payment,
    // while a second payment attempt for the same order cannot issue another credit.
    const { data: credited, error: creditError } = await db.rpc('finalize_ad_credit_purchase', {
        p_site_id: tenant.siteId,
        p_billing_history_id: (charge as { id: string }).id,
        p_provider_order_id: body.razorpay_order_id as string,
        p_provider_payment_id: paymentId,
        p_request_id: c.req.header('x-request-id') ?? null,
        p_actor_id: tenant.userId ?? null,
    });
    if (creditError) throw new Error(`Ad credit purchase failed: ${creditError.message}`);

    return c.json(success({ credited, amount_minor: amountMinor }));
});

export default router;
