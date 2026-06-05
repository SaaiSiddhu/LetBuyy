import type { Env } from '../../index';
import { getSupabaseAdmin } from '../../lib/supabase';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import { ObservabilityExecutionAdapter } from '../../execution/observability-execution.adapter';
import {
    createAppScopedAccessToken,
    getLetbuyyInternalAuthSecret,
    sha256Hex,
} from '@letbuyy/auth-core';
import {
    LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION,
    appStoreStringArray as stringArray,
    appStoreStringOrNull as stringOrNull,
    normalizeAppWebhookDefinitions,
    parseAppStoreJsonRecord as parseJsonRecord,
    planAppExtensionRegistryInstall,
    type AppEngineJsonRecord,
    type AppExtensionRegistryInstallPlan,
    type AppWebhookDefinition,
    type AppWebhookSubscriptionInsert,
} from '@letbuyy/app-engine';
import type {
    AppChargeBillingMode,
    AppChargeProviderMode,
    IndiaPayoutRail,
} from '@letbuyy/billing-core';

export type AppLifecycleEventType = 'app.installed' | 'app.uninstalled';
export type AppOAuthGrantType = 'authorization_code';

export interface AppOAuthTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_at: string;
    scope: string;
    scopes: string[];
    installation_id: string;
    app_id: string;
    store_id: string;
}

export interface BridgeApiRequest {
    method: 'GET';
    path: string;
    storeId?: string | null;
}

export interface AppBillingChargeRecord {
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

export interface AppExtensionRegistryMutationResult {
    manifest: AppExtensionRegistryInstallPlan['manifest'] | null;
    extensionRegistrations: AppEngineJsonRecord[];
    functionRegistrations: AppEngineJsonRecord[];
}

export type AppExtensionRegistryPersistenceResult =
    | { ok: true; value: AppExtensionRegistryMutationResult }
    | { ok: false; status: 400 | 500; code: string; message: string };

export function getRequestId(c: { req: { header(name: string): string | undefined }; res: { headers: Headers } }): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

export function appPlatformTokenSecret(env: Env): string | undefined {
    return getLetbuyyInternalAuthSecret({
        INTERNAL_API_SECRET: env.INTERNAL_API_SECRET,
        AUTH_SECRET: env.AUTH_SECRET,
    });
}

export function appOAuthState(value: unknown): string | null {
    const state = stringOrNull(value);
    return state && state.length <= 500 ? state : null;
}

export function appOAuthGrantType(value: unknown): AppOAuthGrantType | null {
    return value === 'authorization_code' ? value : null;
}

export function appOAuthConfig(config: unknown): AppEngineJsonRecord {
    return parseJsonRecord(parseJsonRecord(config).oauth);
}

export function firstRelatedRecord(value: unknown): AppEngineJsonRecord {
    if (Array.isArray(value)) {
        return parseJsonRecord(value[0]);
    }

    return parseJsonRecord(value);
}

export function appBillingMode(value: unknown): AppChargeBillingMode {
    return value === 'usage' ? 'usage' : 'recurring';
}

export function appChargeProviderMode(value: unknown): AppChargeProviderMode {
    return value === 'live' ? 'live' : 'test';
}

export function appPayoutRail(value: unknown): IndiaPayoutRail | null {
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

export function numberValue(value: unknown): number {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
}

export function sumMinor(rows: AppEngineJsonRecord[], key: string): number {
    return rows.reduce((total, row) => total + Math.max(0, Math.trunc(numberValue(row[key]))), 0);
}

export function partnerRequestCode(developerId: string): string {
    return `LBP-${developerId.slice(0, 8).toUpperCase()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export function siteFromRelatedRecord(value: unknown): AppEngineJsonRecord {
    const record = firstRelatedRecord(value);
    return Object.keys(record).length > 0 ? record : parseJsonRecord(value);
}

export function partnerStoreFromMembership(row: AppEngineJsonRecord): AppEngineJsonRecord {
    const site = siteFromRelatedRecord(row.sites);
    const roleSlugs = stringArray(row.role_slugs);
    return {
        id: stringOrNull(site.id) || stringOrNull(row.site_id) || '',
        name: stringOrNull(site.name) || stringOrNull(site.store_name) || 'Managed store',
        subdomain: stringOrNull(site.subdomain),
        site_type: stringOrNull(site.site_type),
        status: stringOrNull(site.status),
        role_slugs: roleSlugs,
        managed: !roleSlugs.includes('owner'),
        created_at: stringOrNull(site.created_at) || stringOrNull(row.created_at),
    };
}

export function partnerStoreFromOwnedSite(row: AppEngineJsonRecord): AppEngineJsonRecord {
    return {
        id: stringOrNull(row.id) || '',
        name: stringOrNull(row.name) || stringOrNull(row.store_name) || 'Development store',
        subdomain: stringOrNull(row.subdomain),
        site_type: stringOrNull(row.site_type),
        status: stringOrNull(row.status),
        role_slugs: ['owner'],
        managed: false,
        created_at: stringOrNull(row.created_at),
    };
}

export function appendAppOAuthTokenConfig(input: {
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

export async function mintAppOAuthAccessToken(input: {
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

export function apiBaseUrlFromRequest(requestUrl: string): string {
    const url = new URL('/v1', requestUrl);
    return url.toString().replace(/\/$/, '');
}

export function readBearerToken(value: string | undefined): string | null {
    if (!value?.startsWith('Bearer ')) return null;
    const token = value.slice('Bearer '.length).trim();
    return token || null;
}

export function normalizeBridgeApiRequest(body: AppEngineJsonRecord): BridgeApiRequest | null {
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

export function bridgeRequiredScopes(path: string): string[] | null {
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

export function bridgeTargetUrl(requestUrl: string, path: string, storeId: string): string | null {
    const target = new URL(`/v1${path}`, requestUrl);
    const requestedStoreId = target.searchParams.get('store_id');
    if (requestedStoreId && requestedStoreId !== storeId) return null;
    target.searchParams.set('store_id', storeId);
    return target.toString();
}

export function appLifecycleWebhookDefinitions(appWebhooks: unknown, body: AppEngineJsonRecord): AppWebhookDefinition[] {
    const configured = normalizeAppWebhookDefinitions(appWebhooks);
    const requestedUrl = stringOrNull(body.webhook_url || body.webhookUrl);
    if (!requestedUrl) return configured;

    return [
        ...configured,
        ...normalizeAppWebhookDefinitions([{
            event: body.webhook_event || body.webhookEvent || 'app.installed',
            url: requestedUrl,
            // Signing secret is generated server-side (see defaultSigningSecret); never accepted from the client body (M5).
            is_active: true,
        }]),
    ];
}

export async function insertAppLifecycleOutbox(
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

export async function insertAppChargeOutbox(
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

export async function insertAppWebhookSubscriptions(
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

export async function dispatchAppLifecycleThroughWebhookService(env: Env, input: {
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

export async function dispatchAppLifecycleSubscriptions(env: Env, input: {
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

export function appManifestInputFromInstallBody(body: AppEngineJsonRecord): unknown | null {
    const config = parseJsonRecord(body.config);
    return body.manifest
        || body.app_manifest
        || body.appManifest
        || config.manifest
        || config.app_manifest
        || config.appManifest
        || null;
}

export function appExtensionRegistryConfig(input: AppExtensionRegistryMutationResult, registeredAt: string): AppEngineJsonRecord | null {
    if (!input.manifest) return null;

    return {
        manifest_schema_version: input.manifest.schema_version,
        manifest_app_slug: input.manifest.app.slug,
        manifest_app_version: input.manifest.app.version,
        extension_count: input.extensionRegistrations.length,
        function_count: input.functionRegistrations.length,
        registered_at: registeredAt,
    };
}

export async function recordAppExtensionLifecycleMetric(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        installationId: string;
        appId?: string | null;
        registrationId: string;
        registrationKind: 'extension' | 'function';
        handle?: string | null;
        status: 'enabled' | 'disabled';
        requestId: string;
        actorId: string;
    },
): Promise<void> {
    try {
        await new ObservabilityExecutionAdapter(db).recordMetric({
            metricName: 'app_extension.lifecycle.status_changed',
            siteId: input.siteId,
            requestId: input.requestId,
            metricValue: 1,
            unit: 'count',
            dimensions: {
                lifecycle_version: LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION,
                installation_id: input.installationId,
                app_id: input.appId || null,
                registration_id: input.registrationId,
                registration_kind: input.registrationKind,
                handle: input.handle || null,
                status: input.status,
            },
            metadata: {
                actor_id: input.actorId,
            },
        });
    } catch {
        // Optional metrics tables must not block merchant lifecycle mutations.
    }
}

export async function registerAppExtensionRegistry(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        body: AppEngineJsonRecord;
        appId: string;
        storeId: string;
        installationId: string;
        installedBy: string;
        registeredAt: string;
    },
): Promise<AppExtensionRegistryPersistenceResult> {
    const manifestInput = appManifestInputFromInstallBody(input.body);
    if (!manifestInput) {
        return {
            ok: true,
            value: {
                manifest: null,
                extensionRegistrations: [],
                functionRegistrations: [],
            },
        };
    }

    const plan = planAppExtensionRegistryInstall({
        appId: input.appId,
        storeId: input.storeId,
        installationId: input.installationId,
        installedBy: input.installedBy,
        manifestInput,
        registeredAt: input.registeredAt,
    });

    if (!plan.ok) {
        return { ok: false, status: 400, code: 'VALIDATION', message: plan.message };
    }

    const revokePatch = {
        status: 'revoked',
        revoked_at: input.registeredAt,
        deleted_at: input.registeredAt,
        updated_by: input.installedBy,
    };
    const { error: revokeExtensionsError } = await db
        .from('app_extension_registrations')
        .update(revokePatch)
        .eq('installation_id', input.installationId)
        .neq('status', 'revoked');

    if (revokeExtensionsError) {
        return { ok: false, status: 500, code: 'DB_ERROR', message: revokeExtensionsError.message };
    }

    const { error: revokeFunctionsError } = await db
        .from('app_function_registrations')
        .update(revokePatch)
        .eq('installation_id', input.installationId)
        .neq('status', 'revoked');

    if (revokeFunctionsError) {
        return { ok: false, status: 500, code: 'DB_ERROR', message: revokeFunctionsError.message };
    }

    let extensionRegistrations: AppEngineJsonRecord[] = [];
    if (plan.value.extensionRegistrations.length > 0) {
        const { data, error } = await db
            .from('app_extension_registrations')
            .upsert(
                plan.value.extensionRegistrations.map((registration) => ({
                    ...registration,
                    deleted_at: null,
                })),
                { onConflict: 'installation_id,extension_handle' }
            )
            .select();

        if (error) {
            return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
        }

        extensionRegistrations = Array.isArray(data) ? data as AppEngineJsonRecord[] : [];
    }

    let functionRegistrations: AppEngineJsonRecord[] = [];
    if (plan.value.functionRegistrations.length > 0) {
        const { data, error } = await db
            .from('app_function_registrations')
            .upsert(
                plan.value.functionRegistrations.map((registration) => ({
                    ...registration,
                    deleted_at: null,
                })),
                { onConflict: 'installation_id,function_handle' }
            )
            .select();

        if (error) {
            return { ok: false, status: 500, code: 'DB_ERROR', message: error.message };
        }

        functionRegistrations = Array.isArray(data) ? data as AppEngineJsonRecord[] : [];
    }

    return {
        ok: true,
        value: {
            manifest: plan.value.manifest,
            extensionRegistrations,
            functionRegistrations,
        },
    };
}

export async function revokeAppExtensionRegistry(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: { installationId: string; actorId: string; revokedAt: string },
): Promise<AppExtensionRegistryPersistenceResult> {
    const patch = {
        status: 'revoked',
        disabled_at: input.revokedAt,
        revoked_at: input.revokedAt,
        deleted_at: input.revokedAt,
        updated_by: input.actorId,
    };

    const { error: extensionError } = await db
        .from('app_extension_registrations')
        .update(patch)
        .eq('installation_id', input.installationId)
        .neq('status', 'revoked');

    if (extensionError) {
        return { ok: false, status: 500, code: 'DB_ERROR', message: extensionError.message };
    }

    const { error: functionError } = await db
        .from('app_function_registrations')
        .update(patch)
        .eq('installation_id', input.installationId)
        .neq('status', 'revoked');

    if (functionError) {
        return { ok: false, status: 500, code: 'DB_ERROR', message: functionError.message };
    }

    return {
        ok: true,
        value: {
            manifest: null,
            extensionRegistrations: [],
            functionRegistrations: [],
        },
    };
}
