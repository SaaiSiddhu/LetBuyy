import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const billingSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/152_executable_billing_autopay.sql'),
  'utf8',
);
const billingRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/152_executable_billing_autopay.rollback.sql'),
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
    CREATE OR REPLACE FUNCTION public.current_site_id()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('app.site_id', true), '')::uuid;
    $$;
    CREATE OR REPLACE FUNCTION public.set_current_site_id(p_site_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM set_config('app.site_id', p_site_id::text, true);
    END;
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
    CREATE TABLE public.users_custom (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      site_type text NOT NULL DEFAULT 'store',
      user_id uuid REFERENCES public.users_custom(id) ON DELETE CASCADE,
      custom_user_id uuid REFERENCES public.users_custom(id) ON DELETE CASCADE,
      trial_status text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_type text NOT NULL,
      slug text NOT NULL,
      name text NOT NULL,
      is_active boolean DEFAULT true,
      gmv_percentage numeric(4,2) DEFAULT 0,
      price_monthly_inr integer DEFAULT 0,
      price_yearly_inr integer DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      UNIQUE (site_type, slug)
    );
    CREATE TABLE public.subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE CASCADE,
      plan text NOT NULL,
      status text DEFAULT 'active',
      current_period_start timestamptz,
      current_period_end timestamptz,
      payment_gateway text,
      external_subscription_id text,
      stores_limit integer DEFAULT 1,
      products_limit integer DEFAULT 10,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      billing_period text DEFAULT 'monthly',
      promo_ends_at timestamptz,
      plan_id uuid REFERENCES public.plans(id),
      amount_paid integer DEFAULT 0,
      currency text DEFAULT 'INR',
      razorpay_order_id text,
      razorpay_payment_id text,
      cancelled_at timestamptz,
      cancel_reason text
    );
    CREATE TABLE public.billing_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE CASCADE,
      store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
      invoice_number text NOT NULL,
      description text NOT NULL,
      amount integer NOT NULL,
      currency text DEFAULT 'INR',
      tax_amount integer DEFAULT 0,
      total_amount integer NOT NULL,
      payment_gateway text,
      payment_id text,
      payment_status text DEFAULT 'pending',
      period_start timestamptz,
      period_end timestamptz,
      invoice_url text,
      created_at timestamptz DEFAULT now()
    );
  `);
  psql(billingSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 014 billing migration removes GMV rake, enforces tenant RLS, supports sandbox AutoPay rows, and rolls back', () => {
  resetDatabase();

  const userId = '11111111-1111-4111-8111-111111111111';
  const siteId = '22222222-2222-4222-8222-222222222222';
  const otherSiteId = '33333333-3333-4333-8333-333333333333';
  const planId = '44444444-4444-4444-8444-444444444444';
  const subscriptionId = '55555555-5555-4555-8555-555555555555';

  psql(`
    INSERT INTO public.users_custom (id, email)
    VALUES (${sqlString(userId)}::uuid, 'billing@example.test');
    INSERT INTO public.sites (id, name, user_id, site_type)
    VALUES
      (${sqlString(siteId)}::uuid, 'Billing Store', ${sqlString(userId)}::uuid, 'store'),
      (${sqlString(otherSiteId)}::uuid, 'Other Store', ${sqlString(userId)}::uuid, 'store');
    INSERT INTO public.plans (id, site_type, slug, name, gmv_percentage, price_monthly_inr, price_yearly_inr)
    VALUES (${sqlString(planId)}::uuid, 'store', 'business', 'Business', 0, 499900, 4999000);
    INSERT INTO public.billing_mandates (
      site_id, provider_mode, status, plan_slug, billing_period, amount_minor,
      external_mandate_id, upi_vpa_hash, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'sandbox',
      'active',
      'business',
      'monthly',
      499900,
      'sandbox_mandate_001',
      'sandbox-hash:merchant@upi',
      'mandate-proof-001'
    );
    INSERT INTO public.subscriptions (
      id, user_id, store_id, site_id, plan, plan_id, status, billing_period,
      current_period_start, current_period_end, payment_gateway,
      external_subscription_id, amount_paid, currency, mandate_id, idempotency_key
    )
    SELECT
      ${sqlString(subscriptionId)}::uuid,
      ${sqlString(userId)}::uuid,
      ${sqlString(siteId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'business',
      ${sqlString(planId)}::uuid,
      'active',
      'monthly',
      now(),
      now() + interval '1 month',
      'razorpay',
      'sandbox_autopay_subscription_001',
      499900,
      'INR',
      id,
      'subscription-proof-001'
    FROM public.billing_mandates
    WHERE site_id = ${sqlString(siteId)}::uuid
      AND idempotency_key = 'mandate-proof-001';
    INSERT INTO public.billing_history (
      user_id, store_id, site_id, subscription_id, invoice_number, description,
      amount, tax_amount, total_amount, payment_gateway, payment_id, payment_status,
      billing_period, period_start, period_end
    ) VALUES (
      ${sqlString(userId)}::uuid,
      ${sqlString(siteId)}::uuid,
      ${sqlString(siteId)}::uuid,
      ${sqlString(subscriptionId)}::uuid,
      'INV-BILLING-PROOF-001',
      'Business plan - monthly',
      499900,
      89982,
      589882,
      'razorpay',
      'sandbox_payment_001',
      'paid',
      'monthly',
      now(),
      now() + interval '1 month'
    );
    INSERT INTO public.merchant_billing_invoices (
      site_id, subscription_id, billing_history_id, invoice_number, status,
      subtotal_minor, igst_minor, total_minor, irn, qr_payload
    )
    SELECT
      ${sqlString(siteId)}::uuid,
      ${sqlString(subscriptionId)}::uuid,
      id,
      invoice_number,
      'issued',
      amount,
      tax_amount,
      total_amount,
      'sandbox-irn-proof',
      'sandbox-qr-proof'
    FROM public.billing_history
    WHERE invoice_number = 'INV-BILLING-PROOF-001';
    INSERT INTO public.billing_dunning_events (
      site_id, subscription_id, billing_history_id, status, attempt_number, next_attempt_at, reason
    )
    SELECT
      ${sqlString(siteId)}::uuid,
      ${sqlString(subscriptionId)}::uuid,
      id,
      'scheduled',
      1,
      now() + interval '3 days',
      'sandbox_autopay_failed'
    FROM public.billing_history
    WHERE invoice_number = 'INV-BILLING-PROOF-001';
    INSERT INTO public.billing_usage_events (
      site_id, subscription_id, meter_name, quantity, amount_minor, source, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(subscriptionId)}::uuid,
      'orders',
      1,
      0,
      'order.created',
      'usage-proof-001'
    );
  `);

    assert.throws(
    () => psql("INSERT INTO public.plans (site_type, slug, name, gmv_percentage) VALUES ('store', 'bad-rake', 'Bad Rake', 2.50);"),
    /plans_store_zero_gmv_rake_check/,
  );

  const withoutGuc = psql(`
    BEGIN;
    SET LOCAL ROLE app_user;
    SELECT count(*) FROM public.billing_mandates;
    COMMIT;
  `).split(/\r?\n/).filter(Boolean).at(-1);
  assert.equal(withoutGuc, '0');

  const withGuc = psql(`
    BEGIN;
    SET LOCAL ROLE app_user;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    SELECT
      (SELECT count(*) FROM public.billing_mandates)::text || ',' ||
      (SELECT count(*) FROM public.merchant_billing_invoices)::text || ',' ||
      (SELECT count(*) FROM public.billing_dunning_events)::text || ',' ||
      (SELECT count(*) FROM public.billing_usage_events)::text;
    COMMIT;
  `).split(/\r?\n/).filter(Boolean).at(-1);
  assert.equal(withGuc, '1,1,1,1');

  const otherTenant = psql(`
    BEGIN;
    SET LOCAL ROLE app_user;
    SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid);
    SELECT count(*) FROM public.merchant_billing_invoices;
    COMMIT;
  `).split(/\r?\n/).filter(Boolean).at(-1);
  assert.equal(otherTenant, '0');

  psql(billingRollbackSql);
  const rollbackProof = psql(`
    SELECT
      to_regclass('public.billing_mandates') IS NULL,
      to_regclass('public.merchant_billing_invoices') IS NULL,
      to_regclass('public.billing_dunning_events') IS NULL,
      to_regclass('public.billing_usage_events') IS NULL,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'subscriptions'
          AND column_name = 'site_id'
      ),
      NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'plans_store_zero_gmv_rake_check'
      );
  `);
  assert.equal(rollbackProof, 't|t|t|t|t|t');
});
