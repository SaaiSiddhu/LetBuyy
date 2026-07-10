// K1 tests — Theme Version comparator
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseSchemaRange,
  schemaVersionIndex,
  compareSchemaVersions,
  satisfiesSchemaRange,
  versionFamily,
  isThemeBundleSchemaCompatible,
} from '../src/theme-version.ts';
import {
  KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
} from '../src/theme-bundle.ts';

// ---- parseSchemaRange ----

test('theme-version: parseSchemaRange parses >= operator correctly', () => {
  const parsed = parseSchemaRange('>=2026-06-liquid-sections');
  assert.ok(parsed !== null);
  assert.equal(parsed!.op, '>=');
  assert.equal(parsed!.minVersion, '2026-06-liquid-sections');
});

test('theme-version: parseSchemaRange parses ^ operator correctly', () => {
  const parsed = parseSchemaRange('^2026-06-liquid-sections');
  assert.ok(parsed !== null);
  assert.equal(parsed!.op, '^');
  assert.equal(parsed!.minVersion, '2026-06-liquid-sections');
});

test('theme-version: parseSchemaRange treats bare version as >=', () => {
  const parsed = parseSchemaRange('2026-06-liquid-sections');
  assert.ok(parsed !== null);
  assert.equal(parsed!.op, '>=');
  assert.equal(parsed!.minVersion, '2026-06-liquid-sections');
});

test('theme-version: parseSchemaRange returns null for empty string', () => {
  assert.equal(parseSchemaRange(''), null);
});

test('theme-version: parseSchemaRange returns null for ">=" with no version', () => {
  assert.equal(parseSchemaRange('>='), null);
});

test('theme-version: parseSchemaRange returns null for "^" with no version', () => {
  assert.equal(parseSchemaRange('^'), null);
});

test('theme-version: parseSchemaRange trims whitespace', () => {
  const parsed = parseSchemaRange('  >= 2026-06-liquid-sections  ');
  assert.ok(parsed !== null);
  assert.equal(parsed!.op, '>=');
  assert.equal(parsed!.minVersion, '2026-06-liquid-sections');
});

// ---- schemaVersionIndex ----

test('theme-version: schemaVersionIndex returns 0 for the sole known version', () => {
  assert.equal(schemaVersionIndex(THEME_LIQUID_BUNDLE_SCHEMA_VERSION), 0);
});

test('theme-version: schemaVersionIndex returns -1 for an unknown version', () => {
  assert.equal(schemaVersionIndex('future-unknown-version'), -1);
});

test('theme-version: schemaVersionIndex returns -1 for empty string', () => {
  assert.equal(schemaVersionIndex(''), -1);
});

// ---- compareSchemaVersions ----

test('theme-version: compareSchemaVersions returns 0 for identical versions', () => {
  assert.equal(compareSchemaVersions(THEME_LIQUID_BUNDLE_SCHEMA_VERSION, THEME_LIQUID_BUNDLE_SCHEMA_VERSION), 0);
});

test('theme-version: compareSchemaVersions returns null when first version is unknown', () => {
  assert.equal(compareSchemaVersions('unknown-version', THEME_LIQUID_BUNDLE_SCHEMA_VERSION), null);
});

test('theme-version: compareSchemaVersions returns null when second version is unknown', () => {
  assert.equal(compareSchemaVersions(THEME_LIQUID_BUNDLE_SCHEMA_VERSION, 'unknown-version'), null);
});

test('theme-version: compareSchemaVersions returns null when both are unknown', () => {
  assert.equal(compareSchemaVersions('unknown-a', 'unknown-b'), null);
});

test('theme-version: KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS has at least one entry', () => {
  assert.ok(KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS.length >= 1);
});

// ---- versionFamily ----

test('theme-version: versionFamily extracts year prefix from date-based version', () => {
  assert.equal(versionFamily('2026-06-liquid-sections'), '2026');
});

test('theme-version: versionFamily extracts year prefix from another date-based version', () => {
  assert.equal(versionFamily('2026-05-json-contract'), '2026');
});

test('theme-version: versionFamily returns the full string when no dash is present', () => {
  assert.equal(versionFamily('noDash'), 'noDash');
});

test('theme-version: versionFamily returns empty string when string starts with dash', () => {
  // edge case: string is '-foo'
  assert.equal(versionFamily('-foo'), '');
});

// ---- satisfiesSchemaRange ----

test('theme-version: satisfiesSchemaRange: known version satisfies >=itself', () => {
  const v = THEME_LIQUID_BUNDLE_SCHEMA_VERSION;
  assert.equal(satisfiesSchemaRange(v, `>=${v}`), true);
});

test('theme-version: satisfiesSchemaRange: known version satisfies ^itself', () => {
  const v = THEME_LIQUID_BUNDLE_SCHEMA_VERSION;
  assert.equal(satisfiesSchemaRange(v, `^${v}`), true);
});

test('theme-version: satisfiesSchemaRange: unknown target returns false', () => {
  assert.equal(satisfiesSchemaRange('future-version', `>=${THEME_LIQUID_BUNDLE_SCHEMA_VERSION}`), false);
});

test('theme-version: satisfiesSchemaRange: unknown minimum returns false', () => {
  assert.equal(satisfiesSchemaRange(THEME_LIQUID_BUNDLE_SCHEMA_VERSION, '>=future-version'), false);
});

test('theme-version: satisfiesSchemaRange: empty range returns false', () => {
  assert.equal(satisfiesSchemaRange(THEME_LIQUID_BUNDLE_SCHEMA_VERSION, ''), false);
});

test('theme-version: satisfiesSchemaRange: both unknown returns false', () => {
  assert.equal(satisfiesSchemaRange('future-a', '>=future-b'), false);
});

test('theme-version: satisfiesSchemaRange: ^ against the same known version passes (same family)', () => {
  const v = THEME_LIQUID_BUNDLE_SCHEMA_VERSION;
  assert.equal(satisfiesSchemaRange(v, `^${v}`), true);
});

test('theme-version: satisfiesSchemaRange: ^ with a different-family (unknown) version returns false', () => {
  // The ^ same-family branch is a defensive constraint for when a SECOND schema epoch is registered.
  // Today only one version is known, so a genuinely different-family version is (a) not in the known
  // list and (b) a different year prefix — either way ^ must reject it. This proves ^ never
  // silently accepts a cross-family/unknown version (fail-closed), and that versionFamily() would
  // distinguish the families the moment a second known version exists.
  const known = THEME_LIQUID_BUNDLE_SCHEMA_VERSION; // '2026-...'
  const differentFamily = '2099-01-liquid-from-the-future';
  assert.notEqual(versionFamily(differentFamily), versionFamily(known), 'families must differ (year prefix)');
  // ^ range pinned at the different-family version, tested against the known version: rejected.
  assert.equal(satisfiesSchemaRange(known, `^${differentFamily}`), false);
  // ^ range pinned at the known version, tested against the different-family version: rejected.
  assert.equal(satisfiesSchemaRange(differentFamily, `^${known}`), false);
});

test('theme-version: satisfiesSchemaRange: bare version string treated as >=', () => {
  const v = THEME_LIQUID_BUNDLE_SCHEMA_VERSION;
  // bare version is treated as >=v, so v satisfies it
  assert.equal(satisfiesSchemaRange(v, v), true);
});

// ---- isThemeBundleSchemaCompatible ----

test('theme-version: isThemeBundleSchemaCompatible: minimal fixture is compatible', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  assert.equal(isThemeBundleSchemaCompatible(bundle), true);
});

test('theme-version: isThemeBundleSchemaCompatible: bundle with unknown schema_version is incompatible', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  // Patch schema_version to an unknown value via object spread (pure test mutation)
  const patched = { ...bundle, schema_version: 'future-unknown-epoch' };
  assert.equal(isThemeBundleSchemaCompatible(patched as typeof bundle), false);
});

test('theme-version: isThemeBundleSchemaCompatible: bundle with unresolvable compatibility_range is incompatible', () => {
  const bundle = createMinimalLiquidThemeBundleFixture();
  const patched = {
    ...bundle,
    package: {
      ...bundle.package,
      compatibility_range: '>=future-epoch-not-in-list',
    },
  };
  assert.equal(isThemeBundleSchemaCompatible(patched as typeof bundle), false);
});

test('theme-version: isThemeBundleSchemaCompatible: Urban Kicks fixture is compatible', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.equal(isThemeBundleSchemaCompatible(bundle), true);
});
