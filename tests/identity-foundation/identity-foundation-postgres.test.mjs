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
  join(repoRoot, 'database/supabase/migrations/159_identity_foundation_core.sql'),
  'utf8',
);
const rollbackSql = readFileSync(
  join(repoRoot, 'database/supabase/rollback/159_identity_foundation_core.rollback.sql'),
  'utf8',
);

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8' },
  ).trim();
}

function resetMinimalLegacySchema() {
  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
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
    CREATE TABLE public.sites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid,
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.verification_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.consents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.merchant_2fa_factors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.devices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.site_memberships (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.risk_signals (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      observed_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

function relationExists(table) {
  return psql(`SELECT to_regclass('public.${table}') IS NOT NULL;`) === 't';
}

function columnExists(table, column) {
  return psql(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${table}'
        AND column_name = '${column}'
    );
  `) === 't';
}

test('identity foundation migration applies and rolls back on the executable Postgres harness', () => {
  resetMinimalLegacySchema();
  psql(migrationSql);

  assert.equal(relationExists('principals'), true);
  assert.equal(relationExists('audit_events'), true);
  assert.equal(columnExists('verification_tokens', 'token_hash'), true);
  assert.equal(columnExists('site_memberships', 'org_id'), true);

  psql(rollbackSql);

  assert.equal(relationExists('principals'), false);
  assert.equal(relationExists('audit_events'), false);
  assert.equal(columnExists('verification_tokens', 'token_hash'), false);
  assert.equal(columnExists('site_memberships', 'org_id'), false);
  assert.equal(relationExists('sites'), true);
});
