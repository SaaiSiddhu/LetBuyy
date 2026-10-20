import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { CreateStoreSchema, PaymentConfigSchema, UpdateStoreSchema } from '../schemas/store.schema';
import { resolveExperienceForIndustry, applyExperienceToTemplateConfig, LETBUYY_CORE_THEME_SLUG } from '@letbuyy/theme-engine';
import { ThemeExecutionAdapter } from '../execution/theme-execution.adapter';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { readCustomDomainHealth } from '../lib/custom-domain-health';
import { getRequestId } from '../lib/tenant-context';
import { healthPillar, type StoreHealthPillar } from '../lib/store-health';
import {
    defaultPaymentConfig,
    encryptPaymentSecret,
    isMissingSitesPaymentColumnError,
    paymentConfigProviderMode,
    sanitizePaymentSettings,
    verifyRazorpayCredentials,
    type PaymentSettings,
} from '../lib/store-payment-config';
import { isComingSoonSiteType, isLegacySiteType, legacySiteTypeCreationEnabled } from '@letbuyy/tenant-core';
import type { CustomDomainHealth } from '@letbuyy/shared-types';
import { registerStoreLocalizationRoutes } from './stores-localization';
import { canonicalizeExecutionPayload } from '@letbuyy/event-core';
import { z } from 'zod';
import { AppError, ValidationError } from '../lib/errors';

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

async function storeCreationRequestHash(input: unknown): Promise<string> {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(canonicalizeExecutionPayload(input)),
    );
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function storeCreationIdempotencyKey(c: { req: { header: (name: string) => string | undefined } }): {
    key: string | null;
    error: 'conflicting_headers' | 'invalid_length' | null;
} {
    const primary = c.req.header('X-Idempotency-Key')?.trim() || null;
    const alternate = c.req.header('Idempotency-Key')?.trim() || null;
    if (primary && alternate && primary !== alternate) {
        return { key: null, error: 'conflicting_headers' };
    }
    const key = primary || alternate;
    if (key && (key.length < 8 || key.length > 200)) {
        return { key: null, error: 'invalid_length' };
    }
    return { key, error: null };
}

async function lookupStoreCreationReplay(
    db: ReturnType<typeof getSupabaseAdmin>,
    customUserId: string,
    key: string,
) {
    return db
        .from('sites')
        .select('*')
        .eq('custom_user_id', customUserId)
        .eq('store_creation_idempotency_key', key)
        .is('deleted_at', null)
        .maybeSingle();
}

function isUniqueViolation(error: { code?: string | null } | null): boolean {
    return error?.code === '23505';
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
            message: `${siteType} site creation is not enabled for publication. Online Store is available today.`,
        },
    };
}

function safeCount(result: { count?: number | null; error?: { message?: string } | null }): number | null {
    if (result.error) return null;
    return result.count ?? 0;
}

// Ownership is a genuine two-column disjunction — custom_user_id is the current owner column and
// user_id the legacy one — so it cannot collapse into a single .eq() the way a canonical handle
// lookup can. PostgREST .or() takes a RAW filter string and postgrest-js does not quote reserved
// characters inside it, so an interpolated value carrying a comma or parenthesis rewrites the
// predicate instead of being compared against it. A users_custom.id is a uuid and cannot carry one
// today, but a filter that is safe only because of where its value happens to come from is one
// refactor away from being unsafe. Double-quoting keeps the value a single literal term whatever it
// contains (PostgREST escapes an embedded quote with a backslash).
function ownedByCustomUserFilter(customUserId: string): string {
    const value = `"${customUserId.replace(/["\\]/g, '\\$&')}"`;
    return `custom_user_id.eq.${value},user_id.eq.${value}`;
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
            .or(ownedByCustomUserFilter(customUser.id));

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
                .or(ownedByCustomUserFilter(customUser.id));

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
        provider_mode: paymentConfigProviderMode({
            onlinePaymentEnabled: data.online_payment_enabled !== false,
            settings: data.payment_settings as PaymentSettings | null,
        }),
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
            .or(ownedByCustomUserFilter(customUser.id));

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
                ? 'Add the first product before publication.'
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
            .or(ownedByCustomUserFilter(customUser.id));

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
            .or(ownedByCustomUserFilter(customUser.id));

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
        provider_mode: paymentConfigProviderMode({
            onlinePaymentEnabled: data.online_payment_enabled !== false,
            settings: data.payment_settings as PaymentSettings | null,
        }),
        payment_settings: sanitizePaymentSettings(data.payment_settings as PaymentSettings | null),
    }));
});

// GET /stores — List all stores for the authenticated user
router.get('/', async (c) => {
    const auth = c.get('auth');
    const parsed = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(10) }).safeParse(c.req.query());
    if (!parsed.success) throw new ValidationError('Invalid store list pagination.');
    const { page, limit } = parsed.data;

    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    // One database snapshot joins ownership and active staff membership, so
    // counts/pagination cannot omit staff stores or duplicate an owned store.
    // The actor ID comes only from the current canonical account, never query.
    const { data, error } = await db.rpc('list_merchant_accessible_sites_v1', { p_actor_id: customUser.id, p_page: page, p_limit: limit, p_site_id: auth.user.storeId || null });
    if (error || !data || !Array.isArray(data.items) || !Number.isSafeInteger(data.total)) {
        throw new AppError('The store list is temporarily unavailable. Retry this request.', 503, 'STORE_LIST_UNAVAILABLE');
    }
    return c.json(paginated(data.items, data.total, page, limit));
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

    // The admin URL handle is canonically sites.subdomain: every producer of the merchant `[store]`
    // segment emits store.subdomain (store picker, header switcher, post-login redirect), and the
    // theme-editor `store_name` query param carries that same segment. subdomain is NOT NULL and
    // UNIQUE, so this equality is single-valued. Matching store_name as well was not: the two
    // columns are unique only within themselves, so a single handle can select two owned rows and
    // maybeSingle() then fails the request rather than resolving it. It was also unsafe — .or()
    // takes a raw PostgREST filter string, so a handle carrying a comma or parenthesis rewrote the
    // predicate; .eq() is parameter-encoded, so the handle can only ever be a value.
    const buildHandleQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('sites')
            .select('id, name, store_name, subdomain, site_type, status, custom_user_id, trial_ends_at, trial_status, theme_id, theme_settings, custom_domain, custom_domain_status')
            .eq('subdomain', handle)
            .or(ownedByCustomUserFilter(customUser.id));

        if (auth.user.storeId) query = query.eq('id', auth.user.storeId);
        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildHandleQuery(true).maybeSingle();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildHandleQuery(false).maybeSingle());
    }

    if (error) {
        throw new AppError('The store is temporarily unavailable.', 503, 'STORE_STATE_UNAVAILABLE');
    }

    // Phase 2 / F2.5: this ownership-only query is the one gate merchant-web's [store]/layout.tsx
    // calls for every page under /[store]/* (getStoreForUser -> stores.getByHandle). Without a
    // staff fallback, a correctly-provisioned active employees row (staff-permission.ts's own
    // "owner OR active employees row" model) can never reach any store page -- not because a
    // specific action is denied, but because the store shell itself 404s before any per-route
    // permission check runs. Mirrors ownsStore()'s pattern: existence only, no permission key --
    // per-action authorization still runs at each route via assertStaffPermission.
    if (!data) {
        let siteQuery = db
            .from('sites')
            .select('id, name, store_name, subdomain, site_type, status, custom_user_id, trial_ends_at, trial_status, theme_id, theme_settings, custom_domain, custom_domain_status')
            .eq('subdomain', handle)
            .is('deleted_at', null);
        if (auth.user.storeId) siteQuery = siteQuery.eq('id', auth.user.storeId);
        const { data: site, error: siteError } = await siteQuery.maybeSingle();

        if (siteError) {
            throw new AppError('The store is temporarily unavailable.', 503, 'STORE_STATE_UNAVAILABLE');
        }

        if (site) {
            const { data: membership, error: membershipError } = await db
                .from('employees')
                .select('id')
                .eq('store_id', site.id)
                .eq('user_id', customUser.id)
                .eq('status', 'active')
                .eq('is_active', true)
                .is('deleted_at', null)
                .maybeSingle();

            if (membershipError) {
                throw new AppError('The store is temporarily unavailable.', 503, 'STORE_STATE_UNAVAILABLE');
            }

            if (membership) {
                data = site;
            }
        }
    }

    if (data && auth.user.storeId && data.id !== auth.user.storeId) data = null;
    if (!data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    return c.json(success(data));
});

// GET /stores/:id — Get a specific store
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.param('id');
    if (!z.string().uuid().safeParse(storeId).success || (auth.user.storeId && auth.user.storeId !== storeId)) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }
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
            .or(ownedByCustomUserFilter(customUser.id));

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data, error } = await buildStoreQuery(true).single();

    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildStoreQuery(false).single());
    }

    if (error && error.code !== 'PGRST116') throw new AppError('The store is temporarily unavailable.',503,'STORE_UNAVAILABLE');
    if (!data) {
        const result = await db.rpc('list_merchant_accessible_sites_v1', { p_actor_id: customUser.id, p_page: 1, p_limit: 1, p_site_id: storeId });
        if (result.error || !result.data || !Array.isArray(result.data.items)) throw new AppError('The store is temporarily unavailable.',503,'STORE_UNAVAILABLE');
        if (!result.data.items.length) return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } },404);
        return c.json(success(result.data.items[0]));
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

    if (customUser.email_verified !== true) {
        return c.json({
            error: {
                code: 'EMAIL_VERIFICATION_REQUIRED',
                message: 'Verify your account email before creating a storefront.',
            },
        }, 403);
    }

    if (isComingSoonSiteType(body.site_type)) {
        return c.json(comingSoonSiteTypeCreationResponse(body.site_type), 403);
    }

    if (isLegacySiteType(body.site_type) && !legacySiteTypeCreationAllowed(c.env)) {
        return c.json(legacySiteTypeCreationResponse(body.site_type), 403);
    }

    const idempotency = storeCreationIdempotencyKey(c);
    if (idempotency.error) {
        return c.json({
            error: {
                code: idempotency.error === 'conflicting_headers'
                    ? 'IDEMPOTENCY_KEY_CONFLICT'
                    : 'IDEMPOTENCY_KEY_INVALID',
                message: idempotency.error === 'conflicting_headers'
                    ? 'Idempotency headers must match.'
                    : 'Idempotency key must be 8-200 characters.',
            },
        }, 400);
    }
    const idempotencyKey = idempotency.key;
    const requestHash = idempotencyKey
        ? await storeCreationRequestHash({
            name: body.name,
            subdomain: body.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            site_type: body.site_type,
            tagline: body.tagline ?? null,
            locale: body.locale ?? null,
            theme_id: body.theme_id,
            template_config: body.template_config ?? {},
        })
        : null;

    const replayStore = async (store: Record<string, any>) => {
        if (store.store_creation_request_hash !== requestHash) {
            return c.json({
                error: {
                    code: 'IDEMPOTENCY_KEY_CONFLICT',
                    message: 'Idempotency key was already used with a different store request.',
                },
            }, 409);
        }
        await emitStoreCreatedEvent(db, {
            store,
            ownerUserId: customUser.id,
            requestId: getRequestId(c),
        });
        c.header('X-Idempotent-Replay', 'true');
        return c.json(success(store), 201);
    };

    if (idempotencyKey) {
        const { data: priorStore, error: replayLookupError } = await lookupStoreCreationReplay(
            db,
            customUser.id,
            idempotencyKey,
        );
        if (replayLookupError) {
            return c.json({
                error: { code: 'IDEMPOTENCY_LOOKUP_UNAVAILABLE', message: 'Store creation could not be safely retried.' },
            }, 503);
        }
        if (priorStore) return replayStore(priorStore);
    }

    // Check subdomain uniqueness. Both handle columns carry their own UNIQUE constraint
    // (sites_subdomain_key, sites_store_name_key) and the insert below writes this value to both, so
    // each column is probed on its own: a single .or() across the two would hand a caller-supplied
    // value to a raw PostgREST filter string, and each equality here is single-valued anyway. Soft
    // deletes are deliberately not excluded — the UNIQUE indexes are unconditional, so a deleted
    // site still holds its handle.
    const probeHandleTaken = (column: 'subdomain' | 'store_name') =>
        db.from('sites').select('id').eq(column, body.subdomain).maybeSingle();

    const [subdomainProbe, storeNameProbe] = await Promise.all([
        probeHandleTaken('subdomain'),
        probeHandleTaken('store_name'),
    ]);

    // SEC-R1 fail-closed: a uniqueness check that could not run has not proved the handle is free.
    // Falling through would let the insert race the UNIQUE index and surface as an opaque 500.
    if (subdomainProbe.error || storeNameProbe.error) {
        return c.json(
            {
                error: {
                    code: 'SUBDOMAIN_CHECK_UNAVAILABLE',
                    message: 'Subdomain availability could not be verified. Please retry.',
                },
            },
            503
        );
    }

    if (subdomainProbe.data || storeNameProbe.data) {
        return c.json({ error: { code: 'CONFLICT', message: 'Subdomain already taken' } }, 409);
    }

    // Phase-2.5 Stream C — server-authoritative Experience auto-apply. When onboarding captured an
    // industry (template_config.survey.industry) or an explicit experienceId, resolve the recommended
    // Experience and merge its tokens into template_config so the new store opens already styled. The
    // merchant can re-pick later in the editor's Experiences tab. Additive: no industry => unchanged
    // template_config (no behaviour change for other callers). Unknown industry => Summit fallback.
    let templateConfig = (body.template_config ?? {}) as Record<string, unknown>;
    if (body.theme_id === LETBUYY_CORE_THEME_SLUG) {
        templateConfig = await new ThemeExecutionAdapter(db).prepareCoreStoreTemplate(templateConfig);
    }
    const surveyRecord = templateConfig.survey && typeof templateConfig.survey === 'object'
        ? (templateConfig.survey as Record<string, unknown>)
        : undefined;
    const industryHint = (typeof templateConfig.industry === 'string' && templateConfig.industry)
        || (surveyRecord && typeof surveyRecord.industry === 'string' ? surveyRecord.industry : '')
        || '';
    const experienceOverride = typeof templateConfig.experienceId === 'string' ? templateConfig.experienceId : undefined;
    if (industryHint || experienceOverride) {
        const { experience } = resolveExperienceForIndustry(industryHint || null, experienceOverride);
        templateConfig = applyExperienceToTemplateConfig(templateConfig, experience);
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
            template_config: templateConfig,
            ...(idempotencyKey && requestHash
                ? {
                    store_creation_idempotency_key: idempotencyKey,
                    store_creation_request_hash: requestHash,
                }
                : {}),
        })
        .select()
        .single();

    if (error) {
        if (isUniqueViolation(error) && idempotencyKey) {
            const { data: priorStore, error: replayLookupError } = await lookupStoreCreationReplay(
                db,
                customUser.id,
                idempotencyKey,
            );
            if (replayLookupError) {
                return c.json({
                    error: { code: 'IDEMPOTENCY_LOOKUP_UNAVAILABLE', message: 'Store creation could not be safely retried.' },
                }, 503);
            }
            if (priorStore) return replayStore(priorStore);
        }
        if (isUniqueViolation(error)) {
            return c.json({ error: { code: 'CONFLICT', message: 'Subdomain already taken' } }, 409);
        }
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
        'site_settings', 'logo_url', 'custom_domain', 'currency', 'locale', 'timezone',
        'refund_policy', 'privacy_policy', 'terms_of_service', 'shipping_policy',
        'seo_title', 'seo_description',
        'tax_inclusive',
        'legal_name', 'gstin', 'gst_state_code', 'invoice_prefix',
        'business_profile', 'invoice_address', 'invoice_footer', 'invoice_number_next',
        'cod_enabled', 'online_payment_enabled',
    ];
    // The published API keeps its SEO field names; sites stores these facts in
    // meta_title/meta_description. Do not create a second metadata authority.
    const columnForField: Record<string, string> = { seo_title: 'meta_title', seo_description: 'meta_description' };
    for (const key of allowed) {
        if (body[key] !== undefined) updates[columnForField[key] || key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    // Publish timestamp
    if (updates.status === 'published') {
        updates.published_at = new Date().toISOString();
    }

    // `sites.published` (migration 090, NOT NULL DEFAULT false) is the flag the storefront
    // access resolver actually gates on — `proxy.ts` denies unless `published` AND
    // `status === 'published'`, and robots/sitemap/seo treat `published === false` as
    // unlisted. Only `status` was ever written, so the boolean stayed false forever while
    // the merchant admin (which reads `published === true || status === 'published'`)
    // reported the store as live. Keep the two in lockstep whenever status changes.
    if (updates.status !== undefined) {
        updates.published = updates.status === 'published';
    }

    const updateStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .update(updates)
            .eq('id', storeId)
            .or(ownedByCustomUserFilter(customUser.id));

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
        // See the PATCH handler above: the storefront gates on `published`, not `status`.
        published: true,
    };
    const publishStore = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .update(publishUpdates)
            .eq('id', storeId)
            .or(ownedByCustomUserFilter(customUser.id));

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
        .or(ownedByCustomUserFilter(customUser.id));

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
