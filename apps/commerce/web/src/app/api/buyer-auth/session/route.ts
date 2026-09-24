import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveStorefrontAccessContext } from '@/lib/storefront-access';
import { STOREFRONT_BUYER_SESSION_COOKIE, decodeSession } from '@/lib/buyer-auth/flow';

/**
 * GET /api/buyer-auth/session — who is signed in with LetBuyy at this store (APPID-P4c).
 *
 * Asked by the storefront's own pages. The store is the one THIS HOST serves, resolved on the
 * server, never the one the cookie names: a cookie issued for another store is no session here.
 * The gateway then decides: it accepts the session only for the site it was issued for, only
 * through this server's signed internal request, and only in the account's current session epoch.
 * A session this store or the gateway refuses is cleared.
 */
const NO_STORE = { 'Cache-Control': 'no-store' };

function signedOut(clear: boolean): NextResponse {
    const response = NextResponse.json({ buyer: null }, { headers: NO_STORE });
    if (clear) {
        response.cookies.set(STOREFRONT_BUYER_SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    }
    return response;
}

export async function GET(request: NextRequest) {
    const cookie = request.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value;
    const session = decodeSession(cookie);
    if (!session) return signedOut(Boolean(cookie));

    let storeId: string;
    try {
        const site = await resolveStorefrontAccessContext(request.headers.get('x-forwarded-host') || request.headers.get('host') || '');
        if (!site) return signedOut(true);
        storeId = site.site_id;
    } catch {
        return NextResponse.json({ error: 'Your sign-in could not be checked right now.' }, { status: 503, headers: NO_STORE });
    }
    if (session.siteId.toLowerCase() !== storeId.toLowerCase()) return signedOut(true);

    let res: Response;
    try {
        res = await storefrontApiFetch(`/storefront/buyer/storefront-session?store_id=${encodeURIComponent(storeId)}`, {
            method: 'GET',
            headers: { [LETBUYY_STOREFRONT_SESSION_HEADER]: session.token },
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your sign-in could not be checked right now.' }, { status: 503, headers: NO_STORE });
    }

    if (res.status === 401 || res.status === 403) return signedOut(true);
    if (!res.ok) return NextResponse.json({ error: 'Your sign-in could not be checked right now.' }, { status: 503, headers: NO_STORE });

    const payload = await res.json().catch(() => null) as { data?: { buyer?: { email?: string; email_verified?: boolean } | null } | null } | null;
    const buyer = payload?.data?.buyer;
    if (!buyer?.email) return signedOut(true);
    return NextResponse.json({ buyer: { email: buyer.email, emailVerified: Boolean(buyer.email_verified) } }, { headers: NO_STORE });
}
