import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { STOREFRONT_BUYER_SESSION_COOKIE } from '@/lib/buyer-auth/flow';
import { BUYER_TOKEN, buyerCookieHeader, installGatewayFake, jsonResponse, SITE_ID, type RecordedGatewayRequest } from '@/lib/api/gateway-fetch-fake.test-support';
import { GET } from './session/route';

const STORE = {
    site_id: SITE_ID,
    subdomain: 'snaz',
    custom_domain: null,
    custom_domain_status: 'none',
    access_mode: 'public' as const,
    access_message: null,
    published: true,
    status: 'active',
};

async function withGateway(
    respond: (request: RecordedGatewayRequest) => Response,
    run: (requests: RecordedGatewayRequest[]) => Promise<void>,
) {
    const priorSecret = process.env.INTERNAL_API_SECRET;
    process.env.INTERNAL_API_SECRET = 'synthetic-session-route-secret';
    const fake = installGatewayFake(respond);
    try { await run(fake.requests); }
    finally {
        fake.restore();
        if (priorSecret === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = priorSecret;
    }
}

function sessionRequest(cookie = buyerCookieHeader()) {
    return new NextRequest('https://shop.example.test/api/buyer-auth/session', {
        headers: { host: 'shop.example.test', cookie },
    });
}

function resolveStore(request: RecordedGatewayRequest) {
    assert.equal(request.url.pathname, '/v1/internal/store-access/resolve');
    assert.equal(request.url.searchParams.get('host'), 'shop.example.test');
    assert.equal(request.headers.get('x-internal-api-secret'), 'synthetic-session-route-secret');
    return jsonResponse({ data: STORE });
}

test('buyer session BFF returns the verified opaque buyer ID and email without forwarding credentials', async () => {
    await withGateway((request) => {
        if (request.url.pathname === '/v1/internal/store-access/resolve') return resolveStore(request);
        assert.equal(request.url.pathname, '/v1/storefront/buyer/storefront-session');
        assert.equal(request.url.searchParams.get('store_id'), SITE_ID);
        assert.equal(request.headers.get(LETBUYY_STOREFRONT_SESSION_HEADER), BUYER_TOKEN);
        assert.equal(request.headers.has('cookie'), false);
        return jsonResponse({ data: { buyer: { id: 'buyer-id-opaque', email: 'buyer@example.test', email_verified: true } } });
    }, async (requests) => {
        const response = await GET(sessionRequest());
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), {
            buyer: { id: 'buyer-id-opaque', email: 'buyer@example.test', emailVerified: true },
        });
        assert.equal(requests.some((request) => request.headers.has(LETBUYY_STOREFRONT_SESSION_HEADER)), true);
        assert.deepEqual(requests.map((request) => request.url.pathname), [
            '/v1/internal/store-access/resolve',
            '/v1/storefront/buyer/storefront-session',
        ]);
    });
});

test('malformed verified session data fails closed without treating it as signed out', async () => {
    await withGateway((request) => request.url.pathname === '/v1/internal/store-access/resolve'
        ? resolveStore(request)
        : jsonResponse({ data: { buyer: { id: 42, email: 'buyer@example.test', email_verified: true } } }), async (requests) => {
        const response = await GET(sessionRequest());
        assert.equal(response.status, 503);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE), undefined);
        assert.deepEqual(requests.map((request) => request.url.pathname), [
            '/v1/internal/store-access/resolve',
            '/v1/storefront/buyer/storefront-session',
        ]);
    });
});

test('missing session stays signed out without resolving the store or calling Gateway', async () => {
    await withGateway(() => { throw new Error('unexpected Gateway call'); }, async (requests) => {
        const response = await GET(sessionRequest(''));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { buyer: null });
        assert.equal(requests.length, 0);
    });
});
