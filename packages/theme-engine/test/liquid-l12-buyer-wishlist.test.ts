import assert from 'node:assert/strict';
import test from 'node:test';
import { LiquidRenderer, createUrbanKicksLiquidThemeBundleFixture, DEFAULT_THEME_SETTINGS } from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

function render(buyer_wishlist: Record<string, unknown> | null, customer: Record<string, unknown> | null = null) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/account/wishlist', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'customers/wishlist', type: 'customers/wishlist', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'customers/wishlist',
    liquidContext: { buyer_wishlist, customer },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('Liquid wishlist renders only products from the linked canonical buyer relationship', async () => {
  const result = await render({
    authenticated: true,
    linked: true,
    unavailable: false,
    storeAccountUnavailable: false,
    products: [{ id: 'product-1', title: 'Synthetic product', price: 12, currency: 'INR', url: '/store/local-kicks/product/product-1' }],
  }, { email: 'legacy-must-not-render@example.test', wishlist_products: [] });
  const html = result.liquid?.layoutHtml ?? '';
  assert.equal(result.status, 'rendered');
  assert.match(html, /Synthetic product/);
  assert.match(html, /data-account-type="buyer"/);
  assert.match(html, /data-buyer-linked="true"/);
  assert.doesNotMatch(html, /legacy-must-not-render@example\.test/);
});

test('Liquid wishlist gives an explicit connect, unavailable and guest state', async () => {
  const unlinked = (await render({ authenticated: true, linked: false, unavailable: false, storeAccountUnavailable: false, products: [] })).liquid?.layoutHtml ?? '';
  assert.match(unlinked, /Connect your verified store account/);
  assert.match(unlinked, /account\/settings/);
  assert.doesNotMatch(unlinked, /sign in<\/a> to view your wishlist/);

  const unavailable = (await render({ authenticated: true, linked: false, unavailable: true, storeAccountUnavailable: false, products: [] })).liquid?.layoutHtml ?? '';
  assert.match(unavailable, /Your wishlist is temporarily unavailable/);
  assert.doesNotMatch(unavailable, /Your wishlist is empty/);

  const storeAccountUnavailable = (await render({ authenticated: true, linked: false, unavailable: false, storeAccountUnavailable: true, products: [] })).liquid?.layoutHtml ?? '';
  assert.match(storeAccountUnavailable, /This store account is unavailable/);
  assert.doesNotMatch(storeAccountUnavailable, /Connect your verified store account/);

  const guest = (await render(null)).liquid?.layoutHtml ?? '';
  assert.match(guest, /lb-wishlist__guest/);
  assert.match(guest, /sign in/);
});
