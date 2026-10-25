import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>') as unknown as { window: Window & typeof globalThis; reconfigure(options: { url: string }): void };
dom.reconfigure({ url: 'http://localhost/store/synthetic-threadline/cart' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent });
// jsdom does not implement the native modal lifecycle. These shims cover owned
// focus/update code only; real-browser QA separately verifies Tab/inert/Escape.
Object.defineProperties(dom.window.HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute('open'); } },
});
const tick = () => new Promise(done => setTimeout(done, 0));

test('same-product sizes remain distinguishable and quantity/removal target only the selected variant', async () => {
    const original = globalThis.fetch;
    const writes: Array<{ product_id: string; variant_id: string; quantity: number; properties: Record<string, string> }[]> = [];
    globalThis.fetch = (async (input, init) => {
        if (String(input).endsWith('/checkout-status')) return new Response(JSON.stringify({ success: true, data: { cart_status: 'active', checkout_state: null } }), { headers: { 'Content-Type': 'application/json' } });
        const { lines } = JSON.parse(String(init?.body)) as { lines: typeof writes[number] };
        writes.push(lines);
        return new Response(JSON.stringify({ success: true, data: {
            cart_token: 'synthetic-cart-receipt', currency: 'INR', subtotal: 7470, total: 7470,
            discount_total: 0, shipping_total: 0, tax_total: 0, coupon_codes: [],
            lines: lines.map(line => ({ ...line, title: 'Linen shirt', unit_price: 2490, currency: 'INR' })),
        } }), { headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    window.localStorage.setItem('lb_cart', JSON.stringify(['M', 'L'].map(size => ({ id: 'shirt', variantId: `shirt-${size}`, name: 'Linen shirt', quantity: 1, price: 2490, currency: 'INR', images: [], selectedVariant: { Color: 'Oat', Size: size } }))));
    const { registerLiquidHydrationIslands } = await import('./liquid-hydration-islands');
    registerLiquidHydrationIslands();
    const page = document.createElement('lb-cart'), drawer = document.createElement('lb-cart-drawer');
    document.body.append(page, drawer);
    try {
        await tick(); await tick();
        for (const element of [page, drawer]) {
            assert.match(element.textContent || '', /Color: Oat · Size: M/);
            assert.match(element.textContent || '', /Color: Oat · Size: L/);
            assert.ok(element.querySelector('[aria-label="Remove Linen shirt, Color: Oat · Size: M"]'));
        }
        const increase = page.querySelector<HTMLButtonElement>('[aria-label="Increase quantity of Linen shirt, Color: Oat · Size: M"]');
        assert.ok(increase); increase.click(); await tick(); await tick();
        assert.deepEqual(writes.at(-1)?.map(line => [line.variant_id, line.quantity]), [['shirt-M', 2], ['shirt-L', 1]]);
        const remove = drawer.querySelector<HTMLButtonElement>('[aria-label="Remove Linen shirt, Color: Oat · Size: L"]');
        assert.ok(remove); remove.click(); await tick(); await tick();
        assert.deepEqual(writes.at(-1)?.map(line => [line.variant_id, line.quantity]), [['shirt-M', 2]]);
        assert.doesNotMatch(page.textContent || '', /Size: L/);
        // Cached presentation fields remain text, even before the next server read.
        window.localStorage.setItem('lb_cart', JSON.stringify([{ id: 'shirt', name: 'Linen shirt', variantId: 'shirt-M', quantity: 1, selectedVariant: { Size: '<img src=x onerror=alert(1)>' } }]));
        window.dispatchEvent(new CustomEvent('letbuyy:cart:changed'));
        assert.equal(page.querySelector('img'), null);
        assert.match(page.textContent || '', /<img src=x onerror=alert\(1\)>/);
    } finally {
        page.remove(); drawer.remove(); window.localStorage.clear(); globalThis.fetch = original;
    }
});

test('opening and dismissing the cart transfers focus into the dialog and returns it to its opener', async () => {
    const { registerLiquidHydrationIslands } = await import('./liquid-hydration-islands');
    registerLiquidHydrationIslands();
    const opener = document.createElement('button'); opener.textContent = 'Open cart';
    const drawer = document.createElement('lb-cart-drawer');
    document.body.append(opener, drawer);
    try {
        opener.focus();
        window.dispatchEvent(new CustomEvent('letbuyy:cart:open'));
        const dialog = drawer.querySelector<HTMLElement>('[role="dialog"]');
        const close = drawer.querySelector<HTMLButtonElement>('[data-lb-cart-close]');
        assert.ok(dialog); assert.ok(close);
        assert.equal(document.activeElement, close, 'an open cart must receive useful initial focus');
        const view = drawer.querySelector<HTMLAnchorElement>('[data-lb-cart-focus="view"]');
        assert.ok(view); view.focus();
        window.dispatchEvent(new CustomEvent('letbuyy:cart:changed'));
        assert.equal((document.activeElement as HTMLElement).dataset.lbCartFocus, 'view', 'totals updates preserve the focused action');
        drawer.querySelector('[role="dialog"]')!.dispatchEvent(new window.Event('cancel', { cancelable: true }));
        assert.equal(document.activeElement, opener, 'closing the cart restores the original trigger');
        assert.equal(drawer.querySelector('dialog[open]'), null);
    } finally { drawer.remove(); opener.remove(); }
});
