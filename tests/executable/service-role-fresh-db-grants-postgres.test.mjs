// F-GRANT-1 — on a database built from the migrations, service_role must reach every public table.
//
// service_role is the role behind the gateway's getSupabaseAdmin client, the queue workers and the webhook
// service. On a real local Supabase (CLI 2.111, image postgres:17.6.1.156) with 000..253 applied it held no
// SELECT on 146 public tables and 2 views, and POST /v1/auth/custom/users/by-email returned
//     42501 permission denied for table users_custom
// so identity lookup, signup and login failed. The cause is Supabase's default privileges. The schema was written
// against the old default, which granted every API role everything on each table postgres creates in public. The
// current image grants them only the reference, trigger and maintenance class (pg_default_acl reads
// `service_role=Dxtm/postgres`). Migration 254 grants the missing privileges by name.
//
// No suite could see this: supabase-faithful-bootstrap.mjs installs the OLD default for every API role. This suite
// therefore builds the database both ways. CURRENT_DEFAULT_BOOTSTRAP_SQL replaces those three lines with the
// default ACL measured on the current image. The unmodified bootstrap stands in for a database built under the old
// default, where 254 must change nothing. Each case runs on a TEMPLATE copy of a database migrated to just
// before 254, so no case sees another's grants.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const baseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_service_role_grants';
const SHARED_DATABASE = 'letbuyy_executable';
const skip = baseName !== SHARED_DATABASE
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

const CURRENT_AT_253 = `${baseName}_cur253`;
const LEGACY_AT_253 = `${baseName}_leg253`;
const CASE_DB = `${baseName}_case`;

const MIGRATION_SUFFIX = '_service_role_table_grants.sql';
const migrationsDir = join(repoRoot, 'database/supabase/migrations');
const migrationName = readdirSync(migrationsDir).find((name) => name.endsWith(MIGRATION_SUFFIX));
const MIGRATION = `database/supabase/migrations/${migrationName}`;
const ROLLBACK = `database/supabase/rollback/${migrationName.replace(/\.sql$/, '.rollback.sql')}`;
const migrationNumber = (name) => parseInt(name.match(/^(\d+)/)?.[1] ?? '0', 10);
const MIGRATION_NUMBER = migrationNumber(migrationName);

// The default ACL the current image installs for objects postgres creates in public, measured on
// postgres:17.6.1.156 with pg_default_acl: tables `Dxtm` (MAINTAIN is PG17-only; this harness runs 16),
// sequences `w`, and functions EXECUTE for postgres alone.
const LEGACY_DEFAULT_LINES = [
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;',
];
const CURRENT_DEFAULT_LINES = [
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT REFERENCES, TRIGGER, TRUNCATE ON TABLES TO anon, authenticated, service_role;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT UPDATE ON SEQUENCES TO anon, authenticated, service_role;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;',
];
const CURRENT_DEFAULT_BOOTSTRAP_SQL = LEGACY_DEFAULT_LINES.reduce(
    (sql, line, i) => sql.replace(line, CURRENT_DEFAULT_LINES[i]),
    SUPABASE_FAITHFUL_BOOTSTRAP_SQL,
);

function psql(sql, database) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ).trim();
}

// For the cases that must read a NOTICE or an error message rather than stop at it.
function psqlResult(sql, database) {
    const result = spawnSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    );
    return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr };
}

const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
const readRepo = (relativePath) => stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8'));

function listMigrations() {
    return readdirSync(migrationsDir)
        .filter((n) => n.endsWith('.sql'))
        .sort((a, b) => migrationNumber(a) - migrationNumber(b) || a.localeCompare(b));
}

function recreate(database, fromTemplate = null) {
    psql(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`, 'postgres');
    psql(`CREATE DATABASE "${database}"${fromTemplate ? ` TEMPLATE "${fromTemplate}"` : ''};`, 'postgres');
}

function buildJustBefore254(database, bootstrapSql) {
    recreate(database);
    psql(bootstrapSql, database);
    for (const name of listMigrations().filter((n) => migrationNumber(n) < MIGRATION_NUMBER)) {
        try {
            psql(readRepo(`database/supabase/migrations/${name}`), database);
        } catch (error) {
            throw new Error(`migration ${name} failed to apply: ${error.message}`);
        }
    }
}

// Every privilege on every public relation, table-level and column-level, as the catalog stores it.
function snapshot(database) {
    return JSON.parse(psql(`
    SELECT json_build_object(
      'relations', (SELECT json_object_agg(c.relname, coalesce(array_to_string(c.relacl, ' '), '') ORDER BY c.relname)
                      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')),
      'columns', (SELECT coalesce(json_object_agg(c.relname || '.' || a.attname, array_to_string(a.attacl, ' ')
                                                  ORDER BY c.relname, a.attname), '{}'::json)
                    FROM pg_attribute a
                    JOIN pg_class c ON c.oid = a.attrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL)
    )::text;`, database));
}

function unreadable(database) {
    const out = psql(`
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
       AND NOT has_table_privilege('service_role', c.oid, 'SELECT')
     ORDER BY c.relname;`, database);
    return out ? out.split('\n') : [];
}

function privileges(database, relation) {
    return psql(`
    SELECT concat_ws('',
      CASE WHEN has_table_privilege('service_role', 'public.${relation}', 'SELECT') THEN 'S' END,
      CASE WHEN has_table_privilege('service_role', 'public.${relation}', 'INSERT') THEN 'I' END,
      CASE WHEN has_table_privilege('service_role', 'public.${relation}', 'UPDATE') THEN 'U' END,
      CASE WHEN has_table_privilege('service_role', 'public.${relation}', 'DELETE') THEN 'D' END);`, database);
}

// The two static lists 254 grants on, read from the migration itself: one GRANT for tables, one for views.
const migrationSql = readFileSync(join(repoRoot, MIGRATION), 'utf8');
const listAfter = (marker) => {
    const start = migrationSql.indexOf(marker);
    assert.ok(start >= 0, `254 no longer contains "${marker}"`);
    const body = migrationSql.slice(start + marker.length, migrationSql.indexOf('TO service_role;', start));
    return [...body.matchAll(/public\.([a-z0-9_]+)/g)].map((m) => m[1]);
};
const LISTED_TABLES = listAfter('GRANT SELECT, INSERT, UPDATE, DELETE ON');
const LISTED_VIEWS = listAfter('  GRANT SELECT ON');
const LISTED = [...LISTED_TABLES, ...LISTED_VIEWS].sort();

// The money fences of 165 and 236 revoke explicitly, so they read the same under either default.
const MONEY_FENCES = {
    ad_campaigns: 'SD',
    ad_credit_accounts: 'S',
    ad_credit_ledger_entries: 'S',
    ledger_entries: 'SI',
    ledger_transactions: 'SI',
    loyalty_accounts: 'S',
    loyalty_ledger_entries: 'S',
};

before(() => {
    if (skip) return;
    for (const line of LEGACY_DEFAULT_LINES) {
        assert.ok(SUPABASE_FAITHFUL_BOOTSTRAP_SQL.includes(line), `the shared bootstrap no longer contains: ${line}`);
        assert.ok(!CURRENT_DEFAULT_BOOTSTRAP_SQL.includes(line), `the current-default bootstrap still contains: ${line}`);
    }
    buildJustBefore254(CURRENT_AT_253, CURRENT_DEFAULT_BOOTSTRAP_SQL);
    buildJustBefore254(LEGACY_AT_253, SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
});

after(() => {
    if (skip) return;
    for (const database of [CASE_DB, CURRENT_AT_253, LEGACY_AT_253]) {
        psql(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`, 'postgres');
    }
});

test('under the current default, the backend role cannot read exactly the relations 254 lists — users_custom among them', { skip }, () => {
    assert.equal(LISTED_TABLES.length, 146);
    assert.deepEqual(LISTED_VIEWS, ['commerce_analytics_daily_mv', 'stores']);
    assert.deepEqual(unreadable(CURRENT_AT_253), LISTED, 'the list must be complete and must not name anything already readable');

    const probe = psqlResult('SET ROLE service_role; SELECT count(*) FROM public.users_custom;', CURRENT_AT_253);
    assert.notEqual(probe.status, 0);
    assert.match(probe.stderr, /permission denied for table users_custom/);
});

test('254 grants the listed relations and nothing else, keeps every money fence, and is idempotent', { skip }, () => {
    recreate(CASE_DB, CURRENT_AT_253);
    const before254 = snapshot(CASE_DB);
    psql(readRepo(MIGRATION), CASE_DB);
    const after254 = snapshot(CASE_DB);

    assert.deepEqual(unreadable(CASE_DB), []);
    for (const relation of LISTED_TABLES) assert.equal(privileges(CASE_DB, relation), 'SIUD', relation);
    for (const relation of LISTED_VIEWS) assert.match(privileges(CASE_DB, relation), /^S/, relation);
    for (const [relation, acl] of Object.entries(before254.relations)) {
        if (!LISTED.includes(relation)) assert.equal(after254.relations[relation], acl, `${relation} must not change`);
    }
    assert.deepEqual(after254.columns, before254.columns, 'no column-level grant may change (ad_campaigns keeps its fence)');
    for (const [relation, expected] of Object.entries(MONEY_FENCES)) {
        assert.equal(privileges(CASE_DB, relation), expected, `money fence on ${relation}`);
    }

    assert.match(psql('SET ROLE service_role; SELECT count(*) FROM public.users_custom;', CASE_DB), /^\d+$/,
        'the read that returned 42501 at 253 now succeeds');

    psql(readRepo(MIGRATION), CASE_DB);
    assert.deepEqual(snapshot(CASE_DB), after254, 'applying 254 twice changes nothing');
});

test('the rollback returns to the exact privileges before 254, and 254 applies again after it', { skip }, () => {
    recreate(CASE_DB, CURRENT_AT_253);
    const before254 = snapshot(CASE_DB);
    psql(readRepo(MIGRATION), CASE_DB);
    const after254 = snapshot(CASE_DB);

    psql(readRepo(ROLLBACK), CASE_DB);
    assert.deepEqual(snapshot(CASE_DB), before254);
    assert.deepEqual(unreadable(CASE_DB), LISTED);

    psql(readRepo(MIGRATION), CASE_DB);
    assert.deepEqual(snapshot(CASE_DB), after254);
});

test('under the old default, 254 and its rollback change nothing at all', { skip }, () => {
    recreate(CASE_DB, LEGACY_AT_253);
    const untouched = snapshot(CASE_DB);
    assert.deepEqual(unreadable(CASE_DB), [], 'the old default already lets service_role read everything');

    psql(readRepo(MIGRATION), CASE_DB);
    assert.deepEqual(snapshot(CASE_DB), untouched);

    const rollback = psqlResult(readRepo(ROLLBACK), CASE_DB);
    assert.equal(rollback.status, 0, rollback.stderr);
    assert.match(rollback.stderr, /254 granted nothing here/);
    assert.deepEqual(snapshot(CASE_DB), untouched, 'the rollback must not take away privileges 254 never granted');
});

test('CONTROL: the self-verification refuses an incomplete list and a moved money fence, and changes nothing', { skip }, () => {
    const withoutUsersCustom = readRepo(MIGRATION).replace(/^ {4}public\.users_custom,\n/m, '');
    assert.notEqual(withoutUsersCustom, readRepo(MIGRATION), 'users_custom must be in the list for this control to mean anything');
    recreate(CASE_DB, CURRENT_AT_253);
    const incomplete = psqlResult(withoutUsersCustom, CASE_DB);
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr, /254: service_role still cannot read: users_custom/);
    assert.deepEqual(unreadable(CASE_DB), LISTED, 'the failed migration must roll back whole');

    recreate(CASE_DB, CURRENT_AT_253);
    psql('GRANT UPDATE ON public.ledger_entries TO service_role;', CASE_DB);
    const movedFence = psqlResult(readRepo(MIGRATION), CASE_DB);
    assert.notEqual(movedFence.status, 0);
    assert.match(movedFence.stderr, /the money fence on public\.ledger_entries moved: service_role holds SIU, expected SI/);
});

test('the whole migration chain under the current default leaves no public relation unreadable by service_role', { skip }, () => {
    // The durable guard: a later migration that creates a table without granting it fails here, on the default
    // every new Supabase project now starts with, instead of in production.
    recreate(CASE_DB, CURRENT_AT_253);
    for (const name of listMigrations().filter((n) => migrationNumber(n) >= MIGRATION_NUMBER)) {
        psql(readRepo(`database/supabase/migrations/${name}`), CASE_DB);
    }
    assert.deepEqual(unreadable(CASE_DB), []);
});
