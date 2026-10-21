import { routePath } from 'hono/route';
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';
import { ObservabilityExecutionAdapter } from '../execution/observability-execution.adapter';
import { LETBUYY_INTERNAL_SUBREQUEST_HEADER, isGraphQLRestShimSubrequest } from '../graphql/rest-shim';
import { writeRuntimeTelemetryDataPoint } from '@letbuyy/infrastructure/runtime-telemetry-adapter';
import { AppError } from '../lib/errors';
import { enqueueRuntimeAlert } from '../lib/runtime-alerting';

type AppContext = Context<{ Bindings: Env }>;

/** Matched route patterns keep cart/reset credentials and IDs out of telemetry. */
export function getObservabilityRoute(c: Context): string {
    try {
        const pattern = routePath(c);
        return pattern && pattern !== '*' && pattern !== '/*' ? pattern : '/unmatched';
    } catch { return '/unmatched'; }
}

interface RuntimeTenant {
    siteId?: string | null;
    requestId?: string | null;
}

interface RuntimeAuth {
    user?: {
        id?: string;
        authSource?: string;
    };
}

export interface RequestLogSamplingInput {
    method: string;
    path: string;
    statusCode: number;
    userId?: string | null;
    authSource?: string | null;
    requestId?: string | null;
    sampleRate?: string | number | null;
}

export interface RequestLogSamplingDecision {
    record: boolean;
    reason: 'error' | 'auth' | 'payment' | 'admin' | 'non-storefront' | 'authenticated' | 'sampled-storefront';
    sampleRate: number;
}

const DEFAULT_REQUEST_LOG_SAMPLE_RATE = 0.02;
const REQUEST_LOG_SAMPLE_HASH_DENOMINATOR = 0x100000000;

function getRequestHeaderId(c: AppContext): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function getTraceId(c: AppContext): string {
    return c.req.header('X-Trace-ID') || c.req.header('Traceparent') || getRequestHeaderId(c);
}

function readErrorCodeFromResponse(c: AppContext): string | null {
    return c.res.headers.get('X-Error-Code');
}

function statusCodeFromThrownError(error: unknown): number {
    return error instanceof AppError ? error.statusCode : 500;
}

function errorCodeFromThrownError(error: unknown): string {
    return error instanceof AppError ? error.code : 'INTERNAL_ERROR';
}

function getTenant(c: AppContext): RuntimeTenant | null {
    try {
        return c.get('tenant') as RuntimeTenant | null;
    } catch {
        return null;
    }
}

function getAuth(c: AppContext): RuntimeAuth | null {
    try {
        return c.get('auth') as RuntimeAuth | null;
    } catch {
        return null;
    }
}

function writeStructuredRuntimeLog(fields: Record<string, unknown>): void {
    const statusCode = typeof fields.status_code === 'number' ? fields.status_code : 0;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const line = JSON.stringify({ level, service: 'letbuyy-api', ...fields });

    if (level === 'error') {
        console.error(line);
    } else if (level === 'warn') {
        console.warn(line);
    } else {
        console.info(line);
    }
}

export function normalizeRequestLogSampleRate(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') return DEFAULT_REQUEST_LOG_SAMPLE_RATE;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_REQUEST_LOG_SAMPLE_RATE;
    return Math.max(0, Math.min(parsed, 1));
}

function hashToUnitInterval(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / REQUEST_LOG_SAMPLE_HASH_DENOMINATOR;
}

function isAuthRoute(path: string): boolean {
    return path === '/v1/auth' || path.startsWith('/v1/auth/') || path === '/auth' || path.startsWith('/auth/');
}

function isAdminOrOperationsRoute(path: string): boolean {
    return path.startsWith('/v1/admin')
        || path.startsWith('/v1/operations')
        || path.startsWith('/v1/internal/console')
        || path.startsWith('/admin')
        || path.startsWith('/operations')
        || path.startsWith('/internal/console');
}

function isPaymentRoute(path: string): boolean {
    return path.includes('/payments')
        || /^\/v1\/storefront\/[^/]+\/orders(?:\/|$)/.test(path)
        || /^\/storefront\/[^/]+\/orders(?:\/|$)/.test(path)
        || path.includes('/internal/payments');
}

function isPublicStorefrontRead(input: RequestLogSamplingInput): boolean {
    const method = input.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return false;
    if (input.userId || input.authSource) return false;
    return input.path.startsWith('/v1/storefront/') || input.path.startsWith('/storefront/');
}

function statusClass(statusCode: number): string {
    if (statusCode >= 500) return '5xx';
    if (statusCode >= 400) return '4xx';
    if (statusCode >= 300) return '3xx';
    if (statusCode >= 200) return '2xx';
    return 'other';
}

function runtimeName(c: AppContext): string {
    return c.env.RUNTIME_NAME || 'api-gateway';
}

function recordRequestAnalyticsEnginePoint(
    c: AppContext,
    input: {
        siteId: string | null;
        requestId: string;
        traceId: string;
        statusCode: number;
        latencyMs: number;
        userId: string | null;
        authSource: string | null;
        errorCode: string | null;
    },
): void {
    const responseStatus = input.statusCode;
    const responseStatusClass = statusClass(responseStatus);

    writeRuntimeTelemetryDataPoint(c.env.RUNTIME_TELEMETRY, {
        metricName: 'letbuyy.runtime.request',
        runtimeName: runtimeName(c),
        environment: c.env.ENVIRONMENT,
        deploymentEnv: c.env.DEPLOYMENT_ENV || c.env.ENVIRONMENT,
        telemetryEnv: c.env.TELEMETRY_ENV || c.env.ENVIRONMENT,
        siteId: input.siteId,
        requestId: input.requestId,
        traceId: input.traceId,
        index: input.siteId || `${runtimeName(c)}:${c.env.ENVIRONMENT || 'unknown'}`,
        blobs: [
            getObservabilityRoute(c),
            c.req.method,
            responseStatusClass,
            input.authSource || (input.userId ? 'authenticated' : 'anonymous'),
            input.errorCode || '',
            c.req.header('CF-IPCountry') || '',
            c.req.header('CF-Ray') || '',
        ],
        doubles: [
            1,
            input.latencyMs,
            responseStatus,
            responseStatus >= 500 ? 1 : 0,
            responseStatus >= 400 && responseStatus < 500 ? 1 : 0,
            responseStatus < 400 ? 1 : 0,
        ],
    });
}

export function shouldRecordRequestLog(input: RequestLogSamplingInput): RequestLogSamplingDecision {
    const sampleRate = normalizeRequestLogSampleRate(input.sampleRate);
    const method = input.method.toUpperCase();

    if (input.statusCode >= 400) return { record: true, reason: 'error', sampleRate: 1 };
    if (isAuthRoute(input.path)) return { record: true, reason: 'auth', sampleRate: 1 };
    if (isPaymentRoute(input.path)) return { record: true, reason: 'payment', sampleRate: 1 };
    if (isAdminOrOperationsRoute(input.path)) return { record: true, reason: 'admin', sampleRate: 1 };
    if (input.userId || input.authSource) return { record: true, reason: 'authenticated', sampleRate: 1 };
    if (!isPublicStorefrontRead({ ...input, method })) return { record: true, reason: 'non-storefront', sampleRate: 1 };

    const samplingKey = `${input.requestId || ''}:${method}:${input.path}`;
    return {
        record: sampleRate >= 1 || hashToUnitInterval(samplingKey) < sampleRate,
        reason: 'sampled-storefront',
        sampleRate,
    };
}

export const observability = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const startedAt = Date.now();
    const requestId = getRequestHeaderId(c);
    const traceId = getTraceId(c);
    let thrownError: unknown = null;

    c.header('X-Trace-ID', traceId);

    try {
        await next();
    } catch (error) {
        thrownError = error;
        throw error;
    } finally {
        if (!isGraphQLRestShimSubrequest(c.req.header(LETBUYY_INTERNAL_SUBREQUEST_HEADER))) {
            const latencyMs = Date.now() - startedAt;
            const tenant = getTenant(c);
            const auth = getAuth(c);
            const siteId = tenant?.siteId || null;
            const userId = auth?.user?.id || null;
            const authSource = auth?.user?.authSource || null;
            const responseStatus = thrownError ? statusCodeFromThrownError(thrownError) : c.res.status;
            const errorCode = thrownError ? errorCodeFromThrownError(thrownError) : readErrorCodeFromResponse(c);
            const runtime = runtimeName(c);
            const country = c.req.header('CF-IPCountry') || null;
            const colo = c.req.header('CF-Ray') || null;

            const fields = {
                request_id: requestId,
                trace_id: traceId,
                site_id: siteId,
                route: getObservabilityRoute(c),
                method: c.req.method,
                status_code: responseStatus,
                latency_ms: latencyMs,
                user_id: userId,
                auth_source: authSource,
            };

            writeStructuredRuntimeLog(fields);
            recordRequestAnalyticsEnginePoint(c, {
                siteId,
                requestId,
                traceId,
                statusCode: responseStatus,
                latencyMs,
                userId,
                authSource,
                errorCode,
            });

            const db = getSupabaseAdmin(c);
            const service = new ObservabilityExecutionAdapter(db);

            c.executionCtx.waitUntil(
                service.recordRuntimeMetric({
                    metricName: 'letbuyy.runtime.request',
                    metricValue: 1,
                    unit: 'count',
                    runtimeName: runtime,
                    siteId,
                    requestId,
                    correlationId: requestId,
                    traceId,
                    dimensions: {
                        route: getObservabilityRoute(c),
                        method: c.req.method,
                        status_code: responseStatus,
                        status_class: statusClass(responseStatus),
                        latency_ms: latencyMs,
                        server_error_count: responseStatus >= 500 ? 1 : 0,
                        client_error_count: responseStatus >= 400 && responseStatus < 500 ? 1 : 0,
                        success_count: responseStatus < 400 ? 1 : 0,
                        auth_source: authSource,
                        country,
                        colo,
                    },
                }).catch((error: unknown) => {
                    writeStructuredRuntimeLog({
                        request_id: requestId,
                        trace_id: traceId,
                        route: getObservabilityRoute(c),
                        method: 'OBSERVABILITY_METRIC',
                        status_code: 500,
                        latency_ms: 0,
                        error: error instanceof Error ? error.message : 'Runtime metric recording failed',
                    });
                })
            );

            c.executionCtx.waitUntil(
                enqueueRuntimeAlert({
                    runtimeQueue: c.env.RUNTIME_QUEUE || null,
                    metricRecorder: service,
                    runtimeName: runtime,
                    environment: c.env.ENVIRONMENT,
                    deploymentEnv: c.env.DEPLOYMENT_ENV || c.env.ENVIRONMENT,
                    telemetryEnv: c.env.TELEMETRY_ENV || c.env.ENVIRONMENT,
                    runtimeQueueName: c.env.RUNTIME_QUEUE_NAME || 'letbuyy-runtime-queue',
                    siteId,
                    requestId,
                    traceId,
                    route: getObservabilityRoute(c),
                    method: c.req.method,
                    statusCode: responseStatus,
                    latencyMs,
                    errorCode,
                    userId,
                    authSource,
                    country,
                    colo,
                }).catch((error: unknown) => {
                    writeStructuredRuntimeLog({
                        request_id: requestId,
                        trace_id: traceId,
                        route: getObservabilityRoute(c),
                        method: 'RUNTIME_ALERT',
                        status_code: 500,
                        latency_ms: 0,
                        error: error instanceof Error ? error.message : 'Runtime alert enqueue failed',
                    });
                })
            );

            const sampling = shouldRecordRequestLog({
                method: c.req.method,
                path: c.req.path,
                statusCode: responseStatus,
                userId,
                authSource,
                requestId,
                sampleRate: c.env.REQUEST_LOG_SAMPLE_RATE,
            });
            if (sampling.record) {

                c.executionCtx.waitUntil(
                    service.recordRequestLog({
                        siteId,
                        requestId,
                        traceId,
                        method: c.req.method,
                        path: getObservabilityRoute(c),
                        route: getObservabilityRoute(c),
                        statusCode: responseStatus,
                        latencyMs,
                        userId,
                        authSource,
                        ipAddress: c.req.header('CF-Connecting-IP') || null,
                        userAgent: c.req.header('User-Agent') || null,
                        errorCode,
                        metadata: {
                            country,
                            colo,
                            request_log_sample_reason: sampling.reason,
                            request_log_sample_rate: sampling.sampleRate,
                        },
                    }).catch((error: unknown) => {
                        writeStructuredRuntimeLog({
                            request_id: requestId,
                            trace_id: traceId,
                            route: getObservabilityRoute(c),
                            method: 'OBSERVABILITY',
                            status_code: 500,
                            latency_ms: 0,
                            error: error instanceof Error ? error.message : 'Request log recording failed',
                        });
                    })
                );
            }
        }
    }
});
