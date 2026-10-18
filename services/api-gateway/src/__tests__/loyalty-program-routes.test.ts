// F-LOY-3 (backend) — merchant loyalty programme settings routes.
//
// Behavioural where it can be: the router is driven through a real Hono app with injected scope
// resolution and tenant SQL, so what is asserted is the wire contract — which parameters reach
// set_loyalty_program, in which order, with NULL for anything the caller omitted. Source-shape
// assertions are kept only for facts no unit can exercise: mounting, and the absence of a
// service-role write path. An injected fake CAN model the tenant scoping, which is exactly why it
// cannot prove it, so the properties that depend on the real scope are pinned against the source.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Hono } from 'hono';
import { createLoyaltyRouter, SET_LOYALTY_PROGRAM_SQL, type LoyaltyRouteDependencies } from '../routes/loyalty';
import { TenantTransactionUnavailableError } from '../lib/tenant-transaction';

const routeSource = readFileSync(new URL('../routes/loyalty.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(
    new URL('../../../../database/supabase/migrations/334_loyalty_program_authority.sql', import.meta.url),
    'utf8',
);

const RESOLVED_SITE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const OTHER_SITE = 'bbbbbbbb-0000-4000-8000-00000000000b';
const USER_ID = 'cccccccc-0000-4000-8000-00000000000c';

const PROGRAM_ROW = {
    site_id: RESOLVED_SITE,
    is_active: true,
    earn_rate_bps: 500,
    redeem_cap_bps: 5000,
    point_value_minor: 100,
    created_at: '2026-09-06T00:00:00+00:00',
    updated_at: '2026-09-06T00:00:00+00:00',
};

interface Recorded { query: string; params: unknown[] }

function app(options: {
    rows?: Record<string, unknown>[];
    outstanding?: number | string;
    resolvedSite?: string;
    throwOnWrite?: unknown;
    tenantTxUnavailable?: boolean;
} = {}) {
    const calls: Recorded[] = [];
    const deps: LoyaltyRouteDependencies = {
        resolveOwnedStoreScope: async (_c, siteId) => ({
            // Deliberately ignores the requested id when `resolvedSite` is set: that models a store
            // whose ownership resolution answers with a DIFFERENT site than the body asked for, so
            // the assertion below can tell which of the two actually reaches the RPC.
            siteId: options.resolvedSite ?? siteId,
            customUser: { id: USER_ID, email: 'merchant@example.com', full_name: 'Merchant' },
            tenant: { siteId: options.resolvedSite ?? siteId, requestId: 'req-test-1' },
        }) as unknown as Awaited<ReturnType<LoyaltyRouteDependencies['resolveOwnedStoreScope']>>,
        withResolvedTenantTx: async (_c, _tenant, callback) => {
            if (options.tenantTxUnavailable) throw new TenantTransactionUnavailableError();
            return callback({
                unsafe: async (query: string, params: unknown[] = []) => {
                    calls.push({ query, params });
                    if (query.includes('read_loyalty_program_v1')) return [{result:{store_id:options.resolvedSite??RESOLVED_SITE,
                        enrolled:Boolean(options.rows?.length),program:options.rows?.[0]??null,
                        outstanding_points:String(options.outstanding??0),valuation_policy:'block_decrease_while_outstanding',value_decrease_allowed:true}}];
                    if (query.includes('mutate_loyalty_program_v1')) {
                        if (options.throwOnWrite) throw options.throwOnWrite;
                        return [{ result: { data: {site_id: RESOLVED_SITE,created: false}, status:200, replayed:false } }];
                    }
                    return options.rows ?? [];
                },
            });
        },
    };
    const root = new Hono();
    root.route('/loyalty', createLoyaltyRouter(deps));
    return { app: root, calls };
}

const put = (body: unknown) => ({
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'X-Idempotency-Key': 'syn-loy-settings-key' },
    body: JSON.stringify({expected_updated_at:null,...body as Record<string,unknown>}),
});

test('PUT sends resolved actor, exact intent, retry key and explicit version to the canonical guarded writer', async () => {
    const { app: a, calls } = app();
    const res = await a.request(`/loyalty/program`, put({ store_id: RESOLVED_SITE, is_active: true }), {});
    assert.equal(res.status, 200);

    const write = calls.find((call) => call.query.includes('mutate_loyalty_program_v1'));
    assert.ok(write, 'the write must go through the RPC');
    assert.equal(write.query, SET_LOYALTY_PROGRAM_SQL);
    // Only the supplied intent crosses the guard. Omission remains leave-unchanged.
    assert.deepEqual(write.params, [
        RESOLVED_SITE, USER_ID, {is_active:true}, 'syn-loy-settings-key', null, 'req-test-1',
    ]);
});

test('the site comes from the resolved scope, never from the request body', async () => {
    const { app: a, calls } = app({ resolvedSite: RESOLVED_SITE });
    const res = await a.request(`/loyalty/program`, put({ store_id: OTHER_SITE, earn_rate_bps: 250 }), {});
    assert.equal(res.status, 200);

    const write = calls.find((call) => call.query.includes('mutate_loyalty_program_v1'));
    assert.equal(write?.params[0], RESOLVED_SITE, 'the body\'s store_id must not be what the RPC receives');
    assert.notEqual(write?.params[0], OTHER_SITE);
});

test('GET distinguishes not-enrolled from enrolled-and-paused', async () => {
    const absent = app({ rows: [], outstanding: 0 });
    const res1 = await absent.app.request(`/loyalty/program?store_id=${RESOLVED_SITE}`, undefined, {});
    const body1 = (await res1.json()) as { data: { enrolled: boolean; program: unknown } };
    assert.equal(res1.status, 200);
    assert.equal(body1.data.enrolled, false);
    assert.equal(body1.data.program, null, 'a zeroed programme would tell a merchant they had one');

    const present = app({ rows: [{ ...PROGRAM_ROW, is_active: false }], outstanding: 4200 });
    const res2 = await present.app.request(`/loyalty/program?store_id=${RESOLVED_SITE}`, undefined, {});
    const body2 = (await res2.json()) as { data: { enrolled: boolean; program: { is_active: boolean }; outstanding_points: string } };
    assert.equal(body2.data.enrolled, true, 'paused is still enrolled');
    assert.equal(body2.data.program.is_active, false);
    assert.equal(body2.data.outstanding_points, '4200', 'the liability is served with the settings');
});

test('a body that changes nothing is rejected, so "omitted" can never mean "clear it"', async () => {
    const { app: a } = app();
    const res = await a.request(`/loyalty/program`, put({ store_id: RESOLVED_SITE }), {});
    assert.equal(res.status, 400);
});

test('unknown keys and out-of-range values are refused at the edge', async () => {
    const { app: a } = app();
    assert.equal((await a.request(`/loyalty/program`, put({ store_id: RESOLVED_SITE, site_id: OTHER_SITE, is_active: true }), {})).status, 400);
    assert.equal((await a.request(`/loyalty/program`, put({ store_id: RESOLVED_SITE, earn_rate_bps: 10001 }), {})).status, 400);
    assert.equal((await a.request(`/loyalty/program`, put({ store_id: RESOLVED_SITE, redeem_cap_bps: -1 }), {})).status, 400);
    assert.equal((await a.request(`/loyalty/program`, put({ store_id: RESOLVED_SITE, point_value_minor: 0 }), {})).status, 400);
});

test('a tenant-context mismatch from the database is a 500, not a client error', async () => {
    const { app: a } = app({
        throwOnWrite: new Error('tenant context aaaa does not match the requested site bbbb'),
    });
    const res = await a.request(`/loyalty/program`, put({ store_id: RESOLVED_SITE, is_active: true }), {});
    assert.equal(res.status, 500, 'the route asked for the wrong site — that is a gateway bug');
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'TENANT_CONTEXT_MISMATCH');
});

test('no pooled connection answers 503 rather than reaching for the admin client', async () => {
    const { app: a } = app({ tenantTxUnavailable: true });
    const res = await a.request(`/loyalty/program`, put({ store_id: RESOLVED_SITE, is_active: true }), {});
    assert.equal(res.status, 503);
});

test('SOURCE: there is no service-role path in this file', () => {
    // An injected fake cannot prove this: it would have to model a fallback that must not exist.
    assert.ok(!/getSupabaseAdmin/.test(routeSource), 'a service_role client here would bypass 237\'s tenant fence');
    assert.ok(!/createSupabaseServiceClient/.test(routeSource));
});

test('SOURCE: the table is never written directly — the RPC is the only write', () => {
    // Strip comments first: this file discusses UPDATE and the table by name in prose, and an
    // absence assertion over documented code that reads its own prose proves nothing.
    const code = routeSource.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
    assert.ok(!/update\s+public\.loyalty_programs/i.test(code));
    assert.ok(!/insert\s+into\s+public\.loyalty_programs/i.test(code));
    assert.match(code, /public\.\$\{SET_LOYALTY_PROGRAM_RPC\}|set_loyalty_program/);
});

test('SOURCE: the router is actually mounted', () => {
    assert.match(indexSource, /^import loyaltyRouter from '\.\/routes\/loyalty';$/m);
    assert.match(indexSource, /^api\.route\('\/loyalty', loyaltyRouter\);$/m);
});

test('SOURCE: current settings authority requires the tenant and preserves the canonical writer', () => {
    const sql = migrationSource.replace(/--[^\n]*/g, ' ');
    assert.match(sql, /current_setting\('app\.site_id',\s*true\)/, 'the fence reads the GUC');
    assert.match(sql, /does not match the requested site/, 'and refuses a mismatch');
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.set_loyalty_program[\s\S]{0,200}?TO app_tenant/,
        'the canonical tenant writer remains available inside the real tenant transaction');
});


test('versions, stable retry keys and precise paise are validated before writing',async()=>{
 const {app:a,calls}=app();
 for(const body of [
  {store_id:RESOLVED_SITE,is_active:true,expected_updated_at:undefined},
  {store_id:RESOLVED_SITE,is_active:true,expected_updated_at:'not-a-date'},
  {store_id:RESOLVED_SITE,point_value_minor:9007199254740992},
  {store_id:RESOLVED_SITE,point_value_minor:'9223372036854775808'},
  {store_id:RESOLVED_SITE,point_value_minor:'abc'},
  {store_id:RESOLVED_SITE,earn_rate_bps:null},
  {store_id:RESOLVED_SITE,redeem_cap_bps:true},
 ]) assert.equal((await a.request('/loyalty/program',put(body),{})).status,400);
 const noKey=put({store_id:RESOLVED_SITE,is_active:true});delete (noKey.headers as Record<string,string>)['X-Idempotency-Key'];
 assert.equal((await a.request('/loyalty/program',noKey,{})).status,400);assert.equal(calls.length,0);
 const precise=await a.request('/loyalty/program',put({store_id:RESOLVED_SITE,point_value_minor:'9007199254740993'}),{});
 assert.equal(precise.status,200);assert.deepEqual(calls[0].params[2],{point_value_minor:'9007199254740993'});
});

test('GET preserves bigint digits and the owner-approved decrease policy refusal is explicit',async()=>{
 const h=app({outstanding:'9007199254740993'});
 const read=await h.app.request('/loyalty/program?store_id='+RESOLVED_SITE,undefined,{});
 assert.equal((await read.json() as any).data.outstanding_points,'9007199254740993');
 const f=app({throwOnWrite:new Error('LOYALTY_VALUE_DECREASE_BLOCKED')});
 const response=await f.app.request('/loyalty/program',put({store_id:RESOLVED_SITE,point_value_minor:'50'}),{});
 assert.equal(response.status,409);assert.equal((await response.json() as any).error.code,'LOYALTY_VALUE_DECREASE_BLOCKED');
});
