import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import { registerCustomerRegistrationRoute } from '../routes/storefront/customer-registration';

test('gateway refuses creation of a per-store login and directs callers to buyer identity', async () => {
    const app = new Hono<{ Bindings: Env }>();
    registerCustomerRegistrationRoute(app);

    const response = await app.request('/customer/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            store_id: '11111111-1111-4111-8111-111111111111',
            email: 'buyer@example.invalid',
            password: 'synthetic-password',
        }),
    });

    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), {
        success: false,
        error: {
            code: 'CANONICAL_BUYER_ACCOUNT_REQUIRED',
            message: 'Create your LetBuyy account through the canonical sign-in flow.',
        },
    });
});
