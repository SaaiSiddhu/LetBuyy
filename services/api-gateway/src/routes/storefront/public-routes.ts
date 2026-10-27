import { StorefrontDirectoryQuerySchema, StorefrontDirectoryCursorSchema, StorefrontDirectoryPayloadSchema, type StorefrontDirectoryQuery } from '@letbuyy/shared-types';
import { AppError } from '../../lib/errors';
import type { StorefrontDiscoveryQuery, StorefrontDiscoveryMetadata } from '@letbuyy/commerce-core';
import { parseStorefrontDiscoveryRequest } from '../../lib/storefront-discovery';
import {authorizeVisitor,authorizeVisitorSite,type VisitorSite} from '../../lib/storefront-visitor-access';
import { resolveLiquidBundleArtifact } from '../../lib/theme-release-bundle';
import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { sha256Hex } from '../../lib/crypto';
import { dbFailureBody, getSupabaseAdmin, paginated, success, decodeListCursor } from '../../lib/supabase';
import { cachedJson, storefrontRequestCacheKey, STOREFRONT_CACHE_SWR_SECONDS, STOREFRONT_CACHE_TTL_SECONDS } from '../../lib/storefront-cache';
import { registerStorefrontBlogRoutes } from './storefront-blog-routes';
import { readThemePreviewContent, readThemePreviewCollection } from './theme-preview-content';
import { PUBLIC_PRODUCT_SELECT, PUBLIC_PRODUCT_SELECT_RELATIONAL, toPublicProduct } from '../../lib/public-product-view';
import { validate } from '../../middleware/validation';
import { StorefrontProductReviewsQuery } from '../../schemas/review.schema';
import { authRateLimit, sensitiveRateLimit } from '../../middleware/rateLimit';
import { registerStorefrontCartRoutes } from './cart-routes';
import { registerStorefrontMarketplaceDetailRoutes, type StorefrontMarketplaceDetailDependencies } from './marketplace-detail-routes';
import { registerMarketplaceBannerRoutes, type MarketplaceBannerRoutesDeps } from './marketplace-banner-routes';
import { registerStorefrontMarketplaceFeedRoutes, type StorefrontMarketplaceFeedDependencies } from './marketplace-feed-routes';
import { registerStorefrontCheckoutPaymentRoutes } from './checkout-payment-routes';
import { registerStorefrontCustomerEngagementRoutes } from './customer-engagement-routes';
import { planCouponValidation, storefrontCouponValidationError, type CouponRecord } from '@letbuyy/checkout-core';
import { mapPublicStorePayload, mapPublicStoreRenderPayload, normalizeStorefrontHandle, type PublishedStoreRecord, type StorefrontSiteRecord, type StorefrontThemeReleaseRecord } from '@letbuyy/tenant-core';
import { StorefrontAnalyticsBeaconSchema, type StorefrontAnalyticsBeacon } from '@letbuyy/shared-types';
import type { AppBlockInstance } from '@letbuyy/shared-types';

// Compatibility exports keep existing callers/tests on their published import path.
export {
    MARKETPLACE_FEED_RPC,
    loadMarketplaceFeedFromDatabase,
    loadMarketplacePriceObservationsFromDatabase,
    listMarketplaceCategoriesFromDatabase,
    listMarketplaceOriginsFromDatabase,
    marketplaceFeedParams,
    type MarketplaceFeedParams,
    type MarketplaceFeedRow,
    type MarketplacePriceObservation,
    type MarketplaceCategoryRow,
    type MarketplaceOriginRow,
} from './marketplace-feed-routes';

type AppContext = Context<{ Bindings: Env }>;
type SqlRecord = Record<string, unknown>;
type PublicProductRow = SqlRecord;
type StorefrontProductDetail = { id: string; slug?: string | null };
type DatabaseErrorLike = { code?: string; message?: string; details?: string; hint?: string } | null | undefined;
type StorefrontAnalyticsBeaconEventType = StorefrontAnalyticsBeacon['event_type'];
const STOREFRONT_SITE_SELECT: string =
    'id,store_name,name,description,site_type,status,subdomain,custom_domain,domain,is_published,is_active,is_password_protected,coming_soon_enabled,tagline,logo_url,cover_image,primary_color,secondary_color,published_at,created_at,updated_at,seo_title,seo_description,seo_keywords,og_image_url,twitter_handle,settings,theme_settings,currency,timezone,language,theme_id,theme_config';
const STOREFRONT_SITE_RELEASE_SELECT: string =
    `${STOREFRONT_SITE_SELECT},current_theme_release_id,storefront_release_version`;
const STOREFRONT_SITE_COMPAT_SELECT: string =
    'id,store_name,name,description,site_type,status,subdomain,custom_domain,domain,is_published,is_active,is_password_protected,coming_soon_enabled,tagline,logo_url,cover_image,primary_color,secondary_color,published_at,created_at,updated_at,seo_title,seo_description,seo_keywords,og_image_url,twitter_handle,settings,theme_settings,currency,timezone,language,theme_id,theme_config';
const STOREFRONT_SITE_RELEASE_COMPAT_SELECT: string =
    `${STOREFRONT_SITE_COMPAT_SELECT},current_theme_release_id,storefront_release_version`;
// SEC-1: the public product column allowlist and its response projection live in
// lib/public-product-view.ts, next to the reasoning for what a shopper may and may not learn.
const PRODUCT_SELECT_FULL: string = PUBLIC_PRODUCT_SELECT;
const PRODUCT_SELECT_FULL_RELATIONAL: string = PUBLIC_PRODUCT_SELECT_RELATIONAL;
const STOREFRONT_BEACON_EVENT_TYPES: Record<StorefrontAnalyticsBeaconEventType, string> = {
    session_started: 'storefront.session_started',
    page_view: 'storefront.page_view',
    product_view: 'storefront.product_view',
    cart_add: 'storefront.cart_add',
    checkout_started: 'storefront.checkout_started',
};

type CollectionBrowse = { browse: boolean; after?: string; before?: string };
function collectionBrowseQuery(c: AppContext): CollectionBrowse | null {
    const browse = c.req.query('browse'), after = c.req.query('after'), before = c.req.query('before');
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if ((browse !== undefined && browse !== '1') || (after !== undefined && !uuid.test(after))
        || (before !== undefined && !uuid.test(before)) || (after !== undefined && before !== undefined)
        || (browse !== '1' && (after !== undefined || before !== undefined))) return null;
    return { browse: browse === '1', after, before };
}
function loadCollectionSummaries(c: AppContext, storeId: string, options: CollectionBrowse) {
    let query = getSupabaseAdmin(c).from('collections')
        .select('id, title, description, image_url')
        .eq('store_id', storeId).eq('is_active', true).is('deleted_at', null);
    if (!options.browse) return query.order('title', { ascending: true }).order('id', { ascending: true }).limit(24);
    if (options.after) query = query.gt('id', options.after);
    if (options.before) query = query.lt('id', options.before);
    return query.order('id', { ascending: !options.before }).limit(25);
}
function collectionSummaryResult(rows: SqlRecord[] | null, options: CollectionBrowse) {
    if (!options.browse) return rows || [];
    const hasMore = (rows?.length || 0) > 24;
    const items = (rows || []).slice(0, 24);
    if (options.before) items.reverse();
    const first = items[0]?.id ?? null, last = items.at(-1)?.id ?? null;
    return {
        items,
        nextCursor: options.before || hasMore ? last : null,
        previousCursor: options.after || (options.before && hasMore) ? first : null,
    };
}

function storefrontCacheTags(storeId: string, handle: string, ...tags: string[]): string[] {
    return [`storefront:${storeId}`, `storefront:${handle}`, ...tags];
}

function textOrNull(value: unknown, max = 240): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, max) : null;
}

function sourceFromReferrer(referrer: string | null): string {
    if (!referrer) return 'direct';
    try {
        const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
        if (!host) return 'direct';
        if (host.includes('google.')) return 'google';
        if (host.includes('instagram.')) return 'instagram';
        if (host.includes('facebook.') || host.includes('fb.')) return 'facebook';
        if (host.includes('whatsapp.')) return 'whatsapp';
        if (host.includes('youtube.')) return 'youtube';
        return host.slice(0, 120);
    } catch {
        return 'direct';
    }
}

function normalizeTrafficSource(explicitSource: unknown, referrer: string | null): string {
    const source = textOrNull(explicitSource, 120);
    return source ? source.toLowerCase().replace(/\s+/g, '_') : sourceFromReferrer(referrer);
}

function deviceFromUserAgent(userAgent: string | null): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
    const value = (userAgent || '').toLowerCase();
    if (!value) return 'unknown';
    if (/(ipad|tablet|kindle|silk)/.test(value)) return 'tablet';
    if (/(mobi|iphone|android|phone)/.test(value)) return 'mobile';
    return 'desktop';
}

function analyticsSampleRate(value: string | undefined): number {
    const parsed = Number(value ?? '1');
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(1, Math.max(0, parsed));
}

function shouldSampleAnalytics(rate: number): boolean {
    if (rate <= 0) return false;
    if (rate >= 1) return true;
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    return (random[0] || 0) / 0xffffffff < rate;
}

function analyticsBeaconIdempotencyKey(storeId: string, beacon: StorefrontAnalyticsBeacon): string {
    const fallback = sha256Hex([
        storeId,
        beacon.event_type,
        beacon.session_id,
        beacon.path || '/',
        beacon.occurred_at || '',
    ].join(':'));
    return `storefront.analytics:${storeId}:${beacon.event_id || fallback}`;
}

type PublicProductQueryOptions = {
    limit: number;
    page?: number;
    paginated?: boolean;
    category?: string;
    search?: string;
    countryOfOrigin?: string;
    ids?: string[];
    discovery?: StorefrontDiscoveryQuery;
};

type PublicProductQueryResult = {
    data: PublicProductRow[];
    count: number;
    error: unknown;
    discovery?: StorefrontDiscoveryMetadata;
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

export type StorefrontThemeReleaseReadOptions = { releaseId?: string | null; releaseVersion?: number | null; projection?: 'render-v1' };

type StorefrontPublicRouteDependencies = StorefrontMarketplaceFeedDependencies & {
    loadPublicDirectory?: (c: AppContext, input: {p_limit:number;p_after_at:string|null;p_after_id:string|null}) => Promise<{data:unknown;error:unknown}>;
    loadSiteByHandle: (c: AppContext, handle: string, options: { publishedOnly: boolean }) => Promise<StorefrontSiteRecord | null>;
    loadPublishedStore: (c: AppContext, subdomain: string) => Promise<PublishedStoreRecord | null>;
    loadPublishedStoreById: (c: AppContext, storeId: string) => Promise<PublishedStoreRecord | null>;
    loadCurrentThemeRelease: (c: AppContext, storeId: string, options?: StorefrontThemeReleaseReadOptions) => Promise<StorefrontThemeReleaseRecord | null>;
    loadPublicStorefrontAppBlocks: (c: AppContext, storeId: string) => Promise<AppBlockInstance[]>;
    listPublicProductReviews: (c: AppContext) => Promise<Response>;
    queryPublicProducts: (c: AppContext, storeId: string, options: PublicProductQueryOptions) => Promise<PublicProductQueryResult>;
    hydratePublicProductVariants: (c: AppContext, products: PublicProductRow[]) => Promise<PublicProductRow[]>;
    emitProductViewedEvent: (c: AppContext, input: { storeId: string; product: StorefrontProductDetail }) => void;
    productVariantRelationalReadsEnabled: (env: Pick<Env, 'PRODUCT_VARIANTS_RELATIONAL_READS'>) => boolean;
    normalizePublicRouteToken: (value: string) => string | null;
    loadNavigationMenu: (c: AppContext, storeId: string, location: string) => Promise<unknown>;
    listStorefrontPages: (c: AppContext, storeId: string, options?: { navOnly?: boolean }) => Promise<unknown>;
    listStorefrontPolicies: (c: AppContext, storeId: string) => Promise<unknown>;
    loadStorefrontPolicy: (c: AppContext, storeId: string, token: string) => Promise<unknown>;
    loadStorefrontPageBySlug: (c: AppContext, storeId: string, slug: string) => Promise<unknown>;
    hydrateStorefrontOrderItems: (c: AppContext, orders: SqlRecord[]) => Promise<SqlRecord[]>;
    orderItemsRelationalReadsEnabled: (env: Pick<Env, 'ORDER_ITEMS_RELATIONAL_READS'>) => boolean;
    isMissingColumnError: (error: DatabaseErrorLike, columnName: string) => boolean;
    isMissingTableError: (error: DatabaseErrorLike, tableName: string) => boolean;
    isSchemaMismatchError: (error: DatabaseErrorLike) => boolean;
    requireValidTurnstile: (c: AppContext, body: unknown) => Promise<Response | null>;
    getRequestId: (c: AppContext) => string;
    emitStorefrontOrderPaidEvent: Parameters<typeof registerStorefrontCheckoutPaymentRoutes>[1]['emitStorefrontOrderPaidEvent'];
    // MKT-2: injectable so unit tests can drive the detail route without a database.
    loadMarketplaceListingDetail?: StorefrontMarketplaceDetailDependencies['loadMarketplaceListingDetail'];
    // CAP-FB-BANNERS: injectable so unit tests can drive the strip without a database.
    loadActiveMarketplaceBanners?: MarketplaceBannerRoutesDeps['loadActiveBanners'];
};

export function registerStorefrontPublicRoutes(
    router: Hono<{ Bindings: Env }>,
    dependencies: StorefrontPublicRouteDependencies,
): void {
    const {
        loadSiteByHandle: rawSiteByHandle,
        loadPublishedStore: rawPublishedStore,
        loadPublishedStoreById: rawPublishedStoreById,
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
    } = dependencies;
    const loadPublishedStore: typeof rawPublishedStore = (c,handle) => {
        const allowed=c.get('storefrontVisitorGrant');
        return allowed?.site.subdomain===handle ? Promise.resolve(allowed.site) : rawPublishedStore(c,handle);
    };
    const loadPublishedStoreById: typeof rawPublishedStoreById = (c,id) => {
        const allowed=c.get('storefrontVisitorGrant');
        return allowed?.site.id===id ? Promise.resolve(allowed.site) : rawPublishedStoreById(c,id);
    };
    const loadSiteByHandle: typeof rawSiteByHandle = (c,handle,options) => {
        const allowed=c.get('storefrontVisitorGrant');
        return rawSiteByHandle(c,handle,{publishedOnly:options.publishedOnly&&!(allowed?.preview&&allowed.site.subdomain===handle)});
    };
    const catalogueGuard = async (c:AppContext,next:()=>Promise<void>) => {
        if(!['GET','HEAD'].includes(c.req.method)){await next();return;}
        // This exact global taxonomy route has independent marketplace authority;
        // a merchant handle named marketplace does not exempt any other path.
        if(c.req.param('subdomain')==='marketplace'&&/(?:^|\/)marketplace\/categories\/?$/.test(c.req.path)){await next();return;}
        await authorizeVisitor(c,{handle:c.req.param('subdomain')});
        await next();c.header('Cache-Control','no-store');
    };
    // Guard before Cache API lookup. Private buyer history and marketplace channel
    // endpoints keep their own authority; these are store catalogue populations.
    for(const resource of ['products','collections','categories','navigation','pages','policies','blog','search']){
        router.use(`/:subdomain/${resource}`,catalogueGuard);
        router.use(`/:subdomain/${resource}/*`,catalogueGuard);
    }
    const idGuard = async(c:AppContext,next:()=>Promise<void>)=>{
        if(!['GET','HEAD'].includes(c.req.method)){await next();return;}
        await authorizeVisitor(c,{id:c.req.param('storeId')});await next();c.header('Cache-Control','no-store');
    };
    router.use('/store/:storeId',idGuard);router.use('/store/:storeId/*',idGuard);
    router.use('/reviews',async(c,next)=>{
        if(!['GET','HEAD'].includes(c.req.method)){await next();return;}
        const ids=c.req.queries('store_id');
        if(!ids||ids.length!==1)return c.json({error:{code:'VALIDATION',message:'One store_id is required'}},400);
        await authorizeVisitor(c,{id:ids[0]});await next();c.header('Cache-Control','no-store');
    });
    registerStorefrontMarketplaceFeedRoutes(router, dependencies);

    // MKT-2 — the single-listing read, beside the feed and taxonomy above.
    registerStorefrontMarketplaceDetailRoutes(router, {
        loadMarketplaceListingDetail: dependencies.loadMarketplaceListingDetail,
    });

    // CAP-FB-BANNERS — the home merchandising strip, beside the feed, taxonomy and detail reads.
    registerMarketplaceBannerRoutes(router, {
        loadActiveBanners: dependencies.loadActiveMarketplaceBanners,
    });

    registerStorefrontCartRoutes(router, {
        loadPublishedStore,
        queryPublicProducts,
        normalizePublicRouteToken,
    });

    router.get('/lookup', async (c) => {
        c.header('Cache-Control', 'no-store');
        const query = normalizeStorefrontHandle(c.req.query('q') || '');
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
        // Store finder, not tenant resolution: it returns no site id, and the storefront read that
        // follows resolves its own tenant from sites.subdomain. Matching either handle column stays
        // intentional, but subdomain and store_name are unique only within their own column, so one
        // combined predicate can match two tenants and — with limit(1) and no ordering — return an
        // arbitrary one, letting a store_name capture another tenant's subdomain. Probe the canonical
        // column first, then store_name; each equality is single-valued, so more than one row (or a
        // query error) resolves to "store not found".
        const lookupExactSite = async (column: 'subdomain' | 'store_name') => {
            const { data, error } = await db
                .from('sites')
                .select(selectFields)
                .eq(column, query)
                .eq('site_type', 'store')
                .eq('status', 'published')
                .eq('published', true)
                .or('access_mode.eq.public,access_mode.is.null')
                .is('deleted_at', null)
                .maybeSingle();
            if (error) throw new AppError('Store lookup is temporarily unavailable.', 503, 'LOOKUP_UNAVAILABLE');
            return data;
        };

        const exactSite = (await lookupExactSite('subdomain')) || (await lookupExactSite('store_name'));
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

        // A finder accepts exact handles. Never turn a miss into an unscoped
        // tenant-name scan or describe a private/unpublished draft as online.
        return c.json(success({ status: 'not_found' }));
    });

    // Owner decision CAP-C60, 27 October: public launched stores may appear in discovery.
    // A fixed service-only SQL projection owns eligibility, fields, counts and cursor ordering.
    // Ordinary tenant-table guards and every private/draft access gate remain unchanged.
    router.get('/directory', validate('query', StorefrontDirectoryQuerySchema), async (c) => {
        const query = c.get('validatedQuery') as StorefrontDirectoryQuery;
        const cursor = query.cursor
            ? StorefrontDirectoryCursorSchema.safeParse(decodeListCursor(query.cursor))
            : null;
        if (cursor && !cursor.success) throw new AppError('Invalid directory cursor', 400, 'VALIDATION_ERROR');
        c.header('Cache-Control', 'no-store');
        const loadDirectory = dependencies.loadPublicDirectory ?? (async (context, input) =>
            await getSupabaseAdmin(context).rpc('public_storefront_directory_v1', input));
        const { data, error } = await loadDirectory(c, {
            p_limit: query.limit,
            p_after_at: cursor?.success ? cursor.data.value : null,
            p_after_id: cursor?.success ? cursor.data.id : null,
        });
        const payload = StorefrontDirectoryPayloadSchema.safeParse(data);
        if (error || !payload.success || payload.data.stores.length > query.limit
            || payload.data.pagination.limit !== query.limit) {
            throw new AppError('The public store directory is temporarily unavailable.', 503, 'DIRECTORY_UNAVAILABLE');
        }
        return c.json(success(payload.data));
    });

    // GET /storefront/store/:storeId — Public published store data by immutable ID.
    // Kept for legacy storefront service compatibility; still only returns published stores.
    router.get('/store/:storeId', async (c) => {
        const storeId = c.req.param('storeId');
        if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid store id' } }, 400);
        }

        const allowed=await authorizeVisitor(c,{id:storeId});
        const store=allowed.site.subdomain?await loadSiteByHandle(c,allowed.site.subdomain,{publishedOnly:!allowed.preview}):null;
        if(!store||store.id!==storeId.toLowerCase())return c.json({error:{code:'NOT_FOUND',message:'Store not found'}},404);
        const [release, appBlocks] = await Promise.all([
            loadCurrentThemeRelease(c, store.id, { releaseId: store.current_theme_release_id, releaseVersion: store.storefront_release_version }),
            loadPublicStorefrontAppBlocks(c, store.id),
        ]);
        return c.json(success({
            ...mapPublicStorePayload(store, release),
            app_blocks: appBlocks,
        }));
    });

    // GET /storefront/store/:storeId/products — Public published product listing by store ID
    router.get('/store/:storeId/products', async (c) => {
        const storeId = c.req.param('storeId');
        if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid store id' } }, 400);
        }

        const store = await loadPublishedStoreById(c, storeId);

        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const filters = parseStorefrontDiscoveryRequest(c.req.url);
        if (!filters.success) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid product filters or pagination.' } }, 400);
        const { data, count, discovery, error } = await queryPublicProducts(c, storeId, { limit: filters.data.limit, page: filters.data.page, discovery: filters.data });
        if (error) return c.json(dbFailureBody(), 500);
        return c.json({ ...paginated(data.map(product => toPublicProduct(product)), count, filters.data.page, filters.data.limit), discovery });
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

    // GET /storefront/:subdomain/checkout/extensions — Public enabled checkout UI extensions for a published store.
    router.get('/:subdomain/checkout/extensions', async (c) => {
        const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: true });
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('app_extension_registrations')
            .select('id, site_id, app_id, installation_id, extension_handle, extension_type, surface, target, renderer, source_url, source_entrypoint, scopes, capabilities, settings, manifest_schema_version, app_version, status, enabled_at, disabled_at, revoked_at, sort_order, created_at, updated_at')
            .eq('site_id', store.id)
            .eq('surface', 'checkout.ui')
            .eq('status', 'enabled')
            .is('deleted_at', null)
            .order('sort_order', { ascending: true });

        if (isMissingTableError(error, 'app_extension_registrations')) {
            return c.json(success({
                store_id: store.id,
                surface: 'checkout.ui',
                extensions: [],
            }));
        }

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({
            store_id: store.id,
            surface: 'checkout.ui',
            extensions: data || [],
        }));
    });

    // GET /storefront/:subdomain/theme-preview?token=...
    // Signed storefront preview for editor iframes. Uses the same public store payload
    // shape as live rendering, but swaps the current release config with the draft.
    router.get('/:subdomain/theme-preview', async (c) => {
        c.header('Cache-Control', 'private, no-store');
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

        const resource = c.req.query('resource');
        if (resource === 'page' || resource === 'article' || resource === 'blog') {
            const result = await readThemePreviewContent(db, store.id, c.req.query());
            return c.json(result.body, result.status);
        }
        if (resource && resource !== 'products' && resource !== 'collections') {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Unknown preview resource' } }, 400);
        }
        if (resource === 'collections') {
            const collectionId = c.req.query('collection_id');
            if (collectionId !== undefined) {
                const result = await readThemePreviewCollection(db, store.id, collectionId);
                return c.json(result.body, result.status);
            }
            const browse = collectionBrowseQuery(c);
            if (!browse) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid collection cursor' } }, 400);
            const { data, error } = await loadCollectionSummaries(c, store.id, browse);
            if (error) return c.json(dbFailureBody(), 500);
            return c.json(success(collectionSummaryResult(data, browse)));
        }
        if (resource === 'products') {
            const rawIds = c.req.query('ids');
            const ids = rawIds === undefined ? undefined : rawIds.split(',').map((id) => id.trim()).filter(Boolean);
            if (ids && (ids.length > 100 || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))) {
                return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid preview product IDs' } }, 400);
            }
            if (ids && !ids.length) return c.json(success([]));
            const collectionId = c.req.query('collection_id');
            if (collectionId && !/^[0-9a-f-]{36}$/i.test(collectionId)) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid collection binding.' } }, 400);
            if (collectionId) {
                const collection = await db.from('collections').select('id').eq('id', collectionId).eq('store_id', store.id).eq('is_active', true).is('deleted_at', null).maybeSingle();
                if (collection.error) return c.json(dbFailureBody(), 500);
                if (!collection.data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Collection unavailable.' } }, 404);
            }
            const filters = parseStorefrontDiscoveryRequest(c.req.url, { transportKeys: ['token', 'resource', 'pagination', 'ids'], overrides: c.req.query('pagination') === '1' ? {} : { limit: 100 } });
            if (!filters.success) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid preview filters.' } }, 400);
            const { data, count, discovery, error } = await queryPublicProducts(c, store.id, { page: filters.data.page, limit: filters.data.limit, paginated: true, ids,
                discovery: filters.data });
            if (error) return c.json(dbFailureBody(), 500);
            const publicProducts = (data || []).map(product => toPublicProduct(product));
            return c.json({ ...(c.req.query('pagination') === '1' ? paginated(publicProducts, count, filters.data.page, filters.data.limit) : success(publicProducts)), discovery });
        }

        const liveRelease = await loadCurrentThemeRelease(c, store.id);
        const previewRelease: StorefrontThemeReleaseRecord = {
            id: previewSession.id,
            theme_id: previewSession.theme_id,
            theme_instance_id: liveRelease?.theme_instance_id || null,
            theme_package_version_id: liveRelease?.theme_package_version_id || null,
            release_version: draftVersion,
            release_config: draftManifest,
            release_manifest: {
                ...(liveRelease?.release_manifest || {}),
                preview: true,
                renderer_engine: resolveLiquidBundleArtifact(draftManifest) ? 'liquid' : 'json-contract',
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

        const appBlocks = await loadPublicStorefrontAppBlocks(c, store.id);

        return c.json(success({
            ...mapPublicStorePayload(store, previewRelease),
            app_blocks: appBlocks,
            theme_preview: {
                session_id: previewSession.id,
                draft_id: draftId,
                theme_instance_draft_id: previewSession.theme_instance_draft_id || null,
                draft_version: draftVersion,
                expires_at: previewSession.expires_at,
            },
        }));
    });

    // Public/default mobile shape remains stable; web explicitly requests render-v1.
    router.get('/:subdomain', async (c) => {
        const params = new URL(c.req.url).searchParams;
        const projection = params.get('projection');
        if ((projection !== null && projection !== 'render-v1') || params.getAll('projection').length > 1
            || (projection && [...params.keys()].some(key => key !== 'projection'))) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Unsupported storefront projection' } }, 400);
        }
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        // A cache hit must never skip the current publication/visibility fence.
        let store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: true });
        if(store&&(store.access_mode==null||store.access_mode==='public')&&store.published!==false){
            await authorizeVisitorSite(c,store as unknown as VisitorSite);
        }else{
            const allowed=await authorizeVisitor(c,{handle:c.req.param('subdomain')});
            if(!store&&allowed.preview)store=await loadSiteByHandle(c,c.req.param('subdomain'),{publishedOnly:false});
        }
        if(!store)return c.json({error:{code:'NOT_FOUND',message:'Store not found'}},404);
        const snapshot = await sha256Hex(JSON.stringify(store));
        const reply = await cachedJson(c, await storefrontRequestCacheKey(c, 'bootstrap', handle, snapshot), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const [release, appBlocks] = await Promise.all([
                loadCurrentThemeRelease(c, store.id, { releaseId: store.current_theme_release_id, releaseVersion: store.storefront_release_version, ...(projection ? { projection } : {}) }),
                loadPublicStorefrontAppBlocks(c, store.id),
            ]);
            return {
                body: success({ ...(projection ? mapPublicStoreRenderPayload(store, release) : mapPublicStorePayload(store, release)), app_blocks: appBlocks }),
                tags: storefrontCacheTags(store.id, handle, 'storefront:bootstrap', 'storefront:theme'),
            };
        }, { bypassCache: !store.current_theme_release_id });
        // Internal Cache API entries are content-keyed. Downstream caches must not
        // bypass the live site check; no cross-request private reuse is introduced.
        const headers = new Headers(reply.headers);
        headers.set('Cache-Control', 'no-store');
        return new Response(reply.body, { status: reply.status, headers });
    });

    // GET /storefront/:subdomain/status — Public limited status data for gated storefront routing.
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

    // POST /storefront/:subdomain/analytics/beacon — Public storefront session/source beacon.
    router.post('/:subdomain/analytics/beacon', async (c) => {
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const body = await c.req.json().catch(() => null);
        const parsed = StorefrontAnalyticsBeaconSchema.safeParse(body);
        if (!parsed.success) {
            return c.json({
                success: false,
                error: { code: 'VALIDATION', message: 'Invalid analytics beacon' },
            }, 400);
        }

        const beacon = parsed.data;
        const eventId = beacon.event_id || crypto.randomUUID();
        const occurredAt = beacon.occurred_at || new Date().toISOString();
        const requestId = dependencies.getRequestId(c);
        const referrer = textOrNull(beacon.referrer, 2000) || textOrNull(c.req.header('Referer'), 2000);
        const source = normalizeTrafficSource(beacon.source, referrer);
        const device = beacon.device || deviceFromUserAgent(c.req.header('User-Agent') || null);
        const country = textOrNull(beacon.country, 2) || textOrNull(c.req.header('CF-IPCountry'), 2);
        const sampleRate = analyticsSampleRate(c.env.STOREFRONT_VIEW_SAMPLE_RATE);
        const sampled = shouldSampleAnalytics(sampleRate);
        const generatedAt = new Date().toISOString();

        if (!sampled) {
            return c.json(success({
                accepted: true,
                queued: false,
                sampled: false,
                event_id: eventId,
                store_id: store.id,
                source,
                generated_at: generatedAt,
            }), 202);
        }

        const sampleWeight = sampleRate > 0 ? Math.max(1, Math.round(1 / sampleRate)) : 1;
        const aggregateId = beacon.product_id || beacon.cart_id || beacon.checkout_id || beacon.session_id;
        const db = getSupabaseAdmin(c);
        const { error } = await db
            .from('platform_queue_jobs')
            .upsert(
                {
                    site_id: store.id,
                    event_id: eventId,
                    queue_name: 'analytics-events',
                    job_type: STOREFRONT_BEACON_EVENT_TYPES[beacon.event_type],
                    payload: {
                        id: eventId,
                        type: STOREFRONT_BEACON_EVENT_TYPES[beacon.event_type],
                        site_id: store.id,
                        aggregate: {
                            type: beacon.product_id
                                ? 'product'
                                : beacon.cart_id
                                    ? 'cart'
                                    : beacon.checkout_id
                                        ? 'checkout'
                                        : 'storefront_session',
                            id: aggregateId,
                        },
                        occurred_at: occurredAt,
                        request_id: requestId,
                        idempotency_key: analyticsBeaconIdempotencyKey(store.id, beacon),
                        schema_version: 1,
                        payload: {
                            storefront_event_type: beacon.event_type,
                            session_id: beacon.session_id,
                            visitor_id: beacon.visitor_id || null,
                            path: beacon.path || '/',
                            page_title: beacon.page_title || null,
                            source,
                            referrer,
                            medium: beacon.medium || null,
                            campaign: beacon.campaign || null,
                            product_id: beacon.product_id || null,
                            product_slug: beacon.product_slug || null,
                            cart_id: beacon.cart_id || null,
                            checkout_id: beacon.checkout_id || null,
                            device,
                            country,
                            sample_rate: sampleRate,
                            sample_weight: sampleWeight,
                            source_runtime: 'customer-web',
                        },
                    },
                    idempotency_key: analyticsBeaconIdempotencyKey(store.id, beacon),
                    request_id: requestId,
                    schema_version: 1,
                },
                { onConflict: 'queue_name,idempotency_key', ignoreDuplicates: true },
            )
            .select('id')
            .maybeSingle();

        if (error) {
            return c.json(success({
                accepted: true,
                queued: false,
                sampled: true,
                event_id: eventId,
                store_id: store.id,
                source,
                generated_at: generatedAt,
            }), 202);
        }

        return c.json(success({
            accepted: true,
            queued: true,
            sampled: true,
            event_id: eventId,
            store_id: store.id,
            source,
            generated_at: generatedAt,
        }), 202);
    });

    // SECURITY: rate-limit checkout payment POSTs per-IP using authRateLimit (20/5min).
    // Applied only to mutating POST paths; public GET browsing is unaffected.
    router.use('/:subdomain/orders', async (c, next) => {
        if (c.req.method !== 'POST') { await next(); return; }
        return authRateLimit(c, next);
    });
    router.use('/:subdomain/shipping-rates', authRateLimit);
    router.use('/:subdomain/payments/razorpay/order', async (c, next) => {
        if (c.req.method !== 'POST') { await next(); return; }
        return authRateLimit(c, next);
    });
    router.use('/:subdomain/payments/razorpay/verify', async (c, next) => {
        if (c.req.method !== 'POST') { await next(); return; }
        return authRateLimit(c, next);
    });

    // POST /storefront/:subdomain/orders — Public checkout order creation.
    // The subdomain owns tenant resolution; client-submitted store IDs and totals are ignored.
    registerStorefrontCheckoutPaymentRoutes(router, {
        loadPublishedStore,
        getRequestId,
        emitStorefrontOrderPaidEvent,
    });

    // GET /storefront/:subdomain/products — Public product listing
    router.get('/:subdomain/products', async (c) => {
        const filters = parseStorefrontDiscoveryRequest(c.req.url);
        if (!filters.success) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid product filters or pagination.' } }, 400);
        const { page, limit } = filters.data;
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'products', handle), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }
            const { data, count, discovery, error } = await queryPublicProducts(c, store.id, {
                page,
                limit,
                paginated: true,
                discovery: filters.data,
            });
            if (error) return { status: 500, body: dbFailureBody() };
            return {
                body: { ...paginated((data || []).map((product) => toPublicProduct(product)), count || 0, page, limit), discovery },
                tags: storefrontCacheTags(store.id, handle, 'storefront:products'),
            };
        });
    });

    // GET /storefront/:subdomain/products/by-ids?ids=a,b — Public product subset scoped by store
    router.get('/:subdomain/products/by-ids', async (c) => {
        const filters = parseStorefrontDiscoveryRequest(c.req.url, { transportKeys: ['ids'], overrides: { limit: 100 } });
        if (!filters.success) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid product filters or pagination.' } }, 400);
        const ids = (c.req.query('ids') || '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean);
        if (ids.length > 100 || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid product IDs.' } }, 400);
        const page = filters.data.page;

        if (!ids.length) return c.json(success([]));

        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'products-by-ids', handle), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            const { data, error } = await queryPublicProducts(c, store.id, {
                limit: 100,
                page,
                paginated: true,
                ids,
                discovery: filters.data,
            });
            if (error) return { status: 500, body: dbFailureBody() };
            return {
                body: success((data || []).map((product) => toPublicProduct(product))),
                tags: storefrontCacheTags(store.id, handle, 'storefront:products'),
            };
        });
    });

    // GET /storefront/:subdomain/products/:slug — Single product scoped by store.
    // Accepts either a product slug or UUID to preserve existing storefront URLs.
    router.get('/:subdomain/products/:slug', async (c) => {
        const identifier = c.req.param('slug');
        if (!/^[a-z0-9-]{1,120}$/i.test(identifier)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid product identifier' } }, 400);
        }
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'product-detail', handle, identifier), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const db = getSupabaseAdmin(c);
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }
            // `id` is a uuid column — PostgREST/Postgres reject the OR filter outright
            // (22P02 invalid input syntax for type uuid) when the id.eq. branch is given a
            // non-uuid string, which is exactly what every slug lookup is. That cast failure
            // was the second half of W1: it broke every by-slug (and every genuinely-missing)
            // lookup even after the column-list fix above. Only add the id.eq. branch when the
            // identifier is actually uuid-shaped.
            const isUuidIdentifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
            const identifierFilter = isUuidIdentifier
                ? `slug.eq.${identifier},id.eq.${identifier}`
                : `slug.eq.${identifier}`;
            const { data, error } = await db
                .from('products')
                // SEC-1: never `'*'` on a public route. The fallback branch reads `variants` from the
                // products row instead of hydrating it, which is the only difference between the two
                // lists; selecting every column additionally exposed cost_per_item and the row's
                // bookkeeping columns.
                .select(productVariantRelationalReadsEnabled(c.env) ? PRODUCT_SELECT_FULL_RELATIONAL : PRODUCT_SELECT_FULL)
                .eq('store_id', store.id)
                .or(identifierFilter)
                .eq('is_active', true)
                .single();
            // PGRST116 is PostgREST's "0 (or >1) rows for .single()" code — a genuine absence,
            // safe to report as NOT_FOUND. Any other error (bad column, connection failure, etc.)
            // is a query failure, not an absence, and must not be reported as NOT_FOUND — doing so
            // previously hid a schema mismatch behind an indistinguishable 404 (W1).
            if (error && error.code !== 'PGRST116') {
                console.error(JSON.stringify({
                    level: 'error',
                    event: 'storefront_product_detail_query_failed',
                    store_id: store.id,
                    identifier,
                    request_id: getRequestId(c),
                    error_code: error.code,
                    error_message: error.message,
                }));
                return { status: 500, body: dbFailureBody() };
            }
            if (!data) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } },
                };
            }
            const [product] = await hydratePublicProductVariants(c, [data as unknown as PublicProductRow]);
            emitProductViewedEvent(c, {
                storeId: store.id,
                product: product as StorefrontProductDetail,
            });
            return {
                // SEC-1: filtered at the point of serialisation, after hydration, so nothing an
                // upstream step attaches can reach an anonymous caller unreviewed.
                body: success(toPublicProduct(product as Record<string, unknown>)),
                tags: storefrontCacheTags(store.id, handle, 'storefront:products', `storefront:product:${identifier}`),
            };
        });
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

        const plan = planCouponValidation(coupon as CouponRecord, { subtotal, enforceMinimumOrder: true });
        if (!plan.valid) {
            return c.json(success({
                valid: false,
                error: storefrontCouponValidationError(plan.failureCode, plan.coupon.minimumOrderAmount),
            }));
        }

        return c.json(success({
            valid: true,
            coupon: {
                code: plan.coupon.code,
                type: plan.coupon.type,
                value: plan.coupon.value,
                discount: plan.coupon.discount,
                freeShipping: plan.coupon.freeShipping,
            },
        }));
    }

    // Bounded discovery summaries only. Membership/products stay on the existing detail reader.
    router.get('/:subdomain/collections', async (c) => {
        c.header('Cache-Control', 'no-store');
        const browse = collectionBrowseQuery(c);
        if (!browse) return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid collection cursor' } }, 400);
        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
        const { data, error } = await loadCollectionSummaries(c, store.id, browse);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success(collectionSummaryResult(data, browse)));
    });

    // GET /storefront/:subdomain/collections/:slug — Public collection with assigned products.
    // The collections table uses id as the canonical URL segment (no slug column in baseline schema).
    // The route accepts either a UUID (canonical) or any token and resolves by id.
    router.get('/:subdomain/collections/:slug', async (c) => {
        const identifier = c.req.param('slug');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid collection identifier' } }, 400);
        }
        const countryOfOrigin = c.req.query('country_of_origin')?.trim() || undefined;
        if (countryOfOrigin && countryOfOrigin.length > 100) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Country of origin must be at most 100 characters' } }, 400);
        }

        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'collection-detail', handle, identifier), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const db = getSupabaseAdmin(c);
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            // Load collection by id (the baseline schema has no slug column; id is the URL token)
            const buildCollectionQuery = (includeDeletedAtFilter: boolean) => {
                let q = db
                    .from('collections')
                    .select('id, store_id, title, description, image_url, is_active')
                    .eq('id', identifier)
                    .eq('store_id', store.id)
                    .eq('is_active', true);

                if (includeDeletedAtFilter) q = q.is('deleted_at', null);
                return q.maybeSingle();
            };

            let { data: collection, error: collectionError } = await buildCollectionQuery(true);
            if (isMissingTableError(collectionError, 'collections')) {
                return { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Collection not found' } } };
            }
            if (collectionError) {
                return { status: 500, body: dbFailureBody() };
            }
            if (!collection) {
                return { status: 404, body: { success: false, error: { code: 'NOT_FOUND', message: 'Collection not found' } } };
            }

            const collectionRow = collection as SqlRecord;

            const parsedFilters = parseStorefrontDiscoveryRequest(c.req.url, { overrides: { collection_id: identifier } });
            if (!parsedFilters.success) return { status: 400, body: { success: false, error: { code: 'VALIDATION', message: 'Invalid collection filters or pagination.' } } };
            const { data: products, count: total, discovery, error: productError } = await queryPublicProducts(c, store.id, {
                limit: parsedFilters.data.limit, page: parsedFilters.data.page, paginated: true,
                discovery: parsedFilters.data,
            });
            if (productError) return { status: 500, body: dbFailureBody() };

            return {
                body: success({
                    collection: {
                        id: collectionRow.id,
                        title: collectionRow.title,
                        description: collectionRow.description || null,
                        image_url: collectionRow.image_url || null,
                    },
                    products: products.map(product => toPublicProduct(product)),
                    total,
                    discovery,
                }),
                tags: storefrontCacheTags(store.id, handle, 'storefront:collections', `storefront:collection:${identifier}`),
            };
        }, { bypassCache: true });
    });

    // GET /storefront/:subdomain/categories
    router.get('/:subdomain/categories', async (c) => {
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'categories', handle), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const db = getSupabaseAdmin(c);
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }
            const { data } = await db.from('product_categories').select('id,name,slug,image_url,parent_id,product_count').eq('store_id', store.id).eq('is_visible', true).order('display_order');
            return {
                body: success(data || []),
                tags: storefrontCacheTags(store.id, handle, 'storefront:products', 'storefront:categories'),
            };
        });
    });

    // GET /storefront/:subdomain/navigation?location=main
    router.get('/:subdomain/navigation', async (c) => {
        const location = normalizePublicRouteToken(c.req.query('location') || 'main');
        if (!location) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid menu location' } }, 400);
        }

        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'navigation', handle, location), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            try {
                const navigation = await loadNavigationMenu(c, store.id, location);
                return {
                    body: success(navigation),
                    tags: storefrontCacheTags(store.id, handle, 'storefront:navigation', `storefront:navigation:${location}`),
                };
            } catch {
                return {
                    status: 500,
                    body: {
                        success: false,
                        error: { code: 'DB_ERROR', message: 'Failed to load navigation' },
                    },
                };
            }
        });
    });

    // GET /storefront/:subdomain/pages
    router.get('/:subdomain/pages', async (c) => {
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'pages', handle), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            try {
                const pages = await listStorefrontPages(c, store.id);
                return {
                    body: success(pages),
                    tags: storefrontCacheTags(store.id, handle, 'storefront:pages'),
                };
            } catch {
                return {
                    status: 500,
                    body: {
                        success: false,
                        error: { code: 'DB_ERROR', message: 'Failed to load pages' },
                    },
                };
            }
        });
    });

    // GET /storefront/:subdomain/policies
    router.get('/:subdomain/policies', async (c) => {
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'policies', handle), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            try {
                const policies = await listStorefrontPolicies(c, store.id);
                return {
                    body: success(policies),
                    tags: storefrontCacheTags(store.id, handle, 'storefront:policies'),
                };
            } catch {
                return {
                    status: 500,
                    body: {
                        success: false,
                        error: { code: 'DB_ERROR', message: 'Failed to load policies' },
                    },
                };
            }
        });
    });

    // GET /storefront/:subdomain/policies/:policyType
    router.get('/:subdomain/policies/:policyType', async (c) => {
        const policyToken = normalizePublicRouteToken(c.req.param('policyType'));
        if (!policyToken) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid policy type' } }, 400);
        }

        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'policy', handle, policyToken), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            try {
                const policy = await loadStorefrontPolicy(c, store.id, policyToken);
                if (!policy) {
                    return {
                        status: 404,
                        body: { success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } },
                    };
                }
                return {
                    body: success(policy),
                    tags: storefrontCacheTags(store.id, handle, 'storefront:policies', `storefront:policy:${policyToken}`),
                };
            } catch {
                return {
                    status: 500,
                    body: {
                        success: false,
                        error: { code: 'DB_ERROR', message: 'Failed to load policy' },
                    },
                };
            }
        });
    });

    // GET /storefront/:subdomain/pages/:slug
    router.get('/:subdomain/pages/:slug', async (c) => {
        const slug = normalizePublicRouteToken(c.req.param('slug'));
        if (!slug) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid page slug' } }, 400);
        }

        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'page', handle, slug), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            try {
                const page = await loadStorefrontPageBySlug(c, store.id, slug);
                if (!page) {
                    return {
                        status: 404,
                        body: { success: false, error: { code: 'NOT_FOUND', message: 'Page not found' } },
                    };
                }
                return {
                    body: success(page),
                    tags: storefrontCacheTags(store.id, handle, 'storefront:pages', `storefront:page:${slug}`),
                };
            } catch {
                return {
                    status: 500,
                    body: {
                        success: false,
                        error: { code: 'DB_ERROR', message: 'Failed to load page' },
                    },
                };
            }
        });
    });

    // SECURITY: rate-limit customer auth POSTs per-IP using sensitiveRateLimit (5/min).
    // customer/login already has per-identity enforceCustomerAuthRateLimit inline; this
    // adds an outer per-IP guard at the router level for all auth entry-points.
    router.use('/customer/login', async (c, next) => {
        if (c.req.method !== 'POST') { await next(); return; }
        return sensitiveRateLimit(c, next);
    });
    router.use('/customer/password/request-reset', async (c, next) => {
        if (c.req.method !== 'POST') { await next(); return; }
        return sensitiveRateLimit(c, next);
    });
    router.use('/customer/password/confirm-reset', async (c, next) => {
        if (c.req.method !== 'POST') { await next(); return; }
        return sensitiveRateLimit(c, next);
    });

    // Internal-signed customer lifecycle routes, including the order-scoped checkout CRM bootstrap.
    registerStorefrontCustomerEngagementRoutes(router, {
        loadPublishedStore,
        hydrateStorefrontOrderItems,
        orderItemsRelationalReadsEnabled,
        isMissingColumnError,
        isMissingTableError,
        requireValidTurnstile,
    });

    // ROUTE-1: the blog band lives in its own module. public-routes.ts was at 1496 of a hard
    // 1500-line budget, four lines from being unable to accept any new public route at all.
    registerStorefrontBlogRoutes(router, { loadPublishedStore, normalizePublicRouteToken, storefrontCacheTags });

    // POST /storefront/:subdomain/contact — Public contact form
    router.post('/:subdomain/contact', async (c) => {
        const db = getSupabaseAdmin(c);
        const body = await c.req.json();
        const turnstileRejected = await requireValidTurnstile(c, body);
        if (turnstileRejected) return turnstileRejected;

        const store = await loadPublishedStore(c, c.req.param('subdomain'));
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
        await db.from('form_submissions').insert({ store_id: store.id, type: 'contact', name: body.name || '', email: body.email || '', message: body.message || '' });
        return c.json(success({ submitted: true }), 201);
    });
}
