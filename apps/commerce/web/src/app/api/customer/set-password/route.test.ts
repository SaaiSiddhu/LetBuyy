import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { isInvalidCustomerResetError } from '@/lib/customer-reset-errors';
import { POST } from './route';

function request(origin: string, fetchSite = 'same-origin', storeId = 'store-a') {
    return new NextRequest('https://shop.example.test/api/customer/set-password', {
        method: 'POST',
        headers: { origin, 'sec-fetch-site': fetchSite, 'content-type': 'application/json' },
        body: JSON.stringify({
            action: 'request_reset',
            email: 'buyer@example.test',
            storeId,
            resetUrl: 'https://shop.example.test/customers/reset-password',
        }),
    });
}

test('password reset rejects cross-origin and sibling-store requests before resolving a tenant', async () => {
    const oldFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
        calls += 1;
        throw new Error('must not reach the storefront resolver');
    }) as typeof fetch;
    try {
        const crossOrigin = await POST(request('https://attacker.example', 'cross-site'));
        assert.equal(crossOrigin.status, 403);
        assert.equal(crossOrigin.headers.get('cache-control'), 'no-store');

        const sibling = await POST(request('https://sibling.example.test', 'same-site'));
        assert.equal(sibling.status, 403);
        assert.equal(calls, 0);
    } finally {
        globalThis.fetch = oldFetch;
    }
});

test('password reset refuses a store ID different from the requesting storefront host', async () => {
    const oldFetch = globalThis.fetch;
    const oldApiUrl = process.env.LETBUYY_API_BASE_URL;
    const oldInternalSecret = process.env.INTERNAL_API_SECRET;
    process.env.LETBUYY_API_BASE_URL = 'https://gateway.example.test';
    process.env.INTERNAL_API_SECRET = 'test-internal-secret';
    let requests = 0;
    globalThis.fetch = (async () => {
        requests += 1;
        return new Response(JSON.stringify({ data: { site_id: 'store-a' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    }) as typeof fetch;
    try {
        const response = await POST(request('https://shop.example.test', 'same-origin', 'store-b'));
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(requests, 1);
    } finally {
        globalThis.fetch = oldFetch;
        if (oldApiUrl === undefined) delete process.env.LETBUYY_API_BASE_URL;
        else process.env.LETBUYY_API_BASE_URL = oldApiUrl;
        if (oldInternalSecret === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = oldInternalSecret;
    }
});

test('password reset recognizes only the Gateway invalid-or-expired token response for sanitized mapping', () => {
    assert.equal(isInvalidCustomerResetError({ status: 400, code: 'INVALID_RESET_TOKEN' }), true);
    assert.equal(isInvalidCustomerResetError({ status: 400, code: 'VALIDATION' }), false);
    assert.equal(isInvalidCustomerResetError({ status: 503, code: 'INVALID_RESET_TOKEN' }), false);
    assert.equal(isInvalidCustomerResetError(new Error('private upstream detail')), false);
});
