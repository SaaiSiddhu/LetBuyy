// L1 — Bundle Persistence (Full Liquid V1).
// Validates that the urban-kicks Liquid bundle is persisted, schema-shaped, sanitizer-safe, and
// canary-gated so production rendering is unaffected. Operates on the REAL generated artifacts +
// the live render-path source (no fabricated fixtures).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const bundle = JSON.parse(read('database/supabase/seeds/generated/urban-kicks-liquid-bundle.json'));
const migration = read('database/supabase/migrations/171_liquid_bundle_persistence.sql');
const seed = read('database/supabase/seeds/urban-kicks-theme.sql');
const templateResolver = read('apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts');
const themeGovernance = read('packages/theme-engine/src/theme-governance.ts');

test('L1: persisted bundle is a Liquid renderer bundle', () => {
  assert.equal(bundle.renderer.engine, 'liquid');
  assert.equal(bundle.schema_version, '2026-06-liquid-sections');
  assert.equal(bundle.package.slug, 'urban-kicks-liquid');
  assert.equal(bundle.layout.theme.path, 'layout/theme.liquid');
});

test('L1: bundle ships >=20 sections and an index page template', () => {
  const sections = Object.keys(bundle.sections);
  assert.ok(sections.length >= 20, `expected >=20 sections, got ${sections.length}`);
  assert.ok(bundle.templates.index, 'index template must exist (product/collection land in L4/L5)');
  // every section key must match its file path type (the schema superRefine invariant)
  for (const [type, section] of Object.entries(bundle.sections)) {
    assert.ok(section.path.includes(type), `section ${type} path ${section.path} must encode its type`);
  }
});

test('L1: every persisted section source is sanitizer-safe (no script/render/include/layout)', () => {
  for (const [type, section] of Object.entries(bundle.sections)) {
    const src = String(section.source || '');
    assert.doesNotMatch(src, /<script/i, `section ${type} must not contain <script`);
    assert.doesNotMatch(src, /\{%\s*render/, `section ${type} must not contain {% render`);
    assert.doesNotMatch(src, /\{%\s*include/, `section ${type} must not contain {% include`);
    assert.doesNotMatch(src, /\{%\s*layout/, `section ${type} must not contain {% layout`);
    assert.match(src, /\{%\s*schema\s*%\}/, `section ${type} must declare a {% schema %} block`);
  }
});

test('L1: migration 171 is an additive, idempotent, non-destructive attach', () => {
  assert.match(migration, /UPDATE\s+public\.themes/);
  assert.match(migration, /WHERE\s+slug\s*=\s*'urban-kicks'/);
  assert.match(migration, /jsonb_build_object\('liquidBundle'/);
  assert.match(migration, /COALESCE\(default_template/); // additive merge, never replace
  assert.doesNotMatch(migration, /DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|DROP\s+COLUMN|DROP\s+FUNCTION/i);
});

test('L1: seed carries the same liquidBundle attach for fresh databases', () => {
  assert.match(seed, /jsonb_build_object\('liquidBundle'/);
  assert.match(seed, /WHERE\s+slug\s*=\s*'urban-kicks'/);
});

test('L1: render switch is canary-gated — production default stays React (safety invariant)', () => {
  // liquidBundle is only resolved when liquidEnabled is true; liquidEnabled comes from the canary gate.
  assert.match(templateResolver, /resolveThemeLiquidRenderingEnabled/);
  assert.match(templateResolver, /liquidEnabled\s*\?\s*resolveLiquidBundle/);
  // The freeze is intact: platform default is OFF, so a persisted bundle does not flip production.
  assert.match(themeGovernance, /THEME_LIQUID_RENDERING_DEFAULT_ENABLED\s*=\s*false/);
});
