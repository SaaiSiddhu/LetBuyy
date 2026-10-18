import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { Button } from '@letbuyy/ui';
import { CustomerAuthProvider } from './customer-auth-context';
import { WishlistProvider, useWishlist } from './wishlist-context';

test('authenticated wishlist updates wait for confirmation and isolate concurrent item failures', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    const browserWindow = dom.window as unknown as Window & { close: () => void; navigator: Navigator };
    const prior = {
        window: globalThis.window,
        document: globalThis.document,
        navigator: globalThis.navigator,
        fetch: globalThis.fetch,
        actEnvironment: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: browserWindow.document });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browserWindow.navigator });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const pendingWrites = new Map<string, (response: Response) => void>();
    const buyerMutationHints: Array<string | null> = [];
    let wishlistReads = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/customer/session') {
            return Response.json({ authenticated: false });
        }
        if (url === '/api/buyer-auth/session') {
            return Response.json({ buyer: { id: 'buyer-1', email: 'buyer@example.test' } });
        }
        if (url === '/api/buyer/wishlist' && (!init?.method || init.method === 'GET')) {
            wishlistReads += 1;
            return Response.json({ linked: true, productIds: wishlistReads === 1 ? [] : ['site-two-product'] });
        }
        if (url === '/api/buyer/wishlist' && init?.method === 'POST') {
            const body = JSON.parse(String(init.body)) as { productId: string };
            buyerMutationHints.push(new Headers(init.headers).get('x-letbuyy-expected-buyer-id'));
            return new Promise<Response>((resolve) => pendingWrites.set(body.productId, resolve));
        }
        throw new Error(`Unexpected wishlist request: ${url} ${init?.method || 'GET'}`);
    }) as typeof fetch;

    function Probe() {
        const wishlist = useWishlist();
        return (
            <>
                <Button unstyled id="product-a" type="button" onClick={() => wishlist.toggleWishlist('product-a')}>Toggle A</Button>
                <Button unstyled id="product-b" type="button" onClick={() => wishlist.toggleWishlist('product-b')}>Toggle B</Button>
                <Button unstyled id="product-c" type="button" onClick={() => wishlist.toggleWishlist('product-c')}>Toggle C</Button>
                <output id="items">{wishlist.items.join(',')}</output>
                <output id="status">{`${wishlist.isLoading}|${wishlist.buyerStoreLinked}|${wishlist.mutationError}|${wishlist.isToggling('product-a')}`}</output>
            </>
        );
    }
    function Harness() {
        const [storeId, setStoreId] = useState('site-1');
        return (
            <>
                <Button unstyled id="switch-store" type="button" onClick={() => setStoreId('site-2')}>Switch store</Button>
                <WishlistProvider storeId={storeId}><Probe /></WishlistProvider>
            </>
        );
    }
    const root = createRoot(browserWindow.document.getElementById('root')!);

    const click = (id: string) => {
        const event = browserWindow.document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        browserWindow.document.getElementById(id)?.dispatchEvent(event);
    };
    const output = (id: string) => browserWindow.document.getElementById(id)?.textContent;

    try {
        await act(async () => {
            root.render(
                <CustomerAuthProvider storeId="site-1">
                    <Harness />
                </CustomerAuthProvider>,
            );
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(output('status'), 'false|true|false|false');

        await act(async () => {
            click('product-a');
            click('product-a');
            click('product-b');
        });
        assert.equal(pendingWrites.size, 2, 'a pending item ignores duplicate clicks while another item can save');
        assert.deepEqual(buyerMutationHints, ['buyer-1', 'buyer-1'], 'each server-backed wishlist write includes the currently loaded buyer only as a comparison hint');
        assert.equal(output('items'), '', 'server-backed state stays unchanged until each write is confirmed');
        assert.equal(output('status'), 'false|true|false|true');

        await act(async () => {
            pendingWrites.get('product-b')?.(Response.json({ success: true }));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(output('items'), 'product-b');

        await act(async () => {
            pendingWrites.get('product-a')?.(Response.json({ error: 'unavailable' }, { status: 503 }));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(output('items'), 'product-b', 'a failed save does not roll back another confirmed item');
        assert.equal(output('status'), 'false|true|true|false');

        await act(async () => click('product-c'));
        assert.equal(pendingWrites.has('product-c'), true);
        await act(async () => {
            click('switch-store');
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(output('items'), 'site-two-product');
        await act(async () => {
            pendingWrites.get('product-c')?.(Response.json({ success: true }));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(output('items'), 'site-two-product', 'a prior store response cannot populate the newly selected store wishlist');
    } finally {
        await act(async () => root.unmount());
        browserWindow.close();
        Object.defineProperty(globalThis, 'window', { configurable: true, value: prior.window });
        Object.defineProperty(globalThis, 'document', { configurable: true, value: prior.document });
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: prior.navigator });
        globalThis.fetch = prior.fetch;
        (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior.actEnvironment;
    }
});

test('a focused storefront hides its current wishlist until buyer identity is revalidated', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    const browserWindow = dom.window as unknown as Window & { close: () => void; navigator: Navigator };
    const prior = {
        window: globalThis.window,
        document: globalThis.document,
        navigator: globalThis.navigator,
        fetch: globalThis.fetch,
        actEnvironment: (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT,
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow });
    Object.defineProperty(globalThis, 'document', { configurable: true, value: browserWindow.document });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browserWindow.navigator });
    Object.defineProperty(browserWindow.document, 'visibilityState', { configurable: true, value: 'visible' });
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    let buyerEmail = 'first-buyer@example.test';
    let buyerIdentity = 'first';
    let holdNextBuyerSession = false;
    let resolveBuyerSession: ((response: Response) => void) | undefined;
    let secondBuyerWishlistReads = 0;
    let holdNextSecondBuyerWishlistRead = false;
    let resolveLateSecondBuyerWishlistRead: ((response: Response) => void) | undefined;
    let sameEmailWishlistReads = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === '/api/customer/session') return Response.json({ authenticated: false });
        if (url === '/api/buyer-auth/session') {
            if (holdNextBuyerSession) {
                holdNextBuyerSession = false;
                return new Promise<Response>((resolve) => { resolveBuyerSession = resolve; });
            }
            return Response.json({ buyer: { email: buyerEmail } });
        }
        if (url === '/api/buyer/wishlist') {
            if (buyerIdentity === 'first') return Response.json({ linked: true, productIds: ['first-buyer-private-product'] });
            if (buyerIdentity === 'second') {
                secondBuyerWishlistReads += 1;
                if (holdNextSecondBuyerWishlistRead) {
                    holdNextSecondBuyerWishlistRead = false;
                    return new Promise<Response>((resolve) => { resolveLateSecondBuyerWishlistRead = resolve; });
                }
                return Response.json({ linked: true, productIds: ['second-buyer-private-product'] });
            }
            sameEmailWishlistReads += 1;
            return Response.json({ linked: true, productIds: ['same-email-account-private-product'] });
        }
        throw new Error(`Unexpected wishlist request: ${url}`);
    }) as typeof fetch;

    function Probe() {
        const wishlist = useWishlist();
        return <>
            <Button unstyled id="switch-buyer" type="button" onClick={() => {
                buyerEmail = 'second-buyer@example.test';
                buyerIdentity = 'second';
                holdNextBuyerSession = true;
                const focusEvent = browserWindow.document.createEvent('Event');
                focusEvent.initEvent('focus');
                browserWindow.dispatchEvent(focusEvent);
            }}>Switch buyer in another tab</Button>
            <output id="items">{wishlist.items.join(',')}</output>
            <output id="visible-first-buyer-item">{String(wishlist.isInWishlist('first-buyer-private-product'))}</output>
            <output id="buyer-session">{String(wishlist.buyerSession)}</output>
            <output id="buyer-session-state">{`${wishlist.buyerSessionReady}|${wishlist.buyerSessionRefreshing}|${wishlist.buyerSessionRevision}|${wishlist.buyerSessionEmail}|${wishlist.buyerSessionUnavailable}`}</output>
            <output id="buyer-linked">{String(wishlist.buyerStoreLinked)}</output>
            <output id="loading">{String(wishlist.isLoading)}</output>
            <Button unstyled id="refresh-same-account" type="button" onClick={() => {
                holdNextSecondBuyerWishlistRead = true;
                const focusEvent = browserWindow.document.createEvent('Event');
                focusEvent.initEvent('focus');
                browserWindow.dispatchEvent(focusEvent);
            }}>Refresh current buyer tab</Button>
            <Button unstyled id="switch-same-email-buyer" type="button" onClick={() => {
                buyerIdentity = 'same-email-third';
                const focusEvent = browserWindow.document.createEvent('Event');
                focusEvent.initEvent('focus');
                browserWindow.dispatchEvent(focusEvent);
            }}>Switch to same-email account</Button>
        </>;
    }
    const root = createRoot(browserWindow.document.getElementById('root')!);
    const output = (id: string) => browserWindow.document.getElementById(id)?.textContent;
    try {
        await act(async () => {
            root.render(<CustomerAuthProvider storeId="site-1"><WishlistProvider storeId="site-1"><Probe /></WishlistProvider></CustomerAuthProvider>);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(output('items'), 'first-buyer-private-product');
        assert.equal(output('loading'), 'false');
        assert.equal(output('buyer-session'), 'true');
        assert.equal(output('buyer-session-state'), 'true|false|0|first-buyer@example.test|false');
        assert.equal(output('buyer-linked'), 'true');

        await act(async () => {
            const clickEvent = browserWindow.document.createEvent('MouseEvent');
            clickEvent.initEvent('click', true, true);
            browserWindow.document.getElementById('switch-buyer')?.dispatchEvent(clickEvent);
            await new Promise((resolve) => setTimeout(resolve, 0));
            assert.equal(output('loading'), 'true', 'the previous identity is hidden while its session is revalidated');
            assert.equal(output('items'), '', 'the prior buyer list is hidden before the session response');
            assert.equal(output('visible-first-buyer-item'), 'false');
            assert.equal(output('buyer-session'), 'false', 'the prior buyer session state is hidden until revalidation completes');
            assert.equal(output('buyer-session-state'), 'false|true|0|first-buyer@example.test|false',
                'account consumers receive a shared signal to hide while the host-only session is checked');
            assert.equal(output('buyer-linked'), 'false', 'the prior buyer link state is hidden until revalidation completes');
            assert.equal(secondBuyerWishlistReads, 0, 'wishlist loading waits for the newly validated identity');
            resolveBuyerSession?.(Response.json({ buyer: { email: buyerEmail } }));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(secondBuyerWishlistReads, 1, 'focus revalidates the host-only buyer session and loads the new buyer list');
        assert.equal(output('items'), 'second-buyer-private-product');
        assert.equal(output('visible-first-buyer-item'), 'false', 'the old buyer item is never visible under the new identity');
        assert.equal(output('loading'), 'false');
        assert.equal(output('buyer-session'), 'true');
        assert.equal(output('buyer-session-state'), 'true|false|1|second-buyer@example.test|false');
        assert.equal(output('buyer-linked'), 'true');

        await act(async () => {
            const clickEvent = browserWindow.document.createEvent('MouseEvent');
            clickEvent.initEvent('click', true, true);
            browserWindow.document.getElementById('refresh-same-account')?.dispatchEvent(clickEvent);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(typeof resolveLateSecondBuyerWishlistRead, 'function',
            'a response from the current account can remain pending across another focus refresh');
        assert.equal(output('loading'), 'true');
        assert.equal(output('items'), '', 'the current account list is hidden during revalidation');

        await act(async () => {
            const clickEvent = browserWindow.document.createEvent('MouseEvent');
            clickEvent.initEvent('click', true, true);
            browserWindow.document.getElementById('switch-same-email-buyer')?.dispatchEvent(clickEvent);
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(sameEmailWishlistReads, 1,
            'a new identity generation reloads the list even when its verified email is unchanged');
        assert.equal(output('items'), 'same-email-account-private-product');
        assert.equal(output('buyer-session'), 'true');
        assert.equal(output('loading'), 'false');

        await act(async () => {
            resolveLateSecondBuyerWishlistRead?.(Response.json({ linked: true, productIds: ['second-buyer-private-product'] }));
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        assert.equal(output('items'), 'same-email-account-private-product',
            'a late wishlist read from the prior identity generation cannot replace the newly loaded same-email account');

        assert.equal(output('visible-first-buyer-item'), 'false');
    } finally {
        await act(async () => root.unmount());
        browserWindow.close();
        Object.defineProperty(globalThis, 'window', { configurable: true, value: prior.window });
        Object.defineProperty(globalThis, 'document', { configurable: true, value: prior.document });
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: prior.navigator });
        globalThis.fetch = prior.fetch;
        (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prior.actEnvironment;
    }
});
