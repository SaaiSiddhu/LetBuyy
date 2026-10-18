// Storefront loyalty balance for the buyer session issued to this exact store origin.
// Store/site and buyer identity are derived from signed/server state, never request fields.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';

const NO_STORE = { 'Cache-Control': 'no-store' };
const unavailable = (status = 503) => NextResponse.json({ error: 'Your rewards balance is unavailable right now.' }, { status, headers: NO_STORE });

function exactPoints(value: unknown): string | null {
    if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
    return typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) ? value : null;
}

export async function GET(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;

    let response: Response;
    try {
        response = await storefrontApiFetch(`/storefront/buyer/storefront-loyalty?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'GET', headers: session.headers, cache: 'no-store',
        });
    } catch {
        return unavailable();
    }
    if (response.status === 401 || response.status === 403) return unavailable(401);
    if (!response.ok) return unavailable();

    const payload = await response.json().catch(() => null) as { data?: Record<string, unknown> } | null;
    const data = payload?.data;
    if (!data || data.site_id !== session.siteId || typeof data.enrolled !== 'boolean') return unavailable();
    if (!data.enrolled) {
        if (data.balance !== null) return unavailable();
        return NextResponse.json({ enrolled: false, balance: null }, { headers: NO_STORE });
    }

    const balance = exactPoints(data.balance);
    if (balance === null || typeof data.is_active !== 'boolean') return unavailable();
    return NextResponse.json({ enrolled: true, balance, programActive: data.is_active }, { headers: NO_STORE });
}
