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
