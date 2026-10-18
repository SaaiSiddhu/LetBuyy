// Phase 10 / F3.7 — a verified provider payment finalizes one ad-credit billing row and its credit
// in a single database transaction.
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
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_ad_purchase_finalization';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable ? false : `refusing to recreate shared database '${SHARED_DATABASE}'`;
const SITE = '11111111-1111-4111-8111-1111111111c1';
const OTHER_SITE = '22222222-2222-4222-8222-2222222222c2';
const USER = '33333333-3333-4333-8333-3333333333c3';
const BILLING = '44444444-4444-4444-8444-4444444444c4';
const BILLING_NEGATIVE = '55555555-5555-4555-8555-5555555555c5';
const BILLING_ROLLBACK = '66666666-6666-4666-8666-6666666666c6';
const BILLING_LEGACY = '77777777-7777-4777-8777-7777777777c7';

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
const applySqlFile = (relativePath) => psql(stripPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));
function migrationNames() {
  return readdirSync(join(repoRoot, 'database/supabase/migrations')).filter((name) => name.endsWith('.sql'))
    .sort((a, b) => Number(a.match(/^(\d+)/)?.[1] || 0) - Number(b.match(/^(\d+)/)?.[1] || 0) || a.localeCompare(b));
}
function bootstrap() {
  psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
  psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
  for (const name of migrationNames()) {
    try {
      const sql = stripPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8'));
      psql(sql);
    } catch (error) { throw new Error(`migration ${name} failed to apply: ${error.message}`); }
  }
}

before(() => {
  if (!runnable) return;
  bootstrap();
  psql(`
    INSERT INTO public.users (id, email) VALUES (${q(USER)}::uuid, 'ads-finalize@example.test');
    INSERT INTO public.users_custom (id, email, email_verified)
    VALUES (${q(USER)}::uuid, 'ads-finalize@example.test', true);
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published, user_id)
    VALUES (${q(SITE)}::uuid, 'Ad store', 'Ad store', 'store', 'ad-finalize-a', true, ${q(USER)}::uuid),
           (${q(OTHER_SITE)}::uuid, 'Other store', 'Other store', 'store', 'ad-finalize-b', true, ${q(USER)}::uuid);
    INSERT INTO public.billing_history
      (id, user_id, store_id, site_id, invoice_number, description, amount, currency,
       tax_amount, total_amount, payment_gateway, payment_id, payment_status)
    VALUES
      (${q(BILLING)}::uuid, ${q(USER)}::uuid, ${q(SITE)}::uuid, ${q(SITE)}::uuid,
       'ADC-ORDER-1', 'Prepaid ad credits', 50000, 'INR', 0, 50000, 'razorpay', 'order_ad_1', 'pending'),
      (${q(BILLING_NEGATIVE)}::uuid, ${q(USER)}::uuid, ${q(SITE)}::uuid, ${q(SITE)}::uuid,
       'ADC-ORDER-NEG', 'Prepaid ad credits', 50000, 'INR', 0, 50000, 'razorpay', 'order_ad_neg', 'pending'),
      (${q(BILLING_ROLLBACK)}::uuid, ${q(USER)}::uuid, ${q(SITE)}::uuid, ${q(SITE)}::uuid,
       'ADC-ORDER-ROLLBACK', 'Prepaid ad credits', 60000, 'INR', 0, 60000, 'razorpay', 'order_ad_rb', 'pending'),
      (${q(BILLING_LEGACY)}::uuid, ${q(USER)}::uuid, ${q(SITE)}::uuid, ${q(SITE)}::uuid,
       'ADC-ORDER-LEGACY', 'Prepaid ad credits', 25000, 'INR', 0, 25000, 'razorpay', 'order_ad_legacy', 'pending');
  `);
});

after(() => {
  if (!runnable) return;
  psql(`DROP DATABASE IF EXISTS "${databaseName}";`, 'postgres');
});

test('atomic ad-credit finalization proves the old double-credit path and fixes retries, tenant scope, and rollback', { skip }, () => {
  // Negative control: the former route had no paid-state lock/claim, so two valid payment IDs for
  // the same pending provider order could each issue a separate entitlement credit.
  psql(`
    SELECT public.record_ad_credit_purchase(${q(SITE)}::uuid, 50000, 'pay_neg_1', 'ad.purchase:pay_neg_1');
    SELECT public.record_ad_credit_purchase(${q(SITE)}::uuid, 50000, 'pay_neg_2', 'ad.purchase:pay_neg_2');
  `);
  assert.equal(psql(`SELECT count(*) FROM public.ad_credit_ledger_entries
    WHERE site_id = ${q(SITE)}::uuid AND payment_reference IN ('pay_neg_1','pay_neg_2');`), '2');

  const first = psql(`SELECT public.finalize_ad_credit_purchase(${q(SITE)}::uuid, ${q(BILLING)}::uuid,
    'order_ad_1', 'pay_exact_1', 'req-1', ${q(USER)}::uuid);`);
  assert.match(first, /"payment_status"\s*:\s*"paid"/);
  assert.equal(psql(`SELECT payment_status || ':' || provider_payment_reference FROM public.billing_history
    WHERE id = ${q(BILLING)}::uuid;`), 'paid:pay_exact_1');
  const canonicalId = psql(`SELECT canonical_ledger_transaction_id::text FROM public.billing_history
    WHERE id = ${q(BILLING)}::uuid;`);
  assert.match(canonicalId, /^[0-9a-f-]{36}$/i, 'billing row must own its canonical posting');
  assert.equal(psql(`SELECT ledger_transactions.source_type || ':' || sum(ledger_entries.amount_minor)::text
    FROM public.ledger_transactions JOIN public.ledger_entries ON ledger_entries.transaction_id = ledger_transactions.id
    WHERE ledger_transactions.id = ${q(canonicalId)}::uuid
    GROUP BY ledger_transactions.id;`), 'ad_credit_purchase:100000');
  assert.equal(psql(`SELECT string_agg(ledger_accounts.account_code || ':' || ledger_entries.side || ':' || ledger_entries.amount_minor,
      ',' ORDER BY ledger_entries.sequence)
    FROM public.ledger_entries JOIN public.ledger_accounts ON ledger_accounts.id = ledger_entries.account_id
    WHERE ledger_entries.transaction_id = ${q(canonicalId)}::uuid;`),
    'pa_clearing:debit:50000,ad_credit_liability:credit:50000');
  assert.equal(psql(`SELECT public.ledger_account_balance_minor(${q(SITE)}::uuid, 'merchant_payable')::text;`), '0',
    'prepaid ads must not affect merchant sales payable');
  assert.equal(psql(`SELECT public.ledger_account_balance_minor(${q(SITE)}::uuid, 'ad_credit_liability')::text;`), '50000');

  // Existing rows finalized before migration 293 have no canonical link. A same-payment replay
  // repairs that missing journal exactly once without issuing a second entitlement credit.
  psql(`SELECT public.record_ad_credit_purchase(${q(SITE)}::uuid, 25000, 'pay_legacy', 'ad.purchase:pay_legacy');
    UPDATE public.billing_history SET payment_status = 'paid', provider_payment_reference = 'pay_legacy'
     WHERE id = ${q(BILLING_LEGACY)}::uuid;`);
  const legacyReplay = psql(`SELECT public.finalize_ad_credit_purchase(${q(SITE)}::uuid, ${q(BILLING_LEGACY)}::uuid,
    'order_ad_legacy', 'pay_legacy', 'req-legacy', ${q(USER)}::uuid);`);
  assert.match(legacyReplay, /"canonical_ledger_transaction_id"/);
  assert.equal(psql(`SELECT count(*) FROM public.ledger_transactions
    WHERE source_type = 'ad_credit_purchase' AND source_id = ${q(BILLING_LEGACY)};`), '1');
  const before = psql(`SELECT count(*) FROM public.ad_credit_ledger_entries
    WHERE site_id = ${q(SITE)}::uuid AND payment_reference = 'pay_exact_1';`);
  const replay = psql(`SELECT public.finalize_ad_credit_purchase(${q(SITE)}::uuid, ${q(BILLING)}::uuid,
    'order_ad_1', 'pay_exact_1', 'req-replay', ${q(USER)}::uuid);`);
  assert.match(replay, /"replayed"\s*:\s*true/);
  assert.equal(psql(`SELECT count(*) FROM public.ad_credit_ledger_entries
    WHERE site_id = ${q(SITE)}::uuid AND payment_reference = 'pay_exact_1';`), before);
  assert.equal(psql(`SELECT count(*) FROM public.ledger_transactions
    WHERE id = ${q(canonicalId)}::uuid AND source_type = 'ad_credit_purchase';`), '1',
    'exact retry must not duplicate canonical cash/liability posting');

  const secondPayment = psqlFailure(`SELECT public.finalize_ad_credit_purchase(${q(SITE)}::uuid, ${q(BILLING)}::uuid,
    'order_ad_1', 'pay_second_attempt', NULL, ${q(USER)}::uuid);`);
  assert.match(secondPayment || '', /finalized by a different payment/);
  assert.match(psqlFailure(`SELECT public.finalize_ad_credit_purchase(${q(OTHER_SITE)}::uuid, ${q(BILLING)}::uuid,
    'order_ad_1', 'pay_exact_1', NULL, ${q(USER)}::uuid);`) || '', /billing record not found/);

  // Another pending row cannot claim the provider payment reference, even within the same site.
  assert.match(psqlFailure(`SELECT public.finalize_ad_credit_purchase(${q(SITE)}::uuid, ${q(BILLING_NEGATIVE)}::uuid,
    'order_ad_neg', 'pay_exact_1', NULL, ${q(USER)}::uuid);`) || '', /duplicate key value violates unique constraint/);

  // If credit posting fails, the locked billing row remains pending with no claimed payment ID.
  psql(`INSERT INTO public.ad_credit_ledger_entries
    (site_id, ad_credit_account_id, entry_type, amount_minor, balance_after_minor, idempotency_key, payment_reference)
    SELECT ${q(SITE)}::uuid, a.id, 'purchased', 50000, 50000, 'ad.purchase:pay_rollback', 'pay_old'
    FROM public.ad_credit_accounts a WHERE a.site_id = ${q(SITE)}::uuid;`);
  assert.match(psqlFailure(`SELECT public.finalize_ad_credit_purchase(${q(SITE)}::uuid, ${q(BILLING_ROLLBACK)}::uuid,
    'order_ad_rb', 'pay_rollback', NULL, ${q(USER)}::uuid);`) || '', /idempotency key conflicts/);
  assert.equal(psql(`SELECT payment_status || ':' || COALESCE(provider_payment_reference, 'null')
    FROM public.billing_history WHERE id = ${q(BILLING_ROLLBACK)}::uuid;`), 'pending:null');
  assert.equal(psql(`SELECT count(*) FROM public.ledger_transactions
    WHERE source_type = 'ad_credit_purchase' AND source_id = ${q(BILLING_ROLLBACK)};`), '0',
    'a failed entitlement credit must roll back the canonical posting too');
  assert.match(psqlFailure(`SELECT public.post_settlement_ledger_transaction(${q(SITE)}::uuid,
    'ad_credit_purchase', '77777777-7777-4777-8777-777777777777', 'foreign-source-test',
    '[{"account_code":"pa_clearing","side":"debit","amount_minor":1},
      {"account_code":"ad_credit_liability","side":"credit","amount_minor":1}]'::jsonb);`) || '',
    /ledger source ownership could not be resolved/);

  assert.equal(psql(`SELECT has_function_privilege('anon',
    'public.finalize_ad_credit_purchase(uuid,uuid,text,text,text,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated',
    'public.finalize_ad_credit_purchase(uuid,uuid,text,text,text,uuid)', 'EXECUTE')
    OR has_function_privilege('app_tenant',
    'public.finalize_ad_credit_purchase(uuid,uuid,text,text,text,uuid)', 'EXECUTE');`), 'f');
  assert.equal(psql(`SELECT has_function_privilege('service_role',
    'public.finalize_ad_credit_purchase(uuid,uuid,text,text,text,uuid)', 'EXECUTE');`), 't');

  applySqlFile('database/supabase/rollback/293_ad_credit_purchase_canonical_liability.rollback.sql');
  assert.equal(psql(`SELECT count(*) FROM public.ledger_transactions WHERE id = ${q(canonicalId)}::uuid;`), '1',
    'rollback preserves canonical audit entries');
  applySqlFile('database/supabase/migrations/293_ad_credit_purchase_canonical_liability.sql');
  applySqlFile('database/supabase/migrations/293_ad_credit_purchase_canonical_liability.sql');
  assert.equal(psql(`SELECT count(*) FROM public.ledger_transactions
    WHERE source_type = 'ad_credit_purchase' AND source_id = ${q(BILLING)};`), '1',
    'migration replay preserves the unique canonical purchase posting');
  applySqlFile('database/supabase/rollback/292_atomic_ad_credit_purchase_finalization.rollback.sql');
  assert.equal(psql(`SELECT to_regprocedure(
    'public.finalize_ad_credit_purchase(uuid,uuid,text,text,text,uuid)') IS NULL;`), 't');
  assert.equal(psql(`SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_history'
      AND column_name = 'provider_payment_reference';`), '1', 'rollback preserves payment audit evidence');
  applySqlFile('database/supabase/migrations/292_atomic_ad_credit_purchase_finalization.sql');
  applySqlFile('database/supabase/migrations/292_atomic_ad_credit_purchase_finalization.sql');
  assert.equal(psql(`SELECT has_function_privilege('service_role',
    'public.finalize_ad_credit_purchase(uuid,uuid,text,text,text,uuid)', 'EXECUTE');`), 't');
});
