import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authCoreSessionSource = readFileSync('packages/auth-core/src/customer-session.ts', 'utf8');
const gatewaySessionMiddleware = readFileSync('services/api-gateway/src/middleware/customer-session.ts', 'utf8');
const storefrontRouteSource = readFileSync('services/api-gateway/src/routes/storefront.ts', 'utf8');
const storefrontGraphQLSource = readFileSync('services/api-gateway/src/graphql/storefront.ts', 'utf8');
const storefrontApiClientSource = readFileSync('apps/storefront-runtime/src/lib/api/client.ts', 'utf8');
const storefrontSetPasswordRouteSource = readFileSync('apps/storefront-runtime/src/app/api/customer/set-password/route.ts', 'utf8');
const customerResetMigrationSource = readFileSync('database/supabase/migrations/077_customer_reset_tokens.sql', 'utf8');

test('auth-core exposes a 30-minute HMAC customer session primitive', () => {
  assert.match(authCoreSessionSource, /LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS = 30 \* 60/);
  assert.match(authCoreSessionSource, /export async function issueCustomerSession/);
  assert.match(authCoreSessionSource, /export async function verifyCustomerSession/);
  assert.match(authCoreSessionSource, /crypto\.subtle\.importKey/);
  assert.match(authCoreSessionSource, /alg: 'HS256'/);
});

test('gateway customer-account routes require a signed customer session by default', () => {
  assert.match(gatewaySessionMiddleware, /CUSTOMER_SESSION_REQUIRED/);
  assert.match(gatewaySessionMiddleware, /verifyCustomerSession\(/);
  assert.match(gatewaySessionMiddleware, /verifyCustomerSessionToken\(/);
  assert.match(gatewaySessionMiddleware, /X-LetBuyy-Customer-Session/);

  for (const route of [
    '/customer/wishlist',
    '/customer/orders',
    '/customer/activity',
    '/customer/profile',
    '/customer/addresses',
  ]) {
    assert.match(storefrontRouteSource, new RegExp(`router\\.use\\('${route.replace(/\//g, '\\/')}`));
  }

  assert.match(storefrontRouteSource, /function getVerifiedStoreCustomer/);
  assert.match(storefrontRouteSource, /session\.storeId !== storeId \|\| session\.customerId !== customerId/);
  assert.doesNotMatch(storefrontRouteSource, /select\('\*'\)[\s\S]{0,240}\/customer\/login/);
});

test('legacy enumeration routes are internal-signed and do not return password_hash', () => {
  for (const marker of [
    "router.post('/customer/password'",
    "router.get('/customer/by-email'",
    "router.get('/customer/status'",
    "router.get('/:subdomain/orders/contact'",
  ]) {
    const index = storefrontRouteSource.indexOf(marker);
    assert.notEqual(index, -1, `${marker} exists`);
    assert.match(storefrontRouteSource.slice(index, index + 260), /requireStorefrontInternal/);
  }

  const byEmailIndex = storefrontRouteSource.indexOf("router.get('/customer/by-email'");
  const byEmailBlock = storefrontRouteSource.slice(byEmailIndex, byEmailIndex + 1_200);
  assert.doesNotMatch(byEmailBlock, /select\('\*'\)/);
  assert.doesNotMatch(byEmailBlock, /password_hash/);
  assert.match(byEmailBlock, /publicCustomerProfile/);

  const loginIndex = storefrontRouteSource.indexOf("router.post('/customer/login'");
  const loginBlock = storefrontRouteSource.slice(loginIndex, loginIndex + 3_500);
  assert.match(loginBlock, /issueCustomerSession/);
  assert.match(loginBlock, /Set-Cookie/);
  assert.doesNotMatch(loginBlock, /success\(\{ customer: data \}\)/);
});

test('customer password reset is token-bound and stores only hashed reset intents', () => {
  assert.match(customerResetMigrationSource, /reset_token_hash text/);
  assert.match(customerResetMigrationSource, /reset_expires_at timestamp with time zone/);
  assert.match(customerResetMigrationSource, /reset_used_at timestamp with time zone/);
  assert.match(customerResetMigrationSource, /ALTER COLUMN password_hash DROP NOT NULL/);

  assert.match(storefrontRouteSource, /router\.post\('\/customer\/password\/request-reset'/);
  assert.match(storefrontRouteSource, /router\.post\('\/customer\/password\/confirm-reset'/);
  assert.match(storefrontRouteSource, /hashCustomerPasswordResetToken/);
  assert.match(storefrontRouteSource, /reset_token_hash: tokenHash/);
  assert.match(storefrontRouteSource, /reset_used_at: now/);
  assert.doesNotMatch(storefrontRouteSource, /reset_token:\s*token/);

  assert.match(storefrontSetPasswordRouteSource, /resetToken/);
  assert.match(storefrontSetPasswordRouteSource, /action === 'request_reset'/);
  assert.match(storefrontSetPasswordRouteSource, /requestCustomerPasswordReset/);
  assert.match(storefrontSetPasswordRouteSource, /confirmCustomerPasswordReset/);
  assert.doesNotMatch(storefrontSetPasswordRouteSource, /setCustomerPassword/);
  assert.doesNotMatch(storefrontSetPasswordRouteSource, /getCustomerByEmail/);
});

test('storefront-runtime signs server-only legacy customer lookups', () => {
  assert.match(storefrontApiClientSource, /X-LetBuyy-Internal-App/);
  assert.match(storefrontApiClientSource, /app = 'storefront'/);
  assert.match(storefrontApiClientSource, /hmacSha256Hex/);
  assert.match(storefrontApiClientSource, /\/storefront\/customer\/by-email/);
  assert.match(storefrontApiClientSource, /\/storefront\/customer\/status/);
});

test('Storefront GraphQL customer and order fields require customer sessions', () => {
  assert.match(storefrontGraphQLSource, /CUSTOMER_SESSION_REQUIRED/);
  assert.match(storefrontGraphQLSource, /requireCustomerGraphQLSession\(c, 'customer'\)/);
  assert.match(storefrontGraphQLSource, /requireCustomerGraphQLSession\(c, 'order'\)/);
  assert.doesNotMatch(storefrontGraphQLSource, /\/storefront\/customer\/by-email/);
});
