// CHK-0 — the always-on guard for the checkout idempotency advisory lock.
//
// Migration 206 closed the checkout idempotency race with one statement inside
// create_checkout_order: an advisory lock keyed on (store id, idempotency key), taken BEFORE the
// checkout_sessions existence check. Migrations 213 and 215 then each rebuilt that function with
// CREATE OR REPLACE from a pre-206 base and dropped the statement, silently reopening the race —
// measured on a real database: a concurrently replayed idempotency key created TWO orders.
//
// Nothing in the default gate noticed, because the only guard was an executable test that needs a
// dedicated Postgres container (so `pnpm run test:behavioral` never ran it) and that races five OS
// processes (so it passed by timing luck even against the defective function).
//
// This test needs no database and no container. It reads the migration directory, finds the
// HIGHEST-numbered migration that defines create_checkout_order — the definition that wins, because
// CREATE OR REPLACE on an unchanged signature replaces the whole body — and asserts that definition
// still takes the lock before it reads checkout_sessions. It fails on the tree as it stood at 213
// and again at 215. Any future migration that redefines the function without carrying the lock
// forward fails the gate instead of shipping a duplicate-order defect.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const MIGRATIONS_DIR = 'database/supabase/migrations';
const FUNCTION = 'create_checkout_order';

// Strip line comments so prose quoting the statement can never satisfy an assertion about code.
function executableSql(source: string): string {
    return source
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n');
}

function migrationFiles(): string[] {
    const dir = join(repoRoot, MIGRATIONS_DIR);
    assert.equal(existsSync(dir), true, `${MIGRATIONS_DIR} must exist`);
    return readdirSync(dir)
        .filter((name) => name.endsWith('.sql'))
        .sort((a, b) => {
            const na = parseInt(a.match(/^(\d+)/)?.[1] ?? '0', 10);
            const nb = parseInt(b.match(/^(\d+)/)?.[1] ?? '0', 10);
            return na - nb || a.localeCompare(b);
        });
}

// Every migration that issues CREATE [OR REPLACE] FUNCTION public.create_checkout_order(...).
function definingMigrations(): string[] {
    return migrationFiles().filter((name) => {
        const sql = executableSql(readFileSync(join(repoRoot, MIGRATIONS_DIR, name), 'utf8'));
        return new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${FUNCTION}\\s*\\(`, 'i').test(sql);
    });
}

// The body of the last create_checkout_order definition in one migration file.
function lastDefinitionBody(fileName: string): string {
    const sql = executableSql(readFileSync(join(repoRoot, MIGRATIONS_DIR, fileName), 'utf8'));
    const starts = [...sql.matchAll(new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${FUNCTION}\\s*\\(`, 'gi'))];
    assert.ok(starts.length > 0, `${fileName} must define ${FUNCTION}`);
    const from = starts[starts.length - 1].index ?? 0;
    // A function body is delimited by a dollar-quoted tag ($function$ / $$); end at its second occurrence.
    const tag = sql.slice(from).match(/\$([a-zA-Z_]*)\$/);
    assert.ok(tag, `${fileName}: ${FUNCTION} must use a dollar-quoted body`);
    const bodyStart = from + (tag.index ?? 0);
    const closing = sql.indexOf(tag[0], bodyStart + tag[0].length);
    assert.ok(closing > bodyStart, `${fileName}: unterminated ${FUNCTION} body`);
    return sql.slice(bodyStart, closing + tag[0].length);
}

test('the winning create_checkout_order definition takes the idempotency advisory lock before its existence check', () => {
    const defining = definingMigrations();
    assert.ok(defining.length > 0, 'at least one migration must define create_checkout_order');

    // CREATE OR REPLACE on an unchanged signature replaces the entire body, so only the
    // highest-numbered definition is live. That is the one that must carry the lock.
    const winner = defining[defining.length - 1];
    const body = lastDefinitionBody(winner);

    const lockAt = body.search(/PERFORM\s+pg_advisory_xact_lock\s*\(/i);
    assert.notEqual(
        lockAt,
        -1,
        `${winner} is the live definition of create_checkout_order and does not take pg_advisory_xact_lock. ` +
        'Migration 206 added it to close the checkout idempotency race; a redefinition must carry it forward. ' +
        'Without it a concurrently replayed idempotency key creates a second order (measured: 2 orders, 1 checkout_sessions row).',
    );

    // The lock is worthless after the existence check: the racing caller has already decided to
    // build an order by then. 206's rationale is advisory-FIRST — before the lookup and before
    // every row lock the function transitively takes.
    const existenceAt = body.search(/FROM\s+checkout_sessions/i);
    assert.notEqual(existenceAt, -1, `${winner}: create_checkout_order must still look up checkout_sessions by idempotency key`);
    assert.ok(
        lockAt < existenceAt,
        `${winner}: the advisory lock must be taken BEFORE the checkout_sessions existence check (found lock at ${lockAt}, check at ${existenceAt})`,
    );

    // Keyed on the tenant AND the idempotency key: locking on either alone would serialise unrelated
    // checkouts or fail to serialise a replay.
    const lockCall = body.slice(lockAt, body.indexOf(';', lockAt));
    assert.match(lockCall, /p_store_id/, `${winner}: the advisory lock key must include the store/site id`);
    assert.match(lockCall, /p_idempotency_key/, `${winner}: the advisory lock key must include the idempotency key`);
});

test('the checkout_sessions ON CONFLICT guard is still present, and is not mistaken for the fix', () => {
    const defining = definingMigrations();
    const body = lastDefinitionBody(defining[defining.length - 1]);
    // Kept as belt-and-braces by 206 (DEL-R3: nothing removed without a reason). It cannot close the
    // race on its own — the order row is created before the session row, and DO NOTHING swallows the
    // conflict rather than raising — so its presence is asserted, never treated as sufficient.
    assert.match(
        body,
        /ON CONFLICT \(site_id, idempotency_key\) DO NOTHING/i,
        'the checkout_sessions unique-constraint guard must remain as a second line of defence',
    );
});

test('every migration that redefines create_checkout_order after 206 carries the lock forward', () => {
    // A historical ratchet: 213 and 215 are recorded as the two that did not, so the invariant is
    // asserted from 218 onward rather than retroactively rewriting history.
    const KNOWN_REGRESSIONS = new Set(['213', '215']);
    const offenders: string[] = [];
    for (const name of definingMigrations()) {
        const number = name.match(/^(\d+)/)?.[1] ?? '0';
        if (parseInt(number, 10) <= 206) continue;
        if (KNOWN_REGRESSIONS.has(number)) continue;
        if (!/PERFORM\s+pg_advisory_xact_lock\s*\(/i.test(lastDefinitionBody(name))) offenders.push(name);
    }
    assert.deepEqual(
        offenders,
        [],
        `these migrations redefine create_checkout_order without the idempotency advisory lock: ${offenders.join(', ')}. ` +
        'Carry the PERFORM pg_advisory_xact_lock(...) statement forward, as migration 218 does.',
    );
});
