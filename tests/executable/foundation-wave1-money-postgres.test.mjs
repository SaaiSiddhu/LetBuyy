import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';

const migrations = [
  '139_executable_foundation_ledger_core.sql',
  '119_mobile_money_ledgers.sql',
  '142_executable_payment_sessions.sql',
  '151_executable_settlement_ledger.sql',
  '160_foundation_money_ledger_authority.sql',
].map((file) => readFileSync(join(repoRoot, 'database/supabase/migrations', file), 'utf8'));
const rollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/160_foundation_money_ledger_authority.rollback.sql'),
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

function ledgerLines(lines) {
  return sqlString(JSON.stringify(lines));
}

function resetDatabase() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
    END;
    $$;
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$ SELECT NULL::uuid $$;
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
    CREATE TABLE public.customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.store_customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      email text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.orders (
      id uuid PRIMARY KEY,
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      order_number text,
      total numeric DEFAULT 0,
      currency text DEFAULT 'INR',
      payment_status text DEFAULT 'pending',
      payment_method text,
      status text DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.payment_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
      provider text,
      attempt_type text,
      status text,
      amount numeric DEFAULT 0,
      currency text DEFAULT 'INR',
      provider_order_id text,
      provider_payment_id text,
      idempotency_key text,
      request_id text,
      failure_reason text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_by uuid,
      updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.payment_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
      gateway text,
      provider_payment_id text,
      amount numeric DEFAULT 0,
      currency text DEFAULT 'INR',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);

  for (const migration of migrations) {
    psql(migration);
  }
}

function postLedger({ siteId, sourceType, sourceId, idempotencyKey, lines }) {
  return psql(`
    BEGIN;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    SELECT public.post_settlement_ledger_transaction(
      ${sqlString(siteId)}::uuid,
      ${sqlString(sourceType)},
      ${sqlString(sourceId)},
      ${sqlString(idempotencyKey)},
      ${ledgerLines(lines)}::jsonb,
      '{}'::jsonb,
      NULL
    );
    COMMIT;
  `).split('\n').at(-1);
}

test('Wave 1 money ledger migration backfills, reconciles, claims payouts, and rolls back on fixture', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const orderId = '22222222-2222-4222-8222-222222222222';

  psql(`
    INSERT INTO public.sites (id, name, user_id, custom_user_id)
    VALUES (${sqlString(siteId)}::uuid, 'Wave 1 Store', ${sqlString(actorId)}::uuid, ${sqlString(actorId)}::uuid);
    INSERT INTO public.orders (id, site_id, store_id, order_number, total, payment_status)
    VALUES (${sqlString(orderId)}::uuid, ${sqlString(siteId)}::uuid, ${sqlString(siteId)}::uuid, 'W1-001', 100, 'paid');
    INSERT INTO public.wallet_ledger_entries (
      site_id,
      entry_type,
      direction,
      status,
      currency,
      amount_minor,
      idempotency_key,
      description
    )
    VALUES
      (${sqlString(siteId)}::uuid, 'payout_credit', 'credit', 'posted', 'INR', 12500, 'wallet-credit-001', 'historical credit'),
      (${sqlString(siteId)}::uuid, 'payout_debit', 'debit', 'posted', 'INR', 2500, 'wallet-debit-001', 'historical debit');
  `);

  const backfill = psql(`SELECT entries_backfilled || ':' || variance_minor FROM public.backfill_wallet_ledger_to_canonical(${sqlString(siteId)}::uuid);`);
  assert.equal(backfill, '2:0');
  assert.equal(
    psql(`SELECT status || ':' || variance_minor FROM public.money_ledger_site_reconciliations WHERE site_id = ${sqlString(siteId)}::uuid;`),
    'verified:0',
  );
  assert.equal(
    psql(`SELECT public.ledger_account_balance_minor(${sqlString(siteId)}::uuid, 'merchant_payable');`),
    '10000',
  );
  assert.equal(
    psql('SELECT count(*) FROM public.wallet_ledger_entries WHERE canonical_ledger_transaction_id IS NOT NULL;'),
    '2',
  );

  assert.equal(
    psql("SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'mode';"),
    "'sandbox'::text",
  );
  assert.equal(
    psql("SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_credentials' AND column_name = 'mode';"),
    "'sandbox'::text",
  );

  postLedger({
    siteId,
    sourceType: 'payment_capture',
    sourceId: 'pay_provider_001',
    idempotencyKey: 'capture:provider:001',
    lines: [
      { account_code: 'pa_clearing', side: 'debit', amount_minor: 10_000 },
      { account_code: 'merchant_payable', side: 'credit', amount_minor: 10_000 },
    ],
  });
  postLedger({
    siteId,
    sourceType: 'settlement',
    sourceId: 'fee-assessment-001',
    idempotencyKey: 'fee:assessment:001',
    lines: [
      { account_code: 'merchant_payable', side: 'debit', amount_minor: 400 },
      { account_code: 'platform_revenue', side: 'credit', amount_minor: 300 },
      { account_code: 'gst_payable', side: 'credit', amount_minor: 100 },
    ],
  });

  const payoutId = '33333333-3333-4333-8333-333333333333';
  psql(`
    INSERT INTO public.payout_statements (
      id,
      site_id,
      statement_number,
      status,
      provider,
      provider_mode,
      rail,
      currency,
      gross_amount_minor,
      platform_fee_minor,
      tax_minor,
      net_amount_minor,
      idempotency_key,
      created_by,
      updated_by
    )
    VALUES (
      ${sqlString(payoutId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'PYT-W1-001',
      'pending',
      'razorpay_route',
      'sandbox',
      'razorpay_route',
      'INR',
      10000,
      300,
      100,
      9600,
      'payout-create-001',
      ${sqlString(actorId)}::uuid,
      ${sqlString(actorId)}::uuid
    );
  `);

  const claimed = psql(`
    SELECT status || ':' || release_idempotency_key || ':' || net_amount_minor_bigint
    FROM public.claim_payout_statement_release(
      ${sqlString(siteId)}::uuid,
      ${sqlString(payoutId)}::uuid,
      'release-key-001',
      ${sqlString(actorId)}::uuid
    );
  `);
  assert.equal(claimed, 'processing:release-key-001:9600');
  const replayed = psql(`
    SELECT status || ':' || release_idempotency_key
    FROM public.claim_payout_statement_release(
      ${sqlString(siteId)}::uuid,
      ${sqlString(payoutId)}::uuid,
      'release-key-001',
      ${sqlString(actorId)}::uuid
    );
  `);
  assert.equal(replayed, 'processing:release-key-001');
  assert.throws(
    () => psql(`
      SELECT public.claim_payout_statement_release(
        ${sqlString(siteId)}::uuid,
        ${sqlString(payoutId)}::uuid,
        'release-key-002',
        ${sqlString(actorId)}::uuid
      );
    `),
    /not pending for release/,
  );

  const oversizedPayoutId = '44444444-4444-4444-8444-444444444444';
  psql(`
    INSERT INTO public.payout_statements (
      id,
      site_id,
      statement_number,
      status,
      provider,
      provider_mode,
      rail,
      currency,
      gross_amount_minor,
      platform_fee_minor,
      tax_minor,
      net_amount_minor,
      idempotency_key
    )
    VALUES (
      ${sqlString(oversizedPayoutId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'PYT-W1-002',
      'pending',
      'razorpay_route',
      'sandbox',
      'razorpay_route',
      'INR',
      999999,
      0,
      0,
      999999,
      'payout-create-002'
    );
  `);
  assert.throws(
    () => psql(`
      SELECT public.claim_payout_statement_release(
        ${sqlString(siteId)}::uuid,
        ${sqlString(oversizedPayoutId)}::uuid,
        'release-key-003',
        ${sqlString(actorId)}::uuid
      );
    `),
    /insufficient merchant payable balance/,
  );

  psql(rollbackSql);
  assert.equal(
    psql("SELECT to_regclass('public.money_ledger_site_reconciliations') IS NULL;"),
    't',
  );
  assert.equal(
    psql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'capture_ledger_transaction_id';"),
    '0',
  );
});
