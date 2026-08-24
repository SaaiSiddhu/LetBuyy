// L6 — Collection Experience (Full Liquid V1). The `collection` template binds the REAL collection
// title/description (no longer discarded) + iterates collection.products through the product-grid.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

const COLLECTION = {
  title: 'New Arrivals',
  description: 'The freshest drops this week.',
  products: [
    { title: 'Apex Runner', price: 749900, currency: 'INR', url: '/product/p1' },
    { title: 'Street Glide', price: 559900, currency: 'INR', url: '/product/p2' },
  ],
};

async function renderCollection(collection = COLLECTION) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/collections/new-arrivals', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'collection', type: 'collection', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'collection',
    liquidContext: { collection },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L6: the bundle ships a collection template', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates.collection, 'collection template must exist');
  assert.ok(bundle.sections['collection-banner'], 'collection-banner section must exist');
});

test('L6: collection page binds real title/description + the product loop', async () => {
  const result = await renderCollection();
  assert.equal(result.status, 'rendered');
  assert.equal(result.liquid?.templateKey, 'collection');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<h1>New Arrivals<\/h1>/);                  // {{ collection.title }} (was discarded before)
  assert.match(html, /freshest drops this week/i);                // {{ collection.description }}
  assert.match(html, /<h3 class="lb-product-card__title">Apex Runner<\/h3>/);            // {% for item in collection.products %}
  assert.match(html, /<h3 class="lb-product-card__title">Street Glide<\/h3>/);
});

test('L6: empty collection renders the banner without product cards (empty state)', async () => {
  const result = await renderCollection({ title: 'Empty', description: '', products: [] });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<h1>Empty<\/h1>/);
  assert.doesNotMatch(html, /<article class="lb-product-card"/); // rendered card markup, not the CSS class
});

test('L6: hostile collection strings are escaped', async () => {
  const result = await renderCollection({ ...COLLECTION, title: '<script>alert(1)</script>' });
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i);
});

// E7: collection-banner improvements — image_url and product count.
// Data source VERIFIED: image_url field available from public-routes.ts line 989 (collection endpoint).
// Product count: collection.products.size — the flat product array returned by the endpoint.

test('L6(e): collection-banner renders image when collection.image_url is set', async () => {
  const result = await renderCollection({ ...COLLECTION, image_url: 'https://cdn.example.com/banner.jpg' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /lb-collection-banner__image/, 'image element must appear when image_url is set');
  assert.match(html, /src="https:\/\/cdn\.example\.com\/banner\.jpg"/, 'image src must be the image_url');
});

test('L6(f): collection-banner renders product count from collection.products.size', async () => {
  const result = await renderCollection(COLLECTION);
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  // COLLECTION has 2 products — should render "2 products"
  assert.match(html, /2 products/, 'product count must appear when collection has products');
});

test('L6(g): collection-banner omits image when image_url is null or blank', async () => {
  const resultNull = await renderCollection({ ...COLLECTION, image_url: null });
  const resultBlank = await renderCollection({ ...COLLECTION, image_url: '' });
  assert.doesNotMatch(resultNull.liquid?.layoutHtml ?? '', /lb-collection-banner__image/, 'image must not render when image_url is null');
  assert.doesNotMatch(resultBlank.liquid?.layoutHtml ?? '', /lb-collection-banner__image/, 'image must not render when image_url is blank');
});
