import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-bundle-core';
import { createPlayfieldThemeV201 as createFactsBase } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/playfield-theme-v201';
import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-bundle';
import { LiquidRenderer } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/theme-settings';
import { loadThemeServerDom } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/server-dom-runtime';
import { withNicheOrderPresentation } from '/Volumes/Projects/LetBuyy/packages/theme-engine/src/niche-order-presentation';
import { ToyFactsSchema, ToyVariantFactsSchema, resolveToyFacts } from '/Volumes/Projects/LetBuyy/packages/commerce-core/src/playfield-facts';
import { productToLiquidDrop } from '/Volumes/Projects/LetBuyy/apps/commerce/web/src/lib/theme-engine/product-liquid-drop';
import { parseResolvedToyFacts } from '/Volumes/Projects/LetBuyy/apps/commerce/web/src/lib/theme-engine/variant-options-carrier';
import { createPlayfieldThemeV201 as createPrivateSuccessor } from './applied/playfield-theme-subtitle-successor';

const root = '/Volumes/Projects/LetBuyy/';
const owned = root + 'docs/implementation/niche-themes-2026-10-23/playfield/completion-2026-10-24/applied-private-subtitle-successor-01/';
const provenance = JSON.parse(readFileSync(owned + 'PROVENANCE_BEFORE.json', 'utf8'));
const recipe = JSON.parse(readFileSync(root + 'docs/implementation/niche-themes-2026-10-23/playfield/installed-fixture-preparation/toys-fixture-proposal.json', 'utf8')).entry.createFields;
const attempt = process.env.PF_PRIVATE_SUCCESSOR_ATTEMPT;
assert.match(attempt || '', /^\d{2}$/);
const renderDir = owned + 'renders/attempt-' + attempt + '/';
mkdirSync(renderDir, { recursive: true });
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const base = () => createFactsBase(createLetbuyyCoreLiquidThemeBundleFixture());
const successor = () => createPrivateSuccessor(createLetbuyyCoreLiquidThemeBundleFixture());
type Product = NonNullable<Parameters<typeof productToLiquidDrop>[0]>;

function sourceProduct(explicitMaterialClear = false): Product {
    return {
        // Source-test labels only, never fixture readbacks or invented durable UUIDs.
        id: 'source-only-toys-product', name: recipe.name, description: recipe.description,
        price: recipe.price, currency: 'INR', stock: recipe.stock, images: [],
        toys: ToyFactsSchema.parse(recipe.metadata.toys), variantOptions: recipe.product_options,
        variants: recipe.variants.map((v: { title: string; stock: number; options: Record<string, string>; metadata: { toys: unknown } }, index: number) => ({
            id: 'source-only-edition-' + index, name: v.title, stock: v.stock, price: recipe.price,
            options: v.options, metadata: { toys: ToyVariantFactsSchema.parse({ ...v.metadata.toys as object, ...(explicitMaterialClear && index === 1 ? { materials: '' } : {}) }) },
        })),
    };
}
const product = sourceProduct();
const productDrop = productToLiquidDrop(product)!;
const secondDrop = productToLiquidDrop({ ...sourceProduct(), id: 'source-only-other-product', name: 'Other supplied activity' })!;

function record(name: string, html: string) {
    const file = renderDir + name + '.html';
    if (existsSync(file)) assert.equal(readFileSync(file, 'utf8'), html, 'Never overwrite different retained render evidence.');
    else writeFileSync(file, html);
    return html;
}

async function dom<T>(html: string, inspect: (document: Document) => T): Promise<T> {
    const { JSDOM } = await loadThemeServerDom();
    const instance = new JSDOM(html);
    try { return inspect(instance.window.document); } finally { instance.window.close(); }
}

async function renderRelated(name: string, bundle: LiquidThemePackageBundle, subtitle?: string, options: { products?: Record<string, unknown>[]; sibling?: boolean; limit?: number } = {}) {
    const cloned = structuredClone(bundle);
    const settings = { title: 'Related activity heading', columns: 3, productLimit: options.limit ?? 6, collectionId: 'source-only-collection-binding', ...(subtitle === undefined ? {} : { subtitle }) };
    cloned.templates.product = {
        name: 'Private source render only', layout: 'theme',
        sections: {
            related: { type: 'featured-products', settings, blocks: {}, block_order: [], disabled: false },
            ...(options.sibling ? { sibling: { type: 'product-grid', settings: { title: 'Sibling heading', subtitle: 'Sibling description' }, blocks: {}, block_order: [], disabled: false } } : {}),
        },
        order: options.sibling ? ['related', 'sibling'] : ['related'],
    };
    const products = options.products ?? [productDrop];
    const result = await new LiquidRenderer().render({
        context: { storeId: 'source-only-store', subdomain: 'source-only-playfield', path: '/product/source-only-toys', previewMode: false, locale: 'en-IN' },
        storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] },
        liquidBundle: cloned, liquidTemplateKey: 'product',
        liquidContext: { shop: { name: 'Source-only Playfield' }, section_products: { related: products, sibling: products } },
    });
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
    assert.deepEqual(result.warnings, []);
    return record(name, result.liquid!.contentForLayout);
}

async function renderPdp(name: string, bundle: LiquidThemePackageBundle, model = sourceProduct(), factsEnabled = true) {
    const cloned = structuredClone(bundle);
    const original = cloned.templates.product;
    const id = original.order.find(key => original.sections[key].type === 'product-detail')!;
    cloned.templates.product = { ...original, sections: { [id]: { ...original.sections[id], settings: { ...original.sections[id].settings, showToyFacts: factsEnabled } } }, order: [id] };
    const result = await new LiquidRenderer().render({
        context: { storeId: 'source-only-store', subdomain: 'source-only-playfield', path: '/product/source-only-toys', previewMode: false, locale: 'en-IN' },
        storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] },
        liquidBundle: cloned, liquidTemplateKey: 'product', liquidContext: { product: productToLiquidDrop(model)! },
    });
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
    assert.deepEqual(result.warnings, []);
    return record(name, result.liquid!.contentForLayout);
}

test('the actually applied private file derives from the exact current facts base with only the subtitle insertion and two relocated imports', () => {
    const before = readFileSync(root + provenance.base.path, 'utf8');
    assert.equal(digest(before), provenance.base.sha256);
    assert.equal(readFileSync(owned + 'before/playfield-theme-v201.ts.snapshot', 'utf8'), before);
    let applied = readFileSync(owned + 'applied/playfield-theme-subtitle-successor.ts', 'utf8');
    assert.equal(digest(applied), provenance.appliedSource.sha256);
    for (const [oldPath, newPath] of Object.entries(provenance.importRelocationOnly)) applied = applied.replace(newPath as string, oldPath);
    const addition = applied.slice(applied.indexOf('    // Connect the declared related-products'), applied.lastIndexOf('    return LiquidThemePackageBundleSchema.parse(bundle);'));
    assert.ok(addition.includes('section.settings.subtitle'));
    assert.equal(applied.replace(addition, ''), before);
    assert.equal(provenance.versionAssignmentPendingAllocator, true);
    assert.equal(provenance.successorVersion, null);
});

test('canonical schema accepts the private successor; every default, fact section, variant consumer, route, style and input stays exact', () => {
    const input = createLetbuyyCoreLiquidThemeBundleFixture(), originalInput = structuredClone(input);
    const old = createFactsBase(input), next = createPrivateSuccessor(input);
    assert.deepEqual(LiquidThemePackageBundleSchema.parse(next), next);
    assert.deepEqual(input, originalInput);
    for (const key of Object.keys(old) as Array<keyof LiquidThemePackageBundle>) if (key !== 'sections') assert.deepEqual(next[key], old[key], key);
    for (const key of Object.keys(old.sections)) {
        if (key !== 'featured-products') assert.deepEqual(next.sections[key], old.sections[key], key);
        else {
            assert.deepEqual(next.sections[key].schema, old.sections[key].schema);
            assert.equal(next.sections[key].path, old.sections[key].path);
            const heading = '<h2>{{ section.settings.title }}</h2>';
            assert.equal(next.sections[key].source, old.sections[key].source.replace(heading, heading + '{% if section.settings.subtitle != blank %}<p>{{ section.settings.subtitle }}</p>{% endif %}'));
        }
    }
});

test('nonblank subtitle is actual canonical rendered output once, immediately after its own heading', async () => {
    await dom(await renderRelated('nonblank', successor(), 'Choose another curiosity.'), document => {
        const section = document.querySelector('[data-section-id="related"]')!;
        const heading = section.querySelector('h2')!;
        assert.equal(heading.nextElementSibling?.tagName, 'P');
        assert.equal(heading.nextElementSibling?.textContent, 'Choose another curiosity.');
        assert.equal([...section.querySelectorAll('p')].filter(p => p.textContent === 'Choose another curiosity.').length, 1);
    });
});

test('omitted, empty and whitespace-only subtitles render no empty paragraph', async () => {
    for (const [index, value] of [undefined, '', '   \t\n'].entries()) await dom(await renderRelated('blank-' + index, successor(), value), document => {
        assert.equal(document.querySelector('[data-section-id="related"] h2')!.nextElementSibling?.className, 'pf-grid');
    });
});

test('hostile markup is inert text and Tamil/Hindi characters survive the real sanitizer path', async () => {
    const value = '<img src=x onerror="globalThis.unsafe=true"><script>unsafe()</script> {{ 7 | plus: 1 }} தமிழ் गतिविधि & choosing';
    await dom(await renderRelated('hostile-text', successor(), value), document => {
        const paragraph = document.querySelector('[data-section-id="related"] h2')!.nextElementSibling!;
        assert.equal(paragraph.tagName, 'P');
        assert.equal(paragraph.textContent, value);
        assert.equal(paragraph.querySelector('script,img,[onerror]'), null);
        assert.match(paragraph.textContent!, /\{\{ 7 \| plus: 1 \}\}/);
    });
});

test('empty related data retains the existing no-products behavior and creates no phantom description', async () => {
    await dom(await renderRelated('empty-products', successor(), 'No phantom activity.', { products: [] }), document => {
        const section = document.querySelector('[data-section-id="related"]')!;
        assert.equal(section.querySelector('h2'), null);
        assert.doesNotMatch(section.textContent!, /No phantom activity/);
    });
});

test('unchanged empty defaults produce byte-identical rendered output to the current facts base', async () => {
    const before = await renderRelated('default-before', base());
    const after = await renderRelated('default-after', successor());
    assert.equal(after, before);
});

test('related description does not leak into or replace the sibling product grid description', async () => {
    await dom(await renderRelated('sibling-isolation', successor(), 'Related description', { sibling: true }), document => {
        const related = document.querySelector('[data-section-id="related"]')!, sibling = document.querySelector('[data-section-id="sibling"]')!;
        assert.match(related.textContent!, /Related description/); assert.doesNotMatch(related.textContent!, /Sibling description/);
        assert.match(sibling.textContent!, /Sibling description/); assert.doesNotMatch(sibling.textContent!, /Related description/);
    });
});

test('prebound related resource order, product limit, links and collection setting are retained', async () => {
    const products = [secondDrop, productDrop];
    const before = await renderRelated('resources-before', base(), undefined, { products, limit: 1 });
    const after = await renderRelated('resources-after', successor(), 'Related note', { products, limit: 1 });
    const anchors = (document: Document) => [...document.querySelectorAll('[data-section-id="related"] article a')].map(a => [a.getAttribute('href'), a.textContent]);
    assert.deepEqual(await dom(after, anchors), await dom(before, anchors));
    await dom(after, document => {
        assert.equal(document.querySelectorAll('[data-section-id="related"] article').length, 1);
        assert.match(document.querySelector('[data-section-id="related"] article')!.textContent!, /Other supplied activity/);
    });
    assert.deepEqual(successor().templates.product, base().templates.product);
});

test('canonical PDP facts, variant option carriers, empty media and purchase controls render byte-identically', async () => {
    const before = await renderPdp('pdp-before', base());
    const after = await renderPdp('pdp-after', successor());
    assert.equal(after, before);
    await dom(after, document => {
        assert.ok(document.querySelector('[data-lb-toy-presentation]'));
        assert.ok(document.querySelector('lb-variant-picker'));
        assert.ok(document.querySelector('lb-add-to-cart'));
        assert.match(document.body.textContent!, /Product image not supplied/);
    });
});

test('explicit edition unknowns and genuine Paper overrides remain canonical and unchanged', async () => {
    const model = sourceProduct(true), original = structuredClone(model), drop = productToLiquidDrop(model)!;
    const variants = drop.variants as Array<{ toys_resolved_json?: string }>;
    assert.equal(variants.length, 3);
    for (let index = 0; index < variants.length; index++) assert.deepEqual(parseResolvedToyFacts(variants[index].toys_resolved_json), resolveToyFacts(model.toys, model.variants![index].metadata!.toys));
    assert.equal(parseResolvedToyFacts(variants[1].toys_resolved_json)!.materials, '');
    assert.equal(parseResolvedToyFacts(variants[1].toys_resolved_json)!.dimensions, null);
    assert.equal(parseResolvedToyFacts(variants[2].toys_resolved_json)!.materials, 'Paper');
    assert.equal(parseResolvedToyFacts(variants[2].toys_resolved_json)!.dimensions!.height, undefined);
    assert.deepEqual(model, original);
    assert.equal(await renderPdp('explicit-facts-after', successor(), model), await renderPdp('explicit-facts-before', base(), model));
});

test('showToyFacts false preserves the current exact hidden-facts and variant-purchase behavior', async () => {
    const before = await renderPdp('facts-off-before', base(), sourceProduct(), false);
    const after = await renderPdp('facts-off-after', successor(), sourceProduct(), false);
    assert.equal(after, before);
    await dom(after, document => {
        assert.equal(document.querySelector('[data-lb-toy-field]'), null);
        assert.ok(document.querySelector('lb-variant-picker'));
        assert.ok(document.querySelector('lb-add-to-cart'));
    });
});

test('existing shared order presentation and its styles are preserved without a customer heading or palette repair', () => {
    const before = withNicheOrderPresentation(base()), after = withNicheOrderPresentation(successor());
    assert.deepEqual(after.sections['customer-order-detail'], before.sections['customer-order-detail']);
    assert.deepEqual(after.layout, before.layout);
    assert.deepEqual(after.templates['customers/order'], before.templates['customers/order']);
    assert.ok(after.sections['customer-order-detail'].source.includes('lb:niche-order-presentation:v1'));
});
