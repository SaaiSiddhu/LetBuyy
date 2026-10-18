// PATCH/DELETE /api/buyer/addresses/:id — edit or remove one of the signed-in buyer's own
// cross-store addresses (D2, SUSTAINED-J). Same gateway-proxy pattern as ../route.ts; the address
// id in the URL is only ever forwarded, never trusted to belong to the caller here -- the gateway's
// own .eq('buyer_account_id', ...) predicate (buyer-address-routes.ts) is what actually enforces
// ownership and answers 404 for another buyer's address.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';
import { verifyExpectedBuyerIdentity } from '@/lib/buyer-auth/expected-buyer';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'A JSON body is required' }, { status: 400, headers: NO_STORE });
    const identityFailure = await verifyExpectedBuyerIdentity(session, request.headers.get('x-letbuyy-expected-buyer-id'), {
        missing: 'Reload your account before changing saved addresses.',
        unavailable: 'Your account could not be checked before changing saved addresses.',
    });
    if (identityFailure) return identityFailure;

    let res: Response;
    try {
        res = await storefrontApiFetch(`/storefront/buyer/addresses/${encodeURIComponent(id)}?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'PATCH',
            headers: session.headers,
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
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;

    const { id } = await params;
    const identityFailure = await verifyExpectedBuyerIdentity(session, request.headers.get('x-letbuyy-expected-buyer-id'), {
        missing: 'Reload your account before changing saved addresses.',
        unavailable: 'Your account could not be checked before changing saved addresses.',
    });
    if (identityFailure) return identityFailure;

    let res: Response;
    try {
        res = await storefrontApiFetch(`/storefront/buyer/addresses/${encodeURIComponent(id)}?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'DELETE',
            headers: session.headers,
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
