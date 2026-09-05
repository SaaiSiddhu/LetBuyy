// CAP-FB-BANNERS — the operator curation API.
//
// The Firestore version let the client write banners directly (createBannerWithFile, updateBanner,
// deleteBanner, toggleBannerStatus). Curation is now an operator-realm concern behind
// requirePermission, and the two shapes that must never silently succeed are a PATCH that changes
// nothing and a DELETE of a row that was never there — both report "saved"/"deleted" to an operator
// who then believes the strip changed.

import assert from 'node:assert/strict';
import test from 'node:test';
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
