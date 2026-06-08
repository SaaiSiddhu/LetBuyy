import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('identity foundation flags default off and use strict true checks', () => {
  const authFlags = read('packages/auth-core/src/feature-flags.ts');
  const identityFeatures = read('apps/identity-platform/src/lib/config/features.ts');

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
  const identityCookies = read('apps/identity-platform/src/lib/auth/cookies.ts');

  assert.match(authCore, /LETBUYY_MERCHANT_SESSION_COOKIE = 'lb_session'/);
  assert.match(authCore, /LETBUYY_CUSTOMER_SESSION_COOKIE = 'lb_customer_session'/);
  assert.match(authCore, /LETBUYY_PLATFORM_SESSION_COOKIE = 'lb_console_session'/);
  assert.match(identityCookies, /csrf: 'letbuyy_csrf'/);
  assert.match(identityCookies, /accounts: 'lb_accounts'/);
  assert.match(identityCookies, /device: 'lb_device'/);
  assert.match(identityCookies, /passwordSetIntent: PASSWORD_SET_INTENT_COOKIE/);
  assert.match(identityCookies, /sameSite: 'lax'/);
  assert.match(identityCookies, /sameSite: 'strict'/);
  assert.match(identityCookies, /httpOnly: false, \/\/ Must be readable client-side for CSRF headers/);
});

test('gateway auth middleware keeps the legacy branch order snapshot', () => {
  const source = read('services/api-gateway/src/middleware/auth.ts');
  const registry = source.slice(
    source.indexOf('legacyGatewayAuthVerifiers'),
    source.indexOf('legacyGatewayAuthVerifierNames'),
  );
  const platform = registry.indexOf("name: 'platform-console-token'");
  const internalSession = registry.indexOf("name: 'internal-session-hmac'");
  const internalIdentity = registry.indexOf("name: 'internal-identity-hmac'");
  const supabase = registry.indexOf("name: 'supabase-bearer'");

  assert.ok(platform > -1);
  assert.ok(internalSession > platform);
  assert.ok(internalIdentity > internalSession);
  assert.ok(supabase > internalIdentity);
  assert.match(source, /shouldAttempt: \(_c, authHeader\) => !authHeader\?\.startsWith\('Bearer '\)/);
  assert.match(source, /shouldAttempt: \(_c, authHeader\) => Boolean\(authHeader\?\.startsWith\('Bearer '\)\)/);
  assert.match(source, /function readSupabaseBearerToken/);
  assert.match(source, /Missing or invalid authorization header/);
  assert.match(source, /Invalid or expired token/);
});
