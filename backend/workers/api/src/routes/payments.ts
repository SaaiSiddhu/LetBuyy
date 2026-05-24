import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { hmacSha256Hex, timingSafeEqualHex } from '../lib/crypto';
import { dbErrorBody, errorBody, getSupabaseAdmin } from '../lib/supabase';
import { ForbiddenError, ConflictError, NotFoundError } from '../lib/errors';
import { validate } from '../middleware/validation';
import { PaymentService } from '../services/payment.service';
import {
    RazorpayOrderSchema,
    RazorpayVerifySchema,
    StripeCheckoutSchema,
} from '../schemas/order.schema';
import { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

const StoreSubscriptionQuerySchema = z.object({
    store_id: z.string().uuid(),
});

const PlanListQuerySchema = z.object({
    site_type: z.string().min(1),
    slug: z.string().min(1).optional(),
});

const CancelSubscriptionSchema = z.object({
    store_id: z.string().uuid(),
    reason: z.string().max(500).optional(),
});

const CreateSubscriptionOrderSchema = z.object({
    store_id: z.string().uuid(),
    plan_slug: z.string().min(1),
    billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
    site_type: z.string().min(1),
});

const VerifySubscriptionSchema = z.object({
    store_id: z.string().uuid(),
    plan_slug: z.string().min(1),
    billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
    site_type: z.string().min(1),
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
});

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

// GET /payments/plans — Fetch active subscription plans through the worker boundary
router.get('/plans', validate('query', PlanListQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as z.infer<typeof PlanListQuerySchema>;
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

    return c.json({ data: data || [] });
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
    const { store_id } = c.get('validatedQuery') as z.infer<typeof StoreSubscriptionQuerySchema>;
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
    const { store_id } = c.get('validatedQuery') as z.infer<typeof StoreSubscriptionQuerySchema>;
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
    const body = c.get('validatedBody') as z.infer<typeof CancelSubscriptionSchema>;
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
    const body = c.get('validatedBody') as z.infer<typeof CreateSubscriptionOrderSchema>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser || !(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        throw new ForbiddenError('Not authorized for this store');
    }

    const { data: plan } = await db
        .from('plans')
        .select('*')
        .eq('site_type', body.site_type)
        .eq('slug', body.plan_slug)
        .eq('is_active', true)
        .single();

    if (!plan) {
        throw new NotFoundError('Plan not found');
    }

    if (plan.requires_contact) {
        return c.json({ error: { code: 'PLAN_REQUIRES_SALES', message: 'This plan requires contacting sales' } }, 400);
    }

    const hasPromo = Number(plan.promo_price_inr || 0) > 0 && Number(plan.promo_months || 0) > 0;
    const amountPaise = body.billing_period === 'yearly'
        ? Number(plan.price_yearly_inr || 0) * 12
        : hasPromo
            ? Number(plan.promo_price_inr || 0)
            : Number(plan.price_monthly_inr || 0);

    const planPayload = {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        price_monthly_inr: plan.price_monthly_inr,
        price_yearly_inr: plan.price_yearly_inr,
        promo_price_inr: plan.promo_price_inr,
        promo_months: plan.promo_months,
    };

    if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
        return c.json(
            { error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
            503
        );
    }

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)}`,
        },
        body: JSON.stringify({
            amount: amountPaise,
            currency: 'INR',
            receipt: `sub_${body.store_id.slice(-8)}_${Date.now()}`,
            notes: {
                store_id: body.store_id,
                plan_slug: body.plan_slug,
                billing_period: body.billing_period,
                user_id: customUser.id,
            },
        }),
    });

    const order = (await orderRes.json()) as RazorpayOrderCreateResponse;
    if (!orderRes.ok || !order.id) {
        return c.json(
            errorBody('PAYMENT_PROVIDER_ERROR', 'Failed to create subscription payment order'),
            502
        );
    }

    return c.json({
        data: {
            razorpay_order_id: order.id,
            amount: order.amount ?? amountPaise,
            currency: order.currency || 'INR',
            key_id: c.env.RAZORPAY_KEY_ID,
            plan: planPayload,
            billing_period: body.billing_period,
            is_promo: hasPromo && body.billing_period === 'monthly',
        },
    });
});

// POST /payments/subscription/verify — Verify Razorpay and activate a merchant subscription
router.post('/subscription/verify', validate('json', VerifySubscriptionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as z.infer<typeof VerifySubscriptionSchema>;
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
        `${body.razorpay_order_id}|${body.razorpay_payment_id}`
    );

    if (!timingSafeEqualHex(expected, body.razorpay_signature)) {
        return c.json({ error: { code: 'PAYMENT_SIGNATURE_INVALID', message: 'Payment verification failed' } }, 400);
    }

    const { data: plan } = await db
        .from('plans')
        .select('*')
        .eq('site_type', body.site_type)
        .eq('slug', body.plan_slug)
        .eq('is_active', true)
        .single();

    if (!plan) {
        throw new NotFoundError('Plan not found');
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (body.billing_period === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    let promoEndsAt: string | null = null;
    if (Number(plan.promo_price_inr || 0) > 0 && Number(plan.promo_months || 0) > 0 && body.billing_period === 'monthly') {
        const promoEnd = new Date(now);
        promoEnd.setMonth(promoEnd.getMonth() + Number(plan.promo_months || 0));
        promoEndsAt = promoEnd.toISOString();
    }

    const amountPaid = body.billing_period === 'yearly'
        ? Number(plan.price_yearly_inr || 0) * 12
        : promoEndsAt
            ? Number(plan.promo_price_inr || 0)
            : Number(plan.price_monthly_inr || 0);

    await db
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: now.toISOString() })
        .eq('store_id', body.store_id)
        .eq('status', 'active');

    const { data: subscription, error: subError } = await db
        .from('subscriptions')
        .insert({
            user_id: customUser.id,
            store_id: body.store_id,
            plan: body.plan_slug,
            plan_id: plan.id,
            status: 'active',
            billing_period: body.billing_period,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            promo_ends_at: promoEndsAt,
            payment_gateway: 'razorpay',
            external_subscription_id: body.razorpay_order_id,
            razorpay_order_id: body.razorpay_order_id,
            razorpay_payment_id: body.razorpay_payment_id,
            amount_paid: amountPaid,
            currency: 'INR',
            products_limit: plan.products_limit,
            stores_limit: 1,
        })
        .select()
        .single();

    if (subError || !subscription) {
        return c.json(dbErrorBody('Failed to create subscription'), 500);
    }

    await db
        .from('sites')
        .update({ trial_status: 'paid', updated_at: now.toISOString() })
        .eq('id', body.store_id);

    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await db
        .from('billing_history')
        .insert({
            user_id: customUser.id,
            store_id: body.store_id,
            subscription_id: subscription.id,
            invoice_number: invoiceNumber,
            description: `${plan.name} plan - ${body.billing_period === 'yearly' ? 'Annual' : 'Monthly'}`,
            amount: amountPaid,
            currency: 'INR',
            tax_amount: Math.round(amountPaid * 0.18),
            total_amount: amountPaid + Math.round(amountPaid * 0.18),
            payment_gateway: 'razorpay',
            payment_id: body.razorpay_payment_id || null,
            payment_status: 'paid',
            period_start: now.toISOString(),
            period_end: periodEnd.toISOString(),
        });

    return c.json({
        data: {
            subscription: {
                id: subscription.id,
                plan: body.plan_slug,
                plan_name: plan.name,
                status: 'active',
                billing_period: body.billing_period,
                current_period_end: periodEnd.toISOString(),
                promo_ends_at: promoEndsAt,
            },
            message: `Successfully subscribed to ${plan.name} plan!`,
        },
    }, 201);
});

// POST /payments/razorpay/order — Create a Razorpay order
router.post('/razorpay/order', validate('json', RazorpayOrderSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as { order_id: string; idempotency_key: string };
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

    try {
        const order = await loadPayableOrder(c, body.order_id, customUser.id, auth.user.storeId);
        const amountMinorUnits = Math.round(order.total * 100);

        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)}`,
            },
            body: JSON.stringify({
                amount: amountMinorUnits,
                currency: order.currency || 'INR',
                receipt: body.order_id,
                notes: {
                    order_id: body.order_id,
                    idempotency_key: body.idempotency_key || '',
                },
            }),
        });

        const razorpayOrder = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
            return c.json(
                { error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment order' } },
                500
            );
        }

        const paymentService = new PaymentService(db);
        await paymentService.attachPaymentReference({
            orderId: body.order_id,
            provider: 'razorpay',
            providerOrderId: String(razorpayOrder.id),
            requestId: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
            idempotencyKey: body.idempotency_key,
        });

        return c.json({
            data: {
                razorpay_order_id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key_id: c.env.RAZORPAY_KEY_ID,
            },
        });
    } catch (err) {
        return c.json(
            { error: { code: 'PAYMENT_ERROR', message: 'Payment service unavailable' } },
            503
        );
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

    const paymentService = new PaymentService(db);
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

        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
                ...(body.idempotency_key ? { 'Idempotency-Key': body.idempotency_key } : {}),
            },
            body: new URLSearchParams({
                mode: 'payment',
                success_url:
                    body.success_url ||
                    'https://letbuyy.store/checkout/success?session_id={CHECKOUT_SESSION_ID}',
                cancel_url: body.cancel_url || 'https://letbuyy.store/checkout/cancel',
                'metadata[order_id]': body.order_id,
                'line_items[0][price_data][currency]': (order.currency || 'INR').toLowerCase(),
                'line_items[0][price_data][product_data][name]': `LetBuyy order ${body.order_id}`,
                'line_items[0][price_data][unit_amount]': String(unitAmount),
                'line_items[0][quantity]': '1',
            }),
        });

        const session = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
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
        const paymentService = new PaymentService(db);
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
