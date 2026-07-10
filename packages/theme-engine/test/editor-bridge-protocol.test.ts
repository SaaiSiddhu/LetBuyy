/**
 * editor-bridge-protocol — Phase S contract tests.
 *
 * Asserts that all protocol constants exist, carry the correct string values,
 * and are collision-free. Both the editor (CenterPanel) and the preview
 * (StorefrontPreviewBridge, EditorPreviewSectionFrame) must import from this
 * shared module — a rename here is a breaking change, not a refactor.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    EDITOR_LEGACY_SELECTION_MESSAGE,
    EDITOR_SELECTION_MESSAGE,
    EDITOR_SECTION_SELECT_MESSAGE,
    EDITOR_READY_MESSAGE,
    EDITOR_SCROLL_MESSAGE,
    EDITOR_VIEWPORT_MESSAGE,
    EDITOR_LEGACY_VIEWPORT_MESSAGE,
    INSPECTOR_SECTION_HOVERED,
    INSPECTOR_HOVER_CLEARED,
    INSPECTOR_ADD_SECTION_INTENT,
    INSPECTOR_SECTION_SCROLLED_TO,
} from '../src/editor-bridge-protocol.ts';

// ── Value contracts ────────────────────────────────────────────────────────────

test('editor-bridge-protocol: EDITOR_LEGACY_SELECTION_MESSAGE has correct value', () => {
    assert.equal(EDITOR_LEGACY_SELECTION_MESSAGE, 'LETBUYY_THEME_EDITOR_SELECTION');
});

test('editor-bridge-protocol: EDITOR_SELECTION_MESSAGE has correct value', () => {
    assert.equal(EDITOR_SELECTION_MESSAGE, 'letbuyy:theme-editor:section-selected');
});

test('editor-bridge-protocol: EDITOR_SECTION_SELECT_MESSAGE has correct value', () => {
    assert.equal(EDITOR_SECTION_SELECT_MESSAGE, 'letbuyy:theme-editor:section-select');
});

test('editor-bridge-protocol: EDITOR_READY_MESSAGE has correct value', () => {
    assert.equal(EDITOR_READY_MESSAGE, 'letbuyy:storefront-preview:ready');
});

test('editor-bridge-protocol: EDITOR_SCROLL_MESSAGE has correct value', () => {
    assert.equal(EDITOR_SCROLL_MESSAGE, 'letbuyy:theme-editor:section-scroll');
});

test('editor-bridge-protocol: EDITOR_VIEWPORT_MESSAGE has correct value', () => {
    assert.equal(EDITOR_VIEWPORT_MESSAGE, 'letbuyy:theme-editor:viewport');
});

test('editor-bridge-protocol: EDITOR_LEGACY_VIEWPORT_MESSAGE has correct value', () => {
    assert.equal(EDITOR_LEGACY_VIEWPORT_MESSAGE, 'LETBUYY_THEME_EDITOR_VIEWPORT');
});

// ── Phase S — new INSPECTOR_* constants ───────────────────────────────────────

test('editor-bridge-protocol: INSPECTOR_SECTION_HOVERED has correct value', () => {
    assert.equal(INSPECTOR_SECTION_HOVERED, 'letbuyy:inspector:section-hovered');
});

test('editor-bridge-protocol: INSPECTOR_HOVER_CLEARED has correct value', () => {
    assert.equal(INSPECTOR_HOVER_CLEARED, 'letbuyy:inspector:hover-cleared');
});

test('editor-bridge-protocol: INSPECTOR_ADD_SECTION_INTENT has correct value', () => {
    assert.equal(INSPECTOR_ADD_SECTION_INTENT, 'letbuyy:inspector:add-section-intent');
});

test('editor-bridge-protocol: INSPECTOR_SECTION_SCROLLED_TO has correct value', () => {
    assert.equal(INSPECTOR_SECTION_SCROLLED_TO, 'letbuyy:inspector:section-scrolled-to');
});

// ── No collisions across all 11 constants ─────────────────────────────────────

test('editor-bridge-protocol: all 11 message type constants are unique (no collisions)', () => {
    const allValues = [
        EDITOR_LEGACY_SELECTION_MESSAGE,
        EDITOR_SELECTION_MESSAGE,
        EDITOR_SECTION_SELECT_MESSAGE,
        EDITOR_READY_MESSAGE,
        EDITOR_SCROLL_MESSAGE,
        EDITOR_VIEWPORT_MESSAGE,
        EDITOR_LEGACY_VIEWPORT_MESSAGE,
        INSPECTOR_SECTION_HOVERED,
        INSPECTOR_HOVER_CLEARED,
        INSPECTOR_ADD_SECTION_INTENT,
        INSPECTOR_SECTION_SCROLLED_TO,
    ];
    const unique = new Set(allValues);
    assert.equal(
        unique.size,
        allValues.length,
        `Collision detected: expected ${allValues.length} unique values, got ${unique.size}. Duplicates: ${allValues.filter((v, i) => allValues.indexOf(v) !== i).join(', ')}`
    );
});

// ── INSPECTOR_SECTION_SCROLLED_TO must not equal EDITOR_SELECTION_MESSAGE ─────
// The StorefrontPreviewBridge explicitly excludes EDITOR_SELECTION_MESSAGE to avoid the
// self-echo loop. INSPECTOR_SECTION_SCROLLED_TO is also a same-window post and must differ
// so the bridge's exclusion guard continues to protect both.

test('editor-bridge-protocol: INSPECTOR_SECTION_SCROLLED_TO differs from EDITOR_SELECTION_MESSAGE (no-echo guard)', () => {
    assert.notEqual(
        INSPECTOR_SECTION_SCROLLED_TO,
        EDITOR_SELECTION_MESSAGE,
        'INSPECTOR_SECTION_SCROLLED_TO must differ from EDITOR_SELECTION_MESSAGE so the bridge no-echo guard covers both'
    );
});

// ── INSPECTOR_* constants must use the letbuyy:inspector: namespace ────────────

test('editor-bridge-protocol: all INSPECTOR_* constants use the letbuyy:inspector: namespace', () => {
    const inspectorConstants = [
        INSPECTOR_SECTION_HOVERED,
        INSPECTOR_HOVER_CLEARED,
        INSPECTOR_ADD_SECTION_INTENT,
        INSPECTOR_SECTION_SCROLLED_TO,
    ];
    for (const value of inspectorConstants) {
        assert.match(
            value,
            /^letbuyy:inspector:/,
            `${value} must start with 'letbuyy:inspector:'`
        );
    }
});
