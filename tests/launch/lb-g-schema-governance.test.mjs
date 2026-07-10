// Phase G — static contract tests for the cross-package schema-governance wiring that the per-package
// unit suites cannot see: the letbuyy-core SQL migration (G5) and the gateway publish-path wiring (G1).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (p) => readFileSync(p, 'utf8');

test('G5: migration 188 materializes the letbuyy-core themes row, idempotently and non-destructively', () => {
  const sql = read('database/supabase/migrations/188_letbuyy_core_theme_row.sql');
  // Inserts the canonical slug.
  assert.match(sql, /INSERT INTO public\.themes/i);
  assert.match(sql, /'letbuyy-core'/);
  // Idempotent — safe to re-run.
  assert.match(sql, /ON CONFLICT \(slug\) DO NOTHING/i);
  // Clones the already-Liquid urban-kicks row (carries rendererEngine='liquid' + appearance schema).
  assert.match(sql, /WHERE slug = 'urban-kicks'/);
  assert.match(sql, /default_template/);
  assert.match(sql, /settings_schema/);
  // Non-destructive: no DELETE / DROP / TRUNCATE / UPDATE of existing rows, only themes touched.
  assert.doesNotMatch(sql, /\b(DELETE|DROP|TRUNCATE)\b/i);
  assert.doesNotMatch(sql, /UPDATE\s+public\./i);
});

test('G1: gateway publish path runs the section-schema migration registry before snapshotting', () => {
  const adapter = read('services/api-gateway/src/execution/theme-execution.adapter.ts');
  // Imports the registry wrapper + the empty-registry fast-path guard.
  assert.match(adapter, /migrateThemeTemplateSchemasWithRegistry/);
  assert.match(adapter, /REGISTERED_SECTION_SCHEMA_MIGRATIONS/);
  // A private helper exists and is invoked inside publish() before validateTemplateConfig.
  assert.match(adapter, /applySectionSchemaMigrations/);
  const publishIdx = adapter.indexOf('async publish(');
  const callIdx = adapter.indexOf('this.applySectionSchemaMigrations(', publishIdx);
  const validateIdx = adapter.indexOf('this.validateTemplateConfig(', publishIdx);
  assert.ok(callIdx > publishIdx, 'migration call must be inside publish()');
  assert.ok(callIdx < validateIdx, 'migration must run before template validation/snapshot');
});

test('G1: the migration registry is empty by design and fast-paths to a no-op', () => {
  const registry = read('packages/theme-engine/src/section-schema-migrations.ts');
  assert.match(registry, /REGISTERED_SECTION_SCHEMA_MIGRATIONS[^=]*=\s*Object\.freeze\(\[\]\)/);
  const adapter = read('services/api-gateway/src/execution/theme-execution.adapter.ts');
  // Empty-registry early return keeps publish behavior unchanged today (zero marshaling).
  assert.match(adapter, /REGISTERED_SECTION_SCHEMA_MIGRATIONS\.length === 0.*return templateConfig/s);
});
