import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createLetbuyyCoreLiquidThemeBundleFixture, DEFAULT_THEME_SETTINGS, LiquidRenderer } from '@letbuyy/theme-engine';
import type { ProductModel } from '@letbuyy/commerce-core';
import { productToLiquidDrop } from './product-liquid-drop';
import { encodeVariantOptions, parsePickerVariants } from './variant-options-carrier';

const QaDom = JSDOM as unknown as new (html: string, options: { url: string }) => { window: Window & typeof globalThis };

test('bounded option carrier preserves spaces, Unicode and prototype-like labels as inert own data', () => {
    const input = JSON.parse('{"Pack size":"250 g","भाषा":"हिन्दी","__proto__":"literal","Finish":"<plain & text>"}');
    const encoded = encodeVariantOptions(input)!;
    assert.doesNotMatch(encoded, /[<>&]/);
    const [variant] = parsePickerVariants(JSON.stringify([{ id: 'canonical-id', options_json: encoded, options: {} }]));
    assert.equal(variant.options!['Pack size'], '250 g');
    assert.equal(variant.options!['भाषा'], 'हिन्दी');
    assert.equal(variant.options!['__proto__'], 'literal');
    assert.equal(Object.getPrototypeOf(variant.options), null);
    assert.equal(variant.options!.Finish, '<plain & text>');
});

test('malformed, oversized or accessor options fail closed; valid legacy carriers retain compatibility', () => {
    let invoked = false;
    const accessor = Object.defineProperty({}, 'Pack', { enumerable: true, get() { invoked = true; return 'bad'; } });
    assert.equal(encodeVariantOptions(accessor), undefined); assert.equal(invoked, false);
    for (const options_json of ['bad', '[]', '{"Pack":1}', 'x'.repeat(16385)]) {
        assert.deepEqual(parsePickerVariants(JSON.stringify([{ id: 'id', options_json, options: { Pack: 'fallback must not override bad carrier' } }])), []);
    }
    assert.deepEqual(parsePickerVariants('{}'), []);
    assert.deepEqual(parsePickerVariants('x'.repeat(1_048_577)), []);
    assert.equal(parsePickerVariants(JSON.stringify([{ id: 'legacy-id', options: { Size: 'M' }, stock: 2 }]))[0].options!.Size, 'M');
});

test('actual Liquid depth/key scrub retains option labels and the real picker resolves availability', async () => {
    const product: ProductModel = {
        id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic pack', description: '', price: 180, stock: 3, currency: 'INR', images: [],
        variantOptions: [{ name: 'Pack size', values: ['250 g', '500 g'] }, { name: 'भाषा', values: ['हिन्दी'] }],
        variants: [
            { id: '22222222-2222-4222-8222-222222222222', price: 180, stock: 3, options: { 'Pack size': '250 g', भाषा: 'हिन्दी' } },
            { id: '33333333-3333-4333-8333-333333333333', price: 340, stock: 0, options: { 'Pack size': '500 g', भाषा: 'हिन्दी' } },
        ],
    };
    const result = await new LiquidRenderer().render({
        context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'options-test', path: '/product/synthetic', previewMode: false, locale: 'en-IN' },
        storeTemplate: { themeId: 'letbuyy-core', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: 'product', type: 'product', layoutKey: 'theme', sections: [] },
        liquidBundle: createLetbuyyCoreLiquidThemeBundleFixture(), liquidTemplateKey: 'product',
        liquidContext: { product: productToLiquidDrop(product)! },
    });
    assert.equal(result.status, 'rendered', JSON.stringify(result.warnings));
    const dom = new QaDom(`<!doctype html><body>${result.liquid!.contentForLayout}</body>`, { url: 'http://localhost/store/options-test' });
    Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent });
    Object.defineProperty(globalThis, 'CSS', { configurable: true, value: { escape: (value: string) => value.replace(/["\\]/g, '\\$&') } });
    const { registerLiquidHydrationIslands } = await import('./liquid-hydration-islands');
    registerLiquidHydrationIslands();
    const originalFetch = globalThis.fetch;
    const writes: Array<{ lines: Array<{ variant_id: string; quantity: number; properties: Record<string, string> }> }> = [];
    globalThis.fetch = (async (_url, init) => {
        const body = JSON.parse(String(init?.body)); writes.push(body);
        return new Response(JSON.stringify({ success: true, data: {
            cart_token: 'synthetic-options-cart', currency: 'INR', subtotal: 180, total: 180,
            discount_total: 0, tax_total: 0, shipping_total: 0, coupon_codes: [],
            lines: body.lines.map((line: object) => ({ ...line, title: 'Synthetic pack', unit_price: 180, currency: 'INR' })),
        } }), { headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
        const picker = document.querySelector<HTMLElement>('lb-variant-picker')!;
        const rows = parsePickerVariants(picker.dataset.variants);
        assert.equal(rows[0].options!['Pack size'], '250 g');
        assert.equal(rows[0].options!['भाषा'], 'हिन्दी');
        const button = document.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!;
        assert.equal(button.disabled, true);
        const choose = (name: string, value: string) => {
            const option = [...picker.querySelectorAll<HTMLButtonElement>('[data-lb-variant-option]')].find(item => item.dataset.variantName === name && item.dataset.variantValue === value);
            assert.ok(option); option.click();
        };
        choose('Pack size', '250 g'); choose('भाषा', 'हिन्दी');
        assert.equal(button.disabled, false);
        button.click();
        for (let attempt = 0; attempt < 20 && !writes.length; attempt++) await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(writes.length, 1);
        assert.equal(writes[0].lines[0].variant_id, product.variants![0].id);
        assert.equal(writes[0].lines[0].properties['Pack size'], '250 g');
        assert.equal(writes[0].lines[0].properties['भाषा'], 'हिन्दी');
        choose('Pack size', '500 g'); assert.equal(button.disabled, true);
        assert.match(picker.textContent!, /currently unavailable/);
        const section = picker.closest<HTMLElement>('[data-section-id]')!;
        section.dataset.inventoryKnown = 'false';
        choose('Pack size', '250 g');
        assert.equal(button.disabled, true, 'positive variant cache cannot override unknown authoritative inventory');
        assert.match(picker.textContent!, /Stock unavailable/);
        button.disabled = false; button.click();
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(writes.length, 1, 'stale enabled controls cannot submit an unknown-stock variant');
    } finally { globalThis.fetch = originalFetch; window.localStorage.clear(); document.body.replaceChildren(); dom.window.close(); }
});
