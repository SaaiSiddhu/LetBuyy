import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { sha256Hex } from '../../lib/crypto';
import { dbFailureBody, getSupabaseAdmin, paginated, success } from '../../lib/supabase';
import { cachedJson, storefrontRequestCacheKey, STOREFRONT_CACHE_SWR_SECONDS, STOREFRONT_CACHE_TTL_SECONDS } from '../../lib/storefront-cache';
import { validate } from '../../middleware/validation';
import { StorefrontProductReviewsQuery } from '../../schemas/review.schema';
import { registerStorefrontCartRoutes } from './cart-routes';
import { registerStorefrontCheckoutPaymentRoutes } from './checkout-payment-routes';
import { registerStorefrontCustomerEngagementRoutes } from './customer-engagement-routes';
import { planCouponValidation, storefrontCouponValidationError, type CouponRecord } from '@letbuyy/checkout-core';
import { mapPublicStorePayload, normalizeStorefrontHandle, type PublishedStoreRecord, type StorefrontSiteRecord, type StorefrontThemeReleaseRecord } from '@letbuyy/tenant-core';
import { StorefrontAnalyticsBeaconSchema, type StorefrontAnalyticsBeacon } from '@letbuyy/shared-types';
import type { AppBlockInstance } from '@letbuyy/app-engine';

type AppContext = Context<{ Bindings: Env }>;
type SqlRecord = Record<string, unknown>;
type PublicProductRow = SqlRecord;
type StorefrontProductDetail = { id: string; slug?: string | null };
type DatabaseErrorLike = { message?: string; details?: string; hint?: string } | null | undefined;
type StorefrontAnalyticsBeaconEventType = StorefrontAnalyticsBeacon['event_type'];
const STOREFRONT_SITE_SELECT: string =
    'id,store_name,name,description,site_type,status,subdomain,custom_domain,domain,is_published,is_active,is_password_protected,coming_soon_enabled,tagline,logo_url,cover_image,primary_color,secondary_color,published_at,created_at,updated_at,seo_title,seo_description,seo_keywords,og_image_url,twitter_handle,settings,theme_settings,currency,timezone,language,theme_id,theme_config';
const STOREFRONT_SITE_RELEASE_SELECT: string =
    `${STOREFRONT_SITE_SELECT},current_theme_release_id,storefront_release_version`;
const STOREFRONT_SITE_COMPAT_SELECT: string =
    'id,store_name,name,description,site_type,status,subdomain,custom_domain,domain,is_published,is_active,is_password_protected,coming_soon_enabled,tagline,logo_url,cover_image,primary_color,secondary_color,published_at,created_at,updated_at,seo_title,seo_description,seo_keywords,og_image_url,twitter_handle,settings,theme_settings,currency,timezone,language,theme_id,theme_config';
const STOREFRONT_SITE_RELEASE_COMPAT_SELECT: string =
    `${STOREFRONT_SITE_COMPAT_SELECT},current_theme_release_id,storefront_release_version`;
const PRODUCT_SELECT_FULL: string =
    'id,store_id,name,slug,description,short_description,price,compare_at_price,cost_price,sku,barcode,category_id,brand,product_type,tags,images,featured_image,inventory_quantity,track_inventory,is_active,is_featured,weight,dimensions,seo_title,seo_description,created_at,updated_at,variants';
const PRODUCT_SELECT_FULL_RELATIONAL: string = PRODUCT_SELECT_FULL.replace(',variants', '');
const STOREFRONT_BEACON_EVENT_TYPES: Record<StorefrontAnalyticsBeaconEventType, string> = {
    session_started: 'storefront.session_started',
    page_view: 'storefront.page_view',
    product_view: 'storefront.product_view',
    cart_add: 'storefront.cart_add',
    checkout_started: 'storefront.checkout_started',
};

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
    ids?: string[];
};

type PublicProductQueryResult = {
    data: PublicProductRow[];
    count: number;
    error: unknown;
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

type StorefrontPublicRouteDependencies = {
    loadSiteByHandle: (c: AppContext, handle: string, options: { publishedOnly: boolean }) => Promise<StorefrontSiteRecord | null>;
    loadPublishedStore: (c: AppContext, subdomain: string) => Promise<PublishedStoreRecord | null>;
    loadPublishedStoreById: (c: AppContext, storeId: string) => Promise<PublishedStoreRecord | null>;
    loadCurrentThemeRelease: (c: AppContext, storeId: string) => Promise<StorefrontThemeReleaseRecord | null>;
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
};

export function registerStorefrontPublicRoutes(
    router: Hono<{ Bindings: Env }>,
    dependencies: StorefrontPublicRouteDependencies,
): void {
    const {
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
    } = dependencies;

    registerStorefrontCartRoutes(router, {
        loadPublishedStore,
        queryPublicProducts,
        normalizePublicRouteToken,
    });

    router.get('/lookup', async (c) => {
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
        const selectStore = (selectFields: string, includeDeletedAtFilter: boolean) => {
            let query = db
                .from('sites')
                .select(selectFields)
                .eq('id', storeId)
                .eq('status', 'published');

            if (includeDeletedAtFilter) query = query.is('deleted_at', null);

            return query;
        };

        let { data, error } = await selectStore(STOREFRONT_SITE_RELEASE_SELECT, true).single();

        if (error || !data) {
            ({ data, error } = await selectStore(STOREFRONT_SITE_RELEASE_COMPAT_SELECT, true).single());
        }

        if (error || !data) {
            ({ data, error } = await selectStore(STOREFRONT_SITE_SELECT, true).single());
        }

        if (error || !data) {
            ({ data, error } = await selectStore(STOREFRONT_SITE_COMPAT_SELECT, true).single());
        }

        if (error || !data) {
            ({ data } = await selectStore(STOREFRONT_SITE_COMPAT_SELECT, false).single());
        }

        if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const store = data as unknown as StorefrontSiteRecord;
        const [release, appBlocks] = await Promise.all([
            loadCurrentThemeRelease(c, store.id),
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

    // GET /storefront/:subdomain/checkout/extensions — Public enabled checkout UI extensions for a published store.
    router.get('/:subdomain/checkout/extensions', async (c) => {
        const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: true });
        if (!store) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);

        const { data, error } = await getSupabaseAdmin(c)
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

    // GET /storefront/:subdomain — Public published store data and immutable current release
    router.get('/:subdomain', async (c) => {
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'bootstrap', handle), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const store = await loadSiteByHandle(c, c.req.param('subdomain'), { publishedOnly: true });
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            const [release, appBlocks] = await Promise.all([
                loadCurrentThemeRelease(c, store.id),
                loadPublicStorefrontAppBlocks(c, store.id),
            ]);
            return {
                body: success({
                    ...mapPublicStorePayload(store, release),
                    app_blocks: appBlocks,
                }),
                tags: storefrontCacheTags(store.id, handle, 'storefront:bootstrap', 'storefront:theme'),
            };
        });
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
        const { error } = await getSupabaseAdmin(c)
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
                            source_runtime: 'storefront-runtime',
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

    // POST /storefront/:subdomain/orders — Public checkout order creation.
    // The subdomain owns tenant resolution; client-submitted store IDs and totals are ignored.
    registerStorefrontCheckoutPaymentRoutes(router, {
        loadPublishedStore,
        getRequestId,
        emitStorefrontOrderPaidEvent,
    });

    // GET /storefront/:subdomain/products — Public product listing
    router.get('/:subdomain/products', async (c) => {
        const page = parseInt(c.req.query('page') || '1');
        const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'products', handle), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }
            const { data, count, error } = await queryPublicProducts(c, store.id, {
                page,
                limit,
                paginated: true,
                category: c.req.query('category') || undefined,
                search: c.req.query('search') || undefined,
            });
            if (error) return { status: 500, body: dbFailureBody() };
            return {
                body: paginated(data || [], count || 0, page, limit),
                tags: storefrontCacheTags(store.id, handle, 'storefront:products'),
            };
        });
    });

    // GET /storefront/:subdomain/products/by-ids?ids=a,b — Public product subset scoped by store
    router.get('/:subdomain/products/by-ids', async (c) => {
        const ids = (c.req.query('ids') || '')
            .split(',')
            .map((id) => id.trim())
            .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
            .slice(0, 100);

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

            const { data, error } = await queryPublicProducts(c, store.id, { limit: 100, ids });
            if (error) return { status: 500, body: dbFailureBody() };
            return {
                body: success(data || []),
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
            const { data } = await db
                .from('products')
                .select(productVariantRelationalReadsEnabled(c.env) ? PRODUCT_SELECT_FULL_RELATIONAL : '*')
                .eq('store_id', store.id)
                .or(`slug.eq.${identifier},id.eq.${identifier}`)
                .eq('is_active', true)
                .single();
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
                body: success(product),
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

    // POST /storefront/customer/find-or-create — Sessionless checkout customer bootstrap
    registerStorefrontCustomerEngagementRoutes(router, {
        loadPublishedStore,
        hydrateStorefrontOrderItems,
        orderItemsRelationalReadsEnabled,
        isMissingColumnError,
        isMissingTableError,
        requireValidTurnstile,
    });

    // GET /storefront/:subdomain/blog
    router.get('/:subdomain/blog', async (c) => {
        const page = parseInt(c.req.query('page') || '1');
        const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'blog', handle), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const db = getSupabaseAdmin(c);
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }
            const { data, count } = await db.from('blog_posts').select('id,title,slug,excerpt,featured_image,published_at,created_at,updated_at,is_pinned,seo_title,seo_description,og_image_url', { count: 'exact' })
                .eq('store_id', store.id).eq('status', 'published').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
            return {
                body: paginated(data || [], count || 0, page, limit),
                tags: storefrontCacheTags(store.id, handle, 'storefront:blog'),
            };
        });
    });

    // GET /storefront/:subdomain/blog/:slug
    router.get('/:subdomain/blog/:slug', async (c) => {
        const slug = normalizePublicRouteToken(c.req.param('slug'));
        if (!slug) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid blog post slug' } }, 400);
        }

        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'blog-detail', handle, slug), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const db = getSupabaseAdmin(c);
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            const { data, error } = await db.from('blog_posts')
                .select('id,title,slug,excerpt,content,content_html,featured_image,published_at,updated_at,seo_title,seo_description,og_image_url,canonical_url')
                .eq('store_id', store.id)
                .eq('status', 'published')
                .eq('slug', slug)
                .maybeSingle();

            if (error) return { status: 500, body: dbFailureBody() };
            if (!data) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Blog post not found' } },
                };
            }

            return {
                body: success({
                    id: data.id,
                    title: data.title,
                    slug: data.slug,
                    page_type: 'blog_post',
                    content: {
                        body: data.content || '',
                        html: data.content_html || '',
                        image: data.featured_image || '',
                        excerpt: data.excerpt || '',
                    },
                    seo: {
                        title: data.seo_title || data.title,
                        description: data.seo_description || data.excerpt || '',
                        ogImage: data.og_image_url || data.featured_image || '',
                        canonicalUrl: data.canonical_url || '',
                    },
                    published_at: data.published_at,
                    updated_at: data.updated_at,
                }),
                tags: storefrontCacheTags(store.id, handle, 'storefront:blog', `storefront:blog:${slug}`),
            };
        });
    });

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
