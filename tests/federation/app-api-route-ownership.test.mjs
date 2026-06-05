import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('app-local API route ownership is validator-enforced', () => {
  const validator = read('scripts/validators/domain-boundary-validator.mjs');
  const doc = read('docs/governance/app-api-route-ownership.md');

  assert.match(doc, /P4-4 API Ownership Consolidation/);
  assert.match(doc, /gateway-proxy/);
  assert.match(doc, /app-local-session/);
  assert.match(doc, /blocked-local-safety/);
  assert.match(validator, /appApiRoutes\.length === 115/);
  assert.match(validator, /directDbOrProviderMutationPattern/);
  assert.match(validator, /appLocalCommerceLogicPattern/);
  assert.match(validator, /Storefront app API routes must call the typed gateway client directly, not customer-service helpers/);
});

test('domain boundary validator rejects app-local API ownership drift', () => {
  const result = spawnSync(process.execPath, ['scripts/validators/domain-boundary-validator.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /115 app API route ownership records checked/);
});

test('storefront auto-create no longer accepts client-controlled order stats', () => {
  const route = read('apps/storefront-runtime/src/app/api/customer/auto-create/route.ts');
  const checkout = read('apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx');

  assert.doesNotMatch(route, /orderTotal|order_total|orderId|updateCustomerStats|@\/lib\/customer-service/);
  assert.match(route, /createStorefrontApiClient\(\)\.storefront\.findOrCreateCustomer/);
  assert.doesNotMatch(checkout, /orderTotal:|orderId: order\?\.id/);
});
