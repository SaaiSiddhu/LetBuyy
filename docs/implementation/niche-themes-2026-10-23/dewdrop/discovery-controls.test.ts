/** Actual response projection -> Liquid -> FormData -> canonical parser; no browser, SQL or network. */
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createRequire } from 'node:module';
import { StorefrontDiscoveryQuerySchema, storefrontDiscoveryQueryFromEntries, storefrontDiscoveryUrl, type StorefrontDiscoveryQuery, type StorefrontDiscoveryFacet, type ProductModel } from '../../../../packages/commerce-core/src/index';
import { readStorefrontDiscoveryPayload } from '../../../../services/api-gateway/src/lib/storefront-discovery';
import { projectDiscoveryPage, validateDiscoveryProductPage } from '../../../../apps/commerce/web/src/lib/theme-engine/storefront-discovery';
import { createDewdropTheme } from '../../../../packages/theme-engine/src/dewdrop-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../packages/theme-engine/src/theme-bundle-core';
import { LiquidRenderer, DEFAULT_THEME_SETTINGS } from '../../../../packages/theme-engine/src/index';
const { JSDOM } = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url))('jsdom') as { JSDOM: new (html?: string, options?: { url: string }) => { window: Window & typeof globalThis & { close(): void } } };
const originalFetch = globalThis.fetch;
let networkCalls = 0;
before(() => { globalThis.fetch = async () => { networkCalls++; throw new Error('Discovery rendering must not make network calls.'); }; });
after(() => { globalThis.fetch = originalFetch; assert.equal(networkCalls, 0); });
const storeId = '11111111-1111-4111-8111-111111111111', productId = '22222222-2222-4222-8222-222222222222';
const product: ProductModel = { id: productId, name: 'Synthetic care product', description: '', price: 520, currency: 'INR', stock: 4, images: [] };
const facets: StorefrontDiscoveryFacet[] = [
    { key: 'routine_stage', value: 'colour', label: 'Colour', count: 4 }, { key: 'routine_stage', value: 'care', label: 'Care', count: 2 },
    { key: 'format', value: 'tint', label: 'Tint', count: 4 }, { key: 'format', value: 'cream', label: 'Cream', count: 2 },
    { key: 'shade', value: 'pink clay', label: 'Pink Clay', count: 4 }, { key: 'shade', value: 'rosewater', label: 'Rosewater', count: 2 },
];
const selected = () => StorefrontDiscoveryQuerySchema.parse({ page: 2, limit: 1, search: 'soft & care', category: 'Care', country_of_origin: 'India', sort: 'price-desc', connector: ['usb-c', 'hdmi'], routine_stage: 'colour', format: 'tint', shade: 'pink clay', min_price: 100, max_price: 999, material: 'Wood', length_value: 67.5, length_unit: 'cm', collection_id: '33333333-3333-4333-8333-333333333333' });
const parse = (entries: Iterable<readonly [string, string]>) => StorefrontDiscoveryQuerySchema.parse(storefrontDiscoveryQueryFromEntries(entries));
const canonical = (query: StorefrontDiscoveryQuery) => storefrontDiscoveryUrl('/products', query);
function submitted(dom: InstanceType<typeof JSDOM>, form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new dom.window.FormData(form)) { assert.equal(typeof value, 'string'); params.append(key, String(value)); }
    return { params, query: parse(params) };
}
async function render(route: 'collection' | 'search', query: StorefrontDiscoveryQuery, options: { metadata?: boolean; facets?: StorefrontDiscoveryFacet[]; empty?: boolean } = {}) {
    const path = route === 'search' ? '/search' : '/products', total = options.empty ? 0 : 6, products = options.empty ? [] : [product];
    const payload = readStorefrontDiscoveryPayload({ data: products.map(row => ({ id: row.id, price: row.price })), count: total, facets: options.facets ?? facets, matches: products.map(row => ({ product_id: row.id, price: row.price, variant_ids: [] })) }, query);
    const page = validateDiscoveryProductPage({ data: products, total, page: query.page, limit: query.limit, has_more: query.page * query.limit < total, ...(options.metadata === false ? {} : { discovery: payload.discovery }) }, query);
    const projection = projectDiscoveryPage(page, path, query), bundle = createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture());
    const drops = products.map(row => ({ id: row.id, title: row.name, price: row.price, currency: row.currency, url: '/product/synthetic', images: [], beauty: { routineStage: 'cleanse', format: 'Wrong inferred format', shades: [{ value: 'Wrong inferred shade', color: '#a36a65' }] } }));
    const result = await new LiquidRenderer().render({ context: { storeId, subdomain: 'dewdrop-query', path, previewMode: false, locale: 'en-IN', searchParams: query as unknown as Record<string, string> }, storeTemplate: { themeId: 'letbuyy-aura', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: route, type: route, layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: route, liquidContext: { request: { path, query: projection.query }, collection: { title: 'Care shelf', products: drops, ...projection.collection }, search: { terms: query.search, results: drops, results_count: total }, section_products: Object.fromEntries(Object.keys(bundle.templates[route].sections).map(id => [id, drops])) } });
    assert.equal(result.status, 'rendered'); assert.deepEqual(result.warnings, []);
    const dom = new JSDOM(result.liquid!.contentForLayout, { url: `https://shop.example.invalid${path}` });
    return { dom, projection, form: dom.window.document.querySelector<HTMLFormElement>('form.dd-filters')! };
}

for (const route of ['collection', 'search'] as const) {
    test(`${route}: missing metadata keeps browse/search/sort but advertises no care chooser`, async () => {
        const query = StorefrontDiscoveryQuerySchema.parse({ page: 2, limit: 1, search: 'care', category: 'Care', country_of_origin: 'India', sort: 'newest' });
        const h = await render(route, query, { metadata: false });
        try {
            assert.ok(h.form); assert.ok(h.form.querySelector('input[type="search"]')); assert.ok(h.form.querySelector('select[name="sort"]'));
            for (const key of ['routine_stage', 'format', 'shade']) assert.equal(h.form.querySelector(`select[name="${key}"],input:not([type="hidden"])[name="${key}"]`), null);
            assert.equal(canonical(submitted(h.dom, h.form).query), canonical({ ...query, page: 1 }), h.form.outerHTML);
            assert.match(h.dom.window.document.body.textContent!, /Synthetic care product/);
        } finally { h.dom.window.close(); }
    });
    test(`${route}: supplied exact named choices and sort preserve every unedited query and repeated connector`, async () => {
        const query = selected(), h = await render(route, query);
        try {
            const initial = submitted(h.dom, h.form);
            assert.equal(canonical(initial.query), canonical({ ...query, page: 1 }));
            assert.deepEqual(initial.params.getAll('connector'), ['usb-c', 'hdmi']);
            const pageLinks = [...h.dom.window.document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Product pages"] a')];
            for (const page of [1, 3]) assert.ok(pageLinks.some(link => canonical(parse(new URL(link.href).searchParams)) === canonical({ ...query, page })), `page ${page} preserves the full query`);
            for (const key of ['routine_stage', 'format', 'shade'] as const) {
                const chooser = h.form.querySelector<HTMLSelectElement>(`select[name="${key}"]`)!; assert.ok(chooser);
                assert.deepEqual([...chooser.options].filter(option => option.value).map(option => [option.value, option.textContent]), facets.filter(facet => facet.key === key).map(facet => [facet.value, facet.label]));
                for (const option of facets.filter(facet => facet.key === key)) {
                    chooser.value = option.value;
                    assert.equal(canonical(submitted(h.dom, h.form).query), canonical({ ...query, page: 1, [key]: option.value }));
                }
                chooser.value = query[key]!;
            }
            const sort = h.form.querySelector<HTMLSelectElement>('select[name="sort"]')!;
            for (const value of ['display_order', 'price-asc', 'price-desc', 'newest', 'name'] as const) {
                sort.value = value; assert.equal(canonical(submitted(h.dom, h.form).query), canonical({ ...query, page: 1, sort: value }));
            }
            sort.value = query.sort;
            for (const key of ['routine_stage', 'format', 'shade'] as const) h.form.querySelector<HTMLSelectElement>(`select[name="${key}"]`)!.value = '';
            const blank = submitted(h.dom, h.form).query;
            assert.equal(canonical(blank), canonical({ ...query, page: 1, routine_stage: undefined, format: undefined, shade: undefined }));
            assert.doesNotMatch(h.form.textContent!, /Wrong inferred|#a36a65/);
        } finally { h.dom.window.close(); }
    });
    test(`${route}: each chooser needs its own supplied options; selected-only rows stay hidden and removable`, async () => {
        const query = selected();
        for (const key of ['routine_stage', 'format', 'shade']) {
            const h = await render(route, query, { facets: facets.filter(facet => facet.key === key) });
            try {
                assert.deepEqual([...h.form.querySelectorAll('select[name]:not([name="sort"])')].map(field => field.getAttribute('name')), [key]);
                assert.equal(canonical(submitted(h.dom, h.form).query), canonical({ ...query, page: 1 }));
                assert.equal(h.dom.window.document.querySelectorAll('nav[aria-label="Applied filters"] a').length, h.projection.collection.active_filters.length);
            } finally { h.dom.window.close(); }
        }
    });
    test(`${route}: stale zero matches retain every query, independent clear and page-one recovery`, async () => {
        const query = StorefrontDiscoveryQuerySchema.parse({ ...selected(), shade: 'Retired named shade', format: 'Retired format' });
        const h = await render(route, query, { empty: true, facets: [] });
        try {
            assert.match(h.dom.window.document.body.textContent!, /No products found/);
            assert.equal(h.form.querySelectorAll('select:not([name="sort"])').length, 0);
            assert.equal(canonical(submitted(h.dom, h.form).query), canonical({ ...query, page: 1 }));
            const links = [...h.dom.window.document.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Applied filters"] a')];
            assert.equal(links.length, h.projection.collection.active_filters.length);
            for (const filter of h.projection.collection.active_filters) {
                const link = links.find(link => new URL(link.href).pathname + new URL(link.href).search === filter.clear_url); assert.ok(link, filter.label);
                const cleared = parse(new URL(link.href).searchParams); assert.equal(cleared.page, 1);
                assert.equal(canonical(cleared), canonical(parse(new URL(filter.clear_url, 'https://shop.example.invalid').searchParams)));
                if (filter.key === 'connector') assert.deepEqual([cleared.connector].flat(), ['usb-c', 'hdmi'].filter(value => value !== filter.value));
            }
            const clearAll = [...h.dom.window.document.querySelectorAll<HTMLAnchorElement>('a')].find(link => link.textContent === 'Clear filters')!;
            const cleared = parse(new URL(clearAll.href).searchParams);
            assert.equal(cleared.page, 1); assert.equal(cleared.search, query.search); assert.equal(cleared.sort, query.sort); assert.equal(cleared.limit, query.limit);
        } finally { h.dom.window.close(); }
    });
    test(`${route}: stale case-sensitive names are retained without selecting a different supplied value`, async () => {
        const query = StorefrontDiscoveryQuerySchema.parse({ ...selected(), shade: 'Pink Clay', format: 'Tint' });
        const h = await render(route, query);
        try {
            for (const key of ['format', 'shade'] as const) {
                const chooser = h.form.querySelector<HTMLSelectElement>(`select[name="${key}"]`)!;
                assert.equal(chooser.value, query[key]); assert.match(chooser.selectedOptions[0].textContent!, /Current filter:/);
            }
            assert.equal(canonical(submitted(h.dom, h.form).query), canonical({ ...query, page: 1 }));
        } finally { h.dom.window.close(); }
    });
    test(`${route}: hostile supplied labels and quoted query text retain ordinary escaping`, async () => {
        const attack = '<img src=x onerror="attack()"><script>attack()</script>';
        const query = StorefrontDiscoveryQuerySchema.parse({ ...selected(), search: 'care & "daily"', shade: 'pink clay' });
        const h = await render(route, query, { facets: [...facets.filter(facet => facet.key !== 'shade'), { key: 'shade', value: 'pink clay', label: attack, count: 1 }] });
        try {
            assert.equal(h.dom.window.document.querySelector('script,[onerror],img[src="x"]'), null);
            const chooser = h.form.querySelector<HTMLSelectElement>('select[name="shade"]')!;
            assert.equal(chooser.value, 'pink clay'); assert.equal(chooser.selectedOptions[0].textContent, attack);
            assert.equal(canonical(submitted(h.dom, h.form).query), canonical({ ...query, page: 1 }), h.form.outerHTML);
        } finally { h.dom.window.close(); }
    });
}
