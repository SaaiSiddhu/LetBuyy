# LetBuyy Component Duplication Report

Generated: 2026-06-19  
Scope: All active runtimes — `merchant-control-plane`, `identity-platform`, `platform-console`, `marketing-site`, `storefront-runtime`, and `packages/typescript/ui/src/`.

---

## Executive Summary

| Category | Count |
|---|---|
| Confirmed duplications (component exists in @letbuyy/ui AND app re-implements) | 7 |
| DS primitive underutilization (DS component available, not used) | 6 |
| Raw Tailwind arbitrary-value violations (design-system ratchet) | 5 sites |
| Promotion candidates (app-layer components ready for @letbuyy/ui) | 4 |
| Token-compliant inline patterns (using `var(--lb-*)` but without DS component) | 3 |

The most severe category is **DS primitive underutilization** because it means divergent visual behavior that will require manual alignment on any redesign. The raw Tailwind `rounded-[...]`/`py-[Npx]` violations are a governance ratchet breach.

---

## 1. Confirmed Duplications

### D-01 — CommandPalette
**Severity: HIGH**

| | @letbuyy/ui | merchant-control-plane |
|---|---|---|
| File | `packages/typescript/ui/src/productivity.tsx` | `apps/merchant-control-plane/src/components/CommandPalette.tsx` |
| Implementation | Full-featured command palette, keyboard nav, action list with shortcuts | Same UX plus live entity search (products/orders/customers via API), search category chip filter, section grouping |

The local component was extended rather than composing the DS component. The DS `CommandPalette` does not support async entity search. The local implementation uses `Input(unstyled)`, `Button(unstyled)`, `MaterialIcon` from @letbuyy/ui for its own primitives but does not import or compose the DS `CommandPalette`.

**Recommended resolution:** Add an `onSearch` async callback + `categories` prop to the DS `CommandPalette`, then migrate the local component to extend the DS version. The extended functionality (live search, category chips) is a superset — the DS component should grow to contain it.

---

### D-02 — Accordion / FAQ accordion
**Severity: MEDIUM**

| | @letbuyy/ui | marketing-site |
|---|---|---|
| File | `packages/typescript/ui/src/primitives.tsx` (`Accordion`) | `apps/marketing-site/src/components/FAQ.tsx` |
| Implementation | Reusable Accordion + Disclosure with token-based styles | framer-motion animated accordion with `faq-item*` CSS classes and `AnimatePresence` |

The marketing FAQ renders the same expand/collapse interaction as `Accordion` but with framer-motion height animation. The DS `Disclosure`/`Accordion` uses CSS transitions only. The two diverge on animation strategy.

**Recommended resolution:** Accept the marketing site divergence for now — marketing content benefits from framer-motion. Add a note that if the marketing site is migrated to the DS `Accordion`, the height animation must be preserved via a `motion` prop on `Disclosure`.

---

### D-03 — Skeleton (loading state)
**Severity: MEDIUM**

| | @letbuyy/ui | marketing-site |
|---|---|---|
| File | `packages/typescript/ui/src/feedback.tsx` | `apps/marketing-site/src/components/Pricing.tsx` (`PlanCardSkeleton`) |
| Implementation | Parametric `Skeleton` with `text`, `card`, `table` variants | Bespoke `PlanCardSkeleton` with explicit skeleton line divs |

The Pricing component's `PlanCardSkeleton` matches the visual pattern of `Skeleton variant="card"` with additional internal structure (name line, audience line, price line, feature lines, CTA line). It does not import `Skeleton` from @letbuyy/ui.

**Recommended resolution:** Add a `'plan-card'` variant to `Skeleton`, or use `Skeleton` with `lines` to approximate the structure. Low priority since marketing-site is a separate deployment context.

---

### D-04 — MetricCard (dashboard metrics)
**Severity: MEDIUM**

| | @letbuyy/ui | marketing-site/Features.tsx |
|---|---|---|
| File | `packages/typescript/ui/src/productivity.tsx` | `apps/marketing-site/src/components/Features.tsx` (inline `MetItem` component) |
| Implementation | DS `MetricCard` with label, value, delta, sparkline | `MetItem` function with custom `useCountUp` animation, `cop-met-val/lbl` CSS classes |

The Features.tsx `MetItem` fills the same semantic role as `MetricCard` but adds a count-up animation and uses hardcoded data. Acceptable divergence for marketing interactive demo content.

**Recommended resolution:** No action needed — the marketing features demo is intentionally a richly animated, marketing-specific display with mock data. The DS MetricCard is for real data display in merchant UI.

---

### D-05 — Badge (inline unread count)
**Severity: MEDIUM**

| | @letbuyy/ui | merchant-control-plane |
|---|---|---|
| File | `packages/typescript/ui/src/feedback.tsx` | `apps/merchant-control-plane/src/components/NotificationsPanel.tsx` line 56 |
| DS component | `Badge variant="critical"` or `StatusBadge` | Inline `<span>` with 14 Tailwind arbitrary-value token expressions |

The notification unread count badge is implemented as:
```
className="ml-[var(--lb-space-2)] inline-flex min-w-[var(--lb-size-icon-inline)] items-center justify-center rounded-[var(--lb-radius-full)] bg-[var(--lb-color-primary)] px-[var(--lb-space-2)] py-[1px] ..."
```
Token-compliant in that it uses `--lb-*` variables, but bypasses the `Badge` component entirely. `py-[1px]` is a raw pixel value (ratchet violation).

**Recommended resolution:** Replace with `<Badge variant="default">` or a new `Badge` `count` variant specifically designed for notification counts (pill shape, primary background).

---

### D-06 — ProviderModeBadge vs Badge
**Severity: LOW**

| | @letbuyy/ui | merchant-control-plane |
|---|---|---|
| File | `packages/typescript/ui/src/feedback.tsx` | `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx` |
| DS component | `Badge` | Custom `<span>` with `py-[2px]` raw px violation |

`ProviderModeBadge` renders a test/live indicator. Uses raw Tailwind `py-[2px]` — a ratchet violation. The intent maps cleanly to a `Badge` with a custom variant or `tone` prop.

**Recommended resolution:** Replace with `<Badge>` once a `live`/`test` tone variant is added. Short-term fix: change `py-[2px]` to `py-[var(--lb-space-half)]` if that token exists, or migrate to the DS Badge.

---

### D-07 — AuthIcon vs MaterialIcon
**Severity: LOW (by design)**

| | @letbuyy/ui | identity-platform |
|---|---|---|
| File | `packages/typescript/ui/src/icons.tsx` | `apps/identity-platform/src/components/AuthIcon.tsx` |

`AuthIcon` is a thin wrapper over `MaterialIcon` that (a) narrows the allowed icon names to an `AuthIconName` union (type safety for identity flows), and (b) adds correct `role="img"` + `aria-label` when a `title` prop is passed.

**Verdict:** This is intentional, not a duplication. `AuthIcon` provides type-level constraints the generic `MaterialIcon` cannot express. However, the `aria-label`/`role` accessibility pattern should be added to `MaterialIcon` itself so it is not silently missing in other contexts.

---

## 2. DS Primitive Underutilization

These are cases where a DS component exists and is the correct choice, but app code bypasses it.

### U-01 — AISidebar uses raw `<progress>` instead of `ProgressBar`
**File:** `apps/merchant-control-plane/src/components/AISidebar.tsx`  
**Available DS component:** `ProgressBar` from `packages/typescript/ui/src/primitives.tsx`  
**Impact:** Visual divergence from DS ProgressBar styles; no token compliance on the progress element. Screen-reader behavior depends on native `<progress>` semantics.  
**Fix:** Replace raw `<progress>` with `<ProgressBar value={...} max={...} />`.

---

### U-02 — HeaderBar uses custom initials instead of `Avatar`
**File:** `apps/merchant-control-plane/src/components/HeaderBar.tsx`  
**Available DS component:** `Avatar` from `packages/typescript/ui/src/productivity.tsx`  
**Impact:** The store-switcher pill and user avatar use custom `getStoreInitials` / `userInitial` string expressions rendered in `<span>` elements with `store-switcher-item-icon` and `store-switcher-user-avatar` CSS classes. These are visually similar to `Avatar` but are not consistent with DS avatar sizing or token usage.  
**Fix:** Replace `<span className="store-switcher-item-icon">` with `<Avatar name={s.name} size="sm" />` and `<span className="store-switcher-user-avatar">` with `<Avatar name={userDisplayName} size="sm" />`.

---

### U-03 — SettingsSearch uses raw `<input>` instead of `Input`
**File:** `apps/merchant-control-plane/src/components/settings/SettingsSearch.tsx` line 34  
**Available DS component:** `Input` from `packages/typescript/ui/src/input.tsx`  
**Impact:** The raw input with its 200+ char Tailwind class string duplicates what `Input` provides. Notably uses `h-[var(--lb-size-control-md)]` and `rounded-[var(--lb-radius-lg)]` — the `rounded-[...]` form is a ratchet violation even when using a token variable (the ratchet forbids arbitrary-value bracket syntax regardless of value source).  
**Fix:** Replace raw `<input className="...">` with `<Input leftIcon={<MaterialIcon name="search" />} placeholder="Search settings..." unstyled={false} />`.

---

### U-04 — EmbeddedAppBridgeClient uses raw tab buttons instead of `Tabs`
**File:** `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx` line 239  
**Available DS component:** `Tabs` from `packages/typescript/ui/src/controls.tsx`  
**Impact:** Tab buttons use inline Tailwind token-expression strings: `inline-flex h-[var(--lb-size-control-md)] ... rounded-[var(--lb-radius-lg)]`. `rounded-[...]` is a ratchet violation.  
**Fix:** Replace with `<Tabs variant="pills" tabs={[...]} value={selected} onChange={setSelected} />`.

---

### U-05 — SelectPlanClient uses custom `formatINR` instead of `formatInrCurrency`
**File:** `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx` lines 32-38  
**Available utility:** `formatInrCurrency` exported from @letbuyy/ui  
**Impact:** `formatINR` and `formatINRFull` are local re-implementations. `formatINR` adds a `₹Xk` shorthand for values ≥ ₹1000; `formatINRFull` is identical to `formatInrCurrency`. Two divergent formatting behaviors will cause display inconsistencies as plans reach thousands of rupees.  
**Fix:** Import `formatInrCurrency` from @letbuyy/ui for `formatINRFull`. For `formatINR`'s abbreviated `₹Xk` form, add a `{ compact: true }` option to `formatInrCurrency` or create a new utility `formatInrCompact` in @letbuyy/ui.

---

### U-06 — marketing-site Pricing uses custom `PlanCardSkeleton` instead of `Skeleton`
**File:** `apps/marketing-site/src/components/Pricing.tsx`  
**Available DS component:** `Skeleton`  
**Impact:** Bespoke skeleton markup; any changes to the Skeleton design-system component will not apply here.  
**Fix:** Low priority. Replace with `Skeleton variant="card"` or parameterize `Skeleton` to accept line counts.

---

## 3. Raw Tailwind Design-System Ratchet Violations

The ratchet rule: **no `rounded-[...]` with arbitrary values, and no raw-px Tailwind values** in app component files. Using `rounded-[var(--lb-radius-lg)]` is also a violation — the bracket syntax must not appear even when the value is a token variable.

### R-01 — NotificationsPanel unread badge
**File:** `apps/merchant-control-plane/src/components/NotificationsPanel.tsx` line 56  
**Violations:** `rounded-[var(--lb-radius-full)]`, `py-[1px]` (raw px)

### R-02 — SettingsSearch input
**File:** `apps/merchant-control-plane/src/components/settings/SettingsSearch.tsx` line 34  
**Violations:** `rounded-[var(--lb-radius-lg)]`

### R-03 — BackendNeededPane
**File:** `apps/merchant-control-plane/src/components/settings/BackendNeededPane.tsx` line 49  
**Violations:** `rounded-[var(--lb-radius-lg)]`

### R-04 — EmbeddedAppBridgeClient tab buttons
**File:** `apps/merchant-control-plane/src/components/apps/EmbeddedAppBridgeClient.tsx` line 239  
**Violations:** `rounded-[var(--lb-radius-lg)]`

### R-05 — ProviderModeBadge
**File:** `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx` line 19  
**Violations:** `py-[2px]` (raw px)

### R-06 — AdminShell sidebar className
**File:** `apps/merchant-control-plane/src/components/AdminShell.tsx` line 128-130  
**Violations:** `rounded-tl-[var(--sidebar-panel-radius)]` (arbitrary-value bracket syntax with a non-lb-* token)  
**Note:** Also uses a non-standard `--sidebar-panel-radius` token name rather than the canonical `--lb-radius-*` scale.

---

## 4. Candidates for Promotion to @letbuyy/ui

These app-layer components have no DS equivalent and exhibit sufficient generality to belong in the shared library.

### P-01 — StoreSwitcherDropdown pattern
**Current location:** `apps/merchant-control-plane/src/components/HeaderBar.tsx`  
**Rationale:** The store-switcher pill + dropdown + mobile bottom-sheet is an application-shell navigation primitive. If platform-console or a future B2B admin surface also needs account/context switching, this will be duplicated. The pattern (pill trigger → desktop dropdown / mobile bottom-sheet) is reusable.  
**Suggested DS component:** `AccountSwitcher` or `ContextSwitcher` with `items`, `current`, `onSelect`, and optional `footer` slot.

### P-02 — MobileBottomSheet pattern
**Current location:** `apps/merchant-control-plane/src/components/HeaderBar.tsx`  
**Rationale:** The mobile bottom-sheet (backdrop overlay + slide-up panel + drag handle) appears in HeaderBar for both store-switcher and notifications. Storefront-runtime also has a bottom-sheet-like component in `account/account-bottom-sheet.tsx`. This is a distinct overlay pattern from `Drawer` (which is general-purpose) — it is specifically optimized for mobile-first "action sheet" patterns.  
**Suggested DS component:** `BottomSheet` with `open`, `onClose`, `children`, separate from `Drawer`.

### P-03 — ProviderModeBadge
**Current location:** `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx`  
**Rationale:** A `test`/`live` environment mode badge is needed in any payment-gateway-connected app. It is domain-agnostic enough to belong in @letbuyy/ui as a `Badge` variant or a dedicated `EnvironmentBadge` component.  
**Suggested DS component:** Add `'live'` and `'test'` variants to `Badge`, or promote `ProviderModeBadge` as `EnvironmentBadge`.

### P-04 — AuthIcon (accessibility wrapper for MaterialIcon)
**Current location:** `apps/identity-platform/src/components/AuthIcon.tsx`  
**Rationale:** The `role="img"` + `aria-label` pattern when a `title` prop is provided should live in `MaterialIcon` itself. `AuthIcon` exists only because `MaterialIcon` does not support accessible titles.  
**Suggested change:** Add `title?: string` to `MaterialIcon` props; when present, set `aria-hidden={false}`, `role="img"`, `aria-label={title}`.

---

## 5. Inline Token Patterns (Compliant but Below DS Abstraction Level)

These are cases where token variables are used correctly inside Tailwind arbitrary-value classes without ratchet-violating bracket syntax (i.e., the token is the full value not just a fallback). They comply with the spirit of the design system but bypass the DS component abstraction layer. They are noted for awareness, not requiring immediate action.

### T-01 — SettingsIndex navigation items
**File:** `apps/merchant-control-plane/src/components/settings/SettingsIndex.tsx` line 79  
```
'group flex items-start gap-[var(--lb-space-3)] rounded-[var(--lb-radius-lg)] px-[var(--lb-space-3)] py-[var(--lb-space-3)] ...'
```
Navigation item row uses token-expression Tailwind classes. Functionally equivalent to a Navigation item from @letbuyy/ui but in a grid-of-cards layout that the DS Navigation component does not support. This is a valid extension, not a violation per se, except for `rounded-[...]` bracket syntax (covered in R-section above).

### T-02 — AdminShell sidebar sidebarClassName
**File:** `apps/merchant-control-plane/src/components/AdminShell.tsx` lines 128-130  
Long responsive `sidebarClassName` string passed as a prop to `AppNavigation`. Uses `var(--admin-header-height)` (non-lb token) and `rounded-tl-[var(--sidebar-panel-radius)]` (non-lb token in bracket syntax). The `AppNavigation` `sidebarClassName` API is the correct escape hatch but the token names used must still be on the `--lb-*` scale.

### T-03 — Breadcrumb in SelectPlanClient
**File:** `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx` lines 88-93  
Custom `div.select-plan-breadcrumb` with `MaterialIcon` chevrons instead of the DS `Breadcrumbs` component. The DS `Breadcrumbs` component (`packages/typescript/ui/src/breadcrumbs.tsx`) was built for exactly this use case.  
**Fix:** Replace with `<Breadcrumbs items={[{ label: storeName }, { label: 'Select a plan' }]} separator="chevron" />`.

---

## 6. Cross-App Pattern Consistency Summary

| Pattern | @letbuyy/ui has it | merchant-control-plane | identity-platform | platform-console | marketing-site | storefront-runtime |
|---|---|---|---|---|---|---|
| Button (DS) | Yes | Yes (unstyled escape hatch heavily used) | Yes | Yes | Yes | Yes |
| Input (DS) | Yes | Partial (SettingsSearch bypasses) | Yes | Yes | No (uses raw html) | Yes |
| Badge/StatusBadge | Yes | Partial (inline badge in NotificationsPanel, ProviderModeBadge) | Yes | Yes | No | No |
| EmptyState | Yes | Yes | No | Yes | No | Yes |
| Skeleton | Yes | No (NotificationsPanel imports it but AISidebar doesn't use) | No | No | No (custom PlanCardSkeleton) | Yes |
| Avatar | Yes | No (custom initials) | No | No | No | No |
| ProgressBar | Yes | No (raw `<progress>`) | Yes | No | No | No |
| CommandPalette | Yes | Duplicate (local extension) | No | No | No | No |
| Accordion/Disclosure | Yes | No | No | No | No (framer-motion version) | No |
| Breadcrumbs | Yes | No (SelectPlanClient uses custom div) | No | No | No | No |
| Tabs | Yes | No (EmbeddedAppBridgeClient uses raw buttons) | No | No | No | No |
| Toast | Yes (ToastProvider) | Yes | No | No | No | No |
| Table | Yes | Yes | No | Yes | No | No |
| MaterialIcon | Yes | Yes | Yes (via AuthIcon) | Yes | Yes | Yes |

---

## 7. Recommended Prioritized Actions

### Priority 1 — Ratchet violations (governance fix)
1. `NotificationsPanel.tsx`: replace inline badge span with `<Badge>` (removes `rounded-[...]` + `py-[1px]`).
2. `SettingsSearch.tsx`: replace raw `<input>` with `<Input>` (removes `rounded-[...]`).
3. `BackendNeededPane.tsx`: replace raw wrapper with `<Card>` or `<Box radius="lg">`.
4. `EmbeddedAppBridgeClient.tsx`: replace raw tab buttons with `<Tabs variant="pills">`.
5. `ProviderModeBadge.tsx`: replace `py-[2px]` with token-scaled padding.
6. `AdminShell.tsx`: change `rounded-tl-[var(--sidebar-panel-radius)]` to `rounded-tl-[var(--lb-radius-lg)]` (or appropriate lb token).

### Priority 2 — Underutilization fixes (visual consistency)
1. `AISidebar.tsx`: `<ProgressBar>` instead of `<progress>`.
2. `HeaderBar.tsx`: `<Avatar>` instead of custom initials.
3. `SelectPlanClient.tsx`: import and use `formatInrCurrency`; add `<Breadcrumbs>` instead of custom breadcrumb div.

### Priority 3 — DS component extensions (@letbuyy/ui changes required)
1. Add `title` prop to `MaterialIcon` for accessible labeling (enables retiring `AuthIcon`).
2. Add async entity search + `categories` prop to DS `CommandPalette` (enables retiring local duplicate).
3. Add notification count variant to `Badge` (enables proper badge in NotificationsPanel).
4. Add `BottomSheet` component (consolidates mobile overlay pattern across MCP and storefront).

### Priority 4 — Promotion from app to DS
1. `EnvironmentBadge` (from `ProviderModeBadge`) — once `Badge` gains live/test variants.
2. `AccountSwitcher` or `ContextSwitcher` — generalize from HeaderBar store-switcher.

---

*This report reflects a static read of source files as of 2026-06-19. Run `node scripts/validate-governance.mjs` for the authoritative 107-validator gate result.*
