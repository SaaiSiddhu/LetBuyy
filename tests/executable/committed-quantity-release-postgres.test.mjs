// F-COMMITTED-1 (CAP-C47) — a released commitment must stop counting as committed.
//
// commit_inventory_reservation adds the reservation's quantity to inventory_levels.committed_quantity.
// Nothing anywhere subtracted it, so the column only grew and the figure apps/merchant_app shows the
// merchant as "committed" drifted upward without bound. Not an oversell risk — reserve_inventory gates
// on `available`, which every release path already restored — but a reporting column that becomes
// progressively false, and nothing failed while it did.
//
// The precision under test is the one a careless fix gets wrong: release_order_inventory iterates
// ORDER_ITEMS, not reservations, so it does not know whether a commit ever happened. Subtracting item
// quantities would corrupt the column for an order cancelled while merely reserved. Test 3 exists to
// catch exactly that.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_committed_release';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/246_release_decrements_committed_quantity.sql';
const ROLLBACK = 'database/supabase/rollback/246_release_decrements_committed_quantity.rollback.sql';
const BOOTSTRAP_SQL = SUPABASE_FAITHFUL_BOOTSTRAP_SQL;

const SITE = '11111111-1111-4111-8111-1111111111c1';
const LOCATION = '22222222-2222-4222-8222-2222222222c2';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ).trim();
}

const sqlString = (v) => `'${String(v).replaceAll("'", "''")}'`;

// The inventory RPCs are fenced on the transaction-local tenant GUC (require_inventory_site_guc), so
// every call has to carry it in the SAME transaction. That fence is correct and this suite works with
// it rather than around it — the fixture INSERTs run as the owner, but nothing that mutates inventory
// does so without a tenant context.
const withTenant = (statements) => psql(`
    BEGIN;
    SELECT set_config('app.site_id', ${sqlString(SITE)}, true);
    ${statements}
    COMMIT;
`);
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath) => psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));

function listMigrations() {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

function bootstrapDatabase() {
    psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(BOOTSTRAP_SQL);
    for (const name of listMigrations()) {
        psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8')));
    }
    psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain)
    VALUES (${sqlString(SITE)}::uuid, 'Committed Store', 'Committed Store', 'store', 'committed-store');
    INSERT INTO public.inventory_locations (id, store_id, name, status, is_default)
    VALUES (${sqlString(LOCATION)}::uuid, ${sqlString(SITE)}::uuid, 'Main', 'active', true);
    `);
}

let seq = 0;
// One product + level + order, reserved for `quantity`. `commit` decides whether the reservation is
// actually committed (the real RPC) or left merely reserved.
function seedOrder({ quantity = 4, startingCommitted = 0, available = 50, commit = true }) {
    seq += 1;
    const s = String(seq).padStart(2, '0');
    const product = `33333333-3333-4333-8333-0000000000${s}`;
    const order = `44444444-4444-4444-8444-0000000000${s}`;
    const reservation = `55555555-5555-4555-8555-0000000000${s}`;
    psql(`
    INSERT INTO public.products (id, store_id, site_id, name, price, is_active, status)
    VALUES (${sqlString(product)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(SITE)}::uuid, 'Item ${s}', 100, true, 'active');
    INSERT INTO public.inventory_levels (store_id, product_id, location_id, available, reserved, committed_quantity)
    VALUES (${sqlString(SITE)}::uuid, ${sqlString(product)}::uuid, ${sqlString(LOCATION)}::uuid, ${available}, 0, ${startingCommitted});
    INSERT INTO public.orders (id, store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, status)
    VALUES (${sqlString(order)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(SITE)}::uuid, 'CQ-${s}', 'buyer@example.invalid', '{}'::jsonb, '[]'::jsonb, 100, 100, 'pending');
    INSERT INTO public.order_items (order_id, site_id, product_id, name, quantity, price, total)
    VALUES (${sqlString(order)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(product)}::uuid, 'Item ${s}', ${quantity}, 100, ${100 * quantity});
    INSERT INTO public.inventory_reservations (id, store_id, product_id, variant_id, location_id, order_id, quantity, status)
    VALUES (${sqlString(reservation)}::uuid, ${sqlString(SITE)}::uuid, ${sqlString(product)}::uuid, NULL, ${sqlString(LOCATION)}::uuid, ${sqlString(order)}::uuid, ${quantity}, 'active');
    `);
    if (commit) {
        withTenant(`SELECT public.commit_inventory_reservation(${sqlString(SITE)}::uuid, ${sqlString(reservation)}::uuid, 'commit-${s}');`);
    }
    return { product, order, reservation, quantity };
}

const committedFor = (product) => Number(psql(
    `SELECT committed_quantity FROM public.inventory_levels WHERE product_id = ${sqlString(product)}::uuid;`));
const release = (order) => withTenant(
    `SELECT public.release_order_inventory(${sqlString(order)}::uuid, NULL, NULL, 'order_cancelled');`);

before(() => { if (!skip) bootstrapDatabase(); });
after(() => {
    if (skip) return;
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres'); } catch { /* leave for inspection */ }
});

test('committing raises committed_quantity — the precondition this phase inverts', { skip }, () => {
    const { product, quantity } = seedOrder({ quantity: 4 });
    assert.equal(committedFor(product), quantity, 'commit_inventory_reservation must add the quantity');
});

test('releasing a COMMITTED order returns committed_quantity to where it started', { skip }, () => {
    const { product, order, quantity } = seedOrder({ quantity: 6, startingCommitted: 0 });
    assert.equal(committedFor(product), quantity);
    release(order);
    assert.equal(committedFor(product), 0, 'a released commitment must stop counting as committed');
});

test('releasing a MERELY RESERVED order does NOT decrement — the careless-fix guard', { skip }, () => {
    // This order never committed, so it never incremented the column. A fix driven by order_items
    // rather than by status='committed' reservations would subtract here and corrupt the column in
    // the opposite direction, while looking like it worked.
    const { product, order } = seedOrder({ quantity: 5, startingCommitted: 9, commit: false });
    assert.equal(committedFor(product), 9, 'precondition: nothing was committed for this order');
    release(order);
    assert.equal(committedFor(product), 9, 'an uncommitted release must leave committed_quantity alone');
});

test('a second release does not decrement twice', { skip }, () => {
    const { product, order, quantity } = seedOrder({ quantity: 3, startingCommitted: 10 });
    assert.equal(committedFor(product), 10 + quantity);
    release(order);
    assert.equal(committedFor(product), 10);
    release(order);
    assert.equal(committedFor(product), 10, 'release is idempotent — the second call must change nothing');
});

test('the decrement is floored at zero for rows committed before the column was maintained', { skip }, () => {
    // A level whose committed_quantity is lower than the reservation it is about to release — exactly
    // the shape of a row that predates this accounting. It must clamp, not go negative.
    const { product, order, quantity } = seedOrder({ quantity: 8, startingCommitted: 0 });
    psql(`UPDATE public.inventory_levels SET committed_quantity = 2 WHERE product_id = ${sqlString(product)}::uuid;`);
    assert.ok(2 < quantity, 'the fixture must under-count relative to the reservation');
    release(order);
    assert.equal(committedFor(product), 0, 'must clamp at zero rather than going negative');
});

test('CONTROL: with 246 rolled back the column does not come down at all', { skip }, () => {
    // Without this, "the column returns to zero" could be true for some unrelated reason. The defect
    // must be shown present before it is shown absent.
    applySqlFile(ROLLBACK);
    const { product, order, quantity } = seedOrder({ quantity: 7, startingCommitted: 0 });
    assert.equal(committedFor(product), quantity);
    release(order);
    assert.equal(committedFor(product), quantity, 'pre-246 the release leaves committed_quantity untouched — the defect');

    applySqlFile(MIGRATION);
    const after = seedOrder({ quantity: 7, startingCommitted: 0 });
    release(after.order);
    assert.equal(committedFor(after.product), 0, 're-applying 246 restores the decrement');
});

test('available is restored either way — this phase changed no oversell behaviour', { skip }, () => {
    const { product, order, quantity } = seedOrder({ quantity: 5, available: 40 });
    const availableAfterCommit = Number(psql(
        `SELECT available FROM public.inventory_levels WHERE product_id = ${sqlString(product)}::uuid;`));
    release(order);
    const availableAfterRelease = Number(psql(
        `SELECT available FROM public.inventory_levels WHERE product_id = ${sqlString(product)}::uuid;`));
    assert.equal(availableAfterRelease, availableAfterCommit + quantity,
        'release still restores available — the column that actually gates oversell');
});
