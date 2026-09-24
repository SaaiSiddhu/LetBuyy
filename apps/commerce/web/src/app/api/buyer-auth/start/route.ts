import { NextRequest, NextResponse } from 'next/server';
import {
    STOREFRONT_BUYER_FLOW_COOKIE,
    STOREFRONT_BUYER_FLOW_TTL_SECONDS,
    authorizeUrl,
    createPkcePair,
    encodeFlow,
    identityOrigin,
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
export async function GET(request: NextRequest) {
    const redirectUri = storefrontCallbackUrl(request.headers.get('x-forwarded-host') || request.headers.get('host'));
    if (!redirectUri) {
        return new NextResponse('Sign-in is not available on this address.', { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const returnTo = safeReturnTo(request.nextUrl.searchParams.get('return_to'));
    const state = randomToken();
    const { verifier, challenge } = await createPkcePair();

    const response = NextResponse.redirect(authorizeUrl(identityOrigin(), { redirectUri, state, challenge }), 303);
    response.cookies.set(STOREFRONT_BUYER_FLOW_COOKIE, encodeFlow({ state, verifier, returnTo, redirectUri }), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: STOREFRONT_BUYER_FLOW_TTL_SECONDS,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
}
