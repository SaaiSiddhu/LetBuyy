// POST /api/customer/logout — Clear session cookie
//
// CSRF hardening (Phase F): logout is a state-mutating POST. SameSite=lax on the session
// cookie blocks most cross-origin POSTs, but SameSite=lax DOES allow cookies on top-level
// cross-site POST navigations (e.g., a cross-origin <form method="post">). To close that
// window we verify the Origin header: only requests from the same host may trigger logout.
// Browsers always send Origin on cross-site POSTs. Same-site form submissions and fetch()
// calls from the store's own origin are always allowed; the no-JS <form> fallback works
// because it posts same-origin.
import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

function isAllowedOrigin(req: NextRequest): boolean {
    const origin = req.headers.get('origin');
    // No Origin header: same-origin fetch/form in older browsers — allow.
    // (Browsers omit Origin on same-origin navigations; an attacker cannot suppress it on
    // a cross-origin POST without CORS cooperation, which we do not grant.)
    if (!origin) return true;

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    try {
        const originHost = new URL(origin).host;
        // Allow if the origin's host matches the request host (same-origin or same-site subdomain
        // where the host header is the store's own subdomain, e.g. mystore.letbuyy.com).
        if (originHost === host) return true;
        // Also allow the root domain itself (identity-platform, merchant panel calling logout
        // on behalf of same tenant — not currently wired but safe to permit).
        const rootDomain = process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN || '';
        if (rootDomain && (originHost === rootDomain || originHost.endsWith(`.${rootDomain}`))) return true;
    } catch {
        // Malformed Origin — deny.
    }
    return false;
}

export async function POST(req: NextRequest) {
    // CSRF guard: reject cross-origin logout attempts.
    if (!isAllowedOrigin(req)) {
        return NextResponse.json({ error: 'CSRF_REJECTED' }, { status: 403 });
    }

    try {
        await clearSession();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] /customer/logout error:', error);
        return NextResponse.json(
            { error: 'Logout failed' },
            { status: 500 }
        );
    }
}
