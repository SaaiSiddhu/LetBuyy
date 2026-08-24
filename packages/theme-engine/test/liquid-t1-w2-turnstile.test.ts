// T1/W2 — Turnstile on the customer register/login forms. The <lb-turnstile> island writes a
// solved token into a sibling hidden <input name="turnstileToken">; the server-side check in
// /api/customer/register|login (verifyTurnstileToken) is untouched — this only makes the widget
// actually reach the form (it previously did not exist in the Liquid section at all, so every
// submission had an empty token and TURNSTILE_REQUIRED always fired for real customers too).
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

test('T1/W2: customer-register form includes the lb-turnstile island and a hidden turnstileToken field', async () => {
  const result = await renderTemplate('customers/register');
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<lb-turnstile[^>]*>/, 'lb-turnstile island must be present');
  assert.match(html, /<input type="hidden" name="turnstileToken" value="">/, 'hidden turnstileToken input must be present');
});

test('T1/W2: customer-login form includes the lb-turnstile island and a hidden turnstileToken field', async () => {
  const result = await renderTemplate('customers/login');
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<lb-turnstile[^>]*>/, 'lb-turnstile island must be present');
  assert.match(html, /<input type="hidden" name="turnstileToken" value="">/, 'hidden turnstileToken input must be present');
});

test('T1/W2: register form still posts to the real /api/customer/register endpoint (no bypass introduced)', async () => {
  const result = await renderTemplate('customers/register');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /action="\/api\/customer\/register"/);
  assert.match(html, /method="post"/);
});

test('T1/W2: login form still posts to the real /api/customer/login endpoint (no bypass introduced)', async () => {
  const result = await renderTemplate('customers/login');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /action="\/api\/customer\/login"/);
  assert.match(html, /method="post"/);
});

test('T1/W2: ?error=bot_verification renders a human-readable message, not the raw code', async () => {
  const result = await renderTemplate('customers/register', { error: 'bot_verification' });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /We could not verify you are not a robot/);
  assert.doesNotMatch(html, />bot_verification</, 'the raw error code must never be shown verbatim to a shopper');
});

test('T1/W2: ?error=account_exists renders a human-readable message on register', async () => {
  const result = await renderTemplate('customers/register', { error: 'account_exists' });
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /An account with this email already exists/);
});

test('T1/W2: no error state renders no error banner', async () => {
  const result = await renderTemplate('customers/login');
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /lb-auth__error/);
});

test('T1/W2: lb-turnstile survives DOMPurify sanitization (allowlisted custom element)', async () => {
  const result = await renderTemplate('customers/register');
  const html = result.liquid?.layoutHtml ?? '';
  // If the tag were stripped, the sanitizer would leave nothing named lb-turnstile at all — this
  // is the same class of check as L4's "chrome is sanitized" but confirms presence, not absence.
  assert.match(html, /<lb-turnstile data-lb-island="turnstile"><\/lb-turnstile>/);
});
