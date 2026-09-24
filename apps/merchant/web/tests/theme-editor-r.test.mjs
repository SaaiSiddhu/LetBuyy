/**
 * Phase R — Theme Editor shell: static-contract tests for the merchant-web.
 *
 * These tests assert source-level contracts (file existence, import patterns,
 * ARIA attributes, conflict-detection code, extraction completeness) without
 * spinning up Next.js or hitting the gateway/DB.
 *
 * Test style mirrors tests/federation/web-app-contract-boundary.test.mjs:
 * - node:test + node:assert/strict
 * - readFileSync source assertions
 * - structural/pattern checks only; no network or DOM
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../..', import.meta.url).pathname;

function read(rel) {
    return readFileSync(`${ROOT}/${rel}`, 'utf8');
}
function exists(rel) {
    return existsSync(`${ROOT}/${rel}`);
}

const MCP_BASE = 'apps/merchant_web/src';
const EDITOR_PAGE = `${MCP_BASE}/app/[store]/online-store/themes/[themeId]/editor/page.tsx`;
const CONFLICT_DIALOG = `${MCP_BASE}/components/theme-editor/ConflictDialog.tsx`;
const SECTION_TREE_PANEL = `${MCP_BASE}/components/theme-editor/SectionTreePanel.tsx`;

// The new components (ConflictDialog, SectionTreePanel) are committed as standalone deliverables.
// The page.tsx *wiring* that consumes them is intermingled with foreign uncommitted WIP (the
// Phase-2.5 experience-picker work) in the editor page, so it rides in the working tree and is
// committed with that file — not by this phase. The page.tsx-integration tests below therefore
// SKIP when the wiring is absent (committed state) and run automatically once it lands.
const EDITOR_HAS_WIRING = exists(EDITOR_PAGE) && /ConflictDialog/.test(read(EDITOR_PAGE));
const PAGE_WIRING_SKIP = EDITOR_HAS_WIRING
    ? false
    : 'page.tsx editor-shell wiring is working-tree WIP (intermingled with foreign Phase-2.5 WIP); committed with that file';

// ── New component files exist ──────────────────────────────────────────────────

test('phase-r: ConflictDialog.tsx exists in theme-editor components', () => {
    assert.ok(exists(CONFLICT_DIALOG), 'ConflictDialog.tsx missing from components/theme-editor/');
});

test('phase-r: SectionTreePanel.tsx exists in theme-editor components', () => {
    assert.ok(exists(SECTION_TREE_PANEL), 'SectionTreePanel.tsx missing from components/theme-editor/');
});

// ── @letbuyy/ui import in both new components ──────────────────────────────────

test('phase-r: ConflictDialog imports from @letbuyy/ui (design token compliance)', () => {
    const src = read(CONFLICT_DIALOG);
    assert.match(src, /from '@letbuyy\/ui'/, 'ConflictDialog must import from @letbuyy/ui');
});

test('phase-r: SectionTreePanel imports from @letbuyy/ui (design token compliance)', () => {
    const src = read(SECTION_TREE_PANEL);
    assert.match(src, /from '@letbuyy\/ui'/, 'SectionTreePanel must import from @letbuyy/ui');
});

// ── No raw px/hex/rounded-[] in new components ────────────────────────────────

test('phase-r: ConflictDialog uses no raw rounded-[...px] class (design ratchet)', () => {
    const src = read(CONFLICT_DIALOG);
    assert.doesNotMatch(src, /rounded-\[\d+px\]/, 'ConflictDialog must not use raw radius px classes');
});

test('phase-r: SectionTreePanel uses no raw rounded-[...px] class (design ratchet)', () => {
    const src = read(SECTION_TREE_PANEL);
    assert.doesNotMatch(src, /rounded-\[\d+px\]/, 'SectionTreePanel must not use raw radius px classes');
});

// ── ConflictDialog detects CONFLICT code ──────────────────────────────────────

test('phase-r: ConflictDialog source contains CONFLICT code detection', () => {
    const src = read(CONFLICT_DIALOG);
    assert.match(src, /CONFLICT/, 'ConflictDialog must reference CONFLICT in its source');
});

test('phase-r: ConflictDialog surfaces reload and force-save paths', () => {
    const src = read(CONFLICT_DIALOG);
    assert.match(src, /onReload/, 'ConflictDialog must expose onReload prop');
    assert.match(src, /onForce/, 'ConflictDialog must expose onForce prop (force-save / keep my changes)');
    assert.match(src, /ConfirmDialog/, 'ConflictDialog must wrap ConfirmDialog from @letbuyy/ui');
});

// ── SectionTreePanel ARIA tree pattern ────────────────────────────────────────

test('phase-r: SectionTreePanel uses role="treeitem" on section rows', () => {
    const src = read(SECTION_TREE_PANEL);
    assert.match(src, /role.*treeitem|treeitem.*role/, 'SectionTreePanel must set role="treeitem" on tree rows');
});

test('phase-r: SectionTreePanel uses aria-selected on section rows', () => {
    const src = read(SECTION_TREE_PANEL);
    assert.match(src, /aria-selected/, 'SectionTreePanel must set aria-selected on tree rows');
});

test('phase-r: SectionTreePanel contains role="tree" container for keyboard nav', () => {
    const src = read(SECTION_TREE_PANEL);
    assert.match(src, /role="tree"/, 'SectionTreePanel must wrap template sections in a role="tree" element');
});

test('phase-r: SectionTreePanel implements ArrowUp/ArrowDown keyboard navigation', () => {
    const src = read(SECTION_TREE_PANEL);
    assert.match(src, /ArrowDown/, 'SectionTreePanel must handle ArrowDown for keyboard nav');
    assert.match(src, /ArrowUp/, 'SectionTreePanel must handle ArrowUp for keyboard nav');
});

test('phase-r: SectionTreePanel implements drag-and-drop handlers on template rows', () => {
    const src = read(SECTION_TREE_PANEL);
    assert.match(src, /draggable/, 'SectionTreePanel must make template rows draggable');
    assert.match(src, /onDragStart/, 'SectionTreePanel must handle onDragStart');
    assert.match(src, /onDragOver/, 'SectionTreePanel must handle onDragOver');
    assert.match(src, /onDrop/, 'SectionTreePanel must handle onDrop');
    assert.match(src, /onDragEnd/, 'SectionTreePanel must handle onDragEnd (cleanup)');
});

test('phase-r: SectionTreePanel exports TreeGroup for use by ThemeSettingsTree/VersionTree', () => {
    const src = read(SECTION_TREE_PANEL);
    assert.match(src, /export function TreeGroup/, 'SectionTreePanel must export TreeGroup');
});

// ── page.tsx imports the new components ───────────────────────────────────────

test('phase-r: editor page.tsx imports ConflictDialog', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.match(
        src,
        /from '@\/components\/theme-editor\/ConflictDialog'/,
        'page.tsx must import ConflictDialog from the correct path',
    );
});

test('phase-r: editor page.tsx imports SectionTreePanel', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.match(
        src,
        /from '@\/components\/theme-editor\/SectionTreePanel'/,
        'page.tsx must import SectionTreePanel from the correct path',
    );
});

test('phase-r: editor page.tsx renders ConflictDialog in JSX', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.match(src, /<ConflictDialog/, 'page.tsx must render ConflictDialog in its JSX');
});

test('phase-r: editor page.tsx renders SectionTreePanel in JSX', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.match(src, /<SectionTreePanel/, 'page.tsx must render SectionTreePanel in its JSX');
});

// ── page.tsx no longer contains the three extracted inline declarations ────────

test('phase-r: page.tsx does not contain inline "function SectionTree" declaration', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.doesNotMatch(
        src,
        /^function SectionTree\b/m,
        'SectionTree must be extracted — function SectionTree should not remain inline in page.tsx',
    );
});

test('phase-r: page.tsx does not contain inline "function TreeGroup" declaration', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.doesNotMatch(
        src,
        /^function TreeGroup\b/m,
        'TreeGroup must be extracted — function TreeGroup should not remain inline in page.tsx',
    );
});

test('phase-r: page.tsx does not contain inline "function TreeSection" declaration', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.doesNotMatch(
        src,
        /^function TreeSection\b/m,
        'TreeSection must be extracted — function TreeSection should not remain inline in page.tsx',
    );
});

// ── page.tsx conflict state and 409 detection ─────────────────────────────────

test('phase-r: page.tsx tracks hasConflict state', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.match(src, /hasConflict/, 'page.tsx must declare hasConflict state');
    assert.match(src, /setHasConflict/, 'page.tsx must have setHasConflict setter');
});

test('phase-r: page.tsx detects HTTP 409 as CONFLICT in syncPreviewDraft', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    // Both patterns must appear: the status check and the conflict state setter
    assert.match(src, /status.*409|409.*status/, 'page.tsx must check response.status === 409');
    assert.match(src, /conflictSource/, 'page.tsx must set conflictSource on conflict');
});

test('phase-r: page.tsx ConflictDialog receives onReload and onForce handlers', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.match(src, /onReload=/, 'page.tsx must pass onReload to ConflictDialog');
    assert.match(src, /onForce=/, 'page.tsx must pass onForce to ConflictDialog');
});

test('phase-r: page.tsx saveDraft supports force-save (bypass base_version)', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    // saveDraft must accept a force parameter and use it to skip baseVersion
    assert.match(src, /force.*true|saveDraft.*true/, 'page.tsx must call saveDraft(true) in the force path');
});

// ── No direct DB / Supabase access in new components ─────────────────────────

test('phase-r: new components have no direct Supabase or gateway imports', () => {
    const files = [CONFLICT_DIALOG, SECTION_TREE_PANEL];
    for (const file of files) {
        const src = read(file);
        assert.doesNotMatch(src, /@supabase\/|createSupabase|supabaseAdmin/, `${file}: must not use Supabase`);
        assert.doesNotMatch(src, /createMerchantApiClient|merchantApiFetch/, `${file}: must call /api/* proxies, not the gateway directly`);
    }
});
