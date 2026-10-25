import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const requireApp = createRequire(new URL('../package.json', import.meta.url));
const ts = requireApp('typescript'), engine = requireApp('@letbuyy/theme-engine'), shared = requireApp('@letbuyy/shared-types');
const source = readFileSync(new URL('../src/lib/theme-service.ts', import.meta.url), 'utf8');
const site = '7b669c70-f000-4000-8000-000000000001', instance = '7b669c70-f000-4000-8000-000000000002';
const packageId = '7b669c70-f000-4000-8000-000000000003', versionId = '7b669c70-f000-4000-8000-000000000004';
const theme = { id: packageId, slug: 'letbuyy-sense', name: 'Threadline', version: '2.0.0' };
const receipt = { theme, theme_instance_id: instance, theme_package_id: packageId, theme_package_version_id: versionId, installed_version: '2.0.0', already_installed: false };
const row = { instance_id: instance, theme_package_version_id: versionId, slug: theme.slug, instance_status: 'installed' };
const selection = { version: '2.0.0', packageId, packageVersionId: versionId };
function fixture(options = {}) {
    const calls = [], exports = {};
    const api = { themes: {
        get: async slug => { calls.push({ op: 'get', slug }); return theme; },
        schema: async slug => { calls.push({ op: 'schema', slug }); return { theme: { id: theme.id, slug, name: theme.name, renderer_key: slug,
            theme_package_id: options.missingDescriptor ? null : packageId, theme_package_version_id: versionId } }; },
        install: async (slug, input) => { calls.push({ op: 'install', slug, input }); if (options.installError) throw options.installError; return options.receipt ?? receipt; },
        listSiteLibrary: async store => { calls.push({ op: 'library', store }); if (options.readFailure) throw new Error('Readback unavailable'); return options.library ?? { themes: [row] }; },
    } };
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, URLSearchParams, require(id) {
        if (id === 'server-only') return {};
        if (id === '@letbuyy/theme-engine') return engine;
        if (id === '@letbuyy/shared-types') return shared;
        if (id === '@/lib/api/client') return { createThemeMarketplaceApiClient: async ({ requireSession }) => {
            calls.push({ op: 'client', requireSession }); if (requireSession && options.denied) throw new Error('Authentication required'); return api;
        } };
        throw new Error('Unexpected dependency: ' + id);
    } });
    return { service: exports.ThemeService, calls };
}
test('standalone Add sends exact preconditions and confirms the same instance in the selected owned library', async () => {
    for (const already_installed of [false, true]) {
        const f = fixture({ receipt: { ...receipt, already_installed } });
        const actual = await f.service.installTheme(theme.slug, site, selection);
        assert.equal(actual.theme_instance_id, instance); assert.equal(actual.already_installed, already_installed);
        assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(call => call.op === 'install').input)), { store_id: site,
            expected_version: '2.0.0', expected_package_id: packageId, expected_package_version_id: versionId });
        assert.equal(f.calls.find(call => call.op === 'library').store, site);
        assert.equal(f.calls[0].requireSession, true);
    }
});
test('partial/mismatched receipt and failed/wrong/archived readback never become standalone success', async () => {
    for (const options of [{ receipt: { ...receipt, theme_instance_id: undefined } }, { receipt: { ...receipt, installed_version: '1.0.0' } },
        { readFailure: true }, { library: { themes: [] } }, { library: { themes: [{ ...row, instance_id: packageId }] } },
        { library: { themes: [{ ...row, theme_package_version_id: instance }] } }, { library: { themes: [{ ...row, instance_status: 'archived' }] } }]) {
        const f = fixture(options);
        await assert.rejects(f.service.installTheme(theme.slug, site, selection), error => error.name === 'MarketplaceInstallUnconfirmedError');
    }
});
test('missing authentication/descriptor prevents installation and a native version conflict survives unchanged', async () => {
    for (const options of [{ denied: true }, { missingDescriptor: true }]) {
        const f = fixture(options); await assert.rejects(f.service.installTheme(theme.slug, site, selection));
        assert.equal(f.calls.some(call => call.op === 'install'), false);
    }
    const conflict = new Error('Selected version changed'); conflict.code = 'THEME_VERSION_CONFLICT';
    const f = fixture({ installError: conflict });
    await assert.rejects(f.service.installTheme(theme.slug, site, { ...selection, version: '1.0.0' }), error => error === conflict);
    assert.equal(f.calls.find(call => call.op === 'install').input.expected_version, '1.0.0');
    assert.equal(f.calls.some(call => call.op === 'library'), false);
});
test('dashboard hands upgrades to the canonical library and cannot claim installation from a URL flag', () => {
    const page = readFileSync(new URL('../src/app/dashboard/installations/page.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(page, /marketplace_update|applyThemeUpdateAction|Theme update applied|ThemeInstallFeedbackToast/);
    assert.match(page, /Review update/); assert.match(page, /Open theme library/);
    assert.doesNotMatch(page, /theme\.id \|\| theme\.slug|version_installed \|\| theme\.version/);
});
test('listing-to-install selection refuses a promoted or malformed version instead of silently acquiring it', () => {
    const { isRequestedInstallVersionCurrent } = requireApp('./src/lib/install-selection.ts');
    assert.equal(isRequestedInstallVersionCurrent('2.0.0', '2.0.0'), true);
    assert.equal(isRequestedInstallVersionCurrent(undefined, '2.0.0'), true, 'a direct install entry must still show its confirmed current version');
    for (const selected of ['1.0.0', '', null, ['2.0.0'], ' leading']) assert.equal(isRequestedInstallVersionCurrent(selected, '2.0.0'), false);
    assert.equal(isRequestedInstallVersionCurrent(undefined, ''), false);
});
