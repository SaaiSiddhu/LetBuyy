// L9 — Liquid login remains a transitional store-customer form; new buyer registration uses identity-platform.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LiquidRenderer,
  createLetbuyyCoreLiquidThemeBundleFixture,
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

test('L9: register template creates accounts through canonical buyer sign-in only', async () => {
  const result = await renderAuth('customers/register');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /href="\/api\/buyer-auth\/start\?return_to=/);
  assert.match(html, /Create or sign in with LetBuyy/);
  assert.doesNotMatch(html, /action="\/api\/customer\/register"/);
  assert.doesNotMatch(html, /name="password"/);
});

test('L9: auth pages are sanitized (no active content) — auth surface, highest care', async () => {
  const html = (await renderAuth('customers/login')).liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /\son\w+=/i);
});

// ============================================================================
// D10 — Registration wiring verification (static contract tests)
// ============================================================================

test('legacy registration API remains as a fail-closed compatibility endpoint', () => {
  const routePath = resolve(
    import.meta.dirname ?? __dirname,
    '../../../apps/commerce/web/src/app/api/customer/register/route.ts',
  );
  let routeSource: string;
  try {
    routeSource = readFileSync(routePath, 'utf-8');
  } catch {
    assert.fail(`Route file not found at expected path: ${routePath}. LB-12 wiring verification failed.`);
  }
  assert.match(routeSource, /export\s+async\s+function\s+POST/, 'route must export an async POST handler');
  assert.match(routeSource, /CANONICAL_BUYER_ACCOUNT_REQUIRED/);
  assert.doesNotMatch(routeSource, /\.registerCustomer\(/, 'legacy register endpoint must not mint a per-store login');
});

// ============================================================================
// E8 — Login D10 parity (static contract tests)
// ============================================================================

test('E8 login section source contains hidden storeId field (D10 parity)', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const loginSection = bundle.sections['customer-login'];
  assert.ok(loginSection, 'customer-login section must exist in bundle');
  assert.match(
    loginSection.source,
    /name="storeId"/,
    'customer-login section source must contain hidden storeId field (D10 parity with register)',
  );
});

test('E8 login section storeId field uses shop.id value', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const loginSection = bundle.sections['customer-login'];
  assert.ok(loginSection, 'customer-login section must exist in bundle');
  assert.match(
    loginSection.source,
    /value="{{ shop\.id }}"/,
    'storeId hidden field must bind to {{ shop.id }}',
  );
});

test('register Liquid template offers canonical creation and a path for legacy account linking', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const registerTemplate = bundle.templates['customers/register'];
  assert.ok(registerTemplate, 'customers/register template must exist in bundle');

  // The register template sections must contain a section whose source has the register action.
  const sectionTypes = Object.values(registerTemplate.sections).map((s) => s.type);
  assert.ok(sectionTypes.length > 0, 'register template must have at least one section');

  // Check the section source in the bundle for canonical sign-in and legacy-account recovery.
  const registerSectionType = sectionTypes[0];
  const registerSection = bundle.sections[registerSectionType!];
  assert.ok(registerSection, `register section type "${registerSectionType}" must exist in bundle sections`);
  assert.match(registerSection.source, /\/api\/buyer-auth\/start\?return_to={{ routes\.account_url }}/);
  assert.match(registerSection.source, /routes\.customer_login_url/);
  assert.doesNotMatch(registerSection.source, /action="\/api\/customer\/register"/);
});

test('APPID-P4c canonical buyer sign-up is offered from both login and registration entry points', async () => {
  for (const bundle of [createUrbanKicksLiquidThemeBundleFixture(), createLetbuyyCoreLiquidThemeBundleFixture()]) {
    const login = bundle.sections['customer-login'];
    const register = bundle.sections['customer-register'];
    assert.ok(login, 'customer-login section must exist');
    assert.ok(register, 'customer-register section must exist');
    assert.match(login.source, /href="\/api\/buyer-auth\/start\?return_to={{ routes\.account_url }}"[^>]*>Continue with LetBuyy/);
    assert.match(register.source, /href="\/api\/buyer-auth\/start\?return_to={{ routes\.account_url }}"[^>]*>Create or sign in with LetBuyy/);
    assert.doesNotMatch(register.source, /action="\/api\/customer\/register"/, 'new buyer registration must not create a per-store login');
    assert.match(register.source, /routes\.customer_login_url/, 'legacy customers retain a route to sign in and link their account');
  }
  const loginHtml = (await renderAuth('customers/login')).liquid?.layoutHtml ?? '';
  const registerHtml = (await renderAuth('customers/register')).liquid?.layoutHtml ?? '';
  assert.match(loginHtml, /href="\/api\/buyer-auth\/start\?return_to=/);
  assert.match(registerHtml, /href="\/api\/buyer-auth\/start\?return_to=/);
  assert.match(registerHtml, /Create or sign in with LetBuyy/);
  assert.doesNotMatch(registerHtml, /action="\/api\/customer\/register"/);
});
