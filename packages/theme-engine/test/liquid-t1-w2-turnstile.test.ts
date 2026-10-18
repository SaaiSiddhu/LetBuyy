// T1/W2 — Turnstile protects the transitional per-store login form. New registration goes through
// identity-platform and no longer creates store-scoped password credentials.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

async function renderTemplate(templateKey: string, searchParams?: Record<string, string>) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: `/${templateKey}`, previewMode: true, locale: 'en', searchParams },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: templateKey, type: templateKey, layoutKey: 'theme', sections: [] },
    liquidTemplateKey: templateKey,
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('T1/W2: customer-register page directs new account creation to canonical buyer identity', async () => {
  const result = await renderTemplate('customers/register');
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /href="\/api\/buyer-auth\/start\?return_to=/);
  assert.match(html, /href="\/store\/local-kicks\/customers\/login">Sign in to connect it with your verified LetBuyy account/);
  assert.doesNotMatch(html, /<lb-turnstile|name="password"/);
});

test('T1/W2: customer-login form includes the lb-turnstile island and a hidden turnstileToken field', async () => {
  const result = await renderTemplate('customers/login');
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<lb-turnstile[^>]*>/, 'lb-turnstile island must be present');
  assert.match(html, /<input type="hidden" name="turnstileToken" value="">/, 'hidden turnstileToken input must be present');
});

test('Phase 2: existing store customers can start explicit verified-account linking from sign-in', async () => {
  const result = await renderTemplate('customers/login');
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<form[^>]+action="\/api\/buyer-auth\/start"[^>]*>/);
  assert.match(html, /name="intent" value="link_store_customer"/);
  assert.match(html, /name="return_to" value="\/store\/local-kicks\/account"/);
  assert.match(html, /Connect my store account/);
});

test('T1/W2: canonical registration page does not create a per-store password login', async () => {
  const result = await renderTemplate('customers/register');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /\/api\/buyer-auth\/start\?return_to=/);
  assert.doesNotMatch(html, /action="\/api\/customer\/register"/);
  assert.doesNotMatch(html, /name="password"/);
});

test('T1/W2: login form still posts to the real /api/customer/login endpoint (no bypass introduced)', async () => {
  const result = await renderTemplate('customers/login');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /action="\/api\/customer\/login"/);
  assert.match(html, /method="post"/);
});

test('T1/W2: no error state renders no error banner', async () => {
  const result = await renderTemplate('customers/login');
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /lb-auth__error/);
});

test('T1/W2: lb-turnstile survives DOMPurify sanitization (allowlisted custom element)', async () => {
  const result = await renderTemplate('customers/login');
  const html = result.liquid?.layoutHtml ?? '';
  // If the tag were stripped, the sanitizer would leave nothing named lb-turnstile at all — this
  // is the same class of check as L4's "chrome is sanitized" but confirms presence, not absence.
  assert.match(html, /<lb-turnstile data-lb-island="turnstile"><\/lb-turnstile>/);
});
