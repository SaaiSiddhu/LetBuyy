// K3 tests — Theme Install Validator
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateThemeInstall } from '../src/theme-install.ts';
import {
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
} from '../src/theme-bundle.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';
import type { LiquidThemePackageBundle } from '../src/theme-bundle.ts';

// ---- Valid bundles pass ----

test('theme-install: minimal fixture passes validation', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const result = validateThemeInstall({ bundle });

  assert.equal(result.ok, true, `Expected ok=true, got issues: ${result.issues.map((i) => i.message).join(', ')}`);
  // No error-level issues
  assert.equal(result.issues.filter((i) => i.level === 'error').length, 0);
});

test('theme-install: Urban Kicks fixture passes validation', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const result = validateThemeInstall({ bundle });

  assert.equal(result.ok, true, `Expected ok=true, got issues: ${result.issues.map((i) => i.message).join(', ')}`);
});

test('theme-install: Letbuyy Core fixture passes validation', () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const result = validateThemeInstall({ bundle });

  assert.equal(result.ok, true, `Expected ok=true, got issues: ${result.issues.map((i) => i.message).join(', ')}`);
});

// ---- Schema validation failure ----

test('theme-install: invalid (non-bundle) input returns ok=false with schema-invalid issues', () => {
  // Pass a non-bundle object — structured wrong
  const result = validateThemeInstall({ bundle: {} as unknown as LiquidThemePackageBundle });

  assert.equal(result.ok, false);
  assert.ok(result.issues.length > 0, 'Expected at least one issue');
  assert.ok(
    result.issues.some((i) => i.code === 'schema-invalid'),
    `Expected a schema-invalid issue; got: ${JSON.stringify(result.issues)}`,
  );
});

// ---- Incompatible schema_version ----

test('theme-install: bundle with unknown schema_version fails compat-range check', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const incompatible: LiquidThemePackageBundle = {
    ...base,
    schema_version: 'future-epoch-unsupported',
    package: {
      ...base.package,
      compatibility_range: '>=future-epoch-unsupported',
    },
  };

  const result = validateThemeInstall({ bundle: incompatible });

  // Stage 1 will fail because parseLiquidThemePackageBundle enforces isKnownLiquidBundleSchemaVersion.
  // The schema_version gate is in validateTheme which is Stage 1.
  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((i) => i.code === 'schema-invalid' || i.code === 'compat-range'),
    `Expected schema-invalid or compat-range issue; got: ${JSON.stringify(result.issues)}`,
  );
});

// ---- Slug mismatch ----

test('theme-install: matching targetSlug passes slug check', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const result = validateThemeInstall({ bundle, targetSlug: bundle.package.slug });

  assert.equal(result.ok, true);
  assert.equal(result.issues.filter((i) => i.code === 'slug-mismatch').length, 0);
});

test('theme-install: mismatched targetSlug produces slug-mismatch error', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const result = validateThemeInstall({ bundle, targetSlug: 'wrong-slug-entirely' });

  assert.equal(result.ok, false);
  assert.ok(
    result.issues.some((i) => i.code === 'slug-mismatch'),
    `Expected slug-mismatch issue; got: ${JSON.stringify(result.issues)}`,
  );
});

test('theme-install: urban-kicks slug matches letbuyy-core targetSlug via alias resolution', () => {
  // resolveCanonicalThemeSlug maps 'urban-kicks' -> 'letbuyy-core'
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  // urban-kicks-liquid is the bundle slug; letbuyy-core-liquid is its canonical alias
  const result = validateThemeInstall({ bundle, targetSlug: 'letbuyy-core-liquid' });

  // Both slugs resolve to 'letbuyy-core-liquid' via THEME_SLUG_ALIASES, so no mismatch.
  const slugMismatchIssues = result.issues.filter((i) => i.code === 'slug-mismatch');
  assert.equal(slugMismatchIssues.length, 0, 'urban-kicks-liquid and letbuyy-core-liquid should resolve to same canonical slug');
});

// ---- Result shape ----

test('theme-install: result always has ok and issues fields', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const result = validateThemeInstall({ bundle });

  assert.ok('ok' in result, 'Missing ok');
  assert.ok('issues' in result, 'Missing issues');
  assert.ok(Array.isArray(result.issues), 'issues must be an array');
});

test('theme-install: errors appear before warnings in issues array', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  // Inject a slug mismatch (error) alongside any existing warns
  const result = validateThemeInstall({ bundle, targetSlug: 'does-not-match' });

  const firstError = result.issues.findIndex((i) => i.level === 'error');
  const firstWarn = result.issues.findIndex((i) => i.level === 'warn');

  if (firstError !== -1 && firstWarn !== -1) {
    assert.ok(firstError < firstWarn, 'All errors must appear before warnings in the issues array');
  }
});

// ---- No side effects ----

test('theme-install: validateThemeInstall does not mutate the bundle', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const slugBefore = bundle.package.slug;
  const sectionsBefore = Object.keys(bundle.sections).length;

  validateThemeInstall({ bundle });

  assert.equal(bundle.package.slug, slugBefore, 'bundle.package.slug was mutated');
  assert.equal(Object.keys(bundle.sections).length, sectionsBefore, 'bundle.sections was mutated');
});
