// The order-read compatibility layer, lifted out of routes/orders.ts unchanged.
//
// Everything here exists because the deployed schema and the schema this code expects have drifted
// more than once: `order_items` may or may not be readable as a relation, and individual columns may
// or may not exist yet in a given environment. The route's job is to answer the request; deciding
// what a Postgres/PostgREST error actually MEANS, and which columns are safe to ask for, is a
// separate concern with its own tests. It moved here as a byte-for-byte transplant — every function
// below is the text that was running in orders.ts, in the same order, with only `export` added.
//
// `ORDER_LIST_COLUMNS` did not come with it: it had exactly one occurrence in orders.ts, its own
// definition. The relational and omitted-column variants replaced it and nothing referenced it.

import type { Env } from '../index';
import { getSupabaseAdmin } from './supabase';

export const ORDER_LIST_COLUMN_NAMES = [
    'id',
    'store_id',
    'site_id',
    'order_number',
    'customer_email',
    'customer_name',
    'customer_phone',
    'shipping_address',
    'billing_address',
    'items',
    'subtotal',
    'shipping_cost',
    'tax',
    'discount',
    'total',
    'coupon_code',
    'coupon_discount',
    'status',
    'payment_status',
    'payment_method',
    'payment_id',
    'tracking_number',
    'carrier',
    'created_at',
    'updated_at',
    'fulfillment_status',
    'payment_gateway',
    'shipping_method',
    'notes',
    'version',
    'payment_processed_at',
    'inventory_reserved_at',
    'inventory_released_at',
    'payment_failure_reason',
    'last_payment_event_id',
    'currency',
    'return_status',
    'refund_status',
    'risk_score',
    'risk_level',
    'fulfillment_state',
    'cod_confirmation_status',
    'rto_status',
    'customer_gstin',
    'place_of_supply_state',
    'gst_invoice_number',
    'tax_snapshot',
    'gst_invoice',
] as const;
export const ORDER_LIST_COLUMNS_RELATIONAL = ORDER_LIST_COLUMN_NAMES
    .filter((column) => column !== 'items')
    .join(',');

export type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

export type OrderItemRelationRow = {
    id: string;
    order_id: string;
    product_id?: string | null;
    variant_id?: string | null;
    title?: string | null;
    name?: string | null;
    sku?: string | null;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    price?: number | string | null;
    total?: number | string | null;
    image_url?: string | null;
    variant_title?: string | null;
    product_snapshot?: Record<string, unknown> | string | null;
};

export type ProductSnapshotRow = {
    id: string;
    store_id?: string | null;
    name?: string | null;
    title?: string | null;
    sku?: string | null;
    price?: number | string | null;
    sale_price?: number | string | null;
    images?: unknown;
};

export function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

export function missingColumnFromError(error: DatabaseErrorLike): string | null {
    const text = databaseErrorText(error);
    const quotedColumn = text.match(/column\s+(?:[a-z0-9_]+\.)?([a-z0-9_]+)\s+does not exist/i)?.[1];
    if (quotedColumn) return quotedColumn;
    const schemaCacheColumn = text.match(/could not find (?:the )?'?([a-z0-9_]+)'? column/i)?.[1];
    if (schemaCacheColumn) return schemaCacheColumn;
    return null;
}

export function isMissingColumnError(error: DatabaseErrorLike, columnName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(columnName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

export function isMissingOrderItemsRelation(error: DatabaseErrorLike): boolean {
    const text = databaseErrorText(error);
    return text.includes('order_items') && (
        text.includes('relationship') ||
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

export function orderItemsRelationalReadsEnabled(env: Pick<Env, 'ORDER_ITEMS_RELATIONAL_READS'>): boolean {
    return (env.ORDER_ITEMS_RELATIONAL_READS || 'on').trim().toLowerCase() !== 'off';
}

export function orderListColumns(env: Pick<Env, 'ORDER_ITEMS_RELATIONAL_READS'>, omittedColumns: Set<string>): string {
    return ORDER_LIST_COLUMN_NAMES
        .filter((column) => !omittedColumns.has(column))
        .filter((column) => orderItemsRelationalReadsEnabled(env) ? column !== 'items' : true)
        .join(',');
}

export function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

export async function hydrateOrderItems(
    db: ReturnType<typeof getSupabaseAdmin>,
    orders: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
    const orderIds = orders
        .map((order) => textValue(order.id))
        .filter((id): id is string => Boolean(id));

    if (orderIds.length === 0) return orders;

    // Tenant guard predicate on order_items' own store_id, derived from the already tenant-verified parent orders.
    const storeIds = Array.from(new Set(
        orders
            .map((order) => textValue(order.store_id) || textValue(order.site_id))
            .filter((id): id is string => Boolean(id)),
    ));

    if (storeIds.length === 0) return orders;

    const { data, error } = await db
        .from('order_items')
        .select('id, order_id, product_id, variant_id, title, name, sku, quantity, unit_price, price, total, variant_title, product_snapshot')
        .in('store_id', storeIds)
        .in('order_id', Array.from(new Set(orderIds)))
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (isMissingOrderItemsRelation(error)) return orders;
    if (error) throw new Error(`Order item hydration failed: ${error.message}`);

    const itemsByOrder = new Map<string, OrderItemRelationRow[]>();
    for (const row of (data || []) as OrderItemRelationRow[]) {
        itemsByOrder.set(row.order_id, [
            ...(itemsByOrder.get(row.order_id) || []),
            row,
        ]);
    }

    return orders.map((order) => {
        const orderId = textValue(order.id);
        if (!orderId) return order;
        const orderItems = itemsByOrder.get(orderId) || [];
        return {
            ...order,
            order_items: orderItems,
        };
    });
}

export function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
