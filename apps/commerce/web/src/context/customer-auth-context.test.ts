import assert from 'node:assert/strict';
import test from 'node:test';
import { requestStoreCustomerLogout } from './customer-auth-context';

test('store-customer logout sends a same-origin POST and accepts a successful response', async () => {
    let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
    await requestStoreCustomerLogout(async (input, init) => {
        request = { input, init };
        return new Response(null, { status: 200 });
    });
    assert.equal(request?.input, '/api/customer/logout');
    assert.equal(request?.init?.method, 'POST');
});

test('store-customer logout does not treat a failed server response as successful', async () => {
    await assert.rejects(
        requestStoreCustomerLogout(async () => new Response(null, { status: 503 })),
        /Store customer sign-out failed/,
    );
});
