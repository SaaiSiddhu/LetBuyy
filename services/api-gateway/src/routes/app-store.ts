import { Hono } from 'hono';
import type { Env } from '../index';
import { findFirstOwnedSiteId, resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import {
    buildMarketplaceAutomatedChecks,
    createMarketplaceReviewRecord,
    type MarketplaceReviewRecord,
} from '../lib/marketplace-review-records';
import {
    createAppAuthorizationCode,
    createAppScopedAccessToken,
    createLetbuyyInternalIdentityHeaders,
    getLetbuyyInternalAuthSecret,
    sha256Hex,
    verifyAppAuthorizationCode,
    verifyAppScopedAccessToken,
} from '@letbuyy/auth-core';
import {
    appOAuthClientId,
    buildAppOAuthRedirectUrl,
    buildAppLifecycleEventPayload,
    appStoreStringArray as stringArray,
    appStoreStringOrNull as stringOrNull,
    isAppStoreUuid as isUuid,
    normalizeAppAdminEmbedSurface,
    normalizeAppInstallScopes,
    normalizeAppOAuthRedirectUri,
    normalizeAppWebhookDefinitions,
    parseAppStoreJsonRecord as parseJsonRecord,
    planAppWebhookSubscriptions,
    planAppDeveloperRegistration,
    planMarketplaceAppSubmission,
    type AppEngineJsonRecord,
    type AppWebhookDefinition,
    type AppWebhookSubscriptionInsert,
} from '@letbuyy/app-engine';
import {
    ApproveAppBillingChargeSchema,
    CreateAppBillingChargeSchema,
    planAppBillingCharge,
    type AppChargeBillingMode,
    type AppChargeProviderMode,
    type IndiaPayoutRail,
} from '@letbuyy/billing-core';

const router = new Hono<{ Bindings: Env }>();

type AppLifecycleEventType = 'app.installed' | 'app.uninstalled';
type AppOAuthGrantType = 'authorization_code';

interface AppOAuthTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_at: string;
    scope: string;
    scopes: string[];
    installation_id: string;
    app_id: string;
    store_id: string;
}

interface BridgeApiRequest {
    method: 'GET';
    path: string;
    storeId?: string | null;
}

interface AppBillingChargeRecord {
    id: string;
    site_id: string;
    app_id: string;
    partner_id: string;
    installation_id: string;
    billing_mode: AppChargeBillingMode;
    status: string;
    name: string;
    amount_minor: number;
    currency: 'INR';
    idempotency_key: string;
    metadata?: AppEngineJsonRecord | null;
}

function getRequestId(c: { req: { header(name: string): string | undefined }; res: { headers: Headers } }): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function isProductionEnv(env: Env): boolean {
    return [env.ENVIRONMENT, env.APP_ENV, env.NODE_ENV, env.DEPLOYMENT_ENV]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === 'production' || String(value).toLowerCase() === 'prod');
}

function appPlatformTokenSecret(env: Env): string | undefined {
    return getLetbuyyInternalAuthSecret({
        INTERNAL_API_SECRET: env.INTERNAL_API_SECRET,
        AUTH_SECRET: env.AUTH_SECRET,
    });
}

function appOAuthState(value: unknown): string | null {
    const state = stringOrNull(value);
    return state && state.length <= 500 ? state : null;
}

function appOAuthGrantType(value: unknown): AppOAuthGrantType | null {
    return value === 'authorization_code' ? value : null;
}

function appOAuthConfig(config: unknown): AppEngineJsonRecord {
    return parseJsonRecord(parseJsonRecord(config).oauth);
}

function firstRelatedRecord(value: unknown): AppEngineJsonRecord {
    if (Array.isArray(value)) {
        return parseJsonRecord(value[0]);
    }

    return parseJsonRecord(value);
}

function appBillingMode(value: unknown): AppChargeBillingMode {
    return value === 'usage' ? 'usage' : 'recurring';
}

function appChargeProviderMode(value: unknown): AppChargeProviderMode {
    return value === 'live' ? 'live' : 'test';
}

function appPayoutRail(value: unknown): IndiaPayoutRail | null {
    switch (value) {
        case 'razorpay_route':
        case 'razorpayx':
        case 'upi':
        case 'manual':
            return value;
        default:
            return null;
    }
}

function appendAppOAuthTokenConfig(input: {
    existingConfig: unknown;
    accessTokenHash: string;
    scopes: string[];
    issuedAt: string;
    expiresAt: string;
    authorizationCode?: AppEngineJsonRecord;
}): AppEngineJsonRecord {
    const rootConfig = parseJsonRecord(input.existingConfig);
    const oauth = appOAuthConfig(rootConfig);
    return {
        ...rootConfig,
        oauth: {
            ...oauth,
            token_type: 'Bearer',
            access_token_hash: input.accessTokenHash,
            scopes: input.scopes,
            issued_at: input.issuedAt,
            expires_at: input.expiresAt,
            ...(input.authorizationCode ? { authorization_code: input.authorizationCode } : {}),
        },
    };
}

async function mintAppOAuthAccessToken(input: {
    appId: string;
    installationId: string;
    storeId: string;
    installedBy: string;
    scopes: string[];
    secret: string;
    now: Date;
    ttlSeconds?: number;
}): Promise<{ token: string; hash: string; response: AppOAuthTokenResponse }> {
    const nowSeconds = Math.floor(input.now.getTime() / 1000);
    const ttlSeconds = input.ttlSeconds || 60 * 60;
    const expiresAt = new Date((nowSeconds + ttlSeconds) * 1000).toISOString();
    const accessToken = await createAppScopedAccessToken({
        appId: input.appId,
        installationId: input.installationId,
        storeId: input.storeId,
        installedBy: input.installedBy,
        scopes: input.scopes,
    }, input.secret, { nowSeconds, ttlSeconds });
    const hash = await sha256Hex(accessToken);

    return {
        token: accessToken,
        hash,
        response: {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_at: expiresAt,
            scope: input.scopes.join(' '),
            scopes: input.scopes,
            installation_id: input.installationId,
            app_id: input.appId,
            store_id: input.storeId,
        },
    };
}

function apiBaseUrlFromRequest(requestUrl: string): string {
    const url = new URL('/v1', requestUrl);
    return url.toString().replace(/\/$/, '');
}

function readBearerToken(value: string | undefined): string | null {
    if (!value?.startsWith('Bearer ')) return null;
    const token = value.slice('Bearer '.length).trim();
    return token || null;
}

function normalizeBridgeApiRequest(body: AppEngineJsonRecord): BridgeApiRequest | null {
    const method = typeof body.method === 'string' ? body.method.toUpperCase() : 'GET';
    const path = stringOrNull(body.path);
    const storeId = stringOrNull(body.store_id || body.storeId);
    if (method !== 'GET' || !path) return null;
    if (/^https?:\/\//i.test(path) || path.includes('..') || path.includes('//')) return null;
    const normalizedPath = path.startsWith('/v1/') ? path.slice(3) : path;
    return {
        method: 'GET',
        path: normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`,
        storeId,
    };
}

function bridgeRequiredScopes(path: string): string[] | null {
    const firstSegment = path.replace(/^\/+/, '').split(/[/?#]/)[0];
    switch (firstSegment) {
        case 'products':
            return ['read_products'];
        case 'orders':
            return ['read_orders'];
        case 'customers':
            return ['read_customers'];
        case 'themes':
            return ['read_themes'];
        case 'storefront':
            return ['read_storefront'];
        default:
            return null;
    }
}

function bridgeTargetUrl(requestUrl: string, path: string, storeId: string): string | null {
    const target = new URL(`/v1${path}`, requestUrl);
    const requestedStoreId = target.searchParams.get('store_id');
    if (requestedStoreId && requestedStoreId !== storeId) return null;
    target.searchParams.set('store_id', storeId);
    return target.toString();
}

function appLifecycleWebhookDefinitions(appWebhooks: unknown, body: AppEngineJsonRecord, allowLocalhost: boolean): AppWebhookDefinition[] {
    const configured = normalizeAppWebhookDefinitions(appWebhooks, { allowLocalhost });
    const requestedUrl = stringOrNull(body.webhook_url || body.webhookUrl);
    if (!requestedUrl) return configured;

    return [
        ...configured,
        ...normalizeAppWebhookDefinitions([{
            event: body.webhook_event || body.webhookEvent || 'app.installed',
            url: requestedUrl,
            secret: body.webhook_secret || body.webhookSecret,
            is_active: true,
        }], { allowLocalhost }),
    ];
}

async function insertAppLifecycleOutbox(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        storeId: string;
        installationId: string;
        eventType: AppLifecycleEventType;
        payload: Record<string, unknown>;
        actorId: string;
        requestId: string;
    },
): Promise<void> {
    const appId = stringOrNull(input.payload.app_id);
    if (!appId) {
        throw new Error('App lifecycle event payload requires app_id');
    }

    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.storeId,
        aggregateType: 'app',
        aggregateId: appId,
        eventType: input.eventType,
        payload: {
            site_id: input.storeId,
            app_id: appId,
            installation_id: input.installationId,
            scopes: stringArray(input.payload.scopes),
        },
        idempotencyKey: `${input.eventType}:${input.storeId}:${input.installationId}`,
        requestId: input.requestId,
        actorId: input.actorId,
    });
}

async function insertAppChargeOutbox(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        charge: AppBillingChargeRecord;
        eventType: 'app.charge.created' | 'app.charge.activated';
        actorId: string;
        requestId: string;
    },
): Promise<void> {
    const metadata = parseJsonRecord(input.charge.metadata);
    const indiaPayout = parseJsonRecord(metadata.india_payout);

    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.charge.site_id,
        aggregateType: 'app_charge',
        aggregateId: input.charge.id,
        eventType: input.eventType,
        payload: {
            site_id: input.charge.site_id,
            app_id: input.charge.app_id,
            installation_id: input.charge.installation_id,
            charge_id: input.charge.id,
            billing_mode: input.charge.billing_mode,
            amount: {
                amount_minor: input.charge.amount_minor,
                currency: input.charge.currency,
            },
            payout_rail: stringOrNull(indiaPayout.payout_rail) || 'razorpay_route',
            revenue_share_bps: Number(indiaPayout.revenue_share_bps || 8000),
            partner_gst_bps: Number(indiaPayout.partner_gst_bps || 1800),
            partner_gst_minor: Number(indiaPayout.partner_gst_minor || 0),
        },
        idempotencyKey: `${input.eventType}:${input.charge.site_id}:${input.charge.id}`,
        requestId: input.requestId,
        actorId: input.actorId,
    });
}

async function insertAppWebhookSubscriptions(
    db: ReturnType<typeof getSupabaseAdmin>,
    subscriptions: AppWebhookSubscriptionInsert[],
): Promise<Array<{ id: string }>> {
    if (subscriptions.length === 0) return [];

    const { data, error } = await db
        .from('webhook_subscriptions')
        .insert(subscriptions)
        .select('id');

    if (error) {
        throw new Error(`App webhook subscription creation failed: ${error.message}`);
    }

    return Array.isArray(data) ? data as Array<{ id: string }> : [];
}

async function dispatchAppLifecycleThroughWebhookService(env: Env, input: {
    eventId: string;
    eventType: AppLifecycleEventType;
    payload: Record<string, unknown>;
    targetUrl: string;
    signingSecret: string;
    requestId: string;
}): Promise<void> {
    if (!env.WEBHOOK_SERVICE || !env.INTERNAL_API_SECRET) return;

    await env.WEBHOOK_SERVICE.fetch('https://webhook-service/app-lifecycle/dispatch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-LetBuyy-Internal-Secret': env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify({
            target_url: input.targetUrl,
            event_id: input.eventId,
            event_type: input.eventType,
            payload: input.payload,
            signing_secret: input.signingSecret,
            request_id: input.requestId,
        }),
    }).catch(() => undefined);
}

async function dispatchAppLifecycleSubscriptions(env: Env, input: {
    eventType: AppLifecycleEventType;
    installationId: string;
    payload: Record<string, unknown>;
    requestId: string;
    subscriptions: Array<{
        target_url: string;
        signing_secret: string;
        event_types?: unknown;
    }>;
}): Promise<void> {
    const targets = input.subscriptions.filter((subscription) => stringArray(subscription.event_types).includes(input.eventType));

    await Promise.all(targets.map((subscription, index) => dispatchAppLifecycleThroughWebhookService(env, {
        eventId: `${input.eventType}:${input.installationId}:${index}`,
        eventType: input.eventType,
        payload: input.payload,
        targetUrl: subscription.target_url,
        signingSecret: subscription.signing_secret,
        requestId: input.requestId,
    })));
}

// GET /app-store/categories — List active app categories
router.get('/categories', async (c) => {
    const { data, error } = await getSupabaseAdmin(c)
        .from('app_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// GET /app-store/apps — List marketplace apps (public-like, filtered by status=published for non-owners)
router.get('/apps', async (c) => {
    const category = c.req.query('category');
    const search = c.req.query('search');
    const pricing = c.req.query('pricing');
    const siteType = c.req.query('site_type');
    const sort = c.req.query('sort') || 'popular';
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    let query = db
        .from('marketplace_apps')
        .select('*, app_developers!inner(company_name, slug, logo_url, verified), app_categories!inner(name, slug, icon)', { count: 'exact' })
        .eq('status', 'published');

    if (category) query = isUuid(category) ? query.eq('category_id', category) : query.eq('app_categories.slug', category);
    if (pricing) query = query.eq('pricing_model', pricing);
    if (siteType) query = query.contains('supported_site_types', [siteType]);
    if (search) query = query.or(`name.ilike.%${search}%,tagline.ilike.%${search}%`);

    switch (sort) {
        case 'rating':
            query = query.order('rating_avg', { ascending: false });
            break;
        case 'recent':
            query = query.order('created_at', { ascending: false });
            break;
        case 'name':
            query = query.order('name', { ascending: true });
            break;
        case 'popular':
        default:
            query = query.order('install_count', { ascending: false });
            break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /app-store/apps/:id — Get app details
router.get('/apps/:id', async (c) => {
    const appId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    let query = db
        .from('marketplace_apps')
        .select('*, app_developers(id, company_name, slug, logo_url, website_url, support_email, verified), app_categories(name, slug, icon), app_extensions(*)')
        .eq('status', 'published');

    query = isUuid(appId) ? query.eq('id', appId) : query.eq('slug', appId);

    const { data, error } = await query.single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found' } }, 404);
    }

    return c.json(success(data));
});

// GET /app-store/apps/:id/reviews — List reviews
router.get('/apps/:id/reviews', async (c) => {
    const appId = c.req.param('id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    const { data, error, count } = await db
        .from('app_reviews')
        .select('*', { count: 'exact' })
        .eq('app_id', appId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// POST /app-store/apps/:id/reviews — Submit a review
router.post('/apps/:id/reviews', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (!body.rating || body.rating < 1 || body.rating > 5) {
        return c.json({ error: { code: 'VALIDATION', message: 'rating (1-5) is required' } }, 400);
    }

    if (body.store_id) {
        const ownsStore = await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized for this store' } }, 403);
        }
    }

    // Check if user has installed this app (verified review)
    const { data: installation } = await db
        .from('app_installations')
        .select('id')
        .eq('app_id', appId)
        .eq('installed_by', customUser.id)
        .limit(1);

    const isVerified = installation && installation.length > 0;

    const { data, error } = await db
        .from('app_reviews')
        .upsert(
            {
                app_id: appId,
                user_id: customUser.id,
                store_id: body.store_id || null,
                user_name: customUser.full_name || customUser.email.split('@')[0] || 'Anonymous',
                rating: body.rating,
                title: body.title || null,
                body: body.body || null,
                is_verified: isVerified,
                status: 'published',
            },
            { onConflict: 'app_id,user_id' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Update app's denormalized rating
    const { data: stats } = await db
        .from('app_reviews')
        .select('rating')
        .eq('app_id', appId)
        .eq('status', 'published');

    if (stats && stats.length > 0) {
        const avgRating = stats.reduce((sum, r) => sum + r.rating, 0) / stats.length;
        await db
            .from('marketplace_apps')
            .update({
                rating_avg: Math.round(avgRating * 100) / 100,
                review_count: stats.length,
            })
            .eq('id', appId);
    }

    return c.json(success(data), 201);
});

// GET /app-store/installations — List installed apps for a store
router.get('/installations', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const resolvedStoreId = storeId || await findFirstOwnedSiteId(db, customUser.id);

    if (!resolvedStoreId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    const ownsStore = await verifySiteOwnership(db, resolvedStoreId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('app_installations')
        .select('*, marketplace_apps(id, name, slug, icon_url, tagline, pricing_model, app_url)')
        .eq('store_id', resolvedStoreId)
        .eq('installed_by', customUser.id)
        .neq('status', 'uninstalled')
        .order('installed_at', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /app-store/installations/:id/embed-session — Mint an admin app bridge session
router.post('/installations/:id/embed-session', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const installationId = c.req.param('id');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const now = new Date();

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: installation, error } = await db
        .from('app_installations')
        .select('id, app_id, store_id, status, scopes_granted, config, installed_at, uninstalled_at, marketplace_apps(id, name, slug, icon_url, tagline, pricing_model, app_url, app_extensions(id, type, target, label, config, sort_order))')
        .eq('id', installationId)
        .neq('status', 'uninstalled')
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    if (!installation) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App installation not found' } }, 404);
    }

    if (storeId && installation.store_id !== storeId) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Installation does not belong to this store' } }, 403);
    }

    const ownsStore = await verifySiteOwnership(db, installation.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const embed = normalizeAppAdminEmbedSurface(installation, { allowLocalhost: !isProductionEnv(c.env) });
    if (!embed) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Installed app does not expose an admin embed surface' } }, 404);
    }

    const appSecret = appPlatformTokenSecret(c.env);
    if (!appSecret) {
        return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App bridge token secret is not configured' } }, 500);
    }

    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const scopes = stringArray(installation.scopes_granted);
    const accessToken = await createAppScopedAccessToken({
        appId: installation.app_id,
        installationId: installation.id,
        storeId: installation.store_id,
        installedBy: customUser.id,
        scopes,
    }, appSecret, {
        nowSeconds: Math.floor(now.getTime() / 1000),
        ttlSeconds: 15 * 60,
    });
    const accessTokenHash = await sha256Hex(accessToken);
    const installConfig = parseJsonRecord(installation.config);
    const oauth = appOAuthConfig(installConfig);
    const { error: bridgeTokenError } = await db
        .from('app_installations')
        .update({
            config: {
                ...installConfig,
                oauth: {
                    ...oauth,
                    bridge_token_hash: accessTokenHash,
                    bridge_token_issued_at: now.toISOString(),
                    bridge_token_expires_at: expiresAt,
                    bridge_scopes: scopes,
                },
            },
        })
        .eq('id', installation.id);

    if (bridgeTokenError) {
        return c.json({ error: { code: 'DB_ERROR', message: bridgeTokenError.message } }, 500);
    }

    return c.json(success({
        installation,
        embed,
        bridge: {
            version: '2026-06-01',
            token_type: 'Bearer',
            access_token: accessToken,
            expires_at: expiresAt,
            api_base_url: apiBaseUrlFromRequest(c.req.url),
            store_id: installation.store_id,
            installation_id: installation.id,
            app_id: installation.app_id,
            scopes,
            capabilities: embed.capabilities,
        },
    }));
});

// POST /app-store/bridge/fetch — Proxy embedded app reads through a verified app session token
router.post('/bridge/fetch', async (c) => {
    const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
    const bridgeRequest = normalizeBridgeApiRequest(body);
    if (!bridgeRequest) {
        return c.json({ error: { code: 'VALIDATION', message: 'Only scoped GET bridge requests are supported' } }, 400);
    }

    const requiredScopes = bridgeRequiredScopes(bridgeRequest.path);
    if (!requiredScopes) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Bridge request path is not allowed' } }, 403);
    }

    const appSecret = appPlatformTokenSecret(c.env);
    if (!appSecret) {
        return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App bridge token secret is not configured' } }, 500);
    }

    const token = readBearerToken(c.req.header('Authorization'));
    const verification = await verifyAppScopedAccessToken(token, appSecret, { requiredScopes });
    if (!verification.accepted || !verification.payload || !verification.token) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: verification.reason || 'Invalid app bridge token' } }, 401);
    }

    if (bridgeRequest.storeId && bridgeRequest.storeId !== verification.payload.storeId) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Bridge request store_id does not match token store' } }, 403);
    }

    const targetUrl = bridgeTargetUrl(c.req.url, bridgeRequest.path, verification.payload.storeId);
    if (!targetUrl) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Bridge request store_id does not match token store' } }, 403);
    }

    const db = getSupabaseAdmin(c);
    const { data: installation, error: installError } = await db
        .from('app_installations')
        .select('id, app_id, store_id, installed_by, status, scopes_granted, config')
        .eq('id', verification.payload.installationId)
        .eq('app_id', verification.payload.appId)
        .eq('store_id', verification.payload.storeId)
        .eq('status', 'active')
        .maybeSingle();

    if (installError) {
        return c.json({ error: { code: 'DB_ERROR', message: installError.message } }, 500);
    }

    if (!installation || installation.installed_by !== verification.payload.installedBy) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'App installation is not active' } }, 401);
    }

    const tokenHash = await sha256Hex(verification.token);
    const oauth = appOAuthConfig(installation.config);
    const isKnownToken = stringOrNull(oauth.bridge_token_hash) === tokenHash
        || stringOrNull(oauth.access_token_hash) === tokenHash;
    if (!isKnownToken) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'App bridge token has been revoked or replaced' } }, 401);
    }

    const { data: installedBy } = await db
        .from('users_custom')
        .select('id, email')
        .eq('id', verification.payload.installedBy)
        .maybeSingle();

    if (!installedBy?.email) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Installed app owner could not be resolved' } }, 401);
    }

    const internalHeaders = await createLetbuyyInternalIdentityHeaders({
        userId: verification.payload.installedBy,
        email: installedBy.email,
        storeId: verification.payload.storeId,
        secret: appSecret,
    });
    if (!internalHeaders.ok || !internalHeaders.headers) {
        return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: internalHeaders.reason || 'Bridge internal identity could not be signed' } }, 500);
    }

    const response = await fetch(targetUrl, {
        method: bridgeRequest.method,
        headers: {
            ...internalHeaders.headers,
            Accept: 'application/json',
            'X-LetBuyy-App-Bridge': verification.payload.installationId,
            'X-Request-ID': getRequestId(c),
        },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    return c.json(success({
        ok: response.ok,
        status: response.status,
        data,
        error: response.ok ? null : 'Bridge gateway request failed',
    }));
});

// POST /app-store/installations/:id/charges — Create a merchant-approved app charge
router.post('/installations/:id/charges', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const installationId = c.req.param('id');
    const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: installation, error: installationError } = await db
        .from('app_installations')
        .select('id, app_id, store_id, installed_by, status, marketplace_apps(id, developer_id, name, pricing_model, price_inr)')
        .eq('id', installationId)
        .eq('status', 'active')
        .maybeSingle();

    if (installationError) {
        return c.json({ error: { code: 'DB_ERROR', message: installationError.message } }, 500);
    }

    if (!installation) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App installation not found' } }, 404);
    }

    const storeId = stringOrNull(body.store_id || body.storeId) || installation.store_id;
    if (storeId !== installation.store_id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Charge store_id does not match installation store' } }, 403);
    }

    const ownsStore = await verifySiteOwnership(db, installation.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const input = CreateAppBillingChargeSchema.safeParse({
        ...body,
        store_id: installation.store_id,
        installation_id: installation.id,
        billing_mode: appBillingMode(body.billing_mode || body.billingMode),
        currency: 'INR',
    });
    if (!input.success) {
        return c.json({ error: { code: 'VALIDATION', message: input.error.issues[0]?.message || 'Invalid app charge' } }, 400);
    }

    const app = firstRelatedRecord(installation.marketplace_apps);
    const partnerId = stringOrNull(app.developer_id);
    if (!partnerId) {
        return c.json({ error: { code: 'VALIDATION', message: 'Installed app does not have a partner account' } }, 400);
    }

    const { data: existingCharge, error: existingError } = await db
        .from('app_billing_charges')
        .select('*')
        .eq('site_id', input.data.store_id)
        .eq('idempotency_key', input.data.idempotency_key)
        .maybeSingle();

    if (existingError) {
        return c.json({ error: { code: 'DB_ERROR', message: existingError.message } }, 500);
    }

    if (existingCharge) {
        return c.json(success({
            charge: existingCharge,
            approval: {
                required: existingCharge.status === 'pending_merchant_approval',
                url: existingCharge.approval_url,
            },
        }));
    }

    const chargeId = crypto.randomUUID();
    const providerMode = appChargeProviderMode(body.provider_mode || body.providerMode);
    const plan = planAppBillingCharge({
        appId: installation.app_id,
        installationId: installation.id,
        storeId: installation.store_id,
        partnerId,
        billingMode: input.data.billing_mode,
        name: input.data.name,
        amountMinor: input.data.amount_minor,
        idempotencyKey: input.data.idempotency_key,
        approvalUrl: `/v1/app-store/charges/${chargeId}/approve`,
        metadata: input.data.metadata,
        revenueShareBps: Number(body.revenue_share_bps || body.revenueShareBps || 8000),
        partnerGstBps: Number(body.partner_gst_bps || body.partnerGstBps || 1800),
        payoutRail: appPayoutRail(body.payout_rail || body.payoutRail),
        providerMode,
    });

    const { data: charge, error: chargeError } = await db
        .from('app_billing_charges')
        .insert({
            id: chargeId,
            site_id: plan.store_id,
            app_id: plan.app_id,
            partner_id: plan.partner_id,
            installation_id: plan.installation_id,
            billing_mode: plan.billing_mode,
            status: plan.status,
            name: plan.name,
            amount_minor: plan.amount_minor,
            currency: plan.currency,
            revenue_share_bps: plan.payout.revenue_share_bps,
            partner_amount_minor: plan.payout.partner_amount_minor,
            platform_fee_minor: plan.payout.platform_fee_minor,
            partner_gst_bps: plan.payout.partner_gst_bps,
            partner_gst_minor: plan.payout.partner_gst_minor,
            payout_rail: plan.payout.payout_rail,
            provider: plan.payout.provider,
            provider_mode: plan.payout.provider_mode,
            approval_url: plan.approval_url,
            idempotency_key: plan.idempotency_key,
            metadata: plan.metadata,
            created_by: customUser.id,
            updated_by: customUser.id,
        })
        .select()
        .single();

    if (chargeError) {
        return c.json({ error: { code: 'DB_ERROR', message: chargeError.message } }, 500);
    }

    await insertAppChargeOutbox(db, {
        charge: charge as AppBillingChargeRecord,
        eventType: 'app.charge.created',
        actorId: customUser.id,
        requestId,
    });

    return c.json(success({
        charge,
        approval: {
            required: true,
            url: plan.approval_url,
        },
        payout_plan: plan.payout,
    }), 201);
});

// POST /app-store/charges/:id/approve — Merchant approval activates an app charge
router.post('/charges/:id/approve', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const chargeId = c.req.param('id');
    const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: charge, error: chargeLookupError } = await db
        .from('app_billing_charges')
        .select('*')
        .eq('id', chargeId)
        .maybeSingle();

    if (chargeLookupError) {
        return c.json({ error: { code: 'DB_ERROR', message: chargeLookupError.message } }, 500);
    }

    if (!charge) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App charge not found' } }, 404);
    }

    const input = ApproveAppBillingChargeSchema.safeParse({
        ...body,
        charge_id: chargeId,
        store_id: stringOrNull(body.store_id || body.storeId) || charge.site_id,
        provider_mode: appChargeProviderMode(body.provider_mode || body.providerMode),
    });
    if (!input.success) {
        return c.json({ error: { code: 'VALIDATION', message: input.error.issues[0]?.message || 'Invalid app charge approval' } }, 400);
    }

    if (input.data.store_id !== charge.site_id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Charge store_id does not match' } }, 403);
    }

    const ownsStore = await verifySiteOwnership(db, charge.site_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    if (charge.status === 'active') {
        return c.json(success({
            charge,
            billing: {
                activated: false,
                reason: 'already_active',
            },
        }));
    }

    if (charge.status !== 'pending_merchant_approval' && charge.status !== 'approved') {
        return c.json({ error: { code: 'CONFLICT', message: 'Only pending app charges can be approved' } }, 409);
    }

    const now = new Date().toISOString();
    const metadata = parseJsonRecord(charge.metadata);
    const providerReference = input.data.provider_reference || `rzp_route_test_${chargeId.replaceAll('-', '').slice(0, 18)}`;
    const { data: activatedCharge, error: updateError } = await db
        .from('app_billing_charges')
        .update({
            status: 'active',
            approved_by: customUser.id,
            approved_at: now,
            activated_at: now,
            provider_reference: providerReference,
            provider_mode: input.data.provider_mode,
            updated_by: customUser.id,
            metadata: {
                ...metadata,
                approval: {
                    idempotency_key: input.data.idempotency_key,
                    provider_reference: providerReference,
                    provider_mode: input.data.provider_mode,
                    approved_at: now,
                },
            },
        })
        .eq('id', chargeId)
        .select()
        .single();

    if (updateError) {
        return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
    }

    await insertAppChargeOutbox(db, {
        charge: activatedCharge as AppBillingChargeRecord,
        eventType: 'app.charge.activated',
        actorId: customUser.id,
        requestId,
    });

    return c.json(success({
        charge: activatedCharge,
        billing: {
            activated: true,
            provider_reference: providerReference,
            provider_mode: input.data.provider_mode,
        },
        payout: {
            ledger_event: 'app.charge.activated',
            queue: 'payment-events',
            rail: activatedCharge.payout_rail,
        },
    }));
});

// POST /app-store/apps/:id/oauth/authorize — Install/authorize an app and issue a short-lived code
router.post('/apps/:id/oauth/authorize', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const body = await c.req.json() as AppEngineJsonRecord;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);
    const now = new Date();
    const nowSeconds = Math.floor(now.getTime() / 1000);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const storeId = stringOrNull(body.store_id) || await findFirstOwnedSiteId(db, customUser.id);
    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data: app } = await db
        .from('marketplace_apps')
        .select('id, name, oauth_client_id, oauth_redirect_uris, api_scopes, app_webhooks(id, event, url, secret, is_active)')
        .eq('id', appId)
        .eq('status', 'published')
        .single();

    if (!app) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found or not available' } }, 404);
    }

    const scopes = normalizeAppInstallScopes(body.scopes, app.api_scopes || []);
    if (!scopes.ok) {
        return c.json({ error: { code: 'VALIDATION', message: scopes.message } }, 400);
    }

    const redirect = normalizeAppOAuthRedirectUri(body.redirect_uri || body.redirectUri, app.oauth_redirect_uris, {
        allowLocalhost: !isProductionEnv(c.env),
    });
    if (!redirect.ok) {
        return c.json({ error: { code: 'VALIDATION', message: redirect.message } }, 400);
    }

    const appSecret = appPlatformTokenSecret(c.env);
    if (!appSecret) {
        return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App OAuth token secret is not configured' } }, 500);
    }

    const { data: installation, error } = await db
        .from('app_installations')
        .upsert(
            {
                app_id: app.id,
                store_id: storeId,
                installed_by: customUser.id,
                status: 'active',
                scopes_granted: scopes.value,
                config: parseJsonRecord(body.config),
                installed_at: now.toISOString(),
                uninstalled_at: null,
            },
            { onConflict: 'app_id,store_id' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const state = appOAuthState(body.state);
    const clientId = appOAuthClientId(app);
    const authorizationCodeId = `app_oauth_code:${installation.id}:${crypto.randomUUID()}`;
    const authorizationCode = await createAppAuthorizationCode({
        appId: app.id,
        clientId,
        installationId: installation.id,
        storeId,
        installedBy: customUser.id,
        scopes: scopes.value,
        redirectUri: redirect.value,
        state,
    }, appSecret, { nowSeconds, tokenId: authorizationCodeId });
    const authorizationCodeHash = await sha256Hex(authorizationCode);
    const authorizationExpiresAt = new Date((nowSeconds + 15 * 60) * 1000).toISOString();
    const allowLocalhost = !isProductionEnv(c.env);
    const webhookDefinitions = appLifecycleWebhookDefinitions(app.app_webhooks, body, allowLocalhost);
    const defaultSigningSecret = stringOrNull(body.webhook_secret || body.webhookSecret) || crypto.randomUUID();
    const webhookSubscriptions = planAppWebhookSubscriptions({
        app,
        storeId,
        installationId: installation.id,
        installedBy: customUser.id,
        webhookDefinitions,
        defaultSigningSecret,
    });
    const insertedSubscriptions = await insertAppWebhookSubscriptions(db, webhookSubscriptions);
    const finalConfig = {
        ...parseJsonRecord(body.config),
        oauth: {
            authorization_code: {
                code_hash: authorizationCodeHash,
                client_id: clientId,
                redirect_uri: redirect.value,
                scopes: scopes.value,
                state,
                issued_at: now.toISOString(),
                expires_at: authorizationExpiresAt,
                redeemed_at: null,
            },
        },
        webhooks: {
            subscription_ids: insertedSubscriptions.map((subscription) => subscription.id),
        },
    };
    const { data: finalInstallation, error: updateError } = await db
        .from('app_installations')
        .update({ config: finalConfig })
        .eq('id', installation.id)
        .select()
        .single();

    if (updateError) {
        return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
    }

    const lifecyclePayload = buildAppLifecycleEventPayload({
        app,
        installationId: installation.id,
        storeId,
        installedBy: customUser.id,
        scopes: scopes.value,
        occurredAt: now.toISOString(),
    });
    await insertAppLifecycleOutbox(db, {
        storeId,
        installationId: installation.id,
        eventType: 'app.installed',
        payload: lifecyclePayload,
        actorId: customUser.id,
        requestId,
    });

    await dispatchAppLifecycleSubscriptions(c.env, {
        eventType: 'app.installed',
        installationId: installation.id,
        payload: lifecyclePayload,
        requestId,
        subscriptions: webhookSubscriptions,
    });

    return c.json(success({
        installation: finalInstallation || installation,
        authorization: {
            code: authorizationCode,
            redirect_uri: redirect.value,
            redirect_to: buildAppOAuthRedirectUrl(redirect.value, { code: authorizationCode, state }),
            state,
            scopes: scopes.value,
            expires_at: authorizationExpiresAt,
            installation_id: installation.id,
            app_id: app.id,
            store_id: storeId,
        },
    }), 201);
});

// POST /app-store/oauth/token — Exchange an app authorization code for a scoped token
router.post('/oauth/token', async (c) => {
    const body = await c.req.json() as AppEngineJsonRecord;
    const grantType = appOAuthGrantType(body.grant_type || body.grantType);
    if (!grantType) {
        return c.json({ error: { code: 'VALIDATION', message: 'grant_type must be authorization_code' } }, 400);
    }

    const code = stringOrNull(body.code);
    const clientId = stringOrNull(body.client_id || body.clientId);
    const redirectUri = stringOrNull(body.redirect_uri || body.redirectUri);
    if (!code || !clientId || !redirectUri) {
        return c.json({ error: { code: 'VALIDATION', message: 'code, client_id, and redirect_uri are required' } }, 400);
    }

    const appSecret = appPlatformTokenSecret(c.env);
    const verification = await verifyAppAuthorizationCode(code, appSecret);
    if (!verification.accepted || !verification.payload) {
        return c.json({ error: { code: 'INVALID_GRANT', message: verification.reason || 'Authorization code is invalid' } }, 400);
    }

    if (verification.payload.clientId !== clientId || verification.payload.redirectUri !== redirectUri) {
        return c.json({ error: { code: 'INVALID_GRANT', message: 'Authorization code client or redirect_uri mismatch' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: installation, error } = await db
        .from('app_installations')
        .select('id, app_id, store_id, installed_by, status, scopes_granted, config')
        .eq('id', verification.payload.installationId)
        .eq('app_id', verification.payload.appId)
        .eq('store_id', verification.payload.storeId)
        .eq('status', 'active')
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    if (!installation) {
        return c.json({ error: { code: 'INVALID_GRANT', message: 'App installation is not active' } }, 400);
    }

    const oauth = appOAuthConfig(installation.config);
    const authorizationCodeConfig = parseJsonRecord(oauth.authorization_code);
    const expectedCodeHash = stringOrNull(authorizationCodeConfig.code_hash);
    const codeHash = await sha256Hex(code);
    if (
        !expectedCodeHash ||
        expectedCodeHash !== codeHash ||
        stringOrNull(authorizationCodeConfig.redeemed_at)
    ) {
        return c.json({ error: { code: 'INVALID_GRANT', message: 'Authorization code has already been redeemed or is not recognized' } }, 400);
    }

    const now = new Date();
    const minted = await mintAppOAuthAccessToken({
        appId: verification.payload.appId,
        installationId: verification.payload.installationId,
        storeId: verification.payload.storeId,
        installedBy: verification.payload.installedBy,
        scopes: verification.payload.scopes,
        secret: appSecret || '',
        now,
    });
    const finalConfig = appendAppOAuthTokenConfig({
        existingConfig: installation.config,
        accessTokenHash: minted.hash,
        scopes: verification.payload.scopes,
        issuedAt: now.toISOString(),
        expiresAt: minted.response.expires_at,
        authorizationCode: {
            ...authorizationCodeConfig,
            redeemed_at: now.toISOString(),
        },
    });
    const { error: updateError } = await db
        .from('app_installations')
        .update({ config: finalConfig })
        .eq('id', installation.id);

    if (updateError) {
        return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
    }

    return c.json(success(minted.response));
});

// POST /app-store/oauth/token-exchange — Exchange a merchant session for an embedded app token
router.post('/oauth/token-exchange', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json() as AppEngineJsonRecord;
    const installationId = stringOrNull(body.installation_id || body.installationId);
    const storeId = stringOrNull(body.store_id || body.storeId);
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    if (!installationId) {
        return c.json({ error: { code: 'VALIDATION', message: 'installation_id is required' } }, 400);
    }

    const { data: installation, error } = await db
        .from('app_installations')
        .select('id, app_id, store_id, installed_by, status, scopes_granted, config')
        .eq('id', installationId)
        .eq('status', 'active')
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    if (!installation || (storeId && installation.store_id !== storeId)) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App installation not found' } }, 404);
    }

    const ownsStore = await verifySiteOwnership(db, installation.store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const scopes = normalizeAppInstallScopes(body.scopes, installation.scopes_granted || []);
    if (!scopes.ok) {
        return c.json({ error: { code: 'VALIDATION', message: scopes.message } }, 400);
    }

    const appSecret = appPlatformTokenSecret(c.env);
    if (!appSecret) {
        return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App OAuth token secret is not configured' } }, 500);
    }

    const now = new Date();
    const minted = await mintAppOAuthAccessToken({
        appId: installation.app_id,
        installationId: installation.id,
        storeId: installation.store_id,
        installedBy: customUser.id,
        scopes: scopes.value,
        secret: appSecret,
        now,
        ttlSeconds: 15 * 60,
    });
    const finalConfig = appendAppOAuthTokenConfig({
        existingConfig: installation.config,
        accessTokenHash: minted.hash,
        scopes: scopes.value,
        issuedAt: now.toISOString(),
        expiresAt: minted.response.expires_at,
    });
    const { error: updateError } = await db
        .from('app_installations')
        .update({ config: finalConfig })
        .eq('id', installation.id);

    if (updateError) {
        return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
    }

    return c.json(success(minted.response));
});

// POST /app-store/apps/:id/install — Install an app
router.post('/apps/:id/install', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const body = await c.req.json() as AppEngineJsonRecord;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);
    const now = new Date();

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const storeId = stringOrNull(body.store_id) || await findFirstOwnedSiteId(db, customUser.id);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    // Verify store ownership
    const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Verify app exists and is published
    const { data: app } = await db
        .from('marketplace_apps')
        .select('id, name, api_scopes, app_webhooks(id, event, url, secret, is_active)')
        .eq('id', appId)
        .eq('status', 'published')
        .single();

    if (!app) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'App not found or not available' } }, 404);
    }

    const scopes = normalizeAppInstallScopes(body.scopes, app.api_scopes || []);
    if (!scopes.ok) {
        return c.json({ error: { code: 'VALIDATION', message: scopes.message } }, 400);
    }

    const appSecret = appPlatformTokenSecret(c.env);
    if (!appSecret) {
        return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App OAuth token secret is not configured' } }, 500);
    }

    // Upsert installation
    const { data, error } = await db
        .from('app_installations')
        .upsert(
            {
                app_id: appId,
                store_id: storeId,
                installed_by: customUser.id,
                status: 'active',
                scopes_granted: scopes.value,
                config: parseJsonRecord(body.config),
                installed_at: now.toISOString(),
                uninstalled_at: null,
            },
            { onConflict: 'app_id,store_id' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    const expiresAt = new Date((Math.floor(now.getTime() / 1000) + 60 * 60) * 1000).toISOString();
    const accessToken = await createAppScopedAccessToken({
        appId: app.id,
        installationId: data.id,
        storeId,
        installedBy: customUser.id,
        scopes: scopes.value,
    }, appSecret, { nowSeconds: Math.floor(now.getTime() / 1000) });
    const accessTokenHash = await sha256Hex(accessToken);
    const lifecyclePayload = buildAppLifecycleEventPayload({
        app,
        installationId: data.id,
        storeId,
        installedBy: customUser.id,
        scopes: scopes.value,
        occurredAt: now.toISOString(),
    });
    const allowLocalhost = !isProductionEnv(c.env);
    const webhookDefinitions = appLifecycleWebhookDefinitions(app.app_webhooks, body, allowLocalhost);
    const defaultSigningSecret = stringOrNull(body.webhook_secret || body.webhookSecret) || crypto.randomUUID();
    const webhookSubscriptions = planAppWebhookSubscriptions({
        app,
        storeId,
        installationId: data.id,
        installedBy: customUser.id,
        webhookDefinitions,
        defaultSigningSecret,
    });
    const insertedSubscriptions = await insertAppWebhookSubscriptions(db, webhookSubscriptions);
    const finalConfig = {
        ...parseJsonRecord(body.config),
        oauth: {
            token_type: 'Bearer',
            access_token_hash: accessTokenHash,
            scopes: scopes.value,
            issued_at: now.toISOString(),
            expires_at: expiresAt,
        },
        webhooks: {
            subscription_ids: insertedSubscriptions.map((subscription) => subscription.id),
        },
    };
    const { data: finalInstallation, error: updateError } = await db
        .from('app_installations')
        .update({ config: finalConfig })
        .eq('id', data.id)
        .select()
        .single();

    if (updateError) {
        return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
    }

    await insertAppLifecycleOutbox(db, {
        storeId,
        installationId: data.id,
        eventType: 'app.installed',
        payload: lifecyclePayload,
        actorId: customUser.id,
        requestId,
    });

    await dispatchAppLifecycleSubscriptions(c.env, {
        eventType: 'app.installed',
        installationId: data.id,
        payload: lifecyclePayload,
        requestId,
        subscriptions: webhookSubscriptions,
    });

    // Increment install count (best-effort, non-blocking)
    try {
        const { data: currentApp } = await db
            .from('marketplace_apps')
            .select('install_count')
            .eq('id', appId)
            .single();

        await db
            .from('marketplace_apps')
            .update({ install_count: (currentApp?.install_count || 0) + 1 })
            .eq('id', appId);
    } catch {
        // Non-critical — install count update failed silently
    }

    return c.json(success({
        installation: finalInstallation || data,
        oauth: {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_at: expiresAt,
            scopes: scopes.value,
        },
        webhooks: {
            subscriptions: insertedSubscriptions,
        },
    }), 201);
});

// DELETE /app-store/apps/:id/install — Uninstall an app
router.delete('/apps/:id/install', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const appId = c.req.param('id');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);
    const requestId = getRequestId(c);
    const now = new Date();

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const resolvedStoreId = storeId || await findFirstOwnedSiteId(db, customUser.id);

    if (!resolvedStoreId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    const ownsStore = await verifySiteOwnership(db, resolvedStoreId, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data: installation } = await db
        .from('app_installations')
        .select('id, scopes_granted, config, marketplace_apps(id, name)')
        .eq('app_id', appId)
        .eq('store_id', resolvedStoreId)
        .eq('installed_by', customUser.id)
        .maybeSingle();

    const installConfig = parseJsonRecord(installation?.config);
    const revokedConfig = {
        ...installConfig,
        oauth: {
            ...parseJsonRecord(installConfig.oauth),
            revoked_at: now.toISOString(),
        },
    };

    const { error } = await db
        .from('app_installations')
        .update({
            status: 'uninstalled',
            config: revokedConfig,
            uninstalled_at: now.toISOString(),
        })
        .eq('app_id', appId)
        .eq('store_id', resolvedStoreId)
        .eq('installed_by', customUser.id);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    if (installation?.id) {
        const { data: appWebhookSubscriptions } = await db
            .from('webhook_subscriptions')
            .select('target_url, signing_secret, event_types')
            .eq('site_id', resolvedStoreId)
            .eq('status', 'active')
            .contains('metadata', { app_id: appId, installation_id: installation.id });

        await db
            .from('webhook_subscriptions')
            .update({
                status: 'disabled',
                deleted_at: now.toISOString(),
                updated_by: customUser.id,
            })
            .eq('site_id', resolvedStoreId)
            .contains('metadata', { app_id: appId, installation_id: installation.id });

        const appRecord = parseJsonRecord(installation.marketplace_apps);
        const lifecyclePayload = buildAppLifecycleEventPayload({
            app: {
                id: appId,
                name: stringOrNull(appRecord.name) || 'App',
                api_scopes: stringArray(installation.scopes_granted),
            },
            installationId: installation.id,
            storeId: resolvedStoreId,
            installedBy: customUser.id,
            scopes: stringArray(installation.scopes_granted),
            occurredAt: now.toISOString(),
        });

        await insertAppLifecycleOutbox(db, {
            storeId: resolvedStoreId,
            installationId: installation.id,
            eventType: 'app.uninstalled',
            payload: lifecyclePayload,
            actorId: customUser.id,
            requestId,
        });

        await dispatchAppLifecycleSubscriptions(c.env, {
            eventType: 'app.uninstalled',
            installationId: installation.id,
            payload: lifecyclePayload,
            requestId,
            subscriptions: Array.isArray(appWebhookSubscriptions) ? appWebhookSubscriptions : [],
        });
    }

    return c.json({ data: { uninstalled: true } });
});

// GET /app-store/developers/me — Get current user's developer profile
router.get('/developers/me', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: developer, error } = await db
        .from('app_developers')
        .select('*')
        .eq('user_id', customUser.id)
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ developer: developer || null }));
});

// POST /app-store/developers/register — Register current user as an app developer
router.post('/developers/register', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json() as AppEngineJsonRecord;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const registration = planAppDeveloperRegistration(body, customUser.id);
    if (!registration.ok) {
        return c.json({ error: { code: 'VALIDATION', message: registration.message } }, 400);
    }

    const { data: developer, error } = await db
        .from('app_developers')
        .insert(registration.value)
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            return c.json({ error: { code: 'CONFLICT', message: 'Developer profile already exists for this account or company' } }, 409);
        }
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ developer }), 201);
});

// GET /app-store/developers/apps — List current developer profile and submitted apps
router.get('/developers/apps', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: developer, error: developerError } = await db
        .from('app_developers')
        .select('id, company_name, status, verified')
        .eq('user_id', customUser.id)
        .maybeSingle();

    if (developerError) {
        return c.json({ error: { code: 'DB_ERROR', message: developerError.message } }, 500);
    }

    if (!developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    const { data: apps, error: appsError } = await db
        .from('marketplace_apps')
        .select('id, name, slug, tagline, icon_url, status, install_count, rating_avg, review_count, pricing_model, price_inr, created_at')
        .eq('developer_id', developer.id)
        .order('created_at', { ascending: false });

    if (appsError) {
        return c.json({ error: { code: 'DB_ERROR', message: appsError.message } }, 500);
    }

    const { data: reviewRecords, error: reviewError } = await db
        .from('marketplace_review_records')
        .select([
            'id',
            'submission_type',
            'resource_id',
            'resource_slug',
            'resource_name',
            'partner_user_id',
            'app_developer_id',
            'status',
            'automated_checks',
            'submitted_at',
            'reviewed_by',
            'reviewed_at',
            'review_notes',
            'metadata',
            'created_at',
            'updated_at',
            'deleted_at',
        ].join(', '))
        .eq('app_developer_id', developer.id)
        .order('submitted_at', { ascending: false });

    if (reviewError) {
        return c.json({ error: { code: 'DB_ERROR', message: reviewError.message } }, 500);
    }

    return c.json(success({ developer, apps: apps || [], review_records: reviewRecords || [] }));
});

// POST /app-store/developers/apps — Submit a new marketplace app for review
router.post('/developers/apps', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json() as AppEngineJsonRecord;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: developer } = await db
        .from('app_developers')
        .select('id, status')
        .eq('user_id', customUser.id)
        .maybeSingle();

    if (!developer) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'You must register as a developer first' } }, 403);
    }

    const submission = planMarketplaceAppSubmission(body, developer.id);
    if (!submission.ok) {
        return c.json({ error: { code: 'VALIDATION', message: submission.message } }, 400);
    }

    const { data: existingSlug } = await db
        .from('marketplace_apps')
        .select('id')
        .eq('slug', submission.value.slug)
        .maybeSingle();

    if (existingSlug) {
        return c.json({ error: { code: 'CONFLICT', message: 'This app slug is already taken' } }, 409);
    }

    const { data: app, error } = await db
        .from('marketplace_apps')
        .insert(submission.value)
        .select('id, name, status')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    let reviewRecord: MarketplaceReviewRecord | null = null;
    if (submission.value.status !== 'draft') {
        try {
            reviewRecord = await createMarketplaceReviewRecord(db, {
                submissionType: 'app',
                resourceId: app.id,
                resourceSlug: submission.value.slug,
                resourceName: submission.value.name,
                partnerUserId: customUser.id,
                appDeveloperId: developer.id,
                actorId: customUser.id,
                automatedChecks: buildMarketplaceAutomatedChecks({
                    source: 'platform-console.app_submission',
                    checks: [
                        {
                            name: 'schema_validation',
                            status: 'passed',
                            message: 'App submission payload matched the marketplace contract.',
                        },
                        {
                            name: 'developer_profile',
                            status: 'passed',
                            message: 'Submitting user owns an app developer profile.',
                        },
                        {
                            name: 'built_for_letbuyy_quality_gate',
                            status: Object.keys(parseJsonRecord(body.quality_gate || body.built_for_letbuyy || body.builtForLetBuyy)).length > 0
                                ? 'passed'
                                : 'warning',
                            message: 'Built-for-LetBuyy evidence is optional until listing review requests the badge.',
                        },
                    ],
                    metadata: {
                        app_url: submission.value.app_url,
                        pricing_model: submission.value.pricing_model,
                    },
                }),
                metadata: {
                    source_route: '/app-store/developers/apps',
                    submitted_status: submission.value.status,
                },
            });

            await new EventExecutionAdapter(db).emitDomainEvent({
                storeId: null,
                aggregateType: 'app',
                aggregateId: app.id,
                eventType: 'app.submitted',
                payload: {
                    app_id: app.id,
                    partner_id: developer.id,
                    review_id: reviewRecord.id,
                },
                idempotencyKey: `app.submitted:${app.id}:${reviewRecord.id}`,
                requestId: getRequestId(c),
                actorId: customUser.id,
            });
        } catch (reviewError) {
            const message = reviewError instanceof Error ? reviewError.message : 'Failed to create marketplace review record';
            return c.json({ error: { code: 'DB_ERROR', message } }, 500);
        }
    }

    return c.json(success({ app, review_record: reviewRecord }), 201);
});

// GET /app-store/developers/:id — Get developer profile + apps
router.get('/developers/:id', async (c) => {
    const devId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { data: developer, error } = await db
        .from('app_developers')
        .select('id, company_name, website_url, description, verified, created_at')
        .eq('id', devId)
        .single();

    if (error || !developer) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer not found' } }, 404);
    }

    const { data: apps } = await db
        .from('marketplace_apps')
        .select('id, name, slug, icon_url, tagline, pricing_model, install_count, rating_avg, review_count')
        .eq('developer_id', devId)
        .eq('status', 'published')
        .order('install_count', { ascending: false });

    return c.json(success({ ...developer, apps: apps || [] }));
});

export default router;
