import { CheckoutTotalsQuoteSchema } from '@letbuyy/shared-types';
// Canonical order history at this storefront, scoped by signed site and explicit
// buyer_order_links. The browser cannot select another store or buyer principal.
import { NextRequest, NextResponse } from 'next/server';
import { storefrontApiFetch } from '@/lib/api/client';
import { resolveBuyerDataSession } from '@/lib/buyer-auth/data-session';
import { readOrderItemFactSnapshot } from '@/lib/order-fact-readback';
import { safeReturnTo } from '@/lib/buyer-auth/flow';

const NO_STORE = { 'Cache-Control': 'no-store' };
const ORDER_FIELDS = [
    'id', 'site_id', 'order_number', 'status', 'total', 'tax', 'gst_invoice_number', 'created_at',
    'subtotal', 'discount', 'coupon_code', 'coupon_discount', 'shipping_cost', 'payment_method', 'payment_status', 'tracking_number',
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
        const quote = CheckoutTotalsQuoteSchema.safeParse(upstreamOrder.totals_quote);
        if (quote.success) order.totals_quote = quote.data;
        if (Array.isArray(order.items)) {
            order.items = order.items.map((value) => {
                if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
                const item = value as Record<string, unknown>;
                const approved = Object.fromEntries(ITEM_FIELDS.filter((field) => Object.hasOwn(item, field)).map((field) => [field, item[field]]));
                const nicheSnapshot = readOrderItemFactSnapshot(item);
                return nicheSnapshot ? { ...approved, niche_snapshot: nicheSnapshot } : approved;
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

/** Explicitly attach this store's verified-email orders to the signed-in buyer. */
export async function POST(request: NextRequest) {
    const session = await resolveBuyerDataSession(request);
    if ('response' in session) return session.response;

    const acceptsHtml = (request.headers.get('accept') || '').includes('text/html');
    const form = acceptsHtml ? await request.formData().catch(() => null) : null;
    const returnTo = safeReturnTo(typeof form?.get('return_to') === 'string' ? String(form.get('return_to')) : null);
    const respond = (status: string, body: Record<string, unknown>, httpStatus: number) => {
        if (acceptsHtml) {
            const destination = new URL(returnTo, request.url);
            destination.searchParams.set('buyer_claim', status);
            const response = NextResponse.redirect(destination, 303);
            response.headers.set('Cache-Control', 'no-store');
            return response;
        }
        return NextResponse.json(body, { status: httpStatus, headers: NO_STORE });
    };

    let result: Response;
    try {
        result = await storefrontApiFetch(`/storefront/buyer/orders/claim?store_id=${encodeURIComponent(session.siteId)}`, {
            method: 'POST',
            headers: session.headers,
            body: JSON.stringify({ store_id: session.siteId }),
            cache: 'no-store',
        });
    } catch {
        return respond('unavailable', { error: 'Orders could not be claimed right now.' }, 503);
    }

    if (result.ok) {
        const payload = await result.json().catch(() => null) as {
            data?: { claimed?: { linked?: unknown; already_linked?: unknown; conflicts?: unknown } };
        } | null;
        const claimed = payload?.data?.claimed;
        if (!claimed || ![claimed.linked, claimed.already_linked, claimed.conflicts].every((value) => Number.isInteger(value) && Number(value) >= 0)) {
            return respond('unavailable', { error: 'Orders could not be claimed right now.' }, 503);
        }
        const outcome = {
            linked: Number(claimed.linked),
            alreadyLinked: Number(claimed.already_linked),
            conflicts: Number(claimed.conflicts),
        };
        return respond(outcome.conflicts > 0 ? 'partial' : 'complete', { claimed: outcome }, 200);
    }

    const payload = await result.json().catch(() => null) as { error?: { code?: unknown } } | null;
    if (result.status === 403 && payload?.error?.code === 'EMAIL_UNVERIFIED') {
        return respond('unverified', { error: 'Verify your LetBuyy email address before claiming past orders.', code: 'EMAIL_UNVERIFIED' }, 403);
    }
    if (result.status === 401) return respond('unauthorized', { error: 'Sign in to LetBuyy before claiming past orders.' }, 401);
    return respond('unavailable', { error: 'Orders could not be claimed right now.' }, result.status >= 500 ? 503 : result.status);
}
