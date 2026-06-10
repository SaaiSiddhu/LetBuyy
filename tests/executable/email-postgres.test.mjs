import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const foundationSql = readFileSync(join(repoRoot, 'database/supabase/migrations/139_executable_foundation_ledger_core.sql'), 'utf8');
const emailSql = readFileSync(join(repoRoot, 'database/supabase/migrations/149_executable_email_delivery.sql'), 'utf8');
const emailRollbackSql = readFileSync(join(repoRoot, 'database/supabase/rollback/149_executable_email_delivery.rollback.sql'), 'utf8');
const foundationRollbackSql = readFileSync(join(repoRoot, 'database/supabase/rollback/139_executable_foundation_ledger_core.rollback.sql'), 'utf8');

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8' },
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
    CREATE TABLE public.email_logs (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      recipient_email text NOT NULL,
      email_type text NOT NULL,
      subject text NOT NULL,
      status text DEFAULT 'pending'::text NOT NULL,
      provider_message_id text,
      error_message text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now(),
      CONSTRAINT email_logs_email_type_check CHECK (email_type = ANY (ARRAY['verification','magic_link','password_reset','store_created_success','store_created_failure','welcome','order_confirmation','order_shipped','low_stock_alert','subscription_renewal']::text[])),
      CONSTRAINT email_logs_status_check CHECK (status = ANY (ARRAY['pending','sent','failed','bounced']::text[]))
    );
    ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY service_role_email_logs ON public.email_logs USING (true) WITH CHECK (true);
  `);
  psql(foundationSql);
  psql(emailSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 011 email migration extends logs, enforces tenant RLS, supports suppression/domain controls, and rolls back on real Postgres', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const userId = '33333333-3333-4333-8333-333333333333';
  const hash = 'email-hash-001';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'Email Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.sender_domains (
      site_id, domain, status, dkim_status, spf_status, dmarc_status, from_rewrite_domain, idempotency_key, created_by, updated_by
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'merchant.example',
      'pending',
      'pending',
      'pending',
      'pending',
      'mail.letbuyy.com',
      'sender-domain-proof-001',
      ${sqlString(userId)}::uuid,
      ${sqlString(userId)}::uuid
    );
    INSERT INTO public.email_suppressions (
      site_id, email_hash, reason, source, idempotency_key, created_by, updated_by
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(hash)},
      'unsubscribe',
      'customer',
      'email-suppression-proof-001',
      ${sqlString(userId)}::uuid,
      ${sqlString(userId)}::uuid
    );
    INSERT INTO public.email_logs (
      site_id, recipient_email, recipient_hash, email_type, template_key, subject, status, provider, provider_attempts, idempotency_key, created_by, updated_by
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'customer@example.test',
      ${sqlString(hash)},
      'order_confirmation',
      'order_confirmation',
      'Order confirmed',
      'delivered',
      'sandbox_resend',
      '[{"provider":"sandbox_resend","status":"delivered"}]'::jsonb,
      'email-log-proof-001',
      ${sqlString(userId)}::uuid,
      ${sqlString(userId)}::uuid
    );
  `);

  assert.equal(psql('SET ROLE app_user; SELECT count(*) FROM public.email_logs; RESET ROLE;'), '0');
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.email_logs; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.sender_domains; RESET ROLE; COMMIT;`)),
    '0',
  );
  assert.equal(psql(`SELECT from_rewrite_domain FROM public.sender_domains WHERE site_id = ${sqlString(siteId)}::uuid;`), 'mail.letbuyy.com');
  assert.equal(psql(`SELECT reason FROM public.email_suppressions WHERE email_hash = ${sqlString(hash)};`), 'unsubscribe');

  psql(emailRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.sender_domains') IS NULL;"), 't');
  assert.equal(psql("SELECT to_regclass('public.email_suppressions') IS NULL;"), 't');
  assert.equal(psql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='email_logs' AND column_name='site_id';"), '0');
  assert.equal(psql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='email_logs' AND column_name='provider_attempts';"), '0');
  psql(foundationRollbackSql);
});
