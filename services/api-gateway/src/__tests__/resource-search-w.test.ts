// ──────────────────────────────────────────────────────────────────────────────
// Phase W — Cross-tenant isolation tests for the resource-search route.
//
// Source guards supplement the mounted-worker / real-Postgres resource-search
// cases in owned-db/threadline-lifecycle.postgres.test.ts. Source presence alone
// does not prove that projections match the schema or that resources are returned.
//
// COVERAGE
//   1. resolveCustomUser called before any data table query (merchant gate)
//   2. verifySiteOwnership called before any data table query (tenancy gate)
//   3. All table queries carry .eq('store_id', store_id) — not a literal or
//      cross-tenant value
//   4. Customer HS256 rejection path — 403 response when customUser is null
//   5. type enum covers exactly the 5 approved types; unknown type rejected
//   6. authMiddleware registered for /resource-search in themes.ts (before slug)
//   7. resourceSearchRouter imported and mounted via router.route in themes.ts
//   8. Navigation menus queried from navigation_menus table (not per-location API)
//   9. storefront_pages fallback to legacy pages table when table is missing
//  10. results shape includes id, title, handle/slug (no sensitive fields)
// ──────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

// ── Source fixtures ────────────────────────────────────────────────────────────

const ROUTE_SRC = readFileSync(
    path.resolve(__dirname, '../routes/resource-search.ts'),
    'utf8',
);

const THEMES_SRC = readFileSync(
    path.resolve(__dirname, '../routes/themes.ts'),
    'utf8',
);

// Helper: extract the route handler body (everything after router.get('/', ...))
function routeHandlerBody(): string {
    const handlerMarker = "router.get('/', async (c) =>";
    const idx = ROUTE_SRC.indexOf(handlerMarker);
    assert.ok(idx !== -1, `Could not find route handler marker: ${handlerMarker}`);
    return ROUTE_SRC.slice(idx);
}

// ── TENANCY: resolveCustomUser before adapter calls in the route handler ───────

test('W-T01: resolveCustomUser is called before any search adapter call in the route handler (merchant gate)', () => {
    const handler = routeHandlerBody();

    const resolveIdx = handler.indexOf('resolveCustomUser(');
    assert.ok(resolveIdx !== -1, 'resolveCustomUser must be called inside the route handler');

    // The search adapters are called as searchProducts/searchCollections/etc.
    const firstAdapterCallIdx = handler.indexOf('searchProducts(');
    assert.ok(firstAdapterCallIdx !== -1, 'searchProducts call must be present in handler');

    assert.ok(
        resolveIdx < firstAdapterCallIdx,
        'resolveCustomUser must precede the first adapter call (searchProducts) in the handler',
    );
});

// ── TENANCY: verifySiteOwnership before adapter calls in the route handler ─────

test('W-T02: verifySiteOwnership is called before any search adapter call in the route handler (tenancy gate)', () => {
    const handler = routeHandlerBody();

    const verifyIdx = handler.indexOf('verifySiteOwnership(');
    assert.ok(verifyIdx !== -1, 'verifySiteOwnership must be called inside the route handler');

    const firstAdapterCallIdx = handler.indexOf('searchProducts(');
    assert.ok(
        verifyIdx < firstAdapterCallIdx,
        'verifySiteOwnership must precede the first adapter call (searchProducts) in the handler',
    );
});

// ── TENANCY: resolveCustomUser check gates on null — 403 ─────────────────────

test('W-T03: null resolveCustomUser result produces 403 FORBIDDEN (customer token rejection)', () => {
    // Assert the source contains the exact null-check and 403 response pattern
    assert.match(
        ROUTE_SRC,
        /if\s*\(\s*!customUser\s*\)/,
        'null customUser check must be present',
    );
    assert.match(
        ROUTE_SRC,
        /FORBIDDEN.*User profile not found/,
        '403 FORBIDDEN response for null customUser must be present',
    );
});

// ── TENANCY: verifySiteOwnership false gates on 403 ──────────────────────────

test('W-T04: false verifySiteOwnership result produces 403 FORBIDDEN (cross-tenant rejection)', () => {
    assert.match(
        ROUTE_SRC,
        /if\s*\(\s*!ownsStore\s*\)/,
        '!ownsStore check must be present',
    );
    assert.match(
        ROUTE_SRC,
        /FORBIDDEN.*Not authorized/,
        '403 FORBIDDEN response for cross-tenant access must be present',
    );
});

// ── TENANCY: Site A search never returns Site B resources — store_id scoping ──

test('W-T05: all table queries are scoped by .eq(store_id, …) — Site A search cannot return Site B resources', () => {
    const tables = ['products', 'collections', 'storefront_pages', 'pages', 'blog_posts', 'navigation_menus'];

    for (const table of tables) {
        // Find first occurrence of from('<table>')
        const tableFromIdx = ROUTE_SRC.indexOf(`from('${table}')`);
        if (tableFromIdx === -1) continue; // table might not be present (optional)

        // Find the eq('store_id') call that follows (within 500 chars)
        const window = ROUTE_SRC.slice(tableFromIdx, tableFromIdx + 500);
        assert.ok(
            /\.eq\(\s*['"]store_id['"]\s*,\s*store_id\s*\)/.test(window),
            `Table '${table}' must have .eq('store_id', store_id) within 500 chars of from() call`,
        );
    }
});

// ── TENANCY: no hardcoded store_id literals in table queries ──────────────────

test('W-T06: no literal UUID is used as store_id argument in table queries', () => {
    // Detects patterns like .eq('store_id', 'some-uuid') — would be a hardcoded bypass
    const literalUuidPattern = /\.eq\(\s*['"]store_id['"]\s*,\s*['"][0-9a-f-]{36}['"]\s*\)/i;
    assert.ok(
        !literalUuidPattern.test(ROUTE_SRC),
        'No literal UUID should appear as store_id in table queries (must use the verified variable)',
    );
});

// ── TYPE VALIDATION: unknown type rejected by zod enum ───────────────────────

test('W-T07: resource type enum includes exactly the 5 approved types', () => {
    assert.match(ROUTE_SRC, /'product'/, "enum must include 'product'");
    assert.match(ROUTE_SRC, /'collection'/, "enum must include 'collection'");
    assert.match(ROUTE_SRC, /'page'/, "enum must include 'page'");
    assert.match(ROUTE_SRC, /'blog'/, "enum must include 'blog'");
    assert.match(ROUTE_SRC, /'menu'/, "enum must include 'menu'");

    // The enum is declared via z.enum([...]) — unknown types fail safeParse → 400
    assert.match(
        ROUTE_SRC,
        /z\.enum\(\s*\[/,
        'z.enum must be used for type validation',
    );
    assert.match(
        ROUTE_SRC,
        /VALIDATION_ERROR/,
        'VALIDATION_ERROR must be returned when type is unknown',
    );
});

// ── AUTH: authMiddleware registered for /resource-search in themes.ts ─────────

test('W-T08: authMiddleware registered for /resource-search in themes.ts (before slug routes)', () => {
    assert.match(
        THEMES_SRC,
        /router\.use\(\s*['"]\/resource-search['"]\s*,\s*authMiddleware\s*\)/,
        "router.use('/resource-search', authMiddleware) must be present in themes.ts",
    );

    // Verify it appears BEFORE the first /:slug catch-all middleware
    const resourceSearchMiddlewareIdx = THEMES_SRC.indexOf("router.use('/resource-search', authMiddleware)");
    const firstSlugMiddlewareIdx = THEMES_SRC.indexOf("router.use('/:slug/");
    assert.ok(
        resourceSearchMiddlewareIdx < firstSlugMiddlewareIdx,
        '/resource-search authMiddleware must be registered before /:slug/* middleware',
    );
});

// ── AUTH: resourceSearchRouter mounted in themes.ts ───────────────────────────

test('W-T09: resourceSearchRouter imported and mounted via router.route in themes.ts', () => {
    assert.match(
        THEMES_SRC,
        /import\s+resourceSearchRouter\s+from\s+['"]\.\/resource-search['"]/,
        'resourceSearchRouter must be imported from ./resource-search in themes.ts',
    );

    assert.match(
        THEMES_SRC,
        /router\.route\(\s*['"]\/resource-search['"]\s*,\s*resourceSearchRouter\s*\)/,
        "router.route('/resource-search', resourceSearchRouter) must be present in themes.ts",
    );
});

// ── MENU SEARCH: queries navigation_menus table directly (not per-location API) ─

test('W-T10: menu search queries navigation_menus table directly (list all menus)', () => {
    assert.match(
        ROUTE_SRC,
        /from\('navigation_menus'\)/,
        'searchMenus must query navigation_menus table directly',
    );

    // Confirm navigation_menus query also has store_id scoping
    const navMenusIdx = ROUTE_SRC.indexOf("from('navigation_menus')");
    assert.ok(navMenusIdx !== -1, 'navigation_menus must be queried');
    const window = ROUTE_SRC.slice(navMenusIdx, navMenusIdx + 400);
    assert.ok(
        /\.eq\(\s*['"]store_id['"]\s*,\s*store_id\s*\)/.test(window),
        'navigation_menus query must be scoped by store_id',
    );
});

// ── PAGE SEARCH: storefront_pages fallback to legacy pages ────────────────────

test('W-T11: page search falls back to legacy pages table when storefront_pages is missing', () => {
    assert.match(
        ROUTE_SRC,
        /from\('storefront_pages'\)/,
        'searchPages must try storefront_pages first',
    );
    assert.match(
        ROUTE_SRC,
        /isMissingTableError\([^,]+,\s*['"]storefront_pages['"]\)/,
        'searchPages must detect missing storefront_pages and fall back',
    );
    assert.match(
        ROUTE_SRC,
        /from\('pages'\)/,
        'searchPages must fall back to legacy pages table',
    );
});

// ── RESPONSE SHAPE: no sensitive fields exposed ───────────────────────────────

test('W-T12: results use slim schema-backed identity fields; no price/email/token', () => {
    const products = ROUTE_SRC.slice(ROUTE_SRC.indexOf('async function searchProducts('), ROUTE_SRC.indexOf('async function searchCollections('));
    const collections = ROUTE_SRC.slice(ROUTE_SRC.indexOf('async function searchCollections('), ROUTE_SRC.indexOf('async function searchPages('));
    assert.match(products, /select\('id,name,slug'\)/, 'products use their actual slug column');
    assert.match(collections, /select\('id,title'\)/, 'collections have no handle column');
    // Blog posts and pages: only id, title, slug
    assert.match(ROUTE_SRC, /select\('id,title,slug'\)/, 'pages/blog_posts select must only fetch id,title,slug');

    // No sensitive fields
    assert.doesNotMatch(ROUTE_SRC, /select\(.*password/, 'select must not include password');
    assert.doesNotMatch(ROUTE_SRC, /select\(.*email/, 'select must not include email');
    assert.doesNotMatch(ROUTE_SRC, /select\(.*price/, 'select must not include price');
    assert.doesNotMatch(ROUTE_SRC, /select\(.*secret/, 'select must not include secret');
});

// ── READ-ONLY: no write operations in resource-search.ts ─────────────────────

test('W-T13: resource-search route is read-only (no insert, update, delete, rpc)', () => {
    assert.doesNotMatch(ROUTE_SRC, /\.insert\(/, 'resource-search must not insert');
    assert.doesNotMatch(ROUTE_SRC, /\.update\(/, 'resource-search must not update');
    assert.doesNotMatch(ROUTE_SRC, /\.delete\(/, 'resource-search must not delete');
    assert.doesNotMatch(ROUTE_SRC, /db\.rpc\(/, 'resource-search must not call RPCs');
    assert.doesNotMatch(ROUTE_SRC, /router\.post\(/, 'resource-search must not register POST routes');
    assert.doesNotMatch(ROUTE_SRC, /router\.put\(/, 'resource-search must not register PUT routes');
    assert.doesNotMatch(ROUTE_SRC, /router\.patch\(/, 'resource-search must not register PATCH routes');
    assert.doesNotMatch(ROUTE_SRC, /router\.delete\(/, 'resource-search must not register DELETE routes');
});

// ── Cross-tenant: customer token rejection logic-level test ───────────────────

test('W-T14: customer HS256 token rejection — resolveCustomUser null path logic', async () => {
    // Logic-level test: simulate what happens when resolveCustomUser returns null.
    // We verify the code structure that makes this work by inspecting source.
    //
    // Customer HS256 tokens (issueCustomerSession) produce no row in users_custom
    // (customers are in store_customers). resolveCustomUser queries users_custom
    // by id then by email — both will miss → returns null → route returns 403.

    assert.match(
        ROUTE_SRC,
        /const customUser = await resolveCustomUser\(db,\s*auth\.user\)/,
        'resolveCustomUser must be called with auth.user (merchant ES256 context)',
    );

    // Confirm the import pulls from lib/auth-user (the canonical implementation)
    assert.match(
        ROUTE_SRC,
        /import \{[^}]*resolveCustomUser[^}]*\} from '\.\.\/lib\/auth-user'/,
        'resolveCustomUser must be imported from lib/auth-user',
    );
    assert.match(
        ROUTE_SRC,
        /import \{[^}]*verifySiteOwnership[^}]*\} from '\.\.\/lib\/auth-user'/,
        'verifySiteOwnership must be imported from lib/auth-user',
    );
});

// ── Cross-tenant: Site B merchant calling with Site A store_id ────────────────

test('W-T15: cross-site access rejected by verifySiteOwnership — Site B merchant cannot access Site A resources', () => {
    // verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId) checks:
    //   - if auth.user.storeId (session-bound) !== store_id → false immediately
    //   - if sites row has custom_user_id/user_id matching customUser.id → false
    // Both conditions reject a Site B merchant calling with a Site A store_id.

    assert.match(
        ROUTE_SRC,
        /const ownsStore = await verifySiteOwnership\(db,\s*store_id,\s*customUser\.id,\s*auth\.user\.storeId\)/,
        'verifySiteOwnership must receive (db, store_id, customUser.id, auth.user.storeId)',
    );
});
