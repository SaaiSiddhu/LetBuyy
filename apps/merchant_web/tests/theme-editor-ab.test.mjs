/**
 * theme-editor-ab.test.mjs — Phase AB: Theme Safe Update UI (Lane C).
 *
 * Tests source-level contracts for:
 *   - ThemeUpdatePanel.tsx (the main update UI component)
 *   - /api/themes/[themeId]/update-preview/route.ts (same-origin preview proxy)
 *   - /api/themes/[themeId]/update/route.ts (same-origin update proxy)
 *   - /[store]/online-store/themes/update/page.tsx (server component wrapper)
 *   - /[store]/online-store/themes/update/UpdatePageClient.tsx (client component)
 *
 * Test style mirrors theme-editor-aa/z/w.test.mjs:
 *  - node:test + node:assert/strict
 *  - readFileSync source assertions
 *  - structural/pattern checks; no DOM, no network, no React render
 *
 * PHASE AB HARD RULES verified here (Lane C only):
 *
 * ── File existence ────────────────────────────────────────────────────────────
 *  - ThemeUpdatePanel.tsx exists in components/theme-editor/
 *  - update-preview/route.ts exists under api/themes/[themeId]/
 *  - update/route.ts exists under api/themes/[themeId]/
 *  - update/page.tsx exists as server component
 *  - update/UpdatePageClient.tsx exists as client component
 *  - Foreign WIP files are NOT modified
 *
 * ── ThemeUpdatePanel: update detection ───────────────────────────────────────
 *  - Shows "Update available" badge when availableVersionId !== currentVersionId
 *  - Renders no-update state (no badge) when versions are equal
 *  - Preview button present before applying
 *  - canApply requires diff previewed first (no silent apply)
 *  - canApply requires conflicts acknowledged when requiresDuplicate=true
 *  - confirm_diff_hash sent in apply payload (CAS guard)
 *  - Rollback calls POST /api/themes/:slug/releases/:releaseId/rollback
 *
 * ── ThemeUpdatePanel: diff rendering ────────────────────────────────────────
 *  - Section diff table renders added/removed/retained/incompatible rows
 *  - requiresDuplicate warning shown when required
 *  - "Duplicate first" action present in conflict warning
 *  - Apply button aria-disabled when canApply=false
 *
 * ── RISK-DUAL-N01 ────────────────────────────────────────────────────────────
 *  - ThemeUpdatePanel documents RISK-DUAL-N01
 *  - ThemeUpdatePanel does NOT assign to section_definitions
 *  - No dangerouslySetInnerHTML in ThemeUpdatePanel
 *  - Proxy routes document RISK-DUAL-N01
 *
 * ── Tenancy (proxy routes) ────────────────────────────────────────────────────
 *  - Both proxies import resolveOwnedStoreId
 *  - Both proxies import merchantApiFetch (no direct DB)
 *  - Both proxies do NOT use createMerchantApiClient
 *  - Both proxies use resolved.storeId (never raw browser-supplied value)
 *  - Both proxies document NOT-CONNECTED
 *
 * ── Design ratchet ────────────────────────────────────────────────────────────
 *  - ThemeUpdatePanel imports from @letbuyy/ui
 *  - UpdatePageClient imports from @letbuyy/ui
 *  - No component has raw rounded-[Npx] Tailwind classes
 *  - Components use --lb-* design tokens
 *
 * ── Foreign WIP isolation ─────────────────────────────────────────────────────
 *  - No Phase AB file imports from editor/page.tsx
 *  - No Phase AB file imports globals.css
 *  - No Phase AB file imports from @letbuyy/api-client
 *  - No Phase AB file imports ExperiencePicker
 *  - Foreign WIP editor/page.tsx does not reference ThemeUpdatePanel
 *
 * ── A11y ──────────────────────────────────────────────────────────────────────
 *  - ThemeUpdatePanel has role="region" + aria-label
 *  - Diff table has aria-label
 *  - Apply button has aria-disabled
 *  - Apply button has aria-label
 *  - Rollback button has aria-label
 *  - Preview button has aria-label
 *  - Loading state has aria-busy
 *  - aria-expanded on diff collapse/expand toggle
 *
 * ── Component structure ───────────────────────────────────────────────────────
 *  - ThemeUpdatePanel is 'use client'
 *  - update/page.tsx is NOT 'use client' (server component)
 *  - UpdatePageClient is 'use client'
 *  - UpdatePageClient renders ThemeUpdatePanel
 *
 * ── package.json ──────────────────────────────────────────────────────────────
 *  - theme-editor-ab.test.mjs is included in the test command
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('../../..', import.meta.url).pathname

function read(rel) {
    return readFileSync(`${ROOT}/${rel}`, 'utf8')
}
function exists(rel) {
    return existsSync(`${ROOT}/${rel}`)
}

const MCP_BASE = 'apps/merchant-control-plane/src'

// ── File paths ─────────────────────────────────────────────────────────────────

const UPDATE_PANEL    = `${MCP_BASE}/components/theme-editor/ThemeUpdatePanel.tsx`
const PREVIEW_PROXY   = `${MCP_BASE}/app/api/themes/[themeId]/update-preview/route.ts`
const UPDATE_PROXY    = `${MCP_BASE}/app/api/themes/[themeId]/update/route.ts`
const UPDATE_PAGE     = `${MCP_BASE}/app/[store]/online-store/themes/update/page.tsx`
const UPDATE_CLIENT   = `${MCP_BASE}/app/[store]/online-store/themes/update/UpdatePageClient.tsx`
const PKG_JSON        = 'apps/merchant-control-plane/package.json'

// Foreign WIP files — must not be imported or modified.
const EDITOR_PAGE     = `${MCP_BASE}/app/[store]/online-store/themes/[themeId]/editor/page.tsx`

// ═════════════════════════════════════════════════════════════════════════════
// FILE EXISTENCE
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel.tsx exists in components/theme-editor/', () => {
    assert.ok(exists(UPDATE_PANEL), 'ThemeUpdatePanel.tsx missing from components/theme-editor/')
})

test('phase-ab: update-preview/route.ts proxy exists under api/themes/[themeId]/', () => {
    assert.ok(exists(PREVIEW_PROXY), 'update-preview/route.ts missing from api/themes/[themeId]/')
})

test('phase-ab: update/route.ts proxy exists under api/themes/[themeId]/', () => {
    assert.ok(exists(UPDATE_PROXY), 'update/route.ts missing from api/themes/[themeId]/')
})

test('phase-ab: update/page.tsx exists as the server component wrapper', () => {
    assert.ok(exists(UPDATE_PAGE), 'update/page.tsx missing from online-store/themes/update/')
})

test('phase-ab: UpdatePageClient.tsx exists alongside update/page.tsx', () => {
    assert.ok(exists(UPDATE_CLIENT), 'UpdatePageClient.tsx missing from online-store/themes/update/')
})

// ═════════════════════════════════════════════════════════════════════════════
// CLIENT / SERVER COMPONENT STRUCTURE
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel is a "use client" component', () => {
    assert.match(read(UPDATE_PANEL), /^'use client'/m, 'ThemeUpdatePanel must be a client component')
})

test('phase-ab: update/page.tsx is NOT a "use client" component (server component)', () => {
    assert.doesNotMatch(
        read(UPDATE_PAGE),
        /^'use client'/m,
        'update/page.tsx must be a server component — "use client" must not appear at module level'
    )
})

test('phase-ab: UpdatePageClient is a "use client" component', () => {
    assert.match(read(UPDATE_CLIENT), /^'use client'/m, 'UpdatePageClient must be a client component')
})

test('phase-ab: UpdatePageClient renders ThemeUpdatePanel', () => {
    assert.match(
        read(UPDATE_CLIENT),
        /ThemeUpdatePanel/,
        'UpdatePageClient must render ThemeUpdatePanel'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// UPDATE DETECTION: "Update available" badge
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel shows "Update available" badge when versions differ', () => {
    const src = read(UPDATE_PANEL)
    assert.match(src, /Update available/, 'Must show "Update available" text when availableVersionId !== currentVersionId')
})

test('phase-ab: ThemeUpdatePanel compares availableVersionId with currentVersionId', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /availableVersionId.*!==.*currentVersionId|currentVersionId.*!==.*availableVersionId/,
        'Must compare availableVersionId !== currentVersionId for badge display'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// NO-DATA-LOSS LAW: no silent apply + CAS guard
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel has canApply guard that requires diff to be fetched first (no silent apply)', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /canApply/,
        'Must have a canApply computation that gates the Apply button'
    )
    // canApply must require diff?.diffHash to be truthy — proves no silent apply
    assert.match(
        src,
        /diff.*diffHash|diffHash.*diff/,
        'canApply must check for diff.diffHash (preview must run before apply)'
    )
})

test('phase-ab: ThemeUpdatePanel requires conflictsAcknowledged before applying when requiresDuplicate=true', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /conflictsAcknowledged/,
        'Must require conflictsAcknowledged when requiresDuplicate=true (no silent apply past conflict warning)'
    )
    assert.match(
        src,
        /requiresDuplicate.*conflictsAcknowledged|conflictsAcknowledged.*requiresDuplicate/,
        'canApply must gate on requiresDuplicate and conflictsAcknowledged together'
    )
})

test('phase-ab: ThemeUpdatePanel sends confirm_diff_hash in apply payload (CAS guard)', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /confirm_diff_hash/,
        'Apply payload must include confirm_diff_hash (CAS guard against stale previews)'
    )
    assert.match(
        src,
        /diff\.diffHash/,
        'confirm_diff_hash value must be taken from diff.diffHash'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// DIFF RENDERING: section diff table
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel renders diff table with section change rows', () => {
    const src = read(UPDATE_PANEL)
    assert.match(src, /<[Tt]able/, 'Must render a <table> for the section diff')
    assert.match(src, /aria-label.*[Uu]pdate diff|[Uu]pdate diff.*aria-label/, 'Diff table must have aria-label')
})

test('phase-ab: ThemeUpdatePanel diff table has "added" action', () => {
    assert.match(read(UPDATE_PANEL), /added/, 'Diff table must handle "added" sections')
})

test('phase-ab: ThemeUpdatePanel diff table has "removed" action', () => {
    assert.match(read(UPDATE_PANEL), /removed/, 'Diff table must handle "removed" sections')
})

test('phase-ab: ThemeUpdatePanel diff table has "retained" action', () => {
    assert.match(read(UPDATE_PANEL), /retained/, 'Diff table must handle "retained" sections')
})

test('phase-ab: ThemeUpdatePanel diff table has "incompatible" action', () => {
    assert.match(read(UPDATE_PANEL), /incompatible/, 'Diff table must handle "incompatible" sections')
})

// ═════════════════════════════════════════════════════════════════════════════
// requiresDuplicate CONFLICT HANDLING
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel shows requiresDuplicate warning when required', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /requiresDuplicate/,
        'Must surface the requiresDuplicate warning from the preview diff'
    )
    assert.match(
        src,
        /Duplicate/,
        'Must show a "Duplicate" action in the conflict warning'
    )
})

test('phase-ab: ThemeUpdatePanel has "Duplicate first" action in conflicts state (blocking warning)', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /Duplicate first/,
        'Must show "Duplicate first" as the primary action when requiresDuplicate=true (NO-DATA-LOSS)'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// ROLLBACK (Phase P reuse)
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel rollback calls Phase P rollback proxy', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /releases.*rollback|rollback.*releases/,
        'Rollback must call /releases/:releaseId/rollback (Phase P proxy reuse)'
    )
})

test('phase-ab: ThemeUpdatePanel has rollback confirm dialog (destructive action gated)', () => {
    const src = read(UPDATE_PANEL)
    assert.match(src, /ConfirmDialog/, 'Rollback must be gated by a ConfirmDialog — not a silent action')
    assert.match(src, /destructive/, 'ConfirmDialog for rollback must be marked destructive')
})

// ═════════════════════════════════════════════════════════════════════════════
// PROXY: update-preview/route.ts
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: update-preview proxy imports resolveOwnedStoreId (tenancy law)', () => {
    assert.match(
        read(PREVIEW_PROXY),
        /resolveOwnedStoreId/,
        'update-preview proxy must import resolveOwnedStoreId to enforce store ownership'
    )
})

test('phase-ab: update-preview proxy imports merchantApiFetch (no direct DB)', () => {
    assert.match(
        read(PREVIEW_PROXY),
        /merchantApiFetch/,
        'update-preview proxy must use merchantApiFetch — no direct DB access'
    )
})

test('phase-ab: update-preview proxy does NOT use createMerchantApiClient (raw fetch required)', () => {
    assert.doesNotMatch(
        read(PREVIEW_PROXY),
        /createMerchantApiClient/,
        'update-preview proxy must not use the typed api-client — use merchantApiFetch directly'
    )
})

test('phase-ab: update-preview proxy uses resolved.storeId in gateway URL (tenancy)', () => {
    assert.match(
        read(PREVIEW_PROXY),
        /resolved\.storeId/,
        'update-preview proxy must use resolved.storeId — never the raw browser-supplied value'
    )
})

test('phase-ab: update-preview proxy forwards to /themes/*/update-preview on gateway', () => {
    assert.match(
        read(PREVIEW_PROXY),
        /\/themes\/.*update-preview/,
        'update-preview proxy must forward to the gateway /themes/:slug/update-preview path'
    )
})

test('phase-ab: update-preview proxy exports GET handler', () => {
    assert.match(
        read(PREVIEW_PROXY),
        /export async function GET/,
        'update-preview/route.ts must export GET handler'
    )
})

test('phase-ab: update-preview proxy documents NOT-CONNECTED contract', () => {
    assert.match(
        read(PREVIEW_PROXY),
        /NOT-CONNECTED/,
        'update-preview proxy must document NOT-CONNECTED dependency on the gateway route'
    )
})

test('phase-ab: update-preview proxy documents RISK-DUAL-N01', () => {
    assert.match(
        read(PREVIEW_PROXY),
        /RISK-DUAL-N01/,
        'update-preview proxy must document RISK-DUAL-N01 (read-only, never mutates section_definitions)'
    )
})

test('phase-ab: update-preview proxy returns 400 for missing store_id', () => {
    assert.match(read(PREVIEW_PROXY), /status.*400|400.*status/, 'Must return 400 for missing store_id')
})

// ═════════════════════════════════════════════════════════════════════════════
// PROXY: update/route.ts
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: update proxy imports resolveOwnedStoreId (tenancy law)', () => {
    assert.match(
        read(UPDATE_PROXY),
        /resolveOwnedStoreId/,
        'update proxy must import resolveOwnedStoreId'
    )
})

test('phase-ab: update proxy imports merchantApiFetch (no direct DB)', () => {
    assert.match(
        read(UPDATE_PROXY),
        /merchantApiFetch/,
        'update proxy must use merchantApiFetch — no direct DB access'
    )
})

test('phase-ab: update proxy does NOT use createMerchantApiClient (raw fetch required)', () => {
    assert.doesNotMatch(
        read(UPDATE_PROXY),
        /createMerchantApiClient/,
        'update proxy must not use the typed api-client — use merchantApiFetch directly'
    )
})

test('phase-ab: update proxy uses resolved.storeId in gateway body (tenancy)', () => {
    assert.match(
        read(UPDATE_PROXY),
        /resolved\.storeId/,
        'update proxy must use resolved.storeId — never the raw browser-supplied store_id'
    )
})

test('phase-ab: update proxy exports POST handler', () => {
    assert.match(
        read(UPDATE_PROXY),
        /export async function POST/,
        'update/route.ts must export POST handler'
    )
})

test('phase-ab: update proxy forwards to /themes/*/update on gateway', () => {
    assert.match(
        read(UPDATE_PROXY),
        /\/themes\/.*update/,
        'update proxy must forward to the gateway /themes/:slug/update path'
    )
})

test('phase-ab: update proxy validates confirm_diff_hash (CAS guard)', () => {
    assert.match(
        read(UPDATE_PROXY),
        /confirm_diff_hash/,
        'update proxy must validate confirm_diff_hash (CAS guard)'
    )
})

test('phase-ab: update proxy documents NOT-CONNECTED contract', () => {
    assert.match(
        read(UPDATE_PROXY),
        /NOT-CONNECTED/,
        'update proxy must document NOT-CONNECTED dependency on the gateway route'
    )
})

test('phase-ab: update proxy documents RISK-DUAL-N01', () => {
    assert.match(
        read(UPDATE_PROXY),
        /RISK-DUAL-N01/,
        'update proxy must document RISK-DUAL-N01'
    )
})

test('phase-ab: update proxy returns 400 for missing confirm_diff_hash', () => {
    const src = read(UPDATE_PROXY)
    assert.match(
        src,
        /confirm_diff_hash.*400|400.*confirm_diff_hash|MISSING_DIFF_HASH/,
        'update proxy must reject missing/short confirm_diff_hash with 400'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// RISK-DUAL-N01: no section_definitions mutation
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel documents RISK-DUAL-N01', () => {
    assert.match(
        read(UPDATE_PANEL),
        /RISK-DUAL-N01/,
        'ThemeUpdatePanel must document RISK-DUAL-N01 (instance only, never section_definitions catalog)'
    )
})

test('phase-ab: ThemeUpdatePanel does not assign to section_definitions (RISK-DUAL-N01)', () => {
    assert.doesNotMatch(
        read(UPDATE_PANEL),
        /section_definitions\s*=/,
        'ThemeUpdatePanel must never assign to section_definitions (RISK-DUAL-N01)'
    )
})

test('phase-ab: UpdatePageClient documents RISK-DUAL-N01', () => {
    assert.match(
        read(UPDATE_CLIENT),
        /RISK-DUAL-N01/,
        'UpdatePageClient must document RISK-DUAL-N01'
    )
})

test('phase-ab: UpdatePageClient does not assign to section_definitions (RISK-DUAL-N01)', () => {
    assert.doesNotMatch(
        read(UPDATE_CLIENT),
        /section_definitions\s*=/,
        'UpdatePageClient must never assign to section_definitions'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// SANDBOX / INJECTION SAFETY
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel has no dangerouslySetInnerHTML (SANDBOX LAW)', () => {
    assert.doesNotMatch(
        read(UPDATE_PANEL),
        /dangerouslySetInnerHTML/,
        'SANDBOX LAW: must not use dangerouslySetInnerHTML'
    )
})

test('phase-ab: UpdatePageClient has no dangerouslySetInnerHTML', () => {
    assert.doesNotMatch(
        read(UPDATE_CLIENT),
        /dangerouslySetInnerHTML/,
        'SANDBOX LAW: UpdatePageClient must not use dangerouslySetInnerHTML'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// DESIGN TOKEN COMPLIANCE
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel imports from @letbuyy/ui (design token compliance)', () => {
    assert.match(
        read(UPDATE_PANEL),
        /from '@letbuyy\/ui'/,
        'ThemeUpdatePanel must import components from @letbuyy/ui'
    )
})

test('phase-ab: UpdatePageClient imports from @letbuyy/ui', () => {
    assert.match(
        read(UPDATE_CLIENT),
        /from '@letbuyy\/ui'/,
        'UpdatePageClient must import from @letbuyy/ui'
    )
})

test('phase-ab: ThemeUpdatePanel uses --lb-* design tokens', () => {
    assert.match(
        read(UPDATE_PANEL),
        /--lb-/,
        'ThemeUpdatePanel must use --lb-* design tokens (design-system ratchet)'
    )
})

test('phase-ab: UpdatePageClient uses --lb-* design tokens', () => {
    assert.match(
        read(UPDATE_CLIENT),
        /--lb-/,
        'UpdatePageClient must use --lb-* design tokens'
    )
})

test('phase-ab: ThemeUpdatePanel has no raw rounded-[Npx] Tailwind classes (design ratchet)', () => {
    assert.doesNotMatch(
        read(UPDATE_PANEL),
        /rounded-\[\d+px\]/,
        'ThemeUpdatePanel must not use raw rounded-[Npx] Tailwind classes'
    )
})

test('phase-ab: UpdatePageClient has no raw rounded-[Npx] Tailwind classes', () => {
    assert.doesNotMatch(
        read(UPDATE_CLIENT),
        /rounded-\[\d+px\]/,
        'UpdatePageClient must not use raw rounded-[Npx] classes'
    )
})

test('phase-ab: update/page.tsx has no raw rounded-[Npx] Tailwind classes', () => {
    assert.doesNotMatch(
        read(UPDATE_PAGE),
        /rounded-\[\d+px\]/,
        'update/page.tsx must not use raw rounded-[Npx] classes'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY (a11y)
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel has role="region" on wrapper (a11y)', () => {
    assert.match(
        read(UPDATE_PANEL),
        /role="region"/,
        'ThemeUpdatePanel must have role="region" on its wrapper for landmark navigation'
    )
})

test('phase-ab: ThemeUpdatePanel has aria-label on region wrapper (a11y)', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /aria-label.*[Tt]heme update|[Tt]heme update.*aria-label/,
        'Region wrapper must have a descriptive aria-label'
    )
})

test('phase-ab: ThemeUpdatePanel diff table has aria-label (a11y)', () => {
    assert.match(
        read(UPDATE_PANEL),
        /aria-label.*[Dd]iff|[Dd]iff.*aria-label/,
        'Diff table must have an aria-label describing its purpose'
    )
})

test('phase-ab: ThemeUpdatePanel Apply button has aria-disabled (a11y)', () => {
    assert.match(
        read(UPDATE_PANEL),
        /aria-disabled/,
        'Apply button must have aria-disabled when canApply=false'
    )
})

test('phase-ab: ThemeUpdatePanel Apply button has aria-label (a11y)', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /aria-label.*[Aa]pply|[Aa]pply.*aria-label/,
        'Apply update button must have a descriptive aria-label explaining its current state'
    )
})

test('phase-ab: ThemeUpdatePanel Rollback button has aria-label (a11y)', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /aria-label.*[Rr]ollback|[Rr]ollback.*aria-label/,
        'Rollback button must have aria-label'
    )
})

test('phase-ab: ThemeUpdatePanel Preview button has aria-label (a11y)', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /aria-label.*[Pp]review|[Pp]review.*aria-label/,
        'Preview update button must have aria-label'
    )
})

test('phase-ab: ThemeUpdatePanel loading skeleton has aria-busy (a11y)', () => {
    assert.match(
        read(UPDATE_PANEL),
        /aria-busy/,
        'Loading skeleton must have aria-busy for screen readers'
    )
})

test('phase-ab: ThemeUpdatePanel diff toggle has aria-expanded (a11y)', () => {
    assert.match(
        read(UPDATE_PANEL),
        /aria-expanded/,
        'Diff expand/collapse toggle must have aria-expanded'
    )
})

test('phase-ab: ThemeUpdatePanel diff toggle has aria-controls (a11y)', () => {
    assert.match(
        read(UPDATE_PANEL),
        /aria-controls/,
        'Diff toggle must have aria-controls pointing at the diff table id'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// ALL STATES: loading/error/no-update/available/previewing/conflicts/updating/done
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel has no-update state', () => {
    assert.match(read(UPDATE_PANEL), /no-update/, 'Must have a no-update state')
})

test('phase-ab: ThemeUpdatePanel has available state', () => {
    assert.match(read(UPDATE_PANEL), /available/, 'Must have an available state')
})

test('phase-ab: ThemeUpdatePanel has previewing state', () => {
    assert.match(read(UPDATE_PANEL), /previewing/, 'Must have a previewing state')
})

test('phase-ab: ThemeUpdatePanel has conflicts state', () => {
    assert.match(read(UPDATE_PANEL), /conflicts/, 'Must have a conflicts state')
})

test('phase-ab: ThemeUpdatePanel has updating state', () => {
    assert.match(read(UPDATE_PANEL), /updating/, 'Must have an updating state')
})

test('phase-ab: ThemeUpdatePanel has done state', () => {
    assert.match(read(UPDATE_PANEL), /done/, 'Must have a done state')
})

test('phase-ab: ThemeUpdatePanel has error state', () => {
    assert.match(read(UPDATE_PANEL), /error/, 'Must have an error state')
})

// ═════════════════════════════════════════════════════════════════════════════
// FOREIGN WIP ISOLATION
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel does not import from editor/page.tsx (foreign WIP)', () => {
    assert.doesNotMatch(
        read(UPDATE_PANEL),
        /from.*editor\/page|editor\/page.*from/,
        'Must not import from foreign-WIP editor/page.tsx'
    )
})

test('phase-ab: ThemeUpdatePanel does not import globals.css (foreign WIP)', () => {
    assert.doesNotMatch(
        read(UPDATE_PANEL),
        /^(?!\s*[\/*]).*\bimport\b.*globals\.css/m,
        'Must not import globals.css'
    )
})

test('phase-ab: ThemeUpdatePanel does not import from @letbuyy/api-client (foreign WIP)', () => {
    assert.doesNotMatch(
        read(UPDATE_PANEL),
        /from '@letbuyy\/api-client'/,
        'Must not import @letbuyy/api-client directly — use raw fetch to same-origin proxy'
    )
})

test('phase-ab: ThemeUpdatePanel does not import ExperiencePicker (foreign WIP)', () => {
    assert.doesNotMatch(
        read(UPDATE_PANEL),
        /^(?!\s*[\/*]).*\bimport\b.*\bExperiencePicker\b/m,
        'Must not import ExperiencePicker (foreign WIP)'
    )
})

test('phase-ab: UpdatePageClient does not import from editor/page.tsx', () => {
    assert.doesNotMatch(
        read(UPDATE_CLIENT),
        /from.*editor\/page/,
        'UpdatePageClient must not import from editor/page.tsx'
    )
})

test('phase-ab: UpdatePageClient does not import globals.css', () => {
    assert.doesNotMatch(
        read(UPDATE_CLIENT),
        /^(?!\s*[\/*]).*\bimport\b.*globals\.css/m,
        'UpdatePageClient must not import globals.css'
    )
})

test('phase-ab: UpdatePageClient does not import from @letbuyy/api-client', () => {
    assert.doesNotMatch(
        read(UPDATE_CLIENT),
        /from '@letbuyy\/api-client'/,
        'UpdatePageClient must not import @letbuyy/api-client directly'
    )
})

test('phase-ab: UpdatePageClient does not import ExperiencePicker', () => {
    assert.doesNotMatch(
        read(UPDATE_CLIENT),
        /^(?!\s*[\/*]).*\bimport\b.*\bExperiencePicker\b/m,
        'UpdatePageClient must not import ExperiencePicker'
    )
})

test('phase-ab: update/page.tsx does not import from editor/page.tsx', () => {
    assert.doesNotMatch(read(UPDATE_PAGE), /from.*editor\/page/, 'update/page.tsx must not import from editor/page.tsx')
})

test('phase-ab: update/page.tsx does not import globals.css', () => {
    assert.doesNotMatch(
        read(UPDATE_PAGE),
        /^(?!\s*[\/*]).*\bimport\b.*globals\.css/m,
        'update/page.tsx must not import globals.css'
    )
})

test('phase-ab: update/page.tsx does not import @letbuyy/api-client directly', () => {
    assert.doesNotMatch(read(UPDATE_PAGE), /from '@letbuyy\/api-client'/, 'update/page.tsx must not import api-client')
})

test('phase-ab: foreign WIP editor/page.tsx is NOT modified (no ThemeUpdatePanel reference)', () => {
    assert.ok(exists(EDITOR_PAGE), 'editor/page.tsx must still exist')
    assert.doesNotMatch(
        read(EDITOR_PAGE),
        /ThemeUpdatePanel|UpdatePageClient/,
        'editor/page.tsx must not reference Phase AB components (foreign WIP isolation)'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// PROXY: no Supabase direct access
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: update-preview proxy does not use Supabase directly', () => {
    assert.doesNotMatch(
        read(PREVIEW_PROXY),
        /@supabase|createClient/,
        'update-preview proxy must not access Supabase directly'
    )
})

test('phase-ab: update proxy does not use Supabase directly', () => {
    assert.doesNotMatch(
        read(UPDATE_PROXY),
        /@supabase|createClient/,
        'update proxy must not access Supabase directly'
    )
})

test('phase-ab: update-preview proxy has no raw rounded-[Npx] classes', () => {
    assert.doesNotMatch(read(PREVIEW_PROXY), /rounded-\[\d+px\]/, 'No raw rounded-[Npx] in proxy routes')
})

test('phase-ab: update proxy has no raw rounded-[Npx] classes', () => {
    assert.doesNotMatch(read(UPDATE_PROXY), /rounded-\[\d+px\]/, 'No raw rounded-[Npx] in proxy routes')
})

// ═════════════════════════════════════════════════════════════════════════════
// PROXY: calls same-origin proxy (no direct gateway from component)
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel calls /api/themes/ same-origin proxy for preview (not gateway direct)', () => {
    const src = read(UPDATE_PANEL)
    assert.match(
        src,
        /\/api\/themes\/.*update-preview/,
        'ThemeUpdatePanel must call the same-origin /api/themes/*/update-preview proxy'
    )
    assert.match(
        src,
        /\bfetch\(/,
        'Must use raw fetch for the proxy calls'
    )
})

test('phase-ab: ThemeUpdatePanel calls /api/themes/ same-origin proxy for apply update', () => {
    assert.match(
        read(UPDATE_PANEL),
        /\/api\/themes\/.*\/update/,
        'ThemeUpdatePanel must call the same-origin /api/themes/*/update proxy'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// MONEY SAFETY
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: ThemeUpdatePanel does not reference the canonical money ledger', () => {
    const src = read(UPDATE_PANEL)
    assert.doesNotMatch(
        src,
        /create_checkout_order|payment_transactions|confirm_order_payment|payouts/,
        'Must not touch money ledger'
    )
})

test('phase-ab: UpdatePageClient does not reference the canonical money ledger', () => {
    const src = read(UPDATE_CLIENT)
    assert.doesNotMatch(
        src,
        /create_checkout_order|payment_transactions|confirm_order_payment/,
        'Must not touch money ledger'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// PACKAGE.JSON: test command includes this test file
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ab: package.json test command includes theme-editor-ab.test.mjs', () => {
    assert.match(
        read(PKG_JSON),
        /theme-editor-ab\.test\.mjs/,
        'package.json test command must include theme-editor-ab.test.mjs'
    )
})
