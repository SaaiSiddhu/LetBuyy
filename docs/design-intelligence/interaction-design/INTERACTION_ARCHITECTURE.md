# LetBuyy Interaction Architecture

Generated: 2026-06-19
Source analysis: packages/typescript/ui/src/* + merchant-control-plane + identity-platform + storefront-runtime + marketing-site

---

## Navigation Patterns

### Primary Navigation: Canonical Sidebar (merchant-control-plane)

The merchant app uses a **data-driven sidebar** via `AppNavigation` (`packages/typescript/ui/src/navigation/app-navigation.tsx`). Apps pass a `sections` array; active state is computed automatically from `usePathname()`, eliminating the hand-rolled divergence documented in `NAVIGATION_GOVERNANCE_AUDIT.md`.

**Sidebar anatomy:**
- Fixed left panel, 3 width variants: `sm=220px`, `md=260px` (default), `lg=320px`
- Header slot: brand logo / store switcher
- Body: scrollable, sections separated by `mt-[var(--lb-space-4)]`
- Footer slot: user profile / settings
- Border: `border-r border-[var(--lb-component-sidebar-border)]`

**Active state mechanism:**
```
isNavItemActive(pathname, href):
  - Exact match for root '/'
  - pathname.startsWith(href + '/') for all other routes
```

**Collapsible nested items:**
- Parent with `children[]` renders a chevron (rotates 90° when open)
- State: `useState(anyChildActive)` — opens automatically if a child is active
- Parent shows `aria-expanded`, children use `role="option"` with indented `pl-[calc(--lb-space-3 + icon-size + --lb-space-2)]`
- No animation; open/close is instantaneous

**Two navigation variants in identity-platform:**
The auth/onboarding flows do NOT use the AppNavigation shell. They use a minimal top bar (`auth-top-bar` CSS class) with: language toggle, theme toggle, and user dropdown (custom popover). This is a separate system.

### Breadcrumbs

Component: `Breadcrumbs` (`packages/typescript/ui/src/breadcrumbs.tsx`)

- Two separator variants: `chevron` (default, uses `ChevronRight` icon) and `slash`
- Current item gets `aria-current="page"` and can be `emphasis` (default, full text color) or `inherit` (stays subdued)
- Items can be `href` links, `onClick` buttons, or plain `<span>` (non-navigable)
- Used in merchant pages inside `PageHeader` component

**Breadcrumb usage pattern (merchant-control-plane):**
```
Products:   Home → Products
Customers:  Home → Customers
Coupons:    Marketing → Coupons
```
Breadcrumbs are always 2 levels. The home link points to `/{store}/dashboard`.

### Back Navigation

No dedicated "back" button component exists in the design system. Back navigation is handled:
1. In multi-step flows (onboarding): inline `Button` with `arrow_back` icon + explicit `onClick={() => setStep(n-1)}`
2. In drawer/modal overlays: the `onClose` callback returns to previous state
3. Standard browser back is relied upon for page-level navigation

### Deep Link Patterns

All merchant pages are addressable: `/{store}/products`, `/{store}/customers`, etc. The storefront uses `/{subdomain}/...` routing via proxy middleware.

---

## Action Patterns

### Primary Action Placement

Pattern: **top-right of PageHeader** for primary page-level action.

```
PageHeader
  ├── eyebrow (category label)
  ├── title
  ├── description
  ├── breadcrumbs (left-aligned)
  ├── primaryAction → Button (primary variant, top-right)
  └── secondaryActions → Button[] (secondary variant, beside primary)
```

Evidence from products page:
```
primaryAction: { label: 'Add product', href: '/{store}/products/new', icon: <MaterialIcon name="add" /> }
secondaryActions: [{ label: 'Collections', href: '/{store}/products/collections' }]
```

Within-section actions (e.g. coupon form buttons) are stacked **below the form** in a `flex flex-wrap gap-[--lb-space-2]` row with primary button first, cancel second.

### Destructive Actions

Confirmed via `ConfirmDialog` in coupons page:

```
<ConfirmDialog
  title="Delete coupon?"
  description="Delete SUMMER20? This removes the discount from checkout promotions."
  confirmLabel="Delete coupon"
  cancelLabel="Keep coupon"
  destructive={true}          // renders confirm button as 'destructive' variant (red)
  onConfirm={handleDelete}
  onClose={() => setCouponToDelete(null)}
/>
```

Pattern: trash icon in table row → sets `couponToDelete` state → `ConfirmDialog` opens → user must explicitly confirm. The cancel label is phrased as a positive action ("Keep coupon"), not just "Cancel".

The `ConfirmDialog` component uses `Modal` internally. The confirm button renders as `variant="destructive"` when `destructive=true`.

### Bulk Operations

Implemented via `Table` component's `bulkActions` prop:

1. Checkbox column appears when `bulkActions` is provided
2. "Select all" checkbox in header row
3. When rows are selected: a bulk action bar replaces the filter toolbar, showing `{n} selected` count + action buttons
4. Actions: non-destructive (`variant="secondary"`) or destructive (`variant="destructive"`)

**Products bulk actions:** Publish selected, Set as draft
**Customers bulk actions:** Copy emails (clipboard)

Bulk action execution uses sequential per-row PATCH calls with partial failure handling: counts failures and shows a `warning` toast if some succeeded.

### Loading States During Actions

Multiple patterns exist:

| Pattern | Usage |
|---|---|
| `Button loading={true}` (spinner in button) | Coupon create/edit save, onboarding submit |
| `Skeleton variant="table" lines={n}` | Full page initial load for list pages |
| `Skeleton variant="card"` | Mobile card list |
| `updatingStatusId` per-row | Product status dropdown change |
| `togglingId` per-row | Coupon active toggle |
| Custom `select-loading-spinner` CSS | Identity platform flows |

### Success/Error Feedback After Actions

**Success:** `notify({ title, description, variant: 'success' })` via `useToast()` hook. Toast appears top-right, auto-dismisses after 5000ms.

**Error:** Two mechanisms:
1. Local `Banner` component (critical variant) inlined above the relevant section when error affects page state
2. `notify({ variant: 'critical' })` toast for transient errors on mutations

Pattern: if the page fails to load, show a `Banner`; if a mutation fails, show a `notify` toast (plus sometimes a `Banner` for page-level impact).

---

## Dialog Patterns

### Types Available

| Type | Component | File |
|---|---|---|
| Modal | `Modal` | overlays.tsx |
| Confirm Dialog | `ConfirmDialog` | overlays.tsx |
| Drawer | `Drawer` | overlays.tsx |
| Popover | `Popover` | overlays.tsx |
| Dropdown/Menu | `Dropdown` / `DropdownMenu` | overlays.tsx |
| Tooltip | `Tooltip` | overlays.tsx |

### When Each Type Is Used

**Modal:** Multi-purpose centered overlay for forms, information, content. Max width `min(640px, 100vw - space-6)`. Full-screen on mobile.

**ConfirmDialog:** Wraps Modal. Always has Cancel + Confirm buttons. Cancel is `secondary`, Confirm is `primary` or `destructive`. Used exclusively for irreversible data mutations (delete coupon).

**Drawer:** Slide-in panel from any side (default: `right`). Sizes: `sm=360px`, `md=440px`, `lg=560px`, `full`. Used for contextual side panels (not yet seen in reviewed pages but available in the system).

**Popover:** Anchored floating panel, portaled to body. Used for rich non-list content (forms, filters). Max width `min(320px, 100vw - space-6)`.

**Dropdown/DropdownMenu:** Anchored floating menu list. Keyboard navigation: Arrow keys, Home/End, Escape. Supports `destructive` items (red text). Used for action menus.

**Tooltip:** CSS-only hover/focus reveal. Touch: tap to toggle. No portal; uses CSS group-hover.

### Common Properties Across All Overlays

- Portal to `<body>` via `OverlayPortal` (theme mirroring applied — fixes dark OS + light app palette mismatch)
- `useFocusTrap` on all blocking overlays (Modal, Drawer)
- `useScrollLock` on Modal + Drawer (prevents body scroll)
- `useDismiss`: Escape key + outside-click close on all overlays
- `useAnchoredPosition`: Fixed-position anchoring for Popover + Dropdown (no Popper.js dependency)

---

## List/Table Patterns

### Data Table Component

`Table` component (`packages/typescript/ui/src/table.tsx`) is the canonical list renderer. It is **responsive**: card layout on `< md`, table layout on `>= md`.

**Desktop table:** `<table>` with `thead` + `tbody`. Header: `bg-[var(--lb-component-table-header-bg)]`.
**Mobile card:** `<article>` grid. First column is the primary identifier; remaining columns render as a `<dl>` 2-column key-value grid.

### Sorting

- Columns marked `sortable: true` render the header as a ghost button with sort icon
- On mobile: a horizontal scroll bar of sort chip buttons appears above the cards
- Toggle direction: clicking the active sort key flips `asc`/`desc`
- Icon: `ArrowUp` for asc, `ArrowDown` for desc

### Filtering: Saved Views

Tabs displayed as a horizontal pill row above the table (`savedViews` prop). Active view uses `variant="primary"`, inactive uses `variant="secondary"`.

**Products:** All / Active / Draft / Archived
**Customers:** All / Active / Has orders / High value / New

Active filters that have been applied appear as removable `Badge` chips (`variant="info"`) in the filter toolbar.

### Search

Pattern: `Input` with `leftIcon={<Search />}`, label "Search products" / "Search customers", placed above the table in a responsive grid: `md:grid-cols-[1fr auto]` (search input + Refresh button).

Search is client-side (filters `sortedProducts` useMemo). The `loadCustomers` API call does accept a `search` param but is triggered on full page refresh, not keystroke.

### Pagination

No pagination component exists in the reviewed code. All list pages fetch with `limit: 100` and show all results client-side. No infinite scroll.

### Empty States

`EmptyState` component with:
- Contextual SVG illustration (`EmptyStateIllustration`) with 14 named kinds (products, customers, orders, etc.)
- Custom `<Image>` illustrations from `/Emptystate Illustration/*.png` override the SVG when available
- Title (always present)
- Body text (optional description)
- Primary action (Button)
- Secondary action (Button)

**Context-aware empty states:**
- No results from search: title "No matching X", secondary action = "Clear search"
- Network error: title "Unable to load X", primary action = Retry button
- Truly empty: title "Add your first X", primary action = create action, secondary = browse/explore

### Row Click / Selection

- Row click navigates: `onRowClick={(row) => router.push(...)}`
- Cell-level actions (status dropdown, edit/delete icons) use `e.stopPropagation()` to prevent row click
- Selection via checkbox column; bulk action bar replaces view tab row when items are selected

---

## Form Patterns

### Layout

**Standard layout:** Single column (full width) inside a `Card > Section`
**Coupon form:** 2-column grid (`md:grid-cols-2`) with full-width items using `md:col-span-2`
**Onboarding:** Single column, centered card (`auth-card onboard-card`)
**Plan selection:** Not a form; uses a CSS-grid card layout (`select-plan-grid`)

### Validation

Three patterns observed:

1. **Real-time async validation (subdomain in onboarding):**
   - Debounced 400ms on keystroke
   - Shows "Checking availability…" spinner
   - Shows `check_circle` / `cancel` icon + message below input
   - `Next` button disabled until `validation?.valid`

2. **Submit-time validation (coupon form):**
   - Checks `formData.code` and `formData.value` before calling API
   - Sets `formError` state → shown as `Banner variant="critical"` above the form
   - `Button` has `disabled={!formData.code || (!formData.value && type !== 'free_shipping')}`

3. **No validation (customers, products):** Search input is unvalidated

### Error Display

- Field-level errors: `Input` component renders `<p id="errorId" className="text-[color:var(--lb-color-critical)]">` below the input
- Form-level errors: `Banner variant="critical"` above the form fields
- Page-level errors: `Banner variant="critical"` at the top of the main content area

### Required Fields

Required indicator: `requiredIndicator` prop on `Select`/`ChoiceList` renders `<span aria-hidden="true">*</span>` in critical color after the label. Not universally applied — most form fields do not mark required fields explicitly.

### Save/Cancel Pattern

**In-page expanded form (coupons):** Primary + Cancel buttons below form fields. Plus the `SaveBar` (sticky bottom) which also offers Save/Discard.

**Modal/Dialog forms:** Footer slot with Cancel (secondary) + Save (primary) buttons. On mobile, buttons stack full-width; on desktop, they are `auto` width, right-aligned (`flex-row justify-end`).

**SaveBar pattern (coupons):** Sticky bottom bar, appears only when `state !== 'saved'`. Shows "Unsaved changes" with AlertCircle icon, or "Saving changes" with spinner. Transitions `opacity-0 pointer-events-none` when saved.

---

## Loading States

| Pattern | Component/Class | When Used |
|---|---|---|
| Table skeleton | `Skeleton variant="table" lines={n}` | Initial load of list pages |
| Card skeleton | `Skeleton variant="card"` | Mobile card list loading |
| Text skeleton | `Skeleton variant="text" lines={n}` | General placeholder text |
| Button spinner | `Button loading={true}` | Mutation in progress (save, delete) |
| Row-level spinner | Custom `loading` state + button | Per-row status toggle |
| Page-level spinner | `.select-loading-spinner` CSS | Identity platform auth loading |
| Auth loading card | auth-card + spinner | Session check on /select + /onboarding |

**Consistency:** The `Skeleton` component is used consistently across merchant-control-plane. Identity platform uses custom CSS spinners (separate system).

---

## Error States

### Page-Level Errors

Displayed as `Banner variant="critical"` with optional title and body text. Placed at the top of the main content area, above the data. When error + data coexist (e.g. stale refresh failed), banner shows but data remains visible.

### Component-Level Errors

- Form errors: `Banner variant="critical"` above the form
- Field errors: text below the input in critical color
- `InlineError` component: icon + text, `role="alert"`

### Network Errors

No global error boundary for network failures in reviewed pages. Each page handles its own fetch errors with try/catch, sets a local `error` state, and shows it via `Banner`. Toast via `notify()` for mutations.

### Permission Errors

Server components use `notFound()` (Next.js) for auth failures (seen in select-plan page.tsx). Client components check session from `/api/auth/session` and redirect to `/lookup` if unauthenticated.

---

## Empty States

### EmptyState Component

Centralized in `packages/typescript/ui/src/feedback.tsx`. Supports 14 domain kinds with auto-assigned icons and SVG illustrations.

**Structure:**
```
EmptyState
  ├── illustration (SVG EmptyStateIllustration OR custom <Image>)
  ├── title (required)
  ├── body (optional)
  └── actions: [secondaryAction, primaryAction]  // secondary rendered first in DOM
```

The actions are rendered in order `[secondary, primary]` inside a `flex flex-wrap justify-center gap-2`. On mobile both wrap to full width; on desktop they appear side-by-side.

### Context-Aware CTAs in Empty States

The codebase shows three distinct empty state CTA strategies:

**First-time empty (no data yet):**
- Primary: Create action (e.g. "Add product", "Create coupon")
- Secondary: Alternative entry point (e.g. "Browse sourcing apps")

**Search/filter empty (no results for query):**
- Primary: Create action
- Secondary: "Clear search" / "Clear view"

**Error empty (failed to load):**
- Primary: "Retry" with refresh icon
- Secondary: omitted or shows contextual link

**Animations:** `EmptyStateIllustration` has a subtle hover float: `motion-safe:hover:-translate-y-[4px]` on the illustration container.
