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
const notificationSql = readFileSync(join(repoRoot, 'database/supabase/migrations/148_executable_notifications_router.sql'), 'utf8');
const notificationRollbackSql = readFileSync(join(repoRoot, 'database/supabase/rollback/148_executable_notifications_router.rollback.sql'), 'utf8');
const foundationRollbackSql = readFileSync(join(repoRoot, 'database/supabase/rollback/139_executable_foundation_ledger_core.rollback.sql'), 'utf8');

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8' },
  ).trim();
}

function psqlInDatabase(database, sql, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: `SET client_min_messages TO warning;\n${sql}`, encoding: 'utf8', ...options },
  ).trim();
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function lastPsqlLine(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) || '';
}

// SUSTAINED-I -- same cross-suite role/database contamination
// tenant-redteam-postgres.test.mjs's own clearRoleDependenciesInSiblingDatabases fixed
// (letbuyy-executable-suites-contaminate-each-other, EXECUTION_LEDGER.md's F-HANDOFF-1 row):
// app_user is a CLUSTER-WIDE role, but every *-postgres.test.mjs suite gets its own DATABASE,
// left standing. Postgres's DROP ROLE refuses if the role still has a grant or owns an object
// in ANY database on the cluster (pg_shdepend, cluster-wide), so once a sibling suite's
// database has granted anything to it, this file's own DROP ROLE fails with "cannot be dropped
// because some objects depend on it" even though nothing in THIS database still depends on it.
// First observed for this file by SUSTAINED-I's completed full test:behavioral run; same fix
// as SUSTAINED-H already ported to two other files.
function clearRoleDependenciesInSiblingDatabases(roles) {
  const others = psqlInDatabase('postgres', "SELECT datname FROM pg_database WHERE datname LIKE 'letbuyy\\_%' ESCAPE '\\';")
    .split('\n')
    .map((line) => line.trim())
    .filter((name) => name && name !== databaseName);
  const roleList = roles.join(', ');
  for (const database of others) {
    try {
      psqlInDatabase(database, `
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN (${roles.map(sqlString).join(', ')})) THEN
            EXECUTE 'REASSIGN OWNED BY ${roleList} TO postgres';
            EXECUTE 'DROP OWNED BY ${roleList}';
          END IF;
        END
        $$;
      `);
    } catch (err) {
      console.warn(`notifications-postgres: could not pre-clean role dependencies in ${database}: ${(err instanceof Error ? err.message : String(err)).split('\n')[0]}`);
    }
  }
}

function resetDatabase() {
  clearRoleDependenciesInSiblingDatabases(['app_user']);

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
    CREATE TABLE public.notification_preferences (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid NOT NULL,
      store_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      channel text DEFAULT 'email',
      category text DEFAULT 'system',
      enabled boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE public.notifications (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid NOT NULL,
      type text NOT NULL,
      title text NOT NULL,
      message text,
      data jsonb DEFAULT '{}'::jsonb,
      is_read boolean DEFAULT false,
      action_url text,
      created_at timestamptz DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.webhook_subscriptions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      name text NOT NULL,
      target_url text NOT NULL,
      event_types text[] DEFAULT ARRAY['*']::text[] NOT NULL,
      signing_secret text NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      failure_count integer DEFAULT 0 NOT NULL,
      last_success_at timestamptz,
      last_failure_at timestamptz,
      metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
      created_by uuid,
      updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE TABLE public.webhook_deliveries (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
      subscription_id uuid NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
      event_id uuid NOT NULL,
      event_type text NOT NULL,
      target_url text NOT NULL,
      payload jsonb DEFAULT '{}'::jsonb NOT NULL,
      status text DEFAULT 'pending' NOT NULL,
      attempts integer DEFAULT 0 NOT NULL,
      max_attempts integer DEFAULT 10 NOT NULL,
      next_attempt_at timestamptz DEFAULT now() NOT NULL,
      request_id text,
      trace_id text,
      idempotency_key text NOT NULL,
      schema_version integer DEFAULT 1 NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      UNIQUE (subscription_id, event_id)
    );
  `);
  psql(foundationSql);
  psql(notificationSql);
  psql(`
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT EXECUTE ON FUNCTION public.set_current_site_id(uuid) TO app_user;
    GRANT EXECUTE ON FUNCTION public.current_site_id() TO app_user;
  `);
}

test('Task 010 notification migration logs, suppressions, webhooks, tenant RLS, and rollback on real Postgres', () => {
  resetDatabase();
  const siteId = '11111111-1111-4111-8111-111111111111';
  const otherSiteId = '22222222-2222-4222-8222-222222222222';
  const userId = '33333333-3333-4333-8333-333333333333';
  const subscriptionId = '44444444-4444-4444-8444-444444444444';
  const eventId = '55555555-5555-4555-8555-555555555555';

  psql(`
    INSERT INTO public.sites (id, name) VALUES (${sqlString(siteId)}::uuid, 'Notify Store'), (${sqlString(otherSiteId)}::uuid, 'Other Store');
    INSERT INTO public.notification_logs (
      site_id, user_id, channel, category, template_key, recipient, status, provider, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(userId)}::uuid,
      'whatsapp',
      'order_lifecycle',
      'order.paid',
      '{"phone":"+919999999999"}'::jsonb,
      'sent',
      'letbuyy_sandbox',
      'notify-proof-001'
    );
    INSERT INTO public.notification_suppressions (
      site_id, recipient_hash, channel, category, reason, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      'recipient-hash-001',
      'whatsapp',
      'order_lifecycle',
      'user_opt_out',
      'suppress-proof-001'
    );
    INSERT INTO public.webhook_subscriptions (
      id, site_id, name, target_url, event_types, signing_secret
    ) VALUES (
      ${sqlString(subscriptionId)}::uuid,
      ${sqlString(siteId)}::uuid,
      'Merchant ERP',
      'https://merchant.example.test/webhooks',
      ARRAY['order.*','notification.*']::text[],
      'ssssssssssssssssssssssssssssssss'
    );
    INSERT INTO public.webhook_deliveries (
      site_id, subscription_id, event_id, event_type, target_url, payload, idempotency_key
    ) VALUES (
      ${sqlString(siteId)}::uuid,
      ${sqlString(subscriptionId)}::uuid,
      ${sqlString(eventId)}::uuid,
      'notification.sent',
      'https://merchant.example.test/webhooks',
      '{"ok":true}'::jsonb,
      'webhook-proof-001'
    );
  `);

  assert.equal(psql('SET ROLE app_user; SELECT count(*) FROM public.notification_logs; RESET ROLE;'), '0');
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(siteId)}::uuid); SELECT count(*) FROM public.notification_logs; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE app_user; SELECT public.set_current_site_id(${sqlString(otherSiteId)}::uuid); SELECT count(*) FROM public.webhook_subscriptions; RESET ROLE; COMMIT;`)),
    '0',
  );
  assert.equal(psql(`SELECT replay_window_seconds FROM public.webhook_subscriptions WHERE id = ${sqlString(subscriptionId)}::uuid;`), '300');
  assert.equal(psql(`SELECT nonce FROM public.webhook_deliveries WHERE event_id = ${sqlString(eventId)}::uuid;`), eventId);

  psql(notificationRollbackSql);
  assert.equal(psql("SELECT to_regclass('public.notification_logs') IS NULL;"), 't');
  assert.equal(psql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='webhook_deliveries' AND column_name='nonce';"), '0');
  assert.equal(psql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='webhook_subscriptions' AND column_name='replay_window_seconds';"), '0');
  psql(foundationRollbackSql);
});
