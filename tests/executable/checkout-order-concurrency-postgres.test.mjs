// Phase R2 — measures the concurrent-checkout inventory race named as
// Dimension 4's own gap in docs/evidence/production-readiness/
// 2026-08-24-readiness-evidence.md ("concurrent-checkout inventory race
// test"). Unlike tests/executable/checkout-order-payment-method-guard-
// postgres.test.mjs (deliberately read-only against the SHARED
// letbuyy-executable-pg container), this test is DESTRUCTIVE — it recreates
// the target database and applies every migration in
// database/supabase/migrations/ in order to stand up the real, unmodified
// create_checkout_order and its full dependency graph. It MUST NOT be run
// against the shared container; the guard below refuses to run against the
// default shared container name so an operator cannot accidentally destroy
// other sessions' in-progress state by forgetting the environment override.
//
// Prior art / narrowed scope (see W0 in the phase report): tests/executable/
// inventory-postgres.test.mjs already proves the LOWER-layer reserve_inventory
// RPC is race-safe on a stock=1 row via real concurrent psql processes. No
// existing test races create_checkout_order (the full, top-level order RPC)
// itself. This file targets exactly that gap, plus three properties the
// lower-layer test does not cover: idempotency under concurrent replay,
// gift-card ledger balance under a race, and tenant-scoping behavior with no
// externally-established GUC.
//
// Every RPC call below runs as the `postgres` superuser (matching every
// sibling tests/executable/*-postgres.test.mjs convention). Superusers
// bypass Postgres RLS entirely, independent of any GUC. This test therefore
// proves the RPC's own explicit PL/pgSQL logic (locking, conditional checks,
// require_inventory_site_guc) under concurrency — it does NOT prove RLS
// policy enforcement for a non-superuser caller. Stated once here rather
// than repeated per test.
//
// Not fixed here even if a defect is found: create_checkout_order is a
// change-control hotspot and a money-path RPC; any fix is a separate,
// ARB-gated change (see the phase report's W1 "if a defect is found" note).

import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before } from 'node:test';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER;
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';

if (!containerName || containerName === 'letbuyy-executable-pg') {
  throw new Error(
    'checkout-order-concurrency-postgres.test.mjs is destructive (recreates the database and ' +
    'replays every migration). Refusing to run without LETBUYY_EXECUTABLE_PG_CONTAINER set to a ' +
    'dedicated, uniquely-named throwaway container — running it against the shared ' +
    '"letbuyy-executable-pg" container (the default every other executable test falls back to) ' +
    'would destroy other sessions\' in-progress state.',
  );
}

function psql(sql, targetDatabase = databaseName, options = {}) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options },
  ).trim();
}

async function psqlAsync(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `psql exited with ${code}`));
    });
    child.stdin.end(sql);
  });
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

// 000_baseline.sql was pg_dump'd from a PG17 server and sets
// transaction_timeout, a PG17-only session GUC that the postgres:16-alpine
// fixture (matching every other tests/executable/*-postgres.test.mjs
// fixture) rejects. Stripping this session-scoped SET changes nothing about
// what the migration creates. Same fix already proven in
// scripts/liquid-parity/reproduce-d2-fresh-db.mjs.
function stripUnsupportedPg17Guc(sql) {
  return sql.replace(/^SET transaction_timeout = 0;\s*$/m, '');
}

function listMigrations() {
  return readdirSync(join(repoRoot, 'database/supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => {
      const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
      return na - nb || a.localeCompare(b);
    });
}

// Adapted from reproduce-d2-fresh-db.mjs's Supabase-compatibility bootstrap
// (auth schema/roles/extensions are Supabase-platform-managed, not a repo
// migration), with one deliberate difference: pgcrypto/pg_trgm install
// directly into `public`, not a separate `extensions` schema. D2's script
// used `extensions` and it never mattered there; it breaks here because
// create_checkout_order (and its dependents) are `SECURITY DEFINER SET
// search_path TO 'public'` — a real, deliberate hardening baked into the
// migration itself — so an unqualified digest()/gen_random_bytes() call
// inside those functions cannot see a schema-qualified `extensions.digest`.
// Only one baseline function (redrive_distributed_dead_letters, unrelated
// to checkout) references `extensions.gen_random_bytes` as a DEFAULT
// expression. That reference IS resolved at CREATE FUNCTION time (schema-
// qualified name resolution is not lazy, unlike evaluating the expression's
// value) — confirmed by a first attempt at this bootstrap that dropped the
// `extensions` schema entirely and failed migration 000_baseline.sql's
// apply with "schema extensions does not exist". Fixed by keeping a real
// `extensions` schema with a thin wrapper delegating to the pgcrypto
// installed in `public`, rather than installing pgcrypto a second time.
// The bootstrap lives in a shared, Supabase-faithful module since F-HARNESS-1: pgcrypto in
// `extensions` rather than `public`, Supabase's own ALTER DEFAULT PRIVILEGES, and role attributes
// stated rather than inherited from whichever suite created them first. See CAP-C62 and CAP-C64 —
// each of those three differences has silently flipped a test result in this repository.
const BOOTSTRAP_SQL = SUPABASE_FAITHFUL_BOOTSTRAP_SQL;

function bootstrapDatabase() {
  psql(`DROP DATABASE IF EXISTS "${databaseName}"; CREATE DATABASE "${databaseName}";`, 'postgres');
  psql(BOOTSTRAP_SQL);
  const migrations = listMigrations();
  for (const name of migrations) {
    const sql = stripUnsupportedPg17Guc(readFileSync(join(repoRoot, 'database/supabase/migrations', name), 'utf8'));
    try {
      psql(sql);
    } catch (error) {
      throw new Error(`migration ${name} failed to apply against the fresh fixture: ${error.message}`);
    }
  }
  return migrations.length;
}

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const LOCATION_ID = '33333333-3333-4333-8333-333333333333';
const PRODUCT_OVERSELL = '22222222-2222-4222-8222-222222222222';
const PRODUCT_IDEMPOTENT = '44444444-4444-4444-8444-444444444444';
const PRODUCT_GIFTCARD = '55555555-5555-4555-8555-555555555555';
const PRODUCT_TENANT = '66666666-6666-4666-8666-666666666666';
const GIFT_CARD_ID = '77777777-7777-4777-8777-777777777777';
const GIFT_CARD_CODE = 'R2-TEST-GIFTCARD';

function seedFixtures() {
  psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
    VALUES (${sqlString(SITE_ID)}::uuid, 'R2 Race Store', 'R2 Race Store', 'store', 'r2-race-store', true);

    INSERT INTO public.inventory_locations (id, store_id, name, is_default, status)
    VALUES (${sqlString(LOCATION_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Default', true, 'active');

    INSERT INTO public.products (id, store_id, site_id, name, price, is_active, status)
    VALUES
      (${sqlString(PRODUCT_OVERSELL)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Last unit', 500, true, 'active'),
      (${sqlString(PRODUCT_IDEMPOTENT)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Ample stock', 500, true, 'active'),
      (${sqlString(PRODUCT_GIFTCARD)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Gift card item', 100, true, 'active'),
      (${sqlString(PRODUCT_TENANT)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'Tenant scoping item', 500, true, 'active');

    INSERT INTO public.inventory_levels
      (store_id, product_id, location_id, available, reserved, available_quantity, reserved_quantity, committed_quantity)
    VALUES
      (${sqlString(SITE_ID)}::uuid, ${sqlString(PRODUCT_OVERSELL)}::uuid, ${sqlString(LOCATION_ID)}::uuid, 1, 0, 1, 0, 0),
      (${sqlString(SITE_ID)}::uuid, ${sqlString(PRODUCT_IDEMPOTENT)}::uuid, ${sqlString(LOCATION_ID)}::uuid, 10, 0, 10, 0, 0),
      (${sqlString(SITE_ID)}::uuid, ${sqlString(PRODUCT_GIFTCARD)}::uuid, ${sqlString(LOCATION_ID)}::uuid, 10, 0, 10, 0, 0),
      (${sqlString(SITE_ID)}::uuid, ${sqlString(PRODUCT_TENANT)}::uuid, ${sqlString(LOCATION_ID)}::uuid, 10, 0, 10, 0, 0);

    INSERT INTO public.gift_card_accounts
      (id, site_id, code_hash, code_last4, initial_value, balance, status)
    VALUES (
      ${sqlString(GIFT_CARD_ID)}::uuid,
      ${sqlString(SITE_ID)}::uuid,
      encode(digest(${sqlString(GIFT_CARD_CODE)}, 'sha256'), 'hex'),
      'ARD',
      100,
      100,
      'active'
    );

    INSERT INTO public.gift_card_ledger_entries
      (site_id, gift_card_account_id, entry_type, amount, balance_after, idempotency_key)
    VALUES (
      ${sqlString(SITE_ID)}::uuid,
      ${sqlString(GIFT_CARD_ID)}::uuid,
      'issued',
      100,
      100,
      'seed:issue:' || ${sqlString(GIFT_CARD_ID)}
    );
  `);
}

// Positional signature, migration 202 (the latest redefinition of
// create_checkout_order — 203/204/205 only reference it in comments; see
// the phase report's W0).
function checkoutSql({ productId, quantity = 1, idempotencyKey, giftCardCode = null, price = 500 }) {
  const items = JSON.stringify([{ product_id: productId, variant_id: null, quantity }]);
  return `
    SELECT public.create_checkout_order(
      ${sqlString(SITE_ID)}::uuid,
      'R2 Test Customer',
      'r2-test@example.com',
      '9999999999',
      '{}'::jsonb,
      ${sqlString(items)}::jsonb,
      'cod',
      NULL,
      NULL,
      ${giftCardCode ? sqlString(giftCardCode) : 'NULL'},
      'standard',
      ${sqlString(idempotencyKey)},
      NULL,
      ${sqlString(`req-${idempotencyKey}`)},
      NULL,
      NULL
    );
  `;
}

let migrationCount = 0;

before(() => {
  migrationCount = bootstrapDatabase();
  seedFixtures();
});

test('fresh fixture: migrations applied cleanly and fixtures seeded', () => {
  assert.ok(migrationCount > 0, 'expected at least one migration to have been applied');
  const productCount = psql(`SELECT count(*) FROM public.products WHERE store_id = ${sqlString(SITE_ID)}::uuid;`);
  assert.equal(productCount, '4');
});

test('W1a — oversell race: stock=1, two concurrent checkouts with different idempotency keys', async () => {
  const attempts = await Promise.allSettled([
    psqlAsync(checkoutSql({ productId: PRODUCT_OVERSELL, idempotencyKey: 'race:oversell:a' })),
    psqlAsync(checkoutSql({ productId: PRODUCT_OVERSELL, idempotencyKey: 'race:oversell:b' })),
  ]);

  const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
  const rejected = attempts.filter((a) => a.status === 'rejected');

  assert.equal(fulfilled.length, 1, `expected exactly one checkout to succeed, got ${fulfilled.length}`);
  assert.equal(rejected.length, 1, `expected exactly one checkout to fail, got ${rejected.length}`);
  assert.match(
    String(rejected[0]?.reason?.message || ''),
    /INSUFFICIENT_INVENTORY/,
    'the losing checkout must fail cleanly with the stock guard, not an unrelated error',
  );

  const level = psql(`
    SELECT available || ':' || reserved || ':' || committed_quantity
      FROM public.inventory_levels
     WHERE product_id = ${sqlString(PRODUCT_OVERSELL)}::uuid;
  `);
  const [available, reserved, committed] = level.split(':').map(Number);
  assert.ok(available >= 0, `available stock must never go negative, got ${available}`);
  assert.equal(available, 0, 'the single unit must be fully committed, leaving 0 available');
  assert.equal(reserved, 0, 'no dangling reservation should remain after commit');
  assert.equal(committed, 1, 'exactly one unit must be committed — never more than the stock that existed');

  const orderCount = psql(`SELECT count(*) FROM public.orders WHERE store_id = ${sqlString(SITE_ID)}::uuid AND items @> ${sqlString(`[{"product_id": "${PRODUCT_OVERSELL}"}]`)}::jsonb;`);
  assert.equal(orderCount, '1', 'exactly one order must exist for the contested item — the loser\'s order insert must have rolled back with its transaction');
});

test('W1b — idempotency under race: same idempotency key, 5 concurrent checkouts, ample stock', async () => {
  const key = 'race:idempotent:same-key';
  const attempts = await Promise.allSettled(
    Array.from({ length: 5 }, () => psqlAsync(checkoutSql({ productId: PRODUCT_IDEMPOTENT, idempotencyKey: key }))),
  );

  const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
  const rejected = attempts.filter((a) => a.status === 'rejected');

  const sessionCount = psql(`SELECT count(*) FROM public.checkout_sessions WHERE site_id = ${sqlString(SITE_ID)}::uuid AND idempotency_key = ${sqlString(key)};`);
  const orderCount = psql(`SELECT count(*) FROM public.orders WHERE store_id = ${sqlString(SITE_ID)}::uuid AND items @> ${sqlString(`[{"product_id": "${PRODUCT_IDEMPOTENT}"}]`)}::jsonb;`);

  console.log(
    `[W1b] fulfilled=${fulfilled.length} rejected=${rejected.length} ` +
    `checkout_sessions rows=${sessionCount} orders rows=${orderCount} ` +
    `(prediction: orders > 1 despite checkout_sessions staying at 1 — a real idempotency defect, not fixed here)`,
  );

  // checkout_sessions itself IS protected by a real unique constraint + ON
  // CONFLICT DO NOTHING — this assertion is expected to hold regardless.
  assert.equal(sessionCount, '1', 'checkout_sessions must have exactly one row for this idempotency key (unique-constraint-backed)');

  // This assertion encodes the REQUIRED invariant the phase asks for
  // ("the same idempotency_key replayed concurrently must produce exactly
  // one order, not two"). If W0's prediction is correct, this FAILS —
  // reported honestly in W1b's result, not silently downgraded.
  assert.equal(orderCount, '1', 'exactly one order must exist for a concurrently-replayed idempotency key');
});

test('W1c — gift-card ledger race: two concurrent full-balance redemptions against one gift card', async () => {
  const attempts = await Promise.allSettled([
    psqlAsync(checkoutSql({ productId: PRODUCT_GIFTCARD, idempotencyKey: 'race:giftcard:a', giftCardCode: GIFT_CARD_CODE, price: 100 })),
    psqlAsync(checkoutSql({ productId: PRODUCT_GIFTCARD, idempotencyKey: 'race:giftcard:b', giftCardCode: GIFT_CARD_CODE, price: 100 })),
  ]);

  const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
  const rejected = attempts.filter((a) => a.status === 'rejected');

  assert.equal(fulfilled.length, 1, `expected exactly one gift-card redemption to succeed, got ${fulfilled.length}`);
  assert.equal(rejected.length, 1, `expected exactly one gift-card redemption to fail, got ${rejected.length}`);
  assert.match(
    String(rejected[0]?.reason?.message || ''),
    /gift card has no redeemable balance/,
    'the losing redemption must fail cleanly with the balance guard',
  );

  const ledgerBalance = psql(`
    SELECT COALESCE(SUM(
      CASE
        WHEN entry_type IN ('issued', 'credit', 'refund_credit', 'release') THEN amount
        WHEN entry_type IN ('debit', 'hold', 'expire', 'fraud_hold') THEN -amount
        ELSE 0
      END
    ), 0)
    FROM public.gift_card_ledger_entries
    WHERE gift_card_account_id = ${sqlString(GIFT_CARD_ID)}::uuid;
  `);
  assert.equal(Number(ledgerBalance), 0, 'issued (100) minus exactly one debit (100) must balance to 0 — never negative, never double-spent');

  const debitCount = psql(`SELECT count(*) FROM public.gift_card_ledger_entries WHERE gift_card_account_id = ${sqlString(GIFT_CARD_ID)}::uuid AND entry_type = 'debit';`);
  assert.equal(debitCount, '1', 'exactly one debit entry must exist — the loser must not have written a ledger row');

  const redemptionCount = psql(`SELECT count(*) FROM public.gift_card_redemptions WHERE gift_card_account_id = ${sqlString(GIFT_CARD_ID)}::uuid;`);
  assert.equal(redemptionCount, '1', 'exactly one redemption row must exist');
});

test('W1d — tenant scoping: create_checkout_order called with no externally-established app.site_id GUC', async () => {
  // A brand-new psql session (no prior SET/set_config in this connection)
  // starts with app.site_id unset — the closest this test harness can get to
  // "no tenant context" for the RPC's own PL/pgSQL guard (current_site_id()/
  // require_inventory_site_guc), independent of RLS (bypassed for the
  // postgres superuser regardless of GUC state — see the file header).
  const beforeCount = psql(`SELECT count(*) FROM public.orders WHERE store_id = ${sqlString(SITE_ID)}::uuid AND items @> ${sqlString(`[{"product_id": "${PRODUCT_TENANT}"}]`)}::jsonb;`);
  assert.equal(beforeCount, '0', 'precondition: no prior order for this product');

  let outcome;
  try {
    const result = psql(checkoutSql({ productId: PRODUCT_TENANT, idempotencyKey: 'race:tenant:no-guc' }));
    outcome = { succeeded: true, result };
  } catch (error) {
    outcome = { succeeded: false, message: error.message };
  }

  const afterCount = psql(`SELECT count(*) FROM public.orders WHERE store_id = ${sqlString(SITE_ID)}::uuid AND items @> ${sqlString(`[{"product_id": "${PRODUCT_TENANT}"}]`)}::jsonb;`);

  console.log(
    `[W1d] RPC call ${outcome.succeeded ? 'SUCCEEDED' : 'FAILED'} with no externally-set app.site_id GUC; ` +
    `orders for this product before=${beforeCount} after=${afterCount}. ` +
    `Prediction: SUCCEEDED with a mutation (self-set-from-p_store_id, not "zero rows and no mutation") — ` +
    `reported as an honest finding, not asserted as pass/fail against the ideal ART-08 backstop.`,
  );

  // This test intentionally does not assert pass/fail on the ideal
  // "zero rows and no mutation" invariant — W0 predicted the RPC's own
  // self-set-GUC design does not honor it, and the phase asks for the
  // measured outcome to be reported honestly either way, not forced.
  assert.ok(typeof outcome.succeeded === 'boolean', 'the call must deterministically either succeed or fail, not hang');
});
