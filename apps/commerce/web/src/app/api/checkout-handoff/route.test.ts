import { DEFAULT_STOREFRONT_DOMAIN } from '@letbuyy/shared-types';
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
        const result = new URL((await response.json()).checkout_url);
        assert.equal(result.searchParams.get('storefront_return_origin'), 'https://snaz.test');
        result.searchParams.delete('storefront_return_origin');
        assert.equal(result.toString(), checkoutUrl, 'financial handoff fields remain unchanged');
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
        assert.equal(new URL((await forwarded.json()).checkout_url).searchParams.get('storefront_return_origin'), 'https://snaz.test');
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
        assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef', storefront_return_origin: 'https://attacker.test' })).status, 400);
        assert.equal(requests.length, 0);
    });

    await withGateway(() => jsonResponse({ data: { checkout_url: 'https://checkout.attacker.test/checkout' } }), async () => {
        assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' })).status, 503);
    });
});

test('production handoff honors its explicit checkout origin while rejecting other ports and tenant checkout hosts', async () => {
    const keys = ['NODE_ENV', 'CHECKOUT_ORIGIN', 'NEXT_PUBLIC_STORE_ROOT_DOMAIN'];
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    try {
        Object.assign(process.env, { NODE_ENV: 'production' });
        process.env.CHECKOUT_ORIGIN = 'https://checkout.localhost:4321';
        process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN = DEFAULT_STOREFRONT_DOMAIN;
        const target = new URL(checkoutUrl); target.hostname = 'checkout.localhost'; target.port = '4321';
        await withGateway(() => jsonResponse({ data: { checkout_url: target.href } }), async () => {
            assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' })).status, 200);
            target.port = '4322';
            assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' })).status, 503);
            target.hostname = `checkout.${DEFAULT_STOREFRONT_DOMAIN}`; target.port = '4321';
            assert.equal((await call({ subdomain: 'snaz', cartToken: 'ct_1234567890abcdef' })).status, 503);
        });
    } finally {
        for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
});
