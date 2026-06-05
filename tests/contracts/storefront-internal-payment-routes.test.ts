import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { isInternalApiSecretRequest } from '../../services/api-gateway/src/lib/internal-secret';

const testDir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(
    join(testDir, '../../services/api-gateway/src/routes/storefront/internal-payment-routes.ts'),
    'utf8',
);

const environments = [
    { name: 'staging', env: { ENVIRONMENT: 'staging' } },
    { name: 'production', env: { ENVIRONMENT: 'production' } },
] as const;

const endpoints = [
    { method: 'get', path: '/internal/orders/:orderId/payable' },
    { method: 'post', path: '/internal/payments/reference' },
    { method: 'post', path: '/internal/payments/confirm' },
    { method: 'post', path: '/internal/payments/failure' },
    { method: 'post', path: '/internal/payments/event' },
] as const;

for (const environment of environments) {
    test(`internal API secret guard fails closed in ${environment.name} without a configured secret`, () => {
        assert.equal(
            isInternalApiSecretRequest(environment.env, { header: () => undefined }),
            false,
        );
    });
}

test('internal API secret guard accepts only the configured shared secret', () => {
    const env = { INTERNAL_API_SECRET: 'configured-secret' };

    assert.equal(isInternalApiSecretRequest(env, { header: () => undefined }), false);
    assert.equal(isInternalApiSecretRequest(env, { header: () => 'wrong-secret' }), false);
    assert.equal(isInternalApiSecretRequest(env, { header: () => 'configured-secret' }), true);
});

for (const endpoint of endpoints) {
    test(`${endpoint.method.toUpperCase()} ${endpoint.path} is wired through fail-closed 403 guard`, () => {
        const escapedPath = endpoint.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(routeSource, new RegExp(`router\\.${endpoint.method}\\('${escapedPath}'`));
        assert.match(routeSource, /if \(!isInternalRequest\(c\)\) {\s*return c\.json\(\{ success: false, error: \{ code: 'FORBIDDEN', message: 'Internal API secret required' \} \}, 403\);/);
    });
}
