// Who can reach a buyer's privacy request through the SUPPORT system, and how it reads after a support agent has acted on it.
//
// A privacy request is a support ticket (topic 'privacy', requester = the buyer, no store), so everything the support system can do
// to a ticket can be done to it. buyer-privacy-intake.postgres.test.ts proves the buyer's side. This suite proves the staff side
// against the real worker, with the real signed internal identity the gateway verifies for merchant staff and platform staff, the
// real role and tier resolution (middleware/rbac.ts), the real support routes (routes/employee.ts, routes/operations/support.ts)
// and a real Postgres:
//
//   1. a merchant's staff, a store owner, an unrelated user and a platform employee who is not active cannot see, count or reach a
//      buyer's privacy request;
//   2. through the PRODUCTION mount, the platform support queue (where a privacy request is visible) is reachable by an allowlisted
//      super admin only: platform employees of the viewer, operator and lead tiers are stopped by an earlier router's gate. The tier
//      logic the support router carries is proven separately, with that router mounted alone, so that a decision to open the queue to the
//      tiers is made knowing exactly what they would then be able to read and do;
//   3. nothing a support agent can do through a supported route makes a request read as an export or an erasure that happened:
//      replies, escalation (with hostile metadata), resolution and closure all read as in_review or closed_no_fulfillment to the
//      buyer, the protected metadata is never rewritten, and a status change cannot create a second unresolved request;
//   4. the buyer realm and the staff realm accept neither's credentials, in either direction.
//
// What is real and what is not is stated in buyer-privacy-intake.postgres.test.ts and applies here unchanged: the gateway reaches the
// database as the service role through PostgREST (so this is not a row-level-security proof), credentials are signed by keys this suite
// generates, and this is a router-and-database proof of access control and truthful status, not a journey and not an export or an erasure.
// Nothing is stubbed and no HTTP tap is used in this file.
//
// Runs only in the owned database lane (scripts/governance/run-executable-suites.mjs). There is no skip path.

import assert from 'node:assert/strict';
import test, { afterEach, before } from 'node:test';
import { Hono } from 'hono';
import { LETBUYY_BUYER_SESSION_COOKIE, LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core';
import { authMiddleware } from '../../middleware/auth';
import operationsSupportRouter from '../../routes/operations/support';
import type { Env } from '../../index';
import {
    Gateway,
    buyerHeaders,
    gatewayEnv,
    mintSession,
    newIdentityKeys,
    queryJson,
    seedBuyerAccount,
    signedIdentityHeaders,
    type GatewayResponse,
    type IdentityKeys,
    type SyntheticBuyer,
} from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const { psql } = owned;

const PRIVACY = '/v1/storefront/buyer/privacy-requests';
const BUYER_TICKETS = '/v1/storefront/buyer/support/tickets';
const STORE_TICKETS = '/v1/employees/tickets';
const OPS = '/v1/operations/support';
// Long enough for the support routes' reason rule, and free of the words the support router treats as a Trust & Safety trigger.
const REASON = 'Handling a buyer data request';
const OPS_GATE_MESSAGE = 'Insufficient role category. Required: ops';
const PLATFORM_OPERATOR_MESSAGE = 'Platform operator access required';

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
// Fixtures: people, stores, employees, tickets. All of it exists only in this suite's database.
// --------------------------------------------------------------------------------------------------------------------

interface Person {
    id: string;
    email: string;
}

function seedUser(label: string): Person {
    const id = crypto.randomUUID();
    const email = `syn-${label}-${id.slice(0, 8)}@example.invalid`;
    psql(`INSERT INTO users_custom (id, email, email_verified) VALUES ('${id}', '${email}', true);`);
    return { id, email };
}

function seedStore(owner: Person, label: string): string {
    const id = crypto.randomUUID();
    psql(`INSERT INTO sites (id, name, store_name, site_type, subdomain, custom_user_id) VALUES ('${id}', 'Synthetic ${label}', 'Synthetic ${label}', 'store', 'syn-vis-${label}-${id.slice(0, 8)}', '${owner.id}');`);
    return id;
}

/** An `employees` row: store_id set = a merchant's own staff; store_id NULL = the platform's own staff. */
function seedEmployee(person: Person, role: string, storeId: string | null, options: { status?: string; deleted?: boolean } = {}): string {
    const id = crypto.randomUUID();
    const status = options.status ?? 'active';
    psql(`INSERT INTO employees (id, user_id, email, role, store_id, status, is_active, deleted_at)
          VALUES ('${id}', '${person.id}', '${person.email}', '${role}', ${storeId ? `'${storeId}'` : 'NULL'}, '${status}', ${status === 'active'}, ${options.deleted ? 'now()' : 'NULL'});`);
    return id;
}

/** An active entry in the super-admin allowlist: what the gateway's `ops` role category and super-admin check read. */
function seedSuperAdmin(label: string): Person {
    const person = seedUser(label);
    psql(`INSERT INTO super_admin_allowlist (user_id, email, full_name, is_active) VALUES ('${person.id}', '${person.email}', 'Synthetic ${label}', true);`);
    return person;
}

function seedStoreTicket(siteId: string, label: string): { id: string; ref: string } {
    const id = crypto.randomUUID();
    const ref = `SUP-2026-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    psql(`INSERT INTO support_tickets (id, ticket_ref, site_id, requester_type, requester_email, subject, channel, topic, priority, status)
          VALUES ('${id}', '${ref}', '${siteId}', 'merchant', 'merchant-${label}@example.invalid', 'Synthetic store ticket ${label}', 'in_app', 'general', 'normal', 'open');`);
    return { id, ref };
}

// --------------------------------------------------------------------------------------------------------------------
// Requests
// --------------------------------------------------------------------------------------------------------------------

/** A request as this person: a freshly signed internal identity, the credential merchant staff and platform staff present. */
async function signedAs(person: Person, path: string, init: RequestInit = {}): Promise<GatewayResponse> {
    const headers = { ...(await signedIdentityHeaders(person.id, person.email)), ...((init.headers as Record<string, string> | undefined) ?? {}) };
    return gateway.request(path, { ...init, headers });
}

const body = (method: 'POST' | 'PATCH', payload: unknown): RequestInit => ({ method, body: JSON.stringify(payload) });

/**
 * The platform support router on its own, behind the real authMiddleware, against the real database. This is NOT the production mount: the
 * production worker puts an earlier router's gate in front of it (see the test that pins that). It exists to prove what the router's own
 * tier logic does, so that the decision about the production gate is made knowing it.
 */
const supportAlone = (() => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('/*', authMiddleware);
    app.route('/support', operationsSupportRouter);
    return app;
})();

async function aloneAs(person: Person, path: string, init: RequestInit = {}): Promise<{ status: number; text: string; json: Record<string, any> | null }> {
    const headers = { ...(await signedIdentityHeaders(person.id, person.email)), ...((init.headers as Record<string, string> | undefined) ?? {}) };
    const response = await supportAlone.request(`/support${path}`, { ...init, headers }, gateway.env);
    const text = await response.text();
    let json: Record<string, any> | null = null;
    try {
        json = JSON.parse(text);
    } catch {
        json = null;
    }
    return { status: response.status, text, json };
}

async function buyerRequest(buyer: SyntheticBuyer, type: 'access' | 'erasure', notes?: string): Promise<{ id: string; reference: string }> {
    const response = await gateway.request(PRIVACY, {
        method: 'POST',
        headers: await buyerHeaders(keys, buyer.id),
        body: JSON.stringify(notes === undefined ? { type } : { type, notes }),
    });
    assert.ok(response.status === 201 || response.status === 200, `the buyer's request: ${response.status} ${response.text}`);
    return { id: response.json?.data?.id as string, reference: response.json?.data?.reference as string };
}

interface BuyerViewRow {
    id: string;
    reference: string;
    type: string | null;
    status: string;
    created_at: string;
    updated_at: string;
}

/** What the buyer is told, per request, by the dedicated privacy route. */
async function buyerView(buyer: SyntheticBuyer): Promise<BuyerViewRow[]> {
    const response = await gateway.request(PRIVACY, { headers: await buyerHeaders(keys, buyer.id) });
    assert.equal(response.status, 200, response.text);
    return response.json?.data as BuyerViewRow[];
}

const leaks = (text: string, needles: string[]): string[] => needles.filter((needle) => text.includes(needle));

// --------------------------------------------------------------------------------------------------------------------
// Direct database readbacks
// --------------------------------------------------------------------------------------------------------------------

interface TicketSnapshot {
    id: string;
    topic: string;
    status: string;
    site_id: string | null;
    requester_user_id: string | null;
    requester_type: string;
    metadata: Record<string, unknown>;
    assignee_id: string | null;
    updated_at: string;
    deleted_at: string | null;
}

function ticket(id: string): TicketSnapshot {
    return queryJson<TicketSnapshot>(psql, `
        SELECT to_jsonb(t)::text
        FROM (SELECT id, topic, status, site_id, requester_user_id, requester_type, metadata, assignee_id, updated_at, deleted_at
              FROM support_tickets WHERE id = '${id}') t;
    `);
}

function messages(ticketId: string): Array<{ author_type: string; visibility: string; body: string; metadata: Record<string, unknown> }> {
    return queryJson(psql, `
        SELECT coalesce(jsonb_agg(jsonb_build_object('author_type', m.author_type, 'visibility', m.visibility, 'body', m.body, 'metadata', m.metadata) ORDER BY m.created_at, m.id), '[]'::jsonb)::text
        FROM ticket_messages m WHERE m.ticket_id = '${ticketId}';
    `);
}

const counts = (): { tickets: number; messages: number; csat: number } => ({
    tickets: Number(psql('SELECT count(*) FROM support_tickets;')),
    messages: Number(psql('SELECT count(*) FROM ticket_messages;')),
    csat: Number(psql('SELECT count(*) FROM ticket_csat;')),
});

const unresolved = (buyerId: string, type: string): number => Number(psql(`
    SELECT count(*) FROM support_tickets
    WHERE requester_user_id = '${buyerId}' AND topic = 'privacy' AND metadata->>'privacy_request_type' = '${type}'
      AND status NOT IN ('resolved', 'closed') AND deleted_at IS NULL;
`));

// --------------------------------------------------------------------------------------------------------------------
// 1. Merchant staff and everyone who is not platform staff
// --------------------------------------------------------------------------------------------------------------------

test('a merchant\'s own staff see their own store\'s tickets alone; a buyer privacy request is platform-level and appears in neither the rows nor the count', async () => {
    const buyerA = seedBuyerAccount(psql, 'staff-a');
    const buyerB = seedBuyerAccount(psql, 'staff-b');
    const note = `PRIVATE-NOTE-${crypto.randomUUID().slice(0, 8)}`;
    const accessA = await buyerRequest(buyerA, 'access', note);
    const erasureA = await buyerRequest(buyerA, 'erasure');
    const accessB = await buyerRequest(buyerB, 'access');
    const privacy = [accessA, erasureA, accessB];
    for (const request of privacy) {
        const row = ticket(request.id);
        assert.equal(row.topic, 'privacy');
        assert.equal(row.site_id, null, 'a privacy request belongs to no store');
    }

    const ownerOne = seedUser('owner-one');
    const ownerTwo = seedUser('owner-two');
    const siteOne = seedStore(ownerOne, 'one');
    const siteTwo = seedStore(ownerTwo, 'two');
    const staffOne = seedUser('staff-one');
    const staffTwo = seedUser('staff-two');
    seedEmployee(staffOne, 'support', siteOne); // the operator tier by role string, but a STORE employee
    seedEmployee(staffTwo, 'manager', siteTwo);
    const storeOne = seedStoreTicket(siteOne, 'one');
    const storeTwo = seedStoreTicket(siteTwo, 'two');

    const needles = [...privacy.map((request) => request.id), ...privacy.map((request) => request.reference), buyerA.id, buyerB.id, buyerA.email, buyerB.email, note];

    const listOne = await signedAs(staffOne, STORE_TICKETS);
    assert.equal(listOne.status, 200, listOne.text);
    assert.deepEqual((listOne.json?.data?.tickets as Array<{ id: string }>).map((row) => row.id), [storeOne.id]);
    assert.equal(listOne.json?.data?.total, 1, 'the count is the store\'s own too');
    assert.deepEqual(leaks(listOne.text, needles), []);

    // Asking for more does not widen it: another store, the privacy topic, a buyer, a bigger page, every status.
    const wide = await signedAs(staffOne, `${STORE_TICKETS}?limit=100&page=1&site_id=${siteTwo}&store_id=${siteTwo}&topic=privacy&requester_user_id=${buyerA.id}&status=open&q=privacy`);
    assert.equal(wide.status, 200, wide.text);
    assert.deepEqual((wide.json?.data?.tickets as Array<{ id: string }>).map((row) => row.id), [storeOne.id]);
    assert.equal(wide.json?.data?.total, 1);
    assert.deepEqual(leaks(wide.text, needles), []);

    const listTwo = await signedAs(staffTwo, STORE_TICKETS);
    assert.equal(listTwo.status, 200, listTwo.text);
    assert.deepEqual((listTwo.json?.data?.tickets as Array<{ id: string }>).map((row) => row.id), [storeTwo.id]);
    assert.equal(listTwo.json?.data?.total, 1);
    assert.deepEqual(leaks(listTwo.text, needles), []);

    // Platform staff are not store staff: this route is the store's, and refuses an employee who belongs to no store.
    const platformAgent = seedUser('platform-on-store-route');
    seedEmployee(platformAgent, 'support', null);
    const refused = await signedAs(platformAgent, STORE_TICKETS);
    assert.equal(refused.status, 403, refused.text);
    assert.deepEqual(leaks(refused.text, needles), []);
});

test('production mount: store staff, store owners, strangers and inactive platform employees are refused on every platform support route, and nothing is written', async () => {
    const buyer = seedBuyerAccount(psql, 'notops');
    const request = await buyerRequest(buyer, 'access', 'a note the buyer wrote');
    const owner = seedUser('owner');
    const site = seedStore(owner, 'notops');

    const storeAdmin = seedUser('store-admin');
    seedEmployee(storeAdmin, 'admin', site); // the admin tier by role string, but a STORE employee
    const storeManager = seedUser('store-manager');
    seedEmployee(storeManager, 'manager', site);
    const stranger = seedUser('stranger');
    const invited = seedUser('invited');
    seedEmployee(invited, 'admin', null, { status: 'invited' });
    const disabled = seedUser('disabled');
    seedEmployee(disabled, 'admin', null, { status: 'disabled' });
    const removed = seedUser('removed');
    seedEmployee(removed, 'admin', null, { deleted: true });

    const needles = [request.id, request.reference, buyer.id, buyer.email, 'a note the buyer wrote'];
    const before = { counts: counts(), row: ticket(request.id) };
    const paths = [`${OPS}/tickets`, `${OPS}/tickets/${request.id}`, `${OPS}/overview`];
    const people: Array<[string, Person]> = [
        ['a store employee whose role is admin', storeAdmin],
        ['a store employee whose role is manager', storeManager],
        ['the store owner', owner],
        ['a user with no employee row', stranger],
        ['an invited platform employee', invited],
        ['a disabled platform employee', disabled],
        ['a soft-deleted platform employee', removed],
    ];
    for (const [name, person] of people) {
        for (const path of paths) {
            const response = await signedAs(person, path);
            assert.equal(response.status, 403, `${name}: GET ${path} -> ${response.status} ${response.text}`);
            assert.equal(response.json?.error?.code, 'FORBIDDEN', `${name}: ${response.text}`);
            assert.deepEqual(leaks(response.text, needles), [], name);
        }
        const mutation = await signedAs(person, `${OPS}/tickets/${request.id}/resolve`, body('POST', { reason: REASON }));
        assert.equal(mutation.status, 403, `${name}: resolve -> ${mutation.status} ${mutation.text}`);
    }

    const anonymous = await gateway.request(`${OPS}/tickets`);
    assert.equal(anonymous.status, 401, anonymous.text);
    assert.deepEqual(leaks(anonymous.text, needles), []);

    assert.deepEqual({ counts: counts(), row: ticket(request.id) }, before, 'no refused call wrote anything, and the request is untouched');
});

// --------------------------------------------------------------------------------------------------------------------
// 2. Platform staff: who reaches the queue in production, and what the router's own tiers would allow
// --------------------------------------------------------------------------------------------------------------------

test('production mount: an allowlisted super admin reaches a privacy request through the platform queue; platform employees of the viewer, operator and lead tiers are stopped by the ops gate', async () => {
    // routes/operations/incident-command.ts registers router.use('*', requireRoleCategory('ops'), requireSuperAdmin) and is mounted at
    // '/operations' in src/index.ts BEFORE '/operations/support'. Hono applies a '*' middleware of a mounted router to every route
    // registered after it under the same prefix, so every platform support route is behind that gate whatever its own router checks.
    // The consequence, measured here: through the production worker, the platform support queue (and with it every privacy request,
    // its buyer-authored notes and the internal notes) is reachable by the super-admin allowlist only. The viewer/operator/lead tiers
    // that routes/operations/support.ts and middleware/rbac.ts implement are real (see the next test) but not reachable through the
    // production mount. Opening the queue to them is a decision about who may read privacy requests; it must be made deliberately, and
    // this test will fail when the mount order or the gate changes, so it cannot happen by accident.
    const buyer = seedBuyerAccount(psql, 'queue');
    const noteText = `QUEUE-NOTE-${crypto.randomUUID().slice(0, 8)}`;
    const request = await buyerRequest(buyer, 'access', noteText);
    psql(`INSERT INTO ticket_messages (ticket_id, author_type, visibility, body) VALUES ('${request.id}', 'agent', 'internal', 'INTERNAL-TRIAGE-${request.id.slice(0, 8)}');`);

    const superAdmin = seedSuperAdmin('queue-admin');
    const queue = await signedAs(superAdmin, `${OPS}/tickets?limit=100`);
    assert.equal(queue.status, 200, queue.text);
    const listed = (queue.json?.data as Array<{ id: string; topic: string; site_id: string | null }>).find((row) => row.id === request.id);
    assert.ok(listed, 'the platform queue lists a privacy request');
    assert.equal(listed.topic, 'privacy');
    assert.equal(listed.site_id, null);

    const detail = await signedAs(superAdmin, `${OPS}/tickets/${request.id}`);
    assert.equal(detail.status, 200, detail.text);
    const detailBodies = (detail.json?.data?.messages as Array<{ body: string }>).map((message) => message.body);
    assert.ok(detailBodies.includes(noteText), 'a super admin handling the request sees what the buyer wrote');
    assert.ok(detailBodies.some((text) => text.startsWith('INTERNAL-TRIAGE-')), 'and the internal notes (the buyer route never shows these: see the intake suite)');
    assert.equal((await signedAs(superAdmin, `${OPS}/overview`)).status, 200);

    // Search matches a ticket's subject, requester email and reference. It does not search the buyer's notes, and a privacy request
    // carries no requester email, so neither the buyer's note text nor the buyer's email finds it.
    const byNote = await signedAs(superAdmin, `${OPS}/tickets?q=${encodeURIComponent(noteText)}`);
    const byEmail = await signedAs(superAdmin, `${OPS}/tickets?q=${encodeURIComponent(buyer.email)}`);
    const byReference = await signedAs(superAdmin, `${OPS}/tickets?q=${encodeURIComponent(request.reference)}`);
    assert.deepEqual([byNote.status, byEmail.status, byReference.status], [200, 200, 200]);
    assert.deepEqual(byNote.json?.data, [], 'the notes are not searchable');
    assert.deepEqual(byEmail.json?.data, [], 'and the buyer\'s email does not identify the request');
    assert.deepEqual((byReference.json?.data as Array<{ id: string }>).map((row) => row.id), [request.id], 'its reference does');

    // The queue cannot be filtered to the privacy topic: the shared support-topic list does not include it. That is a gap in the operator
    // tooling, not a way in: the request is refused and nothing is returned for it. (The same list is what keeps an operator from creating
    // a privacy-topic ticket with arbitrary metadata: see the lifecycle test.)
    const byTopic = await signedAs(superAdmin, `${OPS}/tickets?topic=privacy`);
    assert.ok(byTopic.status >= 400, `a topic outside the shared list is refused, not answered: ${byTopic.status}`);
    assert.deepEqual(leaks(byTopic.text, [request.id, buyer.id]), []);

    // The tiers are stopped upstream: same people, same routes, refused with the ops gate's own answer, and nothing is read or written.
    const viewer = seedUser('gate-viewer');
    const agent = seedUser('gate-agent');
    const lead = seedUser('gate-lead');
    const leadEmployee = seedEmployee(lead, 'manager', null);
    seedEmployee(viewer, 'viewer', null);
    seedEmployee(agent, 'support', null);
    const before = { row: ticket(request.id), counts: counts(), messages: messages(request.id) };
    const needles = [request.id, request.reference, buyer.id, noteText];
    for (const [name, person] of [['a platform viewer', viewer], ['a platform agent', agent], ['a platform lead', lead]] as Array<[string, Person]>) {
        for (const path of [`${OPS}/tickets`, `${OPS}/tickets/${request.id}`, `${OPS}/overview`]) {
            const response = await signedAs(person, path);
            assert.equal(response.status, 403, `${name}: GET ${path} -> ${response.status} ${response.text}`);
            assert.equal(response.json?.error?.message, OPS_GATE_MESSAGE, `${name}: refused by the ops gate, before the support router's own checks`);
            assert.deepEqual(leaks(response.text, needles), [], name);
        }
        const attempts: Array<[string, string, RequestInit]> = [
            ['reply', `${OPS}/tickets/${request.id}/messages`, body('POST', { body: 'A reply', visibility: 'public', reason: REASON })],
            ['escalate', `${OPS}/tickets/${request.id}/escalate`, body('POST', { target: 'finance', reason: REASON })],
            ['resolve', `${OPS}/tickets/${request.id}/resolve`, body('POST', { reason: REASON })],
            ['assign', `${OPS}/tickets/${request.id}/assign`, body('PATCH', { assignee_id: leadEmployee, reason: REASON })],
        ];
        for (const [action, path, init] of attempts) {
            const response = await signedAs(person, path, init);
            assert.equal(response.status, 403, `${name}: ${action} -> ${response.status} ${response.text}`);
            assert.equal(response.json?.error?.message, OPS_GATE_MESSAGE, `${name}: ${action}`);
        }
    }
    assert.deepEqual({ row: ticket(request.id), counts: counts(), messages: messages(request.id) }, before, 'none of them read or changed anything');
});

test('router level (the support router mounted alone, real database): only active platform employees pass, and their tier decides: a viewer reads, an agent acts, only a lead assigns', async () => {
    // NOT the production mount (see the previous test). This is the support router's own gate and tier logic, against real employees rows,
    // to show what the tiers would be allowed to read and do if the production gate were ever opened to them.
    const buyer = seedBuyerAccount(psql, 'tiers');
    const noteText = `TIER-NOTE-${crypto.randomUUID().slice(0, 8)}`;
    const request = await buyerRequest(buyer, 'access', noteText);
    psql(`INSERT INTO ticket_messages (ticket_id, author_type, visibility, body) VALUES ('${request.id}', 'agent', 'internal', 'INTERNAL-TRIAGE-${request.id.slice(0, 8)}');`);

    const owner = seedUser('tier-owner');
    const site = seedStore(owner, 'tiers');
    const storeAdmin = seedUser('tier-store-admin');
    seedEmployee(storeAdmin, 'admin', site); // the admin tier by role string, but a STORE employee: not the platform's
    const stranger = seedUser('tier-stranger');
    const invited = seedUser('tier-invited');
    seedEmployee(invited, 'admin', null, { status: 'invited' });
    const disabled = seedUser('tier-disabled');
    seedEmployee(disabled, 'admin', null, { status: 'disabled' });
    const removed = seedUser('tier-removed');
    seedEmployee(removed, 'admin', null, { deleted: true });
    const viewer = seedUser('tier-viewer');
    const agent = seedUser('tier-agent');
    const lead = seedUser('tier-lead');
    seedEmployee(viewer, 'viewer', null);
    seedEmployee(agent, 'support', null);
    const leadEmployee = seedEmployee(lead, 'manager', null);

    // Nobody who is not an active platform employee gets in, whatever their role string says.
    const needles = [request.id, request.reference, buyer.id, noteText];
    for (const [name, person] of [['a store admin', storeAdmin], ['the store owner', owner], ['a stranger', stranger], ['an invited platform employee', invited], ['a disabled platform employee', disabled], ['a soft-deleted platform employee', removed]] as Array<[string, Person]>) {
        for (const path of ['/tickets', `/tickets/${request.id}`, '/overview']) {
            const response = await aloneAs(person, path);
            assert.equal(response.status, 403, `${name}: ${path} -> ${response.status} ${response.text}`);
            assert.equal(response.json?.error?.message, PLATFORM_OPERATOR_MESSAGE, name);
            assert.deepEqual(leaks(response.text, needles), [], name);
        }
    }

    // A viewer (support:view) reads the queue, the detail and the overview.
    const queue = await aloneAs(viewer, '/tickets?limit=100');
    assert.equal(queue.status, 200, queue.text);
    assert.ok((queue.json?.data as Array<{ id: string }>).some((row) => row.id === request.id), 'a platform viewer would see the privacy request in the queue');
    const detail = await aloneAs(viewer, `/tickets/${request.id}`);
    assert.equal(detail.status, 200, detail.text);
    assert.ok((detail.json?.data?.messages as Array<{ body: string }>).some((message) => message.body === noteText), 'and what the buyer wrote');
    assert.equal((await aloneAs(viewer, '/overview')).status, 200);

    // ... and can never act. Every mutation is refused on its scope, and nothing changes.
    const before = { row: ticket(request.id), counts: counts(), messages: messages(request.id) };
    const attempts: Array<[string, string, RequestInit]> = [
        ['reply', `/tickets/${request.id}/messages`, body('POST', { body: 'A reply', visibility: 'public', reason: REASON })],
        ['internal note', `/tickets/${request.id}/messages`, body('POST', { body: 'A note', visibility: 'internal', reason: REASON })],
        ['close by reply with an outcome claim', `/tickets/${request.id}/messages`, body('POST', { body: 'Closing', visibility: 'public', status: 'closed', metadata: { fulfillment_outcome: 'fulfilled' }, reason: REASON })],
        ['escalate with an outcome claim', `/tickets/${request.id}/escalate`, body('POST', { target: 'finance', reason: REASON, metadata: { fulfillment_outcome: 'fulfilled' } })],
        ['resolve', `/tickets/${request.id}/resolve`, body('POST', { reason: REASON })],
        ['assign', `/tickets/${request.id}/assign`, body('PATCH', { assignee_id: null, reason: REASON })],
        ['record satisfaction', `/tickets/${request.id}/csat`, body('POST', { score: 5, reason: REASON })],
        ['create a ticket', '/tickets', body('POST', { requester_type: 'customer', requester_user_id: buyer.id, subject: 'A forged request', body: 'Text', reason: REASON })],
    ];
    for (const [name, path, init] of attempts) {
        const response = await aloneAs(viewer, path, init);
        assert.equal(response.status, 403, `viewer: ${name} -> ${response.status} ${response.text}`);
        assert.equal(response.json?.error?.code, 'PERMISSION_SCOPE_DENIED', `viewer: ${name}`);
    }
    assert.deepEqual({ row: ticket(request.id), counts: counts(), messages: messages(request.id) }, before, 'a viewer changed nothing');

    // An agent (support:reply) can act on the request but cannot assign (support:manage).
    const agentAssign = await aloneAs(agent, `/tickets/${request.id}/assign`, body('PATCH', { assignee_id: leadEmployee, reason: REASON }));
    assert.equal(agentAssign.status, 403, agentAssign.text);
    assert.equal(agentAssign.json?.error?.code, 'PERMISSION_SCOPE_DENIED');
    assert.equal(ticket(request.id).assignee_id, null);
    const agentReply = await aloneAs(agent, `/tickets/${request.id}/messages`, body('POST', { body: 'We have your request', visibility: 'public', reason: REASON }));
    assert.equal(agentReply.status, 200, agentReply.text);

    // A lead (support:manage) can. None of it changes what kind of ticket the request is, whose it is, or its protected metadata.
    const leadAssign = await aloneAs(lead, `/tickets/${request.id}/assign`, body('PATCH', { assignee_id: leadEmployee, reason: REASON }));
    assert.equal(leadAssign.status, 200, leadAssign.text);
    const after = ticket(request.id);
    assert.equal(after.assignee_id, leadEmployee);
    assert.equal(after.topic, 'privacy');
    assert.equal(after.site_id, null);
    assert.equal(after.requester_user_id, buyer.id);
    assert.deepEqual(after.metadata, { privacy_request_type: 'access' });
});

// --------------------------------------------------------------------------------------------------------------------
// 3. What the buyer is told after support has acted: never more than is true
// --------------------------------------------------------------------------------------------------------------------

test('whatever a support agent does through the real routes, the buyer never reads fulfilled, the protected metadata is never rewritten, and a reopening cannot create a second unresolved request', async () => {
    const buyer = seedBuyerAccount(psql, 'lifecycle');
    // The only people the production mount lets through to these routes are allowlisted super admins (previous section), so one acts here.
    const agent = seedSuperAdmin('lifecycle-admin');

    const access = await buyerRequest(buyer, 'access', 'please send me everything you hold');
    const erasure = await buyerRequest(buyer, 'erasure');
    const viewOf = async (id: string) => (await buyerView(buyer)).find((row) => row.id === id);
    // What a careless or hostile agent might try to write: an outcome, a status, a topic. (A retyping attempt is made separately, below.)
    const hostile = { fulfillment_outcome: 'fulfilled', status: 'closed', topic: 'general' };

    assert.equal((await viewOf(access.id))?.status, 'received');

    // An internal note changes nothing the buyer can see, and does not move the ticket.
    const internal = await signedAs(agent, `${OPS}/tickets/${access.id}/messages`, body('POST', { body: 'Checking the identity records', visibility: 'internal', reason: REASON }));
    assert.equal(internal.status, 200, internal.text);
    assert.equal(ticket(access.id).status, 'open');
    assert.equal((await viewOf(access.id))?.status, 'received');

    // A public reply asks the buyer for something: pending_customer, which the buyer reads as in review.
    const reply = await signedAs(agent, `${OPS}/tickets/${access.id}/messages`, body('POST', { body: 'We are reviewing your request', visibility: 'public', reason: REASON }));
    assert.equal(reply.status, 200, reply.text);
    assert.equal(ticket(access.id).status, 'pending_customer');
    const inReview = await viewOf(access.id);
    assert.deepEqual([inReview?.status, inReview?.type, inReview?.reference], ['in_review', 'access', access.reference]);

    // Escalation with a claim of fulfillment in its metadata. The route nests that metadata under `escalation`: it cannot reach the keys the
    // buyer-facing status reads, and it cannot change the request's type.
    const escalated = await signedAs(agent, `${OPS}/tickets/${access.id}/escalate`, body('POST', { target: 'finance', reason: REASON, metadata: hostile }));
    assert.equal(escalated.status, 200, escalated.text);
    const afterEscalation = ticket(access.id);
    assert.equal(afterEscalation.status, 'escalated');
    assert.deepEqual(afterEscalation.metadata, { privacy_request_type: 'access', escalation: hostile }, 'the claim is stored where nothing reads it as an outcome');
    assert.equal((await viewOf(access.id))?.status, 'in_review');
    assert.equal((await viewOf(access.id))?.type, 'access');

    // Closing by reply, with the same claim in the MESSAGE's metadata: the message keeps what was sent, the ticket's metadata is not
    // touched, and the buyer reads a closure without fulfillment.
    const closing = await signedAs(agent, `${OPS}/tickets/${access.id}/messages`, body('POST', { body: 'Closing this request', visibility: 'public', status: 'resolved', metadata: hostile, reason: REASON }));
    assert.equal(closing.status, 200, closing.text);
    assert.equal(ticket(access.id).status, 'resolved');
    assert.deepEqual(ticket(access.id).metadata, { privacy_request_type: 'access', escalation: hostile });
    assert.deepEqual(messages(access.id).find((message) => message.body === 'Closing this request')?.metadata, hostile, 'the claim really was sent, and lives on the message only');
    assert.equal((await viewOf(access.id))?.status, 'closed_no_fulfillment');

    // A retyping attempt: escalate the erasure request with metadata that says it is an access request. The route nests it under
    // `escalation`, so the request stays what it was (were it ever written at the top level, the buyer would be told a different type).
    const retype = await signedAs(agent, `${OPS}/tickets/${erasure.id}/escalate`, body('POST', { target: 'finance', reason: REASON, metadata: { privacy_request_type: 'access' } }));
    assert.equal(retype.status, 200, retype.text);
    assert.deepEqual(ticket(erasure.id).metadata, { privacy_request_type: 'erasure', escalation: { privacy_request_type: 'access' } });
    assert.equal((await viewOf(erasure.id))?.type, 'erasure');

    // Resolving through the resolve route is the same: administrative closure, not fulfillment.
    const resolved = await signedAs(agent, `${OPS}/tickets/${erasure.id}/resolve`, body('POST', { reason: REASON, resolution_note: 'Request handled' }));
    assert.equal(resolved.status, 200, resolved.text);
    assert.equal(ticket(erasure.id).status, 'resolved');
    assert.deepEqual(ticket(erasure.id).metadata, { privacy_request_type: 'erasure', escalation: { privacy_request_type: 'access' } });
    const erasureView = await viewOf(erasure.id);
    assert.equal(erasureView?.status, 'closed_no_fulfillment');
    assert.equal(erasureView?.type, 'erasure');

    // The buyer may ask again, and the closed request is not touched by it.
    const again = await buyerRequest(buyer, 'access');
    assert.notEqual(again.id, access.id);
    assert.equal(ticket(access.id).status, 'resolved');
    assert.equal((await viewOf(again.id))?.status, 'received');

    // Reopening the old request while the new one is unresolved: the database refuses (migration 262), and the invariant holds whatever the
    // route reports. (The reply route does not check the result of its status update: it records the message and answers as if the status
    // had changed. That is a general support-route behaviour, outside the privacy intake, noted in the acceptance document.)
    await signedAs(agent, `${OPS}/tickets/${access.id}/messages`, body('POST', { body: 'Reopening', visibility: 'public', status: 'open', reason: REASON }));
    assert.equal(ticket(access.id).status, 'resolved', 'the closed request stayed closed');
    assert.equal(unresolved(buyer.id, 'access'), 1, 'exactly one unresolved request of the type');

    // An agent cannot create a privacy-topic ticket: the support topic list the create route validates against does not include it. This is
    // what stops an operator from writing one with arbitrary metadata, and it is a gap in the tooling as much as a control.
    const privacyBefore = Number(psql(`SELECT count(*) FROM support_tickets WHERE topic = 'privacy';`));
    const createPrivacy = await signedAs(agent, `${OPS}/tickets`, body('POST', { requester_type: 'customer', requester_user_id: buyer.id, subject: 'A privacy request', body: 'Text', topic: 'privacy', metadata: { privacy_request_type: 'access', fulfillment_outcome: 'fulfilled' }, reason: REASON }));
    assert.ok(createPrivacy.status >= 400, `${createPrivacy.status} ${createPrivacy.text}`);
    assert.equal(Number(psql(`SELECT count(*) FROM support_tickets WHERE topic = 'privacy';`)), privacyBefore, 'no privacy ticket was created by an operator');

    // The same payload as an ordinary ticket IS accepted, and is what it says it is: a general ticket. The buyer's privacy view does not
    // include it and does not change; it does not touch the privacy index; the generic buyer list shows it as general, without metadata.
    const viewBefore = await buyerView(buyer);
    const createGeneral = await signedAs(agent, `${OPS}/tickets`, body('POST', { requester_type: 'customer', requester_user_id: buyer.id, subject: 'A general question', body: 'Text', topic: 'general', metadata: { privacy_request_type: 'access', fulfillment_outcome: 'fulfilled' }, reason: REASON }));
    assert.equal(createGeneral.status, 201, createGeneral.text);
    const generalId = createGeneral.json?.data?.ticket?.id as string;
    assert.equal(ticket(generalId).topic, 'general');
    assert.deepEqual(await buyerView(buyer), viewBefore, 'a lookalike general ticket is invisible to the privacy view');
    assert.equal(unresolved(buyer.id, 'access'), 1, 'and does not count as an unresolved privacy request');
    const generic = await gateway.request(BUYER_TICKETS, { headers: await buyerHeaders(keys, buyer.id) });
    assert.equal(generic.status, 200, generic.text);
    const genericRow = (generic.json?.data as Array<{ id: string; topic: string }>).find((row) => row.id === generalId);
    assert.equal(genericRow?.topic, 'general');
    assert.doesNotMatch(generic.text, /fulfillment|metadata|privacy_request_type/);

    // Nothing anywhere in this database records an outcome on a privacy request, and the buyer was never told one.
    assert.equal(Number(psql(`SELECT count(*) FROM support_tickets WHERE topic = 'privacy' AND metadata ? 'fulfillment_outcome';`)), 0);
    const finalView = await buyerView(buyer);
    assert.equal(finalView.length, 3);
    assert.deepEqual(finalView.map((row) => row.status).filter((status) => status === 'fulfilled' || status === 'unknown'), []);
});

// --------------------------------------------------------------------------------------------------------------------
// 4. The two realms do not accept each other's credentials
// --------------------------------------------------------------------------------------------------------------------

test('a buyer\'s credential cannot reach any staff route, and a staff identity cannot reach the buyer\'s privacy routes, including one that borrows a buyer\'s id', async () => {
    const buyer = seedBuyerAccount(psql, 'realms');
    const request = await buyerRequest(buyer, 'access', 'a note the buyer wrote');
    const owner = seedUser('realm-owner');
    const site = seedStore(owner, 'realms');
    const storeStaff = seedUser('realm-store-staff');
    seedEmployee(storeStaff, 'support', site);
    const operator = seedSuperAdmin('realm-operator');
    const needles = [request.id, request.reference, buyer.id, buyer.email, 'a note the buyer wrote'];

    // The buyer's session, in every place the gateway looks for a credential, on the staff routes.
    const token = await mintSession(keys, buyer.id);
    const staffPaths = [STORE_TICKETS, `${OPS}/tickets`, `${OPS}/tickets/${request.id}`, `${OPS}/overview`];
    const presented: Array<[string, Record<string, string>]> = [
        ['the buyer session header', { [LETBUYY_BUYER_SESSION_HEADER]: token }],
        ['the buyer session cookie', { cookie: `${LETBUYY_BUYER_SESSION_COOKIE}=${encodeURIComponent(token)}` }],
        ['an Authorization bearer', { Authorization: `Bearer ${token}` }],
    ];
    for (const [name, headers] of presented) {
        for (const path of staffPaths) {
            const response = await gateway.request(path, { headers });
            assert.equal(response.status, 401, `${name} on ${path} -> ${response.status} ${response.text}`);
            assert.deepEqual(leaks(response.text, needles), [], `${name} on ${path}`);
        }
        const write = await gateway.request(`${OPS}/tickets/${request.id}/resolve`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: REASON }) });
        assert.equal(write.status, 401, `${name} resolving -> ${write.status} ${write.text}`);
    }
    assert.equal(ticket(request.id).status, 'open', 'no staff route moved the request');

    // Staff identities on the buyer's routes: a merchant's employee, a platform super admin and a store owner each hold a verified signed
    // identity, and none of them is a buyer session.
    const before = counts();
    for (const [name, person] of [['a merchant\'s employee', storeStaff], ['a platform super admin', operator], ['a store owner', owner]] as Array<[string, Person]>) {
        const read = await signedAs(person, PRIVACY);
        const write = await signedAs(person, PRIVACY, body('POST', { type: 'erasure', buyer_account_id: buyer.id, notes: 'must never be stored' }));
        assert.equal(read.status, 401, `${name}: GET -> ${read.status} ${read.text}`);
        assert.equal(write.status, 401, `${name}: POST -> ${write.status} ${write.text}`);
        assert.deepEqual(leaks(read.text + write.text, needles), [], name);
    }

    // An identity that merely carries a buyer's id is still not that buyer: a signed internal identity for a users_custom row that shares
    // the buyer account's id is verified as staff-realm and refused by the buyer-realm middleware.
    const borrowed: Person = { id: buyer.id, email: `syn-borrowed-${buyer.id.slice(0, 8)}@example.invalid` };
    psql(`INSERT INTO users_custom (id, email, email_verified) VALUES ('${borrowed.id}', '${borrowed.email}', true);`);
    const borrowedRead = await signedAs(borrowed, PRIVACY);
    const borrowedWrite = await signedAs(borrowed, PRIVACY, body('POST', { type: 'erasure' }));
    assert.equal(borrowedRead.status, 401, borrowedRead.text);
    assert.equal(borrowedWrite.status, 401, borrowedWrite.text);

    assert.deepEqual(counts(), before, 'no cross-realm attempt wrote anything');
    assert.equal(unresolved(buyer.id, 'erasure'), 0);
    assert.deepEqual((await buyerView(buyer)).map((row) => row.type), ['access'], 'the buyer\'s own view is exactly what the buyer asked for');
});
