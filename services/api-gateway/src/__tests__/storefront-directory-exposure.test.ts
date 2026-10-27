// Owner decision CAP-C60, 27 October: anonymous public launches use a fixed service-only SQL projection.
// These contracts preserve the ordinary tenant guard and public-only eligibility; the owned
// public-storefront-directory suite separately proves the actual Gateway/RPC/PG behavior.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { StorefrontDirectoryPayload } from '@letbuyy/shared-types';
import { createTenantGuardedSupabaseClient } from '../tenant/tenant-scoped';
import { registerStorefrontPublicRoutes } from '../routes/storefront/public-routes';
import type { Env } from '../index';
import { AppError, formatAppError } from '../lib/errors';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const ROUTE_FILE = 'routes/storefront/public-routes.ts';

// Hand-reading a handler's end has produced two wrong spans in this programme already (a terminator
// that matched inside a multi-line return type; a keyword tail mistaken for the keyword). Balance the
// braces instead of guessing a terminator.
function handlerBody(source: string, mountExpression: string): string {
    const start = source.indexOf(mountExpression);
    assert.notEqual(start, -1, `${mountExpression} is no longer mounted in ${ROUTE_FILE}`);
    const open = source.indexOf('{', start);
    assert.notEqual(open, -1, 'no handler body found after the mount expression');

    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '{') depth += 1;
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(open, i + 1);
        }
    }
    assert.fail('handler body braces never balanced — the span extractor is wrong, not the route');
}

const routeSource = readFileSync(join(srcRoot, ROUTE_FILE), 'utf8');
const directory = handlerBody(routeSource, "router.get('/directory'");

const directorySql=readFileSync(join(srcRoot,'../../../database/supabase/migrations/398_public_storefront_directory.sql'),'utf8');
test('the real directory handler uses the fixed public RPC through the ordinary guarded client',()=>{
 assert.match(directory,/getSupabaseAdmin/);assert.match(directory,/public_storefront_directory_v1/);
 assert.doesNotMatch(directory,/getSupabaseAdminUnguarded|from\('sites'\)/);
 assert.match(directory,/StorefrontDirectoryPayloadSchema/);
});
test('the SQL projection requires published/public/nondeleted stores and the same population owns counts',()=>{
 for(const predicate of ["s.status = 'published'","s.published IS TRUE","COALESCE(s.access_mode, 'public') = 'public'","s.deleted_at IS NULL","s.site_type = 'store'"]) assert.ok(directorySql.includes(predicate),predicate);
 assert.match(directorySql,/totalStores'[\s\S]*?count\(\*\) FROM eligible/);
 assert.match(directorySql,/p_limit > 24/);assert.match(directorySql,/REVOKE ALL[\s\S]*FROM PUBLIC, anon, authenticated/);
 assert.doesNotMatch(directorySql,/user_id|email|access_password_hash|template_config/);
});

// ── the fail-closed half ────────────────────────────────────────────────────────────────────────

type Chain = Record<string, unknown>;

// A stand-in for the PostgREST builder: every method chains, and `then` resolves. The REAL guard
// wraps it, so what is under test is createTenantGuardedSupabaseClient, not this stub.
function fakeClient(rows: unknown[]) {
    const builder = () => {
        const chain: Chain = {};
        for (const method of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit', 'match', 'or', 'filter']) {
            chain[method] = () => chain;
        }
        chain.then = (onFulfilled: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(onFulfilled);
        return chain;
    };
    return { from: () => builder() } as never;
}

test('the guard resolves a sites query that carries an accepted scope predicate (positive control)', async () => {
    // Without this control, the rejection below could just mean the stub is broken.
    const db = createTenantGuardedSupabaseClient(fakeClient([{ store_name: 'scoped' }]));
    const { data } = await db.from('sites').select('store_name').eq('id', 'some-site-id');
    assert.deepEqual(data, [{ store_name: 'scoped' }]);
});

test('the guard continues rejecting an unscoped sites listing after the public directory decision', async () => {
    const db = createTenantGuardedSupabaseClient(fakeClient([{ store_name: 'leaked' }]));
    await assert.rejects(
        async () =>
            db
                .from('sites')
                .select('store_name, name, logo_url, theme_id, status, site_type, created_at')
                .eq('status', 'published')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(12),
        /Tenant table sites requires a tenant\/owner predicate before execution/,
        'the fixed directory RPC must not relax arbitrary sites queries',
    );
});

test('the guard rejects the /directory count chain too', async () => {
    const db = createTenantGuardedSupabaseClient(fakeClient([]));
    await assert.rejects(
        async () =>
            db
                .from('sites')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'published')
                .is('deleted_at', null),
        /Tenant table sites requires a tenant\/owner predicate before execution/,
    );
});

test('status is not an accepted scope column for sites — the reason the route fails closed', async () => {
    // Pins the specific mechanism. If `status` were ever added to scopedColumnsForTable's sites list,
    // every unscoped platform-wide sites read would silently start executing.
    const db = createTenantGuardedSupabaseClient(fakeClient([{ store_name: 'leaked' }]));
    await assert.rejects(
        async () => db.from('sites').select('store_name').eq('status', 'published'),
        /requires a tenant\/owner predicate/,
    );
});

// Hermetic wire-contract checks. Actual SQL/privacy behavior is covered by the owned suite.
type PublicDeps = Parameters<typeof registerStorefrontPublicRoutes>[1];
type Loader = NonNullable<PublicDeps['loadPublicDirectory']>;
function publicApp(loader: Loader = async()=>({data:null,error:{code:'unavailable'}})) {
 const app = new Hono<{Bindings:Env}>();
 app.onError((error,c)=>error instanceof AppError?c.json(formatAppError(error).body,error.statusCode as ContentfulStatusCode):c.json({error:{code:'INTERNAL_ERROR',message:'Unexpected error'}},500));
 registerStorefrontPublicRoutes(app as unknown as Parameters<typeof registerStorefrontPublicRoutes>[0],{loadPublicDirectory:loader} as PublicDeps);
 return app;
}
const publicData={stores:[],stats:{scope:'public_stores',totalStores:0,totalThemes:10,totalProducts:0,totalOrders:0},pagination:{limit:12,has_more:false,next_cursor:null}};
test('an unavailable public read returns sanitized503 instead of a fabricated empty directory',async()=>{
 const res=await publicApp().request('/directory');assert.equal(res.status,503);
 const body=await res.json<{error:{code:string}}>();assert.equal(body.error.code,'DIRECTORY_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(body),/totalStores|private/);
});
test('a successful zero-store directory preserves the real nonzero theme count and no-store response',async()=>{
 const res=await publicApp(async(_c,args)=>{assert.deepEqual(args,{p_limit:12,p_after_at:null,p_after_id:null});return{data:publicData,error:null};}).request('/directory');
 assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');assert.deepEqual((await res.json<{data:StorefrontDirectoryPayload}>()).data,publicData);
});
test('malformed/private upstream fields are refused rather than serialized publicly',async()=>{
 for(const data of [{...publicData,account_email:'synthetic-private@example.invalid'},{...publicData,stats:{...publicData.stats,totalStores:-1}}]){
  const res=await publicApp(async()=>({data,error:null})).request('/directory');assert.equal(res.status,503);assert.doesNotMatch(await res.text(),/synthetic-private/);
 }
});
test('invalid pagination cannot reach SQL and an unrelated programmer failure stays an internal error',async()=>{
 let calls=0;const app=publicApp(async()=>{calls++;throw new Error('synthetic private diagnostic');});
 for(const query of ['limit=25','cursor=invalid','include_private=true'])assert.equal((await app.request('/directory?'+query)).status,400);
 assert.equal(calls,0);const res=await app.request('/directory');assert.equal(res.status,500);assert.doesNotMatch(await res.text(),/private diagnostic/);
});
