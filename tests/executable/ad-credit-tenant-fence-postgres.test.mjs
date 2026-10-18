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
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

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

//355 fixture authority: canonical synthetic owner and same-statement captured
//context. The materialized CTE executes before the volatile budget RPC. It
//does not grant authority, mint credit, or replace the role under test.
const BUDGET_OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18';
const budgetQ = value => `'${String(value).replaceAll("'", "''")}'`;
function budgetRpc(operation, site, campaign, amount, key, requestId = null, capturedSite = site) {
    return `WITH captured_budget_context AS MATERIALIZED (
      SELECT set_config('app.site_id',${budgetQ(capturedSite)},true),
             set_config('app.user_id',${budgetQ(BUDGET_OWNER)},true)
    ) SELECT public.${operation}_ad_campaign_budget(
      ${budgetQ(site)}::uuid,${budgetQ(campaign)}::uuid,${amount === null ? 'NULL' : amount}::bigint,
      ${key === null ? 'NULL' : budgetQ(key)},${requestId === null ? 'NULL' : budgetQ(requestId)},${budgetQ(BUDGET_OWNER)}::uuid)
      FROM captured_budget_context`;
}

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
    INSERT INTO public.users (id,email) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18'::uuid,'synthetic-budget-owner@example.invalid');
    INSERT INTO public.users_custom (id,email,email_verified) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18'::uuid,'synthetic-budget-owner@example.invalid',true);
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published) VALUES
      (${sqlString(SITE_A)}::uuid, 'Ads A', 'Ads A', 'store', 'ads-a', true),
      (${sqlString(SITE_B)}::uuid, 'Ads B', 'Ads B', 'store', 'ads-b', true);

    UPDATE public.sites SET user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18'::uuid,custom_user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18'::uuid WHERE id IN (${budgetQ(SITE_A)}::uuid,${budgetQ(SITE_B)}::uuid);

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
        `${budgetRpc('allocate', SITE_B, CAMPAIGN_B, 1000, 'ads2:x1', null, SITE_A)}`);
    assert.ok(allocation, 'allocating for another site inside site A\'s transaction must be refused');
    assert.match(allocation, /Current tenant site context is required/, allocation);

    const purchase = withTenant(SITE_A,
        `SELECT public.record_ad_credit_purchase(${sqlString(SITE_B)}::uuid, 1000, 'pay_x', 'ads2:x2')`);
    assert.ok(purchase, 'crediting another site inside site A\'s transaction must be refused');
    assert.match(purchase, /tenant context .* does not match the requested site/, purchase);
});

test('the matching site works with captured context; unscoped backend allocation denies', { skip }, () => {
    assert.equal(
        withTenant(SITE_A, `${budgetRpc('allocate', SITE_A, CAMPAIGN_A, 1000, 'ads2:ok1', null, SITE_A)}`),
        null,
        'the fence must not make the merchant\'s own allocation impossible',
    );
    //355 preserves the backend role's EXECUTE grant, but requires captured
    //current owner context. Current production budget callers use the Gateway.
    for (const role of ['app_tenant', 'service_role']) {
        const denied = psqlExpectingFailure(`BEGIN; SET LOCAL ROLE ${role};
          SELECT public.allocate_ad_campaign_budget(${budgetQ(SITE_A)}::uuid,${budgetQ(CAMPAIGN_A)}::uuid,
            1000,'ads355:missing-context',NULL,${budgetQ(BUDGET_OWNER)}::uuid); ROLLBACK;`);
        assert.match(denied || '', /Current tenant site context is required/);
        assert.equal(allocated(CAMPAIGN_A), '0'); assert.equal(balance(SITE_A), '100000');
    }
    psql(`BEGIN; SET LOCAL ROLE service_role; ${budgetRpc('allocate', SITE_A, CAMPAIGN_A, 25000, 'ads2:ok2', null, SITE_A)}; COMMIT;`);
    assert.equal(allocated(CAMPAIGN_A), '25000');
    assert.equal(balance(SITE_A), '75000', '100000 purchased minus 25000 allocated');
});

test('232 survived the redefinition: replay, overdraft, cross-site and the ledger entry', { skip }, () => {
    // Replay — the same key must return the first result and write nothing new.
    const before = psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id = ${sqlString(SITE_A)}::uuid;`);
    const replayed = psql(`${budgetRpc('allocate', SITE_A, CAMPAIGN_A, 25000, 'ads2:ok2', null, SITE_A)};`);
    assert.match(replayed, /"replayed"\s*:\s*true/, replayed);
    assert.equal(psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id = ${sqlString(SITE_A)}::uuid;`), before);
    assert.equal(allocated(CAMPAIGN_A), '25000', 'a replay must not raise the budget again');

    // No overdraft — the single most important line in the function.
    const overdraft = psqlExpectingFailure(
        `${budgetRpc('allocate', SITE_A, CAMPAIGN_A, 999999, 'ads2:over', null, SITE_A)};`,
    );
    assert.ok(overdraft, 'an overdraft is credit extended, which D-5 forbids');
    assert.match(overdraft, /insufficient ad credits/, overdraft);

    // Cross-site campaign — refused with correctly captured site/actor context.
    const crossSite = psqlExpectingFailure(
        `${budgetRpc('allocate', SITE_A, CAMPAIGN_B, 1000, 'ads2:cross', null, SITE_A)};`,
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
${budgetRpc('allocate', SITE_A, CAMPAIGN_A, 1000, 'ads2:tenant1', null, SITE_A)};
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
        withTenant(SITE_A, `${budgetRpc('allocate', SITE_B, CAMPAIGN_B, 1000, 'ads2:rb1', null, SITE_A)}`),
        null,
        'without 238 the GUC and the site need not agree — this is what the fence adds',
    );

    applySqlFile(MIGRATION);
    assert.match(
        withTenant(SITE_A, `${budgetRpc('allocate', SITE_B, CAMPAIGN_B, 1000, 'ads2:rb2', null, SITE_A)}`) || '',
        /tenant context .* does not match the requested site/,
        'the fence is back',
    );
    applySqlFile(MIGRATION);
    applySqlFile('database/supabase/migrations/291_ad_credit_idempotency_payload_conflict.sql');
    applySqlFile('database/supabase/migrations/355_ad_campaign_current_budget_authority.sql');

});
