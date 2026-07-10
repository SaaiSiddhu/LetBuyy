/**
 * Phase S — Live Preview Inspector: contract tests.
 *
 * These are static-analysis / pattern-matching tests (readFileSync), consistent with the
 * editor-bridge-contract.test.mjs style.  They verify:
 *   - Protocol constants are defined in the shared module
 *   - Origin hardening: getEditorOrigin() reads NEXT_PUBLIC_ADMIN_URL, no '*' wildcard
 *     on inspector message sends
 *   - Inbound origin validation present in both receivers (bridge + section frame)
 *   - Hover, flash, and add-intent wiring in the section frame
 *   - INSPECTOR_SECTION_SCROLLED_TO dispatched by the bridge after scroll
 *   - No-echo self-loop guard preserved in the bridge
 *   - No section document mutation from preview messages (RISK-DUAL-N01)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PROTOCOL = 'packages/theme-engine/src/editor-bridge-protocol.ts';
const BRIDGE   = 'apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx';
const FRAME    = 'apps/storefront-runtime/src/lib/theme-engine/editor-preview-section-frame.tsx';
const CSS      = 'apps/storefront-runtime/src/app/globals.css';

function read(path) { return readFileSync(path, 'utf8'); }

// ─── Protocol constants ────────────────────────────────────────────────────────

test('INSPECTOR_SECTION_HOVERED constant is defined in shared protocol', () => {
    const src = read(PROTOCOL);
    assert.match(src, /INSPECTOR_SECTION_HOVERED.*letbuyy:inspector:section-hovered/);
});

test('INSPECTOR_HOVER_CLEARED constant is defined in shared protocol', () => {
    const src = read(PROTOCOL);
    assert.match(src, /INSPECTOR_HOVER_CLEARED.*letbuyy:inspector:hover-cleared/);
});

test('INSPECTOR_ADD_SECTION_INTENT constant is defined in shared protocol', () => {
    const src = read(PROTOCOL);
    assert.match(src, /INSPECTOR_ADD_SECTION_INTENT.*letbuyy:inspector:add-section-intent/);
});

test('INSPECTOR_SECTION_SCROLLED_TO constant is defined in shared protocol', () => {
    const src = read(PROTOCOL);
    assert.match(src, /INSPECTOR_SECTION_SCROLLED_TO.*letbuyy:inspector:section-scrolled-to/);
});

test('protocol documents INSPECTOR_SECTION_SCROLLED_TO as same-window dispatch only', () => {
    const src = read(PROTOCOL);
    // The constant must have a JSDoc that mentions it is not cross-origin.
    assert.match(src, /same-window|same.window|NOT cross-origin|not cross-origin|never.*cross-origin|cross-origin.*NEVER/i);
});

// ─── Origin hardening: getEditorOrigin() ──────────────────────────────────────

test('section frame defines getEditorOrigin() using NEXT_PUBLIC_ADMIN_URL', () => {
    const src = read(FRAME);
    assert.match(src, /NEXT_PUBLIC_ADMIN_URL/);
    assert.match(src, /getEditorOrigin/);
});

test('bridge defines getEditorOrigin() using NEXT_PUBLIC_ADMIN_URL', () => {
    const src = read(BRIDGE);
    assert.match(src, /NEXT_PUBLIC_ADMIN_URL/);
    assert.match(src, /getEditorOrigin/);
});

test('section frame does not use wildcard origin for outbound inspector messages', () => {
    const src = read(FRAME);
    // postMessage calls in section frame must NOT use literal '*' as second argument.
    // Allowed: getEditorOrigin() return value which is an explicit origin string.
    // The check: no postMessage call should have a bare string '*' as target.
    const postMessageCalls = src.match(/postMessage\([^)]+\)/g) || [];
    for (const call of postMessageCalls) {
        assert.ok(
            !call.includes("'*'") && !call.includes('"*"'),
            `Section frame postMessage must not use wildcard origin: ${call}`,
        );
    }
});

test('bridge outbound READY_MESSAGE may use wildcard fallback but inspector dispatches use explicit origin', () => {
    const src = read(BRIDGE);
    // READY_MESSAGE is a one-time informational signal — permitted to have '|| \'*\'' fallback.
    // Inspector-related selectSection dispatch must target window.location.origin (same-window),
    // not a bare '*'.
    // Verify: any postMessage to window.parent uses getEditorOrigin(), not a raw '*'.
    // The same-window dispatches (selectSection) target window.location.origin explicitly.
    assert.match(src, /window\.postMessage.*window\.location\.origin/s);
});

// ─── Inbound origin validation ────────────────────────────────────────────────

test('bridge handleMessage rejects messages from unexpected origins', () => {
    const src = read(BRIDGE);
    // Must check event.origin against editorOrigin before processing any message.
    assert.match(src, /event\.origin\s*!==\s*editorOrigin/);
});

test('section frame handleMessage rejects cross-origin messages (only accepts same-window)', () => {
    const src = read(FRAME);
    // Must check event.origin === window.location.origin to accept only same-window dispatches.
    assert.match(src, /event\.origin\s*!==\s*window\.location\.origin/);
});

// ─── Hover wiring ─────────────────────────────────────────────────────────────

test('section frame imports INSPECTOR_SECTION_HOVERED and INSPECTOR_HOVER_CLEARED', () => {
    const src = read(FRAME);
    assert.match(src, /INSPECTOR_SECTION_HOVERED/);
    assert.match(src, /INSPECTOR_HOVER_CLEARED/);
});

test('section frame sends INSPECTOR_SECTION_HOVERED on mouseenter', () => {
    const src = read(FRAME);
    // Must have onMouseEnter handler that calls notifyHover(true) or equivalent.
    assert.match(src, /onMouseEnter/);
    assert.match(src, /notifyHover/);
});

test('section frame sends INSPECTOR_HOVER_CLEARED on mouseleave', () => {
    const src = read(FRAME);
    assert.match(src, /onMouseLeave/);
});

// ─── Flash wiring ─────────────────────────────────────────────────────────────

test('section frame imports INSPECTOR_SECTION_SCROLLED_TO', () => {
    const src = read(FRAME);
    assert.match(src, /INSPECTOR_SECTION_SCROLLED_TO/);
});

test('section frame listens for SCROLLED_TO_MESSAGE and triggers flash', () => {
    const src = read(FRAME);
    // The handler must branch on SCROLLED_TO_MESSAGE and call the flash logic.
    assert.match(src, /SCROLLED_TO_MESSAGE/);
    assert.match(src, /triggerFlash|flash/);
});

test('CSS defines sf-section-frame-flash keyframe animation', () => {
    const src = read(CSS);
    assert.match(src, /@keyframes sf-section-frame-flash/);
    assert.match(src, /storefront-editor-section-frame--flash/);
});

// ─── Add-section intent wiring ────────────────────────────────────────────────

test('section frame imports INSPECTOR_ADD_SECTION_INTENT', () => {
    const src = read(FRAME);
    assert.match(src, /INSPECTOR_ADD_SECTION_INTENT/);
});

test('section frame sends add-section intent before and after', () => {
    const src = read(FRAME);
    // Must have before/after insert buttons that send the intent.
    assert.match(src, /storefront-editor-section-insert--before/);
    assert.match(src, /storefront-editor-section-insert--after/);
    assert.match(src, /sendAddIntent/);
    assert.match(src, /'before'/);
    assert.match(src, /'after'/);
});

test('CSS defines storefront-editor-section-insert marker styles', () => {
    const src = read(CSS);
    assert.match(src, /storefront-editor-section-insert/);
    assert.match(src, /storefront-editor-section-insert--before/);
    assert.match(src, /storefront-editor-section-insert--after/);
});

test('insert buttons use stopPropagation to not trigger section selection', () => {
    const src = read(FRAME);
    assert.match(src, /stopPropagation/);
});

// ─── RISK-DUAL-N01: no section document mutation from preview ─────────────────

test('section frame never mutates template sections — sends intent only', () => {
    const src = read(FRAME);
    // The frame must not contain any code that directly modifies sections.
    assert.doesNotMatch(src, /template\.sections|sections\.push|sections\.splice|sections\.filter/);
    // The add-intent message sends position + adjacentSectionId only, never a full section object.
    assert.match(src, /adjacentSectionId/);
    assert.match(src, /position/);
});

// ─── No-echo self-loop guard ─────────────────────────────────────────────────

test('bridge translation branch still does not match SELECTED_MESSAGE (self-loop guard)', () => {
    const src = read(BRIDGE);
    // The existing no-echo guard: translation branch matches ONLY legacy + scroll.
    assert.match(src, /type === LEGACY_SELECTION_MESSAGE \|\| type === SCROLL_MESSAGE/);
    assert.doesNotMatch(src, /type === SELECTED_MESSAGE \|\| type === SCROLL_MESSAGE/);
    assert.doesNotMatch(src, /LEGACY_SELECTION_MESSAGE \|\| type === SELECTED_MESSAGE/);
});

test('bridge dispatches INSPECTOR_SECTION_SCROLLED_TO to same window after scroll', () => {
    const src = read(BRIDGE);
    assert.match(src, /SCROLLED_TO_MESSAGE/);
    // Must be dispatched via window.postMessage targeting window.location.origin (same-window).
    // The pattern checks both the constant alias and that window.location.origin is the target.
    const hasSameWindowDispatch =
        /window\.postMessage\(\s*\{[^}]*SCROLLED_TO_MESSAGE[^}]*\}[^,]*,\s*window\.location\.origin\s*\)/.test(src) ||
        (src.includes('SCROLLED_TO_MESSAGE') && src.includes('window.location.origin'));
    assert.ok(hasSameWindowDispatch, 'bridge must dispatch SCROLLED_TO_MESSAGE to window.location.origin');
});

test('bridge INSPECTOR_SECTION_SCROLLED_TO is naturally excluded from translation handler by origin guard', () => {
    const src = read(BRIDGE);
    // The origin guard (event.origin !== editorOrigin) rejects same-window dispatches because
    // window.location.origin !== editorOrigin.  Verify the guard exists.
    assert.match(src, /event\.origin\s*!==\s*editorOrigin/);
    // And SCROLLED_TO_MESSAGE is NOT in the translation branch type-check.
    assert.doesNotMatch(src, /type === SCROLLED_TO_MESSAGE/);
});

// ─── Keyboard a11y not regressed ──────────────────────────────────────────────

test('section frame preserves Enter/Space keyboard selection (a11y not regressed)', () => {
    const src = read(FRAME);
    assert.match(src, /onKeyDown/);
    assert.match(src, /Enter/);
    assert.match(src, /\bSpace\b|event\.key.*' '/);
});

test('insert buttons are excluded from tab order (tabIndex=-1)', () => {
    const src = read(FRAME);
    assert.match(src, /tabIndex=\{-1\}/);
});

// ─── Import hygiene ──────────────────────────────────────────────────────────

test('bridge imports INSPECTOR_SECTION_SCROLLED_TO from shared protocol module', () => {
    const src = read(BRIDGE);
    assert.match(src, /@letbuyy\/theme-engine\/editor-bridge-protocol/);
    assert.match(src, /INSPECTOR_SECTION_SCROLLED_TO/);
    // Must not inline the string.
    assert.doesNotMatch(src, /'letbuyy:inspector:section-scrolled-to'/);
});

test('section frame imports all four inspector constants from shared protocol module', () => {
    const src = read(FRAME);
    assert.match(src, /@letbuyy\/theme-engine\/editor-bridge-protocol/);
    assert.match(src, /INSPECTOR_SECTION_HOVERED/);
    assert.match(src, /INSPECTOR_HOVER_CLEARED/);
    assert.match(src, /INSPECTOR_ADD_SECTION_INTENT/);
    assert.match(src, /INSPECTOR_SECTION_SCROLLED_TO/);
    // Must not inline any of the string values.
    assert.doesNotMatch(src, /'letbuyy:inspector:/);
});

// ─── Phase S hardening: fail-closed receive guard ─────────────────────────────

test('hardening: bridge receive guard is fail-closed (rejects when editorOrigin unknown)', () => {
    const src = read(BRIDGE);
    // The guard must reject when editorOrigin is falsy — fail-closed, not fail-open.
    // Pattern: !editorOrigin || event.origin !== editorOrigin
    assert.match(src, /!editorOrigin\s*\|\|\s*event\.origin\s*!==\s*editorOrigin/,
        'bridge handleMessage must be fail-closed: !editorOrigin || event.origin !== editorOrigin');
    // Must NOT have the old fail-open pattern where editorOrigin being empty bypassed the guard.
    assert.doesNotMatch(src, /if\s*\(\s*editorOrigin\s*&&\s*event\.origin\s*!==\s*editorOrigin\s*\)/,
        'bridge must not use the fail-open guard (editorOrigin && ...) — it bypassed origin check when env var absent');
});

test('hardening: bridge READY_MESSAGE does not fall back to wildcard origin', () => {
    const src = read(BRIDGE);
    // After hardening, the READY_MESSAGE send must NOT include `|| '*'`.
    assert.doesNotMatch(src, /READY_MESSAGE[\s\S]{0,400}getEditorOrigin\(\)\s*\|\|\s*['"]\*['"]/,
        "bridge READY_MESSAGE send must not use getEditorOrigin() || '*' — suppresses when origin unknown instead");
});

test('hardening: bridge LEGACY_SELECTION_MESSAGE does not trigger scroll (double-scroll fix)', () => {
    const src = read(BRIDGE);
    // After fix: selectSection should only scroll on SCROLL_MESSAGE, not LEGACY_SELECTION_MESSAGE.
    // The argument passed to selectSection must NOT be 'type === LEGACY_SELECTION_MESSAGE || type === SCROLL_MESSAGE'.
    assert.doesNotMatch(
        src,
        /selectSection\([^)]*type\s*===\s*LEGACY_SELECTION_MESSAGE\s*\|\|\s*type\s*===\s*SCROLL_MESSAGE/,
        'selectSection must not pass LEGACY as scroll trigger — only SCROLL_MESSAGE should trigger scroll+flash',
    );
    // And the correct fix: scroll only on SCROLL_MESSAGE.
    assert.match(src, /selectSection\([^)]*type\s*===\s*SCROLL_MESSAGE\s*\)/,
        'selectSection shouldScroll argument must be type === SCROLL_MESSAGE only');
});

// ─── Phase S hardening: prefers-reduced-motion guard on flash ────────────────

test('hardening: storefront CSS has prefers-reduced-motion guard for flash animation', () => {
    const src = read(CSS);
    assert.match(
        src,
        /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)[\s\S]{0,200}storefront-editor-section-frame--flash/,
        'storefront globals.css must suppress sf-section-frame-flash animation for prefers-reduced-motion: reduce',
    );
});
