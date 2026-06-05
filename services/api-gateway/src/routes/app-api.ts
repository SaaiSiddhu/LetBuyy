import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { cursorPaginated, decodeListCursor, encodeListCursor, getSupabaseAdmin, success } from '../lib/supabase';
import { appAuthMiddleware } from '../middleware/app-auth';
import { validate } from '../middleware/validation';
import {
    ListProductsQuery,
    type ListProductsInput as ListProductsQueryInput,
} from '@letbuyy/commerce-core';
import {
    ListOrdersQuery,
    normalizeOrderRecord,
    type ListOrdersInput as ListOrdersQueryInput,
    type OrderSourceRow,
} from '@letbuyy/checkout-core';

const router = new Hono<{ Bindings: Env }>();

const APP_PRODUCT_LIST_COLUMNS = [
    'id',
    'store_id',
    'site_id',
    'name',
    'description',
    'price',
    'compare_price',
    'images',
    'thumbnail_url',
    'category',
    'tags',
    'stock',
    'track_inventory',
    'allow_backorder',
    'is_active',
    'is_featured',
    'created_at',
    'updated_at',
    'slug',
    'sku',
    'barcode',
    'seo_title',
    'seo_description',
    'status',
    'product_type',
    'vendor',
    'url_handle',
    'version',
].join(',');

const APP_ORDER_LIST_COLUMNS = [
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
    'currency',
].join(',');

const AppInstallationMetadataSchema = z.object({
    metadata: z.record(z.string().min(1).max(120), z.unknown()),
}).strict().refine((body) => JSON.stringify(body.metadata).length <= 8192, {
    message: 'metadata must be 8KB or smaller',
    path: ['metadata'],
});

type AppInstallationMetadataInput = z.infer<typeof AppInstallationMetadataSchema>;

const SECRET_KEY_PATTERN = /(^|[_-])(access|refresh|id)?[_-]?token$|(^|[_-])secret$|password|private[_-]?key|signing[_-]?secret|client[_-]?secret/i;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function secretLikePath(value: unknown, path: string[] = []): string | null {
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const nested = secretLikePath(value[index], [...path, `[${index}]`]);
            if (nested) return nested;
        }
        return null;
    }

    if (!isRecord(value)) return null;

    for (const [key, nestedValue] of Object.entries(value)) {
        const nextPath = [...path, key];
        if (SECRET_KEY_PATTERN.test(key)) return nextPath.join('.');
        const nested = secretLikePath(nestedValue, nextPath);
        if (nested) return nested;
    }

    return null;
}

function databaseError() {
    return { error: { code: 'DB_ERROR', message: 'Database operation failed' } };
}

function assertTokenStoreScope(queryStoreId: string | undefined, tokenStoreId: string) {
    if (queryStoreId && queryStoreId !== tokenStoreId) {
        return {
            ok: false as const,
            response: {
                error: {
                    code: 'FORBIDDEN',
                    message: 'App token store does not match the requested store_id',
                },
            },
        };
    }

    return { ok: true as const };
}

function isMissingDeletedAtError(error: { message?: string; details?: string; hint?: string; code?: string } | null | undefined): boolean {
    const haystack = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return Boolean(error && (error.code === '42703' || (haystack.includes('deleted_at') && haystack.includes('column'))));
}

// GET /app/products -- scoped, app-token product reads for the token installation store.
router.get('/products', appAuthMiddleware(['read_products']), validate('query', ListProductsQuery), async (c) => {
    const appAuth = c.get('appAuth');
    const query = c.get('validatedQuery') as ListProductsQueryInput;
    const storeScope = assertTokenStoreScope(query.store_id, appAuth.app.storeId);
    if (!storeScope.ok) return c.json(storeScope.response, 403);

    const offset = (query.page - 1) * query.limit;
    const decodedCursor = decodeListCursor(query.cursor);
    const db = getSupabaseAdmin(c);

    const buildProductsQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('products')
            .select(APP_PRODUCT_LIST_COLUMNS, query.withCount ? { count: 'exact' } : undefined)
            .eq('store_id', appAuth.app.storeId);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        if (query.category) dbQuery = dbQuery.eq('category', query.category);
        if (query.status === 'active') dbQuery = dbQuery.eq('is_active', true);
        if (query.status === 'inactive') dbQuery = dbQuery.eq('is_active', false);
        if (query.search) dbQuery = dbQuery.ilike('name', `%${query.search}%`);
        if (decodedCursor) {
            dbQuery = query.order === 'asc'
                ? dbQuery.gt(query.sort, decodedCursor.value)
                : dbQuery.lt(query.sort, decodedCursor.value);
        }

        dbQuery = dbQuery
            .order(query.sort, { ascending: query.order === 'asc' })
            .order('id', { ascending: query.order === 'asc' });

        if (query.cursor || query.page === 1) return dbQuery.limit(query.limit + 1);
        return dbQuery.range(offset, offset + query.limit);
    };

    let { data, error, count } = await buildProductsQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildProductsQuery(false));
    }

    if (error) return c.json(databaseError(), 500);

    const rows = (data || []) as unknown as Array<Record<string, unknown>>;
    const pageRows = rows.slice(0, query.limit);
    const nextCursor = rows.length > query.limit
        ? encodeListCursor(pageRows[pageRows.length - 1] as Record<string, unknown>, query.sort)
        : null;

    return c.json(cursorPaginated(pageRows, {
        page: query.page,
        limit: query.limit,
        total: query.withCount ? count || 0 : undefined,
        nextCursor,
    }));
});

// GET /app/orders -- scoped, app-token order reads for the token installation store.
router.get('/orders', appAuthMiddleware(['read_orders']), validate('query', ListOrdersQuery), async (c) => {
    const appAuth = c.get('appAuth');
    const query = c.get('validatedQuery') as ListOrdersQueryInput;
    const storeScope = assertTokenStoreScope(query.store_id, appAuth.app.storeId);
    if (!storeScope.ok) return c.json(storeScope.response, 403);

    const offset = (query.page - 1) * query.limit;
    const decodedCursor = decodeListCursor(query.cursor);
    const db = getSupabaseAdmin(c);

    const buildOrdersQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('orders')
            .select(APP_ORDER_LIST_COLUMNS, query.withCount ? { count: 'exact' } : undefined)
            .eq('store_id', appAuth.app.storeId);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        if (query.status !== 'all') dbQuery = dbQuery.eq('status', query.status);
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

        dbQuery = dbQuery
            .order(query.sort, { ascending: query.order === 'asc' })
            .order('id', { ascending: query.order === 'asc' });

        if (query.cursor || query.page === 1) return dbQuery.limit(query.limit + 1);
        return dbQuery.range(offset, offset + query.limit);
    };

    let { data, error, count } = await buildOrdersQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildOrdersQuery(false));
    }

    if (error) return c.json(databaseError(), 500);

    const rawRows = (data || []) as unknown as Array<Record<string, unknown>>;
    const pageRows = rawRows.slice(0, query.limit);
    const nextCursor = rawRows.length > query.limit
        ? encodeListCursor(pageRows[pageRows.length - 1] as Record<string, unknown>, query.sort)
        : null;
    const rows = (pageRows as unknown as OrderSourceRow[]).map(normalizeOrderRecord);

    return c.json(cursorPaginated(rows, {
        page: query.page,
        limit: query.limit,
        total: query.withCount ? count || 0 : undefined,
        nextCursor,
    }));
});

// PATCH /app/installation/metadata -- app-owned metadata only; no merchant record mutation.
router.patch('/installation/metadata', appAuthMiddleware(['write_app_metadata']), validate('json', AppInstallationMetadataSchema), async (c) => {
    const appAuth = c.get('appAuth');
    const body = c.get('validatedBody') as AppInstallationMetadataInput;
    const rejectedPath = secretLikePath(body.metadata);
    if (rejectedPath) {
        return c.json(
            {
                error: {
                    code: 'SECRET_METADATA_REJECTED',
                    message: `metadata key is not allowed: ${rejectedPath}`,
                },
            },
            400,
        );
    }

    const db = getSupabaseAdmin(c);
    const { data: installation, error: loadError } = await db
        .from('app_installations')
        .select('id, store_id, config')
        .eq('id', appAuth.app.installationId)
        .eq('app_id', appAuth.app.appId)
        .eq('store_id', appAuth.app.storeId)
        .eq('status', 'active')
        .maybeSingle();

    if (loadError) return c.json(databaseError(), 500);
    if (!installation) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'App installation is not active' } }, 401);
    }

    const config = parseRecord(installation.config);
    const appApiConfig = parseRecord(config.app_api);
    const updatedAt = new Date().toISOString();
    const updatedConfig = {
        ...config,
        app_api: {
            ...appApiConfig,
            metadata: body.metadata,
            metadata_updated_at: updatedAt,
        },
    };

    const { error: updateError } = await db
        .from('app_installations')
        .update({ config: updatedConfig })
        .eq('id', appAuth.app.installationId)
        .eq('app_id', appAuth.app.appId)
        .eq('store_id', appAuth.app.storeId)
        .eq('status', 'active');

    if (updateError) return c.json(databaseError(), 500);

    return c.json(success({
        installation_id: appAuth.app.installationId,
        app_id: appAuth.app.appId,
        store_id: appAuth.app.storeId,
        metadata: body.metadata,
        updated_at: updatedAt,
    }));
});

export default router;
