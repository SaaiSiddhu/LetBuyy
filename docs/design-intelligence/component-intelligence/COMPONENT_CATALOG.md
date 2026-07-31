# LetBuyy Component Catalog

Generated: 2026-06-19  
Source: Full read of `packages/typescript/ui/src/` and all active app runtimes.  
Authoritative exports are in `packages/typescript/ui/src/index.ts`.

---

## How to Read This Catalog

Each entry lists: **component name**, **file location**, **props surface** (key props only), **token compliance** (does it use only `--lb-*`?), and **usage notes**.

Token compliance key:
- COMPLIANT — all styles use `--lb-*` CSS custom properties
- PARTIAL — mixes `--lb-*` tokens with some raw Tailwind or inline px
- NONE — no `--lb-*` token usage

---

## 1. Foundation / Primitive

### MaterialIcon
**File:** `packages/typescript/ui/src/icons.tsx`  
**Props:** `name: MaterialIconName`, `size?: number`, `className?`, `strokeWidth? = 2`  
**Token compliance:** COMPLIANT (Lucide SVG; size is numeric, no token override needed)  
**Notes:** Maps ~150 semantic Material-style icon names to Lucide icons. Falls back to `Circle` for unknown names. Always renders with `aria-hidden="true"` and `focusable="false"`. Two name types: `StrictMaterialIconName` (compile-time safe) and `LooseMaterialIconName` (string). Also re-exports the full lucide-react icon set directly (`Bell`, `CheckCircle`, `AlertCircle`, etc.).

### Lucide Icons (re-export)
**File:** `packages/typescript/ui/src/icons.tsx`  
**Export:** ~80 named Lucide icons (`Bell`, `Check`, `AlertCircle`, `ChevronDown`, etc.)  
**Token compliance:** N/A  
**Notes:** Convenience re-export so apps do not need to depend on lucide-react directly. Marketing-site and storefront-runtime use these extensively.

### TokenStyleBoundary
**File:** `packages/typescript/ui/src/token-style-boundary.tsx`  
**Props:** `children`, `includeTokenStyles: boolean`, `tokenCss: string`  
**Token compliance:** COMPLIANT  
**Notes:** Context-aware style injection. Renders a `<style data-letbuyy-token-source>` tag only once per tree even when nested. Used to inject design token CSS into embedded contexts (email previews, iframes) without double-injecting.

### ThemeToggleButton
**File:** `packages/typescript/ui/src/theme-toggle-button.tsx`  
**Props:** extends `ButtonProps` minus `aria-label | children | onClick | size | type`  
**Token compliance:** COMPLIANT  
**Notes:** Wraps Button; reads `useTheme()` internally; toggles light/dark. Used in storefront-runtime account flows.

---

## 2. Layout

### Box
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `as?` (any HTML tag), `tone?`, `border?`, `radius?`, `shadow?`, `padding?`  
**Token compliance:** COMPLIANT  
**Notes:** Polymorphic container. All spacing/color expressed via token prop values.

### BlockStack
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `gap?`, `align?`, `justify?`, `children`  
**Token compliance:** COMPLIANT  
**Notes:** Flex column layout primitive.

### InlineStack
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `gap?`, `align?`, `justify?`, `wrap?`, `children`  
**Token compliance:** COMPLIANT  
**Notes:** Flex row layout primitive.

### Grid
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `columns?: { base, sm, md, lg, xl }`, `gap?`  
**Token compliance:** COMPLIANT  
**Notes:** CSS grid with responsive column count.

### Columns
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `columns?: { base, sm, md, lg, xl }`, `gap?`  
**Token compliance:** COMPLIANT  
**Notes:** Alias/variant of Grid oriented for equal-width columns.

### Container
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `size?: 'sm' | 'md' | 'lg' | 'xl' | 'page' | 'measure' | 'full'`  
**Token compliance:** COMPLIANT  
**Notes:** Max-width wrapper. Marketing-site uses a raw `<div className="container">` CSS class instead of this component.

### Page
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `children`  
**Token compliance:** COMPLIANT  
**Notes:** `<main>` element with max-width and responsive horizontal padding.

### PageHeader
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `title`, `description?`, `eyebrow?`, `breadcrumbs?`, `pageType?` (PageIdentityType), `primaryAction?`, `secondaryActions?`  
**Token compliance:** COMPLIANT  
**Notes:** Canonical page heading. Renders a `PageIdentity` icon when `pageType` is given. `secondaryActions` renders as an inline button cluster.

### PageIdentity
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `type: PageIdentityType`  
**Token compliance:** COMPLIANT  
**Notes:** 15 types: dashboard, products, orders, collections, inventory, customers, analytics, marketing, discounts, content, settings, apps, themes, payments, domains. Each maps to a Material Symbol icon name.

### Card
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `layout?: 'default' | 'stack' | 'split'`, `children`  
**Token compliance:** COMPLIANT  
**Notes:** `<section>` element. Stack = vertical flex, split = 50/50 side by side.

### Section
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `title?`, `columns?: 2 | 3`, `children`  
**Token compliance:** COMPLIANT  
**Notes:** Titled section with optional column grid body.

### Text
**File:** `packages/typescript/ui/src/layout.tsx`  
**Props:** `variant?: 'display' | 'heading' | 'body' | 'caption' | 'subdued' | 'strong' | 'positive' | 'negative' | 'code'`, `tone?`, `weight?`, `align?`, `truncate?`, `as?`  
**Token compliance:** COMPLIANT  
**Notes:** Polymorphic text primitive. All type styles map to `--lb-font-*` and `--lb-color-text-*` tokens.

### Divider
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `orientation?: 'horizontal' | 'vertical'`  
**Token compliance:** COMPLIANT  
**Notes:** `<hr>` element with `--lb-color-border` token.

---

## 3. Navigation

### AppNavigation
**File:** `packages/typescript/ui/src/navigation/app-navigation.tsx`  
**Props:** `sections: AppNavigationSection[]`, `brand?`, `footer?`, `topBar?`, `children`, `width?`, `sidebarClassName?`, `pathname?`, `className?`  
**Token compliance:** COMPLIANT  
**Notes:** Canonical application shell. Computes active state automatically via `usePathname()`. Composes `AppFrame`, `Sidebar`, and `Navigation`. Used in merchant-control-plane (`AdminShell.tsx`) for the entire admin layout.

### AppFrame
**File:** `packages/typescript/ui/src/app-shell.tsx`  
**Props:** Internal; composes the outer layout frame (header + sidebar + main content area)  
**Token compliance:** COMPLIANT

### Navigation
**File:** `packages/typescript/ui/src/app-shell.tsx`  
**Props:** `ariaLabel?`, `items: NavigationItem[]`  
**Token compliance:** COMPLIANT  
**Notes:** Data-driven nav list. Used in merchant-control-plane for the footer settings nav items.

### Sidebar
**File:** `packages/typescript/ui/src/app-shell.tsx`  
**Props:** `width?: 'xs' | 'sm' | 'md' | 'lg'`, `className?`  
**Token compliance:** COMPLIANT

### Breadcrumbs
**File:** `packages/typescript/ui/src/breadcrumbs.tsx`  
**Props:** `items: BreadcrumbItem[]` (label, href?, onClick?), `separator?: 'chevron' | 'slash'`, `currentTone?: 'emphasis' | 'inherit'`  
**Token compliance:** COMPLIANT (all classes use `--lb-*` via Tailwind arbitrary-value syntax)  
**Notes:** Renders a `<nav aria-label="Breadcrumb">` with proper `aria-current="page"` on the last item. Uses Button(unstyled) for clickable non-link items.

### isNavItemActive (utility)
**File:** `packages/typescript/ui/src/navigation/app-navigation.tsx`  
**Signature:** `isNavItemActive(pathname: string, href?: string): boolean`  
**Notes:** Checks exact match for `/` and prefix match for all other paths. Exported from @letbuyy/ui for apps that build nav items manually.

---

## 4. Overlay

### OverlayPortal
**File:** `packages/typescript/ui/src/overlays.tsx`  
**Props:** `children`  
**Token compliance:** COMPLIANT  
**Notes:** Creates a body-level `<div>` via ReactDOM.createPortal. Calls `mirrorOverlayTheme()` on mount and observes attribute mutations (MutationObserver) for live theme sync. Copies `data-letbuyy-theme`, `data-letbuyy-surface`, `data-letbuyy-density`, `data-theme` from `<html>` onto the portal container. This ensures overlays always match the app's pinned theme regardless of OS preference.

### Drawer
**File:** `packages/typescript/ui/src/overlays.tsx`  
**Props:** `open`, `onClose`, `side?: 'left' | 'right' | 'top' | 'bottom'`, `size?: 'sm' | 'md' | 'lg' | 'full'`, `title?`, `footer?`  
**Token compliance:** COMPLIANT  
**Notes:** Portaled via OverlayPortal. Keyboard: Escape closes. Focus trap implied by modal role.

### Popover
**File:** `packages/typescript/ui/src/overlays.tsx`  
**Props:** `trigger`, `children`, `open?`, `onOpenChange?`, `align?: 'start' | 'center' | 'end'`  
**Token compliance:** COMPLIANT  
**Notes:** Anchored floating panel. Supports both controlled and uncontrolled modes. Portaled.

### Dropdown / DropdownMenu
**File:** `packages/typescript/ui/src/overlays.tsx`  
**Props:** `trigger`, `items: DropdownItem[]`, `open?`, `onOpenChange?`  
**Token compliance:** COMPLIANT  
**Notes:** Keyboard-navigable menu (ArrowUp/Down, Home, End, Escape). Each item supports icon, disabled state, and destructive tone. Portaled via OverlayPortal.

### Modal
**File:** `packages/typescript/ui/src/overlays.tsx`  
**Props:** `open`, `onClose`, `title?`, `size?: 'sm' | 'md' | 'lg'`, `footer?`  
**Token compliance:** COMPLIANT  
**Notes:** Full-screen on mobile, centered on desktop. Portaled. Backdrop click closes.

### ConfirmDialog
**File:** `packages/typescript/ui/src/overlays.tsx`  
**Props:** `open`, `onClose`, `onConfirm`, `title`, `body?`, `confirmLabel?`, `cancelLabel?`, `destructive?`  
**Token compliance:** COMPLIANT  
**Notes:** Modal wrapper with pre-wired confirm/cancel buttons. `destructive` changes confirm button to destructive variant.

### Tooltip
**File:** `packages/typescript/ui/src/overlays.tsx`  
**Props:** `content`, `children`, `side?: 'top' | 'right' | 'bottom' | 'left'`  
**Token compliance:** COMPLIANT  
**Notes:** CSS-only show on hover/focus. Touch devices get a tap toggle.

---

## 5. Feedback

### Badge
**File:** `packages/typescript/ui/src/feedback.tsx`  
**Props:** `variant?: 'default' | 'info' | 'success' | 'warning' | 'critical'`, `children`  
**Token compliance:** COMPLIANT  
**Notes:** Shows a status icon for non-default variants. Used for order/payment statuses.

### StatusBadge
**File:** `packages/typescript/ui/src/feedback.tsx`  
**Props:** `status: string`  
**Token compliance:** COMPLIANT  
**Notes:** Wraps Badge; derives variant by calling `statusToBadgeVariant(status)`.

### statusToBadgeVariant (utility)
**File:** `packages/typescript/ui/src/feedback.tsx`  
**Signature:** `statusToBadgeVariant(status: string): StatusVariant`  
**Notes:** Canonical status-to-tone mapping. Maps strings like `'active'`, `'paid'`, `'shipped'` → `'success'`; `'cancelled'`, `'failed'`, `'expired'` → `'critical'`; `'pending'`, `'processing'` → `'warning'`; etc.

### Banner
**File:** `packages/typescript/ui/src/feedback.tsx`  
**Props:** `variant?: 'info' | 'success' | 'warning' | 'critical'`, `title?`, `children`, `action?`  
**Token compliance:** COMPLIANT  
**Notes:** Page-level alert bar with icon, title, body text, and optional action button slot.

### ToastProvider + useToast
**File:** `packages/typescript/ui/src/feedback.tsx`  
**ToastProvider props:** `children`  
**useToast returns:** `{ notify(toast), dismiss(id) }`  
**Token compliance:** COMPLIANT  
**Notes:** Context-based toast system. `notify()` accepts `{ title, body?, variant?, duration? }`. Supports multi-placement (top/bottom-right by default). Used in merchant-control-plane via `<ToastProvider>` in AdminShell.

### Skeleton
**File:** `packages/typescript/ui/src/feedback.tsx`  
**Props:** `variant?: 'text' | 'card' | 'table'`, `lines? = 3` (text variant), `rows? = 5` (table variant)  
**Token compliance:** COMPLIANT  
**Notes:** Loading placeholder. Text = gray bar lines; card = single card height block; table = repeated row heights.

### EmptyState + EmptyStateIllustration
**File:** `packages/typescript/ui/src/feedback.tsx`  
**Props:** `kind: EmptyStateKind`, `title?`, `body?`, `primaryAction?`, `secondaryAction?`  
**EmptyStateKind values:** `'generic' | 'products' | 'collections' | 'inventory' | 'orders' | 'customers' | 'discounts' | 'marketing' | 'content' | 'domains' | 'themes' | 'analytics' | 'apps' | 'payments'`  
**Token compliance:** COMPLIANT  
**Notes:** 14 domain-specific kinds, each with an inline SVG motif. primaryAction/secondaryAction accept `{ label, onClick }`.

### SaveBar
**File:** `packages/typescript/ui/src/feedback.tsx`  
**Props:** `state: 'saved' | 'unsaved' | 'saving'`, `onSave`, `onDiscard`, `saveLabel?`, `discardLabel?`  
**Token compliance:** COMPLIANT  
**Notes:** Sticky bottom bar for form-save state. Animates in when `state === 'unsaved'`. Uses `--lb-color-surface-overlay` and `--lb-shadow-*` tokens.

---

## 6. Form

### Button
**File:** `packages/typescript/ui/src/button.tsx`  
**Props:** `variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'`, `size?: 'sm' | 'md' | 'lg' | 'icon'`, `loading?`, `fullWidth?`, `unstyled?`, `asChild?`, `as?: 'button' | 'a'`  
**Token compliance:** COMPLIANT (`--lb-component-button-*`, `--lb-density-*`)  
**Notes:** `unstyled` mode (escape hatch for legacy adoption) strips all design-system classes. `asChild` clones the single React child, merging button class/behavior. Loading state renders `<Loader2>` spinner and disables interaction.

### Input
**File:** `packages/typescript/ui/src/input.tsx`  
**Props:** `label?`, `helperText?`, `error?`, `leftIcon?`, `rightIcon?`, `unstyled?`, plus native input props  
**Token compliance:** COMPLIANT (`--lb-component-input-*`)  
**Notes:** Wraps `<input>` with label, helper, and error slot. `error` triggers red ring and `InlineError` below.

### Textarea
**File:** `packages/typescript/ui/src/input.tsx`  
**Props:** `label?`, `helperText?`, `error?`, `unstyled?`, plus native textarea props  
**Token compliance:** COMPLIANT

### InlineError
**File:** `packages/typescript/ui/src/input.tsx`  
**Props:** `children`  
**Token compliance:** COMPLIANT  
**Notes:** Renders a small `AlertCircle` icon + error text in critical tone. Can be used standalone outside Input.

### NumberField
**File:** `packages/typescript/ui/src/input.tsx`  
**Props:** All Input props plus `onValueChange?: (value: number | null) => void`, `min?`, `max?`, `step?`  
**Token compliance:** COMPLIANT  
**Notes:** Wraps Input; handles numeric coercion and NaN→null.

### Checkbox
**File:** `packages/typescript/ui/src/controls.tsx`  
**Props:** `label?`, `description?`, `helperText?`, `error?`, `checked?`, `onCheckedChange?`, `unstyled?`  
**Token compliance:** COMPLIANT

### Radio
**File:** `packages/typescript/ui/src/controls.tsx`  
**Props:** Same shape as Checkbox  
**Token compliance:** COMPLIANT

### Switch
**File:** `packages/typescript/ui/src/controls.tsx`  
**Props:** `checked?`, `onChange?`, `label?`, `disabled?`  
**Token compliance:** COMPLIANT  
**Notes:** `<button role="switch" aria-checked>`. Supports both internal and controlled state.

### ChoiceList
**File:** `packages/typescript/ui/src/controls.tsx`  
**Props:** `type: 'radio' | 'checkbox'`, `options: ChoiceOption[]`, `value?`, `onChange?`, `layout?: 'vertical' | 'horizontal'`  
**Token compliance:** COMPLIANT  
**Notes:** Radio or checkbox group with card-style options (optional border, title, description, media slot).

### Select
**File:** `packages/typescript/ui/src/controls.tsx`  
**Props:** `label?`, `helperText?`, `error?`, `size?: 'sm' | 'md' | 'lg'`, `prefixContent?`, native select props  
**Token compliance:** COMPLIANT  
**Notes:** Native `<select>` with design system chrome.

### Combobox
**File:** `packages/typescript/ui/src/controls.tsx`  
**Props:** `options: ComboboxOption[]`, `value?`, `onChange?`, `label?`, `placeholder?`, `filter?` (custom filter fn), `async?`  
**Token compliance:** COMPLIANT  
**Notes:** Custom combobox with listbox, fuzzy filter (or custom filter), full keyboard navigation. Async-capable for server search.

### Tabs
**File:** `packages/typescript/ui/src/controls.tsx`  
**Props:** `tabs: Tab[]`, `value?`, `onChange?`, `variant?: 'underline' | 'pills'`  
**Token compliance:** COMPLIANT  
**Notes:** Keyboard Arrow/Home/End navigation. Underline variant for page-level tabs; pills for filter switching.

---

## 7. Data Display

### Table
**File:** `packages/typescript/ui/src/table.tsx`  
**Props (data mode):** `columns: TableColumn<T>[]`, `rows: T[]`, `sortable?`, `selectable?`, `bulkActions?: TableBulkAction<T>[]`, `savedViews?: TableSavedView[]`, `filterChips?: TableFilterChip[]`  
**Props (static mode):** `children` (renders a plain `<table>`)  
**TableColumn keys:** `key`, `header`, `sortable?`, `truncate?`, `shrink?`, `width?`, `render?`, `cardLabel?`, `cardRender?`  
**Token compliance:** COMPLIANT  
**Notes:** Dual-mode. Responsive: on mobile renders `<article>` + `<dl>` card layout (`md:hidden`); on desktop renders `<thead>/<tbody>` table (`hidden md:block`). `cardLabel`/`cardRender` let columns define their own mobile card representation.

### MetricCard
**File:** `packages/typescript/ui/src/productivity.tsx`  
**Props:** `label`, `value`, `delta?: { value, tone: 'positive' | 'negative' | 'neutral' }`, `sparkline?: number[]`  
**Token compliance:** COMPLIANT  
**Notes:** Dashboard metric tile. Sparkline renders as an SVG `<polyline>` inside the card.

### DescriptionList
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `items: { label, value }[]`, `columns?: 1 | 2`  
**Token compliance:** COMPLIANT  
**Notes:** Renders `<dl>` with `<dt>/<dd>` pairs.

### Chart
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `type: 'line' | 'bar' | 'area'`, `data: number[]`, `labels?: string[]`, `height?`  
**Token compliance:** COMPLIANT  
**Notes:** SVG-based chart. Accessible via `<dl>` (sr-only). Grid lines use `--lb-color-border` token.

### ProgressBar
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `value: number`, `max?: number`, `label?`, `showPercent?`  
**Token compliance:** COMPLIANT  
**Notes:** Token-compliant. AISidebar in merchant-control-plane uses a raw HTML `<progress>` instead (violation).

### FilterChips
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `chips: FilterChip[]`, `onRemove(chip)`, `onClear()`  
**Token compliance:** COMPLIANT

### Avatar
**File:** `packages/typescript/ui/src/productivity.tsx`  
**Props:** `name: string`, `imageUrl?`, `size?: 'sm' | 'md' | 'lg'`  
**Token compliance:** COMPLIANT  
**Notes:** Renders initials (up to 2 chars) or image. HeaderBar.tsx in merchant-control-plane renders initials manually instead of using this.

### Pagination
**File:** `packages/typescript/ui/src/productivity.tsx`  
**Props:** `page`, `totalPages`, `onPageChange`, `showPageNumbers?`, `pageSize?`, `onPageSizeChange?`, `pageSizeOptions?`  
**Token compliance:** COMPLIANT

### FilterBar
**File:** `packages/typescript/ui/src/productivity.tsx`  
**Props:** `search?`, `filters?`, `actions?`, `chips?`, `bulkActions?`  
**Token compliance:** COMPLIANT  
**Notes:** Container that lays out search input + filter dropdowns + action buttons + filter chips + bulk action bar.

### CommandPalette
**File:** `packages/typescript/ui/src/productivity.tsx` (exported from @letbuyy/ui)  
**Props:** `open`, `onClose`, `actions: PaletteAction[]`, `placeholder?`  
**Token compliance:** COMPLIANT  
**Notes:** Full-featured command palette with keyboard navigation, action list with shortcut display. **Not the same as `apps/merchant-control-plane/src/components/CommandPalette.tsx`** which is a local duplicate with additional entity search.

---

## 8. Disclosure / Composition

### Disclosure
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `title`, `children`, `open?`, `onOpenChange?`  
**Token compliance:** COMPLIANT  
**Notes:** Single expandable panel with animated chevron.

### Accordion
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `items: AccordionItem[]`, `allowMultiple?`  
**Token compliance:** COMPLIANT  
**Notes:** Wraps multiple Disclosure items. Single expansion mode by default.

### SegmentedControl
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `options: { value, label }[]`, `value?`, `onChange?`  
**Token compliance:** COMPLIANT  
**Notes:** Radio group with visual pill style.

### DensityToggle
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `value?: 'compact' | 'comfortable' | 'spacious'`, `onChange?`  
**Token compliance:** COMPLIANT  
**Notes:** Wraps SegmentedControl with density-specific options. Sets `--lb-density-*` tokens on the nearest context.

### DateRangePicker
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `value?: { from, to }`, `onChange?`, `compare?`, `onCompareChange?`  
**Token compliance:** COMPLIANT  
**Notes:** Fieldset with two date inputs and a compare checkbox.

### DatePicker
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `value?`, `onChange?`, `label?`  
**Token compliance:** COMPLIANT

### Spinner
**File:** `packages/typescript/ui/src/primitives.tsx`  
**Props:** `label?: string` (sr-only)  
**Token compliance:** COMPLIANT  
**Notes:** Renders `<Loader2>` with spin animation and a screen-reader label.

---

## 9. Internal Workspace (platform-console only)

These components are for operator/internal surfaces only. Not used in merchant or storefront apps.

### InternalWorkspace
**File:** `packages/typescript/ui/src/internal-workspace.tsx`  
**Props:** `eyebrow`, `title`, `description`, `children`  
**Token compliance:** COMPLIANT  
**Notes:** Page shell with standardized header for ops/internal pages.

### InternalMetricGrid
**File:** `packages/typescript/ui/src/internal-workspace.tsx`  
**Props:** `children`  
**Token compliance:** COMPLIANT  
**Notes:** 2-col (sm) / 4-col (xl) CSS grid for metric cards.

### InternalMetric
**File:** `packages/typescript/ui/src/internal-workspace.tsx`  
**Props:** `label`, `value`, `detail?`, `tone?: 'neutral' | 'success' | 'warning' | 'critical'`  
**Token compliance:** COMPLIANT

### InternalPanel
**File:** `packages/typescript/ui/src/internal-workspace.tsx`  
**Props:** `title`, `description?`, `action?`, `children`  
**Token compliance:** COMPLIANT  
**Notes:** Titled panel with border and body padding.

### InternalModuleGrid
**File:** `packages/typescript/ui/src/internal-workspace.tsx`  
**Props:** `children`, `density?: 'leadership' | 'standard'`  
**Token compliance:** COMPLIANT  
**Notes:** 2-col (md) / 3-col (2xl) grid.

### InternalModuleCard
**File:** `packages/typescript/ui/src/internal-workspace.tsx`  
**Props:** `title`, `description`, `href`, `status`, `detail?`  
**Token compliance:** COMPLIANT  
**Notes:** Linked card with status pill and hover accent border.

### InternalStatusPill
**File:** `packages/typescript/ui/src/internal-workspace.tsx`  
**Props:** `value: string`, `tone?: 'success' | 'warning' | 'critical' | 'info'`  
**Token compliance:** COMPLIANT  
**Notes:** Derives tone from known status strings if `tone` is omitted.

### InternalSkipBackendPanel
**File:** `packages/typescript/ui/src/internal-workspace.tsx`  
**Props:** `title`, `children`  
**Token compliance:** COMPLIANT  
**Notes:** Warning panel rendered when a live data source is not connected.

### InternalEmptyDataState
**File:** `packages/typescript/ui/src/internal-workspace.tsx`  
**Props:** `message`  
**Token compliance:** COMPLIANT  
**Notes:** Dashed border empty state for internal data panels.

---

## 10. Specialized: Marketplace

### MarketplaceUnavailable
**File:** `packages/typescript/ui/src/marketplace.tsx`  
**Props:** `title?`, `body?`, `buttonLabel?`, `onRetry?`, `className?`, `headingClassName?`, `bodyClassName?`, `buttonClassName?`, style props  
**Token compliance:** NONE (no `--lb-*` tokens; fully unstyled, className passthrough)  
**Notes:** Emergency error state for frozen marketplace surfaces. Intentionally unstyled — callers apply any needed styles. Uses a raw `<button>` (not the DS Button component).

---

## 11. App-Layer Components (Not in @letbuyy/ui)

These components exist in specific apps and are not promoted to the shared library.

### merchant-control-plane

#### AdminShell (MerchantControlPlaneShell)
**File:** `apps/merchant-control-plane/src/components/AdminShell.tsx`  
**Notes:** Main layout shell. Composes AppNavigation, ToastProvider, HeaderBar, TrialBanner, CommandPalette, AISidebar. Handles 3 layout modes: full-screen, settings, standard. Builds `AppNavigationSection[]` from `getMerchantNavigation(siteType)`.

#### CommandPalette (LOCAL)
**File:** `apps/merchant-control-plane/src/components/CommandPalette.tsx`  
**Notes:** Local duplicate of @letbuyy/ui CommandPalette. Adds live entity search (products, orders, customers via API), search category chips, and section grouping. Uses `Input(unstyled)`, `Button(unstyled)`, `MaterialIcon` from @letbuyy/ui; renders its own list/chip UI with `admin-cmd-*` CSS classes.

#### HeaderBar
**File:** `apps/merchant-control-plane/src/components/HeaderBar.tsx`  
**Notes:** Top bar with logo, search trigger, store-switcher dropdown, notifications, AI sidebar toggle. Custom store switcher (pill + dropdown + mobile bottom sheet). Uses `Button(unstyled)`, `MaterialIcon`, `useTheme` from @letbuyy/ui. Custom user initials (does not use `Avatar` from @letbuyy/ui). Global keyboard shortcut handler (Cmd+K, g/, n/ prefix routes).

#### AISidebar
**File:** `apps/merchant-control-plane/src/components/AISidebar.tsx`  
**Notes:** Setup assistant with dynamic todo list. Uses `Button`, `MaterialIcon` from @letbuyy/ui. Uses raw `<progress>` element (not `ProgressBar` from @letbuyy/ui). `admin-ai-*` CSS classes.

#### NotificationsPanel
**File:** `apps/merchant-control-plane/src/components/NotificationsPanel.tsx`  
**Notes:** Uses `Button`, `Bell`, `EmptyState`, `MaterialIcon`, `Skeleton` from @letbuyy/ui. Unread count badge implemented as inline token-expression class string (not `Badge` from @letbuyy/ui). Mixed pattern: `admin-notifications-*` CSS classes + Tailwind with `var(--lb-*)` arbitrary-value syntax.

#### TrialBanner
**File:** `apps/merchant-control-plane/src/components/TrialBanner.tsx`  
**Notes:** Trial countdown strip rendered at the bottom of the dashboard page.

#### ProviderModeBadge
**File:** `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx`  
**Notes:** Inline badge for provider mode (`test` / `live`). Uses raw Tailwind with `py-[2px]` (raw px value, minor violation). Does not use `Badge` from @letbuyy/ui.

#### SettingsShell
**File:** `apps/merchant-control-plane/src/components/settings/SettingsShell.tsx`  
**Notes:** Settings page layout shell with floating sidebar navigation.

#### SettingsSearch
**File:** `apps/merchant-control-plane/src/components/settings/SettingsSearch.tsx`  
**Notes:** Search input for settings pages. Uses a raw `<input>` with long Tailwind token-expression class string instead of `Input` from @letbuyy/ui. Violates DS ratchet — should use `Input`.

#### SettingsPane / SettingsIndex
**File:** `apps/merchant-control-plane/src/components/settings/`  
**Notes:** Individual settings panel wrapper and settings index grid.

#### StepUpDialog
**File:** `apps/merchant-control-plane/src/components/security/StepUpDialog.tsx`  
**Notes:** Step-up auth modal. Uses `Button`, `Input`, `Banner` from @letbuyy/ui.

#### ConnectDomainWizard / DomainDetailView
**File:** `apps/merchant-control-plane/src/components/domains/`  
**Notes:** Domain connection and management components. Use multiple @letbuyy/ui primitives.

#### BillingPaymentMethods
**File:** `apps/merchant-control-plane/src/components/billing/BillingPaymentMethods.tsx`  
**Notes:** Payment method management UI.

#### EmbeddedAppBridgeClient
**File:** `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx`  
**Notes:** Embedded app iframe with message bridge. Uses inline Tailwind token-expression classes for tab buttons (no use of DS `Tabs` component).

#### SelectPlanClient
**File:** `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx`  
**Notes:** Full-page plan selector. Uses `Button(unstyled)`, `MaterialIcon` from @letbuyy/ui. All layout via `select-plan-*` and `lb-switch-*` CSS classes. Custom `formatINR`/`formatINRFull` functions (instead of shared `formatInrCurrency`). Plan grid, compare table, feature list, competitor switch section all custom.

#### ExperiencePicker / CenterPanel / SchemaFormRenderer
**File:** `apps/merchant-control-plane/src/components/theme-editor/`  
**Notes:** Theme editor components.

### identity-platform

#### AuthIcon
**File:** `apps/identity-platform/src/components/AuthIcon.tsx`  
**Notes:** Thin wrapper around `MaterialIcon` that narrows the allowed icon names to an `AuthIconName` union. Adds proper `role="img"` and `aria-label` when a title is passed.

### platform-console

#### ConsoleWorkspace (and family)
**File:** `apps/platform-console/src/components/_local-ui/console-workspace.tsx`  
**Notes:** Thin wrappers that re-expose InternalWorkspace family components under console-specific names (`ConsoleWorkspace`, `MetricGrid`, `LeadershipMetric`, `Panel`, `ModuleGrid`, `ModuleCard`, `StatusPill`, `SkipBackendPanel`, `EmptyDataState`). Zero custom logic — pure passthrough to @letbuyy/ui.

### marketing-site

#### FAQ
**File:** `apps/marketing-site/src/components/FAQ.tsx`  
**Notes:** Accordion FAQ component using framer-motion for animation. Uses `ChevronDown` from @letbuyy/ui. Custom accordion implementation (not @letbuyy/ui `Accordion`). Metric cards and trust list are raw HTML with `faq-*` CSS classes.

#### Features
**File:** `apps/marketing-site/src/components/Features.tsx`  
**Notes:** Very large component (~860 lines). Interactive Commerce OS graph (SVG), workspace previews, live event feed, automation showcase. Uses `MaterialIcon`, `AppWindow`, `BarChart3`, `CreditCard`, `Package`, `ShoppingBag`, `Store`, `Users` from @letbuyy/ui. All layout via `cop-*`, `ws-*` CSS classes. Custom `useCountUp` hook. No DS layout components used.

#### Pricing
**File:** `apps/marketing-site/src/components/Pricing.tsx`  
**Notes:** Plan cards and compare table sourced from API gateway. Uses `AlertCircle`, `Check`, `ChevronUp` from @letbuyy/ui. Custom `PlanCardSkeleton` (not `Skeleton` from @letbuyy/ui). Uses `select-plan-compare-*` CSS classes shared with SelectPlanClient.

### storefront-runtime

The storefront-runtime uses @letbuyy/ui icon re-exports (`Button`, `Input`, `EmptyState`, `Skeleton`, `MaterialIcon`, various Lucide icons) and `ThemeToggleButton` in its account and checkout client components. It does not use DS layout or data-display components — it renders Liquid sections or custom HTML.

---

## 12. Design System Infrastructure

### Formatting Utilities (exported from @letbuyy/ui)
- `formatInrCurrency(paise: number): string` — canonical INR formatter
- `formatIndiaDate(isoDate: string): string` — `en-IN` locale date formatter

### Theme System
- `useTheme()` — returns `{ resolvedTheme, setTheme }` (light/dark/system)
- `letbuyyPrimitiveTokens` — raw CSS custom property values for embedding in non-React contexts

### PageIdentity
15 domain icons available as named types. Exported from layout.tsx.

---

*This catalog covers 60+ components in `@letbuyy/ui` and key app-layer components across 5 runtimes. It does not cover reserved/frozen app directories (`app-marketplace`, `developer-portal`, `theme-marketplace`).*
