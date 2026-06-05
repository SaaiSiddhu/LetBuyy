import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(
  new URL('../../database/supabase/migrations/084_trigram_search_indexes.sql', import.meta.url),
  'utf8',
);

const expectedIndexes = [
  ['products', 'name'],
  ['orders', 'order_number'],
  ['orders', 'customer_email'],
  ['orders', 'customer_name'],
  ['marketplace_apps', 'name'],
  ['marketplace_apps', 'tagline'],
  ['themes', 'name'],
  ['themes', 'description'],
  ['sites', 'name'],
  ['sites', 'store_name'],
  ['sites', 'subdomain'],
  ['sites', 'custom_domain'],
  ['users_custom', 'email'],
  ['users_custom', 'full_name'],
  ['subscriptions', 'plan'],
  ['subscriptions', 'status'],
  ['subscriptions', 'payment_gateway'],
  ['subscriptions', 'external_subscription_id'],
  ['employees', 'email'],
  ['employees', 'full_name'],
  ['employees', 'role'],
  ['audit_logs', 'actor_email'],
  ['audit_logs', 'action'],
  ['audit_logs', 'resource_type'],
  ['audit_logs', 'actor_type'],
  ['media', 'filename'],
  ['media', 'original_name'],
];

test('trigram search migration enables pg_trgm and preserves reserved partition numbers', () => {
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pg_trgm;/);
  assert.match(migration, /079-083 are reserved for Phase 5 partition migrations/);
});

test('leading-wildcard search columns have gin_trgm_ops indexes', () => {
  for (const [table, column] of expectedIndexes) {
    const expression = new RegExp(`ON public\\.${table} USING gin \\(${column} gin_trgm_ops\\)`);
    assert.match(migration, expression, `${table}.${column}`);
  }
});

test('trigram search migration is additive only', () => {
  assert.doesNotMatch(migration, /\bDROP\b/i);
  assert.doesNotMatch(migration, /\bRENAME\b/i);
  assert.doesNotMatch(migration, /\bTRUNCATE\b/i);
});
