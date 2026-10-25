import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { createThreadlineThemeV201 } from '../src/threadline-theme-v201';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { buildExperienceSettingsOverlay, getExperience } from '../src/theme-presets';
import { LiquidRenderer, type LiquidCommerceDrops } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { LiquidThemePackageBundleSchema, buildLiquidThemePackagePersistencePayload, type LiquidThemePackageBundle } from '../src/theme-bundle';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';
import { collectThemeTemplateValidationIssues, type ThemeTemplateValidationRuntime } from '../src/index';

const output = process.env.TL_RENDER_RUN_DIR ? resolve(process.env.TL_RENDER_RUN_DIR) : undefined;
if (output) assert.ok(output.startsWith(resolve('docs/implementation/threadline-2026-10-22/completion-2026-10-24/main-leaf-01/runs') + '/'));
const target = 'main-leaf';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function base() {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  return LiquidThemePackageBundleSchema.parse({ ...bundle, config: { ...bundle.config,
    settings_data: { ...bundle.config.settings_data, current: {
      ...bundle.config.settings_data.current, ...buildExperienceSettingsOverlay(getExperience('sense')!),
    } },
  } });
}
const original = createFirstPartyCatalogBundle('letbuyy-sense');
const successor = createThreadlineThemeV201(base());
const initial = () => structuredClone(successor);
const product = { id: '11111111-1111-4111-8111-111111111111', title: 'Synthetic linen shirt', price: 2490, currency: 'INR', url: '/product/synthetic-shirt', available: true, images: [], options: [{ name: 'Size', values: ['M'] }], variants: [], apparel: { fit: 'Relaxed fit', unit: 'cm', fabric: 'Linen', care: 'Cold wash', measurements: [] } };
const order = { id: '22222222-2222-4222-8222-222222222222', number: '1042', status: 'pending', currency: 'INR', total: 249000, tax_total: 0, line_items: [{ title: 'Synthetic linen shirt', quantity: 1, line_price: 249000 }], timeline: [{ label: 'Pending', reached: true }] };
const buyer = { id: '33333333-3333-4333-8333-333333333333', email: 'synthetic-render@example.invalid', orders: [order] };
let renderNumber = 0;
async function render(key: string, bundle = initial(), extra: LiquidCommerceDrops = {}) {
  const context: LiquidCommerceDrops = {
    shop: { name: 'Synthetic Threadline' }, product, collections: [{ id: '44444444-4444-4444-8444-444444444444', title: 'Dresses', handle: 'dresses' }],
    collection: { title: key === 'search' ? 'Search products' : 'Dresses', products: [product] },
    buyer, order, buyer_unavailable: false,
    section_products: { 'sense-productGrid-index': [product], 'sense-featuredProducts-index': [product], 'sense-productGrid-collection': [product], 'sense-featuredProducts-product': [product] },
    page: { title: 'Synthetic page', body_html: '<p>Owned content</p>' }, article: { title: 'Synthetic article', body_html: '<p>Owned article</p>' }, blog: { articles: [] },
    ...extra,
  };
  const result = await new LiquidRenderer().render({
    context: { storeId: '55555555-5555-4555-8555-555555555555', subdomain: 'threadline-private-render', path: '/', previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-sense', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : key === 'customers/order' ? 'customer_order' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key, liquidContext: context,
  });
  const id = `${String(++renderNumber).padStart(3, '0')}-${key.replaceAll('/', '-')}`;
  if (output) writeFileSync(join(output, `${id}.json`), JSON.stringify({ target, key, bundleSha256: hash(bundle), context, status: result.status, warnings: result.warnings, htmlSha256: hash(result.liquid?.contentForLayout) }, null, 2) + '\n');
  if (output) writeFileSync(join(output, `${id}.html`), result.liquid?.contentForLayout || '');
  assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
  assert.deepEqual(result.warnings, [], `${key} render warnings`);
  const dom = new JSDOM(result.liquid!.contentForLayout);
  return { result, document: dom.window.document };
}
function listTemplate(bundle: LiquidThemePackageBundle, title?: string) {
  bundle.templates.collection = { ...bundle.templates.collection, order: ['owned-list'], sections: {
    'owned-list': { type: 'collection-product-list', settings: title === undefined ? {} : { title }, blocks: {}, block_order: [], disabled: false },
  } };
  return bundle;
}
function roundtrip(bundle: LiquidThemePackageBundle) {
  return fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(bundle))));
}
function noExecutableMarkup(document: Document, selector: string) {
  const element = document.querySelector(selector)!;
  assert.ok(element);
  assert.equal(element.querySelectorAll('script,img,svg,iframe').length, 0);
  assert.ok([...element.querySelectorAll('*')].every(node => [...node.attributes].every(attribute => !attribute.name.startsWith('on'))));
}

test('original frozen package, base input and explicit successor identity remain separate', () => {
  assert.equal(hash(original), '61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e');
  const before = base(); const pin = hash(before); createThreadlineThemeV201(before);
  assert.equal(hash(before), pin);
  assert.equal(successor.package.version, '2.0.1');
  assert.equal(successor.package.version_number, 3);
  assert.equal(successor.package.status, original.package.status); assert.equal(successor.package.release_status, original.package.release_status);
  assert.equal(original.package.version, '2.0.0');
  if (output) writeFileSync(join(output, 'successor.bundle.json'), JSON.stringify(successor) + '\n');
});
test('actual canonical bundle/schema/manifest validator accepts every default template before and after document serialization', () => {
  for (const candidate of [successor, roundtrip(successor)]) {
    LiquidThemePackageBundleSchema.parse(candidate);
    const manifest = buildLiquidThemePackagePersistencePayload(candidate).schemaManifest;
    const runtime = { sectionSchemas: manifest.section_schemas, settingsSchema: manifest.settings_schema } as unknown as ThemeTemplateValidationRuntime;
    const config = { themeId: candidate.package.slug, schema_version: candidate.schema_version, engineVersion: candidate.renderer.renderer_version, rendererEngine: 'liquid', liquidBundle: candidate, sections: {}, templates: candidate.templates, themeSettings: candidate.config.settings_data.current };
    assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig: config, runtime, themeSlug: candidate.package.slug }), []);
    const invalid = structuredClone(config); invalid.templates.index.sections['sense-categoryGrid-index'].settings.notDeclaredBySchema = 'forged';
    assert.ok(collectThemeTemplateValidationIssues({ templateConfig: invalid, runtime, themeSlug: candidate.package.slug }).some(issue => issue.includes('notDeclaredBySchema')));
  }
});
test('new distribution defaults leave automatic headings and previously inert stock subtitle blank without rewriting the frozen package', () => {
  assert.equal(successor.sections['collection-product-list'].schema.settings.find(field => field.id === 'title')?.default, '');
  assert.equal(successor.templates.search.sections['search-results'].settings.title, '');
  assert.equal(successor.templates['list-collections'].sections['list-collections-grid'].settings.subtitle, '');
  assert.equal(original.sections['collection-product-list'].schema.settings.find(field => field.id === 'title')?.default, 'Clothing');
  assert.equal(original.templates.search.sections['search-results'].settings.title, 'Results');
  assert.equal(original.templates['list-collections'].sections['list-collections-grid'].settings.subtitle, 'Browse every collection in the store.');
});
test('REGRESSION_category_subtitle reaches actual Liquid output after editor-document roundtrip', async () => {
  const bundle = initial(); bundle.templates.index.sections['sense-categoryGrid-index'].settings.subtitle = 'A merchant silhouette description';
  const { document } = await render('index', roundtrip(bundle));
  assert.equal(document.querySelector('[data-section-id="sense-categoryGrid-index"] .tl-heading p')?.textContent, 'A merchant silhouette description');
});
test('REGRESSION_populated_collection_heading_edit overrides actual collection title', async () => {
  const { document } = await render('collection', roundtrip(listTemplate(initial(), 'Occasion collection')));
  assert.equal(document.querySelector('#owned-list h1, [data-section-id="owned-list"] h1')?.textContent, 'Occasion collection');
  assert.match(document.body.textContent!, /Synthetic linen shirt/);
});
test('REGRESSION_order_heading_edit reaches actual guarded Liquid order output', async () => {
  const bundle = initial(); bundle.templates['customers/order'].sections['customer-order-detail-default'].settings.heading = 'Receipt';
  const { document } = await render('customers/order', roundtrip(bundle));
  assert.equal(document.querySelector('.lb-order-detail h1')?.textContent, 'Receipt #1042');
  assert.match(document.querySelector('.lb-order-detail__total')!.textContent!, /2,490/);
});
test('collection heading omitted, cleared and whitespace values fall back to actual populated collection name', async () => {
  for (const value of [undefined, '', '   ']) {
    const { document } = await render('collection', roundtrip(listTemplate(initial(), value)));
    assert.equal(document.querySelector('[data-section-id="owned-list"] h1')?.textContent, 'Dresses', `value ${JSON.stringify(value)}`);
  }
});
test('explicit Clothing is an override, never a migration sentinel', async () => {
  const { document } = await render('collection', listTemplate(initial(), 'Clothing'));
  assert.equal(document.querySelector('[data-section-id="owned-list"] h1')?.textContent, 'Clothing');
});
test('missing collection title and cleared override retain original Clothing fallback', async () => {
  const { document } = await render('collection', listTemplate(initial(), ''), { collection: { title: '', products: [product] } });
  assert.equal(document.querySelector('[data-section-id="owned-list"] h1')?.textContent, 'Clothing');
});
test('category subtitle clear and whitespace remove the paragraph without removing silhouette navigation', async () => {
  for (const value of ['', '   ']) {
    const bundle = initial(); bundle.templates.index.sections['sense-categoryGrid-index'].settings.subtitle = value;
    const { document } = await render('index', roundtrip(bundle));
    assert.equal(document.querySelector('[data-section-id="sense-categoryGrid-index"] .tl-heading p'), null);
    assert.ok(document.querySelector('[data-section-id="sense-categoryGrid-index"] a[href$="/dresses"]'));
  }
});
test('order heading default, empty and whitespace retain Order and the canonical number', async () => {
  for (const value of [undefined, '', '   ']) {
    const bundle = initial(); const settings = bundle.templates['customers/order'].sections['customer-order-detail-default'].settings;
    if (value !== undefined) settings.heading = value;
    const { document } = await render('customers/order', roundtrip(bundle));
    assert.equal(document.querySelector('.lb-order-detail h1')?.textContent, 'Order #1042');
  }
});
test('hostile subtitle and both editable headings remain inert at canonical sanitizer boundary', async () => {
  const attack = '<img src=x onerror=alert(1)><script>owned()</script> & test';
  const home = initial(); home.templates.index.sections['sense-categoryGrid-index'].settings.subtitle = attack;
  const h = await render('index', roundtrip(home));
  assert.equal(h.document.querySelector('[data-section-id="sense-categoryGrid-index"] .tl-heading p')?.textContent, attack);
  noExecutableMarkup(h.document, '[data-section-id="sense-categoryGrid-index"] .tl-heading');
  const list = await render('collection', roundtrip(listTemplate(initial(), attack)));
  assert.equal(list.document.querySelector('[data-section-id="owned-list"] h1')?.textContent, attack);
  noExecutableMarkup(list.document, '[data-section-id="owned-list"] h1');
  const orderBundle = initial(); orderBundle.templates['customers/order'].sections['customer-order-detail-default'].settings.heading = attack;
  const receipt = await render('customers/order', roundtrip(orderBundle));
  assert.equal(receipt.document.querySelector('.lb-order-detail h1')?.textContent, attack + ' #1042');
  noExecutableMarkup(receipt.document, '.lb-order-detail h1');
});
test('guest, unavailable and missing order guards still hide private order body and customized heading', async () => {
  const bundle = initial(); bundle.templates['customers/order'].sections['customer-order-detail-default'].settings.heading = 'PRIVATE RECEIPT';
  for (const fixture of [
    { context: { buyer: null, order }, selector: '.lb-order-detail__guest' },
    { context: { buyer_unavailable: true, buyer, order }, selector: '.lb-order-detail__error' },
    { context: { buyer, order: null }, selector: '.lb-order-detail__missing' },
  ]) {
    const { document } = await render('customers/order', bundle, fixture.context);
    assert.ok(document.querySelector(fixture.selector));
    assert.equal(document.querySelector('.lb-order-detail h1'), null);
    assert.doesNotMatch(document.querySelector('.lb-order-detail')!.textContent!, /PRIVATE RECEIPT|1042|Synthetic linen shirt/);
  }
});
test('all untouched default page/chrome/style output remains exact before any merchant edits', async () => {
  for (const key of Object.keys(original.templates).filter(key => !['header', 'footer'].includes(key))) {
    const before = await render(key, original); const after = await render(key, initial());
    assert.equal(after.result.liquid!.contentForLayout, before.result.liquid!.contentForLayout, `${key} default content drift`);
    assert.equal(after.result.liquid!.header, before.result.liquid!.header, `${key} header drift`);
    assert.equal(after.result.liquid!.footer, before.result.liquid!.footer, `${key} footer drift`);
    assert.equal(after.result.liquid!.headStyleText, before.result.liquid!.headStyleText, `${key} style drift`);
  }
});
test('frozen source and migration capture retain the exact original package after rendering', () => {
  const sql = readFileSync(new URL('../../../database/supabase/migrations/382_threadline_catalog_v2.sql', import.meta.url), 'utf8');
  const capture = JSON.parse(sql.split('$liquidbundle$')[1]) as { document: { liquidBundle: LiquidThemePackageBundle } };
  assert.equal(hash(capture.document.liquidBundle), '61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e');
  assert.deepEqual(original, capture.document.liquidBundle);
});

test('saved 2.0.0 merchant values, layouts, bindings, blocks and unknown settings survive without defaults reapplication', () => {
  const saved = structuredClone(original);
  saved.config.settings_data.current.futureSettings = { enabled: false, zero: 0, names: ['தமிழ்', 'हिन्दी'], empty: null };
  saved.templates['list-collections'].sections['list-collections-grid'].settings.subtitle = 'Merchant-owned silhouettes';
  saved.templates.search.sections['search-results'].settings.title = 'Search the atelier';
  saved.templates.index.sections['sense-heroBanner-index'].settings.image = 'https://example.invalid/owned-campaign.webp';
  saved.templates.index.sections['sense-featuredProducts-index'].settings.product1 = product.id;
  saved.templates.index.sections['sense-categoryGrid-index'].settings.futureBinding = { id: 'owned-resource', enabled: false };
  saved.templates.index.order.reverse();
  const header = saved.templates.header.sections['header-default'];
  header.blocks = {
    'owned-link-A': { type: 'link', settings: { label: 'Collections', href: '/collections', future: [0, false] }, blocks: {}, block_order: [], disabled: false },
    'owned-link-B': { type: 'link', settings: { label: 'About', href: '/pages/about' }, blocks: {}, block_order: [], disabled: true },
  };
  header.block_order = ['owned-link-B', 'owned-link-A'];
  const before = structuredClone(saved);
  const upgraded = createThreadlineThemeV201(saved);
  assert.deepEqual(saved, before);
  assert.deepEqual(upgraded.templates, before.templates);
  assert.deepEqual(upgraded.config, before.config);
  assert.deepEqual(upgraded.layout, before.layout);
  assert.deepEqual(upgraded.blocks, before.blocks);
  assert.deepEqual(upgraded.locales, before.locales);
  assert.deepEqual(upgraded.renderer, before.renderer);
  for (const key of Object.keys(before.sections).filter(key => !['category-grid', 'collection-product-list', 'customer-order-detail'].includes(key))) {
    assert.deepEqual(upgraded.sections[key], before.sections[key], key);
  }
  assert.deepEqual(roundtrip(upgraded), upgraded);
});

test('saved values equal to the old inert factory strings are still merchant data and never blindly cleared', () => {
  const saved = structuredClone(original);
  const upgraded = createThreadlineThemeV201(saved);
  assert.equal(upgraded.templates['list-collections'].sections['list-collections-grid'].settings.subtitle, 'Browse every collection in the store.');
  assert.equal(upgraded.templates.search.sections['search-results'].settings.title, 'Results');
  assert.deepEqual(saved, original);
});

test('Root-style fresh sense/Core input receives distribution-only defaults without changing default catalogue dispatch', () => {
  const configuredCore = base(); configuredCore.package.slug = 'letbuyy-sense'; configuredCore.package.name = 'Threadline';
  const before = structuredClone(configuredCore);
  assert.deepEqual(createThreadlineThemeV201(configuredCore), successor);
  assert.deepEqual(configuredCore, before);
  assert.equal(createFirstPartyCatalogBundle('letbuyy-sense').package.version, '2.0.0');
});

test('2.0.1 reentry is immutable and idempotent after saved value edits and JSON roundtrip', () => {
  const saved = roundtrip(successor);
  saved.templates.search.sections['search-results'].settings.title = 'Saved 201 title';
  saved.config.settings_data.current.future201 = { amount: 0, hidden: false };
  const before = structuredClone(saved);
  const repeated = createThreadlineThemeV201(saved);
  assert.notEqual(repeated, saved);
  assert.deepEqual(repeated, before);
  assert.deepEqual(saved, before);
  assert.deepEqual(createThreadlineThemeV201(repeated), before);
});

test('unknown identity/version and damaged successor seams fail closed without mutating the input', () => {
  for (const [slug, version] of [['letbuyy-forge', '2.0.0'], ['letbuyy-sense', '2.0.2'], ['letbuyy-sense', '2.0.1-private.1']]) {
    const input = structuredClone(original); input.package.slug = slug; input.package.version = version;
    const before = structuredClone(input);
    assert.throws(() => createThreadlineThemeV201(input), /canonical Core distribution or saved Threadline/);
    assert.deepEqual(input, before);
  }
  const damaged = structuredClone(successor); damaged.sections['customer-order-detail'].source = '<section>Unknown order markup</section>';
  const before = structuredClone(damaged);
  assert.throws(() => createThreadlineThemeV201(damaged), /exact configured heading contract/);
  assert.deepEqual(damaged, before);
});
