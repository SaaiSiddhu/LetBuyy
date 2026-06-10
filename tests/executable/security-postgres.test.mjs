import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const securitySql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/153_executable_identity_security.sql'),
  'utf8',
);
const securityRollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/153_executable_identity_security.rollback.sql'),
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
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.store_customers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      email text NOT NULL,
      full_name text,
      phone text,
      status text DEFAULT 'active',
      accepts_marketing boolean DEFAULT false,
      tags text[] DEFAULT '{}',
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.customer_addresses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      customer_email text,
      address_line1 text,
      city text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.customer_credentials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      email_or_phone text NOT NULL,
      last_login_at timestamptz,
      login_count integer DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      customer_email text,
      customer_name text,
      customer_phone text,
      total numeric(12,2) DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.wishlists (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      customer_email text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.customer_wishlists (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      customer_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.data_subject_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
      request_type text NOT NULL,
      subject_type text NOT NULL DEFAULT 'customer',
      subject_email text,
      status text NOT NULL DEFAULT 'open',
      due_at timestamptz NOT NULL DEFAULT now(),
      idempotency_key text,
      reason text NOT NULL,
      request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      actor_type text NOT NULL DEFAULT 'system',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);
  psql(securitySql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 015 security migration enforces tenant RLS, stores DSR/consent/step-up evidence, and rolls back', () => {
  resetDatabase();

  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const dsrId = '33333333-3333-4333-8333-333333333333';
  const stepUpId = '44444444-4444-4444-8444-444444444444';
  const storeCreditId = '55555555-5555-4555-8555-555555555555';

  psql(`
    INSERT INTO public.sites (id, name)
    VALUES (${sqlString(siteId)}::uuid, 'Security Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.store_customers (store_id, email, full_name, encrypted_email, encrypted_phone, pii_encryption_key_id)
    VALUES (${sqlString(siteId)}::uuid, 'buyer@example.test', 'Buyer Example', 'kms.email', 'kms.phone', 'sandbox-local-kms-key');
    INSERT INTO public.customer_addresses (store_id, customer_email, address_line1, city, encrypted_payload, pii_encryption_key_id)
    VALUES (${sqlString(siteId)}::uuid, 'buyer@example.test', 'Line 1', 'Bengaluru', 'kms.address', 'sandbox-local-kms-key');
    INSERT INTO public.customer_credentials (store_id, email_or_phone, encrypted_identifier, pii_encryption_key_id)
    VALUES (${sqlString(siteId)}::uuid, 'buyer@example.test', 'kms.identifier', 'sandbox-local-kms-key');
    INSERT INTO public.orders (store_id, customer_email, customer_name, customer_phone, total)
    VALUES (${sqlString(siteId)}::uuid, 'buyer@example.test', 'Buyer Example', '+919999999999', 999.00);
    INSERT INTO public.data_subject_requests (id, site_id, request_type, subject_type, subject_email, status, reason)
    VALUES (${sqlString(dsrId)}::uuid, ${sqlString(siteId)}::uuid, 'access', 'customer', 'buyer@example.test', 'fulfilled', 'Customer requested data export.');
    INSERT INTO public.consents (
      site_id, subject_type, subject_email_hash, consent_type, status, channel, evidence, idempotency_key, granted_at
    ) VALUES (
      ${sqlString(siteId)}::uuid, 'customer', 'hash-buyer', 'dpdp_account', 'granted', 'web', '{"ip":"127.0.0.1"}'::jsonb, 'consent-proof-001', now()
    );
    INSERT INTO public.store_credit (
      id, site_id, customer_email_hash, encrypted_customer_email, balance_minor
    ) VALUES (
      ${sqlString(storeCreditId)}::uuid, ${sqlString(siteId)}::uuid, 'hash-buyer', 'kms.email', 2500
    );
    INSERT INTO public.store_credit_ledger_entries (
      site_id, store_credit_id, direction, amount_minor, reason, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid, ${sqlString(storeCreditId)}::uuid, 'credit', 2500, 'manual_adjustment', 'store-credit-proof-001'
    );
    INSERT INTO public.customer_dsr_exports (
      site_id, request_id, subject_email_hash, encrypted_subject_email, export_type, encrypted_payload, payload_digest
    ) VALUES (
      ${sqlString(siteId)}::uuid, ${sqlString(dsrId)}::uuid, 'hash-buyer', 'kms.email', 'access', 'kms.payload', 'digest'
    );
    INSERT INTO public.step_up_challenges (
      id, site_id, actor_id, action, status, challenge_token_hash, verified_at, idempotency_key
    ) VALUES (
      ${sqlString(stepUpId)}::uuid, ${sqlString(siteId)}::uuid, gen_random_uuid(), 'payout.release', 'verified', 'token-hash', now(), 'step-up-proof-001'
    );
    INSERT INTO public.sensitive_action_approvals (
      site_id, action, resource_type, resource_id, maker_actor_id, checker_actor_id, step_up_challenge_id, status, reason
    ) VALUES (
      ${sqlString(siteId)}::uuid, 'payout.release', 'payout_statement', 'payout_001', gen_random_uuid(), gen_random_uuid(), ${sqlString(stepUpId)}::uuid, 'approved', 'Second approver released payout.'
    );
  `);

  assert.throws(
    () => psql(`
      INSERT INTO public.sensitive_action_approvals (
        site_id, action, resource_type, resource_id, maker_actor_id, checker_actor_id, status, reason
      )
      VALUES (
        ${sqlString(siteId)}::uuid, 'refund.approve', 'payment', 'payment_001',
        ${sqlString(dsrId)}::uuid, ${sqlString(dsrId)}::uuid, 'approved', 'Invalid self approval.'
      );
    `),
    /sensitive_action_approvals_dual_control_check/,
  );

  const withoutGuc = psql(`
    BEGIN;
    SET LOCAL ROLE app_user;
    SELECT count(*) FROM public.consents;
    COMMIT;
  `).split(/\r?\n/).filter(Boolean).at(-1);
  assert.equal(withoutGuc, '0');

  const withGuc = psql(`
    BEGIN;
    SET LOCAL ROLE app_user;
    SELECT public.set_current_site_id(${sqlString(siteId)}::uuid);
    SELECT
      (SELECT count(*) FROM public.consents)::text || ',' ||
      (SELECT count(*) FROM public.store_credit)::text || ',' ||
      (SELECT count(*) FROM public.customer_dsr_exports)::text || ',' ||
      (SELECT count(*) FROM public.step_up_challenges)::text || ',' ||
      (SELECT count(*) FROM public.sensitive_action_approvals)::text || ',' ||
      (SELECT count(*) FROM public.store_customers)::text;
    COMMIT;
  `).split(/\r?\n/).filter(Boolean).at(-1);
  assert.equal(withGuc, '1,1,1,1,1,1');

  const otherTenant = psql(`
    BEGIN;
    SET LOCAL ROLE app_user;
    SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid);
    SELECT count(*) FROM public.customer_dsr_exports;
    COMMIT;
  `).split(/\r?\n/).filter(Boolean).at(-1);
  assert.equal(otherTenant, '0');

  psql(securityRollbackSql);
  const rollbackProof = psql(`
    SELECT
      to_regclass('public.consents') IS NULL,
      to_regclass('public.store_credit') IS NULL,
      to_regclass('public.customer_dsr_exports') IS NULL,
      to_regclass('public.step_up_challenges') IS NULL,
      to_regclass('public.sensitive_action_approvals') IS NULL,
      NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'store_customers'
          AND column_name = 'encrypted_email'
      );
  `);
  assert.equal(rollbackProof, 't|t|t|t|t|t');
});
