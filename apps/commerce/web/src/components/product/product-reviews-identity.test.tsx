import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import ProductReviews from './product-reviews';
import { CustomerAuthProvider } from '@/context/customer-auth-context';
import { WishlistProvider } from '@/context/wishlist-context';

test('review form hides and clears when the verified buyer session changes', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    (dom as unknown as { reconfigure(options: { url: string }): void }).reconfigure({ url: 'https://store.example.test/products/widget' });
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
    let submittedExpectedBuyerId: string | null = null;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
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
            return Response.json({ buyer });
        }
        if (url === '/api/buyer/wishlist') return Response.json({ linked: false, productIds: [] });
        if (url.startsWith('/api/reviews?')) {
            return Response.json({ reviews: [], summary: { totalReviews: 0, averageRating: 0, distribution: [] } });
        }
        if (url === '/api/reviews' && init?.method === 'POST') {
            submittedExpectedBuyerId = new Headers(init.headers).get('x-letbuyy-expected-buyer-id');
            return Response.json({ error: 'Your account changed. Reload before submitting this review.' }, { status: 409 });
        }
        throw new Error(`Unexpected review request: ${url}`);
    }) as typeof fetch;

    const root = createRoot(browserWindow.document.getElementById('root')!);
    const renderReviews = () => (
        <CustomerAuthProvider storeId="store-1">
            <WishlistProvider storeId="store-1">
                <ProductReviews productId="product-1" storeId="store-1" />
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
    const clickButton = async (label: string) => {
        const button = [...browserWindow.document.querySelectorAll('button')]
            .find(item => item.textContent?.trim() === label);
        assert.ok(button, `expected button ${label}`);
        const event = browserWindow.document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        await act(async () => { button.dispatchEvent(event); });
    };
    const changeInput = async (input: HTMLInputElement, value: string) => {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
        assert.ok(setter, 'jsdom exposes the native input value setter');
        setter.call(input, value);
        const event = browserWindow.document.createEvent('Event');
        event.initEvent('input', true, true);
        await act(async () => { input.dispatchEvent(event); });
    };

    try {
        await act(async () => {
            root.render(renderReviews());
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        await clickButton('Write a Review');
        assert.ok(browserWindow.document.querySelector('form'));
        assert.match(bodyText(), /Signed in with LetBuyy as buyer@example\.test/);
        const title = browserWindow.document.querySelector<HTMLInputElement>('input[placeholder="Review Title (optional)"]');
        assert.ok(title);
        await changeInput(title, 'Private buyer A draft');
        assert.equal(title.value, 'Private buyer A draft');

        buyer = { id: 'buyer-b', email: 'buyer@example.test' };
        holdNextSession = true;
        await act(async () => { await focus(); });
        assert.equal(browserWindow.document.querySelector('form'), null, 'the prior buyer review form is hidden during revalidation');
        assert.doesNotMatch(bodyText(), /buyer-a@example\.test/);

        await act(async () => {
            resolveBuyerSession?.(Response.json({ buyer }));
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        assert.equal(browserWindow.document.querySelector('form'), null, 'the old draft is discarded when another buyer is confirmed');
        assert.doesNotMatch(bodyText(), /buyer-a@example\.test/);
        await clickButton('Write a Review');
        assert.match(bodyText(), /Signed in with LetBuyy as buyer@example.test/);
        assert.equal(browserWindow.document.querySelector<HTMLInputElement>('input[placeholder="Review Title (optional)"]')?.value, '');
        const buyerBTitle = browserWindow.document.querySelector<HTMLInputElement>('input[placeholder="Review Title (optional)"]');
        assert.ok(buyerBTitle);
        await changeInput(buyerBTitle, 'Buyer B review draft');
        const reviewForm = browserWindow.document.querySelector('form');
        assert.ok(reviewForm);
        const ratingButton = reviewForm.querySelectorAll('button')[4];
        assert.ok(ratingButton, 'the review form exposes five rating controls');
        const ratingClick = browserWindow.document.createEvent('MouseEvent');
        ratingClick.initEvent('click', true, true);
        await act(async () => { ratingButton.dispatchEvent(ratingClick); });
        const submitEvent = browserWindow.document.createEvent('Event');
        submitEvent.initEvent('submit', true, true);
        await act(async () => { reviewForm.dispatchEvent(submitEvent); });
        assert.equal(submittedExpectedBuyerId, 'buyer-b', 'the stale-form comparison header is the canonical buyer rendered by the form');
        assert.match(bodyText(), /Your account changed\. Reload before submitting this review\./);

        rejectNextSession = true;
        await act(async () => { await focus(); });
        assert.equal(browserWindow.document.querySelector('form'), null, 'session verification failure clears the buyer-bound form');
        assert.doesNotMatch(bodyText(), /buyer-b@example\.test/);
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
