import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadThemeServerDom } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/server-dom-runtime';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-bundle-core';
import { createPlayfieldTheme } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/playfield-theme';
import { createPlayfieldThemeV201 as currentFactory } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/playfield-theme-v201';
import { DEFAULT_THEME_SETTINGS } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-settings';
import { LiquidRenderer } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-renderer';
import { createPlayfieldThemeV201 as proposedFactory } from './factory-under-test';

// This switch selects a source-only known-defect comparison. It is not a product flag.
const mode = process.env.PLAYFIELD_SUBTITLE_PROPOSAL_MODE;
assert.ok(mode === 'current' || mode === 'private', 'Choose an explicit finite source comparison.');
const factory = mode === 'current' ? currentFactory : proposedFactory;
const root = '/Volumes/Projects/LetBuyy/';
const product = {
    // Synthetic source-only key, never an installed product/UUID/readback.
    id: 'source-only-subtitle-product', title: 'Source-only activity', price: 1, currency: 'INR',
    url: '/product/source-only-activity', images: [], available: true,
    toys_card: { ageLabel: '', contentsLabel: '', contentsComplete: false, hasOptions: false },
};
const marker = '<h2>{{ section.settings.title }}</h2>';
const addition = '{% if section.settings.subtitle != blank %}<p>{{ section.settings.subtitle }}</p>{% endif %}';

async function render(subtitle?: string, products = [product], sibling = false) {
    const bundle = factory(createLetbuyyCoreLiquidThemeBundleFixture());
    const settings = { title: 'Related activity heading', columns: 3, productLimit: 6, ...(subtitle === undefined ? {} : { subtitle }) };
    bundle.templates.product = {
        name: 'Source-only related section comparison', layout: 'theme',
        sections: {
            related: { type: 'featured-products', settings, blocks: {}, block_order: [], disabled: false },
            ...(sibling ? { sibling: { type: 'product-grid', settings: { title: 'Sibling heading', subtitle: 'Sibling description' }, blocks: {}, block_order: [], disabled: false } } : {}),
        },
        order: sibling ? ['related', 'sibling'] : ['related'],
    };
    const result = await new LiquidRenderer().render({
        context: { storeId: 'source-only-store', subdomain: 'source-only-subtitle', path: '/product/source-only-activity', previewMode: false, locale: 'en-IN' },
        storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] },
        liquidBundle: bundle, liquidTemplateKey: 'product',
        liquidContext: { section_products: { related: products, sibling: products }, shop: { name: 'Source-only subtitle review' } },
    });
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
    assert.deepEqual(result.warnings, []);
    return result.liquid!.contentForLayout;
}

async function inspect(html: string, run: (document: Document) => void) {
    const { JSDOM } = await loadThemeServerDom();
    const dom = new JSDOM(html);
    try { run(dom.window.document); } finally { dom.window.close(); }
}

test('declared related-products description renders once after its own heading', async () => {
    await inspect(await render('An independently chosen activity.'), document => {
        const section = document.querySelector('[data-section-id="related"]')!;
        assert.ok(section);
        const heading = section.querySelector('h2')!;
        assert.equal(heading.textContent, 'Related activity heading');
        assert.equal(heading.nextElementSibling?.tagName, 'P');
        assert.equal(heading.nextElementSibling?.textContent, 'An independently chosen activity.');
        assert.equal([...section.querySelectorAll('p')].filter(p => p.textContent === 'An independently chosen activity.').length, 1);
    });
});

test('empty and omitted descriptions add no empty paragraph before the grid', async () => {
    for (const subtitle of ['', undefined]) await inspect(await render(subtitle), document => {
        const heading = document.querySelector('[data-section-id="related"] h2')!;
        assert.equal(heading.nextElementSibling?.className, 'pf-grid');
    });
});

test('merchant markup remains inert while Tamil and Hindi text survives the canonical renderer', async () => {
    const description = '<script>globalThis.subtitleUnsafe = true</script> தமிழ் गतिविधि & choosing';
    await inspect(await render(description), document => {
        const section = document.querySelector('[data-section-id="related"]')!;
        assert.equal(section.querySelector('script'), null);
        assert.match(section.textContent!, /தமிழ் गतिविधि/);
        assert.equal(section.querySelector('h2')!.nextElementSibling?.textContent, description);
    });
});

test('an empty product set does not create a phantom related description or heading', async () => {
    await inspect(await render('No phantom products.', []), document => {
        const section = document.querySelector('[data-section-id="related"]')!;
        assert.ok(section);
        assert.equal(section.querySelector('h2'), null);
        assert.doesNotMatch(section.textContent!, /No phantom products/);
    });
});

test('a sibling grid retains its own description and does not consume the related value', async () => {
    await inspect(await render('Related description', [product], true), document => {
        const related = document.querySelector('[data-section-id="related"]')!;
        const sibling = document.querySelector('[data-section-id="sibling"]')!;
        assert.match(related.textContent!, /Related description/);
        assert.doesNotMatch(related.textContent!, /Sibling description/);
        assert.match(sibling.textContent!, /Sibling description/);
        assert.doesNotMatch(sibling.textContent!, /Related description/);
    });
});

test('proposal changes exactly related source; settings, PDP facts, layout, routes and input remain identical', () => {
    const base = createLetbuyyCoreLiquidThemeBundleFixture(), before = structuredClone(base);
    const current = currentFactory(base), proposed = proposedFactory(base);
    assert.deepEqual(base, before);
    assert.deepEqual(proposed.package, current.package);
    assert.deepEqual(proposed.layout, current.layout);
    assert.deepEqual(proposed.templates, current.templates);
    assert.deepEqual(proposed.config, current.config);
    assert.deepEqual(proposed.blocks, current.blocks);
    assert.deepEqual(proposed.renderer, current.renderer);
    for (const key of Object.keys(current.sections)) {
        if (key === 'featured-products') {
            assert.deepEqual(proposed.sections[key].schema, current.sections[key].schema);
            assert.equal(proposed.sections[key].source, current.sections[key].source.replace(marker, marker + addition));
        } else assert.deepEqual(proposed.sections[key], current.sections[key], key);
    }
});

test('frozen 2.0.0 factory and accepted current 2.0.1 source bytes have not been changed', () => {
    const files = JSON.parse(readFileSync(root + 'docs/implementation/niche-themes-2026-10-23/playfield/completion-2026-10-24/proposal-subtitle-qualification-01/INPUTS_BEFORE.json', 'utf8')).inputs as Array<{ path: string; sha256: string }>;
    for (const pin of files) assert.equal(createHash('sha256').update(readFileSync(root + pin.path)).digest('hex'), pin.sha256, pin.path);
    const base = createLetbuyyCoreLiquidThemeBundleFixture();
    const frozen = createPlayfieldTheme(base);
    assert.equal(frozen.package.version, '2.0.0');
    assert.doesNotMatch(frozen.sections['featured-products'].source.split('{% schema %}')[0], /section\.settings\.subtitle/);
});
