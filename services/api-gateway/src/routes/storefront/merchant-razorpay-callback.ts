import { bodyLimit } from 'hono/body-limit';
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { fetchRazorpayPayment, hmacSha256Hex, timingSafeEqual,
    normalizeRazorpayRefundLifecycle } from '@letbuyy/infrastructure/razorpay-adapter';
import type { Env } from '../../index';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { isInternalApiSecretRequest } from '../../lib/internal-secret';
import { hydratePaymentCredential } from '../../lib/payment-credential-history';
import { readStoreRazorpayTestCredentials, readStoreRazorpayWebhookSecret } from '../../lib/store-payment-config';
import { IdempotencyExecutionAdapter } from '../../execution/idempotency-execution.adapter';
import { PaymentExecutionAdapter, readCaptureResult } from '../../execution/payment-execution.adapter';
import { AppError } from '../../lib/errors';
import { reconcileInternalRefundEvent } from './refund-reconciliation';

type AppContext = Context<{ Bindings: Env }>;
type GatewayDb = ReturnType<typeof getSupabaseAdmin>;
type PaidOrderSnapshot = { id?: string; store_id?: string; site_id?: string; order_number?: string;
    customer_id?: string; total?: number | string; currency?: string | null };
type Dependencies = {
    getRequestId(c: AppContext): string;
    emitStorefrontOrderPaidEvent(db: GatewayDb, input: { env?: Env; orderId: string; order: PaidOrderSnapshot;
        fallbackOrder?: PaidOrderSnapshot; requestId: string; idempotencyKey?: string | null }): Promise<void>;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ProviderEntity = z.object({
    id: z.string().regex(/^pay_[A-Za-z0-9_]{1,196}$/),
    order_id: z.string().regex(/^order_[A-Za-z0-9_]{1,194}$/),
    amount: z.number().int().positive().safe(),
    currency: z.literal('INR'),
    status: z.literal('captured'),
    captured: z.literal(true),
}).passthrough();
const CaptureEvent = z.object({
    event: z.literal('payment.captured'),
    payload: z.object({ payment: z.object({ entity: ProviderEntity }) }).passthrough(),
    id: z.string().max(200).optional(),
}).passthrough();
const FailureEvent = z.object({
    event: z.literal('payment.failed'),
    payload: z.object({ payment: z.object({ entity: z.object({
        id: z.string().regex(/^pay_[A-Za-z0-9_]{1,196}$/),
        order_id: z.string().regex(/^order_[A-Za-z0-9_]{1,194}$/),
        amount: z.number().int().positive().safe(),
        currency: z.literal('INR'),
        status: z.literal('failed'),
        captured: z.literal(false).optional(),
        error_reason: z.string().max(120).optional(),
    }).passthrough() }) }).passthrough(),
    id: z.string().max(200).optional(),
}).passthrough();
const RefundEvent = z.object({
    event: z.enum(['refund.created', 'refund.processed', 'refund.failed']),
    payload: z.object({ refund: z.object({ entity: z.object({
        id: z.string().regex(/^rfnd_[A-Za-z0-9_]{1,195}$/),
        payment_id: z.string().regex(/^pay_[A-Za-z0-9_]{1,196}$/),
        amount: z.number().int().positive().safe(),
        currency: z.literal('INR'),
        status: z.string().max(40),
    }).passthrough() }) }).passthrough(),
    id: z.string().max(200).optional(),
}).passthrough();

async function digest(value: string): Promise<string> {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** A payment or hosted checkout must carry exactly this saved credential. A
 * different or unbound account never borrows authority from a valid signature. */
async function assertExactOrderCredential(db: GatewayDb, siteId: string, orderId: string, credentialId: string): Promise<void> {
    const [paymentResult, sessionResult] = await Promise.all([
        db.from('payments').select('credential_id').eq('site_id', siteId).eq('order_id', orderId)
            .eq('provider', 'razorpay').is('deleted_at', null),
        db.from('checkout_sessions').select('payment_credential_id').eq('site_id', siteId)
            .eq('order_id', orderId).is('deleted_at', null),
    ]);
    if (paymentResult.error || sessionResult.error) throw new AppError('Payment account binding is unavailable.', 503, 'PAYMENT_ACCOUNT_UNAVAILABLE');
    const pinned = [
        ...(paymentResult.data || []).map(row => row.credential_id),
        ...(sessionResult.data || []).map(row => row.payment_credential_id).filter(Boolean),
    ];
    if (!pinned.length || pinned.some(id => id !== credentialId)) {
        throw new AppError('Provider event does not match this payment connection.', 409, 'PAYMENT_ACCOUNT_MISMATCH');
    }
}

export function registerMerchantRazorpayCallbackRoute(router: Hono<{ Bindings: Env }>, deps: Dependencies): void {
    // Public ingress is webhook-service; only that satellite can call this
    // internal Gateway path. The exact merchant secret is never returned.
    router.post('/internal/payments/merchant-razorpay/:siteId/:credentialId',
        bodyLimit({ maxSize: 256 * 1024 }), async (c) => {
            if (!isInternalApiSecretRequest(c.env, c.req)) return c.json({ error: { code: 'FORBIDDEN' } }, 403);
            const siteId = c.req.param('siteId'), credentialId = c.req.param('credentialId');
            if (!uuid.test(siteId) || !uuid.test(credentialId)) return c.json({ error: { code: 'INVALID_CALLBACK_SCOPE' } }, 400);
            const signature = c.req.header('x-razorpay-signature');
            if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return c.json({ error: { code: 'INVALID_SIGNATURE' } }, 400);
            const db = getSupabaseAdmin(c);
            const { data: site, error: siteError } = await db.from('sites').select('id,payment_settings')
                .eq('id', siteId).is('deleted_at', null).maybeSingle();
            if (siteError) throw new AppError('Payment connection is unavailable.', 503, 'PAYMENT_ACCOUNT_UNAVAILABLE');
            if (!site) return c.json({ error: { code: 'PAYMENT_ACCOUNT_NOT_FOUND' } }, 404);
            const hydrated = await hydratePaymentCredential(db, site, { credentialId });
            const webhookSecret = await readStoreRazorpayWebhookSecret(hydrated.payment_settings,
                c.env.PAYMENT_CONFIG_ENCRYPTION_KEY, siteId);
            const apiCredentials = await readStoreRazorpayTestCredentials(hydrated.payment_settings,
                c.env.PAYMENT_CONFIG_ENCRYPTION_KEY, siteId);
            if (!webhookSecret || !apiCredentials) return c.json({ error: { code: 'PAYMENT_ACCOUNT_UNAVAILABLE' } }, 503);
            const raw = await c.req.text();
            if (!timingSafeEqual(await hmacSha256Hex(webhookSecret, raw), signature)) {
                return c.json({ error: { code: 'INVALID_SIGNATURE' } }, 400);
            }
            let parsed: unknown;
            try { parsed = JSON.parse(raw); } catch { return c.json({ error: { code: 'INVALID_CALLBACK' } }, 400); }
            const refundEvent = RefundEvent.safeParse(parsed);
            if (refundEvent.success) {
                const refund = refundEvent.data.payload.refund.entity;
                const lifecycle = normalizeRazorpayRefundLifecycle(refundEvent.data.event, refund.status);
                if (!lifecycle) return c.json({ error: { code: 'REFUND_STATE_MISMATCH' } }, 409);
                const eventReference = refundEvent.data.id || c.req.header('x-razorpay-event-id') || await digest(raw);
                if (eventReference.length > 200) return c.json({ error: { code: 'INVALID_EVENT_ID' } }, 400);
                const receipt = new IdempotencyExecutionAdapter(db);
                const claim = await receipt.begin({ siteId,
                    key: `merchant-rzp-${await digest(eventReference)}`,
                    scope: `razorpay:merchant-webhook:${credentialId}`,
                    requestBody: { raw_digest: await digest(raw) }, requestId: deps.getRequestId(c),
                });
                if (claim.kind === 'replay') return c.json(claim.responseBody as { success: boolean });
                if (claim.id === 'dev-idempotency-id') throw new AppError('Webhook receipt is unavailable.', 503, 'PAYMENT_RECEIPT_UNAVAILABLE');
                try {
                    const response = await reconcileInternalRefundEvent(c, deps.getRequestId, {
                        provider: 'razorpay', providerPaymentId: refund.payment_id, providerRefundId: refund.id,
                        providerEventId: eventReference, eventType: lifecycle.eventType, status: lifecycle.status,
                        amountMinor: refund.amount, currency: refund.currency,
                    }, { siteId, credentialId });
                    if (response.status !== 200) { await receipt.fail(claim.id); return response; }
                    const reply = success({ received: true, event: lifecycle.eventType, provider_refund_id: refund.id });
                    await receipt.complete({ id: claim.id, responseBody: reply, statusCode: 200,
                        resourceType: 'site_payment_refund', resourceId: siteId });
                    return c.json(reply);
                } catch (error) { await receipt.fail(claim.id); throw error; }
            }
            const failedEvent = FailureEvent.safeParse(parsed);
            if (failedEvent.success) {
                const payment = failedEvent.data.payload.payment.entity;
                const { data: orders, error: orderError } = await db.from('orders')
                    .select('id,store_id,total,currency,payment_id,payment_status,status,inventory_reserved_at,inventory_released_at')
                    .eq('store_id', siteId).eq('payment_id', payment.order_id).is('deleted_at', null).limit(2);
                if (orderError) throw new AppError('Payment order is unavailable.', 503, 'PAYMENT_ORDER_UNAVAILABLE');
                if (orders?.length !== 1) return c.json({ error: { code: 'PAYMENT_ORDER_MISMATCH' } }, 409);
                const order = orders[0];
                const amountMinor = Math.round(Number(order.total) * 100);
                if (!Number.isSafeInteger(amountMinor) || amountMinor !== payment.amount
                    || (order.currency || 'INR').toUpperCase() !== 'INR') {
                    return c.json({ error: { code: 'PAYMENT_AMOUNT_MISMATCH' } }, 409);
                }
                await assertExactOrderCredential(db, siteId, order.id, credentialId);
                const providerPayment = await fetchRazorpayPayment(apiCredentials, payment.id).catch(() => null);
                if (!providerPayment || providerPayment.error) return c.json({ error: { code: 'PAYMENT_PROVIDER_UNAVAILABLE' } }, 503);
                if (providerPayment.id !== payment.id || providerPayment.order_id !== payment.order_id
                    || providerPayment.status !== 'failed' || providerPayment.captured === true
                    || providerPayment.amount !== amountMinor || providerPayment.currency?.toUpperCase() !== 'INR') {
                    return c.json({ error: { code: 'PAYMENT_PROVIDER_MISMATCH' } }, 409);
                }
                const eventReference = failedEvent.data.id || c.req.header('x-razorpay-event-id') || await digest(raw);
                if (eventReference.length > 200) return c.json({ error: { code: 'INVALID_EVENT_ID' } }, 400);
                const receipt = new IdempotencyExecutionAdapter(db);
                const claim = await receipt.begin({ siteId, key: `merchant-rzp-${await digest(eventReference)}`,
                    scope: `razorpay:merchant-webhook:${credentialId}`,
                    requestBody: { raw_digest: await digest(raw) }, requestId: deps.getRequestId(c) });
                if (claim.kind === 'replay') return c.json(claim.responseBody as { success: boolean });
                if (claim.id === 'dev-idempotency-id') throw new AppError('Webhook receipt is unavailable.', 503, 'PAYMENT_RECEIPT_UNAVAILABLE');
                try {
                    await new PaymentExecutionAdapter(db).recordPaymentFailure({ orderId: order.id, provider: 'razorpay',
                        providerEventId: eventReference, paymentStatus: 'failed', orderStatus: 'cancelled',
                        reason: payment.error_reason || 'provider_payment_failed',
                        releaseInventory: Boolean(order.inventory_reserved_at && !order.inventory_released_at),
                        requestId: deps.getRequestId(c), idempotencyKey: `merchant-rzp:${credentialId}:${eventReference}` });
                    const reply = success({ received: true, event: 'payment.failed' });
                    await receipt.complete({ id: claim.id, responseBody: reply, statusCode: 200,
                        resourceType: 'order', resourceId: order.id });
                    return c.json(reply);
                } catch (error) { await receipt.fail(claim.id); throw error; }
            }
            const event = CaptureEvent.safeParse(parsed);
            if (!event.success) return c.json({ error: { code: 'UNSUPPORTED_CALLBACK' } }, 422);
            const payment = event.data.payload.payment.entity;
            const { data: orders, error: orderError } = await db.from('orders')
                .select('id,store_id,total,currency,payment_id,payment_status,status,inventory_released_at')
                .eq('store_id', siteId).in('payment_id', [payment.order_id, payment.id])
                .is('deleted_at', null).limit(2);
            if (orderError) throw new AppError('Payment order is unavailable.', 503, 'PAYMENT_ORDER_UNAVAILABLE');
            if (orders?.length !== 1) return c.json({ error: { code: 'PAYMENT_ORDER_MISMATCH' } }, 409);
            const order = orders[0];
            const amountMinor = Math.round(Number(order.total) * 100);
            if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor !== payment.amount
                || (order.currency || 'INR').toUpperCase() !== 'INR') {
                return c.json({ error: { code: 'PAYMENT_AMOUNT_MISMATCH' } }, 409);
            }
            await assertExactOrderCredential(db, siteId, order.id, credentialId);
            const providerPayment = await fetchRazorpayPayment(apiCredentials, payment.id).catch(() => null);
            if (!providerPayment || providerPayment.error) return c.json({ error: { code: 'PAYMENT_PROVIDER_UNAVAILABLE' } }, 503);
            if (providerPayment.id !== payment.id || providerPayment.order_id !== payment.order_id
                || providerPayment.status !== 'captured' || providerPayment.captured !== true
                || providerPayment.amount !== amountMinor || providerPayment.currency?.toUpperCase() !== 'INR') {
                return c.json({ error: { code: 'PAYMENT_PROVIDER_MISMATCH' } }, 409);
            }
            const eventReference = event.data.id || c.req.header('x-razorpay-event-id') || await digest(raw);
            if (eventReference.length > 200) return c.json({ error: { code: 'INVALID_EVENT_ID' } }, 400);
            const idempotency = new IdempotencyExecutionAdapter(db);
            const claim = await idempotency.begin({ siteId,
                key: `merchant-rzp-${await digest(eventReference)}`,
                scope: `razorpay:merchant-webhook:${credentialId}`,
                requestBody: { raw_digest: await digest(raw) }, requestId: deps.getRequestId(c),
            });
            if (claim.kind === 'replay') return c.json(claim.responseBody as { received: boolean });
            if (claim.id === 'dev-idempotency-id') throw new AppError('Webhook receipt is unavailable.', 503, 'PAYMENT_RECEIPT_UNAVAILABLE');
            try {
                const confirmed = await new PaymentExecutionAdapter(db).confirmPayment({
                    orderId: order.id, provider: 'razorpay', providerPaymentId: payment.id,
                    providerOrderId: payment.order_id, providerEventId: eventReference,
                    requestId: deps.getRequestId(c), idempotencyKey: `merchant-rzp:${credentialId}:${eventReference}`,
                });
                const capture = readCaptureResult(confirmed);
                if (capture.fulfillable) await deps.emitStorefrontOrderPaidEvent(db, {
                    orderId: order.id, order: confirmed as PaidOrderSnapshot, fallbackOrder: order,
                    env: c.env, requestId: deps.getRequestId(c), idempotencyKey: `razorpay:${payment.id}`,
                });
                const reply = success({ received: true, event: 'payment.captured',
                    capture_outcome: capture.outcome });
                await idempotency.complete({ id: claim.id, responseBody: reply, statusCode: 200,
                    resourceType: 'order', resourceId: order.id });
                return c.json(reply);
            } catch (error) { await idempotency.fail(claim.id); throw error; }
        });
}
