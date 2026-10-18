/** Adapter contracts with mocked transport, plus preserved rollback/migration guards.
 * Real concurrent mutations, tenant/staff authorization, replay and transactional
 * audit/outbox/receipt faults are exercised by owned-db/theme-draft-cas.postgres.test.ts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

import { isStaleThemeEditorBaseVersion } from '../execution/theme-execution.adapter';
import { ConflictError, ForbiddenError, ValidationError } from '../lib/errors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal chainable Supabase query builder mock. */
type MockResult = { data: unknown; error: unknown };

function makeChain(result: MockResult): Record<string, unknown> {
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    const methods = [
        'select', 'eq', 'or', 'is', 'neq', 'update', 'insert', 'upsert', 'delete',
        'order', 'limit', 'maybeSingle', 'single', 'rpc',
    ];
    for (const m of methods) {
        chain[m] = (..._args: unknown[]) => {
            if (m === 'single' || m === 'maybeSingle') return Promise.resolve(result);
            return chain;
        };
    }
    return chain;
}

/**
 * Minimal SupabaseClient mock. `tableResults` maps table name → MockResult.
 * All method calls are captured in `calls` for spy assertions.
 */
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
            return Promise.resolve({ data: null, error: { message: 'Could not find the function publish_theme_release' } });
        },
    };

    return { db, calls };
}

// ─── Source paths ──────────────────────────────────────────────────────────────

const ADAPTER_SRC = readFileSync(
    path.resolve(__dirname, '../execution/theme-execution.adapter.ts'),
    'utf8',
);
const ROUTES_SRC = readFileSync(
    path.resolve(__dirname, '../routes/themes.ts'),
    'utf8',
);
const MIGRATION_SRC = readFileSync(
    path.resolve(__dirname, '../../../../database/supabase/migrations/189_theme_persistence_idempotency.sql'),
    'utf8',
);
/** Strip SQL line comments (-- to end of line) before pattern-checking migrations. */
function stripSqlLineComments(sql: string): string {
    return sql.replace(/--[^\n]*/g, '');
}

// Use fixed proper UUIDs to satisfy UuidSchema (z.string().uuid()).
// These are deterministic test identifiers; not real store/release data.
const VALID_STORE_UUID = 'a0000000-0000-4000-8000-000000000001';
const VALID_RELEASE_UUID = 'b0000000-0000-4000-8000-000000000002';

// ─── Pure function tests ───────────────────────────────────────────────────────

test('isStaleThemeEditorBaseVersion — current > base returns true (stale)', () => {
    assert.equal(isStaleThemeEditorBaseVersion(5, 3), true);
    assert.equal(isStaleThemeEditorBaseVersion(3, 2), true);
    assert.equal(isStaleThemeEditorBaseVersion(1, 0), true);
});

test('isStaleThemeEditorBaseVersion — future and absent bases conflict; exact bases pass', () => {
    assert.equal(isStaleThemeEditorBaseVersion(3, 5), true);
    assert.equal(isStaleThemeEditorBaseVersion(5, undefined), true);
    assert.equal(isStaleThemeEditorBaseVersion(5, null), true);
    assert.equal(isStaleThemeEditorBaseVersion(3, 3), false);
});

// ─── Cross-tenant isolation — validateDocument ─────────────────────────────────

test('validateDocument: ForbiddenError when Site B merchant calls with Site A store_id', async () => {
    // Return no row from sites table → verifyStoreOwner throws ForbiddenError
    // This happens BEFORE parseThemeDocument is called.
    const { db, calls } = makeMockDb({
        sites: { data: null, error: null },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    const validDoc: Record<string, unknown> = {
        document_version: '2026-07-document-v1',
        bundle_schema_version: '1.0.0',
        package: { name: 'test', slug: 'test', version: '1.0.0', compatibility_range: '>=1.0.0' },
        layout: { theme: { content: 'test' } },
        config: { settings_schema: [], settings_data: { current: {}, presets: {} } },
        renderer: { engine: 'liquid', version: '1.0.0' },
    };

    await assert.rejects(
        () => adapter.validateDocument('urban-kicks', {
            store_id: VALID_STORE_UUID,
            theme_document: validDoc,
        }, 'site-b-user-id'),
        (err: unknown) => {
            assert.ok(err instanceof ForbiddenError, `Expected ForbiddenError, got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );

    // Confirm no theme_releases or any release table was queried (auth short-circuited)
    const releaseQueries = calls.filter(c => c.table === 'theme_releases');
    assert.equal(releaseQueries.length, 0, 'theme_releases must not be queried when auth fails');
});

// These source checks establish route wiring only. They do not certify token
// verification; executable realm/audience/identity gates belong to auth suites.
test('authMiddleware covers validate/publish/rollback routes (wiring only)', () => {
    // themes.ts registers authMiddleware as route-level middleware via router.use()
    // before the route handlers. Confirm all three new routes have their prefix covered.
    assert.ok(
        ROUTES_SRC.includes("router.use('/:slug/validate', authMiddleware)"),
        "authMiddleware must be registered for /:slug/validate — primary HS256 defence",
    );
    assert.ok(
        ROUTES_SRC.includes("router.use('/:slug/publish', authMiddleware)"),
        "authMiddleware must be registered for /:slug/publish — primary HS256 defence",
    );
    // Rollback is under /:slug/releases/:releaseId/rollback — covered by /:slug/releases/*
    assert.ok(
        ROUTES_SRC.includes("router.use('/:slug/releases/*', authMiddleware)") ||
        ROUTES_SRC.includes("router.use('/:slug/releases', authMiddleware)"),
        "authMiddleware must be registered for /:slug/releases/* or /:slug/releases — primary HS256 defence for rollback",
    );
});

// ─── Token rejection — secondary Supabase profile guard ───────────────────────

// Secondary defence: even if a Supabase session passes authMiddleware, the route
// handler calls resolveCustomUser() — if the authenticated Supabase user has no
// matching users_custom profile, the handler returns 403 FORBIDDEN.
// This is the SECONDARY layer; the test is labelled accordingly.
test('secondary defense: unknown Supabase user profile returns 403 (source assertion)', () => {
    // The route handler checks: if (!customUser) return 403 FORBIDDEN
    // Source pattern assertion confirms this guard is present in themes.ts before service.validateDocument
    const validateBlock = ROUTES_SRC.match(/router\.post\('\/\:slug\/validate'[\s\S]*?(?=router\.)/)?.[0] ?? '';
    assert.ok(
        validateBlock.includes('User profile not found'),
        'validate route must return FORBIDDEN when resolveCustomUser is null',
    );
    assert.ok(
        validateBlock.includes('403'),
        'validate route must return HTTP 403 for missing user profile',
    );
    assert.ok(
        validateBlock.indexOf('User profile not found') < validateBlock.indexOf('validateDocument'),
        'FORBIDDEN guard must appear before service.validateDocument call',
    );
});

// ─── Missing store_id fails closed ────────────────────────────────────────────

test('missing store_id body fails with Zod VALIDATION_ERROR (schema-level guard)', async () => {
    const { ValidateThemeDocumentSchema } = await import('../schemas/theme.schema');

    const result = ValidateThemeDocumentSchema.safeParse({
        // store_id intentionally omitted
        theme_document: { document_version: '2026-07-document-v1' },
    });

    assert.equal(result.success, false, 'Zod must reject body without store_id');
    if (!result.success) {
        const issues = result.error.issues;
        const fields = issues.map((e: { path: unknown[] }) => e.path[0]);
        assert.ok(fields.includes('store_id'), 'Zod error must identify store_id as missing');
    }
});

// ─── Invalid ThemeDocument V2 structure ───────────────────────────────────────

test('validateDocument: invalid V2 structure throws before any DB write (spy confirms 0 insert/update)', async () => {
    let insertCalled = false;
    let updateCalled = false;

    const trackingDb = {
        from: (table: string) => {
            if (table === 'sites') {
                // Return a valid store so verifyStoreOwner passes
                return makeChain({ data: { id: 'store-1', user_id: 'user-1', custom_user_id: 'user-1' }, error: null });
            }
            // Track any write attempt on any other table
            const chain = makeChain({ data: null, error: null });
            const origInsert = chain.insert as (...a: unknown[]) => unknown;
            chain.insert = (...a: unknown[]) => { insertCalled = true; return origInsert(...a); };
            const origUpdate = chain.update as (...a: unknown[]) => unknown;
            chain.update = (...a: unknown[]) => { updateCalled = true; return origUpdate(...a); };
            return chain;
        },
        rpc: (_fn: string, _args: unknown) => Promise.resolve({ data: null, error: null }),
    };

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(trackingDb as never);

    // theme_document is missing required fields (bundle_schema_version, package, layout, renderer)
    await assert.rejects(
        () => adapter.validateDocument('urban-kicks', {
            store_id: 'store-1',
            theme_document: { document_version: '2026-07-document-v1' },
        }, 'user-1'),
        // parseThemeDocument throws a Zod error (not ValidationError from our lib, but an Error)
        (err: unknown) => {
            assert.ok(err instanceof Error, `Expected Error from parseThemeDocument, got ${typeof err}`);
            return true;
        },
    );

    assert.equal(insertCalled, false, 'insert must not be called when ThemeDocument is invalid');
    assert.equal(updateCalled, false, 'update must not be called when ThemeDocument is invalid');
});

// Publication replay and conflict are resolved by the same database mutation.
// No application pre-check may return a receipt before current authorization.
function publicationTransport(options: { deniedRead?: boolean; newerDraft?: boolean; mutationError?: { code: string; message: string } } = {}) {
    const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
    const receipt = { version: 2, current_version: 8, replayed: true, template_key: 'index',
        published_at: '2026-01-01T00:00:00Z',
        store: { id: VALID_STORE_UUID, status: 'published', theme_id: 'urban-kicks' },
        theme: { id: VALID_RELEASE_UUID, slug: 'urban-kicks', name: 'Urban Kicks' },
        release: { release_id: VALID_RELEASE_UUID, release_version: 1, published_at: '2026-01-01T00:00:00Z' } };
    const db = {
        from(table: string) {
            assert.equal(table, 'themes', 'publication must not read/write release, receipt, audit or draft tables directly');
            return makeChain({ data: { id: 'theme-1', slug: 'urban-kicks', name: 'Urban Kicks', is_active: true }, error: null });
        },
        async rpc(name: string, params: Record<string, unknown>) {
            rpcCalls.push({ name, params });
            if (name === 'read_owned_theme_draft_v1') return options.deniedRead
                ? { data: null, error: { code: '42501', message: 'denied' } }
                : { data: { version: 8, store: { id: VALID_STORE_UUID }, has_draft: Boolean(options.newerDraft),
                    theme_instance_draft_id: options.newerDraft ? VALID_RELEASE_UUID : null,
                    template_config: options.newerDraft ? { themeId: 'urban-kicks', sections: { template: [] } } : null }, error: null };
            assert.equal(name, 'mutate_owned_theme_draft_v1');
            return { data: options.mutationError ? null : receipt, error: options.mutationError || null };
        },
    };
    return { db, rpcCalls, receipt };
}
const publishIntent = { store_id: VALID_STORE_UUID, template_key: 'index', base_version: 1,
    idempotency_key: 'accepted-publish-intent', make_store_live: true };

test('publish retries reach the canonical receipt after the active draft has been cleared', async () => {
    const { db, rpcCalls, receipt } = publicationTransport();
    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const result = await new ThemeExecutionAdapter(db as never, VALID_STORE_UUID)
        .publish('urban-kicks', publishIntent, 'actor-1', 'request-1');
    assert.deepEqual(result, receipt);
    assert.deepEqual(rpcCalls.map(c => c.name), ['read_owned_theme_draft_v1', 'mutate_owned_theme_draft_v1']);
    assert.deepEqual(rpcCalls[1].params, {
        p_actor_id: 'actor-1', p_store_id: VALID_STORE_UUID, p_theme_slug: 'urban-kicks', p_template_key: 'index',
        p_base_version: 1, p_key: 'accepted-publish-intent', p_operation: 'publish', p_config: null, p_runtime: {},
        p_bound_site_id: VALID_STORE_UUID, p_request_id: 'request-1',
        p_publish_options: { publish_message: null, make_store_live: true },
    });
});

test('publish denied by current actor/site authorization cannot reach a receipt or mutation', async () => {
    const { db, rpcCalls } = publicationTransport({ deniedRead: true });
    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    await assert.rejects(() => new ThemeExecutionAdapter(db as never).publish('urban-kicks', publishIntent, 'revoked-actor'), ForbiddenError);
    assert.equal(rpcCalls.length, 1);
});

test('publish receipt recovery does not validate or consume a different newer draft', async () => {
    const { db, rpcCalls, receipt } = publicationTransport({ newerDraft: true });
    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    assert.deepEqual(await new ThemeExecutionAdapter(db as never).publish('urban-kicks', publishIntent, 'actor-1'), receipt);
    assert.deepEqual(rpcCalls[1].params.p_runtime, {});
    assert.equal(rpcCalls[1].params.p_base_version, 1);
});

test('publish stale intent is rejected by the atomic writer without application-side effects', async () => {
    const { db, rpcCalls } = publicationTransport({ mutationError: { code: 'PT409', message: 'changed' } });
    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    await assert.rejects(() => new ThemeExecutionAdapter(db as never).publish('urban-kicks', publishIntent, 'actor-1'), ConflictError);
    assert.equal(rpcCalls.length, 2);
    assert.equal(rpcCalls[1].params.p_base_version, 1);
    assert.equal(rpcCalls[1].params.p_key, publishIntent.idempotency_key);
});

test('publish transaction infrastructure failure returns unavailable, never a fabricated release', async () => {
    const { db } = publicationTransport({ mutationError: { code: 'PGRST202', message: 'function unavailable' } });
    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    await assert.rejects(() => new ThemeExecutionAdapter(db as never).publish('urban-kicks', publishIntent, 'actor-1'),
        (error: unknown) => (error as { statusCode: number }).statusCode === 503);
});

// ─── Rollback CAS guard — mismatch ───────────────────────────────────────────

test('rollbackRelease: ConflictError when expected_current_release_id does not match actual current', async () => {
    let rpcCalled = false;

    const mockDb = {
        from: (table: string) => {
            if (table === 'sites') {
                return makeChain({ data: { id: 'store-1', user_id: 'user-1', custom_user_id: null }, error: null });
            }
            if (table === 'themes') {
                return makeChain({ data: { id: 'theme-1', slug: 'urban-kicks', name: 'Urban Kicks', is_active: true }, error: null });
            }
            if (table === 'theme_releases') {
                // is_current row returns id='release-X' but caller expects 'release-Y'
                return makeChain({ data: { id: 'release-X', store_id: 'store-1', release_version: 4 }, error: null });
            }
            return makeChain({ data: null, error: null });
        },
        rpc: (_fn: string, _args: unknown) => {
            rpcCalled = true;
            return Promise.resolve({ data: null, error: null });
        },
    };

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(mockDb as never);

    await assert.rejects(
        () => adapter.rollbackRelease('urban-kicks', 'release-old-123', {
            store_id: 'store-1',
            make_store_live: true,
            expected_current_release_id: 'release-Y', // mismatch — actual is 'release-X'
        }, 'user-1'),
        (err: unknown) => {
            assert.ok(err instanceof ConflictError, `Expected ConflictError, got ${(err as Error)?.constructor?.name}`);
            assert.ok(
                (err as Error).message.includes('Current release has changed since listing'),
                `Expected 'Current release has changed since listing', got: ${(err as Error).message}`,
            );
            return true;
        },
    );

    assert.equal(rpcCalled, false, 'RPC must NOT be called when CAS check fails');
});

// ─── Rollback CAS guard — match proceeds ──────────────────────────────────────

test('rollbackRelease: proceeds without ConflictError when expected_current_release_id matches', async () => {
    // When the CAS check passes, execution continues into the release fetch.
    // We mock the release fetch to return NotFoundError to stop there (sufficient to prove CAS passed).
    const mockDb = {
        from: (table: string) => {
            if (table === 'sites') {
                return makeChain({ data: { id: 'store-1', user_id: 'user-1', custom_user_id: null }, error: null });
            }
            if (table === 'themes') {
                return makeChain({ data: { id: 'theme-1', slug: 'urban-kicks', name: 'Urban Kicks', is_active: true }, error: null });
            }
            if (table === 'theme_releases') {
                // Both the CAS query and the release fetch hit theme_releases.
                // Return {id: 'release-Z'} — matches expected AND serves as the release record.
                return makeChain({
                    data: {
                        id: 'release-Z',
                        store_id: 'store-1',
                        theme_id: 'urban-kicks',
                        release_version: 4,
                        release_config: {},
                        template_snapshot: {},
                        settings_snapshot: {},
                        release_manifest: {},
                        published_at: '2026-01-01T00:00:00Z',
                    },
                    error: null,
                });
            }
            return makeChain({ data: null, error: null });
        },
        rpc: (_fn: string, _args: unknown) => {
            // RPC fails → publishReleaseSnapshotFallback takes over — that's fine for this test
            return Promise.resolve({ data: null, error: { message: 'Could not find the function publish_theme_release' } });
        },
    };

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(mockDb as never);

    // Should NOT throw ConflictError (it may throw something else down the stack — we only care
    // that the CAS check itself did not block execution).
    try {
        await adapter.rollbackRelease('urban-kicks', 'release-Z', {
            store_id: 'store-1',
            make_store_live: true,
            expected_current_release_id: 'release-Z', // match
        }, 'user-1');
    } catch (err) {
        // Anything other than ConflictError is acceptable — the CAS passed
        assert.ok(
            !(err instanceof ConflictError),
            `CAS match must not produce ConflictError — got: ${(err as Error)?.message}`,
        );
    }
});

// ─── Rollback CAS cross-tenant scope (source pattern assertion) ───────────────

test('rollback CAS guard query: store_id scopes the is_current lookup (cross-tenant safety)', () => {
    const casBlock = ADAPTER_SRC.match(
        /\/\/ CAS guard[\s\S]*?\.maybeSingle\(\)/,
    )?.[0] ?? '';

    assert.ok(casBlock.length > 0, 'CAS guard block must exist in rollbackRelease() source');
    assert.ok(
        casBlock.includes("'store_id'"),
        "CAS query must filter by store_id",
    );
    assert.ok(
        casBlock.includes("'is_current'"),
        "CAS query must filter by is_current",
    );

    const storeIdIdx = casBlock.indexOf("'store_id'");
    const isCurrentIdx = casBlock.indexOf("'is_current'");
    assert.ok(storeIdIdx < isCurrentIdx, "store_id must appear before is_current in the CAS query");
});

// ─── Rollback audit event presence (source pattern assertion) ─────────────────

test('rollbackRelease: emitAuditEvent with action theme.rollback is called in the rollbackRelease() method body', () => {
    const rollbackMethodBlock = ADAPTER_SRC.match(
        /async rollbackRelease\([\s\S]*?(?=\n    async )/,
    )?.[0] ?? '';

    assert.ok(rollbackMethodBlock.length > 0, 'rollbackRelease() method must be found in adapter source');
    assert.ok(
        rollbackMethodBlock.includes('emitAuditEvent'),
        "rollbackRelease() must call emitAuditEvent",
    );
    assert.ok(
        rollbackMethodBlock.includes("'theme.rollback'"),
        "rollbackRelease() emitAuditEvent must use action 'theme.rollback'",
    );
});

// ─── Route placement assertion ─────────────────────────────────────────────────

test('validate route is registered BEFORE the GET /:slug catch-all route in themes.ts', () => {
    const validateIdx = ROUTES_SRC.indexOf("router.post('/:slug/validate'");
    const getSlugIdx = ROUTES_SRC.indexOf("router.get('/:slug'");

    assert.ok(validateIdx !== -1, "POST /:slug/validate route must be registered in themes.ts");
    assert.ok(getSlugIdx !== -1, "GET /:slug route must be present in themes.ts");
    assert.ok(
        validateIdx < getSlugIdx,
        `POST /:slug/validate (at char ${validateIdx}) must appear BEFORE GET /:slug (at char ${getSlugIdx}) to prevent route shadowing`,
    );
});

// ─── Migration safety assertions ──────────────────────────────────────────────

test('migration 189: unique index is scoped to (store_id, idempotency_key) — cross-site collision impossible', () => {
    assert.ok(
        MIGRATION_SRC.includes('store_id, idempotency_key'),
        'CREATE UNIQUE INDEX must be scoped to (store_id, idempotency_key)',
    );
});

test('migration 189: no USING (true) — no public RLS bypass', () => {
    // Strip SQL line comments before checking so comment text cannot false-positive.
    const sqlBody = stripSqlLineComments(MIGRATION_SRC);
    const matches = sqlBody.match(/USING\s*\(?\s*true\s*\)?/gi) ?? [];
    assert.equal(
        matches.length,
        0,
        `migration 189 must not contain USING(true) in executable SQL — found: ${matches.join(', ')}`,
    );
});

test('migration 189: no forbidden DDL (DROP TABLE / DROP COLUMN / RENAME COLUMN / TRUNCATE)', () => {
    // Strip SQL line comments before checking — comments may describe forbidden patterns
    // for documentation purposes and must not trigger the validator.
    const sqlBody = stripSqlLineComments(MIGRATION_SRC);
    assert.ok(!(/\bDROP\s+TABLE\b/i.test(sqlBody)), 'DROP TABLE must not appear in migration 189 executable SQL');
    assert.ok(!(/\bDROP\s+COLUMN\b/i.test(sqlBody)), 'DROP COLUMN must not appear in migration 189 executable SQL');
    assert.ok(!(/\bRENAME\s+COLUMN\b/i.test(sqlBody)), 'RENAME COLUMN must not appear in migration 189 executable SQL');
    assert.ok(!(/\bTRUNCATE\b/i.test(sqlBody)), 'TRUNCATE must not appear in migration 189 executable SQL');
});

test('migration 189: ADD COLUMN uses IF NOT EXISTS (idempotent re-run safe)', () => {
    assert.ok(
        /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i.test(MIGRATION_SRC),
        'ADD COLUMN must use IF NOT EXISTS for idempotent re-run safety',
    );
});

test('migration 189: CREATE UNIQUE INDEX uses IF NOT EXISTS (idempotent re-run safe)', () => {
    assert.ok(
        /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS/i.test(MIGRATION_SRC),
        'CREATE UNIQUE INDEX must use IF NOT EXISTS for idempotent re-run safety',
    );
});

// ─── Schema field presence assertions ─────────────────────────────────────────

test('PublishThemeSchema requires the explicit saved version and stable intent key', async () => {
    const { PublishThemeSchema } = await import('../schemas/theme.schema');
    const valid = { store_id: VALID_STORE_UUID, base_version: 1, idempotency_key: 'publish-key-00000000' };
    assert.equal(PublishThemeSchema.safeParse(valid).success, true);
    for (const invalid of [{ ...valid, base_version: undefined }, { ...valid, base_version: 0 },
        { ...valid, idempotency_key: undefined }, { ...valid, idempotency_key: 'short' }]) {
        assert.equal(PublishThemeSchema.safeParse(invalid).success, false);
    }
});

test('RollbackThemeReleaseSchema contains optional expected_current_release_id (UUID) field', async () => {
    const { RollbackThemeReleaseSchema } = await import('../schemas/theme.schema');

    const withoutCas = RollbackThemeReleaseSchema.safeParse({
        store_id: VALID_STORE_UUID,
    });
    assert.equal(withoutCas.success, true, 'RollbackThemeReleaseSchema must accept body without expected_current_release_id');

    const withCas = RollbackThemeReleaseSchema.safeParse({
        store_id: VALID_STORE_UUID,
        expected_current_release_id: VALID_RELEASE_UUID,
    });
    assert.equal(withCas.success, true, 'RollbackThemeReleaseSchema must accept a valid UUID for expected_current_release_id');

    const invalidUuid = RollbackThemeReleaseSchema.safeParse({
        store_id: VALID_STORE_UUID,
        expected_current_release_id: 'not-a-uuid',
    });
    assert.equal(invalidUuid.success, false, 'RollbackThemeReleaseSchema must reject a non-UUID string for expected_current_release_id');
});

test('ValidateThemeDocumentSchema is exported and enforces store_id + theme_document presence', async () => {
    const { ValidateThemeDocumentSchema } = await import('../schemas/theme.schema');

    const valid = ValidateThemeDocumentSchema.safeParse({
        store_id: VALID_STORE_UUID,
        theme_document: { document_version: '2026-07-document-v1' },
    });
    assert.equal(valid.success, true, 'ValidateThemeDocumentSchema must accept valid body');

    const missingDoc = ValidateThemeDocumentSchema.safeParse({
        store_id: VALID_STORE_UUID,
    });
    assert.equal(missingDoc.success, false, 'ValidateThemeDocumentSchema must reject body without theme_document');
});

test('publication persistence and renderer enrichment share the canonical transaction', () => {
    const sql = readFileSync(path.resolve(__dirname, '../../../../database/supabase/migrations/344_atomic_theme_draft_cas.sql'), 'utf8');
    assert.match(sql, /public\.publish_theme_release/);
    assert.match(sql, /UPDATE public\.theme_releases SET release_manifest/);
    assert.match(sql, /INSERT INTO public\.audit_activity_events/);
    assert.match(sql, /INSERT INTO public\.idempotency_keys/);
    const publish = ADAPTER_SRC.slice(ADAPTER_SRC.indexOf('    async publish('), ADAPTER_SRC.indexOf('    async listReleases('));
    assert.doesNotMatch(publish, /\.from\(/);
});


test('save receipt recovery bypasses mutable runtime validation for an already-advanced base without permitting a new write', async () => {
    const at = '2026-01-01T00:00:00Z';
    const receipt = { version: 2, current_version: 8, replayed: true, saved_at: at,
        draft: { id: VALID_RELEASE_UUID, version: 2, auto_saved_at: at } };
    const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
    const db = {
        from(table: string) {
            assert.equal(table, 'themes', 'a stale receipt lookup must not resolve or validate against a different current runtime');
            return makeChain({ data: { id: VALID_RELEASE_UUID, slug: 'urban-kicks', name: 'Urban Kicks', is_active: true }, error: null });
        },
        async rpc(name: string, params: Record<string, unknown>) {
            calls.push({ name, params });
            if (name === 'read_owned_theme_draft_v1') return { data: { version: 8, store: { id: VALID_STORE_UUID }, has_draft: false }, error: null };
            assert.equal(name, 'mutate_owned_theme_draft_v1'); return { data: receipt, error: null };
        },
    };
    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const result = await new ThemeExecutionAdapter(db as never).saveDraft('urban-kicks', {
        store_id: VALID_STORE_UUID, template_key: 'index', base_version: 1, idempotency_key: 'accepted-old-runtime-intent', client: 'api',
        template_config: { themeId: 'urban-kicks', sections: { template: [{ id: 'old-section', type: 'old-runtime-section', settings: {} }] } },
    }, 'actor-1');
    assert.deepEqual(result, receipt); assert.deepEqual(calls[1].params.p_runtime, {});
    assert.equal(calls[1].params.p_base_version, 1); assert.equal(calls[1].params.p_key, 'accepted-old-runtime-intent');
});
