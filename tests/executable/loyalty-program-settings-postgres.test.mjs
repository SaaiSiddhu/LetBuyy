// F-LOY-3 (backend) — migration 237's loyalty programme writer, proven on real Postgres.
//
// The thing this phase exists to fix is measurable in one line: before 237, nothing in the
// repository could create a loyalty_programs row, so `SELECT site_id FROM loyalty_programs WHERE
// is_active` — the queue worker's own filter — could never return anything. The suite ends by
// running that exact query.
//
// What is measured beyond "the row appears":
//   * NULL means LEAVE UNCHANGED for every setting. With replace semantics a client toggling
//     is_active while omitting point_value_minor would reset it to the column default and revalue
//     every outstanding point as a side effect. This is the money-critical half of the contract;
//     it is asserted per field, not once.
//   * the audit row is written in the SAME transaction and carries the revaluation: outstanding
//     points, the point value before and after, and the liability delta in paise, signed.
//   * loyalty_outstanding_points agrees with summing loyalty_balance per account — the point of
//     building it ON that function instead of re-summing entry_type.
//   * the settings path reaches the money path: activate, award on a paid order, redeem.
//   * the rollback drops both functions and the migration re-applies.
//
// DESTRUCTIVE: recreates its own database and replays every migration. Refuses the shared database
// and SKIPS with the reason rather than throwing at import.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_loy5_program';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/237_set_loyalty_program.sql';
const ROLLBACK = 'database/supabase/rollback/237_set_loyalty_program.rollback.sql';

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

// One call, returning the RPC's JSON.
const setProgram = (args) => psql(`SELECT public.set_loyalty_program(${args});`);
const programRow = () => psql(
    `SELECT is_active || '|' || earn_rate_bps || '|' || redeem_cap_bps || '|' || point_value_minor
       FROM public.loyalty_programs WHERE site_id = ${sqlString(SITE_ID)}::uuid;`,
);
const latestAudit = (field) => psql(
    `SELECT ${field} FROM public.audit_logs
      WHERE resource_type = 'loyalty_program' AND resource_id = ${sqlString(SITE_ID)}::uuid
      ORDER BY created_at DESC, id DESC LIMIT 1;`,
);

after(() => {
    if (!runnable) return;
    try {
        psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres');
    } catch {
        // A cleanup failure must not fail an otherwise passing suite.
    }
});

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
});

test('BEFORE: the table has no writer, so no store can ever be active', { skip }, () => {
    // The state 237 exists to end, asserted rather than described: the queue worker's own filter
    // returns nothing because nothing has ever written the table.
    assert.equal(psql(`SELECT count(*) FROM public.loyalty_programs;`), '0');
    assert.equal(psql(`SELECT count(*) FROM public.loyalty_programs WHERE is_active;`), '0');
});

test('creating a programme takes the table defaults for whatever was not supplied', { skip }, () => {
    const json = setProgram(`${sqlString(SITE_ID)}::uuid, p_is_active => true, p_earn_rate_bps => 500,
        p_actor_id => ${sqlString(ACTOR_ID)}::uuid, p_actor_email => 'merchant@example.com',
        p_request_id => 'req-loy5-1'`);
    assert.match(json, /"created"\s*:\s*true/, json);
    // cap 5000 and value 100 are the table's own defaults — the safe ones.
    assert.equal(programRow(), 'true|500|5000|100');

    assert.equal(latestAudit("action"), 'loyalty_program.created');
    assert.equal(latestAudit("actor_id"), ACTOR_ID);
    assert.equal(latestAudit("actor_type"), 'user');
    assert.equal(latestAudit("actor_email"), 'merchant@example.com');
    assert.equal(latestAudit("coalesce(old_values::text, 'NULL')"), 'NULL', 'a creation has no prior state');
    assert.equal(latestAudit("new_values->>'earn_rate_bps'"), '500');
    assert.equal(latestAudit("metadata->>'request_id'"), 'req-loy5-1');
});

test('NULL means LEAVE UNCHANGED — per field, because a reset here revalues points', { skip }, () => {
    // Toggling only is_active must not touch the rate, the cap or the point value.
    setProgram(`${sqlString(SITE_ID)}::uuid, p_is_active => false, p_actor_id => ${sqlString(ACTOR_ID)}::uuid`);
    assert.equal(programRow(), 'false|500|5000|100', 'only is_active moved');

    setProgram(`${sqlString(SITE_ID)}::uuid, p_earn_rate_bps => 250, p_actor_id => ${sqlString(ACTOR_ID)}::uuid`);
    assert.equal(programRow(), 'false|250|5000|100', 'only the rate moved');

    setProgram(`${sqlString(SITE_ID)}::uuid, p_redeem_cap_bps => 3000, p_actor_id => ${sqlString(ACTOR_ID)}::uuid`);
    assert.equal(programRow(), 'false|250|3000|100', 'only the cap moved');

    // And an update records the prior state, which a creation cannot.
    assert.equal(latestAudit("action"), 'loyalty_program.updated');
    assert.equal(latestAudit("old_values->>'redeem_cap_bps'"), '5000');
    assert.equal(latestAudit("new_values->>'redeem_cap_bps'"), '3000');
});

test('the settings path reaches the money path: activate, earn, redeem', { skip }, () => {
    setProgram(`${sqlString(SITE_ID)}::uuid, p_is_active => true, p_earn_rate_bps => 1000,
        p_actor_id => ${sqlString(ACTOR_ID)}::uuid`);

    // 10% of a 1000 order = 100 points, through the canonical earn RPC.
    const awarded = psql(`SELECT public.award_loyalty_points(
      ${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid, ${sqlString(ORDER_ID)}::uuid,
      'loy5:earn:1', 'req-loy5-earn', NULL);`);
    assert.match(awarded, /"awarded"\s*:\s*true/, awarded);
    assert.match(awarded, /"points"\s*:\s*100/, awarded);

    assert.equal(
        psql(`SELECT public.loyalty_outstanding_points(${sqlString(SITE_ID)}::uuid);`),
        '100',
        'the site-wide projection sees the earned points',
    );
    // The one-definition property: the site figure IS the sum of the per-account projection.
    assert.equal(
        psql(`SELECT public.loyalty_outstanding_points(${sqlString(SITE_ID)}::uuid)
                   - (SELECT COALESCE(SUM(public.loyalty_balance(a.id)), 0)
                        FROM public.loyalty_accounts a WHERE a.site_id = ${sqlString(SITE_ID)}::uuid);`),
        '0',
        'the site projection must not be a second definition of a balance',
    );

    // And the points are spendable under the cap the settings just set (3000 bps of 1000 = 300 paise
    // -> 3 points at 100 paise each).
    // Named arguments: 233 inserted p_max_value_minor BEFORE p_request_id, so a positional call
    // written from 231's shape silently passes the wrong things in the wrong slots.
    const redeemed = psql(`SELECT public.redeem_loyalty_points(
      ${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid, ${sqlString(ORDER_ID)}::uuid,
      3::bigint, 'loy5:redeem:1',
      p_max_value_minor => 100000::bigint, p_request_id => 'req-loy5-redeem');`);
    assert.match(redeemed, /"redeemed"\s*:\s*true/, redeemed);
});

test('a revaluation is recorded with its size, signed, in paise', { skip }, () => {
    const outstandingBefore = Number(psql(`SELECT public.loyalty_outstanding_points(${sqlString(SITE_ID)}::uuid);`));
    assert.ok(outstandingBefore > 0, 'the site must hold points for the revaluation to mean anything');

    setProgram(`${sqlString(SITE_ID)}::uuid, p_point_value_minor => 50, p_actor_id => ${sqlString(ACTOR_ID)}::uuid`);

    assert.equal(latestAudit("metadata->>'point_value_minor_before'"), '100');
    assert.equal(latestAudit("metadata->>'point_value_minor_after'"), '50');
    assert.equal(latestAudit("metadata->>'outstanding_points'"), String(outstandingBefore));
    assert.equal(
        latestAudit("metadata->>'liability_delta_minor'"),
        String(outstandingBefore * (50 - 100)),
        'halving the point value must record the negative swing, not merely the two rates',
    );
});

test('as app_tenant inside the tenant transaction: the GUC and the site must agree', { skip }, () => {
    const OTHER_SITE = '77777777-7777-4777-8777-777777777777';
    psql(`INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
          VALUES (${sqlString(OTHER_SITE)}::uuid, 'Other', 'Other', 'store', 'other-store', true)
          ON CONFLICT (id) DO NOTHING;`);

    // The route resolves ownership for one store and the transaction is scoped to it. Passing a
    // different site must be refused by the DATABASE, not merely caught in review — this is the
    // shape of a real routing bug, not a hypothetical attack.
    const mismatch = psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(SITE_ID)}, true);
SET LOCAL ROLE app_tenant;
SELECT public.set_loyalty_program(${sqlString(OTHER_SITE)}::uuid, p_is_active => true);
ROLLBACK;`);
    assert.ok(mismatch, 'a site that is not the transaction\'s tenant must be refused');
    assert.match(mismatch, /tenant context .* does not match the requested site/, mismatch);

    // The matching call, as app_tenant, must SUCCEED — the fence must not make the route impossible.
    const ok = psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(SITE_ID)}, true);
SET LOCAL ROLE app_tenant;
SELECT public.set_loyalty_program(${sqlString(SITE_ID)}::uuid, p_redeem_cap_bps => 3000);
ROLLBACK;`);
    assert.equal(ok, null, `the merchant's own site must still be writable inside the tenant transaction: ${ok}`);

    // app_tenant may execute the function and still may NOT touch the table directly. The function
    // is the only path, which is what stops it being a second writer.
    const direct = psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(SITE_ID)}, true);
SET LOCAL ROLE app_tenant;
UPDATE public.loyalty_programs SET point_value_minor = 1 WHERE site_id = ${sqlString(SITE_ID)}::uuid;
ROLLBACK;`);
    assert.ok(direct, 'app_tenant must not be able to UPDATE the table directly');
    assert.match(direct, /permission denied/i, direct);
});

test('the settings change and its audit row are one transaction', { skip }, () => {
    // A refusal must leave BOTH untouched. If the audit insert were a separate statement issued by
    // the caller, a rejected change could still leave a row claiming it happened.
    const auditBefore = psql(`SELECT count(*) FROM public.audit_logs WHERE resource_type = 'loyalty_program';`);
    const rowBefore = programRow();

    const refusal = psqlExpectingFailure(
        `SELECT public.set_loyalty_program(${sqlString(SITE_ID)}::uuid, p_earn_rate_bps => 10001);`,
    );
    assert.ok(refusal, 'an out-of-range rate must be refused');

    assert.equal(psql(`SELECT count(*) FROM public.audit_logs WHERE resource_type = 'loyalty_program';`), auditBefore);
    assert.equal(programRow(), rowBefore);
});

test('every input is validated with a message that names the value', { skip }, () => {
    const cases = [
        [`${sqlString(SITE_ID)}::uuid, p_earn_rate_bps => 10001`, /earn_rate_bps must be between 0 and 10000, got 10001/],
        [`${sqlString(SITE_ID)}::uuid, p_earn_rate_bps => -1`, /earn_rate_bps must be between 0 and 10000, got -1/],
        [`${sqlString(SITE_ID)}::uuid, p_redeem_cap_bps => 10001`, /redeem_cap_bps must be between 0 and 10000, got 10001/],
        [`${sqlString(SITE_ID)}::uuid, p_point_value_minor => 0`, /point_value_minor must be greater than zero, got 0/],
        [`${sqlString(SITE_ID)}::uuid, p_actor_type => 'root'`, /actor_type must be one of/],
        [`'99999999-9999-4999-8999-999999999999'::uuid`, /does not exist/],
        [`NULL::uuid`, /site is required/],
    ];
    for (const [args, expected] of cases) {
        const refusal = psqlExpectingFailure(`SELECT public.set_loyalty_program(${args});`);
        assert.ok(refusal, `must be refused: ${args}`);
        assert.match(refusal, expected, `${args} -> ${refusal}`);
    }
});

test('AFTER: the queue worker\'s own filter now returns the store', { skip }, () => {
    setProgram(`${sqlString(SITE_ID)}::uuid, p_is_active => true, p_actor_id => ${sqlString(ACTOR_ID)}::uuid`);
    // Character-for-character the query loyalty-earn.ts runs.
    assert.equal(
        psql(`SELECT site_id FROM public.loyalty_programs WHERE is_active = true;`),
        SITE_ID,
        'the sweeper can finally find a store to award for',
    );
});

test('the rollback removes both functions and the migration re-applies', { skip }, () => {
    applySqlFile(ROLLBACK);
    assert.equal(
        psql(`SELECT count(*) FROM pg_proc WHERE proname IN ('set_loyalty_program', 'loyalty_outstanding_points');`),
        '0',
        'the rollback drops both',
    );
    // The settings the merchant already saved survive: 237 changes no table.
    assert.equal(psql(`SELECT count(*) FROM public.loyalty_programs;`), '1');

    applySqlFile(MIGRATION);
    assert.equal(
        psql(`SELECT count(*) FROM pg_proc WHERE proname IN ('set_loyalty_program', 'loyalty_outstanding_points');`),
        '2',
    );
    applySqlFile(MIGRATION);
});
