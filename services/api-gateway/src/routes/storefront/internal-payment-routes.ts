import type { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../../index';
import { getSupabaseAdmin, getSupabaseAdminUnguarded, success } from '../../lib/supabase';
import { PaymentExecutionAdapter } from '../../execution/payment-execution.adapter';
import { isInternalApiSecretRequest } from '../../lib/internal-secret';

type AppContext = Context<{ Bindings: Env }>;
type StorefrontRouter = Hono<{ Bindings: Env }>;
type GatewayDb = ReturnType<typeof getSupabaseAdmin>;

type StorefrontPaidOrderSnapshot = {
    id?: string;
    store_id?: string;
    site_id?: string;
    order_number?: string;
    customer_id?: string;
    total?: number | string;
    currency?: string | null;
};

// Phase M1 (DOC 03 row 11 "Payments"): Razorpay is the only live money-in
// gateway; these routes attach/confirm/fail/record an externally-confirmed
// provider event, which COD (no external gateway) never reaches.
type CapturedPaymentProvider = 'razorpay';

type InternalPaymentReferenceBody = {
    orderId?: string;
    storeId?: string;
    provider?: CapturedPaymentProvider;
    paymentReference?: string;
    idempotencyKey?: string | null;
};

type InternalPaymentConfirmBody = {
    orderId?: string;
    provider?: CapturedPaymentProvider;
    paymentId?: string;
    providerOrderId?: string | null;
    providerEventId?: string | null;
    idempotencyKey?: string | null;
};

type InternalPaymentFailureBody = {
    orderId?: string;
    provider?: CapturedPaymentProvider;
    providerEventId?: string;
    paymentStatus?: 'failed' | 'refunded';
    orderStatus?: 'cancelled' | 'refunded';
    reason?: string | null;
    releaseInventory?: boolean;
    idempotencyKey?: string | null;
};

type InternalPaymentEventBody = {
    orderId?: string;
    provider?: CapturedPaymentProvider;
    providerEventId?: string;
    eventType?: string;
    idempotencyKey?: string | null;
};

type InternalPaymentRouteDeps = {
    getRequestId(c: AppContext): string;
    emitStorefrontOrderPaidEvent(
        db: GatewayDb,
        input: {
            env?: Env;
            orderId: string;
            order: StorefrontPaidOrderSnapshot;
            fallbackOrder?: StorefrontPaidOrderSnapshot;
            requestId: string;
            idempotencyKey?: string | null;
        },
    ): Promise<void>;
};

function isInternalRequest(c: AppContext): boolean {
    return isInternalApiSecretRequest(c.env, c.req);
}

function assertProvider(value: unknown): value is CapturedPaymentProvider {
    return value === 'razorpay';
}

async function loadInternalPayableOrder(c: AppContext, orderId: string, storeId?: string) {
    const db = getSupabaseAdmin(c);

    if (storeId) {
        return new PaymentExecutionAdapter(db).loadStorefrontPayableOrder(orderId, storeId);
    }

    const { data: order } = await getSupabaseAdminUnguarded(c)
        .from('orders')
        .select('id, store_id, total, currency, customer_email, payment_id, payment_method, payment_status, status, inventory_reserved_at')
        .eq('id', orderId)
        .is('deleted_at', null)
        .single();

    if (!order) throw new Error('Order not found');
    if (order.payment_status === 'paid') throw new Error('Order is already paid');
    if (order.status === 'cancelled' || order.status === 'refunded') throw new Error('Order is not payable');

    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) throw new Error('Order has no payable total');

    return { ...order, total, currency: order.currency || 'INR' };
}

export function registerStorefrontInternalPaymentRoutes(router: StorefrontRouter, deps: InternalPaymentRouteDeps) {
    // GET /storefront/internal/orders/:orderId/payable - Internal server-to-worker payable order read
    router.get('/internal/orders/:orderId/payable', async (c) => {
        if (!isInternalRequest(c)) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
        }

        const orderId = c.req.param('orderId');
        const storeId = c.req.query('store_id') || undefined;
        if (!/^[0-9a-f-]{36}$/i.test(orderId) || (storeId && !/^[0-9a-f-]{36}$/i.test(storeId))) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid order or store id' } }, 400);
        }

        try {
            const order = await loadInternalPayableOrder(c, orderId, storeId);
            return c.json(success({ order }));
        } catch {
            return c.json({ success: false, error: { code: 'PAYMENT_ORDER_NOT_PAYABLE', message: 'Order is not payable' } }, 409);
        }
    });

    // POST /storefront/internal/payments/reference - Internal provider reference attach
    router.post('/internal/payments/reference', async (c) => {
        if (!isInternalRequest(c)) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
        }

        const body = await c.req.json() as InternalPaymentReferenceBody;
        if (!body.orderId || !assertProvider(body.provider) || !body.paymentReference) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider and paymentReference are required' } }, 400);
        }

        if (body.storeId) await loadInternalPayableOrder(c, body.orderId, body.storeId);

        const db = getSupabaseAdmin(c);
        await new PaymentExecutionAdapter(db).attachPaymentReference({
            orderId: body.orderId,
            provider: body.provider,
            providerOrderId: body.paymentReference,
            requestId: deps.getRequestId(c),
            idempotencyKey: body.idempotencyKey || null,
        });

        return c.json(success({ attached: true }));
    });

    // POST /storefront/internal/payments/confirm - Internal provider payment confirmation
    router.post('/internal/payments/confirm', async (c) => {
        if (!isInternalRequest(c)) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
        }

        const body = await c.req.json() as InternalPaymentConfirmBody;
        if (!body.orderId || !assertProvider(body.provider) || !body.paymentId) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider and paymentId are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const order = await new PaymentExecutionAdapter(db).confirmPayment({
            orderId: body.orderId,
            provider: body.provider,
            providerPaymentId: body.paymentId,
            providerOrderId: body.providerOrderId || null,
            providerEventId: body.providerEventId || `${body.provider}:storefront:${body.paymentId}`,
            requestId: deps.getRequestId(c),
            idempotencyKey: body.idempotencyKey || null,
        });
        await deps.emitStorefrontOrderPaidEvent(db, {
            orderId: body.orderId,
            order: order as StorefrontPaidOrderSnapshot,
            env: c.env,
            requestId: deps.getRequestId(c),
            idempotencyKey: body.idempotencyKey || body.providerEventId || body.paymentId,
        });

        return c.json(success({ order }));
    });

    // POST /storefront/internal/payments/failure - Internal provider payment failure/refund state
    router.post('/internal/payments/failure', async (c) => {
        if (!isInternalRequest(c)) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
        }

        const body = await c.req.json() as InternalPaymentFailureBody;
        if (!body.orderId || !assertProvider(body.provider) || !body.providerEventId || !body.paymentStatus || !body.orderStatus) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider, providerEventId, paymentStatus and orderStatus are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const order = await new PaymentExecutionAdapter(db).recordPaymentFailure({
            orderId: body.orderId,
            provider: body.provider,
            providerEventId: body.providerEventId,
            paymentStatus: body.paymentStatus,
            orderStatus: body.orderStatus,
            reason: body.reason || null,
            releaseInventory: Boolean(body.releaseInventory),
            requestId: deps.getRequestId(c),
            idempotencyKey: body.idempotencyKey || null,
        });

        return c.json(success({ order }));
    });

    // POST /storefront/internal/payments/event - Internal provider event marker
    router.post('/internal/payments/event', async (c) => {
        if (!isInternalRequest(c)) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
        }

        const body = await c.req.json() as InternalPaymentEventBody;
        if (!body.orderId || !assertProvider(body.provider) || !body.providerEventId || !body.eventType) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider, providerEventId and eventType are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const result = await new PaymentExecutionAdapter(db).recordPaymentEvent({
            orderId: body.orderId,
            provider: body.provider,
            providerEventId: body.providerEventId,
            eventType: body.eventType,
            requestId: deps.getRequestId(c),
            idempotencyKey: body.idempotencyKey || null,
        }, getSupabaseAdminUnguarded(c));

        return c.json(success(result));
    });
}
