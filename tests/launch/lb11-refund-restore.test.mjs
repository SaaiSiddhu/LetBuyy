// LB-11 follow-up — gift-card refund restore. Redemption debits the gift-card ledger at
// checkout, but no path wrote the offsetting 'refund_credit' the balance projection already
// counts, so refunding/cancelling a gift-card-funded order destroyed the customer's balance.
// Migration 174 + the order cancel/refund transition close that gap, idempotently.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const migration = read('database/supabase/migrations/174_v1_gift_card_refund_restore.sql');
const rollback = read('database/supabase/rollback/174_v1_gift_card_refund_restore.rollback.sql');
const orders = read('services/api-gateway/src/routes/orders.ts');
const baseline = read('database/supabase/migrations/000_baseline.sql');

test('LB-11 restore: migration 174 defines restore_gift_card_on_refund (SECURITY DEFINER)', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.restore_gift_card_on_refund/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path TO 'public'/);
});

test('LB-11 restore: it writes a refund_credit ledger entry restoring the redeemed amount', () => {
  // iterates committed redemptions for the order under a row lock
  assert.match(migration, /FROM gift_card_redemptions[\s\S]{0,200}status = 'committed'[\s\S]{0,80}FOR UPDATE/);
  // writes the offsetting refund_credit entry the projection counts as +amount
  assert.match(migration, /'refund_credit'/);
  assert.match(migration, /v_redemption\.amount,\s*\n\s*v_balance \+ v_redemption\.amount/);
  // and releases the redemption
  assert.match(migration, /SET status = 'released'/);
});

test('LB-11 restore: it is idempotent (no double credit)', () => {
  // unique per-redemption idempotency key + ON CONFLICT DO NOTHING
  assert.match(migration, /'gift_card\.refund_credit:' \|\| p_order_id::text \|\| ':' \|\| v_redemption\.id::text/);
  assert.match(migration, /ON CONFLICT \(site_id, idempotency_key\) DO NOTHING/);
  // only count/release when the credit was actually written this call
  assert.match(migration, /IF FOUND THEN/);
});

test('LB-11 restore: the order cancel/refund transition invokes it (best-effort, idempotent)', () => {
  assert.match(orders, /db\.rpc\('restore_gift_card_on_refund'/);
  const handler = orders.slice(orders.indexOf("router.patch('/:id'"));
  assert.match(handler, /body\.status === 'cancelled' \|\| body\.status === 'refunded'[\s\S]{0,900}restore_gift_card_on_refund/);
  assert.match(handler, /gift_card_refund_restore_failed/);
});

test('LB-11 restore: the canonical refund function is NOT modified by 174', () => {
  // 174 must not redefine complete_order_refund / create_checkout_order (validator-pinned)
  assert.doesNotMatch(migration, /CREATE (OR REPLACE )?FUNCTION public\.complete_order_refund/);
  assert.doesNotMatch(migration, /CREATE (OR REPLACE )?FUNCTION public\.create_checkout_order/);
  // baseline redemption still only debits (restore is additive, separate function)
  assert.match(baseline, /'debit'/);
});

test('LB-11 restore: rollback drops the function', () => {
  assert.match(rollback, /DROP FUNCTION IF EXISTS public\.restore_gift_card_on_refund/);
});
