// ADM-1 — operator moderation routes for marketplace listings, and the client-actionable error registry.
// Behavioural where it can be: the operator router is driven through a real Hono app with injected
// fakes for the query, the transition call, the audit write and the actor, so what is asserted is the
// wire contract (named RPC parameters, the literal 'operator' realm, the reason rule, the audit row),
// not the source text. Source-shape assertions cover only mounting and the "never inside a tenant
// transaction" invariant, which no unit can exercise.

import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizePublicErrorPayload, CLIENT_ACTIONABLE_ERROR_CODES } from '../lib/public-errors';

// ── F-FB-1 (from MKT-1's lanes): the sanitizer must preserve the messages behind the listing codes ──

test('the channel-listing error codes are client-actionable, so their fixed messages survive the sanitizer', () => {
    for (const [code, message] of [
        ['UNPROCESSABLE', 'a marketplace category is required before review'],
        ['TENANT_TX_UNAVAILABLE', 'Tenant transaction unavailable'],
        ['TENANT_CONTEXT_MISSING', 'tenant context was not established'],
    ] as const) {
        assert.ok(CLIENT_ACTIONABLE_ERROR_CODES.has(code), `${code} must be registered as client-actionable`);
        const { payload, changed } = sanitizePublicErrorPayload({ error: { code, message } });
        assert.equal(payload.error?.message, message, `${code}'s message must reach the client verbatim`);
        assert.equal(payload.error?.code, code);
        assert.equal(changed, false);
    }
});

test('an unregistered code is still rewritten to the generic message, so the registry is the only door', () => {
    const { payload, changed } = sanitizePublicErrorPayload({ error: { code: 'SOME_NEW_CODE', message: 'relation "public.channel_listings" does not exist' } });
    assert.equal(changed, true);
    assert.equal(payload.error?.message, 'Request failed');
    assert.equal(payload.error?.code, 'SOME_NEW_CODE', 'the code survives; only the message is replaced');
});

// ── ADM-1 operator routes: /operations/marketplace-listings ────────────────────────────────────

import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import {
    createMarketplaceListingsOperationsRouter,
    DECISION_TARGET,
    OPERATOR_LISTING_DETAIL_COLUMNS,
    type AuditInput,
    type ClaimParams,
    type AssignmentParams,
    type MarketplaceListingsOperationsDependencies,
    type TransitionParams,
} from '../routes/operations/marketplace-listings';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/operations/marketplace-listings.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(new URL('../../../../database/supabase/migrations/217_marketplace_channel_listings.sql', import.meta.url), 'utf8');

const OPERATOR = 'cccccccc-0000-4000-8000-0000000000c1';
const SITE_A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const LISTING = '11111111-0000-4000-8000-000000000001';

function operatorApp(options: { listing?: Record<string, unknown> | null; transitionError?: Error; actorId?: string } = {}) {
    const transitions: TransitionParams[] = [];
    const claims: ClaimParams[] = [];
    const assignments: AssignmentParams[] = [];
    const audits: AuditInput[] = [];
    const listCalls: unknown[] = [];
    const listing = options.listing === undefined ? { id: LISTING, site_id: SITE_A, status: 'pending_review', channel: 'marketplace', assigned_reviewer_id: OPERATOR, version: 3 } : options.listing;
    const deps: MarketplaceListingsOperationsDependencies = {
        authorizeOperator: async (_c, userId) => ({ id: options.actorId ?? (userId || OPERATOR), email: 'ops@letbuyy.com' }),
        listListings: async (_c, query) => {
            listCalls.push(query);
            return { rows: listing ? [listing as never] : [], total: listing ? 1 : 0 };
        },
        loadListing: async () => (listing as never) ?? null,
        loadListingEvents: async () => [{ id: 'e1', from_status: 'draft', to_status: 'pending_review', actor_realm: 'merchant' }],
        loadReviewer: async (_c, userId) => ({ user_id: userId, full_name: 'Test Reviewer' }),
        transition: async (_c, params) => {
            transitions.push(params);
            if (options.transitionError) throw options.transitionError;
            return { listing_id: params.p_listing_id, from_status: 'pending_review', to_status: params.p_to_status, event_id: 'e2', replayed: false };
        },
        claim: async (_c, params) => {
            claims.push(params);
            return { listing_id: params.p_listing_id, assigned_reviewer_id: params.p_reviewer_id, version: params.p_expected_version, event_id: 'claim-event', replayed: false };
        },
        listEligibleReviewers: async () => [{ user_id: 'bbbbbbbb-0000-4000-8000-00000000000b', full_name: 'Eligible Lead' }],
        authorizeReviewer: async (_c, userId) => ({ user_id: userId, full_name: 'Eligible Lead' }),
        assignReviewer: async (_c, params) => {
            assignments.push(params);
            return { listing_id: params.p_listing_id, previous_reviewer_id: OPERATOR, assigned_reviewer_id: params.p_reviewer_id, version: params.p_expected_version + 1, event_id: 'assignment-event', replayed: false };
        },
        writeAudit: async (_c, input) => {
            audits.push(input);
        },
        // Unit tests bypass the RBAC lookup; the contract test asserts the real middleware is wired per route.
        permission: (() => async (_c: unknown, next: () => Promise<void>) => next()) as never,
        operatorGate: (() => async (_c: unknown, next: () => Promise<void>) => next()) as never,
    };
    const app = new Hono();
    app.route('/operations/marketplace-listings', createMarketplaceListingsOperationsRouter(deps));
    return { app, transitions, claims, assignments, audits, listCalls };
}

const post = (body: Record<string, unknown>) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operator_user_id: OPERATOR, ...body }) });

test('GET /operations/marketplace-listings defaults to pending marketplace listings, forwards filters, and paginates', async () => {
    const { app, listCalls } = operatorApp();
    const res = await app.request('/operations/marketplace-listings', undefined, {});
    assert.equal(res.status, 200);
    assert.deepEqual(listCalls[0], { status: 'pending_review', channel: 'marketplace', page: 1, limit: 20 });
    const body = (await res.json()) as { success: boolean; data: unknown[]; meta: { total: number } };
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.meta.total, 1);

    const filtered = await app.request(`/operations/marketplace-listings?status=approved&site_id=${SITE_A}&limit=5&page=2`, undefined, {});
    assert.equal(filtered.status, 200);
    assert.deepEqual(listCalls[1], { status: 'approved', channel: 'marketplace', site_id: SITE_A, page: 2, limit: 5 });
    const bad = await app.request('/operations/marketplace-listings?status=nonsense', undefined, {});
    assert.equal(bad.status, 400);
});

test('GET /operations/marketplace-listings/:id returns the listing with its moderation events, 404 when absent', async () => {
    const { app } = operatorApp();
    const res = await app.request(`/operations/marketplace-listings/${LISTING}`, undefined, {});
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: { listing: { id: string }; events: unknown[] } };
    assert.equal(body.data.listing.id, LISTING);
    assert.equal(body.data.events.length, 1);
    const { app: empty } = operatorApp({ listing: null });
    assert.equal((await empty.request(`/operations/marketplace-listings/${LISTING}`, undefined, {})).status, 404);
    assert.equal((await app.request('/operations/marketplace-listings/not-a-uuid', undefined, {})).status, 400);
});

test('review detail selects only the bounded saved submitted and approved revision snapshots', () => {
    assert.match(OPERATOR_LISTING_DETAIL_COLUMNS, /submitted_product_snapshot/);
    assert.match(OPERATOR_LISTING_DETAIL_COLUMNS, /approved_product_snapshot/);
    assert.match(routeSource, /select\(OPERATOR_LISTING_DETAIL_COLUMNS\)/);
});

test('a reviewer claims an unassigned pending listing for their authenticated identity and displayed version', async () => {
    const { app, claims } = operatorApp({ listing: { id: LISTING, site_id: SITE_A, status: 'pending_review', channel: 'marketplace', assigned_reviewer_id: null, version: 7 } });
    const res = await app.request(`/operations/marketplace-listings/${LISTING}/claim`, post({ reason: 'I will review this product submission.', idempotency_key: 'claim-key', expected_version: 7 }), {});
    assert.equal(res.status, 200);
    assert.deepEqual(claims, [{ p_site_id: SITE_A, p_listing_id: LISTING, p_reviewer_id: OPERATOR, p_reason: 'I will review this product submission.', p_idempotency_key: 'claim-key', p_expected_version: 7 }]);
});

test('lead reviewer assignment uses server identity, target eligibility, displayed version and an atomic RPC', async () => {
    const replacement = 'bbbbbbbb-0000-4000-8000-00000000000b';
    const { app, assignments } = operatorApp();
    const roster = await app.request('/operations/marketplace-listings/reviewers', undefined, {});
    assert.equal(roster.status, 200);
    assert.equal(((await roster.json()) as { data: unknown[] }).data.length, 1);

    const res = await app.request(`/operations/marketplace-listings/${LISTING}/assign`, post({
        assignee_user_id: replacement, reason: 'Reviewer is rotating to the next on-call.',
        idempotency_key: 'assign-key', expected_version: 3,
    }), {});
    assert.equal(res.status, 200);
    assert.deepEqual(assignments, [{
        p_site_id: SITE_A, p_listing_id: LISTING, p_assigning_operator_id: OPERATOR,
        p_reviewer_id: replacement, p_reason: 'Reviewer is rotating to the next on-call.',
        p_idempotency_key: 'assign-key', p_expected_version: 3,
    }]);
});

test('an unassigned reviewer cannot make a decision', async () => {
    const { app, transitions } = operatorApp({ listing: { id: LISTING, site_id: SITE_A, status: 'pending_review', channel: 'marketplace', assigned_reviewer_id: null } });
    const res = await app.request(`/operations/marketplace-listings/${LISTING}/approve`, post({ idempotency_key: 'approve-unclaimed' }), {});
    assert.equal(res.status, 403);
    assert.equal(transitions.length, 0);
});

test('decisions require an explicit authenticated operator identity in addition to the service request', async () => {
    const { app, transitions } = operatorApp();
    const res = await app.request(`/operations/marketplace-listings/${LISTING}/approve`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotency_key: 'missing-operator' }),
    }, {});
    assert.equal(res.status, 400);
    assert.equal(transitions.length, 0);
});

test('approve calls transition_channel_listing as the operator realm with the listing\'s own site and writes an audit row', async () => {
    const { app, transitions, audits } = operatorApp();
    const res = await app.request(`/operations/marketplace-listings/${LISTING}/approve`, post({ idempotency_key: 'k-approve' }), {});
    assert.equal(res.status, 200);
    assert.deepEqual(transitions, [{
        p_site_id: SITE_A,
        p_listing_id: LISTING,
        p_to_status: 'approved',
        p_actor_realm: 'operator',
        p_actor_id: OPERATOR,
        p_reason: null,
        p_idempotency_key: 'k-approve',
    }]);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'marketplace_listing.approve');
    assert.equal(audits[0].resourceId, LISTING);
    assert.equal(audits[0].actor.id, OPERATOR);
    assert.deepEqual(audits[0].metadata.site_id, SITE_A);
    assert.equal(audits[0].metadata.to_status, 'approved');

    // A body cannot choose the site or the target status: the schema is strict.
    const smuggled = await app.request(`/operations/marketplace-listings/${LISTING}/approve`, post({ idempotency_key: 'k', site_id: 'bbbbbbbb-0000-4000-8000-00000000000b' }), {});
    assert.equal(smuggled.status, 400);
    const forged = await app.request(`/operations/marketplace-listings/${LISTING}/approve`, post({ idempotency_key: 'k', to_status: 'delisted' }), {});
    assert.equal(forged.status, 400);
});

test('reject and take-down require a sensitive reason and map to rejected / delisted; approve does not', async () => {
    const { app, transitions } = operatorApp();
    const noReason = await app.request(`/operations/marketplace-listings/${LISTING}/reject`, post({ idempotency_key: 'k1' }), {});
    assert.equal(noReason.status, 400);
    assert.equal(((await noReason.json()) as { error: { code: string } }).error.code, 'REASON_REQUIRED');
    const shortReason = await app.request(`/operations/marketplace-listings/${LISTING}/take-down`, post({ idempotency_key: 'k2', reason: 'short' }), {});
    assert.equal(shortReason.status, 400);
    assert.equal(transitions.length, 0, 'no RPC call without a valid reason');

    const rejected = await app.request(`/operations/marketplace-listings/${LISTING}/reject`, post({ idempotency_key: 'k3', reason: 'Images show a counterfeit brand mark.' }), {});
    assert.equal(rejected.status, 200);
    assert.equal(transitions[0].p_to_status, 'rejected');
    assert.equal(transitions[0].p_reason, 'Images show a counterfeit brand mark.');
    const takenDown = await app.request(`/operations/marketplace-listings/${LISTING}/take-down`, post({ idempotency_key: 'k4', reason: 'Regulatory takedown request received.' }), {});
    assert.equal(takenDown.status, 200);
    assert.equal(transitions[1].p_to_status, 'delisted');
    assert.deepEqual(DECISION_TARGET, { approve: 'approved', reject: 'rejected', take_down: 'delisted' });
});

test('an operator whose id is not a uuid is a gateway bug (500), never written to the event log', async () => {
    const { app, transitions } = operatorApp({ actorId: 'ops@letbuyy.com' });
    const res = await app.request(`/operations/marketplace-listings/${LISTING}/approve`, post({ idempotency_key: 'k' }), {});
    assert.equal(res.status, 500);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'OPERATOR_IDENTITY_INVALID');
    assert.equal(transitions.length, 0);
});

test('the RPC\'s refusals map to typed statuses through the shared mapper', async () => {
    for (const [message, status] of [
        ['invalid_transition: approved -> approved by operator', 409],
        ['listing not found', 404],
        ['a reason is required for operator rejected decisions', 422],
        ['operator transitions are not permitted from a tenant context', 500],
    ] as const) {
        const { app } = operatorApp({ transitionError: new Error(message) });
        const res = await app.request(`/operations/marketplace-listings/${LISTING}/approve`, post({ idempotency_key: 'k' }), {});
        assert.equal(res.status, status, message);
    }
});

test('the operator router never enters a tenant transaction, is permission-gated per route, and is mounted once outside the kill switch', () => {
    // Comment-stripped: the header comment names the helpers precisely to say they are never used.
    const executable = routeSource.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
    assert.doesNotMatch(executable, /withResolvedTenantTx|resolveOwnedStoreScope|withTenantTx/, 'an operator never acts inside a tenant transaction');
    assert.match(routeSource, /p_actor_realm: 'operator'/);
    for (const route of ['/:id/approve', '/:id/reject', '/:id/take-down']) {
        assert.match(routeSource, new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}', deps\\.permission\\('review:decide'\\)`), `${route} must require review:decide`);
    }
    assert.match(routeSource, /router\.post\('\/:id\/claim', deps\.permission\('review:decide'\)/);
    assert.match(routeSource, /router\.post\('\/:id\/assign', deps\.permission\('review:assign'\)/);
    assert.match(routeSource, /router\.get\('\/reviewers', deps\.permission\('review:assign'\)/);
    assert.match(routeSource, /router\.use\('\*', deps\.operatorGate\(\{ admittedTiers: \['viewer', 'operator', 'lead'\] \}\)\)/);
    assert.match(routeSource, /operatorGate: requirePlatformOperator,/, 'the production dependency set wires the active platform operator gate');
    assert.match(routeSource, /router\.get\('\/', deps\.permission\('review:view'\)/);
    assert.match(routeSource, /permission: requirePermission,/, 'the production dependency set wires rbac\'s requirePermission');
    assert.equal(indexSource.match(/import operationsMarketplaceListingsRouter from '\.\/routes\/operations\/marketplace-listings'/g)?.length, 1);
    assert.equal(indexSource.match(/api\.route\('\/operations\/marketplace-listings', operationsMarketplaceListingsRouter\)/g)?.length, 1);
    assert.ok(indexSource.indexOf("api.route('/operations/marketplace-listings', operationsMarketplaceListingsRouter);") < indexSource.indexOf("api.route('/operations', operationsIncidentCommandRouter);"), 'the listing router with its own gate must mount before incident-command');
    assert.doesNotMatch(indexSource, /api\.use\('\/operations\/marketplace-listings[^']*', appPlatformKillSwitch\)/, 'core marketplace moderation is not behind the frozen app-platform kill switch');
    // Named parameters match 217's declaration.
    for (const name of ['p_site_id', 'p_listing_id', 'p_to_status', 'p_actor_realm', 'p_actor_id', 'p_reason', 'p_idempotency_key']) {
        assert.match(migrationSource, new RegExp(`\\b${name}\\b`));
        assert.match(routeSource, new RegExp(`\\b${name}\\b`));
    }
});
