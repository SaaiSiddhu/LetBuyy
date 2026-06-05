import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { cursorPaginated, decodeListCursor, encodeListCursor, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { ProductExecutionAdapter } from '../execution/product-execution.adapter';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import {
    CreateProductSchema,
    UpdateProductSchema,
    ListProductsQuery,
    BulkProductActionSchema,
    StoreScopedQuerySchema,
    CreateCollectionSchema,
    CreateGiftCardSchema,
    type CreateProductInput,
    type UpdateProductInput,
    type BulkProductActionInput,
    type ListProductsInput,
    type StoreScopedQueryInput,
    type CreateCollectionInput,
    type CreateGiftCardInput,
    generateGiftCardCodeFromBytes,
    planGiftCardInsert,
} from '@letbuyy/commerce-core';

const router = new Hono<{ Bindings: Env }>();
type ListProductsQueryInput = ListProductsInput;
type ProductEventType = 'product.created' | 'product.updated' | 'product.deleted';

const PRODUCT_LIST_COLUMNS = [
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
    'variants',
    'stock',
    'track_inventory',
    'allow_backorder',
    'is_active',
    'is_featured',
    'display_order',
    'created_at',
    'updated_at',
    'slug',
    'cost_price',
    'sku',
    'barcode',
    'seo_title',
    'seo_description',
    'status',
    'product_type',
    'vendor',
    'url_handle',
    'cost_per_item',
    'charge_tax',
    'sell_when_oos',
    'is_physical',
    'weight',
    'weight_unit',
    'country_of_origin',
    'hs_code',
    'hsn_code',
    'version',
].join(',');

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

function isMissingAuditColumnError(error: DatabaseErrorLike): boolean {
    return isMissingColumnError(error, 'created_by') || isMissingColumnError(error, 'updated_by');
}

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function productStatus(record: Record<string, unknown>, deleted = false): 'draft' | 'active' | 'archived' | 'deleted' | undefined {
    if (deleted || stringOrNull(record.deleted_at)) return 'deleted';
    if (record.is_active === true) return 'active';
    if (record.is_active === false) return 'archived';
    return undefined;
}

async function emitProductEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        eventType: ProductEventType;
        product: unknown;
        fallbackStoreId?: string;
        actorId: string;
        requestId?: string | null;
        deleted?: boolean;
    },
): Promise<void> {
    const product = objectRecord(input.product);
    const productId = stringOrNull(product.id) || stringOrNull(product.product_id);
    const storeId = stringOrNull(product.store_id) || input.fallbackStoreId;

    if (!productId || !storeId) return;

    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId,
        aggregateType: 'product',
        aggregateId: productId,
        eventType: input.eventType,
        payload: {
            site_id: storeId,
            product_id: productId,
            handle: stringOrNull(product.handle) || stringOrNull(product.slug) || undefined,
            status: productStatus(product, input.deleted),
        },
        idempotencyKey: `${input.eventType}:${productId}:${input.requestId || crypto.randomUUID()}`,
        requestId: input.requestId || null,
        actorId: input.actorId,
    });
}

// GET /products — List products (optionally by store)
router.get('/', validate('query', ListProductsQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ListProductsQueryInput;
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
        const ownsStore = await verifyStoreOwnership(db, query.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }
    }

    if (ownedStoreIds.length === 0) {
        return c.json(paginated([], 0, query.page, query.limit));
    }

    const buildProductsQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('products')
            .select(PRODUCT_LIST_COLUMNS, query.withCount ? { count: 'exact' } : undefined)
            .in('store_id', ownedStoreIds);

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

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const rows = data || [];
    const pageRows = rows.slice(0, query.limit);
    const nextCursor = rows.length > query.limit
        ? encodeListCursor(pageRows[pageRows.length - 1] as unknown as Record<string, unknown>, query.sort)
        : null;

    return c.json(cursorPaginated(pageRows, {
        page: query.page,
        limit: query.limit,
        total: query.withCount ? count || 0 : undefined,
        nextCursor,
    }));
});

// GET /products/collections — List collections for a store
router.get('/collections', validate('query', StoreScopedQuerySchema), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as StoreScopedQueryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownsStore = await verifyStoreOwnership(db, query.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const buildCollectionsQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('collections')
            .select('*')
            .eq('store_id', query.store_id);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        return dbQuery.order('created_at', { ascending: false });
    };

    let { data, error } = await buildCollectionsQuery(true);

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildCollectionsQuery(false));
    }

    if (error) {
        if (isMissingTableError(error, 'collections')) {
            return c.json(success([]));
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /products/collections — Create a collection
router.post('/collections', validate('json', CreateCollectionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateCollectionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownsStore = await verifyStoreOwnership(db, body.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const buildCollectionInsert = (includeAuditFields: boolean) => {
        const insert: Record<string, unknown> = {
            store_id: body.store_id,
            title: body.title,
            description: body.description || null,
            image_url: body.image_url || null,
            is_active: true,
        };

        if (includeAuditFields) {
            insert.created_by = customUser.id;
            insert.updated_by = customUser.id;
        }

        return db
            .from('collections')
            .insert(insert)
            .select()
            .single();
    };

    let { data, error } = await buildCollectionInsert(true);

    if (isMissingAuditColumnError(error)) {
        ({ data, error } = await buildCollectionInsert(false));
    }

    if (error) {
        if (isMissingTableError(error, 'collections')) {
            return c.json({ error: { code: 'COLLECTION_SCHEMA_MISSING', message: 'Collections are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// GET /products/gift-cards — List gift cards for a store
router.get('/gift-cards', validate('query', StoreScopedQuerySchema), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as StoreScopedQueryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownsStore = await verifyStoreOwnership(db, query.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const buildGiftCardsQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('gift_cards')
            .select('*')
            .eq('store_id', query.store_id);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        return dbQuery.order('created_at', { ascending: false });
    };

    let { data, error } = await buildGiftCardsQuery(true);

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildGiftCardsQuery(false));
    }

    if (error) {
        if (isMissingTableError(error, 'gift_cards')) {
            return c.json(success([]));
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /products/gift-cards — Issue a gift card with server-generated code
router.post('/gift-cards', validate('json', CreateGiftCardSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateGiftCardInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownsStore = await verifyStoreOwnership(db, body.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const code = generateGiftCardCodeFromBytes(crypto.getRandomValues(new Uint8Array(16)));
    const buildGiftCardInsert = (includeAuditFields: boolean) => {
        return db
            .from('gift_cards')
            .insert(planGiftCardInsert(body, code, customUser.id, includeAuditFields))
            .select()
            .single();
    };

    let { data, error } = await buildGiftCardInsert(true);

    if (isMissingAuditColumnError(error)) {
        ({ data, error } = await buildGiftCardInsert(false));
    }

    if (error) {
        if (isMissingTableError(error, 'gift_cards')) {
            return c.json({ error: { code: 'GIFT_CARD_SCHEMA_MISSING', message: 'Gift cards are not available in this environment.' } }, 503);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// GET /products/:id
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const productId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildProductQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('products')
            .select('*')
            .eq('id', productId);

        return includeDeletedAtFilter ? query.is('deleted_at', null).single() : query.single();
    };

    let { data, error } = await buildProductQuery(true);

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildProductQuery(false));
    }

    if (error || !data || !(await verifyStoreOwnership(db, data.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    }

    return c.json(success(data));
});

// POST /products — Create a product
router.post('/', validate('json', CreateProductSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateProductInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const service = new ProductExecutionAdapter(db);
    const data = await service.createProduct(body, customUser.id, auth.user.storeId);
    await emitProductEvent(db, {
        eventType: 'product.created',
        product: data,
        fallbackStoreId: body.store_id,
        actorId: customUser.id,
        requestId: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
    });

    return c.json(success(data), 201);
});

// PATCH /products/:id
router.patch('/:id', validate('json', UpdateProductSchema), async (c) => {
    const auth = c.get('auth');
    const productId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateProductInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const service = new ProductExecutionAdapter(db);
    const data = await service.updateProduct(productId, customUser.id, body as Record<string, unknown>, auth.user.storeId);
    await emitProductEvent(db, {
        eventType: 'product.updated',
        product: data,
        actorId: customUser.id,
        requestId: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
    });

    return c.json(success(data));
});

// POST /products/bulk — Bulk operations (activate, deactivate, delete)
router.post('/bulk', validate('json', BulkProductActionSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as BulkProductActionInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const service = new ProductExecutionAdapter(db);
    const result = await service.bulkAction(body.store_id, body.product_ids, body.action, customUser.id, auth.user.storeId);
    const eventType = body.action === 'delete' ? 'product.deleted' : 'product.updated';
    const requestId = c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null;

    await Promise.all(result.products.map((product) => emitProductEvent(db, {
        eventType,
        product,
        fallbackStoreId: body.store_id,
        actorId: customUser.id,
        requestId,
        deleted: body.action === 'delete',
    })));

    return c.json(success(result));
});

// DELETE /products/:id — Soft delete with deleted_at timestamp
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const productId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const service = new ProductExecutionAdapter(db);
    const result = await service.softDelete(productId, customUser.id, auth.user.storeId);
    await emitProductEvent(db, {
        eventType: 'product.deleted',
        product: result,
        actorId: customUser.id,
        requestId: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
        deleted: true,
    });

    return c.json({ data: result });
});

async function verifyStoreOwnership(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    userId: string,
    sessionStoreId?: string
) {
    return verifySiteOwnership(db, storeId, userId, sessionStoreId);
}

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
