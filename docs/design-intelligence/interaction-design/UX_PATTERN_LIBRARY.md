# LetBuyy UX Pattern Library

Generated: 2026-06-19
Evidence base: packages/typescript/ui/src/* + merchant-control-plane app pages + identity-platform + marketing-site

Consistency scores:
- HIGH (90-100%): Pattern is uniform across all observed usages
- MEDIUM (60-89%): Pattern is mostly followed with minor deviations
- LOW (<60%): Pattern exists but is inconsistently applied or partially bypassed

---

## P-01: App Shell Navigation

**Pattern name:** Canonical Sidebar Shell

**When to use:**
Any authenticated app that requires persistent navigation (merchant-control-plane, platform-console). Not for auth/onboarding flows.

**Current implementation:**
`packages/typescript/ui/src/navigation/app-navigation.tsx` — `AppNavigation` component. Composes `AppFrame + Sidebar + Navigation` from a `sections[]` prop. Active state is computed from `usePathname()` automatically.

**Evidence:**
```tsx
// apps/merchant-control-plane layout.tsx (inferred from AppNavigation API)
<AppNavigation
  sections={[
    { title: 'Catalog', items: [{ id: 'products', label: 'Products', href: `/${store}/products`, icon: <...> }] }
  ]}
  brand={<StoreBrand />}
  footer={<UserMenu />}
  width="md"
>
  {children}
</AppNavigation>
```

**Consistency score: HIGH**
The governance audit doc referenced in the component (`NAVIGATION_GOVERNANCE_AUDIT.md`) acknowledged prior divergence (four widths, five active-state strategies). The canonical component consolidates this. All new merchant pages should use `AppNavigation`.

---

## P-02: Nested Nav Item Disclosure

**Pattern name:** Inline Collapsible Nav Group

**When to use:**
When a sidebar section has sub-pages (e.g. Products → Collections, Inventory).

**Current implementation:**
`app-shell.tsx` `NavItem` component. Parent item with `children[]` renders:
- Chevron icon right-aligned, rotates 90° when open
- `aria-expanded` on the parent button
- Child list: indented `pl-[calc(--lb-space-3 + icon-size + --lb-space-2)]`
- Auto-opens when any child is the current route

**Evidence (app-shell.tsx line 47-133):**
```tsx
const [open, setOpen] = useState(anyChildActive);
useEffect(() => { if (anyChildActive) setOpen(true); }, [anyChildActive]);
```

**Consistency score: HIGH**
No alternative nesting pattern exists. The `children` array on `NavigationItem` is the only supported way to add sub-navigation.

---

## P-03: Breadcrumb Navigation

**Pattern name:** Chevron Breadcrumb

**When to use:**
All merchant-control-plane pages with depth > 1. Always use inside `PageHeader`. Root crumb links to `/{store}/dashboard`.

**Current implementation:**
`packages/typescript/ui/src/breadcrumbs.tsx` `Breadcrumbs` component.
- Default separator: `ChevronRight` icon
- Last item: `currentTone="emphasis"` (text color, not subdued)
- `aria-current="page"` on last item
- Wrapped in `<nav aria-label="Breadcrumb">`

**Evidence (products/page.tsx line 354):**
```tsx
breadcrumbs={[{ label: 'Home', href: `/${store}/dashboard` }, { label: 'Products' }]}
```

**Consistency score: MEDIUM**
All reviewed pages use 2-level breadcrumbs. No page uses the `slash` separator or `currentTone="inherit"`. Coupons uses `[{ label: 'Marketing' }, { label: 'Coupons' }]` — the first crumb has no `href` (no link back to a marketing hub). This is an inconsistency: products breadcrumbs have a working `Home` link; coupons do not.

---

## P-04: Page Header + Primary Action

**Pattern name:** PageHeader with Top-Right CTA

**When to use:**
Every full-page view in the merchant app. Primary action goes top-right. Secondary actions beside it.

**Current implementation:**
`@letbuyy/ui` `PageHeader` component (not reviewed directly — used via imports). Accepts `eyebrow`, `title`, `description`, `breadcrumbs`, `primaryAction`, `secondaryActions`.

**Evidence (products/page.tsx line 350-357):**
```tsx
<PageHeader
  eyebrow="Catalog"
  title="Products"
  description="Manage products, inventory, publishing status..."
  breadcrumbs={[...]}
  primaryAction={{ label: 'Add product', href: `/${store}/products/new`, icon: <MaterialIcon name="add" /> }}
  secondaryActions={[{ label: 'Collections', href: `/${store}/products/collections` }]}
/>
```

**Consistency score: HIGH**
All reviewed list pages follow this pattern. Icon always precedes label in primary action. Eyebrow is used to indicate the domain/category.

---

## P-05: Data Table with Saved Views

**Pattern name:** Tabbed Table View

**When to use:**
Any entity list with meaningful status-based subsets (products, customers, orders).

**Current implementation:**
`packages/typescript/ui/src/table.tsx` `Table` component with `savedViews` + `activeView` + `onViewChange` props. Views render as `Button` pills above the table header, inside the table's toolbar area.

**Evidence (products/page.tsx line 396-400):**
```tsx
<Table
  savedViews={productViews}  // [{label:'All',value:'all'},{label:'Active',value:'active'},...]
  activeView={activeTab}
  onViewChange={(value) => setActiveTab(value as TabFilter)}
  ...
/>
```

**Consistency score: HIGH**
Products and customers both use this pattern. View filtering is client-side (products) and API-side (customers). Coupons does NOT use `Table` with `savedViews` — it uses a static `<Table>` (JSX children mode) without view tabs, which is an inconsistency.

---

## P-06: Client-Side Search

**Pattern name:** Debounced Client Filter

**When to use:**
List pages where data is fetched once at page load (limit 100). For larger datasets, server-side search should be used.

**Current implementation:**
`Input` with `leftIcon={<Search />}` above the table. `searchQuery` state filters a `useMemo`-computed `filteredProducts`. The search input is uncontrolled at the API layer — it does not re-fetch on change.

**Evidence (products/page.tsx line 372-379):**
```tsx
<Input
  label="Search products"
  placeholder="Search by name, vendor, type, or status"
  value={searchQuery}
  onChange={(event) => setSearchQuery(event.target.value)}
  leftIcon={<Search className="..." />}
/>
```

**Consistency score: MEDIUM**
Products and customers both use this pattern but with different field sets. Customers API accepts `?search=` but still filters client-side in the reviewed code. No debounce on the search input itself — filtering runs on every keystroke via `useMemo`.

---

## P-07: Column Sorting

**Pattern name:** Header-Click Sort Toggle

**When to use:**
Any table with numeric or string columns where ordering matters.

**Current implementation:**
Column-level `sortable: true` flag. Click the header ghost button to set sort key, click again to toggle direction. Mobile shows a sort chip bar above the card list.

**State pattern:**
```tsx
const [sortKey, setSortKey] = useState<ProductSortKey>('name')
const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

const handleSort = (key: string) => {
  if (key === sortKey) { setSortDirection(current => current === 'asc' ? 'desc' : 'asc'); return }
  setSortKey(key as ProductSortKey)
  setSortDirection(key === 'created_at' ? 'desc' : 'asc')  // date columns default to desc
}
```

**Evidence (products/page.tsx line 219-227, table.tsx line 84-89)**

**Consistency score: HIGH**
Both products and customers follow the same sort state pattern. Date/amount columns default to `desc`, text columns to `asc`.

---

## P-08: Filter Chips

**Pattern name:** Removable Active Filter Chips

**When to use:**
When a saved view or search is active, show it as a dismissible chip to communicate the current filter state and allow quick removal.

**Current implementation:**
`filterChips` prop on `Table`. Chips render as `Badge variant="info"` with `onClick={onRemove}`. Two chip sources: `activeTab !== 'all'` and `searchQuery.trim()`.

**Evidence (products/page.tsx line 214-217):**
```tsx
const activeFilters = [
  activeTab !== 'all' ? { label: `View: ${activeTab}`, onRemove: () => setActiveTab('all') } : null,
  searchQuery.trim() ? { label: `Search: ${searchQuery.trim()}`, onRemove: () => setSearchQuery('') } : null,
].filter(Boolean)
```

**Consistency score: HIGH**
Both products and customers use the same chip generation pattern. Chips display the current state (not just "Clear filter") so users understand what is active.

---

## P-09: Bulk Selection with Action Bar

**Pattern name:** Checkbox Select + Contextual Bulk Bar

**When to use:**
List pages where users may need to act on multiple items simultaneously.

**Current implementation:**
`Table` component with `bulkActions` prop. When selected items count > 0, a sub-header bar replaces the view tabs area: shows count + action buttons.

**Evidence (products/page.tsx line 229-238 + table.tsx line 202-218):**
```tsx
bulkActions={[
  { label: 'Publish selected', onAction: rows => updateSelectedProducts(rows, 'active') },
  { label: 'Set as draft', onAction: rows => updateSelectedProducts(rows, 'draft') },
]}
// Renders in table: "{n} selected" + action buttons when selectedRows.length > 0
```

**Consistency score: MEDIUM**
Products uses full bulk CRUD operations. Customers uses non-destructive clipboard action. No bulk delete pattern exists in reviewed pages. Coupons does not use bulk actions.

---

## P-10: Row-Level Status Control

**Pattern name:** Overlay Select on Badge

**When to use:**
When a status badge in a table row should also be an interactive control to change the status inline.

**Current implementation (products/page.tsx line 291-314):**
Visually a `Badge`, but has a 100%-opacity-0 `<select>` overlaid absolutely on top. The badge shows; the select receives the click.
```tsx
<div className="relative inline-flex items-center" onClick={stopTableAction}>
  <Badge label={status} variant={statusBadge[status]} className="pointer-events-none" />
  <select
    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
    value={status}
    onChange={(e) => updateProductStatus(product, e.target.value)}
  />
</div>
```

**Consistency score: LOW**
Only used in products. Coupons uses a separate toggle button in the actions column. No unified approach to inline status editing.

---

## P-11: Toast Notification

**Pattern name:** Positioned Toast via Context

**When to use:**
Transient feedback for mutations (create, update, delete, bulk action outcomes). Not for errors that need sustained attention.

**Current implementation:**
`ToastProvider` + `useToast()` hook (`packages/typescript/ui/src/feedback.tsx`). Default placement: `top-right`. Duration: 5000ms. Variants: `info`, `success`, `warning`, `critical`.

**Evidence (products/page.tsx line 146-151):**
```tsx
notify({
  title: 'Product status updated',
  description: `${product.name} is now ${status}.`,
  variant: 'success',
})
```

**Consistency score: HIGH**
All merchant pages use `useToast()` for mutation feedback. Pattern: title is the outcome ("Product status updated"), description provides the specific detail.

---

## P-12: Banner Error Display

**Pattern name:** Critical Banner for Load Errors

**When to use:**
When an API call fails to load page data. Inline with the page content, not in a toast.

**Current implementation:**
`Banner variant="critical"` component. Includes optional `action` slot for retry.

**Evidence (coupons/page.tsx line 347-354):**
```tsx
<Banner
  variant="critical"
  title="Coupons could not load"
  action={<Button variant="secondary" onClick={() => void loadCoupons()}>Retry</Button>}
>
  {loadError}
</Banner>
```

**Consistency score: MEDIUM**
Products shows banner for errors but without retry button. Customers shows banner for errors. Coupons includes retry. The retry pattern should be standard but is not universally applied.

---

## P-13: Confirm Dialog for Destructive Actions

**Pattern name:** ConfirmDialog with Positive-Phrased Cancel

**When to use:**
Any irreversible destructive action (delete, archive, revoke access). Must confirm with a dialog before executing.

**Current implementation:**
`ConfirmDialog` (`packages/typescript/ui/src/overlays.tsx`). Always uses `Modal` internally.
- `destructive={true}`: confirm button renders red (`variant="destructive"`)
- `cancelLabel`: phrased as a positive action ("Keep coupon", not "Cancel")
- `confirmLabel`: action-specific ("Delete coupon", not "Delete" or "Yes")

**Evidence (coupons/page.tsx line 586-597):**
```tsx
<ConfirmDialog
  open={Boolean(couponToDelete)}
  title="Delete coupon?"
  description={`Delete ${coupon.code}? This removes the discount...`}
  confirmLabel={deleting ? 'Deleting...' : 'Delete coupon'}
  cancelLabel="Keep coupon"
  destructive
  onConfirm={handleDelete}
  onClose={() => { if (!deleting) setCouponToDelete(null) }}
/>
```

**Consistency score: MEDIUM**
Only coupons page has a delete action in reviewed pages. Products and customers do not have delete in the list view. The pattern itself is solid when used; inconsistency is that the standard is not yet applied across all entities.

---

## P-14: Inline Form in Page (Expand/Collapse)

**Pattern name:** Inline Form Card

**When to use:**
Create/edit flows where navigating away is not desirable and the form is small enough to appear in-page.

**Current implementation:**
State flag `showForm` / `editingId` toggles a `Card > Section` form above the list. Cancel closes the form and resets state.

**Evidence (coupons/page.tsx line 398-490):**
```tsx
{showForm && (
  <Card>
    <Section title={editingId ? 'Edit coupon' : 'New coupon'}>
      {/* form fields */}
      <div className="flex flex-wrap gap-2">
        <Button loading={saving} onClick={handleSave}>
          {editingId ? 'Update coupon' : 'Create coupon'}
        </Button>
        <Button variant="secondary" onClick={closeForm}>Cancel</Button>
      </div>
    </Section>
  </Card>
)}
```

The `SaveBar` (sticky bottom) also tracks form state independently, providing a second save/discard mechanism.

**Consistency score: LOW**
Only coupons uses this pattern in reviewed pages. Products and customers navigate to a separate route for create/edit. No standard defined for when to use inline vs. route-based editing.

---

## P-15: SaveBar (Sticky Unsaved Indicator)

**Pattern name:** Floating Unsaved Changes Bar

**When to use:**
Forms with `saved / unsaved / saving` states where auto-save is not used. Especially inline forms that can be dismissed.

**Current implementation:**
`SaveBar` (`packages/typescript/ui/src/feedback.tsx`). Sticky bottom, `z-[var(--lb-z-sticky)]`. Fades to invisible when `state === 'saved'` (`opacity-0 pointer-events-none`). Shows unsaved indicator (AlertCircle) or saving indicator (Loader2 spinner).

**Evidence (coupons/page.tsx line 578-584):**
```tsx
<SaveBar
  state={formSaveState}
  onSave={() => void handleSave()}
  onDiscard={closeForm}
  saveLabel={editingId ? 'Update coupon' : 'Create coupon'}
  discardLabel="Discard"
/>
```

**Consistency score: LOW**
Only used in coupons. Not yet adopted for product/customer edit pages. Represents an advanced pattern that should be considered for any form with unsaved-state risk.

---

## P-16: Skeleton Loading

**Pattern name:** Skeleton Placeholder

**When to use:**
Replace content that is loading. Match the shape of what will appear.

**Current implementation:**
`Skeleton` component with 3 variants:
- `variant="table"`: rows of `h-[--lb-density-table-row-height]` rounded rects
- `variant="card"`: single `h-[--lb-size-skeleton-card-height]` rounded rect
- `variant="text"`: multiple lines, last line is `w-2/3` (shorter)

**Evidence (products/page.tsx line 359-364, customers/page.tsx line 387-389):**
```tsx
// products: wrap in Card > Section with descriptive text
<Section title="Catalog" description="Loading products and inventory state.">
  <Skeleton variant="table" lines={6} />
</Section>

// customers: direct in the section
{loading ? <Skeleton variant="table" lines={6} /> : <Table ... />}
```

**Consistency score: MEDIUM**
Products wraps skeleton in a full `Card > Section`; customers renders skeleton directly. Both use `lines={6}` which is arbitrary — should be based on expected row count.

---

## P-17: EmptyState with Context-Aware CTA

**Pattern name:** Context-Aware Empty State

**When to use:**
Any empty list. Content and actions must adapt to the reason for being empty.

**Current implementation:**
`EmptyState` component (`packages/typescript/ui/src/feedback.tsx`).

**Three distinct contexts (documented with evidence from products/page.tsx):**

| Context | Title | Primary | Secondary |
|---|---|---|---|
| Truly empty | "Add your first product" | "Add product" | "Browse sourcing apps" |
| Search/filter empty | "No matching products" | "Add product" | "Clear search" |
| Error | "Unable to load customers" | "Retry" | — |

**Custom illustration preference:** `<Image src="/Emptystate Illustration/Products.png">` overrides the built-in SVG illustration when the PNG asset exists.

**Consistency score: HIGH**
Products, customers, and coupons all follow the three-context pattern with appropriate CTAs. The illustration/icon distinction (custom PNG for "truly empty", icon for "filtered/error empty") is consistent.

---

## P-18: Multi-Step Wizard (Identity Platform)

**Pattern name:** Linear Step Wizard (In-Card)

**When to use:**
Sequential onboarding flows where each step's data is needed before the next.

**Current implementation:**
`step` state (1/2/3), rendered with conditional blocks `{step === n && (...)}`. No step indicator component — uses `TOTAL_STEPS = 3` constant but does not render a progress bar.

Steps:
1. Choose site type (bento card grid, click = advance)
2. Name + subdomain (Input fields, Back + Next buttons, Next disabled until valid)
3. Review + create (read-only summary + industry select, Back + Create button)

**Evidence (onboarding/page.tsx line 221-563):**
```tsx
const [step, setStep] = useState(1)
{step === 1 && <StepOneContent />}
{step === 2 && <StepTwoContent />}
{step === 3 && <StepThreeContent />}
```

Step advance on step 1: immediate on card click (no Next button)
Step advance on step 2: button with validation gate

**Consistency score: LOW (single usage)**
No other multi-step wizard in the reviewed codebase. `TOTAL_STEPS` constant suggests a step indicator was planned but not implemented.

---

## P-19: Real-Time Async Validation

**Pattern name:** Debounced Availability Check

**When to use:**
Unique-value inputs (subdomain, slug, handle) that require a server check.

**Current implementation:**
Custom `debounce` utility (onboarding/page.tsx line 603-609), 400ms delay. Three visual states:
- `checking` → spinner + "Checking availability…"
- `valid` → `check_circle` icon + success message
- `invalid` → `cancel` icon + error reason (differentiated: `reserved` vs general invalid)

CTA gating: Next/Submit button has `disabled={!validation?.valid}`.

**Evidence (onboarding/page.tsx line 276-300):**
```tsx
const validateSubdomain = useCallback(
  debounce(async (value: string) => {
    const res = await fetch(`/api/auth/validate-subdomain?subdomain=${value}`)
    setValidation(await res.json())
  }, 400),
  []
)
```

**Consistency score: LOW (single usage)**
Only the subdomain field uses this pattern. No reusable `useAsyncValidation` hook exists — pattern is inlined.

---

## P-20: Accordion (Marketing Site / FAQ)

**Pattern name:** Single-Open Accordion

**When to use:**
FAQs, feature lists, collapse-heavy content where one item open at a time is preferred.

**Current implementation:**
`apps/marketing-site/src/components/FAQ.tsx`. Custom implementation using Framer Motion `AnimatePresence` for height animation. State: `useState<number | null>(0)` — one open item (first open by default).

```tsx
const [open, setOpen] = useState<number | null>(0)
// toggle: setOpen(isOpen ? null : i)
```

Accessibility: `aria-expanded`, `aria-controls`, `role="region"`, `aria-labelledby` on answer panels.
Animation: `height: 0 → auto` transition, `opacity: 0 → 1`, duration 220ms, `ease: [0.4, 0, 0.2, 1]`. Respects `useReducedMotion`.

**Consistency score: HIGH (within marketing site)**
Marketing site's FAQ is the only accordion reviewed. The `details/summary` HTML element is also used in the plan comparison table (`select-plan/SelectPlanClient.tsx` line 296) as a simpler alternative for in-table disclosures.

---

## P-21: Plan/Pricing Card Grid

**Pattern name:** Feature Card Grid with Toggle

**When to use:**
Pricing or plan selection pages where users compare tiers.

**Current implementation:**
`apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx`

- Billing toggle (Monthly/Annual): `role="group"` pill buttons with `aria-pressed`
- Plan cards: CSS-grid layout (`.select-plan-grid`), 1 card highlighted as popular
- CTA per card: context-driven label (Current plan / Coming soon / Contact sales / Start free trial)
- Comparison table: expand/collapse (`showCompare` state) with gradient fade overlay when collapsed; `role="table"` accessible markup
- "Show differences only" toggle: checkbox switch that filters comparison rows

**Evidence (SelectPlanClient.tsx line 116-131):**
```tsx
<div className="select-plan-toggle" role="group" aria-label="Billing period">
  {['monthly', 'yearly'].map(period => (
    <Button unstyled className={cx('select-plan-toggle-button', active && 'is-active')}
      aria-pressed={billingPeriod === period}
    />
  ))}
</div>
```

**Consistency score: HIGH (single page)**
Sophisticated pattern with good a11y. Uses custom CSS (`.select-plan-*`) rather than the design system's token-based utilities — outside the `--lb-*` token system, which is a governance deviation.

---

## P-22: Status Badge

**Pattern name:** Semantic Status Badge

**When to use:**
Any status field in a table, card, or detail page.

**Current implementation:**
`Badge` component + `statusToBadgeVariant()` utility (`packages/typescript/ui/src/feedback.tsx`).

Variant mapping (automatic from status string):
- `success`: active, paid, complete, live, verified, published, enabled, connected
- `critical`: fail, error, reject, cancel, suspended, expired, disabled, ban, fraud
- `warning`: pending, draft, processing, paused, retry, hold
- `info`: new, scheduled, in-progress

`StatusBadge` wraps this for auto-derivation.

**Evidence (customers/page.tsx line 129-134, feedback.tsx line 94-102):**
```tsx
function customerStatusVariant(status: string) {
  if (['active', 'enabled'].includes(normalized)) return 'success'
  if (['blocked', 'disabled', 'suspended'].includes(normalized)) return 'critical'
  return 'info'
}
// Products uses explicit map:
const productStatusBadge = { active: 'success', draft: 'warning', archived: 'critical' }
```

**Consistency score: MEDIUM**
Customers derives variant inline with a local function. Products uses an explicit map. Neither uses `StatusBadge` or `statusToBadgeVariant()` — the canonical utility exists but is not yet adopted by these pages. Direct Badge with hardcoded variant is used instead.

---

## P-23: Overlay Theme Mirroring

**Pattern name:** Portal Theme Propagation

**When to use:**
All overlays that portal to `<body>` (Modal, Drawer, Dropdown, Popover). Handles light/dark OS vs app theme mismatch.

**Current implementation:**
`OverlayPortal` (`packages/typescript/ui/src/overlays.tsx`). On mount, reads `data-letbuyy-theme`, `data-letbuyy-surface`, `data-letbuyy-density`, `data-theme` from the app root and mirrors them onto the portal container. Uses `MutationObserver` to stay in sync when theme toggles.

**Evidence (overlays.tsx line 21-34):**
```tsx
function mirrorOverlayTheme(target: HTMLElement): void {
  const source = document.querySelector('[data-letbuyy-surface]') as HTMLElement | null
  const root = document.documentElement
  for (const attr of OVERLAY_THEME_ATTRS) {
    const value = source?.getAttribute(attr) ?? root.getAttribute(attr)
    if (value) target.setAttribute(attr, value)
  }
}
```

**Consistency score: HIGH**
All four overlay types (Modal, Drawer, Popover, Dropdown) use `OverlayPortal`. The mirroring is automatic — no per-usage configuration needed.

---

## P-24: Tabs (Section-Level Navigation)

**Pattern name:** Underline or Pill Tabs

**When to use:**
When a page section has multiple distinct views that should stay on the same page.

**Current implementation:**
`Tabs` component (`packages/typescript/ui/src/controls.tsx`). Two variants:
- `underline` (default): border-bottom indicator on active tab, no border on tabs
- `pills`: bordered rounded tabs, active gets `bg-[--lb-color-primary-soft]`

Keyboard: Arrow keys navigate between tabs (roving tabindex). Arrow + select together (not separate like some implementations).

**Evidence (controls.tsx line 93-100):**
```tsx
if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
  event.preventDefault()
  moveFocus(nextEnabledTabIndex(items, index, 1))
}
```

**Consistency score: MEDIUM (component observed but not used in reviewed pages)**
The `Table` component's saved views use a custom pill-style button row (not `Tabs`). The `Tabs` component is in the design system but no reviewed merchant page uses it directly. There is a potential inconsistency between the Table's view-tab pattern and the Tabs component.

---

## Cross-Pattern Consistency Issues

| Issue | Impact | Affected Patterns |
|---|---|---|
| `StatusBadge` / `statusToBadgeVariant()` not used by app pages | Low — cosmetic only | P-22 |
| Coupons uses static `<Table>` (JSX mode) while Products/Customers use data-driven `Table` | Medium — no saved views, no mobile cards | P-05 |
| Breadcrumb first item has no `href` on coupons | Low — navigation gap | P-03 |
| Inline form pattern (coupons) vs. route-based form pattern (products/customers) | Medium — inconsistent UX for create/edit | P-14 |
| `SaveBar` only on coupons | Medium — missing unsaved state indicator on other forms | P-15 |
| `statusToBadgeVariant` utility unused | Low — pattern exists, not adopted | P-22 |
| Plan page uses custom CSS (`select-plan-*`) outside design token system | High — governance deviation | P-21 |
| No global `useAsyncValidation` hook (debounce logic inlined) | Low — DRY concern | P-19 |
| No step indicator in onboarding wizard | Low — UX gap in 3-step flow | P-18 |
