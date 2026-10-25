import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createHabitatTheme, HABITAT_VERSION } from '../src/habitat-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { fromThemeDocumentV2, toThemeDocumentV2 } from '../src/theme-document';

const variants = [
  { id: 'natural', title: 'Natural teak', price: 18900, stock: 3, options: { Finish: 'Natural teak' }, furniture_display: { package: '72 × 82 × 78 cm', weight: '13.8 kg' }, furniture: { finish: 'Natural teak', package: { unit: 'cm', width: 72, depth: 82, height: 78 }, weight: { value: 13.8, unit: 'kg' } } },
  { id: 'smoked', title: 'Smoked teak', price: 19900, stock: 0, options: { Finish: 'Smoked teak' }, furniture_display: { package: '74 × 84 × 78 cm', weight: '14.2 kg' }, furniture: { finish: 'Smoked teak', package: { unit: 'cm', width: 74, depth: 84, height: 78 }, weight: { value: 14.2, unit: 'kg' } } },
];
const furniture = { assembled: { unit: 'cm', width: 68, depth: 78, height: 74 }, seat_height: { value: 38, unit: 'cm' }, materials: ['Solid teak', '<script>not executable</script>'], assembly: { status: 'assembled', tools: 'None' }, care: 'Keep dry.' };
const chair = { id: 'chair', title: 'Aara lounge chair', url: '/product/chair', price: 18900, currency: 'INR', stock: 3, available: true, featured_image: '/catalog/chair.webp', images: ['/catalog/chair.webp', '/catalog/room.webp'], options: [{ name: 'Finish', values: ['Natural teak', 'Smoked teak'] }], variants, furniture };
const rooms = [{ id: 'living', handle: 'living-room', title: 'Living' }, { id: 'work', handle: 'work-room', title: 'Work' }];
async function render(key: string, bundle = createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture()), product: Record<string, unknown> = chair, extra: Record<string, unknown> = {}, previewMode = true) {
  return new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'habitat-owned-unit', path: key === 'collection' ? '/collections/living' : '/', previewMode, locale: 'en-IN', searchParams: { search: 'teak', finish: 'Natural teak', max_width_cm: '70', sort: 'display_order' } },
    storeTemplate: { themeId: 'letbuyy-craft', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Owned synthetic Habitat', id: 'site', subdomain: 'habitat-owned-unit', policies: ['shipping'] }, product, collections: rooms, collection: { title: 'Living room', products: [product], total: 1, pagination: { page: 1, next_url: '/collections/living?page=2' } }, section_products: { 'habitat-living-objects': [product], 'habitat-collection-objects': [product] }, ...extra },
  });
}
test('pure Habitat factory versions stable Craft and preserves old input plus canonical routes', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture(); const before = structuredClone(base); const bundle = createHabitatTheme(base);
  assert.deepEqual(base, before); assert.equal(HABITAT_VERSION, '2.0.0'); assert.equal(bundle.package.slug, 'letbuyy-craft'); assert.equal(bundle.package.name, 'Habitat'); assert.equal(bundle.package.version, '2.0.0');
  assert.notDeepEqual(bundle.templates.index.order, base.templates.index.order);
  for (const key of Object.keys(base.templates).filter(key => !['index', 'product', 'collection', 'header'].includes(key))) assert.deepEqual(bundle.templates[key], base.templates[key], key);
  assert.deepEqual(bundle.templates.header.order, base.templates.header.order);
  assert.deepEqual(bundle.templates.header.sections['header-default'], base.templates.header.sections['header-default']);
  assert.deepEqual(bundle, fromThemeDocumentV2(toThemeDocumentV2(bundle)));
  assert.equal(bundle.config.settings_data.current.headingFontFamily, 'Libre Baskerville');
  assert.equal(bundle.config.settings_data.current.bodyFontFamily, 'Source Sans Pro');
  assert.doesNotMatch(JSON.stringify(bundle.config.settings_data.current), /Aara|Nila|18900|theme-assets\/habitat/);
});
test('actual Liquid home and collection render real identities, numeric dimensions and safe empty states', async () => {
  for (const key of ['index', 'collection']) {
    const result = await render(key); assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
    const html = result.liquid!.contentForLayout; assert.match(html, /Aara lounge chair/); assert.match(html, /68 W × 78 D/); assert.match(html, /hab-grid/); assert.match(result.liquid!.headStyleText!, /\.hab-room-story/); assert.doesNotMatch(html, /<h[1-6]>\s*<\/h[1-6]>/);
  }
  const empty = await render('index', undefined, {}, { collection: { products: [] }, section_products: {}, collections: [] });
  assert.equal(empty.status, 'rendered'); assert.match(empty.liquid!.contentForLayout, /No pieces found/); assert.match(empty.liquid!.contentForLayout, /Collections supplied by this store/);
  assert.doesNotMatch(empty.liquid!.contentForLayout, /Handcrafted|guaranteed|certified|free delivery|rated 5/i);
});
test('PDP preserves canonical gallery/variant/cart/review islands with accessible supplied facts', async () => {
  const result = await render('product'); assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []); const html = result.liquid!.contentForLayout;
  for (const tag of ['lb-product-gallery', 'lb-variant-picker', 'lb-add-to-cart', 'lb-wishlist-toggle', 'lb-review-form']) assert.match(html, new RegExp(tag));
  assert.match(html, /Assembled width/); assert.match(html, /68 cm/); assert.match(html, /Schematic, not to scale/); assert.match(html, /data-variant-id="natural"/); assert.match(html, /data-variant-id="smoked"/); assert.match(html, /72 × 82 × 78 cm/); assert.match(html, /74 × 84 × 78 cm/);
  assert.match(html, /Natural teak/); assert.match(html, /Smoked teak/); assert.match(html, /Arrives assembled/); assert.match(html, /data-lb-add-to-cart/); assert.doesNotMatch(html, /data-lb-buy-now/);
  assert.match(html, /not executable/); assert.doesNotMatch(html, /<script|onerror=/i); assert.match(html, /delivery date is not available/i);
});
test('missing facts/media never become invented sizes/materials/delivery promises', async () => {
  const result = await render('product', undefined, { ...chair, furniture: undefined, variants: [], images: [], options: [] });
  assert.equal(result.status, 'rendered'); const html = result.liquid!.contentForLayout;
  assert.match(html, /Assembled dimensions not supplied/); assert.match(html, /Material information not supplied/); assert.match(html, /Assembly information not supplied/);
  assert.doesNotMatch(html, /68 cm|Solid teak|Arrives assembled|hab-pdp-room|hab-dimension-box/);
});
test('merchant content/resource settings survive document roundtrip and change actual output', async () => {
  const initial = createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture()); const doc = toThemeDocumentV2(initial);
  const hero = doc.templates.find(t => t.key === 'index')!.sections.find(s => s.type === 'hero-banner')!;
  Object.assign(hero.settings, { heading: 'My merchant room story', collection1: 'work', collection2: 'living', image: '/merchant/room.webp', imageAlt: 'A merchant supplied room', caption: 'My room photograph' });
  const material = doc.templates.find(t => t.key === 'index')!.sections.find(s => s.type === 'about-section')!; Object.assign(material.settings, { title: 'My material story', content: 'Merchant supplied facts only.' });
  const saved = fromThemeDocumentV2(doc); const result = await render('index', saved); const html = result.liquid!.contentForLayout;
  assert.equal(result.status, 'rendered'); assert.match(html, /My merchant room story/); assert.match(html, /\/merchant\/room.webp/); assert.match(html, /Merchant supplied facts only/); assert.ok(html.indexOf('/work-room') < html.indexOf('/living-room'));
  assert.doesNotMatch((await render('index', initial)).liquid!.contentForLayout, /My merchant room story/);
  material.settings.content = ''; material.settings.image = ''; const cleared = await render('index', fromThemeDocumentV2(doc)); assert.doesNotMatch(cleared.liquid!.contentForLayout, /My material story/);
});
test('furniture filters require real server capability and preserve supported search/query values', async () => {
  const unsupported = (await render('collection')).liquid!.contentForLayout; assert.doesNotMatch(unsupported, /name="max_width_cm"/); assert.match(unsupported, /name="search" value="teak"/);
  const supported = (await render('collection', undefined, chair, { collection: { title: 'Living', products: [chair], measurement_capabilities: { equipment_length: { available: false, allowed_units: [] }, max_width_cm: { available: true }, max_depth_cm: { available: false } }, furniture_filters_available: true, furniture_facets: [{ key: 'finish', value: 'Smoked teak', label: 'Smoked teak', count: 1 }], active_filters: [{ label: 'Maximum width: 70 cm', clear_url: '/collections/living?search=teak&finish=Natural%20teak&sort=display_order' }], total: 1, pagination: { page: 1, next_url: '/collections/living?page=2' } } })).liquid!.contentForLayout;
  assert.match(supported, /name="max_width_cm" value="70"/); assert.equal(new JSDOM(supported).window.document.querySelector<HTMLSelectElement>('[name="finish"]')!.value, 'Natural teak'); assert.match(supported, /<option value="Smoked teak">/); assert.doesNotMatch(supported, /name="max_depth_cm"/); assert.match(supported, /Next →/); assert.match(supported, /Remove Maximum width: 70 cm/); assert.match(supported, /search=teak&amp;finish=Natural%20teak&amp;sort=display_order/);
});
test('related furniture requires explicit canonical section products and never invents bundles', async () => {
  const none = (await render('product')).liquid!.contentForLayout; assert.doesNotMatch(none, /A place for the small things/);
  const result = await render('product', undefined, chair, { section_products: { 'habitat-related-objects': [{ ...chair, id: 'table', title: 'Nila side table', url: '/product/table', furniture: { assembled: { unit: 'cm', diameter: 50, height: 42 } } }] } });
  const html = result.liquid!.contentForLayout; assert.match(html, /Nila side table/); assert.match(html, /50 Ø × 42 H cm/); assert.match(html, /Each piece is sold separately/); assert.doesNotMatch(html, /Add bundle|bundle discount|free delivery/i);
});
test('scoped responsive and reduced-motion contracts retain one-column furniture on small screens', () => {
  const css = createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture()).layout.theme.source;
  assert.match(css, /@media\(max-width:600px\)/); assert.match(css, /\.hab-grid\{grid-template-columns:1fr/); assert.match(css, /@media\(prefers-reduced-motion:reduce\)/); assert.doesNotMatch(css, /\.tl-theme|position:fixed/);
});

test('nested variant facts require a bounded display projection; renderer depth cap stays intact', async () => {
  const rawVariants = variants.map(({ furniture_display: _view, ...variant }) => variant);
  const raw = await render('product', undefined, { ...chair, variants: rawVariants });
  assert.equal(raw.status, 'rendered');
  const rawDocument = new JSDOM(raw.liquid!.contentForLayout).window.document;
  assert.match(rawDocument.querySelector('[data-variant-id="natural"]')!.textContent!, /Package dimensions not supplied/);
  const projected = new JSDOM((await render('product')).liquid!.contentForLayout).window.document;
  assert.match(projected.querySelector('[data-variant-id="natural"]')!.textContent!, /72 × 82 × 78 cm/);
});

test('room context is an explicit merchant media choice, never inferred from a second photo', async () => {
  const bundle = createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  assert.doesNotMatch((await render('product', bundle)).liquid!.contentForLayout, /hab-pdp-room/);
  bundle.templates.product.sections['habitat-product-selection'].settings.showRoomContext = true;
  assert.match((await render('product', bundle)).liquid!.contentForLayout, /class="hab-pdp-room"/);
});

test('declared product display projection renders supplied measures without inventing missing raw material', async () => {
  const result = await render('product', undefined, { ...chair, furniture: undefined, variants: [], furniture_display: { assembled: '68 W × 78 D × 74 H cm', package: '72 × 82 × 78 cm', weight: '13.8 kg', seat_height: '38 cm' } });
  assert.equal(result.status, 'rendered'); const html = result.liquid!.contentForLayout;
  assert.match(html, /data-lb-furniture-field="assembled"/); assert.match(html, /72 × 82 × 78 cm/); assert.match(html, /13.8 kg/); assert.match(html, /38 cm/); assert.match(html, /Material information not supplied/);
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('[data-lb-furniture-field="assembled"]')?.textContent, '68 W × 78 D × 74 H cm');
  assert.equal(document.querySelector('.hab-dimension-box'), null);
});

test('current finish panel follows the real picker, precedes purchase and starts with explicit common/unknown facts', async () => {
  const result = await render('product', undefined, { ...chair, furniture_display: { assembled: '68 W × 78 D × 74 H cm', materials: 'Product teak' } });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
  const document = new JSDOM(result.liquid!.contentForLayout).window.document;
  const panel = document.querySelector('[data-lb-variant-facts][data-lb-facts-namespace="furniture"]')!;
  const picker = document.querySelector('lb-variant-picker')!;
  assert.ok(picker.compareDocumentPosition(panel) & 4);
  assert.ok(panel.compareDocumentPosition(document.querySelector('lb-add-to-cart')!) & 4);
  assert.equal(panel.getAttribute('data-product-id'), chair.id);
  assert.equal(panel.getAttribute('data-lb-variant-facts-state'), 'common');
  assert.match(panel.querySelector('[data-lb-variant-facts-status]')!.textContent!, /Common product facts.*select all finish options/);
  assert.equal(panel.querySelectorAll('[data-lb-furniture-field]').length, 7);
  assert.equal(panel.querySelector('[data-lb-furniture-field="assembled"]')!.textContent, '68 W × 78 D × 74 H cm');
  for (const key of ['package', 'weight', 'seat_height', 'assembly', 'care']) assert.match(panel.querySelector(`[data-lb-furniture-field="${key}"]`)!.textContent!, /not supplied/i);
  assert.equal(document.querySelectorAll('[data-lb-variant-facts-row]').length, 2, 'Named options remain readable without a controller');
  assert.match(document.querySelector('.hab-quick-facts')!.textContent!, /Common product dimensions/);
  assert.match(document.querySelector('.hab-dimension-box')!.getAttribute('aria-label')!, /Common product/);
  assert.match(document.querySelector('.hab-facts')!.textContent!, /no access or fit is guaranteed/);
});

test('retained addable FAQ and standalone badge keep exact preview IDs on native roots, absent publicly', async () => {
  const bundle = createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  assert.equal(bundle.templates.index.sections['habitat-measurement-guide'].type, 'habitat-measurement-guide');
  assert.ok(bundle.sections['faq-accordion'].schema.blocks.some(block => block.type === 'faq-item'));
  const examples = [
    { type: 'faq-accordion', blockType: 'faq-item', selector: '.lb-faq-accordion__item', tag: 'DETAILS', settings: { question: 'Same question', answer: 'Merchant supplied answer.' } },
    { type: 'spotlight', blockType: 'badge', selector: '.lb-badge', tag: 'SPAN', settings: { label: 'Same label' } },
  ];
  for (const example of examples) {
    const id = `added-${example.type}`;
    bundle.templates.index.sections[id] = { type: example.type, settings: { title: 'Merchant FAQ' }, blocks: Object.fromEntries(['identity-one', 'identity-two'].map(blockId => [blockId, { type: example.blockType, settings: example.settings, disabled: false, blocks: {}, block_order: [] }])), block_order: ['identity-one', 'identity-two'], disabled: false };
    bundle.templates.index.order.push(id);
  }
  const previewResult = await render('index', bundle, chair, {}, true);
  assert.equal(previewResult.status, 'rendered'); assert.deepEqual(previewResult.warnings, []);
  const preview = new JSDOM(previewResult.liquid!.contentForLayout).window.document;
  const publicResult = await render('index', bundle, chair, {}, false);
  assert.equal(publicResult.status, 'rendered'); assert.deepEqual(publicResult.warnings, []);
  const published = new JSDOM(publicResult.liquid!.contentForLayout).window.document;
  for (const example of examples) {
    const roots = [...preview.querySelectorAll(example.selector)];
    assert.deepEqual(roots.map(element => element.getAttribute('data-block-id')), ['identity-one', 'identity-two']);
    assert.ok(roots.every(element => element.tagName === example.tag), 'No wrapper replaces the semantic root');
    assert.equal(published.querySelectorAll(example.selector).length, 2);
  }
  assert.equal(published.querySelector('[data-block-id]'), null);
});
