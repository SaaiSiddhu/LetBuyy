# Phase AA — Discovery: Custom CSS + Code Workspace

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AA — Custom CSS + Code Workspace
**Date:** 2026-07-11
**Branch:** `stepup/main`
**Status:** DISCOVERY COMPLETE

---

## 1. Scope

Phase AA delivers a validated merchant custom-CSS editor. Two lanes:

| Lane | Owner | Files |
|------|-------|-------|
| A — Engine (Lane A) | `packages/theme-engine/` | `custom-css-sanitizer.ts` (NEW), `test/custom-css-sanitizer.test.ts` (NEW), `theme-renderer.ts` (ADDITIVE), `index.ts` (ADDITIVE) |
| B — Editor (Lane B) | `apps/merchant-control-plane/` | `CustomCssWorkspace.tsx` (NEW), `appearance/page.tsx` (BOUNDED), `settings/route.ts` (MODIFIED), `tests/theme-editor-aa.test.mjs` (NEW), `package.json` (ADDITIVE) |

---

## 2. Existing Custom CSS Surface (Pre-Phase AA)

### 2.1 Where `custom_css` lives in the schema

The field `custom_css` exists in `sites.site_settings` (a JSONB column). It is stored when the merchant saves via `PATCH /api/stores/:store/settings` (proxied through the merchant Next.js layer to the api-gateway).

### 2.2 Injection points in the render pipeline

Two places in the platform emit `<style>` blocks. **Neither one injects merchant custom CSS.**

**Point 1 — `buildLiquidThemeHeadAssets()` in `packages/theme-engine/src/theme-renderer.ts`**

Prior to Phase AA this function emitted exactly one `<style>` element:
```html
<style data-theme-renderer="liquid">
  :root { /* --lb-* token variables from bundle */ }
  /* LIQUID_THEME_BASE_CSS static base rules */
</style>
```
The function had no `customCss` parameter. `custom_css` was silently absent.

**Point 2 — `apps/storefront-runtime/src/app/store/[subdomain]/layout.tsx` (lines 177–258)**

JSX `<style>` block interpolating per-store appearance values (`themeSettings.primaryColor`, `fontFamily`, `borderRadius`, etc.) via the appearance bridge in `store-service.ts`. `store-service.ts` reads only `primary_color`, `font_family`, and `border_radius` from `site_settings`. The `custom_css` field is silently ignored.

### 2.3 No CSS validator existed

No custom CSS validator existed anywhere in the codebase before Phase AA. The field accepted arbitrary strings. `custom_css` was also absent from `schema-field-extensions.ts`, `theme-registry.ts`, and all theme bundle schemas.

### 2.4 The DOMPurify gap

The theme renderer wraps all rendered Liquid HTML through a `DOMPurify.sanitize()` pass configured by `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG`. DOMPurify is an HTML sanitizer; it deliberately allows `<style>` elements (required for legitimate first-party theme CSS). However:

- DOMPurify does NOT parse CSS property values for expressions like `expression()`, `url(javascript:)`, or `url(data:image/svg+xml; base64, <script>)`.
- A `<style>` element with malicious CSS would pass DOMPurify unchanged.
- Therefore, a dedicated CSS-level validator is mandatory alongside DOMPurify. This is the core rationale for Phase AA.

---

## 3. Injection Vector Inventory

The following injection vectors were catalogued during Phase AA discovery. All 22 classes must be blocked (each with a failing-if-removed test):

| Vector | Mechanism | Impact |
|--------|-----------|--------|
| `@import` (url, string, any form) | Loads external stylesheet | Data exfiltration; remote script injection via CSS |
| `url(javascript:...)` | Direct and whitespace-smuggled (`java\tscript:`, `java\nscript:`) | Script execution in legacy browsers |
| `url(vbscript:...)` | IE VBScript | VBScript execution in IE |
| `url(data:text/html;...)` | HTML data URI | Inline script via data URI |
| `url(data:image/svg+xml;...)` | SVG data URI with `<script>` | Script execution via `<img src>` |
| `url(data:*javascript*)` | JS MIME data URIs | Executable data URI |
| `url(data:*ecmascript*)` | ECMAScript MIME data URIs | Executable data URI |
| `url(data:application/xhtml+xml)` | XHTML data URI | HTML parsing with script |
| `url(blob:...)` | Blob URI referencing script Blob | Script execution |
| `expression(...)` | IE CSS expression | Direct JS eval in IE |
| `behavior: url(...)` | IE `.htc` behavior | Arbitrary script via `.htc` file |
| `-moz-binding: url(...)` | Firefox XUL/XBL binding | Embedded script in XBL |
| `-o-link:` / `-o-link-source:` | Opera CSS link injection | Navigation injection |
| `</style>` (literal or unicode-encoded) | Style-block breakout | Subsequent bytes parsed as HTML markup |
| `<` in CSS text | HTML tag injection | Breaks out of `<style>` context |
| CSS Unicode escapes for `<`, `>` (`\3c`, `\3e`) | Smuggle markup in escape form | Same as above after decode |
| Non-hex backslash escapes (`@\import`) | CSS spec non-hex escape removes backslash | `@import` bypass via `@\import` |
| Whitespace-smuggling in URL schemes | C0/ASCII whitespace inside `url()` value | Bypasses naive `startsWith('javascript:')` |
| Null bytes (`\x00`) | String truncation in some parsers | Parser confusion |
| HTML comment markers (`<!--`, `-->`) | IE CSS comment quirk | Hide CSS from spec parsers |
| `filter: progid:DXImageTransform.*` | IE filter expression | Script eval in IE |
| Admin-targeting selectors (`body`, `html`, `:root`, `[data-letbuyy-admin]`, `.merchant-control-plane`) | UI-redress / clickjacking | Redress admin chrome in editor preview |
| Unbalanced closing brace `}` | Escapes `.lb-theme { }` scope wrapper | Bare selectors reach outer document |
| `@charset` | Encoding-shift attack | Subsequent bytes reinterpreted |
| `@namespace` | Namespace prefix injection | Namespace manipulation |

---

## 4. CSS Scoping Design

Valid merchant CSS must be scoped so that merchant selectors cannot target the admin chrome or elements outside the storefront container.

**Chosen approach:** CSS Nesting. The sanitizer wraps the validated CSS as:
```css
.lb-theme{<merchant css>}
```

This leverages native CSS nesting (Chrome 112+, Firefox 117+, Safari 17.2+). At-rules (`@media`, `@supports`, `@keyframes`) nested inside `.lb-theme { }` are handled correctly by all three modern engines.

**Browser floor risk (RISK-AA-03):** Storefronts running browsers below these minimum versions will not apply nested merchant CSS. No fallback is generated by the renderer. This is acceptable for the India-first target market where browser adoption of Chrome 112+ is high.

---

## 5. `custom_css` Render Path — NOT-CONNECTED

Phase AA establishes the validation and storage pipeline for `custom_css`. However, the storefront render path (the actual injection of the stored `custom_css` value into the page `<head>`) remains NOT-CONNECTED in this phase.

What is done:
- `buildLiquidThemeHeadAssets(bundle, rawCustomCss?)` now accepts and validates `rawCustomCss` (fail-closed).
- The merchant can save validated custom CSS via the new `CustomCssWorkspace` component.
- Server-side validation in `settings/route.ts` prevents malicious CSS from reaching the DB.

What is NOT yet done:
- The storefront `layout.tsx` still does not read `custom_css` from `site_settings` and pass it to `buildLiquidThemeHeadAssets`.
- The `theme-renderer.ts` call site at line 585 still calls `buildLiquidThemeHeadAssets(bundle)` with no second argument.

This means **custom CSS written through Phase AA is validated and stored but not yet rendered**. Phase AB or a dedicated follow-up will wire the DB value to the render call site.

---

## 6. Entry Gates

| Package | Required gate (entering Phase AA) |
|---------|-----------------------------------|
| `theme-engine` | 1525/1525 pass |
| `merchant-control-plane` (theme-editor suite) | 533/533 pass |
| `api-gateway` | 519 pass (522 total; 3 pre-existing fail) |
| `storefront-runtime` | 795/795 pass |
| All typechecks | clean |
