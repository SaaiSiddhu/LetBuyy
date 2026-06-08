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

const migrationPath = 'database/supabase/migrations/158_order_items_tenant_scope.sql';
const rollbackPath = 'database/supabase/rollback/158_order_items_tenant_scope.rollback.sql';

test('order_items tenant scope migration adds direct site ownership safely', () => {
  const migration = read(migrationPath);

  assert.match(migration, /ALTER TABLE public\.order_items\s+ADD COLUMN IF NOT EXISTS site_id uuid/);
  assert.match(migration, /UPDATE public\.order_items oi[\s\S]*FROM public\.orders o[\s\S]*oi\.order_id = o\.id/);
  assert.match(migration, /order_items\.site_id must be backfilled before NOT NULL enforcement/);
  assert.match(migration, /ALTER TABLE public\.order_items ALTER COLUMN site_id SET NOT NULL/);
  assert.match(migration, /ADD CONSTRAINT order_items_site_id_fkey[\s\S]*FOREIGN KEY \(site_id\) REFERENCES public\.sites\(id\)/);
  assert.match(migration, /ALTER TABLE public\.order_items VALIDATE CONSTRAINT order_items_site_id_fkey/);
  assert.doesNotMatch(migration, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
});

test('order_items tenant scope trigger rejects mismatched order tenants', () => {
  const migration = read(migrationPath);

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.sync_order_items_site_id\(\)/);
  assert.match(migration, /SELECT COALESCE\(o\.site_id, o\.store_id\), COALESCE\(o\.store_id, o\.site_id\)/);
  assert.match(migration, /NEW\.site_id := COALESCE\(NEW\.site_id, v_site_id\)/);
  assert.match(migration, /NEW\.site_id <> v_site_id/);
  assert.match(migration, /NEW\.store_id IS NOT NULL AND NEW\.store_id <> v_store_id/);
  assert.match(migration, /DROP TRIGGER IF EXISTS order_items_site_scope_sync ON public\.order_items/);
  assert.match(migration, /CREATE TRIGGER order_items_site_scope_sync/);
});

test('order_items tenant scope migration adds direct indexes and RLS policies', () => {
  const migration = read(migrationPath);

  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_order_items_site_id\s+ON public\.order_items\(site_id\)/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_order_items_site_order_active/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_order_items_site_product_active/);
  assert.match(migration, /ALTER TABLE public\.order_items ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /DROP POLICY IF EXISTS order_items_service_role_all ON public\.order_items/);
  assert.match(migration, /CREATE POLICY order_items_service_role_all/);
  assert.match(migration, /DROP POLICY IF EXISTS order_items_tenant_site_guc ON public\.order_items/);
  assert.match(migration, /CREATE POLICY order_items_tenant_site_guc[\s\S]*site_id = public\.current_site_id\(\)/);
  assert.match(migration, /DROP POLICY IF EXISTS order_items_owner_site_select ON public\.order_items/);
  assert.match(migration, /CREATE POLICY order_items_owner_site_select[\s\S]*s\.id = order_items\.site_id/);
});

test('order_items tenant scope rollback removes only the additive scope objects', () => {
  const rollback = read(rollbackPath);

  assert.match(rollback, /DROP POLICY IF EXISTS order_items_owner_site_select ON public\.order_items/);
  assert.match(rollback, /DROP POLICY IF EXISTS order_items_tenant_site_guc ON public\.order_items/);
  assert.match(rollback, /DROP POLICY IF EXISTS order_items_service_role_all ON public\.order_items/);
  assert.match(rollback, /DROP TRIGGER IF EXISTS order_items_site_scope_sync ON public\.order_items/);
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.sync_order_items_site_id\(\)/);
  assert.match(rollback, /DROP INDEX IF EXISTS public\.idx_order_items_site_product_active/);
  assert.match(rollback, /DROP CONSTRAINT IF EXISTS order_items_site_id_fkey/);
  assert.match(rollback, /DROP COLUMN IF EXISTS site_id/);
  assert.doesNotMatch(rollback, /\bDROP\s+TABLE\b/i);
});
