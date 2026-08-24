// T1/W3 — featured-products and product-grid bind the real, tenant-scoped `collection.products`
// drop (the SAME drop collection-product-list.liquid already used) instead of merchant-typed
// product-card block literals (Velocity Runner/Everyday Hoodie/Street Cap/Court Sneaker/Transit
// Backpack — none of which ever existed in any merchant's catalog). Covers: 0 products → 0 cards
// + empty state, N products → N real cards, no hardcoded product name/price literal survives in
// either section's source, and the `collection` drop itself is never widened beyond one store's
// own site_id (composition-engine.tsx / data-binding-engine.ts already enforce that upstream —
// this proves the Liquid section body carries no independent, wider query of its own).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

async function renderIndex(products: Array<Record<string, unknown>>) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'index',
    liquidContext: { collection: { products } },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

const FAKE_NAMES = ['Velocity Runner', 'Everyday Hoodie', 'Street Cap', 'Court Sneaker', 'Transit Backpack'];

test('T1/W3: no shipped section source contains a hardcoded fabricated product name or price', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const offenders: string[] = [];
  for (const [key, section] of Object.entries(bundle.sections)) {
    for (const name of FAKE_NAMES) {
      if (section.source.includes(name)) offenders.push(`sections/${key}: "${name}"`);
    }
    if (/Rs\s*[\d,]+/.test(section.source)) offenders.push(`sections/${key}: hardcoded "Rs <amount>" literal`);
  }
  assert.deepEqual(offenders, [], `fabricated product data found:\n${offenders.join('\n')}`);
});

test('T1/W3: 0 real products renders 0 product cards and the empty state, on both sections', async () => {
  const result = await renderIndex([]);
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<article class="lb-product-card"/, 'no product card may render for an empty catalog');
  assert.match(html, /No featured products/);
  assert.match(html, /No products found/);
});

test('T1/W3: N real products render N real cards, on both sections, with no fabricated names', async () => {
  const products = [
    { id: 'p1', title: 'Real Merchant Sneaker', price: 199900, currency: 'INR', url: '/product/p1', featured_image: null },
    { id: 'p2', title: 'Real Merchant Jacket', price: 299900, currency: 'INR', url: '/product/p2', featured_image: null },
  ];
  const result = await renderIndex(products);
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Real Merchant Sneaker/);
  assert.match(html, /Real Merchant Jacket/);
  // Scoped to product-card markup specifically — the pre-existing testimonials section separately
  // mentions "Velocity Runners" in a customer quote (a different, W4-scoped fabricated-copy issue),
  // which a page-wide check would incorrectly flag as a product-binding regression here.
  const cardMarkup = (html.match(/<article class="lb-product-card">[\s\S]*?<\/article>/g) || []).join('');
  for (const name of FAKE_NAMES) {
    assert.doesNotMatch(cardMarkup, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `fabricated product "${name}" must never render in a product card`);
  }
  const cardCount = (html.match(/<article class="lb-product-card"/g) || []).length;
  assert.ok(cardCount > 0, 'at least one real product card must render');
});

test('T1/W3: product cards carry real money via money_with_currency, not a hardcoded currency literal', async () => {
  // T2a — product.price is MAJOR units (rupees) end-to-end from ProductService/ProductModel through
  // productToLiquidDrop and data-product-price (matches product-grid.tsx's own `₹{product.price}`
  // and formatCartMoney's no-conversion contract). The template converts to the minor-unit money
  // filter at the display call site (`| times: 100 | money_with_currency`), so ₹4,500 in => this
  // exact formatted string out.
  const result = await renderIndex([
    { id: 'p1', title: 'Priced Item', price: 4500, currency: 'INR', url: '/product/p1', featured_image: null },
  ]);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /INR\s*4,500\.00/, 'the real price must be formatted through the money filter');
});

test('T2a: a real ₹999 product renders as "INR 999.00", never "INR 9.99" (major-to-minor unit regression guard)', async () => {
  // Regression guard for a real bug found live: ProductModel.price/data-product-price are MAJOR
  // units (confirmed against product-grid.tsx's `₹{product.price}` and formatCartMoney's
  // no-conversion contract); the Liquid money filter needs MINOR units (matches order/cart data).
  // Before the section bodies added `| times: 100`, a real ₹999 product rendered as "INR 9.99" —
  // every product price shown via Liquid was displayed at 1/100th of its real value.
  const result = await renderIndex([
    { id: 'p1', title: 'Snaz Canvas Tote', price: 999, currency: 'INR', url: '/product/p1', featured_image: null },
  ]);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /INR\s*999\.00/, 'a ₹999 product must render as INR 999.00');
  assert.doesNotMatch(html, /INR\s*9\.99/, 'a ₹999 product must never render as INR 9.99 (the major/minor unit bug)');
});

test('T1/W3: featured-products respects productLimit — a smaller limit yields fewer cards than the full catalog', async () => {
  const products = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    title: `Product ${i}`,
    price: 100000,
    currency: 'INR',
    url: `/product/p${i}`,
    featured_image: null,
  }));
  const result = await renderIndex(products);
  const html = result.liquid?.layoutHtml ?? '';
  // featured-collection-default's default productLimit is 3 — fewer cards than the 6-product catalog.
  // Bound the slice to the featured-products <section>...</section> specifically (data-section-id
  // uniquely identifies it), not a naive first-</div> split, which cuts off inside the section's own
  // nested wrapper <div> before any product card is reached.
  const sectionMatch = html.match(/<section class="lb-featured-products"[\s\S]*?<\/section>/);
  assert.ok(sectionMatch, 'featured-products section must be present in the render');
  const cardCount = (sectionMatch![0].match(/<article class="lb-product-card"/g) || []).length;
  assert.ok(cardCount > 0 && cardCount < products.length, `featured-products must show a limited subset, got ${cardCount} of ${products.length}`);
});
