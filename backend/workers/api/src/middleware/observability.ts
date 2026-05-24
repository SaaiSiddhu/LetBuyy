import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';
import { ObservabilityService } from '../services/observability.service';

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

export const observability = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const startedAt = Date.now();
    const requestId = getRequestHeaderId(c);
    const traceId = getTraceId(c);

    c.header('X-Trace-ID', traceId);

    await next();

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

    const db = getSupabaseAdmin(c);
    const service = new ObservabilityService(db);

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
