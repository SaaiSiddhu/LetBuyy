import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import { rateLimit, authRateLimit } from './middleware/rateLimit';
import { securityHeaders, inputValidation, requestId, errorResponseSanitizer, csrfProtection } from './middleware/security';
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
    AUTH_SECRET?: string;
    CSRF_SECRET?: string;
    INTERNAL_API_SECRET?: string;
    PLATFORM_CONSOLE_API_TOKEN?: string;
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
    ENVIRONMENT: string;
    APP_ENV?: string;
    NODE_ENV?: string;
    DEPLOYMENT_ENV?: string;
    TELEMETRY_ENV?: string;
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
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3002',
                'http://localhost:3003',
                'http://localhost:3004',
                'http://localhost:3005',
                'http://localhost:3010',
                'http://localhost:3011',
            ];
            if (allowed.includes(origin)) return origin;
            // Allow all *.letbuyy.store subdomains (storefronts)
            if (/^https:\/\/[a-z0-9-]+\.letbuyy\.store$/.test(origin)) return origin;
            return 'https://letbuyy.store';
        },
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Store-ID', 'X-Request-ID', 'X-Trace-ID', 'X-Idempotency-Key', 'X-Platform-Console-Token'],
        exposeHeaders: ['X-Request-ID', 'X-Trace-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Response-Time'],
        maxAge: 86400,
        credentials: true,
    })
);

// Health check
app.get('/health', (c) => {
    return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: c.env.ENVIRONMENT,
        version: '2.0.0',
    });
});

// API version prefix
const api = app.basePath('/v1');

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
api.route('/storefront', storefrontRouter);
api.route('/themes', themesRouter);
api.route('/app-store', appStoreRouter);
api.route('/internal/console', internalConsoleRouter);

// Protected routes (auth required)
api.use('/*', authMiddleware);
api.use('/*', csrfProtection);
api.use('/*', rateLimit({ max: 300 }));

// Mount routers
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

function runScheduledDispatch(controller: ScheduledController, env: Env): Promise<void> {
    const dispatcherId = `cron:${controller.cron || 'manual'}:${crypto.randomUUID()}`;
    const workerId = `cron-queue:${controller.cron || 'manual'}:${crypto.randomUUID()}`;
    const db = getSupabaseAdminFromEnv(env);
    const outbox = new OutboxExecutionAdapter(db);
    const queue = new QueueExecutionAdapter(db);
    const eventQueue = env.EVENT_QUEUE ? createCloudflareQueueProducer(env.EVENT_QUEUE) : null;

    return outbox
        .dispatchBatch({
            dispatcherId,
            outboxLimit: 50,
            webhookLimit: 50,
        })
        .then(async (outboxResult) => {
            const queueResult = await queue.consumeQueues(workerId, ['analytics-events', 'search-indexing'], 50);
            const eventQueueName = env.EVENT_QUEUE_NAME || 'letbuyy-events';
            await eventQueue?.enqueue({
                id: crypto.randomUUID(),
                queueName: eventQueueName,
                payload: {
                    event_type: 'runtime.scheduled_dispatch.completed',
                    dispatcher_id: dispatcherId,
                    worker_id: workerId,
                    outbox_result: outboxResult,
                    queue_result: queueResult,
                    environment: env.ENVIRONMENT,
                    deployment_env: env.DEPLOYMENT_ENV || env.ENVIRONMENT,
                    telemetry_env: env.TELEMETRY_ENV || env.ENVIRONMENT,
                },
                attempts: 0,
                correlationId: dispatcherId,
            });
            console.info(JSON.stringify({
                level: 'info',
                service: 'letbuyy-api',
                route: 'scheduled.outbox_dispatch',
                method: 'CRON',
                status_code: 200,
                latency_ms: 0,
                dispatcher_id: dispatcherId,
                worker_id: workerId,
                outbox_result: outboxResult,
                queue_result: queueResult,
            }));
        })
        .catch((error: unknown) => {
            console.error(JSON.stringify({
                level: 'error',
                service: 'letbuyy-api',
                route: 'scheduled.outbox_dispatch',
                method: 'CRON',
                status_code: 500,
                latency_ms: 0,
                dispatcher_id: dispatcherId,
                error: error instanceof Error ? error.message : 'Scheduled outbox dispatch failed',
            }));
        });
}

export default {
    fetch: app.fetch,
    scheduled(controller, env, ctx) {
        ctx.waitUntil(runScheduledDispatch(controller, env));
    },
} satisfies ExportedHandler<Env>;
