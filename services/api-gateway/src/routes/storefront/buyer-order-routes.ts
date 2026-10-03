// SUSTAINED-D3 — a marketplace buyer's orders, spanning every store they hold a verified link to.
//
// THE AUTHORIZATION CHAIN — the same shape buyer-return-routes.ts already established:
//
//   verified buyer session -> buyer_account_id
//     -> buyer_order_links   (the platform-owned link; migration 255)
//     -> orders (id, site_id)
//
// buyer_order_links is the ONLY source of ownership here — never a customer_email match, which
// proves nothing until it has been verified and the order explicitly claimed (see
// buyer-account-routes.ts's claim/link routes, migration 255's link_buyer_store_customer and
// claim_buyer_orders). Its RLS is `FOR ALL TO service_role USING (true)` with every other role
// revoked outright, so this route reads it only through the admin client, keyed by the session's
// own buyer_account_id — never a request parameter.

import type { Hono } from 'hono';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import type { Env } from '../../index';
import { dbFailureBody, decodeListCursor, encodeListCursor, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import { getStorefrontBuyerSession, requireStorefrontBuyerSession } from '../../middleware/storefront-buyer-session';
import type { AppContext } from './customer-engagement-routes';

export interface BuyerOrderSummaryRow {
    /// = buyer_order_links.order_id. Named `id` (not `order_id`) so it satisfies
    /// encodeListCursor's row shape, the same convention routes/orders.ts's own list endpoint uses.
    id: string;
    linked_at: string;
    site_id: string;
    store_name: string | null;
    order_number: string | null;
    status: string | null;
    total: number | null;
    currency: string | null;
    created_at: string | null;
}

export interface BuyerOrderRoutesDeps {
    loadBuyerOrderDetail: (c: AppContext, buyerAccountId: string, siteId: string, orderId: string) => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
    listBuyerOrders: (
        c: AppContext,
        buyerAccountId: string,
        input: { limit: number; before?: string | number | boolean | null; beforeId?: string; siteId?: string },
    ) => Promise<{ data: BuyerOrderSummaryRow[] | null; error: unknown; hasMore: boolean }>;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export async function loadBuyerOrderDetailFromDatabase(
    db: SupabaseClient, buyerAccountId: string, siteId: string, orderId: string, relationalItems: boolean,
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
    const link = await db.from('buyer_order_links').select('order_id')
        .eq('buyer_account_id', buyerAccountId).eq('site_id', siteId).eq('order_id', orderId).maybeSingle();
    if (link.error || !link.data) return { data: null, error: link.error };
    // Same view fields used by the existing storefront detail renderer; no
    // payment provider metadata, internal notes or customer-email authorization.
    const columns = 'id,site_id,store_id,order_number,status,total,tax,gst_invoice_number,created_at,subtotal,discount,shipping_cost,payment_method,payment_status,tracking_number,carrier,shipping_address,currency';
    return db.from('orders').select(relationalItems ? columns : `${columns},items`)
        .eq('id', orderId).eq('site_id', siteId).maybeSingle();
}

/// The actual query, shared by production wiring (buyer-realm-wiring.ts, given the request's real
/// admin client) and tests (given a client pointed at a fake PostgREST) -- so the tenant-guard
/// shape and the ownership walk are exercised the same way in both, not re-approximated in a test
/// double. buyer_order_links is the ONLY ownership source; orders/sites are read only for ids that
/// link already named, each with its own explicit scope predicate (orders: site_id; sites: id, in
/// the tenant guard's own allowlist for that table) -- never trusted on `id` alone.
export async function listBuyerOrdersFromDatabase(
    db: SupabaseClient,
    buyerAccountId: string,
    { limit, before, beforeId, siteId }: { limit: number; before?: string | number | boolean | null; beforeId?: string; siteId?: string },
): Promise<{ data: BuyerOrderSummaryRow[] | null; error: unknown; hasMore: boolean }> {
    let linksQuery = db
        .from('buyer_order_links')
        .select('order_id, site_id, linked_at')
        .eq('buyer_account_id', buyerAccountId)
        .order('linked_at', { ascending: false })
        .order('order_id', { ascending: false });
    if (siteId) linksQuery = linksQuery.eq('site_id', siteId);
    if (before !== null && before !== undefined) {
        if (beforeId) {
            if (!UUID.test(beforeId) || typeof before !== 'string' || !TIMESTAMP.test(before) || !Number.isFinite(Date.parse(before))) {
                return { data: null, error: new Error('Invalid order cursor'), hasMore: false };
            }
            // Same ordering tuple as ORDER BY. A timestamp alone loses tied rows.
            linksQuery = linksQuery.or(`linked_at.lt.${before},and(linked_at.eq.${before},order_id.lt.${beforeId})`);
        } else linksQuery = linksQuery.lt('linked_at', before as string);
    }

    const { data: links, error: linksError } = await linksQuery.limit(limit + 1);
    if (linksError) return { data: null, error: linksError, hasMore: false };

    const hasMore = (links ?? []).length > limit;
    const pageLinks = (links ?? []).slice(0, limit) as { order_id: string; site_id: string; linked_at: string }[];
    if (pageLinks.length === 0) return { data: [], error: null, hasMore: false };

    const orderIds = pageLinks.map((link) => link.order_id);
    const siteIds = Array.from(new Set(pageLinks.map((link) => link.site_id)));

    const [ordersResult, sitesResult] = await Promise.all([
        db.from('orders').select('id, site_id, order_number, status, total, currency, created_at').in('id', orderIds).in('site_id', siteIds),
        db.from('sites').select('id, store_name').in('id', siteIds),
    ]);
    if (ordersResult.error) return { data: null, error: ordersResult.error, hasMore: false };
    if (sitesResult.error) return { data: null, error: sitesResult.error, hasMore: false };

    const orderById = new Map((ordersResult.data ?? []).map((row) => [row.id as string, row]));
    const siteById = new Map((sitesResult.data ?? []).map((row) => [row.id as string, row]));

    const rows: BuyerOrderSummaryRow[] = pageLinks.map((link) => {
        const candidate = orderById.get(link.order_id) as Record<string, unknown> | undefined;
        const order = candidate?.site_id === link.site_id ? candidate : undefined;
        const site = siteById.get(link.site_id) as Record<string, unknown> | undefined;
        return {
            id: link.order_id,
            linked_at: link.linked_at,
            site_id: link.site_id,
            store_name: (site?.store_name as string | undefined) ?? null,
            order_number: (order?.order_number as string | undefined) ?? null,
            status: (order?.status as string | undefined) ?? null,
            total: (order?.total as number | undefined) ?? null,
            currency: (order?.currency as string | undefined) ?? null,
            created_at: (order?.created_at as string | undefined) ?? null,
        };
    });

    return { data: rows, error: null, hasMore };
}

export function registerBuyerOrderRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerOrderRoutesDeps,
): void {
    const { listBuyerOrders, loadBuyerOrderDetail } = deps;

    async function readOrders(c: AppContext, buyerAccountId: string, siteId?: string) {
        const requested = Number.parseInt(c.req.query('limit') || '', 10);
        const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_LIMIT) : DEFAULT_LIMIT;
        const rawCursor = c.req.query('cursor');
        const cursor = decodeListCursor(rawCursor || undefined);
        if (rawCursor && (!cursor || !UUID.test(cursor.id) || typeof cursor.value !== 'string' || !TIMESTAMP.test(cursor.value) || !Number.isFinite(Date.parse(cursor.value)))) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid order cursor.' } }, 400);
        }

        const { data, error, hasMore } = await listBuyerOrders(c, buyerAccountId, {
            limit,
            before: cursor?.value ?? null,
            beforeId: cursor?.id,
            siteId,
        });
        if (error) return c.json(dbFailureBody(), 500);

        const orders = data ?? [];
        const nextCursor = hasMore && orders.length > 0
            ? encodeListCursor(orders[orders.length - 1] as unknown as Record<string, unknown>, 'linked_at')
            : null;

        return c.json(success({ orders, next_cursor: nextCursor, has_more: hasMore }));
    }

    router.get('/buyer/orders', requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
        return readOrders(c, session.buyerAccountId);
    });

    // A storefront's token is authorized only at its signed site, with the same
    // canonical verified-link query. Never translate its email into legacy reads.
    router.get('/buyer/storefront-orders', requireStorefrontBuyerSession, async (c) => {
        const session = getStorefrontBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);
        return readOrders(c, session.buyerAccountId, session.siteId);
    });

    router.get('/buyer/storefront-orders/:orderId', requireStorefrontBuyerSession, async (c) => {
        const session = getStorefrontBuyerSession(c);
        if (!session) return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);
        const orderId = c.req.param('orderId');
        if (!UUID.test(orderId)) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid order id.' } }, 400);
        const { data, error } = await loadBuyerOrderDetail(c, session.buyerAccountId, session.siteId, orderId);
        if (error) return c.json(dbFailureBody(), 500);
        if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found.' } }, 404);
        return c.json(success({ order: data }));
    });
}
