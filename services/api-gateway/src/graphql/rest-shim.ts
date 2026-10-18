import type { Context } from 'hono';
import type { Env } from '../index';

type GatewayContext = Context<{ Bindings: Env }>;
type JsonObject = Record<string, unknown>;

export interface RestShimEnvelope {
    data: unknown;
    meta?: JsonObject;
}

export const LETBUYY_INTERNAL_SUBREQUEST_HEADER = 'X-LetBuyy-Internal-Subrequest';
const REST_SHIM_SUBREQUEST_PREFIX = 'graphql-rest-shim';
const REST_SHIM_SUBREQUEST_TTL_MS = 30_000;
const activeRestShimSubrequests = new Map<string, number>();

export interface RestShimParityEndpoint {
    surface: 'admin' | 'storefront';
    field: string;
    method: 'GET';
    restPath: string;
    parity: 'rest-envelope-data-preserved';
}

export const WS12_REST_SHIM_PARITY_ENDPOINTS: readonly RestShimParityEndpoint[] = [
    { surface: 'admin', field: 'products', method: 'GET', restPath: '/products', parity: 'rest-envelope-data-preserved' },
    { surface: 'admin', field: 'product', method: 'GET', restPath: '/products/:id', parity: 'rest-envelope-data-preserved' },
    { surface: 'admin', field: 'orders', method: 'GET', restPath: '/orders', parity: 'rest-envelope-data-preserved' },
    { surface: 'admin', field: 'order', method: 'GET', restPath: '/orders/:id', parity: 'rest-envelope-data-preserved' },
    { surface: 'admin', field: 'pages', method: 'GET', restPath: '/pages', parity: 'rest-envelope-data-preserved' },
    { surface: 'storefront', field: 'store', method: 'GET', restPath: '/storefront/:subdomain', parity: 'rest-envelope-data-preserved' },
    { surface: 'storefront', field: 'products', method: 'GET', restPath: '/storefront/:subdomain/products', parity: 'rest-envelope-data-preserved' },
    { surface: 'storefront', field: 'product', method: 'GET', restPath: '/storefront/:subdomain/products/:slug', parity: 'rest-envelope-data-preserved' },
    { surface: 'storefront', field: 'pages', method: 'GET', restPath: '/storefront/:subdomain/pages', parity: 'rest-envelope-data-preserved' },
] as const;

function recordValue(value: unknown): JsonObject | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as JsonObject
        : null;
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function cleanupRestShimSubrequests(now = Date.now()): void {
    for (const [marker, expiresAt] of activeRestShimSubrequests.entries()) {
        if (expiresAt <= now) activeRestShimSubrequests.delete(marker);
    }
}

function registerRestShimSubrequest(): string {
    const now = Date.now();
    cleanupRestShimSubrequests(now);
    const marker = `${REST_SHIM_SUBREQUEST_PREFIX}:${now.toString(36)}:${crypto.randomUUID()}`;
    activeRestShimSubrequests.set(marker, now + REST_SHIM_SUBREQUEST_TTL_MS);
    return marker;
}

export function isGraphQLRestShimSubrequest(value: string | undefined | null): boolean {
    if (!value || !value.startsWith(`${REST_SHIM_SUBREQUEST_PREFIX}:`)) return false;
    cleanupRestShimSubrequests();
    const expiresAt = activeRestShimSubrequests.get(value);
    return typeof expiresAt === 'number' && expiresAt > Date.now();
}

export function createRestShimRequest(
    c: GatewayContext,
    path: string,
    params: URLSearchParams | undefined,
    headers: Headers,
): Request {
    const url = new URL(c.req.url);
    url.pathname = `/v1${path.startsWith('/') ? path : `/${path}`}`;
    url.search = params?.toString() || '';
    headers.set(LETBUYY_INTERNAL_SUBREQUEST_HEADER, registerRestShimSubrequest());

    return new Request(url.toString(), {
        method: 'GET',
        headers,
    });
}

export async function readRestShimEnvelope<TError extends Error>(
    response: Response,
    fieldName: string,
    createError: (message: string, code: string, fieldName: string) => TError,
): Promise<RestShimEnvelope> {
    let payload: unknown = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }

    const record = recordValue(payload);
    if (!response.ok) {
        const error = recordValue(record?.error);
        const message = stringValue(error?.message) || `REST delegate failed for ${fieldName}`;
        const code = stringValue(error?.code) || 'REST_DELEGATE_ERROR';
        throw createError(message, code, fieldName);
    }

    return {
        data: record && 'data' in record ? record.data : payload,
        meta: recordValue(record?.meta) || undefined,
    };
}
