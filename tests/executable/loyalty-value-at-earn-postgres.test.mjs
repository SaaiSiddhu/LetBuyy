// F-LOY-5 — an earned point records what it was worth, and NOTHING ELSE CHANGES.
//
// The second half of that sentence is the one under test. Redemption reads the programme's CURRENT
// point_value_minor, and whether it should keep doing so is owner decision D-LOY-REVALUE. It would be
// very easy for a migration that starts recording value-at-earn to drift into USING it — which would
// answer the decision by implementation. The revaluation test below exists to prove it did not.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_loy5_value';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/243_record_loyalty_value_at_earn.sql';
const ROLLBACK = 'database/supabase/rollback/243_record_loyalty_value_at_earn.rollback.sql';

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

const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA extensions;
CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS $$ SELECT public.gen_random_bytes($1) $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON auth.users TO service_role;
`;

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



const meta = (type, key) => psql(`SELECT metadata->>${sqlString(key)} FROM public.loyalty_ledger_entries
  WHERE site_id = ${sqlString(SITE_ID)}::uuid AND entry_type = ${sqlString(type)}
  ORDER BY created_at DESC, id DESC LIMIT 1;`);
const balanceOf = () => psql(`SELECT public.loyalty_balance(a.id) FROM public.loyalty_accounts a
  WHERE a.site_id = ${sqlString(SITE_ID)}::uuid AND a.buyer_account_id = ${sqlString(BUYER_ID)}::uuid;`);

after(() => {
    if (!runnable) return;
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres'); } catch { /* next run recreates */ }
});

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
    // 1 point = 100 paise at the moment of earning.
    psql(`SELECT public.set_loyalty_program(${sqlString(SITE_ID)}::uuid, p_is_active => true,
        p_earn_rate_bps => 1000, p_point_value_minor => 100);`);
    psql(`SELECT public.award_loyalty_points(${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid,
        ${sqlString(ORDER_ID)}::uuid, 'loy5:earn', NULL, NULL);`);
});

test('the earn entry records what a point was worth at the time', { skip }, () => {
    assert.equal(balanceOf(), '100', '10% of a 1000 order');
    assert.equal(meta('earned', 'point_value_minor'), '100');
    assert.equal(meta('earned', 'value_minor'), '10000', '100 points at 100 paise each');
    assert.equal(meta('earned', 'earn_rate_bps'), '1000', 'and the rate that produced them');
});

test('BEHAVIOUR IS UNCHANGED: redemption still values points at the CURRENT rate', { skip }, () => {
    // The assertion this whole phase exists to make. Halve the point value AFTER the points were
    // earned; a redemption must still use the new rate, because whether it should grandfather is
    // D-LOY-REVALUE and this migration must not have answered it.
    psql(`SELECT public.set_loyalty_program(${sqlString(SITE_ID)}::uuid, p_point_value_minor => 50);`);

    psql(`SELECT public.redeem_loyalty_points(${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid,
        ${sqlString(ORDER_ID)}::uuid, 10::bigint, 'loy5:redeem', p_max_value_minor => 100000::bigint);`);

    assert.equal(meta('redeemed', 'point_value_minor'), '50', 'the CURRENT rate, not the earn-time one');
    assert.equal(meta('redeemed', 'value_minor'), '500', '10 points at the new 50 paise — grandfathering was NOT implemented');
    // And the earn entry still says what it always said, so the history is intact either way.
    assert.equal(meta('earned', 'point_value_minor'), '100', 'the earn-time value is preserved, not rewritten');
});

test('the revaluation is now reconstructible from the ledger alone', { skip }, () => {
    // Before this migration the earlier value existed nowhere: 237's audit row records a settings
    // change, but nothing tied a VALUE to the points a particular buyer holds.
    const earned = Number(meta('earned', 'point_value_minor'));
    const redeemed = Number(meta('redeemed', 'point_value_minor'));
    assert.equal(earned, 100);
    assert.equal(redeemed, 50);
    assert.ok(earned !== redeemed, 'the two rates are visible side by side, which is the whole point');
});

test('a refund credit carries the value the ORIGINAL redemption used', { skip }, () => {
    // Not the current rate: a refund returns what was actually spent, and if the rate moved in
    // between, those are different numbers.
    psql(`SELECT public.set_loyalty_program(${sqlString(SITE_ID)}::uuid, p_point_value_minor => 25);`);
    psql(`SELECT public.restore_loyalty_on_refund(${sqlString(SITE_ID)}::uuid, ${sqlString(ORDER_ID)}::uuid, NULL, 'req-loy5');`);

    assert.equal(meta('refund_credit', 'point_value_minor_at_redemption'), '50',
        'the redemption happened at 50, and the credit says so even though the rate is now 25');
    assert.equal(meta('refund_credit', 'value_minor_at_redemption'), '500');
    assert.equal(balanceOf(), '100', 'and the buyer has their points back');
});

test('235 and 241 kept everything else: award declines, refund idempotency', { skip }, () => {
    // The redefinition risk. Both bodies were transformed rather than retyped, and these are the
    // behaviours a careless rewrite would have dropped.
    psql(`UPDATE public.loyalty_accounts SET status = 'frozen' WHERE site_id = ${sqlString(SITE_ID)}::uuid;`);
    const frozen = psql(`SELECT public.award_loyalty_points(${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid,
        ${sqlString(ORDER_ID)}::uuid, 'loy5:frozen', NULL, NULL);`);
    assert.match(frozen, /"reason"\s*:\s*"account_frozen"/, `235's decline-instead-of-raise must survive: ${frozen}`);
    psql(`UPDATE public.loyalty_accounts SET status = 'active' WHERE site_id = ${sqlString(SITE_ID)}::uuid;`);

    const replay = psql(`SELECT public.restore_loyalty_on_refund(${sqlString(SITE_ID)}::uuid, ${sqlString(ORDER_ID)}::uuid, NULL, 'req-loy5');`);
    assert.match(replay, /"restored"\s*:\s*false/, `241's idempotency must survive: ${replay}`);
});

test('the rollback restores the previous definitions, and 243 re-applies', { skip }, () => {
    applySqlFile(ROLLBACK);
    // New earn entries stop recording the value again — which is the gap, restored.
    psql(`SELECT public.award_loyalty_points(${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid,
        ${sqlString(ORDER_ID)}::uuid, 'loy5:after-rollback', NULL, NULL);`);
    assert.equal(meta('earned', 'point_value_minor') || '', '', 'without 243 the value is not recorded');

    applySqlFile(MIGRATION);
    applySqlFile(MIGRATION);
});
