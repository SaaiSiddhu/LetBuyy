/**
 * Phase T — Nested Block Children: static-contract tests for the merchant-web.
 *
 * These tests assert source-level contracts (file existence, prop signatures, depth
 * constants, recursive render, ARIA attributes, design-ratchet compliance) without
 * spinning up Next.js or hitting the gateway/DB.
 *
 * Test style mirrors theme-editor-r.test.mjs:
 * - node:test + node:assert/strict
 * - readFileSync source assertions
 * - structural/pattern checks only; no network or DOM
 *
 * PHASE T HARD RULES verified here:
 * - RISK-DUAL-N01: callbacks mutate instance tree, never block_definitions
 * - MAX_EDITOR_BLOCK_DEPTH constant present and used as render-time depth guard
 * - Depth cap enforced in JSX (canNestDeeper / depth < MAX_EDITOR_BLOCK_DEPTH)
 * - No raw rounded-[Npx] classes (design ratchet)
 * - page.tsx never imported (foreign WIP not touched)
 * - No Supabase / gateway imports in new component
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
const BLOCK_CHILD_ROW = `${MCP_BASE}/components/theme-editor/BlockChildRow.tsx`;
const SECTION_TREE_PANEL = `${MCP_BASE}/components/theme-editor/SectionTreePanel.tsx`;
const EDITOR_VIEW_STATE = `${MCP_BASE}/components/theme-editor/editor-view-state.ts`;

// ── New file exists ────────────────────────────────────────────────────────────

test('phase-t: BlockChildRow.tsx exists in theme-editor components', () => {
    assert.ok(exists(BLOCK_CHILD_ROW), 'BlockChildRow.tsx missing from components/theme-editor/');
});

// ── @letbuyy/ui import in BlockChildRow ───────────────────────────────────────

test('phase-t: BlockChildRow imports from @letbuyy/ui (design token compliance)', () => {
    const src = read(BLOCK_CHILD_ROW);
    assert.match(src, /from '@letbuyy\/ui'/, 'BlockChildRow must import from @letbuyy/ui');
});

// ── No raw rounded-[Npx] in either file ──────────────────────────────────────

test('phase-t: BlockChildRow uses no raw rounded-[...px] class (design ratchet)', () => {
    assert.doesNotMatch(
        read(BLOCK_CHILD_ROW),
        /rounded-\[\d+px\]/,
        'BlockChildRow must not use raw radius px classes',
    );
});

test('phase-t: SectionTreePanel uses no raw rounded-[...px] class (design ratchet)', () => {
    assert.doesNotMatch(
        read(SECTION_TREE_PANEL),
        /rounded-\[\d+px\]/,
        'SectionTreePanel must not use raw radius px classes',
    );
});

// ── SectionTreePanel Phase T callback props ───────────────────────────────────

test('phase-t: SectionTreePanel exposes onAddChildBlock callback prop', () => {
    assert.match(
        read(SECTION_TREE_PANEL),
        /onAddChildBlock/,
        'SectionTreePanel must declare onAddChildBlock prop for Phase T nested blocks',
    );
});

test('phase-t: SectionTreePanel exposes onRemoveChildBlock callback prop', () => {
    assert.match(
        read(SECTION_TREE_PANEL),
        /onRemoveChildBlock/,
        'SectionTreePanel must declare onRemoveChildBlock prop for Phase T nested blocks',
    );
});

test('phase-t: SectionTreePanel exposes onMoveChildBlock callback prop', () => {
    assert.match(
        read(SECTION_TREE_PANEL),
        /onMoveChildBlock/,
        'SectionTreePanel must declare onMoveChildBlock prop for Phase T nested blocks',
    );
});

// ── SectionTreePanel exports BlockEntry type ──────────────────────────────────

test('phase-t: SectionTreePanel exports BlockEntry type for BlockChildRow import', () => {
    assert.match(
        read(SECTION_TREE_PANEL),
        /export type \{ BlockEntry \} from '\.\/editor-view-state'/,
        'SectionTreePanel must export BlockEntry so BlockChildRow can import it',
    );
});

// ── BlockEntry carries children field ─────────────────────────────────────────

test('phase-t: BlockEntry type includes optional children field (Phase T instance nesting)', () => {
    const src = read(EDITOR_VIEW_STATE);
    assert.match(src, /children\?.*BlockEntry/, 'BlockEntry must have children?: BlockEntry[] field');
});

// ── BlockChildRow uses depth prop ─────────────────────────────────────────────

test('phase-t: BlockChildRow declares depth prop in its props type', () => {
    assert.match(
        read(BLOCK_CHILD_ROW),
        /depth[?:].*number/,
        'BlockChildRow must declare a depth prop typed as number',
    );
});

// ── MAX_EDITOR_BLOCK_DEPTH constant ──────────────────────────────────────────

test('phase-t: BlockChildRow exports MAX_EDITOR_BLOCK_DEPTH constant', () => {
    assert.match(
        read(BLOCK_CHILD_ROW),
        /export const MAX_EDITOR_BLOCK_DEPTH/,
        'BlockChildRow must export MAX_EDITOR_BLOCK_DEPTH as a named constant',
    );
});

test('phase-t: MAX_EDITOR_BLOCK_DEPTH is set to 3 (matching theme-document.ts MAX_BLOCK_NESTING_DEPTH)', () => {
    assert.match(
        read(BLOCK_CHILD_ROW),
        /MAX_EDITOR_BLOCK_DEPTH\s*=\s*3/,
        'MAX_EDITOR_BLOCK_DEPTH must equal 3 to stay in sync with the parse-time bound',
    );
});

// ── Depth cap enforced in render (render-time depth bound) ────────────────────

test('phase-t: BlockChildRow guards child rendering with depth < MAX_EDITOR_BLOCK_DEPTH', () => {
    const src = read(BLOCK_CHILD_ROW);
    // The guard must compare depth to the constant, not a raw literal.
    assert.match(
        src,
        /depth\s*<\s*MAX_EDITOR_BLOCK_DEPTH/,
        'BlockChildRow must guard nested child rendering with depth < MAX_EDITOR_BLOCK_DEPTH',
    );
});

// ── Recursive self-reference ──────────────────────────────────────────────────

test('phase-t: BlockChildRow renders itself recursively for nested children', () => {
    const src = read(BLOCK_CHILD_ROW);
    // The JSX must contain <BlockChildRow to prove recursive self-reference.
    assert.match(
        src,
        /<BlockChildRow/,
        'BlockChildRow must contain <BlockChildRow in its JSX for recursive child rendering',
    );
});

test('phase-t: BlockChildRow increments depth for recursive children (depth + 1)', () => {
    const src = read(BLOCK_CHILD_ROW);
    assert.match(
        src,
        /depth\s*\+\s*1/,
        'BlockChildRow must pass depth + 1 to recursive child instances',
    );
});

// ── ARIA tree level attribute ──────────────────────────────────────────────────

test('phase-t: BlockChildRow sets aria-level for ARIA tree depth (a11y)', () => {
    assert.match(
        read(BLOCK_CHILD_ROW),
        /aria-level/,
        'BlockChildRow must set aria-level on the treeitem element for screen reader depth',
    );
});

test('phase-t: BlockChildRow uses role="treeitem" for ARIA tree widget semantics', () => {
    assert.match(
        read(BLOCK_CHILD_ROW),
        /role="treeitem"/,
        'BlockChildRow must set role="treeitem" on the block row element',
    );
});

// ── depth-N CSS modifier class ────────────────────────────────────────────────

test('phase-t: BlockChildRow applies theme-os-tree-block--depth-N modifier class', () => {
    assert.match(
        read(BLOCK_CHILD_ROW),
        /theme-os-tree-block--depth-/,
        'BlockChildRow must apply theme-os-tree-block--depth-N class for depth-level indentation',
    );
});

// ── RISK-DUAL-N01: callbacks mutate instance tree, not definitions ─────────────

test('phase-t: SectionTreePanel documents RISK-DUAL-N01 in Phase T callback comments', () => {
    const src = read(SECTION_TREE_PANEL);
    // The RISK-DUAL-N01 annotation must appear in the file.
    assert.match(
        src,
        /RISK-DUAL-N01/,
        'SectionTreePanel must reference RISK-DUAL-N01 in its Phase T callback comments',
    );
});

test('phase-t: BlockChildRow documents RISK-DUAL-N01 (instance tree, not definitions)', () => {
    const src = read(BLOCK_CHILD_ROW);
    assert.match(
        src,
        /RISK-DUAL-N01/,
        'BlockChildRow must reference RISK-DUAL-N01 in its design invariant comments',
    );
});

// ── BlockChildRow does not import page.tsx (foreign WIP isolation) ────────────

test('phase-t: BlockChildRow does not import from editor page.tsx (foreign WIP not touched)', () => {
    assert.doesNotMatch(
        read(BLOCK_CHILD_ROW),
        /from.*page/,
        'BlockChildRow must not import from page.tsx — foreign WIP must not be touched',
    );
});

test('phase-t: SectionTreePanel does not import from editor page.tsx in Phase T additions', () => {
    // SectionTreePanel imports BlockChildRow, not page.tsx
    assert.doesNotMatch(
        read(SECTION_TREE_PANEL),
        /from.*page\.tsx/,
        'SectionTreePanel must not import from page.tsx',
    );
});

// ── SectionTreePanel imports BlockChildRow ────────────────────────────────────

test('phase-t: SectionTreePanel imports BlockChildRow from the new component file', () => {
    assert.match(
        read(SECTION_TREE_PANEL),
        /from ['"]\.\/BlockChildRow['"]/,
        "SectionTreePanel must import BlockChildRow from './BlockChildRow'",
    );
});

// ── No Supabase / gateway in BlockChildRow ────────────────────────────────────

test('phase-t: BlockChildRow has no direct Supabase or gateway imports (no DB access)', () => {
    const src = read(BLOCK_CHILD_ROW);
    assert.doesNotMatch(src, /@supabase\/|createSupabase|supabaseAdmin/,
        'BlockChildRow must not use Supabase');
    assert.doesNotMatch(src, /createMerchantApiClient|merchantApiFetch/,
        'BlockChildRow must not call the gateway directly');
});

// ── Autosave threading: callbacks are optional (caller wires to draft CAS) ────

test('phase-t: onAddChildBlock is optional in BlockChildRow props (caller wires to autosave)', () => {
    assert.match(
        read(BLOCK_CHILD_ROW),
        /onAddChildBlock\?/,
        'onAddChildBlock must be optional in BlockChildRowProps — wired to autosave by the caller',
    );
});

test('phase-t: onRemoveChildBlock is optional in BlockChildRow props', () => {
    assert.match(
        read(BLOCK_CHILD_ROW),
        /onRemoveChildBlock\?/,
        'onRemoveChildBlock must be optional in BlockChildRowProps',
    );
});

test('phase-t: onMoveChildBlock is optional in BlockChildRow props', () => {
    assert.match(
        read(BLOCK_CHILD_ROW),
        /onMoveChildBlock\?/,
        'onMoveChildBlock must be optional in BlockChildRowProps',
    );
});
