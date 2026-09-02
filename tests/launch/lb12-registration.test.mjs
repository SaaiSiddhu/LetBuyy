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
const proxy = read('apps/customer_web/src/app/api/customer/register/route.ts');
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

test('LB-12: route-count lockstep applied (188 routes)', () => {
  // This mirror tracks the validator's live pinned count in lockstep.
  assert.match(validator, /appApiRoutes\.length === 188/);
});

// ── LB-12 (UI): the storefront account bottom-sheet now wires the register branch. The backend
// always existed; the bug was that the UI dead-ended new users and called setPassword (no token).
const sheet = read('apps/customer_web/src/components/account/account-bottom-sheet.tsx');
const authContext = read('apps/customer_web/src/context/customer-auth-context.tsx');

test('LB-12 UI: bottom-sheet consumes register() and exposes a register state + handler', () => {
  assert.match(sheet, /login, setPassword, register, checkEmail, logout/);
  assert.match(sheet, /'register'/);
  assert.match(sheet, /const handleRegister = async/);
});

test('LB-12 UI: new + passwordless emails route to register (the not_found dead-end is gone)', () => {
  const fn = sheet.slice(sheet.indexOf('const handleEmailSubmit'), sheet.indexOf('const handleLogin'));
  assert.match(fn, /result\.hasPassword/);
  assert.match(fn, /setState\('password_login'\)/);
  assert.match(fn, /setState\('register'\)/);
  assert.doesNotMatch(fn, /setState\('not_found'\)/);
});

test('LB-12 UI: handleRegister calls context.register and enforces the 8-char backend minimum', () => {
  const fn = sheet.slice(sheet.indexOf('const handleRegister'), sheet.indexOf('// ── LOGOUT'));
  assert.match(fn, /await register\(email, password, storeId/);
  assert.match(fn, /password\.length < 8/);
});

test('LB-12 UI: the register form posts via handleRegister and renders a Turnstile widget', () => {
  const block = sheet.slice(sheet.indexOf('STATE: Register'), sheet.indexOf('STATE: Not Found'));
  assert.match(block, /onSubmit=\{handleRegister\}/);
  assert.match(block, /<TurnstileWidget/);
  assert.match(block, /Create Account/);
});

test('LB-12 UI: the auth context register() posts to the local /api/customer/register proxy (HS256)', () => {
  assert.match(authContext, /const register = useCallback/);
  assert.match(authContext, /'\/api\/customer\/register'/);
});
