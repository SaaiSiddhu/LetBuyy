import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createFirstPartyCatalogBundle, firstPartyThemeListings, qualifiedFirstPartyInlineChildParents,
    LiquidRenderer, DEFAULT_THEME_SETTINGS, toThemeDocumentV2, type LiquidThemePackageBundle } from '../src/index.ts';

const previous = { designVersion: '2.0.0', playfieldVersion: '2.0.2', circuitVersion: '2.0.1', pantryVersion: '2.0.1',
    trailmarkVersion: '2.0.1', threadlineVersion: '2.0.1', dewdropVersion: '2.0.1' } as const;
const defaults = (fields: Array<{ id: string; default?: unknown }>) => Object.fromEntries(fields.filter(field => field.default !== undefined).map(field => [field.id, field.default]));
const child = (label: string, blocks = {}) => ({ type: 'badge', settings: { label }, disabled: false, blocks, block_order: Object.keys(blocks) });
async function render(bundle: LiquidThemePackageBundle, key = 'index') {
    const result = await new LiquidRenderer().render({
        context: { storeId: 'source-customization-only', subdomain: 'synthetic', path: '/', previewMode: false, locale: 'en-IN' },
        storeTemplate: { themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        liquidBundle: bundle, liquidTemplateKey: key,
        liquidContext: { shop: { name: 'Synthetic customization witness' }, collection: { title: '', products: [], total: 0 }, section_products: {}, buyer_unavailable: true },
    });
    assert.equal(result.status, 'rendered', result.warnings.join(', '));
    return result.liquid!;
}
function scenario(base: LiquidThemePackageBundle, sectionType: string, parentType: string, children: Record<string, ReturnType<typeof child>>) {
    const bundle = structuredClone(base), schema = bundle.sections[sectionType].schema;
    const fields = schema.blocks.find(block => block.type === parentType)?.settings || bundle.blocks[parentType]?.schema.settings || [];
    const settings = defaults(fields);
    for (const field of fields) {
        if (['text', 'textarea', 'richtext'].includes(field.type)) settings[field.id] = 'Synthetic parent';
        if (field.type === 'url') settings[field.id] = '/products';
    }
    bundle.templates.index = { name: 'Synthetic source witness', layout: 'theme', order: ['witness'], sections: {
        witness: { type: sectionType, settings: defaults(schema.settings), disabled: false, block_order: ['parent'], blocks: {
            parent: { type: parentType, settings, disabled: false, blocks: children, block_order: Object.keys(children) },
        } },
    } };
    return bundle;
}
const witnessHtml = async (bundle: LiquidThemePackageBundle) => (await render(bundle)).sections.find(section => section.id === 'witness')!.html;

for (const listing of firstPartyThemeListings(previous)) {
    test(`${listing.name}: explicit successor preserves every default template and leaves all prior factory bytes intact`, async () => {
        const before = createFirstPartyCatalogBundle(listing.slug, previous), frozen = JSON.stringify(before);
        const next = createFirstPartyCatalogBundle(listing.slug, { customizationVersion: '2.1.0' });
        assert.equal(next.package.version_number, 5);
        for (const key of Object.keys(before.templates)) {
            const oldHtml = await render(before, key), newHtml = await render(next, key);
            assert.equal(newHtml.contentForLayout, oldHtml.contentForLayout, key);
            assert.equal(newHtml.layoutHtml, oldHtml.layoutHtml, key);
        }
        assert.equal(JSON.stringify(createFirstPartyCatalogBundle(listing.slug, previous)), frozen);
        assert.equal(createFirstPartyCatalogBundle(listing.slug, { designVersion: '2.0.0' }).package.version, '2.0.0');
    });
    test(`${listing.name}: every declared parent emits its real nested reusable child through canonical document roundtrip`, async () => {
        const bundle = createFirstPartyCatalogBundle(listing.slug, { customizationVersion: '2.1.0' });
        for (const [sectionType, file] of Object.entries(bundle.sections)) for (const declaration of file.schema.blocks) {
            if (declaration.type === '@app') continue;
            const marker = 'CHILD_WITNESS_' + sectionType;
            const candidate = scenario(bundle, sectionType, declaration.type, { nested: child(marker) });
            toThemeDocumentV2(candidate);
            assert.equal((await witnessHtml(candidate)).split(marker).length, 2, `${sectionType}/${declaration.type} renders exactly once`);
        }
    });
    test(`${listing.name}: existing badge host retains order, visibility, depth, removal and escaping`, async () => {
        const bundle = createFirstPartyCatalogBundle(listing.slug, { customizationVersion: '2.1.0' });
        const candidate = scenario(bundle, 'trust-badges', 'badge', { a: child('FIRST', { grand: child('GRANDCHILD') }), b: child('SECOND') });
        const parent = candidate.templates.index.sections.witness.blocks.parent;
        let html = await witnessHtml(candidate);
        assert.ok(html.indexOf('FIRST') < html.indexOf('SECOND')); assert.ok(html.includes('GRANDCHILD'));
        parent.block_order.reverse(); html = await witnessHtml(candidate); assert.ok(html.indexOf('SECOND') < html.indexOf('FIRST'));
        parent.blocks.a.disabled = true; html = await witnessHtml(candidate); assert.ok(!html.includes('FIRST') && !html.includes('GRANDCHILD') && html.includes('SECOND'));
        parent.disabled = true; assert.ok(!(await witnessHtml(candidate)).includes('SECOND')); parent.disabled = false;
        delete parent.blocks.a; parent.block_order = ['b']; parent.blocks.b.settings.label = '<img src=x onerror=alert(1)>INERT';
        html = await witnessHtml(candidate); const dom = new JSDOM(html);
        try { assert.ok(dom.window.document.body.textContent?.includes('<img src=x onerror=alert(1)>INERT')); assert.equal(dom.window.document.querySelector('img,script,[onerror]'), null); }
        finally { dom.window.close(); }
        parent.blocks.b = child('READDED'); assert.ok((await witnessHtml(candidate)).includes('READDED'));
        delete parent.blocks.b; parent.block_order = []; assert.ok(!(await witnessHtml(candidate)).includes('READDED'));
    });
}

test('inline eligibility requires the exact installed successor section and reusable definitions', () => {
    const bundle = createFirstPartyCatalogBundle('letbuyy-bloom', { customizationVersion: '2.1.0' });
    assert.deepEqual(qualifiedFirstPartyInlineChildParents(bundle, 'banner-carousel'), ['slide']);
    const edited = structuredClone(bundle); edited.templates.index.sections[edited.templates.index.order[0]].settings.heading = 'Merchant saved edit';
    assert.deepEqual(qualifiedFirstPartyInlineChildParents(edited, 'banner-carousel'), ['slide']);
    for (const mutate of [
        (b: LiquidThemePackageBundle) => { b.package.slug = 'foreign'; },
        (b: LiquidThemePackageBundle) => { b.package.version = '2.0.0'; },
        (b: LiquidThemePackageBundle) => { b.sections['banner-carousel'].source += '<span>Moved outlet</span>'; },
        (b: LiquidThemePackageBundle) => { b.blocks.badge.source = b.blocks.badge.source.replace('block.sub_blocks', 'block.missing'); },
        (b: LiquidThemePackageBundle) => { b.sections['banner-carousel'].schema.blocks = []; },
    ]) { const invalid = structuredClone(bundle); mutate(invalid); assert.deepEqual(qualifiedFirstPartyInlineChildParents(invalid, 'banner-carousel'), []); }
    const forged = createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0' }); forged.package.version = '2.1.0'; forged.package.version_number = 5;
    assert.deepEqual(qualifiedFirstPartyInlineChildParents(forged, 'banner-carousel'), []);
});
