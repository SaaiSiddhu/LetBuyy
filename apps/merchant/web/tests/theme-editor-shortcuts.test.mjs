import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const { JSDOM } = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url))('jsdom');
const file = new URL('../src/app/[store]/online-store/themes/[themeId]/editor/page.tsx', import.meta.url);
const source = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map();
function visit(node) { if (ts.isFunctionDeclaration(node) && ['handleKeyDown', 'isTextEditingTarget'].includes(node.name?.text)) functions.set(node.name.text, node.getText(source)); ts.forEachChild(node, visit); }
visit(source);
assert.equal(functions.size, 2);
const code = ts.transpileModule([...functions.values()].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function fixture() {
    const dom = new JSDOM('<main><input id="text"><textarea></textarea><div contenteditable="true"><span>Editor text</span></div><input type="checkbox"><button>Canvas action</button></main>');
    const calls = { save: 0, undo: 0, redo: 0 };
    const handle = new Function('Element', 'handleSave', 'undo', 'redo', code + ';return handleKeyDown;')(dom.window.Element, () => calls.save++, () => calls.undo++, () => calls.redo++);
    dom.window.document.addEventListener('keydown', handle);
    const send = (selector, key, changes = {}) => { const event = new dom.window.KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...changes }); dom.window.document.querySelector(selector).dispatchEvent(event); return event; };
    return { dom, calls, send };
}
test('actual editor shortcut handler leaves native text undo/redo intact while retaining save', () => {
    const f = fixture();
    for (const selector of ['#text', 'textarea', '[contenteditable] span']) {
        assert.equal(f.send(selector, 'z').defaultPrevented, false);
        assert.equal(f.send(selector, 'y').defaultPrevented, false);
    }
    assert.deepEqual(f.calls, { save: 0, undo: 0, redo: 0 });
    assert.equal(f.send('#text', 's').defaultPrevented, true); assert.equal(f.calls.save, 1);
    f.dom.window.close();
});
test('canvas and boolean controls still use document undo/redo; composition and modifier combinations stay untouched', () => {
    const f = fixture();
    assert.equal(f.send('button', 'z').defaultPrevented, true);
    assert.equal(f.send('input[type="checkbox"]', 'z', { shiftKey: true }).defaultPrevented, true);
    assert.deepEqual(f.calls, { save: 0, undo: 1, redo: 1 });
    f.send('button', 'z', { altKey: true }); f.send('button', 'z', { isComposing: true });
    assert.deepEqual(f.calls, { save: 0, undo: 1, redo: 1 });
    f.dom.window.close();
});
