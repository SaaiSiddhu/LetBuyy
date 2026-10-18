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
// Exercise the real application transport in the maintained editor test lane.
import './theme-draft-client.test.mjs';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('../../../..', import.meta.url).pathname;

// The repository root owns the TypeScript loader used by these package exports.
// Keep the merchant test's dependencies inside its declared manifest boundary.
test('actual canonical document validation and unsafe-color regressions pass in the root TypeScript test runtime', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', new URL('./theme-draft-document.test.mjs', import.meta.url).pathname], {
        cwd: ROOT, encoding: 'utf8', timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
});

function read(rel) {
    return readFileSync(`${ROOT}/${rel}`, 'utf8');
}
function exists(rel) {
    return existsSync(`${ROOT}/${rel}`);
}

const MCP_BASE = 'apps/merchant/web/src';
const EDITOR_PAGE = `${MCP_BASE}/app/[store]/online-store/themes/[themeId]/editor/page.tsx`;
const CONFLICT_DIALOG = `${MCP_BASE}/components/theme-editor/ConflictDialog.tsx`;
const SECTION_TREE_PANEL = `${MCP_BASE}/components/theme-editor/SectionTreePanel.tsx`;

// Editor wiring is required; absence must fail these contracts.
const PAGE_WIRING_SKIP = false;

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

test('phase-r: ConflictDialog retains local edits on cancel and provides a separate destructive reload', () => {
    const src = read(CONFLICT_DIALOG);
    assert.match(src, /cancelLabel="Keep editing locally"/);
    assert.match(src, /onClose=\{onDismiss\}/);
    assert.match(src, /onClick=\{onReload\}/);
    assert.match(src, /Reload latest and discard local edits/);
});

test('phase-r: ConflictDialog requires review then explicit replacement of a numbered revision', () => {
    const src = read(CONFLICT_DIALOG);
    assert.match(src, /Review latest version/);
    assert.match(src, /Replace version \$\{replacementVersion\}/);
    assert.match(src, /ConfirmDialog/);
    assert.match(src, /disabled=\{busy\}/);
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

test('phase-r: page.tsx handles typed transport conflicts from saves and preview', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.match(src, /error instanceof ThemeDraftConflictError/);
    assert.match(src, /setHasConflict\(true\)/);
    assert.match(src, /conflictSource/, 'page.tsx must set conflictSource on conflict');
});

test('phase-r: page.tsx ConflictDialog receives onReload and onForce handlers', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.match(src, /onReload=/, 'page.tsx must pass onReload to ConflictDialog');
    assert.match(src, /onForce=/, 'page.tsx must pass onForce to ConflictDialog');
});

test('phase-r: page.tsx reviews latest state before an exact-version replacement', { skip: PAGE_WIRING_SKIP }, () => {
    const src = read(EDITOR_PAGE);
    assert.match(src, /if \(replacementVersion === null\)/);
    assert.match(src, /setReplacementVersion\(payload.version\)/);
    assert.match(src, /await saveDraft\(replacementVersion\)/);
    assert.doesNotMatch(src, /saveDraft\(true\)|force \? undefined/);
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
