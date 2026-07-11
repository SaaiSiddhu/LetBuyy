# Phase AA — Plan: Custom CSS + Code Workspace

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AA — Custom CSS + Code Workspace
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** PLAN EXECUTED — COMPLETE

---

## 1. Objectives

1. **SAFE-CSS LAW** — establish a single-enforcement-point pure-string CSS validator (`validateAndScopeCustomCss`) that blocks all 22 known injection vector classes before any merchant custom CSS reaches the DOM.
2. **Fail-closed renderer integration** — `buildLiquidThemeHeadAssets(bundle, rawCustomCss?)` validates internally; invalid CSS is silently dropped; the call site never needs to pre-validate.
3. **Server-side enforcement** — the `PATCH /api/stores/:store/settings` proxy validates `site_settings.custom_css` before forwarding to the gateway, preventing UI bypass via direct API calls.
4. **Merchant editor** — `CustomCssWorkspace.tsx`: self-contained, no CDN, monospace textarea, client-side validation on blur + pre-save, inline per-vector error messages, byte-count indicator, a11y compliant, `--lb-*` tokens only.
5. **Bounded appearance page change** — `appearance/page.tsx`: swap bare `<Textarea>` for `CustomCssWorkspace`; add pre-save `validateCustomCss` guard that blocks network calls for unsafe CSS.
6. **DOMPurify not modified** — `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` is locked; CSS-level security is provided by the new validator at the layer below DOMPurify.

---

## 2. Entry Gates (inherited from Phase Z exit)

| Package | Required gate |
|---------|---------------|
| `theme-engine` | 1525/1525 pass |
| `merchant-control-plane` (theme-editor suite) | 533/533 pass |
| `api-gateway` | 519 pass (522 total; 3 pre-existing fail) |
| `storefront-runtime` | 795/795 pass |
| All typechecks | clean |

---

## 3. Lane A — Engine (`packages/theme-engine/`)

### 3.1 New file: `custom-css-sanitizer.ts`

**Exports:**

| Export | Type | Description |
|--------|------|-------------|
| `CUSTOM_CSS_MAX_BYTES` | `50_000` | Maximum UTF-8 byte length of raw input CSS |
| `CustomCssValidationResult` | interface | `{ ok: boolean; safeCss?: string; violations: string[] }` |
| `ValidateAndScopeOptions` | interface | `{ scopeSelector?: string; maxBytes?: number }` |
| `validateAndScopeCustomCss(css, opts?)` | function | Full validate + scope; returns `CustomCssValidationResult` |
| `validateCustomCss(css, opts?)` | function | Validate-only alias; returns `{ ok, violations }` without `safeCss` |
| `buildScopedCustomCss(css, opts?)` | function | Validate + scope, throws on failure |
| `hasUnsafeCssUrlScheme(urlValue)` | function | Low-level scheme checker (exported for testing) |

**Normalisation pipeline (strictly ordered):**
1. Strip CSS block comments (`/* … */`) — no line-comment (`//`) stripping; CSS has no line comments; stripping `//` would corrupt HTTPS URLs.
2. Decode CSS Unicode hex escapes (`\XXXXXX`) — reveals `\3c` → `<`, `\0069mport` → `import`, etc.
3. Decode CSS non-hex backslash escapes (`\X` where X is not a hex digit or newline) — reveals `@\import` → `@import`.
4. Collapse C0 control characters (U+0000–U+001F) and ASCII whitespace to single space — defeats `java\tscript:` whitespace-smuggling.

**Validation checks (in order):**
1. Byte-length check against raw UTF-8 bytes (before any processing).
2. Null-byte check on raw input (`\x00`).
3. HTML comment markers on raw lower-cased input (`<!--`, `-->`).
4. `</style>` on raw lower-cased input (breakout on raw bytes).
5. Normalise (steps 1–4 above).
6. `</style>` on normalised form (catches unicode-encoded variants).
7. `-->` on normalised form (catches `\2d\2d\3e` → `-->`).
8. `<` in normalised form (HTML injection; `>` is NOT blocked — it is a valid CSS child combinator).
9. `@-rule` blocklist: `@import`, `@charset`, `@namespace`.
10. Dangerous property/function blocklist: `expression()`, `behavior:`, `-moz-binding:`, `-o-link:`, `-o-link-source:`, `filter: progid:`.
11. `url()` scheme check: all URL values extracted via character scanner, each checked against `UNSAFE_CSS_URL_SCHEME_PREFIXES` after stripping all whitespace/control chars from the scheme.
12. Brace-balance depth scan: character-by-character; triggers violation if `depth < 0` (unbalanced close) or `depth !== 0` at end.

**Scoping:** `${scopeSelector}{${trimmed}}` (CSS nesting, defaults to `.lb-theme`).

### 3.2 Modified file: `theme-renderer.ts` (ADDITIVE ONLY)

`buildLiquidThemeHeadAssets(bundle, rawCustomCss?: string)` gains an optional second parameter. When absent or empty the output is byte-identical to the pre-Phase-AA baseline. When provided:
- Internally calls `validateAndScopeCustomCss(rawCustomCss)`.
- Fail-closed: if `!result.ok || !result.safeCss`, drops the CSS and returns only the base style.
- On success: appends `<style data-lb-custom-css="1">${result.safeCss}</style>` after the base style.

`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` is NOT modified (LOCKED).

**Call-site note:** The existing call site at line 585 (`buildLiquidThemeHeadAssets(bundle)`) is not changed in Phase AA — the render path is NOT-CONNECTED until the storefront layout is wired to supply the stored `custom_css` value.

### 3.3 Modified file: `index.ts` (ADDITIVE ONLY)

One line appended:
```typescript
// Phase AA — Custom CSS Sanitizer (Lane A): validateCustomCss / validateAndScopeCustomCss /
// buildScopedCustomCss / hasUnsafeCssUrlScheme / CUSTOM_CSS_MAX_BYTES.
export * from './custom-css-sanitizer';
```

---

## 4. Lane B — Editor (`apps/merchant-control-plane/`)

### 4.1 New file: `CustomCssWorkspace.tsx`

Self-contained `'use client'` component. No CDN. No external code editor library. Exports:

| Export | Description |
|--------|-------------|
| `CUSTOM_CSS_MAX_BYTES` | `50_000` — same constant as Lane A (inline, no import from theme-engine to avoid SSR concerns) |
| `CSS_SCOPE_CLASS` | `'lb-theme'` — the storefront container class |
| `CssViolation` | `{ vector: string; message: string }` |
| `CustomCssWorkspaceProps` | `{ value, onChange, storeName? }` |
| `validateCustomCss(css)` | Inline validator: same 22 vector checks as Lane A; returns `CssViolation[]` |
| `CustomCssWorkspace` | The React component |

**Inline validator normalisation pipeline (mirrors Lane A):**
1. Strip block comments.
2. Decode CSS Unicode hex escapes.
3. Decode CSS non-hex backslash escapes.
4. Collapse C0/whitespace to single space.
5. Collapse internal whitespace inside `url()` values.

Note: Step 2 of the Lane A pipeline (// line-comment stripping) was NOT included because CSS has no line comments and stripping `//` breaks HTTPS URLs.

**Component UX:**
- Monospace `<textarea>` with `aria-label`, `aria-invalid`, `aria-describedby`.
- Byte counter with `aria-live="polite"` showing `N / 50 000 bytes`.
- On blur: runs `validateCustomCss(value)`; shows inline violation list with `role="alert"`.
- Escape key: dismisses violations without saving.
- Save button: `aria-disabled` when violations present; calls `props.onSave?.()`.
- `role="region"` wrapper with `aria-label="Custom CSS editor"`.
- `--lb-*` tokens only; no raw `rounded-[Npx]` or hex values.
- Mobile-first at ~360 px viewport.
- Loading/empty/error states handled.

**RISK-DUAL-N01:** `onChange` emits only the CSS string. The component never reads or writes `section_definitions`, `block_definitions`, or any theme schema field.

### 4.2 Modified file: `appearance/page.tsx` (BOUNDED CHANGE)

Two changes only:
1. Import `CustomCssWorkspace` and `validateCustomCss` from `@/components/theme-editor/controls/CustomCssWorkspace`.
2. In `handleSave`: before the fetch, call `validateCustomCss(form.custom_css)`. If violations are present, set an inline error state and return early — the network call is not made.
3. Replace the bare `<Textarea>` JSX for the custom CSS section with `<CustomCssWorkspace value={form.custom_css} onChange={(css) => updateForm('custom_css', css)} />`.

Foreign WIP files (editor/page.tsx, globals.css, api-client, gateway routes, marketing-site) are NOT touched.

### 4.3 Modified file: `settings/route.ts` (SERVER-SIDE GUARD)

Note: The approved design called for a separate `stores-custom-css.ts` gateway route. Phase AA implemented server-side validation in the existing `settings/route.ts` proxy instead. This provides the same protection at the nearest enforcement boundary (the proxy layer) without adding a new gateway route.

The `PATCH` handler now:
1. Extracts `body.site_settings?.custom_css` if present and non-empty.
2. Calls `validateCustomCss(rawCss)` from `@letbuyy/theme-engine`.
3. Returns HTTP 422 with `{ error: string; violations: string[] }` if invalid.
4. Only on pass: forwards the body to the gateway via `createMerchantApiClient().stores.update()`.

---

## 5. Foreign WIP (PRESERVE — never stage)

```
apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx
services/api-gateway/src/index.ts
packages/api-client/src/index.ts
apps/merchant-control-plane/src/app/globals.css
apps/merchant-control-plane/src/components/theme-editor/ExperiencePicker.tsx
apps/merchant-control-plane/src/app/[store]/settings/localization/page.tsx
apps/marketing-site/src/**
packages/theme-engine/src/theme-registry.ts (frozen)
LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG object (LOCKED — zero property changes)
```

---

## 6. Custom Liquid Field — NOT-CONNECTED

The Phase AA design scope noted an `ExtendedFieldType` `'liquid'` extension. This field type is deliberately NOT wired in Phase AA:
- The Liquid canary flag `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` remains OFF.
- No new Liquid field type is added to `schema-field-extensions.ts` or `theme-registry.ts`.
- No DOMPurify relaxation occurs.
- Any Liquid-in-custom-field feature requires a separate ARB-gated phase when the Liquid canary is green.

---

## 7. Risk Carry-Forward

Phase AA is scoped to the CSS sanitizer, the CustomCssWorkspace editor, and server-side enforcement. The following risks from prior phases remain OPEN because Phase AA's file scope does not intersect their fix locations:

- RISK-T01, RISK-T02 (bundle parser depth/prototype) — `parseLiquidThemePackageBundle` not touched.
- RISK-T05 (`allowedChildTypes` dead wiring) — `SectionTreePanel.tsx` not touched.
- RISK-T06 (`UnsupportedThemeDocumentFeatureError` dead) — `theme-document.ts` not touched.
- RISK-W01 (`BINDING_BLOCKED_KEYS` parity) — `dynamic-source-binding.ts` not touched.
- RISK-W03, RISK-W04, RISK-W05, RISK-W06 (source binding + UX gaps) — respective files not touched.
- RISK-Y01 (render-loop slot count cap) — `theme-renderer.ts` touched for `buildLiquidThemeHeadAssets` only; block-loop counter not added.
- RISK-Z01 (`buildCandidates('en')` inversion) — `theme-locale.ts` not touched.
- RISK-Z02 (`lookupTranslation` prototype guard) — `theme-renderer.ts` touched for head-assets only; `lookupTranslation` at lines 1118–1136 not modified.
- RISK-Z03, RISK-Z04, RISK-Z05, RISK-Z06 (translation proxy gaps) — translation proxy files not touched.
- RISK-SEC-U01, RISK-SEC-U02, RISK-SEC-U03, RISK-A11Y-U01, RISK-A11Y-U02, RISK-STYLE-U01, RISK-STYLE-U02 — `schema-field-extensions.ts`, `SchemaFormRenderer.tsx`, and affected control files not touched.
