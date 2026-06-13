// LB-12 — Shopper registration. Verifies the register backend (gateway), the storefront proxy, the
// api-client method, the route-count lockstep, and the HS256 issuer invariant. (Smoke / contract level.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const gateway = read('services/api-gateway/src/routes/storefront/customer-registration.ts');
const proxy = read('apps/storefront-runtime/src/app/api/customer/register/route.ts');
const apiClient = read('packages/typescript/api-client/src/index.ts');
const validator = read('scripts/validators/domain-boundary-validator.mjs');

test('LB-12: gateway exposes POST /customer/register', () => {
  assert.match(gateway, /router\.post\('\/customer\/register'/);
});

test('LB-12: register enforces rate-limit -> Turnstile -> not-exists precondition -> bcrypt', () => {
  const route = gateway; // customer-registration.ts contains only the register route
  assert.match(route, /enforceCustomerAuthRateLimit/);
  assert.match(route, /operation:\s*'customer-register'/);
  assert.match(route, /requireValidTurnstile/);
  // not-exists precondition: an existing credential is rejected (no token-less overwrite = no takeover)
  assert.match(route, /existingCredential\?\.password_hash/);
  assert.match(route, /ACCOUNT_EXISTS/);
  assert.match(route, /bcrypt\.hash\(body\.password, 10\)/);
  assert.match(route, /body\.password\.length < 8 \|\| body\.password\.length > 128/);
});

test('LB-12: register mints the HS256 customer session (issuer invariant preserved)', () => {
  const route = gateway; // customer-registration.ts contains only the register route
  assert.match(route, /issueCustomerSession/);
  assert.match(route, /CUSTOMER_SESSION_SECRET/);
  assert.match(route, /LETBUYY_CUSTOMER_SESSION_COOKIE/);
  // no merchant issuer / identity-platform / ES256 in the register path
  assert.doesNotMatch(route, /identity-platform|ES256|issueMerchant|EdDSA/i);
});

test('LB-12: storefront proxy re-mints locally + handles ACCOUNT_EXISTS', () => {
  assert.match(proxy, /registerCustomer/);
  assert.match(proxy, /createSession/);
  assert.match(proxy, /ACCOUNT_EXISTS/);
  assert.match(apiClient, /registerCustomer:/);
  assert.match(apiClient, /'\/storefront\/customer\/register'/);
});

test('LB-12: route-count lockstep applied (127 -> 128, now 129 after LB-11)', () => {
  // LB-12 bumped 127 -> 128; LB-11 added the gift-cards/[id] proxy bumping 128 -> 129.
  // This mirror tracks the validator's live pinned count in lockstep.
  assert.match(validator, /appApiRoutes\.length === 129/);
});
