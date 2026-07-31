# LetBuyy Theme Architecture

**Generated:** 2026-06-19
**Sources read:** `packages/typescript/ui/src/{tokens.ts,theme-provider.tsx,theme-toggle-button.tsx,token-style-boundary.tsx,design-system-root.tsx}`, `config/tailwind/letbuyy-tokens.css`, `packages/theme-engine/src/{theme-registry.ts,theme-governance.ts,theme-presets.ts,theme-bundle.ts}`, all app `globals.css` files, `docs/design-system/`, `docs/ui-standards/`, `docs/theme-research/09-target-theme-architecture.md`, `scripts/validators/design-system-baseline.json`.

---

## Token Architecture

### CSS Variable Structure

All design tokens are emitted as CSS custom properties under the `--lb-*` namespace, injected by `letbuyyTokenCss` (generated from `tokens.ts` via `DesignSystemRoot`). The complete set is ~300+ variables covering colors, typography, spacing, radius, shadows, z-index, motion, density, and breakpoints.

**Naming convention:**

```
--lb-<category>-<role>[-<variant>]
```

| Prefix pattern | Category | Example |
|---|---|---|
| `--lb-color-*` | Color (semantic + primitive aliases) | `--lb-color-primary`, `--lb-color-bg`, `--lb-color-border` |
| `--lb-primitive-color-*` | Raw primitive palette (private) | `--lb-primitive-color-purple-500` |
| `--lb-semantic-*` | Semantic role group | `--lb-semantic-accent-brand` |
| `--lb-component-*` | Component-scoped values | `--lb-component-button-primary-bg`, `--lb-component-card-radius` |
| `--lb-density-*` | Density-responsive sizing | `--lb-density-input-height`, `--lb-density-sidebar-row-height` |
| `--lb-font-*` | Typography | `--lb-font-family-body`, `--lb-font-size-body`, `--lb-font-weight-semibold` |
| `--lb-space-*` | Spacing scale | `--lb-space-sm` (8px), `--lb-space-lg` (16px) |
| `--lb-radius-*` | Border radius | `--lb-radius-md` (8px), `--lb-radius-xl` (16px) |
| `--lb-shadow-*` | Shadows | `--lb-shadow-card`, `--lb-shadow-md` |
| `--lb-z-*` | Z-index | `--lb-z-modal` (60), `--lb-z-toast` (70) |
| `--lb-motion-*` | Durations + easing | `--lb-motion-fast` (150ms), `--lb-ease-emphasized` |
| `--lb-bp-*` | Breakpoints | `--lb-bp-xs` (360px), `--lb-bp-lg` (1024px) |
| `--lb-size-*` | Canonical sizes | `--lb-size-page-max` (1440px) |

### Token Tiers (3-layer composition)

Tokens compose in three explicit tiers, defined in `tokens.ts`:

```
letbuyyPrimitiveTokens          (raw palette — PRIVATE, never reference in product code)
         ↓
letbuyySemanticTokens[light|dark]  (public role aliases: bg, surface, text, border, accent, status…)
         ↓
letbuyyComponentTokens[light|dark] (per-component values: button, card, sidebar, input, table, badge, banner…)
```

Density tokens (`letbuyyDensityTokens`) sit alongside this stack and feed the `--lb-density-*` variables. They are not theme-aware (no light/dark split) — they are purely spatial.

**Primitive examples:** `purple.500 = #8B5CF6`, `gray.900 = #111827`, `ink.950 = #0a0912` (the canonical dark mode deep background)

**Semantic examples:**
- Light: `background.page = gray.125`, `text.primary = gray.900`, `border.default = gray.200`
- Dark: `background.page = ink.950`, `text.primary = white`, `border.default = rgba(139,92,246,0.18)` (purple-tinted)

**Component examples:**
- `component.light.button.primary.bg = purple.700`, `component.dark.sidebar.activeBg = rgb(139 92 246 / 16%)`

### Tailwind Mapping

`config/tailwind/letbuyy-tokens.css` is a Tailwind v4 `@theme` block that maps `--lb-color-*` variables to named Tailwind color utilities:

| Tailwind class | Maps to | Token |
|---|---|---|
| `bg-surface` | `--lb-color-surface` | White (light) / ink-850 (dark) |
| `bg-surface-subdued` | `--lb-color-surface-subdued` | gray-50 / ink-950 |
| `bg-card` | `--lb-color-card` | White / ink-800 |
| `bg-page` | `--lb-color-bg` | gray-125 / ink-950 |
| `text-default` | `--lb-color-text` | gray-900 / white |
| `text-subdued` | `--lb-color-text-subdued` | gray-500 / slate-300 |
| `border-line` | `--lb-color-border` | gray-200 / purple-18% |
| `text-primary` | `--lb-color-primary` | purple-500 |

Migration intent: `bg-white` → `bg-surface`, `text-gray-900` → `text-default`, `border-gray-200` → `border-line`.

Breakpoints are also registered: `xs:` (360px), `mobile:` (480px), `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px).

---

## Theme Provider Architecture

### How LetbuyyThemeProvider Works

`LetbuyyThemeProvider` (`packages/typescript/ui/src/theme-provider.tsx`) is the single canonical theme controller. It replaced five previously incompatible per-app implementations (documented in THEME_ARCHITECTURE_AUDIT.md THEME-2 and LIGHT_DARK_MODE_AUDIT.md LDM-1/2/3).

**Internal state machine:**

1. On mount, reads `localStorage["letbuyy-theme"]` → validates as `"light" | "dark" | "system"` → falls back to `defaultTheme` prop.
2. Resolves `"system"` against `window.matchMedia("(prefers-color-scheme: dark)")`.
3. Applies DOM signals via `applyDomSignals(resolved)`:
   - Sets `<html data-theme="light|dark">`
   - Adds `.light` or `.dark` class to `<html>`
   - Sets `html.style.colorScheme = resolved`
   - Caches resolved value on `window.__letbuyyResolvedTheme`
4. Listens for OS theme changes when `theme === "system"`.
5. Internally renders `<DesignSystemRoot surface={surface} theme={resolvedTheme} density={density} brand={brand}>` — passing the **resolved** theme, never `"auto"`. This prevents the prior `theme="auto"` override conflict.

**Props:**

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `defaultTheme` | `"light" \| "dark" \| "system"` | `"system"` | Initial theme if nothing is persisted |
| `storageKey` | `string` | `"letbuyy-theme"` | localStorage key (do not override) |
| `surface` | `LetbuyySurface` | `"admin"` | Scopes component variable set |
| `density` | `LetbuyyDensity` | `"compact"` | Sizing tier |
| `brand` | `LetbuyyBrandInput` | undefined | Per-tenant primary color override |

**Surfaces:** `admin | marketplace | storefront | identity | operations`. Each surface has its own `letbuyySurfaceTokens` CSS variable set, scoped via `data-letbuyy-surface` attribute on the `DesignSystemRoot` div.

### Flash Prevention: ThemeScript

`<ThemeScript>` renders a blocking inline `<script>` in `<head>` that:
1. Reads `localStorage["letbuyy-theme"]`
2. Resolves against OS preference
3. Sets `<html data-theme>` + `.dark` class + `colorScheme`
4. Caches on `window.__letbuyyResolvedTheme`

This runs before first paint. The hydrating provider reads the cached value from `window.__letbuyyResolvedTheme`, avoiding hydration mismatch and flash.

### Which Apps Use LetbuyyThemeProvider

| App | Surface | Default Theme | Notes |
|---|---|---|---|
| `merchant-control-plane` | `"admin"` | `"system"` | `layout.tsx` wraps with `LetbuyyThemeProvider surface="admin"` |
| `identity-platform` | not yet using canonical provider | `"system"` | Still uses custom `.dark` CSS class toggle; `docs/design-system/dark-mode.md` calls this a debt item |
| `marketing-site` | unknown | `"system"` | Custom token variables in `globals.css`, not fully on canonical provider |
| `storefront-runtime` | `"storefront"` | per-theme | Liquid rendering bypasses the React theme system entirely |
| `platform-console` | `"operations"` | `"dark"` (planned) | Currently uses `prefers-color-scheme` media query in CSS |

### ThemeToggleButton

`ThemeToggleButton` (`src/theme-toggle-button.tsx`) is a ready-made control that:
- Reads `useTheme()` → `{ resolvedTheme, setTheme, theme }`
- On click, toggles between `"light"` and `"dark"` (skipping `"system"`)
- Shows `Sun` / `Moon` / `Monitor` icon depending on current state
- Exported from `@letbuyy/ui` for use anywhere

---

## Token Style Boundary

### What Is TokenStyleBoundary

`TokenStyleBoundary` (`src/token-style-boundary.tsx`) solves the problem of token CSS being injected multiple times when `DesignSystemRoot` is nested.

It uses a React context (`TokenStyleContext`) to track whether an ancestor has already injected the token CSS:

```tsx
const hasInheritedTokenStyles = React.useContext(TokenStyleContext);
const shouldRenderTokenStyles = includeTokenStyles && !hasInheritedTokenStyles;
// Injects <style data-letbuyy-token-source="true"> ONLY when no ancestor has done so
```

**Practical effect:** When `DesignSystemRoot` (and by extension `LetbuyyThemeProvider`) renders a `<style>` tag with all `--lb-*` CSS variables, any nested `DesignSystemRoot` (e.g. in Storybook, a preview iframe, or an embedded component) will detect the ancestor injection and skip re-injecting — preventing duplicate style blocks.

### What It Prevents

- Duplicate CSS variable injection in nested design system roots
- Token override fights when one `DesignSystemRoot` is inside another
- Performance cost of redundant style injection

---

## App-Level Theming

### merchant-control-plane

**File:** `apps/merchant-control-plane/src/app/globals.css` (13,630 lines)

- Imports `@import "tailwindcss"` and `@import "letbuyy-tokens.css"` at the top.
- Defines an extensive set of **app-local aliases** in `:root` that map to `--lb-color-*` tokens: `--primary: var(--lb-color-primary)`, `--bg: rgb(250 249 255)`, `--text-primary`, `--border`, `--sidebar-bg`, etc.
- Has `.dark` class overrides for all local aliases — full dark mode support.
- **Overrides `--lb-component-sidebar-*` tokens** directly to wire the app's sidebar styles into the design system component layer.
- Contains **no token additions** (no new semantic categories) — it aliases, overrides, and extends.
- Font stack: Geist Sans (variable `--font-letbuyy-sans`) via `localFont` in `layout.tsx`.
- Dark mode: fully supported via `LetbuyyThemeProvider` + `.dark` class. The LCIS dark palette (ink-950 series) is used.
- Header is inverted: **dark on light**, **light on dark** — controlled via `--header-bg` aliases.

### identity-platform

**File:** `apps/identity-platform/src/app/globals.css` (~2,343 lines)

- Imports `tailwindcss` + `letbuyy-tokens.css`.
- Has its own `:root` color vocabulary: `--bg`, `--bg-secondary`, `--text-primary`, `--primary`, etc., mapping most to `--lb-color-*` for the brand colors but using literal `rgb()` values for surfaces/text.
- `.dark` class override block present — full dark mode support.
- Does NOT use `LetbuyyThemeProvider` via `layout.tsx` yet (still uses a custom theme toggle on the auth UI).
- Custom auth design system: `.auth-*` and `.onboard-*` class namespaces, mobile-first, ~360px target.
- Font: Geist Sans fallback chain; no explicit `LetbuyyThemeProvider` wrapping in `layout.tsx`.
- Purple `--primary` resolves through `var(--lb-color-primary)` correctly.

### marketing-site

**File:** `apps/marketing-site/src/app/globals.css`

- Imports `tailwindcss` + `letbuyy-tokens.css`.
- `:root` and `[data-theme="light"]` blocks define premium marketing tokens (`--bg-deep`, `--bg-elevated`, `--text-primary`, `--border-subtle`, `--gradient-primary`, `--glass-bg`, etc.).
- `[data-theme="dark"]` block: full dark mode token set, matching the `lb-color-*` dark palette values.
- Has marketing-specific tokens not in the design system: `--gradient-primary`, `--gradient-dark`, `--gradient-radial`, `--glass-bg`, `--shadow-glow`, `--ease-smooth`, `--ease-bounce`.
- No canonical `LetbuyyThemeProvider` wrapper — uses `data-theme` attribute directly.
- Font stack: Geist Sans + Geist Display.

### platform-console

**File:** `apps/platform-console/src/app/globals.css`

- Imports `tailwindcss` + `letbuyy-tokens.css`.
- Slim `:root` block with system font stack and hardcoded `--lb-color-primary` values (manually setting what the token system would normally inject).
- Dark mode via `@media (prefers-color-scheme: dark)` — **not** via `.dark` class; does not use `LetbuyyThemeProvider` yet.
- No custom token additions beyond the minimal palette pins.
- Leanest globals.css of all apps.

### storefront-runtime

**File:** `apps/storefront-runtime/src/app/globals.css`

- Imports `tailwindcss` + `letbuyy-tokens.css`.
- Defines a separate Tailwind `@theme` block with `--color-primary`, `--color-secondary`, font-display, radius, and animations — independently of the admin token set.
- Has merchant-facing font stack aliases: `--font-inter`, `--font-outfit`, `--font-poppins`, `--font-lora`, `--font-playfair`, etc. — all resolved through `var(--font-letbuyy-*)` fallback chains.
- Default brand colors: `--primary: rgb(99 102 241)` (indigo), `--secondary: rgb(139 92 246)` (purple) — different from the admin purple default.
- No dark mode CSS block — dark mode for storefronts is not implemented in the current React rendering path. The Liquid theme engine handles theming per-merchant.

---

## Tenant Customization (Storefront)

### How Merchant Store Themes Are Customized

The storefront uses a completely separate theming system from the admin `--lb-*` token system. It operates at three layers:

**Layer 1: Theme Engine Settings Schema (`packages/theme-engine/src/theme-registry.ts`)**

`THEME_SETTINGS_SCHEMA` defines the settings merchants can edit:
- **Colors:** `primaryColor`, `secondaryColor`, `accentColor`, `backgroundColor`, `textColor`
- **Typography:** `fontFamily` (body), `headingFontFamily` — 8 font choices
- **Layout:** `borderRadius` (0–24px), `enableAnimations`, `enableShadows`
- **Header:** `behavior`, `logoPlacement`, `displayMode`, `showSearch`, `showCart`
- **Footer:** `columns`, `showNewsletter`, `showSocial`, `showPaymentIcons`

These are stored as `settings_data.current` in the DB and flow through the `getDefaultStorefrontThemeTemplate()` function which produces a `StorefrontThemeTemplateConfig`.

**Layer 2: Section Configuration**

Each storefront section (heroBanner, productGrid, footer, etc.) has its own `SectionSchema` with `settings_schema` fields. Merchants configure sections via the WYSIWYG editor. Section-level settings include layout, content, and for some sections, raw `color` type fields (e.g. `announcementBar.settings_schema.backgroundColor`).

**Layer 3: Experience Preset System (`packages/theme-engine/src/theme-presets.ts`)**

The preset engine defines `ExperienceTokensSchema` — a flat design-token overlay:
```typescript
{
  primaryColor, secondaryColor, accentColor, backgroundColor, textColor, surfaceColor,
  fontFamily, headingFontFamily, borderRadius
}
```

10 named Experiences (Forge, Sense, Craft, Refresh, Summit, etc.) are registered, each with validated hex colors, font stacks, and border radius settings. These map into `settings_data.current` tokens.

**What Token Variables Are Exposed to Merchants**

The merchant-editable tokens are:
- `primaryColor` → CSS `--primary`
- `secondaryColor` → CSS `--secondary`
- `accentColor` → CSS `--accent`
- `backgroundColor` → CSS `--background`
- `textColor` → CSS `--foreground`
- `fontFamily` / `headingFontFamily` → CSS `--font-body` / `--font-display`
- `borderRadius` → CSS `--radius`

These are applied at the storefront `:root` level and do **not** interact with the `--lb-*` token system.

### Theme Engine Package Structure

`packages/theme-engine/src/` contains:
- `theme-bundle.ts` — Bundle schema (JSON-contract and Liquid paths), hydration island registry (`LIQUID_HYDRATION_ISLANDS`)
- `theme-registry.ts` — Section schemas, block schemas, `THEME_SETTINGS_SCHEMA`, `getDefaultStorefrontThemeTemplate()`
- `theme-governance.ts` — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`, Liquid rendering decision logic, section parity registry, renderer audit
- `theme-presets.ts` — Experience preset engine with Zod validation
- `theme-renderer.ts` — Runtime rendering logic
- `theme-bundle-core.ts` — Urban Kicks core bundle reference

### Liquid Theme Token System

Liquid themes use `config/settings_data.json` to store resolved token values. The Liquid engine reads these at render time and injects them into the layout template. The `Urban Kicks` bundle is the first-class Liquid theme:

- Bundle path: `layout/theme.liquid`, `config/settings_schema.json`, `config/settings_data.json`, `sections/*.liquid`
- Token injection: `settings_data.current.primaryColor` → `:root { --primary: {{ settings.primaryColor }}; }`
- 9 hydration islands for interactive commerce (add-to-cart, cart-drawer, search, variant-picker, review-form, wishlist-toggle, cart, customer-settings, address-manager) implemented as custom elements (`lb-*`)

**Rendering Decision:**

Liquid rendering is controlled by `resolveThemeLiquidRenderingEnabled()` which checks (in priority order):
1. `templateConfig.rendererEngine === 'liquid'` (explicit engine field — the Phase 9 production activation switch)
2. `releaseManifest.renderer_engine === 'liquid'`
3. `liquidRenderingCanary` in templateConfig or themeSettings or releaseManifest
4. Default: `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`

Currently **Liquid is OFF by default**. A platform-wide flip requires ARB approval (`THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'`).

---

## Dark Mode

### Is Dark Mode Supported?

Yes — dark mode is fully supported in the design system and partially implemented across apps.

### Implementation Mechanism

Dark mode uses a **dual-signal DOM approach**:

1. **`data-theme` attribute on `<html>`:** `<html data-theme="dark">` — the primary signal for CSS
2. **`.dark` class on `<html>`:** `<html class="dark">` — compatibility signal for apps using Tailwind's `darkMode: 'class'`
3. **`color-scheme` CSS property:** `html.style.colorScheme = "dark"` — OS-level hint

`letbuyyTokenCss` emits CSS under selectors:
```css
:root, [data-theme="light"], [data-letbuyy-theme="light"] { /* light variables */ }
[data-theme="dark"], [data-letbuyy-theme="dark"], .dark { /* dark variables */ }
@media (prefers-color-scheme: dark) {
  :root, [data-theme="auto"] { /* dark variables */ }
}
```

Flash prevention: `<ThemeScript>` in `<head>` applies the resolved theme before any CSS paint.

### Which Apps Support It?

| App | Dark Mode | Mechanism | Notes |
|---|---|---|---|
| `merchant-control-plane` | Full | `LetbuyyThemeProvider` + `.dark` CSS class overrides | Both light and dark fully styled |
| `identity-platform` | Full | Custom `.dark` class toggle (not via canonical provider) | Auth UI has complete `.dark` overrides |
| `marketing-site` | Full | `[data-theme="dark"]` attribute | Light/dark marketing tokens defined |
| `platform-console` | Partial | `@media (prefers-color-scheme: dark)` only | No manual toggle; system-only |
| `storefront-runtime` | Not implemented (React path) | N/A | Liquid themes are per-merchant; no system dark mode |

### User Toggle

`ThemeToggleButton` is available from `@letbuyy/ui`. The canonical `localStorage["letbuyy-theme"]` key stores `"light" | "dark" | "system"`. No per-app toggle is needed.

---

## Future Scalability Assessment

### White-label Instances

**Can the current system support white-labeling?**

Partially. The `brand` prop on `LetbuyyThemeProvider` accepts a `LetbuyyBrandInput` (a hex color string or a `LetbuyyBrandOverrides` object). When provided, `createLetbuyyBrandVariables()` generates overrides for:
- `--lb-color-primary`, `--lb-color-primary-cta`, `--lb-color-primary-hover`, `--lb-color-primary-active`
- `--lb-color-focus-ring`, `--lb-color-primary-subtle`, `--lb-color-secondary-action`
- All component button/input/badge/empty-state primary variants

WCAG contrast validation (`validateLetbuyyBrandContrast`) is built in, checking primary-text, CTA-text, and focus-ring ratios at minimum 4.5:1 / 3:1.

**Gap:** Only the brand primary color is overridable. Secondary, accent, surface, and typography cannot be overridden per-tenant at the admin layer. White-labeling beyond primary color would require extending `LetbuyyBrandOverrides`.

### Per-Tenant Branding (Storefront)

The storefront theme engine fully supports per-tenant branding. Each store's `settings_data.current` is independent. The `ExperienceTokensSchema` covers 9 token dimensions per experience. This is the correct layer for storefront branding.

**Gap:** The admin UI (`merchant-control-plane`) always uses the platform brand (purple). There is no per-tenant admin skin.

### A/B Testing Design Variants

The `Experience` preset system in `theme-presets.ts` provides validated, composable token overlays — these can serve as the A/B variant units. The `settings_data.presets` contract exists in the bundle schema.

**Gap:** No preset-application action exists in the merchant control plane yet (Phase-2 delivery item). No A/B experiment framework wires experience selection to a cohort assignment.

### New Product Identities

The `surface` prop on `DesignSystemRoot` scopes component tokens to one of 5 surfaces: `admin | marketplace | storefront | identity | operations`. New surfaces can be added by extending `LetbuyySurface`, adding a new entry to `letbuyySurfaceNames`, and populating `letbuyySurfaceTokens`.

**Gap:** Currently all 5 surfaces share the same `surfaceVariables()` function output — there is no per-surface color differentiation beyond the theme (light/dark). Surface tokens today only scope component variables, not brand colors.
