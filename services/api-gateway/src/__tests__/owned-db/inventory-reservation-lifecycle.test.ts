import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before } from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

// T12 (CAP-C43): every other RPC test in this repo is structural (asserts a
// migration/route file's SOURCE contains the right pattern) -- none exercise
// live database behaviour. That is deliberately insufficient here: the
// defect this phase closes (a committed reservation behind an abandoned
// online payment has no automatic release path) can ONLY be proven by
// actually reserving, committing, sweeping and observing inventory_levels
// change, against a real Postgres with the real migrations applied.
//
// The three source-level checks that used to sit in this file stay in the fast unit lane, in
// ../inventory-reservation-lifecycle.test.ts (they need no database).
//
// Money-table discipline: these tests NEVER `DELETE FROM` orders/order_items/
// inventory_reservations/payment_transactions. They run only in the owned
// database lane (scripts/governance/run-executable-suites.mjs): every
// statement goes to a database the runner cloned for this suite alone and
// discards with it, so no fixture is left anywhere and there is no skip path.

const owned = requireOwnedDatabase();
const { psql } = owned;

// A store and its default warehouse, built inside this suite's own database.
const tenant = newSyntheticTenant('inv-life');
const STORE_ID = tenant.siteId;
const LOCATION_ID = tenant.locationId;

before(() => {
    seedSyntheticTenant(psql, tenant, { gst: true });
});

test('a committed razorpay reservation past its grace period is released automatically, with no explicit cancel call, while a COD reservation on the same product is not touched', () => {
    const suffix = Date.now().toString(36);
    const productId = randomUUID();
    psql(`
        INSERT INTO products (id, store_id, name, price, sku, is_active, created_at, updated_at)
        VALUES ('${productId}', '${STORE_ID}', 'T12 Autotest Lifecycle ${suffix}', 149.00, 'T12-AUTOTEST-${suffix}', true, now(), now());
    `);

    psql(`
        INSERT INTO inventory_levels (id, store_id, product_id, variant_id, location_id, available, reserved, committed_quantity, available_quantity, reserved_quantity, on_hand_quantity, created_at, updated_at)
        VALUES (gen_random_uuid(), '${STORE_ID}', '${productId}', NULL, '${LOCATION_ID}', 5, 0, 0, 5, 0, 5, now(), now());
    `);

    const before = psql(`SELECT available, committed_quantity FROM inventory_levels WHERE product_id = '${productId}';`);
    assert.equal(before, '5|0');

    // A razorpay order: create_checkout_order commits its reservation synchronously, before any payment.
    const razorpayOrderId = psql(`
        SELECT create_checkout_order(
            '${STORE_ID}'::uuid, 'Autotest', 't12-autotest-razorpay-${suffix}@example.invalid', '9000000000',
            '{"line1":"Test","city":"Test","state":"KA"}'::jsonb,
            '[{"product_id":"${productId}","quantity":1}]'::jsonb,
            'razorpay', NULL, NULL, NULL, 'standard',
            't12-autotest-razorpay-idem-${suffix}', NULL, 't12-autotest-razorpay-req-${suffix}'
        ) ->> 'id';
    `);

    // A COD order: legitimately committed-forever by design -- must survive the sweep untouched.
    const codOrderId = psql(`
        SELECT create_checkout_order(
            '${STORE_ID}'::uuid, 'Autotest', 't12-autotest-cod-${suffix}@example.invalid', '9000000001',
            '{"line1":"Test","city":"Test","state":"KA"}'::jsonb,
            '[{"product_id":"${productId}","quantity":1}]'::jsonb,
            'cod', NULL, NULL, NULL, 'standard',
            't12-autotest-cod-idem-${suffix}', NULL, 't12-autotest-cod-req-${suffix}'
        ) ->> 'id';
    `);

    const afterCreate = psql(`SELECT available, committed_quantity FROM inventory_levels WHERE product_id = '${productId}';`);
    assert.equal(afterCreate, '3|2', 'both orders should have committed their reservation at creation');

    const razorpayStatusBefore = psql(`SELECT status FROM inventory_reservations WHERE order_id = '${razorpayOrderId}';`);
    assert.equal(razorpayStatusBefore, 'committed');

    // Backdate committed_at rather than waiting out a real grace window (same technique this phase's
    // own manual verification, and T11 before it, used against expire_inventory_reservations). The
    // migration clamps p_grace_seconds to a 60s floor as a production safety rail against an
    // accidental near-instant release, so grace_seconds=0 alone would not fire on a reservation
    // committed milliseconds ago -- this proves the real mechanism, not a weakened one.
    //
    // BOTH reservations are backdated, the COD one included: a COD reservation that is still inside the grace window is
    // spared by that window whatever the sweep's payment-method filter says, so leaving it fresh would not test the COD
    // exclusion at all (mutation check, 2026-09-29: with `o.payment_method <> 'cod'` removed from migration 211, this test
    // stayed green until the COD reservation was aged too). Aged past the window, what keeps the COD unit committed is the
    // exclusion alone.
    psql(`UPDATE inventory_reservations SET committed_at = now() - interval '1 hour' WHERE order_id IN ('${razorpayOrderId}', '${codOrderId}');`);
    const released = psql(`SELECT expire_unpaid_committed_reservations(100, 60, 't12-autotest-sweep-${suffix}');`);
    assert.ok(Number(released) >= 1, `expected at least the razorpay order to be released, got ${released}`);

    // This assertion and its comment described a real gap at the time this test was written (migrations
    // 211/212) -- committed_quantity was incremented by commit_inventory_reservation and decremented by no
    // release path, so it only ever grew. Migration 246 (CAP-C47, "a released commitment stops counting as
    // committed") fixed exactly this in release_order_inventory, which expire_unpaid_committed_reservations
    // calls via release_order_inventory_with_ledger. The expectation is the current, intentional behavior: the
    // released unit's commitment is subtracted too, not just restored to available.
    const afterSweep = psql(`SELECT available, committed_quantity FROM inventory_levels WHERE product_id = '${productId}';`);
    assert.equal(afterSweep, '4|1', 'the razorpay unit must be restored to available, AND its commitment subtracted (migration 246, CAP-C47) -- the COD unit\'s commitment (1) is untouched');

    const razorpayStatusAfter = psql(`SELECT status, release_reason FROM inventory_reservations WHERE order_id = '${razorpayOrderId}';`);
    assert.equal(razorpayStatusAfter, 'released|ttl_expired_unpaid');

    const codStatusAfter = psql(`SELECT status FROM inventory_reservations WHERE order_id = '${codOrderId}';`);
    assert.equal(codStatusAfter, 'committed', 'COD reservation must be untouched by the unpaid-online-order sweep, even though it is older than the grace period');

    // Replaying a later sweep must not release the same order twice, even when
    // the worker uses a different request id. Assert the inventory projection
    // and the idempotent sale_released event, not only the reservation status.
    const releasedAgain = psql(`SELECT expire_unpaid_committed_reservations(100, 60, 't12-autotest-sweep-replay-${suffix}');`);
    assert.equal(releasedAgain, '0', 'a later sweep must find no committed online reservation to release');
    assert.equal(psql(`SELECT available || '|' || committed_quantity FROM inventory_levels WHERE product_id = '${productId}';`), '4|1');
    assert.equal(psql(`SELECT count(*) FROM inventory_events WHERE order_id = '${razorpayOrderId}' AND event_type = 'sale_released';`), '1', 'the second sweep must not append a duplicate release event');
    assert.equal(psql(`SELECT status FROM inventory_reservations WHERE order_id = '${razorpayOrderId}';`), 'released');
});
