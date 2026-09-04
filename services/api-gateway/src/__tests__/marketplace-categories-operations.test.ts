// ADM-3 — operator routes for the marketplace_categories taxonomy. Behavioural where it can be: the
// router is driven through a real Hono app with injected fakes for the query/create/update calls, so
// what is asserted is the wire contract (permission gates, the 201/404/409/422 mapping, the "nothing
// to update" rule), not the source text. Source-shape assertions cover only mounting, the absence of
// a DELETE route, and the "never inside a tenant transaction" invariant, which no unit can exercise.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import {
    createMarketplaceCategoriesOperationsRouter,
    mapMarketplaceCategoryDatabaseError,
    type MarketplaceCategoriesOperationsDependencies,
    type MarketplaceCategoryRow,
} from '../routes/operations/marketplace-categories';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/operations/marketplace-categories.ts', import.meta.url), 'utf8');

const CATEGORY_A: MarketplaceCategoryRow = {
    id: '11111111-0000-4000-8000-000000000001',
    slug: 'home-and-kitchen',
    name: 'Home & Kitchen',
    parent_id: null,
    position: 0,
    is_active: true,
    metadata: {},
    created_at: '2026-09-04T00:00:00.000Z',
    updated_at: '2026-09-04T00:00:00.000Z',
};

function categoriesApp(
    options: {
        rows?: MarketplaceCategoryRow[];
        createError?: Error;
        updateResult?: MarketplaceCategoryRow | null | 'use-default';
        updateError?: Error;
    } = {},
) {
    const listCalls: unknown[] = [];
    const createCalls: unknown[] = [];
    const updateCalls: Array<{ id: string; input: unknown }> = [];
    const rows = options.rows ?? [CATEGORY_A];
    const deps: MarketplaceCategoriesOperationsDependencies = {
        listCategories: async (_c, query) => {
            listCalls.push(query);
            return rows;
        },
        createCategory: async (_c, input) => {
            createCalls.push(input);
            if (options.createError) throw options.createError;
            return { ...CATEGORY_A, ...input, id: '22222222-0000-4000-8000-000000000002' } as MarketplaceCategoryRow;
        },
        updateCategory: async (_c, id, input) => {
            updateCalls.push({ id, input });
            if (options.updateError) throw options.updateError;
            if (options.updateResult === undefined || options.updateResult === 'use-default') {
                return { ...CATEGORY_A, ...input } as MarketplaceCategoryRow;
            }
            return options.updateResult;
        },
        // Unit tests bypass the RBAC lookup; the contract test asserts the real middleware is wired per route.
        permission: (() => async (_c: unknown, next: () => Promise<void>) => next()) as never,
    };
    const app = new Hono();
    app.route('/operations/marketplace-categories', createMarketplaceCategoriesOperationsRouter(deps));
    return { app, listCalls, createCalls, updateCalls };
}

const post = (body: unknown) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const patch = (body: unknown) => ({ method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('GET /operations/marketplace-categories returns the full tree and forwards optional filters', async () => {
    const { app, listCalls } = categoriesApp();
    const res = await app.request('/operations/marketplace-categories', undefined, {});
    assert.equal(res.status, 200);
    assert.deepEqual(listCalls[0], {});
    const body = (await res.json()) as { success: boolean; data: MarketplaceCategoryRow[] };
    assert.equal(body.success, true);
    assert.equal(body.data[0].slug, 'home-and-kitchen');

    const filtered = await app.request('/operations/marketplace-categories?is_active=false&parent_id=11111111-0000-4000-8000-000000000001', undefined, {});
    assert.equal(filtered.status, 200);
    assert.deepEqual(listCalls[1], { is_active: false, parent_id: '11111111-0000-4000-8000-000000000001' });
});

test('POST /operations/marketplace-categories creates a category and returns 201 with the row', async () => {
    const { app, createCalls } = categoriesApp();
    const res = await app.request('/operations/marketplace-categories', post({ slug: 'electronics', name: 'Electronics' }), {});
    assert.equal(res.status, 201);
    assert.deepEqual(createCalls[0], { slug: 'electronics', name: 'Electronics', position: 0 });
    const body = (await res.json()) as { data: MarketplaceCategoryRow };
    assert.equal(body.data.slug, 'electronics');

    const badSlug = await app.request('/operations/marketplace-categories', post({ slug: 'Not Kebab Case', name: 'x' }), {});
    assert.equal(badSlug.status, 400);
    const smuggled = await app.request('/operations/marketplace-categories', post({ slug: 'ok', name: 'x', is_active: false }), {});
    assert.equal(smuggled.status, 400, 'is_active is not a creatable field');
});

test('a duplicate slug maps to 409, a missing parent to 422', async () => {
    const dup = categoriesApp({ createError: Object.assign(new Error('duplicate key value violates unique constraint "marketplace_categories_slug_key"'), { code: '23505' }) });
    const dupRes = await dup.app.request('/operations/marketplace-categories', post({ slug: 'electronics', name: 'Electronics' }), {});
    assert.equal(dupRes.status, 409);

    const badParent = categoriesApp({ createError: Object.assign(new Error('insert or update on table "marketplace_categories" violates foreign key constraint'), { code: '23503' }) });
    const badParentRes = await badParent.app.request(
        '/operations/marketplace-categories',
        post({ slug: 'sub', name: 'Sub', parent_id: '99999999-0000-4000-8000-000000000099' }),
        {},
    );
    assert.equal(badParentRes.status, 422);
});

test('PATCH /:id requires at least one field and applies a partial update, including toggling is_active alone', async () => {
    const { app, updateCalls } = categoriesApp();
    const empty = await app.request(`/operations/marketplace-categories/${CATEGORY_A.id}`, patch({}), {});
    assert.equal(empty.status, 400, 'nothing to update must be rejected');

    const toggled = await app.request(`/operations/marketplace-categories/${CATEGORY_A.id}`, patch({ is_active: false }), {});
    assert.equal(toggled.status, 200);
    assert.deepEqual(updateCalls[0], { id: CATEGORY_A.id, input: { is_active: false } });

    const notFound = categoriesApp({ updateResult: null });
    const missing = await notFound.app.request(`/operations/marketplace-categories/${CATEGORY_A.id}`, patch({ name: 'x' }), {});
    assert.equal(missing.status, 404);

    const badId = await app.request('/operations/marketplace-categories/not-a-uuid', patch({ name: 'x' }), {});
    assert.equal(badId.status, 400);
});

test('mapMarketplaceCategoryDatabaseError classifies the four database refusals this router relies on', () => {
    assert.equal(mapMarketplaceCategoryDatabaseError(Object.assign(new Error('dup'), { code: '23505' }))?.statusCode, 409);
    assert.equal(mapMarketplaceCategoryDatabaseError(Object.assign(new Error('fk'), { code: '23503' }))?.statusCode, 422);
    assert.equal(mapMarketplaceCategoryDatabaseError(Object.assign(new Error('check'), { code: '23514' }))?.statusCode, 422);
    assert.equal(mapMarketplaceCategoryDatabaseError(Object.assign(new Error('rls'), { code: '42501' }))?.statusCode, 403);
    assert.equal(mapMarketplaceCategoryDatabaseError(new Error('something unrelated')), null);
});

test('the categories router never enters a tenant transaction, is permission-gated per route, carries no DELETE, and is mounted once outside the kill switch', () => {
    const executable = routeSource.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
    assert.doesNotMatch(executable, /withResolvedTenantTx|resolveOwnedStoreScope|withTenantTx/, 'the operator realm never acts inside a tenant transaction');
    assert.doesNotMatch(routeSource, /router\.delete/, 'no DELETE route: both FKs onto this table are ON DELETE RESTRICT and unhandled by design this phase');
    assert.match(routeSource, /router\.get\('\/', deps\.permission\('review:view'\)/);
    assert.match(routeSource, /router\.post\('\/', deps\.permission\('review:decide'\)/);
    assert.match(routeSource, /router\.patch\('\/:id', deps\.permission\('review:decide'\)/);
    assert.match(routeSource, /permission: requirePermission,/, 'the production dependency set wires rbac\'s requirePermission');
    assert.equal(indexSource.match(/import operationsMarketplaceCategoriesRouter from '\.\/routes\/operations\/marketplace-categories'/g)?.length, 1);
    assert.equal(indexSource.match(/api\.route\('\/operations\/marketplace-categories', operationsMarketplaceCategoriesRouter\)/g)?.length, 1);
    assert.doesNotMatch(indexSource, /api\.use\('\/operations\/marketplace-categories[^']*', appPlatformKillSwitch\)/, 'taxonomy management is not behind the frozen app-platform kill switch');
});
