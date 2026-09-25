// GET/PATCH /api/buyer/profile — the signed-in buyer's own cross-store profile (D1, SUSTAINED-J).
//
// A thin gateway proxy (Constitution: "New app API routes are gateway proxies") — every decision
// about who the buyer is and what full_name/phone means to the account happens at the gateway's
// GET/PATCH /storefront/buyer/profile, gated by requireBuyerSession alone (no internal-app
// signature: the buyer's own token, read from the SAME __Host-lb_store_buyer cookie the existing
// buyer-auth session route already reads, is sufficient authorization for the buyer's own data).
// Never the store_customers-scoped /api/customer/profile: that is a separate, already-complete,
// per-store realm (D-ONE-BUYER), left untouched by this file.
import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core';
import { storefrontApiFetch } from '@/lib/api/client';
import { STOREFRONT_BUYER_SESSION_COOKIE, decodeSession } from '@/lib/buyer-auth/flow';

const NO_STORE = { 'Cache-Control': 'no-store' };

function buyerToken(request: NextRequest): string | null {
    const cookie = request.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value;
    return decodeSession(cookie)?.token ?? null;
}

export async function GET(request: NextRequest) {
    const token = buyerToken(request);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });

    let res: Response;
    try {
        res = await storefrontApiFetch('/storefront/buyer/profile', {
            method: 'GET',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
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
    const token = buyerToken(request);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });

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
        res = await storefrontApiFetch('/storefront/buyer/profile', {
            method: 'PATCH',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
            body: JSON.stringify(update),
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your profile could not be updated right now.' }, { status: 503, headers: NO_STORE });
    }
    if (res.status === 401) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
    if (!res.ok) {
        const failure = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        return NextResponse.json({ error: failure?.error?.message ?? 'Your profile could not be updated right now.' }, { status: res.status === 400 ? 400 : 503, headers: NO_STORE });
    }

    const payload = await res.json().catch(() => null) as { data?: { buyer?: unknown } } | null;
    return NextResponse.json({ buyer: payload?.data?.buyer ?? null }, { headers: NO_STORE });
}
