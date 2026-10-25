import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { furnitureFinishFixture, furnitureUnknownFixture, renderBoundFurniture } from './selected-finish-fixtures';
import type { ProductModel } from '../../../../packages/commerce-core/src/index';

const requireEngine = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url));
type TestWindow = Window & typeof globalThis & { close(): void };
const JSDOM = requireEngine('jsdom').JSDOM as new (html: string, options: { url: string }) => { window: TestWindow };

async function mount(product = furnitureFinishFixture(), foreignPanel = false) {
    const { result } = await renderBoundFurniture(product);
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://habitat-fixture.example.test/product/' + product.id });
    const names = ['window', 'document', 'HTMLElement', 'Element', 'CustomEvent', 'CSS', 'fetch'];
    const previous = Object.fromEntries(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    let networkCalls = 0;
    Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent,
        CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`) },
        fetch: async () => { networkCalls++; throw new Error('No cart/provider/network operation belongs to this facts test'); },
    });
    const source = dom.window.document.createElement('template'); source.innerHTML = result.liquid!.contentForLayout;
    const original = source.content.querySelector<HTMLElement>('.lb-product-detail')!;
    const picker = original.querySelector<HTMLElement>('lb-variant-picker')!;
    const panel = original.querySelector<HTMLElement>('[data-lb-variant-facts]')!;
    const fallback = original.querySelector<HTMLElement>('[data-lb-variant-facts-fallback]')!;
    const root = dom.window.document.createElement('section'); root.setAttribute('data-section-id', original.dataset.sectionId!);
    const price = original.querySelector<HTMLElement>('.lb-product-detail__price-current')!;
    root.append(price, picker);
    let foreign: HTMLElement | null = null;
    if (foreignPanel) {
        foreign = panel.cloneNode(true) as HTMLElement; foreign.dataset.productId = 'foreign-product';
        for (const slot of foreign.querySelectorAll('[data-lb-furniture-field]')) slot.textContent = 'Foreign common baseline';
        root.append(foreign);
    }
    root.append(panel, fallback);
    // Real picker availability updates these native controls. No cart custom
    // element is activated, so this test cannot create a purchase intent.
    const purchase = dom.window.document.createElement('button'); purchase.type = 'button'; purchase.setAttribute('data-lb-add-to-cart', ''); root.append(purchase);
    dom.window.document.body.append(root);
    const file = new URL('../../../../apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx', import.meta.url);
    const requireLocal = createRequire(file), appSrc = new URL('../../../../apps/commerce/web/src/', import.meta.url);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const compiled = { exports: {} };
    new Function('require', 'module', 'exports', code)((id: string) => requireLocal(id.startsWith('@/') ? fileURLToPath(new URL(id.slice(2), appSrc)) : id), compiled, compiled.exports);
    const { registerLiquidHydrationIslands } = compiled.exports as typeof import('../../../../apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands');
    registerLiquidHydrationIslands();
    const choose = (name: string, value: string) => {
        const button = [...picker.querySelectorAll<HTMLButtonElement>('[data-lb-variant-option]')].find(option => option.dataset.variantName === name && option.dataset.variantValue === value);
        assert.ok(button, `${name}: ${value}`); button.click();
    };
    const value = (name: string) => panel.querySelector<HTMLElement>(`[data-lb-furniture-field="${name}"]`)!.textContent;
    return { root, panel, foreign, fallback, picker, purchase, choose, value, networkCalls: () => networkCalls,
        clear: (name: string) => { for (const button of picker.querySelectorAll<HTMLElement>('[data-lb-variant-option]')) if (button.dataset.variantName === name) button.setAttribute('aria-pressed', 'false');
            for (const input of picker.querySelectorAll<HTMLInputElement>('input[type="hidden"]')) if (input.name === `variant[${name}]`) input.remove(); picker.dispatchEvent(new dom.window.Event('change', { bubbles: true })); },
        close: () => { root.remove(); dom.window.close(); for (const name of names) { if (previous[name]) Object.defineProperty(globalThis, name, previous[name]!); else Reflect.deleteProperty(globalThis, name); } },
    };
}

test('real picker/controller switches all resolved furniture fields only after complete selection and keeps sold-out facts truthful', async () => {
    const h = await mount();
    try {
        h.choose('Finish', 'Natural teak');
        assert.equal(h.panel.dataset.lbVariantFactsState, 'common'); assert.equal(h.purchase.disabled, true);
        assert.equal(h.value('assembled'), '68 W × 78 D × 74 H cm');
        h.choose('Size', 'Standard');
        assert.equal(h.panel.dataset.lbVariantFactsState, 'selected'); assert.equal(h.purchase.disabled, false);
        assert.match(h.panel.querySelector('[data-lb-variant-facts-status]')!.textContent!, /Natural teak.*selected/i);
        assert.equal(h.value('package'), '72 W × 82 D × 78 H cm'); assert.equal(h.value('weight'), '13.8 kg');
        h.choose('Finish', 'Smoked teak'); h.choose('Size', 'Compact');
        assert.equal(h.panel.dataset.lbVariantFactsState, 'unavailable'); assert.equal(h.purchase.disabled, true);
        assert.match(h.panel.querySelector('[data-lb-variant-facts-status]')!.textContent!, /Smoked teak.*unavailable/i);
        assert.equal(h.value('assembled'), '27 W in'); assert.equal(h.value('package'), '740 W × 780 H mm');
        assert.equal(h.value('weight'), '14.2 kg'); assert.equal(h.value('materials'), 'Variant-only oak');
        assert.match(h.value('assembly')!, /Assembly required.*Variant assembly instruction.*Supplied hex key/);
        assert.equal(h.value('care'), 'Variant-only care.'); assert.equal(h.value('seat_height'), '38 cm');
        assert.equal(h.fallback.querySelectorAll('[data-lb-variant-facts-row]').length, 2);
        assert.equal(h.networkCalls(), 0);
    } finally { h.close(); }
});

test('unmatched and incomplete choices restore common facts without stale selected measures or cross-product updates', async () => {
    const h = await mount(furnitureFinishFixture(), true);
    try {
        h.choose('Finish', 'Smoked teak'); h.choose('Size', 'Compact'); assert.equal(h.value('assembled'), '27 W in');
        h.choose('Finish', 'Natural teak');
        assert.equal(h.panel.dataset.lbVariantFactsState, 'common'); assert.match(h.panel.querySelector('[data-lb-variant-facts-status]')!.textContent!, /No variant matches.*Common product facts/);
        assert.equal(h.value('assembled'), '68 W × 78 D × 74 H cm'); assert.equal(h.value('package'), '70 W × 80 D × 76 H cm');
        assert.equal(h.value('care'), 'Product common care.'); assert.equal(h.purchase.disabled, true);
        h.clear('Size'); assert.match(h.panel.querySelector('[data-lb-variant-facts-status]')!.textContent!, /Common product facts/);
        assert.equal(h.panel.hasAttribute('data-variant-id'), false);
        for (const slot of h.foreign!.querySelectorAll('[data-lb-furniture-field]')) assert.equal(slot.textContent, 'Foreign common baseline');
        assert.equal(h.networkCalls(), 0);
    } finally { h.close(); }
});

test('matched unknown facts stay explicit and hostile supplied care is rendered as inert text', async () => {
    const unknown = await mount(furnitureUnknownFixture());
    try {
        unknown.choose('Finish', 'Unspecified finish'); assert.equal(unknown.panel.dataset.lbVariantFactsState, 'selected');
        for (const slot of unknown.panel.querySelectorAll('[data-lb-furniture-field]')) assert.match(slot.textContent!, /not supplied/i);
    } finally { unknown.close(); }
    const product: ProductModel = furnitureFinishFixture();
    product.variants![1].furniture!.care = '<img src=x onerror="bad()"><script>bad()</script>';
    const hostile = await mount(product);
    try {
        hostile.choose('Finish', 'Smoked teak'); hostile.choose('Size', 'Compact');
        assert.equal(hostile.value('care'), '<img src=x onerror="bad()"><script>bad()</script>');
        assert.equal(hostile.panel.querySelector('img,script'), null); assert.equal(hostile.networkCalls(), 0);
    } finally { hostile.close(); }
});
