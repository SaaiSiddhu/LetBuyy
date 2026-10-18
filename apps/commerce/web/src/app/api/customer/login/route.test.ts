import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from './route';

function request(origin: string, fetchSite: string, contentType = 'application/x-www-form-urlencoded', storeId = 'store-b') {
    return new NextRequest('https://shop.example.test/api/customer/login', {
        method: 'POST',
        headers: {
            host: 'shop.example.test',
            origin,
            'sec-fetch-site': fetchSite,
            'content-type': contentType,
        },
        body: contentType === 'application/x-www-form-urlencoded'
            ? new URLSearchParams({ email: 'buyer@example.test', password: 'secret', storeId })
            : JSON.stringify({ email: 'buyer@example.test', password: 'secret', storeId }),
    });
}

test('legacy customer login rejects cross-site and sibling-store form posts before authenticating', async () => {
    const crossSite = await POST(request('https://attacker.example', 'cross-site'));
    assert.equal(crossSite.status, 403);
    assert.equal(crossSite.headers.get('cache-control'), 'no-store');
    assert.equal(crossSite.cookies.getAll().length, 0);

    const sibling = await POST(request('https://other-store.example.test', 'same-site'));
    assert.equal(sibling.status, 403);
    assert.equal(sibling.cookies.getAll().length, 0);
});

test('legacy customer login rejects a submitted store ID that differs from the storefront host before Gateway auth', async () => {
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
        const response = await POST(request('https://shop.example.test', 'same-origin', 'application/json', 'store-b'));
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(requests, 1, 'the Gateway login route must not be called for another store');
    } finally {
        globalThis.fetch = oldFetch;
        if (oldApiUrl === undefined) delete process.env.LETBUYY_API_BASE_URL;
        else process.env.LETBUYY_API_BASE_URL = oldApiUrl;
        if (oldInternalSecret === undefined) delete process.env.INTERNAL_API_SECRET;
        else process.env.INTERNAL_API_SECRET = oldInternalSecret;
    }
});

test('legacy customer JSON login rejects a same-host scheme mismatch', async () => {
    const response = await POST(request('http://shop.example.test', 'same-origin', 'application/json'));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.cookies.getAll().length, 0);
});
