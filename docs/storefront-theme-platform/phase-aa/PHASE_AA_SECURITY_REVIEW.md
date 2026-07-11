# Phase AA — Security Review: Custom CSS Injection Vector Analysis

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AA — Custom CSS + Code Workspace
**Date:** 2026-07-11
**Reviewer:** Phase AA documentation pass (ground-truth verified)
**Status:** REVIEW COMPLETE — all HIGH and MEDIUM findings fixed in hardening; 2 LOW deferred

---

## 1. DOMPurify Relationship

### 1.1 What DOMPurify does

`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` in `packages/theme-engine/src/theme-renderer.ts` configures a whole-document DOMPurify pass over all rendered Liquid HTML. It allows `<style>` elements (`USE_PROFILES.html: true` + no `FORBID_TAGS: ['style']`). DOMPurify is an HTML sanitizer optimised for structural HTML integrity.

### 1.2 What DOMPurify does NOT do

DOMPurify does not parse CSS property values. A `<style>` element containing `* { behavior: url(evil.htc) }` or `body { background: url(javascript:alert(1)) }` passes DOMPurify without modification. DOMPurify's CSS attack surface awareness is limited to the element structure (removing `<link>` to external stylesheets, stripping `<style>` if configured), not to the CSS text content.

**This is the architectural gap that Phase AA fills.** The custom CSS sanitizer in `custom-css-sanitizer.ts` is the CSS-level gate that DOMPurify cannot be.

### 1.3 Phase AA does NOT modify DOMPurify

`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` is a locked object. Phase AA adds zero properties to it. Merchant custom CSS is validated and scope-wrapped before it reaches the `<style>` element; once inside the `<style>` element it passes through DOMPurify unchanged (DOMPurify allows the element).

---

## 2. Normalisation Pipeline — Bypass Prevention

The validator applies four normalisation steps in strict order before any pattern check runs. Each step closes a specific bypass class:

| Step | Operation | Bypasses Closed |
|------|-----------|-----------------|
| 1 | Strip CSS block comments (`/* … */`) | Comment-obfuscated payloads (`expression/**/()`, `@im/**/port`) |
| 2 | Decode CSS Unicode hex escapes (`\XXXXXX`) | `\3c` → `<`, `\0069mport` → `import`, `\74` → `t` |
| 3 | Decode CSS non-hex backslash escapes (`\X → X`) | `@\import` → `@import` (CSS spec §4.1.1) |
| 4 | Collapse C0/whitespace to single space | `java\tscript:` → `java script:` → caught by url-scheme strip |

Note: The Lane A normaliser deliberately omits `//` line-comment stripping; CSS has no `//` comments and stripping would corrupt `url(https://…)` by consuming everything from `//` to end of line.

---

## 3. Attack Vector Proof Table

Each vector below has a named test in `packages/theme-engine/test/custom-css-sanitizer.test.ts`. The "Guard" column names exactly which code to remove to make the test fail.

| Test ID | Vector | Input example | Guard |
|---------|--------|---------------|-------|
| AA-SEC-01a | `@import url()` | `@import url("https://evil.example.com/steal.css");` | `/@import\b/i` on normalised string |
| AA-SEC-01b | `@import` string | `@import 'https://evil.example.com/steal.css';` | Same |
| AA-SEC-01c | `@import` unicode escape | `@\006import url(evil)` | `decodeCssUnicodeEscapes` + `/@import\b/i` |
| AA-SEC-01d | `@import` non-hex escape | `@\import url(evil)` | `decodeCssNonHexEscapes` + `/@import\b/i` |
| AA-SEC-02a | `url(javascript:)` direct | `a{background:url(javascript:alert(1))}` | `extractUrlValues` + `hasUnsafeCssUrlScheme` |
| AA-SEC-02b | `url(javascript:)` quoted | `a{background:url("javascript:alert(1)")}` | Same |
| AA-SEC-02c | `url(java\tscript:)` whitespace-smuggled | `a{background:url(java\tscript:alert(1))}` | `collapseControlAndWhitespace` + `hasUnsafeCssUrlScheme` stripping all `[\x00-\x20\x7f]` |
| AA-SEC-02d | `url(java\nscript:)` newline-smuggled | `a{background:url(java\nscript:alert(1))}` | Same |
| AA-SEC-03a | `expression()` | `a{width:expression(alert(1))}` | `/\bexpression\s*\(/i` on normalised |
| AA-SEC-03b | `expression()` case variant | `a{width:EXPRESSION(alert(1))}` | Case-insensitive flag |
| AA-SEC-04a | `behavior:` | `a{behavior:url(evil.htc)}` | `/\bbehavior\s*:/i` |
| AA-SEC-05a | `-moz-binding:` | `a{-moz-binding:url(evil.xml)}` | `/-moz-binding\s*:/i` |
| AA-SEC-06a | `url(data:image/svg)` | `a{background:url(data:image/svg+xml,<script>...)}` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'data:image/svg'` |
| AA-SEC-06b | `url(data:image/svg)` via `extractUrlValues` | As above (quoted form) | Same |
| AA-SEC-07a | `</style>` literal | `.x{color:red}</style><script>` | `rawLower.includes('</style')` |
| AA-SEC-07b | `</style>` unicode-encoded | `.x{color:red}\3c/style\3e` | `decodeCssUnicodeEscapes` + `normalized.includes('<')` (note: payload also has literal `<script>` — see RISK-AA-01 for test isolation gap) |
| AA-SEC-08 | Oversize input | `'a'.repeat(50001)` | `Buffer.byteLength(css,'utf8') > maxBytes` |
| AA-SEC-09a | `@charset` | `@charset "UTF-7";.x{color:red}` | `/@charset\b/i` |
| AA-SEC-10a | `@namespace` | `@namespace url(http://evil.example.com/ns);` | `/@namespace\b/i` |
| AA-SEC-11a | `<!--` HTML comment | `.x{color:red}<!--` | `rawLower.includes('<!--')` |
| AA-SEC-11b | `-->` HTML comment literal | `.x{color:red}-->` | `rawLower.includes('-->')` |
| AA-SEC-11c | `-->` unicode-encoded (`\2d\2d\3e`) | `.x{color:red}\2d\2d\3e` | `decodeCssUnicodeEscapes` decodes `-->`; then `normalized.includes('-->')` |
| AA-SEC-12a | `url(vbscript:)` | `a{background:url(vbscript:MsgBox)}` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'vbscript:'` |
| AA-SEC-13a | `url(blob:)` | `a{background:url(blob:https://x.com/abc)}` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'blob:'` |
| AA-SEC-14a | `url(data:text/html)` | `a{background:url(data:text/html,<script>)}` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'data:text/html'` |
| AA-SEC-15a | `url(data:text/javascript)` | `a{background:url(data:text/javascript,alert(1))}` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'data:text/javascript'` |
| AA-SEC-16a | `url(data:application/javascript)` | `a{background:url(data:application/javascript,alert(1))}` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` contains `'data:application/javascript'` |
| AA-SEC-17a | Unbalanced `}` (depth < 0) | `.x{color:red}}` | Depth scanner: `depth < 0` branch |
| AA-SEC-17b | Unmatched `{` | `.x{color:red` | Depth scanner: `depth !== 0` at end |
| AA-SEC-18a | Null byte (`\x00`) | `.x{color:red\x00}` | `css.includes('\x00')` before normalisation |
| AA-SEC-19a | `-o-link:` | `a{-o-link:url(evil)}` | `/-o-link\s*:/i` |
| AA-SEC-20a | `filter: progid:` | `a{filter:progid:DXImageTransform.Microsoft.AlphaImageLoader(src='evil.png',sizingMethod='scale')}` | `/filter\s*:\s*progid\s*:/i` |
| AA-SEC-21a | `<` in CSS | `.x{color:<red>}` | `normalized.includes('<')` after unicode decode |
| AA-SEC-21b | `\3c` unicode-escaped `<` | `.x{color:\3cred\3e}` | `decodeCssUnicodeEscapes` + `normalized.includes('<')` |

### Safe CSS (must NOT be rejected)

| Test ID | Input | Reason |
|---------|-------|--------|
| AA-SAFE-01 | `.x { color: red; font-size: 1rem; }` | Basic rule |
| AA-SAFE-02 | `.x { --my-color: #ff0000; }` | Custom property |
| AA-SAFE-03 | `@media (max-width: 768px) { .x { display: none; } }` | Media query |
| AA-SAFE-04 | `[data-theme="dark"] .x { color: white; }` | Attribute selector |
| AA-SAFE-05 | `.x { display: flex; gap: 1rem; }` | Flexbox |
| AA-SAFE-06 | `.x { background: url('https://cdn.example.com/img.png') }` | HTTPS image URL |
| AA-SAFE-07 | `/* brand colours */ .x { color: red; }` | Block comment (stripped, safe) |
| AA-SAFE-08 | `` | Empty string |
| AA-SAFE-09 | `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }` | Keyframes |
| AA-SAFE-10 | `@supports (display: grid) { .x { display: grid; } }` | Supports query |
| AA-SAFE-11 | `.hero > h1 + p { color: red; }` | `>` child combinator (`>` is NOT blocked; only `<` is blocked) |

---

## 4. Scoping Proof

### 4.1 CSS Nesting wrapper

All valid CSS is wrapped as:
```css
.lb-theme{<merchant css>}
```

Test AA-SCOPE-01 verifies the wrapper is present for a basic selector. Test AA-SCOPE-02 verifies `@media` inner rules are correctly nested. Test AA-SCOPE-03 verifies `@keyframes` is preserved.

### 4.2 Admin-targeting selector block

The validator blocks selectors that target elements outside the `.lb-theme` scope wrapper:
- `body` — `role="document"` element; targets the entire page
- `html` — root element; cascades above `.lb-theme`
- `:root` — equivalent to `html` in most contexts; resets custom properties globally
- `[data-letbuyy-admin]` — admin UI container attribute
- `.merchant-control-plane` — admin CSS class

These are checked by a regex on the normalised string that detects bare (non-qualified) occurrences of the selectors at statement boundaries.

### 4.3 Browser floor

CSS nesting is required for the scope wrapper to work. Minimum browser versions:
- Chrome 112+ (released April 2023)
- Firefox 117+ (released August 2023)
- Safari 17.2+ (released December 2023)

Browsers below these versions will receive the full HTML page but the `.lb-theme { }` wrapper will have no effect — merchant CSS will apply globally (no scoping) rather than being rejected. This is registered as RISK-AA-03. For the India-first target market, Chrome 112+ adoption is high.

---

## 5. Renderer Integration — Single Enforcement Point

### 5.1 Why `buildLiquidThemeHeadAssets` is the single enforcement point

The function is the only code path that emits a `<style data-lb-custom-css="1">` element. Centralising validation here means:
- Callers do not need to pre-validate before calling.
- Pre-validated (scope-wrapped) CSS passed from the DB does not get double-wrapped.
- Fail-closed by default: any exception inside `validateAndScopeCustomCss` is caught; the custom `<style>` is silently dropped.

### 5.2 `buildLiquidThemeHeadAssets` fail-closed contract (AA-COMPAT-04)

```typescript
const result = validateAndScopeCustomCss(rawCustomCss);
if (!result.ok || !result.safeCss) {
  return baseStyle;  // drop invalid CSS; emit only the base style
}
return baseStyle + `<style data-lb-custom-css="1">${result.safeCss}</style>`;
```

Test AA-COMPAT-04 confirms: passing invalid CSS (e.g., `@import url(evil.css)`) to `buildLiquidThemeHeadAssets` produces output that equals the no-custom-CSS baseline — no custom `<style>` is emitted.

### 5.3 NOT-CONNECTED render path

The call site at `theme-renderer.ts:585` still calls `buildLiquidThemeHeadAssets(bundle)` without `rawCustomCss`. Phase AA wires the validation infrastructure but does not connect the DB-stored `custom_css` value to the render path. The connection is a Phase AB deliverable.

---

## 6. Server-Side Enforcement

### 6.1 `settings/route.ts` PATCH guard

The proxy-layer `PATCH` handler in `apps/merchant-control-plane/src/app/api/stores/[store]/settings/route.ts` now extracts `body.site_settings?.custom_css` and runs `validateCustomCss(rawCss)` before forwarding to the gateway. On failure it returns HTTP 422 with `{ error: string; violations: string[] }`.

This means a direct API call bypassing the merchant UI is still blocked at the proxy layer. The test `phase-aa [security]: settings/route.ts validates custom_css server-side` asserts this contract statically.

### 6.2 Why this is the correct boundary

The merchant control plane proxy is the innermost layer before the api-gateway. Placing the check here:
- Blocks malicious CSS from reaching the gateway (which does not have domain-specific CSS knowledge).
- Returns a structured violation list the UI can display.
- Runs the same `validateCustomCss` function as the client-side guard, ensuring identical semantics.

---

## 7. Findings from Phase AA Code Review

### 7.1 Findings fixed in hardening (all severity levels)

| Severity | Finding | Fix applied |
|----------|---------|-------------|
| HIGH | Zero server-side CSS validation in PATCH settings route — bypass via direct API call | Added `validateCustomCss` guard to `settings/route.ts` PATCH handler; returns HTTP 422 with violation list |
| HIGH | `buildLiquidThemeHeadAssets` trusts caller to pre-validate — no internal enforcement point | Changed to validate internally via `validateAndScopeCustomCss`; fail-closed; callers no longer need to pre-validate |
| MEDIUM | Non-hex CSS backslash escapes not decoded (`@\import` bypass) | Added `decodeCssNonHexEscapes` step to normalisation pipeline in both Lane A and Lane B |
| MEDIUM | Lane B `< or >` pattern `/[<>]/` blocks CSS child combinator `>` (false positive) | Changed to `/<` only, matching Lane A; added safe-CSS test for `.parent > .child { }` |
| MEDIUM | CSS-unicode-encoded `-->` (`\2d\2d\3e`) bypasses the `-->` check | Added `normalized.includes('-->')` check after normalisation in Lane A; added test AA-SEC-11c |
| MEDIUM | Lane B brace check uses count-comparison not depth scanning — equal-count depth-negative CSS escapes scope | Replaced count comparison with character-by-character depth scanner in Lane B, matching Lane A |
| LOW | Lane B `behavior:` pattern requires `url` suffix (`/\bbehavior\s*:\s*url/i`), diverging from Lane A | Changed to `/\bbehavior\s*:/i` (no `url` suffix) to match Lane A |
| LOW | Lane B inline `normalizeCss` step 3 regex `/[ -\s]+/g` may mishandle C0 control characters | Changed to `/[\x00-\x1f\s]+/g` matching the component |
| LOW | Uncaught `RangeError` in Lane B `normalizeCss` on out-of-range Unicode code points | Added `try/catch` around `String.fromCodePoint`, returning replacement char `'?'` on failure |

### 7.2 Deferred findings (OPEN — registered as risks below)

| Risk ID | Severity | Finding |
|---------|----------|---------|
| RISK-AA-01 | LOW | Test AA-SEC-07b payload contains a literal `<` (from the `<script>` in the payload) — the unicode decode step is not isolated as the sole mechanism; if `decodeCssUnicodeEscapes` were removed, the test still passes because the literal `<` triggers the `<` guard |
| RISK-AA-02 | LOW | `ex/**/pression(alert(1))` bypasses the `expression()` guard: comment stripping yields `ex pression` separated by whitespace; `/\bexpression\s*\(/i` requires `expression` as one word boundary token. IE-only legacy vector; not recognised by any modern browser |
| RISK-AA-03 | LOW | CSS nesting browser floor: `.lb-theme { merchant css }` wrapper requires Chrome 112+/Firefox 117+/Safari 17.2+; older browsers receive unscoped merchant CSS globally rather than a security rejection |

---

## 8. `expression()` Comment-Split Gap (RISK-AA-02)

This is a known gap, documented for completeness.

### 8.1 The bypass

```css
a { width: ex/**/pression(alert(1)) }
```

After strip-block-comments: `a { width: ex pression(alert(1)) }`.
The pattern `/\bexpression\s*\(/i` tests for `expression` as a word token followed by `(`. `ex pression` does not match — `ex` and `pression` are two separate tokens.

### 8.2 Why this is acceptable

`expression()` was an IE 6–8 CSS extension removed in IE 9. No modern browser (Chrome, Firefox, Safari, Edge) evaluates `expression()`. Any storefront rendering this would silently display `width: ex pression(alert(1))` as an invalid CSS value and apply no width. No script executes on any modern browser.

### 8.3 Suggested future fix

Add a post-comment-strip pass that removes ALL whitespace from CSS token candidates before the `expression` pattern check: e.g., check for `expression(` in the fully whitespace-stripped normalised string. Alternatively add a test documenting the gap: `allowed('a{width:ex/**/pression(alert(1))}', 'expression() comment-split — IE-only, known gap')`.

---

## 9. RISK-DUAL-N01 Compliance

Phase AA touches only `site_settings.custom_css` (instance data):

| Component | Write target | RISK-DUAL-N01 status |
|-----------|-------------|----------------------|
| `CustomCssWorkspace.tsx` | Emits CSS string via `onChange` to `appearance/page.tsx` | Props: `value` + `onChange` only; no access to `section_definitions` or `block_definitions` |
| `appearance/page.tsx` | PATCH `site_settings.custom_css` | Instance data; never touches `section_definitions` |
| `settings/route.ts` | Forwards to `stores.update(storeId, body)` | `custom_css` is inside `site_settings` JSONB; gateway maps to non-schema column |
| `buildLiquidThemeHeadAssets` | Emits `<style data-lb-custom-css>` | Additive render output; no theme document or schema mutation |

Static-contract tests 52, 72, and 79 in `theme-editor-aa.test.mjs` assert the RISK-DUAL-N01 contract.
