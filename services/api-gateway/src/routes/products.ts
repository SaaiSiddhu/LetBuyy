import {CollectionListQuerySchema,type CollectionListQuery} from '@letbuyy/commerce-core';
import { resolveOwnedStoreScope, resolveMerchantResourceStoreIds } from '../lib/tenant-context';
import { readCollectionMembership, replaceCollectionMembership, readOwnedCollectionList } from '../execution/collection-membership.adapter';
import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { cursorPaginated, decodeListCursor, encodeListCursor, getSupabaseAdmin, getSupabaseAdminUnguarded, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { assertStaffPermission } from '../middleware/staff-permission';
import { ProductExecutionAdapter, isProductVariantDiffEnabled } from '../execution/product-execution.adapter';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { readProductForEdit } from '../execution/product-mutation.adapter';
import { AppError, ValidationError } from '../lib/errors';
import { registerGiftCardRoutes } from './gift-cards';
import {
    CreateProductSchema,
    UpdateProductSchema,
    ListProductsQuery,
    ProductBarcodeLookupQuery,
    BulkProductActionSchema,
    StoreScopedQuerySchema,
    CreateCollectionSchema,
    UpdateCollectionSchema,
    type CreateProductInput,
    type UpdateProductInput,
    type BulkProductActionInput,
    type ListProductsInput,
    type ProductBarcodeLookupInput,
    type StoreScopedQueryInput,
    type CreateCollectionInput,
    type UpdateCollectionInput,
} from '@letbuyy/commerce-core';

const router = new Hono<{ Bindings: Env }>();
type ListProductsQueryInput = ListProductsInput;
type ProductEventType = 'product.created' | 'product.updated' | 'product.deleted';
const SAMPLE_PRODUCT_SKU = 'LETBUYY-SAMPLE-PRODUCT';

const PRODUCT_LIST_COLUMN_NAMES = [
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
    'metadata',
    'cost_per_item',
    'charge_tax',
    'sell_when_oos',
    'is_physical',
    'weight',
    'weight_unit',
    'country_of_origin',
    'importer_details',
    'hs_code',
    'hsn_code',
    'version',
] as const;
const PRODUCT_LIST_COLUMNS = PRODUCT_LIST_COLUMN_NAMES.join(',');
const PRODUCT_SUMMARY_COLUMN_NAMES = [
    'id', 'name', 'status', 'stock', 'price', 'compare_price', 'images', 'category',
    'product_type', 'vendor', 'is_active', 'created_at', 'display_order', 'version',
] as const;
const PRODUCT_LIST_COLUMNS_RELATIONAL = PRODUCT_LIST_COLUMN_NAMES
    .filter((column) => column !== 'variants')
    .join(',');

type ProductVariantRelationRow = {
    id: string;
    product_id: string;
    title?: string | null;
    price?: number | string | null;
    compare_price?: number | string | null;
    sku?: string | null;
    barcode?: string | null;
    inventory_qty?: number | string | null;
    weight?: number | string | null;
    weight_unit?: string | null;
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    image_url?: string | null;
    position?: number | string | null;
};

type ProductBarcodeLookupVariantRow = ProductVariantRelationRow;

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

function createProductExecutionAdapter(db: ReturnType<typeof getSupabaseAdmin>, env: Env): ProductExecutionAdapter {
    return new ProductExecutionAdapter(db, {
        variantDiffEnabled: isProductVariantDiffEnabled(env),
        mutationEnv: env,
    });
}

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function missingColumnFromError(error: DatabaseErrorLike): string | null {
    const text = databaseErrorText(error);
    const quotedColumn = text.match(/column\s+(?:[a-z0-9_]+\.)?([a-z0-9_]+)\s+does not exist/i)?.[1];
    if (quotedColumn) return quotedColumn;
    const schemaCacheColumn = text.match(/could not find (?:the )?'?([a-z0-9_]+)'? column/i)?.[1];
    if (schemaCacheColumn) return schemaCacheColumn;
    return null;
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

function productVariantRelationalReadsEnabled(env: Pick<Env, 'PRODUCT_VARIANTS_RELATIONAL_READS'>): boolean {
    return (env.PRODUCT_VARIANTS_RELATIONAL_READS || 'on').trim().toLowerCase() !== 'off';
}

function productListColumns(env: Pick<Env, 'PRODUCT_VARIANTS_RELATIONAL_READS'>, omittedColumns: Set<string>, summary = false): string {
    const columns: readonly string[] = summary ? PRODUCT_SUMMARY_COLUMN_NAMES : PRODUCT_LIST_COLUMN_NAMES;
    return columns
        .filter((column) => !omittedColumns.has(column))
        .filter((column) => productVariantRelationalReadsEnabled(env) ? column !== 'variants' : true)
        .join(',');
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function objectRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function productVariantView(row: ProductVariantRelationRow): Record<string, unknown> {
    return {
        id: row.id,
        product_id: row.product_id,
        title: row.title || '',
        price: numberOrNull(row.price) ?? 0,
        compare_price: numberOrNull(row.compare_price),
        sku: stringOrNull(row.sku),
        barcode: stringOrNull(row.barcode),
        stock: numberOrNull(row.inventory_qty) ?? 0,
        inventory_qty: numberOrNull(row.inventory_qty) ?? 0,
        weight: numberOrNull(row.weight),
        weight_unit: stringOrNull(row.weight_unit) || 'kg',
        option1: stringOrNull(row.option1),
        option2: stringOrNull(row.option2),
        option3: stringOrNull(row.option3),
        image_url: stringOrNull(row.image_url),
        position: numberOrNull(row.position) ?? 0,
    };
}

async function hydrateProductVariants(
    db: ReturnType<typeof getSupabaseAdmin>,
    products: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
    const productIds = products
        .map((product) => stringOrNull(product.id))
        .filter((id): id is string => Boolean(id));

    if (productIds.length === 0) return products;

    const variantsByProduct = new Map<string, Record<string, unknown>[]>();
    // A 100-product page can exceed PostgREST's row cap. Page the relation instead
    // of silently returning an incomplete variant selector. The write contract
    // permits 100 variants per product; refuse oversized legacy data explicitly.
    const pageSize = 500, maximumRows = productIds.length * 100;
    for (let offset = 0; offset <= maximumRows; offset += pageSize) {
        const { data, error } = await db
            .from('product_variants')
            .select('id, product_id, title, price, compare_price, sku, barcode, inventory_qty, weight, weight_unit, option1, option2, option3, image_url, position')
            .in('product_id', Array.from(new Set(productIds)))
            .order('product_id', { ascending: true })
            .order('position', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + pageSize - 1);
        if (isMissingTableError(error, 'product_variants')) return products;
        if (error) throw new Error(`Product variant hydration failed: ${error.message}`);
        const rows = (data || []) as ProductVariantRelationRow[];
        if (offset + rows.length > maximumRows) throw new Error('Product variant read exceeded its bounded row budget');
        for (const row of rows) {
            let variants = variantsByProduct.get(row.product_id);
            if (!variants) { variants = []; variantsByProduct.set(row.product_id, variants); }
            variants.push(productVariantView(row));
        }
        if (rows.length < pageSize) break;
    }

    return products.map((product) => {
        const productId = stringOrNull(product.id);
        if (!productId) return product;
        return {
            ...product,
            variants: variantsByProduct.get(productId) || [],
            product_variants: variantsByProduct.get(productId) || [],
        };
    });
}

async function loadProductByBarcode(
    db: ReturnType<typeof getSupabaseAdmin>,
    env: Env,
    storeId: string,
    barcode: string,
): Promise<Record<string, unknown> | null> {
    const buildProductQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('products')
            .select(productVariantRelationalReadsEnabled(env) ? PRODUCT_LIST_COLUMNS_RELATIONAL : PRODUCT_LIST_COLUMNS)
            .eq('store_id', storeId)
            .eq('barcode', barcode);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query.maybeSingle();
    };

    let { data, error } = await buildProductQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildProductQuery(false));
    }

    if (error || !data) return null;
    return data as unknown as Record<string, unknown>;
}

async function loadVariantProductByBarcode(
    db: ReturnType<typeof getSupabaseAdmin>,
    env: Env,
    storeId: string,
    barcode: string,
): Promise<{ product: Record<string, unknown>; variant: ProductBarcodeLookupVariantRow } | null> {
    const { data: variantRows, error: variantError } = await db
        .from('product_variants')
        .select('id, product_id, title, price, compare_price, sku, barcode, inventory_qty, weight, weight_unit, option1, option2, option3, image_url, position')
        .eq('barcode', barcode)
        .limit(20);

    if (isMissingTableError(variantError, 'product_variants')) return null;
    if (variantError) return null;

    for (const variant of (variantRows || []) as ProductBarcodeLookupVariantRow[]) {
        if (!variant.product_id) continue;

        const buildProductQuery = (includeDeletedAtFilter: boolean) => {
            let query = db
                .from('products')
                .select(productVariantRelationalReadsEnabled(env) ? PRODUCT_LIST_COLUMNS_RELATIONAL : PRODUCT_LIST_COLUMNS)
                .eq('id', variant.product_id)
                .eq('store_id', storeId);

            if (includeDeletedAtFilter) query = query.is('deleted_at', null);
            return query.maybeSingle();
        };

        let { data: product, error: productError } = await buildProductQuery(true);
        if (isMissingDeletedAtError(productError)) {
            ({ data: product, error: productError } = await buildProductQuery(false));
        }

        if (!productError && product) {
            return { product: product as unknown as Record<string, unknown>, variant };
        }
    }

    return null;
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

function sampleProductInput(storeId: string): CreateProductInput {
    return {
        store_id: storeId,
        name: 'Sample Product - Cotton Tote',
        description: 'Sample product for exploring your catalog. It is saved as an inactive draft and should be edited or deleted before publication.',
        price: 499,
        compare_price: null,
        images: [],
        category: 'Sample',
        product_type: 'Sample',
        vendor: 'LetBuyy sample data',
        tags: ['sample', 'not-for-sale', 'edit-before-publication'],
        metadata: {},
        variants: [],
        product_options: [],
        stock: 1,
        track_inventory: true,
        sku: SAMPLE_PRODUCT_SKU,
        barcode: null,
        sell_when_oos: false,
        is_physical: true,
        weight: 0.25,
        weight_unit: 'kg',
        country_of_origin: 'India',
        hs_code: null,
        hsn_code: null,
        url_handle: 'sample-product',
        seo_title: 'Sample Product - Not for sale',
        seo_description: 'A sample draft product for setting up your LetBuyy catalog.',
        charge_tax: true,
        is_active: false,
        is_featured: false,
        display_order: 0,
    };
}

async function loadExistingSampleProduct(
    db: ReturnType<typeof getSupabaseAdmin>,
    env: Env,
    storeId: string,
): Promise<Record<string, unknown> | null> {
    const buildSampleQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('products')
            .select(productVariantRelationalReadsEnabled(env) ? PRODUCT_LIST_COLUMNS_RELATIONAL : PRODUCT_LIST_COLUMNS)
            .eq('store_id', storeId)
            .eq('sku', SAMPLE_PRODUCT_SKU);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query.maybeSingle();
    };

    let { data, error } = await buildSampleQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildSampleQuery(false));
    }

    if (error) throw new Error(`Sample product lookup failed: ${error.message}`);
    if (!data) return null;
    const rows = productVariantRelationalReadsEnabled(env)
        ? await hydrateProductVariants(db, [data as unknown as Record<string, unknown>])
        : [data as unknown as Record<string, unknown>];
    return rows[0] || null;
}

async function countStoreProducts(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
): Promise<number> {
    const buildCountQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query;
    };

    let { count, error } = await buildCountQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ count, error } = await buildCountQuery(false));
    }

    if (error) throw new Error(`Product count failed: ${error.message}`);
    return count || 0;
}

// GET /products — List products (optionally by store)
router.get('/', validate('query', ListProductsQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ListProductsQueryInput;
    const offset = (query.page - 1) * query.limit;
    const decodedCursor = decodeListCursor(query.cursor);
    if (query.cursor && (!decodedCursor || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(decodedCursor.id))) {
        throw new ValidationError('Invalid product cursor. Restart this catalog view.');
    }
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = query.store_id
        ? [query.store_id]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (query.store_id) {
        // Phase 2 / F2.5: verifyStoreOwnership alone is owner-only, so an active staff member with a
        // real products:read/products:write grant (staff-permission.ts) got 403'd reading the same
        // catalog they can legitimately write to -- merchant-web's [store]/products page 404/403'd
        // for every non-owner even after the store-shell fix in stores.ts. assertStaffPermission
        // already allows the owner (its own ownsStore() check) or an active employees grant.
        const staffBlock = await assertStaffPermission(c, query.store_id, customUser.id, 'products:read');
        if (staffBlock) return staffBlock;
    }

    if (ownedStoreIds.length === 0) {
        return c.json(paginated([], 0, query.page, query.limit));
    }

    const omittedColumns = new Set<string>();
    const buildProductsQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('products')
            .select(productListColumns(c.env, omittedColumns, query.view === 'summary'), query.withCount ? { count: 'exact' } : undefined)
            .in('store_id', ownedStoreIds);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        if (query.category) dbQuery = dbQuery.eq('category', query.category);
        if (query.status === 'active') dbQuery = dbQuery.eq('is_active', true);
        if (query.status === 'inactive') dbQuery = dbQuery.eq('is_active', false);
        if (query.status === 'draft' || query.status === 'archived') dbQuery = dbQuery.eq('status', query.status);
        if (query.search) dbQuery = dbQuery.ilike('name', `%${query.search}%`);
        if (query.stock_filter === 'out_of_stock') dbQuery = dbQuery.lte('stock', 0);
        if (query.stock_filter === 'low_stock') dbQuery = dbQuery.gt('stock', 0).lte('stock', 5);
        if (decodedCursor) {
            // The secondary ID order is part of cursor membership, so products
            // with the same price/name/display order cannot disappear at a page boundary.
            const operator = query.order === 'asc' ? 'gt' : 'lt';
            const value = JSON.stringify(decodedCursor.value);
            dbQuery = dbQuery.or(`${query.sort}.${operator}.${value},and(${query.sort}.eq.${value},id.${operator}.${decodedCursor.id})`);
        }

        dbQuery = dbQuery
            .order(query.sort, { ascending: query.order === 'asc' })
            .order('id', { ascending: query.order === 'asc' });

        if (query.cursor || query.page === 1) return dbQuery.limit(query.limit + 1);
        return dbQuery.range(offset, offset + query.limit);
    };

    let includeDeletedAtFilter = true;
    let { data, error, count } = await buildProductsQuery(includeDeletedAtFilter);

    for (let attempts = 0; error && attempts < PRODUCT_LIST_COLUMN_NAMES.length + 1; attempts += 1) {
        if (isMissingDeletedAtError(error) && includeDeletedAtFilter) {
            includeDeletedAtFilter = false;
            ({ data, error, count } = await buildProductsQuery(includeDeletedAtFilter));
            continue;
        }

        const missingColumn = missingColumnFromError(error);
        if (missingColumn && PRODUCT_LIST_COLUMN_NAMES.includes(missingColumn as typeof PRODUCT_LIST_COLUMN_NAMES[number]) && !omittedColumns.has(missingColumn)) {
            omittedColumns.add(missingColumn);
            ({ data, error, count } = await buildProductsQuery(includeDeletedAtFilter));
            continue;
        }

        break;
    }

    if (error) throw new AppError('Products could not be loaded. Please retry.', 503, 'PRODUCTS_UNAVAILABLE');

    const rows = (data || []) as unknown as Array<Record<string, unknown>>;
    const pageRows = rows.slice(0, query.limit) as Array<Record<string, unknown>>;
    const nextCursor = rows.length > query.limit
        ? encodeListCursor(pageRows[pageRows.length - 1] as unknown as Record<string, unknown>, query.sort)
        : null;
    const responseRows = query.view !== 'summary' && productVariantRelationalReadsEnabled(c.env)
        ? await hydrateProductVariants(db, pageRows)
        : pageRows;

    const response = cursorPaginated(responseRows, {
        page: query.page,
        limit: query.limit,
        total: query.withCount ? count || 0 : undefined,
        nextCursor,
    });
    return c.json({ ...response, meta: { ...response.meta, stock_filter: query.stock_filter ?? null } });
});

// GET /products/barcode/lookup — Resolve a scanned product or variant barcode
router.get('/barcode/lookup', validate('query', ProductBarcodeLookupQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ProductBarcodeLookupInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownsStore = await verifyStoreOwnership(db, query.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const barcode = query.barcode.trim();
    const directProduct = await loadProductByBarcode(db, c.env, query.store_id, barcode);
    if (directProduct) {
        const rows = productVariantRelationalReadsEnabled(c.env)
            ? await hydrateProductVariants(db, [directProduct])
            : [directProduct];
        return c.json(success({
            store_id: query.store_id,
            barcode,
            product: rows[0],
            variant: null,
            matched_field: 'product.barcode',
        }));
    }

    const variantMatch = await loadVariantProductByBarcode(db, c.env, query.store_id, barcode);
    if (variantMatch) {
        const rows = productVariantRelationalReadsEnabled(c.env)
            ? await hydrateProductVariants(db, [variantMatch.product])
            : [variantMatch.product];
        return c.json(success({
            store_id: query.store_id,
            barcode,
            product: rows[0],
            variant: productVariantView(variantMatch.variant),
            matched_field: 'variant.barcode',
        }));
    }

    return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
});

// GET /products/collections — List collections for a store
router.get('/collections', validate('query', CollectionListQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as CollectionListQuery;
    const scope = await resolveOwnedStoreScope(c, query.store_id);
    return c.json(await readOwnedCollectionList(c.env, scope, {page: query.page, limit: query.limit}));
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

// PATCH /products/collections/:id — Update a collection
router.patch('/collections/:id', validate('json', UpdateCollectionSchema), async (c) => {
    const auth = c.get('auth');
    const collectionId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateCollectionInput;
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const loadCollection = async (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('collections')
            .select('id, store_id')
            .eq('id', collectionId).in('store_id', storeIds);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.maybeSingle();
    };

    let { data: existing, error: existingError } = await loadCollection(true);
    if (isMissingDeletedAtError(existingError)) {
        ({ data: existing, error: existingError } = await loadCollection(false));
    }

    if (isMissingTableError(existingError, 'collections')) {
        return c.json({ error: { code: 'COLLECTION_SCHEMA_MISSING', message: 'Collections are not available in this environment.' } }, 503);
    }
    if (existingError) {
        return c.json({ error: { code: 'DB_ERROR', message: existingError.message } }, 500);
    }

    const collection = existing as { id: string; store_id?: string | null } | null;
    if (!collection?.store_id || !(await verifyStoreOwnership(db, collection.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } }, 404);
    }

    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title;
    if (body.description !== undefined) update.description = body.description || null;
    if (body.image_url !== undefined) update.image_url = body.image_url || null;
    if (body.is_active !== undefined) update.is_active = body.is_active;

    const updateCollection = (includeAuditFields: boolean) => {
        const payload = includeAuditFields ? { ...update, updated_by: customUser.id } : update;
        return db
            .from('collections')
            .update(payload)
            .eq('id', collectionId).in('store_id', storeIds)
            .select()
            .single();
    };

    let { data, error } = await updateCollection(true);
    if (isMissingAuditColumnError(error)) {
        ({ data, error } = await updateCollection(false));
    }

    if (error || !data) {
        return c.json({ error: { code: 'DB_ERROR', message: error?.message || 'Unable to update collection' } }, 500);
    }

    return c.json(success(data));
});

// GET/PUT /products/collections/:id/products — current-owner manual membership.
router.get('/collections/:id/products', async (c) => {
    const selected = c.req.query('store_id') || c.req.header('X-Store-ID');
    if (!selected || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selected)) throw new ValidationError('Select a valid store before managing collection products.');
    const scope = await resolveOwnedStoreScope(c, selected);
    return c.json(success(await readCollectionMembership(scope, c.req.param('id'))));
});
router.put('/collections/:id/products', async (c) => {
    const selected = c.req.query('store_id') || c.req.header('X-Store-ID');
    if (!selected || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selected)) throw new ValidationError('Select a valid store before managing collection products.');
    const scope = await resolveOwnedStoreScope(c, selected);
    const body = await c.req.json().catch(() => null);
    if (!body || body.idempotency_key !== (c.req.header('X-Idempotency-Key') || c.req.header('Idempotency-Key'))) {
        throw new ValidationError('The original collection save key is required.');
    }
    return c.json(success(await replaceCollectionMembership(c.env, scope, c.req.param('id'), body)));
});

// DELETE /products/collections/:id — Soft-delete a collection
router.delete('/collections/:id', async (c) => {
    const auth = c.get('auth');
    const collectionId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const loadCollection = async (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('collections')
            .select('id, store_id')
            .eq('id', collectionId).in('store_id', storeIds);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.maybeSingle();
    };

    let { data: existing, error: existingError } = await loadCollection(true);
    if (isMissingDeletedAtError(existingError)) {
        ({ data: existing, error: existingError } = await loadCollection(false));
    }

    if (isMissingTableError(existingError, 'collections')) {
        return c.json({ error: { code: 'COLLECTION_SCHEMA_MISSING', message: 'Collections are not available in this environment.' } }, 503);
    }
    if (existingError) {
        return c.json({ error: { code: 'DB_ERROR', message: existingError.message } }, 500);
    }

    const collection = existing as { id: string; store_id?: string | null } | null;
    if (!collection?.store_id || !(await verifyStoreOwnership(db, collection.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } }, 404);
    }

    const softDeleteCollection = (includeAuditFields: boolean) => {
        const payload: Record<string, unknown> = { deleted_at: new Date().toISOString() };
        if (includeAuditFields) payload.updated_by = customUser.id;
        return db
            .from('collections')
            .update(payload)
            .eq('id', collectionId).in('store_id', storeIds);
    };

    let { error } = await softDeleteCollection(true);
    if (isMissingAuditColumnError(error)) {
        ({ error } = await softDeleteCollection(false));
    }
    if (isMissingDeletedAtError(error)) {
        ({ error } = await db
            .from('collections')
            .delete()
            .eq('id', collectionId).in('store_id', storeIds));
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ deleted: true, id: collectionId }));
});

// Gift cards — issuance + lifecycle on the canonical gift_card_accounts model
// (LB-11). Registered here so the public paths stay /products/gift-cards*; the
// implementation lives in ./gift-cards to keep this router under the line budget.
registerGiftCardRoutes(router);

// POST /products/sample — Seed one clearly labeled inactive sample product for an empty store
router.post('/sample', validate('json', StoreScopedQuerySchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as StoreScopedQueryInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownsStore = await verifyStoreOwnership(db, body.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let existingSample: Record<string, unknown> | null = null;
    try {
        existingSample = await loadExistingSampleProduct(db, c.env, body.store_id);
        if (existingSample) return c.json(success(existingSample));

        const productCount = await countStoreProducts(db, body.store_id);
        if (productCount > 0) {
            return c.json({
                error: {
                    code: 'PRODUCT_CATALOG_NOT_EMPTY',
                    message: 'Sample products can only be added to an empty catalog.',
                },
            }, 409);
        }
    } catch {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to inspect product catalog.' } }, 500);
    }

    const service = createProductExecutionAdapter(db, c.env);
    let data: Record<string, unknown>;
    try {
        data = await service.createProduct(sampleProductInput(body.store_id), customUser.id, auth.user.storeId) as Record<string, unknown>;
    } catch {
        try {
            existingSample = await loadExistingSampleProduct(db, c.env, body.store_id);
            if (existingSample) return c.json(success(existingSample));
        } catch {
            // Fall through to the generic, merchant-safe failure response.
        }
        return c.json({ error: { code: 'SAMPLE_PRODUCT_CREATE_FAILED', message: 'Unable to create sample product.' } }, 500);
    }

    await emitProductEvent(db, {
        eventType: 'product.created',
        product: data,
        fallbackStoreId: body.store_id,
        actorId: customUser.id,
        requestId: c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || null,
    });

    return c.json(success(data), 201);
});

// GET /products/:id
// Phase 2 / F2.5: products is a registered tenant table; `.eq('id', productId)` alone (no
// store_id) is not a scope predicate, so GET /products/:id 500'd via the tenant guard for every
// caller -- reproduced live. Bootstrap lookup by the product's own globally-unique id, before its
// store_id is known: bounded to one row (.single()), and the caller (below) re-verifies the
// result's own store_id via ownership/staff-permission before trusting it for anything -- the same
// documented shape as the other getSupabaseAdminUnguarded call sites.
async function loadProductByIdUnguarded(
    c: Context<{ Bindings: Env }>,
    productId: string,
): Promise<{ product: Record<string, unknown> | null; error: unknown }> {
    const unguardedDb = getSupabaseAdminUnguarded(c);
    const buildProductQuery = (includeDeletedAtFilter: boolean) => {
        const query = unguardedDb
            .from('products')
            .select(productVariantRelationalReadsEnabled(c.env) ? PRODUCT_LIST_COLUMNS_RELATIONAL : '*')
            .eq('id', productId);

        return includeDeletedAtFilter ? query.is('deleted_at', null).single() : query.single();
    };

    let { data, error } = await buildProductQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildProductQuery(false));
    }
    return { product: data as unknown as Record<string, unknown> | null, error };
}

router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const productId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { product, error } = await loadProductByIdUnguarded(c, productId);

    if (error || !product) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    }

    // Re-verified against the product's OWN store_id (never a client-supplied value): the owner
    // passes, or an active staff member holding products:read/products:write at that store --
    // verifyStoreOwnership alone denied a real Manager with products:write reading a product they
    // could otherwise edit, the same gap fixed for the list route (assertStaffPermission).
    const storeId = String(product.store_id);
    const isOwner = await verifyStoreOwnership(db, storeId, customUser.id, auth.user.storeId);
    if (!isOwner) {
        const staffBlock = await assertStaffPermission(c, storeId, customUser.id, 'products:read');
        if (staffBlock) return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    }

    const selectedStore = c.req.header('X-Store-ID');
    if (selectedStore && selectedStore !== storeId) return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    const data = await readProductForEdit(c.env, storeId, productId, customUser.id,
        c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID());
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

    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const service = createProductExecutionAdapter(db, c.env);
    const data = await service.createProduct(body, customUser.id, auth.user.storeId, true);
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

    // The staff check needs the product's own store; a session usually carries none (APPID-P5b).
    // Resolved the same way GET /:id resolves it (loadProductByIdUnguarded, never an ownership
    // derivation) -- the product's real store is looked up first, then owner-OR-staff is checked
    // against it, so a real, permitted staff member (not just the literal owner) can reach this.
    const { product, error: lookupError } = await loadProductByIdUnguarded(c, productId);
    if (lookupError || !product) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    }
    const productStoreId = String(product.store_id);
    const selectedStore = c.req.header('X-Store-ID');
    if (selectedStore && selectedStore !== productStoreId) return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    const headerKey = c.req.header('X-Idempotency-Key') || c.req.header('Idempotency-Key');
    if (headerKey && headerKey.toLowerCase() !== body.idempotency_key.toLowerCase()) throw new ValidationError('The save key must match the edit intent.');
    const staffBlock = await assertStaffPermission(c, productStoreId, customUser.id, 'products:write', 'enforce');
    if (staffBlock) return staffBlock;

    const service = createProductExecutionAdapter(db, c.env);
    const data = await service.updateProduct(productId, productStoreId, customUser.id, body as Record<string, unknown>,
        c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID());

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

    const staffBlock = await assertStaffPermission(c, body.store_id, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const service = createProductExecutionAdapter(db, c.env);
    const result = await service.bulkAction(body.store_id, body.product_ids, body.action, customUser.id, auth.user.storeId, true);
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

    const { product, error: lookupError } = await loadProductByIdUnguarded(c, productId);
    if (lookupError || !product) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    }
    const productStoreId = String(product.store_id);
    const staffBlock = await assertStaffPermission(c, productStoreId, customUser.id, 'products:write');
    if (staffBlock) return staffBlock;

    const service = createProductExecutionAdapter(db, c.env);
    const result = await service.softDelete(productId, productStoreId, customUser.id);
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
