import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as protocol from '@letbuyy/theme-engine/editor-bridge-protocol';

const file = new URL('../src/components/theme-editor/CenterPanel.tsx', import.meta.url);
const source = ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'handleMessage') handler = node; ts.forEachChild(node, visit); }
visit(source); assert.ok(handler, 'The actual CenterPanel message handler exists');
const code = ts.transpileModule(handler.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const context = { sessionId: '33333333-3333-4333-8333-333333333333', revision: 4, templateKey: 'page.faq' };
const origin = 'https://storefront.example.invalid';
function fixture() {
    const frame = {}, calls = { section: [], block: [], hover: [], add: [], ready: 0 };
    const iframeLoadedRef = { current: false }, previewReadyRef = { current: false };
    const dependencies = {
        ...protocol, previewOrigin: origin, previewContext: context, iframeRef: { current: { contentWindow: frame } },
        identities: protocol.createEditorPreviewIdentityIndex([{ id: 'hero', type: 'Hero', blocks: [{ id: 'parent', children: [{ id: 'second' }] }] }]),
        onSelectSection: id => calls.section.push(id), onSelectBlock: (...ids) => calls.block.push(ids),
        setHoveredSection: value => calls.hover.push(value), onHoverSection: () => {}, onAddSectionIntent: (...args) => calls.add.push(args),
        iframeLoadedRef, previewReadyRef, setFrameError: value => calls.frameError = value, postSelectionToPreview: () => calls.ready++,
    };
    const receive = new Function(...Object.keys(dependencies), code + ';return handleMessage;')(...Object.values(dependencies));
    const send = (data, changes = {}) => receive({ origin, source: frame, data: { context, ...data }, ...changes });
    return { calls, send, frame, iframeLoadedRef, previewReadyRef };
}
const selection = { type: protocol.EDITOR_SECTION_SELECT_MESSAGE, sectionId: 'hero', blockId: 'second', blockPath: ['parent', 'second'] };
test('the actual parent handler selects the exact block only from its own current iframe', () => {
    const f = fixture(); f.send(selection);
    assert.deepEqual(f.calls.block, [['hero', 'second']]); assert.deepEqual(f.calls.section, []);
    f.send({ type: protocol.EDITOR_SECTION_SELECT_MESSAGE, sectionId: 'hero' });
    assert.deepEqual(f.calls.section, ['hero']);
});
test('the current iframe ready handshake reapplies selection/mode after its listeners are mounted', () => {
    const f = fixture();
    f.send({ type: protocol.EDITOR_READY_MESSAGE });
    assert.equal(f.iframeLoadedRef.current, true); assert.equal(f.calls.ready, 1);
    assert.equal(f.previewReadyRef.current, true); assert.equal(f.calls.frameError, null);
    f.send({ type: protocol.EDITOR_READY_MESSAGE, context: { ...context, revision: 3 } });
    assert.equal(f.calls.ready, 1);
});
test('parent rejects wrong source/origin, stale context, forged ancestry and unknown/prototype IDs after a positive control', () => {
    const f = fixture(); f.send(selection); assert.equal(f.calls.block.length, 1);
    f.send(selection, { source: {} }); f.send(selection, { origin: 'https://foreign.example.invalid' });
    for (const contextChange of [{ revision: 3 }, { templateKey: 'index' }, { resourceId: 'another-page' }, { page: 2 }, { sessionId: '44444444-4444-4444-8444-444444444444' }]) f.send({ ...selection, context: { ...context, ...contextChange } });
    f.send({ ...selection, context: undefined }); f.send({ ...selection, blockPath: ['second'] });
    f.send({ ...selection, blockId: 'unknown' }); f.send({ ...selection, sectionId: 'constructor' });
    assert.equal(f.calls.block.length, 1); assert.equal(f.calls.section.length, 0);
});
test('hover labels and add intents use current document membership rather than payload authority', () => {
    const f = fixture();
    f.send({ ...selection, type: protocol.INSPECTOR_SECTION_HOVERED, sectionType: 'Forged label' });
    assert.deepEqual(f.calls.hover, [{ sectionId: 'hero', sectionType: 'Hero' }]);
    f.send({ type: protocol.INSPECTOR_ADD_SECTION_INTENT, adjacentSectionId: 'unknown', position: 'after' });
    assert.deepEqual(f.calls.add, []);
    f.send({ type: protocol.INSPECTOR_ADD_SECTION_INTENT, adjacentSectionId: 'hero', position: 'after' });
    assert.deepEqual(f.calls.add, [['hero', 'after']]);
});

test('the actual frame readiness effect reports timeout, accepts only a verified ready signal and cancels on navigation', () => {
    let effect;
    function find(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('window.setTimeout')) effect = node.arguments[0];
        ts.forEachChild(node, find);
    }
    find(source); assert.ok(effect);
    const effectCode = ts.transpileModule(`const effect = ${effect.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const f = fixture(), errors = [], timers = [], cleared = [];
    const deps = { previewUrl: `${origin}/preview`, iframeLoadedRef: f.iframeLoadedRef, previewReadyRef: f.previewReadyRef,
        setFrameError: value => errors.push(value), setHoveredSection: () => {},
        window: { setTimeout: (callback, delay) => { timers.push({ callback, delay }); return 17; }, clearTimeout: id => cleared.push(id) } };
    const install = new Function(...Object.keys(deps), effectCode + ';return effect;')(...Object.values(deps));
    const cleanup = install();
    assert.equal(timers[0].delay, 20000);
    timers[0].callback();
    assert.match(errors.at(-1), /saved draft is kept/);
    f.send({ type: protocol.EDITOR_READY_MESSAGE, context: { ...context, revision: 3 } });
    assert.equal(f.previewReadyRef.current, false, 'stale iframe cannot suppress the error');
    f.send({ type: protocol.EDITOR_READY_MESSAGE });
    assert.equal(f.previewReadyRef.current, true);
    const count = errors.length;
    timers[0].callback(); assert.equal(errors.length, count, 'verified readiness suppresses the timeout');
    cleanup(); assert.deepEqual(cleared, [17]);
});
