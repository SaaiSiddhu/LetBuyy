import { defaultBranding, packExtendedBrandingIntoTokens } from '../lib/checkout-store-presentation';
import { verifyHostedDiscountSelection } from '../lib/hosted-checkout-discount';
import { quoteCheckoutTotals } from '../lib/checkout-tax-quote';
import { checkoutOrderItems } from '../lib/hosted-checkout-order-command';
import { verifyHandoffCheckoutOrigin } from '../lib/checkout-handoff-origin';
import { hostedRazorpayTestCredentials } from '../lib/hosted-razorpay-credentials';
import { cartLines, signedCartSubtotalMinor, stringValue, checkoutPaymentProvider, checkoutShippingMethod, buildHostedCheckoutOrderCommand, type CartRow, type HostedCheckoutPaymentProvider } from '../lib/hosted-checkout-order-command';
export { buildHostedCheckoutOrderCommand } from '../lib/hosted-checkout-order-command';
import { loadCheckoutStorePresentation } from '../lib/checkout-store-presentation';
import { authorizeHostedStorefrontPurchase } from '../lib/storefront-visitor-access';
import { loadBuyerSessionState } from '../middleware/buyer-session';
import { canonicalizeExecutionPayload } from '@letbuyy/event-core';
import { redactReplayableSecrets } from '../lib/replayable-secret-redaction';
import { sessionPayload, selectedHostedDiscountCodes, canRestartUnpaidHostedContact, canPrepareCodIntent, contactRestartPatch, confirmationDecision, confirmationClaimPatch, releaseRejectedCodClaimPatch, sessionMatchesScope, sessionRevision, sessionWriteAllowed, SESSION_REVISION, type HostedCheckoutSession, type ConfirmationClaim } from '../lib/hosted-checkout-session';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
    CheckoutConfirmSchema,
    CheckoutStateReadSchema,
    CheckoutContactSchema,
    CheckoutDeliverySchema,
    CheckoutQuoteSchema,
    CheckoutPaymentIntentSchema,
    StoreBrandingSchema,
    assertBrandingIsDataOnly,
    canonicalCheckoutCartBinding,
    canonicalCheckoutBuyerBinding,
    canonicalCheckoutHandoffPayload,
    gstStateCodeFromName,
    normalizeCheckoutChannel,
    type CreateCheckoutOrderCommand,
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
import { toInrMinorUnits } from '@letbuyy/payments';

type AppContext = Context<{ Bindings: Env }>;
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

type CheckoutSessionRow = HostedCheckoutSession;

export type VerifiedHandoff = {
    siteId: string;
    cartId: string;
    cartToken: string;
    channel: string;
    cart: CartRow;
    signature?: string;
    buyerBinding?: { buyerAccountId: string; sessionEpoch: number };
};

type StepTarget = 'contact' | 'delivery' | 'payment_intent' | 'confirming' | 'completed' | 'failed';
// Phase M1 (DOC 03 row 11 "Payments"): Razorpay + COD are the only live
// hosted-checkout money-in rails.


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
    const buyerBindingDigest = c.req.query('buyer_binding');
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
    const checkoutOrigin = await verifyHandoffCheckoutOrigin(c,siteId,cartRow.checkout_handoff?.checkout_origin);
    if (checkoutOrigin === null) return { ok: false, response: invalidHandoff(c) };
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

    let buyerBinding: VerifiedHandoff['buyerBinding'];
    if (buyerBindingDigest !== undefined) {
        const stored = cartRow.checkout_handoff?.buyer_binding;
        if (!/^[a-f0-9]{64}$/.test(buyerBindingDigest) || !stored?.buyer_account_id
            || !Number.isInteger(stored.session_epoch) || (stored.session_epoch ?? -1) < 0
            || !stored.digest || !timingSafeEqualHex(stored.digest, buyerBindingDigest)) {
            return { ok: false, response: invalidHandoff(c) };
        }
        const boundDigest = await sha256Hex(canonicalCheckoutBuyerBinding({
            siteId, cartId, cartToken, channel, expiresAt, cartContentDigest: expectedCartDigest,
            buyerAccountId: stored.buyer_account_id, buyerSessionEpoch: stored.session_epoch!,
        }));
        if (!timingSafeEqualHex(boundDigest, buyerBindingDigest)) return { ok: false, response: invalidHandoff(c) };
        buyerBinding = { buyerAccountId: stored.buyer_account_id, sessionEpoch: stored.session_epoch! };
    }
    const expected = await hmacSha256Hex(secret, canonicalCheckoutHandoffPayload({
        siteId,
        cartId,
        cartToken,
        channel,
        salesOrigin: cartRow.sales_origin === 'marketplace' ? 'marketplace' : 'storefront',
        expiresAt,
        cartContentDigest: expectedCartDigest,
        buyerBindingDigest,
        checkoutOrigin,
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
            ...(buyerBinding ? { buyerBinding } : {}),
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

function scopeFor(handoff: VerifiedHandoff) {
    return { siteId: handoff.siteId, cartId: handoff.cartId, cartToken: handoff.cartToken, cartStatus: handoff.cart.status || null };
}

async function canRestartContact(c: AppContext, handoff: VerifiedHandoff, row: CheckoutSessionRow): Promise<boolean> {
    if (handoff.cart.sales_origin === 'marketplace' || !canRestartUnpaidHostedContact(row, scopeFor(handoff))
        || !row.buyer_account_id || !Number.isInteger(row.buyer_session_epoch)
        || handoff.buyerBinding?.buyerAccountId !== row.buyer_account_id
        || handoff.buyerBinding.sessionEpoch !== row.buyer_session_epoch) return false;
    const admission = handoff.cart.checkout_handoff?.storefront_admission;
    const currentSignature = admission && typeof admission === 'object' && 'signature' in admission ? admission.signature : null;
    if (typeof currentSignature !== 'string' || !handoff.signature || !timingSafeEqualHex(currentSignature, handoff.signature)) return false;
    const db = getSupabaseAdmin(c);
    const { data: buyer, error: buyerError } = await loadBuyerSessionState(c, row.buyer_account_id);
    if (buyerError || !buyer || buyer.status !== 'active' || buyer.session_epoch !== row.buyer_session_epoch) return false;
    // A legacy/unknown committed order can precede session acknowledgement.
    // Refuse recovery if canonical order facts already consumed this cart.
    const { data: effects, error: effectError } = await db.from('order_items').select('id,orders!inner(store_id)')
        .eq('site_id', handoff.siteId).eq('orders.store_id', handoff.siteId).contains('product_snapshot', { cart_id: handoff.cartId }).limit(1);
    return !effectError && Array.isArray(effects) && effects.length === 0;
}

async function persistCheckoutStep(
    c: AppContext, handoff: VerifiedHandoff, target: StepTarget, patch: JsonRecord,
    observed?: CheckoutSessionRow | null,
    recovery: 'normal' | 'contact_restart' | 'rejected_confirmation' = 'normal',
): Promise<CheckoutSessionRow | null> {
    const db = getSupabaseAdmin(c);
    const existing = observed === undefined ? await loadSession(db, handoff) : observed;
    if (existing && (!sessionMatchesScope(existing, scopeFor(handoff)) || !existing.updated_at)) return null;
    if (recovery === 'rejected_confirmation') {
        if (!existing || target !== 'payment_intent' || existing.checkout_state !== 'confirming') return null;
    } else if (!sessionWriteAllowed(existing, target, recovery === 'contact_restart')) return null;
    const patchMetadata = patch.metadata && typeof patch.metadata === 'object' && !Array.isArray(patch.metadata) ? patch.metadata : {};
    const row = {
        ...patch,
        site_id: handoff.siteId, cart_id: handoff.cartId, cart_token: handoff.cartToken,
        channel: handoff.channel, sales_origin: handoff.cart.sales_origin === 'marketplace' ? 'marketplace' : 'storefront',
        status: target, checkout_state: target, idempotency_key: `checkout:${handoff.siteId}:${handoff.cartId}`,
        metadata: { ...(existing?.metadata || {}), ...patchMetadata, source: 'hosted_checkout_v1',
            cart_status: handoff.cart.status || null, [SESSION_REVISION]: crypto.randomUUID() },
    };
    if (!existing) {
        const { data, error } = await db.from('checkout_sessions').insert(row).select('*').maybeSingle();
        return !error && data ? data as CheckoutSessionRow : null;
    }
    // Keep the raw PostgreSQL timestamp (including microseconds). The private
    // revision makes even equal-timestamp same-state writes mutually exclusive.
    let query = db.from('checkout_sessions').update(row).eq('site_id', handoff.siteId).eq('id', existing.id)
        .eq('cart_id', handoff.cartId).eq('cart_token', handoff.cartToken).is('deleted_at', null)
        .eq('updated_at', existing.updated_at!);
    query = existing.checkout_state ? query.eq('checkout_state', existing.checkout_state) : query.is('checkout_state', null);
    query = existing.status ? query.eq('status', existing.status) : query.is('status', null);
    const revision = sessionRevision(existing);
    query = revision ? query.eq(`metadata->>${SESSION_REVISION}`, revision) : query.is(`metadata->>${SESSION_REVISION}`, null);
    query = existing.buyer_account_id ? query.eq('buyer_account_id', existing.buyer_account_id) : query.is('buyer_account_id', null);
    query = existing.buyer_session_epoch === null || existing.buyer_session_epoch === undefined
        ? query.is('buyer_session_epoch', null) : query.eq('buyer_session_epoch', existing.buyer_session_epoch);
    const { data, error } = await query.select('*').maybeSingle();
    return !error && data ? data as CheckoutSessionRow : null;
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

    const selectedCodes = selectedHostedDiscountCodes(session, handoff.cart.coupon_code);
    if (!selectedCodes) return { ok: false, reason: 'discount_invalid' };
    const discountCodes = new Set(selectedCodes);
    if (discountCodes.size > 0) {
        const { data, error } = await db
            .from('coupons')
            .select('code')
            .eq('store_id', handoff.siteId)
            .in('code', [...discountCodes])
            .eq('is_active', true)
            .is('deleted_at', null);
        if (error || (data || []).length < discountCodes.size) return { ok: false, reason: 'discount_invalid' };
    }

    return { ok: true };
}

async function loadCommittedCodOrder(
    db: ReturnType<typeof getSupabaseAdmin>, handoff: VerifiedHandoff,
    session: CheckoutSessionRow, command: CreateCheckoutOrderCommand,
): Promise<JsonRecord | null> {
    const cartOrderId = handoff.cart.checkout_handoff?.order_id;
    if (handoff.cart.status !== 'converted' || !cartOrderId || !session.buyer_account_id) return null;
    const { data: receipt, error: receiptError } = await db.from('checkout_sessions').select('order_id')
        .eq('site_id', handoff.siteId).eq('idempotency_key', command.idempotency_key)
        .eq('order_id', cartOrderId).is('deleted_at', null).maybeSingle();
    if (receiptError || receipt?.order_id !== cartOrderId) return null;
    const { data: owner, error: ownerError } = await db.from('buyer_order_links').select('order_id')
        .eq('site_id', handoff.siteId).eq('order_id', cartOrderId).eq('buyer_account_id', session.buyer_account_id)
        .eq('link_basis', 'authenticated_checkout').maybeSingle();
    if (ownerError || !owner) return null;
    const { data: rows, error: rowsError } = await db.from('order_items')
        .select('product_id,variant_id,quantity,marketplace_listing_id,product_snapshot')
        .eq('site_id', handoff.siteId).eq('order_id', cartOrderId).is('deleted_at', null);
    if (rowsError || !Array.isArray(rows) || rows.length !== command.items.length) return null;
    const expected = command.items.map(item => [item.product_id, item.variant_id || null, item.quantity,
        item.marketplace_listing_id || null, item.cart_fact_ref?.cart_id || null, item.cart_fact_ref?.line_id || null,
        item.cart_fact_ref?.product_version ?? null, item.cart_fact_ref?.configuration_fingerprint || null,
        item.cart_fact_ref?.snapshot_fingerprint || null]);
    const actual = rows.map(item => [item.product_id, item.variant_id || null, item.quantity,
        item.marketplace_listing_id || null, item.product_snapshot?.cart_id || null, item.product_snapshot?.cart_line_id || null,
        item.product_snapshot?.product_version ?? null, item.product_snapshot?.configuration_fingerprint || null,
        item.product_snapshot?.snapshot_fingerprint || null]);
    const stable = (items: unknown[][]) => canonicalizeExecutionPayload(items.map(item => canonicalizeExecutionPayload(item)).sort());
    if (stable(expected) !== stable(actual)) return null;
    const { data: order, error: orderError } = await db.from('orders').select('*')
        .eq('id', cartOrderId).eq('store_id', handoff.siteId).eq('payment_method', 'cod')
        .is('deleted_at', null).maybeSingle();
    return !orderError && order ? order as JsonRecord : null;
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
    const checkout = await loadSession(getSupabaseAdmin(c), verified.handoff);
    const codes = selectedHostedDiscountCodes(checkout, verified.handoff.cart.coupon_code);
    const savedDiscount = checkout?.metadata?.hosted_discount_selection_v1 === true && codes?.length === 1
        && Number.isFinite(Number(checkout.discount_total)) && Number(checkout.discount_total) >= 0
        ? { code: codes[0], amount: Number(checkout.discount_total) } : undefined;

    return c.json(success({
        site_id: verified.handoff.siteId,
        cart_id: verified.handoff.cartId,
        cart_token: verified.handoff.cartToken,
        channel: verified.handoff.channel,
        coupon_code: typeof verified.handoff.cart.coupon_code === 'string' ? verified.handoff.cart.coupon_code : null,
        subdomain: presentation.subdomain,
        presentation,
        ...(savedDiscount ? { saved_discount: savedDiscount } : {}),
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
            resolvedRates = (await listStorefrontShippingRates(db, verified.handoff.siteId, address, subtotalMinor, checkoutOrderItems(verified.handoff.cart)))
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
    } catch (error) {
        if (error instanceof AppError) throw error;
        return c.json({ success: false, error: { code: 'CHECKOUT_SHIPPING_UNAVAILABLE', message: 'Delivery options are temporarily unavailable. Please retry.' } }, 503);
    }
});

checkoutRouter.post('/:cartId/quote', validate('json', CheckoutQuoteSchema), async (c) => {
    const verified = await verifyCheckoutHandoff(c, c.req.param('cartId'));
    if (!verified.ok) return verified.response;
    const body = c.get('validatedBody') as {
        shipping_address: Record<string, unknown>; shipping_rate_id: string; coupon_code?: string | null; customer_email?: string | null;
    };
    const quote = await quoteCheckoutTotals(getSupabaseAdmin(c), {
        siteId: verified.handoff.siteId, items: checkoutOrderItems(verified.handoff.cart),
        shippingAddress: body.shipping_address, shippingRateId: body.shipping_rate_id,
        couponCode: body.coupon_code, customerEmail: body.customer_email,
    });
    return c.json(success({ quote }));
});

checkoutRouter.post('/:cartId/contact', validate('json', CheckoutContactSchema), async (c) => {
    const cartId = c.req.param('cartId');
    const verified = await verifyCheckoutHandoff(c, cartId);
    if (!verified.ok) return verified.response;
    const body = c.get('validatedBody') as JsonRecord & { idempotency_key: string; email: string; name: string; phone?: string | null; gstin?: string | null };

    return runIdempotentStep(c, verified.handoff, `checkout.contact:${cartId}`, body.idempotency_key, body, async (claimId) => {
        const observed = await loadSession(getSupabaseAdmin(c), verified.handoff);
        const restart = observed ? await canRestartContact(c, verified.handoff, observed) : false;
        const session = await persistCheckoutStep(c, verified.handoff, 'contact', {
            ...(restart ? contactRestartPatch(observed!, claimId, new Date().toISOString()) : {}),
            customer_email: body.email,
            buyer_name: body.name,
            buyer_phone: body.phone || null,
            buyer_gstin: body.gstin || null,
        }, observed, restart ? 'contact_restart' : 'normal');
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
    const body = c.get('validatedBody') as JsonRecord & { idempotency_key: string; shipping_method: string; shipping_address: JsonRecord; cod_requested: boolean; shipping_quote: JsonRecord; discount_codes?: string[]; expected_discount_amount_minor?: number; expected_quote_fingerprint?: string };

    return runIdempotentStep(c, verified.handoff, `checkout.delivery:${cartId}`, body.idempotency_key, body, async () => {
        const observed = await loadSession(getSupabaseAdmin(c), verified.handoff);
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
            } catch (error) {
                if (error instanceof AppError) throw error;
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
                    subtotalMinor, checkoutOrderItems(verified.handoff.cart),
                );
                selectedRate = rates.find((rate) => rate.id === shippingRateId);
            } catch (error) {
                if (error instanceof AppError) throw error;
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

        const discount = await verifyHostedDiscountSelection(getSupabaseAdmin(c), {
            siteId: verified.handoff.siteId, cart: verified.handoff.cart, observed,
            shippingAmount: typeof serverResolvedQuote.amount === 'number' ? serverResolvedQuote.amount : 0,
            codes: body.discount_codes, expectedAmountMinor: body.expected_discount_amount_minor,
        });
        if (!discount.ok) return discount.refusal;

        const shippingAddress = { ...body.shipping_address };
        if (!stringValue(shippingAddress.state_code)) {
            const stateCode = gstStateCodeFromName(stringValue(shippingAddress.state));
            if (stateCode) shippingAddress.state_code = stateCode;
        }

        const totalsQuote = await quoteCheckoutTotals(getSupabaseAdmin(c), {
            siteId: verified.handoff.siteId, items: checkoutOrderItems(verified.handoff.cart),
            shippingAddress, shippingRateId: String(serverResolvedQuote.shipping_rate_id),
            couponCode: discount.codes[0], customerEmail: observed?.customer_email,
        });
        if (body.expected_quote_fingerprint !== totalsQuote.fingerprint) {
            return { body: { success: false, error: { code: 'CHECKOUT_QUOTE_CHANGED',
                message: 'The order total changed. Review the current total before paying.' } }, status: 409 };
        }
        serverResolvedQuote = { ...serverResolvedQuote, tax_quote_fingerprint: totalsQuote.fingerprint,
            totals_quote: totalsQuote as unknown as JsonRecord };

        const session = await persistCheckoutStep(c, verified.handoff, 'delivery', {
            shipping_method: body.shipping_method,
            shipping_address: shippingAddress,
            delivery_quote: serverResolvedQuote,
            discount_codes: discount.codes, discount_total: discount.amount,
            metadata: { ...(observed?.metadata || {}), hosted_discount_selection_v1: true, hosted_delivery_signature: verified.handoff.signature || null },
        }, observed);
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

    const priorCredentialId = stringValue(priorSetup?.payment_intent?.credential_id);
    const razorpayCredentials = body.provider === 'razorpay' ? await hostedRazorpayTestCredentials(c, verified.handoff.siteId, undefined,
        recoveringProviderAttempt && priorCredentialId ? { credentialId: priorCredentialId } : undefined) : null;
    if (body.provider === 'razorpay') {
        if (!razorpayCredentials) {
            return c.json({ success: false, error: { code: 'PAYMENT_SETUP_REQUIRED', message: 'Payment provider setup is required.' } }, 503);
        }
        const priorKeyId = stringValue(priorSetup?.payment_intent?.key_id);
        if (priorKeyId && priorKeyId !== razorpayCredentials!.keyId) {
            return c.json({ success: false, error: { code: 'CHECKOUT_PAYMENT_CONFIGURATION_CHANGED', message: 'Payment settings changed. Contact the store before retrying this payment.' } }, 409);
        }
        if (body.tokenize) {
            return c.json({ success: false, error: { code: 'CHECKOUT_TOKENIZATION_UNAVAILABLE', message: 'Payment tokenization is not available for this checkout.' } }, 400);
        }
    }

    return runIdempotentStep(c, verified.handoff, `checkout.payment_intent:${cartId}`, body.idempotency_key, body, async (claimId) => {
        const observed = await loadSession(getSupabaseAdmin(c), verified.handoff);
        if (body.provider === 'razorpay') {
            const db = getSupabaseAdmin(c);
            const existing = observed;
            if (!existing || !existing.customer_email || !existing.shipping_address || Object.keys(existing.shipping_address).length === 0) {
                return { body: { success: false, error: { code: 'CHECKOUT_DETAILS_REQUIRED', message: 'Complete checkout contact and delivery details first.' } }, status: 409 };
            }
            const priorIntent = existing.payment_intent || {};
            if (stringValue(priorIntent.credential_id) && priorIntent.credential_id !== razorpayCredentials?.credentialId) {
                return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'This payment belongs to its original connection. Reload checkout.' } }, status: 409 };
            }
            if (priorIntent.status === 'creating_local_order' && !stringValue(priorIntent.order_id)) {
                return { body: { success: false, error: { code: 'CHECKOUT_PROVIDER_ORDER_RECONCILIATION_REQUIRED', message: 'Online payment setup needs support review before retrying.' } }, status: 503, resourceId: existing.id };
            }
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
                            key_id: razorpayCredentials!.keyId,
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
                        const amountMinor = toInrMinorUnits(payable.total);
                        if ((payable.currency || 'INR').toUpperCase() === 'INR') {
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
                                { keyId: razorpayCredentials!.keyId, keySecret: razorpayCredentials!.keySecret },
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
                        }, existing);
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
                                    key_id: razorpayCredentials!.keyId,
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

            const setupIntentId = crypto.randomUUID();
            const setupSession = await persistCheckoutStep(c, verified.handoff, 'payment_intent', {
                payment_method: 'razorpay',
                payment_intent: { provider: 'razorpay', mode: 'sandbox', key_id: razorpayCredentials!.keyId,
                    ...(razorpayCredentials!.credentialId ? { credential_id: razorpayCredentials!.credentialId } : {}),
                    status: 'creating_local_order', payment_intent_id: setupIntentId, setup_claim_id: claimId },
            }, existing);
            if (!setupSession) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout changed before payment setup.' } }, status: 409, retryable: true };

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
            const amountMinor = toInrMinorUnits(payable.total);
            if ((payable.currency || 'INR').toUpperCase() !== 'INR' || amountMinor <= 0) {
                return { body: { success: false, error: { code: 'PAYMENT_CURRENCY_UNSUPPORTED', message: 'Only exact INR checkout amounts are supported.' } }, status: 400, resourceId: orderId };
            }

            const paymentIntentId = setupIntentId;
            const creatingIntent = {
                payment_intent_id: paymentIntentId,
                key_id: razorpayCredentials!.keyId,
                ...(razorpayCredentials!.credentialId ? { credential_id: razorpayCredentials!.credentialId } : {}),
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
            }, setupSession);
            if (!creatingSession) {
                return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout cannot move to payment.' } }, status: 409, resourceId: existing.id };
            }

            const provider = c.env.ENVIRONMENT === 'test' && c.env.HOSTED_RAZORPAY_TEST_ADAPTER
                || createRazorpayPaymentProvider({ keyId: razorpayCredentials!.keyId, keySecret: razorpayCredentials!.keySecret });
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
            }, creatingSession);
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
                        key_id: razorpayCredentials!.keyId,
                        provider_order_id: providerOrderId,
                        amount_minor: amountMinor,
                        currency: 'INR',
                    },
                }),
                status: 201,
                resourceId: session.id,
            };
        }

        if (!canPrepareCodIntent(observed, scopeFor(verified.handoff), verified.handoff.signature)) {
            return { body: { success: false, error: { code: 'CHECKOUT_DETAILS_REQUIRED', message: 'Review current contact and delivery details before selecting COD.' } }, status: 409 };
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
        }, observed);
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
    const requestHash = await sha256Hex(canonicalizeExecutionPayload(body));
    const priorSession = await loadSession(getSupabaseAdmin(c), verified.handoff);
    const recoveringCapture = priorSession?.payment_intent?.provider === 'razorpay'
        && typeof priorSession.payment_intent.order_id === 'string';
    const priorClaim = priorSession?.metadata?.hosted_confirmation_claim;
    const priorCompletedReceipt = priorSession?.checkout_state === 'completed' && priorSession.confirmed_at && priorSession.order_id
        && priorClaim && typeof priorClaim === 'object' && !Array.isArray(priorClaim) && priorClaim.request_hash === requestHash;
    if (!recoveringCapture && !priorCompletedReceipt) await authorizeHostedPurchase(c, verified.handoff);

    return runIdempotentStep(c, verified.handoff, `checkout.confirm:${cartId}`, body.idempotency_key, body, async (claimId) => {
        let existing = await loadSession(getSupabaseAdmin(c), verified.handoff);
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

        const claim: ConfirmationClaim = { id: claimId, requestHash, intentId: expectedPaymentIntentId || '' };
        // A restarted checkout must name its replacement intent explicitly. Fresh
        // legacy COD commands remain compatible; an old intent-less command
        // cannot adopt a replacement created after explicit re-entry.
        if (orderPlan.provider === 'cod' && (!claim.intentId || (requestedPaymentIntentId && requestedPaymentIntentId !== claim.intentId)
            || (!requestedPaymentIntentId && Array.isArray(existing.metadata?.hosted_contact_reentries) && existing.metadata.hosted_contact_reentries.length > 0))) {
            return { body: { success: false, error: { code: 'CHECKOUT_PAYMENT_INTENT_MISMATCH', message: 'Review the current checkout payment choice.' } }, status: 409 };
        }
        const decision = confirmationDecision(existing, scopeFor(verified.handoff), claim);
        if (decision === 'completed_receipt') {
            const receipt = existing.metadata?.hosted_confirmation_order_receipt;
            if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || receipt.id !== existing.order_id) {
                return { body: { success: false, error: { code: 'CHECKOUT_ORDER_UNAVAILABLE', message: 'The completed checkout acknowledgement needs recovery.' } }, status: 503, retryable: true };
            }
            return { body: success({ checkout: sessionPayload(existing), order: receipt }), status: 200, resourceId: existing.id };
        }
        if (decision === 'deny') return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout confirmation is already owned or closed.' } }, status: 409, retryable: true };
        let claimEstablished = decision === 'resume' || decision === 'recover_committed';
        const ensureConfirmationClaim = async (): Promise<boolean> => {
            if (claimEstablished) return true;
            const claimed = await persistCheckoutStep(c, verified.handoff, 'confirming', confirmationClaimPatch(existing!, claim), existing);
            if (!claimed) return false;
            existing = claimed;
            claimEstablished = true;
            return true;
        };
        const db = getSupabaseAdmin(c);
        const committedCodOrder = decision === 'recover_committed'
            ? await loadCommittedCodOrder(db, verified.handoff, existing, orderPlan.command) : null;
        if (decision === 'recover_committed' && !committedCodOrder) {
            return { body: { success: false, error: { code: 'CHECKOUT_ORDER_UNAVAILABLE', message: 'The original checkout outcome needs recovery.' } }, status: 503, retryable: true };
        }
        let existingRazorpayOrder: JsonRecord | null = null;
        if (orderPlan.provider === 'razorpay') {
            const originalCredentialId = stringValue(existing.payment_intent?.credential_id);
            const razorpayCredentials = await hostedRazorpayTestCredentials(c, verified.handoff.siteId, undefined,
                originalCredentialId ? { credentialId: originalCredentialId } : undefined);
            if (!razorpayCredentials) return { body: { success: false, error: { code: 'PAYMENT_SETUP_REQUIRED', message: 'Payment setup is required for this store.' } }, status: 503, retryable: true };
            const boundKeyId = stringValue(existing.payment_intent?.key_id);
            if (boundKeyId && boundKeyId !== razorpayCredentials.keyId) return { body: { success: false, error: { code: 'CHECKOUT_PAYMENT_CONFIGURATION_CHANGED', message: 'Payment settings changed. Contact the store before retrying this payment.' } }, status: 409, retryable: true };
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

            const proof = await verifyRazorpayPayment(razorpayCredentials.keySecret, {
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
            const orderAmountMinor = toInrMinorUnits(payable.total);
            // The verified webhook may commit this same capture before the
            // browser callback arrives. The canonical writer then replaces the
            // order reference with its payment ID. Both still identify this
            // bound attempt; the replay check above and provider read below
            // independently enforce order, payment, amount and currency.
            if ((payable.payment_id !== boundProviderOrderId && payable.payment_id !== providerPaymentId)
                || payable.currency?.toUpperCase() !== expectedCurrency
                || orderAmountMinor !== expectedAmountMinor || !Number.isSafeInteger(orderAmountMinor)) {
                return { body: { success: false, error: { code: 'CHECKOUT_PROVIDER_AMOUNT_MISMATCH', message: 'Payment could not be matched to this checkout.' } }, status: 409, resourceId: existing.id };
            }

            if (!await ensureConfirmationClaim()) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout changed before payment confirmation.' } }, status: 409, retryable: true };
            let providerPayment: Awaited<ReturnType<typeof fetchRazorpayPayment>>;
            try {
                providerPayment = c.env.ENVIRONMENT === 'test' && c.env.HOSTED_RAZORPAY_TEST_ADAPTER
                    ? await c.env.HOSTED_RAZORPAY_TEST_ADAPTER.fetchPayment(providerPaymentId)
                    : await fetchRazorpayPayment({ keyId: razorpayCredentials.keyId, keySecret: razorpayCredentials.keySecret }, providerPaymentId);
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

        if (!await ensureConfirmationClaim()) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'Checkout changed before confirmation.' } }, status: 409, retryable: true };
        const revalidation = orderPlan.provider === 'cod' && !committedCodOrder
            ? await revalidateConfirmInputs(c, verified.handoff, existing)
            : { ok: true as const };
        if (!revalidation.ok) {
            const reason = revalidation.reason;
            const failedSession = await persistCheckoutStep(c, verified.handoff, 'failed', {
                failed_at: new Date().toISOString(),
                metadata: { ...(existing.metadata || {}), failure_reason: reason },
            }, existing) || existing;
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
        let order: JsonRecord;
        try {
            // A converted-cart claim can only finish its proven existing order;
            // it never reaches the creation RPC or current catalogue validators.
            order = committedCodOrder
                ? await new OrderExecutionAdapter(db).completeOrderPostCommitWork(orderPlan.command, tenant, committedCodOrder) as JsonRecord
                : existingRazorpayOrder || await new OrderExecutionAdapter(db).createOrder(orderPlan.command, tenant) as JsonRecord;
        } catch (error) {
            const code = error instanceof AppError ? error.code : '';
            const released = releaseRejectedCodClaimPatch(existing, claim, code);
            if (released) await persistCheckoutStep(c, verified.handoff, 'payment_intent', released, existing, 'rejected_confirmation');
            throw error;
        }
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
                }, existing);
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
                hosted_confirmation_order_receipt: JSON.parse(JSON.stringify(redactReplayableSecrets(paidOrder as JsonValue))) as JsonValue,
            },
        }, existing);
        if (!session) return { body: { success: false, error: { code: 'CHECKOUT_STATE_CONFLICT', message: 'The original checkout acknowledgement needs recovery.' } }, status: 503, retryable: true };

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
