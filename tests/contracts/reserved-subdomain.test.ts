import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  RESERVED_STOREFRONT_LABELS,
  extractStorefrontSubdomain,
  isReservedStorefrontLabel,
  resolveStorefrontHost,
  validateSubdomainFormat,
} from '../../packages/tenant-core/src/index';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

test('storefront reserved labels match the domain split governance list', () => {
  assert.deepEqual([...RESERVED_STOREFRONT_LABELS], [
    'www',
    'api',
    'admin',
    'accounts',
    'apps',
    'themes',
    'developer',
    'console',
    'team',
    'webhooks',
    'assets',
    'cdn',
    'static',
    'mail',
    'dcv',
    'connect',
  ]);

  for (const label of RESERVED_STOREFRONT_LABELS) {
    assert.equal(isReservedStorefrontLabel(label), true);
    assert.equal(validateSubdomainFormat(label).valid, false);
    assert.equal(extractStorefrontSubdomain(`${label}.letbuyy.com`, 'letbuyy.com'), null);
    assert.equal(resolveStorefrontHost(`${label}.letbuyy.com`, 'letbuyy.com').kind, 'reserved');
  }
});

test('storefront host parser is env-root driven and distinguishes custom domains', () => {
  assert.deepEqual(resolveStorefrontHost('demo.letbuyy.com', 'letbuyy.com'), {
    kind: 'subdomain',
    subdomain: 'demo',
    host: 'demo.letbuyy.com',
    rootDomain: 'letbuyy.com',
  });
  assert.equal(extractStorefrontSubdomain('demo.preview-root.test', 'preview-root.test'), 'demo');
  assert.deepEqual(resolveStorefrontHost('shop.example.in', 'letbuyy.com'), {
    kind: 'custom_domain',
    domain: 'shop.example.in',
    host: 'shop.example.in',
    rootDomain: 'letbuyy.com',
  });
  assert.equal(resolveStorefrontHost('letbuyy.com', 'letbuyy.com').kind, 'root');
});

test('gateway and storefront use tenant-core as the reserved-label source', () => {
  const gatewaySchema = read('services/api-gateway/src/schemas/store.schema.ts');
  const gatewayAuth = read('services/api-gateway/src/routes/auth.ts');
  const storefrontSeo = read('apps/customer_web/src/lib/seo.ts');

  assert.match(gatewaySchema, /RESERVED_STOREFRONT_LABELS/);
  assert.match(gatewayAuth, /validateSubdomainFormat/);
  assert.match(storefrontSeo, /resolveStorefrontHost/);
  assert.doesNotMatch(storefrontSeo, /new Set\(\[/);
});

test('reserved-subdomain single-source validator is wired into governance', () => {
  const validator = read('scripts/validators/reserved-subdomain-single-source-validator.mjs');
  const governanceRunner = read('scripts/validate-governance.mjs');

  assert.match(validator, /Reserved subdomain single-source validator/);
  assert.match(governanceRunner, /reserved-subdomain-single-source-validator\.mjs/);
});
