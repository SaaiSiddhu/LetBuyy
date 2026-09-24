import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readStorefrontRouteSource } from '../helpers/app-store-route-source.mjs';

const storefrontRouteSource = readStorefrontRouteSource();
const rateLimitSource = readFileSync('services/api-gateway/src/middleware/rateLimit.ts', 'utf8');
const securitySource = readFileSync('services/api-gateway/src/middleware/security.ts', 'utf8');
const commerceCoreSource = readFileSync('packages/commerce-core/src/index.ts', 'utf8');
const apiClientSource = readFileSync('packages/typescript/api-client/src/index.ts', 'utf8');
const storefrontLoginRouteSource = readFileSync('apps/commerce/web/src/app/api/customer/login/route.ts', 'utf8');
const customerServiceSource = readFileSync('apps/commerce/web/src/lib/customer-service.ts', 'utf8');
const accountSheetSource = readFileSync('apps/commerce/web/src/components/account/account-bottom-sheet.tsx', 'utf8');
const reviewsApiRouteSource = readFileSync('apps/commerce/web/src/app/api/reviews/route.ts', 'utf8');
const productReviewsSource = readFileSync('apps/commerce/web/src/components/product/product-reviews.tsx', 'utf8');

function blockAfter(marker, length = 2_500) {
  const start = storefrontRouteSource.indexOf(marker);
  assert.notEqual(start, -1, `${marker} exists`);
  return storefrontRouteSource.slice(start, start + length);
}

test('customer login is rate-limited and Turnstile-gated before password comparison', () => {
  const loginBlock = blockAfter("router.post('/customer/login'", 2_200);
  const rateIndex = loginBlock.indexOf('enforceCustomerAuthRateLimit');
  const turnstileIndex = loginBlock.indexOf('requireValidTurnstile');
  const compareIndex = loginBlock.indexOf('bcrypt.compare');

  assert.notEqual(rateIndex, -1, 'login has customer-auth limiter');
  assert.notEqual(turnstileIndex, -1, 'login has Turnstile check');
  assert.notEqual(compareIndex, -1, 'login compares password');
  assert.ok(rateIndex < compareIndex, 'limiter runs before bcrypt.compare');
  assert.ok(turnstileIndex < compareIndex, 'Turnstile runs before bcrypt.compare');
});

test('customer password and guest order tracking paths are customer-auth rate limited', () => {
  for (const marker of [
    "router.post('/customer/password/request-reset'",
    "router.post('/customer/password/confirm-reset'",
    "router.get('/:subdomain/orders/contact'",
  ]) {
    assert.match(blockAfter(marker), /enforceCustomerAuthRateLimit/);
  }
});

test('public contact and review submissions require Turnstile', () => {
  assert.match(blockAfter("router.post('/reviews'"), /requireValidTurnstile/);
  assert.match(blockAfter("router.post('/:subdomain/contact'"), /requireValidTurnstile/);
});

test('gateway exposes fail-closed Turnstile verification and customer auth limiter', () => {
  assert.match(securitySource, /export async function verifyTurnstileToken/);
  assert.match(securitySource, /if \(!env\.TURNSTILE_SECRET_KEY\) \{\s*return false;/);
  assert.match(securitySource, /token === 'dev-bypass-token'[\s\S]{0,120}isLocalTurnstileRuntime/);
  assert.match(rateLimitSource, /export async function enforceCustomerAuthRateLimit/);
  assert.match(rateLimitSource, /maxPerIdentity = 5/);
  assert.match(rateLimitSource, /CUSTOMER_AUTH_RATE_LIMITED/);
});

test('storefront runtime forwards Turnstile tokens for customer login and reviews', () => {
  assert.match(apiClientSource, /turnstile_token\?: string \| null/);
  assert.match(storefrontLoginRouteSource, /turnstileToken/);
  assert.match(customerServiceSource, /turnstile_token: turnstileToken \|\| null/);
  assert.match(accountSheetSource, /TurnstileWidget/);
  assert.match(accountSheetSource, /login\(email, password, storeId, turnstileToken\)/);
  assert.match(reviewsApiRouteSource, /turnstile_token: body\.turnstileToken/);
  assert.match(productReviewsSource, /TurnstileWidget/);
  assert.match(productReviewsSource, /turnstileToken/);
  assert.match(commerceCoreSource, /turnstile_token: z\.string\(\)/);
});
