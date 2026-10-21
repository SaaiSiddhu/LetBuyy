import { loadCheckoutStorePresentation } from '../lib/checkout-store-presentation';
import { authorizeHostedStorefrontPurchase } from '../lib/storefront-visitor-access';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
    CheckoutConfirmSchema,
    CheckoutStateReadSchema,
    CheckoutContactSchema,
    CheckoutDeliverySchema,
    CheckoutPaymentIntentSchema,
    StoreBrandingSchema,
    assertBrandingIsDataOnly,
    canonicalCheckoutCartBinding,
    canonicalCheckoutHandoffPayload,
    gstStateCodeFromName,
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
import { PaymentExecutionAdapter, readCaptureResult } from '../execution/payment-execution.adapter';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { hmacSha256Hex, sha256Hex, timingSafeEqualHex } from '../lib/crypto';
import { verifyRazorpayPayment } from '../lib/provider-payment-verification';
import { assertProviderPaymentNotReplayed, emitOrderPaidEvent, paymentProviderMode } from '../lib/payment-route-support';
import { createRazorpayPaymentProvider, fetchRazorpayOrdersByReceipt, fetchRazorpayPayment } from '@letbuyy/infrastructure/razorpay-adapter';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { createPublicStorefrontTenantContext } from '../lib/tenant-context';
import { validate } from '../middleware/validation';
import { AppError, ConflictError } from '../lib/errors';
import { checkoutDeliveryOptions } from '../lib/checkout-delivery-options';
import { listStorefrontShippingRates } from '../lib/storefront-shipping';

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
    sales_origin?: 'storefront' | 'marketplace' | null;
    status?: string | null;
    checkout_handoff?: { storefront_admission?: unknown } | null;
};

type CheckoutSessionRow = {
    id: string;
    site_id: string;
    cart_id?: string | null;
    cart_token?: string | null;
    channel?: string | null;
    sales_origin?: 'storefront' | 'marketplace' | null;
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
    buyer_account_id?: string | null;
    buyer_session_epoch?: number | null;
};

export type VerifiedHandoff = {
    siteId: string;
    cartId: string;
    cartToken: string;
    channel: string;
    cart: CartRow;
    signature?: string;
};

type StepTarget = 'contact' | 'delivery' | 'payment_intent' | 'completed' | 'failed';
// Phase M1 (DOC 03 row 11 "Payments"): Razorpay + COD are the only live
// hosted-checkout money-in rails.
type HostedCheckoutPaymentProvider = 'razorpay' | 'cod';

const checkoutRouter = new Hono<{ Bindings: Env }>();
checkoutRouter.use('*',async(c,next)=>{c.header('Cache-Control','no-store');await next();});
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
        sales_origin: row.sales_origin || 'storefront',
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

function signedCartSubtotalMinor(lines: JsonRecord[]): number | null {
    if (lines.length === 0) return null;
    let subtotalMinor = 0;
    for (const line of lines) {
        const quantity = typeof line.quantity === 'number' ? line.quantity : Number(line.quantity);
        const lineTotal = typeof line.line_total === 'number' ? line.line_total : Number(line.line_total);
        const unitPrice = typeof line.unit_price === 'number' ? line.unit_price : Number(line.unit_price);
        const amount = Number.isFinite(lineTotal) ? lineTotal : quantity * unitPrice;
        if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isFinite(amount) || amount < 0) return null;
        subtotalMinor += Math.round(amount * 100);
        if (!Number.isSafeInteger(subtotalMinor)) return null;
    }
    return subtotalMinor;
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
        ...(stringValue(line.marketplace_listing_id) ? { marketplace_listing_id: stringValue(line.marketplace_listing_id) } : {}),
        quantity: Number(line.quantity || 0),
    })).filter((line) => line.product_id && Number.isInteger(line.quantity) && line.quantity > 0);
}

export function buildHostedCheckoutOrderCommand(
    handoff: Pick<VerifiedHandoff, 'siteId' | 'cartId' | 'cart'>,
    session: CheckoutSessionRow,
    idempotencyKey: string,
): { ok: true; provider: HostedCheckoutPaymentProvider; command: CreateCheckoutOrderCommand & { shipping_rate_id?: string | null; expected_shipping_amount?: number | null; buyer_account_id?: string; buyer_session_epoch?: number } } | { ok: false; code: string; message: string } {
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
    if (handoff.cart.sales_origin === 'marketplace' && items.some((item) => !item.marketplace_listing_id)) {
        return { ok: false, code: 'MARKETPLACE_LISTING_REQUIRED', message: 'Every marketplace checkout item must remain bound to its approved listing.' };
    }

    const email = stringValue(session.customer_email) || stringValue(handoff.cart.buyer_email);
    const name = stringValue(session.buyer_name) || email;
    if (!email || !name) {
        return { ok: false, code: 'CHECKOUT_CUSTOMER_REQUIRED', message: 'Checkout customer details are incomplete.' };
    }
    if ((session.buyer_account_id && !Number.isInteger(session.buyer_session_epoch))
        || (!session.buyer_account_id && session.buyer_session_epoch !== null && session.buyer_session_epoch !== undefined)) {
        return { ok: false, code: 'CHECKOUT_BUYER_BINDING_INVALID', message: 'Checkout identity could not be verified.' };
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
            shipping_rate_id: stringValue(session.delivery_quote?.shipping_rate_id) || null,
            expected_shipping_amount: typeof session.delivery_quote?.amount === 'number' ? session.delivery_quote.amount : null,
            sales_origin: handoff.cart.sales_origin === 'marketplace' ? 'marketplace' : 'storefront',
            coupon_code: stringValue(handoff.cart.coupon_code),
            idempotency_key: `hosted-checkout:${handoff.cartId}:${idempotencyKey}`,
            ...(session.buyer_account_id ? {
                buyer_account_id: session.buyer_account_id,
                buyer_session_epoch: session.buyer_session_epoch!,
            } : {}),
        },
    };
}

function paymentIntentId(session: CheckoutSessionRow): string | null {
    const intent = session.payment_intent;
    const id = intent && typeof intent.payment_intent_id === 'string' ? intent.payment_intent_id : null;
    return id && id.trim().length > 0 ? id : null;
}

async function verifyCheckoutHandoff(c: AppContext, cartId: string, purchase = true): Promise<
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
        .select('id, store_id, session_id, items, coupon_code, buyer_email, channel, sales_origin, status, checkout_handoff')
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
        salesOrigin: cartRow.sales_origin === 'marketplace' ? 'marketplace' : 'storefront',
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
        salesOrigin: cartRow.sales_origin === 'marketplace' ? 'marketplace' : 'storefront',
        expiresAt,
        cartContentDigest: expectedCartDigest,
        couponCodes: cartRow.coupon_code ? [cartRow.coupon_code] : [],
        lines: cartLines(cartRow),
    }));
    if (!timingSafeEqualHex(expected, signature)) {
        return { ok: false, response: invalidHandoff(c) };
    }

    const handoff: VerifiedHandoff = { siteId, cartId, cartToken, channel, cart: cartRow, signature };
    if (purchase) await authorizeHostedPurchase(c, handoff);
    return {
        ok: true,
        handoff: {
            signature,
            siteId,
            cartId,
            cartToken,
            channel,
            cart: cartRow,
        },
    };
}

async function authorizeHostedPurchase(c: AppContext, handoff: VerifiedHandoff): Promise<void> {
    if (handoff.cart.sales_origin !== 'marketplace') {
        await authorizeHostedStorefrontPurchase(c, handoff.siteId, handoff.cart.checkout_handoff?.storefront_admission, handoff.signature || '');
    }
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
    const { data, error } = await db
        .from('checkout_sessions')
        .select('*')
        .eq('site_id', handoff.siteId)
        .eq('cart_id', handoff.cartId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new AppError('Checkout is temporarily unavailable', 503, 'CHECKOUT_UNAVAILABLE');
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
        sales_origin: handoff.cart.sales_origin === 'marketplace' ? 'marketplace' : 'storefront',
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

async function runIdempotentStep(
    c: AppContext,
    handoff: VerifiedHandoff,
    scope: string,
    idempotencyKey: string,
    requestBody: JsonRecord,
    work: (claimId: string) => Promise<{ body: unknown; status: number; resourceId?: string; retryable?: boolean }>,
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
        if (result.retryable) {
            await idempotency.fail(claim.id);
            return c.json(result.body, result.status as never);
        }
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

// T6/W2 — checkout.letbuyy.com resolves its tenant from the signed handoff, never the Host
// header. This is a thin, read-only, PUBLIC wrapper around the exact same verifyCheckoutHandoff
// used by every hosted-checkout state-machine route above — no separate verification logic, no
// weakened check. It creates nothing; a caller that only wants to know "is this handoff valid"
// (the checkout-origin page, before rendering anything) never needs to touch the state machine.
checkoutRouter.get('/:cartId/verify-handoff', async (c) => {
    const cartId = c.req.param('cartId');
    const verified = await verifyCheckoutHandoff(c, cartId);
    if (!verified.ok) return verified.response;

    const lines = cartLines(verified.handoff.cart);
    const presentation = await loadCheckoutStorePresentation(c, verified.handoff.siteId);

    return c.json(success({
        site_id: verified.handoff.siteId,
        cart_id: verified.handoff.cartId,
        cart_token: verified.handoff.cartToken,
        channel: verified.handoff.channel,
        coupon_code: typeof verified.handoff.cart.coupon_code === 'string' ? verified.handoff.cart.coupon_code : null,
        subdomain: presentation.subdomain,
        presentation,
        lines,
    }));
});

checkoutRouter.get('/:cartId/delivery-options', async (c) => {
    const cartId = c.req.param('cartId');
    const verified = await verifyCheckoutHandoff(c, cartId);
    if (!verified.ok) return verified.response;

    const country = stringValue(c.req.query('country')) || '';
    const state = stringValue(c.req.query('state')) || '';
    const stateCode = stringValue(c.req.query('state_code')) || undefined;
    const pincode = stringValue(c.req.query('pincode')) || '';
    if (!country || !state || !/^[1-9][0-9]{5}$/.test(pincode)) {
        return c.json({ success: false, error: { code: 'CHECKOUT_ADDRESS_INVALID', message: 'Enter a valid Indian delivery address to check delivery.' } }, 400);
    }

    try {
        const db = getSupabaseAdmin(c);
        const lines = cartLines(verified.handoff.cart);
        const address = { country, state, stateCode, pincode };
        let resolvedRates: Array<{ id: string; name: string; type: string; amount: number; currency: string; estimated_days_min: number | null; estimated_days_max: number | null; cod_available: boolean }>;
        if (verified.handoff.cart.sales_origin === 'marketplace') {
            resolvedRates = (await checkoutDeliveryOptions(db, verified.handoff.siteId, lines, address))
                .map((rate) => ({ ...rate, cod_available: true }));
        } else {
            const subtotalMinor = signedCartSubtotalMinor(lines);
            if (subtotalMinor === null) {
                return c.json({ success: false, error: { code: 'CHECKOUT_SUBTOTAL_UNAVAILABLE', message: 'Cart pricing could not be verified. Refresh the cart and try again.' } }, 409);
            }
            resolvedRates = (await listStorefrontShippingRates(db, verified.handoff.siteId, address, subtotalMinor))
                .map((rate) => ({
                    id: rate.id,
                    name: rate.name,
                    type: rate.type,
                    amount: rate.amount_minor / 100,
                    currency: rate.currency,
                    estimated_days_min: rate.estimated_days_min,
                    estimated_days_max: rate.estimated_days_max,
                    cod_available: rate.cod_available,
                }));
        }
        return c.json(success({
            serviceable: resolvedRates.length > 0,
            source: 'seller_shipping_zone',
            carrier_confirmed: false,
            rates: resolvedRates,
        }));
    } catch {
        return c.json({ success: false, error: { code: 'CHECKOUT_SHIPPING_UNAVAILABLE', message: 'Delivery options are temporarily unavailable. Please retry.' } }, 503);
    }
});

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

        if (verified.handoff.cart.sales_origin === 'marketplace') {
            if (!shippingRateId) {
                return { body: { success: false, error: { code: 'CHECKOUT_SHIPPING_RATE_REQUIRED', message: 'Choose an available delivery option to continue.' } }, status: 409 };
            }
            const addressCountry = stringValue(body.shipping_address.country) || '';
            const addressState = stringValue(body.shipping_address.state) || '';
            const addressStateCode = stringValue(body.shipping_address.state_code) || undefined;
            const addressPincode = stringValue(body.shipping_address.zip) || stringValue(body.shipping_address.pincode) || '';
            let selectedRate;
            try {
                const rates = await checkoutDeliveryOptions(
                    getSupabaseAdmin(c),
                    verified.handoff.siteId,
                    cartLines(verified.handoff.cart),
                    { country: addressCountry, state: addressState, stateCode: addressStateCode, pincode: addressPincode },
                );
                selectedRate = rates.find((rate) => rate.id === shippingRateId);
            } catch {
                return { body: { success: false, error: { code: 'CHECKOUT_SHIPPING_UNAVAILABLE', message: 'Delivery options could not be verified. Please retry.' } }, status: 503, retryable: true };
            }
            if (!selectedRate) {
                return { body: { success: false, error: { code: 'CHECKOUT_SHIPPING_UNAVAILABLE', message: 'That delivery option is no longer available for this address. Choose another option.' } }, status: 409 };
            }
            const reviewedAmount = (body.shipping_quote as JsonRecord).expected_shipping_amount;
            if (typeof reviewedAmount !== 'number' || !Number.isFinite(reviewedAmount) || reviewedAmount < 0
                || Math.round(reviewedAmount * 100) !== Math.round(selectedRate.amount * 100)) {
                return { body: { success: false, error: { code: 'CHECKOUT_SHIPPING_CHANGED', message: 'The delivery price changed. Review the updated delivery option and try again.' } }, status: 409 };
            }
            serverResolvedQuote = {
                shipping_rate_id: selectedRate.id,
                shipping_rate_name: selectedRate.name,
                shipping_method: body.shipping_method,
                amount: selectedRate.amount,
                currency: selectedRate.currency,
                cod_requested: body.cod_requested,
                server_resolved: true,
                quote_source: 'seller_shipping_zone',
            };
        } else {
            if (!shippingRateId) {
                return { body: { success: false, error: { code: 'CHECKOUT_SHIPPING_RATE_REQUIRED', message: 'Choose an available delivery option to continue.' } }, status: 409 };
            }
            const addressCountry = stringValue(body.shipping_address.country) || '';
            const addressState = stringValue(body.shipping_address.state) || '';
            const addressStateCode = stringValue(body.shipping_address.state_code) || undefined;
            const addressPincode = stringValue(body.shipping_address.zip) || stringValue(body.shipping_address.pincode) || '';
            const subtotalMinor = signedCartSubtotalMinor(cartLines(verified.handoff.cart));
            if (subtotalMinor === null) {
                return { body: { success: false, error: { code: 'CHECKOUT_SUBTOTAL_UNAVAILABLE', message: 'Cart pricing could not be verified. Refresh the cart and try again.' } }, status: 409 };
            }
            let selectedRate;
            try {
                const rates = await listStorefrontShippingRates(
                    getSupabaseAdmin(c),
                    verified.handoff.siteId,
                    { country: addressCountry, state: addressState, stateCode: addressStateCode, pincode: addressPincode },
                    subtotalMinor,
                );
                selectedRate = rates.find((rate) => rate.id === shippingRateId);
            } catch {
                return { body: { success: false, error: { code: 'CHECKOUT_SHIPPING_UNAVAILABLE', message: 'Delivery options could not be verified. Please retry.' } }, status: 503, retryable: true };
            }
            if (!selectedRate) {
                return { body: { success: false, error: { code: 'CHECKOUT_SHIPPING_UNAVAILABLE', message: 'That delivery option is no longer available for this address. Choose another option.' } }, status: 409 };
            }
            if (body.cod_requested && !selectedRate.cod_available) {
                return { body: { success: false, error: { code: 'CHECKOUT_COD_UNAVAILABLE', message: 'Cash on delivery is not available for the selected delivery option.' } }, status: 409 };
            }
            const reviewedAmount = (body.shipping_quote as JsonRecord).expected_shipping_amount;
            if (typeof reviewedAmount !== 'number' || !Number.isFinite(reviewedAmount) || reviewedAmount < 0
                || Math.round(reviewedAmount * 100) !== selectedRate.amount_minor) {
                return { body: { success: false, error: { code: 'CHECKOUT_SHIPPING_CHANGED', message: 'The delivery price changed. Review the updated delivery option and try again.' } }, status: 409 };
            }
            serverResolvedQuote = {
                shipping_rate_id: selectedRate.id,
                shipping_rate_name: selectedRate.name,
                shipping_method: body.shipping_method,
                amount: selectedRate.amount_minor / 100,
                currency: 'INR',
                cod_requested: body.cod_requested,
                server_resolved: true,
                quote_source: 'seller_zone_configuration',
            };
        }

        const shippingAddress = { ...body.shipping_address };
        if (!stringValue(shippingAddress.state_code)) {
            const stateCode = gstStateCodeFromName(stringValue(shippingAddress.state));
            if (stateCode) shippingAddress.state_code = stateCode;
        }

        const session = await persistCheckoutStep(c, verified.handoff, 'delivery', {
            shipping_method: body.shipping_method,
            shipping_address: shippingAddress,
            delivery_quote: serverResolvedQuote,
        });
        if (!session) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout cannot move to delivery.' } }, status: 409 };
        return { body: success({ checkout: sessionPayload(session) }), status: 200, resourceId: session.id };
    });
});

checkoutRouter.post('/:cartId/payment-intent', validate('json', CheckoutPaymentIntentSchema), async (c) => {
    const cartId = c.req.param('cartId');
    const verified = await verifyCheckoutHandoff(c, cartId, false);
    if (!verified.ok) return verified.response;
    const body = c.get('validatedBody') as JsonRecord & { idempotency_key: string; provider: string; mode: string; tokenize: boolean; metadata: JsonRecord };

    if (body.provider !== 'razorpay' && body.provider !== 'cod') {
        return c.json({ success: false, error: { code: 'CHECKOUT_PAYMENT_METHOD_UNSUPPORTED', message: 'Checkout payment method is not supported.' } }, 400);
    }

    const priorSetup = await loadSession(getSupabaseAdmin(c), verified.handoff);
    const recoveringProviderAttempt = body.provider === 'razorpay'
        && priorSetup?.payment_intent?.provider === 'razorpay'
        && typeof priorSetup.payment_intent.order_id === 'string';
    if (!recoveringProviderAttempt) await authorizeHostedPurchase(c, verified.handoff);

    // D08 is still unresolved: marketplace provider eligibility, contracting entity and
    // seller/funds-flow terms have not been accepted. Keep this check ahead of the idempotent
    // payment-intent step because the Razorpay branch creates a pending order before it calls the
    // provider. Marketplace COD remains available through the canonical order transaction.
    if (body.provider === 'razorpay' && verified.handoff.cart.sales_origin === 'marketplace') {
        return c.json({
            success: false,
            error: {
                code: 'MARKETPLACE_PAYMENT_PROVIDER_UNAVAILABLE',
                message: 'Online payment is not available for marketplace checkout yet.',
            },
        }, 503);
    }

    let mode: 'sandbox' | 'live';
    try {
        mode = paymentProviderMode(c, body.provider as 'razorpay' | 'cod', body.mode as 'sandbox' | 'live');
    } catch {
        return c.json({ success: false, error: { code: 'PAYMENT_SETUP_REQUIRED', message: 'Payment provider setup is required.' } }, 503);
    }

    if (mode !== 'sandbox') {
        // [HUMAN-REQUIRED] HR-MERCHANT-PSP-LIVE: live merchant PSP keys must be
        // connected before hosted checkout creates live payment intents.
        return c.json({ success: false, error: { code: 'PAYMENT_SETUP_REQUIRED', message: 'Payment provider setup is required.' } }, 503);
    }

    if (body.provider === 'razorpay') {
        if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
            return c.json({ success: false, error: { code: 'PAYMENT_SETUP_REQUIRED', message: 'Payment provider setup is required.' } }, 503);
        }
        if (body.tokenize) {
            return c.json({ success: false, error: { code: 'CHECKOUT_TOKENIZATION_UNAVAILABLE', message: 'Payment tokenization is not available for this checkout.' } }, 400);
        }
    }

    return runIdempotentStep(c, verified.handoff, `checkout.payment_intent:${cartId}`, body.idempotency_key, body, async () => {
        if (body.provider === 'razorpay') {
            const db = getSupabaseAdmin(c);
            const existing = await loadSession(db, verified.handoff);
            if (!existing || !existing.customer_email || !existing.shipping_address || Object.keys(existing.shipping_address).length === 0) {
                return { body: { success: false, error: { code: 'CHECKOUT_DETAILS_REQUIRED', message: 'Complete checkout contact and delivery details first.' } }, status: 409 };
            }
            const priorIntent = existing.payment_intent || {};
            const priorProvider = stringValue(priorIntent.provider);
            if (priorProvider && priorProvider !== 'razorpay') {
                return { body: { success: false, error: { code: 'CHECKOUT_PAYMENT_METHOD_LOCKED', message: 'This checkout already selected another payment method.' } }, status: 409 };
            }
            if (stringValue(priorIntent.provider_order_id) && stringValue(priorIntent.order_id)
                && typeof priorIntent.amount_minor === 'number' && Number.isSafeInteger(priorIntent.amount_minor)
                && priorIntent.amount_minor > 0 && priorIntent.currency === 'INR') {
                // Recover the local binding if the provider order was persisted to the checkout
                // session but the canonical order reference write failed on the prior request.
                await new PaymentExecutionAdapter(db).attachPaymentReference({
                    orderId: stringValue(priorIntent.order_id)!,
                    provider: 'razorpay',
                    providerOrderId: stringValue(priorIntent.provider_order_id)!,
                    requestId: getRequestId(c),
                    idempotencyKey: `hosted-checkout-provider-order:${cartId}`,
                });
                return {
                    body: success({
                        checkout: { ...sessionPayload(existing), state: 'payment_intent' },
                        payment_intent: {
                            payment_intent_id: stringValue(priorIntent.payment_intent_id),
                            provider: 'razorpay',
                            status: 'requires_action',
                            mode: 'sandbox',
                            key_id: c.env.RAZORPAY_KEY_ID,
                            provider_order_id: stringValue(priorIntent.provider_order_id),
                            amount_minor: priorIntent.amount_minor,
                            currency: priorIntent.currency,
                        },
                    }),
                    status: 200,
                    resourceId: existing.id,
                };
            }
            if (priorProvider === 'razorpay') {
                const orderId = stringValue(priorIntent.order_id);
                const expectedAmountMinor = priorIntent.amount_minor;
                const recoverableAttempt = priorIntent.status === 'creating_provider_order'
                    && orderId !== undefined
                    && priorIntent.receipt === cartId
                    && typeof expectedAmountMinor === 'number'
                    && Number.isSafeInteger(expectedAmountMinor)
                    && expectedAmountMinor > 0
                    && priorIntent.currency === 'INR';

                if (recoverableAttempt) {
                    // The provider may have created the order before its response was lost. Its
                    // unique receipt is the cart UUID; search only that receipt, then bind only a
                    // single still-created order whose server metadata and amount match this exact
                    // checkout. Zero, duplicate, stale or mismatched results remain fail-closed.
                    const paymentAdapter = new PaymentExecutionAdapter(getSupabaseAdmin(c));
                    let expectedOrderAmountMinor: number | null = null;
                    try {
                        const payable = await paymentAdapter.loadStorefrontPayableOrder(orderId, verified.handoff.siteId);
                        const total = Number(payable.total);
                        const amountMinor = Math.round(total * 100);
                        if ((payable.currency || 'INR').toUpperCase() === 'INR'
                            && Number.isSafeInteger(amountMinor)
                            && Math.abs(total * 100 - amountMinor) <= 0.000001) {
                            expectedOrderAmountMinor = amountMinor;
                        }
                    } catch {
                        expectedOrderAmountMinor = null;
                    }

                    let providerOrders;
                    try {
                        providerOrders = c.env.ENVIRONMENT === 'test' && c.env.HOSTED_RAZORPAY_TEST_ADAPTER
                            ? await c.env.HOSTED_RAZORPAY_TEST_ADAPTER.fetchOrdersByReceipt(cartId)
                            : await fetchRazorpayOrdersByReceipt(
                                { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
                                cartId,
                            );
                    } catch {
                        providerOrders = { error: { description: 'provider_order_lookup_failed' } };
                    }

                    const orders = Array.isArray(providerOrders.items) ? providerOrders.items : [];
                    const recovered = !providerOrders.error
                        && orders.length === 1
                        && (providerOrders.count === undefined || providerOrders.count === 1)
                        ? orders[0]
                        : null;
                    const notes = recovered?.notes && typeof recovered.notes === 'object' ? recovered.notes : {};
                    const providerOrderId = stringValue(recovered?.id);
                    const matchesThisCheckout = Boolean(recovered
                        && providerOrderId?.startsWith('order_')
                        && recovered.entity === 'order'
                        && recovered.receipt === cartId
                        && recovered.status === 'created'
                        && recovered.amount === expectedAmountMinor
                        && recovered.currency?.toUpperCase() === 'INR'
                        && expectedOrderAmountMinor === expectedAmountMinor
                        && notes.order_id === orderId
                        && notes.store_id === verified.handoff.siteId
                        && notes.source === 'hosted_checkout'
                        && notes.checkout_id === existing.id
                        && notes.site_id === verified.handoff.siteId
                        && notes.idempotency_key === `hosted-checkout-provider-order:${cartId}`);

                    if (matchesThisCheckout && providerOrderId) {
                        const paymentIntent = { ...priorIntent, status: 'requires_action', provider_order_id: providerOrderId };
                        const recoveredSession = await persistCheckoutStep(c, verified.handoff, 'payment_intent', {
                            payment_method: 'razorpay',
                            payment_intent: paymentIntent,
                        });
                        if (!recoveredSession) {
                            return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout cannot move to payment.' } }, status: 409, resourceId: existing.id };
                        }
                        await paymentAdapter.attachPaymentReference({
                            orderId,
                            provider: 'razorpay',
                            providerOrderId,
                            requestId: getRequestId(c),
                            idempotencyKey: `hosted-checkout-provider-order:${cartId}`,
                        });
                        return {
                            body: success({
                                checkout: { ...sessionPayload(recoveredSession), state: 'payment_intent' },
                                payment_intent: {
                                    payment_intent_id: stringValue(priorIntent.payment_intent_id),
                                    provider: 'razorpay',
                                    status: 'requires_action',
                                    mode: 'sandbox',
                                    key_id: c.env.RAZORPAY_KEY_ID,
                                    provider_order_id: providerOrderId,
                                    amount_minor: expectedAmountMinor,
                                    currency: 'INR',
                                },
                            }),
                            status: 200,
                            resourceId: recoveredSession.id,
                        };
                    }
                }

                // No unique exact match exists. Never issue a second order: leave the durable
                // creating state for provider/support reconciliation and preserve checkout data.
                return {
                    body: { success: false, error: { code: 'CHECKOUT_PROVIDER_ORDER_RECONCILIATION_REQUIRED', message: 'Online payment setup needs support review before it can be retried.' } },
                    status: 503,
                    resourceId: existing.id,
                };
            }

            // Recovery of an old provider attempt never authorizes a new
            // provider order if the stored state changed while we were reading.
            await authorizeHostedPurchase(c, verified.handoff);
            const revalidation = await revalidateConfirmInputs(c, verified.handoff, existing);
            if (!revalidation.ok) {
                return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout details are no longer valid. Refresh checkout and try again.' } }, status: 409 };
            }

            const tenant = await createPublicStorefrontTenantContext(c, verified.handoff.siteId);
            const plan = buildHostedCheckoutOrderCommand(
                verified.handoff,
                { ...existing, payment_method: 'razorpay' },
                `payment-order:${cartId}`,
            );
            if (!plan.ok) return { body: { success: false, error: { code: plan.code, message: plan.message } }, status: 400 };

            // The pending order is created once before provider order creation. Its stable cart key
            // prevents a retry from making a second order or buyer link; the external create attempt
            // is persisted below so an ambiguous provider response cannot trigger another create.
            const order = await new OrderExecutionAdapter(db).createOrder({
                ...plan.command,
                idempotency_key: `hosted-checkout:${cartId}:payment-order`,
            }, tenant) as JsonRecord;
            const orderId = stringValue(order.id);
            if (!orderId) throw new Error('Hosted checkout payment order has no order id');

            const paymentAdapter = new PaymentExecutionAdapter(db);
            const payable = await paymentAdapter.loadStorefrontPayableOrder(orderId, verified.handoff.siteId);
            const total = Number(payable.total);
            const amountMinor = Math.round(total * 100);
            if ((payable.currency || 'INR').toUpperCase() !== 'INR' || !Number.isSafeInteger(amountMinor)
                || amountMinor <= 0 || Math.abs(total * 100 - amountMinor) > 0.000001) {
                return { body: { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only exact INR checkout amounts are supported.' } }, status: 400, resourceId: orderId };
            }

            const paymentIntentId = crypto.randomUUID();
            const creatingIntent = {
                payment_intent_id: paymentIntentId,
                provider: 'razorpay',
                mode: 'sandbox',
                status: 'creating_provider_order',
                tokenize: false,
                order_id: orderId,
                amount_minor: amountMinor,
                currency: 'INR',
                receipt: cartId,
                created_at: new Date().toISOString(),
            };
            const creatingSession = await persistCheckoutStep(c, verified.handoff, 'payment_intent', {
                payment_method: 'razorpay',
                payment_intent: creatingIntent,
            });
            if (!creatingSession) {
                return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout cannot move to payment.' } }, status: 409, resourceId: existing.id };
            }

            const provider = c.env.ENVIRONMENT === 'test' && c.env.HOSTED_RAZORPAY_TEST_ADAPTER
                || createRazorpayPaymentProvider({ keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET });
            let intent: Awaited<ReturnType<typeof provider.createIntent>>;
            try {
                intent = await provider.createIntent({
                    storeId: verified.handoff.siteId,
                    orderId,
                    amount: { amountMinor, currency: 'INR' },
                    idempotencyKey: `hosted-checkout-provider-order:${cartId}`,
                    receipt: cartId,
                    customer: { id: existing.buyer_account_id || undefined, email: existing.customer_email, name: existing.buyer_name || undefined, phone: existing.buyer_phone || undefined },
                    metadata: { source: 'hosted_checkout', checkout_id: existing.id, site_id: verified.handoff.siteId },
                });
            } catch {
                return { body: { success: false, error: { code: 'CHECKOUT_PROVIDER_ORDER_RECONCILIATION_REQUIRED', message: 'Online payment setup needs support review before it can be retried.' } }, status: 503, resourceId: orderId };
            }
            const providerOrderId = stringValue(intent.references.providerOrderId);
            if (!providerOrderId || intent.amount.amountMinor !== amountMinor || intent.amount.currency !== 'INR') {
                return { body: { success: false, error: { code: 'CHECKOUT_PROVIDER_ORDER_RECONCILIATION_REQUIRED', message: 'Online payment setup needs support review before it can be retried.' } }, status: 503, resourceId: orderId };
            }

            const paymentIntent = {
                ...creatingIntent,
                status: 'requires_action',
                provider_order_id: providerOrderId,
            };
            const session = await persistCheckoutStep(c, verified.handoff, 'payment_intent', {
                payment_method: 'razorpay',
                payment_intent: paymentIntent,
            });
            if (!session) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout cannot move to payment.' } }, status: 409, resourceId: existing.id };

            await paymentAdapter.attachPaymentReference({
                orderId,
                provider: 'razorpay',
                providerOrderId,
                requestId: getRequestId(c),
                idempotencyKey: `hosted-checkout-provider-order:${cartId}`,
            });
            return {
                body: success({
                    checkout: sessionPayload(session),
                    payment_intent: {
                        payment_intent_id: paymentIntent.payment_intent_id,
                        provider: 'razorpay',
                        status: 'requires_action',
                        mode: 'sandbox',
                        key_id: c.env.RAZORPAY_KEY_ID,
                        provider_order_id: providerOrderId,
                        amount_minor: amountMinor,
                        currency: 'INR',
                    },
                }),
                status: 201,
                resourceId: session.id,
            };
        }

        const intent = {
            payment_intent_id: `cod_${crypto.randomUUID()}`,
            provider: 'cod',
            mode: body.mode,
            status: 'authorized',
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
    const verified = await verifyCheckoutHandoff(c, cartId, false);
    if (!verified.ok) return verified.response;
    const body = c.get('validatedBody') as JsonRecord & {
        idempotency_key: string;
        payment_intent_id?: string;
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
    };

    // Recover a committed acknowledgement without claiming new work or
    // applying storefront navigation policy to an existing outcome.
    const priorReply = await new IdempotencyExecutionAdapter(getSupabaseAdmin(c)).readCompleted({
        siteId: verified.handoff.siteId, key: body.idempotency_key,
        scope: `checkout.confirm:${cartId}`, requestBody: body,
    });
    if (priorReply) return c.json(priorReply.responseBody as never, priorReply.statusCode as never);
    const priorSession = await loadSession(getSupabaseAdmin(c), verified.handoff);
    const recoveringCapture = priorSession?.payment_intent?.provider === 'razorpay'
        && typeof priorSession.payment_intent.order_id === 'string';
    if (!recoveringCapture) await authorizeHostedPurchase(c, verified.handoff);

    return runIdempotentStep(c, verified.handoff, `checkout.confirm:${cartId}`, body.idempotency_key, body, async () => {
        const existing = await loadSession(getSupabaseAdmin(c), verified.handoff);
        if (!existing) return { body: { success: false, error: { code: 'CHECKOUT_NOT_STARTED', message: 'Checkout has not started.' } }, status: 409 };

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

        if (orderPlan.provider === 'cod' && recoveringCapture) {
            await authorizeHostedPurchase(c, verified.handoff);
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

        const db = getSupabaseAdmin(c);
        let existingRazorpayOrder: JsonRecord | null = null;
        if (orderPlan.provider === 'razorpay') {
            const providerOrderId = stringValue(body.razorpay_order_id);
            const providerPaymentId = stringValue(body.razorpay_payment_id);
            const signature = stringValue(body.razorpay_signature);
            const boundProviderOrderId = stringValue(existing.payment_intent?.provider_order_id);
            const orderId = stringValue(existing.payment_intent?.order_id);
            const expectedAmountMinor = existing.payment_intent?.amount_minor;
            const expectedCurrency = existing.payment_intent?.currency;
            if (!providerOrderId || !providerPaymentId || !signature || !boundProviderOrderId || !orderId
                || typeof expectedAmountMinor !== 'number' || !Number.isSafeInteger(expectedAmountMinor)
                || expectedAmountMinor <= 0 || expectedCurrency !== 'INR') {
                return {
                    body: { success: false, error: { code: 'CHECKOUT_PROVIDER_PAYMENT_REQUIRED', message: 'Verified payment is required before checkout confirmation.' } },
                    status: 400,
                    resourceId: existing.id,
                };
            }

            const proof = await verifyRazorpayPayment(c.env.RAZORPAY_KEY_SECRET, {
                providerOrderId,
                providerPaymentId,
                signature,
                storedProviderOrderId: boundProviderOrderId,
            });
            if (!proof.ok) {
                return {
                    body: { success: false, error: { code: 'CHECKOUT_PROVIDER_SIGNATURE_INVALID', message: 'Payment could not be verified.' } },
                    status: proof.reason === 'provider_not_configured' ? 503 : 400,
                    resourceId: existing.id,
                };
            }

            try {
                await assertProviderPaymentNotReplayed(c, {
                    provider: 'razorpay',
                    providerPaymentId,
                    providerOrderId,
                    orderId,
                });
            } catch (error) {
                if (!(error instanceof ConflictError)) throw error;
                return {
                    body: { success: false, error: { code: 'CHECKOUT_PROVIDER_PAYMENT_REPLAYED', message: 'Payment could not be verified for this checkout.' } },
                    status: 409,
                    resourceId: existing.id,
                };
            }

            const paymentAdapter = new PaymentExecutionAdapter(db);
            let payable;
            try {
                payable = await paymentAdapter.loadStorefrontOrderForCapture(orderId, verified.handoff.siteId);
            } catch {
                return { body: { success: false, error: { code: 'CHECKOUT_ORDER_UNAVAILABLE', message: 'Checkout could not be confirmed.' } }, status: 409, resourceId: existing.id };
            }
            const orderAmountMinor = Math.round(Number(payable.total) * 100);
            if (payable.payment_id !== boundProviderOrderId || payable.currency?.toUpperCase() !== expectedCurrency
                || orderAmountMinor !== expectedAmountMinor || !Number.isSafeInteger(orderAmountMinor)) {
                return { body: { success: false, error: { code: 'CHECKOUT_PROVIDER_AMOUNT_MISMATCH', message: 'Payment could not be matched to this checkout.' } }, status: 409, resourceId: existing.id };
            }

            let providerPayment: Awaited<ReturnType<typeof fetchRazorpayPayment>>;
            try {
                providerPayment = c.env.ENVIRONMENT === 'test' && c.env.HOSTED_RAZORPAY_TEST_ADAPTER
                    ? await c.env.HOSTED_RAZORPAY_TEST_ADAPTER.fetchPayment(providerPaymentId)
                    : await fetchRazorpayPayment({ keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET }, providerPaymentId);
            } catch {
                return { body: { success: false, error: { code: 'CHECKOUT_PROVIDER_STATUS_UNAVAILABLE', message: 'Payment status is temporarily unavailable. Retry confirmation.' } }, status: 503, resourceId: existing.id, retryable: true };
            }
            if (providerPayment.error) {
                return { body: { success: false, error: { code: 'CHECKOUT_PROVIDER_STATUS_UNAVAILABLE', message: 'Payment status is temporarily unavailable. Retry confirmation.' } }, status: 503, resourceId: existing.id, retryable: true };
            }
            if (providerPayment.status !== 'captured' || providerPayment.captured !== true) {
                return { body: { success: false, error: { code: 'CHECKOUT_PROVIDER_PAYMENT_PENDING', message: 'Payment has not been captured yet. Retry confirmation shortly.' } }, status: 409, resourceId: existing.id, retryable: true };
            }
            if (providerPayment.id !== providerPaymentId || providerPayment.order_id !== boundProviderOrderId
                || providerPayment.amount !== expectedAmountMinor || providerPayment.currency?.toUpperCase() !== expectedCurrency) {
                const { error: compensationError } = await db.from('compensation_actions').upsert({
                    site_id: verified.handoff.siteId,
                    flow: 'checkout_confirm',
                    aggregate_type: 'checkout',
                    aggregate_id: existing.id,
                    idempotency_key: `checkout.confirm.provider-mismatch:${existing.id}:${providerPaymentId}`,
                    status: 'pending',
                    action: 'refund_captured_payment',
                    payload: {
                        provider: 'razorpay',
                        provider_order_id: boundProviderOrderId,
                        provider_payment_id: providerPaymentId,
                        expected_amount_minor: expectedAmountMinor,
                        actual_amount_minor: providerPayment.amount ?? null,
                        expected_currency: expectedCurrency,
                        actual_currency: providerPayment.currency ?? null,
                        reason: 'provider_capture_binding_mismatch',
                    },
                    request_id: getRequestId(c),
                }, { onConflict: 'site_id,flow,idempotency_key' });
                if (compensationError) throw new Error('Failed to persist captured payment review action');
                return { body: { success: false, error: { code: 'CHECKOUT_PROVIDER_CAPTURE_MISMATCH', message: 'Payment needs support review before this order can be confirmed.' } }, status: 409, resourceId: existing.id };
            }

            const { data: orderRow, error: orderError } = await db
                .from('orders')
                .select('id, order_number, status, total, currency, payment_status, store_id')
                .eq('id', orderId)
                .eq('store_id', verified.handoff.siteId)
                .is('deleted_at', null)
                .maybeSingle();
            if (orderError || !orderRow) {
                return { body: { success: false, error: { code: 'CHECKOUT_ORDER_UNAVAILABLE', message: 'Checkout could not be confirmed.' } }, status: 409, resourceId: existing.id };
            }
            existingRazorpayOrder = orderRow as JsonRecord;
        }

        if (orderPlan.provider !== 'cod' && orderPlan.provider !== 'razorpay') {
            return {
                body: { success: false, error: { code: 'CHECKOUT_PAYMENT_METHOD_UNSUPPORTED', message: 'Checkout payment method is not supported.' } },
                status: 400,
                resourceId: existing.id,
            };
        }

        const revalidation = orderPlan.provider === 'cod'
            ? await revalidateConfirmInputs(c, verified.handoff, existing)
            : { ok: true as const };
        if (!revalidation.ok) {
            const reason = revalidation.reason;
            const failedSession = await persistCheckoutStep(c, verified.handoff, 'failed', {
                failed_at: new Date().toISOString(),
                metadata: { ...(existing.metadata || {}), failure_reason: reason },
            }) || existing;
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

        const tenant = await createPublicStorefrontTenantContext(c, verified.handoff.siteId);
        const order = existingRazorpayOrder
            || await new OrderExecutionAdapter(db).createOrder(orderPlan.command, tenant) as JsonRecord;
        const orderId = stringValue(order.id);
        if (!orderId) {
            throw new Error('Hosted checkout order creation returned no order id');
        }

        let paidOrder: unknown = order;
        let capturePostedToLedger = false;
        if (orderPlan.provider !== 'cod') {
            const providerPaymentId = stringValue(body.razorpay_payment_id)!;
            const captureIdempotencyKey = `checkout.confirm.capture:${orderId}:${body.idempotency_key}`;
            paidOrder = await new PaymentExecutionAdapter(db).confirmPayment({
                orderId,
                provider: 'razorpay',
                providerPaymentId,
                providerOrderId: stringValue(body.razorpay_order_id),
                providerEventId: `hosted_checkout:razorpay:${providerPaymentId}`,
                requestId: getRequestId(c),
                idempotencyKey: captureIdempotencyKey,
            });

            const capture = readCaptureResult(paidOrder);
            if (!capture.fulfillable) {
                const failedSession = await persistCheckoutStep(c, verified.handoff, 'failed', {
                    failed_at: new Date().toISOString(),
                    metadata: {
                        ...(existing.metadata || {}),
                        order_id: orderId,
                        payment_provider: 'razorpay',
                        capture_posted_to_ledger: true,
                        failure_reason: 'payment_captured_order_unfulfillable',
                    },
                });
                if (!failedSession) throw new Error('Could not persist unfulfillable captured-payment checkout state');
                await emitCheckoutEvent(c, {
                    siteId: verified.handoff.siteId,
                    cartId,
                    checkoutId: failedSession.id,
                    eventType: 'checkout.failed',
                    idempotencyKey: `checkout.failed.capture-unfulfillable:${failedSession.id}:${providerPaymentId}`,
                    payload: { reason: 'payment_captured_order_unfulfillable', order_id: orderId },
                });
                return {
                    body: { success: false, error: { code: 'PAYMENT_CAPTURED_ORDER_UNFULFILLABLE', message: 'Payment was captured but the order needs support review.' } },
                    status: 409,
                    resourceId: failedSession.id,
                };
            }

            const { data: captureLedgerRow, error: captureLedgerError } = await db
                .from('ledger_transactions')
                .select('id')
                .eq('site_id', verified.handoff.siteId)
                .eq('source_type', 'payment_capture')
                .eq('source_id', `razorpay:${providerPaymentId}`)
                .eq('idempotency_key', captureIdempotencyKey)
                .is('deleted_at', null)
                .maybeSingle();
            if (captureLedgerError) {
                throw new Error(`Hosted checkout capture ledger proof failed: ${captureLedgerError.message}`);
            }
            capturePostedToLedger = Boolean(captureLedgerRow);
            if (capturePostedToLedger) {
                await emitOrderPaidEvent(c.env, db, {
                    order: paidOrder,
                    fallbackOrder: order,
                    requestId: getRequestId(c),
                    idempotencyKey: `razorpay:${providerPaymentId}`,
                });
            }
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
    const siteIds = c.req.queries('site_id') || [];
    const tokens = c.req.queries('cart_token') || [];
    if (siteIds.length !== 1 || tokens.length > 1) return c.json({ success: false, error: { code: 'VALIDATION', message: 'One site and cart capability are required.' } }, 400);
    if (!tokens[0]) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A checkout cart capability is required.' } }, 401);
    const parsed = CheckoutStateReadSchema.safeParse({id: c.req.param('id'), site_id: siteIds[0], cart_token: tokens[0]});
    if (!parsed.success) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Checkout reference is invalid.' } }, 400);
    const { data, error } = await getSupabaseAdmin(c).from('checkout_sessions')
        .select('id,site_id,cart_id,channel,sales_origin,checkout_state,status,customer_email,buyer_name,buyer_phone,shipping_address,delivery_quote,payment_intent,confirmed_at,failed_at')
        .eq('site_id', parsed.data.site_id).eq('id', parsed.data.id)
        .eq('cart_token', parsed.data.cart_token).is('deleted_at', null).maybeSingle();
    if (error) throw new AppError('Checkout is temporarily unavailable', 503, 'CHECKOUT_UNAVAILABLE');
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

// T8/W2 — store_branding's real columns are only site_id/logo_url/favicon_url/primary_color/
// accent_color/checkout_theme/tokens/metadata (no migration this phase). The 7 new
// StoreBrandingSchema fields (secondary/background/text/surface colour, both fonts, radius,
// is_dark) are genuinely typed and validated at the Zod layer, but physically persist inside the
// existing schemaless `tokens` jsonb column under this reserved, unambiguous key prefix — never
// mixed with a merchant's own arbitrary `tokens` entries, and never spread directly onto the
// upsert payload (the table has no such columns; doing that would 500 on a real write).
const EXTENDED_BRANDING_TOKEN_PREFIX = 'theme_override__';
const EXTENDED_BRANDING_FIELDS = [
    'secondary_color', 'background_color', 'text_color', 'surface_color',
    'heading_font_family', 'body_font_family', 'border_radius', 'is_dark',
] as const;

function packExtendedBrandingIntoTokens(body: StoreBrandingInput): Record<string, string | number | boolean> {
    const packed: Record<string, string | number | boolean> = { ...body.tokens };
    for (const field of EXTENDED_BRANDING_FIELDS) {
        const value = body[field];
        if (value === undefined || value === null) continue;
        packed[`${EXTENDED_BRANDING_TOKEN_PREFIX}${field}`] = value;
    }
    return packed;
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
            logo_url: body.logo_url ?? null,
            favicon_url: body.favicon_url ?? null,
            primary_color: body.primary_color,
            accent_color: body.accent_color,
            checkout_theme: body.checkout_theme,
            tokens: packExtendedBrandingIntoTokens(body),
            updated_by: customUser.id,
            created_by: customUser.id,
        }, { onConflict: 'site_id' })
        .select('site_id, logo_url, favicon_url, primary_color, accent_color, checkout_theme, tokens')
        .single();

    if (error || !data) return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } }, 500);
    return c.json(success({ branding: data }));
});

export default checkoutRouter;
