import { Hono } from 'hono';
import { DiscardThemeDraftSchema } from '@letbuyy/theme-engine';
import type { Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { hmacSha256Hex, timingSafeEqualHex } from '../lib/crypto';
import { bumpStorefrontCacheVersion, purgeStorefrontCache, storefrontCacheKey } from '../lib/storefront-cache';
import { dbErrorBody, errorBody, getSupabaseAdmin, paginated, shouldReturnEmptyForMissingLocalSchema, success } from '../lib/supabase';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
    buildMarketplaceAutomatedChecks,
    createMarketplaceReviewRecord,
} from '../lib/marketplace-review-records';
import { mountThemeMarketplaceAuxiliaryRoutes } from '../lib/theme-marketplace-auxiliary-routes';
import {
    ArchiveSiteThemeSchema,
    CreateSiteThemeSchema,
    DeleteUnpublishedThemeQuerySchema,
    DuplicateSiteThemeSchema,
    InstallThemeSchema,
    ListSiteThemesQuerySchema,
    PreviewTokenSchema,
    PublishThemeSchema,
    RenameSiteThemeSchema,
    RollbackThemeReleaseSchema,
    SaveThemeDraftSchema,
    ReorderThemeDraftSchema,
    ThemePurchaseOrderSchema,
    ThemePurchaseVerifySchema,
    ThemeReviewCreateSchema,
    ThemeReviewReplySchema,
    ThemeReportSchema,
    ThemeRefundRequestSchema,
    ThemeStoreQuerySchema,
    UploadThemePackageSchema,
    ValidateThemeDocumentSchema,
    type ArchiveSiteThemeInput,
    type CreateSiteThemeInput,
    type DuplicateSiteThemeInput,
    type InstallThemeInput,
    type PreviewTokenInput,
    type PublishThemeInput,
    type RenameSiteThemeInput,
    type RollbackThemeReleaseInput,
    type SaveThemeDraftInput,
    type ReorderThemeDraftInput,
    type ThemePurchaseOrderInput,
    type ThemePurchaseVerifyInput,
    type ThemeReviewCreateInput,
    type ThemeReviewReplyInput,
    type ThemeReportInput,
    type ThemeRefundRequestInput,
    type UploadThemePackageInput,
    type ValidateThemeDocumentInput,
} from '../schemas/theme.schema';
import { applyStorePlanTierDefaults, type BillingPlanCatalogRecord } from '@letbuyy/billing-core';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { SchemaRegistryExecutionAdapter } from '../execution/schema-registry-execution.adapter';
import { ThemeExecutionAdapter } from '../execution/theme-execution.adapter';
import { createRazorpayOrder } from '@letbuyy/infrastructure/razorpay-adapter';
import resourceSearchRouter from './resource-search';
import mediaLibraryRouter from './themes/media-library';
import { mountThemeUpdateRoutes } from './themes/theme-update-route';
import { mountThemeLibraryRoutes } from './themes/theme-library-routes';
import { mountThemePurchaseRoutes } from './themes/theme-purchase-routes';

const router = new Hono<{ Bindings: Env }>();

// Phase X — media-library registered BEFORE resource-search and all /:slug/* catch-alls
// to prevent route-shadowing ambiguity. Read-only picker; ES256 merchant auth required.
router.use('/media-library', authMiddleware);

// Phase W — resource-search registered FIRST (static path, before all /:slug/* catch-all
// middleware registrations) to prevent route-shadowing ambiguity.
router.use('/resource-search', authMiddleware);

// Phase Q — library routes authMiddleware registered FIRST (before /:slug/* catch-all
// middleware registrations) to prevent any route-shadowing ambiguity.
router.use('/library', authMiddleware);
router.use('/library/*', authMiddleware);
// Phase AB — version-update routes. Registered after all static sub-router prefixes
// (media-library, resource-search, library) so those static tests stay green, but before
// the existing /:slug/* catch-alls (duplicate, rename, …) so order still prevents shadowing.
router.use('/:slug/update-preview', authMiddleware);
router.use('/:slug/update', authMiddleware);
router.use('/:slug/duplicate', authMiddleware);
router.use('/:slug/rename', authMiddleware);
router.use('/:slug/archive', authMiddleware);
router.use('/:slug/unpublished', authMiddleware);

router.use('/', optionalAuth);
router.use('/packages/upload', authMiddleware);
router.use('/:slug/editor', authMiddleware);
router.use('/:slug/editor/*', authMiddleware);
router.use('/:slug/publish', authMiddleware);
router.use('/:slug/validate', authMiddleware);
router.use('/:slug/preview-session', authMiddleware);
router.use('/:slug/releases', authMiddleware);
router.use('/:slug/releases/*', authMiddleware);
router.use('/:slug/install', authMiddleware);
router.use('/:slug/purchase', authMiddleware);
router.use('/:slug/purchase/*', authMiddleware);
router.use('/purchases/list', authMiddleware);
router.use('/purchases/:purchaseId/receipt', authMiddleware);
router.use('/installations/list', authMiddleware);
router.use('/downloads/list', authMiddleware);
router.use('/settings', authMiddleware);
router.use('/saved-searches', authMiddleware);
router.use('/developer/*', authMiddleware);
router.use('/:slug/downloads/*', authMiddleware);
router.use('/:slug/refunds', authMiddleware);
router.use('/:slug/reports', authMiddleware);
router.use('/:slug/reviews/*', authMiddleware);

type ThemePurchaseTheme = {
    id: string;
    slug?: string | null;
    name: string;
    is_premium?: boolean | null;
    letbuyy_pricing_type?: string | null;
    letbuyy_price_inr?: number | string | null;
    letbuyy_price_usd?: number | string | null;
};

type ThemePurchaseRecord = {
    id: string;
    status?: string | null;
    provider_order_id?: string | null;
    provider_payment_id?: string | null;
    payment_idempotency_key?: string | null;
};

type CustomUserRecord = {
    id: string;
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
};

function getRequestId(c: Context<{ Bindings: Env }>): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

async function purgeThemeStorefrontCache(c: Context<{ Bindings: Env }>, storeId: string): Promise<void> {
    const db = getSupabaseAdmin(c);
    const { data } = await db
        .from('sites')
        .select('subdomain,store_name,custom_domain')
        .eq('id', storeId)
        .maybeSingle();
    const record = data as { subdomain?: string | null; store_name?: string | null; custom_domain?: string | null } | null;
    const handles = [
        record?.subdomain,
        record?.store_name,
        record?.custom_domain,
    ].filter((handle): handle is string => Boolean(handle));
    if (handles.length === 0) return;
    await bumpStorefrontCacheVersion(c, handles);
    await purgeStorefrontCache(c, handles.map((handle) => storefrontCacheKey('storefront-rest', 'bootstrap', '0', handle)));
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function integerQuery(value: string | undefined, fallback: number, min: number, max: number): number {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function numberQuery(value: string | undefined): number | null {
    if (value === undefined || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeSearch(value: string | undefined): string | null {
    if (!value) return null;
    const cleaned = value.trim().replace(/[,%]/g, ' ').replace(/\s+/g, ' ');
    return cleaned.length > 0 ? cleaned.slice(0, 120) : null;
}

function receiptNumber(purchaseId: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LBTH-${date}-${purchaseId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

function invoiceNumber(purchaseId: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LBTH-GST-${date}-${purchaseId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function licenseKey(): string {
    return `LB-THEME-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}

const THEME_MARKETPLACE_GST_RATE = 18;
const THEME_MARKETPLACE_DEV_GSTIN = '27ABCDE1234F1Z5';

function envString(c: Context<{ Bindings: Env }>, key: string): string | null {
    const value = (c.env as unknown as Record<string, string | undefined>)[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isProductionLikeRuntime(c: Context<{ Bindings: Env }>): boolean {
    return ['ENVIRONMENT', 'APP_ENV', 'NODE_ENV', 'VERCEL_ENV']
        .some((key) => envString(c, key)?.toLowerCase() === 'production');
}

function configuredThemeMarketplaceSellerGstin(c: Context<{ Bindings: Env }>): string | null {
    return envString(c, 'THEME_MARKETPLACE_GSTIN') || envString(c, 'GSTIN');
}

function themeMarketplaceSellerGstin(c: Context<{ Bindings: Env }>): string {
    return configuredThemeMarketplaceSellerGstin(c) || THEME_MARKETPLACE_DEV_GSTIN;
}

function themeMarketplaceGstinSource(c: Context<{ Bindings: Env }>): 'environment' | 'local_dev_default' {
    return configuredThemeMarketplaceSellerGstin(c) ? 'environment' : 'local_dev_default';
}

function requireThemeMarketplaceSellerGstin(c: Context<{ Bindings: Env }>): string | Response {
    const configured = configuredThemeMarketplaceSellerGstin(c);
    if (configured) return configured;
    if (!isProductionLikeRuntime(c)) return THEME_MARKETPLACE_DEV_GSTIN;

    return c.json(
        { error: { code: 'THEME_MARKETPLACE_GSTIN_REQUIRED', message: 'Theme marketplace GSTIN must be configured before production receipts can be issued.' } },
        503,
    );
}

function themeMarketplaceGstAmount(amountInr: number): number {
    if (!Number.isFinite(amountInr) || amountInr <= 0) return 0;
    return Number((amountInr * THEME_MARKETPLACE_GST_RATE / (100 + THEME_MARKETPLACE_GST_RATE)).toFixed(2));
}

function themeMarketplaceInvoiceJson(
    c: Context<{ Bindings: Env }>,
    input: {
        purchaseId: string;
        themeSlug: string;
        provider: string;
        providerPaymentId?: string | null;
        amountInr: number;
    }
): Record<string, unknown> {
    const sellerGstin = themeMarketplaceSellerGstin(c);
    return {
        purchase_id: input.purchaseId,
        theme_slug: input.themeSlug,
        provider: input.provider,
        provider_payment_id: input.providerPaymentId || null,
        seller_gstin: sellerGstin,
        gstin_source: themeMarketplaceGstinSource(c),
        gst_rate: THEME_MARKETPLACE_GST_RATE,
        gst_amount_inr: themeMarketplaceGstAmount(input.amountInr),
        tax_treatment: 'gst_inclusive',
        invoice_mode: themeMarketplaceGstinSource(c) === 'environment' ? 'live' : 'local_dev_default',
    };
}

function localThemeArtifactContent(theme: { slug?: string | null; name?: string | null }, platform: string, artifact: Record<string, unknown>): string {
    return [
        'LetBuyy local theme artifact',
        `theme=${theme.slug || theme.name || 'theme'}`,
        `platform=${platform}`,
        `artifact_key=${String(artifact.artifact_key || '')}`,
        `checksum=${String(artifact.checksum_sha256 || 'local-dev-checksum')}`,
        'This local package proves entitlement, size, and signed-url delivery in development.',
    ].join('\n');
}

function localThemeArtifactSizeBytes(content: string): number {
    return new TextEncoder().encode(content).length;
}

function localThemeArtifactSignedUrl(content: string): string {
    return `data:application/zip;charset=utf-8,${encodeURIComponent(content)}`;
}

function reviewSummary(reviews: Array<{ rating?: number | null }>): {
    average: number;
    total: number;
    distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
} {
    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let totalRating = 0;

    for (const review of reviews) {
        const rating = Number(review.rating || 0);
        if (rating >= 1 && rating <= 5) {
            distribution[String(rating) as keyof typeof distribution] += 1;
            totalRating += rating;
        }
    }

    const total = reviews.length;
    return {
        average: total > 0 ? Number((totalRating / total).toFixed(2)) : 0,
        total,
        distribution,
    };
}

async function requireCustomUser(c: Context<{ Bindings: Env }>): Promise<CustomUserRecord | Response> {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user) as CustomUserRecord | null;

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    return customUser;
}

async function emitThemeSubmittedEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        upload: unknown;
        partnerId: string;
        requestId: string;
        reviewId?: string | null;
    },
): Promise<void> {
    const upload = recordValue(input.upload);
    const themePackage = recordValue(upload.package);
    const version = recordValue(upload.version);
    const themePackageId = stringOrNull(themePackage.id);
    const themeVersionId = stringOrNull(version.id);
    if (!themePackageId || !themeVersionId) return;

    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: null,
        aggregateType: 'theme',
        aggregateId: themePackageId,
        eventType: 'theme.submitted',
        idempotencyKey: `theme.submitted:${themePackageId}:${themeVersionId}`,
        requestId: input.requestId,
        actorId: input.partnerId,
        payload: {
            theme_package_id: themePackageId,
            theme_version_id: themeVersionId,
            partner_id: input.partnerId,
            ...(input.reviewId ? { review_id: input.reviewId } : {}),
        },
    });
}

// GET /themes — List available themes (public)
router.get('/', async (c) => {
    const auth = c.get('auth');
    const category = c.req.query('category');
    const siteType = c.req.query('site_type');
    const pricing = c.req.query('pricing');
    const industry = c.req.query('industry');
    const layout = c.req.query('layout');
    const tag = c.req.query('tag');
    const feature = c.req.query('feature');
    const priceMin = numberQuery(c.req.query('price_min'));
    const priceMax = numberQuery(c.req.query('price_max'));
    const search = sanitizeSearch(c.req.query('search'));
    const sort = c.req.query('sort') || 'popular';
    const storeId = c.req.query('store_id');
    const page = integerQuery(c.req.query('page'), 1, 1, 500);
    const limit = integerQuery(c.req.query('limit'), 20, 1, 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    let query = db
        .from('themes')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

    if (category) query = query.eq('category', category);
    if (siteType) query = query.contains('supported_site_types', [siteType]);
    if (pricing) query = query.eq('letbuyy_pricing_type', pricing);
    if (industry) query = query.contains('industry', [industry]);
    if (layout) query = query.eq('layout', layout);
    if (tag) query = query.contains('tags', [tag]);
    if (feature) query = query.contains('features', [feature]);
    if (priceMin !== null) query = query.gte('letbuyy_price_inr', priceMin);
    if (priceMax !== null) query = query.lte('letbuyy_price_inr', priceMax);
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);

    switch (sort) {
        case 'trending':
            query = query
                .order('rating_avg', { ascending: false })
                .order('install_count', { ascending: false })
                .order('created_at', { ascending: false });
            break;
        case 'rating':
            query = query.order('rating_avg', { ascending: false });
            break;
        case 'new':
        case 'recent':
            query = query.order('created_at', { ascending: false });
            break;
        case 'name':
            query = query.order('name', { ascending: true });
            break;
        case 'price_low':
            query = query.order('letbuyy_price_inr', { ascending: true });
            break;
        case 'price_high':
            query = query.order('letbuyy_price_inr', { ascending: false });
            break;
        case 'popular':
            query = query.order('install_count', { ascending: false });
            break;
        default:
            query = query.order('sort_order', { ascending: true });
            break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            const devThemes = [
                { id: 'modern', slug: 'modern', name: 'Minimal Modern', category: 'General', is_active: true, letbuyy_pricing_type: 'free', letbuyy_price_inr: 0 },
                { id: 'vibrant', slug: 'vibrant', name: 'Vibrant Bold', category: 'General', is_active: true, letbuyy_pricing_type: 'free', letbuyy_price_inr: 0 },
                { id: 'tech-elite', slug: 'tech-elite', name: 'Tech Elite', category: 'Tech', is_active: true, letbuyy_pricing_type: 'free', letbuyy_price_inr: 0 },
                { id: 'midnight', slug: 'midnight', name: 'Midnight Purple', category: 'Fashion', is_active: true, letbuyy_pricing_type: 'free', letbuyy_price_inr: 0 },
                { id: 'luxury', slug: 'luxury', name: 'Luxury Premium', category: 'Luxury', is_active: true, letbuyy_pricing_type: 'free', letbuyy_price_inr: 0 },
                { id: 'fresh-mint', slug: 'fresh-mint', name: 'Fresh Mint', category: 'Beauty', is_active: true, letbuyy_pricing_type: 'free', letbuyy_price_inr: 0 },
            ];
            if (storeId && auth) {
                const enriched = devThemes.map((theme) => ({
                    ...theme,
                    installed: true,
                    active: theme.slug === 'modern',
                }));
                return c.json({
                    ...paginated(enriched, devThemes.length, page, limit),
                    current_theme: 'modern',
                    store_status: 'published',
                });
            }
            return c.json(paginated(devThemes, devThemes.length, page, limit));
        }
        return c.json(dbErrorBody(), 500);
    }

    if (!storeId) {
        return c.json(paginated(data || [], count || 0, page, limit));
    }

    if (!auth) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required for store-scoped theme state' } }, 401);
    }

    const queryResult = ThemeStoreQuerySchema.safeParse({ store_id: storeId });
    if (!queryResult.success) {
        return c.json(
            { error: { code: 'VALIDATION_ERROR', message: 'Invalid store_id' } },
            400
        );
    }

    const service = new ThemeExecutionAdapter(db, auth.user.storeId);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const store = await service.verifyThemeEditorStore(queryResult.data.store_id, customUser.id);

    const { data: installations } = await db
        .from('store_themes')
        .select('theme_id, is_active')
        .eq('store_id', queryResult.data.store_id);

    const installedThemeIds = new Set((installations || []).map((row) => row.theme_id as string));
    const activeThemeIds = new Set(
        (installations || [])
            .filter((row) => row.is_active)
            .map((row) => row.theme_id as string)
    );

    const enriched = (data || []).map((theme) => ({
        ...theme,
        installed: installedThemeIds.has(theme.id),
        active: activeThemeIds.has(theme.id) || store.theme_id === theme.slug,
    }));

    return c.json({
        ...paginated(enriched, count || 0, page, limit),
        current_theme: store.theme_id || null,
        store_status: store.status || null,
    });
});

// GET /themes/categories — List unique theme categories
router.get('/categories', async (c) => {
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('themes')
        .select('category')
        .eq('is_active', true)
        .not('category', 'is', null);

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    // Deduplicate
    const categories = [...new Set((data || []).map((t) => t.category).filter(Boolean))];
    return c.json(success(categories));
});

// GET /themes/industries — List unique theme industries
router.get('/industries', async (c) => {
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('themes')
        .select('industry')
        .eq('is_active', true)
        .not('industry', 'is', null);

    if (error) {
        return c.json(dbErrorBody(), 500);
    }

    const industries = [
        ...new Set(
            (data || [])
                .flatMap((row) => Array.isArray(row.industry) ? row.industry : [])
                .filter(Boolean)
        ),
    ];

    return c.json(success(industries.sort()));
});

mountThemeMarketplaceAuxiliaryRoutes(router);

// Phase X — media-library sub-router (static path; must appear before /:slug catch-alls)
router.route('/media-library', mediaLibraryRouter);

// Phase W — resource-search sub-router (static path; must appear before /:slug catch-alls)
router.route('/resource-search', resourceSearchRouter);

// Phase AB — version-update routes (registered after static sub-routers; each path is
// path-specific enough to avoid /:slug/* ambiguity with the slug catch-all handlers below)
mountThemeUpdateRoutes(router);

// GET /themes/:slug/schema — Return editable schemas for a theme
router.get('/:slug/schema', async (c) => {
    const slug = c.req.param('slug');
    const db = getSupabaseAdmin(c);
    const service = new ThemeExecutionAdapter(db);
    return c.json(success(await service.getEditableSchema(slug)));
});

// GET /themes/:slug/editor?store_id=... — Load store-scoped theme editor state
router.get('/:slug/editor', async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const parsed = ThemeStoreQuerySchema.safeParse({
        store_id: c.req.query('store_id'),
        template_key: c.req.query('template_key') || c.req.query('template') || 'index',
    });

    if (!parsed.success) {
        return c.json(
            { error: { code: 'VALIDATION_ERROR', message: 'store_id query parameter is required' } },
            400
        );
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeExecutionAdapter(db, auth.user.storeId);
    return c.json(success(await service.loadEditor(slug, parsed.data.store_id, customUser.id, parsed.data.template_key)));
});

// PUT /themes/:slug/editor/draft — Save a store-scoped theme draft
router.put('/:slug/editor/draft', validate('json', SaveThemeDraftSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as SaveThemeDraftInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeExecutionAdapter(db, auth.user.storeId);
    return c.json(success(await service.saveDraft(slug, body, customUser.id, getRequestId(c))));
});

router.put('/:slug/editor/reorder', validate('json', ReorderThemeDraftSchema), async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    const service = new ThemeExecutionAdapter(db, auth.user.storeId);
    return c.json(success(await service.reorderDraft(c.req.param('slug'), c.get('validatedBody') as ReorderThemeDraftInput, customUser.id, getRequestId(c))));
});

// DELETE /themes/:slug/editor/draft?store_id=... — Discard a store-scoped draft
router.delete('/:slug/editor/draft', async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const version = c.req.query('base_version');
    const parsed = DiscardThemeDraftSchema.safeParse({
        store_id: c.req.query('store_id'),
        base_version: version !== undefined && /^\d+$/.test(version) ? Number(version) : undefined,
        idempotency_key: c.req.query('idempotency_key'),
        template_key: c.req.query('template_key') || c.req.query('template') || 'index',
    });

    if (!parsed.success) {
        return c.json(
            { error: { code: 'VALIDATION_ERROR', message: 'store_id query parameter is required' } },
            400
        );
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeExecutionAdapter(db, auth.user.storeId);
    return c.json(success(await service.deleteDraft(slug, parsed.data.store_id, customUser.id, getRequestId(c), parsed.data.template_key, parsed.data)));
});

// POST /themes/:slug/publish — Publish a saved draft to the live store config
router.post('/:slug/publish', validate('json', PublishThemeSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as PublishThemeInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeExecutionAdapter(db, auth.user.storeId);
    const published = await service.publish(slug, body, customUser.id, getRequestId(c));
    await purgeThemeStorefrontCache(c, body.store_id);
    return c.json(success(published));
});

// POST /themes/:slug/preview-session — Create a signed draft preview token
router.post('/:slug/preview-session', validate('json', PreviewTokenSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as PreviewTokenInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeExecutionAdapter(db, auth.user.storeId);
    return c.json(success(await service.createPreviewSession(slug, body, customUser.id, getRequestId(c))), 201);
});

// GET /themes/:slug/releases?store_id=... — List immutable release history
router.get('/:slug/releases', async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const parsed = ThemeStoreQuerySchema.safeParse({
        store_id: c.req.query('store_id'),
    });

    if (!parsed.success) {
        return c.json(
            { error: { code: 'VALIDATION_ERROR', message: 'store_id query parameter is required' } },
            400
        );
    }

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeExecutionAdapter(db, auth.user.storeId);
    return c.json(success(await service.listReleases(slug, parsed.data.store_id, customUser.id)));
});

// POST /themes/:slug/releases/:releaseId/rollback — Publish a new release from an older snapshot
router.post('/:slug/releases/:releaseId/rollback', validate('json', RollbackThemeReleaseSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const releaseId = c.req.param('releaseId');
    const body = c.get('validatedBody') as RollbackThemeReleaseInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeExecutionAdapter(db, auth.user.storeId);
    const rollback = await service.rollbackRelease(slug, releaseId, body, customUser.id, getRequestId(c));
    await purgeThemeStorefrontCache(c, body.store_id);
    return c.json(success(rollback));
});

// POST /themes/packages/upload — Validate and persist a portable theme bundle
router.post('/packages/upload', validate('json', UploadThemePackageSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as UploadThemePackageInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const registry = new SchemaRegistryExecutionAdapter(db);
    const submissionMode = body.submission_mode || 'marketplace';
    const upload = await registry.uploadThemePackageBundle(body.bundle, customUser.id, {
        publicationMode: submissionMode,
    });
    const uploadRecord = recordValue(upload);
    const theme = recordValue(uploadRecord.theme);
    const themePackage = recordValue(uploadRecord.package);
    const themePackageId = stringOrNull(themePackage.id);

    if (!themePackageId) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Theme upload did not return a package id' } }, 500);
    }

    if (submissionMode === 'private_install') {
        return c.json(success({ ...uploadRecord, review_record: null }), 201);
    }

    const reviewRecord = await createMarketplaceReviewRecord(db, {
        submissionType: 'theme',
        resourceId: themePackageId,
        resourceSlug: stringOrNull(themePackage.slug),
        resourceName: stringOrNull(themePackage.name) || stringOrNull(theme.name) || 'Theme package',
        partnerUserId: customUser.id,
        actorId: customUser.id,
        automatedChecks: buildMarketplaceAutomatedChecks({
            source: 'admin-web.theme_submission',
            checks: [
                {
                    name: 'bundle_schema_validation',
                    status: 'passed',
                    message: 'Theme bundle validated against the portable JSON-contract/Liquid schema registry.',
                },
                {
                    name: 'theme_package_persistence',
                    status: 'passed',
                    message: 'Theme package and version records were persisted successfully.',
                },
            ],
            metadata: {
                schema_manifest_version: uploadRecord.schema_manifest_version,
                renderer_version: uploadRecord.renderer_version,
            },
        }),
        metadata: {
            source_route: '/themes/packages/upload',
            schema_manifest_version: uploadRecord.schema_manifest_version,
        },
    });

    await emitThemeSubmittedEvent(db, {
        upload,
        partnerId: customUser.id,
        requestId: getRequestId(c),
        reviewId: reviewRecord.id,
    });

    return c.json(success({ ...uploadRecord, review_record: reviewRecord }), 201);
});

// GET /themes/:slug/reviews — List published reviews with rating summary
router.get('/:slug/reviews', async (c) => {
    const slug = c.req.param('slug');
    const page = integerQuery(c.req.query('page'), 1, 1, 500);
    const limit = integerQuery(c.req.query('limit'), 10, 1, 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    const { data: theme, error: themeError } = await db
        .from('themes')
        .select('id')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

    if (themeError) return c.json(dbErrorBody(), 500);
    if (!theme) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
    }

    const [{ data: reviews, error, count }, { data: summaryRows }] = await Promise.all([
        db
            .from('theme_reviews')
            .select('*', { count: 'exact' })
            .eq('theme_id', theme.id)
            .eq('status', 'published')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1),
        db
            .from('theme_reviews')
            .select('rating')
            .eq('theme_id', theme.id)
            .eq('status', 'published')
            .is('deleted_at', null),
    ]);

    if (error) return c.json(dbErrorBody(), 500);

    return c.json(success({
        reviews: reviews || [],
        summary: reviewSummary(summaryRows || []),
        pagination: {
            total: count || 0,
            page,
            limit,
        },
    }));
});

// POST /themes/:slug/reviews — Create a verified-purchase-gated pending review
router.post('/:slug/reviews', authMiddleware, validate('json', ThemeReviewCreateSchema), async (c) => {
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as ThemeReviewCreateInput;
    const db = getSupabaseAdmin(c);
    const customUser = await requireCustomUser(c);
    if (customUser instanceof Response) return customUser;

    const { data: theme, error: themeError } = await db
        .from('themes')
        .select('id')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

    if (themeError) return c.json(dbErrorBody(), 500);
    if (!theme) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
    }

    const { data: purchase } = await db
        .from('theme_purchases')
        .select('id, status')
        .eq('user_id', customUser.id)
        .eq('theme_id', theme.id)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .maybeSingle();

    if (!purchase) {
        return c.json({ error: { code: 'VERIFIED_PURCHASE_REQUIRED', message: 'Only verified purchasers can review this theme' } }, 403);
    }

    const { data: review, error } = await db
        .from('theme_reviews')
        .upsert(
            {
                user_id: customUser.id,
                theme_id: theme.id,
                purchase_id: purchase.id,
                rating: body.rating,
                title: body.title,
                content: body.content,
                is_verified_purchase: true,
                status: 'pending',
                created_by: customUser.id,
                updated_by: customUser.id,
            },
            { onConflict: 'user_id,theme_id' }
        )
        .select('*')
        .single();

    if (error || !review) return c.json(dbErrorBody(), 500);

    return c.json(success(review), 201);
});

// POST /themes/:slug/reviews/:reviewId/reply — Developer reply to a published review
router.post('/:slug/reviews/:reviewId/reply', validate('json', ThemeReviewReplySchema), async (c) => {
    const slug = c.req.param('slug');
    const reviewId = c.req.param('reviewId');
    const body = c.get('validatedBody') as ThemeReviewReplyInput;
    const db = getSupabaseAdmin(c);
    const customUser = await requireCustomUser(c);
    if (customUser instanceof Response) return customUser;

    const { data: theme, error: themeError } = await db
        .from('themes')
        .select('id, author_handle')
        .eq('slug', slug)
        .maybeSingle();

    if (themeError) return c.json(dbErrorBody(), 500);
    if (!theme) return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);

    const { data: profile } = await db
        .from('developer_profiles')
        .select('user_id')
        .eq('handle', theme.author_handle)
        .is('deleted_at', null)
        .maybeSingle();

    if (profile?.user_id !== customUser.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Only the theme author can reply to reviews' } }, 403);
    }

    const { data: review, error } = await db
        .from('theme_reviews')
        .update({
            developer_reply: body.developer_reply,
            developer_replied_at: new Date().toISOString(),
            updated_by: customUser.id,
        })
        .eq('id', reviewId)
        .eq('theme_id', theme.id)
        .is('deleted_at', null)
        .select('*')
        .single();

    if (error || !review) return c.json(dbErrorBody(), 500);
    return c.json(success(review));
});

// GET /themes/:slug/downloads/:platform — Entitlement-checked artifact metadata and signed URL when live storage is configured
router.get('/:slug/downloads/:platform', async (c) => {
    const slug = c.req.param('slug');
    const platform = c.req.param('platform');
    const db = getSupabaseAdmin(c);
    const customUser = await requireCustomUser(c);
    if (customUser instanceof Response) return customUser;

    if (!['letbuyy', 'wordpress', 'html', 'react'].includes(platform)) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Unsupported download platform' } }, 400);
    }

    const { data: theme, error: themeError } = await db
        .from('themes')
        .select('id, slug, name')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

    if (themeError) return c.json(dbErrorBody(), 500);
    if (!theme) return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);

    const { data: purchase } = await db
        .from('theme_purchases')
        .select('id')
        .eq('user_id', customUser.id)
        .eq('theme_id', theme.id)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .maybeSingle();

    if (!purchase) {
        return c.json({ error: { code: 'ENTITLEMENT_REQUIRED', message: 'A completed theme purchase is required for downloads' } }, 403);
    }

    const { data: artifact, error } = await db
        .from('theme_download_artifacts')
        .select('*')
        .eq('theme_id', theme.id)
        .eq('platform', platform)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) return c.json(dbErrorBody(), 500);
    if (!artifact) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Download artifact not found' } }, 404);
    }

    const artifactRecord = artifact as Record<string, unknown>;
    const content = localThemeArtifactContent(theme, platform, artifactRecord);
    const sizeBytes = typeof artifactRecord.size_bytes === 'number'
        ? artifactRecord.size_bytes
        : localThemeArtifactSizeBytes(content);

    return c.json(success({
        ...artifactRecord,
        size_bytes: sizeBytes,
        delivery_status: artifactRecord.delivery_status === 'disabled' ? 'disabled' : 'available',
        storage_provider: artifactRecord.storage_provider || 'local-object-store',
        signed_url: artifactRecord.delivery_status === 'disabled' ? null : localThemeArtifactSignedUrl(content),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        live_storage_status: 'local_object_store',
    }));
});

// POST /themes/:slug/reports — Report a theme problem or abuse concern
router.post('/:slug/reports', validate('json', ThemeReportSchema), async (c) => {
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as ThemeReportInput;
    const db = getSupabaseAdmin(c);
    const customUser = await requireCustomUser(c);
    if (customUser instanceof Response) return customUser;

    const { data: theme } = await db
        .from('themes')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

    if (!theme) return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);

    const { data, error } = await db
        .from('theme_reports')
        .insert({
            theme_id: theme.id,
            reporter_user_id: customUser.id,
            reason: body.reason,
            details: body.details || null,
            created_by: customUser.id,
            updated_by: customUser.id,
        })
        .select('*')
        .single();

    if (error || !data) return c.json(dbErrorBody(), 500);
    return c.json(success(data), 201);
});

// POST /themes/:slug/refunds — Request a theme purchase refund locally; provider execution is live-gated
router.post('/:slug/refunds', validate('json', ThemeRefundRequestSchema), async (c) => {
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as ThemeRefundRequestInput;
    const db = getSupabaseAdmin(c);
    const customUser = await requireCustomUser(c);
    if (customUser instanceof Response) return customUser;

    const { data: purchase } = await db
        .from('theme_purchases')
        .select('*, themes(slug)')
        .eq('id', body.purchase_id)
        .eq('user_id', customUser.id)
        .is('deleted_at', null)
        .maybeSingle();

    if (!purchase || recordValue(purchase.themes).slug !== slug) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme purchase not found' } }, 404);
    }

    const { data, error } = await db
        .from('theme_refund_requests')
        .insert({
            purchase_id: purchase.id,
            user_id: customUser.id,
            reason: body.reason || null,
            requested_amount_inr: Number(purchase.price_paid_inr || 0),
            status: 'requested',
            created_by: customUser.id,
            updated_by: customUser.id,
        })
        .select('*')
        .single();

    if (error || !data) return c.json(dbErrorBody(), 500);
    return c.json(success(data), 201);
});

// ─── Phase Q: Theme Library Management Routes ────────────────────────────────
mountThemeLibraryRoutes(router);
// ─── End Phase Q routes ───────────────────────────────────────────────────────

// POST /themes/:slug/validate — Validate a ThemeDocument V2 + optional Liquid bundle (no DB writes)
// Auth: ES256 merchant session -> resolveCustomUser -> verifyStoreOwner inside adapter.
// Must be registered BEFORE the GET /:slug catch-all to prevent route shadowing.
router.post('/:slug/validate', validate('json', ValidateThemeDocumentSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as ValidateThemeDocumentInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    const service = new ThemeExecutionAdapter(db);
    const result = await service.validateDocument(slug, body, customUser.id);
    return c.json(success(result));
});

// GET /themes/:slug — Get theme details by slug
router.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('themes')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
    }

    // Fetch reviews
    const { data: reviews } = await db
        .from('theme_reviews')
        .select('*')
        .eq('theme_id', data.id)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

    const { data: summaryRows } = await db
        .from('theme_reviews')
        .select('rating')
        .eq('theme_id', data.id)
        .eq('status', 'published')
        .is('deleted_at', null);

    return c.json(success({ ...data, reviews: reviews || [], reviews_summary: reviewSummary(summaryRows || []) }));
});

// POST /themes/:slug/install — Install/apply a theme to a store
router.post('/:slug/install', validate('json', InstallThemeSchema), async (c) => {
    const auth = c.get('auth');
    const slug = c.req.param('slug');
    const body = c.get('validatedBody') as InstallThemeInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const service = new ThemeExecutionAdapter(db);
    return c.json(success(await service.installTheme(slug, body, customUser.id, getRequestId(c))), 201);
});

// ─── Theme Purchase & Receipt Routes ─────────────────────────────────────────
mountThemePurchaseRoutes(router);

export default router;
