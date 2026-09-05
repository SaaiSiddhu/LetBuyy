-- Prerequisites for applying database/supabase/migrations/*.sql to a LOCAL Postgres.
--
-- Discovered by phase MIG-2 (2026-09-05) while trying to produce executable proof for migration 222.
-- With these applied first, **all 151 migrations apply with ZERO errors** on
-- `public.ecr.aws/supabase/postgres:17.6.1.156`. Without them the baseline aborts on the first
-- `extensions.` reference and 134 of 151 migrations fail in a cascade that looks like broken
-- migrations but is entirely a missing-prerequisite problem.
--
-- Why this file exists: D-11 (2026-09-05) says there is no dev/staging Supabase, so local Postgres is
-- the only database this programme has. Every phase that wants real SQL evidence needs this, and
-- rediscovering it costs an hour. It does NOT close D-11's gap -- it makes SQL and RPC behaviour
-- provable, and says nothing about Hono routing, auth middleware or anything above the database.
--
-- Usage:
--   docker run -d --name letbuyy-<phase>-pg -e POSTGRES_PASSWORD=pw public.ecr.aws/supabase/postgres:17.6.1.156
--   docker exec <c> psql -U postgres -qc "CREATE DATABASE letbuyy_<phase>;"
--   docker exec -i <c> psql -U postgres -d letbuyy_<phase> -v ON_ERROR_STOP=1 -q < scripts/dev/local-supabase-prerequisites.sql
--   for f in $(ls database/supabase/migrations/*.sql | sort -V); do
--     docker exec -i <c> psql -U postgres -d letbuyy_<phase> -v ON_ERROR_STOP=1 -q < "$f"; done
--
-- NOTE: `docker exec` needs `-i` to forward stdin. Without it a heredoc or redirect is silently
-- ignored, the setup never runs, and the failure looks like a migration defect. That cost this phase
-- several wrong turns.
--
-- These are LOCAL TEST SCAFFOLDING ONLY. auth.uid()/role()/jwt()/email() are minimal stand-ins for
-- Supabase's real implementations, adequate for exercising RLS and RPC logic and NOT a substitute for
-- them. Never apply this to a hosted project.

CREATE SCHEMA extensions;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.email', true), '') $$;
DO $$ BEGIN CREATE ROLE app_tenant NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
