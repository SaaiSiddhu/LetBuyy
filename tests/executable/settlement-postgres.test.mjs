import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const foundationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/139_executable_foundation_ledger_core.sql'),
  'utf8',
);
const money119Sql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/119_mobile_money_ledgers.sql'),
  'utf8',
);
const settlementSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/151_executable_settlement_ledger.sql'),
  'utf8',
);
const settlementRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/151_executable_settlement_ledger.rollback.sql'),
  'utf8',
);
const foundationRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/139_executable_foundation_ledger_core.rollback.sql'),
  'utf8',
);

function psql(sql, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8', ...options },
  ).trim();
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function lastPsqlLine(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) || '';
}

function resetDatabase() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    DROP ROLE IF EXISTS app_user;
    DROP ROLE IF EXISTS service_role;
    DROP ROLE IF EXISTS authenticated;
    CREATE ROLE app_user;
    CREATE ROLE service_role;
    CREATE ROLE authenticated;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    CREATE OR REPLACE FUNCTION public.update_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      user_id uuid,
      custom_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.orders (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      order_number text,
      total numeric(12,2) NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'INR',
      payment_status text DEFAULT 'pending',
      status text DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);
  psql(foundationSql);
  psql(money119Sql);
  psql(settlementSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 013 settlement layer posts balanced PA/COD ledger entries, explains breaks, enforces RLS, and rolls back', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const settlementId = '33333333-3333-4333-8333-333333333333';
  const codSettlementId = '44444444-4444-4444-8444-444444444444';
  const payoutStatementId = '55555555-5555-4555-8555-555555555555';

  psql(`
    INSERT INTO public.sites (id, name)
    VALUES (${sqlString(siteId)}::uuid, 'Settlement Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.settlements (
      id, site_id, settlement_reference, provider, provider_mode, rail, status, currency,
      gross_amount_minor, platform_fee_minor, gst_minor, net_amount_minor, reserve_minor,
      recon_break_minor, idempotency_key
    ) VALUES (
      ${sqlString(settlementId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'rp_setl_001',
      'razorpay_route',
      'sandbox',
      'pa_split',
      'break_detected',
      'INR',
      10000,
      300,
      54,
      9600,
      0,
      46,
      'settlement-proof-001'
    );
    UPDATE public.settlements
       SET ledger_transaction_id = public.post_settlement_ledger_transaction(
        ${sqlString(siteId)}::uuid,
        'settlement',
        ${sqlString(settlementId)},
        'settlement:proof-001',
        ${jsonSql([
          { account_code: 'pa_clearing', side: 'debit', amount_minor: 10000, memo: 'PA settlement' },
          { account_code: 'merchant_payable', side: 'credit', amount_minor: 9600, memo: 'Merchant payable' },
          { account_code: 'platform_revenue', side: 'credit', amount_minor: 300, memo: 'Platform revenue' },
          { account_code: 'gst_payable', side: 'credit', amount_minor: 54, memo: 'GST payable' },
          { account_code: 'reserve', side: 'credit', amount_minor: 46, memo: 'Explained suspense' }
        ])},
        '{"provider":"razorpay_route","no_custody":true}'::jsonb,
        'req-settlement-proof'
      )
     WHERE id = ${sqlString(settlementId)}::uuid;
    INSERT INTO public.recon_breaks (
      site_id, settlement_id, break_type, status, currency, amount_minor, suspense_account_code, explanation
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(settlementId)}::uuid,
      'amount_mismatch',
      'explained',
      'INR',
      46,
      'reserve',
      'Explained by reserve suspense'
    );
    INSERT INTO public.settlements (
      id, site_id, settlement_reference, provider, provider_mode, rail, status, currency,
      gross_amount_minor, platform_fee_minor, gst_minor, net_amount_minor, reserve_minor,
      recon_break_minor, idempotency_key
    ) VALUES (
      ${sqlString(codSettlementId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'cod_remit_001',
      'cod',
      'sandbox',
      'cod_remittance',
      'recorded',
      'INR',
      5000,
      150,
      27,
      4823,
      0,
      0,
      'cod-settlement-proof-001'
    );
    UPDATE public.settlements
       SET ledger_transaction_id = public.post_settlement_ledger_transaction(
        ${sqlString(siteId)}::uuid,
        'cod_remittance',
        ${sqlString(codSettlementId)},
        'cod-remittance:proof-001',
        ${jsonSql([
          { account_code: 'cod_receivable', side: 'debit', amount_minor: 5000, memo: 'COD remittance' },
          { account_code: 'merchant_payable', side: 'credit', amount_minor: 4823, memo: 'Merchant payable' },
          { account_code: 'platform_revenue', side: 'credit', amount_minor: 150, memo: 'Platform revenue' },
          { account_code: 'gst_payable', side: 'credit', amount_minor: 27, memo: 'GST payable' }
        ])},
        '{"provider":"cod"}'::jsonb,
        'req-cod-proof'
      )
     WHERE id = ${sqlString(codSettlementId)}::uuid;
    INSERT INTO public.payout_statements (
      id, site_id, statement_number, status, provider, provider_mode, rail, currency,
      gross_amount_minor, platform_fee_minor, tax_minor, net_amount_minor, idempotency_key,
      canonical_ledger_transaction_id
    )
    SELECT
      ${sqlString(payoutStatementId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'PYT-PROOF-001',
      'pending',
      'razorpay_route',
      'sandbox',
      'razorpay_route',
      'INR',
      10000,
      300,
      54,
      9646,
      'payout-proof-001',
      ledger_transaction_id
    FROM public.settlements WHERE id = ${sqlString(settlementId)}::uuid;
    INSERT INTO public.wallet_ledger_entries (
      site_id, payout_statement_id, entry_type, direction, status, currency, amount_minor,
      reference_type, reference_id, idempotency_key, canonical_ledger_transaction_id
    )
    SELECT
      ${sqlString(siteId)}::uuid,
      ${sqlString(payoutStatementId)}::uuid,
      'payout_credit',
      'credit',
      'pending',
      'INR',
      9646,
      'payout_statement',
      ${sqlString(payoutStatementId)},
      'payout-credit-proof-001',
      ledger_transaction_id
    FROM public.settlements WHERE id = ${sqlString(settlementId)}::uuid;
  `);

  assert.equal(psql('SELECT count(*) FROM public.ledger_balance_breaks();'), '0');
  assert.equal(
    psql("SELECT amount_minor FROM public.ledger_entries le JOIN public.ledger_accounts la ON la.id = le.account_id WHERE la.account_code = 'reserve' AND le.site_id = '11111111-1111-4111-8111-111111111111'::uuid;"),
    '46',
  );
  assert.equal(psql('SELECT count(*) FROM public.recon_breaks WHERE status = \'explained\';'), '1');
  assert.equal(psql('SELECT count(*) FROM public.wallet_ledger_entries WHERE canonical_ledger_transaction_id IS NOT NULL;'), '1');
  assert.equal(
    psql(`SELECT public.post_settlement_ledger_transaction(
      ${sqlString(siteId)}::uuid,
      'settlement',
      ${sqlString(settlementId)},
      'settlement:proof-001',
      ${jsonSql([
        { account_code: 'pa_clearing', side: 'debit', amount_minor: 10000, memo: 'PA settlement' },
        { account_code: 'merchant_payable', side: 'credit', amount_minor: 10000, memo: 'Merchant payable' }
      ])},
      '{}'::jsonb,
      NULL
    ) = (SELECT ledger_transaction_id FROM public.settlements WHERE id = ${sqlString(settlementId)}::uuid);`),
    't',
  );
  assert.equal(
    psql('SET ROLE app_user; SELECT count(*) FROM public.settlements; RESET ROLE;'),
    '0',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.settlements; RESET ROLE; COMMIT;`)),
    '2',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.recon_breaks; RESET ROLE; COMMIT;`)),
    '0',
  );

  psql(`
    DELETE FROM public.wallet_ledger_entries;
    DELETE FROM public.payout_statements;
    DELETE FROM public.recon_breaks;
    DELETE FROM public.settlements;
  `);
  psql(settlementRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.settlements') IS NULL;"), 't');
  assert.equal(psql("SELECT to_regprocedure('public.post_settlement_ledger_transaction(uuid,text,text,text,jsonb,jsonb,text)') IS NULL;"), 't');
  assert.equal(
    psql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payout_statements' AND column_name = 'canonical_ledger_transaction_id';"),
    '0',
  );
  psql(foundationRollbackSql);
});
