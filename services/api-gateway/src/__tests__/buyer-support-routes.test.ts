// CAP-FB-CHAT — the buyer's support conversation on the canonical ticket system.
//
// THE control: a ticket_messages row with visibility = 'internal' is an agent's private note and must
// never reach the buyer. The second control: a buyer cannot POST one either — author_type and
// visibility are set by the server, never taken from the request.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Hono } from 'hono';
import type { Env } from '../index';
import { installBuyerSessionState } from './buyer-session-state-fake';
import { registerBuyerSupportRoutes, type BuyerTicketRow, type BuyerTicketMessageRow } from '../routes/storefront/buyer-support-routes';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const ISSUER = 'https://accounts.letbuyy.test';
const BUYER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const TICKET = 'cccccccc-3333-4333-8333-cccccccccccc';

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

const TICKET_ROW: BuyerTicketRow = { id: TICKET, ticket_ref: 'SUP-2026-ABCD1234', subject: 'Where is my order', status: 'open', topic: null, created_at: '2026-09-06T00:00:00.000Z', last_agent_message_at: null };
const PUBLIC_MSG: BuyerTicketMessageRow = { id: 'm1', author_type: 'agent', body: 'We are looking into it.', created_at: '2026-09-06T00:01:00.000Z' };

function harness(opts: { ownedBy?: string } = {}) {
    const owner = opts.ownedBy ?? BUYER;
    const calls = { list: [] as { buyer: string }[], get: [] as { buyer: string; ticket: string }[], messages: [] as string[], inserted: [] as string[] };
    const router = new Hono<{ Bindings: Env }>();
    registerBuyerSupportRoutes(router, {
        listTickets: async (_c, buyer) => { calls.list.push({ buyer }); return { data: [TICKET_ROW], error: null }; },
        // Models the real query: scoped by BOTH ids, so another buyer's ticket simply does not match.
        getTicket: async (_c, buyer, ticket) => { calls.get.push({ buyer, ticket }); return { data: buyer === owner && ticket === TICKET ? TICKET_ROW : null, error: null }; },
        listPublicMessages: async (_c, ticket) => { calls.messages.push(ticket); return { data: [PUBLIC_MSG], error: null }; },
        openTicket: async () => ({ data: TICKET_ROW, error: null }),
        addRequesterMessage: async (_c, ticket, body) => { calls.inserted.push(body); return { data: { id: 'm2', author_type: 'requester', body, created_at: 'now' }, error: null }; },
    });
    const app = new Hono<{ Bindings: Env }>();
    installBuyerSessionState(app);
    app.route('/storefront', router);
    return { app, calls };
}
const env = (jwks: string) => ({ LETBUYY_IDENTITY_ISSUER: ISSUER, LETBUYY_IDENTITY_PUBLIC_JWKS: jwks } as unknown as Env);

test('the ticket list is scoped to the TOKEN subject, not a query parameter', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request(`/storefront/buyer/support/tickets?requester_user_id=${OTHER}`, { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.list, [{ buyer: BUYER }]);
});

test('another buyer cannot read a ticket they do not own, and cannot tell it exists', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ ownedBy: OTHER });
    const res = await h.app.request(`/storefront/buyer/support/tickets/${TICKET}/messages`, { headers: { 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) } }, env(jwks));
    assert.equal(res.status, 404);
    assert.deepEqual(h.calls.messages, [], 'ownership is checked BEFORE any message is read');
});

test('ownership is verified before a message is appended', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness({ ownedBy: OTHER });
    const res = await h.app.request(`/storefront/buyer/support/tickets/${TICKET}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: JSON.stringify({ body: 'hello' }) }, env(jwks));
    assert.equal(res.status, 404);
    assert.deepEqual(h.calls.inserted, [], 'a message must never land on a stranger\'s ticket');
});

test('a buyer cannot choose author_type or visibility', async () => {
    const { privateKey, jwks } = await keys();
    const h = harness();
    const res = await h.app.request(`/storefront/buyer/support/tickets/${TICKET}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: JSON.stringify({ body: 'hello', author_type: 'agent', visibility: 'internal' }) }, env(jwks));
    assert.equal(res.status, 201);
    const body = await res.json() as { data: { author_type: string } };
    assert.equal(body.data.author_type, 'requester', 'the server decides who the author is');
});

test('an oversized or empty message body is refused before any write', async () => {
    const { privateKey, jwks } = await keys();
    for (const value of ['', '   ', 'x'.repeat(4001)]) {
        const h = harness();
        const res = await h.app.request(`/storefront/buyer/support/tickets/${TICKET}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': await tok(privateKey, BUYER) }, body: JSON.stringify({ body: value }) }, env(jwks));
        assert.equal(res.status, 400);
        assert.deepEqual(h.calls.inserted, []);
    }
});

test('support routes require a buyer session', async () => {
    const { jwks } = await keys();
    const h = harness();
    const res = await h.app.request('/storefront/buyer/support/tickets', undefined, env(jwks));
    assert.equal(res.status, 401);
    assert.deepEqual(h.calls.list, []);
});

// ── Source contracts ────────────────────────────────────────────────────────────
function code(s: string) { return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ').replace(/`(?:[^`\\]|\\.)*`/g, '` `'); }
const wiring = code(readFileSync(join(SRC, 'routes/storefront/buyer-realm-wiring.ts'), 'utf8'));
const block = (() => {
    const at = wiring.indexOf('registerBuyerSupportRoutes(router');
    assert.ok(at > 0);
    return wiring.slice(at, wiring.indexOf('registerPersonalizationRoutes(router', at));
})();
const KEYS = ['listTickets', 'getTicket', 'listPublicMessages', 'openTicket', 'addRequesterMessage'];
function dep(name: string) {
    const at = block.indexOf(`${name}:`);
    assert.ok(at > 0, `${name} should be wired`);
    const rest = block.slice(at + name.length + 1);
    const ends = KEYS.filter((k) => k !== name).map((k) => rest.indexOf(`${k}:`)).filter((i) => i > 0);
    return ends.length ? rest.slice(0, Math.min(...ends)) : rest;
}

test('the dependency extractor stops at the next dependency', () => {
    const body = dep('listPublicMessages');
    assert.match(body, /ticket_messages/);
    assert.doesNotMatch(body, /openTicket|support_tickets/, 'must not run past into a neighbour');
});

test('SOURCE: the buyer message query excludes INTERNAL agent notes', () => {
    const body = dep('listPublicMessages');
    assert.match(body, /\.eq\('visibility', 'public'\)/, "an agent's internal note must never reach the buyer");
    assert.match(body, /\.eq\('ticket_id', ticketId\)/);
    assert.match(body, /\.is\('deleted_at', null\)/);
});

test('SOURCE: every ticket read is scoped by the requester, not by the ticket alone', () => {
    for (const op of ['listTickets', 'getTicket']) {
        const body = dep(op);
        assert.match(body, /\.eq\('requester_user_id', buyerAccountId\)/, `${op} must scope by the buyer`);
        assert.match(body, /\.eq\('requester_type', 'customer'\)/, `${op} must not match a merchant's ticket`);
    }
    assert.match(dep('getTicket'), /\.eq\('id', ticketId\)/);
});

test('SOURCE: the server sets author_type and visibility on every buyer write', () => {
    for (const op of ['openTicket', 'addRequesterMessage']) {
        const body = dep(op);
        assert.match(body, /author_type: 'requester'/, `${op} must fix the author type`);
        assert.match(body, /visibility: 'public'/, `${op} must fix the visibility`);
    }
    // requester_type is fixed too: a buyer must not be able to open a ticket as a merchant.
    assert.match(dep('openTicket'), /requester_type: 'customer'/);
});

test('SOURCE: the buyer surface reuses the operator ticket-reference generator', () => {
    // One ticket system must not grow two human-facing reference formats.
    assert.match(block, /ticket_ref: generateTicketRef\(/);
    assert.match(wiring, /from '\.\.\/operations\/support'/);
});
