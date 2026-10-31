import { resolveMerchantResourceStoreIds } from '../lib/tenant-context';
// ============================================================
// INVENTORY — Locations, levels, adjustments (Doc 05 + Doc 08 § 6)
// ============================================================

import { Hono } from 'hono';
import { InventoryReservationSchema, InventoryReceiptSchema, WarehousePurchaseOrderPageSchema,WarehouseTransferPageSchema,
 WAREHOUSE_COMMAND_PROTOCOL_HEADER,WAREHOUSE_COMMAND_PROTOCOL_VERSION,isWarehouseCommandPath } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { executeInventoryAdjustment } from '../execution/inventory-adjustment.adapter';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { dbFailureBody, failureBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { executeWarehouseCommand } from '../execution/warehouse-command.adapter';
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
    StopWarehouseCommandSchema,
    prepareWarehouseCommand,
    WarehousePurchaseOrderListQuerySchema,WarehouseTransferListQuerySchema,
    WarehouseCommandCapabilitiesQuerySchema,
    type WarehouseCommandCapabilitiesQuery,
    type StopWarehouseCommandInput,
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
    InventoryHistoryQuerySchema,
    type InventoryHistoryQuery,
    InventoryReservationListQuerySchema,
    InventoryReceiptListQuerySchema,
    type InventoryReservationListQuery,
    type InventoryReceiptListQuery,
} from '@letbuyy/commerce-core';

const router = new Hono<{ Bindings: Env }>();
router.use('*',async(c,next)=>{
 if(c.req.method==='POST'&&isWarehouseCommandPath(c.req.path)&&c.req.header(WAREHOUSE_COMMAND_PROTOCOL_HEADER)!==WAREHOUSE_COMMAND_PROTOCOL_VERSION)
  return c.json(failureBody('WAREHOUSE_CLIENT_UPGRADE_REQUIRED','Update the Merchant app before changing warehouse stock.'),426);
 await next();
});
router.get('/command-capabilities',validate('query',WarehouseCommandCapabilitiesQuerySchema),async c=>{
 c.header('Cache-Control','private, no-store');
 const {store_id:storeId}=c.get('validatedQuery') as WarehouseCommandCapabilitiesQuery;
 const db=getSupabaseAdmin(c),auth=c.get('auth'),actor=await resolveCustomUser(db,auth.user);
 if(!actor||!await verifySiteOwnership(db,storeId,actor.id,auth.user.storeId))
  return c.json(failureBody('FORBIDDEN','Your access to this store changed.'),403);
 // This owner never falls back to the legacy split-commit writer. Missing SQL
 // support fails closed at execution; this descriptor does not assert readiness.
 return c.json(success({store_id:storeId,actor_id:actor.id,protocol_version:WAREHOUSE_COMMAND_PROTOCOL_VERSION,
  effect_policy:'atomic_receipt_or_unavailable',stop_supported:true}));
});
function scopedInventoryPage<T>(rows: T[], total: number, page: number, limit: number, storeId?: string) {
    const body = paginated(rows, total, page, limit);
    return { ...body, meta: { ...body.meta, store_id: storeId ?? null } };
}

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
        .insert({ store_id: body.store_id, name: body.name, is_default: body.is_default,
            address: { address: body.address || '', city: body.city || '', state: body.state || '', country: body.country },
            created_by: customUser.id, updated_by: customUser.id })
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

    return c.json(success({ ...data, address: body.address || '', city: body.city || '', state: body.state || '', country: body.country }), 201);
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
router.get('/purchase-orders',validate('query',WarehousePurchaseOrderListQuerySchema), async c=>{
    c.header('Cache-Control','private, no-store');
    const query=WarehousePurchaseOrderListQuerySchema.parse(c.get('validatedQuery'));
    const db=getSupabaseAdmin(c),auth=c.get('auth'),actor=await resolveCustomUser(db,auth.user);
    if(!actor||!await verifySiteOwnership(db,query.store_id,actor.id,auth.user.storeId))
        return c.json(failureBody('FORBIDDEN','Your access to this store changed.'),403);
    const buildRead=(head=false)=>{
        let read=db.from('purchase_orders').select('*, supplier:suppliers(id,site_id,name), lines:purchase_order_lines(*)',{count:'exact',head})
            .eq('site_id',query.store_id).is('deleted_at',null).is('lines.deleted_at',null);
        if(query.status)read=read.eq('status',query.status);
        if(query.search)read=read.ilike('po_number','%'+query.search.replace(/[\\%_]/g,'\\$&')+'%');
        return read;
    };
    const ascending=query.sort==='oldest',offset=(query.page-1)*query.limit;
    let {data,error,count}=await buildRead().order('created_at',{ascending}).order('id',{ascending})
        .range(offset,offset+query.limit-1);
    // A page may disappear between requests. Confirm the same filtered population;
    // never turn a missing count or an unrelated database failure into zero rows.
    if(offset>0&&(error?.code==='PGRST103'||(!error&&Array.isArray(data)&&data.length===0&&count===null))){
        const recovered=await buildRead(true);
        if(recovered.error||recovered.count===null)return c.json(failureBody('WAREHOUSE_DOCUMENTS_UNVERIFIED','These warehouse records could not be confirmed.'),503);
        data=[];count=recovered.count;error=null;
    }
    if(error)return c.json(dbFailureBody(),500);
    if(!Array.isArray(data)||count===null)return c.json(failureBody('WAREHOUSE_DOCUMENTS_UNVERIFIED','These warehouse records could not be confirmed.'),503);
    const body=scopedInventoryPage(data,count,query.page,query.limit,query.store_id);
    const page={...body,meta:{...body.meta,total_is_exact:true}};
    const parsed=WarehousePurchaseOrderPageSchema.safeParse(page);
    if(!parsed.success)return c.json(failureBody('WAREHOUSE_DOCUMENTS_UNVERIFIED','These warehouse records could not be confirmed.'),503);
    return c.json(parsed.data);
});

// Stop the logical request, not the business PO/transfer. An already applied
// acknowledgement is recovered instead of pretending its stock effect was undone.
router.post('/commands/stop', validate('json', StopWarehouseCommandSchema), async c => {
    const body=c.get('validatedBody') as StopWarehouseCommandInput;
    const db=getSupabaseAdmin(c),auth=c.get('auth');
    const actor=await resolveCustomUser(db,auth.user);
    if(!actor||!await verifySiteOwnership(db,body.store_id,actor.id,auth.user.storeId)) {
        return c.json(failureBody('FORBIDDEN','Your access to this store changed.'),403);
    }
    const blocked=await assertStaffPermission(c,body.store_id,actor.id,'products:write');if(blocked)return blocked;
    const data=await executeWarehouseCommand(c.env,body.store_id,actor.id,body.idempotency_key,
        body.operation,body.target_id,body.command,requestId(c),true);
    return c.json(success(data));
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

    const data = await executeWarehouseCommand(c.env, body.store_id, customUser.id, body.idempotency_key,
        'purchase_order.create', null, prepareWarehouseCommand('purchase_order.create',null,body).command, requestId(c));
    return c.json(success(data), 201);
});

// POST /inventory/purchase-orders/:id/receive — Receive PO inventory
router.post('/purchase-orders/:id/receive', validate('json', ReceivePurchaseOrderSchema), async (c) => {
    const auth = c.get('auth');
    const purchaseOrderId = c.req.param('id');
    const body = c.get('validatedBody') as ReceivePurchaseOrderInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    const siteId = await loadPurchaseOrderSiteId(db, purchaseOrderId, await resolveMerchantResourceStoreIds(c));
    if (!siteId || !(await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found' } }, 404);
    }
    const staffBlock = await assertStaffPermission(c, siteId, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const data = await executeWarehouseCommand(c.env, siteId, customUser.id, body.idempotency_key,
        'purchase_order.receive', purchaseOrderId, prepareWarehouseCommand('purchase_order.receive',purchaseOrderId,body).command, requestId(c));
    return c.json(success(data));
});

// GET /inventory/transfers — List transfers
router.get('/transfers',validate('query',WarehouseTransferListQuerySchema), async c=>{
    c.header('Cache-Control','private, no-store');
    const query=WarehouseTransferListQuerySchema.parse(c.get('validatedQuery'));
    const db=getSupabaseAdmin(c),auth=c.get('auth'),actor=await resolveCustomUser(db,auth.user);
    if(!actor||!await verifySiteOwnership(db,query.store_id,actor.id,auth.user.storeId))
        return c.json(failureBody('FORBIDDEN','Your access to this store changed.'),403);
    const buildRead=(head=false)=>{
        let read=db.from('inventory_transfers').select('*, lines:inventory_transfer_lines(*)',{count:'exact',head})
            .eq('site_id',query.store_id).is('deleted_at',null).is('lines.deleted_at',null);
        if(query.status)read=read.eq('status',query.status);
        if(query.search)read=read.ilike('transfer_number','%'+query.search.replace(/[\\%_]/g,'\\$&')+'%');
        return read;
    };
    const ascending=query.sort==='oldest',offset=(query.page-1)*query.limit;
    let {data,error,count}=await buildRead().order('created_at',{ascending}).order('id',{ascending})
        .range(offset,offset+query.limit-1);
    // A page may disappear between requests. Confirm the same filtered population;
    // never turn a missing count or an unrelated database failure into zero rows.
    if(offset>0&&(error?.code==='PGRST103'||(!error&&Array.isArray(data)&&data.length===0&&count===null))){
        const recovered=await buildRead(true);
        if(recovered.error||recovered.count===null)return c.json(failureBody('WAREHOUSE_DOCUMENTS_UNVERIFIED','These warehouse records could not be confirmed.'),503);
        data=[];count=recovered.count;error=null;
    }
    if(error)return c.json(dbFailureBody(),500);
    if(!Array.isArray(data)||count===null)return c.json(failureBody('WAREHOUSE_DOCUMENTS_UNVERIFIED','These warehouse records could not be confirmed.'),503);
    const body=scopedInventoryPage(data,count,query.page,query.limit,query.store_id);
    const page={...body,meta:{...body.meta,total_is_exact:true}};
    const parsed=WarehouseTransferPageSchema.safeParse(page);
    if(!parsed.success)return c.json(failureBody('WAREHOUSE_DOCUMENTS_UNVERIFIED','These warehouse records could not be confirmed.'),503);
    return c.json(parsed.data);
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

    const data = await executeWarehouseCommand(c.env, body.store_id, customUser.id, body.idempotency_key,
        'transfer.create', null, prepareWarehouseCommand('transfer.create',null,body).command, requestId(c));
    return c.json(success(data), 201);
});

router.post('/transfers/:id/ship', validate('json', ShipTransferSchema), async (c) => {
    const auth = c.get('auth');
    const transferId = c.req.param('id');
    const body = c.get('validatedBody') as ShipTransferInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    const siteId = await loadTransferSiteId(db, transferId, await resolveMerchantResourceStoreIds(c));
    if (!siteId || !(await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Transfer not found' } }, 404);
    }
    const staffBlock = await assertStaffPermission(c, siteId, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const data = await executeWarehouseCommand(c.env, siteId, customUser.id, body.idempotency_key,
        'transfer.ship', transferId, prepareWarehouseCommand('transfer.ship',transferId,body).command, requestId(c));
    return c.json(success(data));
});

router.post('/transfers/:id/receive', validate('json', ReceiveTransferSchema), async (c) => {
    const auth = c.get('auth');
    const transferId = c.req.param('id');
    const body = c.get('validatedBody') as ReceiveTransferInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    const siteId = await loadTransferSiteId(db, transferId, await resolveMerchantResourceStoreIds(c));
    if (!siteId || !(await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Transfer not found' } }, 404);
    }
    const staffBlock = await assertStaffPermission(c, siteId, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const data = await executeWarehouseCommand(c.env, siteId, customUser.id, body.idempotency_key,
        'transfer.receive', transferId, prepareWarehouseCommand('transfer.receive',transferId,body).command, requestId(c));
    return c.json(success(data));
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
router.get('/reservations', validate('query', InventoryReservationListQuerySchema), async (c) => {
    const auth = c.get('auth');
    const q = c.get('validatedQuery') as InventoryReservationListQuery;
    const { status: statusFilter, product_id: productIdFilter, page, limit } = q;
    const storeId = q.store_id ?? auth.user.storeId;
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
        return c.json(scopedInventoryPage([], 0, page, limit, storeId));
    }

    const unavailable = () => c.json(failureBody('INVENTORY_RESERVATIONS_UNAVAILABLE', 'Inventory reservations are unavailable. Try again.'), 503);
    const buildQuery = (head = false) => {
        let query = db.from('inventory_reservations')
            .select('id,store_id,product_id,variant_id,location_id,order_id,quantity,status,expires_at,created_at,updated_at,products!inner(name,store_id)', { count: 'exact', head })
            .in('store_id', ownedStoreIds).in('products.store_id', ownedStoreIds)
            .is('deleted_at', null);
        if (statusFilter) query = query.eq('status', statusFilter);
        if (productIdFilter) query = query.eq('product_id', productIdFilter);
        return query;
    };
    const { data, error, count } = await buildQuery()
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);

    if ((!error && !data?.length && offset > 0) || (error?.code === 'PGRST103' && offset > 0)) {
        const recovered = await buildQuery(true);
        if (recovered.error || recovered.count == null || !Number.isSafeInteger(recovered.count) || recovered.count < 0) return unavailable();
        return c.json(scopedInventoryPage([], recovered.count, page, limit, storeId));
    }
    if (error || count == null || !Number.isSafeInteger(count) || count < 0 || (data?.length ?? 0) > limit || (data?.length ?? 0) > count) return unavailable();
    const rows = InventoryReservationSchema.array().safeParse(data ?? []);
    if (!rows.success || rows.data.some(row => !ownedStoreIds.includes(row.store_id) || row.products.store_id !== row.store_id ||
        (productIdFilter && row.product_id !== productIdFilter) || (statusFilter && row.status !== statusFilter))) return unavailable();
    return c.json(scopedInventoryPage(rows.data, count, page, limit, storeId));
});

// GET /inventory/receipts — List PO receipts and transfer receipts (read-only, ownership-checked)
router.get('/receipts', validate('query', InventoryReceiptListQuerySchema), async (c) => {
    const auth = c.get('auth');
    const q=c.get('validatedQuery') as InventoryReceiptListQuery;
    const {page,limit}=q;
    const storeId=q.store_id ?? auth.user.storeId;
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
        return c.json(scopedInventoryPage([], 0, page, limit, storeId));
    }

    const {data,error}=await db.rpc('read_merchant_inventory_receipts',{
        p_site_ids:ownedStoreIds,p_page:page,p_limit:limit,p_po_id:q.po_id ?? null,p_transfer_id:q.transfer_id ?? null,
    });
    const unavailable = () => c.json(failureBody('INVENTORY_RECEIPTS_UNAVAILABLE', 'Inventory receipts are unavailable. Try again.'), 503);
    if(error || !data || !Array.isArray(data.rows) || !Number.isSafeInteger(data.total) || data.total < 0 || data.rows.length > limit || data.rows.length > data.total) return unavailable();
    const rows = InventoryReceiptSchema.array().safeParse(data.rows);
    if (!rows.success || rows.data.some(row => {
        const parent = row.receipt_type === 'purchase_order' ? row.purchase_orders : row.inventory_transfers;
        return !ownedStoreIds.includes(parent.site_id) ||
            (q.po_id && (row.receipt_type !== 'purchase_order' || row.purchase_order_id !== q.po_id)) ||
            (q.transfer_id && (row.receipt_type !== 'transfer' || row.transfer_id !== q.transfer_id));
    })) return unavailable();
    return c.json(scopedInventoryPage(rows.data,data.total,page,limit,storeId));
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
router.get('/history', validate('query', InventoryHistoryQuerySchema), async (c) => {
    const auth = c.get('auth');
    const { store_id: requestedStore, product_id: productId, page, limit } = c.get('validatedQuery') as InventoryHistoryQuery;
    const storeId = requestedStore ?? auth.user.storeId;
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (storeId) {
        if (auth.user.storeId && auth.user.storeId !== storeId) return c.json(failureBody('FORBIDDEN', 'Not authorized'), 403);
        const staffBlock = await assertStaffPermission(c, storeId, customUser.id, 'products:read');
        if (staffBlock) return staffBlock;
    }
    const ownedStoreIds = storeId ? [storeId] : await listOwnedStoreIds(db, customUser.id);
    const result = (rows: unknown[], total: number) => {
        const body = paginated(rows, total, page, limit);
        return { ...body, meta: { ...body.meta, store_id: storeId ?? null } };
    };
    const unavailable = () => c.json(failureBody('INVENTORY_HISTORY_UNAVAILABLE', 'Inventory history is unavailable. Try again.'), 503);
    if (ownedStoreIds.length === 0) {
        return c.json(result([], 0));
    }

    const buildQuery = (head = false) => {
        let query = db.from('inventory_adjustments')
            .select('*, products!inner(name, store_id)', { count: 'exact', head })
            .in('store_id', ownedStoreIds)
            .in('products.store_id', ownedStoreIds);
        if (productId) query = query.eq('product_id', productId);
        return query;
    };
    const { data, error, count } = await buildQuery()
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);

    // PostgREST may omit Content-Range for an empty far page or answer PGRST103.
    // Confirm the same authorized population; absence of a count is not zero.
    if ((!error && !data?.length && offset > 0) || (error?.code === 'PGRST103' && offset > 0)) {
        const recovered = await buildQuery(true);
        if (recovered.error || recovered.count == null) return unavailable();
        return c.json(result([], recovered.count));
    }
    if (error || count == null) return unavailable();
    return c.json(result(data || [], count));
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
    purchaseOrderId: string,
    storeIds: string[]
) {
    const { data, error } = await db
        .from('purchase_orders')
        .select('site_id')
        .eq('id', purchaseOrderId).in('site_id', storeIds)
        .is('deleted_at', null)
        .single();

    if (isMissingTableError(error, 'purchase_orders')) return null;
    if (error || !data) return null;
    return data.site_id as string;
}

async function loadTransferSiteId(
    db: ReturnType<typeof getSupabaseAdmin>,
    transferId: string,
    storeIds: string[]
) {
    const { data, error } = await db
        .from('inventory_transfers')
        .select('site_id')
        .eq('id', transferId).in('site_id', storeIds)
        .is('deleted_at', null)
        .single();

    if (isMissingTableError(error, 'inventory_transfers')) return null;
    if (error || !data) return null;
    return data.site_id as string;
}

export default router;
