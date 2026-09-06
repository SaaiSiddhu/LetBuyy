// F-ADS-2 — migration 238's tenant fence on the ad-credit money RPCs, proven on real Postgres.
//
// 238 redefines two of 232's functions. The risk that carries is the one this repository has already
// realised twice: create_checkout_order lost its idempotency advisory lock to a redefinition, and 218
// exists solely to put it back. So this suite proves BOTH halves — that the fence works, and that
// everything 232 did still works — against the same database.
//
// The static half of that guarantee lives in tests/governance/ad-credit-rpc-invariants.test.mjs,
// which was written and made green against 232 before 238 was authored. This is the executable half:
// the invariants asserted there are exercised here as behaviour.
//
// DESTRUCTIVE: recreates its own database and replays every migration. Refuses the shared database.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_ads2_fence';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/238_ad_credit_tenant_fence.sql';
const ROLLBACK = 'database/supabase/rollback/238_ad_credit_tenant_fence.rollback.sql';

const SITE_A = '11111111-1111-4111-8111-1111111111c1';
const SITE_B = '22222222-2222-4222-8222-2222222222c2';
const CAMPAIGN_A = '33333333-3333-4333-8333-3333333333c3';
const CAMPAIGN_B = '44444444-4444-4444-8444-4444444444c4';

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
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published) VALUES
      (${sqlString(SITE_A)}::uuid, 'Ads A', 'Ads A', 'store', 'ads-a', true),
      (${sqlString(SITE_B)}::uuid, 'Ads B', 'Ads B', 'store', 'ads-b', true);

    INSERT INTO public.ad_campaigns (id, site_id, name, status) VALUES
      (${sqlString(CAMPAIGN_A)}::uuid, ${sqlString(SITE_A)}::uuid, 'Campaign A', 'draft'),
      (${sqlString(CAMPAIGN_B)}::uuid, ${sqlString(SITE_B)}::uuid, 'Campaign B', 'draft');

    -- Both sites funded, so the allocation tests fail for the reason under test rather than for want
    -- of credits. Purchases are made with the GUC unset, which the fence deliberately allows.
    SELECT public.record_ad_credit_purchase(${sqlString(SITE_A)}::uuid, 100000, 'pay_a_1', 'ads2:buy:a1');
    SELECT public.record_ad_credit_purchase(${sqlString(SITE_B)}::uuid, 100000, 'pay_b_1', 'ads2:buy:b1');
  `);
}

// One statement with the tenant GUC set to `site`, rolled back afterwards.
const withTenant = (site, statement) =>
    psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(site)}, true);
${statement};
ROLLBACK;`);

const balance = (site) => psql(
    `SELECT public.ad_credit_balance_minor(a.id) FROM public.ad_credit_accounts a WHERE a.site_id = ${sqlString(site)}::uuid;`,
);
const allocated = (campaign) => psql(
    `SELECT allocated_minor FROM public.ad_campaigns WHERE id = ${sqlString(campaign)}::uuid;`,
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

test('the fence refuses a site that is not the transaction\'s tenant — both functions', { skip }, () => {
    const allocation = withTenant(SITE_A,
        `SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_B)}::uuid, ${sqlString(CAMPAIGN_B)}::uuid, 1000, 'ads2:x1')`);
    assert.ok(allocation, 'allocating for another site inside site A\'s transaction must be refused');
    assert.match(allocation, /tenant context .* does not match the requested site/, allocation);

    const purchase = withTenant(SITE_A,
        `SELECT public.record_ad_credit_purchase(${sqlString(SITE_B)}::uuid, 1000, 'pay_x', 'ads2:x2')`);
    assert.ok(purchase, 'crediting another site inside site A\'s transaction must be refused');
    assert.match(purchase, /tenant context .* does not match the requested site/, purchase);
});

test('the matching site still works with the GUC set, and with it unset', { skip }, () => {
    assert.equal(
        withTenant(SITE_A, `SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 1000, 'ads2:ok1')`),
        null,
        'the fence must not make the merchant\'s own allocation impossible',
    );
    // GUC unset: a service_role caller has no tenant context, and the fence deliberately does not
    // invent one. This is the path the queue workers and operator tools use.
    psql(`SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 25000, 'ads2:ok2');`);
    assert.equal(allocated(CAMPAIGN_A), '25000');
    assert.equal(balance(SITE_A), '75000', '100000 purchased minus 25000 allocated');
});

test('232 survived the redefinition: replay, overdraft, cross-site and the ledger entry', { skip }, () => {
    // Replay — the same key must return the first result and write nothing new.
    const before = psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id = ${sqlString(SITE_A)}::uuid;`);
    const replayed = psql(`SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 25000, 'ads2:ok2');`);
    assert.match(replayed, /"replayed"\s*:\s*true/, replayed);
    assert.equal(psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id = ${sqlString(SITE_A)}::uuid;`), before);
    assert.equal(allocated(CAMPAIGN_A), '25000', 'a replay must not raise the budget again');

    // No overdraft — the single most important line in the function.
    const overdraft = psqlExpectingFailure(
        `SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 999999, 'ads2:over');`,
    );
    assert.ok(overdraft, 'an overdraft is credit extended, which D-5 forbids');
    assert.match(overdraft, /insufficient ad credits/, overdraft);

    // Cross-site campaign — refused even with no GUC at all, by 232's own check.
    const crossSite = psqlExpectingFailure(
        `SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_B)}::uuid, 1000, 'ads2:cross');`,
    );
    assert.ok(crossSite, 'site A must not fund site B\'s campaign');
    assert.match(crossSite, /does not belong to site/, crossSite);

    // A purchase still requires its payment reference (D-5).
    const unfunded = psqlExpectingFailure(
        `SELECT public.record_ad_credit_purchase(${sqlString(SITE_A)}::uuid, 1000, NULL, 'ads2:nofund');`,
    );
    assert.match(unfunded || '', /a payment reference is required/, unfunded || '');

    // The ledger and the budget moved together: every allocated entry has its campaign.
    assert.equal(
        psql(`SELECT count(*) FROM public.ad_credit_ledger_entries
              WHERE site_id = ${sqlString(SITE_A)}::uuid AND entry_type = 'allocated' AND campaign_id IS NULL;`),
        '0',
        'an allocated entry with no campaign is invisible to the per-campaign spend projection',
    );
});

test('app_tenant can execute the allocation but still cannot touch the ledger', { skip }, () => {
    // This is the pairing that makes the routes safe: EXECUTE on the function, nothing on the tables.
    const viaFunction = psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(SITE_A)}, true);
SET LOCAL ROLE app_tenant;
SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 1000, 'ads2:tenant1');
ROLLBACK;`);
    assert.equal(viaFunction, null, `app_tenant must be able to allocate through the RPC: ${viaFunction}`);

    const direct = psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(SITE_A)}, true);
SET LOCAL ROLE app_tenant;
INSERT INTO public.ad_credit_ledger_entries (site_id, ad_credit_account_id, entry_type, amount_minor, balance_after_minor, idempotency_key)
SELECT ${sqlString(SITE_A)}::uuid, a.id, 'granted', 999999, 999999, 'ads2:forge' FROM public.ad_credit_accounts a WHERE a.site_id = ${sqlString(SITE_A)}::uuid;
ROLLBACK;`);
    assert.ok(direct, 'app_tenant must not be able to mint credits directly');
    assert.match(direct, /permission denied/i, direct);
});

test('the rollback restores 232 exactly, and 238 re-applies', { skip }, () => {
    applySqlFile(ROLLBACK);
    // The fence is gone: the mismatched site is accepted again.
    assert.equal(
        withTenant(SITE_A, `SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_B)}::uuid, ${sqlString(CAMPAIGN_B)}::uuid, 1000, 'ads2:rb1')`),
        null,
        'without 238 the GUC and the site need not agree — this is what the fence adds',
    );

    applySqlFile(MIGRATION);
    assert.match(
        withTenant(SITE_A, `SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_B)}::uuid, ${sqlString(CAMPAIGN_B)}::uuid, 1000, 'ads2:rb2')`) || '',
        /tenant context .* does not match the requested site/,
        'the fence is back',
    );
    applySqlFile(MIGRATION);
});
