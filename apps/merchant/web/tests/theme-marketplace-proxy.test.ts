import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { ThemeEditableSchemaResponseSchema } from '@letbuyy/shared-types';
import * as contract from '../src/lib/themes/marketplace-contract';

const site = '7b669c70-9000-4000-8000-000000000001';
const instance = '7b669c70-9000-4000-8000-000000000002';
const packageId = '7b669c70-9000-4000-8000-000000000003';
const versionId = '7b669c70-9000-4000-8000-000000000004';
const theme = { id: site, slug: 'letbuyy-sense', name: 'Threadline', version: '2.0.0', letbuyy_pricing_type: 'free', letbuyy_price_inr: 0 };
function loadRoute(kind: 'catalog' | 'install', options: { denied?: boolean; missingReceipt?: boolean; unavailableDetail?: boolean; wrongVersion?: boolean; unconfirmedUpload?: boolean; unavailableRuntime?: boolean } = {}) {
    const calls: Array<{ operation: string; input?: unknown }> = [];
    class ApiError extends Error { constructor(public status: number) { super('Synthetic failure'); } }
    const client = { themes: {
        async listCatalog(input: unknown) { calls.push({ operation: 'catalog', input }); return { data: [theme], total: 25, page: 2, limit: 12, has_more: true, current_theme: null, store_status: 'draft' }; },
        async categories() { return ['fashion']; },
        async schema(slug: string) { if (options.unavailableRuntime) throw new ApiError(503); return { theme: { id: theme.id, slug, name: theme.name, renderer_key: slug, theme_package_id: packageId, theme_package_version_id: versionId } }; },
        async get(slug: string) { calls.push({ operation: 'detail', input: slug }); if (options.unavailableDetail) throw new ApiError(503); return theme; },
        async install(slug: string, input: unknown) { calls.push({ operation: 'install', input: { slug, input } }); return { theme: { id: site, slug, name: theme.name, version: options.wrongVersion ? '1.0.0' : '2.0.0' }, theme_package_id: packageId, theme_package_version_id: versionId, installed_version: options.wrongVersion ? '1.0.0' : '2.0.0', ...(options.missingReceipt ? {} : { theme_instance_id: instance }), already_installed: true, installation: { store_id: site } }; },
        async uploadPackage(input: unknown) { calls.push({ operation: 'upload', input }); return { theme: { slug: `private-${site}-sample` }, ...(options.unconfirmedUpload ? {} : { package: { id: packageId }, version: { id: versionId, version: '2.0.0' } }) };  },
    } };
    const modules: Record<string, unknown> = {
        'next/server': { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
        '@letbuyy/api-client': { LetbuyyApiError: ApiError },
        '@letbuyy/shared-types': { ThemeEditableSchemaResponseSchema },
        '@/lib/themes/marketplace-contract': contract,
        '@/lib/api/client': { createMerchantApiClient: () => client, merchantApiErrorResponse: () => Response.json({ error: 'Unavailable' }, { status: 503 }) },
        '@/lib/stores/resolve-owned-store': { async resolveOwnedStoreId(locator: string) { calls.push({ operation: 'owned-store', input: locator }); return options.denied ? { error: Response.json({ error: 'Forbidden' }, { status: 403 }) } : { storeId: site }; } },
    };
    const path = kind === 'catalog' ? '../src/app/api/themes/route.ts' : '../src/app/api/themes/install/route.ts';
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: { GET?: (request: Request) => Promise<Response>; POST?: (request: Request) => Promise<Response> } = {};
    new Function('require', 'exports', js)((name: string) => { assert.ok(modules[name], name); return modules[name]; }, exports);
    return { calls, ...exports };
}
test('actual catalog BFF forwards combined filters, page and selected detail while preserving totals', async () => {
    const r = loadRoute('catalog');
    const response = await r.GET!(new Request('http://local/api/themes?store_name=sample-store&search=linen&category=fashion&page=2&limit=12&sort=name&theme_slug=letbuyy-sense'));
    assert.equal(response.status, 200); const body = await response.json();
    assert.equal(body.total, 25); assert.equal(body.page, 2); assert.equal(body.limit, 12); assert.equal(body.has_more, true);
    assert.equal(body.selectedTheme.version, '2.0.0'); assert.equal(body.themes[0].pricing_type, 'free');
    assert.deepEqual(r.calls.find(call => call.operation === 'catalog')?.input, { search: 'linen', category: 'fashion', feature: undefined, page: 2, limit: 12, sort: 'name', store_id: site });
});
test('actual catalog BFF refuses invalid pagination and denied tenant before catalog work', async () => {
    const invalid = loadRoute('catalog'); assert.equal((await invalid.GET!(new Request('http://local/api/themes?page=-1'))).status, 400); assert.equal(invalid.calls.length, 0);
    const denied = loadRoute('catalog', { denied: true }); assert.equal((await denied.GET!(new Request('http://local/api/themes?store_name=foreign-store'))).status, 403); assert.deepEqual(denied.calls.map(call => call.operation), ['owned-store']);
});
test('detail backend failure is unavailable, independently of a valid catalog page', async () => {
    const r = loadRoute('catalog', { unavailableDetail: true }); const body = await (await r.GET!(new Request('http://local/api/themes?theme_slug=letbuyy-sense'))).json();
    assert.equal(body.selectedThemeStatus, 'unavailable'); assert.equal(body.selectedTheme, null); assert.equal(body.total, 25);
});
test('actual Add BFF resolves authorized destination and preserves complete canonical receipt/version expectation', async () => {
    const r = loadRoute('install');
    const response = await r.POST!(new Request('http://local/api/themes/install', { method: 'POST', body: JSON.stringify({ store_name: 'sample-store', storeId: '7b669c70-9999-4000-8000-000000000001', themeSlug: 'letbuyy-sense', expectedVersion: '2.0.0' }) }));
    assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.theme_instance_id, instance); assert.equal(body.already_installed, true);
    assert.equal(r.calls[0].input, 'sample-store');
    assert.deepEqual(r.calls[1].input, { slug: 'letbuyy-sense', input: { store_id: site, config_overrides: {}, expected_version: '2.0.0' } });
});
test('actual Add BFF denies forged destination and unconfirmed receipt without manufacturing success', async () => {
    const request = () => new Request('http://local/api/themes/install', { method: 'POST', body: JSON.stringify({ store_name: 'foreign-store', themeSlug: 'letbuyy-sense' }) });
    const denied = loadRoute('install', { denied: true }); assert.equal((await denied.POST!(request())).status, 403); assert.equal(denied.calls.length, 1);
    const missing = loadRoute('install', { missingReceipt: true }); const response = await missing.POST!(request()); assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'THEME_INSTALL_UNCONFIRMED');
});
test('private import scopes the uploaded slug to server-resolved ownership', async () => {
    const r = loadRoute('install'); const response = await r.POST!(new Request('http://local/api/themes/install', { method: 'POST', body: JSON.stringify({ store_name: 'sample-store', bundle: { package: { slug: 'sample' } } }) }));
    assert.equal(response.status, 200);
    const uploaded = r.calls.find(call => call.operation === 'upload')!.input as { bundle: { package: { slug: string } }; store_id: string };
    assert.equal(uploaded.bundle.package.slug, `private-${site}-sample`); assert.equal(uploaded.store_id, site);
});

test('Add forwards package UUID preconditions and refuses a differently versioned receipt', async () => {
    const request = () => new Request('http://local/api/themes/install', { method: 'POST', body: JSON.stringify({ store_name: 'sample-store', themeSlug: 'letbuyy-sense', expectedVersion: '2.0.0', expectedPackageId: packageId, expectedPackageVersionId: versionId }) });
    const r = loadRoute('install'); assert.equal((await r.POST!(request())).status, 200);
    const install = r.calls.find(call => call.operation === 'install')!.input as { input: Record<string, unknown> };
    assert.equal(install.input.expected_package_id, packageId); assert.equal(install.input.expected_package_version_id, versionId);
    const stale = loadRoute('install', { wrongVersion: true }); const response = await stale.POST!(request());
    assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'THEME_INSTALL_UNCONFIRMED');
});
test('an unconfirmed upload is never passed to the installer', async () => {
    const r = loadRoute('install', { unconfirmedUpload: true });
    const response = await r.POST!(new Request('http://local/api/themes/install', { method: 'POST', body: JSON.stringify({ store_name: 'sample-store', bundle: { package: { slug: 'sample' } } }) }));
    assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'THEME_UPLOAD_UNCONFIRMED');
    assert.ok(!r.calls.some(call => call.operation === 'install'));
});

test('unavailable package descriptor preserves readable detail and disables acquisition metadata', async () => {
    const r = loadRoute('catalog', { unavailableRuntime: true });
    const response = await r.GET!(new Request('http://local/api/themes?theme_slug=letbuyy-sense'));
    assert.equal(response.status, 200); const body = await response.json();
    assert.equal(body.selectedTheme.slug, 'letbuyy-sense'); assert.equal(body.selectedThemeStatus, 'ready');
    assert.equal(body.selectedRuntime, null); assert.equal(body.selectedRuntimeStatus, 'unavailable');
});
