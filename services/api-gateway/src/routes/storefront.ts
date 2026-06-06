// ============================================================
// STOREFRONT (PUBLIC) — Unauthenticated APIs (Doc 10/09 §21)
// ============================================================
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { dbFailureBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import {
    cachedJson,
    storefrontRequestCacheKey,
    STOREFRONT_CACHE_SWR_SECONDS,
    STOREFRONT_CACHE_TTL_SECONDS,
} from '../lib/storefront-cache';
import { validate } from '../middleware/validation';
import {
    StorefrontProductReviewsQuery,
    type StorefrontProductReviewsQueryInput,
} from '../schemas/review.schema';
import { registerStorefrontInternalPaymentRoutes } from './storefront/internal-payment-routes';
import { registerStorefrontPublicRoutes } from './storefront/public-routes';
import { ProductExecutionAdapter } from '../execution/product-execution.adapter';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import {
    getCustomerSession,
    isCustomerLegacyAuthEnabled,
    requireCustomerSession,
} from '../middleware/customer-session';
import { csrfProtection, extractTurnstileToken, verifyTurnstileToken } from '../middleware/security';
import { getPooledSql } from '@letbuyy/infrastructure/pooled-sql-adapter';
import {
    planCouponValidation,
    storefrontCouponValidationError,
    type CouponRecord,
} from '@letbuyy/checkout-core';
import {
    emptyPublicReviewsPayload,
    summarizePublicProductReviews,
    type PublicProductReviewRecord,
} from '@letbuyy/commerce-core';
import {
    buildPublicNavigationTree,
    normalizeStorefrontRoutePage,
    normalizeStorefrontRoutePolicy,
    storefrontPageToNavigationItem,
    type CmsNavigationItemRecord,
    type CmsPolicyRecord,
    type CmsStorefrontPageRevisionRecord,
    type CmsStorefrontRoutePageRecord,
} from '@letbuyy/cms-core';
import {
    mapPublicStorePayload,
    normalizeStorefrontHandle,
    type PublishedStoreRecord,
    type StorefrontSiteRecord,
    type StorefrontThemeReleaseRecord,
} from '@letbuyy/tenant-core';
import { normalizeAppBlockInstance, type AppBlockInstance } from '@letbuyy/app-engine';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;
type StorefrontJsonValue = null | boolean | number | string | StorefrontJsonValue[] | { [key: string]: StorefrontJsonValue };
const DEFAULT_STOREFRONT_VIEW_SAMPLE_RATE = 0.1;

function storefrontCacheTags(storeId: string, handle: string, ...tags: string[]): string[] {
    return [`storefront:${storeId}`, `storefront:${handle}`, ...tags];
}

router.use('/customer/wishlist', requireCustomerSession);
router.use('/customer/wishlist/*', requireCustomerSession);
router.use('/customer/orders', requireCustomerSession);
router.use('/customer/activity', requireCustomerSession);
router.use('/customer/profile', requireCustomerSession);
router.use('/customer/addresses', requireCustomerSession);
router.use('/customer/addresses/*', requireCustomerSession);
router.use('/customer/wishlist', csrfProtection);
router.use('/customer/wishlist/*', csrfProtection);
router.use('/customer/activity', csrfProtection);
router.use('/customer/profile', csrfProtection);
router.use('/customer/addresses', csrfProtection);
router.use('/customer/addresses/*', csrfProtection);
router.use('/reviews', csrfProtection);
router.use('/:subdomain/contact', csrfProtection);

type StorefrontPaidOrderSnapshot = {
    id?: string;
    store_id?: string;
    site_id?: string;
    order_number?: string;
    customer_id?: string;
    total?: number | string;
    currency?: string | null;
};

type StorefrontProductDetail = {
    id: string;
    slug?: string | null;
};

type RazorpayOrderResponse = {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string };
};

type NavigationMenuRow = {
    id: string;
    handle: string;
    name: string;
    location: string;
    metadata?: Record<string, unknown> | null;
};

function storefrontJsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function storefrontJsonRecordArray(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
        return value
            .map((item) => storefrontJsonRecord(item))
            .filter((item) => Object.keys(item).length > 0);
    }

    const record = storefrontJsonRecord(value);
    return Object.keys(record).length > 0 ? [record] : [];
}

function firstStorefrontRelatedRecord(value: unknown): Record<string, unknown> {
    return storefrontJsonRecordArray(value)[0] || storefrontJsonRecord(value);
}

function storefrontString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function isMissingColumnError(error: DatabaseErrorLike, columnName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(columnName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

async function requireValidTurnstile(c: AppContext, body: unknown): Promise<Response | null> {
    const token = extractTurnstileToken(body);
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
    const isHuman = await verifyTurnstileToken(c.env, token, ip);
    if (isHuman) return null;

    return c.json(
        {
            success: false,
            error: {
                code: 'TURNSTILE_REQUIRED',
                message: 'Bot verification failed',
            },
        },
        403,
    );
}

async function listPublicProductReviews(c: AppContext) {
    const query = c.get('validatedQuery') as StorefrontProductReviewsQueryInput;
    const productId = query.product_id;
    const storeId = query.store_id;

    const db = getSupabaseAdmin(c);
    const buildQuery = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('product_reviews')
            .select('id, customer_name, rating, title, body, images, is_verified, helpful_count, created_at')
            .eq('product_id', productId)
            .eq('store_id', storeId)
            .eq('is_approved', true);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);

        return request
            .order('created_at', { ascending: false })
            .limit(50);
    };

    let { data, error } = await buildQuery(true);

    if (isMissingColumnError(error, 'deleted_at')) {
        ({ data, error } = await buildQuery(false));
    }

    if (error) {
        if (isMissingTableError(error, 'product_reviews')) {
            return c.json(success(emptyPublicReviewsPayload()));
        }

        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to load product reviews' } }, 500);
    }

    const reviews = (data || []) as PublicProductReviewRecord[];
    return c.json(success(summarizePublicProductReviews(reviews)));
}

function getRequestId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function storefrontViewSampleRate(value: string | undefined): number {
    const parsed = Number(value ?? DEFAULT_STOREFRONT_VIEW_SAMPLE_RATE);
    if (!Number.isFinite(parsed)) return DEFAULT_STOREFRONT_VIEW_SAMPLE_RATE;
    return Math.min(1, Math.max(0, parsed));
}

function shouldSampleStorefrontView(rate: number): boolean {
    if (rate <= 0) return false;
    if (rate >= 1) return true;
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    return (random[0] || 0) / 0xffffffff < rate;
}

function emitProductViewedEvent(
    c: AppContext,
    input: {
        storeId: string;
        product: StorefrontProductDetail;
    },
): void {
    const queue = c.env.ANALYTICS_QUEUE;
    if (!queue) return;

    const sampleRate = storefrontViewSampleRate(c.env.STOREFRONT_VIEW_SAMPLE_RATE);
    if (!shouldSampleStorefrontView(sampleRate)) return;

    const requestId = getRequestId(c);
    const occurredAt = new Date().toISOString();
    const eventId = `product.viewed:${input.storeId}:${input.product.id}:${crypto.randomUUID()}`;
    const sampleWeight = sampleRate > 0 ? Math.round(1 / sampleRate) : 0;

    c.executionCtx.waitUntil(queue.send({
        messageId: eventId,
        queueName: 'analytics-events',
        jobType: 'product.viewed',
        siteId: input.storeId,
        idempotencyKey: eventId,
        requestId,
        correlationId: requestId,
        payload: {
            id: eventId,
            type: 'product.viewed',
            site_id: input.storeId,
            aggregate: {
                type: 'product',
                id: input.product.id,
            },
            occurred_at: occurredAt,
            request_id: requestId,
            idempotency_key: eventId,
            schema_version: 1,
            payload: {
                product_id: input.product.id,
                product_slug: input.product.slug || undefined,
                sample_rate: sampleRate,
                sample_weight: sampleWeight,
                source: 'storefront-runtime',
            },
        },
        attempts: 0,
    }).then(() => undefined, () => undefined));
}

function orderEventTotalPayload(totalValue: unknown): { amount_minor: number; currency: 'INR' } | undefined {
    const total = typeof totalValue === 'number' || typeof totalValue === 'string' ? Number(totalValue) : Number.NaN;
    if (!Number.isFinite(total) || total < 0) return undefined;
    return { amount_minor: Math.round(total * 100), currency: 'INR' };
}

async function emitStorefrontOrderPaidEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        storeId?: string | null;
        orderId: string;
        order: StorefrontPaidOrderSnapshot;
        fallbackOrder?: StorefrontPaidOrderSnapshot;
        requestId: string;
        idempotencyKey: string;
    },
): Promise<void> {
    const order = input.order || {};
    const fallbackOrder = input.fallbackOrder || {};
    const storeId = input.storeId || order.site_id || order.store_id || fallbackOrder.site_id || fallbackOrder.store_id;
    if (!storeId) return;

    const total = orderEventTotalPayload(order.total ?? fallbackOrder.total);

    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId,
        aggregateType: 'order',
        aggregateId: order.id || input.orderId,
        eventType: 'order.paid',
        payload: {
            site_id: storeId,
            order_id: order.id || input.orderId,
            order_number: order.order_number || fallbackOrder.order_number || undefined,
            customer_id: order.customer_id || fallbackOrder.customer_id || undefined,
            ...(total ? { total } : {}),
        },
        idempotencyKey: `order.paid:${storeId}:${input.orderId}:${input.idempotencyKey}`,
        requestId: input.requestId,
        actorId: null,
    });
}

const STOREFRONT_SITE_SELECT: string =
    'id,user_id,custom_user_id,name,store_name,subdomain,site_type,tagline,logo_url,brand_color,custom_domain,currency,locale,theme_id,template_config,status,published_at,created_at,updated_at,seo_title,seo_description';
const STOREFRONT_SITE_RELEASE_SELECT: string =
    `${STOREFRONT_SITE_SELECT},current_theme_release_id,storefront_release_version`;
const STOREFRONT_SITE_COMPAT_SELECT: string =
    'id,user_id,custom_user_id,name,store_name,subdomain,site_type,tagline,logo_url,brand_color,custom_domain,currency,locale,theme_id,template_config,status,published_at,created_at,updated_at';
const STOREFRONT_SITE_RELEASE_COMPAT_SELECT: string =
    `${STOREFRONT_SITE_COMPAT_SELECT},current_theme_release_id,storefront_release_version`;
const PRODUCT_SELECT_FULL: string =
    'id,store_id,name,slug,description,images,price,compare_price,compare_at_price,currency,stock,quantity,stock_quantity,is_active,is_featured,status,category,tags,variants,avg_rating,review_count,display_order,created_at,updated_at,seo_title,seo_description';
const PRODUCT_SELECT_COMPAT: string =
    'id,store_id,name,slug,description,images,price,compare_price,currency,stock,quantity,is_active,is_featured,status,category,tags,variants,display_order,created_at,updated_at,seo_title,seo_description';
const PRODUCT_SELECT_MINIMAL: string =
    'id,store_id,name,description,images,price,category,tags,created_at,updated_at,seo_title,seo_description';
const PRODUCT_SELECT_FULL_RELATIONAL: string = PRODUCT_SELECT_FULL.replace(',variants', '');
const PRODUCT_SELECT_COMPAT_RELATIONAL: string = PRODUCT_SELECT_COMPAT.replace(',variants', '');

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

type PublicProductQueryOptions = {
    limit: number;
    page?: number;
    ids?: string[];
    category?: string;
    search?: string;
    paginated?: boolean;
};

type SqlRecord = Record<string, unknown>;
type SqlParameter = null | boolean | number | string | Date | Uint8Array | readonly SqlParameter[];
type ProductSqlRow = SqlRecord & { __total_count?: number | string | null };
type PublicProductRow = SqlRecord;
type PublicProductQueryResult = {
    data: PublicProductRow[];
    count: number;
    error: DatabaseErrorLike;
};

type SearchDocumentProductResult = {
    ids: string[];
    count: number;
};

type PublicProductVariantRow = {
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

type StorefrontOrderItemRow = {
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
    variant_title?: string | null;
    product_snapshot?: Record<string, unknown> | string | null;
};

function storefrontSearchIndexReadsEnabled(env: Pick<Env, 'STOREFRONT_SEARCH_PROJECTION'>): boolean {
    return (env.STOREFRONT_SEARCH_PROJECTION || 'on').trim().toLowerCase() !== 'off';
}

function productVariantRelationalReadsEnabled(env: Pick<Env, 'PRODUCT_VARIANTS_RELATIONAL_READS'>): boolean {
    return (env.PRODUCT_VARIANTS_RELATIONAL_READS || 'on').trim().toLowerCase() !== 'off';
}

function orderItemsRelationalReadsEnabled(env: Pick<Env, 'ORDER_ITEMS_RELATIONAL_READS'>): boolean {
    return (env.ORDER_ITEMS_RELATIONAL_READS || 'on').trim().toLowerCase() !== 'off';
}

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isSchemaMismatchError(error: DatabaseErrorLike): boolean {
    const text = databaseErrorText(error);
    return text.includes('does not exist') || text.includes('schema cache') || text.includes('could not find');
}

function normalizeSqlValue(value: unknown): unknown {
    return value instanceof Date ? value.toISOString() : value;
}

function normalizeSqlRecord<T extends object>(row: T): T {
    const normalized: SqlRecord = {};
    for (const [key, value] of Object.entries(row as SqlRecord)) {
        normalized[key] = normalizeSqlValue(value);
    }
    return normalized as T;
}

function normalizeSqlRecords<T extends object>(rows: T[]): T[] {
    return rows.map((row) => normalizeSqlRecord(row));
}

function storefrontNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function publicProductVariantView(row: PublicProductVariantRow): Record<string, unknown> {
    return {
        id: row.id,
        product_id: row.product_id,
        title: row.title || '',
        price: storefrontNumber(row.price) ?? 0,
        compare_price: storefrontNumber(row.compare_price),
        sku: storefrontString(row.sku),
        barcode: storefrontString(row.barcode),
        stock: storefrontNumber(row.inventory_qty) ?? 0,
        inventory_qty: storefrontNumber(row.inventory_qty) ?? 0,
        weight: storefrontNumber(row.weight),
        weight_unit: storefrontString(row.weight_unit) || 'kg',
        option1: storefrontString(row.option1),
        option2: storefrontString(row.option2),
        option3: storefrontString(row.option3),
        image_url: storefrontString(row.image_url),
        position: storefrontNumber(row.position) ?? 0,
    };
}

async function hydratePublicProductVariants(c: AppContext, products: PublicProductRow[]): Promise<PublicProductRow[]> {
    if (!productVariantRelationalReadsEnabled(c.env)) return products;

    const productIds = products
        .map((product) => storefrontString(product.id))
        .filter((id): id is string => Boolean(id));

    if (productIds.length === 0) return products;

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('product_variants')
        .select('id, product_id, title, price, compare_price, sku, barcode, inventory_qty, weight, weight_unit, option1, option2, option3, image_url, position')
        .in('product_id', Array.from(new Set(productIds)))
        .order('position', { ascending: true });

    if (isMissingTableError(error, 'product_variants')) return products;
    if (error) throw new Error(`Storefront product variant hydration failed: ${error.message}`);

    const variantsByProduct = new Map<string, Record<string, unknown>[]>();
    for (const row of (data || []) as PublicProductVariantRow[]) {
        variantsByProduct.set(row.product_id, [
            ...(variantsByProduct.get(row.product_id) || []),
            publicProductVariantView(row),
        ]);
    }

    return products.map((product) => {
        const productId = storefrontString(product.id);
        if (!productId) return product;
        const variants = variantsByProduct.get(productId) || [];
        return {
            ...product,
            variants,
            product_variants: variants,
        };
    });
}

async function hydrateStorefrontOrderItems(c: AppContext, orders: SqlRecord[]): Promise<SqlRecord[]> {
    if (!orderItemsRelationalReadsEnabled(c.env)) return orders;

    const orderIds = orders
        .map((order) => storefrontString(order.id))
        .filter((id): id is string => Boolean(id));

    if (orderIds.length === 0) return orders;

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('order_items')
        .select('id, order_id, product_id, variant_id, title, name, sku, quantity, unit_price, price, total, variant_title, product_snapshot')
        .in('order_id', Array.from(new Set(orderIds)))
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (isMissingTableError(error, 'order_items')) return orders;
    if (error) throw new Error(`Storefront order item hydration failed: ${error.message}`);

    const itemsByOrder = new Map<string, StorefrontOrderItemRow[]>();
    for (const row of (data || []) as StorefrontOrderItemRow[]) {
        itemsByOrder.set(row.order_id, [
            ...(itemsByOrder.get(row.order_id) || []),
            row,
        ]);
    }

    return orders.map((order) => {
        const orderId = storefrontString(order.id);
        if (!orderId) return order;
        const items = itemsByOrder.get(orderId) || [];
        return {
            ...order,
            items,
            order_items: items,
        };
    });
}

function productRowWithoutCount(row: ProductSqlRow): SqlRecord {
    const normalized = normalizeSqlRecord(row);
    delete normalized.__total_count;
    return normalized;
}

function publicProductRows(value: unknown): PublicProductRow[] {
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is PublicProductRow => {
        return Boolean(row) && typeof row === 'object' && !Array.isArray(row);
    });
}

function searchDocumentTerm(value: string | undefined): string | null {
    const term = value?.trim().replace(/\s+/g, ' ').slice(0, 120);
    return term && term.length >= 2 ? term : null;
}

function sortProductsBySearchDocumentIds(products: PublicProductRow[], ids: string[]): PublicProductRow[] {
    const rank = new Map(ids.map((id, index) => [id, index]));
    return [...products].sort((left, right) => {
        const leftRank = typeof left.id === 'string' ? rank.get(left.id) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        const rightRank = typeof right.id === 'string' ? rank.get(right.id) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        return leftRank - rightRank;
    });
}

async function querySearchDocumentProductIds(
    c: AppContext,
    storeId: string,
    options: PublicProductQueryOptions,
): Promise<SearchDocumentProductResult | null> {
    const term = searchDocumentTerm(options.search);
    if (!term) return null;

    const db = getSupabaseAdmin(c);
    const offset = ((options.page || 1) - 1) * options.limit;
    let query = db
        .from('search_documents')
        .select('object_id', { count: options.paginated ? 'exact' : undefined })
        .eq('site_id', storeId)
        .eq('object_type', 'product')
        .eq('status', 'active')
        .is('deleted_at', null)
        .textSearch('search_vector', term, { config: 'simple', type: 'websearch' })
        .order('indexed_at', { ascending: false });

    if (options.category) {
        query = query.contains('attributes', { category: options.category });
    }

    const result = options.paginated
        ? await query.range(offset, offset + options.limit - 1)
        : await query.limit(options.limit);

    if (result.error) return null;

    const ids = Array.isArray(result.data)
        ? result.data
            .map((row) => typeof row.object_id === 'string' ? row.object_id : null)
            .filter((id): id is string => Boolean(id))
        : [];

    return {
        ids,
        count: result.count || ids.length,
    };
}

async function loadPublishedStoreFromPooledSql(c: AppContext, handle: string): Promise<PublishedStoreRecord | null> {
    const sql = getPooledSql(c.env);
    if (!sql) return null;
    const rows = await sql.unsafe<PublishedStoreRecord[]>(
        'select id from sites where (subdomain = $1 or store_name = $1) and status = $2 and deleted_at is null limit 1',
        [handle, 'published'],
    ).catch(() => []);
    return normalizeSqlRecords(rows)[0] || null;
}

async function loadSiteByHandleFromPooledSql(c: AppContext, handle: string): Promise<StorefrontSiteRecord | null> {
    const sql = getPooledSql(c.env);
    if (!sql) return null;
    const rows = await sql.unsafe<StorefrontSiteRecord[]>(
        `select ${STOREFRONT_SITE_RELEASE_SELECT}
         from sites
         where (subdomain = $1 or store_name = $1)
           and status = $2
           and deleted_at is null
         limit 1`,
        [handle, 'published'],
    ).catch(() => []);
    return normalizeSqlRecords(rows)[0] || null;
}

async function loadCurrentThemeReleaseFromPooledSql(c: AppContext, storeId: string): Promise<StorefrontThemeReleaseRecord | null> {
    const sql = getPooledSql(c.env);
    if (!sql) return null;
    const rows = await sql.unsafe<StorefrontThemeReleaseRecord[]>(
        `select id, theme_id, theme_instance_id, theme_package_version_id, release_version, release_config, release_manifest,
                template_snapshot, settings_snapshot, asset_manifest, cache_manifest, data_binding_manifest,
                schema_manifest_version, engine_version, published_at
         from theme_releases
         where store_id = $1
           and is_current = true
           and release_status = $2
           and deleted_at is null
         order by release_version desc
         limit 1`,
        [storeId, 'published'],
    ).catch(() => []);
    return normalizeSqlRecords(rows)[0] || null;
}

async function queryPublicProductsFromPooledSql(c: AppContext, storeId: string, options: PublicProductQueryOptions): Promise<PublicProductQueryResult | null> {
    const sql = getPooledSql(c.env);
    if (!sql) return null;

    const params: SqlParameter[] = [storeId];
    const filters = ['store_id = $1', 'is_active = true', 'deleted_at is null'];

    if (options.ids?.length) {
        params.push(options.ids);
        filters.push(`id::text = any($${params.length}::text[])`);
    }

    if (options.category) {
        params.push(options.category);
        filters.push(`category = $${params.length}`);
    }

    if (options.search) {
        params.push(`%${options.search}%`);
        filters.push(`name ilike $${params.length}`);
    }

    const offset = ((options.page || 1) - 1) * options.limit;
    params.push(options.limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const countSelect = options.paginated ? ', count(*) over() as __total_count' : '';
    const selectColumns = productVariantRelationalReadsEnabled(c.env)
        ? PRODUCT_SELECT_FULL_RELATIONAL
        : PRODUCT_SELECT_FULL;
    const rows = await sql.unsafe<ProductSqlRow[]>(
        `select ${selectColumns}${countSelect}
         from products
         where ${filters.join(' and ')}
         order by display_order asc
         limit $${limitParam} offset $${offsetParam}`,
        params,
    ).catch(() => null);

    if (!rows) return null;
    const count = options.paginated
        ? Number(rows[0]?.__total_count || 0)
        : rows.length;
    return {
        data: rows.map(productRowWithoutCount),
        count,
        error: null,
    };
}

async function loadPublishedStore(c: AppContext, subdomain: string): Promise<PublishedStoreRecord | null> {
    const db = getSupabaseAdmin(c);
    const handle = normalizeStorefrontHandle(subdomain);
    if (!handle) return null;

    const pooledStore = await loadPublishedStoreFromPooledSql(c, handle);
    if (pooledStore) return pooledStore;

    const selectStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id')
            .or(`subdomain.eq.${handle},store_name.eq.${handle}`)
            .eq('status', 'published');

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: store, error } = await selectStore(true).single();

    if (error || !store) {
        ({ data: store } = await selectStore(false).single());
    }

    return store as PublishedStoreRecord | null;
}

async function loadPublishedStoreById(c: AppContext, storeId: string): Promise<PublishedStoreRecord | null> {
    const db = getSupabaseAdmin(c);
    const selectStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id')
            .eq('id', storeId)
            .eq('status', 'published');

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: store, error } = await selectStore(true).single();

    if (error || !store) {
        ({ data: store } = await selectStore(false).single());
    }

    return store as PublishedStoreRecord | null;
}

async function loadSiteByHandle(
    c: AppContext,
    handle: string,
    options: { publishedOnly: boolean }
): Promise<StorefrontSiteRecord | null> {
    const normalized = normalizeStorefrontHandle(handle);
    if (!normalized) return null;

    const db = getSupabaseAdmin(c);
    if (options.publishedOnly) {
        const pooledSite = await loadSiteByHandleFromPooledSql(c, normalized);
        if (pooledSite) return pooledSite;
    }

    const selectSite = (selectFields: string, includeDeletedAtFilter: boolean) => {
        let query = db
            .from('sites')
            .select(selectFields)
            .or(`subdomain.eq.${normalized},store_name.eq.${normalized}`)
            .limit(1);

        if (options.publishedOnly) query = query.eq('status', 'published');
        if (includeDeletedAtFilter) query = query.is('deleted_at', null);

        return query;
    };

    let { data, error } = await selectSite(STOREFRONT_SITE_RELEASE_SELECT, true).single();

    if (error || !data) {
        ({ data, error } = await selectSite(STOREFRONT_SITE_RELEASE_COMPAT_SELECT, true).single());
    }

    if (error || !data) {
        ({ data, error } = await selectSite(STOREFRONT_SITE_SELECT, true).single());
    }

    if (error || !data) {
        ({ data, error } = await selectSite(STOREFRONT_SITE_COMPAT_SELECT, true).single());
    }

    if (error || !data) {
        ({ data } = await selectSite(STOREFRONT_SITE_COMPAT_SELECT, false).single());
    }

    return (data as StorefrontSiteRecord | null) || null;
}

async function loadCurrentThemeRelease(c: AppContext, storeId: string): Promise<StorefrontThemeReleaseRecord | null> {
    const db = getSupabaseAdmin(c);
    const pooledRelease = await loadCurrentThemeReleaseFromPooledSql(c, storeId);
    if (pooledRelease) return pooledRelease;

    const baseQuery = (select: string, includeDeletedAtFilter: boolean) => {
        let query = db
            .from('theme_releases')
            .select(select)
            .eq('store_id', storeId)
            .eq('is_current', true)
            .eq('release_status', 'published');

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query.order('release_version', { ascending: false }).limit(1);
    };

    const extendedSelect = 'id, theme_id, theme_instance_id, theme_package_version_id, release_version, release_config, release_manifest, template_snapshot, settings_snapshot, asset_manifest, cache_manifest, data_binding_manifest, schema_manifest_version, engine_version, published_at';
    const legacySelect = 'id, theme_id, release_version, release_config, published_at';
    let { data, error } = await baseQuery(extendedSelect, true).maybeSingle();

    if (error || !data) {
        ({ data, error } = await baseQuery(legacySelect, true).maybeSingle());
    }

    if (error || !data) {
        ({ data } = await baseQuery(legacySelect, false).maybeSingle());
    }

    return (data as StorefrontThemeReleaseRecord | null) || null;
}

function appBlockFromRegistryRegistration(registration: Record<string, unknown>): AppBlockInstance | null {
    const settings = storefrontJsonRecord(registration.settings);
    const appId = storefrontString(registration.app_id);
    const registrationId = storefrontString(registration.id);
    if (!appId || !registrationId) return null;

    const extensionHandle = storefrontString(registration.extension_handle) || registrationId;
    const slot = storefrontString(settings.slot)
        || storefrontString(registration.target)
        || 'storefront.home.after-hero';
    const title = storefrontString(settings.title)
        || storefrontString(settings.label)
        || storefrontString(settings.name)
        || extensionHandle;
    const renderer = storefrontString(registration.renderer);
    const renderMode = renderer === 'iframe' || settings.render_mode === 'iframe' || settings.renderMode === 'iframe'
        ? 'iframe'
        : 'inline';
    const sourceUrl = storefrontString(registration.source_url);
    const iframeUrl = renderMode === 'iframe'
        ? storefrontString(settings.iframe_url) || storefrontString(settings.iframeUrl) || sourceUrl || undefined
        : undefined;

    return normalizeAppBlockInstance({
        id: `app-registry-${registrationId}`,
        app_id: appId,
        extension_id: registrationId,
        slot,
        title,
        render_mode: renderMode,
        iframe_url: iframeUrl,
        settings: {
            ...settings,
            app_id: appId,
            extension_id: registrationId,
            extension_handle: extensionHandle,
            source_entrypoint: storefrontString(registration.source_entrypoint) || undefined,
            manifest_schema_version: storefrontString(registration.manifest_schema_version) || undefined,
            slot,
            title,
            render_mode: renderMode,
        },
        content: {
            heading: settings.heading || settings.headline,
            body: settings.body || settings.description,
            cta_label: settings.cta_label || settings.ctaLabel,
            cta_href: settings.cta_href || settings.ctaHref,
        },
    }, {
        id: `app-registry-${registrationId}`,
        app_id: appId,
        extension_id: registrationId,
        slot,
        title,
    });
}

async function loadPublicStorefrontAppBlocks(c: AppContext, storeId: string): Promise<AppBlockInstance[]> {
    const [registeredBlocks, legacyBlocks] = await Promise.all([
        loadRegisteredThemeAppBlocks(c, storeId),
        loadLegacyStorefrontAppBlocks(c, storeId),
    ]);

    const merged = new Map<string, AppBlockInstance>();
    for (const block of legacyBlocks) merged.set(block.id, block);
    for (const block of registeredBlocks) merged.set(block.id, block);
    return Array.from(merged.values());
}

async function loadRegisteredThemeAppBlocks(c: AppContext, storeId: string): Promise<AppBlockInstance[]> {
    const { data, error } = await getSupabaseAdmin(c)
        .from('app_extension_registrations')
        .select('id, site_id, app_id, installation_id, extension_handle, extension_type, surface, target, renderer, source_url, source_entrypoint, scopes, capabilities, settings, manifest_schema_version, app_version, status, sort_order, created_at, updated_at')
        .eq('site_id', storeId)
        .eq('surface', 'theme.app_block')
        .eq('status', 'enabled')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (error || !Array.isArray(data)) {
        if (isMissingTableError(error, 'app_extension_registrations')) return [];
        return [];
    }

    return data
        .map((registration) => appBlockFromRegistryRegistration(registration as Record<string, unknown>))
        .filter((block): block is AppBlockInstance => block !== null);
}

async function loadLegacyStorefrontAppBlocks(c: AppContext, storeId: string): Promise<AppBlockInstance[]> {
    const { data, error } = await getSupabaseAdmin(c)
        .from('app_installations')
        .select('id, app_id, store_id, config, marketplace_apps(id, name, slug, app_url, app_extensions(id, type, target, label, config, sort_order))')
        .eq('store_id', storeId)
        .eq('status', 'active');

    if (error || !Array.isArray(data)) return [];

    const blocks: AppBlockInstance[] = [];
    for (const installation of data as Record<string, unknown>[]) {
        const app = firstStorefrontRelatedRecord(installation.marketplace_apps);
        const installConfig = storefrontJsonRecord(installation.config);
        const appId = storefrontString(installation.app_id) || storefrontString(app.id);
        if (!appId) continue;

        const appName = storefrontString(app.name) || 'Installed app';
        const extensions = storefrontJsonRecordArray(app.app_extensions)
            .filter((extension) => {
                const type = storefrontString(extension.type);
                return type === 'storefront_block' || type === 'app-block' || type === 'app_block';
            })
            .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0));

        for (const [index, extension] of extensions.entries()) {
            const config = storefrontJsonRecord(extension.config);
            const extensionId = storefrontString(extension.id) || `storefront-block-${index + 1}`;
            const renderMode = config.render_mode === 'iframe' || config.renderMode === 'iframe' ? 'iframe' : 'inline';
            const slot = storefrontString(config.slot)
                || storefrontString(installConfig.default_app_block_slot)
                || storefrontString(extension.target)
                || 'storefront.home.after-hero';
            const title = storefrontString(config.title)
                || storefrontString(extension.label)
                || appName;

            const block = normalizeAppBlockInstance({
                id: `app-${appId}-${extensionId}`,
                app_id: appId,
                extension_id: extensionId,
                slot,
                title,
                render_mode: renderMode,
                iframe_url: config.iframe_url || config.iframeUrl || (renderMode === 'iframe' ? extension.target : undefined),
                settings: {
                    ...config,
                    app_id: appId,
                    extension_id: extensionId,
                    slot,
                    title,
                    render_mode: renderMode,
                },
                content: {
                    heading: config.heading || config.headline,
                    body: config.body || config.description,
                    cta_label: config.cta_label || config.ctaLabel,
                    cta_href: config.cta_href || config.ctaHref,
                },
            }, {
                id: `app-${appId}-${extensionId}`,
                app_id: appId,
                extension_id: extensionId,
                slot,
                title,
            });

            if (block) blocks.push(block);
        }
    }

    return blocks;
}

async function queryPublicProducts(c: AppContext, storeId: string, options: PublicProductQueryOptions): Promise<PublicProductQueryResult> {
    const db = getSupabaseAdmin(c);
    if (options.search && storefrontSearchIndexReadsEnabled(c.env)) {
        const projected = await querySearchDocumentProductIds(c, storeId, options);
        if (projected) {
            if (projected.ids.length === 0) return { data: [], count: 0, error: null };

            const hydrated = await queryPublicProducts(c, storeId, {
                ...options,
                ids: projected.ids,
                limit: projected.ids.length,
                paginated: false,
                search: undefined,
            });

            return {
                data: sortProductsBySearchDocumentIds(hydrated.data, projected.ids),
                count: projected.count,
                error: hydrated.error,
            };
        }
    }

    const pooledResult = await queryPublicProductsFromPooledSql(c, storeId, options);
    if (pooledResult) {
        return {
            ...pooledResult,
            data: await hydratePublicProductVariants(c, pooledResult.data),
        };
    }

    const relationalProductVariants = productVariantRelationalReadsEnabled(c.env);
    const attempts = [
        { select: relationalProductVariants ? PRODUCT_SELECT_FULL_RELATIONAL : PRODUCT_SELECT_FULL, useDeletedAt: true, useActive: true, orderBy: 'display_order' },
        { select: relationalProductVariants ? PRODUCT_SELECT_COMPAT_RELATIONAL : PRODUCT_SELECT_COMPAT, useDeletedAt: true, useActive: true, orderBy: 'display_order' },
        { select: relationalProductVariants ? PRODUCT_SELECT_COMPAT_RELATIONAL : PRODUCT_SELECT_COMPAT, useDeletedAt: false, useActive: true, orderBy: 'display_order' },
        { select: PRODUCT_SELECT_MINIMAL, useDeletedAt: false, useActive: false, orderBy: 'created_at' },
    ];
    let lastError: DatabaseErrorLike = null;

    for (const attempt of attempts) {
        let query = options.paginated
            ? db.from('products').select(attempt.select, { count: 'exact' })
            : db.from('products').select(attempt.select);

        query = query.eq('store_id', storeId);
        if (attempt.useActive) query = query.eq('is_active', true);
        if (attempt.useDeletedAt) query = query.is('deleted_at', null);
        if (options.ids?.length) query = query.in('id', options.ids);
        if (options.category && attempt.select.includes('category')) query = query.eq('category', options.category);
        if (options.search && attempt.select.includes('name')) query = query.ilike('name', `%${options.search}%`);
        query = query.order(attempt.orderBy, { ascending: true });

        const offset = ((options.page || 1) - 1) * options.limit;
        const result = options.paginated
            ? await query.range(offset, offset + options.limit - 1)
            : await query.limit(options.limit);

        if (!result.error) {
            const data = publicProductRows(result.data);
            return {
                data: await hydratePublicProductVariants(c, data),
                count: result.count || data.length,
                error: null,
            };
        }

        lastError = result.error;
        if (!isSchemaMismatchError(result.error)) break;
    }

    if (isSchemaMismatchError(lastError)) {
        return { data: [], count: 0, error: null };
    }

    return { data: [], count: 0, error: lastError };
}

function normalizePublicRouteToken(value: string): string | null {
    const normalized = value.trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-_]{0,120}$/.test(normalized) ? normalized : null;
}

async function listLegacyStorefrontPages(
    c: AppContext,
    storeId: string,
    options: { navOnly?: boolean } = {}
) {
    const db = getSupabaseAdmin(c);
    const attempts = [
        'id,title,slug,page_type,is_homepage,display_order,show_in_nav,status,body,html_content,content,published_at,updated_at',
        'id,title,slug,page_type,is_homepage,display_order,show_in_nav,status,body,content,published_at,updated_at',
        'id,title,slug,page_type,is_homepage,display_order,show_in_nav,status,content,published_at,updated_at',
        'id,title,slug,content,status,created_at,updated_at',
    ];
    let lastError: DatabaseErrorLike = null;

    for (const select of attempts) {
        let query = db
            .from('pages')
            .select(select)
            .eq('store_id', storeId)
            .eq('status', 'published');

        if (options.navOnly && select.includes('show_in_nav')) {
            query = query.eq('show_in_nav', true);
        }

        const result = await query.order(select.includes('display_order') ? 'display_order' : 'updated_at', { ascending: true });

        if (!result.error) {
            return (result.data || []).map((row, index) => {
                const page = row as unknown as CmsStorefrontRoutePageRecord;
                return normalizeStorefrontRoutePage({
                    ...page,
                    page_type: page.page_type || 'page',
                    display_order: page.display_order || index,
                    show_in_nav: page.show_in_nav ?? !options.navOnly,
                });
            });
        }

        lastError = result.error;
        if (!isSchemaMismatchError(result.error)) break;
    }

    if (isSchemaMismatchError(lastError) || isMissingTableError(lastError, 'pages')) {
        return [];
    }

    throw new Error(lastError?.message || 'Failed to load legacy pages');
}

async function listStorefrontPages(c: AppContext, storeId: string, options: { navOnly?: boolean } = {}) {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('storefront_pages')
        .select('id,title,slug,status,page_type,seo,content,assigned_template_key,published_revision_id,published_at,updated_at')
        .eq('store_id', storeId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('published_at', { ascending: false });

    if (!error) {
        const pages = (data || []).map((page) => normalizeStorefrontRoutePage(page as CmsStorefrontRoutePageRecord));
        if (pages.length > 0) return pages;
        return listLegacyStorefrontPages(c, storeId, options);
    }

    if (isMissingTableError(error, 'storefront_pages') || isSchemaMismatchError(error)) {
        return listLegacyStorefrontPages(c, storeId, options);
    }

    throw new Error(error.message);
}

async function loadStorefrontPageBySlug(c: AppContext, storeId: string, slug: string) {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('storefront_pages')
        .select('id,title,slug,status,page_type,seo,content,assigned_template_key,published_revision_id,published_at,updated_at')
        .eq('store_id', storeId)
        .eq('slug', slug)
        .eq('status', 'published')
        .is('deleted_at', null)
        .maybeSingle();

    if (!error && data) {
        const page = data as CmsStorefrontRoutePageRecord;
        let revision: CmsStorefrontPageRevisionRecord | null = null;

        if (page.published_revision_id) {
            const revisionResult = await db
                .from('storefront_page_revisions')
                .select('id,title,slug,seo,content,template_key,created_at')
                .eq('id', page.published_revision_id)
                .eq('store_id', storeId)
                .maybeSingle();

            if (!revisionResult.error && revisionResult.data) {
                revision = revisionResult.data as CmsStorefrontPageRevisionRecord;
            }
        }

        return normalizeStorefrontRoutePage(page, revision);
    }

    if (error && !(isMissingTableError(error, 'storefront_pages') || isSchemaMismatchError(error))) {
        throw new Error(error.message);
    }

    const legacyPages = await listLegacyStorefrontPages(c, storeId);
    return legacyPages.find((page) => page.slug === slug) || null;
}

async function listStorefrontPolicies(c: AppContext, storeId: string) {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('storefront_policies')
        .select('id,policy_type,slug,title,body,status,seo,published_at,updated_at')
        .eq('store_id', storeId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('policy_type', { ascending: true });

    if (!error) return (data || []).map((policy) => normalizeStorefrontRoutePolicy(policy as CmsPolicyRecord));
    if (isMissingTableError(error, 'storefront_policies') || isSchemaMismatchError(error)) return [];
    throw new Error(error.message);
}

async function loadStorefrontPolicy(c: AppContext, storeId: string, token: string) {
    const policies = await listStorefrontPolicies(c, storeId);
    return policies.find((policy) => policy.policy_type === token || policy.slug === token) || null;
}

async function loadNavigationMenu(c: AppContext, storeId: string, location: string) {
    const db = getSupabaseAdmin(c);
    const { data: menu, error } = await db
        .from('navigation_menus')
        .select('id,handle,name,location,metadata')
        .eq('store_id', storeId)
        .eq('location', location)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!error && menu) {
        const activeMenu = menu as NavigationMenuRow;
        const itemResult = await db
            .from('navigation_menu_items')
            .select('id,menu_id,parent_item_id,label,url,target_type,target_resource_id,sort_order,open_in_new_tab,metadata')
            .eq('menu_id', activeMenu.id)
            .eq('store_id', storeId)
            .eq('is_visible', true)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true });

        if (itemResult.error) {
            throw new Error(itemResult.error.message);
        }

        return {
            menu: activeMenu,
            items: buildPublicNavigationTree((itemResult.data || []) as CmsNavigationItemRecord[]),
            source: 'navigation_menus',
        };
    }

    if (error && !(isMissingTableError(error, 'navigation_menus') || isSchemaMismatchError(error))) {
        throw new Error(error.message);
    }

    const pages = await listLegacyStorefrontPages(c, storeId, { navOnly: true });
    return {
        menu: null,
        items: pages.filter((page) => page.show_in_nav).map(storefrontPageToNavigationItem),
        source: 'legacy_pages',
    };
}

registerStorefrontInternalPaymentRoutes(router, {
    getRequestId,
    emitStorefrontOrderPaidEvent,
});

// GET /storefront/lookup?q=handle — Public store lookup for routing/search surfaces
registerStorefrontPublicRoutes(router, {
    loadSiteByHandle,
    loadPublishedStore,
    loadPublishedStoreById,
    loadCurrentThemeRelease,
    loadPublicStorefrontAppBlocks,
    listPublicProductReviews,
    queryPublicProducts,
    hydratePublicProductVariants,
    emitProductViewedEvent,
    productVariantRelationalReadsEnabled,
    normalizePublicRouteToken,
    loadNavigationMenu,
    listStorefrontPages,
    listStorefrontPolicies,
    loadStorefrontPolicy,
    loadStorefrontPageBySlug,
    hydrateStorefrontOrderItems,
    orderItemsRelationalReadsEnabled,
    isMissingColumnError,
    isMissingTableError,
    isSchemaMismatchError,
    requireValidTurnstile,
    getRequestId,
    emitStorefrontOrderPaidEvent,
});

export default router;
