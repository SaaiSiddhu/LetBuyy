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
import { HumanRequiredError, NotFoundError } from '../lib/errors';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

type JsonRecord = Record<string, unknown>;
type BillingEventType = 'billing.charged' | 'billing.failed' | 'billing.plan_changed';

function configured(value: string | undefined): boolean {
    return Boolean(value && !value.startsWith('SKIP_NEEDS_HUMAN_') && !value.includes('replace-with'));
}

function autopayMode(env: Env): 'sandbox' | 'live' {
    return env.LETBUYY_AUTOPAY_MODE === 'live' ? 'live' : 'sandbox';
}

function assertAutopayReady(env: Env, providerMode: 'sandbox' | 'live') {
    if (providerMode !== 'live' && autopayMode(env) !== 'live') return;
    if (configured(env.RAZORPAY_KEY_ID) && configured(env.RAZORPAY_KEY_SECRET)) return;

    // [HUMAN-REQUIRED] HR-AUTOPAY-LIVE: live UPI AutoPay/NPCI mandate activation requires provider production activation and live credentials.
    throw new HumanRequiredError('Live AutoPay setup is required before live billing mandates can be enabled.');
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
    const { data, error } = await db
        .from('merchant_billing_invoices')
        .upsert(
            {
                site_id: input.siteId,
                subscription_id: input.subscriptionId,
                billing_history_id: input.billingHistoryId,
                invoice_number: input.invoiceNumber,
                status: input.paymentStatus === 'paid' ? 'issued' : 'payment_failed',
                currency: 'INR',
                subtotal_minor: input.amountMinor,
                cgst_minor: 0,
                sgst_minor: 0,
                igst_minor: input.taxMinor,
                total_minor: input.totalMinor,
                period_start: input.periodStart,
                period_end: input.periodEnd,
                irn: `sandbox-irn-${input.invoiceNumber}`,
                qr_payload: `sandbox-qr:${input.invoiceNumber}`,
                metadata: input.metadata || {},
                created_by: input.userId,
                updated_by: input.userId,
            },
            { onConflict: 'site_id,invoice_number' },
        )
        .select('*')
        .single();

    if (error) throw new Error(`Merchant billing invoice create failed: ${error.message}`);
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
    const existing = await db
        .from('billing_mandates')
        .select('*')
        .eq('site_id', tenant.siteId)
        .eq('idempotency_key', body.idempotency_key)
        .is('deleted_at', null)
        .maybeSingle();
    if (existing.error) throw new Error(`Billing mandate idempotency lookup failed: ${existing.error.message}`);
    if (existing.data) return c.json(success({ mandate: existing.data, replayed: true }));

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
            upi_vpa_hash: body.upi_vpa ? `sandbox-hash:${body.upi_vpa.trim().toLowerCase()}` : null,
            idempotency_key: body.idempotency_key,
            metadata: { ...body.metadata, sandbox: mandate.sandbox },
            created_by: tenant.userId,
            updated_by: tenant.userId,
        })
        .select('*')
        .single();

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
    // assertAutopayReady is NOT sufficient on its own: it passes once Razorpay credentials exist, and
    // this path would then fabricate a reference with credentials present, which is worse.
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
    // Founding price lock applies on every recurring charge (renewal-safe).
    const foundingLock = await resolveFoundingCheckoutLock(db, tenant.siteId, plan);
    const amount = planBillingAmountMinor(applyFoundingLockToPlan(plan, foundingLock), body.billing_period);
    const now = new Date();
    const periodEnd = subscriptionPeriodEnd(now, body.billing_period);
    const dunning = planBillingDunning({ paymentStatus: body.sandbox_payment_status });

    if (body.sandbox_payment_status === 'failed') {
        const { data: subscription, error: subscriptionError } = await db
            .from('subscriptions')
            .insert({
                user_id: tenant.userId,
                store_id: tenant.siteId,
                plan: plan.slug,
                plan_id: plan.id,
                status: 'past_due',
                billing_period: body.billing_period,
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                payment_gateway: 'razorpay',
                external_subscription_id: `sandbox_autopay_failed:${tenant.siteId}:${body.idempotency_key}`,
                amount_paid: amount.amountMinor,
                currency: 'INR',
                mandate_id: body.mandate_id || null,
                idempotency_key: body.idempotency_key,
                dunning_status: dunning.status,
                dunning_attempts: dunning.dunning_attempts,
                next_dunning_at: dunning.next_dunning_at,
            })
            .select('*')
            .single();
        if (subscriptionError || !subscription) throw new Error(`Past-due subscription create failed: ${subscriptionError?.message || 'unknown error'}`);

        const invoiceNumber = `MBI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const taxMinor = Math.round(amount.amountMinor * 0.18);
        const { data: history, error: historyError } = await db
            .from('billing_history')
            .insert({
                user_id: tenant.userId,
                store_id: tenant.siteId,
                site_id: tenant.siteId,
                subscription_id: subscription.id,
                invoice_number: invoiceNumber,
                description: `${plan.name} plan - ${body.billing_period}`,
                amount: amount.amountMinor,
                currency: 'INR',
                tax_amount: taxMinor,
                total_amount: amount.amountMinor + taxMinor,
                payment_gateway: 'razorpay',
                payment_id: `sandbox_failed:${body.idempotency_key}`,
                payment_status: 'failed',
                period_start: now.toISOString(),
                period_end: periodEnd.toISOString(),
            })
            .select('*')
            .single();
        if (historyError || !history) throw new Error(`Billing history create failed: ${historyError?.message || 'unknown error'}`);

        await createMerchantBillingInvoice(db, {
            siteId: tenant.siteId,
            subscriptionId: subscription.id,
            billingHistoryId: history.id,
            invoiceNumber,
            amountMinor: amount.amountMinor,
            taxMinor,
            totalMinor: amount.amountMinor + taxMinor,
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
            payload: { invoice_id: history.id, amount: amount.amountMinor },
        });
        return c.json(success({ subscription, dunning, invoice: history }), 201);
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
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (history) {
        await db.from('billing_history').update({ site_id: tenant.siteId }).eq('id', history.id);
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
        payload: { plan_id: plan.id, amount: amount.amountMinor },
    });
    await emitBillingEvent(db, {
        siteId: tenant.siteId,
        aggregateId: subscription.id,
        eventType: 'billing.charged',
        idempotencyKey: `event:billing.charged:${subscription.id}`,
        actorId: tenant.userId,
        requestId: c.req.header('X-Request-ID') || null,
        payload: { invoice_id: history?.id, amount: amount.amountMinor },
    });

    return c.json(success({ subscription, dunning, invoice: history || null }), 201);
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
    return c.json(success({ invoices: data || [] }));
});

export default router;
