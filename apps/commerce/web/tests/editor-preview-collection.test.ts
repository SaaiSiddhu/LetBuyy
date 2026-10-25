import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const id = '33333333-3333-4333-8333-333333333333';
const file = new URL('../src/app/preview/preview-content.tsx', import.meta.url);
const tree = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fn = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'loadEditorPreviewCollection');
assert.ok(fn);
const code = ts.transpileModule(fn.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(value: unknown = { id, title: 'Owned collection beyond the initial list page', description: 'Owned description', image_url: null }, failure?: unknown) {
    const calls: unknown[][] = [];
    const client = (options: unknown) => { calls.push(['client', options]); return { storefront: { themePreviewCollection: async (...args: unknown[]) => { calls.push(['collection', ...args]); if (failure) throw failure; return value; } } }; };
    return { calls, read: new Function('createStorefrontApiClient', code + ';return loadEditorPreviewCollection;')(client) as (subdomain: string, token: string, id: string) => Promise<{ id: string; title: string }> };
}
test('private collection adapter uses the exact signed singleton and no-store wrapper, independent of the first list page', async () => {
    const f = fixture();
    assert.equal((await f.read('owned-store', 'synthetic-token', id)).id, id);
    assert.deepEqual(f.calls, [['client', { cache: 'no-store' }], ['collection', 'owned-store', 'synthetic-token', id]]);
});
test('mismatched/absent collection or capability-bearing failure remains unavailable and sanitized', async () => {
    for (const f of [fixture({ id: 'foreign', title: 'Foreign' }), fixture(null), fixture(undefined, new Error('https://private.invalid/?token=SYNTHETIC_SECRET'))]) {
        await assert.rejects(f.read('owned-store', 'synthetic-token', id), error => error instanceof Error && error.message === 'The selected preview collection is unavailable. Retry the preview.');
    }
});
