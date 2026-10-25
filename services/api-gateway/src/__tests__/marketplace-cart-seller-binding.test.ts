import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { PublishedStoreRecord } from '@letbuyy/tenant-core';
import type { Env } from '../index';
import { registerStorefrontCartRoutes } from '../routes/storefront/cart-routes';

const API_ORIGIN = 'https://marketplace-cart-binding.test';
const SELLER_ONE = '11111111-1111-4111-8111-111111111111';
const SELLER_TWO = '22222222-2222-4222-8222-222222222222';
const LISTING_ONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const LISTING_TWO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const PRODUCT_ONE = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1';
const PRODUCT_TWO = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';

type CapturedRequest = { method: string; path: string };

function createRoute(input: { productReadError?: boolean } = {}) {
  const requests: CapturedRequest[] = [];
  let productReads = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (request: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url);
    assert.equal(url.origin, API_ORIGIN, 'cart seller binding must use the test PostgREST only');
    const method = (init?.method || 'GET').toUpperCase();
    requests.push({ method, path: url.pathname });

    if (url.pathname === '/rest/v1/carts' && method === 'GET') return new Response('null', { headers: { 'Content-Type': 'application/json' } });

    if (url.pathname === '/rest/v1/rpc/marketplace_listing_detail') {
      const body = JSON.parse(String(init?.body || '{}')) as { p_listing_id?: string };
      const listingId = body.p_listing_id;
      const listing = listingId === LISTING_ONE
        ? { listing_id: LISTING_ONE, product_id: PRODUCT_ONE, site_id: SELLER_ONE }
        : listingId === LISTING_TWO
          ? { listing_id: LISTING_TWO, product_id: PRODUCT_TWO, site_id: SELLER_TWO }
          : null;
      return new Response(JSON.stringify(listing), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    assert.fail(`unexpected PostgREST request: ${method} ${url.pathname}`);
  }) as typeof globalThis.fetch;

  const app = new Hono<{ Bindings: Env }>();
  registerStorefrontCartRoutes(app, {
    loadPublishedStore: async (_c, subdomain) => subdomain === 'seller-one'
      ? ({ id: SELLER_ONE, subdomain, name: 'Seller One', status: 'published' } as PublishedStoreRecord)
      : null,
    queryPublicProducts: async () => {
      productReads++;
      if (input.productReadError) return { data: [], count: 0, error: new Error('synthetic product read failure') };
      return { data: [], count: 0, error: null };
    },
    normalizePublicRouteToken: (value) => value,
  });

  const env = {
    ENVIRONMENT: 'test',
    SUPABASE_URL: API_ORIGIN,
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
  } as unknown as Env;

  return {
    app,
    env,
    requests,
    productReads: () => productReads,
    restore: () => { globalThis.fetch = originalFetch; },
  };
}

function cartBody(lines: Array<{ listingId: string; productId: string }>) {
  return {
    cart_token: 'seller-binding-regression-token',
    channel: 'web',
    lines: lines.map(({ listingId, productId }) => ({
      product_id: productId,
      marketplace_listing_id: listingId,
      quantity: 1,
      properties: {},
    })),
  };
}

test('marketplace cart rejects a mixed-seller cart before product or cart persistence', async (t) => {
  const route = createRoute();
  t.after(route.restore);

  const response = await route.app.request('/seller-one/marketplace-cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cartBody([
      { listingId: LISTING_ONE, productId: PRODUCT_ONE },
      { listingId: LISTING_TWO, productId: PRODUCT_TWO },
    ])),
  }, route.env);

  assert.equal(response.status, 409);
  assert.equal((await response.json() as { error: { code: string } }).error.code, 'MARKETPLACE_LISTING_UNAVAILABLE');
  assert.equal(route.productReads(), 0, 'mixed-seller lines stop before product hydration');
  assert.deepEqual(route.requests, [
    { method: 'GET', path: '/rest/v1/carts' },
    { method: 'POST', path: '/rest/v1/rpc/marketplace_listing_detail' },
    { method: 'POST', path: '/rest/v1/rpc/marketplace_listing_detail' },
  ], 'no cart, event or queue write occurs after seller mismatch');
});

test('same-seller marketplace lines pass seller binding and reach product hydration', async (t) => {
  const route = createRoute({ productReadError: true });
  t.after(route.restore);

  const response = await route.app.request('/seller-one/marketplace-cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cartBody([
      { listingId: LISTING_ONE, productId: PRODUCT_ONE },
      { listingId: LISTING_ONE, productId: PRODUCT_ONE },
    ])),
  }, route.env);

  assert.equal(response.status, 500, 'the synthetic downstream product-read failure is surfaced');
  assert.equal(route.productReads(), 1, 'same-seller lines reach server product hydration');
  assert.deepEqual(route.requests, [{ method: 'GET', path: '/rest/v1/carts' }, { method: 'POST', path: '/rest/v1/rpc/marketplace_listing_detail' }], 'current-cart admission and seller validation only; no persistence before the injected read failure');
});
