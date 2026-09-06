// Regression guard for the merchant notification-preference write path (phase DB-1, migrations
// 208/209/210). Three defects shipped together and NOTHING in this repository caught any of them:
//
//   1. `employees.created_by`/`.user_id` and `notification_preferences.user_id` still carried the
//      baseline's `REFERENCES auth.users(id)` while the gateway resolves callers through
//      `public.users_custom`, so POST /employees and PUT /notifications/preferences 500ed on every
//      call with a foreign-key violation.
//   2. `notification_preferences` dedupes through an EXPRESSION unique index
//      (`COALESCE(store_id, sentinel)`), and PostgREST's `.upsert(..., { onConflict: 'a,b,c' })` can
//      only ever emit a bare column list, which no expression index can match. Every preference
//      toggle 500ed with "there is no unique or exclusion constraint matching the ON CONFLICT
//      specification".
//
// Why the existing tests missed all of it, and what this file does differently:
//
//   - `services/api-gateway/src/__tests__/notifications.test.ts` asserts on the route's SOURCE TEXT
//     (`.from('notification_preferences')`). That string was present before the fix and after it, so
//     the test was green for the entire outage. Source-shape assertions cannot see runtime defects.
//   - `tests/executable/notifications-postgres.test.mjs` DOES use a real Postgres, but hand-writes a
//     simplified `notification_preferences` that carries no `user_id` foreign key at all. A fixture
//     that has drifted from the real schema cannot reproduce a defect that lives in the real schema.
//
// So this file never hand-writes the schema. It EXTRACTS the table, primary-key, foreign-key and
// unique-index statements from the repository's own migrations at run time and applies the real
// 208/209/210 files from disk. If someone edits the baseline, or lands a migration that repoints
// these keys back, this fixture changes with it instead of quietly testing a fossil.
//
// Reduction note: a grep across `database/supabase/migrations/*.sql` at the time of writing showed
// that ONLY `000_baseline.sql` and `148_executable_notifications_router.sql` touch these two tables,
// so extracting from those two plus applying 208/209/210 is equivalent to the full chain for the
// objects under test. `assertNoUnexpectedMigrationTouchesTheseTables` below re-checks that claim on
// every run, so a future migration cannot silently invalidate the reduction.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(repoRoot, 'database/supabase/migrations');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';

const GUARDED_TABLES = ['employees', 'notification_preferences'];
const USERS_CUSTOM = '11111111-1111-4111-8111-111111111111';
const LEGACY_AUTH_USER = '22222222-2222-4222-8222-222222222222';
const STORE = '33333333-3333-4333-8333-333333333333';

// 000_baseline.sql is ~918K and the fixture rebuilds the schema for every test, so read each
// migration once and reuse it rather than re-reading the file on each reset.
const migrationCache = new Map();
function migrationText(name) {
  if (!migrationCache.has(name)) migrationCache.set(name, readFileSync(join(migrationsDir, name), 'utf8'));
  return migrationCache.get(name);
}

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8' },
  ).trim();
}

// Runs `sql` expecting Postgres to REJECT it, and returns the error text. A statement that succeeds
// here is a failed assertion: several of the checks below are only meaningful as rejections.
function psqlExpectError(sql, what) {
  try {
    psql(sql);
  } catch (error) {
    return `${error.stderr || ''}${error.stdout || ''}`;
  }
  assert.fail(`expected Postgres to reject ${what}, but it succeeded`);
}

// Returns the full statement starting at `lines[index]`, through the line that ends in ';'.
function statementFrom(lines, index) {
  const collected = [];
  for (let i = index; i < lines.length; i += 1) {
    collected.push(lines[i]);
    if (lines[i].trimEnd().endsWith(';')) break;
  }
  return collected.join('\n');
}

// Extracts one statement out of a migration by an anchor substring. `withHeader` also pulls the
// preceding non-blank line, which is how pg_dump splits `ALTER TABLE ONLY x` from `ADD CONSTRAINT y`.
function extractStatement(sqlText, anchor, { withHeader = false } = {}) {
  const lines = sqlText.split('\n');
  const index = lines.findIndex((line) => line.includes(anchor));
  assert.ok(index >= 0, `could not find "${anchor}" — the migration changed shape, fix this fixture rather than deleting the assertion`);
  const body = statementFrom(lines, index);
  if (!withHeader) return body;
  let header = index - 1;
  while (header >= 0 && !lines[header].trim()) header -= 1;
  return `${lines[header]}\n${body}`;
}

// Re-checks the reduction this fixture depends on: only the baseline, 148, and the three DB-1
// migrations may touch the guarded tables. A new migration that does must be reflected here.
function assertNoUnexpectedMigrationTouchesTheseTables() {
  const allowed = new Set([
    '000_baseline.sql',
    '148_executable_notifications_router.sql',
    '208_employees_users_custom_fk_repoint.sql',
    '209_notification_preferences_users_custom_fk_repoint.sql',
    '210_notification_preferences_upsert_rpc.sql',
  ]);
  const offenders = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql') && !allowed.has(file))
    .filter((file) => {
      const text = migrationText(file);
      return GUARDED_TABLES.some((table) => new RegExp(`ALTER TABLE (ONLY )?public\\.${table}\\b`).test(text))
        || /FUNCTION public\.upsert_notification_preference/.test(text);
    });
  assert.deepEqual(
    offenders,
    [],
    `migration(s) ${offenders.join(', ')} now touch ${GUARDED_TABLES.join('/')} or the upsert RPC. This fixture only applies the baseline, 148 and 208-210, so it would be testing a stale schema. Extend the fixture to apply them, then add them to the allowlist.`,
  );
}

// Builds the PRE-208/209 world out of the repository's own DDL: the three tables, their primary
// keys, the stale auth.users foreign keys, and 148's expression unique index.
let preFixDdlCache = null;
function preFixDdl() {
  if (preFixDdlCache) return preFixDdlCache;
  const baseline = migrationText('000_baseline.sql');
  const notificationsRouter = migrationText('148_executable_notifications_router.sql');
  preFixDdlCache = [
    extractStatement(baseline, 'CREATE TABLE public.users_custom ('),
    extractStatement(baseline, 'CREATE TABLE public.employees ('),
    extractStatement(baseline, 'CREATE TABLE public.notification_preferences ('),
    extractStatement(baseline, 'ADD CONSTRAINT users_custom_pkey PRIMARY KEY', { withHeader: true }),
    extractStatement(baseline, 'ADD CONSTRAINT employees_pkey PRIMARY KEY', { withHeader: true }),
    extractStatement(baseline, 'ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY', { withHeader: true }),
    extractStatement(baseline, 'ADD CONSTRAINT employees_created_by_fkey', { withHeader: true }),
    extractStatement(baseline, 'ADD CONSTRAINT employees_user_id_fkey', { withHeader: true }),
    extractStatement(baseline, 'ADD CONSTRAINT notification_preferences_user_id_fkey', { withHeader: true }),
    extractStatement(notificationsRouter, 'CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_store_channel_category_uidx'),
  ].join('\n');
  return preFixDdlCache;
}

function resetToPreFixSchema() {

  psql(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA public TO public;
    -- Platform prerequisites that Supabase provides and this repository therefore never creates.
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
    END $$;
    -- Roles are CLUSTER-global, so the IF NOT EXISTS above inherits whatever an earlier suite
    -- left behind. State the attributes production actually gives them (F-HARNESS-2).
    ALTER ROLE service_role NOLOGIN BYPASSRLS;
  `);

  psql(preFixDdl());

  psql(`
    INSERT INTO public.users_custom (id, email) VALUES ('${USERS_CUSTOM}'::uuid, 'guard@example.invalid');
    INSERT INTO auth.users (id) VALUES ('${LEGACY_AUTH_USER}'::uuid);
  `);
}

function applyDb1Migrations() {
  psql(migrationText('208_employees_users_custom_fk_repoint.sql'));
  psql(migrationText('209_notification_preferences_users_custom_fk_repoint.sql'));
  psql(migrationText('210_notification_preferences_upsert_rpc.sql'));
}

function foreignKeyTargets(table) {
  const rows = psql(`
    SELECT conname || '|' || confrelid::regclass::text || '|' || confdeltype::text
    FROM pg_constraint
    WHERE conrelid = 'public.${table}'::regclass AND contype = 'f'
    ORDER BY conname;
  `);
  return rows.split('\n').filter(Boolean);
}

function preferenceRows() {
  return psql(`
    SELECT coalesce(store_id::text, 'GLOBAL') || '|' || channel || '|' || category || '|' || enabled::text
    FROM public.notification_preferences ORDER BY store_id NULLS FIRST, category;
  `).split('\n').filter(Boolean);
}

test('the fixture reduction still holds: no unlisted migration touches these tables', () => {
  assertNoUnexpectedMigrationTouchesTheseTables();
});

test('before 208/209 the baseline foreign keys reject the identity the gateway actually writes', () => {
  resetToPreFixSchema();

  // This is the exact shape of the defect DB-1 closed. It is asserted here so that the "after"
  // assertions below cannot pass vacuously against a fixture that was never broken to begin with.
  const employeesError = psqlExpectError(
    `INSERT INTO public.employees (email, role, created_by) VALUES ('s@example.invalid', 'staff', '${USERS_CUSTOM}'::uuid);`,
    'an employees insert carrying a users_custom id while the baseline FK is in force',
  );
  assert.match(employeesError, /employees_created_by_fkey/);

  const preferencesError = psqlExpectError(
    `INSERT INTO public.notification_preferences (user_id, channel, category, enabled) VALUES ('${USERS_CUSTOM}'::uuid, 'email', 'orders', true);`,
    'a notification_preferences insert carrying a users_custom id while the baseline FK is in force',
  );
  assert.match(preferencesError, /notification_preferences_user_id_fkey/);
});

test('migrations 208 and 209 repoint every stale key to users_custom and keep the documented delete rules', () => {
  resetToPreFixSchema();
  applyDb1Migrations();

  // confdeltype: 'n' = SET NULL, 'c' = CASCADE. 208's header states created_by moves to SET NULL
  // (attribution must not block deleting an account) while user_id keeps CASCADE (the employee row
  // IS that account's staff record). Asserting the delete rule, not just the target, keeps a future
  // "fix" from silently changing deletion semantics.
  assert.deepEqual(foreignKeyTargets('employees'), [
    'employees_created_by_fkey|users_custom|n',
    'employees_user_id_fkey|users_custom|c',
  ]);
  assert.deepEqual(foreignKeyTargets('notification_preferences'), [
    'notification_preferences_user_id_fkey|users_custom|c',
  ]);
});

test('after the repoint a users_custom id is accepted and a legacy auth.users id is rejected', () => {
  resetToPreFixSchema();
  applyDb1Migrations();

  psql(`INSERT INTO public.employees (email, role, created_by) VALUES ('s@example.invalid', 'staff', '${USERS_CUSTOM}'::uuid);`);
  assert.equal(psql('SELECT count(*) FROM public.employees;'), '1');

  // The direction matters: a migration that merely DROPPED the constraint would pass the insert
  // above. Only a repoint also rejects the identity space the column no longer belongs to.
  const rejected = psqlExpectError(
    `INSERT INTO public.employees (email, role, created_by) VALUES ('legacy@example.invalid', 'staff', '${LEGACY_AUTH_USER}'::uuid);`,
    'an employees insert carrying an auth.users-only id after the repoint',
  );
  assert.match(rejected, /employees_created_by_fkey/);

  psql(`INSERT INTO public.notification_preferences (user_id, channel, category, enabled) VALUES ('${USERS_CUSTOM}'::uuid, 'email', 'shipping', true);`);
  const preferenceRejected = psqlExpectError(
    `INSERT INTO public.notification_preferences (user_id, channel, category, enabled) VALUES ('${LEGACY_AUTH_USER}'::uuid, 'email', 'orders', true);`,
    'a notification_preferences insert carrying an auth.users-only id after the repoint',
  );
  assert.match(preferenceRejected, /notification_preferences_user_id_fkey/);
});

test('migration 210 exposes upsert_notification_preference with the signature the gateway calls', () => {
  resetToPreFixSchema();
  applyDb1Migrations();

  const signature = psql(`
    SELECT pg_get_function_arguments(p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'upsert_notification_preference';
  `);
  // Argument NAMES are load-bearing: PostgREST calls this function by named parameters, so renaming
  // one in SQL without renaming it in the route breaks the call at runtime with "function does not
  // exist". tests/contracts/notification-preference-upsert-contract.test.ts pins the route side.
  assert.equal(signature, 'p_user_id uuid, p_store_id uuid, p_channel text, p_category text, p_enabled boolean');
});

test('the RPC upserts idempotently for a global and a store-scoped preference', () => {
  resetToPreFixSchema();
  applyDb1Migrations();

  const call = (storeId, enabled) => psql(
    `SELECT enabled::text FROM public.upsert_notification_preference('${USERS_CUSTOM}'::uuid, ${storeId === null ? 'NULL' : `'${storeId}'`}::uuid, 'email'::text, 'orders'::text, ${enabled});`,
  );

  assert.equal(call(null, true), 'true');
  assert.equal(call(null, false), 'false', 'a second global call must UPDATE the existing row');
  assert.equal(call(STORE, true), 'true');
  assert.equal(call(STORE, false), 'false', 'a second store-scoped call must UPDATE the existing row');

  // Two rows, not four: the expression index dedupes the NULL (global) row correctly, which a plain
  // unique constraint over the same columns would not do (two NULLs compare as distinct).
  assert.deepEqual(preferenceRows(), [
    'GLOBAL|email|orders|false',
    `${STORE}|email|orders|false`,
  ]);
});

test('the bare-column ON CONFLICT that PostgREST emits still cannot match the expression index', () => {
  resetToPreFixSchema();
  applyDb1Migrations();

  // This is why migration 210 exists at all. If someone "simplifies" the route back to
  // `.upsert(..., { onConflict: 'user_id,store_id,channel,category' })`, this is the error their
  // merchants would get on every toggle. Asserting it here keeps the reason discoverable instead of
  // buried in a migration header.
  const error = psqlExpectError(
    `INSERT INTO public.notification_preferences (user_id, store_id, channel, category, enabled)
     VALUES ('${USERS_CUSTOM}'::uuid, NULL, 'email', 'orders', true)
     ON CONFLICT (user_id, store_id, channel, category) DO UPDATE SET enabled = EXCLUDED.enabled;`,
    'the bare-column ON CONFLICT that PostgREST upsert emits',
  );
  assert.match(error, /no unique or exclusion constraint matching the ON CONFLICT specification/);
});

test('the fixture leaves no residue for sibling executable tests', () => {
  psql('DROP SCHEMA IF EXISTS auth CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  assert.equal(psql("SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'auth';"), '0');
});
