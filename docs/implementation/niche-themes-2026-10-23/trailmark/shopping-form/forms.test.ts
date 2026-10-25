import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { JSDOM } = createRequire(new URL('../../../../../packages/theme-engine/package.json', import.meta.url))('jsdom') as typeof import('jsdom');
type DomInstance = InstanceType<typeof JSDOM>;
import ts from 'typescript';
import { createTrailmarkTheme } from '../../../../../packages/theme-engine/src/trailmark-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../../packages/theme-engine/src/theme-bundle-core';
import { LiquidRenderer } from '../../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../../packages/theme-engine/src/theme-settings';
import { TRAILMARK_FILTERS } from '../../../../../packages/theme-engine/src/trailmark-discovery';
import { StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, storefrontDiscoveryUrl, type StorefrontDiscoveryQuery, type StorefrontDiscoveryMetadata } from '../../../../../packages/commerce-core/src/storefront-discovery';
import { projectDiscoveryPage, validateDiscoveryProductPage } from '../../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';

// Synthetic response metadata tests transport/render behavior, not live SQL matching or facet eligibility.
const collectionId = '22222222-2222-4222-8222-222222222222';
const original = StorefrontDiscoveryQuerySchema.parse({
  page: 4, limit: 17, sort: 'price-asc', search: 'Court "kit" & sleeves', category: 'Court & movement', country_of_origin: 'IN', collection_id: collectionId,
  size: 'M', color: 'Forest', min_price: 0, max_price: 50000, age_band: '6-8', interest: 'making',
  electronics_kind: 'cable', connector: ['usb-c', 'hdmi'], power_input_w: 65, power_output_w: 45, power_capacity_w: 100, pass_through_output_w: 60, data_rate_mbps: 480, length_mm: 1000,
  pack_size: 'g:250', material: 'Wood', finish: 'Natural', max_width_cm: 80, max_depth_cm: 65, occasion: 'birthday', recipient: 'friend', personalization_method: 'embroidery',
  routine_stage: 'care', format: 'Lotion', shade: 'Rose', activity: 'Badminton', equipment_type: 'racket', length_value: 68, length_unit: 'cm',
  books_kind: 'book', books_author: 'A. Author', books_subject: 'Movement', books_language: 'English', books_format: 'paperback', books_ruling: 'lined',
});
const supplied: StorefrontDiscoveryMetadata['facets'] = [
  { key: 'activity', value: 'badminton', label: 'Badminton', count: 7 },
  { key: 'equipment_type', value: 'racket', label: 'Racket', count: 6 },
  { key: 'equipment_type', value: 'storage', label: 'Storage', count: 4 },
];
type MeasurementCapabilities = NonNullable<StorefrontDiscoveryMetadata['measurement_capabilities']>;
const supportedMeasurements: MeasurementCapabilities = { equipment_length: { available: true, allowed_units: ['cm'] }, max_width_cm: { available: false }, max_depth_cm: { available: false } };
function windowFor(dom: DomInstance) {
  return dom.window as typeof dom.window & { FormData: new (form: HTMLFormElement) => FormData; close(): void };
}
function formData(form: HTMLFormElement, dom: DomInstance): FormData { return new (windowFor(dom).FormData)(form); }
function parseData(data: FormData): StorefrontDiscoveryQuery {
  return StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(Array.from(data.entries()).map(([key,value]) => {
    assert.equal(typeof value, 'string'); return [key, String(value)] as const;
  })));
}
function parseHref(href: string): StorefrontDiscoveryQuery {
  return StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(new URL(href, 'https://store.example.invalid').searchParams));
}
function sameQuery(actual: unknown, expected: unknown, path: string): void {
  assert.equal(storefrontDiscoveryUrl(path, actual), storefrontDiscoveryUrl(path, expected), 'every canonical field and repeated value must survive');
}
async function rendered(key: 'collection' | 'search', query = original, facets = supplied, previousFilters?: string, capabilities: MeasurementCapabilities | null = supportedMeasurements) {
  const path = key === 'collection' ? `/collections/${collectionId}` : '/search';
  const page = validateDiscoveryProductPage({ data: [], total: 32, page: query.page, limit: query.limit, has_more: query.page * query.limit < 32, discovery: { query, facets, matches: [], ...(capabilities === null ? {} : { measurement_capabilities: capabilities }) } }, query);
  const projection = projectDiscoveryPage(page, path, query, key === 'collection');
  const bundle = createTrailmarkTheme(createLetbuyyCoreLiquidThemeBundleFixture());
  if (previousFilters) for (const type of ['collection-filter', 'collection-product-list']) bundle.sections[type].source = bundle.sections[type].source.replace(TRAILMARK_FILTERS, previousFilters);
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'trailmark-form-fixture', path, previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-ride', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] }, liquidTemplateKey: key, liquidBundle: bundle,
    liquidContext: { request: { path, query: projection.query }, collection: { ...projection.collection, products: [] }, search: { terms: query.search } },
  });
  assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
  const dom = new JSDOM(result.liquid!.contentForLayout);
  return { dom, doc: dom.window.document, path, projection };
}

test('before-fix positive control reproduces lost canonical fields using the actual old Liquid source and native FormData', async () => {
  const source = readFileSync(new URL('./baseline/packages/theme-engine/src/trailmark-discovery.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded: { exports: { TRAILMARK_FILTERS?: string } } = { exports: {} };
  new Function('exports', code)(loaded.exports); assert.ok(loaded.exports.TRAILMARK_FILTERS);
  const f = await rendered('collection', original, supplied, loaded.exports.TRAILMARK_FILTERS);
  try {
    const form = f.doc.querySelector<HTMLFormElement>('.tm-facets form')!;
    const data = formData(form, f.dom);
    assert.deepEqual(data.getAll('connector'), []); assert.equal(data.has('limit'), false); assert.equal(data.has('country_of_origin'), false); assert.equal(data.has('category'), false);
    const clear = form.querySelector<HTMLAnchorElement>('a')!;
    assert.equal(new URL(clear.getAttribute('href')!, 'https://store.example.invalid').search, '');
    assert.notEqual(storefrontDiscoveryUrl(f.path, parseData(data)), storefrontDiscoveryUrl(f.path, { ...original, page: 1 }));
  } finally { windowFor(f.dom).close(); }
});

for (const key of ['collection', 'search'] as const) {
  test(`${key}: Apply and sort preserve every unedited key/array/limit, exclude page and avoid duplicate edited fields`, async () => {
    const f = await rendered(key);
    try {
      const form = f.doc.querySelector<HTMLFormElement>('.tm-discovery-form')!; assert.ok(form);
      const data = formData(form, f.dom); assert.equal(data.has('page'), false); assert.deepEqual(data.getAll('connector'), ['usb-c', 'hdmi']);
      assert.equal(form.getAttribute('action'), f.path); assert.equal(form.getAttribute('method'), 'get');
      assert.equal(form.firstElementChild?.tagName, 'LABEL', 'preserved hidden rows do not displace the existing first-label responsive selector');
      for (const name of ['search', 'activity', 'equipment_type', 'sort', 'length_value', 'length_unit']) assert.equal(data.getAll(name).length, 1, name);
      sameQuery(parseData(data), { ...original, page: 1 }, f.path);
      form.querySelector<HTMLSelectElement>('[name="sort"]')!.value = 'newest';
      sameQuery(parseData(formData(form, f.dom)), { ...original, page: 1, sort: 'newest' }, f.path);
      form.querySelector<HTMLInputElement>('[name="search"]')!.value = 'Shuttles & sleeves';
      form.querySelector<HTMLSelectElement>('[name="activity"]')!.value = '';
      form.querySelector<HTMLSelectElement>('[name="equipment_type"]')!.value = 'storage';
      sameQuery(parseData(formData(form, f.dom)), { ...original, page: 1, sort: 'newest', search: 'Shuttles & sleeves', activity: undefined, equipment_type: 'storage' }, f.path);
    } finally { windowFor(f.dom).close(); }
  });

  test(`${key}: missing capabilities preserve selected sports values; absent unit metadata never fabricates length controls`, async () => {
    for (const facets of [[], supplied.filter(facet => facet.key !== 'length_unit')]) {
      const f = await rendered(key, original, facets, undefined, null);
      try {
        assert.equal(f.doc.querySelector('.tm-length-form'), null); assert.equal(f.doc.querySelector('select[name="length_unit"]'), null);
        const form = f.doc.querySelector<HTMLFormElement>('.tm-discovery-form')!;
        const data = formData(form, f.dom); sameQuery(parseData(data), { ...original, page: 1 }, f.path);
        assert.deepEqual(data.getAll('length_value'), ['68']); assert.deepEqual(data.getAll('length_unit'), ['cm']);
        const pair = f.projection.collection.active_filters.find(filter => filter.key === 'length_value')!;
        assert.ok(Array.from(f.doc.querySelectorAll<HTMLAnchorElement>('.tm-active-filters a')).some(link => link.getAttribute('href') === pair.clear_url));
        sameQuery(parseHref(pair.clear_url), { ...original, page: 1, length_value: undefined, length_unit: undefined }, f.path);
        if (!facets.length) { assert.equal(f.doc.querySelector('select[name="activity"]'), null); assert.equal(f.doc.querySelector('select[name="equipment_type"]'), null); }
        else { assert.match(form.querySelector('select[name="activity"]')!.textContent!, /Current filter: Badminton/); }
      } finally { windowFor(f.dom).close(); }
    }
  });

  test(`${key}: actual supplied length units enable an independent required pair; blank/half-pairs cannot submit`, async () => {
    const query = StorefrontDiscoveryQuerySchema.parse({ ...original, length_value: undefined, length_unit: undefined });
    const f = await rendered(key, query);
    try {
      const main = f.doc.querySelector<HTMLFormElement>('.tm-discovery-form')!, length = f.doc.querySelector<HTMLFormElement>('.tm-length-form')!;
      assert.ok(length); assert.equal(length.getAttribute('action'), f.path);
      const value = length.querySelector<HTMLInputElement>('[name="length_value"]')!, unit = length.querySelector<HTMLSelectElement>('[name="length_unit"]')!;
      assert.equal(value.required, true); assert.equal(unit.required, true); assert.deepEqual(Array.from(unit.options, option => option.value), ['', 'cm'], 'no invented mm/m/in unit choices');
      assert.equal(main.checkValidity(), true); sameQuery(parseData(formData(main, f.dom)), { ...query, page: 1 }, f.path);
      assert.equal(length.checkValidity(), false); value.value = '68'; assert.equal(length.checkValidity(), false); unit.value = 'cm'; assert.equal(length.checkValidity(), true);
      const data = formData(length, f.dom); assert.deepEqual(data.getAll('connector'), ['usb-c', 'hdmi']); assert.equal(data.has('page'), false);
      assert.equal(data.getAll('length_value').length, 1); assert.equal(data.getAll('length_unit').length, 1);
      sameQuery(parseData(data), { ...query, page: 1, length_value: 68, length_unit: 'cm' }, f.path);
      value.value = ''; assert.equal(length.checkValidity(), false); assert.throws(() => parseData(formData(length, f.dom)), /Supply an equipment length and its unit together/);
      value.value = '68'; unit.value = ''; assert.equal(length.checkValidity(), false); assert.throws(() => parseData(formData(length, f.dom)), /Supply an equipment length and its unit together/);
    } finally { windowFor(f.dom).close(); }
  });

  test(`${key}: active clear links retain every other value and clear length/unit together; clear-all uses its canonical URL`, async () => {
    const f = await rendered(key);
    try {
      const links = Array.from(f.doc.querySelectorAll<HTMLAnchorElement>('.tm-active-filters a'));
      assert.equal(links.length, f.projection.collection.active_filters.length);
      for (const [index, filter] of f.projection.collection.active_filters.entries()) {
        const link = links[index]; assert.equal(link.getAttribute('href'), filter.clear_url);
        const expected: Record<string, unknown> = { ...original, page: 1 };
        if (filter.key === 'length_value') { delete expected.length_value; delete expected.length_unit; }
        else if (filter.key === 'connector') expected.connector = original.connector instanceof Array ? original.connector.filter(value => value !== filter.value) : undefined;
        else delete expected[filter.key];
        sameQuery(parseHref(link.getAttribute('href')!), expected, f.path);
      }
      const pairClear = f.doc.querySelector<HTMLAnchorElement>('.tm-clear-length')!; assert.ok(pairClear);
      const clearedPair = parseHref(pairClear.getAttribute('href')!); assert.equal(clearedPair.length_value, undefined); assert.equal(clearedPair.length_unit, undefined);
      const clearAll = f.doc.querySelector<HTMLAnchorElement>('.tm-clear-all')!; assert.equal(clearAll.getAttribute('href'), f.projection.collection.clear_filters_url);
      sameQuery(parseHref(clearAll.getAttribute('href')!), { search: original.search, sort: original.sort, limit: original.limit, ...(key === 'collection' ? { collection_id: collectionId } : {}) }, f.path);
    } finally { windowFor(f.dom).close(); }
  });
}
