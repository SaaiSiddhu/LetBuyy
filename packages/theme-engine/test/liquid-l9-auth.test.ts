// L9 — Customer Registration (engine templates only). Liquid customers/login + customers/register render.
// NOTE: the live register flow is BLOCKED on LB-12 (POST /storefront/customer/register does not yet exist);
// see EXECUTABLE_HUMAN_REQUIRED.md HR-LB12-REGISTER. Login posts to the existing /api/customer/login.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

async function renderAuth(templateKey) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/' + templateKey, previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: templateKey, type: templateKey, layoutKey: 'theme', sections: [] },
    liquidTemplateKey: templateKey,
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L9: bundle ships customers/login + customers/register templates', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates['customers/login'], 'login template must exist');
  assert.ok(bundle.templates['customers/register'], 'register template must exist');
});

test('L9: login template renders a form posting to the existing /api/customer/login', async () => {
  const result = await renderAuth('customers/login');
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<form[^>]+action="\/api\/customer\/login"/);
  assert.match(html, /name="email"/);
  assert.match(html, /type="password"/);
});

test('L9: register template renders a form posting to the (LB-12) register endpoint', async () => {
  const result = await renderAuth('customers/register');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<form[^>]+action="\/api\/customer\/register"/);
  assert.match(html, /name="email"/);
  assert.match(html, /name="password"/);
});

test('L9: auth pages are sanitized (no active content) — auth surface, highest care', async () => {
  const html = (await renderAuth('customers/login')).liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /\son\w+=/i);
});
