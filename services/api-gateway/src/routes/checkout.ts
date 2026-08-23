import { Hono } from 'hono';
import type { Context } from 'hono';
import {
    CheckoutConfirmSchema,
    CheckoutContactSchema,
    CheckoutDeliverySchema,
    CheckoutPaymentIntentSchema,
    StoreBrandingSchema,
    assertBrandingIsDataOnly,
    canonicalCheckoutCartBinding,
    canonicalCheckoutHandoffPayload,
    normalizeCheckoutChannel,
    planCheckoutStateTransition,
    type CreateCheckoutOrderCommand,
    type CheckoutSessionState,
    type StoreBrandingInput,
} from '@letbuyy/checkout-core';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { OrderExecutionAdapter } from '../execution/order-execution.adapter';
import { PaymentExecutionAdapter } from '../execution/payment-execution.adapter';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { hmacSha256Hex, sha256Hex, timingSafeEqualHex } from '../lib/crypto';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { createPublicStorefrontTenantContext } from '../lib/tenant-context';
import { validate } from '../middleware/validation';

type AppContext = Context<{ Bindings: Env }>;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

type CartRow = {
    id: string;
    store_id: string;
    session_id?: string | null;
    items?: unknown;
    coupon_code?: string | null;
    buyer_email?: string | null;
    channel?: string | null;
    status?: string | null;
};

type CheckoutSessionRow = {
    id: string;
    site_id: string;
    cart_id?: string | null;
    cart_token?: string | null;
    channel?: string | null;
    checkout_state?: CheckoutSessionState | null;
    status?: string | null;
    customer_email?: string | null;
    buyer_name?: string | null;
    buyer_phone?: string | null;
    buyer_gstin?: string | null;
    shipping_address?: JsonRecord | null;
    shipping_method?: string | null;
    payment_method?: string | null;
    delivery_quote?: JsonRecord | null;
    payment_intent?: JsonRecord | null;
    inventory_reservation_ids?: string[] | null;
    discount_codes?: string[] | null;
    confirmed_at?: string | null;
    failed_at?: string | null;
    metadata?: JsonRecord | null;
};

export type VerifiedHandoff = {
    siteId: string;
    cartId: string;
    cartToken: string;
    channel: string;
    cart: CartRow;
};

type StepTarget = 'contact' | 'delivery' | 'payment_intent' | 'completed' | 'failed';
// Phase M1 (DOC 03 row 11 "Payments"): Razorpay + COD are the only live
// hosted-checkout money-in rails.
type HostedCheckoutPaymentProvider = 'razorpay' | 'cod';

const checkoutRouter = new Hono<{ Bindings: Env }>();
export const publicStoreBrandingRouter = new Hono<{ Bindings: Env }>();
export const storeBrandingManagementRouter = new Hono<{ Bindings: Env }>();

function getRequestId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function checkoutSigningSecret(c: AppContext): string | null {
    const configured = c.env.CHECKOUT_SIGNING_SECRET || c.env.STORE_ACCESS_SIGNING_KEY;
    if (configured && !configured.startsWith('SKIP_NEEDS_HUMAN_')) return configured;
    if (c.env.ENVIRONMENT === 'production' || c.env.APP_ENV === 'production') return null;
    return 'letbuyy-local-sandbox-checkout-handoff-secret';
}

function setupRequired(c: AppContext) {
    return c.json({
        success: false,
        error: {
            code: 'CHECKOUT_SETUP_REQUIRED',
            message: 'Checkout handoff is unavailable in this environment.',
        },
    }, 503);
}

function invalidHandoff(c: AppContext, message = 'Checkout handoff is invalid or expired.') {
    return c.json({
        success: false,
        error: {
            code: 'CHECKOUT_HANDOFF_INVALID',
            message,
        },
    }, 401);
}

function sessionPayload(row: CheckoutSessionRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        cart_id: row.cart_id,
        channel: row.channel || 'web',
        state: row.checkout_state || row.status || 'contact',
        customer_email: row.customer_email || null,
        buyer_name: row.buyer_name || null,
        buyer_phone: row.buyer_phone || null,
        shipping_address: row.shipping_address || {},
        delivery_quote: row.delivery_quote || {},
        payment_intent: row.payment_intent || {},
        confirmed_at: row.confirmed_at || null,
        failed_at: row.failed_at || null,
    };
}

function cartLines(cart: CartRow): JsonRecord[] {
    return Array.isArray(cart.items)
        ? cart.items.filter((line): line is JsonRecord => Boolean(line) && typeof line === 'object' && !Array.isArray(line))
        : [];
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeHostedCheckoutPaymentProvider(value: unknown): HostedCheckoutPaymentProvider | null {
    const provider = stringValue(value)?.toLowerCase();
    if (provider === 'razorpay' || provider === 'cod') {
        return provider;
    }
    return null;
}

function checkoutPaymentProvider(session: CheckoutSessionRow): HostedCheckoutPaymentProvider | null {
    const intent = session.payment_intent;
    return normalizeHostedCheckoutPaymentProvider(intent?.provider)
        || normalizeHostedCheckoutPaymentProvider(session.payment_method)
        || null;
}

function checkoutShippingMethod(session: CheckoutSessionRow): 'standard' | 'express' {
    const method = stringValue(session.shipping_method)
        || stringValue(session.delivery_quote?.shipping_method)
        || stringValue(session.delivery_quote?.method);
    return method === 'express' ? 'express' : 'standard';
}

function checkoutOrderItems(cart: CartRow): CreateCheckoutOrderCommand['items'] {
    return cartLines(cart).map((line) => ({
        product_id: stringValue(line.product_id) || stringValue(line.productId) || '',
        variant_id: stringValue(line.variant_id) || stringValue(line.variantId) || null,
        quantity: Number(line.quantity || 0),
    })).filter((line) => line.product_id && Number.isInteger(line.quantity) && line.quantity > 0);
}

export function buildHostedCheckoutOrderCommand(
    handoff: Pick<VerifiedHandoff, 'siteId' | 'cartId' | 'cart'>,
    session: CheckoutSessionRow,
    idempotencyKey: string,
): { ok: true; provider: HostedCheckoutPaymentProvider; command: CreateCheckoutOrderCommand } | { ok: false; code: string; message: string } {
    const provider = checkoutPaymentProvider(session);
    if (!provider) {
        return {
            ok: false,
            code: 'CHECKOUT_PAYMENT_METHOD_UNSUPPORTED',
            message: 'Checkout payment method is not supported for hosted confirmation.',
        };
    }

    const items = checkoutOrderItems(handoff.cart);
    if (items.length === 0) {
        return { ok: false, code: 'CHECKOUT_CART_EMPTY', message: 'Cart has no valid order items.' };
    }

    const email = stringValue(session.customer_email) || stringValue(handoff.cart.buyer_email);
    const name = stringValue(session.buyer_name) || email;
    if (!email || !name) {
        return { ok: false, code: 'CHECKOUT_CUSTOMER_REQUIRED', message: 'Checkout customer details are incomplete.' };
    }

    return {
        ok: true,
        provider,
        command: {
            customer_name: name,
            customer_email: email,
            customer_phone: stringValue(session.buyer_phone),
            customer_gstin: stringValue(session.buyer_gstin),
            shipping_address: session.shipping_address || {},
            items,
            payment_method: provider,
            shipping_method: checkoutShippingMethod(session),
            coupon_code: stringValue(handoff.cart.coupon_code),
            idempotency_key: `hosted-checkout:${handoff.cartId}:${idempotencyKey}`,
        },
    };
}

function paymentIntentId(session: CheckoutSessionRow): string | null {
    const intent = session.payment_intent;
    const id = intent && typeof intent.payment_intent_id === 'string' ? intent.payment_intent_id : null;
    return id && id.trim().length > 0 ? id : null;
}

async function verifyCheckoutHandoff(c: AppContext, cartId: string): Promise<
    | { ok: true; handoff: VerifiedHandoff }
    | { ok: false; response: Response }
> {
    const siteId = c.req.query('site_id');
    const cartToken = c.req.query('cart_token');
    const expiresAt = c.req.query('expires_at');
    const cartDigest = c.req.query('cart_digest');
    const signature = c.req.query('signature');
    const channel = normalizeCheckoutChannel(c.req.query('channel'));

    if (!siteId || !cartToken || !expiresAt || !cartDigest || !signature) {
        return { ok: false, response: invalidHandoff(c) };
    }

    const expiresTime = Date.parse(expiresAt);
    if (!Number.isFinite(expiresTime) || expiresTime <= Date.now()) {
        return { ok: false, response: invalidHandoff(c) };
    }

    const secret = checkoutSigningSecret(c);
    if (!secret) {
        // [HUMAN-REQUIRED] HR-DNS-CHECKOUT: production checkout origin/signing
        // secrets, DNS, and certificate cutover must be installed by a human.
        return { ok: false, response: setupRequired(c) };
    }

    const db = getSupabaseAdmin(c);
    const { data: cart, error } = await db
        .from('carts')
        .select('id, store_id, session_id, items, coupon_code, buyer_email, channel, status')
        .eq('id', cartId)
        .eq('store_id', siteId)
        .eq('session_id', cartToken)
        .is('deleted_at', null)
        .maybeSingle();

    if (error || !cart) {
        return { ok: false, response: invalidHandoff(c, 'Cart is unavailable for checkout.') };
    }

    const cartRow = cart as CartRow;
    const expectedCartDigest = await sha256Hex(canonicalCheckoutCartBinding({
        siteId,
        cartId,
        cartToken,
        channel,
        expiresAt,
        couponCodes: cartRow.coupon_code ? [cartRow.coupon_code] : [],
        lines: cartLines(cartRow),
    }));
    if (!timingSafeEqualHex(expectedCartDigest, cartDigest)) {
        return { ok: false, response: invalidHandoff(c) };
    }

    const expected = await hmacSha256Hex(secret, canonicalCheckoutHandoffPayload({
        siteId,
        cartId,
        cartToken,
        channel,
        expiresAt,
        cartContentDigest: expectedCartDigest,
        couponCodes: cartRow.coupon_code ? [cartRow.coupon_code] : [],
        lines: cartLines(cartRow),
    }));
    if (!timingSafeEqualHex(expected, signature)) {
        return { ok: false, response: invalidHandoff(c) };
    }

    return {
        ok: true,
        handoff: {
            siteId,
            cartId,
            cartToken,
            channel,
            cart: cartRow,
        },
    };
}

async function emitCheckoutEvent(
    c: AppContext,
    input: {
        siteId: string;
        cartId: string;
        checkoutId: string;
        eventType: 'checkout.started' | 'checkout.completed' | 'checkout.failed';
        idempotencyKey: string;
        payload?: JsonRecord;
    },
) {
    await new EventExecutionAdapter(getSupabaseAdmin(c)).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'checkout',
        aggregateId: input.checkoutId,
        eventType: input.eventType,
        payload: {
            site_id: input.siteId,
            cart_id: input.cartId,
            checkout_id: input.checkoutId,
            ...(input.payload || {}),
        },
        idempotencyKey: input.idempotencyKey,
        requestId: getRequestId(c),
    });
}

async function loadSession(db: ReturnType<typeof getSupabaseAdmin>, handoff: VerifiedHandoff): Promise<CheckoutSessionRow | null> {
    const { data } = await db
        .from('checkout_sessions')
        .select('*')
        .eq('site_id', handoff.siteId)
        .eq('cart_id', handoff.cartId)
        .is('deleted_at', null)
        .maybeSingle();

    return data as CheckoutSessionRow | null;
}

async function persistCheckoutStep(
    c: AppContext,
    handoff: VerifiedHandoff,
    target: StepTarget,
    patch: JsonRecord,
): Promise<CheckoutSessionRow | null> {
    const db = getSupabaseAdmin(c);
    const existing = await loadSession(db, handoff);
    const nextState: CheckoutSessionState = target === 'completed' || target === 'failed' ? target : target;
    const transition = planCheckoutStateTransition(existing?.checkout_state ?? null, nextState);
    if (!transition.allowed) return null;

    const row = {
        site_id: handoff.siteId,
        cart_id: handoff.cartId,
        cart_token: handoff.cartToken,
        channel: handoff.channel,
        status: nextState,
        checkout_state: nextState,
        idempotency_key: `checkout:${handoff.siteId}:${handoff.cartId}`,
        metadata: {
            source: 'hosted_checkout_v1',
            cart_status: handoff.cart.status || null,
        },
        ...patch,
    };

    const result = existing
        ? await db
            .from('checkout_sessions')
            .update(row)
            .eq('site_id', handoff.siteId)
            .eq('id', existing.id)
            .select('*')
            .single()
        : await db
            .from('checkout_sessions')
            .insert(row)
            .select('*')
            .single();

    return result.data ? result.data as CheckoutSessionRow : null;
}

async function revalidateConfirmInputs(
    c: AppContext,
    handoff: VerifiedHandoff,
    session: CheckoutSessionRow,
): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (cartLines(handoff.cart).length === 0) return { ok: false, reason: 'empty_cart' };

    const db = getSupabaseAdmin(c);
    const reservationIds = session.inventory_reservation_ids || [];
    if (reservationIds.length > 0) {
        const { data } = await db
            .from('inventory_reservations')
            .select('id')
            .eq('store_id', handoff.siteId)
            .in('id', reservationIds)
            .eq('status', 'active')
            .is('deleted_at', null);
        if ((data || []).length !== reservationIds.length) return { ok: false, reason: 'inventory_reservation_invalid' };
    }

    const discountCodes = new Set<string>();
    if (handoff.cart.coupon_code) discountCodes.add(handoff.cart.coupon_code.toUpperCase());
    for (const code of session.discount_codes || []) discountCodes.add(String(code).toUpperCase());
    if (discountCodes.size > 0) {
        const { data, error } = await db
            .from('coupons')
            .select('code')
            .eq('store_id', handoff.siteId)
            .in('code', [...discountCodes])
            .eq('is_active', true)
            .is('deleted_at', null);
        if (!error && (data || []).length < discountCodes.size) return { ok: false, reason: 'discount_invalid' };
    }

    return { ok: true };
}

async function recordCheckoutCompensation(
    c: AppContext,
    input: {
        siteId: string;
        checkoutId: string;
        paymentIntentId: string | null;
        idempotencyKey: string;
        reason: string;
    },
): Promise<void> {
    if (!input.paymentIntentId) return;
    const db = getSupabaseAdmin(c);
    await db
        .from('compensation_actions')
        .upsert({
            site_id: input.siteId,
            flow: 'checkout_confirm',
            aggregate_type: 'checkout',
            aggregate_id: input.checkoutId,
            idempotency_key: input.idempotencyKey,
            status: 'pending',
            action: 'refund_payment_intent',
            payload: {
                payment_intent_id: input.paymentIntentId,
                reason: input.reason,
            },
            request_id: getRequestId(c),
        }, { onConflict: 'site_id,flow,idempotency_key' });
}

async function runIdempotentStep(
    c: AppContext,
    handoff: VerifiedHandoff,
    scope: string,
    idempotencyKey: string,
    requestBody: JsonRecord,
    work: (claimId: string) => Promise<{ body: unknown; status: number; resourceId?: string }>,
) {
    const idempotency = new IdempotencyExecutionAdapter(getSupabaseAdmin(c));
    const claim = await idempotency.begin({
        siteId: handoff.siteId,
        key: idempotencyKey,
        scope,
        requestBody,
        requestId: getRequestId(c),
    });

    if (claim.kind === 'replay') return c.json(claim.responseBody as never, claim.statusCode as never);

    try {
        const result = await work(claim.id);
        await idempotency.complete({
            id: claim.id,
            responseBody: result.body as JsonValue,
            statusCode: result.status,
            resourceType: 'checkout',
            resourceId: result.resourceId,
        });
        return c.json(result.body, result.status as never);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
}

checkoutRouter.post('/:cartId/contact', validate('json', CheckoutContactSchema), async (c) => {
    const cartId = c.req.param('cartId');
    const verified = await verifyCheckoutHandoff(c, cartId);
    if (!verified.ok) return verified.response;
    const body = c.get('validatedBody') as JsonRecord & { idempotency_key: string; email: string; name: string; phone?: string | null; gstin?: string | null };

    return runIdempotentStep(c, verified.handoff, `checkout.contact:${cartId}`, body.idempotency_key, body, async () => {
        const session = await persistCheckoutStep(c, verified.handoff, 'contact', {
            customer_email: body.email,
            buyer_name: body.name,
            buyer_phone: body.phone || null,
            buyer_gstin: body.gstin || null,
        });
        if (!session) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout cannot move to contact.' } }, status: 409 };
        await emitCheckoutEvent(c, {
            siteId: verified.handoff.siteId,
            cartId,
            checkoutId: session.id,
            eventType: 'checkout.started',
            idempotencyKey: `checkout.started:${session.id}:${body.idempotency_key}`,
            payload: { channel: session.channel || 'web' },
        });
        return { body: success({ checkout: sessionPayload(session) }), status: 200, resourceId: session.id };
    });
});

checkoutRouter.post('/:cartId/delivery', validate('json', CheckoutDeliverySchema), async (c) => {
    const cartId = c.req.param('cartId');
    const verified = await verifyCheckoutHandoff(c, cartId);
    if (!verified.ok) return verified.response;
    const body = c.get('validatedBody') as JsonRecord & { idempotency_key: string; shipping_method: string; shipping_address: JsonRecord; cod_requested: boolean; shipping_quote: JsonRecord };

    return runIdempotentStep(c, verified.handoff, `checkout.delivery:${cartId}`, body.idempotency_key, body, async () => {
        // V1 LB-7: server-resolve shipping price; ignore any client-supplied price in shipping_quote.
        let serverResolvedQuote: JsonRecord = { cod_requested: body.cod_requested };
        const shippingRateId = typeof (body.shipping_quote as JsonRecord)?.shipping_rate_id === 'string'
            ? (body.shipping_quote as JsonRecord).shipping_rate_id as string
            : null;

        if (shippingRateId) {
            try {
                const { resolveShippingRate } = await import('../lib/shipping-rate-resolver');
                const db = getSupabaseAdmin(c);
                const resolved = await resolveShippingRate(db, verified.handoff.siteId, shippingRateId);
                if (resolved) {
                    serverResolvedQuote = {
                        shipping_rate_id: resolved.id,
                        amount: resolved.amount,
                        currency: 'INR',
                        cod_requested: body.cod_requested,
                        server_resolved: true,
                    };
                }
            } catch {
                // Fall through to method-based quote if resolution fails.
            }
        }

        if (!serverResolvedQuote.server_resolved) {
            // No rate ID or resolution failed: use method-derived quote (no client price trusted).
            const method = typeof body.shipping_method === 'string' ? body.shipping_method : 'standard';
            serverResolvedQuote = {
                shipping_method: method,
                amount: method === 'express' ? 99 : 0,
                currency: 'INR',
                cod_requested: body.cod_requested,
                server_resolved: true,
            };
        }

        const session = await persistCheckoutStep(c, verified.handoff, 'delivery', {
            shipping_method: body.shipping_method,
            shipping_address: body.shipping_address,
            delivery_quote: serverResolvedQuote,
        });
        if (!session) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout cannot move to delivery.' } }, status: 409 };
        return { body: success({ checkout: sessionPayload(session) }), status: 200, resourceId: session.id };
    });
});

checkoutRouter.post('/:cartId/payment-intent', validate('json', CheckoutPaymentIntentSchema), async (c) => {
    const cartId = c.req.param('cartId');
    const verified = await verifyCheckoutHandoff(c, cartId);
    if (!verified.ok) return verified.response;
    const body = c.get('validatedBody') as JsonRecord & { idempotency_key: string; provider: string; mode: string; tokenize: boolean; metadata: JsonRecord };

    if (body.mode === 'live') {
        // [HUMAN-REQUIRED] HR-MERCHANT-PSP-LIVE: live merchant PSP keys must be
        // connected before hosted checkout creates live payment intents.
        return c.json({ success: false, error: { code: 'PAYMENT_SETUP_REQUIRED', message: 'Payment provider setup is required.' } }, 503);
    }

    return runIdempotentStep(c, verified.handoff, `checkout.payment_intent:${cartId}`, body.idempotency_key, body, async () => {
        const intent = {
            payment_intent_id: `${body.provider}_${body.mode}_${crypto.randomUUID()}`,
            provider: body.provider,
            mode: body.mode,
            status: body.provider === 'cod' ? 'authorized' : 'pending',
            tokenize: body.tokenize,
            metadata: body.metadata,
            created_at: new Date().toISOString(),
        };
        const session = await persistCheckoutStep(c, verified.handoff, 'payment_intent', {
            payment_method: body.provider,
            payment_intent: intent,
        });
        if (!session) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout cannot move to payment intent.' } }, status: 409 };
        return { body: success({ checkout: sessionPayload(session), payment_intent: intent }), status: 201, resourceId: session.id };
    });
});

checkoutRouter.post('/:cartId/confirm', validate('json', CheckoutConfirmSchema), async (c) => {
    const cartId = c.req.param('cartId');
    const verified = await verifyCheckoutHandoff(c, cartId);
    if (!verified.ok) return verified.response;
    const body = c.get('validatedBody') as JsonRecord & { idempotency_key: string; simulate_order_failure?: boolean; payment_intent_id?: string };

    return runIdempotentStep(c, verified.handoff, `checkout.confirm:${cartId}`, body.idempotency_key, body, async () => {
        const existing = await loadSession(getSupabaseAdmin(c), verified.handoff);
        if (!existing) return { body: { success: false, error: { code: 'CHECKOUT_NOT_STARTED', message: 'Checkout has not started.' } }, status: 409 };

        const revalidation = await revalidateConfirmInputs(c, verified.handoff, existing);
        const forcedFailure = body.simulate_order_failure === true;
        const orderPlan = buildHostedCheckoutOrderCommand(verified.handoff, existing, body.idempotency_key);
        if (!orderPlan.ok) {
            return {
                body: {
                    success: false,
                    error: { code: orderPlan.code, message: orderPlan.message },
                },
                status: 400,
                resourceId: existing.id,
            };
        }

        const requestedPaymentIntentId = stringValue(body.payment_intent_id);
        const expectedPaymentIntentId = paymentIntentId(existing);
        if (requestedPaymentIntentId && expectedPaymentIntentId && requestedPaymentIntentId !== expectedPaymentIntentId) {
            return {
                body: {
                    success: false,
                    error: {
                        code: 'CHECKOUT_PAYMENT_INTENT_MISMATCH',
                        message: 'Payment intent does not match this checkout session.',
                    },
                },
                status: 409,
                resourceId: existing.id,
            };
        }

        if (orderPlan.provider !== 'cod' && !stringValue(body.provider_payment_id)) {
            return {
                body: {
                    success: false,
                    error: {
                        code: 'CHECKOUT_PROVIDER_PAYMENT_REQUIRED',
                        message: 'Provider payment proof is required before checkout confirmation.',
                    },
                },
                status: 400,
                resourceId: existing.id,
            };
        }

        if (!revalidation.ok || forcedFailure) {
            const reason = forcedFailure
                ? 'order_create_failed'
                : revalidation.ok ? 'unknown_confirm_failure' : revalidation.reason;
            const failedSession = await persistCheckoutStep(c, verified.handoff, 'failed', {
                failed_at: new Date().toISOString(),
                metadata: { ...(existing.metadata || {}), failure_reason: reason },
            }) || existing;
            await recordCheckoutCompensation(c, {
                siteId: verified.handoff.siteId,
                checkoutId: failedSession.id,
                paymentIntentId: requestedPaymentIntentId || expectedPaymentIntentId,
                idempotencyKey: `checkout.confirm.compensate:${failedSession.id}:${body.idempotency_key}`,
                reason,
            });
            await emitCheckoutEvent(c, {
                siteId: verified.handoff.siteId,
                cartId,
                checkoutId: failedSession.id,
                eventType: 'checkout.failed',
                idempotencyKey: `checkout.failed:${failedSession.id}:${body.idempotency_key}`,
                payload: { reason },
            });
            return { body: { success: false, error: { code: 'CHECKOUT_CONFIRM_FAILED', message: 'Checkout could not be confirmed.' } }, status: 409, resourceId: failedSession.id };
        }

        const db = getSupabaseAdmin(c);
        const tenant = await createPublicStorefrontTenantContext(c, verified.handoff.siteId);
        const order = await new OrderExecutionAdapter(db).createOrder(orderPlan.command, tenant) as JsonRecord;
        const orderId = stringValue(order.id);
        if (!orderId) {
            throw new Error('Hosted checkout order creation returned no order id');
        }

        let paidOrder: unknown = order;
        let capturePostedToLedger = false;
        if (orderPlan.provider !== 'cod') {
            const providerPaymentId = stringValue(body.provider_payment_id)!;
            const captureIdempotencyKey = `checkout.confirm.capture:${orderId}:${body.idempotency_key}`;
            paidOrder = await new PaymentExecutionAdapter(db).confirmPayment({
                orderId,
                provider: orderPlan.provider,
                providerPaymentId,
                providerOrderId: requestedPaymentIntentId || expectedPaymentIntentId,
                providerEventId: `hosted_checkout:${orderPlan.provider}:${providerPaymentId}`,
                requestId: getRequestId(c),
                idempotencyKey: captureIdempotencyKey,
            });

            const { data: captureLedgerRow, error: captureLedgerError } = await db
                .from('ledger_transactions')
                .select('id')
                .eq('site_id', verified.handoff.siteId)
                .eq('source_type', 'payment_capture')
                .eq('source_id', `${orderPlan.provider}:${providerPaymentId}`)
                .eq('idempotency_key', captureIdempotencyKey)
                .is('deleted_at', null)
                .maybeSingle();
            if (captureLedgerError) {
                throw new Error(`Hosted checkout capture ledger proof failed: ${captureLedgerError.message}`);
            }
            capturePostedToLedger = Boolean(captureLedgerRow);
        }

        const session = await persistCheckoutStep(c, verified.handoff, 'completed', {
            order_id: orderId,
            payment_method: orderPlan.provider,
            confirmed_at: new Date().toISOString(),
            metadata: {
                ...(existing.metadata || {}),
                order_id: orderId,
                payment_provider: orderPlan.provider,
                capture_posted_to_ledger: capturePostedToLedger,
            },
        });
        if (!session) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout cannot be confirmed.' } }, status: 409 };

        await db
            .from('carts')
            .update({ status: 'converted' })
            .eq('store_id', verified.handoff.siteId)
            .eq('id', cartId);
        await emitCheckoutEvent(c, {
            siteId: verified.handoff.siteId,
            cartId,
            checkoutId: session.id,
            eventType: 'checkout.completed',
            idempotencyKey: `checkout.completed:${session.id}:${body.idempotency_key}`,
            payload: { channel: session.channel || 'web', order_id: orderId },
        });

        return { body: success({ checkout: sessionPayload(session), order: paidOrder }), status: 200, resourceId: session.id };
    });
});

checkoutRouter.get('/:id', async (c) => {
    const checkoutId = c.req.param('id');
    const siteId = c.req.query('site_id');
    const cartToken = c.req.query('cart_token');
    if (!siteId) return c.json({ success: false, error: { code: 'VALIDATION', message: 'site_id required' } }, 400);

    const db = getSupabaseAdmin(c);
    let query = db
        .from('checkout_sessions')
        .select('*')
        .eq('site_id', siteId)
        .eq('id', checkoutId)
        .is('deleted_at', null);
    if (cartToken) query = query.eq('cart_token', cartToken);
    const { data } = await query.maybeSingle();
    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Checkout session not found' } }, 404);
    return c.json(success({ checkout: sessionPayload(data as CheckoutSessionRow) }));
});

function defaultBranding(siteId: string) {
    return {
        site_id: siteId,
        logo_url: null,
        favicon_url: null,
        primary_color: '#111827',
        accent_color: '#2563EB',
        checkout_theme: 'system',
        tokens: {},
    };
}

publicStoreBrandingRouter.get('/:storeId/branding', async (c) => {
    const storeId = c.req.param('storeId');
    const db = getSupabaseAdmin(c);
    const { data } = await db
        .from('store_branding')
        .select('site_id, logo_url, favicon_url, primary_color, accent_color, checkout_theme, tokens')
        .eq('site_id', storeId)
        .is('deleted_at', null)
        .maybeSingle();

    return c.json(success({ branding: data || defaultBranding(storeId) }));
});

storeBrandingManagementRouter.put('/:storeId/branding', validate('json', StoreBrandingSchema), async (c) => {
    const storeId = c.req.param('storeId');
    const body = assertBrandingIsDataOnly(c.get('validatedBody') as StoreBrandingInput);
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser || !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('store_branding')
        .upsert({
            site_id: storeId,
            ...body,
            updated_by: customUser.id,
            created_by: customUser.id,
        }, { onConflict: 'site_id' })
        .select('site_id, logo_url, favicon_url, primary_color, accent_color, checkout_theme, tokens')
        .single();

    if (error || !data) return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } }, 500);
    return c.json(success({ branding: data }));
});

export default checkoutRouter;
