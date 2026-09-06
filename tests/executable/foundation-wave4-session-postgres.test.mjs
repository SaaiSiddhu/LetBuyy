import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const migrationSql = readFileSync(
  join(repoRoot, 'database/supabase/migrations/161_foundation_session_security.sql'),
  'utf8',
);
const rollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/161_foundation_session_security.rollback.sql'),
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
    CREATE SCHEMA public;
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
    -- Roles are CLUSTER-global, so the IF NOT EXISTS above inherits whatever an earlier suite
    -- left behind. State the attributes production actually gives them (F-HARNESS-2).
    ALTER ROLE authenticated NOLOGIN NOBYPASSRLS;
    ALTER ROLE service_role NOLOGIN BYPASSRLS;
    CREATE TABLE public.users_custom (
      id uuid PRIMARY KEY,
      email text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE CASCADE,
      token text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      last_active timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  psql(migrationSql);
}

test('Wave 4 merchant session migration rotates, rejects reuse, and rolls back on fixture', () => {
  resetDatabase();
  const userId = '11111111-1111-4111-8111-111111111111';
  const sessionId = '22222222-2222-4222-8222-222222222222';
  const oldToken = 's'.repeat(64);

  psql(`
    INSERT INTO public.users_custom (id, email)
    VALUES (${sqlString(userId)}::uuid, 'merchant@example.com');

    INSERT INTO public.sessions (
      id,
      user_id,
      token,
      expires_at,
      last_active,
      created_at,
      last_rotated_at
    )
    VALUES (
      ${sqlString(sessionId)}::uuid,
      ${sqlString(userId)}::uuid,
      ${sqlString(oldToken)},
      now() + interval '1 day',
      now() - interval '5 minutes',
      now() - interval '1 day',
      now() - interval '1 day'
    );
  `);

  const rotated = psql(`
    SELECT accepted || ':' || status || ':' || rotated || ':' || (token <> ${sqlString(oldToken)})
    FROM public.validate_and_rotate_merchant_session(${sqlString(oldToken)}, true, 28800, 60);
  `);
  assert.equal(rotated, 'true:accepted:true:true');
  assert.equal(
    psql(`SELECT rotation_count || ':' || (token <> ${sqlString(oldToken)}) FROM public.sessions WHERE id = ${sqlString(sessionId)}::uuid;`),
    '1:true',
  );
  assert.equal(
    psql('SELECT count(*) FROM public.session_token_rotation_events;'),
    '1',
  );

  const reused = psql(`
    SELECT accepted || ':' || status
    FROM public.validate_and_rotate_merchant_session(${sqlString(oldToken)}, true, 28800, 60);
  `);
  assert.equal(reused, 'false:reuse_detected');
  assert.equal(
    psql(`SELECT revoked_reason FROM public.sessions WHERE id = ${sqlString(sessionId)}::uuid;`),
    'token_reuse_detected',
  );
  assert.equal(
    psql('SELECT count(*) FROM public.session_token_rotation_events WHERE reuse_detected_at IS NOT NULL;'),
    '1',
  );

  psql(rollbackSql);
  assert.equal(
    psql("SELECT to_regprocedure('public.validate_and_rotate_merchant_session(text,boolean,integer,integer)') IS NULL;"),
    't',
  );
  assert.equal(
    psql("SELECT to_regclass('public.session_token_rotation_events') IS NULL;"),
    't',
  );
  assert.equal(
    psql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'revoked_at';"),
    '0',
  );
});
