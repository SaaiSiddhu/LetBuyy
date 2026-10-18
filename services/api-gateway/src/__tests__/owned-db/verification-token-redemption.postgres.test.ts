// Real-concurrency counterpart to verification-token-redemption.test.ts. A synchronous fake PostgREST
// cannot meaningfully prove "two requests racing the same row" -- there is no real row lock, no real
// serialization, nothing for the fix's WHERE-guarded UPDATE to actually contend over. This file proves
// it against genuine Postgres row-locking semantics.
//
// Persisted deliberately (Phase 2 auth hardening mandate, Section 11: "persist reusable regression
// tests when practical; do not discard all real-database verification as temporary scripts") rather
// than the ephemeral seed-run-delete pattern used earlier in this session for one-off proofs.
//
// WHERE IT RUNS (P2-HERMETIC-GATEWAY-DB): only against the database the executable-suite runner owns for
// this suite -- a disposable Postgres cluster, a database cloned from the fully migrated template, and a
// real PostgREST sidecar -- reached through requireOwnedDatabase(), which proves that ownership before a
// statement is sent. It no longer looks for the developer's own local stack, and it does not skip: with no
// owned database the suite FAILS. Run it with `pnpm --filter @letbuyy/api-gateway run test:db`.
//
// Boundary exercised, per proof: internal signed identity (real HMAC-signed X-LetBuyy-Internal-* headers,
// verified by the real internal-app middleware), the real gateway route (routes/auth.ts mounted unmodified),
// and database row locking (a real WHERE-guarded UPDATE contended by six real requests). The gateway's
// database access is the service role through PostgREST, so this is not a row-level-security proof.
//
// Original reproduction of the bug this guards against (recorded for evidence, not re-run here): 6
// concurrent requests against one real, pre-fix row all returned 200 with identical redemption data
// (successCount: 6/6). After the fix: successCount: 1/6, deterministically, across repeated runs.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { hmacSha256Hex, internalAppSigningPayload } from '@letbuyy/auth-core';
import type { Env } from '../../index';
import authRouter from '../../routes/auth';
import { requireOwnedDatabase } from './owned-db-support';

const INTERNAL_API_SECRET = 'test-internal-secret-for-verification-token-redemption-postgres';

const owned = requireOwnedDatabase();

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        ...owned.restEnv(),
        INTERNAL_API_SECRET,
    } as unknown as Env;
}

async function signedHeaders(): Promise<Record<string, string>> {
    const timestamp = String(Date.now());
    const jti = crypto.randomUUID();
    return {
        'X-LetBuyy-Internal-App': 'accounts',
        'X-LetBuyy-Internal-Timestamp': timestamp,
        'X-LetBuyy-Internal-JTI': jti,
        'X-LetBuyy-Internal-Signature': await hmacSha256Hex(INTERNAL_API_SECRET, internalAppSigningPayload('accounts', timestamp, jti)),
        'Content-Type': 'application/json',
    };
}

function app() {
    const api = new Hono<{ Bindings: Env }>();
    api.route('/auth', authRouter);
    return api;
}

async function validate(token: string) {
    const res = await app().request('/auth/custom/tokens/validate', {
        method: 'POST',
        headers: await signedHeaders(),
        body: JSON.stringify({ token, type: 'email_verify' }),
    }, env());
    return { status: res.status, data: (await res.json() as { data?: unknown }).data };
}

test('REAL POSTGRES: exactly one of many concurrent redemptions of the same row succeeds', async () => {
    const token = `pg-concurrency-${crypto.randomUUID()}`;
    const insertResult = owned.script(`
        INSERT INTO verification_tokens (email, token, type, user_id, expires_at, used)
        VALUES ('pg-concurrency-test@example.invalid', '${token}', 'email_verify', NULL, now() + interval '15 minutes', false)
        RETURNING id;
    `);
    assert.ok(insertResult, 'seeding the synthetic row must succeed in the owned database');

    const CONCURRENCY = 6;
    const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => validate(token)));
    const successes = results.filter((r) => r.data !== null && r.data !== undefined);
    assert.equal(successes.length, 1, `exactly one concurrent redemption must win the race; got ${successes.length}/${CONCURRENCY}: ${JSON.stringify(results)}`);
    for (const r of results) assert.equal(r.status, 200, 'every response is a normal 200, win or lose -- losing is data: null, never an error status');
});

test('REAL POSTGRES: sequential redemption of the same row still succeeds exactly once (not just under concurrency)', async () => {
    const token = `pg-sequential-${crypto.randomUUID()}`;
    owned.script(`
        INSERT INTO verification_tokens (email, token, type, user_id, expires_at, used)
        VALUES ('pg-sequential-test@example.invalid', '${token}', 'email_verify', NULL, now() + interval '15 minutes', false);
    `);

    const first = await validate(token);
    const second = await validate(token);
    assert.ok(first.data, 'first redemption must succeed');
    assert.equal(second.data, null, 'second, sequential redemption of the same token must fail');
});
