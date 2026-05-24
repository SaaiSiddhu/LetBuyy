// ============================================================
// STOREFRONT (PUBLIC) — Unauthenticated APIs (Doc 10/09 §21)
// ============================================================
import { Hono } from 'hono';
import type { Context } from 'hono';
import * as bcrypt from 'bcryptjs';
import type { Env } from '../index';
import { dbFailureBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    StorefrontCreateOrderSchema,
    StorefrontRazorpayOrderSchema,
    StorefrontRazorpayVerifySchema,
} from '../schemas/order.schema';
import {
    CreateStorefrontProductReviewSchema,
    StorefrontProductReviewsQuery,
    type CreateStorefrontProductReviewInput,
    type StorefrontProductReviewsQueryInput,
} from '../schemas/review.schema';
import { OrderService } from '../services/order.service';
import { PaymentService } from '../services/payment.service';
import { ProductService } from '../services/product.service';
import { IdempotencyService } from '../services/idempotency.service';
import { createPublicStorefrontTenantContext } from '../lib/tenant-context';
import { createRazorpayOrder } from '@letbuyy/infrastructure/razorpay-adapter';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

type StorefrontCreateOrderBody = {
    customer: {
        name: string;
        email: string;
        phone?: string;
        address: {
            address: string;
            city: string;
            state: string;
            pincode: string;
        };
    };
    items: Array<{
        productId: string;
        variantId?: string | null;
        quantity: number;
    }>;
    paymentMethod: 'razorpay' | 'stripe' | 'paypal' | 'cod';
    deliveryOption: 'standard' | 'express';
    notes?: string;
    couponCode?: string;
    giftCardCode?: string;
    idempotencyKey: string;
};

type OrderRpcResult = {
    id?: string;
    order_number?: string;
    status?: string;
    total?: number | string;
};

type StorefrontRazorpayOrderBody = {
    orderId: string;
    idempotencyKey: string;
};

type StorefrontRazorpayVerifyBody = {
    orderId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    idempotencyKey: string;
};

type PublishedStore = {
    id: string;
};

type StorefrontSiteRow = {
    id: string;
    user_id?: string | null;
    custom_user_id?: string | null;
    name?: string | null;
    store_name?: string | null;
    subdomain?: string | null;
    site_type?: string | null;
    tagline?: string | null;
    logo_url?: string | null;
    brand_color?: string | null;
    custom_domain?: string | null;
    currency?: string | null;
    settings?: Record<string, unknown> | null;
    theme_id?: string | null;
    template_config?: Record<string, unknown> | null;
    status?: string | null;
    published_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    cod_enabled?: boolean | null;
    online_payment_enabled?: boolean | null;
    payment_settings?: Record<string, unknown> | null;
    current_theme_release_id?: string | null;
    storefront_release_version?: number | null;
};

type ThemeReleaseRow = {
    id: string;
    theme_id: string;
    theme_instance_id?: string | null;
    theme_package_version_id?: string | null;
    release_version: number;
    release_config: Record<string, unknown> | null;
    release_manifest?: Record<string, unknown> | null;
    template_snapshot?: Record<string, unknown> | null;
    settings_snapshot?: Record<string, unknown> | null;
    asset_manifest?: Record<string, unknown> | null;
    cache_manifest?: Record<string, unknown> | null;
    data_binding_manifest?: Record<string, unknown> | null;
    schema_manifest_version?: string | null;
    engine_version?: string | null;
    published_at: string | null;
};

type ThemePreviewSessionRow = {
    id: string;
    store_id: string;
    theme_id: string;
    draft_id: string | null;
    theme_instance_draft_id?: string | null;
    draft_version: number | null;
    expires_at: string;
};

type ThemeInstanceDraftRow = {
    id: string;
    working_manifest: Record<string, unknown> | null;
    draft_version: number | null;
    auto_saved_at: string | null;
};

type ThemeEditorDraftRow = {
    id: string;
    draft_config: Record<string, unknown> | null;
    version: number | null;
    auto_saved_at: string | null;
};

type StorefrontProductDetail = {
    id: string;
    view_count?: number | null;
};

type RazorpayOrderResponse = {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string };
};

type CustomerWishlistBody = {
    customer_id?: string;
    store_id?: string;
    product_id?: string;
    variant_id?: string | null;
};

type CustomerWishlistSyncBody = {
    customer_id?: string;
    store_id?: string;
    product_ids?: string[];
};

type CustomerActivityBody = {
    customer_id?: string;
    store_id?: string;
    activity_type?: string;
    metadata?: Record<string, unknown>;
};

type CustomerLifecycleBody = {
    customer_id?: string;
    store_id?: string;
    subdomain?: string;
    email?: string;
    email_or_phone?: string;
    full_name?: string | null;
    phone?: string | null;
    password_hash?: string;
    password?: string;
    order_total?: number | string;
    order_id?: string;
};

type CustomerProfileBody = {
    customer_id?: string;
    store_id?: string;
    full_name?: string | null;
    phone?: string | null;
    accepts_marketing?: boolean;
};

type CustomerAddressBody = {
    customer_id?: string;
    store_id?: string;
    customer_email?: string;
    customer_phone?: string | null;
    label?: string | null;
    full_name?: string;
    address_line1?: string;
    address_line2?: string | null;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string | null;
    landmark?: string | null;
    is_default?: boolean;
};

type StorefrontReviewBody = CreateStorefrontProductReviewInput;

type InternalPaymentReferenceBody = {
    orderId?: string;
    storeId?: string;
    provider?: 'razorpay' | 'stripe' | 'paypal';
    paymentReference?: string;
    idempotencyKey?: string | null;
};

type InternalPaymentConfirmBody = {
    orderId?: string;
    provider?: 'razorpay' | 'stripe' | 'paypal';
    paymentId?: string;
    providerOrderId?: string | null;
    providerEventId?: string | null;
    idempotencyKey?: string | null;
};

type InternalPaymentFailureBody = {
    orderId?: string;
    provider?: 'razorpay' | 'stripe' | 'paypal';
    providerEventId?: string;
    paymentStatus?: 'failed' | 'refunded';
    orderStatus?: 'cancelled' | 'refunded';
    reason?: string | null;
    releaseInventory?: boolean;
    idempotencyKey?: string | null;
};

type StorefrontPageRow = {
    id: string;
    title: string;
    slug: string;
    status?: string | null;
    page_type?: string | null;
    seo?: Record<string, unknown> | null;
    content?: Record<string, unknown> | null;
    assigned_template_key?: string | null;
    published_revision_id?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
    is_homepage?: boolean | null;
    display_order?: number | null;
    show_in_nav?: boolean | null;
    body?: string | null;
    html_content?: string | null;
};

type StorefrontPageRevisionRow = {
    id: string;
    title: string;
    slug: string;
    seo?: Record<string, unknown> | null;
    content?: Record<string, unknown> | null;
    template_key?: string | null;
    created_at?: string | null;
};

type StorefrontPolicyRow = {
    id: string;
    policy_type: string;
    slug: string;
    title: string;
    body?: Record<string, unknown> | null;
    status?: string | null;
    seo?: Record<string, unknown> | null;
    published_at?: string | null;
    updated_at?: string | null;
};

type NavigationMenuRow = {
    id: string;
    handle: string;
    name: string;
    location: string;
    metadata?: Record<string, unknown> | null;
};

type NavigationMenuItemRow = {
    id: string;
    menu_id: string;
    parent_item_id?: string | null;
    label: string;
    url?: string | null;
    target_type: string;
    target_resource_id?: string | null;
    sort_order: number;
    open_in_new_tab?: boolean | null;
    metadata?: Record<string, unknown> | null;
};

type PublicNavigationItem = {
    id: string;
    label: string;
    href: string;
    targetType: string;
    targetResourceId: string | null;
    openInNewTab: boolean;
    children: PublicNavigationItem[];
    metadata: Record<string, unknown>;
};

type CouponValidationRow = {
    code: string;
    type?: string | null;
    value?: number | string | null;
    minimum_order_amount?: number | string | null;
    maximum_discount?: number | string | null;
    discount_type?: string | null;
    discount_value?: number | string | null;
    min_order_amount?: number | string | null;
    max_discount?: number | string | null;
    starts_at?: string | null;
    expires_at?: string | null;
    usage_limit?: number | string | null;
    usage_count?: number | string | null;
};

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

function emptyPublicReviewsPayload() {
    return {
        reviews: [],
        summary: {
            totalReviews: 0,
            averageRating: 0,
            distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: 0 })),
        },
    };
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

    const reviews = data || [];
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
        ? Math.round((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / totalReviews) * 10) / 10
        : 0;
    const distribution = [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: reviews.filter((review) => Number(review.rating) === star).length,
    }));

    return c.json(success({
        reviews,
        summary: {
            totalReviews,
            averageRating,
            distribution,
        },
    }));
}

function getRequestId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

const STOREFRONT_SITE_SELECT: string =
    'id,user_id,custom_user_id,name,store_name,subdomain,site_type,tagline,logo_url,brand_color,custom_domain,currency,theme_id,template_config,status,published_at,created_at,updated_at';
const STOREFRONT_SITE_RELEASE_SELECT: string =
    `${STOREFRONT_SITE_SELECT},current_theme_release_id,storefront_release_version`;
const PRODUCT_SELECT_FULL: string =
    'id,store_id,name,slug,description,images,price,compare_price,compare_at_price,currency,stock,quantity,stock_quantity,is_active,is_featured,status,category,tags,variants,avg_rating,review_count,display_order,created_at,updated_at';
const PRODUCT_SELECT_COMPAT: string =
    'id,store_id,name,slug,description,images,price,compare_price,currency,stock,quantity,is_active,is_featured,status,category,tags,variants,display_order,created_at,updated_at';
const PRODUCT_SELECT_MINIMAL: string =
    'id,store_id,name,description,images,price,category,tags,created_at,updated_at';

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

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isSchemaMismatchError(error: DatabaseErrorLike): boolean {
    const text = databaseErrorText(error);
    return text.includes('does not exist') || text.includes('schema cache') || text.includes('could not find');
}

async function loadPublishedStore(c: AppContext, subdomain: string): Promise<PublishedStore | null> {
    const db = getSupabaseAdmin(c);
    const handle = normalizeStoreHandle(subdomain);
    if (!handle) return null;

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

    return store as PublishedStore | null;
}

async function loadPublishedStoreById(c: AppContext, storeId: string): Promise<PublishedStore | null> {
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

    return store as PublishedStore | null;
}

function normalizeStoreHandle(handle: string): string | null {
    const normalized = handle.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,80}$/.test(normalized)) return null;
    return normalized;
}

async function loadSiteByHandle(
    c: AppContext,
    handle: string,
    options: { publishedOnly: boolean }
): Promise<StorefrontSiteRow | null> {
    const normalized = normalizeStoreHandle(handle);
    if (!normalized) return null;

    const db = getSupabaseAdmin(c);
    const selectSite = (includeReleaseColumns: boolean, includeDeletedAtFilter: boolean) => {
        let query = db
            .from('sites')
            .select(includeReleaseColumns ? STOREFRONT_SITE_RELEASE_SELECT : STOREFRONT_SITE_SELECT)
            .or(`subdomain.eq.${normalized},store_name.eq.${normalized}`)
            .limit(1);

        if (options.publishedOnly) query = query.eq('status', 'published');
        if (includeDeletedAtFilter) query = query.is('deleted_at', null);

        return query;
    };

    let { data, error } = await selectSite(true, true).single();

    if (error || !data) {
        ({ data, error } = await selectSite(false, true).single());
    }

    if (error || !data) {
        ({ data } = await selectSite(false, false).single());
    }

    return (data as StorefrontSiteRow | null) || null;
}

async function loadCurrentThemeRelease(c: AppContext, storeId: string): Promise<ThemeReleaseRow | null> {
    const db = getSupabaseAdmin(c);
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

    return (data as ThemeReleaseRow | null) || null;
}

async function queryPublicProducts(c: AppContext, storeId: string, options: PublicProductQueryOptions) {
    const db = getSupabaseAdmin(c);
    const attempts = [
        { select: PRODUCT_SELECT_FULL, useDeletedAt: true, useActive: true, orderBy: 'display_order' },
        { select: PRODUCT_SELECT_COMPAT, useDeletedAt: true, useActive: true, orderBy: 'display_order' },
        { select: PRODUCT_SELECT_COMPAT, useDeletedAt: false, useActive: true, orderBy: 'display_order' },
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
            return {
                data: result.data || [],
                count: result.count || (result.data?.length ?? 0),
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

function toObjectRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function normalizePublicRouteToken(value: string): string | null {
    const normalized = value.trim().toLowerCase();
    return /^[a-z0-9][a-z0-9-_]{0,120}$/.test(normalized) ? normalized : null;
}

function normalizeCmsContent(
    content: Record<string, unknown> | null | undefined,
    body?: string | null,
    html?: string | null
): Record<string, unknown> {
    const normalized = { ...toObjectRecord(content) };

    if (body && typeof body === 'string' && body.trim()) {
        normalized.body = body;
    } else if (html && typeof html === 'string' && html.trim()) {
        normalized.html = html;
    }

    return normalized;
}

function normalizeStorefrontPage(page: StorefrontPageRow, revision?: StorefrontPageRevisionRow | null) {
    return {
        id: page.id,
        title: revision?.title || page.title,
        slug: revision?.slug || page.slug,
        page_type: page.page_type || 'page',
        status: page.status || 'published',
        seo: revision?.seo || page.seo || {},
        content: revision?.content || normalizeCmsContent(page.content, page.body, page.html_content),
        assigned_template_key: revision?.template_key || page.assigned_template_key || null,
        is_homepage: Boolean(page.is_homepage),
        show_in_nav: page.show_in_nav !== false,
        display_order: page.display_order || 0,
        published_at: page.published_at || revision?.created_at || null,
        updated_at: page.updated_at || revision?.created_at || null,
    };
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
                const page = row as unknown as StorefrontPageRow;
                return normalizeStorefrontPage({
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
        const pages = (data || []).map((page) => normalizeStorefrontPage(page as StorefrontPageRow));
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
        const page = data as StorefrontPageRow;
        let revision: StorefrontPageRevisionRow | null = null;

        if (page.published_revision_id) {
            const revisionResult = await db
                .from('storefront_page_revisions')
                .select('id,title,slug,seo,content,template_key,created_at')
                .eq('id', page.published_revision_id)
                .eq('store_id', storeId)
                .maybeSingle();

            if (!revisionResult.error && revisionResult.data) {
                revision = revisionResult.data as StorefrontPageRevisionRow;
            }
        }

        return normalizeStorefrontPage(page, revision);
    }

    if (error && !(isMissingTableError(error, 'storefront_pages') || isSchemaMismatchError(error))) {
        throw new Error(error.message);
    }

    const legacyPages = await listLegacyStorefrontPages(c, storeId);
    return legacyPages.find((page) => page.slug === slug) || null;
}

function normalizePolicy(policy: StorefrontPolicyRow) {
    return {
        id: policy.id,
        policy_type: policy.policy_type,
        slug: policy.slug,
        title: policy.title,
        status: policy.status || 'published',
        seo: policy.seo || {},
        content: policy.body || {},
        published_at: policy.published_at || null,
        updated_at: policy.updated_at || null,
    };
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

    if (!error) return (data || []).map((policy) => normalizePolicy(policy as StorefrontPolicyRow));
    if (isMissingTableError(error, 'storefront_policies') || isSchemaMismatchError(error)) return [];
    throw new Error(error.message);
}

async function loadStorefrontPolicy(c: AppContext, storeId: string, token: string) {
    const policies = await listStorefrontPolicies(c, storeId);
    return policies.find((policy) => policy.policy_type === token || policy.slug === token) || null;
}

function navigationHrefForItem(item: NavigationMenuItemRow): string {
    if (item.url) return item.url;

    const resource = item.target_resource_id || '';
    switch (item.target_type) {
        case 'home':
            return '/';
        case 'product':
            return resource ? `/product/${resource}` : '/shop';
        case 'collection':
            return resource ? `/collections/${resource}` : '/shop';
        case 'page':
            return resource ? `/${resource}` : '#';
        case 'policy':
            return resource ? `/${resource}` : '#';
        case 'cart':
            return '/cart';
        case 'search':
            return '/shop';
        default:
            return resource ? `/${resource}` : '#';
    }
}

function buildNavigationTree(items: NavigationMenuItemRow[]): PublicNavigationItem[] {
    const nodes = new Map<string, PublicNavigationItem>();
    const roots: PublicNavigationItem[] = [];

    for (const item of items) {
        nodes.set(item.id, {
            id: item.id,
            label: item.label,
            href: navigationHrefForItem(item),
            targetType: item.target_type,
            targetResourceId: item.target_resource_id || null,
            openInNewTab: item.open_in_new_tab === true,
            children: [],
            metadata: item.metadata || {},
        });
    }

    for (const item of items) {
        const node = nodes.get(item.id);
        if (!node) continue;

        if (item.parent_item_id && nodes.has(item.parent_item_id)) {
            nodes.get(item.parent_item_id)?.children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}

function pageToNavigationItem(page: ReturnType<typeof normalizeStorefrontPage>): PublicNavigationItem {
    return {
        id: page.id,
        label: page.title,
        href: page.is_homepage ? '/' : `/${page.slug}`,
        targetType: page.page_type || 'page',
        targetResourceId: page.id,
        openInNewTab: false,
        children: [],
        metadata: {},
    };
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
            items: buildNavigationTree((itemResult.data || []) as NavigationMenuItemRow[]),
            source: 'navigation_menus',
        };
    }

    if (error && !(isMissingTableError(error, 'navigation_menus') || isSchemaMismatchError(error))) {
        throw new Error(error.message);
    }

    const pages = await listLegacyStorefrontPages(c, storeId, { navOnly: true });
    return {
        menu: null,
        items: pages.filter((page) => page.show_in_nav).map(pageToNavigationItem),
        source: 'legacy_pages',
    };
}

function mapPublicStorePayload(store: StorefrontSiteRow, release?: ThemeReleaseRow | null) {
    return {
        ...store,
        name: store.name || store.store_name,
        subdomain: store.subdomain || store.store_name,
        current_theme_release: release
            ? {
                id: release.id,
                theme_id: release.theme_id,
                theme_instance_id: release.theme_instance_id || null,
                theme_package_version_id: release.theme_package_version_id || null,
                release_version: release.release_version,
                release_config: release.template_snapshot || release.release_config || {},
                release_manifest: release.release_manifest || {},
                template_snapshot: release.template_snapshot || release.release_config || {},
                settings_snapshot: release.settings_snapshot || {},
                asset_manifest: release.asset_manifest || {},
                cache_manifest: release.cache_manifest || {},
                data_binding_manifest: release.data_binding_manifest || {},
                schema_manifest_version: release.schema_manifest_version || '1.0.0',
                engine_version: release.engine_version || 'legacy',
                published_at: release.published_at,
            }
            : null,
    };
}

async function verifyStoreCustomer(c: AppContext, storeId: string, customerId: string): Promise<boolean> {
    const db = getSupabaseAdmin(c);
    const { data } = await db
        .from('store_customers')
        .select('id')
        .eq('id', customerId)
        .eq('store_id', storeId)
        .single();

    return Boolean(data);
}

function normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
}

function normalizeContact(value: string): string {
    return value.toLowerCase().trim();
}

async function insertCustomerActivity(
    c: AppContext,
    customerId: string,
    storeId: string,
    activityType: string,
    metadata: Record<string, unknown>
): Promise<void> {
    const db = getSupabaseAdmin(c);
    await db.from('customer_activity_log').insert({
        customer_id: customerId,
        store_id: storeId,
        activity_type: activityType,
        metadata,
    });
}

async function resolveCredentialStoreId(c: AppContext, body: CustomerLifecycleBody): Promise<string | null> {
    if (body.store_id) return body.store_id;
    if (!body.subdomain) return null;

    const store = await loadPublishedStore(c, body.subdomain);
    return store?.id || null;
}

function hexToBytes(hex: string): Uint8Array {
    const normalized = hex.toLowerCase();
    const bytes = new Uint8Array(normalized.length / 2);
    for (let index = 0; index < normalized.length; index += 2) {
        bytes[index / 2] = parseInt(normalized.slice(index, index + 2), 16);
    }
    return bytes;
}

function timingSafeEqualHex(leftHex: string, rightHex: string): boolean {
    if (leftHex.length !== rightHex.length) return false;
    if (!/^[a-f0-9]+$/i.test(leftHex) || !/^[a-f0-9]+$/i.test(rightHex)) return false;

    const left = hexToBytes(leftHex);
    const right = hexToBytes(rightHex);
    let diff = 0;
    for (let index = 0; index < left.length; index += 1) {
        diff |= left[index] ^ right[index];
    }
    return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signatureBuffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function isInternalRequest(c: AppContext): boolean {
    const configuredSecret = c.env.INTERNAL_API_SECRET;
    if (!configuredSecret && c.env.ENVIRONMENT !== 'production') return true;
    if (!configuredSecret) return false;
    return c.req.header('X-Internal-API-Secret') === configuredSecret;
}

function assertProvider(value: unknown): value is 'razorpay' | 'stripe' | 'paypal' {
    return value === 'razorpay' || value === 'stripe' || value === 'paypal';
}

async function loadInternalPayableOrder(c: AppContext, orderId: string, storeId?: string) {
    const db = getSupabaseAdmin(c);

    if (storeId) {
        return new PaymentService(db).loadStorefrontPayableOrder(orderId, storeId);
    }

    const { data: order } = await db
        .from('orders')
        .select('id, store_id, total, currency, items, customer_email, payment_id, payment_method, payment_status, status, inventory_reserved_at')
        .eq('id', orderId)
        .is('deleted_at', null)
        .single();

    if (!order) throw new Error('Order not found');
    if (order.payment_status === 'paid') throw new Error('Order is already paid');
    if (order.status === 'cancelled' || order.status === 'refunded') throw new Error('Order is not payable');

    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) throw new Error('Order has no payable total');

    return { ...order, total, currency: order.currency || 'INR' };
}

// GET /storefront/internal/orders/:orderId/payable — Internal server-to-worker payable order read
router.get('/internal/orders/:orderId/payable', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const orderId = c.req.param('orderId');
    const storeId = c.req.query('store_id') || undefined;
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || (storeId && !/^[0-9a-f-]{36}$/i.test(storeId))) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid order or store id' } }, 400);
    }

    try {
        const order = await loadInternalPayableOrder(c, orderId, storeId);
        return c.json(success({ order }));
    } catch {
        return c.json({ success: false, error: { code: 'PAYMENT_ORDER_NOT_PAYABLE', message: 'Order is not payable' } }, 409);
    }
});

// POST /storefront/internal/payments/reference — Internal provider reference attach
router.post('/internal/payments/reference', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const body = await c.req.json() as InternalPaymentReferenceBody;
    if (!body.orderId || !assertProvider(body.provider) || !body.paymentReference) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider and paymentReference are required' } }, 400);
    }

    if (body.storeId) await loadInternalPayableOrder(c, body.orderId, body.storeId);

    const db = getSupabaseAdmin(c);
    await new PaymentService(db).attachPaymentReference({
        orderId: body.orderId,
        provider: body.provider,
        providerOrderId: body.paymentReference,
        requestId: getRequestId(c),
        idempotencyKey: body.idempotencyKey || null,
    });

    return c.json(success({ attached: true }));
});

// POST /storefront/internal/payments/confirm — Internal provider payment confirmation
router.post('/internal/payments/confirm', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const body = await c.req.json() as InternalPaymentConfirmBody;
    if (!body.orderId || !assertProvider(body.provider) || !body.paymentId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider and paymentId are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const order = await new PaymentService(db).confirmPayment({
        orderId: body.orderId,
        provider: body.provider,
        providerPaymentId: body.paymentId,
        providerOrderId: body.providerOrderId || null,
        providerEventId: body.providerEventId || `${body.provider}:storefront:${body.paymentId}`,
        requestId: getRequestId(c),
        idempotencyKey: body.idempotencyKey || null,
    });

    return c.json(success({ order }));
});

// POST /storefront/internal/payments/failure — Internal provider payment failure/refund state
router.post('/internal/payments/failure', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const body = await c.req.json() as InternalPaymentFailureBody;
    if (!body.orderId || !assertProvider(body.provider) || !body.providerEventId || !body.paymentStatus || !body.orderStatus) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'orderId, provider, providerEventId, paymentStatus and orderStatus are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const order = await new PaymentService(db).recordPaymentFailure({
        orderId: body.orderId,
        provider: body.provider,
        providerEventId: body.providerEventId,
        paymentStatus: body.paymentStatus,
        orderStatus: body.orderStatus,
        reason: body.reason || null,
        releaseInventory: Boolean(body.releaseInventory),
        requestId: getRequestId(c),
        idempotencyKey: body.idempotencyKey || null,
    });

    return c.json(success({ order }));
});

// GET /storefront/lookup?q=handle — Public store lookup for routing/search surfaces
router.get('/lookup', async (c) => {
    const query = normalizeStoreHandle(c.req.query('q') || '');
    if (!query) {
        return c.json({
            success: true,
            data: {
                status: 'invalid',
                message: 'Store name must contain 3-80 letters, numbers or hyphens',
            },
        });
    }

    const db = getSupabaseAdmin(c);
    const selectFields = 'store_name,name,status,site_type,subdomain';
    const { data: exactMatch } = await db
        .from('sites')
        .select(selectFields)
        .or(`store_name.eq.${query},subdomain.eq.${query}`)
        .not('status', 'eq', 'suspended')
        .is('deleted_at', null)
        .limit(1);

    const exactSite = exactMatch?.[0];
    if (exactSite) {
        return c.json(success({
            status: 'found',
            store: {
                name: exactSite.name || exactSite.store_name,
                subdomain: exactSite.subdomain || exactSite.store_name,
                status: exactSite.status,
                siteType: exactSite.site_type,
            },
        }));
    }

    const { data: fuzzyMatch } = await db
        .from('sites')
        .select(selectFields)
        .ilike('name', `%${query}%`)
        .not('status', 'eq', 'suspended')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

    const fuzzySite = fuzzyMatch?.[0];
    if (fuzzySite) {
        return c.json(success({
            status: 'found',
            store: {
                name: fuzzySite.name || fuzzySite.store_name,
                subdomain: fuzzySite.subdomain || fuzzySite.store_name,
                status: fuzzySite.status,
                siteType: fuzzySite.site_type,
            },
        }));
    }

    return c.json(success({ status: 'not_found' }));
});

// GET /storefront/directory — Public LetBuyy discovery directory and aggregate stats
router.get('/directory', async (c) => {
    const db = getSupabaseAdmin(c);

    const { data: storesRaw } = await db
        .from('sites')
        .select(`
            store_name,
            name,
            logo_url,
            theme_id,
            status,
            site_type,
            created_at,
            users_custom!sites_custom_user_id_fkey (
                full_name,
                email
            )
        `)
        .in('status', ['draft', 'published'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(12);

    const [storesCount, themesCount, productsCount, ordersCount] = await Promise.all([
        db.from('sites').select('*', { count: 'exact', head: true }).not('status', 'eq', 'suspended').is('deleted_at', null),
        db.from('online_store_themes').select('*', { count: 'exact', head: true }),
        db.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        db.from('orders').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    ]);

    return c.json(success({
        stores: storesRaw || [],
        stats: {
            totalStores: storesCount.count || 0,
            totalThemes: themesCount.count || 0,
            totalProducts: productsCount.count || 0,
            totalOrders: ordersCount.count || 0,
        },
    }));
});

// GET /storefront/store/:storeId — Public published store data by immutable ID.
// Kept for legacy storefront service compatibility; still only returns published stores.
router.get('/store/:storeId', async (c) => {
    const storeId = c.req.param('storeId');
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid store id' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const selectStore = (includeReleaseColumns: boolean, includeDeletedAtFilter: boolean) => {
        let query = db
            .from('sites')
            .select(includeReleaseColumns ? STOREFRONT_SITE_RELEASE_SELECT : STOREFRONT_SITE_SELECT)
            .eq('id', storeId)
            .eq('status', 'published');

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);

        return query;
    };

    let { data, error } = await selectStore(true, true).single();

    if (error || !data) {
        ({ data, error } = await selectStore(false, true).single());
    }

    if (error || !data) {
        ({ data } = await selectStore(false, false).single());
    }

    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const store = data as unknown as StorefrontSiteRow;
    const release = await loadCurrentThemeRelease(c, store.id);
    return c.json(success(mapPublicStorePayload(store, release)));
});

// GET /storefront/store/:storeId/products — Public published product listing by store ID
router.get('/store/:storeId/products', async (c) => {
    const storeId = c.req.param('storeId');
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid store id' } }, 400);
    }

    const store = await loadPublishedStoreById(c, storeId);

    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 100);
    const { data, error } = await queryPublicProducts(c, storeId, { limit });
    if (error) return c.json(dbFailureBody(), 500);
    return c.json(success(data || []));
});

// GET /storefront/store/:storeId/coupons/validate — Public checkout coupon validation by store ID
router.get('/store/:storeId/coupons/validate', async (c) => {
    const storeId = c.req.param('storeId');
    if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid store id' } }, 400);
    }

    const store = await loadPublishedStoreById(c, storeId);

    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    return validateCouponForStore(c, storeId);
});

// GET /storefront/reviews — Public approved reviews for a product.
// Keep this before /:subdomain so "reviews" is not treated as a tenant handle.
router.get('/reviews', validate('query', StorefrontProductReviewsQuery), listPublicProductReviews);

// GET /storefront/:subdomain/theme-preview?token=...
// Signed storefront preview for editor iframes. Uses the same public store payload
// shape as live rendering, but swaps the current release config with the draft.
router.get('/:subdomain/theme-preview', async (c) => {
    const token = c.req.query('token') || '';
    if (!token || token.length > 200) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Preview token is required' } }, 400);
    }

    const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: false });
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const db = getSupabaseAdmin(c);
    const tokenHash = await sha256Hex(token);
    let { data: session, error: sessionError } = await db
        .from('theme_preview_sessions')
        .select('id, store_id, theme_id, draft_id, theme_instance_draft_id, draft_version, expires_at')
        .eq('store_id', store.id)
        .eq('token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (isMissingColumnError(sessionError, 'theme_instance_draft_id')) {
        ({ data: session, error: sessionError } = await db
            .from('theme_preview_sessions')
            .select('id, store_id, theme_id, draft_id, draft_version, expires_at')
            .eq('store_id', store.id)
            .eq('token_hash', tokenHash)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle());
    }

    if (isMissingTableError(sessionError, 'theme_preview_sessions')) {
        return c.json({ success: false, error: { code: 'PREVIEW_UNAVAILABLE', message: 'Theme preview sessions are not migrated yet' } }, 503);
    }

    if (sessionError) {
        return c.json(dbFailureBody(), 500);
    }

    if (!session) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Preview session not found or expired' } }, 404);
    }

    const previewSession = session as ThemePreviewSessionRow;
    let draftId = previewSession.theme_instance_draft_id || previewSession.draft_id || '';
    let draftManifest: Record<string, unknown> = {};
    let draftVersion = previewSession.draft_version || 1;
    let draftSavedAt = new Date().toISOString();
    let draftLoaded = false;

    if (previewSession.theme_instance_draft_id) {
        const { data: instanceDraft, error: instanceDraftError } = await db
            .from('theme_instance_drafts')
            .select('id, working_manifest, draft_version, auto_saved_at')
            .eq('id', previewSession.theme_instance_draft_id)
            .eq('store_id', store.id)
            .maybeSingle();

        if (instanceDraftError && !isMissingTableError(instanceDraftError, 'theme_instance_drafts')) {
            return c.json(dbFailureBody(), 500);
        }

        if (instanceDraft) {
            const draftRecord = instanceDraft as ThemeInstanceDraftRow;
            draftId = draftRecord.id;
            draftManifest = draftRecord.working_manifest || {};
            draftVersion = draftRecord.draft_version || previewSession.draft_version || 1;
            draftSavedAt = draftRecord.auto_saved_at || draftSavedAt;
            draftLoaded = true;
        }
    }

    if (!draftLoaded && previewSession.draft_id) {
        const { data: legacyDraft, error: legacyDraftError } = await db
            .from('theme_editor_drafts')
            .select('id, draft_config, version, auto_saved_at')
            .eq('id', previewSession.draft_id)
            .eq('store_id', store.id)
            .eq('theme_id', previewSession.theme_id)
            .maybeSingle();

        if (isMissingTableError(legacyDraftError, 'theme_editor_drafts')) {
            return c.json({ success: false, error: { code: 'PREVIEW_UNAVAILABLE', message: 'Theme editor drafts are not migrated yet' } }, 503);
        }

        if (legacyDraftError) {
            return c.json(dbFailureBody(), 500);
        }

        if (legacyDraft) {
            const draftRecord = legacyDraft as ThemeEditorDraftRow;
            draftId = draftRecord.id;
            draftManifest = draftRecord.draft_config || {};
            draftVersion = draftRecord.version || previewSession.draft_version || 1;
            draftSavedAt = draftRecord.auto_saved_at || draftSavedAt;
            draftLoaded = true;
        }
    }

    if (!draftLoaded) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Preview draft not found' } }, 404);
    }

    const liveRelease = await loadCurrentThemeRelease(c, store.id);
    const previewRelease: ThemeReleaseRow = {
        id: previewSession.id,
        theme_id: previewSession.theme_id,
        theme_instance_id: liveRelease?.theme_instance_id || null,
        theme_package_version_id: liveRelease?.theme_package_version_id || null,
        release_version: draftVersion,
        release_config: draftManifest,
        release_manifest: {
            ...(liveRelease?.release_manifest || {}),
            preview: true,
            preview_session_id: previewSession.id,
            draft_id: draftId,
            theme_instance_draft_id: previewSession.theme_instance_draft_id || null,
        },
        template_snapshot: draftManifest,
        settings_snapshot: {},
        asset_manifest: liveRelease?.asset_manifest || {},
        cache_manifest: { tags: [`store:${store.id}`, `theme:${previewSession.theme_id}`, `theme_preview:${previewSession.id}`] },
        data_binding_manifest: liveRelease?.data_binding_manifest || {},
        schema_manifest_version: liveRelease?.schema_manifest_version || '1.0.0',
        engine_version: liveRelease?.engine_version || 'theme-engine-v1',
        published_at: draftSavedAt,
    };

    return c.json(success({
        ...mapPublicStorePayload(store, previewRelease),
        theme_preview: {
            session_id: previewSession.id,
            draft_id: draftId,
            theme_instance_draft_id: previewSession.theme_instance_draft_id || null,
            draft_version: draftVersion,
            expires_at: previewSession.expires_at,
        },
    }));
});

// GET /storefront/:subdomain — Public published store data and immutable current release
router.get('/:subdomain', async (c) => {
    const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: true });
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const release = await loadCurrentThemeRelease(c, store.id);
    return c.json(success(mapPublicStorePayload(store, release)));
});

// GET /storefront/:subdomain/status — Public limited status data for coming-soon routing.
// Draft/suspended stores never expose mutable theme config through this endpoint.
router.get('/:subdomain/status', async (c) => {
    const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: false });
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    return c.json(success({
        id: store.id,
        name: store.name || store.store_name,
        store_name: store.store_name,
        subdomain: store.subdomain || store.store_name,
        site_type: store.site_type,
        tagline: store.tagline,
        logo_url: store.logo_url,
        status: store.status || 'draft',
        published_at: store.published_at || null,
        created_at: store.created_at || null,
        updated_at: store.updated_at || null,
    }));
});

// POST /storefront/:subdomain/orders — Public checkout order creation.
// The subdomain owns tenant resolution; client-submitted store IDs and totals are ignored.
router.post('/:subdomain/orders', validate('json', StorefrontCreateOrderSchema), async (c) => {
    const db = getSupabaseAdmin(c);
    const subdomain = c.req.param('subdomain');
    const body = c.get('validatedBody') as StorefrontCreateOrderBody;
    const store = await loadPublishedStore(c, subdomain);

    if (!store) {
        return c.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
            404
        );
    }

    const service = new OrderService(db);
    const tenant = await createPublicStorefrontTenantContext(c, store.id);
    const idempotency = new IdempotencyService(db);
    const claim = await idempotency.begin({
        siteId: store.id,
        key: body.idempotencyKey,
        scope: 'storefront.checkout.order.create',
        requestBody: { ...body, resolvedStoreId: store.id },
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(claim.responseBody as any, claim.statusCode as any);
    }

    try {
        const order = await service.createOrder(
            {
                customer_name: body.customer.name,
                customer_email: body.customer.email,
                customer_phone: body.customer.phone,
                shipping_address: {
                    line1: body.customer.address.address,
                    city: body.customer.address.city,
                    state: body.customer.address.state,
                    zip: body.customer.address.pincode,
                    country: 'IN',
                },
                items: body.items.map((item) => ({
                    product_id: item.productId,
                    variant_id: item.variantId || null,
                    quantity: item.quantity,
                })),
                payment_method: body.paymentMethod,
                shipping_method: body.deliveryOption,
                notes: body.notes,
                coupon_code: body.couponCode,
                gift_card_code: body.giftCardCode,
                idempotency_key: body.idempotencyKey,
            },
            tenant
        ) as OrderRpcResult;

        const responseBody = success({
            order: {
                id: order.id || '',
                orderNumber: order.order_number || '',
                status: order.status || 'pending',
                total: Number(order.total || 0),
            },
        });

        await idempotency.complete({
            id: claim.id,
            responseBody,
            statusCode: 201,
            resourceType: 'order',
            resourceId: order.id,
        });

        return c.json(responseBody, 201);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// POST /storefront/:subdomain/payments/razorpay/order — Public Razorpay order creation.
router.post(
    '/:subdomain/payments/razorpay/order',
    validate('json', StorefrontRazorpayOrderSchema),
    async (c) => {
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontRazorpayOrderBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        if (!c.env.RAZORPAY_KEY_ID || !c.env.RAZORPAY_KEY_SECRET) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
                503
            );
        }

        const db = getSupabaseAdmin(c);
        const paymentService = new PaymentService(db);
        const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
        const idempotency = new IdempotencyService(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: `storefront.payment.razorpay.order:${body.orderId}`,
            requestBody: body,
            requestId: getRequestId(c),
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        const amountMinorUnits = Math.round(Number(order.total) * 100);

        try {
            const providerOrder = await createRazorpayOrder(
                { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
                {
                    amount: amountMinorUnits,
                    currency: order.currency || 'INR',
                    receipt: body.orderId,
                    notes: {
                        order_id: body.orderId,
                        store_id: store.id,
                        source: 'storefront',
                        idempotency_key: body.idempotencyKey,
                    },
                }
            );

            if (!providerOrder.id) {
                await idempotency.fail(claim.id);
                return c.json(
                    {
                        success: false,
                        error: {
                            code: 'PAYMENT_PROVIDER_ERROR',
                            message: providerOrder.error?.description || 'Failed to create Razorpay order',
                        },
                    },
                    502
                );
            }

            await paymentService.attachPaymentReference({
                orderId: body.orderId,
                provider: 'razorpay',
                providerOrderId: providerOrder.id,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });

            const responseBody = success({
                keyId: c.env.RAZORPAY_KEY_ID,
                razorpayOrderId: providerOrder.id,
                amount: providerOrder.amount ?? amountMinorUnits,
                currency: providerOrder.currency || order.currency || 'INR',
            });

            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 200,
                resourceType: 'order',
                resourceId: body.orderId,
            });

            return c.json(responseBody);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    }
);

// POST /storefront/:subdomain/payments/razorpay/verify — Public Razorpay signature verification.
router.post(
    '/:subdomain/payments/razorpay/verify',
    validate('json', StorefrontRazorpayVerifySchema),
    async (c) => {
        const subdomain = c.req.param('subdomain');
        const body = c.get('validatedBody') as StorefrontRazorpayVerifyBody;
        const store = await loadPublishedStore(c, subdomain);

        if (!store) {
            return c.json(
                { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                404
            );
        }

        if (!c.env.RAZORPAY_KEY_SECRET) {
            return c.json(
                { success: false, error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay is not configured' } },
                503
            );
        }

        const db = getSupabaseAdmin(c);
        const paymentService = new PaymentService(db);
        const order = await paymentService.loadStorefrontPayableOrder(body.orderId, store.id);
        const idempotency = new IdempotencyService(db);
        const claim = await idempotency.begin({
            siteId: store.id,
            key: body.idempotencyKey,
            scope: `storefront.payment.razorpay.verify:${body.orderId}`,
            requestBody: body,
            requestId: getRequestId(c),
        });

        if (claim.kind === 'replay') {
            return c.json(claim.responseBody as any, claim.statusCode as any);
        }

        if (order.payment_id && order.payment_id !== body.razorpay_order_id) {
            await idempotency.fail(claim.id);
            return c.json(
                { success: false, error: { code: 'PAYMENT_REFERENCE_MISMATCH', message: 'Razorpay order does not match this checkout order' } },
                409
            );
        }

        const expected = await hmacSha256Hex(
            c.env.RAZORPAY_KEY_SECRET,
            `${body.razorpay_order_id}|${body.razorpay_payment_id}`
        );

        if (!timingSafeEqualHex(expected, body.razorpay_signature)) {
            await idempotency.fail(claim.id);
            return c.json(
                { success: false, error: { code: 'PAYMENT_SIGNATURE_INVALID', message: 'Invalid payment signature' } },
                400
            );
        }

        try {
            const confirmedOrder = await paymentService.confirmPayment({
                orderId: body.orderId,
                provider: 'razorpay',
                providerPaymentId: body.razorpay_payment_id,
                providerOrderId: body.razorpay_order_id,
                providerEventId: `razorpay:checkout:${body.razorpay_payment_id}`,
                requestId: getRequestId(c),
                idempotencyKey: body.idempotencyKey,
            });

            const responseBody = success({ verified: true, order: confirmedOrder });
            await idempotency.complete({
                id: claim.id,
                responseBody,
                statusCode: 200,
                resourceType: 'order',
                resourceId: body.orderId,
            });

            return c.json(responseBody);
        } catch (error) {
            await idempotency.fail(claim.id);
            throw error;
        }
    }
);

// GET /storefront/:subdomain/products — Public product listing
router.get('/:subdomain/products', async (c) => {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    const { data, count, error } = await queryPublicProducts(c, store.id, {
        page,
        limit,
        paginated: true,
        category: c.req.query('category') || undefined,
        search: c.req.query('search') || undefined,
    });
    if (error) return c.json(dbFailureBody(), 500);
    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /storefront/:subdomain/products/by-ids?ids=a,b — Public product subset scoped by store
router.get('/:subdomain/products/by-ids', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const ids = (c.req.query('ids') || '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
        .slice(0, 100);

    if (!ids.length) return c.json(success([]));

    const { data, error } = await queryPublicProducts(c, store.id, { limit: 100, ids });
    if (error) return c.json(dbFailureBody(), 500);
    return c.json(success(data || []));
});

// GET /storefront/:subdomain/products/:slug — Single product scoped by store.
// Accepts either a product slug or UUID to preserve existing storefront URLs.
router.get('/:subdomain/products/:slug', async (c) => {
    const db = getSupabaseAdmin(c);
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    const identifier = c.req.param('slug');
    if (!/^[a-z0-9-]{1,120}$/i.test(identifier)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid product identifier' } }, 400);
    }
    const { data } = await db
        .from('products')
        .select('*, product_variants(*)')
        .eq('store_id', store.id)
        .or(`slug.eq.${identifier},id.eq.${identifier}`)
        .eq('is_active', true)
        .single();
    if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
    await new ProductService(db).recordStorefrontView(data as StorefrontProductDetail);
    return c.json(success(data));
});

// GET /storefront/:subdomain/coupons/validate — Public checkout coupon validation
router.get('/:subdomain/coupons/validate', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    return validateCouponForStore(c, store.id);
});

async function validateCouponForStore(c: AppContext, storeId: string) {
    const code = (c.req.query('code') || '').trim().toUpperCase();
    const subtotal = Number(c.req.query('subtotal') || 0);

    if (!code || !Number.isFinite(subtotal) || subtotal < 0) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'code and subtotal are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const buildCouponQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('coupons')
            .select('*')
            .eq('store_id', storeId)
            .eq('code', code)
            .eq('is_active', true);

        return includeDeletedAtFilter ? query.is('deleted_at', null).maybeSingle() : query.maybeSingle();
    };

    let { data: coupon, error } = await buildCouponQuery(true);
    if (error && isSchemaMismatchError(error)) {
        ({ data: coupon, error } = await buildCouponQuery(false));
    }

    if (error) return c.json(dbFailureBody(), 500);
    if (!coupon) return c.json(success({ valid: false, error: 'Invalid coupon code' }));

    const couponRow = coupon as CouponValidationRow;
    const couponType = couponRow.type || couponRow.discount_type;
    const couponValue = Number(couponRow.value ?? couponRow.discount_value ?? 0);
    const minimumOrderAmount = Number(couponRow.minimum_order_amount ?? couponRow.min_order_amount ?? 0);
    const maximumDiscount = couponRow.maximum_discount ?? couponRow.max_discount;

    if (couponRow.expires_at && new Date(couponRow.expires_at) < new Date()) {
        return c.json(success({ valid: false, error: 'This coupon has expired' }));
    }

    if (couponRow.starts_at && new Date(couponRow.starts_at) > new Date()) {
        return c.json(success({ valid: false, error: 'This coupon is not yet active' }));
    }

    if (couponRow.usage_limit && Number(couponRow.usage_count || 0) >= Number(couponRow.usage_limit)) {
        return c.json(success({ valid: false, error: 'This coupon has reached its usage limit' }));
    }

    if (minimumOrderAmount > 0 && subtotal < minimumOrderAmount) {
        return c.json(success({
            valid: false,
            error: `Minimum purchase of ₹${minimumOrderAmount.toLocaleString('en-IN')} required`,
        }));
    }

    let discount = 0;
    if (couponType === 'percentage') {
        discount = Math.round(subtotal * (couponValue / 100));
        if (maximumDiscount) discount = Math.min(discount, Number(maximumDiscount));
    } else if (couponType === 'fixed' || couponType === 'fixed_amount') {
        discount = Math.min(couponValue, subtotal);
    }

    return c.json(success({
        valid: true,
        coupon: {
            code: couponRow.code,
            type: couponType,
            value: couponValue,
            discount,
            freeShipping: couponType === 'free_shipping',
        },
    }));
}

// GET /storefront/:subdomain/categories
router.get('/:subdomain/categories', async (c) => {
    const db = getSupabaseAdmin(c);
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    const { data } = await db.from('product_categories').select('id,name,slug,image_url,parent_id,product_count').eq('store_id', store.id).eq('is_visible', true).order('display_order');
    return c.json(success(data || []));
});

// GET /storefront/:subdomain/navigation?location=main
router.get('/:subdomain/navigation', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const location = normalizePublicRouteToken(c.req.query('location') || 'main');
    if (!location) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid menu location' } }, 400);
    }

    try {
        const navigation = await loadNavigationMenu(c, store.id, location);
        return c.json(success(navigation));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load navigation' },
        }, 500);
    }
});

// GET /storefront/:subdomain/pages
router.get('/:subdomain/pages', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    try {
        const pages = await listStorefrontPages(c, store.id);
        return c.json(success(pages));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load pages' },
        }, 500);
    }
});

// GET /storefront/:subdomain/policies
router.get('/:subdomain/policies', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    try {
        const policies = await listStorefrontPolicies(c, store.id);
        return c.json(success(policies));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load policies' },
        }, 500);
    }
});

// GET /storefront/:subdomain/policies/:policyType
router.get('/:subdomain/policies/:policyType', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const policyToken = normalizePublicRouteToken(c.req.param('policyType'));
    if (!policyToken) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid policy type' } }, 400);
    }

    try {
        const policy = await loadStorefrontPolicy(c, store.id, policyToken);
        if (!policy) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } }, 404);
        return c.json(success(policy));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load policy' },
        }, 500);
    }
});

// GET /storefront/:subdomain/pages/:slug
router.get('/:subdomain/pages/:slug', async (c) => {
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

    const slug = normalizePublicRouteToken(c.req.param('slug'));
    if (!slug) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid page slug' } }, 400);
    }

    try {
        const page = await loadStorefrontPageBySlug(c, store.id, slug);
        if (!page) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Page not found' } }, 404);
        return c.json(success(page));
    } catch {
        return c.json({
            success: false,
            error: { code: 'DB_ERROR', message: 'Failed to load page' },
        }, 500);
    }
});

// POST /storefront/customer/find-or-create — Sessionless checkout customer bootstrap
router.post('/customer/find-or-create', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;

    if (!body.store_id || !body.email) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and email are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const email = normalizeEmail(body.email);
    const { data: existing, error: existingError } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', body.store_id)
        .eq('email', email)
        .maybeSingle();

    if (existingError) {
        return c.json(dbFailureBody(), 500);
    }

    if (existing) {
        const updates: Record<string, unknown> = {};
        if (body.full_name && !existing.full_name) updates.full_name = body.full_name;
        if (body.phone && !existing.phone) updates.phone = body.phone;

        if (!Object.keys(updates).length) {
            return c.json(success({ customer: existing, created: false }));
        }

        const { data: updated, error } = await db
            .from('store_customers')
            .update(updates)
            .eq('id', existing.id)
            .eq('store_id', body.store_id)
            .select()
            .single();

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ customer: updated, created: false }));
    }

    const { data: created, error } = await db
        .from('store_customers')
        .insert({
            store_id: body.store_id,
            email,
            full_name: body.full_name || null,
            phone: body.phone || null,
            status: 'active',
            password_hash: null,
        })
        .select()
        .single();

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    await insertCustomerActivity(c, created.id, body.store_id, 'account_created', { source: 'checkout' });
    return c.json(success({ customer: created, created: true }), 201);
});

// POST /storefront/customer/password — Persist a server-generated password hash
router.post('/customer/password', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;

    if (!body.store_id || !body.email || (!body.password && !body.password_hash)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email and password are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const passwordHash = body.password
        ? await bcrypt.hash(body.password, 10)
        : body.password_hash;

    const { data, error } = await db
        .from('store_customers')
        .update({
            password_hash: passwordHash,
            status: 'active',
        })
        .eq('store_id', body.store_id)
        .eq('email', normalizeEmail(body.email))
        .select('id')
        .single();

    if (error || !data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
    }

    await insertCustomerActivity(c, data.id, body.store_id, 'password_set', {});
    return c.json(success({ customer_id: data.id }));
});

// GET /storefront/customer/by-email — Sessionless customer lookup scoped to a store
router.get('/customer/by-email', async (c) => {
    const storeId = c.req.query('store_id');
    const email = c.req.query('email');

    if (!storeId || !email) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and email are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('email', normalizeEmail(email))
        .single();

    if (error || !data) {
        return c.json(success({ customer: null }));
    }

    return c.json(success({ customer: data }));
});

// GET /storefront/customer/status — Check whether a customer exists and has a password
router.get('/customer/status', async (c) => {
    const storeId = c.req.query('store_id');
    const email = c.req.query('email');

    if (!storeId || !email) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and email are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data } = await db
        .from('store_customers')
        .select('password_hash, status')
        .eq('store_id', storeId)
        .eq('email', normalizeEmail(email))
        .single();

    if (!data) {
        return c.json(success({ exists: false, hasPassword: false, status: 'none' }));
    }

    return c.json(success({
        exists: true,
        hasPassword: Boolean(data.password_hash),
        status: data.status || 'active',
    }));
});

// POST /storefront/customer/login — Verify customer password in the worker boundary
router.post('/customer/login', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;

    if (!body.store_id || !body.email || !body.password) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email and password are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', body.store_id)
        .eq('email', normalizeEmail(body.email))
        .single();

    if (error || !data || !data.password_hash) {
        return c.json(success({ customer: null }));
    }

    if (data.status === 'disabled') {
        return c.json({ success: false, error: { code: 'CUSTOMER_DISABLED', message: 'Account is disabled. Contact the store for assistance.' } }, 403);
    }

    const isValid = await bcrypt.compare(body.password, data.password_hash);
    if (!isValid) return c.json(success({ customer: null }));

    await db
        .from('store_customers')
        .update({
            last_login_at: new Date().toISOString(),
            login_count: Number(data.login_count || 0) + 1,
        })
        .eq('id', data.id)
        .eq('store_id', body.store_id);

    await insertCustomerActivity(c, data.id, body.store_id, 'login', { method: 'password' });
    return c.json(success({ customer: data }));
});

// POST /storefront/customer/login-success — Record verified customer login metadata
router.post('/customer/login-success', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;

    if (!body.customer_id || !body.store_id) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id and store_id are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: customer, error: customerError } = await db
        .from('store_customers')
        .select('id, login_count')
        .eq('id', body.customer_id)
        .eq('store_id', body.store_id)
        .single();

    if (customerError || !customer) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const { error } = await db
        .from('store_customers')
        .update({
            last_login_at: new Date().toISOString(),
            login_count: Number(customer.login_count || 0) + 1,
        })
        .eq('id', body.customer_id)
        .eq('store_id', body.store_id);

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    await insertCustomerActivity(c, body.customer_id, body.store_id, 'login', { method: 'password' });
    return c.json(success({ recorded: true }));
});

// POST /storefront/customer/order-credential — Persist legacy order-tracking credential
router.post('/customer/order-credential', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;
    const storeId = await resolveCredentialStoreId(c, body);

    if (!storeId || !body.email_or_phone || (!body.password && !body.password_hash)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store, email_or_phone and password are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const passwordHash = body.password
        ? await bcrypt.hash(body.password, 10)
        : body.password_hash;

    const { error } = await db
        .from('customer_credentials')
        .upsert(
            {
                store_id: storeId,
                email_or_phone: normalizeContact(body.email_or_phone),
                password_hash: passwordHash,
            },
            { onConflict: 'store_id,email_or_phone' }
        );

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ saved: true, store_id: storeId }));
});

// POST /storefront/customer/order-credential/login — Verify legacy order-tracking credential
router.post('/customer/order-credential/login', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;
    const storeId = await resolveCredentialStoreId(c, body);

    if (!storeId || !body.email_or_phone || !body.password) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store, email_or_phone and password are required' } }, 400);
    }

    const emailOrPhone = normalizeContact(body.email_or_phone);
    const db = getSupabaseAdmin(c);
    const { data: credential } = await db
        .from('customer_credentials')
        .select('id, password_hash, login_count')
        .eq('store_id', storeId)
        .eq('email_or_phone', emailOrPhone)
        .single();

    if (!credential?.password_hash) return c.json(success({ valid: false }));

    const isValid = await bcrypt.compare(body.password, credential.password_hash);
    if (!isValid) return c.json(success({ valid: false }));

    await db
        .from('customer_credentials')
        .update({
            last_login_at: new Date().toISOString(),
            login_count: Number(credential.login_count || 0) + 1,
        })
        .eq('id', credential.id)
        .eq('store_id', storeId);

    return c.json(success({ valid: true, store_id: storeId }));
});

// POST /storefront/customer/order-credential/login-success — Record legacy order login metadata
router.post('/customer/order-credential/login-success', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;
    const storeId = await resolveCredentialStoreId(c, body);

    if (!storeId || !body.email_or_phone) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store and email_or_phone are required' } }, 400);
    }

    const emailOrPhone = body.email_or_phone.toLowerCase().trim();
    const db = getSupabaseAdmin(c);
    const { data: credential, error: credentialError } = await db
        .from('customer_credentials')
        .select('id, login_count')
        .eq('store_id', storeId)
        .eq('email_or_phone', emailOrPhone)
        .single();

    if (credentialError || !credential) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer credential not found' } }, 404);
    }

    const { error } = await db
        .from('customer_credentials')
        .update({
            last_login_at: new Date().toISOString(),
            login_count: Number(credential.login_count || 0) + 1,
        })
        .eq('id', credential.id)
        .eq('store_id', storeId);

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ recorded: true, store_id: storeId }));
});

// POST /storefront/customer/order-stats — Reconcile customer order counters after checkout
router.post('/customer/order-stats', async (c) => {
    const body = await c.req.json() as CustomerLifecycleBody;

    if (!body.store_id || !body.email || body.order_total === undefined || !body.order_id) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id, email, order_total and order_id are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: customer, error: customerError } = await db
        .from('store_customers')
        .select('id, total_orders, total_spent')
        .eq('store_id', body.store_id)
        .eq('email', normalizeEmail(body.email))
        .maybeSingle();

    if (customerError) {
        return c.json(dbFailureBody(), 500);
    }

    if (!customer) {
        return c.json(success({ updated: false }));
    }

    const orderTotal = Number(body.order_total || 0);
    const { error } = await db
        .from('store_customers')
        .update({
            total_orders: Number(customer.total_orders || 0) + 1,
            total_spent: Number(customer.total_spent || 0) + orderTotal,
            last_order_at: new Date().toISOString(),
        })
        .eq('id', customer.id)
        .eq('store_id', body.store_id);

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    await insertCustomerActivity(c, customer.id, body.store_id, 'order_placed', {
        orderId: body.order_id,
        orderTotal,
    });

    return c.json(success({ updated: true }));
});

// GET /storefront/customer/wishlist — Session-proxied customer wishlist read
router.get('/customer/wishlist', async (c) => {
    const customerId = c.req.query('customer_id');
    const storeId = c.req.query('store_id');

    if (!customerId || !storeId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id and store_id are required' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, storeId, customerId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('customer_wishlists')
        .select('product_id')
        .eq('customer_id', customerId)
        .eq('store_id', storeId);

    if (error) return c.json(dbFailureBody(), 500);
    return c.json(success({ product_ids: (data || []).map((row) => row.product_id) }));
});

// GET /storefront/customer/orders — Session-proxied customer order history
router.get('/customer/orders', async (c) => {
    const storeId = c.req.query('store_id');
    const email = c.req.query('email');

    if (!storeId || !email) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id and email are required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('orders')
        .select('id, order_number, status, total, created_at, items')
        .eq('store_id', storeId)
        .eq('customer_email', normalizeEmail(email))
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) return c.json(dbFailureBody(), 500);
    return c.json(success({ orders: data || [] }));
});

// GET /storefront/:subdomain/orders/contact — Public order tracking lookup by contact
router.get('/:subdomain/orders/contact', async (c) => {
    const contact = c.req.query('contact');
    const store = await loadPublishedStore(c, c.req.param('subdomain'));

    if (!contact || !store) {
        return c.json(success({ orders: [], hasOrders: false, hasPassword: false }));
    }

    const normalizedContact = normalizeContact(contact);
    const db = getSupabaseAdmin(c);
    let query = db
        .from('orders')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

    query = normalizedContact.includes('@')
        ? query.eq('customer_email', normalizedContact)
        : query.eq('customer_phone', normalizedContact);

    const [{ data: orders, error }, { data: credential }] = await Promise.all([
        query,
        db
            .from('customer_credentials')
            .select('id')
            .eq('store_id', store.id)
            .eq('email_or_phone', normalizedContact)
            .maybeSingle(),
    ]);

    if (error) return c.json(dbFailureBody(), 500);

    return c.json(success({
        orders: orders || [],
        hasOrders: Boolean(orders?.length),
        hasPassword: Boolean(credential),
        store_id: store.id,
    }));
});

// POST /storefront/customer/wishlist — Session-proxied customer wishlist add
router.post('/customer/wishlist', async (c) => {
    const body = await c.req.json() as CustomerWishlistBody;

    if (!body.customer_id || !body.store_id || !body.product_id) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and product_id are required' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const { error } = await db.from('customer_wishlists').upsert(
        {
            customer_id: body.customer_id,
            store_id: body.store_id,
            product_id: body.product_id,
            variant_id: body.variant_id || null,
        },
        { onConflict: 'customer_id,product_id' }
    );

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ saved: true }));
});

// DELETE /storefront/customer/wishlist — Session-proxied customer wishlist remove
router.delete('/customer/wishlist', async (c) => {
    const body = await c.req.json() as CustomerWishlistBody;

    if (!body.customer_id || !body.store_id || !body.product_id) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and product_id are required' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const { error } = await db
        .from('customer_wishlists')
        .delete()
        .eq('customer_id', body.customer_id)
        .eq('store_id', body.store_id)
        .eq('product_id', body.product_id);

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ removed: true }));
});

// POST /storefront/customer/wishlist/sync — Session-proxied local wishlist sync
router.post('/customer/wishlist/sync', async (c) => {
    const body = await c.req.json() as CustomerWishlistSyncBody;

    if (!body.customer_id || !body.store_id || !Array.isArray(body.product_ids)) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and product_ids are required' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const productIds = Array.from(new Set(body.product_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)));
    if (!productIds.length) return c.json(success({ synced: 0 }));

    const db = getSupabaseAdmin(c);
    const { error } = await db.from('customer_wishlists').upsert(
        productIds.map((productId) => ({
            customer_id: body.customer_id,
            store_id: body.store_id,
            product_id: productId,
        })),
        { onConflict: 'customer_id,product_id' }
    );

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ synced: productIds.length }));
});

// POST /storefront/customer/activity — Session-proxied customer activity audit
router.post('/customer/activity', async (c) => {
    const body = await c.req.json() as CustomerActivityBody;

    if (!body.customer_id || !body.store_id || !body.activity_type) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and activity_type are required' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const { error } = await db.from('customer_activity_log').insert({
        customer_id: body.customer_id,
        store_id: body.store_id,
        activity_type: body.activity_type,
        metadata: body.metadata || {},
    });

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ logged: true }));
});

// PATCH /storefront/customer/profile — Session-proxied customer profile update
router.patch('/customer/profile', async (c) => {
    const body = await c.req.json() as CustomerProfileBody;

    if (!body.customer_id || !body.store_id) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id and store_id are required' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const updates: Record<string, unknown> = {};
    if (body.full_name !== undefined) updates.full_name = body.full_name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.accepts_marketing !== undefined) updates.accepts_marketing = body.accepts_marketing;

    if (!Object.keys(updates).length) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'No profile fields were provided' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('store_customers')
        .update(updates)
        .eq('id', body.customer_id)
        .eq('store_id', body.store_id)
        .select('id, email, full_name, phone, accepts_marketing, updated_at')
        .single();

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ customer: data }));
});

// POST /storefront/reviews — Public review submission; defaults to pending moderation
router.post('/reviews', validate('json', CreateStorefrontProductReviewSchema), async (c) => {
    const body = c.get('validatedBody') as StorefrontReviewBody;
    const db = getSupabaseAdmin(c);

    const { data: product, error: productError } = await db
        .from('products')
        .select('id, store_id, is_active, status')
        .eq('id', body.product_id)
        .eq('store_id', body.store_id)
        .maybeSingle();

    if (productError) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to validate product' } }, 500);
    }

    if (!product) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found for this store' } }, 404);
    }

    const productRecord = product as { is_active?: boolean | null; status?: string | null };
    if (productRecord.is_active === false || productRecord.status === 'archived') {
        return c.json({ success: false, error: { code: 'PRODUCT_UNAVAILABLE', message: 'This product is not accepting reviews' } }, 400);
    }

    if (body.customer_email) {
        const buildDuplicateQuery = (includeDeletedAtFilter: boolean) => {
            let request = db
                .from('product_reviews')
                .select('id')
                .eq('product_id', body.product_id)
                .eq('store_id', body.store_id)
                .eq('customer_email', body.customer_email!)
                .limit(1);

            if (includeDeletedAtFilter) request = request.is('deleted_at', null);
            return request.maybeSingle();
        };

        let { data: existing, error: duplicateError } = await buildDuplicateQuery(true);
        if (isMissingColumnError(duplicateError, 'deleted_at')) {
            ({ data: existing, error: duplicateError } = await buildDuplicateQuery(false));
        }

        if (isMissingTableError(duplicateError, 'product_reviews')) {
            return c.json({ success: false, error: { code: 'REVIEWS_UNAVAILABLE', message: 'Product reviews are not available yet' } }, 503);
        }

        if (duplicateError) {
            return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to validate review' } }, 500);
        }

        if (existing) {
            return c.json({ success: false, error: { code: 'CONFLICT', message: 'You have already reviewed this product' } }, 409);
        }
    }

    const reviewPayload = {
        store_id: body.store_id,
        product_id: body.product_id,
        customer_name: body.customer_name || 'Anonymous',
        customer_email: body.customer_email || null,
        rating: body.rating,
        title: body.title || null,
        body: body.body || null,
        is_verified: Boolean(body.is_verified),
        is_approved: false,
    };

    let { data, error } = await db
        .from('product_reviews')
        .insert({
            ...reviewPayload,
            status: 'pending',
        })
        .select()
        .single();

    if (isMissingColumnError(error, 'status')) {
        ({ data, error } = await db
            .from('product_reviews')
            .insert(reviewPayload)
            .select()
            .single());
    }

    if (isMissingTableError(error, 'product_reviews')) {
        return c.json({ success: false, error: { code: 'REVIEWS_UNAVAILABLE', message: 'Product reviews are not available yet' } }, 503);
    }

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Unable to submit review' } }, 500);
    }

    return c.json(success({
        review: data,
        message: 'Review submitted! It will appear after approval.',
    }), 201);
});

// GET /storefront/customer/addresses — Session-proxied customer addresses
router.get('/customer/addresses', async (c) => {
    const customerId = c.req.query('customer_id');
    const storeId = c.req.query('store_id');
    const customerEmail = c.req.query('customer_email');

    if (!customerId || !storeId || !customerEmail) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and customer_email are required' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, storeId, customerId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('customer_addresses')
        .select('*')
        .eq('store_id', storeId)
        .eq('customer_email', customerEmail.toLowerCase())
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ addresses: data || [] }));
});

// POST /storefront/customer/addresses — Session-proxied address create
router.post('/customer/addresses', async (c) => {
    const body = await c.req.json() as CustomerAddressBody;

    if (!body.customer_id || !body.store_id || !body.customer_email || !body.full_name || !body.address_line1 || !body.city || !body.state || !body.postal_code) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Required address fields missing' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const customerEmail = body.customer_email.toLowerCase();
    if (body.is_default) {
        await db
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('store_id', body.store_id)
            .eq('customer_email', customerEmail);
    }

    const { data, error } = await db
        .from('customer_addresses')
        .insert({
            store_id: body.store_id,
            customer_email: customerEmail,
            customer_phone: body.customer_phone || null,
            label: body.label || 'home',
            full_name: body.full_name,
            address_line1: body.address_line1,
            address_line2: body.address_line2 || null,
            city: body.city,
            state: body.state,
            postal_code: body.postal_code,
            country: body.country || 'IN',
            landmark: body.landmark || null,
            is_default: Boolean(body.is_default),
        })
        .select()
        .single();

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ address: data }), 201);
});

// PATCH /storefront/customer/addresses/:id — Session-proxied address update
router.patch('/customer/addresses/:id', async (c) => {
    const addressId = c.req.param('id');
    const body = await c.req.json() as CustomerAddressBody;

    if (!body.customer_id || !body.store_id || !body.customer_email) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and customer_email are required' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const customerEmail = body.customer_email.toLowerCase();
    if (body.is_default) {
        await db
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('store_id', body.store_id)
            .eq('customer_email', customerEmail);
    }

    const allowed = ['label', 'full_name', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country', 'landmark', 'is_default'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        const value = body[key as keyof CustomerAddressBody];
        if (value !== undefined) updates[key] = value;
    }

    const { data, error } = await db
        .from('customer_addresses')
        .update(updates)
        .eq('id', addressId)
        .eq('store_id', body.store_id)
        .eq('customer_email', customerEmail)
        .select()
        .single();

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ address: data }));
});

// DELETE /storefront/customer/addresses/:id — Session-proxied address delete
router.delete('/customer/addresses/:id', async (c) => {
    const addressId = c.req.param('id');
    const body = await c.req.json() as CustomerAddressBody;

    if (!body.customer_id || !body.store_id || !body.customer_email) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and customer_email are required' } }, 400);
    }

    if (!(await verifyStoreCustomer(c, body.store_id, body.customer_id))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const { error } = await db
        .from('customer_addresses')
        .delete()
        .eq('id', addressId)
        .eq('store_id', body.store_id)
        .eq('customer_email', body.customer_email.toLowerCase());

    if (error) {
        return c.json(dbFailureBody(), 500);
    }

    return c.json(success({ deleted: true }));
});

// GET /storefront/:subdomain/blog
router.get('/:subdomain/blog', async (c) => {
    const db = getSupabaseAdmin(c);
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    const { data, count } = await db.from('blog_posts').select('id,title,slug,excerpt,featured_image,created_at,is_pinned', { count: 'exact' })
        .eq('store_id', store.id).eq('status', 'published').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    return c.json(paginated(data || [], count || 0, page, limit));
});

// POST /storefront/:subdomain/contact — Public contact form
router.post('/:subdomain/contact', async (c) => {
    const db = getSupabaseAdmin(c);
    const body = await c.req.json();
    const store = await loadPublishedStore(c, c.req.param('subdomain'));
    if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    await db.from('form_submissions').insert({ store_id: store.id, type: 'contact', name: body.name || '', email: body.email || '', message: body.message || '' });
    return c.json(success({ submitted: true }), 201);
});

export default router;
