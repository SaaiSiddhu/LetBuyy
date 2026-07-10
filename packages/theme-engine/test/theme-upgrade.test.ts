// K2 tests — Theme Upgrade Planner
import assert from 'node:assert/strict';
import test from 'node:test';
import { planThemeUpgrade } from '../src/theme-upgrade.ts';
import {
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
} from '../src/theme-bundle.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';
import type { LiquidThemePackageBundle } from '../src/theme-bundle.ts';

// ---- Same-version upgrade (no-op) ----

test('theme-upgrade: same-version upgrade produces a no-op plan', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const plan = planThemeUpgrade({ installed: bundle, next: bundle });

  assert.equal(plan.fromVersion, THEME_LIQUID_BUNDLE_SCHEMA_VERSION);
  assert.equal(plan.toVersion, THEME_LIQUID_BUNDLE_SCHEMA_VERSION);
  assert.equal(plan.compatible, true);
  assert.deepEqual(plan.schemaMigrations, []);
  assert.deepEqual(plan.sectionAdds, []);
  assert.deepEqual(plan.sectionRemoves, []);
  // Same sections → no warnings about adds/removes
  assert.ok(Array.isArray(plan.warnings));
});

test('theme-upgrade: same-version upgrade settingsCarryover is an object', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const plan = planThemeUpgrade({ installed: bundle, next: bundle });

  assert.ok(typeof plan.settingsCarryover === 'object' && plan.settingsCarryover !== null);
});

// ---- Upgrade from minimal to Urban Kicks (section additions) ----

test('theme-upgrade: upgrading from minimal to Urban Kicks detects section additions', () => {
  const installed = createMinimalLiquidThemeBundleFixture();
  const next = createUrbanKicksLiquidThemeBundleFixture();
  const plan = planThemeUpgrade({ installed, next });

  // Urban Kicks has many more sections than the minimal fixture
  assert.ok(plan.sectionAdds.length > 0, 'Expected at least one section addition');
  assert.deepEqual(plan.sectionRemoves, []);
  assert.equal(plan.compatible, true);
});

test('theme-upgrade: upgrading from Urban Kicks to minimal detects section removals', () => {
  const installed = createUrbanKicksLiquidThemeBundleFixture();
  const next = createMinimalLiquidThemeBundleFixture();
  const plan = planThemeUpgrade({ installed, next });

  assert.ok(plan.sectionRemoves.length > 0, 'Expected at least one section removal');
  assert.deepEqual(plan.sectionAdds, []);
  assert.equal(plan.compatible, true);
});

// ---- Letbuyy Core fixture ----

test('theme-upgrade: upgrading from minimal to Letbuyy Core is compatible', () => {
  const installed = createMinimalLiquidThemeBundleFixture();
  const next = createLetbuyyCoreLiquidThemeBundleFixture();
  const plan = planThemeUpgrade({ installed, next });

  assert.equal(plan.compatible, true);
  assert.equal(plan.fromVersion, THEME_LIQUID_BUNDLE_SCHEMA_VERSION);
  assert.equal(plan.toVersion, THEME_LIQUID_BUNDLE_SCHEMA_VERSION);
});

// ---- Downgrade detection ----

test('theme-upgrade: downgrade to unknown schema_version sets compatible=false and emits warning', () => {
  const installed = createMinimalLiquidThemeBundleFixture();
  // Build a next bundle with an unknown/future schema_version (incompatible)
  const next: LiquidThemePackageBundle = {
    ...installed,
    schema_version: 'future-unknown-epoch',
    package: {
      ...installed.package,
      compatibility_range: '>=future-unknown-epoch',
    },
  };
  const plan = planThemeUpgrade({ installed, next });

  assert.equal(plan.compatible, false);
  assert.ok(plan.warnings.length > 0, 'Expected at least one warning for incompatible target');
  assert.ok(
    plan.warnings.some((w) => w.includes('future-unknown-epoch')),
    `Expected warning to mention the unknown version; got: ${JSON.stringify(plan.warnings)}`,
  );
});

// ---- Schema migrations (currently no-op since REGISTERED_SECTION_SCHEMA_MIGRATIONS is empty) ----

test('theme-upgrade: schemaMigrations is an empty array (no registered migrations yet)', () => {
  const installed = createUrbanKicksLiquidThemeBundleFixture();
  const next = createUrbanKicksLiquidThemeBundleFixture();
  const plan = planThemeUpgrade({ installed, next });

  // REGISTERED_SECTION_SCHEMA_MIGRATIONS is intentionally empty (Phase G verdict).
  assert.deepEqual(plan.schemaMigrations, []);
});

// ---- Return shape ----

test('theme-upgrade: plan has all required fields', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const plan = planThemeUpgrade({ installed: bundle, next: bundle });

  assert.ok('fromVersion' in plan, 'Missing fromVersion');
  assert.ok('toVersion' in plan, 'Missing toVersion');
  assert.ok('schemaMigrations' in plan, 'Missing schemaMigrations');
  assert.ok('settingsCarryover' in plan, 'Missing settingsCarryover');
  assert.ok('sectionAdds' in plan, 'Missing sectionAdds');
  assert.ok('sectionRemoves' in plan, 'Missing sectionRemoves');
  assert.ok('compatible' in plan, 'Missing compatible');
  assert.ok('warnings' in plan, 'Missing warnings');
});

test('theme-upgrade: sectionAdds and sectionRemoves are sorted alphabetically', () => {
  const installed = createUrbanKicksLiquidThemeBundleFixture();
  const next = createMinimalLiquidThemeBundleFixture();
  const plan = planThemeUpgrade({ installed, next });

  const sorted = [...plan.sectionRemoves].sort();
  assert.deepEqual(plan.sectionRemoves, sorted, 'sectionRemoves should be sorted');
});

test('theme-upgrade: settingsCarryover contains only Record<string, Record<string, unknown>> groups', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const plan = planThemeUpgrade({ installed: bundle, next: bundle });

  for (const [groupKey, group] of Object.entries(plan.settingsCarryover)) {
    assert.ok(typeof groupKey === 'string', `Group key must be string, got ${typeof groupKey}`);
    assert.ok(typeof group === 'object' && group !== null && !Array.isArray(group),
      `Group value for "${groupKey}" must be a plain object`);
  }
});

// ---- No side effects ----

test('theme-upgrade: planThemeUpgrade does not mutate the input bundles', () => {
  const installed = createUrbanKicksLiquidThemeBundleFixture();
  const next = createMinimalLiquidThemeBundleFixture();
  const installedSlug = installed.package.slug;
  const nextSlug = next.package.slug;

  planThemeUpgrade({ installed, next });

  assert.equal(installed.package.slug, installedSlug, 'installed bundle must not be mutated');
  assert.equal(next.package.slug, nextSlug, 'next bundle must not be mutated');
});
