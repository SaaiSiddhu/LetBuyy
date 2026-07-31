// Phase-2 Stream A — LetBuyy Core canonical theme + Urban Kicks alias (additive, no rename).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LETBUYY_CORE_BUNDLE_SLUG,
  LETBUYY_CORE_THEME_SLUG,
  URBAN_KICKS_THEME_SLUG,
  createLetbuyyCoreLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
  isLetbuyyCoreThemeSlug,
  resolveCanonicalThemeSlug,
} from '../src/index.ts';

test('Stream A: the Core fixture is schema-valid and branded LetBuyy Core', () => {
  const core = createLetbuyyCoreLiquidThemeBundleFixture();
  assert.equal(core.package.slug, LETBUYY_CORE_BUNDLE_SLUG);
  assert.equal(core.package.name, 'LetBuyy Core');
});

test('Stream A: the Core bundle has NO Urban Kicks branding (merchant-never-sees-it)', () => {
  const serialized = JSON.stringify(createLetbuyyCoreLiquidThemeBundleFixture());
  assert.doesNotMatch(serialized, /urban-kicks/i);
  assert.doesNotMatch(serialized, /Urban Kicks/);
});

test('Stream A: Core preserves the Urban Kicks structure (same templates + section count)', () => {
  const core = createLetbuyyCoreLiquidThemeBundleFixture();
  const uk = createUrbanKicksLiquidThemeBundleFixture();
  assert.deepEqual(Object.keys(core.templates).sort(), Object.keys(uk.templates).sort());
  assert.equal(Object.keys(core.sections).length, Object.keys(uk.sections).length);
});

test('Stream A: the Urban Kicks fixture is UNCHANGED (alias is additive, not a rename)', () => {
  // The governance test (first-party-liquid-portability) + the persisted themes row depend on this.
  const uk = createUrbanKicksLiquidThemeBundleFixture();
  assert.equal(uk.package.slug, 'urban-kicks-liquid');
  assert.match(uk.package.name, /Urban Kicks/);
});

test('Stream A: the alias resolver maps the legacy slug to canonical, leaves others alone', () => {
  assert.equal(resolveCanonicalThemeSlug(URBAN_KICKS_THEME_SLUG), LETBUYY_CORE_THEME_SLUG);
  assert.equal(resolveCanonicalThemeSlug('urban-kicks-liquid'), LETBUYY_CORE_BUNDLE_SLUG);
  assert.equal(resolveCanonicalThemeSlug(LETBUYY_CORE_THEME_SLUG), LETBUYY_CORE_THEME_SLUG);
  assert.equal(resolveCanonicalThemeSlug('some-other-theme'), 'some-other-theme');
});

test('Stream A: isLetbuyyCoreThemeSlug recognizes both legacy and canonical Core slugs', () => {
  for (const slug of ['urban-kicks', 'urban-kicks-liquid', 'letbuyy-core', 'letbuyy-core-liquid']) {
    assert.equal(isLetbuyyCoreThemeSlug(slug), true, slug);
  }
  assert.equal(isLetbuyyCoreThemeSlug('random-theme'), false);
});
