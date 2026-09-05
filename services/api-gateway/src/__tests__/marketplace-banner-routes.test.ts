// CAP-FB-BANNERS — the marketplace home strip.
//
// Two things this file exists to hold. First, the SERVER filters: System A shipped every inactive
// banner to every device and hid them in the app, so the public response must carry no `is_active`
// field at all — a client that receives the flag will eventually filter on it again. Second, an empty
// strip and a broken database are DIFFERENT answers: "no banners are published" is a legitimate 200,
// and returning it for a database failure would cache the outage as a valid empty strip.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import type { Env } from '../index';
import {
    registerMarketplaceBannerRoutes,
    type PublicMarketplaceBanner,
} from '../routes/storefront/marketplace-banner-routes';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

const BANNER: PublicMarketplaceBanner = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Festive picks',
    subtitle: 'Up to 40% off',
    image_url: 'https://cdn.letbuyy.com/banners/festive.webp',
    icon_name: 'sparkles',
    target_route: '/collections/festive',
    color_hex: '#1B1B1F',
    image_width: 1200,
    image_height: 600,
    aspect_ratio_type: 'wide',
    position: 0,
};

function app(data: PublicMarketplaceBanner[] | null = [BANNER], error: unknown = null) {
    let calls = 0;
    const router = new Hono<{ Bindings: Env }>();
    registerMarketplaceBannerRoutes(router, {
        loadActiveBanners: async () => {
            calls += 1;
            return { data, error };
        },
    });
    const outer = new Hono<{ Bindings: Env }>();
    outer.route('/storefront', router);
    return { app: outer, calls: () => calls };
}

// STOREFRONT_CACHE off so each request reaches the producer; the cache is not what these assert.
const env = () => ({ ENVIRONMENT: 'test', STOREFRONT_CACHE: 'off' } as unknown as Env);
const get = (h: ReturnType<typeof app>) => h.app.request('/storefront/marketplace/banners', undefined, env());

test('the strip is returned', async () => {
    const res = await get(app());
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: PublicMarketplaceBanner[] };
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].title, 'Festive picks');
});

test('no published banners is a legitimate EMPTY strip, not an error', async () => {
    const res = await get(app([]));
    assert.equal(res.status, 200);
    const body = await res.json() as { data: unknown[] };
    assert.deepEqual(body.data, []);
});

test('a database failure is a 500, not a silent empty strip', async () => {
    // The distinction matters twice over: an empty array is already a valid answer, and cachedJson
    // would store a 200 for the whole TTL — serving the outage as though it were curation.
    const res = await get(app(null, { message: 'connection refused' }));
    assert.equal(res.status, 500);
    const body = await res.json() as { success: boolean };
    assert.equal(body.success, false);
});

test('the response never carries is_active, so a client cannot filter again', async () => {
    const res = await get(app());
    const raw = await res.text();
    assert.doesNotMatch(raw, /is_active/, 'the public projection must not expose the publication flag');
});

// ── Source contracts ──────────────────────────────────────────────────────────────────────────
// A fake that models the filter proves the ROUTE passes it on, never that the real query applies it.
// These read the module's own default query.

function code(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/`(?:[^`\\]|\\.)*`/g, '` `');
}

const routeSource = code(readFileSync(join(SRC, 'routes/storefront/marketplace-banner-routes.ts'), 'utf8'));

test('SOURCE: the real query filters to active banners and orders the strip deterministically', () => {
    const at = routeSource.indexOf('loadActiveMarketplaceBannersFromDatabase');
    assert.ok(at > 0, 'the default query should exist');
    const body = routeSource.slice(at, at + 900);
    assert.match(body, /\.from\('marketplace_banners'\)/);
    assert.match(body, /\.eq\('is_active',\s*true\)/, 'the strip must be filtered server-side');
    assert.match(body, /\.order\('position'/, 'display order comes from position');
    // Firestore ordered on priority alone, so equal priorities came back in an order it never
    // promised and the carousel could reshuffle between loads.
    assert.match(body, /\.order\('created_at'/, 'equal positions need a stable tiebreak');
});

test('SOURCE: the public column list excludes is_active and the curation timestamps', () => {
    const at = routeSource.indexOf('PUBLIC_MARKETPLACE_BANNER_COLUMNS');
    const columns = routeSource.slice(at, routeSource.indexOf(';', at));
    assert.match(columns, /image_url/);
    assert.doesNotMatch(columns, /is_active/);
    assert.doesNotMatch(columns, /created_at|updated_at/);
});
