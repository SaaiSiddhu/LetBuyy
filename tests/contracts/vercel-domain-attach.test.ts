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

test('Vercel Domains API client fail-loud env and idempotent attach contract', () => {
  const client = read('services/api-gateway/src/lib/vercel-domains.ts');
  assert.match(client, /VERCEL_API_TOKEN_REQUIRED/);
  assert.match(client, /VERCEL_STOREFRONT_PROJECT_ID_REQUIRED/);
  assert.match(client, /\/v10\/projects\/\{projectId\}\/domains/);
  assert.match(client, /getVercelProjectDomain/);
  assert.match(client, /already\|exists\|domain/i);
  assert.match(client, /Retry-After/);
  assert.doesNotMatch(client, /vercel_[A-Za-z0-9]{12,}/);
});

test('custom-domain verify attaches and then reads Vercel status', () => {
  const route = read('services/api-gateway/src/routes/custom-domains.ts');
  assert.match(route, /attachVercelProjectDomain\(c\.env, domain\)/);
  assert.match(route, /readVercelDomainStatus\(c\.env, domain\)/);
  assert.match(route, /custom_domain_status: status/);
  assert.match(route, /domains\/:domain\/status/);
});
