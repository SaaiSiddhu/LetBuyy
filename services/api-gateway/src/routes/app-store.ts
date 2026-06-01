import { Hono } from 'hono';
import type { Env } from '../index';
import { findFirstOwnedSiteId, resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import {
    createAppScopedAccessToken,
    getLetbuyyInternalAuthSecret,
    sha256Hex,
} from '@letbuyy/auth-core';
import {
    buildAppLifecycleEventPayload,
    appStoreStringArray as stringArray,
    appStoreStringOrNull as stringOrNull,
    isAppStoreUuid as isUuid,
    normalizeAppAdminEmbedSurface,
    normalizeAppInstallScopes,
    normalizeAppWebhookDefinitions,
    parseAppStoreJsonRecord as parseJsonRecord,
    planAppWebhookSubscriptions,
    planAppDeveloperRegistration,
    planMarketplaceAppSubmission,
    type AppEngineJsonRecord,
    type AppWebhookDefinition,
    type AppWebhookSubscriptionInsert,
} from '@letbuyy/app-engine';

const router = new Hono<{ Bindings: Env }>();

type AppLifecycleEventType = 'app.installed' | 'app.uninstalled';

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

    return c.json(success({
        installation,
        embed,
        bridge: {
            version: '2026-06-01',
            token_type: 'Bearer',
            access_token: accessToken,
            expires_at: expiresAt,
            store_id: installation.store_id,
            installation_id: installation.id,
            app_id: installation.app_id,
            scopes,
            capabilities: embed.capabilities,
        },
    }));
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

    return c.json(success({ developer, apps: apps || [] }));
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

    return c.json(success({ app }), 201);
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
