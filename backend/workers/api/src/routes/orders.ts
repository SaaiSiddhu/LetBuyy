import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { dbErrorBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { OrderService } from '../services/order.service';
import { IdempotencyService } from '../services/idempotency.service';
import { resolveTenantContextForOrder, resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import {
    CreateOrderSchema,
    UpdateOrderStatusSchema,
    FulfillOrderSchema,
    RefundOrderSchema,
    CompleteRefundSchema,
    ListOrdersQuery,
} from '../schemas/order.schema';
import type { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();

type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
type FulfillOrderInput = z.infer<typeof FulfillOrderSchema>;
type RefundOrderInput = z.infer<typeof RefundOrderSchema>;
type CompleteRefundInput = z.infer<typeof CompleteRefundSchema>;
type ListOrdersQueryInput = z.infer<typeof ListOrdersQuery>;

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

type OrderItemRow = Record<string, unknown> & {
    product_id?: string | null;
    variant_id?: string | null;
    title?: string | null;
    name?: string | null;
    product_name?: string | null;
    variant_title?: string | null;
    sku?: string | null;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    price?: number | string | null;
    total?: number | string | null;
    image?: string | null;
    image_url?: string | null;
    product_snapshot?: Record<string, unknown> | null;
};

type OrderRow = Record<string, unknown> & {
    id: string;
    store_id: string;
    order_number?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    status?: string | null;
    payment_status?: string | null;
    payment_method?: string | null;
    subtotal?: number | string | null;
    shipping_cost?: number | string | null;
    tax?: number | string | null;
    discount?: number | string | null;
    total?: number | string | null;
    coupon_code?: string | null;
    coupon_discount?: number | string | null;
    tracking_number?: string | null;
    shipping_method?: string | null;
    shipping_address?: Record<string, unknown> | string | null;
    items?: unknown;
    order_items?: unknown;
    created_at?: string | null;
    updated_at?: string | null;
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

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            return {};
        }
    }

    return {};
}

function asArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
}

function asText(value: unknown, fallback = ''): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function firstImageFromSnapshot(snapshot: Record<string, unknown>) {
    const images = snapshot.images;
    if (Array.isArray(images) && typeof images[0] === 'string') return images[0];
    return asText(snapshot.image || snapshot.image_url);
}

function normalizeOrderItem(value: unknown) {
    const item = asRecord(value) as OrderItemRow;
    const snapshot = asRecord(item.product_snapshot);
    const quantity = asNumber(item.quantity, 0);
    const unitPrice = asNumber(item.unit_price ?? item.price, 0);
    const total = asNumber(item.total, unitPrice * quantity);

    return {
        product_id: asText(item.product_id),
        variant_id: asText(item.variant_id) || null,
        title: asText(item.title || item.name || item.product_name || snapshot.name, 'Item'),
        variant_title: asText(item.variant_title) || null,
        sku: asText(item.sku || snapshot.sku) || null,
        quantity,
        unit_price: unitPrice,
        total,
        image: asText(item.image || item.image_url) || firstImageFromSnapshot(snapshot) || null,
    };
}

function normalizeOrder(row: OrderRow) {
    const relationalItems = asArray(row.order_items);
    const legacyItems = asArray(row.items);
    const items = (relationalItems.length > 0 ? relationalItems : legacyItems).map(normalizeOrderItem);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
        ...row,
        order_number: row.order_number || '',
        customer_name: row.customer_name || '',
        customer_email: row.customer_email || '',
        customer_phone: row.customer_phone || '',
        status: row.status || 'pending',
        payment_status: row.payment_status || 'pending',
        payment_method: row.payment_method || 'cod',
        subtotal: asNumber(row.subtotal),
        shipping_cost: asNumber(row.shipping_cost),
        tax: asNumber(row.tax),
        discount: asNumber(row.discount ?? row.coupon_discount),
        total: asNumber(row.total),
        coupon_code: row.coupon_code || null,
        coupon_discount: asNumber(row.coupon_discount ?? row.discount),
        tracking_number: row.tracking_number || null,
        shipping_method: row.shipping_method || null,
        shipping_address: asRecord(row.shipping_address),
        items,
        order_items: items,
        item_count: itemCount,
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

    const rows = ((data || []) as unknown as OrderRow[]).map(normalizeOrder);
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

    const order = data as unknown as OrderRow | null;

    if (error || !order || !(await verifySiteOwnership(db, order.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
    }

    return c.json(success(normalizeOrder(order)));
});

// PATCH /orders/:id — Update order status (with state machine)
router.patch('/:id', validate('json', UpdateOrderStatusSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateOrderStatusInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);
    const idempotency = new IdempotencyService(db);
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

    const service = new OrderService(db);
    try {
        const data = await service.transitionStatus(orderId, tenant, body.status, body);
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
    const idempotency = new IdempotencyService(db);
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

    const service = new OrderService(db);
    try {
        const order = await service.createOrder(
            {
                customer_name: body.customer_name,
                customer_email: body.customer_email,
                customer_phone: body.customer_phone,
                shipping_address: body.shipping_address,
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
    const idempotency = new IdempotencyService(db);
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

    const service = new OrderService(db);
    try {
        const data = await service.fulfillOrder(orderId, tenant, body);
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
    const idempotency = new IdempotencyService(db);
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

    const service = new OrderService(db);
    try {
        const data = await service.completeRefund(orderId, tenant, body);
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
    const idempotency = new IdempotencyService(db);
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

    const service = new OrderService(db);
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
