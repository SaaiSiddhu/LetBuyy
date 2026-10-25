// Same-origin browser boundary for the hosted checkout state machine. The gateway remains the
// authority for the signed cart handoff; this route only forwards its capability and validated step.
import { NextRequest, NextResponse } from 'next/server';
import {
    CheckoutContactSchema,
    CheckoutDeliverySchema,
    CheckoutPaymentIntentSchema,
    CheckoutConfirmSchema,
} from '@letbuyy/checkout-core';
import { storefrontApiFetch } from '@/lib/api/client';
import { isSameOriginRequest } from '@/lib/buyer-auth/flow';

const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDOFF_KEYS = ['site_id', 'cart_token', 'expires_at', 'cart_digest', 'signature', 'channel'] as const;
const STEP_SCHEMAS = {
    contact: CheckoutContactSchema,
    delivery: CheckoutDeliverySchema,
    'payment-intent': CheckoutPaymentIntentSchema,
    confirm: CheckoutConfirmSchema,
} as const;
type CheckoutStep = keyof typeof STEP_SCHEMAS;

export async function GET(request: NextRequest, context: { params: Promise<{ cartId: string; step: string }> }) {
    if (!isSameOriginRequest(request.headers, request.url)) return jsonError(403, 'ORIGIN_DENIED', 'Checkout request origin is not allowed.');
    const { cartId, step } = await context.params;
    if (!UUID.test(cartId) || step !== 'delivery-options') return jsonError(404, 'CHECKOUT_STEP_NOT_FOUND', 'Checkout step was not found.');
    const query = new URL(request.url).searchParams;
    const handoff = new URLSearchParams();
    for (const key of HANDOFF_KEYS) {
        const value = query.get(key);
        if (!value || value.length > 2048) return jsonError(400, 'CHECKOUT_HANDOFF_REQUIRED', 'Checkout handoff is incomplete.');
        handoff.set(key, value);
    }
    if (!UUID.test(handoff.get('site_id') || '')) return jsonError(400, 'CHECKOUT_HANDOFF_REQUIRED', 'Checkout handoff is incomplete.');
    const country = query.get('country') || '';
    const state = query.get('state') || '';
    const stateCode = query.get('state_code') || '';
    const pincode = query.get('pincode') || '';
    if (!['IN', 'India'].includes(country) || !state || state.length > 100
        || (stateCode && !/^[A-Z0-9]{1,3}$/.test(stateCode)) || !/^[1-9][0-9]{5}$/.test(pincode)) {
        return jsonError(400, 'CHECKOUT_VALIDATION_FAILED', 'A valid Indian delivery address is required.');
    }
    const destination = new URLSearchParams({ country, state, pincode });
    if (stateCode) destination.set('state_code', stateCode);
    let upstream: Response;
    try {
        upstream = await storefrontApiFetch(`/checkout/${encodeURIComponent(cartId)}/delivery-options?${handoff.toString()}&${destination.toString()}`, { cache: 'no-store' });
    } catch {
        return jsonError(503, 'CHECKOUT_UNAVAILABLE', 'Delivery options are temporarily unavailable. Please retry.');
    }
    const payload = await upstream.json().catch(() => null) as { data?: { serviceable?: unknown; source?: unknown; carrier_confirmed?: unknown; rates?: unknown }; error?: { code?: unknown } } | null;
    if (!upstream.ok) return projectFailure(upstream.status, payload);
    const rates = payload?.data?.rates;
    if (!Array.isArray(rates)) return jsonError(503, 'CHECKOUT_RESPONSE_INVALID', 'Delivery options are temporarily unavailable. Please retry.');
    return NextResponse.json({
        success: true,
        data: {
            serviceability: {
                serviceable: payload?.data?.serviceable === true,
                source: 'seller_shipping_zone',
                carrier_confirmed: false,
            },
            rates: rates.filter((rate): rate is Record<string, unknown> => Boolean(rate && typeof rate === 'object' && !Array.isArray(rate)))
                .filter((rate) => typeof rate.id === 'string' && typeof rate.name === 'string' && typeof rate.amount === 'number' && Number.isFinite(rate.amount))
                .map((rate) => ({
                    id: rate.id,
                    name: rate.name,
                    type: rate.type === 'free' || rate.type === 'price_based' ? rate.type : 'flat',
                    amount_minor: Math.round(Number(rate.amount) * 100),
                    estimated_days_min: typeof rate.estimated_days_min === 'number' ? rate.estimated_days_min : null,
                    estimated_days_max: typeof rate.estimated_days_max === 'number' ? rate.estimated_days_max : null,
                    cod_available: rate.cod_available === true,
                    source: 'seller_zone_configuration',
                    carrier_confirmed: false,
                })),
        },
    }, { headers: NO_STORE });
}

function jsonError(status: number, code: string, message: string) {
    return NextResponse.json({ success: false, error: { code, message } }, { status, headers: NO_STORE });
}

function projectSuccess(step: CheckoutStep, payload: unknown): unknown | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const data = (payload as { data?: unknown }).data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const record = data as Record<string, unknown>;
    const checkout = record.checkout;
    if (!checkout || typeof checkout !== 'object' || Array.isArray(checkout)) return null;
    const session = checkout as Record<string, unknown>;
    if (typeof session.id !== 'string' || typeof session.state !== 'string') return null;
    const projected: Record<string, unknown> = { checkout: { id: session.id, state: session.state } };

    if (step === 'payment-intent') {
        const intent = record.payment_intent;
        if (!intent || typeof intent !== 'object' || Array.isArray(intent)) return null;
        const payment = intent as Record<string, unknown>;
        if (typeof payment.payment_intent_id !== 'string' || typeof payment.provider !== 'string' || typeof payment.status !== 'string') return null;
        projected.payment_intent = {
            payment_intent_id: payment.payment_intent_id,
            provider: payment.provider,
            status: payment.status,
            mode: typeof payment.mode === 'string' ? payment.mode : 'sandbox',
            ...(typeof payment.key_id === 'string' ? { key_id: payment.key_id } : {}),
            ...(typeof payment.provider_order_id === 'string' ? { provider_order_id: payment.provider_order_id } : {}),
            ...(Number.isSafeInteger(payment.amount_minor) ? { amount_minor: payment.amount_minor } : {}),
            ...(payment.currency === 'INR' ? { currency: payment.currency } : {}),
        };
    }

    if (step === 'confirm') {
        const order = record.order;
        if (!order || typeof order !== 'object' || Array.isArray(order)) return null;
        const row = order as Record<string, unknown>;
        if (typeof row.id !== 'string' || typeof row.order_number !== 'string') return null;
        projected.order = {
            id: row.id,
            orderNumber: row.order_number,
            status: typeof row.status === 'string' ? row.status : 'pending',
            total: typeof row.total === 'number' || typeof row.total === 'string' ? row.total : null,
        };
    }

    return { success: true, data: projected };
}

function projectFailure(status: number, payload: unknown) {
    if (status >= 500) return jsonError(503, 'CHECKOUT_UNAVAILABLE', 'Checkout is temporarily unavailable. Please try again.');
    const error = payload && typeof payload === 'object' ? (payload as { error?: unknown }).error : null;
    const detail = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : null;
    const code = typeof detail?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(detail.code) ? detail.code : 'CHECKOUT_REQUEST_FAILED';
    const safeMessages: Record<string, string> = {
        CHECKOUT_HANDOFF_INVALID: 'Checkout link is invalid or expired.',
        CHECKOUT_SETUP_REQUIRED: 'Secure checkout is not available in this environment.',
        INSUFFICIENT_INVENTORY: 'Some items are no longer available in that quantity. Review your cart and try again.',
        PAYMENT_SETUP_REQUIRED: 'Payment setup is required for this store.',
        CHECKOUT_STATE_CONFLICT: 'Checkout details changed. Refresh checkout and try again.',
        CHECKOUT_PRODUCT_CHANGED: 'Some products changed. Review the current items in your cart before checking out again.',
        CHECKOUT_SHIPPING_CHANGED: 'The delivery price changed. Review the updated delivery option and try again.',
        CHECKOUT_PROVIDER_PAYMENT_REQUIRED: 'Payment confirmation is required to complete checkout.',
        CHECKOUT_PROVIDER_SIGNATURE_INVALID: 'Payment could not be verified. Please try again or contact support.',
        CHECKOUT_PROVIDER_PAYMENT_REPLAYED: 'This payment cannot be used for this checkout.',
    };
    const message = safeMessages[code] || 'Checkout could not continue.';
    return jsonError(status, code, message);
}

export async function POST(request: NextRequest, context: { params: Promise<{ cartId: string; step: string }> }) {
    if (!isSameOriginRequest(request.headers, request.url)) return jsonError(403, 'ORIGIN_DENIED', 'Checkout request origin is not allowed.');
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return jsonError(415, 'JSON_REQUIRED', 'Checkout requests must use JSON.');
    const length = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(length) && length > 32_768) return jsonError(413, 'BODY_TOO_LARGE', 'Checkout request is too large.');

    const { cartId, step: rawStep } = await context.params;
    if (!UUID.test(cartId)) return jsonError(400, 'INVALID_CART', 'Checkout reference is invalid.');
    if (!Object.hasOwn(STEP_SCHEMAS, rawStep)) return jsonError(404, 'CHECKOUT_STEP_NOT_FOUND', 'Checkout step was not found.');
    const step = rawStep as CheckoutStep;

    const query = new URL(request.url).searchParams;
    const handoff = new URLSearchParams();
    for (const key of HANDOFF_KEYS) {
        const value = query.get(key);
        if (!value || value.length > 2048) return jsonError(400, 'CHECKOUT_HANDOFF_REQUIRED', 'Checkout handoff is incomplete.');
        handoff.set(key, value);
    }
    if (!UUID.test(handoff.get('site_id') || '')) return jsonError(400, 'CHECKOUT_HANDOFF_REQUIRED', 'Checkout handoff is incomplete.');

    const rawText = await request.text().catch(() => '');
    if (new TextEncoder().encode(rawText).byteLength > 32_768) return jsonError(413, 'BODY_TOO_LARGE', 'Checkout request is too large.');
    const rawBody = (() => { try { return JSON.parse(rawText) as unknown; } catch { return null; } })();
    const parsed = STEP_SCHEMAS[step].safeParse(rawBody);
    if (!parsed.success) return jsonError(400, 'CHECKOUT_VALIDATION_FAILED', 'Checkout details are invalid.');

    let upstream: Response;
    try {
        upstream = await storefrontApiFetch(`/checkout/${encodeURIComponent(cartId)}/${step}?${handoff.toString()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data),
            cache: 'no-store',
        });
    } catch {
        return jsonError(503, 'CHECKOUT_UNAVAILABLE', 'Checkout is temporarily unavailable. Please try again.');
    }

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) return projectFailure(upstream.status, payload);
    const projected = projectSuccess(step, payload);
    if (!projected) return jsonError(503, 'CHECKOUT_RESPONSE_INVALID', 'Checkout is temporarily unavailable. Please try again.');
    return NextResponse.json(projected, { status: upstream.status, headers: NO_STORE });
}
