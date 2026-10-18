import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import {readSubscriptionCheckoutSource,verifyNativeSubscriptionInvoice} from '../lib/subscription-checkout-source';
import { ValidationError } from '../lib/errors';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { isInternalApiSecretRequest } from '../lib/internal-secret';
import { SubscriptionExecutionAdapter } from '../execution/subscription-execution.adapter';
import {
    InternalSubscriptionActivationSchema,
    InternalSubscriptionInvoiceSchema,
    InternalSubscriptionStateSyncSchema,
    applyStorePlanTierDefaults,
    planBillingAmountMinor,
    type BillingPlanCatalogRecord,
    type SubscriptionBillingPeriod,
} from '@letbuyy/billing-core';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

type StoreOwnerRow = {
    id: string;
    user_id?: string | null;
    custom_user_id?: string | null;
    site_type?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function billingPeriodValue(value: unknown): SubscriptionBillingPeriod {
    return value === 'yearly' ? 'yearly' : 'monthly';
}

function isInternalRequest(c: AppContext): boolean {
    return isInternalApiSecretRequest(c.env, c.req);
}

async function requireStoreAndPlan(c: AppContext, body: Record<string, unknown>) {
    const db = getSupabaseAdmin(c);
    const storeId = textValue(body.storeId);
    const planSlug = textValue(body.planSlug);

    if (!storeId || !planSlug) {
        return { error: c.json({ success: false, error: { code: 'VALIDATION', message: 'storeId and planSlug are required' } }, 400) };
    }

    const { data: store } = await db
        .from('sites')
        .select('id, user_id, custom_user_id, site_type')
        .eq('id', storeId)
        .is('deleted_at', null)
        .single();

    if (!store) {
        return { error: c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404) };
    }

    const owner = store as StoreOwnerRow;
    const siteType = textValue(body.siteType) || owner.site_type || 'store';
    const actor=textValue(body.userId)||owner.custom_user_id||owner.user_id;
    const source=body.provider==='razorpay'&&!String(body.providerPaymentId||'').startsWith('sandbox_autopay_payment:')&&actor
        ?await readSubscriptionCheckoutSource(db,{actor,site:owner.id,
            reference:textValue(body.externalSubscriptionId)||textValue(body.providerOrderId)||'',payment:textValue(body.providerPaymentId)||'',
            planSlug,period:billingPeriodValue(body.billingPeriod)}):null;
    let rawPlan:BillingPlanCatalogRecord|null=source?.plan||null;
    if(!rawPlan){
        const result=await db.from('plans').select('*').eq('site_type',siteType).eq('slug',planSlug).eq('is_active',true).single();
        rawPlan=result.data as BillingPlanCatalogRecord|null;
    }
    if(!rawPlan)return {error:c.json({success:false,error:{code:'NOT_FOUND',message:'Plan not found'}},404)};

    return {
        db,
        store: owner,
        source,
        plan: applyStorePlanTierDefaults(rawPlan as BillingPlanCatalogRecord) as BillingPlanCatalogRecord,
    };
}

router.post('/subscriptions/activate', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const parsed=InternalSubscriptionActivationSchema.safeParse(await c.req.json().catch(()=>null));
    if(!parsed.success)throw new ValidationError('Invalid subscription activation payload.');
    const body=parsed.data;
    const resolved = await requireStoreAndPlan(c, body);
    if ('error' in resolved) return resolved.error;

    const billingPeriod = billingPeriodValue(body.billingPeriod);
    const userId = textValue(body.userId) || resolved.store.custom_user_id || resolved.store.user_id;
    if (!userId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Subscription store has no owner user' } }, 400);
    }

    const provider = textValue(body.provider);
    if (provider !== 'razorpay' && provider !== 'stripe') {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'provider must be razorpay or stripe' } }, 400);
    }

    let amountPaid = numberValue(body.amountPaid) ?? planBillingAmountMinor(resolved.plan, billingPeriod).amountMinor;
    const source=resolved.source;
    if(source&&body.amountPaid==null)amountPaid=source.retained_invoice_evidence?.gross_minor??source.amount;

    const nativeInvoice=source?.subscription_checkout.mode==='razorpay_subscription'&&!source.legacy_completed
        ?await verifyNativeSubscriptionInvoice({keyId:c.env.RAZORPAY_KEY_ID,keySecret:c.env.RAZORPAY_KEY_SECRET},source,
            {paymentId:textValue(body.providerPaymentId)||'',subscriptionId:textValue(body.externalSubscriptionId)||'',orderId:textValue(body.providerOrderId)}):null;
    if(nativeInvoice){
        if(body.amountPaid!=null&&numberValue(body.amountPaid)!==nativeInvoice.gross_minor)
            throw new ValidationError('The notification amount does not match its captured invoice.');
        amountPaid=nativeInvoice.gross_minor;
    }

    const subscription = await new SubscriptionExecutionAdapter(resolved.db).activateMerchantSubscription({
        userId,
        storeId: resolved.store.id,
        plan: source?.plan||resolved.plan,
        billingPeriod,
        amountPaid,
        paymentGateway: provider,
        externalSubscriptionId: textValue(body.externalSubscriptionId) || textValue(body.providerOrderId) || null,
        razorpayOrderId: provider === 'razorpay' ? nativeInvoice?.order_id || textValue(body.providerOrderId) || null : null,
        razorpayPaymentId: provider === 'razorpay' ? textValue(body.providerPaymentId) || null : null,
        ...(source?{taxSource:source}:{}),
        ...(nativeInvoice?{verifiedInvoice:nativeInvoice}:{}),
    });

    return c.json(success({ subscription }));
});

router.post('/subscriptions/sync', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const parsed=InternalSubscriptionStateSyncSchema.safeParse(await c.req.json().catch(()=>null));
    if(!parsed.success)throw new ValidationError('Invalid provider subscription status payload.');
    const subscription = await new SubscriptionExecutionAdapter(getSupabaseAdmin(c)).syncProviderSubscription(parsed.data);

    return c.json(success({ subscription }));
});

router.post('/subscriptions/invoice', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const parsedInvoice=InternalSubscriptionInvoiceSchema.safeParse(await c.req.json().catch(()=>null));
    if(!parsedInvoice.success)throw new ValidationError('Invalid subscription invoice payload.');
    const body=parsedInvoice.data;
    const externalSubscriptionId = textValue(body.externalSubscriptionId);
    if (!externalSubscriptionId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'externalSubscriptionId is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    // The canonical transaction resolves the original payment's tenant and
    // current owner. A provider reference never authorizes an unscoped REST read.
    const invoice = await new SubscriptionExecutionAdapter(db).recordSubscriptionInvoice({
        externalSubscriptionId,
        invoiceNumber: body.invoiceNumber,
        description: body.description,
        amount: numberValue(body.amount) || 0,
        currency: (textValue(body.currency) || 'INR').toUpperCase(),
        taxAmount: numberValue(body.taxAmount) || 0,
        totalAmount: numberValue(body.totalAmount) || numberValue(body.amount) || 0,
        paymentGateway: textValue(body.provider) === 'razorpay' ? 'razorpay' : 'stripe',
        paymentId: textValue(body.paymentId) || null,
        paymentStatus: textValue(body.paymentStatus) === 'failed' ? 'failed' : 'paid',
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
    });

    return c.json(success({ recorded: true, invoice }));
});

export default router;
