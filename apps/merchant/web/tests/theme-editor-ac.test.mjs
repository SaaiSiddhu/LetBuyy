/**
 * theme-editor-ac.test.mjs — Phase AC: AI Theme Customization (Lane B: Merchant UI).
 *
 * Tests source-level contracts for:
 *   - AICustomizationPanel.tsx (structured suggestion chips + preview + apply/reject)
 *   - /api/themes/[themeId]/editor/ai-customization/route.ts (same-origin proxy)
 *
 * Test style mirrors theme-editor-ab.test.mjs:
 *   - node:test + node:assert/strict
 *   - readFileSync source assertions
 *   - structural/pattern checks; no DOM, no network, no React render
 *
 * PHASE AC HARD RULES verified here (Lane B: merchant-web only):
 *
 * ── File existence ────────────────────────────────────────────────────────────
 *  - AICustomizationPanel.tsx exists in components/theme-editor/
 *  - ai-customization/route.ts exists under api/themes/[themeId]/editor/
 *
 * ── Component structure ───────────────────────────────────────────────────────
 *  - AICustomizationPanel is 'use client'
 *  - AICustomizationPanel imports from @letbuyy/ui
 *  - AICustomizationPanel imports deterministicPalette from @letbuyy/theme-engine
 *  - AICustomizationPanel imports suggestTypographyPairing from @letbuyy/theme-engine
 *  - AICustomizationPanel imports MODEL_BOUNDARY from @letbuyy/theme-engine
 *
 * ── Structured suggestion chips ───────────────────────────────────────────────
 *  - Panel contains PaletteVariant values: warm, cool, bold, muted
 *  - Panel contains FontPairingIntent values: editorial, technical, artisanal, friendly
 *  - Panel has role="group" for chip groups (keyboard navigability)
 *  - Panel has aria-pressed on chip buttons
 *
 * ── NO-AUTO-APPLY LAW ─────────────────────────────────────────────────────────
 *  - Panel has canApply guard
 *  - canApply requires proposal !== null (preview must be computed first)
 *  - Apply button has aria-disabled
 *  - Apply button has aria-label
 *  - Panel documents no auto-apply: proposal must exist before Apply is enabled
 *
 * ── NOT-CONNECTED (MODEL BOUNDARY) ────────────────────────────────────────────
 *  - Panel imports MODEL_BOUNDARY (references the NOT-CONNECTED constant)
 *  - Panel has NOT_CONNECTED / not-connected / not yet connected disclosure
 *  - Panel has free-text input that is disabled (NOT-CONNECTED state)
 *  - Panel shows free-text field is NOT-CONNECTED (aria-disabled + disabled)
 *  - Panel does NOT attempt keyword-heuristic NLU on free-text input
 *
 * ── DETERMINISM LAW ───────────────────────────────────────────────────────────
 *  - Panel source has NO Math.random() (no fabricated randomness)
 *  - Panel source has NO Date.now() (no time-varying output)
 *  - djb2Hash is present (the deterministic hash function)
 *  - proposeThemeCustomization is exported (the deterministic proposal engine)
 *
 * ── RISK-DUAL-N01 ────────────────────────────────────────────────────────────
 *  - Panel documents RISK-DUAL-N01 in comments
 *  - Panel does NOT assign to section_definitions
 *  - No dangerouslySetInnerHTML in Panel
 *  - Route documents RISK-DUAL-N01 in comments
 *
 * ── Tenancy (proxy route) ─────────────────────────────────────────────────────
 *  - Route imports resolveOwnedStoreId (tenancy verification)
 *  - Route imports merchantApiFetch (no direct DB access)
 *  - Route does NOT import createMerchantApiClient
 *  - Route uses resolved.storeId (never raw browser-supplied value)
 *  - Route documents NOT-CONNECTED
 *
 * ── Design ratchet ────────────────────────────────────────────────────────────
 *  - AICustomizationPanel has no raw rounded-[Npx] Tailwind classes
 *  - AICustomizationPanel uses --lb-* design tokens
 *
 * ── Foreign WIP isolation ─────────────────────────────────────────────────────
 *  - Panel does NOT import from editor/page.tsx
 *  - Panel does NOT import globals.css
 *  - Panel does NOT import from @letbuyy/api-client
 *  - Panel does NOT import ExperiencePicker
 *  - Route does NOT import @letbuyy/api-client
 *  - Route does NOT import from gateway src/index.ts
 *
 * ── Accessibility ─────────────────────────────────────────────────────────────
 *  - Panel has role="region" + aria-label / aria-labelledby
 *  - Chip groups have role="group" + aria-label
 *  - Apply button has aria-disabled
 *  - Apply button has aria-label
 *  - Reject button has aria-label
 *  - Free-text input has aria-disabled
 *  - Free-text input has aria-label mentioning "not yet connected"
 *
 * ── package.json ──────────────────────────────────────────────────────────────
 *  - theme-editor-ac.test.mjs is included in the test command
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const ROOT = new URL('../../../..', import.meta.url).pathname

function read(rel) {
    return readFileSync(`${ROOT}/${rel}`, 'utf8')
}
function exists(rel) {
    return existsSync(`${ROOT}/${rel}`)
}

const MCP_BASE = 'apps/merchant/web/src'

// ── File paths ─────────────────────────────────────────────────────────────────

const AI_PANEL    = `${MCP_BASE}/components/theme-editor/AICustomizationPanel.tsx`
const AI_PROXY    = `${MCP_BASE}/app/api/themes/[themeId]/editor/ai-customization/route.ts`
const PKG_JSON    = 'apps/merchant/web/package.json'

// Foreign WIP files — must not be imported or modified.
const EDITOR_PAGE = `${MCP_BASE}/app/[store]/online-store/themes/[themeId]/editor/page.tsx`

// ═════════════════════════════════════════════════════════════════════════════
// FILE EXISTENCE
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel.tsx exists in components/theme-editor/', () => {
    assert.ok(exists(AI_PANEL), 'AICustomizationPanel.tsx missing from components/theme-editor/')
})

test('phase-ac: ai-customization/route.ts exists under api/themes/[themeId]/editor/', () => {
    assert.ok(exists(AI_PROXY), 'ai-customization/route.ts missing from api/themes/[themeId]/editor/')
})

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT STRUCTURE
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel is a "use client" component', () => {
    assert.match(
        read(AI_PANEL),
        /^'use client'/m,
        'AICustomizationPanel must be a client component ("use client" at file top)'
    )
})

test('phase-ac: AICustomizationPanel imports from @letbuyy/ui', () => {
    assert.match(
        read(AI_PANEL),
        /@letbuyy\/ui/,
        'AICustomizationPanel must import from @letbuyy/ui'
    )
})

test('phase-ac: AICustomizationPanel imports deterministicPalette from @letbuyy/theme-engine', () => {
    assert.match(
        read(AI_PANEL),
        /deterministicPalette/,
        'AICustomizationPanel must import deterministicPalette from @letbuyy/theme-engine'
    )
})

test('phase-ac: AICustomizationPanel imports suggestTypographyPairing from @letbuyy/theme-engine', () => {
    assert.match(
        read(AI_PANEL),
        /suggestTypographyPairing/,
        'AICustomizationPanel must import suggestTypographyPairing from @letbuyy/theme-engine'
    )
})

test('phase-ac: AICustomizationPanel imports MODEL_BOUNDARY from @letbuyy/theme-engine', () => {
    assert.match(
        read(AI_PANEL),
        /MODEL_BOUNDARY/,
        'AICustomizationPanel must import MODEL_BOUNDARY to document the NOT-CONNECTED seam'
    )
})

test('phase-ac: AICustomizationPanel imports from @letbuyy/theme-engine', () => {
    assert.match(
        read(AI_PANEL),
        /@letbuyy\/theme-engine/,
        'AICustomizationPanel must import from @letbuyy/theme-engine'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// STRUCTURED SUGGESTION CHIPS
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel contains PaletteVariant "warm" chip', () => {
    assert.match(read(AI_PANEL), /'warm'|"warm"/, 'Must include warm palette chip')
})

test('phase-ac: AICustomizationPanel contains PaletteVariant "cool" chip', () => {
    assert.match(read(AI_PANEL), /'cool'|"cool"/, 'Must include cool palette chip')
})

test('phase-ac: AICustomizationPanel contains PaletteVariant "bold" chip', () => {
    assert.match(read(AI_PANEL), /'bold'|"bold"/, 'Must include bold palette chip')
})

test('phase-ac: AICustomizationPanel contains PaletteVariant "muted" chip', () => {
    assert.match(read(AI_PANEL), /'muted'|"muted"/, 'Must include muted palette chip')
})

test('phase-ac: AICustomizationPanel contains FontPairingIntent "editorial" chip', () => {
    assert.match(read(AI_PANEL), /'editorial'|"editorial"/, 'Must include editorial typography chip')
})

test('phase-ac: AICustomizationPanel contains FontPairingIntent "technical" chip', () => {
    assert.match(read(AI_PANEL), /'technical'|"technical"/, 'Must include technical typography chip')
})

test('phase-ac: AICustomizationPanel contains FontPairingIntent "artisanal" chip', () => {
    assert.match(read(AI_PANEL), /'artisanal'|"artisanal"/, 'Must include artisanal typography chip')
})

test('phase-ac: AICustomizationPanel contains FontPairingIntent "friendly" chip', () => {
    assert.match(read(AI_PANEL), /'friendly'|"friendly"/, 'Must include friendly typography chip')
})

test('phase-ac: AICustomizationPanel has role="group" for chip groups', () => {
    assert.match(
        read(AI_PANEL),
        /role="group"/,
        'Chip groups must have role="group" for keyboard navigability'
    )
})

test('phase-ac: AICustomizationPanel has aria-pressed on chip buttons', () => {
    assert.match(
        read(AI_PANEL),
        /aria-pressed/,
        'Chip buttons must have aria-pressed to indicate selection state'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// NO-AUTO-APPLY LAW
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel has canApply guard', () => {
    assert.match(
        read(AI_PANEL),
        /canApply/,
        'Must have a canApply computation that gates the Apply button'
    )
})

test('phase-ac: AICustomizationPanel canApply requires proposal to exist (no silent apply)', () => {
    const src = read(AI_PANEL)
    assert.match(
        src,
        /canApply.*proposal|proposal.*canApply/,
        'canApply must be gated on proposal existing (no auto-apply before preview is computed)'
    )
})

test('phase-ac: AICustomizationPanel Apply button has aria-disabled', () => {
    assert.match(
        read(AI_PANEL),
        /aria-disabled/,
        'Apply button must have aria-disabled to reflect canApply gate'
    )
})

test('phase-ac: AICustomizationPanel Apply button has aria-label', () => {
    assert.match(
        read(AI_PANEL),
        /aria-label.*[Aa]pply|[Aa]pply.*aria-label/,
        'Apply button must have an aria-label'
    )
})

test('phase-ac: AICustomizationPanel Reject button has aria-label', () => {
    assert.match(
        read(AI_PANEL),
        /aria-label.*[Rr]eject|[Rr]eject.*aria-label/,
        'Reject button must have an aria-label'
    )
})

test('phase-ac: AICustomizationPanel Apply does not auto-fire on chip selection', () => {
    const src = read(AI_PANEL)
    // Chip selection routes through handleSelectIntent (the compute step).
    // handleSelectIntent must NOT call handleApply — the merchant clicks Apply separately.
    assert.match(src, /handleSelectIntent/, 'Chips must route through handleSelectIntent')
    // Verify handleSelectIntent body does not invoke handleApply
    const fnStart = src.indexOf('const handleSelectIntent')
    const fnEnd = src.indexOf('\n    // ──', fnStart + 1)
    const fnBody = fnStart >= 0 && fnEnd > fnStart ? src.slice(fnStart, fnEnd) : src.slice(fnStart, fnStart + 1000)
    assert.doesNotMatch(
        fnBody,
        /handleApply\s*\(/,
        'handleSelectIntent must not invoke handleApply (no auto-apply on chip selection)'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// NOT-CONNECTED (MODEL BOUNDARY)
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel has NOT-CONNECTED disclosure', () => {
    const src = read(AI_PANEL)
    const hasDisclosure =
        /NOT.CONNECTED|not yet connected|not-connected/i.test(src)
    assert.ok(hasDisclosure, 'Must surface the NOT-CONNECTED model boundary to the merchant')
})

test('phase-ac: AICustomizationPanel has free-text input that is disabled', () => {
    assert.match(
        read(AI_PANEL),
        /type="text"[^>]*disabled|disabled[^>]*type="text"/,
        'Free-text input must be disabled (NOT-CONNECTED state — no keyword heuristic NLU)'
    )
})

test('phase-ac: AICustomizationPanel free-text input has aria-disabled', () => {
    assert.match(
        read(AI_PANEL),
        /aria-disabled.*true|"true".*aria-disabled/,
        'Free-text input must be aria-disabled="true" (not just hidden)'
    )
})

test('phase-ac: AICustomizationPanel free-text input aria-label mentions not yet connected', () => {
    assert.match(
        read(AI_PANEL),
        /aria-label.*not yet connected|not yet connected.*aria-label/i,
        'Free-text input aria-label must mention "not yet connected"'
    )
})

test('phase-ac: AICustomizationPanel references MODEL_BOUNDARY.envVar', () => {
    assert.match(
        read(AI_PANEL),
        /MODEL_BOUNDARY\.envVar|THEME_AI_PROVIDER_API_KEY/,
        'Panel must reference MODEL_BOUNDARY.envVar (the env var for the not-connected LLM provider)'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// DETERMINISM LAW (no fabricated model, no randomness, no time)
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel has NO Math.random() (no fabricated randomness)', () => {
    // Excludes comment lines (those starting with optional whitespace + * or /)
    assert.doesNotMatch(
        read(AI_PANEL),
        /^(?!\s*[\/*]).*Math\.random\(\)/m,
        'Panel must not call Math.random() — all proposals must be deterministic'
    )
})

test('phase-ac: AICustomizationPanel has NO Date.now() (no time-varying output)', () => {
    // Excludes comment lines (those starting with optional whitespace + * or /)
    assert.doesNotMatch(
        read(AI_PANEL),
        /^(?!\s*[\/*]).*Date\.now\(\)/m,
        'Panel must not call Date.now() — proposals must be deterministic (same input → same output)'
    )
})

test('phase-ac: AICustomizationPanel has djb2Hash function (deterministic hash)', () => {
    assert.match(
        read(AI_PANEL),
        /djb2Hash/,
        'Panel must implement djb2Hash — the deterministic hash used for proposalHash CAS guard'
    )
})

test('phase-ac: AICustomizationPanel exports proposeThemeCustomization', () => {
    assert.match(
        read(AI_PANEL),
        /export.*proposeThemeCustomization|proposeThemeCustomization.*export/,
        'proposeThemeCustomization must be exported (testable deterministic proposal engine)'
    )
})

test('phase-ac: proposeThemeCustomization is deterministic (has no Math.random or Date.now)', () => {
    const src = read(AI_PANEL)
    const fnStart = src.indexOf('function proposeThemeCustomization')
    const fnEnd = src.indexOf('\nfunction ', fnStart + 1)
    const fnBody = fnEnd > fnStart ? src.slice(fnStart, fnEnd) : src.slice(fnStart, fnStart + 2000)
    assert.doesNotMatch(fnBody, /Math\.random/, 'proposeThemeCustomization must not call Math.random')
    assert.doesNotMatch(fnBody, /Date\.now/, 'proposeThemeCustomization must not call Date.now')
})

// ═════════════════════════════════════════════════════════════════════════════
// RISK-DUAL-N01
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel documents RISK-DUAL-N01', () => {
    assert.match(
        read(AI_PANEL),
        /RISK-DUAL-N01/,
        'Panel must document RISK-DUAL-N01 (section_definitions must not be touched)'
    )
})

test('phase-ac: AICustomizationPanel does NOT assign to section_definitions', () => {
    assert.doesNotMatch(
        read(AI_PANEL),
        /section_definitions\s*=/,
        'Panel must never assign to section_definitions (RISK-DUAL-N01)'
    )
})

test('phase-ac: AICustomizationPanel has no dangerouslySetInnerHTML', () => {
    assert.doesNotMatch(
        read(AI_PANEL),
        /dangerouslySetInnerHTML/,
        'Panel must not use dangerouslySetInnerHTML (XSS risk)'
    )
})

test('phase-ac: route.ts documents RISK-DUAL-N01', () => {
    assert.match(
        read(AI_PROXY),
        /RISK-DUAL-N01/,
        'Proxy route must document RISK-DUAL-N01'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// TENANCY (proxy route)
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: route.ts imports resolveOwnedStoreId (tenancy verification)', () => {
    assert.match(
        read(AI_PROXY),
        /resolveOwnedStoreId/,
        'Proxy route must import resolveOwnedStoreId for tenant-safe store resolution'
    )
})

test('phase-ac: route.ts imports merchantApiFetch (no direct DB)', () => {
    assert.match(
        read(AI_PROXY),
        /merchantApiFetch/,
        'Proxy route must use merchantApiFetch — never direct DB access'
    )
})

test('phase-ac: route.ts does NOT import createMerchantApiClient', () => {
    assert.doesNotMatch(
        read(AI_PROXY),
        /createMerchantApiClient/,
        'Proxy route must use merchantApiFetch (not createMerchantApiClient) per proxy pattern'
    )
})

test('phase-ac: route.ts uses resolved.storeId (not raw browser param)', () => {
    assert.match(
        read(AI_PROXY),
        /resolved\.storeId/,
        'Proxy must use resolved.storeId — never the raw browser-supplied store param'
    )
})

test('phase-ac: route.ts documents NOT-CONNECTED', () => {
    const src = read(AI_PROXY)
    const hasNotConnected = /NOT.CONNECTED|NOT_CONNECTED/i.test(src)
    assert.ok(hasNotConnected, 'Proxy route must document the NOT-CONNECTED gateway state')
})

test('phase-ac: route.ts handles gateway NOT-CONNECTED (404/503) gracefully', () => {
    assert.match(
        read(AI_PROXY),
        /status.*404|status.*503|404.*503/,
        'Proxy route must handle gateway 404/503 gracefully (NOT-CONNECTED → structured 503 response)'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// DESIGN RATCHET
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel has no raw rounded-[Npx] Tailwind classes', () => {
    assert.doesNotMatch(
        read(AI_PANEL),
        /rounded-\[\d+px\]/,
        'AICustomizationPanel must not use raw rounded-[Npx] Tailwind arbitrary values; use --lb-radius-* tokens'
    )
})

test('phase-ac: AICustomizationPanel uses --lb-* design tokens', () => {
    assert.match(
        read(AI_PANEL),
        /--lb-/,
        'AICustomizationPanel must reference --lb-* CSS custom properties (design system tokens)'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel has role="region"', () => {
    assert.match(
        read(AI_PANEL),
        /role="region"/,
        'Panel root must have role="region"'
    )
})

test('phase-ac: AICustomizationPanel has aria-label or aria-labelledby on root region', () => {
    const src = read(AI_PANEL)
    assert.match(
        src,
        /aria-label="AI theme suggestions"|aria-labelledby=/,
        'Root region must have aria-label or aria-labelledby'
    )
})

test('phase-ac: AICustomizationPanel chip groups have aria-label', () => {
    assert.match(
        read(AI_PANEL),
        /aria-label="Palette suggestions"|aria-label="Typography suggestions"/,
        'Chip group containers must have descriptive aria-label'
    )
})

test('phase-ac: AICustomizationPanel Apply button has aria-busy', () => {
    assert.match(
        read(AI_PANEL),
        /aria-busy/,
        'Apply button must have aria-busy to indicate in-progress applying state'
    )
})

test('phase-ac: AICustomizationPanel diff table has aria-label', () => {
    assert.match(
        read(AI_PANEL),
        /aria-label="Token changes preview"|aria-label.*[Tt]oken/,
        'Diff table must have an aria-label'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// FOREIGN WIP ISOLATION
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: AICustomizationPanel does NOT import from editor/page.tsx', () => {
    assert.doesNotMatch(
        read(AI_PANEL),
        /editor\/page/,
        'Panel must not import from editor/page.tsx (foreign WIP)'
    )
})

test('phase-ac: AICustomizationPanel does NOT import globals.css', () => {
    assert.doesNotMatch(
        read(AI_PANEL),
        /globals\.css/,
        'Panel must not import globals.css (foreign WIP)'
    )
})

test('phase-ac: AICustomizationPanel does NOT import from @letbuyy/api-client', () => {
    assert.doesNotMatch(
        read(AI_PANEL),
        /@letbuyy\/api-client/,
        'Panel must not import from @letbuyy/api-client (forbidden)'
    )
})

test('phase-ac: AICustomizationPanel does NOT import ExperiencePicker', () => {
    // Use AB-style pattern: exclude comment lines (lines starting with optional whitespace + * or /)
    assert.doesNotMatch(
        read(AI_PANEL),
        /^(?!\s*[\/*]).*\bimport\b.*\bExperiencePicker\b/m,
        'Panel must not import ExperiencePicker (foreign WIP)'
    )
})

test('phase-ac: route.ts does NOT import from @letbuyy/api-client', () => {
    assert.doesNotMatch(
        read(AI_PROXY),
        /@letbuyy\/api-client/,
        'Route must not import from @letbuyy/api-client (forbidden; use merchantApiFetch)'
    )
})

test('phase-ac: route.ts does NOT import from gateway src/index', () => {
    assert.doesNotMatch(
        read(AI_PROXY),
        /services\/api-gateway\/src\/index/,
        'Route must not import from gateway src/index.ts (foreign WIP)'
    )
})

test('phase-ac: editor/page.tsx is NOT modified to reference AICustomizationPanel', () => {
    // Foreign WIP: editor/page.tsx must not have been changed to reference the panel.
    // This check verifies isolation from the foreign WIP page.
    if (!existsSync(`${ROOT}/${EDITOR_PAGE}`)) return // file might not exist in all environments
    assert.doesNotMatch(
        read(EDITOR_PAGE),
        /AICustomizationPanel/,
        'Foreign WIP editor/page.tsx must not reference AICustomizationPanel'
    )
})

// ═════════════════════════════════════════════════════════════════════════════
// PACKAGE.JSON — test command includes this file
// ═════════════════════════════════════════════════════════════════════════════

test('phase-ac: package.json test command includes theme-editor-ac.test.mjs', () => {
    assert.match(
        read(PKG_JSON),
        /theme-editor-ac\.test\.mjs/,
        'apps/merchant/web/package.json test command must include theme-editor-ac.test.mjs'
    )
})
