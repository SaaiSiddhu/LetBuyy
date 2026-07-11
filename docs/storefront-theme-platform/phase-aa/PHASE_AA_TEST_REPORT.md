# Phase AA — Test Report: Custom CSS + Code Workspace

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AA — Custom CSS + Code Workspace
**Date:** 2026-07-11
**Status:** ALL PASS

---

## 1. Lane A — `packages/theme-engine/`

**Command:** `pnpm --filter=@letbuyy/theme-engine typecheck test`
**Result:** PASS
**Typecheck:** 0 errors
**Tests:** 1592 total (1525 baseline + 64 implementation + 3 hardening) · 1592 pass · 0 fail · 0 skip
**All prior tests green.**

---

### 1.1 New Tests — `test/custom-css-sanitizer.test.ts`

#### Group 1 — Attack vector blocks (tests must fail if the named guard is removed)

| Test ID | Vector | Guard |
|---------|--------|-------|
| AA-SEC-01a | `@import url()` | `/@import\b/i` on normalised string |
| AA-SEC-01b | `@import` string form | Same |
| AA-SEC-01c | `@import` via CSS Unicode escape (`\006i` → `i`) | `decodeCssUnicodeEscapes` + `/@import\b/i` |
| AA-SEC-01d | `@import` via non-hex backslash escape (`@\import`) | `decodeCssNonHexEscapes` + `/@import\b/i` |
| AA-SEC-02a | `url(javascript:)` direct | `extractUrlValues` + `hasUnsafeCssUrlScheme` |
| AA-SEC-02b | `url(javascript:)` quoted form | Same |
| AA-SEC-02c | `url(java\tscript:)` whitespace-smuggled | `collapseControlAndWhitespace` + `hasUnsafeCssUrlScheme` stripping |
| AA-SEC-02d | `url(java\nscript:)` newline-smuggled | Same |
| AA-SEC-03a | `expression()` | `/\bexpression\s*\(/i` |
| AA-SEC-03b | `EXPRESSION()` case variant | Case-insensitive flag |
| AA-SEC-04a | `behavior:` (with and without `url`) | `/\bbehavior\s*:/i` |
| AA-SEC-05a | `-moz-binding:` | `/-moz-binding\s*:/i` |
| AA-SEC-06a | `url(data:image/svg+xml)` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'data:image/svg'` |
| AA-SEC-06b | `url(data:image/svg+xml)` quoted | Same |
| AA-SEC-07a | `</style>` literal | `rawLower.includes('</style')` |
| AA-SEC-07b | `</style>` via CSS Unicode escape | `decodeCssUnicodeEscapes` + `normalized.includes('<')` (see RISK-AA-01 for isolation gap) |
| AA-SEC-08 | Oversize input (`> CUSTOM_CSS_MAX_BYTES` bytes) | `Buffer.byteLength(css,'utf8') > maxBytes` |
| AA-SEC-08b | Input exactly at limit passes | Same check (boundary) |
| AA-SEC-09a | `@charset` | `/@charset\b/i` |
| AA-SEC-10a | `@namespace` | `/@namespace\b/i` |
| AA-SEC-11a | `<!--` HTML comment | `rawLower.includes('<!--')` |
| AA-SEC-11b | `-->` HTML comment literal | `rawLower.includes('-->')` |
| AA-SEC-11c | `-->` via CSS Unicode escape (`\2d\2d\3e`) | `decodeCssUnicodeEscapes` + `normalized.includes('-->')` |
| AA-SEC-12a | `url(vbscript:)` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'vbscript:'` |
| AA-SEC-13a | `url(blob:)` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'blob:'` |
| AA-SEC-14a | `url(data:text/html)` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'data:text/html'` |
| AA-SEC-15a | `url(data:text/javascript)` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'data:text/javascript'` |
| AA-SEC-16a | `url(data:application/javascript)` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'data:application/javascript'` |
| AA-SEC-17a | Unbalanced `}` (depth goes negative) | Depth scanner `depth < 0` |
| AA-SEC-17b | Unmatched `{` (unclosed block) | Depth scanner `depth !== 0` at end |
| AA-SEC-18a | Null byte (`\x00`) | `css.includes('\x00')` before normalisation |
| AA-SEC-19a | `-o-link:` | `/-o-link\s*:/i` |
| AA-SEC-20a | `filter: progid:DXImageTransform.*` | `/filter\s*:\s*progid\s*:/i` |
| AA-SEC-21a | `<` angle bracket in CSS | `normalized.includes('<')` after unicode decode |
| AA-SEC-21b | `\3c` unicode-escaped `<` | `decodeCssUnicodeEscapes` + `normalized.includes('<')` |

#### Group 2 — Safe CSS allowed (must NOT be falsely rejected)

| Test ID | Input | Reason |
|---------|-------|--------|
| AA-SAFE-01 | `.x { color: red; font-size: 1rem; }` | Basic rule |
| AA-SAFE-02 | `.x { --my-color: #ff0000; }` | CSS custom property |
| AA-SAFE-03 | `@media (max-width: 768px) { .x { display: none; } }` | Media query |
| AA-SAFE-04 | `[data-theme="dark"] .x { color: white; }` | Attribute selector |
| AA-SAFE-05 | `.x { display: flex; gap: 1rem; }` | Flexbox layout |
| AA-SAFE-06 | `.x { background: url('https://cdn.example.com/img.png') }` | HTTPS image URL |
| AA-SAFE-07 | `/* brand colours */ .x { color: red; }` | Block comment (stripped, safe) |
| AA-SAFE-08 | `` | Empty string (backward-compat) |
| AA-SAFE-09 | `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }` | Keyframes |
| AA-SAFE-10 | `@supports (display: grid) { .x { display: grid; } }` | Supports at-rule |
| AA-SAFE-11 | `.hero > h1 + p { color: red; }` | `>` child combinator (NOT blocked) |
| AA-SAFE-12 | Multiple rules in sequence | Valid multi-block CSS |
| AA-SAFE-13 | Custom property with url-like value name | `--my-image-url: none;` |
| AA-SAFE-14 | Grid layout with named areas | `grid-template-areas: 'header'` |

#### Group 3 — Scoping assertions

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| AA-SCOPE-01 | Basic selector wrapped in `.lb-theme` | `safeCss === '.lb-theme{.x{color:red}}'` |
| AA-SCOPE-02 | `@media` nested inside `.lb-theme` | `safeCss.startsWith('.lb-theme{')` and contains `@media` |
| AA-SCOPE-03 | `@keyframes` preserved and wrapped | `safeCss.includes('@keyframes')` |
| AA-SCOPE-04 | Custom scopeSelector option | `validateAndScopeCustomCss(css, { scopeSelector: '.store-root' })` wraps with `.store-root{…}` |
| AA-SCOPE-05 | Custom maxBytes option | Raises limit; input at default limit passes with custom higher limit |
| AA-SCOPE-06 | `safeCss` is absent when `ok: false` | `result.safeCss === undefined` for any blocked input |

#### Group 4 — Backward-compat and renderer integration

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| AA-COMPAT-01 | Empty CSS → `{ ok: true, violations: [] }` no `safeCss` | Backward-compatible no-op |
| AA-COMPAT-02 | Whitespace-only CSS → same as empty | `'   '.trim() === ''` early return |
| AA-COMPAT-03 | `buildLiquidThemeHeadAssets(bundle)` (no customCss) → byte-identical to baseline | No second `<style>` tag emitted |
| AA-COMPAT-04 | `buildLiquidThemeHeadAssets(bundle, '@import url(evil.css)')` → drops custom style | Output equals no-custom-CSS baseline (fail-closed) |

#### Group 5 — Helper and constant tests

| Test ID | Description |
|---------|-------------|
| AA-HELPER-01 | `hasUnsafeCssUrlScheme('javascript:alert(1)')` returns `true` |
| AA-HELPER-02 | `hasUnsafeCssUrlScheme('https://example.com/img.png')` returns `false` |
| AA-HELPER-03 | `hasUnsafeCssUrlScheme('java\t script:alert')` (whitespace-stripped) returns `true` |
| AA-HELPER-04 | `hasUnsafeCssUrlScheme('blob:https://x.com/uuid')` returns `true` |
| AA-CONST-01 | `CUSTOM_CSS_MAX_BYTES === 50_000` |
| AA-CONST-02 | `validateCustomCss` is a function |

---

## 2. Lane B — `apps/merchant-control-plane/`

**Command (inside merchant-control-plane):** `node --test tests/…theme-editor-aa.test.mjs` (plus all prior theme-editor test files)
**Result:** PASS
**Typecheck:** `pnpm typecheck --filter=@letbuyy/merchant-control-plane` — 8 tasks successful, 0 TS errors
**Tests:** 619 total (533 baseline + 81 implementation + 5 hardening) · 619 pass · 0 fail · 0 skip

---

### 2.1 New Tests — `tests/theme-editor-aa.test.mjs` (86 tests total)

#### FILE EXISTENCE (tests 1–5)

| Test | Description |
|------|-------------|
| 1 | `CustomCssWorkspace.tsx` exists |
| 2 | `appearance/page.tsx` exists |
| 3 | `settings/route.ts` exists |
| 4 | `theme-editor-aa.test.mjs` exists |
| 5 | `package.json` includes `theme-editor-aa.test.mjs` in test command |

#### ATTACK VECTORS — functional (tests 6–34)

One test per injection vector, run through the inline `validateCustomCss` function implemented in the test file:

| Test # | Vector | Expected outcome |
|--------|--------|-----------------|
| 6 | `@import url()` | `violations.length > 0` |
| 7 | `@import` string form | `violations.length > 0` |
| 8 | `@import` unicode-escape | `violations.length > 0` |
| 9 | `@import` non-hex backslash | `violations.length > 0` |
| 10 | `url(javascript:)` direct | `violations.length > 0` |
| 11 | `url(javascript:)` whitespace-smuggled (`java\tscript:`) | `violations.length > 0` |
| 12 | `url(javascript:)` CSS unicode-escape smuggling | `violations.length > 0` |
| 13 | `url(vbscript:)` | `violations.length > 0` |
| 14 | `url(data:text/html)` | `violations.length > 0` |
| 15 | `url(data:image/svg+xml)` | `violations.length > 0` |
| 16 | `url(data:application/javascript)` | `violations.length > 0` |
| 17 | `url(data:text/javascript)` | `violations.length > 0` |
| 18 | `url(blob:)` | `violations.length > 0` |
| 19 | `expression()` | `violations.length > 0` |
| 20 | `behavior:` | `violations.length > 0` |
| 21 | `-moz-binding:` | `violations.length > 0` |
| 22 | `-o-link:` | `violations.length > 0` |
| 23 | `-o-link-source:` | `violations.length > 0` |
| 24 | `</style>` literal | `violations.length > 0` |
| 25 | `</style>` unicode-escaped | `violations.length > 0` |
| 26 | `<` in CSS | `violations.length > 0` |
| 27 | `>` in isolation (NOT blocked) | `violations.length === 0` (safe CSS assertion) |
| 28 | `@charset` | `violations.length > 0` |
| 29 | `@namespace` | `violations.length > 0` |
| 30 | `<!--` HTML comment | `violations.length > 0` |
| 31 | `-->` HTML comment literal | `violations.length > 0` |
| 32 | `filter:progid:` | `violations.length > 0` |
| 33 | Admin-targeting selectors (`body`, `html`, `:root`, `[data-letbuyy-admin]`, `.merchant-control-plane`) | `violations.length > 0` (5 sub-tests) |
| 34 | Null byte | `violations.length > 0` |
| 35 | Unbalanced `}` (depth-negative, equal open+close count) | `violations.length > 0` |

#### SAFE CSS — not falsely rejected (tests 36–43)

| Test # | Input |
|--------|-------|
| 36 | Basic selector |
| 37 | Custom property |
| 38 | `@media` query |
| 39 | `data-*` attribute selector |
| 40 | Flexbox / grid |
| 41 | `url(https://…)` image |
| 42 | Block comment (stripped) |
| 43 | `.parent > .child { }` (`>` combinator allowed) |

#### BYTE LIMIT (tests 44–45)

| Test # | Description |
|--------|-------------|
| 44 | CSS under 50 000 bytes → accepted |
| 45 | CSS over 50 000 bytes → `violations.length > 0` with size-limit message |

#### UNICODE-ESCAPE BYPASS (tests 46–48)

| Test # | Input |
|--------|-------|
| 46 | `\003C` (< encoded) in CSS text → blocked |
| 47 | `\003E` (> encoded) in CSS text → `>` is safe combinator; NOT blocked |
| 48 | `/* url(javascript:...) */` — comment stripping removes the attack; clean CSS passes |

#### BACKWARD COMPAT (tests 49–50)

| Test # | Description |
|--------|-------------|
| 49 | Empty value → 0 violations |
| 50 | Whitespace-only → 0 violations |

#### RISK-DUAL-N01 (tests 51–60)

| Test # | Description |
|--------|-------------|
| 51–55 | `CustomCssWorkspace.tsx` source: no reference to `section_definitions`, no import from `editor/page.tsx`, no import from `ExperiencePicker.tsx` |
| 56–60 | `appearance/page.tsx` source: `custom_css` change targets `site_settings` not `section_definitions`; `updateForm('custom_css', css)` pattern confirmed |

#### DESIGN RATCHET (tests 61–68)

| Test # | Description |
|--------|-------------|
| 61–62 | `CustomCssWorkspace.tsx` imports from `@letbuyy/ui` (not external CDN) |
| 63–64 | No `rounded-[Npx]` Tailwind class in `CustomCssWorkspace.tsx` |
| 65–66 | `--lb-*` token usage present in `CustomCssWorkspace.tsx` |
| 67–68 | No raw hex color codes in `CustomCssWorkspace.tsx` |

#### A11Y (tests 69–75)

| Test # | Attribute / contract |
|--------|---------------------|
| 69 | `aria-label` on textarea |
| 70 | `aria-invalid` on validation error |
| 71 | `role="alert"` on violations block |
| 72 | `aria-describedby` pointing to violations block |
| 73 | Escape key handling present |
| 74 | `role="status"` on success/saving messages |
| 75 | `aria-live` on byte counter |

#### FOREIGN WIP ISOLATION (tests 76–79)

| Test # | Description |
|--------|-------------|
| 76 | `CustomCssWorkspace.tsx` does not import from `editor/page.tsx` |
| 77 | `CustomCssWorkspace.tsx` does not import from `globals.css` |
| 78 | `CustomCssWorkspace.tsx` does not import from `ExperiencePicker.tsx` |
| 79 | `CustomCssWorkspace.tsx` has no reference to `section_definitions` |

#### SELF-CONTAINED (tests 80–81)

| Test # | Description |
|--------|-------------|
| 80 | No CodeMirror / Monaco / Prism import in `CustomCssWorkspace.tsx` |
| 81 | No external CDN script URL in `CustomCssWorkspace.tsx` |

#### BOUNDED CHANGE / SECURITY (tests 82–86, added in hardening)

| Test # | Description |
|--------|-------------|
| 82 | `appearance/page.tsx` imports `CustomCssWorkspace` (not bare `Textarea` for custom_css) |
| 83 | `appearance/page.tsx` imports `validateCustomCss` |
| 84 | `settings/route.ts` imports `validateCustomCss` from `@letbuyy/theme-engine` |
| 85 | `settings/route.ts` PATCH handler references `validateCustomCss` call |
| 86 | `settings/route.ts` returns 422 on validation failure |

---

## 3. Cumulative Test Gates

| Baseline | New Phase AA tests | Hardening | Total |
|----------|-------------------|-----------|-------|
| theme-engine: 1525 | +64 | +3 | **1592** |
| merchant theme-editor suite: 533 | +81 | +5 | **619** |
| api-gateway: 519 pass | 0 | 0 | **519 pass** |
| storefront-runtime: 795 | 0 | 0 | **795** |

**Gate entering Phase AB:**
- theme-engine: **1592/1592**
- merchant theme-editor suite: **619/619**
- api-gateway: **519 pass** (522 total; 3 pre-existing failures unchanged)
- storefront-runtime: **795/795**
- All typechecks: **clean**
- `validate-governance.mjs`: EXIT=1 (pre-existing tenant drift; anti-fabrication PASS — unchanged)
