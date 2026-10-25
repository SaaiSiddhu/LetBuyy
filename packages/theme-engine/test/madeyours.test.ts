import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { createMadeYoursTheme, MADEYOURS_CATALOG_ID, MADEYOURS_PRESET_ID } from '../src/madeyours-theme';
import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from '../src/theme-bundle';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';
import { lintThemeBundle } from '../src/theme-linter';
import { packageThemeBundle } from '../src/theme-packager';

const product = { id: '7b669c70-9000-4000-8000-000000000001', title: 'Desk name block', price: 1290, currency: 'INR', url: '/product/7b669c70-9000-4000-8000-000000000001', featured_image: '/theme-assets/madeyours/v2/block.webp', images: ['/theme-assets/madeyours/v2/block.webp'], available: true, options: [{ name: 'Wood', values: ['Walnut'] }], variants: [{ id: '7b669c70-9100-4000-8000-000000000001', options: { Wood: 'Walnut' }, stock: 4 }], personalization: { version: 1, revision: 1, methods: [{ id: 'engraving', label: 'Front engraving', min_graphemes: 1, max_graphemes: 18, character_set: 'latin-name', styles: [{ id: 'sans', label: 'Sans' }], placements: [{ id: 'front-center', label: 'Centered on the front' }] }] } };
// Matches the coordinator-owned validated Liquid projection: shallow strings for cards, exact JSON for the existing island.
const liquidProduct = { ...product, personalization: { ...product.personalization, methodSummary: 'Front engraving · 1–18' }, personalization_json: JSON.stringify(product.personalization) };
const factory = () => createMadeYoursTheme(createLetbuyyCoreLiquidThemeBundleFixture());
async function render(key: string, bundle: LiquidThemePackageBundle = factory(), item: Record<string, unknown> = liquidProduct, products: Record<string, unknown>[] = [liquidProduct], searchParams?: Record<string, string>, previewMode = true) {
  const sectionProducts = Object.fromEntries(Object.entries(bundle.templates[key].sections).filter(([, section]) => ['product-grid', 'collection-product-list', 'featured-products'].includes(section.type)).map(([id]) => [id, products]));
  return new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'madeyours-test', path: key === 'collection' ? '/products' : key === 'product' ? String(item.url) : '/', previewMode, locale: 'en-IN', searchParams },
    storeTemplate: { themeId: 'letbuyy-nova', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : key === 'cart' ? 'cart' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Synthetic MadeYours', subdomain: 'madeyours-test' }, product: item, collection: { title: 'Text-ready bases', products, total: products.length }, collections: [], section_products: sectionProducts },
  });
}

test('pure v2 factory preserves Core and every canonical template, with stable catalog identity', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture();
  const before = JSON.stringify(base);
  const b = createMadeYoursTheme(base);
  assert.equal(JSON.stringify(base), before);
  assert.equal(b.package.slug, 'letbuyy-nova');
  assert.equal(b.package.version, '2.0.0');
  assert.equal(b.package.name, 'MadeYours');
  assert.equal(MADEYOURS_PRESET_ID, 'nova');
  assert.equal(MADEYOURS_CATALOG_ID, '7b669c70-0000-4000-8000-000000000009');
  assert.deepEqual(Object.keys(b.templates), Object.keys(base.templates));
  assert.equal(base.package.version, '1.0.0');
  assert.deepEqual(b.templates.index.order.map(id => b.templates.index.sections[id].type), ['hero-banner', 'experience-timeline', 'product-grid', 'category-grid', 'about-section']);
  assert.notDeepEqual(b.templates.index.order, base.templates.index.order);
  assert.equal(LiquidThemePackageBundleSchema.safeParse(b).success, true);
  assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(b)), b);
});
test('fresh factory removes only the undeclared inherited font alias and roundtrips declared Inter typography over JSON', async () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture();
  const before = JSON.stringify(base);
  const bundle = createMadeYoursTheme(base);
  assert.equal(Object.hasOwn(bundle.config.settings_data.current, 'fontFamily'), false);
  assert.equal(bundle.config.settings_data.current.headingFontFamily, 'Inter');
  assert.equal(bundle.config.settings_data.current.bodyFontFamily, 'Inter');
  const restored = fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(bundle))));
  assert.deepEqual(restored, bundle);
  assert.equal(JSON.stringify(base), before);
  const withUnusedAlias = structuredClone(bundle);
  withUnusedAlias.config.settings_data.current.fontFamily = 'Inter';
  const [current, inherited] = await Promise.all([render('product', bundle), render('product', withUnusedAlias)]);
  assert.equal(current.liquid!.headStyleText, inherited.liquid!.headStyleText);
  assert.equal(current.liquid!.contentForLayout, inherited.liquid!.contentForLayout);
});
test('actual Liquid rendering gives a distinct workspace and real catalog identity', async () => {
  const result = await render('index');
  assert.equal(result.status, 'rendered');
  assert.deepEqual(result.warnings, []);
  const html = result.liquid!.contentForLayout;
  assert.match(html, /Choose/);
  assert.match(html, /Specify/);
  assert.match(html, /Review/);
  assert.match(html, /Desk name block/);
  assert.match(html, /Front engraving · 1–18/);
  assert.match(html, new RegExp(product.url));
  assert.doesNotMatch(html, /data-lb-add-to-cart/); // configured products cannot bypass review from cards.
  assert.match(result.liquid!.headStyleText!, /\.my-intro\{display:grid/);
  assert.doesNotMatch(html, /Fresh drops|sneakers|up to 30%|Verified purchase|★/);
});
test('personalized PDP keeps canonical gallery/variant/cart controls and visible specification/review hooks', async () => {
  const result = await render('product');
  assert.equal(result.status, 'rendered');
  const html = result.liquid!.contentForLayout;
  for (const hook of ['lb-product-gallery', 'lb-variant-picker', 'lb-add-to-cart', 'data-lb-personalization-required="true"', 'data-lb-personalization-facts=', 'data-lb-personalization-text', 'data-lb-personalization-method', 'data-lb-personalization-style', 'data-lb-personalization-placement', 'data-lb-personalization-review', 'data-lb-personalization-summary-text']) assert.ok(html.includes(hook), hook);
  assert.match(html, /data-lb-add-to-cart[^>]*disabled/);
  assert.match(html, /data-lb-personalization-review[^>]*disabled/);
  assert.match(html, /written details are authoritative/);
  assert.match(html, /Check spelling, spaces and capitalization/);
  const dom = new JSDOM(html);
  const suppliedFacts = JSON.parse(dom.window.document.querySelector('lb-add-to-cart')!.getAttribute('data-lb-personalization-facts')!);
  assert.deepEqual(suppliedFacts, product.personalization);
  assert.deepEqual(suppliedFacts.methods[0].styles, [{ id: 'sans', label: 'Sans' }]);
  assert.deepEqual(suppliedFacts.methods[0].placements, [{ id: 'front-center', label: 'Centered on the front' }]);
  assert.doesNotMatch(html, /data-lb-buy-now|type="file"|upload|proof approval/i);
});
test('missing product facts produce honest copy without an invented configurator or delivery promise', async () => {
  const plain = { ...product, personalization: null, options: [], images: [] };
  const result = await render('product', factory(), plain);
  const html = result.liquid!.contentForLayout;
  assert.match(html, /Personalization details have not been supplied/);
  assert.doesNotMatch(html, /data-lb-personalization-required|data-lb-personalization-text|Dispatch|delivery in|certified/i);
  const empty = await render('index', factory(), plain, []);
  assert.match(empty.liquid!.contentForLayout, /No products found/);
  assert.doesNotMatch(empty.liquid!.contentForLayout, /₹|fake|rating|★/);
});
test('untrusted product and merchant text is escaped; no Liquid evaluation or executable markup', async () => {
  const b = factory();
  b.templates.index.sections['madeyours-intro'].settings.heading = '<img src=x onerror="alert(1)"> {{ private.secret }}';
  const result = await render('index', b, { ...product, title: '<script>alert(2)</script>', personalization: { ...product.personalization, methods: [{ ...product.personalization.methods[0], label: '<svg onload=alert(3)>' }] } }, [{ ...product, title: '<script>alert(2)</script>', personalization: { ...product.personalization, methods: [{ ...product.personalization.methods[0], label: '<svg onload=alert(3)>' }] } }]);
  const html = result.liquid!.contentForLayout;
  assert.doesNotMatch(html, /<script|<img src="?x|<svg onload/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /\{\{ private.secret \}\}/);
});
test('validated pre-serialized facts survive actual attribute sanitization exactly once, including hostile labels', async () => {
  const facts = { ...product.personalization, production_note: 'He said "hello" & goodbye', methods: [{ ...product.personalization.methods[0], label: '<img src=x onerror=alert(1)>', styles: [{ id: 'sans', label: 'Sans " double & single\' quote' }] }] };
  const serialized = JSON.stringify(facts).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const result = await render('product', factory(), { ...liquidProduct, personalization_json: serialized });
  const dom = new JSDOM(result.liquid!.contentForLayout);
  const island = dom.window.document.querySelector('lb-add-to-cart')!;
  assert.deepEqual(JSON.parse(island.getAttribute('data-lb-personalization-facts')!), facts);
  assert.equal(island.querySelector('[onerror]'), null);
  assert.equal(island.querySelector('img'), null);
  assert.doesNotMatch(result.liquid!.contentForLayout, /onerror="alert/);
});
test('editor settings, ordered blocks, media and product limits survive roundtrip and change output', async () => {
  const b = factory();
  const doc = toThemeDocumentV2(b);
  const home = doc.templates.find(t => t.key === 'index')!;
  const hero = home.sections.find(s => s.type === 'hero-banner')!;
  Object.assign(hero.settings, { heading: 'Merchant chooses the words', image: '/theme-assets/madeyours/v2/hero.webp', imageFocus: 'top', ctaText: 'Start here', ctaLink: '/products' });
  const process = home.sections.find(s => s.type === 'experience-timeline')!;
  process.blocks[0].settings.title = 'Merchant step';
  const grid = home.sections.find(s => s.type === 'product-grid')!;
  Object.assign(grid.settings, { columns: 3, productLimit: 1, title: 'Selected by the merchant' });
  const saved = fromThemeDocumentV2(doc);
  assert.deepEqual(toThemeDocumentV2(saved), doc);
  const result = await render('index', saved, product, [product, { ...product, title: 'Second base' }]);
  const html = result.liquid!.contentForLayout;
  assert.match(html, /Merchant chooses the words/);
  assert.match(html, /Merchant step/);
  assert.match(html, /data-focus="top"/);
  assert.match(html, /hero.webp/);
  assert.match(html, /data-columns="3"/);
  assert.doesNotMatch(html, /Second base/);
  hero.settings.image = '';
  hero.settings.ctaText = '';
  const cleared = (await render('index', fromThemeDocumentV2(doc))).liquid!.contentForLayout;
  assert.doesNotMatch(cleared, /my-intro-media|Start here/);
});
test('semantic settings change real rendered tokens and fonts without global theme CSS', async () => {
  const b = factory();
  Object.assign(b.config.settings_data.current, { primaryColor: '#123456', secondaryColor: '#456789', bodyFontFamily: 'Lato', headingFontFamily: 'Inter', borderRadius: 24 });
  const result = await render('index', b);
  assert.match(result.liquid!.headStyleText!, /--primary:#123456/);
  assert.match(result.liquid!.headStyleText!, /--secondary:#456789/);
  assert.match(result.liquid!.headStyleText!, /--font-body:"Lato", system-ui/);
  assert.match(result.liquid!.headStyleText!, /var\(--secondary/);
  assert.match(result.liquid!.headStyleText!, /--my-radius:24px/);
  assert.match(result.liquid!.headStyleText!, /border-radius:var\(--my-radius/);
  assert.doesNotMatch(b.layout.theme.source, /\.tl-theme|\.kr-theme/);
});
test('collection GET filters use canonical names and preserve the current sort', async () => {
  const result = await render('collection', factory(), liquidProduct, [liquidProduct], { min_price: '790', max_price: '1290', sort: 'price-desc', search: 'block' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid!.contentForLayout;
  assert.match(html, /name="min_price"[^>]*value="790"/);
  assert.match(html, /value="price-desc" selected/);
  assert.match(html, /name="search" value="block"/);
  assert.match(html, /Front engraving · 1–18/);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert.doesNotMatch(html, /name="personalization_method"/); // no unsupported server filter.
});
test('packaging is deterministic and owned sections introduce no linter errors or undeclared controls', () => {
  const baseIssues = new Set(lintThemeBundle(createLetbuyyCoreLiquidThemeBundleFixture()).map(issue => JSON.stringify(issue)));
  const b = factory();
  assert.deepEqual(lintThemeBundle(b).filter(issue => !baseIssues.has(JSON.stringify(issue))), []);
  assert.equal(packageThemeBundle(b).contentHash, packageThemeBundle(factory()).contentHash);
  for (const template of Object.values(b.templates)) for (const entry of Object.values(template.sections)) {
    if (!['hero-banner', 'experience-timeline', 'category-grid', 'product-grid', 'featured-products', 'collection-filter', 'collection-product-list', 'about-section'].includes(entry.type)) continue;
    const ids = new Set(b.sections[entry.type].schema.settings.map(field => field.id));
    assert.ok(Object.keys(entry.settings).every(key => ids.has(key)), entry.type);
  }
});
test('editable process roots expose actual block identities only in preview mode', async () => {
  const preview = await render('index');
  const publicPage = await render('index', factory(), liquidProduct, [liquidProduct], undefined, false);
  const previewDom = new JSDOM(preview.liquid!.contentForLayout);
  const publicDom = new JSDOM(publicPage.liquid!.contentForLayout);
  assert.deepEqual(Array.from(previewDom.window.document.querySelectorAll('.my-process > article'), node => node.getAttribute('data-block-id')), ['choose', 'specify', 'review']);
  assert.equal(publicDom.window.document.querySelectorAll('.my-process [data-block-id]').length, 0);
  assert.equal(publicDom.window.document.querySelectorAll('.my-process > article').length, 3);
});
test('related bases exclude the current PDP identity and apply the limit after excluding it', async () => {
  const other = { ...liquidProduct, id: 'notebook', title: 'Linen notebook', url: '/product/notebook' };
  const b = factory();
  b.templates.product.sections['product-related'].settings.productLimit = 1;
  for (const current of [liquidProduct, other]) {
    const result = await render('product', b, current, [liquidProduct, other]);
    const dom = new JSDOM(result.liquid!.contentForLayout);
    assert.deepEqual(Array.from(dom.window.document.querySelectorAll('.my-card h3'), node => node.textContent), [current.id === other.id ? 'Desk name block' : 'Linen notebook']);
  }
  const onlyCurrent = await render('product', b, liquidProduct, [liquidProduct]);
  assert.doesNotMatch(onlyCurrent.liquid!.contentForLayout, /Explore another base|my-card/);
});
test('retained cart/account/content source keeps canonical islands and scoped styling', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture();
  const b = createMadeYoursTheme(base);
  for (const key of ['cart', 'customers/account', 'customers/orders', 'customers/order', 'customers/settings', 'customers/addresses', 'policy', 'page']) assert.deepEqual(b.templates[key], base.templates[key]);
  for (const file of Object.values(b.sections)) assert.match(file.source, /class="my-theme/);
  assert.match(b.sections['cart-summary'].source, /lb-cart/);
  assert.match(b.layout.theme.source, /prefers-reduced-motion/);
  assert.match(b.layout.theme.source, /@media\(max-width:48rem\)/);
  assert.match(b.layout.theme.source, /grid-template-columns:minmax\(0,1.1fr\) minmax\(0,1fr\)/);
});
