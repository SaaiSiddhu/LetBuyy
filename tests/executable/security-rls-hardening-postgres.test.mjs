import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const migration107Sql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/107_security_rls_hardening_and_payment_uniqueness.sql'),
  'utf8',
);
const verification107Sql = readFileSync(
  join(repoRoot, 'database/supabase/verification/107_security_rls_hardening_and_payment_uniqueness.sql'),
  'utf8',
);

function psql(sql, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: `SET client_min_messages TO warning;\n${sql}`, encoding: 'utf8', ...options },
  ).trim();
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function lastPsqlLine(output) {
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
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
    DROP ROLE IF EXISTS service_role;
    DROP ROLE IF EXISTS authenticated;
    DROP ROLE IF EXISTS anon;
    CREATE ROLE service_role;
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL,
      deleted_at timestamptz
    );
    CREATE TABLE public.devices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      fingerprint text
    );
    CREATE TABLE public.sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_token text
    );
    CREATE TABLE public.users_custom (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text
    );
    CREATE TABLE public.verification_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token text
    );
    CREATE TABLE public.customer_credentials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id uuid,
      email_or_phone text,
      password_hash text
    );
    CREATE TABLE public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      title text
    );
    CREATE TABLE public.theme_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      body text
    );
    CREATE TABLE public.notification_preferences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      channel text
    );
    CREATE TABLE public.contacts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid,
      store_id uuid,
      email text
    );
    CREATE TABLE public.projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid,
      store_id uuid,
      title text
    );
    CREATE TABLE public.employee_permissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      permission text
    );
    CREATE TABLE public.payment_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      gateway text NOT NULL,
      provider_payment_id text,
      deleted_at timestamptz
    );
    ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.users_custom ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.customer_credentials ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.theme_reviews ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Service role full access" ON public.devices USING (true) WITH CHECK (true);
    CREATE POLICY "Service role full access" ON public.sessions USING (true) WITH CHECK (true);
    CREATE POLICY "Service role full access" ON public.users_custom USING (true) WITH CHECK (true);
    CREATE POLICY "Service role full access" ON public.verification_tokens USING (true) WITH CHECK (true);
    CREATE POLICY "Service role manages customer credentials" ON public.customer_credentials USING (true) WITH CHECK (true);
    CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
    CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (true);
    CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (true);
    CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE USING (true);
    CREATE POLICY "Users manage own theme reviews" ON public.theme_reviews USING (true);
    CREATE POLICY "Users manage their notification preferences" ON public.notification_preferences USING (true) WITH CHECK (true);
    CREATE POLICY users_own_notifications ON public.notification_preferences USING ((user_id = auth.uid()));

    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  `);
}

test('migration 107 applies locally and closes anon-readable sensitive RLS policies', () => {
  resetDatabase();

  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';
  const siteId = '33333333-3333-4333-8333-333333333333';

  psql(`
    INSERT INTO public.devices (fingerprint) VALUES ('device-secret');
    INSERT INTO public.sessions (session_token) VALUES ('session-secret');
    INSERT INTO public.users_custom (email) VALUES ('owner@example.com');
    INSERT INTO public.verification_tokens (token) VALUES ('token-secret');
    INSERT INTO public.customer_credentials (email_or_phone, password_hash) VALUES ('buyer@example.com', 'hash-secret');
    INSERT INTO public.notifications (user_id, title) VALUES (${sqlString(userId)}::uuid, 'owner notice'), (${sqlString(otherUserId)}::uuid, 'other notice');
    INSERT INTO public.theme_reviews (user_id, body) VALUES (${sqlString(userId)}::uuid, 'owner review'), (${sqlString(otherUserId)}::uuid, 'other review');
    INSERT INTO public.notification_preferences (user_id, channel) VALUES (${sqlString(userId)}::uuid, 'email'), (${sqlString(otherUserId)}::uuid, 'sms');
    INSERT INTO public.sites (id, user_id) VALUES (${sqlString(siteId)}::uuid, ${sqlString(userId)}::uuid);
    INSERT INTO public.contacts (site_id, email) VALUES (${sqlString(siteId)}::uuid, 'lead@example.com');
    INSERT INTO public.projects (site_id, title) VALUES (${sqlString(siteId)}::uuid, 'Owned project');
  `);

  assert.equal(psql('SET ROLE anon; SELECT count(*) FROM public.sessions; RESET ROLE;'), '1');
  assert.equal(psql('SET ROLE anon; SELECT count(*) FROM public.customer_credentials; RESET ROLE;'), '1');
  assert.equal(psql('SET ROLE authenticated; SELECT count(*) FROM public.notifications; RESET ROLE;'), '2');

  psql(migration107Sql);
  psql(verification107Sql);

  assert.equal(psql('SET ROLE anon; SELECT count(*) FROM public.sessions; RESET ROLE;'), '0');
  assert.equal(psql('SET ROLE anon; SELECT count(*) FROM public.customer_credentials; RESET ROLE;'), '0');
  assert.equal(psql('SET ROLE anon; SELECT count(*) FROM public.devices; RESET ROLE;'), '0');

  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', ${sqlString(userId)}, true); SELECT count(*) FROM public.notifications; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', ${sqlString(otherUserId)}, true); SELECT count(*) FROM public.theme_reviews; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', ${sqlString(userId)}, true); SELECT count(*) FROM public.contacts; RESET ROLE; COMMIT;`)),
    '1',
  );
  assert.equal(
    lastPsqlLine(psql(`BEGIN; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', ${sqlString(otherUserId)}, true); SELECT count(*) FROM public.projects; RESET ROLE; COMMIT;`)),
    '0',
  );

  assert.equal(
    psql(`
      SELECT count(*)
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND tablename = 'payment_transactions'
         AND indexname = 'idx_payment_transactions_provider_payment_global';
    `),
    '1',
  );
});
