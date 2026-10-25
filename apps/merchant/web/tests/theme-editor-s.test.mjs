/**
 * Phase S — Live Preview Inspector: static-contract tests for the merchant-web.
 *
 * These tests assert source-level contracts (file existence, import patterns,
 * postMessage security, hover/scroll message protocol, overlay component) without
 * spinning up Next.js or hitting the gateway/DB.
 *
 * Test style mirrors theme-editor-r.test.mjs:
 * - node:test + node:assert/strict
 * - readFileSync source assertions
 * - structural/pattern checks only; no network or DOM
 *
 * POSTMESSAGE SECURITY LAW verification:
 * Every receive: event.origin validation before acting.
 * Every send: explicit targetOrigin (never bare '*') via previewOrigin.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../../..', import.meta.url).pathname;

function read(rel) {
    return readFileSync(`${ROOT}/${rel}`, 'utf8');
}
function exists(rel) {
    return existsSync(`${ROOT}/${rel}`);
}

const MCP_BASE = 'apps/merchant/web/src';
const CENTER_PANEL = `${MCP_BASE}/components/theme-editor/CenterPanel.tsx`;
const INSPECTOR_OVERLAY = `${MCP_BASE}/components/theme-editor/PreviewInspectorOverlay.tsx`;
const PROTOCOL = 'packages/theme-engine/src/editor-bridge-protocol.ts';

// ── Protocol constants exist ───────────────────────────────────────────────────

test('phase-s: editor-bridge-protocol.ts defines INSPECTOR_SECTION_HOVERED', () => {
    assert.match(read(PROTOCOL), /INSPECTOR_SECTION_HOVERED/,
        'editor-bridge-protocol.ts must export INSPECTOR_SECTION_HOVERED');
});

test('phase-s: editor-bridge-protocol.ts defines INSPECTOR_HOVER_CLEARED', () => {
    assert.match(read(PROTOCOL), /INSPECTOR_HOVER_CLEARED/,
        'editor-bridge-protocol.ts must export INSPECTOR_HOVER_CLEARED');
});

test('phase-s: editor-bridge-protocol.ts defines INSPECTOR_ADD_SECTION_INTENT', () => {
    assert.match(read(PROTOCOL), /INSPECTOR_ADD_SECTION_INTENT/,
        'editor-bridge-protocol.ts must export INSPECTOR_ADD_SECTION_INTENT');
});

test('phase-s: editor-bridge-protocol.ts defines INSPECTOR_SECTION_SCROLLED_TO', () => {
    assert.match(read(PROTOCOL), /INSPECTOR_SECTION_SCROLLED_TO/,
        'editor-bridge-protocol.ts must export INSPECTOR_SECTION_SCROLLED_TO');
});

test('phase-s: INSPECTOR_SECTION_SCROLLED_TO has the correct string value', () => {
    assert.match(read(PROTOCOL), /letbuyy:inspector:section-scrolled-to/,
        'INSPECTOR_SECTION_SCROLLED_TO must equal "letbuyy:inspector:section-scrolled-to"');
});

// ── New component files exist ──────────────────────────────────────────────────

test('phase-s: PreviewInspectorOverlay.tsx exists in theme-editor components', () => {
    assert.ok(exists(INSPECTOR_OVERLAY), 'PreviewInspectorOverlay.tsx missing from components/theme-editor/');
});

// ── @letbuyy/ui import in PreviewInspectorOverlay ─────────────────────────────

test('phase-s: PreviewInspectorOverlay uses canonical Lucide icons (CODE-R7)', () => {
    assert.match(read(INSPECTOR_OVERLAY), /from 'lucide-react'/,
        'PreviewInspectorOverlay must use canonical Lucide icons');
});

// ── No raw rounded-[Npx] or inline hex in PreviewInspectorOverlay ─────────────

test('phase-s: PreviewInspectorOverlay uses no raw rounded-[...px] class (design ratchet)', () => {
    assert.doesNotMatch(read(INSPECTOR_OVERLAY), /rounded-\[\d+px\]/,
        'PreviewInspectorOverlay must not use raw radius px classes');
});

// ── PreviewInspectorOverlay is pointer-events:none / aria-hidden ───────────────
// Non-interactive: must not interfere with keyboard a11y (section tree owns that).

test('phase-s: PreviewInspectorOverlay is aria-hidden (non-interactive overlay)', () => {
    assert.match(read(INSPECTOR_OVERLAY), /aria-hidden/,
        'PreviewInspectorOverlay must be aria-hidden — keyboard selection is owned by the section tree');
});

// ── CenterPanel imports the new protocol constants ─────────────────────────────

test('phase-s: CenterPanel imports INSPECTOR_SECTION_HOVERED', () => {
    assert.match(read(CENTER_PANEL), /INSPECTOR_SECTION_HOVERED/,
        'CenterPanel must import and use INSPECTOR_SECTION_HOVERED');
});

test('phase-s: CenterPanel imports INSPECTOR_HOVER_CLEARED', () => {
    assert.match(read(CENTER_PANEL), /INSPECTOR_HOVER_CLEARED/,
        'CenterPanel must import and use INSPECTOR_HOVER_CLEARED');
});

test('phase-s: CenterPanel imports EDITOR_SCROLL_MESSAGE', () => {
    assert.match(read(CENTER_PANEL), /EDITOR_SCROLL_MESSAGE/,
        'CenterPanel must import and send EDITOR_SCROLL_MESSAGE for explicit scroll intent');
});

// ── CenterPanel imports PreviewInspectorOverlay ───────────────────────────────

test('phase-s: CenterPanel imports PreviewInspectorOverlay', () => {
    assert.match(read(CENTER_PANEL), /PreviewInspectorOverlay/,
        'CenterPanel must import and render PreviewInspectorOverlay');
});

// ── POSTMESSAGE SECURITY: event.origin validation in handleMessage ─────────────

test('phase-s: CenterPanel validates event.origin before acting on inbound messages (security)', () => {
    const src = read(CENTER_PANEL);
    // Must guard with origin check — the exact pattern used is: previewOrigin && event.origin !== previewOrigin
    assert.match(src, /event\.origin/,
        'CenterPanel.handleMessage must reference event.origin for origin validation');
    assert.match(src, /previewOrigin/,
        'CenterPanel must derive and use previewOrigin for origin validation');
});

test('phase-s: CenterPanel handleMessage rejects messages when previewOrigin is falsy (security)', () => {
    const src = read(CENTER_PANEL);
    // The guard must check previewOrigin before comparing origins so null/empty previewUrl drops all messages.
    assert.match(src, /!previewOrigin/,
        'CenterPanel.handleMessage must short-circuit when previewOrigin is null');
});

// ── POSTMESSAGE SECURITY: explicit targetOrigin on all sends ──────────────────

test('phase-s: CenterPanel does not use bare "*" as postMessage targetOrigin anywhere in the file (security)', () => {
    const src = read(CENTER_PANEL);
    // Check there are no postMessage invocations where the second argument is the bare wildcard '*'.
    // Multi-line calls: look for the pattern where a comma is followed (possibly with whitespace/newlines)
    // by the string literal '*' and then a closing paren.
    assert.doesNotMatch(
        src.replace(/\s+/g, ' '),  // collapse whitespace so multi-line calls become one line
        /postMessage\([^)]*,\s*['"]\*['"]\s*\)/,
        "CenterPanel must not pass bare '*' as postMessage targetOrigin"
    );
});

test('phase-s: CenterPanel uses previewOrigin as targetOrigin in postSelectionToPreview (security)', () => {
    assert.match(read(CENTER_PANEL), /targetOrigin.*previewOrigin|previewOrigin.*targetOrigin/,
        'CenterPanel.postSelectionToPreview must assign targetOrigin from previewOrigin');
});

// ── CenterPanel sends EDITOR_SCROLL_MESSAGE on section selection ───────────────

test('phase-s: CenterPanel sends EDITOR_SCROLL_MESSAGE when a section is selected', () => {
    assert.match(read(CENTER_PANEL), /type.*EDITOR_SCROLL_MESSAGE|EDITOR_SCROLL_MESSAGE.*type/,
        'CenterPanel must include EDITOR_SCROLL_MESSAGE in a postMessage call');
});

// ── CenterPanel exposes optional onHoverSection prop ─────────────────────────

test('phase-s: CenterPanel declares optional onHoverSection prop', () => {
    assert.match(read(CENTER_PANEL), /onHoverSection/,
        'CenterPanel must expose onHoverSection optional prop');
});

// ── CenterPanel renders PreviewInspectorOverlay with hover state ──────────────

test('phase-s: CenterPanel renders <PreviewInspectorOverlay in its JSX', () => {
    assert.match(read(CENTER_PANEL), /<PreviewInspectorOverlay/,
        'CenterPanel must render PreviewInspectorOverlay in its JSX');
});

test('phase-s: CenterPanel passes hoveredSection to PreviewInspectorOverlay', () => {
    assert.match(read(CENTER_PANEL), /hoveredSection/,
        'CenterPanel must track and pass hoveredSection state to PreviewInspectorOverlay');
});

// ── CenterPanel clears hover on preview URL change ─────────────────────────────

test('phase-s: CenterPanel clears hoveredSection state when previewUrl changes', () => {
    const src = read(CENTER_PANEL);
    // The useEffect that resets iframeLoadedRef must also clear hover state.
    assert.match(src, /setHoveredSection\(null\)/,
        'CenterPanel must call setHoveredSection(null) when previewUrl changes to clear stale hover chips');
});

// ── CenterPanel handles INSPECTOR_ADD_SECTION_INTENT (Phase S hardening) ─────

test('phase-s hardening: CenterPanel imports INSPECTOR_ADD_SECTION_INTENT', () => {
    assert.match(read(CENTER_PANEL), /INSPECTOR_ADD_SECTION_INTENT/,
        'CenterPanel must import INSPECTOR_ADD_SECTION_INTENT to handle add-section intents from preview');
});

test('phase-s hardening: CenterPanel declares optional onAddSectionIntent prop', () => {
    assert.match(read(CENTER_PANEL), /onAddSectionIntent/,
        'CenterPanel must expose onAddSectionIntent optional prop to wire into the add-section panel');
});

test('phase-s hardening: CenterPanel handles INSPECTOR_ADD_SECTION_INTENT in its message switch', () => {
    const src = read(CENTER_PANEL);
    // The switch must have a case for this message type.
    assert.match(src, /case INSPECTOR_ADD_SECTION_INTENT/,
        'CenterPanel.handleMessage must have a case for INSPECTOR_ADD_SECTION_INTENT');
});

test('phase-s hardening: CenterPanel validates adjacentSectionId and position before invoking callback', () => {
    const src = read(CENTER_PANEL);
    // Shape validation: both fields must be checked before acting.
    assert.match(src, /adjacentSectionId/,
        'CenterPanel INSPECTOR_ADD_SECTION_INTENT handler must reference adjacentSectionId');
    assert.match(src, /'before'.*'after'|'after'.*'before'/,
        "CenterPanel must validate position as 'before' or 'after'");
});

// ── page.tsx must NOT be touched ───────────────────────────────────────────────

const EDITOR_PAGE = `${MCP_BASE}/app/[store]/online-store/themes/[themeId]/editor/page.tsx`;
const PAGE_EXISTS = exists(EDITOR_PAGE);

test('phase-s: editor page.tsx does not reference INSPECTOR_SECTION_HOVERED (foreign WIP not touched)', {
    skip: PAGE_EXISTS ? false : 'page.tsx does not exist in the working tree',
}, () => {
    // This is the foreign-WIP file — Phase S must NOT touch it.
    // If it accidentally imported inspector constants that would be a scope violation.
    const src = read(EDITOR_PAGE);
    assert.doesNotMatch(src, /INSPECTOR_SECTION_HOVERED|INSPECTOR_HOVER_CLEARED|PreviewInspectorOverlay/,
        'editor page.tsx must not reference Phase S inspector constants (foreign WIP must not be touched)');
});

// ── No direct Supabase or gateway imports in new component ────────────────────

test('phase-s: PreviewInspectorOverlay has no direct Supabase or gateway imports', () => {
    const src = read(INSPECTOR_OVERLAY);
    assert.doesNotMatch(src, /@supabase\/|createSupabase|supabaseAdmin/,
        'PreviewInspectorOverlay must not use Supabase');
    assert.doesNotMatch(src, /createMerchantApiClient|merchantApiFetch/,
        'PreviewInspectorOverlay must not call the gateway directly');
});
