import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { Hono } from 'hono';
import { createLetbuyyInternalAppHeaders, getLetbuyyInternalAuthSecret } from '../../packages/auth-core/src/index.ts';
import { internalPerimeter } from '../../services/api-gateway/src/middleware/internal-perimeter.ts';

function appWithPerimeter(env: Record<string, string | undefined>) {
  const app = new Hono<{ Bindings: typeof env }>();
  app.use('/internal/*', internalPerimeter as never);
  app.get('/internal/probe', (c) => c.json({ ok: true }));
  return { app, env };
}

test('internal auth secret helper is isolated from AUTH_SECRET', () => {
  assert.equal(getLetbuyyInternalAuthSecret({ AUTH_SECRET: 'legacy' } as never), undefined);
  assert.equal(
    getLetbuyyInternalAuthSecret({
      LETBUYY_INTERNAL_API_SECRET: 'dedicated',
      AUTH_SECRET: 'legacy',
    } as never),
    'dedicated',
  );
});

test('internal perimeter fails closed in production without an allowlist', async () => {
  const { app, env } = appWithPerimeter({ ENVIRONMENT: 'production' });
  const response = await app.request('/internal/probe', undefined, env);
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'INTERNAL_PERIMETER_UNCONFIGURED');
});

test('internal perimeter enforces source allowlist and signed-internal-token presence', async () => {
  const { app, env } = appWithPerimeter({
    ENVIRONMENT: 'production',
    INTERNAL_GATEWAY_IP_ALLOWLIST: '203.0.113.10/32',
  });

  const deniedSource = await app.request('/internal/probe', {
    headers: {
      'CF-Connecting-IP': '203.0.113.11',
      'X-LetBuyy-Internal-Signature': 'a'.repeat(64),
      'X-LetBuyy-Internal-Timestamp': String(Date.now()),
      'X-LetBuyy-Internal-JTI': 'jti_wave4_denied_001',
    },
  }, env);
  assert.equal(deniedSource.status, 403);

  const noCredential = await app.request('/internal/probe', {
    headers: {
      'CF-Connecting-IP': '203.0.113.10',
    },
  }, env);
  assert.equal(noCredential.status, 401);

  const signed = await createLetbuyyInternalAppHeaders({ app: 'accounts', secret: 'secret' });
  const accepted = await app.request('/internal/probe', {
    headers: {
      'CF-Connecting-IP': '203.0.113.10',
      ...signed.headers,
    },
  }, env);
  assert.equal(accepted.status, 200);
});

test('session-security validator is green', () => {
  execFileSync('node', ['scripts/validators/session-security-validator.mjs'], {
    cwd: process.cwd(),
    stdio: 'pipe',
  });
});
