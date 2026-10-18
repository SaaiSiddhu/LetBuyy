import { NextRequest, NextResponse } from 'next/server';
import {
    STOREFRONT_BUYER_FLOW_COOKIE,
    STOREFRONT_BUYER_FLOW_TTL_SECONDS,
    authorizeUrl,
    createPkcePair,
    encodeFlow,
    identityOrigin,
    isSameOriginRequest,
    randomToken,
    safeReturnTo,
    storefrontCallbackUrl,
} from '@/lib/buyer-auth/flow';

/**
 * GET /api/buyer-auth/start — begin signing a buyer in with their LetBuyy account (APPID-P4c).
 *
 * Makes a state value and a PKCE verifier, keeps both (and where to return to) in a __Host- cookie on
 * this store's host, and sends the buyer to identity-platform. identity-platform only continues if the
 * gateway agrees this host is a published store's primary host.
 */
async function start(request: NextRequest, linkStoreCustomer = false, requestedReturnTo?: string | null, jsonResponse = false, screen?: 'register') {
    const redirectUri = storefrontCallbackUrl(request.headers.get('x-forwarded-host') || request.headers.get('host'));
    if (!redirectUri) {
        return new NextResponse('Sign-in is not available on this address.', { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const returnTo = safeReturnTo(requestedReturnTo ?? request.nextUrl.searchParams.get('return_to'));
    const state = randomToken();
    const { verifier, challenge } = await createPkcePair();

    const redirectTo = authorizeUrl(identityOrigin(), { redirectUri, state, challenge, screen });
    const response = jsonResponse
        ? NextResponse.json({ redirectTo: redirectTo.toString() }, { headers: { 'Cache-Control': 'no-store' } })
        : NextResponse.redirect(redirectTo, 303);
    response.cookies.set(STOREFRONT_BUYER_FLOW_COOKIE, encodeFlow({
        state, verifier, returnTo, redirectUri,
        ...(linkStoreCustomer ? { linkStoreCustomer: true } : {}),
    }), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: STOREFRONT_BUYER_FLOW_TTL_SECONDS,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

export async function GET(request: NextRequest) {
    const screen = request.nextUrl.searchParams.get('screen') === 'register' ? 'register' : undefined;
    return start(request, false, null, false, screen);
}

/** Explicit account action: require a same-origin POST so a cross-site visit cannot create a link flow. */
export async function POST(request: NextRequest) {
    if (!isSameOriginRequest(request.headers, request.url)) {
        return new NextResponse('This request could not be verified.', { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }
    const form = await request.formData().catch(() => null);
    // `intent` is used by Liquid forms because the HTML sanitizer strips name="action" to prevent
    // DOM clobbering. Keep `action` as a compatibility input for existing React/account forms.
    if (form?.get('action') !== 'link_store_customer' && form?.get('intent') !== 'link_store_customer') {
        return new NextResponse('This request could not be verified.', { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const returnTo = form?.get('return_to');
    const wantsJson = request.headers.get('accept')?.split(',').some((value) => value.trim().startsWith('application/json')) ?? false;
    return start(request, true, typeof returnTo === 'string' ? returnTo : null, wantsJson);
}
