import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { resolveFieldOptions } from '@letbuyy/theme-engine';
const require = createRequire(new URL('../package.json', import.meta.url));
const { renderToStaticMarkup } = require('react-dom/server');
const file = new URL('../src/components/theme-editor/SchemaFormRenderer.tsx', import.meta.url);
const tree = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['SelectInput', 'RadioInput', 'PreservedSetting', 'FieldRenderer'];
const declarations = names.map(name => { const node = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name); assert.ok(node); return node.getText(tree); });
const code = ts.transpileModule(declarations.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const views = new Function('require', 'exports', 'resolveFieldOptions', 'useId', 'useCallback', 'RequiredMark', 'FieldHelp', 'Button', code + ';return {SelectInput,RadioInput,PreservedSetting,FieldRenderer};')(require, {}, resolveFieldOptions, () => 'synthetic-setting', callback => callback, () => null, () => null, 'button');
function nodes(element, predicate) {
    if (Array.isArray(element)) return element.flatMap(child => nodes(child, predicate));
    if (!element || typeof element !== 'object' || !element.props) return [];
    return [...(predicate(element) ? [element] : []), ...nodes(element.props.children, predicate)];
}
const options = [{ value: false, label: 'Keep disabled' }, { value: 0, label: 'Zero units' }, { value: '0', label: 'String zero' }];
test('actual select view preserves declared labels and boolean/numeric/string identities across a change', () => {
    const changes = [];
    const view = views.SelectInput({ label: 'Typed choice', value: false, options, onChange: value => changes.push(value) });
    const select = nodes(view, node => node.type === 'select')[0];
    assert.equal(select.props.value, '0');
    assert.deepEqual(nodes(view, node => node.type === 'option').slice(1).map(node => node.props.children), options.map(option => option.label));
    for (const value of ['0', '1', '2']) select.props.onChange({ target: { value } });
    assert.deepEqual(changes, [false, 0, '0']);
});
test('actual radio view keeps false selected and emits the exact declared primitive', () => {
    const changes = [];
    const view = views.RadioInput({ label: 'Typed choice', value: false, options, onChange: value => changes.push(value) });
    const radios = nodes(view, node => node.props.role === 'radio');
    assert.deepEqual(radios.map(node => node.props['aria-checked']), [true, false, false]);
    radios[1].props.onClick(); assert.deepEqual(changes, [0]);
});
test('unknown settings retain their structured saved value in an escaped read-only output', () => {
    let changes = 0;
    const value = { enabled: false, count: 0, markup: '<script>untrusted</script>' };
    const rendered = renderToStaticMarkup(views.FieldRenderer({ fieldKey: 'future', field: { type: 'future_control', label: 'Future setting' }, value, onChange: () => changes++ }));
    assert.match(rendered, /saved value is preserved/); assert.match(rendered, /&lt;script&gt;/);
    assert.doesNotMatch(rendered, /<input|<textarea|<script/); assert.equal(changes, 0);
});
