import type { Env } from '../../index';
import { getSupabaseAdmin } from '../../lib/supabase';
import { signQueueTenantEnvelope } from '../../lib/queue-tenant-envelope';
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
    type MandatoryComplianceWebhookTopic,
} from '@letbuyy/shared-types';
import {
    DEFAULT_APP_REVENUE_SHARE_BPS,
    type AppChargeBillingMode,
    type AppChargeProviderMode,
    type IndiaPayoutRail,
} from '@letbuyy/billing-core';

export type AppLifecycleEventType = 'app.installed' | 'app.uninstalled';
export type AppWebhookEventType = AppLifecycleEventType | MandatoryComplianceWebhookTopic;
export type AppOAuthGrantType = 'authorization_code' | 'refresh_token';

export interface AppOAuthTokenResponse {
    access_token: string;
    refresh_token?: string;
    token_type: 'Bearer';
    expires_at: string;
    refresh_expires_at?: string;
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

export interface MarketplaceAnalyticsEventInput {
    db: ReturnType<typeof getSupabaseAdmin>;
    env: Env;
    executionCtx?: ExecutionContext;
    eventId: string;
    eventType: string;
    siteId?: string | null;
    aggregateType?: string | null;
    aggregateId?: string | null;
    occurredAt?: string | null;
    requestId?: string | null;
    traceId?: string | null;
    idempotencyKey?: string | null;
    payload: Record<string, unknown>;
    createdBy?: string | null;
}

export interface AppBillingChargeRecord {
    id: string;
    site_id: string;
    app_id: string;
    partner_id: string;
    installation_id: string;
    pricing_plan_id?: string | null;
    billing_mode: AppChargeBillingMode;
    status: string;
    name: string;
    amount_minor: number;
    currency: 'INR';
    trial_days?: number | null;
    trial_starts_at?: string | null;
    trial_ends_at?: string | null;
    billing_starts_at?: string | null;
    idempotency_key: string;
    provider_reference?: string | null;
    provider_mode?: 'sandbox' | 'live' | string | null;
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

export interface AppOAuthPkceChallenge {
    codeChallenge: string;
    codeChallengeMethod: 'S256';
}

export interface AppComplianceWebhookPayload extends Record<string, unknown> {
    topic: MandatoryComplianceWebhookTopic;
    store_id: string;
    occurred_at: string;
    request_id: string;
    trigger: {
        source: 'merchant' | 'customer' | 'app_uninstall' | 'system';
        actor_id: string | null;
    };
    customer?: {
        id: string | null;
        email: string | null;
    };
    reason?: string | null;
    app_uninstall?: {
        app_id: string;
        installation_id: string;
    };
}

export function getRequestId(c: { req: { header(name: string): string | undefined }; res: { headers: Headers } }): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function marketplaceAnalyticsEventType(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 120) || 'marketplace.event';
}

export async function enqueueMarketplaceAnalyticsEvent(input: MarketplaceAnalyticsEventInput): Promise<boolean> {
    const siteId = stringOrNull(input.siteId);
    if (!siteId) return false;

    const eventType = marketplaceAnalyticsEventType(input.eventType);
    const occurredAt = input.occurredAt || new Date().toISOString();
    const idempotencyKey = stringOrNull(input.idempotencyKey) || `${eventType}:${input.eventId}`;
    const requestId = stringOrNull(input.requestId);
    const envelope = {
        id: input.eventId,
        type: eventType,
        site_id: siteId,
        aggregate: {
            type: stringOrNull(input.aggregateType) || 'marketplace',
            id: stringOrNull(input.aggregateId) || input.eventId,
        },
        occurred_at: occurredAt,
        request_id: requestId,
        trace_id: stringOrNull(input.traceId),
        idempotency_key: idempotencyKey,
        schema_version: 1,
        payload: input.payload,
    };
    const row = {
        site_id: siteId,
        outbox_event_id: null,
        event_id: input.eventId,
        queue_name: 'analytics-events',
        job_type: eventType,
        payload: envelope,
        request_id: requestId,
        trace_id: stringOrNull(input.traceId),
        idempotency_key: idempotencyKey,
        schema_version: 1,
        created_by: stringOrNull(input.createdBy),
        updated_by: stringOrNull(input.createdBy),
    };

    const { error } = await input.db
        .from('platform_queue_jobs')
        .upsert(row, { onConflict: 'queue_name,idempotency_key', ignoreDuplicates: true });

    if (error) {
        throw new Error(`Marketplace analytics queue enqueue failed: ${error.message}`);
    }

    const queue = input.env.ANALYTICS_QUEUE;
    if (queue && input.executionCtx) {
        input.executionCtx.waitUntil(signQueueTenantEnvelope(input.env, {
            messageId: idempotencyKey,
            queueName: 'analytics-events',
            jobType: eventType,
            siteId,
            idempotencyKey,
            requestId: requestId || undefined,
            correlationId: requestId || idempotencyKey,
            payload: envelope,
            attempts: 0,
        }).then((body) => queue.send(body)).then(() => undefined, () => undefined));
    }

    return true;
}

export function appPlatformTokenSecret(env: Env): string | undefined {
    return getLetbuyyInternalAuthSecret({
        INTERNAL_API_SECRET: env.INTERNAL_API_SECRET,
        LETBUYY_INTERNAL_API_SECRET: env.LETBUYY_INTERNAL_API_SECRET,
    });
}

export function appOAuthState(value: unknown): string | null {
    const state = stringOrNull(value);
    return state && state.length <= 500 ? state : null;
}

export function appOAuthGrantType(value: unknown): AppOAuthGrantType | null {
    return value === 'authorization_code' || value === 'refresh_token' ? value : null;
}

export function appOAuthConfig(config: unknown): AppEngineJsonRecord {
    return parseJsonRecord(parseJsonRecord(config).oauth);
}

export function appComplianceWebhookEventIdPrefix(input: {
    eventType: MandatoryComplianceWebhookTopic;
    storeId: string;
    idempotencyKey: string;
}): string {
    return `app-compliance:${input.eventType}:${input.storeId}:${input.idempotencyKey}`;
}

export function buildAppComplianceWebhookPayload(input: {
    eventType: MandatoryComplianceWebhookTopic;
    storeId: string;
    occurredAt: string;
    requestId: string;
    triggerSource: AppComplianceWebhookPayload['trigger']['source'];
    actorId?: string | null;
    customerId?: string | null;
    customerEmail?: string | null;
    reason?: string | null;
    appUninstall?: { appId: string; installationId: string } | null;
}): AppComplianceWebhookPayload {
    const payload: AppComplianceWebhookPayload = {
        topic: input.eventType,
        store_id: input.storeId,
        occurred_at: input.occurredAt,
        request_id: input.requestId,
        trigger: {
            source: input.triggerSource,
            actor_id: input.actorId || null,
        },
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.appUninstall ? { app_uninstall: {
            app_id: input.appUninstall.appId,
            installation_id: input.appUninstall.installationId,
        } } : {}),
    };

    if (input.eventType.startsWith('customers/')) {
        payload.customer = {
            id: input.customerId || null,
            email: input.customerEmail || null,
        };
    }

    return payload;
}

const PKCE_VALUE_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export function normalizeAppOAuthPkceChallenge(challenge: unknown, method: unknown): { ok: true; value: AppOAuthPkceChallenge } | { ok: false; message: string } {
    const codeChallenge = stringOrNull(challenge);
    const codeChallengeMethod = stringOrNull(method) || 'S256';
    if (codeChallengeMethod !== 'S256') {
        return { ok: false, message: 'code_challenge_method must be S256' };
    }
    if (!codeChallenge || !PKCE_VALUE_PATTERN.test(codeChallenge)) {
        return { ok: false, message: 'code_challenge must be 43-128 PKCE characters' };
    }
    return { ok: true, value: { codeChallenge, codeChallengeMethod } };
}

export async function appOAuthPkceS256Challenge(verifier: string): Promise<string> {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    let output = '';
    for (const byte of digest) output += String.fromCharCode(byte);
    return btoa(output).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function verifyAppOAuthPkceVerifier(verifier: unknown, challenge: unknown, method: unknown): Promise<boolean> {
    const codeVerifier = stringOrNull(verifier);
    const codeChallenge = stringOrNull(challenge);
    const codeChallengeMethod = stringOrNull(method);
    if (!codeVerifier || !codeChallenge || codeChallengeMethod !== 'S256' || !PKCE_VALUE_PATTERN.test(codeVerifier)) {
        return false;
    }
    return await appOAuthPkceS256Challenge(codeVerifier) === codeChallenge;
}

export function firstRelatedRecord(value: unknown): AppEngineJsonRecord {
    if (Array.isArray(value)) {
        return parseJsonRecord(value[0]);
    }

    return parseJsonRecord(value);
}

export function appBillingMode(value: unknown): AppChargeBillingMode {
    if (value === 'usage') return 'usage';
    if (value === 'one_time') return 'one_time';
    return 'recurring';
}

export function appChargeProviderMode(value: unknown): AppChargeProviderMode {
    return value === 'live' ? 'live' : 'sandbox';
}

export function appPayoutRail(value: unknown): IndiaPayoutRail | null {
    switch (value) {
        case 'razorpay_route':
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
    refreshTokenHash?: string;
    scopes: string[];
    issuedAt: string;
    expiresAt: string;
    refreshExpiresAt?: string;
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
            ...(input.refreshTokenHash ? {
                refresh_token_hash: input.refreshTokenHash,
                refresh_token_issued_at: input.issuedAt,
                refresh_token_expires_at: input.refreshExpiresAt,
            } : {}),
            ...(input.authorizationCode ? { authorization_code: input.authorizationCode } : {}),
        },
    };
}

function randomOAuthToken(length = 64): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._~-';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let token = '';
    for (const byte of bytes) token += alphabet[byte % alphabet.length];
    return token;
}

export async function mintAppOAuthRefreshToken(input: {
    now: Date;
    ttlSeconds?: number;
}): Promise<{ token: string; hash: string; expiresAt: string }> {
    const ttlSeconds = input.ttlSeconds || 60 * 60 * 24 * 30;
    const expiresAt = new Date(input.now.getTime() + ttlSeconds * 1000).toISOString();
    const token = `lbapp_refresh_${randomOAuthToken(72)}`;
    return {
        token,
        hash: await sha256Hex(token),
        expiresAt,
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
            provider_reference: stringOrNull(input.charge.provider_reference) || undefined,
            provider_mode: input.charge.provider_mode === 'live' ? 'live' : 'sandbox',
            revenue_share_bps: Number(indiaPayout.revenue_share_bps || DEFAULT_APP_REVENUE_SHARE_BPS),
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
    eventType: AppWebhookEventType;
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
    db?: ReturnType<typeof getSupabaseAdmin>;
    eventType: AppWebhookEventType;
    installationId: string;
    siteId?: string | null;
    actorId?: string | null;
    eventIdPrefix?: string;
    payload: Record<string, unknown>;
    requestId: string;
    subscriptions: Array<{
        id?: string;
        target_url: string;
        signing_secret: string;
        event_types?: unknown;
    }>;
}): Promise<number> {
    const targets = input.subscriptions.filter((subscription) => stringArray(subscription.event_types).includes(input.eventType));
    const siteId = stringOrNull(input.siteId) || stringOrNull(input.payload.store_id);
    const durableTargets = targets.filter((subscription) => input.db && siteId && stringOrNull(subscription.id));
    const directTargets = targets.filter((subscription) => !input.db || !siteId || !stringOrNull(subscription.id));

    if (input.db && siteId && durableTargets.length > 0) {
        const deliveries = durableTargets.map((subscription, index) => {
            const eventKey = input.eventIdPrefix
                ? `${input.eventIdPrefix}:${index}`
                : `${input.eventType}:${input.installationId}:${stringOrNull(subscription.id) || index}`;
            return {
                site_id: siteId,
                subscription_id: stringOrNull(subscription.id),
                event_id: crypto.randomUUID(),
                event_type: input.eventType,
                target_url: subscription.target_url,
                payload: {
                    ...input.payload,
                    letbuyy_delivery: {
                        event_key: eventKey,
                        installation_id: input.installationId,
                    },
                },
                request_id: input.requestId,
                trace_id: null,
                idempotency_key: eventKey,
                schema_version: 1,
                created_by: stringOrNull(input.actorId),
                updated_by: stringOrNull(input.actorId),
            };
        });
        const keys = deliveries.map((delivery) => delivery.idempotency_key);
        const { data: existing, error: existingError } = await input.db
            .from('webhook_deliveries')
            .select('idempotency_key')
            .in('idempotency_key', keys)
            .is('deleted_at', null);

        if (existingError) {
            throw new Error(`App lifecycle webhook delivery lookup failed: ${existingError.message}`);
        }

        const existingKeys = new Set((Array.isArray(existing) ? existing : [])
            .map((row) => stringOrNull(row.idempotency_key))
            .filter((key): key is string => Boolean(key)));
        const newDeliveries = deliveries.filter((delivery) => !existingKeys.has(delivery.idempotency_key));

        const { error } = newDeliveries.length > 0
            ? await input.db.from('webhook_deliveries').insert(newDeliveries)
            : { error: null };

        if (error) {
            throw new Error(`App lifecycle webhook delivery enqueue failed: ${error.message}`);
        }
    }

    await Promise.all(directTargets.map((subscription, index) => dispatchAppLifecycleThroughWebhookService(env, {
        eventId: input.eventIdPrefix ? `${input.eventIdPrefix}:${index}` : `${input.eventType}:${input.installationId}:${index}`,
        eventType: input.eventType,
        payload: input.payload,
        targetUrl: subscription.target_url,
        signingSecret: subscription.signing_secret,
        requestId: input.requestId,
    })));

    return targets.length;
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
        .eq('site_id', input.storeId)
        .neq('status', 'revoked');

    if (revokeExtensionsError) {
        return { ok: false, status: 500, code: 'DB_ERROR', message: revokeExtensionsError.message };
    }

    const { error: revokeFunctionsError } = await db
        .from('app_function_registrations')
        .update(revokePatch)
        .eq('installation_id', input.installationId)
        .eq('site_id', input.storeId)
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
    input: { installationId: string; storeId: string; actorId: string; revokedAt: string },
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
        .eq('site_id', input.storeId)
        .neq('status', 'revoked');

    if (extensionError) {
        return { ok: false, status: 500, code: 'DB_ERROR', message: extensionError.message };
    }

    const { error: functionError } = await db
        .from('app_function_registrations')
        .update(patch)
        .eq('installation_id', input.installationId)
        .eq('site_id', input.storeId)
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
