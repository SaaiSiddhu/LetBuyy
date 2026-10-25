import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const { JSDOM } = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url))('jsdom');
const source = name => { const path = new URL(`../src/components/theme-editor/${name}.tsx`, import.meta.url); return ts.createSourceFile(path.pathname, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); };
const treeSource = source('SectionTreePanel');
function evaluate(node, file, dependencies) {
    const code = ts.transpileModule(`const handler = ${node.getText(file)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function(...Object.keys(dependencies), code + ';return handler;')(...Object.values(dependencies));
}
function navigation(root) {
    let callback;
    function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(treeSource) === 'handleTreeKeyDown') callback = node.initializer; ts.forEachChild(node, visit); }
    visit(treeSource); assert.ok(callback);
    return evaluate(callback, treeSource, { treeRef: { current: root } });
}
function activation(file, functionName, dependencies) {
    const fn = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === functionName);
    assert.ok(fn); let callback;
    function visit(node) { if (ts.isJsxAttribute(node) && node.name.getText(file) === 'onKeyDown') callback = node.initializer.expression; ts.forEachChild(node, visit); }
    visit(fn); assert.ok(callback); return evaluate(callback, file, dependencies);
}
function fixture() {
    const dom = new JSDOM('<div id="tree"><div role="treeitem" tabindex="-1" id="header"></div><div role="treeitem" tabindex="-1" id="body"><div role="group"><div role="treeitem" tabindex="-1" id="first"><button>Same label</button></div><div role="treeitem" tabindex="-1" id="second"><button>Same label</button></div></div></div><div role="treeitem" tabindex="-1" id="footer"></div><select><option>Section type</option></select></div>');
    const root = dom.window.document.getElementById('tree'); root.addEventListener('keydown', navigation(root));
    const send = (selector, key) => { const element = root.querySelector(selector); element.focus(); const event = new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); element.dispatchEvent(event); return event; };
    return { dom, root, send };
}
test('actual tree key handler navigates exact nested instances and all groups while leaving the insertion select native', () => {
    const f = fixture();
    try {
        f.send('#second button', 'ArrowDown'); assert.equal(f.dom.window.document.activeElement.id, 'footer');
        f.send('#second button', 'ArrowUp'); assert.equal(f.dom.window.document.activeElement.id, 'first');
        f.send('#second button', 'Home'); assert.equal(f.dom.window.document.activeElement.id, 'header');
        f.send('#header', 'End'); assert.equal(f.dom.window.document.activeElement.id, 'footer');
        assert.equal(f.send('select', 'ArrowDown').defaultPrevented, false);
    } finally { f.dom.window.close(); }
});
test('actual section/block activation handles focused tree rows once and preserves native button activation', () => {
    const f = fixture(), selected = [];
    f.root.querySelector('#body').addEventListener('keydown', activation(treeSource, 'TreeSectionRow', { onSelect: () => selected.push('body') }));
    f.root.querySelector('#second').addEventListener('keydown', activation(source('BlockChildRow'), 'BlockChildRow', { onSelectBlock: id => selected.push(id), block: { id: 'second' } }));
    try {
        assert.equal(f.send('#body', 'Enter').defaultPrevented, true);
        assert.equal(f.send('#second', ' ').defaultPrevented, true);
        assert.deepEqual(selected, ['body', 'second']);
        assert.equal(f.send('#second button', 'Enter').defaultPrevented, false);
        assert.deepEqual(selected, ['body', 'second']);
    } finally { f.dom.window.close(); }
});
