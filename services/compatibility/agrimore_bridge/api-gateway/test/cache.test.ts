import assert from 'node:assert/strict';
import test from 'node:test';

import { cacheHeaders } from '../src/middleware/cache';
import type { RoutePolicy } from '../src/runtime/types';

test('cacheHeaders never caches command routes', () => {
  const policy: RoutePolicy = {
    method: 'POST',
    path: '/v1/checkout/quote',
    upstreamPath: '/checkout-quote',
    owner: 'checkout',
    auth: 'user',
    cache: { mode: 'none' },
    rateLimit: { identity: 'composite', windowSeconds: 60, maxRequests: 10 },
    bodyLimitBytes: 1024,
    requiresIdempotency: true,
    allowCors: true,
  };

  assert.equal(cacheHeaders(policy).get('cache-control'), 'no-store');
});

test('cacheHeaders attaches cache tags for public catalog routes', () => {
  const policy: RoutePolicy = {
    method: 'GET',
    path: '/v1/catalog/categories',
    upstreamPath: '/catalog-categories',
    owner: 'catalog',
    auth: 'none',
    cache: { mode: 'public', edgeTtlSeconds: 900, staleWhileRevalidateSeconds: 120, tags: ['catalog'] },
    rateLimit: { identity: 'ip', windowSeconds: 60, maxRequests: 100 },
    bodyLimitBytes: 0,
    requiresIdempotency: false,
    allowCors: true,
  };

  const headers = cacheHeaders(policy);
  assert.equal(headers.get('cache-control'), 'public, max-age=900, stale-while-revalidate=120');
  assert.equal(headers.get('cache-tag'), 'catalog');
});
