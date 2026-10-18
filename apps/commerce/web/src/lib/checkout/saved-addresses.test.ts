import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCheckoutSavedAddresses } from './saved-addresses';

function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

test('checkout loads the canonical buyer address book for a signed-in buyer', async () => {
    const calls: string[] = [];
    const result = await loadCheckoutSavedAddresses(async (input) => {
        calls.push(String(input));
        if (String(input) === '/api/buyer-auth/session') return jsonResponse({ buyer: { email: 'buyer@example.test' } });
        return jsonResponse({ addresses: [{ id: 'buyer-address', postal_code: '600001' }] });
    });

    assert.deepEqual(calls, ['/api/buyer-auth/session', '/api/buyer/addresses']);
    assert.equal(result.source, 'buyer');
    assert.equal(result.addresses[0]?.id, 'buyer-address');
});

test('checkout uses the distinct store-customer address book only when no buyer is signed in', async () => {
    const calls: string[] = [];
    const result = await loadCheckoutSavedAddresses(async (input) => {
        calls.push(String(input));
        if (String(input) === '/api/buyer-auth/session') return jsonResponse({ buyer: null });
        return jsonResponse({ addresses: [{ id: 'store-address' }] });
    });

    assert.deepEqual(calls, ['/api/buyer-auth/session', '/api/customer/addresses']);
    assert.equal(result.source, 'store_customer');
    assert.equal(result.addresses[0]?.id, 'store-address');
});

test('checkout does not downgrade to store-customer addresses when buyer verification fails', async () => {
    const calls: string[] = [];
    await assert.rejects(
        loadCheckoutSavedAddresses(async (input) => {
            calls.push(String(input));
            return jsonResponse({ error: 'unavailable' }, 503);
        }),
        /account could not be verified/,
    );
    assert.deepEqual(calls, ['/api/buyer-auth/session']);
});

test('checkout reports an address endpoint failure instead of treating it as an empty book', async () => {
    await assert.rejects(
        loadCheckoutSavedAddresses(async (input) => String(input) === '/api/buyer-auth/session'
            ? jsonResponse({ buyer: { email: 'buyer@example.test' } })
            : jsonResponse({ error: 'unavailable' }, 503)),
        /Saved addresses could not be loaded/,
    );
});
