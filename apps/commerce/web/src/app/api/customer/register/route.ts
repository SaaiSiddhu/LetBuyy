// POST /api/customer/register — compatibility bridge to the canonical buyer sign-in flow.
import { NextRequest, NextResponse } from 'next/server';

// Prefer the store-prefixed account route when this compatibility handler receives a stale Liquid form.
// Only accept a referer from this exact storefront origin; otherwise fall back to the host's /account.
function accountRedirectUrl(request: NextRequest): URL {
    const referer = request.headers.get('referer');
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            if (refererUrl.origin === new URL(request.url).origin) {
                const storeMatch = refererUrl.pathname.match(/^\/store\/[^/]+/);
                if (storeMatch) return new URL(`${storeMatch[0]}/account`, request.url);
            }
        } catch { /* fall through to the bare default below */ }
    }
    return new URL('/account', request.url);
}

export async function POST(request: NextRequest) {
    if ((request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded')
        || (request.headers.get('content-type') || '').includes('multipart/form-data')) {
        const redirectTo = new URL('/api/buyer-auth/start', request.url);
        redirectTo.searchParams.set('return_to', accountRedirectUrl(request).pathname);
        redirectTo.searchParams.set('screen', 'register');
        const response = NextResponse.redirect(redirectTo, 303);
        response.headers.set('Cache-Control', 'no-store');
        return response;
    }

    return NextResponse.json({
        error: 'Storefront account creation has moved to the canonical LetBuyy buyer identity.',
        code: 'CANONICAL_BUYER_ACCOUNT_REQUIRED',
        sign_in_path: '/api/buyer-auth/start',
    }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
