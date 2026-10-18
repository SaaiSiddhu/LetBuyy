import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { BUYER_TOKEN, SITE_ID, buyerCookieHeader, installGatewayFake, jsonResponse, type RecordedGatewayRequest } from '@/lib/api/gateway-fetch-fake.test-support';
import * as ticketsRoute from './tickets/route';
import * as messagesRoute from './tickets/[ticketId]/messages/route';

const ORIGIN = 'http://snaz.localhost:9000';
const TICKET_ID = 'cccccccc-3333-4333-8333-cccccccccccc';
const BUYER_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const MESSAGE_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const INTERNAL_SECRET = 'synthetic-support-resolution-secret';
const NO_STORE = (response: Response) => assert.equal(response.headers.get('cache-control'), 'no-store');

function makeRequest(path: string, options: { method?: string; cookie?: string | null; body?: unknown; origin?: string; expected?: string | null; key?: string } = {}) {
    const headers = new Headers({ host: new URL(ORIGIN).host });
    if (options.expected !== null && options.method === 'POST') headers.set('x-letbuyy-expected-buyer-id', options.expected ?? BUYER_ID);
    if (options.key) headers.set('X-Idempotency-Key', options.key);
    if (options.cookie !== null) headers.set('cookie', options.cookie ?? buyerCookieHeader());
    if (options.method && options.method !== 'GET') headers.set('origin', options.origin ?? ORIGIN);
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    return new NextRequest(`${ORIGIN}${path}`, {
        method: options.method ?? 'GET', headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
}

async function withGateway<T>(respond: (request: RecordedGatewayRequest) => Response | Promise<Response>, run: (requests: RecordedGatewayRequest[]) => Promise<T>, profile: Response | (() => Response) = () => jsonResponse({ data: { buyer: { id: BUYER_ID } } })) {
    const previous = process.env.INTERNAL_API_SECRET;
    process.env.INTERNAL_API_SECRET = INTERNAL_SECRET;
    const requests: RecordedGatewayRequest[] = [];
    const fake = installGatewayFake((request) => {
        if (request.url.pathname.endsWith('/internal/store-access/resolve')) {
            assert.equal(request.headers.get('x-internal-api-secret'), INTERNAL_SECRET);
            return jsonResponse({ data: { site_id: SITE_ID } });
        }
        if (request.url.pathname.endsWith('/buyer/profile')) {
            assert.equal(request.headers.get(LETBUYY_STOREFRONT_SESSION_HEADER), BUYER_TOKEN);
            return typeof profile === 'function' ? profile() : profile;
        }
        requests.push(request);
        return respond(request);
    });
    try { return await run(requests); }
    finally {
        fake.restore();
        if (previous === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = previous;
    }
}

test('support ticket list is private, host-scoped, and projects only ticket fields', async () => {
    const ticket = { id: TICKET_ID, ticket_ref: 'SUP-1', subject: 'Delivery', status: 'open', topic: null, created_at: '2026-10-05T00:00:00Z', last_agent_message_at: null, requester_user_id: 'must-not-leak' };
    await withGateway((request) => {
        assert.equal(request.method, 'GET');
        assert.equal(request.url.pathname, '/v1/storefront/buyer/support/tickets');
        assert.deepEqual([...request.url.searchParams], [['store_id', SITE_ID], ['limit', '7']]);
        assert.equal(request.headers.get(LETBUYY_STOREFRONT_SESSION_HEADER), BUYER_TOKEN);
        return jsonResponse({ success: true, data: [ticket], headers: { 'Set-Cookie': 'ignored=1' } });
    }, async (requests) => {
        const response = await ticketsRoute.GET(makeRequest('/api/buyer/support/tickets?limit=7&store_id=forged&buyer_id=forged'));
        assert.equal(response.status, 200);
        NO_STORE(response);
        assert.deepEqual(await response.json(), { tickets: [{ id: TICKET_ID, ticket_ref: 'SUP-1', subject: 'Delivery', status: 'open', topic: null, created_at: '2026-10-05T00:00:00Z', last_agent_message_at: null }] });
        assert.equal(requests.length, 1);
    });
});

test('ticket creation drops caller store ids and displays only the persisted complaint receipt', async () => {
    await withGateway((request) => {
        assert.equal(request.method, 'POST');
        assert.equal(request.url.pathname, '/v1/storefront/buyer/support/tickets');
        assert.deepEqual([...request.url.searchParams], [['store_id', SITE_ID]]);
        assert.deepEqual(JSON.parse(request.body || '{}'), { subject: 'Damaged box', body: 'The seal was open.', site_id: SITE_ID });
        assert.equal(request.headers.get(LETBUYY_STOREFRONT_SESSION_HEADER), BUYER_TOKEN);
        return jsonResponse({ success: true, data: {
            id: TICKET_ID, ticket_ref: 'SUP-1', subject: 'Damaged box', status: 'open', topic: null,
            created_at: '2026-10-05T00:00:00Z', last_agent_message_at: null,
            complaint_copy: { subject: 'Damaged box', body: 'The seal was open.', recorded_at: '2026-10-05T00:00:01Z' },
            receipt_confirmed_at: '2026-10-05T00:00:01Z', requester_user_id: 'must-not-leak',
        } }, { status: 201 });
    }, async (requests) => {
        const response = await ticketsRoute.POST(makeRequest('/api/buyer/support/tickets', { method: 'POST', body: { subject: 'Damaged box', body: 'The seal was open.', site_id: 'dddddddd-4444-4444-8444-dddddddddddd' } }));
        assert.equal(response.status, 201);
        NO_STORE(response);
        assert.deepEqual(await response.json(), {
            ticket: { id: TICKET_ID, ticket_ref: 'SUP-1', subject: 'Damaged box', status: 'open', topic: null, created_at: '2026-10-05T00:00:00Z', last_agent_message_at: null },
            complaintCopy: { subject: 'Damaged box', body: 'The seal was open.', recordedAt: '2026-10-05T00:00:01Z' },
            receiptConfirmedAt: '2026-10-05T00:00:01Z',
        });
        assert.equal(requests.length, 1);
    });
});

test('a malformed complaint is rejected before any Gateway write', async () => {
    await withGateway(() => { throw new Error('Gateway must not be called'); }, async (requests) => {
        const response = await ticketsRoute.POST(makeRequest('/api/buyer/support/tickets', { method: 'POST', body: { subject: '   ', body: 'message' } }));
        assert.equal(response.status, 400);
        NO_STORE(response);
        assert.equal(requests.length, 0);
    });
});

test('messages use the verified site and opaque ticket path; malformed ticket IDs fail locally', async () => {
    const message = { id: MESSAGE_ID, author_type: 'agent', body: 'We can help.', created_at: '2026-10-05T00:01:00Z', visibility: 'public' };
    await withGateway((request) => {
        assert.equal(request.method, 'GET');
        assert.equal(request.url.pathname, `/v1/storefront/buyer/support/tickets/${TICKET_ID}/messages`);
        assert.deepEqual([...request.url.searchParams], [['store_id', SITE_ID]]);
        assert.equal(request.headers.get(LETBUYY_STOREFRONT_SESSION_HEADER), BUYER_TOKEN);
        return jsonResponse({ success: true, data: [message] });
    }, async (requests) => {
        const response = await messagesRoute.GET(makeRequest(`/api/buyer/support/tickets/${TICKET_ID}/messages`), { params: Promise.resolve({ ticketId: TICKET_ID }) });
        assert.equal(response.status, 200);
        NO_STORE(response);
        assert.deepEqual(await response.json(), { messages: [{ id: MESSAGE_ID, author_type: 'agent', body: 'We can help.', created_at: '2026-10-05T00:01:00Z' }] });
        assert.equal(requests.length, 1);

        const invalid = await messagesRoute.GET(makeRequest('/api/buyer/support/tickets/not-a-uuid/messages'), { params: Promise.resolve({ ticketId: 'not-a-uuid' }) });
        assert.equal(invalid.status, 400);
        assert.equal(requests.length, 1);
    });
});

test('message replies forward only text and never caller author or visibility', async () => {
    await withGateway((request) => {
        assert.equal(request.method, 'POST');
        assert.equal(request.url.pathname, `/v1/storefront/buyer/support/tickets/${TICKET_ID}/messages`);
        assert.deepEqual([...request.url.searchParams], [['store_id', SITE_ID]]);
        assert.deepEqual(JSON.parse(request.body || '{}'), { body: 'More details.' });
        return jsonResponse({ success: true, data: { id: MESSAGE_ID, author_type: 'requester', body: 'More details.', created_at: '2026-10-05T00:02:00Z', visibility: 'public' } }, { status: 201 });
    }, async (requests) => {
        const response = await messagesRoute.POST(makeRequest(`/api/buyer/support/tickets/${TICKET_ID}/messages`, { method: 'POST', body: { body: ' More details. ', author_type: 'agent', visibility: 'internal' } }), { params: Promise.resolve({ ticketId: TICKET_ID }) });
        assert.equal(response.status, 201);
        NO_STORE(response);
        assert.deepEqual(await response.json(), { message: { id: MESSAGE_ID, author_type: 'requester', body: 'More details.', created_at: '2026-10-05T00:02:00Z' } });
        assert.equal(requests.length, 1);
    });
});

test('support writes require a same-origin canonical buyer session', async () => {
    await withGateway(() => { throw new Error('Gateway must not be called'); }, async (requests) => {
        const noCookie = await ticketsRoute.POST(makeRequest('/api/buyer/support/tickets', { method: 'POST', cookie: null, body: { subject: 'x', body: 'y' } }));
        assert.equal(noCookie.status, 401);
        const crossOrigin = await ticketsRoute.POST(makeRequest('/api/buyer/support/tickets', { method: 'POST', origin: 'https://attacker.example', body: { subject: 'x', body: 'y' } }));
        assert.equal(crossOrigin.status, 403);
        NO_STORE(noCookie);
        NO_STORE(crossOrigin);
        assert.equal(requests.length, 0);
    });
});

const recorded = (key: string, operation: 'create' | 'reply') => ({ key, operation, ticket_id: TICKET_ID, message_id: MESSAGE_ID, confirmed_at: '2026-10-05T00:02:00Z' });
const result = (key: string, operation: 'create' | 'reply') => operation === 'reply'
    ? { id: MESSAGE_ID, author_type: 'requester', body: 'Original text', created_at: '2026-10-05T00:02:00Z', mutation_receipt: recorded(key, operation) }
    : { id: TICKET_ID, ticket_ref: 'SUP-1', subject: 'Original subject', status: 'open', created_at: '2026-10-05T00:02:00Z', complaint_copy: { subject: 'Original subject', body: 'Original text', recorded_at: '2026-10-05T00:02:00Z' }, mutation_receipt: recorded(key, operation) };
const ctx = () => ({ params: Promise.resolve({ ticketId: TICKET_ID }) });
test('create and reply forward the immutable key and retain canonical receipt identity', async () => {
    for (const operation of ['create','reply'] as const) {
        const key = `support-key-${operation}`, path = `/api/buyer/support/tickets${operation === 'reply' ? `/${TICKET_ID}/messages` : ''}`;
        await withGateway(request => {
            assert.equal(request.headers.get('X-Idempotency-Key'), key);
            return jsonResponse({ data: result(key, operation) }, { status: 201 });
        }, async requests => {
            const request = makeRequest(path, { method: 'POST', key, body: { subject: 'Original subject', body: 'Original text' } });
            const response = operation === 'create' ? await ticketsRoute.POST(request) : await messagesRoute.POST(request, ctx());
            assert.equal(response.status, 201); assert.deepEqual((await response.json()).mutationReceipt, recorded(key, operation)); assert.equal(requests.length, 1);
        });
    }
});
test('captured buyer mismatch, absent expected buyer and unavailable verification refuse before effect', async () => {
    for (const operation of ['create','reply'] as const) for (const scenario of ['missing','changed','unavailable'] as const) {
        await withGateway(() => { throw Error('must not reach support'); }, async requests => {
            const request = makeRequest('/api/buyer/support/tickets', { method: 'POST', expected: scenario === 'missing' ? null : BUYER_ID, key: 'support-test-key', body: { subject: 'Original subject', body: 'Original text' } });
            const response = operation === 'create' ? await ticketsRoute.POST(request) : await messagesRoute.POST(request, ctx());
            assert.equal(response.status, scenario === 'missing' ? 400 : scenario === 'changed' ? 409 : 503); NO_STORE(response); assert.equal(requests.length, 0);
        }, () => scenario === 'changed' ? jsonResponse({ data: { buyer: { id: MESSAGE_ID } } }) : jsonResponse({ error: 'unavailable' }, { status: 503 }));
    }
});
test('recovery sends only canonical action identity in POST body and preserves 404 uncertainty', async () => {
    for (const operation of ['create','reply'] as const) {
        const key = `support-key-${operation}`;
        await withGateway(request => {
            assert.equal(request.url.pathname, '/v1/storefront/buyer/support/tickets/recovery');
            assert.equal(request.url.searchParams.get('store_id'), SITE_ID); assert.equal(request.url.searchParams.has('key'), false);
            assert.deepEqual(JSON.parse(request.body!), { operation, target_id: operation === 'reply' ? TICKET_ID : null, key });
            return jsonResponse({ data: result(key, operation) });
        }, async () => {
            const request = makeRequest('/api/buyer/support/tickets', { method: 'POST', body: { action: 'recover', key, site_id: 'forged' } });
            const response = operation === 'create' ? await ticketsRoute.POST(request) : await messagesRoute.POST(request, ctx());
            assert.equal(response.status, 200); assert.equal((await response.json()).mutationReceipt.key, key); NO_STORE(response);
        });
    }
    await withGateway(() => jsonResponse({ error: { message: 'Support receipt unavailable' } }, { status: 404 }), async () => {
        const response = await ticketsRoute.POST(makeRequest('/api/buyer/support/tickets', { method: 'POST', body: { action: 'recover', key: 'support-test-key' } })); assert.equal(response.status, 404);
    });
});
test('modern history forwards cursors and fails closed on private, foreign or malformed projections', async () => {
    await withGateway(request => {
        assert.equal(request.url.searchParams.get('pagination'), 'cursor'); assert.equal(request.url.searchParams.get('cursor'), 'opaque-page');
        return jsonResponse({ data: { items: [], has_more: true, next_cursor: 'next-page' } });
    }, async () => {
        const response = await ticketsRoute.GET(makeRequest('/api/buyer/support/tickets?pagination=cursor&cursor=opaque-page'));
        assert.deepEqual(await response.json(), { tickets: [], hasMore: true, nextCursor: 'next-page' });
    });
    for (const extra of [{ visibility: 'internal' }, { ticket_id: BUYER_ID }, { id: 'malformed' }]) {
        await withGateway(() => jsonResponse({ data: [{ id: MESSAGE_ID, author_type: 'agent', body: 'Must not escape', created_at: '2026-10-05T00:02:00Z', ...extra }] }), async () => {
            const response = await messagesRoute.GET(makeRequest('/api/buyer/support/tickets'), ctx()); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /Must not escape/);
        });
    }
});
test('mismatched receipts and different canonical text remain ambiguous, never claimed confirmed', async () => {
    for (const data of [{ ...result('support-wrong-key','create') }, { ...result('support-test-key','create'), complaint_copy: { subject: 'Original subject', body: 'Other text', recorded_at: '2026-10-05T00:02:00Z' } }]) {
        await withGateway(() => jsonResponse({ data }, { status: 201 }), async () => {
            const response = await ticketsRoute.POST(makeRequest('/api/buyer/support/tickets', { method: 'POST', key: 'support-test-key', body: { subject: 'Original subject', body: 'Original text' } })); assert.equal(response.status, 503);
        });
    }
});

test('mismatched host wrapper and conflicting action headers refuse before effect', async () => {
    await withGateway(() => { throw Error('no support request permitted'); }, async requests => {
        const foreignHost = await ticketsRoute.POST(makeRequest('/api/buyer/support/tickets', { method: 'POST', cookie: buyerCookieHeader(BUYER_TOKEN, MESSAGE_ID), body: { subject: 'Original subject', body: 'Original text' } })); assert.equal(foreignHost.status, 401);
        const conflict = makeRequest('/api/buyer/support/tickets', { method: 'POST', key: 'support-first-key', body: { subject: 'Original subject', body: 'Original text' } }); conflict.headers.set('Idempotency-Key','support-other-key');
        assert.equal((await ticketsRoute.POST(conflict)).status, 400); assert.equal(requests.length, 0);
    });
});
