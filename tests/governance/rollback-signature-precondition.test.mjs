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

const CANDIDATE_GUARDED = [280,285,288,291,293,294,296,303,305];

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
    // The ratchet remains at 245; candidate restorers must earn a real guard.
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

test('candidate guards bind every restored ABI and precede any schema or function mutation', () => {
    let restorers = 0;
    for (const n of CANDIDATE_GUARDED) {
        const name = rollbackFiles().find(file => number(file) === n);
        assert.ok(name, `rollback ${n} must exist`);
        const sql = read(name);
        const guard = sql.match(/DO \$rollback_precondition\$[\s\S]*?\$rollback_precondition\$;/)?.[0];
        assert.ok(guard, `${name}: a named guard is required`);
        for (const fn of new Set(createdFunctions(sql))) {
            assert.ok(guard.includes(`'public.${fn}(`), `${name}: bind ${fn}'s typed signature`);
            restorers += 1;
        }
        assert.match(guard,/v_count <> 1/);
        assert.match(guard,/to_regprocedure\(v_expected.signature\)/);
        assert.match(guard,/proargnames\[1:v_live.pronargs\]/);
        assert.match(guard,/prorettype IS DISTINCT FROM/);
        assert.match(guard,/proretset IS DISTINCT FROM/);
        assert.match(guard,new RegExp(`rollback ${n} refuses to run`));
        assert.ok(sql.indexOf(guard) < sql.search(/^\s*(?:CREATE OR REPLACE FUNCTION|DROP |ALTER )/m),`${name}: guard before first mutation`);
        assert.match(sql,/^BEGIN;$/m);
        assert.match(sql,/^COMMIT;$/m);
    }
    assert.equal(restorers,13);
});

test('current Console, staff and subscription rollback guards bind all live signatures before mutation', () => {
    for (const n of [318,324,328,329]) {
        const name=rollbackFiles().find(file=>number(file)===n);
        const sql=read(name);
        const guard=sql.match(/DO \$rollback_precondition\$[\s\S]*?\$rollback_precondition\$;/)?.[0];
        assert.ok(guard,`${name}: named guard required`);
        for (const fn of new Set(createdFunctions(sql))) {
            assert.ok(guard.includes(`'public.${fn}(`),`${name}: bind every restored function`);
        }
        assert.match(guard,/v_count <> v_expected.overloads/);
        assert.match(guard,/to_regprocedure\(v_expected.signature\)/);
        assert.match(guard,/proargnames\[1:v_live.pronargs\]/);
        assert.match(guard,/prorettype IS DISTINCT FROM/);
        assert.match(guard,/proretset IS DISTINCT FROM/);
        assert.match(guard,new RegExp(`rollback ${n} refuses to run`));
        assert.ok(sql.indexOf(guard)<sql.search(/^\s*(?:CREATE OR REPLACE FUNCTION|DROP |ALTER )/m));
        if (n===329) {
            assert.equal((guard.match(/'public\.complete_console_mfa_v1\(/g)||[]).length,2,
                'factor-bound completion and its intentional refusal-only predecessor overload both need guards');
        }
    }
});
