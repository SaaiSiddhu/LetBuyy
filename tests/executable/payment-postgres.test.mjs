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
const paymentSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/142_executable_payment_sessions.sql'),
  'utf8',
);
const paymentRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/142_executable_payment_sessions.rollback.sql'),
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

function lastPsqlLine(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) || '';
}

function resetDatabase() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    DROP ROLE IF EXISTS app_user;
    CREATE ROLE app_user;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
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
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.customers (
      id uuid PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.store_customers (
      id uuid PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.orders (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      total numeric(12,2) NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'INR',
      payment_status text DEFAULT 'pending',
      status text DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.payment_transactions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      gateway text NOT NULL,
      amount numeric(10,2) NOT NULL,
      currency text DEFAULT 'INR',
      status text DEFAULT 'pending',
      provider_payment_id text,
      provider_order_id text,
      provider_event_id text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      CONSTRAINT payment_transactions_gateway_check CHECK (gateway = ANY (ARRAY['stripe'::text, 'razorpay'::text, 'paypal'::text, 'cashfree'::text, 'cod'::text, 'bank_transfer'::text]))
    );
    CREATE TABLE public.payment_attempts (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      payment_transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
      provider text NOT NULL,
      attempt_type text NOT NULL,
      status text NOT NULL,
      amount numeric(12,2) DEFAULT 0 NOT NULL,
      currency text DEFAULT 'INR' NOT NULL,
      provider_order_id text,
      provider_payment_id text,
      provider_event_id text,
      idempotency_key text,
      request_id text,
      failure_reason text,
      metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      created_by uuid,
      updated_by uuid,
      CONSTRAINT payment_attempts_attempt_type_check CHECK (attempt_type = ANY (ARRAY['reference'::text, 'authorize'::text, 'capture'::text, 'failure'::text, 'void'::text])),
      CONSTRAINT payment_attempts_provider_check CHECK (provider = ANY (ARRAY['stripe'::text, 'razorpay'::text, 'paypal'::text, 'cashfree'::text, 'cod'::text, 'bank_transfer'::text])),
      CONSTRAINT payment_attempts_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text]))
    );
    ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
  `);
  psql(foundationSql);
  psql(paymentSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 004 payment sessions apply, enforce tenant GUC RLS, and roll back on real Postgres', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'Payment Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.orders (id, store_id, site_id, total, currency)
    VALUES (${sqlString(orderId)}::uuid, ${sqlString(siteId)}::uuid, ${sqlString(siteId)}::uuid, 123.45, 'INR');
    INSERT INTO public.payment_credentials (site_id, provider, mode, encrypted_credentials)
    VALUES (${sqlString(siteId)}::uuid, 'razorpay', 'sandbox', '{"ciphertext":"mock"}'::jsonb);
    INSERT INTO public.payments (
      site_id, order_id, provider, mode, status, amount_minor, provider_order_id, provider_session_id, idempotency_key, client_action
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(orderId)}::uuid,
      'upi',
      'sandbox',
      'authorized',
      12345,
      'upi_sandbox_order',
      'upi_sandbox_session',
      'payment-session-proof',
      'upi_collect'
    );
    INSERT INTO public.payment_attempts (site_id, order_id, provider, attempt_type, status, amount, currency)
    VALUES (${sqlString(siteId)}::uuid, ${sqlString(orderId)}::uuid, 'upi', 'refund', 'succeeded', 1.00, 'INR');
  `);

  assert.equal(
    psql('SET ROLE app_user; SELECT count(*) FROM public.payments; RESET ROLE;'),
    '0',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.payments; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.payments; RESET ROLE; COMMIT;`)),
    '0',
  );
  assert.equal(
    psql("SELECT provider FROM public.payment_attempts WHERE provider = 'upi' AND attempt_type = 'refund';"),
    'upi',
  );

  psql(`
    DELETE FROM public.payment_attempts;
    DELETE FROM public.payments;
    DELETE FROM public.payment_credentials;
  `);
  psql(paymentRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.payments') IS NULL;"), 't');
  assert.equal(psql("SELECT to_regclass('public.payment_credentials') IS NULL;"), 't');
  psql(foundationRollbackSql);
});
