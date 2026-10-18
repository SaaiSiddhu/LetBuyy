// Phase 10 / F3.7 — ad-credit money RPCs reject an idempotency key reused for a different request.
//
// The negative control rolls the migration back in its owned database and proves the old functions
// replay a changed request. It then reapplies the migration and proves purchase, allocation, spend,
// and release retries are payload-bound while exact retries remain idempotent.
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
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_ads_idempotency';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable ? false : `refusing to recreate shared database '${SHARED_DATABASE}'`;
const MIGRATION = 'database/supabase/migrations/291_ad_credit_idempotency_payload_conflict.sql';
const ROLLBACK = 'database/supabase/rollback/291_ad_credit_idempotency_payload_conflict.rollback.sql';
const SITE = '11111111-1111-4111-8111-1111111111c1';
const OTHER_SITE = '22222222-2222-4222-8222-2222222222c2';
const CAMPAIGN = '33333333-3333-4333-8333-3333333333c3';
const OTHER_CAMPAIGN = '44444444-4444-4444-8444-4444444444c4';

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
  return execFileSync('docker', ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase,
    '-v', 'ON_ERROR_STOP=1', '-qAt'], { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}

function psqlFailure(sql) {
  try { psql(sql); return null; }
  catch (error) { return `${error.stderr || ''}${error.stdout || ''}`; }
}

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const stripPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const apply = (path) => psql(stripPg17Guc(readFileSync(join(repoRoot, path), 'utf8')));

function migrations() {
  return readdirSync(join(repoRoot, 'database/supabase/migrations')).filter((name) => name.endsWith('.sql'))
    .sort((a, b) => Number(a.match(/^(\d+)/)?.[1] || 0) - Number(b.match(/^(\d+)/)?.[1] || 0) || a.localeCompare(b));
}

function bootstrap() {
  psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
  psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
  for (const name of migrations()) {
    try { psql(stripPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8'))); }
    catch (error) { throw new Error(`migration ${name} failed to apply: ${error.message}`); }
  }
}

before(() => {
  if (!runnable) return;
  bootstrap();
  psql(`
    INSERT INTO public.users (id,email) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18'::uuid,'synthetic-budget-owner@example.invalid');
    INSERT INTO public.users_custom (id,email,email_verified) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18'::uuid,'synthetic-budget-owner@example.invalid',true);
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published) VALUES
      (${q(SITE)}::uuid, 'Ads idempotency', 'Ads idempotency', 'store', 'ads-idem-a', true),
      (${q(OTHER_SITE)}::uuid, 'Other ads', 'Other ads', 'store', 'ads-idem-b', true);
    UPDATE public.sites SET user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18'::uuid,custom_user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa18'::uuid WHERE id IN (${budgetQ(SITE)}::uuid,${budgetQ(OTHER_SITE)}::uuid);

    INSERT INTO public.ad_campaigns (id, site_id, name, status, pricing_model, bid_minor)
    VALUES (${q(CAMPAIGN)}::uuid, ${q(SITE)}::uuid, 'CPC campaign', 'active', 'cpc', 100),
           (${q(OTHER_CAMPAIGN)}::uuid, ${q(SITE)}::uuid, 'Other campaign', 'draft', 'cpc', 200);
    SELECT public.record_ad_credit_purchase(${q(SITE)}::uuid, 100000, 'pay_ads_exact', 'idem:purchase');
    ${budgetRpc('allocate', SITE, CAMPAIGN, 20000, 'idem:allocate', null, SITE)};
    SELECT public.record_ad_spend(${q(SITE)}::uuid, ${q(CAMPAIGN)}::uuid, 'click', 1, 'idem:spend');
    ${budgetRpc('release', SITE, CAMPAIGN, null, 'idem:release', null, SITE)};
  `);
});

after(() => {
  if (!runnable) return;
  psql(`DROP DATABASE IF EXISTS "${databaseName}";`, 'postgres');
});

test('ad-credit RPC idempotency is bound to purchase, allocation, spend and release payloads', { skip }, () => {
  // Negative control: the prior definitions silently treat changed requests as successful replays.
  apply(ROLLBACK);
  assert.match(psql(`SELECT public.record_ad_credit_purchase(${q(SITE)}::uuid, 200000, 'pay_changed', 'idem:purchase');`), /"replayed"\s*:\s*true/);
  assert.match(psql(`${budgetRpc('allocate', SITE, OTHER_CAMPAIGN, 30000, 'idem:allocate', null, SITE)};`), /"replayed"\s*:\s*true/);
  assert.match(psql(`SELECT public.record_ad_spend(${q(SITE)}::uuid, ${q(CAMPAIGN)}::uuid, 'click', 2, 'idem:spend');`), /"replayed"\s*:\s*true/);
  assert.match(psql(`${budgetRpc('release', SITE, CAMPAIGN, 1, 'idem:release', null, SITE)};`), /"replayed"\s*:\s*true/);

  apply(MIGRATION);
  apply(MIGRATION);
  apply('database/supabase/migrations/355_ad_campaign_current_budget_authority.sql');
  const conflict = /ad credit idempotency key conflicts with a different request payload/;

  assert.match(psqlFailure(`SELECT public.record_ad_credit_purchase(${q(SITE)}::uuid, 200000, 'pay_changed', 'idem:purchase');`) || '', conflict);
  assert.match(psqlFailure(`${budgetRpc('allocate', SITE, OTHER_CAMPAIGN, 30000, 'idem:allocate', null, SITE)};`) || '', conflict);
  assert.match(psqlFailure(`SELECT public.record_ad_spend(${q(SITE)}::uuid, ${q(CAMPAIGN)}::uuid, 'click', 2, 'idem:spend');`) || '', conflict);
  assert.match(psqlFailure(`${budgetRpc('release', SITE, CAMPAIGN, 1, 'idem:release', null, SITE)};`) || '', conflict);

  // Migration 242 rows predate the persisted request mode. NULL means "release all" and can be
  // replayed only when that row records the same effective releasable amount.
  psql(`INSERT INTO public.ad_credit_ledger_entries
    (site_id, ad_credit_account_id, campaign_id, entry_type, amount_minor, balance_after_minor,
     idempotency_key, metadata)
    SELECT ${q(SITE)}::uuid, a.id, ${q(CAMPAIGN)}::uuid, 'released', 3000,
      public.ad_credit_balance_minor(a.id), 'idem:legacy-release-all',
      '{"releasable_minor":3000,"campaign_allocated_before":3000}'::jsonb
    FROM public.ad_credit_accounts a WHERE a.site_id = ${q(SITE)}::uuid;
    INSERT INTO public.ad_credit_ledger_entries
    (site_id, ad_credit_account_id, campaign_id, entry_type, amount_minor, balance_after_minor,
     idempotency_key, metadata)
    SELECT ${q(SITE)}::uuid, a.id, ${q(CAMPAIGN)}::uuid, 'released', 2000,
      public.ad_credit_balance_minor(a.id), 'idem:legacy-release-mismatch',
      '{"releasable_minor":3000,"campaign_allocated_before":3000}'::jsonb
    FROM public.ad_credit_accounts a WHERE a.site_id = ${q(SITE)}::uuid;`);
  assert.match(psql(`${budgetRpc('release', SITE, CAMPAIGN, null, 'idem:legacy-release-all', null, SITE)};`), /"replayed"\s*:\s*true/);
  assert.match(psqlFailure(`${budgetRpc('release', SITE, CAMPAIGN, null, 'idem:legacy-release-mismatch', null, SITE)};`) || '', conflict);

  const before = psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id = ${q(SITE)}::uuid`);
  assert.match(psql(`SELECT public.record_ad_credit_purchase(${q(SITE)}::uuid, 100000, 'pay_ads_exact', 'idem:purchase');`), /"replayed"\s*:\s*true/);
  assert.match(psql(`${budgetRpc('allocate', SITE, CAMPAIGN, 20000, 'idem:allocate', null, SITE)};`), /"replayed"\s*:\s*true/);
  assert.match(psql(`SELECT public.record_ad_spend(${q(SITE)}::uuid, ${q(CAMPAIGN)}::uuid, 'click', 1, 'idem:spend');`), /"replayed"\s*:\s*true/);
  assert.match(psql(`${budgetRpc('release', SITE, CAMPAIGN, null, 'idem:release', null, SITE)};`), /"replayed"\s*:\s*true/);
  assert.equal(psql(`SELECT count(*) FROM public.ad_credit_ledger_entries WHERE site_id = ${q(SITE)}::uuid`), before,
    'exact replays must not add money-ledger entries');
});
