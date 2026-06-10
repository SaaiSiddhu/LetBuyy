import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { hmacSha256Hex, internalAppSigningPayload } from '@letbuyy/auth-core';
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

test('customer find-or-create rejects unsigned public callers before any database access', async () => {
    const response = await createCustomerEngagementApp().request('/customer/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            store_id: '11111111-1111-4111-8111-111111111111',
            email: 'buyer@example.com',
        }),
    }, env());

    assert.equal(response.status, 401);
    const payload = await response.json() as { error?: { code?: string } };
    assert.equal(payload.error?.code, 'UNAUTHORIZED');
});

test('customer find-or-create accepts a valid storefront internal signature and reaches validation', async () => {
    const secret = 'test-internal-secret';
    const response = await createCustomerEngagementApp().request('/customer/find-or-create', {
        method: 'POST',
        headers: await storefrontInternalHeaders(secret),
        body: JSON.stringify({}),
    }, env({ INTERNAL_API_SECRET: secret }));

    assert.equal(response.status, 400);
    const payload = await response.json() as { error?: { code?: string } };
    assert.equal(payload.error?.code, 'VALIDATION');
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
