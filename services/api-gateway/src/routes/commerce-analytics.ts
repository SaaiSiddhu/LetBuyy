// ============================================================
// COMMERCE ANALYTICS — Real aggregations over existing tables
// Failed required reads are unavailable; never fabricate empty metrics.
// ============================================================

import { Hono } from 'hono';
import { SupplierMetricsResultSchema, WarehouseMetricsResultSchema, TransferMetricsResultSchema, OperationsSummaryResultSchema } from '@letbuyy/shared-types';
import { CommerceMetricPageQuerySchema, CommerceMetricStoreQuerySchema, type CommerceMetricPageQuery, type CommerceMetricStoreQuery } from '@letbuyy/commerce-core';
import { validate } from '../middleware/validation';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { dbFailureBody, getSupabaseAdmin, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// ── helpers ─────────────────────────────────────────────────

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}


function isMissingColumnError(error: DatabaseErrorLike, columnName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(columnName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

// ── GET /commerce-analytics/supplier-metrics?store_id= ──────
// Per-supplier: PO count + on-time rate + avg lead time.
// Tables: purchase_orders (site_id, supplier_id, status, expected_at, created_at)
//         purchase_order_receipts (purchase_order_id, created_at event time)
//         suppliers (id, name)
router.get('/supplier-metrics', validate('query', CommerceMetricPageQuerySchema), async (c) => {
    const auth = c.get('auth');
    const q=c.get('validatedQuery') as CommerceMetricPageQuery;
    const storeId=q.store_id;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!storeId) {
        return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'store_id is required' } }, 400);
    }
    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data,error }=await db.rpc('read_merchant_supplier_metrics',{p_site_id:storeId,p_page:q.page,p_limit:q.limit});
    if(error || !data) return c.json(dbFailureBody(),500);
    const parsed=SupplierMetricsResultSchema.safeParse({...data,store_id:storeId});
    if(!parsed.success || parsed.data.meta.page!==q.page || parsed.data.meta.per_page!==q.limit) return c.json(dbFailureBody(),500);
    return c.json(success(parsed.data));
});

// ── GET /commerce-analytics/warehouse-metrics?store_id= ─────
// Per-location: SKU count + total units.
// Tables: inventory_levels (location_id, available, reserved, incoming)
//         inventory_locations (id, store_id, name, is_default)
router.get('/warehouse-metrics', validate('query', CommerceMetricPageQuerySchema), async (c) => {
    const auth = c.get('auth');
    const q=c.get('validatedQuery') as CommerceMetricPageQuery;
    const storeId=q.store_id;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!storeId) {
        return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'store_id is required' } }, 400);
    }
    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data,error }=await db.rpc('read_merchant_warehouse_metrics',{p_site_id:storeId,p_page:q.page,p_limit:q.limit});
    if(error || !data) return c.json(dbFailureBody(),500);
    const parsed=WarehouseMetricsResultSchema.safeParse({...data,store_id:storeId});
    if(!parsed.success || parsed.data.meta.page!==q.page || parsed.data.meta.per_page!==q.limit) return c.json(dbFailureBody(),500);
    return c.json(success(parsed.data));
});

// ── GET /commerce-analytics/transfer-metrics?store_id= ──────
// Transfer counts by status + in-transit count.
// Table: inventory_transfers (site_id, status, deleted_at)
router.get('/transfer-metrics', validate('query', CommerceMetricStoreQuerySchema), async (c) => {
    const auth = c.get('auth');
    const {store_id:storeId} = c.get('validatedQuery') as CommerceMetricStoreQuery;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!storeId) {
        return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'store_id is required' } }, 400);
    }
    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db.rpc('read_merchant_transfer_metrics', { p_site_id: storeId });
    // Missing schema and failed dependencies are unavailable, never empty success.
    if (error || !data) return c.json(dbFailureBody(), 500);
    const parsed=TransferMetricsResultSchema.safeParse({...data,store_id:storeId});
    if(!parsed.success) return c.json(dbFailureBody(),500);
    return c.json(success(parsed.data));
});

// ── GET /commerce-analytics/operations-summary?store_id= ────
// Consolidated snapshot: orders + POs + transfers + low-stock.
// Tables: orders, purchase_orders, inventory_transfers, inventory_levels, products
router.get('/operations-summary', validate('query', CommerceMetricStoreQuerySchema), async (c) => {
    const auth = c.get('auth');
    const {store_id:storeId} = c.get('validatedQuery') as CommerceMetricStoreQuery;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!storeId) {
        return c.json({ success: false, error: { code: 'BAD_REQUEST', message: 'store_id is required' } }, 400);
    }
    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const summary: {
        order_count?: number;
        open_order_count?: number;
        po_count?: number;
        open_po_count?: number;
        transfer_count?: number;
        in_transit_transfer_count?: number;
        low_stock_sku_count?: number;
        total_sku_count?: number;
    } = {};

    // Counts stay inside Postgres: row payloads are both unnecessary here and
    // silently limited by PostgREST's max_rows. Launch independent metrics together.
    const countRows = async (table: string, ownerColumn: string, statuses?: string[]) => {
        const build = (includeDeletedAt: boolean) => {
            let query = db.from(table).select('id', { count: 'exact', head: true }).eq(ownerColumn, storeId);
            if (includeDeletedAt) query = query.is('deleted_at', null);
            if (statuses) query = query.in('status', statuses);
            return query;
        };
        let result = await build(true);
        if (isMissingColumnError(result.error, 'deleted_at')) result = await build(false);
        return result;
    };
    const [orders, openOrders, purchaseOrders, openPurchaseOrders, transfers, movingTransfers, lowStock, products] = await Promise.all([
        countRows('orders', 'store_id'),
        countRows('orders', 'store_id', ['pending', 'processing', 'unfulfilled']),
        countRows('purchase_orders', 'site_id'),
        countRows('purchase_orders', 'site_id', ['draft', 'ordered', 'partially_received']),
        countRows('inventory_transfers', 'site_id'),
        countRows('inventory_transfers', 'site_id', ['shipped', 'partially_received']),
        db.from('inventory_levels').select('id, products!inner(store_id,deleted_at)', { count: 'exact', head: true })
            .eq('store_id', storeId).in('products.store_id', [storeId])
            .is('deleted_at', null).is('products.deleted_at', null).lte('free_quantity', 10),
        countRows('products', 'store_id'),
    ]);
    // A successful HEAD without an observed exact count is unavailable, not zero.
    const counted = (result: {error: unknown; count: number | null}) => !result.error &&
        result.count !== null && Number.isSafeInteger(result.count) && result.count >= 0;
    if (counted(orders) && counted(openOrders)) {
        summary.order_count = orders.count!;
        summary.open_order_count = openOrders.count!;
    }
    if (counted(purchaseOrders) && counted(openPurchaseOrders)) {
        summary.po_count = purchaseOrders.count!;
        summary.open_po_count = openPurchaseOrders.count!;
    }
    if (counted(transfers) && counted(movingTransfers)) {
        summary.transfer_count = transfers.count!;
        summary.in_transit_transfer_count = movingTransfers.count!;
    }
    if (counted(lowStock)) summary.low_stock_sku_count = lowStock.count!;
    if (counted(products)) summary.total_sku_count = products.count!;
    const parsed=OperationsSummaryResultSchema.safeParse({...summary,store_id:storeId});
    if(!parsed.success) return c.json(dbFailureBody(),500);
    return c.json(success(parsed.data));
});

export default router;
