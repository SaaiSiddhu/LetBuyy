/** Actual Liquid -> DOM FormData -> URLSearchParams -> canonical parser, in process. */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, type StorefrontDiscoveryQuery, type StorefrontDiscoveryFacet, type ProductModel } from '../../../../packages/commerce-core/src/index';
import { readStorefrontDiscoveryPayload } from '../../../../services/api-gateway/src/lib/storefront-discovery';
import { projectDiscoveryPage, validateDiscoveryProductPage } from '../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';
import { createFirstPartyCatalogBundle, LiquidRenderer, DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/index';

type Dom = { window: { document: Document; FormData: new (form?: HTMLFormElement) => FormData; close(): void } };
const { JSDOM } = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url))('jsdom') as { JSDOM: new (html: string, options?: { url: string }) => Dom };
const productId = '22222222-2222-4222-8222-222222222222';
const model: ProductModel = { id: productId, name: 'Synthetic supplied gift', description: 'Fixture only', price: 999, currency: 'INR', stock: 5, images: [] };
const full = StorefrontDiscoveryQuerySchema.parse({
  page: 7, limit: 6, sort: 'price-desc', search: 'Desk & उपहार', category: 'Desk gifts', country_of_origin: 'India',
  collection_id: '33333333-3333-4333-8333-333333333333', size: 'Large', color: 'Sage', min_price: 100, max_price: 1500,
  age_band: '6-8', interest: 'art', electronics_kind: 'hub', connector: ['usb-c', 'hdmi'], power_input_w: 100,
  power_output_w: 65, power_capacity_w: 120, pass_through_output_w: 85, data_rate_mbps: 5000, length_mm: 100,
  pack_size: 'g:250', material: 'Wood', finish: 'Natural', max_width_cm: 61, max_depth_cm: 76.3,
  occasion: 'birthday', recipient: 'friend', personalization_method: 'engrave', routine_stage: 'colour', format: 'Tint', shade: 'Rosewater',
  activity: 'badminton', equipment_type: 'racket', length_value: 67.5, length_unit: 'cm', books_kind: 'book', books_author: 'Asha',
  books_subject: 'Fiction', books_language: 'Hindi', books_format: 'paperback', books_ruling: 'lined',
});
const giftFacets: StorefrontDiscoveryFacet[] = [
  { key: 'occasion', value: 'birthday', label: 'Birthday', count: 4 }, { key: 'occasion', value: '40th-birthday', label: '40th birthday', count: 2 },
  { key: 'recipient', value: 'friend', label: 'A friend', count: 4 }, { key: 'recipient', value: 'colleague', label: 'A colleague', count: 2 },
];
type Route = 'collection' | 'search';
const observations: Array<Record<string, unknown>> = [];
const originalFetch = globalThis.fetch; let networkCalls = 0;
before(() => { globalThis.fetch = async () => { networkCalls++; throw new Error('Network is prohibited in this owned query contract suite.'); }; });
after(() => {
  globalThis.fetch = originalFetch;
  const paths = ['packages/theme-engine/src/kindred-theme.ts', 'packages/theme-engine/src/kindred-discovery.ts',
    'packages/commerce-core/src/storefront-discovery.ts', 'apps/commerce/web/src/lib/theme-engine/storefront-discovery.ts',
    'services/api-gateway/src/lib/storefront-discovery.ts'];
  writeFileSync(new URL('discovery-form-observations.json', import.meta.url), JSON.stringify({ date: new Date().toISOString(),
    classification: 'IN_PROCESS_RENDER_FORMDATA_CANONICAL_QUERY_ONLY_NOT_SQL_BROWSER_OR_INSTALLED_ACCEPTANCE', networkCalls,
    sources: paths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(new URL('../../../../' + path, import.meta.url))).digest('hex') })), observations,
  }, null, 2) + '\n');
  assert.equal(networkCalls, 0);
});

async function render(route: Route | 'index', query = full, options: { empty?: boolean; facets?: StorefrontDiscoveryFacet[]; metadata?: boolean; fixedCollection?: boolean } = {}) {
  const path = route === 'search' ? '/search' : route === 'index' ? '/' : '/products';
  const total = options.empty ? 0 : 60, models = options.empty ? [] : [model];
  const payload = readStorefrontDiscoveryPayload({ data: models.map(item => ({ id: item.id, price: item.price })), count: total,
    facets: options.empty ? [] : options.facets ?? giftFacets,
    matches: models.map(item => ({ product_id: item.id, price: item.price, variant_ids: [] })),
  }, query);
  const page = validateDiscoveryProductPage({ data: models, total, page: query.page, limit: query.limit, has_more: query.page * query.limit < total,
    ...(options.metadata === false ? {} : { discovery: payload.discovery }) }, query);
  const projection = projectDiscoveryPage(page, path, query, options.fixedCollection);
  const bundle = createFirstPartyCatalogBundle('letbuyy-summit', { designVersion: '2.0.0' });
  const products = models.map(item => ({ id: item.id, title: item.name, price: item.price, currency: item.currency, available: true, images: [], url: '/products/synthetic' }));
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'kindred-query-contract', path, previewMode: false, locale: 'en-IN', searchParams: query as unknown as Record<string, string> },
    storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: route, type: route, layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: route,
    liquidContext: { request: { path, query: projection.query }, shop: { name: 'Synthetic contract store', ...projection.shop }, collections: [],
      collection: { title: 'Supplied gifts', products, ...projection.collection }, search: { terms: query.search ?? '', results: products, results_count: total },
      section_products: Object.fromEntries(Object.keys(bundle.templates[route].sections).map(id => [id, products])) },
  });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
  return { dom: new JSDOM(result.liquid!.contentForLayout, { url: 'https://shop.example.invalid' + path }), projection };
}
function parse(params: URLSearchParams) {
  const result = StorefrontDiscoveryQuerySchema.safeParse(storefrontDiscoveryQueryFromEntries(params));
  assert.equal(result.success, true, JSON.stringify(result.error?.issues)); if (!result.success) assert.fail('Invalid canonical submission');
  return result.data;
}
function submit(dom: Dom, form: HTMLFormElement) {
  const params = new URLSearchParams();
  for (const [key, value] of new dom.window.FormData(form)) { assert.equal(typeof value, 'string'); params.append(key, String(value)); }
  for (const key of new Set(params.keys())) if (key !== 'connector') assert.equal(params.getAll(key).length, 1, `Scalar ${key} submitted once`);
  const url = new URL(form.action, 'https://shop.example.invalid'); url.search = params.toString();
  return { params, url, query: parse(url.searchParams) };
}
function form(dom: Dom, selector: string) {
  const result = dom.window.document.querySelector<HTMLFormElement>(selector); assert.ok(result, `Actual form ${selector} exists`); return result;
}
// Canonical navigation sorts repeated OR choices; the chosen set is invariant.
const normalized = (query: StorefrontDiscoveryQuery) => ({ ...query, ...(Array.isArray(query.connector) ? { connector: [...query.connector].sort() } : {}) });
const compare = (actual: StorefrontDiscoveryQuery, expected: StorefrontDiscoveryQuery) => assert.deepEqual(normalized(actual), normalized(expected));

for (const route of ['collection', 'search'] as const) {
  test(`${route}: actual apply/sort forms preserve every unedited canonical field and connector value`, async () => {
    const { dom } = await render(route); try {
      const filters = form(dom, '.kr-filter-form');
      for (const actual of Array.from(dom.window.document.forms)) compare(submit(dom, actual).query, { ...full, page: 1 });
      for (const [key, value] of [['occasion', '40th-birthday'], ['recipient', 'colleague'], ['sort', 'name'], ['min_price', '200'], ['max_price', '1800'], ['occasion', ''], ['recipient', ''], ['min_price', ''], ['max_price', '']] as const) {
        const clone = filters.cloneNode(true) as HTMLFormElement;
        const control = clone.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${key}"]:not([type="hidden"])`); assert.ok(control); control.value = value;
        const actual = submit(dom, clone); compare(actual.query, StorefrontDiscoveryQuerySchema.parse({ ...full, [key]: value, page: 1 }));
        assert.deepEqual(actual.params.getAll('connector'), full.connector);
      }
      if (route === 'search') {
        const search = form(dom, '.kr-search-form').cloneNode(true) as HTMLFormElement;
        const control = search.querySelector<HTMLInputElement>('[name="search"]'); assert.ok(control); control.value = 'New gift query';
        compare(submit(dom, search).query, { ...full, search: 'New gift query', page: 1 });
      }
      observations.push({ route, check: 'apply/sort/search preservation', canonicalKeys: Object.keys(full), connector: full.connector, status: 'pass' });
    } finally { dom.window.close(); }
  });
  test(`${route}: each canonical active-filter clear removes only its own selection and resets page`, async () => {
    const { dom, projection } = await render(route); try {
      for (const filter of projection.collection.active_filters) {
        const link = Array.from(dom.window.document.querySelectorAll<HTMLAnchorElement>('a[data-kindred-clear]'))
          .find(item => item.dataset.kindredClear === filter.key && item.dataset.kindredValue === filter.value);
        assert.ok(link, `Independent clear for ${filter.key}=${filter.value}`);
        const expected = new URL(filter.clear_url, 'https://shop.example.invalid');
        compare(parse(new URL(link.href).searchParams), parse(expected.searchParams));
        assert.equal(parse(expected.searchParams).page, 1);
      }
      const clear = dom.window.document.querySelector<HTMLAnchorElement>('[data-kindred-clear-all]'); assert.ok(clear);
      compare(parse(new URL(clear.href).searchParams), parse(new URL(projection.collection.clear_filters_url, 'https://shop.example.invalid').searchParams));
      for (const next of [6, 8]) {
        const links = Array.from(dom.window.document.querySelectorAll<HTMLAnchorElement>('.kr-pagination a'));
        const link = links.find(item => parse(new URL(item.href).searchParams).page === next); assert.ok(link);
        compare(parse(new URL(link.href).searchParams), { ...full, page: next });
      }
      observations.push({ route, check: 'independent clear and pagination', filters: projection.collection.active_filters.length, status: 'pass' });
    } finally { dom.window.close(); }
  });
  test(`${route}: empty matches preserve valid selections without inventing occasion/recipient choices`, async () => {
    const { dom, projection } = await render(route, full, { empty: true }); try {
      assert.equal(dom.window.document.querySelector('select[name="occasion"],select[name="recipient"]'), null);
      for (const actual of Array.from(dom.window.document.forms)) compare(submit(dom, actual).query, { ...full, page: 1 });
      assert.match(dom.window.document.body.textContent ?? '', /No matching products/);
      for (const filter of projection.collection.active_filters) assert.ok(Array.from(dom.window.document.querySelectorAll<HTMLAnchorElement>('[data-kindred-clear]')).some(link => link.dataset.kindredClear === filter.key && link.dataset.kindredValue === filter.value));
      assert.doesNotMatch(dom.window.document.body.innerHTML, /guaranteed arrival|free shipping|gift message/i);
      observations.push({ route, check: 'empty matches', suppliedGiftChoices: 0, status: 'pass' });
    } finally { dom.window.close(); }
  });
}
test('selected zero-count value outside supplied options stays hidden and independently removable', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ ...full, occasion: 'retirement' });
  const { dom } = await render('collection', query); try {
    assert.equal(dom.window.document.querySelector('select[name="occasion"]'), null);
    assert.deepEqual(Array.from(dom.window.document.querySelectorAll<HTMLOptionElement>('select[name="recipient"] option')).map(option => option.value), ['', 'friend', 'colleague']);
    compare(submit(dom, form(dom, '.kr-filter-form')).query, { ...query, page: 1 });
    const link = dom.window.document.querySelector<HTMLAnchorElement>('[data-kindred-clear="occasion"]'); assert.ok(link);
    const expected = StorefrontDiscoveryQuerySchema.parse({ ...query, occasion: undefined, page: 1 }); delete expected.occasion;
    compare(parse(new URL(link.href).searchParams), expected);
  } finally { dom.window.close(); }
});
test('homepage finder and capability-off search preserve unedited canonical query fields', async () => {
  const { dom } = await render('index'); try { compare(submit(dom, form(dom, '.kr-finder')).query, { ...full, page: 1 }); } finally { dom.window.close(); }
  const query = StorefrontDiscoveryQuerySchema.parse({ page: 4, limit: 3, search: 'Gift', category: 'Desk', country_of_origin: 'India', sort: 'name' });
  const fallback = await render('search', query, { metadata: false }); try {
    assert.equal(fallback.dom.window.document.querySelector('[name="occasion"],[name="recipient"],[name="min_price"],[name="max_price"]'), null);
    compare(submit(fallback.dom, form(fallback.dom, '.kr-search-form')).query, { ...query, page: 1 });
  } finally { fallback.dom.window.close(); }
});
test('fixed collection scope survives apply and clear-all through canonical projection URLs', async () => {
  const { dom, projection } = await render('collection', full, { fixedCollection: true }); try {
    compare(submit(dom, form(dom, '.kr-filter-form')).query, { ...full, page: 1 });
    assert.equal(dom.window.document.querySelector('[data-kindred-clear="collection_id"]'), null);
    const link = dom.window.document.querySelector<HTMLAnchorElement>('[data-kindred-clear-all]'); assert.ok(link);
    const cleared = parse(new URL(link.href).searchParams);
    compare(cleared, parse(new URL(projection.collection.clear_filters_url, 'https://shop.example.invalid').searchParams));
    assert.equal(cleared.collection_id, full.collection_id); assert.equal(cleared.limit, full.limit);
    assert.equal(cleared.search, full.search); assert.equal(cleared.sort, full.sort); assert.equal(cleared.page, 1);
  } finally { dom.window.close(); }
});
test('supplied labels and retained queries remain escaped through actual Liquid and form parsing', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ ...full, search: 'Desk & "quoted" <gift> उपहार' });
  const facets = giftFacets.map(facet => ({ ...facet, label: '<img src=x onerror=bad()>' }));
  const { dom } = await render('search', query, { facets }); try {
    assert.equal(dom.window.document.querySelector('script,[onerror]'), null);
    compare(submit(dom, form(dom, '.kr-filter-form')).query, { ...query, page: 1 });
  } finally { dom.window.close(); }
});
test('existing closing-tag attribute sanitization stays fail closed without a theme workaround', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ ...full, search: '"><script>bad()</script>&उपहार' });
  const { dom } = await render('search', query); try {
    assert.equal(dom.window.document.querySelector('script,[onerror]'), null);
    const actual = submit(dom, form(dom, '.kr-filter-form'));
    assert.equal(actual.params.get('search'), ''); assert.equal(actual.query.search, undefined);
    observations.push({ check: 'existing sanitizer boundary', source: 'DOMPurify SAFE_FOR_XML rejects closing script tags in attribute values', status: 'unchanged' });
  } finally { dom.window.close(); }
});
