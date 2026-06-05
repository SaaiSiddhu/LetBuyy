import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const smokeSpec = readFileSync('tests/e2e/smoke/release-gates.spec.ts', 'utf8');
const gatewayIndex = readFileSync('services/api-gateway/src/index.ts', 'utf8');
const productionWorkflow = readFileSync('.github/workflows/production-deploy.yml', 'utf8');
const stagingWorkflow = readFileSync('.github/workflows/staging-deploy.yml', 'utf8');

function indexOf(source, fragment) {
  const index = source.indexOf(fragment);
  assert.notEqual(index, -1, `${fragment} exists`);
  return index;
}

test('release smoke suite covers every beta-blocker smoke gate', () => {
  for (const fragment of [
    'identity login succeeds with the seeded smoke merchant',
    'storefront product read returns a seeded public product',
    'checkout create produces a COD order for the smoke store',
    'webhook service rejects a bad Razorpay signature',
    'gateway queue health reports all release queue bindings ready',
  ]) {
    assert.match(smokeSpec, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(smokeSpec, /LETBUYY_E2E_REQUIRE_REAL_STACK/);
  assert.match(smokeSpec, /LETBUYY_E2E_IDENTITY_EMAIL/);
  assert.match(smokeSpec, /LETBUYY_E2E_IDENTITY_PASSWORD/);
});

test('api gateway exposes queue readiness for release smoke', () => {
  assert.match(gatewayIndex, /api\.get\('\/health\/queues'/);

  for (const binding of ['EVENT_QUEUE', 'ANALYTICS_QUEUE', 'SEARCH_QUEUE', 'NOTIFICATION_QUEUE', 'RUNTIME_QUEUE']) {
    assert.match(gatewayIndex, new RegExp(binding));
  }
});

test('canonical deploy workflows run smoke against real deployed stacks', () => {
  for (const workflow of [productionWorkflow, stagingWorkflow]) {
    assert.match(workflow, /LETBUYY_E2E_REQUIRE_REAL_STACK: "1"/);
    assert.match(workflow, /LETBUYY_E2E_API_URL:/);
    assert.match(workflow, /LETBUYY_E2E_WEBHOOK_URL:/);
    assert.match(workflow, /LETBUYY_E2E_IDENTITY_EMAIL:/);
    assert.match(workflow, /LETBUYY_E2E_IDENTITY_PASSWORD:/);
  }

  assert.match(productionWorkflow, /STAGING_E2E_IDENTITY_EMAIL/);
  assert.match(productionWorkflow, /PRODUCTION_E2E_IDENTITY_EMAIL/);
});

test('staging worker secrets are set before deployed revisions can serve', () => {
  const apiSecretIndex = indexOf(stagingWorkflow, 'Set api-gateway staging secrets');
  const apiDeployIndex = indexOf(stagingWorkflow, 'Deploy api-gateway to staging');
  assert.ok(apiSecretIndex < apiDeployIndex, 'api-gateway staging secrets must be set before deploy');

  const webhookSecretIndex = indexOf(stagingWorkflow, 'Set webhook-service staging secrets');
  const webhookDeployIndex = indexOf(stagingWorkflow, 'Deploy webhook-service to staging');
  assert.ok(webhookSecretIndex < webhookDeployIndex, 'webhook-service staging secrets must be set before deploy');

  assert.match(stagingWorkflow, /wrangler secret put CUSTOMER_SESSION_SECRET --env staging/);
  assert.match(stagingWorkflow, /wrangler secret put TURNSTILE_SECRET_KEY --env staging/);
});
