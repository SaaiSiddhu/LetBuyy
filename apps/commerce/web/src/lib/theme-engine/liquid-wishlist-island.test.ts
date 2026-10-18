import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
const browserWindow = dom.window as unknown as {
    document: Document;
    HTMLElement: typeof HTMLElement;
    Element: typeof Element;
    CustomEvent: typeof CustomEvent;
    Event: typeof Event;
    FormData: typeof FormData;
};
Object.assign(globalThis, {
    window: browserWindow,
    document: browserWindow.document,
    HTMLElement: browserWindow.HTMLElement,
    Element: browserWindow.Element,
    CustomEvent: browserWindow.CustomEvent,
});
let registration: Promise<void> | null = null;
async function registerRuntime() {
    registration ??= import('./liquid-hydration-islands').then(({ registerLiquidHydrationIslands }) => {
        registerLiquidHydrationIslands();
    });
    await registration;
}

function buyerToggle({ linked = true, unavailable = false, active = false } = {}) {
    const element = document.createElement('lb-wishlist-toggle');
    element.dataset.productId = 'product-1';
    element.dataset.storeId = 'site-1';
    element.dataset.authenticated = 'true';
    element.dataset.accountType = 'buyer';
    element.dataset.buyerId = 'buyer-a';
    element.dataset.buyerLinked = String(linked);
    element.dataset.buyerUnavailable = String(unavailable);
    element.dataset.inWishlist = String(active);
    element.dataset.basePath = '/store/demo';
    document.body.append(element);
    return element;
}

test('Liquid buyer wishlist toggle writes only through the canonical buyer API', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
        calls.push({ input, init });
        return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
        const element = buyerToggle();
        element.querySelector('button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(String(calls[0]?.input), '/api/buyer/wishlist');
        assert.equal(calls[0]?.init?.method, 'POST');
        assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { productId: 'product-1', variantId: null });
        assert.equal(new Headers(calls[0]?.init?.headers).get('x-letbuyy-expected-buyer-id'), 'buyer-a');
        assert.equal(element.querySelector('button')?.getAttribute('aria-pressed'), 'true');
        element.remove();
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Liquid buyer wishlist does not mutate when the verified store link is missing or unavailable', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => { calls += 1; return new Response('{}', { status: 200 }); }) as typeof fetch;
    try {
        const unlinked = buyerToggle({ linked: false });
        assert.match(unlinked.querySelector('button')?.getAttribute('aria-label') || '', /Connect store account/);
        unlinked.remove();
        const unavailable = buyerToggle({ unavailable: true });
        unavailable.querySelector('button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(calls, 0);
        assert.match(unavailable.textContent || '', /temporarily unavailable/);
        unavailable.remove();
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Liquid buyer wishlist fails closed when server-rendered buyer identity is absent', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => { calls += 1; return new Response('{}', { status: 200 }); }) as typeof fetch;
    try {
        const element = buyerToggle();
        delete element.dataset.buyerId;
        element.querySelector('button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(calls, 0);
        assert.match(element.textContent || '', /Reload your account/);
        element.remove();
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('Liquid buyer settings binds a profile write to the buyer whose form was loaded', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    const originalFormData = globalThis.FormData;
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    globalThis.FormData = browserWindow.FormData;
    globalThis.fetch = (async (input, init) => {
        calls.push({ input, init });
        if (init?.method === 'PATCH') return Response.json({ buyer: { id: 'buyer-a' } });
        return Response.json({ buyer: {
            id: 'buyer-a',
            email: 'buyer@example.test',
            email_verified: true,
            full_name: 'Buyer A',
            phone: '+91 11111',
        } });
    }) as typeof fetch;
    try {
        const element = document.createElement('lb-customer-settings');
        element.dataset.accountType = 'buyer';
        element.dataset.basePath = '/store/demo';
        document.body.append(element);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const form = element.querySelector<HTMLFormElement>('[data-lb-settings-buyer-profile]');
        assert.ok(form);
        assert.equal(form.querySelector<HTMLInputElement>('input[name="expectedBuyerId"]')?.value, 'buyer-a');
        form.dispatchEvent(new browserWindow.Event('submit', { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));

        const patch = calls.find((call) => call.init?.method === 'PATCH');
        assert.ok(patch);
        assert.equal(String(patch.input), '/api/buyer/profile');
        assert.equal(JSON.parse(String(patch.init?.body)).expectedBuyerId, 'buyer-a');
        element.remove();
    } finally {
        globalThis.fetch = originalFetch;
        globalThis.FormData = originalFormData;
    }
});

test('Liquid buyer settings uses the sanitizer-safe account-link intent contract', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => Response.json({ buyer: {
        id: 'buyer-a',
        email: 'buyer@example.test',
        email_verified: true,
    } })) as typeof fetch;
    try {
        const element = document.createElement('lb-customer-settings');
        element.dataset.accountType = 'buyer';
        element.dataset.basePath = '/store/demo';
        document.body.append(element);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const form = element.querySelector<HTMLFormElement>('form[action="/api/buyer-auth/start"]');
        assert.ok(form);
        assert.equal(form.method, 'post');
        assert.equal(form.querySelector<HTMLInputElement>('input[name="intent"]')?.value, 'link_store_customer');
        assert.equal(form.querySelector('input[name="action"]'), null, 'the form must not rely on a DOM-clobbering field name');
        assert.equal(form.querySelector<HTMLInputElement>('input[name="return_to"]')?.value, '/store/demo/account/settings');
        element.remove();
    } finally {
        globalThis.fetch = originalFetch;
    }
});
