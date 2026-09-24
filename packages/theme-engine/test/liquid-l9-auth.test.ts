// L9 — Customer Registration (engine templates only). Liquid customers/login + customers/register render.
// D10: LB-12 is CLOSED (2026-06-19). POST /api/customer/register proxy route now exists in customer-web.
// Login posts to /api/customer/login; register posts to /api/customer/register (both same-origin proxies).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

test('L9: register template renders a form posting to the register endpoint', async () => {
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

// ============================================================================
// D10 — Registration wiring verification (static contract tests)
// ============================================================================

test('D10 /api/customer/register proxy route exists and exports POST handler', () => {
  // Verify the customer-web route file exists and wires to the gateway correctly.
  // This is a static contract test — read-only source inspection, no network calls.
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
  assert.match(routeSource, /registerCustomer/, 'route must call registerCustomer (proxy to gateway)');
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

test('D10 register Liquid template action matches the existing proxy route path', () => {
  // Verify the Liquid register template posts to /api/customer/register which is served by the route above.
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const registerTemplate = bundle.templates['customers/register'];
  assert.ok(registerTemplate, 'customers/register template must exist in bundle');

  // The register template sections must contain a section whose source has the register action.
  const sectionTypes = Object.values(registerTemplate.sections).map((s) => s.type);
  assert.ok(sectionTypes.length > 0, 'register template must have at least one section');

  // Check the section source in the bundle for the form action
  const registerSectionType = sectionTypes[0];
  const registerSection = bundle.sections[registerSectionType!];
  assert.ok(registerSection, `register section type "${registerSectionType}" must exist in bundle sections`);
  assert.match(
    registerSection.source,
    /action="\/api\/customer\/register"/,
    'register section source must contain action="/api/customer/register"',
  );
});
