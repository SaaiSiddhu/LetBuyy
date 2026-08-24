// L10 — Customer Accounts (Full Liquid V1). The `customers/account` template renders the auth-gated
// account over the existing /api/customer/* APIs: greeting from the customer drop, nav, logged-out fallback.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

async function renderAccount(customer) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/account', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'customers/account', type: 'customers/account', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'customers/account',
    liquidContext: { customer },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L10: bundle ships a customers/account template', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates['customers/account'], 'account template must exist');
  assert.ok(bundle.sections['customer-account'], 'customer-account section must exist');
});

test('L10: logged-in account renders the customer greeting + nav', async () => {
  const result = await renderAccount({ name: 'Ravi K', email: 'ravi@example.in' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Signed in as Ravi K/);
  assert.match(html, /href="\/store\/local-kicks\/account\/orders"/);
  // F7: logout is now a POST form (lb-logout island + no-JS fallback), not a GET anchor.
  // Verify the form POSTs to the correct endpoint rather than an anchor href.
  assert.match(html, /method="post"/);
  assert.match(html, /action="\/api\/customer\/logout"/);
  // The old GET anchor must not be present (regression guard).
  assert.doesNotMatch(html, /<a[^>]+href="\/api\/customer\/logout"/);
});

test('L10: logged-out account renders the sign-in prompt (auth-gated)', async () => {
  const result = await renderAccount(null);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /lb-account__guest/);
  assert.match(html, /href="\/store\/local-kicks\/customers\/login"/);
  assert.doesNotMatch(html, /Signed in as/);
});

test('L10: customer PII is escaped', async () => {
  const result = await renderAccount({ name: '<script>alert(1)</script>', email: 'x@y.z' });
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i);
});
