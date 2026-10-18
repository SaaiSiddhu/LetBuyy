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

test('Liquid wishlist repeat clicks cannot start conflicting mutations while the first is pending', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    const pending: Array<(response: Response) => void> = [];
    const mutations: Array<{ method: string; body: unknown }> = [];
    let element: HTMLElement | undefined;
    globalThis.fetch = (async (_input, init) => {
        mutations.push({ method: String(init?.method), body: JSON.parse(String(init?.body)) });
        return await new Promise<Response>((resolve) => pending.push(resolve));
    }) as typeof fetch;
    try {
        element = buyerToggle();
        element.querySelector('button')?.click();
        element.querySelector('button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(mutations.length, 1, 'a repeat click must not race an unconfirmed mutation for the same saved item');
        assert.equal(mutations[0]?.method, 'POST');
        pending[0]?.(Response.json({ success: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(element.querySelector('button')?.getAttribute('aria-pressed'), 'true');
        assert.equal(element.textContent?.includes('could not update'), false);
    } finally {
        // Settle every deliberately held request even on the intended BEFORE failure.
        for (const resolve of pending) resolve(Response.json({ success: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        element?.remove();
        globalThis.fetch = originalFetch;
    }
});

test('two Liquid controls for the same buyer and saved item share one pending mutation', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    const pending: Array<(response: Response) => void> = [];
    let calls = 0;
    let first: HTMLElement | undefined;
    let second: HTMLElement | undefined;
    globalThis.fetch = (async () => {
        calls += 1;
        return await new Promise<Response>((resolve) => pending.push(resolve));
    }) as typeof fetch;
    try {
        first = buyerToggle();
        second = buyerToggle();
        first.querySelector('button')?.click();
        second.querySelector('button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(calls, 1, 'the same saved item cannot acquire conflicting writes from another visible control');
        for (const resolve of pending) resolve(Response.json({ success: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(first.querySelector('button')?.getAttribute('aria-pressed'), 'true');
        assert.equal(second.querySelector('button')?.getAttribute('aria-pressed'), 'true');
    } finally {
        for (const resolve of pending) resolve(Response.json({ success: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        first?.remove();
        second?.remove();
        globalThis.fetch = originalFetch;
    }
});

test('an old wishlist removal reply cannot remove a card now bound to another buyer', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    const oldUrl = dom.window.location.href;
    let reply: ((response: Response) => void) | undefined;
    const card = document.createElement('article');
    card.className = 'lb-product-card';
    let element: HTMLElement | undefined;
    globalThis.fetch = (async () => await new Promise<Response>((resolve) => { reply = resolve; })) as typeof fetch;
    try {
        dom.reconfigure({ url: 'https://shop.example.test/account/wishlist' });
        document.body.append(card);
        element = buyerToggle({ active: true });
        element.dataset.productId = 'product-stale-reply';
        element.dataset.buyerId = 'buyer-stale-reply';
        card.append(element);
        element.querySelector('button')?.click();
        element.dataset.buyerId = 'buyer-b';
        element.dataset.inWishlist = 'true';
        reply?.(Response.json({ success: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(card.isConnected, true, 'an obsolete buyer-a continuation cannot remove buyer-b current UI');
    } finally {
        reply?.(Response.json({ success: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        element?.remove();
        card.remove();
        dom.reconfigure({ url: oldUrl });
        globalThis.fetch = originalFetch;
    }
});

test('a lost wishlist reply offers a current read without claiming the write did not happen', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    let element: HTMLElement | undefined;
    globalThis.fetch = (async () => { calls += 1; throw new Error('synthetic-unknown-reply'); }) as typeof fetch;
    try {
        element = buyerToggle();
        element.querySelector('button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.doesNotMatch(element.textContent || '', /Your wishlist was not changed/);
        const reload = element.querySelector<HTMLAnchorElement>('a');
        assert.equal(reload?.textContent, 'Reload wishlist');
        assert.equal(reload?.href, dom.window.location.href);
        element.querySelector('button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(calls, 1, 'do not dispatch another write while the earlier outcome is unknown');
    } finally {
        element?.remove();
        globalThis.fetch = originalFetch;
    }
});

test('an unknown wishlist outcome survives a fresh same-scope control made from old markup', async () => {
    await registerRuntime();
    const originalFetch = globalThis.fetch;
    let calls = 0;
    let first: HTMLElement | undefined;
    let replacement: HTMLElement | undefined;
    const oldMarkup = {
        productId: 'product-unknown-remount', storeId: 'site-unknown-remount',
        authenticated: 'true', accountType: 'buyer', buyerId: 'buyer-unknown-remount',
        buyerLinked: 'true', buyerUnavailable: 'false', inWishlist: 'false', basePath: '/store/demo',
    };
    const fromOldMarkup = () => {
        const element = document.createElement('lb-wishlist-toggle');
        Object.assign(element.dataset, oldMarkup);
        document.body.append(element);
        return element;
    };
    globalThis.fetch = (async () => { calls += 1; throw new Error('synthetic-lost-remount-reply'); }) as typeof fetch;
    try {
        first = fromOldMarkup();
        first.querySelector('button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(calls, 1, 'the first attempt must actually reach the unconfirmed transport outcome');
        first.remove();
        replacement = fromOldMarkup();
        replacement.querySelector('button')?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(calls, 1, 'recreating the same principal/site/product control cannot clear an unknown write outcome');
        assert.equal(replacement.querySelector('a')?.textContent, 'Reload wishlist');
    } finally {
        first?.remove();
        replacement?.remove();
        globalThis.fetch = originalFetch;
    }
});
