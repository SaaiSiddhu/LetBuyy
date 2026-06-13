// L14 convergence — the persisted urban-kicks bundle is REFRESHED to the full L4-L13 template set
// (migration 171 carried only L1's index/header/footer). A canary store must carry every template.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const bundle = JSON.parse(read('database/supabase/seeds/generated/urban-kicks-liquid-bundle.json'));
const migration = read('database/supabase/migrations/172_liquid_bundle_refresh.sql');
const seed = read('database/supabase/seeds/urban-kicks-theme.sql');

const REQUIRED = ['index', 'product', 'collection', 'search', 'cart',
  'customers/login', 'customers/register', 'customers/account', 'customers/orders', 'customers/order'];

test('L14: the persisted bundle carries every customer-facing template', () => {
  for (const key of REQUIRED) {
    assert.ok(bundle.templates[key], `persisted bundle must carry template "${key}"`);
  }
  assert.equal(bundle.renderer.engine, 'liquid');
});

test('L14: refresh migration 172 is additive, idempotent, non-destructive', () => {
  assert.match(migration, /UPDATE\s+public\.themes/);
  assert.match(migration, /jsonb_build_object\('liquidBundle'/);
  assert.match(migration, /COALESCE\(default_template/);          // additive merge, never replace
  assert.match(migration, /WHERE\s+slug\s*=\s*'urban-kicks'/);
  assert.doesNotMatch(migration, /DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|DROP\s+COLUMN|DROP\s+FUNCTION/i);
});

test('L14: the seed carries the same full bundle for fresh databases', () => {
  // the bundle is embedded as JSON in the seed's dollar-quoted attach, so keys are double-quoted
  assert.match(seed, /"customers\/order"/);   // the embedded full bundle JSON references the tail templates
  assert.match(seed, /"customers\/account"/);
});
