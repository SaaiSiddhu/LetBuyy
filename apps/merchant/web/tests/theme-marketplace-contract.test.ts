import assert from 'node:assert/strict';
import test from 'node:test';
import type { ThemeCatalogItem } from '@letbuyy/api-client';
import { catalogArtworkUrl } from '../src/lib/themes/catalog-artwork';
import { addMarketplaceTheme, confirmMarketplaceInstallReceipt, editorHandoff, gatewayCatalogQuery, MarketplaceInstallSchema, marketplaceQuery, normalizeCatalogTheme } from '../src/lib/themes/marketplace-contract';

const instanceId = '7b669c70-9000-4000-8000-000000000001';
const versionId = '7b669c70-9000-4000-8000-000000000002';
const packageId = '7b669c70-9000-4000-8000-000000000003';
const receipt = { theme_instance_id: instanceId, theme: { id: packageId, slug: 'letbuyy-sense', name: 'Threadline', version: '2.0.0' }, theme_package_id: packageId, theme_package_version_id: versionId, installed_version: '2.0.0', already_installed: false };
const library = { data: { themes: [{ instance_id: instanceId, slug: 'letbuyy-sense', instance_status: 'installed', theme_package_version_id: versionId }] } };

test('captured artwork replaces only its exact first-party version and keeps custom or historical previews', () => {
    const theme = { slug: 'letbuyy-forge', version: '2.0.0', thumbnail_url: '/theme-previews/forge.svg' };
    assert.equal(catalogArtworkUrl(theme), '/theme-previews/catalog-v2/circuit.webp');
    assert.equal(catalogArtworkUrl({ ...theme, version: '2.1.0' }), '/theme-previews/catalog-v2-1/circuit.webp');
    assert.equal(catalogArtworkUrl({ ...theme, version: '2.1.0', thumbnail_url: 'https://merchant.example/custom.webp' }), 'https://merchant.example/custom.webp');
    assert.equal(catalogArtworkUrl({ ...theme, version: '1.0.0' }), theme.thumbnail_url);
    assert.equal(catalogArtworkUrl({ ...theme, version: '3.0.0' }), theme.thumbnail_url);
    assert.equal(catalogArtworkUrl({ ...theme, thumbnail_url: 'https://merchant.example/custom.webp' }), 'https://merchant.example/custom.webp');
    assert.equal(catalogArtworkUrl({ ...theme, slug: 'merchant-custom-theme' }), theme.thumbnail_url);
    assert.equal(catalogArtworkUrl({ ...theme, slug: '__proto__', thumbnail_url: null }), null);
    assert.equal(catalogArtworkUrl({ ...theme, slug: 'letbuyy-sense', thumbnail_url: '/theme-previews/threadline-2.0.0.webp' }), '/theme-previews/catalog-v2/threadline.webp');
});

test('catalog query preserves combined server filters, sort and pagination; rejects malformed and oversized state', () => {
    const result = marketplaceQuery(new URLSearchParams('search=linen&category=fashion&feature=Search&sort=name&page=2&limit=12&theme_slug=letbuyy-sense'));
    assert.ok(result.success);
    assert.deepEqual(gatewayCatalogQuery(result.data), { search: 'linen', category: 'fashion', feature: 'Search', sort: 'name', page: 2, limit: 12 });
    for (const query of ['page=0', 'page=NaN', 'limit=51', 'sort=trending', 'theme_slug=../private', `search=${'a'.repeat(121)}`]) assert.equal(marketplaceQuery(new URLSearchParams(query)).success, false, query);
});
test('install input requires one acquisition source and a selected owned-store locator', () => {
    assert.ok(MarketplaceInstallSchema.safeParse({ store_name: 'sample-store', themeSlug: 'letbuyy-sense', expectedVersion: '2.0.0' }).success);
    for (const input of [{ themeSlug: 'letbuyy-sense' }, { store_name: '//foreign', themeSlug: 'letbuyy-sense' }, { store_name: 'sample-store', themeSlug: '../private' }, { store_name: 'sample-store', themeSlug: 'letbuyy-sense', bundle: {} }]) assert.equal(MarketplaceInstallSchema.safeParse(input).success, false);
});
test('persisted price aliases map to canonical shared metadata without manufacturing free availability', () => {
    const record = { slug: 'letbuyy-sense', letbuyy_pricing_type: 'free', letbuyy_price_inr: 0 } as unknown as ThemeCatalogItem;
    assert.equal(normalizeCatalogTheme(record).pricing_type, 'free');
    assert.equal(normalizeCatalogTheme(record).price_inr, 0);
    assert.throws(() => normalizeCatalogTheme({ slug: 'unknown' } as ThemeCatalogItem), /pricing/);
    assert.throws(() => normalizeCatalogTheme({ ...record, is_premium: true } as ThemeCatalogItem), /pricing/);
    assert.throws(() => normalizeCatalogTheme({ ...record, letbuyy_price_inr: 499 } as ThemeCatalogItem), /pricing/);
});

test('Add retains the exact receipt, reads back the selected instance and carries its version into the existing editor', async () => {
    const prior = globalThis.fetch;
    const calls: Array<{ url: string; body?: string }> = [];
    globalThis.fetch = (async (url, init) => {
        calls.push({ url: String(url), body: typeof init?.body === 'string' ? init.body : undefined });
        return Response.json(calls.length === 1 ? receipt : library);
    }) as typeof fetch;
    try {
        const result = await addMarketplaceTheme({ store: 'sample-store', slug: 'letbuyy-sense', version: '2.0.0' });
        assert.equal(result.receipt.theme_instance_id, instanceId);
        assert.equal(result.href, editorHandoff('sample-store', 'letbuyy-sense', instanceId, versionId));
        assert.deepEqual(JSON.parse(calls[0].body!), { store_name: 'sample-store', themeSlug: 'letbuyy-sense', expectedVersion: '2.0.0' });
        assert.equal(calls[1].url, '/api/themes/library?store_name=sample-store');
        assert.doesNotMatch(result.href, /publish/);
    } finally { globalThis.fetch = prior; }
});
test('Add never reports success for missing identity, wrong theme, failed readback or a different/archived instance', async () => {
    const prior = globalThis.fetch;
    const scenarios = [
        [{ theme: receipt.theme }, library],
        [{ ...receipt, theme: { slug: 'other-theme' } }, library],
        [receipt, { data: { themes: [] } }],
        [receipt, { data: { themes: [{ ...library.data.themes[0], instance_id: versionId }] } }],
        [receipt, { data: { themes: [{ ...library.data.themes[0], instance_status: 'archived' }] } }],
        [receipt, { data: { themes: [{ ...library.data.themes[0], theme_package_version_id: instanceId }] } }],
        [receipt, { data: { themes: [{ ...library.data.themes[0], instance_status: 'error' }] } }],
        [receipt, null],
    ];
    try {
        for (const [install, readback] of scenarios) {
            let calls = 0;
            globalThis.fetch = (async () => { calls++; return Response.json(calls === 1 ? install : readback, { status: calls === 2 && readback === null ? 503 : 200 }); }) as typeof fetch;
            await assert.rejects(addMarketplaceTheme({ store: 'sample-store', slug: 'letbuyy-sense', version: '2.0.0' }));
        }
    } finally { globalThis.fetch = prior; }
});
test('a rejected install preserves the backend conflict and never reads the library as a success substitute', async () => {
    const prior = globalThis.fetch; let calls = 0;
    globalThis.fetch = (async () => { calls++; return Response.json({ error: { code: 'THEME_VERSION_CONFLICT', message: 'Refresh the selected version.' } }, { status: 409 }); }) as typeof fetch;
    try { await assert.rejects(addMarketplaceTheme({ store: 'sample-store', slug: 'letbuyy-sense', version: '2.0.0' }), /Refresh the selected version/); assert.equal(calls, 1); }
    finally { globalThis.fetch = prior; }
});

test('a receipt proves the actual package/version and rejects old, partial or conflicting identities', () => {
    assert.equal(confirmMarketplaceInstallReceipt(receipt, { slug: 'letbuyy-sense', version: '2.0.0', packageId, packageVersionId: versionId }).version, '2.0.0');
    for (const wire of [null, {}, { ...receipt, installed_version: undefined }, { ...receipt, installed_version: '1.0.0', theme: { ...receipt.theme, version: '1.0.0' } }, { ...receipt, theme_package_id: 'not-a-uuid' }, { ...receipt, theme_package_version_id: instanceId }, { ...receipt, already_installed: undefined }]) assert.throws(() => confirmMarketplaceInstallReceipt(wire, { slug: 'letbuyy-sense', version: '2.0.0', packageVersionId: versionId }));
});
