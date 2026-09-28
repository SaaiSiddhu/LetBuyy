// Phase 2 / Mandate 7, Section 6 -- POST /internal/console/magic-link/consume: atomic single-use
// consumption for the platform console's magic-link login token. The PRIMARY KEY on jti
// (migration 263) is the actual atomicity guarantee -- this fake models that constraint's behavior
// (reject a second insert of the identical jti with 23505), matching how every other fake-postgrest
// harness in this suite models the real unique-violation contract, not the real network path (see
// the separate real-Postgres concurrency proof run manually for that).

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import internalConsoleRouter from '../routes/internal-console';

const POSTGREST = 'https://console-magic-link-consume.fake-postgrest.test';
const CONSOLE_TOKEN = 'test-console-api-token-not-a-real-secret';

type Row = Record<string, unknown>;

function env(): Env {
    return {
        ENVIRONMENT: 'test',
        SUPABASE_URL: POSTGREST,
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        PLATFORM_CONSOLE_API_TOKEN: CONSOLE_TOKEN,
        INTERNAL_API_SECRET: 'internal-secret-for-console-magic-link-consume-tests',
    } as unknown as Env;
}

function installFakePostgrest(tablesData: Record<string, Row[]>) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
        assert.equal(url.origin, POSTGREST, 'only the fake PostgREST is reachable');
        const method = (init?.method || 'GET').toUpperCase();
        const table = url.pathname.replace('/rest/v1/', '');
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

        if (method === 'POST' && table === 'console_magic_link_consumptions') {
            const row = JSON.parse(String(init?.body)) as Row;
            const rows = tablesData.console_magic_link_consumptions ?? (tablesData.console_magic_link_consumptions = []);
            if (rows.some((r) => r.jti === row.jti)) {
                return json({ code: '23505', message: `duplicate key value violates unique constraint "console_magic_link_consumptions_pkey" DETAIL: Key (jti)=(${row.jti}) already exists.` }, 409);
            }
            rows.push(row);
            return json(row, 201);
        }
        return json([], 200);
    }) as typeof globalThis.fetch;
    return { restore: () => { globalThis.fetch = originalFetch; } };
}

function app() {
    const api = new Hono<{ Bindings: Env }>();
    api.route('/internal/console', internalConsoleRouter);
    return api;
}

async function consume(body: Record<string, unknown>, token = CONSOLE_TOKEN) {
    const res = await app().request('/internal/console/magic-link/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    }, env());
    return { res, body: await res.json() as { data?: unknown; error?: { code: string; message: string } } };
}

function future(seconds = 900): string {
    return new Date(Date.now() + seconds * 1000).toISOString();
}

test('a valid, unconsumed jti is consumed successfully (first redemption)', async (t) => {
    const fake = installFakePostgrest({});
    t.after(fake.restore);
    const { res, body } = await consume({ jti: 'jti-11111111-1111-1111-1111-111111111111', email: 'operator@example.test', expires_at: future() });
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal((body.data as { consumed: boolean }).consumed, true);
});

test('the identical jti consumed a second time is refused as ALREADY_CONSUMED, not silently accepted again (replay)', async (t) => {
    const fake = installFakePostgrest({});
    t.after(fake.restore);
    const jti = 'jti-22222222-2222-2222-2222-222222222222';
    const first = await consume({ jti, email: 'operator@example.test', expires_at: future() });
    assert.equal(first.res.status, 200);
    const second = await consume({ jti, email: 'operator@example.test', expires_at: future() });
    assert.equal(second.res.status, 409);
    assert.equal(second.body.error?.code, 'ALREADY_CONSUMED');
});

test('an already-expired expires_at is refused before any consumption attempt (EXPIRED), even for a jti never seen before', async (t) => {
    const fake = installFakePostgrest({});
    t.after(fake.restore);
    const past = new Date(Date.now() - 1000).toISOString();
    const { res, body } = await consume({ jti: 'jti-33333333-3333-3333-3333-333333333333', email: 'operator@example.test', expires_at: past });
    assert.equal(res.status, 409);
    assert.equal(body.error?.code, 'EXPIRED');
});

test('a malformed body (missing jti) is rejected with VALIDATION, never reaches the database', async (t) => {
    const fake = installFakePostgrest({});
    t.after(fake.restore);
    const { res, body } = await consume({ email: 'operator@example.test', expires_at: future() });
    assert.equal(res.status, 400);
    assert.equal(body.error?.code, 'VALIDATION');
});

test('a jti that is too short (not a real unpredictable identity) is rejected', async (t) => {
    const fake = installFakePostgrest({});
    t.after(fake.restore);
    const { res } = await consume({ jti: 'short', email: 'operator@example.test', expires_at: future() });
    assert.equal(res.status, 400);
});

test('an invalid email shape is rejected before consumption', async (t) => {
    const fake = installFakePostgrest({});
    t.after(fake.restore);
    const { res } = await consume({ jti: 'jti-44444444-4444-4444-4444-444444444444', email: 'not-an-email', expires_at: future() });
    assert.equal(res.status, 400);
});

test('a database failure on insert (not a unique-violation conflict) surfaces as 500, never a false success', async (t) => {
    const originalFetch = globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });
    globalThis.fetch = (async () => new Response(JSON.stringify({ code: 'XX000', message: 'connection reset' }), { status: 500, headers: { 'Content-Type': 'application/json' } })) as typeof globalThis.fetch;
    const { res, body } = await consume({ jti: 'jti-55555555-5555-5555-5555-555555555555', email: 'operator@example.test', expires_at: future() });
    assert.equal(res.status, 500);
    assert.equal(body.error?.code, 'DB_ERROR');
});

test('missing/wrong PLATFORM_CONSOLE_API_TOKEN is refused before any consumption logic runs', async (t) => {
    const fake = installFakePostgrest({});
    t.after(fake.restore);
    const { res } = await consume({ jti: 'jti-66666666-6666-6666-6666-666666666666', email: 'operator@example.test', expires_at: future() }, 'wrong-token');
    assert.equal(res.status, 401);
});

test('two DIFFERENT jtis for the same email both consume successfully -- consumption is keyed by jti, not by email', async (t) => {
    const fake = installFakePostgrest({});
    t.after(fake.restore);
    const first = await consume({ jti: 'jti-77777777-7777-7777-7777-777777777777', email: 'operator@example.test', expires_at: future() });
    const second = await consume({ jti: 'jti-88888888-8888-8888-8888-888888888888', email: 'operator@example.test', expires_at: future() });
    assert.equal(first.res.status, 200);
    assert.equal(second.res.status, 200, 'a second, genuinely different login attempt by the same operator must not be blocked by the first');
});
