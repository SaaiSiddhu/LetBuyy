import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { buyerCookieHeader, installGatewayFake, jsonResponse, type RecordedGatewayRequest } from '@/lib/api/gateway-fetch-fake.test-support';
import * as route from './route';

const checkoutUrl = 'https://checkout.letbuyy.com/checkout?site_id=0d8a7b1c-3e5f-4a6b-9c1d-2e3f4a5b6c7d&signature=opaque';

function request(body: unknown, options: { origin?: string | null; cookie?: string; url?: string; forwardedHost?: string; forwardedProto?: string; fetchSite?: string } = {}) {
    const headers = new Headers({ 'content-type': 'application/json' });
    if (options.origin !== null) headers.set('origin', options.origin ?? 'https://snaz.test');
    if (options.cookie) headers.set('cookie', options.cookie);
    if (options.forwardedHost) headers.set('x-forwarded-host', options.forwardedHost);
    if (options.forwardedProto) headers.set('x-forwarded-proto', options.forwardedProto);
    if (options.fetchSite) headers.set('sec-fetch-site', options.fetchSite);
    return new NextRequest(options.url ?? 'https://snaz.test/api/checkout-handoff', { method: 'POST', headers, body: JSON.stringify(body) });
}

const call = (body: unknown, options?: Parameters<typeof request>[1]) => route.POST(request(body, options));

async function withGateway(respond: (request: RecordedGatewayRequest) => Response, run: (requests: RecordedGatewayRequest[]) => Promise<void>) {
    const fake = installGatewayFake(respond);
    try { await run(fake.requests); } finally { fake.restore(); }
}

test('a signed buyer cookie is sent only server-to-server to the store-bound checkout handoff', async () => {
    await withGateway((upstream) => {
        assert.equal(upstream.method, 'POST');
        assert.equal(upstream.url.pathname, '/v1/storefront/snaz/cart/ct_1234567890abcdef/checkout-url');
        assert.equal(upstream.headers.get('x-letbuyy-storefront-session'), 'aaaaaaaa.bbbbbbbb.cccccccc');
        assert.equal(upstream.body, null);
        return jsonResponse({ data: { checkout_url: checkoutUrl } });
    }, async (requests) => {
        const response = await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' }, { cookie: buyerCookieHeader() });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), { checkout_url: checkoutUrl });
        assert.equal(requests.length, 1);
    });
});

test('guest checkout remains available without adding an identity header', async () => {
    await withGateway((upstream) => {
        assert.equal(upstream.headers.has('x-letbuyy-storefront-session'), false);
        return jsonResponse({ data: { checkout_url: checkoutUrl } });
    }, async () => {
        assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' })).status, 200);
    });
});

test('same-origin checkout survives a trusted reverse proxy host while cross-site requests stay denied', async () => {
    await withGateway(() => jsonResponse({ data: { checkout_url: checkoutUrl } }), async (requests) => {
        const forwarded = await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' }, {
            url: 'http://next-internal:9000/api/checkout-handoff',
            origin: 'https://snaz.test',
            forwardedHost: 'snaz.test',
            forwardedProto: 'https',
            fetchSite: 'same-origin',
        });
        assert.equal(forwarded.status, 200);
        assert.equal(requests.length, 1);

        const crossSite = await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' }, {
            url: 'http://next-internal:9000/api/checkout-handoff',
            origin: 'https://attacker.test',
            forwardedHost: 'snaz.test',
            forwardedProto: 'https',
            fetchSite: 'cross-site',
        });
        assert.equal(crossSite.status, 403);
        assert.equal(requests.length, 1, 'cross-site requests never reach the Gateway');
    });
});

test('foreign origins, malformed cookies, invalid input, and unsafe checkout hosts fail closed', async () => {
    await withGateway((upstream) => jsonResponse({ data: { checkout_url: upstream.url.searchParams.get('unsafe') === 'yes' ? 'https://checkout.attacker.test/checkout' : checkoutUrl } }), async (requests) => {
        assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' }, { origin: 'https://attacker.test' })).status, 403);
        assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' }, { cookie: '__Host-lb_store_buyer=malformed' })).status, 401);
        assert.equal((await call({ subdomain: '../attacker', cartToken: 'ct_1234567890abcdef' })).status, 400);
        assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef', buyerAccountId: 'forged' })).status, 400);
        assert.equal(requests.length, 0);
    });

    await withGateway(() => jsonResponse({ data: { checkout_url: 'https://checkout.attacker.test/checkout' } }), async () => {
        assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' })).status, 503);
    });
});
