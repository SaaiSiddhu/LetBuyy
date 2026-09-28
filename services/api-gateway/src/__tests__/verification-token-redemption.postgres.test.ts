// Real-concurrency counterpart to verification-token-redemption.test.ts. A synchronous fake PostgREST
// cannot meaningfully prove "two requests racing the same row" -- there is no real row lock, no real
// serialization, nothing for the fix's WHERE-guarded UPDATE to actually contend over. This file proves
// it against genuine Postgres row-locking semantics.
//
// Persisted deliberately (Phase 2 auth hardening mandate, Section 11: "persist reusable regression
// tests when practical; do not discard all real-database verification as temporary scripts") rather
// than the ephemeral seed-run-delete pattern used earlier in this session for one-off proofs. Skips
// itself cleanly -- never fails the suite -- when SUPABASE_URL/.dev.vars point somewhere that isn't a
// local instance, or aren't configured at all, so this file is safe in any environment without a live
// local Postgres. It uses the SAME real database as this repo's local dev stack (never a hosted
// endpoint -- refuses to run otherwise), seeding and deleting its own synthetic row per test.
//
// Original reproduction of the bug this guards against (recorded for evidence, not re-run here): 6
// concurrent requests against one real, pre-fix row all returned 200 with identical redemption data
// (successCount: 6/6). After the fix: successCount: 1/6, deterministically, across repeated runs.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Hono } from 'hono';
import { hmacSha256Hex, internalAppSigningPayload } from '@letbuyy/auth-core';
import type { Env } from '../index';
import authRouter from '../routes/auth';

const devVarsPath = new URL('../../.dev.vars', import.meta.url);
const INTERNAL_API_SECRET = 'test-internal-secret-for-verification-token-redemption-postgres';

function readLocalSupabaseConfig(): { url: string; serviceRoleKey: string } | null {
    if (!existsSync(devVarsPath)) return null;
    const devVars = readFileSync(devVarsPath, 'utf8');
    const url = devVars.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim();
    const serviceRoleKey = devVars.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1]?.trim();
    if (!url || !serviceRoleKey) return null;
    // Refuse anything that isn't unmistakably a local instance -- this file must never run its
    // seed/delete cycle against a real, hosted, or shared database.
    let hostname = '';
    try { hostname = new URL(url).hostname.toLowerCase(); } catch { return null; }
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    return isLocal ? { url, serviceRoleKey } : null;
}

function dbContainerName(): string {
    return process.env.LETBUYY_LOCAL_SUPABASE_CONTAINER || 'supabase_db_letbuyy-newmac-20260926';
}

function psql(sql: string): string | null {
    try {
        return execFileSync(
            'docker',
            ['exec', '-i', dbContainerName(), 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt'],
            { input: sql, encoding: 'utf8' },
        ).trim();
    } catch {
        return null;
    }
}

const config = readLocalSupabaseConfig();
const dockerAvailable = (() => {
    try { execFileSync('docker', ['exec', dbContainerName(), 'true']); return true; } catch { return false; }
})();

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: config!.url,
        SUPABASE_SERVICE_ROLE_KEY: config!.serviceRoleKey,
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

test('REAL POSTGRES: exactly one of many concurrent redemptions of the same row succeeds', async (t) => {
    if (!config || !dockerAvailable) {
        t.skip('no local Supabase instance reachable (.dev.vars missing/non-local, or the db container is not running) -- this test only runs against this repo\'s own local dev stack');
        return;
    }

    const token = `pg-concurrency-${crypto.randomUUID()}`;
    const insertResult = psql(`
        INSERT INTO verification_tokens (email, token, type, user_id, expires_at, used)
        VALUES ('pg-concurrency-test@example.test', '${token}', 'email_verify', NULL, now() + interval '15 minutes', false)
        RETURNING id;
    `);
    assert.ok(insertResult, 'seeding the synthetic row must succeed against the real local instance');

    try {
        const CONCURRENCY = 6;
        const results = await Promise.all(Array.from({ length: CONCURRENCY }, () => validate(token)));
        const successes = results.filter((r) => r.data !== null && r.data !== undefined);
        assert.equal(successes.length, 1, `exactly one concurrent redemption must win the race; got ${successes.length}/${CONCURRENCY}: ${JSON.stringify(results)}`);
        for (const r of results) assert.equal(r.status, 200, 'every response is a normal 200, win or lose -- losing is data: null, never an error status');
    } finally {
        psql(`DELETE FROM verification_tokens WHERE token = '${token}';`);
    }
});

test('REAL POSTGRES: sequential redemption of the same row still succeeds exactly once (not just under concurrency)', async (t) => {
    if (!config || !dockerAvailable) {
        t.skip('no local Supabase instance reachable');
        return;
    }

    const token = `pg-sequential-${crypto.randomUUID()}`;
    psql(`
        INSERT INTO verification_tokens (email, token, type, user_id, expires_at, used)
        VALUES ('pg-sequential-test@example.test', '${token}', 'email_verify', NULL, now() + interval '15 minutes', false);
    `);

    try {
        const first = await validate(token);
        const second = await validate(token);
        assert.ok(first.data, 'first redemption must succeed');
        assert.equal(second.data, null, 'second, sequential redemption of the same token must fail');
    } finally {
        psql(`DELETE FROM verification_tokens WHERE token = '${token}';`);
    }
});
