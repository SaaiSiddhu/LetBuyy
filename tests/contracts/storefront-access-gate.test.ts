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

test('storefront proxy enforces access modes before render', () => {
  const proxy = read('apps/commerce/web/src/proxy.ts');

  assert.match(proxy, /resolveStorefrontHost/);
  assert.match(proxy, /\/v1\/internal\/store-access\/resolve/);
  assert.match(proxy, /access_mode === 'password'/);
  assert.match(proxy, /verifyStorefrontGateToken/);
  assert.match(proxy, /access_mode === 'preview_only'/);
  assert.match(proxy, /verifyStorefrontPreviewToken/);
  assert.match(proxy, /access_mode === 'offline'/);
  assert.match(proxy, /Store not found/);
  assert.match(proxy, /X-Robots-Tag/);
  assert.match(proxy, /x-letbuyy-preview-checkout-mode/);
});

test('storefront gate cookies are host-only and use shared __Host names', () => {
  const proxy = read('apps/commerce/web/src/proxy.ts');
  const authCore = read('packages/auth-core/src/storefront-access.ts');

  assert.match(authCore, /LETBUYY_STOREFRONT_GATE_COOKIE\s*=\s*['"]__Host-/);
  assert.match(authCore, /LETBUYY_STOREFRONT_PREVIEW_COOKIE\s*=\s*['"]__Host-/);
  assert.match(proxy, /\/v1\/internal\/store-access\/verify/);
  assert.match(proxy, /LETBUYY_STOREFRONT_GATE_COOKIE/);
  assert.doesNotMatch(proxy, /\bdomain\s*:/);
  assert.equal(existsSync(join(repoRoot, 'apps/commerce/web/src/app/api/store-access/password/route.ts')), false);
});

test('preview mode cannot create real storefront orders', () => {
  const orderRoute = read('apps/commerce/web/src/app/api/orders/route.ts');

  assert.match(orderRoute, /LETBUYY_STOREFRONT_PREVIEW_COOKIE/);
  assert.match(orderRoute, /x-letbuyy-preview-checkout-mode/);
  assert.match(orderRoute, /cannot create real orders/);
});

test('storefront access gate validator is wired into governance', () => {
  const validator = read('scripts/validators/storefront-access-gate-validator.mjs');
  const governanceRunner = read('scripts/validate-governance.mjs');

  assert.match(validator, /Storefront access gate validator/);
  assert.match(governanceRunner, /storefront-access-gate-validator\.mjs/);
});
