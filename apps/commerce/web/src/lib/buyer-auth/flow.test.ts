import assert from 'node:assert/strict';
import test from 'node:test';
import {
    decodeFlow,
    encodeFlow,
    isSameOriginRequest,
    type StorefrontBuyerFlow,
} from './flow';

const validFlow: StorefrontBuyerFlow = {
    state: 'A'.repeat(43),
    verifier: 'B'.repeat(43),
    returnTo: '/store/example/account/settings',
    redirectUri: 'https://shop.example.com/api/buyer-auth/callback',
};

test('the PKCE flow preserves an explicit store-customer link intent', () => {
    const encoded = encodeFlow({ ...validFlow, linkStoreCustomer: true });
    assert.deepEqual(decodeFlow(encoded), { ...validFlow, linkStoreCustomer: true });
    assert.deepEqual(decodeFlow(encodeFlow(validFlow)), validFlow);
});

test('the PKCE flow rejects unknown values for link intent', () => {
    const encoded = btoa(JSON.stringify({ ...validFlow, linkStoreCustomer: 'true' }))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    assert.equal(decodeFlow(encoded), null);
});

test('an explicit link flow requires a same-origin browser request', () => {
    const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });
    const requestUrl = 'https://shop.example.com/api/buyer-auth/start';
    assert.equal(isSameOriginRequest(headers({ 'sec-fetch-site': 'same-origin' }), requestUrl), true);
    assert.equal(isSameOriginRequest(headers({ 'sec-fetch-site': 'cross-site', origin: 'https://shop.example.com' }), requestUrl), false);
    assert.equal(isSameOriginRequest(headers({ 'sec-fetch-site': 'same-site', origin: 'https://sibling.example.com' }), requestUrl), false);
    assert.equal(isSameOriginRequest(headers({ origin: 'https://attacker.example' }), requestUrl), false);
    assert.equal(isSameOriginRequest(headers({ origin: 'http://shop.example.com' }), requestUrl), false);
    assert.equal(isSameOriginRequest(headers({ origin: 'https://shop.example.com:8443' }), requestUrl), false);
    assert.equal(isSameOriginRequest(headers({ origin: 'https://shop.example.com' }), requestUrl), true);
    assert.equal(isSameOriginRequest(headers({}), requestUrl), false);
});

test('same-origin checks use the trusted public origin when Next receives a rewritten proxy URL', () => {
    const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });
    const internalRequestUrl = 'http://localhost:3000/api/buyer-auth/start';
    assert.equal(isSameOriginRequest(headers({
        origin: 'https://shop.example.com',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-host': 'shop.example.com',
        'x-forwarded-proto': 'https',
    }), internalRequestUrl), true);

    assert.equal(isSameOriginRequest(headers({
        origin: 'https://sibling.example.com',
        'sec-fetch-site': 'same-site',
        'x-forwarded-host': 'shop.example.com',
        'x-forwarded-proto': 'https',
    }), internalRequestUrl), false);
    assert.equal(isSameOriginRequest(headers({
        origin: 'https://shop.example.com',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-host': 'sibling.example.com',
        'x-forwarded-proto': 'https',
    }), internalRequestUrl), false);
    assert.equal(isSameOriginRequest(headers({
        origin: 'https://shop.example.com',
        'sec-fetch-site': 'same-origin',
        'x-forwarded-host': 'shop.example.com, attacker.example',
        'x-forwarded-proto': 'https',
    }), internalRequestUrl), false);
});


test('privacy entry uses only the current account hint at a secure Identity origin', async()=>{
 const {buyerPrivacyUrl}=await import('./flow');const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
 const uri=new URL(buyerPrivacyUrl(id,{NEXT_PUBLIC_ACCOUNTS_URL:'https://accounts.letbuyy.test'}));
 assert.equal(uri.origin,'https://accounts.letbuyy.test');assert.equal(uri.pathname,'/buyer/privacy');assert.deepEqual([...uri.searchParams],[['buyer_hint',id]]);
 for(const origin of ['http://evil.example','https://user:password@accounts.example'])assert.throws(()=>buyerPrivacyUrl(id,{NEXT_PUBLIC_ACCOUNTS_URL:origin}));
 assert.throws(()=>buyerPrivacyUrl('not-an-account'));
});
