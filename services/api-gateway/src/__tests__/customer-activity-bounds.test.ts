// F-ACTIVITY-1 — the customer activity log must not accept an unbounded string or unbounded JSON.
//
// `POST /customer/activity` takes its body as `await c.req.json() as CustomerActivityBody` — a cast,
// not a parse — and inserts `activity_type` and `metadata` straight into `customer_activity_log`.
// That table declares `activity_type text NOT NULL` with no CHECK and no length, and
// `metadata jsonb DEFAULT '{}'` with no size (000_baseline.sql:8855), so whatever arrives is stored.
//
// WHAT IS NOT THE DEFECT, measured rather than assumed:
//   - RLS. The baseline's `USING (true)` policy was corrected by migration 163, which scopes it to
//     service_role, gives `authenticated` a `store_id = current_site_id()` policy, and revokes the
//     grants from PUBLIC/anon/authenticated.
//   - Anonymity. storefront.ts:74,80 mounts requireCustomerSession AND csrfProtection on this path.
//     That was checked at the mount; reading the handler alone would have missed it.
// The gap is size, and only size.
//
// WHAT THE ASSERTIONS CHECK
// The environment carries no Supabase configuration, so `verifyStoreCustomer` cannot confirm
// ownership and the route answers 403. So: **400 means a bound refused the body; 403 means the body
// cleared every bound and was then refused by the ownership gate.** A status-only test would be weak
// — a 400 returned after an insert would pass one — so each "accepted" case asserts 403 specifically.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import {
    ACTIVITY_METADATA_MAX_BYTES,
    ACTIVITY_TYPE_MAX_LENGTH,
    isBoundedActivityMetadata,
    isBoundedActivityType,
    registerStorefrontCustomerEngagementRoutes,
} from '../routes/storefront/customer-engagement-routes';

const STORE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const CUSTOMER = 'bbbbbbbb-0000-4000-8000-00000000000b';

function activity(body: Record<string, unknown>) {
    const root = new Hono();
    root.use('*', async (c, next) => {
        (c as unknown as { env: Record<string, unknown> }).env = {};
        await next();
    });
    registerStorefrontCustomerEngagementRoutes(root as never, {
        loadPublishedStore: async () => null,
        hydrateStorefrontOrderItems: async () => [],
    } as never);
    return root.request('/customer/activity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customer_id: CUSTOMER, store_id: STORE, ...body }),
    });
}

test('an over-long activity_type is refused', async () => {
    const response = await activity({ activity_type: 'x'.repeat(ACTIVITY_TYPE_MAX_LENGTH + 1) });
    assert.equal(response.status, 400);
    const payload = await response.json() as { error: { code: string; message: string } };
    assert.equal(payload.error.code, 'VALIDATION');
    assert.match(payload.error.message, /at most 64 characters/);
});

test('an oversized metadata document is refused', async () => {
    // One key whose value alone exceeds the cap.
    const response = await activity({ activity_type: 'viewed_product', metadata: { blob: 'y'.repeat(ACTIVITY_METADATA_MAX_BYTES) } });
    assert.equal(response.status, 400);
    assert.match(
        (await response.json() as { error: { message: string } }).error.message,
        /at most 4096 bytes/,
    );
});

test('a realistic activity payload is ACCEPTED and reaches the ownership gate', async () => {
    // 403 = cleared every bound, then refused by ownership because no database is reachable.
    const response = await activity({
        activity_type: 'viewed_product',
        metadata: { product_id: 'cccccccc-0000-4000-8000-00000000000c', source: 'search' },
    });
    assert.equal(response.status, 403, 'a legal payload must pass the bounds, not be rejected by them');
});

test('omitted metadata is still legal — the bound must not make an optional field required', async () => {
    assert.equal((await activity({ activity_type: 'session_start' })).status, 403);
});

test('a missing activity_type is still refused, so the bound did not replace the presence check', async () => {
    assert.equal((await activity({ metadata: { a: 1 } })).status, 400);
});

test('the bounds predicates accept what is legal and reject what is not', () => {
    assert.equal(ACTIVITY_TYPE_MAX_LENGTH, 64);
    assert.equal(ACTIVITY_METADATA_MAX_BYTES, 4096);

    assert.equal(isBoundedActivityType('viewed_product'), true);
    assert.equal(isBoundedActivityType('z'.repeat(ACTIVITY_TYPE_MAX_LENGTH)), true, 'exactly at the limit is legal');
    assert.equal(isBoundedActivityType('z'.repeat(ACTIVITY_TYPE_MAX_LENGTH + 1)), false);
    assert.equal(isBoundedActivityType(''), false);
    for (const notAString of [null, undefined, 7, {}, []]) {
        assert.equal(isBoundedActivityType(notAString), false);
    }

    assert.equal(isBoundedActivityMetadata(undefined), true, 'metadata is optional');
    assert.equal(isBoundedActivityMetadata(null), true);
    assert.equal(isBoundedActivityMetadata({ a: 1 }), true);
    assert.equal(isBoundedActivityMetadata([1, 2, 3]), false, 'the column holds an object, not an array');
    assert.equal(isBoundedActivityMetadata('a string'), false);
    assert.equal(isBoundedActivityMetadata({ blob: 'y'.repeat(ACTIVITY_METADATA_MAX_BYTES) }), false);

    // Multi-byte characters count as BYTES, not code units — a 4,096-character string of 3-byte
    // characters is 12KB on the wire, and a length-based check would have waved it through.
    assert.equal(isBoundedActivityMetadata({ blob: '한'.repeat(2000) }), false, 'size is measured in bytes');

    // Cyclic input cannot be serialised; refusing it is the point, not throwing.
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.equal(isBoundedActivityMetadata(cyclic), false);
});
