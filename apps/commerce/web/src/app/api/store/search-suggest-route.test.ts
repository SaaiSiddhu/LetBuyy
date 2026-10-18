// T5/W3 (CAP-C28, CAP-C76) -- GET /api/store/:subdomain/search-suggest is the predictive-search read behind the Liquid
// header's search overlay. It is a thin BFF read over the gateway's public, tenant-safe products route: the subdomain
// is resolved to a site_id SERVER-SIDE inside the gateway, the route holds no data, and every /v1 call sits behind the
// gateway's own rate limiting. What the route itself owns -- and what has to be proven -- is only: it validates its
// input before calling anything, it takes the tenant from the route segment and from nowhere else, it projects the
// result down to public suggestion fields, it forwards nothing of the browser's identity, and a gateway failure
// degrades to "no suggestions" without leaking why.
//
// The real route, ProductService, the api-client and its response unwrapping all run; only the global fetch is faked.
//
// This file sits beside the [subdomain] directory rather than inside it on purpose: `node --test` reads a path argument as a
// glob, so `[subdomain]` is a character class that matches nothing and the run reports 0 tests with a clean exit.
import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { installGatewayFake, jsonResponse, type GatewayResponder, type RecordedGatewayRequest } from '@/lib/api/gateway-fetch-fake.test-support';
import { GET } from './[subdomain]/search-suggest/route';

async function search(subdomain: string, query: string | null, headers: Record<string, string> = {}, extraQuery: Record<string, string> = {}): Promise<Response> {
    const url = new URL(`http://snaz.localhost:9000/api/store/${encodeURIComponent(subdomain)}/search-suggest`);
    if (query !== null) url.searchParams.set('q', query);
    for (const [key, value] of Object.entries(extraQuery)) url.searchParams.set(key, value);
    return GET(new NextRequest(url, { headers }), { params: Promise.resolve({ subdomain }) });
}

async function withGateway<T>(respond: GatewayResponder, run: (requests: RecordedGatewayRequest[]) => Promise<T>): Promise<T> {
    const fake = installGatewayFake(respond);
    // The route logs a gateway failure server-side; keep that out of the test output without hiding it from the test.
    const originalError = console.error;
    console.error = () => {};
    try {
        return await run(fake.requests);
    } finally {
        console.error = originalError;
        fake.restore();
    }
}

const product = (n: number, overrides: Record<string, unknown> = {}) => ({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name: `Product ${n}`,
    price: 100 + n,
    currency: 'INR',
    images: [`https://cdn.example/p${n}.jpg`, `https://cdn.example/p${n}-b.jpg`],
    // Fields a suggestion must never carry to the browser, whatever the gateway returned.
    cost_price: 40,
    store_id: 'site-internal-id',
    stock_quantity: 3,
    supplier_notes: 'internal',
    ...overrides,
});
const listing = (products: unknown[]) => jsonResponse({ success: true, data: products, meta: { total: products.length, page: 1, per_page: 50, has_next: false } });

test('a real query reads the gateway\'s public product search for THIS store and returns only public suggestion fields', async () => {
    await withGateway(() => listing([product(1), product(2)]), async (requests) => {
        const response = await search('snaz', 'shoe');
        assert.equal(response.status, 200);
        const { results } = await response.json() as { results: Array<Record<string, unknown>> };
        assert.equal(results.length, 2);
        assert.deepEqual(results[0], { id: product(1).id, title: 'Product 1', price: 101, currency: 'INR', image: 'https://cdn.example/p1.jpg', url: `/store/snaz/product/${product(1).id}` });
        for (const result of results) {
            assert.deepEqual(Object.keys(result).sort(), ['currency', 'id', 'image', 'price', 'title', 'url'], 'a suggestion carries exactly these fields');
        }
        assert.equal(requests.length, 1);
        assert.equal(requests[0].method, 'GET');
        assert.ok(requests[0].url.pathname.endsWith('/storefront/snaz/products'), requests[0].url.pathname);
        assert.equal(requests[0].url.searchParams.get('search'), 'shoe');
        assert.equal(requests[0].url.searchParams.get('limit'), '50');
    });
});

test('a query shorter than two characters (or blank, or absent) returns no suggestions and never calls the gateway', async () => {
    await withGateway(() => listing([product(1)]), async (requests) => {
        for (const query of ['', ' ', 'a', ' a ', null]) {
            const response = await search('snaz', query);
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { results: [] }, `query ${JSON.stringify(query)}`);
        }
        assert.equal(requests.length, 0);
    });
});

test('a subdomain that is not a plain store label is a 400 and reaches nothing', async () => {
    await withGateway(() => listing([product(1)]), async (requests) => {
        for (const subdomain of ['snaz/../admin', 'snaz.evil.com', 'sn az', 'sn@z', 'snaz;drop', 'snaz\u0000', 'snaz?x=1', '../snaz', 'snaz#frag']) {
            const response = await search(subdomain, 'shoe');
            assert.equal(response.status, 400, JSON.stringify(subdomain));
            assert.deepEqual(await response.json(), { error: 'Invalid store' });
        }
        assert.equal(requests.length, 0, 'validation happens before any upstream call');
    });
});

test('the tenant comes from the route segment only: a query parameter or header naming another store changes nothing', async () => {
    await withGateway(() => listing([product(1)]), async (requests) => {
        await search('snaz', 'shoe', { 'x-store-id': 'other-store', 'x-forwarded-host': 'other.localhost' }, { subdomain: 'other', store: 'other', site_id: 'other', store_id: 'other' });
        assert.equal(requests.length, 1);
        assert.ok(requests[0].url.pathname.endsWith('/storefront/snaz/products'), 'the store in the upstream path is the route segment');
        assert.deepEqual([...requests[0].url.searchParams.keys()].sort(), ['limit', 'search'], 'no caller-supplied parameter reaches the gateway');
        assert.equal(requests[0].headers.get('x-store-id'), null);
    });
});

test('the caller\'s query is a single search value: separators and fragments cannot add parameters', async () => {
    await withGateway(() => listing([]), async (requests) => {
        await search('snaz', '  shoes&limit=999&store_id=x#y  ');
        assert.equal(requests[0].url.searchParams.get('search'), 'shoes&limit=999&store_id=x#y', 'trimmed, and otherwise carried verbatim as ONE value');
        assert.equal(requests[0].url.searchParams.get('limit'), '50', 'the result cap cannot be raised by the caller');
        assert.equal(requests[0].url.searchParams.has('store_id'), false);
        assert.equal(requests[0].url.hash, '');
    });
});

test('at most six suggestions are returned, in the gateway\'s order', async () => {
    await withGateway(() => listing(Array.from({ length: 12 }, (_, i) => product(i + 1))), async () => {
        const { results } = await (await search('snaz', 'product')).json() as { results: Array<{ title: string }> };
        assert.equal(results.length, 6);
        assert.deepEqual(results.map((result) => result.title), ['Product 1', 'Product 2', 'Product 3', 'Product 4', 'Product 5', 'Product 6']);
    });
});

test('a product with no currency defaults to INR, and one with no image has image null (object-shaped images are read too)', async () => {
    await withGateway(() => listing([
        product(1, { currency: undefined, images: [] }),
        product(2, { currency: '', images: undefined }),
        product(3, { images: [{ url: 'https://cdn.example/object-shaped.jpg' }] }),
    ]), async () => {
        const { results } = await (await search('snaz', 'product')).json() as { results: Array<{ currency: string; image: string | null }> };
        assert.deepEqual(results.map((r) => [r.currency, r.image]), [['INR', null], ['INR', null], ['INR', 'https://cdn.example/object-shaped.jpg']]);
    });
});

test('nothing of the browser\'s identity is forwarded: cookies and Authorization stay on the store origin, and no cookie is needed', async () => {
    await withGateway(() => listing([product(1)]), async (requests) => {
        await search('snaz', 'shoe', { cookie: '__Host-lb_store_buyer=0d8a7b1c-3e5f-4a6b-9c1d-2e3f4a5b6c7d~aaaa.bbbb.cccc; theme=dark', authorization: 'Bearer should-not-travel' });
        await search('snaz', 'shoe');
        assert.equal(requests.length, 2);
        for (const request of requests) {
            assert.equal(request.headers.get('cookie'), null);
            assert.equal(request.headers.get('authorization'), null);
        }
    });
});

test('a gateway failure of any kind degrades to "no suggestions" and says nothing about why', async () => {
    const failures: Array<[string, GatewayResponder]> = [
        ['a network error', () => { throw new Error('connect ECONNREFUSED 10.0.0.5:8787 (gateway-prod-eu)'); }],
        ['a 500 with an internal message', () => jsonResponse({ success: false, error: { message: 'relation "products" does not exist' } }, { status: 500 })],
        ['a 429', () => jsonResponse({ success: false, error: { message: 'rate limited by tenant 9c04' } }, { status: 429 })],
        ['a body that is not the expected envelope', () => new Response('<html>bad gateway</html>', { status: 502 })],
    ];
    for (const [label, respond] of failures) {
        await withGateway(respond, async () => {
            const response = await search('snaz', 'shoe');
            assert.equal(response.status, 200, label);
            const text = await response.text();
            assert.deepEqual(JSON.parse(text), { results: [] }, label);
            for (const secret of ['ECONNREFUSED', 'gateway-prod-eu', 'relation', 'tenant 9c04']) {
                assert.equal(text.includes(secret), false, `${label}: ${secret} must not reach the browser`);
            }
        });
    }
});
