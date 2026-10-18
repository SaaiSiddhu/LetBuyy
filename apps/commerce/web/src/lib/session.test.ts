import assert from 'node:assert/strict';
import test from 'node:test';
import { LETBUYY_CUSTOMER_SESSION_COOKIE, LETBUYY_CUSTOMER_SESSION_TTL_SECONDS } from '@letbuyy/auth-core';
import { issueStorefrontCustomerSession, verifyStorefrontCustomerSession } from './session';

const storeA = '11111111-1111-4111-8111-111111111111';
const storeB = '22222222-2222-4222-8222-222222222222';
const secret = 'commerce-shopper-session-test-secret-only';
const customer = {
    id: '33333333-3333-4333-8333-333333333333',
    storeId: storeA,
    email: 'buyer@example.test',
    fullName: 'Buyer Example',
};

function requestHeaders(host: string) {
    return { get: (name: string) => name.toLowerCase() === 'host' ? host : null };
}

test('Commerce shopper issuer cookie round-trips only on the storefront bound to its signed store', async () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const token = await issueStorefrontCustomerSession({
        customer,
        scope: {
            headers: requestHeaders('shop-a.example.test'),
            resolveStoreIdForHost: async host => host === 'shop-a.example.test' ? storeA : null,
        },
        secret,
        secure: true,
        setCookie: (name, value, options) => cookies.push({ name, value, options }),
    });

    assert.equal(cookies.length, 1);
    assert.equal(cookies[0].name, LETBUYY_CUSTOMER_SESSION_COOKIE);
    assert.equal(cookies[0].value, token);
    assert.deepEqual(cookies[0].options, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: LETBUYY_CUSTOMER_SESSION_TTL_SECONDS,
        path: '/',
    });

    const sameStore = await verifyStorefrontCustomerSession({
        token: cookies[0].value,
        scope: {
            headers: requestHeaders('shop-a.example.test'),
            resolveStoreIdForHost: async host => host === 'shop-a.example.test' ? storeA : null,
        },
        secret,
    });
    assert.equal(sameStore?.sub, customer.id);
    assert.equal(sameStore?.storeId, storeA);
    assert.equal(sameStore?.email, customer.email);

    const siblingStore = await verifyStorefrontCustomerSession({
        token,
        scope: {
            headers: requestHeaders('shop-b.example.test'),
            resolveStoreIdForHost: async host => host === 'shop-b.example.test' ? storeB : null,
        },
        secret,
    });
    assert.equal(siblingStore, null, 'a signed shopper cookie must not cross storefront hosts');
});

test('Commerce shopper issuer refuses unresolved or mismatched storefronts before setting a cookie', async () => {
    for (const resolveStoreIdForHost of [
        async () => storeB,
        async () => null,
        async () => { throw new Error('synthetic storefront resolver failure'); },
    ]) {
        let cookieWrites = 0;
        await assert.rejects(
            issueStorefrontCustomerSession({
                customer,
                scope: { headers: requestHeaders('shop-a.example.test'), resolveStoreIdForHost },
                secret,
                secure: false,
                setCookie: () => { cookieWrites++; },
            }),
            /does not match this storefront/,
        );
        assert.equal(cookieWrites, 0);
    }
});

test('Commerce shopper verifier fails closed without its secret', async () => {
    const token = await issueStorefrontCustomerSession({
        customer,
        scope: {
            headers: requestHeaders('shop-a.example.test'),
            resolveStoreIdForHost: async () => storeA,
        },
        secret,
        secure: false,
        setCookie: () => {},
    });
    const result = await verifyStorefrontCustomerSession({
        token,
        scope: {
            headers: requestHeaders('shop-a.example.test'),
            resolveStoreIdForHost: async () => storeA,
        },
        secret: null,
    });
    assert.equal(result, null);
});
