import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildIdentityAuthRepair } from '../../database/supabase/deploy/identity-auth-repair.mjs';

const container = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER;
const database = process.env.LETBUYY_EXECUTABLE_PG_DATABASE;
assert.ok(container?.startsWith('letbuyy-exec-') && database, 'unique owned executable runner required');
const labels = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .Config.Labels}}', container], { encoding: 'utf8' }));
assert.equal(labels['com.letbuyy.executable-fixture'], '1');
assert.equal(labels['com.letbuyy.executable-fixture.role'], 'postgres');
assert.ok(labels['com.letbuyy.executable-fixture.run-id']);
function sql(input) {
  assert.ok(container && database && container.startsWith('letbuyy-exec-'), 'owned executable runner required');
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt'], { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
}

test('auth-only repair preserves records, validates sessions, restricts capabilities and supports safe rollback', () => {
  sql(`CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
    DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN NOBYPASSRLS; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN NOBYPASSRLS; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_tenant') THEN CREATE ROLE app_tenant NOLOGIN NOBYPASSRLS; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    ALTER ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
    ALTER ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
    ALTER ROLE app_tenant NOLOGIN NOSUPERUSER NOBYPASSRLS;
    ALTER ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
    GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, app_tenant, service_role;
    CREATE TABLE public.users_custom(id uuid PRIMARY KEY, email text NOT NULL);
    CREATE TABLE public.sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users_custom(id), token text UNIQUE NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), last_active timestamptz NOT NULL DEFAULT now());
    CREATE FUNCTION public.update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
    INSERT INTO users_custom VALUES('11111111-1111-4111-8111-111111111111','fixture@example.invalid');
    INSERT INTO sessions(user_id,token,expires_at) VALUES('11111111-1111-4111-8111-111111111111',repeat('a',64),now()+interval '1 day');`);
  assert.throws(() => sql("SELECT * FROM public.validate_and_rotate_merchant_session(repeat('a',64),false);"));
  const repair = buildIdentityAuthRepair();
  sql(repair.sql);
  assert.equal(sql('SELECT count(*) FROM users_custom;'), '1');
  assert.equal(sql('SELECT count(*) FROM sessions;'), '1');
  assert.equal(sql("SET ROLE service_role; SELECT accepted::text||':'||status FROM public.validate_and_rotate_merchant_session(repeat('a',64),false);"), 'true:accepted');
  assert.equal(sql("SET ROLE service_role; SELECT status FROM public.validate_and_rotate_merchant_session(repeat('z',64),false);"), 'missing');
  assert.equal(sql("SET ROLE service_role; SELECT status FROM public.validate_and_rotate_merchant_session('short',false);"), 'malformed');
  for (const role of ['anon','authenticated','app_tenant']) {
    assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM auth_password_set_intents;`), /permission denied/);
    assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM session_token_rotation_events;`), /permission denied/);
    assert.throws(() => sql(`SET ROLE ${role}; SELECT * FROM validate_and_rotate_merchant_session(repeat('a',64),false);`), /permission denied/);
  }
  const id = sql("SET ROLE service_role; INSERT INTO auth_password_set_intents(user_id,email,expires_at) VALUES('11111111-1111-4111-8111-111111111111','fixture@example.invalid',now()+interval '15 minutes') RETURNING id;");
  const consume = `SET ROLE service_role; WITH taken AS(UPDATE auth_password_set_intents SET used_at=now() WHERE id='${id}' AND used_at IS NULL AND deleted_at IS NULL AND expires_at>now() RETURNING id) SELECT count(*) FROM taken;`;
  assert.equal(sql(consume),'1'); assert.equal(sql(consume),'0');
  sql("UPDATE sessions SET revoked_at=now();");
  assert.equal(sql("SET ROLE service_role; SELECT status FROM validate_and_rotate_merchant_session(repeat('a',64),false);"),'revoked');
  sql("UPDATE sessions SET revoked_at=null,expires_at=now()-interval '1 minute';");
  assert.equal(sql("SET ROLE service_role; SELECT status FROM validate_and_rotate_merchant_session(repeat('a',64),false);"),'expired');
  assert.throws(() => sql(repair.sql), /refuses an already configured/);
  sql(readFileSync('database/supabase/rollback/396_password_set_intent_privileges.rollback.sql','utf8'));
  assert.throws(() => sql('SET ROLE service_role; SELECT * FROM auth_password_set_intents;'), /permission denied/);
  assert.equal(sql('SELECT count(*) FROM auth_password_set_intents;'),'1');
  sql(readFileSync('database/supabase/migrations/396_password_set_intent_privileges.sql','utf8'));
  assert.equal(sql('SET ROLE service_role; SELECT count(*) FROM auth_password_set_intents;'),'1');
});
