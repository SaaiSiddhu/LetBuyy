import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { screenCustomDomainClaim } from '../../services/api-gateway/src/lib/custom-domain-abuse';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

test('abuse screening routes protected-brand lookalikes to review or reject and clean domains allow', async () => {
  const lookalike = await screenCustomDomainClaim({}, 'hdfc-login-support.in');
  assert.equal(lookalike.action, 'reject');

  const clean = await screenCustomDomainClaim({}, 'urban-kicks-example.in');
  assert.equal(clean.action, 'allow');

  const providerMedium = await screenCustomDomainClaim({
    ABUSE_REPUTATION_API_URL: 'https://reputation.example/check',
    ABUSE_REPUTATION_API_KEY: 'test-key',
  }, 'merchant-example.in', async () => new Response(JSON.stringify({ risk: 'medium' }), { status: 200 }));
  assert.equal(providerMedium.action, 'review');
});

test('abuse review queue is persisted through gateway-owned table', () => {
  const route = read('services/api-gateway/src/routes/custom-domains.ts');
  const migration = read('database/supabase/migrations/090_custom_domains_and_store_access.sql');
  assert.match(route, /site_domain_reviews/);
  assert.match(route, /DOMAIN_ABUSE_REJECTED/);
  assert.match(route, /TRUST_REVIEW_REQUIRED/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.site_domain_reviews/);
});
