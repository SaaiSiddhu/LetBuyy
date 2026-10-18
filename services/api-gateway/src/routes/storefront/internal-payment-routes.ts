import type { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../../index';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { PaymentExecutionAdapter, readCaptureResult } from '../../execution/payment-execution.adapter';
import { isInternalApiSecretRequest } from '../../lib/internal-secret';
import { emitPaymentEvent } from '../../lib/payment-route-support';

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

// These four routes take their body as `await c.req.json() as <Type>` — a cast, not a parse — so the
// union members in those declarations are what TypeScript believes downstream and NOT what arrives.
// A presence check (`!body.paymentStatus`) admits any non-empty string. The ledger RPC does not
// trust either value (it writes `CASE WHEN p_payment_status = 'refunded' THEN 'refunded' ELSE
// 'failed' END`, and never uses p_order_status to transition anything), so a bad value has never
// produced a wrong charge — it is silently COERCED. On a money path that hides a caller's bug
// instead of surfacing it, which is what these two guards change.
const FAILURE_PAYMENT_STATUSES = ['failed', 'refunded'] as const;
const FAILURE_ORDER_STATUSES = ['cancelled', 'refunded'] as const;

function assertPaymentFailureStatus(value: unknown): value is (typeof FAILURE_PAYMENT_STATUSES)[number] {
    return FAILURE_PAYMENT_STATUSES.includes(value as (typeof FAILURE_PAYMENT_STATUSES)[number]);
}

function assertFailureOrderStatus(value: unknown): value is (typeof FAILURE_ORDER_STATUSES)[number] {
    return FAILURE_ORDER_STATUSES.includes(value as (typeof FAILURE_ORDER_STATUSES)[number]);
}

async function loadInternalPayableOrder(c: AppContext, orderId: string, storeId?: string) {
    const db = getSupabaseAdmin(c);

    if (storeId) {
        return new PaymentExecutionAdapter(db).loadStorefrontPayableOrder(orderId, storeId);
    }

    const { data: order } = await db
        .from('orders')
        .select('id, store_id, total, currency, customer_email, payment_id, payment_method, payment_status, status, inventory_reserved_at, inventory_released_at')
        .eq('id', orderId)
        .is('deleted_at', null)
        .single();

    if (!order) throw new Error('Order not found');
    if (order.payment_status === 'paid') throw new Error('Order is already paid');
    if (order.status === 'cancelled' || order.status === 'refunded') throw new Error('Order is not payable');
    // F-PAY4-1: the same refusal loadStorefrontPayableOrder applies — no new payment against stock the
    // unpaid sweep has already released.
    if (order.inventory_released_at) throw new Error('Order reservation has expired');

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

        // F-PAY4-1: a capture the order can no longer honour (reservation released by the unpaid sweep,
        // or order cancelled) was recorded once by migration 252, with the order cancelled and the refund
        // owed. Acknowledge it — webhook-service then marks the event processed rather than failed — but
        // never announce it as paid.
        const capture = readCaptureResult(order);
        if (!capture.fulfillable) {
            return c.json(success({
                order,
                capture_outcome: capture.outcome,
                fulfillable: false,
                unfulfillable_reason: capture.reason,
            }));
        }

        // Keyed on the provider payment, so this webhook and the buyer's verify callback announcing the
        // same payment produce one order.paid event, not two.
        await deps.emitStorefrontOrderPaidEvent(db, {
            orderId: body.orderId,
            order: order as StorefrontPaidOrderSnapshot,
            env: c.env,
            requestId: deps.getRequestId(c),
            idempotencyKey: `${body.provider}:${body.paymentId}`,
        });

        return c.json(success({ order }));
    });

    // POST /storefront/internal/payments/failure - Internal provider payment failure/refund state
    router.post('/internal/payments/failure', async (c) => {
        if (!isInternalRequest(c)) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
        }

        const body = await c.req.json() as InternalPaymentFailureBody;
        if (!body.orderId || !assertProvider(body.provider) || !body.providerEventId
            || !assertPaymentFailureStatus(body.paymentStatus) || !assertFailureOrderStatus(body.orderStatus)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `orderId, provider, providerEventId, paymentStatus (${FAILURE_PAYMENT_STATUSES.join(' | ')}) and orderStatus (${FAILURE_ORDER_STATUSES.join(' | ')}) are required` } }, 400);
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
        });

        return c.json(success(result));
    });

    // POST /storefront/internal/payments/refund-event - verified provider refund lifecycle event
    router.post('/internal/payments/refund-event', async (c) => {
        if (!isInternalRequest(c)) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
        }

        const body = await c.req.json() as Record<string, unknown>;
        const eventTypes = ['refund.created', 'refund.processed', 'refund.failed'];
        const statuses = ['created', 'processed', 'failed'];
        const paymentId = typeof body.providerPaymentId === 'string' ? body.providerPaymentId.trim() : '';
        const refundId = typeof body.providerRefundId === 'string' ? body.providerRefundId.trim() : '';
        const eventId = typeof body.providerEventId === 'string' ? body.providerEventId.trim() : '';
        const eventType = typeof body.eventType === 'string' ? body.eventType : '';
        const status = typeof body.status === 'string' ? body.status : '';
        const amountMinor = body.amountMinor;
        const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : '';
        if (body.provider !== 'razorpay' || !paymentId || paymentId.length > 200 || !refundId || refundId.length > 200
            || !eventId || eventId.length > 300 || !eventTypes.includes(eventType) || !statuses.includes(status)
            || !Number.isSafeInteger(amountMinor) || Number(amountMinor) <= 0 || currency !== 'INR'
            || (eventType === 'refund.created' && status !== 'created')
            || (eventType === 'refund.processed' && status !== 'processed')
            || (eventType === 'refund.failed' && status !== 'failed')) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Valid provider payment/refund/event references, lifecycle state and positive INR amount are required' } }, 400);
        }

        const db = getSupabaseAdmin(c);
        const { data: payment, error: paymentError } = await db.rpc('resolve_payment_for_refund_provider_event', {
            p_provider: 'razorpay',
            p_provider_payment_id: paymentId,
        });
        if (paymentError) throw new Error(`Failed to resolve provider payment: ${paymentError.message}`);
        if (!payment) return c.json(success({ matched: false }));

        const paymentRow = payment as { id: string; site_id: string; order_id: string; provider: string; provider_payment_id: string; mode: string };
        const { data: exactAttempt, error: attemptError } = await db
            .from('payment_attempts')
            .select('id')
            .eq('site_id', paymentRow.site_id)
            .eq('payment_id', paymentRow.id)
            .eq('provider', paymentRow.provider)
            .eq('attempt_type', 'refund')
            .contains('metadata', { provider_refund_id: refundId })
            .is('deleted_at', null)
            .maybeSingle();
        if (attemptError) throw new Error(`Failed to resolve provider refund attempt: ${attemptError.message}`);
        let attempt = exactAttempt;
        if (!attempt) {
            const { data: pendingAttempts, error: pendingError } = await db
                .from('payment_attempts')
                .select('id, amount, currency, metadata')
                .eq('site_id', paymentRow.site_id)
                .eq('payment_id', paymentRow.id)
                .eq('provider', paymentRow.provider)
                .eq('attempt_type', 'refund')
                .eq('status', 'pending')
                .is('deleted_at', null);
            if (pendingError) throw new Error(`Failed to resolve pending provider refund attempt: ${pendingError.message}`);
            const candidates = (pendingAttempts || []).filter((row) => {
                const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
                return !metadata.provider_refund_id
                    && row.currency === currency
                    && Math.round(Number(row.amount) * 100) === amountMinor;
            });
            if (candidates.length !== 1) {
                return c.json({
                    success: false,
                    error: {
                        code: 'REFUND_ATTEMPT_UNRESOLVED',
                        message: 'Provider refund could not be matched to one reserved payment attempt; retry reconciliation.',
                        ambiguous: candidates.length > 1,
                    },
                }, 409);
            }
            attempt = candidates[0];
        }

        const { data: result, error } = await db.rpc('reconcile_payment_refund_attempt', {
            p_payment_id: paymentRow.id,
            p_attempt_id: (attempt as { id: string }).id,
            p_provider_refund_id: refundId,
            p_provider_event_id: eventId,
            p_event_type: eventType,
            p_status: status,
            p_amount_minor: amountMinor,
            p_currency: currency,
            p_request_id: deps.getRequestId(c),
        });
        if (error) throw new Error(`Provider refund reconciliation failed: ${error.message}`);

        const resultRecord = result && typeof result === 'object' && !Array.isArray(result)
            ? result as Record<string, unknown>
            : {};
        if (resultRecord.outcome === 'processed') {
            await emitPaymentEvent(db, {
                siteId: paymentRow.site_id,
                paymentId: paymentRow.id,
                orderId: paymentRow.order_id,
                eventType: 'payment.refunded',
                payload: {
                    provider: 'razorpay',
                    provider_event_id: eventId,
                    // The event contract carries the order's existing payment_status
                    // union: a partial refund leaves the order paid until fully reversed.
                    payment_status: resultRecord.fully_refunded === true ? 'refunded' : 'paid',
                    mode: paymentRow.mode,
                    amount_minor: amountMinor,
                    cumulative_refund_amount_minor: resultRecord.refunded_amount_minor,
                    currency,
                    ledger_transaction_id: resultRecord.ledger_transaction_id,
                    provider_refund_id: refundId,
                },
                requestId: deps.getRequestId(c),
                idempotencyKey: `payment.refund:${paymentRow.id}:${refundId}`,
            });
        }

        return c.json(success({ matched: true, result }));
    });
}
