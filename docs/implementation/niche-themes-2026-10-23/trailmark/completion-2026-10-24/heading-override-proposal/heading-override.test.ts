import assert from 'node:assert/strict';
import test from 'node:test';
import { createTrailmarkTheme as candidate } from '../src/trailmark-theme.ts';
import { createTrailmarkTheme as released } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/trailmark-theme.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-bundle-core.ts';
import { buildLiquidThemePackagePersistencePayload } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-bundle.ts';
import { fromThemeDocumentV2, toThemeDocumentV2 } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-document.ts';
import { LiquidRenderer } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-settings.ts';

async function render(key: 'collection' | 'search', title: string, override?: string, fallback?: string) {
  const bundle = candidate(createLetbuyyCoreLiquidThemeBundleFixture());
  const section = bundle.templates[key].sections[bundle.templates[key].order[0]];
  if (override !== undefined) section.settings.headingOverride = override;
  if (fallback !== undefined) section.settings.title = fallback;
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'source-test', path: '/'+key, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-ride', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Synthetic source test' }, collection: { title, products: [], total: 0 } },
  });
  assert.equal(result.status, 'rendered');
  assert.deepEqual(result.warnings, []);
  return result.liquid!.contentForLayout;
}

test('explicit heading changes the actual normal collection and search h1', async () => {
  for (const key of ['collection','search'] as const) {
    const html = await render(key, 'Court time', 'Club equipment');
    assert.match(html, /<h1>Club equipment<\/h1>/);
    assert.doesNotMatch(html, /<h1>Court time<\/h1>/);
  }
});

test('absent or cleared override preserves the existing normal collection title', async () => {
  for (const key of ['collection','search'] as const) for (const value of [undefined, '']) {
    assert.match(await render(key, 'Court time', value), /<h1>Court time<\/h1>/);
  }
});

test('empty data still uses the existing fallback field on both routes', async () => {
  for (const key of ['collection','search'] as const) {
    assert.match(await render(key, '', '', 'No named activity'), /<h1>No named activity<\/h1>/);
  }
});

test('stored legacy fallback does not unexpectedly replace a named collection', async () => {
  assert.match(await render('collection', 'Court time', undefined, 'Older fallback copy'), /<h1>Court time<\/h1>/);
});

test('merchant heading is escaped by the actual canonical Liquid renderer', async () => {
  const html = await render('collection', 'Court time', '<img src=x onerror=alert(1)>');
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img\b[^>]*onerror=/i);
});

test('canonical persistence adapter exposes separate override and fallback fields', () => {
  const bundle = candidate(createLetbuyyCoreLiquidThemeBundleFixture());
  const schema = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest.section_schemas['collection-product-list'] as { settings_schema: Record<string, { type: string; label: string; default?: string }> };
  assert.equal(schema.settings_schema.headingOverride.type, 'text');
  assert.equal(schema.settings_schema.headingOverride.default, '');
  assert.equal(schema.settings_schema.title.label, 'Fallback heading');
});

test('canonical ThemeDocument/JSON roundtrip retains explicit override and base purity', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture();
  const before = structuredClone(base);
  const bundle = candidate(base);
  const section = bundle.templates.collection.sections[bundle.templates.collection.order[0]];
  section.settings.headingOverride = 'Club equipment';
  const restored = fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(bundle))));
  assert.deepEqual(restored, bundle);
  assert.deepEqual(base, before);
});

test('all other sections/templates/metadata remain exact; old2.0.0 input is not hotpatched', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture();
  const original = released(base), proposed = candidate(base);
  for (const [type, section] of Object.entries(original.sections)) {
    if (type !== 'collection-product-list') assert.deepEqual(proposed.sections[type], section);
  }
  assert.deepEqual(proposed.templates, original.templates);
  assert.deepEqual(proposed.package, original.package);
  assert.deepEqual(proposed.config, original.config);
  assert.deepEqual(candidate(original), original);
});
