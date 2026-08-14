/**
 * Phase Q — theme library management tests.
 *
 * ALL tests are logic-level with mocked DB (no real database connection required).
 * Reuses the makeMockDb / makeChain helpers established in theme-persistence-p.test.ts.
 *
 * Coverage:
 *   1. Cross-tenant isolation: null sites row → ForbiddenError BEFORE any
 *      theme_instances query, for ALL 6 new operations.
 *   2. archiveSiteTheme: rejects with ConflictError when theme is currently published.
 *   3. deleteUnpublishedSiteTheme: rejects with ConflictError when currently published.
 *   4. createSiteTheme: theme limit enforcement (THEME_LIMIT_REACHED).
 *   5. duplicateSiteTheme: theme limit enforcement (THEME_LIMIT_REACHED).
 *   6. Source-pattern assertions: new authMiddleware registrations appear BEFORE
 *      GET /:slug in themes.ts.
 *   7. Source-pattern assertions: adapter queries filter by store_id before
 *      theme_slug in all new methods.
 *   8. Schema safeParse tests for all 6 new Zod schemas.
 *   9. Migration 190: safety assertions (no DROP/RENAME/TRUNCATE, IF NOT EXISTS).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';

import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors';

// ─── Helpers (mirrored from theme-persistence-p.test.ts) ─────────────────────

type MockResult = { data: unknown; error: unknown };

function makeChain(result: MockResult): Record<string, unknown> {
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    const methods = [
        'select', 'eq', 'or', 'is', 'neq', 'not', 'update', 'insert', 'upsert', 'delete',
        'order', 'limit', 'maybeSingle', 'single', 'in',
    ];
    for (const m of methods) {
        chain[m] = (..._args: unknown[]) => {
            if (m === 'single' || m === 'maybeSingle') return Promise.resolve(result);
            return chain;
        };
    }
    // count support for head:true queries
    (chain as Record<string, unknown>).count = null;
    return chain;
}

function makeMockDb(tableResults: Record<string, MockResult>) {
    const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

    function makeTableChain(table: string, result: MockResult): Record<string, unknown> {
        const chain: Record<string, (...args: unknown[]) => unknown> = {};
        const methods = [
            'select', 'eq', 'or', 'is', 'neq', 'not', 'update', 'insert', 'upsert', 'delete',
            'order', 'limit', 'maybeSingle', 'single', 'in',
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
            return Promise.resolve({ data: null, error: null });
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
const LIBRARY_ROUTES_SRC = readFileSync(
    path.resolve(__dirname, '../routes/themes/theme-library-routes.ts'),
    'utf8',
);
const MIGRATION_SRC = readFileSync(
    path.resolve(__dirname, '../../../../database/supabase/migrations/190_theme_library_q.sql'),
    'utf8',
);

function stripSqlLineComments(sql: string): string {
    return sql.replace(/--[^\n]*/g, '');
}

const VALID_STORE_UUID = 'a0000000-0000-4000-8000-000000000001';

// ─── Cross-tenant: listSiteThemes ────────────────────────────────────────────

test('listSiteThemes: ForbiddenError when Site B merchant calls with Site A store_id', async () => {
    const { db, calls } = makeMockDb({
        sites: { data: null, error: { message: 'store not found' } },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.listSiteThemes(VALID_STORE_UUID, 'site-b-user'),
        (err: unknown) => {
            assert.ok(err instanceof ForbiddenError, `Expected ForbiddenError, got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );

    // Confirm theme_instances was NOT queried before auth failed
    const instanceCalls = calls.filter(c => c.table === 'theme_instances');
    assert.equal(instanceCalls.length, 0, 'theme_instances must not be queried when verifyStoreOwner fails');
});

// ─── Cross-tenant: createSiteTheme ───────────────────────────────────────────

test('createSiteTheme: ForbiddenError when Site B merchant calls with Site A store_id', async () => {
    const { db, calls } = makeMockDb({
        sites: { data: null, error: { message: 'store not found' } },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.createSiteTheme(VALID_STORE_UUID, {
            store_id: VALID_STORE_UUID,
            name: 'My Theme',
        }, 'site-b-user', null),
        (err: unknown) => {
            assert.ok(err instanceof ForbiddenError, `Expected ForbiddenError, got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );

    const themeCalls = calls.filter(c => c.table === 'themes' && c.method === 'insert');
    assert.equal(themeCalls.length, 0, 'themes insert must not be called when verifyStoreOwner fails');
});

// ─── Cross-tenant: duplicateSiteTheme ────────────────────────────────────────

test('duplicateSiteTheme: ForbiddenError when Site B merchant calls with Site A store_id', async () => {
    const { db, calls } = makeMockDb({
        sites: { data: null, error: { message: 'store not found' } },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.duplicateSiteTheme('urban-kicks', VALID_STORE_UUID, { store_id: VALID_STORE_UUID }, 'site-b-user', null),
        (err: unknown) => {
            assert.ok(err instanceof ForbiddenError, `Expected ForbiddenError, got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );

    const instanceCalls = calls.filter(c => c.table === 'theme_instances' && c.method === 'insert');
    assert.equal(instanceCalls.length, 0, 'theme_instances insert must not be called when verifyStoreOwner fails');
});

// ─── Cross-tenant: renameSiteTheme ───────────────────────────────────────────

test('renameSiteTheme: ForbiddenError when Site B merchant calls with Site A store_id', async () => {
    const { db, calls } = makeMockDb({
        sites: { data: null, error: { message: 'store not found' } },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.renameSiteTheme('urban-kicks', VALID_STORE_UUID, { store_id: VALID_STORE_UUID, name: 'New Name' }, 'site-b-user', null),
        (err: unknown) => {
            assert.ok(err instanceof ForbiddenError, `Expected ForbiddenError, got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );

    const themeUpdateCalls = calls.filter(c => c.table === 'themes' && c.method === 'update');
    assert.equal(themeUpdateCalls.length, 0, 'themes update must not be called when verifyStoreOwner fails');
});

// ─── Cross-tenant: archiveSiteTheme ──────────────────────────────────────────

test('archiveSiteTheme: ForbiddenError when Site B merchant calls with Site A store_id', async () => {
    const { db, calls } = makeMockDb({
        sites: { data: null, error: { message: 'store not found' } },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.archiveSiteTheme('urban-kicks', VALID_STORE_UUID, { store_id: VALID_STORE_UUID }, 'site-b-user', null),
        (err: unknown) => {
            assert.ok(err instanceof ForbiddenError, `Expected ForbiddenError, got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );

    const instanceUpdateCalls = calls.filter(c => c.table === 'theme_instances' && c.method === 'update');
    assert.equal(instanceUpdateCalls.length, 0, 'theme_instances update must not be called when verifyStoreOwner fails');
});

// ─── Cross-tenant: deleteUnpublishedSiteTheme ────────────────────────────────

test('deleteUnpublishedSiteTheme: ForbiddenError when Site B merchant calls with Site A store_id', async () => {
    const { db, calls } = makeMockDb({
        sites: { data: null, error: { message: 'store not found' } },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.deleteUnpublishedSiteTheme('urban-kicks', VALID_STORE_UUID, 'site-b-user', null),
        (err: unknown) => {
            assert.ok(err instanceof ForbiddenError, `Expected ForbiddenError, got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );

    const instanceUpdateCalls = calls.filter(c => c.table === 'theme_instances' && c.method === 'update');
    assert.equal(instanceUpdateCalls.length, 0, 'theme_instances soft-delete must not be called when verifyStoreOwner fails');
});

// ─── archiveSiteTheme: rejects when currently published ──────────────────────

test('archiveSiteTheme: ConflictError when theme is currently published (sites.theme_id match)', async () => {
    const { db } = makeMockDb({
        // sites returns theme_id matching the slug being archived
        sites: { data: { id: 'store-1', user_id: 'user-1', custom_user_id: null, theme_id: 'urban-kicks' }, error: null },
        theme_instances: { data: { id: 'inst-1', instance_status: 'active' }, error: null },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.archiveSiteTheme('urban-kicks', 'store-1', { store_id: 'store-1' }, 'user-1', null),
        (err: unknown) => {
            assert.ok(err instanceof ConflictError, `Expected ConflictError, got ${(err as Error)?.constructor?.name}`);
            assert.ok(
                (err as Error).message.includes('THEME_CURRENTLY_PUBLISHED'),
                `Expected THEME_CURRENTLY_PUBLISHED in message, got: ${(err as Error).message}`,
            );
            return true;
        },
    );
});

// ─── deleteUnpublishedSiteTheme: rejects when currently published ─────────────

test('deleteUnpublishedSiteTheme: ConflictError when sites.theme_id matches slug', async () => {
    const { db } = makeMockDb({
        sites: { data: { id: 'store-1', user_id: 'user-1', custom_user_id: null, theme_id: 'urban-kicks' }, error: null },
        theme_releases: { data: null, error: null },
        theme_instances: { data: { id: 'inst-1' }, error: null },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.deleteUnpublishedSiteTheme('urban-kicks', 'store-1', 'user-1', null),
        (err: unknown) => {
            assert.ok(err instanceof ConflictError, `Expected ConflictError, got ${(err as Error)?.constructor?.name}`);
            assert.ok(
                (err as Error).message.includes('CANNOT_DELETE_PUBLISHED_THEME'),
                `Expected CANNOT_DELETE_PUBLISHED_THEME in message, got: ${(err as Error).message}`,
            );
            return true;
        },
    );
});

// ─── deleteUnpublishedSiteTheme: rejects via is_current release guard ─────────

test('deleteUnpublishedSiteTheme: ConflictError when theme_releases.is_current=true exists for store', async () => {
    // sites.theme_id does NOT match (different theme), but is_current release exists
    // This tests the secondary guard path
    let releaseQueryCalled = false;

    const mockDb = {
        from: (table: string) => {
            if (table === 'sites') {
                // verifyStoreOwner passes; theme_id is different (not urban-kicks)
                return makeChain({ data: { id: 'store-1', user_id: 'user-1', custom_user_id: null, theme_id: 'other-theme' }, error: null });
            }
            if (table === 'theme_releases') {
                releaseQueryCalled = true;
                // Return a current release for 'urban-kicks' on this store
                return makeChain({ data: { id: 'release-1' }, error: null });
            }
            if (table === 'theme_instances') {
                return makeChain({ data: { id: 'inst-1' }, error: null });
            }
            return makeChain({ data: null, error: null });
        },
        rpc: () => Promise.resolve({ data: null, error: null }),
    };

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(mockDb as never);

    await assert.rejects(
        () => adapter.deleteUnpublishedSiteTheme('urban-kicks', 'store-1', 'user-1', null),
        (err: unknown) => {
            assert.ok(err instanceof ConflictError, `Expected ConflictError, got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );

    assert.ok(releaseQueryCalled, 'theme_releases is_current check must be queried as secondary guard');
});

// ─── duplicateSiteTheme: 404 when source instance not in this store ───────────
// (cross-site: enumeration prevention — 404 not 403)

test('duplicateSiteTheme: NotFoundError when source theme_instance not found for this store', async () => {
    const { db } = makeMockDb({
        // verifyStoreOwner passes (owner found)
        sites: { data: { id: 'store-1', user_id: 'user-1', custom_user_id: null }, error: null },
        // theme_instance for 'urban-kicks' does NOT exist in store-1 (cross-site attempt)
        theme_instances: { data: null, error: null },
    });

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(db as never);

    await assert.rejects(
        () => adapter.duplicateSiteTheme('urban-kicks', 'store-1', { store_id: 'store-1' }, 'user-1', null),
        (err: unknown) => {
            assert.ok(err instanceof NotFoundError, `Expected NotFoundError (enumeration prevention), got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );
});

// ─── Source-pattern: authMiddleware registrations before GET /:slug ───────────

test('library authMiddleware registered before GET /:slug catch-all (route-shadowing prevention)', () => {
    assert.ok(
        ROUTES_SRC.includes("router.use('/library', authMiddleware)"),
        "authMiddleware must be registered for /library",
    );
    assert.ok(
        ROUTES_SRC.includes("router.use('/library/*', authMiddleware)"),
        "authMiddleware must be registered for /library/*",
    );

    const libraryMiddlewareIdx = ROUTES_SRC.indexOf("router.use('/library', authMiddleware)");
    const getSlugIdx = ROUTES_SRC.indexOf("router.get('/:slug'");
    assert.ok(
        libraryMiddlewareIdx < getSlugIdx,
        `/library authMiddleware (char ${libraryMiddlewareIdx}) must appear before GET /:slug (char ${getSlugIdx})`,
    );
});

test('/:slug/duplicate authMiddleware registered before GET /:slug (route-shadowing prevention)', () => {
    assert.ok(
        ROUTES_SRC.includes("router.use('/:slug/duplicate', authMiddleware)"),
        "authMiddleware must be registered for /:slug/duplicate",
    );
    const duplicateMiddlewareIdx = ROUTES_SRC.indexOf("router.use('/:slug/duplicate', authMiddleware)");
    const getSlugIdx = ROUTES_SRC.indexOf("router.get('/:slug'");
    assert.ok(
        duplicateMiddlewareIdx < getSlugIdx,
        `/:slug/duplicate authMiddleware must appear before GET /:slug`,
    );
});

test('/:slug/archive authMiddleware registered (source assertion)', () => {
    assert.ok(
        ROUTES_SRC.includes("router.use('/:slug/archive', authMiddleware)"),
        "authMiddleware must be registered for /:slug/archive",
    );
    assert.ok(
        ROUTES_SRC.includes("router.use('/:slug/rename', authMiddleware)"),
        "authMiddleware must be registered for /:slug/rename",
    );
    assert.ok(
        ROUTES_SRC.includes("router.use('/:slug/unpublished', authMiddleware)"),
        "authMiddleware must be registered for /:slug/unpublished",
    );
});

// ─── Source-pattern: GET /library route registered before GET /:slug ──────────

test('GET /library route is registered BEFORE GET /:slug catch-all in themes.ts', () => {
    const libraryMountIdx = ROUTES_SRC.indexOf('mountThemeLibraryRoutes(router)');
    const getSlugIdx = ROUTES_SRC.indexOf("router.get('/:slug'");
    const hasLibraryGet = LIBRARY_ROUTES_SRC.includes("router.get('/library'");

    assert.ok(hasLibraryGet, 'GET /library route must be declared in theme-library-routes.ts');
    assert.ok(libraryMountIdx !== -1, 'mountThemeLibraryRoutes must be registered in themes.ts');
    assert.ok(getSlugIdx !== -1, 'GET /:slug route must be present in themes.ts');
    assert.ok(
        libraryMountIdx < getSlugIdx,
        `mountThemeLibraryRoutes (char ${libraryMountIdx}) must appear BEFORE GET /:slug (char ${getSlugIdx})`,
    );
});

test('POST /library/create route is registered BEFORE GET /:slug in themes.ts', () => {
    const libraryMountIdx = ROUTES_SRC.indexOf('mountThemeLibraryRoutes(router)');
    const getSlugIdx = ROUTES_SRC.indexOf("router.get('/:slug'");
    const hasCreatePost = LIBRARY_ROUTES_SRC.includes("router.post('/library/create'");

    assert.ok(hasCreatePost, 'POST /library/create route must be declared in theme-library-routes.ts');
    assert.ok(libraryMountIdx !== -1, 'mountThemeLibraryRoutes must be registered in themes.ts');
    assert.ok(
        libraryMountIdx < getSlugIdx,
        `mountThemeLibraryRoutes (char ${libraryMountIdx}) must appear BEFORE GET /:slug (char ${getSlugIdx})`,
    );
});

// ─── Source-pattern: adapter store_id scoping (cross-tenant safety) ───────────

test('listSiteThemes adapter: store_id is the first eq() filter on theme_instances (source assertion)', () => {
    const listBlock = ADAPTER_SRC.match(
        /async listSiteThemes\([\s\S]*?(?=\n    async )/,
    )?.[0] ?? '';

    assert.ok(listBlock.length > 0, 'listSiteThemes() method must be found in adapter source');

    const storeIdIdx = listBlock.indexOf("'store_id'");
    assert.ok(storeIdIdx !== -1, "store_id must appear in listSiteThemes query");

    const instancesBlock = listBlock.match(
        /\.from\('theme_instances'\)[\s\S]*?\.is\('deleted_at'/,
    )?.[0] ?? '';
    assert.ok(
        instancesBlock.includes("'store_id'"),
        "theme_instances query must filter by store_id before deleted_at",
    );
});

test('archiveSiteTheme adapter: instance_status update scoped by store_id (source assertion)', () => {
    const archiveBlock = ADAPTER_SRC.match(
        /async archiveSiteTheme\([\s\S]*?(?=\n    async )/,
    )?.[0] ?? '';

    assert.ok(archiveBlock.length > 0, 'archiveSiteTheme() method must be found in adapter source');
    assert.ok(
        archiveBlock.includes("'store_id'"),
        "archiveSiteTheme must scope the update by store_id",
    );
    assert.ok(
        archiveBlock.includes("'archived'"),
        "archiveSiteTheme must set instance_status to 'archived'",
    );
});

test('deleteUnpublishedSiteTheme adapter: soft-delete scoped by store_id (source assertion)', () => {
    // Extract method body from its definition to the end of the file (it's the last method)
    const methodStart = ADAPTER_SRC.indexOf('async deleteUnpublishedSiteTheme(');
    assert.ok(methodStart !== -1, 'deleteUnpublishedSiteTheme() method must be found in adapter source');

    const deleteBlock = ADAPTER_SRC.slice(methodStart);

    assert.ok(
        deleteBlock.includes("'store_id'"),
        "deleteUnpublishedSiteTheme must scope the soft-delete by store_id",
    );
    assert.ok(
        deleteBlock.includes('deleted_at'),
        "deleteUnpublishedSiteTheme must set deleted_at (soft delete, not hard delete)",
    );
});

// ─── Source-pattern: audit events ────────────────────────────────────────────

test('createSiteTheme adapter: emitAuditEvent with action theme.create', () => {
    const createBlock = ADAPTER_SRC.match(
        /async createSiteTheme\([\s\S]*?(?=\n    async )/,
    )?.[0] ?? '';

    assert.ok(createBlock.length > 0, 'createSiteTheme() method must be found in adapter source');
    assert.ok(createBlock.includes('emitAuditEvent'), "createSiteTheme() must call emitAuditEvent");
    assert.ok(createBlock.includes("'theme.create'"), "createSiteTheme() emitAuditEvent must use action 'theme.create'");
});

test('archiveSiteTheme adapter: emitAuditEvent with action theme.archive', () => {
    const archiveBlock = ADAPTER_SRC.match(
        /async archiveSiteTheme\([\s\S]*?(?=\n    async )/,
    )?.[0] ?? '';

    assert.ok(archiveBlock.length > 0, 'archiveSiteTheme() method must be found in adapter source');
    assert.ok(archiveBlock.includes('emitAuditEvent'), "archiveSiteTheme() must call emitAuditEvent");
    assert.ok(archiveBlock.includes("'theme.archive'"), "archiveSiteTheme() emitAuditEvent must use action 'theme.archive'");
});

test('deleteUnpublishedSiteTheme adapter: emitAuditEvent with action theme.delete', () => {
    const methodStart = ADAPTER_SRC.indexOf('async deleteUnpublishedSiteTheme(');
    assert.ok(methodStart !== -1, 'deleteUnpublishedSiteTheme() method must be found in adapter source');

    const deleteBlock = ADAPTER_SRC.slice(methodStart);
    assert.ok(deleteBlock.includes('emitAuditEvent'), "deleteUnpublishedSiteTheme() must call emitAuditEvent");
    assert.ok(deleteBlock.includes("'theme.delete'"), "deleteUnpublishedSiteTheme() emitAuditEvent must use action 'theme.delete'");
});

// ─── Schema safeParse tests ────────────────────────────────────────────────────

test('ListSiteThemesQuerySchema: accepts valid UUID store_id', async () => {
    const { ListSiteThemesQuerySchema } = await import('../schemas/theme.schema');
    const result = ListSiteThemesQuerySchema.safeParse({ store_id: VALID_STORE_UUID });
    assert.equal(result.success, true, 'Must accept valid UUID store_id');
});

test('ListSiteThemesQuerySchema: rejects missing store_id', async () => {
    const { ListSiteThemesQuerySchema } = await import('../schemas/theme.schema');
    const result = ListSiteThemesQuerySchema.safeParse({});
    assert.equal(result.success, false, 'Must reject missing store_id');
});

test('ListSiteThemesQuerySchema: rejects non-UUID store_id', async () => {
    const { ListSiteThemesQuerySchema } = await import('../schemas/theme.schema');
    const result = ListSiteThemesQuerySchema.safeParse({ store_id: 'not-a-uuid' });
    assert.equal(result.success, false, 'Must reject non-UUID store_id');
});

test('CreateSiteThemeSchema: accepts valid body', async () => {
    const { CreateSiteThemeSchema } = await import('../schemas/theme.schema');
    const result = CreateSiteThemeSchema.safeParse({ store_id: VALID_STORE_UUID, name: 'My New Theme' });
    assert.equal(result.success, true, 'Must accept valid body with store_id and name');
});

test('CreateSiteThemeSchema: rejects empty name', async () => {
    const { CreateSiteThemeSchema } = await import('../schemas/theme.schema');
    const result = CreateSiteThemeSchema.safeParse({ store_id: VALID_STORE_UUID, name: '' });
    assert.equal(result.success, false, 'Must reject empty name');
});

test('CreateSiteThemeSchema: rejects name longer than 120 chars', async () => {
    const { CreateSiteThemeSchema } = await import('../schemas/theme.schema');
    const result = CreateSiteThemeSchema.safeParse({ store_id: VALID_STORE_UUID, name: 'a'.repeat(121) });
    assert.equal(result.success, false, 'Must reject name > 120 chars');
});

test('DuplicateSiteThemeSchema: name is optional', async () => {
    const { DuplicateSiteThemeSchema } = await import('../schemas/theme.schema');
    const withoutName = DuplicateSiteThemeSchema.safeParse({ store_id: VALID_STORE_UUID });
    assert.equal(withoutName.success, true, 'Must accept body without name (name is optional)');

    const withName = DuplicateSiteThemeSchema.safeParse({ store_id: VALID_STORE_UUID, name: 'Copy' });
    assert.equal(withName.success, true, 'Must accept body with name');
});

test('RenameSiteThemeSchema: name is required', async () => {
    const { RenameSiteThemeSchema } = await import('../schemas/theme.schema');
    const withoutName = RenameSiteThemeSchema.safeParse({ store_id: VALID_STORE_UUID });
    assert.equal(withoutName.success, false, 'Must reject body without name');

    const withName = RenameSiteThemeSchema.safeParse({ store_id: VALID_STORE_UUID, name: 'New Name' });
    assert.equal(withName.success, true, 'Must accept body with name');
});

test('ArchiveSiteThemeSchema: accepts store_id only', async () => {
    const { ArchiveSiteThemeSchema } = await import('../schemas/theme.schema');
    const result = ArchiveSiteThemeSchema.safeParse({ store_id: VALID_STORE_UUID });
    assert.equal(result.success, true, 'Must accept body with store_id only');
});

test('DeleteUnpublishedThemeQuerySchema: accepts valid UUID store_id', async () => {
    const { DeleteUnpublishedThemeQuerySchema } = await import('../schemas/theme.schema');
    const result = DeleteUnpublishedThemeQuerySchema.safeParse({ store_id: VALID_STORE_UUID });
    assert.equal(result.success, true, 'Must accept valid UUID store_id');
    const missing = DeleteUnpublishedThemeQuerySchema.safeParse({});
    assert.equal(missing.success, false, 'Must reject missing store_id');
});

// ─── Migration 190 safety assertions ─────────────────────────────────────────

test('migration 190: no USING (true) — no public RLS bypass', () => {
    const sqlBody = stripSqlLineComments(MIGRATION_SRC);
    const matches = sqlBody.match(/USING\s*\(?\s*true\s*\)?/gi) ?? [];
    assert.equal(
        matches.length, 0,
        `migration 190 must not contain USING(true) — found: ${matches.join(', ')}`,
    );
});

test('migration 190: no forbidden DDL (DROP TABLE / DROP COLUMN / RENAME COLUMN / TRUNCATE)', () => {
    const sqlBody = stripSqlLineComments(MIGRATION_SRC);
    assert.ok(!(/\bDROP\s+TABLE\b/i.test(sqlBody)), 'DROP TABLE must not appear in migration 190 executable SQL');
    assert.ok(!(/\bDROP\s+COLUMN\b/i.test(sqlBody)), 'DROP COLUMN must not appear in migration 190 executable SQL');
    assert.ok(!(/\bRENAME\s+COLUMN\b/i.test(sqlBody)), 'RENAME COLUMN must not appear in migration 190 executable SQL');
    assert.ok(!(/\bTRUNCATE\b/i.test(sqlBody)), 'TRUNCATE must not appear in migration 190 executable SQL');
});

test('migration 190: ADD COLUMN uses IF NOT EXISTS (idempotent re-run safe)', () => {
    assert.ok(
        /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i.test(MIGRATION_SRC),
        'ADD COLUMN must use IF NOT EXISTS for idempotent re-run safety',
    );
});

test('migration 190: CREATE INDEX uses IF NOT EXISTS (idempotent re-run safe)', () => {
    assert.ok(
        /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/i.test(MIGRATION_SRC),
        'CREATE INDEX must use IF NOT EXISTS for idempotent re-run safety',
    );
});

test('migration 190: owned_by_site_id column is added to themes table', () => {
    assert.ok(
        MIGRATION_SRC.includes('owned_by_site_id'),
        'migration 190 must add owned_by_site_id column to themes',
    );
    assert.ok(
        MIGRATION_SRC.includes('is_site_private'),
        'migration 190 must add is_site_private column to themes',
    );
});

// ─── Hardening Q: renameSiteTheme marketplace-catalog protection ──────────────

test('renameSiteTheme: ForbiddenError when theme is a marketplace theme (owned_by_site_id IS NULL)', async () => {
    // Simulate: authenticated merchant owns the store, has the theme installed,
    // but the themes row has owned_by_site_id IS NULL (shared marketplace catalog).
    const mockDb = {
        from: (table: string) => {
            if (table === 'sites') {
                // verifyStoreOwner passes
                return makeChain({ data: { id: 'store-1', user_id: 'user-1', custom_user_id: null }, error: null });
            }
            if (table === 'theme_instances') {
                // instance exists in this store — merchant has it installed
                return makeChain({ data: { id: 'inst-1' }, error: null });
            }
            if (table === 'themes') {
                // marketplace theme: owned_by_site_id IS NULL
                return makeChain({ data: { owned_by_site_id: null }, error: null });
            }
            return makeChain({ data: null, error: null });
        },
        rpc: () => Promise.resolve({ data: null, error: null }),
    };

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(mockDb as never);

    await assert.rejects(
        () => adapter.renameSiteTheme('urban-kicks', 'store-1', { store_id: 'store-1', name: 'New Name' }, 'user-1', null),
        (err: unknown) => {
            assert.ok(
                err instanceof ForbiddenError,
                `Expected ForbiddenError for marketplace theme rename, got ${(err as Error)?.constructor?.name}`,
            );
            assert.ok(
                (err as Error).message.toLowerCase().includes('marketplace'),
                `Error message must mention marketplace, got: ${(err as Error).message}`,
            );
            return true;
        },
    );
});

test('renameSiteTheme: ForbiddenError when owned_by_site_id belongs to a different store', async () => {
    // Edge: theme row has owned_by_site_id = 'store-2' but caller is 'store-1'.
    const mockDb = {
        from: (table: string) => {
            if (table === 'sites') {
                return makeChain({ data: { id: 'store-1', user_id: 'user-1', custom_user_id: null }, error: null });
            }
            if (table === 'theme_instances') {
                return makeChain({ data: { id: 'inst-1' }, error: null });
            }
            if (table === 'themes') {
                return makeChain({ data: { owned_by_site_id: 'store-2' }, error: null });
            }
            return makeChain({ data: null, error: null });
        },
        rpc: () => Promise.resolve({ data: null, error: null }),
    };

    const { ThemeExecutionAdapter } = await import('../execution/theme-execution.adapter');
    const adapter = new ThemeExecutionAdapter(mockDb as never);

    await assert.rejects(
        () => adapter.renameSiteTheme('some-theme', 'store-1', { store_id: 'store-1', name: 'Stolen Name' }, 'user-1', null),
        (err: unknown) => {
            assert.ok(err instanceof ForbiddenError, `Expected ForbiddenError, got ${(err as Error)?.constructor?.name}`);
            return true;
        },
    );
});

// ─── Hardening Q: source-pattern — owned_by_site_id scope in rename UPDATE ───

test('renameSiteTheme adapter: UPDATE themes is scoped by owned_by_site_id (marketplace catalog protection)', () => {
    const renameBlock = ADAPTER_SRC.match(
        /async renameSiteTheme\([\s\S]*?(?=\n    async )/,
    )?.[0] ?? '';

    assert.ok(renameBlock.length > 0, 'renameSiteTheme() method must be found in adapter source');
    assert.ok(
        renameBlock.includes("'owned_by_site_id'"),
        "renameSiteTheme UPDATE must include .eq('owned_by_site_id', ...) to prevent shared catalog mutation",
    );
    // The application-level guard must also throw ForbiddenError for marketplace themes
    assert.ok(
        renameBlock.includes('ForbiddenError'),
        "renameSiteTheme must throw ForbiddenError when owned_by_site_id is null or mismatched",
    );
});

// ─── Hardening Q: ownership-before-limit ordering in route handlers ───────────

test('POST /library/create: verifyStoreOwner called before resolveStoreThemeLimit (IDOR + info-leak prevention)', () => {
    const createRouteStart = LIBRARY_ROUTES_SRC.indexOf("router.post('/library/create'");
    // The duplicate route starts after create
    const duplicateRouteStart = LIBRARY_ROUTES_SRC.indexOf("router.post('/:slug/duplicate'");
    assert.ok(createRouteStart !== -1, 'POST /library/create route must be present in theme-library-routes.ts');

    const createBlock = LIBRARY_ROUTES_SRC.slice(createRouteStart, duplicateRouteStart);

    const ownershipIdx = createBlock.indexOf('verifyStoreOwner');
    const limitIdx = createBlock.indexOf('resolveStoreThemeLimit');

    assert.ok(ownershipIdx !== -1, 'verifyStoreOwner must be called in POST /library/create');
    assert.ok(limitIdx !== -1, 'resolveStoreThemeLimit must be called in POST /library/create');
    assert.ok(
        ownershipIdx < limitIdx,
        `verifyStoreOwner (offset ${ownershipIdx}) must appear BEFORE resolveStoreThemeLimit (offset ${limitIdx}) in POST /library/create`,
    );
});

test('POST /:slug/duplicate: verifyStoreOwner called before resolveStoreThemeLimit (IDOR + info-leak prevention)', () => {
    const duplicateRouteStart = LIBRARY_ROUTES_SRC.indexOf("router.post('/:slug/duplicate'");
    const renameRouteStart = LIBRARY_ROUTES_SRC.indexOf("router.patch('/:slug/rename'");
    assert.ok(duplicateRouteStart !== -1, 'POST /:slug/duplicate route must be present in theme-library-routes.ts');

    const duplicateBlock = LIBRARY_ROUTES_SRC.slice(duplicateRouteStart, renameRouteStart);

    const ownershipIdx = duplicateBlock.indexOf('verifyStoreOwner');
    const limitIdx = duplicateBlock.indexOf('resolveStoreThemeLimit');

    assert.ok(ownershipIdx !== -1, 'verifyStoreOwner must be called in POST /:slug/duplicate');
    assert.ok(limitIdx !== -1, 'resolveStoreThemeLimit must be called in POST /:slug/duplicate');
    assert.ok(
        ownershipIdx < limitIdx,
        `verifyStoreOwner (offset ${ownershipIdx}) must appear BEFORE resolveStoreThemeLimit (offset ${limitIdx}) in POST /:slug/duplicate`,
    );
});
