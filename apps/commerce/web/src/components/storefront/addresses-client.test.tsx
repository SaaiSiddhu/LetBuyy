import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import AddressesPageClient from '../../app/store/[subdomain]/account/addresses/addresses-client';
import { CustomerAuthProvider } from '../../context/customer-auth-context';
import { WishlistProvider } from '../../context/wishlist-context';

const address = {
    id: 'address-1',
    label: 'home',
    full_name: 'Asha Rao',
    address_line1: '12 Market Road',
    address_line2: null,
    city: 'Pune',
    state: 'Maharashtra',
    postal_code: '411001',
    country: 'IN',
    landmark: null,
    is_default: true,
};

test('address page keeps failed deletes visible and keeps failed buyer saves editable', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    (dom as unknown as { reconfigure(options: { url: string }): void }).reconfigure({ url: 'http://store.example.test' });
    const browserWindow = dom.window as unknown as Window & { close: () => void; navigator: Navigator };
    const prior = {
        window: globalThis.window,
        document: globalThis.document,
        navigator: globalThis.navigator,
        localStorage: globalThis.localStorage,
        fetch: globalThis.fetch,
        actEnvironment: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: browserWindow.document });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browserWindow.navigator });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: browserWindow.localStorage });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const requests: Array<{ url: string; method: string; body?: string; expectedBuyerId?: string }> = [];
    let sessionReads = 0;
    const currentBuyerEmail = 'asha@example.test';
    let currentBuyerId = 'buyer-a';
    let holdNextBuyerSession = false;
    let failNextBuyerSession = false;
    let resolveBuyerSession: ((response: Response) => void) | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || 'GET';
        const expectedBuyerId = new Headers(init?.headers).get('x-letbuyy-expected-buyer-id') ?? undefined;
        requests.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined, expectedBuyerId });

        if (url === '/api/buyer-auth/session') {
            sessionReads += 1;
            if (failNextBuyerSession) {
                failNextBuyerSession = false;
                return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
            }
            if (holdNextBuyerSession) {
                holdNextBuyerSession = false;
                return new Promise<Response>(resolve => { resolveBuyerSession = resolve; });
            }
            return Response.json(sessionReads === 1 ? { buyer: null } : { buyer: { email: currentBuyerEmail } });
        }
        if (url === '/api/customer/session') return Response.json({ authenticated: false });
        if (url === '/api/buyer/profile') {
            return Response.json({ buyer: { id: currentBuyerId, email: currentBuyerEmail, email_verified: true, full_name: currentBuyerId === 'buyer-b' ? 'Ben Buyer' : 'Asha Rao', phone: null } });
        }
        if (url === '/api/customer/addresses' && method === 'GET') return Response.json({ addresses: [address] });
        if (url === '/api/customer/addresses' && method === 'DELETE') {
            return Response.json({ error: 'Address is temporarily unavailable.' }, { status: 503 });
        }
        if (url === '/api/buyer/addresses' && method === 'GET') return Response.json({ addresses: currentBuyerId === 'buyer-b' ? [{ ...address, id: 'address-b', full_name: 'Ben Buyer', address_line1: '99 Private Lane' }] : [address] });
        if (url === '/api/buyer/addresses' && method === 'POST') {
            if (expectedBuyerId !== currentBuyerId) return Response.json({ error: 'Your account changed. Reload before saving.' }, { status: 409 });
            return Response.json({ error: 'Address could not be saved.' }, { status: 503 });
        }
        throw new Error(`Unexpected address request: ${method} ${url}`);
    }) as typeof fetch;

    let root = createRoot(browserWindow.document.getElementById('root')!);
    const click = (needle: string) => {
        const button = Array.from(browserWindow.document.querySelectorAll('button'))
            .find(candidate => candidate.textContent?.includes(needle));
        assert.ok(button, `expected button containing "${needle}"`);
        const event = browserWindow.document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        button.dispatchEvent(event);
    };
    const renderAddresses = () => (
        <CustomerAuthProvider storeId="site-1">
            <WishlistProvider storeId="site-1"><AddressesPageClient /></WishlistProvider>
        </CustomerAuthProvider>
    );

    try {
        await act(async () => root.unmount());
        root = createRoot(browserWindow.document.getElementById('root')!);
        await act(async () => {
            root.render(renderAddresses());
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        assert.match(browserWindow.document.body.textContent || '', /Asha Rao/);
        assert.ok(requests.some(request => request.url === '/api/customer/addresses' && request.method === 'GET'));

        await act(async () => {
            click('Delete');
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        assert.match(browserWindow.document.body.textContent || '', /Asha Rao/);
        assert.match(browserWindow.document.body.textContent || '', /Address is temporarily unavailable\./);
        assert.deepEqual(JSON.parse(requests.find(request => request.method === 'DELETE')?.body || '{}'), { id: 'address-1' });

        await act(async () => root.unmount());
        root = createRoot(browserWindow.document.getElementById('root')!);
        await act(async () => {
            root.render(renderAddresses());
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.ok(requests.some(request => request.url === '/api/buyer/addresses' && request.method === 'GET'), JSON.stringify(requests));
        await act(async () => click('Add Address'));
        await act(async () => {
            const form = browserWindow.document.querySelector('form');
            assert.ok(form);
            form.dispatchEvent(new browserWindow.window.Event('submit', { bubbles: true, cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        assert.match(browserWindow.document.body.textContent || '', /Address could not be saved\./);
        assert.match(browserWindow.document.body.textContent || '', /New Address/);
        const buyerWrite = requests.find(request => request.url === '/api/buyer/addresses' && request.method === 'POST');
        assert.ok(buyerWrite, 'canonical buyer accounts submit through the buyer address API');
        assert.equal(requests.some(request => request.url === '/api/customer/addresses' && request.method === 'POST'), false);

        // The browser's shared cookie can already belong to B before the active tab's
        // session revalidation runs. A's stale form must carry A's compare ID so the
        // BFF rejects it instead of writing A's address draft into B's book.
        currentBuyerId = 'buyer-b';
        await act(async () => {
            const form = browserWindow.document.querySelector('form');
            assert.ok(form);
            form.dispatchEvent(new browserWindow.window.Event('submit', { bubbles: true, cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        const staleBuyerWrite = requests.filter(request => request.url === '/api/buyer/addresses' && request.method === 'POST').at(-1);
        assert.equal(staleBuyerWrite?.expectedBuyerId, 'buyer-a');
        assert.match(browserWindow.document.body.textContent || '', /Your account changed\. Reload before saving\./);

        // The email is unchanged, but the cookie now resolves to a different canonical buyer ID.
        holdNextBuyerSession = true;
        await act(async () => {
            const focusEvent = browserWindow.document.createEvent('Event');
            focusEvent.initEvent('focus');
            browserWindow.dispatchEvent(focusEvent);
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        assert.doesNotMatch(browserWindow.document.body.textContent || '', /Asha Rao/,
            'the previous buyer address is hidden while the host-only session is revalidated');
        assert.ok(browserWindow.document.querySelector('[aria-busy="true"]'),
            'the old address list stays replaced by a loading state until the new buyer is verified');
        await act(async () => {
            resolveBuyerSession?.(Response.json({ buyer: { email: currentBuyerEmail } }));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        assert.match(browserWindow.document.body.textContent || '', /Ben Buyer/);
        assert.match(browserWindow.document.body.textContent || '', /99 Private Lane/);
        assert.doesNotMatch(browserWindow.document.body.textContent || '', /Asha Rao|12 Market Road|New Address/,
            'the previous buyer profile and open address form do not survive an account switch');

        await act(async () => click('Add Address'));
        failNextBuyerSession = true;
        await act(async () => {
            const focusEvent = browserWindow.document.createEvent('Event');
            focusEvent.initEvent('focus');
            browserWindow.dispatchEvent(focusEvent);
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        assert.doesNotMatch(browserWindow.document.body.textContent || '', /Ben Buyer|99 Private Lane/,
            'a failed buyer-session check clears the last verified address list');
        assert.doesNotMatch(browserWindow.document.body.textContent || '', /New Address/,
            'a failed session check also clears an open buyer-address form');
        assert.match(browserWindow.document.body.textContent || '', /We could not verify your account/,
            'a session-check failure is shown as an error, never as an empty address book');
    } finally {
        await act(async () => root.unmount());
        browserWindow.close();
        Object.defineProperty(globalThis, 'window', { configurable: true, value: prior.window });
        Object.defineProperty(globalThis, 'document', { configurable: true, value: prior.document });
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: prior.navigator });
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: prior.localStorage });
        globalThis.fetch = prior.fetch;
        (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior.actEnvironment;
    }
});
