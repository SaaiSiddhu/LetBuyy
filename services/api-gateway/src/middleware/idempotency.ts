import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { getSupabaseAdmin } from '../lib/supabase';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type GatewayContext = Context<{ Bindings: Env }>;

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const IDEMPOTENT_PROTECTED_PREFIXES = [
    '/stores',
    '/domains',
    '/custom',
    '/store-access',
    '/products',
    '/orders',
    '/risk',
    '/returns',
    '/shipping/labels',
    '/shipping',
    '/payouts',
    '/wallet',
    '/commission',
    '/cod',
    '/kyc',
    '/2fa',
    '/payments',
    '/upload',
    '/blog',
    '/customers',
    '/notifications',
    '/whatsapp',
    '/marketing',
    '/media',
    '/metafields',
    '/ai',
    '/export',
    '/shipping-tax',
    '/tax',
    '/onboarding',
    '/inventory',
    '/coupons',
    '/discounts',
    '/categories',
    '/analytics',
    '/reviews',
    '/form-submissions',
    '/pages',
] as const;

function normalizePath(path: string): string {
    return path.replace(/^\/v1(?=\/|$)/, '') || '/';
}

function isProtectedMutationPath(path: string): boolean {
    const normalized = normalizePath(path);
    return IDEMPOTENT_PROTECTED_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function stringField(input: Record<string, unknown> | null, ...keys: string[]): string | null {
    if (!input) return null;
    for (const key of keys) {
        const value = input[key];
        if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
    return null;
}

function safeJsonRecord(rawBody: string): Record<string, unknown> | null {
    if (!rawBody.trim()) return null;
    try {
        const parsed = JSON.parse(rawBody) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
}

async function readJsonBodySnapshot(c: GatewayContext): Promise<{
    rawBody: string;
    body: Record<string, unknown> | null;
}> {
    const contentType = c.req.header('content-type') || '';
    if (!contentType.includes('application/json')) return { rawBody: '', body: null };

    const rawBody = await c.req.raw.clone().text().catch(() => '');
    return { rawBody, body: safeJsonRecord(rawBody) };
}

function idempotencyKeyFromRequest(c: GatewayContext, body: Record<string, unknown> | null): string | null {
    const header = c.req.header('X-Idempotency-Key') || c.req.header('Idempotency-Key');
    if (header?.trim()) return header.trim();
    return stringField(body, 'idempotency_key', 'idempotencyKey');
}

function siteIdFromStorePath(path: string): string | null {
    const normalized = normalizePath(path);
    const [, resource, id] = normalized.split('/');
    if (resource !== 'stores' || !id || id === 'public' || id === 'handle') return null;
    return decodeURIComponent(id);
}

function siteIdFromRequest(c: GatewayContext, body: Record<string, unknown> | null): string | null {
    return stringField(body, 'site_id', 'siteId', 'store_id', 'storeId')
        || c.req.query('site_id')
        || c.req.query('store_id')
        || c.req.header('X-Store-ID')
        || c.get('auth')?.user?.storeId
        || siteIdFromStorePath(c.req.path);
}

function requestBodyForHash(input: {
    method: string;
    path: string;
    query: Record<string, string>;
    rawBody: string;
    body: Record<string, unknown> | null;
    contentType: string;
    contentLength?: string;
}): Record<string, unknown> {
    if (input.body) {
        return {
            method: input.method,
            path: normalizePath(input.path),
            query: input.query,
            body: input.body,
        };
    }

    return {
        method: input.method,
        path: normalizePath(input.path),
        query: input.query,
        content_type: input.contentType,
        content_length: input.contentLength || null,
        raw_body: input.rawBody || null,
    };
}

async function responseBodyForReplay(response: Response): Promise<JsonValue | null> {
    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    const value = await response.clone().json() as unknown;
    return value as JsonValue;
}

export const protectedMutationIdempotency = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const method = c.req.method.toUpperCase();
    if (!MUTATION_METHODS.has(method) || !isProtectedMutationPath(c.req.path)) {
        await next();
        return;
    }

    const { rawBody, body } = await readJsonBodySnapshot(c);
    const idempotencyKey = idempotencyKeyFromRequest(c, body);
    if (!idempotencyKey) {
        return c.json({
            error: {
                code: 'IDEMPOTENCY_KEY_REQUIRED',
                message: 'An idempotency key is required for this mutation.',
            },
        }, 400);
    }

    const siteId = siteIdFromRequest(c, body);
    if (!siteId) {
        return c.json({
            error: {
                code: 'IDEMPOTENCY_SITE_REQUIRED',
                message: 'A store context is required for this mutation.',
            },
        }, 400);
    }

    const idempotency = new IdempotencyExecutionAdapter(getSupabaseAdmin(c));
    const claim = await idempotency.begin({
        siteId,
        key: idempotencyKey,
        scope: `http:${method}:${normalizePath(c.req.path)}`,
        requestBody: requestBodyForHash({
            method,
            path: c.req.path,
            query: c.req.query(),
            rawBody,
            body,
            contentType: c.req.header('content-type') || '',
            contentLength: c.req.header('content-length'),
        }),
        requestId: c.req.header('X-Request-ID') || null,
    });

    if (claim.kind === 'replay') {
        return new Response(JSON.stringify(claim.responseBody), {
            status: claim.statusCode,
            headers: {
                'content-type': 'application/json; charset=UTF-8',
                'X-Idempotent-Replay': 'true',
            },
        });
    }

    try {
        await next();
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }

    if (c.res.status < 200 || c.res.status >= 300) {
        await idempotency.fail(claim.id);
        return;
    }

    const replayBody = await responseBodyForReplay(c.res);
    if (replayBody === null && c.res.status !== 204) {
        await idempotency.fail(claim.id);
        return;
    }

    await idempotency.complete({
        id: claim.id,
        responseBody: replayBody,
        statusCode: c.res.status,
    });
});
