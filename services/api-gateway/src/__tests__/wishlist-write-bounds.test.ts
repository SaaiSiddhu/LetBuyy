// F-WISHLIST-1 — a buyer must not be able to write an unbounded number of unbounded strings.
//
// `POST /customer/wishlist/sync` takes its body as `await c.req.json() as CustomerWishlistSyncBody`
// — a cast, not a parse — and upserts ONE ROW PER ID into `customer_wishlists`. That table declares
// `product_id text NOT NULL` with no foreign key to `products` (000_baseline.sql:8914), so whatever
// arrives is what gets stored. Before this phase the only checks were `Array.isArray(product_ids)`
// and `typeof id === 'string' && id.length > 0`: one authenticated request could create as many
// rows as it listed, each holding a string of any length.
//
// TENANCY IS NOT THE DEFECT and these tests do not claim it is. `verifyStoreCustomer` gates every
// path and the table is registered with `tenantColumn: store_id`. What was missing is a size bound.
//
// WHAT THE ASSERTIONS ACTUALLY CHECK
// The environment carries no Supabase configuration, so `verifyStoreCustomer` cannot confirm
// ownership and the route answers 403. That is the useful contrast: **400 means the BOUND refused
// the body; 403 means the body cleared the bound and was then refused by the ownership gate.** A
// status-only test would be weak — a 400 returned after a write would pass it — so every "accepted"
// case below asserts 403 specifically, which can only happen downstream of the bound.
//
// The per-id length rule is exercised directly against the exported predicate rather than through a
// route, because the filter that applies it sits AFTER the ownership gate and no database is
// reachable here. Saying so is better than writing a route test that would pass for the wrong reason.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import {
    isBoundedProductId,
    registerStorefrontCustomerEngagementRoutes,
    WISHLIST_PRODUCT_ID_MAX_LENGTH,
    WISHLIST_SYNC_MAX_IDS,
} from '../routes/storefront/customer-engagement-routes';

const STORE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const CUSTOMER = 'bbbbbbbb-0000-4000-8000-00000000000b';
const PRODUCT = 'cccccccc-0000-4000-8000-00000000000c';

function app() {
    const root = new Hono();
    root.use('*', async (c, next) => {
        (c as unknown as { env: Record<string, unknown> }).env = {};
        await next();
    });
    // Every bound under test fires before any dependency is used, so stubbing them keeps a pass
    // from depending on them.
    registerStorefrontCustomerEngagementRoutes(root as never, {
        loadPublishedStore: async () => null,
        hydrateStorefrontOrderItems: async () => [],
    } as never);
    return root;
}

function post(path: string, body: unknown, method = 'POST') {
    return app().request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const sync = (productIds: unknown[]) =>
    post('/customer/wishlist/sync', { customer_id: CUSTOMER, store_id: STORE, product_ids: productIds });

test('an oversized product_ids array is refused', async () => {
    const response = await sync(Array.from({ length: 201 }, (_, i) => `${PRODUCT}-${i}`));
    assert.equal(response.status, 400);
    const payload = await response.json() as { error: { code: string; message: string } };
    assert.equal(payload.error.code, 'VALIDATION');
    assert.match(payload.error.message, /at most 200 entries/);
});

test('an array at the limit is ACCEPTED — the bound is 200, not "small"', async () => {
    // 403 = cleared the bound, then refused by the ownership gate because no database is reachable.
    // A 400 here would mean the cap is rejecting what it should allow.
    const response = await sync(Array.from({ length: WISHLIST_SYNC_MAX_IDS }, (_, i) => `${PRODUCT}-${i}`));
    assert.equal(response.status, 403, 'a legal payload must pass the bound and reach the ownership gate');
});

test('the real caller\'s payload size is nowhere near the bound', async () => {
    // customer-auth-context.tsx posts a browser localStorage wishlist. A realistic one is tens of
    // items; this pins that the bound cannot break it.
    assert.equal((await sync([PRODUCT])).status, 403);
    assert.equal((await sync(Array.from({ length: 40 }, (_, i) => `${PRODUCT}-${i}`))).status, 403);
});

test('the id length predicate accepts what is legal and rejects what is not', () => {
    assert.equal(WISHLIST_PRODUCT_ID_MAX_LENGTH, 64);
    assert.equal(isBoundedProductId(PRODUCT), true, 'a real uuid product id is 36 characters');
    assert.equal(isBoundedProductId('z'.repeat(WISHLIST_PRODUCT_ID_MAX_LENGTH)), true, 'exactly at the limit is legal');

    assert.equal(isBoundedProductId('z'.repeat(WISHLIST_PRODUCT_ID_MAX_LENGTH + 1)), false, 'one over is not');
    assert.equal(isBoundedProductId('y'.repeat(4096)), false);
    assert.equal(isBoundedProductId(''), false, 'the empty string was already excluded and must stay excluded');
    for (const notAString of [null, undefined, 42, {}, [], true]) {
        assert.equal(isBoundedProductId(notAString), false, `${JSON.stringify(notAString)} is not a product id`);
    }
});

test('the single add and remove routes bound the product id too', async () => {
    for (const method of ['POST', 'DELETE']) {
        const tooLong = await post('/customer/wishlist', { customer_id: CUSTOMER, store_id: STORE, product_id: 'x'.repeat(65) }, method);
        assert.equal(tooLong.status, 400, `${method} must refuse an over-long product_id`);
        assert.match(
            (await tooLong.json() as { error: { message: string } }).error.message,
            /at most 64 characters/,
        );

        const legal = await post('/customer/wishlist', { customer_id: CUSTOMER, store_id: STORE, product_id: PRODUCT }, method);
        assert.equal(legal.status, 403, `${method} must let a legal product_id reach the ownership gate`);
    }
});

test('a missing field is still refused, so the bounds did not replace the presence checks', async () => {
    assert.equal((await post('/customer/wishlist', { store_id: STORE, product_id: PRODUCT })).status, 400);
    assert.equal((await post('/customer/wishlist', { customer_id: CUSTOMER, product_id: PRODUCT })).status, 400);
    assert.equal((await post('/customer/wishlist/sync', { customer_id: CUSTOMER, store_id: STORE })).status, 400);
});
