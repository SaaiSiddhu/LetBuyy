import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '../../../../packages/theme-engine/src/index.ts';
import { StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, storefrontDiscoveryUrl, type StorefrontDiscoveryQuery, type StorefrontDiscoveryFacet } from '../../../../packages/commerce-core/src/index.ts';
const requireApp = createRequire(new URL('../../../../apps/commerce/web/package.json', import.meta.url));
const { JSDOM } = requireApp('jsdom') as { JSDOM: new (html: string) => { window: Window & typeof globalThis & { close(): void } } };
const { projectDiscoveryPage, validateDiscoveryProductPage } = requireApp('./src/lib/theme-engine/storefront-discovery.ts') as typeof import('../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery');

const productId = '11111111-1111-4111-8111-111111111111', collectionId = '22222222-2222-4222-8222-222222222222';
const supplied: StorefrontDiscoveryFacet[] = [
  { key: 'pack_size', value: 'g:250', label: '250 g supplied pack', count: 4 },
  { key: 'pack_size', value: 'g:500', label: '500 g supplied pack', count: 3 },
];
function query(patch: Record<string, unknown> = {}) {
  return StorefrontDiscoveryQuerySchema.parse({ page: 4, limit: 7, search: 'दाल and rice', category: 'Staples', country_of_origin: 'India', connector: ['usb-c', 'hdmi'], pack_size: 'g:250', min_price: 100, max_price: 500, sort: 'price-desc', length_value: 70, length_unit: 'cm', ...patch });
}
async function fixture(key: 'collection' | 'search', current = query(), facets = supplied, hideSearch = false, fixedCollection = false) {
  const path = key === 'search' ? '/store/pantry/search' : '/store/pantry/collections/staples';
  const bundle = createFirstPartyCatalogBundle('letbuyy-refresh', { designVersion: '2.0.0' });
  if (hideSearch) bundle.templates.collection.sections['pantry-discovery'].settings.showSearch = false;
  const product = { id: productId, name: 'Mystery staple 500 g', price: 100, currency: 'INR', stock: 2, images: [] };
  const page = validateDiscoveryProductPage({ data: [product], total: 100, page: current.page, limit: current.limit, has_more: true,
    discovery: { query: current, facets, matches: [{ product_id: productId, price: 100, variant_ids: [] }] } }, current);
  const projection = projectDiscoveryPage(page, path, current, fixedCollection);
  const item = { ...product, title: product.name, url: '/product/' + product.id, available: true, options: [], variants: [], weight: 500 };
  const result = await new LiquidRenderer().render({
    context: { storeId: productId, subdomain: 'pantry', path, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-refresh', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: key,
    liquidContext: { request: { path, query: current }, collection: { title: key === 'search' ? 'Search pantry' : 'Staples', products: [item], ...projection.collection }, search: { terms: current.search, results: [item] }, section_products: { 'pantry-results': [item] } },
  });
  assert.equal(result.status, 'rendered', JSON.stringify(result.warnings)); assert.deepEqual(result.warnings, []);
  const dom = new JSDOM(result.liquid!.contentForLayout), document = dom.window.document;
  const form = document.querySelector<HTMLFormElement>('form.pn-filters'); assert.ok(form, key + ' must use Pantry canonical discovery form');
  const submit = () => {
    const entries = [...new dom.window.FormData(form).entries()].map(([key, value]) => [key, String(value)] as const);
    const parsed = StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(entries));
    for (const name of new Set(entries.map(([name]) => name))) if (name !== 'connector') assert.equal(entries.filter(([key]) => key === name).length, 1, 'duplicate scalar ' + name);
    return parsed;
  };
  return { dom, document, form, submit, projection, path, html: result.liquid!.contentForLayout };
}
const sameQuery = (actual: StorefrontDiscoveryQuery, expected: StorefrontDiscoveryQuery) => assert.equal(storefrontDiscoveryUrl('/products', actual), storefrontDiscoveryUrl('/products', expected));

for (const key of ['collection', 'search'] as const) test(`${key}: real FormData sort/apply and individual clears preserve every unedited canonical field`, async () => {
  const current = query(), f = await fixture(key, current);
  try {
    assert.equal(f.form.getAttribute('action'), f.path);
    sameQuery(f.submit(), { ...current, page: 1 });
    assert.deepEqual(f.submit().connector, ['usb-c', 'hdmi']);
    const sort = f.form.querySelector<HTMLSelectElement>('select[name="sort"]')!; assert.ok(sort); sort.value = 'newest';
    sameQuery(f.submit(), { ...current, page: 1, sort: 'newest' });
    const pack = f.form.querySelector<HTMLSelectElement>('select[name="pack_size"]')!; assert.ok(pack);
    assert.deepEqual([...pack.options].map(option => option.value), ['', 'g:250', 'g:500']);
    assert.equal(pack.options[1].textContent, '250 g supplied pack'); pack.value = 'g:500';
    sameQuery(f.submit(), { ...current, page: 1, sort: 'newest', pack_size: 'g:500' });
    for (const filter of f.projection.collection.active_filters) {
      const link = [...f.form.querySelectorAll<HTMLAnchorElement>('a')].find(anchor => anchor.getAttribute('href') === filter.clear_url); assert.ok(link, filter.label);
      const url = new URL(link.getAttribute('href')!, 'https://shop.invalid');
      const cleared = StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(url.searchParams));
      assert.equal(cleared.page, 1); assert.equal(cleared.limit, 7); assert.equal(cleared.search, current.search); assert.equal(cleared.sort, current.sort);
      if (filter.key !== 'connector') assert.deepEqual([...(cleared.connector as string[])].sort(), ['hdmi', 'usb-c']);
      else assert.deepEqual(cleared.connector, filter.value === 'usb-c' ? 'hdmi' : 'usb-c');
      if (filter.key !== 'category') assert.equal(cleared.category, current.category);
      if (filter.key !== 'country_of_origin') assert.equal(cleared.country_of_origin, current.country_of_origin);
      if (filter.key !== 'pack_size') assert.equal(cleared.pack_size, current.pack_size);
      else assert.equal(cleared.pack_size, undefined);
    }
    const clearAll = [...f.form.querySelectorAll<HTMLAnchorElement>('a')].find(anchor => anchor.textContent === 'Clear all filters')!;
    assert.equal(clearAll.getAttribute('href'), f.projection.collection.clear_filters_url);
    const cleared = StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(new URL(clearAll.getAttribute('href')!, 'https://shop.invalid').searchParams));
    assert.equal(cleared.limit, 7); assert.equal(cleared.search, current.search); assert.equal(cleared.page, 1); assert.equal(cleared.pack_size, undefined);
    assert.match(f.html, /Net quantity not supplied/); assert.doesNotMatch(f.html, /500 g net per pack|100 g net per pack/);
  } finally { f.dom.window.close(); }
});

test('hidden search and fixed collection remain in submitted state without duplicate scalar controls', async () => {
  const current = query({ collection_id: collectionId }), f = await fixture('collection', current, supplied, true, true);
  try {
    assert.equal(f.form.querySelector('input[type="search"]'), null); assert.equal(f.form.querySelector('input[name="search"]')?.getAttribute('type'), 'hidden');
    sameQuery(f.submit(), { ...current, page: 1 });
    for (const filter of f.projection.collection.active_filters) assert.equal(new URL(filter.clear_url, 'https://shop.invalid').searchParams.get('collection_id'), collectionId);
  } finally { f.dom.window.close(); }
});

test('valid selected pack absent from supplied choices stays preserved without inventing a food option', async () => {
  for (const facets of [supplied, []]) {
    const current = query({ pack_size: 'ml:999' }), f = await fixture('search', current, facets);
    try {
      assert.equal(f.form.querySelector('select[name="pack_size"]'), null);
      assert.equal(f.form.querySelector('input[name="pack_size"]')?.getAttribute('value'), 'ml:999');
      sameQuery(f.submit(), { ...current, page: 1 });
      assert.match(f.form.textContent!, /not among the supplied choices/);
      const clear = f.projection.collection.active_filters.find(filter => filter.key === 'pack_size')!;
      assert.ok([...f.form.querySelectorAll('a')].some(anchor => anchor.getAttribute('href') === clear.clear_url));
      assert.doesNotMatch(f.html, /999 ml net per pack|500 g net per pack/);
    } finally { f.dom.window.close(); }
  }
});

test('missing food capability exposes no pack choice and hostile canonical search text remains inert', async () => {
  const current = query({ pack_size: undefined, search: 'rice "><img src=x onerror=attack()>' }), f = await fixture('collection', current, []);
  try {
    assert.equal(f.form.querySelector('select[name="pack_size"]'), null); assert.equal(f.form.querySelector('[onerror]'), null);
    assert.equal(f.form.querySelector<HTMLInputElement>('input[name="search"]')?.value, current.search);
    sameQuery(f.submit(), { ...current, page: 1 }); assert.match(f.html, /Net quantity not supplied/);
  } finally { f.dom.window.close(); }
});
