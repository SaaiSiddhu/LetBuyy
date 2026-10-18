import assert from 'node:assert/strict';
import test from 'node:test';
import { customerProfileResponse } from './response';

const SESSION = {
    sub: 'customer-1',
    storeId: 'store-1',
    email: 'buyer@example.test',
    name: 'Buyer',
    iat: 1_800_000_000,
    exp: 1_800_000_600,
};

test('customer profile read is no-store and returns only the current store-customer fields', async () => {
    let path = '';
    let cache: RequestCache | undefined;
    const response = await customerProfileResponse(
        async () => SESSION,
        async (requestPath, init) => {
            path = requestPath;
            cache = init?.cache;
            return Response.json({
                success: true,
                data: { customer: {
                    id: 'customer-1',
                    email: 'buyer@example.test',
                    full_name: 'Buyer Name',
                    phone: '+91 9876543210',
                    accepts_marketing: true,
                    password_hash: 'never-return-this',
                } },
            });
        },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(path, '/storefront/customer/profile');
    assert.equal(cache, 'no-store');
    assert.deepEqual(await response.json(), {
        customer: {
            email: 'buyer@example.test',
            full_name: 'Buyer Name',
            phone: '+91 9876543210',
            accepts_marketing: true,
        },
    });
});

test('customer profile read refuses missing legacy sessions before calling Gateway', async () => {
    let called = false;
    const response = await customerProfileResponse(async () => null, async () => {
        called = true;
        return Response.json({});
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(called, false);
});

test('customer profile read turns a stale Gateway session into an unavailable response', async () => {
    const response = await customerProfileResponse(async () => SESSION, async () =>
        Response.json({ success: false }, { status: 404 }));

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'Customer profile is unavailable' });
});
