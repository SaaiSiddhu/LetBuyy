// ============================================================
// COMMERCE ANALYTICS — Real aggregations over existing tables
// NEVER fabricate data; omit a metric if its table is missing.
// ============================================================

import { Hono } from 'hono';
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

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
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
//         purchase_order_receipts (purchase_order_id, received_at)
//         suppliers (id, name)
router.get('/supplier-metrics', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
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

    // Fetch all non-deleted POs for the store with supplier info
    const { data: poRows, error: poError } = await db
        .from('purchase_orders')
        .select('id, supplier_id, status, expected_at, created_at, supplier:suppliers(id, name)')
        .eq('site_id', storeId)
        .is('deleted_at', null);

    if (isMissingTableError(poError, 'purchase_orders')) {
        return c.json(success({ suppliers: [], schema_missing: true }));
    }
    if (poError) return c.json(dbFailureBody(), 500);

    // Fetch receipts to compute received_at per PO for on-time + lead time
    const poIds = (poRows || []).map((r) => r.id as string);
    const receiptsByPo: Record<string, string | null> = {};

    if (poIds.length > 0) {
        const { data: receiptRows, error: receiptError } = await db
            .from('purchase_order_receipts')
            .select('purchase_order_id, received_at')
            .eq('site_id', storeId)
            .in('purchase_order_id', poIds);

        if (!receiptError && !isMissingTableError(receiptError, 'purchase_order_receipts')) {
            for (const row of receiptRows || []) {
                const poId = row.purchase_order_id as string;
                const receivedAt = row.received_at as string | null;
                // Use earliest receipt per PO
                if (!receiptsByPo[poId] || (receivedAt && receivedAt < receiptsByPo[poId]!)) {
                    receiptsByPo[poId] = receivedAt;
                }
            }
        }
        // If table missing — on-time/lead-time omitted (not an error)
    }

    // Aggregate per supplier
    const supplierMap = new Map<string, {
        supplier_id: string;
        supplier_name: string;
        po_count: number;
        on_time_count: number;
        late_count: number;
        total_lead_time_days: number;
        measured_lead_time_count: number;
    }>();

    for (const po of poRows || []) {
        const supplierId = (po.supplier_id as string | null) ?? '__no_supplier__';
        // supplier is a joined object: {id, name} or null
        const supplierJoin = po.supplier;
        let supplierName = 'No supplier';
        if (supplierJoin && !Array.isArray(supplierJoin)) {
            const s = supplierJoin as Record<string, unknown>;
            if (typeof s.name === 'string') supplierName = s.name;
        }

        if (!supplierMap.has(supplierId)) {
            supplierMap.set(supplierId, {
                supplier_id: supplierId,
                supplier_name: supplierName,
                po_count: 0,
                on_time_count: 0,
                late_count: 0,
                total_lead_time_days: 0,
                measured_lead_time_count: 0,
            });
        }

        const agg = supplierMap.get(supplierId)!;
        agg.po_count += 1;

        const receivedAt = receiptsByPo[po.id as string] ?? null;
        const expectedAt = po.expected_at as string | null;
        const createdAt = po.created_at as string;

        // On-time: received before or on expected_at (both must be present)
        if (receivedAt && expectedAt) {
            if (receivedAt <= expectedAt) {
                agg.on_time_count += 1;
            } else {
                agg.late_count += 1;
            }
        }

        // Lead time: days from created_at to first received_at
        if (receivedAt && createdAt) {
            const created = Date.parse(createdAt);
            const received = Date.parse(receivedAt);
            if (Number.isFinite(created) && Number.isFinite(received) && received >= created) {
                agg.total_lead_time_days += Math.round((received - created) / 86_400_000);
                agg.measured_lead_time_count += 1;
            }
        }
    }

    const suppliers = Array.from(supplierMap.values()).map((s) => ({
        supplier_id: s.supplier_id === '__no_supplier__' ? null : s.supplier_id,
        supplier_name: s.supplier_name,
        po_count: s.po_count,
        on_time_rate: (s.on_time_count + s.late_count) > 0
            ? Math.round((s.on_time_count / (s.on_time_count + s.late_count)) * 100) / 100
            : null,
        avg_lead_time_days: s.measured_lead_time_count > 0
            ? Math.round(s.total_lead_time_days / s.measured_lead_time_count)
            : null,
    })).sort((a, b) => b.po_count - a.po_count);

    return c.json(success({ suppliers }));
});

// ── GET /commerce-analytics/warehouse-metrics?store_id= ─────
// Per-location: SKU count + total units.
// Tables: inventory_levels (location_id, available, reserved, incoming)
//         inventory_locations (id, store_id, name, is_default)
router.get('/warehouse-metrics', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
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

    // Get all inventory locations for this store
    const { data: locationRows, error: locationError } = await db
        .from('inventory_locations')
        .select('id, name, is_default, status')
        .eq('store_id', storeId);

    if (isMissingTableError(locationError, 'inventory_locations')) {
        return c.json(success({ warehouses: [], schema_missing: true }));
    }
    if (locationError) return c.json(dbFailureBody(), 500);

    const locationIds = (locationRows || []).map((l) => l.id as string);

    if (locationIds.length === 0) {
        return c.json(success({ warehouses: [] }));
    }

    // Fetch inventory_levels grouped by location_id
    const { data: levelRows, error: levelError } = await db
        .from('inventory_levels')
        .select('location_id, available, reserved, incoming')
        .eq('store_id', storeId)
        .in('location_id', locationIds);

    if (isMissingTableError(levelError, 'inventory_levels')) {
        // Locations exist but no levels yet — return locations with zero counts
        const warehouses = (locationRows || []).map((loc) => ({
            location_id: loc.id as string,
            location_name: loc.name as string,
            is_default: Boolean(loc.is_default),
            sku_count: 0,
            total_units: 0,
        }));
        return c.json(success({ warehouses, schema_missing: 'inventory_levels' }));
    }
    if (levelError) return c.json(dbFailureBody(), 500);

    // Aggregate per location
    const locationAgg = new Map<string, { sku_count: number; total_units: number }>();

    for (const row of levelRows || []) {
        const locId = row.location_id as string;
        if (!locationAgg.has(locId)) {
            locationAgg.set(locId, { sku_count: 0, total_units: 0 });
        }
        const agg = locationAgg.get(locId)!;
        agg.sku_count += 1;
        // total_units = available + reserved + incoming (all real columns)
        const available = Number(row.available ?? 0);
        const reserved = Number(row.reserved ?? 0);
        const incoming = Number(row.incoming ?? 0);
        agg.total_units += available + reserved + incoming;
    }

    const warehouses = (locationRows || []).map((loc) => {
        const agg = locationAgg.get(loc.id as string) ?? { sku_count: 0, total_units: 0 };
        return {
            location_id: loc.id as string,
            location_name: loc.name as string,
            is_default: Boolean(loc.is_default),
            sku_count: agg.sku_count,
            total_units: agg.total_units,
        };
    }).sort((a, b) => b.total_units - a.total_units);

    return c.json(success({ warehouses }));
});

// ── GET /commerce-analytics/transfer-metrics?store_id= ──────
// Transfer counts by status + in-transit count.
// Table: inventory_transfers (site_id, status, deleted_at)
router.get('/transfer-metrics', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
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

    const buildQuery = (includeDeletedAt: boolean) => {
        let q = db
            .from('inventory_transfers')
            .select('status')
            .eq('site_id', storeId);
        if (includeDeletedAt) q = q.is('deleted_at', null);
        return q;
    };

    let { data: rows, error } = await buildQuery(true);

    if (isMissingColumnError(error, 'deleted_at')) {
        ({ data: rows, error } = await buildQuery(false));
    }

    if (isMissingTableError(error, 'inventory_transfers')) {
        return c.json(success({ by_status: {}, in_transit_count: 0, total_count: 0, schema_missing: true }));
    }
    if (error) return c.json(dbFailureBody(), 500);

    const byStatus: Record<string, number> = {};
    let totalCount = 0;

    for (const row of rows || []) {
        const s = String(row.status ?? 'unknown');
        byStatus[s] = (byStatus[s] || 0) + 1;
        totalCount += 1;
    }

    // 'in_transit' is a canonical status for shipped-but-not-received transfers
    const inTransitCount = byStatus['in_transit'] ?? 0;

    return c.json(success({
        by_status: byStatus,
        in_transit_count: inTransitCount,
        total_count: totalCount,
    }));
});

// ── GET /commerce-analytics/operations-summary?store_id= ────
// Consolidated snapshot: orders + POs + transfers + low-stock.
// Tables: orders, purchase_orders, inventory_transfers, inventory_levels, products
router.get('/operations-summary', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
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

    // ── Orders ───────────────────────────────────────────────
    const buildOrdersQuery = (includeDeletedAt: boolean) => {
        let q = db
            .from('orders')
            .select('status')
            .eq('store_id', storeId);
        if (includeDeletedAt) q = q.is('deleted_at', null);
        return q;
    };

    let { data: orderRows, error: orderError } = await buildOrdersQuery(true);
    if (isMissingColumnError(orderError, 'deleted_at')) {
        ({ data: orderRows, error: orderError } = await buildOrdersQuery(false));
    }
    if (!orderError && !isMissingTableError(orderError, 'orders')) {
        summary.order_count = (orderRows || []).length;
        let openOrders = 0;
        for (const row of orderRows || []) {
            const s = String(row.status ?? '');
            if (s === 'pending' || s === 'processing' || s === 'unfulfilled') openOrders += 1;
        }
        summary.open_order_count = openOrders;
    }

    // ── Purchase orders ──────────────────────────────────────
    const { data: poRows, error: poError } = await db
        .from('purchase_orders')
        .select('status')
        .eq('site_id', storeId)
        .is('deleted_at', null);

    if (!poError && !isMissingTableError(poError, 'purchase_orders')) {
        summary.po_count = (poRows || []).length;
        let openPos = 0;
        for (const row of poRows || []) {
            const s = String(row.status ?? '');
            if (s === 'draft' || s === 'ordered' || s === 'partial') openPos += 1;
        }
        summary.open_po_count = openPos;
    }

    // ── Transfers ────────────────────────────────────────────
    const buildTransfersQuery = (includeDeletedAt: boolean) => {
        let q = db
            .from('inventory_transfers')
            .select('status')
            .eq('site_id', storeId);
        if (includeDeletedAt) q = q.is('deleted_at', null);
        return q;
    };

    let { data: trRows, error: trError } = await buildTransfersQuery(true);
    if (isMissingColumnError(trError, 'deleted_at')) {
        ({ data: trRows, error: trError } = await buildTransfersQuery(false));
    }
    if (!trError && !isMissingTableError(trError, 'inventory_transfers')) {
        summary.transfer_count = (trRows || []).length;
        let inTransit = 0;
        for (const row of trRows || []) {
            if (String(row.status ?? '') === 'in_transit') inTransit += 1;
        }
        summary.in_transit_transfer_count = inTransit;
    }

    // ── Low-stock from inventory_levels ──────────────────────
    const { data: lowStockRows, error: lowStockError } = await db
        .from('inventory_levels')
        .select('id, products!inner(store_id)')
        .eq('store_id', storeId)
        .in('products.store_id', [storeId])
        .lte('available', 10);

    if (!lowStockError && !isMissingTableError(lowStockError, 'inventory_levels')) {
        summary.low_stock_sku_count = (lowStockRows || []).length;
    }

    // ── Total SKU count from products ────────────────────────
    const buildSkuQuery = (includeDeletedAt: boolean) => {
        let q = db
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId);
        if (includeDeletedAt) q = q.is('deleted_at', null);
        return q;
    };

    let { count: skuCount, error: skuError } = await buildSkuQuery(true);
    if (isMissingColumnError(skuError, 'deleted_at')) {
        ({ count: skuCount, error: skuError } = await buildSkuQuery(false));
    }
    if (!skuError) {
        summary.total_sku_count = skuCount ?? 0;
    }

    return c.json(success(summary));
});

export default router;
