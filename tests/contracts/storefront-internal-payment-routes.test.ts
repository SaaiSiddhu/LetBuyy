import assert from 'node:assert/strict';
import test from 'node:test';
import storefrontRouter from '../../services/api-gateway/src/routes/storefront';

const productionEnv = { ENVIRONMENT: 'production' };

const endpoints = [
    { method: 'GET', path: '/internal/orders/11111111-1111-4111-8111-111111111111/payable' },
    { method: 'POST', path: '/internal/payments/reference' },
    { method: 'POST', path: '/internal/payments/confirm' },
    { method: 'POST', path: '/internal/payments/failure' },
    { method: 'POST', path: '/internal/payments/event' },
] as const;

for (const endpoint of endpoints) {
    test(`${endpoint.method} ${endpoint.path} requires an internal secret`, async () => {
        const response = await storefrontRouter.fetch(
            new Request(`https://api.letbuyy.test${endpoint.path}`, {
                method: endpoint.method,
                headers: endpoint.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
                body: endpoint.method === 'POST' ? '{}' : undefined,
            }),
            productionEnv,
        );

        const body = await response.json() as { success?: boolean; error?: { code?: string } };
        assert.equal(response.status, 403);
        assert.equal(body.success, false);
        assert.equal(body.error?.code, 'FORBIDDEN');
    });
}
