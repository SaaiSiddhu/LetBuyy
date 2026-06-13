// L8 — Cart Migration (Full Liquid V1). The `cart` template renders the shared server cart: line items,
// server-authoritative total, and a checkout link that uses the SIGNED handoff URL (no client totals).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

const CART = {
  item_count: 2,
  currency: 'INR',
  total_price: 1309800,
  checkout_url: '/checkout?handoff=ct_signed_abc',
  items: [
    { title: 'Apex Runner', quantity: 1, line_price: 749900 },
    { title: 'Street Glide', quantity: 1, line_price: 559900 },
  ],
};

async function renderCart(cart = CART) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/cart', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'cart', type: 'cart', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'cart',
    liquidContext: { cart },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L8: bundle ships a cart template + cart-summary section', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates.cart, 'cart template must exist');
  assert.ok(bundle.sections['cart-summary'], 'cart-summary section must exist');
});

test('L8: cart page renders line items, server total, and the SIGNED checkout handoff', async () => {
  const result = await renderCart();
  assert.equal(result.status, 'rendered');
  assert.equal(result.liquid?.templateKey, 'cart');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Apex Runner/);
  assert.match(html, /Street Glide/);
  assert.match(html, /Total:\s*INR\s*13,098\.00/);                         // server-authoritative total
  assert.match(html, /href="\/checkout\?handoff=ct_signed_abc"/);          // signed handoff, not a client total
});

test('L8: empty cart renders an empty state (no checkout link)', async () => {
  const result = await renderCart({ item_count: 0, items: [], total_price: 0, currency: 'INR', checkout_url: '' });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /lb-cart__empty/);
  assert.doesNotMatch(html, /lb-cart__checkout/);
});

test('L8: hostile cart line strings are escaped', async () => {
  const result = await renderCart({ ...CART, items: [{ title: '<script>alert(1)</script>', quantity: 1, line_price: 1 }] });
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i);
});
