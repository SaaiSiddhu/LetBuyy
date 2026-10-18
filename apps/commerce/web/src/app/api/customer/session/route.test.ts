import assert from 'node:assert/strict';
import test from 'node:test';
import { customerSessionResponse } from './response';

test('customer session response is no-store when authenticated', async () => {
    const response = await customerSessionResponse(async () => ({
        sub: 'buyer-123',
        storeId: 'store-123',
        email: 'buyer@example.test',
        name: 'Buyer',
        iat: 1_800_000_000,
        exp: 1_800_000_600,
    }));

    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
        authenticated: true,
        customer: { id: 'buyer-123', storeId: 'store-123', email: 'buyer@example.test', fullName: 'Buyer' },
    });
});

test('signed-out customer session response is no-store', async () => {
    const response = await customerSessionResponse(async () => null);

    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { authenticated: false, customer: null });
});

test('unavailable session verifier fails closed without a cacheable response', async () => {
    const response = await customerSessionResponse(async () => {
        throw new Error('synthetic verifier failure');
    });

    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { authenticated: false, customer: null });
});
