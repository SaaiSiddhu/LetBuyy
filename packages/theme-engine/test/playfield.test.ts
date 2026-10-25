import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { createPlayfieldTheme } from '../src/playfield-theme';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { fromThemeDocumentV2, toThemeDocumentV2 } from '../src/theme-document';

const toy = {
  id: '7b669c70-8000-4000-8000-000000000001', title: 'Pattern Studio', price: 1290, currency: 'INR', url: '/product/pattern-studio', images: [], available: true,
  options: [{ name: 'Edition', values: ['Garden', 'Ocean', 'Sunrise'] }], variants: [{ id: 'garden', options: { Edition: 'Garden' }, stock: 4, price: 1290 }, { id: 'sunrise', options: { Edition: 'Sunrise' }, stock: 0, price: 1290 }],
  toys: { schemaVersion: 1, ageBands: ['6-8'], interests: ['art'], contents: [{ quantity: 12, label: 'wooden mosaic tiles' }, { quantity: 2, label: 'idea cards' }, { quantity: 1, label: 'tray' }], contentsComplete: true, dimensions: { label: 'Tray', length: 24, width: 19, height: 1.5, unit: 'cm' }, additionalDimensions: [{ label: 'Each tile', length: 5, width: 5, height: 0.6, unit: 'cm' }], materials: '<script>alert(1)</script> Wooden tiles', finish: 'Sample painted finish', care: 'Wipe with a dry cloth.', warnings: [{ text: 'Small pieces. Read the supplied product information.', sourceLabel: 'Fictional merchant fixture', editionLabel: 'All sample editions' }] },
};
const make = () => createPlayfieldTheme(createLetbuyyCoreLiquidThemeBundleFixture());
function closeDom(dom: JSDOM): void {
  const window = dom.window;
  if (!('close' in window) || typeof window.close !== 'function') throw new Error('Expected the Node DOM cleanup API.');
  window.close();
}
async function render(key: string, bundle = make(), product: Record<string, unknown> = toy, query?: Record<string, string>, products: Record<string, unknown>[] = [product], collection: Record<string, unknown> = {}) {
  return new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'playfield-test', path: key === 'collection' ? '/products' : '/', previewMode: true, locale: 'en-IN', searchParams: query },
    storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : 'collection', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { shop: { name: 'Synthetic Playfield' }, product, collection: { ...collection, products, total: products.length, pagination: { page: 2, previous_url: '/products?age_band=6-8&interest=art&page=1', next_url: '/products?age_band=6-8&interest=art&page=3' } }, section_products: { 'playfield-product-grid': products } },
  });
}

test('Playfield is a distinct v2 package and leaves its supplied v1 release untouched', () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture();
  const before = structuredClone(base);
  const bundle = createPlayfieldTheme(base);
  assert.deepEqual(base, before);
  assert.equal(bundle.package.slug, 'letbuyy-bloom');
  assert.equal(bundle.package.name, 'Playfield');
  assert.equal(bundle.package.version, '2.0.0');
  assert.deepEqual(bundle.templates.index.order.map(id => bundle.templates.index.sections[id].type), ['hero-banner', 'spotlight', 'category-grid', 'product-grid', 'about-section', 'trust-badges']);
  for (const key of Object.keys(base.templates)) assert.ok(bundle.templates[key], `Canonical route ${key} retained`);
  assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(bundle)), bundle);
  assert.match(bundle.sections['product-detail'].source, /lb-product-gallery/);
  assert.match(bundle.sections['product-detail'].source, /lb-variant-picker/);
  assert.match(bundle.sections['product-detail'].source, /lb-add-to-cart/);
});

test('fresh inherited buyer templates contain only supported replacement settings and survive JSON-wire documents', async () => {
  const base = createLetbuyyCoreLiquidThemeBundleFixture();
  const before = structuredClone(base);
  const bundle = createPlayfieldTheme(base);
  assert.deepEqual(base, before);
  assert.equal(Object.hasOwn(base.templates['list-collections'].sections['list-collections-grid'].settings, 'subtitle'), true);
  assert.equal(Object.hasOwn(base.templates.search.sections['search-results'].settings, 'title'), true);
  assert.equal(Object.hasOwn(bundle.templates['list-collections'].sections['list-collections-grid'].settings, 'subtitle'), false);
  assert.equal(Object.hasOwn(bundle.templates.search.sections['search-results'].settings, 'title'), false);
  const supportedBuyerTemplates = structuredClone(base.templates);
  delete supportedBuyerTemplates['list-collections'].sections['list-collections-grid'].settings.subtitle;
  assert.deepEqual(bundle.templates['list-collections'], supportedBuyerTemplates['list-collections']);
  assert.deepEqual(bundle.templates.search.sections['search-box-default'], base.templates.search.sections['search-box-default']);
  const restored = fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(bundle))));
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(bundle)));
  const inheritedCopy = structuredClone(bundle);
  inheritedCopy.templates['list-collections'].sections['list-collections-grid'].settings.subtitle = base.templates['list-collections'].sections['list-collections-grid'].settings.subtitle;
  inheritedCopy.templates.search.sections['search-results'].settings.title = base.templates.search.sections['search-results'].settings.title;
  for (const key of ['list-collections', 'search']) {
    const previous = await render(key, inheritedCopy), current = await render(key, bundle);
    assert.equal(previous.status, 'rendered'); assert.equal(current.status, 'rendered');
    assert.deepEqual(previous.warnings, []); assert.deepEqual(current.warnings, []);
    assert.equal(current.liquid!.contentForLayout, previous.liquid!.contentForLayout, `${key} buyer HTML remains identical`);
  }
});

test('retained editable inline blocks expose the preview attribute hook on their existing root', () => {
  const bundle = make();
  for (const [key, tag] of Object.entries({ 'banner-carousel': 'a', 'brand-marquee': 'span', 'experience-timeline': 'article', 'faq-accordion': 'details', footer: 'a', header: 'a', 'portfolio-grid': 'article', 'services-grid': 'article', 'skills-section': 'span', testimonials: 'blockquote' })) {
    assert.ok(bundle.sections[key].source.includes(`{% for block in section.blocks %}<${tag} {{ block.editor_attributes | raw }}`), key);
  }
  assert.doesNotMatch(bundle.sections['app-block-slot'].source, /block.editor_attributes/);
});

test('actual inline FAQ roots expose stable block identity only in editor preview', async () => {
  const bundle = make();
  bundle.templates.index = { sections: { questions: { type: 'faq-accordion', settings: { title: 'Merchant questions' }, blocks: { first: { type: 'faq-item', settings: { question: 'Same question', answer: 'First supplied answer' }, blocks: {}, block_order: [], disabled: false }, second: { type: 'faq-item', settings: { question: 'Same question', answer: 'Second supplied answer' }, blocks: {}, block_order: [], disabled: false } }, block_order: ['first', 'second'], disabled: false } }, order: ['questions'] };
  for (const previewMode of [true, false]) {
    const result = await new LiquidRenderer().render({
      context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'playfield-block-preview', path: '/', previewMode, locale: 'en-IN' },
      storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
      liquidBundle: bundle, liquidTemplateKey: 'index',
    });
    assert.equal(result.status, 'rendered', result.warnings.join(', '));
    assert.deepEqual(result.warnings, []);
    const dom = new JSDOM(result.liquid!.contentForLayout);
    try {
      const roots = dom.window.document.querySelectorAll('details.lb-faq-accordion__item');
      assert.equal(roots.length, 2);
      assert.equal(roots[0].querySelector('summary')!.textContent, 'Same question');
      assert.equal(roots[1].querySelector('summary')!.textContent, 'Same question');
      if (previewMode) {
        assert.equal(roots[0].getAttribute('data-block-id'), 'first');
        assert.equal(roots[1].getAttribute('data-block-id'), 'second');
      } else assert.equal(dom.window.document.querySelectorAll('[data-block-id]').length, 0);
    } finally { closeDom(dom); }
  }
});

test('actual Liquid home, collection and product render real merchandise and scoped styles', async () => {
  for (const key of ['index', 'collection', 'product']) {
    const result = await render(key);
    assert.equal(result.status, 'rendered');
    assert.deepEqual(result.warnings, []);
    assert.match(result.liquid!.contentForLayout, /Pattern Studio/);
    assert.match(result.liquid!.headStyleText!, /\.pf-bento/);
    assert.doesNotMatch(result.liquid!.contentForLayout, /Pet|veterinarian|Free shipping|certified safe|development guaranteed/i);
  }
});

test('an unconfigured announcement has no empty focusable link', async () => {
  const result = await render('index');
  const dom = new JSDOM(result.liquid!.header!);
  try {
    assert.match(dom.window.document.querySelector('.lb-announcement-bar')!.textContent!, /Make room for a little curiosity/);
    assert.equal(dom.window.document.querySelector('.lb-announcement-bar a'), null);
  } finally { closeDom(dom); }
});

test('contents and measured dimensions are exact, escaped and present before purchase', async () => {
  const result = await render('product');
  const html = result.liquid!.contentForLayout;
  assert.match(html, /15 items in total/);
  assert.match(html, /Length 24 cm/);
  assert.match(html, /Width 19 cm/);
  assert.match(html, /Height 1.5 cm/);
  assert.match(html, /<strong>Tray<\/strong>/);
  assert.match(html, /<dt>Each tile<\/dt><dd>Length 5 cm · Width 5 cm · Height 0.6 cm/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; Wooden tiles/);
  assert.doesNotMatch(html, /<script|data-lb-buy-now/);
  assert.match(html, /Source: Fictional merchant fixture/);
  assert.ok(html.indexOf('Read before choosing') < html.indexOf('<lb-variant-picker'));
  assert.match(html, /data-variant-value="Sunrise"/);
  assert.match(html, /data-lb-add-to-cart/);
  assert.match(html, /name="quantity"[^>]*value="1" min="1"/);
});

test('missing media, age, contents, dimensions and warnings remain visibly unknown', async () => {
  const unknown = { ...toy, toys: undefined, options: [], variants: [] };
  const product = await render('product', make(), unknown);
  assert.match(product.liquid!.contentForLayout, /Age information not supplied/);
  assert.match(product.liquid!.contentForLayout, /Contents have not been supplied/);
  assert.match(product.liquid!.contentForLayout, /Dimensions have not been supplied/);
  assert.doesNotMatch(product.liquid!.contentForLayout, /Read before choosing|Source:/);
  const collection = await render('collection', make(), unknown);
  assert.match(collection.liquid!.contentForLayout, /Product image not supplied/);
  assert.match(collection.liquid!.contentForLayout, /Age information not supplied/);
  assert.doesNotMatch(collection.liquid!.contentForLayout, /Choose an edition/);
});

test('age and interest selectors preserve both choices and each clear action removes one', async () => {
  const collection = { capabilities: { discovery: true, toys_filters: true, toys_age_band: true, toys_interest: true }, toy_facets: { age_bands: [{ value: '6-8', label: '6–8 years', count: 1, selected: true }], interests: [{ value: 'art', label: 'Art and making', count: 1, selected: true }] }, active_filters: [{ label: 'Age recommendation: 6-8 years', clear_url: '/products?interest=art&search=tiles&sort=price-asc' }, { label: 'Interest: art', clear_url: '/products?age_band=6-8&search=tiles&sort=price-asc' }] };
  const result = await render('collection', make(), toy, { age_band: '6-8', interest: 'art', search: 'tiles', sort: 'price-asc' }, [toy], collection);
  const html = result.liquid!.contentForLayout;
  assert.match(html, /value="6-8" selected/);
  assert.match(html, /value="art" selected/);
  const clearDom = new JSDOM(html);
  try {
    const links = [...clearDom.window.document.querySelectorAll('.pf-active-filters a')];
    assert.equal(links[0].getAttribute('href'), collection.active_filters[0].clear_url);
    assert.equal(links[1].getAttribute('href'), collection.active_filters[1].clear_url);
  } finally { closeDom(clearDom); }
  assert.match(html, /page=3/);
  const custom = (await render('collection', make(), toy, { interest: 'music' }, [toy], { ...collection, toy_facets: { age_bands: [], interests: [{ value: 'music', label: 'Music and sound', count: 1, selected: true }] } })).liquid!.contentForLayout;
  const customDom = new JSDOM(custom);
  assert.equal(customDom.window.document.querySelector<HTMLSelectElement>('select[name="interest"]')!.value, 'music');
  closeDom(customDom);
});

test('query attributes and merchant warning text cannot introduce active markup', async () => {
  const product = { ...toy, title: '\"><img src=x onerror=alert(1)>', toys: { ...toy.toys, warnings: [{ text: '<svg onload=alert(1)>', sourceLabel: '<img src=x onerror=alert(1)>' }] } };
  const html = (await render('product', make(), product)).liquid!.contentForLayout;
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll('script,[onerror],[onload]').length, 0);
  closeDom(dom);
  assert.match(html, /&lt;svg onload/);
  const filters = (await render('collection', make(), toy, { search: '\"><script>alert(1)</script>', interest: 'art' })).liquid!.contentForLayout;
  assert.doesNotMatch(filters, /<script>/);
});

test('editor mutation changes the rendered campaign and clearing media removes the image', async () => {
  const original = make();
  const document = toThemeDocumentV2(original);
  document.templates.find(template => template.key === 'index')!.sections.find(item => item.type === 'hero-banner')!.settings.heading = 'Merchant-owned curiosity';
  const spotlight = document.templates.find(template => template.key === 'index')!.sections.find(item => item.type === 'spotlight')!;
  spotlight.settings.image = '';
  const saved = fromThemeDocumentV2(document);
  assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(saved)), saved);
  const html = (await render('index', saved)).liquid!.contentForLayout;
  assert.match(html, /Merchant-owned curiosity/);
  assert.match(html, /Add your activity photograph/);
  assert.doesNotMatch((await render('index', original)).liquid!.contentForLayout, /Merchant-owned curiosity/);
});

test('empty collections expose recovery and do not fabricate products or counts', async () => {
  const result = await render('collection', make(), toy, undefined, []);
  assert.equal(result.status, 'rendered');
  assert.match(result.liquid!.contentForLayout, /No activities match this choice/);
  assert.match(result.liquid!.contentForLayout, /Explore all activities/);
  assert.doesNotMatch(result.liquid!.contentForLayout, /Pattern Studio/);
});

test('a resolved selected-edition DTO renders explicit clears and different measured objects without stale kit facts', async () => {
  const cleared = { ...toy, toys: { ...toy.toys, ageBands: [], contents: [], contentsComplete: false, dimensions: null, additionalDimensions: [], warnings: [] } };
  const unknownHtml = (await render('product', make(), cleared)).liquid!.contentForLayout;
  assert.match(unknownHtml, /Age information not supplied/);
  assert.match(unknownHtml, /Contents have not been supplied/);
  assert.match(unknownHtml, /Dimensions have not been supplied/);
  assert.doesNotMatch(unknownHtml, /15 items in total|Read before choosing|Length 24 cm|Height 0.6 cm/);
  const paper = { ...toy, title: 'Different paper sample edition', toys: { ...toy.toys, ageBands: ['9-12'], contents: [{ label: 'paper sheets', quantity: 36 }], contentsComplete: true, dimensions: { label: 'A5 sheet', length: 21, width: 14.8, unit: 'cm' }, additionalDimensions: [], materials: 'Paper', warnings: [] } };
  const paperHtml = (await render('product', make(), paper)).liquid!.contentForLayout;
  assert.match(paperHtml, /36 items in total/);
  assert.match(paperHtml, /<strong>A5 sheet<\/strong>/);
  assert.match(paperHtml, /Length 21 cm · Width 14.8 cm/);
  assert.doesNotMatch(paperHtml, /15 items in total|Length 24 cm|Height 1.5 cm|Each tile/);
});
