import type { Hono } from 'hono';
import type { Env } from '../../index';
import { findFirstOwnedSiteId, resolveCustomUser, resolveOwnedSiteId, verifySiteOwnership } from '../../lib/auth-user';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { authMiddleware } from '../../middleware/auth';
import {
    createAppScopedAccessToken,
    createLetbuyyInternalIdentityHeaders,
    sha256Hex,
    timingSafeEqualHex,
    verifyAppScopedAccessToken,
} from '@letbuyy/auth-core';
import {
    createAppExtensionLifecycleSnapshot,
    normalizeAppAdminEmbedSurface,
    normalizeAppExtensionRegistryStatus,
    appStoreStringArray as stringArray,
    appStoreStringOrNull as stringOrNull,
    parseAppStoreJsonRecord as parseJsonRecord,
    type AppEngineJsonRecord,
} from '@letbuyy/shared-types';
import { createMobileAdminAppBridgeHostPolicy } from '@letbuyy/shared-types';
import {
    apiBaseUrlFromRequest,
    appOAuthConfig,
    appPlatformTokenSecret,
    bridgeRequiredScopes,
    bridgeTargetUrl,
    getRequestId,
    normalizeBridgeApiRequest,
    readBearerToken,
    recordAppExtensionLifecycleMetric,
} from './shared';

export function registerAppStoreExtensionRoutes(router: Hono<{ Bindings: Env }>): void {
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

    // GET /app-store/installations/:id/extensions — List per-store extension/function registry state
    router.get('/installations/:id/extensions', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const installationId = c.req.param('id');
        const storeId = c.req.query('store_id');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: installation, error: installationError } = await db
            .from('app_installations')
            .select('id, app_id, store_id, status')
            .eq('id', installationId)
            .eq('store_id', await resolveOwnedSiteId(db, customUser.id, storeId, auth.user.storeId))
            .neq('status', 'uninstalled')
            .maybeSingle();

        if (installationError) {
            return c.json({ error: { code: 'DB_ERROR', message: installationError.message } }, 500);
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

        const { data: extensions, error: extensionsError } = await db
            .from('app_extension_registrations')
            .select('*')
            .eq('installation_id', installation.id)
            .eq('site_id', installation.store_id)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true });

        if (extensionsError) {
            return c.json({ error: { code: 'DB_ERROR', message: extensionsError.message } }, 500);
        }

        const { data: functions, error: functionsError } = await db
            .from('app_function_registrations')
            .select('*')
            .eq('installation_id', installation.id)
            .eq('site_id', installation.store_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        if (functionsError) {
            return c.json({ error: { code: 'DB_ERROR', message: functionsError.message } }, 500);
        }

        const extensionRows = extensions || [];
        const functionRows = functions || [];
        const lifecycle = createAppExtensionLifecycleSnapshot({
            extensions: extensionRows,
            functions: functionRows,
            observedAt: new Date().toISOString(),
        });

        return c.json(success({
            installation_id: installation.id,
            app_id: installation.app_id,
            store_id: installation.store_id,
            extensions: extensionRows,
            functions: functionRows,
            lifecycle,
        }));
    });

    // PATCH /app-store/installations/:id/extensions/:registrationId — Enable or disable an extension registration
    router.patch('/installations/:id/extensions/:registrationId', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const installationId = c.req.param('id');
        const registrationId = c.req.param('registrationId');
        const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        const now = new Date().toISOString();

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const status = normalizeAppExtensionRegistryStatus(body.status);
        if (!status || status === 'revoked') {
            return c.json({ error: { code: 'VALIDATION', message: 'status must be enabled or disabled' } }, 400);
        }

        const { data: installation, error: installationError } = await db
            .from('app_installations')
            .select('id, store_id, status')
            .eq('id', installationId)
            .eq('store_id', await resolveOwnedSiteId(db, customUser.id, stringOrNull(body.store_id || body.storeId), auth.user.storeId))
            .neq('status', 'uninstalled')
            .maybeSingle();

        if (installationError) {
            return c.json({ error: { code: 'DB_ERROR', message: installationError.message } }, 500);
        }

        if (!installation) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App installation not found' } }, 404);
        }

        const ownsStore = await verifySiteOwnership(db, installation.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const { data: registration, error } = await db
            .from('app_extension_registrations')
            .update(status === 'enabled'
                ? { status, enabled_at: now, disabled_at: null, updated_by: customUser.id }
                : { status, disabled_at: now, updated_by: customUser.id })
            .eq('id', registrationId)
            .eq('installation_id', installation.id)
            .eq('site_id', installation.store_id)
            .is('deleted_at', null)
            .select()
            .maybeSingle();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        if (!registration) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Extension registration not found' } }, 404);
        }

        const registrationRecord = registration as AppEngineJsonRecord;
        await recordAppExtensionLifecycleMetric(db, {
            siteId: installation.store_id,
            installationId: installation.id,
            appId: stringOrNull(registrationRecord.app_id),
            registrationId,
            registrationKind: 'extension',
            handle: stringOrNull(registrationRecord.extension_handle),
            status: status === 'enabled' ? 'enabled' : 'disabled',
            requestId: getRequestId(c),
            actorId: customUser.id,
        });

        return c.json(success(registration));
    });

    // PATCH /app-store/installations/:id/functions/:registrationId — Enable or disable a function registration
    router.patch('/installations/:id/functions/:registrationId', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const installationId = c.req.param('id');
        const registrationId = c.req.param('registrationId');
        const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        const now = new Date().toISOString();

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const status = normalizeAppExtensionRegistryStatus(body.status);
        if (!status || status === 'revoked') {
            return c.json({ error: { code: 'VALIDATION', message: 'status must be enabled or disabled' } }, 400);
        }

        const { data: installation, error: installationError } = await db
            .from('app_installations')
            .select('id, store_id, status')
            .eq('id', installationId)
            .eq('store_id', await resolveOwnedSiteId(db, customUser.id, stringOrNull(body.store_id || body.storeId), auth.user.storeId))
            .neq('status', 'uninstalled')
            .maybeSingle();

        if (installationError) {
            return c.json({ error: { code: 'DB_ERROR', message: installationError.message } }, 500);
        }

        if (!installation) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App installation not found' } }, 404);
        }

        const ownsStore = await verifySiteOwnership(db, installation.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const { data: registration, error } = await db
            .from('app_function_registrations')
            .update(status === 'enabled'
                ? { status, enabled_at: now, disabled_at: null, updated_by: customUser.id }
                : { status, disabled_at: now, updated_by: customUser.id })
            .eq('id', registrationId)
            .eq('installation_id', installation.id)
            .eq('site_id', installation.store_id)
            .is('deleted_at', null)
            .select()
            .maybeSingle();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        if (!registration) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Function registration not found' } }, 404);
        }

        const registrationRecord = registration as AppEngineJsonRecord;
        await recordAppExtensionLifecycleMetric(db, {
            siteId: installation.store_id,
            installationId: installation.id,
            appId: stringOrNull(registrationRecord.app_id),
            registrationId,
            registrationKind: 'function',
            handle: stringOrNull(registrationRecord.function_handle),
            status: status === 'enabled' ? 'enabled' : 'disabled',
            requestId: getRequestId(c),
            actorId: customUser.id,
        });

        return c.json(success(registration));
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
            .eq('store_id', await resolveOwnedSiteId(db, customUser.id, storeId, auth.user.storeId))
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

        const embed = normalizeAppAdminEmbedSurface(installation);
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
            .eq('id', installation.id)
            .eq('store_id', installation.store_id);

        if (bridgeTokenError) {
            return c.json({ error: { code: 'DB_ERROR', message: bridgeTokenError.message } }, 500);
        }

        const session = {
            installation,
            embed,
            bridge: {
                version: '2026-06-01',
                token_type: 'Bearer' as const,
                access_token: accessToken,
                expires_at: expiresAt,
                api_base_url: apiBaseUrlFromRequest(c.req.url),
                store_id: installation.store_id,
                installation_id: installation.id,
                app_id: installation.app_id,
                scopes,
                capabilities: embed.capabilities,
            },
        };

        return c.json(success({
            ...session,
            mobile_host: createMobileAdminAppBridgeHostPolicy({ session }),
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
        const currentScopes = new Set(stringArray(installation.scopes_granted));
        if (!requiredScopes.every(scope => currentScopes.has(scope))) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'The required app permission has been revoked' } }, 403);
        }
        if (!await verifySiteOwnership(db, installation.store_id, installation.installed_by)) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'The installing account no longer owns this store' } }, 403);
        }

        const tokenHash = await sha256Hex(verification.token);
        const oauth = appOAuthConfig(installation.config);
        const isKnownToken = timingSafeEqualHex(stringOrNull(oauth.bridge_token_hash), tokenHash)
            || timingSafeEqualHex(stringOrNull(oauth.access_token_hash), tokenHash);
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
}
