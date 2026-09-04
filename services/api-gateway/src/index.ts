import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { appOAuthRateLimit, authRateLimit, queryCostRateLimit } from './middleware/rateLimit';
import { apiVersioning } from './middleware/apiVersion';
import { securityHeaders, inputValidation, requestId, errorResponseSanitizer, csrfProtection } from './middleware/security';
import { protectedMutationIdempotency } from './middleware/idempotency';
import { featureGate } from './middleware/featureFlags';
import { appPlatformKillSwitch } from './middleware/appPlatformKillSwitch';
import { observability } from './middleware/observability';
import { internalPerimeter } from './middleware/internal-perimeter';
import { AppError, formatAppError } from './lib/errors';
import { getSupabaseAdminFromEnv } from './lib/supabase';
import { resolveCredentialedCorsOrigin } from './lib/cors';
import storesRouter from './routes/stores';
import productsRouter from './routes/products';
import channelListingsRouter from './routes/channel-listings';
import ordersRouter from './routes/orders';
import { orderCodRouter, orderRiskRouter } from './routes/order-risk';
import checkoutRouter, { publicStoreBrandingRouter, storeBrandingManagementRouter } from './routes/checkout';
import returnsRouter from './routes/returns';
import shippingLabelsRouter from './routes/shipping-labels';
import shippingRouter from './routes/shipping';
import payoutsRouter from './routes/payouts';
import walletRouter from './routes/wallet';
import commissionRouter from './routes/commission';
import settlementsRouter from './routes/settlements';
import billingRouter from './routes/billing';
import demoRequestsPublicRouter from './routes/demo-requests-public';
import foundingPublicRouter from './routes/founding-public';
import contactPublicRouter from './routes/contact-public';
import foundingRouter from './routes/founding';
import internalFoundingRouter from './routes/internal-founding';
import securityRouter from './routes/security';
import codReconciliationRouter from './routes/cod-reconciliation';
import kycRouter from './routes/kyc';
import twoFactorRouter from './routes/two-factor';
import authRouter from './routes/auth';
import paymentsRouter from './routes/payments';
import uploadRouter from './routes/upload';
import contactsRouter from './routes/contacts';
import portfolioRouter from './routes/portfolio';
import resumeRouter from './routes/resume';
import employeeRouter from './routes/employee';
import adminRouter from './routes/admin';
import blogRouter from './routes/blog';
import customersRouter from './routes/customers';
import notificationsRouter from './routes/notifications';
import emailRouter from './routes/email';
import whatsappRouter, { whatsappInboundRouter } from './routes/whatsapp';
import marketingRouter from './routes/marketing';
import mediaRouter from './routes/media';
import metafieldsRouter from './routes/metafields';
import aiRouter from './routes/ai';
import appApiRouter from './routes/app-api';
import appStoreRouter from './routes/app-store';
import themesRouter from './routes/themes';
import exportRouter from './routes/export';
import shippingTaxRouter from './routes/shipping-tax';
import taxRouter from './routes/tax';
import onboardingRouter from './routes/onboarding';
import inventoryRouter from './routes/inventory';
import commerceAnalyticsRouter from './routes/commerce-analytics';
import couponsRouter from './routes/coupons';
import smartCollectionsRouter from './routes/smart-collections';
import categoriesRouter from './routes/categories';
import storefrontRouter from './routes/storefront';
import analyticsRouter from './routes/analytics';
import reviewsRouter from './routes/reviews';
import formSubmissionsRouter from './routes/form-submissions';
import pagesRouter from './routes/pages';
import operationsRouter from './routes/operations';
import operationsMarketplaceReviewsRouter from './routes/operations/marketplace-reviews';
import operationsMarketplaceListingsRouter from './routes/operations/marketplace-listings';
import operationsDevelopersRouter from './routes/operations/developers';
import operationsRbacRouter from './routes/operations/rbac';
import operationsIncidentCommandRouter from './routes/operations/incident-command';
import operationsRiskRouter from './routes/operations/risk';
import operationsSupportRouter from './routes/operations/support';
import operationsTrustSafetyRouter from './routes/operations/trust-safety';
import internalConsoleRouter from './routes/internal-console';
import internalBillingRouter from './routes/internal-billing';
import internalEventsRouter from './routes/internal-events';
import domainsRouter from './routes/domains';
import customDomainsRouter, { storeAccessRouter } from './routes/custom-domains';
import internalCustomDomainReconcileRouter from './routes/internal-custom-domain-reconcile';
import internalStoreAccessRouter from './routes/internal-store-access';
import { createAdminGraphQLRouter } from './graphql/admin';
import { createStorefrontGraphQLRouter } from './graphql/storefront';
import { LETBUYY_INTERNAL_SUBREQUEST_HEADER, isGraphQLRestShimSubrequest } from './graphql/rest-shim';
import { OutboxExecutionAdapter } from './execution/outbox-execution.adapter';
import { QueueExecutionAdapter } from './execution/queue-execution.adapter';
import { ObservabilityExecutionAdapter } from './execution/observability-execution.adapter';
import {
    planScheduledDispatchQueueTriggers,
    type CloudflareQueueTriggerPlan,
    type ScheduledDispatchQueueTriggerInput,
} from './execution/cloudflare-queue-triggers';
import { createCloudflareQueueProducer } from '@letbuyy/infrastructure/queue-adapter';
import { writeRuntimeTelemetryDataPoint } from '@letbuyy/infrastructure/runtime-telemetry-adapter';
export { LetbuyyRuntimeDurableObject } from './durable/runtime-coordinator';

// Environment bindings
export interface Env {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    HYPERDRIVE?: Hyperdrive;
    DATABASE_URL?: string;
    SUPABASE_DB_URL?: string;
    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;
    LETBUYY_PAYMENT_MODE?: 'sandbox' | 'live';
    LETBUYY_RAZORPAY_MODE?: 'sandbox' | 'live';
    LETBUYY_CASHFREE_MODE?: 'sandbox' | 'live';
    LETBUYY_UPI_MODE?: 'sandbox' | 'live';
    LETBUYY_COD_MODE?: 'sandbox' | 'live';
    LETBUYY_AUTOPAY_MODE?: 'sandbox' | 'live';
    LETBUYY_GST_IRP_MODE?: 'sandbox' | 'live';
    RAZORPAY_ROUTE_MODE?: 'sandbox' | 'live';
    RAZORPAY_ROUTE_ACCOUNT_ID?: string;
    RAZORPAY_ROUTE_KEY_SECRET?: string;
    KYC_PROVIDER_MODE?: 'sandbox' | 'live';
    KYC_PROVIDER?: 'signzy' | 'hyperverge' | 'manual';
    KYC_PROVIDER_API_KEY?: string;
    KYC_PROVIDER_ACCOUNT_ID?: string;
    AI_PROVIDER_MODE?: 'sandbox' | 'live';
    AI_PROVIDER?: 'letbuyy_sandbox' | 'openai_compatible' | 'manual';
    AI_PROVIDER_API_KEY?: string;
    AI_PROVIDER_BASE_URL?: string;
    AI_PROVIDER_MODEL?: string;
    AI_CREDIT_PURCHASE_MODE?: 'sandbox' | 'live';
    AI_CREDIT_PURCHASE_PROVIDER?: 'letbuyy_sandbox' | 'razorpay' | 'manual';
    AI_CREDIT_PRICE_INR_PAISE?: string;
    AI_CREDIT_RAZORPAY_KEY_ID?: string;
    AI_CREDIT_RAZORPAY_KEY_SECRET?: string;
    WHATSAPP_PROVIDER_MODE?: 'sandbox' | 'live';
    WHATSAPP_PROVIDER?: 'letbuyy_sandbox' | 'twilio' | 'manual';
    WHATSAPP_WEBHOOK_SECRET?: string;
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_WHATSAPP_FROM?: string;
    PAYMENT_CONFIG_ENCRYPTION_KEY?: string;
    TOTP_ENCRYPTION_KEY?: string;
    STRIPE_SECRET_KEY: string;
    PAYPAL_CLIENT_ID?: string;
    PAYPAL_CLIENT_SECRET?: string;
    PAYPAL_MODE?: 'sandbox' | 'live';
    PAYPAL_WEBHOOK_ID?: string;
    CASHFREE_APP_ID?: string;
    CASHFREE_SECRET_KEY?: string;
    CASHFREE_ENVIRONMENT?: 'sandbox' | 'production';
    CASHFREE_API_VERSION?: string;
    AUTH_SECRET?: string;
    CSRF_SECRET?: string;
    CUSTOMER_SESSION_SECRET?: string;
    STEP_UP_SIGNING_SECRET?: string;
    LETBUYY_IDENTITY_ISSUER?: string;
    LETBUYY_IDENTITY_PUBLIC_JWKS?: string;
    CUSTOMER_PASSWORD_RESET_URL?: string;
    STOREFRONT_BASE_URL?: string;
    NEXT_PUBLIC_STOREFRONT_URL?: string;
    CHECKOUT_ORIGIN?: string;
    CHECKOUT_SIGNING_SECRET?: string;
    NEXT_PUBLIC_ADMIN_URL?: string;
    NEXT_PUBLIC_STORE_ROOT_DOMAIN?: string;
    STOREFRONT_ROOT_DOMAIN?: string;
    PLATFORM_ROOT_DOMAIN?: string;
    LETBUYY_PLATFORM_DOMAIN?: string;
    NEXT_PUBLIC_PLATFORM_DOMAIN?: string;
    CUSTOM_DOMAIN_CNAME_TARGET?: string;
    NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET?: string;
    PREVIEW_SIGNING_KEY?: string;
    STORE_ACCESS_SIGNING_KEY?: string;
    VERCEL_API_TOKEN?: string;
    VERCEL_STOREFRONT_PROJECT_ID?: string;
    VERCEL_TEAM_ID?: string;
    VERCEL_ORG_ID?: string;
    VERCEL_TEAM_SLUG?: string;
    ABUSE_REPUTATION_API_URL?: string;
    ABUSE_REPUTATION_API_KEY?: string;
    REGISTRAR_PROVIDER?: string;
    REGISTRAR_API_URL?: string;
    REGISTRAR_RESELLER_ID?: string;
    REGISTRAR_API_KEY?: string;
    REGISTRAR_USERNAME?: string;
    REGISTRAR_PASSWORD?: string;
    REGISTRAR_DEFAULT_CURRENCY?: string;
    REGISTRAR_SANDBOX_ENABLED?: string;
    CUSTOM_DOMAIN_RECONCILE_BATCH_LIMIT?: string;
    TURNSTILE_SECRET_KEY?: string;
    LETBUYY_KMS_MODE?: 'sandbox' | 'live';
    LETBUYY_KMS_SANDBOX_SECRET?: string;
    LETBUYY_KMS_KEY_ID?: string;
    LETBUYY_WAREHOUSE_MODE?: 'sandbox' | 'live';
    LETBUYY_AI_MODEL_MODE?: 'sandbox' | 'live';
    INTERNAL_API_SECRET?: string;
    INTERNAL_API_SECRET_PREVIOUS?: string;
    LETBUYY_INTERNAL_API_SECRET?: string;
    LETBUYY_INTERNAL_API_SECRET_PREVIOUS?: string;
    QUEUE_TENANT_ENVELOPE_SECRET?: string;
    WORKER_INTERNAL_API_SECRET?: string;
    INTERNAL_GATEWAY_IP_ALLOWLIST?: string;
    PLATFORM_CONSOLE_API_TOKEN?: string;
    ASSET_PUBLIC_BASE_URL?: string;
    R2_BUCKET?: R2Bucket;
    RUNTIME_DB?: D1Database;
    CACHE?: KVNamespace;
    RUNTIME_COORDINATOR?: DurableObjectNamespace;
    EVENT_QUEUE?: Queue<Record<string, unknown>>;
    ANALYTICS_QUEUE?: Queue<Record<string, unknown>>;
    SEARCH_QUEUE?: Queue<Record<string, unknown>>;
    NOTIFICATION_QUEUE?: Queue<Record<string, unknown>>;
    RUNTIME_QUEUE?: Queue<Record<string, unknown>>;
    WEBHOOK_SERVICE?: Fetcher;
    RUNTIME_TELEMETRY?: AnalyticsEngineDataset;
    RESEND_API_KEY: string;
    RESEND_FROM_EMAIL?: string;
    /* Absolute origin of the marketing site — transactional email templates
       resolve their logo and links against it. */
    MARKETING_SITE_URL?: string;
    /* Public origin that transactional email images are fetched from. Kept
       separate from MARKETING_SITE_URL, which is localhost in development —
       a mail client cannot reach that, and the image renders broken. */
    EMAIL_ASSET_BASE_URL?: string;
    /* Publicly reachable base for this gateway, including the /v1 prefix. Used
       in email links (calendar invite) that are followed from a mail client. */
    PUBLIC_API_BASE_URL?: string;
    SUPPORT_EMAIL?: string;
    /* Inbox that receives demo-request lead alerts. Falls back to SUPPORT_EMAIL. */
    DEMO_REQUEST_NOTIFY_EMAIL?: string;
    /* Resend credentials scoped to the demo-request form alone. Separate from
       RESEND_API_KEY on purpose: a leak or a quota problem on the marketing
       form must not be able to stop order confirmations or gift-card email. */
    DEMO_RESEND_API_KEY?: string;
    DEMO_RESEND_FROM_EMAIL?: string;
    /* Default inbox for contact-form lead alerts. Falls back to SUPPORT_EMAIL. */
    CONTACT_NOTIFY_EMAIL?: string;
    /* Optional JSON map of contact team → inbox, e.g.
       {"sales":"sales@letbuyy.com","trust_safety":"abuse@letbuyy.com"}. Lets
       routing change without a deploy; a malformed value degrades to the
       default inbox rather than losing the lead. */
    CONTACT_TEAM_INBOXES?: string;
    /* Resend credentials scoped to the contact form alone, for the same reason
       the demo form has its own: a marketing-form quota problem must not be
       able to stop order confirmations. */
    CONTACT_RESEND_API_KEY?: string;
    CONTACT_RESEND_FROM_EMAIL?: string;
    LETBUYY_EMAIL_MODE?: 'sandbox' | 'live';
    SES_ACCESS_KEY_ID?: string;
    SES_SECRET_ACCESS_KEY?: string;
    SENDGRID_API_KEY?: string;
    ENVIRONMENT: string;
    APP_ENV?: string;
    NODE_ENV?: string;
    DEPLOYMENT_ENV?: string;
    TELEMETRY_ENV?: string;
    CORS_CREDENTIAL_ORIGINS?: string;
    FEATURE_GRAPHQL?: string;
    FEATURE_EXTENSIONS?: string;
    FEATURE_LIQUID?: string;
    /** ART-22 kill switch. ABSENT = app platform disabled. Do not set. */
    FEATURE_APP_PLATFORM?: string;
    FEATURE_IDENTITY_PROVIDER?: string;
    FEATURE_OIDC_CLIENT?: string;
    FEATURE_NEW_SESSION_ENGINE?: string;
    FEATURE_NEW_PERMISSION_ENGINE?: string;
    FEATURE_NEW_AUDIT_ENGINE?: string;
    FEATURE_AUDIT_DUAL_WRITE?: string;
    FEATURE_NEW_KEY_SERVICE?: string;
    FEATURE_ORG_MODEL?: string;
    FEATURE_NEW_MFA_ENGINE?: string;
    FEATURE_SHADOW_AUTH?: string;
    FEATURE_SHADOW_PERMISSION?: string;
    FEATURE_SHADOW_SESSION?: string;
    FEATURE_TOKEN_HASH_SHADOW?: string;
    FEATURE_NEW_CSRF?: string;
    FEATURE_PERUSER_ADMIN_TOTP?: string;
    LETBUYY_ENABLE_LEGACY_SITE_TYPES?: string;
    STOREFRONT_CACHE?: string;
    STOREFRONT_POOLED_SQL?: string;
    STOREFRONT_VIEW_SAMPLE_RATE?: string;
    STOREFRONT_SEARCH_PROJECTION?: string;
    ANALYTICS_PROJECTION_READS?: string;
    PRODUCT_VARIANT_DIFF?: string;
    CHECKOUT_POSTCOMMIT_DEFERRAL?: string;
    ORDER_ITEMS_RELATIONAL_READS?: string;
    LOGISTICS_MODE?: string;
    SHIPROCKET_TOKEN?: string;
    DELHIVERY_TOKEN?: string;
    PICKRR_TOKEN?: string;
    PRODUCT_VARIANTS_RELATIONAL_READS?: string;
    REQUEST_LOG_SAMPLE_RATE?: string;
    RUNTIME_NAME?: string;
    PRIMARY_REGION?: string;
    EDGE_SCOPE?: string;
    EVENT_QUEUE_NAME?: string;
    ANALYTICS_QUEUE_NAME?: string;
    SEARCH_QUEUE_NAME?: string;
    NOTIFICATION_QUEUE_NAME?: string;
    RUNTIME_QUEUE_NAME?: string;
    // Future: Upstash Redis for distributed rate limiting
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
    // Beta free-tier: when unset/off, non-production rate limiting uses in-memory (no KV writes).
    // Set to "on" only to restore the Cloudflare KV fallback for staging/dev.
    RATE_LIMIT_KV_FALLBACK?: string;
}

const app = new Hono<{ Bindings: Env }>();

function healthResponse(environment: string | undefined) {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment,
        version: '2.0.0',
    };
}

const QUEUE_HEALTH_BINDINGS = [
    { binding: 'EVENT_QUEUE', nameVar: 'EVENT_QUEUE_NAME', fallbackName: 'letbuyy-events' },
    { binding: 'ANALYTICS_QUEUE', nameVar: 'ANALYTICS_QUEUE_NAME', fallbackName: 'letbuyy-analytics-queue' },
    { binding: 'SEARCH_QUEUE', nameVar: 'SEARCH_QUEUE_NAME', fallbackName: 'letbuyy-search-queue' },
    { binding: 'NOTIFICATION_QUEUE', nameVar: 'NOTIFICATION_QUEUE_NAME', fallbackName: 'letbuyy-notifications-queue' },
    { binding: 'RUNTIME_QUEUE', nameVar: 'RUNTIME_QUEUE_NAME', fallbackName: 'letbuyy-runtime-queue' },
] as const satisfies ReadonlyArray<{
    binding: 'EVENT_QUEUE' | 'ANALYTICS_QUEUE' | 'SEARCH_QUEUE' | 'NOTIFICATION_QUEUE' | 'RUNTIME_QUEUE';
    nameVar: 'EVENT_QUEUE_NAME' | 'ANALYTICS_QUEUE_NAME' | 'SEARCH_QUEUE_NAME' | 'NOTIFICATION_QUEUE_NAME' | 'RUNTIME_QUEUE_NAME';
    fallbackName: string;
}>;

function queueHealthResponse(env: Env) {
    const queues = QUEUE_HEALTH_BINDINGS.map(({ binding, nameVar, fallbackName }) => {
        const name = env[nameVar] || fallbackName;

        return {
            binding,
            name,
            binding_configured: Boolean(env[binding]),
        };
    });
    const ready = queues.every((queue) => queue.binding_configured && queue.name.length > 0);

    return {
        status: ready ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT,
        queues,
    };
}

function normalizedApiPath(path: string): string {
    return path.replace(/^\/v1(?=\/|$)/, '') || '/';
}

function shouldSkipGatewayQueryCostLimit(c: { req: { path: string; header?: (name: string) => string | undefined } }): boolean {
    const header = c.req.header?.(LETBUYY_INTERNAL_SUBREQUEST_HEADER);
    if (isGraphQLRestShimSubrequest(header)) return true;

    const path = normalizedApiPath(c.req.path);

    return path.startsWith('/auth/')
        || path === '/storefront/graphql'
        || path === '/graphql/storefront'
        || path === '/admin/graphql'
        || path === '/graphql/admin'
        || path === '/storefront/customer/login'
        || path === '/storefront/customer/password/request-reset'
        || path === '/storefront/customer/password/confirm-reset'
        || /^\/storefront\/[^/]+\/orders\/contact$/.test(path);
}

type ScheduledQueueName = 'analytics-events' | 'search-indexing' | 'payment-events';

interface ScheduledDispatchPreflightResult {
    hasWork: boolean;
    outbox: boolean;
    queues: boolean;
    webhookDeliveries: boolean;
}

type ScheduledDispatchQueueResult = Array<{
    claimed?: number;
    succeeded?: number;
    failed?: number;
    skipped?: number;
}>;

type CloudflareQueueTriggerResult = Array<{
    binding: CloudflareQueueTriggerPlan['binding'];
    queue_name: string;
    status: 'enqueued' | 'missing-binding' | 'failed';
    error?: string;
}>;

interface ReplayLagSnapshot {
    maxLagSeconds: number;
    activeReplays: number;
    ownerRuntime: string;
    replayId: string | null;
    status: string;
}

function numberField(value: unknown, key: string): number {
    return value && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'number'
        ? (value as Record<string, number>)[key]
        : 0;
}

function stringField(value: unknown, key: string): string | null {
    const candidate = value && typeof value === 'object'
        ? (value as Record<string, unknown>)[key]
        : null;
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

function secondsSince(value: string | null, nowMs: number): number {
    if (!value) return 0;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return 0;
    return Math.max(0, Math.floor((nowMs - timestamp) / 1000));
}

function hasCount(result: { count?: number | null; error?: { message?: string } | null }, label: string): boolean {
    if (result.error) throw new Error(`${label} pending work check failed: ${result.error.message}`);
    return Number(result.count || 0) > 0;
}

async function hasPendingScheduledDispatchWork(
    db: ReturnType<typeof getSupabaseAdminFromEnv>,
    queueNames: ScheduledQueueName[],
    includeWebhookDeliveries: boolean,
): Promise<ScheduledDispatchPreflightResult> {
    const now = new Date().toISOString();
    const [outboxResult, queueResult, webhookResult] = await Promise.all([
        db.from('outbox_events')
            .select('id', { count: 'exact', head: true })
            .in('status', ['queued', 'failed'])
            .lte('available_at', now)
            .lte('next_attempt_at', now),
        db.from('platform_queue_jobs')
            .select('id', { count: 'exact', head: true })
            .in('queue_name', queueNames)
            .in('status', ['queued', 'failed'])
            .lte('available_at', now)
            .is('deleted_at', null),
        includeWebhookDeliveries
            ? db.from('webhook_deliveries')
                .select('id', { count: 'exact', head: true })
                .in('status', ['pending', 'failed'])
                .lte('next_attempt_at', now)
                .is('deleted_at', null)
            : Promise.resolve({ count: 0, error: null }),
    ]);

    const outbox = hasCount(outboxResult, 'Outbox');
    const queues = hasCount(queueResult, 'Platform queue');
    const webhookDeliveries = hasCount(webhookResult, 'Webhook delivery');

    return {
        hasWork: outbox || queues || webhookDeliveries,
        outbox,
        queues,
        webhookDeliveries,
    };
}

function scheduledDispatchHadWork(
    outboxResult: {
        claimed?: number;
        processed?: number;
        failed?: number;
        queued_jobs?: number;
        webhook_deliveries?: number;
    },
    queueResult: ScheduledDispatchQueueResult,
    webhookResult: unknown,
): boolean {
    const webhookPayload = webhookResult && typeof webhookResult === 'object' && 'data' in webhookResult
        ? (webhookResult as { data?: unknown }).data
        : webhookResult;

    return numberField(outboxResult, 'claimed') > 0
        || numberField(outboxResult, 'processed') > 0
        || numberField(outboxResult, 'failed') > 0
        || numberField(outboxResult, 'queued_jobs') > 0
        || numberField(outboxResult, 'webhook_deliveries') > 0
        || queueResult.some((result) => (
            Number(result.claimed || 0) > 0
            || Number(result.succeeded || 0) > 0
            || Number(result.failed || 0) > 0
            || Number(result.skipped || 0) > 0
        ))
        || numberField(webhookPayload, 'claimed') > 0
        || numberField(webhookPayload, 'succeeded') > 0
        || numberField(webhookPayload, 'failed') > 0;
}

function sumScheduledQueueResult(queueResult: ScheduledDispatchQueueResult, key: keyof ScheduledDispatchQueueResult[number]): number {
    return queueResult.reduce((sum, result) => sum + numberField(result, key), 0);
}

async function enqueueCloudflareQueueTriggers(
    env: Env,
    plans: CloudflareQueueTriggerPlan[],
): Promise<CloudflareQueueTriggerResult> {
    const results: CloudflareQueueTriggerResult = [];

    for (const plan of plans) {
        const binding = env[plan.binding];
        const queueName = env[plan.nameVar] || plan.fallbackName;

        if (!binding) {
            results.push({
                binding: plan.binding,
                queue_name: queueName,
                status: 'missing-binding',
            });
            continue;
        }

        try {
            await createCloudflareQueueProducer(binding).enqueue({
                id: plan.messageId,
                queueName,
                jobType: plan.jobType,
                payload: plan.payload,
                attempts: 0,
                correlationId: plan.correlationId,
            });
            results.push({
                binding: plan.binding,
                queue_name: queueName,
                status: 'enqueued',
            });
        } catch (error) {
            results.push({
                binding: plan.binding,
                queue_name: queueName,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Cloudflare queue enqueue failed',
            });
        }
    }

    return results;
}

async function enqueueScheduledDispatchTriggers(
    env: Env,
    input: ScheduledDispatchQueueTriggerInput,
): Promise<CloudflareQueueTriggerResult> {
    return enqueueCloudflareQueueTriggers(env, planScheduledDispatchQueueTriggers(input));
}

async function readReplayLagSnapshot(db: ReturnType<typeof getSupabaseAdminFromEnv>): Promise<ReplayLagSnapshot> {
    const { data, error } = await db
        .from('replay_operation_schedules')
        .select('replay_id, owner_runtime, status, created_at, updated_at')
        .in('status', ['planned', 'authorized', 'running', 'paused'])
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) throw new Error(`Replay lag snapshot failed: ${error.message}`);

    const nowMs = Date.now();
    const rows = Array.isArray(data) ? data : [];
    let snapshot: ReplayLagSnapshot = {
        maxLagSeconds: 0,
        activeReplays: rows.length,
        ownerRuntime: 'none',
        replayId: null,
        status: 'idle',
    };

    for (const row of rows) {
        const lagSeconds = secondsSince(stringField(row, 'created_at'), nowMs);
        if (lagSeconds >= snapshot.maxLagSeconds) {
            snapshot = {
                maxLagSeconds: lagSeconds,
                activeReplays: rows.length,
                ownerRuntime: stringField(row, 'owner_runtime') || 'unknown',
                replayId: stringField(row, 'replay_id'),
                status: stringField(row, 'status') || 'unknown',
            };
        }
    }

    return snapshot;
}

async function recordScheduledReplayLagMetric(
    env: Env,
    db: ReturnType<typeof getSupabaseAdminFromEnv>,
    dispatcherId: string,
): Promise<void> {
    const snapshot = await readReplayLagSnapshot(db);
    const runtimeName = env.RUNTIME_NAME || 'api-gateway';
    const deploymentEnv = env.DEPLOYMENT_ENV || env.ENVIRONMENT;
    const telemetryEnv = env.TELEMETRY_ENV || env.ENVIRONMENT;

    writeRuntimeTelemetryDataPoint(env.RUNTIME_TELEMETRY, {
        metricName: 'letbuyy.replay.lag.seconds',
        runtimeName,
        environment: env.ENVIRONMENT,
        deploymentEnv,
        telemetryEnv,
        requestId: dispatcherId,
        traceId: dispatcherId,
        index: snapshot.ownerRuntime === 'none' ? `${runtimeName}:${env.ENVIRONMENT}` : snapshot.ownerRuntime,
        blobs: [
            snapshot.ownerRuntime,
            snapshot.status,
            snapshot.replayId || '',
            'scheduled-dispatch',
        ],
        doubles: [
            snapshot.maxLagSeconds,
            snapshot.activeReplays,
        ],
    });

    await new ObservabilityExecutionAdapter(db).recordRuntimeMetric({
        metricName: 'letbuyy.replay.lag.seconds',
        metricValue: snapshot.maxLagSeconds,
        unit: 'seconds',
        runtimeName,
        requestId: dispatcherId,
        correlationId: dispatcherId,
        traceId: dispatcherId,
        dimensions: {
            owner_runtime: snapshot.ownerRuntime,
            replay_id: snapshot.replayId,
            status: snapshot.status,
            active_replays: snapshot.activeReplays,
            deployment_env: deploymentEnv,
            telemetry_env: telemetryEnv,
            source: 'api-gateway.scheduled_dispatch',
        },
    });
}

// Global middleware
app.use('*', securityHeaders);
app.use('*', requestId);
app.use('*', inputValidation);
app.use('*', errorResponseSanitizer);

// Request timing
app.use('*', async (c, next) => {
    c.set('requestStartTime', Date.now());
    await next();
});
app.use('*', observability);

app.use(
    '*',
    (c, next) => cors({
        origin: (origin) => resolveCredentialedCorsOrigin(origin, c.env),
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Store-ID', 'X-Request-ID', 'X-Trace-ID', 'X-Idempotency-Key', 'Idempotency-Key', 'X-Platform-Console-Token', 'X-LetBuyy-API-Version', 'LetBuyy-API-Version'],
        exposeHeaders: ['X-Request-ID', 'X-Trace-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-RateLimit-Cost', 'X-RateLimit-Policy', 'X-App-Quota-Limit', 'X-App-Quota-Remaining', 'X-App-Quota-Reset', 'X-App-Quota-Used', 'X-App-Quota-Route', 'X-LetBuyy-API-Version', 'X-Response-Time'],
        maxAge: 86400,
        credentials: true,
    })(c, next)
);

// Health check
app.get('/health', (c) => {
    return c.json(healthResponse(c.env.ENVIRONMENT));
});

// API version prefix
const api = app.basePath('/v1');
api.use('/*', apiVersioning);
api.get('/health', (c) => {
    return c.json(healthResponse(c.env.ENVIRONMENT));
});
api.get('/health/queues', (c) => {
    const body = queueHealthResponse(c.env);
    return c.json(body, body.status === 'healthy' ? 200 : 503);
});
api.use('/*', queryCostRateLimit({
    pointsPerSecond: 20,
    capacity: 200,
    skip: shouldSkipGatewayQueryCostLimit,
}));

const storefrontGraphQLRouter = createStorefrontGraphQLRouter({
    restDelegate: async (c, request) => app.fetch(request, c.env),
});
const graphQLFeatureGate = featureGate(
    'FEATURE_GRAPHQL',
    'GRAPHQL_DISABLED',
    'GraphQL is disabled for this environment',
);
const extensionsFeatureGate = featureGate(
    'FEATURE_EXTENSIONS',
    'EXTENSIONS_DISABLED',
    'Extensions are disabled for this environment',
);

// Public routes (no auth required)
api.use('/auth/*', async (c, next) => {
    if (c.req.method === 'GET' && c.req.path.endsWith('/auth/custom/session')) {
        await next();
        return;
    }

    return authRateLimit(c, next);
});
api.route('/auth', authRouter);
api.route('/contacts', contactsRouter);
api.use('/storefront/graphql', graphQLFeatureGate);
api.use('/graphql/storefront', graphQLFeatureGate);
// ART-22 / ART-16 hard gate — the public checkout-UI extension registry is an
// app-platform surface. It was previously gated ONLY by extensionsFeatureGate, whose
// unset-flag branch (middleware/featureFlags.ts) is fail-OPEN and which is "true" in
// [vars] and [env.staging.vars]. The kill switch is registered FIRST so the app
// platform, not FEATURE_EXTENSIONS, decides reachability.
api.use('/storefront/:subdomain/checkout/extensions', appPlatformKillSwitch);
api.use('/storefront/:subdomain/checkout/extensions', extensionsFeatureGate);
// ART-22 / ART-16 / NEVER-R3 hard gate — the third-party app platform is a frozen
// seam, not a live capability. Fail-closed: unreachable unless FEATURE_APP_PLATFORM
// is explicitly positive. Registered BEFORE the mounts below (Hono composes in
// registration order) so it cannot be bypassed and cannot drift as routes are added.
// Permanent removal of the implementation is Wave 1 and requires ARB approval.
api.use('/app-store', appPlatformKillSwitch);
api.use('/app-store/*', appPlatformKillSwitch);
api.use('/app', appPlatformKillSwitch);
api.use('/app/*', appPlatformKillSwitch);
// Same gate, OPERATOR plane of the same frozen seam: marketplace listing review/approval
// (writes marketplace_apps.status = published) and the developer back office
// (app_developers moderation, partner_payout_ledger_entries release, payout_disputes,
// app_billing_charges). No other router owns these two prefixes, so the perimeter is exact.
// Registered HERE — ahead of the global auth middleware below — so the surface returns a
// uniform hard 404 to every caller instead of leaking its existence via a 401, and so a
// blocked request performs no auth work.
api.use('/operations/marketplace-reviews', appPlatformKillSwitch);
api.use('/operations/marketplace-reviews/*', appPlatformKillSwitch);
api.use('/operations/developers', appPlatformKillSwitch);
api.use('/operations/developers/*', appPlatformKillSwitch);
api.use('/app-store/installations/:id/extensions', extensionsFeatureGate);
api.use('/app-store/installations/:id/extensions/:registrationId', extensionsFeatureGate);
api.use('/app-store/apps/:id/oauth/authorize', appOAuthRateLimit);
api.use('/app-store/oauth/token', appOAuthRateLimit);
api.use('/app-store/oauth/token-exchange', appOAuthRateLimit);
api.use('/app-store/bridge/fetch', appOAuthRateLimit);
api.route('/storefront/graphql', storefrontGraphQLRouter);
api.route('/graphql/storefront', storefrontGraphQLRouter);
api.route('/storefront', storefrontRouter);
api.route('/checkout', checkoutRouter);
api.route('/stores', publicStoreBrandingRouter);
api.route('/themes', themesRouter);
api.route('/app-store', appStoreRouter);
api.route('/app', appApiRouter);
api.route('/whatsapp/inbound', whatsappInboundRouter);
api.route('/wa/webhook', whatsappInboundRouter);
// PUBLIC founding-program + pricing (mounted BEFORE auth middleware): exposes only
// non-PII program counts + the plan catalog for the marketing pricing page / live counter.
api.route('/', foundingPublicRouter);
// PUBLIC demo-request intake (also BEFORE auth): the submitter is a prospect with
// no account. Turnstile-gated, validated and length-capped in the route itself.
api.route('/', demoRequestsPublicRouter);
// PUBLIC contact-form intake + two-factor ticket lookup (also BEFORE auth): the
// sender is usually a prospect with no account. Turnstile, an IP rate limit and
// a per-email throttle stand in for the session that does not exist.
api.route('/', contactPublicRouter);
api.use('/internal/*', internalPerimeter);
api.route('/internal/console', internalConsoleRouter);
api.route('/internal/billing', internalBillingRouter);
api.route('/internal/founding', internalFoundingRouter);
api.route('/internal/events', internalEventsRouter);
api.route('/internal/store-access', internalStoreAccessRouter);
api.route('/internal/custom-domain-reconcile', internalCustomDomainReconcileRouter);

// Protected routes (auth required)
api.use('/*', authMiddleware);
api.use('/*', csrfProtection);
api.use('/*', protectedMutationIdempotency);

const adminGraphQLRouter = createAdminGraphQLRouter({
    restDelegate: async (c, request) => app.fetch(request, c.env),
});

// Mount routers
api.use('/admin/graphql', graphQLFeatureGate);
api.use('/graphql/admin', graphQLFeatureGate);
api.route('/admin/graphql', adminGraphQLRouter);
api.route('/graphql/admin', adminGraphQLRouter);
api.route('/stores', storeBrandingManagementRouter);
api.route('/stores', storesRouter);
api.route('/domains', domainsRouter);
api.route('/custom', customDomainsRouter);
api.route('/store-access', storeAccessRouter);
api.route('/products', productsRouter);
api.route('/channel-listings', channelListingsRouter);
api.route('/orders', ordersRouter);
api.route('/orders', orderCodRouter);
api.route('/risk', orderRiskRouter);
api.route('/returns', returnsRouter);
api.route('/shipping/labels', shippingLabelsRouter);
api.route('/shipping', shippingRouter);
api.route('/payouts', payoutsRouter);
api.route('/wallet', walletRouter);
api.route('/commission', commissionRouter);
api.route('/settlements', settlementsRouter);
api.route('/billing', billingRouter);
api.route('/founding', foundingRouter);
api.route('/security', securityRouter);
api.route('/cod', codReconciliationRouter);
api.route('/kyc', kycRouter);
api.route('/2fa', twoFactorRouter);
api.route('/payments', paymentsRouter);
api.route('/upload', uploadRouter);
api.route('/portfolio', portfolioRouter);
api.route('/resume', resumeRouter);
api.route('/employees', employeeRouter);
api.route('/admin', adminRouter);
api.route('/blog', blogRouter);
api.route('/customers', customersRouter);
api.route('/notifications', notificationsRouter);
api.route('/email', emailRouter);
api.route('/whatsapp', whatsappRouter);
api.route('/wa', whatsappRouter);
api.route('/marketing', marketingRouter);
api.route('/media', mediaRouter);
api.route('/metafields', metafieldsRouter);
api.route('/ai', aiRouter);
api.route('/export', exportRouter);
api.route('/shipping-tax', shippingTaxRouter);
api.route('/tax', taxRouter);
api.route('/onboarding', onboardingRouter);
api.route('/inventory', inventoryRouter);
api.route('/commerce-analytics', commerceAnalyticsRouter);
api.route('/coupons', couponsRouter);
api.route('/discounts', couponsRouter);
api.route('/smart-collections', smartCollectionsRouter);
api.route('/categories', categoriesRouter);
api.route('/analytics', analyticsRouter);
api.route('/reviews', reviewsRouter);
api.route('/form-submissions', formSubmissionsRouter);
api.route('/pages', pagesRouter);
api.route('/operations/rbac', operationsRbacRouter);
api.route('/operations', operationsIncidentCommandRouter);
api.route('/operations/risk', operationsRiskRouter);
api.route('/operations/support', operationsSupportRouter);
api.route('/operations/trust-safety', operationsTrustSafetyRouter);
api.route('/operations/marketplace-reviews', operationsMarketplaceReviewsRouter);
api.route('/operations/marketplace-listings', operationsMarketplaceListingsRouter);
api.route('/operations/developers', operationsDevelopersRouter);
api.route('/operations', operationsRouter);

// 404 handler
app.notFound((c) => {
    return c.json(
        {
            error: {
                code: 'NOT_FOUND',
                message: 'The requested resource was not found',
            },
        },
        404
    );
});

// Global error handler — classifies AppError vs unexpected errors
app.onError((err, c) => {
    // Known application errors — return structured response
    if (err instanceof AppError) {
        const { body, status } = formatAppError(err);
        return c.json(body, status as any);
    }

    // Unexpected errors — log full details, return generic message
    const requestId = c.res.headers.get('X-Request-ID') || 'unknown';
    console.error(JSON.stringify({
        level: 'error',
        service: 'letbuyy-api',
        request_id: requestId,
        route: c.req.path,
        method: c.req.method,
        status_code: 500,
        error: err instanceof Error ? err.message : 'Unhandled error',
    }));

    return c.json(
        {
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An internal error occurred',
                request_id: requestId,
            },
        },
        500
    );
});

async function runScheduledDispatch(controller: ScheduledController, env: Env): Promise<void> {
    const dispatcherId = `cron:${controller.cron || 'manual'}:${crypto.randomUUID()}`;
    const workerId = `cron-queue:${controller.cron || 'manual'}:${crypto.randomUUID()}`;
    const db = getSupabaseAdminFromEnv(env);
    const outbox = new OutboxExecutionAdapter(db);
    const queue = new QueueExecutionAdapter(db);
    const queueNames: ScheduledQueueName[] = ['analytics-events', 'search-indexing', 'payment-events'];

    try {
        const pending = await hasPendingScheduledDispatchWork(
            db,
            queueNames,
            Boolean(env.WEBHOOK_SERVICE && env.INTERNAL_API_SECRET),
        );

        try {
            await recordScheduledReplayLagMetric(env, db, dispatcherId);
        } catch (error) {
            console.error(JSON.stringify({
                level: 'error',
                service: 'letbuyy-api',
                route: 'scheduled.replay_lag_metric',
                method: 'CRON',
                status_code: 500,
                latency_ms: 0,
                dispatcher_id: dispatcherId,
                error: error instanceof Error ? error.message : 'Replay lag metric recording failed',
            }));
        }

        if (!pending.hasWork) {
            console.info(JSON.stringify({
                level: 'info',
                service: 'letbuyy-api',
                route: 'scheduled.outbox_dispatch',
                method: 'CRON',
                status_code: 204,
                latency_ms: 0,
                dispatcher_id: dispatcherId,
                worker_id: workerId,
                skipped: true,
                reason: 'no_pending_work',
                preflight: pending,
            }));
            return;
        }

        const outboxResult = await outbox.dispatchBatch({
            dispatcherId,
            outboxLimit: 50,
            webhookLimit: 50,
        });

        let webhookResult: unknown = null;
        if (env.WEBHOOK_SERVICE && env.INTERNAL_API_SECRET) {
            const response = await env.WEBHOOK_SERVICE.fetch('https://webhook-service/webhook-deliveries/dispatch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-LetBuyy-Internal-Secret': env.INTERNAL_API_SECRET,
                },
                body: JSON.stringify({
                    dispatcher_id: `cron-webhooks:${controller.cron || 'manual'}:${crypto.randomUUID()}`,
                    limit: 50,
                }),
            });
            webhookResult = await response.json().catch(() => ({ ok: response.ok, status: response.status }));
        }
        const queueResult = await queue.consumeQueues(workerId, queueNames, 50);
        const hadWork = scheduledDispatchHadWork(outboxResult, queueResult, webhookResult);
        // Beta free-tier: only emit Cloudflare queue-trigger messages on genuine forward progress
        // (real outbox/queue/webhook work), not on failure-only churn. Poison rows that keep failing
        // no longer cost a queue write every cron tick — this breaks the perpetual idle drain.
        const hadForwardProgress = numberField(outboxResult, 'processed') > 0
            || numberField(outboxResult, 'queued_jobs') > 0
            || numberField(outboxResult, 'webhook_deliveries') > 0
            || sumScheduledQueueResult(queueResult, 'succeeded') > 0;
        const completedDispatchTriggerInput = {
            status: 'completed',
            event_type: 'runtime.scheduled_dispatch.completed',
            dispatcherId,
            workerId,
            eventId: crypto.randomUUID(),
            environment: env.ENVIRONMENT,
            deploymentEnv: env.DEPLOYMENT_ENV || env.ENVIRONMENT,
            telemetryEnv: env.TELEMETRY_ENV || env.ENVIRONMENT,
            outboxQueuedJobs: numberField(outboxResult, 'queued_jobs'),
            queueClaimedJobs: sumScheduledQueueResult(queueResult, 'claimed'),
            queueSucceededJobs: sumScheduledQueueResult(queueResult, 'succeeded'),
            webhookDeliveries: numberField(outboxResult, 'webhook_deliveries'),
        } satisfies ScheduledDispatchQueueTriggerInput & {
            event_type: 'runtime.scheduled_dispatch.completed';
        };
        let cloudflareQueueTriggers: CloudflareQueueTriggerResult = [];
        if (hadForwardProgress) {
            cloudflareQueueTriggers = await enqueueScheduledDispatchTriggers(env, completedDispatchTriggerInput);
        }

        if (cloudflareQueueTriggers.some((trigger) => trigger.status === 'failed')) {
            console.error(JSON.stringify({
                level: 'error',
                service: 'letbuyy-api',
                route: 'scheduled.outbox_dispatch.completion_event',
                method: 'CRON',
                status_code: 500,
                latency_ms: 0,
                dispatcher_id: dispatcherId,
                failed_triggers: cloudflareQueueTriggers.filter((trigger) => trigger.status === 'failed'),
            }));
        }

        console.info(JSON.stringify({
            level: 'info',
            service: 'letbuyy-api',
            route: 'scheduled.outbox_dispatch',
            method: 'CRON',
            status_code: hadWork ? 200 : 204,
            latency_ms: 0,
            dispatcher_id: dispatcherId,
            worker_id: workerId,
            outbox_result: outboxResult,
            queue_result: queueResult,
            completion_event_enqueued: hadForwardProgress,
            cloudflare_queue_triggers: cloudflareQueueTriggers,
            preflight: pending,
        }));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Scheduled outbox dispatch failed';
        // Beta free-tier: do NOT enqueue a Cloudflare queue message on every failure. A poison row that
        // fails each tick would otherwise cost a queue write per cron run. Failures stay observable via logs.
        console.error(JSON.stringify({
            level: 'error',
            service: 'letbuyy-api',
            route: 'scheduled.outbox_dispatch',
            method: 'CRON',
            status_code: 500,
            latency_ms: 0,
            dispatcher_id: dispatcherId,
            error: message,
        }));
    }
}

export default {
    fetch: app.fetch,
    scheduled(controller, env, ctx) {
        ctx.waitUntil(runScheduledDispatch(controller, env));
    },
} satisfies ExportedHandler<Env>;
