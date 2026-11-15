import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createPantryTheme, PANTRY_CATALOG_ID } from '../src/pantry-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';
import { PANTRY_CSS } from '../src/pantry-styles';
import { buildLiquidThemePackagePersistencePayload } from '../src/theme-bundle';
import { collectThemeTemplateValidationIssues, type ThemeTemplateValidationRuntime } from '../src/index';
import { compilePortableToLiquidBundle } from '../src/portable-to-liquid';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';

const food = { ingredients: 'Split red lentils (100%).', allergens: { status: 'not_supplied' }, storage: 'Keep cool and dry.', preparation: 'Rinse before cooking.', nutritionText: null, netQuantityValue: 250, netQuantityUnit: 'g', unitPriceMinor: 7200, basisQuantity: 100 };
const product = { id: 'lentils-250', title: 'Split red lentils', price: 180, currency: 'INR', url: '/product/lentils-250', images: ['/theme-assets/pantry/v2/red-lentils.webp'], featured_image: '/theme-assets/pantry/v2/red-lentils.webp', available: true, options: [], variants: [], food };
type Bundle = ReturnType<typeof createPantryTheme>;
async function render(key: string, options: { bundle?: Bundle; item?: Record<string, unknown>; products?: Record<string, unknown>[]; extra?: Record<string, unknown>; collection?: Record<string, unknown>; previewMode?: boolean } = {}) {
  const item = options.item ?? product;
  const products = options.products ?? [item];
  return new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'pantry-test', path: key === 'collection' ? '/products' : '/', previewMode: options.previewMode ?? true, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-refresh', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: options.bundle ?? createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture()), liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Synthetic Pantry' }, product: item, collection: { title: 'Everyday staples', products, ...options.collection }, section_products: { 'pantry-staples': products, 'pantry-results': products }, ...options.extra },
  });
}

test('pure Pantry factory preserves v1 input and stable identity while creating a distinct complete package', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture(); const before = structuredClone(base); const b = createPantryTheme(base);
  assert.deepEqual(base, before);
  assert.equal(b.package.slug, 'letbuyy-refresh'); assert.equal(b.package.name, 'Pantry'); assert.equal(b.package.version, '2.0.0');
  assert.equal(PANTRY_CATALOG_ID, '7b669c70-0000-4000-8000-000000000005');
  assert.deepEqual(b.templates.index.order.map(id => b.templates.index.sections[id].type), ['hero-banner', 'category-grid', 'product-grid', 'about-section', 'featured-products', 'trust-badges']);
  assert.notDeepEqual(b.templates.index.order, base.templates.index.order);
  for (const key of Object.keys(base.templates).filter(k => !['index', 'product', 'collection'].includes(k))) assert.deepEqual(b.templates[key].order, base.templates[key].order, key);
  assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(b)), b);
});
test('fresh Pantry defaults pass matching manifest validation before normalization and after JSON/document roundtrip', () => {
  for (const bundle of [createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture()), createFirstPartyCatalogBundle('letbuyy-refresh', { designVersion: '2.0.0' })]) {
    const manifest = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
    const runtime: ThemeTemplateValidationRuntime = {
      sectionSchemas: manifest.section_schemas as ThemeTemplateValidationRuntime['sectionSchemas'],
      settingsSchema: manifest.settings_schema as ThemeTemplateValidationRuntime['settingsSchema'],
    };
    // Registry's Liquid template projection, before editor normalization.
    const config = { themeId: bundle.package.slug, schema_version: bundle.schema_version, engineVersion: bundle.renderer.renderer_version,
      rendererEngine: 'liquid', liquidBundle: bundle, sections: {}, templates: bundle.templates, themeSettings: bundle.config.settings_data.current };
    const issues = (templateConfig: Record<string, unknown>) => collectThemeTemplateValidationIssues({ templateConfig, runtime, trustedPreviousConfig: { templates: bundle.templates }, themeSlug: bundle.package.slug });
    assert.deepEqual(issues(config), []);
    const wire = JSON.parse(JSON.stringify(config)) as typeof config;
    assert.deepEqual(issues(wire), []);
    const roundtrip = fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(bundle))));
    assert.deepEqual(roundtrip, bundle);
    assert.deepEqual(issues({ ...wire, liquidBundle: roundtrip, templates: roundtrip.templates }), []);
    const compiled = compilePortableToLiquidBundle(wire, { baseBundle: bundle });
    assert.deepEqual(compiled.warnings, []);
    assert.deepEqual(compiled.bundle.templates, bundle.templates);
    const collectionIndex = bundle.templates['list-collections'];
    assert.equal(collectionIndex.sections['list-collections-grid'].settings.title, 'All collections');
    assert.equal(Object.hasOwn(collectionIndex.sections['list-collections-grid'].settings, 'subtitle'), false);
    assert.deepEqual(Object.keys(bundle.templates), Object.keys(createLetbuyyCoreLiquidThemeBundleFixture().templates));
    // Merchant data stays intact and undeclared keys still fail the real validator.
    const invalid = structuredClone(wire);
    invalid.templates['list-collections'].sections['list-collections-grid'].settings.subtitle = 'Undeclared merchant text';
    assert.ok(issues(invalid).includes('templates.list-collections.sections.list-collections-grid.settings.subtitle is not defined by the category-grid schema'));
    assert.equal(invalid.templates['list-collections'].sections['list-collections-grid'].settings.subtitle, 'Undeclared merchant text');
  }
});
test('real Liquid home and collection render product identity as grocery shelf rows, not an unrelated demo', async () => {
  for (const key of ['index', 'collection']) {
    const r = await render(key); assert.equal(r.status, 'rendered', JSON.stringify(r.warnings)); assert.deepEqual(r.warnings, []);
    assert.match(r.liquid!.contentForLayout, /pn-product-list/); assert.match(r.liquid!.contentForLayout, /Split red lentils/);
    assert.match(r.liquid!.contentForLayout, /250 g net per pack/); assert.match(r.liquid!.contentForLayout, /72\.00/);
    assert.doesNotMatch(r.liquid!.contentForLayout, /Same.day delivery|Organic grocery|farm to table|sneaker|Rated|★/i);
    assert.match(r.liquid!.headStyleText!, /\.pn-hero/);
  }
});
test('food facts and unknown allergens precede canonical selection/purchase islands with explicit contents', async () => {
  const r = await render('product'); const h = r.liquid!.contentForLayout;
  assert.equal(r.status, 'rendered', JSON.stringify(r.warnings)); assert.match(h, /Split red lentils \(100%\)/); assert.match(h, /Unknown is not allergen-free/);
  assert.ok(h.indexOf('Allergen information') < h.indexOf('data-lb-add-to-cart'));
  assert.match(h, /250 g net per pack/); assert.match(h, /Number of packs/); assert.match(h, /name="quantity"/); assert.match(h, /<lb-add-to-cart/);
  assert.doesNotMatch(h, /data-lb-buy-now/); assert.match(h, /Rinse before cooking/);
});
test('absent food facts stay unknown; no shipping weight or descriptive label is inferred as net contents', async () => {
  const r = await render('product', { item: { ...product, title: 'Mystery staple 250g', food: undefined, weight: 250, weight_unit: 'g' } });
  assert.equal(r.status, 'rendered'); const h = r.liquid!.contentForLayout;
  assert.match(h, /Not supplied by the merchant/); assert.match(h, /Net quantity not supplied/);
  assert.doesNotMatch(h, /250 g net per pack|72\.00.*100 g/);
});
test('merchant food facts and resource text cannot inject executable markup', async () => {
  const r = await render('product', { item: { ...product, title: '<script>titleAttack()</script>', food: { ...food, ingredients: '<img src=x onerror="attack()">', allergens: { status: 'supplied', statement: '<script>attack()</script>', source: '<b>Package</b>' } } } });
  assert.equal(r.status, 'rendered'); const h = r.liquid!.contentForLayout;
  const dom = new JSDOM(h); assert.equal(dom.window.document.querySelector('script,[onerror],img[src="x"]'), null); assert.match(h, /&lt;script&gt;|&lt;img/);
});
test('explicit projected variant food scalars survive depth4 and remain bound to each actual option', async () => {
  const r = await render('product', { item: { ...product, options: [{ name: 'Pack', values: ['250 g', '500 g'] }], variants: [{ id: 'v250', name: '250 g', price: 180, stock: 3, options: { Pack: '250 g' }, food: { netQuantityValue: 250, netQuantityUnit: 'g', unitPriceMinor: 7200, basisQuantity: 100 } }, { id: 'v500', name: '500 g', price: 340, stock: 0, options: { Pack: '500 g' }, food: { netQuantityValue: 500, netQuantityUnit: 'g', unitPriceMinor: 6800, basisQuantity: 100 } }] } });
  assert.equal(r.status, 'rendered'); const h = r.liquid!.contentForLayout;
  assert.match(h, /<lb-variant-picker/); assert.match(h, /data-product-id="lentils-250"/); assert.match(h, /250 g net per pack/); assert.match(h, /500 g net per pack/); assert.match(h, /unavailable/); assert.match(h, /68\.00/);
  assert.match(h, /Net contents belong to the selected variant/); assert.doesNotMatch(h, /data-lb-food-net-quantity>250/);
});
test('unsupported food facets are absent; server-supplied facets and clear-one URL are rendered exactly', async () => {
  const absent = (await render('collection')).liquid!.contentForLayout;
  assert.doesNotMatch(absent, /name="pack_size"/);
  const r = await render('collection', { collection: { food_filters: { enabled: true, pack_sizes: [{ value: 'g:250', label: '250 g' }], sort_options: [{ value: 'price-asc', label: 'Price: low to high' }] }, active_filters: [{ key: 'pack_size', value: 'g:250', label: 'Pack size: 250 g', clear_url: '/products?search=lentils&min_price=100' }] } });
  assert.match(r.liquid!.contentForLayout, /name="pack_size"/); assert.match(r.liquid!.contentForLayout, /value="g:250"/); assert.match(r.liquid!.contentForLayout, /Remove pack filter/); assert.match(r.liquid!.contentForLayout, /search=lentils&amp;min_price=100/);
});
test('empty catalog is honest and pagination preserves server URLs without invented counts', async () => {
  const empty = await render('collection', { products: [] }); assert.match(empty.liquid!.contentForLayout, /No products found/); assert.doesNotMatch(empty.liquid!.contentForLayout, /Split red lentils/);
  const r = await render('collection', { collection: { pagination: { page: 2, previous_url: '/products?pack_size=g%3A250&page=1', next_url: '/products?pack_size=g%3A250&page=3' } } });
  assert.match(r.liquid!.contentForLayout, /Page 2/); assert.match(r.liquid!.contentForLayout, /pack_size=g%3A250&amp;page=3/);
});
test('merchant settings, note blocks and resource selections change real rendered output after document roundtrip', async () => {
  const b = createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  const doc = toThemeDocumentV2(b); doc.templates.find(t => t.key === 'index')!.sections.find(s => s.type === 'hero-banner')!.settings.heading = 'Merchant pantry introduction';
  const saved = fromThemeDocumentV2(doc); const hero = saved.templates.index.sections['pantry-hero'];
  hero.blocks = { 'merchant-note': { type: 'note', settings: { text: 'Merchant supplied note' }, disabled: false, blocks: {}, block_order: [] } }; hero.block_order = ['merchant-note'];
  const r = await render('index', { bundle: saved }); assert.equal(r.status, 'rendered'); assert.match(r.liquid!.contentForLayout, /Merchant pantry introduction/); assert.match(r.liquid!.contentForLayout, /Merchant supplied note/);
  const collections = [{ id: 'a', title: 'Lentils', handle: 'lentils' }, { id: 'b', title: 'Rice', handle: 'rice' }]; saved.templates.index.sections['pantry-shelves'].settings.collection1 = 'b';
  const selected = await render('index', { bundle: saved, extra: { collections } }); assert.match(selected.liquid!.contentForLayout, /\/collections\/rice/); assert.doesNotMatch(selected.liquid!.contentForLayout, /\/collections\/lentils/);
});
test('responsive presentation is scoped, reflows task zones and retains canonical cart/account behavior', () => {
  const b = createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture()); const base = createLetbuyyCoreLiquidThemeBundleFixture();
  assert.match(PANTRY_CSS, /max-width:1100px/); assert.match(PANTRY_CSS, /max-width:600px/); assert.match(PANTRY_CSS, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(PANTRY_CSS, /(?:^|\n)\s*(?:body|html|:root)\s*\{/);
  for (const key of ['cart', 'customer-account', 'customer-order', 'customer-addresses']) if (base.sections[key]) assert.ok(b.sections[key].source.includes(base.sections[key].source.split('{% schema %}')[0].trim()), key);
});

test('hero media/focal controls survive sanitization and clearing media removes the image', async () => {
  const b = createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  Object.assign(b.templates.index.sections['pantry-hero'].settings, { image: '/theme-assets/pantry/v2/staples-still-life.webp', imageAlt: 'Uncooked pantry staples', focalPoint: 'left' });
  const result = await render('index', { bundle: b });
  const dom = new JSDOM(result.liquid!.contentForLayout); const img = dom.window.document.querySelector('.pn-hero img');
  assert.equal(img?.getAttribute('class'), 'pn-focal-left'); assert.equal(img?.getAttribute('alt'), 'Uncooked pantry staples');
  assert.equal(img?.hasAttribute('style'), false); assert.match(result.liquid!.headStyleText!, /pn-focal-left\s*\{object-position:left/);
  b.templates.index.sections['pantry-hero'].settings.image = '';
  const cleared = await render('index', { bundle: b }); assert.equal(new JSDOM(cleared.liquid!.contentForLayout).window.document.querySelector('.pn-hero img'), null);
});

test('variant missing food facts stays unknown and never inherits the product pack or unit value', async () => {
  const r = await render('product', { item: {
    ...product,
    food: { ...food, netQuantityValue: 999, netQuantityUnit: 'ml', unitPriceMinor: 4444, basisQuantity: 100 },
    options: [{ name: 'Pack', values: ['Known pack', 'Unspecified pack'] }],
    variants: [
      { id: 'known-pack', name: 'Known pack', price: 180, stock: 3, options: { Pack: 'Known pack' }, food: { netQuantityValue: 250, netQuantityUnit: 'g', unitPriceMinor: 7200, basisQuantity: 100 } },
      { id: 'missing-pack', name: 'Unspecified pack', price: 180, stock: 3, options: { Pack: 'Unspecified pack' } },
    ],
  } });
  assert.equal(r.status, 'rendered');
  const dom = new JSDOM(r.liquid!.contentForLayout);
  const rows = [...dom.window.document.querySelectorAll('.pn-pack-options li')];
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent!, /Known pack: 250 g net per pack/);
  assert.match(rows[1].textContent!, /Unspecified pack: net quantity not supplied/);
  assert.doesNotMatch(rows[1].textContent!, /250|999|44\.44|72\.00/);
  assert.equal(dom.window.document.querySelector('[data-lb-food-net-quantity]'), null);
  assert.equal(dom.window.document.querySelector('[data-lb-food-unit-price]'), null);
  assert.doesNotMatch(dom.window.document.querySelector('.pn-net-info')!.textContent!, /999|ml|44\.44/);
});

test('actual Pantry note root exposes stable block identity only in editor preview', async () => {
  const bundle = createPantryTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  const hero = bundle.templates.index.sections['pantry-hero'];
  hero.blocks = { 'merchant-note': { type: 'note', settings: { text: 'Merchant supplied note' }, disabled: false, blocks: {}, block_order: [] } };
  hero.block_order = ['merchant-note'];
  const preview = await render('index', { bundle, previewMode: true });
  const previewDocument = new JSDOM(preview.liquid!.contentForLayout).window.document;
  assert.equal(previewDocument.querySelector('.pn-hero-copy > p[data-block-id="merchant-note"]')?.textContent, 'Merchant supplied note');
  const published = await render('index', { bundle, previewMode: false });
  const publishedDocument = new JSDOM(published.liquid!.contentForLayout).window.document;
  assert.equal(publishedDocument.querySelector('[data-block-id]'), null);
  assert.equal(publishedDocument.querySelector('.pn-hero-copy > p.pn-meta')?.textContent, 'Merchant supplied note');
});
