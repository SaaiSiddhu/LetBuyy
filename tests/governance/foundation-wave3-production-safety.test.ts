import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  checkQueryCostRateLimitKey,
  checkRateLimitKey,
} from '../../services/api-gateway/src/middleware/rateLimit.ts';
import {
  createDomainRegistrarProvider,
  MockRegistrarProvider,
} from '../../services/api-gateway/src/lib/registrar/index.ts';
import {
  evaluateProductionSafetyPreflight,
} from '../../scripts/foundation/production-safety-preflight.mjs';

test('production rate limiting fails closed when no backend is ready', async () => {
  const env = { ENVIRONMENT: 'production' };

  const fixedWindow = await checkRateLimitKey(env as never, {
    key: 'wave3-fixed',
    max: 10,
  });
  assert.equal(fixedWindow.allowed, false);
  assert.equal(fixedWindow.unavailable, true);
  assert.equal(fixedWindow.remaining, 0);

  const queryCost = await checkQueryCostRateLimitKey(env as never, {
    key: 'wave3-query',
    cost: 5,
  });
  assert.equal(queryCost.allowed, false);
  assert.equal(queryCost.unavailable, true);
  assert.equal(queryCost.remaining, 0);
});

test('mock registrar stays gated and no longer emits mock:true raw payloads', async () => {
  assert.throws(
    () => createDomainRegistrarProvider({
      ENVIRONMENT: 'production',
      REGISTRAR_PROVIDER: 'mock',
      REGISTRAR_MOCK_ENABLED: 'true',
    }),
    /Mock registrar is only allowed outside production/,
  );

  const provider = new MockRegistrarProvider({ ENVIRONMENT: 'development', REGISTRAR_MOCK_ENABLED: 'true' });
  const result = await provider.purchaseDomain({
    domain: 'example.store',
    years: 1,
    owner: { name: 'Test Merchant', email: 'merchant@example.com' },
    paymentReference: 'non-production-fixture',
    idempotencyKey: 'idem-001',
  });
  assert.deepEqual(result.raw, { provider: 'mock', simulated: true });
});

test('shared environment preflight rejects sentinel secrets until evidence is ready', () => {
  const failed = evaluateProductionSafetyPreflight({
    DEPLOYMENT_ENV: 'production',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'SKIP_NEEDS_HUMAN_SUPABASE_SERVICE_ROLE_KEY',
    AUTH_SECRET: 'secret',
    CSRF_SECRET: 'secret',
    INTERNAL_API_SECRET: 'secret',
    LETBUYY_INTERNAL_API_SECRET: 'secret',
    TOTP_ENCRYPTION_KEY: 'secret',
    INTERNAL_GATEWAY_IP_ALLOWLIST: '127.0.0.1/32',
    PREVIEW_SIGNING_KEY: 'secret',
    STORE_ACCESS_SIGNING_KEY: 'secret',
    PAYMENT_CONFIG_ENCRYPTION_KEY: 'secret',
    UPSTASH_REDIS_REST_URL: 'https://redis.example',
    UPSTASH_REDIS_REST_TOKEN: 'secret',
    RATE_LIMIT_BACKEND_READY: 'true',
    RUNTIME_TELEMETRY_READY: 'false',
    MONEY_LEDGER_RECONCILIATION_ALERT_READY: 'true',
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.issues.some((issue) => issue.key === 'SUPABASE_SERVICE_ROLE_KEY'), true);
  assert.equal(failed.issues.some((issue) => issue.key === 'RUNTIME_TELEMETRY_READY'), true);

  const passed = evaluateProductionSafetyPreflight({
    DEPLOYMENT_ENV: 'staging',
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'secret',
    AUTH_SECRET: 'secret',
    CSRF_SECRET: 'secret',
    INTERNAL_API_SECRET: 'secret',
    LETBUYY_INTERNAL_API_SECRET: 'secret',
    TOTP_ENCRYPTION_KEY: 'secret',
    INTERNAL_GATEWAY_IP_ALLOWLIST: '127.0.0.1/32',
    PREVIEW_SIGNING_KEY: 'secret',
    STORE_ACCESS_SIGNING_KEY: 'secret',
    PAYMENT_CONFIG_ENCRYPTION_KEY: 'secret',
    UPSTASH_REDIS_REST_URL: 'https://redis.example',
    UPSTASH_REDIS_REST_TOKEN: 'secret',
    RATE_LIMIT_BACKEND_READY: 'ready',
    RUNTIME_TELEMETRY_READY: 'ready',
    MONEY_LEDGER_RECONCILIATION_ALERT_READY: 'ready',
  });
  assert.equal(passed.ok, true);
});

test('domain defaults stay on letbuyy.store until DNS cutover is approved', () => {
  for (const file of [
    'apps/marketing-site/src/lib/public-urls.ts',
    'apps/theme-marketplace/src/lib/public-urls.ts',
    'apps/app-marketplace/src/lib/site-url.ts',
    'apps/developer-portal/src/lib/site-url.ts',
  ]) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /const DEFAULT_PLATFORM_ROOT_DOMAIN = 'letbuyy\.store'/, file);
  }
});
