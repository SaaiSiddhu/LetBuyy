import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

test('api-gateway owns custom-domain and store-access endpoints', () => {
  const index = read('services/api-gateway/src/index.ts');
  const customDomains = read('services/api-gateway/src/routes/custom-domains.ts');
  const internalStoreAccess = read('services/api-gateway/src/routes/internal-store-access.ts');

  assert.match(index, /api\.route\('\/custom', customDomainsRouter\)/);
  assert.match(index, /api\.route\('\/store-access', storeAccessRouter\)/);
  assert.match(index, /api\.route\('\/internal\/store-access', internalStoreAccessRouter\)/);
  assert.match(customDomains, /customDomainsRouter\.post\('\/domains'/);
  assert.match(customDomains, /customDomainsRouter\.post\('\/domains\/verify'/);
  assert.match(customDomains, /customDomainsRouter\.delete\('\/domains\/:domain'/);
  assert.match(customDomains, /storeAccessRouter\.put\('\/'/);
  assert.match(customDomains, /storeAccessRouter\.post\('\/preview-links'/);
  assert.match(internalStoreAccess, /router\.post\('\/verify'/);
  assert.match(internalStoreAccess, /router\.get\('\/resolve'/);
});

test('custom-domain verification requires ownership TXT before active CNAME', () => {
  const source = read('services/api-gateway/src/routes/custom-domains.ts');

  assert.match(source, /getCustomDomainCnameTarget/);
  assert.doesNotMatch(source, /cname\.vercel-dns\.com/);
  assert.match(source, /_letbuyy-challenge/);
  assert.match(source, /txtMatches\.length < 2/);
  assert.match(source, /TXT_NOT_VERIFIED/);
  assert.match(source, /custom_domain_status:\s*'verifying'/);
  assert.match(source, /custom_domain_status:\s*'pending'/);
  assert.match(source, /attachVercelProjectDomain/);
  assert.match(source, /DOMAIN_TAKEN/);
  assert.match(source, /PUBLIC_SUFFIX_LIKE_DOMAINS/);
  assert.match(source, /LetBuyy-owned zones cannot be claimed/);
});

test('store password and preview links use shared cryptographic helpers', () => {
  const password = read('services/api-gateway/src/lib/store-access-password.ts');
  const customDomains = read('services/api-gateway/src/routes/custom-domains.ts');
  const authCore = read('packages/auth-core/src/storefront-access.ts');

  assert.match(password, /argon2id/);
  assert.match(password, /argon2Verify/);
  assert.match(customDomains, /PREVIEW_SIGNING_KEY/);
  assert.match(customDomains, /createStorefrontPreviewToken/);
  assert.match(authCore, /verifyStorefrontPreviewToken/);
  assert.match(authCore, /verifyStorefrontGateToken/);
});

test('custom-domain tables remain api-gateway single-writer owned', () => {
  const validator = read('scripts/validators/single-writer-ownership-validator.mjs');

  assert.match(validator, /site_preview_links/);
  assert.match(validator, /site_gate_attempts/);
  // F-RENAMESTALE-1. This read /apps\/customer-web\/src/ and had been failing since Phase M renamed
  // that root to apps/customer_web. The rename was correct; the assertion was not updated. Note which
  // direction that brittleness runs: this test broke because the validator was FIXED, and it would
  // have passed happily if the validator had been left policing a directory that no longer exists.
  // So the path is asserted AND checked to exist, which makes the next rename fail for the right
  // reason instead of the wrong one.
  const customerStorefrontRoot = 'apps/customer_web/src';
  assert.match(validator, new RegExp(customerStorefrontRoot.replace(/\//g, '\\/')));
  assert.equal(
    existsSync(join(repoRoot, customerStorefrontRoot)),
    true,
    `the single-writer validator must police a path that exists; ${customerStorefrontRoot} is missing`,
  );
  assert.match(validator, /services\/api-gateway/);
});

test('custom-domain health exposes DNS, SSL, and renewal state to mobile', () => {
  const sharedTypes = read('packages/shared-types/src/index.ts');
  const route = read('services/api-gateway/src/routes/custom-domains.ts');
  const stores = read('services/api-gateway/src/routes/stores.ts');
  const mobileService = read('apps/merchant_app/lib/services/custom_domains.dart');
  const mobileScreen = read('apps/merchant_app/lib/screens/settings/domain_settings_screen.dart');

  assert.match(sharedTypes, /CustomDomainHealthSchema/);
  assert.match(route, /readCustomDomainHealth\(c\.env/);
  assert.match(route, /success\(\{ \.\.\.health, (?:provider, )?vercel: health\.vercel, health \}\)/);
  assert.match(stores, /readCustomDomainHealth\(c\.env/);
  assert.match(stores, /dns_verified/);
  assert.match(stores, /renewal_status/);
  assert.match(mobileService, /class DomainHealthSnapshot/);
  assert.match(mobileService, /customDomains\.health/);
  assert.match(mobileScreen, /Domain health/);
  assert.match(mobileScreen, /Renewal/);
});
