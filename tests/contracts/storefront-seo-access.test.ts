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

test('storefront SEO uses access state as the indexability source', () => {
  const seo = read('apps/commerce/web/src/lib/seo.ts');
  const robots = read('apps/commerce/web/src/app/robots.ts');
  const sitemap = read('apps/commerce/web/src/app/sitemap.ts');
  const layout = read('apps/commerce/web/src/app/store/[subdomain]/layout.tsx');

  assert.match(seo, /function isStorefrontIndexable/);
  assert.match(seo, /accessMode \|\| 'public'/);
  assert.match(seo, /published !== false/);
  assert.match(robots, /resolveStorefrontAccessContext/);
  assert.match(robots, /isStorefrontIndexable/);
  assert.match(robots, /'\/preview\/'/);
  assert.match(sitemap, /resolveStorefrontAccessContext/);
  assert.match(sitemap, /isStorefrontIndexable/);
  assert.match(layout, /robots: \{ index: false, follow: false \}/);
});

test('active custom domains become canonical and .store subdomains redirect', () => {
  const seo = read('apps/commerce/web/src/lib/seo.ts');
  const proxy = read('apps/commerce/web/src/proxy.ts');

  assert.match(seo, /customDomainStatus === 'active'/);
  assert.match(proxy, /parsed\.kind === 'subdomain'/);
  assert.match(proxy, /site\.custom_domain_status === 'active'/);
  assert.match(proxy, /NextResponse\.redirect\(redirectUrl,\s*301\)/);
});

test('storefront SEO validator is wired into governance', () => {
  const validator = read('scripts/validators/storefront-seo-access-validator.mjs');
  const governanceRunner = read('scripts/validate-governance.mjs');

  assert.match(validator, /Storefront SEO access validator/);
  assert.match(governanceRunner, /storefront-seo-access-validator\.mjs/);
});
