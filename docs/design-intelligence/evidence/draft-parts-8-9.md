# LetBuyy Design Intelligence Master Document
## Parts 8 and 9: Theme Architecture and Design Debt

**Generated:** 2026-06-19
**Sources:** THEME_ARCHITECTURE.md, THEME_GOVERNANCE.md, DESIGN_DEBT_REPORT.md, CONSISTENCY_SCORECARD.md, COMPONENT_DUPLICATION_REPORT.md, TOKEN_INVENTORY.md, EXECUTIVE_SUMMARY.md, tokens.ts, generate-mobile-tokens.mjs, design-system-baseline.json

---

# PART 8: THEME ARCHITECTURE

## 8.1 The Four-Tier Token System

The LetBuyy design system organizes all design decisions into four discrete token tiers, each serving a defined purpose and a defined audience. Tiers are not interchangeable; violating tier boundaries is a governance failure.

### Tier 0: Primitive Tokens

Primitive tokens are the raw material of the token system. They represent absolute values — specific colors, specific pixel measurements — with no semantic meaning attached. They are declared in `packages/typescript/ui/src/tokens.ts` under `letbuyyPrimitiveTokens` and emitted as CSS custom properties under the `--lb-primitive-color-*` namespace.

**Naming convention:**

```
--lb-primitive-color-<palette>-<step>
```

Examples: `--lb-primitive-color-purple-500` (#8B5CF6), `--lb-primitive-color-gray-900` (#111827), `--lb-primitive-color-ink-950` (#0a0912).

The primitive palette covers six color scales: purple (100–900), gray (50–900, with intermediate 125 and 150 stops), ink (800–950, the proprietary dark series), slate (50–900), plus status primitives for success, warning, critical, and info. Spacing, radius, shadow, and motion values also have primitive equivalents.

**Primitive tokens are private by design.** Product code must never reference `--lb-primitive-color-*` directly. They exist solely as inputs to Tier 1 semantic tokens. This constraint is enforced by the `@letbuyy/ui` ESLint plugin, which flags direct primitive references in TSX.

The total primitive token set is approximately 120 named color stops plus non-color primitives (spacing scale: xs=4px, sm=8px, md=12px, lg=16px, xl=20px, 2xl=24px, 3xl=32px; radius scale: sm=4px, md=8px, lg=12px, xl=16px, 2xl=20px, full=9999px; z-index scale: modal=60, toast=70, overlay=50, dropdown=40).

### Tier 1: Semantic Tokens

Semantic tokens assign role-based meaning to primitive values. They are the primary surface that product code should reference. They are declared in `letbuyySemanticTokens` (with separate light and dark variant maps) and emitted as `--lb-color-*` CSS custom properties.

**Surface and background tokens:**

| CSS Variable | Light value | Dark value |
|---|---|---|
| `--lb-color-bg` | gray-125 (rgb 250 249 255) | ink-950 (#0a0912) |
| `--lb-color-surface` | white | ink-850 |
| `--lb-color-surface-subdued` | gray-50 | ink-950 |
| `--lb-color-card` | white | ink-800 |

**Text tokens:**

| CSS Variable | Light value | Dark value |
|---|---|---|
| `--lb-color-text` | gray-900 | white |
| `--lb-color-text-subdued` | gray-500 | slate-300 |

**Border tokens:**

| CSS Variable | Light value | Dark value |
|---|---|---|
| `--lb-color-border` | gray-200 | rgba(139,92,246,0.18) — purple-tinted |
| `--lb-color-border-strong` | gray-400 | rgba(139,92,246,0.35) |

**Brand and action tokens:** `--lb-color-primary` (purple-500), `--lb-color-primary-hover` (purple-600), `--lb-color-primary-cta` (purple-700), `--lb-color-primary-active` (purple-800).

Semantic tokens respond to theme context: the token system emits their light values under `:root, [data-theme="light"], [data-letbuyy-theme="light"]` and their dark values under `[data-theme="dark"], [data-letbuyy-theme="dark"], .dark`.

### Tier 2: Component Tokens

Component tokens are per-component CSS variable overrides that reference semantic tokens. They narrow the design decision to a specific component context. They are declared in `letbuyyComponentTokens` (with light and dark splits) and emitted under the `--lb-component-*` namespace.

**Naming convention:**

```
--lb-component-<component>-<element>[-<state>]
```

Examples:
- `--lb-component-button-primary-bg` → purple-700 (light) / purple-500 (dark)
- `--lb-component-card-radius` → md (8px)
- `--lb-component-sidebar-active-bg` → `rgb(139 92 246 / 16%)` (dark)
- `--lb-component-input-border` → gray-200 (light) / rgba(139,92,246,0.18) (dark)

Component tokens are scoped to the `DesignSystemRoot` container via the `data-letbuyy-surface` attribute. Apps may override component tokens in their `globals.css` by targeting the surface attribute — the merchant-control-plane does this for sidebar tokens (`--lb-component-sidebar-*`) to wire the admin shell's sidebar colors. This is the sanctioned override mechanism; any override must respect the semantic token chain above it.

### Tier 3: Density Tokens

Density tokens are spatial sizing variables that respond to the active density tier — `compact`, `comfortable`, or `spacious`. They are declared in `letbuyyDensityTokens` (a three-way map indexed by `LetbuyyDensity`) and emitted by the `densityVariables()` function.

**Density is not theme-aware.** There is no light/dark split for density tokens. They are purely spatial.

The `densityVariables()` function emits 26 distinct `--lb-density-*` CSS custom properties:

```
--lb-density-sidebar-row-height
--lb-density-sidebar-icon-size
--lb-density-sidebar-nested-spacing
--lb-density-sidebar-section-spacing
--lb-density-input-height
--lb-density-button-height
--lb-density-button-height-large
--lb-density-icon-button-height
--lb-density-pill-height
--lb-density-table-row-height
--lb-density-table-header-height
--lb-density-table-icon-size
--lb-density-action-bar-height
--lb-density-action-icon-size
--lb-density-header-height
--lb-density-card-padding
--lb-density-card-gap
--lb-density-page-gap
--lb-density-section-gap
--lb-density-modal-padding
--lb-density-page-icon-size
--lb-density-button-icon-size
--lb-density-empty-state-min-height
--lb-density-empty-state-illustration-height
--lb-density-empty-state-illustration-width
--lb-density-empty-state-scale
```

**Representative values across density tiers** (compact / comfortable / spacious):
- `--lb-density-input-height`: 32px / 36px / 40px
- `--lb-density-table-row-height`: 40px / 48px / 56px
- `--lb-density-header-height`: 52px / 60px / 68px
- `--lb-density-card-padding`: 12px / 16px / 20px

`LetbuyyThemeProvider` applies density tokens by passing the resolved `density` prop to `DesignSystemRoot`, which calls `densityVariables(density)` and injects the result into the scoped style block. The default density for the merchant control plane is `"compact"` — the most information-dense tier.

---

## 8.2 The ThemeProvider System

### LetbuyyThemeProvider

`LetbuyyThemeProvider` (`packages/typescript/ui/src/theme-provider.tsx`) is the single canonical theme controller. It superseded five previously incompatible per-app implementations (documented in THEME_ARCHITECTURE_AUDIT.md THEME-2 and LIGHT_DARK_MODE_AUDIT.md LDM-1/2/3).

**Internal state machine:**

1. On mount, reads `localStorage["letbuyy-theme"]` and validates the stored value as `"light" | "dark" | "system"`. If absent or invalid, falls back to the `defaultTheme` prop.
2. Resolves `"system"` against `window.matchMedia("(prefers-color-scheme: dark)")`.
3. Applies DOM signals via `applyDomSignals(resolved)`:
   - Sets `<html data-theme="light|dark">` — the primary CSS selector target
   - Adds `.light` or `.dark` class to `<html>` — compatibility signal for Tailwind `darkMode: 'class'`
   - Sets `html.style.colorScheme = resolved` — OS-level rendering hint
   - Caches the resolved value on `window.__letbuyyResolvedTheme` for hydration handshake
4. When `theme === "system"`, registers a `matchMedia` change listener to respond to OS theme changes without a page reload.
5. Internally renders `<DesignSystemRoot surface={surface} theme={resolvedTheme} density={density} brand={brand}>`. The provider always passes the **resolved** theme, never `"auto"` or `"system"`. This resolves the prior `theme="auto"` override conflict that allowed ancestor providers to silently override descendant resolved themes.

**Props accepted by LetbuyyThemeProvider:**

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `defaultTheme` | `"light" \| "dark" \| "system"` | `"system"` | Initial theme when nothing is persisted in localStorage |
| `storageKey` | `string` | `"letbuyy-theme"` | localStorage key. Must not be overridden — the validator gate enforces this |
| `surface` | `LetbuyySurface` | `"admin"` | Scopes the component token variable set |
| `density` | `LetbuyyDensity` | `"compact"` | Controls which density tier is applied |
| `brand` | `LetbuyyBrandInput` | undefined | Per-tenant primary color override; triggers `createLetbuyyBrandVariables()` |

### Five Surface Types

The `LetbuyySurface` union type is `"admin" | "marketplace" | "storefront" | "identity" | "operations"`. Each surface is applied via `data-letbuyy-surface` attribute on the `DesignSystemRoot` container, scoping component token overrides to that container's subtree.

| Surface | Intended use | Current app |
|---|---|---|
| `"admin"` | Merchant-facing operational UI | `merchant-control-plane` |
| `"marketplace"` | App and theme marketplace browsing | `app-marketplace` (frozen) |
| `"storefront"` | Shopper-facing purchase experience | `storefront-runtime`; incorrectly also `marketing-site` |
| `"identity"` | Authentication and onboarding flows | `identity-platform` (pending migration to canonical provider) |
| `"operations"` | Internal operator tooling | `platform-console` |

**Critical gap:** All five surfaces currently produce identical `surfaceVariables()` output. The surface attribute correctly scopes component variable names but does not differentiate brand colors or background values. A `marketplace` surface is visually indistinguishable from an `admin` surface. Surface differentiation is the designated architectural hook for future per-product identity — it is not yet exercised.

### ThemeScript and Flash Prevention

`<ThemeScript>` renders a blocking inline `<script>` tag in `<head>`. It runs synchronously before first paint, performing the following:

1. Reads `localStorage["letbuyy-theme"]`
2. Resolves `"system"` against `window.matchMedia("(prefers-color-scheme: dark)")`
3. Sets `<html data-theme="light|dark">` and the `.dark` class
4. Sets `html.style.colorScheme`
5. Caches the resolved value on `window.__letbuyyResolvedTheme`

When the React provider hydrates, it reads `window.__letbuyyResolvedTheme` as its initial state. This ensures the provider's initial theme matches what `ThemeScript` already applied to the DOM, eliminating both the white flash (dark mode users seeing light briefly) and React hydration mismatches.

**Requirement:** Every `layout.tsx` that uses `<LetbuyyThemeProvider>` must also render `<ThemeScript>` in its `<head>`. The CI validator flags violations.

### DesignSystemRoot

`DesignSystemRoot` (`packages/typescript/ui/src/design-system-root.tsx`) is the internal root rendered by `LetbuyyThemeProvider`. It is responsible for:

- Injecting the `<style>` block containing all `--lb-*` CSS variables (color tokens for the active theme, density tokens, component tokens)
- Setting the `data-letbuyy-surface` and `data-letbuyy-theme` attributes on its wrapper `<div>`
- Delegating deduplication to `TokenStyleBoundary` (see below)

`DesignSystemRoot` is exported and can be used directly in contexts where the full provider state machine is not needed (such as Storybook, embedded preview iframes, or server components).

### TokenStyleBoundary

`TokenStyleBoundary` (`packages/typescript/ui/src/token-style-boundary.tsx`) prevents duplicate `--lb-*` CSS injection when `DesignSystemRoot` instances are nested. It uses a React context (`TokenStyleContext`) to track whether an ancestor has already injected the token style block. Nested instances detect the ancestor and skip re-injection, preventing both duplicate `<style>` tags and token override conflicts in preview environments.

---

## 8.3 Tailwind v4 Bridge

### How --lb-* Tokens Connect to Tailwind

`config/tailwind/letbuyy-tokens.css` is a Tailwind v4 `@theme` block. It does not contain the token values themselves; instead, it maps the Tailwind utility color namespace to the `--lb-color-*` CSS custom properties already injected by `DesignSystemRoot`. This means Tailwind classes resolve at runtime through the CSS variable layer, not at build time — dark mode switches automatically because the same Tailwind class resolves to different values depending on whether `--lb-color-bg` is set to its light or dark value.

**Semantic utility class mapping:**

| Tailwind class | CSS variable | Light value | Dark value |
|---|---|---|---|
| `bg-page` | `--lb-color-bg` | rgb(250 249 255) | #0a0912 (ink-950) |
| `bg-surface` | `--lb-color-surface` | white | ink-850 |
| `bg-surface-subdued` | `--lb-color-surface-subdued` | gray-50 | ink-950 |
| `bg-card` | `--lb-color-card` | white | ink-800 |
| `text-default` | `--lb-color-text` | gray-900 | white |
| `text-subdued` | `--lb-color-text-subdued` | gray-500 | slate-300 |
| `border-line` | `--lb-color-border` | gray-200 | rgba(139,92,246,0.18) |
| `text-primary` | `--lb-color-primary` | purple-500 | purple-500 |

Breakpoints are also registered in the Tailwind bridge: `xs:` (360px), `mobile:` (480px), `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px).

### Why Raw Tailwind Colors Are Forbidden

Raw Tailwind palette classes (`bg-gray-50`, `text-white`, `bg-indigo-500`) are forbidden in product code for three reasons. First, they do not respond to dark mode — `bg-gray-50` in dark mode renders gray, not the dark ink surface that the semantic token would correctly provide. Second, they couple product code to Tailwind's color scale rather than LetBuyy's brand palette. Third, they accumulate in the governance ratchet: the `tailwindPaletteClasses` ratchet count is currently at 588 and cannot increase. Every raw palette class added to product code increases this count and fails the CI gate.

The ESLint `@letbuyy/ui` plugin flags `bg-gray-*`, `text-white`, and similar classes as warnings (not errors, to permit incremental migration). The ratchet gate enforces the hard ceiling.

**Migration guide:**

| Forbidden | Canonical replacement |
|---|---|
| `bg-white` | `bg-surface` |
| `bg-gray-50` | `bg-surface-subdued` |
| `text-gray-900` | `text-default` |
| `text-gray-500` | `text-subdued` |
| `border-gray-200` | `border-line` |

---

## 8.4 Dark Mode Architecture

### Implementation Method

Dark mode uses a dual-signal DOM approach. Two attributes are set simultaneously on the `<html>` element:

1. `data-theme="dark"` — the primary signal, targeting the `--lb-*` CSS variable definitions in `letbuyyTokenCss`
2. `class="dark"` — a compatibility signal for components using Tailwind's `darkMode: 'class'` configuration

A third signal, `html.style.colorScheme = "dark"`, informs the operating system to render native OS controls (scrollbars, form elements, select dropdowns) in dark mode.

The token CSS emits under the following selectors:

```css
/* Light values */
:root, [data-theme="light"], [data-letbuyy-theme="light"] {
  --lb-color-bg: rgb(250 249 255);
  /* ... */
}

/* Dark values */
[data-theme="dark"], [data-letbuyy-theme="dark"], .dark {
  --lb-color-bg: #0a0912;
  /* ... */
}

/* System preference fallback (when no manual override is stored) */
@media (prefers-color-scheme: dark) {
  :root, [data-theme="auto"] {
    --lb-color-bg: #0a0912;
    /* ... */
  }
}
```

### ThemeScript and SSR Behavior

The critical SSR constraint is that Next.js renders `<html>` without any theme attribute on the server — the server does not know the user's stored preference. Without `ThemeScript`, the browser would paint the server's light HTML before JavaScript runs and applies the dark class, producing a visible flash.

`ThemeScript` is a blocking inline script injected into `<head>`. "Blocking" means it runs synchronously before the browser proceeds to parse the rest of the document and before any CSS paint. This is a deliberate performance trade-off: one small script execution prevents the far worse user experience of a flash.

The hydration handshake works as follows: `ThemeScript` sets `window.__letbuyyResolvedTheme = "dark"` (or `"light"`). When `LetbuyyThemeProvider` initializes during React hydration, it checks `window.__letbuyyResolvedTheme` before reading `localStorage`. The provider's initial state therefore matches the DOM state already established by `ThemeScript`, and React can hydrate without seeing a mismatch.

### Which Apps Support Dark Mode

| App | Dark mode | Mechanism | Notes |
|---|---|---|---|
| `merchant-control-plane` | Full | `LetbuyyThemeProvider` + `.dark` CSS class | Both themes fully styled; canonical implementation |
| `identity-platform` | Full | Custom `.dark` class toggle (not via canonical provider) | Dark overrides complete; flash risk (no `ThemeScript`) |
| `marketing-site` | Full | `[data-theme="dark"]` attribute | Light/dark token blocks defined in globals.css |
| `platform-console` | Partial | `@media (prefers-color-scheme: dark)` only | No manual toggle; cannot persist a user preference |
| `storefront-runtime` | Not implemented | N/A | React rendering path has no dark palette; Liquid engine handles per-merchant theming |

### Which Apps Force Dark

`platform-console` uses `@media (prefers-color-scheme: dark)` as its sole dark mode signal, which means it follows the OS and cannot be overridden. The intended production behavior for `platform-console` (once migrated to `LetbuyyThemeProvider`) is `defaultTheme="dark"` with the `"operations"` surface — operator tooling should default to dark.

`platform-operations-portal` (frozen/pending consolidation) similarly intends a forced-dark posture for internal operations workflows.

### OverlayPortal Theme Mirroring Requirement

Modals, tooltips, and other overlay components that render into `document.body` via a portal face a specific problem: their DOM nodes sit outside the `LetbuyyThemeProvider`'s scoped `DesignSystemRoot` container. The `data-letbuyy-theme` attribute that controls the dark/light token values is set on the provider's wrapper `<div>`, not on `<html>` directly. Portal content therefore inherits neither the theme attribute nor the dark class from the provider container.

`OverlayPortal` solves this by reading the current theme from the provider context and mirroring `data-letbuyy-theme` onto the body-level container it creates for the portal. Without this, a portal rendered in a light-themed app on a dark OS will render with dark token values if the OS preference is dark and the app explicitly chose light.

This is confirmed behavior, documented in the OverlayPortal memory note: "modals render dark in a light app when OS is dark" is the exact failure mode that `OverlayPortal` theme mirroring prevents.

### The Four Divergent Dark Backgrounds

Investigation found four distinct dark page backgrounds in active apps:

| Background value | Token / App |
|---|---|
| `rgb(10 9 18)` | ink-950 — canonical `--lb-color-bg` dark value; used by identity-platform, merchant-control-plane, marketing-site |
| `rgb(10 10 10)` | Near-black; used by platform-console / operations surface |
| `rgb(10 15 26)` | Deep blue-black; used by app-marketplace (frozen) |
| `rgb(15 15 26)` | Near-identical blue-black; used by theme-marketplace (frozen) |

The canonical dark background is `rgb(10 9 18)` (ink-950). The three active production apps that use it share the LetBuyy "ink lavender" visual identity. The platform-console divergence is accidental — it should migrate to `var(--lb-color-bg)` in dark mode. The frozen app backgrounds are not deployment targets and are noted for record only.

---

## 8.5 Tenant Brand Customization

### createLetbuyyBrandVariables API

`createLetbuyyBrandVariables()` is the server-safe function that generates per-tenant brand overrides as a `CssVariableMap`. It accepts a `LetbuyyBrandInput`, which is either a hex string (simple primary color override) or a `LetbuyyBrandOverrides` object.

When a `brand` prop is passed to `LetbuyyThemeProvider`, the provider calls `createLetbuyyBrandVariables(brand)` and injects the result as additional CSS variables on the `DesignSystemRoot` container, overriding the default token values for that container's subtree only.

**Tokens exposed to brand customization:**

```
--lb-color-primary          (primary brand color)
--lb-color-primary-cta      (CTA button background)
--lb-color-primary-hover    (hover state)
--lb-color-primary-active   (active/pressed state)
--lb-color-primary-subtle   (light wash background)
--lb-color-secondary-action (secondary action color)
--lb-color-focus-ring       (keyboard focus ring)
```

Additionally, all component tokens that reference `--lb-color-primary` (button primary bg, badge primary fill, empty-state icon, input focus border) are regenerated from the brand primary input.

### WCAG Contrast Validation

`validateLetbuyyBrandContrast(brandColor)` performs WCAG AA contrast ratio checks before brand variables are applied:

- Primary on white (light mode CTA text): minimum 4.5:1
- Primary on ink-950 (dark mode CTA): minimum 4.5:1
- Focus ring on white: minimum 3:1 (WCAG AA for UI components)

If any ratio falls below the minimum, the function returns a validation failure object with the failing pairs. The provider can use this to warn or reject the brand input. Currently validation runs client-side when the `brand` prop is supplied; there is no server-side CI gate enforcing contrast for persisted merchant brand colors.

### Which Tokens Are Locked (Not Merchant-Customizable)

The following tokens are not overridable by the brand input and remain under platform control:

- All surface and background tokens (`--lb-color-bg`, `--lb-color-surface`, etc.)
- Typography tokens (`--lb-font-family-*`, `--lb-font-size-*`)
- Density tokens
- All component structural tokens except those that directly reference primary color

This means merchant admin customization is limited to the primary brand color. The storefront token system (entirely separate from `--lb-*`) provides the full per-tenant color, typography, and radius customization surface for shopper-facing storefronts.

---

## 8.6 The Liquid/React Theme Engine (packages/theme-engine)

### Storefront Rendering Model

The storefront renders via one of two paths, controlled by the theme's render engine declaration:

**React path (current default):** Theme JSON settings are read from `settings_data.current`, mapped to React component props, and rendered by the React component tree in `storefront-runtime`. CSS custom properties (`--primary`, `--secondary`, `--background`, `--foreground`, `--font-body`, `--font-display`, `--radius`) are injected at the storefront `:root` level from theme settings. These are entirely separate from the `--lb-*` token namespace.

**Liquid path (canary, off by default):** The `Urban Kicks` bundle provides a complete Liquid theme. Template files (`layout/theme.liquid`, `sections/*.liquid`) are rendered server-side by the Liquid engine in `storefront-runtime`. Token injection happens in the Liquid layout template: `{{ settings.primaryColor }}` is used inline to set `:root { --primary: ... }`.

### The Liquid Rendering Flag

Liquid rendering is controlled by a layered decision function in `packages/theme-engine/src/theme-governance.ts`:

```
resolveThemeLiquidRenderingEnabled():
  1. templateConfig.rendererEngine === 'liquid'  (explicit per-theme switch — Phase 9 production gate)
  2. releaseManifest.renderer_engine === 'liquid'
  3. liquidRenderingCanary in templateConfig | themeSettings | releaseManifest
  4. default: THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false
```

`THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is `false`. Platform-wide activation requires ARB approval: `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = { status: 'deferred', authority: 'ARB' }`.

Individual stores can activate Liquid by having `rendererEngine: 'liquid'` in their stored `templateConfig`. This is the correct per-store activation path during the canary period.

### Urban Kicks as the Reference Liquid Theme

Urban Kicks is the first-class Liquid theme and the reference implementation for the theme engine's capabilities. Its bundle structure:

```
layout/theme.liquid              — master Liquid layout template
config/settings_schema.json      — merchant-configurable settings definition
config/settings_data.json        — current settings values (tenant-specific)
sections/*.liquid                — individual page sections
assets/                          — static assets and compiled JS
```

Nine hydration islands provide interactive commerce functionality without full React: `lb-add-to-cart`, `lb-cart-drawer`, `lb-search`, `lb-variant-picker`, `lb-review-form`, `lb-wishlist-toggle`, `lb-cart`, `lb-customer-settings`, `lb-address-manager`. These are implemented as custom elements, allowing Liquid-rendered pages to have reactive commerce interactions.

### Theme Registry Structure

`packages/theme-engine/src/theme-registry.ts` defines the section and block schema contracts:

- **`THEME_SETTINGS_SCHEMA`** — top-level merchant settings: colors (primary, secondary, accent, background, text), typography (fontFamily, headingFontFamily — 8 choices), layout (borderRadius 0–24px, enableAnimations, enableShadows), header behavior, footer configuration.
- **Section schemas** — per-section content and layout settings. Each section type (heroBanner, productGrid, announcementBar, etc.) has a `SectionSchema` with its own `settings_schema` fields.
- **`getDefaultStorefrontThemeTemplate()`** — produces the canonical `StorefrontThemeTemplateConfig` object used as the base for new store theme configurations.

The registry is frozen: `ART-17` prohibits new React-per-section entries after the freeze date. New sections must be added as Liquid sections.

### The Experience Preset System

`packages/theme-engine/src/theme-presets.ts` implements 10 named Experience presets, each validated against `ExperienceTokensSchema`:

```typescript
ExperienceTokensSchema = {
  primaryColor, secondaryColor, accentColor, backgroundColor, textColor, surfaceColor,
  fontFamily, headingFontFamily, borderRadius  // 9 token dimensions
}
```

Registered experiences: Forge (industrial dark), Sense (clean minimal), Craft (artisan warm), Refresh (fresh food), Summit (outdoor premium), and five others. Each defines validated hex colors, a font stack from the 8-choice typography menu, and a border-radius value.

The preset engine is fully implemented with Zod validation and `ExperiencePreviewSchema` (name, description, swatches array, industry tags). However, no API action in `merchant-control-plane` currently applies a preset to `settings_data.current`. The frontend connection is a Phase 2 delivery item.

---

## 8.7 Mobile Token Synchronization

### The generate-mobile-tokens.mjs Pipeline

The mobile token pipeline maintains parity between the TypeScript design token source and the Flutter/Dart implementation. The pipeline is:

```
packages/typescript/ui/src/tokens.ts
  → (generate-design-tokens.mjs)
  → packages/typescript/ui/tokens.json  (DTCG interchange format)
  → (generate-mobile-tokens.mjs)
  → packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart
```

`generate-mobile-tokens.mjs` reads `tokens.json`, resolves all DTCG token references (`{color.primitive.purple.500}` → `#8B5CF6`), and generates a Dart file containing `Color` constants. The script includes a `--check` mode that compares the generated output against the existing Dart file without writing — this mode runs in the pre-commit hook.

**Hex-to-Dart conversion:** Six-digit hex values become `Color(0xFF<HEX>)`. Eight-digit hex values (ARGB for alpha-transparent tokens) become `Color(0x<HEX>)`. Non-hex values (raw `rgb()` strings, CSS variables) throw an error at generation time — the pipeline requires that all tokens resolve to hex before the Dart file can be generated.

**What the Dart file contains:** Color primitive constants (`purple100` through `purple900`, `gray50` through `gray900`, `ink800` through `ink950`, status colors), semantic light theme color assignments, and — where implemented — semantic dark theme color assignments.

### Current Parity Gaps

**Gap 1: Dark mode slate/gray vs ink-lavender mismatch.**

The TypeScript dark mode semantic tokens use `slate-300` for `--lb-color-text-subdued` (a blue-gray tone) and `ink-950` for backgrounds. The Flutter `dark_theme_colors.dart` does not have corresponding `ink` scale entries — it maps dark subdued text to a gray value rather than the slate-300 used in web dark mode. This means subdued text renders at a different color weight on mobile dark mode compared to web dark mode.

**Gap 2: Alpha-transparent token values.**

Several dark mode semantic tokens use `rgba()` values (notably `--lb-color-border` dark = `rgba(139,92,246,0.18)` — the purple-tinted border). The DTCG interchange stores these as 8-digit hex ARGB. The `generate-mobile-tokens.mjs` script supports this via `rgbaHexToDart()`, but the tokens.json file must have been generated with ARGB encoding for these values. Confirm DTCG output encoding before each mobile token sync.

**Gap 3: Density tokens are not mirrored.**

The 26 `--lb-density-*` tokens have no Dart equivalents. Mobile layout uses platform-native sizing conventions (Material Design elevation and component heights) rather than the web density system. This is an intentional divergence, not a parity gap.

### What Needs Fixing

1. Add `slate300` to the primitive token set in `tokens.json` and map it to the `textSubdued` dark mode color in `letbuyy_tokens.dart`.
2. Add `ink800`, `ink850`, `ink950` as Dart Color constants to close the ink scale gap.
3. Add the purple-tinted border ARGB value as a named token (e.g. `borderDark`) in the Dart file.
4. Confirm that `validate-mobile-tokens.mjs` in CI is comparing the full semantic dark color set, not only the light palette.

---

## 8.8 Theme Architecture Scalability Assessment

### White-Label Instances

**Assessment:** Partially capable.

The `brand` prop on `LetbuyyThemeProvider` and `createLetbuyyBrandVariables()` support single-color white-labeling: any operator or tenant can supply a hex primary color and the entire primary color variant chain (hover, active, CTA, subtle, focus ring) is regenerated. WCAG contrast validation is built in.

**Gap:** Only the primary color is overridable at the admin layer. Secondary color, surface backgrounds, and typography cannot be overridden per-tenant in the admin design system. True white-labeling (brand font, unique background color, secondary palette) would require extending `LetbuyyBrandOverrides` with `secondary`, `background`, and `headingFont` / `bodyFont` fields. This is a one-sprint addition — the architecture is ready for it, the API surface just does not expose those fields yet.

Storefront white-labeling is fully supported via the tenant `settings_data` system, which is the correct layer.

### Per-Tenant Branding Beyond Color

**Assessment:** Supported for storefronts; not supported for admin.

The storefront `ExperienceTokensSchema` covers 9 dimensions: 5 colors + 2 fonts + border-radius. Each store's settings are independent. This is production-ready.

The admin UI always renders the platform brand (purple). A merchant running a red-branded store will see purple in their merchant dashboard. Per-tenant admin skins are architecturally possible (the surface system is the hook) but would require per-surface brand token differentiation.

### A/B Testing Design Variants

**Assessment:** Infrastructure exists; wiring is absent.

The `ExperiencePreviewSchema` and the preset system provide validated, composable token overlays that are natural A/B variant units. A/B testing would assign experience presets to merchant cohorts rather than allowing free-form color input.

**Gap:** No A/B experiment framework exists in the codebase to wire cohort assignment to experience selection. The `theme-presets.ts` is the right abstraction; an experiment layer on top of it is the missing piece.

### New Product Surfaces (Mobile Shopper, Developer Portal Rebuild)

**Assessment:** Architecturally extensible; one-sprint addition per surface.

Adding a new surface requires: extending the `LetbuyySurface` union type, adding an entry to `letbuyySurfaceNames`, and populating a `surfaceVariables()` override. The token injection and CSS scoping mechanisms already support any number of surfaces.

**Current gap:** All five existing surfaces share identical `surfaceVariables()` output. Adding a new surface without per-surface differentiation adds the surface selector but no visual distinction. Per-surface color differentiation (e.g. `marketplace` surface = blue accent, `operations` surface = emerald accent) is the design decision that would make the surface system meaningful — the engineering hook is present, the design decision has not been made.

---

## 8.9 Missing Theme Capabilities

The following gaps were identified during investigation of the token system, governance documents, and app globals.css files:

**1. No `marketing` surface type.**
`marketing-site` currently uses `surface="storefront"` — semantically incorrect. The marketing surface is the public conversion site for LetBuyy, not a merchant's customer storefront. If the storefront surface ever receives distinct token values for shopper-specific aesthetics, the marketing site will silently receive those changes. A `marketing` surface must be defined and assigned. This is a latent regression risk.

**2. Broken `--lb-color-border-subtle` alias.**
`--lb-color-border-subtle` is referenced in `apps/merchant-control-plane/src/app/[store]/products/collections/page.tsx` via `divide-[var(--lb-color-border-subtle)]`. This token does not appear in `tokens.ts`. It is in `deprecatedTokenAliasVariables` — the deprecated token deletion mechanism actively removes it from emitted CSS. Any component referencing it receives an unset CSS variable, which resolves to transparent. The canonical border tokens are `--lb-color-border` (default) and `--lb-color-border-strong` (emphasis).

**3. No `ThemeScript` enforcement in the validator gate.**
The `validate-design-system.mjs` validator catches `<DesignSystemRoot>` used without `<LetbuyyThemeProvider>` and `theme="auto"` prop violations, but does not flag a `layout.tsx` that uses `<LetbuyyThemeProvider>` without a sibling `<ThemeScript>` in `<head>`. Flash prevention is advisory, not enforced.

**4. `identity-platform` not on canonical provider.**
The identity-platform uses a custom `.dark` class toggle on auth pages. No `ThemeScript` is in `<head>`. Dark OS users experience a white flash on auth pages before the dark class is applied. The migration path is straightforward: replace the custom toggle with `useTheme().setTheme()` from the canonical provider.

**5. `platform-console` not on canonical provider.**
Platform-console uses `@media (prefers-color-scheme: dark)` in CSS, bypassing the localStorage persistence mechanism entirely. Users cannot manually override the console's theme.

**6. Storefront dark mode not implemented.**
The React storefront rendering path has no dark palette. `storefront-runtime/src/app/globals.css` has no `.dark` class overrides. The `THEME_SETTINGS_SCHEMA` in `theme-registry.ts` includes no dark palette definition. Consumer storefronts are always light-mode.

**7. No per-surface color differentiation.**
All five surface types produce identical visual output. The `surface` prop scopes component variable names but not brand colors. `marketplace` and `storefront` surfaces are visually identical.

**8. Preset application not wired.**
The Experience preset engine is fully implemented in `theme-presets.ts` but no API route in the merchant control plane applies a preset to `settings_data.current`. The merchant theme editor does not expose the preset selector.

**9. Font loading for non-system fonts deferred.**
Experience presets reference `Playfair Display`, `Cormorant Garamond`, `Space Grotesk`, and `DM Sans`. No font-loading mechanism is wired into Liquid `<head>` assets. These experiences render with system-font fallbacks.

**10. No marketing surface token vocabulary.**
`apps/marketing-site` defines its own premium token vocabulary (`--gradient-primary`, `--glass-bg`, `--shadow-glow`, `--ease-smooth`, `--ease-bounce`) in isolation. If the brand purple changes in `tokens.ts`, the marketing site's gradients (`linear-gradient(135deg, rgb(139 92 246) 0%, ...)`) must be manually updated — no automated link exists.

**11. No brand color contrast gate on DB writes.**
`validateLetbuyyBrandContrast()` is called client-side when the `brand` prop is supplied to the provider, but there is no server-side gate in the theme editor API route (`services/api-gateway/src/routes/themes.ts`) that rejects a merchant `primaryColor` submission if the primary-to-white contrast ratio falls below 4.5:1.

---

# PART 9: DESIGN DEBT

## 9.0 Debt Philosophy

The design debt register is permanent. Items are never deleted from this document. When an item is resolved, it is marked `[RESOLVED: YYYY-MM-DD]` and the entry is retained for historical accuracy. This policy exists because:

1. Deleted debt items cannot be verified as actually resolved — only as forgotten.
2. Historical resolution timestamps enable measurement of debt reduction velocity.
3. Resolved items document the canonical fix pattern for future similar violations.

The register is organized by priority tier: P0 (production defects, fix immediately), P1 (high priority, address this week), P2 (medium priority, address this month), P3 (low priority, backlog). Priority reflects operational consequence, not effort. A one-hour P0 fix outranks a two-day P3 initiative.

---

## 9.1 P0 — Production Defects (Fix Immediately)

P0 items are live production bugs with user-visible consequences. They are not design preferences or technical debt trade-offs — they are wrong and must be corrected before the next release.

---

**P0-001: Incorrect currency prefix `Rs.` in coupons page**

File: `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`

Problem: The `formatDiscount()` function returns `` `Rs. ${coupon.value}` `` for absolute discount amounts. `Rs.` is not the correct Indian Rupee symbol. The correct symbol is `₹`.

Evidence:
```typescript
// Current (wrong):
return `Rs. ${coupon.value}`;
// Correct:
return `₹${coupon.value}`;
// Or, with proper decimal handling:
return formatInrCurrency(coupon.value);
```

Impact: Merchants see `Rs. 50` instead of `₹50` on their coupon management page. This is a locale standard violation visible to every merchant managing coupons. The India-first standard (`formatInrCurrency`, `₹` symbol everywhere) is stated in CLAUDE.md and enforced by convention across all other pages — this is the single non-compliant instance.

Fix: Replace `` `Rs. ${coupon.value}` `` with `` `₹${coupon.value}` ``. For correct decimal handling and locale formatting (e.g., ₹1,500 not ₹1500), migrate to `formatInrCurrency(coupon.value)` from `@letbuyy/ui`.

Effort: 1 hour.

Owner: Merchant UI team.

---

**P0-002: Direct `lucide-react` imports bypass version-pinned `@letbuyy/ui` icon exports**

File: `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`

Problem: 27 Lucide icons are imported directly from `lucide-react`, bypassing the version-pinned re-exports in `@letbuyy/ui`. The 27 icons are: `ArrowLeft, Blocks, Bot, CheckCircle2, ChevronDown, ChevronRight, Eye, FileJson, GripVertical, Laptop, Layers3, Loader2, Monitor, Palette, PanelLeft, Plus, Redo2, Rocket, Save, Settings, Smartphone, Sparkles, Tablet, Trash2, Undo2, WandSparkles, X`.

Evidence:
```typescript
// Current (wrong):
import { ArrowLeft, Blocks, Bot, ... } from 'lucide-react';
// Correct:
import { ArrowLeft, Blocks, Bot, ... } from '@letbuyy/ui';
```

Impact: `lucide-react` is a direct dependency in the theme editor bundle, separate from the version pin managed by `@letbuyy/ui`. If `@letbuyy/ui` updates its Lucide dependency, the theme editor's icons may render at different sizes, weights, or with different icon paths — visual inconsistency that is silent and difficult to debug. In the worst case, breaking API changes in Lucide (icon renames between major versions) will affect the theme editor but not other components.

Fix: Replace all `import { ... } from 'lucide-react'` with `import { ... } from '@letbuyy/ui'`. Verify the 27 named icons are exported from `@letbuyy/ui`'s icon re-export surface (`packages/typescript/ui/src/icons.tsx`) — if any are missing, add them to the export list.

Effort: 2 hours.

Owner: Theme Platform team.

---

## 9.2 P1 — High Priority (Address This Week)

P1 items cause user-visible inconsistency or create CI debt ceiling violations that block future work. They are not emergency fixes but cannot be deferred beyond the current sprint.

---

**P1-001: Six active design-system ratchet violations in merchant-control-plane components**

Six component files contain `rounded-[...]` arbitrary-value bracket syntax or raw-px Tailwind values. The ratchet forbids arbitrary-value bracket syntax for radius regardless of whether the value references a token. These six files are the complete list of confirmed ratchet violations in the component layer.

**P1-001a: NotificationsPanel unread badge**

File: `apps/merchant-control-plane/src/components/NotificationsPanel.tsx`, line 56

Problem: Inline `<span>` badge with `rounded-[var(--lb-radius-full)]` (bracket syntax) and `py-[1px]` (raw pixel value). The `@letbuyy/ui` `Badge` component already handles this pattern.

Evidence:
```tsx
className="... rounded-[var(--lb-radius-full)] ... py-[1px] ..."
```

Fix: Replace inline span with `<Badge variant="default">`. If a notification-count pill shape is needed, add a `count` variant to `Badge` first.

Effort: 1 hour.

Owner: Merchant UI team.

---

**P1-001b: SettingsSearch raw input**

File: `apps/merchant-control-plane/src/components/settings/SettingsSearch.tsx`, line 34

Problem: Raw `<input>` element with a 200+ character Tailwind class string including `rounded-[var(--lb-radius-lg)]` (bracket syntax). The `@letbuyy/ui` `Input` component provides all required behavior.

Evidence:
```tsx
<input className="... rounded-[var(--lb-radius-lg)] ..." />
```

Fix: Replace with `<Input leftIcon={<MaterialIcon name="search" />} placeholder="Search settings..." />`.

Effort: 1 hour.

Owner: Merchant UI team.

---

**P1-001c: BackendNeededPane wrapper**

File: `apps/merchant-control-plane/src/components/settings/BackendNeededPane.tsx`, line 49

Problem: Container wrapper with `rounded-[var(--lb-radius-lg)]` (bracket syntax). The `@letbuyy/ui` `Card` component provides the correct radius token.

Fix: Replace raw wrapper `<div className="... rounded-[var(--lb-radius-lg)] ...">` with `<Card>` or `<Box radius="lg">` from `@letbuyy/ui`.

Effort: 30 minutes.

Owner: Merchant UI team.

---

**P1-001d: EmbeddedAppBridgeClient tab buttons**

File: `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx`, line 239

Problem: Raw tab button elements with `rounded-[var(--lb-radius-lg)]` (bracket syntax). The `@letbuyy/ui` `Tabs` component provides the pill tab pattern.

Fix: Replace raw tab buttons with `<Tabs variant="pills" tabs={[...]} value={selected} onChange={setSelected} />`.

Effort: 2 hours (tab state wiring).

Owner: Merchant UI team / App Platform team.

---

**P1-001e: ProviderModeBadge raw pixel padding**

File: `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx`, line 19

Problem: `py-[2px]` raw pixel value — a ratchet violation.

Fix: Replace `py-[2px]` with a token-scaled value. If `--lb-space-half` (2px) is not in the token set, use 0 padding and rely on minimum height from a density token, or migrate to `<Badge>` with `live`/`test` tone variants.

Effort: 30 minutes.

Owner: Merchant UI team.

---

**P1-001f: AdminShell sidebar non-standard token reference**

File: `apps/merchant-control-plane/src/components/AdminShell.tsx`, lines 128–130

Problem: `rounded-tl-[var(--sidebar-panel-radius)]` uses bracket syntax with a non-canonical token name (`--sidebar-panel-radius` rather than `--lb-radius-*`).

Fix: Replace with `rounded-tl-[var(--lb-radius-lg)]` — or better, remove the arbitrary bracket and add a `rounded-tl-lg` Tailwind utility once the `lg` radius token is registered in the Tailwind bridge.

Effort: 30 minutes.

Owner: Merchant UI team.

---

**P1-002: Four divergent dark backgrounds — non-canonical apps must migrate to `var(--lb-color-bg)`**

Files: `apps/platform-console/src/app/globals.css`, `apps/app-marketplace/src/app/globals.css` (frozen), `apps/theme-marketplace/src/app/globals.css` (frozen)

Problem: Four distinct dark background values exist across apps. Only the canonical `rgb(10 9 18)` (`ink-950`, via `var(--lb-color-bg)` in dark mode) is correct. Platform-console's `rgb(10 10 10)`, app-marketplace's `rgb(10 15 26)`, and theme-marketplace's `rgb(15 15 26)` diverge imperceptibly in isolation but cumulatively across a multi-surface user session.

Evidence: The canonical value: `--lb-color-bg` dark = `#0a0912` = `rgb(10 9 18)`. Platform-console globals.css hardcodes `rgb(10 10 10)` rather than referencing the token.

Impact: Users who move between the merchant dashboard and the platform console see a subtly different black. The frozen apps are not active deployment targets, but platform-console is production.

Fix: In `platform-console/src/app/globals.css` dark mode block, replace the hardcoded background value with `var(--lb-color-bg)`. Frozen apps: note for future context, no immediate action.

Effort: 1 hour (platform-console only; frozen apps: record only).

Owner: Platform Console team.

---

**P1-003: marketing-site uses wrong surface assignment `surface="storefront"`**

File: `apps/marketing-site/src/app/layout.tsx`

Problem: `LetbuyyThemeProvider` in the marketing-site layout uses `surface="storefront"`. The marketing site is the public conversion and brand presence for LetBuyy — it is not a merchant's customer storefront. `storefront` is semantically designated for `storefront-runtime` (the shopper-facing purchase experience).

Evidence (from EXECUTIVE_SUMMARY.md):
> `apps/marketing-site/src/app/layout.tsx` uses `surface="storefront"` — but the marketing site is the public marketing presence for LetBuyy, not a merchant's customer storefront. The `storefront` surface is semantically designated for the shopper-facing `storefront-runtime`. If the platform ever gives the storefront surface its own distinct token values, the marketing site will silently receive those changes.

Impact: Currently zero visual impact because all surfaces produce identical token values. The risk is a latent silent regression: if storefront surface tokens are ever differentiated for shopper-specific aesthetics, the marketing site will silently receive incorrect tokens.

Fix: Either define a `marketing` surface type in `LetbuyySurface` (a 2-hour addition to `packages/typescript/ui/src/tokens.ts`) and update the marketing-site layout, or change the marketing-site to use `surface="admin"` as a stopgap until a dedicated surface is defined.

Effort: 2 hours (new surface definition + layout update).

Owner: Design System team + Marketing team.

---

## 9.3 P2 — Medium Priority (Address This Month)

P2 items cause inconsistency or technical debt accumulation that is not immediately user-visible but compounds over time.

---

**P2-001: identity-platform maintains a parallel CSS custom property system that shadows the token layer**

File: `apps/identity-platform/src/app/globals.css`

Problem: The identity-platform defines its own CSS custom property namespace (`--primary`, `--bg`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-hint`, `--border`, `--input-bg`, `--error`, `--success`, `--warning`). Most of these are hardcoded to raw `rgb()` values in both light and dark mode blocks rather than referencing `--lb-color-*` tokens. The result is two parallel CSS variable systems that must be kept manually in sync.

Evidence:
```css
/* Current (wrong): */
--bg: rgb(250 249 255);
--text-primary: rgb(10 8 22);
--border: rgb(224 216 248);

/* Correct: */
--bg: var(--lb-color-bg);
--text-primary: var(--lb-color-text);
--border: var(--lb-color-border);
```

Impact: If the brand purple changes in `tokens.ts`, the identity-platform's hardcoded purple-tinted border (`rgb(224 216 248)`) will silently diverge from the design system. The 8 alpha-variant purple backgrounds (`rgba(139, 92, 246, 0.1)` on hover/selected states) will also diverge.

Fix: Map each identity-platform alias to the corresponding `--lb-color-*` token. For any color that is genuinely unique to the identity-platform's "Premium Ink Lavender" palette and has no equivalent semantic token, either add a new token to `tokens.ts` or scope the value in a `[data-letbuyy-surface="identity"]` block rather than overriding at `:root`. Estimated 20 variable mappings.

Effort: 4 hours.

Owner: Identity Platform team + Design System team.

---

**P2-002: Flutter dark mode palette mismatch — slate/gray vs ink-lavender**

Files: `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart`, `scripts/generators/generate-mobile-tokens.mjs`

Problem: The Flutter dark mode token mapping does not include the `ink` scale (`ink-800`, `ink-850`, `ink-950`) or `slate-300` that the web dark mode semantic tokens resolve to. Mobile dark mode text subdued renders at a generic gray rather than the `slate-300` blue-gray used on web. The canonical dark background (`#0a0912`, ink-950) has no named Flutter constant.

Impact: Mobile and web dark mode have visually different backgrounds and subdued text colors. A user switching between the mobile merchant app and the web merchant dashboard on a dark OS will notice the inconsistency.

Fix: Add `ink800`, `ink850`, `ink950` and `slate300` as named `Color` constants in `letbuyy_tokens.dart`. Update the dark semantic color assignments to use these constants. Regenerate the Dart file via `generate-mobile-tokens.mjs`. Validate with `validate-mobile-tokens.mjs`.

Effort: 3 hours.

Owner: Mobile team + Design System team.

---

**P2-003: No deployed Storybook — governance documentation is invisible**

Files: `packages/typescript/ui/src/*.stories.tsx`, `governance.stories.tsx`

Problem: `@letbuyy/ui` has Storybook stories for components and governance rules, including `governance.stories.tsx` which documents the ratchet rules and component usage contracts. However, Storybook is not deployed to a public or internal URL. Engineers cannot browse the living component library without running Storybook locally.

Impact: Component discovery friction — engineers do not know what `@letbuyy/ui` provides and build new components from scratch instead of using existing ones. The 7 confirmed component duplications in Section 9.4 are partly attributable to this. Design-system adoption requires discoverability.

Fix: Add a Storybook deployment to the CI/CD pipeline. Deploy to an internal URL (e.g., `storybook.letbuyy.com` behind VPN or `storybook.letbuyy.internal`). Integrate Chromatic or a self-hosted static deployment via GitHub Actions on merges to main.

Effort: 1 day (deployment setup).

Owner: Design System team.

---

**P2-004: No Figma integration — design tokens are not synchronized to design tooling**

Problem: `tokens.ts` is the source of truth for all design decisions, but the token values are not synchronized to Figma variables. Designers working in Figma reference independent color and spacing values that may drift from the implemented token system. Token changes in `tokens.ts` are not automatically reflected in the design file.

Impact: Design handoff includes values that are not in the token system (or specify deprecated token names). Engineers must manually reconcile design file values with implemented tokens. This is a process-level inefficiency that compounds for every new feature.

Fix: Integrate a token-to-Figma sync (Figma Variables API or a tool such as Token Studio / Style Dictionary). The DTCG `tokens.json` file is the correct input format for most Figma sync pipelines. Run the sync as a CI step on changes to `tokens.ts`.

Effort: 2 days (initial setup + Figma library publication).

Owner: Design System team + Design team.

---

**P2-005: Missing `marketing` surface type in the token system**

Files: `packages/typescript/ui/src/tokens.ts`, `apps/marketing-site/src/app/layout.tsx`

Problem: The `LetbuyySurface` union type does not include a `marketing` variant. The marketing site should use a dedicated surface, not `storefront`. (See also P1-003 — this P2 item is the token-system fix; P1-003 is the app-level incorrect assignment.)

Fix: Add `"marketing"` to `LetbuyySurface`, add an entry to `letbuyySurfaceNames`, and populate `letbuyySurfaceTokens["marketing"]` with the marketing-site's premium token vocabulary. This establishes the surface as a formal token scope rather than a bespoke globals.css layer.

Effort: 2 hours.

Owner: Design System team.

---

**P2-006: `--lb-color-border-subtle` is a deprecated alias that resolves to unset/transparent**

Files: `apps/merchant-control-plane/src/app/[store]/products/collections/page.tsx`, `packages/typescript/ui/src/tokens.ts`

Problem: `--lb-color-border-subtle` is listed in `deprecatedTokenAliasVariables` in `tokens.ts`. The deprecated token deletion mechanism actively removes it from the emitted CSS. Any component using `divide-[var(--lb-color-border-subtle)]` receives an unset CSS variable, which resolves to `transparent`. The divider between collection list items is invisible.

Evidence:
```tsx
// In collections/page.tsx:
className="divide-[var(--lb-color-border-subtle)]"
// --lb-color-border-subtle is deleted from emitted CSS.
// Resolves to: divide-[transparent] — invisible divider.
```

Canonical replacement: `--lb-color-border` (the default border token) or `--lb-color-border-strong` (emphasis variant).

Fix: Replace `divide-[var(--lb-color-border-subtle)]` with `divide-[var(--lb-color-border)]`. Audit the entire codebase for any other remaining reference to `--lb-color-border-subtle`.

Effort: 30 minutes.

Owner: Merchant UI team.

---

## 9.4 P3 — Low Priority (Backlog)

P3 items are technical debt that does not cause immediate user-visible issues but represents an accumulating maintenance burden.

---

**P3-001: 127 legacy arbitrary border-radius instances in merchant-control-plane**

Files: Throughout `apps/merchant-control-plane/src/`

Problem: The ratchet baseline records 327 `tsxArbitraryRadius` violations across all apps. The largest contributor is merchant-control-plane, with approximately 127 instances of `rounded-[...]` arbitrary bracket syntax. Each instance is a ratchet-frozen violation that cannot increase but also cannot be auto-fixed.

Impact: Each `rounded-[8px]` or `rounded-[12px]` is a hardcoded pixel value instead of a radius token (`rounded-md` = `--lb-radius-md` = 8px, `rounded-lg` = `--lb-radius-lg` = 12px). If the radius scale is ever updated, these instances will not automatically update.

Fix: Incremental migration. `rounded-[8px]` → `rounded-md`, `rounded-[12px]` → `rounded-lg`, `rounded-[4px]` → `rounded-sm`, `rounded-[16px]` → `rounded-xl`. A codemod (`tsxArbitraryRadius-to-token.cjs`) can handle the common 4/8/12/16px cases. The ratchet's `ratchetPerWavePercent: 10` setting suggests targeting 33 instances per sprint wave (10% reduction per quarter).

Effort: 2 days (codemod development + manual review).

Owner: Merchant UI team.

---

**P3-002: Missing canonical icon size vocabulary**

Files: All three apps — merchant-control-plane, identity-platform, marketing-site

Problem: 14 distinct icon size values are in active use across 24 audited files: 10, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 28, 32, 34. No canonical icon size set is defined in `@letbuyy/ui` governance or enforced by ESLint.

Evidence from CONSISTENCY_SCORECARD.md:
- `merchant-control-plane`: `MaterialIcon` at sizes 10, 13, 15, 16, 17, 32
- `identity-platform`: `AuthIcon` at sizes 14, 16, 18, 20, 22, 28
- `marketing-site`: lucide icons at sizes 14, 15, 16, 17, 19, 24, 32, 34

Impact: Visual inconsistency in icon weight and optical alignment across UI surfaces. The 10px `MaterialIcon` in dashboard metric labels is below the visual floor for readability and is not rendered at a canonical weight.

Fix: Define the canonical icon size vocabulary as five named tiers: `xs=12`, `sm=16`, `md=20`, `lg=24`, `xl=32`. Document in `governance.stories.tsx`. Add an ESLint rule flagging icon `size` props outside this set. Migrate all non-canonical sizes (10, 13, 14, 15, 17, 18, 19, 22, 28, 34) to the nearest canonical tier.

Effort: 1 day (vocabulary definition + migration guide). Full codebase migration: 2 days additional.

Owner: Design System team.

---

**P3-003: Missing fluid font scaling**

Files: `packages/typescript/ui/src/tokens.ts`

Problem: The `--lb-font-size-*` token set defines fixed pixel sizes at each scale step (caption=12px, body=14px, ui=14px, subheading=16px, heading=20px, display=24px, hero=32px). No fluid scaling mechanism (CSS `clamp()` or viewport-relative scaling) is implemented. On the 360px minimum viewport, `hero=32px` consumes nearly the full width for a single word.

Impact: Marketing site and storefront hero text does not scale smoothly between mobile and desktop. Merchant dashboard headings are fixed regardless of viewport.

Fix: Define a `--lb-font-size-<step>-fluid` companion set using CSS `clamp()` (e.g., `clamp(20px, 4vw, 32px)` for the display step). Apply fluid sizing to the marketing site's and storefront's display-scale tokens. Admin UI does not need fluid scaling.

Effort: 4 hours.

Owner: Design System team.

---

**P3-004: Missing `BottomSheet` component in `@letbuyy/ui`**

Files: `apps/merchant-control-plane/src/components/HeaderBar.tsx`, `apps/storefront-runtime/src/app/account/account-bottom-sheet.tsx`

Problem: The mobile bottom-sheet pattern (backdrop overlay + slide-up panel + drag handle) appears independently in at least two apps. The merchant app's HeaderBar uses it for the store-switcher and notifications panel on mobile. Storefront-runtime has its own implementation for the account section. `@letbuyy/ui` has no `BottomSheet` or `ActionSheet` component.

Impact: Divergent implementations will produce different animation, accessibility, and touch behavior. When a third surface needs a bottom-sheet, a third implementation will be written.

Fix: Promote the `MobileBottomSheet` pattern from `HeaderBar.tsx` to a `BottomSheet` component in `@letbuyy/ui`. Accept `isOpen`, `onClose`, `children`, and `title` props. Implement with CSS-based drag handle and `framer-motion` slide-up animation. Replace both existing implementations.

Effort: 2 days.

Owner: Design System team.

---

**P3-005: Missing `AccountSwitcher` component in `@letbuyy/ui`**

File: `apps/merchant-control-plane/src/components/HeaderBar.tsx`

Problem: The store-switcher pill + dropdown + mobile bottom-sheet is an application-shell navigation primitive implemented entirely within `HeaderBar.tsx`. If `platform-console` or any future surface needs multi-context switching, this pattern will be duplicated.

Impact: The store-switcher is the primary navigation affordance for multi-store merchants. Its behavior (store selection, active state, avatar display) should be governed by the design system, not per-app.

Fix: Promote the store-switcher pattern to an `AccountSwitcher` component in `@letbuyy/ui` with `items`, `current`, `onSelect`, and optional `footer` slot. The mobile variant should use the `BottomSheet` component (P3-004).

Effort: 2 days.

Owner: Design System team.

---

**P3-006: CommandPalette async entity search gap**

Files: `apps/merchant-control-plane/src/components/CommandPalette.tsx`, `packages/typescript/ui/src/productivity.tsx`

Problem: The design system's `CommandPalette` does not support async entity search. The merchant app's `CommandPalette.tsx` was extended (rather than composed) to add live product/order/customer search via API, search category chip filters, and section grouping. The two implementations will diverge on keyboard navigation behavior, loading state handling, and search result rendering.

Impact: Any future surface that needs a full-featured command palette with live search (platform-console, developer portal rebuild) will either duplicate the merchant app's extension or use the design system's less capable version.

Fix: Add an `onSearch` async callback and `categories` prop to the design system `CommandPalette`. The merchant app's extended implementation becomes a consumer of the upgraded DS component. The live search, category chips, and section grouping become DS capabilities, not app-level extensions.

Effort: 3 days.

Owner: Design System team + Merchant UI team.

---

## 9.5 Consistency Scorecard

Scores are 0–10 across five dimensions: Token Adoption (color, spacing, radius, typography via `--lb-*`), Component Usage (`@letbuyy/ui` structural and interactive components vs raw HTML), Locale Standards (INR `₹`, `formatInrCurrency`, `en-IN` dates), Layout Consistency (mobile-first, spacing scale, no raw pixel bypass), Typography Compliance (font sizes, weights, line heights within the canonical `--lb-font-*` scale).

### merchant-control-plane

| File | Token Adoption | Component Usage | Locale Standards | Layout Consistency | Typography Compliance | Total / 50 |
|---|---|---|---|---|---|---|
| dashboard/DashboardClient.tsx | 7 | 9 | 10 | 7 | 5 | **38** |
| products/page.tsx | 9 | 9 | 10 | 8 | 9 | **45** |
| customers/page.tsx | 10 | 10 | 10 | 10 | 10 | **50** |
| coupons/page.tsx | 7 | 5 | 3 | 8 | 8 | **31** |
| reviews/page.tsx | 9 | 9 | 10 | 9 | 9 | **46** |
| settings/billing/page.tsx | 4 | 6 | 10 | 4 | 6 | **30** |
| products/collections/page.tsx | 8 | 9 | 10 | 8 | 9 | **44** |
| products/inventory/page.tsx | 9 | 9 | 10 | 8 | 9 | **45** |
| products/purchase-orders/page.tsx | 10 | 10 | 10 | 10 | 10 | **50** |
| themes/.../editor/page.tsx | 2 | 2 | 10 | 3 | 4 | **21** |
| **merchant-control-plane AVG** | **7.5** | **7.8** | **9.3** | **7.5** | **7.9** | **40.0 / 50** |

**Benchmark files:** `customers/page.tsx` and `products/purchase-orders/page.tsx` score 50/50. These are the canonical implementation patterns for merchant data pages.

**Lowest files:** The theme editor (`21/50`) scores low across all dimensions due to its intentional isolation from the standard merchant layout — the critical fix is replacing direct `lucide-react` imports (P0-002). The billing page (`30/50`) and coupons page (`31/50`) score low due to private CSS namespaces and locale violations.

### identity-platform

| File | Token Adoption | Component Usage | Locale Standards | Layout Consistency | Typography Compliance | Total |
|---|---|---|---|---|---|---|
| globals.css | 4 | N/A | 9 | 3 | 5 | **21 / 40** |
| onboarding/page.tsx | 5 | 7 | 10 | 5 | 8 | **35 / 50** |
| lib/config/urls.ts | N/A | N/A | N/A | N/A | N/A | N/A |
| **identity-platform AVG** | **4.5** | **7.0** | **9.5** | **4.0** | **6.5** | **28.0** |

Identity-platform's low token adoption (4.5) and layout consistency (4.0) reflect its parallel CSS custom property system. The surface/text/border values are hardcoded as raw `rgb()` rather than `--lb-color-*` references. This is the target of P2-001.

### marketing-site

| File | Token Adoption | Component Usage | Locale Standards | Layout Consistency | Typography Compliance | Total |
|---|---|---|---|---|---|---|
| globals.css | 4 | N/A | 10 | 3 | 7 | **24 / 40** |
| page.tsx | 10 | N/A | 10 | 10 | 10 | **50** |
| Hero.tsx | 8 | 9 | 10 | 8 | 9 | **44** |
| Header.tsx | 7 | 9 | 10 | 7 | 9 | **42** |
| Features.tsx | 5 | 8 | 10 | 6 | 8 | **37** |
| Pricing.tsx | 8 | 9 | 10 | 8 | 9 | **44** |
| Footer.tsx | 9 | 10 | 10 | 9 | 10 | **48** |
| **marketing-site AVG** | **7.3** | **9.0** | **10.0** | **7.3** | **8.9** | **41.3** |

Marketing-site's perfect 10.0 locale standards score reflects correct `₹` usage throughout (notably in Pricing.tsx with `₹${price.toLocaleString('en-IN')}`). The globals.css drags the token adoption average to 7.3; the JSX component layer scores 8.0 on average. `Footer.tsx` (48/50) is the benchmark for marketing-site component files.

### Platform-Wide Summary

| App | Token Adoption | Component Usage | Locale Standards | Layout Consistency | Typography | Avg Score / 10 |
|---|---|---|---|---|---|---|
| merchant-control-plane | 7.5 | 7.8 | 9.3 | 7.5 | 7.9 | **8.0** |
| identity-platform | 4.5 | 7.0 | 9.5 | 4.0 | 6.5 | **6.3** |
| marketing-site | 7.3 | 9.0 | 10.0 | 7.3 | 8.9 | **8.5** |
| **Platform average** | **6.8** | **7.9** | **9.6** | **6.6** | **7.8** | **7.6 / 10** |

**Platform interpretation:**

- Locale Standards (9.6) is the strongest dimension — the `₹` symbol and `formatInrCurrency` are well-established conventions. The single P0-001 violation (coupons `Rs.`) is the only outlier.
- Layout Consistency (6.6) is the weakest dimension — raw pixel spacing, arbitrary bracket values, and private CSS class namespaces in billing and theme editor pages pull this number down.
- The identity-platform (6.3) is the single largest drag on platform averages. Migrating its parallel CSS variable system to `--lb-*` references (P2-001) would raise the platform average to approximately 7.9.

---

## 9.6 Debt Trend Rules

These rules govern how the design debt register and ratchet baseline evolve over time. They are operational contracts, not suggestions.

**Rule 1: The ratchet count cannot increase.**

`scripts/validators/design-system-baseline.json` records the authoritative violation counts for seven ratchet metric categories. Any pull request that causes any count to increase fails the CI gate and cannot be merged. This rule is enforced by the 107-validator gate. There are no exceptions and no bypass flags.

The current baseline (as of 2026-06-12):

| Metric | Baseline count | Description |
|---|---|---|
| `appCssRawHex` | 0 | Raw hex values in `.css` files |
| `appCssNakedRgbHsl` | 572 | Raw `rgb()`/`hsl()` in `.css` files |
| `tailwindPaletteClasses` | 588 | Tailwind default palette classes (`bg-gray-*`, `text-white`, etc.) in TSX |
| `appLocalLbTokenRedefs` | 112 | App CSS files re-declaring `--lb-*` variables |
| `rawPxFontSize` | 533 | Raw `px` font sizes |
| `rawPxSpacing` | 1,365 | Raw `px` spacing values |
| `tsxInlineStyles` | 635 (cap) | Inline `style={{}}` in TSX |
| `tsxRawHex` | 0 | Raw hex colors in TSX |
| `tsxArbitraryRadius` | 327 | `rounded-[...]` Tailwind arbitrary radius |
| `tsxArbitraryShadow` | 8 | `shadow-[...]` Tailwind arbitrary shadow |
| `localWorkspaceImplementations` | 0 | Duplicate workspace implementations |

Note: `apps/marketing-site` is excluded from the ratchet scope by design — it has bespoke marketing design requirements and is not held to the same token compliance standard as operational UIs.

**Rule 2: Every PR introducing a violation is blocked at CI.**

The ratchet enforcement is automatic and immediate. Engineers receive a CI failure message identifying which count increased and by how much. The only path to merge is to fix the violation in the same PR. Pre-commit hooks also run the ratchet check to surface violations before the PR is even opened.

**Rule 3: Every sprint includes a minimum of two debt reduction items.**

Passive ratchet enforcement (keeping counts stable) is necessary but not sufficient. Without active reduction, the 1,365 raw pixel spacing violations will remain for years. Each sprint's backlog must include at least two debt reduction tasks selected from the P3 register or from the ratchet-reducing backlog (guided by `ratchetPerWavePercent: 10` — a 10% reduction target per quarterly wave).

At the current wave rate:
- `rawPxSpacing` (1,365): full elimination in approximately 7 quarterly waves (1.75 years)
- `tailwindPaletteClasses` (588): full elimination in approximately 4 quarterly waves (1 year)
- `tsxArbitraryRadius` (327): full elimination in approximately 3 quarterly waves (9 months)
- `appCssNakedRgbHsl` (572): full elimination in approximately 4 quarterly waves (1 year)

These projections assume the 10% wave target is met consistently. Codemods for the high-confidence mechanical replacements (gray neutrals → semantic tokens, `rounded-[8px]` → `rounded-md`) can compress the timeline significantly for those categories.
