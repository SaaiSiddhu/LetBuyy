// F-ADS-2 — merchant ad-campaign and prepaid-credit routes.
//
// Behavioural where it can be: the router runs in a real Hono app with injected scope resolution and
// tenant SQL, so what is asserted is the wire contract — which parameters reach
// allocate_ad_campaign_budget, in which order, and what SQL the router is willing to issue at all.
// The most important assertion is behavioural rather than textual: `allocated_minor` never appears in
// any INSERT or UPDATE the router emits, checked across every write route in one sweep.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import { createAdsRouter, ALLOCATE_AD_BUDGET_SQL, type AdsRouteDependencies } from '../routes/ads';
import { TenantTransactionUnavailableError } from '../lib/tenant-transaction';

const routeSource = readFileSync(new URL('../routes/ads.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(
    new URL('../../../../database/supabase/migrations/238_ad_credit_tenant_fence.sql', import.meta.url),
    'utf8',
);

const SITE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const OTHER_SITE = 'bbbbbbbb-0000-4000-8000-00000000000b';
const CAMPAIGN = 'cccccccc-0000-4000-8000-00000000000c';
const PRODUCT = 'dddddddd-0000-4000-8000-00000000000d';
const PLACEMENT = 'eeeeeeee-0000-4000-8000-00000000000e';
const USER_ID = 'ffffffff-0000-4000-8000-00000000000f';

interface Recorded { query: string; params: unknown[] }

function app(options: { rows?: Record<string, unknown>[]; resolvedSite?: string; throwOnWrite?: unknown; tenantTxUnavailable?: boolean } = {}) {
    const calls: Recorded[] = [];
    const deps: AdsRouteDependencies = {
        resolveOwnedStoreScope: async (_c, siteId) => ({
            siteId: options.resolvedSite ?? siteId,
            customUser: { id: USER_ID, email: 'merchant@example.com', full_name: 'Merchant' },
            tenant: { siteId: options.resolvedSite ?? siteId, requestId: 'req-ads-1' },
        }) as unknown as Awaited<ReturnType<AdsRouteDependencies['resolveOwnedStoreScope']>>,
        withResolvedTenantTx: async (_c, _tenant, callback) => {
            if (options.tenantTxUnavailable) throw new TenantTransactionUnavailableError();
            return callback({
                unsafe: async (query: string, params: unknown[] = []) => {
                    calls.push({ query, params });
                    if (options.throwOnWrite && /(?:allocate|release)_ad_campaign_budget/.test(query)) throw options.throwOnWrite;
                    if (/allocate_ad_campaign_budget/.test(query)) return [{ result: { allocated: true, balance_minor: 75000 } }];
                    if (/ad_credit_balance_minor/.test(query)) return [{ balance_minor: 100000 }];
                    if (/count\(\*\)/.test(query)) return [{ total: 1 }];
                    if (/^\s*delete/i.test(query)) return options.rows ?? [{ id: PLACEMENT }];
                    return options.rows ?? [];
                },
            });
        },
    };
    const root = new Hono();
    root.route('/ads', createAdsRouter(deps));
    return { app: root, calls };
}

const json = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('the allocation sends the six parameters in the RPC\'s declared order, with the RESOLVED site', async () => {
    const { app: a, calls } = app({ resolvedSite: SITE });
    const res = await a.request(`/ads/campaigns/${CAMPAIGN}/budget`,
        json('POST', { store_id: OTHER_SITE, amount_minor: 25000, idempotency_key: 'ads-key-0001' }), {});
    assert.equal(res.status, 200);

    const write = calls.find((call) => call.query.includes('allocate_ad_campaign_budget'));
    assert.ok(write, 'the budget must move through the RPC');
    assert.equal(write.query, ALLOCATE_AD_BUDGET_SQL);
    assert.deepEqual(write.params, [SITE, CAMPAIGN, 25000, 'ads-key-0001', 'req-ads-1', USER_ID]);
    assert.notEqual(write.params[0], OTHER_SITE, 'the body\'s store_id must not be what the RPC receives');
});

test('allocated_minor never appears in any write the router issues', async () => {
    // The money-critical property, checked across every write route rather than read off the source.
    const { app: a, calls } = app();
    await a.request('/ads/campaigns', json('POST', { store_id: SITE, name: 'Spring' }), {});
    await a.request(`/ads/campaigns/${CAMPAIGN}`, json('PATCH', { store_id: SITE, name: 'Renamed', status: 'active' }), {});
    await a.request(`/ads/campaigns/${CAMPAIGN}/placements`, json('POST', { store_id: SITE, product_id: PRODUCT }), {});
    await a.request(`/ads/campaigns/${CAMPAIGN}/budget`, json('POST', { store_id: SITE, amount_minor: 100, idempotency_key: 'ads-key-0002' }), {});

    const writes = calls.filter((call) => /^\s*(insert|update|delete)/i.test(call.query));
    assert.ok(writes.length >= 3, 'the sweep must actually have writes to inspect');

    // RETURNING is a READ, and every write here reads the row back — including allocated_minor, which
    // a merchant is entitled to see. The property under test is what the statement WRITES, so the
    // returning clause is removed first. It is always last in these statements, so this is a
    // terminator, not a guess about where the write ends.
    const writtenPart = (query: string) => query.replace(/\breturning\b[\s\S]*$/i, '');

    for (const write of writes) {
        assert.ok(
            !/allocated_minor/.test(writtenPart(write.query)),
            `a write touching allocated_minor would mint budget with no ledger entry: ${write.query}`,
        );
    }

    // Control: the stripping must not have made the check inert. A statement that really does write
    // the column is still caught after the same treatment.
    assert.ok(
        /allocated_minor/.test(writtenPart(
            'update public.ad_campaigns set allocated_minor = 500000 where id = $1 returning id, allocated_minor',
        )),
        'the check must still catch a real write to the column',
    );
});

test('allocation and release capture the canonical actor in the same transaction before calling money RPC', async () => {
    for (const operation of ['budget', 'release']) {
        const { app: router, calls } = app();
        const result = await router.request(`/ads/campaigns/${CAMPAIGN}/${operation}`,
            json('POST', { store_id: SITE, amount_minor: 100, idempotency_key: 'captured-budget-actor' }), {});
        assert.equal(result.status, 200);
        assert.deepEqual(calls[0], { query: 'SELECT set_config($1, $2, true)', params: ['app.user_id', USER_ID] });
        assert.match(calls[1].query, /(?:allocate|release)_ad_campaign_budget/);
        assert.equal(calls[1].params[5], USER_ID);
        const smuggled = app();
        const denied = await smuggled.app.request(`/ads/campaigns/${CAMPAIGN}/${operation}`,
            json('POST', { store_id: SITE, amount_minor: 100, idempotency_key: 'smuggled-budget-actor', actor_id: OTHER_SITE }), {});
        assert.equal(denied.status, 400);
        assert.equal(smuggled.calls.length, 0);
    }
});

test('a new campaign is created without a budget at all', async () => {
    const { app: a, calls } = app();
    const res = await a.request('/ads/campaigns', json('POST', { store_id: SITE, name: 'Spring' }), {});
    assert.equal(res.status, 201);
    const insert = calls.find((call) => /insert into public\.ad_campaigns/.test(call.query));
    assert.ok(insert);
    assert.deepEqual(insert.params, [SITE, 'Spring', 'draft', null, null]);
});

test('PATCH leaves an omitted schedule alone rather than nulling it', async () => {
    const { app: a, calls } = app({ rows: [{ id: CAMPAIGN }] });
    await a.request(`/ads/campaigns/${CAMPAIGN}`, json('PATCH', { store_id: SITE, name: 'Renamed' }), {});
    const update = calls.find((call) => /update public\.ad_campaigns/.test(call.query));
    assert.ok(update);
    // The sentinel pair: 'keep' means the column is not touched, 'set' means it is.
    assert.equal(update.params[4], 'keep', 'starts_at was not supplied, so it must be kept');
    assert.equal(update.params[6], 'keep', 'ends_at was not supplied, so it must be kept');

    const cleared = app({ rows: [{ id: CAMPAIGN }] });
    await cleared.app.request(`/ads/campaigns/${CAMPAIGN}`, json('PATCH', { store_id: SITE, ends_at: null }), {});
    const second = cleared.calls.find((call) => /update public\.ad_campaigns/.test(call.query));
    assert.equal(second?.params[6], 'set', 'an explicit null must clear it');
});

test('an unfunded store reports funded:false rather than an error', async () => {
    const { app: a } = app({ rows: [] });
    const res = await a.request(`/ads/account?store_id=${SITE}`, undefined, {});
    assert.equal(res.status, 200);
    const body = (await res.json()) as { data: { funded: boolean; balance_minor: number } };
    assert.equal(body.data.funded, false);
    assert.equal(body.data.balance_minor, 0);
});

test('the prepaid refusals are 422s a client can act on, not 500s', async () => {
    for (const [message, code] of [
        ['insufficient ad credits: 999 requested, 10 available', 'INSUFFICIENT_AD_CREDITS'],
        ['no prepaid ad credit account for site x', 'NO_AD_CREDIT_ACCOUNT'],
    ] as const) {
        const { app: a } = app({ throwOnWrite: new Error(message) });
        const res = await a.request(`/ads/campaigns/${CAMPAIGN}/budget`,
            json('POST', { store_id: SITE, amount_minor: 999, idempotency_key: 'ads-key-0003' }), {});
        assert.equal(res.status, 422, message);
        assert.equal(((await res.json()) as { error: { code: string } }).error.code, code);
    }
});

test('current SQL payload conflicts return fixed409 for allocation and release without database detail', async () => {
    for (const operation of ['budget', 'release']) {
        const error = Object.assign(new Error('ad credit idempotency key conflicts with a different request payload SYNTHETIC_PRIVATE_DATABASE_DETAIL'), { code: 'P0001' });
        const { app: router, calls } = app({ throwOnWrite: error });
        const response = await router.request(`/ads/campaigns/${CAMPAIGN}/${operation}`,
            json('POST', { store_id: SITE, amount_minor: 100, idempotency_key: 'conflict-exact-key' }), {});
        assert.equal(response.status, 409);
        const body = await response.text();
        assert.equal(JSON.parse(body).error.code, 'CONFLICT');
        assert.match(body, /this idempotency key belongs to a different budget request/);
        assert.doesNotMatch(body, /SYNTHETIC_PRIVATE_DATABASE_DETAIL|P0001|stack/);
        assert.equal(calls.filter(call => /(?:allocate|release)_ad_campaign_budget/.test(call.query)).length, 1);
    }
});

test('a tenant-context mismatch is a 500, and no pooled connection is a 503', async () => {
    const mismatch = app({ throwOnWrite: new Error('tenant context aaa does not match the requested site bbb') });
    const res1 = await mismatch.app.request(`/ads/campaigns/${CAMPAIGN}/budget`,
        json('POST', { store_id: SITE, amount_minor: 100, idempotency_key: 'ads-key-0004' }), {});
    assert.equal(res1.status, 500, 'the route asked for the wrong site — a gateway bug, not a client error');
    assert.equal(((await res1.json()) as { error: { code: string } }).error.code, 'TENANT_CONTEXT_MISMATCH');

    const down = app({ tenantTxUnavailable: true });
    const res2 = await down.app.request(`/ads/campaigns/${CAMPAIGN}/budget`,
        json('POST', { store_id: SITE, amount_minor: 100, idempotency_key: 'ads-key-0005' }), {});
    assert.equal(res2.status, 503);
});

test('the edge refuses a smuggled budget, a system-only status and a short idempotency key', async () => {
    const { app: a } = app();
    assert.equal((await a.request('/ads/campaigns', json('POST', { store_id: SITE, name: 'X', allocated_minor: 5000 }), {})).status, 400);
    assert.equal((await a.request('/ads/campaigns', json('POST', { store_id: SITE, name: 'X', status: 'exhausted' }), {})).status, 400);
    assert.equal((await a.request(`/ads/campaigns/${CAMPAIGN}/budget`, json('POST', { store_id: SITE, amount_minor: 100, idempotency_key: 'short' }), {})).status, 400);
    assert.equal((await a.request(`/ads/campaigns/${CAMPAIGN}/budget`, json('POST', { store_id: SITE, amount_minor: 0, idempotency_key: 'ads-key-0006' }), {})).status, 400);
});

test('SOURCE: there is no service-role path in this file', () => {
    assert.ok(!/getSupabaseAdmin/.test(routeSource), 'a service_role client here would bypass 238\'s tenant fence and RLS');
    assert.ok(!/createSupabaseServiceClient/.test(routeSource));
});

test('SOURCE: the router is actually mounted', () => {
    assert.match(indexSource, /^import adsRouter from '\.\/routes\/ads';$/m);
    assert.match(indexSource, /^api\.route\('\/ads', adsRouter\);$/m);
});

test('SOURCE: 238 keeps the fence and the grant the routes depend on', () => {
    // Comments stripped: 238 explains the fence at length, and an assertion that read its prose would
    // pass on a comment about a deleted check.
    const sql = migrationSource.replace(/--[^\n]*/g, ' ');
    assert.match(sql, /current_setting\('app\.site_id', true\)/);
    assert.match(sql, /does not match the requested site/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.allocate_ad_campaign_budget[\s\S]{0,200}?TO app_tenant/);
    // record_ad_credit_purchase must NOT be granted: it has no route, and a permission waiting for a
    // design is a permission nobody is watching.
    assert.ok(
        !/GRANT EXECUTE ON FUNCTION public\.record_ad_credit_purchase[\s\S]{0,200}?TO app_tenant/.test(sql),
        'the purchase RPC has no caller yet and must not be granted to the tenant role',
    );
});
