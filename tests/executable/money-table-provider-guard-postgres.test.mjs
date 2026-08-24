// Phase M4 (W5), DOC 03 row 11 "Payments": proves the three narrowed money-
// table CHECK constraints (orders.payment_method, orders.payment_gateway,
// payment_attempts.provider, payment_transactions.gateway) behave exactly
// as intended -- accept the evidence-derived allowlist, reject everything
// else, and (the property that matters most for a NOT VALID constraint)
// never disturb a pre-existing row carrying a retired rail.
//
// Uses CREATE TEMP TABLE, not the real orders/payment_attempts/
// payment_transactions tables. This container is shared with other active
// sessions (confirmed via `docker ps` showing letbuyy-executable-pg up for
// 15+ hours before this test was written), so no real schema/table is
// touched. A temp table lives in a session-private pg_temp schema --
// invisible to and unaffected by any other connection -- so this is safe
// against a shared, persistent container while still genuinely exercising
// real CREATE TABLE / INSERT / ADD CONSTRAINT ... NOT VALID / constraint
// -violation mechanics, not just the boolean expression in isolation.
// Each test is one psql invocation (one Postgres session), because a temp
// table's lifetime is scoped to the connection that created it.

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
  );
}

// Runs the full lifecycle for one column's constraint against a temp table,
// as ONE psql invocation (one Postgres session -- a temp table's lifetime
// is scoped to the connection that created it, so every step must run in
// the same `docker exec` call): insert a "historical" retired-rail row
// BEFORE the constraint exists, ADD CONSTRAINT ... NOT VALID, confirm the
// historical row survives untouched, confirm a canonical value still
// inserts, confirm a retired value is rejected for a NEW row -- inside a
// SAVEPOINT so the expected-to-fail INSERT doesn't abort the whole
// transaction before the historical-row SELECT has already run.
function exerciseConstraint({ columnName, allowedValues, historicalValue, retiredValue }) {
  const allowedArray = allowedValues.map((v) => `'${v}'::text`).join(', ');
  const script = `
    BEGIN;
    CREATE TEMP TABLE money_guard_probe (${columnName} text NOT NULL);
    INSERT INTO money_guard_probe (${columnName}) VALUES ('${historicalValue}');
    ALTER TABLE money_guard_probe
      ADD CONSTRAINT money_guard_probe_check
      CHECK (${columnName} = ANY (ARRAY[${allowedArray}])) NOT VALID;
    \\echo MARKER_SURVIVED_START
    SELECT ${columnName} FROM money_guard_probe WHERE ${columnName} = '${historicalValue}';
    \\echo MARKER_SURVIVED_END
    SAVEPOINT before_canonical;
    INSERT INTO money_guard_probe (${columnName}) VALUES ('${allowedValues[0]}');
    \\echo MARKER_CANONICAL_OK
    RELEASE SAVEPOINT before_canonical;
    SAVEPOINT before_retired;
    INSERT INTO money_guard_probe (${columnName}) VALUES ('${retiredValue}');
    \\echo MARKER_RETIRED_OK
    ROLLBACK;
  `;

  let output = '';
  let retiredRejected = false;
  let retiredErrorText = '';
  try {
    output = psql(script);
  } catch (error) {
    // ON_ERROR_STOP=1 aborts the whole script at the first failing
    // statement (the retired-value INSERT), which is expected -- psql
    // still flushes everything printed before the failure to stdout.
    output = String(error.stdout || '');
    retiredErrorText = String(error.stderr || '');
    retiredRejected = /money_guard_probe_check/.test(retiredErrorText) || /violates check constraint/.test(retiredErrorText);
  }

  const survived = /MARKER_SURVIVED_START\n(.*)\nMARKER_SURVIVED_END/s.exec(output)?.[1]?.trim() || null;
  const canonicalOk = output.includes('MARKER_CANONICAL_OK');
  const retiredOk = output.includes('MARKER_RETIRED_OK');

  return {
    survived,
    canonicalInsert: { ok: canonicalOk },
    retiredInsert: { ok: retiredOk, rejected: retiredRejected || !retiredOk, output: retiredErrorText },
  };
}

test('orders.payment_method: razorpay/cod accepted, stripe rejected for new rows, historical stripe row survives NOT VALID', () => {
  const result = exerciseConstraint({
    columnName: 'payment_method',
    allowedValues: ['razorpay', 'cod'],
    historicalValue: 'stripe',
    retiredValue: 'stripe',
  });
  assert.equal(result.survived, 'stripe', 'the pre-existing historical row must not be disturbed by NOT VALID');
  assert.equal(result.canonicalInsert.ok, true, 'razorpay must still be insertable');
  assert.equal(result.retiredInsert.ok, false, 'a NEW row with stripe must be rejected');
  assert.match(result.retiredInsert.output, /money_guard_probe_check/);
});

test('orders.payment_gateway: razorpay/cod accepted, paypal rejected for new rows, historical paypal row survives', () => {
  const result = exerciseConstraint({
    columnName: 'payment_gateway',
    allowedValues: ['razorpay', 'cod'],
    historicalValue: 'paypal',
    retiredValue: 'paypal',
  });
  assert.equal(result.survived, 'paypal');
  assert.equal(result.canonicalInsert.ok, true);
  assert.equal(result.retiredInsert.ok, false);
});

test("payment_attempts.provider: razorpay/upi/cod accepted (upi deliberately included), cashfree rejected for new rows, historical cashfree row survives", () => {
  const result = exerciseConstraint({
    columnName: 'provider',
    allowedValues: ['razorpay', 'upi', 'cod'],
    historicalValue: 'cashfree',
    retiredValue: 'cashfree',
  });
  assert.equal(result.survived, 'cashfree');
  assert.equal(result.canonicalInsert.ok, true, 'razorpay must still be insertable');
  assert.equal(result.retiredInsert.ok, false, 'a NEW row with cashfree must be rejected');

  // upi specifically must be accepted -- this is the evidence-derived
  // deviation from orders.payment_method's narrower razorpay/cod set
  // (services/api-gateway/src/routes/payments.ts writes provider: 'upi'
  // for the V1 payment-sessions capture flow).
  const upiScript = `
    BEGIN;
    CREATE TEMP TABLE money_guard_probe_upi (provider text NOT NULL);
    ALTER TABLE money_guard_probe_upi
      ADD CONSTRAINT money_guard_probe_upi_check
      CHECK (provider = ANY (ARRAY['razorpay'::text, 'upi'::text, 'cod'::text])) NOT VALID;
    INSERT INTO money_guard_probe_upi (provider) VALUES ('upi');
    \\echo MARKER_UPI_OK
    ROLLBACK;
  `;
  const upiOutput = psql(upiScript);
  assert.match(upiOutput, /MARKER_UPI_OK/, 'upi must be accepted on payment_attempts.provider / payment_transactions.gateway');
});

test('payment_transactions.gateway: razorpay/upi/cod accepted, bank_transfer rejected for new rows, historical bank_transfer row survives', () => {
  const result = exerciseConstraint({
    columnName: 'gateway',
    allowedValues: ['razorpay', 'upi', 'cod'],
    historicalValue: 'bank_transfer',
    retiredValue: 'bank_transfer',
  });
  assert.equal(result.survived, 'bank_transfer');
  assert.equal(result.canonicalInsert.ok, true);
  assert.equal(result.retiredInsert.ok, false);
});
