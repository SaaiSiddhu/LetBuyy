// F-ROLLBACK-1 (CAP-C65) — the cheap, always-on half of the guard.
//
// The executable suite proves the real behaviour against Postgres: every affected rollback refuses
// at head, still applies at its own migration, and reproduces the defect when the precondition is
// stripped. It needs a database. This file needs nothing, so it runs in the gate on every change and
// catches the realistic accident — someone adding a rollback that restores a function with a stale
// parameter list, or deleting a precondition from one that has one.
//
// WHY `create_checkout_order` IS NAMED EXPLICITLY
// It is the only function in the schema with this exposure — measured, not assumed: a sweep of every
// rollback against the live signature of all 201 public functions found no other. Naming it means
// deleting a precondition fails here by name rather than silently reducing a count.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const rollbackDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'database/supabase/rollback');

// Every rollback that restores create_checkout_order. All six carry a signature precondition; the
// list is explicit so that removing a file, or a precondition, is a named failure.
const GUARDED = [
    '202_narrow_checkout_order_payment_method.rollback.sql',
    '206_checkout_order_idempotency_advisory_lock.rollback.sql',
    '213_checkout_order_gst_place_of_supply_and_tax_lines.rollback.sql',
    '215_fix_gift_card_digest_search_path.rollback.sql',
    '218_restore_checkout_idempotency_advisory_lock.rollback.sql',
    '219_purchase_parent_child_orders.rollback.sql',
];

// Rollbacks written after this phase are held to the forward rule below. Earlier files are covered
// by the explicit list above; raising this number is not a fix.
const RATCHET_FROM_EXCLUSIVE = 245;

const rollbackFiles = () => readdirSync(rollbackDir).filter((n) => n.endsWith('.sql')).sort();
const read = (name) => readFileSync(join(rollbackDir, name), 'utf8');
const number = (name) => parseInt(name.match(/^(\d+)/)?.[1] ?? '-1', 10);

function createdFunctions(sql) {
    return [...sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gi)]
        .map((m) => m[1]);
}

test('every rollback that restores create_checkout_order carries a signature precondition', () => {
    const missing = GUARDED.filter((name) => !read(name).includes('$rollback_precondition$'));
    assert.deepEqual(
        missing,
        [],
        'CREATE OR REPLACE with a different parameter list ADDS an overload instead of replacing, ' +
        'after which every create_checkout_order call fails "is not unique" and checkout is down. ' +
        'The precondition is what turns that into a refusal.',
    );
});

test('the guarded list is complete — no other rollback restores create_checkout_order unguarded', () => {
    const unguarded = rollbackFiles().filter((name) =>
        createdFunctions(read(name)).includes('create_checkout_order') && !GUARDED.includes(name));
    assert.deepEqual(unguarded, [], 'add the signature precondition and list the file in GUARDED');
});

test('every listed file exists, so the list cannot decay into fiction', () => {
    const present = new Set(rollbackFiles());
    assert.deepEqual(GUARDED.filter((n) => !present.has(n)), [], 'a renamed or deleted rollback must leave this list');
});

test('a precondition must actually compare a signature, not merely exist', () => {
    // A block that raises nothing, or compares nothing, would satisfy the substring check above.
    for (const name of GUARDED) {
        const sql = read(name);
        assert.match(sql, /v_expected text\[\] := ARRAY\[/, `${name}: must declare the signature it expects`);
        assert.match(sql, /v_names IS DISTINCT FROM v_expected/, `${name}: must compare live against expected`);
        assert.match(sql, /refuses to run/, `${name}: must raise a message saying so`);
        assert.match(sql, /proargnames\[1:p\.pronargs\]/, `${name}: must compare INPUT parameters only`);
        // And it must run before anything it guards.
        assert.ok(
            sql.indexOf('$rollback_precondition$') < sql.search(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.create_checkout_order/i),
            `${name}: the precondition must come before the CREATE it protects`,
        );
        // A raise inside a transaction is what makes the refusal atomic.
        assert.match(sql, /^BEGIN;$/m, `${name}: must run inside a transaction`);
        assert.match(sql, /^COMMIT;$/m, `${name}: must commit`);
    }
});

test('a NEW rollback may not restore a function without either a DROP or a precondition', () => {
    // Stated plainly: with the ratchet at 245 there are no files after it yet, so this passes
    // vacuously today. What stops it being decoration is that the four tests above are not vacuous,
    // and the executable suite proves the behaviour against a real database. This one earns its keep
    // on the next rollback written.
    const offenders = [];
    for (const name of rollbackFiles()) {
        if (number(name) <= RATCHET_FROM_EXCLUSIVE) continue;
        const sql = read(name);
        if (sql.includes('$rollback_precondition$')) continue;
        for (const fn of new Set(createdFunctions(sql))) {
            const dropsIt = new RegExp(`DROP\\s+FUNCTION\\s+(?:IF\\s+EXISTS\\s+)?public\\.${fn}\\s*\\(`, 'i').test(sql);
            if (!dropsIt) offenders.push(`${name}: creates public.${fn} with neither a DROP nor a precondition`);
        }
    }
    assert.deepEqual(
        offenders.sort(),
        [],
        'A rollback restoring a past definition must either DROP the live function first (so the ' +
        'CREATE cannot add an overload) or assert the signature it expects and refuse otherwise.',
    );
});
