import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { ProductFactSnapshotSchema } from '@letbuyy/commerce-core';

// Synthetic source-test identities and transport only; not the f607 HTTP witness.
const token = 'synthetic-recovery-cart';
const productId = '11111111-1111-4111-8111-111111111111';
const variantId = '22222222-2222-4222-8222-222222222222';
const snapshot = ProductFactSnapshotSchema.parse({ version: 1,
    facts: { furniture: { assembled: { width: 48, unit: 'in' }, materials: ['Synthetic wood'] } },
    selected_options: [{ name: 'Width', value: '48 in' }] });
const receipt = (quantity = 4) => ({ cart_token: token, status: 'active', updated_at: '2026-10-25T00:00:00.000Z', currency: 'INR', subtotal: quantity * 8900,
    total: quantity * 8900, discount_total: 0, shipping_total: 0, tax_total: 0, coupon_codes: [] as string[],
    lines: [{ id: '33333333-3333-4333-8333-333333333333', product_id: productId, variant_id: variantId,
        title: 'Synthetic recovery desk', quantity, unit_price: 8900, currency: 'INR',
        properties: { Width: '48 in' }, niche_snapshot: snapshot, snapshot_fingerprint: 'synthetic-desk-snapshot' }] });
type Receipt = ReturnType<typeof receipt>;
type Request = { method: string; path: string; lines?: { product_id: string; variant_id?: string; quantity: number }[] };
const QaDom = JSDOM as unknown as new (html: string, options: { url: string }) => {
    window: Window & typeof globalThis & { close(): void }; reconfigure(options: { url: string }): void;
};
const dom = new QaDom('<!doctype html><body></body>', { url: 'https://source.example.invalid/store/recovery/cart' });
const globalNames = ['window', 'document', 'HTMLElement', 'Element', 'CustomEvent', 'IS_REACT_ACT_ENVIRONMENT'];
const previous = new Map(globalNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
const originalFetch = globalThis.fetch;
after(() => {
    globalThis.fetch = originalFetch; dom.window.close();
    for (const name of globalNames) {
        const descriptor = previous.get(name);
        if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
    }
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
async function settle() { await act(async () => { for (let index = 0; index < 8; index++) await tick(); }); }
function localItems(cart: Receipt) {
    return cart.lines.map(line => ({ id: line.product_id, variantId: line.variant_id, serverLineId: line.id,
        name: line.title, quantity: line.quantity, price: line.unit_price, images: [], currency: line.currency,
        selectedVariant: line.properties, nicheSnapshot: line.niche_snapshot, snapshotFingerprint: line.snapshot_fingerprint }));
}
async function harness(localQuantity = 4) {
    document.body.replaceChildren(); window.localStorage.clear();
    dom.reconfigure({ url: 'https://source.example.invalid/store/recovery/cart' });
    let server = receipt();
    const requests: Request[] = [];
    let mutation: ((request: Request) => Promise<Response> | Response) | undefined;
    let read: (() => Promise<Response> | Response) | undefined;
    let checkout: (() => Promise<Response> | Response) | undefined;
    window.localStorage.setItem('lb_cart_token', token);
    window.localStorage.setItem('lb_cart_server', JSON.stringify(server));
    window.localStorage.setItem('lb_cart', JSON.stringify(localItems(receipt(localQuantity))));
    globalThis.fetch = (async (input, init) => {
        const request: Request = { method: init?.method || 'GET', path: String(input) };
        assert.ok(request.path.startsWith('/api/storefront/'), 'test transport must stay on the canonical browser proxy');
        if (request.path.endsWith('/checkout-status')) return checkout ? checkout()
            : json({ success: true, data: { cart_status: 'active', checkout_state: null } });
        requests.push(request);
        if (request.method === 'GET') return read ? read() : json({ success: true, data: server });
        request.lines = JSON.parse(String(init?.body)).lines;
        if (mutation) return mutation(request);
        const quantity = request.lines![0]?.quantity || 0;
        if (quantity > 4) return json({ success: false, error: { code: 'INSUFFICIENT_INVENTORY', message: 'Synthetic stock refusal' } }, 409);
        server = receipt(quantity);
        return json({ success: true, data: server });
    }) as typeof fetch;
    const islands = await import('./liquid-hydration-islands');
    const { createRoot } = await import('react-dom/client');
    document.body.innerHTML = '<main data-theme-renderer="liquid" data-editor-mode="false"><header>Cart <span data-lb-cart-count>0</span></header><lb-cart></lb-cart></main><div id="effect"></div>';
    const effect = createRoot(document.getElementById('effect')!);
    await act(async () => { effect.render(React.createElement(islands.default, { basePath: '/store/recovery', storeId: productId })); });
    await settle();
    const page = () => document.querySelector<HTMLElement>('lb-cart')!;
    return { requests, page, server: () => server,
        mutation(value: typeof mutation) { mutation = value; }, read(value: typeof read) { read = value; },
        checkout(value: typeof checkout) { checkout = value; },
        quantity: () => Number(page().querySelector('.lb-cart__qty > span')?.textContent),
        header: () => Number(document.querySelector('[data-lb-cart-count]')?.textContent),
        stored: () => JSON.parse(window.localStorage.getItem('lb_cart')!) as ReturnType<typeof localItems>,
        async step(direction: 'up' | 'down') {
            await act(async () => { page().querySelector<HTMLButtonElement>(`[data-lb-cart-step="${direction}"]`)!.click(); });
            await settle();
        },
        async remount() { page().remove(); document.querySelector('main')!.append(document.createElement('lb-cart')); await settle(); },
        async close() { await act(async () => effect.unmount()); document.body.replaceChildren(); window.localStorage.clear(); globalThis.fetch = originalFetch; await tick(); },
    };
}

test('synthetic 409 on native four-to-five step restores accepted row/header/totals/storage and remount, then valid three clears error', async () => {
    const h = await harness();
    try {
        assert.equal(h.quantity(), 4); assert.equal(h.header(), 4);
        await h.step('up');
        assert.equal(h.quantity(), 4);
        assert.equal(h.header(), 4);
        assert.match(h.page().textContent!, /35,600/);
        assert.match(h.page().querySelector('[role="alert"]')?.textContent || '', /could not|not saved|not accepted/i);
        assert.equal(h.stored()[0].quantity, 4);
        assert.deepEqual(h.stored()[0].nicheSnapshot, snapshot);
        assert.equal(h.server().lines[0].quantity, 4);
        await h.remount(); assert.equal(h.quantity(), 4); assert.equal(h.header(), 4);
        await h.step('down');
        assert.equal(h.quantity(), 3); assert.equal(h.header(), 3);
        assert.match(h.page().textContent!, /26,700/);
        assert.equal(h.page().querySelector('[role="alert"]'), null);
    } finally { await h.close(); }
});

test('persisted unacknowledged five hydrates accepted four without replay on mount', async () => {
    const h = await harness(5);
    try {
        assert.equal(h.quantity(), 4); assert.equal(h.header(), 4);
        assert.equal(h.stored()[0].quantity, 4);
        assert.equal(h.page().querySelector('[role="alert"]'), null);
        assert.equal(h.requests.filter(row => row.method !== 'GET').length, 0, 'mount must never replay an unacknowledged mutation');
        await h.remount(); assert.equal(h.quantity(), 4);
    } finally { await h.close(); }
});

test('canonical recovery retains a sibling variant and its saved facts instead of rebuilding cart intent', async () => {
    const h = await harness();
    try {
        const sibling = { ...structuredClone(h.server().lines[0]), id: '44444444-4444-4444-8444-444444444444',
            variant_id: '55555555-5555-4555-8555-555555555555', quantity: 1,
            properties: { Width: '60 in' }, niche_snapshot: ProductFactSnapshotSchema.parse({ version: 1,
                facts: { furniture: { assembled: { width: 60, unit: 'in' }, materials: ['Different synthetic wood'] } } }) };
        h.server().lines.push(sibling); h.server().subtotal = 44500; h.server().total = 44500;
        window.localStorage.setItem('lb_cart_server', JSON.stringify(h.server()));
        window.localStorage.setItem('lb_cart', JSON.stringify(localItems(h.server())));
        window.dispatchEvent(new CustomEvent('letbuyy:cart:changed'));
        await h.step('up');
        assert.equal(h.stored()[0].quantity, 4);
        assert.deepEqual(h.stored()[1], localItems(h.server())[1]);
        assert.deepEqual(h.server().lines[1], sibling);
        assert.equal(h.header(), 5); assert.match(h.page().textContent!, /44,500/);
    } finally { await h.close(); }
});

for (const change of ['draft', 'token', 'site', 'disconnect', 'receipt'] as const) {
    test(`delayed canonical read cannot overwrite a newer ${change}`, async () => {
        const h = await harness();
        let release: ((value: Response) => void) | undefined;
        try {
            h.read(() => new Promise<Response>(resolve => { release = resolve; }));
            await h.step('up'); assert.ok(release);
            const newer = receipt(2);
            if (change === 'draft') window.localStorage.setItem('lb_cart', JSON.stringify(localItems(newer)));
            if (change === 'token') {
                window.localStorage.setItem('lb_cart_token', 'different-synthetic-cart');
                window.localStorage.setItem('lb_cart', JSON.stringify(localItems(newer)));
                window.dispatchEvent(new window.Event('storage'));
                assert.doesNotMatch(h.page().textContent!, /Checking your saved cart/);
                assert.ok(h.page().querySelector('[data-lb-cart-refresh]'), 'the new cart must not inherit an endless pending state');
            }
            if (change === 'site') dom.reconfigure({ url: 'https://source.example.invalid/store/other/cart' });
            if (change === 'disconnect') h.page().remove();
            if (change === 'receipt') window.localStorage.setItem('lb_cart_server', JSON.stringify(newer));
            const before = ['lb_cart', 'lb_cart_token', 'lb_cart_server'].map(key => window.localStorage.getItem(key));
            release(json({ success: true, data: receipt() })); await settle();
            assert.deepEqual(['lb_cart', 'lb_cart_token', 'lb_cart_server'].map(key => window.localStorage.getItem(key)), before);
        } finally { release?.(json({ success: true, data: receipt() })); await settle(); await h.close(); }
    });
}

test('a delayed rejected mutation cannot recover over a newer local edit or start a mutation retry', async () => {
    const h = await harness();
    let release: ((value: Response) => void) | undefined;
    try {
        h.requests.length = 0;
        h.mutation(() => new Promise<Response>(resolve => { release = resolve; }));
        await h.step('up'); assert.ok(release);
        const newer = JSON.stringify(localItems(receipt(2)));
        window.localStorage.setItem('lb_cart', newer);
        release(json({ success: false, error: { code: 'INSUFFICIENT_INVENTORY' } }, 409)); await settle();
        assert.equal(window.localStorage.getItem('lb_cart'), newer);
        assert.equal(h.requests.filter(row => row.method !== 'GET').length, 1);
        assert.equal(h.requests.filter(row => row.method === 'GET').length, 0);
    } finally { release?.(json({ success: false }, 409)); await settle(); await h.close(); }
});

for (const failure of ['transport', 'malformed'] as const) {
    test(`${failure} recovery stays explicitly unconfirmed and a buyer read recovers without a second mutation`, async () => {
        const h = await harness();
        try {
            h.requests.length = 0;
            h.mutation(() => { throw new Error('Synthetic uncertain transport; not proof of denial'); });
            h.read(() => failure === 'transport' ? Promise.reject(new Error('Synthetic read failure'))
                : json({ success: true, data: { ...receipt(), total: -1 } }));
            await h.step('up');
            assert.match(h.page().querySelector('[role="alert"]')?.textContent || '', /could not confirm/i);
            assert.doesNotMatch(h.page().textContent!, /not accepted|not saved|stock refusal/i);
            assert.equal(h.page().querySelector('a.lb-cart__checkout'), null);
            assert.equal(h.requests.filter(row => row.method !== 'GET').length, 1);
            h.read(undefined);
            await act(async () => { h.page().querySelector<HTMLButtonElement>('[data-lb-cart-refresh]')!.click(); }); await settle();
            assert.equal(h.quantity(), 4); assert.equal(h.header(), 4); assert.equal(h.stored()[0].quantity, 4);
            assert.equal(h.page().querySelector('[role="alert"]'), null);
            assert.ok(h.page().querySelector('a.lb-cart__checkout'));
            assert.equal(h.requests.filter(row => row.method !== 'GET').length, 1, 'review is GET only');
        } finally { await h.close(); }
    });
}

test('an existing cart without a capability cannot start or replay a mutation during recovery or remount', async () => {
    const h = await harness();
    try {
        h.requests.length = 0; window.localStorage.removeItem('lb_cart_token');
        h.mutation(() => { throw new Error('Synthetic lost POST response'); });
        await h.step('up');
        assert.equal(h.requests.filter(row => row.method === 'POST').length, 0);
        assert.equal(h.page().querySelector('a.lb-cart__checkout'), null);
        assert.match(h.page().textContent!, /could not confirm/i);
        await act(async () => { h.page().querySelector<HTMLButtonElement>('[data-lb-cart-refresh]')!.click(); }); await settle();
        await h.remount();
        assert.equal(h.requests.filter(row => row.method !== 'GET').length, 0);
        assert.equal(window.localStorage.getItem('lb_cart_token'), null, 'never adopt a stale cached capability');
        assert.equal(h.page().querySelector('a.lb-cart__checkout'), null);
        assert.doesNotMatch(h.page().textContent!, /not accepted|not saved/i);
    } finally { await h.close(); }
});

test('malformed mutation success is uncertain even when a canonical read can recover saved rows', async () => {
    const h = await harness();
    try {
        h.requests.length = 0;
        h.mutation(() => json({ success: true, data: { lines: [] } }));
        await h.step('up');
        assert.equal(h.quantity(), 4); assert.equal(h.header(), 4);
        assert.match(h.page().textContent!, /could not confirm/i);
        assert.doesNotMatch(h.page().textContent!, /not accepted|not saved/i);
        assert.equal(h.page().querySelector('a.lb-cart__checkout'), null);
        assert.equal(h.requests.filter(row => row.method !== 'GET').length, 1);
    } finally { await h.close(); }
});

test('canonical completed checkout retirement during recovery never resurrects cached cart rows', async () => {
    const h = await harness();
    try {
        h.requests.length = 0;
        h.mutation(() => {
            h.checkout(() => json({ success: true, data: { cart_status: 'converted', checkout_state: 'completed', order: { id: 'synthetic-completed-order' } } }));
            return json({ success: false, error: { code: 'INSUFFICIENT_INVENTORY' } }, 409);
        });
        await h.step('up');
        assert.equal(window.localStorage.getItem('lb_cart_token'), null);
        assert.equal(window.localStorage.getItem('lb_cart_server'), null);
        assert.deepEqual(h.stored(), []); assert.equal(h.header(), 0);
        assert.match(h.page().textContent!, /cart is empty/i);
        assert.doesNotMatch(h.page().textContent!, /Checking your saved cart|Updating your cart/);
        assert.equal(h.requests.filter(row => row.method === 'GET').length, 0, 'no cart GET after canonical retirement');
    } finally { await h.close(); }
});
