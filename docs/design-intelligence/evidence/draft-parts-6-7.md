# LetBuyy Design Intelligence Master Document
## Part 6: Component Intelligence
## Part 7: Interaction Intelligence

Generated: 2026-06-19
Source: COMPONENT_CATALOG.md, COMPONENT_DUPLICATION_REPORT.md, INTERACTION_ARCHITECTURE.md, UX_PATTERN_LIBRARY.md

---

# PART 6: COMPONENT INTELLIGENCE

---

## 6.1 The @letbuyy/ui Component Ecosystem

`@letbuyy/ui` is the single source of truth for all visual primitives in the LetBuyy platform. It is a TypeScript package located at `packages/typescript/ui/src/` and exported through the canonical barrel at `packages/typescript/ui/src/index.ts`. Every active runtime — `merchant-control-plane`, `identity-platform`, `platform-console`, `marketing-site`, and `storefront-runtime` — depends on this package. No runtime is permitted to maintain a parallel component library.

The library contains more than 60 individually exported components, utilities, and hooks, organized into 12 functional groups. The grouping is not arbitrary: it reflects the LetBuyy surface model, where different groups are consumed by different runtimes at different cadences.

**Component count by category (authoritative as of 2026-06-19):**

| Group | Component Count | Primary Consumer |
|---|---|---|
| Foundation / Primitive | 4 | All runtimes |
| Layout | 11 | merchant-control-plane, platform-console |
| Navigation / Shell | 5 + 1 utility | merchant-control-plane, platform-console |
| Overlay | 7 | merchant-control-plane |
| Feedback | 7 | All runtimes |
| Form / Controls (Actions) | 4 | merchant-control-plane, identity-platform |
| Controls | 6 | merchant-control-plane |
| Data Display | 7 | merchant-control-plane, platform-console |
| Disclosure / Composition | 7 | merchant-control-plane |
| Internal Workspace | 9 | platform-console |
| Marketplace | 1 | Frozen apps only |
| Tokens / Formatting | 4 utilities + token set | All runtimes |

**Export architecture:** The barrel `index.ts` re-exports everything from source files grouped by concern: `icons.tsx`, `layout.tsx`, `navigation/app-navigation.tsx`, `app-shell.tsx`, `overlays.tsx`, `feedback.tsx`, `button.tsx`, `input.tsx`, `controls.tsx`, `table.tsx`, `productivity.tsx`, `primitives.tsx`, `internal-workspace.tsx`, `marketplace.tsx`, `token-style-boundary.tsx`, `theme-toggle-button.tsx`. Apps import named exports directly from `@letbuyy/ui` — no deep path imports.

**Token compliance enforcement:** The library enforces a design-system ratchet. All components must use `--lb-*` CSS custom properties exclusively. The ratchet is documented in `scripts/validate-governance.mjs` and is enforced as part of the 107-validator gate. Any component introducing raw Tailwind arbitrary-value classes (e.g. `rounded-[12px]` or `py-[2px]`) will fail the gate.

---

## 6.2 Component Catalog by Group

### Group 1: Foundation / Primitive

These four components are the scaffolding for all other UI. They do not carry visual opinion beyond token application.

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Material Icon | `MaterialIcon` | `name: MaterialIconName`, `size?: number`, `strokeWidth?=2` | COMPLIANT | Maps ~150 semantic icon names to Lucide icons. Falls back to `Circle` for unknown names. Always `aria-hidden="true"` and `focusable="false"`. Two name types: `StrictMaterialIconName` (compile-time safe) and `LooseMaterialIconName` (runtime string). |
| Lucide Icons (re-export) | `Bell`, `Check`, `AlertCircle`, `ChevronDown`, ~80 others | Same as lucide-react props | N/A | Convenience re-export. All runtimes must import Lucide icons from `@letbuyy/ui`, never from `lucide-react` directly. This is a binding rule (see Section 6.4). |
| Token Style Boundary | `TokenStyleBoundary` | `children`, `includeTokenStyles: boolean`, `tokenCss: string` | COMPLIANT | Injects `<style data-letbuyy-token-source>` exactly once per tree even when nested. Used for embedded contexts (email previews, iframes). |
| Theme Toggle Button | `ThemeToggleButton` | Extends `ButtonProps` minus `aria-label`, `children`, `onClick`, `size`, `type` | COMPLIANT | Reads `useTheme()` internally. Toggles light/dark. Used in `storefront-runtime` account flows. |

---

### Group 2: Layout

Layout components are the structural skeleton of every full-page view. They are token-compliant wrappers over CSS concepts.

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Polymorphic container | `Box` | `as?`, `tone?`, `border?`, `radius?`, `shadow?`, `padding?` | COMPLIANT | All spacing and color expressed via token prop values, not raw classes. |
| Flex column | `BlockStack` | `gap?`, `align?`, `justify?`, `children` | COMPLIANT | Vertical flex layout primitive. |
| Flex row | `InlineStack` | `gap?`, `align?`, `justify?`, `wrap?`, `children` | COMPLIANT | Horizontal flex layout primitive. |
| CSS Grid | `Grid` | `columns?: {base, sm, md, lg, xl}`, `gap?` | COMPLIANT | Responsive column count via token-scaled gap. |
| Equal-width columns | `Columns` | `columns?: {base, sm, md, lg, xl}`, `gap?` | COMPLIANT | Alias/variant of Grid oriented for equal-width column layouts. |
| Max-width wrapper | `Container` | `size?: 'sm' \| 'md' \| 'lg' \| 'xl' \| 'page' \| 'measure' \| 'full'` | COMPLIANT | Note: `marketing-site` uses a raw `<div className="container">` CSS class instead of this component (underutilization). |
| Main element | `Page` | `children` | COMPLIANT | `<main>` with max-width and responsive horizontal padding. |
| Page heading | `PageHeader` | `title`, `description?`, `eyebrow?`, `breadcrumbs?`, `pageType?`, `primaryAction?`, `secondaryActions?` | COMPLIANT | Canonical page heading for all merchant pages. `secondaryActions` renders as inline button cluster beside primary. |
| Domain icon | `PageIdentity` | `type: PageIdentityType` | COMPLIANT | 15 types: dashboard, products, orders, collections, inventory, customers, analytics, marketing, discounts, content, settings, apps, themes, payments, domains. Each maps to a Material Symbol icon name. |
| Section card | `Card` | `layout?: 'default' \| 'stack' \| 'split'`, `children` | COMPLIANT | `<section>` element. Stack = vertical flex, split = 50/50 side-by-side. |
| Titled section | `Section` | `title?`, `columns?: 2 \| 3`, `children` | COMPLIANT | Titled section with optional column grid body. |
| Text primitive | `Text` | `variant?: 'display' \| 'heading' \| 'body' \| 'caption' \| 'subdued' \| 'strong' \| 'positive' \| 'negative' \| 'code'`, `tone?`, `weight?`, `align?`, `truncate?`, `as?` | COMPLIANT | Polymorphic. All type styles map to `--lb-font-*` and `--lb-color-text-*` tokens. |
| Rule | `Divider` | `orientation?: 'horizontal' \| 'vertical'` | COMPLIANT | `<hr>` using `--lb-color-border` token. |

---

### Group 3: Navigation / Shell

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Application shell | `AppNavigation` | `sections: AppNavigationSection[]`, `brand?`, `footer?`, `topBar?`, `children`, `width?`, `sidebarClassName?`, `pathname?` | COMPLIANT | Canonical authenticated-app shell. Composes `AppFrame`, `Sidebar`, and `Navigation`. Active state computed automatically via `usePathname()`. Used in `merchant-control-plane` `AdminShell.tsx`. |
| Outer layout frame | `AppFrame` | Internal | COMPLIANT | Composes header + sidebar + main content area. Not used directly by apps. |
| Data-driven nav list | `Navigation` | `ariaLabel?`, `items: NavigationItem[]` | COMPLIANT | Used in `merchant-control-plane` for footer settings nav items. |
| Sidebar panel | `Sidebar` | `width?: 'xs' \| 'sm' \| 'md' \| 'lg'`, `className?` | COMPLIANT | Width variants map to `220px` (sm), `260px` (md, default), `320px` (lg). |
| Breadcrumb trail | `Breadcrumbs` | `items: BreadcrumbItem[]`, `separator?: 'chevron' \| 'slash'`, `currentTone?: 'emphasis' \| 'inherit'` | COMPLIANT | Renders `<nav aria-label="Breadcrumb">`. `aria-current="page"` on last item. |
| Active-state helper | `isNavItemActive` (utility) | `(pathname: string, href?: string): boolean` | N/A | Exact match for `/`; prefix match for all other paths. Exported for apps that build nav items manually. |

---

### Group 4: Overlay

All overlay components portal to `<body>` via `OverlayPortal` with automatic theme mirroring.

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Portal root | `OverlayPortal` | `children` | COMPLIANT | Body-level `ReactDOM.createPortal`. Copies `data-letbuyy-theme`, `data-letbuyy-surface`, `data-letbuyy-density`, `data-theme` from `<html>` via `MutationObserver`. Fixes dark OS / light app mismatch. |
| Slide-in panel | `Drawer` | `open`, `onClose`, `side?: 'left' \| 'right' \| 'top' \| 'bottom'`, `size?: 'sm' \| 'md' \| 'lg' \| 'full'`, `title?`, `footer?` | COMPLIANT | Portaled. Escape closes. Focus trap implied by modal role. Sizes: sm=360px, md=440px, lg=560px. |
| Anchored panel | `Popover` | `trigger`, `children`, `open?`, `onOpenChange?`, `align?: 'start' \| 'center' \| 'end'` | COMPLIANT | Controlled and uncontrolled modes. No Popper.js dependency — custom anchored position. |
| Action menu | `Dropdown` / `DropdownMenu` | `trigger`, `items: DropdownItem[]`, `open?`, `onOpenChange?` | COMPLIANT | Keyboard: Arrow keys, Home/End, Escape. Items support icon, disabled, and destructive tone. |
| Centered dialog | `Modal` | `open`, `onClose`, `title?`, `size?: 'sm' \| 'md' \| 'lg'`, `footer?` | COMPLIANT | Full-screen mobile, centered desktop. Backdrop click closes. `useFocusTrap` + `useScrollLock` applied. |
| Irreversible action guard | `ConfirmDialog` | `open`, `onClose`, `onConfirm`, `title`, `body?`, `confirmLabel?`, `cancelLabel?`, `destructive?` | COMPLIANT | Wraps `Modal`. `destructive=true` renders confirm as `variant="destructive"` (red). Cancel phrased as a positive action. |
| Hover/focus label | `Tooltip` | `content`, `children`, `side?: 'top' \| 'right' \| 'bottom' \| 'left'` | COMPLIANT | CSS-only hover/focus reveal. Touch: tap to toggle. No portal. |

---

### Group 5: Feedback

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Status chip | `Badge` | `variant?: 'default' \| 'info' \| 'success' \| 'warning' \| 'critical'`, `children` | COMPLIANT | Shows a status icon for non-default variants. Canonical status display. |
| Auto-status chip | `StatusBadge` | `status: string` | COMPLIANT | Wraps `Badge`; derives variant via `statusToBadgeVariant(status)`. Use this over `Badge` when the status is a raw string. |
| Status mapping utility | `statusToBadgeVariant` | `(status: string): StatusVariant` | N/A | Canonical mapping: active/paid/shipped → success; cancelled/failed/expired → critical; pending/processing → warning; new/in-progress → info. |
| Page-level alert | `Banner` | `variant?: 'info' \| 'success' \| 'warning' \| 'critical'`, `title?`, `children`, `action?` | COMPLIANT | Page-level alert bar with icon, title, body text, and optional action button slot. |
| Toast system | `ToastProvider` + `useToast` | `notify({ title, body?, variant?, duration? })`, `dismiss(id)` | COMPLIANT | Context-based. Default placement top-right. Duration 5000ms. Registered in `AdminShell.tsx` via `<ToastProvider>`. |
| Loading placeholder | `Skeleton` | `variant?: 'text' \| 'card' \| 'table'`, `lines?=3`, `rows?=5` | COMPLIANT | Text = gray bar lines; card = single card-height block; table = repeated row heights. |
| Empty state | `EmptyState` | `kind: EmptyStateKind`, `title?`, `body?`, `primaryAction?`, `secondaryAction?` | COMPLIANT | 14 domain-specific kinds with inline SVG motifs: generic, products, collections, inventory, orders, customers, discounts, marketing, content, domains, themes, analytics, apps, payments. |
| Inline SVG illustration | `EmptyStateIllustration` | (internal to EmptyState) | COMPLIANT | Per-kind inline SVG motif. Overridden by custom `<Image>` when PNG asset exists. |
| Sticky save indicator | `SaveBar` | `state: 'saved' \| 'unsaved' \| 'saving'`, `onSave`, `onDiscard`, `saveLabel?`, `discardLabel?` | COMPLIANT | Sticky bottom bar. Animates in when `state === 'unsaved'`. Uses `--lb-color-surface-overlay` and `--lb-shadow-*` tokens. |

---

### Group 6: Actions (Form Buttons and Submission Controls)

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Button | `Button` | `variant?: 'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'destructive'`, `size?: 'sm' \| 'md' \| 'lg' \| 'icon'`, `loading?`, `fullWidth?`, `unstyled?`, `asChild?`, `as?: 'button' \| 'a'` | COMPLIANT (`--lb-component-button-*`, `--lb-density-*`) | `unstyled` strips all DS classes (escape hatch for legacy adoption). `asChild` clones single child. `loading` renders `<Loader2>` spinner and disables interaction. |
| Text input | `Input` | `label?`, `helperText?`, `error?`, `leftIcon?`, `rightIcon?`, `unstyled?`, + native input props | COMPLIANT (`--lb-component-input-*`) | Wraps `<input>` with label, helper, error slot. `error` triggers red ring and `InlineError` below. |
| Text area | `Textarea` | `label?`, `helperText?`, `error?`, `unstyled?`, + native textarea props | COMPLIANT | |
| Field-level error | `InlineError` | `children` | COMPLIANT | Renders `AlertCircle` icon + error text in critical tone. `role="alert"`. Can be used standalone outside `Input`. |
| Numeric input | `NumberField` | All `Input` props + `onValueChange?: (number \| null) => void`, `min?`, `max?`, `step?` | COMPLIANT | Wraps `Input`; handles numeric coercion and NaN→null. |

---

### Group 7: Controls

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Checkbox | `Checkbox` | `label?`, `description?`, `helperText?`, `error?`, `checked?`, `onCheckedChange?`, `unstyled?` | COMPLIANT | |
| Radio button | `Radio` | Same shape as `Checkbox` | COMPLIANT | |
| Toggle | `Switch` | `checked?`, `onChange?`, `label?`, `disabled?` | COMPLIANT | `<button role="switch" aria-checked>`. Controlled and uncontrolled modes. |
| Option group | `ChoiceList` | `type: 'radio' \| 'checkbox'`, `options: ChoiceOption[]`, `value?`, `onChange?`, `layout?: 'vertical' \| 'horizontal'` | COMPLIANT | Card-style options with optional border, title, description, media slot. |
| Native select | `Select` | `label?`, `helperText?`, `error?`, `size?: 'sm' \| 'md' \| 'lg'`, `prefixContent?`, native select props | COMPLIANT | Native `<select>` with design system chrome. |
| Custom combobox | `Combobox` | `options: ComboboxOption[]`, `value?`, `onChange?`, `label?`, `placeholder?`, `filter?`, `async?` | COMPLIANT | Full keyboard navigation. Fuzzy filter or custom filter function. Async-capable. |
| Tab group | `Tabs` | `tabs: Tab[]`, `value?`, `onChange?`, `variant?: 'underline' \| 'pills'` | COMPLIANT | Keyboard: Arrow/Home/End navigation. Underline = page-level; pills = filter switching. |

---

### Group 8: Data Display

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Data table | `Table` | `columns: TableColumn<T>[]`, `rows: T[]`, `sortable?`, `selectable?`, `bulkActions?`, `savedViews?`, `filterChips?` (data mode); `children` (static mode) | COMPLIANT | Dual-mode. Responsive: `<article>/<dl>` card layout on mobile, `<thead>/<tbody>` table on desktop. `cardLabel`/`cardRender` per column for mobile. |
| Metric tile | `MetricCard` | `label`, `value`, `delta?: {value, tone}`, `sparkline?: number[]` | COMPLIANT | Dashboard metric tile. Sparkline renders as SVG `<polyline>`. |
| Key-value list | `DescriptionList` | `items: {label, value}[]`, `columns?: 1 \| 2` | COMPLIANT | Renders `<dl>` with `<dt>/<dd>` pairs. |
| SVG chart | `Chart` | `type: 'line' \| 'bar' \| 'area'`, `data: number[]`, `labels?: string[]`, `height?` | COMPLIANT | SVG-based. Accessible via `<dl>` (screen-reader). Grid lines use `--lb-color-border`. |
| Progress indicator | `ProgressBar` | `value: number`, `max?: number`, `label?`, `showPercent?` | COMPLIANT | `AISidebar` bypasses this in favor of a raw `<progress>` element — an active violation (see Section 6.3). |
| Active filter chips | `FilterChips` | `chips: FilterChip[]`, `onRemove(chip)`, `onClear()` | COMPLIANT | |
| User/store avatar | `Avatar` | `name: string`, `imageUrl?`, `size?: 'sm' \| 'md' \| 'lg'` | COMPLIANT | Renders initials (up to 2 chars) or image. `HeaderBar.tsx` bypasses this with custom initials — an active violation (see Section 6.3). |
| Page controls | `Pagination` | `page`, `totalPages`, `onPageChange`, `showPageNumbers?`, `pageSize?`, `onPageSizeChange?`, `pageSizeOptions?` | COMPLIANT | |
| Search + filter bar | `FilterBar` | `search?`, `filters?`, `actions?`, `chips?`, `bulkActions?` | COMPLIANT | Container that lays out search input, filter dropdowns, action buttons, filter chips, and bulk action bar. |
| Command palette | `CommandPalette` | `open`, `onClose`, `actions: PaletteAction[]`, `placeholder?` | COMPLIANT | Full keyboard navigation, shortcut display. Not the same as the local duplicate in `merchant-control-plane` (see Section 6.3, D-01). |

---

### Group 9: Disclosure / Composition

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Single expandable | `Disclosure` | `title`, `children`, `open?`, `onOpenChange?` | COMPLIANT | Animated chevron rotation. CSS transitions only (not framer-motion). |
| Multi-item accordion | `Accordion` | `items: AccordionItem[]`, `allowMultiple?` | COMPLIANT | Wraps multiple `Disclosure` items. Single-expansion mode by default. |
| Visual toggle group | `SegmentedControl` | `options: {value, label}[]`, `value?`, `onChange?` | COMPLIANT | Radio group with visual pill style. |
| Density switcher | `DensityToggle` | `value?: 'compact' \| 'comfortable' \| 'spacious'`, `onChange?` | COMPLIANT | Wraps `SegmentedControl`. Sets `--lb-density-*` tokens on the nearest context. |
| Date range input | `DateRangePicker` | `value?: {from, to}`, `onChange?`, `compare?`, `onCompareChange?` | COMPLIANT | Fieldset with two date inputs and a compare checkbox. |
| Single date input | `DatePicker` | `value?`, `onChange?`, `label?` | COMPLIANT | |
| Inline spinner | `Spinner` | `label?: string` (sr-only) | COMPLIANT | Renders `<Loader2>` with spin animation and a screen-reader label. |

---

### Group 10: Internal Workspace (platform-console only)

These nine components are for operator and internal surfaces exclusively. They are not to be imported in merchant, storefront, or marketing runtimes.

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Ops page shell | `InternalWorkspace` | `eyebrow`, `title`, `description`, `children` | COMPLIANT | Standardized header for ops/internal pages. |
| Metric grid | `InternalMetricGrid` | `children` | COMPLIANT | 2-col (sm) / 4-col (xl) CSS grid for metric cards. |
| Ops metric tile | `InternalMetric` | `label`, `value`, `detail?`, `tone?: 'neutral' \| 'success' \| 'warning' \| 'critical'` | COMPLIANT | |
| Titled panel | `InternalPanel` | `title`, `description?`, `action?`, `children` | COMPLIANT | Titled panel with border and body padding. |
| Module grid | `InternalModuleGrid` | `children`, `density?: 'leadership' \| 'standard'` | COMPLIANT | 2-col (md) / 3-col (2xl) grid. |
| Linked module card | `InternalModuleCard` | `title`, `description`, `href`, `status`, `detail?` | COMPLIANT | Linked card with status pill and hover accent border. |
| Status pill | `InternalStatusPill` | `value: string`, `tone?: 'success' \| 'warning' \| 'critical' \| 'info'` | COMPLIANT | Derives tone from known status strings if `tone` is omitted. |
| Data-unavailable warning | `InternalSkipBackendPanel` | `title`, `children` | COMPLIANT | Warning panel for when a live data source is not connected. |
| Empty data state | `InternalEmptyDataState` | `message` | COMPLIANT | Dashed border empty state for internal data panels. |

---

### Group 11: Marketplace (Frozen)

| Component | Export Name | Key Props / Variants | Token Compliance | Notes |
|---|---|---|---|---|
| Emergency error state | `MarketplaceUnavailable` | `title?`, `body?`, `buttonLabel?`, `onRetry?`, `className?`, style props | NONE | Intentionally unstyled — callers apply any needed styles. Uses a raw `<button>` (not the DS `Button`). For frozen marketplace surfaces only. Do not use in active runtimes. |

---

### Group 12: Tokens / Formatting

These are utilities and infrastructure, not visual components.

| Export | Type | Description |
|---|---|---|
| `formatInrCurrency` | `(paise: number): string` | Canonical INR formatter. Always use this; never write a local `formatINR`. |
| `formatIndiaDate` | `(isoDate: string): string` | `en-IN` locale date formatter. |
| `useTheme` | Hook | Returns `{ resolvedTheme, setTheme }` (light/dark/system). |
| `letbuyyPrimitiveTokens` | Token set | Raw CSS custom property values for embedding in non-React contexts (email, iframe). |

---

## 6.3 Duplication Analysis

### Confirmed Duplications

Seven cases where a `@letbuyy/ui` component exists and an app re-implements all or part of the same pattern.

#### D-01 — CommandPalette (HIGH severity)

| | @letbuyy/ui | merchant-control-plane |
|---|---|---|
| File | `packages/typescript/ui/src/productivity.tsx` | `apps/merchant-control-plane/src/components/CommandPalette.tsx` |
| Capability | Full-featured palette: keyboard navigation, action list, shortcut display | Same UX plus live entity search (products, orders, customers via API), search category chip filter, section grouping |

The local component was extended rather than composed from the DS component. The DS `CommandPalette` does not support async entity search. The local implementation correctly imports `Input(unstyled)`, `Button(unstyled)`, and `MaterialIcon` from `@letbuyy/ui` for its own primitives, but does not compose the DS `CommandPalette` shell at all.

**Divergence reason:** The DS component was added after the local version was built, or the local version grew capabilities faster than the DS component.

**Resolution path:** Add an `onSearch` async callback and a `categories` prop to the DS `CommandPalette`. The extended functionality — live search, category chips — is a superset. The DS component should grow to contain it, then the local component is retired. This is a Priority 3 DS change.

---

#### D-02 — Accordion / FAQ Accordion (MEDIUM severity)

| | @letbuyy/ui | marketing-site |
|---|---|---|
| File | `packages/typescript/ui/src/primitives.tsx` (`Accordion`) | `apps/marketing-site/src/components/FAQ.tsx` |
| Capability | Reusable accordion with CSS transitions | framer-motion `AnimatePresence` height animation with `faq-item*` CSS classes |

The marketing FAQ renders the same expand/collapse interaction as `Accordion` but with framer-motion height animation. The two diverge on animation strategy: CSS transitions vs. JavaScript-driven layout animation.

**Divergence reason:** Marketing content benefits from the richer framer-motion height transition for perceived quality. The DS `Disclosure`/`Accordion` uses CSS transitions only.

**Resolution path:** Accept this divergence. If the marketing site is ever migrated to the DS `Accordion`, a `motion` prop must be added to `Disclosure` to preserve the height animation. No immediate action required.

---

#### D-03 — Skeleton / PlanCardSkeleton (MEDIUM severity)

| | @letbuyy/ui | marketing-site |
|---|---|---|
| File | `packages/typescript/ui/src/feedback.tsx` | `apps/marketing-site/src/components/Pricing.tsx` |
| Capability | `Skeleton` with `text`, `card`, `table` variants | Bespoke `PlanCardSkeleton` with explicit skeleton line divs (name line, audience line, price line, feature lines, CTA line) |

The `PlanCardSkeleton` matches the visual pattern of `Skeleton variant="card"` with additional internal structure.

**Divergence reason:** The `Skeleton` component did not have a plan-card-specific variant when the Pricing component was written.

**Resolution path:** Low priority. Add a `'plan-card'` variant to `Skeleton`, or use `Skeleton` with `lines` to approximate the structure. The marketing site is a separate deployment context.

---

#### D-04 — MetricCard / MetItem (MEDIUM severity — accepted)

| | @letbuyy/ui | marketing-site/Features.tsx |
|---|---|---|
| File | `packages/typescript/ui/src/productivity.tsx` | `apps/marketing-site/src/components/Features.tsx` (inline `MetItem`) |
| Capability | `MetricCard` with label, value, delta, sparkline | `MetItem` with `useCountUp` animation, `cop-met-val/lbl` CSS classes, hardcoded demo data |

**Verdict: No action required.** The marketing features demo is intentionally a richly animated marketing display with mock data. The DS `MetricCard` is for real data in the merchant UI. These serve different purposes.

---

#### D-05 — Badge / Notification Unread Count (MEDIUM severity)

| | @letbuyy/ui | merchant-control-plane |
|---|---|---|
| File | `packages/typescript/ui/src/feedback.tsx` | `apps/merchant-control-plane/src/components/NotificationsPanel.tsx` line 56 |
| DS component | `Badge variant="critical"` or new count variant | Inline `<span>` with 14 Tailwind token-expression classes |

The notification unread count is implemented as a hand-rolled `<span>` with class `ml-[var(--lb-space-2)] inline-flex min-w-[var(--lb-size-icon-inline)] items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary)] px-[var(--lb-space-2)] py-[1px] ...`. The token variables are correct, but the bracket syntax (`rounded-[...]`) is a ratchet violation and `py-[1px]` is a raw pixel value.

**Resolution path:** Replace with `<Badge variant="default">` or add a `count` variant to `Badge` specifically for notification count pills (pill shape, primary background). This eliminates both the ratchet violation and the duplication.

---

#### D-06 — ProviderModeBadge vs Badge (LOW severity)

| | @letbuyy/ui | merchant-control-plane |
|---|---|---|
| File | `packages/typescript/ui/src/feedback.tsx` | `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx` |
| DS component | `Badge` | Custom `<span>` with `py-[2px]` raw pixel violation |

`ProviderModeBadge` renders a `test`/`live` environment indicator. The intent maps cleanly to `Badge`. The `py-[2px]` is a ratchet violation.

**Resolution path:** Add `'live'` and `'test'` tone variants to `Badge`, or promote `ProviderModeBadge` as a DS-level `EnvironmentBadge`. Short-term fix: replace `py-[2px]` with `py-[var(--lb-space-half)]` if the half-space token exists, or switch to the DS `Badge`.

---

#### D-07 — AuthIcon vs MaterialIcon (LOW severity — by design)

| | @letbuyy/ui | identity-platform |
|---|---|---|
| File | `packages/typescript/ui/src/icons.tsx` | `apps/identity-platform/src/components/AuthIcon.tsx` |

`AuthIcon` is a thin wrapper over `MaterialIcon` that (a) narrows allowed icon names to an `AuthIconName` union for type safety in identity flows, and (b) adds `role="img"` + `aria-label` when a `title` prop is passed.

**Verdict:** Intentional, not a true duplication. The type-level constraint cannot be expressed in the generic `MaterialIcon`. However, the `aria-label`/`role` accessibility pattern should be added to `MaterialIcon` itself (add `title?: string` prop) so the pattern is not silently missing in other contexts. This is a Priority 3 DS extension that would allow `AuthIcon` to be retired.

---

### Components That Should Be Promoted to @letbuyy/ui

Four app-layer components exhibit sufficient generality to belong in the shared library.

#### P-01 — StoreSwitcherDropdown Pattern → `AccountSwitcher`

**Current location:** `apps/merchant-control-plane/src/components/HeaderBar.tsx`

**Why promote:** The store-switcher pill + dropdown + mobile bottom-sheet is an application-shell navigation primitive. If `platform-console` or any future B2B admin surface requires account or context switching, the pattern will be duplicated from scratch. The pill trigger → desktop dropdown / mobile bottom-sheet interaction is reusable across any multi-tenant shell.

**Effort:** Medium. Requires abstracting the current `HeaderBar` store-switcher logic, adding `items`, `current`, `onSelect`, and optional `footer` slot props, and verifying mobile bottom-sheet behavior matches the DS `BottomSheet` (P-02 below).

**Impact:** High. Eliminates the largest block of non-DS custom logic in `HeaderBar.tsx` and establishes a reusable context-switching pattern for the platform.

---

#### P-02 — MobileBottomSheet Pattern → `BottomSheet`

**Current location:** `apps/merchant-control-plane/src/components/HeaderBar.tsx` (store switcher + notifications mobile sheet); `apps/storefront-runtime/src/account/account-bottom-sheet.tsx`

**Why promote:** The mobile bottom-sheet (backdrop overlay + slide-up panel + drag handle) appears independently in two runtimes. It is a distinct overlay pattern from `Drawer` — `Drawer` is general-purpose while `BottomSheet` is specifically optimized for mobile-first "action sheet" patterns. Two independent implementations will diverge in animation timing and touch behavior.

**Effort:** Medium. The `Drawer variant="bottom"` is close but lacks the drag handle and snap behavior of a true mobile bottom-sheet.

**Impact:** High. Consolidates mobile overlay behavior across `merchant-control-plane` and `storefront-runtime`. Prevents further proliferation as more mobile-first overlays are needed.

---

#### P-03 — ProviderModeBadge → `EnvironmentBadge`

**Current location:** `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx`

**Why promote:** A `test`/`live` environment mode badge is needed in any payment-gateway-connected surface. The concept is domain-agnostic and will be needed in `platform-console` and any future partner portal. Keeping it in `merchant-control-plane` forces duplication.

**Effort:** Low. The component is small. Add `'live'` and `'test'` variants to `Badge`, or promote `ProviderModeBadge` as a standalone `EnvironmentBadge` in `@letbuyy/ui` and fix the `py-[2px]` violation in the process.

**Impact:** Medium. Removes a ratchet violation; establishes the canonical pattern for environment indicators.

---

#### P-04 — AuthIcon Accessibility Pattern → `MaterialIcon` title prop

**Current location:** `apps/identity-platform/src/components/AuthIcon.tsx`

**Why promote:** `AuthIcon` exists only because `MaterialIcon` does not support accessible titles. The `role="img"` + `aria-label` pattern when a `title` prop is present is a universal accessibility requirement, not an identity-platform-specific concern. Any component that uses `MaterialIcon` as a semantic image (not a decorative icon) currently has no correct way to label it.

**Effort:** Very low. Add `title?: string` to `MaterialIcon` props. When present: set `aria-hidden={false}`, `role="img"`, `aria-label={title}`. This change in `packages/typescript/ui/src/icons.tsx` renders `AuthIcon` redundant.

**Impact:** Medium. Closes an accessibility gap across all runtimes, not just identity-platform.

---

### Active Ratchet Violations

Six confirmed violations of the design-system ratchet. The ratchet rule: **no `rounded-[...]` with arbitrary values, no raw-pixel Tailwind values** in app component files. The bracket syntax is prohibited even when the value is a `--lb-*` token variable.

#### R-01 — NotificationsPanel unread badge
**File:** `apps/merchant-control-plane/src/components/NotificationsPanel.tsx` line 56
**Violations:** `rounded-[var(--lb-radius-full)]`, `py-[1px]`
**Fix:** Replace the inline `<span>` with `<Badge variant="default">` (or a new `count` Badge variant). Removes both violations.

#### R-02 — SettingsSearch input
**File:** `apps/merchant-control-plane/src/components/settings/SettingsSearch.tsx` line 34
**Violation:** `rounded-[var(--lb-radius-lg)]`
**Fix:** Replace the raw `<input className="...">` with `<Input leftIcon={<MaterialIcon name="search" />} placeholder="Search settings..." />`. The `Input` component encapsulates the radius token internally.

#### R-03 — BackendNeededPane
**File:** `apps/merchant-control-plane/src/components/settings/BackendNeededPane.tsx` line 49
**Violation:** `rounded-[var(--lb-radius-lg)]`
**Fix:** Replace the raw wrapper `<div>` with `<Card>` or `<Box radius="lg">`.

#### R-04 — EmbeddedAppBridgeClient tab buttons
**File:** `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx` line 239
**Violation:** `rounded-[var(--lb-radius-lg)]`
**Fix:** Replace raw tab `<button>` elements with `<Tabs variant="pills" tabs={[...]} value={selected} onChange={setSelected} />`.

#### R-05 — ProviderModeBadge
**File:** `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx` line 19
**Violation:** `py-[2px]` (raw pixel)
**Fix:** Replace `py-[2px]` with `py-[var(--lb-space-half)]` (if the token exists) or migrate to DS `Badge`.

#### R-06 — AdminShell sidebar className
**File:** `apps/merchant-control-plane/src/components/AdminShell.tsx` lines 128–130
**Violations:** `rounded-tl-[var(--sidebar-panel-radius)]` (bracket syntax), `--sidebar-panel-radius` (non-`--lb-*` token name)
**Fix:** Change to `rounded-tl-[var(--lb-radius-lg)]` (or the appropriate `--lb-radius-*` scale token). Rename `--sidebar-panel-radius` to an `--lb-*` token name, or remove it and use the canonical scale directly.

---

## 6.4 Component Governance Rules (Binding)

### Rule 1: Which component MUST be used for which pattern

The following patterns have a canonical DS component and may not be implemented with raw HTML or custom Tailwind. Using the DS component is not optional; it is enforced by the governance gate.

| Pattern | Required Component | Prohibited Alternative |
|---|---|---|
| Any page heading | `PageHeader` | Raw `<h1>` + manual breadcrumbs |
| Any body text / heading / caption | `Text` | Raw `<p>`, `<h2>`, `<span>` with hardcoded font classes |
| Any primary action | `Button variant="primary"` | Raw `<button>` or `<a>` with custom styling |
| Any destructive action | `Button variant="destructive"` in `ConfirmDialog` | Inline delete without confirmation |
| Any status display | `Badge` or `StatusBadge` | Raw colored `<span>` |
| Any loading placeholder | `Skeleton` | Custom skeleton divs |
| Any empty list state | `EmptyState` | Custom empty state HTML |
| Any mutation feedback | `useToast().notify()` | Alert, custom toast, browser dialog |
| Any page-level load error | `Banner variant="critical"` | Inline error text or toast |
| Any table data | `Table` (data mode) | Raw `<table>` / custom list |
| Any form with unsaved state | `SaveBar` | Custom unsaved-state indicator |
| Any form input | `Input` / `Textarea` / `NumberField` | Raw `<input>` / `<textarea>` |
| Any checkbox/radio | `Checkbox` / `Radio` / `ChoiceList` | Raw `<input type="checkbox/radio">` |
| Any select | `Select` or `Combobox` | Raw `<select>` |
| Any avatar / initials | `Avatar` | Custom initials `<span>` |
| Any progress indicator | `ProgressBar` | Raw `<progress>` |
| Any breadcrumb | `Breadcrumbs` | Custom chevron divs |
| Any modal/confirmation | `Modal` / `ConfirmDialog` | Browser `window.confirm()` or custom modal |
| Any application shell | `AppNavigation` | Custom sidebar + layout assembly |
| Any tab group | `Tabs` | Raw `<button>` tab rows |
| INR currency formatting | `formatInrCurrency` from `@letbuyy/ui` | Local `formatINR` functions |
| India date formatting | `formatIndiaDate` from `@letbuyy/ui` | `Intl.DateTimeFormat` inline |

---

### Rule 2: Component Graduation Process (app-level to @letbuyy/ui)

A component may graduate from an app runtime to `@letbuyy/ui` when all of the following are true:

1. **Reuse evidence:** The component is needed in two or more runtimes, or it fills a pattern gap in the DS (e.g. `BottomSheet` for mobile overlays).
2. **Token compliance:** The implementation uses only `--lb-*` CSS custom properties. Any raw Tailwind or inline px values must be removed before promotion.
3. **No runtime coupling:** The component imports nothing from the app it currently lives in (no app-specific hooks, no app-specific types, no API calls baked in).
4. **Props API is generalized:** App-specific prop names and defaults are replaced with generic, DS-consistent names.
5. **ARB sign-off:** A brief architecture review confirms the component belongs in the shared layer and the API is stable enough not to require immediate breaking changes.

**Process:**
1. Open a PR that moves the component to `packages/typescript/ui/src/`.
2. Add an export to `packages/typescript/ui/src/index.ts`.
3. Replace all existing app usages with the import from `@letbuyy/ui`.
4. Run `node scripts/validate-governance.mjs` — gate must stay green.
5. Merge via the standard two-lane rule.

---

### Rule 3: Deprecation Process

When a `@letbuyy/ui` component is superseded:

1. Mark the export with `/** @deprecated Use <ReplacementName> instead. Will be removed in v{n}. */`.
2. Add a TypeScript `@deprecated` JSDoc tag — this causes IDE strikethrough warnings.
3. Create a codemod script in `scripts/codemods/` to mechanically update all usages.
4. Run the codemod across all runtimes and commit the result.
5. Keep the deprecated export for one release cycle.
6. Remove in the next cycle with a breaking-change note in the changelog.

Do not remove a deprecated export without running the codemod first. Do not break a consuming runtime silently.

---

### Rule 4: How to Extend Without Forking

When an app needs behavior the DS component does not provide, the permitted patterns are:

1. **Props extension:** Propose adding the new prop to the DS component via a PR. If the prop is useful for all consumers, add it. If it is only useful for one runtime, reconsider whether the DS component is the right boundary.
2. **Composition:** Wrap the DS component in an app-level wrapper that adds the specific behavior. The wrapper must still render the DS component at its core — it may not re-implement the component's visual output.
3. **`unstyled` escape hatch:** `Button`, `Input`, and `Textarea` accept `unstyled` to strip DS classes for complete visual override. This is permitted only in contexts where the DS visual pattern does not fit (e.g. the plan selection toggle). Document the reason in a comment.
4. **`sidebarClassName` / `className` passthrough:** `AppNavigation` accepts `sidebarClassName` to extend the sidebar container without forking the shell. Token names in these strings must still be from the `--lb-*` scale.
5. **Forbidden:** Copying a DS component file into an app directory and modifying it. This creates a fork that diverges silently and is the primary cause of the seven confirmed duplications documented in Section 6.3.

---

### Rule 5: The lucide-react Rule — PROHIBITED

Apps must never import directly from `lucide-react`. The `@letbuyy/ui` package re-exports approximately 80 Lucide icons as named exports from `packages/typescript/ui/src/icons.tsx`. All apps must import from `@letbuyy/ui`.

**Correct:**
```tsx
import { Bell, CheckCircle, AlertCircle } from '@letbuyy/ui'
```

**Prohibited:**
```tsx
import { Bell } from 'lucide-react'
```

**Reason:** Direct lucide-react imports bypass version pinning managed in `@letbuyy/ui`, create a second copy of icon SVG bundles in the runtime, and may silently import icons that are not in the approved semantic set. If an icon is needed that is not currently re-exported by `@letbuyy/ui`, add it to `packages/typescript/ui/src/icons.tsx` via a PR — do not reach into lucide-react directly.

The governance gate (`validate-governance.mjs`) scans for `from 'lucide-react'` import statements in app source files and fails if any are found.

---

## 6.5 Flutter/Dart Component System

**Package location:** `packages/dart/ui_kit`

The Flutter/Dart UI kit mirrors the web `@letbuyy/ui` component system for the merchant mobile app (`apps/mobile/merchant-app`). It is not a full 1:1 port — it covers the components needed for the merchant mobile surface.

**What exists:**

The `ui_kit` package provides Flutter widget equivalents for the core interactive patterns:
- Token-based color and spacing primitives (Dart constants mirroring `--lb-*` CSS variables)
- Button widget with the same variant model (`primary`, `secondary`, `ghost`, `destructive`)
- Input widget with label, helper, and error states
- Card and Section layout widgets
- StatusBadge widget using the same semantic mapping (active → success, pending → warning, etc.)
- EmptyState widget for the merchant mobile list screens
- Skeleton loading widget for list/table screens
- Toast notification using Flutter's `OverlayEntry` system

**How it mirrors the web system:**

The design token mapping is the critical alignment point. The Dart `ui_kit` defines a `LbTokens` class containing constant values for spacing, color, radius, and typography that correspond 1:1 to the CSS `--lb-*` custom properties. When the web token scale changes, `LbTokens` must be updated in the same PR.

Color tokens use Flutter's `Color` type with the same hex values as the web CSS primitives. Typography tokens use `TextStyle` constants matching the web `--lb-font-size-*` and `--lb-font-weight-*` values. Spacing tokens are `double` constants matching the web spacing scale.

**Where it diverges:**

1. **Navigation shell:** The mobile app does not use `AppNavigation` (sidebar). Instead it uses Flutter's `BottomNavigationBar` for primary navigation — a platform-appropriate pattern for mobile.
2. **Overlay system:** Flutter overlays use `showModalBottomSheet`, `showDialog`, and custom `OverlayEntry` — not the web `OverlayPortal` pattern.
3. **Table:** Mobile does not have a responsive dual-mode table. List views use `ListView.builder` with Flutter card widgets.
4. **CommandPalette:** Not implemented in the mobile `ui_kit`.
5. **Theme toggle:** OS-level dark mode is respected via Flutter's `ThemeMode.system` — no toggle widget in the mobile kit.

**Token generation pipeline:**

The canonical token values live in the web design system (`packages/typescript/ui/src/`). There is no automated pipeline that generates the Dart `LbTokens` class from the web source. Token sync is currently manual: when `--lb-*` values change in the web system, a developer must manually update `packages/dart/ui_kit/lib/src/tokens.dart`. This is an active maintenance risk. A recommended improvement is a `scripts/sync-tokens-dart.mjs` script that reads the CSS custom properties from `@letbuyy/ui` and regenerates the `LbTokens` class.

---

# PART 7: INTERACTION INTELLIGENCE

---

## 7.1 Navigation Architecture

### merchant-control-plane: Canonical Sidebar

The merchant control plane uses a **data-driven sidebar shell** via the `AppNavigation` component (`packages/typescript/ui/src/navigation/app-navigation.tsx`). The `AdminShell.tsx` (`apps/merchant-control-plane/src/components/AdminShell.tsx`) composes this shell by passing a `sections` array built from `getMerchantNavigation(siteType)`.

**Sidebar anatomy:**
- Fixed left panel with three width variants: `sm` (220px), `md` (260px, default), `lg` (320px)
- Header slot: brand logo and store switcher
- Body: scrollable, sections separated by `mt-[var(--lb-space-4)]`; border `border-r border-[var(--lb-component-sidebar-border)]`
- Footer slot: user profile and settings links

**Active state mechanism:** `isNavItemActive(pathname, href)` — exact match for the root `/`; `pathname.startsWith(href + '/')` for all other routes. This means a user at `/{store}/products/123` will highlight the "Products" nav item. The function is computed automatically inside `AppNavigation` via `usePathname()`. Apps do not need to manage active state manually.

**Nested navigation (collapsible groups):** When a `NavigationItem` has a `children[]` array, the parent renders a right-aligned chevron that rotates 90° when open. State is managed with `useState(anyChildActive)` — the group auto-opens when any child matches the current route. Child items use indented padding (`pl-[calc(--lb-space-3 + icon-size + --lb-space-2)]`). The parent gets `aria-expanded`; children use `role="option"`. No animation on open/close — instantaneous.

**Three layout modes in AdminShell:**
1. `full-screen` — no sidebar (used for the theme editor page at `/{store}/online-store/themes/{themeId}/editor`)
2. `settings` — `SettingsShell` with floating sidebar navigation instead of `AppNavigation`
3. `standard` — full `AppNavigation` shell

**Breadcrumbs:** Rendered inside `PageHeader` via the `breadcrumbs` prop. Always two levels. Pattern evidence:
- Products: `[{ label: 'Home', href: '/{store}/dashboard' }, { label: 'Products' }]`
- Customers: `[{ label: 'Home', href: '/{store}/dashboard' }, { label: 'Customers' }]`
- Coupons: `[{ label: 'Marketing' }, { label: 'Coupons' }]` — note: first crumb has no `href` (inconsistency; should link to a marketing hub)

Breadcrumbs are **required on all merchant pages with depth > 1**. The root crumb must link to `/{store}/dashboard`. The `slash` separator and `currentTone="inherit"` variants are available but unused in current pages — `chevron` + `currentTone="emphasis"` is the established standard.

### identity-platform: Minimal Auth Top Bar

Auth and onboarding flows in `identity-platform` do not use `AppNavigation`. They use a minimal top bar with CSS class `auth-top-bar` containing: language toggle, theme toggle, and a user dropdown (custom popover). This is a deliberate separate system — auth flows should not carry the weight of the full application shell.

### platform-console: AppNavigation (via ConsoleWorkspace)

`platform-console` uses the `ConsoleWorkspace` family from `apps/platform-console/src/components/_local-ui/console-workspace.tsx`, which are zero-logic passthroughs to the `InternalWorkspace` family in `@letbuyy/ui`. Navigation is handled by `AppNavigation` with platform-console-specific sections.

### Deep Linking

All merchant pages are URL-addressable: `/{store}/products`, `/{store}/customers`, `/{store}/coupons`, etc. No client-side state is required to reach any page — all pages load their own data from the server. The storefront uses `/{subdomain}/...` routing via proxy middleware at `apps/storefront-runtime/src/proxy.ts`.

---

## 7.2 Action Architecture

### Primary Action Placement

The standard: **top-right of `PageHeader`** for all primary page-level actions.

```
PageHeader
  ├── eyebrow (domain/category label)
  ├── title
  ├── description
  ├── breadcrumbs (left-aligned)
  ├── primaryAction → Button(primary, top-right)
  └── secondaryActions → Button[](secondary, beside primary)
```

Evidence from `products/page.tsx`:
```tsx
primaryAction: {
  label: 'Add product',
  href: '/{store}/products/new',
  icon: <MaterialIcon name="add" />
}
secondaryActions: [{ label: 'Collections', href: '/{store}/products/collections' }]
```

The icon always precedes the label in the primary action. The eyebrow indicates the domain ("Catalog" for products, "Marketing" for coupons).

**Within-section actions** (e.g. inline form save buttons) are placed below the form in a `flex flex-wrap gap-[--lb-space-2]` row with the primary button first and cancel second. They are never placed in the page header.

### Destructive Action Protocol

All irreversible mutations must go through `ConfirmDialog`. The pattern observed in `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`:

1. Trash icon in table row → sets `couponToDelete` state
2. `ConfirmDialog` opens
3. Title phrased as a question: "Delete coupon?"
4. Description names the specific item: "Delete SUMMER20? This removes the discount from checkout promotions."
5. `confirmLabel` is action-specific: "Delete coupon" (not "Delete" or "Yes")
6. `cancelLabel` phrased as a positive action: "Keep coupon" (not "Cancel")
7. `destructive={true}` renders the confirm button red (`variant="destructive"`)
8. `onClose` blocked while `deleting === true` — cannot dismiss mid-mutation

**The cancel label rule is binding**: the cancel label must always be phrased as a positive action that affirms keeping the data, never as a generic "Cancel". This reduces accidental destructive clicks.

### Bulk Operations

`Table` component's `bulkActions` prop drives all bulk operations. The interaction sequence:

1. `bulkActions` presence adds a checkbox column to the table
2. Header checkbox: select all visible rows
3. When `selectedRows.length > 0`: the view tab row is replaced by a bulk action bar showing `{n} selected` + action buttons
4. Bulk actions are non-destructive (`variant="secondary"`) or destructive (`variant="destructive"`)
5. Execution: sequential per-row PATCH calls with partial failure handling — counts failures, shows a `warning` toast if some succeeded and some failed

Evidence: Products bulk actions are "Publish selected" and "Set as draft". Customers bulk action is "Copy emails" (clipboard). No reviewed page has bulk delete — if added, it must go through the `ConfirmDialog` with a count in the description: "Delete 12 products? This cannot be undone."

### Action Feedback: Loading, Success, Error Recovery

**During action (loading):**
- `Button loading={true}`: inline spinner in the button, interaction disabled. Used for save, delete, coupon create/edit.
- Per-row `updatingStatusId` / `togglingId` state: targets a single row with a spinner while other rows remain interactive.

**On success:**
```tsx
notify({ title: 'Product status updated', description: `${name} is now ${status}.`, variant: 'success' })
```
Title states the outcome. Description provides the specific detail. Auto-dismisses after 5000ms.

**On mutation error:**
- `notify({ variant: 'critical' })` for transient errors (network flake)
- `Banner variant="critical"` for errors that affect continued page use (form submission failure, persistent API error)

**Recovery:** When showing a `Banner` for a load failure, always include an `action` slot with a "Retry" `Button`. This is established in coupons but not yet universal — it should be applied to all load-error banners.

---

## 7.3 Form Architecture

### Standard Form Layout

**Single-column layout** is the default. Forms render inside `Card > Section` with one field per row. The full card width is used. Evidence: onboarding step 2 (name + subdomain), identity platform login and registration.

**Two-column layout** is used when the form has many short fields and a wider screen is the primary context. Evidence: `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx` uses a `md:grid-cols-2` grid with full-width items via `md:col-span-2`. This is acceptable when the form has clearly paired fields.

**Never use more than two columns in a form.** The platform is mobile-first (~360px) and multi-column layouts collapse to single column below `md` (768px).

**Onboarding forms** use a single-column centered card (`auth-card onboard-card`) — narrower than the merchant page layout, optimized for focus.

**Plan selection** is not a form — it is a CSS-grid card layout (`.select-plan-grid`) outside the `Card > Section` pattern. This is the only exception to the standard form layout pattern.

### Validation Patterns

Three validation patterns are in use, each appropriate to a different context:

**Pattern 1: Real-time async validation (debounced)**
Used for: unique-value inputs requiring a server check (subdomain in onboarding).
Implementation: custom `debounce` utility at 400ms. Three visual states:
- `checking` → `Spinner` + "Checking availability…"
- `valid` → `MaterialIcon name="check_circle"` + success message
- `invalid` → `MaterialIcon name="cancel"` + error reason (differentiated: `reserved` vs. general invalid)

CTA gating: the Next/Submit button is `disabled` until `validation?.valid` is true.

**Pattern 2: Submit-time validation**
Used for: forms where real-time feedback would be premature (coupon code, coupon value).
Implementation: check required fields before calling the API. Set `formError` state → render `Banner variant="critical"` above the form. The submit button also has `disabled` based on required field presence.

**Pattern 3: No explicit validation**
Used for: search inputs and filter fields where invalid input simply produces no results. These are unvalidated by design.

### Error Message Format and Placement

- **Field-level errors:** `Input error` prop renders `<p id="errorId" className="text-[color:var(--lb-color-critical)]">` directly below the input. `InlineError` component (`role="alert"`) may be used standalone when the error is not driven by the `Input` component.
- **Form-level errors:** `Banner variant="critical"` placed above the form fields. Title summarizes the problem; body gives detail.
- **Page-level errors:** `Banner variant="critical"` at the top of the main content area, above all other content.

Error messages must be specific, not generic. "Coupon code is required" is correct. "An error occurred" is not.

### Required Field Indicators

The `requiredIndicator` prop on `Select` and `ChoiceList` renders `<span aria-hidden="true">*</span>` in critical color after the label. This pattern is **not universally applied** in the current codebase — most form fields do not mark required fields explicitly. Required field indicators should be applied consistently to all required inputs. The implementation via `requiredIndicator` prop is the correct mechanism.

### Form Action Placement: Save / Cancel

**Inline forms (in-page, expand/collapse):** Primary button + Cancel button placed directly below the form fields in a `flex flex-wrap gap-[--lb-space-2]` row. Primary button first, Cancel second. Plus `SaveBar` (sticky bottom) as a secondary save mechanism.

**Modal/Dialog forms:** Footer slot with Cancel (secondary, left) + Save (primary, right). On mobile: buttons stack to full width. On desktop: `auto` width, right-aligned (`flex-row justify-end`).

**Auto-save vs. explicit save:** No auto-save pattern exists in the reviewed codebase. All forms use explicit save. The `SaveBar` tracks unsaved state and surfaces a save action persistently. If auto-save is introduced in the future, it must replace `SaveBar`, not coexist with it.

---

## 7.4 Data Table Architecture

### Standard List Page Pattern

The canonical list page in `merchant-control-plane` has the following structure, top to bottom:

```
PageHeader (title, eyebrow, breadcrumbs, primaryAction, secondaryActions)
└── Card
    └── Section
        ├── Search Input (leftIcon Search, label "Search {entities}")
        ├── Saved View Tabs (pill buttons: All / Active / Draft / Archived / ...)
        ├── Filter Chips Row (active filters as dismissible Badge chips)
        ├── Table
        │   ├── [when loading]: Skeleton variant="table" lines={6}
        │   ├── [when empty]: EmptyState kind="{entity}" title="..." primaryAction secondaryAction
        │   └── [when data]: thead + tbody (desktop) / article cards (mobile)
        └── (no pagination — all results loaded up to limit: 100)
```

**Evidence from `products/page.tsx` and `customers/page.tsx`.** This pattern is consistent between both pages. Coupons deviates: it uses a static `<Table>` (JSX mode, not data-driven) without saved views, without mobile card rendering, and without `filterChips`.

### Search: Input Placement and Behavior

Search input is placed above the table in a responsive grid: `md:grid-cols-[1fr auto]` (search + Refresh button). It uses `Input` with `leftIcon={<Search />}`, labeled "Search {entities}", placeholder describing the searchable fields.

**Search behavior:** Client-side. Filters a `useMemo`-computed array on every keystroke. No debounce on the search input for list filtering — the `useMemo` recomputes synchronously. The customers API accepts a `?search=` parameter but current code still filters client-side after fetching all records. For datasets exceeding 100 records, server-side search will be required; the API is ready but the UI is not yet wired.

**Empty state after search:** `EmptyState` with title "No matching {entities}", primary action "Add {entity}", secondary action "Clear search" that resets `searchQuery` to `''`.

### Sorting: How Triggered

Columns with `sortable: true` in the `TableColumn` definition render their header as a ghost button with a sort icon (`ArrowUp` for ascending, `ArrowDown` for descending). Clicking the active sort column toggles direction; clicking an inactive column sets it as the sort key with a direction default.

**Direction default:** Date and amount columns default to `desc` (newest/largest first). Text columns default to `asc`. This is hardcoded in the sort handler:
```tsx
setSortDirection(key === 'created_at' ? 'desc' : 'asc')
```

**Mobile sorting:** A horizontal scroll bar of sort chip buttons appears above the card list. Each chip label is the column header; the active chip shows a sort direction indicator.

### Filtering: Saved Views

Saved views render as a horizontal pill row above the table body (inside the `Table` component's toolbar, driven by the `savedViews` prop). Active view: `variant="primary"`. Inactive: `variant="secondary"`.

- Products: All / Active / Draft / Archived
- Customers: All / Active / Has orders / High value / New

View filtering is client-side for products (filter `sortedProducts` by status in `useMemo`), and API-side for customers (re-fetch with `?status=` param).

**Side panel filtering is not implemented.** All current filtering is via saved views (tab-style) and the search input. If complex multi-dimension filtering is added, the `FilterBar` component's `filters` slot is the correct extension point — not a custom side panel.

### Pagination

No pagination component is used in the reviewed list pages. All pages fetch with `limit: 100` and render all results client-side. The `Pagination` component exists in `@letbuyy/ui` and must be used if and when server-side pagination is added. The pattern: `page`, `totalPages`, `onPageChange` props on `Pagination`; re-fetch on page change.

---

## 7.5 Overlay Architecture

Five overlay types are available. The choice of overlay type is determined by the interaction contract, not by visual preference.

### Dialog (blocking, irreversible actions)

**Component:** `Modal` or `ConfirmDialog`
**Use when:** The user must respond before doing anything else. The action is potentially irreversible or high-consequence. Examples: delete confirmation, critical settings change, payment authorization.
**Do not use for:** Supplementary information, filters, secondary forms that can be abandoned without consequence.
**Evidence:** `ConfirmDialog` in `coupons/page.tsx` for coupon deletion. `StepUpDialog` in `merchant-control-plane/src/components/security/StepUpDialog.tsx` for step-up authentication.
**Size:** `sm` (compact confirmations), `md` (standard forms), `lg` (large content). Always full-screen on mobile.

### Sheet / Drawer (supplementary, workspace extension)

**Component:** `Drawer`
**Use when:** The user is performing a secondary task that does not replace the current view. The main content behind the drawer remains visible in context. Examples: product detail preview while browsing a list, settings panel, filter configuration.
**Sizes:** `sm` (360px, quick context), `md` (440px, standard supplementary), `lg` (560px, workspace panel), `full` (full screen, mobile-first).
**Do not use for:** Confirmations (use `ConfirmDialog`), simple menus (use `Dropdown`).
**Evidence:** Available in the system but not observed in reviewed merchant pages — appears to be underutilized. The AISidebar component is a custom fixed sidebar rather than a `Drawer`.

### Popover (ephemeral contextual content)

**Component:** `Popover`
**Use when:** Contextual content anchored to a trigger that is too rich for a `Tooltip` (multi-line, interactive, form fields) but should not block the rest of the page. Examples: date picker, color picker, rich preview, contextual help with links.
**Max width:** `min(320px, 100vw - var(--lb-space-6))`.
**Dismiss:** Click outside or Escape.
**Do not use for:** Navigation menus (use `Dropdown`), confirmations (use `ConfirmDialog`), large workspaces (use `Drawer`).

### Dropdown / DropdownMenu (action menu)

**Component:** `Dropdown` / `DropdownMenu`
**Use when:** A trigger reveals a list of actions. The list items are simple (label, optional icon, optional destructive tone). Examples: row action menu ("Edit", "Duplicate", "Delete"), status change menu, export options.
**Do not use for:** Rich content, forms, or multi-step interactions (use `Popover` or `Drawer`).
**Keyboard:** Arrow keys navigate items; Home/End jump to first/last; Escape closes.
**Evidence:** Used in `HeaderBar.tsx` for the store switcher dropdown and user menu.

### Tooltip (label / hint only)

**Component:** `Tooltip`
**Use when:** The `content` is a short label or hint (under ~8 words). Examples: icon button labels, abbreviated text expansion, keyboard shortcut display.
**Do not use for:** Interactive content, links, or anything requiring click. Tooltip is hover/focus only — unreachable on touch without tap toggle.
**Implementation:** CSS-only (no JavaScript). Touch: tap to toggle. No portal — uses CSS `group-hover`.
**Timing:** Instant reveal on hover. No delay configured in the current implementation.

### Common Properties Across All Overlays

- All four portaled types (`Modal`, `ConfirmDialog`, `Drawer`, `Popover`, `Dropdown`) use `OverlayPortal` with automatic theme mirroring. No overlay will render dark in a light app when the OS is dark.
- `useFocusTrap` on all blocking overlays (`Modal`, `Drawer`)
- `useScrollLock` on `Modal` and `Drawer` — body scroll disabled while open
- `useDismiss`: Escape key + outside-click on all overlay types
- `useAnchoredPosition`: fixed-position anchoring for `Popover` and `Dropdown` with no external positioning library

---

## 7.6 State Architecture

### Loading States: Skeleton vs. Spinner vs. Placeholder

**Skeleton — use for initial page load of content-shaped data**

`Skeleton` has three variants:
- `variant="table" rows={n}`: use for list pages before data arrives. `n` should approximate expected row count (6 is current default; this is somewhat arbitrary).
- `variant="card"`: use for single-card content placeholder.
- `variant="text" lines={n}`: use for paragraph or detail-field content.

**Evidence:**
- `products/page.tsx` line 359: `<Skeleton variant="table" lines={6} />` inside `Card > Section` while `loading === true`
- `customers/page.tsx` line 387: `<Skeleton variant="table" lines={6} />` directly inline with the table

Skeleton must match the shape of the content that will appear. A `variant="table"` skeleton before a `<Table>` component is correct; a spinner before a table is not.

**Spinner — use for in-action loading where the trigger was a user gesture**

`Spinner` is used for two contexts:
- `Button loading={true}`: inline in the button element while a mutation is in progress. The button is automatically disabled.
- `Spinner` component standalone: for short waiting states in flows (e.g., identity platform session checks use `.select-loading-spinner` CSS class — this is a deviation from the DS `Spinner`).

**Do not use Spinner to replace Skeleton on initial page load.** A page that shows a centered spinner while loading a list is a worse experience than a Skeleton table — the layout does not shift when the data arrives.

**Placeholder — inline text state**

Used in `EmptyState` for lists with no data. Not a loading indicator — it is a permanent state when no data exists. See Section 7.6 Empty States.

---

### Empty States: Required Elements and CTA Requirements

The `EmptyState` component (`packages/typescript/ui/src/feedback.tsx`) is required for all empty list pages. Three distinct contexts, each with specific required elements:

**First-time empty (no data has ever been created):**
- `EmptyStateIllustration` (domain SVG motif) or custom `<Image>` PNG
- `title`: "Add your first {entity}" (action-oriented, not "No {entities} found")
- `body`: brief description of what the entity is and why to create one (optional but recommended)
- `primaryAction`: create action ("Add product", "Create coupon")
- `secondaryAction`: alternative entry point ("Browse sourcing apps", "Import from CSV")

**Search/filter empty (no results for current query):**
- SVG illustration (lighter treatment — use inline SVG icon, not PNG)
- `title`: "No matching {entities}"
- `body`: optional, can describe what was searched
- `primaryAction`: create action (same as first-time, in case the user wants to create what they searched for)
- `secondaryAction`: "Clear search" — resets `searchQuery` to `''`

**Error empty (failed to load):**
- `title`: "Unable to load {entities}"
- `body`: error message or generic "Check your connection and try again"
- `primaryAction`: "Retry" button with `RefreshCw` icon
- `secondaryAction`: omitted

Actions are rendered in order `[secondaryAction, primaryAction]` in the DOM. On desktop they appear side-by-side; on mobile they stack. Do not omit the primary action — an empty state with no CTA is a dead end.

---

### Error States

**Page-level errors (failed to load page data):**
`Banner variant="critical"` at the top of the main content area. Must include a `title` and optional `body` for detail. Always include a "Retry" action in the `action` slot. The content behind the banner remains visible if any partial data was loaded before the error.

Example from `coupons/page.tsx`:
```tsx
<Banner
  variant="critical"
  title="Coupons could not load"
  action={<Button variant="secondary" onClick={() => void loadCoupons()}>Retry</Button>}
>
  {loadError}
</Banner>
```

**Component-level errors (form validation, field errors):**
- `Input error` prop for field-level inline errors
- `Banner variant="critical"` above the form for form-level submission failures
- `InlineError` component (`role="alert"`) for standalone inline error text outside `Input`

**Network errors:**
No global error boundary exists for network failures in the reviewed client components. Each page independently handles fetch errors with `try/catch`, sets a local `error` state, and renders it via `Banner`. This is acceptable for the current scale but a global network error handler should be considered for consistency.

**Permission errors:**
Server components use Next.js `notFound()` for auth failures (observed in `select-plan/page.tsx`). Client components check session from `/api/auth/session` and redirect to `/lookup` if unauthenticated. There is no client-side "403 Forbidden" UI component — if a route is reached without sufficient permissions server-side, the standard 404 page is rendered.

---

## 7.7 Interaction Anti-Patterns

The following patterns were found in the codebase that violate the interaction architecture. Each is a specific instance with a file path and a prescribed fix.

---

### AP-01 — Raw `<progress>` in AISidebar
**File:** `apps/merchant-control-plane/src/components/AISidebar.tsx`
**Violation:** Uses a native `<progress>` HTML element instead of the DS `ProgressBar`.
**Why wrong:** The native `<progress>` element does not use `--lb-*` design tokens. Its visual appearance is controlled by the browser/OS and will not match the design system. In dark mode the native progress bar may be invisible or inconsistent.
**Fix:** Replace with `<ProgressBar value={completedCount} max={totalCount} />` from `@letbuyy/ui`. Add `label` prop if the context benefits from accessible labeling.

---

### AP-02 — Custom initials in HeaderBar instead of Avatar
**File:** `apps/merchant-control-plane/src/components/HeaderBar.tsx`
**Violation:** `<span className="store-switcher-item-icon">` and `<span className="store-switcher-user-avatar">` render initials manually using custom CSS classes.
**Why wrong:** Custom initials are not token-compliant. The `Avatar` component handles edge cases (initials from multi-word names, image loading, size variants) that the custom span does not. Visual divergence from any future Avatar updates.
**Fix:** Replace both spans with `<Avatar name={entityName} size="sm" />` from `@letbuyy/ui`.

---

### AP-03 — Raw `<input>` in SettingsSearch
**File:** `apps/merchant-control-plane/src/components/settings/SettingsSearch.tsx` line 34
**Violation:** Raw `<input>` with a 200+ character Tailwind class string including `rounded-[var(--lb-radius-lg)]` (ratchet violation).
**Why wrong:** Duplicates what `Input` provides. The `rounded-[...]` bracket syntax violates the governance ratchet regardless of the value source.
**Fix:** Replace with `<Input leftIcon={<MaterialIcon name="search" />} placeholder="Search settings..." />`.

---

### AP-04 — Raw tab buttons in EmbeddedAppBridgeClient
**File:** `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx` line 239
**Violation:** Raw `<button>` elements with `inline-flex h-[var(--lb-size-control-md)] ... rounded-[var(--lb-radius-lg)]` class strings implement a tab group.
**Why wrong:** `rounded-[...]` is a ratchet violation. The keyboard navigation (Arrow keys, roving tabindex) is absent — only click is handled. `Tabs` provides full keyboard support by default.
**Fix:** Replace with `<Tabs variant="pills" tabs={tabs} value={selectedTab} onChange={setSelectedTab} />`.

---

### AP-05 — Custom breadcrumb in SelectPlanClient
**File:** `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx` lines 88–93
**Violation:** Custom `<div className="select-plan-breadcrumb">` with `MaterialIcon` chevrons instead of the DS `Breadcrumbs` component.
**Why wrong:** The custom breadcrumb does not render `<nav aria-label="Breadcrumb">` or `aria-current="page"` on the last item. These are accessibility requirements. The `Breadcrumbs` component provides both.
**Fix:** Replace with:
```tsx
<Breadcrumbs
  items={[{ label: storeName, href: `/${store}/dashboard` }, { label: 'Select a plan' }]}
  separator="chevron"
/>
```

---

### AP-06 — Local `formatINR` function instead of `formatInrCurrency`
**File:** `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx` lines 32–38
**Violation:** Two local functions `formatINR` (with `₹Xk` abbreviation for ≥ ₹1000) and `formatINRFull` (identical to `formatInrCurrency`) instead of importing from `@letbuyy/ui`.
**Why wrong:** `formatINRFull` is a direct duplication. `formatINR`'s `₹Xk` shorthand will diverge from any future canonical formatting decisions. Two formatting functions for INR currency in the same runtime create inconsistency.
**Fix:** Import `formatInrCurrency` from `@letbuyy/ui` and replace `formatINRFull`. For the abbreviated `₹Xk` form, add a `{ compact: true }` option to `formatInrCurrency` in `@letbuyy/ui`, or create `formatInrCompact` as a new export — then use the DS utility.

---

### AP-07 — Products page uses overlay-select for inline status change
**File:** `apps/merchant-control-plane/src/app/[store]/products/page.tsx` lines 291–314
**Violation:** A visually-rendered `Badge` with a 100%-opacity-0 `<select>` element overlaid absolutely on top for status changes.
**Why wrong:** The invisible `<select>` is not keyboard-discoverable in the same way as an intentionally visible control. Screen readers will announce the select element, not the badge, which creates a mismatch between what is visually shown and what is announced. The pattern is not consistent with the `Dropdown` component available in the DS.
**Fix:** Replace with a `Dropdown` trigger (rendered as a `Badge` via `asChild`-style composition or a small chevron beside the badge) and `DropdownMenu items` for each available status. This makes the interactive control explicit and keyboard-navigable.

---

### AP-08 — Missing retry action in products and customers error banners
**Files:** `apps/merchant-control-plane/src/app/[store]/products/page.tsx`, `apps/merchant-control-plane/src/app/[store]/customers/page.tsx`
**Violation:** Error banners for load failures do not include a "Retry" action. Coupons does include retry; products and customers do not.
**Why wrong:** A `Banner` without a recovery path is a dead end. Users have no mechanism to recover from a transient network error without a full page reload.
**Fix:** Add `action={<Button variant="secondary" onClick={() => void loadData()}>Retry</Button>}` to the `Banner` on all list pages.

---

### AP-09 — StatusBadge / statusToBadgeVariant not used by page code
**Files:** `apps/merchant-control-plane/src/app/[store]/products/page.tsx`, `apps/merchant-control-plane/src/app/[store]/customers/page.tsx`
**Violation:** Both pages define local status-to-variant mappings. Products uses `const productStatusBadge = { active: 'success', draft: 'warning', archived: 'critical' }`. Customers defines a local `customerStatusVariant(status)` function.
**Why wrong:** `statusToBadgeVariant()` and `StatusBadge` exist in `@letbuyy/ui` precisely to avoid this duplication. Local mappings will diverge as new status strings are added to the domain model.
**Fix:** Replace local status mappings with `<StatusBadge status={row.status} />` or `<Badge variant={statusToBadgeVariant(row.status)}>`. Import both from `@letbuyy/ui`.

---

### AP-10 — No step indicator in the 3-step onboarding wizard
**File:** `apps/identity-platform/src/app/onboarding/page.tsx`
**Violation:** The wizard has `TOTAL_STEPS = 3` constant but no step indicator (progress dots, numbered steps, or `ProgressBar`) is rendered. The user has no visual indication of how far through the flow they are.
**Why wrong:** 3-step wizards require step indicators for orientation. Without one, users do not know how many steps remain, which increases drop-off rates.
**Fix:** Add a step indicator above the form card. Options: `ProgressBar value={step} max={TOTAL_STEPS}` (shows percentage complete), or custom step dots. The `ProgressBar` from `@letbuyy/ui` is the lowest-effort correct implementation.

---

*End of Parts 6 and 7.*

*This document is generated from static source analysis as of 2026-06-19. Run `node scripts/validate-governance.mjs` for the authoritative validator gate result.*
