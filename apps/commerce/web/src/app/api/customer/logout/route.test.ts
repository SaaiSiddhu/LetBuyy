import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { customerLogoutResponse } from '@/lib/customer-logout';
import { isAllowedCustomerLogoutOrigin as isAllowedOrigin } from '@/lib/customer-logout-origin';

function post(origin: string | null, requestUrl = 'https://shop.example.test/api/customer/logout') {
    return new NextRequest(requestUrl, {
        method: 'POST',
        headers: {
            ...(origin ? { origin } : {}),
            host: new URL(requestUrl).host,
            'x-forwarded-host': new URL(requestUrl).host,
            'x-forwarded-proto': new URL(requestUrl).protocol.slice(0, -1),
        },
    });
}

test('customer logout accepts the exact storefront origin', () => {
    assert.equal(isAllowedOrigin(post('https://shop.example.test')), true);
});

test('customer logout rejects sibling storefront and identity-platform origins', () => {
    assert.equal(isAllowedOrigin(post('https://attacker.example.test')), false);
    assert.equal(isAllowedOrigin(post('https://accounts.example.test')), false);
});

test('customer logout rejects a scheme mismatch on the same host', () => {
    assert.equal(isAllowedOrigin(post('http://shop.example.test')), false);
});

test('customer logout keeps same-host legacy requests without Origin', () => {
    assert.equal(isAllowedOrigin(post(null)), true);
});

test('customer logout denies malformed origin or incomplete forwarded authority', () => {
    assert.equal(isAllowedOrigin(post('not an origin')), false);
    const request = new NextRequest('https://shop.example.test/api/customer/logout', {
        method: 'POST',
        headers: { origin: 'https://shop.example.test', 'x-forwarded-host': ' ' },
    });
    assert.equal(isAllowedOrigin(request), false);
});

test('cross-origin logout is rejected before clearing the session', async () => {
    let cleared = false;
    const response = await customerLogoutResponse(post('https://attacker.example.test'), async () => {
        cleared = true;
    });

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'CSRF_REJECTED' });
    assert.equal(cleared, false);
});

test('same-origin logout clears the legacy session and returns no-store', async () => {
    let clearCount = 0;
    const response = await customerLogoutResponse(post('https://shop.example.test'), async () => {
        clearCount += 1;
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { success: true });
    assert.equal(clearCount, 1);
});
