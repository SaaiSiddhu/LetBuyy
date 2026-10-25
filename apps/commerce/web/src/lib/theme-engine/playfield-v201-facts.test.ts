import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { JSDOM } from 'jsdom';
import { createFirstPartyCatalogBundle, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import { resolveToyFacts, ToyFactsSchema, type ProductModel, type ToyVariantFacts } from '@letbuyy/commerce-core';
import { productToLiquidDrop } from './product-liquid-drop';
import { VariantFactsController } from './variant-facts-controller';
import { encodeResolvedToyFacts, parseResolvedToyFacts, parsePickerVariants, MAX_PRODUCT_FACT_CARRIER_BYTES, MAX_VARIANT_FACT_CARRIER_BYTES } from './variant-options-carrier';

// Synthetic source-test identities only; none are installed fixture readbacks.
const productId = '11111111-1111-4111-8111-111111111111';
const ids = ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
const common = ToyFactsSchema.parse({ ageBands: ['6-8'], ageStatement: '6–8 years', interests: ['art'], contents: [{ label: 'tiles', quantity: 12 }, { label: 'idea cards', quantity: 2 }, { label: 'tray', quantity: 1 }], contentsComplete: true, dimensions: { label: 'Tray', length: 24, width: 19, height: 1.5, unit: 'cm' }, additionalDimensions: [{ label: 'Each tile', length: 5, width: 5, height: 0.6, unit: 'cm' }], materials: 'Wood', warnings: [{ text: 'Read the sample kit information.', sourceLabel: 'Fictional integration fixture' }] });
const overrides: ToyVariantFacts[] = [
    { finish: 'Sample blue finish' },
    { ageBands: [], ageStatement: '', contents: [], contentsComplete: false, dimensions: null, additionalDimensions: [], warnings: [] },
    { ageBands: ['9-12'], contents: [{ label: 'paper sheets', quantity: 36 }], contentsComplete: true, dimensions: { label: 'A5 sheet', length: 21, width: 14.8, unit: 'cm' }, additionalDimensions: [], materials: 'Paper', warnings: [] },
];
function model(id = productId): ProductModel {
    return { id, name: 'Source-only Playfield activity kit', description: '', price: 480, currency: 'INR', stock: 8, images: [], toys: common, variantOptions: [{ name: 'Edition', values: ['Inherited', 'Unknown facts', 'Paper'] }], variants: overrides.map((toys, index) => ({ id: ids[index], name: ['Inherited', 'Unknown facts', 'Paper'][index], options: { Edition: ['Inherited', 'Unknown facts', 'Paper'][index] }, price: 480, stock: [4, 2, 3][index], metadata: { toys } })) };
}
const QaDom = JSDOM as unknown as new (html: string, options: { url: string }) => { window: Window & typeof globalThis & { close(): void } };
const dom = new QaDom('<!doctype html><body></body>', { url: 'https://source.example.invalid/store/playfield' });
const names = ['window', 'document', 'HTMLElement', 'Element', 'CustomEvent', 'CSS'];
const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent });
Object.defineProperty(globalThis, 'CSS', { configurable: true, value: { escape: (value: string) => value.replace(/["\\]/g, '\\$&') } });
let registered: Promise<void> | undefined;
const ready = () => registered ??= import('./liquid-hydration-islands').then(module => module.registerLiquidHydrationIslands());
after(() => {
    document.body.replaceChildren(); dom.window.close();
    for (const name of names) { const descriptor = previous.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
});
async function render(product = model(), sectionId = 'toys', enabled = true, old = false) {
    const bundle = createFirstPartyCatalogBundle('letbuyy-bloom', { designVersion: '2.0.0', ...(old ? {} : { playfieldVersion: '2.0.1' as const }) });
    const original = bundle.templates.product;
    const key = original.order.find(id => original.sections[id].type === 'product-detail')!;
    bundle.templates.product = { ...original, sections: { [sectionId]: { ...original.sections[key], settings: { ...original.sections[key].settings, showToyFacts: enabled } } }, order: [sectionId] };
    const result = await new LiquidRenderer().render({ context: { storeId: productId, subdomain: 'playfield-source', path: '/product/' + product.id, previewMode: false, locale: 'en-IN' }, storeTemplate: { themeId: 'letbuyy-bloom', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] }, routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] }, liquidBundle: bundle, liquidTemplateKey: 'product', liquidContext: { product: productToLiquidDrop(product)! } });
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings)); assert.deepEqual(result.warnings, []);
    return result.liquid!.contentForLayout;
}
const root = (id = 'toys') => document.querySelector<HTMLElement>(`[data-section-id="${id}"]`)!;
const field = (element: HTMLElement, key: string) => element.querySelector<HTMLElement>(`[data-lb-toy-field="${key}"]`)!;
function choose(element: HTMLElement, edition: string) {
    const button = [...element.querySelectorAll<HTMLButtonElement>('[data-lb-variant-option]')].find(item => item.dataset.variantValue === edition);
    assert.ok(button); button.click();
}
const purchase = (element: HTMLElement) => element.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!;
const text = (element: HTMLElement) => element.textContent!;
function reset() { document.body.replaceChildren(); window.localStorage.clear(); }

test('structured public carrier uses canonical whole-group resolution, explicit clears and exact owned UUIDs', () => {
    const drop = productToLiquidDrop(model())!;
    const variants = parsePickerVariants(JSON.stringify(drop.variants));
    assert.deepEqual(variants.map(row => row.id), ids);
    for (let index = 0; index < variants.length; index++) assert.deepEqual(variants[index].resolvedToyFacts, resolveToyFacts(common, overrides[index]));
    assert.equal(variants[1].resolvedToyFacts!.materials, 'Wood');
    assert.equal(variants[1].resolvedToyFacts!.dimensions, null);
    assert.equal(variants[2].resolvedToyFacts!.dimensions!.height, undefined);
    assert.equal(variants[2].resolvedToyFacts!.ageStatement, undefined);
    assert.deepEqual(variants[2].resolvedToyFacts!.warnings, []);
    assert.equal((drop.variants as Array<{ toys?: { materials?: string } }>)[0].toys?.materials, undefined, 'raw partial is not relabeled resolved');
});

test('real 2.0.1 Liquid SSR does not show common facts as an unselected edition; old 2.0.0 remains reproducible', async () => {
    const html = await render();
    const source = new QaDom(html, { url: 'https://source.example.invalid' });
    try {
        const section = source.window.document.querySelector<HTMLElement>('[data-lb-toy-presentation]')!;
        assert.ok(section); assert.equal(section.dataset.productId, productId);
        assert.match(text(section), /Choose all options/);
        assert.doesNotMatch(text(section), /15 items|Wood|6–8 years|Read the sample kit|Length 24/);
        assert.equal(section.querySelector<HTMLElement>('[data-lb-toy-warnings]')!.hidden, true);
        const link = section.querySelector<HTMLAnchorElement>('.pf-product-quick a')!;
        assert.equal(link.hash, '#playfield-product-facts-toys');
        assert.ok(section.querySelector(link.hash));
    } finally { source.window.close(); }
    const old = new QaDom(await render(model(), 'old', true, true), { url: 'https://source.example.invalid' });
    try { assert.match(old.window.document.body.textContent!, /15 items in total/); assert.equal(old.window.document.querySelector('[data-lb-toy-presentation]'), null); } finally { old.window.close(); }
});

test('actual mapper → Liquid → native picker updates every declared consumer Inherited → Unknown → Paper → Inherited', async () => {
    await ready(); reset(); document.body.innerHTML = await render(); const section = root();
    const originalFetch = globalThis.fetch; let calls = 0;
    globalThis.fetch = (async () => { calls++; throw new Error('Facts may not fetch'); }) as typeof fetch;
    try {
        assert.equal(purchase(section).disabled, true);
        for (const [edition, id] of [['Inherited', ids[0]], ['Unknown facts', ids[1]], ['Paper', ids[2]], ['Inherited', ids[0]]]) {
            choose(section, edition);
            assert.equal(purchase(section).disabled, false);
            for (const target of [section, ...section.querySelectorAll<HTMLElement>('[data-lb-toy-field="age"],[data-lb-toy-warnings],[data-lb-toy-contents],[data-lb-toy-details],[data-lb-toy-status]')]) assert.equal(target.dataset.variantId, id);
            const content = text(section);
            if (edition === 'Inherited') {
                assert.match(content, /15 items in total/); assert.match(content, /Sample blue finish/); assert.match(content, /Source: Fictional integration fixture/); assert.match(content, /Length 24 cm · Width 19 cm · Height 1.5 cm/);
                assert.equal(section.querySelectorAll('.pf-contents li').length, 3);
            } else if (edition === 'Unknown facts') {
                assert.equal(field(section, 'materials').textContent, 'Wood');
                assert.match(content, /Contents have not been supplied/);
                assert.doesNotMatch(content, /6–8|15 items|tiles|Length 24|Each tile|Sample blue|Read the sample kit/);
            } else {
                assert.equal(field(section, 'materials').textContent, 'Paper');
                assert.match(field(section, 'age').textContent!, /9–12/);
                assert.match(content, /36 items in total/); assert.match(content, /paper sheets/); assert.match(content, /Length 21 cm · Width 14.8 cm/);
                assert.doesNotMatch(content, /6–8|15 items|Wood|Height|Each tile|Sample blue|Read the sample kit/);
            }
            assert.equal(section.querySelector('[data-lb-selected-variant-facts]'), null, 'no duplicate generic toy renderer');
        }
        assert.equal(calls, 0);
    } finally { globalThis.fetch = originalFetch; reset(); }
});

test('explicit materials empty and replacement partial contents never resurrect inherited Wood or completeness', async () => {
    await ready(); reset(); const product = model();
    product.variants![1].metadata = { toys: { ...overrides[1], materials: '', contents: [{ label: 'sample card', quantity: 1 }] } };
    document.body.innerHTML = await render(product); const section = root(); choose(section, 'Inherited'); choose(section, 'Unknown facts');
    assert.equal(field(section, 'materials').textContent, 'Not supplied.');
    assert.match(text(section), /partial contents list/); assert.doesNotMatch(text(section), /Wood|15 items|1 items in total|Sample blue/);
    reset();
});

test('unavailable, nonexistent and incomplete native selections remove prior facts and retain Add authority', async () => {
    await ready(); reset(); const product = model(); product.variants![2].stock = 0;
    product.variantOptions![0].values.push('No matching test combination');
    document.body.innerHTML = await render(product); const section = root();
    choose(section, 'Inherited'); choose(section, 'Paper');
    assert.equal(section.dataset.selectionState, 'unavailable'); assert.equal(purchase(section).disabled, true);
    assert.match(text(section), /36 items in total/); assert.match(text(section), /Purchase is unavailable/);
    choose(section, 'No matching test combination');
    assert.equal(section.dataset.selectionState, 'unknown'); assert.equal(purchase(section).disabled, true);
    assert.doesNotMatch(text(section), /36 items|paper sheets|Wood|Read the sample kit/);
    const picker = section.querySelector<HTMLElement>('lb-variant-picker')!;
    picker.querySelectorAll('[aria-pressed]').forEach(element => element.setAttribute('aria-pressed', 'false'));
    picker.querySelectorAll('input[type=hidden]').forEach(element => element.remove());
    picker.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(section.dataset.selectionState, 'incomplete'); assert.equal(purchase(section).disabled, true);
    assert.match(text(section), /Choose all options/); reset();
});

test('product-only actual Add island initializes validated common facts; setting off creates no presentation or generic fallback', async () => {
    await ready(); reset(); const product = model(); product.variants = []; product.variantOptions = [];
    document.body.innerHTML = await render(product);
    assert.equal(root().dataset.selectionState, 'product'); assert.match(text(root()), /15 items in total/); assert.equal(field(root(), 'materials').textContent, 'Wood');
    assert.equal(root().dataset.variantId, '');
    reset(); document.body.innerHTML = await render(model(), 'off', false); const section = root('off'); choose(section, 'Paper');
    assert.equal(purchase(section).disabled, false); assert.equal(section.querySelector('[data-lb-selected-variant-facts]'), null);
    assert.equal(section.querySelector('[data-lb-toy-field],[data-lb-toy-contents],[data-lb-toy-warnings]'), null);
    assert.doesNotMatch(text(section), /Wood|paper sheets|15 items|Read the sample kit/); reset();
});

test('declared targets scope by actual product/section, dispose restores original nodes and reconnect renders once', async () => {
    await ready(); reset();
    const template = document.createElement('template'); template.innerHTML = await render(model(), 'a');
    const first = template.content.querySelector<HTMLElement>('[data-section-id="a"]')!;
    const original = [...first.querySelectorAll<HTMLElement>('[data-lb-toy-field="age"],[data-lb-toy-contents],[data-lb-toy-warnings],[data-lb-toy-details],[data-lb-toy-status]')].map(element => ({ element, children: [...element.childNodes], hidden: element.getAttribute('hidden') }));
    document.body.append(template.content);
    document.body.insertAdjacentHTML('beforeend', await render(model('99999999-9999-4999-8999-999999999999'), 'b'));
    const second = root('b'); choose(first, 'Inherited');
    assert.equal(second.dataset.variantId, ''); assert.doesNotMatch(text(second), /15 items|Wood|Sample blue/);
    const foreign = document.createElement('section'); foreign.dataset.sectionId = 'foreign'; foreign.innerHTML = '<p data-lb-toy-field="age">Foreign facts unchanged</p>'; first.append(foreign);
    choose(first, 'Paper'); assert.equal(foreign.textContent, 'Foreign facts unchanged');
    first.remove();
    for (const item of original) { assert.deepEqual([...item.element.childNodes], item.children); assert.equal(item.element.getAttribute('hidden'), item.hidden); }
    assert.equal(first.hasAttribute('data-variant-id'), false);
    document.body.append(first); assert.equal(first.dataset.variantId, ids[2]); assert.equal(first.querySelectorAll('.pf-contents').length, 1);
    assert.match(text(first), /36 items in total/); reset();
});

test('warning attribution, content labels and materials remain inert text through actual Liquid and hydration', async () => {
    await ready(); reset(); const hostile = '<img src=x onerror="attack()">'; const product = model();
    product.variants![2].metadata = { toys: { ...overrides[2], materials: hostile, warnings: [{ text: hostile, sourceLabel: 'Fictional <script>source</script>', editionLabel: '<b>edition</b>' }], contents: [{ label: hostile, quantity: 2 }] } };
    document.body.innerHTML = await render(product); const section = root(); choose(section, 'Paper');
    assert.ok(text(section).includes(hostile)); assert.match(text(section), /Source: Fictional <script>source<\/script> · <b>edition<\/b>/);
    assert.equal(section.querySelector('script,[onerror],img[src="x"],b'), null); reset();
});

test('structured facts reject private/invalid/accessor/sparse data and preserve valid picker IDs when unavailable', () => {
    const encoded = encodeResolvedToyFacts(common)!; assert.deepEqual(parseResolvedToyFacts(encoded), common);
    for (const value of ['bad', '[]', '{"privateCost":"PRIVATE"}', 'x'.repeat(32769), '{"contentsComplete":true,"contents":[]}']) assert.equal(parseResolvedToyFacts(value), null);
    let invoked = false; const nested = { ...common, contents: [Object.defineProperty({ quantity: 1 }, 'label', { enumerable: true, get() { invoked = true; return 'PRIVATE'; } })] };
    assert.equal(encodeResolvedToyFacts(nested), undefined); assert.equal(invoked, false);
    assert.equal(encodeResolvedToyFacts({ ...common, privateCost: 'PRIVATE' }), undefined);
    assert.equal(encodeResolvedToyFacts({ ...common, contents: new Array(2) }), undefined);
    const [variant] = parsePickerVariants(JSON.stringify([{ id: ids[0], options_json: '{"Edition":"Inherited"}', toys_resolved_json: 'bad' }]));
    assert.equal(variant.id, ids[0]); assert.equal(variant.options!.Edition, 'Inherited'); assert.equal(variant.resolvedToyFacts, undefined);
    const largeFlat = JSON.stringify({ toys: { warnings: 'x'.repeat(12000), contents: 'x'.repeat(12000) } });
    const [bounded] = parsePickerVariants(JSON.stringify([{ id: ids[0], options_json: '{}', facts_json: largeFlat, toys_resolved_json: encodeResolvedToyFacts({ ...common, care: 'x'.repeat(2000), warnings: Array.from({ length: 5 }, () => ({ text: 'x'.repeat(2000), sourceLabel: 'test' })) }) }]));
    assert.ok(bounded.factPresentation); assert.equal(bounded.resolvedToyFacts, undefined);
});

test('a foreign UUID or foreign presentation root cannot acquire another product selection', () => {
    reset(); const section = document.createElement('section'); section.dataset.sectionId = 'direct';
    section.dataset.productId = productId; section.dataset.lbFactsNamespace = 'toys'; section.dataset.lbToyPresentation = '1'; section.dataset.lbToyFactsEnabled = 'true'; section.setAttribute('data-lb-variant-facts', '');
    section.innerHTML = '<p data-lb-toy-field="age">Original age choice</p><div data-lb-toy-contents></div><dl data-lb-toy-details></dl><p data-lb-toy-status></p>';
    const variants = parsePickerVariants(JSON.stringify(productToLiquidDrop(model())!.variants));
    const controller = new VariantFactsController(section, productId, 'INR', variants);
    controller.update(variants[0], 'selected'); assert.match(text(section), /15 items in total/);
    controller.update({ ...variants[0], id: 'foreign-source-test-id' }, 'selected');
    assert.equal(section.dataset.selectionState, 'unknown'); assert.equal(section.dataset.variantId, ''); assert.doesNotMatch(text(section), /Wood|15 items|6–8/);
    controller.dispose(); assert.equal(field(section, 'age').textContent, 'Original age choice');
    section.dataset.productId = '99999999-9999-4999-8999-999999999999';
    const foreign = new VariantFactsController(section, productId, 'INR', variants); foreign.update(variants[0], 'selected');
    assert.equal(field(section, 'age').textContent, 'Original age choice'); foreign.dispose(); reset();
});

test('unknown product-only SSR and hydrated facts retain honest absence without an empty warning claim', async () => {
    await ready(); reset(); const product = model(); product.variants = []; product.variantOptions = []; product.toys = undefined;
    const html = await render(product);
    const source = new QaDom(html, { url: 'https://source.example.invalid' });
    try { assert.equal(source.window.document.querySelector<HTMLElement>('[data-lb-toy-warnings]')!.hidden, true); assert.doesNotMatch(source.window.document.body.textContent!, /Wood|15 items|safe|certified/); } finally { source.window.close(); }
    document.body.innerHTML = html;
    assert.equal(root().querySelector<HTMLElement>('[data-lb-toy-warnings]')!.hidden, true);
    assert.doesNotMatch(text(root()), /Wood|15 items|safe|certified/); reset();
});

test('existing flat facts keep their reservation; combined structured+flat per-row/aggregate budgets do not increase', () => {
    const product = model(); product.variants = Array.from({ length: 100 }, (_, index) => ({ ...product.variants![0], id: `source-test-${index}`, metadata: { toys: { care: 'x'.repeat(1500) } } }));
    const drop = productToLiquidDrop(product)!, rows = [drop, ...(drop.variants as Array<Record<string, unknown>>)];
    let total = 0;
    for (const row of rows) {
        const bytes = ['facts_json','toys_resolved_json'].reduce((sum, key) => sum + (typeof row[key] === 'string' ? new TextEncoder().encode(row[key] as string).byteLength : 0), 0);
        assert.ok(bytes <= MAX_VARIANT_FACT_CARRIER_BYTES); total += bytes;
    }
    assert.ok(total <= MAX_PRODUCT_FACT_CARRIER_BYTES);
    const variants = drop.variants as Array<Record<string, unknown>>;
    assert.ok(variants.some(row => row.facts_json !== undefined && row.toys_resolved_json === undefined));
    assert.ok(variants.some(row => row.facts_json === undefined));
});
