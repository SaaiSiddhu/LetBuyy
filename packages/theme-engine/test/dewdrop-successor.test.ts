import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createDewdropThemeV201 } from '../src/dewdrop-theme-v201';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { LiquidRenderer, type LiquidCommerceDrops } from '../src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../src/theme-settings';
import { LiquidThemePackageBundleSchema, buildLiquidThemePackagePersistencePayload, type LiquidThemePackageBundle } from '../src/theme-bundle';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../src/theme-document';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const output = process.env.DD_RENDER_RUN_DIR ? resolve(process.env.DD_RENDER_RUN_DIR) : undefined;
if (output) assert.ok(output.startsWith(resolve('docs/implementation/niche-themes-2026-10-23/dewdrop/completion-2026-10-24/proposals/successor-v201/runs') + '/'));
let renderCount = 0;
const original = createFirstPartyCatalogBundle('letbuyy-aura', { designVersion: '2.0.0' });
const fresh = () => createDewdropThemeV201(createLetbuyyCoreLiquidThemeBundleFixture());
const roundtrip = (bundle: LiquidThemePackageBundle) => fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(bundle))));
const order = { id: '22222222-2222-4222-8222-222222222222', number: '1042', status: 'pending_cod', currency: 'INR', total: 114000, tax_total: 0, line_items: [{ title: 'Synthetic Tint', quantity: 2, line_price: 112000, niche_facts_text: 'Ingredients: saved synthetic formula' }], timeline: [{ label: 'Pending', reached: true }] };
const buyer = { id: '33333333-3333-4333-8333-333333333333', email: 'synthetic-render@example.invalid', orders: [order] };
async function render(key: string, bundle: LiquidThemePackageBundle, extra: LiquidCommerceDrops = {}) {
    const result = await new LiquidRenderer().render({
        context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'dewdrop-successor-source-only', path: key === 'search' ? '/search' : '/', previewMode: false, locale: 'en-IN' },
        storeTemplate: { themeId: 'letbuyy-aura', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: key, type: key === 'customers/order' ? 'customer_order' : key === 'index' ? 'index' : 'collection', layoutKey: 'theme', sections: [] },
        liquidBundle: bundle, liquidTemplateKey: key,
        liquidContext: { shop: { name: 'Synthetic Dewdrop' }, collection: { title: key === 'search' ? 'Search results' : 'Colour', products: [], total: 0 }, collections: [], section_products: {}, request: { path: key === 'search' ? '/search' : '/collections/colour', query: {} }, buyer, order, buyer_unavailable: false, ...extra },
    });
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
    assert.deepEqual(result.warnings, []);
    if (output) {
        const name = `${String(++renderCount).padStart(3, '0')}-${key.replaceAll('/', '-')}`;
        writeFileSync(join(output, `${name}.html`), result.liquid!.contentForLayout);
        writeFileSync(join(output, `${name}.json`), JSON.stringify({ key, bundleSHA256: hash(bundle), status: result.status, warnings: result.warnings, htmlSHA256: hash(result.liquid!.contentForLayout), headerSHA256: hash(result.liquid!.header), footerSHA256: hash(result.liquid!.footer), styleSHA256: hash(result.liquid!.headStyleText), syntheticOnly: true }, null, 2) + '\n');
    }
    const dom = new JSDOM(result.liquid!.contentForLayout);
    return { html: result.liquid!.contentForLayout, liquid: result.liquid!, document: dom.window.document, close: () => dom.window.document.defaultView?.close() };
}
function discovery(bundle: LiquidThemePackageBundle, key: 'collection' | 'search', title: string | undefined) {
    const settings = bundle.templates[key].sections[key === 'collection' ? 'aura-care-discovery' : 'aura-care-search'].settings;
    if (title === undefined) delete settings.title;
    else settings.title = title;
    return bundle;
}

test('explicit successor conserves original factory and Core input, and changes release identity only on the clone', () => {
    const base = createLetbuyyCoreLiquidThemeBundleFixture(); const before = hash(base); const pin = hash(original);
    const successor = createDewdropThemeV201(base);
    assert.equal(hash(base), before); assert.equal(hash(createFirstPartyCatalogBundle('letbuyy-aura', { designVersion: '2.0.0' })), pin);
    assert.equal(original.package.version, '2.0.0'); assert.equal(successor.package.version, '2.0.1');
    assert.equal(successor.package.version_number, 3); assert.equal(successor.package.status, original.package.status);
    assert.equal(successor.package.release_status, original.package.release_status);
    assert.equal(successor.package.checksum, undefined);
});
test('saved merchant settings, template structure, disabled state, styling and product content are preserved exactly', () => {
    const saved = structuredClone(original);
    saved.config.settings_data.current.primaryColor = '#123456';
    saved.config.settings_data.current.savedUnknownSetting = { retain: true };
    const hero = saved.templates.index.sections['aura-care-introduction'];
    hero.settings.savedUnknownSetting = 'merchant value';
    const header = saved.templates.header.sections['header-default'];
    header.blocks = { 'saved-link': { type: 'link', settings: { label: 'Saved link', href: '/pages/about', merchantUnknown: 'Retained' }, blocks: {}, block_order: [], disabled: false } };
    header.block_order = ['saved-link'];
    saved.templates.search.sections['aura-care-search'].settings.title = 'Saved search heading';
    saved.templates.collection.sections['aura-care-discovery'].settings.title = 'Find your everyday.';
    saved.templates.collection.sections['aura-care-discovery'].disabled = true;
    saved.templates['customers/order'].sections['customer-order-detail-default'].settings.heading = 'Saved receipt';
    const before = hash(saved); const successor = createDewdropThemeV201(saved);
    assert.equal(hash(saved), before); assert.deepEqual(successor.templates, saved.templates);
    assert.deepEqual(successor.config, saved.config); assert.deepEqual(successor.renderer, saved.renderer); assert.deepEqual(successor.blocks, saved.blocks); assert.deepEqual(successor.locales, saved.locales);
    assert.deepEqual(successor.sections['product-detail'], saved.sections['product-detail']);
    assert.deepEqual(successor.layout, saved.layout);
    assert.deepEqual(roundtrip(successor), successor);
});
test('successor passes portable schema, editor-document roundtrip and runtime schema projection', () => {
    const successor = fresh();
    for (const candidate of [successor, roundtrip(successor)]) {
        LiquidThemePackageBundleSchema.parse(candidate);
        const persistence = buildLiquidThemePackagePersistencePayload(candidate);
        assert.equal((persistence.schemaManifest.section_schemas['collection-filter'] as { settings_schema: Record<string, { type: string }> }).settings_schema.title.type, 'text');
        assert.equal(candidate.sections['collection-filter'].schema.settings.find(field => field.id === 'title')?.default, '');
    }
});
test('successor re-entry is idempotent and isolated from its caller', () => {
    const input = fresh(); const before = hash(input); const output = createDewdropThemeV201(input);
    assert.equal(hash(output), before); output.templates.search.sections['aura-care-search'].settings.title = 'Separate';
    assert.equal(hash(input), before);
});
test('unsupported identity and drifted discovery, saved facts and configured order contracts fail closed', () => {
    const invalid = structuredClone(original); invalid.package.slug = 'letbuyy-forge';
    assert.throws(() => createDewdropThemeV201(invalid), /requires canonical Core or saved Dewdrop/);
    const drift = structuredClone(original); drift.sections['collection-filter'].source += '{{ collection.title | default: section.settings.title }}';
    assert.throws(() => createDewdropThemeV201(drift), /unchanged 2.0.0/);
    const successor = fresh(); successor.sections['customer-order-detail'].source = successor.sections['customer-order-detail'].source.replace('<!-- lb:niche-order-presentation:v1 -->', '');
    assert.throws(() => createDewdropThemeV201(successor), /exact configured/);
    const wrongVersion = fresh(); wrongVersion.package.version_number = 2;
    assert.throws(() => createDewdropThemeV201(wrongVersion), /exact configured/);
});
test('fresh dynamic collection and search defaults preserve actual supplied headings', async () => {
    for (const [key, expected] of [['collection', 'Colour'], ['search', 'Search results']] as const) {
        const before = await render(key, original); const after = await render(key, fresh());
        try { assert.equal(after.document.querySelector('h1')?.textContent, expected); assert.equal(after.html, before.html); }
        finally { before.close(); after.close(); }
    }
});
test('custom collection and search headings reach actual Liquid output after document serialization', async () => {
    for (const key of ['collection', 'search'] as const) {
        const result = await render(key, roundtrip(discovery(fresh(), key, 'Merchant care heading')));
        try { assert.equal(result.document.querySelector('h1')?.textContent, 'Merchant care heading'); assert.match(result.document.body.textContent ?? '', /0 products/); }
        finally { result.close(); }
    }
});
test('omitted, cleared and whitespace heading recovers actual collection title', async () => {
    for (const value of [undefined, '', '   ']) {
        const result = await render('collection', roundtrip(discovery(fresh(), 'collection', value)));
        try { assert.equal(result.document.querySelector('h1')?.textContent, 'Colour'); } finally { result.close(); }
    }
});
test('empty context and cleared merchant override have the original neutral care heading fallback', async () => {
    const result = await render('collection', discovery(fresh(), 'collection', ''), { collection: { title: '', products: [], total: 0 } });
    try { assert.equal(result.document.querySelector('h1')?.textContent, 'Find your everyday.'); } finally { result.close(); }
});
test('order custom/default/cleared headings preserve canonical number, totals and saved product details', async () => {
    for (const [value, label] of [['Receipt', 'Receipt'], ['', 'Order'], ['   ', 'Order']] as const) {
        const bundle = fresh(); bundle.templates['customers/order'].sections['customer-order-detail-default'].settings.heading = value;
        const result = await render('customers/order', roundtrip(bundle));
        try {
            assert.equal(result.document.querySelector('.lb-order-detail h1')?.textContent, `${label} #1042`);
            assert.match(result.document.querySelector('.lb-order-detail__total')?.textContent ?? '', /1,140/);
            assert.match(result.document.querySelector('.lb-order-facts__text')?.textContent ?? '', /saved synthetic formula/);
            assert.match(result.document.body.textContent ?? '', /Synthetic Tint/);
        } finally { result.close(); }
    }
});
test('hostile discovery and order heading edits stay escaped inert text at canonical sanitizer boundary', async () => {
    const hostile = '<img src=x onerror=attack()><script>attack()</script>';
    for (const key of ['collection', 'search', 'customers/order']) {
        const bundle = fresh();
        if (key === 'customers/order') bundle.templates[key].sections['customer-order-detail-default'].settings.heading = hostile;
        else discovery(bundle, key as 'collection' | 'search', hostile);
        const result = await render(key, roundtrip(bundle));
        try {
            const heading = result.document.querySelector('h1'); assert.ok(heading);
            assert.equal(heading.textContent, hostile + (key === 'customers/order' ? ' #1042' : ''));
            assert.equal(heading.querySelectorAll('img,script,iframe,svg,[onerror]').length, 0);
        } finally { result.close(); }
    }
});
test('guest, unavailable buyer and missing order guards hide configured heading and immutable private facts', async () => {
    const bundle = fresh(); bundle.templates['customers/order'].sections['customer-order-detail-default'].settings.heading = 'PRIVATE RECEIPT';
    for (const extra of [{ buyer: null, order }, { buyer_unavailable: true, buyer, order }, { buyer, order: null }]) {
        const result = await render('customers/order', bundle, extra);
        try { assert.equal(result.document.querySelector('.lb-order-detail h1'), null); assert.doesNotMatch(result.document.querySelector('.lb-order-detail')?.textContent ?? '', /PRIVATE RECEIPT|1042|Synthetic Tint|saved synthetic formula/); }
        finally { result.close(); }
    }
});

test('all twenty frozen catalogue fingerprints remain exact under legacy and explicit 2.0.0 selection', () => {
    const pins = JSON.parse(readFileSync(new URL('../../../docs/implementation/niche-theme-programme/heading-successor-integrations/01-circuit/default-catalog-before.json', import.meta.url), 'utf8')) as Record<string, { legacy: string; v200: string }>;
    assert.equal(Object.keys(pins).length, 10);
    for (const [slug, pin] of Object.entries(pins)) {
        assert.equal(hash(createFirstPartyCatalogBundle(slug)), pin.legacy, `${slug} legacy drift`);
        assert.equal(hash(createFirstPartyCatalogBundle(slug, { designVersion: '2.0.0' })), pin.v200, `${slug} 2.0.0 drift`);
    }
});
test('all twenty-one default page, header, footer and style outputs remain exact on the successor', async () => {
    const successor = fresh();
    const keys = Object.keys(original.templates).filter(key => !['header', 'footer'].includes(key));
    assert.equal(keys.length, 21);
    for (const key of keys) {
        const before = await render(key, original); const after = await render(key, successor);
        try {
            assert.equal(after.html, before.html, `${key} body drift`);
            assert.equal(after.liquid.header, before.liquid.header, `${key} header drift`);
            assert.equal(after.liquid.footer, before.liquid.footer, `${key} footer drift`);
            assert.equal(after.liquid.headStyleText, before.liquid.headStyleText, `${key} style drift`);
        } finally { before.close(); after.close(); }
    }
});
test('saved stock strings are explicit merchant values rather than migration sentinels', () => {
    const saved = structuredClone(original); const successor = createDewdropThemeV201(saved);
    assert.equal(successor.templates.search.sections['aura-care-search'].settings.title, 'Search your care shelf');
    assert.deepEqual(successor.templates, saved.templates);
    assert.equal(fresh().templates.search.sections['aura-care-search'].settings.title, '');
});
test('saved successor edited values and nested unknown data survive canonical roundtrip and re-entry', () => {
    const saved = fresh(); saved.templates.search.sections['aura-care-search'].settings.title = 'Saved successor edit';
    saved.config.settings_data.current.future = { empty: null, zero: 0, enabled: false, labels: ['தமிழ்', 'हिन्दी'] };
    const before = roundtrip(saved); const successor = createDewdropThemeV201(before);
    assert.deepEqual(successor, before); assert.deepEqual(before, saved);
});
