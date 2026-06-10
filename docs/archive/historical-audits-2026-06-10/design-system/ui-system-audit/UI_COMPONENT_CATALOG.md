# UI_COMPONENT_CATALOG.md

**Scope:** `@letbuyy/ui` (`packages/typescript/ui`)
**Audit date:** 2026-06-06
**Package version:** `0.0.1` (private, `main`/`types` → `./src/index.ts` — ships raw TSX, no build artifact)
**Source size:** 25 files, ~7,512 LOC TS/TSX. 18 component/logic modules + 4 Storybook stories + token/style infra.
**Public surface:** ~88 value exports from `index.ts` + 4 subpath entrypoints (`./formatting`, `./logging`, `./marketplace`, `./tokens`) + ~150 re-exported `lucide-react` icons.

---

## Executive summary (for leadership)

`@letbuyy/ui` is a **broad, genuinely component-rich library** — roughly **50 React components** across layout, forms, feedback, overlays, data display, and "productivity" patterns (IndexTable, CommandPalette, MetricCard). It is consumed by **9 apps across 203 files**, so it already behaves as the de-facto foundation. The catalog below is complete.

Two structural facts shape everything that follows:

1. **Coverage is wide but shallow in places.** Several marquee patterns expected of a Shopify/Stripe-class system are **absent**: there is no `Drawer`, no `Dropdown`/`Menu`/`Popover`, no `Accordion`, no toast-less `Notification`, no `Pagination` beyond prev/next. The brief's Phase 4 asks us to trace `Drawer` and `Dropdown` — **neither exists.**
2. **The surface has duplication and aliasing.** `DataTable` vs `IndexTable` (two tables), `Page`≡`PageShell`, `PageActions`≡`PageHeaderActions`, `FilterBar`≡`TableFilterBar`, `Text` vs `TextStyle`. None of this is fatal, but it inflates the public API and creates "which one do I use?" ambiguity.

> **Counting note (read this):** the inline "uses" figures in this catalog are *repo-wide* JSX instantiations (incl. the library's own Storybook stories). The **canonical, apps-only product-consumption counts — the true blast radius — live in [`UI_USAGE_GRAPH.md`](./UI_USAGE_GRAPH.md)** and are lower (e.g. Card 284, Section 261, Button 218, Badge 114, Input 103). **17 exported components have *zero* app adoption** (Storybook-only): `Box`, `BlockStack`, `InlineStack`, `Text`, `TextStyle`, `Checkbox`, `Radio`, `ChoiceList`, `Combobox`, `Tooltip`, `Spinner`, `Divider`, `Pagination`, `Breadcrumbs`, `FilterChips`, `DensityToggle`, `DateRangePicker`. Where a component below is one of those, it is marked **⚪ zero app adoption**.

**Usage counts** below are JSX instantiations (`<Component`). They are the single most important number per component: they are the blast radius.

---

## Module map

| Module | Components / exports |
|---|---|
| `button.tsx` | `Button` |
| `input.tsx` | `Input`, `Textarea` |
| `data-table.tsx` | `DataTable` (+ re-exports `Badge` from feedback) |
| `layout.tsx` | `Box`, `BlockStack`, `InlineStack`, `Text`, `Page`, `PageShell`, `PageContent`, `PageHeader`, `PageHeaderActions`, `PageActions`, `Section`, `Card`, `getPageIconName`, `letbuyyPageHeaderDefaults` |
| `feedback.tsx` | `Badge`, `Banner`, `EmptyState`, `EmptyStateIllustration`, `SaveBar`, `Skeleton`, `ToastProvider`, `useToast` |
| `overlays.tsx` | `Modal`, `ConfirmDialog`, `Tooltip` |
| `controls.tsx` | `Tabs`, `Checkbox`, `Radio`, `ChoiceList`, `Select`, `Combobox` |
| `productivity.tsx` | `MetricCard`, `Avatar`, `Pagination`, `IndexTable`, `FilterBar`, `TableFilterBar`, `CommandPalette` |
| `primitives.tsx` | `Chart`, `DateRangePicker`, `DensityToggle`, `FilterChips`, `ProgressBar`, `Breadcrumbs`, `DescriptionList`, `Divider`, `Spinner`, `TextStyle` |
| `visual.tsx` | `ColorSwatch`, `ColorPreviewBlock`, `ColorPreviewSurface`, `RadiusPreview`, `ColorPreviewButton` (Storybook/preview helpers, shipped in main bundle) |
| `design-system-root.tsx` | `DesignSystemRoot` (provider) |
| `tokens.ts` | `letbuyyTokens`, `letbuyyPrimitiveTokens`, `letbuyySemanticTokens`, `letbuyyComponentTokens`, `letbuyyDensityTokens`, `letbuyyColorTokens`, `letbuyyTokenCss`, `letbuyyTokenCssVariables`, `letbuyyDensityCssVariables` |
| `fonts.ts` | `letbuyyFontStacks`, `letbuyyFontCssVariables` |
| `formatting.ts` | `formatInrCurrency` (index) + `formatDisplayDate`, `formatIndiaDate*`, `formatUs*Date` (subpath-only — **not in `index.ts`**) |
| `icons.tsx` | ~150 `lucide-react` re-exports, `MaterialIcon`, `materialIconMap`, `MaterialIconName` |
| `marketplace.tsx` | `MarketplaceUnavailable` (subpath `./marketplace`) |
| `logging.ts` | logging helpers (subpath `./logging`) |

---

## 1. Actions & forms

### Button — `button.tsx` · **267 uses**
**Purpose:** Primary interactive control. The single most important interactive primitive.
**Props:** `variant?: 'primary'|'secondary'|'outline'|'ghost'|'destructive'` (default `primary`), `size?: 'sm'|'md'|'lg'|'icon'` (default `md`), `loading?: boolean`, `fullWidth?: boolean`, plus all native `<button>` attributes.
**Deps:** `Loader2` (icon), `cx`. Styling 100% via component-token CSS vars (`--lb-component-button-*`).
**Notes:** Clean, idiomatic. `loading` disables and shows spinner. No `iconLeading`/`iconTrailing` props (icons passed as children). No `asChild`/polymorphism — cannot render as `<a>` (consumers hand-roll link buttons; see `PageHeader.renderDefaultAction`).

### Input / Textarea — `input.tsx` · **Input 114, Textarea 22**
**Purpose:** Single-line / multi-line text entry with label, helper, error, icon affordances.
**Input props:** `label?`, `helperText?`, `error?`, `leftIcon?`, `rightIcon?` + native input attrs.
**Textarea props:** `label?`, `helperText?`, `error?` + native textarea attrs.
**Deps:** `cx` only.
**Risk flags:** (1) `id` is derived from label text — `id || label?.toLowerCase().replace(/\s+/g,'-')` — **duplicate labels produce duplicate DOM IDs** and broken `htmlFor`. (2) **No `aria-describedby`/`aria-invalid` wiring** to the error/helper text, unlike the `controls.tsx` family. The most-used input component has the weakest a11y in the library.

### Checkbox / Radio — `controls.tsx` · **⚪ zero app adoption** (apps use raw `<input type=checkbox>`)
**Purpose:** Labeled boolean / single-choice inputs with description, helper, error.
**Props (both):** `label: ReactNode`, `description?`, `helperText?`, `error?`, `onCheckedChange?(checked)`, plus class-name slots (`inputClassName`, `labelClassName`, `labelTextClassName`, `wrapperClassName`) + native input attrs.
**Deps:** `useId`, `cx`. **A11y: strong** — `useId`, `aria-describedby` chain, `aria-invalid`.

### ChoiceList — `controls.tsx`
**Purpose:** Polaris-style grouped choices (single or multiple) rendered as bordered option cards.
**Props:** `options: ChoiceListOption[]`, `title?`, `description?`, `helperText?`, `error?`, `name?`, `value?`, `defaultValue?`, `onChange?`, `multiple?`, `disabled?`, `requiredIndicator?`, `ariaLabel?`, `layout?: 'vertical'|'horizontal'`, class-name slots.
**Deps:** `useId`, `cx`. Controlled + uncontrolled supported.

### Select — `controls.tsx` · **29 uses**
**Purpose:** Native `<select>` wrapper with label/helper/error, prefix content, sizes.
**Props:** `label?`, `helperText?`, `error?`, `options: SelectOption[]`, `placeholder?`, `requiredIndicator?`, `labelAction?`, `prefixContent?`, `controlSize?: 'sm'|'md'|'lg'`, `hideLabel?` + native select attrs.
**A11y:** `aria-invalid`, `aria-describedby`, `aria-required`. Custom chevron, native options.

### Combobox — `controls.tsx` · **⚪ zero app adoption**
**Purpose:** Autocomplete/typeahead with filterable listbox, keyboard nav.
**Props:** `options`, `value?`, `onValueChange?`, `query?`/`defaultQuery?`/`onQueryChange?`, `loading?`, `emptyMessage?`, `label?`, `helperText?`, `error?`, `disabled?`, `required?`, `requiredIndicator?`, `labelAction?`, class slots.
**A11y: strong** — `role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-activedescendant`, full Arrow/Enter/Escape handling. Filters on label + description + keywords.

---

## 2. Layout & structure

### Card — `layout.tsx` · **328 uses (most-used component in the system)**
**Purpose:** The universal surface container.
**Props:** `layout?: 'default'|'stack'|'split'` + native div attrs. Styling via `--lb-component-card-*` (radius 16px, border, bg, shadow). `overflow-hidden`, `min-w-0`.
**Notes:** Intentionally minimal — no built-in header/footer/section slots; composition is via `Section` inside `Card`. Emits `data-lb-card-layout`.

### Section — `layout.tsx` · **307 uses**
**Purpose:** Titled content block (title/description/action header + columned body) used inside `Card`/`Page`.
**Props:** `title?`, `description?`, `action?`, `columns?: 1|2|3` + native attrs.

### Page / PageShell / PageContent — `layout.tsx` · **Page 81, PageContent 11**
**Purpose:** Page frame: `Page` = centered `max-w-[--lb-size-page-max]` (1440px) main with density gap; `PageContent` = vertical stack of sections; `PageShell` = **exact alias of `Page`** (`<Page {...props}/>`).
**Notes:** `PageShell` adds nothing — dead alias.

### PageHeader / PageHeaderActions / PageActions — `layout.tsx` · **PageHeader 93**
**Purpose:** Page title row with icon, eyebrow, breadcrumbs, description, primary/secondary actions.
**Props (PageHeader):** `title`, `description?`, `eyebrow?`, `breadcrumbs?`, `identity?: PageIdentity`, `icon?`, `iconName?`, `showIcon?`, `showBreadcrumb(s)?`, `showEyebrow?`, `showSectionLabel?`, `showDescription?`, `primaryAction?`, `secondaryActions?`, `renderAction?`.
**Risk flags:** (1) **Builds its own `<button>`/`<a>` via `renderDefaultAction` rather than using `Button`** → divergent button rendering. (2) Prop-name redundancy: `showBreadcrumb`/`showBreadcrumbs`, `showEyebrow`/`showSectionLabel` (two names each). (3) `PageActions` is an alias of `PageHeaderActions`.

### Box / BlockStack / InlineStack — `layout.tsx` · **⚪ zero app adoption**
**Purpose:** Polaris-style layout primitives. `Box` (padding/tone/border/radius/shadow, polymorphic `as`), `BlockStack` (vertical flex + gap/align/justify), `InlineStack` (horizontal + wrap).
**Props:** `Box`: `as?`, `padding?/paddingBlock?/paddingInline?: SpaceScale`, `tone?`, `border?`, `radius?`, `shadow?`. Stacks: `as?`, `gap?: SpaceScale`, `align?`, `justify?`, (`InlineStack` adds `wrap?`).
**Notes:** Strong primitives with **zero production adoption** — apps hand-roll raw `<div className="flex …">` instead. Some of the highest-quality, lowest-used code in the library.

### Text vs TextStyle — `layout.tsx` / `primitives.tsx` · **⚪ both zero app adoption**
**Two overlapping text components, neither adopted in apps.** `Text` (`variant: display|heading|body|caption`, `tone`, `weight`, `align`, `truncate`, polymorphic) and `TextStyle` (`variant: body|subdued|strong|positive|negative|code`) are redundant typography APIs; apps render raw `<p>`/`<span>` with utility classes instead. Merge into one and drive adoption.

### Divider / DescriptionList — `primitives.tsx` · **Divider 4, DescriptionList 7**
`Divider`: horizontal/vertical rule. `DescriptionList`: `dt/dd` grid, `columns?: 1|2`.

---

## 3. Feedback & status

### Badge — `feedback.tsx` (re-exported via `data-table.tsx`) · **152 uses**
**Purpose:** Status pill.
**Props:** `label: string`, `variant?: 'default'|'info'|'success'|'warning'|'critical'|'danger'` + native span attrs.
**Risk flag:** accepts **both** `'critical'` and `'danger'` (normalizes `danger`→`critical`) — dual vocabulary. Re-exported through `data-table.tsx`, so it appears to come from two modules.

### Banner — `feedback.tsx` · **96 uses**
**Purpose:** Inline contextual message. `variant?: 'info'|'success'|'warning'|'critical'`, `title?`, `action?`. `role` = `alert` (critical) / `status`.

### Skeleton — `feedback.tsx` · **92 uses**
`variant?: 'text'|'card'|'table'`, `lines?`. `aria-hidden`. Good loading primitive.

### EmptyState / EmptyStateIllustration — `feedback.tsx` · **EmptyState 72**
**Purpose:** Empty/zero-data state with per-domain illustration (14 kinds: products, orders, customers, …), title, body, primary/secondary actions. Hand-drawn SVG motifs + animated float (respects `prefers-reduced-motion`). One of the more polished pieces in the library.

### SaveBar — `feedback.tsx` · **22 uses**
Sticky unsaved-changes bar. `state: 'saved'|'unsaved'|'saving'`, `onSave?`, `onDiscard?`, labels. **Builds raw `<button>`s instead of `Button`.**

### ToastProvider / useToast — `feedback.tsx`
Context provider + hook. `notify({title, description?, variant?})` → auto-dismiss 5s; `aria-live="polite"` region. `useToast` throws outside provider. Solid.

### Spinner / ProgressBar — `primitives.tsx` · **Spinner 5, ProgressBar 11**
`Spinner`: `role="status"`, sr-only label, sizes. `ProgressBar`: `role="progressbar"` with `aria-valuemin/max/now`.

---

## 4. Overlays

### Modal — `overlays.tsx` · **1 app use** (+27 via ConfirmDialog)
**Purpose:** Centered dialog. `open`, `title`, `description?`, `onClose`, `footer?`.
**A11y:** `role="dialog"`, `aria-modal`, `aria-labelledby/describedby`, Escape-to-close. **Gap: no focus trap, no initial focus, no focus restoration, background not `inert`.** Backdrop is a full-screen `<button aria-label="Close modal">`.

### ConfirmDialog — `overlays.tsx` · **29 uses**
Wraps `Modal` with confirm/cancel `Button`s. `destructive?` switches the confirm button to `destructive`. **Hardcodes body copy** ("This action can affect merchant data…") in addition to `description` — opinionated and surprising.

### Tooltip — `overlays.tsx` · **⚪ zero app adoption**
CSS-only hover/focus-within. `content`, `side?: 'top'|'bottom'`. `role="tooltip"` but **not linked to its trigger via `aria-describedby`**.

### CommandPalette — `productivity.tsx` · **3 uses**
⌘K-style action palette. `open`, `actions`, `onClose`, `placeholder?`. `role="dialog"`, Escape handling, autofocus search. **No focus trap.** Filters on label + description.

---

## 5. Data display

### DataTable — `data-table.tsx` · **2 app uses**
Simple table. `columns: Column<T>[]`, `data`, `loading?`, `emptyMessage?`, `onRowClick?`, sort props. Desktop-only `<table>`. **Legacy/simpler of the two tables.**

### IndexTable — `productivity.tsx` · **19 app uses**
Advanced table: row selection, bulk actions, saved views, filter chips, **mobile card layout** (`md:hidden` cards + `md:block` table), sort. `columns`, `rows` (requires `{id}`), `loading?`, `emptyState?`, `savedViews?`, `bulkActions?`, sort/`onRowClick`. **The strategic table; DataTable should be folded into it.** Builds its own checkboxes/sort pills/bulk buttons rather than using `Checkbox`/`Button`.

### MetricCard — `productivity.tsx` · **31 uses**
KPI card with `label`, `value`, `delta?`, `deltaTone?`, inline SVG `sparkline?: number[]`.

### Chart — `primitives.tsx` · **9 uses**
Hand-rolled SVG line/bar/area chart. `data`, `type?`, `ariaLabel` (required), `height?`, `showGrid?`, `showLabels?`, `valueFormatter?`. Includes sr-only `<dl>` data table — thoughtful a11y. No charting dependency.

### Avatar — `productivity.tsx` · **14 uses**
Initials/image avatar. `name`, `imageUrl?`, `size?`.

### Pagination — `productivity.tsx` · **⚪ zero app adoption**
Prev/next + "Page X of Y". `page`, `totalPages`, `onPageChange`. No page-number list, no page-size control.

---

## 6. Filtering & navigation

### FilterBar / TableFilterBar — `productivity.tsx` · **FilterBar 7**
Toolbar composing `search`/`filters`/`chips`/`actions`/`bulkActions` slots. `TableFilterBar` is an **alias**.

### FilterChips — `primitives.tsx` · **3 uses**
Removable active-filter chips + "clear all". `chips: FilterChip[]`, `onClearAll?`.

### Breadcrumbs — `primitives.tsx` · **2 uses**
`items: BreadcrumbItem[]`. `aria-current="page"` on last. (Note: `PageHeader` has its *own* inline breadcrumbs implementation — duplicated logic.)

### Tabs — `controls.tsx` · **6 uses**
`items: TabItem[]` (value/label/badge/icon/disabled/content), `variant?: 'underline'|'pills'`, controlled/uncontrolled. **A11y: strong** — `role="tablist/tab/tabpanel"`, roving `tabIndex`, Arrow/Home/End keyboard nav.

### DateRangePicker / DensityToggle — `primitives.tsx` · **3 each**
`DateRangePicker`: native date inputs + compare toggle. `DensityToggle`: segmented compact/comfortable/spacious switch (`aria-pressed`).

---

## 7. Provider, tokens, icons, utilities

### DesignSystemRoot — `design-system-root.tsx` · **9 uses (8 app layouts)**
**Purpose:** The root provider. Injects token CSS and sets theme/density/surface data attributes.
**Props:** `surface?: 'admin'|'marketplace'|'storefront'|'identity'|'operations'` (default `admin`), `theme?: 'light'|'dark'|'auto'` (default `auto`), `density?` (default `compact`), `includeTokenStyles?` (default `true`).
**Risk flags:** (1) **`surface` is inert** — nothing in the generated token CSS keys off `data-letbuyy-surface`. (2) `theme="auto"` resolves to `undefined` → falls back to light; **no `prefers-color-scheme`** so "auto" never follows the OS. (3) `includeTokenStyles` defaults true → **every instance injects the full token `<style>`** (duplication if nested/multiple).

### Token exports — `tokens.ts`
`letbuyyTokens` (primitive→semantic→component→density→flattened color/typography/space/radius/shadow/motion/size), plus `letbuyyTokenCss`/`letbuyyTokenCssVariables`/`letbuyyDensityCssVariables`. **No app imports these directly** (consumption is via CSS variables) — the large TS token API is used only to generate CSS + power Storybook. See `DESIGN_TOKEN_AUDIT.md`.

### Icons — `icons.tsx` · **MaterialIcon 114**
~150 `lucide-react` icons re-exported by name, plus `MaterialIcon` (maps Material Symbol names → lucide via `materialIconMap`) which wraps output in `.letbuyy-icon` for CSS sizing. `MaterialIconName` is `keyof materialIconMap | (string & {})` — accepts any string, so typos don't type-error.

### Visual preview helpers — `visual.tsx`
`ColorSwatch`, `ColorPreviewBlock/Surface/Button`, `RadiusPreview`. **Storybook/design-doc helpers shipped in the production bundle** via `index.ts`.

### Utilities — `utils.ts`, `fonts.ts`, `formatting.ts`, `marketplace.tsx`, `logging.ts`
`cx(...)` — naive class joiner (filter + join), **no `tailwind-merge`** so conflicting utilities don't resolve. `letbuyyFontStacks`. `formatInrCurrency` (+ subpath-only date formatters). `MarketplaceUnavailable` (subpath). Logging (subpath).

---

## Catalog totals

| Category | Components | Notable gaps |
|---|---|---|
| Actions & forms | Button, Input, Textarea, Checkbox, Radio, ChoiceList, Select, Combobox | No `Dropdown`/`Menu`, no `Switch`/`Toggle`, no `Slider`, no `NumberField`, no `DatePicker` (only range) |
| Layout | Box, BlockStack, InlineStack, Text, Page(+Shell), PageContent, PageHeader(+Actions), Section, Card | No `Grid`/`Columns` primitive, no `Drawer`/sidebar primitive |
| Feedback | Badge, Banner, EmptyState, SaveBar, Skeleton, Toast, Spinner, ProgressBar | No inline `InlineError`, no `Toast` positioning options |
| Overlays | Modal, ConfirmDialog, Tooltip, CommandPalette | **No `Drawer`, no `Popover`, no `Dropdown`** |
| Data | DataTable, IndexTable, MetricCard, Chart, Avatar, Pagination, DescriptionList | DataTable/IndexTable overlap; Pagination minimal |
| Filtering/nav | FilterBar, FilterChips, Breadcrumbs, Tabs, DateRangePicker, DensityToggle | Breadcrumbs duplicated in PageHeader |
| Provider/infra | DesignSystemRoot, tokens, icons, cx | `surface` prop inert |

**Verdict:** A real, sizeable, mostly-Polaris-shaped library. The inventory is strong; the problems are **duplication, missing overlay primitives, and uneven internal consistency** — all detailed in the API stability, consistency, and Top-100 reports.
