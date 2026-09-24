// APPID-P3 — the operator path for buyer ownership conflicts (operations/buyer-links.ts).
//
// The database decides and audits (migration 255; proven on real Postgres in
// tests/executable/buyer-verified-ownership-postgres.test.mjs). What is asserted here is the route's
// own responsibility: the scope each route demands, that the operator identity comes from the session
// and never the body, that nothing reaches the database without a valid id and a real reason, and how
// each database outcome is answered.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import {
    createBuyerLinkOperationsRouter,
    type BuyerLinkConflictRow,
    type BuyerLinkOperationsDependencies,
    type ResolutionOutcome,
} from '../routes/operations/buyer-links';

const OPERATOR = '99999999-9999-4999-8999-000000000001';
const BUYER = '22222222-2222-4222-8222-00000000000c';
const OTHER = '22222222-2222-4222-8222-00000000000b';
const RECORD = '33333333-3333-4333-8333-000000000002';
const ORDER = '44444444-4444-4444-8444-000000000005';
const SITE = '11111111-1111-4111-8111-000000000002';

function harness(options: { granted?: string[]; outcome?: ResolutionOutcome; conflicts?: BuyerLinkConflictRow[] } = {}) {
    const demanded: string[] = [];
    const calls: { store: unknown[]; order: unknown[] } = { store: [], order: [] };
    const granted = new Set(options.granted ?? ['support:view', 'support:manage']);
    const deps: BuyerLinkOperationsDependencies = {
        operatorId: () => OPERATOR,
        listConflicts: async () => options.conflicts ?? [],
        currentStoreHolders: async (_c, ids) => Object.fromEntries(ids.map((id) => [id, { buyer_account_id: OTHER, link_basis: 'legacy_unverified' }])),
        currentOrderOwners: async (_c, ids) => Object.fromEntries(ids.map((id) => [id, { buyer_account_id: OTHER, link_basis: 'authenticated_checkout' }])),
        resolveStoreCustomer: async (_c, params) => { calls.store.push(params); return options.outcome ?? 'resolved'; },
        resolveOrder: async (_c, params) => { calls.order.push(params); return options.outcome ?? 'resolved'; },
        permission: ((...scopes: string[]) => async (c: { json: (b: unknown, s: number) => Response }, next: () => Promise<void>) => {
            demanded.push(...scopes);
            if (!scopes.every((scope) => granted.has(scope))) return c.json({ error: { code: 'FORBIDDEN' } }, 403);
            return next();
        }) as never,
    };
    const app = new Hono<{ Bindings: Env }>();
    app.route('/operations/buyer-links', createBuyerLinkOperationsRouter(deps));
    return { app, demanded, calls };
}

const post = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const REASON = 'support case 1042: buyer proved the address by email';

test('listing conflicts needs support:view and shows who holds each record now', async () => {
    const h = harness({
        conflicts: [
            { id: 'a1', action: 'buyer_store_link.conflict', created_at: '2026-09-24T10:00:00Z', resource_id: RECORD, actor_id: BUYER,
              metadata: { site_id: SITE, requesting_buyer_account_id: BUYER, linked_buyer_account_id: OTHER } },
            { id: 'a2', action: 'buyer_orders.claimed', created_at: '2026-09-24T09:00:00Z', resource_id: BUYER, actor_id: BUYER,
              metadata: { conflict_order_ids: [ORDER] } },
        ],
    });
    const res = await h.app.request('/operations/buyer-links/conflicts', undefined, {});
    assert.equal(res.status, 200);
    assert.deepEqual(h.demanded, ['support:view']);
    const body = await res.json() as { data: { conflicts: Array<Record<string, unknown>> } };
    assert.deepEqual(body.data.conflicts[0], {
        id: 'a1', kind: 'store_customer', created_at: '2026-09-24T10:00:00Z', store_customer_id: RECORD, site_id: SITE,
        requesting_buyer_account_id: BUYER, current: { buyer_account_id: OTHER, link_basis: 'legacy_unverified' },
    });
    assert.deepEqual(body.data.conflicts[1], {
        id: 'a2', kind: 'orders', created_at: '2026-09-24T09:00:00Z', requesting_buyer_account_id: BUYER,
        orders: [{ order_id: ORDER, current: { buyer_account_id: OTHER, link_basis: 'authenticated_checkout' } }],
    });
});

test('an operator without support:view sees nothing', async () => {
    const h = harness({ granted: [] });
    assert.equal((await h.app.request('/operations/buyer-links/conflicts', undefined, {})).status, 403);
});

test('resolving needs support:manage: a support:view-only operator is refused before the database', async () => {
    const h = harness({ granted: ['support:view'] });
    const res = await h.app.request(`/operations/buyer-links/store-customers/${RECORD}/resolve`, post({ buyer_account_id: BUYER, reason: REASON }), {});
    assert.equal(res.status, 403);
    assert.deepEqual(h.demanded, ['support:manage']);
    assert.equal(h.calls.store.length, 0);
});

test('a resolution names the session operator, never one from the body', async () => {
    const h = harness();
    const res = await h.app.request(`/operations/buyer-links/store-customers/${RECORD}/resolve`,
        post({ buyer_account_id: BUYER, reason: REASON, operator_id: OTHER, p_operator_id: OTHER }), {});
    assert.equal(res.status, 200);
    assert.deepEqual(h.calls.store, [{ p_store_customer_id: RECORD, p_buyer_account_id: BUYER, p_operator_id: OPERATOR, p_reason: REASON }]);
});

test('bad ids and missing or trivial reasons are 400 and reach no database', async () => {
    const h = harness();
    const cases: Array<[string, unknown]> = [
        ['/operations/buyer-links/store-customers/not-a-uuid/resolve', { buyer_account_id: BUYER, reason: REASON }],
        [`/operations/buyer-links/store-customers/${RECORD}/resolve`, { buyer_account_id: 'nobody', reason: REASON }],
        [`/operations/buyer-links/store-customers/${RECORD}/resolve`, { buyer_account_id: BUYER }],
        [`/operations/buyer-links/orders/${ORDER}/resolve`, { buyer_account_id: BUYER, reason: 'ok' }],
    ];
    for (const [path, body] of cases) {
        assert.equal((await h.app.request(path, post(body), {})).status, 400, path);
    }
    assert.equal(h.calls.store.length + h.calls.order.length, 0);
});

test('each database outcome is answered distinctly', async () => {
    const expected: Array<[ResolutionOutcome, number]> = [
        ['resolved', 200],
        ['order_unavailable', 404],
        ['buyer_unavailable_or_unverified', 422],
        ['buyer_has_other_record_at_store', 409],
    ];
    for (const [outcome, status] of expected) {
        const h = harness({ outcome });
        const res = await h.app.request(`/operations/buyer-links/orders/${ORDER}/resolve`, post({ buyer_account_id: BUYER, reason: REASON }), {});
        assert.equal(res.status, status, outcome);
    }
});
