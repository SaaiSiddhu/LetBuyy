import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { PublishedStoreRecord } from '@letbuyy/tenant-core';
import type { Env } from '../index';
import { registerStorefrontCartRoutes } from '../routes/storefront/cart-routes';

const API_ORIGIN = 'https://cart-channel-preservation.test';
const STORE_ID = '11111111-1111-4111-8111-111111111111';
const CART_TOKEN = 'channel-preservation-token';

test('buyer identity update without a channel preserves the cart acquisition channel', async (t) => {
    const originalFetch = globalThis.fetch;
    const writes: Array<Record<string, unknown>> = [];
    let row: Record<string, unknown> = {
        id: '22222222-2222-4222-8222-222222222222',
        store_id: STORE_ID,
        customer_id: null,
        buyer_email: null,
        session_id: CART_TOKEN,
        status: 'active',
        channel: 'whatsapp',
        sales_origin: 'marketplace',
        items: [],
        coupon_code: null,
        checkout_handoff: null,
        abandonment_enqueued_at: null,
        expires_at: '2026-10-06T00:00:00.000Z',
        created_at: '2026-10-05T00:00:00.000Z',
        updated_at: '2026-10-05T00:00:00.000Z',
    };

    globalThis.fetch = (async (request: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url);
        assert.equal(url.origin, API_ORIGIN);
        const method = (init?.method || 'GET').toUpperCase();
        if (url.pathname !== '/rest/v1/carts') assert.fail(`unexpected database request ${method} ${url.pathname}`);

        if (method === 'GET') return new Response(JSON.stringify([row]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (method === 'PATCH') {
            const write = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
            writes.push(write);
            row = { ...row, ...write };
            return new Response(JSON.stringify(row), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        assert.fail(`unexpected database method ${method}`);
    }) as typeof globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });

    const app = new Hono<{ Bindings: Env }>();
    registerStorefrontCartRoutes(app, {
        loadPublishedStore: async (_c, subdomain) => subdomain === 'seller-one'
            ? ({ id: STORE_ID, subdomain, name: 'Seller One', status: 'published' } as PublishedStoreRecord)
            : null,
        queryPublicProducts: async () => ({ data: [], count: 0, error: null }),
        normalizePublicRouteToken: (value) => value,
    });

    const response = await app.request(`/seller-one/cart/${CART_TOKEN}/buyer-identity`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    }, {
        ENVIRONMENT: 'test', SUPABASE_URL: API_ORIGIN, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
    } as unknown as Env);

    assert.equal(response.status, 200, await response.text());
    assert.equal(writes.length, 1);
    assert.equal(writes[0].channel, 'whatsapp');
    assert.equal(writes[0].sales_origin, 'marketplace');
});
