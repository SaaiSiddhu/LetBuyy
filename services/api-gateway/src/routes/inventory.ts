// ============================================================
// INVENTORY — Locations, levels, adjustments (Doc 05 + Doc 08 § 6)
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../index';
import { executeInventoryAdjustment } from '../execution/inventory-adjustment.adapter';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { dbFailureBody, failureBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { assertStaffPermission } from '../middleware/staff-permission';
import {
    AdjustInventorySchema,
    BulkAdjustSchema,
    CreateLocationSchema,
    CreatePurchaseOrderSchema,
    CreateSupplierSchema,
    CreateTransferSchema,
    ReceivePurchaseOrderSchema,
    ReceiveTransferSchema,
    ReserveInventorySchema,
    ShipTransferSchema,
    mapInventoryAdjustmentReason,
    mapInventoryLevelRecord,
    mapProductStockInventoryRecord,
    type BulkAdjustInput,
    type CreateLocationInput,
    type CreatePurchaseOrderInput,
    type CreateSupplierInput,
    type CreateTransferInput,
    type InventoryAdjustmentInput,
    type InventoryLevelSourceRow,
    type ProductInventoryFallbackRecord,
    type ReceivePurchaseOrderInput,
    type ReceiveTransferInput,
    type ReserveInventoryInput,
    type ShipTransferInput,
    type InventoryReservationActionInput,
    InventoryReservationActionSchema,
} from '@letbuyy/commerce-core';

const router = new Hono<{ Bindings: Env }>();

type ProductOwnerRow = {
    id: string;
    store_id: string;
    stock?: number | string | null;
};

type DatabaseErrorLike = {
    code?: string;
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

async function listProductStockInventoryRows(
    db: ReturnType<typeof getSupabaseAdmin>,
    ownedStoreIds: string[],
    productId: string | undefined,
    lowStockOnly: boolean,
    page: number,
    limit: number,
) {
    const offset = (page - 1) * limit;

    const buildQuery = (includeDeletedAtFilter: boolean, includeTrackInventoryColumn: boolean, head = false) => {
        let query = db
            .from('products')
            .select(
                includeTrackInventoryColumn
                    ? 'id,name,sku,images,stock,track_inventory,updated_at'
                    : 'id,name,sku,images,stock,updated_at',
                { count: 'exact', head }
            )
            .in('store_id', ownedStoreIds);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        if (includeTrackInventoryColumn) query = query.neq('track_inventory', false);
        if (productId) query = query.eq('id', productId);
        if (lowStockOnly) query = query.lte('stock', 10);

        query = query.order('name', { ascending: true }).order('id', { ascending: true });
        return head ? query : query.range(offset, offset + limit - 1);
    };

    let includeDeletedAt = true, includeTrackInventory = true;
    let { data, error, count } = await buildQuery(includeDeletedAt, includeTrackInventory);
    if (isMissingDeletedAtError(error)) {
        includeDeletedAt = false;
        ({ data, error, count } = await buildQuery(includeDeletedAt, includeTrackInventory));
    }
    if (isMissingColumnError(error, 'track_inventory')) {
        includeTrackInventory = false;
        ({ data, error, count } = await buildQuery(includeDeletedAt, includeTrackInventory));
        if (isMissingDeletedAtError(error)) {
            includeDeletedAt = false;
            ({ data, error, count } = await buildQuery(includeDeletedAt, includeTrackInventory));
        }
    }
    if (error?.code === 'PGRST103' && offset > 0) {
        const total = await buildQuery(includeDeletedAt, includeTrackInventory, true);
        return { data: [], count: total.count ?? 0, error: total.error };
    }

    if (error) {
        return { data: [], count: 0, error };
    }

    const rows = ((data || []) as unknown as ProductInventoryFallbackRecord[]).map(mapProductStockInventoryRecord);

    return { data: rows, count: count || 0, error: null };
}

async function loadOwnedProductForInventory(
    db: ReturnType<typeof getSupabaseAdmin>,
    productId: string,
    storeId: string,
) {
    const buildProductQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('products')
            .select('id, store_id, stock')
            .eq('id', productId)
            .eq('store_id', storeId);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query.single();
    };

    let { data, error } = await buildProductQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildProductQuery(false));
    }

    return { data: data as ProductOwnerRow | null, error };
}

function rpcErrorCode(error: DatabaseErrorLike): string {
    return databaseErrorText(error).includes('insufficient_inventory')
        ? 'INSUFFICIENT_INVENTORY'
        : 'INVENTORY_MUTATION_FAILED';
}

function reservationIdFromRpc(value: unknown): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = (value as Record<string, unknown>).reservation_id;
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
}

function quantityFromRpc(value: unknown): number | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const candidate = Number((value as Record<string, unknown>).quantity);
    return Number.isFinite(candidate) ? candidate : undefined;
}

async function emitInventoryEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        storeId: string;
        eventType: 'inventory.reserved' | 'inventory.committed' | 'inventory.released';
        reservationId: string;
        productId?: string | null;
        variantId?: string | null;
        quantity?: number;
        idempotencyKey: string;
        requestId?: string | null;
        actorId?: string | null;
    },
) {
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.storeId,
        aggregateType: 'inventory',
        aggregateId: input.reservationId,
        eventType: input.eventType,
        payload: {
            site_id: input.storeId,
            reservation_id: input.reservationId,
            product_id: input.productId || undefined,
            variant_id: input.variantId || undefined,
            quantity: input.quantity,
        },
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId || null,
        actorId: input.actorId || null,
    });
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
    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

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
    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

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
    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const idempotency = new IdempotencyExecutionAdapter(db);
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
    const staffBlock = await assertStaffPermission(c, siteId, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const idempotency = new IdempotencyExecutionAdapter(db);
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
    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const idempotency = new IdempotencyExecutionAdapter(db);
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
    const staffBlock = await assertStaffPermission(c, siteId, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

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
    const staffBlock = await assertStaffPermission(c, siteId, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const idempotency = new IdempotencyExecutionAdapter(db);
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

// POST /inventory/reserve - Reserve available stock with optimistic concurrency.
router.post('/reserve', validate('json', ReserveInventorySchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as ReserveInventoryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const request = requestId(c);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const { data, error } = await db.rpc('reserve_inventory', {
        p_store_id: body.store_id,
        p_product_id: body.product_id,
        p_variant_id: body.variant_id || null,
        p_location_id: body.location_id,
        p_quantity: body.quantity,
        p_ttl_seconds: body.ttl_seconds,
        p_idempotency_key: body.idempotency_key,
        p_actor_id: customUser.id,
        p_request_id: request,
    });

    if (error) {
        const code = rpcErrorCode(error);
        return c.json(failureBody(code, code === 'INSUFFICIENT_INVENTORY' ? 'Insufficient inventory' : 'Unable to reserve inventory'), code === 'INSUFFICIENT_INVENTORY' ? 409 : 400);
    }

    const reservationId = reservationIdFromRpc(data);
    if (reservationId) {
        await emitInventoryEvent(db, {
            storeId: body.store_id,
            eventType: 'inventory.reserved',
            reservationId,
            productId: body.product_id,
            variantId: body.variant_id || null,
            quantity: quantityFromRpc(data) || body.quantity,
            idempotencyKey: `inventory.reserved:${body.store_id}:${reservationId}:${body.idempotency_key}`,
            requestId: request,
            actorId: customUser.id,
        });
    }

    return c.json(success(data), 201);
});

// POST /inventory/commit - Commit a reservation into consumed/committed stock.
router.post('/commit', validate('json', InventoryReservationActionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as InventoryReservationActionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const request = requestId(c);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const { data, error } = await db.rpc('commit_inventory_reservation', {
        p_store_id: body.store_id,
        p_reservation_id: body.reservation_id,
        p_idempotency_key: body.idempotency_key,
        p_actor_id: customUser.id,
        p_request_id: request,
    });

    if (error) return c.json(failureBody('INVENTORY_COMMIT_FAILED', 'Unable to commit inventory reservation'), 400);

    await emitInventoryEvent(db, {
        storeId: body.store_id,
        eventType: 'inventory.committed',
        reservationId: body.reservation_id,
        quantity: quantityFromRpc(data),
        idempotencyKey: `inventory.committed:${body.store_id}:${body.reservation_id}:${body.idempotency_key}`,
        requestId: request,
        actorId: customUser.id,
    });

    return c.json(success(data));
});

// POST /inventory/release - Release an active reservation back to sellable stock.
router.post('/release', validate('json', InventoryReservationActionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as InventoryReservationActionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const request = requestId(c);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const { data, error } = await db.rpc('release_inventory_reservation', {
        p_store_id: body.store_id,
        p_reservation_id: body.reservation_id,
        p_idempotency_key: body.idempotency_key,
        p_reason: body.reason || null,
        p_actor_id: customUser.id,
        p_request_id: request,
    });

    if (error) return c.json(failureBody('INVENTORY_RELEASE_FAILED', 'Unable to release inventory reservation'), 400);

    await emitInventoryEvent(db, {
        storeId: body.store_id,
        eventType: 'inventory.released',
        reservationId: body.reservation_id,
        quantity: quantityFromRpc(data),
        idempotencyKey: `inventory.released:${body.store_id}:${body.reservation_id}:${body.idempotency_key}`,
        requestId: request,
        actorId: customUser.id,
    });

    return c.json(success(data));
});

// GET /inventory/levels — Get inventory levels for a store
router.get('/levels', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const productId = c.req.query('product_id');
    const lowStockOnly = c.req.query('low_stock') === 'true';
    const page = Number(c.req.query('page') || '1');
    const requestedLimit = Number(c.req.query('limit') || '50');
    const limit = Math.min(requestedLimit, 100);
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || !Number.isSafeInteger(offset)) {
        return c.json(failureBody('BAD_REQUEST', 'page and limit must be positive whole numbers'), 400);
    }
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId
        ? [storeId]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (storeId) {
        if (auth.user.storeId && auth.user.storeId !== storeId) return c.json(failureBody('FORBIDDEN', 'Not authorized'), 403);
        const staffBlock = await assertStaffPermission(c, storeId, customUser.id, 'products:read');
        if (staffBlock) return staffBlock;
    }

    if (ownedStoreIds.length === 0) {
        return c.json(paginated([], 0, page, limit));
    }

    const buildLevelsQuery = (includeProductDeletedAtFilter: boolean, head = false) => {
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
            `, { count: 'exact', head })
            .in('store_id', ownedStoreIds)
            .in('products.store_id', ownedStoreIds);

        if (includeProductDeletedAtFilter) query = query.is('products.deleted_at', null);
        if (productId) query = query.eq('product_id', productId);
        if (lowStockOnly) query = query.lte('available', 10);

        query = query.order('available', { ascending: true }).order('id', { ascending: true });
        return head ? query : query.range(offset, offset + limit - 1);
    };

    let includeProductDeletedAt = true;
    let { data, error, count } = await buildLevelsQuery(includeProductDeletedAt);

    if (isMissingDeletedAtError(error)) {
        includeProductDeletedAt = false;
        ({ data, error, count } = await buildLevelsQuery(includeProductDeletedAt));
    }

    // A stale/past-end offset is an empty page, not an outage or a new population.
    // Only this recovery path needs a separate count request.
    if (error?.code === 'PGRST103' && offset > 0) {
        const total = await buildLevelsQuery(includeProductDeletedAt, true);
        if (total.error) return c.json(dbFailureBody(), 500);
        return c.json(paginated([], total.count ?? 0, page, limit));
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

    const rows = ((data || []) as unknown as InventoryLevelSourceRow[]).map(mapInventoryLevelRecord);

    if (rows.length === 0 && (count ?? 0) === 0) {
        const fallback = await listProductStockInventoryRows(db, ownedStoreIds, productId, lowStockOnly, page, limit);
        if (fallback.error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(paginated(fallback.data, fallback.count, page, limit));
    }

    return c.json(paginated(rows, count || 0, page, limit));
});

// POST /inventory/adjust — One actor-bound atomic receipt around the canonical stock writer.
router.post('/adjust', validate('json', AdjustInventorySchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as InventoryAdjustmentInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestedStoreId = auth.user.storeId || c.req.header('X-Store-ID') || '';
    const selectedStore = c.req.header('X-Store-ID');
    if (!customUser || !requestedStoreId || (selectedStore && selectedStore !== requestedStoreId)) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    }
    const staffBlock = await assertStaffPermission(c, requestedStoreId, customUser.id, 'products:write');
    if (staffBlock) {
        if (staffBlock.status === 403) {
            // The canonical guard has already refused ownership/write authority.
            // Classify only a proven nonmember for the existing outsider 404.
            // Any staff relationship retains the guard's exact denial response.
            const relationship = await db.from('employees').select('id')
                .eq('store_id', requestedStoreId).eq('user_id', customUser.id).limit(1).maybeSingle();
            if (!relationship.error && !relationship.data) {
                return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
            }
        }
        return staffBlock;
    }
    const raw = await c.req.json<Record<string, unknown>>();
    const key = c.req.header('X-Idempotency-Key') || c.req.header('Idempotency-Key')
        || (typeof raw.idempotency_key === 'string' ? raw.idempotency_key : '')
        || (typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : '');
    const result = await executeInventoryAdjustment(c.env, requestedStoreId, customUser.id, key, body,
        c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID());
    if (result.replayed) c.header('X-Idempotent-Replay', 'true');
    return c.json(success(result.level));
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
    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

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
            p_reason: mapInventoryAdjustmentReason(adj.reason),
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

// GET /inventory/reservations — List inventory reservations (read-only, ownership-checked)
router.get('/reservations', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const statusFilter = c.req.query('status');
    const productIdFilter = c.req.query('product_id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
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

    let query = db
        .from('inventory_reservations')
        .select('*, products!inner(name, store_id)', { count: 'exact' })
        .in('store_id', ownedStoreIds)
        .in('products.store_id', ownedStoreIds);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (productIdFilter) query = query.eq('product_id', productIdFilter);

    const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (isMissingTableError(error, 'inventory_reservations')) {
        return c.json(paginated([], 0, page, limit));
    }

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /inventory/receipts — List PO receipts and transfer receipts (read-only, ownership-checked)
router.get('/receipts', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const poIdFilter = c.req.query('po_id');
    const transferIdFilter = c.req.query('transfer_id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
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

    // Fetch PO receipts (joined to purchase_orders for site_id ownership)
    let poReceiptsData: unknown[] = [];
    let poReceiptsCount = 0;

    if (!transferIdFilter) {
        let poQuery = db
            .from('purchase_order_receipts')
            .select(
                'id, purchase_order_id, quantity_received, notes, received_at, created_at, purchase_orders!inner(id, site_id)',
                { count: 'exact' }
            )
            .in('site_id', ownedStoreIds)
            .in('purchase_orders.site_id', ownedStoreIds);

        if (poIdFilter) poQuery = poQuery.eq('purchase_order_id', poIdFilter);

        const { data: poData, error: poError, count: poCount } = await poQuery
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (poError && !isMissingTableError(poError, 'purchase_order_receipts')) {
            return c.json(dbFailureBody(), 500);
        }

        poReceiptsData = (poData || []).map((r: Record<string, unknown>) => ({
            ...(r as Record<string, unknown>),
            receipt_type: 'purchase_order',
        }));
        poReceiptsCount = poCount || 0;
    }

    // Fetch transfer receipts (joined to inventory_transfers for site_id ownership)
    let transferReceiptsData: unknown[] = [];
    let transferReceiptsCount = 0;

    if (!poIdFilter) {
        let trQuery = db
            .from('inventory_transfer_receipts')
            .select(
                'id, transfer_id, quantity_received, notes, received_at, created_at, inventory_transfers!inner(id, site_id)',
                { count: 'exact' }
            )
            .in('site_id', ownedStoreIds)
            .in('inventory_transfers.site_id', ownedStoreIds);

        if (transferIdFilter) trQuery = trQuery.eq('transfer_id', transferIdFilter);

        const { data: trData, error: trError, count: trCount } = await trQuery
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (trError && !isMissingTableError(trError, 'inventory_transfer_receipts')) {
            return c.json(dbFailureBody(), 500);
        }

        transferReceiptsData = (trData || []).map((r: Record<string, unknown>) => ({
            ...(r as Record<string, unknown>),
            receipt_type: 'transfer',
        }));
        transferReceiptsCount = trCount || 0;
    }

    const combined = [...poReceiptsData, ...transferReceiptsData].sort((a, b) => {
        const aDate = String((a as Record<string, unknown>).created_at ?? '');
        const bDate = String((b as Record<string, unknown>).created_at ?? '');
        return bDate.localeCompare(aDate);
    });

    const totalCount = poReceiptsCount + transferReceiptsCount;
    return c.json(paginated(combined, totalCount, page, limit));
});

// GET /inventory/analytics — Real aggregations over existing tables (no fabricated data)
router.get('/analytics', async (c) => {
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

    if (ownedStoreIds.length === 0) {
        return c.json(success({ low_stock_count: 0, total_skus: 0, po_by_status: {}, transfer_by_status: {} }));
    }

    const analytics: {
        low_stock_count?: number;
        total_skus?: number;
        po_by_status?: Record<string, number>;
        transfer_by_status?: Record<string, number>;
    } = {};

    // Low-stock count from inventory_levels (available <= 10 as low threshold)
    const { data: levelData, error: levelError } = await db
        .from('inventory_levels')
        .select('id, products!inner(store_id)', { count: 'exact' })
        .in('store_id', ownedStoreIds)
        .in('products.store_id', ownedStoreIds)
        .lte('available', 10);

    if (!levelError && !isInventorySchemaMissingError(levelError)) {
        analytics.low_stock_count = (levelData || []).length;
    }

    // Total SKU count from products table (non-deleted products)
    const buildSkuQuery = (includeDeletedAt: boolean) => {
        let q = db
            .from('products')
            .select('id', { count: 'exact', head: true })
            .in('store_id', ownedStoreIds);
        if (includeDeletedAt) q = q.is('deleted_at', null);
        return q;
    };

    let { count: skuCount, error: skuError } = await buildSkuQuery(true);
    if (isMissingDeletedAtError(skuError)) {
        ({ count: skuCount, error: skuError } = await buildSkuQuery(false));
    }
    if (!skuError) {
        analytics.total_skus = skuCount || 0;
    }

    // PO counts grouped by status
    const { data: poData, error: poError } = await db
        .from('purchase_orders')
        .select('status')
        .in('site_id', ownedStoreIds)
        .is('deleted_at', null);

    if (!poError && !isMissingTableError(poError, 'purchase_orders')) {
        const byStatus: Record<string, number> = {};
        for (const row of poData || []) {
            const s = String(row.status ?? 'unknown');
            byStatus[s] = (byStatus[s] || 0) + 1;
        }
        analytics.po_by_status = byStatus;
    }

    // Transfer counts grouped by status
    const { data: trData, error: trError } = await db
        .from('inventory_transfers')
        .select('status')
        .in('site_id', ownedStoreIds)
        .is('deleted_at', null);

    if (!trError && !isMissingTableError(trError, 'inventory_transfers')) {
        const byStatus: Record<string, number> = {};
        for (const row of trData || []) {
            const s = String(row.status ?? 'unknown');
            byStatus[s] = (byStatus[s] || 0) + 1;
        }
        analytics.transfer_by_status = byStatus;
    }

    return c.json(success(analytics));
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
        .in('store_id', ownedStoreIds);

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
