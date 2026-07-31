# LetBuyy Design System Inventory

Generated: 2026-06-19
Source authority: `packages/typescript/ui/src/tokens.ts`

---

## Overview

The LetBuyy design system is **mature and production-governed**. It is not nascent. It has:

- A canonical TypeScript token source (`tokens.ts`) that emits CSS variables, a DTCG JSON interchange (`tokens.json`), and a generated Flutter/Dart mirror (`letbuyy_tokens.dart`).
- A published React component package (`@letbuyy/ui`) with ~50+ exported components across 11 functional groups.
- A three-tier token hierarchy: Primitive → Semantic → Component, with a Density cross-axis.
- Light/dark/system theming via a single `LetbuyyThemeProvider` with flash prevention.
- Five surfaces: `admin | marketplace | storefront | identity | operations`.
- An active governance ratchet validated in CI (`scripts/validators/validate-design-system.mjs`).
- A parity-checked Tailwind v4 token layer (`config/tailwind/letbuyy-tokens.css`).
- A generated Dart/Flutter mirror with full token parity (density, spacing, radius, color, typography, shadows).

**Maturity assessment:** The system is in active use across all web apps and the Flutter mobile app. Governance gates are enforced. The main gap is Storybook: there are story files but no evidence of a deployed Storybook instance or published documentation site.

---

## Core Package (@letbuyy/ui)

**Package path:** `packages/typescript/ui/`
**Import:** `@letbuyy/ui`

### Architecture

The package is structured as follows:

```
src/
  tokens.ts                  — canonical token source (all CSS variables defined here)
  fonts.ts                   — font stack CSS variable names
  theme-provider.tsx          — LetbuyyThemeProvider, ThemeScript, useTheme
  design-system-root.tsx      — DesignSystemRoot (wrapper applied by provider)
  token-style-boundary.tsx    — injects letbuyyTokenCss into document
  button.tsx                  — Button component
  input.tsx                   — Input, Textarea, NumberField, InlineError
  table.tsx                   — Table component
  layout.tsx                  — Box, Card, Page, PageHeader, Section, Text, BlockStack, InlineStack, Grid, Columns, Container
  overlays.tsx                — Modal, Drawer, Popover, Dropdown, Tooltip, ConfirmDialog, OverlayPortal
  primitives.tsx              — Chart, DateRangePicker, DatePicker, SegmentedControl, DensityToggle, FilterChips, ProgressBar, DescriptionList, Divider, Disclosure, Accordion, Spinner
  controls.tsx                — Checkbox, ChoiceList, Combobox, Radio, Select, Switch, Tabs
  feedback.tsx                — Badge, Banner, EmptyState, EmptyStateIllustration, SaveBar, Skeleton, StatusBadge, ToastProvider, useToast
  navigation/
    index.ts                  — re-exports AppFrame, Navigation, Sidebar, AppNavigation
    app-navigation.tsx         — data-driven AppNavigation component
  app-shell.tsx               — AppFrame, Navigation, Sidebar
  productivity.tsx            — Avatar, CommandPalette, FilterBar, MetricCard, Pagination
  internal-workspace.tsx      — InternalWorkspace, InternalPanel, InternalMetric, InternalModuleCard, InternalStatusPill, InternalEmptyDataState, InternalSkipBackendPanel
  icons.tsx                   — Lucide icons re-exported + MaterialIcon adapter (~100+ icons)
  formatting.ts               — formatInrCurrency, formatDisplayDate, formatIndiaDate, formatIndiaDateTime, formatIndiaDateWithTime, formatIndiaDayMonthTime, formatUsLongDate, formatUsShortDate, formatCurrency, formatDate, formatNumber
  preview.tsx                 — ColorPreviewBlock, ColorPreviewButton, ColorPreviewSurface, ColorSwatch, RadiusPreview
  breadcrumbs.tsx             — Breadcrumbs
  deprecations.ts             — warnDeprecated() runtime helper
  utils.ts                    — cx() class utility
  marketplace.tsx             — marketplace-specific components
```

### Exported component groups (from index.ts)

1. **Actions/Inputs:** `Button`, `Input`, `Textarea`, `NumberField`, `InlineError`
2. **Layout:** `Box`, `Card`, `Page`, `PageHeader`, `PageHeaderActions`, `PageContent`, `Section`, `Text`, `BlockStack`, `InlineStack`, `Grid`, `Columns`, `Container`, `Divider`
3. **Data:** `Table`, `DescriptionList`, `Chart`, `ProgressBar`, `Pagination`, `MetricCard`, `FilterBar`
4. **Controls:** `Checkbox`, `ChoiceList`, `Combobox`, `Radio`, `Select`, `Switch`, `Tabs`, `SegmentedControl`, `DatePicker`, `DateRangePicker`, `FilterChips`, `DensityToggle`
5. **Feedback:** `Badge`, `StatusBadge`, `Banner`, `EmptyState`, `EmptyStateIllustration`, `Skeleton`, `Spinner`, `SaveBar`, `ToastProvider`, `useToast`
6. **Overlays:** `Modal`, `Drawer`, `Dropdown`, `DropdownMenu`, `Popover`, `Tooltip`, `ConfirmDialog`
7. **Navigation/Shell:** `AppFrame`, `Navigation`, `Sidebar`, `AppNavigation`, `Breadcrumbs`, `CommandPalette`, `Avatar`
8. **Internal workspace:** `InternalWorkspace`, `InternalPanel`, `InternalMetric`, `InternalMetricGrid`, `InternalModuleCard`, `InternalModuleGrid`, `InternalStatusPill`, `InternalEmptyDataState`, `InternalSkipBackendPanel`
9. **Theme system:** `LetbuyyThemeProvider`, `ThemeScript`, `useTheme`, `ThemeToggleButton`, `DesignSystemRoot`, `LETBUYY_THEME_STORAGE_KEY`, `LETBUYY_THEME_CHOICES`
10. **Token exports:** All `letbuyyy*Tokens` objects, `letbuyyTokenCss`, `letbuyyTokenCssVariables`, `createLetbuyyBrandVariables`, `validateLetbuyyBrandContrast`
11. **Formatting:** `formatInrCurrency` (canonical INR formatter), date/currency/number utilities
12. **Icons:** `export * from './icons'` — all Lucide icons + MaterialIcon adapter

---

## Token System

All tokens are defined in `packages/typescript/ui/src/tokens.ts` and emitted as `--lb-*` CSS custom properties by `letbuyyTokenCss`. There are **four tiers**:

| Tier | TypeScript export | CSS prefix | Access |
|---|---|---|---|
| Primitive | `letbuyyPrimitiveTokens` | `--lb-primitive-*` | Private — never use in product code |
| Semantic | `letbuyySemanticTokens` | `--lb-semantic-*` | Role aliases (bg, text, border, status) |
| Component | `letbuyyComponentTokens` | `--lb-component-*` | Per-component (button, card, input, sidebar, table, banner, badge, page-header, empty-state) |
| Density | `letbuyyDensityTokens` | `--lb-density-*` | Three presets: compact / comfortable / spacious |

Scales (not tier-namespaced): `--lb-space-*`, `--lb-font-*`, `--lb-line-height-*`, `--lb-font-weight-*`, `--lb-radius-*`, `--lb-shadow-*`, `--lb-z-*`, `--lb-motion-*`, `--lb-ease-*`, `--lb-size-*`, `--lb-bp-*`

All CSS variables are listed in full in TOKEN_INVENTORY.md.

---

## Typography

### Font Families

| Role | CSS Variable | Stack |
|---|---|---|
| Body/Sans | `--lb-font-family-body` | `var(--font-letbuyy-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Display | `--lb-font-family-display` | `var(--font-letbuyy-display), var(--font-letbuyy-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |
| Mono | `--lb-font-family-mono` | `var(--font-letbuyy-mono), "SFMono-Regular", Consolas, "Liberation Mono", monospace` |

Actual fonts are loaded via `next/font` in each app layout, wired through `--font-letbuyy-sans`, `--font-letbuyy-display`, and `--font-letbuyy-mono` CSS variables. The Dart token file identifies `Inter` as `fontBody` and `fontDisplay`, and `ui-monospace` for `fontMono`.

### Font Size Scale (`--lb-font-size-*`)

| Token | Value | Line Height Token | Line Height |
|---|---|---|---|
| `--lb-font-size-display` | 32px | `--lb-line-height-display` | 40px |
| `--lb-font-size-display-fluid` | `clamp(2.75rem, 2.1rem + 2vw, 3.5rem)` | `--lb-line-height-display-fluid` | 1.1 |
| `--lb-font-size-h1` | 28px | `--lb-line-height-h1` | 36px |
| `--lb-font-size-h1-fluid` | `clamp(1.75rem, 1.45rem + 0.9vw, 2rem)` | `--lb-line-height-h1-fluid` | 1.2 |
| `--lb-font-size-h2` | 24px | `--lb-line-height-h2` | 32px |
| `--lb-font-size-h2-fluid` | `clamp(1.375rem, 1.18rem + 0.5vw, 1.5rem)` | `--lb-line-height-h2-fluid` | 1.25 |
| `--lb-font-size-h3` | 20px | `--lb-line-height-h3` | 28px |
| `--lb-font-size-h4` | 18px | `--lb-line-height-h4` | 24px |
| `--lb-font-size-page-title` | 24px | `--lb-line-height-page-title` | 32px |
| `--lb-font-size-section-title` | 18px | `--lb-line-height-section-title` | 24px |
| `--lb-font-size-card-title` | 16px | `--lb-line-height-card-title` | 20px |
| `--lb-font-size-body-large` | 16px | `--lb-line-height-body-large` | 24px |
| `--lb-font-size-heading` | 18px | `--lb-line-height-heading` | 24px |
| `--lb-font-size-body` | 14px | `--lb-line-height-body` | 20px |
| `--lb-font-size-secondary` | 13px | `--lb-line-height-secondary` | 18px |
| `--lb-font-size-table` | 13px | `--lb-line-height-table` | 18px |
| `--lb-font-size-sidebar` | 14px | `--lb-line-height-sidebar` | 20px |
| `--lb-font-size-empty-state` | 14px | `--lb-line-height-empty-state` | 20px |
| `--lb-font-size-small` | 13px | `--lb-line-height-small` | 18px |
| `--lb-font-size-caption` | 12px | `--lb-line-height-caption` | 16px |
| `--lb-font-size-badge` | 12px | `--lb-line-height-badge` | 16px |

### Font Weights (`--lb-font-weight-*`)

| Token | Value |
|---|---|
| `--lb-font-weight-regular` | 400 |
| `--lb-font-weight-medium` | 500 |
| `--lb-font-weight-semibold` | 600 |
| `--lb-font-weight-bold` | 700 |

---

## Color System

### Brand / Primary Colors

| Name | Hex |
|---|---|
| `brandPurple` / `primary` | `#8B5CF6` (purple-500) |
| `primaryTextLight` | `#6D28D9` (purple-700) |
| `primaryTextDark` | `#C4B5FD` (purple-300) |
| `primaryHover` | `#7C3AED` (purple-600) |
| `primaryActive` | `#6D28D9` (purple-700) |
| `primarySubtle` | `rgba(139, 92, 246, 0.12)` |

**CTA button in light mode:** primary bg = `#6D28D9` (purple-700), hover = `#5B21B6` (purple-800), active = `#4C1D95` (purple-900), text = `#FFFFFF`

### Primitive Palette

**Purple:**
`100:#EDE9FE` `200:#DDD6FE` `300:#C4B5FD` `400:#A78BFA` `500:#8B5CF6` `600:#7C3AED` `700:#6D28D9` `800:#5B21B6` `900:#4C1D95`

**Gray:**
`50:#F9FAFB` `100:#F5F5F7` `125:#F6F7F9` `150:#EFEFF1` `175:#F1F2F4` `200:#E5E7EB` `300:#D1D5DB` `400:#94A3B8` `500:#6B7280` `600:#4B5563` `700:#374151` `800:#1F2937` `900:#111827`

**Slate:**
`50:#F8FAFC` `100:#F1F5F9` `200:#E2E8F0` `300:#CBD5E1` `400:#94A3B8` `500:#64748B` `600:#475569` `700:#334155` `800:#1E293B` `850:#1F2937` `900:#0F172A` `950:#0A0F1A`

**Ink (dark mode darks — violet-tinted):**
`950:#0a0912` `900:#0d0b15` `850:#0d0b16` `800:#15131f` `700:#1b1827`

**Status:**
- Green: `100:#DCFCE7` `500:#22C55E` `700:#15803D` `950:#052E16`
- Amber: `100:#FEF3C7` `500:#F59E0B` `800:#92400E` `950:#422006`
- Red: `100:#FEE2E2` `300:#FCA5A5` `500:#EF4444` `600:#DC2626` `700:#B91C1C` `950:#451A1A`
- Blue: `100:#E0F2FE` `300:#7DD3FC` `500:#3B82F6` `700:#1D4ED8` `950:#082F49`
- Pink: `300:#F9A8D4` `400:#F472B6` `500:#EC4899` `600:#DB2777` `700:#BE185D`
- Cyan 500: `#06B6D4`
- Teal 500: `#14B8A6`
- Emerald 500: `#10B981`

### Semantic Color Tokens (`--lb-color-*`)

| Token | Light Value | Dark Value |
|---|---|---|
| `--lb-color-bg` / `--lb-color-background` | `#F6F7F9` (gray-125) | `#0a0912` (ink-950) |
| `--lb-color-surface` | `#FFFFFF` (white) | `#0d0b16` (ink-850) |
| `--lb-color-surface-raised` | `#FFFFFF` | `#1b1827` (ink-700) |
| `--lb-color-surface-subdued` | `#F9FAFB` (gray-50) | `#0a0912` (ink-950) |
| `--lb-color-card` / `--lb-card-bg` | `#FFFFFF` | `#15131f` (ink-800) |
| `--lb-color-sidebar` / `--lb-sidebar-bg` | `#F1F2F4` (gray-175) | `#0d0b15` (ink-900) |
| `--lb-color-header` | `#FFFFFF` | `#0d0b16` (ink-850) |
| `--lb-color-text` | `#111827` (gray-900) | `#FFFFFF` |
| `--lb-color-text-subdued` | `#6B7280` (gray-500) | `#CBD5E1` (slate-300) |
| `--lb-color-text-muted` | `#6B7280` (gray-500) | `#6B7280` (gray-500) |
| `--lb-color-text-inverse` | `#FFFFFF` | `#111827` (gray-900) |
| `--lb-color-border` | `#E5E7EB` (gray-200) | `rgba(139,92,246,0.18)` |
| `--lb-color-border-strong` | `#334155` (slate-700) | `#E5E7EB` (gray-200) |
| `--lb-color-primary` | `#8B5CF6` (purple-500) | `#8B5CF6` |
| `--lb-color-primary-text` | `#6D28D9` (purple-700) | `#C4B5FD` (purple-300) |
| `--lb-color-primary-hover` | `#7C3AED` (purple-600) | `#7C3AED` |
| `--lb-color-primary-active` | `#6D28D9` (purple-700) | `#6D28D9` |
| `--lb-color-primary-subtle` / `--lb-color-primary-soft` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` |
| `--lb-color-primary-cta` | `#6D28D9` (purple-700) | `#6D28D9` |
| `--lb-color-primary-cta-hover` | `#5B21B6` (purple-800) | `#5B21B6` |
| `--lb-color-primary-cta-active` | `#4C1D95` (purple-900) | `#4C1D95` |
| `--lb-color-primary-cta-text` | `#FFFFFF` | `#FFFFFF` |
| `--lb-color-secondary-action` | `#8B5CF6` | `#8B5CF6` |
| `--lb-color-secondary-action-hover` | `#7C3AED` | `#7C3AED` |
| `--lb-color-secondary-action-subtle` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` |
| `--lb-color-critical` | `#EF4444` (red-500) | `#EF4444` |
| `--lb-color-critical-hover` | `#DC2626` (red-600) | `#DC2626` |
| `--lb-color-critical-soft` | `#FEE2E2` (red-100) | `#451A1A` (red-950) |
| `--lb-color-warning` | `#F59E0B` (amber-500) | `#F59E0B` |
| `--lb-color-warning-soft` | `#FEF3C7` (amber-100) | `#422006` (amber-950) |
| `--lb-color-success` | `#22C55E` (green-500) | `#22C55E` |
| `--lb-color-success-soft` | `#DCFCE7` (green-100) | `#052E16` (green-950) |
| `--lb-color-info` | `#3B82F6` (blue-500) | `#3B82F6` |
| `--lb-color-info-soft` | `#E0F2FE` (blue-100) | `#082F49` (blue-950) |
| `--lb-color-focus-ring` | `#5B21B6` (purple-800) | `#8B5CF6` (purple-500) |
| `--lb-color-overlay` | `rgb(15 23 42 / 56%)` | `rgb(0 0 0 / 64%)` |

### Deprecated Color Tokens (removed from CSS output)

These tokens existed in earlier versions and have been deleted from the emitted CSS:
- `--lb-color-text-primary`
- `--lb-color-text-secondary`
- `--lb-color-border-default`
- `--lb-color-border-subtle`
- `--lb-color-danger`
- `--lb-semantic-focus-ring`
- `--lb-semantic-accent-brand`
- `--lb-semantic-accent-text`
- `--lb-semantic-text-primary`
- `--lb-semantic-text-secondary`
- `--lb-semantic-text-muted`

### Tailwind v4 Token Utilities (`config/tailwind/letbuyy-tokens.css`)

These utility classes map to semantic `--lb-color-*` tokens and are the migration target for raw Tailwind palette classes:

| Utility | Maps to |
|---|---|
| `bg-surface` | `var(--lb-color-surface)` |
| `bg-surface-raised` | `var(--lb-color-surface-raised)` |
| `bg-surface-subdued` | `var(--lb-color-surface-subdued)` |
| `bg-card` | `var(--lb-color-card)` |
| `bg-page` | `var(--lb-color-bg)` |
| `bg-sidebar` | `var(--lb-color-sidebar)` |
| `text-default` | `var(--lb-color-text)` |
| `text-subdued` | `var(--lb-color-text-subdued)` |
| `text-muted` | `var(--lb-color-text-muted)` |
| `text-inverse` | `var(--lb-color-text-inverse)` |
| `text-primary` | `var(--lb-color-primary)` |
| `text-primary-cta` | `var(--lb-color-primary-cta)` |
| `text-primary-soft` | `var(--lb-color-primary-soft)` |
| `text-critical` | `var(--lb-color-critical)` |
| `text-success` | `var(--lb-color-success)` |
| `text-warning` | `var(--lb-color-warning)` |
| `text-info` | `var(--lb-color-info)` |
| `border-line` | `var(--lb-color-border)` |
| `border-line-subtle` | `var(--lb-color-border-subtle)` |
| `border-focus` | `var(--lb-color-focus-ring)` |

---

## Spacing System

Source: `letbuyyTokens.space` in `tokens.ts`

### Named Scale

| Named Token | Numeric Token | Value |
|---|---|---|
| `--lb-space-xs` / `--lb-space-1` | 1 | 4px |
| `--lb-space-sm` / `--lb-space-2` | 2 | 8px |
| `--lb-space-md` / `--lb-space-3` | 3 | 12px |
| `--lb-space-lg` / `--lb-space-4` | 4 | 16px |
| `--lb-space-xl` / `--lb-space-5` | 5 | 20px |
| `--lb-space-0` | 0 | 0 |
| `--lb-space-6` | 6 | 24px |
| `--lb-space-7` | 7 | 32px |
| `--lb-space-8` | 8 | 40px |
| `--lb-space-9` | 9 | 48px |
| `--lb-space-10` | 10 | 64px |
| `--lb-space-11` | 11 | 96px |

Additional named values not mapped to numeric slots: `2xs: 2px`, `xs-plus: 6px`

### Breakpoints (`--lb-bp-*`)

| Token | Value |
|---|---|
| `--lb-bp-xs` | 360px |
| `--lb-bp-mobile` | 480px |
| `--lb-bp-sm` | 640px |
| `--lb-bp-md` / `--lb-bp-tablet` | 768px |
| `--lb-bp-lg` / `--lb-bp-desktop` | 1024px |
| `--lb-bp-xl` / `--lb-bp-wide` | 1280px |

---

## Border Radius Tokens

Source: `letbuyyTokens.radius` in `tokens.ts`. The governance ratchet **forbids** new `rounded-[...]` arbitrary values.

| Token | Value | Usage |
|---|---|---|
| `--lb-radius-sm` | 4px | Small controls, badges |
| `--lb-radius-md` | 8px | Buttons, inputs, dropdown items |
| `--lb-radius-lg` | 12px | Cards, modals, overlays, segmented controls |
| `--lb-radius-xl` | 16px | Card component-level radius (`letbuyyComponentTokens.card.radius`) |
| `--lb-radius-full` | 999px | Pills, filter chips, circular buttons |

---

## Shadow Tokens

Source: `letbuyyShadowTokens` in `tokens.ts`

| Token | Value |
|---|---|
| `--lb-shadow-sm` | `0 1px 2px rgb(0 0 0 / 4%)` |
| `--lb-shadow-md` | `0 4px 12px rgb(15 23 42 / 6%)` |
| `--lb-shadow-lg` | `0 12px 32px rgb(15 23 42 / 8%)` |
| `--lb-shadow-card-light` / `--lb-shadow-card` (light) | `0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` |
| `--lb-shadow-card-dark` / `--lb-shadow-card` (dark) | `0 1px 2px rgb(0 0 0 / 18%), 0 10px 26px rgb(0 0 0 / 16%)` |

`--lb-shadow-card` resolves to the light or dark variant based on the active theme.

---

## Motion Tokens

Source: `letbuyyTokens.motion` in `tokens.ts`. Tokens reset to `0ms`/`0px`/`1` under `prefers-reduced-motion: reduce`.

### Duration (`--lb-motion-*`)

| Token | Value |
|---|---|
| `--lb-motion-fast` / `--lb-motion-hover` / `--lb-motion-menu` | 150ms |
| `--lb-motion-normal` | 180ms |
| `--lb-motion-slow` / `--lb-motion-carousel` | 200ms |

Note: `hover` and `menu` are named aliases both set to 150ms. `carousel` is 300ms in the raw token but also 200ms in `slow` — the CSS variable `--lb-motion-carousel` reflects 300ms from `letbuyyTokens.motion.duration.carousel`.

**Corrected from source:**
- `--lb-motion-carousel`: 300ms
- `--lb-motion-fast`, `--lb-motion-hover`, `--lb-motion-menu`: 150ms
- `--lb-motion-normal`: 180ms
- `--lb-motion-slow`: 200ms

### Easing (`--lb-ease-*`)

| Token | Value |
|---|---|
| `--lb-ease-standard` / `--lb-ease-out` | `ease-out` |
| `--lb-ease-emphasized` | `cubic-bezier(0.16, 1, 0.3, 1)` |

### Transform

| Token | Value |
|---|---|
| `--lb-motion-hover-lift` | 2px |
| `--lb-motion-hover-scale` | 1.01 |

### Keyframe Animations (emitted in `letbuyyTokenCss`)

- `lb-empty-state-float`: `0%/100% translateY(0)`, `50% translateY(-6px)`, 4.8s cycle. Applied to `[data-lb-empty-float="primary"]`.
- `lb-empty-state-drift`: `0%/100% translate3d(0,0,0) opacity:0.72`, `50% translate3d(4px,-5px,0) opacity:1`, 5.6s cycle. Applied to `[data-lb-empty-float="secondary"]`.

Both animations are gated by `prefers-reduced-motion: no-preference`.

---

## Z-Index Tokens (`--lb-z-*`)

| Token | Value | Semantic Usage |
|---|---|---|
| `--lb-z-base` | 0 | Base layer |
| `--lb-z-dropdown` | 30 | Dropdown menus, Popover |
| `--lb-z-sticky` | 40 | Sticky headers/bars |
| `--lb-z-overlay` | 50 | Overlay backdrops |
| `--lb-z-modal` | 60 | Modal, Drawer containers |
| `--lb-z-toast` | 70 | Toast notifications |
| `--lb-z-tooltip` | 80 | Tooltip |

---

## Size Tokens (`--lb-size-*`)

| Token | Value |
|---|---|
| `--lb-size-control-sm` | `var(--lb-density-icon-button-height)` |
| `--lb-size-control-md` | `var(--lb-density-button-height)` |
| `--lb-size-control-lg` | `var(--lb-density-button-height-large)` |
| `--lb-size-icon` | `var(--lb-density-icon-button-height)` |
| `--lb-size-icon-inline` | `var(--lb-density-action-icon-size)` |
| `--lb-size-page-header-height` | `var(--lb-density-header-height)` |
| `--lb-size-page-max` | 1440px |
| `--lb-size-marketplace-container` | 1200px |
| `--lb-size-content-measure` | 720px |
| `--lb-size-empty-state-measure` | 440px |
| `--lb-size-save-bar-width` | 920px |
| `--lb-size-skeleton-card-height` | 120px |
| `--lb-size-empty-state-min-height` | `var(--lb-density-empty-state-min-height)` |
| `--lb-size-combobox-menu-max-height` | 280px |
| `--lb-size-tooltip-max-width` | 240px |
| `--lb-size-metric-sparkline-width` | 96px |
| `--lb-size-metric-sparkline-height` | 40px |
| `--lb-size-chart-height-sm` | 160px |
| `--lb-size-chart-height-md` | 220px |
| `--lb-size-chart-height-lg` | 280px |
| `--lb-size-table-row-height` | `var(--lb-density-table-row-height)` |
| `--lb-size-table-header-height` | `var(--lb-density-table-header-height)` |
| `--lb-size-table-toolbar-height` | `var(--lb-density-action-bar-height)` |
| `--lb-size-command-palette-width` | 720px |
| `--lb-size-command-palette-list-max-height` | 360px |
| `--lb-size-command-palette-offset` | 12vh |

---

## Density System (`--lb-density-*`)

Three presets: `compact` (default), `comfortable`, `spacious`. Set via `data-letbuyy-density` attribute.

| Token | compact | comfortable | spacious |
|---|---|---|---|
| `--lb-density-sidebar-row-height` | 40px | 44px | 48px |
| `--lb-density-input-height` | 36px | 40px | 44px |
| `--lb-density-button-height` | 36px | 40px | 44px |
| `--lb-density-button-height-large` | 40px | 44px | 48px |
| `--lb-density-icon-button-height` | 32px | 36px | 40px |
| `--lb-density-pill-height` | 28px | 32px | 36px |
| `--lb-density-table-row-height` | 44px | 48px | 52px |
| `--lb-density-table-header-height` | 44px | 48px | 52px |
| `--lb-density-page-gap` | 12px | 16px | 20px |
| `--lb-density-section-gap` | 12px | 16px | 20px |
| `--lb-density-card-gap` | 16px | 20px | 24px |
| `--lb-density-card-padding` | 16px | 20px | 24px |
| `--lb-density-header-height` | 64px | 72px | 88px |
| `--lb-density-action-bar-height` | 36px | 40px | 44px |
| `--lb-density-modal-padding` | 16px | 20px | 24px |
| `--lb-density-empty-state-scale` | 0.72 | 0.88 | 1 |
| `--lb-density-empty-state-illustration-width` | 160px | 184px | 208px |
| `--lb-density-empty-state-illustration-height` | 108px | 122px | 138px |
| `--lb-density-empty-state-min-height` | 180px | 220px | 260px |
| `--lb-density-page-icon-size` | 18px | 20px | 22px |
| `--lb-density-sidebar-icon-size` | 18px | 18px | 20px |
| `--lb-density-sidebar-nested-spacing` | 8px | 8px | 12px |
| `--lb-density-sidebar-section-spacing` | 16px | 16px | 20px |
| `--lb-density-button-icon-size` | 16px | 16px | 18px |
| `--lb-density-table-icon-size` | 14px | 14px | 16px |
| `--lb-density-action-icon-size` | 16px | 16px | 18px |

---

## Icon System

**Library:** Lucide React (`lucide-react`)
**Adapter:** `MaterialIcon` component with a `materialIconMap` that maps ~120 Material Design icon names to Lucide equivalents.

### Direct Lucide Re-exports (count: ~75 icons)

`Activity`, `AlertCircle`, `AlertTriangle`, `AppWindow`, `ArrowLeft`, `ArrowDown`, `ArrowRight`, `ArrowUp`, `ArrowUpRight`, `Award`, `BadgeCheck`, `BarChart3`, `Bell`, `BookOpen`, `Bot`, `Briefcase`, `Calendar`, `Camera`, `Check`, `CheckCircle`, `CheckCircle2`, `ChevronDown`, `ChevronLeft`, `ChevronRight`, `ChevronUp`, `Circle`, `ClipboardList`, `Clock`, `Code`, `Code2`, `Command`, `Copy`, `CreditCard`, `Crown`, `DollarSign`, `Download`, `Edit3`, `ExternalLink`, `Eye`, `EyeOff`, `Facebook`, `FileJson`, `FileText`, `GitBranch`, `Github`, `Globe`, `GraduationCap`, `Flame`, `Gauge`, `GripVertical`, `Headphones`, `Heart`, `Home`, `Image`, `IndianRupee`, `Info`, `Instagram`, `Key`, `KeyRound`, `LayoutDashboard`, `LayoutGrid`, `Linkedin`, `Link2`, `ListFilter`, `ListChecks`, `Loader2`, `Lock`, `LogOut`, `Mail`, `MapPin`, `Megaphone`, `Menu`, `MessageCircle`, `MessageSquare`, `Minus`, `Monitor`, `Moon`, `MoreHorizontal`, `MousePointerClick`, `Package`, `Palette`, `PenTool`, `Pencil`, `Phone`, `Plus`, `Printer`, `Puzzle`, `RadioTower`, `RefreshCcw`, `RefreshCw`, `Rocket`, `RotateCcw`, `Save`, `Search`, `Send`, `Settings`, `Share2`, `Shield`, `ShieldAlert`, `ShieldCheck`, `ShoppingBag`, `ShoppingCart`, `Smartphone`, `Sparkles`, `Star`, `Store`, `Sun`, `Tag`, `ThumbsUp`, `Trash2`, `Truck`, `Twitter`, `Upload`, `User`, `Users`, `X`, `XCircle`, `Youtube`, `Zap`

Also re-exported but not listed in direct exports from the file: `FileUp`, `ReceiptText`, `Redo2`, `TrendingUp`, `Undo2`, `Languages`

### Material Icon Adapter

The `MaterialIcon` component accepts a `name: MaterialIconName` prop (a string key from `materialIconMap`). There are approximately 120 mapped names including: `account_circle`, `add`, `analytics`, `appearance`, `billing`, `checkout`, `categories`, `customer`, `dashboard`, `delete`, `domain`, `edit`, `email`, `error`, `export`, `fulfillment`, `inventory`, `orders`, `pages`, `payment`, `products`, `reviews`, `search`, `settings`, `shipping`, `store`, `storefront`, etc.

All icons rendered via `MaterialIcon` receive the class `letbuyy-icon`, which applies density-aware sizing from `--lb-density-action-icon-size` when inside a `[data-letbuyy-design-system]` root.

**India-specific icon:** `IndianRupee` (Lucide) is included as a direct export.

---

## Component Primitives

### Button

Variants: `primary | secondary | outline | ghost | destructive`
Sizes: `sm | md | lg | icon`
Props: `variant`, `size`, `loading`, `fullWidth`, `unstyled`, `as` (button/a), `asChild`

All styling uses `--lb-component-button-*` and `--lb-density-*` tokens. No hardcoded colors.

### Input

`Input`, `Textarea`, `NumberField`, `InlineError`. All use `--lb-component-input-*` tokens.

### Table

`Table` with `TableColumn`, `TableBulkAction`, `TableFilterChip`, `TableSavedView` types.

### Overlays

All overlays (Modal, Drawer, Popover, Dropdown, Tooltip) portal to `<body>` via `OverlayPortal`, which mirrors `data-letbuyy-theme`, `data-letbuyy-surface`, `data-letbuyy-density` from the DesignSystemRoot to the portal container. This prevents dark-mode cascade mismatch.

### Layout System

`Box` (multi-element, padding/tone), `Card`, `Page`, `PageHeader`, `PageHeaderActions`, `PageContent`, `Section`, `Text` (variants: body/secondary/heading/caption/badge, tones: default/subdued/muted/critical/success/warning/info), `BlockStack`, `InlineStack`, `Grid`, `Columns`, `Container`, `Divider`

`SpaceScale` type: `'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8'` — maps to `--lb-space-1` through `--lb-space-8`.

### Navigation Shell

`AppFrame` + `Sidebar` + `Navigation` (AppShell). Data-driven `AppNavigation` with `AppNavigationSection` support. `isNavItemActive` helper.

### Feedback

`Badge` (default/info/success/warning/critical variants), `StatusBadge` (canonical status → badge variant mapper), `Banner` (info/success/warning/danger), `EmptyState` + `EmptyStateIllustration` (floating animation), `SaveBar` (sticky CTA bar), `Skeleton`, `Spinner`, `ToastProvider`/`useToast`.

### Productivity

`Avatar`, `CommandPalette` (720px wide, keyboard navigable), `FilterBar`, `MetricCard`, `Pagination`.

---

## Storybook

Story files exist in `packages/typescript/ui/src/`:
- `component-catalog.stories.tsx` — full component catalog
- `design-tokens.stories.tsx` — token visualization
- `foundation-primitives.stories.tsx` — primitive showcase
- `governance.stories.tsx` — Do/Don't usage guardrails
- `merchant-experience.stories.tsx` — merchant UX patterns
- `primitives.stories.tsx` — primitives showcase
- `table.stories.tsx` — table examples

No `package.json` script for running Storybook was confirmed in the files read. There is no evidence of a deployed Storybook URL in the documentation. The stories exist as living documentation but may not be deployed publicly.

---

## Design Token File

The canonical token source is `packages/typescript/ui/src/tokens.ts` (TypeScript), exported as:
- CSS: generated inline via `letbuyyTokenCss` string, injected by `TokenStyleBoundary`
- JSON: `packages/typescript/ui/tokens.json` (DTCG format, kept in parity by `scripts/generators/generate-design-tokens.mjs`)
- Dart: `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` (generated, kept in parity by `scripts/generators/generate-mobile-tokens.mjs`, validated in CI by `validate:mobile-tokens`)

---

## Mobile Design (Flutter/Dart)

**Location:** `packages/dart/ui_kit/lib/src/`

### Token file: `tokens/letbuyy_tokens.dart`

- **Status:** GENERATED (`// GENERATED FILE - DO NOT EDIT. Source: packages/typescript/ui/tokens.json`)
- **Parity:** Full parity with web tokens (all spacing, radius, typography, color, density, shadow)
- **Color representation:** Flutter `Color` objects (`const Color(0xFF...)`)

Classes:
- `LetbuyyPrimitiveTokens` — raw palette colors (same values as TS)
- `LetbuyyColorTokens` — semantic color tokens + light/dark helpers (`page()`, `surface()`, `card()`, `textPrimary()`, `textSecondary()`, `border()`)
- `LetbuyyTypographyTokens` — font sizes, weights, font names (`fontBody: 'Inter'`, `fontDisplay: 'Inter'`, `fontMono: 'ui-monospace'`)
- `LetbuyySpacingTokens` — spacing scale in dp (same values as CSS px)
- `LetbuyyRadiusTokens` — radius values (4/8/12/16/999)
- `LetbuyyShadowTokens` — BoxShadow constants (sm/md/lg)
- `LetbuyyDensityTokens` — density presets (compact/comfortable/spacious, same values as TS)

**Dart color divergence:** The Dart `LetbuyyColorTokens.backgroundDark` uses `gray900` (`#111827`) while the TS source uses `ink.950` (`#0a0912`). Similarly `surfaceDark`/`cardDark` map to slightly different slate/gray values vs the TS ink palette. The border dark in Dart is `slate700` (`#334155`) vs the TS `rgba(139, 92, 246, 0.18)`. This is a **meaningful parity gap** — the Dart dark palette does not include the violet-tinted ink palette that web uses.

### Widget files in `widgets/`

`badge_widget.dart`, `confirmation_dialog.dart`, `custom_app_bar.dart`, `custom_bottom_nav.dart`, `custom_button.dart`, `custom_drawer.dart`, `custom_text_field.dart`, `empty_state.dart`, `empty_state_widget.dart`, `error_view.dart`, `error_widget.dart`, `glass_container.dart`, `loading_indicator.dart`, `loading_overlay.dart`, `network_image_widget.dart`, `rating_widget.dart`, `search_bar_widget.dart`, `shimmer_loading.dart`

### Theme files in `themes/`

`app_colors.dart`, `app_text_styles.dart`, `app_theme.dart`

The Flutter widget library mirrors the web component catalog. `glass_container.dart` is notable as it has no web equivalent (glassmorphism effect, likely for the shopper-facing storefront app).

---

## Governance Rules

### Enforced by CI validators

From `docs/ui-standards/design-system.md` and `docs/design-system/foundations.md`:

| Gate | Ratchet metric | What it blocks |
|---|---|---|
| `validate:design-system` (`scripts/validators/validate-design-system.mjs`) | `tsxArbitraryRadius` | New `rounded-[...]` arbitrary radius in TSX |
| `validate:design-system` | `rawPxSpacing` | Raw px in spacing properties |
| `validate:design-system` | `rawPxFontSize` | Raw px font-size |
| `validate:design-system` | `tsxInlineStyles` | Inline styles in TSX |
| `validate:design-system` | `tsxRawHex` | Hardcoded hex colors in TSX |
| `validate:design-system` | `tailwindPaletteClasses` | Tailwind palette classes (`bg-white`, `bg-gray-50`, `text-gray-900`, etc.) |
| `validate:design-system` | `appCssNakedRgbHsl` | Raw rgb/hsl in app CSS |
| `validate:design-tokens` | DTCG JSON drift | `tokens.json` not matching `tokens.ts` |
| `validate:mobile-tokens` | Dart token drift | `letbuyy_tokens.dart` not matching source |
| ESLint `@letbuyy/ui` plugin | `no-raw-elements` | Raw `<button>/<input>/<table>` elements |

### Usage rules (from `governance.stories.tsx`)

1. **Interactive controls:** Use `Button`, `Input`, `Select`, `Checkbox`, `Switch`, `Table` from `@letbuyy/ui`. Do NOT ship raw HTML elements in governed surfaces.
2. **Tokens:** Use `--lb-*` CSS variables and exported token maps. Do NOT hardcode hex colors or create new duplicate token aliases.
3. **Overlays:** Use `Modal`, `Drawer`, `Popover`, `Dropdown`, `Tooltip`, `CommandPalette`. Do NOT build one-off overlays without the shared focus-trap, dismiss, and z-index stack.
4. **Deprecations:** Migrate deprecated aliases with package codemods. Do NOT remove deprecated exports until cross-app migrations are complete.

### Theming rules (from `docs/design-system/dark-mode.md`)

- One `<LetbuyyThemeProvider>` per app, not `<DesignSystemRoot>` directly in layouts.
- No `theme="auto"` prop.
- No legacy localStorage keys (`letbuyy_theme`, `theme`, `theme-marketplace-theme`).
- No second ThemeProvider.
- `platform-console` and `platform-operations-portal` default to `dark`; all other apps default to `system`.

### Brand override (runtime theming)

`createLetbuyyBrandVariables(brand: LetbuyyBrandInput)` accepts a hex color string or a `LetbuyyBrandOverrides` object. It generates `--lb-color-primary-*`, `--lb-component-button-primary-*`, `--lb-component-input-focus-*`, `--lb-component-badge-accent-*`, `--lb-component-empty-state-illustration-*` overrides.

`validateLetbuyyBrandContrast()` runs WCAG contrast checks (4.5:1 for text, 4.5:1 for CTA text, 3:1 for focus ring) against white background and returns `LetbuyyBrandContrastCheck[]`.

---

## Gaps & Missing

### Present and mature
- Token system (3-tier, CSS variables, JSON DTCG, Dart parity)
- Light/dark/system theming with flash prevention
- Density system (compact/comfortable/spacious)
- Surface scoping (5 surfaces)
- Component library (~50+ components)
- Governance ratchet in CI
- Brand override with WCAG validation
- Flutter/Dart mirror (with noted dark mode gap)

### Missing or incomplete
1. **Storybook deployment:** Story files exist but no confirmed deployed Storybook URL. No evidence of `storybook` script in package.json from files read.
2. **Dart dark mode uses wrong dark palette:** The Flutter `letbuyy_tokens.dart` uses gray/slate-based darks rather than the violet-tinted `ink` palette used on web. This produces visually different dark modes across web and mobile.
3. **No tokens.reference.css in docs:** `docs/ui-standards/tokens.reference.css` is listed in the directory listing but does not exist on disk (file not found error during read). This is a broken documentation reference.
4. **No design system Figma tokens:** No Figma file link, Figma token plugin config, or design handoff integration was found in any file read.
5. **No semantic status token for `border-subtle`:** `--lb-color-border-subtle` appears in Tailwind token CSS (`--color-line-subtle: var(--lb-color-border-subtle)`) but this variable is in the deprecated set and is removed from the CSS output by `deprecatedTokenAliasVariables`. The Tailwind alias references a variable that no longer exists.
6. **`h4` font-size-heading alias collision:** Both `--lb-font-size-h4` (18px) and `--lb-font-size-heading` (18px) exist with identical values. `heading` is the canonical role-based token; `h4` is a compatibility alias.
7. **No motion tokens for hover-lift/hover-scale in component usage:** `--lb-motion-hover-lift` (2px) and `--lb-motion-hover-scale` (1.01) are defined but their usage in components was not observed in the files reviewed.
8. **`FileUp` included in icons.tsx imports but not in direct exports:** `FileUp` is imported from lucide but not explicitly re-exported in the `export { ... }` block.
9. **No responsive/fluid font scale for body/secondary text:** Fluid font sizes (`clamp(...)`) only exist for `display`, `h1`, and `h2`. Body, secondary, and caption sizes are fixed.
10. **No semantic elevation/layer tokens beyond 5 shadow values:** The shadow scale (`sm`/`md`/`lg`/`card-light`/`card-dark`) does not include semantic role names like `floating`, `raised-high`, etc.
