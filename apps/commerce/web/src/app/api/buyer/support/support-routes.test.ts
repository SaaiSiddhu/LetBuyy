import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { BUYER_TOKEN, SITE_ID, buyerCookieHeader, installGatewayFake, jsonResponse, type RecordedGatewayRequest } from '@/lib/api/gateway-fetch-fake.test-support';
import * as ticketsRoute from './tickets/route';
import * as messagesRoute from './tickets/[ticketId]/messages/route';

const ORIGIN = 'http://snaz.localhost:9000';
const TICKET_ID = 'cccccccc-3333-4333-8333-cccccccccccc';
const INTERNAL_SECRET = 'synthetic-support-resolution-secret';
const NO_STORE = (response: Response) => assert.equal(response.headers.get('cache-control'), 'no-store');

function makeRequest(path: string, options: { method?: string; cookie?: string | null; body?: unknown; origin?: string } = {}) {
    const headers = new Headers({ host: new URL(ORIGIN).host });
    if (options.cookie !== null) headers.set('cookie', options.cookie ?? buyerCookieHeader());
    if (options.method && options.method !== 'GET') headers.set('origin', options.origin ?? ORIGIN);
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    return new NextRequest(`${ORIGIN}${path}`, {
        method: options.method ?? 'GET', headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
}

async function withGateway<T>(respond: (request: RecordedGatewayRequest) => Response | Promise<Response>, run: (requests: RecordedGatewayRequest[]) => Promise<T>) {
    const previous = process.env.INTERNAL_API_SECRET;
    process.env.INTERNAL_API_SECRET = INTERNAL_SECRET;
    const requests: RecordedGatewayRequest[] = [];
    const fake = installGatewayFake((request) => {
        if (request.url.pathname.endsWith('/internal/store-access/resolve')) {
            assert.equal(request.headers.get('x-internal-api-secret'), INTERNAL_SECRET);
            return jsonResponse({ data: { site_id: SITE_ID } });
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
    const message = { id: 'message-1', author_type: 'agent', body: 'We can help.', created_at: '2026-10-05T00:01:00Z', visibility: 'internal-must-not-leak' };
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
        assert.deepEqual(await response.json(), { messages: [{ id: 'message-1', author_type: 'agent', body: 'We can help.', created_at: '2026-10-05T00:01:00Z' }] });
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
        return jsonResponse({ success: true, data: { id: 'message-2', author_type: 'requester', body: 'More details.', created_at: '2026-10-05T00:02:00Z', visibility: 'public' } }, { status: 201 });
    }, async (requests) => {
        const response = await messagesRoute.POST(makeRequest(`/api/buyer/support/tickets/${TICKET_ID}/messages`, { method: 'POST', body: { body: ' More details. ', author_type: 'agent', visibility: 'internal' } }), { params: Promise.resolve({ ticketId: TICKET_ID }) });
        assert.equal(response.status, 201);
        NO_STORE(response);
        assert.deepEqual(await response.json(), { message: { id: 'message-2', author_type: 'requester', body: 'More details.', created_at: '2026-10-05T00:02:00Z' } });
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
