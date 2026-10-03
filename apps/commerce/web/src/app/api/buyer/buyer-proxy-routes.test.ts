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

const ORIGIN = 'http://snaz.localhost:9000';
const NOT_AUTHENTICATED = { error: 'Not authenticated' };

type Handler = (request: NextRequest, context: { params: Promise<{ id: string }> }) => Promise<Response>;

interface CallOptions { method?: string; cookie?: string | null; body?: unknown; id?: string; origin?: string | null }

function call(handler: unknown, path: string, options: CallOptions = {}): Promise<Response> {
    const { method = 'GET', cookie = buyerCookieHeader(), body, id = 'addr-1' } = options;
    const headers = new Headers();
    headers.set('host', new URL(ORIGIN).host);
    if (options.origin !== null) headers.set('origin', options.origin ?? ORIGIN);
    if (cookie !== null) headers.set('cookie', cookie);
    if (body !== undefined) headers.set('content-type', 'application/json');
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
const SESSION_GATE_CASES: Array<{ name: string; handler: unknown; path: string; method: string; body?: unknown }> = [
    { name: 'GET /profile', handler: profileRoute.GET, path: '/api/buyer/profile', method: 'GET' },
    { name: 'PATCH /profile', handler: profileRoute.PATCH, path: '/api/buyer/profile', method: 'PATCH', body: { fullName: 'A' } },
    { name: 'GET /addresses', handler: addressesRoute.GET, path: '/api/buyer/addresses', method: 'GET' },
    { name: 'POST /addresses', handler: addressesRoute.POST, path: '/api/buyer/addresses', method: 'POST', body: { line1: 'x' } },
    { name: 'PATCH /addresses/:id', handler: addressRoute.PATCH, path: '/api/buyer/addresses/addr-1', method: 'PATCH', body: { line1: 'x' } },
    { name: 'DELETE /addresses/:id', handler: addressRoute.DELETE, path: '/api/buyer/addresses/addr-1', method: 'DELETE' },
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
                const response = await call(scenario.handler, scenario.path, { method: scenario.method, body: scenario.body });
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
                    const response = await call(scenario.handler, scenario.path, { method: scenario.method, body: scenario.body, origin });
                    assert.equal(response.status, 403);
                    assertBrowserFacing(response);
                    assert.equal(requests.length, 0);
                    assert.equal(resolved, false);
                }, () => { resolved = true; return jsonResponse({ data: { site_id: SITE_ID } }); });
            }
        });
    }
}

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

test('PATCH /profile forwards ONLY fullName and phone, renamed for the gateway; anything else the caller sends is dropped', async () => {
    await withGateway(() => ok({ buyer: { id: 'b1', full_name: 'New Name', phone: '+919999999999' } }), async (requests) => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', {
            method: 'PATCH',
            body: { fullName: 'New Name', phone: '+919999999999', email: 'evil@x.test', status: 'admin', role: 'owner', buyer_account_id: 'someone-else', session_epoch: 99 },
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { buyer: { id: 'b1', full_name: 'New Name', phone: '+919999999999' } });
        assertBrowserFacing(response);
        assert.equal(requests.length, 1);
        assertProxiedToGateway(requests[0], 'PATCH', '/storefront/buyer/profile');
        assert.deepEqual(JSON.parse(requests[0].body ?? 'null'), { full_name: 'New Name', phone: '+919999999999' }, 'the identity fields a buyer must not change never leave the proxy');
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
        assertBrowserFacing(nothingAllowed);
        assert.equal(requests.length, 0);
    });
});

test('PATCH /profile: a gateway client-error message passes through (400 keeps its status); a 5xx body is never relayed', async () => {
    await withGateway(() => jsonResponse({ error: { message: 'Phone number is not valid' } }, { status: 400, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: { phone: '1' } });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'Phone number is not valid' });
        assertBrowserFacing(response);
    });
    await withGateway(() => jsonResponse({ error: { message: 'deadlock detected in tx 4411' } }, { status: 500, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: { phone: '1' } });
        assert.equal(response.status, 503, 'a non-400 failure is reported as 503');
        assert.deepEqual(await response.json(), { error: 'Your profile could not be updated right now.' }, 'the status AND the message are generalised, so nothing the gateway said about its own failure reaches the browser');
    });
    await withGateway(() => jsonResponse({ error: { message: 'You already have the maximum of 10 saved values' } }, { status: 409, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: { phone: '1' } });
        assert.equal(response.status, 503, 'the existing status mapping is unchanged: only 400 keeps its status');
        assert.deepEqual(await response.json(), { error: 'You already have the maximum of 10 saved values' }, 'a client-error message is still user-facing and still relayed');
    });
    await withGateway(() => jsonResponse({ success: false, error: { message: 'session expired' } }, { status: 401, headers: LEAKY_HEADERS }), async () => {
        const response = await call(profileRoute.PATCH, '/api/buyer/profile', { method: 'PATCH', body: { phone: '1' } });
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
    await withGateway(() => ok({ address: { id: 'a9', ...body } }), async (requests) => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body });
        assert.equal(response.status, 201);
        assert.deepEqual(await response.json(), { address: { id: 'a9', ...body } });
        assertBrowserFacing(response);
        assertProxiedToGateway(requests[0], 'POST', '/storefront/buyer/addresses');
        assert.deepEqual(JSON.parse(requests[0].body ?? 'null'), body, 'address content is validated by the gateway, so it is forwarded as sent');
    });
});

test('POST /addresses: no JSON body is a 400 without a gateway call; a gateway 400 keeps its message; other failures are 503', async () => {
    await withGateway(() => ok({}), async (requests) => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body: 'not json' });
        assert.equal(response.status, 400);
        assert.equal(requests.length, 0);
    });
    await withGateway(() => jsonResponse({ error: { message: 'Pincode must be 6 digits' } }, { status: 400, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body: { pincode: '1' } });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'Pincode must be 6 digits' });
    });
    await withGateway(() => jsonResponse({}, { status: 502, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body: { line1: 'x' } });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: 'Your address could not be saved right now.' });
    });
    await withGateway(() => jsonResponse({ error: { message: 'insert into buyer_addresses failed: 23505 duplicate key' } }, { status: 500, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressesRoute.POST, '/api/buyer/addresses', { method: 'POST', body: { line1: 'x' } });
        assert.equal(response.status, 503);
        const text = await response.text();
        assert.equal(text.includes('buyer_addresses'), false, 'a database error from a 5xx must never reach the browser');
        assert.deepEqual(JSON.parse(text), { error: 'Your address could not be saved right now.' });
    });
});

// ── /api/buyer/addresses/[id] ─────────────────────────────────────────────────────────────────────────────────────────
test('PATCH /addresses/:id forwards to that one address and returns the updated address', async () => {
    await withGateway(() => ok({ address: { id: 'addr-1', city: 'Mumbai' } }), async (requests) => {
        const response = await call(addressRoute.PATCH, '/api/buyer/addresses/addr-1', { method: 'PATCH', id: 'addr-1', body: { city: 'Mumbai' } });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { address: { id: 'addr-1', city: 'Mumbai' } });
        assertBrowserFacing(response);
        assertProxiedToGateway(requests[0], 'PATCH', '/storefront/buyer/addresses/addr-1');
        assert.deepEqual(JSON.parse(requests[0].body ?? 'null'), { city: 'Mumbai' });
    });
});

test('PATCH /addresses/:id: a gateway 400 keeps its message; a 5xx body is never relayed', async () => {
    await withGateway(() => jsonResponse({ error: { message: 'Pincode must be 6 digits' } }, { status: 400, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressRoute.PATCH, '/api/buyer/addresses/addr-1', { method: 'PATCH', id: 'addr-1', body: { pincode: '1' } });
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'Pincode must be 6 digits' });
    });
    await withGateway(() => jsonResponse({ error: { message: 'connection to db-primary.internal refused' } }, { status: 500, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressRoute.PATCH, '/api/buyer/addresses/addr-1', { method: 'PATCH', id: 'addr-1', body: { city: 'x' } });
        assert.equal(response.status, 503);
        const text = await response.text();
        assert.equal(text.includes('db-primary'), false, 'an internal hostname from a 5xx must never reach the browser');
        assert.deepEqual(JSON.parse(text), { error: 'Your address could not be updated right now.' });
        assertBrowserFacing(response);
    });
});

test('an address id in the URL is only ever a path segment: traversal and query injection are encoded, not interpreted', async () => {
    const hostile = '../../admin/refunds?buyer=someone-else#frag';
    await withGateway(() => ok({ address: { id: 'x' } }), async (requests) => {
        await call(addressRoute.PATCH, '/api/buyer/addresses/x', { method: 'PATCH', id: hostile, body: { city: 'x' } });
        await call(addressRoute.DELETE, '/api/buyer/addresses/x', { method: 'DELETE', id: hostile });
        assert.equal(requests.length, 2);
        for (const request of requests) {
            assert.ok(request.url.pathname.endsWith(`/storefront/buyer/addresses/${encodeURIComponent(hostile)}`), request.url.pathname);
            assert.equal(request.url.search, `?store_id=${SITE_ID}`, 'the id cannot inject a query; only the resolved site is present');
            assert.equal(request.url.hash, '', 'a "#" in the id must not become a fragment');
            assert.equal(request.url.pathname.split('/').includes('admin'), false, 'a ".." in the id must not climb into another gateway route');
        }
    });
});

test('another buyer\'s address is indistinguishable from a missing one: gateway 404 is a plain 404 for PATCH and DELETE', async () => {
    await withGateway(() => jsonResponse({ error: { message: 'address a7 belongs to buyer b2' } }, { status: 404, headers: LEAKY_HEADERS }), async () => {
        for (const [handler, method, body] of [[addressRoute.PATCH, 'PATCH', { city: 'x' }], [addressRoute.DELETE, 'DELETE', undefined]] as const) {
            const response = await call(handler, '/api/buyer/addresses/a7', { method, id: 'a7', body });
            assert.equal(response.status, 404, `${method} of an address the buyer does not own`);
            const text = await response.text();
            assert.deepEqual(JSON.parse(text), { error: 'Address not found.' });
            assert.equal(text.includes('b2'), false, 'the owner of the address must never be named');
            assertBrowserFacing(response);
        }
    });
});

test('DELETE /addresses/:id answers { deleted: true } on success; a gateway 401 is a 401; other failures are a generic 503', async () => {
    await withGateway(() => ok({}), async (requests) => {
        const response = await call(addressRoute.DELETE, '/api/buyer/addresses/addr-1', { method: 'DELETE', id: 'addr-1' });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { deleted: true });
        assertBrowserFacing(response);
        assertProxiedToGateway(requests[0], 'DELETE', '/storefront/buyer/addresses/addr-1');
        assert.equal(requests[0].body, null);
    });
    await withGateway(() => jsonResponse({}, { status: 401, headers: LEAKY_HEADERS }), async () => {
        const response = await call(addressRoute.DELETE, '/api/buyer/addresses/addr-1', { method: 'DELETE', id: 'addr-1' });
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), NOT_AUTHENTICATED);
    });
    await withGateway(() => { throw new Error('ETIMEDOUT gateway-eu'); }, async () => {
        const response = await call(addressRoute.DELETE, '/api/buyer/addresses/addr-1', { method: 'DELETE', id: 'addr-1' });
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
