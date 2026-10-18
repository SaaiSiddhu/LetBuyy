import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import SupportClient from '@/app/store/[subdomain]/account/support/support-client';
import { CustomerAuthProvider } from '@/context/customer-auth-context';
import { WishlistProvider } from '@/context/wishlist-context';

test('support tickets, messages and drafts clear across buyer changes and stale reads are ignored', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    (dom as unknown as { reconfigure(options: { url: string }): void }).reconfigure({ url: 'https://store.example.test/store/demo/account/support' });
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

    const { createRoot } = await import('react-dom/client');
    let buyer = { id: 'buyer-a', email: 'buyer@example.test' };
    let holdNextSession = false;
    let rejectNextSession = false;
    let resolveBuyerSession: ((response: Response) => void) | undefined;
    let resolveOldConversation: ((response: Response) => void) | undefined;
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
        if (url.startsWith('/api/buyer/support/tickets?')) {
            return Response.json({ tickets: [{
                id: buyer.id === 'buyer-a' ? 'ticket-a' : 'ticket-b',
                ticket_ref: buyer.id === 'buyer-a' ? 'A-100' : 'B-200',
                subject: buyer.id === 'buyer-a' ? 'Buyer A private issue' : 'Buyer B issue',
                status: 'open', topic: 'orders', created_at: '2026-10-10T00:00:00.000Z', last_agent_message_at: null,
            }], hasMore: false, nextCursor: null });
        }
        if (url.includes('/ticket-a/messages?')) {
            return new Promise<Response>((resolve) => { resolveOldConversation = resolve; });
        }
        if (url.includes('/ticket-b/messages?')) {
            return Response.json({ messages: [{ id: 'message-b', author_type: 'agent', body: 'Buyer B response', created_at: '2026-10-10T00:00:00.000Z' }], hasMore: false, nextCursor: null });
        }
        throw new Error(`Unexpected support request: ${url}`);
    }) as typeof fetch;

    const root = createRoot(browserWindow.document.getElementById('root')!);
    const render = () => <CustomerAuthProvider storeId="store-1"><WishlistProvider storeId="store-1"><SupportClient subdomain="demo" /></WishlistProvider></CustomerAuthProvider>;
    const bodyText = () => browserWindow.document.body.textContent || '';
    const wait = async () => new Promise((resolve) => setTimeout(resolve, 20));
    const clickButton = async (label: string) => {
        const element = [...browserWindow.document.querySelectorAll('button')].find((button) => button.textContent?.includes(label));
        assert.ok(element, `expected button ${label}`);
        const event = browserWindow.document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        await act(async () => { element.dispatchEvent(event); await wait(); });
    };
    const fill = async (selector: string, value: string) => {
        const input = browserWindow.document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
        assert.ok(input, `expected input ${selector}`);
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
        assert.ok(setter, 'jsdom exposes native value setters');
        setter.call(input, value);
        const event = browserWindow.document.createEvent('Event');
        event.initEvent('input', true, true);
        await act(async () => { input.dispatchEvent(event); });
    };
    const focus = async () => {
        const event = browserWindow.document.createEvent('Event');
        event.initEvent('focus');
        browserWindow.dispatchEvent(event);
        await new Promise((resolve) => setTimeout(resolve, 0));
    };

    try {
        await act(async () => { root.render(render()); await wait(); });
        assert.match(bodyText(), /Buyer A private issue/);
        await clickButton('Buyer A private issue');
        assert.equal(typeof resolveOldConversation, 'function', 'opening buyer A conversation starts its read');
        await fill('#support-subject', 'A private draft subject');
        await fill('#support-body', 'A private draft body');

        buyer = { id: 'buyer-b', email: 'buyer@example.test' };
        holdNextSession = true;
        await act(async () => { await focus(); });
        assert.doesNotMatch(bodyText(), /Buyer A private issue|A private draft|A-100/);
        assert.match(bodyText(), /Loading your support requests/);

        await act(async () => { resolveBuyerSession?.(Response.json({ buyer })); await wait(); });
        assert.match(bodyText(), /Buyer B issue/);
        assert.doesNotMatch(bodyText(), /Buyer A private issue|A private draft|A-100/);
        resolveOldConversation?.(Response.json({ messages: [{ id: 'message-a', author_type: 'agent', body: 'Buyer A private reply', created_at: '2026-10-10T00:00:00.000Z' }], hasMore: false, nextCursor: null }));
        await act(async () => { await wait(); });
        assert.doesNotMatch(bodyText(), /Buyer A private reply/);

        rejectNextSession = true;
        await act(async () => { await focus(); await wait(); });
        assert.doesNotMatch(bodyText(), /Buyer B issue|Buyer A private/);
        assert.match(bodyText(), /Support unavailable/);
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

test('mounted support saves only immutable identity, blocks changed text, and reload recovers canonical result without resending', async () => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    (dom as unknown as { reconfigure(options: { url: string }): void }).reconfigure({ url: 'https://store.example.test/store/demo/account/support' });
    const win = dom.window as unknown as Window & { Event: typeof Event; close: () => void };
    const names = ['window','self','document','navigator','localStorage'] as const;
    const prior = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
    const priorFetch = globalThis.fetch, priorAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' || name === 'self' ? win : win[name] });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { createRoot } = await import('react-dom/client');
    const buyerId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', ticketId = 'cccccccc-3333-4333-8333-cccccccccccc', messageId = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
    Object.defineProperty(win.navigator, 'locks', { configurable: true, value: { request: async (_name: string, _options: unknown, run: () => unknown) => run() } });
    const timestamp = '2026-10-18T00:00:00Z';
    let key = '', writes = 0, recoveries = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input), headers = new Headers(init?.headers);
        if (url === '/api/customer/session') return Response.json({ authenticated: false });
        if (url === '/api/buyer-auth/session') return Response.json({ buyer: { id: buyerId, email: 'synthetic@example.invalid' } });
        if (url.startsWith('/api/buyer/support/tickets?')) return Response.json({ tickets: [], hasMore: false, nextCursor: null });
        if (url.includes('/messages?')) return Response.json({ messages: [{ id: messageId, author_type: 'requester', body: 'Original private complaint', created_at: timestamp }], hasMore: false, nextCursor: null });
        assert.equal(headers.get('x-letbuyy-expected-buyer-id'), buyerId);
        const body = JSON.parse(String(init?.body));
        if (body.action === 'recover') {
            recoveries++; assert.deepEqual(body, { action: 'recover', key });
            if (recoveries === 1) return Response.json({ error: 'Not confirmed yet' }, { status: 404 });
            return Response.json({ ticket: { id: ticketId, ticket_ref: 'SUP-1', subject: 'Original private subject', status: 'open', created_at: timestamp }, complaintCopy: { subject: 'Original private subject', body: 'Original private complaint', recordedAt: timestamp }, receiptConfirmedAt: timestamp, mutationReceipt: { key, operation: 'create', ticket_id: ticketId, message_id: messageId, confirmed_at: timestamp } });
        }
        writes++; key = headers.get('X-Idempotency-Key')!; assert.ok(key); assert.deepEqual(body, { subject: 'Original private subject', body: 'Original private complaint' });
        return Response.json({ error: 'Synthetic response lost after commit' }, { status: 503 });
    }) as typeof fetch;
    let root = createRoot(win.document.getElementById('root')!);
    const wait = () => new Promise(resolve => setTimeout(resolve, 30));
    const render = () => <CustomerAuthProvider storeId="store-1"><WishlistProvider storeId="store-1"><SupportClient subdomain="demo" /></WishlistProvider></CustomerAuthProvider>;
    const fill = async (selector: string, value: string) => {
        const input = win.document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!; assert.ok(input);
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!.call(input, value);
        await act(async () => { input.dispatchEvent(new win.Event('input', { bubbles: true })); await wait(); });
    };
    const submit = async () => { await act(async () => { win.document.querySelector('form')!.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); await wait(); }); };
    try {
        await act(async () => { root.render(render()); await wait(); });
        await fill('#support-subject', 'Original private subject'); await fill('#support-body', 'Original private complaint'); await submit();
        assert.equal(writes, 1, 'the mounted form reached the write boundary');
        assert.match(win.document.body.textContent!, /Saved action awaiting confirmation/);
        const saved = Array.from({ length: win.localStorage.length }, (_, i) => [win.localStorage.key(i), win.localStorage.getItem(win.localStorage.key(i)!)]);
        const supportSaved = saved.filter(([name]) => name?.startsWith('lb_support_pending_v1:'));
        assert.equal(supportSaved.length, 1); assert.doesNotMatch(JSON.stringify(supportSaved), /Original private|complaint|subject|body|token|proof|credential/);
        await fill('#support-body', 'Different intent'); await submit(); assert.equal(writes, 1); assert.match(win.document.body.textContent!, /Recover your saved action/);
        await act(async () => root.unmount()); root = createRoot(win.document.getElementById('root')!);
        await act(async () => { root.render(render()); await wait(); });
        assert.equal(win.document.querySelector<HTMLTextAreaElement>('#support-body')!.value, '');
        assert.doesNotMatch(win.document.body.textContent!, /Original private/);
        const check = [...win.document.querySelectorAll('button')].find(button => button.textContent === 'Check saved action')!; assert.ok(check);
        await act(async () => { check.click(); await wait(); });
        assert.equal(recoveries, 1); assert.equal(writes, 1); assert.match(win.document.body.textContent!, /No confirmed result is available yet/);
        assert.equal(Array.from({ length: win.localStorage.length }, (_, i) => win.localStorage.key(i)).filter(name => name?.startsWith('lb_support_pending_v1:')).length, 1);
        await act(async () => { check.click(); await wait(); });
        assert.equal(recoveries, 2); assert.equal(writes, 1); assert.match(win.document.body.textContent!, /Request received|Original private complaint/);
        assert.equal(Array.from({ length: win.localStorage.length }, (_, i) => win.localStorage.key(i)).filter(name => name?.startsWith('lb_support_pending_v1:')).length, 0);
    } finally {
        await act(async () => root.unmount()); globalThis.fetch = priorFetch;
        for (const name of names) { const descriptor = prior.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); }
        if (priorAct === undefined) delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT; else (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = priorAct;
        win.close();
    }
});
