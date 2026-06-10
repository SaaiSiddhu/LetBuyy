# LetBuyy Design System Forensics
**Audit date:** 2026-06-09
**Auditors:** Design System Architect + Staff Frontend Architect
**Method:** grep-backed code forensics — no trust of pre-existing .md reports

---

## 1. Token Source of Truth

### Location & Architecture

The canonical token set lives in a single TypeScript file:

```
packages/typescript/ui/src/tokens.ts  (1,389 lines)
```

It exports a four-layer token hierarchy:

| Layer | Export | Content |
|---|---|---|
| Primitive | `letbuyyPrimitiveTokens` | Raw color ramp: purple/gray/slate/green/amber/red/blue + opacity |
| Semantic | `letbuyySemanticTokens` | Light+dark semantic roles: background, text, border, accent, status, overlay |
| Component | `letbuyyComponentTokens` | Per-component baked values: button, card, sidebar, emptyState, input, table, pageHeader, badge, banner |
| Density | `letbuyyDensityTokens` | 3 density tiers (compact/comfortable/spacious), 23 physical values each |

Supplementary token exports in the same module:
- `letbuyyZIndexTokens` (7 z-levels)
- `letbuyyBreakpointTokens` (6 breakpoints)
- `letbuyyShadowTokens` (5 shadows)
- `letbuyyTokens.typography` (fontSize, lineHeight, fontWeight scales)
- `letbuyyTokens.space` (12-step spacing scale: 0–96px)
- `letbuyyTokens.radius` (sm/md/lg/xl/full)
- `letbuyyTokens.motion` (duration, easing, transform)
- `letbuyyTokens.size` (31 named sizes)

**Total CSS variable names emitted:** 352 occurrences of `'--lb-` across tokens.ts (grep verified).
All share the `--lb-` prefix namespace.

### CSS Variable Emission

Tokens are **not** written to a flat CSS file and committed. They are generated at runtime by:
1. `tokens.ts` → `colorVariables(theme)` → ~70 color `--lb-*` vars
2. `sharedCssVariables` constant → ~130 non-color `--lb-*` vars (font, space, radius, shadow, z, motion, size)
3. `densityVariables(density)` → 23 density `--lb-density-*` vars

The design-token generator script (`scripts/generators/generate-design-tokens.mjs`) generates a CSS artifact for use in non-JS contexts; the web apps consume tokens via the TS module directly.

### Surface Differentiation

Five surfaces are modeled: `admin | marketplace | storefront | identity | operations`
Evidence: `tokens.ts:1113-1123` — `letbuyySurfaceTokens` creates per-surface CSS variable maps for light and dark.

### Mobile Token Bridge

`packages/typescript/ui/src/mobile-tokens.ts` imports from `tokens.ts` (the same primitives) and exports `letbuyyMobileColorTokens` + `letbuyyMobileSpacingTokens`.

`scripts/generators/generate-mobile-tokens.mjs` transpiles that TS module at build time and writes the generated Dart file to:

```
apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart
```

The generated Dart file is confirmed to carry the header:
```
// GENERATED FILE — DO NOT EDIT.
// Source: packages/typescript/ui/src/mobile-tokens.ts
```
(verified: `letbuyy_color_tokens.dart:1`)

---

## 2. @letbuyy/ui Component Library Inventory

Library root: `packages/typescript/ui/src/`
Total TS/TSX files in the UI package: 57 (per recon)

### Component Catalog

| Category | Components |
|---|---|
| **Actions** | `Button` |
| **Forms / Inputs** | `Input`, `Textarea`, `NumberField`, `InlineError`, `Checkbox`, `ChoiceList`, `Combobox`, `Radio`, `Select`, `Switch` |
| **Layout** | `Box`, `BlockStack`, `InlineStack`, `Columns`, `Grid`, `Container`, `Card`, `Section`, `Page`, `PageHeader`, `PageHeaderActions`, `PageContent`, `Text` |
| **Data Display** | `Table` (with bulk-action, filter-chip, saved-view support), `Chart` (line/bar/area), `MetricCard`, `DescriptionList` |
| **Feedback / Status** | `Banner`, `Badge`, `StatusBadge`, `EmptyState`, `EmptyStateIllustration`, `Skeleton`, `ToastProvider`, `useToast`, `SaveBar`, `ProgressBar`, `Spinner` |
| **Overlays** | `Modal`, `Drawer`, `Popover`, `Tooltip`, `ConfirmDialog`, `Dropdown`, `DropdownMenu` |
| **Navigation** | `AppNavigation`, `AppFrame`, `Navigation`, `Sidebar`, `Breadcrumbs`, `Tabs`, `FilterBar`, `FilterChips`, `SegmentedControl` |
| **Productivity** | `CommandPalette`, `Avatar`, `Pagination`, `DensityToggle` |
| **Primitives** | `Accordion`, `DatePicker`, `DateRangePicker`, `Disclosure`, `Divider`, `Chart` |
| **Theme** | `LetbuyyThemeProvider`, `ThemeScript`, `useTheme`, `DesignSystemRoot`, `TokenStyleBoundary` |
| **Icons** | `MaterialIcon` + 100+ Lucide-based named exports (`Button`, `Bell`, `Search`, etc.) |
| **Dev/Preview** | `ColorPreviewBlock`, `ColorPreviewButton`, `ColorSwatch`, `RadiusPreview` |
| **Formatters** | `formatInrCurrency`, `formatDisplayDate`, `formatIndiaDate`, 8 other date/currency helpers |

**Coverage vs Shopify Polaris baseline:**

| Polaris Feature | LetBuyy | Status |
|---|---|---|
| Button (variants) | Button w/ unstyled escape | Present |
| TextInput | Input + Textarea + NumberField | Present |
| Select/Combobox | Select + Combobox | Present |
| Table/IndexTable | Table (full-featured) | Present |
| Card | Card | Present |
| Modal/Sheet | Modal + Drawer + ConfirmDialog | Present |
| Navigation/Sidebar | AppNavigation + Sidebar | Present |
| EmptyState | EmptyState + EmptyStateIllustration | Present |
| Toast | ToastProvider + useToast | Present |
| Badge/Status | Badge + StatusBadge | Present |
| Spinner/Skeleton | Spinner + Skeleton | Present |
| Banner/Callout | Banner | Present |
| Breadcrumbs | Breadcrumbs | Present |
| DatePicker | DatePicker + DateRangePicker | Present |
| CommandPalette | CommandPalette | Present |
| DataViz/Chart | Chart (basic, SVG-native) | Present (limited) |
| Form layout | Section/Page/PageHeader | Present |
| RTE/Rich text | **Missing** | Absent |
| File upload | **Missing** | Absent |
| Data grid (virtual scroll) | **Missing** | Absent |
| Autocomplete (advanced) | Combobox (basic) | Partial |

**Verdict:** ~85% coverage of a first-party admin design system. Notable gaps: rich-text editor, file-upload primitive, virtualized data grid.

---

## 3. App Adoption of @letbuyy/ui + Token System

### @letbuyy/ui Import Coverage (9 web apps)

| App | Imports @letbuyy/ui | Token System via ThemeProvider | AppNavigation shell | Custom nav/shell |
|---|---|---|---|---|
| merchant-control-plane | YES (200+ files) | YES — `LetbuyyThemeProvider surface="admin"` in layout.tsx | NO — custom `Sidebar.tsx` + `AdminShell.tsx` using `@letbuyy/ui` primitives | YES (custom but token-compliant) |
| platform-console | YES (30+ files) | YES — `LetbuyyThemeProvider` | YES — `AppNavigation` from @letbuyy/ui | NO |
| platform-operations-portal | YES (20+ files) | YES — `LetbuyyThemeProvider` | YES — `AppNavigation` from @letbuyy/ui | NO |
| theme-marketplace | YES (50+ files) | YES — `LetbuyyThemeProvider surface="marketplace"` | NO — custom `Navbar` component (token-aware) | YES (custom) |
| app-marketplace | YES (40+ files) | YES — `LetbuyyThemeProvider surface="marketplace"` | NO — custom `Header.tsx` | YES (custom) |
| storefront-runtime | YES (100+ files) | YES — `LetbuyyThemeProvider surface="storefront"` | NO — custom `dynamic-header.tsx` (token-aware, Framer Motion) | YES (custom, expected for storefront) |
| identity-platform | YES (10+ files) | YES — `LetbuyyThemeProvider` | NO — auth-flow pages, no persistent shell | N/A |
| marketing-site | YES (10+ files) | YES — `LetbuyyThemeProvider surface="storefront"` | NO — custom CSS-class nav in globals.css | YES (custom) |
| developer-portal | YES (15+ files) | YES — `LetbuyyThemeProvider surface="marketplace"` | NO — custom `PortalChrome.tsx` | YES (custom) |

**Summary:** 9/9 apps import `@letbuyy/ui`. 9/9 apps use `LetbuyyThemeProvider` as root. 2/9 admin apps use the shared `AppNavigation` shell from @letbuyy/ui. 7/9 apps have custom shells — but these custom shells mostly use `@letbuyy/ui` primitives and CSS variable tokens internally.

### How Tokens Are Consumed

CSS token consumption in apps follows two patterns, both correct:

1. **Tailwind arbitrary-value syntax:** `className="bg-[var(--lb-color-surface)] text-[color:var(--lb-color-text)]"` — dominant pattern in admin/ops apps.
2. **CSS class in globals.css:** `color: var(--lb-color-primary)` — used in marketing-site and storefront-runtime globals.

Evidence that this is intentional: `console-workspace.tsx:16-24` and `ops-workspace.tsx:16-24` both use exclusively `var(--lb-*)` Tailwind arbitrary values with zero hardcoded hex.

---

## 4. Hardcoded Color Violations (grep-verified)

**Hardcoded hex in .tsx files:** 0 occurrences
Pattern `#[0-9a-fA-F]{6}` in *.tsx across all apps — **0 matches** (ESLint `no-hardcoded-hex: error` is enforced and working).

**Hardcoded hex in .css files:** 25 occurrences across 1 file only:
`apps/marketing-site/src/app/globals.css` — 25 instances of `#` hex colors at lines ~4934–5235.
These appear in the marketing-site-specific pricing/features section CSS, isolated to one file.

**Tailwind default-palette class violations in .tsx:** 14 occurrences across 7 files:

| File | Count |
|---|---|
| storefront-runtime/…/checkout-client.tsx | 7 |
| storefront-runtime/…/product-reviews.tsx | 1 |
| storefront-runtime/…/addresses/page.tsx | 1 |
| storefront-runtime/…/category-grid.tsx | 1 |
| storefront-runtime/…/renderer-registry.tsx | 2 |
| storefront-runtime/…/CheckoutExtensionHost.tsx | 1 |
| theme-marketplace/…/page.tsx | 1 |

**Inline style=\{\{ usages in .tsx:** 583 total occurrences across 50 files

| App | style=\{\{ occurrences | Key files |
|---|---|---|
| storefront-runtime | 521 | coming-soon components (35+/file), product-reviews (30), account pages (13–25/file), checkout (21) |
| identity-platform | 40 | onboarding/page.tsx (32), login/lookup/select (2–3 each) |
| merchant-control-plane | 22 | not-found/global-error/error (7 each), DashboardClient (1) |
| platform-console | 0 | — |
| platform-operations-portal | 0 | — |
| theme-marketplace | 0 | — |
| app-marketplace | 0 | — |
| marketing-site | 0 | — |
| developer-portal | 0 | — |

Most storefront-runtime inline styles carry dynamic CSS custom properties (theme engine runtime values like `--bg-color`, `--text-color` passed as style props), which is an accepted pattern for the tenant-theming runtime. The volume (521) is still a systemic flag.

---

## 5. Mobile Token Fork Analysis

### Architecture (3-file fork confirmed)

The mobile app has 5 Dart theme files; the key question is how many declare raw `Color(0xFF...)` values independent of the generated file:

| File | Generated? | Raw `Color(0xFF...)` count | Source |
|---|---|---|---|
| `letbuyy_color_tokens.dart` | **YES** (generated from mobile-tokens.ts) | 29 (brand+status+slate ramp) | Canonical — sourced from web primitives |
| `light_theme_colors.dart` | NO (hand-authored) | 29 | Elevation system, glassmorphism, card, text colors — NOT in the generated token file |
| `dark_theme_colors.dart` | NO (hand-authored) | 28 | Same parallel structures as light |
| `store_admin_colors.dart` | NO (hand-authored) | 47 | Re-aliases and extends; 47 raw `Color(0xFF)` for semantic light-variant expansions (successLight, errorDark, etc.) |
| `app_theme_colors.dart` | NO (hand-authored) | 3 | Theme-aware accessor, minimal raw values |

**Verdict:** The claim of "3x fork" is accurate. There are 3 hand-authored color theme files that contain raw `Color(0xFF...)` literals independent of (and sometimes duplicating) the generated canonical token file. `light_theme_colors.dart` and `dark_theme_colors.dart` each define ~100-line glassmorphism/elevation systems with raw hex values not present in the canonical generated file. `store_admin_colors.dart` adds another 47 raw color definitions that are semantic extensions of the token ramp.

Total raw mobile Dart `Color(0xFF...)` literals outside the generated file: **107** (29+28+47+3).

---

## 6. Light/Dark Mode

### Web: Token-Driven, Centralized

`LetbuyyThemeProvider` (`theme-provider.tsx`) is the single canonical controller per its own comment block: "replaces the five hand-rolled, mutually-incompatible theme controllers the apps previously shipped (see THEME_ARCHITECTURE_AUDIT.md THEME-2 and LIGHT_DARK_MODE_AUDIT.md LDM-1/2/3)."

All 9 app layouts use `LetbuyyThemeProvider`. DOM signals: `data-theme="light|dark"` + `class="light|dark"` on `<html>`. Persistence: `localStorage["letbuyy-theme"]`. HARD validator in `validate-design-system.mjs` enforces no bespoke providers and no legacy keys.

**Consistency verdict:** Centralized and consistent across all web apps.

### Mobile: Partial — AppThemeColors Accessor

`app_theme_colors.dart` provides a `AppThemeColors.of(context)` accessor that reads `Theme.of(context).brightness` and delegates to `LightThemeColors` / `DarkThemeColors`. This is a functional light/dark implementation, but the 3-file fork means dark/light expansion tokens are hand-authored, not generated — so drift from the web token set is possible for the glassmorphism/elevation layer.

---

## 7. Component Duplication Inventory

### Shared vs Duplicated Navigation Shells

| Shell Type | Count | Apps |
|---|---|---|
| `AppNavigation` from @letbuyy/ui (fully shared) | 2 | platform-console, platform-operations-portal |
| Custom sidebar using @letbuyy/ui primitives (token-compliant fork) | 1 | merchant-control-plane (`Sidebar.tsx` + `AdminShell.tsx`) |
| Custom top-nav using @letbuyy/ui primitives (token-compliant fork) | 5 | theme-marketplace, app-marketplace, storefront-runtime, marketing-site, developer-portal |
| No persistent shell (auth-flow only) | 1 | identity-platform |

### Duplicated Local Dashboard Components

Two nearly identical local dashboard wrapper components exist:

| File | Component | Note |
|---|---|---|
| `apps/platform-console/src/components/_local-ui/console-workspace.tsx` | `ConsoleWorkspace`, `MetricGrid`, `LeadershipMetric` | Comment: `[CONSOLIDATE -> @letbuyy/ui]` |
| `apps/platform-operations-portal/src/components/_local-ui/ops-workspace.tsx` | `OpsWorkspace`, `MetricGrid`, `OpsMetric` | Comment: `[CONSOLIDATE -> @letbuyy/ui]` |

These two files are structurally identical: same JSX structure, same token-variable className strings, same three exports (workspace wrapper, metric grid, metric card). Only the component names and surface labels differ. This is the main documented "consolidate" debt.

### Summary of Duplicated Component Families

| Component Family | Shared in @letbuyy/ui | Per-App Reimplementations |
|---|---|---|
| AppNavigation shell | YES | 0 (admin apps use it) |
| Sidebar/custom nav | Sidebar (primitive) available | 1 custom (merchant-control-plane) |
| Dashboard workspace layout | Not yet in @letbuyy/ui | 2 (console-workspace + ops-workspace — tagged for consolidation) |
| Button, Input, Table, Modal, Card | YES | 0 (ESLint `no-raw-elements: error` prevents raw substitutes) |
| EmptyState | YES | 0 |
| ThemeProvider | YES | 0 (validator enforces this) |
| Formatter utilities | YES | 0 (currency/date formatters centralized) |
