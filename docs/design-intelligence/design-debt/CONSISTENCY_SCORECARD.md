# Design Consistency Scorecard
**Generated:** 2026-06-19  
**Methodology:** Static analysis of 24 files across 3 apps. Each dimension scored 0–10. Scores reflect internal consistency and compliance with the `--lb-*` design token system defined in `packages/typescript/ui/src/tokens.ts`.

---

## Scoring Dimensions

| Dimension | Description |
|---|---|
| **Token Adoption** | Percentage of color, spacing, radius, and typography expressed via `--lb-*` CSS custom properties or mapped Tailwind utilities rather than hardcoded values |
| **Component Usage** | Use of `@letbuyy/ui` structural and interactive components (Page, PageHeader, Card, Section, Table, Button, Input, Badge, etc.) vs raw HTML equivalents |
| **Locale Standards** | Correct India-first locale: `₹` currency symbol, `formatInrCurrency()`, `en-IN` date formatting |
| **Layout Consistency** | Mobile-first structure, consistent spacing scale, absence of hardcoded px/rem values that bypass the token system |
| **Typography Compliance** | Font sizes, weights, and line heights mapped to canonical `--lb-font-*` tokens; no values outside the defined scale |

---

## Scorecard Table

| App / Surface | Token Adoption | Component Usage | Locale Standards | Layout Consistency | Typography Compliance | **Total / 50** |
|---|---|---|---|---|---|---|
| **merchant-control-plane** | | | | | | |
| dashboard/DashboardClient.tsx | 7 | 9 | 10 | 7 | 5 | **38** |
| products/page.tsx | 9 | 9 | 10 | 8 | 9 | **45** |
| customers/page.tsx | 10 | 10 | 10 | 10 | 10 | **50** |
| coupons/page.tsx | 7 | 5 | 3 | 8 | 8 | **31** |
| reviews/page.tsx | 9 | 9 | 10 | 9 | 9 | **46** |
| settings/billing/page.tsx | 4 | 6 | 10 | 4 | 6 | **30** |
| products/collections/page.tsx | 8 | 9 | 10 | 8 | 9 | **44** |
| products/inventory/page.tsx | 9 | 9 | 10 | 8 | 9 | **45** |
| products/purchase-orders/page.tsx | 10 | 10 | 10 | 10 | 10 | **50** |
| themes/.../editor/page.tsx | 2 | 2 | 10 | 3 | 4 | **21** |
| **merchant-control-plane AVG** | **7.5** | **7.8** | **9.3** | **7.5** | **7.9** | **40.0** |
| | | | | | | |
| **identity-platform** | | | | | | |
| globals.css | 4 | N/A | 9 | 3 | 5 | **21 / 40** |
| onboarding/page.tsx | 5 | 7 | 10 | 5 | 8 | **35** |
| lib/config/urls.ts | N/A | N/A | N/A | N/A | N/A | **N/A** |
| **identity-platform AVG** | **4.5** | **7.0** | **9.5** | **4.0** | **6.5** | **28.0** |
| | | | | | | |
| **marketing-site** | | | | | | |
| globals.css | 4 | N/A | 10 | 3 | 7 | **24 / 40** |
| page.tsx | 10 | N/A | 10 | 10 | 10 | **50** |
| Hero.tsx | 8 | 9 | 10 | 8 | 9 | **44** |
| Header.tsx | 7 | 9 | 10 | 7 | 9 | **42** |
| Features.tsx | 5 | 8 | 10 | 6 | 8 | **37** |
| Pricing.tsx | 8 | 9 | 10 | 8 | 9 | **44** |
| Footer.tsx | 9 | 10 | 10 | 9 | 10 | **48** |
| **marketing-site AVG** | **7.3** | **9.0** | **10.0** | **7.3** | **8.9** | **41.3** |

---

## App-Level Summary

| App | Token Adoption | Component Usage | Locale Standards | Layout Consistency | Typography | **Avg Score /10** |
|---|---|---|---|---|---|---|
| merchant-control-plane | 7.5 | 7.8 | 9.3 | 7.5 | 7.9 | **8.0** |
| identity-platform | 4.5 | 7.0 | 9.5 | 4.0 | 6.5 | **6.3** |
| marketing-site | 7.3 | 9.0 | 10.0 | 7.3 | 8.9 | **8.5** |
| **Platform average** | **6.8** | **7.9** | **9.6** | **6.6** | **7.8** | **7.6** |

---

## Top 10 Design Debt Items (Priority Order)

### D-01 — CRITICAL: Theme editor imports icons directly from `lucide-react`
**File:** `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`  
**Severity:** CRITICAL  
**Detail:** 27 Lucide icons imported directly from the `lucide-react` package, bypassing `@letbuyy/ui`'s version-pinned re-exports. Creates a dual icon dependency that can diverge on version bumps. Icons should import from `@letbuyy/ui`.  
**Fix:** Replace all `import { ... } from 'lucide-react'` with `import { ... } from '@letbuyy/ui'` in the editor file.

---

### D-02 — HIGH: Coupons page uses `Rs.` currency prefix instead of `₹`
**File:** `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`  
**Severity:** HIGH  
**Detail:** `formatDiscount()` function returns `` `Rs. ${coupon.value}` `` for absolute discounts. This violates the India-first locale standard. All monetary values must use the `₹` symbol or `formatInrCurrency()`.  
**Fix:** Replace `` `Rs. ${coupon.value}` `` with `` `₹${coupon.value}` `` and consider using `formatInrCurrency(coupon.value)` for correct decimal handling.

---

### D-03 — HIGH: Coupons page uses raw HTML `<table>` elements instead of `<Table rows columns>` API
**File:** `apps/merchant-control-plane/src/app/[store]/coupons/page.tsx`  
**Severity:** HIGH  
**Detail:** The coupon list renders raw `<table>/<thead>/<tbody>/<tr>/<th>/<td>` HTML wrapped in `<Table tableClassName="...">` children mode. Every other data page (`products`, `customers`, `reviews`, `billing`) uses the declarative `<Table rows={} columns={}>` API with proper `TableColumn` types.  
**Fix:** Migrate to `<Table rows={filteredCoupons} columns={couponColumns} />` with a typed `TableColumn<CouponRow>[]` definition.

---

### D-04 — HIGH: Billing page uses private `billing-*` / `settings-*` CSS class namespace
**File:** `apps/merchant-control-plane/src/app/[store]/settings/billing/page.tsx`  
**Severity:** HIGH  
**Detail:** Layout areas (`billing-stat-grid`, `billing-upcoming-*`, `settings-home-card`, `settings-home-section-label`, `settings-form-body`) are styled via an external CSS file with private class names. These bypass `--lb-*` tokens and `Card`/`Section` components from `@letbuyy/ui`.  
**Fix:** Replace `<div className="billing-stat-grid">` with `<Card>` + `<Section>` composites from `@letbuyy/ui`. Replace `settings-home-card` wrappers with `<Card>`. Apply `--lb-*` inline tokens for spacing.

---

### D-05 — HIGH: `text-[10px]` hardcoded font size across Dashboard
**File:** `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx`  
**Severity:** HIGH  
**Detail:** Five or more `text-[10px]` usages appear on metric labels and badge text. No `--lb-font-size-*` token exists at 10px. The smallest canonical typography token is `caption = 12px` (`--lb-font-size-caption`). This violates the design ratchet rule.  
**Fix:** Replace `text-[10px]` with the `caption` typography token class (once the Tailwind `@theme` block maps `--lb-font-size-caption` as `text-caption`). If 10px is genuinely required for a specific context, add a `--lb-font-size-xs` token at 10px to the canonical token set before using it.

---

### D-06 — HIGH: Marketing-site `globals.css` hardcodes success/warning colors inconsistently
**File:** `apps/marketing-site/src/app/globals.css`  
**Severity:** HIGH  
**Detail:** Light mode defines `--success: rgb(22 163 74)` (hardcoded green-700) while dark mode correctly uses `--success: var(--lb-color-success)`. Similarly `--warning` is hardcoded in both themes to different values rather than referencing `var(--lb-color-warning)`.  
**Fix:** Replace both light and dark mode `--success` and `--warning` aliases with `var(--lb-color-success)` and `var(--lb-color-warning)` respectively.

---

### D-07 — HIGH: Features.tsx hardcodes 8 graph node colors as raw RGB in JS data
**File:** `apps/marketing-site/src/components/Features.tsx`  
**Severity:** HIGH  
**Detail:** The `GNODES` array defines 8 node color values as raw `rgb(...)` strings directly in the JavaScript data layer. The same 8 colors repeat in 32 event feed items. This creates an unmaintained color palette that diverges from the design token system.  
**Fix:** Define a `GRAPH_PALETTE` constant object that maps semantic names (`teal`, `blue`, `primary`, `emerald`, `amber`, `pink`, `lavender`, `cyan`) to their values, then reference CSS custom properties in the SVG where possible. For JS-only contexts (SVG `<stop>` colors), pull values via `getComputedStyle(document.documentElement)` against `--lb-color-*` tokens.

---

### D-08 — HIGH: Identity-platform globals.css hardcodes surface/text/border colors as raw RGB
**File:** `apps/identity-platform/src/app/globals.css`  
**Severity:** HIGH  
**Detail:** The `--bg`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-hint`, `--border`, and `--input-bg` custom properties are all hardcoded to raw `rgb(...)` values in both light and dark mode blocks. These broadly match the `--lb-color-*` token values but do not reference them, creating a maintenance split.  
**Fix:** Map each alias to the corresponding `--lb-color-*` token: `--bg: var(--lb-color-bg)`, `--text-primary: var(--lb-color-text)`, `--border: var(--lb-color-border)`, etc. The identity-platform's unique "Premium Ink Lavender" light theme tints may need a dedicated `--lb-color-bg-premium` variant token if the exact shade differs from the platform default.

---

### D-09 — MEDIUM: Theme editor uses ~50+ `theme-os-*` private CSS classes with no `--lb-*` token references
**File:** `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`  
**Severity:** MEDIUM (HIGH if editor surface is expected to be maintained by multiple engineers)  
**Detail:** The full-screen theme editor's layout, spacing, color, and icon system is managed via `theme-os-*` CSS classes in an external stylesheet. No `var(--lb-*)` token is referenced in the JSX. While the isolation is architecturally intentional, semantic values like radius, z-index, and motion timing should still use `--lb-*` tokens.  
**Fix:** Audit the external `theme-os-*.css` file (not in scope for this report) and replace hardcoded `border-radius`, `z-index`, and `transition` values with `var(--lb-radius-*)`, `var(--lb-z-*)`, and `var(--lb-motion-*)` tokens. Color values should use `var(--lb-color-*)`.

---

### D-10 — MEDIUM: No canonical icon size set enforced across the platform
**Files:** All three apps  
**Severity:** MEDIUM  
**Detail:** Icon sizes used across the platform include: 10, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 28, 32, 34 — 14 distinct values across 24 files. The `governance.stories.tsx` defines component usage rules but does not address icon sizing. This creates visual inconsistency in icon weight and alignment.  
**Fix:** Define a canonical icon size vocabulary: `xs=12`, `sm=16`, `md=20`, `lg=24`, `xl=32`. Document as a governance rule in the UI package. Migrate all icon `size` / `width` / `height` props to this vocabulary. Remove 10px (below Tailwind's 12px icon floor), 13, 14, 15, 17, 18, 19, 22, 28, 34 from use.

---

## Quick Reference: Files with Zero Violations

These files represent the canonical implementation pattern for their app context:

- `apps/merchant-control-plane/src/app/[store]/customers/page.tsx` — benchmark for merchant pages
- `apps/merchant-control-plane/src/app/[store]/products/purchase-orders/page.tsx` — clean minimal page
- `apps/marketing-site/src/app/page.tsx` — clean orchestration
- `apps/marketing-site/src/components/Footer.tsx` — benchmark for marketing components
- `apps/identity-platform/src/lib/config/urls.ts` — config file, no styling

---

## Migration Priority Matrix

| Priority | Item | Effort | Impact |
|---|---|---|---|
| P0 | D-02: Fix `Rs.` → `₹` in coupons | 1 hour | HIGH — live locale bug |
| P0 | D-01: Fix `lucide-react` → `@letbuyy/ui` in editor | 2 hours | HIGH — dependency governance |
| P1 | D-03: Migrate coupons to `<Table rows columns>` API | 3 hours | HIGH — consistency |
| P1 | D-05: Replace `text-[10px]` in Dashboard | 2 hours | HIGH — ratchet violation |
| P2 | D-06: Fix marketing globals.css success/warning aliases | 30 min | MEDIUM |
| P2 | D-07: Extract Features.tsx graph palette to constants | 2 hours | MEDIUM |
| P2 | D-08: Bridge identity-platform CSS vars to `--lb-*` tokens | 4 hours | MEDIUM |
| P3 | D-04: Migrate billing page to `Card`/`Section` pattern | 1 day | HIGH — long-term maintainability |
| P3 | D-10: Define canonical icon size vocabulary | 1 day | MEDIUM — platform-wide |
| P4 | D-09: Audit theme editor CSS for `--lb-*` token adoption | 2 days | MEDIUM |
