/**
 * Phase V — Template Switcher: static-contract tests for the merchant-web.
 *
 * These tests assert source-level contracts (file existence, prop shapes, ARIA/a11y
 * markers, design-ratchet compliance, RISK-DUAL-N01 isolation) without spinning up
 * Next.js or hitting the gateway/DB.
 *
 * Test style mirrors theme-editor-r/s/t/u.test.mjs:
 *  - node:test + node:assert/strict
 *  - readFileSync source assertions
 *  - structural/pattern checks only; no network, no DOM, no React render
 *
 * PHASE V HARD RULES verified here:
 *  - TemplateSwitcherPanel.tsx exists in components/theme-editor/
 *  - Imports @letbuyy/ui (design-token compliance)
 *  - No import from page.tsx (foreign WIP not touched)
 *  - No import from globals.css (design ratchet)
 *  - No import of Supabase / gateway / direct DB
 *  - No raw rounded-[Npx] classes (design ratchet)
 *  - Default export named TemplateSwitcherPanel (or default function)
 *  - useTemplateSwitcher hook exported (for editor wiring)
 *  - Props: templateOptions, selectedKey, onChange, disabled, alternateVariants,
 *           onCreateAlternate, loading, error
 *  - ARIA: role="listbox" + role="option" + aria-selected on variant list
 *  - ARIA: aria-label on key elements
 *  - Slash-containing keys passed through without transformation (value=key, raw)
 *  - RISK-DUAL-N01: onChange emits key string only; onCreateAlternate emits baseType;
 *    no reference to section_definitions as a mutation target
 *  - Loading state renders aria-busy="true"
 *  - useTemplateSwitcher dot-split: '.' is the suffix separator, '/' is not
 *  - Disabled state: disabled prop forwarded; handleSelectChange guards on disabled
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
const SWITCHER = `${MCP_BASE}/components/theme-editor/TemplateSwitcherPanel.tsx`;

// ── File existence ─────────────────────────────────────────────────────────────

test('phase-v: TemplateSwitcherPanel.tsx exists in theme-editor components', () => {
    assert.ok(exists(SWITCHER), 'TemplateSwitcherPanel.tsx missing from components/theme-editor/');
});

// ── Imports @letbuyy/ui ────────────────────────────────────────────────────────

test('phase-v: TemplateSwitcherPanel imports from @letbuyy/ui (design token compliance)', () => {
    const src = read(SWITCHER);
    assert.match(src, /from '@letbuyy\/ui'/, 'must import from @letbuyy/ui');
});

test('phase-v: TemplateSwitcherPanel imports Select from @letbuyy/ui', () => {
    const src = read(SWITCHER);
    assert.match(src, /Select/, 'must use Select from @letbuyy/ui');
});

// ── No forbidden imports ───────────────────────────────────────────────────────

test('phase-v: TemplateSwitcherPanel does not import from page.tsx (foreign WIP not touched)', () => {
    const src = read(SWITCHER);
    // Must not contain an actual `import ... from '...page.tsx'` statement.
    // Comments mentioning page.tsx are fine.
    assert.doesNotMatch(src, /^import\s.*from\s+['"].*page\.tsx/m, 'must not import from editor page.tsx');
});

test('phase-v: TemplateSwitcherPanel does not import globals.css', () => {
    const src = read(SWITCHER);
    // Must not contain an actual import of globals.css.
    assert.doesNotMatch(src, /^import\s.*['"].*globals\.css/m, 'must not import globals.css');
});

test('phase-v: TemplateSwitcherPanel does not import Supabase or gateway', () => {
    const src = read(SWITCHER);
    // Must not contain actual import statements from supabase/gateway packages.
    assert.doesNotMatch(src, /^import\s.*from\s+['"](@supabase|supabase|@letbuyy\/api-client)/m, 'must not import DB or gateway');
});

// ── Design ratchet ─────────────────────────────────────────────────────────────

test('phase-v: TemplateSwitcherPanel uses no raw rounded-[Npx] class (design ratchet)', () => {
    const src = read(SWITCHER);
    assert.doesNotMatch(src, /rounded-\[\d+px\]/, 'must not use raw radius px classes — use --lb-* tokens');
});

// ── Exports ────────────────────────────────────────────────────────────────────

test('phase-v: TemplateSwitcherPanel has a default export', () => {
    const src = read(SWITCHER);
    assert.match(src, /export default/, 'must have a default export');
});

test('phase-v: useTemplateSwitcher hook is exported (for editor wiring without page.tsx coupling)', () => {
    const src = read(SWITCHER);
    assert.match(src, /export function useTemplateSwitcher/, 'useTemplateSwitcher must be a named export');
});

// ── Props contract ─────────────────────────────────────────────────────────────

test('phase-v: TemplateSwitcherPanelProps includes templateOptions', () => {
    const src = read(SWITCHER);
    assert.match(src, /templateOptions/, 'props must include templateOptions');
});

test('phase-v: TemplateSwitcherPanelProps includes selectedKey', () => {
    const src = read(SWITCHER);
    assert.match(src, /selectedKey/, 'props must include selectedKey');
});

test('phase-v: TemplateSwitcherPanelProps includes onChange callback', () => {
    const src = read(SWITCHER);
    assert.match(src, /onChange/, 'props must include onChange');
});

test('phase-v: TemplateSwitcherPanelProps includes disabled prop', () => {
    const src = read(SWITCHER);
    assert.match(src, /disabled/, 'props must include disabled');
});

test('phase-v: TemplateSwitcherPanelProps includes alternateVariants', () => {
    const src = read(SWITCHER);
    assert.match(src, /alternateVariants/, 'props must include alternateVariants');
});

test('phase-v: TemplateSwitcherPanelProps includes onCreateAlternate', () => {
    const src = read(SWITCHER);
    assert.match(src, /onCreateAlternate/, 'props must include onCreateAlternate');
});

test('phase-v: TemplateSwitcherPanelProps includes loading prop', () => {
    const src = read(SWITCHER);
    assert.match(src, /loading/, 'props must include loading');
});

test('phase-v: TemplateSwitcherPanelProps includes error prop', () => {
    const src = read(SWITCHER);
    assert.match(src, /error/, 'props must include error');
});

// ── ARIA / a11y ────────────────────────────────────────────────────────────────

test('phase-v: TemplateSwitcherPanel has role="listbox" on alternate variants container (a11y)', () => {
    const src = read(SWITCHER);
    assert.match(src, /role="listbox"/, 'alternate variants list must use role="listbox"');
});

test('phase-v: TemplateSwitcherPanel has role="option" on individual variant items (a11y)', () => {
    const src = read(SWITCHER);
    assert.match(src, /role="option"/, 'variant list items must use role="option"');
});

test('phase-v: TemplateSwitcherPanel has aria-selected on variant items (a11y)', () => {
    const src = read(SWITCHER);
    assert.match(src, /aria-selected/, 'variant items must have aria-selected');
});

test('phase-v: TemplateSwitcherPanel has aria-label on the select element (a11y)', () => {
    const src = read(SWITCHER);
    assert.match(src, /aria-label=["']Select template["']/, 'main <select> must have aria-label="Select template"');
});

test('phase-v: TemplateSwitcherPanel has aria-label on variant list (a11y)', () => {
    const src = read(SWITCHER);
    assert.match(src, /aria-label=["']Template variants["']/, 'variant list must have aria-label="Template variants"');
});

test('phase-v: TemplateSwitcherPanel has aria-busy="true" in loading state', () => {
    const src = read(SWITCHER);
    assert.match(src, /aria-busy="true"/, 'loading state must render aria-busy="true"');
});

test('phase-v: TemplateSwitcherPanel variant items have tabIndex for keyboard navigation', () => {
    const src = read(SWITCHER);
    assert.match(src, /tabIndex/, 'variant items must have tabIndex for keyboard access');
});

test('phase-v: TemplateSwitcherPanel variant items handle Enter/Space key (keyboard a11y)', () => {
    const src = read(SWITCHER);
    assert.match(src, /key === 'Enter'/, 'must handle Enter key on variant items');
    assert.match(src, /key === ' '/, 'must handle Space key on variant items');
});

// ── RISK-DUAL-N01 isolation ────────────────────────────────────────────────────

test('phase-v: RISK-DUAL-N01 — onChange emits key string only (comment present)', () => {
    const src = read(SWITCHER);
    assert.match(
        src,
        /RISK-DUAL-N01/,
        'must document RISK-DUAL-N01 contract — onChange emits key string, never touches section_definitions',
    );
});

test('phase-v: RISK-DUAL-N01 — no direct write to section_definitions in component', () => {
    const src = read(SWITCHER);
    // The component must never contain an assignment to section_definitions as a data target.
    // (It may MENTION section_definitions in comments but never assign/mutate it.)
    assert.doesNotMatch(
        src,
        /section_definitions\s*=\s*[^>]/,
        'must not assign to section_definitions (RISK-DUAL-N01)',
    );
    assert.doesNotMatch(
        src,
        /section_definitions\[/,
        'must not index-write into section_definitions (RISK-DUAL-N01)',
    );
});

test('phase-v: onCreateAlternate receives baseType string (intent signal, not document shape)', () => {
    const src = read(SWITCHER);
    assert.match(
        src,
        /onCreateAlternate\?\.\(baseType\)/,
        'onCreateAlternate must receive baseType (string) — intent signal, not a document shape',
    );
});

// ── Slash-key pass-through ─────────────────────────────────────────────────────

test('phase-v: slash-containing keys passed through without escaping (value=opt.key)', () => {
    const src = read(SWITCHER);
    // The value attribute on <option> must be set to opt.key (the raw key string),
    // not to an encoded or transformed form.
    assert.match(src, /value.*opt\.key/, 'option value must be set to opt.key (raw, no encoding)');
});

// ── useTemplateSwitcher hook semantics ─────────────────────────────────────────

test('phase-v: useTemplateSwitcher splits on "." (dot) — slash is NOT the suffix separator', () => {
    const src = read(SWITCHER);
    // The hook uses indexOf('.') for splitting.
    assert.match(src, /indexOf\('\.'\)/, 'useTemplateSwitcher must split on "." not "/"');
});

test('phase-v: useTemplateSwitcher returns { baseType, suffix } shape', () => {
    const src = read(SWITCHER);
    assert.match(src, /baseType.*suffix/, 'hook return type must include baseType and suffix');
});

// ── Disabled state ─────────────────────────────────────────────────────────────

test('phase-v: disabled prop is guarded before calling onChange (prevents accidental change)', () => {
    const src = read(SWITCHER);
    assert.match(src, /if \(disabled\) return/, 'must guard onChange with `if (disabled) return`');
});

// ── Loading / empty state coverage ────────────────────────────────────────────

test('phase-v: loading skeleton renders animate-pulse class', () => {
    const src = read(SWITCHER);
    assert.match(src, /animate-pulse/, 'loading skeleton must use animate-pulse');
});

test('phase-v: empty state renders "No templates available" message', () => {
    const src = read(SWITCHER);
    assert.match(src, /No templates available/, 'empty state must show a "No templates available" message');
});

// ── Mobile-first / responsive ──────────────────────────────────────────────────

test('phase-v: TemplateSwitcherPanel uses min-w-0 and w-full for mobile-first layout', () => {
    const src = read(SWITCHER);
    assert.match(src, /min-w-0/, 'must use min-w-0 for shrinkable layout on narrow viewports');
    assert.match(src, /w-full/, 'must use w-full for 100% width on mobile');
});
