// L15 — CMS Page Template (Phase E, LANE-A).
// Data source VERIFIED REAL: GET /:subdomain/pages/:slug (public-routes.ts line 1158).
// Backed by storefront_pages table (primary) or legacy pages table (fallback).
// normalizeStorefrontPageRecord() (cms-core/src/index.ts line 247) produces:
//   { id, title, slug, body (HTML), content:{body}, page_type, status, seo_title, seo_description,
//     assigned_template_key, published_at, updated_at }
// liquidPage in content-resource-renderer.tsx maps this to: { title, body_html, slug, page_type }
// body_html is merchant-authored HTML; flows through sanitizeRenderedHtml (the authoritative sanitizer).
// Note: catch-all page.tsx handles only single-segment slugs (path.length === 1).
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

async function renderPage(page: unknown) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/pages/about', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'page', type: 'page', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'page',
    liquidContext: { page },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L15(a): bundle ships a page template', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates.page, 'page template must exist');
  assert.ok(bundle.sections['page-content'], 'page-content section must exist in bundle');
});

test('L15(b): page renders title and body_html content', async () => {
  const result = await renderPage({ title: 'About', body_html: '<p>We are LetBuyy</p>', slug: 'about' });
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /About/, 'page title must appear');
  assert.match(html, /We are LetBuyy/, 'body_html content must appear');
});

test('L15(c): page with empty body_html renders heading and empty state message without crash', async () => {
  const result = await renderPage({ title: 'Empty', body_html: '', slug: 'empty' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Empty/, 'page title must appear');
  assert.match(html, /No content yet/, 'empty state message must appear');
  assert.doesNotMatch(html, /lb-page__body/, 'body div must not render when body_html is blank');
});

test('L15(d): page body_html is sanitized — XSS removed', async () => {
  const result = await renderPage({
    title: 'XSS',
    body_html: '<p>Safe</p><script>alert(1)</script>',
    slug: 'xss',
  });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Safe/, 'safe content must remain');
  assert.doesNotMatch(html, /<script/i, 'script must be removed by sanitizeRenderedHtml');
});
