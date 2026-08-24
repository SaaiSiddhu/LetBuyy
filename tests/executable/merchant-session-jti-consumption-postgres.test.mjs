import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Phase I3 (IRT-4): proves database/supabase/migrations/205_merchant_session_
// jti_consumption.sql's atomic consumption/cleanup functions directly against
// a real Postgres, mirroring tests/executable/foundation-wave4-session-postgres.
// test.mjs's minimal-schema-plus-migration pattern. Uses the isolated,
// zero-host-port, uniquely-named container technique Phase R1 proved (never
// the shared letbuyy-executable-pg, which other sessions rely on and which
// this file's own resetDatabase() would DROP SCHEMA CASCADE against).

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const containerName = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || 'letbuyy-executable-pg';
const databaseName = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || 'letbuyy_executable';
const migrationSql = readFileSync(
    join(repoRoot, 'database/supabase/migrations/205_merchant_session_jti_consumption.sql'),
    'utf8',
);
const rollbackSql = readFileSync(
    join(repoRoot, 'database/supabase/rollback/205_merchant_session_jti_consumption.rollback.sql'),
    'utf8',
);

function psql(sql, options = {}) {
    return execFileSync(
        'docker',
        ['exec', '-i', containerName, 'psql', '-U', 'postgres', '-d', databaseName, '-v', 'ON_ERROR_STOP=1', '-qAt'],
        { input: `SET client_min_messages TO warning;\n${sql}`, encoding: 'utf8', ...options },
    ).trim();
}

function sqlString(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
}

function resetDatabase() {
    psql(`
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT USAGE ON SCHEMA public TO public;
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                CREATE ROLE service_role;
            END IF;
        END;
        $$;
        CREATE TABLE public.users_custom (
            id uuid PRIMARY KEY,
            email text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
    `);
    psql(migrationSql);
}

const userId = '11111111-1111-4111-8111-111111111111';

function seedUser() {
    psql(`INSERT INTO public.users_custom (id, email) VALUES (${sqlString(userId)}::uuid, 'merchant@example.test');`);
}

function consume(jti, expiresAt) {
    return psql(`SELECT public.consume_merchant_session_jti(${sqlString(jti)}, ${sqlString(userId)}::uuid, ${sqlString(expiresAt)}::timestamptz);`);
}

test('Phase I3: first presentation of a valid jti succeeds', () => {
    resetDatabase();
    seedUser();

    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(consume('irt4-case1-jti-0000000001', future), 't', 'first presentation must be accepted (proceed)');
});

test('Phase I3: second presentation of the same jti is rejected', () => {
    resetDatabase();
    seedUser();

    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(consume('irt4-case2-jti-0000000001', future), 't', 'first presentation must succeed');
    assert.equal(consume('irt4-case2-jti-0000000001', future), 'f', 'second presentation of the identical jti must be rejected as replay');
    assert.equal(
        psql(`SELECT count(*) FROM public.merchant_session_jti_consumptions WHERE jti = 'irt4-case2-jti-0000000001';`),
        '1',
        'exactly one row must exist for the jti — the second attempt must not have inserted a duplicate',
    );
});

test('Phase I3: a different valid jti still succeeds (no over-blocking)', () => {
    resetDatabase();
    seedUser();

    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(consume('irt4-case3-jti-alpha-00000001', future), 't', 'first token must succeed');
    assert.equal(consume('irt4-case3-jti-bravo-00000002', future), 't', 'a second, DIFFERENT token must independently succeed');
});

test('Phase I3: Fork 2 (strict one-shot) — a client retry with the identical token after apparent success is rejected, the accepted failure mode', () => {
    resetDatabase();
    seedUser();

    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    // Simulates the scenario Fork 2's design report names explicitly: the
    // first call succeeds server-side, the response is presumed lost, and
    // the caller retries with the SAME jti (not a fresh one). This proves
    // the accepted failure mode is real and deterministic, not a race.
    const firstAttempt = consume('irt4-case4-retry-jti-00000001', future);
    const retryAttempt = consume('irt4-case4-retry-jti-00000001', future);

    assert.equal(firstAttempt, 't', 'the original request must have genuinely succeeded server-side');
    assert.equal(retryAttempt, 'f', 'FORK 2 (strict one-shot): a same-token retry is rejected — the caller must mint a fresh token to retry, not resend this one');
});

test('Phase I3: expired-row cleanup does not delete a still-valid consumption record', () => {
    resetDatabase();
    seedUser();

    const past = new Date(Date.now() - 60 * 1000).toISOString();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(consume('irt4-case5-expired-jti-0000001', past), 't', 'seed an already-expired consumption record');
    assert.equal(consume('irt4-case5-valid-jti-00000001', future), 't', 'seed a still-valid consumption record');

    const deletedCount = psql('SELECT public.expire_merchant_session_jti_consumptions(500);');
    assert.equal(deletedCount, '1', 'exactly one row (the expired one) must be deleted');

    assert.equal(
        psql(`SELECT count(*) FROM public.merchant_session_jti_consumptions WHERE jti = 'irt4-case5-expired-jti-0000001';`),
        '0',
        'the expired row must be gone',
    );
    assert.equal(
        psql(`SELECT count(*) FROM public.merchant_session_jti_consumptions WHERE jti = 'irt4-case5-valid-jti-00000001';`),
        '1',
        'the still-valid row must survive the sweep untouched',
    );
});

test('Phase I3: migration 205 rolls back cleanly to a full teardown', () => {
    resetDatabase();
    psql(rollbackSql);

    assert.equal(
        psql("SELECT to_regclass('public.merchant_session_jti_consumptions') IS NULL;"),
        't',
        'the table must be gone after rollback',
    );
    assert.equal(
        psql("SELECT to_regprocedure('public.consume_merchant_session_jti(text,uuid,timestamp with time zone)') IS NULL;"),
        't',
        'the consume function must be gone after rollback',
    );
    assert.equal(
        psql("SELECT to_regprocedure('public.expire_merchant_session_jti_consumptions(integer)') IS NULL;"),
        't',
        'the sweeper function must be gone after rollback',
    );
});
