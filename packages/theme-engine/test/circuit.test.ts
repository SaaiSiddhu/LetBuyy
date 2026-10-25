import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createCircuitTheme, CIRCUIT_VERSION } from '../src/circuit-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';
import { buildLiquidThemePackagePersistencePayload } from '../src/theme-bundle';
import { collectThemeTemplateValidationIssues, type ThemeTemplateValidationRuntime } from '../src/index';

const electronics = { version: 1, manufacturer: 'Nodeworks', model: 'CG-7', kind: 'hub', power_input_w: 100, pass_through_output_w: 85, data_rate_mbps: 5000, length_mm: 100, video: { width_px: 3840, height_px: 2160, refresh_hz: 30 }, dimensions_mm: { length: 115, width: 43, height: 15 }, connectors: [{ kind: 'usb-c', role: 'host', count: 1 }], host_requirements: ['DisplayPort Alt Mode for HDMI'], box_contents: [{ label: 'CG-7 hub', quantity: 1 }], fact_sheet: { reference: 'NW-CG7-F1', source_date: '2026-10-22' }, compatible_devices: [] };
const product = { id: 'cg7-real-id', title: 'CG-7 USB-C hub', price: 3490, currency: 'INR', url: '/product/cg7-real-id', images: ['/merchant/cg7.webp'], featured_image: '/merchant/cg7.webp', available: true, options: [{ name: 'Finish', values: ['Graphite', 'Silver'] }], variants: [{ id: 'durable-graphite-id', options: { Finish: 'Graphite' }, stock: 4 }], electronics };
async function render(key: string, bundle = createCircuitTheme(createLetbuyyCoreLiquidThemeBundleFixture()), overrides: Record<string, unknown> = {}, searchParams: Record<string, string> = {}, previewMode = true) {
  return new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'circuit-test', path: key === 'index' ? '/' : '/products', previewMode, locale: 'en-IN', searchParams },
    storeTemplate: { themeId: 'letbuyy-forge', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Merchant electronics' }, product, collections: [], collection: { products: [product], total: 1, pagination: { page: 1 } }, section_products: { 'forge-products-index': [product], 'forge-model-index': [product], 'forge-related-product': [product] }, ...overrides },
  });
}

test('Circuit is a pure versioned forge package with retained canonical routes and old-v1 bytes', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture(), original = structuredClone(base), bundle = createCircuitTheme(base);
  assert.deepEqual(base, original);
  assert.equal(bundle.package.slug, 'letbuyy-forge');assert.equal(bundle.package.version, CIRCUIT_VERSION);
  assert.equal(bundle.package.name, 'Circuit');assert.equal(Object.hasOwn(bundle.config.settings_data.current, 'experienceId'), false);
  assert.deepEqual(bundle.templates.index.order.map(id => bundle.templates.index.sections[id].type), ['category-grid', 'hero-banner', 'product-grid', 'about-section', 'trust-badges']);
  for (const key of ['cart', 'customers/login', 'customers/register', 'customers/account', 'customers/orders', 'customers/order', 'customers/addresses', 'contact', 'list-collections']) assert.deepEqual(bundle.templates[key], original.templates[key]);
  for (const key of ['customer-login', 'customer-register']) assert.deepEqual(bundle.sections[key], original.sections[key]);
  assert.deepEqual(createCircuitTheme(bundle), bundle);
  assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(bundle)), bundle);
});
test('fresh Circuit defaults pass the matching persisted manifest before normalization and after a real JSON document roundtrip', async () => {
  const bundle = createCircuitTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  const roundtrip = fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(bundle))));
  assert.deepEqual(roundtrip, bundle);
  for (const candidate of [bundle, roundtrip]) {
    const manifest = buildLiquidThemePackagePersistencePayload(candidate).schemaManifest;
    const runtime = { sectionSchemas: manifest.section_schemas, settingsSchema: manifest.settings_schema } as ThemeTemplateValidationRuntime;
    const config = { themeId: candidate.package.slug, sections: {}, templates: candidate.templates, themeSettings: candidate.config.settings_data.current, liquidBundle: candidate, rendererEngine: 'liquid' };
    for (const templateConfig of [config, JSON.parse(JSON.stringify(config))])
      assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig, runtime, themeSlug: candidate.package.slug }), []);
    const current = candidate.config.settings_data.current;
    assert.equal(current.headingFontFamily, 'Inter');assert.equal(current.bodyFontFamily, 'Inter');
    for (const key of ['headingFont', 'bodyFont', 'experienceId']) assert.equal(Object.hasOwn(current, key), false, key);
    assert.ok(candidate.config.settings_data.presets.Forge, 'experience remains an established named preset, separate from current settings');
  }
  const html = await render('index', roundtrip);
  assert.match(html.liquid!.headStyleText!, /var\(--font-main,Inter,Arial,sans-serif\)/);
  assert.match(html.liquid!.headStyleText!, /var\(--font-heading,Inter,Arial,sans-serif\)/);
});
test('real Liquid renders distinct retrieval/card/PDP structures and actual identity without invented claims', async () => {
  for (const key of ['index', 'collection', 'search', 'product']) {
    const result = await render(key);assert.equal(result.status, 'rendered');assert.deepEqual(result.warnings, []);
    assert.match(result.liquid!.headStyleText!, /\.ct-collection-grid/);
    assert.match(result.liquid!.contentForLayout, /CG-7 USB-C hub/);
    assert.doesNotMatch(result.liquid!.contentForLayout, /Free shipping|Limited time|certified|fits all|universal compatibility|compare-checkbox/i);
  }
  const detail = (await render('product')).liquid!.contentForLayout;
  assert.match(detail, /data-product-id="cg7-real-id"/);assert.match(detail, /durable-graphite-id/);
  assert.match(detail, /lb-product-gallery/);assert.match(detail, /lb-variant-picker/);assert.match(detail, /lb-add-to-cart/);
  assert.match(detail, /Unconfirmed/);assert.match(detail, /5000 Mb\/s/);assert.match(detail, /100 mm/);
  assert.match(detail, /Laptop pass-through maximum/);assert.match(detail, /85 W/);
  assert.match(detail, /Product fact sheet: NW-CG7-F1/);assert.doesNotMatch(detail, /data-lb-buy-now/);
  const chrome = new JSDOM((await render('index')).liquid!.header!);
  assert.equal(chrome.window.document.querySelector('a[href=""]'), null);
  assert.equal(chrome.window.document.querySelector('.lb-header__search-toggle'), null);
  chrome.window.close();
});
test('missing technical facts/media and empty catalog are honest and render usable navigation', async () => {
  const missing = { ...product, images: [], featured_image: '', electronics: null };
  const result = await render('product', undefined, { product: missing });
  assert.equal(result.status, 'rendered');assert.match(result.liquid!.contentForLayout, /Technical facts have not been supplied/);
  assert.match(result.liquid!.contentForLayout, /Unconfirmed/);
  const empty = await render('collection', undefined, { collection: { products: [] } });
  assert.match(empty.liquid!.contentForLayout, /No products match/);assert.doesNotMatch(empty.liquid!.contentForLayout, /ct-facets|name="connector"/);
  const cards = await render('collection', undefined, { collection: { products: [missing] } });
  assert.match(cards.liquid!.contentForLayout, /Product image not supplied/);assert.match(cards.liquid!.contentForLayout, /Technical facts not supplied/);
});
test('only explicitly server-enabled facets render, with actual values and provided page URLs', async () => {
  const result = await render('collection', undefined, { collection: { products: [product], capabilities: { electronics_filters: true }, electronics_facets: [{ key: 'connector', group_label: 'Connector present', value: 'usb-c', label: 'USB-C', count: 1, selected: true }], pagination: { page: 2, previous_url: '/products?connector=usb-c&page=1', next_url: '/products?connector=usb-c&page=3' } } });
  assert.match(result.liquid!.contentForLayout, /name="connector" value="usb-c" checked/);
  assert.match(result.liquid!.contentForLayout, /connector=usb-c(?:&amp;|&)page=3/);
  assert.match(result.liquid!.contentForLayout, /ct-desktop-facets/);assert.match(result.liquid!.contentForLayout, /ct-mobile-facets/);
});
test('native filter and sort submissions preserve the query and selections while resetting pagination', async () => {
  const collection = { products: [product], capabilities: { electronics_filters: true },
    electronics_facets: [
      { key: 'connector', group_label: 'Connector present', value: 'usb-c', label: 'USB-C', selected: true },
      { key: 'connector', group_label: 'Connector present', value: 'usb-a', label: 'USB-A', selected: false },
      { key: 'electronics_kind', group_label: 'Product type', value: 'hub', label: 'Hub', selected: true },
      { key: 'electronics_kind', group_label: 'Product type', value: 'charger', label: 'Charger', selected: false },
    ], discovery_query_fields: [{ key: 'search', value: 'CG' }, { key: 'connector', value: 'usb-c' }, { key: 'electronics_kind', value: 'hub' }, { key: 'sort', value: 'price-asc' }, { key: 'category', value: 'Accessories' }, { key: 'country_of_origin', value: 'India' }, { key: 'limit', value: '1' }],
    active_filters: [{ key: 'connector', value: 'usb-c', label: 'Connector: USB-C', clear_url: '/products?search=CG&sort=price-asc&electronics_kind=hub' }],
    sort_options: [{ value: 'display_order', label: 'Featured', selected: false }, { value: 'price-asc', label: 'Price: low to high', selected: true }],
    clear_filters_url: '/products?search=CG&sort=price-asc',
  };
  const result = await render('search', undefined, { collection, search: { terms: 'CG' } }, { search: 'CG', sort: 'price-asc', page: '3' });
  const dom = new JSDOM(result.liquid!.contentForLayout), doc = dom.window.document;
  const sort = doc.querySelector<HTMLFormElement>('.ct-sort')!;
  const sorted = new dom.window.FormData(sort);
  assert.deepEqual(Array.from(sorted.entries()), [['search', 'CG'], ['connector', 'usb-c'], ['electronics_kind', 'hub'], ['category', 'Accessories'], ['country_of_origin', 'India'], ['limit', '1'], ['sort', 'price-asc']]);
  for (const form of doc.querySelectorAll<HTMLFormElement>('.ct-facets')) {
    assert.equal(form.querySelectorAll('fieldset').length, 2);
    const before = new dom.window.FormData(form);
    assert.deepEqual(before.getAll('connector'), ['usb-c']);assert.equal(before.get('sort'), 'price-asc');assert.equal(before.get('search'), 'CG');assert.equal(before.has('page'), false);assert.equal(before.get('electronics_kind'), 'hub');assert.equal(before.get('category'), 'Accessories');assert.equal(before.get('country_of_origin'), 'India');assert.equal(before.get('limit'), '1');
    assert.equal(form.querySelector('input[name=electronics_kind]')?.getAttribute('type'), 'radio');
    form.querySelector<HTMLInputElement>('input[value="usb-a"]')!.checked = true;
    assert.deepEqual(new dom.window.FormData(form).getAll('connector'), ['usb-c', 'usb-a']);
    form.querySelector<HTMLInputElement>('input[value="charger"]')!.checked = true;
    assert.deepEqual(new dom.window.FormData(form).getAll('electronics_kind'), ['charger'], 'scalar choices cannot become repeated query values');
    form.querySelector<HTMLInputElement>('input[name=electronics_kind][value=""]')!.checked = true;
    assert.deepEqual(new dom.window.FormData(form).getAll('electronics_kind'), ['']);
    for (const control of form.querySelectorAll<HTMLInputElement>('input[name=connector]')) control.checked = false;
    assert.deepEqual(new dom.window.FormData(form).getAll('connector'), []);
    assert.match(form.querySelector<HTMLAnchorElement>('.ct-link')!.href, /search=CG&sort=price-asc$/);
  }
  assert.equal(doc.querySelector<HTMLAnchorElement>('.ct-active-filters a')?.getAttribute('href'), '/store/circuit-test/products?search=CG&sort=price-asc&electronics_kind=hub');
  dom.window.close();
  const disabled = await render('collection', undefined, { collection: { ...collection, capabilities: { electronics_filters: false } } });
  assert.doesNotMatch(disabled.liquid!.contentForLayout, /class="ct-facets"/);
});
test('collection cards use validated shallow summaries and distinguish cable capacity from output', async () => {
  const hub = { ...product, electronics_video_summary: '3840 × 2160 / 30 Hz' };
  const cable = { ...product, id: 'cable', title: 'One metre cable', electronics: { model: 'CL-100', power_capacity_w: 100, data_rate_mbps: 480, length_mm: 1000 } };
  const charger = { ...product, id: 'charger', title: 'Dual USB-C charger', electronics: { model: 'CH-65', power_output_w: 65 }, electronics_output_connector_summary: '2 × USB-C' };
  const result = await render('collection', undefined, { collection: { products: [hub, cable, charger] } });
  const dom = new JSDOM(result.liquid!.contentForLayout), cards = Array.from(dom.window.document.querySelectorAll('.ct-card'));
  assert.match(cards[0].textContent!, /3840 × 2160 \/ 30 Hz/);assert.match(cards[0].textContent!, /5000 Mb\/s/);
  assert.match(cards[1].textContent!, /Cable power capacity100 W/);assert.doesNotMatch(cards[1].textContent!, /Output maximum|Laptop pass-through/);
  assert.match(cards[2].textContent!, /Output maximum65 W/);assert.match(cards[2].textContent!, /Power outputs2 × USB-C/);
  dom.window.close();
});
test('merchant strings and asset URLs pass canonical escaping, not executable content', async () => {
  const unsafe = { ...product, title: '"><img src=x onerror=alert(1)>', featured_image: 'javascript:alert(1)', electronics: { ...electronics, manufacturer: '<script>alert(1)</script>', notes: '<svg onload=alert(1)>', compatible_devices: [{ manufacturer: '<script>x</script>', model: 'Model A', reference: '<b onmouseover=x>ref</b>', source_date: '2026-10-22' }] } };
  for (const key of ['product', 'collection']) {
    const result = await render(key, undefined, { product: unsafe, collection: { products: [unsafe] } });
    assert.equal(result.status, 'rendered');
    const dom = new JSDOM(result.liquid!.contentForLayout);
    assert.equal(dom.window.document.querySelector('script,[onerror],[onload],[onmouseover],img[src="x"]'), null);
    for (const el of dom.window.document.querySelectorAll('[href],[src]')) for (const attr of ['href', 'src']) assert.doesNotMatch(el.getAttribute(attr) ?? '', /^javascript:/i);
    dom.window.close();
    assert.match(result.liquid!.contentForLayout, /&lt;/);
  }
});
test('editor settings and selected resources roundtrip and change actual render, including cleared optional media', async () => {
  const base = createCircuitTheme(createLetbuyyCoreLiquidThemeBundleFixture()), doc = toThemeDocumentV2(base);
  const hero = doc.templates.find(t => t.key === 'index')!.sections.find(s => s.type === 'hero-banner')!;
  hero.settings.heading = 'Merchant-owned connection desk';hero.settings.image = '/merchant/new-hub.webp';hero.settings.product1 = 'cg7-real-id';
  const saved = fromThemeDocumentV2(doc), rendered = await render('index', saved);
  assert.match(rendered.liquid!.contentForLayout, /Merchant-owned connection desk/);assert.match(rendered.liquid!.contentForLayout, /\/merchant\/new-hub.webp/);
  hero.settings.image = '';const cleared = await render('index', fromThemeDocumentV2(doc));assert.doesNotMatch(cleared.liquid!.contentForLayout, /ct-feature-media/);
  const detail = structuredClone(saved);detail.templates.product.sections['forge-detail-product'].settings.showElectronicsFacts = false;
  assert.doesNotMatch((await render('product', detail)).liquid!.contentForLayout, /circuit-specifications|Device compatibility/);
  assert.doesNotMatch((await render('index', base)).liquid!.contentForLayout, /Merchant-owned connection desk/);
});
test('actual inline navigation roots expose distinct preview identities and no public editor attributes', async () => {
  const bundle = createCircuitTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  const header = Object.values(bundle.templates.header.sections).find(row => row.type === 'header')!;
  header.blocks = Object.fromEntries(['first', 'second'].map(id => [id, { type: 'link', settings: { label: 'Model guide', href: '/guide' }, blocks: {}, block_order: [], disabled: false }]));
  header.block_order = ['first', 'second'];
  const preview = await render('index', bundle), previewDom = new JSDOM(preview.liquid!.header!);
  for (const id of ['first', 'second']) {
    const root = previewDom.window.document.querySelector(`[data-block-id="${id}"]`)!;
    assert.equal(root.tagName, 'A');assert.equal(root.textContent, 'Model guide');assert.equal(root.getAttribute('href'), '/store/circuit-test/guide');
  }
  previewDom.window.close();
  const published = await render('index', bundle, {}, {}, false), publishedDom = new JSDOM(published.liquid!.header!);
  assert.equal(publishedDom.window.document.querySelector('[data-block-id]'), null);
  assert.equal(Array.from(publishedDom.window.document.querySelectorAll('a')).filter(el => el.textContent === 'Model guide').length, 2);
  publishedDom.window.close();
});
