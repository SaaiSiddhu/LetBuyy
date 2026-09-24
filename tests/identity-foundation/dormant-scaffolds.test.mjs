import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('identity repository boundary maps to legacy tables without introducing stores table authority', () => {
  const source = read('services/api-gateway/src/identity-foundation/repository-boundary.ts');
  const mapping = source.slice(
    source.indexOf('LEGACY_REPOSITORY_TABLES'),
    source.indexOf('IDENTITY_FOUNDATION_WRITER_OWNERS'),
  );
  assert.match(source, /users_custom/);
  assert.match(source, /store_customers/);
  assert.match(source, /merchant_2fa_factors/);
  assert.match(source, /site_memberships/);
  assert.match(source, /app_installations/);
  assert.match(source, /site_api_clients/);
  assert.doesNotMatch(mapping, /['"]stores['"]/);
  assert.match(source, /identityFoundationUsesStoresTable/);
});

test('OIDC provider skeleton routes stay disabled by the central feature flag', () => {
  const helper = read('apps/platform/identity/src/lib/identity-foundation/oidc-disabled.ts');
  assert.match(helper, /FEATURE_IDENTITY_PROVIDER/);
  assert.match(helper, /IDENTITY_PROVIDER_DISABLED/);
  assert.match(helper, /status: 404/);
  assert.match(helper, /status: 501/);

  for (const route of [
    'apps/platform/identity/src/app/.well-known/openid-configuration/route.ts',
    'apps/platform/identity/src/app/jwks/route.ts',
    'apps/platform/identity/src/app/oauth2/authorize/route.ts',
    'apps/platform/identity/src/app/oauth2/token/route.ts',
    'apps/platform/identity/src/app/oauth2/userinfo/route.ts',
    'apps/platform/identity/src/app/oauth2/logout/route.ts',
  ]) {
    assert.match(read(route), /oidcSkeletonResponse/);
  }
});

test('API gateway declares dormant identity foundation dependencies explicitly', () => {
  const manifest = JSON.parse(read('services/api-gateway/package.json'));
  for (const dependency of [
    '@letbuyy/audit-core',
    '@letbuyy/identity-core',
    '@letbuyy/token-core',
    '@letbuyy/session-core',
    '@letbuyy/permission-core',
    '@letbuyy/organization-core',
  ]) {
    assert.equal(manifest.dependencies[dependency], 'workspace:*');
  }
});
