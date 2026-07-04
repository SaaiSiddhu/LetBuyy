import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const CENTER_PANEL = 'apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx';
const BRIDGE = 'apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx';
const FRAME = 'apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx';
const PROTOCOL = 'packages/theme-engine/src/editor-bridge-protocol.ts';
const PROTOCOL_INDEX = 'packages/theme-engine/src/index.ts';

function read(path) { return readFileSync(path, 'utf8'); }

test('editor bridge protocol constants are defined in the shared module', () => {
    const src = read(PROTOCOL);
    assert.match(src, /EDITOR_LEGACY_SELECTION_MESSAGE.*LETBUYY_THEME_EDITOR_SELECTION/);
    assert.match(src, /EDITOR_SELECTION_MESSAGE.*letbuyy:theme-editor:section-selected/);
    assert.match(src, /EDITOR_SECTION_SELECT_MESSAGE.*letbuyy:theme-editor:section-select/);
});

test('theme-engine index re-exports editor bridge protocol', () => {
    const src = read(PROTOCOL_INDEX);
    assert.match(src, /export \* from.*editor-bridge-protocol/);
});

test('CenterPanel emits both legacy and modern selection message names', () => {
    const src = read(CENTER_PANEL);
    assert.match(src, /EDITOR_LEGACY_SELECTION_MESSAGE/);
    assert.match(src, /EDITOR_SELECTION_MESSAGE/);
    // Both postMessage calls must be present (legacy + modern dual-emit)
    const postCount = (src.match(/postMessage/g) || []).length;
    assert.ok(postCount >= 2, 'CenterPanel must postMessage at least twice (legacy + modern)');
});

test('storefront preview bridge handles both legacy and modern selection names', () => {
    const src = read(BRIDGE);
    assert.match(src, /EDITOR_LEGACY_SELECTION_MESSAGE|LEGACY_SELECTION_MESSAGE/);
    assert.match(src, /EDITOR_SELECTION_MESSAGE|SELECTED_MESSAGE/);
    // Uses imported constants, not inline strings
    assert.doesNotMatch(src, /'LETBUYY_THEME_EDITOR_SELECTION'/);
    assert.doesNotMatch(src, /'letbuyy:theme-editor:section-selected'/);
});

test('preview bridge translation branch must not match the modern selection message (self-loop guard)', () => {
    const src = read(BRIDGE);
    // selectSection() re-posts SELECTED_MESSAGE to the same window; if the handler's translation
    // branch matched SELECTED_MESSAGE it would re-enter itself forever. Guard the exact branch shape.
    assert.match(src, /type === LEGACY_SELECTION_MESSAGE \|\| type === SCROLL_MESSAGE/);
    assert.doesNotMatch(src, /type === SELECTED_MESSAGE \|\| type === SCROLL_MESSAGE/);
    assert.doesNotMatch(src, /LEGACY_SELECTION_MESSAGE \|\| type === SELECTED_MESSAGE/);
});

test('section frame listens for modern selection message name from shared constant', () => {
    const src = read(FRAME);
    assert.match(src, /EDITOR_SELECTION_MESSAGE|SELECTED_MESSAGE/);
    assert.doesNotMatch(src, /'letbuyy:theme-editor:section-selected'/);
});
