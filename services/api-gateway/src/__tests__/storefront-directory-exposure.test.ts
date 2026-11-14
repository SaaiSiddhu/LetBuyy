// F-DIRECTORY-1 — GET /v1/storefront/directory must never disclose unpublished stores.
//
// The route is mounted on the ANONYMOUS storefront router, so every row and every count it returns
// is public. A `draft` site is a store a merchant created and has not launched. Listing one — or
// counting it in the platform-wide `totalStores` figure — publishes that merchant's store_name,
// logo_url, theme_id and created_at before they chose to be public. Before this phase the listing
// filtered `.in('status', ['draft', 'published'])` and the count filtered
// `.not('status', 'eq', 'suspended')`; both admitted drafts.
//
// The second half of this file pins a fact the first half depends on for its risk assessment: the
// route does not execute today. `sites` is a registered tenant table, `status` is not one of its
// accepted scope columns, and createTenantGuardedSupabaseClient rejects the chain before it runs.
// That fail-closed state is what makes the exposure latent rather than live, and this phase does
// NOT change it — turning a platform-wide public store directory on is an owner decision (CAP-C60).
// If a later phase makes the route live, these tests are what stop drafts riding along.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Hono } from 'hono';
import { createTenantGuardedSupabaseClient } from '../tenant/tenant-scoped';
import { registerStorefrontPublicRoutes } from '../routes/storefront/public-routes';
import type { Env } from '../index';

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

test('the extracted /directory span is the real handler, not a fragment', () => {
    // A span assertion that silently matched two lines would make every check below vacuous.
    assert.match(directory, /getSupabaseAdmin\(c\)/);
    assert.match(directory, /totalStores/);
    assert.match(directory, /totalThemes/);
    assert.ok(directory.includes("from('sites')"), 'the span must contain the sites queries it constrains');
    assert.ok(directory.length > 400, `span suspiciously short (${directory.length} chars)`);
});

test('the public directory listing selects published stores only', () => {
    assert.ok(
        !/['"]draft['"]/.test(directory),
        "GET /storefront/directory admits 'draft' again. This route is anonymous: a draft site is an "
            + 'unlaunched store, and listing it publishes its name, logo and theme before its merchant chose to be public.',
    );
    assert.equal(
        (directory.match(/\.eq\('status', 'published'\)/g) || []).length,
        2,
        'both the listing query and the totalStores count must filter on published',
    );
});

test('the totalStores count cannot be widened back to "everything except suspended"', () => {
    // `.not('status', 'eq', 'suspended')` counted drafts. It is a different shape from the listing
    // filter, so the draft-literal check above would not have caught it.
    assert.ok(
        !/\.not\(\s*['"]status['"]/.test(directory),
        'the store count must not filter by exclusion — exclusion counts every future status, including draft',
    );
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

test('the guard rejects the /directory listing chain — the route is fail-closed today', async () => {
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
        'if this now resolves, the directory went live without an owner decision — see CAP-C60',
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

// ── the graceful-unavailable half (F1.5, foundation-phase1-closure, 2026-09-26) ────────────────
//
// Before this phase, the guard's rejection above propagated uncaught out of the route handler to
// the gateway's global error handler, so a real anonymous caller saw an opaque `500
// INTERNAL_ERROR` — logged and reported identically to a genuine crash. The route now catches
// exactly that one documented rejection and reports it as the deliberate unavailability it is.
// These tests exercise the REAL route through a real Hono app (not the fake-client stand-in
// above), so what is asserted is the wire contract a caller actually receives.

type PublicDeps = Parameters<typeof registerStorefrontPublicRoutes>[1];

function publicApp() {
    const app = new Hono<{ Bindings: Env }>();
    // `/directory` calls the module-level getSupabaseAdmin() directly, not an injected dependency —
    // an empty deps object is sufficient to register every route; only `/directory` is invoked below.
    registerStorefrontPublicRoutes(
        app as unknown as Parameters<typeof registerStorefrontPublicRoutes>[0],
        {} as unknown as PublicDeps,
    );
    return app;
}

// Plausible but unreachable — createClient() never validates reachability at construction time,
// and the guard rejects the query chain before any network call would happen (proved above).
const workingEnv = () => ({
    SUPABASE_URL: 'https://example.test',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
} as unknown as Env);

test('GET /directory returns a deliberate 503 DIRECTORY_UNAVAILABLE, not an opaque 500', async () => {
    const res = await publicApp().request('/directory', undefined, workingEnv());
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'DIRECTORY_UNAVAILABLE');
    assert.match(body.error.message, /not available/i);
});

test('the 503 is still produced by the tenant guard, not by skipping it — the isolation boundary', async () => {
    // If a future edit routed around getSupabaseAdmin (e.g. swapped in getSupabaseAdminUnguarded,
    // or added a site_id/tenant predicate that let the query through), this route would start
    // returning 200 with real store rows instead of 503. That is exactly the regression this test
    // exists to catch — CAP-C60 stays an owner decision, never an accidental side effect of an
    // error-handling change.
    const res = await publicApp().request('/directory', undefined, workingEnv());
    assert.equal(res.status, 503, 'a 200 here means the tenant guard no longer blocks the unscoped sites read');
});

test('a genuinely different failure is NOT reported as DIRECTORY_UNAVAILABLE', async () => {
    // No SUPABASE_URL/KEY makes createClient() throw synchronously with an unrelated message,
    // proving the catch block recognizes only the one documented guard rejection, never everything.
    const res = await publicApp().request('/directory', undefined, {} as unknown as Env);
    assert.notEqual(res.status, 503, 'an unrelated construction failure must not be reported as the directory being deliberately unavailable');
});
