// PATCH/DELETE /api/buyer/addresses/:id — edit or remove one of the signed-in buyer's own
// cross-store addresses (D2, SUSTAINED-J). Same gateway-proxy pattern as ../route.ts; the address
// id in the URL is only ever forwarded, never trusted to belong to the caller here -- the gateway's
// own .eq('buyer_account_id', ...) predicate (buyer-address-routes.ts) is what actually enforces
// ownership and answers 404 for another buyer's address.
import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core';
import { storefrontApiFetch } from '@/lib/api/client';
import { STOREFRONT_BUYER_SESSION_COOKIE, decodeSession } from '@/lib/buyer-auth/flow';

const NO_STORE = { 'Cache-Control': 'no-store' };

function buyerToken(request: NextRequest): string | null {
    const cookie = request.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value;
    return decodeSession(cookie)?.token ?? null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = buyerToken(request);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'A JSON body is required' }, { status: 400, headers: NO_STORE });

    let res: Response;
    try {
        res = await storefrontApiFetch(`/storefront/buyer/addresses/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
            body: JSON.stringify(body),
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your address could not be updated right now.' }, { status: 503, headers: NO_STORE });
    }
    if (res.status === 401) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
    if (res.status === 404) return NextResponse.json({ error: 'Address not found.' }, { status: 404, headers: NO_STORE });
    if (!res.ok) {
        const failure = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        // The gateway's message is user-facing for a client error; a 5xx body is never relayed (see ../../profile/route.ts).
        const relayed = res.status < 500 ? failure?.error?.message : undefined;
        return NextResponse.json({ error: relayed ?? 'Your address could not be updated right now.' }, { status: res.status === 400 ? 400 : 503, headers: NO_STORE });
    }

    const payload = await res.json().catch(() => null) as { data?: { address?: unknown } } | null;
    return NextResponse.json({ address: payload?.data?.address ?? null }, { headers: NO_STORE });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = buyerToken(request);
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });

    const { id } = await params;

    let res: Response;
    try {
        res = await storefrontApiFetch(`/storefront/buyer/addresses/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { [LETBUYY_BUYER_SESSION_HEADER]: token },
            cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your address could not be deleted right now.' }, { status: 503, headers: NO_STORE });
    }
    if (res.status === 401) return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
    if (res.status === 404) return NextResponse.json({ error: 'Address not found.' }, { status: 404, headers: NO_STORE });
    if (!res.ok) return NextResponse.json({ error: 'Your address could not be deleted right now.' }, { status: 503, headers: NO_STORE });

    return NextResponse.json({ deleted: true }, { headers: NO_STORE });
}
