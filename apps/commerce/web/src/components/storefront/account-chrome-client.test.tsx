import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import AccountChromeClient from '../../app/store/[subdomain]/account/account-chrome-client';
import { CustomerAuthProvider } from '@/context/customer-auth-context';
import { WishlistProvider } from '@/context/wishlist-context';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext, PathParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

test('account chrome keeps prior buyer details inert until the refreshed session is verified', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    (dom as unknown as { reconfigure(options: { url: string }): void }).reconfigure({ url: 'https://store.example.test/store/demo/account/settings' });
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
    const redirects: string[] = [];
    const router = { push: (path: string) => redirects.push(path) } as unknown as AppRouterInstance;
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
        throw new Error(`Unexpected account-chrome request: ${url}`);
    }) as typeof fetch;

    const root = createRoot(browserWindow.document.getElementById('root')!);
    const renderChrome = () => (
        <AppRouterContext.Provider value={router}>
            <PathnameContext.Provider value="/store/demo/account/settings">
                <PathParamsContext.Provider value={{ subdomain: 'demo' }}>
                    <CustomerAuthProvider storeId="store-1">
                        <WishlistProvider storeId="store-1">
                            <AccountChromeClient><p>Account settings content</p></AccountChromeClient>
                        </WishlistProvider>
                    </CustomerAuthProvider>
                </PathParamsContext.Provider>
            </PathnameContext.Provider>
        </AppRouterContext.Provider>
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
            root.render(renderChrome());
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.match(bodyText(), /buyer-a@example\.test/);
        assert.match(bodyText(), /Account settings content/);

        buyerEmail = 'buyer-b@example.test';
        holdNextSession = true;
        await act(async () => { await focus(); });
        const accountContent = [...browserWindow.document.querySelectorAll('[aria-hidden="true"]')]
            .find(element => element.textContent?.includes('Account settings content'));
        assert.ok(accountContent, 'the prior account subtree is hidden from assistive technology');
        assert.ok(accountContent.hasAttribute('inert'), 'the prior account subtree is not interactive');
        assert.match(bodyText(), /buyer-a@example\.test/, 'the hidden subtree retains its state until revalidation resolves');
        assert.equal(redirects.length, 0, 'a pending revalidation does not redirect away from the account');

        await act(async () => {
            resolveBuyerSession?.(Response.json({ buyer: { email: buyerEmail } }));
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.match(bodyText(), /buyer-b@example\.test/);
        assert.doesNotMatch(bodyText(), /buyer-a@example\.test/);
        assert.equal(redirects.length, 0);

        rejectNextSession = true;
        await act(async () => { await focus(); });
        assert.match(bodyText(), /We could not check your account right now/);
        assert.doesNotMatch(bodyText(), /buyer-b@example\.test/);
        assert.equal(redirects.length, 0, 'an unavailable session shows a retryable error instead of redirecting');
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
