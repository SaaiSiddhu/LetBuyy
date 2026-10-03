// Canonical order history at this storefront, scoped by signed site and explicit
// buyer_order_links. The browser cannot select another store or buyer principal.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';

const NO_STORE = { 'Cache-Control': 'no-store' };
export async function GET(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;
    const query = new URLSearchParams({ store_id: session.siteId });
    for (const name of ['limit', 'cursor']) {
        const value = request.nextUrl.searchParams.get(name);
        if (value !== null) query.set(name, value);
    }
    let result: Response;
    try {
        result = await storefrontApiFetch(`/storefront/buyer/storefront-orders?${query}`, {
            method: 'GET', headers: session.headers, cache: 'no-store',
        });
    } catch {
        return NextResponse.json({ error: 'Your orders could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    }
    if (result.status === 401 || result.status === 403) return NextResponse.json({ error: 'Not authenticated' }, { status: result.status, headers: NO_STORE });
    if (result.status === 400) return NextResponse.json({ error: 'Invalid order cursor or query.' }, { status: 400, headers: NO_STORE });
    if (!result.ok) return NextResponse.json({ error: 'Your orders could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    const payload = await result.json().catch(() => null) as { data?: { orders?: unknown[]; next_cursor?: string | null; has_more?: boolean } } | null;
    if (!Array.isArray(payload?.data?.orders)) return NextResponse.json({ error: 'Your orders could not be loaded right now.' }, { status: 503, headers: NO_STORE });
    return NextResponse.json({ orders: payload.data.orders, nextCursor: payload.data.next_cursor ?? null, hasMore: Boolean(payload.data.has_more) }, { headers: NO_STORE });
}
