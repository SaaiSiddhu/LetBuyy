import { NextRequest, NextResponse } from 'next/server';
import { STOREFRONT_BUYER_SESSION_COOKIE, isSameOriginRequest, safeReturnTo } from '@/lib/buyer-auth/flow';

/**
 * POST /api/buyer-auth/logout — sign out of LetBuyy at THIS store (APPID-P4c).
 *
 * Application logout: the store's session cookie goes, and nothing else. The buyer stays signed in
 * to identity-platform and at other stores; ending every session is sign-out-everywhere, at
 * identity-platform. Accepted only from this store's own pages. A form post is sent back to
 * `return_to`; a script gets JSON.
 */
export async function POST(request: NextRequest) {
    if (!isSameOriginRequest(request.headers)) {
        return NextResponse.json({ error: 'Invalid request. Please refresh and try again.' }, { status: 403 });
    }

    const wantsJson = (request.headers.get('accept') || '').includes('application/json');
    const response = wantsJson
        ? NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
        : NextResponse.redirect(new URL(safeReturnTo(request.nextUrl.searchParams.get('return_to')), request.url), 303);
    response.cookies.set(STOREFRONT_BUYER_SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
}
