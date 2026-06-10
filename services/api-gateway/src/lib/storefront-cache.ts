import type { Context } from 'hono';
import type { Env } from '../index';

type StorefrontCacheContext = Context<{ Bindings: Env }>;

export interface CachedJsonProducerResult {
    body: unknown;
    status?: number;
    tags?: string[];
}

export const STOREFRONT_CACHE_TTL_SECONDS = 60;
export const STOREFRONT_CACHE_SWR_SECONDS = 300;
export const STOREFRONT_CACHE_VERSION_PREFIX = 'storefront-cache-version';

function normalizedCacheFlag(value: string | undefined): string {
    return (value || 'on').trim().toLowerCase();
}

function cacheApi(): Cache | null {
    return typeof caches === 'undefined' ? null : caches.default;
}

function cacheControlHeader(ttlSeconds: number, swrSeconds: number): string {
    return `public, max-age=${ttlSeconds}, stale-while-revalidate=${swrSeconds}`;
}

function normalizedHandle(handle: string): string {
    return handle.trim().toLowerCase();
}

function jsonResponse(
    body: unknown,
    status: number,
    ttlSeconds: number,
    swrSeconds: number,
    cacheState: 'HIT' | 'MISS' | 'BYPASS',
    tags: string[] = [],
): Response {
    const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': status === 200 && cacheState !== 'BYPASS' ? cacheControlHeader(ttlSeconds, swrSeconds) : 'no-store',
        'X-Storefront-Cache': cacheState,
    });
    if (tags.length > 0) headers.set('Cache-Tag', tags.join(','));
    return new Response(JSON.stringify(body), { status, headers });
}

function cachedResponse(response: Response): Response {
    const headers = new Headers(response.headers);
    headers.set('X-Storefront-Cache', 'HIT');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

export function isStorefrontCacheEnabled(env: Pick<Env, 'STOREFRONT_CACHE'>): boolean {
    return normalizedCacheFlag(env.STOREFRONT_CACHE) !== 'off';
}

export function storefrontCacheKey(...parts: Array<string | number | null | undefined>): string {
    return parts
        .filter((part): part is string | number => part !== null && part !== undefined && `${part}`.length > 0)
        .map((part) => encodeURIComponent(`${part}`))
        .join(':');
}

export function storefrontCacheVersionKey(handle: string): string {
    return storefrontCacheKey(STOREFRONT_CACHE_VERSION_PREFIX, normalizedHandle(handle));
}

export async function storefrontCacheVersion(c: StorefrontCacheContext, handle: string): Promise<string> {
    if (!isStorefrontCacheEnabled(c.env) || !c.env.CACHE) return '0';
    try {
        return await c.env.CACHE.get(storefrontCacheVersionKey(handle)) || '0';
    } catch {
        return '0';
    }
}

export async function bumpStorefrontCacheVersion(c: StorefrontCacheContext, handles: string[]): Promise<void> {
    const cache = c.env.CACHE;
    if (!cache) return;
    const uniqueHandles = Array.from(new Set(handles.map(normalizedHandle).filter(Boolean)));
    if (uniqueHandles.length === 0) return;
    const version = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
    await Promise.all(uniqueHandles.map((handle) => cache.put(storefrontCacheVersionKey(handle), version)));
}

export async function storefrontRequestCacheKey(c: StorefrontCacheContext, namespace: string, ...parts: string[]): Promise<string> {
    const url = new URL(c.req.url);
    const handle = parts[0] || 'global';
    const version = await storefrontCacheVersion(c, handle);
    const params = [...url.searchParams.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    return storefrontCacheKey('storefront-rest', namespace, version, ...parts, params);
}

export function storefrontCacheRequest(key: string): Request {
    return new Request(`https://letbuyy-storefront-cache.internal/${key}`, { method: 'GET' });
}

export async function cachedJson(
    c: StorefrontCacheContext,
    key: string,
    ttlSeconds: number,
    swrSeconds: number,
    producer: () => Promise<CachedJsonProducerResult>,
): Promise<Response> {
    const cache = cacheApi();
    if (!isStorefrontCacheEnabled(c.env) || !cache) {
        const produced = await producer();
        return jsonResponse(produced.body, produced.status || 200, ttlSeconds, swrSeconds, 'BYPASS', produced.tags);
    }

    const request = storefrontCacheRequest(key);
    const matched = await cache.match(request);
    if (matched) return cachedResponse(matched);

    const produced = await producer();
    const response = jsonResponse(produced.body, produced.status || 200, ttlSeconds, swrSeconds, 'MISS', produced.tags);
    if ((produced.status || 200) === 200) {
        c.executionCtx.waitUntil(cache.put(request, response.clone()));
    }
    return response;
}

export async function purgeStorefrontCache(c: StorefrontCacheContext, keys: string[]): Promise<void> {
    const cache = cacheApi();
    if (!cache) return;
    await Promise.all(keys.map((key) => cache.delete(storefrontCacheRequest(key))));
}
