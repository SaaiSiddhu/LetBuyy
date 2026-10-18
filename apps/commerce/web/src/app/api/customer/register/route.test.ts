import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from './route';

test('JSON legacy registration requests fail closed without forwarding personal data', async () => {
    const response = await POST(new NextRequest('https://shop.example.test/api/customer/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'buyer@example.invalid', password: 'synthetic-password', storeId: 'synthetic-store' }),
    }));

    assert.equal(response.status, 410);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.code, 'CANONICAL_BUYER_ACCOUNT_REQUIRED');
    assert.equal(body.sign_in_path, '/api/buyer-auth/start');
});

test('stale Liquid registration form requests enter the PKCE flow and return to this store account', async () => {
    const response = await POST(new NextRequest('https://shop.example.test/api/customer/register', {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            referer: 'https://shop.example.test/store/local-kicks/customers/register',
        },
        body: new URLSearchParams({ email: 'buyer@example.invalid', password: 'ignored' }),
    }));

    assert.equal(response.status, 303);
    const location = new URL(response.headers.get('location') || '');
    assert.equal(location.pathname, '/api/buyer-auth/start');
    assert.equal(location.searchParams.get('return_to'), '/store/local-kicks/account');
    assert.equal(location.searchParams.get('screen'), 'register');
    assert.equal(response.headers.get('cache-control'), 'no-store');
});
