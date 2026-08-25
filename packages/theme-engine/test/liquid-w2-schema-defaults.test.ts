// W2 (PHASE-T3) — Section schema-default resolution. A composed section's `settings` object
// only carries the keys someone actually set; a key absent from it must fall back to its
// {% schema %} field `default` at render time. Before this fix nothing ever performed that
// merge, so `settings: {}` rendered blank text instead of the declared default — a defect that
// hits any section a merchant adds through the theme editor without touching every field,
// which is exactly why T2b had to hand-write explicit values into 9 template compositions in
// theme-bundle.ts as a stopgap (still in place; see theme-bundle.ts's `cart`, `customers/*`
// template compositions).
//
// Precedence proven here: explicit merchant value (including a deliberately empty string) >
// schema default > genuinely nothing (a field with no declared default that is also absent).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

async function renderCartWithHeadingSettings(headingSettings: Record<string, unknown>) {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  // cart-summary's schema declares `heading` with default: 'Your cart' (theme-bundle.ts).
  // Overriding the stock composition's settings in-test isolates this from T2b's own workaround
  // value (which happens to also be 'Your cart' — clearing it here removes that coincidence).
  bundle.templates.cart!.sections['cart-summary-default']!.settings = headingSettings;
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/cart', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'cart', type: 'cart', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'cart',
    liquidContext: { cart: { item_count: 0, items: [], total_price: 0, currency: 'INR', checkout_url: '' } },
    liquidBundle: bundle,
  });
}

test('W2: settings: {} (key genuinely absent) renders the schema default', async () => {
  const result = await renderCartWithHeadingSettings({});
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<h1>Your cart<\/h1>/, 'the cart-summary schema default ("Your cart") must render when heading is absent');
});

test('W2: an explicit merchant value overrides the schema default', async () => {
  const result = await renderCartWithHeadingSettings({ heading: 'Shopping Bag' });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<h1>Shopping Bag<\/h1>/);
  assert.doesNotMatch(html, /<h1>Your cart<\/h1>/, 'the schema default must not appear once an explicit value is set');
});

test('W2: a deliberately empty explicit value is respected, not overwritten by the default', async () => {
  const result = await renderCartWithHeadingSettings({ heading: '' });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<h1><\/h1>/, 'an explicit empty string is an own key and must survive untouched');
  assert.doesNotMatch(html, /<h1>Your cart<\/h1>/, 'the default must never overwrite a key the merchant deliberately set, even to empty');
});

test('W2: a field with no declared default renders nothing when absent, not "undefined"/"null" text', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  // app-block-slot's `title` field has no default (theme-bundle.ts); the section body only
  // emits the <h2> when section.settings.title is truthy.
  bundle.templates.cart!.sections['app-block-slot-test'] = { type: 'app-block-slot', settings: {} };
  bundle.templates.cart!.order = [...bundle.templates.cart!.order, 'app-block-slot-test'];
  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/cart', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'cart', type: 'cart', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'cart',
    liquidContext: { cart: { item_count: 0, items: [], total_price: 0, currency: 'INR', checkout_url: '' } },
    liquidBundle: bundle,
  });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /lb-app-block-slot/, 'the section itself must still render');
  assert.doesNotMatch(html, /<h2>/, 'no <h2> should render when title has no default and was never set');
  assert.doesNotMatch(html, /undefined|null/i, 'a missing-default field must never leak "undefined"/"null" text');
});

test('W2: two different sections resolve their own field\'s default independently (search-box placeholder)', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  bundle.templates.cart!.sections['search-box-test'] = { type: 'search-box', settings: {} };
  bundle.templates.cart!.order = [...bundle.templates.cart!.order, 'search-box-test'];
  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/cart', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'cart', type: 'cart', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'cart',
    liquidContext: { cart: { item_count: 0, items: [], total_price: 0, currency: 'INR', checkout_url: '' } },
    liquidBundle: bundle,
  });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /placeholder="Search products"/, 'search-box\'s own schema default must apply independently of cart-summary\'s');
});
