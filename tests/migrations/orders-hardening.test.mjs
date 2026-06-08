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

function numericPrecision(sql, table, column) {
  const tableStart = sql.indexOf(`CREATE TABLE public.${table} (`);
  assert.ok(tableStart > -1, `public.${table} table must exist`);
  const nextTable = sql.indexOf('\nCREATE TABLE ', tableStart + 1);
  const createTable = sql.slice(tableStart, nextTable > -1 ? nextTable : undefined);
  const match = new RegExp(`\\b${column}\\s+numeric\\((\\d+),(\\d+)\\)`, 'i').exec(createTable);
  assert.ok(match, `${table}.${column} numeric precision must be parseable`);
  return { precision: Number(match[1]), scale: Number(match[2]) };
}

test('orders tenant migration backfills before enforcing canonical store_id', () => {
  const migration = read('database/supabase/migrations/108_orders_tenant_key_not_null.sql');

  const backfillIndex = migration.indexOf('SET store_id = COALESCE(store_id, site_id)');
  const notNullIndex = migration.indexOf('ALTER TABLE public.orders ALTER COLUMN store_id SET NOT NULL');

  assert.ok(backfillIndex > -1, 'orders.store_id backfill must exist');
  assert.ok(notNullIndex > -1, 'orders.store_id NOT NULL guard must exist');
  assert.ok(backfillIndex < notNullIndex, 'backfill must run before NOT NULL enforcement');
  assert.match(migration, /NOT EXISTS \(SELECT 1 FROM public\.orders WHERE store_id IS NULL\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.sync_orders_tenant_keys\(\)/);
  assert.match(migration, /NEW\.site_id <> NEW\.store_id/);
  assert.doesNotMatch(migration, /\bDROP\s+COLUMN\b/i);
});

test('orders money migration widens storefront order totals to cart precision', () => {
  const baseline = read('database/supabase/migrations/000_baseline.sql');
  const migration = read('database/supabase/migrations/109_orders_money_width.sql');
  const cartGrandTotal = numericPrecision(baseline, 'checkout_sessions', 'grand_total');

  for (const column of ['subtotal', 'shipping_cost', 'tax', 'discount', 'total', 'coupon_discount']) {
    assert.match(
      migration,
      new RegExp(`ALTER COLUMN ${column} TYPE numeric\\(${cartGrandTotal.precision},${cartGrandTotal.scale}\\)`, 'i'),
      `orders.${column} must widen to numeric(${cartGrandTotal.precision},${cartGrandTotal.scale})`,
    );
  }
});

test('fk hygiene adds order_items tenant scope and preserves order history via child cascades only', () => {
  const migration = read('database/supabase/migrations/110_fk_hygiene_and_order_indexes.sql');

  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_orders_site_id ON public\.orders\(site_id\)/);
  assert.match(migration, /ALTER TABLE public\.order_items ADD COLUMN store_id uuid/);
  assert.match(migration, /UPDATE public\.order_items oi[\s\S]*FROM public\.orders o[\s\S]*oi\.order_id = o\.id/);
  assert.match(migration, /CREATE TRIGGER order_items_store_scope_sync/);
  assert.match(migration, /FOREIGN KEY \(order_id\) REFERENCES public\.orders\(id\) ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
});

test('orders tenant nullability migration requires both tenant keys', () => {
  const migration = read('database/supabase/migrations/130_orders_site_id_not_null.sql');

  const backfillIndex = migration.indexOf('SET store_id = COALESCE(store_id, site_id)');
  const guardIndex = migration.indexOf('orders tenant keys must be backfilled before NOT NULL enforcement');
  const storeNotNullIndex = migration.indexOf('ALTER TABLE public.orders ALTER COLUMN store_id SET NOT NULL');
  const siteNotNullIndex = migration.indexOf('ALTER TABLE public.orders ALTER COLUMN site_id SET NOT NULL');

  assert.ok(backfillIndex > -1, 'orders tenant key backfill must exist');
  assert.ok(guardIndex > -1, 'orders null enforcement guard must exist');
  assert.ok(storeNotNullIndex > -1, 'orders.store_id NOT NULL enforcement must exist');
  assert.ok(siteNotNullIndex > -1, 'orders.site_id NOT NULL enforcement must exist');
  assert.ok(backfillIndex < guardIndex, 'backfill must run before null enforcement guard');
  assert.ok(guardIndex < storeNotNullIndex, 'null guard must run before store_id NOT NULL');
  assert.ok(guardIndex < siteNotNullIndex, 'null guard must run before site_id NOT NULL');
  assert.match(migration, /NEW\.store_id IS NULL OR NEW\.site_id IS NULL/);
  assert.match(migration, /NEW\.site_id <> NEW\.store_id/);
  assert.match(migration, /idx_orders_store_status_created_active/);
  assert.match(migration, /idx_orders_site_status_created_active/);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(migration, /\bDROP\s+COLUMN\b/i);
});

test('customer credential migration backfills credentials before clearing inline hashes', () => {
  const migration = read('database/supabase/migrations/111_customer_credentials_source_of_truth.sql');
  const insertIndex = migration.indexOf('INSERT INTO public.customer_credentials');
  const clearIndex = migration.indexOf('UPDATE public.store_customers');

  assert.ok(insertIndex > -1, 'customer_credentials backfill must exist');
  assert.ok(clearIndex > -1, 'store_customers inline hash clear must exist');
  assert.ok(insertIndex < clearIndex, 'backfill must run before clearing inline hashes');
  assert.match(migration, /ON CONFLICT \(store_id, email_or_phone\)/);
  assert.match(migration, /password_hash = NULL/);
  assert.doesNotMatch(migration, /\bDROP\s+COLUMN\b/i);
});
