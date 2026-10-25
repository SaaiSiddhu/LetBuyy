import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const file = new URL('../src/app/[store]/online-store/themes/[themeId]/editor/page.tsx', import.meta.url);
const tree = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = new Map();
function visit(node) {
    if (ts.isVariableDeclaration(node) && ['changePreviewResource', 'changePreviewBlogPage'].includes(node.name.getText(tree))) callbacks.set(node.name.getText(tree), node.initializer.arguments[0].getText(tree));
    ts.forEachChild(node, visit);
}
visit(tree); assert.equal(callbacks.size, 2);
function fixture(name) {
    const changes = [], counter = { current: 4 };
    const dependencies = { previewResourceId: 'previous-resource', previewBlogPage: 1, previewRequestCounter: counter,
        setPreviewContext: value => changes.push(['context', value]), setPreviewToken: value => changes.push(['token', value]),
        setPreviewResourceId: value => changes.push(['resource', value]), setPreviewBlogPage: value => changes.push(['page', value]),
        setIsDirty: () => assert.fail('Preview navigation must not dirty the document'),
        setEditorState: () => assert.fail('Preview navigation must not edit the document'),
    };
    const code = ts.transpileModule(`const change = ${callbacks.get(name)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const change = new Function(...Object.keys(dependencies), code + ';return change;')(...Object.values(dependencies));
    return { changes, counter, change };
}
test('actual resource and blog page choices invalidate the old capability context without editing or assigning a template', () => {
    const resource = fixture('changePreviewResource'); resource.change('next-resource');
    assert.deepEqual(resource.changes, [['context', null], ['token', null], ['resource', 'next-resource']]); assert.equal(resource.counter.current, 5);
    const blog = fixture('changePreviewBlogPage'); blog.change(2);
    assert.deepEqual(blog.changes, [['context', null], ['token', null], ['page', 2]]); assert.equal(blog.counter.current, 5);
});
test('same choice and invalid blog bounds leave the current preview undisturbed', () => {
    const resource = fixture('changePreviewResource'); resource.change('previous-resource'); assert.deepEqual(resource.changes, []);
    const blog = fixture('changePreviewBlogPage'); for (const page of [1, 0, -1, 1.5, 1001, NaN]) blog.change(page);
    assert.deepEqual(blog.changes, []); assert.equal(blog.counter.current, 4);
});
