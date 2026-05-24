// ============================================================
// INVENTORY — Locations, levels, adjustments (Doc 05 + Doc 08 § 6)
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { dbFailureBody, failureBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { IdempotencyService } from '../services/idempotency.service';
import {
    AdjustInventorySchema,
    BulkAdjustSchema,
    CreateLocationSchema,
    CreatePurchaseOrderSchema,
    CreateSupplierSchema,
    CreateTransferSchema,
    ReceivePurchaseOrderSchema,
    ReceiveTransferSchema,
    ShipTransferSchema,
    type BulkAdjustInput,
    type CreateLocationInput,
    type CreatePurchaseOrderInput,
    type CreateSupplierInput,
    type CreateTransferInput,
    type InventoryAdjustmentInput,
    type ReceivePurchaseOrderInput,
    type ReceiveTransferInput,
    type ShipTransferInput,
} from '@letbuyy/commerce-core';

const router = new Hono<{ Bindings: Env }>();

type InventoryLevelRow = {
    id: string;
    product_id: string;
    variant_id: string | null;
    location_id: string;
    available: number;
    reserved: number;
    incoming: number;
    updated_at: string | null;
    products?: {
        id: string;
        name: string;
        sku?: string | null;
        images?: string[] | null;
        store_id: string;
        track_inventory?: boolean | null;
    } | null;
    product_variants?: {
        id: string;
        title: string;
        sku?: string | null;
    } | null;
    inventory_locations?: {
        id: string;
        name: string;
        is_default?: boolean | null;
        status?: string | null;
    } | null;
};

type ProductInventoryFallbackRow = {
    id: string;
    name: string;
    sku?: string | null;
    images?: string[] | null;
    stock?: number | string | null;
    track_inventory?: boolean | null;
    updated_at?: string | null;
};

type ProductOwnerRow = {
    id: string;
    store_id: string;
    stock?: number | string | null;
};

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

function isMissingDeletedAtError(error: DatabaseErrorLike): boolean {
    return isMissingColumnError(error, 'deleted_at');
}

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function isInventorySchemaMissingError(error: DatabaseErrorLike): boolean {
    return (
        isMissingTableError(error, 'inventory_levels') ||
        isMissingTableError(error, 'inventory_locations') ||
        isMissingTableError(error, 'inventory_adjustments') ||
        isMissingTableError(error, 'product_variants') ||
        isMissingTableError(error, 'adjust_inventory_level') ||
        databaseErrorText(error).includes('relationship')
    );
}

function mapInventoryReason(reason: InventoryAdjustmentInput['reason']) {
    switch (reason) {
        case 'sold':
            return 'sale';
        case 'returned':
            return 'return';
        case 'received':
        case 'correction':
            return 'adjustment';
        default:
            return reason;
    }
}

async function listProductStockInventoryRows(
    db: ReturnType<typeof getSupabaseAdmin>,
    ownedStoreIds: string[],
    productId: string | undefined,
    lowStockOnly: boolean,
    page: number,
    limit: number,
) {
    const offset = (page - 1) * limit;

    const buildQuery = (includeDeletedAtFilter: boolean, includeTrackInventoryColumn: boolean) => {
        let query = db
            .from('products')
            .select(
                includeTrackInventoryColumn
                    ? 'id,name,sku,images,stock,track_inventory,updated_at'
                    : 'id,name,sku,images,stock,updated_at',
                { count: 'exact' }
            )
            .in('store_id', ownedStoreIds);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        if (includeTrackInventoryColumn) query = query.neq('track_inventory', false);
        if (productId) query = query.eq('id', productId);
        if (lowStockOnly) query = query.lte('stock', 10);

        return query
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1);
    };

    let { data, error, count } = await buildQuery(true, true);

    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildQuery(false, true));
    }

    if (isMissingColumnError(error, 'track_inventory')) {
        ({ data, error, count } = await buildQuery(true, false));
        if (isMissingDeletedAtError(error)) {
            ({ data, error, count } = await buildQuery(false, false));
        }
    }

    if (error) {
        return { data: [], count: 0, error };
    }

    const rows = ((data || []) as unknown as ProductInventoryFallbackRow[]).map((product) => {
        const stock = Number(product.stock || 0);

        return {
            id: `product:${product.id}`,
            product_id: product.id,
            variant_id: null,
            location_id: null,
            product_name: product.name,
            variant_title: null,
            sku: product.sku || null,
            images: product.images || [],
            location_name: 'Default Location',
            available: stock,
            reserved: 0,
            incoming: 0,
            on_hand: stock,
            sellable: stock,
            track_inventory: product.track_inventory !== false,
            updated_at: product.updated_at || null,
        };
    });

    return { data: rows, count: count || 0, error: null };
}

async function loadOwnedProductForInventory(
    db: ReturnType<typeof getSupabaseAdmin>,
    productId: string,
) {
    const buildProductQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('products')
            .select('id, store_id, stock')
            .eq('id', productId);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query.single();
    };

    let { data, error } = await buildProductQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildProductQuery(false));
    }

    return { data: data as ProductOwnerRow | null, error };
}

// ── Routes ──────────────────────────────────────────────────

// GET /inventory/locations — List inventory locations
router.get('/locations', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId
        ? [storeId]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (ownedStoreIds.length === 0) return c.json(success([]));

    const query = db
        .from('inventory_locations')
        .select('*')
        .in('store_id', ownedStoreIds);

    const { data, error } = await query.order('is_default', { ascending: false });

    if (isMissingTableError(error, 'inventory_locations')) {
        return c.json(success([]));
    }

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success(data || []));
});

// POST /inventory/locations — Create a new location
router.post('/locations', validate('json', CreateLocationSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateLocationInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('inventory_locations')
        .insert(body)
        .select()
        .single();

    if (isMissingTableError(error, 'inventory_locations')) {
        return c.json({
            success: false,
            error: {
                code: 'INVENTORY_SCHEMA_MISSING',
                message: 'Inventory locations are not available in this local database schema',
            },
        }, 503);
    }

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success(data), 201);
});

// GET /inventory/suppliers — List suppliers
router.get('/suppliers', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId
        ? [storeId]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (ownedStoreIds.length === 0) return c.json(success([]));

    const { data, error } = await db
        .from('suppliers')
        .select('*')
        .in('site_id', ownedStoreIds)
        .is('deleted_at', null)
        .order('name', { ascending: true });

    if (isMissingTableError(error, 'suppliers')) return c.json(success([]));
    if (error) return c.json(dbFailureBody(), 500);

    return c.json(success(data || []));
});

// POST /inventory/suppliers — Create supplier
router.post('/suppliers', validate('json', CreateSupplierSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateSupplierInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('suppliers')
        .insert({
            site_id: body.store_id,
            name: body.name,
            contact_name: body.contact_name || null,
            email: body.email || null,
            phone: body.phone || null,
            address: body.address || {},
            created_by: customUser.id,
        })
        .select()
        .single();

    if (error) return c.json(dbFailureBody(), 500);
    return c.json(success(data), 201);
});

// GET /inventory/purchase-orders — List purchase orders
router.get('/purchase-orders', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);

    const ownedStoreIds = storeId
        ? [storeId]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);
    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    if (ownedStoreIds.length === 0) return c.json(success([]));

    const { data, error } = await db
        .from('purchase_orders')
        .select('*, supplier:suppliers(name), lines:purchase_order_lines(*)')
        .in('site_id', ownedStoreIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (isMissingTableError(error, 'purchase_orders')) return c.json(success([]));
    if (error) return c.json(dbFailureBody(), 500);

    return c.json(success(data || []));
});

// POST /inventory/purchase-orders — Create ordered PO and incoming inventory
router.post('/purchase-orders', validate('json', CreatePurchaseOrderSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreatePurchaseOrderInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const idempotency = new IdempotencyService(db);
    const claim = await idempotency.begin({
        siteId: body.store_id,
        key: body.idempotency_key,
        scope: 'inventory.purchase_orders.create',
        requestBody: body,
        requestId: requestId(c),
    });
    if (claim.kind === 'replay') return c.json(claim.responseBody as any, claim.statusCode as any);

    try {
        const { data, error } = await db.rpc('create_purchase_order_with_lines', {
            p_site_id: body.store_id,
            p_supplier_id: body.supplier_id || null,
            p_location_id: body.location_id,
            p_lines: body.lines,
            p_expected_at: body.expected_at?.toISOString() || null,
            p_notes: body.notes || null,
            p_actor_id: customUser.id,
            p_request_id: requestId(c),
            p_idempotency_key: body.idempotency_key,
        });
        if (error) throw new Error(error.message);
        const responseBody = success(data);
        await idempotency.complete({ id: claim.id, responseBody, statusCode: 201, resourceType: 'purchase_order' });
        return c.json(responseBody, 201);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /inventory/purchase-orders/:id/receive — Receive PO inventory
router.post('/purchase-orders/:id/receive', validate('json', ReceivePurchaseOrderSchema), async (c) => {
    const auth = c.get('auth');
    const purchaseOrderId = c.req.param('id');
    const body = c.get('validatedBody') as ReceivePurchaseOrderInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    const siteId = await loadPurchaseOrderSiteId(db, purchaseOrderId);
    if (!siteId || !(await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found' } }, 404);
    }

    const idempotency = new IdempotencyService(db);
    const claim = await idempotency.begin({
        siteId,
        key: body.idempotency_key,
        scope: `inventory.purchase_orders.receive:${purchaseOrderId}`,
        requestBody: body,
        requestId: requestId(c),
    });
    if (claim.kind === 'replay') return c.json(claim.responseBody as any, claim.statusCode as any);

    try {
        const { data, error } = await db.rpc('receive_purchase_order', {
            p_purchase_order_id: purchaseOrderId,
            p_lines: body.lines || null,
            p_actor_id: customUser.id,
            p_request_id: requestId(c),
            p_idempotency_key: body.idempotency_key,
        });
        if (error) throw new Error(error.message);
        const responseBody = success(data);
        await idempotency.complete({ id: claim.id, responseBody, statusCode: 200, resourceType: 'purchase_order', resourceId: purchaseOrderId });
        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// GET /inventory/transfers — List transfers
router.get('/transfers', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);

    const ownedStoreIds = storeId ? [storeId] : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);
    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    if (ownedStoreIds.length === 0) return c.json(success([]));

    const { data, error } = await db
        .from('inventory_transfers')
        .select('*, lines:inventory_transfer_lines(*)')
        .in('site_id', ownedStoreIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

    if (isMissingTableError(error, 'inventory_transfers')) return c.json(success([]));
    if (error) return c.json(dbFailureBody(), 500);

    return c.json(success(data || []));
});

// POST /inventory/transfers — Reserve stock for transfer
router.post('/transfers', validate('json', CreateTransferSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateTransferInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const idempotency = new IdempotencyService(db);
    const claim = await idempotency.begin({
        siteId: body.store_id,
        key: body.idempotency_key,
        scope: 'inventory.transfers.create',
        requestBody: body,
        requestId: requestId(c),
    });
    if (claim.kind === 'replay') return c.json(claim.responseBody as any, claim.statusCode as any);

    try {
        const { data, error } = await db.rpc('create_inventory_transfer_with_lines', {
            p_site_id: body.store_id,
            p_source_location_id: body.source_location_id,
            p_destination_location_id: body.destination_location_id,
            p_lines: body.lines,
            p_notes: body.notes || null,
            p_actor_id: customUser.id,
            p_request_id: requestId(c),
            p_idempotency_key: body.idempotency_key,
        });
        if (error) throw new Error(error.message);
        const responseBody = success(data);
        await idempotency.complete({ id: claim.id, responseBody, statusCode: 201, resourceType: 'inventory_transfer' });
        return c.json(responseBody, 201);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

router.post('/transfers/:id/ship', validate('json', ShipTransferSchema), async (c) => {
    const auth = c.get('auth');
    const transferId = c.req.param('id');
    const body = c.get('validatedBody') as ShipTransferInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    const siteId = await loadTransferSiteId(db, transferId);
    if (!siteId || !(await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Transfer not found' } }, 404);
    }

    const { data, error } = await db.rpc('ship_inventory_transfer', {
        p_transfer_id: transferId,
        p_actor_id: customUser.id,
        p_request_id: requestId(c),
        p_idempotency_key: body.idempotency_key,
    });
    if (error) return c.json(failureBody('TRANSFER_SHIP_FAILED', 'Unable to ship inventory transfer'), 400);
    return c.json(success(data));
});

router.post('/transfers/:id/receive', validate('json', ReceiveTransferSchema), async (c) => {
    const auth = c.get('auth');
    const transferId = c.req.param('id');
    const body = c.get('validatedBody') as ReceiveTransferInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    const siteId = await loadTransferSiteId(db, transferId);
    if (!siteId || !(await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Transfer not found' } }, 404);
    }

    const idempotency = new IdempotencyService(db);
    const claim = await idempotency.begin({
        siteId,
        key: body.idempotency_key,
        scope: `inventory.transfers.receive:${transferId}`,
        requestBody: body,
        requestId: requestId(c),
    });
    if (claim.kind === 'replay') return c.json(claim.responseBody as any, claim.statusCode as any);

    try {
        const { data, error } = await db.rpc('receive_inventory_transfer', {
            p_transfer_id: transferId,
            p_lines: body.lines || null,
            p_actor_id: customUser.id,
            p_request_id: requestId(c),
            p_idempotency_key: body.idempotency_key,
        });
        if (error) throw new Error(error.message);
        const responseBody = success(data);
        await idempotency.complete({ id: claim.id, responseBody, statusCode: 200, resourceType: 'inventory_transfer', resourceId: transferId });
        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// GET /inventory/levels — Get inventory levels for a store
router.get('/levels', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const productId = c.req.query('product_id');
    const lowStockOnly = c.req.query('low_stock') === 'true';
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId
        ? [storeId]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (ownedStoreIds.length === 0) {
        return c.json(paginated([], 0, page, limit));
    }

    const buildLevelsQuery = (includeProductDeletedAtFilter: boolean) => {
        let query = db
            .from('inventory_levels')
            .select(`
                id,
                product_id,
                variant_id,
                location_id,
                available,
                reserved,
                incoming,
                updated_at,
                products!inner(id,name,sku,images,store_id,track_inventory${includeProductDeletedAtFilter ? ',deleted_at' : ''}),
                product_variants(id,title,sku),
                inventory_locations(id,name,is_default,status)
            `, { count: 'exact' })
            .in('products.store_id', ownedStoreIds);

        if (includeProductDeletedAtFilter) query = query.is('products.deleted_at', null);
        if (productId) query = query.eq('product_id', productId);
        if (lowStockOnly) query = query.lte('available', 10);

        return query
            .order('available', { ascending: true })
            .range(offset, offset + limit - 1);
    };

    let { data, error, count } = await buildLevelsQuery(true);

    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildLevelsQuery(false));
    }

    if (isInventorySchemaMissingError(error)) {
        const fallback = await listProductStockInventoryRows(db, ownedStoreIds, productId, lowStockOnly, page, limit);
        if (fallback.error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(paginated(fallback.data, fallback.count, page, limit));
    }

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    const rows = ((data || []) as unknown as InventoryLevelRow[]).map((level) => ({
        id: level.id,
        product_id: level.product_id,
        variant_id: level.variant_id,
        location_id: level.location_id,
        product_name: level.products?.name || '',
        variant_title: level.product_variants?.title || null,
        sku: level.product_variants?.sku || level.products?.sku || null,
        images: level.products?.images || [],
        location_name: level.inventory_locations?.name || 'Default Location',
        available: Number(level.available || 0),
        reserved: Number(level.reserved || 0),
        incoming: Number(level.incoming || 0),
        on_hand: Number(level.available || 0) + Number(level.reserved || 0),
        sellable: Math.max(0, Number(level.available || 0) - Number(level.reserved || 0)),
        track_inventory: level.products?.track_inventory !== false,
        updated_at: level.updated_at,
    }));

    if (rows.length === 0) {
        const fallback = await listProductStockInventoryRows(db, ownedStoreIds, productId, lowStockOnly, page, limit);
        if (fallback.error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(paginated(fallback.data, fallback.count, page, limit));
    }

    return c.json(paginated(rows, count || 0, page, limit));
});

// POST /inventory/adjust — Single product inventory adjustment
router.post('/adjust', validate('json', AdjustInventorySchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as InventoryAdjustmentInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: product, error: productError } = await loadOwnedProductForInventory(db, body.product_id);

    const ownedProduct = product as ProductOwnerRow | null;
    if (
        productError ||
        !customUser ||
        !ownedProduct?.store_id ||
        !(await verifySiteOwnership(db, ownedProduct.store_id, customUser.id, auth.user.storeId))
    ) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    }

    const { data, error } = await db.rpc('adjust_inventory_level', {
        p_product_id: body.product_id,
        p_variant_id: body.variant_id || null,
        p_location_id: body.location_id || null,
        p_adjustment: body.adjustment,
        p_actor_id: customUser.id,
        p_reason: mapInventoryReason(body.reason),
        p_notes: body.notes || null,
        p_request_id: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
    });

    if (isInventorySchemaMissingError(error)) {
        return c.json({
            success: false,
            error: {
                code: 'INVENTORY_LEDGER_REQUIRED',
                message: 'Inventory adjustments require the inventory ledger migrations and adjust_inventory_level RPC.',
            },
        }, 503);
    }

    if (error) {
        return c.json({
            success: false,
            error: {
                code: 'INVENTORY_ADJUSTMENT_FAILED',
                message: 'Inventory adjustment failed',
            },
        }, 400);
    }

    return c.json(success(data));
});

// POST /inventory/bulk-adjust — Bulk inventory adjustments
router.post('/bulk-adjust', validate('json', BulkAdjustSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as BulkAdjustInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const results = [];

    for (const adj of body.adjustments) {
        const { data: product } = await db
            .from('products')
            .select('id')
            .eq('id', adj.product_id)
            .eq('store_id', body.store_id)
            .is('deleted_at', null)
            .single();

        if (!product) {
            results.push({ product_id: adj.product_id, status: 'not_found' });
            continue;
        }

        const { data, error } = await db.rpc('adjust_inventory_level', {
            p_product_id: adj.product_id,
            p_variant_id: adj.variant_id || null,
            p_location_id: adj.location_id || null,
            p_adjustment: adj.adjustment,
            p_actor_id: customUser.id,
            p_reason: mapInventoryReason(adj.reason),
            p_notes: adj.notes || null,
            p_request_id: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
        });

        results.push({
            product_id: adj.product_id,
            status: error ? 'failed' : 'adjusted',
            level: data || null,
            error: error ? 'Inventory adjustment failed' : undefined,
        });
    }

    return c.json(success({ results, total: results.length }));
});

// GET /inventory/history — Adjustment history
router.get('/history', async (c) => {
    const auth = c.get('auth');
    const productId = c.req.query('product_id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = await listOwnedStoreIds(db, customUser.id, auth.user.storeId);
    if (ownedStoreIds.length === 0) {
        return c.json(paginated([], 0, page, limit));
    }

    let query = db
        .from('inventory_adjustments')
        .select('*, products!inner(name, store_id)', { count: 'exact' })
        .in('products.store_id', ownedStoreIds);

    if (productId) query = query.eq('product_id', productId);

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (isInventorySchemaMissingError(error)) {
        return c.json(paginated([], 0, page, limit));
    }

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

async function listOwnedStoreIds(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    sessionStoreId?: string
) {
    const buildOwnedStoresQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        if (sessionStoreId) query = query.eq('id', sessionStoreId);
        return query;
    };

    let { data, error } = await buildOwnedStoresQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildOwnedStoresQuery(false));
    }
    if (error) throw new Error(`Store ownership lookup failed: ${error.message}`);

    return (data || []).map((store) => store.id as string);
}

function requestId(c: { res: { headers: Headers }; req: { header: (name: string) => string | undefined } }) {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null;
}

async function loadPurchaseOrderSiteId(
    db: ReturnType<typeof getSupabaseAdmin>,
    purchaseOrderId: string
) {
    const { data, error } = await db
        .from('purchase_orders')
        .select('site_id')
        .eq('id', purchaseOrderId)
        .is('deleted_at', null)
        .single();

    if (isMissingTableError(error, 'purchase_orders')) return null;
    if (error || !data) return null;
    return data.site_id as string;
}

async function loadTransferSiteId(
    db: ReturnType<typeof getSupabaseAdmin>,
    transferId: string
) {
    const { data, error } = await db
        .from('inventory_transfers')
        .select('site_id')
        .eq('id', transferId)
        .is('deleted_at', null)
        .single();

    if (isMissingTableError(error, 'inventory_transfers')) return null;
    if (error || !data) return null;
    return data.site_id as string;
}

export default router;
