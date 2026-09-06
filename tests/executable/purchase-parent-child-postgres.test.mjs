// CHK-1 — parent purchase + child orders (D-3), proven on real Postgres.
//
// What migration 219 claims, and what this file measures rather than assumes:
//   * one checkout produces exactly one purchase and one order linked to it, and the order JSON the
//     RPC returns carries purchase_id (so every existing caller gets it without a code change);
//   * replaying the idempotency key returns the SAME order and creates NO second purchase — which
//     also re-proves that CHK-0's advisory lock survived this redefinition of create_checkout_order,
//     the exact trap migrations 213 and 215 fell into;
//   * a second child for one purchase is refused by the index that IS the D-3 single-merchant flag;
//   * D-PURCHASE-TENANCY holds at the database: app_tenant with the tenant GUC set can neither read
//     nor write purchases, and neither can anon or authenticated, while the merchant's own order row
//     stays fully visible and carries its purchase_id. A merchant loses nothing and gains no reach;
//   * the rollback drops the three objects, KEEPS CHK-0's lock (rolling back this feature must never
//     roll back that S0 fix), leaves checkout working, and re-applies cleanly.
//
// DESTRUCTIVE: recreates its database and replays every migration. Refuses the shared container, and
// SKIPS with the exact command when no dedicated one is named rather than throwing at import — a
// throwing module is indistinguishable from a real failure inside `pnpm run test:behavioral`, which
// is how CHK-0's regression stayed invisible.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_chk1_purchases';
const SHARED_DATABASE = 'letbuyy_executable';
// TEST-1: the hazard this guards against is recreating the SHARED DATABASE, not sharing a container.
// This suite builds its own database (letbuyy_chk1_purchases) and drops it again, so it is safe
// alongside the shared one and runs in `pnpm run test:behavioral` like every other executable suite.
// Refusing the shared CONTAINER — the inherited rule — meant these deterministic guards never ran in
// CI at all, which is exactly how the duplicate-order defect CHK-0 fixed stayed hidden for weeks.
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/219_purchase_parent_child_orders.sql';
const ROLLBACK = 'database/supabase/rollback/219_purchase_parent_child_orders.rollback.sql';

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const LOCATION_ID = '33333333-3333-4333-8333-333333333333';
const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).trim();
}

// Returns stderr instead of throwing, so a refusal can be asserted on.
function psqlExpectingFailure(sql) {
    try {
        psql(sql);
        return null;
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
}

const lastLine = (out) => out.split('\n').map((l) => l.trim()).filter(Boolean).at(-1) || '';
const sqlString = (v) => `'${String(v).replaceAll("'", "''")}'`;
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

// The bootstrap lives in a shared, Supabase-faithful module since F-HARNESS-1: pgcrypto in
// `extensions` rather than `public`, Supabase's own ALTER DEFAULT PRIVILEGES, and role attributes
// stated rather than inherited from whichever suite created them first. See CAP-C62 and CAP-C64 —
// each of those three differences has silently flipped a test result in this repository.
const BOOTSTRAP_SQL = SUPABASE_FAITHFUL_BOOTSTRAP_SQL;

function bootstrapDatabase() {
    psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(BOOTSTRAP_SQL);
    for (const name of listMigrations()) {
        const sql = stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8'));
        try {
            psql(sql);
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
}

function seedFixtures() {
    psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
    VALUES (${sqlString(SITE_ID)}::uuid, 'CHK-1 Store', 'CHK-1 Store', 'store', 'chk1-store', true);

    INSERT INTO public.inventory_locations (id, store_id, name, is_default, status)
    VALUES (${sqlString(LOCATION_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Default', true, 'active');

    INSERT INTO public.products (id, store_id, site_id, name, price, is_active, status)
    VALUES (${sqlString(PRODUCT_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Item', 500, true, 'active');

    INSERT INTO public.inventory_levels
      (store_id, product_id, location_id, available, reserved, available_quantity, reserved_quantity, committed_quantity)
    VALUES (${sqlString(SITE_ID)}::uuid, ${sqlString(PRODUCT_ID)}::uuid, ${sqlString(LOCATION_ID)}::uuid, 1000, 0, 1000, 0, 0);
  `);
}

function checkout(idempotencyKey) {
    const items = JSON.stringify([{ product_id: PRODUCT_ID, variant_id: null, quantity: 1 }]);
    return psql(`SELECT public.create_checkout_order(
    ${sqlString(SITE_ID)}::uuid, 'CHK-1 Buyer', 'buyer@example.com', '9999999999', '{}'::jsonb,
    ${sqlString(items)}::jsonb, 'cod', NULL, NULL, NULL, 'standard',
    ${sqlString(idempotencyKey)}, NULL, ${sqlString(`req-${idempotencyKey}`)}, NULL, NULL);`);
}

const count = (table, where = 'true') => Number(psql(`SELECT count(*) FROM public.${table} WHERE ${where};`));
const orderIdOf = (json) => json.match(/"id"\s*:\s*"([0-9a-f-]{36})"/)?.[1] ?? null;
const purchaseIdOf = (json) => json.match(/"purchase_id"\s*:\s*"([0-9a-f-]{36})"/)?.[1] ?? null;

// One statement as app_tenant with the tenant GUC set to this site.
const asMerchant = (statement) =>
    psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(SITE_ID)}, true);
SET LOCAL ROLE app_tenant;
${statement};
ROLLBACK;`);

// TEST-1: this suite runs inside the shared container now, so it must leave nothing behind.
after(() => {
  if (!runnable) return;
  try {
    psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres');
  } catch {
    // A cleanup failure must not fail an otherwise passing suite; the next run recreates it anyway.
  }
});

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
});

test('a checkout creates exactly one purchase and one child order, and returns purchase_id to its caller', { skip }, () => {
    const json = checkout('chk1:first');
    const orderId = orderIdOf(json);
    const purchaseId = purchaseIdOf(json);
    assert.ok(orderId, 'the RPC must return an order');
    assert.ok(purchaseId, 'the returned order JSON must carry purchase_id, so existing callers get it with no code change');
    assert.equal(count('purchases'), 1);
    assert.equal(count('orders', `purchase_id = ${sqlString(purchaseId)}::uuid`), 1, 'exactly one child order');
    assert.equal(
        psql(`SELECT origin_site_id::text || '|' || channel || '|' || customer_email FROM public.purchases WHERE id = ${sqlString(purchaseId)}::uuid;`),
        `${SITE_ID}|storefront|buyer@example.com`,
        'the parent records its origin site, its channel and the buyer contact snapshot',
    );
});

test('replaying the idempotency key returns the same order and creates no second purchase', { skip }, () => {
    const before_ = count('purchases');
    const first = checkout('chk1:replay');
    const second = checkout('chk1:replay');
    assert.equal(orderIdOf(second), orderIdOf(first), 'a replay must return the same order');
    assert.equal(count('purchases'), before_ + 1, 'a replay must not create a second parent');
    // CHK-0's lock must have survived this redefinition — 213 and 215 each lost it here.
    assert.equal(
        psql(`SELECT (position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid)) > 0)::text
                FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`),
        'true',
        'the redefinition must carry migration 218\'s advisory lock forward',
    );
});

test('the D-3 flag: a purchase cannot acquire a second child order', { skip }, () => {
    const purchaseId = psql('SELECT id FROM public.purchases LIMIT 1;');
    const error = psqlExpectingFailure(`
    INSERT INTO public.orders (store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, purchase_id)
    VALUES (${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'DUP-1', 'buyer@example.com', '{}'::jsonb, '[]'::jsonb, 1, 1, ${sqlString(purchaseId)}::uuid);`);
    assert.ok(error, 'a second child must be refused while single-merchant checkout is the shipped mode');
    assert.match(error, /orders_single_child_per_purchase_idx/, 'refused by the index that is the D-3 flag');
});

test('D-PURCHASE-TENANCY: no merchant realm can read or write purchases, and merchants keep their own orders', { skip }, () => {
    for (const statement of [
        'SELECT count(*) FROM public.purchases',
        `INSERT INTO public.purchases (origin_site_id, customer_email, idempotency_key) VALUES (${sqlString(SITE_ID)}::uuid, 'x@y.z', 'k')`,
        "UPDATE public.purchases SET customer_email = 'z@z.z'",
        'DELETE FROM public.purchases',
    ]) {
        const error = asMerchant(statement);
        assert.ok(error, `app_tenant must be refused: ${statement.slice(0, 40)}`);
        assert.match(error, /permission denied for table purchases/, 'refused at the grant layer, with no policy behind it either');
    }
    // anon and authenticated are stopped by RLS, NOT by the grant layer — corrected in F-HARNESS-1.
    // The original assertion here expected `permission denied`, which was true only because the old
    // test harness omitted Supabase's `ALTER DEFAULT PRIVILEGES`, leaving these roles with no grant
    // at all. On Supabase they DO hold the grant, so the protection that actually runs in production
    // is `purchases` having RLS enabled AND forced with no policy naming them. Measured: a read
    // succeeds and returns ZERO ROWS; a write is refused by the policy. That is a real defence, but
    // it is a different one from the one this test used to claim, so assert the real one — and
    // assert FORCE, because without it the table owner would bypass the only thing protecting the
    // table. (No data was ever exposed; the guarantee was mis-stated, not missing.)
    assert.equal(
        psql(`SELECT relrowsecurity::text || ' ' || relforcerowsecurity::text FROM pg_class WHERE oid='public.purchases'::regclass;`),
        'true true',
        'RLS is the only thing standing between the buyer realm and purchases — it must be forced',
    );
    assert.equal(
        psql(`SELECT count(*) FROM pg_policies WHERE tablename='purchases' AND roles::text ~ '(anon|authenticated|public)';`),
        '0',
        'no policy may name the buyer realm',
    );
    for (const role of ['anon', 'authenticated']) {
        const readError = psqlExpectingFailure(`BEGIN; SET LOCAL ROLE ${role}; SELECT count(*) FROM public.purchases; ROLLBACK;`);
        assert.equal(readError, null, `${role} holds the Supabase default grant, so the read itself succeeds`);
        assert.equal(
            lastLine(psql(`BEGIN; SET LOCAL ROLE ${role}; SELECT count(*) FROM public.purchases; ROLLBACK;`)),
            '0',
            `${role} must read ZERO rows — there is at least one purchase, and it must not see it`,
        );
        const writeError = psqlExpectingFailure(
            `BEGIN; SET LOCAL ROLE ${role}; INSERT INTO public.purchases (origin_site_id, customer_email, idempotency_key)` +
            ` VALUES (${sqlString(SITE_ID)}::uuid, 'x@y.z', 'k-${role}'); ROLLBACK;`);
        assert.ok(writeError, `${role} must not be able to write a purchase`);
        assert.match(writeError, /violates row-level security policy for table "purchases"/);
    }
    // app_tenant is still refused at the grant layer, which is the correct answer for a table that
    // is deliberately NOT a tenant table: migration 164's sweep never granted it anything.
    assert.match(
        asMerchant('SELECT count(*) FROM public.purchases') || '',
        /permission denied for table purchases/,
    );
    // The merchant loses nothing: its own order row stays visible and carries the link.
    const visible = asMerchant('SELECT count(*) FROM public.orders WHERE purchase_id IS NOT NULL');
    assert.equal(visible, null, 'a merchant must still read its own orders, including purchase_id');
    // purchases is not a tenant table and must never gain a tenant column by accident.
    assert.equal(
        psql("SELECT count(*) FROM information_schema.columns WHERE table_name = 'purchases' AND column_name IN ('site_id','store_id');"),
        '0',
        'purchases must carry no tenant column — that is what keeps it out of the tenant registry',
    );
});

test('at head, 219\'s rollback refuses — and the round trip is proven where it belongs', { skip }, () => {
    // This test used to apply 219's rollback here and check the round trip. It cannot: this suite
    // runs at head, where migration 234 has taken create_checkout_order to 20 parameters while
    // 219's rollback restores the 18-parameter version. CREATE OR REPLACE with a different
    // parameter list ADDS an overload instead of replacing, and every checkout call then fails
    // `is not unique` — CAP-C65. The rollback now refuses, which is the correct answer, and the
    // round trip is proven at migration 219 by
    // tests/executable/rollback-signature-precondition-postgres.test.mjs.
    const error = psqlExpectingFailure(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, ROLLBACK), 'utf8')));
    assert.ok(error, "219's rollback must refuse against a current database");
    assert.match(error, /rollback 219 refuses to run/);
    assert.match(error, /adds a second overload/);

    // And it must leave the schema exactly as it was — a refusal that half-applied would be worse
    // than the defect it prevents.
    assert.equal(psql("SELECT (to_regclass('public.purchases') IS NOT NULL)::text;"), 'true', 'purchases still present');
    assert.equal(
        psql(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`),
        '1',
        'exactly one create_checkout_order',
    );
    assert.ok(purchaseIdOf(checkout('chk1:after-refusal')), 'and checkout still creates a parent purchase');
});
