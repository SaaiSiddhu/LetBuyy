import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import SettingsPageClient from '../../app/store/[subdomain]/account/settings/settings-client';
import { CustomerAuthProvider } from '../../context/customer-auth-context';
import { WishlistProvider } from '../../context/wishlist-context';

test('buyer settings hide the prior profile while revalidating and reload same-email canonical identity changes', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    (dom as unknown as { reconfigure(options: { url: string }): void }).reconfigure({ url: 'https://store.example.test/account/settings' });
    const browserWindow = dom.window as unknown as Window & { close: () => void; navigator: Navigator; Event: typeof Event };
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

    let currentBuyerId = 'buyer-a';
    let holdNextSession = false;
    let failNextSession = false;
    let resolveBuyerSession: ((response: Response) => void) | undefined;
    let holdNextProfilePatch = false;
    let resolveBuyerProfilePatch: ((response: Response) => void) | undefined;
    let submittedBuyerProfile: Record<string, unknown> | undefined;
    const requests: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requests.push(url);
        if (url === '/api/customer/session') return Response.json({ authenticated: false });
        if (url === '/api/buyer-auth/session') {
            if (failNextSession) {
                failNextSession = false;
                return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
            }
            if (holdNextSession) {
                holdNextSession = false;
                return new Promise<Response>(resolve => { resolveBuyerSession = resolve; });
            }
            return Response.json({ buyer: { email: 'buyer@example.test' } });
        }
        if (url === '/api/buyer/wishlist') return Response.json({ linked: false, productIds: [] });
        if (url === '/api/buyer/profile') {
            if (init?.method === 'PATCH') {
                submittedBuyerProfile = JSON.parse(String(init.body));
                if (holdNextProfilePatch) {
                    holdNextProfilePatch = false;
                    return new Promise<Response>(resolve => { resolveBuyerProfilePatch = resolve; });
                }
            }
            return Response.json({ buyer: {
                id: currentBuyerId,
                email: 'buyer@example.test',
                email_verified: true,
                full_name: init?.method === 'PATCH'
                    ? String(submittedBuyerProfile?.fullName || '')
                    : currentBuyerId === 'buyer-b' ? 'Buyer B' : 'Buyer A',
                phone: currentBuyerId === 'buyer-b' ? '+91 22222' : '+91 11111',
            } });
        }
        throw new Error(`Unexpected settings request: ${url}`);
    }) as typeof fetch;

    const root = createRoot(browserWindow.document.getElementById('root')!);
    const renderSettings = () => (
        <CustomerAuthProvider storeId="site-1">
            <WishlistProvider storeId="site-1"><SettingsPageClient /></WishlistProvider>
        </CustomerAuthProvider>
    );
    const focus = async () => {
        const event = browserWindow.document.createEvent('Event');
        event.initEvent('focus');
        browserWindow.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 0));
    };

    try {
        await act(async () => {
            root.render(renderSettings());
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        const name = browserWindow.document.querySelector<HTMLInputElement>('#buyer-full-name');
        assert.ok(name);
        assert.equal(name.value, 'Buyer A');
        assert.ok(requests.includes('/api/buyer/profile'));

        // A focus refresh keeps the same email and principal; the account content remains gated
        // until the session check and profile reload both finish.
        holdNextSession = true;
        await act(async () => { await focus(); });
        const accountRegion = browserWindow.document.querySelector('[aria-hidden="true"]');
        assert.ok(accountRegion?.hasAttribute('hidden'), 'the old account subtree is hidden while revalidation is pending');
        assert.ok(accountRegion?.hasAttribute('inert'), 'the old account subtree cannot receive interaction while revalidation is pending');
        await act(async () => {
            resolveBuyerSession?.(Response.json({ buyer: { email: 'buyer@example.test' } }));
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.equal(browserWindow.document.querySelector<HTMLInputElement>('#buyer-full-name')?.value, 'Buyer A');

        // Same email does not prove the same principal: a different canonical buyer ID must reload the profile.
        currentBuyerId = 'buyer-b';
        holdNextSession = true;
        await act(async () => { await focus(); });
        const switchingRegion = browserWindow.document.querySelector('[aria-hidden="true"]');
        assert.ok(switchingRegion?.hasAttribute('hidden'));
        await act(async () => {
            resolveBuyerSession?.(Response.json({ buyer: { email: 'buyer@example.test' } }));
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.equal(browserWindow.document.querySelector<HTMLInputElement>('#buyer-full-name')?.value, 'Buyer B');
        assert.equal(browserWindow.document.querySelector<HTMLInputElement>('#buyer-phone')?.value, '+91 22222');

        // A save submitted for B is pinned to B. If another tab switches the cookie
        // and this page revalidates as A before the response returns, B's response
        // must not overwrite A's freshly loaded profile.
        holdNextProfilePatch = true;
        const buyerProfileForm = browserWindow.document.querySelector<HTMLFormElement>('#buyer-full-name')?.form;
        assert.ok(buyerProfileForm);
        await act(async () => {
            buyerProfileForm.dispatchEvent(new browserWindow.Event('submit', { bubbles: true, cancelable: true }));
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        assert.equal(submittedBuyerProfile?.expectedBuyerId, 'buyer-b');

        currentBuyerId = 'buyer-a';
        holdNextSession = true;
        await act(async () => { await focus(); });
        await act(async () => {
            resolveBuyerSession?.(Response.json({ buyer: { email: 'buyer@example.test' } }));
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.equal(browserWindow.document.querySelector<HTMLInputElement>('#buyer-full-name')?.value, 'Buyer A');
        await act(async () => {
            resolveBuyerProfilePatch?.(Response.json({ buyer: {
                id: 'buyer-b',
                email: 'buyer@example.test',
                email_verified: true,
                full_name: 'Buyer B',
                phone: '+91 22222',
            } }));
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.equal(browserWindow.document.querySelector<HTMLInputElement>('#buyer-full-name')?.value, 'Buyer A');

        failNextSession = true;
        await act(async () => { await focus(); });
        assert.match(browserWindow.document.body.textContent || '', /We could not check your account/);
        const unavailableRegion = browserWindow.document.querySelector('[aria-hidden="true"]');
        assert.ok(unavailableRegion?.hasAttribute('hidden'), 'a failed session check does not reveal the last buyer profile');
    } finally {
        await act(async () => root.unmount());
        globalThis.fetch = prior.fetch;
        if (prior.window === undefined) Reflect.deleteProperty(globalThis, 'window');
        else Object.defineProperty(globalThis, 'window', { configurable: true, value: prior.window });
        if (prior.document === undefined) Reflect.deleteProperty(globalThis, 'document');
        else Object.defineProperty(globalThis, 'document', { configurable: true, value: prior.document });
        if (prior.navigator === undefined) Reflect.deleteProperty(globalThis, 'navigator');
        else Object.defineProperty(globalThis, 'navigator', { configurable: true, value: prior.navigator });
        if (prior.localStorage === undefined) Reflect.deleteProperty(globalThis, 'localStorage');
        else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: prior.localStorage });
        if (prior.actEnvironment === undefined) delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
        else (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior.actEnvironment;
        browserWindow.close();
    }
});
