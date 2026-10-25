import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { JSDOM } from 'jsdom';
import { createFirstPartyCatalogBundle, createLetbuyyCoreLiquidThemeBundleFixture, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import { readProductNicheFacts, type ProductModel } from '@letbuyy/commerce-core';
import { productToLiquidDrop } from './product-liquid-drop';
import { encodeVariantFactPresentation, parseVariantFactPresentation, parsePickerVariants, MAX_PRODUCT_FACT_CARRIER_BYTES } from './variant-options-carrier';
const QaDom = JSDOM as unknown as new (html: string, options: {
    url: string;
}) => {
    window: Window & typeof globalThis & {
        close(): void;
    };
};
const dom = new QaDom('<!doctype html><body></body>', { url: 'https://shop.example.invalid/store/pantry/product/synthetic' });
const names = ['window', 'document', 'HTMLElement', 'Element', 'CustomEvent', 'CSS'];
const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent });
Object.defineProperty(globalThis, 'CSS', { configurable: true, value: { escape: (value: string) => value.replace(/["\\]/g, '\\$&') } });
let registered: Promise<void> | undefined;
const ready = () => registered ??= import('./liquid-hydration-islands').then(module => module.registerLiquidHydrationIslands());
after(() => { document.body.replaceChildren(); dom.window.close(); for (const name of names) {
    const value = previous.get(name);
    if (value)
        Object.defineProperty(globalThis, name, value);
    else
        Reflect.deleteProperty(globalThis, name);
} });
const productId = '11111111-1111-4111-8111-111111111111', secondId = '99999999-9999-4999-8999-999999999999';
const ids = ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
function foodModel(id = productId): ProductModel { return { id, name: 'Synthetic pantry packs', description: '', price: 180, stock: 5, currency: 'INR', images: [], ...readProductNicheFacts({ food: { netQuantity: { value: 999, unit: 'ml' } } }), variantOptions: [{ name: 'Pack size', values: ['250 g', '500 g', '750 g'] }, { name: 'भाषा', values: ['हिन्दी', 'English'] }], variants: [{ id: ids[0], title: 'Quarter pack', price: 180, stock: 3, options: { 'Pack size': '250 g', भाषा: 'हिन्दी' }, metadata: { food: { netQuantity: { value: 250, unit: 'g' } } } }, { id: ids[1], title: 'Unknown net pack', price: 340, stock: 2, options: { 'Pack size': '500 g', भाषा: 'हिन्दी' }, metadata: {} }, { id: ids[2], title: 'Unavailable pack', price: 500, stock: 0, options: { 'Pack size': '750 g', भाषा: 'हिन्दी' }, metadata: { food: { netQuantity: { value: 750, unit: 'g' } } } }] }; }
async function render(model: ProductModel, sectionId: string, slug = 'letbuyy-refresh') {
    const bundle = slug === 'letbuyy-core' ? createLetbuyyCoreLiquidThemeBundleFixture() : createFirstPartyCatalogBundle(slug, { designVersion: '2.0.0' });
    const original = bundle.templates.product;
    const key = original.order.find(id => original.sections[id].type === 'product-detail')!;
    bundle.templates.product = { ...original, sections: { [sectionId]: original.sections[key] }, order: [sectionId] };
    const result = await new LiquidRenderer().render({ context: { storeId: productId, subdomain: 'pantry-facts', path: '/product/' + model.id, previewMode: false, locale: 'en-IN' }, storeTemplate: { themeId: slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: 'product', liquidContext: { product: productToLiquidDrop(model)! } });
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
    assert.deepEqual(result.warnings, []);
    return result.liquid!.contentForLayout;
}
function section(id: string) { const root = document.querySelector<HTMLElement>(`[data-section-id="${id}"]`); assert.ok(root); return root; }
function choose(root: HTMLElement, name: string, value: string) { const button = [...root.querySelectorAll<HTMLButtonElement>('[data-lb-variant-option]')].find(item => item.dataset.variantName === name && item.dataset.variantValue === value); assert.ok(button, `${name} ${value}`); button.click(); }
function quantity(root: HTMLElement, value: string) { const input = root.querySelector<HTMLInputElement>('[name="quantity"]')!; input.value = value; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); }
const food = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-lb-current-food]')!;
const purchase = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!;
function clear() { document.body.replaceChildren(); window.localStorage.clear(); }
test('two actual mapper→Liquid→native picker product sections scope food facts/counts by durable UUID with spaces/Hindi labels', async () => {
    await ready();
    clear();
    const first = foodModel(), second = foodModel(secondId);
    second.variants = [{ id: '88888888-8888-4888-8888-888888888888', title: 'Other product pack', price: 220, stock: 4, options: { 'Pack size': '250 g', भाषा: 'हिन्दी' }, metadata: { food: { netQuantity: { value: 1000, unit: 'g' } } } }];
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => { requests++; throw new Error('Facts must not fetch'); }) as typeof fetch;
    try {
        document.body.innerHTML = await render(first, 'first') + await render(second, 'second');
        const a = section('first'), b = section('second');
        assert.equal(purchase(a).disabled, true);
        assert.equal(purchase(b).disabled, true);
        assert.doesNotMatch(food(a).textContent!, /999|net per pack/);
        choose(a, 'Pack size', '250 g');
        assert.match(food(a).textContent!, /Choose all options/);
        choose(a, 'भाषा', 'हिन्दी');
        assert.equal(food(a).dataset.variantId, ids[0]);
        assert.match(food(a).textContent!, /250 g net per pack/);
        assert.match(food(a).textContent!, /72\.00 \/ 100 g/);
        assert.equal(purchase(a).disabled, false);
        assert.match(food(b).textContent!, /Choose all options/);
        quantity(a, '2');
        assert.match(food(a).textContent!, /2 sellable packs · 500 g total/);
        assert.match(food(b).textContent!, /Choose all options/);
        choose(b, 'Pack size', '250 g');
        choose(b, 'भाषा', 'हिन्दी');
        quantity(b, '3');
        assert.match(food(b).textContent!, /3 sellable packs · 3000 g total/);
        assert.match(food(a).textContent!, /2 sellable packs · 500 g total/);
        quantity(a, '');
        assert.match(food(a).textContent!, /Enter a whole pack count/);
        assert.doesNotMatch(food(a).textContent!, /500 g total/);
        quantity(a, '1.5');
        assert.match(food(a).textContent!, /Enter a whole pack count/);
        assert.equal(requests, 0);
    }
    finally {
        globalThis.fetch = originalFetch;
        clear();
    }
});
test('missing, nonexistent, incomplete and unavailable selections cannot retain prior pack facts; fallback comparison remains', async () => {
    await ready();
    clear();
    document.body.innerHTML = await render(foodModel(), 'states');
    const root = section('states');
    choose(root, 'Pack size', '250 g');
    choose(root, 'भाषा', 'हिन्दी');
    choose(root, 'Pack size', '500 g');
    assert.equal(food(root).dataset.variantId, ids[1]);
    assert.match(food(root).textContent!, /Net quantity not supplied/);
    assert.doesNotMatch(food(root).textContent!, /250 g net|999|72\.00|500 g net/);
    assert.equal(purchase(root).disabled, false);
    choose(root, 'भाषा', 'English');
    assert.equal(food(root).dataset.selectionState, 'unknown');
    assert.equal(food(root).dataset.variantId, '');
    assert.match(food(root).textContent!, /No variant matches/);
    assert.equal(purchase(root).disabled, true);
    choose(root, 'Pack size', '750 g');
    choose(root, 'भाषा', 'हिन्दी');
    assert.equal(food(root).dataset.variantId, ids[2]);
    assert.match(food(root).textContent!, /Unavailable pack — unavailable/);
    assert.match(food(root).textContent!, /750 g net per pack/);
    assert.doesNotMatch(food(root).textContent!, /250 g net per pack|total net contents/);
    assert.equal(purchase(root).disabled, true);
    const picker = root.querySelector<HTMLElement>('lb-variant-picker')!;
    picker.querySelectorAll('[aria-pressed]').forEach(element => element.setAttribute('aria-pressed', 'false'));
    picker.querySelectorAll('input[type=hidden]').forEach(element => element.remove());
    picker.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(food(root).dataset.selectionState, 'incomplete');
    assert.doesNotMatch(food(root).textContent!, /750 g|72\.00/);
    assert.equal(root.querySelectorAll('.pn-pack-options li').length, 3);
    clear();
});
test('unvarianted contents initialize per-pack/unit value and quantity context without a fabricated variant', async () => {
    await ready();
    clear();
    const model = foodModel();
    model.variants = [];
    model.variantOptions = [];
    model.food = readProductNicheFacts({ food: { netQuantity: { value: 1000, unit: 'g' } } }).food;
    model.price = 220;
    document.body.innerHTML = await render(model, 'plain');
    const root = section('plain');
    assert.match(food(root).textContent!, /1000 g net per pack/);
    assert.match(food(root).textContent!, /22\.00 \/ 100 g/);
    quantity(root, '2');
    assert.match(food(root).textContent!, /2 sellable packs · 2000 g total/);
    quantity(root, '1000');
    assert.match(food(root).textContent!, /Enter a whole pack count/);
    assert.equal(food(root).dataset.variantId, '');
    clear();
});
test('selected furniture/sports/toy/book measurements retain resolved whole-group overrides and hostile text stays inert', async () => {
    await ready();
    clear();
    const model = foodModel(), hostile = '<img src=x onerror="attack()">';
    Object.assign(model, readProductNicheFacts({ furniture: { package: { width: 72, depth: 82, height: 78, unit: 'cm' } }, sports: { activity: 'badminton', equipmentType: 'racket', dimensions: { length: 70, width: 24, height: 3, unit: 'cm' } }, toys: { ageBands: ['6-8'], ageStatement: 'Old age', contents: [{ label: 'Cards', quantity: 15 }], contentsComplete: true, dimensions: { length: 30, width: 20, height: 10, unit: 'cm' } }, books: { kind: 'book', language: 'English', format: 'paperback', dimensions_mm: { width: 120, height: 180 } } }));
    model.variants![0].metadata = { furniture: { package: { width: 30, unit: 'in' } }, sports: { dimensions: { length: 28, width: 10, unit: 'in' } }, toys: { ageBands: ['9-12'], contents: [], dimensions: { width: 4, unit: 'mm' }, materials: hostile }, books: { kind: 'book', language: 'हिन्दी', format: 'hardback', dimensions_mm: { width: 156, height: 234 } } };
    document.body.innerHTML = await render(model, 'groups', 'letbuyy-core');
    const root = section('groups');
    choose(root, 'Pack size', '250 g');
    choose(root, 'भाषा', 'हिन्दी');
    const current = root.querySelector<HTMLElement>('[data-lb-selected-variant-facts]')!;
    assert.ok(current, 'Native picker must mount selected facts through the real sanitized carrier');
    assert.equal(current.dataset.variantId, ids[0]);
    const text = current.textContent!;
    assert.match(text, /30 W in/);
    assert.doesNotMatch(text, /82|78 H|72 W/);
    assert.match(text, /28 × 10 in/);
    assert.doesNotMatch(text, /70 × 24|Old age|15 × Cards|30 length/);
    assert.match(text, /Ages 9–12/);
    assert.match(text, /4 width mm/);
    assert.match(text, /156 × 234 mm/);
    assert.match(text, /हिन्दी/);
    assert.ok(text.includes(hostile));
    assert.equal(current.querySelector('img,script,[onerror]'), null);
    choose(root, 'भाषा', 'English');
    assert.doesNotMatch(current.textContent!, /30 W in|28 × 10 in|156 × 234/);
    assert.match(current.textContent!, /No variant matches/);
    clear();
});
test('actual Habitat hook restores common facts for incomplete/unknown options and shows exact unavailable finish facts', async () => {
    await ready();
    clear();
    const model = foodModel();
    Object.assign(model, readProductNicheFacts({ furniture: { package: { width: 72, depth: 82, height: 78, unit: 'cm' }, materials: ['Common oak'] } }));
    model.variants![0].metadata = { furniture: { package: { width: 30, unit: 'in' }, materials: ['Birch'] } };
    model.variants![2].metadata = { furniture: { package: { width: 40, unit: 'mm' } } };
    document.body.innerHTML = await render(model, 'habitat', 'letbuyy-craft');
    const root = section('habitat'), panel = root.querySelector<HTMLElement>('[data-lb-variant-facts][data-lb-facts-namespace="furniture"]')!;
    assert.ok(panel);
    const field = (name: string) => panel.querySelector(`[data-lb-furniture-field="${name}"]`)!.textContent;
    assert.equal(panel.dataset.lbVariantFactsState, 'common');
    assert.match(field('package')!, /72 W × 82 D × 78 H cm/);
    choose(root, 'Pack size', '250 g');
    choose(root, 'भाषा', 'हिन्दी');
    assert.equal(panel.dataset.lbVariantFactsState, 'selected');
    assert.equal(panel.dataset.variantId, ids[0]);
    assert.equal(field('package'), '30 W in');
    assert.equal(field('materials'), 'Birch');
    choose(root, 'भाषा', 'English');
    assert.equal(panel.dataset.lbVariantFactsState, 'common');
    assert.match(field('package')!, /72 W × 82 D × 78 H cm/);
    assert.match(panel.textContent!, /No variant matches/);
    choose(root, 'Pack size', '750 g');
    choose(root, 'भाषा', 'हिन्दी');
    assert.equal(panel.dataset.lbVariantFactsState, 'unavailable');
    assert.equal(field('package'), '40 W mm');
    assert.match(panel.textContent!, /Unavailable pack — unavailable/);
    assert.equal(purchase(root).disabled, true);
    clear();
});
test('disconnect restores no-JS fallback and removes listeners; reconnect initializes retained selected UUID once', async () => {
    await ready();
    clear();
    document.body.innerHTML = await render(foodModel(), 'reconnect');
    const root = section('reconnect');
    choose(root, 'Pack size', '250 g');
    choose(root, 'भाषा', 'हिन्दी');
    quantity(root, '2');
    assert.match(food(root).textContent!, /500 g total/);
    for (let cycle = 0; cycle < 2; cycle++) {
        root.remove();
        assert.equal(root.querySelector('[data-lb-current-food]'), null);
        assert.equal(root.querySelector<HTMLElement>('[data-lb-food-presentation]')!.children[0].hasAttribute('hidden'), false);
        quantity(root, '3');
        assert.equal(root.querySelector('[data-lb-current-food]'), null);
        document.body.append(root);
        assert.equal(root.querySelectorAll('[data-lb-current-food]').length, 1);
        assert.equal(food(root).dataset.variantId, ids[0]);
        assert.match(food(root).textContent!, /3 sellable packs · 750 g total/);
    }
    clear();
    const model=foodModel();
    Object.assign(model,readProductNicheFacts({furniture:{package:{width:72,unit:'cm'}}}));
    const detached=document.createElement('div');
    detached.innerHTML=await render(model,'provided-host','letbuyy-core');
    const provided=detached.querySelector<HTMLElement>('[data-section-id="provided-host"]')!;
    const host=document.createElement('section');host.setAttribute('data-lb-selected-variant-facts','');host.dataset.productId=model.id;host.textContent='Original common reference';provided.querySelector('lb-variant-picker')!.after(host);
    document.body.append(detached);choose(provided,'Pack size','250 g');choose(provided,'भाषा','हिन्दी');assert.equal(host.dataset.variantId,ids[0]);provided.remove();assert.equal(host.textContent,'Original common reference');assert.equal(host.hasAttribute('data-variant-id'),false);assert.equal(host.hasAttribute('data-selection-state'),false);
    clear();
});
test('fact carrier is inert, strict and bounded; invalid facts never discard a valid picker UUID/options', () => {
    const encoded = encodeVariantFactPresentation({ furniture_display: { materials: '<oak & birch>', privateCost: 'SECRET' }, metadata: { secret: 'PRIVATE' }, food: { netQuantityValue: 250, netQuantityUnit: 'g', unitPriceMinor: 7200 } })!;
    assert.ok(encoded);
    assert.doesNotMatch(encoded, /[<>&]|SECRET|PRIVATE|metadata|privateCost/);
    assert.equal(parseVariantFactPresentation(encoded)!.furniture!.materials, '<oak & birch>');
    for (const value of ['bad', '[]', '{"metadata":{"secret":"PRIVATE"}}', '{"food":{"netQuantityValue":250,"netQuantityUnit":"kg","basisQuantity":100}}', '{"food":{"netQuantityValue":250,"netQuantityUnit":"g","basisQuantity":1}}', 'x'.repeat(32769)])
        assert.equal(parseVariantFactPresentation(value), null);
    const [variant] = parsePickerVariants(JSON.stringify([{ id: ids[0], options_json: '{"Pack size":"250 g"}', stock: 3, facts_json: 'bad' }]));
    assert.equal(variant.id, ids[0]);
    assert.equal(variant.options!['Pack size'], '250 g');
    assert.equal(variant.factPresentation, undefined);
    let invoked = false;
    const accessor = Object.defineProperty({}, 'furniture_display', { get() { invoked = true; return { materials: 'SECRET' }; } });
    assert.equal(encodeVariantFactPresentation(accessor), undefined);
    assert.equal(invoked, false);
});
test('mapper bounds aggregate display facts and excludes all private variant fields', () => {
    const model = foodModel();
    Object.assign(model, readProductNicheFacts({ furniture: { care: 'x'.repeat(2000) } }));
    model.variants = Array.from({ length: 100 }, (_, index) => ({ id: `synthetic-${index}`, title: 'Synthetic', options: { 'Pack size': String(index) }, stock: 2, metadata: { furniture: { care: 'x'.repeat(2000) } }, sku: 'PRIVATE_SKU', private_cost: 'PRIVATE_COST' }));
    const drop = productToLiquidDrop(model)!, variants = drop.variants as Array<Record<string, unknown>>;
    const total = [drop, ...variants].reduce((sum, row) => sum + (typeof row.facts_json === 'string' ? new TextEncoder().encode(row.facts_json).byteLength : 0), 0);
    assert.ok(total <= MAX_PRODUCT_FACT_CARRIER_BYTES);
    assert.ok(variants.some(row => row.facts_json === undefined));
    assert.doesNotMatch(JSON.stringify(drop), /PRIVATE_SKU|PRIVATE_COST|private_cost/);
});
