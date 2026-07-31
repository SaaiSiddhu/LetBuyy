# LetBuyy Design Token Inventory

Generated: 2026-06-19
Source: `packages/typescript/ui/src/tokens.ts`, `config/tailwind/letbuyy-tokens.css`

All values are from the TypeScript source. CSS variable names match what `letbuyyTokenCss` emits at runtime.
Tokens marked "(light)" or "(dark)" resolve differently per theme via `[data-theme]` selectors.
Density tokens are emitted under `[data-letbuyy-density]` selectors.

---

## Color Tokens

### Semantic Color (`--lb-color-*`)

| Token Name | Light Value | Dark Value | Category |
|---|---|---|---|
| `--lb-color-brand-purple` | `#8B5CF6` | `#8B5CF6` | color/brand |
| `--lb-color-bg` | `#F6F7F9` | `#0a0912` | color/background |
| `--lb-color-background` | `#F6F7F9` | `#0a0912` | color/background (alias) |
| `--lb-color-surface` | `#FFFFFF` | `#0d0b16` | color/surface |
| `--lb-color-surface-raised` | `#FFFFFF` | `#1b1827` | color/surface |
| `--lb-color-surface-subdued` | `#F9FAFB` | `#0a0912` | color/surface |
| `--lb-color-card` | `#FFFFFF` | `#15131f` | color/surface |
| `--lb-card-bg` | `#FFFFFF` | `#15131f` | color/surface (alias) |
| `--lb-content-bg` | `#F6F7F9` | `#0a0912` | color/background (alias) |
| `--lb-color-sidebar` | `#F1F2F4` | `#0d0b15` | color/surface |
| `--lb-sidebar-bg` | `#F1F2F4` | `#0d0b15` | color/surface (alias) |
| `--lb-color-header` | `#FFFFFF` | `#0d0b16` | color/surface |
| `--lb-color-text` | `#111827` | `#FFFFFF` | color/text |
| `--lb-color-text-subdued` | `#6B7280` | `#CBD5E1` | color/text |
| `--lb-color-text-muted` | `#6B7280` | `#6B7280` | color/text |
| `--lb-color-text-inverse` | `#FFFFFF` | `#111827` | color/text |
| `--lb-color-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` | color/border |
| `--lb-color-border-strong` | `#334155` | `#E5E7EB` | color/border |
| `--lb-color-primary` | `#8B5CF6` | `#8B5CF6` | color/brand |
| `--lb-color-primary-text` | `#6D28D9` | `#C4B5FD` | color/brand |
| `--lb-color-primary-hover` | `#7C3AED` | `#7C3AED` | color/brand |
| `--lb-color-primary-active` | `#6D28D9` | `#6D28D9` | color/brand |
| `--lb-color-primary-subtle` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` | color/brand |
| `--lb-color-primary-soft` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` | color/brand (alias) |
| `--lb-color-primary-cta` | `#6D28D9` | `#6D28D9` | color/brand/cta |
| `--lb-color-primary-cta-hover` | `#5B21B6` | `#5B21B6` | color/brand/cta |
| `--lb-color-primary-cta-active` | `#4C1D95` | `#4C1D95` | color/brand/cta |
| `--lb-color-primary-cta-text` | `#FFFFFF` | `#FFFFFF` | color/brand/cta |
| `--lb-color-secondary-action` | `#8B5CF6` | `#8B5CF6` | color/action |
| `--lb-color-secondary-action-hover` | `#7C3AED` | `#7C3AED` | color/action |
| `--lb-color-secondary-action-subtle` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` | color/action |
| `--lb-color-critical` | `#EF4444` | `#EF4444` | color/status |
| `--lb-color-critical-hover` | `#DC2626` | `#DC2626` | color/status |
| `--lb-color-critical-soft` | `#FEE2E2` | `#451A1A` | color/status |
| `--lb-color-warning` | `#F59E0B` | `#F59E0B` | color/status |
| `--lb-color-warning-soft` | `#FEF3C7` | `#422006` | color/status |
| `--lb-color-success` | `#22C55E` | `#22C55E` | color/status |
| `--lb-color-success-soft` | `#DCFCE7` | `#052E16` | color/status |
| `--lb-color-info` | `#3B82F6` | `#3B82F6` | color/status |
| `--lb-color-info-soft` | `#E0F2FE` | `#082F49` | color/status |
| `--lb-color-focus-ring` | `#5B21B6` | `#8B5CF6` | color/focus |
| `--lb-color-overlay` | `rgb(15 23 42 / 56%)` | `rgb(0 0 0 / 64%)` | color/overlay |
| `--lb-shadow-card` | `0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` | `0 1px 2px rgb(0 0 0 / 18%), 0 10px 26px rgb(0 0 0 / 16%)` | shadow/card |

### Static Color References (light/dark variants, always emitted)

| Token Name | Value | Category |
|---|---|---|
| `--lb-color-background-light` | `#F6F7F9` | color/primitive-alias |
| `--lb-color-background-dark` | `#0a0912` | color/primitive-alias |
| `--lb-color-surface-light` | `#FFFFFF` | color/primitive-alias |
| `--lb-color-surface-dark` | `#0d0b16` | color/primitive-alias |
| `--lb-color-text-primary-light` | `#111827` | color/primitive-alias |
| `--lb-color-text-primary-dark` | `#FFFFFF` | color/primitive-alias |
| `--lb-color-text-secondary-light` | `#6B7280` | color/primitive-alias |
| `--lb-color-text-secondary-dark` | `#CBD5E1` | color/primitive-alias |
| `--lb-color-border-light` | `#E5E7EB` | color/primitive-alias |
| `--lb-color-border-dark` | `rgba(139,92,246,0.18)` | color/primitive-alias |

### Component Color Tokens (`--lb-component-*`)

#### Button

| Token Name | Light Value | Dark Value | Category |
|---|---|---|---|
| `--lb-component-button-primary-bg` | `#6D28D9` | `#6D28D9` | component/button |
| `--lb-component-button-primary-hover` | `#5B21B6` | `#5B21B6` | component/button |
| `--lb-component-button-primary-active` | `#4C1D95` | `#4C1D95` | component/button |
| `--lb-component-button-primary-text` | `#FFFFFF` | `#FFFFFF` | component/button |
| `--lb-component-button-primary-border` | `#6D28D9` | `#6D28D9` | component/button |
| `--lb-component-button-secondary-bg` | `transparent` | `#0d0b16` | component/button |
| `--lb-component-button-secondary-hover` | `#F9FAFB` | `#15131f` | component/button |
| `--lb-component-button-secondary-text` | `#111827` | `#FFFFFF` | component/button |
| `--lb-component-button-secondary-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` | component/button |

#### Card

| Token Name | Light Value | Dark Value | Category |
|---|---|---|---|
| `--lb-component-card-bg` | `#FFFFFF` | `#15131f` | component/card |
| `--lb-component-card-text` | `#111827` | `#FFFFFF` | component/card |
| `--lb-component-card-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` | component/card |
| `--lb-component-card-radius` | `16px` | `16px` | component/card |
| `--lb-component-card-shadow` | `0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` | `0 1px 2px rgb(0 0 0 / 18%), 0 10px 26px rgb(0 0 0 / 16%)` | component/card |

#### Input

| Token Name | Light Value | Dark Value | Category |
|---|---|---|---|
| `--lb-component-input-bg` | `#FFFFFF` | `#0d0b16` | component/input |
| `--lb-component-input-text` | `#111827` | `#FFFFFF` | component/input |
| `--lb-component-input-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` | component/input |
| `--lb-component-input-focus-border` | `#8B5CF6` | `#8B5CF6` | component/input |
| `--lb-component-input-focus-ring` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` | component/input |

#### Page Header

| Token Name | Light Value | Dark Value | Category |
|---|---|---|---|
| `--lb-component-page-header-height` | `var(--lb-density-header-height)` | same | component/page-header |
| `--lb-component-page-header-title-size` | `24px` | `24px` | component/page-header |
| `--lb-component-page-header-title-line-height` | `32px` | `32px` | component/page-header |
| `--lb-component-page-header-icon-size` | `var(--lb-component-page-header-title-size)` | same | component/page-header |
| `--lb-component-page-header-icon-bg` | `transparent` | `transparent` | component/page-header |
| `--lb-component-page-header-icon-text` | `#111827` | `#FFFFFF` | component/page-header |
| `--lb-component-page-header-icon-fill` | `color-mix(in srgb, currentColor 18%, transparent)` | same | component/page-header |
| `--lb-component-page-header-icon-stroke-width` | `2.45` | `2.45` | component/page-header |
| `--lb-component-page-header-icon-border` | `transparent` | `transparent` | component/page-header |

#### Badge

| Token Name | Light Value | Dark Value | Category |
|---|---|---|---|
| `--lb-component-badge-accent-bg` | `rgba(139,92,246,0.12)` | `rgba(139,92,246,0.12)` | component/badge |
| `--lb-component-badge-accent-text` | `#6D28D9` | `#C4B5FD` | component/badge |
| `--lb-component-badge-accent-border` | `#8B5CF6` | `#8B5CF6` | component/badge |

#### Banner

| Token Name | Light Value | Dark Value | Category |
|---|---|---|---|
| `--lb-component-banner-info-bg` | `#E0F2FE` | `#082F49` | component/banner |
| `--lb-component-banner-info-text` | `#1D4ED8` | `#7DD3FC` | component/banner |
| `--lb-component-banner-info-border` | `#3B82F6` | `#3B82F6` | component/banner |
| `--lb-component-banner-success-bg` | `#DCFCE7` | `#052E16` | component/banner |
| `--lb-component-banner-success-text` | `#15803D` | `#22C55E` | component/banner |
| `--lb-component-banner-success-border` | `#22C55E` | `#22C55E` | component/banner |
| `--lb-component-banner-warning-bg` | `#FEF3C7` | `#422006` | component/banner |
| `--lb-component-banner-warning-text` | `#92400E` | `#F59E0B` | component/banner |
| `--lb-component-banner-warning-border` | `#F59E0B` | `#F59E0B` | component/banner |
| `--lb-component-banner-danger-bg` | `#FEE2E2` | `#451A1A` | component/banner |
| `--lb-component-banner-danger-text` | `#B91C1C` | `#EF4444` | component/banner |
| `--lb-component-banner-danger-border` | `#EF4444` | `#EF4444` | component/banner |

#### Empty State

| Token Name | Light Value | Dark Value | Category |
|---|---|---|---|
| `--lb-component-empty-state-bg` | `#FFFFFF` | `#15131f` | component/empty-state |
| `--lb-component-empty-state-border` | `#E5E7EB` | `rgba(139,92,246,0.18)` | component/empty-state |
| `--lb-component-empty-state-title` | `#111827` | `#FFFFFF` | component/empty-state |
| `--lb-component-empty-state-body` | `#6B7280` | `#CBD5E1` | component/empty-state |

---

## Typography Tokens

### Font Family (`--lb-font-family-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-font-family-body` | `var(--font-letbuyy-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | typography/font-family |
| `--lb-font-family-display` | `var(--font-letbuyy-display), var(--font-letbuyy-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | typography/font-family |
| `--lb-font-family-mono` | `var(--font-letbuyy-mono), "SFMono-Regular", Consolas, "Liberation Mono", monospace` | typography/font-family |

### Font Size (`--lb-font-size-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-font-size-display` | `32px` | typography/size |
| `--lb-font-size-display-fluid` | `clamp(2.75rem, 2.1rem + 2vw, 3.5rem)` | typography/size/fluid |
| `--lb-font-size-h1` | `28px` | typography/size |
| `--lb-font-size-h1-fluid` | `clamp(1.75rem, 1.45rem + 0.9vw, 2rem)` | typography/size/fluid |
| `--lb-font-size-h2` | `24px` | typography/size |
| `--lb-font-size-h2-fluid` | `clamp(1.375rem, 1.18rem + 0.5vw, 1.5rem)` | typography/size/fluid |
| `--lb-font-size-h3` | `20px` | typography/size |
| `--lb-font-size-h4` | `18px` | typography/size (compat alias for heading) |
| `--lb-font-size-page-title` | `24px` | typography/size |
| `--lb-font-size-section-title` | `18px` | typography/size |
| `--lb-font-size-card-title` | `16px` | typography/size |
| `--lb-font-size-body-large` | `16px` | typography/size |
| `--lb-font-size-heading` | `18px` | typography/size (canonical role) |
| `--lb-font-size-body` | `14px` | typography/size |
| `--lb-font-size-secondary` | `13px` | typography/size |
| `--lb-font-size-table` | `13px` | typography/size |
| `--lb-font-size-sidebar` | `14px` | typography/size |
| `--lb-font-size-empty-state` | `14px` | typography/size |
| `--lb-font-size-small` | `13px` | typography/size |
| `--lb-font-size-caption` | `12px` | typography/size |
| `--lb-font-size-badge` | `12px` | typography/size |

### Line Height (`--lb-line-height-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-line-height-display` | `40px` | typography/line-height |
| `--lb-line-height-display-fluid` | `1.1` | typography/line-height |
| `--lb-line-height-h1` | `36px` | typography/line-height |
| `--lb-line-height-h1-fluid` | `1.2` | typography/line-height |
| `--lb-line-height-h2` | `32px` | typography/line-height |
| `--lb-line-height-h2-fluid` | `1.25` | typography/line-height |
| `--lb-line-height-h3` | `28px` | typography/line-height |
| `--lb-line-height-h4` | `24px` | typography/line-height |
| `--lb-line-height-page-title` | `32px` | typography/line-height |
| `--lb-line-height-section-title` | `24px` | typography/line-height |
| `--lb-line-height-card-title` | `20px` | typography/line-height |
| `--lb-line-height-body-large` | `24px` | typography/line-height |
| `--lb-line-height-heading` | `24px` | typography/line-height |
| `--lb-line-height-body` | `20px` | typography/line-height |
| `--lb-line-height-secondary` | `18px` | typography/line-height |
| `--lb-line-height-table` | `18px` | typography/line-height |
| `--lb-line-height-sidebar` | `20px` | typography/line-height |
| `--lb-line-height-empty-state` | `20px` | typography/line-height |
| `--lb-line-height-small` | `18px` | typography/line-height |
| `--lb-line-height-caption` | `16px` | typography/line-height |
| `--lb-line-height-badge` | `16px` | typography/line-height |

### Font Weight (`--lb-font-weight-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-font-weight-regular` | `400` | typography/weight |
| `--lb-font-weight-medium` | `500` | typography/weight |
| `--lb-font-weight-semibold` | `600` | typography/weight |
| `--lb-font-weight-bold` | `700` | typography/weight |

---

## Spacing Tokens (`--lb-space-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-space-0` | `0` | spacing |
| `--lb-space-1` | `4px` | spacing |
| `--lb-space-2` | `8px` | spacing |
| `--lb-space-3` | `12px` | spacing |
| `--lb-space-4` | `16px` | spacing |
| `--lb-space-5` | `20px` | spacing |
| `--lb-space-6` | `24px` | spacing |
| `--lb-space-7` | `32px` | spacing |
| `--lb-space-8` | `40px` | spacing |
| `--lb-space-9` | `48px` | spacing |
| `--lb-space-10` | `64px` | spacing |
| `--lb-space-11` | `96px` | spacing |
| `--lb-space-xs` | `4px` | spacing (named alias for space-1) |
| `--lb-space-sm` | `8px` | spacing (named alias for space-2) |
| `--lb-space-md` | `12px` | spacing (named alias for space-3) |
| `--lb-space-lg` | `16px` | spacing (named alias for space-4) |
| `--lb-space-xl` | `20px` | spacing (named alias for space-5) |

---

## Border Radius Tokens (`--lb-radius-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-radius-sm` | `4px` | radius |
| `--lb-radius-md` | `8px` | radius |
| `--lb-radius-lg` | `12px` | radius |
| `--lb-radius-xl` | `16px` | radius |
| `--lb-radius-full` | `999px` | radius |

---

## Shadow Tokens (`--lb-shadow-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-shadow-sm` | `0 1px 2px rgb(0 0 0 / 4%)` | shadow |
| `--lb-shadow-md` | `0 4px 12px rgb(15 23 42 / 6%)` | shadow |
| `--lb-shadow-lg` | `0 12px 32px rgb(15 23 42 / 8%)` | shadow |
| `--lb-shadow-card-light` | `0 1px 2px rgb(15 23 42 / 5%), 0 8px 24px rgb(15 23 42 / 4%)` | shadow |
| `--lb-shadow-card-dark` | `0 1px 2px rgb(0 0 0 / 18%), 0 10px 26px rgb(0 0 0 / 16%)` | shadow |

---

## Z-Index Tokens (`--lb-z-*`)

| Token Name | Value | Category | Used In |
|---|---|---|---|
| `--lb-z-base` | `0` | z-index | Default layer |
| `--lb-z-dropdown` | `30` | z-index | Popover, Dropdown panels |
| `--lb-z-sticky` | `40` | z-index | Sticky UI elements |
| `--lb-z-overlay` | `50` | z-index | Overlay backdrops |
| `--lb-z-modal` | `60` | z-index | Modal, Drawer containers |
| `--lb-z-toast` | `70` | z-index | Toast notifications |
| `--lb-z-tooltip` | `80` | z-index | Tooltip panels |

---

## Motion Tokens

### Duration (`--lb-motion-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-motion-fast` | `150ms` | motion/duration |
| `--lb-motion-hover` | `150ms` | motion/duration |
| `--lb-motion-menu` | `150ms` | motion/duration |
| `--lb-motion-carousel` | `300ms` | motion/duration |
| `--lb-motion-normal` | `180ms` | motion/duration |
| `--lb-motion-slow` | `200ms` | motion/duration |

### Easing (`--lb-ease-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-ease-standard` | `ease-out` | motion/easing |
| `--lb-ease-out` | `ease-out` | motion/easing |
| `--lb-ease-emphasized` | `cubic-bezier(0.16, 1, 0.3, 1)` | motion/easing |

### Transform (`--lb-motion-hover-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-motion-hover-lift` | `2px` | motion/transform |
| `--lb-motion-hover-scale` | `1.01` | motion/transform |

---

## Breakpoint Tokens (`--lb-bp-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-bp-xs` | `360px` | breakpoint |
| `--lb-bp-mobile` | `480px` | breakpoint |
| `--lb-bp-sm` | `640px` | breakpoint |
| `--lb-bp-md` | `768px` | breakpoint |
| `--lb-bp-tablet` | `768px` | breakpoint (alias for md) |
| `--lb-bp-lg` | `1024px` | breakpoint |
| `--lb-bp-desktop` | `1024px` | breakpoint (alias for lg) |
| `--lb-bp-xl` | `1280px` | breakpoint |
| `--lb-bp-wide` | `1280px` | breakpoint (alias for xl) |

---

## Size Tokens (`--lb-size-*`)

| Token Name | Value | Category |
|---|---|---|
| `--lb-size-control-sm` | `var(--lb-density-icon-button-height)` | size/control |
| `--lb-size-control-md` | `var(--lb-density-button-height)` | size/control |
| `--lb-size-control-lg` | `var(--lb-density-button-height-large)` | size/control |
| `--lb-size-icon` | `var(--lb-density-icon-button-height)` | size/icon |
| `--lb-size-icon-inline` | `var(--lb-density-action-icon-size)` | size/icon |
| `--lb-size-page-header-height` | `var(--lb-density-header-height)` | size/layout |
| `--lb-size-page-max` | `1440px` | size/layout |
| `--lb-size-marketplace-container` | `1200px` | size/layout |
| `--lb-size-content-measure` | `720px` | size/layout |
| `--lb-size-empty-state-measure` | `440px` | size/layout |
| `--lb-size-save-bar-width` | `920px` | size/layout |
| `--lb-size-skeleton-card-height` | `120px` | size/layout |
| `--lb-size-empty-state-min-height` | `var(--lb-density-empty-state-min-height)` | size/layout |
| `--lb-size-combobox-menu-max-height` | `280px` | size/overlay |
| `--lb-size-tooltip-max-width` | `240px` | size/overlay |
| `--lb-size-metric-sparkline-width` | `96px` | size/chart |
| `--lb-size-metric-sparkline-height` | `40px` | size/chart |
| `--lb-size-chart-height-sm` | `160px` | size/chart |
| `--lb-size-chart-height-md` | `220px` | size/chart |
| `--lb-size-chart-height-lg` | `280px` | size/chart |
| `--lb-size-table-row-height` | `var(--lb-density-table-row-height)` | size/table |
| `--lb-size-table-header-height` | `var(--lb-density-table-header-height)` | size/table |
| `--lb-size-table-toolbar-height` | `var(--lb-density-action-bar-height)` | size/table |
| `--lb-size-command-palette-width` | `720px` | size/overlay |
| `--lb-size-command-palette-list-max-height` | `360px` | size/overlay |
| `--lb-size-command-palette-offset` | `12vh` | size/overlay |

---

## Density Tokens (`--lb-density-*`)

All three density values are listed. Default is compact.

| Token Name | compact | comfortable | spacious | Category |
|---|---|---|---|---|
| `--lb-density-sidebar-row-height` | `40px` | `44px` | `48px` | density/height |
| `--lb-density-input-height` | `36px` | `40px` | `44px` | density/height |
| `--lb-density-button-height` | `36px` | `40px` | `44px` | density/height |
| `--lb-density-button-height-large` | `40px` | `44px` | `48px` | density/height |
| `--lb-density-icon-button-height` | `32px` | `36px` | `40px` | density/height |
| `--lb-density-pill-height` | `28px` | `32px` | `36px` | density/height |
| `--lb-density-table-row-height` | `44px` | `48px` | `52px` | density/height |
| `--lb-density-table-header-height` | `44px` | `48px` | `52px` | density/height |
| `--lb-density-page-gap` | `12px` | `16px` | `20px` | density/spacing |
| `--lb-density-section-gap` | `12px` | `16px` | `20px` | density/spacing |
| `--lb-density-card-gap` | `16px` | `20px` | `24px` | density/spacing |
| `--lb-density-card-padding` | `16px` | `20px` | `24px` | density/spacing |
| `--lb-density-header-height` | `64px` | `72px` | `88px` | density/height |
| `--lb-density-action-bar-height` | `36px` | `40px` | `44px` | density/height |
| `--lb-density-modal-padding` | `16px` | `20px` | `24px` | density/spacing |
| `--lb-density-empty-state-scale` | `0.72` | `0.88` | `1` | density/scale |
| `--lb-density-empty-state-illustration-width` | `160px` | `184px` | `208px` | density/size |
| `--lb-density-empty-state-illustration-height` | `108px` | `122px` | `138px` | density/size |
| `--lb-density-empty-state-min-height` | `180px` | `220px` | `260px` | density/size |
| `--lb-density-page-icon-size` | `18px` | `20px` | `22px` | density/icon |
| `--lb-density-sidebar-icon-size` | `18px` | `18px` | `20px` | density/icon |
| `--lb-density-sidebar-nested-spacing` | `8px` | `8px` | `12px` | density/spacing |
| `--lb-density-sidebar-section-spacing` | `16px` | `16px` | `20px` | density/spacing |
| `--lb-density-button-icon-size` | `16px` | `16px` | `18px` | density/icon |
| `--lb-density-table-icon-size` | `14px` | `14px` | `16px` | density/icon |
| `--lb-density-action-icon-size` | `16px` | `16px` | `18px` | density/icon |

---

## Tailwind v4 Theme Tokens (from `config/tailwind/letbuyy-tokens.css`)

These are declared in the `@theme` block and generate Tailwind utility classes.

| Tailwind Token | Resolves To | Generated Classes |
|---|---|---|
| `--breakpoint-xs` | `360px` | `xs:` responsive prefix |
| `--breakpoint-mobile` | `480px` | `mobile:` responsive prefix |
| `--breakpoint-sm` | `640px` | `sm:` responsive prefix |
| `--breakpoint-md` | `768px` | `md:` responsive prefix |
| `--breakpoint-lg` | `1024px` | `lg:` responsive prefix |
| `--breakpoint-xl` | `1280px` | `xl:` responsive prefix |
| `--color-surface` | `var(--lb-color-surface)` | `bg-surface`, `text-surface`, `border-surface` |
| `--color-surface-raised` | `var(--lb-color-surface-raised)` | `bg-surface-raised` |
| `--color-surface-subdued` | `var(--lb-color-surface-subdued)` | `bg-surface-subdued` |
| `--color-card` | `var(--lb-color-card)` | `bg-card` |
| `--color-page` | `var(--lb-color-bg)` | `bg-page` |
| `--color-sidebar` | `var(--lb-color-sidebar)` | `bg-sidebar` |
| `--color-default` | `var(--lb-color-text)` | `text-default` |
| `--color-subdued` | `var(--lb-color-text-subdued)` | `text-subdued` |
| `--color-muted` | `var(--lb-color-text-muted)` | `text-muted` |
| `--color-inverse` | `var(--lb-color-text-inverse)` | `text-inverse` |
| `--color-primary` | `var(--lb-color-primary)` | `bg-primary`, `text-primary` |
| `--color-primary-cta` | `var(--lb-color-primary-cta)` | `bg-primary-cta` |
| `--color-primary-soft` | `var(--lb-color-primary-soft)` | `bg-primary-soft` |
| `--color-critical` | `var(--lb-color-critical)` | `text-critical`, `bg-critical` |
| `--color-success` | `var(--lb-color-success)` | `text-success`, `bg-success` |
| `--color-warning` | `var(--lb-color-warning)` | `text-warning`, `bg-warning` |
| `--color-info` | `var(--lb-color-info)` | `text-info`, `bg-info` |
| `--color-line` | `var(--lb-color-border)` | `border-line` |
| `--color-line-subtle` | `var(--lb-color-border-subtle)` | `border-line-subtle` (NOTE: source variable deprecated) |
| `--color-focus` | `var(--lb-color-focus-ring)` | `ring-focus`, `border-focus` |

---

## Primitive Color Tokens (emitted as `--lb-primitive-color-*`)

These are auto-generated from `letbuyyPrimitiveTokens` via `appendTokenVariables`. They are private — never use in product code.

| Token Name | Value | Category |
|---|---|---|
| `--lb-primitive-color-purple-100` | `#EDE9FE` | primitive/color |
| `--lb-primitive-color-purple-200` | `#DDD6FE` | primitive/color |
| `--lb-primitive-color-purple-300` | `#C4B5FD` | primitive/color |
| `--lb-primitive-color-purple-400` | `#A78BFA` | primitive/color |
| `--lb-primitive-color-purple-500` | `#8B5CF6` | primitive/color |
| `--lb-primitive-color-purple-600` | `#7C3AED` | primitive/color |
| `--lb-primitive-color-purple-700` | `#6D28D9` | primitive/color |
| `--lb-primitive-color-purple-800` | `#5B21B6` | primitive/color |
| `--lb-primitive-color-purple-900` | `#4C1D95` | primitive/color |
| `--lb-primitive-color-gray-50` | `#F9FAFB` | primitive/color |
| `--lb-primitive-color-gray-100` | `#F5F5F7` | primitive/color |
| `--lb-primitive-color-gray-125` | `#F6F7F9` | primitive/color |
| `--lb-primitive-color-gray-150` | `#EFEFF1` | primitive/color |
| `--lb-primitive-color-gray-175` | `#F1F2F4` | primitive/color |
| `--lb-primitive-color-gray-200` | `#E5E7EB` | primitive/color |
| `--lb-primitive-color-gray-300` | `#D1D5DB` | primitive/color |
| `--lb-primitive-color-gray-400` | `#94A3B8` | primitive/color |
| `--lb-primitive-color-gray-500` | `#6B7280` | primitive/color |
| `--lb-primitive-color-gray-600` | `#4B5563` | primitive/color |
| `--lb-primitive-color-gray-700` | `#374151` | primitive/color |
| `--lb-primitive-color-gray-800` | `#1F2937` | primitive/color |
| `--lb-primitive-color-gray-900` | `#111827` | primitive/color |
| `--lb-primitive-color-slate-50` | `#F8FAFC` | primitive/color |
| `--lb-primitive-color-slate-100` | `#F1F5F9` | primitive/color |
| `--lb-primitive-color-slate-200` | `#E2E8F0` | primitive/color |
| `--lb-primitive-color-slate-300` | `#CBD5E1` | primitive/color |
| `--lb-primitive-color-slate-400` | `#94A3B8` | primitive/color |
| `--lb-primitive-color-slate-500` | `#64748B` | primitive/color |
| `--lb-primitive-color-slate-600` | `#475569` | primitive/color |
| `--lb-primitive-color-slate-700` | `#334155` | primitive/color |
| `--lb-primitive-color-slate-800` | `#1E293B` | primitive/color |
| `--lb-primitive-color-slate-850` | `#1F2937` | primitive/color |
| `--lb-primitive-color-slate-900` | `#0F172A` | primitive/color |
| `--lb-primitive-color-slate-950` | `#0A0F1A` | primitive/color |
| `--lb-primitive-color-ink-950` | `#0a0912` | primitive/color |
| `--lb-primitive-color-ink-900` | `#0d0b15` | primitive/color |
| `--lb-primitive-color-ink-850` | `#0d0b16` | primitive/color |
| `--lb-primitive-color-ink-800` | `#15131f` | primitive/color |
| `--lb-primitive-color-ink-700` | `#1b1827` | primitive/color |
| `--lb-primitive-color-white` | `#FFFFFF` | primitive/color |
| `--lb-primitive-color-black` | `#000000` | primitive/color |
| `--lb-primitive-color-green-100` | `#DCFCE7` | primitive/color |
| `--lb-primitive-color-green-500` | `#22C55E` | primitive/color |
| `--lb-primitive-color-green-700` | `#15803D` | primitive/color |
| `--lb-primitive-color-green-950` | `#052E16` | primitive/color |
| `--lb-primitive-color-amber-100` | `#FEF3C7` | primitive/color |
| `--lb-primitive-color-amber-500` | `#F59E0B` | primitive/color |
| `--lb-primitive-color-amber-800` | `#92400E` | primitive/color |
| `--lb-primitive-color-amber-950` | `#422006` | primitive/color |
| `--lb-primitive-color-red-100` | `#FEE2E2` | primitive/color |
| `--lb-primitive-color-red-300` | `#FCA5A5` | primitive/color |
| `--lb-primitive-color-red-500` | `#EF4444` | primitive/color |
| `--lb-primitive-color-red-600` | `#DC2626` | primitive/color |
| `--lb-primitive-color-red-700` | `#B91C1C` | primitive/color |
| `--lb-primitive-color-red-950` | `#451A1A` | primitive/color |
| `--lb-primitive-color-pink-300` | `#F9A8D4` | primitive/color |
| `--lb-primitive-color-pink-400` | `#F472B6` | primitive/color |
| `--lb-primitive-color-pink-500` | `#EC4899` | primitive/color |
| `--lb-primitive-color-pink-600` | `#DB2777` | primitive/color |
| `--lb-primitive-color-pink-700` | `#BE185D` | primitive/color |
| `--lb-primitive-color-blue-100` | `#E0F2FE` | primitive/color |
| `--lb-primitive-color-blue-300` | `#7DD3FC` | primitive/color |
| `--lb-primitive-color-blue-500` | `#3B82F6` | primitive/color |
| `--lb-primitive-color-blue-700` | `#1D4ED8` | primitive/color |
| `--lb-primitive-color-blue-950` | `#082F49` | primitive/color |
| `--lb-primitive-color-cyan-500` | `#06B6D4` | primitive/color |
| `--lb-primitive-color-teal-500` | `#14B8A6` | primitive/color |
| `--lb-primitive-color-emerald-500` | `#10B981` | primitive/color |
| `--lb-primitive-opacity-purple-subtle` | `rgba(139, 92, 246, 0.12)` | primitive/opacity |
| `--lb-primitive-opacity-overlay-light` | `rgb(15 23 42 / 56%)` | primitive/opacity |
| `--lb-primitive-opacity-overlay-dark` | `rgb(0 0 0 / 64%)` | primitive/opacity |

---

## Deprecated Tokens (removed from CSS output)

These token names previously existed but are no longer emitted in `letbuyyTokenCss`. Any reference to them will silently resolve to the browser default (unset).

| Token Name | Reason |
|---|---|
| `--lb-color-text-primary` | Replaced by `--lb-color-text` |
| `--lb-color-text-secondary` | Replaced by `--lb-color-text-subdued` |
| `--lb-color-border-default` | Replaced by `--lb-color-border` |
| `--lb-color-border-subtle` | Replaced by `--lb-color-border` |
| `--lb-color-danger` | Replaced by `--lb-color-critical` |
| `--lb-semantic-focus-ring` | Replaced by `--lb-color-focus-ring` |
| `--lb-semantic-accent-brand` | Replaced by `--lb-color-primary` |
| `--lb-semantic-accent-text` | Replaced by `--lb-color-primary-text` |
| `--lb-semantic-text-primary` | Replaced by `--lb-color-text` |
| `--lb-semantic-text-secondary` | Replaced by `--lb-color-text-subdued` |
| `--lb-semantic-text-muted` | Replaced by `--lb-color-text-muted` |

---

## Token Summary Counts

| Category | Count |
|---|---|
| Semantic color tokens (`--lb-color-*`) | ~35 |
| Component color tokens (`--lb-component-*`) | ~40 |
| Static color reference tokens | 10 |
| Typography tokens (font-size, line-height, weight, family) | ~50 |
| Spacing tokens (`--lb-space-*`) | 17 |
| Density tokens (`--lb-density-*`, 3 presets × 25 vars) | 25 variables |
| Radius tokens (`--lb-radius-*`) | 5 |
| Shadow tokens (`--lb-shadow-*`) | 5 |
| Motion tokens (duration, easing, transform) | 11 |
| Z-index tokens (`--lb-z-*`) | 7 |
| Size tokens (`--lb-size-*`) | 24 |
| Breakpoint tokens (`--lb-bp-*`) | 9 |
| Primitive color tokens (`--lb-primitive-color-*`) | ~70 |
| Tailwind theme tokens | 24 |
| **Total (approximate)** | **~330 unique CSS custom properties** |
