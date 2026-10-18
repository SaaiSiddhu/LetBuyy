// GET/POST /api/buyer/addresses — the canonical buyer address book. Resolve this
// host independently of the cookie, then forward the site-bound storefront token.
// Ownership is enforced at the gateway using the verified buyer account id.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';
import { verifyExpectedBuyerIdentity } from '@/lib/buyer-auth/expected-buyer';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;

    let res: Response;
    try {
        res = await storefrontApiFetch(`/storefront/buyer/addresses?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'GET',
            headers: session.headers,
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
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'A JSON body is required' }, { status: 400, headers: NO_STORE });
    const identityFailure = await verifyExpectedBuyerIdentity(session, request.headers.get('x-letbuyy-expected-buyer-id'), {
        missing: 'Reload your account before changing saved addresses.',
        unavailable: 'Your account could not be checked before changing saved addresses.',
    });
    if (identityFailure) return identityFailure;

    let res: Response;
    try {
        res = await storefrontApiFetch(`/storefront/buyer/addresses?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'POST',
            headers: session.headers,
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
