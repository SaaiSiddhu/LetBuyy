import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('identity foundation flags default off and use strict true checks', () => {
  const authFlags = read('packages/auth-core/src/feature-flags.ts');
  const identityFeatures = read('apps/platform/identity/src/lib/config/features.ts');

  for (const flag of [
    'FEATURE_IDENTITY_PROVIDER',
    'FEATURE_OIDC_CLIENT',
    'FEATURE_NEW_SESSION_ENGINE',
    'FEATURE_NEW_PERMISSION_ENGINE',
    'FEATURE_NEW_AUDIT_ENGINE',
    'FEATURE_AUDIT_DUAL_WRITE',
    'FEATURE_NEW_KEY_SERVICE',
    'FEATURE_ORG_MODEL',
    'FEATURE_NEW_MFA_ENGINE',
    'FEATURE_SHADOW_AUTH',
    'FEATURE_SHADOW_PERMISSION',
    'FEATURE_SHADOW_SESSION',
    'FEATURE_TOKEN_HASH_SHADOW',
    'FEATURE_NEW_CSRF',
    'FEATURE_PERUSER_ADMIN_TOTP',
  ]) {
    assert.match(authFlags, new RegExp(`'${flag}'`));
  }

  assert.match(authFlags, /env\[flag\] === 'true'/);
  assert.match(authFlags, /map\(\(flag\) => \[flag, false\]\)/);
  assert.match(identityFeatures, /resolveIdentityFoundationFeatureFlags\(process\.env\)/);
});

test('legacy cookie names and attributes remain the current golden surface', () => {
  const authCore = read('packages/auth-core/src/index.ts');
  const identityCookies = read('apps/platform/identity/src/lib/auth/cookies.ts');

  assert.match(authCore, /LETBUYY_MERCHANT_SESSION_COOKIE = 'lb_session'/);
  assert.match(authCore, /LETBUYY_CUSTOMER_SESSION_COOKIE = 'lb_customer_session'/);
  assert.match(authCore, /LETBUYY_PLATFORM_SESSION_COOKIE = 'lb_console_session'/);
  assert.match(identityCookies, /const COOKIE_NAMES = resolveLetbuyyPlatformCookieNames/);
  assert.match(authCore, /csrf: `letbuyy_csrf\$\{suffix\}`/);
  assert.match(authCore, /accounts: `lb_accounts\$\{suffix\}`/);
  assert.match(authCore, /device: `lb_device\$\{suffix\}`/);
  assert.match(authCore, /passwordSetIntent: `lb_password_set_intent\$\{suffix\}`/);
  assert.match(identityCookies, /sameSite: 'lax'/);
  assert.match(identityCookies, /sameSite: 'strict'/);
  assert.match(identityCookies, /httpOnly: false, \/\/ Must be readable client-side for CSRF headers/);
});

// Phase N3 (W3, commit 92769175) removed the Supabase Auth token-acceptance path: no verifier accepts a
// raw `Authorization: Bearer` token any more, and identity-platform is the sole issuer (ART-05). This test
// used to pin the three-branch order internal-session -> internal-identity -> supabase-bearer. What it
// protects is unchanged in spirit -- the remaining branches keep their order, nothing else can be added
// ahead of them unnoticed, and the retired branches stay retired -- so it now says exactly that. The
// behaviour (a Bearer-only request is a 401, and the registered names are exactly the two internal ones)
// is proved against a real Hono app in services/api-gateway/src/__tests__/auth-middleware-fail-closed.test.ts.
test('gateway auth middleware keeps the legacy branch order snapshot', () => {
  const source = read('services/api-gateway/src/middleware/auth.ts');
  const registry = source.slice(
    source.indexOf('legacyGatewayAuthVerifiers'),
    source.indexOf('legacyGatewayAuthVerifierNames'),
  );
  const internalSession = registry.indexOf("name: 'internal-session-hmac'");
  const internalIdentity = registry.indexOf("name: 'internal-identity-hmac'");

  assert.equal(registry.includes("name: 'admin-web-token'"), false);
  assert.equal(source.includes('admin-web@letbuyy.local'), false);
  assert.ok(internalSession > -1);
  assert.ok(internalIdentity > internalSession);
  assert.equal(registry.includes("name: 'supabase-bearer'"), false, 'the Supabase token-acceptance verifier stays removed');
  assert.doesNotMatch(source, /function readSupabaseBearerToken/, 'no Supabase bearer reader');
  assert.doesNotMatch(source, /startsWith\('Bearer '\)/, 'no verifier is attempted on a raw Bearer header');
  assert.match(source, /shouldAttempt:\s*\(c\)\s*=>\s*Boolean\(c\.req\.header\('X-LetBuyy-Internal-Session-Token'\)\)/);
  assert.match(source, /Missing or invalid authorization header/);
});
