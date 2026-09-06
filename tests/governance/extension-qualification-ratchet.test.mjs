// F-SEARCHPATH-1 — a forward ratchet: no NEW migration may call a pgcrypto function unqualified.
//
// WHY A RATCHET AND NOT A FULL SCAN
// A static check over ALL migrations cannot tell a live definition from a superseded one. Migration
// 000 genuinely contains `gen_random_bytes(...)` unqualified inside `claim_runtime_lease`, and
// migration 244 genuinely fixes it — flagging 000 would be a false positive that never goes away,
// and reconstructing each function's final definition across 244 layered files is the fragility
// CAP-C55 identified when it declined to ship this as a validator. So this guard is forward-only:
// it polices the realistic accident, which is someone copying an existing broken line into a new
// migration. The live-truth check is the database-wide sweep in
// tests/executable/extension-schema-qualification-postgres.test.mjs, which reads
// pg_get_functiondef on a Supabase-faithful database and needs no reconstruction at all.
//
// WHY THESE NAMES
// On Supabase, pgcrypto is installed into the `extensions` schema. A function carrying
// `SET search_path TO 'public'` therefore cannot resolve any of these unqualified. `gen_random_uuid`
// is deliberately NOT in the list: it also exists in `pg_catalog`, which is always on the search
// path, so calling it unqualified is correct and seven functions already do.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(repoRoot, 'database/supabase/migrations');
const rollbackDir = join(repoRoot, 'database/supabase/rollback');

// Migrations up to and including this number are grandfathered: the executable sweep, not this
// file, is what proves their FINAL definitions are clean. Raising this number is not a fix.
const RATCHET_FROM_EXCLUSIVE = 244;

const EXTENSION_ONLY_FUNCTIONS = [
    'gen_random_bytes',
    'digest',
    'hmac',
    'crypt',
    'gen_salt',
    'pgp_sym_encrypt',
    'pgp_sym_decrypt',
    'pgp_pub_encrypt',
    'pgp_pub_decrypt',
    'armor',
    'dearmor',
];

// Whole-line `--` comments and /* */ blocks are removed. A TRAILING `-- like this` comment is
// deliberately left in place: stripping it would require knowing whether the `--` sits inside a
// string literal, and guessing wrong there would silently skip real code. Leaving it means a
// comment that mentions `digest(` trips this guard — a visible false positive, which is the safe
// direction for a ratchet to fail in.
function stripComments(sql) {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n')
        .filter((line) => !/^\s*--/.test(line))
        .join('\n');
}

export function findUnqualifiedCalls(sql) {
    const body = stripComments(sql);
    const found = [];
    for (const fn of EXTENSION_ONLY_FUNCTIONS) {
        // The negative lookbehind on `.` is what separates `extensions.digest(` from `digest(`, and
        // the `\w` class is what stops `pgp_sym_encrypt(` from registering as a bare `encrypt(`.
        const pattern = new RegExp(`(^|[^.\\w"])(${fn})\\s*\\(`, 'g');
        for (const match of body.matchAll(pattern)) {
            const line = body.slice(0, match.index).split('\n').length;
            found.push({ fn, line });
        }
    }
    return found.sort((a, b) => a.line - b.line || a.fn.localeCompare(b.fn));
}

function migrationNumber(filename) {
    return parseInt(filename.match(/^(\d+)/)?.[1] ?? '-1', 10);
}

function sqlFilesAfterRatchet(directory) {
    return readdirSync(directory)
        .filter((name) => name.endsWith('.sql') && migrationNumber(name) > RATCHET_FROM_EXCLUSIVE)
        .sort();
}

test('no migration after the ratchet point calls a pgcrypto function unqualified', () => {
    // Stated plainly because it matters: with 244 as the ratchet point this sweep starts EMPTY —
    // there is nothing after it yet, so today this assertion passes vacuously. What keeps it from
    // being decoration is the next test, which proves the detector fires on the exact line 244
    // removed. The sweep earns its keep on the next migration written, not on this one.
    const offenders = [];
    for (const directory of [migrationsDir, rollbackDir]) {
        for (const name of sqlFilesAfterRatchet(directory)) {
            const hits = findUnqualifiedCalls(readFileSync(join(directory, name), 'utf8'));
            for (const hit of hits) offenders.push(`${name}:${hit.line} calls ${hit.fn}() unqualified`);
        }
    }
    assert.deepEqual(
        offenders,
        [],
        'qualify the call as extensions.<fn>(...). Widening the function search_path is not the fix — ' +
        'a SECURITY DEFINER search_path is a security control, and every schema on it is somewhere a ' +
        'name can be shadowed.',
    );
});

test('the ratchet is load-bearing: it fires on the exact line migration 244 removed', () => {
    // The real pre-244 line, verbatim. If this guard ever stops matching it, the guard is broken
    // and the empty result above means nothing.
    const before = `    token TEXT := encode(gen_random_bytes(16), 'hex');`;
    const after = `    token TEXT := encode(extensions.gen_random_bytes(16), 'hex');`;

    assert.deepEqual(findUnqualifiedCalls(before).map((h) => h.fn), ['gen_random_bytes']);
    assert.deepEqual(findUnqualifiedCalls(after), []);
});

test('the ratchet does not fire on names that merely contain a listed name', () => {
    // The boundary case this class of check gets wrong: `pgp_sym_encrypt(` contains `encrypt`,
    // `my_digest_helper(` contains `digest`, and `v_crypt(` ends with `crypt`.
    assert.deepEqual(findUnqualifiedCalls(`SELECT extensions.pgp_sym_encrypt(a, b);`), []);
    assert.deepEqual(findUnqualifiedCalls(`SELECT public.my_digest_helper(x);`), []);
    assert.deepEqual(findUnqualifiedCalls(`SELECT public.compute_hmac_value(x);`), []);
    assert.deepEqual(findUnqualifiedCalls(`SELECT schema_digest(x);`), []);

    // ...and the case it must still catch, where the listed name is a genuine bare call.
    assert.deepEqual(findUnqualifiedCalls(`SELECT digest(x, 'sha256');`).map((h) => h.fn), ['digest']);
    assert.deepEqual(findUnqualifiedCalls(`SELECT encode(hmac(a, b, 'sha256'), 'hex');`).map((h) => h.fn), ['hmac']);
});

test('gen_random_uuid is deliberately not policed', () => {
    // It exists in pg_catalog as well as extensions, so an unqualified call resolves under any
    // search_path. Adding it to the list would manufacture findings against correct code.
    assert.ok(!EXTENSION_ONLY_FUNCTIONS.includes('gen_random_uuid'));
    assert.deepEqual(findUnqualifiedCalls(`SELECT gen_random_uuid();`), []);
});

test('migration 244 and its rollback are exactly what the ratchet expects', () => {
    const migration = readFileSync(join(migrationsDir, '244_qualify_extension_calls_in_queue_rpcs.sql'), 'utf8');
    // 244 itself sits at the ratchet point, not after it, so the sweep above does not read it.
    // Assert it directly: the fixed migration is clean, and its own rollback is not — the rollback
    // restores the defect on purpose, which is what makes the executable suite's control real.
    assert.deepEqual(findUnqualifiedCalls(migration), []);

    const rollback = readFileSync(join(rollbackDir, '244_qualify_extension_calls_in_queue_rpcs.rollback.sql'), 'utf8');
    assert.deepEqual(
        findUnqualifiedCalls(rollback).map((h) => h.fn),
        ['gen_random_bytes', 'gen_random_bytes'],
        'the rollback must restore both unqualified calls, or the BEFORE control proves nothing',
    );
});
