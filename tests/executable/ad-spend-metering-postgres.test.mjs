// F-ADS-1a — migration 239's ad spend metering, proven on real Postgres.
//
// The claim with the most at stake is the DOUBLE-DEBIT fix, and it is proven the only way that
// means anything: by reproducing the defect. 239's rollback restores 232's account-balance
// projection, and the same three entries then report a balance that is short by exactly the spend.
//
// Everything else follows from "the cost is computed here, not by the caller": the pricing model
// decides whether an event is billable at all, a partial thousand never rounds up into a charge, the
// last click of a budget is clamped to what remains rather than served free or overdrawn, and a
// daily cap declines without exhausting the campaign, because "today" is a window and not a counter.
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
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_ads1a_spend';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/239_ad_spend_metering.sql';
const ROLLBACK = 'database/supabase/rollback/239_ad_spend_metering.rollback.sql';

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


const status = (campaign) => psql(`SELECT status FROM public.ad_campaigns WHERE id = ${sqlString(campaign)}::uuid;`);
const remaining = (campaign) => psql(`SELECT public.ad_campaign_remaining_minor(${sqlString(campaign)}::uuid);`);
const spentToday = (campaign) => psql(`SELECT public.ad_campaign_spent_today_minor(${sqlString(campaign)}::uuid, NULL);`);

const spend = (campaign, event, qty, key, site = SITE_A) => psql(
    `SELECT public.record_ad_spend(${sqlString(site)}::uuid, ${sqlString(campaign)}::uuid,
        ${sqlString(event)}, ${qty}, ${sqlString(key)}, 'req-ads1a', NULL);`,
);
const configure = (campaign, sql) => psql(
    `UPDATE public.ad_campaigns SET ${sql}, status = 'active' WHERE id = ${sqlString(campaign)}::uuid;`,
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
    // Site A funded with 100000 and its campaign given 40000, the worked example from 239's header.
    psql(`${budgetRpc('allocate', SITE_A, CAMPAIGN_A, 40000, 'ads1a:alloc:1', null, SITE_A)};`);
});

test('the account balance stops counting campaign spend — the worked example', { skip }, () => {
    assert.equal(balance(SITE_A), '60000', '100000 purchased minus 40000 allocated');
    assert.equal(allocated(CAMPAIGN_A), '40000');

    configure(CAMPAIGN_A, "pricing_model = 'cpc', bid_minor = 5000");
    const charged = spend(CAMPAIGN_A, 'click', 1, 'ads1a:click:1');
    assert.match(charged, /"charged"\s*:\s*true/, charged);
    assert.match(charged, /"charged_minor"\s*:\s*5000/, charged);

    // The point of the whole migration: the ACCOUNT balance is untouched by a spend.
    assert.equal(balance(SITE_A), '60000', 'a spend draws down the CAMPAIGN, not the account');
    assert.equal(remaining(CAMPAIGN_A), '35000', '40000 allocated minus 5000 spent');
    // 60000 unallocated + 35000 unspent + 5000 consumed = the 100000 that was purchased.
    assert.equal(
        Number(balance(SITE_A)) + Number(remaining(CAMPAIGN_A))
            + Number(psql(`SELECT public.ad_campaign_spent_minor(${sqlString(CAMPAIGN_A)}::uuid);`)),
        100000,
        'the arithmetic must close against what was actually purchased',
    );
});

test('REPRODUCED: 232\'s projection debits the same money twice', { skip }, () => {
    // Restoring the old projection is what makes this a measurement rather than an assertion.
    applySqlFile(ROLLBACK);
    assert.equal(balance(SITE_A), '55000', 'the old mapping subtracts the 5000 spend a second time');
    applySqlFile(MIGRATION);
    assert.equal(balance(SITE_A), '60000', 'and 239 puts it back');
    applySqlFile('database/supabase/migrations/291_ad_credit_idempotency_payload_conflict.sql');
    applySqlFile('database/supabase/migrations/355_ad_campaign_current_budget_authority.sql');

});

test('the cost is computed from the campaign, and only billable events are billed', { skip }, () => {
    // CPC: an impression is not billable and writes NO ledger row -- this is a money ledger.
    const before = psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE campaign_id = ${sqlString(CAMPAIGN_A)}::uuid;`);
    const imp = spend(CAMPAIGN_A, 'impression', 1000, 'ads1a:imp:1');
    assert.match(imp, /"charged"\s*:\s*false/, imp);
    assert.match(imp, /"reason"\s*:\s*"no_charge_for_event"/, imp);
    assert.equal(psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE campaign_id = ${sqlString(CAMPAIGN_A)}::uuid;`), before);

    // CPM: charged per thousand impressions, and a partial thousand floors rather than rounding up.
    configure(CAMPAIGN_A, "pricing_model = 'cpm', bid_minor = 3000");
    const partial = spend(CAMPAIGN_A, 'impression', 999, 'ads1a:cpm:1');
    assert.match(partial, /"charged_minor"\s*:\s*2997/, `999 * 3000 / 1000 = 2997, floored: ${partial}`);
    const exact = spend(CAMPAIGN_A, 'impression', 1000, 'ads1a:cpm:2');
    assert.match(exact, /"charged_minor"\s*:\s*3000/, exact);
    // And a click is not billable under cpm.
    assert.match(spend(CAMPAIGN_A, 'click', 1, 'ads1a:cpm:3'), /"reason"\s*:\s*"no_charge_for_event"/);
});

test('a replayed event charges once', { skip }, () => {
    const first = spend(CAMPAIGN_A, 'impression', 1000, 'ads1a:replay:1');
    const spentBefore = psql(`SELECT public.ad_campaign_spent_minor(${sqlString(CAMPAIGN_A)}::uuid);`);
    const again = spend(CAMPAIGN_A, 'impression', 1000, 'ads1a:replay:1');
    assert.match(again, /"replayed"\s*:\s*true/, again);
    assert.equal(psql(`SELECT public.ad_campaign_spent_minor(${sqlString(CAMPAIGN_A)}::uuid);`), spentBefore,
        'a retried impression must not be billed twice');
    assert.match(first, /"charged"\s*:\s*true/);
});

test('the last charge of a budget is clamped, and the campaign becomes exhausted', { skip }, () => {
    // Bid far larger than what is left: charging it in full would overdraw, refusing it would serve
    // the click free.
    const left = Number(remaining(CAMPAIGN_A));
    assert.ok(left > 0, 'the campaign must still have budget for this to mean anything');
    configure(CAMPAIGN_A, `pricing_model = 'cpc', bid_minor = ${left + 10000}`);

    const result = spend(CAMPAIGN_A, 'click', 1, 'ads1a:clamp:1');
    assert.match(result, /"clamped"\s*:\s*true/, result);
    assert.match(result, new RegExp(`"charged_minor"\\s*:\\s*${left}`), `charged exactly what remained: ${result}`);
    assert.equal(remaining(CAMPAIGN_A), '0');
    assert.equal(status(CAMPAIGN_A), 'exhausted', 'a campaign that has spent its allocation stops serving');

    // The clamp is visible in the entry, so a merchant can see why one charge differs from the bid.
    assert.equal(
        psql(`SELECT metadata->>'clamped' FROM public.ad_credit_ledger_entries
              WHERE idempotency_key = 'ads1a:clamp:1' AND site_id = ${sqlString(SITE_A)}::uuid;`),
        'true',
    );

    // And an exhausted campaign is no longer billable at all.
    assert.match(spend(CAMPAIGN_A, 'click', 1, 'ads1a:after-exhaust'), /"reason"\s*:\s*"campaign_exhausted"/);
});

test('a daily cap declines without exhausting the campaign', { skip }, () => {
    // A second campaign, funded and capped.
    psql(`${budgetRpc('allocate', SITE_B, CAMPAIGN_B, 50000, 'ads1a:alloc:b', null, SITE_B)};`);
    configure(CAMPAIGN_B, "pricing_model = 'cpc', bid_minor = 4000, daily_budget_minor = 10000");

    for (const n of [1, 2]) {
        assert.match(spend(CAMPAIGN_B, 'click', 1, `ads1a:daily:${n}`, SITE_B), /"charged"\s*:\s*true/);
    }
    assert.equal(spentToday(CAMPAIGN_B), '8000');

    // The third click would exceed the 10000 cap, so it is clamped to the 2000 that remains today.
    const clamped = spend(CAMPAIGN_B, 'click', 1, 'ads1a:daily:3', SITE_B);
    assert.match(clamped, /"charged_minor"\s*:\s*2000/, clamped);
    assert.equal(spentToday(CAMPAIGN_B), '10000');

    const declined = spend(CAMPAIGN_B, 'click', 1, 'ads1a:daily:4', SITE_B);
    assert.match(declined, /"reason"\s*:\s*"daily_budget_reached"/, declined);
    // NOT exhausted: tomorrow's window is empty, and no job has to reset anything for that to be true.
    assert.equal(status(CAMPAIGN_B), 'active');
    assert.ok(Number(remaining(CAMPAIGN_B)) > 0, 'the campaign still holds budget for tomorrow');
    assert.equal(
        psql(`SELECT public.ad_campaign_spent_today_minor(${sqlString(CAMPAIGN_B)}::uuid, ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1));`),
        '0',
        "yesterday's window is empty — the day is a query, not a counter",
    );
});

test('a campaign that is not serving is not billable, and the tenant fence holds', { skip }, () => {
    psql(`UPDATE public.ad_campaigns SET status = 'paused' WHERE id = ${sqlString(CAMPAIGN_B)}::uuid;`);
    assert.match(spend(CAMPAIGN_B, 'click', 1, 'ads1a:paused', SITE_B), /"reason"\s*:\s*"campaign_paused"/);

    psql(`UPDATE public.ad_campaigns SET status = 'active', starts_at = now() + interval '1 day' WHERE id = ${sqlString(CAMPAIGN_B)}::uuid;`);
    assert.match(spend(CAMPAIGN_B, 'click', 1, 'ads1a:future', SITE_B), /"reason"\s*:\s*"outside_campaign_window"/);

    const mismatch = withTenant(SITE_A,
        `SELECT public.record_ad_spend(${sqlString(SITE_B)}::uuid, ${sqlString(CAMPAIGN_B)}::uuid, 'click', 1, 'ads1a:fence')`);
    assert.ok(mismatch, 'spending for another site inside site A\'s transaction must be refused');
    assert.match(mismatch, /tenant context .* does not match the requested site/, mismatch);
});

test('236\'s column fence still withholds allocated_minor after 239 adds columns', { skip }, () => {
    // Adding columns does not extend 236's column-level grants, so the settings columns had to be
    // granted explicitly. The money column must NOT have been swept in with them.
    assert.equal(psql(`SELECT has_column_privilege('service_role', 'public.ad_campaigns', 'allocated_minor', 'UPDATE')::text;`), 'false');
    for (const column of ['pricing_model', 'bid_minor', 'daily_budget_minor']) {
        assert.equal(
            psql(`SELECT has_column_privilege('service_role', 'public.ad_campaigns', ${sqlString(column)}, 'UPDATE')::text;`),
            'true',
            `${column} is a merchant setting and must be writable`,
        );
    }
});

test('239 re-applies cleanly', { skip }, () => {
    applySqlFile(MIGRATION);
    applySqlFile('database/supabase/migrations/291_ad_credit_idempotency_payload_conflict.sql');
    applySqlFile('database/supabase/migrations/355_ad_campaign_current_budget_authority.sql');

    assert.equal(balance(SITE_A), '60000');
});
