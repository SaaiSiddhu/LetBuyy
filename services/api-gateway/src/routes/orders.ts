import { verifyMerchantStepUp } from '../lib/merchant-step-up';
import {tryRestoreGiftCardForReversedOrder} from '../lib/gift-card-refund-recovery';
import { stepUpErrorBody } from '../lib/security-controls';
import { tryRestoreRedeemedLoyalty } from '../lib/loyalty-refund-recovery';
import { Hono } from 'hono';
import { AppError } from '../lib/errors';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { cursorPaginated, dbErrorBody, decodeListCursor, encodeListCursor, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { assertStaffPermission } from '../middleware/staff-permission';
import { OrderExecutionAdapter } from '../execution/order-execution.adapter';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { resolveTenantContextForOrder, resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { bytesToBase64, createSimplePdfBytes } from '../lib/simple-pdf';
import { listOwnedStoreIds } from '../lib/order-ownership';
import {
    ORDER_LIST_COLUMN_NAMES,
    ORDER_LIST_COLUMNS_RELATIONAL,
    databaseErrorText,
    hydrateOrderItems,
    isMissingColumnError,
    isMissingOrderItemsRelation,
    missingColumnFromError,
    orderItemsRelationalReadsEnabled,
    orderListColumns,
    recordValue,
    textValue,
    type DatabaseErrorLike,
    type OrderItemRelationRow,
    type ProductSnapshotRow,
} from '../lib/order-read-compat';
import {
    CreateOrderSchema,
    UpdateOrderStatusSchema,
    FulfillOrderSchema,
    UpdateOrderLineItemsSchema,
    ListDraftOrdersQuery,
    CreateDraftOrderSchema,
    ConvertDraftOrderSchema,
    RefundOrderSchema,
    CompleteRefundSchema,
    ListOrdersQuery,
    type CreateOrderInput,
    type UpdateOrderStatusInput,
    type FulfillOrderInput,
    type UpdateOrderLineItemsInput,
    type ListDraftOrdersInput,
    type CreateDraftOrderInput,
    type ConvertDraftOrderInput,
    type RefundOrderInput,
    type CompleteRefundInput,
    type ListOrdersInput as ListOrdersQueryInput,
} from '../schemas/order.schema';
import {
    normalizeOrderRecord,
    type OrderSourceRow,
} from '@letbuyy/checkout-core';
import {
    createLogisticsProvider,
    toFulfillmentTrackingFields,
    type LogisticsAddress,
    type LogisticsProviderName,
} from '@letbuyy/infrastructure/logistics-adapter';

const router = new Hono<{ Bindings: Env }>();
type OrderEventType =
    | 'order.created'
    | 'order.paid'
    | 'order.confirmed_cod'
    | 'order.fulfilled'
    | 'order.delivered'
    | 'order.cancelled'
    | 'order.rto'
    | 'order.returned'
    | 'order.refunded'
    | 'order.risk_assessed';


type FulfillmentOrderSnapshot = {
    order_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    shipping_address?: unknown;
};


const DRAFT_ORDER_COLUMNS = [
    'id',
    'site_id',
    'customer_email',
    'customer_name',
    'customer_phone',
    'customer_gstin',
    'shipping_address',
    'payment_method',
    'shipping_method',
    'notes',
    'coupon_code',
    'gift_card_code',
    'status',
    'converted_order_id',
    'idempotency_key',
    'metadata',
    'created_at',
    'updated_at',
].join(',');

type DraftOrderRow = {
    id: string;
    site_id: string;
    customer_email: string;
    customer_name: string;
    customer_phone?: string | null;
    customer_gstin?: string | null;
    shipping_address?: unknown;
    payment_method?: string | null;
    shipping_method?: string | null;
    notes?: string | null;
    coupon_code?: string | null;
    gift_card_code?: string | null;
    status: 'draft' | 'converted' | 'discarded';
    converted_order_id?: string | null;
    idempotency_key?: string | null;
    metadata?: unknown;
    created_at: string;
    updated_at: string;
};

type DraftOrderLineRow = {
    id: string;
    draft_order_id: string;
    site_id: string;
    product_id: string;
    variant_id?: string | null;
    quantity: number | string | null;
};


function firstText(record: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = textValue(record[key]);
        if (value) return value;
    }
    return null;
}

function numberValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function htmlEscape(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function orderTotalPayload(record: Record<string, unknown>): { amount_minor: number; currency: 'INR' } | undefined {
    const minorUnits = numberValue(record.total_minor) ?? numberValue(record.total_amount_minor) ?? numberValue(record.amount_minor);
    if (minorUnits !== null && Number.isInteger(minorUnits) && minorUnits >= 0) {
        return { amount_minor: minorUnits, currency: 'INR' };
    }

    const total = numberValue(record.total);
    if (total !== null && total >= 0) {
        return { amount_minor: Math.round(total * 100), currency: 'INR' };
    }

    return undefined;
}

function normalizeDraftOrderRecord(
    draft: DraftOrderRow,
    lines: DraftOrderLineRow[],
): Record<string, unknown> {
    return {
        id: draft.id,
        site_id: draft.site_id,
        store_id: draft.site_id,
        customer_email: draft.customer_email,
        customer_name: draft.customer_name,
        customer_phone: draft.customer_phone || null,
        customer_gstin: draft.customer_gstin || null,
        shipping_address: draft.shipping_address || {},
        payment_method: draft.payment_method || 'cod',
        shipping_method: draft.shipping_method || 'standard',
        notes: draft.notes || null,
        coupon_code: draft.coupon_code || null,
        gift_card_code: draft.gift_card_code || null,
        status: draft.status,
        converted_order_id: draft.converted_order_id || null,
        metadata: draft.metadata || {},
        created_at: draft.created_at,
        updated_at: draft.updated_at,
        items: lines.map((line) => ({
            id: line.id,
            product_id: line.product_id,
            variant_id: line.variant_id || null,
            quantity: Math.max(1, Math.trunc(numberValue(line.quantity) || 1)),
        })),
    };
}

// Phase M1 (DOC 03 row 11 "Payments"): Razorpay + COD are the only live
// money-in rails. draft_orders_payment_method_check (migration 116) still
// permits 'stripe'/'cashfree' at the storage layer and was never narrowed
// alongside CreateDraftOrderSchema (narrowed to razorpay/cod, M1), so a
// pre-M1 draft can still carry a retired rail today. Coercing it to 'cod'
// would silently convert a merchant's prepaid draft into cash-on-delivery
// -- changing how the customer pays without anyone being told, which is
// exactly the "stub reads as success" failure the honesty law forbids.
// Reject instead: the merchant recreates the draft with a live rail.
export function normalizeDraftOrderPaymentMethod(value: string | null | undefined): 'razorpay' | 'cod' | null {
    if (value === 'razorpay' || value === 'cod') return value;
    return null;
}

async function loadDraftOrder(
    db: ReturnType<typeof getSupabaseAdmin>,
    draftId: string,
): Promise<{ draft: DraftOrderRow; lines: DraftOrderLineRow[] } | null> {
    const { data: draft, error } = await db
        .from('draft_orders')
        .select(DRAFT_ORDER_COLUMNS)
        .eq('id', draftId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error('Draft order lookup failed');
    if (!draft) return null;

    const { data: lines, error: linesError } = await db
        .from('draft_order_lines')
        .select('id,draft_order_id,site_id,product_id,variant_id,quantity')
        .eq('draft_order_id', draftId)
        .eq('site_id', (draft as unknown as DraftOrderRow).site_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (linesError) throw new Error('Draft order line lookup failed');

    return {
        draft: draft as unknown as DraftOrderRow,
        lines: (lines || []) as DraftOrderLineRow[],
    };
}

async function emitOrderEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        eventType: OrderEventType;
        order: unknown;
        fallbackOrderId?: string;
        siteId: string;
        actorId?: string | null;
        requestId?: string | null;
    },
): Promise<void> {
    const order = recordValue(input.order);
    const orderId = textValue(order.id) || textValue(order.order_id) || input.fallbackOrderId;
    if (!orderId) return;

    const total = orderTotalPayload(order);
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'order',
        aggregateId: orderId,
        eventType: input.eventType,
        payload: {
            site_id: input.siteId,
            order_id: orderId,
            order_number: textValue(order.order_number) || undefined,
            customer_id: textValue(order.customer_id) || undefined,
            ...(total ? { total } : {}),
        },
        idempotencyKey: `${input.eventType}:${input.siteId}:${orderId}:${input.requestId || crypto.randomUUID()}`,
        requestId: input.requestId || null,
        actorId: input.actorId || null,
    });
}

function orderEventsForStatus(status: UpdateOrderStatusInput['status']): OrderEventType[] {
    if (status === 'delivered') return ['order.delivered'];
    if (status === 'shipped') return ['order.fulfilled'];
    if (status === 'cancelled') return ['order.cancelled'];
    return [];
}

function replayHttpStatus(statusCode: number): 200 | 201 | 202 {
    if (statusCode === 201) return 201;
    if (statusCode === 202) return 202;
    return 200;
}

async function draftProductsBelongToSite(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    items: CreateDraftOrderInput['items'],
): Promise<boolean> {
    const productIds = Array.from(new Set(items.map((item) => item.product_id)));
    if (productIds.length === 0) return false;

    const { data, error } = await db
        .from('products')
        .select('id')
        .eq('store_id', siteId)
        .in('id', productIds)
        .is('deleted_at', null);

    if (error) throw new Error('Draft order product lookup failed');

    const found = new Set((data || []).map((row) => String((row as Record<string, unknown>).id)));
    return productIds.every((productId) => found.has(productId));
}

function buildLogisticsDestination(order: FulfillmentOrderSnapshot): LogisticsAddress {
    const shippingAddress = recordValue(order.shipping_address);
    const line1 = firstText(shippingAddress, ['line1', 'address_line1', 'address']);
    const city = firstText(shippingAddress, ['city']);
    const state = firstText(shippingAddress, ['state']);
    const postalCode = firstText(shippingAddress, ['zip', 'postal_code', 'pincode']);

    if (!line1 || !city || !state || !postalCode) {
        throw new Error('Shipping label creation requires a complete destination address');
    }

    return {
        name: firstText(shippingAddress, ['name', 'full_name']) || textValue(order.customer_name) || 'Customer',
        phone: firstText(shippingAddress, ['phone']) || textValue(order.customer_phone),
        email: firstText(shippingAddress, ['email']) || textValue(order.customer_email),
        line1,
        line2: firstText(shippingAddress, ['line2', 'address_line2']),
        city,
        state,
        postalCode,
        country: firstText(shippingAddress, ['country']) || 'IN',
    };
}

async function applyLogisticsLabel(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    orderId: string,
    input: FulfillOrderInput,
    environment: Env['ENVIRONMENT'],
): Promise<FulfillOrderInput> {
    if (!input.create_shipping_label || !input.logistics_provider) return input;
    // Manual fulfillment remains available; a simulated AWB cannot establish
    // carrier acceptance or advance a real production shipment.
    if (environment === 'production') {
        throw new AppError('Carrier booking is not connected. Use manual fulfillment with your carrier’s tracking details.', 503, 'CARRIER_SETUP_REQUIRED');
    }

    const { data, error } = await db
        .from('orders')
        .select('order_number,customer_name,customer_phone,customer_email,shipping_address')
        .eq('id', orderId)
        .eq('store_id', siteId)
        .maybeSingle();

    if (error) throw new Error(`Order lookup for logistics failed: ${error.message}`);
    if (!data) throw new Error('Order not found for logistics label creation');

    const order = data as FulfillmentOrderSnapshot;
    const provider = createLogisticsProvider(input.logistics_provider as LogisticsProviderName, { mode: 'sandbox' });
    const dimensions = input.package_dimensions_cm;
    const label = await provider.createLabel({
        orderId,
        orderNumber: textValue(order.order_number) || orderId,
        idempotencyKey: input.idempotency_key,
        destination: buildLogisticsDestination(order),
        parcels: [{
            weightGrams: input.package_weight_grams || 500,
            lengthCm: dimensions?.length,
            widthCm: dimensions?.width,
            heightCm: dimensions?.height,
        }],
        metadata: {
            site_id: siteId,
            source: 'orders.fulfill',
        },
    });
    const tracking = toFulfillmentTrackingFields(label);

    return {
        ...input,
        carrier: input.carrier || tracking.carrier,
        tracking_number: input.tracking_number || tracking.tracking_number,
        tracking_url: input.tracking_url || tracking.tracking_url,
    };
}

// GET /orders — List orders for the authenticated seller
router.get('/', validate('query', ListOrdersQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ListOrdersQueryInput;
    const offset = (query.page - 1) * query.limit;
    const decodedCursor = decodeListCursor(query.cursor);
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = query.store_id
        ? [query.store_id]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (query.store_id) {
        const ownsStore = await verifySiteOwnership(db, query.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (ownedStoreIds.length === 0) {
        return c.json(paginated([], 0, query.page, query.limit));
    }

    const omittedColumns = new Set<string>();
    const buildOrdersQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('orders')
            .select(orderListColumns(c.env, omittedColumns), query.withCount ? { count: 'exact' } : undefined)
            .in('store_id', ownedStoreIds)
            .order(query.sort, { ascending: query.order === 'asc' })
            .order('id', { ascending: query.order === 'asc' });

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        // `pending_cod` is a pending order: migration 074 added the status and a trigger assigns it to
        // every COD order at creation. An exact match on 'pending' therefore hid the majority of a
        // merchant's pending orders (CAP-C59 measured 46 of 65 on the reference store). The Analytics
        // "Orders by status" card already sums both buckets, so this aligns the list with it.
        // `status=pending_cod` stays exact for callers that ask for that bucket specifically.
        if (query.status === 'pending') {
            dbQuery = dbQuery.in('status', ['pending', 'pending_cod']);
        } else if (query.status !== 'all') {
            dbQuery = dbQuery.eq('status', query.status);
        }
        if (query.payment_status !== 'all') dbQuery = dbQuery.eq('payment_status', query.payment_status);
        if (decodedCursor) {
            dbQuery = query.order === 'asc'
                ? dbQuery.gt(query.sort, decodedCursor.value)
                : dbQuery.lt(query.sort, decodedCursor.value);
        }
        if (query.search) {
            const search = query.search.replace(/[%(),]/g, '').trim();
            if (search) {
                dbQuery = dbQuery.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
            }
        }

        if (query.cursor || query.page === 1) return dbQuery.limit(query.limit + 1);
        return dbQuery.range(offset, offset + query.limit);
    };

    let includeDeletedAtFilter = true;
    let { data, error, count } = await buildOrdersQuery(includeDeletedAtFilter);

    for (let attempts = 0; error && attempts < ORDER_LIST_COLUMN_NAMES.length + 1; attempts += 1) {
        if (isMissingColumnError(error, 'deleted_at') && includeDeletedAtFilter) {
            includeDeletedAtFilter = false;
            ({ data, error, count } = await buildOrdersQuery(includeDeletedAtFilter));
            continue;
        }

        const missingColumn = missingColumnFromError(error);
        if (missingColumn && ORDER_LIST_COLUMN_NAMES.includes(missingColumn as typeof ORDER_LIST_COLUMN_NAMES[number]) && !omittedColumns.has(missingColumn)) {
            omittedColumns.add(missingColumn);
            ({ data, error, count } = await buildOrdersQuery(includeDeletedAtFilter));
            continue;
        }

        break;
    }

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    const rawRows = (data || []) as unknown as Array<Record<string, unknown>>;
    const pageRows = rawRows.slice(0, query.limit);
    const nextCursor = rawRows.length > query.limit
        ? encodeListCursor(pageRows[pageRows.length - 1] as unknown as Record<string, unknown>, query.sort)
        : null;
    const hydratedRows = orderItemsRelationalReadsEnabled(c.env)
        ? await hydrateOrderItems(db, pageRows)
        : pageRows;
    const rows = (hydratedRows as unknown as OrderSourceRow[]).map(normalizeOrderRecord);

    return c.json(cursorPaginated(rows, {
        page: query.page,
        limit: query.limit,
        total: query.withCount ? count || 0 : undefined,
        nextCursor,
    }));
});

// GET /orders/drafts — List draft orders for the authenticated merchant
router.get('/drafts', validate('query', ListDraftOrdersQuery), async (c) => {
    const query = c.get('validatedQuery') as ListDraftOrdersInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const offset = (query.page - 1) * query.limit;

    let draftQuery = db
        .from('draft_orders')
        .select(DRAFT_ORDER_COLUMNS, { count: 'exact' })
        .eq('site_id', tenant.siteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + query.limit - 1);

    if (query.status !== 'all') draftQuery = draftQuery.eq('status', query.status);

    const { data, error, count } = await draftQuery;
    if (error) return c.json(dbErrorBody(), 500);

    const drafts = (data || []) as unknown as DraftOrderRow[];
    const draftIds = drafts.map((draft) => draft.id);
    let lines: DraftOrderLineRow[] = [];
    if (draftIds.length > 0) {
        const { data: lineData, error: lineError } = await db
            .from('draft_order_lines')
            .select('id,draft_order_id,site_id,product_id,variant_id,quantity')
            .eq('site_id', tenant.siteId)
            .in('draft_order_id', draftIds)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });
        if (lineError) return c.json(dbErrorBody(), 500);
        lines = (lineData || []) as DraftOrderLineRow[];
    }

    const linesByDraft = new Map<string, DraftOrderLineRow[]>();
    for (const line of lines) {
        linesByDraft.set(line.draft_order_id, [
            ...(linesByDraft.get(line.draft_order_id) || []),
            line,
        ]);
    }

    return c.json(paginated(
        drafts.map((draft) => normalizeDraftOrderRecord(draft, linesByDraft.get(draft.id) || [])),
        count || 0,
        query.page,
        query.limit,
    ));
});

// POST /orders/drafts — Save a merchant draft order intent
router.post('/drafts', validate('json', CreateDraftOrderSchema), async (c) => {
    const body = c.get('validatedBody') as CreateDraftOrderInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: 'orders.drafts.create',
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(recordValue(claim.responseBody), replayHttpStatus(claim.statusCode));
    }

    try {
        const productsExist = await draftProductsBelongToSite(db, tenant.siteId, body.items);
        if (!productsExist) {
            await idempotency.fail(claim.id);
            return c.json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'One or more products were not found.' } }, 404);
        }

        const { data: draft, error } = await db
            .from('draft_orders')
            .insert({
                site_id: tenant.siteId,
                customer_email: body.customer_email,
                customer_name: body.customer_name,
                customer_phone: body.customer_phone || null,
                customer_gstin: body.customer_gstin || null,
                shipping_address: body.shipping_address || {},
                payment_method: body.payment_method,
                shipping_method: body.shipping_method,
                notes: body.notes || null,
                coupon_code: body.coupon_code || null,
                gift_card_code: body.gift_card_code || null,
                idempotency_key: body.idempotency_key,
                created_by: tenant.userId,
                updated_by: tenant.userId,
            })
            .select(DRAFT_ORDER_COLUMNS)
            .single();

        if (error || !draft) throw new Error('Draft order creation failed');

        const draftRow = draft as unknown as DraftOrderRow;
        const { error: lineError } = await db
            .from('draft_order_lines')
            .insert(body.items.map((item) => ({
                draft_order_id: draftRow.id,
                site_id: tenant.siteId,
                product_id: item.product_id,
                variant_id: item.variant_id || null,
                quantity: item.quantity,
            })));

        if (lineError) {
            await db
                .from('draft_orders')
                .update({ status: 'discarded', deleted_at: new Date().toISOString(), updated_by: tenant.userId })
                .eq('id', draftRow.id)
                .eq('site_id', tenant.siteId);
            throw new Error('Draft order line creation failed');
        }

        const loaded = await loadDraftOrder(db, draftRow.id);
        if (!loaded) throw new Error('Draft order reload failed');
        const responseBody = success(normalizeDraftOrderRecord(loaded.draft, loaded.lines));
        type IdempotencyResponseBody = Parameters<IdempotencyExecutionAdapter['complete']>[0]['responseBody'];
        await idempotency.complete({
            id: claim.id,
            responseBody: responseBody as unknown as IdempotencyResponseBody,
            statusCode: 201,
            resourceType: 'draft_order',
            resourceId: draftRow.id,
        });

        return c.json(responseBody, 201);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /orders/drafts/:id/convert — Convert a draft order through the canonical order engine
router.post('/drafts/:id/convert', validate('json', ConvertDraftOrderSchema), async (c) => {
    const draftId = c.req.param('id');
    const body = c.get('validatedBody') as ConvertDraftOrderInput;
    const db = getSupabaseAdmin(c);
    const loaded = await loadDraftOrder(db, draftId);
    if (!loaded) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Draft order not found' } }, 404);
    }
    if (loaded.draft.status !== 'draft') {
        return c.json({ success: false, error: { code: 'INVALID_STATUS', message: 'Draft order is not editable.' } }, 409);
    }
    if (loaded.lines.length === 0) {
        return c.json({ success: false, error: { code: 'EMPTY_DRAFT', message: 'Draft order has no items.' } }, 409);
    }
    const draftPaymentMethod = normalizeDraftOrderPaymentMethod(loaded.draft.payment_method);
    if (!draftPaymentMethod) {
        return c.json({ success: false, error: { code: 'DRAFT_PAYMENT_METHOD_RETIRED', message: 'This draft order uses a retired payment method and must be recreated.' } }, 409);
    }

    const tenant = await resolveTenantContextForOwnedSite(c, loaded.draft.site_id);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: `orders.drafts.convert:${draftId}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(recordValue(claim.responseBody), replayHttpStatus(claim.statusCode));
    }

    const service = new OrderExecutionAdapter(db);
    try {
        const order = await service.createOrder(
            {
                customer_name: loaded.draft.customer_name,
                customer_email: loaded.draft.customer_email,
                customer_phone: loaded.draft.customer_phone || undefined,
                shipping_address: recordValue(loaded.draft.shipping_address),
                customer_gstin: loaded.draft.customer_gstin || undefined,
                items: loaded.lines.map((line) => ({
                    product_id: line.product_id,
                    variant_id: line.variant_id || null,
                    quantity: Math.max(1, Math.trunc(numberValue(line.quantity) || 1)),
                })),
                payment_method: draftPaymentMethod,
                shipping_method: loaded.draft.shipping_method === 'express' ? 'express' : 'standard',
                notes: loaded.draft.notes || undefined,
                coupon_code: loaded.draft.coupon_code || undefined,
                gift_card_code: loaded.draft.gift_card_code || undefined,
                idempotency_key: body.idempotency_key,
            },
            tenant,
        );

        const orderRecord = recordValue(order);
        const orderId = textValue(orderRecord.id);
        const { error: updateError } = await db
            .from('draft_orders')
            .update({
                status: 'converted',
                converted_order_id: orderId,
                updated_by: tenant.userId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', draftId)
            .eq('site_id', tenant.siteId);

        if (updateError) throw new Error('Draft order conversion update failed');

        await emitOrderEvent(db, {
            eventType: 'order.created',
            order,
            siteId: tenant.siteId,
            actorId: tenant.userId,
            requestId: tenant.requestId,
        });

        const reloaded = await loadDraftOrder(db, draftId);
        const responseBody = success({
            draft_order: reloaded
                ? normalizeDraftOrderRecord(reloaded.draft, reloaded.lines)
                : normalizeDraftOrderRecord({ ...loaded.draft, status: 'converted', converted_order_id: orderId } as unknown as DraftOrderRow, loaded.lines),
            order,
        });
        type IdempotencyResponseBody = Parameters<IdempotencyExecutionAdapter['complete']>[0]['responseBody'];
        await idempotency.complete({
            id: claim.id,
            responseBody: responseBody as unknown as IdempotencyResponseBody,
            statusCode: 201,
            resourceType: 'order',
            resourceId: orderId || undefined,
        });

        return c.json(responseBody, 201);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// GET /orders/:id/packing-slip — Server-rendered packing slip payload
router.get('/:id/packing-slip', async (c) => {
    const orderId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);

    const { data: order, error } = await db
        .from('orders')
        .select(ORDER_LIST_COLUMNS_RELATIONAL)
        .eq('id', orderId)
        .eq('store_id', tenant.siteId)
        .single();
    if (error || !order) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
    }

    const rows = await hydrateOrderItems(db, [order as unknown as Record<string, unknown>]);
    const normalized = normalizeOrderRecord(rows[0] as unknown as OrderSourceRow);
    const normalizedRecord = normalized as unknown as Record<string, unknown>;
    const items = Array.isArray(normalizedRecord.line_items)
        ? normalizedRecord.line_items as Array<Record<string, unknown>>
        : [];
    const orderNumber = textValue(normalizedRecord.order_number) || orderId;
    const customerName = textValue(normalizedRecord.customer_name) || 'Customer';
    const customerEmail = textValue(normalizedRecord.customer_email) || '';
    const total = numberValue(normalizedRecord.total) || 0;
    const linesText = items.map((item) => {
        const name = textValue(item.name) || textValue(item.title) || 'Item';
        const quantity = numberValue(item.quantity) || 0;
        const sku = textValue(item.sku);
        return `${quantity} x ${name}${sku ? ` (${sku})` : ''}`;
    });
    const htmlRows = items.map((item) => {
        const name = textValue(item.name) || textValue(item.title) || 'Item';
        const quantity = numberValue(item.quantity) || 0;
        const sku = textValue(item.sku) || '';
        return `<tr><td>${htmlEscape(name)}${sku ? `<br><small>${htmlEscape(sku)}</small>` : ''}</td><td>${htmlEscape(quantity)}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Packing slip ${htmlEscape(orderNumber)}</title></head><body><h1>Packing slip</h1><p><strong>Order:</strong> ${htmlEscape(orderNumber)}</p><p><strong>Customer:</strong> ${htmlEscape(customerName)} ${customerEmail ? `&lt;${htmlEscape(customerEmail)}&gt;` : ''}</p><table><thead><tr><th align="left">Item</th><th align="right">Qty</th></tr></thead><tbody>${htmlRows}</tbody></table><p><strong>Total:</strong> INR ${htmlEscape(total.toFixed(2))}</p></body></html>`;
    const text = [
        'Packing slip',
        `Order: ${orderNumber}`,
        `Customer: ${customerName}${customerEmail ? ` <${customerEmail}>` : ''}`,
        '',
        ...linesText,
        '',
        `Total: INR ${total.toFixed(2)}`,
    ].join('\n');
    const pdfBytes = createSimplePdfBytes(`Packing slip ${orderNumber}`, [
        `Order: ${orderNumber}`,
        `Customer: ${customerName}${customerEmail ? ` <${customerEmail}>` : ''}`,
        '',
        ...linesText,
        '',
        `Total: INR ${total.toFixed(2)}`,
    ]);

    return c.json(success({
        order_id: orderId,
        order_number: orderNumber,
        filename: `packing-slip-${orderNumber}.pdf`,
        content_type: 'application/pdf',
        pdf_base64: bytesToBase64(pdfBytes),
        html,
        text,
    }));
});

// GET /orders/:id
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const orderId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const tenant = await resolveTenantContextForOrder(c, orderId);

    const buildOrderQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('orders')
            .select(orderItemsRelationalReadsEnabled(c.env) ? ORDER_LIST_COLUMNS_RELATIONAL : '*')
            .eq('id', orderId)
            .eq('store_id', tenant.siteId);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        return dbQuery.single();
    };

    let { data, error } = await buildOrderQuery(true);

    if (isMissingColumnError(error, 'deleted_at')) {
        ({ data, error } = await buildOrderQuery(false));
    }

    const order = data as unknown as OrderSourceRow | null;

    if (error || !order || !(await verifySiteOwnership(db, order.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
    }

    const rows = orderItemsRelationalReadsEnabled(c.env)
        ? await hydrateOrderItems(db, [order as unknown as Record<string, unknown>])
        : [order as unknown as Record<string, unknown>];

    // Legacy order.payment_id is a provider reference. Refund commands require
    // the canonical payments UUID, resolved only inside this already-owned order.
    // Multiple captured sources need reconciliation; never select an arbitrary one.
    const { data: refundPayments, error: refundPaymentError } = await db.from('payments')
        .select('id').eq('site_id', tenant.siteId).eq('order_id', orderId)
        .is('deleted_at', null).in('status', ['captured', 'partially_refunded', 'refunded']).limit(2);
    if (refundPaymentError) throw new Error('Owned order payment lookup failed');
    const candidates = refundPayments || [];
    return c.json(success({
        ...normalizeOrderRecord(rows[0] as unknown as OrderSourceRow),
        refund_payment_id: candidates.length === 1 ? candidates[0].id : null,
        refund_payment_resolution: candidates.length === 1 ? 'available' : candidates.length ? 'ambiguous' : 'not_found',
    }));
});

// PATCH /orders/:id/line-items — Edit line items and rebuild totals server-side
router.patch('/:id/line-items', validate('json', UpdateOrderLineItemsSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateOrderLineItemsInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: `orders.line_items:${orderId}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as any, claim.statusCode as any);
    }

    try {
        const removals = new Set([
            ...body.remove_line_item_ids,
            ...body.lines.filter((line) => line.quantity === 0).map((line) => line.order_item_id),
        ]);
        const quantityPatches = body.lines.filter((line) => line.quantity > 0);

        for (const line of quantityPatches) {
            const { data: existing, error: existingError } = await db
                .from('order_items')
                .select('id, price, unit_price')
                .eq('store_id', tenant.siteId)
                .eq('id', line.order_item_id)
                .eq('order_id', orderId)
                .is('deleted_at', null)
                .maybeSingle();
            if (existingError || !existing) {
                return c.json({ success: false, error: { code: 'ORDER_LINE_NOT_FOUND', message: 'Order line not found.' } }, 404);
            }
            const unitPrice = numberValue((existing as Record<string, unknown>).unit_price) ?? numberValue((existing as Record<string, unknown>).price) ?? 0;
            const { error } = await db
                .from('order_items')
                .update({
                    quantity: line.quantity,
                    unit_price: unitPrice,
                    price: unitPrice,
                    total: Math.round(unitPrice * line.quantity * 100) / 100,
                    updated_at: new Date().toISOString(),
                })
                .eq('store_id', tenant.siteId)
                .eq('id', line.order_item_id)
                .eq('order_id', orderId);
            if (error) throw new Error('Order line update failed');
        }

        if (removals.size > 0) {
            const { error } = await db
                .from('order_items')
                .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('store_id', tenant.siteId)
                .in('id', Array.from(removals))
                .eq('order_id', orderId);
            if (error) throw new Error('Order line removal failed');
        }

        for (const item of body.add_items) {
            const { data: product, error: productError } = await db
                .from('products')
                .select('id, store_id, name, title, sku, price, sale_price, images')
                .eq('id', item.product_id)
                .eq('store_id', tenant.siteId)
                .is('deleted_at', null)
                .maybeSingle();
            if (productError || !product) {
                return c.json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' } }, 404);
            }
            const productRow = product as ProductSnapshotRow;
            const unitPrice = numberValue(productRow.sale_price) ?? numberValue(productRow.price) ?? 0;
            const name = textValue(productRow.name) || textValue(productRow.title) || 'Product';
            const { error } = await db
                .from('order_items')
                .insert({
                    store_id: tenant.siteId,
                    order_id: orderId,
                    product_id: item.product_id,
                    variant_id: item.variant_id || null,
                    name,
                    title: name,
                    sku: productRow.sku || null,
                    quantity: item.quantity,
                    price: unitPrice,
                    unit_price: unitPrice,
                    total: Math.round(unitPrice * item.quantity * 100) / 100,
                    product_snapshot: productRow,
                });
            if (error) throw new Error('Order line insert failed');
        }

        const { data: activeLines, error: linesError } = await db
            .from('order_items')
            .select('total')
            .eq('store_id', tenant.siteId)
            .eq('order_id', orderId)
            .is('deleted_at', null);
        if (linesError) throw new Error('Order line total lookup failed');

        const subtotal = ((activeLines || []) as Array<Record<string, unknown>>)
            .reduce((sum, line) => sum + (numberValue(line.total) || 0), 0);
        const { data: orderForTotals, error: orderError } = await db
            .from('orders')
            .select('shipping_cost, tax, discount')
            .eq('id', orderId)
            .eq('store_id', tenant.siteId)
            .maybeSingle();
        if (orderError || !orderForTotals) throw new Error('Order total lookup failed');

        const total = Math.max(
            0,
            subtotal +
            (numberValue((orderForTotals as Record<string, unknown>).shipping_cost) || 0) +
            (numberValue((orderForTotals as Record<string, unknown>).tax) || 0) -
            (numberValue((orderForTotals as Record<string, unknown>).discount) || 0),
        );

        const { error: updateOrderError } = await db
            .from('orders')
            .update({
                subtotal: Math.round(subtotal * 100) / 100,
                total: Math.round(total * 100) / 100,
                notes: body.notes || undefined,
                updated_at: new Date().toISOString(),
                updated_by: tenant.userId,
            })
            .eq('id', orderId)
            .eq('store_id', tenant.siteId);
        if (updateOrderError) throw new Error('Order total update failed');

        const { data: order, error: loadError } = await db
            .from('orders')
            .select(orderItemsRelationalReadsEnabled(c.env) ? ORDER_LIST_COLUMNS_RELATIONAL : '*')
            .eq('id', orderId)
            .eq('store_id', tenant.siteId)
            .single();
        if (loadError || !order) throw new Error('Order reload failed');

        const rows = orderItemsRelationalReadsEnabled(c.env)
            ? await hydrateOrderItems(db, [order as unknown as Record<string, unknown>])
            : [order as unknown as Record<string, unknown>];
        const responseBody = success(normalizeOrderRecord(rows[0] as unknown as OrderSourceRow));
        type IdempotencyResponseBody = Parameters<IdempotencyExecutionAdapter['complete']>[0]['responseBody'];
        await idempotency.complete({
            id: claim.id,
            responseBody: responseBody as unknown as IdempotencyResponseBody,
            statusCode: 200,
            resourceType: 'order',
            resourceId: orderId,
        });
        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// PATCH /orders/:id — Update order status (with state machine)
router.patch('/:id', validate('json', UpdateOrderStatusSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateOrderStatusInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);

    const staffBlock = await assertStaffPermission(c, tenant.siteId, tenant.userId, 'orders:write');
    if (staffBlock) return staffBlock;

    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: `orders.transition:${orderId}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        await tryRestoreRedeemedLoyalty(db, { ...tenant, orderId });
        return c.json(claim.responseBody as any, claim.statusCode as any);
    }

    const service = new OrderExecutionAdapter(db);
    try {
        const data = await service.transitionStatus(orderId, tenant, body.status, body);
        for (const eventType of orderEventsForStatus(body.status)) {
            await emitOrderEvent(db, {
                eventType,
                order: data,
                fallbackOrderId: orderId,
                siteId: tenant.siteId,
                actorId: tenant.userId,
                requestId: tenant.requestId,
            });
        }
        // Transactional email intent is captured by migration402.
        if (body.status === 'cancelled') {
            // LB-11 — restore any gift-card balance redeemed on this order (the whole order is
            // being reversed). Idempotent + best-effort; never blocks the status change.
            try {
                const { error: restoreError } = await db.rpc('restore_gift_card_on_refund', {
                    p_store_id: tenant.siteId,
                    p_order_id: orderId,
                    p_actor_id: tenant.userId,
                    p_request_id: tenant.requestId,
                });
                if (restoreError) throw new Error('Gift-card restoration unavailable');
            } catch (restoreError) {
                console.warn(JSON.stringify({
                    level: 'warn',
                    event: 'gift_card_refund_restore_failed',
                    kind: body.status,
                    order_id: orderId,
                    error: String(restoreError),
                }));
            }
            await tryRestoreRedeemedLoyalty(db, { ...tenant, orderId });
        }
        const responseBody = success(data);
        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 200,
            resourceType: 'order',
            resourceId: orderId,
        });

        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /orders — Create an order (checkout)
// CRITICAL FIX: Prices are calculated from DB, NOT accepted from client
router.post('/', validate('json', CreateOrderSchema), async (c) => {
    const body = c.get('validatedBody') as CreateOrderInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: 'admin.orders.create',
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as any, claim.statusCode as any);
    }

    const service = new OrderExecutionAdapter(db);
    try {
        const order = await service.createOrder(
            {
                customer_name: body.customer_name,
                customer_email: body.customer_email,
                customer_phone: body.customer_phone,
                shipping_address: body.shipping_address,
                customer_gstin: body.customer_gstin,
                items: body.items,
                payment_method: body.payment_method,
                shipping_method: body.shipping_method,
                notes: body.notes,
                coupon_code: body.coupon_code,
                gift_card_code: body.gift_card_code,
                idempotency_key: body.idempotency_key,
            },
            tenant
        );
        await emitOrderEvent(db, {
            eventType: 'order.created',
            order,
            siteId: tenant.siteId,
            actorId: tenant.userId,
            requestId: tenant.requestId,
        });
        const responseBody = success(order);
        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 201,
            resourceType: 'order',
            resourceId: typeof order === 'object' && order && 'id' in order ? String(order.id) : undefined,
        });

        return c.json(responseBody, 201);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /orders/:id/fulfill — Create fulfillment order + shipment ledger
router.post('/:id/fulfill', validate('json', FulfillOrderSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as FulfillOrderInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);

    const staffBlock = await assertStaffPermission(c, tenant.siteId, tenant.userId, 'orders:write');
    if (staffBlock) return staffBlock;

    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: `orders.fulfill:${orderId}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as any, claim.statusCode as any);
    }

    const service = new OrderExecutionAdapter(db);
    try {
        const fulfillmentInput = await applyLogisticsLabel(db, tenant.siteId, orderId, body, c.env.ENVIRONMENT);
        const data = await service.fulfillOrder(orderId, tenant, fulfillmentInput);
        await emitOrderEvent(db, {
            eventType: 'order.fulfilled',
            order: data,
            fallbackOrderId: orderId,
            siteId: tenant.siteId,
            actorId: tenant.userId,
            requestId: tenant.requestId,
        });
        const responseBody = success(data);
        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 200,
            resourceType: 'fulfillment_order',
            resourceId: typeof data === 'object' && data && 'fulfillment_order_id' in data ? String(data.fulfillment_order_id) : undefined,
        });
        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /orders/:id/refund/complete — Canonical source/receipt owns retries.
router.post('/:id/refund/complete', validate('json', CompleteRefundSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as CompleteRefundInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);
    const staffBlock = await assertStaffPermission(c, tenant.siteId, tenant.userId, 'orders:write');
    if (staffBlock) return staffBlock;
    const stepUp = await verifyMerchantStepUp(db, { action: 'refund.approve',
        actorId: tenant.userId, siteId: tenant.siteId,
        token: c.req.header('X-Step-Up-Token'), verifiedAt: c.req.header('X-Step-Up-Verified-At'),
        signingSecret: c.env.STEP_UP_SIGNING_SECRET });
    if (!stepUp.ok) return c.json(stepUpErrorBody(stepUp), 428);
    const service = new OrderExecutionAdapter(db);
    const {data,replayed} = await service.completeRefund(orderId, tenant, body, stepUp.metadata);
    if (!replayed && recordValue(data.order).status === 'refunded') {
        await emitOrderEvent(db, { eventType: 'order.refunded', order: data.order,
            fallbackOrderId: orderId, siteId: tenant.siteId, actorId: tenant.userId, requestId: tenant.requestId });

    }
    await tryRestoreGiftCardForReversedOrder(db,{...tenant,orderId},data.order);
    await tryRestoreRedeemedLoyalty(db, {...tenant,orderId});
    return c.json(success(data));
});

// POST /orders/:id/refund — Create return + refund intent, not fake provider success
router.post('/:id/refund', validate('json', RefundOrderSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as RefundOrderInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);

    const staffBlock = await assertStaffPermission(c, tenant.siteId, tenant.userId, 'orders:write');
    if (staffBlock) return staffBlock;

    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: `orders.refund:${orderId}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as any, claim.statusCode as any);
    }

    const service = new OrderExecutionAdapter(db);
    try {
        const data = await service.createRefund(orderId, tenant, body);
        const responseBody = success(data);
        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 202,
            resourceType: 'refund',
            resourceId: typeof data === 'object' && data && 'refund_id' in data ? String(data.refund_id) : undefined,
        });
        return c.json(responseBody, 202);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

export default router;
