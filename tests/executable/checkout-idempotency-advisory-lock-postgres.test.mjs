// CHK-0 — the checkout idempotency advisory lock, proven deterministically.
//
// WHY THIS FILE EXISTS. Migration 206 closed the checkout idempotency race with one statement in
// create_checkout_order: an advisory lock keyed on (site_id, idempotency_key), taken BEFORE the
// checkout_sessions existence check. Migrations 213 and 215 each rebuilt that function from a
// pre-206 base and silently dropped the statement. The regression survived because the only guard,
// tests/executable/checkout-order-concurrency-postgres.test.mjs W1b, races five separate psql
// PROCESSES and depends on their start-up jitter overlapping the critical window: run against the
// defective function it PASSES (measured 2026-09-05: fulfilled=5, rejected=0, orders=1).
//
// This file does not race processes. It holds the window open explicitly: session A opens a
// transaction, calls create_checkout_order, and sleeps inside that still-uncommitted transaction
// while session B replays the same idempotency key. Without the lock, B's existence check cannot
// see A's uncommitted checkout_sessions row, so B builds a second order — every time, on any
// machine, at any speed. With the lock, B blocks until A commits, re-runs the existence check, and
// returns A's order. The outcome is a property of the function body, not of the scheduler.
//
// Test 3 is the load-bearing control: it applies THIS phase's own rollback (which restores 215's
// body verbatim, lock removed), watches the race reopen, then re-applies the migration. A migration
// that merely exists proves nothing; this proves the one statement inside it is what does the work.
//
// DESTRUCTIVE: recreates its database and replays every migration. It refuses to run against the
// shared container. When no dedicated container is named it SKIPS with the exact command to run it,
// rather than throwing at import — a throwing module is indistinguishable from a real failure in
// `pnpm run test:behavioral`, which is precisely how the regression above stayed invisible. The
// always-on guard for this invariant needs no database and no container: see
// tests/contracts/checkout-idempotency-lock-contract.test.ts, which runs in the default gate.

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER;
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_chk0_idempotency';

const SHARED_CONTAINER = 'letbuyy-executable-pg';
const runnable = Boolean(containerName) && containerName !== SHARED_CONTAINER;
const skip = runnable
  ? false
  : `needs a dedicated throwaway container (never ${SHARED_CONTAINER}); run: ` +
    'docker run -d --name letbuyy-chk0-pg -e POSTGRES_PASSWORD=postgres postgres:16-alpine && ' +
    'LETBUYY_EXECUTABLE_PG_CONTAINER=letbuyy-chk0-pg node --test ' +
    'tests/executable/checkout-idempotency-advisory-lock-postgres.test.mjs';

const MIGRATION = 'database/supabase/migrations/218_restore_checkout_idempotency_advisory_lock.sql';
const ROLLBACK = 'database/supabase/rollback/218_restore_checkout_idempotency_advisory_lock.rollback.sql';

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const LOCATION_ID = '33333333-3333-4333-8333-333333333333';
const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';

function psql(sql, targetDatabase = databaseName) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

// Runs a script in its own psql process without blocking the caller, so one session can hold a
// transaction open while another runs to completion.
function psqlDetached(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr.trim() || `psql exited ${code}`))));
    child.stdin.end(sql);
  });
}

const sqlString = (v) => `'${String(v).replaceAll("'", "''")}'`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 000_baseline.sql was pg_dump'd from PG17 and sets a PG17-only session GUC the pg16 fixture rejects.
const stripUnsupportedPg17Guc = (sql) => sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');

function listMigrations() {
  return readdirSync(join(repoRoot, 'database/supabase/migrations'))
    .filter((n) => n.endsWith('.sql'))
    .sort((a, b) => {
      const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
      return na - nb || a.localeCompare(b);
    });
}

// Supabase-platform objects the repo's migrations assume but do not create. pgcrypto installs into
// `public` because create_checkout_order is SECURITY DEFINER with search_path 'public'; the thin
// `extensions` wrappers exist because 000_baseline resolves schema-qualified names at CREATE time.
const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA extensions;
CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql AS $$ SELECT public.gen_random_bytes($1) $$;
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
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT ALL ON auth.users TO service_role;
`;

function bootstrapDatabase() {
  psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
  psql(BOOTSTRAP_SQL);
  for (const name of listMigrations()) {
    const sql = stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8'));
    try {
      psql(sql);
    } catch (error) {
      throw new Error(`migration ${name} failed to apply: ${error.message}`);
    }
  }
}

function seedFixtures() {
  psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
    VALUES (${sqlString(SITE_ID)}::uuid, 'CHK-0 Store', 'CHK-0 Store', 'store', 'chk0-store', true);

    INSERT INTO public.inventory_locations (id, store_id, name, is_default, status)
    VALUES (${sqlString(LOCATION_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Default', true, 'active');

    INSERT INTO public.products (id, store_id, site_id, name, price, is_active, status)
    VALUES (${sqlString(PRODUCT_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Ample stock', 500, true, 'active');

    INSERT INTO public.inventory_levels
      (store_id, product_id, location_id, available, reserved, available_quantity, reserved_quantity, committed_quantity)
    VALUES (${sqlString(SITE_ID)}::uuid, ${sqlString(PRODUCT_ID)}::uuid, ${sqlString(LOCATION_ID)}::uuid, 1000, 0, 1000, 0, 0);
  `);
}

function checkoutCall(idempotencyKey) {
  const items = JSON.stringify([{ product_id: PRODUCT_ID, variant_id: null, quantity: 1 }]);
  return `SELECT public.create_checkout_order(
    ${sqlString(SITE_ID)}::uuid, 'CHK-0 Customer', 'chk0@example.com', '9999999999', '{}'::jsonb,
    ${sqlString(items)}::jsonb, 'cod', NULL, NULL, NULL, 'standard',
    ${sqlString(idempotencyKey)}, NULL, ${sqlString(`req-${idempotencyKey}`)}, NULL, NULL
  );`;
}

const orderCount = () =>
  Number(psql(`SELECT count(*) FROM public.orders WHERE store_id = ${sqlString(SITE_ID)}::uuid AND items @> ${sqlString(`[{"product_id": "${PRODUCT_ID}"}]`)}::jsonb;`));

const liveFunctionTakesLockFirst = () =>
  psql(`
    SELECT (position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid)) > 0
            AND position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid))
                < position('FROM checkout_sessions' in pg_get_functiondef(p.oid)))
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`) === 't';

const applySqlFile = (relativePath) =>
  psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));

// Session A holds an uncommitted transaction across the window; session B replays the same key
// while A is still open. Returns the order ids each caller received and how many orders appeared.
async function racedReplay(key, holdSeconds = 5, fireAfterMs = 2000) {
  const before = orderCount();
  const a = psqlDetached(`BEGIN;\n${checkoutCall(key)}\nSELECT pg_sleep(${holdSeconds});\nCOMMIT;`);
  await sleep(fireAfterMs);
  const b = await psqlDetached(checkoutCall(key));
  const aOut = await a;
  const orderId = (out) => out.match(/"id"\s*:\s*"([0-9a-f-]{36})"/)?.[1] ?? null;
  return { created: orderCount() - before, aOrderId: orderId(aOut), bOrderId: orderId(b) };
}

before(() => {
  if (!runnable) return;
  bootstrapDatabase();
  seedFixtures();
});

test('the live create_checkout_order takes the advisory lock before its existence check', { skip }, () => {
  // Asserted against pg_get_functiondef — what Postgres would actually execute — not against a file.
  assert.equal(
    liveFunctionTakesLockFirst(),
    true,
    'after every migration applies in order, create_checkout_order must take pg_advisory_xact_lock before reading checkout_sessions',
  );
  const overloads = psql(`
    SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`);
  assert.equal(overloads, '1', 'exactly one overload may exist — a second signature would let callers reach an unlocked body');
});

test('a concurrently replayed idempotency key creates exactly one order, and both callers receive it', { skip }, async () => {
  const { created, aOrderId, bOrderId } = await racedReplay(`chk0:locked:${Date.now()}`);
  assert.equal(created, 1, 'a replayed idempotency key must create exactly one order');
  assert.ok(aOrderId, 'session A must return an order');
  assert.equal(bOrderId, aOrderId, 'the replaying caller must receive the SAME order, not a second one');
});

test('control: with the lock removed by this migration\'s own rollback, the race reopens — the statement is what does the work', { skip }, async () => {
  applySqlFile(ROLLBACK);
  assert.equal(liveFunctionTakesLockFirst(), false, 'precondition: the rollback must actually remove the lock');
  try {
    const { created, aOrderId, bOrderId } = await racedReplay(`chk0:unlocked:${Date.now()}`);
    // This is the defect 218 fixes, reproduced on demand: two orders for one idempotency key,
    // and a single checkout_sessions row because ON CONFLICT DO NOTHING swallows the second.
    assert.equal(created, 2, 'without the lock a replayed key must create a SECOND order (the regression 213/215 shipped)');
    assert.notEqual(bOrderId, aOrderId, 'the replaying caller receives a different order — not an idempotent replay');
  } finally {
    applySqlFile(MIGRATION);
  }
  assert.equal(liveFunctionTakesLockFirst(), true, 'the migration must be re-applied cleanly after the control');
  const { created } = await racedReplay(`chk0:relocked:${Date.now()}`);
  assert.equal(created, 1, 're-applying the migration must close the race again');
});
