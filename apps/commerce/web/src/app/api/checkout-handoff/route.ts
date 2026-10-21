// Bridges the store-host's HttpOnly buyer session to the hosted checkout database binding.
// The buyer bearer remains server-to-server; only the ordinary signed cart handoff leaves this host.
import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { isHostedCheckoutHost } from '@letbuyy/tenant-core';
import { storefrontApiFetch } from '@/lib/api/client';
import { isSameOriginRequest, STOREFRONT_BUYER_SESSION_COOKIE, decodeSession } from '@/lib/buyer-auth/flow';

const NO_STORE = { 'Cache-Control': 'no-store' };
const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const CART_TOKEN = /^ct_[A-Za-z0-9]{16,80}$/;

function allowedCheckoutUrl(url: URL): boolean {
    const hostname = url.hostname;
    if (process.env.CHECKOUT_ORIGIN?.trim()) {
        try { if (url.origin !== new URL(process.env.CHECKOUT_ORIGIN.trim()).origin) return false; }
        catch { return false; }
    }
    if (isHostedCheckoutHost(hostname, {
        checkoutOrigin: process.env.CHECKOUT_ORIGIN,
        storeRootDomain: process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN,
    })) return true;
    return process.env.NODE_ENV !== 'production' && (hostname === 'localhost' || hostname.endsWith('.localhost'));
}

export async function POST(request: NextRequest) {
    if (!isSameOriginRequest(request.headers, request.url)) {
        return NextResponse.json({ error: 'Checkout request origin is not allowed.' }, { status: 403, headers: NO_STORE });
    }
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        return NextResponse.json({ error: 'Checkout details are invalid.' }, { status: 415, headers: NO_STORE });
    }
    const length = Number(request.headers.get('content-length') || 0);
    if (Number.isFinite(length) && length > 4096) return NextResponse.json({ error: 'Checkout details are invalid.' }, { status: 413, headers: NO_STORE });
    const text = await request.text().catch(() => '');
    if (new TextEncoder().encode(text).byteLength > 4096) return NextResponse.json({ error: 'Checkout details are invalid.' }, { status: 413, headers: NO_STORE });
    const body = (() => { try { return JSON.parse(text) as unknown; } catch { return null; } })();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Checkout details are invalid.' }, { status: 400, headers: NO_STORE });
    const { subdomain, cartToken, ...extra } = body as Record<string, unknown>;
    if (Object.keys(extra).length || typeof subdomain !== 'string' || !SUBDOMAIN.test(subdomain)
        || typeof cartToken !== 'string' || !CART_TOKEN.test(cartToken)) {
        return NextResponse.json({ error: 'Checkout details are invalid.' }, { status: 400, headers: NO_STORE });
    }

    const cookie = request.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value;
    const session = cookie === undefined ? null : decodeSession(cookie);
    if (cookie !== undefined && !session) return NextResponse.json({ error: 'Please sign in again before checkout.' }, { status: 401, headers: NO_STORE });

    let upstream: Response;
    try {
        upstream = await storefrontApiFetch(`/storefront/${encodeURIComponent(subdomain)}/cart/${encodeURIComponent(cartToken)}/checkout-url`, {
            method: 'POST',
            ...(session ? { headers: { [LETBUYY_STOREFRONT_SESSION_HEADER]: session.token } } : {}),
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
        });
    } catch {
        return NextResponse.json({ error: 'Secure checkout is temporarily unavailable.' }, { status: 503, headers: NO_STORE });
    }
    if (!upstream.ok) {
        const status = upstream.status === 401 || upstream.status === 403 || upstream.status === 409 ? upstream.status : 503;
        const message = status === 409 ? 'This checkout cannot be linked to the current account.'
            : status === 401 ? 'Please sign in again before checkout.'
                : 'Secure checkout is temporarily unavailable.';
        return NextResponse.json({ error: message }, { status, headers: NO_STORE });
    }
    const payload = await upstream.json().catch(() => null) as { data?: { checkout_url?: unknown } } | null;
    if (typeof payload?.data?.checkout_url !== 'string') return NextResponse.json({ error: 'Secure checkout is temporarily unavailable.' }, { status: 503, headers: NO_STORE });
    let checkoutUrl: URL;
    try { checkoutUrl = new URL(payload.data.checkout_url); } catch { return NextResponse.json({ error: 'Secure checkout is temporarily unavailable.' }, { status: 503, headers: NO_STORE }); }
    if (!['https:', ...(process.env.NODE_ENV === 'production' ? [] : ['http:'])].includes(checkoutUrl.protocol)
        || checkoutUrl.username || checkoutUrl.password || checkoutUrl.hash || !allowedCheckoutUrl(checkoutUrl)
        || checkoutUrl.pathname !== '/checkout') {
        return NextResponse.json({ error: 'Secure checkout is temporarily unavailable.' }, { status: 503, headers: NO_STORE });
    }
    return NextResponse.json({ checkout_url: checkoutUrl.toString() }, { headers: NO_STORE });
}
