import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';
import { ObservabilityExecutionAdapter } from '../execution/observability-execution.adapter';
import { LETBUYY_INTERNAL_SUBREQUEST_HEADER, isGraphQLRestShimSubrequest } from '../graphql/rest-shim';

type AppContext = Context<{ Bindings: Env }>;

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

    c.header('X-Trace-ID', traceId);

    await next();

    if (isGraphQLRestShimSubrequest(c.req.header(LETBUYY_INTERNAL_SUBREQUEST_HEADER))) {
        return;
    }

    const latencyMs = Date.now() - startedAt;
    const tenant = getTenant(c);
    const auth = getAuth(c);
    const siteId = tenant?.siteId || null;
    const userId = auth?.user?.id || null;
    const authSource = auth?.user?.authSource || null;
    const errorCode = readErrorCodeFromResponse(c);

    const fields = {
        request_id: requestId,
        trace_id: traceId,
        site_id: siteId,
        route: c.req.path,
        method: c.req.method,
        status_code: c.res.status,
        latency_ms: latencyMs,
        user_id: userId,
        auth_source: authSource,
    };

    writeStructuredRuntimeLog(fields);

    const sampling = shouldRecordRequestLog({
        method: c.req.method,
        path: c.req.path,
        statusCode: c.res.status,
        userId,
        authSource,
        requestId,
        sampleRate: c.env.REQUEST_LOG_SAMPLE_RATE,
    });
    if (!sampling.record) return;

    const db = getSupabaseAdmin(c);
    const service = new ObservabilityExecutionAdapter(db);

    c.executionCtx.waitUntil(
        service.recordRequestLog({
            siteId,
            requestId,
            traceId,
            method: c.req.method,
            path: c.req.path,
            route: c.req.path,
            statusCode: c.res.status,
            latencyMs,
            userId,
            authSource,
            ipAddress: c.req.header('CF-Connecting-IP') || null,
            userAgent: c.req.header('User-Agent') || null,
            errorCode,
            metadata: {
                country: c.req.header('CF-IPCountry') || null,
                colo: c.req.header('CF-Ray') || null,
                request_log_sample_reason: sampling.reason,
                request_log_sample_rate: sampling.sampleRate,
            },
        }).catch((error: unknown) => {
            writeStructuredRuntimeLog({
                request_id: requestId,
                trace_id: traceId,
                route: c.req.path,
                method: 'OBSERVABILITY',
                status_code: 500,
                latency_ms: 0,
                error: error instanceof Error ? error.message : 'Request log recording failed',
            });
        })
    );
});
