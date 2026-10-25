import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createFirstPartyCatalogBundle } from '../../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';
import { LiquidRenderer } from '../../../../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../../../packages/theme-engine/src/theme-settings.ts';
import { LiquidThemePackageBundleSchema, buildLiquidThemePackagePersistencePayload, type LiquidThemePackageBundle } from '../../../../../../packages/theme-engine/src/theme-bundle.ts';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../../../../../../packages/theme-engine/src/theme-document.ts';
import { compilePortableToLiquidBundle } from '../../../../../../packages/theme-engine/src/portable-to-liquid.ts';
import { collectThemeTemplateValidationIssues } from '../../../../../../packages/theme-engine/src/index.ts';
import { validateFieldValue } from '../../../../../../packages/theme-engine/src/schema-field-extensions.ts';
import { buildProductFactPresentation } from '../../../../../../packages/commerce-core/src/product-fact-presentation.ts';

const require = createRequire(import.meta.url);
const root = new URL('../../../../../../', import.meta.url);
const { JSDOM } = createRequire(new URL('packages/theme-engine/package.json', root))('jsdom');
const { withPantryPresentationControls: overlay } = require('./src/pantry-presentation-controls.ts') as { withPantryPresentationControls: (b: LiquidThemePackageBundle) => LiquidThemePackageBundle };
const epoch = process.env.PANTRY_CONTROLS_EPOCH;
assert.ok(epoch && /^(initial01|corrected01|corrected02)$/.test(epoch), 'Use a finite new test epoch');
const artifacts = new URL(`test-results/${epoch}/`, import.meta.url);
assert.equal(existsSync(artifacts), false, 'Do not overwrite a completed epoch');
mkdirSync(artifacts, { recursive: true });
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const base = () => createFirstPartyCatalogBundle('letbuyy-refresh', { designVersion: '2.0.0', pantryVersion: '2.0.1' });
const proposed = () => overlay(base());
const observations: Record<string, unknown>[] = [];
const food = (storage: string | null = 'Keep sealed in a cool, dry place.', hasOptions = false) => ({
  id: '11111111-1005-4000-8000-000000000002', title: 'Source-only rice', price: 220, currency: 'INR',
  url: '/product/source-only-rice', images: [], featured_image: '', available: true, variants: [],
  options: hasOptions ? [{ name: 'Pack', values: ['Label only'] }] : [], has_options: hasOptions,
  ...buildProductFactPresentation({ facts: { food: { ingredients: 'Rice (100%).', allergens: { status: 'not_supplied' }, storage, netQuantity: { value: 1000, unit: 'g' } } }, priceMinor: 22000, hasVariants: hasOptions }),
});
type Key = 'index' | 'collection' | 'search' | 'product' | 'page' | 'customers/order';
const section = (b: LiquidThemePackageBundle, key: string, id: string) => b.templates[key].sections[id];
function only(b: LiquidThemePackageBundle, type: string, settings: Record<string, unknown> = {}) {
  b.templates.collection = { name: 'Private source section', layout: 'theme', order: ['subject'], sections: {
    subject: { type, settings, blocks: {}, block_order: [], disabled: false },
  } } as LiquidThemePackageBundle['templates'][string];
  return b;
}
async function render(b: LiquidThemePackageBundle, key: Key = 'collection', product = food()) {
  const products = [product];
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'pantry-source-controls', path: key === 'index' ? '/' : `/${key}`, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: b.package.slug, themeSettings: { ...DEFAULT_THEME_SETTINGS, ...b.config.settings_data.current }, sections: [] },
    routeTemplate: { id: key, type: key === 'customers/order' ? 'customer_order' : key, layoutKey: 'theme', sections: [] },
    liquidBundle: b, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Synthetic unpersisted Pantry' }, product,
      collection: { title: 'Source-only shelf', products, pagination: { page: 1 } },
      section_products: { subject: products, 'pantry-staples': products, 'pantry-pairings': products, 'pantry-related': products },
      page: { title: 'Storage and shelf-life guide', body_html: '<p>Read the supplied product label. Ask the merchant when guidance is missing.</p>' },
      buyer: { id: 'synthetic-unpersisted-buyer' }, order: { id: 'synthetic-unpersisted-order', number: 'SOURCE-ONLY', currency: 'INR', line_items: [], total: 0 },
    },
  });
  assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
  assert.deepEqual(result.warnings, []); assert.ok(result.liquid);
  const html = result.liquid.contentForLayout, style = result.liquid.headStyleText ?? '';
  const digest = sha(html + '\n' + style);
  if (!existsSync(new URL(`${digest}.json`, artifacts))) writeFileSync(new URL(`${digest}.json`, artifacts), JSON.stringify({ html, style }, null, 2));
  observations.push({ key, outputSha256: digest, htmlSha256: sha(html), styleSha256: sha(style), packageVersion: b.package.version });
  return { html, style };
}
function inspect(html: string, selector: string, fn: (element: Element) => unknown) {
  const dom = new JSDOM(html), element = dom.window.document.querySelector(selector); assert.ok(element, selector);
  try { return fn(element); } finally { dom.window.close(); }
}
function wire(b: LiquidThemePackageBundle) {
  const manifest = buildLiquidThemePackagePersistencePayload(b).schemaManifest;
  const templateConfig = JSON.parse(JSON.stringify({ themeId: b.package.slug, schema_version: b.schema_version, engineVersion: b.renderer.renderer_version, rendererEngine: 'liquid', liquidBundle: b, sections: {}, templates: b.templates, themeSettings: b.config.settings_data.current }));
  return { templateConfig, runtime: { sectionSchemas: manifest.section_schemas, settingsSchema: manifest.settings_schema } };
}

test('PNCTRL01: private overlay preserves merchant values and identity, is immutable/idempotent, and has no catalogue dispatch', () => {
  const b = base(); section(b, 'index', 'pantry-hero').settings.heading = 'Saved merchant heading'; b.config.settings_data.current.primaryColor = '#123456'; b.package.checksum = '1'.repeat(64);
  const before = structuredClone(b), next = overlay(b); assert.deepEqual(b, before); assert.deepEqual(next.templates, b.templates); assert.equal(next.package.version, '2.0.1'); assert.equal(next.package.slug, b.package.slug); assert.equal(next.package.checksum, undefined); assert.equal(next.config.settings_data.current.primaryColor, '#123456');
  assert.deepEqual(overlay(next), next); assert.notEqual(overlay(next), next);
  assert.equal(base().config.settings_schema.settings.typography.fields.pantryTextScale, undefined);
});

test('PNCTRL02: descriptors and actual JSON/document/portable roundtrip preserve selected modes and explicit false', () => {
  const b = proposed(); section(b, 'collection', 'pantry-results').settings = { shelfColumns: 'one', showCardStorage: false }; section(b, 'product', 'pantry-selection').settings.layout = 'stacked'; b.config.settings_data.current.pantryTextScale = 'comfortable';
  const { templateConfig, runtime } = wire(b); assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig, runtime, themeSlug: b.package.slug }), []);
  assert.deepEqual(fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(b)))), b);
  const compiled = compilePortableToLiquidBundle(templateConfig, { baseBundle: b }); assert.deepEqual(compiled.warnings, []); assert.deepEqual(compiled.bundle.templates, b.templates); assert.equal(compiled.bundle.config.settings_data.current.pantryTextScale, 'comfortable');
  assert.equal(LiquidThemePackageBundleSchema.safeParse(b).success, true);
});

test('PNCTRL03: canonical validation rejects arbitrary layout/scale and nonboolean card values', () => {
  const b = proposed();
  for (const type of ['product-grid', 'collection-product-list', 'featured-products']) {
    const fields = b.sections[type].schema.settings;
    assert.equal(validateFieldValue(fields.find(f => f.id === 'shelfColumns')!, 'one'), null);
    assert.match(validateFieldValue(fields.find(f => f.id === 'shelfColumns')!, 'repeat(99,1fr)')!, /declared options/);
    assert.equal(validateFieldValue(fields.find(f => f.id === 'showCardStorage')!, false), null);
    assert.match(validateFieldValue(fields.find(f => f.id === 'showCardStorage')!, 'true')!, /boolean/);
  }
  assert.match(validateFieldValue(b.sections['product-detail'].schema.settings.find(f => f.id === 'layout')!, 'absolute')!, /declared options/);
  assert.match(validateFieldValue(b.config.settings_schema.settings.typography.fields.pantryTextScale, '999px;display:none')!, /declared options/);
  section(b, 'product', 'pantry-selection').settings.layout = 'absolute';
  const { templateConfig, runtime } = wire(b); assert.ok(collectThemeTemplateValidationIssues({ templateConfig, runtime, themeSlug: b.package.slug }).length > 0);
});

test('PNCTRL04: default body and sanitized stylesheet are identical on six representative existing routes', async () => {
  for (const key of ['index', 'collection', 'search', 'product', 'page', 'customers/order'] as const) assert.deepEqual(await render(proposed(), key), await render(base(), key), key);
});

test('PNCTRL05: all three listing sections actually change to one column and restore responsive defaults', async () => {
  for (const type of ['product-grid', 'collection-product-list', 'featured-products']) {
    const b = only(proposed(), type, { shelfColumns: 'one', requireSelection: false });
    const one = await render(b); assert.equal(inspect(one.html, '.pn-product-list', e => e.classList.contains('pn-product-list--one')), true);
    assert.match(one.style, /\.pn-theme \.pn-product-list--one\{grid-template-columns:minmax\(0,1fr\)\}/);
    section(b, 'collection', 'subject').settings.shelfColumns = 'responsive'; const restored = await render(b);
    assert.equal(inspect(restored.html, '.pn-product-list', e => e.hasAttribute('style')), false);
    assert.equal(inspect(restored.html, '.pn-product-list', e => e.classList.contains('pn-product-list--one')), false);
    assert.doesNotMatch(restored.style, /\.pn-product-list--one/);
    assert.match(restored.style, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/); assert.match(restored.style, /max-width:900px/);
  }
});

test('PNCTRL06: optional card storage uses the validated fact, escapes markup, and preserves authoritative card text', async () => {
  const hostile = '<img src=x onerror=attack()> Keep dry — चावल';
  for (const type of ['product-grid', 'collection-product-list', 'featured-products']) {
    const b = only(proposed(), type, { showCardStorage: false, requireSelection: false }), p = food(hostile);
    const off = await render(b, 'collection', p); section(b, 'collection', 'subject').settings.showCardStorage = true; const on = await render(b, 'collection', p);
    assert.equal(inspect(on.html, '.pn-card-storage', e => e.textContent), `Storage: ${hostile}`);
    assert.equal(inspect(on.html, '.pn-card', e => e.querySelector('script,img[src="x"],[onerror]')), null);
    for (const selector of ['.pn-card h3', '.pn-card-price', '.pn-card-net', '.pn-card .pn-link']) assert.equal(inspect(on.html, selector, e => e.textContent), inspect(off.html, selector, e => e.textContent));
    section(b, 'collection', 'subject').settings.showCardStorage = false; assert.deepEqual(await render(b, 'collection', p), off);
  }
});

test('PNCTRL07: absent storage stays absent and a label-only variant never gains fabricated net or unit facts', async () => {
  const b = only(proposed(), 'product-grid', { showCardStorage: true });
  const absent = await render(b, 'collection', food(null)); assert.equal(inspect(absent.html, '.pn-card', e => e.querySelector('.pn-card-storage')), null);
  const unknown = await render(b, 'collection', food('Merchant storage text.', true));
  assert.equal(inspect(unknown.html, '.pn-card-net', e => e.textContent), 'Choose a pack to check its net quantity');
  assert.equal(inspect(unknown.html, '.pn-card', e => /1000|\/ 100/.test(e.textContent ?? '')), false);
});

test('PNCTRL08: stacked PDP uses the existing composition and keeps critical facts before purchase without changing product authority', async () => {
  const b = proposed(), p = food(); const normal = await render(b, 'product', p);
  section(b, 'product', 'pantry-selection').settings.layout = 'stacked'; const stacked = await render(b, 'product', p);
  assert.equal(inspect(stacked.html, '.pn-product-layout', e => e.classList.contains('pn-product-layout--stacked')), true);
  assert.match(stacked.style, /\.pn-theme \.pn-product-layout\.pn-product-layout--stacked\{display:flex;flex-direction:column;align-items:stretch\}/);
  assert.match(stacked.style, /\.pn-product-layout--stacked>\*\{width:100%\}/);
  assert.equal(inspect(stacked.html, '.pn-product-layout', e => [...e.children].findIndex(x => x.classList.contains('pn-food-facts')) < [...e.children].findIndex(x => x.classList.contains('lb-product-detail__info'))), true);
  for (const selector of ['.pn-food-facts', '.lb-product-detail__info', '[data-lb-food-presentation]']) assert.equal(inspect(stacked.html, selector, e => e.innerHTML), inspect(normal.html, selector, e => e.innerHTML));
  assert.match(stacked.html, /Unknown is not allergen-free/);
  section(b, 'product', 'pantry-selection').settings.layout = 'ingredients'; assert.deepEqual(await render(b, 'product', p), normal);
});

test('PNCTRL09: bounded comfortable scale survives the real head CSS sanitizer and clears back to exact default', async () => {
  const b = proposed(), standard = await render(b, 'product'); b.config.settings_data.current.pantryTextScale = 'comfortable'; const comfortable = await render(b, 'product');
  assert.equal(comfortable.html, standard.html); assert.notEqual(comfortable.style, standard.style);
  assert.match(comfortable.style, /\.pn-theme\{font-size:18px\}/); assert.match(comfortable.style, /\.pn-theme h1\{font-size:clamp\(2\.25rem,4\.5vw,3\.375rem\)\}/);
  assert.match(comfortable.style, /\.pn-theme \.pn-card h3\{font-size:1\.18125rem\}/);
  assert.equal(b.config.settings_data.current.headingFontFamily, 'Inter'); assert.equal(b.config.settings_data.current.bodyFontFamily, 'Inter');
  b.config.settings_data.current.pantryTextScale = 'standard'; assert.deepEqual(await render(b, 'product'), standard);
});

test('PNCTRL10: a link-only merchant guide now renders the existing safe single-segment CMS route; original gate is inert', async () => {
  const settings = { title: 'Storage and shelf-life guide', content: '', image: '', linkLabel: 'Read merchant guidance', linkUrl: '/storage-and-shelf-life' };
  const before = await render(only(base(), 'about-section', settings)), after = await render(only(proposed(), 'about-section', settings));
  assert.equal(inspect(before.html, '[data-section-id="subject"]', e => e.querySelector('a')), null);
  assert.equal(inspect(after.html, '[data-section-id="subject"] .pn-link', e => e.getAttribute('href')), '/store/pantry-source-controls/storage-and-shelf-life');
  const route = readFileSync(new URL('apps/commerce/web/src/app/store/[subdomain]/[...path]/page.tsx', root), 'utf8');
  assert.match(route, /path\.length !== 1/); assert.match(route, /ContentService\.getPageBySlug\(subdomain, slug\)/);
  const page = await render(proposed(), 'page'); assert.match(page.html, /Read the supplied product label/); assert.doesNotMatch(page.html, /expires|expiry date|best before 20/i);
});

test('PNCTRL11: incomplete/cleared guide pairs stay empty; the existing canonical URL validator rejects executable destinations', async () => {
  for (const [linkLabel, linkUrl] of [['', '/storage-and-shelf-life'], ['Read guidance', ''], ['', '']]) {
    const output = await render(only(proposed(), 'about-section', { content: '', image: '', linkLabel, linkUrl }));
    assert.equal(inspect(output.html, '[data-section-id="subject"]', e => e.querySelector('.pn-feature')), null);
  }
  const field = proposed().sections['about-section'].schema.settings.find(f => f.id === 'linkUrl')!;
  assert.ok(validateFieldValue(field, 'javascript:alert(1)'));
});

test('PNCTRL12: wrong package and partially applied source are refused rather than silently republishing captured source', () => {
  const old = base(); old.package.version = '2.0.0'; assert.throws(() => overlay(old), /2\.0\.1/);
  const partial = proposed(); partial.sections['product-grid'].source = base().sections['product-grid'].source; const before = JSON.stringify(partial); assert.throws(() => overlay(partial), /partial/); assert.equal(JSON.stringify(partial), before);
});

test.after(() => writeFileSync(new URL('renders.json', artifacts), JSON.stringify({ recordedAt: new Date().toISOString(), classification: 'PRIVATE_SOURCE_SCHEMA_LIQUID_ONLY_NOT_INSTALLED_BROWSER_ORDER_OR_PROVIDER_ACCEPTANCE', syntheticUnpersistedProductsOrders: true, liveEffects: 0, observations }, null, 2) + '\n'));
