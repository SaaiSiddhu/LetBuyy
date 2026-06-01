import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { hmacSha256Hex, timingSafeEqualHex } from '../lib/crypto';
import { dbErrorBody, errorBody, getSupabaseAdmin } from '../lib/supabase';
import { ForbiddenError, ConflictError, NotFoundError } from '../lib/errors';
import { validate } from '../middleware/validation';
import { PaymentExecutionAdapter } from '../execution/payment-execution.adapter';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { createRazorpayOrder, createRazorpaySubscription } from '@letbuyy/infrastructure/razorpay-adapter';
import { createStripeCheckoutSessionWithFetch } from '@letbuyy/infrastructure/stripe-adapter';
import {
    RazorpayOrderSchema,
    RazorpayVerifySchema,
    StripeCheckoutSchema,
} from '../schemas/order.schema';
import {
    CancelSubscriptionSchema,
    CreateSubscriptionOrderSchema,
    PlanListQuerySchema,
    StoreSubscriptionQuerySchema,
    VerifySubscriptionSchema,
    type CancelSubscriptionInput,
    type BillingPlanCatalogRecord,
    type CreateSubscriptionOrderInput,
    type PlanListQueryInput,
    type StoreSubscriptionQueryInput,
    type VerifySubscriptionInput,
    applyStorePlanTierDefaults,
    normalizeMerchantApprovedUsageCharges,
    planBillingAmountMinor,
    planMerchantRazorpayBillingCheckout,
    razorpayBillingSignaturePayload,
} from '@letbuyy/billing-core';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

type PayableOrder = {
    id: string;
    store_id: string;
    total: number;
    currency?: string | null;
    payment_status?: string | null;
    status?: string | null;
};

type RazorpayOrderCreateResponse = {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string };
};

type SubscriptionPlanRow = {
    id: string;
    slug: string;
    name: string;
    products_limit?: number | null;
    promo_price_inr?: number | null;
    promo_months?: number | null;
};

type ClientAmountFields = {
    amount?: number;
    amountMinorUnits?: number;
    amount_minor_units?: number;
};

function getRequestId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function requestedAmountMinorUnits(input: ClientAmountFields): number | null {
    if (typeof input.amountMinorUnits === 'number') return input.amountMinorUnits;
    if (typeof input.amount_minor_units === 'number') return input.amount_minor_units;
    if (typeof input.amount === 'number') return Math.round(input.amount * 100);
    return null;
}

function amountMismatchBody() {
    return {
        error: {
            code: 'AMOUNT_MISMATCH',
            message: 'Order amount changed. Please refresh checkout and try again.',
        },
    };
}

function subscriptionPeriodEnd(now: Date, billingPeriod: 'monthly' | 'yearly'): Date {
    const periodEnd = new Date(now);
    if (billingPeriod === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    return periodEnd;
}

function subscriptionPromoEnd(now: Date, plan: SubscriptionPlanRow, billingPeriod: 'monthly' | 'yearly'): string | null {
    if (Number(plan.promo_price_inr || 0) <= 0 || Number(plan.promo_months || 0) <= 0 || billingPeriod !== 'monthly') {
        return null;
    }

    const promoEnd = new Date(now);
    promoEnd.setMonth(promoEnd.getMonth() + Number(plan.promo_months || 0));
    return promoEnd.toISOString();
}

async function activateMerchantSubscription(input: {
    db: ReturnType<typeof getSupabaseAdmin>;
    userId: string;
    storeId: string;
    plan: SubscriptionPlanRow;
    billingPeriod: 'monthly' | 'yearly';
    amountPaid: number;
    paymentGateway?: 'razorpay' | null;
    externalSubscriptionId?: string | null;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    now?: Date;
}) {
    const now = input.now || new Date();
    const periodEnd = subscriptionPeriodEnd(now, input.billingPeriod);
    const promoEndsAt = subscriptionPromoEnd(now, input.plan, input.billingPeriod);

    await input.db
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: now.toISOString() })
        .eq('store_id', input.storeId)
        .eq('status', 'active');

    const { data: subscription, error: subError } = await input.db
        .from('subscriptions')
        .insert({
            user_id: input.userId,
            store_id: input.storeId,
            plan: input.plan.slug,
            plan_id: input.plan.id,
            status: 'active',
            billing_period: input.billingPeriod,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            promo_ends_at: promoEndsAt,
            payment_gateway: input.paymentGateway || null,
            external_subscription_id: input.externalSubscriptionId || null,
            razorpay_order_id: input.razorpayOrderId || null,
            razorpay_payment_id: input.razorpayPaymentId || null,
            amount_paid: input.amountPaid,
            currency: 'INR',
            products_limit: input.plan.products_limit,
            stores_limit: 1,
        })
        .select()
        .single();

    if (subError || !subscription) {
        throw new Error('Failed to create subscription');
    }

    await input.db
        .from('sites')
        .update({ trial_status: input.amountPaid > 0 ? 'paid' : 'active', updated_at: now.toISOString() })
        .eq('id', input.storeId);

    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await input.db
        .from('billing_history')
        .insert({
            user_id: input.userId,
            store_id: input.storeId,
            subscription_id: subscription.id,
            invoice_number: invoiceNumber,
            description: `${input.plan.name} plan - ${input.billingPeriod === 'yearly' ? 'Annual' : 'Monthly'}`,
            amount: input.amountPaid,
            currency: 'INR',
            tax_amount: Math.round(input.amountPaid * 0.18),
            total_amount: input.amountPaid + Math.round(input.amountPaid * 0.18),
            payment_gateway: input.paymentGateway || null,
            payment_id: input.razorpayPaymentId || null,
            payment_status: 'paid',
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
        });

    return {
        id: subscription.id,
        plan: input.plan.slug,
        plan_name: input.plan.name,
        status: 'active',
        billing_period: input.billingPeriod,
        current_period_end: periodEnd.toISOString(),
        promo_ends_at: promoEndsAt,
        external_subscription_id: input.externalSubscriptionId || null,
    };
}

// GET /payments/plans — Fetch active subscription plans through the worker boundary
router.get('/plans', validate('query', PlanListQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as PlanListQueryInput;
    const db = getSupabaseAdmin(c);

    let request = db
        .from('plans')
        .select('*')
        .eq('site_type', query.site_type)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

    if (query.slug) {
        request = request.eq('slug', query.slug);
    }

    const { data, error } = await request;

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: (data || []).map((plan) => applyStorePlanTierDefaults(plan as BillingPlanCatalogRecord)) });
});

async function loadPayableOrder(
    c: AppContext,
    orderId: string,
    userId: string,
    sessionStoreId?: string
): Promise<PayableOrder> {
    const db = getSupabaseAdmin(c);

    const { data: order } = await db
        .from('orders')
        .select('id, store_id, total, currency, payment_status, status')
        .eq('id', orderId)
        .is('deleted_at', null)
        .single();

    if (!order) {
        throw new NotFoundError('Order not found');
    }

    const payableOrder = order as PayableOrder;

    if (!(await verifySiteOwnership(db, payableOrder.store_id, userId, sessionStoreId))) {
        throw new ForbiddenError('Not authorized to pay this order');
    }

    if (payableOrder.payment_status === 'paid') {
        throw new ConflictError('Order is already paid');
    }

    if (payableOrder.status === 'cancelled' || payableOrder.status === 'refunded') {
        throw new ConflictError('Order is not payable');
    }

    const total = Number(payableOrder.total);

    if (!Number.isFinite(total) || total <= 0) {
        throw new ConflictError('Order does not have a payable total');
    }

    return {
        ...payableOrder,
        total,
        currency: payableOrder.currency || 'INR',
    };
}

// GET /payments/subscription — Store-scoped billing state for merchant admin
router.get('/subscription', validate('query', StoreSubscriptionQuerySchema), async (c) => {
    const auth = c.get('auth');
    const { store_id } = c.get('validatedQuery') as StoreSubscriptionQueryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data: store } = await db
        .from('sites')
        .select('id, trial_status, trial_ends_at, site_type')
        .eq('id', store_id)
        .single();

    if (!store) throw new NotFoundError('Store not found');

    const { data: subscription, error } = await db
        .from('subscriptions')
        .select('plan, status, billing_period, current_period_end, promo_ends_at, amount_paid')
        .eq('store_id', store_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({
        data: {
            store: {
                id: store.id,
                trial_status: store.trial_status || 'active',
                trial_ends_at: store.trial_ends_at || null,
                site_type: store.site_type || 'store',
            },
            subscription: subscription || null,
        },
    });
});

// GET /payments/subscription/history — Store-scoped billing/invoice history for merchant admin
router.get('/subscription/history', validate('query', StoreSubscriptionQuerySchema), async (c) => {
    const auth = c.get('auth');
    const { store_id } = c.get('validatedQuery') as StoreSubscriptionQueryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data, error } = await db
        .from('subscriptions')
        .select('id, amount_paid, status, billing_period, created_at')
        .eq('store_id', store_id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: data || [] });
});

// POST /payments/subscription/cancel — Cancel active store subscription
router.post('/subscription/cancel', validate('json', CancelSubscriptionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CancelSubscriptionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data, error } = await db
        .from('subscriptions')
        .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancel_reason: body.reason || 'merchant_requested',
        })
        .eq('store_id', body.store_id)
        .eq('status', 'active')
        .select('id, plan, status, current_period_end, cancelled_at')
        .limit(1);

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    return c.json({ data: { cancelled: true, subscriptions: data || [] } });
});

// POST /payments/subscription/order — Create a Razorpay order for merchant subscription checkout
router.post('/subscription/order', validate('json', CreateSubscriptionOrderSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateSubscriptionOrderInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data: rawPlan } = await db
        .from('plans')
        .select('*')
        .eq('site_type', body.site_type)
        .eq('slug', body.plan_slug)
        .eq('is_active', true)
        .single();

    if (!rawPlan) {
        throw new NotFoundError('Plan not found');
    }

    const plan = applyStorePlanTierDefaults(rawPlan as BillingPlanCatalogRecord) as SubscriptionPlanRow & Record<string, unknown>;

    if (plan.requires_contact) {
        return c.json({ error: { code: 'PLAN_REQUIRES_SALES', message: 'This plan requires contacting sales' } }, 400);
    }

    const checkout = planMerchantRazorpayBillingCheckout({
        plan,
        storeId: body.store_id,
        userId: customUser.id,
        billingPeriod: body.billing_period,
        approvedUsageCharges: normalizeMerchantApprovedUsageCharges(body.approved_usage_charges),
    });

    if (checkout.mode === 'free_activation') {
        const subscription = await activateMerchantSubscription({
            db,
            userId: customUser.id,
            storeId: body.store_id,
            plan,
            billingPeriod: body.billing_period,
            amountPaid: 0,
            paymentGateway: null,
            externalSubscriptionId: `free:${body.store_id}:${Date.now()}`,
        });

        return c.json({
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
        }, 201);
    }

    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
        return c.json(
            { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
            503
        );
    }

    if (checkout.mode === 'razorpay_subscription' && checkout.subscription) {
        const subscription = await createRazorpaySubscription(
            { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
            checkout.subscription
        );

        if (!subscription.id) {
            return c.json(
                errorBody('PAYMENT_PROVIDER_ERROR', subscription.error?.description || 'Failed to create recurring subscription'),
                502
            );
        }

        return c.json({
            data: {
                razorpay_order_id: null,
                razorpay_subscription_id: subscription.id,
                checkout_mode: checkout.mode,
                amount: checkout.amount_minor,
                currency: checkout.currency,
                key_id: c.env.RAZORPAY_KEY_ID,
                plan: checkout.plan_payload,
                billing_period: checkout.billing_period,
                is_promo: checkout.is_promo,
                recurring: true,
                short_url: subscription.short_url || null,
            },
        });
    }

    if (!checkout.order) {
        return c.json(
            errorBody('PAYMENT_PROVIDER_ERROR', 'Subscription checkout could not be planned'),
            500
        );
    }

    const order = await createRazorpayOrder(
        { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
        checkout.order
    );

    if (!order.id) {
        return c.json(
            errorBody('PAYMENT_PROVIDER_ERROR', 'Failed to create subscription payment order'),
            502
        );
    }

    return c.json({
        data: {
            razorpay_order_id: order.id,
            razorpay_subscription_id: null,
            checkout_mode: checkout.mode,
            amount: order.amount ?? checkout.amount_minor,
            currency: order.currency || 'INR',
            key_id: c.env.RAZORPAY_KEY_ID,
            plan: checkout.plan_payload,
            billing_period: checkout.billing_period,
            is_promo: checkout.is_promo,
            recurring: false,
        },
    });
});

// POST /payments/subscription/verify — Verify Razorpay and activate a merchant subscription
router.post('/subscription/verify', validate('json', VerifySubscriptionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as VerifySubscriptionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data: store } = await db
        .from('sites')
        .select('id, site_type')
        .eq('id', body.store_id)
        .single();

    if (!store) throw new NotFoundError('Store not found');

    if (!c.env.RAZORPAY_KEY_SECRET) {
        return c.json({ error: { code: 'PAYMENT_UNAVAILABLE', message: 'Payment gateway is not configured' } }, 503);
    }

    const expected = await hmacSha256Hex(
        c.env.RAZORPAY_KEY_SECRET,
        razorpayBillingSignaturePayload({
            orderId: body.razorpay_order_id,
            subscriptionId: body.razorpay_subscription_id,
            paymentId: body.razorpay_payment_id,
        })
    );

    if (!timingSafeEqualHex(expected, body.razorpay_signature)) {
        return c.json({ error: { code: 'PAYMENT_SIGNATURE_INVALID', message: 'Payment verification failed' } }, 400);
    }

    const { data: rawPlan } = await db
        .from('plans')
        .select('*')
        .eq('site_type', body.site_type)
        .eq('slug', body.plan_slug)
        .eq('is_active', true)
        .single();

    if (!rawPlan) {
        throw new NotFoundError('Plan not found');
    }

    const plan = applyStorePlanTierDefaults(rawPlan as BillingPlanCatalogRecord) as SubscriptionPlanRow & Record<string, unknown>;

    const amountPaid = planBillingAmountMinor(plan, body.billing_period).amountMinor;

    let subscription;
    try {
        subscription = await activateMerchantSubscription({
            db,
            userId: customUser.id,
            storeId: body.store_id,
            plan,
            billingPeriod: body.billing_period,
            amountPaid,
            paymentGateway: 'razorpay',
            externalSubscriptionId: body.razorpay_subscription_id || body.razorpay_order_id || null,
            razorpayOrderId: body.razorpay_order_id || null,
            razorpayPaymentId: body.razorpay_payment_id,
        });
    } catch {
        return c.json(dbErrorBody('Failed to create subscription'), 500);
    }

    return c.json({
        data: {
            subscription,
            message: `Successfully subscribed to ${plan.name} plan!`,
        },
    }, 201);
});

// POST /payments/razorpay/order — Create a Razorpay order
router.post('/razorpay/order', validate('json', RazorpayOrderSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as {
        order_id: string;
        idempotency_key: string;
        amount?: number;
        amount_minor_units?: number;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        throw new ForbiddenError('User profile not found');
    }

    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
        return c.json(
            { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
            503
        );
    }

    const order = await loadPayableOrder(c, body.order_id, customUser.id, auth.user.storeId);
    const amountMinorUnits = Math.round(order.total * 100);
    const requestedMinorUnits = requestedAmountMinorUnits(body);
    if (requestedMinorUnits !== null && requestedMinorUnits !== amountMinorUnits) {
        return c.json(amountMismatchBody(), 400);
    }

    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: order.store_id,
        key: body.idempotency_key,
        scope: `payment.razorpay.order:${body.order_id}`,
        requestBody: body,
        requestId: getRequestId(c),
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as never, claim.statusCode as never);
    }

    try {
        const razorpayOrder = await createRazorpayOrder(
            { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
            {
                amount: amountMinorUnits,
                currency: order.currency || 'INR',
                receipt: body.order_id,
                notes: {
                    order_id: body.order_id,
                    idempotency_key: body.idempotency_key || '',
                },
            }
        );

        if (!razorpayOrder.id) {
            await idempotency.fail(claim.id);
            return c.json(
                { error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment order' } },
                502
            );
        }

        const paymentService = new PaymentExecutionAdapter(db);
        await paymentService.attachPaymentReference({
            orderId: body.order_id,
            provider: 'razorpay',
            providerOrderId: razorpayOrder.id,
            requestId: getRequestId(c),
            idempotencyKey: body.idempotency_key,
        });

        const responseBody = {
            data: {
                razorpay_order_id: razorpayOrder.id,
                amount: razorpayOrder.amount ?? amountMinorUnits,
                currency: razorpayOrder.currency || order.currency || 'INR',
                key_id: c.env.RAZORPAY_KEY_ID,
            },
        };

        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 200,
            resourceType: 'order',
            resourceId: body.order_id,
        });

        return c.json(responseBody);
    } catch (err) {
        await idempotency.fail(claim.id);
        throw err;
    }
});

// POST /payments/razorpay/verify — Verify payment signature
// CRITICAL FIX: Added ownership check + double-payment guard
router.post('/razorpay/verify', validate('json', RazorpayVerifySchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        order_id: string;
        idempotency_key: string;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        throw new ForbiddenError('User profile not found');
    }

    if (!c.env.RAZORPAY_KEY_SECRET) {
        return c.json(
            { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
            503
        );
    }

    // CRITICAL FIX #1: Fetch order and verify ownership
    const { data: order } = await db
        .from('orders')
        .select('id, store_id, total, payment_status, status, payment_id')
        .eq('id', body.order_id)
        .is('deleted_at', null)
        .single();

    if (!order) {
        throw new NotFoundError('Order not found');
    }

    if (!(await verifySiteOwnership(db, order.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized to verify this payment');
    }

    // CRITICAL FIX #2: Prevent double-payment
    if (order.payment_status === 'paid') {
        throw new ConflictError('Payment already verified for this order');
    }

    // Verify HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(c.env.RAZORPAY_KEY_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const payload = `${body.razorpay_order_id}|${body.razorpay_payment_id}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    if (!timingSafeEqualHex(expectedSig, body.razorpay_signature)) {
        return c.json(
            { error: { code: 'PAYMENT_ERROR', message: 'Invalid payment signature' } },
            400
        );
    }

    if (order.payment_id && order.payment_id !== body.razorpay_order_id) {
        throw new ConflictError('Payment reference mismatch');
    }

    const paymentService = new PaymentExecutionAdapter(db);
    const updated = await paymentService.confirmPayment({
        orderId: order.id,
        provider: 'razorpay',
        providerPaymentId: body.razorpay_payment_id,
        providerOrderId: body.razorpay_order_id,
        providerEventId: `razorpay:protected:${body.razorpay_payment_id}`,
        requestId: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
        idempotencyKey: body.idempotency_key,
    });

    return c.json({ data: { verified: true, order: updated } });
});

// POST /payments/stripe/checkout — Create a Stripe checkout session
router.post('/stripe/checkout', validate('json', StripeCheckoutSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as {
        order_id: string;
        success_url?: string;
        cancel_url?: string;
        idempotency_key: string;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        throw new ForbiddenError('User profile not found');
    }

    if (!c.env.STRIPE_SECRET_KEY) {
        return c.json(
            { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Stripe is not configured' } },
            503
        );
    }

    try {
        const order = await loadPayableOrder(c, body.order_id, customUser.id, auth.user.storeId);
        const unitAmount = Math.round(order.total * 100);

        const session = await createStripeCheckoutSessionWithFetch({
            secretKey: c.env.STRIPE_SECRET_KEY,
            orderId: body.order_id,
            amountMinorUnits: unitAmount,
            currency: order.currency || 'INR',
            successUrl: body.success_url || 'https://letbuyy.store/checkout/success?session_id={CHECKOUT_SESSION_ID}',
            cancelUrl: body.cancel_url || 'https://letbuyy.store/checkout/cancel',
            idempotencyKey: body.idempotency_key,
            name: `LetBuyy order ${body.order_id}`,
        });

        if (!session.id) {
            return c.json(
                {
                    error: {
                        code: 'PAYMENT_ERROR',
                        message: 'Failed to create Stripe checkout session',
                    },
                },
                500
            );
        }

        // Update order with Stripe session ID
        const paymentService = new PaymentExecutionAdapter(db);
        await paymentService.attachPaymentReference({
            orderId: body.order_id,
            provider: 'stripe',
            providerOrderId: String(session.id),
            requestId: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
            idempotencyKey: body.idempotency_key,
        });

        return c.json({
            data: {
                session_id: session.id,
                session_url: session.url,
            },
        });
    } catch (err) {
        return c.json(
            { error: { code: 'PAYMENT_ERROR', message: 'Stripe service unavailable' } },
            503
        );
    }
});

export default router;
