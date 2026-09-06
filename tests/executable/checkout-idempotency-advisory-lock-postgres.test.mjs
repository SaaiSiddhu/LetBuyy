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
import test, { after, before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_chk0_idempotency';

const SHARED_DATABASE = 'letbuyy_executable';
// TEST-1: the hazard this guards against is recreating the SHARED DATABASE, not sharing a container.
// This suite builds its own database (letbuyy_chk0_idempotency) and drops it again, so it is safe
// alongside the shared one and runs in `pnpm run test:behavioral` like every other executable suite.
// Refusing the shared CONTAINER — the inherited rule — meant these deterministic guards never ran in
// CI at all, which is exactly how the duplicate-order defect CHK-0 fixed stayed hidden for weeks.
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
  ? false
  : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
    'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

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
// The bootstrap lives in a shared, Supabase-faithful module since F-HARNESS-1: pgcrypto in
// `extensions` rather than `public`, Supabase's own ALTER DEFAULT PRIVILEGES, and role attributes
// stated rather than inherited from whichever suite created them first. See CAP-C62 and CAP-C64 —
// each of those three differences has silently flipped a test result in this repository.
const BOOTSTRAP_SQL = SUPABASE_FAITHFUL_BOOTSTRAP_SQL;

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

const overloadCount = () => psql(
  `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`);

const liveFunctionTakesLockFirst = () =>
  psql(`
    SELECT (position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid)) > 0
            AND position('pg_advisory_xact_lock' in pg_get_functiondef(p.oid))
                < position('FROM checkout_sessions' in pg_get_functiondef(p.oid)))
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`) === 't';

function psqlExpectingFailure(sql) {
  try {
    psql(sql);
    return null;
  } catch (error) {
    return `${error.stderr || ''}${error.stdout || ''}`;
  }
}

const applySqlFile = (relativePath) =>
  psql(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, relativePath), 'utf8')));

// Session A holds an uncommitted transaction across the window; session B replays the same key
// while A is still open. Returns the order ids each caller received and how many orders appeared.
async function racedReplay(key, holdSeconds = 5, fireAfterMs = 2000) {
  const before = orderCount();
  const a = psqlDetached(`BEGIN;\n${checkoutCall(key)}\nSELECT pg_sleep(${holdSeconds});\nCOMMIT;`);
  await sleep(fireAfterMs);
  let b = '';
  let bError = null;
  try {
    b = await psqlDetached(checkoutCall(key));
  } catch (error) {
    // Not always a test failure: without the advisory lock the replay can now be stopped by the
    // unique constraint migration 219 added on purchases. The caller decides what that means.
    bError = `${error.stderr || ''}${error.stdout || ''}${error.message || ''}`;
  }
  const aOut = await a;
  const orderId = (out) => out.match(/"id"\s*:\s*"([0-9a-f-]{36})"/)?.[1] ?? null;
  return { created: orderCount() - before, aOrderId: orderId(aOut), bOrderId: orderId(b), bError };
}

// TEST-1: this suite runs inside the shared container now, so it must leave nothing behind.
after(() => {
  if (!runnable) return;
  try {
    psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE);`, 'postgres');
  } catch {
    // A cleanup failure must not fail an otherwise passing suite; the next run recreates it anyway.
  }
});

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

test('control: with the lock removed from the LIVE definition, the replay fails instead of returning the order', { skip }, async () => {
  // This control used to apply migration 218's own rollback. It cannot any more, and the reason is
  // the point of F-ROLLBACK-1: that rollback restores the 18-parameter create_checkout_order that
  // was live at 218, while migration 234 has since taken the live signature to 20. CREATE OR REPLACE
  // with a different parameter list does not replace — it ADDS an overload, after which every call
  // fails `is not unique`. The rollback now refuses outright, which is correct and is asserted below.
  //
  // So the control derives the unlocked body by TRANSFORMING the live definition instead: read it
  // back with pg_get_functiondef, delete exactly the one PERFORM statement, and execute the result.
  // Same signature, so it genuinely replaces; one statement different, so what the race proves is
  // attributable to that statement and nothing else.
  const lockedDefinition = psql(
    `SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'create_checkout_order';`);

  const lockStatement = lockedDefinition
    .split('\n')
    .find((line) => line.includes('PERFORM pg_advisory_xact_lock('));
  assert.ok(lockStatement, 'the live definition must contain the advisory lock to begin with');

  const unlockedDefinition = lockedDefinition.replace(lockStatement + '\n', '');
  assert.notEqual(unlockedDefinition, lockedDefinition, 'the transform must remove something');
  assert.equal(
    lockedDefinition.length - unlockedDefinition.length,
    lockStatement.length + 1,
    'exactly one line may be removed — the control is only meaningful if nothing else changed',
  );

  psql(unlockedDefinition);
  assert.equal(liveFunctionTakesLockFirst(), false, 'precondition: the transform must actually remove the lock');
  assert.equal(overloadCount(), '1', 'and must REPLACE the function, not add a second overload');

  try {
    const { created, aOrderId, bOrderId, bError } = await racedReplay(`chk0:unlocked:${Date.now()}`);
    // What this control asserted before F-ROLLBACK-1 was that the unlocked path creates a SECOND
    // order. That is no longer what happens, and the change is worth recording rather than
    // papering over: migration 219 added `purchases_origin_idempotency_key UNIQUE (origin_site_id,
    // idempotency_key)`, so the duplicate is now stopped at the constraint. The money outcome is
    // therefore protected twice over — but the advisory lock still does real work, because without
    // it the replaying caller gets a raw constraint violation instead of the original order.
    assert.ok(aOrderId, 'the first caller must still succeed');
    assert.equal(created, 1, 'no second order is created — migration 219\'s unique constraint blocks it');
    assert.equal(bOrderId, null, 'the replaying caller receives no order at all');
    assert.ok(bError, 'the replaying caller must fail outright');
    assert.match(bError, /duplicate key value violates unique constraint "purchases_origin_idempotency_key"/);
  } finally {
    psql(lockedDefinition);
  }
  assert.equal(liveFunctionTakesLockFirst(), true, 'the locked definition must be restored after the control');
  assert.equal(overloadCount(), '1');
  const { created } = await racedReplay(`chk0:relocked:${Date.now()}`);
  assert.equal(created, 1, 'restoring the lock must close the race again');
});

test('migration 218\'s rollback refuses to run here, and says why', { skip }, () => {
  // The behaviour that replaced the old control. Asserting it keeps the reason visible: this is not
  // a rollback that stopped working, it is one that now declines an operation which used to corrupt
  // the schema silently.
  const error = psqlExpectingFailure(stripUnsupportedPg17Guc(readFileSync(join(repoRoot, ROLLBACK), 'utf8')));
  assert.ok(error, 'rollback 218 must refuse against a current database');
  assert.match(error, /rollback 218 refuses to run/);
  assert.match(error, /adds a second overload/);
  assert.equal(overloadCount(), '1', 'and must leave the live function untouched');
  assert.equal(liveFunctionTakesLockFirst(), true);
});
