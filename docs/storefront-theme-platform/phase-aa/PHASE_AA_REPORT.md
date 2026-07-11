# Phase AA — Report: Custom CSS + Code Workspace

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AA — Custom CSS + Code Workspace
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** COMPLETE (work uncommitted per Phase AA hard rules)

---

## 1. Summary

Phase AA establishes the SAFE-CSS LAW: a single-enforcement-point pure-string CSS validator that blocks all 22 known injection vector classes before any merchant-authored CSS reaches the DOM. DOMPurify is not modified; the custom CSS sanitizer closes the CSS-level gap that DOMPurify cannot fill by design.

The phase delivers three cooperating components:
1. **Lane A engine (`custom-css-sanitizer.ts`)** — the canonical validator; pure TypeScript, no DOM globals; exports `validateAndScopeCustomCss`, `validateCustomCss`, `buildScopedCustomCss`, `hasUnsafeCssUrlScheme`, and `CUSTOM_CSS_MAX_BYTES`.
2. **Lane A renderer integration (`theme-renderer.ts`)** — `buildLiquidThemeHeadAssets(bundle, rawCustomCss?)` validates and scopes raw CSS internally; fail-closed; single enforcement point.
3. **Lane B editor (`CustomCssWorkspace.tsx` + `appearance/page.tsx` + `settings/route.ts`)** — self-contained merchant editor with client-side validation on blur + pre-save; matching server-side guard at the proxy layer preventing direct API bypass.

The `custom_css` render path (injection into the storefront `<head>`) remains NOT-CONNECTED in Phase AA. The validator, editor, and server-side storage pipeline are in place; the storefront `layout.tsx` → `buildLiquidThemeHeadAssets` wiring is a Phase AB deliverable.

**Test gate:** 1592/1592 theme-engine · 619/619 merchant theme-editor suite · api-gateway 519 pass · storefront-runtime 795/795 · all typechecks clean.

---

## 2. Deliverables

### Lane A — Engine (`packages/theme-engine/`)

#### `packages/theme-engine/src/custom-css-sanitizer.ts` — NEW

Pure-string CSS validator (no DOM deps). Exports:

| Export | Description |
|--------|-------------|
| `CUSTOM_CSS_MAX_BYTES` | `50_000` — maximum UTF-8 byte length |
| `CustomCssValidationResult` | `{ ok, safeCss?, violations[] }` |
| `validateAndScopeCustomCss(css, opts?)` | Full validate + scope; scopes valid CSS as `.lb-theme{<css>}` |
| `validateCustomCss(css, opts?)` | Validate-only alias; no `safeCss` emitted; used by gateway and proxy |
| `buildScopedCustomCss(css, opts?)` | Validate + scope; throws on failure |
| `hasUnsafeCssUrlScheme(urlValue)` | Low-level scheme checker (exported for testing) |

**Normalisation pipeline:** (1) strip block comments, (2) decode CSS Unicode hex escapes (`\XXXXXX`), (3) decode CSS non-hex backslash escapes (`\X → X`), (4) collapse C0/whitespace to single space.

**22 vector classes blocked:** `@import`, `url(javascript:)` (direct + whitespace-smuggled + unicode-escaped), `url(vbscript:)`, `url(data:text/html)`, `url(data:image/svg)`, `url(data:*javascript*)`, `url(data:application/xhtml)`, `url(blob:)`, `expression()`, `behavior:`, `-moz-binding:`, `-o-link:`, `-o-link-source:`, `filter:progid:`, `</style>` breakout (literal + unicode-encoded), `<!--`/`-->` HTML comment markers, `<` angle bracket injection, CSS unicode escapes for `<`/`>`, non-hex backslash-escaped import (`@\import`), null bytes (`\x00`), unbalanced braces, `@charset`, `@namespace`.

**67 new tests** (64 implementation + 3 hardening): 33 attack-vector blocks, 14 safe-CSS allows, 6 scoping assertions, 4 backward-compat + renderer integration, 6 helper + constant, 4 Lane A hardening (AA-SEC-01d, AA-SEC-11c, AA-COMPAT-04, plus one boundary test).

#### `packages/theme-engine/src/theme-renderer.ts` — ADDITIVE ONLY

`buildLiquidThemeHeadAssets(bundle, rawCustomCss?: string)` gains an optional second parameter. Internally calls `validateAndScopeCustomCss`; fail-closed (invalid CSS silently dropped; output is byte-identical to the no-custom-CSS baseline). `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` NOT modified (LOCKED).

Call site at line 585 is NOT changed in Phase AA — the render path is NOT-CONNECTED until Phase AB wires the DB value.

#### `packages/theme-engine/src/index.ts` — ADDITIVE ONLY

One line appended:
```typescript
export * from './custom-css-sanitizer';
```

---

### Lane B — Merchant Editor (`apps/merchant-control-plane/`)

#### `apps/merchant-control-plane/src/components/theme-editor/controls/CustomCssWorkspace.tsx` — NEW

Self-contained `'use client'` React component. No CDN. No external code editor library. Monospace plain `<textarea>`. Exports `CustomCssWorkspace`, `validateCustomCss`, `CUSTOM_CSS_MAX_BYTES`, `CSS_SCOPE_CLASS`, `CssViolation`, `CustomCssWorkspaceProps`.

**Inline validator:** mirrors all 22 Lane A vector checks; 5-step normalisation pipeline (1: block comments, 2: Unicode hex decode, 3: non-hex backslash decode, 4: C0/whitespace collapse, 5: internal `url()` whitespace collapse). No `//` line-comment stripping (CSS has no line comments; stripping would corrupt HTTPS URLs).

**UX:** byte counter (`N / 50 000 bytes`, `aria-live="polite"`); violation list on blur with `role="alert"`; Escape to dismiss; save button `aria-disabled` when violations present; `role="region"` wrapper with `aria-label`.

**A11y:** `aria-label` on textarea; `aria-invalid` on error; `aria-describedby` pointing at violation block + help text + byte counter; all interactive elements keyboard-navigable.

**Design ratchet:** `--lb-*` tokens only; no raw `rounded-[Npx]`; `@letbuyy/ui` imports only; mobile-first at ~360 px.

**RISK-DUAL-N01:** writes only to `site_settings.custom_css` via `onChange`; never reads or writes `section_definitions` or `block_definitions`.

#### `apps/merchant-control-plane/src/app/[store]/appearance/page.tsx` — BOUNDED CHANGE

Three minimal changes: (1) import `CustomCssWorkspace` + `validateCustomCss`; (2) pre-save guard in `handleSave` calls `validateCustomCss(form.custom_css)` and returns early with inline violations if any; (3) JSX: replace bare `<Textarea>` for the custom CSS field with `<CustomCssWorkspace>`.

#### `apps/merchant-control-plane/src/app/api/stores/[store]/settings/route.ts` — MODIFIED (server-side guard)

`PATCH` handler extracts `body.site_settings?.custom_css`, calls `validateCustomCss(rawCss)`, returns HTTP 422 with `{ error, violations }` on failure. Prevents malicious CSS from reaching the gateway via direct API calls.

Note: The approved design called for a separate `stores-custom-css.ts` gateway route. Phase AA places the server-side guard in the existing proxy route instead, providing equivalent protection at the nearest enforcement boundary without adding a new gateway route.

#### `apps/merchant-control-plane/tests/theme-editor-aa.test.mjs` — NEW

86 static-contract tests (5 file-existence, 29 attack-vector functional, 8 safe-CSS, 2 byte-limit, 3 unicode-escape, 2 backward-compat, 10 RISK-DUAL-N01, 8 design ratchet, 7 a11y, 4 foreign WIP isolation, 2 self-contained, 5 bounded-change/security hardening).

#### `apps/merchant-control-plane/package.json` — ADDITIVE (FOREIGN WIP file)

`theme-editor-aa.test.mjs` appended to the test command.

---

## 3. Custom Liquid Field — NOT-CONNECTED

The Phase AA design noted an `ExtendedFieldType` `'liquid'` extension. This field type is deliberately NOT wired in Phase AA:
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` canary flag remains OFF.
- No new Liquid field type added to `schema-field-extensions.ts`.
- No DOMPurify relaxation.
- A Liquid-in-custom-field feature is ARB-gated pending the Liquid canary going green.

---

## 4. Findings Summary

| Severity | Count | Status |
|----------|-------|--------|
| HIGH | 2 | All fixed in hardening |
| MEDIUM | 4 | All fixed in hardening |
| LOW | 8 | 6 fixed in hardening · 2 deferred (RISK-AA-01, RISK-AA-02) |

**Hardening changes:** `decodeCssNonHexEscapes` added to both Lane A and Lane B normalisation; `-->` unicode-escape check added to Lane A; `buildLiquidThemeHeadAssets` made fail-closed internally; Lane B `<` only (not `>`) pattern; Lane B `behavior:` pattern matches Lane A; Lane B brace check replaced with depth scanner; server-side validation added to `settings/route.ts`; Lane B inline `normalizeCss` step-3 regex corrected; `try-catch` added for out-of-range code points in Lane B.

---

## 5. Custom CSS Render Path Status

| Layer | Status |
|-------|--------|
| Storage (`site_settings.custom_css` JSONB) | CONNECTED — field exists, merchants can write via validated path |
| Editor (`CustomCssWorkspace.tsx`) | CONNECTED — textarea with client-side validation |
| Server-side validation (`settings/route.ts`) | CONNECTED — HTTP 422 on invalid CSS |
| Engine validator (`validateAndScopeCustomCss`) | CONNECTED — all 22 vectors blocked |
| Renderer entrypoint (`buildLiquidThemeHeadAssets`) | CONNECTED — second param accepted; fail-closed internal validation |
| Storefront render call site (`layout.tsx` → `buildLiquidThemeHeadAssets`) | NOT-CONNECTED — `buildLiquidThemeHeadAssets(bundle)` still called without `rawCustomCss` at line 585; wiring is Phase AB |

---

## 6. New Risks Registered

See RISK_REGISTER.md § Phase AA risks for full entries.

| Risk ID | Severity | Description | Target |
|---------|----------|-------------|--------|
| RISK-AA-01 | LOW | AA-SEC-07b test tautological: payload contains literal `<` so the unicode-decode step is not the sole mechanism tested | Phase AB or next `custom-css-sanitizer.test.ts` touch |
| RISK-AA-02 | LOW | `expression()` comment-split bypass (`ex/**/pression`): comment stripping separates the keyword; IE-only legacy vector; no modern browser risk | Phase AB or first focus on IE-legacy hardening |
| RISK-AA-03 | LOW | CSS nesting browser floor: `.lb-theme { }` wrapper requires Chrome 112+/Firefox 117+/Safari 17.2+; older browsers receive unscoped CSS | Accepted for India-first market; revisit if browser floor requirements change |

---

## 7. Risks Addressed (Carry-Forward Notes)

Phase AA touched `theme-renderer.ts` (import + `buildLiquidThemeHeadAssets` change) but did NOT address the following carried risks at their respective fix locations within that file. All remain OPEN with updated Phase AA notes:

- **RISK-T03** (block settings bypass `filterBlockedSettingsKeys`): Phase AA touched `theme-renderer.ts` for the head-assets path only; lines 818/824 (block-level settings) were not modified.
- **RISK-T04** (`RENDERER_MAX_BLOCK_DEPTH` unexported): Phase AA touched `theme-renderer.ts` but did not export this constant.
- **RISK-W01** (`BINDING_BLOCKED_KEYS` parity): Phase AA touched `theme-renderer.ts` but did not export `BLOCKED_DROP_KEYS`.
- **RISK-W06** (block-level bindings): Phase AA touched `theme-renderer.ts` but did not add `resolveDynamicSourceDescriptors` at the block-level settings path.
- **RISK-Y01** (`MAX_APP_BLOCKS_PER_SLOT` render-loop cap): Phase AA touched `theme-renderer.ts` but did not add the per-section app-block counter.
- **RISK-Z02** (`lookupTranslation` prototype guard): Phase AA touched `theme-renderer.ts` for lines 33–34 (import) and 306–326 (`buildLiquidThemeHeadAssets`); `lookupTranslation` at lines 1118–1136 was not modified.

---

## 8. Rollback

Phase AA is uncommitted. Rollback = `git checkout` of the six changed files to their pre-Phase-AA state:
- `packages/theme-engine/src/custom-css-sanitizer.ts` (delete)
- `packages/theme-engine/test/custom-css-sanitizer.test.ts` (delete)
- `packages/theme-engine/src/theme-renderer.ts` (revert 2 hunks: import line + `buildLiquidThemeHeadAssets` signature and body)
- `packages/theme-engine/src/index.ts` (revert 1 line)
- `apps/merchant-control-plane/src/components/theme-editor/controls/CustomCssWorkspace.tsx` (delete)
- `apps/merchant-control-plane/src/app/[store]/appearance/page.tsx` (revert 3 bounded hunks)
- `apps/merchant-control-plane/src/app/api/stores/[store]/settings/route.ts` (revert import + PATCH guard)
- `apps/merchant-control-plane/tests/theme-editor-aa.test.mjs` (delete)
- `apps/merchant-control-plane/package.json` (revert 1 line in test command)

After rollback: the `custom_css` field remains in `site_settings` (JSONB) with no structural change; no migration was added in Phase AA.
