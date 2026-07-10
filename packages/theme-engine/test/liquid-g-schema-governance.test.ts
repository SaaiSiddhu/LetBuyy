// Phase G — Schema governance tests (G1 migration registry, G3 canonicalization, G4 version gate,
// G6 experience overlay validation). No-breaking-changes law: where a schema is touched, prove the
// pre-change stored shape produces identical output.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_SECTION_SCHEMA_VERSION,
  REGISTERED_SECTION_SCHEMA_MIGRATIONS,
  migrateThemeTemplateSchemasWithRegistry,
  CANONICAL_FIELD_GROUP_INDEX,
  CANONICAL_UNMAPPED_GROUP,
  flattenSettingsData,
  groupSettingsFields,
  KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS,
  isKnownLiquidBundleSchemaVersion,
  parseLiquidThemePackageBundle,
  UnsupportedLiquidBundleSchemaVersionError,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
  createUrbanKicksLiquidThemeBundleFixture,
  applyExperienceToSettingsData,
  applyExperienceToTemplateConfig,
  validateExperienceOverlay,
  getExperience,
  type StoreTemplateConfig,
} from '../src/index';

// ── G1: migration registry ───────────────────────────────────────────────────

test('G1: registry is empty by design and exposes a current section schema version', () => {
  assert.equal(Array.isArray(REGISTERED_SECTION_SCHEMA_MIGRATIONS), true);
  assert.equal(REGISTERED_SECTION_SCHEMA_MIGRATIONS.length, 0, 'no real historical field renames exist to migrate');
  assert.match(CURRENT_SECTION_SCHEMA_VERSION, /^\d{4}-\d{2}-sections-v\d+$/);
});

test('G1: migrateThemeTemplateSchemasWithRegistry is a structural no-op on an unversioned config', () => {
  const config: StoreTemplateConfig = {
    themeId: 'urban-kicks',
    themeSettings: {},
    sections: [
      { id: 's1', type: 'heroBanner', order: 0, settings: { heading: 'Hi' }, isVisible: true },
    ],
  };
  const result = migrateThemeTemplateSchemasWithRegistry(config);
  assert.deepEqual(result.applied, [], 'nothing to apply with an empty registry');
  assert.deepEqual(result.warnings, []);
  // Section settings unchanged — no silent mutation.
  assert.deepEqual(result.templateConfig.sections[0].settings, { heading: 'Hi' });
});

// ── G3: settings-schema canonicalization ──────────────────────────────────────

test('G3: field->group index is derived from the frozen schema', () => {
  assert.equal(CANONICAL_FIELD_GROUP_INDEX.primaryColor, 'colors');
  assert.equal(CANONICAL_FIELD_GROUP_INDEX.fontFamily, 'typography');
  assert.equal(CANONICAL_FIELD_GROUP_INDEX.borderRadius, 'layout');
  assert.equal(CANONICAL_FIELD_GROUP_INDEX.showSearch, 'header');
  assert.equal(CANONICAL_FIELD_GROUP_INDEX.showNewsletter, 'footer');
});

test('G3: flat -> grouped groups known fields and preserves unknowns under appearance', () => {
  const flat = { primaryColor: '#111111', fontFamily: 'Inter', borderRadius: 8, customBrandFlag: true };
  const grouped = groupSettingsFields(flat);
  assert.equal(grouped.colors.primaryColor, '#111111');
  assert.equal(grouped.typography.fontFamily, 'Inter');
  assert.equal(grouped.layout.borderRadius, 8);
  assert.equal(grouped[CANONICAL_UNMAPPED_GROUP].customBrandFlag, true, 'unknown field preserved, not dropped');
});

test('G3: flatten(group(x)) is a lossless round-trip (no breaking change to stored values)', () => {
  const flat = {
    primaryColor: '#0A0A0A', secondaryColor: '#FAFAFA', fontFamily: 'Poppins',
    headingFontFamily: 'Playfair Display', borderRadius: 12, showCart: true,
    columns: 3, merchantCustomKey: 'keep-me',
  };
  const roundTripped = flattenSettingsData(groupSettingsFields(flat));
  assert.deepEqual(roundTripped, flat);
});

test('G3: a flat appearance-only DB shape flattens without loss', () => {
  const dbShape = { appearance: { primaryColor: '#123456', borderRadius: 4 } };
  const flat = flattenSettingsData(dbShape);
  assert.deepEqual(flat, { primaryColor: '#123456', borderRadius: 4 });
});

// ── G4: bundle schema_version gate ─────────────────────────────────────────────

test('G4: the current version is known and a fresh fixture parses', () => {
  assert.equal(isKnownLiquidBundleSchemaVersion(THEME_LIQUID_BUNDLE_SCHEMA_VERSION), true);
  assert.equal(KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS.includes(THEME_LIQUID_BUNDLE_SCHEMA_VERSION), true);
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.doesNotThrow(() => parseLiquidThemePackageBundle(bundle));
});

test('G4: a missing schema_version is stamped to current (backward compatible)', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const withoutVersion: Record<string, unknown> = { ...bundle };
  delete withoutVersion.schema_version;
  const parsed = parseLiquidThemePackageBundle(withoutVersion);
  assert.equal(parsed.schema_version, THEME_LIQUID_BUNDLE_SCHEMA_VERSION);
});

test('G4: an unknown/future schema_version is rejected fail-closed', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const future = { ...bundle, schema_version: '2099-01-liquid-from-the-future' };
  assert.throws(
    () => parseLiquidThemePackageBundle(future),
    (err: unknown) => err instanceof UnsupportedLiquidBundleSchemaVersionError && err.schemaVersion === '2099-01-liquid-from-the-future',
  );
});

// ── G6: experience overlay validation ──────────────────────────────────────────

test('G6: a valid experience applies its overlay (no regression)', () => {
  const exp = getExperience('summit');
  assert.ok(exp, 'summit experience exists');
  const out = applyExperienceToSettingsData({ existing: 'kept' }, exp!);
  assert.equal(out.existing, 'kept', 'unrelated keys preserved');
  assert.equal(typeof out.primaryColor, 'string');
  assert.match(String(out.primaryColor), /^#[0-9A-Fa-f]{6}$/);
});

test('G6: validateExperienceOverlay rejects a malformed overlay without throwing', () => {
  const bad = validateExperienceOverlay({ primaryColor: 'not-a-hex', borderRadius: 999 });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.ok(bad.issues.length >= 1);
});

test('G6: a poisoned experience leaves settings/template config unchanged (fail-safe)', () => {
  const exp = getExperience('summit');
  assert.ok(exp);
  // Bypass validateExperience by mutating a clone's tokens to an invalid hex.
  const poisoned = { ...exp!, tokens: { ...exp!.tokens, primaryColor: 'nope' as unknown as string } };
  const priorSettings = { primaryColor: '#ABCDEF', keep: 'me' };
  const settingsOut = applyExperienceToSettingsData(priorSettings, poisoned as typeof exp);
  assert.deepEqual(settingsOut, priorSettings, 'invalid overlay must not corrupt settings');

  const priorConfig = { themeSettings: { primaryColor: '#ABCDEF' }, experienceId: 'summit' };
  const configOut = applyExperienceToTemplateConfig(priorConfig, poisoned as typeof exp);
  assert.deepEqual(configOut, priorConfig, 'invalid overlay must not corrupt template config');
});
