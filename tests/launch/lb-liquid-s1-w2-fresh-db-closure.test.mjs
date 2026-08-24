// S1/W2 — migration 199 closes the fresh-DB gap that left urban-kicks' rendererEngine unset
// (migrations 171/172/180/181/193 are all UPDATE-only against a row the seed hasn't created yet).
// Structural checks only — behavioral coverage (idempotency, rollback, letbuyy-core isolation, the
// theme_schema_manifests registry sync) lives in tests/executable/theme-liquid-activation-postgres.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const migration = read('database/supabase/migrations/199_liquid_activation_fresh_db_closure.sql');
const rollback = read('database/supabase/rollback/199_liquid_activation_fresh_db_closure.rollback.sql');
const seed = read('database/supabase/seeds/urban-kicks-theme.sql');

test('S1/W2: migration 199 is additive, idempotent, non-destructive, and urban-kicks-scoped', () => {
  assert.match(migration, /UPDATE\s+public\.themes/);
  assert.match(migration, /jsonb_build_object\('rendererEngine',\s*'liquid'\)/);
  assert.match(migration, /WHERE\s+slug\s*=\s*'urban-kicks'/);
  assert.doesNotMatch(migration, /DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|DROP\s+COLUMN|DROP\s+FUNCTION|DROP\s+POLICY/i);
  // Must never write rendererEngine onto letbuyy-core — the canary stays off
  // (ART-17; THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION). Only the header prose may name it.
  const executableLines = migration.split('\n').filter((line) => !line.trim().startsWith('--'));
  assert.doesNotMatch(executableLines.join('\n'), /letbuyy-core/, 'no executable statement may target letbuyy-core');
});

test('S1/W2: migration 199 has a paired rollback that reverses rendererEngine', () => {
  assert.match(rollback, /default_template\s*-\s*'rendererEngine'/);
  assert.match(rollback, /WHERE\s+slug\s*=\s*'urban-kicks'/);
  assert.doesNotMatch(rollback, /DROP\s+TABLE|TRUNCATE|DROP\s+COLUMN|DROP\s+FUNCTION|DROP\s+POLICY/i);
});

test('S1/W2: migration 199 mirrors the theme_schema_manifests registry sync (193 part 1)', () => {
  assert.match(migration, /theme_schema_manifests/);
  assert.match(migration, /NOT\s*\(m\.settings_schema\s*\?\s*'settings'\)/);
});

test('S1/W2: the seed now mirrors the same closure for a genuinely fresh database', () => {
  assert.match(seed, /jsonb_build_object\('rendererEngine',\s*'liquid'\)/);
  assert.match(seed, /'bodyFontFamily'/);
  assert.match(seed, /theme_schema_manifests/);
  // The seed's own INSERT ... ON CONFLICT (slug) DO UPDATE SET default_template = EXCLUDED.default_template
  // unconditionally overwrites default_template, so the closure block must appear AFTER that statement —
  // confirm ordering, not just presence.
  const conflictIndex = seed.indexOf('ON CONFLICT (slug) DO UPDATE SET');
  const closureIndex = seed.indexOf("jsonb_build_object('rendererEngine'");
  assert.ok(conflictIndex >= 0 && closureIndex > conflictIndex, 'the rendererEngine closure must be appended after the seed\'s ON CONFLICT clobber, not before it');
});
