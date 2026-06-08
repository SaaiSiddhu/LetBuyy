import type { Hono } from 'hono';
import type { Env } from '../../index';
import { findFirstOwnedSiteId, resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { IdempotencyExecutionAdapter } from '../../execution/idempotency-execution.adapter';
import { authMiddleware } from '../../middleware/auth';
import {
    createAppScopedAccessToken,
    sha256Hex,
} from '@letbuyy/auth-core';
import {
    buildAppLifecycleEventPayload,
    appStoreStringArray as stringArray,
    appStoreStringOrNull as stringOrNull,
    normalizeAppInstallScopes,
    parseAppStoreJsonRecord as parseJsonRecord,
    planAppWebhookSubscriptions,
    type AppEngineJsonRecord,
} from '@letbuyy/app-engine';
import {
    appComplianceWebhookEventIdPrefix,
    appExtensionRegistryConfig,
    appLifecycleWebhookDefinitions,
    appOAuthConfig,
    appPlatformTokenSecret,
    buildAppComplianceWebhookPayload,
    dispatchAppLifecycleSubscriptions,
    getRequestId,
    insertAppLifecycleOutbox,
    insertAppWebhookSubscriptions,
    registerAppExtensionRegistry,
    revokeAppExtensionRegistry,
} from './shared';

const INSTALL_PRICING_PLAN_SELECT = 'id, app_id, developer_id, plan_slug, name, description, pricing_model, billing_mode, currency, amount_minor, interval, trial_days, usage_meter, usage_unit, included_usage, usage_unit_amount_minor, features, limits, is_default, status, sort_order';

export function registerAppStoreInstallLifecycleRoutes(router: Hono<{ Bindings: Env }>): void {
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

        // Idempotency: dedupe double-submitted installs when the caller sends an Idempotency-Key (H9).
        const idempotencyKey = c.req.header('X-Idempotency-Key');
        const idempotency = idempotencyKey ? new IdempotencyExecutionAdapter(db) : null;
        let idempotencyClaimId: string | null = null;
        if (idempotency && idempotencyKey) {
            const claim = await idempotency.begin({
                siteId: storeId,
                key: idempotencyKey,
                scope: 'app-store.install',
                requestBody: body,
                requestId,
            });
            if (claim.kind === 'replay') {
                return c.json(claim.responseBody as any, claim.statusCode as any);
            }
            idempotencyClaimId = claim.id;
        }

        let idempotencyCompleted = false;
        try {
        // Verify app exists and is published
        const { data: app } = await db
            .from('marketplace_apps')
            .select('id, name, api_scopes, conflict_app_ids, app_webhooks(id, event, url, secret, is_active)')
            .eq('id', appId)
            .eq('status', 'published')
            .single();

        if (!app) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'App not found or not available' } }, 404);
        }

        const conflictAppIds = stringArray(app.conflict_app_ids);
        if (conflictAppIds.length > 0) {
            const { data: activeConflicts, error: conflictError } = await db
                .from('app_installations')
                .select('app_id, marketplace_apps(id, name, slug)')
                .eq('store_id', storeId)
                .eq('status', 'active')
                .in('app_id', conflictAppIds);

            if (conflictError) {
                return c.json({ error: { code: 'DB_ERROR', message: conflictError.message } }, 500);
            }

            if (activeConflicts && activeConflicts.length > 0) {
                return c.json({
                    error: {
                        code: 'APP_CONFLICT',
                        message: 'This app conflicts with an app already installed on this store.',
                    },
                    conflicts: activeConflicts,
                }, 409);
            }
        }

        const scopes = normalizeAppInstallScopes(body.scopes, app.api_scopes || []);
        if (!scopes.ok) {
            return c.json({ error: { code: 'VALIDATION', message: scopes.message } }, 400);
        }

        const appSecret = appPlatformTokenSecret(c.env);
        if (!appSecret) {
            return c.json({ error: { code: 'SERVER_MISCONFIGURED', message: 'App OAuth token secret is not configured' } }, 500);
        }

        const requestedPricingPlanId = stringOrNull(body.pricing_plan_id || body.pricingPlanId);
        const pricingPlanQuery = db
            .from('app_pricing_plans')
            .select(INSTALL_PRICING_PLAN_SELECT)
            .eq('app_id', appId)
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('is_default', { ascending: false })
            .order('sort_order', { ascending: true })
            .limit(1);
        const { data: pricingPlans, error: pricingPlanError } = requestedPricingPlanId
            ? await db
                .from('app_pricing_plans')
                .select(INSTALL_PRICING_PLAN_SELECT)
                .eq('id', requestedPricingPlanId)
                .eq('app_id', appId)
                .eq('status', 'active')
                .is('deleted_at', null)
                .limit(1)
            : await pricingPlanQuery;

        if (pricingPlanError) {
            return c.json({ error: { code: 'DB_ERROR', message: pricingPlanError.message } }, 500);
        }

        const selectedPricingPlan = Array.isArray(pricingPlans) ? (pricingPlans[0] || null) : pricingPlans;
        if (requestedPricingPlanId && !selectedPricingPlan) {
            return c.json({ error: { code: 'VALIDATION', message: 'Selected pricing plan is not available for this app' } }, 400);
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
        const webhookDefinitions = appLifecycleWebhookDefinitions(app.app_webhooks, body);
        const defaultSigningSecret = crypto.randomUUID();
        const webhookSubscriptions = planAppWebhookSubscriptions({
            app,
            storeId,
            installationId: data.id,
            installedBy: customUser.id,
            webhookDefinitions,
            defaultSigningSecret,
        });
        const insertedSubscriptions = await insertAppWebhookSubscriptions(db, webhookSubscriptions);
        const durableWebhookSubscriptions = webhookSubscriptions.map((subscription, index) => ({
            ...subscription,
            id: insertedSubscriptions[index]?.id,
        }));
        const registry = await registerAppExtensionRegistry(db, {
            body,
            appId: app.id,
            storeId,
            installationId: data.id,
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
                token_type: 'Bearer',
                access_token_hash: accessTokenHash,
                scopes: scopes.value,
                issued_at: now.toISOString(),
                expires_at: expiresAt,
            },
            webhooks: {
                subscription_ids: insertedSubscriptions.map((subscription) => subscription.id),
            },
            ...(selectedPricingPlan ? {
                billing: {
                    selected_plan_id: selectedPricingPlan.id,
                    selected_plan_slug: selectedPricingPlan.plan_slug,
                    selected_plan_snapshot: selectedPricingPlan,
                },
            } : {}),
            ...(registryConfig ? { extension_registry: registryConfig } : {}),
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

        await db.from('app_activity_events').insert({
            site_id: storeId,
            app_id: appId,
            installation_id: data.id,
            actor_id: customUser.id,
            event_type: 'installed',
            summary: `${app.name || 'App'} installed`,
            metadata: {
                request_id: requestId,
                scopes: scopes.value,
                pricing_plan_id: selectedPricingPlan?.id || null,
            },
        });

        await dispatchAppLifecycleSubscriptions(c.env, {
            db,
            eventType: 'app.installed',
            installationId: data.id,
            siteId: storeId,
            actorId: customUser.id,
            payload: lifecyclePayload,
            requestId,
            subscriptions: durableWebhookSubscriptions,
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

        const installResponse = success({
            installation: finalInstallation || data,
            oauth: {
                access_token: accessToken,
                token_type: 'Bearer',
                expires_at: expiresAt,
                scopes: scopes.value,
            },
            webhooks: {
                subscriptions: insertedSubscriptions,
                // Show-once: the server-generated signing secret for app-supplied webhooks (M5).
                signing_secret: defaultSigningSecret,
            },
            extension_registry: registry.value,
            pricing_plan: selectedPricingPlan,
        });
        if (idempotency && idempotencyClaimId) {
            await idempotency.complete({ id: idempotencyClaimId, responseBody: installResponse as any, statusCode: 201, resourceType: 'app_installation', resourceId: data.id });
            idempotencyCompleted = true;
        }
        return c.json(installResponse, 201);
        } finally {
            // Release the idempotency key on any non-success exit (error return or throw) so a
            // failed install is immediately retryable instead of waiting for lock expiry (H9).
            if (idempotency && idempotencyClaimId && !idempotencyCompleted) {
                await idempotency.fail(idempotencyClaimId);
            }
        }
    });

    // DELETE /app-store/apps/:id/install — Uninstall an app
    router.delete('/apps/:id/install', authMiddleware, async (c) => {
        const auth = c.get('auth');
        const appId = c.req.param('id');
        const storeId = c.req.query('store_id');
        const body = await c.req.json().catch(() => ({})) as AppEngineJsonRecord;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        const requestId = getRequestId(c);
        const now = new Date();
        const reasonCode = stringOrNull(body.reason_code || body.reasonCode);
        const reasonText = stringOrNull(body.reason_text || body.reasonText || body.feedback);

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

        // Idempotency: dedupe double-submitted uninstalls when the caller sends an Idempotency-Key (H9).
        const idempotencyKey = c.req.header('X-Idempotency-Key');
        const idempotency = idempotencyKey ? new IdempotencyExecutionAdapter(db) : null;
        let idempotencyClaimId: string | null = null;
        if (idempotency && idempotencyKey) {
            const claim = await idempotency.begin({
                siteId: resolvedStoreId,
                key: idempotencyKey,
                scope: 'app-store.uninstall',
                requestBody: { app_id: appId, store_id: resolvedStoreId, reason_code: reasonCode, reason_text: reasonText },
                requestId,
            });
            if (claim.kind === 'replay') {
                return c.json(claim.responseBody as any, claim.statusCode as any);
            }
            idempotencyClaimId = claim.id;
        }

        let idempotencyCompleted = false;
        try {
        const { data: installation } = await db
            .from('app_installations')
            .select('id, scopes_granted, config, marketplace_apps(id, name)')
            .eq('app_id', appId)
            .eq('store_id', resolvedStoreId)
            .eq('installed_by', customUser.id)
            .maybeSingle();

        const installConfig = parseJsonRecord(installation?.config);
        let feedbackPersisted = false;
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
            if (reasonCode || reasonText) {
                const { error: feedbackError } = await db
                    .from('app_uninstall_feedback')
                    .insert({
                        site_id: resolvedStoreId,
                        app_id: appId,
                        installation_id: installation.id,
                        reason_code: reasonCode ? reasonCode.slice(0, 80) : null,
                        reason_text: reasonText ? reasonText.slice(0, 1000) : null,
                        submitted_by: customUser.id,
                        metadata: { request_id: requestId },
                    });
                feedbackPersisted = !feedbackError;
            }

            const { data: appWebhookSubscriptions } = await db
                .from('webhook_subscriptions')
                .select('id, target_url, signing_secret, event_types')
                .eq('site_id', resolvedStoreId)
                .eq('status', 'active')
                .contains('metadata', { app_id: appId, installation_id: installation.id });
            const activeSubscriptions = Array.isArray(appWebhookSubscriptions) ? appWebhookSubscriptions : [];
            const appRecord = parseJsonRecord(installation.marketplace_apps);

            if (activeSubscriptions.length > 0 && c.env.WEBHOOK_SERVICE && c.env.INTERNAL_API_SECRET) {
                await dispatchAppLifecycleSubscriptions(c.env, {
                    db,
                    eventType: 'shop/redact',
                    installationId: installation.id,
                    siteId: resolvedStoreId,
                    actorId: customUser.id,
                    eventIdPrefix: appComplianceWebhookEventIdPrefix({
                        eventType: 'shop/redact',
                        storeId: resolvedStoreId,
                        idempotencyKey: `app-uninstall:${appId}:${installation.id}`,
                    }),
                    payload: buildAppComplianceWebhookPayload({
                        eventType: 'shop/redact',
                        storeId: resolvedStoreId,
                        occurredAt: now.toISOString(),
                        requestId,
                        triggerSource: 'app_uninstall',
                        actorId: customUser.id,
                        reason: 'app_uninstalled',
                        appUninstall: { appId, installationId: installation.id },
                    }),
                    requestId,
                    subscriptions: activeSubscriptions,
                });
            }

            await db
                .from('webhook_subscriptions')
                .update({
                    status: 'disabled',
                    deleted_at: now.toISOString(),
                    updated_by: customUser.id,
                })
                .eq('site_id', resolvedStoreId)
                .contains('metadata', { app_id: appId, installation_id: installation.id });

            const registryRevocation = await revokeAppExtensionRegistry(db, {
                installationId: installation.id,
                actorId: customUser.id,
                revokedAt: now.toISOString(),
            });

            if (!registryRevocation.ok) {
                return c.json({ error: { code: registryRevocation.code, message: registryRevocation.message } }, registryRevocation.status);
            }

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

            await db.from('app_activity_events').insert({
                site_id: resolvedStoreId,
                app_id: appId,
                installation_id: installation.id,
                actor_id: customUser.id,
                event_type: 'uninstalled',
                summary: `${stringOrNull(appRecord.name) || 'App'} uninstalled`,
                metadata: {
                    request_id: requestId,
                    reason_code: reasonCode,
                    feedback_persisted: feedbackPersisted,
                },
            });

            await dispatchAppLifecycleSubscriptions(c.env, {
                db,
                eventType: 'app.uninstalled',
                installationId: installation.id,
                siteId: resolvedStoreId,
                actorId: customUser.id,
                payload: lifecyclePayload,
                requestId,
                subscriptions: activeSubscriptions,
            });
        }

        const uninstallResponse = { data: { uninstalled: true, feedback_persisted: feedbackPersisted } };
        if (idempotency && idempotencyClaimId) {
            await idempotency.complete({ id: idempotencyClaimId, responseBody: uninstallResponse, statusCode: 200, resourceType: 'app_installation' });
            idempotencyCompleted = true;
        }
        return c.json(uninstallResponse);
        } finally {
            // Release the idempotency key on any non-success exit (error return or throw) so a
            // failed uninstall is immediately retryable instead of waiting for lock expiry (H9).
            if (idempotency && idempotencyClaimId && !idempotencyCompleted) {
                await idempotency.fail(idempotencyClaimId);
            }
        }
    });
}
