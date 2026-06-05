import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { rateLimit, authRateLimit, queryCostRateLimit } from './middleware/rateLimit';
import { apiVersioning } from './middleware/apiVersion';
import { securityHeaders, inputValidation, requestId, errorResponseSanitizer, csrfProtection } from './middleware/security';
import { featureGate } from './middleware/featureFlags';
import { observability } from './middleware/observability';
import { AppError, formatAppError } from './lib/errors';
import { getSupabaseAdminFromEnv } from './lib/supabase';
import storesRouter from './routes/stores';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
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
import mediaRouter from './routes/media';
import aiRouter from './routes/ai';
import appStoreRouter from './routes/app-store';
import themesRouter from './routes/themes';
import exportRouter from './routes/export';
import shippingTaxRouter from './routes/shipping-tax';
import onboardingRouter from './routes/onboarding';
import inventoryRouter from './routes/inventory';
import couponsRouter from './routes/coupons';
import categoriesRouter from './routes/categories';
import storefrontRouter from './routes/storefront';
import analyticsRouter from './routes/analytics';
import reviewsRouter from './routes/reviews';
import formSubmissionsRouter from './routes/form-submissions';
import pagesRouter from './routes/pages';
import operationsRouter from './routes/operations';
import internalConsoleRouter from './routes/internal-console';
import { createAdminGraphQLRouter } from './graphql/admin';
import { createStorefrontGraphQLRouter } from './graphql/storefront';
import { OutboxExecutionAdapter } from './execution/outbox-execution.adapter';
import { QueueExecutionAdapter } from './execution/queue-execution.adapter';
import { createCloudflareQueueProducer } from '@letbuyy/infrastructure/queue-adapter';
export { LetbuyyRuntimeDurableObject } from './durable/runtime-coordinator';

// Environment bindings
export interface Env {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;
    PAYMENT_CONFIG_ENCRYPTION_KEY?: string;
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
    CUSTOMER_LEGACY_AUTH?: string;
    CUSTOMER_PASSWORD_RESET_URL?: string;
    STOREFRONT_BASE_URL?: string;
    NEXT_PUBLIC_STOREFRONT_URL?: string;
    TURNSTILE_SECRET_KEY?: string;
    INTERNAL_API_SECRET?: string;
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
    ENVIRONMENT: string;
    APP_ENV?: string;
    NODE_ENV?: string;
    DEPLOYMENT_ENV?: string;
    TELEMETRY_ENV?: string;
    FEATURE_GRAPHQL?: string;
    FEATURE_EXTENSIONS?: string;
    FEATURE_LIQUID?: string;
    REQUEST_LOG_SAMPLE_RATE?: string;
    RUNTIME_NAME?: string;
    PRIMARY_REGION?: string;
    FAILOVER_REGION?: string;
    EVENT_QUEUE_NAME?: string;
    ANALYTICS_QUEUE_NAME?: string;
    SEARCH_QUEUE_NAME?: string;
    NOTIFICATION_QUEUE_NAME?: string;
    RUNTIME_QUEUE_NAME?: string;
    // Future: Upstash Redis for distributed rate limiting
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
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

function numberField(value: unknown, key: string): number {
    return value && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'number'
        ? (value as Record<string, number>)[key]
        : 0;
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
    cors({
        origin: (origin) => {
            if (!origin) return 'https://letbuyy.store';
            const allowed = [
                'https://letbuyy.store',
                'https://admin.letbuyy.store',
                'https://accounts.letbuyy.store',
                'https://console.letbuyy.store',
                'https://team.letbuyy.store',
                'https://accounts.staging.letbuyy.store',
                'https://merchant.staging.letbuyy.store',
                'https://storefront.staging.letbuyy.store',
                'https://apps.staging.letbuyy.store',
                'https://themes.staging.letbuyy.store',
                'https://console.staging.letbuyy.store',
                'https://operations.staging.letbuyy.store',
            ];
            if (allowed.includes(origin)) return origin;
            // Allow all *.letbuyy.store subdomains (storefronts)
            if (/^https:\/\/[a-z0-9-]+\.letbuyy\.store$/.test(origin)) return origin;
            return 'https://letbuyy.store';
        },
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Store-ID', 'X-Request-ID', 'X-Trace-ID', 'X-Idempotency-Key', 'X-Platform-Console-Token', 'X-LetBuyy-API-Version', 'LetBuyy-API-Version'],
        exposeHeaders: ['X-Request-ID', 'X-Trace-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-RateLimit-Cost', 'X-RateLimit-Policy', 'X-LetBuyy-API-Version', 'X-Response-Time'],
        maxAge: 86400,
        credentials: true,
    })
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
api.use('/*', queryCostRateLimit({ pointsPerSecond: 20, capacity: 200 }));

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
api.use('/storefront/:subdomain/checkout/extensions', extensionsFeatureGate);
api.use('/app-store/installations/:id/extensions', extensionsFeatureGate);
api.use('/app-store/installations/:id/extensions/:registrationId', extensionsFeatureGate);
api.route('/storefront/graphql', storefrontGraphQLRouter);
api.route('/graphql/storefront', storefrontGraphQLRouter);
api.route('/storefront', storefrontRouter);
api.route('/themes', themesRouter);
api.route('/app-store', appStoreRouter);
api.route('/internal/console', internalConsoleRouter);

// Protected routes (auth required)
api.use('/*', authMiddleware);
api.use('/*', csrfProtection);
api.use('/*', rateLimit({ max: 300 }));

const adminGraphQLRouter = createAdminGraphQLRouter({
    restDelegate: async (c, request) => app.fetch(request, c.env),
});

// Mount routers
api.use('/admin/graphql', graphQLFeatureGate);
api.use('/graphql/admin', graphQLFeatureGate);
api.route('/admin/graphql', adminGraphQLRouter);
api.route('/graphql/admin', adminGraphQLRouter);
api.route('/stores', storesRouter);
api.route('/products', productsRouter);
api.route('/orders', ordersRouter);
api.route('/payments', paymentsRouter);
api.route('/upload', uploadRouter);
api.route('/portfolio', portfolioRouter);
api.route('/resume', resumeRouter);
api.route('/employees', employeeRouter);
api.route('/admin', adminRouter);
api.route('/blog', blogRouter);
api.route('/customers', customersRouter);
api.route('/notifications', notificationsRouter);
api.route('/media', mediaRouter);
api.route('/ai', aiRouter);
api.route('/export', exportRouter);
api.route('/shipping-tax', shippingTaxRouter);
api.route('/onboarding', onboardingRouter);
api.route('/inventory', inventoryRouter);
api.route('/coupons', couponsRouter);
api.route('/categories', categoriesRouter);
api.route('/analytics', analyticsRouter);
api.route('/reviews', reviewsRouter);
api.route('/form-submissions', formSubmissionsRouter);
api.route('/pages', pagesRouter);
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
    const eventQueue = env.EVENT_QUEUE ? createCloudflareQueueProducer(env.EVENT_QUEUE) : null;
    const queueNames: ScheduledQueueName[] = ['analytics-events', 'search-indexing', 'payment-events'];

    try {
        const pending = await hasPendingScheduledDispatchWork(
            db,
            queueNames,
            Boolean(env.WEBHOOK_SERVICE && env.INTERNAL_API_SECRET),
        );

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
        const eventQueueName = env.EVENT_QUEUE_NAME || 'letbuyy-events';
        const hadWork = scheduledDispatchHadWork(outboxResult, queueResult, webhookResult);

        if (hadWork) {
            await eventQueue?.enqueue({
                id: crypto.randomUUID(),
                queueName: eventQueueName,
                payload: {
                    event_type: 'runtime.scheduled_dispatch.completed',
                    dispatcher_id: dispatcherId,
                    worker_id: workerId,
                    outbox_result: outboxResult,
                    webhook_result: webhookResult,
                    queue_result: queueResult,
                    environment: env.ENVIRONMENT,
                    deployment_env: env.DEPLOYMENT_ENV || env.ENVIRONMENT,
                    telemetry_env: env.TELEMETRY_ENV || env.ENVIRONMENT,
                },
                attempts: 0,
                correlationId: dispatcherId,
            });
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
            completion_event_enqueued: hadWork,
            preflight: pending,
        }));
    } catch (error: unknown) {
        const eventQueueName = env.EVENT_QUEUE_NAME || 'letbuyy-events';
        const message = error instanceof Error ? error.message : 'Scheduled outbox dispatch failed';

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

        await eventQueue?.enqueue({
            id: crypto.randomUUID(),
            queueName: eventQueueName,
            payload: {
                event_type: 'runtime.scheduled_dispatch.failed',
                dispatcher_id: dispatcherId,
                worker_id: workerId,
                error: message,
                environment: env.ENVIRONMENT,
                deployment_env: env.DEPLOYMENT_ENV || env.ENVIRONMENT,
                telemetry_env: env.TELEMETRY_ENV || env.ENVIRONMENT,
            },
            attempts: 0,
            correlationId: dispatcherId,
        }).catch((enqueueError: unknown) => {
            console.error(JSON.stringify({
                level: 'error',
                service: 'letbuyy-api',
                route: 'scheduled.outbox_dispatch.failure_event',
                method: 'CRON',
                status_code: 500,
                latency_ms: 0,
                dispatcher_id: dispatcherId,
                error: enqueueError instanceof Error ? enqueueError.message : 'Scheduled failure event enqueue failed',
            }));
        });
    }
}

export default {
    fetch: app.fetch,
    scheduled(controller, env, ctx) {
        ctx.waitUntil(runScheduledDispatch(controller, env));
    },
} satisfies ExportedHandler<Env>;
