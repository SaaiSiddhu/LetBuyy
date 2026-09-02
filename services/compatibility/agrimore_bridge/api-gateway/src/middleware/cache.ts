import type { RequestContext, RoutePolicy } from '../runtime/types';

export function cacheHeaders(policy: RoutePolicy): Headers {
  const headers = new Headers();
  if (policy.cache.mode === 'public') {
    const maxAge = policy.cache.edgeTtlSeconds ?? 60;
    const stale = policy.cache.staleWhileRevalidateSeconds ?? 60;
    headers.set('cache-control', `public, max-age=${maxAge}, stale-while-revalidate=${stale}`);
    if (policy.cache.tags?.length) {
      headers.set('cache-tag', policy.cache.tags.join(','));
    }
    return headers;
  }

  headers.set('cache-control', 'no-store');
  return headers;
}

export async function matchEdgeCache(request: Request, context: RequestContext): Promise<Response | null> {
  if (context.route.policy.cache.mode !== 'public' || request.method !== 'GET') {
    return null;
  }

  const cache = await caches.open('agrimore-api-gateway');
  const cached = await cache.match(cacheRequest(request, context));
  if (!cached) {
    return null;
  }

  const headers = new Headers(cached.headers);
  headers.set('x-cache-status', 'HIT');
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

export function scheduleCacheWrite(
  request: Request,
  context: RequestContext,
  response: Response,
  executionContext: ExecutionContext,
): void {
  if (context.route.policy.cache.mode !== 'public' || request.method !== 'GET' || !response.ok) {
    return;
  }

  const headers = new Headers(response.headers);
  const policyHeaders = cacheHeaders(context.route.policy);
  policyHeaders.forEach((value, key) => headers.set(key, value));
  headers.set('x-cache-status', 'MISS');

  const cacheable = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  executionContext.waitUntil(
    caches.open('agrimore-api-gateway').then((cache) => cache.put(cacheRequest(request, context), cacheable)),
  );
}

export function applyCacheHeaders(response: Response, policy: RoutePolicy, cacheStatus: 'BYPASS' | 'MISS' | 'HIT'): Response {
  const headers = new Headers(response.headers);
  const policyHeaders = cacheHeaders(policy);
  policyHeaders.forEach((value, key) => headers.set(key, value));
  headers.set('x-cache-status', cacheStatus);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function cacheRequest(request: Request, context: RequestContext): Request {
  const url = new URL(request.url);
  url.searchParams.set('_cache_version', context.route.policy.cache.mode === 'public' ? 'v1' : 'no-store');
  return new Request(url.toString(), { method: 'GET' });
}
