import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import AccountBottomSheet from './account-bottom-sheet';
import { CustomerAuthProvider } from '@/context/customer-auth-context';
import { WishlistProvider } from '@/context/wishlist-context';

test('account sheet hides a previous LetBuyy buyer until focus session revalidation succeeds', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    (dom as unknown as { reconfigure(options: { url: string }): void }).reconfigure({ url: 'https://store.example.test/store/demo' });
    const browserWindow = dom.window as unknown as Window & { close: () => void; navigator: Navigator };
    const prior = {
        window: globalThis.window,
        self: globalThis.self,
        document: globalThis.document,
        navigator: globalThis.navigator,
        localStorage: globalThis.localStorage,
        fetch: globalThis.fetch,
        actEnvironment: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow });
    Object.defineProperty(globalThis, 'self', { configurable: true, value: browserWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: browserWindow.document });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browserWindow.navigator });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: browserWindow.localStorage });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    let buyerEmail = 'buyer-a@example.test';
    let holdNextSession = false;
    let rejectNextSession = false;
    let resolveBuyerSession: ((response: Response) => void) | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/customer/session') return Response.json({ authenticated: false });
        if (url === '/api/buyer-auth/session') {
            if (rejectNextSession) {
                rejectNextSession = false;
                return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
            }
            if (holdNextSession) {
                holdNextSession = false;
                return new Promise<Response>(resolve => { resolveBuyerSession = resolve; });
            }
            return Response.json({ buyer: { email: buyerEmail } });
        }
        if (url === '/api/buyer/wishlist') return Response.json({ linked: false, productIds: [] });
        throw new Error(`Unexpected account-sheet request: ${url}`);
    }) as typeof fetch;

    const root = createRoot(browserWindow.document.getElementById('root')!);
    const renderSheet = () => (
        <CustomerAuthProvider storeId="store-1">
            <WishlistProvider storeId="store-1">
                <AccountBottomSheet isOpen onClose={() => undefined} storeId="store-1" subdomain="demo" />
            </WishlistProvider>
        </CustomerAuthProvider>
    );
    const focus = async () => {
        const event = browserWindow.document.createEvent('Event');
        event.initEvent('focus');
        browserWindow.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 0));
    };
    const bodyText = () => browserWindow.document.body.textContent || '';

    try {
        await act(async () => {
            root.render(renderSheet());
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.match(bodyText(), /Signed in with LetBuyy as buyer-a@example\.test/);
        assert.match(bodyText(), /View linked orders at this store/);

        // The sheet stays mounted during a tab return. Its old identity must not
        // remain visible or actionable while the canonical cookie is rechecked.
        buyerEmail = 'buyer-b@example.test';
        holdNextSession = true;
        await act(async () => { await focus(); });
        assert.doesNotMatch(bodyText(), /buyer-a@example\.test/);
        assert.match(bodyText(), /Continue with LetBuyy/);
        await act(async () => {
            resolveBuyerSession?.(Response.json({ buyer: { email: buyerEmail } }));
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.match(bodyText(), /Signed in with LetBuyy as buyer-b@example\.test/);
        assert.doesNotMatch(bodyText(), /buyer-a@example\.test/);

        rejectNextSession = true;
        await act(async () => { await focus(); });
        assert.doesNotMatch(bodyText(), /buyer-b@example\.test/);
        assert.match(bodyText(), /Continue with LetBuyy/);
    } finally {
        await act(async () => root.unmount());
        globalThis.fetch = prior.fetch;
        if (prior.window === undefined) Reflect.deleteProperty(globalThis, 'window');
        else Object.defineProperty(globalThis, 'window', { configurable: true, value: prior.window });
        if (prior.self === undefined) Reflect.deleteProperty(globalThis, 'self');
        else Object.defineProperty(globalThis, 'self', { configurable: true, value: prior.self });
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
