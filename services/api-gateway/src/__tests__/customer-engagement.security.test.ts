import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import {
    LETBUYY_CUSTOMER_SESSION_COOKIE,
    hmacSha256Hex,
    internalAppSigningPayload,
    issueCustomerSession,
} from '@letbuyy/auth-core';
import type { Env } from '../index';
import { requireCustomerSession } from '../middleware/customer-session';
import { registerStorefrontCustomerEngagementRoutes } from '../routes/storefront/customer-engagement-routes';

function env(overrides: Partial<Env> = {}): Env {
    return {
        ENVIRONMENT: 'test',
        INTERNAL_API_SECRET: 'test-internal-secret',
        ...overrides,
    } as Env;
}

async function storefrontInternalHeaders(secret: string): Promise<Record<string, string>> {
    const timestamp = String(Date.now());
    const jti = `test-jti-${crypto.randomUUID()}`;
    return {
        'Content-Type': 'application/json',
        'X-LetBuyy-Internal-App': 'storefront',
        'X-LetBuyy-Internal-Timestamp': timestamp,
        'X-LetBuyy-Internal-JTI': jti,
        'X-LetBuyy-Internal-Signature': await hmacSha256Hex(secret, internalAppSigningPayload('storefront', timestamp, jti)),
    };
}

function createCustomerEngagementApp() {
    const app = new Hono<{ Bindings: Env }>();
    app.use('/customer/profile', requireCustomerSession);
    registerStorefrontCustomerEngagementRoutes(app, {
        loadPublishedStore: async () => null,
        hydrateStorefrontOrderItems: async (_c, orders) => orders,
        orderItemsRelationalReadsEnabled: () => true,
        isMissingColumnError: () => false,
        isMissingTableError: () => false,
        requireValidTurnstile: async () => null,
    });
    return app;
}

test('customer profile GET requires a session and reads only that active customer in the signed store', async () => {
    const secret = 'profile-session-test-secret';
    const storeId = '11111111-1111-4111-8111-111111111111';
    const customerId = '22222222-2222-4222-8222-222222222222';
    const originalFetch = globalThis.fetch;
    const requests: URL[] = [];
    globalThis.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        requests.push(url);
        assert.equal(init?.method || 'GET', 'GET');
        return Response.json([{
            id: customerId,
            email: 'buyer@example.test',
            full_name: 'Buyer Name',
            phone: '+91 9876543210',
            accepts_marketing: true,
        }]);
    };

    try {
        const token = (await issueCustomerSession({ storeId, customerId }, secret)).token;
        const app = createCustomerEngagementApp();
        const denied = await app.request('/customer/profile', { method: 'GET' }, env({ CUSTOMER_SESSION_SECRET: secret }));
        assert.equal(denied.status, 401);
        assert.equal(requests.length, 0, 'unsigned profile reads must not reach the database');

        const response = await app.request('/customer/profile', {
            headers: { Cookie: `${LETBUYY_CUSTOMER_SESSION_COOKIE}=${token}` },
        }, env({
            CUSTOMER_SESSION_SECRET: secret,
            SUPABASE_URL: 'https://supabase.example.test',
            SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
            SUPABASE_ANON_KEY: 'test-anon-key',
        }));

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
            success: true,
            data: {
                customer: {
                    id: customerId,
                    email: 'buyer@example.test',
                    full_name: 'Buyer Name',
                    phone: '+91 9876543210',
                    accepts_marketing: true,
                },
            },
        });
        assert.equal(requests.length, 1);
        assert.equal(requests[0].searchParams.get('id'), `eq.${customerId}`);
        assert.equal(requests[0].searchParams.get('store_id'), `eq.${storeId}`);
        assert.equal(requests[0].searchParams.get('status'), 'eq.active');
        assert.equal(requests[0].searchParams.get('deleted_at'), 'is.null');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('legacy customer status lookup route is removed', async () => {
    const response = await createCustomerEngagementApp().request(
        '/customer/status?store_id=11111111-1111-4111-8111-111111111111&email=buyer%40example.test',
        { method: 'GET' },
        env(),
    );

    assert.equal(response.status, 404);
});

test('generic caller-supplied customer find-or-create route is removed', async () => {
    const response = await createCustomerEngagementApp().request('/customer/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: '11111111-1111-4111-8111-111111111111', email: 'buyer@example.com' }),
    }, env());

    assert.equal(response.status, 404);
});

test('customer from-order rejects unsigned public callers before any database access', async () => {
    const response = await createCustomerEngagementApp().request('/customer/from-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: '11111111-1111-4111-8111-111111111111', order_id: '22222222-2222-4222-8222-222222222222' }),
    }, env());

    assert.equal(response.status, 401);
    const payload = await response.json() as { error?: { code?: string } };
    assert.equal(payload.error?.code, 'UNAUTHORIZED');
});

test('customer from-order validates identifiers before database access', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        assert.equal(url.pathname, '/rest/v1/rpc/consume_internal_auth_replay_jti', 'only the auth replay claim may reach storage before request validation');
        assert.equal(init?.method, 'POST');
        return Response.json(true);
    };
    try {
    const secret = 'test-internal-secret';
    const response = await createCustomerEngagementApp().request('/customer/from-order', {
        method: 'POST',
        headers: await storefrontInternalHeaders(secret),
        body: JSON.stringify({ store_id: ' ', order_id: '22222222-2222-4222-8222-222222222222' }),
    }, env({
        INTERNAL_API_SECRET: secret,
        SUPABASE_URL: 'https://supabase.example.test',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    }));

    assert.equal(response.status, 400);
    const payload = await response.json() as { error?: { code?: string } };
    assert.equal(payload.error?.code, 'VALIDATION');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('customer from-order materializes only the contact persisted on the same-store order', async () => {
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: URL; method: string; body?: unknown }> = [];
    globalThis.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.pathname.endsWith('/rpc/consume_internal_auth_replay_jti')) return Response.json(true);
        const method = init?.method || 'GET';
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
        requests.push({ url, method, body });

        if (url.pathname.endsWith('/orders') && method === 'GET') {
            return Response.json([{
                id: '22222222-2222-4222-8222-222222222222',
                store_id: '11111111-1111-4111-8111-111111111111',
                customer_email: 'Order.Contact@Example.test',
                customer_name: 'Order Contact',
                customer_phone: '+91 9876543210',
            }]);
        }
        if (url.pathname.endsWith('/store_customers') && method === 'GET') return Response.json([]);
        if (url.pathname.endsWith('/store_customers') && method === 'POST') return Response.json([{ id: '33333333-3333-4333-8333-333333333333' }]);
        if (url.pathname.endsWith('/customer_activity_log') && method === 'POST') return Response.json([]);
        throw new Error(`Unexpected Supabase request ${method} ${url.pathname}`);
    };

    try {
        const secret = 'test-internal-secret';
        const response = await createCustomerEngagementApp().request('/customer/from-order', {
            method: 'POST',
            headers: await storefrontInternalHeaders(secret),
            body: JSON.stringify({
                store_id: '11111111-1111-4111-8111-111111111111',
                order_id: '22222222-2222-4222-8222-222222222222',
                email: 'attacker@example.test',
                full_name: 'Attacker',
                phone: '0000000000',
            }),
        }, env({
            INTERNAL_API_SECRET: secret,
            SUPABASE_URL: 'https://supabase.example.test',
            SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
            SUPABASE_ANON_KEY: 'test-anon-key',
        }));

        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), { success: true, data: { created: true } });
        const orderRequest = requests.find((request) => request.url.pathname.endsWith('/orders'));
        assert.equal(orderRequest?.url.searchParams.get('id'), 'eq.22222222-2222-4222-8222-222222222222');
        assert.equal(orderRequest?.url.searchParams.get('store_id'), 'eq.11111111-1111-4111-8111-111111111111');
        const customerInsert = requests.find((request) => request.url.pathname.endsWith('/store_customers') && request.method === 'POST');
        assert.deepEqual(customerInsert?.body, {
            store_id: '11111111-1111-4111-8111-111111111111',
            email: 'order.contact@example.test',
            full_name: 'Order Contact',
            phone: '+91 9876543210',
            status: 'active',
            password_hash: null,
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('customer from-order cannot bootstrap a CRM profile with a mismatched store scope', async () => {
    const originalFetch = globalThis.fetch;
    const requests: URL[] = [];
    globalThis.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        if (url.pathname.endsWith('/rpc/consume_internal_auth_replay_jti')) return Response.json(true);
        requests.push(url);
        assert.equal(init?.method || 'GET', 'GET');
        return Response.json([]);
    };

    try {
        const secret = 'test-internal-secret';
        const response = await createCustomerEngagementApp().request('/customer/from-order', {
            method: 'POST',
            headers: await storefrontInternalHeaders(secret),
            body: JSON.stringify({
                store_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                order_id: '22222222-2222-4222-8222-222222222222',
            }),
        }, env({
            INTERNAL_API_SECRET: secret,
            SUPABASE_URL: 'https://supabase.example.test',
            SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
            SUPABASE_ANON_KEY: 'test-anon-key',
        }));

        assert.equal(response.status, 404);
        assert.equal(requests.length, 1, 'a missing same-store order must stop before customer writes');
        assert.equal(requests[0].searchParams.get('store_id'), 'eq.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('CUSTOMER_LEGACY_AUTH no longer bypasses required customer sessions', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', requireCustomerSession);
    app.post('/customer/profile', (c) => c.json({ ok: true }));

    const response = await app.request('/customer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            store_id: '11111111-1111-4111-8111-111111111111',
            customer_id: '22222222-2222-4222-8222-222222222222',
        }),
    }, env({ CUSTOMER_LEGACY_AUTH: 'on' } as Partial<Env>));

    assert.equal(response.status, 401);
    const payload = await response.json() as { error?: { code?: string } };
    assert.equal(payload.error?.code, 'CUSTOMER_SESSION_REQUIRED');
});
