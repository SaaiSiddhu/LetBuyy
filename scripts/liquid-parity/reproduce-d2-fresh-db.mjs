#!/usr/bin/env node
// S1/W1 — reproduces (or honestly fails to reproduce) DEFECT D2: on a database built by applying
// every migration in database/supabase/migrations/ in order, then every seed in
// database/supabase/seeds/, no `public.themes` row carries default_template->>'rendererEngine' = 'liquid'.
//
// Runs exclusively against the ephemeral fixture container managed by
// scripts/governance/foundation-ephemeral-postgres.mjs (docker exec only — no host TCP port is bound,
// so it cannot collide with any developer-run Postgres/Redis instance). This script does not start or
// stop that container; run `pnpm run foundation:pg:start` first.
//
// Supabase-managed primitives (the `auth` schema/table/functions, and the `anon`/`authenticated`/
// `service_role` roles) are provisioned by the Supabase platform, not by any repo migration. A minimal,
// clearly-labelled compatibility bootstrap is applied first so the real, unmodified migration SQL can
// run. Nothing about the theme defect logic is altered or faked.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const container = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const database = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const evidencePath = join(repoRoot, 'docs/evidence/liquid-parity/S1-W1-d2-reproduction.json');

function psql(sql, label, targetDatabase = database) {
  try {
    const stdout = execFileSync(
      'docker',
      ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
      { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    return { label, ok: true, stdout: stdout.trim() };
  } catch (error) {
    return {
      label,
      ok: false,
      stdout: (error.stdout || '').toString().trim(),
      stderr: (error.stderr || '').toString().trim(),
    };
  }
}

// A prior run's schema can accumulate thousands of objects (000_baseline.sql alone creates hundreds of
// tables/policies/triggers); `DROP SCHEMA public CASCADE` against that many objects in one transaction
// exhausts the shared lock table (`out of shared memory / max_locks_per_transaction`, a restart-only GUC
// on this container). Dropping and recreating the whole database instead resets in one cheap catalog op.
const RECREATE_DATABASE_SQL = `
DROP DATABASE IF EXISTS "${database}";
CREATE DATABASE "${database}";
`;

const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO public;

-- Supabase-managed extension placement (not a repo migration; pgcrypto/pg_trgm ship in postgres:16-alpine).
CREATE SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Supabase-managed auth schema stub (id-only + no-op auth.uid()/auth.jwt()/auth.role()) — sufficient for
-- the FK references and RLS-policy USING-clause resolution the repo migrations assume exist on Supabase.
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

-- Supabase-managed roles (not a repo migration; migrations GRANT to these by name).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON auth.users TO service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role, postgres;
-- Supabase puts extensions on the default search_path; migrations call pgcrypto's digest()/gen_random_bytes()
-- unqualified, so each new psql session (one per migration file in this script) needs the same default.
ALTER DATABASE "${database}" SET search_path TO public, extensions;
`;

// The ephemeral fixture runs postgres:16-alpine (matching every other tests/executable/*-postgres.test.mjs
// fixture in this repo); 000_baseline.sql was pg_dump'd from a PG17 server and its header sets
// `transaction_timeout`, a PG17-only GUC that PG16 rejects. Stripping this session-scoped SET (never a
// schema/data statement) does not change what the migration creates.
function stripUnsupportedPg17Guc(sql) {
  return sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
}

function listSqlFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => {
      const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
      return na - nb || a.localeCompare(b);
    })
    .map((name) => join(dir, name));
}

function main() {
  const results = { startedAt: null, steps: [], verdict: null };

  const readyCheck = execFileSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres', '-d', database], { encoding: 'utf8', stdio: 'pipe' }).trim();
  results.steps.push({ step: 'container-ready-check', ok: true, detail: readyCheck });

  console.log(`[bootstrap] recreating database ${database}`);
  const recreate = psql(RECREATE_DATABASE_SQL, 'recreate-database', 'postgres');
  results.steps.push({ step: 'recreate-database', ok: recreate.ok, stderr: recreate.stderr || undefined });
  if (!recreate.ok) {
    results.verdict = 'BLOCKED_ENVIRONMENT';
    results.blockedReason = `database recreate failed: ${recreate.stderr}`;
    writeFileSync(evidencePath, JSON.stringify(results, null, 2));
    console.error('BLOCKED_ENVIRONMENT: database recreate failed');
    console.error(recreate.stderr);
    process.exit(1);
  }

  console.log(`[bootstrap] applying Supabase-compatibility stub to ${database}`);
  const bootstrap = psql(BOOTSTRAP_SQL, 'bootstrap');
  results.steps.push({ step: 'bootstrap', ok: bootstrap.ok, stderr: bootstrap.stderr || undefined });
  if (!bootstrap.ok) {
    results.verdict = 'BLOCKED_ENVIRONMENT';
    results.blockedReason = `bootstrap failed: ${bootstrap.stderr}`;
    writeFileSync(evidencePath, JSON.stringify(results, null, 2));
    console.error('BLOCKED_ENVIRONMENT: bootstrap failed');
    console.error(bootstrap.stderr);
    process.exit(1);
  }

  const migrationFiles = listSqlFiles(join(repoRoot, 'database/supabase/migrations'));
  console.log(`[migrations] applying ${migrationFiles.length} files in order`);
  for (const file of migrationFiles) {
    const name = file.split('/').pop();
    const sql = stripUnsupportedPg17Guc(readFileSync(file, 'utf8'));
    const result = psql(sql, name);
    results.steps.push({ step: `migration:${name}`, ok: result.ok, stderr: result.ok ? undefined : result.stderr });
    if (!result.ok) {
      results.verdict = 'BLOCKED_ENVIRONMENT';
      results.blockedReason = `migration ${name} failed to apply against the bootstrapped fixture`;
      results.failedAt = name;
      writeFileSync(evidencePath, JSON.stringify(results, null, 2));
      console.error(`BLOCKED_ENVIRONMENT: migration ${name} failed`);
      console.error(result.stderr);
      process.exit(1);
    }
  }
  console.log('[migrations] all applied cleanly');

  const seedFiles = listSqlFiles(join(repoRoot, 'database/supabase/seeds'));
  console.log(`[seeds] applying ${seedFiles.length} files in order`);
  for (const file of seedFiles) {
    const name = file.split('/').pop();
    const sql = readFileSync(file, 'utf8');
    const result = psql(sql, name);
    results.steps.push({ step: `seed:${name}`, ok: result.ok, stderr: result.ok ? undefined : result.stderr });
    if (!result.ok) {
      results.verdict = 'BLOCKED_ENVIRONMENT';
      results.blockedReason = `seed ${name} failed to apply after a clean migration replay`;
      results.failedAt = name;
      writeFileSync(evidencePath, JSON.stringify(results, null, 2));
      console.error(`BLOCKED_ENVIRONMENT: seed ${name} failed`);
      console.error(result.stderr);
      process.exit(1);
    }
  }
  console.log('[seeds] all applied cleanly');

  const query = `SELECT slug, COALESCE(default_template->>'rendererEngine', '<unset>') AS renderer_engine FROM public.themes ORDER BY slug;`;
  const themeRows = psql(query, 'query-themes');
  results.steps.push({ step: 'query-themes', ok: themeRows.ok, stderr: themeRows.ok ? undefined : themeRows.stderr });
  if (!themeRows.ok) {
    results.verdict = 'BLOCKED_ENVIRONMENT';
    results.blockedReason = `query against public.themes failed after a clean migration+seed replay: ${themeRows.stderr}`;
    writeFileSync(evidencePath, JSON.stringify(results, null, 2));
    console.error('BLOCKED_ENVIRONMENT: theme query failed');
    process.exit(1);
  }

  const rows = themeRows.stdout.split('\n').filter(Boolean).map((line) => {
    const [slug, rendererEngine] = line.split('|');
    return { slug, rendererEngine };
  });
  const liquidRows = rows.filter((r) => r.rendererEngine === 'liquid');

  results.themeRows = rows;
  results.d2Reproduced = liquidRows.length === 0;
  results.verdict = liquidRows.length === 0 ? 'D2_REPRODUCED' : 'D2_NOT_REPRODUCED';
  results.summary = liquidRows.length === 0
    ? `Fresh-database replay of all ${migrationFiles.length} migrations + ${seedFiles.length} seeds produced ${rows.length} theme row(s); NONE carry rendererEngine='liquid'. D2 is confirmed: nothing renders Liquid on a fresh database.`
    : `Fresh-database replay produced ${liquidRows.length} theme row(s) with rendererEngine='liquid': ${liquidRows.map((r) => r.slug).join(', ')}. D2 did NOT reproduce as described.`;

  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, JSON.stringify(results, null, 2));
  console.log('');
  console.log(results.summary);
  console.log(`Evidence written to ${evidencePath.replace(repoRoot + '/', '')}`);
}

main();
