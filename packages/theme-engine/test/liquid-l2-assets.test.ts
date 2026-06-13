// L2 — Asset Pipeline (Full Liquid V1).
// Exercises the LIVE LiquidRenderer: a rendered urban-kicks page must carry the theme :root tokens
// and the lb-* base stylesheet (so pages are styled), and the WHOLE_DOCUMENT DOMPurify pass must keep
// the <style> while STILL stripping active content (the sanitizer is not weakened to allow styling).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_THEME_SETTINGS,
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  buildLiquidThemeHeadAssets,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

function renderUrbanKicks(extraBundle = {}) {
  const renderer = new LiquidRenderer();
  const bundle = { ...createUrbanKicksLiquidThemeBundleFixture(), ...extraBundle };
  return renderer.render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle,
  });
}

test('L2: rendered Liquid page ships :root tokens + lb-* stylesheet (styled, not bare)', async () => {
  const result = await renderUrbanKicks();
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  // :root token block survives DOMPurify and carries the urban-kicks primary token.
  assert.match(html, /:root\s*\{/, 'rendered head must contain a :root token block');
  assert.match(html, /--primary:\s*#8B5CF6/i, 'primaryColor token must be applied as --primary');
  assert.match(html, /--font-body:/, 'font token must be present');
  // lb-* base stylesheet survives and is in the head.
  assert.match(html, /\.lb-hero-banner\b/, 'lb-* component CSS must be present');
  assert.match(html, /\.lb-product-grid__items/, 'lb-* grid CSS must be present');
  assert.match(html, /<style[^>]*data-theme-renderer="liquid"/, 'theme CSS must ship as a tagged <style>');
});

test('L2: styling injection did NOT weaken the sanitizer (active content still stripped)', async () => {
  // Inject hostile content through a section block setting; the rendered doc must drop it.
  const base = createUrbanKicksLiquidThemeBundleFixture();
  const idx = base.templates.index;
  const firstSectionId = Object.keys(idx.sections)[0];
  const firstSection = idx.sections[firstSectionId];
  const hostile = {
    templates: {
      ...base.templates,
      index: {
        ...idx,
        sections: {
          ...idx.sections,
          [firstSectionId]: {
            ...firstSection,
            settings: { ...firstSection.settings, heading: '<img src=x onerror=alert(1)><script>alert(2)</script>' },
          },
        },
      },
    },
  };
  const result = await renderUrbanKicks(hostile);
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i, 'script tags must be stripped');
  assert.doesNotMatch(html, /onerror=/i, 'inline event handlers must be stripped');
  assert.doesNotMatch(html, /\sstyle=/i, 'inline style attributes must remain forbidden');
});

test('L2: buildLiquidThemeHeadAssets falls back safely and sanitizes token values', () => {
  // A token value cannot break out of its declaration even if the theme settings are malformed.
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  bundle.config.settings_data.current = { ...bundle.config.settings_data.current, primaryColor: 'red;} body{display:none' };
  const head = buildLiquidThemeHeadAssets(bundle);
  assert.match(head, /<style[^>]*>/);
  assert.doesNotMatch(head, /body\{display:none/, 'token value must not inject extra rules');
  assert.match(head, /--font-display:/, 'all mapped tokens emitted');
});
