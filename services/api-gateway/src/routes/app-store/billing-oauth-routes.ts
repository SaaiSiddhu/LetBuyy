import type { Hono } from 'hono';
import type { Env } from '../../index';
import { findFirstOwnedSiteId, resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { authMiddleware } from '../../middleware/auth';
import {
    appOAuthClientId,
    buildAppOAuthRedirectUrl,
    buildAppLifecycleEventPayload,
    appStoreStringArray as stringArray,
    appStoreStringOrNull as stringOrNull,
    normalizeAppInstallScopes,
    normalizeAppOAuthRedirectUri,
    parseAppStoreJsonRecord as parseJsonRecord,
    planAppWebhookSubscriptions,
    type AppEngineJsonRecord,
} from '@letbuyy/app-engine';
import {
    createAppAuthorizationCode,
    sha256Hex,
    verifyAppAuthorizationCode,
} from '@letbuyy/auth-core';
import {
    ApproveAppBillingChargeSchema,
    CreateAppBillingChargeSchema,
    planAppBillingCharge,
} from '@letbuyy/billing-core';
import {
    appendAppOAuthTokenConfig,
    appBillingMode,
    appChargeProviderMode,
    appExtensionRegistryConfig,
    appLifecycleWebhookDefinitions,
    appOAuthConfig,
    appOAuthGrantType,
    appOAuthState,
    appPayoutRail,
    appPlatformTokenSecret,
    dispatchAppLifecycleSubscriptions,
    firstRelatedRecord,
    getRequestId,
    insertAppChargeOutbox,
    insertAppLifecycleOutbox,
    insertAppWebhookSubscriptions,
    mintAppOAuthRefreshToken,
    mintAppOAuthAccessToken,
    normalizeAppOAuthPkceChallenge,
    registerAppExtensionRegistry,
    verifyAppOAuthPkceVerifier,
    type AppBillingChargeRecord,
} from './shared';

export function registerAppStoreBillingOAuthRoutes(router: Hono<{ Bindings: Env }>): void {
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

        const redirect = normalizeAppOAuthRedirectUri(body.redirect_uri || body.redirectUri, app.oauth_redirect_uris);
        if (!redirect.ok) {
            return c.json({ error: { code: 'VALIDATION', message: redirect.message } }, 400);
        }

        const pkce = normalizeAppOAuthPkceChallenge(
            body.code_challenge || body.codeChallenge,
            body.code_challenge_method || body.codeChallengeMethod,
        );
        if (!pkce.ok) {
            return c.json({ error: { code: 'VALIDATION', message: pkce.message } }, 400);
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
        const webhookDefinitions = appLifecycleWebhookDefinitions(app.app_webhooks, body);
        const defaultSigningSecret = crypto.randomUUID();
        const webhookSubscriptions = planAppWebhookSubscriptions({
            app,
            storeId,
            installationId: installation.id,
            installedBy: customUser.id,
            webhookDefinitions,
            defaultSigningSecret,
        });
        const insertedSubscriptions = await insertAppWebhookSubscriptions(db, webhookSubscriptions);
        const registry = await registerAppExtensionRegistry(db, {
            body,
            appId: app.id,
            storeId,
            installationId: installation.id,
            installedBy: customUser.id,
            registeredAt: now.toISOString(),
        });

        if (!registry.ok) {
            return c.json({ error: { code: registry.code, message: registry.message } }, registry.status);
        }

        const registryConfig = appExtensionRegistryConfig(registry.value, now.toISOString());
        const finalConfig = {
            ...parseJsonRecord(body.config),
            oauth: {
                authorization_code: {
                    code_hash: authorizationCodeHash,
                    client_id: clientId,
                    redirect_uri: redirect.value,
                    code_challenge: pkce.value.codeChallenge,
                    code_challenge_method: pkce.value.codeChallengeMethod,
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
            ...(registryConfig ? { extension_registry: registryConfig } : {}),
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
            extension_registry: registry.value,
        }), 201);
    });

    // POST /app-store/oauth/token — Exchange an app authorization code for a scoped token
    router.post('/oauth/token', async (c) => {
        const body = await c.req.json() as AppEngineJsonRecord;
        const grantType = appOAuthGrantType(body.grant_type || body.grantType);
        if (!grantType) {
            return c.json({ error: { code: 'VALIDATION', message: 'grant_type must be authorization_code or refresh_token' } }, 400);
        }

        const appSecret = appPlatformTokenSecret(c.env);
        if (!appSecret) {
            return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App OAuth token secret is not configured' } }, 500);
        }

        if (grantType === 'refresh_token') {
            const refreshToken = stringOrNull(body.refresh_token || body.refreshToken);
            const clientId = stringOrNull(body.client_id || body.clientId);
            if (!refreshToken || !clientId) {
                return c.json({ error: { code: 'VALIDATION', message: 'refresh_token and client_id are required' } }, 400);
            }

            const refreshTokenHash = await sha256Hex(refreshToken);
            const db = getSupabaseAdmin(c);
            const { data: installation, error } = await db
                .from('app_installations')
                .select('id, app_id, store_id, installed_by, status, scopes_granted, config, marketplace_apps(id, name, oauth_client_id)')
                .eq('status', 'active')
                .contains('config', { oauth: { refresh_token_hash: refreshTokenHash } })
                .maybeSingle();

            if (error) {
                return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
            }

            if (!installation) {
                return c.json({ error: { code: 'INVALID_GRANT', message: 'Refresh token is invalid or revoked' } }, 400);
            }

            const app = firstRelatedRecord(installation.marketplace_apps);
            const expectedClientId = appOAuthClientId({
                id: stringOrNull(app.id) || installation.app_id,
                name: stringOrNull(app.name) || 'Installed app',
                oauth_client_id: stringOrNull(app.oauth_client_id),
            });
            if (expectedClientId !== clientId) {
                return c.json({ error: { code: 'INVALID_GRANT', message: 'Refresh token client mismatch' } }, 400);
            }

            const now = new Date();
            const oauth = appOAuthConfig(installation.config);
            const refreshExpiresAt = stringOrNull(oauth.refresh_token_expires_at);
            if (!refreshExpiresAt || Date.parse(refreshExpiresAt) <= now.getTime()) {
                return c.json({ error: { code: 'INVALID_GRANT', message: 'Refresh token is expired' } }, 400);
            }

            const previouslyGrantedScopes = stringArray(oauth.scopes).length > 0
                ? stringArray(oauth.scopes)
                : stringArray(installation.scopes_granted);
            const scopes = Array.isArray(body.scopes)
                ? normalizeAppInstallScopes(body.scopes, previouslyGrantedScopes)
                : { ok: true as const, value: previouslyGrantedScopes };
            if (!scopes.ok) {
                return c.json({ error: { code: 'VALIDATION', message: scopes.message } }, 400);
            }

            const minted = await mintAppOAuthAccessToken({
                appId: installation.app_id,
                installationId: installation.id,
                storeId: installation.store_id,
                installedBy: installation.installed_by,
                scopes: scopes.value,
                secret: appSecret,
                now,
            });
            const refreshed = await mintAppOAuthRefreshToken({ now });
            const finalConfig = appendAppOAuthTokenConfig({
                existingConfig: installation.config,
                accessTokenHash: minted.hash,
                refreshTokenHash: refreshed.hash,
                scopes: scopes.value,
                issuedAt: now.toISOString(),
                expiresAt: minted.response.expires_at,
                refreshExpiresAt: refreshed.expiresAt,
            });
            const { error: updateError } = await db
                .from('app_installations')
                .update({ config: finalConfig })
                .eq('id', installation.id);

            if (updateError) {
                return c.json({ error: { code: 'DB_ERROR', message: updateError.message } }, 500);
            }

            return c.json(success({
                ...minted.response,
                refresh_token: refreshed.token,
                refresh_expires_at: refreshed.expiresAt,
            }));
        }

        const code = stringOrNull(body.code);
        const clientId = stringOrNull(body.client_id || body.clientId);
        const redirectUri = stringOrNull(body.redirect_uri || body.redirectUri);
        const codeVerifier = stringOrNull(body.code_verifier || body.codeVerifier);
        if (!code || !clientId || !redirectUri || !codeVerifier) {
            return c.json({ error: { code: 'VALIDATION', message: 'code, client_id, redirect_uri, and code_verifier are required' } }, 400);
        }

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

        const pkceAccepted = await verifyAppOAuthPkceVerifier(
            codeVerifier,
            authorizationCodeConfig.code_challenge,
            authorizationCodeConfig.code_challenge_method,
        );
        if (!pkceAccepted) {
            return c.json({ error: { code: 'INVALID_GRANT', message: 'Authorization code verifier mismatch' } }, 400);
        }

        const now = new Date();
        const minted = await mintAppOAuthAccessToken({
            appId: verification.payload.appId,
            installationId: verification.payload.installationId,
            storeId: verification.payload.storeId,
            installedBy: verification.payload.installedBy,
            scopes: verification.payload.scopes,
            secret: appSecret,
            now,
        });
        const refreshed = await mintAppOAuthRefreshToken({ now });
        const finalConfig = appendAppOAuthTokenConfig({
            existingConfig: installation.config,
            accessTokenHash: minted.hash,
            refreshTokenHash: refreshed.hash,
            scopes: verification.payload.scopes,
            issuedAt: now.toISOString(),
            expiresAt: minted.response.expires_at,
            refreshExpiresAt: refreshed.expiresAt,
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

        return c.json(success({
            ...minted.response,
            refresh_token: refreshed.token,
            refresh_expires_at: refreshed.expiresAt,
        }));
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
}
