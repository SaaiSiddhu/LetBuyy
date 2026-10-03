// Canonical order history at this storefront, scoped by signed site and explicit
// buyer_order_links. The browser cannot select another store or buyer principal.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';

const NO_STORE = { 'Cache-Control': 'no-store' };
const ORDER_FIELDS = [
    'id', 'site_id', 'order_number', 'status', 'total', 'tax', 'gst_invoice_number', 'created_at',
    'subtotal', 'discount', 'shipping_cost', 'payment_method', 'payment_status', 'tracking_number',
    'carrier', 'shipping_address', 'currency', 'items',
] as const;
const ITEM_FIELDS = ['id', 'product_id', 'variant_id', 'name', 'title', 'sku', 'quantity', 'price', 'unit_price', 'total', 'variant_title', 'image', 'image_url', 'variant'] as const;
export async function GET(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;
    const orderId = request.nextUrl.searchParams.get('order_id');
    if (orderId !== null) {
        let result: Response;
        try {
            result = await storefrontApiFetch(`/storefront/buyer/storefront-orders/${encodeURIComponent(orderId)}?store_id=${encodeURIComponent(session.siteId)}`, {
                method: 'GET', headers: session.headers, cache: 'no-store',
            });
        } catch {
            return NextResponse.json({ error: 'This order could not be loaded right now.' }, { status: 503, headers: NO_STORE });
        }
        if (result.status === 401 || result.status === 403 || result.status === 404 || result.status === 400) {
            return NextResponse.json({ error: result.status === 404 ? 'Order not found.' : 'Not authenticated' }, { status: result.status, headers: NO_STORE });
        }
        if (!result.ok) return NextResponse.json({ error: 'This order could not be loaded right now.' }, { status: 503, headers: NO_STORE });
        const payload = await result.json().catch(() => null) as { data?: { order?: unknown } } | null;
        if (!payload?.data?.order || typeof payload.data.order !== 'object' || Array.isArray(payload.data.order)) {
            return NextResponse.json({ error: 'This order could not be loaded right now.' }, { status: 503, headers: NO_STORE });
        }
        const upstreamOrder = payload.data.order as Record<string, unknown>;
        const order = Object.fromEntries(ORDER_FIELDS.filter((field) => Object.hasOwn(upstreamOrder, field)).map((field) => [field, upstreamOrder[field]]));
        if (Array.isArray(order.items)) {
            order.items = order.items.map((value) => {
                if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
                const item = value as Record<string, unknown>;
                return Object.fromEntries(ITEM_FIELDS.filter((field) => Object.hasOwn(item, field)).map((field) => [field, item[field]]));
            });
        }
        return NextResponse.json({ order }, { headers: NO_STORE });
    }
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
