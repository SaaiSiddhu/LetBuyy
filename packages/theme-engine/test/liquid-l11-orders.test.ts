// L11 — Orders use the canonical LetBuyy buyer-order link and verified storefront reader.
// the existing read APIs. Totals are display of already-ledgered values (read-only; no money mutation).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

function render(templateKey, liquidContext, searchParams = {}) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/' + templateKey, previewMode: true, locale: 'en', searchParams },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: templateKey, type: templateKey, layoutKey: 'theme', sections: [] },
    liquidTemplateKey: templateKey,
    liquidContext,
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L11: bundle ships customers/orders + customers/order templates', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates['customers/orders'], 'orders history template');
  assert.ok(bundle.templates['customers/order'], 'order detail template');
});

test('L11: order history lists only canonical buyer orders', async () => {
  const result = await render('customers/orders', {
    buyer: { email: 'buyer@example.test', orders: [
      { id: 'o1', number: '1001', status: 'shipped', total: 749900, currency: 'INR' },
      { id: 'o2', number: '1002', status: 'delivered', total: 559900, currency: 'INR' },
    ] },
  });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /#1001/);
  assert.match(html, /#1002/);
  assert.match(html, /href="\/store\/local-kicks\/account\/orders\/o1"/);
  assert.match(html, /<form[^>]+method="post"[^>]+action="\/api\/buyer\/orders"/);
  assert.match(html, /name="return_to" value="\/store\/local-kicks\/account\/orders"/);
});

test('L11: historical claim status is rendered safely on the buyer order list', async () => {
  const result = await render('customers/orders', {
    buyer: { email: 'buyer@example.test', orders: [] },
  }, { buyer_claim: 'partial' });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Some eligible orders could not be linked/);
  assert.match(html, /aria-live="polite"/);
});

test('L11: order detail binds line items, status, and the already-ledgered total', async () => {
  const result = await render('customers/order', {
    buyer: { email: 'buyer@example.test' },
    order: { number: '1001', status: 'shipped', total: 749900, currency: 'INR', line_items: [{ title: 'Apex Runner', quantity: 1, line_price: 749900 }] },
  });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Order #1001/);
  assert.match(html, /Status:\s*shipped/);
  assert.match(html, /Apex Runner/);
  assert.match(html, /Total:\s*INR\s*7,499\.00/);
});

test('L11: empty history + missing order render their empty states; PII escaped', async () => {
  const empty = (await render('customers/orders', { buyer: { email: 'buyer@example.test', orders: [] } })).liquid?.layoutHtml ?? '';
  assert.match(empty, /lb-orders__empty/);
  const missing = (await render('customers/order', { buyer: { email: 'buyer@example.test' }, order: null })).liquid?.layoutHtml ?? '';
  assert.match(missing, /lb-order-detail__missing/);
  const guest = (await render('customers/order', { order: null })).liquid?.layoutHtml ?? '';
  assert.match(guest, /sign in with LetBuyy/);
  const legacyOnly = (await render('customers/orders', { customer: { orders: [{ id: 'unlinked', number: 'LEAK', total: 1 }] } })).liquid?.layoutHtml ?? '';
  assert.doesNotMatch(legacyOnly, /LEAK/);
  const hostile = (await render('customers/order', { buyer: { email: 'buyer@example.test' }, order: { number: '<script>alert(1)</script>', status: 'x', total: 1, currency: 'INR', line_items: [] } })).liquid?.layoutHtml ?? '';
  assert.doesNotMatch(hostile, /<script/i);
});
