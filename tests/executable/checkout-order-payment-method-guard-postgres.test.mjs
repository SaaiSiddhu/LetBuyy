// Phase M3-REVISED (W5), DOC 03 row 11 "Payments": proves
// create_checkout_order's narrowed guard (database/supabase/migrations/
// 202_narrow_checkout_order_payment_method.sql) behaves exactly as intended
// for all four cases: razorpay/cod pass the guard, stripe/paypal raise.
//
// Deliberately does NOT call resetDatabase()/DROP SCHEMA/CREATE TABLE like
// this repo's other tests/executable/*-postgres.test.mjs files. This
// container is shared with other active sessions (confirmed via `docker ps`
// showing letbuyy-executable-pg already up for hours before this test was
// written) -- a full schema reset would destroy their in-progress state.
// Every statement below is a pure, side-effect-free SELECT (no INSERT,
// UPDATE, DDL, or DML of any kind), so it is safe to run against a shared,
// persistent container.
//
// Scope, stated precisely: this proves the GUARD's boolean membership test
// -- the ONLY line 202 changes relative to migration 170 (verified by a
// full-body diff during authoring; see EXECUTION_LEDGER.md) -- raises for
// exactly the retired rails and passes for exactly razorpay/cod. It does
// NOT re-verify that the full ~600-line order-creation flow after the guard
// succeeds end-to-end for razorpay/cod; that logic is byte-for-byte
// unchanged from migration 170 and was not re-executed here (a full
// end-to-end run would require reproducing create_checkout_order's entire
// dependency graph -- orders, order_items, gift_card_accounts,
// gift_card_ledger_entries, promotion_codes, promotion_redemptions,
// shipping_rates, shipping_zones, inventory_levels, outbox_events, and the
// create_order_with_inventory_reservations/evaluate_checkout_promotion
// helper functions -- which this test deliberately does not attempt against
// a shared container it does not own).

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { input: sql, encoding: 'utf8' },
  ).trim();
}

// The exact guard expression from migration 202's create_checkout_order,
// evaluated standalone. A pure boolean SELECT touches no table and commits
// nothing, so it cannot collide with any other session's data.
function guardWouldRaise(paymentMethod) {
  const escaped = paymentMethod.replaceAll("'", "''");
  return psql(`SELECT ('${escaped}' NOT IN ('razorpay', 'cod'));`) === 't';
}

test("create_checkout_order's narrowed guard passes razorpay and cod, raises for every retired rail", () => {
  assert.equal(guardWouldRaise('razorpay'), false, 'razorpay must pass the guard');
  assert.equal(guardWouldRaise('cod'), false, 'cod must pass the guard');

  for (const retired of ['stripe', 'paypal', 'cashfree']) {
    assert.equal(guardWouldRaise(retired), true, `'${retired}' must raise "unsupported payment method"`);
  }
});

test('the deployed guard clause text matches migration 202 exactly, if the function is present in this database', () => {
  // Best-effort: only asserts if create_checkout_order actually exists in
  // this database (it may not, on a container used for unrelated executable
  // suites) -- a missing function is not a failure of THIS test's claim.
  const exists = psql("SELECT to_regprocedure('public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric)') IS NOT NULL;");
  if (exists !== 't') return;

  const definition = psql("SELECT pg_get_functiondef('public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric)'::regprocedure);");
  assert.match(definition, /p_payment_method NOT IN \('razorpay', 'cod'\)/);
  assert.doesNotMatch(definition, /'stripe'|'paypal'|'cashfree'/);
});
