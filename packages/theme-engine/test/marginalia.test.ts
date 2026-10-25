import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarginaliaTheme } from '../src/marginalia-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';
import { JSDOM } from 'jsdom';
import { buildLiquidThemePackagePersistencePayload } from '../src/theme-bundle';
import { collectThemeTemplateValidationIssues, type ThemeTemplateValidationRuntime } from '../src/index';
import { compilePortableToLiquidBundle } from '../src/portable-to-liquid';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';

const editionId = '7b669c70-4700-4000-8000-000000000001';
const product = { id: 'book-1', title: 'Field Notes for a Slower City', price: 480, currency: 'INR', url: '/product/book-1', featured_image: '/theme-assets/marginalia/v2/field-notes-cover.webp', images: ['/theme-assets/marginalia/v2/field-notes-cover.webp'], available: true, options: [{ name: 'Edition', values: ['English paperback', 'Hindi hardback'] }], variants: [{ id: editionId, name: 'English paperback', price: 480, stock: 3, options: { Edition: 'English paperback' }, books: { kind: 'book', language: 'English', format: 'paperback', pages: 208, dimensions_mm: { width: 140, height: 216 } }, books_display: { language: 'English', format: 'paperback', dimensions: '140 × 216 mm' } }, { id: '7b669c70-4700-4000-8000-000000000002', name: 'Hindi hardback', price: 780, stock: 0, options: { Edition: 'Hindi hardback' }, books: { kind: 'book', language: 'Hindi', format: 'hardback', pages: 240, dimensions_mm: { width: 156, height: 234 } }, books_display: { language: 'Hindi', format: 'hardback', dimensions: '156 × 234 mm' } }], books: { kind: 'book', authors: ['Mira Sen'], subjects: ['Essays'], excerpt: { text: 'We began the morning with a blank page.\nThe city could wait.', permission: 'merchant_owned', attribution: 'Original fictional preview text · LetBuyy' } }, books_display: { authors: 'Mira Sen', multiple_editions: true } };
async function render(key = 'index', bundle = createMarginaliaTheme(createLetbuyyCoreLiquidThemeBundleFixture()), context: Record<string, unknown> = {}, searchParams?: Record<string, string>) {
  const result = await new LiquidRenderer().render({ context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'marginalia-test', path: '/store/marginalia-test/products', previewMode: true, locale: 'en-IN', searchParams }, storeTemplate: { themeId: 'letbuyy-dawn', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : 'collection', layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: key, liquidContext: { shop: { name: 'Synthetic Marginalia' }, product, collections: [{ id: 'essays', title: 'Essays', handle: 'essays' }], collection: { title: 'Books and paper', products: [product], total: 1 }, section_products: { 'marginalia-index': [product], 'marginalia-reading': [product] }, ...context } });
  assert.equal(result.status, 'rendered');
  assert.deepEqual(result.warnings, []);
  return result;
}
const content = (result: Awaited<ReturnType<typeof render>>) => result.liquid!.contentForLayout;
// The engine's server DOM facade omits this real JSDOM test-resource cleanup method.
const closeDom = (dom: JSDOM) => (dom.window as unknown as { close(): void }).close();

test('pure v2 factory preserves v1 input and canonical template set, with a distinct home structure', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture(); const original = structuredClone(base);
  const b = createMarginaliaTheme(base);
  assert.deepEqual(base, original); assert.equal(base.package.version, '1.0.0');
  assert.equal(b.package.slug, 'letbuyy-dawn'); assert.equal(b.package.name, 'Marginalia'); assert.equal(b.package.version, '2.0.0');
  assert.deepEqual(b.templates.index.order.map(id => b.templates.index.sections[id].type), ['hero-banner', 'category-grid', 'product-grid', 'about-section']);
  for (const key of ['cart', 'customers/account', 'customers/orders', 'customers/order', 'customers/addresses', 'policy', 'page']) assert.ok(b.templates[key], key);
  assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(b)), b);
  assert.doesNotMatch(JSON.stringify(b.templates.index), /sneaker|Monsoon|free bookmark|apparel|discount/i);
});
test('fresh collection-index defaults pass matching manifest validation before normalization and through JSON/document roundtrip', () => {
  for (const bundle of [createMarginaliaTheme(createLetbuyyCoreLiquidThemeBundleFixture()), createFirstPartyCatalogBundle('letbuyy-dawn', { designVersion: '2.0.0' })]) {
    const manifest = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
    const runtime: ThemeTemplateValidationRuntime = {
      sectionSchemas: manifest.section_schemas as ThemeTemplateValidationRuntime['sectionSchemas'],
      settingsSchema: manifest.settings_schema as ThemeTemplateValidationRuntime['settingsSchema'],
    };
    // Canonical Liquid registry document projection, before any editor normalization.
    const config = { themeId: bundle.package.slug, schema_version: bundle.schema_version, engineVersion: bundle.renderer.renderer_version,
      rendererEngine: 'liquid', liquidBundle: bundle, sections: {}, templates: bundle.templates, themeSettings: bundle.config.settings_data.current };
    const issues = (templateConfig: Record<string, unknown>) => collectThemeTemplateValidationIssues({ templateConfig, runtime, themeSlug: 'letbuyy-dawn' });
    assert.deepEqual(issues(config), []);
    const wire = JSON.parse(JSON.stringify(config)) as typeof config;
    assert.deepEqual(issues(wire), []);
    assert.equal(Object.keys(bundle.templates).filter(key => !['header', 'footer'].includes(key)).length, 21);
    const roundtrip = fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(bundle))));
    assert.deepEqual(roundtrip, bundle);
    const compiled = compilePortableToLiquidBundle(wire, { baseBundle: bundle });
    assert.deepEqual(compiled.warnings, []); assert.deepEqual(compiled.bundle.templates, bundle.templates);
    const index = compiled.bundle.templates['list-collections'];
    assert.equal(index.sections['list-collections-grid'].settings.title, 'All collections');
    assert.equal(Object.hasOwn(index.sections['list-collections-grid'].settings, 'subtitle'), false);
    // The undeclared field must remain a validation failure, rather than be stripped at runtime.
    const invalid = structuredClone(wire);
    invalid.templates['list-collections'].sections['list-collections-grid'].settings.subtitle = 'An undeclared merchant value';
    assert.ok(issues(invalid).some(issue => issue === 'templates.list-collections.sections.list-collections-grid.settings.subtitle is not defined by the category-grid schema'));
    assert.equal(invalid.templates['list-collections'].sections['list-collections-grid'].settings.subtitle, 'An undeclared merchant value');
  }
});
test('actual Liquid rendering carries original product identity, edition facts and scoped styles', async () => {
  for (const key of ['index', 'collection', 'product']) {
    const result = await render(key);
    assert.match(result.liquid!.headStyleText!, /\.mg-opening/);
    assert.match(content(result), /Field Notes for a Slower City/);
    assert.doesNotMatch(content(result), /<script/);
  }
  const html = content(await render('product'));
  for (const island of ['variant-picker', 'add-to-cart', 'product-gallery', 'wishlist-toggle']) assert.match(html, new RegExp(`data-lb-island="${island}"`));
  assert.match(html, new RegExp(`&quot;id&quot;:&quot;${editionId}`));
  assert.match(html, /Hindi/); assert.match(html, /hardback/); assert.match(html, /240/);
  assert.match(html, /Currently unavailable/); assert.match(html, /Original fictional preview text/);
  assert.match(html, /name="quantity"/); assert.match(html, /data-lb-buy-now/);
});
test('collection bibliography and stationery dimensions survive the unchanged depth-four sandbox', async () => {
  const book = { ...product, variants: [], options: [], books: { kind: 'book', authors: ['Mira Sen'], language: 'English', format: 'paperback', edition: 'First edition' }, books_display: { authors: 'Mira Sen', language: 'English', format: 'paperback', edition: 'First edition' } };
  const paper = { ...product, id: 'paper', title: 'A5 notebook', variants: [], options: [], books: { kind: 'stationery', paper_gsm: 100, dimensions_mm: { width: 148, height: 210 }, page_count: 96, sheet_count: 48 }, books_display: { dimensions: '148 × 210 mm' } };
  const html = content(await render('collection', undefined, { collection: { products: [book, paper] } }));
  const dom = new JSDOM(html); const rows = dom.window.document.querySelectorAll('.mg-book-row');
  assert.equal(rows.length, 2);
  for (const fact of ['Mira Sen', 'English', 'paperback', 'First edition']) assert.ok(rows[0].textContent?.includes(fact), fact);
  for (const fact of ['148 × 210 mm', '100 gsm', '96 pages', '48 sheets']) assert.ok(rows[1].textContent?.includes(fact), fact);
  assert.doesNotMatch(rows[1].textContent ?? '', /Mira Sen|paperback/);
  closeDom(dom);
});
test('persisted variant UUIDs keep different dimensions attached to the matching edition', async () => {
  const html = content(await render('product'));
  const dom = new JSDOM(html);
  const paperback = dom.window.document.querySelector(`[data-variant-id="${editionId}"]`);
  const hardback = dom.window.document.querySelector('[data-variant-id="7b669c70-4700-4000-8000-000000000002"]');
  assert.ok(paperback?.textContent?.includes('140 × 216 mm'));
  assert.ok(hardback?.textContent?.includes('156 × 234 mm'));
  assert.ok(hardback?.textContent?.includes('Hindi'));
  assert.equal(paperback?.textContent?.includes('156 × 234 mm'), false);
  const carrier = JSON.parse(dom.window.document.querySelector('lb-variant-picker')!.getAttribute('data-variants')!);
  assert.equal(carrier.find((row: { id: string }) => row.id === editionId).books_display.dimensions, '140 × 216 mm');
  assert.equal(carrier[1].books_display.dimensions, '156 × 234 mm');
  closeDom(dom);
});
test('merchant text, media, subject blocks and product resource changes affect Liquid output', async () => {
  const b = createMarginaliaTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  b.templates.index.sections['marginalia-opening'].settings.heading = 'A shelf of your own';
  b.templates.index.sections['marginalia-paper'].settings = { content: 'A merchant-written paper note.', image: '/media/merchant-paper.webp', imageAlt: 'Merchant paper sample', linkLabel: 'See paper', linkUrl: '/products' };
  b.templates.index.sections['marginalia-index'].blocks = { subject1: { type: 'subject', settings: { label: 'Poetry in translation', href: '/collections/poetry' }, disabled: false, blocks: {}, block_order: [] } };
  b.templates.index.sections['marginalia-index'].block_order = ['subject1'];
  const replacement = { ...product, title: 'A Different Book', id: 'different', url: '/product/different' };
  const html = content(await render('index', b, { collection: { products: [] }, section_products: { 'marginalia-index': [replacement], 'marginalia-reading': [] } }));
  for (const text of ['A shelf of your own', 'Poetry in translation', 'merchant-paper.webp', 'Merchant paper sample', 'A merchant-written paper note.', 'A Different Book']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Field Notes for a Slower City/);
  b.templates.index.sections['marginalia-paper'].settings = { content: '', image: '', linkLabel: '', linkUrl: '' };
  assert.doesNotMatch(content(await render('index', b)), /class="mg-editorial/);
});
test('XSS payloads remain escaped text in bibliography, excerpt, links and edition attributes', async () => {
  const attack = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
  const malicious = { ...product, title: attack, books: { ...product.books, authors: [attack], excerpt: { ...product.books.excerpt, text: attack, attribution: attack } }, variants: [{ ...product.variants[0], name: attack, books: { kind: 'book', language: attack, format: 'paperback', edition: attack } }] };
  const html = content(await render('product', undefined, { product: malicious }));
  assert.doesNotMatch(html, /<script|<img src=x/);
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll('script,[onerror],[onclick]').length, 0);
  closeDom(dom);
  assert.match(html, /&lt;img/);
});
test('missing facts and unlicensed excerpts never invent ISBN, dimensions, reviews or reading rights', async () => {
  const bare = { ...product, books: null, variants: [], options: [], reviews: [], review_count: 0 };
  const html = content(await render('product', undefined, { product: bare }));
  assert.match(html, /Detailed product facts have not been supplied/);
  assert.doesNotMatch(html, /<dt>ISBN|<dt>Pages|Reading sample|Customer reviews \(/);
  const invalidExcerpt = { ...product, books: { kind: 'book', excerpt: { text: 'No declared permission', attribution: 'unknown' } } };
  assert.doesNotMatch(content(await render('product', undefined, { product: invalidExcerpt })), /No declared permission/);
  const unknownPermission = { ...product, books: { kind: 'book', excerpt: { text: 'Guessed rights', permission: 'assumed', attribution: 'unknown' } } };
  assert.doesNotMatch(content(await render('product', undefined, { product: unknownPermission })), /Guessed rights/);
});
test('stationery is not relabelled as a book; dimensions and pages/sheets stay distinct', async () => {
  const stationery = { ...product, title: 'Olive A5 notebook', options: [], variants: [], books: { kind: 'stationery', paper_gsm: 100, dimensions_mm: { width: 148, height: 210 }, page_count: 96, sheet_count: 48, ruling: 'blank', included: ['One notebook'] } };
  const html = content(await render('product', undefined, { product: stationery }));
  assert.match(html, /100 gsm/); assert.match(html, /148 × 210 mm/); assert.match(html, /<dt>Pages<\/dt><dd>96/); assert.match(html, /<dt>Sheets<\/dt><dd>48/);
  assert.doesNotMatch(html, /<dt>ISBN|About this book|Read a sample/);
});
test('discovery facets require a server capability and preserve filters/pagination without a second query engine', async () => {
  const noCapability = content(await render('collection'));
  assert.doesNotMatch(noCapability, /name="books_author"/);
  const query = { search: 'slow city', books_author: 'Mira Sen', books_language: 'Hindi', books_format: 'hardback', sort: 'price-asc' };
  const html = content(await render('collection', undefined, { collection: { title: 'Search', products: [product], capabilities: { books_filters: true }, discovery_facets: [{ key: 'books_ruling', value: 'lined', label: 'Supplied ruled paper', count: 2, selected: false }], discovery_query_fields: [{ key: 'country_of_origin', value: 'IN' }, { key: 'limit', value: '7' }, { key: 'connector', value: 'usb-c' }, { key: 'connector', value: 'hdmi' }], active_filters: [{ label: 'Language: Hindi', clear_url: '/products?search=slow&limit=7&connector=usb-c&connector=hdmi' }], pagination: { page: 2, previous_url: '/products?search=slow&page=1', next_url: '/products?search=slow&page=3' } } }, query));
  assert.match(html, /name="books_author"[^>]*value="Mira Sen"/); assert.match(html, /value="hardback" selected/); assert.match(html, /Page 2/); assert.match(html, /page=3/);
  assert.match(html, /name="books_ruling"/); assert.match(html, /Supplied ruled paper \(2\)/);
  assert.match(html, /name="country_of_origin" value="IN"/); assert.match(html, /name="limit" value="7"/);
  assert.match(html, /name="connector" value="usb-c"/); assert.match(html, /name="connector" value="hdmi"/);
  assert.match(html, /aria-label="Remove Language: Hindi"/); assert.match(html, /name="page" value="1"/);
  const empty = content(await render('collection', undefined, { collection: { products: [] } }));
  assert.match(empty, /No products found/); assert.doesNotMatch(empty, /Field Notes/);
});
test('long English/Hindi strings remain intact and responsive rules contain narrow covers and wrapping', async () => {
  const title = 'हिंदी में एक लंबा पुस्तक शीर्षक '.repeat(8);
  const html = content(await render('collection', undefined, { collection: { products: [{ ...product, title }] } }));
  assert.ok(html.includes(title));
  const css = (await render()).liquid!.headStyleText!;
  for (const fragment of ['object-fit:contain', 'overflow-wrap:anywhere', '@media(max-width:640px)', '@media(max-width:360px)', 'prefers-reduced-motion', 'min-height:44px']) assert.ok(css.includes(fragment), fragment);
});
