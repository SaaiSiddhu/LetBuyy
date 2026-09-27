// Phase 2 / F2.7 (Section 11) — buyer-facing data-rights request intake.
//
// THE control: this is INTAKE ONLY. A request never becomes an export or a deletion here, status
// never silently claims "completed" for anything but a genuinely resolved/closed ticket, and a
// second request of the same type while one is still open returns the existing one rather than
// creating a duplicate.

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

function harness(opts: { existingOpen?: PrivacyRequestRow | null } = {}) {
    const calls = { find: [] as { buyer: string; type: string }[], create: [] as { buyer: string; type: string; notes: string | null }[], list: [] as { buyer: string }[] };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerPrivacyRoutes(router, {
        findOpenRequest: async (_c, buyer, type) => { calls.find.push({ buyer, type }); return { data: opts.existingOpen ?? null, error: null }; },
        createRequest: async (_c, buyer, type, notes) => {
            calls.create.push({ buyer, type, notes });
            return { data: { id: 'req-new', ticket_ref: 'PRIV-NEW', status: 'open', metadata: { privacy_request_type: type }, created_at: 'now', updated_at: 'now' }, error: null };
        },
        listRequests: async (_c, buyer) => { calls.list.push({ buyer }); return { data: [OPEN_ACCESS_REQUEST], error: null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, calls };
}
const env = (jwks: string) => ({ LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);

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

test('an invalid type is refused before any lookup or write', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/privacy-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: JSON.stringify({ type: 'correction' }) }, env(jwks));
    assert.equal(res.status, 400);
    assert.deepEqual(h.calls.find, []);
    assert.deepEqual(h.calls.create, []);
});

test('oversized notes are refused before any write', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/privacy-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: JSON.stringify({ type: 'access', notes: 'x'.repeat(1001) }) }, env(jwks));
    assert.equal(res.status, 400);
    assert.deepEqual(h.calls.create, []);
});

test('a new request is created (201) and scoped to the session buyer, never a client-supplied id', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ existingOpen: null });
    const res = await h.app.request('/storefront/buyer/privacy-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: JSON.stringify({ type: 'erasure', buyer_account_id: OTHER }) }, env(jwks));
    assert.equal(res.status, 201);
    assert.deepEqual(h.calls.create, [{ buyer: BUYER, type: 'erasure', notes: null }], 'the buyer_account_id in the body must be ignored; the session subject is authoritative');
});

test('a second request of the same type, while one is open, is idempotent: 200 with the EXISTING request, not a duplicate', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ existingOpen: OPEN_ACCESS_REQUEST });
    const res = await h.app.request('/storefront/buyer/privacy-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: JSON.stringify({ type: 'access' }) }, env(jwks));
    assert.equal(res.status, 200, 'idempotent replay is 200, not 201');
    assert.deepEqual(h.calls.create, [], 'no duplicate ticket is created');
    const body = await res.json() as { data: { id: string } };
    assert.equal(body.data.id, OPEN_ACCESS_REQUEST.id);
});

test('status is never reported as raw ticket workflow vocabulary, and never claims completion early', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/privacy-requests', { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    const body = await res.json() as { data: Array<{ status: string }> };
    assert.equal(body.data[0].status, 'received', "an 'open' ticket must read back as 'received', not the internal word");
    assert.ok(!['open', 'pending_customer', 'pending_internal', 'escalated'].includes(body.data[0].status));
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
