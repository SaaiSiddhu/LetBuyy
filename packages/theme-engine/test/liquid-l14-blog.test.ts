// L14 — Blog Listing and Article templates (Phase E, LANE-A).
// Blog listing: data source VERIFIED REAL — GET /:subdomain/blog (public-routes.ts line 1226).
// Fields: id, title, slug, excerpt, featured_image, published_at. Author name NOT returned.
// Article: data source VERIFIED REAL — GET /:subdomain/blog/:slug (public-routes.ts line 1248).
// Fields: id, title, slug, content_html/body_html, featured_image, published_at, updated_at. Author NOT returned.
// Populated by LANE-B composition-engine via liquidContext.blog / liquidContext.article.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

// ============================================================================
// E1 — Blog Listing Template
// ============================================================================

async function renderBlog(articles: unknown[]) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/blog', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'blog', type: 'blog', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'blog',
    liquidContext: {
      blog: { articles, current_page: 1, pages_count: 1 },
    },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L14(a): bundle ships a blog template', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates.blog, 'blog template must exist');
  assert.ok(bundle.sections['blog-listing'], 'blog-listing section must exist in bundle');
});

test('L14(b): blog listing renders articles with title link and excerpt', async () => {
  const result = await renderBlog([
    { title: 'Summer Drop', slug: 'summer-drop', excerpt: 'A drop' },
  ]);
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Summer Drop/, 'article title must appear in output');
  assert.match(html, /summer-drop/, 'article slug must appear in href');
  assert.match(html, /A drop/, 'excerpt must appear in output');
});

test('L14(c): blog listing renders empty state when no articles', async () => {
  const result = await renderBlog([]);
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /No posts published yet/, 'empty state message must appear');
  assert.doesNotMatch(html, /lb-blog-article-card"/, 'no article card markup when empty');
});

test('L14(d): blog listing sanitizes XSS in article title', async () => {
  const result = await renderBlog([{ title: '<script>alert(1)</script>', slug: 'xss', excerpt: '' }]);
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i, 'script tags must not appear in output');
});

// ============================================================================
// E2 — Article (Blog Post) Template
// ============================================================================

async function renderArticle(article: unknown) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/blog/test-post', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'article', type: 'article', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'article',
    liquidContext: { article },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L14(e): bundle ships an article template', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates.article, 'article template must exist');
  assert.ok(bundle.sections['article-content'], 'article-content section must exist in bundle');
});

test('L14(f): article renders title and body_html content', async () => {
  const result = await renderArticle({
    title: 'Post',
    body_html: '<p>Hello world</p>',
    published_at: '2026-07-01T00:00:00Z',
    slug: 'post',
  });
  assert.equal(result.status, 'rendered', `render failed: ${result.warnings.join(', ')}`);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Post/, 'article title must appear');
  assert.match(html, /Hello world/, 'body_html content must appear');
});

test('L14(g): article body_html is sanitized — XSS removed', async () => {
  const result = await renderArticle({
    title: 'XSS Test',
    body_html: '<p>Safe</p><script>alert(1)</script>',
    slug: 'xss-test',
  });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Safe/, 'safe content must remain');
  assert.doesNotMatch(html, /<script/i, 'script must be removed by sanitizeRenderedHtml');
});

test('L14(h): article with no body_html renders without crash', async () => {
  const result = await renderArticle({ title: 'Empty', slug: 'empty' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /Empty/, 'title must appear even without body_html');
  assert.doesNotMatch(html, /lb-article__body/, 'body div must not render when body_html is blank');
});

test('L14(h2): article with empty-string body_html suppresses the body div (blank guard)', async () => {
  const result = await renderArticle({ title: 'EmptyString', slug: 'empty-string', body_html: '' });
  assert.equal(result.status, 'rendered');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /EmptyString/, 'title must appear');
  assert.doesNotMatch(html, /lb-article__body/, 'body div must not render for body_html: ""');
});
