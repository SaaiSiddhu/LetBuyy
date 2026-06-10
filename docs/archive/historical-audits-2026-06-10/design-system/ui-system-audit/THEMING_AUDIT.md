# THEMING_AUDIT.md

**Scope:** dark/light mode, theme variables, brand customization, white-label readiness in `@letbuyy/ui`.
**Audit date:** 2026-06-06

---

## Executive summary (for leadership)

The **theming mechanism is right; the theming coverage is thin.** `@letbuyy/ui` themes entirely through CSS custom properties generated from `tokens.ts` and toggled by `data-theme`/`data-density` attributes on a `DesignSystemRoot` wrapper. That is the modern, correct approach (same as Polaris, Radix, shadcn). Switching themes is a single attribute flip; no JS re-render, no prop drilling.

But three gaps cap how far this can go:

1. **"Auto" theme is broken.** `DesignSystemRoot theme="auto"` (the **default**) emits no theme attribute and the generated CSS has **no `@media (prefers-color-scheme)`** — so "auto" silently means **light**, and no app actually follows the user's OS setting. Dark mode exists in tokens but is effectively opt-in-by-explicit-prop only.
2. **No white-label / multi-brand path.** The brand (purple) is hardcoded in `primitive.color`; there is only light/dark. The `surface` axis (`admin|marketplace|storefront|identity|operations`) is written to the DOM as `data-letbuyy-surface` but **nothing keys off it** — a multi-surface theming hook that was declared and never wired.
3. **Token CSS is injected per-provider-instance**, so multiple/nested roots duplicate a multi-KB `<style>` block, and there's no runtime brand-override channel.

For a platform that is "like Shopify" — where merchants and marketplace partners will eventually expect branded surfaces — **white-label is the single biggest theming gap.** The architecture can support it (CSS vars + the inert `surface` attribute are exactly the right seams); it just hasn't been built.

---

## 1. Light / dark mode

### Mechanism (good)
`letbuyyTokenCss` emits two variable sets:
```css
:root, [data-theme="light"], [data-letbuyy-theme="light"] { --lb-color-… : light }
[data-theme="dark"], [data-letbuyy-theme="dark"], .dark { --lb-color-… : dark }
```
Every component reads `--lb-color-*`/`--lb-component-*`, so a theme switch is one attribute change. Dark tokens are **complete** — full semantic + component coverage, dark-specific `statusSoft` (the `*[950]` primitives), dark shadows, dark sidebar/active states. This is a properly built dark theme, not an afterthought.

### Finding TH-1 — `auto` doesn't follow the OS · HIGH
`design-system-root.tsx`:
```tsx
data-letbuyy-theme={theme === 'auto' ? undefined : theme}
```
With the default `theme="auto"`, no theme attribute is set, so `:root` (light) applies. And `letbuyyTokenCss` contains **no `@media (prefers-color-scheme: dark)`** rule. Therefore:
- The default configuration **never renders dark**, even for users with OS dark mode.
- Dark mode only appears if an app explicitly passes `theme="dark"` (or toggles the attribute itself).

This is a real defect: the system *has* a complete dark theme that the default config can't reach. Fix: emit a `@media (prefers-color-scheme: dark)` block (scoped to "auto" roots) mapping to the dark variables, and/or resolve `auto` to the OS preference at the root.

### Finding TH-2 — Two theme-attribute vocabularies · LOW
CSS matches `data-theme`, `data-letbuyy-theme`, **and** `.dark`. `DesignSystemRoot` writes `data-letbuyy-theme`. Three selectors for one concept invites confusion about which is canonical (esp. with Tailwind's `.dark` convention also matched).

---

## 2. Theme variables

- **~200 CSS variables** per theme (`--lb-color-*`, `--lb-component-*`, `--lb-semantic-*`, `--lb-primitive-*`, plus shared typography/space/radius/shadow/motion/size/density).
- Generated deterministically — **single source of truth** in `tokens.ts`.
- **Finding TH-3 (MEDIUM):** alias sprawl (see `DESIGN_TOKEN_AUDIT.md` C-2) means a brand override must set multiple aliased variables (`--lb-color-text` *and* `--lb-color-text-primary`) to be safe. Collapsing aliases makes theming overrides reliable.

---

## 3. Brand customization

### Current state: hardcoded single brand
- Brand purple lives in `primitive.color.purple.{500,600,700}` and flows to `accent`, `Avatar`, sparklines, active tabs, focus ring, progress, primary-CTA (dark).
- There is **no documented "set your brand color" entry point.** A consumer *could* override `--lb-color-primary` (and its ~8 derived `--lb-color-primary-*` aliases + `--lb-component-button-*` + `--lb-color-focus-ring`) on a wrapper, but:
  - it's undocumented,
  - the alias sprawl means several variables must be set in concert,
  - the light-mode primary **button** is slate-900, not `--lb-color-primary`, so overriding the brand color won't change the light CTA (see token C-1).

### Finding TH-4 — No first-class brand override · HIGH (for "like Shopify")
A Shopify-like platform needs per-merchant / per-marketplace brand theming. Today there is no API for it. The seams exist (CSS vars), but the product needs a `brand` input on `DesignSystemRoot` (or a `createTheme({ brand })`) that rewrites the primary ramp + focus ring + CTA in one move.

---

## 4. White-label readiness

### Finding TH-5 — `surface` axis declared but inert · HIGH
`DesignSystemRoot` writes `data-letbuyy-surface="admin|marketplace|storefront|identity|operations"`, and the prop is plumbed through — but **no CSS rule anywhere keys off `data-letbuyy-surface`.** Verified: token CSS only selects on `data-theme`/`data-density`/`data-letbuyy-design-system`. So today, all five surfaces render identically. The hook for white-label/multi-surface theming is **present in the API and absent in the implementation.**

This is actually a *positive* sign for the roadmap: the intended seam already exists. Wiring `[data-letbuyy-surface="marketplace"] { --lb-color-primary: … }` overrides would unlock per-surface branding with no API change.

### White-label scorecard

| Capability | Status |
|---|---|
| CSS-variable theming substrate | ✅ Present and correct |
| Light/dark | ✅ (auto broken) |
| Per-surface theming | ❌ `surface` attr inert |
| Per-tenant/merchant brand | ❌ no API |
| Runtime brand override | ❌ token CSS is static-injected per root |
| Theme-contract docs | ❌ none |
| Contrast safety under custom brand | ❌ no guardrails (a merchant could pick an inaccessible brand color) |

---

## 5. Delivery concerns

- **Finding TH-6 (MEDIUM):** `includeTokenStyles` defaults `true`, so **each `DesignSystemRoot` injects the full token `<style>`.** Nested roots (e.g., a marketplace surface embedded in admin) duplicate ~200 variables × 2 themes × 3 densities of CSS. No dedupe, no static stylesheet option used by default.
- **Finding TH-7 (HIGH, cross-ref usage):** `marketing-site` renders `@letbuyy/ui` components **without any `DesignSystemRoot`** → no token CSS → components fall back to undefined `var(--lb-*)` (transparent/zero). A live theming/correctness break, documented in `UI_USAGE_GRAPH.md`.

---

## Verdict & roadmap

**Mechanism A-, coverage C.** The CSS-variable foundation is exactly what you'd build for multi-brand theming — but only light/dark are realized, "auto" is broken, and the multi-surface/white-label seams are stubbed, not wired.

**To reach white-label-ready:**
1. Fix `auto` (`prefers-color-scheme`).
2. Collapse token aliases so overrides are single-variable.
3. Add a first-class `brand`/`createTheme` API on `DesignSystemRoot`.
4. **Wire the `surface` attribute** to per-surface variable overrides.
5. Make `Button` light-primary use `--lb-color-primary` so brand overrides actually change the CTA.
6. Move token CSS to a static, deduped stylesheet (inject once).
7. Add a contrast guardrail (warn/auto-adjust) for custom brand colors.
8. Fix `marketing-site` (wrap in `DesignSystemRoot`).
