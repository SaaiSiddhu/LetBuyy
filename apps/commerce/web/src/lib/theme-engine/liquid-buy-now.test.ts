import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>') as unknown as {
    window: Window & typeof globalThis;
    reconfigure(options: { url: string }): void;
};
dom.reconfigure({ url: 'https://shop.example.test/product/product-1' });
const navigations: string[] = [];
const location = { pathname: '/product/product-1', hostname: 'shop.example.test', origin: 'https://shop.example.test', search: '',
    assign(value: string) { navigations.push(value); } };
const browserWindow = new Proxy(dom.window, { get(target, key) {
    if (key === 'location') return location;
    const value = Reflect.get(target, key, target);
    return ['dispatchEvent', 'addEventListener', 'removeEventListener', 'setTimeout', 'clearTimeout'].includes(String(key))
        ? value.bind(target) : value;
} });
Object.assign(globalThis, { window: browserWindow, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, CustomEvent: dom.window.CustomEvent });
let registered: Promise<void> | undefined;
const ready = () => registered ??= import('./liquid-hydration-islands').then(module => module.registerLiquidHydrationIslands());
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const serverCart = { cart_token: 'synthetic-cart-token', lines: [{ product_id: 'product-1', title: 'Synthetic product',
    quantity: 1, unit_price: 199, currency: 'INR' }], subtotal: 199, discount_total: 0, shipping_total: 0, tax_total: 0,
    total: 199, coupon_codes: [], currency: 'INR' };
function purchase() {
    document.body.innerHTML = '<lb-add-to-cart data-product-id="product-1" data-product-name="Synthetic product" data-product-price="199" data-product-currency="INR">' +
        '<button type="button" data-lb-buy-now>Buy now</button><span data-lb-add-to-cart-status></span></lb-add-to-cart>';
    return { island: document.querySelector<HTMLElement>('lb-add-to-cart')!, button: document.querySelector<HTMLButtonElement>('button')! };
}
function reset() { document.body.innerHTML = ''; dom.window.localStorage.clear(); navigations.length = 0; location.pathname = '/product/product-1'; }

test('Buy now waits for the canonical cart receipt, coalesces a double click and keeps a storefront-domain checkout path', async () => {
    await ready(); reset();
    const originalFetch = globalThis.fetch;
    let release!: (response: Response) => void;
    let calls = 0, opened = 0;
    const openedCart = () => { opened++; };
    window.addEventListener('letbuyy:cart:open', openedCart);
    globalThis.fetch = (async () => { calls++; return new Promise<Response>(resolve => { release = resolve; }); }) as typeof fetch;
    try {
        const { button } = purchase(); button.click(); button.click();
        assert.deepEqual(navigations, [], 'leaving before the cart receipt loses the pending request');
        assert.equal(calls, 1); assert.equal(opened, 0, 'Buy now must not launch a second drawer cart synchronization');
        assert.equal(JSON.parse(dom.window.localStorage.getItem('lb_cart')!)[0].quantity, 1);
        release(new Response(JSON.stringify({ success: true, data: serverCart }), { status: 200 }));
        await tick();
        assert.equal(dom.window.localStorage.getItem('lb_cart_token'), serverCart.cart_token);
        assert.deepEqual(JSON.parse(dom.window.localStorage.getItem('lb_cart_server')!), serverCart);
        assert.deepEqual(navigations, ['/checkout']);
    } finally { globalThis.fetch = originalFetch; window.removeEventListener('letbuyy:cart:open', openedCart); reset(); }
});

for (const outcome of ['outage', 'missing-token'] as const) {
    test('Buy now stays on the product when the canonical cart reports ' + outcome, async () => {
        await ready(); reset(); const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => outcome === 'outage'
            ? new Response('{}', { status: 503 })
            : new Response(JSON.stringify({ success: true, data: { ...serverCart, cart_token: '' } }), { status: 200 })) as typeof fetch;
        try {
            const { button, island } = purchase(); button.click(); await tick();
            assert.deepEqual(navigations, []);
            assert.equal(dom.window.localStorage.getItem('lb_cart_token'), null);
            assert.match(island.textContent || '', /could not prepare checkout/i);
            assert.equal(button.disabled, false, 'a failed cart synchronization allows a normal retry');
        } finally { globalThis.fetch = originalFetch; reset(); }
    });
}

test('Buy now preserves the explicit path-routed storefront base', async () => {
    await ready(); reset(); const originalFetch = globalThis.fetch;
    location.pathname = '/store/demo/product/product-1';
    globalThis.fetch = (async () => new Response(JSON.stringify({ success: true, data: serverCart }), { status: 200 })) as typeof fetch;
    try {
        const { island, button } = purchase(); island.dataset.basePath = '/store/demo'; button.click(); await tick();
        assert.deepEqual(navigations, ['/store/demo/checkout']);
    } finally { globalThis.fetch = originalFetch; reset(); }
});
