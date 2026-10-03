// GET/PATCH /api/buyer/profile — the signed-in buyer's own cross-store profile (D1, SUSTAINED-J).
//
// The host-only storefront cookie is forwarded under its storefront audience, with
// the host-resolved site. The gateway validates the signed site and live account,
// then reads the same canonical buyer profile used by the marketplace.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;

    let res: Response;
    try {
        res = await storefrontApiFetch(`/storefront/buyer/profile?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'GET',
            headers: session.headers,
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your profile could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    }
    if (res.status === 401) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
    if (!res.ok) return NextResponse.json({ error: 'Your profile could not be loaded right now.' }, { status: 503, headers: NO_STORE });

    const payload = await res.json().catch(() => null) as { data?: { buyer?: unknown } } | null;
    return NextResponse.json({ buyer: payload?.data?.buyer ?? null }, { headers: NO_STORE });
}

export async function PATCH(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;

    const body = await request.json().catch(() => null) as { fullName?: unknown; phone?: unknown } | null;
    if (!body) return NextResponse.json({ error: 'A JSON body is required' }, { status: 400, headers: NO_STORE });

    // Allowlisted here too, not just at the gateway: defence in depth, and it keeps this file's
    // own contract explicit about what a caller of THIS route may change.
    const update: Record<string, unknown> = {};
    if ('fullName' in body) update.full_name = body.fullName;
    if ('phone' in body) update.phone = body.phone;
    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'fullName or phone is required' }, { status: 400, headers: NO_STORE });
    }

    let res: Response;
    try {
        res = await storefrontApiFetch(`/storefront/buyer/profile?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'PATCH',
            headers: session.headers,
            body: JSON.stringify(update),
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your profile could not be updated right now.' }, { status: 503, headers: NO_STORE });
    }
    if (res.status === 401) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
    if (!res.ok) {
        const failure = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        // The gateway's message is user-facing for a client error. A 5xx body is the gateway's own failure: the status
        // is already generalised to 503 below, and so is the message, so nothing internal can reach the browser.
        const relayed = res.status < 500 ? failure?.error?.message : undefined;
        return NextResponse.json({ error: relayed ?? 'Your profile could not be updated right now.' }, { status: res.status === 400 ? 400 : 503, headers: NO_STORE });
    }

    const payload = await res.json().catch(() => null) as { data?: { buyer?: unknown } } | null;
    return NextResponse.json({ buyer: payload?.data?.buyer ?? null }, { headers: NO_STORE });
}
