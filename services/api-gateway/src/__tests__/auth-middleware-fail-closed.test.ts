import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { authMiddleware, legacyGatewayAuthVerifiers } from '../middleware/auth';

// Phase N3: closed ART-05 by removing the Supabase GoTrue token-acceptance
// path (supabase-bearer) from the gateway's auth middleware. These tests
// prove the removal, not just assert it: a real Hono app, a real request,
// a real response -- no verifier construction is skipped or mocked.

function buildProtectedApp() {
    const app = new Hono();
    app.use('/*', authMiddleware);
    app.get('/protected', (c) => c.json({ data: 'ok' }));
    return app;
}

test('supabase-bearer is no longer registered as a verifier', () => {
    const names = legacyGatewayAuthVerifiers.map((verifier) => verifier.name);
    assert.deepEqual(names, ['internal-session-hmac', 'internal-identity-hmac']);
    assert.ok(!names.includes('supabase-bearer' as never), 'supabase-bearer must not be registered');
});

test('a request carrying only Authorization: Bearer is rejected, not silently authenticated', async () => {
    const app = buildProtectedApp();
    const res = await app.request('/protected', {
        headers: { Authorization: 'Bearer some-token-that-used-to-be-a-supabase-session' },
    });

    assert.equal(res.status, 401);
    const body = await res.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, 'UNAUTHORIZED');
});

test('a request with no credentials at all is still rejected (unchanged baseline)', async () => {
    const app = buildProtectedApp();
    const res = await app.request('/protected');

    assert.equal(res.status, 401);
    const body = await res.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, 'UNAUTHORIZED');
});
