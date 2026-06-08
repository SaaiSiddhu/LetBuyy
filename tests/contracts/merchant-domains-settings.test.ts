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

test('merchant domains settings renders custom-domain and access controls', () => {
  const page = read('apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx');

  assert.match(page, /Ownership/);
  assert.match(page, /DNS/);
  assert.match(page, /SSL/);
  assert.match(page, /Live/);
  assert.match(page, /NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET/);
  assert.match(page, /Your domain has email \(MX\) records/);
  assert.match(page, /Buy a domain/);
  assert.match(page, /Store access/);
  assert.match(page, /preview_only/);
  assert.match(page, /Create preview link/);
  assert.match(page, /lb_preview/);
});

test('merchant domain settings calls gateway endpoints directly with merchant credentials', () => {
  const page = read('apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx');

  assert.match(page, /gatewayUrl\('\/custom\/domains'\)/);
  assert.match(page, /gatewayUrl\('\/custom\/domains\/verify'\)/);
  assert.match(page, /gatewayUrl\('\/store-access'\)/);
  assert.match(page, /gatewayUrl\('\/store-access\/preview-links'\)/);
  assert.match(page, /credentials: 'include'/);
  assert.equal(existsSync(join(repoRoot, 'apps/merchant-control-plane/src/app/api/stores/[store]/custom-domain/route.ts')), false);
  assert.equal(existsSync(join(repoRoot, 'apps/merchant-control-plane/src/app/api/stores/[store]/store-access/route.ts')), false);
});

test('merchant domain settings do not access Supabase directly', () => {
  const source = read('apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx');
  assert.doesNotMatch(source, /createSupabase|SUPABASE_SERVICE_ROLE|\.from\(/);
});
