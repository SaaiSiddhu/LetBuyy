// F7-Lane-A — lb-logout hydration island (theme-bundle.ts side).
// Verifies the customer-account section source ships the lb-logout island pattern with a no-JS
// <form method="post"> fallback, and that the rendered HTML contains the expected markup
// (DOMPurify passes lb-logout through ADD_TAGS + tagNameCheck).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '22222222-2222-4222-8222-222222222222';

// ---------- Bundle source contract ----------

test('F7: customer-account section source contains lb-logout element', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const section = bundle.sections['customer-account'];
  assert.ok(section, 'customer-account section must exist');
  assert.match(section.source, /lb-logout/, 'section source must contain lb-logout custom element');
});

test('F7: customer-account section source contains form method="post"', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const section = bundle.sections['customer-account'];
  assert.ok(section, 'customer-account section must exist');
  assert.match(section.source, /<form[^>]+method="post"/, 'section source must contain no-JS form fallback');
});

test('F7: customer-account section source does NOT contain GET anchor for logout', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const section = bundle.sections['customer-account'];
  assert.ok(section, 'customer-account section must exist');
  // The old pattern was: <a href="/api/customer/logout">Sign out</a>
  // This must be gone — the lb-logout island replaces it.
  assert.doesNotMatch(
    section.source,
    /<a[^>]+href="\/api\/customer\/logout"/,
    'section source must NOT contain a GET anchor for logout (CSRF risk)',
  );
});

test('F7: customer-account section source contains data-logout-url Liquid binding', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const section = bundle.sections['customer-account'];
  assert.ok(section, 'customer-account section must exist');
  assert.match(
    section.source,
    /data-logout-url="{{ routes\.account_logout_url }}"/,
    'lb-logout must bind data-logout-url to the routes drop',
  );
});

// ---------- Rendered HTML contract ----------

async function renderAccount(customer: unknown) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'test-kicks', path: '/account', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'customers/account', type: 'customers/account', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'customers/account',
    liquidContext: { customer },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('F7: rendered logged-in account HTML contains lb-logout island', async () => {
  const result = await renderAccount({ name: 'Test User', email: 'test@example.com' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  // DOMPurify must pass lb-logout through (ADD_TAGS + tagNameCheck allowlist).
  assert.match(html, /lb-logout/, 'rendered HTML must contain lb-logout element (DOMPurify allowlist check)');
});

test('F7: rendered logged-in account HTML contains no-JS form POST to logout URL', async () => {
  const result = await renderAccount({ name: 'Test User', email: 'test@example.com' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /method="post"/, 'no-JS form fallback must use POST method');
  assert.match(html, /action="\/api\/customer\/logout"/, 'form must POST to the logout endpoint');
});

test('F7: rendered logged-in account HTML does NOT contain GET anchor for logout', async () => {
  const result = await renderAccount({ name: 'Test User', email: 'test@example.com' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(
    html,
    /<a[^>]+href="\/api\/customer\/logout"/,
    'rendered HTML must not contain a plain GET logout anchor',
  );
});

test('F7: lb-logout renders with data-logout-url attribute intact after sanitization', async () => {
  const result = await renderAccount({ name: 'Test User', email: 'test@example.com' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(
    html,
    /data-logout-url="\/api\/customer\/logout"/,
    'data-logout-url must survive DOMPurify (ADD_ATTR allowlist check)',
  );
});
