/** Actual validated page → canonical app projection → public v2 package → real Liquid DOM. */
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createRequire } from 'node:module';
import { StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, type StorefrontDiscoveryFacet, type StorefrontDiscoveryQuery } from '@letbuyy/commerce-core';
import { projectDiscoveryPage, validateDiscoveryProductPage, type StorefrontDiscoveryProductPage } from '../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';
import { productToLiquidDrop } from '../../../../apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { PLAYFIELD_DEMO_PRODUCTS } from '../../../../apps/commerce/web/src/lib/demo/playfield-demo';
import { resolveCatalogDemoContent } from '../../../../apps/commerce/web/src/lib/demo/catalog-demo-dispatch';
import { selectCatalogDemoProducts, catalogDemoRoute } from '../../../../apps/commerce/web/src/lib/theme-engine/catalog-demo-data';

const appRequire = createRequire(new URL('../../../../apps/commerce/web/package.json', import.meta.url));
const { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer } = appRequire('@letbuyy/theme-engine') as typeof import('../../../../packages/theme-engine/src/index');
const { loadThemeServerDom } = appRequire('@letbuyy/theme-engine/server-dom') as typeof import('../../../../packages/theme-engine/src/server-dom-runtime');
const originalFetch = globalThis.fetch;
let networkCalls = 0;
before(() => { globalThis.fetch = async () => { networkCalls += 1; throw new Error('No network is permitted in this render contract.'); }; });
after(() => { globalThis.fetch = originalFetch; assert.equal(networkCalls, 0); });
const path = '/store/playfield-discovery/products';
const facets: StorefrontDiscoveryFacet[] = [
  { key: 'age_band', value: '6-8', label: '६–८ वर्ष · Supplied age', count: 1 },
  { key: 'interest', value: 'music', label: 'Music and sound · संगीत', count: 1 },
];
function page(query: StorefrontDiscoveryQuery, supplied: StorefrontDiscoveryFacet[] | undefined = facets, empty = false, total = empty ? 0 : 1): StorefrontDiscoveryProductPage {
  const data = empty ? [] : [structuredClone(PLAYFIELD_DEMO_PRODUCTS[0])];
  return { data, total, page: query.page, limit: query.limit, has_more: query.page * query.limit < total,
    ...(supplied === undefined ? {} : { discovery: { query, facets: supplied, matches: data.map(product => ({ product_id: product.id, price: product.price, variant_ids: [] })) } }) };
}
async function render(key: 'index' | 'collection' | 'search', response: StorefrontDiscoveryProductPage, query: StorefrontDiscoveryQuery, requestOverride?: Record<string, string>, collectionOverride?: Record<string, unknown>) {
  const validated = validateDiscoveryProductPage(response, query);
  const routePath = key === 'search' ? '/store/playfield-discovery/search' : path;
  const projection = projectDiscoveryPage(validated, routePath, query);
  const drops = validated.data.map(product => productToLiquidDrop(product, '/store/playfield-discovery')!);
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'playfield-discovery', path: key === 'index' ? '/store/playfield-discovery' : routePath, previewMode: true, locale: 'en-IN', searchParams: requestOverride ?? Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && !Array.isArray(value)).map(([key, value]) => [key, String(value)])) },
    storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
    liquidBundle: createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0' }), liquidTemplateKey: key,
    liquidContext: { search: { terms: query.search ?? '', results: drops, results_count: validated.total }, shop: projection.shop, collection: { ...projection.collection, ...collectionOverride, products: drops }, section_products: { 'playfield-product-grid': drops } },
  });
  assert.equal(result.status, 'rendered', result.warnings.join(', ')); assert.deepEqual(result.warnings, []);
  const { JSDOM } = await loadThemeServerDom();
  return { dom: new JSDOM(result.liquid!.contentForLayout), projection };
}
function closeDom(dom: Awaited<ReturnType<typeof render>>['dom']): void {
  const window = dom.window;
  if (!('close' in window) || typeof window.close !== 'function') throw new Error('Expected the Node DOM cleanup API.');
  window.close();
}
function formParams(form: Element): URLSearchParams {
  const FormDataConstructor = (form.ownerDocument.defaultView as unknown as { FormData: typeof FormData }).FormData;
  const params = new URLSearchParams();
  for (const [key, value] of new FormDataConstructor(form as HTMLFormElement)) {
    assert.equal(typeof value, 'string'); params.append(key, String(value));
  }
  return params;
}
function parseParams(params: URLSearchParams) { return StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(params)); }
function formQuery(form: Element) { return parseParams(formParams(form)); }
function clearQuery(link: Element) { return parseParams(new URL(link.getAttribute('href')!, 'https://fixture.example').searchParams); }

test('actual projected age/interest rows, labels and selection survive the unchanged generic depth4 cap', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ age_band: '6-8', interest: 'music' });
  const { dom, projection } = await render('collection', page(query), query);
  try {
    assert.deepEqual(projection.collection.capabilities, { ...projection.collection.capabilities, discovery: true, toys_filters: true, toys_age_band: true, toys_interest: true });
    for (const [name, choices] of [['age_band', projection.collection.toy_facets.age_bands], ['interest', projection.collection.toy_facets.interests]] as const) {
      const select = dom.window.document.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
      assert.ok(select); assert.equal(select.options.length, choices.length + 1);
      assert.equal(select.options[1].value, choices[0].value); assert.equal(select.options[1].textContent, choices[0].label);
      assert.equal(select.options[1].selected, choices[0].selected); assert.equal(select.value, query[name]);
    }
    assert.equal(dom.window.document.querySelector('option[value="art"],option[value="building"],option[value="puzzles"]'), null, 'no theme-created interest choices');
  } finally { closeDom(dom); }
});

test('missing metadata keeps ordinary home search/browse and collection search/sort despite local toy facts or query presence', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ search: 'wood', sort: 'price-desc' });
  const missing = page(query); delete missing.discovery;
  for (const key of ['index', 'collection'] as const) {
    const { dom, projection } = await render(key, missing, query, { age_band: '6-8', interest: 'music', search: 'wood', sort: 'price-desc' });
    try {
      assert.equal(projection.collection.capabilities.discovery, false);
      assert.equal(dom.window.document.querySelector('select[name="age_band"],select[name="interest"],a[href*="age_band="],a[href*="interest="]'), null);
      assert.equal(dom.window.document.querySelector<HTMLInputElement>('input[type="search"]')!.value, 'wood');
      if (key === 'index') assert.ok([...dom.window.document.querySelectorAll('a')].some(link => link.textContent?.includes('Browse all activities')));
      else assert.equal(dom.window.document.querySelector<HTMLSelectElement>('select[name="sort"]')!.value, 'price-desc');
    } finally { closeDom(dom); }
  }
  assert.throws(() => validateDiscoveryProductPage(missing, StorefrontDiscoveryQuerySchema.parse({ age_band: '6-8' })), /filters are unavailable/);
});

test('selected zero-result synthetic rows never enable unsupported choosers; their valid query remains clearable', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ age_band: '6-8', interest: 'music', search: 'none', sort: 'name' });
  const { dom, projection } = await render('collection', page(query, [], true), query);
  try {
    assert.equal(projection.collection.capabilities.discovery, true); assert.equal(projection.collection.capabilities.toys_filters, false);
    assert.equal(projection.collection.discovery_facets.length, 2, 'canonical generic projection retains selected zero-count witnesses');
    assert.deepEqual(projection.collection.toy_facets, { age_bands: [], interests: [] });
    assert.equal(dom.window.document.querySelector('select[name="age_band"],select[name="interest"]'), null);
    assert.match(dom.window.document.body.textContent!, /Remove Age recommendation: 6-8|Remove Interest: music/);
    const applied = formQuery(dom.window.document.querySelector('.pf-filters')!);
    assert.equal(applied.age_band, '6-8'); assert.equal(applied.interest, 'music'); assert.equal(applied.sort, 'name'); assert.equal(applied.search, 'none');
  } finally { closeDom(dom); }
});

test('each missing actual facet independently hides its chooser and age entry links', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ age_band: '6-8', interest: 'music' });
  for (const supplied of [facets.slice(0, 1), facets.slice(1)]) for (const key of ['index', 'collection'] as const) {
    const age = supplied[0].key === 'age_band';
    const { dom, projection } = await render(key, page(query, supplied), query);
    try {
      assert.equal(projection.collection.capabilities.toys_filters, true);
      assert.equal(Boolean(dom.window.document.querySelector('select[name="age_band"]')), age);
      assert.equal(Boolean(dom.window.document.querySelector('select[name="interest"]')), !age);
      if (key === 'index') {
        const links = [...dom.window.document.querySelectorAll('.pf-ages a[href*="age_band="]')];
        assert.equal(links.length, age ? 1 : 0);
        if (age) { assert.match(links[0].textContent!, /६–८ वर्ष/); assert.equal(new URL(links[0].getAttribute('href')!, 'https://fixture.example').searchParams.get('age_band'), '6-8'); }
      }
    } finally { closeDom(dom); }
  }
});

test('actual generic GET forms retain search/sort and independent filters while resetting pagination', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ page: 2, age_band: '6-8', interest: 'music', search: 'tiles', sort: 'price-asc', category: 'activities', min_price: 100, max_price: 2000 });
  const { dom } = await render('collection', page(query, facets, false, 41), query);
  try {
    const document = dom.window.document;
    const applied = formQuery(document.querySelector('.pf-filters')!);
    assert.equal(applied.page, 1); assert.equal(applied.age_band, query.age_band); assert.equal(applied.interest, query.interest);
    assert.equal(applied.search, query.search); assert.equal(applied.sort, query.sort); assert.equal(applied.category, query.category);
    assert.equal(applied.min_price, query.min_price); assert.equal(applied.max_price, query.max_price);
    const links = [...document.querySelectorAll('.pf-active-filters a')];
    const clearAge = clearQuery(links.find(link => link.textContent!.includes('Remove Age recommendation:'))!);
    const clearInterest = clearQuery(links.find(link => link.textContent!.includes('Remove Interest:'))!);
    assert.equal(clearAge.age_band, undefined); assert.equal(clearAge.interest, query.interest);
    assert.equal(clearInterest.interest, undefined); assert.equal(clearInterest.age_band, query.age_band);
    for (const cleared of [clearAge, clearInterest]) { assert.equal(cleared.page, 1); assert.equal(cleared.search, query.search); assert.equal(cleared.sort, query.sort); }
    const next = new URL(document.querySelector('.pf-pagination a:last-child')!.getAttribute('href')!, 'https://fixture.example');
    assert.equal(next.pathname, path); assert.equal(next.searchParams.get('page'), '3'); assert.equal(next.searchParams.get('age_band'), '6-8'); assert.equal(next.searchParams.get('interest'), 'music');
  } finally { closeDom(dom); }
});

test('supplied option labels remain escaped literal text inside the real DOM', async () => {
  const label = '<img src=x onerror=alert(1)> "माप" & sound';
  const query = StorefrontDiscoveryQuerySchema.parse({ interest: 'music' });
  const { dom } = await render('collection', page(query, [{ ...facets[1], label }]), query);
  try {
    assert.equal(dom.window.document.querySelector('select[name="interest"] option[value="music"]')!.textContent, label);
    assert.equal(dom.window.document.querySelector('select img,script,[onerror],[onload]'), null);
  } finally { closeDom(dom); }
});

test('nonboolean or incomplete capability aliases cannot enable selectors merely because rows are present', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({});
  for (const capabilities of [undefined, { discovery: false, toys_filters: true, toys_age_band: true, toys_interest: true }, { discovery: 'true', toys_filters: 'true', toys_age_band: 'true', toys_interest: 'true' }]) {
    const { dom } = await render('collection', page(query), query, undefined, { capabilities });
    try { assert.equal(dom.window.document.querySelector('select[name="age_band"],select[name="interest"]'), null); }
    finally { closeDom(dom); }
  }
  const { dom } = await render('collection', page(query), query, undefined, { toy_facets: { age_bands: [], interests: [] } });
  try { assert.equal(dom.window.document.querySelector('select[name="age_band"],select[name="interest"]'), null); }
  finally { closeDom(dom); }
});

test('invalid server age/interest values are rejected before a projected capability can be rendered', () => {
  const query = StorefrontDiscoveryQuerySchema.parse({});
  for (const facet of [{ ...facets[0], value: '14-18' }, { ...facets[1], value: '<script>' }]) {
    assert.throws(() => validateDiscoveryProductPage(page(query, [facet]), query), /temporarily unavailable/);
  }
});

const continuityQuery = () => StorefrontDiscoveryQuerySchema.parse({ page: 2, limit: 1, search: 'Model guide', sort: 'price-desc', category: 'Accessories', country_of_origin: 'India', connector: ['usb-c', 'hdmi'], age_band: '6-8', interest: 'music', min_price: 100, max_price: 2000, size: 'M', color: 'Red' });

test('actual collection/search FormData preserves every unedited canonical field, repeated values and limit through sort/search edits', async () => {
  const query = continuityQuery();
  for (const key of ['collection', 'search'] as const) {
    const { dom } = await render(key, page(query, facets, false, 6), query);
    try {
      const forms = [...dom.window.document.querySelectorAll('form')];
      assert.equal(forms.length, key === 'search' ? 2 : 1);
      for (const form of forms) {
        const initial = formParams(form);
        assert.deepEqual(initial.getAll('connector'), ['usb-c', 'hdmi']);
        assert.equal(initial.getAll('search').length, 1);
        assert.deepEqual(parseParams(initial), { ...query, page: 1 });
        const searched = form.cloneNode(true) as HTMLFormElement;
        searched.querySelector<HTMLInputElement>('input[name="search"]')!.value = 'New search';
        assert.deepEqual(formQuery(searched), { ...query, page: 1, search: 'New search' });
        const sorted = form.cloneNode(true) as HTMLFormElement;
        const sort = sorted.querySelector<HTMLSelectElement>('select[name="sort"]');
        if (sort) { sort.value = 'price-asc'; assert.deepEqual(formQuery(sorted), { ...query, page: 1, sort: 'price-asc' }); }
      }
    } finally { closeDom(dom); }
  }
});

test('every independent clear is the supplied canonical URL and retains other fields including one repeated connector', async () => {
  const query = continuityQuery();
  const connectors = query.connector; assert.ok(Array.isArray(connectors));
  for (const key of ['collection', 'search'] as const) {
    const { dom, projection } = await render(key, page(query, facets, false, 6), query);
    try {
      const links = [...dom.window.document.querySelectorAll('.pf-active-filters a')];
      for (const filter of projection.collection.active_filters) {
        const link = links.find(candidate => candidate.getAttribute('href') === filter.clear_url);
        assert.ok(link, `Missing actual clear for ${key}: ${filter.key}=${filter.value}`);
        const cleared = clearQuery(link);
        assert.equal(cleared.page, 1);
        for (const [field, value] of Object.entries(query)) {
          if (field === 'page' || field === filter.key) continue;
          const actual = cleared[field as keyof StorefrontDiscoveryQuery];
          assert.deepEqual(Array.isArray(actual) ? [...actual].sort() : actual, Array.isArray(value) ? [...value].sort() : value, `${filter.key} clear retained ${field}`);
        }
        if (filter.key === 'connector') assert.deepEqual(new URL(link.getAttribute('href')!, 'https://fixture.example').searchParams.getAll('connector'), connectors.filter(value => value !== filter.value));
        else assert.equal(cleared[filter.key], undefined);
      }
      const all = links.find(link => link.textContent === 'Clear all filters')!;
      assert.equal(all.getAttribute('href'), projection.collection.clear_filters_url);
      const cleared = clearQuery(all);
      assert.equal(cleared.search, query.search); assert.equal(cleared.sort, query.sort); assert.equal(cleared.limit, query.limit); assert.equal(cleared.page, 1);
    } finally { closeDom(dom); }
  }
});

test('absent conditional choosers and zero results retain their active fields as canonical hidden values on both routes', async () => {
  const query = continuityQuery();
  for (const supplied of [facets.slice(0, 1), facets.slice(1), []]) for (const key of ['collection', 'search'] as const) {
    const zero = supplied.length === 0;
    const { dom } = await render(key, page(query, supplied, zero, zero ? 0 : 6), query);
    try {
      for (const form of dom.window.document.querySelectorAll('form')) {
        assert.deepEqual(formQuery(form), { ...query, page: 1 }, `${key} keeps hidden active values when chooser is absent`);
        assert.deepEqual(formParams(form).getAll('connector'), ['usb-c', 'hdmi']);
      }
      for (const [field, expected] of [['age_band', query.age_band], ['interest', query.interest]] as const) {
        const visible = dom.window.document.querySelector(`.pf-filters select[name="${field}"]`);
        if (!visible) assert.equal(dom.window.document.querySelector<HTMLInputElement>(`.pf-filters input[type="hidden"][name="${field}"]`)!.value, expected);
      }
      const sortForm = dom.window.document.querySelector('.pf-filters')!.cloneNode(true) as HTMLFormElement;
      sortForm.querySelector<HTMLSelectElement>('select[name="sort"]')!.value = 'name';
      assert.deepEqual(formQuery(sortForm), { ...query, page: 1, sort: 'name' });
      if (zero) assert.equal(dom.window.document.querySelector('select[name="age_band"],select[name="interest"]'), null);
    } finally { closeDom(dom); }
  }
});

test('ordinary metadata-free collection/search retains basic canonical query fields through native FormData', async () => {
  const query = StorefrontDiscoveryQuerySchema.parse({ page: 2, limit: 1, search: 'Plain search', category: 'Activities', country_of_origin: 'India', sort: 'price-desc', min_price: 100, max_price: 2000, size: 'M' });
  const response = page(query, [], false, 6); delete response.discovery;
  for (const key of ['collection', 'search'] as const) {
    const { dom } = await render(key, response, query);
    try {
      assert.equal(dom.window.document.querySelector('select[name="age_band"],select[name="interest"]'), null);
      for (const form of dom.window.document.querySelectorAll('form')) assert.deepEqual(formQuery(form), { ...query, page: 1 });
    } finally { closeDom(dom); }
  }
});

test('changing or blanking a rendered chooser submits only that edited value and no duplicate hidden scalar', async () => {
  const query = continuityQuery();
  const choices = [...facets, { key: 'age_band' as const, value: '9-12', label: '9–12 years', count: 1 }];
  for (const key of ['collection', 'search'] as const) {
    const { dom } = await render(key, page(query, choices, false, 6), query);
    try {
      const form = dom.window.document.querySelector('.pf-filters')!;
      for (const [field, value] of [['age_band', '9-12'], ['age_band', ''], ['interest', '']] as const) {
        const edited = form.cloneNode(true) as HTMLFormElement;
        edited.querySelector<HTMLSelectElement>(`select[name="${field}"]`)!.value = value;
        const params = formParams(edited);
        assert.equal(params.getAll(field).length, 1);
        assert.deepEqual(parseParams(params), { ...query, page: 1, [field]: value || undefined });
      }
    } finally { closeDom(dom); }
  }
});

test('trusted Playfield demo stays no-network and refuses unsupported discovery instead of simulating backend filters', () => {
  const slug = 'letbuyy-bloom';
  const content = resolveCatalogDemoContent(slug, '2.0.0', { themeId: slug, liquidBundle: createFirstPartyCatalogBundle(slug, { designVersion: '2.0.0' }) }, '/products');
  assert.ok(content); assert.doesNotThrow(() => selectCatalogDemoProducts(content));
  const route = catalogDemoRoute(content);
  assert.throws(() => selectCatalogDemoProducts(content, { ...route, discoveryQuery: StorefrontDiscoveryQuerySchema.parse({ connector: ['usb-c', 'hdmi'] }) }), /unavailable|unsupported|clear/i);
  assert.equal(networkCalls, 0);
});

test('a validated active value absent from supplied choices stays selected only inside an independently supported chooser', async () => {
  const query = continuityQuery();
  const otherChoices: StorefrontDiscoveryFacet[] = [{ key: 'age_band', value: '9-12', label: '9–12 years', count: 1 }, { key: 'interest', value: 'building', label: 'Building', count: 1 }];
  for (const key of ['collection', 'search'] as const) {
    const { dom, projection } = await render(key, page(query, otherChoices, false, 6), query);
    try {
      assert.equal(projection.collection.capabilities.toys_age_band, true); assert.equal(projection.collection.capabilities.toys_interest, true);
      const form = dom.window.document.querySelector('.pf-filters')!;
      assert.equal(form.querySelector<HTMLSelectElement>('select[name="age_band"]')!.value, query.age_band);
      assert.equal(form.querySelector<HTMLSelectElement>('select[name="interest"]')!.value, query.interest);
      assert.deepEqual(formQuery(form), { ...query, page: 1 });
    } finally { closeDom(dom); }
  }
});
