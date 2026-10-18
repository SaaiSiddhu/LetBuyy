import assert from 'node:assert/strict';
import test from 'node:test';
import { getStorefrontBuyerWishlistDrop } from './buyer-order-drop';

const siteId = '11111111-1111-4111-8111-111111111111';
const headers = { 'X-LetBuyy-Storefront-Session': 'signed-site-bound-token' };

test('Liquid wishlist reads use the resolved site and signed buyer session', async () => {
    const requestedPaths: string[] = [];
    let forwardedHeaders: Record<string, string> | undefined;
    const result = await getStorefrontBuyerWishlistDrop(siteId, {
        resolveSession: async (expectedSite) => {
            assert.equal(expectedSite, siteId);
            return { siteId, headers };
        },
        apiFetch: async (path, init) => {
            requestedPaths.push(path);
            forwardedHeaders = init?.headers as Record<string, string>;
            return path.includes('/profile?')
                ? Response.json({ data: { buyer: { id: 'buyer-1' } } })
                : Response.json({ data: { linked: true, product_ids: ['product-1', 'product-2'] } });
        },
    });

    assert.deepEqual(requestedPaths.sort(), [`/storefront/buyer/profile?store_id=${siteId}`, `/storefront/buyer/wishlist?store_id=${siteId}`].sort());
    assert.deepEqual(forwardedHeaders, headers);
    assert.deepEqual(result, {
        authenticated: true,
        buyerId: 'buyer-1',
        linked: true,
        unavailable: false,
        storeAccountUnavailable: false,
        productIds: ['product-1', 'product-2'],
        products: [],
    });
});

test('an unlinked or unavailable store account never exposes wishlist product IDs', async () => {
    const unlinked = await getStorefrontBuyerWishlistDrop(siteId, {
        resolveSession: async () => ({ siteId, headers }),
        apiFetch: async (path) => path.includes('/profile?')
            ? Response.json({ data: { buyer: { id: 'buyer-1' } } })
            : Response.json({ data: { linked: false, reason: 'store_account_unavailable', product_ids: ['must-not-render'] } }),
    });
    assert.equal(unlinked.authenticated, true);
    assert.equal(unlinked.linked, false);
    assert.equal(unlinked.storeAccountUnavailable, true);
    assert.deepEqual(unlinked.productIds, []);

    const failed = await getStorefrontBuyerWishlistDrop(siteId, {
        resolveSession: async () => ({ siteId, headers }),
        apiFetch: async () => new Response('private upstream failure', { status: 503 }),
    });
    assert.equal(failed.authenticated, true);
    assert.equal(failed.unavailable, true);
    assert.deepEqual(failed.productIds, []);
});

test('a guest makes no buyer API request and malformed success fails closed', async () => {
    let calls = 0;
    const guest = await getStorefrontBuyerWishlistDrop(siteId, {
        resolveSession: async () => null,
        apiFetch: async () => { calls += 1; return Response.json({ data: {} }); },
    });
    assert.equal(calls, 0);
    assert.equal(guest.authenticated, false);

    const malformed = await getStorefrontBuyerWishlistDrop(siteId, {
        resolveSession: async () => ({ siteId, headers }),
        apiFetch: async (path) => path.includes('/profile?')
            ? Response.json({ data: { buyer: { id: 'buyer-1' } } })
            : Response.json({ data: { linked: true, product_ids: ['ok', 42] } }),
    });
    assert.equal(malformed.authenticated, true);
    assert.equal(malformed.unavailable, true);
    assert.deepEqual(malformed.productIds, []);
});

test('missing canonical buyer identity disables authenticated wishlist writes', async () => {
    const result = await getStorefrontBuyerWishlistDrop(siteId, {
        resolveSession: async () => ({ siteId, headers }),
        apiFetch: async (path) => path.includes('/profile?')
            ? Response.json({ data: { buyer: { email: 'buyer@example.test' } } })
            : Response.json({ data: { linked: true, product_ids: ['product-1'] } }),
    });
    assert.equal(result.authenticated, true);
    assert.equal(result.buyerId, null);
    assert.equal(result.unavailable, true);
    assert.deepEqual(result.productIds, []);
});
