// CAP-FB-BANNERS — the operator curation API.
//
// The Firestore version let the client write banners directly (createBannerWithFile, updateBanner,
// deleteBanner, toggleBannerStatus). Curation is now an operator-realm concern behind
// requirePermission, and the two shapes that must never silently succeed are a PATCH that changes
// nothing and a DELETE of a row that was never there — both report "saved"/"deleted" to an operator
// who then believes the strip changed.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import type { Env } from '../index';
import {
    createMarketplaceBannersOperationsRouter,
    type MarketplaceBannerRow,
} from '../routes/operations/marketplace-banners';

const ID = '11111111-1111-4111-8111-111111111111';

const ROW: MarketplaceBannerRow = {
    id: ID,
    title: 'Festive picks',
    subtitle: 'Up to 40% off',
    image_url: 'https://cdn.letbuyy.com/banners/festive.webp',
    icon_name: null,
    target_route: '/collections/festive',
    color_hex: '#1B1B1F',
    image_width: 1200,
    image_height: 600,
    aspect_ratio_type: 'wide',
    position: 0,
    is_active: true,
    created_at: '2026-09-05T00:00:00.000Z',
    updated_at: '2026-09-05T00:00:00.000Z',
};

type Harness = {
    app: Hono<{ Bindings: Env }>;
    permissions: string[];
    patches: Record<string, unknown>[];
    deleted: string[];
};

function harness(overrides: Partial<{
    update: MarketplaceBannerRow | null;
    remove: boolean;
    list: MarketplaceBannerRow[];
}> = {}): Harness {
    const permissions: string[] = [];
    const patches: Record<string, unknown>[] = [];
    const deleted: string[] = [];
    const router = createMarketplaceBannersOperationsRouter({
        listBanners: async () => overrides.list ?? [ROW],
        createBanner: async (_c, input) => ({ ...ROW, ...input } as MarketplaceBannerRow),
        updateBanner: async (_c, _id, input) => {
            patches.push(input as unknown as Record<string, unknown>);
            return overrides.update === undefined ? ROW : overrides.update;
        },
        deleteBanner: async (_c, id) => {
            deleted.push(id);
            return overrides.remove ?? true;
        },
        // Records the permission each route demands, then allows the request through.
        permission: ((name: string) => {
            return async (_c: unknown, next: () => Promise<void>) => {
                permissions.push(name);
                await next();
            };
        }) as never,
    });
    const app = new Hono<{ Bindings: Env }>();
    app.route('/operations/marketplace-banners', router);
    return { app, permissions, patches, deleted };
}

const env = () => ({ ENVIRONMENT: 'test' } as unknown as Env);
const json = (body: unknown) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

const VALID = {
    title: 'Festive picks',
    image_url: 'https://cdn.letbuyy.com/banners/festive.webp',
};

test('creating a banner returns 201 and demands the decide permission', async () => {
    const h = harness();
    const res = await h.app.request('/operations/marketplace-banners', json(VALID), env());
    assert.equal(res.status, 201);
    assert.deepEqual(h.permissions, ['review:decide']);
});

test('listing demands only the view permission', async () => {
    const h = harness();
    const res = await h.app.request('/operations/marketplace-banners', undefined, env());
    assert.equal(res.status, 200);
    assert.deepEqual(h.permissions, ['review:view']);
});

test('an http image URL is refused at the edge', async () => {
    const h = harness();
    const res = await h.app.request(
        '/operations/marketplace-banners',
        json({ ...VALID, image_url: 'http://cdn.letbuyy.com/x.webp' }),
        env(),
    );
    assert.equal(res.status, 400);
});

test('a protocol-relative or script target route is refused at the edge', async () => {
    for (const target of ['//evil.example/x', 'javascript:alert(1)', 'evil.example/x']) {
        const h = harness();
        const res = await h.app.request('/operations/marketplace-banners', json({ ...VALID, target_route: target }), env());
        assert.equal(res.status, 400, `${target} should be refused`);
    }
});

test('an in-app route and an https target are both accepted', async () => {
    for (const target of ['/collections/festive', 'https://letbuyy.com/festive']) {
        const h = harness();
        const res = await h.app.request('/operations/marketplace-banners', json({ ...VALID, target_route: target }), env());
        assert.equal(res.status, 201, `${target} should be accepted`);
    }
});

test('an unknown column cannot be smuggled into a create', async () => {
    const h = harness();
    const res = await h.app.request('/operations/marketplace-banners', json({ ...VALID, site_id: 'abc' }), env());
    // The table is platform-scoped and has no site_id; .strict() is what keeps that true at the edge.
    assert.equal(res.status, 400);
});

test('a PATCH with no fields is refused rather than reported as saved', async () => {
    const h = harness();
    const res = await h.app.request(
        `/operations/marketplace-banners/${ID}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' },
        env(),
    );
    assert.equal(res.status, 400);
    assert.deepEqual(h.patches, [], 'an empty patch must never reach the database');
});

test('a PATCH against an unknown id is a 404', async () => {
    const h = harness({ update: null });
    const res = await h.app.request(
        `/operations/marketplace-banners/${ID}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: 3 }) },
        env(),
    );
    assert.equal(res.status, 404);
});

test('a DELETE of a row that was never there is a 404, not a silent success', async () => {
    const h = harness({ remove: false });
    const res = await h.app.request(`/operations/marketplace-banners/${ID}`, { method: 'DELETE' }, env());
    assert.equal(res.status, 404);
    assert.deepEqual(h.deleted, [ID]);
});

test('a DELETE of a real row succeeds', async () => {
    const h = harness();
    const res = await h.app.request(`/operations/marketplace-banners/${ID}`, { method: 'DELETE' }, env());
    assert.equal(res.status, 200);
    assert.deepEqual(h.permissions, ['review:decide']);
});

test('a non-UUID id is rejected before any lookup', async () => {
    const h = harness();
    const res = await h.app.request('/operations/marketplace-banners/not-a-uuid', { method: 'DELETE' }, env());
    assert.equal(res.status, 400);
    assert.deepEqual(h.deleted, [], 'a malformed id must not reach the database');
});

// ── Source contracts ──────────────────────────────────────────────────────────────────────────
// Every test above drives the router with INJECTED dependencies, so it proves what the route does
// with an answer — never what the real query asks. Making the real deleteBanner return a bare `true`
// failed nothing above; these read the module's own defaults instead.

function code(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/`(?:[^`\\]|\\.)*`/g, '` `');
}

const operationsSource = code(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../routes/operations/marketplace-banners.ts'), 'utf8'),
);

// The body of one property of the default-dependencies object literal, from its key to the next key
// at the same indentation. The search starts INSIDE that object: the interface above declares members
// with the identical `    <name>:` shape and comes first in the file, so an unanchored search reads
// the type declaration and every assertion below then passes or fails for the wrong reason.
const DEFAULTS = operationsSource.slice(
    operationsSource.indexOf('export const defaultMarketplaceBannersOperationsDependencies'),
);

function dependencyBody(name: string): string {
    assert.ok(DEFAULTS.length > 0, 'the default dependencies object should exist');
    const start = DEFAULTS.search(new RegExp(`\\n    ${name}:`));
    assert.ok(start > 0, `${name} should be a default dependency`);
    const rest = DEFAULTS.slice(start + 1);
    const next = rest.slice(1).search(/\n    [a-zA-Z_]+:/);
    return next === -1 ? rest : rest.slice(0, next + 1);
}

test('the dependency-body extractor reads the implementation, not the interface', () => {
    // Proving the instrument: the interface's `deleteBanner:` is a type, and its body contains
    // neither .delete() nor a return statement. If the extractor drifted back to it, every SOURCE
    // assertion below would be inspecting a type declaration.
    const body = dependencyBody('deleteBanner');
    assert.match(body, /getSupabaseAdmin\(c\)/, 'should be the implementation, which builds a client');
    assert.doesNotMatch(body, /Promise<boolean>/, 'should not be the interface member');
});

test('SOURCE: the real delete distinguishes "deleted" from "was never there"', () => {
    const body = dependencyBody('deleteBanner');
    assert.match(body, /\.delete\(\)/);
    // Without selecting the row back, a DELETE against a missing id reports success and the operator
    // believes a banner is gone. `return true` would pass every injected-dependency test above.
    assert.match(body, /\.select\('id'\)/, 'the deleted row must be selected back');
    assert.match(body, /return Boolean\(/, 'the result must be derived from whether a row came back');
    assert.doesNotMatch(body, /return true;/, 'a delete must never report unconditional success');
});

test('SOURCE: the real update writes only the fields that were sent', () => {
    const body = dependencyBody('updateBanner');
    // Built key by key: `undefined` means "not sent" and must not be written, while an explicit
    // `null` on a nullable column means "clear it" and must be. A spread would conflate them.
    assert.match(body, /if \(input\.title !== undefined\) patch\.title = input\.title;/);
    assert.match(body, /if \(input\.is_active !== undefined\) patch\.is_active = input\.is_active;/);
    assert.doesNotMatch(body, /\.\.\.input/, 'spreading input would write undefined over stored values');
    assert.match(body, /\.eq\('id', id\)/, 'an update must be scoped to the one row');
});

test('SOURCE: every operator query targets marketplace_banners and nothing else', () => {
    const tables = [...operationsSource.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]);
    assert.ok(tables.length >= 4, 'list, create, update and delete should each read the table');
    assert.deepEqual([...new Set(tables)], ['marketplace_banners']);
});
