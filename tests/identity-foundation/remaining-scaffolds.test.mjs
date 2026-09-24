import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('audit dual-write shim keeps legacy writes authoritative and canonical writes flag-gated', () => {
  const source = read('services/api-gateway/src/identity-foundation/audit-dual-write.ts');
  assert.match(source, /writeLegacy: true/);
  assert.match(source, /writeCanonical: featureEnabled/);
  assert.match(source, /reconcileLegacyAuditActorType/);
  assert.match(source, /redactAuditMetadata/);
  assert.match(source, /computeAuditHashChain/);
  assert.match(source, /sandbox-kms/);
});

test('key service scaffolding is sandbox ES256 only and records live KMS as human-required', () => {
  const source = read('services/api-gateway/src/identity-foundation/mock-key-service.ts');
  assert.match(source, /ES256/);
  assert.match(source, /sandbox-kms/);
  assert.match(source, /HR-KMS-LIVE/);
  assert.match(source, /AUTH_SECRET/);
  assert.match(source, /CUSTOMER_SESSION_SECRET/);
  assert.match(source, /INTERNAL_API_SECRET/);
});

test('session, CSRF, token, and MFA quick-win paths remain flag-gated or shadow-only', () => {
  const session = read('services/api-gateway/src/identity-foundation/session-services.ts');
  const csrf = read('services/api-gateway/src/identity-foundation/csrf-scaffold.ts');
  const token = read('services/api-gateway/src/identity-foundation/token-shadow.ts');
  const mfa = read('services/api-gateway/src/identity-foundation/admin-mfa-scaffold.ts');

  assert.match(session, /createDormantSessionService/);
  assert.match(session, /createDormantCookiePolicyService/);
  assert.match(session, /returnedLegacy: input\.legacyAccepted/);
  assert.match(csrf, /LEGACY_CSRF_COOKIE_NAMES/);
  assert.match(csrf, /__Host-letbuyy_csrf/);
  assert.match(token, /writeLegacyPlaintext: true/);
  assert.match(token, /writeShadowHash: featureEnabled/);
  assert.match(mfa, /preserveSharedSecretPath: true/);
  assert.match(mfa, /PLATFORM_CONSOLE_TOTP_SECRET/);
});

test('migration scaffolding writes only new identity foundation tables and dry-runs credential layering', () => {
  const source = read('services/api-gateway/src/identity-foundation/migration-scaffold.ts');
  assert.match(source, /createEmptyIdentityReconciliationReport/);
  assert.match(source, /planPrincipalBackfill/);
  assert.match(source, /planCustomerPrincipalBackfill/);
  assert.match(source, /planCredentialBackfill/);
  assert.match(source, /planAuthenticatorBackfill/);
  assert.match(source, /planOrgGraphBackfill/);
  assert.match(source, /credentialLayerHashDryRun/);
  assert.match(source, /writesLegacyTables: false/);
  assert.match(source, /legacyUntouched: true/);
});

test('OIDC skeleton exposes disabled routes plus callback and consent placeholders', () => {
  for (const route of [
    'apps/platform/identity/src/app/.well-known/openid-configuration/route.ts',
    'apps/platform/identity/src/app/.well-known/jwks.json/route.ts',
    'apps/platform/identity/src/app/jwks/route.ts',
    'apps/platform/identity/src/app/oauth2/authorize/route.ts',
    'apps/platform/identity/src/app/oauth2/token/route.ts',
    'apps/platform/identity/src/app/oauth2/userinfo/route.ts',
    'apps/platform/identity/src/app/oauth2/logout/route.ts',
    'apps/platform/identity/src/app/oauth2/callback/route.ts',
    'apps/platform/identity/src/app/oauth2/consent/route.ts',
  ]) {
    assert.match(read(route), /oidcSkeletonResponse/);
  }
});

test('gateway verifier registry preserves legacy branch order and keeps OIDC dormant by default', () => {
  const source = read('services/api-gateway/src/identity-foundation/auth-verifier-registry.ts');
  const legacyOrder = [
    'internal-session-hmac',
    'internal-identity-hmac',
    'supabase-bearer',
    'oidc-jwks',
  ];
  let cursor = 0;
  for (const verifier of legacyOrder) {
    const index = source.indexOf(`name: '${verifier}'`);
    assert.ok(index > cursor, `${verifier} must appear after the previous verifier`);
    cursor = index;
  }
  assert.match(source, /activeByDefault: false/);
  assert.match(source, /FEATURE_OIDC_CLIENT/);
});
