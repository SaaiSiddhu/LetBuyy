// Buyer privacy-request INTAKE, proven against a real database: concurrency, ownership, truthful status.
//
// Why this exists. The privacy routes (routes/storefront/buyer-privacy-routes.ts) promise three things a fake PostgREST
// cannot prove: that two requests racing for the same (buyer, type) leave exactly ONE unresolved row (the guarantee is the
// partial unique index of migration 262, not the application's find-then-insert), that a buyer only ever reaches their own
// requests, and that a closed support ticket never reads as an export or an erasure that happened. The unit tests
// (buyer-privacy-routes.test.ts) model those with fakes. This suite proves them with a real Postgres, a real PostgREST and
// the production wiring, and it persists: an earlier one-off proof of the concurrency (a throwaway script) was never kept.
//
// What is real. Requests go through the WORKER'S OWN fetch (the default export of src/index.ts), so they pass the real global
// middleware, the real `/v1/storefront` route registration, the real requireBuyerSession (an ES256 session verified against
// a configured JWKS, issuer, audience, realm, token use, expiry, replay id and session epoch, then buyer_accounts read for
// status and epoch), the production dependency wiring in routes/storefront/buyer-realm-wiring.ts, the tenant-guarded Supabase
// client, a real PostgREST and a real Postgres whose migrations, constraints and triggers are all in place. Nothing is mocked.
//
// What is NOT. (1) The gateway reaches the database as the service role through PostgREST, which bypasses row-level
// security: this proves the routes, the tenant guard, the constraints and the index, not RLS policies. (2) The credential is
// signed by a key this suite generates and configures as the identity public key; identity-platform's own issuance is a
// different system and is not exercised. (3) The tap (see gateway-harness.ts) sits on the one HTTP hop between the gateway and
// the owned PostgREST. It is used in exactly two ways, both stated where they occur: to hold concurrent INSERTs until all of
// them have arrived (so every request has already passed its fast-path read and the creation conflict is reached every
// time, not by luck), and to inject one specific fault (a collision on an unrelated column, a failed readback, a lost
// response). Everything downstream of an injected fault is real. (4) This is a router-and-database proof of intake, not a
// buyer journey, and not an export or an erasure: neither exists.
//
// Runs only in the owned database lane (scripts/governance/run-executable-suites.mjs). There is no skip path.

import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { LETBUYY_BUYER_SESSION_COOKIE } from '@letbuyy/auth-core';
import {
    CLIENT_ADDRESS_HEADER,
    Gateway,
    MERCHANT_SESSION_AUDIENCE,
    buyerHeaders,
    gatewayEnv,
    mintSession,
    newBarrier,
    newIdentityKeys,
    passThrough,
    queryJson,
    restJson,
    seedBuyerAccount,
    tapRest,
    type Barrier,
    type IdentityKeys,
    type RestCall,
    type RestTap,
    type SessionOverrides,
} from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const { psql, psqlExpectError } = owned;

const REQUESTS = '/v1/storefront/buyer/privacy-requests';
const SUPPORT_TICKETS = '/v1/storefront/buyer/support/tickets';
const PRIVACY_INDEX = 'support_tickets_privacy_open_request_uidx';

let keys: IdentityKeys;
let gateway: Gateway;

before(async () => {
    keys = await newIdentityKeys();
    gateway = new Gateway(gatewayEnv(owned, keys));
});

afterEach(async () => {
    await gateway.settle();
});

// --------------------------------------------------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------------------------------------------------

async function post(buyerId: string, body: unknown, overrides?: SessionOverrides) {
    return gateway.request(REQUESTS, {
        method: 'POST',
        headers: await buyerHeaders(keys, buyerId, overrides),
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

async function list(buyerId: string, query = '') {
    return gateway.request(`${REQUESTS}${query}`, { headers: await buyerHeaders(keys, buyerId) });
}

interface TicketRow {
    id: string;
    ticket_ref: string;
    requester_user_id: string | null;
    requester_type: string;
    topic: string;
    status: string;
    site_id: string | null;
    channel: string;
    priority: string;
    metadata: unknown;
    deleted_at: string | null;
}

/** Every support ticket row whose requester is this id, whatever its topic, status or deletion state. */
function ticketsOf(requesterId: string): TicketRow[] {
    return queryJson<TicketRow[]>(psql, `
        SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at, t.id), '[]'::jsonb)::text
        FROM (SELECT id, ticket_ref, requester_user_id, requester_type, topic, status, site_id, channel, priority, metadata, deleted_at, created_at
              FROM support_tickets WHERE requester_user_id = '${requesterId}') t;
    `);
}

function messagesOf(ticketId: string): Array<{ author_type: string; visibility: string; body: string }> {
    return queryJson(psql, `
        SELECT coalesce(jsonb_agg(jsonb_build_object('author_type', m.author_type, 'visibility', m.visibility, 'body', m.body) ORDER BY m.created_at, m.id), '[]'::jsonb)::text
        FROM ticket_messages m WHERE m.ticket_id = '${ticketId}';
    `);
}

const openPrivacyCount = (requesterId: string, type: string): number => Number(psql(`
    SELECT count(*) FROM support_tickets
    WHERE requester_user_id = '${requesterId}' AND topic = 'privacy' AND metadata->>'privacy_request_type' = '${type}'
      AND status NOT IN ('resolved', 'closed') AND deleted_at IS NULL;
`));

const ticketCount = (): number => Number(psql('SELECT count(*) FROM support_tickets;'));
const messageCount = (): number => Number(psql('SELECT count(*) FROM ticket_messages;'));

const isPrivacyInsert = (call: RestCall): boolean =>
    call.method === 'POST' && call.resource === 'support_tickets' && (call.json as { topic?: string } | null)?.topic === 'privacy';
/** The route's reads of a buyer's open request of one type: the fast path before an INSERT and the re-read after a conflict. */
const isPrivacyRead = (call: RestCall): boolean =>
    call.method === 'GET' && call.resource === 'support_tickets' && call.search.get('topic') === 'eq.privacy' && call.search.has('metadata->>privacy_request_type');
const touchesTable = (call: RestCall, table: string): boolean => call.resource === table;

function ticketRef(): string {
    return `SUP-2026-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

interface InsertOptions {
    requester?: string | null;
    requesterType?: string;
    topic?: string;
    status?: string;
    metadata?: string;
    softDeleted?: boolean;
    siteId?: string | null;
    ref?: string;
}

/** A support ticket written straight into the owned database, for the invariant tests and for fixtures only. */
function insertTicketSql(options: InsertOptions): string {
    const requester = options.requester === null ? 'NULL' : `'${options.requester}'`;
    const metadata = (options.metadata ?? '{}').replaceAll("'", "''");
    return `
        INSERT INTO support_tickets (ticket_ref, requester_type, requester_user_id, subject, channel, topic, priority, status, metadata, deleted_at, site_id)
        VALUES ('${options.ref ?? ticketRef()}', '${options.requesterType ?? 'customer'}', ${requester}, 'Synthetic privacy fixture', 'api',
                '${options.topic ?? 'privacy'}', 'normal', '${options.status ?? 'open'}', '${metadata}'::jsonb,
                ${options.softDeleted ? 'now()' : 'NULL'}, ${options.siteId ? `'${options.siteId}'` : 'NULL'});
    `;
}

const privacyMetadata = (type: string): string => JSON.stringify({ privacy_request_type: type });

/** Inserts a ticket and returns the database's error text, or '' when it was accepted. */
const tryInsert = (options: InsertOptions): string => psqlExpectError(insertTicketSql(options));

// --------------------------------------------------------------------------------------------------------------------
// 1. Real authentication: the session decides who the buyer is, and nothing is written before it has been verified
// --------------------------------------------------------------------------------------------------------------------

test('without a session credential nothing is read from or written to the ticket tables, and the answer is 401', async () => {
    const tap = tapRest(owned.restUrl, passThrough);
    const before = { tickets: ticketCount(), messages: messageCount() };
    try {
        const noToken = await gateway.request(REQUESTS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'access' }) });
        const listNoToken = await gateway.request(REQUESTS);
        const garbageHeader = await gateway.request(REQUESTS, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': 'not-a-token' }, body: JSON.stringify({ type: 'access' }) });
        const garbageCookie = await gateway.request(REQUESTS, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: `${LETBUYY_BUYER_SESSION_COOKIE}=still.not.atoken` }, body: JSON.stringify({ type: 'access' }) });
        for (const response of [noToken, listNoToken, garbageHeader, garbageCookie]) {
            assert.equal(response.status, 401, response.text);
            assert.equal(response.json?.success, false);
            assert.equal(response.json?.error?.code, 'UNAUTHORIZED');
        }
    } finally {
        tap.restore();
    }
    assert.equal(tap.calls.filter((call) => touchesTable(call, 'support_tickets') || touchesTable(call, 'ticket_messages') || touchesTable(call, 'buyer_accounts')).length, 0,
        'the session middleware runs before any dependency: no ticket, message or buyer read or write was attempted');
    assert.deepEqual({ tickets: ticketCount(), messages: messageCount() }, before);
});

test('credentials that are well formed but not a platform buyer session are refused, each one before any ticket is touched', async () => {
    const victim = seedBuyerAccount(psql, 'realm');
    const otherKey = await newIdentityKeys('some-other-key');
    // The same credential family identity-platform issues for OTHER realms and audiences, and the ways a buyer token can be wrong.
    const cases: Array<{ name: string; overrides: SessionOverrides; subject?: string }> = [
        { name: 'a MERCHANT session (merchant audience, realm and token use)', overrides: { audience: MERCHANT_SESSION_AUDIENCE, realm: 'merchant', tokenUse: 'merchant_session' } },
        { name: 'a STOREFRONT session (its own audience and token use)', overrides: { audience: 'letbuyy:storefront-session', tokenUse: 'storefront_session', extraClaims: { site_id: crypto.randomUUID() }, epoch: 1 } },
        { name: 'the right realm and use but another audience', overrides: { audience: 'letbuyy:somewhere-else' } },
        { name: 'another issuer', overrides: { issuer: 'https://accounts.not-letbuyy.test' } },
        { name: 'the buyer audience but a merchant realm claim', overrides: { realm: 'merchant' } },
        { name: 'the buyer audience and realm but a merchant token use', overrides: { tokenUse: 'merchant_session' } },
        { name: 'a token signed by a different key under the same key id', overrides: { signWith: otherKey.privateKey } },
        { name: 'a token using a symmetric algorithm', overrides: { algorithm: 'HS256' } },
        { name: 'an expired token', overrides: { expiresInSeconds: -30, issuedAtOffsetSeconds: -3600 } },
        { name: 'a token issued in the future', overrides: { issuedAtOffsetSeconds: 600 } },
        { name: 'a token with no replay id', overrides: { jti: null } },
        { name: 'a token with a too-short replay id', overrides: { jti: 'short' } },
        { name: 'a token for an account that does not exist', overrides: {}, subject: crypto.randomUUID() },
        { name: 'a token from a session epoch the account has not reached', overrides: { epoch: 9 } },
    ];
    const tap = tapRest(owned.restUrl, passThrough);
    const before = { tickets: ticketCount(), messages: messageCount() };
    try {
        for (const { name, overrides, subject } of cases) {
            const sub = subject ?? victim.id;
            const created = await post(sub, { type: 'access', notes: 'must never be stored' }, overrides);
            const listed = await gateway.request(REQUESTS, { headers: await buyerHeaders(keys, sub, overrides) });
            assert.equal(created.status, 401, `${name}: POST -> ${created.status} ${created.text}`);
            assert.equal(listed.status, 401, `${name}: GET -> ${listed.status} ${listed.text}`);
            assert.equal(created.json?.error?.code, 'UNAUTHORIZED', name);
            assert.doesNotMatch(created.text, /signature|audience|issuer|realm|epoch|expired/i, `${name}: the reason is not echoed to the caller`);
        }
    } finally {
        tap.restore();
    }
    assert.equal(tap.calls.filter((call) => touchesTable(call, 'support_tickets') || touchesTable(call, 'ticket_messages')).length, 0, 'no refused credential reached a ticket table');
    assert.deepEqual({ tickets: ticketCount(), messages: messageCount() }, before, 'and nothing was written anywhere');
    assert.equal(ticketsOf(victim.id).length, 0);
});

test('a forged or malformed credential is refused before the buyer table is even read; a verified one is checked against the account', async () => {
    const buyer = seedBuyerAccount(psql, 'order');
    const forged = tapRest(owned.restUrl, passThrough);
    try {
        const otherKey = await newIdentityKeys('forger');
        const response = await post(buyer.id, { type: 'access' }, { signWith: otherKey.privateKey });
        assert.equal(response.status, 401);
    } finally {
        forged.restore();
    }
    assert.equal(forged.calls.filter((call) => touchesTable(call, 'buyer_accounts')).length, 0, 'a bad signature never costs a database read');

    const valid = tapRest(owned.restUrl, passThrough);
    try {
        const response = await post(buyer.id, { type: 'access' });
        assert.equal(response.status, 201, response.text);
    } finally {
        valid.restore();
    }
    const resources = valid.calls.filter((call) => touchesTable(call, 'buyer_accounts') || touchesTable(call, 'support_tickets')).map((call) => `${call.method} ${call.resource}`);
    assert.equal(resources[0], 'GET buyer_accounts', 'the account is read (status and session epoch) before any ticket is read or written');
    assert.ok(resources.indexOf('POST support_tickets') > 0);
});

test('a revoked session (the epoch moved on), a disabled account and a failing session check all stop at the middleware and create nothing', async () => {
    const revoked = seedBuyerAccount(psql, 'revoked');
    const staleToken = await mintSession(keys, revoked.id); // no epoch claim = epoch 1
    const control = await gateway.request(REQUESTS, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': staleToken }, body: JSON.stringify({ type: 'access' }) });
    assert.equal(control.status, 201, `the same credential is good before the revocation: ${control.text}`);
    psql(`SELECT revoke_buyer_sessions('${revoked.id}'::uuid);`);
    assert.equal(Number(psql(`SELECT session_epoch FROM buyer_accounts WHERE id = '${revoked.id}';`)), 2);

    const afterRevocation = await gateway.request(REQUESTS, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LetBuyy-Buyer-Session': staleToken }, body: JSON.stringify({ type: 'erasure' }) });
    assert.equal(afterRevocation.status, 401, 'sign-out-everywhere ends the old credential on the next request');
    assert.equal(openPrivacyCount(revoked.id, 'erasure'), 0, 'and the refused request created nothing');
    const fresh = await post(revoked.id, { type: 'erasure' }, { epoch: 2 });
    assert.equal(fresh.status, 201, `a credential from the current epoch is accepted: ${fresh.text}`);

    const disabled = seedBuyerAccount(psql, 'disabled', 'disabled');
    const refused = await post(disabled.id, { type: 'access' });
    assert.equal(refused.status, 403);
    assert.equal(refused.json?.error?.code, 'BUYER_DISABLED');
    assert.equal(ticketsOf(disabled.id).length, 0);

    // Fail closed: if the account cannot be read, the credential is NOT accepted on its signature alone.
    const live = seedBuyerAccount(psql, 'unreadable');
    const tap = tapRest(owned.restUrl, async (call, forward) => (touchesTable(call, 'buyer_accounts') ? restJson(503, { message: 'the database is unavailable' }) : forward()));
    let unavailable;
    try {
        unavailable = await post(live.id, { type: 'access' });
    } finally {
        tap.restore();
    }
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.json?.error?.code, 'SESSION_CHECK_UNAVAILABLE');
    assert.equal(tap.calls.filter((call) => touchesTable(call, 'support_tickets')).length, 0);
    assert.equal(ticketsOf(live.id).length, 0);
});

test('the session buyer is the only buyer: the body, the query string and a cookie cannot name another, and no request field is stored as sent', async () => {
    const mine = seedBuyerAccount(psql, 'mine');
    const theirs = seedBuyerAccount(psql, 'theirs');
    // The other buyer already has an open request of the same type. A route that let the body or the query string choose the buyer would
    // answer this call with THEIR request (a 200 naming their id) instead of creating mine.
    const theirOwn = await post(theirs.id, { type: 'access', notes: 'their private note' });
    assert.equal(theirOwn.status, 201, theirOwn.text);
    const theirId = theirOwn.json?.data?.id as string;
    const site = crypto.randomUUID();
    const hostile = {
        type: 'access',
        notes: '  please send my data  ',
        // Every field a client might try to steer. None is part of the contract: all are ignored.
        buyer_account_id: theirs.id,
        requester_user_id: theirs.id,
        requester_type: 'merchant',
        requester_email: 'someone-else@example.invalid',
        topic: 'general',
        site_id: site,
        status: 'closed',
        priority: 'urgent',
        channel: 'email',
        id: crypto.randomUUID(),
        ticket_ref: 'SUP-1999-FORGED00',
        deleted_at: new Date().toISOString(),
        metadata: { fulfillment_outcome: 'fulfilled', privacy_request_type: 'erasure' },
        fulfillment_outcome: 'fulfilled',
    };
    const created = await gateway.request(`${REQUESTS}?buyer_account_id=${theirs.id}&requester_user_id=${theirs.id}`, {
        method: 'POST',
        headers: await buyerHeaders(keys, mine.id),
        body: JSON.stringify(hostile),
    });
    assert.equal(created.status, 201, created.text);

    const rows = ticketsOf(mine.id);
    assert.equal(rows.length, 1);
    const [row] = rows;
    assert.equal(row.requester_user_id, mine.id);
    assert.equal(row.requester_type, 'customer');
    assert.equal(row.topic, 'privacy');
    assert.equal(row.status, 'open');
    assert.equal(row.site_id, null, 'a privacy request is platform-level: no store, whatever the body says');
    assert.equal(row.channel, 'api');
    assert.equal(row.priority, 'normal');
    assert.equal(row.deleted_at, null);
    assert.deepEqual(row.metadata, { privacy_request_type: 'access' }, 'the stored metadata is exactly the type the route validated: no client-supplied key, and above all no fulfillment');
    assert.notEqual(row.id, hostile.id);
    assert.match(row.ticket_ref, /^SUP-\d{4}-[0-9A-F]{8}$/);
    assert.notEqual(row.ticket_ref, hostile.ticket_ref);
    assert.notEqual(created.json?.data?.id, theirId, 'the answer is this buyer\'s own new request, not the request of the buyer the body named');
    assert.deepEqual(ticketsOf(theirs.id).map((other) => other.id), [theirId], 'the buyer the body named gained nothing and lost nothing');
    assert.deepEqual(messagesOf(theirId).map((message) => message.body), ['their private note'], 'and nothing of mine was attached to their request');
    assert.equal(created.json?.data?.type, 'access');
    assert.equal(created.json?.data?.status, 'received');

    const notes = messagesOf(row.id);
    assert.equal(notes.length, 1);
    assert.deepEqual(notes[0], { author_type: 'requester', visibility: 'public', body: 'please send my data' });

    // The cookie transport is the same verified session.
    const viaCookie = await gateway.request(REQUESTS, { headers: { cookie: `${LETBUYY_BUYER_SESSION_COOKIE}=${encodeURIComponent(await mintSession(keys, theirs.id))}` } });
    assert.equal(viaCookie.status, 200, viaCookie.text);
    assert.deepEqual((viaCookie.json?.data as Array<{ id: string }>).map((other) => other.id), [theirId], 'the other buyer, signed in by cookie, sees only their own list');
});

test('each buyer lists only their own requests, whatever the query string says, and a listing exposes nothing but its six fields', async () => {
    const a = seedBuyerAccount(psql, 'list-a');
    const b = seedBuyerAccount(psql, 'list-b');
    const ids = {
        aAccess: (await post(a.id, { type: 'access' })).json?.data?.id as string,
        aErasure: (await post(a.id, { type: 'erasure' })).json?.data?.id as string,
        bAccess: (await post(b.id, { type: 'access' })).json?.data?.id as string,
    };
    assert.ok(ids.aAccess && ids.aErasure && ids.bAccess);
    assert.equal(new Set(Object.values(ids)).size, 3);

    const listA = await list(a.id, `?buyer_account_id=${b.id}&requester_user_id=${b.id}&limit=1`);
    const listB = await list(b.id, `?buyer_account_id=${a.id}`);
    assert.equal(listA.status, 200);
    assert.equal(listB.status, 200);
    assert.deepEqual((listA.json?.data as Array<{ id: string }>).map((row) => row.id).sort(), [ids.aAccess, ids.aErasure].sort());
    assert.deepEqual((listB.json?.data as Array<{ id: string }>).map((row) => row.id), [ids.bAccess]);
    for (const row of [...listA.json!.data, ...listB.json!.data]) {
        assert.deepEqual(Object.keys(row).sort(), ['created_at', 'id', 'reference', 'status', 'type', 'updated_at']);
    }
    assert.doesNotMatch(listA.text + listB.text, new RegExp(`${a.id}|${b.id}|requester|metadata|site_id|assignee|priority`), 'no account id, requester field or internal column is serialized');
});

// --------------------------------------------------------------------------------------------------------------------
// 2. Concurrency: the creation conflict is reached on every run, and the database keeps exactly one unresolved row
// --------------------------------------------------------------------------------------------------------------------

interface RaceOutcomes {
    insertAttempts: number;
    created: number;
    uniqueViolations: number;
    /** What each fast-path read (findOpenRequest) answered before the INSERTs were released: the number of open requests it saw. */
    fastPathAnswers: number[];
    /** For each INSERT, how many fast-path reads had been issued by the instant the INSERTs were released. */
    readsAtRelease: number[];
}

/**
 * Deterministic synchronization for a creation race. The real route runs concurrently; the tap holds every privacy INSERT until `parties`
 * of them have arrived, then releases them together, so they race in the database. A request only reaches its INSERT after its own fast-path
 * read (findOpenRequest) has been answered, so by the time any INSERT is released every request has already decided to create. The
 * unique index lets one INSERT per (buyer, type) commit and refuses the rest with SQLSTATE 23505, which each of those must resolve by
 * re-reading the winner. Nothing about who wins, or whether the conflict path is reached, is left to timing. The caller restores the tap.
 */
function raceInserts(parties: number): { tap: RestTap; barrier: Barrier; outcomes: RaceOutcomes } {
    const barrier = newBarrier(parties);
    const outcomes: RaceOutcomes = { insertAttempts: 0, created: 0, uniqueViolations: 0, fastPathAnswers: [], readsAtRelease: [] };
    let released = false;
    const tap: RestTap = tapRest(owned.restUrl, async (call, forward) => {
        if (isPrivacyRead(call) && !released) {
            const response = await forward();
            const rows = await response.clone().json() as unknown;
            outcomes.fastPathAnswers.push(Array.isArray(rows) ? rows.length : -1);
            return response;
        }
        if (!isPrivacyInsert(call)) return forward();
        outcomes.insertAttempts += 1;
        await barrier.arrive();
        released = true;
        // Every waiter resumes in this same microtask drain, before any INSERT response can arrive: so each sees the same count.
        outcomes.readsAtRelease.push(tap.calls.filter(isPrivacyRead).length);
        const response = await forward();
        if (response.status === 201) outcomes.created += 1;
        if (response.status === 409 && ((await response.clone().json()) as { code?: string }).code === '23505') outcomes.uniqueViolations += 1;
        return response;
    });
    return { tap, barrier, outcomes };
}

test('concurrent identical requests from one buyer leave exactly one unresolved request, and every caller is told about that one', async () => {
    const buyer = seedBuyerAccount(psql, 'race');
    const PARTIES = 6;
    assert.equal(ticketsOf(buyer.id).length, 0, 'start with no request at all for this buyer');

    const { tap, barrier, outcomes } = raceInserts(PARTIES);
    let responses: Awaited<ReturnType<typeof post>>[];
    try {
        responses = await Promise.all(Array.from({ length: PARTIES }, (_, index) => post(buyer.id, { type: 'access', notes: `race note ${index}` })));
    } finally {
        tap.restore();
    }

    // The conflict path was really taken: all six decided to create (each fast-path read saw nothing open, and all six reads were answered
    // before any INSERT was released), six INSERTs raced, the database accepted one and refused five with a unique violation.
    assert.equal(barrier.arrived, PARTIES);
    assert.deepEqual(outcomes.fastPathAnswers, Array(PARTIES).fill(0), 'every request saw "nothing open" and went on to create');
    assert.deepEqual(outcomes.readsAtRelease, Array(PARTIES).fill(PARTIES), 'and had done so before any INSERT was released');
    assert.deepEqual({ insertAttempts: outcomes.insertAttempts, created: outcomes.created, uniqueViolations: outcomes.uniqueViolations }, { insertAttempts: PARTIES, created: 1, uniqueViolations: PARTIES - 1 });

    // The documented response semantics: one newly created response (201), every duplicate returns the existing one (200).
    const statuses = responses.map((response) => response.status).sort();
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 201], responses.map((response) => response.text).join(' | '));
    for (const response of responses) {
        assert.equal(response.json?.success, true);
        assert.equal(response.json?.data?.type, 'access');
        assert.equal(response.json?.data?.status, 'received', 'a new, unresolved request is never reported as anything but received');
    }
    const winnerIndex = responses.findIndex((response) => response.status === 201);
    const ids = new Set(responses.map((response) => response.json?.data?.id));
    const references = new Set(responses.map((response) => response.json?.data?.reference));
    assert.equal(ids.size, 1, 'every caller was told about the same request');
    assert.equal(references.size, 1);

    // The database, asked independently, agrees: one row in total, and it is the one every response named.
    assert.equal(openPrivacyCount(buyer.id, 'access'), 1);
    const rows = ticketsOf(buyer.id);
    assert.equal(rows.length, 1, 'no second row exists in any state');
    assert.equal(rows[0].id, [...ids][0]);
    assert.equal(rows[0].status, 'open');
    // The losers' notes were not stored (a duplicate returns the existing request and adds nothing to it); the winner's were.
    assert.deepEqual(messagesOf(rows[0].id).map((message) => message.body), [`race note ${winnerIndex}`]);
});

test('requests of the two supported types by one buyer are independent, even when they race', async () => {
    const buyer = seedBuyerAccount(psql, 'types');
    const { tap, outcomes } = raceInserts(2);
    let access, erasure;
    try {
        [access, erasure] = await Promise.all([post(buyer.id, { type: 'access' }), post(buyer.id, { type: 'erasure' })]);
    } finally {
        tap.restore();
    }
    assert.deepEqual({ insertAttempts: outcomes.insertAttempts, created: outcomes.created, uniqueViolations: outcomes.uniqueViolations }, { insertAttempts: 2, created: 2, uniqueViolations: 0 }, 'different types never conflict');
    assert.equal(access.status, 201);
    assert.equal(erasure.status, 201);
    assert.notEqual(access.json?.data?.id, erasure.json?.data?.id);
    assert.equal(openPrivacyCount(buyer.id, 'access'), 1);
    assert.equal(openPrivacyCount(buyer.id, 'erasure'), 1);
    assert.deepEqual(ticketsOf(buyer.id).map((row) => (row.metadata as { privacy_request_type: string }).privacy_request_type).sort(), ['access', 'erasure']);
});

test('two buyers requesting the same type at the same moment never share a request or an idempotency decision', async () => {
    const a = seedBuyerAccount(psql, 'two-a');
    const b = seedBuyerAccount(psql, 'two-b');
    const { tap, outcomes } = raceInserts(2);
    let first, second;
    try {
        [first, second] = await Promise.all([post(a.id, { type: 'erasure' }), post(b.id, { type: 'erasure' })]);
    } finally {
        tap.restore();
    }
    assert.deepEqual({ insertAttempts: outcomes.insertAttempts, created: outcomes.created, uniqueViolations: outcomes.uniqueViolations }, { insertAttempts: 2, created: 2, uniqueViolations: 0 });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.json?.data?.id, second.json?.data?.id);
    assert.equal(ticketsOf(a.id).length, 1);
    assert.equal(ticketsOf(b.id).length, 1);
    assert.equal((await list(a.id)).json?.data?.[0]?.id, first.json?.data?.id);
    assert.equal((await list(b.id)).json?.data?.[0]?.id, second.json?.data?.id);
});

test('twelve concurrent requests across two buyers and both types create exactly four requests, and no response names another buyer\'s request or another type\'s', async () => {
    const a = seedBuyerAccount(psql, 'mix-a');
    const b = seedBuyerAccount(psql, 'mix-b');
    const groups = [
        { buyer: a, type: 'access' as const },
        { buyer: a, type: 'erasure' as const },
        { buyer: b, type: 'access' as const },
        { buyer: b, type: 'erasure' as const },
    ];
    const attempts = groups.flatMap((group) => Array.from({ length: 3 }, () => group));
    const { tap, outcomes } = raceInserts(attempts.length);
    let responses: Awaited<ReturnType<typeof post>>[];
    try {
        responses = await Promise.all(attempts.map((group) => post(group.buyer.id, { type: group.type })));
    } finally {
        tap.restore();
    }

    assert.deepEqual({ insertAttempts: outcomes.insertAttempts, created: outcomes.created, uniqueViolations: outcomes.uniqueViolations }, { insertAttempts: 12, created: 4, uniqueViolations: 8 }, 'one winner per (buyer, type), and every other racer was refused by the index, not by luck');
    assert.deepEqual(outcomes.fastPathAnswers, Array(12).fill(0));
    assert.deepEqual(responses.map((response) => response.status).sort(), [...Array(8).fill(200), ...Array(4).fill(201)]);

    const idsByGroup = groups.map((group) => {
        const own = attempts.flatMap((candidate, index) => (candidate === group ? [responses[index]] : []));
        const ids = new Set(own.map((response) => response.json?.data?.id as string));
        assert.equal(ids.size, 1, `${group.buyer.email} ${group.type}: three callers, one request`);
        assert.ok(own.every((response) => response.json?.data?.type === group.type), 'and the type each was told is the type it asked for');
        return [...ids][0];
    });
    assert.equal(new Set(idsByGroup).size, 4, 'four buyers-and-types, four different requests');

    for (const [index, group] of groups.entries()) {
        const rows = ticketsOf(group.buyer.id).filter((row) => (row.metadata as { privacy_request_type: string }).privacy_request_type === group.type);
        assert.equal(rows.length, 1, `${group.buyer.email} ${group.type}: exactly one row in the database`);
        assert.equal(rows[0].id, idsByGroup[index], 'and it is the one every caller in the group was told about');
        assert.equal(rows[0].requester_user_id, group.buyer.id);
    }
    assert.equal(ticketsOf(a.id).length + ticketsOf(b.id).length, 4);
});

test('with nothing held back at all, concurrent identical requests still end with one row, one creation and one answer for everybody, whatever interleaving the machine produces', async () => {
    // No tap. Which request wins, and whether a loser meets the fast path or the conflict path, is up to the machine, so this asserts only what
    // must hold for EVERY interleaving. (The synchronized tests above are what guarantee the conflict path is reached on every run.)
    const buyer = seedBuyerAccount(psql, 'free-race');
    const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => post(buyer.id, { type: 'erasure', notes: `free note ${index}` })));
    const statuses = responses.map((response) => response.status);
    assert.ok(statuses.every((status) => status === 200 || status === 201), `no failure for a duplicate: ${statuses.join(',')}`);
    assert.equal(statuses.filter((status) => status === 201).length, 1, 'exactly one creation');
    assert.equal(new Set(responses.map((response) => response.json?.data?.id)).size, 1, 'one request, named by every caller');
    const rows = ticketsOf(buyer.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, responses[0].json?.data?.id);
    assert.equal(messagesOf(rows[0].id).length, 1, 'and only the creating request\'s notes were stored');
});

test('once a request is closed a new one of the same type is accepted, concurrent retries still make exactly one, and the old request is untouched', async () => {
    const buyer = seedBuyerAccount(psql, 'reopen');
    const first = await post(buyer.id, { type: 'access' });
    assert.equal(first.status, 201);
    const repeat = await post(buyer.id, { type: 'access' });
    assert.equal(repeat.status, 200, 'while the first is unresolved a repeat returns it');
    assert.equal(repeat.json?.data?.id, first.json?.data?.id);

    psql(`UPDATE support_tickets SET status = 'closed', closed_at = now() WHERE id = '${first.json?.data?.id}';`);
    const afterClose = await list(buyer.id);
    assert.deepEqual((afterClose.json?.data as Array<{ status: string }>).map((row) => row.status), ['closed_no_fulfillment']);

    const { tap, outcomes } = raceInserts(4);
    let again: Awaited<ReturnType<typeof post>>[];
    try {
        again = await Promise.all(Array.from({ length: 4 }, () => post(buyer.id, { type: 'access' })));
    } finally {
        tap.restore();
    }
    assert.deepEqual({ insertAttempts: outcomes.insertAttempts, created: outcomes.created, uniqueViolations: outcomes.uniqueViolations }, { insertAttempts: 4, created: 1, uniqueViolations: 3 });
    assert.deepEqual(outcomes.fastPathAnswers, [0, 0, 0, 0], 'the closed request is not an open one: every fast-path read saw nothing');
    assert.deepEqual(again.map((response) => response.status).sort(), [200, 200, 200, 201]);
    const newId = again.find((response) => response.status === 201)?.json?.data?.id;
    assert.notEqual(newId, first.json?.data?.id, 'a closed request does not block a new one, and is not reused');
    assert.ok(again.every((response) => response.json?.data?.id === newId));

    const rows = ticketsOf(buyer.id);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.status).sort(), ['closed', 'open']);
    assert.equal(rows.find((row) => row.id === first.json?.data?.id)?.status, 'closed', 'the earlier request stays closed');
    assert.equal(openPrivacyCount(buyer.id, 'access'), 1);
});

// --------------------------------------------------------------------------------------------------------------------
// 3. The database invariant itself: migration 262's actual predicate, tested with direct inserts and updates
// --------------------------------------------------------------------------------------------------------------------

test('the index is the one migration 262 defines: unique over (requester, type), only for unresolved, non-deleted privacy tickets', () => {
    const definition = psql(`SELECT regexp_replace(pg_get_indexdef(i.indexrelid), '\\s+', ' ', 'g') FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = '${PRIVACY_INDEX}';`);
    assert.ok(definition, 'the index exists in a database built from the migrations');
    assert.match(definition, /^CREATE UNIQUE INDEX support_tickets_privacy_open_request_uidx ON public\.support_tickets USING btree /);
    assert.match(definition, /\(requester_user_id, \(\(metadata ->> 'privacy_request_type'::text\)\)\)/, 'the key is the requester and the type held in metadata');
    assert.match(definition, /topic = 'privacy'::text/);
    assert.match(definition, /status <> ALL \(ARRAY\['resolved'::text, 'closed'::text\]\)/, 'resolved and closed are the terminal states');
    assert.match(definition, /deleted_at IS NULL/);
    assert.doesNotMatch(definition, /requester_type|site_id/, 'neither the requester type nor the store is part of the key');
    assert.equal(psql(`SELECT indisunique FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = '${PRIVACY_INDEX}';`), 't');
    assert.equal(psql(`SELECT count(*) FROM pg_indexes WHERE tablename = 'support_tickets' AND indexdef ILIKE '%privacy%';`), '1', 'there is exactly one privacy index');
});

test('the same buyer cannot hold two unresolved requests of one type, in any unresolved state, in either order', () => {
    const unresolved = ['open', 'pending_customer', 'pending_internal', 'escalated'];
    for (const first of unresolved) {
        const buyer = crypto.randomUUID();
        assert.equal(tryInsert({ requester: buyer, status: first, metadata: privacyMetadata('access') }), '');
        for (const second of unresolved) {
            const error = tryInsert({ requester: buyer, status: second, metadata: privacyMetadata('access') });
            assert.match(error, new RegExp(`duplicate key value violates unique constraint "${PRIVACY_INDEX}"`), `${first} then ${second}: ${error}`);
            assert.match(error, /Key \(requester_user_id, \(metadata ->> 'privacy_request_type'::text\)\)=\([0-9a-f-]+, access\) already exists/);
        }
        assert.equal(openPrivacyCount(buyer, 'access'), 1, `${first}: still exactly one unresolved request after four refused attempts`);
    }
});

test('different types, different buyers and terminal states do not conflict; a closed request never blocks the next', () => {
    const buyer = crypto.randomUUID();
    const other = crypto.randomUUID();
    assert.equal(tryInsert({ requester: buyer, metadata: privacyMetadata('access') }), '');
    assert.equal(tryInsert({ requester: buyer, metadata: privacyMetadata('erasure') }), '', 'a different type');
    assert.equal(tryInsert({ requester: other, metadata: privacyMetadata('access') }), '', 'a different buyer');
    assert.equal(tryInsert({ requester: other, metadata: privacyMetadata('erasure') }), '');
    // Terminal rows are unconstrained, in any number, alongside an open one.
    for (const terminal of ['resolved', 'closed', 'resolved', 'closed']) {
        assert.equal(tryInsert({ requester: buyer, status: terminal, metadata: privacyMetadata('access') }), '', `an extra ${terminal} row beside an open one`);
    }
    // And a closed request does not block a new open one.
    const cycler = crypto.randomUUID();
    assert.equal(tryInsert({ requester: cycler, status: 'closed', metadata: privacyMetadata('erasure') }), '');
    assert.equal(tryInsert({ requester: cycler, status: 'open', metadata: privacyMetadata('erasure') }), '');
    assert.equal(tryInsert({ requester: cycler, status: 'resolved', metadata: privacyMetadata('erasure') }), '');
    assert.equal(openPrivacyCount(cycler, 'erasure'), 1);
});

test('a soft-deleted request is outside the index in both directions', () => {
    const buyer = crypto.randomUUID();
    assert.equal(tryInsert({ requester: buyer, metadata: privacyMetadata('access'), softDeleted: true }), '');
    assert.equal(tryInsert({ requester: buyer, metadata: privacyMetadata('access') }), '', 'an open request beside a deleted one');
    assert.equal(tryInsert({ requester: buyer, metadata: privacyMetadata('access'), softDeleted: true }), '', 'another deleted one beside the open one');
    assert.equal(openPrivacyCount(buyer, 'access'), 1);
});

test('changing a row cannot create a second unresolved request: reopening, un-deleting, retyping, re-topicking and re-assigning are all refused', () => {
    const buyer = crypto.randomUUID();
    const openAccess = ticketsId(buyer, 'access', 'open');
    const closedAccess = ticketsId(buyer, 'access', 'closed');
    assert.ok(openAccess && closedAccess);

    for (const status of ['open', 'pending_customer', 'pending_internal', 'escalated']) {
        const error = psqlExpectError(`UPDATE support_tickets SET status = '${status}' WHERE id = '${closedAccess}';`);
        assert.match(error, new RegExp(PRIVACY_INDEX), `reopening to ${status} beside an unresolved request`);
    }
    assert.equal(ticketRow(closedAccess).status, 'closed', 'the refused update changed nothing');

    // The unresolved request itself may move between unresolved states and into a terminal one.
    for (const status of ['pending_customer', 'pending_internal', 'escalated', 'open', 'resolved']) {
        assert.equal(psqlExpectError(`UPDATE support_tickets SET status = '${status}' WHERE id = '${openAccess}';`), '', `the open request may become ${status}`);
    }
    // Now nothing is unresolved, so the older one may be reopened, and then it is the one that blocks.
    assert.equal(psqlExpectError(`UPDATE support_tickets SET status = 'open' WHERE id = '${closedAccess}';`), '');
    assert.match(psqlExpectError(`UPDATE support_tickets SET status = 'open' WHERE id = '${openAccess}';`), new RegExp(PRIVACY_INDEX));

    // Soft-deleting the unresolved one and un-deleting it again.
    const deletedAccess = ticketsId(buyer, 'access', 'open', true);
    assert.match(psqlExpectError(`UPDATE support_tickets SET deleted_at = NULL WHERE id = '${deletedAccess}';`), new RegExp(PRIVACY_INDEX), 'un-deleting beside an unresolved request');

    // Moving a request onto the same key as another: another type, another topic, another requester.
    const erasure = ticketsId(buyer, 'erasure', 'open');
    assert.match(psqlExpectError(`UPDATE support_tickets SET metadata = '{"privacy_request_type":"access"}'::jsonb WHERE id = '${erasure}';`), new RegExp(PRIVACY_INDEX), 'retyping erasure to access');
    const general = ticketsId(buyer, 'access', 'open', false, 'general');
    assert.match(psqlExpectError(`UPDATE support_tickets SET topic = 'privacy' WHERE id = '${general}';`), new RegExp(PRIVACY_INDEX), 'a general ticket promoted to privacy');
    const stranger = crypto.randomUUID();
    const strangerAccess = ticketsId(stranger, 'access', 'open');
    assert.match(psqlExpectError(`UPDATE support_tickets SET requester_user_id = '${buyer}' WHERE id = '${strangerAccess}';`), new RegExp(PRIVACY_INDEX), 're-assigning to a buyer who already has one');
    assert.equal(ticketRow(strangerAccess).requester_user_id, stranger);
});

test('the index constrains typed requests alone; an untyped or null-keyed privacy ticket is outside it (a property of the schema; the route never writes one)', () => {
    // These are characterised, not endorsed. NULLs are distinct in a unique index, so a privacy-topic ticket whose metadata holds no
    // usable type, or whose requester is unknown, is not a request in this model and is not constrained. The route always writes a
    // validated type and a verified buyer, and no supported writer creates a privacy-topic ticket any other way.
    const buyer = crypto.randomUUID();
    for (const metadata of ['{}', '{"privacy_request_type": null}', 'null', '[]', '{"privacy_request_type_misspelled": "access"}']) {
        assert.equal(tryInsert({ requester: buyer, metadata }), '', `first ${metadata}`);
        assert.equal(tryInsert({ requester: buyer, metadata }), '', `second ${metadata}: a null key is distinct`);
    }
    const nobody = tryInsert({ requester: null, metadata: privacyMetadata('access') });
    assert.equal(nobody, '');
    assert.equal(tryInsert({ requester: null, metadata: privacyMetadata('access') }), '', 'an unknown requester is distinct too');
    // A malformed value that IS text is a key like any other.
    assert.equal(tryInsert({ requester: buyer, metadata: '{"privacy_request_type": ["access"]}' }), '');
    assert.match(tryInsert({ requester: buyer, metadata: '{"privacy_request_type": ["access"]}' }), new RegExp(PRIVACY_INDEX));
});

test('ordinary support tickets are not constrained, even when they carry privacy metadata; and the key has no requester type', () => {
    const buyer = crypto.randomUUID();
    for (const topic of ['general', 'billing', 'orders', 'general']) {
        assert.equal(tryInsert({ requester: buyer, topic, metadata: '{}' }), '', `another open ${topic} ticket`);
    }
    assert.equal(tryInsert({ requester: buyer, topic: 'general', metadata: privacyMetadata('access') }), '', 'privacy metadata on a general ticket');
    assert.equal(tryInsert({ requester: buyer, topic: 'general', metadata: privacyMetadata('access') }), '', 'twice');
    assert.equal(tryInsert({ requester: buyer, topic: 'privacy', metadata: privacyMetadata('access') }), '', 'and a real privacy request beside them');
    assert.equal(tryInsert({ requester: buyer, topic: 'privacy', metadata: privacyMetadata('erasure'), siteId: null }), '');

    // The key is (requester, type): not the requester type and not the store. The route reads with requester_type = 'customer', so
    // a privacy-topic row of any other requester type for the same id and type would hold the key without the route being able to
    // see it. No supported writer creates one (the operator API cannot set the privacy topic; see the support-visibility suite),
    // and this pins that the index itself does not tell them apart.
    const requester = crypto.randomUUID();
    assert.equal(tryInsert({ requester, requesterType: 'employee', metadata: privacyMetadata('access') }), '');
    assert.match(tryInsert({ requester, requesterType: 'customer', metadata: privacyMetadata('access') }), new RegExp(PRIVACY_INDEX));
});

test('the schema itself refuses a status the privacy projection does not know, and admits the privacy topic', () => {
    const buyer = crypto.randomUUID();
    assert.match(tryInsert({ requester: buyer, status: 'archived', metadata: privacyMetadata('access') }), /support_tickets_status_check/, 'an unrecognized status cannot be stored, so the route\'s "unknown" branch is unreachable with this schema');
    assert.match(tryInsert({ requester: buyer, topic: 'rights', metadata: privacyMetadata('access') }), /support_tickets_topic_check/);
    assert.equal(tryInsert({ requester: buyer, topic: 'privacy', metadata: privacyMetadata('access') }), '');
});

// A privacy ticket (or any ticket) for `requester`, written as a fixture; returns its id.
function ticketsId(requester: string, type: string, status: string, softDeleted = false, topic = 'privacy'): string {
    const id = crypto.randomUUID();
    const error = psqlExpectError(insertTicketSql({ requester, status, softDeleted, topic, metadata: privacyMetadata(type) }).replace('INSERT INTO support_tickets (', 'INSERT INTO support_tickets (id, ').replace('VALUES (', `VALUES ('${id}', `));
    assert.equal(error, '', `fixture ${topic}/${type}/${status}: ${error}`);
    return id;
}

function ticketRow(id: string): TicketRow {
    return queryJson<TicketRow>(psql, `SELECT to_jsonb(t)::text FROM (SELECT id, ticket_ref, requester_user_id, requester_type, topic, status, site_id, channel, priority, metadata, deleted_at FROM support_tickets WHERE id = '${id}') t;`);
}

// --------------------------------------------------------------------------------------------------------------------
// 4. Conflict handling: only the intended uniqueness conflict is deduplication; everything else is an honest failure
// --------------------------------------------------------------------------------------------------------------------

test('a creation conflict is resolved to the winner even when the fast path is blind: the conflict handler itself, with a real INSERT, a real 409 and a real re-read', async () => {
    const buyer = seedBuyerAccount(psql, 'blind');
    const first = await post(buyer.id, { type: 'access' });
    assert.equal(first.status, 201);

    // Fault: the fast-path read (findOpenRequest) answers "nothing open", as it would if the other request had not committed yet.
    // The INSERT that follows and the re-read after its conflict are real.
    let blinded = 0;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.method === 'GET' && call.resource === 'support_tickets' && call.search.get('topic') === 'eq.privacy' && blinded === 0) {
            blinded += 1;
            return restJson(200, []);
        }
        return forward();
    });
    let second;
    try {
        second = await post(buyer.id, { type: 'access' });
    } finally {
        tap.restore();
    }
    assert.equal(blinded, 1);
    assert.equal(tap.calls.filter(isPrivacyInsert).length, 1, 'exactly one INSERT was attempted');
    assert.equal(second.status, 200, second.text);
    assert.equal(second.json?.data?.id, first.json?.data?.id, 'the conflict resolved to the existing request, not a new row');
    assert.equal(ticketsOf(buyer.id).length, 1);
});

test('an unrelated unique violation (the ticket reference) is NOT deduplication: no other buyer\'s request is returned and nothing is reported as created', async () => {
    const victim = seedBuyerAccount(psql, 'holder');
    const requester = seedBuyerAccount(psql, 'collider');
    const heldRef = 'SUP-2099-COLLIDE1';
    // Someone else's open access request already holds this reference.
    psql(insertTicketSql({ requester: victim.id, metadata: privacyMetadata('access'), ref: heldRef }));
    assert.equal(ticketsOf(victim.id).length, 1);

    // Fault: the reference the gateway generated collides. (The body of the INSERT is rewritten in flight; the violation is raised by
    // the database on the unrelated column support_tickets_ticket_ref_key, not by the privacy index, and the rest is real.)
    const tap = tapRest(owned.restUrl, async (call, forward) => (isPrivacyInsert(call) ? forward({ body: JSON.stringify({ ...(call.json as object), ticket_ref: heldRef }) }) : forward()));
    let response;
    try {
        response = await post(requester.id, { type: 'access', notes: 'this must not be stored' });
    } finally {
        tap.restore();
    }
    const insert = tap.calls.filter(isPrivacyInsert);
    assert.equal(insert.length, 1, 'one attempt, no retry loop');
    assert.equal(response.status, 500, `an unrelated unique violation is a failure: ${response.text}`);
    assert.deepEqual(response.json, { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } }, 'a generic failure, with no database detail');
    assert.doesNotMatch(response.text, new RegExp(`${victim.id}|${heldRef}|duplicate|constraint|ticket_ref|support_tickets|23505`, 'i'));
    assert.deepEqual(ticketsOf(requester.id), [], 'the requester has no request: nothing false was recorded');
    assert.equal(ticketsOf(victim.id).length, 1, 'the other buyer\'s request is untouched');
    assert.deepEqual(messagesOf(ticketsOf(victim.id)[0].id), [], 'and the refused request\'s notes were not attached to it');
    const listed = await list(requester.id);
    assert.deepEqual(listed.json?.data, [], 'and none is listed for the requester');
});

test('an unrelated violation does not turn into success for a buyer who already has a request of ANOTHER type', async () => {
    const buyer = seedBuyerAccount(psql, 'othertype');
    const other = seedBuyerAccount(psql, 'holds');
    const heldRef = 'SUP-2099-COLLIDE2';
    psql(insertTicketSql({ requester: other.id, metadata: privacyMetadata('access'), ref: heldRef }));
    const erasure = await post(buyer.id, { type: 'erasure' });
    assert.equal(erasure.status, 201);

    const tap = tapRest(owned.restUrl, async (call, forward) => (isPrivacyInsert(call) ? forward({ body: JSON.stringify({ ...(call.json as object), ticket_ref: heldRef }) }) : forward()));
    let response;
    try {
        response = await post(buyer.id, { type: 'access' });
    } finally {
        tap.restore();
    }
    assert.equal(response.status, 500, 'the erasure request is not an answer to an access request');
    assert.notEqual(response.json?.data?.id, erasure.json?.data?.id);
    assert.equal(ticketsOf(buyer.id).length, 1);
    assert.equal(openPrivacyCount(buyer.id, 'access'), 0);
});

test('database failures are reported generically, claim nothing, and write nothing', async () => {
    const buyer = seedBuyerAccount(psql, 'fail');
    const details = /pool|PGRST|pg_|connection|constraint|duplicate|stack|support_tickets|SELECT|INSERT|ECONN|fetch failed/i;
    const faults: Array<{ name: string; hit: (call: RestCall) => boolean; fail: () => Response | Promise<never> }> = [
        { name: 'the INSERT hits a network failure', hit: isPrivacyInsert, fail: () => Promise.reject(new TypeError('fetch failed: ECONNRESET to db.internal')) },
        { name: 'the INSERT is answered 503 by the REST layer', hit: isPrivacyInsert, fail: () => restJson(503, { code: 'PGRST000', message: 'remaining connection slots are reserved for non-replication superuser connections', details: null, hint: null }) },
        { name: 'the INSERT is answered 500 with internals', hit: isPrivacyInsert, fail: () => restJson(500, { code: '57014', message: 'canceling statement due to statement timeout: SELECT pg_sleep', details: 'stack trace at planner.c:42', hint: null }) },
        { name: 'the fast-path read fails', hit: (call) => call.method === 'GET' && touchesTable(call, 'support_tickets') && call.search.get('topic') === 'eq.privacy', fail: () => restJson(503, { code: 'PGRST000', message: 'connection pool exhausted' }) },
    ];
    for (const fault of faults) {
        const tap = tapRest(owned.restUrl, async (call, forward) => (fault.hit(call) ? fault.fail() : forward()));
        let response;
        try {
            response = await post(buyer.id, { type: 'access', notes: 'x' });
        } finally {
            tap.restore();
        }
        assert.equal(response.status, 500, `${fault.name}: ${response.text}`);
        assert.deepEqual(response.json, { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } }, fault.name);
        assert.doesNotMatch(response.text, details, `${fault.name}: no internal detail is echoed`);
        assert.equal(ticketsOf(buyer.id).length, 0, `${fault.name}: nothing was written`);
    }
    // A failed LIST is a failure too, never an empty success.
    const tap = tapRest(owned.restUrl, async (call, forward) => (call.method === 'GET' && touchesTable(call, 'support_tickets') ? restJson(500, { message: 'boom' }) : forward()));
    let failedList;
    try {
        failedList = await list(buyer.id);
    } finally {
        tap.restore();
    }
    assert.equal(failedList.status, 500);
    assert.deepEqual(failedList.json, { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } });
    // And the next, healthy request is unaffected by any of it.
    const healthy = await post(buyer.id, { type: 'access' });
    assert.equal(healthy.status, 201);
});

test('a lost response is ambiguous but safe: the INSERT committed, the caller was told it failed, and the retry returns the same request', async () => {
    const buyer = seedBuyerAccount(psql, 'lost');
    // Fault: the INSERT reaches the database and commits, but the response never reaches the gateway.
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (!isPrivacyInsert(call)) return forward();
        await forward();
        throw new TypeError('fetch failed: the connection closed before the response');
    });
    let first;
    try {
        first = await post(buyer.id, { type: 'access', notes: 'first attempt' });
    } finally {
        tap.restore();
    }
    assert.equal(first.status, 500, 'the first attempt could not know, so it did not claim success');
    assert.deepEqual(first.json, { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } });
    assert.equal(ticketsOf(buyer.id).length, 1, 'but the request does exist');

    const retry = await post(buyer.id, { type: 'access', notes: 'second attempt' });
    assert.equal(retry.status, 200, `the retry is a repeat, not a second request: ${retry.text}`);
    assert.equal(retry.json?.data?.id, ticketsOf(buyer.id)[0].id);
    assert.equal(ticketsOf(buyer.id).length, 1);
    assert.deepEqual(messagesOf(ticketsOf(buyer.id)[0].id), [], 'a repeat stores no notes, and the lost first attempt never got to');
});

test('if the notes cannot be stored after the request was, the caller is told it failed; the request exists and a retry returns it', async () => {
    const buyer = seedBuyerAccount(psql, 'notes');
    const tap = tapRest(owned.restUrl, async (call, forward) => (call.method === 'POST' && touchesTable(call, 'ticket_messages') ? restJson(500, { message: 'could not write the message' }) : forward()));
    let response;
    try {
        response = await post(buyer.id, { type: 'erasure', notes: 'please erase my account' });
    } finally {
        tap.restore();
    }
    assert.equal(response.status, 500);
    assert.deepEqual(response.json, { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } });
    assert.equal(ticketsOf(buyer.id).length, 1, 'the request was recorded before the notes failed');
    const retry = await post(buyer.id, { type: 'erasure', notes: 'please erase my account' });
    assert.equal(retry.status, 200);
    assert.equal(retry.json?.data?.id, ticketsOf(buyer.id)[0].id);
});

test('a foreign-key failure when storing the notes (the request vanished between the two writes) is a failure, not a success, and says nothing about the schema', async () => {
    const buyer = seedBuyerAccount(psql, 'fk');
    // Fault: between the request being written and its notes being written, the request row is removed (a repair, another process). The
    // notes' foreign key refuses them with SQLSTATE 23503, a real failure from the real database.
    let removed = 0;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (call.method === 'POST' && touchesTable(call, 'ticket_messages')) {
            psql(`DELETE FROM support_tickets WHERE id = '${(call.json as { ticket_id: string }).ticket_id}';`);
            removed += 1;
        }
        return forward();
    });
    let response;
    try {
        response = await post(buyer.id, { type: 'access', notes: 'notes that cannot be attached' });
    } finally {
        tap.restore();
    }
    assert.equal(removed, 1);
    assert.equal(response.status, 500, response.text);
    assert.deepEqual(response.json, { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } });
    assert.doesNotMatch(response.text, /23503|foreign key|violates|ticket_messages|support_tickets/i);
    assert.deepEqual(ticketsOf(buyer.id), [], 'no request is left behind that the buyer was told about');
    assert.deepEqual((await list(buyer.id)).json?.data, []);
    const retry = await post(buyer.id, { type: 'access', notes: 'notes that can' });
    assert.equal(retry.status, 201, 'and the buyer can ask again');
    assert.deepEqual(messagesOf(ticketsOf(buyer.id)[0].id).map((message) => message.body), ['notes that can']);
});

test('a failed readback after a real conflict is a failure, not a success; and so is a winner closed before the readback (one attempt, no retry loop)', async () => {
    const buyer = seedBuyerAccount(psql, 'readback');
    const winner = await post(buyer.id, { type: 'access' });
    assert.equal(winner.status, 201);
    const winnerId = winner.json?.data?.id as string;

    // Fault 1: after the conflict the re-read fails.
    let reads = 0;
    const blindThenBroken = tapRest(owned.restUrl, async (call, forward) => {
        if (call.method === 'GET' && touchesTable(call, 'support_tickets') && call.search.get('topic') === 'eq.privacy') {
            reads += 1;
            return reads === 1 ? restJson(200, []) : restJson(500, { message: 'readback failed' });
        }
        return forward();
    });
    let broken;
    try {
        broken = await post(buyer.id, { type: 'access' });
    } finally {
        blindThenBroken.restore();
    }
    assert.equal(blindThenBroken.calls.filter(isPrivacyInsert).length, 1);
    assert.equal(broken.status, 500);
    assert.deepEqual(broken.json, { success: false, error: { code: 'DB_ERROR', message: 'Database operation failed' } });
    assert.equal(ticketsOf(buyer.id).length, 1, 'the winner is intact and no second row exists');

    // Fault 2: the winner is closed between the conflict and the re-read, so the re-read finds nothing unresolved. The route does not
    // loop and does not invent a request: it reports the failure and the buyer may try again (which then succeeds, below).
    let phase = 0;
    const closedMeanwhile = tapRest(owned.restUrl, async (call, forward) => {
        if (call.method === 'GET' && touchesTable(call, 'support_tickets') && call.search.get('topic') === 'eq.privacy') {
            phase += 1;
            if (phase === 1) return restJson(200, []); // the fast path is blind
            psql(`UPDATE support_tickets SET status = 'closed', closed_at = now() WHERE id = '${winnerId}';`); // closed after the conflict, before the re-read
            return forward();
        }
        return forward();
    });
    let afterClosure;
    try {
        afterClosure = await post(buyer.id, { type: 'access' });
    } finally {
        closedMeanwhile.restore();
    }
    assert.equal(closedMeanwhile.calls.filter(isPrivacyInsert).length, 1, 'exactly one INSERT attempt: no retry');
    assert.equal(afterClosure.status, 500, afterClosure.text);
    assert.notEqual(afterClosure.json?.data?.id, winnerId, 'a closed request is never offered as the answer');
    assert.equal(openPrivacyCount(buyer.id, 'access'), 0);

    const retry = await post(buyer.id, { type: 'access' });
    assert.equal(retry.status, 201, 'the next attempt is a fresh, ordinary request');
    assert.notEqual(retry.json?.data?.id, winnerId);
});

// --------------------------------------------------------------------------------------------------------------------
// 5. Input handling against real storage
// --------------------------------------------------------------------------------------------------------------------

test('malformed and invalid bodies are refused with 400 before anything is looked up, and the 1000-character boundary holds', async () => {
    const buyer = seedBuyerAccount(psql, 'input');
    const before = ticketCount();
    const tap = tapRest(owned.restUrl, passThrough);
    const refusals: Array<[string, string | object]> = [
        ['malformed JSON', '{"type": "access"'],
        ['an empty body', ''],
        ['a null body', 'null'],
        ['an array body', '[{"type":"access"}]'],
        ['a string body', '"access"'],
        ['a number body', '42'],
        ['a boolean body', 'true'],
        ['a missing type', {}],
        ['an unsupported type', { type: 'correction' }],
        ['a type in the wrong case', { type: 'Access' }],
        ['a numeric type', { type: 1 }],
        ['a null type', { type: null }],
        ['notes that are not a string', { type: 'access', notes: 12345 }],
        ['notes that are an object', { type: 'access', notes: { text: 'x' } }],
        ['notes that are an array', { type: 'access', notes: ['x'] }],
        ['notes that are JSON null', { type: 'access', notes: null }],
        ['notes one character too long', { type: 'access', notes: 'x'.repeat(1001) }],
        ['notes three hundred thousand characters long', { type: 'access', notes: 'x'.repeat(300_000) }],
        ['a type with surrounding whitespace', { type: ' access ' }],
    ];
    try {
        for (const [name, body] of refusals) {
            const response = await post(buyer.id, body);
            assert.equal(response.status, 400, `${name}: ${response.status} ${response.text}`);
            assert.equal(response.json?.success, false, name);
            assert.equal(response.json?.error?.code, 'VALIDATION', name);
        }
    } finally {
        tap.restore();
    }
    assert.equal(tap.calls.filter((call) => touchesTable(call, 'support_tickets') && call.resource !== 'buyer_accounts').length, 0, 'validation precedes every ticket read and write');
    assert.equal(ticketCount(), before);

    const boundary = await post(buyer.id, { type: 'access', notes: `  ${'n'.repeat(1000)}  ` });
    assert.equal(boundary.status, 201, boundary.text);
    const row = ticketsOf(buyer.id)[0];
    assert.deepEqual(messagesOf(row.id).map((message) => message.body.length), [1000], 'surrounding whitespace is trimmed, and exactly 1000 characters are kept');

    const whitespace = seedBuyerAccount(psql, 'blank-notes');
    const blank = await post(whitespace.id, { type: 'erasure', notes: '   ' });
    assert.equal(blank.status, 201);
    assert.deepEqual(messagesOf(ticketsOf(whitespace.id)[0].id), [], 'whitespace-only notes are no notes at all');
});

test('the global per-client limiter fronts the intake: calls are charged to the caller\'s own bucket, and a new client starts with a full one', async () => {
    // Not a load test: three requests. It pins that the intake is not an unmetered write path and WHY the harness gives each request its own
    // client address (gateway-harness.ts nextClientAddress): the limiter's bucket is per client address, a POST is charged 5 points and a
    // read 1, against a capacity of 200 that drains at 20 a second. A client address that has never been seen starts full, whatever other
    // clients have spent, so the first reading from each of two new addresses is exact and does not depend on timing.
    const buyer = seedBuyerAccount(psql, 'limiter');
    const firstClient = '2001:db8:cafe::1';
    const secondClient = '2001:db8:cafe::2';
    const withClient = async (address: string) => ({ ...(await buyerHeaders(keys, buyer.id)), [CLIENT_ADDRESS_HEADER]: address });

    const read = await gateway.request(REQUESTS, { headers: await withClient(firstClient) });
    const write = await gateway.request(REQUESTS, { method: 'POST', headers: await withClient(secondClient), body: JSON.stringify({ type: 'access' }) });
    assert.equal(read.status, 200);
    assert.equal(write.status, 201, write.text);
    assert.equal(read.headers.get('X-RateLimit-Policy'), '200;w=leaky;rate=20');
    assert.deepEqual([read.headers.get('X-RateLimit-Cost'), read.headers.get('X-RateLimit-Remaining')], ['1', '199']);
    assert.deepEqual([write.headers.get('X-RateLimit-Cost'), write.headers.get('X-RateLimit-Remaining')], ['5', '195'], 'the second address was not drawn down by the first one\'s call');
    assert.equal(openPrivacyCount(buyer.id, 'access'), 1);
});

// --------------------------------------------------------------------------------------------------------------------
// 6. Truthful status, read back from real rows
// --------------------------------------------------------------------------------------------------------------------

test('every stored status and every metadata shape reads back honestly: closed is never fulfilled unless a recognised outcome is recorded', async () => {
    // One buyer per case, so unresolved rows never meet the unique index and each listing holds exactly the row under test.
    const cases: Array<{ name: string; status: string; metadata: string; expected: string; type: string | null }> = [
        { name: 'open', status: 'open', metadata: privacyMetadata('access'), expected: 'received', type: 'access' },
        { name: 'pending_customer', status: 'pending_customer', metadata: privacyMetadata('access'), expected: 'in_review', type: 'access' },
        { name: 'pending_internal', status: 'pending_internal', metadata: privacyMetadata('erasure'), expected: 'in_review', type: 'erasure' },
        { name: 'escalated', status: 'escalated', metadata: privacyMetadata('access'), expected: 'in_review', type: 'access' },
        { name: 'resolved without an outcome', status: 'resolved', metadata: privacyMetadata('access'), expected: 'closed_no_fulfillment', type: 'access' },
        { name: 'closed without an outcome', status: 'closed', metadata: privacyMetadata('erasure'), expected: 'closed_no_fulfillment', type: 'erasure' },
        { name: 'closed with empty-object metadata', status: 'closed', metadata: '{}', expected: 'closed_no_fulfillment', type: null },
        { name: 'closed with JSON null metadata', status: 'closed', metadata: 'null', expected: 'closed_no_fulfillment', type: null },
        { name: 'resolved with array metadata', status: 'resolved', metadata: '[1,2,3]', expected: 'closed_no_fulfillment', type: null },
        { name: 'an outcome that is not a recognised word', status: 'resolved', metadata: '{"privacy_request_type":"access","fulfillment_outcome":"erased"}', expected: 'closed_no_fulfillment', type: 'access' },
        { name: 'an outcome in the wrong case', status: 'resolved', metadata: '{"privacy_request_type":"access","fulfillment_outcome":"FULFILLED"}', expected: 'closed_no_fulfillment', type: 'access' },
        { name: 'an outcome with padding', status: 'closed', metadata: '{"privacy_request_type":"access","fulfillment_outcome":" fulfilled "}', expected: 'closed_no_fulfillment', type: 'access' },
        { name: 'a boolean outcome', status: 'closed', metadata: '{"privacy_request_type":"access","fulfillment_outcome":true}', expected: 'closed_no_fulfillment', type: 'access' },
        { name: 'a numeric outcome', status: 'closed', metadata: '{"privacy_request_type":"access","fulfillment_outcome":1}', expected: 'closed_no_fulfillment', type: 'access' },
        { name: 'an object outcome', status: 'closed', metadata: '{"privacy_request_type":"access","fulfillment_outcome":{"state":"fulfilled"}}', expected: 'closed_no_fulfillment', type: 'access' },
        { name: 'an outcome claimed on a request that is still open', status: 'open', metadata: '{"privacy_request_type":"erasure","fulfillment_outcome":"fulfilled"}', expected: 'received', type: 'erasure' },
        { name: 'an outcome claimed on an escalated request', status: 'escalated', metadata: '{"privacy_request_type":"access","fulfillment_outcome":"fulfilled"}', expected: 'in_review', type: 'access' },
    ];
    for (const entry of cases) {
        const buyer = seedBuyerAccount(psql, 'status');
        const error = tryInsert({ requester: buyer.id, status: entry.status, metadata: entry.metadata });
        assert.equal(error, '', `${entry.name}: ${error}`);
        const listed = await list(buyer.id);
        assert.equal(listed.status, 200, `${entry.name}: ${listed.text}`);
        const rows = (listed.json?.data ?? []) as Array<{ status: string; type: string | null }>;
        assert.equal(rows.length, 1, `${entry.name}: one row`);
        assert.equal(rows[0].status, entry.expected, `${entry.name}: stored ${entry.status} reads as ${rows[0].status}`);
        assert.equal(rows[0].type, entry.type, `${entry.name}: type`);
        assert.notEqual(rows[0].status, 'fulfilled', `${entry.name}: nothing here is a recorded fulfillment`);
        assert.notEqual(rows[0].status, 'unknown', `${entry.name}: the schema admits no status the projection does not know`);
    }
});

test('a recognised outcome reads as fulfilled only on a resolved or closed request: this is how a FUTURE legitimate writer would show, simulated here by the fixture and written by nothing in the product', async () => {
    // No code in this repository writes metadata.fulfillment_outcome (pinned by the source contract in the unit lane). The fixture sets it
    // directly, as the database owner, only to prove the reader's mapping against real storage; it does not make a fulfillment writer.
    const buyer = seedBuyerAccount(psql, 'outcome');
    assert.equal(tryInsert({ requester: buyer.id, status: 'resolved', metadata: '{"privacy_request_type":"access","fulfillment_outcome":"fulfilled"}' }), '');
    assert.equal(tryInsert({ requester: buyer.id, status: 'closed', metadata: '{"privacy_request_type":"erasure","fulfillment_outcome":"fulfilled"}' }), '');
    const listed = await list(buyer.id);
    assert.deepEqual((listed.json?.data as Array<{ status: string }>).map((row) => row.status), ['fulfilled', 'fulfilled']);
});

// --------------------------------------------------------------------------------------------------------------------
// 7. The same tickets through the generic buyer support routes: foreign ids, internal notes, and what cannot be changed
// --------------------------------------------------------------------------------------------------------------------

test('another buyer cannot read or write a privacy ticket through the support detail routes, by id, and the owner sees only public messages', async () => {
    const owner = seedBuyerAccount(psql, 'support-owner');
    const stranger = seedBuyerAccount(psql, 'support-stranger');
    const created = await post(owner.id, { type: 'access', notes: 'my own note' });
    const ticketId = created.json?.data?.id as string;
    assert.ok(ticketId);

    // An agent's public reply and a private internal note, as the operator API would write them.
    psql(`INSERT INTO ticket_messages (ticket_id, author_type, visibility, body) VALUES ('${ticketId}', 'agent', 'public', 'public reply from an agent'), ('${ticketId}', 'agent', 'internal', 'INTERNAL triage note, never for the buyer');`);

    const messagesPath = `${SUPPORT_TICKETS}/${ticketId}/messages`;
    const mine = await gateway.request(messagesPath, { headers: await buyerHeaders(keys, owner.id) });
    assert.equal(mine.status, 200, mine.text);
    const bodies = (mine.json?.data as Array<{ body: string }>).map((message) => message.body);
    assert.deepEqual(bodies.sort(), ['my own note', 'public reply from an agent']);
    assert.doesNotMatch(mine.text, /INTERNAL|triage/);

    const before = { messages: messageCount(), tickets: ticketCount() };
    // The stranger also tries to name the owner, in the query string, as a careless "act as" parameter would be read.
    const naming = `?buyer_account_id=${owner.id}&requester_user_id=${owner.id}`;
    const readForeign = await gateway.request(`${messagesPath}${naming}`, { headers: await buyerHeaders(keys, stranger.id) });
    const writeForeign = await gateway.request(`${messagesPath}${naming}`, { method: 'POST', headers: await buyerHeaders(keys, stranger.id), body: JSON.stringify({ body: 'a stranger writes here', status: 'resolved', metadata: { fulfillment_outcome: 'fulfilled' } }) });
    assert.equal(readForeign.status, 404, readForeign.text);
    assert.equal(writeForeign.status, 404, writeForeign.text);
    assert.deepEqual({ messages: messageCount(), tickets: ticketCount() }, before, 'the foreign write created nothing');
    assert.doesNotMatch(readForeign.text + writeForeign.text, /my own note|public reply|INTERNAL/);

    const malformed = await gateway.request(`${SUPPORT_TICKETS}/not-a-uuid/messages`, { headers: await buyerHeaders(keys, owner.id) });
    assert.equal(malformed.status, 400);

    // The owner may add a message, and cannot use the route to change the ticket or its metadata.
    const reply = await gateway.request(messagesPath, { method: 'POST', headers: await buyerHeaders(keys, owner.id), body: JSON.stringify({ body: 'one more detail', status: 'resolved', topic: 'general', metadata: { fulfillment_outcome: 'fulfilled', privacy_request_type: 'erasure' }, ticket_id: crypto.randomUUID() }) });
    assert.equal(reply.status, 201, reply.text);
    const row = ticketsOf(owner.id)[0];
    assert.equal(row.status, 'open', 'a message cannot change the status');
    assert.equal(row.topic, 'privacy');
    assert.deepEqual(row.metadata, { privacy_request_type: 'access' }, 'nor the metadata');
    assert.equal(messagesOf(ticketId).filter((message) => message.author_type === 'requester' && message.body === 'one more detail').length, 1);
    assert.equal(messagesOf(ticketId).some((message) => message.body.includes('stranger')), false);

    const status = await list(owner.id);
    assert.equal(status.json?.data?.[0]?.status, 'received');
});

test('the generic ticket list shows a buyer their own privacy ticket without any metadata, and never another buyer\'s', async () => {
    const owner = seedBuyerAccount(psql, 'generic-owner');
    const other = seedBuyerAccount(psql, 'generic-other');
    const mine = await post(owner.id, { type: 'erasure' });
    await post(other.id, { type: 'erasure' });
    psql(`UPDATE support_tickets SET metadata = '{"privacy_request_type":"erasure","fulfillment_outcome":"fulfilled"}'::jsonb, status = 'closed' WHERE id = '${mine.json?.data?.id}';`);

    // The owner also names the other buyer in the query string, as a careless "act as" parameter would be read.
    const generic = await gateway.request(`${SUPPORT_TICKETS}?buyer_account_id=${other.id}&requester_user_id=${other.id}`, { headers: await buyerHeaders(keys, owner.id) });
    assert.equal(generic.status, 200, generic.text);
    const rows = generic.json?.data as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, mine.json?.data?.id);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['created_at', 'id', 'last_agent_message_at', 'status', 'subject', 'ticket_ref', 'topic'], 'an explicit column list: no metadata, no requester, no internal field');
    assert.doesNotMatch(generic.text, /fulfillment|metadata|requester|privacy_request_type/);
    // This reader reports the ticket's workflow status ("closed"), not the privacy request's outcome; the dedicated privacy route is the
    // only place an outcome is ever projected, and it reads closed_no_fulfillment for this same row only if no outcome is recorded.
    assert.equal(rows[0].status, 'closed');
    assert.equal(rows[0].topic, 'privacy');
});
