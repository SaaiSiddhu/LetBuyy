// F-SEARCHPATH-1 — a SECURITY DEFINER function with a narrow search_path may not call an
// extension-schema function unqualified.
//
// TWO THINGS ARE UNDER TEST, AND THE SECOND IS THE IMPORTANT ONE.
//
// 1. `claim_runtime_lease` and `claim_distributed_queue_messages` call `gen_random_bytes(...)`
//    unqualified under `SET search_path TO 'public'`. On Supabase pgcrypto lives in `extensions`,
//    so both raise on every call. Migration 244 qualifies them.
//
// 2. Every other executable suite in this repository bootstraps `CREATE EXTENSION pgcrypto` with no
//    `WITH SCHEMA`, which installs it into `public`. Under that layout the unqualified call
//    resolves and the defect CANNOT reproduce. That is why this class killed the entire gift-card
//    subsystem from baseline to migration 215 while the suite stayed green, and why it survived
//    three phases as CAP-C52/CAP-C53. This suite models the schema layout Supabase actually has,
//    and proves the difference directly: the same call, on two databases, succeeds on one and
//    fails on the other.
//
// The database-wide sweep below is the durable part. It reads every function's FINAL live
// definition out of pg_get_functiondef — no reconstruction across 244 layered migration files —
// and asserts no function with a narrow search_path calls an extensions-only function unqualified.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_searchpath_qualified';
const maskedDatabaseName = `${databaseName}_masked`;
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const MIGRATION = 'database/supabase/migrations/244_qualify_extension_calls_in_queue_rpcs.sql';
const ROLLBACK = 'database/supabase/rollback/244_qualify_extension_calls_in_queue_rpcs.rollback.sql';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ).trim();
}

function psqlExpectingFailure(sql, targetDatabase = databaseName) {
    try {
        psql(sql, targetDatabase);
        return null;
    } catch (error) {
        return `${error.stderr || ''}${error.stdout || ''}`;
    }
}

const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const applySqlFile = (relativePath, targetDatabase = databaseName) =>
    psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')), targetDatabase);

function listMigrations() {
    return readdirSync(join(repoRoot, 'database/supabase/migrations'))
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

// The one line that differs from every other executable suite's bootstrap: `WITH SCHEMA extensions`.
// `faithful=false` reproduces the harness the rest of the suite uses, so the masking is testable.
const bootstrapSql = (faithful) => `
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO public;
CREATE SCHEMA extensions;
${faithful
    ? `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;`
    : `CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS $shim$ SELECT public.gen_random_bytes($1) $shim$;`}
GRANT USAGE ON SCHEMA extensions TO public;
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
-- Roles are CLUSTER-global, so CREATE ROLE ... IF NOT EXISTS above silently inherits whatever an
-- earlier suite left behind. State the attributes rather than trusting them: this cluster's
-- service_role has been found without BYPASSRLS, which changes what a role can see for a reason
-- that has nothing to do with the code under test.
ALTER ROLE service_role NOLOGIN BYPASSRLS;
ALTER ROLE authenticated NOLOGIN NOBYPASSRLS;
ALTER ROLE anon NOLOGIN NOBYPASSRLS;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON auth.users TO service_role;
`;

function bootstrapDatabase(name, faithful) {
    psql(`DROP DATABASE IF EXISTS "${name}"; CREATE DATABASE "${name}";`, 'postgres');
    // Supabase sets the DATABASE-level search_path to include `extensions`, so ordinary DDL and
    // top-level statements resolve pgcrypto fine. A function carrying `SET search_path TO 'public'`
    // overrides that and does not. Without this line the defect would look like a migration-apply
    // failure rather than the runtime failure it actually is.
    psql(`ALTER DATABASE "${name}" SET search_path = public, extensions;`, 'postgres');
    psql(bootstrapSql(faithful), name);
    for (const migration of listMigrations()) {
        const sql = stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', migration), 'utf8'));
        try {
            psql(sql, name);
        } catch (error) {
            throw new Error(`migration ${migration} failed to apply to ${name}: ${error.message}`);
        }
    }
}

// The sweep. Returns [{name, searchPath, securityDefiner, calls}] for every `public` function whose
// explicit search_path omits `extensions` and whose BODY calls an extensions-only function
// unqualified. Deliberate exclusions, each for a stated reason:
//   - the function HEADER is skipped: a DEFAULT parameter expression is evaluated in the CALLER's
//     search_path, not the function's, so `redrive_distributed_dead_letters`'s default is not a bug;
//   - a name that also exists in pg_catalog (gen_random_uuid) is skipped: pg_catalog is always on
//     the search path, so such a call resolves under any setting.
function sweepForUnqualifiedExtensionCalls(targetDatabase = databaseName) {
    const extensionOnly = psql(`
        SELECT DISTINCT p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'extensions'
          AND length(p.proname) >= 4
          AND left(p.proname, 1) <> '_'
          AND NOT EXISTS (
            SELECT 1 FROM pg_proc c JOIN pg_namespace cn ON cn.oid = c.pronamespace
            WHERE cn.nspname = 'pg_catalog' AND c.proname = p.proname
          )
        ORDER BY 1;`, targetDatabase).split('\n').filter(Boolean);

    const rows = psql(`
        SELECT p.proname || E'\\x01'
               || COALESCE(array_to_string(p.proconfig, E'\\x03'), '') || E'\\x01'
               || p.prosecdef::text || E'\\x01'
               || replace(pg_get_functiondef(p.oid), E'\\n', E'\\x02')
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proconfig IS NOT NULL
          AND EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
        ORDER BY p.proname;`, targetDatabase).split('\n').filter(Boolean);

    const offenders = [];
    for (const row of rows) {
        const [name, config, securityDefiner, encodedDefinition] = row.split('\x01');
        // proconfig is a text[]; a search_path VALUE may itself contain commas, so the elements are
        // joined with \x03 and split on that. Splitting on ',' truncates `search_path=public,
        // extensions` to `public` and manufactures a false positive — it did, before this line.
        const searchPath = (config.split('\x03').find((c) => c.startsWith('search_path=')) || '')
            .slice('search_path='.length);
        if (/(^|[,"\s])extensions([,"\s]|$)/.test(searchPath)) continue;

        const definition = encodedDefinition.replaceAll('\x02', '\n');
        const bodyStart = definition.search(/\n(?:AS|BEGIN ATOMIC)\b/i);
        const body = (bodyStart === -1 ? definition : definition.slice(bodyStart))
            .replace(/--[^\n]*/g, ' ')
            .replace(/\/\*[\s\S]*?\*\//g, ' ');

        const calls = extensionOnly.filter((fn) => new RegExp(`(^|[^.\\w"])${fn}\\s*\\(`).test(body));
        if (calls.length) offenders.push({ name, searchPath, securityDefiner: securityDefiner === 'true', calls });
    }
    return offenders;
}

const LEASE_CALL = `SELECT (public.claim_runtime_lease('worker', 'sp1-resource', 'sp1-owner', 60, 'req-1', 'corr-1')).fencing_token;`;
const CLAIM_CALL = `SELECT count(*) FROM public.claim_distributed_queue_messages('sp1-queue', 'sp1-worker', 1, 60);`;
const MISSING_FN_ERROR = 'function gen_random_bytes(integer) does not exist';

before(() => {
    if (skip) return;
    bootstrapDatabase(databaseName, true);
    bootstrapDatabase(maskedDatabaseName, false);
});

after(() => {
    if (skip) return;
    for (const name of [databaseName, maskedDatabaseName]) {
        try { psql(`DROP DATABASE IF EXISTS "${name}";`, 'postgres'); } catch { /* leave it for inspection */ }
    }
});

test('BEFORE: with 244 rolled back, both functions raise on every call', { skip }, () => {
    applySqlFile(ROLLBACK);

    const leaseError = psqlExpectingFailure(LEASE_CALL);
    assert.ok(leaseError, 'claim_runtime_lease was expected to fail without migration 244');
    assert.match(leaseError, new RegExp(MISSING_FN_ERROR.replace(/[()]/g, '\\$&')));
    // It fails while initialising its DECLARE block — before its first statement, so no argument
    // and no database state can avoid it. This is total, not conditional.
    assert.match(leaseError, /local variable initialization/);

    const claimError = psqlExpectingFailure(CLAIM_CALL);
    assert.ok(claimError, 'claim_distributed_queue_messages was expected to fail without migration 244');
    assert.match(claimError, new RegExp(MISSING_FN_ERROR.replace(/[()]/g, '\\$&')));

    applySqlFile(MIGRATION);
});

test('AFTER: with 244 applied, both functions run', { skip }, () => {
    const fencingToken = psql(LEASE_CALL);
    assert.match(fencingToken, /^[0-9a-f]{32}$/, 'the lease should carry a 16-byte hex fencing token');

    assert.equal(psql(CLAIM_CALL), '0', 'an empty queue claims nothing, but must not raise');
});

test('the fix is qualification, NOT a widened search_path', { skip }, () => {
    // Adding `extensions` to a SECURITY DEFINER function's search_path would also make the call
    // resolve, and would widen the set of schemas an attacker could shadow a name in. Assert the
    // narrow setting survived, so a later "fix" that widens it fails here.
    const rows = psql(`
        SELECT p.proname || '|' || array_to_string(p.proconfig, ' ') || '|' || p.prosecdef::text
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN ('claim_runtime_lease', 'claim_distributed_queue_messages')
        ORDER BY 1;`).split('\n');

    assert.equal(rows.length, 2);
    for (const row of rows) {
        const [name, config, securityDefiner] = row.split('|');
        assert.equal(config, 'search_path=public', `${name} should still have the narrow search_path`);
        assert.equal(securityDefiner, 'true', `${name} should still be SECURITY DEFINER`);
    }
});

test('DATABASE-WIDE: no function with a narrow search_path calls an extensions-only function unqualified', { skip }, () => {
    const offenders = sweepForUnqualifiedExtensionCalls();
    assert.deepEqual(
        offenders.map((o) => `${o.name} -> ${o.calls.join(',')}`),
        [],
        'every offender must be qualified in its own migration, not exempted here',
    );
});

test('the sweep is load-bearing: a planted offender is found, and a qualified twin is not', { skip }, () => {
    // A sweep that returns [] because it matches nothing is worthless. Plant one function with the
    // defect and one without, and require the sweep to separate them.
    psql(`
        CREATE FUNCTION public.sp1_decoy_broken() RETURNS text
            LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
            AS $decoy$ BEGIN RETURN encode(gen_random_bytes(8), 'hex'); END $decoy$;
        CREATE FUNCTION public.sp1_decoy_qualified() RETURNS text
            LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
            AS $decoy$ BEGIN RETURN encode(extensions.gen_random_bytes(8), 'hex'); END $decoy$;`);

    const found = sweepForUnqualifiedExtensionCalls().map((o) => o.name);
    assert.deepEqual(found, ['sp1_decoy_broken'], 'the sweep must find the planted defect and only it');

    // And the planted defect is a real one, not just a string the detector likes.
    const decoyError = psqlExpectingFailure(`SELECT public.sp1_decoy_broken();`);
    assert.ok(decoyError && decoyError.includes('gen_random_bytes(integer) does not exist'));
    assert.match(psql(`SELECT public.sp1_decoy_qualified();`), /^[0-9a-f]{16}$/);

    psql(`DROP FUNCTION public.sp1_decoy_broken(); DROP FUNCTION public.sp1_decoy_qualified();`);
    assert.deepEqual(sweepForUnqualifiedExtensionCalls(), []);
});

test('gen_random_uuid is correctly NOT flagged — it lives in pg_catalog too', { skip }, () => {
    // Seven functions call gen_random_uuid() unqualified under search_path=public. None is a defect:
    // pg_catalog is always on the search path. Stating this as a test keeps a future tightening of
    // the sweep from creating seven false findings and a pointless migration.
    const schemas = psql(`
        SELECT string_agg(DISTINCT n.nspname, ',' ORDER BY n.nspname)
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'gen_random_uuid';`);
    assert.ok(schemas.split(',').includes('pg_catalog'), `expected pg_catalog among: ${schemas}`);

    psql(`
        CREATE FUNCTION public.sp1_uuid_probe() RETURNS uuid
            LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
            AS $probe$ BEGIN RETURN gen_random_uuid(); END $probe$;`);
    assert.match(psql(`SELECT public.sp1_uuid_probe();`), /^[0-9a-f-]{36}$/);
    assert.deepEqual(sweepForUnqualifiedExtensionCalls(), []);
    psql(`DROP FUNCTION public.sp1_uuid_probe();`);
});

test('WHY THIS WAS INVISIBLE: the usual harness installs pgcrypto into public, and the defect vanishes', { skip }, () => {
    // The masked database is bootstrapped exactly the way every other executable suite bootstraps —
    // `CREATE EXTENSION pgcrypto` with no schema — which lands pgcrypto in `public`. Roll 244 back
    // there and the broken function SUCCEEDS. Same SQL, same Postgres, same migrations; only the
    // schema the extension was installed into differs.
    applySqlFile(ROLLBACK, maskedDatabaseName);

    const maskedResult = psql(LEASE_CALL, maskedDatabaseName);
    assert.match(maskedResult, /^[0-9a-f]{32}$/, 'under a public-installed pgcrypto the defect does not reproduce');

    // The same call, same moment, on the faithful database, after the same rollback:
    applySqlFile(ROLLBACK);
    const faithfulError = psqlExpectingFailure(LEASE_CALL);
    assert.ok(faithfulError, 'under a Supabase-shaped database the same call must fail');
    assert.match(faithfulError, new RegExp(MISSING_FN_ERROR.replace(/[()]/g, '\\$&')));

    applySqlFile(MIGRATION);
    assert.match(psql(LEASE_CALL), /^[0-9a-f]{32}$/);

    // The sharp part: on the masked database the RUNTIME failure is gone but the STATIC sweep still
    // reports both functions. Behaviour on the wrong schema layout proves nothing; reading the
    // definition proves the same thing on either layout. That is the argument for making the sweep,
    // not a behavioural test, the durable guard.
    const maskedOffenders = sweepForUnqualifiedExtensionCalls(maskedDatabaseName).map((o) => o.name);
    assert.deepEqual(maskedOffenders.sort(), ['claim_distributed_queue_messages', 'claim_runtime_lease']);

    applySqlFile(MIGRATION, maskedDatabaseName);
    assert.deepEqual(sweepForUnqualifiedExtensionCalls(maskedDatabaseName), []);
});

test('244 is replayable and its self-verification is load-bearing', { skip }, () => {
    applySqlFile(MIGRATION);
    assert.match(psql(LEASE_CALL), /^[0-9a-f]{32}$/);

    // Strip the substitution back out of a copy and the migration must REFUSE to apply. Without
    // this, the DO block at the end of 244 would be decoration.
    const decoy = readFileSync(join(repoRoot, MIGRATION), 'utf8')
        .replaceAll('extensions.gen_random_bytes(', 'gen_random_bytes(');
    const decoyError = psqlExpectingFailure(stripUnsupportedPg17Guc(decoy));
    assert.ok(decoyError, 'a copy of 244 without the qualification must fail its own verification');
    assert.match(decoyError, /did not qualify every gen_random_bytes call/);

    // That decoy left the broken definitions behind; put the real ones back and confirm.
    applySqlFile(MIGRATION);
    assert.match(psql(LEASE_CALL), /^[0-9a-f]{32}$/);
    assert.deepEqual(sweepForUnqualifiedExtensionCalls(), []);
});
