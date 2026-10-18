// The disposable fixtures' auth.uid(), verified on its own.
//
// supabase-faithful-bootstrap.mjs used to answer NULL to every auth.uid() call, so a policy written against the
// caller's identity (the site-owner read on public.themes, migration 196) could never match and an isolation suite
// could not show its positive control. The bootstrap now derives the identity from the request claims the way
// Supabase does. A fixture that other suites lean on is only trustworthy if it is checked itself, and not through
// the suites that use it: this file needs no migration, only the bootstrap.
//
// What "faithful and minimal" means, one test each:
//   - claims-derived, never a constant: two different subs give two different answers
//   - unset, empty or sub-less claims mean NO identity (NULL), never a default user
//   - a malformed sub or claims document RAISES (as on Supabase) instead of reading as somebody
//   - an identity lasts one transaction when set with SET LOCAL, and a transaction that ends leaves none behind
//   - nothing hardcoded, and nothing that can overwrite a real auth.uid() on the local Supabase stack
//
// DESTRUCTIVE: recreates its own database inside the owned cluster the runner names. Refuses the shared database.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test, { before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SUPABASE_FAITHFUL_BOOTSTRAP_SQL } from './supabase-faithful-bootstrap.mjs';

const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_faithful_auth_uid';
const SHARED_DATABASE = 'letbuyy_executable';
const runnable = databaseName !== SHARED_DATABASE;
const skip = runnable
    ? false
    : `refusing to recreate the shared database '${SHARED_DATABASE}'. This suite needs its own; ` +
      'unset LETBUYY_EXECUTABLE_PG_DATABASE or point it at a private name.';

function psql(sql, targetDatabase = databaseName) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', targetDatabase, '-v', 'ON_ERROR_STOP=1', '-qAt', '-F', '|'],
        { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
}

/** The SQLSTATE psql reports for a failing script, or null when the script succeeds. */
function sqlstateOf(sql) {
    try {
        psql(`\\set VERBOSITY verbose\n${sql}`);
        return null;
    } catch (error) {
        return /ERROR:\s+([0-9A-Z]{5}):/.exec(`${error.stderr}`)?.[1] ?? `unparsed: ${String(error.stderr).slice(0, 160)}`;
    }
}

const claims = (sub) => `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub, role: 'authenticated' })}';`;
const uidIn = (setup) => psql(`BEGIN; ${setup} SELECT coalesce(auth.uid()::text, 'NULL'); ROLLBACK;`);

before(() => {
    if (!runnable) return;
    psql(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE); CREATE DATABASE "${databaseName}";`, 'postgres');
    psql(SUPABASE_FAITHFUL_BOOTSTRAP_SQL);
});

test('no identity was set: auth.uid() is NULL', { skip }, () => {
    assert.equal(psql('SELECT coalesce(auth.uid()::text, \'NULL\');'), 'NULL');
    assert.equal(uidIn("SET LOCAL request.jwt.claims = '';"), 'NULL', 'an empty claims document is no identity');
});

test('the identity is read from the request claims, and is different for different callers', { skip }, () => {
    const first = randomUUID();
    const second = randomUUID();
    assert.notEqual(first, second);
    assert.equal(uidIn(claims(first)), first);
    assert.equal(uidIn(claims(second)), second, 'a constant would answer the same for both');
});

test('the legacy per-claim setting is honoured and, as on Supabase, wins over the claims document', { skip }, () => {
    const legacy = randomUUID();
    const document = randomUUID();
    assert.equal(uidIn(`SET LOCAL request.jwt.claim.sub = '${legacy}';`), legacy);
    assert.equal(uidIn(`SET LOCAL request.jwt.claim.sub = '${legacy}'; ${claims(document)}`), legacy);
    assert.equal(uidIn(`SET LOCAL request.jwt.claim.sub = ''; ${claims(document)}`), document, 'an empty legacy value falls through to the document');
});

test('claims without a usable sub are no identity, never a default user', { skip }, () => {
    for (const document of ['{}', '{"role":"anon"}', '{"sub":null}']) {
        assert.equal(uidIn(`SET LOCAL request.jwt.claims = '${document}';`), 'NULL', document);
    }
});

test('a malformed sub or claims document raises instead of reading as somebody', { skip }, () => {
    // 22P02 invalid_text_representation, the failure Supabase's own expression produces (an empty sub included:
    // only the legacy setting is NULLIF'd, the document's sub goes straight to the uuid cast). An error is the safe
    // answer: no row can be returned by a statement that never ran.
    for (const document of ['{"sub":"not-a-uuid"}', '{"sub":""}', '{"sub":123}', 'not json', '{"sub":']) {
        assert.equal(sqlstateOf(`BEGIN; SET LOCAL request.jwt.claims = '${document}'; SELECT auth.uid();`), '22P02', document);
    }
    assert.equal(sqlstateOf(`BEGIN; SET LOCAL request.jwt.claim.sub = 'not-a-uuid'; SELECT auth.uid();`), '22P02');
});

test('an identity set with SET LOCAL lasts one transaction, whether it commits or rolls back', { skip }, () => {
    const first = randomUUID();
    const second = randomUUID();
    const out = psql(`
        BEGIN; ${claims(first)} SELECT 'first.inside', auth.uid(); COMMIT;
        SELECT 'first.after_commit', coalesce(auth.uid()::text, 'NULL');
        BEGIN; ${claims(second)} SELECT 'second.inside', auth.uid(); ROLLBACK;
        SELECT 'second.after_rollback', coalesce(auth.uid()::text, 'NULL');
        BEGIN; SELECT 'third.fresh_transaction', coalesce(auth.uid()::text, 'NULL'); COMMIT;
    `);
    const seen = new Map(out.split('\n').map((line) => line.split('|')));
    assert.equal(seen.get('first.inside'), first);
    assert.equal(seen.get('first.after_commit'), 'NULL', 'the committed transaction\'s identity must not survive it');
    assert.equal(seen.get('second.inside'), second);
    assert.equal(seen.get('second.after_rollback'), 'NULL', 'the rolled-back transaction\'s identity must not survive it');
    assert.equal(seen.get('third.fresh_transaction'), 'NULL');
});

test('a change of identity inside one transaction is seen by the very next statement', { skip }, () => {
    const first = randomUUID();
    const second = randomUUID();
    const out = psql(`
        BEGIN;
        ${claims(first)}
        SELECT 'one', auth.uid();
        ${claims(second)}
        SELECT 'two', auth.uid();
        ROLLBACK;
    `);
    assert.deepEqual(out.split('\n'), [`one|${first}`, `two|${second}`], 'a STABLE function must not cache across statements');
});

test('the Data API roles can call it, and it is plain SQL over the claims: nothing hardcoded, not security definer', { skip }, () => {
    const identity = randomUUID();
    for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal(uidIn(`SET LOCAL ROLE ${role}; ${claims(identity)}`), identity, `${role} must be able to execute auth.uid()`);
    }
    const [language, volatility, definer, source] = psql(
        "SELECT l.lanname, p.provolatile, p.prosecdef, p.prosrc FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.oid = 'auth.uid'::regproc;",
    ).split('|');
    assert.equal(language, 'sql');
    assert.equal(volatility, 's', 'STABLE, like Supabase\'s');
    assert.equal(definer, 'f');
    assert.doesNotMatch(source, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, 'no identity is hardcoded in the function');
    assert.match(source, /request\.jwt\.claims/);
});

test('the bootstrap cannot overwrite an existing auth.uid(): a database that has one keeps it', { skip }, () => {
    const before = psql("SELECT md5(pg_get_functiondef('auth.uid'::regproc));");
    // Stands in for the local Supabase stack: a database whose auth schema and auth.uid() already exist.
    assert.notEqual(sqlstateOf(SUPABASE_FAITHFUL_BOOTSTRAP_SQL), null, 'the bootstrap must refuse to run over an existing auth schema');
    const statement = /CREATE FUNCTION auth\.uid\(\)[\s\S]*?\$\$;/.exec(SUPABASE_FAITHFUL_BOOTSTRAP_SQL)?.[0];
    assert.ok(statement, 'the bootstrap defines auth.uid() with a plain CREATE FUNCTION');
    assert.equal(sqlstateOf(statement), '42723', 'CREATE FUNCTION must fail with duplicate_function, not replace');
    assert.equal(psql("SELECT md5(pg_get_functiondef('auth.uid'::regproc));"), before, 'the existing function is untouched');

    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'supabase-faithful-bootstrap.mjs'), 'utf8');
    assert.doesNotMatch(source, /OR\s+REPLACE\s+FUNCTION\s+auth\./i, 'no auth function is ever created with OR REPLACE');
});
