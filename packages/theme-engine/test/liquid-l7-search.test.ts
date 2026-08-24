// L7 — Search Experience (Full Liquid V1). A `search` Liquid template: the lb-search island + a results
// list. Option (a) — results are the matching product list (collection.products); query echoed via search.terms.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LiquidRenderer,
  createUrbanKicksLiquidThemeBundleFixture,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = '11111111-1111-4111-8111-111111111111';

async function renderSearch(terms, products) {
  return new LiquidRenderer().render({
    context: { storeId: STORE_ID, subdomain: 'local-kicks', path: '/search', previewMode: true, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'search', type: 'search', layoutKey: 'theme', sections: [] },
    liquidTemplateKey: 'search',
    liquidContext: { search: { terms }, collection: { products } },
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
  });
}

test('L7: bundle ships a search template + search-box section', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  assert.ok(bundle.templates.search, 'search template must exist');
  assert.ok(bundle.sections['search-box'], 'search-box section must exist');
});

test('L7: search page renders the search island, echoes the query, and lists matching products', async () => {
  const result = await renderSearch('runner', [
    { title: 'Apex Runner', price: 749900, currency: 'INR', url: '/product/p1' },
  ]);
  assert.equal(result.status, 'rendered');
  assert.equal(result.liquid?.templateKey, 'search');
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<lb-search[^>]+data-lb-island="search"/);
  assert.match(html, /Results for "runner"/);                 // {{ search.terms }}
  assert.match(html, /<h3 class="lb-product-card__title">Apex Runner<\/h3>/);        // results from collection.products
});

test('L7: empty search renders the box with no result cards', async () => {
  const result = await renderSearch('zzz', []);
  const html = result.liquid?.layoutHtml ?? '';
  assert.match(html, /<lb-search/);
  assert.doesNotMatch(html, /<article class="lb-product-card"/);
});

test('L7: the query string is escaped (no injection via search.terms)', async () => {
  const result = await renderSearch('<script>alert(1)</script>', []);
  const html = result.liquid?.layoutHtml ?? '';
  assert.doesNotMatch(html, /<script/i);
});
