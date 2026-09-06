// F-ADS-4 — unspent campaign budget comes back, proven on real Postgres.
//
// `allocate_ad_campaign_budget` debited the account and raised allocated_minor; nothing reversed it,
// so a merchant who ended a campaign could not reach whatever it still held. D-5 makes credits
// non-withdrawable, which is exactly why they must be re-allocatable — prepaid AND non-refundable
// AND non-recoverable would make a typo permanent.
//
// The assertion that carries the weight is CONSERVATION: after every operation, account balance plus
// campaign remaining plus spent must still equal what was purchased. A credit written without the
// matching allocated_minor decrement would pass a naive "the balance went up" test and leave the
// campaign able to spend money the account already has back.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_ads4_release';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/242_release_ad_campaign_budget.sql';
const ROLLBACK = 'database/supabase/rollback/242_release_ad_campaign_budget.rollback.sql';

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



const remaining = (campaign) => Number(psql(`SELECT public.ad_campaign_remaining_minor(${sqlString(campaign)}::uuid);`));
const allocatedOf = (campaign) => Number(psql(`SELECT allocated_minor FROM public.ad_campaigns WHERE id = ${sqlString(campaign)}::uuid;`));
const spentOf = (campaign) => Number(psql(`SELECT public.ad_campaign_spent_minor(${sqlString(campaign)}::uuid);`));
const balanceOf = (site) => Number(psql(`SELECT public.ad_credit_balance_minor(a.id) FROM public.ad_credit_accounts a WHERE a.site_id = ${sqlString(site)}::uuid;`));
const release = (campaign, amount, key, site = SITE_A) => psql(
    `SELECT public.release_ad_campaign_budget(${sqlString(site)}::uuid, ${sqlString(campaign)}::uuid,
        ${amount === null ? 'NULL' : amount}::bigint, ${sqlString(key)}, 'req-ads4', NULL);`);

// The invariant: nothing is created or destroyed by moving credit between the account and a campaign.
const conserved = (site, campaign) => balanceOf(site) + remaining(campaign) + spentOf(campaign);

after(() => {
    if (!runnable) return;
    try { psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres'); } catch { /* next run recreates */ }
});

before(() => {
    if (!runnable) return;
    bootstrapDatabase();
    seedFixtures();
    psql(`SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 40000, 'ads4:alloc');`);
    psql(`UPDATE public.ad_campaigns SET status = 'active', pricing_model = 'cpc', bid_minor = 5000 WHERE id = ${sqlString(CAMPAIGN_A)}::uuid;`);
    psql(`SELECT public.record_ad_spend(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 'click', 1, 'ads4:spend');`);
});

test('the starting position: 100000 purchased, 40000 allocated, 5000 spent', { skip }, () => {
    assert.equal(balanceOf(SITE_A), 60000);
    assert.equal(allocatedOf(CAMPAIGN_A), 40000);
    assert.equal(spentOf(CAMPAIGN_A), 5000);
    assert.equal(remaining(CAMPAIGN_A), 35000);
    assert.equal(conserved(SITE_A, CAMPAIGN_A), 100000, 'conservation holds before anything is released');
});

test('releasing a partial amount credits the account and lowers the allocation together', { skip }, () => {
    const result = release(CAMPAIGN_A, 10000, 'ads4:release:partial');
    assert.match(result, /"released"\s*:\s*true/, result);
    assert.match(result, /"amount_minor"\s*:\s*10000/, result);

    assert.equal(balanceOf(SITE_A), 70000, 'the account gets it back');
    assert.equal(allocatedOf(CAMPAIGN_A), 30000, 'and the campaign no longer claims to hold it');
    assert.equal(remaining(CAMPAIGN_A), 25000);
    assert.equal(conserved(SITE_A, CAMPAIGN_A), 100000, 'nothing was created or destroyed');
});

test('a NULL amount releases everything still unspent', { skip }, () => {
    const result = release(CAMPAIGN_A, null, 'ads4:release:all');
    assert.match(result, /"amount_minor"\s*:\s*25000/, `everything remaining: ${result}`);
    assert.equal(remaining(CAMPAIGN_A), 0);
    assert.equal(allocatedOf(CAMPAIGN_A), 5000, 'the campaign keeps exactly what it spent');
    assert.equal(balanceOf(SITE_A), 95000, '100000 purchased minus the 5000 actually spent');
    assert.equal(conserved(SITE_A, CAMPAIGN_A), 100000);
});

test('a replayed release credits once', { skip }, () => {
    const before = balanceOf(SITE_A);
    const again = release(CAMPAIGN_A, null, 'ads4:release:all');
    assert.match(again, /"replayed"\s*:\s*true/, again);
    assert.equal(balanceOf(SITE_A), before, 'a retried release must not credit twice');
    assert.equal(conserved(SITE_A, CAMPAIGN_A), 100000);
});

test('releasing more than remains is refused — a ledger cannot invent credit', { skip }, () => {
    psql(`SELECT public.allocate_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 10000, 'ads4:alloc:2');`);
    assert.equal(remaining(CAMPAIGN_A), 10000);

    const refused = psqlExpectingFailure(
        `SELECT public.release_ad_campaign_budget(${sqlString(SITE_A)}::uuid, ${sqlString(CAMPAIGN_A)}::uuid, 999999::bigint, 'ads4:over');`);
    assert.ok(refused, 'releasing more than the campaign has left must be refused');
    assert.match(refused, /cannot release 999999 from a campaign with 10000 remaining/, refused);
    assert.equal(conserved(SITE_A, CAMPAIGN_A), 100000, 'and the refusal changed nothing');
});

test('a campaign with nothing left says so rather than writing an empty entry', { skip }, () => {
    release(CAMPAIGN_A, null, 'ads4:release:rest');
    const entriesBefore = psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id = ${sqlString(SITE_A)}::uuid;`);
    const nothing = release(CAMPAIGN_A, null, 'ads4:release:empty');
    assert.match(nothing, /"released"\s*:\s*false/, nothing);
    assert.match(nothing, /"reason"\s*:\s*"nothing_to_release"/, nothing);
    assert.equal(psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id = ${sqlString(SITE_A)}::uuid;`), entriesBefore,
        'a zero-amount ledger entry is noise, not a record');
});

test('the tenant fence, and app_tenant can release through the RPC but not by hand', { skip }, () => {
    const mismatch = withTenant(SITE_A,
        `SELECT public.release_ad_campaign_budget(${sqlString(SITE_B)}::uuid, ${sqlString(CAMPAIGN_B)}::uuid, NULL::bigint, 'ads4:fence')`);
    assert.ok(mismatch, 'releasing another site\'s budget inside site A\'s transaction must be refused');
    assert.match(mismatch, /tenant context .* does not match the requested site/, mismatch);

    // 236's fence still holds: the RPC may move allocated_minor, app_tenant may not.
    const direct = psqlExpectingFailure(`BEGIN;
SELECT set_config('app.site_id', ${sqlString(SITE_A)}, true);
SET LOCAL ROLE app_tenant;
UPDATE public.ad_campaigns SET allocated_minor = 0 WHERE id = ${sqlString(CAMPAIGN_A)}::uuid;
ROLLBACK;`);
    assert.ok(direct && /permission denied/i.test(direct), `app_tenant must not move the budget by hand: ${direct}`);
});

test('the rollback removes it and 242 re-applies', { skip }, () => {
    applySqlFile(ROLLBACK);
    assert.equal(psql(`SELECT count(*) FROM pg_proc WHERE proname = 'release_ad_campaign_budget';`), '0');
    applySqlFile(MIGRATION);
    assert.equal(psql(`SELECT count(*) FROM pg_proc WHERE proname = 'release_ad_campaign_budget';`), '1');
    applySqlFile(MIGRATION);
});
