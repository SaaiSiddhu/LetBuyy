/** Source-only real Liquid → native FormData → canonical route parser; no API/DB/browser. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { STOREFRONT_DISCOVERY_QUERY_KEYS, StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, storefrontDiscoveryUrl, type StorefrontDiscoveryMetadata, type StorefrontDiscoveryQuery } from '@letbuyy/commerce-core';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import { discoveryRouteQuery } from '../../../../apps/commerce/web/src/lib/theme-engine/discovery-route-query';
import { projectDiscoveryPage, validateDiscoveryProductPage, type StorefrontDiscoveryProductPage } from '../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';

const base = '/store/marginalia-query-evidence';
const raw = 'page=4&limit=7&search=slow+city+%26+paper&category=Books+%26+Paper&country_of_origin=IN&sort=price-desc&collection_id=7b669c70-7300-4000-8000-000000000002&size=M&color=Olive&electronics_kind=hub&connector=usb-c&connector=hdmi&power_input_w=100&power_output_w=65&power_capacity_w=100&pass_through_output_w=65&data_rate_mbps=480&length_mm=2000&min_price=0&max_price=900&age_band=6-8&interest=making&pack_size=g%3A250&material=Paper&finish=Olive&max_width_cm=148&max_depth_cm=210&occasion=birthday&recipient=friend&personalization_method=engraving&routine_stage=care&format=cream&shade=Olive&activity=Reading&equipment_type=storage&length_value=21&length_unit=cm&books_kind=stationery&books_author=Mira+Sen&books_subject=Essays&books_language=Hindi&books_format=hardback&books_ruling=lined';
const rulingFacets: StorefrontDiscoveryMetadata['facets'] = [
  { key: 'books_ruling', value: 'blank', label: 'Blank pages supplied', count: 3 },
  { key: 'books_ruling', value: 'lined', label: 'Ruled lines supplied', count: 2 },
  { key: 'books_kind', value: 'stationery', label: 'Stationery supplied', count: 5 },
];
async function fixture(kind: 'collection' | 'search', query = discoveryRouteQuery(new URLSearchParams(raw)), facets: StorefrontDiscoveryMetadata['facets'] | null = rulingFacets, disableCapability = false) {
  const route = kind === 'search' ? base + '/search' : base + '/collections/paper';
  // Synthetic response proof: metadata is schema-validated; no backend filtering is claimed here.
  const page: StorefrontDiscoveryProductPage = { data: [], total: 40, page: query.page, limit: query.limit, has_more: query.page * query.limit < 40,
    ...(facets === null ? {} : { discovery: { query, facets, matches: [] } }) };
  const drop = projectDiscoveryPage(validateDiscoveryProductPage(page, query), route, query, kind === 'collection');
  const bundle = createFirstPartyCatalogBundle('letbuyy-dawn', { designVersion: '2.0.0' });
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'marginalia-query-evidence', path: route, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-dawn', themeSettings: { ...DEFAULT_THEME_SETTINGS, ...bundle.config.settings_data.current }, sections: [] },
    routeTemplate: { id: kind, type: kind, layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: kind,
    liquidContext: { shop: { name: 'Marginalia query evidence', policies: [] }, request: { path: route, query: drop.query }, collection: { ...drop.collection, products: [], title: 'Books and paper', ...(disableCapability ? { capabilities: { ...drop.collection.capabilities, books_filters: false } } : {}) } },
  });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []); assert.ok(result.liquid);
  const dom = new JSDOM(result.liquid.contentForLayout);
  const form = dom.window.document.querySelector<HTMLFormElement>('form.mg-filters'); assert.ok(form);
  return { dom, form, query, route, drop };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const close = (f: Fixture) => (f.dom.window as unknown as { close(): void }).close();
function submit(f: Fixture) {
  const NativeFormData = (f.dom.window as unknown as { FormData: typeof FormData }).FormData;
  const params = new URLSearchParams();
  for (const [key, value] of new NativeFormData(f.form).entries()) { assert.equal(typeof value, 'string'); params.append(key, value as string); }
  const parsed = discoveryRouteQuery(params);
  assert.deepEqual(parsed, StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(params)));
  assert.equal(new URL(f.form.getAttribute('action')!, 'https://shop.example.invalid').pathname, f.route);
  return { params, parsed, url: storefrontDiscoveryUrl(f.route, parsed) };
}
function edit(f: Fixture, name: string, value: string) {
  const input = f.form.querySelector<HTMLInputElement | HTMLSelectElement>(`input:not([type="hidden"])[name="${name}"],select[name="${name}"]`);
  assert.ok(input, name); input.value = value;
}

test('collection/search sort and untouched Apply retain every canonical scalar and repeated connector with page reset to one', async () => {
  for (const kind of ['collection', 'search'] as const) {
    const f = await fixture(kind);
    try {
      assert.ok(STOREFRONT_DISCOVERY_QUERY_KEYS.every(key => f.query[key] !== undefined), 'Fixture covers every canonical query key.');
      const untouched = submit(f);
      assert.equal(untouched.url, storefrontDiscoveryUrl(f.route, f.query, { page: 1 }));
      assert.equal(untouched.params.getAll('page').length, 1); assert.equal(untouched.params.get('page'), '1');
      assert.deepEqual(untouched.params.getAll('connector'), ['usb-c', 'hdmi']);
      for (const name of ['search', 'sort', 'books_author', 'books_subject', 'books_language', 'books_format', 'books_kind', 'books_ruling']) assert.equal(untouched.params.getAll(name).length, 1, name);
      edit(f, 'sort', 'name');
      const sorted = submit(f);
      assert.equal(sorted.url, storefrontDiscoveryUrl(f.route, f.query, { page: 1, sort: 'name' }));
      for (const name of ['limit', 'country_of_origin', 'category', 'search', 'collection_id']) assert.equal(sorted.params.get(name), String(f.query[name as keyof StorefrontDiscoveryQuery]));
    } finally { close(f); }
  }
});
test('real supplied ruling choices are separate from book edition fields and edits preserve all other valid values', async () => {
  for (const kind of ['collection', 'search'] as const) {
    const f = await fixture(kind);
    try {
      const ruling = f.form.querySelector<HTMLSelectElement>('select[name="books_ruling"]'); assert.ok(ruling);
      assert.equal(ruling.closest('[role="group"]')!.getAttribute('aria-label'), 'Stationery');
      assert.equal(f.form.querySelector('[aria-label="Book editions"] [name="books_ruling"]'), null);
      assert.equal(f.form.querySelector('[aria-label="Stationery"] [name="books_format"]'), null);
      assert.deepEqual([...ruling.options].map(option => option.value), ['', 'blank', 'lined']);
      assert.equal(ruling.value, 'lined'); assert.ok(ruling.textContent!.includes('Ruled lines supplied (2)'));
      assert.ok(!ruling.textContent!.includes('dotted')); assert.ok(!ruling.textContent!.includes('grid'));
      edit(f, 'books_ruling', 'blank'); edit(f, 'books_author', 'Asha & Kabir');
      assert.equal(submit(f).url, storefrontDiscoveryUrl(f.route, f.query, { page: 1, books_ruling: 'blank', books_author: 'Asha & Kabir' }));
      edit(f, 'books_author', '');
      assert.equal(submit(f).url, storefrontDiscoveryUrl(f.route, f.query, { page: 1, books_ruling: 'blank', books_author: undefined }));
    } finally { close(f); }
  }
});
test('each actual active-filter clear URL removes only its intended value, preserves independent connector and other query state', async () => {
  for (const kind of ['collection', 'search'] as const) {
    const f = await fixture(kind);
    try {
      const links = [...f.dom.window.document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Applied filters"] a')];
      for (const [key, value, patch] of [
        ['connector', 'usb-c', { connector: ['hdmi'] }],
        ['books_ruling', 'lined', { books_ruling: undefined }],
        ['books_author', 'Mira Sen', { books_author: undefined }],
        ['length_value', '21', { length_value: undefined, length_unit: undefined }],
      ] as const) {
        const filter = f.drop.collection.active_filters.find(row => row.key === key && row.value === value); assert.ok(filter);
        const link = links.find(candidate => candidate.getAttribute('href') === filter.clear_url); assert.ok(link, `${key}: actual canonical clear URL`);
        const url = new URL(link.getAttribute('href')!, 'https://shop.example.invalid');
        const parsed = discoveryRouteQuery(url.searchParams);
        assert.equal(parsed.page, 1); assert.equal(url.pathname, f.route);
        assert.equal(storefrontDiscoveryUrl(f.route, parsed), storefrontDiscoveryUrl(f.route, f.query, { ...patch, page: 1 }));
        assert.deepEqual(url.searchParams.getAll('connector'), key === 'connector' ? ['hdmi'] : ['hdmi', 'usb-c']);
        for (const name of ['search', 'category', 'country_of_origin', 'limit']) assert.equal(url.searchParams.get(name), String(f.query[name as keyof StorefrontDiscoveryQuery]));
      }
      assert.equal(links.some(link => link.getAttribute('href') === f.route), false, 'No bare route silently clears unrelated state.');
    } finally { close(f); }
  }
});
test('missing metadata/capability and selected synthetic zero rows never invent ruling choices or drop retained filters', async () => {
  for (const kind of ['collection', 'search'] as const) {
    const plain = discoveryRouteQuery(new URLSearchParams('search=paper&category=Notes&country_of_origin=IN&limit=7&page=4'));
    const missing = await fixture(kind, plain, null);
    try { assert.equal(missing.form.querySelector('select[name="books_ruling"]'), null); assert.equal(submit(missing).url, storefrontDiscoveryUrl(missing.route, plain, { page: 1 })); } finally { close(missing); }
    for (const [facets, disabled] of [[[{ key: 'books_author', value: 'Mira Sen', label: 'Supplied author', count: 3 }], false], [[{ key: 'books_ruling', value: 'lined', label: 'Zero count', count: 0 }], false], [rulingFacets, true]] as const) {
      const f = await fixture(kind, undefined, [...facets], disabled);
      try {
        assert.equal(f.form.querySelector('select[name="books_ruling"]'), null);
        assert.equal(f.form.querySelector<HTMLInputElement>('input[type="hidden"][name="books_ruling"]')!.value, 'lined');
        assert.equal(submit(f).url, storefrontDiscoveryUrl(f.route, f.query, { page: 1 }));
        const ruling = f.drop.collection.active_filters.find(filter => filter.key === 'books_ruling'); assert.ok(ruling);
        assert.ok([...f.dom.window.document.querySelectorAll('nav[aria-label="Applied filters"] a')].some(link => link.getAttribute('href') === ruling.clear_url));
      } finally { close(f); }
    }
  }
});
test('a valid current ruling absent from supplied choices remains an explicit current filter without claiming matches', async () => {
  for (const kind of ['collection', 'search'] as const) {
    const query = discoveryRouteQuery(new URLSearchParams(raw.replace('books_ruling=lined', 'books_ruling=grid')));
    const f = await fixture(kind, query);
    try {
      const ruling = f.form.querySelector<HTMLSelectElement>('select[name="books_ruling"]')!;
      assert.equal(ruling.value, 'grid');
      assert.match(ruling.selectedOptions[0].textContent!, /Current ruling: grid \(no supplied match\)/);
      assert.equal(submit(f).url, storefrontDiscoveryUrl(f.route, query, { page: 1 }));
      edit(f, 'books_ruling', 'blank');
      assert.equal(submit(f).url, storefrontDiscoveryUrl(f.route, query, { page: 1, books_ruling: 'blank' }));
    } finally { close(f); }
  }
});
