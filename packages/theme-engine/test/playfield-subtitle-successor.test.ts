import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { createPlayfieldTheme } from '../src/playfield-theme';
import { createPlayfieldThemeV201 } from '../src/playfield-theme-v201';
import { createPlayfieldThemeV202 } from '../src/playfield-theme-v202';
import { LiquidThemePackageBundleSchema, buildLiquidThemePackagePersistencePayload, type LiquidThemePackageBundle } from '../src/theme-bundle';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';
import { CONFIGURED_ORDER_HEADING_SOURCE, withNicheOrderPresentation } from '../src/niche-order-presentation';
import { fromThemeDocumentV2, toThemeDocumentV2 } from '../src/theme-document';
import { LiquidRenderer } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { loadThemeServerDom } from '../src/server-dom-runtime';

const core = createLetbuyyCoreLiquidThemeBundleFixture;
const old201 = () => withNicheOrderPresentation(createPlayfieldThemeV201(core()));
const successor = () => createPlayfieldThemeV202(core());
const recipe = JSON.parse(readFileSync(new URL('../../../docs/implementation/niche-themes-2026-10-23/playfield/installed-fixture-preparation/toys-fixture-proposal.json', import.meta.url), 'utf8')).entry.createFields;
// Source-only render context; these are neither durable UUIDs nor real cart/order readbacks.
const product = {
    id: 'source-only-toy', title: recipe.name, description: recipe.description, price: recipe.price,
    currency: 'INR', url: '/product/source-only-toy', images: [], available: true,
    options: [], variants: [], toys: recipe.metadata.toys, toys_resolved_json: JSON.stringify(recipe.metadata.toys),
    toys_card: { ageLabel: '6–8', contentsLabel: '15 supplied items', contentsComplete: true, hasOptions: false },
};
const order = {
    number: 'SOURCE-1042', status: 'pending', currency: 'INR', total: 48000,
    line_items: [{ title: 'Source-only accepted item', quantity: 1, line_price: 48000, niche_facts_text: 'Saved blue finish. Materials: Wood.' }],
};

async function inspect<T>(html: string, run: (document: Document) => T): Promise<T> {
    const { JSDOM } = await loadThemeServerDom();
    const dom = new JSDOM(html);
    try { return run(dom.window.document); } finally {
        const window = dom.window;
        if (!('close' in window) || typeof window.close !== 'function') throw new Error('Expected the canonical Node DOM cleanup API.');
        window.close();
    }
}

async function render(bundle: LiquidThemePackageBundle, key = 'product', context: Record<string, unknown> = {}) {
    const before = JSON.stringify(context);
    const sectionProducts = Object.fromEntries(Object.keys(bundle.templates[key].sections).map(id => [id, [product]]));
    const result = await new LiquidRenderer().render({
        context: { storeId: 'source-only-store', subdomain: 'source-only-playfield', path: '/', previewMode: false, locale: 'en-IN' },
        storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: key, type: key === 'customers/order' ? 'customer_order' : key === 'index' ? 'index' : 'product', layoutKey: 'theme', sections: [] },
        liquidBundle: bundle, liquidTemplateKey: key,
        liquidContext: { product, section_products: sectionProducts, shop: { name: 'Source-only merchant' }, buyer: { id: 'source-only-buyer' }, order, ...context },
    });
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
    assert.deepEqual(result.warnings, []);
    assert.equal(JSON.stringify(context), before);
    return result.liquid!;
}

function onlyRelated(bundle: LiquidThemePackageBundle, subtitle?: string) {
    const b = structuredClone(bundle);
    b.templates.product = { layout: 'theme', sections: {
        related: { type: 'featured-products', settings: { title: 'Related activities', columns: 3, productLimit: 6, collectionId: 'source-only-collection', ...(subtitle === undefined ? {} : { subtitle }) }, blocks: {}, block_order: [], disabled: false },
    }, order: ['related'] };
    return b;
}

function merchant(version: '2.0.0' | '2.0.1') {
    const b = withNicheOrderPresentation(version === '2.0.0' ? createPlayfieldTheme(core()) : createPlayfieldThemeV201(core()));
    b.package.checksum = 'old-package-checksum';
    b.config.settings_data.current.futureData = { keep: [false, 0, '', null, { message: 'Merchant future value' }] };
    b.templates.product.sections['product-related'].settings.subtitle = '  Exact saved merchant description  ';
    b.templates.product.sections['product-related'].settings.futureData = { zero: 0, enabled: false };
    b.templates['customers/order'].sections['customer-order-detail-default'].settings.heading = '  Your saved purchase  ';
    const header = b.templates.header.sections['header-default'];
    header.settings.storeName = 'Merchant தமிழ் गतिविधि';
    header.blocks['merchant-link'] = { type: 'link', settings: { label: 'Saved link', href: '/page/saved', future: { active: false } }, disabled: true,
        blocks: { child: { type: 'badge', settings: { label: 'Keep child', unknown: 0 }, disabled: false, blocks: {}, block_order: [] } }, block_order: ['child'] };
    header.block_order = ['merchant-link'];
    b.templates.page.sections['page-content-default'].settings.futureUnknown = ['keep', 0, false];
    b.layout.theme.source += '\n<!-- merchant-layout-tail -->';
    b.locales['en-IN'] = { futureCopy: { value: 'Keep merchant locale' } };
    return LiquidThemePackageBundleSchema.parse(b);
}

test('fresh 2.0.2 identity, manifest and canonical document roundtrip are consistent and immutable', () => {
    const seed = core(), before = structuredClone(seed), b = createPlayfieldThemeV202(seed);
    assert.deepEqual(seed, before);
    assert.equal(b.package.slug, 'letbuyy-bloom'); assert.equal(b.package.name, 'Playfield');
    assert.equal(b.package.version, '2.0.2'); assert.equal(b.package.version_number, 4);
    assert.equal(b.package.checksum, undefined);
    assert.deepEqual(LiquidThemePackageBundleSchema.parse(b), b);
    assert.deepEqual(fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(b)))), b);
    const persistence = buildLiquidThemePackagePersistencePayload(b);
    assert.equal(persistence.themePackageVersion.version, '2.0.2');
    assert.equal(persistence.themePackageVersion.version_number, 4);
});

test('default body, header, footer and styles remain exact to the accepted 2.0.1 rendering', async () => {
    for (const route of ['index', 'product', 'customers/order']) {
        const before = await render(old201(), route), after = await render(successor(), route);
        for (const key of ['contentForLayout', 'header', 'footer', 'headStyleText'] as const) assert.equal(after[key], before[key], route + ':' + key);
    }
});

test('fresh Core inert copy does not become newly visible through activated fields', async () => {
    const seed = core();
    seed.templates.product.sections['product-related'].settings.subtitle = 'INERT_STARTER_DESCRIPTION';
    seed.templates['customers/order'].sections['customer-order-detail-default'].settings.heading = 'INERT_STARTER_ORDER_HEADING';
    const before = structuredClone(seed), next = createPlayfieldThemeV202(seed);
    assert.deepEqual(seed, before);
    assert.equal(next.templates.product.sections['product-related'].settings.subtitle, undefined);
    assert.equal(next.templates['customers/order'].sections['customer-order-detail-default'].settings.heading, undefined);
    assert.doesNotMatch((await render(next)).contentForLayout, /INERT_STARTER_DESCRIPTION/);
    assert.doesNotMatch((await render(next, 'customers/order')).contentForLayout, /INERT_STARTER_ORDER_HEADING/);
});

test('the configured Bloom Core distribution seed is supported without changing its input', () => {
    const seed = core(); seed.package.slug = 'letbuyy-bloom'; seed.package.name = 'Playfield';
    const before = structuredClone(seed), next = createPlayfieldThemeV202(seed);
    assert.deepEqual(seed, before); assert.deepEqual(next, successor());
});

test('nonblank subtitle renders exactly once after the existing heading', async () => {
    const b = onlyRelated(successor(), 'A different curiosity.');
    await inspect((await render(b)).contentForLayout, doc => {
        const heading = doc.querySelector('[data-section-id="related"] h2')!;
        assert.equal(heading.nextElementSibling?.tagName, 'P');
        assert.equal(heading.nextElementSibling?.textContent, 'A different curiosity.');
        assert.equal([...doc.querySelectorAll('p')].filter(p => p.textContent === 'A different curiosity.').length, 1);
    });
});

test('omitted, empty and whitespace subtitles keep the empty-default output', async () => {
    for (const value of [undefined, '', '  \t\n  ']) await inspect((await render(onlyRelated(successor(), value))).contentForLayout, doc => {
        assert.equal(doc.querySelector('[data-section-id="related"] h2')!.nextElementSibling?.className, 'pf-grid');
    });
});

test('hostile subtitle text remains inert and Tamil/Hindi values survive the canonical sanitizer', async () => {
    const value = '<script>unsafe()</script><img src=x onerror="unsafe()"> {{ 7 | plus: 1 }} தமிழ் गतिविधि & choosing';
    await inspect((await render(onlyRelated(successor(), value))).contentForLayout, doc => {
        const p = doc.querySelector('[data-section-id="related"] h2')!.nextElementSibling!;
        assert.equal(p.textContent, value); assert.equal(p.querySelector('script,img,[onerror]'), null);
    });
});

test('empty related data creates neither a phantom heading nor a subtitle', async () => {
    const b = onlyRelated(successor(), 'NO_PHANTOM_PRODUCT');
    await inspect((await render(b, 'product', { section_products: { related: [] } })).contentForLayout, doc => {
        const section = doc.querySelector('[data-section-id="related"]')!;
        assert.equal(section.querySelector('h2'), null); assert.doesNotMatch(section.textContent!, /NO_PHANTOM_PRODUCT/);
    });
});

test('prebound resource order, product limit, links and collection binding remain authoritative', async () => {
    const b = onlyRelated(successor(), 'Related note'); b.templates.product.sections.related.settings.productLimit = 1;
    const bound = [{ ...product, id: 'source-second', title: 'Bound first', url: '/product/bound-first' }, product];
    await inspect((await render(b, 'product', { section_products: { related: bound } })).contentForLayout, doc => {
        assert.equal(doc.querySelectorAll('[data-section-id="related"] article').length, 1);
        assert.equal(doc.querySelector('[data-section-id="related"] article a')?.getAttribute('href'), '/product/bound-first');
    });
    assert.equal(b.templates.product.sections.related.settings.collectionId, 'source-only-collection');
});

for (const version of ['2.0.0', '2.0.1'] as const) {
    test(`${version} merchant settings, exact strings, layout, nested blocks, order and unknown JSON values survive`, async () => {
        const saved = merchant(version), before = structuredClone(saved), next = createPlayfieldThemeV202(saved);
        assert.deepEqual(saved, before);
        for (const key of ['templates', 'config', 'layout', 'blocks', 'locales', 'renderer'] as const) assert.deepEqual(next[key], saved[key], key);
        assert.equal(next.package.checksum, undefined);
        assert.equal(next.templates.product.sections['product-related'].settings.subtitle, '  Exact saved merchant description  ');
        assert.equal(next.templates['customers/order'].sections['customer-order-detail-default'].settings.heading, '  Your saved purchase  ');
        assert.match((await render(next)).contentForLayout, /Exact saved merchant description/);
        const html = (await render(next, 'customers/order')).contentForLayout;
        assert.match(html, /Your saved purchase #SOURCE-1042/); assert.match(html, /Saved blue finish/);
    });
}

test('existing 2.0.1 PDP facts, variants and purchase markup remain byte-identical', async () => {
    const before = old201(), next = successor();
    assert.deepEqual(next.sections['product-detail'], before.sections['product-detail']);
    for (const b of [before, next]) {
        const id = 'product-detail-default'; b.templates.product = { ...b.templates.product, sections: { [id]: b.templates.product.sections[id] }, order: [id] };
    }
    const selected = { ...product, options: [{ name: 'Edition', values: ['Inherited', 'Unknown facts', 'Paper'] }], variants: [
        { id: 'source-only-inherited', options: { Edition: 'Inherited' }, stock: 4, price: 480 },
        { id: 'source-only-unknown', options: { Edition: 'Unknown facts' }, stock: 2, price: 480 },
        { id: 'source-only-paper', options: { Edition: 'Paper' }, stock: 3, price: 480 },
    ] };
    assert.equal((await render(next, 'product', { product: selected })).contentForLayout, (await render(before, 'product', { product: selected })).contentForLayout);
});

test('saved 2.0.0 gains the exact 2.0.1 fact body without resetting its product instance data', () => {
    const saved = merchant('2.0.0'); saved.templates.product.sections['product-detail-default'].settings.showToyFacts = false;
    const next = createPlayfieldThemeV202(saved), expected = createPlayfieldThemeV201(core());
    assert.equal(next.sections['product-detail'].source, expected.sections['product-detail'].source);
    assert.deepEqual(next.sections['product-detail'].schema, saved.sections['product-detail'].schema);
    assert.equal(next.templates.product.sections['product-detail-default'].settings.showToyFacts, false);
});

test('saved 2.0.0 future descriptor data survives the facts-body upgrade and embedded schema', () => {
    const saved = merchant('2.0.0');
    saved.sections['product-detail'].schema.settings.push({ id: 'futureText', type: 'text', label: 'Preserved future field', default: 'Keep future default' });
    const before = structuredClone(saved), next = createPlayfieldThemeV202(saved);
    assert.deepEqual(saved, before); assert.deepEqual(next.sections['product-detail'].schema, saved.sections['product-detail'].schema);
    assert.match(next.sections['product-detail'].source, /Preserved future field/);
    assert.deepEqual(createPlayfieldThemeV202(next), next);
});

test('order heading clear/custom/hostile values retain the authoritative number and immutable saved facts', async () => {
    const b = successor(), section = b.templates['customers/order'].sections['customer-order-detail-default'];
    const baseline = (await render(b, 'customers/order')).contentForLayout;
    for (const value of ['', ' \n\t ']) { section.settings.heading = value; assert.equal((await render(b, 'customers/order')).contentForLayout, baseline); }
    section.settings.heading = '<script>unsafe()</script>';
    const before = JSON.stringify(order);
    const html = (await render(b, 'customers/order', { product: { ...product, toys: { finish: 'LIVE_GREEN_MUST_NOT_REPLACE_HISTORY' } } })).contentForLayout;
    assert.match(html, /&lt;script&gt;unsafe\(\)&lt;\/script&gt; #SOURCE-1042/);
    assert.match(html, /Saved blue finish/); assert.doesNotMatch(html, /LIVE_GREEN_MUST_NOT_REPLACE_HISTORY|<script>unsafe/);
    assert.equal(JSON.stringify(order), before);
});

test('valid 2.0.2 input is idempotent, cloned and retains later merchant edits/checksum', () => {
    const saved = createPlayfieldThemeV202(merchant('2.0.1'));
    saved.package.checksum = 'new-202-checksum'; saved.templates.product.sections['product-related'].settings.subtitle = 'Later edit';
    const before = structuredClone(saved), again = createPlayfieldThemeV202(saved);
    assert.deepEqual(again, before); assert.deepEqual(saved, before); assert.notEqual(again, saved);
});

test('inconsistent or forged 2.0.2 version, facts, subtitle and order contracts fail closed', () => {
    const corruptions: Array<(b: LiquidThemePackageBundle) => void> = [
        b => { b.package.version_number = 3; },
        b => { b.sections['product-detail'].source = b.sections['product-detail'].source.replace('data-lb-toy-presentation', 'missing-toy-presentation'); },
        b => { b.sections['featured-products'].source = b.sections['featured-products'].source.replace('<p>{{ section.settings.subtitle }}</p>', ''); },
        b => { b.sections['featured-products'].schema.settings.push({ id: 'subtitle', type: 'text', label: 'Duplicate description', default: '' }); },
        b => { b.sections['customer-order-detail'].source += '<h1>Order #{{ order.number }}</h1>'; },
        b => { b.layout.theme.source = b.layout.theme.source.replace('data-niche-order-presentation="1"', 'missing-saved-facts-style'); },
    ];
    for (const change of corruptions) { const b = successor(); change(b); const before = structuredClone(b); assert.throws(() => createPlayfieldThemeV202(b), /Playfield 2.0.2/); assert.deepEqual(b, before); }
});

test('unsupported package/version and unknown old product source are rejected without reset or mutation', () => {
    for (const version of ['2.0.3', '3.0.0']) { const b = old201(); b.package.version = version; const before = structuredClone(b); assert.throws(() => createPlayfieldThemeV202(b), /canonical Core seed/); assert.deepEqual(b, before); }
    const foreign = successor(); foreign.package.slug = 'third-party'; assert.throws(() => createPlayfieldThemeV202(foreign), /canonical Core seed/);
    const changed = merchant('2.0.0'); changed.sections['product-detail'].source += '<p>Unknown executable source</p>';
    const before = structuredClone(changed); assert.throws(() => createPlayfieldThemeV202(changed), /unknown 2.0.0 product source/); assert.deepEqual(changed, before);
});

test('2.0.2 composes existing order helpers before version advance and has one facts/style/heading outlet', () => {
    const b = successor();
    assert.equal(b.sections['customer-order-detail'].source.split(CONFIGURED_ORDER_HEADING_SOURCE).length - 1, 1);
    assert.equal(b.sections['customer-order-detail'].source.split('<!-- lb:niche-order-presentation:v1 -->').length - 1, 1);
    assert.equal(b.layout.theme.source.split('data-niche-order-presentation="1"').length - 1, 1);
});

test('all twenty frozen default/2.0.0 catalogue outputs remain byte-identical; dispatch is not changed', () => {
    // Retained frozen fingerprints from playfield-v201.test.ts; one cohort, twenty assertions.
    const source = readFileSync(new URL('./playfield-v201.test.ts', import.meta.url), 'utf8');
    const match = /const baseline = (\[[\s\S]*?\]);/.exec(source); assert.ok(match);
    const baseline: Array<{ slug: string; designVersion: string; sha256: string }> = JSON.parse(match[1]);
    assert.equal(baseline.length, 20);
    for (const row of baseline) assert.equal(createHash('sha256').update(JSON.stringify(createFirstPartyCatalogBundle(row.slug, row.designVersion === 'default' ? {} : { designVersion: '2.0.0' }))).digest('hex'), row.sha256, row.slug + ':' + row.designVersion);
});
