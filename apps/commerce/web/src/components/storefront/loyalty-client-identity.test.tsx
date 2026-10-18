import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import LoyaltyClient from '@/app/store/[subdomain]/account/loyalty/loyalty-client';
import { CustomerAuthProvider } from '@/context/customer-auth-context';
import { WishlistProvider } from '@/context/wishlist-context';

test('rewards data is hidden during buyer revalidation and reloaded for the verified buyer', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    (dom as unknown as { reconfigure(options: { url: string }): void }).reconfigure({ url: 'https://store.example.test/store/demo/account/loyalty' });
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

    let buyer = { id: 'buyer-a', email: 'buyer@example.test' };
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
                return new Promise<Response>((resolve) => { resolveBuyerSession = resolve; });
            }
            return Response.json({ buyer });
        }
        if (url === '/api/buyer/loyalty') {
            return Response.json({ enrolled: true, balance: buyer.id === 'buyer-a' ? '9001' : '2002', programActive: true });
        }
        if (url === '/api/buyer/loyalty/history') {
            return Response.json({ entries: [{ id: buyer.id, entryType: 'earned', points: buyer.id === 'buyer-a' ? '9001' : '2002', balanceAfter: buyer.id === 'buyer-a' ? '9001' : '2002', createdAt: '2026-10-10T00:00:00.000Z' }] });
        }
        throw new Error(`Unexpected loyalty request: ${url}`);
    }) as typeof fetch;

    const root = createRoot(browserWindow.document.getElementById('root')!);
    const render = () => <CustomerAuthProvider storeId="store-1"><WishlistProvider storeId="store-1"><LoyaltyClient subdomain="demo" /></WishlistProvider></CustomerAuthProvider>;
    const bodyText = () => browserWindow.document.body.textContent || '';
    const focus = async () => {
        const event = browserWindow.document.createEvent('Event');
        event.initEvent('focus');
        browserWindow.dispatchEvent(event);
        await new Promise((resolve) => setTimeout(resolve, 0));
    };
    const wait = async () => new Promise((resolve) => setTimeout(resolve, 20));

    try {
        await act(async () => {
            root.render(render());
            await wait();
        });
        assert.match(bodyText(), /9,001/);

        buyer = { id: 'buyer-b', email: 'buyer@example.test' };
        holdNextSession = true;
        await act(async () => { await focus(); });
        assert.doesNotMatch(bodyText(), /9,001/, 'buyer A balance and history must disappear while the shared cookie is revalidated');

        await act(async () => {
            resolveBuyerSession?.(Response.json({ buyer }));
            await wait();
        });
        assert.match(bodyText(), /2,002/);
        assert.doesNotMatch(bodyText(), /9,001/);

        rejectNextSession = true;
        await act(async () => { await focus(); await wait(); });
        assert.doesNotMatch(bodyText(), /2,002/, 'a failed identity check must not leave buyer B rewards visible');
        assert.match(bodyText(), /Rewards are temporarily unavailable/);
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
