// SUSTAINED-K D1/D2 -- the signed-in buyer's own cross-store profile and address book reach the gateway through
// three thin Next proxies (profile, addresses, addresses/[id]). They exist because the buyer session lives in a
// host-only __Host- cookie on the store origin, which a browser cannot present to the gateway's origin: the proxy
// reads the cookie server-side and forwards only the buyer token. They own no data and no decision -- ownership is the
// gateway's `.eq('buyer_account_id', ...)` -- so what has to be proven about them is exactly what they send, what they
// let back, and that they refuse to talk to the gateway at all without a well-formed session.
//
// The real route handlers, cookie decoding, header construction and api-client unwrapping all run; only the global
// fetch (the one seam every proxy shares) is faked. Run: see apps/commerce/web/package.json `test`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import {
    BUYER_TOKEN,
    SITE_ID,
    buyerCookieHeader,
    installGatewayFake,
    jsonResponse,
    type GatewayResponder,
    type RecordedGatewayRequest,
} from '@/lib/api/gateway-fetch-fake.test-support';
import * as profileRoute from './profile/route';
import * as addressesRoute from './addresses/route';
import * as addressRoute from './addresses/[id]/route';
import * as ordersRoute from './orders/route';
import * as wishlistRoute from './wishlist/route';
import * as reviewsRoute from '../reviews/route';
import * as loyaltyRoute from './loyalty/route';
import * as loyaltyHistoryRoute from './loyalty/history/route';

const ORIGIN = 'http://snaz.localhost:9000';
const NOT_AUTHENTICATED = { error: 'Not authenticated' };

type Handler = (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;

interface CallOptions { method?: string; cookie?: string | null; body?: unknown; id?: string; origin?: string | null; accept?: string; contentType?: string; expectedBuyerId?: string }

function call(handler: unknown, path: string, options: CallOptions = {}): Promise<Response> {
    const { method = 'GET', cookie = buyerCookieHeader(), body, id = 'addr-1' } = options;
    const headers = new Headers();
    headers.set('host', new URL(ORIGIN).host);
    if (options.origin !== null) headers.set('origin', options.origin ?? ORIGIN);
    if (cookie !== null) headers.set('cookie', cookie);
    if (options.expectedBuyerId) headers.set('x-letbuyy-expected-buyer-id', options.expectedBuyerId);
    if (options.accept) headers.set('accept', options.accept);
    if (body !== undefined) headers.set('content-type', options.contentType ?? 'application/json');
    const request = new NextRequest(`${ORIGIN}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return (handler as Handler)(request, { params: Promise.resolve({ id }) });
}

async function withGateway<T>(respond: GatewayResponder, run: (requests: RecordedGatewayRequest[]) => Promise<T>, resolve: () => Response = () => jsonResponse({ data: { site_id: SITE_ID } })): Promise<T> {
    const originalSecret = process.env.INTERNAL_API_SECRET;
    process.env.INTERNAL_API_SECRET = 'synthetic-proxy-resolution-secret';
    const requests: RecordedGatewayRequest[] = [];
    const fake = installGatewayFake((request) => {
        if (request.url.pathname.endsWith('/internal/store-access/resolve')) {
            assert.equal(request.url.searchParams.get('host'), new URL(ORIGIN).host);
            assert.equal(request.headers.get('x-internal-api-secret'), 'synthetic-proxy-resolution-secret');
            assert.equal(request.cache, 'no-store');
            return resolve();
        }
        requests.push(request);
        return respond(request);
    });
    try {
        return await run(requests);
    } finally {
        fake.restore();
        if (originalSecret === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = originalSecret;
    }
}

const buyerHeader = LETBUYY_STOREFRONT_SESSION_HEADER.toLowerCase();
// What the gateway may see from these proxies: the buyer token under its own header, plus the three headers
// storefrontApiFetch adds to every call. Never the browser's cookie, and never an Authorization header.
const EXPECTED_UPSTREAM_HEADERS = [buyerHeader, 'content-type', 'x-client', 'x-request-id'].sort();

function assertProxiedToGateway(request: RecordedGatewayRequest, method: string, pathSuffix: string): void {
    assert.equal(request.method, method);
    assert.ok(request.url.pathname.endsWith(pathSuffix), `${request.url.pathname} must end with ${pathSuffix}`);
    assert.equal(request.url.search, `?store_id=${SITE_ID}`, 'only the host-resolved site reaches the gateway');
    assert.equal(request.headers.get(buyerHeader), BUYER_TOKEN, 'the buyer token is forwarded under its own header');
    assert.deepEqual([...request.headers.keys()].sort(), EXPECTED_UPSTREAM_HEADERS, 'only the buyer token and the three standard storefront headers reach the gateway');
    assert.equal(request.cache, 'no-store', 'personal data is never cached');
}

function assertBrowserFacing(response: Response): void {
    assert.equal(response.headers.get('cache-control'), 'no-store', 'a personal response must not be cached');
    for (const leaked of ['set-cookie', 'x-internal-debug', 'server', 'x-powered-by', 'x-gateway-trace']) {
        assert.equal(response.headers.get(leaked), null, `${leaked} from the gateway must never reach the browser`);
    }
}

// The gateway answers with headers a proxy must NOT relay.
const LEAKY_HEADERS = { 'Set-Cookie': 'gw=1; Path=/', 'X-Internal-Debug': 'host=10.0.0.5', Server: 'gateway/1.0', 'X-Gateway-Trace': 'abc' };
const ok = (data: unknown, status = 200) => jsonResponse({ success: true, data }, { status, headers: LEAKY_HEADERS });

// ── the session gate: no well-formed buyer session, no gateway call at all ────────────────────────────────────────────
const SESSION_GATE_CASES: Array<{ name: string; handler: unknown; path: string; method: string; body?: unknown; expectedBuyerId?: string }> = [
    { name: 'GET /profile', handler: profileRoute.GET, path: '/api/buyer/profile', method: 'GET' },
    { name: 'PATCH /profile', handler: profileRoute.PATCH, path: '/api/buyer/profile', method: 'PATCH', body: { fullName: 'A' } },
    { name: 'GET /addresses', handler: addressesRoute.GET, path: '/api/buyer/addresses', method: 'GET' },
    { name: 'POST /addresses', handler: addressesRoute.POST, path: '/api/buyer/addresses', method: 'POST', body: { line1: 'x' }, expectedBuyerId: 'buyer-a' },
    { name: 'PATCH /addresses/:id', handler: addressRoute.PATCH, path: '/api/buyer/addresses/addr-1', method: 'PATCH', body: { line1: 'x' }, expectedBuyerId: 'buyer-a' },
    { name: 'DELETE /addresses/:id', handler: addressRoute.DELETE, path: '/api/buyer/addresses/addr-1', method: 'DELETE', expectedBuyerId: 'buyer-a' },
    { name: 'GET /orders', handler: ordersRoute.GET, path: '/api/buyer/orders', method: 'GET' },
    { name: 'POST /orders claim', handler: ordersRoute.POST, path: '/api/buyer/orders', method: 'POST', body: {} },
    { name: 'GET /orders?order_id=:id', handler: ordersRoute.GET, path: '/api/buyer/orders?order_id=order-1', method: 'GET' },
    { name: 'GET /wishlist', handler: wishlistRoute.GET, path: '/api/buyer/wishlist', method: 'GET' },
    { name: 'POST /wishlist', handler: wishlistRoute.POST, path: '/api/buyer/wishlist', method: 'POST', body: { productId: 'p1' }, expectedBuyerId: 'buyer-a' },
    { name: 'DELETE /wishlist', handler: wishlistRoute.DELETE, path: '/api/buyer/wishlist', method: 'DELETE', body: { productId: 'p1' }, expectedBuyerId: 'buyer-a' },
];

const BAD_SESSIONS: Array<{ label: string; cookie: string | null }> = [
    { label: 'no cookie at all', cookie: null },
    { label: 'an unrelated cookie only', cookie: 'theme=dark' },
    { label: 'a session cookie with no site separator', cookie: `__Host-lb_store_buyer=${BUYER_TOKEN}` },
    { label: 'a site id that is not a UUID', cookie: `__Host-lb_store_buyer=not-a-uuid~${BUYER_TOKEN}` },
    { label: 'a token that is not JWT-shaped', cookie: '__Host-lb_store_buyer=0d8a7b1c-3e5f-4a6b-9c1d-2e3f4a5b6c7d~not-a-jwt' },
    { label: 'a token longer than 4096 characters', cookie: `__Host-lb_store_buyer=0d8a7b1c-3e5f-4a6b-9c1d-2e3f4a5b6c7d~a.b.${'c'.repeat(4100)}` },
];

for (const scenario of SESSION_GATE_CASES) {
    test(`${scenario.name}: host resolution rejects another site's cookie and fails closed on unavailable resolution`, async () => {
        for (const [status, resolve] of [
            [401, () => jsonResponse({ data: { site_id: crypto.randomUUID() } })],
            [401, () => jsonResponse({}, { status: 404 })],
            [503, () => jsonResponse({ error: 'synthetic-private-host-detail' }, { status: 503 })],
            [503, () => { throw new Error('synthetic-private-host-detail'); }],
        ] as Array<[number, () => Response]>) {
            await withGateway(() => { throw new Error('must not reach buyer gateway'); }, async (requests) => {
                const response = await call(scenario.handler, scenario.path, { method: scenario.method, body: scenario.body, expectedBuyerId: scenario.expectedBuyerId });
                assert.equal(response.status, status);
                assertBrowserFacing(response);
                assert.doesNotMatch(await response.text(), /synthetic-private-host-detail/);
                assert.equal(requests.length, 0);
            }, resolve);
        }
    });
    if (scenario.method !== 'GET') {
        test(`${scenario.name}: foreign or missing Origin cannot trigger a cookie-authenticated write`, async () => {
            for (const origin of ['http://attacker.localhost:9000', null]) {
                let resolved = false;
                await withGateway(() => { throw new Error('must not write'); }, async (requests) => {
                    const response = await call(scenario.handler, scenario.path, { method: scenario.method, body: scenario.body, expectedBuyerId: scenario.expectedBuyerId, origin });
                    assert.equal(response.status, 403);
                    assertBrowserFacing(response);
                    assert.equal(requests.length, 0);
                    assert.equal(resolved, false);
                }, () => { resolved = true; return jsonResponse({ data: { site_id: SITE_ID } }); });
            }
        });
    }
}

test('GET /orders forwards the authoritative site and only pagination fields, returning canonical history', async () => {
    await withGateway(() => ok({ orders: [{ id: 'synthetic-order', total: 199 }], next_cursor: 'next-page', has_more: true, private_note: 'never relay' }), async (requests) => {
        const response = await call(ordersRoute.GET, '/api/buyer/orders?store_id=forged&buyer_account_id=forged&limit=1&cursor=cursor-value');
        assert.equal(response.status, 200);
        assertBrowserFacing(response);
        assert.deepEqual(await response.json(), { orders: [{ id: 'synthetic-order', total: 199 }], nextCursor: 'next-page', hasMore: true });
        assert.equal(requests.length, 1);
        assert.equal(requests[0].url.pathname, '/v1/storefront/buyer/storefront-orders');
        assert.deepEqual([...requests[0].url.searchParams], [['store_id', SITE_ID], ['limit', '1'], ['cursor', 'cursor-value']]);
        assert.equal(requests[0].headers.get(buyerHeader), BUYER_TOKEN);
        assert.deepEqual([...requests[0].headers.keys()].sort(), EXPECTED_UPSTREAM_HEADERS);
        assert.equal(requests[0].cache, 'no-store');
    });
});

test('GET /orders preserves auth/validation status but sanitizes failures and malformed success bodies', async () => {
    for (const status of [401,403,400,500]) {
        await withGateway(() => jsonResponse({ error: 'synthetic-private-order-detail' }, { status }), async () => {
            const result = await call(ordersRoute.GET, '/api/buyer/orders');
            assert.equal(result.status, status === 500 ? 503 : status);
            assert.doesNotMatch(await result.text(), /synthetic-private-order-detail/);
            assertBrowserFacing(result);
        });
    }
    for (const reply of [() => ok({}), () => new Response('not-json', { status: 200 })]) {
        await withGateway(reply, async () => {
            assert.equal((await call(ordersRoute.GET, '/api/buyer/orders')).status, 503);
        });
    }
    await withGateway(() => { throw new Error('synthetic-private-order-detail'); }, async () => {
        const result = await call(ordersRoute.GET, '/api/buyer/orders');
        assert.equal(result.status, 503);
        assert.doesNotMatch(await result.text(), /synthetic-private-order-detail/);
    });
});

test('GET /orders?order_id= uses only the selected order id and the host-bound buyer session', async () => {
    await withGateway(() => ok({ order: { id: 'owned-order', total: 240, private_note: 'must not be relayed', items: [{ name: 'Synthetic item', quantity: 1, internal_cost: 4 }] }, ignored: true }), async (requests) => {
        const response = await call(ordersRoute.GET, '/api/buyer/orders?order_id=owned-order&store_id=forged&buyer_account_id=forged');
        assert.equal(response.status, 200);
        assertBrowserFacing(response);
        assert.deepEqual(await response.json(), { order: { id: 'owned-order', total: 240, items: [{ name: 'Synthetic item', quantity: 1 }] } });
        assert.equal(requests.length, 1);
        assert.equal(requests[0].url.pathname, '/v1/storefront/buyer/storefront-orders/owned-order');
        assert.deepEqual([...requests[0].url.searchParams], [['store_id', SITE_ID]]);
        assert.equal(requests[0].headers.get(buyerHeader), BUYER_TOKEN);
        assert.deepEqual([...requests[0].headers.keys()].sort(), EXPECTED_UPSTREAM_HEADERS);
        assert.equal(requests[0].cache, 'no-store');
    });
    for (const status of [401, 403, 404, 400, 500]) {
        await withGateway(() => jsonResponse({ error: 'synthetic-private-order-detail' }, { status }), async () => {
            const response = await call(ordersRoute.GET, '/api/buyer/orders?order_id=order-1');
            assert.equal(response.status, status === 500 ? 503 : status);
            assert.doesNotMatch(await response.text(), /synthetic-private-order-detail/);
            assertBrowserFacing(response);
        });
    }
    await withGateway(() => ok({}), async () => {
        assert.equal((await call(ordersRoute.GET, '/api/buyer/orders?order_id=order-1')).status, 503);
    });
});

test('POST /orders claims only this host-resolved store and returns aggregate counts', async () => {
    await withGateway((request) => {
        assert.equal(request.method, 'POST');
        assert.equal(request.url.pathname, '/v1/storefront/buyer/orders/claim');
        assert.deepEqual([...request.url.searchParams], [['store_id', SITE_ID]]);
        assert.deepEqual(JSON.parse(request.body || '{}'), { store_id: SITE_ID }, 'caller-supplied store and buyer ids are dropped');
        assert.equal(request.headers.get(buyerHeader), BUYER_TOKEN);
        assert.deepEqual([...request.headers.keys()].sort(), EXPECTED_UPSTREAM_HEADERS);
        assert.equal(request.cache, 'no-store');
        return ok({ claimed: { linked: 2, already_linked: 1, conflicts: 3 }, private_note: 'never relay' }, 200);
    }, async (requests) => {
        const response = await call(ordersRoute.POST, '/api/buyer/orders', { method: 'POST', body: { store_id: 'forged', buyer_account_id: 'forged' } });
        assert.equal(response.status, 200);
        assertBrowserFacing(response);
        assert.deepEqual(await response.json(), { claimed: { linked: 2, alreadyLinked: 1, conflicts: 3 } });
        assert.equal(requests.length, 1);
    });
});

test('POST /orders maps unverified email, auth and gateway failures without leaking upstream detail', async () => {
    await withGateway(() => jsonResponse({ error: { code: 'EMAIL_UNVERIFIED', message: 'private detail' } }, { status: 403, headers: LEAKY_HEADERS }), async () => {
        const response = await call(ordersRoute.POST, '/api/buyer/orders', { method: 'POST', body: {} });
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), { error: 'Verify your LetBuyy email address before claiming past orders.', code: 'EMAIL_UNVERIFIED' });
        assertBrowserFacing(response);
    });
    for (const status of [401, 409, 500]) {
        await withGateway(() => jsonResponse({ error: { message: 'synthetic-private-detail' } }, { status, headers: LEAKY_HEADERS }), async () => {
            const response = await call(ordersRoute.POST, '/api/buyer/orders', { method: 'POST', body: {} });
            assert.equal(response.status, status === 500 ? 503 : status);
            assert.doesNotMatch(await response.text(), /synthetic-private-detail/);
            assertBrowserFacing(response);
        });
    }
    await withGateway(() => { throw new Error('synthetic-private-detail'); }, async () => {
        const response = await call(ordersRoute.POST, '/api/buyer/orders', { method: 'POST', body: {} });
        assert.equal(response.status, 503);
        assert.doesNotMatch(await response.text(), /synthetic-private-detail/);
    });
});

test('POST /orders form submission redirects back to a safe same-origin page with a status code', async () => {
    await withGateway(() => ok({ claimed: { linked: 1, already_linked: 0, conflicts: 0 } }), async (requests) => {
        const headers = new Headers({ host: new URL(ORIGIN).host, origin: ORIGIN, accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded', cookie: buyerCookieHeader() });
        const request = new NextRequest(`${ORIGIN}/api/buyer/orders`, {
            method: 'POST', headers,
            body: new URLSearchParams({ return_to: '/store/snaz/account/orders' }),
        });
        const response = await ordersRoute.POST(request);
        assert.equal(response.status, 303);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const destination = new URL(response.headers.get('location') || '');
        assert.equal(destination.origin, ORIGIN);
        assert.equal(destination.pathname, '/store/snaz/account/orders');
        assert.equal(destination.searchParams.get('buyer_claim'), 'complete');
        assert.equal(requests.length, 1);
    });
    await withGateway(() => ok({ claimed: { linked: 0, already_linked: 0, conflicts: 1 } }), async () => {
        const headers = new Headers({ host: new URL(ORIGIN).host, origin: ORIGIN, accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded', cookie: buyerCookieHeader() });
        const request = new NextRequest(`${ORIGIN}/api/buyer/orders`, {
            method: 'POST', headers,
            body: new URLSearchParams({ return_to: '/store/snaz/account/orders' }),
        });
        const response = await ordersRoute.POST(request);
        assert.equal(new URL(response.headers.get('location') || '').searchParams.get('buyer_claim'), 'partial');
    });
});

for (const scenario of SESSION_GATE_CASES) {
    test(`${scenario.name}: every missing or malformed buyer session is a 401 and the gateway is never called`, async () => {
        await withGateway(() => jsonResponse({ success: true, data: {} }), async (requests) => {
            for (const { label, cookie } of BAD_SESSIONS) {
                const response = await call(scenario.handler, scenario.path, { method: scenario.method, cookie, body: scenario.body });
                assert.equal(response.status, 401, `${label} must be refused`);
                assert.deepEqual(await response.json(), NOT_AUTHENTICATED, label);
                assertBrowserFacing(response);
            }
            assert.equal(requests.length, 0, 'no unauthenticated caller may cause a gateway request');
        });
    });
}

// ── /api/buyer/profile ────────────────────────────────────────────────────────────────────────────────────────────────
test('GET /profile forwards only the buyer token to /storefront/buyer/profile and returns just the buyer', async () => {
    await withGateway(() => ok({ buyer: { id: 'b1', email: 'a@b.test', full_name: 'A B' }, internal_note: 'never shown' }), async (requests) => {
        const response = await call(profileRoute.GET, '/api/buyer/profile');
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { buyer: { id: 'b1', email: 'a@b.test', full_name: 'A B' } }, 'only data.buyer is passed on');
        assertBrowserFacing(response);
        assert.equal(requests.length, 1);
        assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/profile');
        assert.equal(requests[0].body, null);
    });
});

test('GET /profile: an expired or revoked session (gateway 401) is a 401, and the gateway body is not echoed', async () => {
    await withGateway(() => jsonResponse({ success: false, error: { message: 'session_epoch mismatch for buyer b1' } }, { status: 401, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.GET, '/api/buyer/profile');
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), NOT_AUTHENTICATED);
        assertBrowserFacing(response);
    });
});

test('GET /profile: a network failure or a gateway 5xx is a generic 503 that carries none of the underlying detail', async () => {
    await withGateway(() => { throw new Error('connect ECONNREFUSED 10.0.0.5:8787 (gateway-prod-eu)'); }, async () => {
        const response = await call(profileRoute.GET, '/api/buyer/profile');
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your profile could not be loaded right now.' });
        assertBrowserFacing(response);
    });
    await withGateway(() => jsonResponse({ error: { message: 'relation "buyer_accounts" does not exist' } }, { status: 500, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.GET, '/api/buyer/profile');
        assert.equal(response.status, 503);
        const text = await response.text();
        assert.equal(text.includes('buyer_accounts'), false, 'a database error must never reach the browser');
        assertBrowserFacing(response);
    });
});

test('PATCH /profile binds the write to the currently verified buyer and forwards ONLY profile fields', async () => {
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'b1', full_name: 'A B' } })
        : ok({ buyer: { id: 'b1', full_name: 'New Name', phone: '+919999999999' } }), async (requests) => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', {
            method: 'PATCH',
            body: { fullName: 'New Name', phone: '+919999999999', expectedBuyerId: 'b1', email: 'evil@x.test', status: 'admin', role: 'owner', buyer_account_id: 'someone-else', session_epoch: 99 },
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { buyer: { id: 'b1', full_name: 'New Name', phone: '+919999999999' } });
        assertBrowserFacing(response);
        assert.equal(requests.length, 2, 'profile identity is checked before the write');
        assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/profile');
        assertProxiedToGateway(requests[1], 'PATCH', '/storefront/buyer/profile');
        assert.deepEqual(JSON.parse(requests[1].body ?? 'null'), { full_name: 'New Name', phone: '+919999999999' }, 'identity hints and protected fields never leave the proxy');
    });
});

test('PATCH /profile refuses a stale form identity before forwarding any write', async () => {
    await withGateway(() => ok({ buyer: { id: 'buyer-b', full_name: 'Buyer B' } }), async (requests) => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', {
            method: 'PATCH',
            body: { fullName: 'Buyer A draft', phone: '+919999999999', expectedBuyerId: 'buyer-a' },
        });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: 'Your account changed. Reload before saving.' });
        assertBrowserFacing(response);
        assert.equal(requests.length, 1, 'the profile read detects the mismatch and no PATCH is sent');
        assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/profile');
    });
});

test('PATCH /profile fails closed when the signed-in buyer identity cannot be checked', async () => {
    await withGateway(() => jsonResponse({ error: { message: 'internal DB detail' } }, { status: 500, headers: LEAKY_HEADERS }), async (requests) => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', {
            method: 'PATCH',
            body: { phone: '+919999999999', expectedBuyerId: 'buyer-a' },
        });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your profile could not be checked right now.' });
        assertBrowserFacing(response);
        assert.equal(requests.length, 1, 'an unavailable identity read never falls through to a write');
        assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/profile');
    });
});

test('PATCH /profile: a body with none of the allowed fields, or no JSON body, is a 400 and the gateway is never called', async () => {
    await withGateway(() => ok({}), async (requests) => {
        const nothingAllowed = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: { email: 'evil@x.test', status: 'admin' } });
        assert.equal(nothingAllowed.status, 400);
        assert.deepEqual(await nothingAllowed.json(), { error: 'fullName or phone is required' });
        const notJson = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: 'this is not json' });
        assert.equal(notJson.status, 400);
        assert.deepEqual(await notJson.json(), { error: 'A JSON body is required' });
        const missingIdentity = await call(profileRoute.PATCH, '/api/buyer/profile', {
            method: 'PATCH',
            body: { phone: '1' },
        });
        assert.equal(missingIdentity.status, 400);
        assert.deepEqual(await missingIdentity.json(), { error: 'Reload your account before saving profile changes.' });
        assertBrowserFacing(nothingAllowed);
        assert.equal(requests.length, 0);
    });
});

test('PATCH /profile: a gateway client-error message passes through (400 keeps its status); a 5xx body is never relayed', async () => {
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'b1' } })
        : jsonResponse({ error: { message: 'Phone number is not valid' } }, { status: 400, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: { phone: '1', expectedBuyerId: 'b1' } });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'Phone number is not valid' });
        assertBrowserFacing(response);
    });
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'b1' } })
        : jsonResponse({ error: { message: 'deadlock detected in tx 4411' } }, { status: 500, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: { phone: '1', expectedBuyerId: 'b1' } });
        assert.equal(response.status, 503, 'a non-400 failure is reported as 503');
        assert.deepEqual(await response.json(), { error: 'Your profile could not be updated right now.' }, 'the status AND the message are generalised, so nothing the gateway said about its own failure reaches the browser');
    });
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'b1' } })
        : jsonResponse({ error: { message: 'You already have the maximum of 10 saved values' } }, { status: 409, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: { phone: '1', expectedBuyerId: 'b1' } });
        assert.equal(response.status, 503, 'the existing status mapping is unchanged: only 400 keeps its status');
        assert.deepEqual(await response.json(), { error: 'You already have the maximum of 10 saved values' }, 'a client-error message is still user-facing and still relayed');
    });
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'b1' } })
        : jsonResponse({ success: false, error: { message: 'session expired' } }, { status: 401, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: { phone: '1', expectedBuyerId: 'b1' } });
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), NOT_AUTHENTICATED);
    });
});

// ── /api/buyer/addresses ──────────────────────────────────────────────────────────────────────────────────────────────
test('GET /addresses forwards only the buyer token and returns just the address list', async () => {
    await withGateway(() => ok({ addresses: [{ id: 'a1', line1: '1 Main St' }, { id: 'a2', line1: '2 Side St' }], internal: 'x' }), async (requests) => {
        const response = await call(addressesRoute.GET, '/api/buyer/addresses');
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { addresses: [{ id: 'a1', line1: '1 Main St' }, { id: 'a2', line1: '2 Side St' }] });
        assertBrowserFacing(response);
        assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/addresses');
    });
});

test('GET /addresses: an empty or missing list is an empty array, never null; failures are a generic 503', async () => {
    await withGateway(() => ok({}), async () => {
        assert.deepEqual(await (await call(addressesRoute.GET, '/api/buyer/addresses')).json(), { addresses: [] });
    });
    await withGateway(() => { throw new Error('socket hang up'); }, async () => {
        const response = await call(addressesRoute.GET, '/api/buyer/addresses');
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your addresses could not be loaded right now.' });
    });
});

test('POST /addresses forwards the body to the gateway as sent and answers 201 with the created address', async () => {
    const body = { line1: '1 Main St', city: 'Pune', pincode: '411001', is_default: true };
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : ok({ address: { id: 'a9', ...body } }), async (requests) => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), { address: { id: 'a9', ...body } });
        assertBrowserFacing(response);
        assert.equal(requests.length, 2);
        assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/profile');
        assertProxiedToGateway(requests[1], 'POST', '/storefront/buyer/addresses');
        assert.deepEqual(JSON.parse(requests[1].body ?? 'null'), body, 'address content is validated by the gateway, the compare id is not forwarded');
    });
});

test('buyer address writes refuse a stale expected principal and never forward the comparison ID', async () => {
    const mutations = [
        { handler: addressesRoute.POST, path: '/api/buyer/addresses', method: 'POST', body: { line1: 'synthetic address' } },
        { handler: addressRoute.PATCH, path: '/api/buyer/addresses/addr-1', method: 'PATCH', body: { city: 'Pune' }, id: 'addr-1' },
        { handler: addressRoute.DELETE, path: '/api/buyer/addresses/addr-1', method: 'DELETE', id: 'addr-1' },
    ] as const;

    for (const mutation of mutations) {
        await withGateway((request) => ok({ buyer: { id: request.method === 'GET' ? 'buyer-b' : 'unexpected-write' } }), async (requests) => {
            const response = await call(mutation.handler, mutation.path, {
                method: mutation.method,
                body: 'body' in mutation ? mutation.body : undefined,
                id: 'id' in mutation ? mutation.id : undefined,
                expectedBuyerId: 'buyer-a',
            });
            assert.equal(response.status, 409, `${mutation.method} must refuse the previously loaded buyer`);
            assert.deepEqual(await response.json(), { error: 'Your account changed. Reload before saving.' });
            assertBrowserFacing(response);
            assert.equal(requests.length, 1, 'only the authenticated identity preflight reaches Gateway');
            assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/profile');
            assert.equal(requests.some(request => request.method === mutation.method && request.url.pathname.endsWith('/addresses')), false);
        });
    }
});

test('buyer address writes fail closed when identity preflight is unavailable or the comparison ID is absent', async () => {
    const mutations = [
        { handler: addressesRoute.POST, path: '/api/buyer/addresses', method: 'POST', body: { line1: 'synthetic address' } },
        { handler: addressRoute.PATCH, path: '/api/buyer/addresses/addr-1', method: 'PATCH', body: { city: 'Pune' }, id: 'addr-1' },
        { handler: addressRoute.DELETE, path: '/api/buyer/addresses/addr-1', method: 'DELETE', id: 'addr-1' },
    ] as const;

    for (const mutation of mutations) {
        await withGateway(() => jsonResponse({ error: { message: 'expired session detail' } }, { status: 401, headers: LEAKY_HEADERS }), async (requests) => {
            const response = await call(mutation.handler, mutation.path, {
                method: mutation.method,
                body: 'body' in mutation ? mutation.body : undefined,
                id: 'id' in mutation ? mutation.id : undefined,
                expectedBuyerId: 'buyer-a',
            });
            assert.equal(response.status, 401, 'an expired signed session cannot fall through to an address write');
            assert.deepEqual(await response.json(), NOT_AUTHENTICATED);
            assertBrowserFacing(response);
            assert.equal(requests.length, 1);
            assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/profile');
        });

        await withGateway(() => jsonResponse({ error: { message: 'private gateway detail' } }, { status: 500, headers: LEAKY_HEADERS }), async (requests) => {
            const response = await call(mutation.handler, mutation.path, {
                method: mutation.method,
                body: 'body' in mutation ? mutation.body : undefined,
                id: 'id' in mutation ? mutation.id : undefined,
                expectedBuyerId: 'buyer-a',
            });
            assert.equal(response.status, 503);
            const responseText = await response.text();
            assert.deepEqual(JSON.parse(responseText), { error: 'Your account could not be checked before changing saved addresses.' });
            assert.equal(requests.length, 1, 'an unreadable principal never falls through to the address write');
            assert.doesNotMatch(responseText, /private gateway detail/);
        });

        await withGateway(() => { throw new Error('no identity lookup is expected'); }, async (requests) => {
            const response = await call(mutation.handler, mutation.path, { method: mutation.method, body: 'body' in mutation ? mutation.body : undefined, id: 'id' in mutation ? mutation.id : undefined });
            assert.equal(response.status, 400);
            assert.deepEqual(await response.json(), { error: 'Reload your account before changing saved addresses.' });
            assert.equal(requests.length, 0);
        });
    }
});

test('POST /addresses: no JSON body is a 400 without a gateway call; a gateway 400 keeps its message; other failures are 503', async () => {
    await withGateway(() => ok({}), async (requests) => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body: 'not json' });
        assert.equal(response.status, 400);
        assert.equal(requests.length, 0);
    });
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({ error: { message: 'Pincode must be 6 digits' } }, { status: 400, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body: { pincode: '1' }, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'Pincode must be 6 digits' });
    });
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({}, { status: 502, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body: { line1: 'x' }, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your address could not be saved right now.' });
    });
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({ error: { message: 'insert into buyer_addresses failed: 23505 duplicate key' } }, { status: 500, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body: { line1: 'x' }, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 503);
        const text = await response.text();
        assert.equal(text.includes('buyer_addresses'), false, 'a database error from a 5xx must never reach the browser');
        assert.deepEqual(JSON.parse(text), { error: 'Your address could not be saved right now.' });
    });
});

// ── /api/buyer/addresses/[id] ─────────────────────────────────────────────────────────────────────────────────────────
test('PATCH /addresses/:id forwards to that one address and returns the updated address', async () => {
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : ok({ address: { id: 'addr-1', city: 'Mumbai' } }), async (requests) => {
        const response = await call(addressRoute.PATCH, '/api/buyer/addresses/addr-1', { method: 'PATCH', id: 'addr-1', body: { city: 'Mumbai' }, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { address: { id: 'addr-1', city: 'Mumbai' } });
        assertBrowserFacing(response);
        assert.equal(requests.length, 2);
        assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/profile');
        assertProxiedToGateway(requests[1], 'PATCH', '/storefront/buyer/addresses/addr-1');
        assert.deepEqual(JSON.parse(requests[1].body ?? 'null'), { city: 'Mumbai' });
    });
});

test('PATCH /addresses/:id: a gateway 400 keeps its message; a 5xx body is never relayed', async () => {
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({ error: { message: 'Pincode must be 6 digits' } }, { status: 400, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressRoute.PATCH, '/api/buyer/addresses/addr-1', { method: 'PATCH', id: 'addr-1', body: { pincode: '1' }, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'Pincode must be 6 digits' });
    });
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({ error: { message: 'connection to db-primary.internal refused' } }, { status: 500, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressRoute.PATCH, '/api/buyer/addresses/addr-1', { method: 'PATCH', id: 'addr-1', body: { city: 'x' }, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 503);
        const text = await response.text();
        assert.equal(text.includes('db-primary'), false, 'an internal hostname from a 5xx must never reach the browser');
        assert.deepEqual(JSON.parse(text), { error: 'Your address could not be updated right now.' });
        assertBrowserFacing(response);
    });
});

test('an address id in the URL is only ever a path segment: traversal and query injection are encoded, not interpreted', async () => {
    const hostile = '../../admin/refunds?buyer=someone-else#frag';
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : ok({ address: { id: 'x' } }), async (requests) => {
        await call(addressRoute.PATCH, '/api/buyer/addresses/x', { method: 'PATCH', id: hostile, body: { city: 'x' }, expectedBuyerId: 'buyer-a' });
        await call(addressRoute.DELETE, '/api/buyer/addresses/x', { method: 'DELETE', id: hostile, expectedBuyerId: 'buyer-a' });
        const mutations = requests.filter(request => request.method !== 'GET');
        assert.equal(requests.length, 4);
        for (const request of mutations) {
            assert.ok(request.url.pathname.endsWith(`/storefront/buyer/addresses/${encodeURIComponent(hostile)}`), request.url.pathname);
            assert.equal(request.url.search, `?store_id=${SITE_ID}`, 'the id cannot inject a query; only the resolved site is present');
            assert.equal(request.url.hash, '', 'a "#" in the id must not become a fragment');
            assert.equal(request.url.pathname.split('/').includes('admin'), false, 'a ".." in the id must not climb into another gateway route');
        }
    });
});

test('another buyer\'s address is indistinguishable from a missing one: gateway 404 is a plain 404 for PATCH and DELETE', async () => {
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({ error: { message: 'address a7 belongs to buyer b2' } }, { status: 404, headers: LEAKY_HEADERS }), async () => {
        for (const [handler, method, body] of [[addressRoute.PATCH, 'PATCH', { city: 'x' }], [addressRoute.DELETE, 'DELETE', undefined]] as const) {
            const response = await call(handler, '/api/buyer/addresses/a7', { method, id: 'a7', body, expectedBuyerId: 'buyer-a' });
            assert.equal(response.status, 404, `${method} of an address the buyer does not own`);
            const text = await response.text();
            assert.deepEqual(JSON.parse(text), { error: 'Address not found.' });
            assert.equal(text.includes('b2'), false, 'the owner of the address must never be named');
            assertBrowserFacing(response);
        }
    });
});

test('DELETE /addresses/:id answers { deleted: true } on success; a gateway 401 is a 401; other failures are a generic 503', async () => {
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : ok({}), async (requests) => {
        const response = await call(addressRoute.DELETE, '/api/buyer/addresses/addr-1', { method: 'DELETE', id: 'addr-1', expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { deleted: true });
        assertBrowserFacing(response);
        assert.equal(requests.length, 2);
        assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/profile');
        assertProxiedToGateway(requests[1], 'DELETE', '/storefront/buyer/addresses/addr-1');
        assert.equal(requests[1].body, null);
    });
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({}, { status: 401, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressRoute.DELETE, '/api/buyer/addresses/addr-1', { method: 'DELETE', id: 'addr-1', expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), NOT_AUTHENTICATED);
    });
    await withGateway((request) => request.method === 'GET'
        ? ok({ buyer: { id: 'buyer-a' } })
        : (() => { throw new Error('ETIMEDOUT gateway-eu'); })(), async () => {
        const response = await call(addressRoute.DELETE, '/api/buyer/addresses/addr-1', { method: 'DELETE', id: 'addr-1', expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your address could not be deleted right now.' });
    });
});

test('two different buyers never share a session: each request carries exactly its own token', async () => {
    const tokenA = 'aaaa1111.bbbb1111.cccc1111';
    const tokenB = 'aaaa2222.bbbb2222.cccc2222';
    await withGateway(() => ok({ buyer: { id: 'x' } }), async (requests) => {
        await call(profileRoute.GET, '/api/buyer/profile', { cookie: buyerCookieHeader(tokenA) });
        await call(profileRoute.GET, '/api/buyer/profile', { cookie: buyerCookieHeader(tokenB) });
        assert.deepEqual(requests.map((request) => request.headers.get(buyerHeader)), [tokenA, tokenB]);
    });
});

test('buyer wishlist proxy returns only the explicit store relationship state and product ids', async () => {
    await withGateway(() => ok({ linked: true, product_ids: ['p1', 'p2'] }), async (requests) => {
        const response = await call(wishlistRoute.GET, '/api/buyer/wishlist');
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { linked: true, storeAccountUnavailable: false, productIds: ['p1', 'p2'] });
        assertProxiedToGateway(requests[0], 'GET', '/storefront/buyer/wishlist');
        assertBrowserFacing(response);
    });
    await withGateway(() => ok({ linked: false, reason: 'store_account_unavailable', product_ids: [] }), async () => {
        const response = await call(wishlistRoute.GET, '/api/buyer/wishlist');
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { linked: false, storeAccountUnavailable: true, productIds: [] });
        assertBrowserFacing(response);
    });
});

test('buyer wishlist writes project only product fields and cannot override site or customer ownership', async () => {
    for (const [handler, method, body] of [
        [wishlistRoute.POST, 'POST', { productId: 'p1', variantId: 'v1', store_id: 'forged', customer_id: 'forged' }],
        [wishlistRoute.DELETE, 'DELETE', { productId: 'p1', store_id: 'forged', customer_id: 'forged' }],
    ] as const) {
        await withGateway((request) => request.url.pathname === '/v1/storefront/buyer/profile'
            ? ok({ buyer: { id: 'buyer-a' } })
            : ok({ saved: true }), async (requests) => {
            const response = await call(handler, '/api/buyer/wishlist', { method, body, expectedBuyerId: 'buyer-a' });
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { success: true });
            assert.equal(requests.length, 2, 'the BFF verifies the loaded principal before the wishlist mutation');
            assert.equal(requests[0].url.pathname, '/v1/storefront/buyer/profile');
            assertProxiedToGateway(requests[1], method, '/storefront/buyer/wishlist');
            assert.deepEqual(JSON.parse(requests[1].body || ''), method === 'POST' ? { product_id: 'p1', variant_id: 'v1' } : { product_id: 'p1' });
        });
    }
});

test('buyer wishlist refuses a stale cross-tab mutation before calling the wishlist writer', async () => {
    await withGateway((request) => {
        assert.equal(request.url.pathname, '/v1/storefront/buyer/profile');
        return ok({ buyer: { id: 'buyer-b' } });
    }, async (requests) => {
        const response = await call(wishlistRoute.POST, '/api/buyer/wishlist', {
            method: 'POST', body: { productId: 'product-private-to-buyer-a' }, expectedBuyerId: 'buyer-a',
        });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: 'Your account changed. Reload before changing your wishlist.' });
        assertBrowserFacing(response);
        assert.equal(requests.length, 1, 'a stale wishlist mutation never reaches the Gateway writer');
    });
});

test('buyer wishlist fails closed when its loaded principal is missing or cannot be checked', async () => {
    await withGateway(() => { throw new Error('missing comparison must stop before any buyer Gateway request'); }, async (requests) => {
        const response = await call(wishlistRoute.POST, '/api/buyer/wishlist', { method: 'POST', body: { productId: 'p1' } });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'Reload your account before changing your wishlist.' });
        assert.equal(requests.length, 0);
    });
    await withGateway((request) => request.url.pathname === '/v1/storefront/buyer/profile'
        ? jsonResponse({ error: { message: 'private database detail' } }, { status: 500, headers: LEAKY_HEADERS })
        : (() => { throw new Error('profile failure must stop before wishlist mutation'); })(), async (requests) => {
        const response = await call(wishlistRoute.DELETE, '/api/buyer/wishlist', {
            method: 'DELETE', body: { productId: 'p1' }, expectedBuyerId: 'buyer-a',
        });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your account could not be checked before changing your wishlist.' });
        assertBrowserFacing(response);
        assert.equal(requests.length, 1, 'profile preflight failure never reaches the wishlist writer');
    });
});

test('buyer wishlist requires the explicit link and sanitizes an unavailable gateway', async () => {
    await withGateway((request) => request.url.pathname === '/v1/storefront/buyer/profile'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({ error: { code: 'STORE_ACCOUNT_NOT_LINKED', message: 'private store customer details' } }, { status: 409, headers: LEAKY_HEADERS }), async () => {
        const response = await call(wishlistRoute.POST, '/api/buyer/wishlist', { method: 'POST', body: { productId: 'p1' }, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: 'Connect this store account before saving a wishlist.', code: 'STORE_ACCOUNT_NOT_LINKED' });
        assertBrowserFacing(response);
    });
    await withGateway((request) => request.url.pathname === '/v1/storefront/buyer/profile'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({ error: { code: 'STORE_ACCOUNT_UNAVAILABLE', message: 'private store customer details' } }, { status: 409, headers: LEAKY_HEADERS }), async () => {
        const response = await call(wishlistRoute.POST, '/api/buyer/wishlist', { method: 'POST', body: { productId: 'p1' }, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: 'This store account is unavailable for wishlist use. Contact the store for help.', code: 'STORE_ACCOUNT_UNAVAILABLE' });
        assertBrowserFacing(response);
    });
    await withGateway(() => { throw new Error('private-db-host'); }, async () => {
        const response = await call(wishlistRoute.GET, '/api/buyer/wishlist');
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your wishlist is unavailable right now.' });
        assertBrowserFacing(response);
    });
});

test('POST /api/reviews forwards only review content through the canonical buyer session', async () => {
    await withGateway((request) => {
        if (request.url.pathname === '/v1/storefront/buyer/profile') {
            assert.equal(request.method, 'GET');
            assert.equal(request.headers.get(buyerHeader), BUYER_TOKEN);
            return ok({ buyer: { id: 'buyer-a' } });
        }
        assert.equal(request.method, 'POST');
        assert.equal(request.url.pathname, '/v1/storefront/buyer/reviews');
        assert.deepEqual([...request.url.searchParams], [['store_id', SITE_ID]]);
        assert.equal(request.headers.get(buyerHeader), BUYER_TOKEN);
        assert.deepEqual([...request.headers.keys()].sort(), EXPECTED_UPSTREAM_HEADERS);
        assert.deepEqual(JSON.parse(request.body || ''), {
            product_id: 'product-1', rating: 5, title: 'Great', body: 'Solid quality', turnstile_token: 'challenge-token',
        });
        return ok({ review: { id: 'review-1', status: 'pending' }, message: 'Review submitted for approval.', customer_email: 'private@example.test' }, 201);
    }, async (requests) => {
        const response = await call(reviewsRoute.POST, '/api/reviews', { method: 'POST', body: {
            productId: 'product-1', storeId: SITE_ID, rating: 5, title: 'Great', reviewBody: 'Solid quality', turnstileToken: 'challenge-token',
            customerName: 'forged name', customerEmail: 'forged@example.test', is_verified: true, store_id: 'forged',
        }, expectedBuyerId: 'buyer-a' });
        assert.equal(response.status, 201);
        assertBrowserFacing(response);
        assert.deepEqual(await response.json(), { success: true, review: { id: 'review-1', status: 'pending' }, message: 'Review submitted for approval.' });
        assert.equal(requests.length, 2, 'the BFF revalidates the loaded principal before the review mutation');
        assert.equal(requests[0].url.pathname, '/v1/storefront/buyer/profile');
        assert.equal(requests[1].url.pathname, '/v1/storefront/buyer/reviews');
    });
});

test('POST /api/reviews refuses a stale buyer draft before calling the review writer', async () => {
    await withGateway((request) => {
        assert.equal(request.url.pathname, '/v1/storefront/buyer/profile');
        return ok({ buyer: { id: 'buyer-b' } });
    }, async (requests) => {
        const response = await call(reviewsRoute.POST, '/api/reviews', { method: 'POST', expectedBuyerId: 'buyer-a', body: {
            productId: 'product-1', storeId: SITE_ID, rating: 5, title: 'Private buyer A draft',
        } });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: 'Your account changed. Reload before submitting this review.' });
        assertBrowserFacing(response);
        assert.equal(requests.length, 1, 'a stale review draft never reaches the Gateway review mutation');
    });
});

test('POST /api/reviews fails closed when the rendered buyer is missing or the current profile cannot be verified', async () => {
    await withGateway(() => { throw new Error('the missing comparison must stop before any Gateway request'); }, async (requests) => {
        const response = await call(reviewsRoute.POST, '/api/reviews', { method: 'POST', body: {
            productId: 'product-1', storeId: SITE_ID, rating: 5,
        } });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'Reload your account before submitting this review.' });
        assert.equal(requests.length, 0);
    });
    await withGateway(() => jsonResponse({ error: { message: 'private database failure' } }, { status: 500, headers: LEAKY_HEADERS }), async (requests) => {
        const response = await call(reviewsRoute.POST, '/api/reviews', { method: 'POST', expectedBuyerId: 'buyer-a', body: {
            productId: 'product-1', storeId: SITE_ID, rating: 5,
        } });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your account could not be checked before submitting this review.' });
        assertBrowserFacing(response);
        assert.equal(requests.length, 1, 'a failed profile verification never reaches the review writer');
    });
});

test('POST /api/reviews requires a linked store account and hides upstream details', async () => {
    await withGateway((request) => request.url.pathname === '/v1/storefront/buyer/profile'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({ error: { code: 'STORE_ACCOUNT_NOT_LINKED', message: 'private@example.test' } }, { status: 409, headers: LEAKY_HEADERS }), async () => {
        const response = await call(reviewsRoute.POST, '/api/reviews', { method: 'POST', expectedBuyerId: 'buyer-a', body: { productId: 'product-1', storeId: SITE_ID, rating: 4 } });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: 'Connect this store account in your LetBuyy settings before submitting a review.', code: 'STORE_ACCOUNT_NOT_LINKED' });
        assertBrowserFacing(response);
    });
    await withGateway((request) => request.url.pathname === '/v1/storefront/buyer/profile'
        ? ok({ buyer: { id: 'buyer-a' } })
        : jsonResponse({ error: { code: 'STORE_ACCOUNT_UNAVAILABLE' } }, { status: 409 }), async () => {
        const response = await call(reviewsRoute.POST, '/api/reviews', { method: 'POST', expectedBuyerId: 'buyer-a', body: { productId: 'product-1', storeId: SITE_ID, rating: 4 } });
        assert.equal(response.status, 409);
        assert.equal((await response.json() as { code?: string }).code, 'STORE_ACCOUNT_UNAVAILABLE');
    });
});

test('GET /api/buyer/loyalty forwards the current store token and projects only exact balance fields', async () => {
    await withGateway((request) => {
        assertProxiedToGateway(request, 'GET', '/storefront/buyer/storefront-loyalty');
        return ok({ site_id: SITE_ID, enrolled: true, balance: '9007199254740993', is_active: true, earn_rate_bps: 2500, internal_note: 'never return' });
    }, async (requests) => {
        const response = await call(loyaltyRoute.GET, '/api/buyer/loyalty');
        assert.equal(response.status, 200);
        assertBrowserFacing(response);
        assert.deepEqual(await response.json(), { enrolled: true, balance: '9007199254740993', programActive: true });
        assert.equal(requests.length, 1);
    });
});

test('GET /api/buyer/loyalty distinguishes no programme from zero points and fails closed on unsafe balances', async () => {
    await withGateway(() => ok({ site_id: SITE_ID, enrolled: false, balance: null }), async () => {
        const response = await call(loyaltyRoute.GET, '/api/buyer/loyalty');
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { enrolled: false, balance: null });
    });
    await withGateway(() => ok({ site_id: SITE_ID, enrolled: true, balance: 0, is_active: false }), async () => {
        const response = await call(loyaltyRoute.GET, '/api/buyer/loyalty');
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { enrolled: true, balance: '0', programActive: false });
    });
    await withGateway(() => ok({ site_id: SITE_ID, enrolled: true, balance: Number.MAX_SAFE_INTEGER + 1, is_active: true }), async () => {
        const response = await call(loyaltyRoute.GET, '/api/buyer/loyalty');
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your rewards balance is unavailable right now.' });
    });
});

test('GET /api/buyer/loyalty/history returns only validated ledger fields', async () => {
    await withGateway((request) => {
        assert.equal(request.method, 'GET');
        assert.ok(request.url.pathname.endsWith('/storefront/buyer/storefront-loyalty/history'));
        assert.deepEqual([...request.url.searchParams], [['store_id', SITE_ID], ['limit', '50']]);
        assert.equal(request.headers.get(buyerHeader), BUYER_TOKEN);
        assert.deepEqual([...request.headers.keys()].sort(), EXPECTED_UPSTREAM_HEADERS);
        assert.equal(request.cache, 'no-store');
        return ok([{ id: 'entry-1', entry_type: 'earned', points: 250, balance_after: 900, created_at: '2026-10-04T00:00:00.000Z', site_id: 'foreign', buyer_account_id: 'foreign', metadata: { email: 'private@example.test' } }]);
    }, async (requests) => {
        const response = await call(loyaltyHistoryRoute.GET, '/api/buyer/loyalty/history');
        assert.equal(response.status, 200);
        assertBrowserFacing(response);
        assert.deepEqual(await response.json(), { entries: [{ id: 'entry-1', entryType: 'earned', points: '250', balanceAfter: '900', createdAt: '2026-10-04T00:00:00.000Z' }] });
        assert.equal(requests.length, 1);
    });
});
