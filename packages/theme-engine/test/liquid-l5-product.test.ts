// L5 — Product Experience (Full Liquid V1). The `product` template renders the product-detail section
// against a real `product` drop: title, images, money-formatted price, and a server-backed add-to-cart island.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

const PRODUCT = {
  id: 'prod_42',
  title: 'Apex Runner',
  description: 'Featherlight street runner.',
  price: 749900,
  currency: 'INR',
  url: '/product/prod_42',
  images: ['https://cdn.example/apex-1.jpg', 'https://cdn.example/apex-2.jpg'],
};

async function renderProduct(product = PRODUCT) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/product/prod_42', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'product',
    liquidContext: { product },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L5: the bundle ships a product template (no longer index-fallback)', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates.product, 'product template must exist');
  assert.equal(bundle.templates.product.sections['product-detail-default'].type, 'product-detail');
});

test('L5: product page binds real product data + money-formatted price', async () => {
  const result = await renderProduct();
  assert.equal(result.status, 'rendered');
  assert.equal(result.liquid?.templateKey, 'product');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<h1>Apex Runner<\/h1>/);            // {{ product.title }}
  assert.match(html, /apex-1\.jpg/);                       // {% for image in product.images %}
  assert.match(html, /Featherlight street runner/);        // {{ product.description }}
  assert.match(html, /7,?499/);                            // money_with_currency formats the paise price
});

test('L5: product page exposes a server-backed add-to-cart island (not raw client price trust)', async () => {
  const result = await renderProduct();
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /lb-add-to-cart/);
  assert.match(html, /data-product-id="prod_42"/);
  assert.match(html, /data-lb-add-to-cart/);
});

test('L5: hostile product strings are escaped, never raw-injected', async () => {
  const result = await renderProduct({ ...PRODUCT, title: '<script>alert(1)</script>', description: '<img src=x onerror=alert(2)>' });
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img[^>]*onerror=/i);
});
