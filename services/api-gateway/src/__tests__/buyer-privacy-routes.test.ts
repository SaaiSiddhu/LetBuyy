// Phase 2 / F2.7 (Section 11) — buyer-facing data-rights request intake.
//
// THE control: this is INTAKE ONLY. A request never becomes an export or a deletion here. Status
// is never reported as anything resembling success unless a real fulfillment outcome was recorded
// (nothing writes one today — D05 is open, no export/erasure execution exists). A second request
// of the same type while one is still open returns the existing one, never a duplicate, even under
// real concurrency (migration 262's partial unique index, not just the app-level pre-check).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import { registerBuyerPrivacyRoutes, type PrivacyRequestRow } from '../routes/storefront/buyer-privacy-routes';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

async function keys() {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
    return { privateKey, jwks: JSON.stringify({ keys: [{ ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test' }] }) };
}
async function tok(privateKey: CryptoKey, sub: string) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ realm: 'buyer', token_use: 'buyer_session' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'test' })
        .setIssuer(ISSUER).setAudience('letbuyy:buyer-session').setSubject(sub)
        .setIssuedAt(now).setExpirationTime(now + 3600).setJti('0123456789abcdef0123456789abcdef').sign(privateKey);
}

const OPEN_ACCESS_REQUEST: PrivacyRequestRow = { id: 'req-1', ticket_ref: 'PRIV-1', status: 'open', metadata: { privacy_request_type: 'access' }, created_at: '2026-09-27T00:00:00.000Z', updated_at: '2026-09-27T00:00:00.000Z' };

type CreateResult = { data: PrivacyRequestRow | null; error: unknown; created: boolean };

function harness(opts: {
    existingOpen?: PrivacyRequestRow | null;
    listData?: PrivacyRequestRow[];
    findError?: unknown;
    createResult?: CreateResult;
} = {}) {
    const calls = { find: [] as { buyer: string; type: string }[], create: [] as { buyer: string; type: string; notes: string | null }[], list: [] as { buyer: string }[] };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerPrivacyRoutes(router, {
        findOpenRequest: async (_c, buyer, type) => {
            calls.find.push({ buyer, type });
            if (opts.findError !== undefined) return { data: null, error: opts.findError };
            return { data: opts.existingOpen ?? null, error: null };
        },
        createRequest: async (_c, buyer, type, notes) => {
            calls.create.push({ buyer, type, notes });
            if (opts.createResult) return opts.createResult;
            return { data: { id: 'req-new', ticket_ref: 'PRIV-NEW', status: 'open', metadata: { privacy_request_type: type }, created_at: 'now', updated_at: 'now' }, error: null, created: true };
        },
        listRequests: async (_c, buyer) => { calls.list.push({ buyer }); return { data: opts.listData ?? [OPEN_ACCESS_REQUEST], error: null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, calls };
}
const env = (jwks: string) => ({ LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);
async function post(app: Hono<{ Bindings: Env }>, jwks: string, privateKey: CryptoKey, sub: string, body: unknown) {
    return app.request('/storefront/buyer/privacy-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, sub) }, body: JSON.stringify(body) }, env(jwks));
}

test('a request requires a buyer session', async () => {
    const { jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/privacy-requests', undefined, env(jwks));
    assert.equal(res.status, 401);
    assert.deepEqual(h.calls.list, []);
});

test('the list is scoped to the TOKEN subject, never a query parameter', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request(`/storefront/buyer/privacy-requests?buyer_account_id=${OTHER}`, { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.list, [{ buyer: BUYER }]);
});

test('another buyer cannot read a stranger\'s privacy requests: the list dependency only ever receives the SESSION buyer, never a value derived from anyone else', async () => {
    // The scoping guarantee here is identical in shape to buyer-support-routes.ts's own (already
    // tested) requester_user_id scoping -- this asserts the route layer never has an opportunity to
    // pass any id but the verified session's own.
    const { privateKey, jwks } = await keys();
    const h = harness({ listData: [OPEN_ACCESS_REQUEST] });
    await h.app.request('/storefront/buyer/privacy-requests', { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, OTHER) } }, env(jwks));
    assert.deepEqual(h.calls.list, [{ buyer: OTHER }]);
});

test('an invalid type is refused before any lookup or write', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await post(h.app, jwks, privateKey, BUYER, { type: 'correction' });
    assert.equal(res.status, 400);
    assert.deepEqual(h.calls.find, []);
    assert.deepEqual(h.calls.create, []);
});

test('a null JSON body is refused with 400, not an uncaught property-access error', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/privacy-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: 'null' }, env(jwks));
    assert.equal(res.status, 400);
    assert.deepEqual(h.calls.find, []);
});

test('an array JSON body is refused', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/privacy-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: '[1,2,3]' }, env(jwks));
    assert.equal(res.status, 400);
});

test('a scalar JSON body (string/number/boolean) is refused', async () => {
    const { privateKey, jwks } = await keys();
    for (const raw of ['"access"', '42', 'true']) {
        const h = harness();
        const res = await h.app.request('/storefront/buyer/privacy-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: raw }, env(jwks));
        assert.equal(res.status, 400, `raw body ${raw} should be refused`);
    }
});

test('notes of the wrong type (not a string) is refused, not silently coerced', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await post(h.app, jwks, privateKey, BUYER, { type: 'access', notes: 12345 });
    assert.equal(res.status, 400);
    assert.deepEqual(h.calls.create, []);
});

test('oversized notes are refused before any write', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await post(h.app, jwks, privateKey, BUYER, { type: 'access', notes: 'x'.repeat(1001) });
    assert.equal(res.status, 400);
    assert.deepEqual(h.calls.create, []);
});

test('a new request is created (201) and scoped to the session buyer, never a client-supplied id', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ existingOpen: null });
    const res = await post(h.app, jwks, privateKey, BUYER, { type: 'erasure', buyer_account_id: OTHER });
    assert.equal(res.status, 201);
    assert.deepEqual(h.calls.create, [{ buyer: BUYER, type: 'erasure', notes: null }], 'the buyer_account_id in the body must be ignored; the session subject is authoritative');
});

test('a second request of the same type, while one is open, is idempotent via the fast-path check: 200 with the EXISTING request', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ existingOpen: OPEN_ACCESS_REQUEST });
    const res = await post(h.app, jwks, privateKey, BUYER, { type: 'access' });
    assert.equal(res.status, 200, 'idempotent replay is 200, not 201');
    assert.deepEqual(h.calls.create, [], 'no duplicate ticket is created');
    const body = await res.json() as { data: { id: string } };
    assert.equal(body.data.id, OPEN_ACCESS_REQUEST.id);
});

test('a conflict detected only inside createRequest (the fast-path check missed a concurrent request) still returns 200, not 201', async () => {
    // Models the real race this route is built to survive: findOpenRequest sees nothing (the other
    // request had not committed yet), but the database-level unique index makes createRequest's own
    // insert lose the race, and its dependency contract requires it to resolve that as created:false
    // with the winning row -- never surfaced to the caller as a fresh 201.
    const { privateKey, jwks } = await keys();
    const h = harness({ existingOpen: null, createResult: { data: OPEN_ACCESS_REQUEST, error: null, created: false } });
    const res = await post(h.app, jwks, privateKey, BUYER, { type: 'access' });
    assert.equal(res.status, 200, 'a conflict resolved inside createRequest must read back as 200, not 201');
    const body = await res.json() as { data: { id: string } };
    assert.equal(body.data.id, OPEN_ACCESS_REQUEST.id);
});

test('a database failure on the fast-path check surfaces as 500, never a false success', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ findError: { code: 'XX000', message: 'db unavailable' } });
    const res = await post(h.app, jwks, privateKey, BUYER, { type: 'access' });
    assert.equal(res.status, 500);
    assert.deepEqual(h.calls.create, []);
});

test('a database failure on create (not a unique-violation conflict) surfaces as 500', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ existingOpen: null, createResult: { data: null, error: { code: 'XX000', message: 'db unavailable' }, created: false } });
    const res = await post(h.app, jwks, privateKey, BUYER, { type: 'access' });
    assert.equal(res.status, 500);
});

// ── Status vocabulary: never optimistic, never silently defaults toward success ──────────────

function listedWith(row: Partial<PrivacyRequestRow>) {
    return { ...OPEN_ACCESS_REQUEST, ...row };
}
async function statusFor(row: PrivacyRequestRow): Promise<string> {
    const { privateKey, jwks } = await keys();
    const h = harness({ listData: [row] });
    const res = await h.app.request('/storefront/buyer/privacy-requests', { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    const body = await res.json() as { data: Array<{ status: string }> };
    return body.data[0].status;
}

test('status: open -> received', async () => {
    assert.equal(await statusFor(listedWith({ status: 'open' })), 'received');
});
test('status: pending_customer / pending_internal / escalated -> in_review', async () => {
    for (const s of ['pending_customer', 'pending_internal', 'escalated']) {
        assert.equal(await statusFor(listedWith({ status: s })), 'in_review', s);
    }
});
test('status: resolved WITHOUT a recorded fulfillment outcome -> closed_no_fulfillment, never completed/fulfilled', async () => {
    const result = await statusFor(listedWith({ status: 'resolved' }));
    assert.equal(result, 'closed_no_fulfillment');
    assert.notEqual(result, 'completed');
    assert.notEqual(result, 'fulfilled');
});
test('status: closed WITHOUT a recorded fulfillment outcome -> closed_no_fulfillment', async () => {
    assert.equal(await statusFor(listedWith({ status: 'closed' })), 'closed_no_fulfillment');
});
test('status: resolved/closed WITH an explicit, known fulfillment outcome recorded -> fulfilled', async () => {
    const row = listedWith({ status: 'resolved', metadata: { privacy_request_type: 'access', fulfillment_outcome: 'fulfilled' } });
    assert.equal(await statusFor(row), 'fulfilled');
});
test('status: resolved with an UNRECOGNIZED fulfillment_outcome value does not count as fulfilled', async () => {
    // Guards against a typo or a future, not-yet-vetted outcome value silently reading as success.
    const row = listedWith({ status: 'resolved', metadata: { privacy_request_type: 'access', fulfillment_outcome: 'sort-of-done' } });
    assert.equal(await statusFor(row), 'closed_no_fulfillment');
});
test('status: an unrecognized ticket status reads as unknown, never defaults toward success', async () => {
    assert.equal(await statusFor(listedWith({ status: 'some-future-status' })), 'unknown');
});
test('status: null/missing metadata on a resolved ticket does not throw and still reads honestly', async () => {
    assert.equal(await statusFor(listedWith({ status: 'resolved', metadata: null })), 'closed_no_fulfillment');
});

test('the serialized response is minimal: no raw ticket status, no requester id, no internal fields', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ listData: [OPEN_ACCESS_REQUEST] });
    const res = await h.app.request('/storefront/buyer/privacy-requests', { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    const body = await res.json() as { data: Array<Record<string, unknown>> };
    assert.deepEqual(Object.keys(body.data[0]).sort(), ['created_at', 'id', 'reference', 'status', 'type', 'updated_at']);
});

// ── Source contracts ────────────────────────────────────────────────────────────
function code(s: string) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ').replace(/`(?:[^`\\]|\\.)*`/g, '` `'); }
const wiring = code(readFileSync(join(SRC, 'routes/storefront/buyer-realm-wiring.ts'), 'utf8'));
const block = (() => {
    const at = wiring.indexOf('registerBuyerPrivacyRoutes(router');
    assert.ok(at > 0, 'registerBuyerPrivacyRoutes should be wired');
    return wiring.slice(at);
})();

test('SOURCE: requester_type and topic are fixed server-side, never taken from the request', () => {
    assert.match(block, /requester_type: 'customer'/);
    assert.match(block, /topic: 'privacy'/);
});

test('SOURCE: every privacy-request read and write is scoped by the session buyer', () => {
    for (const marker of ["requester_user_id', buyerAccountId", 'requester_user_id: buyerAccountId']) {
        assert.ok(block.includes(marker), `expected "${marker}" in the wiring`);
    }
});

test('SOURCE: the open-request idempotency check excludes resolved/closed tickets', () => {
    const at = block.indexOf('findOpenRequest:');
    const body = block.slice(at, block.indexOf('createRequest:', at));
    assert.match(body, /resolved,closed/);
});

test('SOURCE: createRequest catches a unique-constraint violation specifically, not every error, and re-reads rather than fabricating a row', () => {
    const at = block.indexOf('createRequest:');
    const body = block.slice(at, block.indexOf('listRequests:', at));
    assert.match(body, /UNIQUE_VIOLATION/, 'must branch on the specific SQLSTATE, not treat every error as a conflict');
    assert.match(body, /created:\s*false/, 'the conflict path must report created: false');
    assert.match(body, /created:\s*true/, 'the genuine-insert path must report created: true');
});

test('SOURCE: migration 262 defines the actual atomicity primitive the route relies on', () => {
    const migration = readFileSync(join(SRC, '..', '..', '..', 'database/supabase/migrations/262_support_tickets_privacy_open_request_unique.sql'), 'utf8');
    assert.match(migration, /CREATE UNIQUE INDEX/i);
    assert.match(migration, /requester_user_id/);
    assert.match(migration, /privacy_request_type/);
    assert.match(migration, /status NOT IN \('resolved', 'closed'\)/);
});
