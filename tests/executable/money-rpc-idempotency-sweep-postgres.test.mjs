// Phase R4 — sweeps the remaining five canonical money RPCs (CLAUDE.md's
// list, minus create_checkout_order, fixed in Phase R3/migration 206) for
// the defect class Phase R3 closed: a non-locking check-then-act
// idempotency guard where the only real uniqueness enforcement runs AFTER
// the mutation it was meant to prevent.
//
// W0 classification (see the phase report) found only ONE of the five —
// issue_gift_card — has that exact shape. The other four take a row lock
// (or an atomically-enforced unique constraint) BEFORE any mutation, which
// is architecturally safe. This file measures three of the five under real
// concurrency: issue_gift_card (the one at-risk RPC, classification (a)),
// plus complete_order_refund and confirm_order_payment_with_ledger — both
// classification (b), but converted from a static classification into a
// genuine measurement given their reachability (both take a caller-
// supplied, retry-stable idempotency_key from a real HTTP route) and their
// severity if wrong (a double refund moves money OUT of the business,
// explicitly the phase's own top concern). set_gift_card_status and
// restore_gift_card_on_refund are NOT measured here — see the phase report
// for why (row-locked/deterministically-keyed, money-safe by construction,
// and in set_gift_card_status's case every ledger entry it writes carries
// amount=0, so no retry count can move money).
//
// DESTRUCTIVE (full migration replay, DROP DATABASE). MUST NOT run against
// the shared letbuyy-executable-pg container — the guard below refuses.

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
    'money-rpc-idempotency-sweep-postgres.test.mjs is destructive (recreates the database and replays ' +
    'every migration). Refusing to run without LETBUYY_EXECUTABLE_PG_CONTAINER set to a dedicated, ' +
    'uniquely-named throwaway container — running it against the shared "letbuyy-executable-pg" ' +
    'container (the default every other executable test falls back to) would destroy other sessions\' ' +
    'in-progress state.',
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

// Same fix as tests/executable/checkout-order-concurrency-postgres.test.mjs
// (Phase R2): pgcrypto must live in `public`, not a separate `extensions`
// schema, because these RPCs are all SECURITY DEFINER SET search_path TO
// 'public'. One baseline function references `extensions.gen_random_bytes`
// as a schema-qualified DEFAULT (resolved at CREATE FUNCTION time), hence
// the thin wrapper.
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

let migrationCount = 0;

before(() => {
  migrationCount = bootstrapDatabase();
  psql(`
    INSERT INTO public.sites (id, name, store_name, site_type, subdomain, published)
    VALUES (${sqlString(SITE_ID)}::uuid, 'R4 Money RPC Store', 'R4 Money RPC Store', 'store', 'r4-money-rpc-store', true);
  `);
});

test('fresh fixture: migrations applied cleanly and site seeded', () => {
  assert.ok(migrationCount > 0, 'expected at least one migration to have been applied');
  const siteCount = psql(`SELECT count(*) FROM public.sites WHERE id = ${sqlString(SITE_ID)}::uuid;`);
  assert.equal(siteCount, '1');
});

// ---------------------------------------------------------------------
// Scenario 1 — issue_gift_card: classification (a), the R3 defect shape.
// Same p_code AND same p_idempotency_key, replayed concurrently. Prediction
// (recorded in W0, before this file was written): the loser will NOT get
// the winner's card back gracefully -- it will hit the code_hash unique
// constraint's ON CONFLICT DO NOTHING (0 rows), then RAISE EXCEPTION 'gift
// card code collision; retry issuance'. An idempotency-contract violation
// (a retry should succeed identically, not error), not literal double-
// money-issuance in this exact shape.
// ---------------------------------------------------------------------
function issueGiftCardSql({ code, key, initialValue = 500 }) {
  return `
    SELECT public.issue_gift_card(
      ${sqlString(SITE_ID)}::uuid,
      ${sqlString(code)},
      ${initialValue},
      'INR',
      NULL,
      '{}'::jsonb,
      NULL,
      ${sqlString(`req-${key}`)},
      ${sqlString(key)}
    );
  `;
}

test('W1a — issue_gift_card: same code + same idempotency key, 5 concurrent calls', async () => {
  // Phase R5 (2026-08-24): the `rejected > 0` assertion this test used to
  // carry encoded "the race must occur" as a requirement -- a scheduling
  // artifact, not a system property. On a cold container every call can
  // serialize naturally (each takes the early-return existence-check path
  // before any other call starts mutating), rejected=0, and the old
  // assertion failed -- observed 1 run in 4 while R4 reported 5/5 because
  // its own runs happened to all be warm. Separately, and more
  // fundamentally: this bootstrap now applies ALL migrations, including
  // Phase R5's migration 207 (the advisory-lock fix for the VARYING-code
  // defect this same RPC had -- see gift-card-issue-idempotency-postgres.
  // test.mjs). That lock also changes this SAME-code scenario's behaviour
  // permanently, not just intermittently: every concurrent caller now
  // serializes on the lock, and every one after the first sees the
  // already-committed row via the existence check and returns it
  // gracefully -- so `rejected > 0` would now fail 100% of the time, not
  // merely flake. The invariant that actually holds, cold or warm, before
  // or after 207, is money-safety: exactly one account, exactly one
  // ledger row. `rejected`/`rejectMessages` are recorded as an
  // OBSERVATION below, never an assertion (same antipattern as a
  // source-regex test that once pinned an AUTH_SECRET defect in place --
  // asserting the presence of a defect makes fixing it a test failure).
  const code = 'R4-SWEEP-GIFTCARD-CODE';
  const key = 'race:issue-gift-card:same-key';

  const attempts = await Promise.allSettled(
    Array.from({ length: 5 }, () => psqlAsync(issueGiftCardSql({ code, key }))),
  );

  const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
  const rejected = attempts.filter((a) => a.status === 'rejected');
  const rejectMessages = rejected.map((r) => r.reason.message);

  const accountCount = psql(`SELECT count(*) FROM public.gift_card_accounts WHERE site_id = ${sqlString(SITE_ID)}::uuid AND code_hash = encode(digest(${sqlString(code)}, 'sha256'), 'hex');`);
  const ledgerCount = psql(`SELECT count(*) FROM public.gift_card_ledger_entries gle JOIN public.gift_card_accounts gca ON gca.id = gle.gift_card_account_id WHERE gca.site_id = ${sqlString(SITE_ID)}::uuid AND gca.code_hash = encode(digest(${sqlString(code)}, 'sha256'), 'hex') AND gle.entry_type = 'issued';`);

  console.log(
    `[W1a] OBSERVATION (not asserted): fulfilled=${fulfilled.length} rejected=${rejected.length} ` +
    `rejectMessages=${JSON.stringify(rejectMessages)} -- accounts=${accountCount} issued-ledger-rows=${ledgerCount} ` +
    `(the money-safety invariant below is the real, always-true property; rejected count varies with ` +
    `scheduling and, since migration 207, is expected to be 0 in every run, not merely sometimes)`,
  );

  // Money-safety invariant: never more than one gift-card account or
  // 'issued' ledger row for this code, no matter how many concurrent
  // replays or how the race resolves.
  assert.equal(accountCount, '1', 'exactly one gift_card_accounts row must exist for this code — no duplicate money issuance');
  assert.equal(ledgerCount, '1', 'exactly one issued ledger entry must exist for this code');
});

// ---------------------------------------------------------------------
// Scenario 2 — complete_order_refund: classification (b). Converted from
// classification into measurement given reachability (caller-supplied,
// retry-stable idempotency_key from routes/returns.ts and
// order-execution.adapter.ts) and severity (a double refund moves real
// money out of the business). Prediction: SAFE -- the refunds-row FOR
// UPDATE lock serializes concurrent callers; exactly one succeeded-status
// transition, exactly one ledger transaction, the ledger balances.
// ---------------------------------------------------------------------
function seedRefundFixture({ orderId, paymentTxId, returnId, refundId, amount }) {
  psql(`
    INSERT INTO public.orders (id, store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, status, payment_status)
    VALUES (${sqlString(orderId)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'R4-REFUND-ORDER', 'r4-refund@example.com', '{}'::jsonb, '[]'::jsonb, 500, 500, 'confirmed', 'paid');

    INSERT INTO public.payment_transactions (id, order_id, store_id, site_id, gateway, amount, status)
    VALUES (${sqlString(paymentTxId)}::uuid, ${sqlString(orderId)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'razorpay', 500, 'captured');

    INSERT INTO public.returns (id, site_id, order_id, status, idempotency_key)
    VALUES (${sqlString(returnId)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(orderId)}::uuid, 'authorized', 'r4-return:' || ${sqlString(returnId)});

    INSERT INTO public.refunds (id, site_id, order_id, return_id, payment_transaction_id, amount, status, idempotency_key)
    VALUES (${sqlString(refundId)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(orderId)}::uuid, ${sqlString(returnId)}::uuid, ${sqlString(paymentTxId)}::uuid, ${amount}, 'pending', 'r4-refund-seed:' || ${sqlString(refundId)});

    INSERT INTO public.refund_transactions (id, site_id, order_id, payment_transaction_id, amount, status, metadata)
    VALUES (gen_random_uuid(), ${sqlString(SITE_ID)}::uuid, ${sqlString(orderId)}::uuid, ${sqlString(paymentTxId)}::uuid, ${amount}, 'pending', jsonb_build_object('refund_id', ${sqlString(refundId)}));
  `);
}

function completeRefundSql({ refundId, key }) {
  return `
    SELECT public.complete_order_refund(
      ${sqlString(refundId)}::uuid,
      NULL,
      NULL,
      NULL,
      ${sqlString(`req-${key}`)},
      ${sqlString(key)}
    );
  `;
}

test('W1b — complete_order_refund: same refund + same idempotency key, 5 concurrent calls', async () => {
  const orderId = '20000000-2000-4200-8200-000000000001';
  const paymentTxId = '20000000-2000-4200-8200-000000000002';
  const returnId = '20000000-2000-4200-8200-000000000003';
  const refundId = '20000000-2000-4200-8200-000000000004';
  const key = 'race:complete-refund:same-key';

  seedRefundFixture({ orderId, paymentTxId, returnId, refundId, amount: 500 });

  const attempts = await Promise.allSettled(
    Array.from({ length: 5 }, () => psqlAsync(completeRefundSql({ refundId, key }))),
  );

  const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
  const rejected = attempts.filter((a) => a.status === 'rejected');

  const refundStatusCount = psql(`SELECT count(*) FROM public.refunds WHERE id = ${sqlString(refundId)}::uuid AND status = 'succeeded';`);
  const ledgerTxCount = psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'refund' AND source_id = ${sqlString('refund:' + refundId)};`);
  const ledgerBalance = psql(`
    SELECT COALESCE(SUM(CASE WHEN le.side = 'debit' THEN le.amount_minor ELSE -le.amount_minor END), 0)
    FROM public.ledger_entries le
    JOIN public.ledger_transactions lt ON lt.id = le.transaction_id
    WHERE lt.source_type = 'refund' AND lt.source_id = ${sqlString('refund:' + refundId)};
  `);

  console.log(
    `[W1b] fulfilled=${fulfilled.length} rejected=${rejected.length} refundSucceeded=${refundStatusCount} ` +
    `ledgerTransactions=${ledgerTxCount} ledgerBalance=${ledgerBalance} ` +
    `(prediction: all 5 fulfilled, exactly 1 succeeded refund, exactly 1 ledger transaction, balance=0)`,
  );

  assert.equal(fulfilled.length, 5, 'complete_order_refund should be safely re-callable by every concurrent replay, not error out');
  assert.equal(rejected.length, 0, 'no concurrent replay should be rejected');
  assert.equal(refundStatusCount, '1', 'the refund must transition to succeeded exactly once (row-locked)');
  assert.equal(ledgerTxCount, '1', 'exactly one ledger transaction must exist for this refund — no double refund at the ledger layer');
  assert.equal(Number(ledgerBalance), 0, 'the refund ledger entries must balance (debits = credits), and must never imply more than one refund worth of money');
});

// ---------------------------------------------------------------------
// Scenario 3 — confirm_order_payment_with_ledger: classification (b).
// Converted from classification into measurement for the same reachability
// + severity reasons as scenario 2. Prediction: SAFE -- the nested
// confirm_order_payment call's orders FOR UPDATE lock (taken before any
// mutation, held for the whole transaction) serializes concurrent callers;
// exactly one payment_transactions row, exactly one ledger transaction.
// ---------------------------------------------------------------------
function seedPaymentOrderFixture({ orderId }) {
  psql(`
    INSERT INTO public.orders (id, store_id, site_id, order_number, customer_email, shipping_address, items, subtotal, total, status, payment_status)
    VALUES (${sqlString(orderId)}::uuid, ${sqlString(SITE_ID)}::uuid, ${sqlString(SITE_ID)}::uuid, 'R4-CONFIRM-ORDER', 'r4-confirm@example.com', '{}'::jsonb, '[]'::jsonb, 750, 750, 'pending', 'pending');
  `);
}

function confirmPaymentSql({ orderId, key, providerPaymentId }) {
  return `
    SELECT public.confirm_order_payment_with_ledger(
      ${sqlString(orderId)}::uuid,
      'razorpay',
      ${sqlString(providerPaymentId)},
      NULL,
      NULL,
      ${sqlString(`req-${key}`)},
      ${sqlString(key)}
    );
  `;
}

test('W1c — confirm_order_payment_with_ledger: same order/payment + same idempotency key, 5 concurrent calls', async () => {
  const orderId = '30000000-3000-4300-8300-000000000001';
  const key = 'race:confirm-payment:same-key';
  const providerPaymentId = 'pay_R4SweepTest';

  seedPaymentOrderFixture({ orderId });

  const attempts = await Promise.allSettled(
    Array.from({ length: 5 }, () => psqlAsync(confirmPaymentSql({ orderId, key, providerPaymentId }))),
  );

  const fulfilled = attempts.filter((a) => a.status === 'fulfilled');
  const rejected = attempts.filter((a) => a.status === 'rejected');

  const orderPaidCount = psql(`SELECT count(*) FROM public.orders WHERE id = ${sqlString(orderId)}::uuid AND payment_status = 'paid';`);
  const paymentTxCount = psql(`SELECT count(*) FROM public.payment_transactions WHERE order_id = ${sqlString(orderId)}::uuid AND gateway = 'razorpay';`);
  const ledgerTxCount = psql(`SELECT count(*) FROM public.ledger_transactions WHERE source_type = 'payment_capture' AND source_id = ${sqlString('razorpay:' + providerPaymentId)};`);
  const ledgerBalance = psql(`
    SELECT COALESCE(SUM(CASE WHEN le.side = 'debit' THEN le.amount_minor ELSE -le.amount_minor END), 0)
    FROM public.ledger_entries le
    JOIN public.ledger_transactions lt ON lt.id = le.transaction_id
    WHERE lt.source_type = 'payment_capture' AND lt.source_id = ${sqlString('razorpay:' + providerPaymentId)};
  `);

  console.log(
    `[W1c] fulfilled=${fulfilled.length} rejected=${rejected.length} orderPaid=${orderPaidCount} ` +
    `paymentTransactions=${paymentTxCount} ledgerTransactions=${ledgerTxCount} ledgerBalance=${ledgerBalance} ` +
    `(prediction: all 5 fulfilled, exactly 1 payment_transactions row, exactly 1 ledger transaction, balance=0)`,
  );

  assert.equal(fulfilled.length, 5, 'confirm_order_payment_with_ledger should be safely re-callable by every concurrent replay, not error out');
  assert.equal(rejected.length, 0, 'no concurrent replay should be rejected');
  assert.equal(orderPaidCount, '1', 'the order must be marked paid exactly once (row-locked)');
  assert.equal(paymentTxCount, '1', 'exactly one payment_transactions row must exist — no duplicate capture record');
  assert.equal(ledgerTxCount, '1', 'exactly one ledger transaction must exist for this capture — no double posting');
  assert.equal(Number(ledgerBalance), 0, 'the capture ledger entries must balance (debits = credits)');
});
