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
  const page = read('apps/merchant/web/src/app/[store]/settings/domains/page.tsx');

  assert.match(page, /Your domains|Ownership/);
  assert.match(page, /Connect existing domain|DNS/);
  assert.match(page, /Buy a new domain|Buy a domain/);
});

test('merchant domain settings calls gateway endpoints directly with merchant credentials', () => {
  const page = read('apps/merchant/web/src/app/[store]/settings/domains/page.tsx');

  assert.match(page, /domainsClient|gatewayUrl\('\/custom\/domains'\)/);
  assert.equal(existsSync(join(repoRoot, 'apps/merchant/web/src/app/api/stores/[store]/custom-domain/route.ts')), false);
  assert.equal(existsSync(join(repoRoot, 'apps/merchant/web/src/app/api/stores/[store]/store-access/route.ts')), false);
});

test('merchant domain settings do not access Supabase directly', () => {
  const source = read('apps/merchant/web/src/app/[store]/settings/domains/page.tsx');
  assert.doesNotMatch(source, /createSupabase|SUPABASE_SERVICE_ROLE|\.from\(/);
});
