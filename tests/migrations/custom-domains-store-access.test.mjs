import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath) {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

test('custom domain and store access migration is additive and idempotent', () => {
  const migration = read('database/supabase/migrations/090_custom_domains_and_store_access.sql');

  assert.match(migration, /ALTER TABLE public\.sites[\s\S]*ADD COLUMN IF NOT EXISTS custom_domain_status text DEFAULT 'none'/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'public'/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS access_password_hash text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS sites_custom_domain_unique/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.site_preview_links/);
  assert.match(migration, /CONSTRAINT site_preview_links_jti_key UNIQUE \(jti\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.site_gate_attempts/);
  assert.match(migration, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(migration, /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+public\.stores\b/i);
});

test('baseline carries the replay shape for custom domains and store access', () => {
  const baseline = read('database/supabase/migrations/000_baseline.sql');

  for (const fragment of [
    'custom_domain_status text DEFAULT',
    'custom_domain_verification_token text',
    "access_mode text DEFAULT 'public'::text NOT NULL",
    'access_password_hash text',
    'access_message text',
    'published boolean DEFAULT false NOT NULL',
    'CREATE TABLE public.site_preview_links',
    'CREATE TABLE public.site_gate_attempts',
    'sites_custom_domain_unique',
    'site_preview_links_service_all',
    'site_gate_attempts_service_all',
  ]) {
    assert.match(baseline, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('migration safety validator knows the DS-5 schema contract', () => {
  const validator = read('scripts/validators/migration-safety-validator.mjs');
  assert.match(validator, /090_custom_domains_and_store_access\.sql/);
  assert.match(validator, /site_preview_links/);
  assert.match(validator, /site_gate_attempts/);
});
