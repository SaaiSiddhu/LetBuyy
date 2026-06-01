import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { dbErrorBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { OrderExecutionAdapter } from '../execution/order-execution.adapter';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { resolveTenantContextForOrder, resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import {
    CreateOrderSchema,
    UpdateOrderStatusSchema,
    FulfillOrderSchema,
    RefundOrderSchema,
    CompleteRefundSchema,
    ListOrdersQuery,
    type CreateOrderInput,
    type UpdateOrderStatusInput,
    type FulfillOrderInput,
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
type OrderEventType = 'order.created' | 'order.paid' | 'order.fulfilled' | 'order.cancelled' | 'order.refunded';

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

type FulfillmentOrderSnapshot = {
    order_number?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    shipping_address?: unknown;
};

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

function isMissingOrderItemsRelation(error: DatabaseErrorLike): boolean {
    const text = databaseErrorText(error);
    return text.includes('order_items') && (
        text.includes('relationship') ||
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

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
    if (status === 'delivered') return ['order.paid'];
    if (status === 'shipped') return ['order.fulfilled'];
    if (status === 'cancelled') return ['order.cancelled'];
    if (status === 'refunded') return ['order.refunded'];
    return [];
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
): Promise<FulfillOrderInput> {
    if (!input.create_shipping_label || !input.logistics_provider) return input;

    const { data, error } = await db
        .from('orders')
        .select('order_number,customer_name,customer_phone,customer_email,shipping_address')
        .eq('id', orderId)
        .eq('store_id', siteId)
        .maybeSingle();

    if (error) throw new Error(`Order lookup for logistics failed: ${error.message}`);
    if (!data) throw new Error('Order not found for logistics label creation');

    const order = data as FulfillmentOrderSnapshot;
    const provider = createLogisticsProvider(input.logistics_provider as LogisticsProviderName, { mode: 'test' });
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

    const buildOrdersQuery = (includeOrderItems: boolean, includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('orders')
            .select(includeOrderItems ? '*,order_items(*)' : '*', { count: 'exact' })
            .in('store_id', ownedStoreIds)
            .order(query.sort, { ascending: query.order === 'asc' })
            .range(offset, offset + query.limit - 1);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        if (query.status !== 'all') dbQuery = dbQuery.eq('status', query.status);
        if (query.payment_status !== 'all') dbQuery = dbQuery.eq('payment_status', query.payment_status);
        if (query.search) {
            const search = query.search.replace(/[%(),]/g, '').trim();
            if (search) {
                dbQuery = dbQuery.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
            }
        }

        return dbQuery;
    };

    let { data, error, count } = await buildOrdersQuery(true, true);

    if (isMissingColumnError(error, 'deleted_at')) {
        ({ data, error, count } = await buildOrdersQuery(true, false));
    }

    if (isMissingOrderItemsRelation(error)) {
        ({ data, error, count } = await buildOrdersQuery(false, true));
        if (isMissingColumnError(error, 'deleted_at')) {
            ({ data, error, count } = await buildOrdersQuery(false, false));
        }
    }

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    const rows = ((data || []) as unknown as OrderSourceRow[]).map(normalizeOrderRecord);
    return c.json(paginated(rows, count || 0, query.page, query.limit));
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

    const buildOrderQuery = (includeOrderItems: boolean, includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('orders')
            .select(includeOrderItems ? '*,order_items(*)' : '*')
            .eq('id', orderId);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        return dbQuery.single();
    };

    let { data, error } = await buildOrderQuery(true, true);

    if (isMissingColumnError(error, 'deleted_at')) {
        ({ data, error } = await buildOrderQuery(true, false));
    }

    if (isMissingOrderItemsRelation(error)) {
        ({ data, error } = await buildOrderQuery(false, true));
        if (isMissingColumnError(error, 'deleted_at')) {
            ({ data, error } = await buildOrderQuery(false, false));
        }
    }

    const order = data as unknown as OrderSourceRow | null;

    if (error || !order || !(await verifySiteOwnership(db, order.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
    }

    return c.json(success(normalizeOrderRecord(order)));
});

// PATCH /orders/:id — Update order status (with state machine)
router.patch('/:id', validate('json', UpdateOrderStatusSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateOrderStatusInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: `orders.transition:${orderId}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
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
        const fulfillmentInput = await applyLogisticsLabel(db, tenant.siteId, orderId, body);
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

// POST /orders/:id/refund/complete — Mark a manual/provider refund as succeeded
router.post('/:id/refund/complete', validate('json', CompleteRefundSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as CompleteRefundInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: `orders.refund.complete:${orderId}:${body.refund_id}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as any, claim.statusCode as any);
    }

    const service = new OrderExecutionAdapter(db);
    try {
        const data = await service.completeRefund(orderId, tenant, body);
        await emitOrderEvent(db, {
            eventType: 'order.refunded',
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
            resourceType: 'refund',
            resourceId: body.refund_id,
        });
        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /orders/:id/refund — Create return + refund intent, not fake provider success
router.post('/:id/refund', validate('json', RefundOrderSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as RefundOrderInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);
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

async function listOwnedStoreIds(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    sessionStoreId?: string
) {
    let query = db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`)
        .is('deleted_at', null);

    if (sessionStoreId) query = query.eq('id', sessionStoreId);

    const { data, error } = await query;
    if (error) throw new Error(`Store ownership lookup failed: ${error.message}`);

    return (data || []).map((store) => store.id as string);
}

export default router;
