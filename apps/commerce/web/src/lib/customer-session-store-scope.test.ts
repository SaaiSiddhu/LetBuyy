import assert from 'node:assert/strict';
import test from 'node:test';
import { customerSessionMatchesRequestStore } from './customer-session-store-scope';

const storeA = '11111111-1111-4111-8111-111111111111';
const storeB = '22222222-2222-4222-8222-222222222222';

function headers(values: Record<string, string>) {
    return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

test('customer session matches the store resolved from the forwarded storefront host', async () => {
    let resolvedHost = '';
    const matches = await customerSessionMatchesRequestStore({
        headers: headers({ host: 'internal:9000', 'x-forwarded-host': 'shop.example.test, proxy.internal' }),
        storeId: storeA,
        resolveStoreIdForHost: async host => { resolvedHost = host; return storeA; },
    });
    assert.equal(matches, true);
    assert.equal(resolvedHost, 'shop.example.test');
});

test('customer session refuses another storefront, unresolved hosts and resolver failure', async () => {
    assert.equal(await customerSessionMatchesRequestStore({
        headers: headers({ host: 'shop-a.example.test' }),
        storeId: storeB,
        resolveStoreIdForHost: async () => storeA,
    }), false);

    assert.equal(await customerSessionMatchesRequestStore({
        headers: headers({ host: 'unknown.example.test' }),
        storeId: storeA,
        resolveStoreIdForHost: async () => null,
    }), false);

    assert.equal(await customerSessionMatchesRequestStore({
        headers: headers({ host: 'shop-a.example.test' }),
        storeId: storeA,
        resolveStoreIdForHost: async () => { throw new Error('gateway unavailable'); },
    }), false);
});
