// One bootstrap for the executable Postgres suites, shaped like Supabase rather than like whatever
// a fresh `CREATE DATABASE` happens to give you.
//
// WHY THIS EXISTS
// Three separate defects reached production while the executable suite was green, and all three
// trace to the bootstrap rather than to the tests. Each difference below silently flips a result:
//
//   1. pgcrypto in `public` instead of `extensions`. An unqualified `digest(...)` or
//      `gen_random_bytes(...)` inside a function carrying `SET search_path TO 'public'` RESOLVES
//      under the old bootstrap and RAISES on Supabase. This is why the gift-card subsystem was dead
//      from baseline to migration 215 with a green suite, and why CAP-C52/CAP-C53 survived three
//      phases. (CAP-C62)
//
//   2. No `ALTER DEFAULT PRIVILEGES`. Supabase grants the four standard roles on everything created
//      in `public`; without that, a database built from these migrations leaves 147 of 458 tables
//      reachable by NO application role. Probing one returns `permission denied`, which reads
//      exactly like a live outage — F-TENANT-INV-1 nearly reported one. (CAP-C64)
//
//   3. Postgres roles are CLUSTER-global. `CREATE ROLE ... IF NOT EXISTS` inherits whatever an
//      earlier suite left behind, so this cluster's `service_role` existed WITHOUT BYPASSRLS and
//      "what can this role see" depended on which suite ran first. (CAP-C64)
//
// HOW THE SEARCH_PATH IS SET WITHOUT TOUCHING EACH SUITE
// Supabase puts `extensions` on the DATABASE-level search_path, so ordinary top-level DDL resolves
// pgcrypto while a function with its own narrow `SET search_path` does not — that asymmetry IS the
// defect class, and a harness that misses it turns a runtime failure into a migration-apply failure.
// `ALTER DATABASE` cannot name the current database directly, so it goes through `format()` and
// `current_database()`. It applies to NEW sessions; every suite runs each statement batch as its own
// `docker exec ... psql`, so the migrations that follow this bootstrap all see it.
//
// USAGE
//   import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';
//   const BOOTSTRAP_SQL = SUPABASE_FAITHFUL_BOOTSTRAP_SQL;
// A suite that needs extra fixtures should append to it, not fork it — a forked copy is how the
// three differences above spread to sixteen files in the first place.

export const SUPABASE_FAITHFUL_BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO public;

-- (1) pgcrypto and pg_trgm live in \`extensions\` on Supabase, not in \`public\`.
CREATE SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO public;

-- ...and \`extensions\` is on the DATABASE search_path, so top-level DDL resolves it while a
-- function with its own narrow search_path does not.
DO $bootstrap$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path = public, extensions', current_database());
END
$bootstrap$;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text,
    raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

-- (3) Roles are CLUSTER-global, so state the attributes rather than trusting whatever exists.
ALTER ROLE service_role NOLOGIN BYPASSRLS;
ALTER ROLE authenticated NOLOGIN NOBYPASSRLS;
ALTER ROLE anon NOLOGIN NOBYPASSRLS;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON auth.users TO service_role;

-- (2) Supabase's default privileges on the public schema. Without these, a table created by a
-- migration is unreachable by every application role and a permission error looks like an outage.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
`;
