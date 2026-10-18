import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_STOREFRONT_PREVIEW_COOKIE } from '@letbuyy/auth-core';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { StorefrontCreateOrderSchema } from '@letbuyy/checkout-core';
import { createStorefrontApiClient, StorefrontApiRequestError, storefrontApiFetch } from '@/lib/api/client';
import { STOREFRONT_BUYER_SESSION_COOKIE, decodeSession } from '@/lib/buyer-auth/flow';

const HANDOFF_KEYS = ['site_id', 'cart_token', 'expires_at', 'cart_digest', 'signature', 'channel'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VerifiedCartLine = { product_id?: unknown; variant_id?: unknown; quantity?: unknown };

function sameCartLines(requestItems: unknown, signedLines: unknown): boolean {
    if (!Array.isArray(requestItems) || !Array.isArray(signedLines) || requestItems.length !== signedLines.length) return false;
    const normalize = (rows: unknown[], fromCart: boolean) => rows.map((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const row = value as Record<string, unknown>;
        const productId = fromCart ? row.product_id : row.productId;
        const variantId = fromCart ? row.variant_id : row.variantId;
        if (typeof productId !== 'string' || !UUID.test(productId) || !Number.isSafeInteger(row.quantity) || Number(row.quantity) < 1) return null;
        if (variantId !== null && variantId !== undefined && (typeof variantId !== 'string' || !UUID.test(variantId))) return null;
        return `${productId}:${variantId || ''}:${row.quantity}`;
    });
    const requested = normalize(requestItems, false);
    const signed = normalize(signedLines, true);
    if (requested.some((line) => line === null) || signed.some((line) => line === null)) return false;
    requested.sort();
    signed.sort();
    return requested.every((line, index) => line === signed[index]);
}

function safeFailure(status: number, message: string) {
    return NextResponse.json({ success: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function getStorefrontApiErrorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error;
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message;
            if (typeof message === 'string') return message;
        }
        const message = (payload as { message?: unknown }).message;
        if (typeof message === 'string') return message;
    }

    return fallback;
}

export async function POST(request: NextRequest) {
    try {
        if (request.headers.get('origin') !== request.nextUrl.origin) return safeFailure(403, 'Checkout request origin is not allowed');
        const previewCheckoutMode = request.headers.get('x-letbuyy-preview-checkout-mode')
            || request.cookies.get(LETBUYY_STOREFRONT_PREVIEW_COOKIE)?.value;
        if (previewCheckoutMode) {
            return NextResponse.json(
                { success: false, error: 'Preview checkout uses sandbox mode and cannot create real orders' },
                { status: 409 }
            );
        }

        const contentLength = Number(request.headers.get('content-length') || 0);
        if (Number.isFinite(contentLength) && contentLength > 32_768) return safeFailure(413, 'Checkout request is too large');
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return safeFailure(415, 'Checkout requests must use JSON');
        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > 32_768) return safeFailure(413, 'Checkout request is too large');
        let body: Record<string, unknown>;
        try {
            const parsed = JSON.parse(rawBody) as unknown;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return safeFailure(400, 'Checkout details are invalid');
            body = parsed as Record<string, unknown>;
        } catch {
            return safeFailure(400, 'Checkout details are invalid');
        }

        const parsedOrder = StorefrontCreateOrderSchema.safeParse(body);
        if (!parsedOrder.success) return safeFailure(400, 'Checkout details are invalid');
        const orderInput = parsedOrder.data;

        const subdomain = typeof body.subdomain === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(body.subdomain)
            ? body.subdomain
            : '';
        const items = orderInput.items;
        const idempotencyKey = orderInput.idempotencyKey;

        if (!subdomain || !items || !idempotencyKey) {
            return safeFailure(400, 'Missing required fields');
        }

        // Verify the original cart-bound HMAC with the same gateway verifier used by every hosted
        // checkout state-machine step. The browser cannot substitute line items or a store handle.
        const cartId = typeof body.cartId === 'string' ? body.cartId : '';
        const handoff = body.handoff && typeof body.handoff === 'object' && !Array.isArray(body.handoff)
            ? body.handoff as Record<string, unknown>
            : null;
        if (!UUID.test(cartId) || !handoff) return safeFailure(401, 'A valid secure checkout handoff is required');
        const handoffQuery = new URLSearchParams();
        for (const key of HANDOFF_KEYS) {
            const value = handoff[key];
            if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return safeFailure(401, 'A valid secure checkout handoff is required');
            handoffQuery.set(key, value);
        }
        if (!UUID.test(handoffQuery.get('site_id') || '')) return safeFailure(401, 'A valid secure checkout handoff is required');

        let handoffResponse: Response;
        try {
            handoffResponse = await storefrontApiFetch(`/checkout/${encodeURIComponent(cartId)}/verify-handoff?${handoffQuery}`, { cache: 'no-store' });
        } catch {
            return safeFailure(503, 'Checkout is temporarily unavailable');
        }
        if (handoffResponse.status === 401 || handoffResponse.status === 400) return safeFailure(401, 'Checkout handoff is invalid or expired');
        if (!handoffResponse.ok) return safeFailure(503, 'Checkout is temporarily unavailable');
        const verification = await handoffResponse.json().catch(() => null) as { data?: Record<string, unknown> } | null;
        const signedCart = verification?.data;
        if (!signedCart
            || signedCart.cart_id !== cartId
            || signedCart.site_id !== handoffQuery.get('site_id')
            || signedCart.subdomain !== subdomain
            || !sameCartLines(items, signedCart.lines)) {
            return safeFailure(409, 'Checkout cart changed. Return to the store and try again');
        }
        const submittedCoupon = typeof orderInput.couponCode === 'string' ? orderInput.couponCode.trim().toUpperCase() : '';
        const signedCoupon = typeof signedCart.coupon_code === 'string' ? signedCart.coupon_code.trim().toUpperCase() : '';
        if (submittedCoupon !== signedCoupon) return safeFailure(409, 'Apply discounts to your cart before checkout');

        const buyerCookie = request.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value;
        let buyerSession: { siteId: string; token: string } | null = null;
        if (buyerCookie !== undefined) {
            buyerSession = decodeSession(buyerCookie);
            if (!buyerSession) return safeFailure(401, 'Your sign-in could not be checked. Please sign in again');
            if (buyerSession.siteId.toLowerCase() !== String(signedCart.site_id).toLowerCase()) {
                return safeFailure(401, 'Your sign-in does not belong to this store');
            }
        }

        const payload = await createStorefrontApiClient().storefront.createOrder(String(signedCart.subdomain), {
            customer: orderInput.customer,
            items,
            paymentMethod: orderInput.paymentMethod || 'razorpay',
            deliveryOption: orderInput.deliveryOption || 'standard',
            notes: orderInput.notes,
            couponCode: orderInput.couponCode,
            giftCardCode: orderInput.giftCardCode,
            shippingRateId: orderInput.shippingRateId || null,
            shippingAmountMinor: orderInput.shippingAmountMinor ?? null,
            idempotencyKey,
        }, buyerSession ? { headers: { [LETBUYY_STOREFRONT_SESSION_HEADER]: buyerSession.token } } : undefined);
        const order = payload.order;

        if (!order) {
            return NextResponse.json(
                { success: false, error: 'Order creation failed' },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success: true,
            order,
        }, { status: 201, headers: { 'Cache-Control': 'no-store' } });

    } catch (error) {
        if (error instanceof StorefrontApiRequestError) {
            if (error.status >= 500) return safeFailure(503, 'Order creation is temporarily unavailable');
            return NextResponse.json(
                {
                    success: false,
                    error: getStorefrontApiErrorMessage(error.payload, error.message),
                },
                { status: error.status, headers: { 'Cache-Control': 'no-store' } }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Failed to create order' },
            { status: 500 }
        );
    }
}
