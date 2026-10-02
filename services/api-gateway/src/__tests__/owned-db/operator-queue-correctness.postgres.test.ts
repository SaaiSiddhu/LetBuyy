// The operator support queue through the PRODUCTION worker and a real Postgres (P2-OPERATOR-QUEUE-CORRECTNESS, 2026-10-02).
//
// Every request below goes through the worker's own fetch (src/index.ts): the real global middleware, the real mount order
// (routes/operations/incident-command.ts's ops gate in front of /operations/support), real signed identities, a real PostgREST
// and a real Postgres. What it proves:
//
//   A. who reaches the routes under /v1/operations/support at all: an allowlisted super admin, and nobody else. Platform employees of every
//      tier, merchant owners and staff, strangers, inactive employees, buyers, forged identities and anonymous callers are
//      refused BEFORE any validation runs, and read and write nothing. Each refusal is paired with the same request made by
//      the super admin;
//   B. the two topic contracts: the queue can be FILTERED by topic=privacy, with exact rows and totals, while an operator
//      still cannot CREATE a privacy ticket or macro; a malformed filter, id or body is a sanitized 400, never an internal
//      error, and writes nothing;
//   C. a reply writes its message, the ticket's new state, the SLA clock bookkeeping and its audit row together, attributed
//      to the operator, and claims no fulfillment;
//   D. a reply that the privacy rule refuses (reopening a closed request while a newer one of the same type is unresolved,
//      migration 262) is refused WHOLE: 409, no message, no audit row, no state change, and retrying adds nothing. The status
//      routes say the same;
//   E. named faults: a mandatory write failing inside the reply rolls all of it back; a ticket that is gone before or during
//      the reply is a 404 with nothing written; the best-effort Trust & Safety follow-on reports exactly what happened;
//   F. concurrent replies keep the ticket coherent and the privacy rule intact;
//   and the database function behind the reply is executable by the backend role alone and rolls back cleanly.
//
// Seams: none in A to D. E and F use the harness's tapRest on the gateway -> PostgREST hop, only to hold requests at their
// write or to fail one named call, and E adds a named trigger fault in THIS suite's own database, created and dropped by the
// test that uses it. The gateway reaches the database as the service role, so this is not a row-level-security proof.
//
// Runs only in the owned database lane (scripts/governance/run-executable-suites.mjs). There is no skip path.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach, before } from 'node:test';
import { createLetbuyyInternalIdentityHeaders } from '@letbuyy/auth-core';
import {
    Gateway,
    buyerHeaders,
    gatewayEnv,
    newBarrier,
    newIdentityKeys,
    queryJson,
    restJson,
    seedBuyerAccount,
    signedIdentityHeaders,
    tapRest,
    type GatewayResponse,
    type IdentityKeys,
    type RestCall,
    type SyntheticBuyer,
} from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const { psql } = owned;

const OPS = '/v1/operations/support';
const PRIVACY = '/v1/storefront/buyer/privacy-requests';
const BUYER_TICKETS = '/v1/storefront/buyer/support/tickets';
// Long enough for the support routes' reason rule, and free of every word the router treats as a Trust & Safety trigger.
const REASON = 'Handling a queued support request';
const OPS_GATE_MESSAGE = 'Insufficient role category. Required: ops';
const REPLY_RPC = 'rpc/reply_to_support_ticket';
const REPLY_SIGNATURE = 'public.reply_to_support_ticket(uuid, uuid, text, text, text, text, uuid, jsonb, jsonb, text)';
const MIGRATION = new URL('../../../../../database/supabase/migrations/264_support_ticket_reply_atomic.sql', import.meta.url);
const ROLLBACK = new URL('../../../../../database/supabase/rollback/264_support_ticket_reply_atomic.rollback.sql', import.meta.url);
// What a refusal or failure must never carry: database or schema internals, the reply function's name, a stack frame, or the
// text of a fault this suite injected.
const INTERNALS = /PGRST|SQLSTATE|duplicate key|violates|constraint|_uidx|support_tickets|ticket_messages|ticket_sla_clocks|audit_logs|ts_cases|reply_to_support_ticket|ZodError|\bat \S+\.(?:ts|js|mjs):\d+|owned fault|injected/i;

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
// Fixtures. Everything exists only in this suite's database.
// --------------------------------------------------------------------------------------------------------------------

interface Person {
    id: string;
    email: string;
}

function seedUser(label: string): Person {
    const id = crypto.randomUUID();
    const email = `syn-opsq-${label}-${id.slice(0, 8)}@example.invalid`;
    psql(`INSERT INTO users_custom (id, email, email_verified) VALUES ('${id}', '${email}', true);`);
    return { id, email };
}

function seedStore(owner: Person, label: string): string {
    const id = crypto.randomUUID();
    psql(`INSERT INTO sites (id, name, store_name, site_type, subdomain, custom_user_id) VALUES ('${id}', 'Synthetic ${label}', 'Synthetic ${label}', 'store', 'syn-opsq-${label}-${id.slice(0, 8)}', '${owner.id}');`);
    return id;
}

/** An `employees` row: store_id set = a merchant's own staff; store_id NULL = the platform's own staff. */
function seedEmployee(person: Person, role: string, storeId: string | null, options: { status?: string; deleted?: boolean } = {}): void {
    const status = options.status ?? 'active';
    psql(`INSERT INTO employees (id, user_id, email, role, store_id, status, is_active, deleted_at)
          VALUES ('${crypto.randomUUID()}', '${person.id}', '${person.email}', '${role}', ${storeId ? `'${storeId}'` : 'NULL'}, '${status}', ${status === 'active'}, ${options.deleted ? 'now()' : 'NULL'});`);
}

/** An active entry in the super-admin allowlist: what the ops gate in front of the queue admits. */
function seedSuperAdmin(label: string): Person {
    const person = seedUser(label);
    psql(`INSERT INTO super_admin_allowlist (user_id, email, full_name, is_active) VALUES ('${person.id}', '${person.email}', 'Synthetic ${label}', true);`);
    return person;
}

// --------------------------------------------------------------------------------------------------------------------
// Requests
// --------------------------------------------------------------------------------------------------------------------

/** A request as this person: a freshly signed internal identity, the credential platform staff present. */
async function as(person: Person, path: string, init: RequestInit = {}): Promise<GatewayResponse> {
    const headers = { ...(await signedIdentityHeaders(person.id, person.email)), ...((init.headers as Record<string, string> | undefined) ?? {}) };
    return gateway.request(path, { ...init, headers });
}

const send = (method: 'POST' | 'PATCH', payload: unknown): RequestInit => ({ method, body: JSON.stringify(payload) });
const raw = (method: 'POST' | 'PATCH', text: string): RequestInit => ({ method, body: text });

async function createTicket(admin: Person, overrides: Record<string, unknown> = {}): Promise<Record<string, any>> {
    const response = await as(admin, `${OPS}/tickets`, send('POST', {
        requester_type: 'merchant',
        requester_email: `syn-opsq-requester-${crypto.randomUUID().slice(0, 8)}@example.invalid`,
        subject: 'Synthetic queue ticket',
        body: 'A synthetic question',
        reason: REASON,
        ...overrides,
    }));
    assert.equal(response.status, 201, `creating a ticket: ${response.text}`);
    return response.json?.data?.ticket as Record<string, any>;
}

async function buyerRequest(buyer: SyntheticBuyer, type: 'access' | 'erasure', notes?: string): Promise<string> {
    const response = await gateway.request(PRIVACY, {
        method: 'POST',
        headers: await buyerHeaders(keys, buyer.id),
        body: JSON.stringify(notes === undefined ? { type } : { type, notes }),
    });
    assert.ok(response.status === 201 || response.status === 200, `the buyer's request: ${response.status} ${response.text}`);
    return response.json?.data?.id as string;
}

async function resolveTicket(admin: Person, ticketId: string): Promise<void> {
    const response = await as(admin, `${OPS}/tickets/${ticketId}/resolve`, send('POST', { reason: REASON }));
    assert.equal(response.status, 200, `resolving: ${response.text}`);
}

/** A buyer with one CLOSED access request and a newer UNRESOLVED one: the shape migration 262 protects. */
async function closedAndOpen(admin: Person, label: string): Promise<{ buyer: SyntheticBuyer; closed: string; open: string }> {
    const buyer = seedBuyerAccount(psql, label);
    const closed = await buyerRequest(buyer, 'access', 'my first request');
    await resolveTicket(admin, closed);
    const open = await buyerRequest(buyer, 'access');
    assert.notEqual(open, closed, 'the buyer\'s second request is a new one');
    return { buyer, closed, open };
}

/** The public messages the buyer reads on their own ticket. */
async function buyerSees(buyer: SyntheticBuyer, ticketId: string): Promise<string[]> {
    const response = await gateway.request(`${BUYER_TICKETS}/${ticketId}/messages`, { headers: await buyerHeaders(keys, buyer.id) });
    assert.equal(response.status, 200, response.text);
    return (response.json?.data as Array<{ body: string }>).map((message) => message.body);
}

/** What the buyer's privacy route tells them about one request. */
async function privacyView(buyer: SyntheticBuyer, ticketId: string): Promise<{ status: string; type: string | null } | undefined> {
    const response = await gateway.request(PRIVACY, { headers: await buyerHeaders(keys, buyer.id) });
    assert.equal(response.status, 200, response.text);
    const row = (response.json?.data as Array<{ id: string; status: string; type: string | null }>).find((entry) => entry.id === ticketId);
    return row && { status: row.status, type: row.type };
}

const listed = (response: GatewayResponse): Array<Record<string, any>> => (Array.isArray(response.json?.data) ? response.json?.data as Array<Record<string, any>> : []);
const ids = (response: GatewayResponse): string[] => listed(response).map((row) => row.id as string);
const leaks = (text: string, needles: string[]): string[] => needles.filter((needle) => text.includes(needle));

function assertSanitized(response: GatewayResponse, context: string, needles: string[] = []): void {
    assert.doesNotMatch(response.text, INTERNALS, `${context}: the answer carries internals: ${response.text}`);
    assert.deepEqual(leaks(response.text, needles), [], `${context}: the answer names something it must not`);
}

const isReplyWrite = (call: RestCall): boolean => call.resource === REPLY_RPC || (call.method === 'POST' && call.resource === 'ticket_messages');

/** Sends one public reply per target and holds each at its write until all have arrived, so they reach the database together. */
async function raceReplies(admin: Person, targets: Array<[string, string]>): Promise<GatewayResponse[]> {
    const barrier = newBarrier(targets.length);
    let held = 0;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (isReplyWrite(call) && held < targets.length) {
            held += 1;
            await barrier.arrive();
        }
        return forward();
    });
    try {
        return await Promise.all(targets.map(([ticketId, text]) => as(admin, `${OPS}/tickets/${ticketId}/messages`, send('POST', { body: text, reason: REASON }))));
    } finally {
        tap.restore();
    }
}

// --------------------------------------------------------------------------------------------------------------------
// Direct database readbacks
// --------------------------------------------------------------------------------------------------------------------

interface TicketRow {
    id: string;
    topic: string;
    status: string;
    first_response_at: string | null;
    last_agent_message_at: string | null;
    updated_by: string | null;
    escalated_to: string | null;
    linked_ts_case_id: string | null;
    deleted_at: string | null;
    metadata: Record<string, unknown>;
}

function ticketRow(ticketId: string): TicketRow {
    return queryJson<TicketRow>(psql, `
        SELECT jsonb_build_object('id', id, 'topic', topic, 'status', status, 'first_response_at', first_response_at,
               'last_agent_message_at', last_agent_message_at, 'updated_by', updated_by, 'escalated_to', escalated_to,
               'linked_ts_case_id', linked_ts_case_id, 'deleted_at', deleted_at, 'metadata', metadata)::text
        FROM support_tickets WHERE id = '${ticketId}';
    `);
}

interface MessageRow {
    id: string;
    author_type: string;
    author_id: string | null;
    author_email: string | null;
    visibility: string;
    body: string;
    metadata: Record<string, unknown>;
    created_by: string | null;
    created_at: string;
}

function messagesOf(ticketId: string): MessageRow[] {
    return queryJson<MessageRow[]>(psql, `
        SELECT coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'author_type', m.author_type, 'author_id', m.author_id,
               'author_email', m.author_email, 'visibility', m.visibility, 'body', m.body, 'metadata', m.metadata,
               'created_by', m.created_by, 'created_at', m.created_at) ORDER BY m.created_at, m.id), '[]'::jsonb)::text
        FROM ticket_messages m WHERE m.ticket_id = '${ticketId}';
    `);
}

const systemNotes = (ticketId: string): string[] => messagesOf(ticketId).filter((message) => message.author_type === 'system').map((message) => message.body);

interface AuditRow {
    action: string;
    actor_id: string | null;
    actor_email: string | null;
    actor_type: string;
    metadata: Record<string, any>;
}

/** The audit rows of ACTIONS on a ticket (the sensitive-read rows written when someone views it are left out). */
function auditOf(ticketId: string): AuditRow[] {
    return queryJson<AuditRow[]>(psql, `
        SELECT coalesce(jsonb_agg(jsonb_build_object('action', a.action, 'actor_id', a.actor_id, 'actor_email', a.actor_email,
               'actor_type', a.actor_type, 'metadata', a.metadata) ORDER BY a.created_at, a.id), '[]'::jsonb)::text
        FROM audit_logs a WHERE a.resource_id = '${ticketId}' AND a.action NOT IN ('support.ticket.view', 'support.ticket.list');
    `);
}

interface ClockRow {
    clock_type: string;
    satisfied_at: string | null;
    paused: boolean;
}

function clocksOf(ticketId: string): ClockRow[] {
    return queryJson<ClockRow[]>(psql, `
        SELECT coalesce(jsonb_agg(jsonb_build_object('clock_type', c.clock_type, 'satisfied_at', c.satisfied_at, 'paused', c.paused) ORDER BY c.clock_type), '[]'::jsonb)::text
        FROM ticket_sla_clocks c WHERE c.ticket_id = '${ticketId}';
    `);
}

const casesFor = (ticketId: string): number => Number(psql(`SELECT count(*) FROM ts_cases WHERE metadata->>'support_ticket_id' = '${ticketId}';`));

const COUNTED = ['support_tickets', 'ticket_messages', 'ticket_sla_clocks', 'ticket_csat', 'ticket_macros', 'audit_logs', 'ts_cases'] as const;

/** Row counts of every table a support route writes. audit_logs is in it, so a read that happened (and was audited) shows too. */
function counts(): Record<string, number> {
    return queryJson(psql, `SELECT jsonb_build_object(${COUNTED.map((table) => `'${table}', (SELECT count(*) FROM public.${table})`).join(', ')})::text;`);
}

/** The ids the queue should list for a condition, newest first, as the route orders them. */
function queueIds(where: string): string[] {
    return queryJson<string[]>(psql, `SELECT coalesce(jsonb_agg(id ORDER BY created_at DESC), '[]'::jsonb)::text FROM support_tickets WHERE deleted_at IS NULL AND (${where});`);
}

const unresolved = (buyerId: string, type: string): number => Number(psql(`
    SELECT count(*) FROM support_tickets
    WHERE requester_user_id = '${buyerId}' AND topic = 'privacy' AND metadata->>'privacy_request_type' = '${type}'
      AND status NOT IN ('resolved', 'closed') AND deleted_at IS NULL;
`));

/** A trigger in THIS database that refuses one table's write for one ticket: a named, real database fault inside the transaction. */
function installFault(table: 'audit_logs' | 'ticket_sla_clocks', event: 'INSERT' | 'UPDATE', ticketId: string): () => void {
    const name = `opsq_fault_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const column = table === 'audit_logs' ? 'resource_id' : 'ticket_id';
    owned.script(`
        CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $fault$
        BEGIN
          IF NEW.${column} = '${ticketId}'::uuid THEN
            RAISE EXCEPTION 'owned fault: % refused for this ticket', TG_TABLE_NAME;
          END IF;
          RETURN NEW;
        END;
        $fault$;
        CREATE TRIGGER ${name} BEFORE ${event} ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${name}();
    `);
    return () => {
        owned.script(`DROP TRIGGER ${name} ON public.${table}; DROP FUNCTION public.${name}();`);
    };
}

// --------------------------------------------------------------------------------------------------------------------
// A. The access boundary, through the production mount
// --------------------------------------------------------------------------------------------------------------------

test('A. production mount: the queue answers an allowlisted super admin and nobody else; every other caller is refused before any validation, and reads and writes nothing', async () => {
    const buyer = seedBuyerAccount(psql, 'opsq-access');
    const note = `ACCESS-NOTE-${crypto.randomUUID().slice(0, 8)}`;
    const requestId = await buyerRequest(buyer, 'access', note);
    const admin = seedSuperAdmin('access-admin');

    const owner = seedUser('access-owner');
    const site = seedStore(owner, 'access');
    const storeAdmin = seedUser('access-store-admin');
    seedEmployee(storeAdmin, 'admin', site); // the admin tier by role string, but a STORE employee
    const storeAgent = seedUser('access-store-agent');
    seedEmployee(storeAgent, 'support', site);
    const viewer = seedUser('access-viewer');
    seedEmployee(viewer, 'viewer', null);
    const agent = seedUser('access-agent');
    seedEmployee(agent, 'support', null);
    const lead = seedUser('access-lead');
    seedEmployee(lead, 'manager', null);
    const invited = seedUser('access-invited');
    seedEmployee(invited, 'admin', null, { status: 'invited' });
    const disabled = seedUser('access-disabled');
    seedEmployee(disabled, 'admin', null, { status: 'disabled' });
    const removed = seedUser('access-removed');
    seedEmployee(removed, 'admin', null, { deleted: true });
    const stranger = seedUser('access-stranger');

    // Valid AND malformed requests. A refused caller gets the gate's answer for both: authorization runs before validation.
    const attempts: Array<[string, string, RequestInit]> = [
        ['the queue filtered to privacy', `${OPS}/tickets?topic=privacy`, {}],
        ['an unsupported filter', `${OPS}/tickets?topic=not-a-topic&limit=0`, {}],
        ['the request itself', `${OPS}/tickets/${requestId}`, {}],
        ['a malformed id', `${OPS}/tickets/not-a-ticket-id`, {}],
        ['a reply', `${OPS}/tickets/${requestId}/messages`, send('POST', { body: 'A reply', visibility: 'public', reason: REASON })],
        ['a malformed reply body', `${OPS}/tickets/${requestId}/messages`, raw('POST', '{"body": ')],
        ['creating a privacy ticket', `${OPS}/tickets`, send('POST', { requester_type: 'customer', requester_user_id: buyer.id, subject: 'A forged request', body: 'Text', topic: 'privacy', reason: REASON })],
    ];
    const needles = [requestId, buyer.id, buyer.email, note];
    const snapshot = () => ({ counts: counts(), row: ticketRow(requestId), messages: messagesOf(requestId) });
    const untouched = snapshot();

    const refused: Array<[string, Person]> = [
        ['a platform viewer', viewer],
        ['a platform agent', agent],
        ['a platform lead', lead],
        ['a store employee whose role is admin', storeAdmin],
        ['a store employee whose role is support', storeAgent],
        ['the store owner', owner],
        ['an invited platform employee', invited],
        ['a disabled platform employee', disabled],
        ['a soft-deleted platform employee', removed],
        ['a user with no employee row', stranger],
    ];
    for (const [name, person] of refused) {
        for (const [what, path, init] of attempts) {
            const response = await as(person, path, init);
            assert.equal(response.status, 403, `${name}, ${what}: ${response.status} ${response.text}`);
            assert.equal(response.json?.error?.code, 'FORBIDDEN', `${name}, ${what}: ${response.text}`);
            assert.equal(response.json?.error?.message, OPS_GATE_MESSAGE, `${name}, ${what}: refused by the ops gate, before the support router runs`);
            assert.deepEqual(leaks(response.text, needles), [], `${name}, ${what}`);
        }
    }

    // A buyer's session, the super admin's own id under a forged signature, and no credential at all: 401, before anything else.
    const forged = await createLetbuyyInternalIdentityHeaders({ userId: admin.id, email: admin.email, secret: 'a-secret-this-gateway-was-never-given' });
    assert.ok(forged.ok, 'the forged identity was signed');
    const credentials: Array<[string, Record<string, string>]> = [
        ['a buyer session', await buyerHeaders(keys, buyer.id)],
        ['a forged staff signature', { ...(forged as { headers: Record<string, string> }).headers, 'Content-Type': 'application/json' }],
        ['no credential', { 'Content-Type': 'application/json' }],
    ];
    for (const [name, headers] of credentials) {
        for (const [what, path, init] of attempts) {
            const response = await gateway.request(path, { ...init, headers });
            assert.equal(response.status, 401, `${name}, ${what}: ${response.status} ${response.text}`);
            assert.deepEqual(leaks(response.text, needles), [], `${name}, ${what}`);
        }
    }

    assert.deepEqual(snapshot(), untouched, 'no refused call read (a read writes an audit row) or wrote anything');

    // The positive control: the same requests, made by the allowlisted super admin. (Results are keyed by name: names are unique.)
    assert.equal(new Set(attempts.map(([what]) => what)).size, attempts.length);
    const privacyBefore = Number(psql(`SELECT count(*) FROM support_tickets WHERE topic = 'privacy';`));
    const results: Record<string, unknown> = {};
    for (const [what, path, init] of attempts) {
        const response = await as(admin, path, init);
        results[what] = [response.status, response.json?.error?.code ?? null];
        if (response.status >= 400) assertSanitized(response, `the super admin, ${what}`, [buyer.id, buyer.email, note]);
    }
    assert.deepEqual(results, {
        'the queue filtered to privacy': [200, null],
        'an unsupported filter': [400, 'VALIDATION_ERROR'],
        'the request itself': [200, null],
        'a malformed id': [400, 'VALIDATION_ERROR'],
        'a reply': [200, null],
        'a malformed reply body': [400, 'INVALID_INPUT'],
        'creating a privacy ticket': [400, 'VALIDATION_ERROR'],
    });
    const queue = await as(admin, `${OPS}/tickets?topic=privacy&limit=100`);
    assert.ok(ids(queue).includes(requestId), 'the super admin finds the request in the privacy queue');
    assert.equal(Number(psql(`SELECT count(*) FROM support_tickets WHERE topic = 'privacy';`)), privacyBefore, 'and still cannot create one');
});

// --------------------------------------------------------------------------------------------------------------------
// B. Topic contracts and validation
// --------------------------------------------------------------------------------------------------------------------

test('B1. the queue filters by topic=privacy with exactly the privacy rows and their total; status, priority, site, pagination and search keep their meaning', async () => {
    const admin = seedSuperAdmin('filter-admin');
    const buyerA = seedBuyerAccount(psql, 'opsq-filter-a');
    const buyerB = seedBuyerAccount(psql, 'opsq-filter-b');
    const buyerC = seedBuyerAccount(psql, 'opsq-filter-c');
    const accessA = await buyerRequest(buyerA, 'access');
    await buyerRequest(buyerA, 'erasure');
    await buyerRequest(buyerB, 'access');
    await resolveTicket(admin, accessA);
    const removed = await buyerRequest(buyerC, 'access');
    psql(`UPDATE support_tickets SET deleted_at = now() WHERE id = '${removed}';`); // a soft-deleted request is not in the queue

    const owner = seedUser('filter-owner');
    const site = seedStore(owner, 'filter');
    const billing = await createTicket(admin, { topic: 'billing', priority: 'high', site_id: site, subject: 'An invoice question' });
    const general = await createTicket(admin, { topic: 'general', subject: 'A general question' });
    const grammar = await createTicket(admin, { topic: 'general', subject: 'Refund (urgent), order #12: "late" delivery\\path' });

    // The privacy topic: every live privacy ticket, nothing else, and the total that goes with it.
    const privacy = queueIds(`topic = 'privacy'`);
    const all = await as(admin, `${OPS}/tickets?topic=privacy&limit=100`);
    assert.equal(all.status, 200, all.text);
    assert.deepEqual(ids(all), privacy);
    assert.equal(all.json?.meta?.total, privacy.length);
    assert.ok(listed(all).every((row) => row.topic === 'privacy'));
    assert.ok(!ids(all).includes(removed), 'a soft-deleted request is not listed');

    // Pages of two: the same set, in order, no overlap, the same total on every page.
    const paged: string[] = [];
    for (let page = 1; page <= Math.ceil(privacy.length / 2); page += 1) {
        const response = await as(admin, `${OPS}/tickets?topic=privacy&limit=2&page=${page}`);
        assert.equal(response.status, 200, response.text);
        assert.equal(response.json?.meta?.total, privacy.length);
        assert.equal(response.json?.meta?.per_page, 2);
        paged.push(...ids(response));
    }
    assert.deepEqual(paged, privacy);

    // Combined with another filter, and the ordinary filters on their own.
    const filters: Array<[string, string]> = [
        ['topic=privacy&status=open', `topic = 'privacy' AND status = 'open'`],
        ['topic=privacy&status=resolved', `topic = 'privacy' AND status = 'resolved'`],
        ['topic=general', `topic = 'general'`],
        ['topic=billing&priority=high', `topic = 'billing' AND priority = 'high'`],
        [`site_id=${site}`, `site_id = '${site}'`],
    ];
    for (const [query, where] of filters) {
        const response = await as(admin, `${OPS}/tickets?${query}&limit=100`);
        assert.equal(response.status, 200, `${query}: ${response.text}`);
        const expected = queueIds(where);
        assert.deepEqual(ids(response), expected, query);
        assert.equal(response.json?.meta?.total, expected.length, query);
    }
    assert.ok(queueIds(`topic = 'general'`).includes(general.id as string));
    assert.deepEqual(queueIds(`site_id = '${site}'`), [billing.id]);

    // Search text that contains the filter grammar's own characters is matched as text.
    for (const text of ['(urgent), order #12: "late"', 'delivery\\path', 'Refund (urgent)']) {
        const response = await as(admin, `${OPS}/tickets?q=${encodeURIComponent(text)}`);
        assert.equal(response.status, 200, `q=${text}: ${response.text}`);
        assert.deepEqual(ids(response), [grammar.id], `q=${text}`);
        assert.equal(response.json?.meta?.total, 1, `q=${text}`);
    }
    const unmatched = await as(admin, `${OPS}/tickets?q=${encodeURIComponent('no ticket says this')}`);
    assert.deepEqual([unmatched.status, ids(unmatched), unmatched.json?.meta?.total], [200, [], 0]);
});

test('B2. a malformed filter, id or body is a sanitized 400 (never an internal error) and writes nothing', async () => {
    const admin = seedSuperAdmin('invalid-admin');
    const ticket = await createTicket(admin, { subject: 'A target for malformed requests' });
    const id = ticket.id as string;
    const missingMacro = crypto.randomUUID();
    const untouched = { counts: counts(), row: ticketRow(id), messages: messagesOf(id) };

    const cases: Array<[string, string, RequestInit, string]> = [
        ['an unknown topic', `${OPS}/tickets?topic=not-a-topic`, {}, 'VALIDATION_ERROR'],
        ['a topic in the wrong case', `${OPS}/tickets?topic=PRIVACY`, {}, 'VALIDATION_ERROR'],
        ['an unknown status', `${OPS}/tickets?status=reopened`, {}, 'VALIDATION_ERROR'],
        ['an unknown priority', `${OPS}/tickets?priority=p0`, {}, 'VALIDATION_ERROR'],
        ['a zero page size', `${OPS}/tickets?limit=0`, {}, 'VALIDATION_ERROR'],
        ['a page size over the cap', `${OPS}/tickets?limit=101`, {}, 'VALIDATION_ERROR'],
        ['page zero', `${OPS}/tickets?page=0`, {}, 'VALIDATION_ERROR'],
        ['a page that is not a number', `${OPS}/tickets?page=two`, {}, 'VALIDATION_ERROR'],
        ['an assignee that is not an id', `${OPS}/tickets?assignee_id=someone`, {}, 'VALIDATION_ERROR'],
        ['a site that is not an id', `${OPS}/tickets?site_id=a-store`, {}, 'VALIDATION_ERROR'],
        ['a search over the length cap', `${OPS}/tickets?q=${'x'.repeat(161)}`, {}, 'VALIDATION_ERROR'],
        ['detail of a malformed id', `${OPS}/tickets/not-a-ticket-id`, {}, 'VALIDATION_ERROR'],
        ['reply to a malformed id', `${OPS}/tickets/not-a-ticket-id/messages`, send('POST', { body: 'Hello', reason: REASON }), 'VALIDATION_ERROR'],
        ['assign a malformed id', `${OPS}/tickets/not-a-ticket-id/assign`, send('PATCH', { assignee_id: null, reason: REASON }), 'VALIDATION_ERROR'],
        ['escalate a malformed id', `${OPS}/tickets/not-a-ticket-id/escalate`, send('POST', { target: 'finance', reason: REASON }), 'VALIDATION_ERROR'],
        ['resolve a malformed id', `${OPS}/tickets/not-a-ticket-id/resolve`, send('POST', { reason: REASON }), 'VALIDATION_ERROR'],
        ['satisfaction for a malformed id', `${OPS}/tickets/not-a-ticket-id/csat`, send('POST', { score: 5, reason: REASON }), 'VALIDATION_ERROR'],
        ['a create body that is not JSON', `${OPS}/tickets`, raw('POST', '{'), 'INVALID_INPUT'],
        ['a reply body that is not JSON', `${OPS}/tickets/${id}/messages`, raw('POST', 'not json'), 'INVALID_INPUT'],
        ['an empty resolve body', `${OPS}/tickets/${id}/resolve`, raw('POST', ''), 'INVALID_INPUT'],
        ['an assign body that is not JSON', `${OPS}/tickets/${id}/assign`, raw('PATCH', '['), 'INVALID_INPUT'],
        ['a macro body that is not JSON', `${OPS}/macros`, raw('POST', '{'), 'INVALID_INPUT'],
        ['a reply whose body is a number', `${OPS}/tickets/${id}/messages`, send('POST', { body: 123, reason: REASON }), 'VALIDATION_ERROR'],
        ['a reply with an unknown visibility', `${OPS}/tickets/${id}/messages`, send('POST', { body: 'Hello', visibility: 'secret', reason: REASON }), 'VALIDATION_ERROR'],
        ['a reply with an unknown status', `${OPS}/tickets/${id}/messages`, send('POST', { body: 'Hello', status: 'reopened', reason: REASON }), 'VALIDATION_ERROR'],
        ['a reply whose metadata is a list', `${OPS}/tickets/${id}/messages`, send('POST', { body: 'Hello', metadata: [], reason: REASON }), 'VALIDATION_ERROR'],
        ['a reply with too short a reason', `${OPS}/tickets/${id}/messages`, send('POST', { body: 'Hello', reason: 'short' }), 'VALIDATION_ERROR'],
        ['a reply naming a macro that does not exist', `${OPS}/tickets/${id}/messages`, send('POST', { body: 'Hello', macro_id: missingMacro, reason: REASON }), 'VALIDATION_ERROR'],
        ['an assign body whose assignee is not an id', `${OPS}/tickets/${id}/assign`, send('PATCH', { assignee_id: 'someone', reason: REASON }), 'VALIDATION_ERROR'],
        ['an unknown escalation target', `${OPS}/tickets/${id}/escalate`, send('POST', { target: 'police', reason: REASON }), 'VALIDATION_ERROR'],
        ['a satisfaction score out of range', `${OPS}/tickets/${id}/csat`, send('POST', { score: 9, reason: REASON }), 'VALIDATION_ERROR'],
        ['a macro name too short', `${OPS}/macros`, send('POST', { name: 'x', body: 'Text', reason: REASON }), 'VALIDATION_ERROR'],
    ];
    // The results are keyed by name: a repeated name would silently drop a case's assertion.
    assert.equal(new Set(cases.map(([name]) => name)).size, cases.length, 'every case has its own name');
    const observed: Record<string, unknown> = {};
    for (const [name, path, init] of cases) {
        const response = await as(admin, path, init);
        observed[name] = [response.status, response.json?.error?.code ?? null];
        if (response.status >= 400) assertSanitized(response, name, [missingMacro]);
    }
    assert.deepEqual(observed, Object.fromEntries(cases.map(([name, , , code]) => [name, [400, code]])));
    assert.deepEqual({ counts: counts(), row: ticketRow(id), messages: messagesOf(id) }, untouched, 'a refused request wrote nothing, not even a read audit');
});

test('B3. generic ticket and macro creation still refuse topic=privacy and write nothing; ordinary creation is unchanged', async () => {
    const admin = seedSuperAdmin('create-admin');
    const buyer = seedBuyerAccount(psql, 'opsq-create');
    const subject = `Operator privacy attempt ${crypto.randomUUID().slice(0, 8)}`;
    const macroName = `Privacy macro ${crypto.randomUUID().slice(0, 8)}`;
    const before = counts();

    const ticket = await as(admin, `${OPS}/tickets`, send('POST', {
        requester_type: 'customer', requester_user_id: buyer.id, subject, body: 'Text', topic: 'privacy',
        metadata: { privacy_request_type: 'erasure', fulfillment_outcome: 'fulfilled' }, reason: REASON,
    }));
    const macro = await as(admin, `${OPS}/macros`, send('POST', { name: macroName, body: 'Text', topic: 'privacy', reason: REASON }));
    assert.deepEqual([ticket.status, ticket.json?.error?.code, macro.status, macro.json?.error?.code], [400, 'VALIDATION_ERROR', 400, 'VALIDATION_ERROR'], `${ticket.text} ${macro.text}`);
    assertSanitized(ticket, 'privacy ticket', [buyer.id]);
    assertSanitized(macro, 'privacy macro');
    assert.deepEqual(counts(), before, 'neither attempt wrote anything');
    assert.equal(Number(psql(`SELECT count(*) FROM support_tickets WHERE subject = '${subject}';`)), 0);
    assert.equal(unresolved(buyer.id, 'erasure'), 0, 'no privacy request exists for the buyer');

    const billing = await createTicket(admin, { topic: 'billing', subject: 'A billing question' });
    const id = billing.id as string;
    assert.deepEqual([billing.topic, billing.status], ['billing', 'open']);
    assert.deepEqual(clocksOf(id).map((clock) => [clock.clock_type, clock.satisfied_at, clock.paused]), [['first_response', null, false], ['resolution', null, false]]);
    assert.deepEqual(messagesOf(id).map((message) => [message.author_type, message.visibility, message.body]), [['requester', 'public', 'A synthetic question']]);
    assert.deepEqual(auditOf(id).map((row) => row.action), ['support.ticket.create']);
    const ordinaryMacro = await as(admin, `${OPS}/macros`, send('POST', { name: `General macro ${crypto.randomUUID().slice(0, 8)}`, body: 'Thanks for writing in', topic: 'general', reason: REASON }));
    assert.equal(ordinaryMacro.status, 201, ordinaryMacro.text);
});

// --------------------------------------------------------------------------------------------------------------------
// C. A successful reply
// --------------------------------------------------------------------------------------------------------------------

test('C. a reply writes its message, the ticket\'s new state, the SLA bookkeeping and its audit row together, attributed to the operator, and invents no fulfillment', async () => {
    const admin = seedSuperAdmin('reply-admin');
    const id = (await createTicket(admin, { topic: 'technical', subject: 'The checkout page is slow' })).id as string;

    // An internal note: recorded and attributed; the ticket keeps its status and has still had no first response.
    const note = await as(admin, `${OPS}/tickets/${id}/messages`, send('POST', { body: 'Checked the logs', visibility: 'internal', reason: REASON }));
    assert.equal(note.status, 200, note.text);
    const noteRow = messagesOf(id).find((message) => message.body === 'Checked the logs');
    const afterNote = ticketRow(id);
    assert.deepEqual({
        response: [note.json?.data?.message?.id, note.json?.data?.ticket?.status, note.json?.data?.linked_ts_case_id, note.json?.data?.trust_safety_escalation],
        message: noteRow && [noteRow.author_type, noteRow.author_id, noteRow.author_email, noteRow.visibility, noteRow.created_by],
        ticket: [afterNote.status, afterNote.first_response_at, afterNote.last_agent_message_at === noteRow?.created_at, afterNote.updated_by],
        clocks: clocksOf(id).map((clock) => [clock.clock_type, clock.satisfied_at, clock.paused]),
        audit: auditOf(id).slice(1).map((row) => [row.action, row.actor_id, row.actor_email, row.actor_type, row.metadata.visibility, row.metadata.reason, row.metadata.message_id]),
    }, {
        response: [noteRow?.id, 'open', null, { status: 'not_triggered' }],
        message: ['agent', admin.id, admin.email, 'internal', admin.id],
        ticket: ['open', null, true, admin.id],
        clocks: [['first_response', null, false], ['resolution', null, false]],
        audit: [['support.ticket.internal_note', admin.id, admin.email, 'employee', 'internal', REASON, noteRow?.id]],
    });

    // A public reply (the default visibility): pending_customer, the first response, its SLA clock satisfied, resolution paused.
    const reply = await as(admin, `${OPS}/tickets/${id}/messages`, send('POST', { body: 'We are looking into it', reason: REASON }));
    assert.equal(reply.status, 200, reply.text);
    const replyRow = messagesOf(id).find((message) => message.body === 'We are looking into it');
    const afterReply = ticketRow(id);
    assert.deepEqual({
        response: [reply.json?.data?.message?.id, reply.json?.data?.ticket?.status, reply.json?.data?.trust_safety_escalation],
        message: replyRow && [replyRow.author_type, replyRow.author_id, replyRow.visibility],
        ticket: [afterReply.status, afterReply.first_response_at === replyRow?.created_at, afterReply.last_agent_message_at === replyRow?.created_at, afterReply.updated_by],
        clocks: clocksOf(id).map((clock) => [clock.clock_type, clock.satisfied_at === (clock.clock_type === 'first_response' ? afterReply.first_response_at : null), clock.paused]),
        audit: auditOf(id).slice(2).map((row) => [row.action, row.actor_id, row.metadata.visibility, row.metadata.status, row.metadata.previous_status, row.metadata.message_id]),
    }, {
        response: [replyRow?.id, 'pending_customer', { status: 'not_triggered' }],
        message: ['agent', admin.id, 'public'],
        ticket: ['pending_customer', true, true, admin.id],
        clocks: [['first_response', true, false], ['resolution', true, true]],
        audit: [['support.ticket.reply', admin.id, 'public', 'pending_customer', 'open', replyRow?.id]],
    });

    // A second public reply moves the last agent message, never the first response.
    const second = await as(admin, `${OPS}/tickets/${id}/messages`, send('POST', { body: 'Still on it', reason: REASON }));
    assert.equal(second.status, 200, second.text);
    const secondRow = messagesOf(id).find((message) => message.body === 'Still on it');
    assert.equal(ticketRow(id).first_response_at, afterReply.first_response_at);
    assert.equal(ticketRow(id).last_agent_message_at, secondRow?.created_at);

    // On a buyer's privacy request: the buyer reads the public reply and never the internal note; what the buyer is told
    // stays truthful, and an outcome claim in the message's metadata stays on the message.
    const buyer = seedBuyerAccount(psql, 'opsq-reply');
    const requestId = await buyerRequest(buyer, 'access', 'please send me my data');
    assert.equal((await as(admin, `${OPS}/tickets/${requestId}/messages`, send('POST', { body: 'Verifying the account', visibility: 'internal', reason: REASON }))).status, 200);
    assert.equal((await as(admin, `${OPS}/tickets/${requestId}/messages`, send('POST', { body: 'We have your request', reason: REASON }))).status, 200);
    assert.deepEqual(await buyerSees(buyer, requestId), ['please send me my data', 'We have your request']);
    assert.deepEqual(await privacyView(buyer, requestId), { status: 'in_review', type: 'access' });

    const hostile = { fulfillment_outcome: 'fulfilled', privacy_request_type: 'erasure' };
    const closing = await as(admin, `${OPS}/tickets/${requestId}/messages`, send('POST', { body: 'Closing this request', status: 'resolved', metadata: hostile, reason: REASON }));
    assert.equal(closing.status, 200, closing.text);
    assert.equal(ticketRow(requestId).status, 'resolved');
    assert.deepEqual(ticketRow(requestId).metadata, { privacy_request_type: 'access' }, 'the reply never touches the request\'s own metadata');
    assert.deepEqual(messagesOf(requestId).find((message) => message.body === 'Closing this request')?.metadata, hostile);
    assert.deepEqual(await privacyView(buyer, requestId), { status: 'closed_no_fulfillment', type: 'access' });
    assert.equal(Number(psql(`SELECT count(*) FROM support_tickets WHERE topic = 'privacy' AND metadata ? 'fulfillment_outcome';`)), 0);
});

// --------------------------------------------------------------------------------------------------------------------
// D. A refused transition
// --------------------------------------------------------------------------------------------------------------------

test('D. a reply the privacy rule refuses is refused whole (409, no message, no audit, no state change), retrying adds nothing, the status routes agree, and the reply that keeps the request closed is accepted', async () => {
    const admin = seedSuperAdmin('refuse-admin');
    const { buyer, closed, open } = await closedAndOpen(admin, 'opsq-refuse');
    const snapshot = async () => ({
        counts: counts(),
        closed: ticketRow(closed),
        open: ticketRow(open),
        messages: messagesOf(closed),
        audit: auditOf(closed),
        buyerSees: await buyerSees(buyer, closed),
    });
    const untouched = await snapshot();

    const replies: Array<[string, Record<string, unknown>]> = [
        ['a public reply, which reopens it to pending_customer', { body: 'Reopening your request', reason: REASON }],
        ['the same reply again', { body: 'Reopening your request', reason: REASON }],
        ['and a third time', { body: 'Reopening your request', reason: REASON }],
        ['an explicit reopen', { body: 'Reopening', status: 'open', reason: REASON }],
        ['an internal note that moves it to pending_internal', { body: 'A note', visibility: 'internal', status: 'pending_internal', reason: REASON }],
        ['a reply that escalates it', { body: 'Escalating', status: 'escalated', reason: REASON }],
    ];
    const statusRoutes: Array<[string, string, RequestInit]> = [
        ['assign, which moves it to pending_internal', `${OPS}/tickets/${closed}/assign`, send('PATCH', { assignee_id: null, reason: REASON })],
        ['escalate to finance', `${OPS}/tickets/${closed}/escalate`, send('POST', { target: 'finance', reason: REASON })],
        ['escalate to Trust & Safety', `${OPS}/tickets/${closed}/escalate`, send('POST', { target: 'trust_safety', reason: REASON })],
    ];
    const outcomes: Array<[string, number, unknown]> = [];
    const answers: GatewayResponse[] = [];
    for (const [name, payload] of replies) {
        const response = await as(admin, `${OPS}/tickets/${closed}/messages`, send('POST', payload));
        outcomes.push([name, response.status, response.json?.error?.code ?? null]);
        answers.push(response);
    }
    for (const [name, path, init] of statusRoutes) {
        const response = await as(admin, path, init);
        outcomes.push([name, response.status, response.json?.error?.code ?? null]);
        answers.push(response);
    }
    // One comparison for the answers and the state together: nothing of any refused attempt survived (no message, no system
    // note, no audit row, no Trust & Safety case, no state change), and every attempt was told so.
    assert.deepEqual(
        { outcomes, state: await snapshot() },
        { outcomes: [...replies, ...statusRoutes].map(([name]) => [name, 409, 'CONFLICT']), state: untouched },
    );
    for (const response of answers) assertSanitized(response, 'a refused attempt', [buyer.id, open]);
    assert.equal(unresolved(buyer.id, 'access'), 1, 'one unresolved request of the type, as before');

    // The positive controls: the reply that keeps the request closed, a plain internal note, and a reply on the open request.
    const keepClosed = await as(admin, `${OPS}/tickets/${closed}/messages`, send('POST', { body: 'Answering on the closed request', status: 'resolved', reason: REASON }));
    const quietNote = await as(admin, `${OPS}/tickets/${closed}/messages`, send('POST', { body: 'A note on the closed request', visibility: 'internal', reason: REASON }));
    const onOpen = await as(admin, `${OPS}/tickets/${open}/messages`, send('POST', { body: 'Answering the open request', reason: REASON }));
    assert.deepEqual([keepClosed.status, quietNote.status, onOpen.status], [200, 200, 200], `${keepClosed.text} ${quietNote.text} ${onOpen.text}`);
    assert.deepEqual([ticketRow(closed).status, ticketRow(open).status], ['resolved', 'pending_customer']);
    assert.deepEqual(messagesOf(closed).slice(untouched.messages.length).map((message) => message.body), ['Answering on the closed request', 'A note on the closed request']);
    assert.deepEqual(auditOf(closed).slice(untouched.audit.length).map((row) => [row.action, row.metadata.status]), [['support.ticket.reply', 'resolved'], ['support.ticket.internal_note', 'resolved']]);
    assert.equal(unresolved(buyer.id, 'access'), 1);
});

// --------------------------------------------------------------------------------------------------------------------
// E. Named faults
// --------------------------------------------------------------------------------------------------------------------

/** One reply meets one named fault inside its transaction: it must fail whole, say so plainly, and its retry must be the one reply. */
async function mandatoryWriteFault(label: string, fault: string, table: 'audit_logs' | 'ticket_sla_clocks', event: 'INSERT' | 'UPDATE'): Promise<void> {
    const admin = seedSuperAdmin(label);
    const id = (await createTicket(admin, { subject: `Fault target: ${fault}` })).id as string;
    const text = `A reply that meets a failing ${fault}`;
    const untouched = { row: ticketRow(id), messages: messagesOf(id), clocks: clocksOf(id), audit: auditOf(id) };
    const removeFault = installFault(table, event, id);
    let failed: GatewayResponse;
    try {
        failed = await as(admin, `${OPS}/tickets/${id}/messages`, send('POST', { body: text, reason: REASON }));
    } finally {
        removeFault();
    }
    assert.deepEqual(
        { outcome: [failed.status, failed.json?.error?.code ?? null], state: { row: ticketRow(id), messages: messagesOf(id), clocks: clocksOf(id), audit: auditOf(id) } },
        { outcome: [500, 'DB_ERROR'], state: untouched },
        `${fault}: the reply failed whole, and nothing of it survived: ${failed.text}`,
    );
    assertSanitized(failed, fault);

    const retried = await as(admin, `${OPS}/tickets/${id}/messages`, send('POST', { body: text, reason: REASON }));
    assert.equal(retried.status, 200, `${fault}, retried: ${retried.text}`);
    assert.deepEqual({
        replies: messagesOf(id).filter((message) => message.body === text).length,
        status: ticketRow(id).status,
        actions: auditOf(id).map((row) => row.action),
    }, { replies: 1, status: 'pending_customer', actions: ['support.ticket.create', 'support.ticket.reply'] }, `${fault}: the retry is the one reply`);
}

test('E1a. named fault: the reply\'s audit row cannot be written, so nothing of the reply is (message, ticket state, SLA clocks), and the retry is the one reply', async () => {
    await mandatoryWriteFault('fault-audit-admin', 'the audit row', 'audit_logs', 'INSERT');
});

test('E1b. named fault: the reply\'s SLA clock update fails, so nothing of the reply is written, and the retry is the one reply', async () => {
    await mandatoryWriteFault('fault-clock-admin', 'the SLA clock update', 'ticket_sla_clocks', 'UPDATE');
});

test('E2a. a ticket that is gone (removed, or never existed) is a 404 on every ticket route, and nothing is written to it', async () => {
    const admin = seedSuperAdmin('vanish-admin');
    const routes = (id: string): Array<[string, string, RequestInit]> => [
        ['detail', `${OPS}/tickets/${id}`, {}],
        ['reply', `${OPS}/tickets/${id}/messages`, send('POST', { body: 'Hello', reason: REASON })],
        ['assign', `${OPS}/tickets/${id}/assign`, send('PATCH', { assignee_id: null, reason: REASON })],
        ['escalate', `${OPS}/tickets/${id}/escalate`, send('POST', { target: 'engineering', reason: REASON })],
        ['resolve', `${OPS}/tickets/${id}/resolve`, send('POST', { reason: REASON })],
    ];

    const gone = (await createTicket(admin, { subject: 'Removed before the reply' })).id as string;
    psql(`UPDATE support_tickets SET deleted_at = now() WHERE id = '${gone}';`);
    const never = crypto.randomUUID();
    const untouched = { counts: counts(), row: ticketRow(gone), messages: messagesOf(gone), clocks: clocksOf(gone) };
    const outcomes: Array<[string, number, unknown]> = [];
    for (const [label, id] of [['removed', gone], ['never existed', never]] as const) {
        for (const [name, path, init] of routes(id)) {
            const response = await as(admin, path, init);
            outcomes.push([`${label}: ${name}`, response.status, response.json?.error?.code ?? null]);
            assertSanitized(response, `${label}: ${name}`);
        }
    }
    assert.deepEqual(
        { outcomes, state: { counts: counts(), row: ticketRow(gone), messages: messagesOf(gone), clocks: clocksOf(gone) } },
        { outcomes: (['removed', 'never existed'] as const).flatMap((label) => routes(never).map(([name]) => [`${label}: ${name}`, 404, 'NOT_FOUND'])), state: untouched },
        'every route says not found, and nothing was written to a ticket that is gone',
    );
});

test('E2b. a ticket removed while the reply is in flight (held at its write, then let go) is a 404, and nothing is written to it', async () => {
    const admin = seedSuperAdmin('inflight-admin');
    const racing = (await createTicket(admin, { subject: 'Removed while the reply is in flight' })).id as string;
    const before = { row: ticketRow(racing), messages: messagesOf(racing), clocks: clocksOf(racing), audit: auditOf(racing) };
    let signalReached!: () => void;
    const reached = new Promise<void>((resolve) => { signalReached = resolve; });
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    let holding = false;
    const tap = tapRest(owned.restUrl, async (call, forward) => {
        if (!holding && isReplyWrite(call)) {
            holding = true;
            signalReached();
            await released;
        }
        return forward();
    });
    let response: GatewayResponse;
    try {
        const pending = as(admin, `${OPS}/tickets/${racing}/messages`, send('POST', { body: 'In flight', reason: REASON }));
        await reached;
        psql(`UPDATE support_tickets SET deleted_at = now() WHERE id = '${racing}';`);
        release();
        response = await pending;
    } finally {
        release();
        tap.restore();
    }
    const after = ticketRow(racing);
    assert.notEqual(after.deleted_at, null, 'the ticket really was removed while the reply was held');
    assert.deepEqual(
        { outcome: [response.status, response.json?.error?.code ?? null], state: { row: { ...after, deleted_at: null }, messages: messagesOf(racing), clocks: clocksOf(racing), audit: auditOf(racing) } },
        { outcome: [404, 'NOT_FOUND'], state: before },
        `the reply is told the ticket is gone, and nothing was written to it: ${response.text}`,
    );
    assertSanitized(response, 'gone in flight');
});

// The Trust & Safety follow-on (a reply that mentions fraud, chargeback and the like escalates its ticket) is best-effort: the reply
// stands whatever happens to it, and the answer says exactly what happened. E3a to E3c are its three outcomes.

test('E3a. Trust & Safety follow-on refused by the privacy rule: the note is kept, no case is opened, and the answer says why', async () => {
    const admin = seedSuperAdmin('ts-refused-admin');

    // An internal note mentioning fraud on a CLOSED privacy request whose newer twin is unresolved. The note changes no status, so it
    // is kept; the follow-on cannot move the request to escalated, so it opens no case and says so.
    const { closed } = await closedAndOpen(admin, 'opsq-ts-refused');
    const refusedBefore = { notes: systemNotes(closed), actions: auditOf(closed).map((row) => row.action) };
    const refused = await as(admin, `${OPS}/tickets/${closed}/messages`, send('POST', { body: 'The requester reported fraud on the account', visibility: 'internal', reason: REASON }));
    const closedAfter = ticketRow(closed);
    assert.deepEqual({
        status: refused.status,
        escalation: refused.json?.data?.trust_safety_escalation,
        linked: refused.json?.data?.linked_ts_case_id,
        ticket: [closedAfter.status, closedAfter.escalated_to, closedAfter.linked_ts_case_id],
        cases: casesFor(closed),
        notes: systemNotes(closed),
        actions: auditOf(closed).map((row) => row.action),
        kept: messagesOf(closed).some((message) => message.body === 'The requester reported fraud on the account'),
    }, {
        status: 200,
        escalation: { status: 'refused', reason: 'privacy_request_conflict' },
        linked: null,
        ticket: ['resolved', null, null],
        cases: 0,
        notes: refusedBefore.notes,
        actions: [...refusedBefore.actions, 'support.ticket.internal_note'],
        kept: true,
    });
});

test('E3b. Trust & Safety follow-on failing at case creation (one named fault): the reply stands, the ticket is marked for Trust & Safety without a case, nothing claims one, and the answer says which step failed', async () => {
    const admin = seedSuperAdmin('ts-failed-admin');
    const failing = (await createTicket(admin, { subject: 'A payout question' })).id as string;
    const tap = tapRest(owned.restUrl, async (call, forward) => (call.method === 'POST' && call.resource === 'ts_cases'
        ? restJson(500, { code: 'XX000', message: 'injected fault: the case store is unavailable', details: null, hint: null })
        : forward()));
    let failed: GatewayResponse;
    try {
        failed = await as(admin, `${OPS}/tickets/${failing}/messages`, send('POST', { body: 'This looks like a chargeback', reason: REASON }));
    } finally {
        tap.restore();
    }
    const failingAfter = ticketRow(failing);
    assert.deepEqual({
        status: failed.status,
        escalation: failed.json?.data?.trust_safety_escalation,
        linked: failed.json?.data?.linked_ts_case_id,
        ticket: [failingAfter.status, failingAfter.escalated_to, failingAfter.linked_ts_case_id],
        cases: casesFor(failing),
        notes: systemNotes(failing),
        actions: auditOf(failing).map((row) => row.action),
        kept: messagesOf(failing).some((message) => message.body === 'This looks like a chargeback'),
    }, {
        status: 200,
        escalation: { status: 'failed', stage: 'case' },
        linked: null,
        ticket: ['escalated', 'trust_safety', null],
        cases: 0,
        notes: [],
        actions: ['support.ticket.create', 'support.ticket.reply'],
        kept: true,
    });
    assertSanitized(failed, 'a failed follow-on');
});

test('E3c. Trust & Safety follow-on that succeeds: the case exists, the ticket points at it, a system note and an escalation audit row record it, and a later report opens no second case', async () => {
    const admin = seedSuperAdmin('ts-linked-admin');
    const linking = (await createTicket(admin, { subject: 'A refund question' })).id as string;
    const linked = await as(admin, `${OPS}/tickets/${linking}/messages`, send('POST', { body: 'The buyer reports possible fraud', reason: REASON }));
    assert.equal(linked.status, 200, linked.text);
    const caseId = linked.json?.data?.trust_safety_escalation?.ts_case_id as string;
    const linkingAfter = ticketRow(linking);
    const escalationAudit = auditOf(linking).find((row) => row.action === 'support.ticket.escalate');
    assert.deepEqual({
        escalation: linked.json?.data?.trust_safety_escalation?.status,
        linked: linked.json?.data?.linked_ts_case_id === caseId,
        ticket: [linkingAfter.status, linkingAfter.escalated_to, linkingAfter.linked_ts_case_id === caseId],
        cases: casesFor(linking),
        notes: systemNotes(linking).length,
        actions: auditOf(linking).map((row) => row.action),
        audit: escalationAudit && [escalationAudit.actor_id, escalationAudit.metadata.target, escalationAudit.metadata.trigger, escalationAudit.metadata.linked_ts_case_id === caseId],
    }, {
        escalation: 'linked',
        linked: true,
        ticket: ['escalated', 'trust_safety', true],
        cases: 1,
        notes: 1,
        actions: ['support.ticket.create', 'support.ticket.reply', 'support.ticket.escalate'],
        audit: [admin.id, 'trust_safety', 'keyword', true],
    });

    // Already linked: another reply that mentions fraud opens no second case.
    const again = await as(admin, `${OPS}/tickets/${linking}/messages`, send('POST', { body: 'More fraud reports arrived', visibility: 'internal', reason: REASON }));
    assert.deepEqual([again.status, again.json?.data?.trust_safety_escalation, casesFor(linking)], [200, { status: 'not_triggered' }, 1]);
});

// --------------------------------------------------------------------------------------------------------------------
// F. Concurrency
// --------------------------------------------------------------------------------------------------------------------

test('F1. two agents answer one open ticket at the same moment: both replies land, and the first response is the first reply that committed', async () => {
    const admin = seedSuperAdmin('race-answer-admin');
    const shared = (await createTicket(admin, { subject: 'Two agents answer at once' })).id as string;
    const answers = await raceReplies(admin, [[shared, 'The first agent answers'], [shared, 'The second agent answers']]);
    const agentMessages = messagesOf(shared).filter((message) => message.author_type === 'agent');
    const times = agentMessages.map((message) => message.created_at).sort();
    const sharedRow = ticketRow(shared);
    assert.deepEqual({
        statuses: answers.map((response) => response.status),
        messages: agentMessages.length,
        status: sharedRow.status,
        firstResponseIsTheFirstReply: sharedRow.first_response_at === times[0],
        lastAgentMessageIsTheLastReply: sharedRow.last_agent_message_at === times[1],
        clockSatisfiedAtFirstResponse: clocksOf(shared).find((clock) => clock.clock_type === 'first_response')?.satisfied_at === sharedRow.first_response_at,
        replyAuditRows: auditOf(shared).filter((row) => row.action === 'support.ticket.reply').length,
    }, {
        statuses: [200, 200],
        messages: 2,
        status: 'pending_customer',
        firstResponseIsTheFirstReply: true,
        lastAgentMessageIsTheLastReply: true,
        clockSatisfiedAtFirstResponse: true,
        replyAuditRows: 2,
    }, `first_response_at ${sharedRow.first_response_at}, replies at ${times.join(', ')}`);
});

test('F2. two closed access requests of one buyer, reopened at the same moment: the privacy rule lets exactly one through, and the other leaves nothing', async () => {
    const admin = seedSuperAdmin('race-reopen-admin');
    const buyer = seedBuyerAccount(psql, 'opsq-race');
    const first = await buyerRequest(buyer, 'access');
    await resolveTicket(admin, first);
    const second = await buyerRequest(buyer, 'access');
    await resolveTicket(admin, second);
    assert.equal(unresolved(buyer.id, 'access'), 0);
    const targets: Array<[string, string]> = [[first, 'Reopening the first request'], [second, 'Reopening the second request']];
    const before = targets.map(([id]) => ({ messages: messagesOf(id).length, audit: auditOf(id).length }));
    const reopenings = await raceReplies(admin, targets);
    // Per request, in the order sent: what it was told, what its ticket became, and what it added.
    const perRequest = targets.map(([id], index) => ({
        answer: [reopenings[index].status, reopenings[index].json?.error?.code ?? null],
        ticket: ticketRow(id).status,
        added: { messages: messagesOf(id).length - before[index].messages, audit: auditOf(id).length - before[index].audit },
    }));
    const winnerFirst = reopenings[0].status === 200;
    const won = { answer: [200, null], ticket: 'pending_customer', added: { messages: 1, audit: 1 } };
    const lost = { answer: [409, 'CONFLICT'], ticket: 'resolved', added: { messages: 0, audit: 0 } };
    assert.deepEqual(
        { perRequest, unresolved: unresolved(buyer.id, 'access') },
        { perRequest: winnerFirst ? [won, lost] : [lost, won], unresolved: 1 },
        reopenings.map((response) => response.text).join(' '),
    );
    assertSanitized(reopenings[winnerFirst ? 1 : 0], 'the losing reopening', [buyer.id, winnerFirst ? first : second]);
});

test('F3. two fraud reports on one ticket at the same moment open one Trust & Safety case, linked once', async () => {
    const admin = seedSuperAdmin('race-report-admin');
    const reported = (await createTicket(admin, { subject: 'Two reports at once' })).id as string;
    const reports = await raceReplies(admin, [[reported, 'A buyer reports fraud'], [reported, 'A second fraud report']]);
    const outcomes = reports.map((response) => response.json?.data?.trust_safety_escalation?.status as string | undefined);
    const linkedResponse = reports.find((response) => response.json?.data?.trust_safety_escalation?.status === 'linked');
    assert.deepEqual({
        statuses: reports.map((response) => response.status),
        linkedOnce: outcomes.filter((status) => status === 'linked').length,
        // The other report found the ticket already escalated (or, if it ran after the link, already linked).
        othersKnown: outcomes.every((status) => status === 'linked' || status === 'already_escalated' || status === 'not_triggered'),
        cases: casesFor(reported),
        ticketPointsAtTheCase: Boolean(linkedResponse) && ticketRow(reported).linked_ts_case_id === linkedResponse?.json?.data?.trust_safety_escalation?.ts_case_id,
    }, {
        statuses: [200, 200],
        linkedOnce: 1,
        othersKnown: true,
        cases: 1,
        ticketPointsAtTheCase: true,
    }, `outcomes: ${outcomes.join(', ')}`);
});

// --------------------------------------------------------------------------------------------------------------------
// The database function: least privilege and rollback. LAST: it drops and re-creates the function in this database.
// --------------------------------------------------------------------------------------------------------------------

test('the reply function is SECURITY DEFINER with a fixed search_path, executable by the backend role alone; migration 264 rolls back and re-applies cleanly', () => {
    const facts = () => queryJson(psql, `
        SELECT jsonb_build_object(
          'service_role', has_function_privilege('service_role', '${REPLY_SIGNATURE}', 'EXECUTE'),
          'anon', has_function_privilege('anon', '${REPLY_SIGNATURE}', 'EXECUTE'),
          'authenticated', has_function_privilege('authenticated', '${REPLY_SIGNATURE}', 'EXECUTE'),
          'app_tenant', has_function_privilege('app_tenant', '${REPLY_SIGNATURE}', 'EXECUTE'),
          'public', (SELECT CASE WHEN p.proacl IS NULL THEN true
                                 ELSE EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') END
                     FROM pg_proc p WHERE p.oid = '${REPLY_SIGNATURE}'::regprocedure),
          'definer', (SELECT prosecdef FROM pg_proc WHERE oid = '${REPLY_SIGNATURE}'::regprocedure),
          'config', (SELECT array_to_string(proconfig, ';') FROM pg_proc WHERE oid = '${REPLY_SIGNATURE}'::regprocedure),
          'overloads', (SELECT count(*) FROM pg_proc WHERE proname = 'reply_to_support_ticket')
        )::text;
    `);
    const expected = { service_role: true, anon: false, authenticated: false, app_tenant: false, public: false, definer: true, config: 'search_path=public, pg_catalog', overloads: 1 };
    assert.deepEqual(facts(), expected);

    // The Data API roles are refused by the database itself; the backend role reaches the function, which refuses an unknown ticket by name.
    const call = `SELECT public.reply_to_support_ticket('${crypto.randomUUID()}', '${crypto.randomUUID()}', NULL, 'public', 'Hello', NULL, NULL, '[]'::jsonb, '{}'::jsonb, '${REASON}');`;
    for (const role of ['anon', 'authenticated', 'app_tenant']) {
        assert.match(owned.psqlExpectError(`SET ROLE ${role}; ${call}`), /permission denied for function reply_to_support_ticket/, role);
    }
    assert.match(owned.psqlExpectError(`SET ROLE service_role; ${call}`), /support ticket not found/);

    // Rollback removes the function and nothing else of the privacy rule; the migration re-applies, twice, to the same state.
    owned.script(readFileSync(ROLLBACK, 'utf8'));
    assert.equal(psql(`SELECT to_regprocedure('${REPLY_SIGNATURE}') IS NULL;`), 't');
    assert.equal(psql(`SELECT count(*) FROM pg_indexes WHERE indexname = 'support_tickets_privacy_open_request_uidx';`), '1');
    const migration = readFileSync(MIGRATION, 'utf8');
    owned.script(migration);
    owned.script(migration);
    assert.deepEqual(facts(), expected);
});
