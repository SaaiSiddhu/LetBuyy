import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { LETBUYY_CUSTOMER_SESSION_COOKIE, LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import { STOREFRONT_BUYER_FLOW_COOKIE, STOREFRONT_BUYER_SESSION_COOKIE, encodeFlow } from '@/lib/buyer-auth/flow';
import { GET } from './callback/route';

const SITE_ID = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'header.payload.signature';
const STATE = 'A'.repeat(43);

test('the explicit PKCE link callback exchanges, host-checks, links the signed site, then sets the session', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiUrl = process.env.LETBUYY_API_BASE_URL;
    const originalAccountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL;
    const originalInternalSecret = process.env.INTERNAL_API_SECRET;
    process.env.LETBUYY_API_BASE_URL = 'https://gateway.example.test';
    process.env.NEXT_PUBLIC_ACCOUNTS_URL = 'https://accounts.example.test';
    process.env.INTERNAL_API_SECRET = 'test-internal-secret';
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url === 'https://accounts.example.test/api/buyer/oauth/token') {
            return Response.json({ access_token: TOKEN, site_id: SITE_ID, expires_in: 900 });
        }
        if (url.startsWith('https://gateway.example.test/v1/internal/store-access/resolve?')) {
            return Response.json({ data: { site_id: SITE_ID, subdomain: 'example', custom_domain: null, custom_domain_status: 'none', access_mode: 'public', access_message: null, published: true, status: 'active' } });
        }
        if (url === `https://gateway.example.test/v1/storefront/buyer/link-store-customer?store_id=${SITE_ID}`) {
            return Response.json({ success: true, data: { linked: {} } });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    try {
        const flow = encodeFlow({
            state: STATE,
            verifier: 'B'.repeat(43),
            returnTo: '/store/example/account/settings',
            redirectUri: 'https://shop.example.test/api/buyer-auth/callback',
            linkStoreCustomer: true,
        });
        const request = new NextRequest(`https://shop.example.test/api/buyer-auth/callback?code=one-time-code&state=${STATE}`, {
            headers: {
                host: 'shop.example.test',
                cookie: `${STOREFRONT_BUYER_FLOW_COOKIE}=${flow}; ${LETBUYY_CUSTOMER_SESSION_COOKIE}=old-store-session`,
            },
        });
        const response = await GET(request);

        assert.equal(response.status, 303, `${await response.clone().text()} calls=${JSON.stringify(calls.map((call) => call.url))}`);
        const location = new URL(response.headers.get('location') || '');
        assert.equal(location.origin, 'https://shop.example.test');
        assert.equal(location.pathname, '/store/example/account/settings');
        assert.equal(location.searchParams.get('buyer_link'), 'linked');
        assert.equal(response.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value, `${SITE_ID}~${TOKEN}`);
        assert.equal(response.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE)?.value, '');
        assert.equal(response.cookies.get(LETBUYY_CUSTOMER_SESSION_COOKIE)?.value, '');
        assert.equal(response.cookies.get(LETBUYY_CUSTOMER_SESSION_COOKIE)?.maxAge, 0);

        const exchange = calls.find((call) => call.url === 'https://accounts.example.test/api/buyer/oauth/token');
        assert.equal(exchange?.init?.method, 'POST');
        assert.match(String(exchange?.init?.body), /code_verifier=/);
        const link = calls.find((call) => call.url.includes('/v1/storefront/buyer/link-store-customer'));
        assert.ok(link);
        assert.equal(link.init?.method, 'POST');
        assert.equal(new Headers(link.init?.headers).get(LETBUYY_STOREFRONT_SESSION_HEADER), TOKEN);
        assert.equal(String(link.init?.body), JSON.stringify({ store_id: SITE_ID }));
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiUrl === undefined) delete process.env.LETBUYY_API_BASE_URL;
        else process.env.LETBUYY_API_BASE_URL = originalApiUrl;
        if (originalAccountsUrl === undefined) delete process.env.NEXT_PUBLIC_ACCOUNTS_URL;
        else process.env.NEXT_PUBLIC_ACCOUNTS_URL = originalAccountsUrl;
        if (originalInternalSecret === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = originalInternalSecret;
    }
});

test('a conflicting verified-account link preserves the existing store session', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiUrl = process.env.LETBUYY_API_BASE_URL;
    const originalAccountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL;
    const originalInternalSecret = process.env.INTERNAL_API_SECRET;
    process.env.LETBUYY_API_BASE_URL = 'https://gateway.example.test';
    process.env.NEXT_PUBLIC_ACCOUNTS_URL = 'https://accounts.example.test';
    process.env.INTERNAL_API_SECRET = 'test-internal-secret';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://accounts.example.test/api/buyer/oauth/token') {
            return Response.json({ access_token: TOKEN, site_id: SITE_ID, expires_in: 900 });
        }
        if (url.startsWith('https://gateway.example.test/v1/internal/store-access/resolve?')) {
            return Response.json({ data: { site_id: SITE_ID, subdomain: 'example', custom_domain: null, custom_domain_status: 'none', access_mode: 'public', access_message: null, published: true, status: 'active' } });
        }
        if (url === `https://gateway.example.test/v1/storefront/buyer/link-store-customer?store_id=${SITE_ID}`) {
            return Response.json({ error: { code: 'BUYER_STORE_LINK_CONFLICT' } }, { status: 409 });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    try {
        const flow = encodeFlow({
            state: STATE,
            verifier: 'B'.repeat(43),
            returnTo: '/store/example/account/settings',
            redirectUri: 'https://shop.example.test/api/buyer-auth/callback',
            linkStoreCustomer: true,
        });
        const request = new NextRequest(`https://shop.example.test/api/buyer-auth/callback?code=one-time-code&state=${STATE}`, {
            headers: {
                host: 'shop.example.test',
                cookie: `${STOREFRONT_BUYER_FLOW_COOKIE}=${flow}; ${LETBUYY_CUSTOMER_SESSION_COOKIE}=old-store-session`,
            },
        });
        const response = await GET(request);
        const location = new URL(response.headers.get('location') || '');

        assert.equal(response.status, 303);
        assert.equal(location.searchParams.get('buyer_link'), 'conflict');
        assert.equal(response.cookies.get(LETBUYY_CUSTOMER_SESSION_COOKIE), undefined);
        assert.equal(response.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE)?.value, `${SITE_ID}~${TOKEN}`);
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiUrl === undefined) delete process.env.LETBUYY_API_BASE_URL;
        else process.env.LETBUYY_API_BASE_URL = originalApiUrl;
        if (originalAccountsUrl === undefined) delete process.env.NEXT_PUBLIC_ACCOUNTS_URL;
        else process.env.NEXT_PUBLIC_ACCOUNTS_URL = originalAccountsUrl;
        if (originalInternalSecret === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = originalInternalSecret;
    }
});


test('an expired or missing flow stays denied and offers a fresh same-store sign-in without replaying its code', async () => {
    const originalFetch = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async () => { requests++; throw new Error('Expired flow must never reach token exchange'); }) as typeof fetch;
    try {
        const response = await GET(new NextRequest('https://shop.example.test/api/buyer-auth/callback?code=expired-synthetic-code&state=expired-synthetic-state', { headers: { host: 'shop.example.test' } }));
        const html = await response.text();
        assert.equal(response.status, 400);
        assert.equal(requests, 0);
        assert.equal(response.cookies.get(STOREFRONT_BUYER_FLOW_COOKIE)?.maxAge, 0);
        assert.equal(response.cookies.get(STOREFRONT_BUYER_SESSION_COOKIE), undefined);
        assert.equal(response.headers.get('location'), null, 'no automatic auth loop');
        assert.match(html, /href="\/api\/buyer-auth\/start">Start a new sign-in/);
        assert.ok(!html.includes('expired-synthetic-code') && !html.includes('expired-synthetic-state'));
    } finally {
        globalThis.fetch = originalFetch;
    }
});
