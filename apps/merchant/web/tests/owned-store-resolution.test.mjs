import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function resolver({ failStatus } = {}) {
    const calls = [];
    class ApiError extends Error { constructor(status) { super('synthetic API failure'); this.status = status; } }
    const get = kind => async value => {
        calls.push({ kind, value });
        if (failStatus) throw new ApiError(failStatus);
        return { id: 'resolved-owned-site' };
    };
    class MerchantError extends Error {}
    const modules = {
        'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
        '@letbuyy/api-client': { LetbuyyApiError: ApiError },
        '@/lib/api/client': {
            MerchantApiRequestError: MerchantError,
            createMerchantApiClient: () => ({ stores: { get: get('id'), getByHandle: get('handle') } }),
            merchantApiErrorResponse: () => Response.json({ error: 'Unavailable' }, { status: 503 }),
        },
    };
    const retrySource = readFileSync(new URL('../src/lib/api/read-retry.ts', import.meta.url), 'utf8');
    const retryJs = ts.transpileModule(retrySource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const retryExports = {};
    new Function('require', 'exports', retryJs)(name => {
        const dependency = name === './client' ? modules['@/lib/api/client'] : modules[name];
        assert.ok(dependency, name); return dependency;
    }, retryExports);
    modules['@/lib/api/read-retry'] = retryExports;
    const source = readFileSync(new URL('../src/lib/stores/resolve-owned-store.ts', import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    new Function('require', 'exports', js)(name => { assert.ok(modules[name], name); return modules[name]; }, exports);
    return { ...exports, calls };
}

test('the actual store resolver sends standard site UUIDs to the owned ID endpoint', async () => {
    for (const id of ['e001e3e7-e349-4064-ba85-806422b695d6', 'E001E3E7-E349-4064-BA85-806422B695D6']) {
        const r = resolver();
        assert.deepEqual(await r.resolveOwnedStoreId(id), { storeId: 'resolved-owned-site' });
        assert.deepEqual(r.calls, [{ kind: 'id', value: id }]);
    }
});

test('merchant handles retain the handle endpoint', async () => {
    const r = resolver();
    assert.deepEqual(await r.resolveOwnedStoreId('synthetic-threadline'), { storeId: 'resolved-owned-site' });
    assert.deepEqual(r.calls, [{ kind: 'handle', value: 'synthetic-threadline' }]);
});

test('an ID lookup cannot fall back to a handle or hide a transient failure', async () => {
    for (const [status, expected] of [[401, 401], [403, 404], [404, 404], [503, 503]]) {
        const r = resolver({ failStatus: status });
        const result = await r.resolveOwnedStoreId('e001e3e7-e349-4064-ba85-806422b695d6');
        assert.equal(result.error.status, expected);
        assert.equal(r.calls.length, status === 503 ? 2 : 1, 'only the admitted transient response gets one bounded retry');
        assert.ok(r.calls.every(call => call.kind === 'id' && call.value === 'e001e3e7-e349-4064-ba85-806422b695d6'), 'no retry can fall back to a handle or change identity');
        assert.equal(result.storeId, undefined);
    }
});
