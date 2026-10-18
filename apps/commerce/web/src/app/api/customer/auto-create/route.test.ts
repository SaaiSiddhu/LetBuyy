import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { handleAutoCreateCustomer } from './handler';

test('post-checkout customer proxy forwards only the order and scope to the signed server client', async () => {
    let forwarded: unknown;
    const request = new NextRequest('http://localhost/api/customer/auto-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            orderId: '  22222222-2222-4222-8222-222222222222  ',
            storeId: '  11111111-1111-4111-8111-111111111111  ',
            email: 'attacker@example.test',
            fullName: 'Attacker',
            phone: '0000000000',
        }),
    });

    const response = await handleAutoCreateCustomer(request, async (input) => {
        forwarded = input;
    });

    assert.equal(response.status, 200);
    assert.deepEqual(forwarded, {
        order_id: '22222222-2222-4222-8222-222222222222',
        store_id: '11111111-1111-4111-8111-111111111111',
    });
});

test('post-checkout customer proxy rejects missing tenant and order scope', async () => {
    const request = new NextRequest('http://localhost/api/customer/auto-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: '22222222-2222-4222-8222-222222222222' }),
    });

    const response = await handleAutoCreateCustomer(request, async () => {
        assert.fail('invalid requests must not reach the internal API client');
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'orderId and storeId are required' });
});
