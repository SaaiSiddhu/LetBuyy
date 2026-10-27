import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { STOREFRONT_BUYER_FLOW_COOKIE, decodeFlow } from '@/lib/buyer-auth/flow';
import { GET, POST } from './start/route';

test('registration screen intent is carried to canonical identity authorization', async () => {
    const response = await GET(new NextRequest('https://shop.example.test/api/buyer-auth/start?screen=register&return_to=%2Faccount', {
        headers: { host: 'shop.example.test' },
    }));
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get('location') || '');
    assert.equal(location.pathname, '/buyer/authorize');
    assert.equal(location.searchParams.get('screen'), 'register');
    assert.equal(location.searchParams.get('redirect_uri'), 'https://shop.example.test/api/buyer-auth/callback');
});

test('buyer authorization screen query only accepts the registration hint', async () => {
    const response = await GET(new NextRequest('https://shop.example.test/api/buyer-auth/start?screen=admin', {
        headers: { host: 'shop.example.test' },
    }));
    const location = new URL(response.headers.get('location') || '');
    assert.equal(location.searchParams.has('screen'), false);
});

function linkRequest(fetchSite: string, field = 'action', accept?: string) {
    return new NextRequest('https://shop.example.test/api/buyer-auth/start', {
        method: 'POST',
        headers: {
            host: 'shop.example.test',
            origin: 'https://shop.example.test',
            'sec-fetch-site': fetchSite,
            'content-type': 'application/x-www-form-urlencoded',
            ...(accept ? { accept } : {}),
        },
        body: new URLSearchParams({ [field]: 'link_store_customer', return_to: '/store/example/account/settings' }),
    });
}

test('store-customer linking PKCE starts only after an explicit same-origin POST', async () => {
    const rejected = await POST(linkRequest('cross-site'));
    assert.equal(rejected.status, 403);
    assert.equal(rejected.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE), undefined);

    const accepted = await POST(linkRequest('same-origin'));
    assert.equal(accepted.status, 303);
    assert.match(accepted.headers.get('location') || '', /^https:\/\/accounts\.letbuyy\.com\/buyer\/authorize\?/);
    const flow = decodeFlow(accepted.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE)?.value);
    assert.equal(flow?.linkStoreCustomer, true);
    assert.equal(flow?.returnTo, '/store/example/account/settings');
    assert.equal(flow?.redirectUri, 'https://shop.example.test/api/buyer-auth/callback');
});

test('same-origin account-link fetch receives the authorize URL as JSON and keeps the flow cookie', async () => {
    const response = await POST(linkRequest('same-origin', 'intent', 'application/json'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json() as { redirectTo?: string };
    assert.match(body.redirectTo || '', /^https:\/\/accounts\.letbuyy\.com\/buyer\/authorize\?/);
    const flow = decodeFlow(response.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE)?.value);
    assert.equal(flow?.linkStoreCustomer, true);
});

test('store-customer linking accepts the sanitizer-safe intent field used by Liquid sign-in', async () => {
    const accepted = await POST(linkRequest('same-origin', 'intent'));
    assert.equal(accepted.status, 303);
    const flow = decodeFlow(accepted.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE)?.value);
    assert.equal(flow?.linkStoreCustomer, true);
    assert.equal(flow?.returnTo, '/store/example/account/settings');
});


test('discovery auth moves to the tenant before minting a PKCE cookie', async () => {
    const originalFetch = globalThis.fetch;
    const previousApi = process.env.LETBUYY_API_BASE_URL;
    const previousSecret = process.env.INTERNAL_API_SECRET;
    process.env.LETBUYY_API_BASE_URL = 'https://gateway.example.invalid';
    process.env.INTERNAL_API_SECRET = crypto.randomUUID();
    let customDomain: string | null = null;
    globalThis.fetch = (async (input) => {
        const url = new URL(String(input));
        assert.equal(url.origin, 'https://gateway.example.invalid');
        assert.equal(url.searchParams.get('host'), 'synthetic-store.stores.example.test');
        return Response.json({ data: { site_id: crypto.randomUUID(), subdomain: 'synthetic-store', custom_domain: customDomain, custom_domain_status: customDomain ? 'active' : 'pending', published: true, status: 'published', access_mode: 'public' } });
    }) as typeof fetch;
    const previousRoot = process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN;
    const previousAliases = process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES;
    process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN = 'stores.example.test';
    process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES = 'discovery.platform.example.test';
    try {
        const first = await GET(new NextRequest('https://discovery.platform.example.test/api/buyer-auth/start?screen=register&return_to=%2Fstore%2Fsynthetic-store%2Faccount%2Fsettings', {
            headers: { host: 'discovery.platform.example.test' },
        }));
        assert.equal(first.status, 303);
        assert.equal(first.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE), undefined);
        const destination = new URL(first.headers.get('location') || '');
        assert.equal(destination.origin, 'https://synthetic-store.stores.example.test');
        assert.equal(destination.pathname, '/api/buyer-auth/start');
        assert.equal(destination.searchParams.get('return_to'), '/account/settings');
        assert.equal(destination.searchParams.get('screen'), 'register');
        const next = await GET(new NextRequest(destination, { headers: { host: destination.host } }));
        const authorization = new URL(next.headers.get('location') || '');
        assert.equal(authorization.searchParams.get('redirect_uri'), 'https://synthetic-store.stores.example.test/api/buyer-auth/callback');
        const flow = decodeFlow(next.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE)?.value);
        assert.equal(flow?.returnTo, '/account/settings');
        assert.ok(flow?.state);
        assert.ok(flow?.verifier);
        assert.equal(next.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE)?.domain, undefined);
        customDomain = 'shop.merchant.example';
        const custom = await GET(new NextRequest('https://discovery.platform.example.test/api/buyer-auth/start?return_to=%2Fstore%2Fsynthetic-store%2Faccount', { headers: { host: 'discovery.platform.example.test' } }));
        assert.equal(new URL(custom.headers.get('location') || '').origin, 'https://shop.merchant.example');
        assert.equal(custom.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE), undefined);
        globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
        const down = await GET(new NextRequest('https://discovery.platform.example.test/api/buyer-auth/start?return_to=%2Fstore%2Fsynthetic-store%2Faccount', { headers: { host: 'discovery.platform.example.test' } }));
        assert.equal(down.status, 503);
        assert.equal(down.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE), undefined);
        for (const path of ['//attacker.invalid/account', '/store/attacker.invalid/account', '/store/checkout/account', '/account']) {
            const bad = await GET(new NextRequest(`https://discovery.platform.example.test/api/buyer-auth/start?return_to=${encodeURIComponent(path)}`, { headers: { host: 'discovery.platform.example.test' } }));
            assert.equal(bad.status, 400);
            assert.equal(bad.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE), undefined);
        }
    } finally {
        globalThis.fetch = originalFetch;
        if (previousApi === undefined) delete process.env.LETBUYY_API_BASE_URL; else process.env.LETBUYY_API_BASE_URL = previousApi;
        if (previousSecret === undefined) delete process.env.INTERNAL_API_SECRET; else process.env.INTERNAL_API_SECRET = previousSecret;
        if (previousRoot === undefined) delete process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN; else process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN = previousRoot;
        if (previousAliases === undefined) delete process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES; else process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN_ALIASES = previousAliases;
    }
});
