import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// T12 (CAP-C43): every other RPC test in this repo is structural (asserts a
// migration/route file's SOURCE contains the right pattern) -- none exercise
// live database behaviour. That is deliberately insufficient here: the
// defect this phase closes (a committed reservation behind an abandoned
// online payment has no automatic release path) can ONLY be proven by
// actually reserving, committing, sweeping and observing inventory_levels
// change, against the real local Supabase Postgres this repo's dev
// environment already runs (the same one every manual verification this
// session used). These tests shell out to `docker exec <local supabase db container>
// psql` rather than adding a new `pg` dependency or the heavier
// ephemeral-Postgres harness (scripts/governance/foundation-ephemeral-postgres.mjs)
// -- reusing the container already required for local development.
//
// Money-table discipline: per this session's standing rule, these tests
// NEVER `DELETE FROM` orders/order_items/inventory_reservations/payment_transactions.
// Every fixture they create is left in place, tagged with a fixed,
// recognisable SKU/email prefix (T12-AUTOTEST) -- running this suite
// repeatedly against the same local database accumulates a small number of
// disposable rows. That is an accepted, disclosed cost of genuine behavioural
// coverage, not an oversight.
//
// Guarded: skips (not fails) if the local Supabase Postgres container is not
// reachable, so this does not break in an environment without it running.

const repoRoot = process.cwd();
const migrationSource = readFileSync(
    join(repoRoot, 'database/supabase/migrations/211_expire_unpaid_committed_reservations.sql'),
    'utf8',
);
const releaseFixSource = readFileSync(
    join(repoRoot, 'database/supabase/migrations/212_fix_release_order_inventory_variant_type_mismatch.sql'),
    'utf8',
);

const CONTAINER = process.env.LETBUYY_LOCAL_SUPABASE_CONTAINER || 'supabase_db_letbuyy-newmac-20260926';
// snaz and its default location are seeded by scripts/dev/seed-snaz-fixture.mjs (idempotent --
// run it once against a fresh local database).
const STORE_ID = '9c047c9a-1ea3-4438-b1f7-4a9d1a123adb'; // snaz
const LOCATION_ID = '69db8dab-95c7-43bd-b105-3b9d2c2dbf90'; // snaz default location

function dbAvailable(): boolean {
    try {
        execFileSync('docker', ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-c', 'SELECT 1'], {
            stdio: 'ignore',
            timeout: 5000,
        });
        return true;
    } catch {
        return false;
    }
}

function psql(sql: string): string {
    return execFileSync(
        'docker',
        ['exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-F', '|', '-c', sql],
        { encoding: 'utf8', timeout: 15000 },
    ).trim();
}

test('migration 211 releases via the existing ledger-aware RPC, excludes COD, and locks safely', () => {
    assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.expire_unpaid_committed_reservations/);
    assert.match(migrationSource, /o\.payment_method <> 'cod'/);
    assert.match(migrationSource, /o\.payment_status IS DISTINCT FROM 'paid'/);
    assert.match(migrationSource, /o\.inventory_released_at IS NULL/);
    assert.match(migrationSource, /FOR UPDATE OF o SKIP LOCKED/);
    assert.match(migrationSource, /release_order_inventory_with_ledger/);
});

test('migration 212 fixes the release_order_inventory variant_id uuid/text mismatch', () => {
    assert.match(releaseFixSource, /NULLIF\(variant_id, ''\)::uuid AS variant_id/);
    assert.match(releaseFixSource, /NULLIF\(oi\.variant_id, ''\)::uuid/);
});

test('webhook-service releases inventory on an explicit payment.failed signal', () => {
    const indexSource = readFileSync(
        join(repoRoot, 'services/webhook-service/src/index.ts'),
        'utf8',
    );
    const markOrderFailed = indexSource.slice(
        indexSource.indexOf('async function markOrderFailed'),
        indexSource.indexOf('async function markOrderRefunded'),
    );
    assert.match(markOrderFailed, /releaseInventory: Boolean\(order\.inventory_reserved_at && !order\.inventory_released_at\)/);
    assert.doesNotMatch(markOrderFailed, /releaseInventory: false/);
});

test('a committed razorpay reservation past its grace period is released automatically, with no explicit cancel call, while a COD reservation on the same product is not touched', { skip: !dbAvailable() && 'local Supabase Postgres container not reachable' }, () => {
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
    psql(`UPDATE inventory_reservations SET committed_at = now() - interval '1 hour' WHERE order_id = '${razorpayOrderId}';`);
    const released = psql(`SELECT expire_unpaid_committed_reservations(100, 60, 't12-autotest-sweep-${suffix}');`);
    assert.ok(Number(released) >= 1, `expected at least the razorpay order to be released, got ${released}`);

    // Snaz-fixture follow-up (2026-09-28): this assertion and its comment described a real gap at
    // the time this test was written (migrations 211/212) -- committed_quantity was incremented by
    // commit_inventory_reservation and decremented by no release path, so it only ever grew. Migration
    // 246 (CAP-C47, "a released commitment stops counting as committed") fixed exactly this in
    // release_order_inventory, which expire_unpaid_committed_reservations calls via
    // release_order_inventory_with_ledger. This test never ran against that fix until now (it was
    // silently skipping on a stale docker container name, not exercising real Postgres at all) --
    // updated to the correct, current, intentional behavior: the released unit's commitment is
    // subtracted too, not just restored to available.
    const afterSweep = psql(`SELECT available, committed_quantity FROM inventory_levels WHERE product_id = '${productId}';`);
    assert.equal(afterSweep, '4|1', 'the razorpay unit must be restored to available, AND its commitment subtracted (migration 246, CAP-C47) -- the COD unit\'s commitment (1) is untouched');

    const razorpayStatusAfter = psql(`SELECT status, release_reason FROM inventory_reservations WHERE order_id = '${razorpayOrderId}';`);
    assert.equal(razorpayStatusAfter, 'released|ttl_expired_unpaid');

    const codStatusAfter = psql(`SELECT status FROM inventory_reservations WHERE order_id = '${codOrderId}';`);
    assert.equal(codStatusAfter, 'committed', 'COD reservation must be untouched by the unpaid-online-order sweep');
});
