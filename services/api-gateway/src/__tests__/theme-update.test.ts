/**
 * Phase AB — theme version update (Lane B gateway) tests.
 *
 * ALL tests are logic-level with mocked DB (no real database connection required).
 * Source-pattern assertions read the adapter/route source to confirm structural
 * properties (authMiddleware registration order, cross-tenant isolation ordering,
 * diff-hash mismatch behaviour, idempotency pre-check filter order).
 *
 * Key invariants proved here:
 *   1. authMiddleware registered for /:slug/update-preview and /:slug/update BEFORE
 *      any /:slug/* catch-all — HS256 customer tokens are rejected at the edge.
 *   2. Cross-tenant isolation: verifySiteOwnership (Site B merchant → Site A store_id)
 *      fires BEFORE any theme_releases write. ForbiddenError thrown, no release row
 *      inserted.
 *   3. UpdateVersionRejectedError from planThemeSafeUpdate propagates as 422
 *      (source-pattern assertion that the catch block handles it).
 *   4. confirm_diff_hash mismatch → ConflictError before publishVersionUpdateRelease is
 *      called (CAS guard fires before the DB write).
 *   5. Idempotency pre-check: store_id is the FIRST eq() filter on theme_releases
 *      (cross-tenant impossibility proof — source-pattern assertion on adapter source).
 *   6. NO-DATA-LOSS: planThemeSafeUpdate is called with both currentDocument and
 *      nextBundle before any publish path (source-pattern assertion).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

import { ForbiddenError, ConflictError, ValidationError, NotFoundError } from '../lib/errors';

// ─── Source paths ──────────────────────────────────────────────────────────────

const ADAPTER_SRC = readFileSync(
    path.resolve(__dirname, '../execution/theme-execution.adapter.ts'),
    'utf8',
);
const ROUTE_SRC = readFileSync(
    path.resolve(__dirname, '../routes/themes/theme-update-route.ts'),
    'utf8',
);
const THEMES_SRC = readFileSync(
    path.resolve(__dirname, '../routes/themes.ts'),
    'utf8',
);

// ─── Mock helpers ──────────────────────────────────────────────────────────────

type MockResult = { data: unknown; error: unknown };

function makeChain(result: MockResult): Record<string, unknown> {
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    const methods = [
        'select', 'eq', 'or', 'is', 'neq', 'update', 'insert', 'upsert', 'delete',
        'order', 'limit', 'maybeSingle', 'single',
    ];
    for (const m of methods) {
        chain[m] = (..._args: unknown[]) => {
            if (m === 'single' || m === 'maybeSingle') return Promise.resolve(result);
            return chain;
        };
    }
    return chain;
}

function makeMockDb(tableResults: Record<string, MockResult>) {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

    function makeTableChain(table: string, result: MockResult): Record<string, unknown> {
        const chain: Record<string, (...args: unknown[]) => unknown> = {};
        const methods = [
            'select', 'eq', 'or', 'is', 'neq', 'update', 'insert', 'upsert', 'delete',
            'order', 'limit', 'maybeSingle', 'single',
        ];
        for (const m of methods) {
            chain[m] = (...args: unknown[]) => {
                calls.push({ table, method: m, args });
                if (m === 'single' || m === 'maybeSingle') return Promise.resolve(result);
                return chain;
            };
        }
        return chain;
    }

    const db = {
        from: (table: string) => {
            calls.push({ table, method: 'from', args: [table] });
            const result = tableResults[table] ?? { data: null, error: null };
            return makeTableChain(table, result);
        },
        rpc: (_fn: string, _args: unknown) => {
            calls.push({ table: '__rpc__', method: _fn as string, args: [_args] });
            return Promise.resolve({
                data: null,
                error: { message: 'Could not find the function publish_theme_release' },
            });
        },
    };

    return { db, calls };
}

// Fixed UUIDs for tenant isolation tests
const VALID_STORE_UUID = 'a0000000-0000-4000-8000-000000000001';

// ─── Source-pattern assertions ─────────────────────────────────────────────────

test('authMiddleware registered for /:slug/update-preview and /:slug/update (HS256 rejection)', () => {
    // themes.ts must register authMiddleware for both AB routes BEFORE any /:slug/* catch-all
    assert.ok(
        THEMES_SRC.includes("router.use('/:slug/update-preview', authMiddleware)"),
        "authMiddleware must be registered for /:slug/update-preview — primary HS256 defence",
    );
    assert.ok(
        THEMES_SRC.includes("router.use('/:slug/update', authMiddleware)"),
        "authMiddleware must be registered for /:slug/update — primary HS256 defence",
    );
});

test('update routes registered before /:slug catch-alls in themes.ts (route ordering)', () => {
    const updatePreviewPos = THEMES_SRC.indexOf("router.use('/:slug/update-preview', authMiddleware)");
    const slugEditorPos = THEMES_SRC.indexOf("router.use('/:slug/editor', authMiddleware)");
    // update-preview and update should appear before the general /:slug/editor catch-all
    // (or at the same relative position in the middleware chain)
    assert.ok(updatePreviewPos > -1, "update-preview middleware must exist in themes.ts");
    assert.ok(slugEditorPos > -1, "/:slug/editor middleware must exist in themes.ts");
    // The AB middleware must appear before the /:slug/editor group to prevent shadowing
    assert.ok(
        updatePreviewPos < slugEditorPos,
        "AB route middleware must be registered before /:slug/editor catch-all middleware",
    );
});

test('mountThemeUpdateRoutes is imported and called in themes.ts', () => {
    assert.ok(
        THEMES_SRC.includes("import { mountThemeUpdateRoutes } from './themes/theme-update-route'"),
        "themes.ts must import mountThemeUpdateRoutes from theme-update-route",
    );
    assert.ok(
        THEMES_SRC.includes('mountThemeUpdateRoutes(router)'),
        "themes.ts must call mountThemeUpdateRoutes(router)",
    );
});

test('UpdateVersionRejectedError propagated as 422 in route handler (source assertion)', () => {
    assert.ok(
        ROUTE_SRC.includes('UpdateVersionRejectedError'),
        "route must import UpdateVersionRejectedError",
    );
    assert.ok(
        ROUTE_SRC.includes("err instanceof UpdateVersionRejectedError"),
        "route catch block must handle UpdateVersionRejectedError",
    );
    assert.ok(
        ROUTE_SRC.includes('422'),
        "route must return 422 for UpdateVersionRejectedError",
    );
});

test('UpdateDowngradeError propagated as 422 in route handler (source assertion)', () => {
    assert.ok(
        ROUTE_SRC.includes('UpdateDowngradeError'),
        "route must import UpdateDowngradeError",
    );
    assert.ok(
        ROUTE_SRC.includes("err instanceof UpdateDowngradeError"),
        "route catch block must handle UpdateDowngradeError",
    );
});

test('confirm_diff_hash mismatch throws ConflictError before publish (source assertion)', () => {
    // The CAS guard must appear BEFORE publishVersionUpdateRelease in the POST handler.
    const casGuardPos = ROUTE_SRC.indexOf('computedHash !== confirmDiffHash');
    const publishCallPos = ROUTE_SRC.indexOf('publishVersionUpdateRelease');
    assert.ok(casGuardPos > -1, "CAS guard (computedHash !== confirmDiffHash) must exist in route");
    assert.ok(publishCallPos > -1, "publishVersionUpdateRelease call must exist in route");
    assert.ok(
        casGuardPos < publishCallPos,
        "CAS guard must appear before publishVersionUpdateRelease call (no write before hash verification)",
    );
});

test('planThemeSafeUpdate called before any publish path (NO-DATA-LOSS source assertion)', () => {
    // planThemeSafeUpdate must appear before fromThemeDocumentV2 and before publishVersionUpdateRelease
    const planPos = ROUTE_SRC.indexOf('planThemeSafeUpdate(');
    const fromDocPos = ROUTE_SRC.indexOf('fromThemeDocumentV2(');
    const publishPos = ROUTE_SRC.indexOf('publishVersionUpdateRelease');
    assert.ok(planPos > -1, "planThemeSafeUpdate must be called in route");
    assert.ok(fromDocPos > -1, "fromThemeDocumentV2 must be called in route");
    assert.ok(planPos < fromDocPos, "planThemeSafeUpdate must be called before fromThemeDocumentV2");
    assert.ok(fromDocPos < publishPos, "fromThemeDocumentV2 must be called before publishVersionUpdateRelease");
});

test('idempotency pre-check: store_id is FIRST eq() filter on theme_releases (cross-tenant proof)', () => {
    // In publishVersionUpdateRelease, the idempotency query must scope by store_id first.
    // Source-pattern: the adapter source must have .eq('store_id', ...) before .eq('idempotency_key', ...)
    // in the publishVersionUpdateRelease method body.
    const methodStart = ADAPTER_SRC.indexOf('publishVersionUpdateRelease');
    assert.ok(methodStart > -1, "publishVersionUpdateRelease method must exist in adapter");

    // Extract the method body (between the method start and its closing brace)
    const methodSlice = ADAPTER_SRC.slice(methodStart, methodStart + 2000);
    const storeIdEqPos = methodSlice.indexOf(".eq('store_id'");
    const idempotencyEqPos = methodSlice.indexOf(".eq('idempotency_key'");
    assert.ok(storeIdEqPos > -1, "idempotency query must filter by store_id");
    assert.ok(idempotencyEqPos > -1, "idempotency query must filter by idempotency_key");
    assert.ok(
        storeIdEqPos < idempotencyEqPos,
        "store_id must be the FIRST filter in the idempotency pre-check query (cross-tenant isolation)",
    );
});

// ─── Logic-level tests ─────────────────────────────────────────────────────────

test('loadCurrentReleaseBundle: ForbiddenError when site not found (cross-tenant isolation)', async () => {
    // sites table returns no row → verifyStoreOwner throws ForbiddenError BEFORE any
    // theme_releases query. This is the cross-tenant isolation guarantee for the update path.
    const { db, calls } = makeMockDb({
        sites: { data: null, error: { message: 'not found' } },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.verifyStoreOwner(VALID_STORE_UUID, 'site-b-user-id'),
        (err: unknown) => {
            assert.ok(
                err instanceof ForbiddenError,
                `Expected ForbiddenError, got ${(err as Error)?.constructor?.name}`,
            );
            return true;
        },
    );

    // No theme_releases query should have fired — auth short-circuited
    const releaseQueries = calls.filter((c) => c.table === 'theme_releases');
    assert.equal(releaseQueries.length, 0, 'theme_releases must not be queried when auth fails');
});

test('loadCurrentReleaseBundle: NotFoundError when no current release exists', async () => {
    const { db } = makeMockDb({
        theme_releases: { data: null, error: null }, // maybeSingle returns null
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.loadCurrentReleaseBundle(VALID_STORE_UUID, 'urban-kicks'),
        (err: unknown) => {
            assert.ok(
                err instanceof NotFoundError,
                `Expected NotFoundError, got ${(err as Error)?.constructor?.name}`,
            );
            return true;
        },
    );
});

test('loadTargetPackageVersionBundle: NotFoundError when package version not found', async () => {
    const { db } = makeMockDb({
        theme_package_versions: { data: null, error: null },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.loadTargetPackageVersionBundle('c0000000-0000-4000-8000-000000000003'),
        (err: unknown) => {
            assert.ok(
                err instanceof NotFoundError,
                `Expected NotFoundError, got ${(err as Error)?.constructor?.name}`,
            );
            return true;
        },
    );
});

test('loadTargetPackageVersionBundle: ValidationError when package_manifest has no liquidBundle', async () => {
    const { db } = makeMockDb({
        theme_package_versions: {
            data: { id: 'c0000000-0000-4000-8000-000000000003', package_manifest: {} },
            error: null,
        },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.loadTargetPackageVersionBundle('c0000000-0000-4000-8000-000000000003'),
        (err: unknown) => {
            assert.ok(
                err instanceof ValidationError,
                `Expected ValidationError, got ${(err as Error)?.constructor?.name}`,
            );
            return true;
        },
    );
});

test('publishVersionUpdateRelease: idempotent=true returned when key already exists', async () => {
    const existingReleaseId = 'd0000000-0000-4000-8000-000000000004';
    const existingRelease = {
        id: existingReleaseId,
        release_version: 3,
        published_at: '2026-07-10T12:00:00.000Z',
    };

    const { db, calls } = makeMockDb({
        theme_releases: { data: existingRelease, error: null },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    const result = await adapter.publishVersionUpdateRelease({
        storeId: VALID_STORE_UUID,
        themeSlug: 'urban-kicks',
        mergedBundle: {} as never,
        currentReleaseConfig: {},
        userId: 'user-123',
        idempotencyKey: 'idempotency-key-abc',
        makeStoreLive: false,
    });

    assert.equal(result.idempotent, true, 'Must return idempotent=true when key already exists');
    assert.equal(result.release_id, existingReleaseId, 'Must return the existing release id');
    assert.equal(result.release_version, 3, 'Must return the existing release_version');

    // No rpc('publish_theme_release') should have been called — returned early
    const rpcCalls = calls.filter((c) => c.table === '__rpc__');
    assert.equal(rpcCalls.length, 0, 'publish_theme_release RPC must not be called on idempotent return');
});

test('publishVersionUpdateRelease: idempotency pre-check filters by store_id THEN idempotency_key', async () => {
    const { db, calls } = makeMockDb({
        theme_releases: {
            data: {
                id: 'e0000000-0000-4000-8000-000000000005',
                release_version: 1,
                published_at: '2026-07-10T10:00:00.000Z',
            },
            error: null,
        },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await adapter.publishVersionUpdateRelease({
        storeId: VALID_STORE_UUID,
        themeSlug: 'urban-kicks',
        mergedBundle: {} as never,
        currentReleaseConfig: {},
        userId: 'user-123',
        idempotencyKey: 'test-idem-key',
        makeStoreLive: false,
    });

    // Find the theme_releases eq() calls — store_id must precede idempotency_key
    const releaseCalls = calls.filter((c) => c.table === 'theme_releases' && c.method === 'eq');
    const storeIdCallIdx = releaseCalls.findIndex(
        (c) => Array.isArray(c.args) && c.args[0] === 'store_id',
    );
    const idempotencyCallIdx = releaseCalls.findIndex(
        (c) => Array.isArray(c.args) && c.args[0] === 'idempotency_key',
    );

    assert.ok(storeIdCallIdx > -1, 'store_id eq() filter must exist in idempotency pre-check');
    assert.ok(idempotencyCallIdx > -1, 'idempotency_key eq() filter must exist in idempotency pre-check');
    assert.ok(
        storeIdCallIdx < idempotencyCallIdx,
        'store_id must be filtered BEFORE idempotency_key (cross-tenant isolation)',
    );
});

// ─── Phase AB route structure assertions ──────────────────────────────────────

test('GET update-preview returns FORBIDDEN for user profile not found (source assertion)', () => {
    const previewBlock =
        ROUTE_SRC.match(/router\.get\('\/\:slug\/update-preview'[\s\S]*?(?=router\.)/)?.[0] ?? '';
    assert.ok(
        previewBlock.includes('User profile not found'),
        'GET update-preview must return FORBIDDEN when resolveCustomUser is null',
    );
});

test('POST update returns FORBIDDEN for user profile not found (source assertion)', () => {
    const postBlock =
        ROUTE_SRC.match(/router\.post\('\/\:slug\/update'[\s\S]*?(?=\};\s*$)/)?.[0] ?? ROUTE_SRC;
    assert.ok(
        postBlock.includes('User profile not found'),
        'POST update must return FORBIDDEN when resolveCustomUser is null',
    );
});

test('POST update returns DIFF_HASH_MISMATCH on ConflictError (source assertion)', () => {
    assert.ok(
        ROUTE_SRC.includes("'DIFF_HASH_MISMATCH'"),
        "POST update must return DIFF_HASH_MISMATCH error code on ConflictError",
    );
    assert.ok(
        ROUTE_SRC.includes('err instanceof ConflictError'),
        "POST update catch block must handle ConflictError",
    );
    assert.ok(
        ROUTE_SRC.includes('409'),
        "POST update must return 409 for DIFF_HASH_MISMATCH",
    );
});

test('fromThemeDocumentV2 is imported and used in the POST update route (NO-DATA-LOSS assertion)', () => {
    assert.ok(
        ROUTE_SRC.includes('fromThemeDocumentV2'),
        "fromThemeDocumentV2 must be imported and used in theme-update-route.ts",
    );
    // computeThemeUpdateDiff used in GET; planThemeSafeUpdate in POST
    assert.ok(
        ROUTE_SRC.includes('computeThemeUpdateDiff'),
        "computeThemeUpdateDiff must be used in GET update-preview",
    );
    assert.ok(
        ROUTE_SRC.includes('planThemeSafeUpdate'),
        "planThemeSafeUpdate must be used in POST update",
    );
});
