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
const whatsappSql = readFileSync(join(repoRoot, 'database/supabase/migrations/150_executable_whatsapp_scoped.sql'), 'utf8');
const whatsappRollbackSql = readFileSync(join(repoRoot, 'database/supabase/rollback/150_executable_whatsapp_scoped.rollback.sql'), 'utf8');
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
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$ SELECT NULL::uuid $$;
    DROP ROLE IF EXISTS app_user;
    DROP ROLE IF EXISTS service_role;
    DROP ROLE IF EXISTS authenticated;
    CREATE ROLE app_user;
    CREATE ROLE service_role;
    CREATE ROLE authenticated;
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
      user_id uuid,
      custom_user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.customer_whatsapp_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      customer_email text,
      customer_phone text NOT NULL,
      direction text NOT NULL,
      template text,
      message text NOT NULL,
      provider text DEFAULT 'letbuyy_sandbox'::text NOT NULL,
      provider_message_id text,
      status text DEFAULT 'queued'::text NOT NULL,
      idempotency_key text,
      metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
      created_by uuid,
      updated_by uuid,
      deleted_by uuid,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL,
      deleted_at timestamptz,
      CONSTRAINT customer_whatsapp_messages_direction_check CHECK (direction = ANY (ARRAY['outbound','inbound']::text[])),
      CONSTRAINT customer_whatsapp_messages_status_check CHECK (status = ANY (ARRAY['queued','sent','delivered','read','failed','received']::text[])),
      CONSTRAINT customer_whatsapp_messages_template_check CHECK (template IS NULL OR template = ANY (ARRAY['order_update','shipping_update','abandoned_cart','custom_message']::text[]))
    );
    CREATE TABLE public.orders (
      id uuid PRIMARY KEY,
      store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      status text DEFAULT 'pending',
      fulfillment_state text DEFAULT 'unfulfilled',
      cod_confirmation_status text DEFAULT 'requested',
      cod_confirmed_at timestamptz,
      deleted_at timestamptz
    );
    CREATE TABLE public.cod_confirmation_requests (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'requested',
      provider text NOT NULL DEFAULT 'mock_whatsapp',
      idempotency_key text NOT NULL,
      request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      requested_at timestamptz NOT NULL DEFAULT now(),
      confirmed_at timestamptz,
      expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
  `);
  psql(foundationSql);
  psql(whatsappSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 012 WhatsApp scoped migration adds consent/session/messages, forces tenant RLS, extends templates, and rolls back on real Postgres', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'WA Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.orders (id, store_id, site_id, status, cod_confirmation_status)
      VALUES (${sqlString(orderId)}::uuid, ${sqlString(siteId)}::uuid, ${sqlString(siteId)}::uuid, 'pending', 'requested');
    INSERT INTO public.cod_confirmation_requests (site_id, order_id, idempotency_key)
      VALUES (${sqlString(siteId)}::uuid, ${sqlString(orderId)}::uuid, 'cod-request-proof-001');
    INSERT INTO public.wa_templates (
      site_id, template_key, category, body, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'cod_confirmation',
      'cod_confirmation',
      'Reply YES to confirm {{ order_number }}',
      'wa-template-proof-001'
    );
    INSERT INTO public.wa_optins (
      site_id, customer_email, customer_phone, consent_status, consent_source, accepted_at, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'customer@example.test',
      '+919999999999',
      'opted_in',
      'checkout',
      now(),
      'wa-optin-proof-001'
    );
    INSERT INTO public.wa_sessions (
      site_id, customer_phone, order_id, session_type, status, last_message_at, expires_at, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      '+919999999999',
      ${sqlString(orderId)}::uuid,
      'cod_confirmation',
      'open',
      now(),
      now() + interval '12 hours',
      'wa-session-proof-001'
    );
    INSERT INTO public.customer_whatsapp_messages (
      store_id, customer_email, customer_phone, direction, template, message, provider, provider_message_id, status, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'customer@example.test',
      '+919999999999',
      'outbound',
      'cod_confirmation',
      'Reply YES to confirm COD order LB-1',
      'letbuyy_sandbox',
      'wa_sandbox_proof_001',
      'queued',
      'wa-customer-message-proof-001'
    );
    INSERT INTO public.whatsapp_messages (
      site_id, customer_email, customer_phone, direction, template_key, body, provider, provider_message_id, status, order_id, event_type, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'customer@example.test',
      '+919999999999',
      'outbound',
      'cod_confirmation',
      'Reply YES to confirm COD order LB-1',
      'letbuyy_sandbox',
      'wa_sandbox_proof_001',
      'queued',
      ${sqlString(orderId)}::uuid,
      'wa.cod_confirmation',
      'wa-message-proof-001'
    );
  `);

  assert.equal(psql('SET ROLE app_user; SELECT count(*) FROM public.wa_optins; RESET ROLE;'), '0');
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.whatsapp_messages; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.wa_sessions; RESET ROLE; COMMIT;`)),
    '0',
  );
  assert.equal(psql(`SELECT template FROM public.customer_whatsapp_messages WHERE provider_message_id='wa_sandbox_proof_001';`), 'cod_confirmation');
  assert.equal(psql(`SELECT consent_status FROM public.wa_optins WHERE customer_phone = '+919999999999';`), 'opted_in');
  assert.equal(psql(`SELECT count(*) FROM public.whatsapp_messages WHERE provider='letbuyy_sandbox' AND provider_message_id='wa_sandbox_proof_001';`), '1');

  psql(whatsappRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.whatsapp_messages') IS NULL;"), 't');
  assert.equal(psql("SELECT to_regclass('public.wa_optins') IS NULL;"), 't');
  assert.equal(psql("SELECT to_regclass('public.wa_sessions') IS NULL;"), 't');
  assert.equal(psql("SELECT count(*) FROM public.customer_whatsapp_messages WHERE template = 'cod_confirmation';"), '0');
  psql(foundationRollbackSql);
});
