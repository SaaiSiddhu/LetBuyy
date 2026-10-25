import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createDewdropTheme } from '../src/dewdrop-theme';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';
import { buildLiquidThemePackagePersistencePayload } from '../src/theme-bundle';
import { collectThemeTemplateValidationIssues, type ThemeTemplateValidationRuntime } from '../src/index';
import { DEWDROP_CSS } from '../src/dewdrop-styles';
const beauty = { schemaVersion: 1, routineStage: 'colour', format: 'Lip tint', netQuantity: { value: 6, unit: 'ml' }, ingredients: 'Synthetic sample ingredients.', directions: 'Sample directions supplied by the merchant.', warnings: null, shadeOptionName: 'Shade', shades: [{ value: 'Rosewater', code: 'RW01', color: '#a36a65' }, { value: 'Pink Clay', code: 'PC02', color: '#a36a65', ingredients: 'Shade-specific synthetic sample ingredients.' }, { value: 'Terracotta', code: 'TC03', color: '#89534a', ingredients: '' }] };
const product = { id: '7b669c70-8100-4000-8000-000000000003', title: 'Soft Colour', price: 520, currency: 'INR', url: '/product/soft-colour', images: ['/theme-assets/dewdrop/v2/lip-tint.webp'], featured_image: '/theme-assets/dewdrop/v2/lip-tint.webp', available: true, options: [{ name: 'Shade', values: ['Rosewater', 'Pink Clay', 'Terracotta'] }], variants: beauty.shades.map((shade, i) => ({ id: `7b669c70-8200-4000-8000-${String(i + 1).padStart(12, '0')}`, name: shade.value, price: 520, stock: i === 2 ? 0 : 4, options: { Shade: shade.value } })), beauty: { ...beauty, shadeCount: beauty.shades.length, netQuantityLabel: '6 ml' } };
type Bundle = ReturnType<typeof createDewdropTheme>;
async function render(key: string, options: {
    bundle?: Bundle;
    item?: Record<string, unknown>;
    products?: Record<string, unknown>[];
    extra?: Record<string, unknown>;
    collection?: Record<string, unknown>;
    query?: Record<string, string>; previewMode?: boolean;
} = {}) {
    const item = options.item ?? product;
    const products = options.products ?? [item];
    return new LiquidRenderer().render({
        context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'dewdrop-test', path: key === 'collection' ? '/products' : '/', previewMode: options.previewMode ?? true, locale: 'en-IN', searchParams: options.query },
        storeTemplate: { themeId: 'letbuyy-aura', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: key, type: key === 'index' ? 'index' : key === 'product' ? 'product' : 'collection', layoutKey: 'theme', sections: [] },
        liquidBundle: options.bundle ?? createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture()), liquidTemplateKey: key,
        liquidContext: { shop: { name: 'Synthetic Dewdrop' }, product: item, collection: { title: 'Your care shelf', products, ...options.collection }, section_products: { 'aura-routine-shelves-index': products, 'aura-routine-shelves-collection': products, 'aura-independent-products': [] }, ...options.extra },
    });
}
function html(result: Awaited<ReturnType<typeof render>>) { assert.equal(result.status, 'rendered', JSON.stringify(result.warnings)); assert.deepEqual(result.warnings, []); return result.liquid!.contentForLayout; }
test('pure versioned factory preserves its v1 input and canonical non-commerce journeys', () => {
    const base = createLetbuyyCoreLiquidThemeBundleFixture();
    const before = structuredClone(base);
    const b = createDewdropTheme(base);
    assert.deepEqual(base, before);
    assert.equal(b.package.slug, 'letbuyy-aura');
    assert.equal(b.package.name, 'Dewdrop');
    assert.equal(b.package.version, '2.0.0');
    assert.deepEqual(b.templates.index.order.map(id => b.templates.index.sections[id].type), ['hero-banner', 'category-grid', 'product-grid', 'about-section', 'trust-badges']);
    assert.notDeepEqual(b.templates.index.order, base.templates.index.order);
    for (const key of Object.keys(base.templates).filter(k => !['header', 'index', 'product', 'collection', 'search', 'list-collections'].includes(k)))
        assert.deepEqual(b.templates[key], base.templates[key], key);
    assert.deepEqual(b.templates.search.order.map(id => b.templates.search.sections[id].type), ['collection-filter', 'collection-product-list']);
    const listing = structuredClone(base.templates['list-collections']);
    delete listing.sections['list-collections-grid'].settings.subtitle;
    assert.deepEqual(b.templates['list-collections'], listing);
    assert.deepEqual(b.templates.header.order, base.templates.header.order);
    assert.deepEqual(b.templates.header.sections['header-default'], base.templates.header.sections['header-default']);
    assert.deepEqual(fromThemeDocumentV2(toThemeDocumentV2(b)), b);
});

test('fresh factory defaults validate against their actual manifest before normalization and after document/JSON roundtrip', async () => {
    const base = createLetbuyyCoreLiquidThemeBundleFixture();
    assert.equal(base.templates['list-collections'].sections['list-collections-grid'].settings.subtitle, 'Browse every collection in the store.');
    const bundle = createDewdropTheme(base);
    assert.equal(Object.hasOwn(bundle.templates['list-collections'].sections['list-collections-grid'].settings, 'subtitle'), false);
    assert.doesNotMatch(bundle.sections['category-grid'].source, /section\.settings\.subtitle/);
    const document = toThemeDocumentV2(bundle);
    const restored = fromThemeDocumentV2(JSON.parse(JSON.stringify(document)));
    for (const candidate of [bundle, restored]) {
        const manifest = buildLiquidThemePackagePersistencePayload(candidate).schemaManifest;
        const runtime = { sectionSchemas: manifest.section_schemas, settingsSchema: manifest.settings_schema } as unknown as ThemeTemplateValidationRuntime;
        // The canonical Liquid registry envelope, using only engine public contracts.
        const config = { themeId: candidate.package.slug, schema_version: candidate.schema_version, engineVersion: candidate.renderer.renderer_version, rendererEngine: 'liquid', liquidBundle: candidate, sections: {}, templates: candidate.templates, themeSettings: candidate.config.settings_data.current };
        for (const templateConfig of [config, JSON.parse(JSON.stringify(config))]) {
            assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig, runtime, themeSlug: candidate.package.slug }), []);
        }
        const invalid = structuredClone(config);
        invalid.templates['list-collections'].sections['list-collections-grid'].settings.subtitle = 'Unsupported inherited copy';
        assert.ok(collectThemeTemplateValidationIssues({ templateConfig: invalid, runtime, themeSlug: candidate.package.slug }).includes('templates.list-collections.sections.list-collections-grid.settings.subtitle is not defined by the category-grid schema'), 'the real validator still rejects undeclared settings');
    }
    const output = html(await render('list-collections', { bundle: restored }));
    assert.match(output, /All collections/); assert.match(output, /Each product is yours to choose/); assert.match(output, /dd-routine/);
    assert.doesNotMatch(output, /Browse every collection in the store/);
});
test('real Liquid home and collection render routine rows with actual product URL, price and quantity', async () => {
    for (const key of ['index', 'collection']) {
        const r = await render(key);
        const h = html(r);
        assert.match(h, /dd-shelf-products/);
        assert.match(h, /Soft Colour/);
        assert.match(h, /href="\/product\/soft-colour"/);
        assert.match(h, /520\.00/);
        assert.match(h, /6 ml/);
        assert.match(h, /3 named shades/);
        assert.match(r.liquid!.headStyleText!, /\.dd-hero/);
        assert.doesNotMatch(h, /Dermatologist|Hypoallergenic|Clinically|Rated|★|Free shipping|Cruelty.free/i);
    }
});
test('same-colour shades retain two named buttons, codes and separate canonical variant identities', async () => {
    const h = html(await render('product'));
    const dom = new JSDOM(h);
    const doc = dom.window.document;
    const picker = doc.querySelector('lb-variant-picker')!;
    assert.ok(picker);
    assert.equal(picker.getAttribute('data-product-id'), product.id);
    const buttons = [...picker.querySelectorAll('button[data-lb-variant-option]')];
    assert.equal(buttons.length, 3);
    assert.deepEqual(buttons.map(b => b.getAttribute('data-variant-value')), ['Rosewater', 'Pink Clay', 'Terracotta']);
    assert.match(buttons[0].textContent!, /Rosewater.*RW01/);
    assert.match(buttons[1].textContent!, /Pink Clay.*PC02/);
    assert.equal(buttons[0].querySelector('circle')?.getAttribute('fill'), '#a36a65');
    assert.equal(buttons[1].querySelector('circle')?.getAttribute('fill'), '#a36a65');
    assert.deepEqual(JSON.parse(picker.getAttribute('data-variants')!).map((v: {
        id: string;
    }) => v.id), product.variants.map(v => v.id));
    assert.match(h, /<lb-add-to-cart/);
    assert.match(h, /data-lb-add-to-cart/);
    assert.match(h, /name="quantity"/);
    assert.doesNotMatch(h, /data-lb-buy-now/);
    assert.ok(h.indexOf('Synthetic sample ingredients.') < h.indexOf('data-lb-add-to-cart'));
    assert.match(h, /Ingredients for Pink Clay · PC02/);
    assert.match(h, /Ingredient list for this shade has not been supplied/);
});
test('missing facts, photograph and unknown routine stay explicit and no product disappears', async () => {
    const missing = { ...product, title: 'Palm Wash', images: [], featured_image: undefined, beauty: undefined };
    const p = html(await render('product', { item: missing }));
    assert.match(p, /Ingredient list not supplied by the merchant/);
    assert.match(p, /Directions not supplied by the merchant/);
    assert.match(p, /Warnings not supplied by the merchant/);
    assert.match(p, /Product image not supplied/);
    assert.doesNotMatch(p, /RW01|6 ml/);
    const c = html(await render('collection', { products: [product, missing] }));
    assert.match(c, /More products/);
    assert.match(c, /Palm Wash/);
    assert.match(c, /Ingredients not supplied/);
});
test('merchant facts, shade names and product titles remain escaped at the real render boundary', async () => {
    const attack = '<img src=x onerror="attack()"><script>attack()</script>';
    const h = html(await render('product', { item: { ...product, title: attack, beauty: { ...beauty, ingredients: attack, directions: attack, shades: [{ value: attack, code: attack, color: '#a36a65', ingredients: attack }] }, options: [{ name: 'Shade', values: [attack] }] } }));
    const doc = new JSDOM(h).window.document;
    assert.equal(doc.querySelector('script,[onerror],img[src="x"]'), null);
    assert.match(h, /&lt;img/);
});
test('discovery round-trips query selections and server pagination without invented totals', async () => {
    const query = { routine_stage: 'colour', format: 'Lip tint', shade: 'Pink Clay', search: 'soft', category: 'Care', sort: 'price-asc' };
    const h = html(await render('collection', { query, collection: { capabilities: { discovery: true }, beauty_filters_enabled: true, beauty_facets: ['routine_stage', 'format', 'shade'].map(key => ({ key, value: query[key as keyof typeof query], label: query[key as keyof typeof query], count: 1 })), discovery_query_fields: Object.entries(query).map(([key, value]) => ({ key, value })), pagination: { page: 2, previous_url: '/products?shade=Pink%20Clay&page=1', next_url: '/products?shade=Pink%20Clay&page=3' } } }));
    const doc = new JSDOM(h).window.document;
    assert.equal(doc.querySelector('select[name="routine_stage"]')?.querySelector('option[selected]')?.getAttribute('value'), 'colour');
    for (const [name, value] of Object.entries({ format: 'Lip tint', shade: 'Pink Clay' }))
        assert.equal(doc.querySelector(`select[name="${name}"] option[selected]`)?.getAttribute('value'), value);
    for (const [name, value] of Object.entries({ search: 'soft', category: 'Care' })) assert.equal(doc.querySelector(`input[name="${name}"]`)?.getAttribute('value'), value);
    assert.match(h, /Page 2/);
    assert.match(h, /shade=Pink%20Clay&amp;page=3/);
    assert.doesNotMatch(h, /1 products/);
});
test('empty catalogs and unconfigured merchant claims stay honest', async () => {
    const h = html(await render('index', { products: [] }));
    assert.match(h, /No products found/);
    assert.doesNotMatch(h, /Soft Colour|dd-services|dd-education-copy/);
    const p = html(await render('product'));
    assert.doesNotMatch(p, /dd-featured|dd-services|Frequently bought|Bundle|Save \d+%/);
});
test('merchant settings, blocks and selected collection survive document roundtrip and change output', async () => {
    const b = createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture());
    const doc = toThemeDocumentV2(b);
    doc.templates.find(t => t.key === 'index')!.sections.find(s => s.type === 'hero-banner')!.settings.heading = 'Merchant care introduction';
    const saved = fromThemeDocumentV2(doc);
    const services = saved.templates.index.sections['aura-service-information-index'];
    services.blocks = { 'merchant-service': { type: 'service', settings: { heading: 'Merchant pickup', body: 'Contact us for current hours.', linkLabel: 'Contact', linkUrl: '/contact' }, disabled: false, blocks: {}, block_order: [] } };
    services.block_order = ['merchant-service'];
    saved.templates.index.sections['aura-routine-pathways'].settings.collection2 = 'care-id';
    const roundtrip = fromThemeDocumentV2(toThemeDocumentV2(saved));
    assert.deepEqual(roundtrip, saved);
    const h = html(await render('index', { bundle: roundtrip, extra: { collections: [{ id: 'care-id', title: 'Care', handle: 'care' }] } }));
    assert.match(h, /Merchant care introduction/);
    assert.match(h, /Merchant pickup/);
    assert.match(h, /Contact us for current hours/);
    assert.match(h, /\/collections\/care/);
    assert.doesNotMatch(html(await render('index')), /Merchant care introduction|Merchant pickup/);
});
test('responsive style reflows routine rows and shades while retaining focus and reduced motion', () => {
    assert.match(DEWDROP_CSS, /max-width:1100px/);
    assert.match(DEWDROP_CSS, /max-width:900px/);
    assert.match(DEWDROP_CSS, /max-width:640px/);
    assert.match(DEWDROP_CSS, /prefers-reduced-motion:reduce/);
    assert.match(DEWDROP_CSS, /focus-visible/);
    assert.match(DEWDROP_CSS, /aria-pressed="true"/);
    assert.doesNotMatch(DEWDROP_CSS, /(?:^|\n)\s*(?:body|html|:root)\s*\{/);
    const b = createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture());
    const base = createLetbuyyCoreLiquidThemeBundleFixture();
    for (const key of ['cart', 'customer-account', 'customer-order', 'customer-addresses'])
        if (base.sections[key])
            assert.ok(b.sections[key].source.includes(base.sections[key].source.split('{% schema %}')[0].trim()), key);
});

test('editable inline service roots expose exact block IDs only in actual editor preview output', async () => {
    const bundle = createDewdropTheme(createLetbuyyCoreLiquidThemeBundleFixture());
    const service = bundle.templates.index.sections['aura-service-information-index'];
    service.blocks = Object.fromEntries(['pickup-one', 'pickup-two'].map(id => [id, { type: 'service', settings: { heading: 'Same heading', body: 'Merchant supplied hours' }, disabled: false, blocks: {}, block_order: [] }]));
    service.block_order = ['pickup-one', 'pickup-two'];
    const preview = new JSDOM(html(await render('index', { bundle, previewMode: true }))).window.document;
    assert.deepEqual([...preview.querySelectorAll('.dd-services>article')].map(e => e.getAttribute('data-block-id')), ['pickup-one', 'pickup-two']);
    const published = new JSDOM(html(await render('index', { bundle, previewMode: false }))).window.document;
    assert.equal(published.querySelectorAll('.dd-services>article').length, 2);
    assert.equal(published.querySelector('[data-block-id]'), null);
});
