// Phase 2 auth hardening (buyer/merchant verification_tokens redemption race) -- POST
// /auth/custom/tokens/validate previously read the row, checked `used`/`expires_at` in application
// code, then ran an UNCONDITIONAL `UPDATE ... SET used = true WHERE id = <id>` with no guard tying it
// back to what was read. Reproduced against REAL local Postgres before this fix existed: 6 concurrent
// requests against one token all returned 200 with the same redemption data (successCount: 6/6).
// The fix makes the consume step itself the single-use guarantee: `UPDATE ... WHERE id = <id> AND
// used = false AND expires_at > now() RETURNING id`. Two racing requests serialize on Postgres's row
// lock; the loser's WHERE clause matches zero rows (not an error) once the winner commits. Re-run
// against the same real Postgres instance after the fix: successCount: 1/6 -- see this pass's commit
// message for the full transcript. This file covers every DETERMINISTIC case with a fake PostgREST
// (fast, no external dependency); TRUE concurrency -- which a synchronous JS mock cannot meaningfully
// exercise -- is covered separately in verification-token-redemption.postgres.test.ts.
//
// This is a SEPARATE system from the console's own magic-link consumption (console-magic-link-
// consume.test.ts, migration 263): that one guards platform-operator login exclusively. This one
// guards the buyer/merchant realm's own email verification, magic-link login, AND password reset --
// called from apps/platform/identity's verify-otp, verify, and reset-password routes. The `magic_link`
// case there is the most severe: it mints a real login session directly from this validation, with no
// separate MFA/session-issuance step in between.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { hmacSha256Hex, internalAppSigningPayload } from '@letbuyy/auth-core';
import type { Env } from '../index';
import authRouter from '../routes/auth';

const POSTGREST = 'https://verification-token-redemption.fake-postgrest.test';
const INTERNAL_API_SECRET = 'test-internal-secret-for-verification-token-redemption';
type Row = Record<string, unknown>;

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
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

function test1(value: unknown, expression: string): boolean {
    if (expression.startsWith('eq.')) return value !== null && value !== undefined && String(value) === expression.slice(3);
    if (expression.startsWith('gt.')) return typeof value === 'string' && value > expression.slice(3);
    throw new Error(`fake PostgREST does not model "${expression}"`);
}
function matches(row: Row, params: URLSearchParams): boolean {
    for (const [column, expression] of params) {
        if (['select', 'limit', 'offset', 'order', 'columns'].includes(column)) continue;
        if (!test1(row[column], expression)) return false;
    }
    return true;
}

/** A fake PostgREST whose PATCH applies its WHERE-equivalent query params BEFORE selecting which rows
 *  to update (matching real PostgREST/Postgres UPDATE ... WHERE semantics) -- this is what lets the
 *  `used = false` guard in the atomic consume actually prove anything: a row already flipped to
 *  `used: true` by an earlier call in the SAME test no longer matches on a second PATCH. */
function installFakePostgrest(tablesData: Record<string, Row[]>, opts: { failConsumeForId?: string } = {}) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const method = (init?.method || 'GET').toUpperCase();
        const table = url.pathname.replace('/rest/v1/', '');
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
        const rows = tablesData[table] ?? (tablesData[table] = []);
        const matched = rows.filter((row) => matches(row, url.searchParams));
        const single = new Headers(init?.headers).get('accept') === 'application/vnd.pgrst.object+json';

        if (method === 'GET') {
            if (single) return matched.length === 1 ? json(matched[0]) : json(null);
            return json(matched);
        }
        if (method === 'PATCH') {
            if (opts.failConsumeForId && matched.some((row) => row.id === opts.failConsumeForId)) {
                return json({ code: '53000', message: 'simulated storage failure at consume time' }, 500);
            }
            const patch = init?.body ? JSON.parse(String(init.body)) : {};
            for (const row of matched) Object.assign(row, patch);
            if (single) return matched.length === 1 ? json(matched[0]) : json(null);
            return json(matched);
        }
        return json([], 200);
    }) as typeof globalThis.fetch;
    return { restore: () => { globalThis.fetch = originalFetch; } };
}

function app() {
    const api = new Hono<{ Bindings: Env }>();
    api.route('/auth', authRouter);
    return api;
}

async function validate(body: Record<string, unknown>) {
    const res = await app().request('/auth/custom/tokens/validate', {
        method: 'POST',
        headers: await signedHeaders(),
        body: JSON.stringify(body),
    }, env());
    return { status: res.status, body: await res.json() as { data?: { email: string; user_id: string | null } | null; error?: { code: string } } };
}

const FUTURE = new Date(Date.now() + 15 * 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

function freshRow(overrides: Partial<Row> = {}): Row {
    return {
        id: 'tok-1111-1111-1111-1111-111111111111',
        email: 'buyer@example.test',
        token: 'a-valid-token-value',
        type: 'email_verify',
        user_id: 'user-abc',
        expires_at: FUTURE,
        used: false,
        ...overrides,
    };
}

test('valid first redemption succeeds and marks the token used', async (t) => {
    const rows = [freshRow()];
    const fake = installFakePostgrest({ verification_tokens: rows });
    t.after(fake.restore);
    const { status, body } = await validate({ token: 'a-valid-token-value', type: 'email_verify' });
    assert.equal(status, 200);
    assert.deepEqual(body.data, { email: 'buyer@example.test', user_id: 'user-abc' });
    assert.equal(rows[0].used, true, 'the row must be flipped to used by a successful redemption');
});

test('sequential replay: the identical token, redeemed a second time, is refused -- not a second success', async (t) => {
    const rows = [freshRow()];
    const fake = installFakePostgrest({ verification_tokens: rows });
    t.after(fake.restore);
    const first = await validate({ token: 'a-valid-token-value', type: 'email_verify' });
    const second = await validate({ token: 'a-valid-token-value', type: 'email_verify' });
    assert.equal(first.status, 200);
    assert.ok(first.body.data);
    assert.equal(second.status, 200);
    assert.equal(second.body.data, null, 'a replayed token must never redeem twice');
});

test('an already-expired token is refused before any consume attempt', async (t) => {
    const rows = [freshRow({ expires_at: PAST })];
    const fake = installFakePostgrest({ verification_tokens: rows });
    t.after(fake.restore);
    const { status, body } = await validate({ token: 'a-valid-token-value', type: 'email_verify' });
    assert.equal(status, 200);
    assert.equal(body.data, null);
    assert.equal(rows[0].used, false, 'an expired token must not be marked used');
});

test('wrong purpose: a token created for email_verify is refused when validated against password_reset', async (t) => {
    const rows = [freshRow({ type: 'email_verify' })];
    const fake = installFakePostgrest({ verification_tokens: rows });
    t.after(fake.restore);
    const { status, body } = await validate({ token: 'a-valid-token-value', type: 'password_reset' });
    assert.equal(status, 200);
    assert.equal(body.data, null, 'type is a purpose discriminator -- the same token string must not validate for a different purpose');
    assert.equal(rows[0].used, false);
});

test('wrong principal: an explicit email that does not match the token\'s own email is refused, never redeems someone else\'s token', async (t) => {
    const rows = [freshRow({ email: 'real-owner@example.test' })];
    const fake = installFakePostgrest({ verification_tokens: rows });
    t.after(fake.restore);
    const { status, body } = await validate({ token: 'a-valid-token-value', type: 'email_verify', email: 'attacker@example.test' });
    assert.equal(status, 200);
    assert.equal(body.data, null);
    assert.equal(rows[0].used, false);
});

test('malformed input: a missing token is rejected as VALIDATION before any database read', async () => {
    const { status, body } = await validate({ type: 'email_verify' });
    assert.equal(status, 400);
    assert.equal(body.error?.code, 'VALIDATION');
});

test('malformed input: an invalid type is rejected as VALIDATION before any database read', async () => {
    const { status, body } = await validate({ token: 'anything', type: 'not-a-real-type' });
    assert.equal(status, 400);
    assert.equal(body.error?.code, 'VALIDATION');
});

test('a storage failure at the atomic consume step fails closed -- never reported as a successful redemption', async (t) => {
    const rows = [freshRow()];
    const fake = installFakePostgrest({ verification_tokens: rows }, { failConsumeForId: rows[0].id as string });
    t.after(fake.restore);
    const { status, body } = await validate({ token: 'a-valid-token-value', type: 'email_verify' });
    assert.equal(status, 500, 'a DB error consuming the token must surface as a failure, not data: null and not data: {...}');
    assert.equal(body.error?.code, 'DB_ERROR');
    assert.equal(rows[0].used, false, 'the simulated failure never actually wrote used=true');
});

test('an invalid redemption attempt against one token cannot consume a different, unrelated valid token', async (t) => {
    const targetRow = freshRow({ id: 'tok-target', token: 'target-token', email: 'target@example.test' });
    const otherRow = freshRow({ id: 'tok-other', token: 'other-token', email: 'other@example.test' });
    const rows = [targetRow, otherRow];
    const fake = installFakePostgrest({ verification_tokens: rows });
    t.after(fake.restore);

    // Wrong token string entirely -- matches no row.
    const invalidAttempt = await validate({ token: 'not-a-real-token-at-all', type: 'email_verify' });
    assert.equal(invalidAttempt.body.data, null);
    assert.equal(otherRow.used, false, 'the unrelated valid token must remain untouched by a failed lookup elsewhere');

    // The unrelated token still redeems successfully afterward.
    const stillValid = await validate({ token: 'other-token', type: 'email_verify' });
    assert.equal(stillValid.status, 200);
    assert.deepEqual(stillValid.body.data, { email: 'other@example.test', user_id: 'user-abc' });
});
