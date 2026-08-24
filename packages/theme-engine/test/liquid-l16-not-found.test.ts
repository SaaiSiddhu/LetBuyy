// L16 — 404 Not-Found and Password Gate Templates (Phase E, LANE-A).
// E4 (LANE-A): not_found template — static 404 markup only; template key uses underscore
//   to match StorefrontRouteType 'not_found'. No data binding beyond routes.
//   CONSTRAINT: Next.js not-found.tsx cannot receive subdomain params — store-aware Liquid 404 rendering
//   requires proxy-level routing to pass subdomain (Phase F scope).
// E5: password template — gate flow: proxy.ts (line 296) always routes password-mode stores to
//   /preview/coming-soon (React). This Liquid template is NOT in the production rendering path until
//   proxy.ts checks render engine — Phase F scope for proxy routing update.
//   POST /store-access/password endpoint exists at proxy.ts line 269.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

// ============================================================================
// E4 — 404 Not Found Template (LANE-A: theme-bundle.ts only)
// ============================================================================

test('L16(a): bundle ships a not_found template with underscore key', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates.not_found, 'not_found template must exist (underscore key)');
  assert.ok(bundle.sections['404-page'], '404-page section must exist in bundle');
});

test('L16(b): not_found template renders 404 code and home link', async () => {
  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/does-not-exist', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'not_found', type: 'not_found', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'not_found',
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /404/, '404 code must appear in output');
  assert.match(html, /href="\/store\/local-kicks"/i, 'home link must point to routes.root_url (/store/local-kicks)');
});

test('L16(c): not_found template output contains no script tags', async () => {
  const result = await new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/does-not-exist', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'not_found', type: 'not_found', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'not_found',
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i, 'no script tags must appear in 404 output');
});

// ============================================================================
// E5 — Password Gate Template
// ============================================================================

async function renderPassword(shop: { name: string; access_message?: string }) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'password', type: 'password', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'password',
    liquidContext: { shop },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L16(d): bundle ships a password template', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates.password, 'password template must exist');
  assert.ok(bundle.sections['password-gate'], 'password-gate section must exist in bundle');
});

test('L16(e): password template renders form posting to /store-access/password with password input', async () => {
  const result = await renderPassword({ name: 'Test Store', access_message: 'Opening soon' });
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /action="\/store-access\/password"/, 'form must post to /store-access/password');
  assert.match(html, /type="password"/, 'password input must be present');
});

test('L16(f): password template renders access_message when present', async () => {
  const result = await renderPassword({ name: 'Test', access_message: 'Opening soon' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Opening soon/, 'access_message must appear in output');
});

test('L16(g): password template does not expose credential keys in settings', () => {
  // Verify the section source does not reference any blocked credential field keys.
  // The BLOCKED_DROP_KEYS set (theme-renderer.ts) blocks 'password' as a settings key —
  // the form input name='password' is an HTML attribute in source, not a settings key,
  // so it is unaffected.
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const passwordSection = bundle.sections['password-gate'];
  assert.ok(passwordSection, 'password-gate section must exist');
  const settingIds = passwordSection.schema.settings.map((s) => s.id);
  const blockedKeys = ['access_token', 'refresh_token', 'api_key', 'secret_key', 'private_key', 'signing_secret', 'client_secret'];
  for (const blockedKey of blockedKeys) {
    assert.ok(!settingIds.includes(blockedKey), `setting id "${blockedKey}" must not be in password-gate schema`);
  }
});
