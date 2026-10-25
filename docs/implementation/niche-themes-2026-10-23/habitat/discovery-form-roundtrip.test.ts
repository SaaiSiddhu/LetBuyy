// Actual server payload validation -> app projection -> v2 Liquid -> FormData ->
// canonical parser. This is an in-process UI contract, with no SQL/browser/HTTP claim.
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { createRequire } from 'node:module';
import {
    StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, storefrontDiscoveryUrl,
    type StorefrontDiscoveryFacet, type StorefrontDiscoveryQuery, type ProductModel,
} from '../../../../packages/commerce-core/src/index';
import { readStorefrontDiscoveryPayload } from '../../../../services/api-gateway/src/lib/storefront-discovery';
import { projectDiscoveryPage, validateDiscoveryProductPage } from '../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';
import { createFirstPartyCatalogBundle, LiquidRenderer, DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/index';
import type { StorefrontDiscoveryMeasurementCapabilities } from '../../../../packages/commerce-core/src/storefront-discovery';

const requireTheme = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url));
const { JSDOM } = requireTheme('jsdom') as { JSDOM: new (html: string, options?: { url: string }) => { window: { document: Document; FormData: typeof FormData; close(): void } } };
const storeId = '11111111-1111-4111-8111-111111111111';
const product: ProductModel = { id: '22222222-2222-4222-8222-222222222222', name: 'Supplied furniture', description: 'Contract fixture', price: 999, currency: 'INR', stock: 5, images: [] };
const selected = StorefrontDiscoveryQuerySchema.parse({
    page: 2, limit: 1, search: 'Model guide & आकार', category: 'Accessories', country_of_origin: 'India', sort: 'newest',
    collection_id: '33333333-3333-4333-8333-333333333333', size: 'Compact', color: 'Natural', min_price: 100, max_price: 1500,
    age_band: '6-8', interest: 'art', electronics_kind: 'hub', connector: ['usb-c', 'hdmi'],
    power_input_w: 100, power_output_w: 85, power_capacity_w: 120, pass_through_output_w: 85, data_rate_mbps: 5000, length_mm: 100,
    pack_size: 'g:250', material: 'Wood', finish: 'Natural', max_width_cm: 61, max_depth_cm: 76.3,
    occasion: 'birthday', recipient: 'friend', personalization_method: 'engrave', routine_stage: 'colour', format: 'Tint', shade: 'Rosewater',
    activity: 'badminton', equipment_type: 'racket', length_value: 67.5, length_unit: 'cm',
    books_kind: 'book', books_author: 'Asha', books_subject: 'Fiction', books_language: 'Hindi', books_format: 'paperback', books_ruling: 'lined',
});
const facets: StorefrontDiscoveryFacet[] = [
    { key: 'material', value: 'wood', label: 'Wood', count: 4 }, { key: 'material', value: 'metal', label: 'Metal & steel', count: 2 },
    { key: 'finish', value: 'natural', label: 'Natural', count: 4 }, { key: 'finish', value: 'black', label: 'Black', count: 2 },
];
let networkCalls = 0;
const originalFetch = globalThis.fetch;
before(() => { globalThis.fetch = async () => { networkCalls++; throw new Error('Network is outside this bounded contract'); }; });
after(() => { globalThis.fetch = originalFetch; assert.equal(networkCalls, 0); });
const parse = (params: URLSearchParams) => StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(params));
function same(actual: StorefrontDiscoveryQuery, expected: StorefrontDiscoveryQuery) {
    assert.equal(storefrontDiscoveryUrl('/products', actual), storefrontDiscoveryUrl('/products', expected));
}
function submit(dom: InstanceType<typeof JSDOM>, form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new dom.window.FormData(form)) { assert.equal(typeof value, 'string'); params.append(key, String(value)); }
    return { params, query: parse(params) };
}
const capability = (width: boolean, depth: boolean): StorefrontDiscoveryMeasurementCapabilities => ({
    equipment_length: { available: false, allowed_units: [] }, max_width_cm: { available: width }, max_depth_cm: { available: depth },
});
type ResponseOptions = { measurementCapabilities?: unknown; total?: number; emptyPage?: boolean };
async function render(route: 'collection' | 'search', query = selected, suppliedFacets = facets, metadata = true, showFilters = true, options: ResponseOptions = {}) {
    const path = route === 'search' ? '/search' : '/collections/living-room';
    const total = options.total ?? 6;
    const products = total === 0 || options.emptyPage ? [] : [product];
    const payload = readStorefrontDiscoveryPayload({ data: products.map(row => ({ id: row.id, price: row.price })), count: total, facets: suppliedFacets, matches: products.map(row => ({ product_id: row.id, price: row.price, variant_ids: [] })), ...(Object.hasOwn(options, 'measurementCapabilities') ? { measurement_capabilities: options.measurementCapabilities } : {}) }, query);
    const page = validateDiscoveryProductPage({ data: products, total, page: query.page, limit: query.limit, has_more: query.page * query.limit < total, ...(metadata ? { discovery: payload.discovery } : {}) }, query);
    const projection = projectDiscoveryPage(page, path, query, route === 'collection');
    const bundle = createFirstPartyCatalogBundle('letbuyy-craft', { designVersion: '2.0.0' });
    const type = route === 'search' ? 'collection-product-list' : 'collection-filter';
    for (const section of Object.values(bundle.templates[route].sections)) if (section.type === type) section.settings.showDimensionFilters = showFilters;
    const drop = { id: product.id, title: product.name, price: product.price, currency: 'INR', url: '/products/supplied', available: true, images: [] };
    const drops = products.length ? [drop] : [];
    const result = await new LiquidRenderer().render({
        context: { storeId, subdomain: 'habitat-contract', path, previewMode: false, locale: 'en-IN', searchParams: query as unknown as Record<string, string> },
        storeTemplate: { themeId: 'letbuyy-craft', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: route, type: route, layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: route,
        liquidContext: { request: { path, query: projection.query }, shop: { name: 'Contract store', ...projection.shop }, collections: [], collection: { title: 'Supplied collection', products: drops, ...projection.collection }, section_products: Object.fromEntries(Object.keys(bundle.templates[route].sections).map(id => [id, drops])) },
    });
    assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
    const dom = new JSDOM(result.liquid!.contentForLayout, { url: 'https://shop.example.invalid' + path });
    assert.equal(dom.window.document.querySelectorAll('form.hab-filters').length, 1);
    return { dom, form: dom.window.document.querySelector<HTMLFormElement>('form.hab-filters')!, projection, path };
}

for (const route of ['collection', 'search'] as const) {
    test(`${route}: actual sort/apply/search forms preserve every unedited canonical value and repeated connectors`, async () => {
        const { dom, form, path } = await render(route);
        try {
            assert.equal(form.method, 'get'); assert.equal(form.getAttribute('action'), path);
            same(submit(dom, form).query, { ...selected, page: 1 });
            assert.deepEqual(submit(dom, form).params.getAll('connector'), ['usb-c', 'hdmi']);
            assert.equal(submit(dom, form).params.has('page'), false);
            const sort = form.querySelector<HTMLSelectElement>('[name="sort"]')!;
            assert.equal(sort.value, 'newest'); sort.value = 'price-asc';
            same(submit(dom, form).query, { ...selected, sort: 'price-asc', page: 1 });
            const material = form.querySelector<HTMLSelectElement>('[name="material"]')!;
            assert.equal(material.tagName, 'SELECT'); assert.equal(material.value, 'Wood');
            assert.deepEqual([...material.options].map(row => [row.value, row.text]), [['', 'Any material'], ['Wood', 'Current: Wood'], ['wood', 'Wood'], ['metal', 'Metal & steel']]);
            material.value = 'metal';
            same(submit(dom, form).query, { ...selected, sort: 'price-asc', material: 'metal', page: 1 });
            form.querySelector<HTMLInputElement>('[name="search"]')!.value = 'New room';
            same(submit(dom, form).query, { ...selected, search: 'New room', sort: 'price-asc', material: 'metal', page: 1 });
            material.value = ''; form.querySelector<HTMLSelectElement>('[name="finish"]')!.value = '';
            same(submit(dom, form).query, { ...selected, search: 'New room', sort: 'price-asc', material: undefined, finish: undefined, page: 1 });
            for (const key of ['material', 'finish', 'sort', 'search']) assert.equal(form.querySelectorAll(`[name="${key}"]`).length, 1, `No duplicate scalar ${key}`);
        } finally { dom.window.close(); }
    });

    test(`${route}: selected and unselected choices retain supplied merchant labels and normalized values`, async () => {
        const normalized = { ...selected, material: 'wood', finish: 'natural' };
        const labelled = facets.map(facet => ({ ...facet, label: `${facet.label} · merchant supplied` }));
        const { dom, form } = await render(route, normalized, labelled);
        try {
            for (const key of ['material', 'finish'] as const) {
                const chooser = form.querySelector<HTMLSelectElement>(`select[name="${key}"]`)!;
                assert.equal(chooser.value, normalized[key]);
                assert.equal(form.querySelectorAll(`[name="${key}"]`).length, 1);
                assert.equal(chooser.selectedOptions.length, 1);
                assert.equal(chooser.selectedOptions[0].text, labelled.find(facet => facet.key === key && facet.value === normalized[key])!.label);
                assert.equal([...chooser.options].filter(option => option.value === normalized[key]).length, 1);
                assert.equal([...chooser.options].some(option => option.text.startsWith('Current:')), false, 'A supplied selected row is not a raw fallback');
                for (const facet of labelled.filter(facet => facet.key === key)) {
                    const option = [...chooser.options].find(option => option.value === facet.value)!;
                    assert.ok(option); assert.equal(option.text, facet.label);
                    chooser.value = facet.value;
                    same(submit(dom, form).query, { ...normalized, [key]: facet.value, page: 1 });
                    chooser.value = normalized[key];
                }
            }
            same(submit(dom, form).query, { ...normalized, page: 1 });
        } finally { dom.window.close(); }
    });

    test(`${route}: actual independent clears, clear-all and pagination keep unrelated query values`, async () => {
        const { dom, projection, path } = await render(route);
        try {
            const links = [...dom.window.document.querySelectorAll<HTMLAnchorElement>('.hab-active-filters a')];
            assert.equal(links.length, projection.collection.active_filters.length);
            for (const filter of projection.collection.active_filters) {
                const link = links.find(candidate => candidate.getAttribute('href') === filter.clear_url);
                assert.ok(link, filter.label);
                const actual = parse(new URL(link.href).searchParams);
                assert.equal(actual.page, 1); assert.equal(actual.limit, 1); assert.equal(actual.search, selected.search); assert.equal(actual.sort, selected.sort);
                if (filter.key === 'connector') { assert.ok(Array.isArray(selected.connector)); assert.deepEqual(Array.isArray(actual.connector) ? actual.connector : [actual.connector], selected.connector.filter(value => value !== filter.value)); }
                else if (filter.key === 'length_value') { assert.equal(actual.length_value, undefined); assert.equal(actual.length_unit, undefined); }
                else assert.equal(actual[filter.key], undefined);
                const removed = new Set<string>([filter.key, ...(filter.key === 'length_value' ? ['length_unit'] : [])]);
                for (const [key, value] of Object.entries(selected)) if (!removed.has(key) && key !== 'page') {
                    const submitted = actual[key as keyof StorefrontDiscoveryQuery];
                    assert.deepEqual(Array.isArray(submitted) ? [...submitted].sort() : submitted, Array.isArray(value) ? [...value].sort() : value, `${filter.key} clear changed ${key}`);
                }
            }
            const clearAll = [...dom.window.document.querySelectorAll<HTMLAnchorElement>('form.hab-filters a')].find(link => link.textContent === 'Clear filters')!;
            assert.equal(clearAll.getAttribute('href'), projection.collection.clear_filters_url);
            same(parse(new URL(clearAll.href).searchParams), StorefrontDiscoveryQuerySchema.parse({ search: selected.search, sort: selected.sort, limit: selected.limit, ...(route === 'collection' ? { collection_id: selected.collection_id } : {}) }));
            const pagination = [...dom.window.document.querySelectorAll<HTMLAnchorElement>('.hab-pagination a')];
            assert.equal(pagination.length, 2);
            for (const [index, link] of pagination.entries()) { assert.equal(new URL(link.href).pathname, path); same(parse(new URL(link.href).searchParams), { ...selected, page: index === 0 ? 1 : 3 }); }
        } finally { dom.window.close(); }
    });

    test(`${route}: missing per-dimension support preserves thresholds as hidden fields without advertising controls`, async () => {
        const { dom, form, projection } = await render(route);
        try {
            assert.ok(projection.collection.furniture_filters_available);
            assert.ok(projection.collection.furniture_facets.some(row => row.key === 'max_width_cm' && row.count === 0), 'The real projection adds selected values without supplying capabilities');
            for (const key of ['max_width_cm', 'max_depth_cm']) { assert.equal(form.querySelector(`[name="${key}"]:not([type="hidden"])`), null); assert.equal(form.querySelectorAll(`[name="${key}"][type="hidden"]`).length, 1); }
            same(submit(dom, form).query, { ...selected, page: 1 });
        } finally { dom.window.close(); }
        const hidden = await render(route, selected, facets, true, false);
        try { assert.equal(hidden.form.querySelector('select[name="material"]'), null); same(submit(hidden.dom, hidden.form).query, { ...selected, page: 1 }); } finally { hidden.dom.window.close(); }
        const basic = StorefrontDiscoveryQuerySchema.parse({ search: 'Chair', category: 'Chairs', country_of_origin: 'India', connector: undefined, sort: 'newest', limit: 7 });
        const absent = await render(route, basic, [], false);
        try { assert.equal(absent.form.querySelector('[name="material"], [name="finish"], input[type="number"]'), null); same(submit(absent.dom, absent.form).query, basic); } finally { absent.dom.window.close(); }
    });

    test(`${route}: independent admitted axis capabilities enable cm controls without categorical facets or rounding`, async () => {
        for (const [width, depth] of [[true, false], [false, true], [true, true]]) {
            const supplied = capability(width, depth);
            const { dom, form, projection } = await render(route, selected, [], true, true, { measurementCapabilities: supplied });
            try {
                assert.equal(projection.collection.furniture_filters_available, false, 'No material/finish facet is needed for a dimension');
                assert.deepEqual(projection.collection.measurement_capabilities, supplied);
                for (const [key, available] of [['max_width_cm', width], ['max_depth_cm', depth]] as const) {
                    const number = form.querySelector<HTMLInputElement>(`input[type="number"][name="${key}"]`);
                    assert.equal(Boolean(number), available);
                    assert.equal(form.querySelectorAll(`[name="${key}"]`).length, 1, 'Only a visible control or hidden carrier');
                    if (number) {
                        assert.equal(number.value, String(selected[key])); assert.equal(number.step, 'any'); assert.equal(number.max, '1000000');
                        assert.match(number.closest('label')!.textContent!, /Maximum assembled (width|depth) \(cm\)/);
                        number.value = '0.025'; same(submit(dom, form).query, { ...selected, page: 1, [key]: 0.025 });
                        number.value = ''; same(submit(dom, form).query, { ...selected, page: 1, [key]: undefined });
                        number.value = '0'; assert.throws(() => submit(dom, form));
                        number.value = '1000001'; assert.throws(() => submit(dom, form));
                        number.value = String(selected[key]);
                    }
                }
                same(submit(dom, form).query, { ...selected, page: 1 });
                assert.deepEqual(submit(dom, form).params.getAll('connector'), ['usb-c', 'hdmi']);
            } finally { dom.window.close(); }
        }
    });

    test(`${route}: numeric facets never substitute for absent/false capabilities and the merchant toggle preserves carriers`, async () => {
        const numericFacets: StorefrontDiscoveryFacet[] = [...facets, { key: 'max_width_cm', value: '61', label: '61 cm', count: 1 }, { key: 'max_depth_cm', value: '76.3', label: '76.3 cm', count: 1 }];
        for (const options of [{}, { measurementCapabilities: capability(false, false) }]) {
            const { dom, form, projection } = await render(route, selected, numericFacets, true, true, options);
            try {
                assert.equal(form.querySelector('input[type="number"]'), null);
                if (!Object.hasOwn(options, 'measurementCapabilities')) assert.equal(Object.hasOwn(projection.collection, 'measurement_capabilities'), false);
                same(submit(dom, form).query, { ...selected, page: 1 });
            } finally { dom.window.close(); }
        }
        const hidden = await render(route, selected, facets, true, false, { measurementCapabilities: capability(true, true) });
        try { assert.equal(hidden.form.querySelector('input[type="number"],select[name="material"],select[name="finish"]'), null); same(submit(hidden.dom, hidden.form).query, { ...selected, page: 1 }); } finally { hidden.dom.window.close(); }
    });

    test(`${route}: zero results recover each active threshold while a positive past-end cohort retains capability`, async () => {
        const { dom, form, projection } = await render(route, selected, [], true, true, { measurementCapabilities: capability(false, false), total: 0 });
        try {
            assert.equal(form.querySelector('input[type="number"]'), null);
            same(submit(dom, form).query, { ...selected, page: 1 });
            for (const key of ['max_width_cm', 'max_depth_cm'] as const) {
                const serverLink = projection.collection.active_filters.find(filter => filter.key === key)!;
                const link = [...dom.window.document.querySelectorAll<HTMLAnchorElement>('.hab-active-filters a')].find(link => link.getAttribute('href') === serverLink.clear_url)!;
                assert.ok(link); same(parse(new URL(link.href).searchParams), { ...selected, page: 1, [key]: undefined });
            }
            form.querySelector<HTMLSelectElement>('[name="sort"]')!.value = 'price-asc';
            same(submit(dom, form).query, { ...selected, sort: 'price-asc', page: 1 });
            assert.deepEqual(submit(dom, form).params.getAll('connector'), ['usb-c', 'hdmi']);
        } finally { dom.window.close(); }
        const pastEnd = await render(route, { ...selected, page: 10000 }, [], true, true, { measurementCapabilities: capability(true, true), emptyPage: true });
        try {
            assert.equal(pastEnd.dom.window.document.querySelectorAll('.hab-card').length, 0);
            assert.equal(pastEnd.form.querySelectorAll('input[type="number"]').length, 2);
            same(submit(pastEnd.dom, pastEnd.form).query, { ...selected, page: 1 });
        } finally { pastEnd.dom.window.close(); }
    });

    test(`${route}: malformed present or contradictory zero-total capabilities fail before Liquid`, async () => {
        const valid = capability(true, true);
        const malformed: unknown[] = [null, 'true', {}, { max_width_cm: { available: true }, max_depth_cm: { available: true } }, { ...valid, max_width_cm: { available: 'true' } }, { ...valid, max_depth_cm: { available: true, unit: 'cm' } }, { ...valid, furniture_dimensions: {} }];
        for (const measurementCapabilities of malformed) await assert.rejects(render(route, selected, [], true, true, { measurementCapabilities }), /unavailable/i);
        await assert.rejects(render(route, selected, [], true, true, { measurementCapabilities: valid, total: 0 }), /unavailable/i);
    });
}
