// L12 — Order Tracking (Full Liquid V1). The order-detail template renders the status timeline + tracking
// number/carrier (manual-fulfillment V1 — merchant-entered tracking). Read-only status display, no money path.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

function renderOrder(order) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/account/orders/o1', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'customers/order', type: 'customers/order', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'customers/order',
    liquidContext: { buyer: { email: 'buyer@example.test' }, order },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

const SHIPPED = {
  number: '1001', status: 'shipped', total: 749900, currency: 'INR',
  line_items: [{ title: 'Apex Runner', quantity: 1, line_price: 749900 }],
  tracking_number: 'SR123456789', carrier: 'Shiprocket',
  timeline: [
    { label: 'Placed', reached: true },
    { label: 'Confirmed', reached: true },
    { label: 'Shipped', reached: true },
    { label: 'Delivered', reached: false },
  ],
};

test('L12: order detail renders the status timeline with reached states', async () => {
  const result = await renderOrder(SHIPPED);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /lb-order-detail__timeline/);
  assert.match(html, /lb-order-detail__step is-reached">Placed/);
  assert.match(html, /lb-order-detail__step is-reached">Shipped/);
  assert.match(html, /lb-order-detail__step">Delivered/);   // not reached -> no is-reached
});

test('L12: tracking number + carrier render when present', async () => {
  const html = (await renderOrder(SHIPPED)).liquid?.layoutHtml ?? '';
  assert.match(html, /Tracking:\s*SR123456789\s*\(Shiprocket\)/);
});

test('L12: pre-ship order shows no tracking line', async () => {
  const html = (await renderOrder({ ...SHIPPED, status: 'confirmed', tracking_number: '', carrier: '' })).liquid?.layoutHtml ?? '';
  assert.match(html, /lb-order-detail__timeline/);
  assert.doesNotMatch(html, /lb-order-detail__tracking/);
});

test('L12: tracking strings are escaped', async () => {
  const html = (await renderOrder({ ...SHIPPED, tracking_number: '<script>alert(1)</script>' })).liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i);
});
