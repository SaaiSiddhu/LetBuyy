// F-LOY-4 — a refunded order returns the loyalty points it spent, proven on real Postgres.
//
// Migration 234 made points spendable as checkout tender and nothing gave them back: a buyer
// refunded after paying partly with points got the cash and lost the points, while a gift card
// redeemed on the same order was correctly restored. This suite drives the real RPCs — award, redeem,
// restore — and checks the BALANCE, because the balance is the thing the buyer actually has.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_loy4_refund';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/241_restore_loyalty_on_refund.sql';
const ROLLBACK = 'database/supabase/rollback/241_restore_loyalty_on_refund.rollback.sql';

const SITE_ID = '11111111-1111-4111-8111-1111111111b1';
const BUYER_ID = '22222222-2222-4222-8222-2222222222b2';
const ORDER_ID = '33333333-3333-4333-8333-3333333333b3';
const ACTOR_ID = '44444444-4444-4444-8444-4444444444b4';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).trim();
}

function psqlExpectingFailure(sql) {
    try {
        psql(sql);
        return null;
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
}

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
    VALUES (${sqlString(SITE_ID)}::uuid, 'Loyalty Store', 'Loyalty Store', 'store', 'loyalty-store', true);

    INSERT INTO public.buyer_accounts (id, email, email_verified)
    VALUES (${sqlString(BUYER_ID)}::uuid, 'loyal-buyer@example.com', true);

    INSERT INTO public.orders
      (id, store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, payment_status)
    VALUES (${sqlString(ORDER_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid,
            'LOY-0001', 'loyal-buyer@example.com', '{}'::jsonb, '[]'::jsonb, 1000, 1000, 'paid');
  `);
}


const balanceOf = () => psql(`SELECT public.loyalty_balance(a.id) FROM public.loyalty_accounts a
  WHERE a.site_id = ${sqlString(SITE_ID)}::uuid AND a.buyer_account_id = ${sqlString(BUYER_ID)}::uuid;`);
const entries = (type) => psql(`SELECT count(*) FROM public.loyalty_ledger_entries
  WHERE site_id = ${sqlString(SITE_ID)}::uuid AND entry_type = ${sqlString(type)};`);
const restore = (order = ORDER_ID, site = SITE_ID) => psql(
    `SELECT public.restore_loyalty_on_refund(${sqlString(site)}::uuid, ${sqlString(order)}::uuid, NULL, 'req-loy4');`);

after(() => {
    if (!runnable) return;
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres'); } catch { /* next run recreates */ }
});

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
    // An active programme, 100 points earned on a paid order, then 30 spent as tender.
    psql(`SELECT public.set_loyalty_program(${sqlString(SITE_ID)}::uuid, p_is_active => true, p_earn_rate_bps => 1000);`);
    psql(`SELECT public.award_loyalty_points(${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid,
        ${sqlString(ORDER_ID)}::uuid, 'loy4:earn', NULL, NULL);`);
    psql(`SELECT public.redeem_loyalty_points(${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid,
        ${sqlString(ORDER_ID)}::uuid, 30::bigint, 'loy4:redeem', p_max_value_minor => 100000::bigint);`);
});

test('BEFORE the restore: the buyer has paid with points and is 30 down', { skip }, () => {
    assert.equal(balanceOf(), '70', '100 earned minus 30 redeemed');
    assert.equal(entries('redeemed'), '1');
    assert.equal(entries('refund_credit'), '0', 'nothing has ever written this entry type');
});

test('refunding the order returns exactly the points it spent', { skip }, () => {
    const result = restore();
    assert.match(result, /"restored"\s*:\s*true/, result);
    assert.match(result, /"restored_points"\s*:\s*30/, result);
    assert.equal(balanceOf(), '100', 'the buyer is whole again');
    assert.equal(entries('refund_credit'), '1');
});

test('a refund processed twice credits once', { skip }, () => {
    // The refund path retries and is not idempotent by itself, which is why the credit is
    // ON CONFLICT DO NOTHING rather than a plain insert.
    const again = restore();
    assert.match(again, /"restored"\s*:\s*false/, `a replay must restore nothing: ${again}`);
    assert.equal(balanceOf(), '100', 'and must not credit a second time');
    assert.equal(entries('refund_credit'), '1');
});

test('an order with no redemption restores nothing, and says so', { skip }, () => {
    const other = '77777777-7777-4777-8777-777777777777';
    psql(`INSERT INTO public.orders
      (id, store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, payment_status)
    VALUES (${sqlString(other)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid,
            'LOY4-0002', 'loyal-buyer@example.com', '{}'::jsonb, '[]'::jsonb, 500, 500, 'paid');`);
    const result = restore(other);
    assert.match(result, /"restored"\s*:\s*false/, result);
    assert.match(result, /"restored_points"\s*:\s*0/, result);
    assert.equal(balanceOf(), '100', 'an unrelated refund must not move the balance');
});

test('two redemptions on one order each get their own credit', { skip }, () => {
    // The idempotency key is derived from the ENTRY being reversed, not just the order — keying on
    // the order alone would credit only the first of them.
    const third = '88888888-8888-4888-8888-888888888888';
    psql(`INSERT INTO public.orders
      (id, store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, payment_status)
    VALUES (${sqlString(third)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid,
            'LOY4-0003', 'loyal-buyer@example.com', '{}'::jsonb, '[]'::jsonb, 500, 500, 'paid');`);
    for (const [n, points] of [[1, 10], [2, 5]]) {
        psql(`SELECT public.redeem_loyalty_points(${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid,
            ${sqlString(third)}::uuid, ${points}::bigint, 'loy4:redeem:${n}', p_max_value_minor => 100000::bigint);`);
    }
    assert.equal(balanceOf(), '85', '100 minus 10 and 5');

    const result = restore(third);
    assert.match(result, /"restored_entries"\s*:\s*2/, result);
    assert.match(result, /"restored_points"\s*:\s*15/, result);
    assert.equal(balanceOf(), '100');
});

test('the tenant fence refuses a site that is not the transaction\'s tenant', { skip }, () => {
    const other = '99999999-9999-4999-8999-999999999999';
    psql(`INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
          VALUES (${sqlString(other)}::uuid, 'Other', 'Other', 'store', 'other-loy4', true) ON CONFLICT (id) DO NOTHING;`);
    const refused = psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(other)}, true);
SELECT public.restore_loyalty_on_refund(${sqlString(SITE_ID)}::uuid, ${sqlString(ORDER_ID)}::uuid);
ROLLBACK;`);
    assert.ok(refused, 'restoring another site\'s points inside this transaction must be refused');
    assert.match(refused, /tenant context .* does not match the requested site/, refused);
});

test('the rollback removes it, and 241 re-applies', { skip }, () => {
    applySqlFile(ROLLBACK);
    assert.equal(psql(`SELECT count(*) FROM pg_proc WHERE proname = 'restore_loyalty_on_refund';`), '0');
    // Credits already written survive: the rollback drops the function, not the money.
    assert.equal(balanceOf(), '100');
    applySqlFile(MIGRATION);
    assert.equal(psql(`SELECT count(*) FROM pg_proc WHERE proname = 'restore_loyalty_on_refund';`), '1');
    applySqlFile(MIGRATION);
});
