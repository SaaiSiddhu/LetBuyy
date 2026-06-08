import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { CreateStoreSchema, PaymentConfigSchema, UpdateStoreSchema } from '../schemas/store.schema';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { readCustomDomainHealth } from '../lib/custom-domain-health';
import { getRequestId } from '../lib/tenant-context';
import { healthPillar, type StoreHealthPillar } from '../lib/store-health';
import {
    defaultPaymentConfig,
    encryptPaymentSecret,
    isMissingSitesPaymentColumnError,
    sanitizePaymentSettings,
    verifyRazorpayCredentials,
    type PaymentSettings,
} from '../lib/store-payment-config';
import { isComingSoonSiteType, isLegacySiteType, legacySiteTypeCreationEnabled } from '@letbuyy/tenant-core';
import type { CustomDomainHealth } from '@letbuyy/shared-types';
import { registerStoreLocalizationRoutes } from './stores-localization';

const router = new Hono<{ Bindings: Env }>();
registerStoreLocalizationRoutes(router);

async function emitStoreCreatedEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        store: { id?: string; subdomain?: string | null; store_name?: string | null; plan?: string | null };
        ownerUserId: string;
        requestId: string;
    },
): Promise<void> {
    if (!input.store.id) return;

    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.store.id,
        aggregateType: 'store',
        aggregateId: input.store.id,
        eventType: 'store.created',
        payload: {
            site_id: input.store.id,
            store_slug: input.store.subdomain || input.store.store_name || input.store.id,
            owner_user_id: input.ownerUserId,
            plan_code: input.store.plan || undefined,
        },
        idempotencyKey: `store.created:${input.store.id}`,
        requestId: input.requestId,
        actorId: input.ownerUserId,
    });
}

function isMissingDeletedAtError(error: { message?: string } | null | undefined): boolean {
    return Boolean(error?.message?.includes('sites.deleted_at') && error.message.includes('does not exist'));
}

function legacySiteTypeCreationAllowed(env: Env): boolean {
    return legacySiteTypeCreationEnabled(env.LETBUYY_ENABLE_LEGACY_SITE_TYPES);
}

function legacySiteTypeCreationResponse(siteType: string) {
    return {
        error: {
            code: 'LEGACY_SITE_TYPE_DISABLED',
            message: `${siteType} site creation is legacy-gated. Existing sites remain supported, but new portfolio/resume acquisition requires LETBUYY_ENABLE_LEGACY_SITE_TYPES=true.`,
        },
    };
}

function comingSoonSiteTypeCreationResponse(siteType: string) {
    return {
        error: {
            code: 'SITE_TYPE_COMING_SOON',
            message: `${siteType} site creation is coming soon. Online Store is available today.`,
        },
    };
}

function safeCount(result: { count?: number | null; error?: { message?: string } | null }): number | null {
    if (result.error) return null;
    return result.count ?? 0;
}

// GET /stores/:id/payment-config — Return masked tenant payment config
router.get('/:id/payment-config', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildPaymentQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id, payment_settings, online_payment_enabled, cod_enabled')
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildPaymentQuery(true).single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildPaymentQuery(false).single());
    }

    if (isMissingSitesPaymentColumnError(error)) {
        const buildOwnershipQuery = (includeDeletedAtFilter: boolean) => {
            const query = db
                .from('sites')
                .select('id')
                .eq('id', storeId)
                .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

            return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
        };

        let ownershipResult = await buildOwnershipQuery(true).single();
        if (isMissingDeletedAtError(ownershipResult.error)) {
            ownershipResult = await buildOwnershipQuery(false).single();
        }

        if (ownershipResult.error || !ownershipResult.data) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
        }

        return c.json(success(defaultPaymentConfig(storeId)));
    }

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success({
        store_id: data.id,
        online_payment_enabled: data.online_payment_enabled !== false,
        cod_enabled: data.cod_enabled !== false,
        payment_settings: sanitizePaymentSettings(data.payment_settings as PaymentSettings | null),
    }));
});

// GET /stores/:id/health — Mobile Store Health score from real operational signals
router.get('/:id/health', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildStoreQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id,name,store_name,status,published_at,subdomain,custom_domain,custom_domain_status,custom_domain_verification_token,logo_url')
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: store, error: storeError } = await buildStoreQuery(true).single();
    if (isMissingDeletedAtError(storeError)) {
        ({ data: store, error: storeError } = await buildStoreQuery(false).single());
    }

    if (storeError || !store) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    const [
        productResult,
        lowStockResult,
        orderResult,
        openOrderResult,
        pendingReviewResult,
    ] = await Promise.all([
        db.from('products').select('id', { count: 'exact', head: true }).eq('store_id', storeId).is('deleted_at', null),
        db.from('products').select('id', { count: 'exact', head: true }).eq('store_id', storeId).lte('stock', 0).is('deleted_at', null),
        db.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', storeId).is('deleted_at', null),
        db.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', storeId).in('status', ['pending', 'pending_cod', 'confirmed', 'processing']).is('deleted_at', null),
        db.from('product_reviews').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('status', 'pending').is('deleted_at', null),
    ]);

    const productCount = safeCount(productResult);
    const lowStockCount = safeCount(lowStockResult);
    const orderCount = safeCount(orderResult);
    const openOrderCount = safeCount(openOrderResult);
    const pendingReviewCount = safeCount(pendingReviewResult);
    const storeRecord = store as Record<string, unknown>;
    const status = String(storeRecord.status || 'draft');
    const isPublished = status === 'published' || Boolean(storeRecord.published_at);
    const hasSubdomain = typeof storeRecord.subdomain === 'string' && storeRecord.subdomain.length > 0;
    const customDomain = typeof storeRecord.custom_domain === 'string' ? storeRecord.custom_domain : '';
    const customDomainStatus = typeof storeRecord.custom_domain_status === 'string'
        ? storeRecord.custom_domain_status
        : 'none';
    const customDomainVerificationToken = typeof storeRecord.custom_domain_verification_token === 'string'
        ? storeRecord.custom_domain_verification_token
        : null;
    const hasLogo = typeof storeRecord.logo_url === 'string' && storeRecord.logo_url.length > 0;
    let domainHealth: CustomDomainHealth | null = null;
    if (customDomain) {
        try {
            domainHealth = await readCustomDomainHealth(c.env, {
                siteId: storeId,
                domain: customDomain,
                status: customDomainStatus,
                verificationToken: customDomainVerificationToken,
            });
        } catch {
            domainHealth = null;
        }
    }
    const domainStatus = domainHealth?.status ?? customDomainStatus;
    const domainDnsReady = domainHealth ? domainHealth.txt_verified && domainHealth.cname_verified : domainStatus === 'active';
    const domainSslReady = domainHealth ? domainHealth.ssl_active : domainStatus === 'active';
    const domainNeedsProvider = domainHealth?.provider_status === 'unavailable';
    const domainScore = customDomain
        ? domainDnsReady && domainSslReady
            ? 100
            : domainDnsReady
                ? 72
                : 58
        : hasSubdomain ? 78 : 30;
    const domainSummary = customDomain
        ? domainDnsReady && domainSslReady
            ? 'Custom domain DNS and SSL are healthy.'
            : domainNeedsProvider
                ? 'Custom domain DNS can be checked; SSL status is temporarily unavailable.'
                : domainDnsReady
                    ? 'DNS is connected; SSL or provider configuration still needs verification.'
                    : 'Custom domain needs DNS verification.'
        : hasSubdomain ? 'LetBuyy subdomain is ready; add a custom domain when needed.' : 'Set up a storefront domain.';

    const pillars: StoreHealthPillar[] = [
        healthPillar({
            id: 'launch',
            label: 'Launch readiness',
            score: isPublished ? (hasLogo ? 100 : 88) : 45,
            summary: isPublished
                ? hasLogo ? 'Store is published with visible branding.' : 'Store is published; add a logo to improve trust.'
                : 'Publish the store when setup is complete.',
            action_label: isPublished && hasLogo ? null : 'Open store details',
            route: '/store-details',
            metrics: { status, has_logo: hasLogo },
        }),
        productCount === null ? healthPillar({
            id: 'catalog',
            label: 'Catalog and inventory',
            score: 0,
            status: 'unknown',
            summary: 'Catalog signal is not available in this environment.',
            action_label: 'Open products',
            route: '/products',
        }) : healthPillar({
            id: 'catalog',
            label: 'Catalog and inventory',
            score: productCount === 0 ? 35 : lowStockCount && lowStockCount > 0 ? 72 : 100,
            summary: productCount === 0
                ? 'Add the first product before launch.'
                : lowStockCount && lowStockCount > 0
                    ? `${lowStockCount} product${lowStockCount === 1 ? '' : 's'} need inventory attention.`
                    : 'Products are present and inventory has no zero-stock signal.',
            action_label: productCount === 0 || (lowStockCount && lowStockCount > 0) ? 'Open products' : null,
            route: '/products',
            metrics: { product_count: productCount, low_stock_count: lowStockCount || 0 },
        }),
        orderCount === null ? healthPillar({
            id: 'orders',
            label: 'Orders',
            score: 0,
            status: 'unknown',
            summary: 'Order signal is not available in this environment.',
            action_label: 'Open orders',
            route: '/orders',
        }) : healthPillar({
            id: 'orders',
            label: 'Orders',
            score: orderCount > 0 ? 100 : 70,
            summary: openOrderCount && openOrderCount > 0
                ? `${openOrderCount} open order${openOrderCount === 1 ? '' : 's'} need action.`
                : orderCount > 0 ? 'Orders are flowing with no open action signal.' : 'Orders will appear here after checkout activity.',
            action_label: openOrderCount && openOrderCount > 0 ? 'Open orders' : null,
            route: '/orders',
            metrics: { order_count: orderCount, open_order_count: openOrderCount || 0 },
        }),
        healthPillar({
            id: 'domain',
            label: 'Domain',
            score: domainScore,
            summary: domainSummary,
            action_label: customDomain && domainDnsReady && domainSslReady ? null : 'Open domain settings',
            route: '/domain-settings',
            metrics: {
                custom_domain: customDomain || null,
                custom_domain_status: domainStatus,
                dns_verified: domainDnsReady,
                ssl_active: domainSslReady,
                renewal_status: domainHealth?.renewal_status ?? null,
                renewal_date: domainHealth?.renewal_date ?? null,
            },
        }),
        pendingReviewCount === null ? healthPillar({
            id: 'reviews',
            label: 'Reviews',
            score: 0,
            status: 'unknown',
            summary: 'Review moderation signal is not available in this environment.',
            action_label: 'Open reviews',
            route: '/reviews',
        }) : healthPillar({
            id: 'reviews',
            label: 'Reviews',
            score: pendingReviewCount > 0 ? 64 : 95,
            summary: pendingReviewCount > 0
                ? `${pendingReviewCount} review${pendingReviewCount === 1 ? '' : 's'} awaiting moderation.`
                : 'No pending review moderation.',
            action_label: pendingReviewCount > 0 ? 'Open reviews' : null,
            route: '/reviews',
            metrics: { pending_review_count: pendingReviewCount },
        }),
    ];

    const scored = pillars.filter((pillar) => pillar.status !== 'unknown');
    const score = scored.length === 0
        ? 0
        : Math.round(scored.reduce((total, pillar) => total + pillar.score, 0) / scored.length);

    return c.json(success({
        store_id: storeId,
        score,
        generated_at: new Date().toISOString(),
        pillars,
        metadata: {
            source: 'api-gateway.stores.health',
        },
    }));
});

// POST /stores/:id/payment-config — Save seller-owned Razorpay credentials
router.post('/:id/payment-config', validate('json', PaymentConfigSchema), async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const body = c.get('validatedBody') as {
        key_id: string;
        key_secret: string;
        test_mode: boolean;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (!c.env.PAYMENT_CONFIG_ENCRYPTION_KEY) {
        return c.json(
            {
                error: {
                    code: 'PAYMENT_CONFIG_UNAVAILABLE',
                    message: 'Payment credential encryption is not configured',
                },
            },
            503
        );
    }

    const buildPaymentQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id, payment_settings, cod_enabled')
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: store, error: storeError } = await buildPaymentQuery(true).single();

    if (isMissingDeletedAtError(storeError)) {
        ({ data: store, error: storeError } = await buildPaymentQuery(false).single());
    }

    if (isMissingSitesPaymentColumnError(storeError)) {
        return c.json(
            {
                error: {
                    code: 'PAYMENT_SCHEMA_MISSING',
                    message: 'Payment settings require the latest sites payment columns before credentials can be saved',
                },
            },
            503
        );
    }

    if (storeError || !store) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    const keySecretCiphertext = await encryptPaymentSecret(
        body.key_secret,
        c.env.PAYMENT_CONFIG_ENCRYPTION_KEY
    );

    let verified = false;
    try {
        verified = await verifyRazorpayCredentials(body.key_id, body.key_secret);
    } catch {
        verified = false;
    }

    const now = new Date().toISOString();
    const existingSettings = (store.payment_settings || {}) as PaymentSettings;
    const paymentSettings: PaymentSettings = {
        ...existingSettings,
        mode: 'ownAccount',
        gateways: Array.from(new Set([...(existingSettings.gateways || []), 'razorpay'])),
        razorpay: {
            key_id: body.key_id,
            key_secret_ciphertext: keySecretCiphertext,
            test_mode: body.test_mode,
            verified,
            connected_at: existingSettings.razorpay?.connected_at || now,
            updated_at: now,
        },
    };

    const updatePaymentSettings = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .update({
                payment_settings: paymentSettings,
                online_payment_enabled: true,
                cod_enabled: store.cod_enabled !== false,
                updated_at: now,
            })
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await updatePaymentSettings(true)
        .select('id, payment_settings, online_payment_enabled, cod_enabled')
        .single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await updatePaymentSettings(false)
            .select('id, payment_settings, online_payment_enabled, cod_enabled')
            .single());
    }

    if (isMissingSitesPaymentColumnError(error)) {
        return c.json(
            {
                error: {
                    code: 'PAYMENT_SCHEMA_MISSING',
                    message: 'Payment settings require the latest sites payment columns before credentials can be saved',
                },
            },
            503
        );
    }

    if (error || !data) {
        return c.json({ error: { code: 'DB_ERROR', message: error?.message || 'Unable to save payment config' } }, 500);
    }

    return c.json(success({
        store_id: data.id,
        online_payment_enabled: data.online_payment_enabled !== false,
        cod_enabled: data.cod_enabled !== false,
        payment_settings: sanitizePaymentSettings(data.payment_settings as PaymentSettings | null),
    }));
});

// GET /stores — List all stores for the authenticated user
router.get('/', async (c) => {
    const auth = c.get('auth');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    const offset = (page - 1) * limit;

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildListQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('*', { count: 'exact' })
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`)
            .order('created_at', { ascending: false });

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error, count } = await buildListQuery(true).range(offset, offset + limit - 1);

    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildListQuery(false).range(offset, offset + limit - 1));
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /stores/public/:subdomain — Public store data (no auth required)
router.get('/public/:subdomain', async (c) => {
    const subdomain = c.req.param('subdomain');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('sites')
        .select(
            'id, name, subdomain, tagline, logo_url, custom_domain, site_type, currency, locale, theme_id, template_config, description, published_at'
        )
        .eq('subdomain', subdomain)
        .eq('status', 'published')
        .is('deleted_at', null)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success(data));
});

// GET /stores/handle/:handle — Resolve an owned store by admin URL handle
router.get('/handle/:handle', async (c) => {
    const auth = c.get('auth');
    const handle = c.req.param('handle').toLowerCase().trim();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildHandleQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id, name, store_name, subdomain, site_type, status, custom_user_id, trial_ends_at, trial_status, theme_id, theme_settings, custom_domain')
            .or(`store_name.eq.${handle},subdomain.eq.${handle}`)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildHandleQuery(true).maybeSingle();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildHandleQuery(false).maybeSingle());
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    if (!data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success(data));
});

// GET /stores/:id — Get a specific store
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const buildStoreQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('*')
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildStoreQuery(true).single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildStoreQuery(false).single());
    }

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success(data));
});

// POST /stores — Create a new store
// FIX: Uses Zod validation with reserved subdomain blocking
router.post('/', validate('json', CreateStoreSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as {
        name: string; subdomain: string; site_type: string;
        tagline?: string; locale?: string; theme_id: string; template_config: Record<string, unknown>;
    };
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (isComingSoonSiteType(body.site_type)) {
        return c.json(comingSoonSiteTypeCreationResponse(body.site_type), 403);
    }

    if (isLegacySiteType(body.site_type) && !legacySiteTypeCreationAllowed(c.env)) {
        return c.json(legacySiteTypeCreationResponse(body.site_type), 403);
    }

    // Check subdomain uniqueness
    const { data: existing } = await db
        .from('sites')
        .select('id')
        .or(`subdomain.eq.${body.subdomain},store_name.eq.${body.subdomain}`)
        .limit(1);

    if (existing && existing.length > 0) {
        return c.json({ error: { code: 'CONFLICT', message: 'Subdomain already taken' } }, 409);
    }

    const { data, error } = await db
        .from('sites')
        .insert({
            custom_user_id: customUser.id,
            name: body.name,
            store_name: body.subdomain,
            subdomain: body.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            site_type: body.site_type,
            status: 'draft',
            tagline: body.tagline || null,
            locale: body.locale || 'en-IN',
            theme_id: body.theme_id,
            template_config: body.template_config,
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    await emitStoreCreatedEvent(db, {
        store: data,
        ownerUserId: customUser.id,
        requestId: getRequestId(c),
    });

    return c.json(success(data), 201);
});

// PATCH /stores/:id — Update a store
router.patch('/:id', validate('json', UpdateStoreSchema), async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const body = c.get('validatedBody') as Record<string, unknown>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    // Filter to only accepted fields (schema already validates)
    const updates: Record<string, unknown> = {};
    const allowed = [
        'name', 'description', 'tagline', 'status', 'theme_id', 'template_config',
        'site_settings', 'logo_url', 'custom_domain', 'currency', 'locale',
        'refund_policy', 'privacy_policy', 'terms_of_service', 'shipping_policy',
        'seo_title', 'seo_description',
        'tax_inclusive',
        'legal_name', 'gstin', 'gst_state_code', 'invoice_prefix',
        'business_profile', 'invoice_address', 'invoice_footer', 'invoice_number_next',
    ];
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    // Publish timestamp
    if (updates.status === 'published') {
        updates.published_at = new Date().toISOString();
    }

    const updateStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .update(updates)
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await updateStore(true)
        .select()
        .single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await updateStore(false)
            .select()
            .single());
    }

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// POST /stores/:id/publish — Publish a store
router.post('/:id/publish', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const publishUpdates = {
        status: 'published',
        published_at: new Date().toISOString(),
    };
    const publishStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .update(publishUpdates)
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await publishStore(true)
        .select()
        .single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await publishStore(false)
            .select()
            .single());
    }

    if (error || !data) {
        return c.json(
            { error: { code: 'NOT_FOUND', message: 'Store not found or not owned by you' } },
            404
        );
    }

    return c.json(success(data));
});

// DELETE /stores/:id — Soft delete with deleted_at timestamp
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { error } = await db
        .from('sites')
        .update({
            status: 'suspended',
            deleted_at: new Date().toISOString(),
        })
        .eq('id', storeId)
        .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
