import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_STOREFRONT_CLIENT_ID } from '@letbuyy/auth-core';
import { resolveStorefrontAccessContext } from '@/lib/storefront-access';
import {
    STOREFRONT_BUYER_FLOW_COOKIE,
    STOREFRONT_BUYER_SESSION_COOKIE,
    decodeFlow,
    encodeSession,
    identityOrigin,
    statesMatch,
    storefrontCallbackUrl,
} from '@/lib/buyer-auth/flow';

/**
 * GET /api/buyer-auth/callback — finish signing a buyer in (APPID-P4c).
 *
 * identity-platform sends the buyer here with a code and the state this store made. The state must
 * match the one in this host's flow cookie (constant-time), the callback must be the one the flow
 * started with, and the code is exchanged with the flow's PKCE verifier server to server. The
 * session goes into a __Host- HttpOnly cookie on this host. The flow cookie is cleared whatever
 * happens, so a flow finishes once.
 *
 * A failure is shown on a plain page rather than sent back into the flow: an automatic retry would
 * loop between this store and identity-platform for as long as whatever failed stays broken.
 */
function failure(message: string): NextResponse {
    const response = new NextResponse(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
        + `<meta name="robots" content="noindex"><title>Sign-in did not finish</title></head>`
        + `<body style="font-family: system-ui, sans-serif; max-width: 28rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5">`
        + `<h1 style="font-size: 1.25rem">Sign-in did not finish</h1><p>${message}</p><p><a href="/">Back to the store</a></p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
    response.cookies.set(STOREFRONT_BUYER_FLOW_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
}

export async function GET(request: NextRequest) {
    const flow = decodeFlow(request.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE)?.value);
    if (!flow) return failure('This sign-in took too long or was started in another browser. Choose sign in again.');

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const thisCallback = storefrontCallbackUrl(request.headers.get('x-forwarded-host') || request.headers.get('host'));
    if (!code || !state || !statesMatch(flow.state, state) || thisCallback !== flow.redirectUri) {
        return failure('This sign-in link does not belong to the sign-in you started here. Choose sign in again.');
    }

    let exchanged: { access_token?: unknown; expires_in?: unknown; site_id?: unknown } | null = null;
    try {
        const res = await fetch(new URL('/api/buyer/oauth/token', identityOrigin()), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                code_verifier: flow.verifier,
                client_id: LETBUYY_STOREFRONT_CLIENT_ID,
                redirect_uri: flow.redirectUri,
            }).toString(),
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
        });
        exchanged = res.ok ? await res.json().catch(() => null) : null;
    } catch {
        exchanged = null;
    }

    const token = typeof exchanged?.access_token === 'string' ? exchanged.access_token : null;
    const siteId = typeof exchanged?.site_id === 'string' ? exchanged.site_id : null;
    const expiresIn = typeof exchanged?.expires_in === 'number' ? exchanged.expires_in : null;
    if (!token || !siteId || !expiresIn) {
        return failure('We could not confirm your LetBuyy sign-in. Choose sign in again.');
    }

    // The session must be for the store THIS host serves. The gateway already bound the code to the
    // callback's host, and the callback was checked above; this is the server-resolved confirmation.
    let hostStoreId: string | null = null;
    try {
        hostStoreId = (await resolveStorefrontAccessContext(request.headers.get('x-forwarded-host') || request.headers.get('host') || ''))?.site_id ?? null;
    } catch {
        hostStoreId = null;
    }
    if (!hostStoreId || hostStoreId.toLowerCase() !== siteId.toLowerCase()) {
        return failure('We could not confirm your LetBuyy sign-in for this store. Choose sign in again.');
    }

    const response = NextResponse.redirect(new URL(flow.returnTo, flow.redirectUri), 303);
    response.cookies.set(STOREFRONT_BUYER_FLOW_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    response.cookies.set(STOREFRONT_BUYER_SESSION_COOKIE, encodeSession(siteId, token), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: expiresIn,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
}
