import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { isInternalApiSecretRequest } from '../lib/internal-secret';
import { SubscriptionExecutionAdapter, type SubscriptionStatus } from '../execution/subscription-execution.adapter';
import {
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

function subscriptionStatusValue(value: unknown): SubscriptionStatus {
    if (value === 'cancelled' || value === 'past_due' || value === 'trialing') return value;
    return 'active';
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
    const { data: rawPlan } = await db
        .from('plans')
        .select('*')
        .eq('site_type', siteType)
        .eq('slug', planSlug)
        .eq('is_active', true)
        .single();

    if (!rawPlan) {
        return { error: c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404) };
    }

    return {
        db,
        store: owner,
        plan: applyStorePlanTierDefaults(rawPlan as BillingPlanCatalogRecord) as BillingPlanCatalogRecord,
    };
}

router.post('/subscriptions/activate', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const body = asRecord(await c.req.json().catch(() => ({})));
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

    const amountPaid = numberValue(body.amountPaid) ?? planBillingAmountMinor(resolved.plan, billingPeriod).amountMinor;
    const subscription = await new SubscriptionExecutionAdapter(resolved.db).activateMerchantSubscription({
        userId,
        storeId: resolved.store.id,
        plan: resolved.plan,
        billingPeriod,
        amountPaid,
        paymentGateway: provider,
        externalSubscriptionId: textValue(body.externalSubscriptionId) || textValue(body.providerOrderId) || null,
        razorpayOrderId: provider === 'razorpay' ? textValue(body.providerOrderId) || null : null,
        razorpayPaymentId: provider === 'razorpay' ? textValue(body.providerPaymentId) || null : null,
    });

    return c.json(success({ subscription }));
});

router.post('/subscriptions/sync', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const body = asRecord(await c.req.json().catch(() => ({})));
    const externalSubscriptionId = textValue(body.externalSubscriptionId);
    if (!externalSubscriptionId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'externalSubscriptionId is required' } }, 400);
    }

    const subscription = await new SubscriptionExecutionAdapter(getSupabaseAdmin(c)).syncProviderSubscription({
        externalSubscriptionId,
        status: subscriptionStatusValue(body.status),
        currentPeriodStart: textValue(body.currentPeriodStart) || null,
        currentPeriodEnd: textValue(body.currentPeriodEnd) || null,
    });

    return c.json(success({ subscription }));
});

router.post('/subscriptions/invoice', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const body = asRecord(await c.req.json().catch(() => ({})));
    const externalSubscriptionId = textValue(body.externalSubscriptionId);
    if (!externalSubscriptionId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'externalSubscriptionId is required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: subscription } = await db
        .from('subscriptions')
        .select('id, user_id, store_id')
        .eq('external_subscription_id', externalSubscriptionId)
        .is('deleted_at', null)
        .single();

    if (!subscription?.store_id) {
        return c.json(success({ recorded: false, reason: 'subscription_not_found' }));
    }

    const now = new Date().toISOString();
    const invoice = await new SubscriptionExecutionAdapter(db).recordSubscriptionInvoice({
        userId: String(subscription.user_id),
        storeId: String(subscription.store_id),
        subscriptionId: String(subscription.id),
        invoiceNumber: textValue(body.invoiceNumber) || `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        description: textValue(body.description) || 'Provider subscription invoice',
        amount: numberValue(body.amount) || 0,
        currency: (textValue(body.currency) || 'INR').toUpperCase(),
        taxAmount: numberValue(body.taxAmount) || 0,
        totalAmount: numberValue(body.totalAmount) || numberValue(body.amount) || 0,
        paymentGateway: textValue(body.provider) === 'razorpay' ? 'razorpay' : 'stripe',
        paymentId: textValue(body.paymentId) || null,
        paymentStatus: textValue(body.paymentStatus) === 'failed' ? 'failed' : 'paid',
        periodStart: textValue(body.periodStart) || now,
        periodEnd: textValue(body.periodEnd) || now,
    });

    return c.json(success({ recorded: true, invoice }));
});

export default router;
