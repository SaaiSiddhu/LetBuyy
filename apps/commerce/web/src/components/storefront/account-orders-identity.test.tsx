import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import OrdersClient from '../../app/store/[subdomain]/account/orders/(list)/orders-client';
import OrderDetailClient from '../../app/store/[subdomain]/account/orders/[id]/order-detail-client';
import AccountChromeClient from '../../app/store/[subdomain]/account/account-chrome-client';
import { CustomerAuthProvider } from '../../context/customer-auth-context';
import { WishlistProvider } from '../../context/wishlist-context';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext, PathParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

const orderA = {
    id: 'order-a',
    order_number: 'A-PRIVATE-ORDER',
    status: 'processing',
    total: 1234,
    currency: 'INR',
    created_at: '2026-10-01T00:00:00.000Z',
    items: [{ name: 'A private item', quantity: 1, price: 1234 }],
};

async function withMountedAccount(
    renderAccount: () => React.ReactNode,
    fetchHandler: (url: string) => Promise<Response>,
    run: (document: Document, switchBuyer: () => Promise<void>, failSession: () => Promise<void>) => Promise<void>,
) {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    (dom as unknown as { reconfigure(options: { url: string }): void }).reconfigure({
        url: 'https://store.example.test/store/demo/account/orders',
    });
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
    let failNextSession = false;
    let resolveBuyerSession: ((response: Response) => void) | undefined;
    const router = { push: () => undefined } as unknown as AppRouterInstance;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
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
            return Response.json({ buyer: { email: buyerEmail } });
        }
        if (url === '/api/buyer/wishlist') return Response.json({ linked: false, productIds: [] });
        return fetchHandler(url);
    }) as typeof fetch;

    const root = createRoot(browserWindow.document.getElementById('root')!);
    const tree = () => (
        <AppRouterContext.Provider value={router}>
            <PathnameContext.Provider value="/store/demo/account/orders">
                <PathParamsContext.Provider value={{ subdomain: 'demo' }}>
                    <CustomerAuthProvider storeId="store-1">
                        <WishlistProvider storeId="store-1">
                            <AccountChromeClient>{renderAccount()}</AccountChromeClient>
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

    try {
        await act(async () => {
            root.render(tree());
            await new Promise(resolve => setTimeout(resolve, 30));
        });
        const switchBuyer = async () => {
            buyerEmail = 'buyer-b@example.test';
            holdNextSession = true;
            await act(async () => { await focus(); });
            await act(async () => {
                resolveBuyerSession?.(Response.json({ buyer: { email: buyerEmail } }));
                await new Promise(resolve => setTimeout(resolve, 30));
            });
        };
        const failSession = async () => {
            failNextSession = true;
            await act(async () => { await focus(); });
        };
        await run(browserWindow.document, switchBuyer, failSession);
    } finally {
        await act(async () => root.unmount());
        globalThis.fetch = prior.fetch;
        for (const key of ['window', 'self', 'document', 'navigator', 'localStorage'] as const) {
            const value = prior[key];
            if (value === undefined) Reflect.deleteProperty(globalThis, key);
            else Object.defineProperty(globalThis, key, { configurable: true, value });
        }
        const globalWithAct = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
        if (prior.actEnvironment === undefined) delete globalWithAct.IS_REACT_ACT_ENVIRONMENT;
        else globalWithAct.IS_REACT_ACT_ENVIRONMENT = prior.actEnvironment;
        browserWindow.close();
    }
}

test('linked order list reloads for the verified buyer after a cross-tab session change', async () => {
    const requests: string[] = [];
    await withMountedAccount(() => <OrdersClient />, async (url) => {
        requests.push(url);
        if (url === '/api/buyer/orders?limit=20') {
            const isBuyerA = requests.filter(request => request === url).length === 1;
            return Response.json({ orders: isBuyerA ? [orderA] : [], nextCursor: null, hasMore: false });
        }
        throw new Error(`Unexpected order-list request: ${url}`);
    }, async (document, switchBuyer, failSession) => {
        assert.match(document.body.textContent || '', /A-PRIVATE-ORDER/);
        await switchBuyer();
        assert.doesNotMatch(document.body.textContent || '', /A-PRIVATE-ORDER/);
        assert.match(document.body.textContent || '', /No linked orders yet/);
        assert.equal(requests.filter(url => url === '/api/buyer/orders?limit=20').length, 2);
        await failSession();
        assert.doesNotMatch(document.body.textContent || '', /A-PRIVATE-ORDER/);
        assert.match(document.body.textContent || '', /We could not check your account right now/);
    });
});

test('linked order detail discards the prior buyer order and rechecks ownership after a cross-tab change', async () => {
    const requests: string[] = [];
    await withMountedAccount(() => <OrderDetailClient subdomain="demo" id="order-a" />, async (url) => {
        requests.push(url);
        if (url === '/api/buyer/orders?order_id=order-a') {
            const isBuyerA = requests.filter(request => request === url).length === 1;
            return isBuyerA
                ? Response.json({ order: orderA })
                : Response.json({ error: 'Order not found' }, { status: 404 });
        }
        throw new Error(`Unexpected order-detail request: ${url}`);
    }, async (document, switchBuyer, failSession) => {
        assert.match(document.body.textContent || '', /A-PRIVATE-ORDER/);
        await switchBuyer();
        assert.doesNotMatch(document.body.textContent || '', /A-PRIVATE-ORDER|A private item/);
        assert.match(document.body.textContent || '', /Order unavailable/);
        assert.match(document.body.textContent || '', /could not find this order/);
        assert.equal(requests.filter(url => url === '/api/buyer/orders?order_id=order-a').length, 2);
        await failSession();
        assert.doesNotMatch(document.body.textContent || '', /A-PRIVATE-ORDER|A private item/);
        assert.match(document.body.textContent || '', /We could not check your account right now/);
    });
});
