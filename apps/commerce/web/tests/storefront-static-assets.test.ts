import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

test('the actual storefront matcher serves public theme files without exempting tenant routes', () => {
    const source = ts.createSourceFile('proxy.ts', readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    const declaration = source.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(source) === 'config'));
    assert.ok(declaration);
    const js = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exported: { config?: { matcher: string[] } } = {};
    new Function('exports', js)(exported);
    const matchers = exported.config!.matcher.map(pattern => new RegExp(`^${pattern}$`));
    const gated = (path: string) => matchers.some(matcher => matcher.test(path));
    for (const path of ['/theme-assets/threadline/v2/hero.webp', '/theme-assets/threadline/v2/linen-shirt.webp', '/theme-previews/threadline-2.0.0.webp']) {
        assert.equal(gated(path), false, path);
    }
    for (const path of ['/products', '/product/shirt', '/store/another/account', '/checkout-origin/checkout', '/contact', '/store-access/password', '/products/private.json']) {
        assert.equal(gated(path), true, path);
    }
});
