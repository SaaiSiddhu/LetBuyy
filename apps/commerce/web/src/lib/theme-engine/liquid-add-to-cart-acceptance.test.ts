import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { JSDOM } from 'jsdom';
import { StorefrontCartLineInputSchema, type StorefrontCartLineInput } from '@letbuyy/checkout-core';

// Actual native elements and browser transport; every fetch is controlled in
// process. This does not claim browser, inventory, PostgreSQL or order acceptance.
const dom = new JSDOM('<!doctype html><body></body>') as unknown as {
    window: Window & typeof globalThis;
    reconfigure(options: { url: string }): void;
};
dom.reconfigure({ url: 'https://example.invalid/store/circuit/product/hub' });
const navigations: string[] = [];
const location = { pathname: '/store/circuit/product/hub', hostname: 'example.invalid', search: '', origin: 'https://example.invalid',
    assign(value: string) { navigations.push(value); } };
const browserWindow = new Proxy(dom.window, { get(target, key) {
    if (key === 'location') return location;
    const value = Reflect.get(target, key, target);
    return ['dispatchEvent', 'addEventListener', 'removeEventListener', 'setTimeout', 'clearTimeout'].includes(String(key)) ? value.bind(target) : value;
} });
Object.assign(globalThis, { window: browserWindow, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element, CustomEvent: dom.window.CustomEvent });
const HUB = '22222222-2222-4222-8222-222222222222', OTHER = '33333333-3333-4333-8333-333333333333';
const originalFetch = globalThis.fetch;
let registered: Promise<void> | undefined;
const ready = () => registered ??= import('./liquid-hydration-islands').then(module => module.registerLiquidHydrationIslands());
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
const cached = () => JSON.parse(window.localStorage.getItem('lb_cart') ?? '[]') as Array<{ id: string; quantity: number; serverLineId?: string }>;
const reset = () => { document.body.replaceChildren(); window.localStorage.clear(); navigations.length = 0; location.pathname = '/store/circuit/product/hub'; };
after(() => { globalThis.fetch = originalFetch; reset(); dom.window.close(); });

function mount(id = HUB, quantity = 1) {
    const element = document.createElement('lb-add-to-cart');
    element.dataset.productId = id; element.dataset.productName = 'Synthetic hub'; element.dataset.productPrice = '0.01';
    element.innerHTML = `<input name="quantity" value="${quantity}"><button data-lb-add-to-cart>Add to cart</button><button data-lb-buy-now>Buy now</button><span data-lb-add-to-cart-status role="status"></span>`;
    document.body.append(element);
    return { element, add: element.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]')!, buy: element.querySelector<HTMLButtonElement>('[data-lb-buy-now]')!,
        quantity: element.querySelector<HTMLInputElement>('input')!, status: () => element.querySelector('[data-lb-add-to-cart-status]')!.textContent };
}
const savedLine = { id: OTHER, name: 'Existing item', price: 700, quantity: 2, currency: 'INR', images: [], serverLineId: 'existing-line' };
function seedExisting() {
    window.localStorage.setItem('lb_cart', JSON.stringify([savedLine]));
    window.localStorage.setItem('lb_cart_token', 'accepted-token');
    window.localStorage.setItem('lb_cart_server', JSON.stringify({ cart_token: 'accepted-token', lines: [{ product_id: OTHER, title: savedLine.name, quantity: 2, unit_price: 700 }], total: 1400 }));
}

test('unknown inventory blocks card and PDP cart/checkout traffic while preserving the accepted cart', async () => {
    await ready(); reset(); seedExisting(); const before = { ...window.localStorage };
    let requests = 0;
    globalThis.fetch = (async () => { requests++; throw new Error('Unknown inventory cannot submit'); }) as typeof fetch;
    try {
        for (const surface of ['card', 'product'] as const) {
            const pdp = mount();
            if (surface === 'card') pdp.element.dataset.inventoryKnown = 'false';
            else {
                const section = document.createElement('section'); section.dataset.sectionId = 'unknown-stock';
                section.dataset.inventoryKnown = 'false'; document.body.append(section); section.append(pdp.element);
            }
            // Deliberately enabled controls prove the runtime guard independently
            // from the server-rendered disabled attribute.
            pdp.add.click(); pdp.buy.click(); await flush();
            assert.match(pdp.status()!, /Product unavailable/);
            assert.doesNotMatch(pdp.status()!, /Added/);
        }
        assert.equal(requests, 0); assert.deepEqual({ ...window.localStorage }, before); assert.deepEqual(navigations, []);
    } finally { reset(); }
});
const rejection = (status = 409) => Response.json({ success: false, error: { code: status === 409 ? 'INSUFFICIENT_INVENTORY' : 'INTERNAL_ERROR', message: '<img onerror=untrusted()>' } }, { status });
const active = () => Response.json({ success: true, data: { cart_status: 'active', checkout_state: null } });
function receipt(lines: StorefrontCartLineInput[], token = 'accepted-token') {
    return Response.json({ success: true, data: { cart_token: token, currency: 'INR', subtotal: 2400, total: 2400, discount_total: 0, shipping_total: 0, tax_total: 0, coupon_codes: [],
        lines: lines.map((line, index) => ({ ...line, id: 'accepted-line-' + index, title: 'Accepted title', unit_price: 1200, currency: 'INR' })) } });
}
function transport(run: (lines: StorefrontCartLineInput[], init: RequestInit) => Promise<Response> | Response) {
    const writes: Array<{ lines: StorefrontCartLineInput[]; method: string; path: string }> = [];
    globalThis.fetch = (async (input, init) => {
        const url = new URL(String(input), window.location.origin);
        assert.equal(url.origin, window.location.origin);
        if (url.pathname.endsWith('/checkout-status')) return active();
        assert.match(url.pathname, /^\/api\/storefront\/circuit\/cart(?:\/[^/]+)?$/);
        assert.ok(init); assert.equal(init.cache, 'no-store');
        const body = JSON.parse(String(init.body)) as { lines: unknown[] };
        const lines = body.lines.map(line => StorefrontCartLineInputSchema.parse(line));
        writes.push({ lines, method: String(init.method), path: url.pathname });
        return run(lines, init);
    }) as typeof fetch;
    return writes;
}

test('409 stock rejection restores the unchanged prior draft/receipt, surfaces recovery and permits a valid retry', async () => {
    await ready(); reset(); seedExisting(); const before = { ...window.localStorage };
    let fail = true; const writes = transport(lines => fail ? rejection() : receipt(lines));
    const pdp = mount(HUB, 9); let opened = 0; const open = () => { opened++; }; window.addEventListener('letbuyy:cart:open', open);
    try {
        pdp.add.click(); assert.doesNotMatch(pdp.status()!, /Added/); await flush();
        assert.match(pdp.status()!, /quantity or selection.*check your choices.*try again/i);
        assert.equal(pdp.element.hasAttribute('data-lb-added'), false); assert.deepEqual({ ...window.localStorage }, before);
        assert.equal(opened, 0); assert.deepEqual(navigations, []); assert.equal(document.querySelector('[onerror]'), null);
        fail = false; pdp.quantity.value = '1'; pdp.add.click(); await flush();
        assert.deepEqual(writes.map(write => write.lines.map(line => [line.product_id, line.quantity])), [[[OTHER, 2], [HUB, 9]], [[OTHER, 2], [HUB, 1]]]);
        assert.equal(pdp.status(), 'Added'); assert.equal(opened, 1); assert.equal(cached()[1].serverLineId, 'accepted-line-1');
        assert.equal(JSON.parse(window.localStorage.getItem('lb_cart')!)[1].price, 1200, 'only controlled server receipt sets accepted price');
    } finally { window.removeEventListener('letbuyy:cart:open', open); reset(); }
});

for (const outcome of ['503', 'network', 'response-loss'] as const) test(outcome + ' retry sends the same quantity, preserves existing cart and never announces success before acceptance', async () => {
    await ready(); reset(); seedExisting(); const savedReceipt = window.localStorage.getItem('lb_cart_server'); let attempt = 0;
    const writes = transport(lines => { if (++attempt === 1) { if (outcome !== '503') throw new TypeError('controlled unavailable/response loss'); return rejection(503); } return receipt(lines); });
    try {
        const pdp = mount(HUB, 2); pdp.add.click(); await flush();
        assert.match(pdp.status()!, /could not save.*try again/i); assert.doesNotMatch(pdp.status()!, /Added/);
        assert.deepEqual(cached().map(line => [line.id, line.quantity]), [[OTHER, 2], [HUB, 2]]);
        assert.equal(window.localStorage.getItem('lb_cart_server'), savedReceipt);
        pdp.add.click(); await flush(); assert.equal(writes.length, 2); assert.deepEqual(writes[0].lines, writes[1].lines);
        assert.equal(cached()[1].quantity, 2); assert.equal(pdp.status(), 'Added');
    } finally { reset(); }
});

test('a definite rejection following a transport retry restores its original draft and later success adds only once', async () => {
    await ready(); reset(); seedExisting(); let count = 0;
    const writes = transport(lines => ++count === 1 ? rejection(503) : count === 2 ? rejection() : receipt(lines));
    try {
        const pdp = mount(HUB, 2); pdp.add.click(); await flush(); pdp.add.click(); await flush();
        assert.deepEqual(cached(), [savedLine]); assert.deepEqual(writes[0].lines, writes[1].lines);
        pdp.quantity.value = '1'; pdp.add.click(); await flush(); assert.equal(cached()[1].quantity, 1); assert.equal(pdp.status(), 'Added');
    } finally { reset(); }
});

for (const first of ['accepted', 'rejected'] as const) test('rapid adds retain newest quantity while an older ' + first + ' response settles', async () => {
    await ready(); reset(); let release!: (value: Response) => void; let releaseLast!: (value: Response) => void; let count = 0;
    const writes = transport(() => new Promise<Response>(resolve => { if (++count === 1) release = resolve; else releaseLast = resolve; }));
    try {
        const pdp = mount(); pdp.add.click(); pdp.add.click(); assert.equal(writes.length, 1); assert.equal(cached()[0].quantity, 2);
        assert.equal(pdp.status(), 'Saving…'); release(first === 'accepted' ? receipt(writes[0].lines) : rejection()); await flush();
        assert.equal(cached()[0].quantity, 2); assert.equal(pdp.status(), 'Saving…'); assert.equal(writes.length, 2);
        assert.equal(writes[1].lines[0].quantity, 2); assert.equal(writes[1].method, first === 'accepted' ? 'PATCH' : 'POST');
        releaseLast(receipt(writes[1].lines)); await flush(); assert.equal(cached()[0].quantity, 2); assert.equal(pdp.status(), 'Added');
    } finally { reset(); }
});

test('another PDP newer intent is never replaced by an older rejected optimistic draft', async () => {
    await ready(); reset(); let release!: (value: Response) => void; let count = 0;
    const writes = transport(lines => ++count === 1 ? new Promise<Response>(resolve => { release = resolve; }) : receipt(lines));
    try {
        const first = mount(HUB, 9), second = mount(OTHER); first.add.click(); second.add.click();
        const newer = window.localStorage.getItem('lb_cart'); release(rejection()); await flush();
        assert.equal(writes.length, 2); assert.deepEqual(writes[1].lines.map(line => [line.product_id, line.quantity]), [[HUB, 9], [OTHER, 1]]);
        assert.ok(newer); assert.deepEqual(cached().map(line => [line.id, line.quantity]), [[HUB, 9], [OTHER, 1]]);
        assert.doesNotMatch(first.status()!, /Added/); assert.equal(second.status(), 'Added');
    } finally { reset(); }
});

test('Buy Now blocks stock rejection, retries uncertainty without double increment and waits for accepted token before navigation', async () => {
    await ready(); reset(); let count = 0; let release!: (value: Response) => void;
    const writes = transport(() => ++count === 1 ? rejection() : count === 2 ? rejection(503) : new Promise<Response>(resolve => { release = resolve; }));
    try {
        const pdp = mount(HUB, 9); pdp.buy.click(); await flush(); assert.deepEqual(cached(), []); assert.equal(pdp.buy.disabled, false);
        assert.match(pdp.status()!, /quantity or selection/i); assert.deepEqual(navigations, []);
        pdp.quantity.value = '2'; pdp.buy.click(); await flush(); assert.match(pdp.status()!, /could not prepare checkout/i);
        pdp.buy.click(); pdp.buy.click(); await flush(); assert.equal(writes.length, 3); assert.deepEqual(writes[1].lines, writes[2].lines);
        assert.equal(pdp.buy.disabled, true); assert.deepEqual(navigations, []); assert.doesNotMatch(pdp.status()!, /Added/);
        release(receipt(writes[2].lines)); await flush(); assert.equal(window.localStorage.getItem('lb_cart_token'), 'accepted-token');
        assert.equal(cached()[0].quantity, 2); assert.deepEqual(navigations, ['/store/circuit/checkout']);
    } finally { reset(); }
});

test('an old success timer cannot erase newer pending or rejected feedback', async () => {
    await ready(); reset(); let count = 0; const writes = transport(lines => ++count === 1 ? receipt(lines) : rejection());
    try {
        const pdp = mount(); pdp.add.click(); await flush(); assert.equal(pdp.status(), 'Added');
        pdp.quantity.value = '9'; pdp.add.click(); await flush(); const failure = pdp.status();
        assert.equal(writes.length, 2); assert.match(failure!, /quantity or selection/i);
        await new Promise(resolve => setTimeout(resolve, 1850)); assert.equal(pdp.status(), failure);
        assert.equal(pdp.element.hasAttribute('data-lb-added'), false); assert.equal(cached()[0].quantity, 1);
    } finally { reset(); }
});

test('late response after storefront switch cannot roll back newer storage or navigate', async () => {
    await ready(); reset(); let release!: (value: Response) => void;
    transport(() => new Promise<Response>(resolve => { release = resolve; }));
    try {
        const pdp = mount(); pdp.buy.click(); location.pathname = '/store/other/product/other';
        window.localStorage.setItem('lb_cart', JSON.stringify([savedLine])); window.localStorage.setItem('lb_cart_token', 'other-token');
        const newer = { ...window.localStorage }; release(rejection()); await flush();
        assert.deepEqual({ ...window.localStorage }, newer); assert.deepEqual(navigations, []); assert.doesNotMatch(pdp.status()!, /Added/);
    } finally { reset(); }
});

test('retirement discovered during sync is not an accepted new add or checkout', async () => {
    await ready(); reset(); seedExisting(); let reads = 0, writes = 0;
    globalThis.fetch = (async input => { if (!String(input).endsWith('/checkout-status')) { writes++; throw new Error('no mutation after retirement'); }
        return ++reads === 1 ? active() : Response.json({ success: true, data: { cart_status: 'converted', checkout_state: 'completed', order: { id: 'controlled-order' } } }); }) as typeof fetch;
    try {
        const pdp = mount(); pdp.buy.click(); await flush(); assert.equal(reads, 2); assert.equal(writes, 0);
        assert.deepEqual(cached(), []); assert.equal(window.localStorage.getItem('lb_cart_token'), null);
        assert.deepEqual(navigations, []); assert.doesNotMatch(pdp.status()!, /Added/);
    } finally { reset(); }
});

test('trusted demo native guard remains inert even when a purchase click is dispatched programmatically', async () => {
    await ready(); reset(); let calls = 0; globalThis.fetch = (async () => { calls++; throw new Error('demo must be inert'); }) as typeof fetch;
    try {
        const pdp = mount(); pdp.element.setAttribute('data-catalog-demo-inert', '');
        pdp.add.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
        pdp.buy.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
        await flush(); assert.equal(calls, 0); assert.equal(window.localStorage.getItem('lb_cart'), null); assert.deepEqual(navigations, []);
    } finally { reset(); }
});
