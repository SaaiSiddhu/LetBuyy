// F-LEDGER-1 — migration 236's write fence, proven on real Postgres.
//
// The claim 236 makes is a PRIVILEGE claim, and a privilege claim cannot be read off the source: a
// REVOKE naming a privilege the role never held succeeds silently, a later GRANT can quietly restore
// it, and PUBLIC or role membership can hand it back by a route the migration never mentions. So
// every assertion here is a statement actually executed as `service_role` — the role the gateway's
// admin client runs as — against a database built from 000..236.
//
// What is measured:
//   * the four stored-value tables refuse INSERT, UPDATE and DELETE from service_role, and still
//     allow SELECT (the buyer's balance and history routes read them as service_role, so a fence
//     that broke reads would break the feature it protects);
//   * ad_campaigns.allocated_minor cannot be written, by UPDATE or by INSERT, while name, status and
//     the schedule stay writable — the point of a column-level grant rather than a table-level ban;
//   * the SECURITY DEFINER RPCs still work THROUGH the fence. This is the load-bearing one: if
//     allocate_ad_campaign_budget stopped moving allocated_minor, 236 would have replaced a hole
//     with an outage;
//   * the hole is reproduced before it is closed. Applying 236's own rollback restores the grants,
//     and the mint-from-nothing UPDATE then succeeds — so the fence is shown to be the thing making
//     the difference, not an assertion that was passing anyway;
//   * 236's self-verification block is load-bearing: a decoy copy with the REVOKEs stripped must
//     FAIL to apply. Written to the OS temp directory, never into the repository.
//
// DESTRUCTIVE: recreates its own database and replays every migration. Refuses the shared database
// and SKIPS with the reason when pointed at it, rather than throwing at import — a throwing module is
// indistinguishable from a real failure inside `pnpm run test:behavioral`.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_ledger1_fence';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/236_stored_value_write_fence.sql';
const ROLLBACK = 'database/supabase/rollback/236_stored_value_write_fence.rollback.sql';

// The four tables whose every writer is a SECURITY DEFINER RPC.
const STORED_VALUE_TABLES = [
    'loyalty_accounts',
    'loyalty_ledger_entries',
    'ad_credit_accounts',
    'ad_credit_ledger_entries',
];

const SITE_ID = '11111111-1111-4111-8111-1111111111a1';
const BUYER_ID = '22222222-2222-4222-8222-2222222222a2';
const ORDER_ID = '33333333-3333-4333-8333-3333333333a3';
const CAMPAIGN_ID = '44444444-4444-4444-8444-4444444444a4';
const PRODUCT_ID = '55555555-5555-4555-8555-5555555555a5';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    ).trim();
}

// Returns stderr instead of throwing, so a refusal can be asserted on by its text.
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
const readSql = (relativePath) => stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8'));
const applySqlFile = (relativePath) => psql(readSql(relativePath));

// One statement executed with the privileges of service_role, and nothing kept afterwards. The
// ROLLBACK matters: a statement that SUCCEEDS must not leave a row behind for the next assertion.
const asServiceRole = (statement) =>
    psqlExpectingFailure(`BEGIN;
SET LOCAL ROLE service_role;
${statement};
ROLLBACK;`);

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

// Seeded as postgres, so the fixtures themselves never depend on the privileges under test.
function seedFixtures() {
    psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
    VALUES (${sqlString(SITE_ID)}::uuid, 'Fence Store', 'Fence Store', 'store', 'fence-store', true);

    INSERT INTO public.buyer_accounts (id, email, email_verified)
    VALUES (${sqlString(BUYER_ID)}::uuid, 'fence-buyer@example.com', true);

    INSERT INTO public.products (id, store_id, site_id, name, price, is_active, status)
    VALUES (${sqlString(PRODUCT_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Fence Item', 500, true, 'active');

    -- An ACTIVE programme with a real rate, so award_loyalty_points has work to do.
    INSERT INTO public.loyalty_programs (site_id, is_active, earn_rate_bps)
    VALUES (${sqlString(SITE_ID)}::uuid, true, 1000);

    INSERT INTO public.ad_campaigns (id, site_id, name, status)
    VALUES (${sqlString(CAMPAIGN_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Fence Campaign', 'draft');

    -- award_loyalty_points reads orders.total and refuses anything that is not already paid, so the
    -- fixture has to be a paid order rather than a freshly created one.
    INSERT INTO public.orders
      (id, store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, payment_status)
    VALUES (${sqlString(ORDER_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid,
            'FENCE-0001', 'fence-buyer@example.com', '{}'::jsonb, '[]'::jsonb, 500, 500, 'paid');
  `);
}

after(() => {
    if (!runnable) return;
    try {
        psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres');
    } catch {
        // A cleanup failure must not fail an otherwise passing suite; the next run recreates it.
    }
});

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
});

test('the four stored-value tables refuse every write from service_role, and still allow reads', { skip }, () => {
    for (const table of STORED_VALUE_TABLES) {
        for (const [label, statement] of [
            ['INSERT', `INSERT INTO public.${table} DEFAULT VALUES`],
            ['UPDATE', `UPDATE public.${table} SET created_at = now()`],
            ['DELETE', `DELETE FROM public.${table}`],
        ]) {
            const refusal = asServiceRole(statement);
            assert.ok(refusal, `${label} on ${table} must be refused for service_role`);
            assert.match(
                refusal,
                /permission denied/i,
                `${label} on ${table} must be refused for LACK OF PRIVILEGE, not for some other reason: ${refusal}`,
            );
        }

        // Reads must survive: the buyer's balance and history routes run as service_role.
        assert.equal(
            asServiceRole(`SELECT count(*) FROM public.${table}`),
            null,
            `SELECT on ${table} must still work — the fence protects writes, not reads`,
        );
    }
});

test('no application role holds a write on the stored-value tables — not just service_role', { skip }, () => {
    // 231 and 232 revoked app_tenant, authenticated and anon; 236 revokes service_role. Reading the
    // whole set back from pg_catalog is what turns three separate REVOKE statements into one
    // measured claim, and it is the check that would catch a future GRANT aimed at any of them.
    const holders = psql(`SELECT string_agg(r.who || ':' || t.tbl || ':' || p.priv, ', ')
      FROM unnest(ARRAY['service_role','app_tenant','authenticated','anon','public']) AS r(who)
      CROSS JOIN unnest(ARRAY['loyalty_accounts','loyalty_ledger_entries','ad_credit_accounts','ad_credit_ledger_entries']) AS t(tbl)
      CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE']) AS p(priv)
     WHERE (r.who = 'public' OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.who))
       AND has_table_privilege(r.who, 'public.' || t.tbl, p.priv);`);
    assert.equal(holders, '', `no application role may hold a write on a stored-value ledger, but: ${holders}`);

    const budgetHolders = psql(`SELECT string_agg(r.who || ':' || p.priv, ', ')
      FROM unnest(ARRAY['service_role','app_tenant','authenticated','anon','public']) AS r(who)
      CROSS JOIN unnest(ARRAY['INSERT','UPDATE']) AS p(priv)
     WHERE (r.who = 'public' OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r.who))
       AND has_column_privilege(r.who, 'public.ad_campaigns', 'allocated_minor', p.priv);`);
    assert.equal(budgetHolders, '', `allocated_minor must be unreachable, but: ${budgetHolders}`);
});

test('ad_campaigns.allocated_minor cannot be minted from application code, by UPDATE or by INSERT', { skip }, () => {
    const updated = asServiceRole(
        `UPDATE public.ad_campaigns SET allocated_minor = 500000 WHERE id = ${sqlString(CAMPAIGN_ID)}::uuid`,
    );
    assert.ok(updated, 'the mint-from-nothing UPDATE must be refused');
    assert.match(updated, /permission denied/i, `must be refused for lack of privilege: ${updated}`);

    const inserted = asServiceRole(`INSERT INTO public.ad_campaigns (site_id, name, status, allocated_minor)
      VALUES (${sqlString(SITE_ID)}::uuid, 'Smuggled Budget', 'draft', 999999)`);
    assert.ok(inserted, 'an INSERT naming allocated_minor must be refused — otherwise the fence is one statement wide');
    assert.match(inserted, /permission denied/i, `must be refused for lack of privilege: ${inserted}`);
});

test('the fence does not break campaign settings: name, status and schedule stay writable', { skip }, () => {
    assert.equal(
        asServiceRole(`UPDATE public.ad_campaigns SET name = 'Renamed', status = 'paused',
          starts_at = now(), ends_at = now() + interval '7 days' WHERE id = ${sqlString(CAMPAIGN_ID)}::uuid`),
        null,
        'a merchant route must still be able to rename, pause and schedule a campaign',
    );

    // A campaign created without naming allocated_minor takes the column DEFAULT 0, which is the
    // only correct starting budget: a new campaign has been allocated nothing.
    assert.equal(
        psql(`BEGIN;
SET LOCAL ROLE service_role;
INSERT INTO public.ad_campaigns (site_id, name, status)
VALUES (${sqlString(SITE_ID)}::uuid, 'Fresh Campaign', 'draft');
RESET ROLE;
SELECT allocated_minor FROM public.ad_campaigns WHERE name = 'Fresh Campaign';
ROLLBACK;`),
        '0',
        'a campaign created under the fence starts with a zero budget',
    );

    // Placements are which products a campaign sponsors — not money, and deliberately not fenced.
    assert.equal(
        asServiceRole(`INSERT INTO public.ad_campaign_placements (site_id, campaign_id, product_id)
          VALUES (${sqlString(SITE_ID)}::uuid, ${sqlString(CAMPAIGN_ID)}::uuid, ${sqlString(PRODUCT_ID)}::uuid)`),
        null,
        'placements are not money and must stay writable',
    );
});

test('the SECURITY DEFINER RPCs still write through the fence — ad credits', { skip }, () => {
    // Both calls run as service_role, which now holds NO write privilege on either table. They work
    // because a SECURITY DEFINER function executes with the privileges of its owner. If this ever
    // fails, 236 has replaced a hole with an outage.
    psql(`SET ROLE service_role;
SELECT public.record_ad_credit_purchase(
  ${sqlString(SITE_ID)}::uuid, 100000, 'pay_fence_1', 'fence:purchase:1', 'req-fence-1', NULL);
SELECT public.allocate_ad_campaign_budget(
  ${sqlString(SITE_ID)}::uuid, ${sqlString(CAMPAIGN_ID)}::uuid, 40000, 'fence:allocate:1', 'req-fence-2', NULL);
RESET ROLE;`);

    assert.equal(
        psql(`SELECT allocated_minor FROM public.ad_campaigns WHERE id = ${sqlString(CAMPAIGN_ID)}::uuid;`),
        '40000',
        'the RPC must still be able to move the money column the fence protects',
    );
    assert.equal(
        psql(`SELECT public.ad_credit_balance_minor(a.id) FROM public.ad_credit_accounts a
          WHERE a.site_id = ${sqlString(SITE_ID)}::uuid;`),
        '60000',
        'the balance is the ledger projection: 100000 purchased minus 40000 allocated',
    );
    assert.equal(
        psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id = ${sqlString(SITE_ID)}::uuid;`),
        '2',
        'both movements left an entry — which is exactly what a direct UPDATE would not have done',
    );
});

test('the SECURITY DEFINER RPCs still write through the fence — loyalty', { skip }, () => {
    // award_loyalty_points INSERTs into BOTH fenced loyalty tables: the account (upsert) and the
    // ledger entry. One call therefore proves both are still reachable by their canonical writer.
    const awarded = psql(`SET ROLE service_role;
SELECT public.award_loyalty_points(
  ${sqlString(SITE_ID)}::uuid, ${sqlString(BUYER_ID)}::uuid, ${sqlString(ORDER_ID)}::uuid,
  'fence:award:1', 'req-fence-3', NULL);
RESET ROLE;`);
    assert.match(awarded, /"awarded"\s*:\s*true/, `the award must succeed through the fence: ${awarded}`);
    assert.equal(
        psql(`SELECT count(*) FROM public.loyalty_accounts WHERE site_id = ${sqlString(SITE_ID)}::uuid;`),
        '1',
        'the RPC created the account despite service_role having no INSERT on it',
    );
    assert.equal(
        psql(`SELECT count(*) FROM public.loyalty_ledger_entries
          WHERE site_id = ${sqlString(SITE_ID)}::uuid AND entry_type = 'earned';`),
        '1',
        'and wrote the earned entry',
    );
});

test("236's rollback restores the hole — which is what proves the fence is doing the work", { skip }, () => {
    applySqlFile(ROLLBACK);

    // The exact statement the phase exists to prevent, now succeeding.
    assert.equal(
        asServiceRole(`UPDATE public.ad_campaigns SET allocated_minor = 500000 WHERE id = ${sqlString(CAMPAIGN_ID)}::uuid`),
        null,
        'without 236 the budget is writable from application code — this is the defect, reproduced',
    );
    assert.equal(
        asServiceRole(`DELETE FROM public.loyalty_ledger_entries WHERE site_id = ${sqlString(SITE_ID)}::uuid`),
        null,
        'and an append-only ledger is deletable — reproduced too',
    );
});

test("236's self-verification is load-bearing: a copy with the REVOKEs stripped fails to apply", { skip }, () => {
    // The decoy removes only the REVOKE/GRANT statements, leaving the verification block untouched,
    // and is written to the OS temp directory — never into the repository, where a stray migration
    // file would be picked up by the next replay.
    const original = readSql(MIGRATION);
    const decoy = original.replace(/^\s*(REVOKE|GRANT)\b[\s\S]*?;\s*$/gm, '');
    assert.notEqual(decoy, original, 'the decoy must actually differ from the migration');
    assert.ok(!/^\s*REVOKE\b/m.test(decoy), 'the decoy must contain no REVOKE at all');

    const decoyPath = join(mkdtempSync(join(tmpdir(), 'letbuyy-fence-')), '236-decoy.sql');
    writeFileSync(decoyPath, decoy, 'utf8');

    // Applied while the rollback above has restored the grants, so the verification block has
    // something real to catch.
    const failure = psqlExpectingFailure(decoy);
    assert.ok(failure, 'a 236 that revokes nothing must FAIL, not report success');
    assert.match(
        failure,
        /236: service_role still holds|236: service_role can still/,
        `the failure must come from 236's own verification block: ${failure}`,
    );
});

test('re-applying 236 closes the hole again, so the migration is replayable', { skip }, () => {
    applySqlFile(MIGRATION);

    assert.match(
        asServiceRole(`UPDATE public.ad_campaigns SET allocated_minor = 500000 WHERE id = ${sqlString(CAMPAIGN_ID)}::uuid`) || '',
        /permission denied/i,
        'the fence is back',
    );
    assert.match(
        asServiceRole(`DELETE FROM public.loyalty_ledger_entries WHERE site_id = ${sqlString(SITE_ID)}::uuid`) || '',
        /permission denied/i,
        'and the ledger is append-only again',
    );

    // Applying it a second time on top of itself must also succeed — replay is how migrations reach
    // an environment that already has some of them.
    applySqlFile(MIGRATION);
});
