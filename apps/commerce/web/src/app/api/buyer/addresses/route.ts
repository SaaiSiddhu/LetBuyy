// GET/POST /api/buyer/addresses — the signed-in buyer's own cross-store address book (D2,
// SUSTAINED-J). A thin gateway proxy, same pattern as ../profile/route.ts: the buyer's own token
// from __Host-lb_store_buyer is sufficient authorization, forwarded as-is to GET/POST
// /storefront/buyer/addresses. Never the store_customers-scoped /api/customer/addresses, a
// separate, already-complete, per-store address book left untouched.
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
        res = await storefrontApiFetch('/storefront/buyer/addresses', {
            method: 'GET',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your addresses could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    }
    if (res.status === 401) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
    if (!res.ok) return NextResponse.json({ error: 'Your addresses could not be loaded right now.' }, { status: 503, headers: NO_STORE });

    const payload = await res.json().catch(() => null) as { data?: { addresses?: unknown[] } } | null;
    return NextResponse.json({ addresses: payload?.data?.addresses ?? [] }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
    const token = buyerToken(request);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'A JSON body is required' }, { status: 400, headers: NO_STORE });

    let res: Response;
    try {
        res = await storefrontApiFetch('/storefront/buyer/addresses', {
            method: 'POST',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
            body: JSON.stringify(body),
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your address could not be saved right now.' }, { status: 503, headers: NO_STORE });
    }
    if (res.status === 401) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
    if (!res.ok) {
        const failure = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        // The gateway's message is user-facing for a client error; a 5xx body is never relayed (see ../profile/route.ts).
        const relayed = res.status < 500 ? failure?.error?.message : undefined;
        return NextResponse.json({ error: relayed ?? 'Your address could not be saved right now.' }, { status: res.status === 400 ? 400 : 503, headers: NO_STORE });
    }

    const payload = await res.json().catch(() => null) as { data?: { address?: unknown } } | null;
    return NextResponse.json({ address: payload?.data?.address ?? null }, { status: 201, headers: NO_STORE });
}
