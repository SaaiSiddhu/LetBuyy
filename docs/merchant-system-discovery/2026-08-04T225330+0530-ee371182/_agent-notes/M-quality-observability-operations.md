# Agent M — Cross-Domain QA, Accessibility, Observability & Operations

Run: `2026-08-04T225330+0530-ee371182` · Branch `stepup/main` · Commit `ee371182`
Scope A: QA/UX/A11y across the merchant surface. Scope B: observability, audit trails, DLQ/reconciliation, operator tooling, support readiness, backup/recovery.

---

## 0. Method, honesty contract, and caveats

**What I did.** Static source inspection + configuration reading + execution of three read-only repository validators and two read-only unit-test suites. No service was started, no production system was contacted, no data was mutated, no file outside this notes file was written.

**Status ceiling.** Nothing here is `VERIFIED_E2E`. I observed no runtime request/response and no persistence. Static reading caps at `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. Where I *executed* a repository script (validators, unit tests) I tag the result `BUILD_RESULT` / `RUNTIME_OBSERVATION` **of that script only** — never of the product.

**Working-tree caveat (important).** The worktree carries ~6,784 pre-existing user modifications on top of `ee371182`. The validator results in §2.5 therefore describe **the working tree the user is holding**, not a clean checkout of `ee371182`. I state this explicitly at each executed result and never present it as HEAD state.

**Sampling is explicit.** The merchant app has 77 `page.tsx` routes; I scored a **sample of 22** in detail and ran a coarse regex signal pass over all 77. The console has 24 pages; I scored **10**. Accessibility is a **spot check of the shared primitives plus the highest-stakes dialogs** — this is not a WCAG audit and I make no WCAG-conformance claim.

**Local governance read before inspection.** `apps/merchant-control-plane/AGENTS.md` (25 lines — boundary/ownership boilerplate only, no UI or observability rules), `apps/platform-console/AGENTS.md`, `services/api-gateway/AGENTS.md`, `services/queue-workers/AGENTS.md`. None carry UI/observability/audit law. The operative rules are root `AGENTS.md` **UI-R1…UI-R7** (`AGENTS.md:288-294`), **CODE-R5** (`AGENTS.md:121`), **ANTI-R9** (`AGENTS.md:322`), **TEST-R2** (`AGENTS.md:200`), and Constitution **ART-24** (`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md:301-302`) + **R-23** (`:424`).

---

## 1. Headline

The merchant UI's **component-level** quality is genuinely strong — a real DTCG token system, a single theme provider with a reachable light/dark toggle in *both* the merchant app and the console, a shared component library with a correct focus trap + `inert` isolation + `aria-live` toasts, near-zero hardcoded palette classes in page code, and a consistent skeleton→empty→error→retry triad on 20 of the 22 sampled pages.

The failures are not sloppiness. They are **four whole missing layers**, each of which reads as healthy rather than as missing:

1. **Nothing wakes a human.** Every 5xx alert path in the repository terminates in a queue job literally named `incident.page.dry_run`; the worker that consumes it writes `mode: 'dry_run'` to `audit_logs` and stops. No paging adapter exists.
2. **The operator's only ops dashboard is fed by three tables that nothing writes.** `queue_operation_snapshots`, `runtime_health_projections`, and `runtime_alert_evaluations` have **zero writers repo-wide**. The console consequently renders `DLQ messages: 0` and `Firing alerts: 0` with a **green `success` tone**. This is `ANTI-R9` (stub-reads-as-success) applied to the operations surface itself.
3. **Money and privileged merchant actions leave no audit trail.** Zero `audit_logs` writes exist in any merchant-facing money or security gateway route. The one merchant-actor audit writer that *does* exist (staff lifecycle) writes `actor_type: 'merchant'`, which **violates the table's CHECK constraint**, and the failure is swallowed by a `try/catch`. The tamper-evident hash-chained audit layer that was built is dead code behind a no-op emitter.
4. **The one surviving ops console cannot operate merchant payments.** Of ART-24's four named gates — refund, maker-checker payout, dispute log, KYC queue — **none exist in `apps/platform-console`.** Where dual control *is* wired (developer payouts, money-break resolution) it is a self-typed UUID with no existence check, i.e. maker-checker in name only.

Plus one product-grade data-loss defect found in Scope A: **the merchant CSV export silently truncates at 100 rows and reports success.**

---

## 2. SCOPE A — QA / UX / Accessibility

### 2.1 Sample scorecard — 22 merchant pages (SAMPLE of 77, NOT EXHAUSTIVE)

Scored by reading rendering primitives and citing line numbers, not by filename. Legend: ✅ present · ⚠️ partial/qualified · ❌ absent · n/a not applicable.
"Dark" = page composes `--lb-*` tokens only (which flip at `<html data-theme>` via `LetbuyyThemeProvider`), i.e. no hardcoded palette that would survive the flip.

| # | Page (`apps/merchant-control-plane/src/app/[store]/…`) | Skeleton | Empty | Error | Retry | Destructive confirm | Pagination | Dark |
|---|---|---|---|---|---|---|---|---|
| 1 | `dashboard/` (+`DashboardClient.tsx`) | ✅ `:865-877` | ✅ `:666` | ❌ failures render as ₹0 + *info* banner `:585-589` | ❌ | n/a | n/a | ✅ |
| 2 | `orders/page.tsx` | ✅ `:646` | ✅ `:462` | ✅ `:640` | ✅ `:467,:633` | ✅ `:667` | ❌ hard `limit:'50'` `:207` | ✅ |
| 3 | `orders/[orderId]/page.tsx` | ✅ `:633,:638` | ✅ `:357,:455` | ✅ (rendered as EmptyState `:656-659`) | ✅ `:661` | ❌ no refund/cancel control at all | n/a | ✅ |
| 4 | `products/page.tsx` | ✅ `:362` | ✅ `:405` | ✅ `:387` | ✅ `:380` | ❌ | ❌ `limit '100'` `:103` | ✅ |
| 5 | `products/inventory/page.tsx` | ✅ `:324` | ✅ `:326,:360` | ⚠️ inline only | ✅ `:311,:339` | ❌ | ❌ `limit=100` `:65` | ✅ |
| 6 | `products/gift-cards/page.tsx` | ✅ `:393,:545` | ✅ `:511,:527` | ⚠️ inline only | ✅ `:426` | ❌ **disable fires immediately** `:358-365` | ❌ | ✅ |
| 7 | `products/purchase-orders/page.tsx` | ✅ `:599` | ✅ `:603` | ✅ `:228,:453,:580` | ✅ `:615` | ❌ | ❌ `limit 200` `:526` | ✅ |
| 8 | `customers/page.tsx` | ✅ `:388` | ✅ `:316` | ✅ `:382` | ✅ `:334,:375` | ❌ | ❌ `limit '100'` `:178` | ✅ |
| 9 | `payouts/page.tsx` | ✅ `:166` | ✅ `:125` | ✅ `:161` | ✅ `:130,:153` | ⚠️ step-up TOTP (stronger than a dialog) `:224-233` | ❌ none | ✅ |
| 10 | `analytics/page.tsx` | ✅ `:138,:143` | ✅ `:177,:241` | ⚠️ inline only | ✅ `:128` | n/a | n/a | ✅ |
| 11 | `coupons/page.tsx` | ✅ `:326` | ✅ `:498` | ✅ `:405` | ✅ `:350` | ✅ `:586` | ❌ `limit=100` `:124` | ✅ |
| 12 | `reviews/page.tsx` | ✅ `:471` | ✅ `:353` | ✅ `:405` | ✅ `:371,:398` | ✅ `:485` | ❌ `limit=100` `:116` | ✅ |
| 13 | `settings/payments/page.tsx` | ✅ `:311,:314` | ❌ | ✅ `:354` | ✅ `:347` | ❌ | n/a | ✅ |
| 14 | `settings/taxes/page.tsx` | ✅ `:401` | ✅ `:620` | ✅ `:454` | ✅ `:447` | ✅ `:664` | n/a | ✅ |
| 15 | `settings/shipping/page.tsx` | ✅ `:386` | ✅ `:508` | ✅ `:427` | ✅ `:420` | ✅ `:607` | n/a | ✅ |
| 16 | `settings/users/page.tsx` | ✅ `:268,:269` | ❌ | ⚠️ inline only | ✅ `:300` | ✅ `:514` | n/a | ✅ |
| 17 | `settings/security/page.tsx` | ✅ `:172` | ✅ `:174,:265` | ✅ `:161` | ✅ `:178` | ⚠️ inline TOTP re-auth | n/a | ✅ |
| 18 | `settings/business/page.tsx` (KYC) | ✅ `:389,:390` | ❌ | ✅ `:425` | ✅ `:425,:589` | ❌ | n/a | ✅ |
| 19 | `settings/notifications/page.tsx` | ✅ `:450,:593` | ✅ `:595` | ⚠️ inline only | ✅ `:426,:440,:564` | ❌ | ✅ **real server pagination** `:667-678` | ✅ |
| 20 | `export/page.tsx` | ❌ | ❌ | ⚠️ toast-only `:263-266` | ❌ | ❌ | ❌ **silently caps at 100** `:151,:189,:232` | ✅ |
| 21 | `marketing/page.tsx` | ✅ `:643` | ✅ `:560` | ✅ `:659` | ✅ `:566,:636` | ❌ | ❌ `limit=50` `:229` | ✅ |
| 22 | `online-store/themes/page.tsx` | ✅ `:364,:536` | ❌ | ❌ | ❌ | ✅ `:567` | n/a | ⚠️ 4 raw color literals |

**Sample verdict.** 20/22 carry a proper skeleton→empty→error→retry triad; that is genuinely good and better than the prior-run note claimed. The real failures are concentrated: `dashboard` (the landing page, worst error handling in the app), `export` (a data-loss defect, §2.2.1), `online-store/themes` (no empty/error/retry). **Pagination is present on 5 of 77 merchant routes** — `settings/notifications`, `products/receipts` (`:353-368`, real server pagination with `page`/`limit=20` at `:92-93`), `products/reservations`, `products/inventory-history`, `products/smart-collections` — and absent from **every high-volume page a real merchant lives in** (orders, products, customers, coupons, reviews, inventory).

Four routes in the 77 are non-pages and were excluded from scoring: `products/[productId]/page.tsx` is a one-line re-export (`export { default } from '../new/page'`), `settings/localization/page.tsx` is a permanent redirect, `settings/custom-data/page.tsx` is a stale "backend needed" placeholder (see G-M-17), `online-store/page.tsx` is a 17-line shell.

### 2.2 Console sample — 10 of 24 pages

| Page (`apps/platform-console/src/app/(dashboard)/…`) | Skeleton | Empty | Error | Retry | Pagination |
|---|---|---|---|---|---|
| `money-reconciliation/page.tsx` | ❌ (RSC) | ✅ `:178,:194` | ✅ `:125-126` | ❌ | ❌ (`limit` `:107,:112`) |
| `operations/page.tsx` | ❌ | ✅ `:461,:568` | ✅ `:331` | ❌ | ❌ |
| `audit-logs/page.tsx` | ❌ | ✅ `:200` | ✅ `:80,:86` | ❌ | ✅ real (`:236-252`, filters `q`/`actor_type`/`date`) |
| `merchants/page.tsx` | ❌ | ✅ `:91` | ✅ `:93` | ❌ | ❌ |
| `merchants/[id]/page.tsx` | ❌ | ✅ `:186,:205` | ✅ `:162` | ❌ | n/a |
| `incidents/page.tsx` | ❌ | ✅ `:238` | ✅ `:178` | ❌ | ❌ |
| `risk/page.tsx` | ❌ | ✅ `:39,:49` | ✅ `:27` | ❌ | ❌ |
| `compliance/page.tsx` | ❌ | ✅ `:279,:326` | ✅ `:212-214` | ❌ | ❌ |
| `stores/page.tsx` | ❌ | ❌ | ✅ `:112` | ❌ | ❌ |
| `developers/page.tsx` | ❌ | ✅ `:317,:342` | ✅ `:258` | ❌ | ❌ |

Console pages are React Server Components with no `loading.tsx`, no `error.tsx`, and no `not-found.tsx` anywhere in `apps/platform-console/src/app` (verified: the `find` returns nothing). Error surfacing is a static `ConsoleApiErrorPanel` (`components/ConsoleDataTable.tsx:144-151`) with **no retry affordance** — UI-R3 requires "error-with-retry". A thrown server-action error (e.g. `money-reconciliation/page.tsx:76-78` `throw new Error('Money break resolution requires…')`) escapes to Next's default error screen because no `error.tsx` boundary exists.

Credit where due: `audit-logs/page.tsx` is the best-engineered page in either app — server pagination, three filters, and an **honest `hasAggregateGap` flag** (`:66`) that tells the operator the aggregate charts are computed from a 100-row sample rather than the full set.

**Dark mode is reachable in both apps** — merchant via `components/HeaderBar.tsx:59,:160-162` (`useTheme` from `@letbuyy/ui`, single source), console via `(dashboard)/layout.tsx:73` `<ThemeToggleButton>` with `defaultTheme="dark"` (`app/layout.tsx:46`). The prior-run note's claim that the console is "far worse on dark/light mode" is **incorrect**; I correct it here.

### 2.3 Systemic patterns (root causes, not nits)

#### 2.3.1 The merchant CSV export silently truncates at 100 rows and reports success — `[HIGH-STAKES]`
`apps/merchant-control-plane/src/app/[store]/export/page.tsx`:
- products: `fetch(.../products?limit=100)` `:151`
- orders: `new URLSearchParams({ limit: '100' })` `:189`
- customers: `fetch(.../customers?limit=100)` `:232`

There is no `page`/`cursor` loop and no total check. Each branch then fires a **success** toast reporting `data.length` (`:182-187`, `:226-230`, `:257-261`) — for a merchant with 5,000 orders that reads "100 orders were downloaded as CSV" with a green success variant. This is `ANTI-R9` (`AGENTS.md:322`) in the most consequential place: merchants use these exports for accounting and GST filing.

Compounding defects in the same file:
- **No CSV formula-injection neutralisation.** `toCsvRow` (`:93-101`) quotes only `,`, `"`, `\n`. A product or customer name beginning with `=`, `+`, `-`, or `@` executes as a formula when the merchant opens the file in Excel.
- **No GST columns.** The orders header (`:205`) is `order_number, status, customer_name, customer_email, customer_phone, subtotal, shipping_cost, discount, total, payment_method, payment_status, tracking_number, carrier, created_at`. No `tax`/`cgst`/`sgst`/`igst`, no invoice number, no HSN, no `currency`, no order `id`. Unusable for Indian tax filing. (Cross-domain: Agent H.)
- **No timezone conversion.** `created_at` is emitted as the raw ISO string, i.e. UTC, into a CSV an Indian merchant reads as local time.
- **No BOM.** Devanagari / regional-script names can mangle in Excel.
- No date range filter for orders (only `statusFilter`).

#### 2.3.2 The shared `Table` has no error state and no pagination — the structural reason lists never paginate
`packages/typescript/ui/src/table.tsx:48-69` (`TableDataProps`) exposes `loading`, `emptyState`, `emptyMessage`, `savedViews`, `filterChips`, `bulkActions`, `sortKey`, `onSort`, `selectable` — and **no `error` prop and no pagination prop**. Every consumer must hand-roll both. Five pages did; the rest didn't. This single omission explains the app-wide pagination absence far better than "the teams forgot".

The gateway *does* implement pagination — `services/api-gateway/src/routes/orders.ts:545` (`offset`), `:591-592` (cursor or range), `:620-632` (`cursorPaginated` with `nextCursor`). The capability exists and the UI does not consume it.

`orders/page.tsx:616` makes this actively misleading: it renders `` `${totalCount} orders in the current view` `` where `totalCount` comes from `payload.meta.total` (`:223`) — the **server total**, while only 50 rows are rendered. A merchant with 500 orders is told "500 orders in the current view" and can reach 50 of them. Client-side sort (`:432-434`) and the sort handler (`:437+`) then sort only that 50-row window, so "sort by highest value" silently means "highest of the first 50".

#### 2.3.3 `ConfirmDialog` cannot be disabled or put in a loading state → double-submit on every confirmed action
`packages/typescript/ui/src/overlays.tsx:496-506` — `ConfirmDialogProps` is `{open, title, description, children?, confirmLabel?, cancelLabel?, destructive?, onConfirm, onClose}`. There is no `confirmLoading` / `confirmDisabled`. The rendered confirm button (`:530-532`) passes no `loading` and no `disabled`, even though `Button` supports `loading` (`button.tsx:22`). Every confirm dialog in both apps fires `onConfirm` once per click with no guard the caller can apply.

#### 2.3.4 Refund idempotency is defeated on the client — `[HIGH-STAKES]`
`apps/merchant-control-plane/src/app/[store]/orders/page.tsx:394`:
```
idempotency_key: `refund-${refundingOrderId}-${crypto.randomUUID()}`,
```
A fresh UUID per attempt means the key is unique per *click*, not per *intent*. The gateway's `ON CONFLICT`-based idempotency (which Agent G owns) therefore cannot dedupe a merchant who completes step-up twice — each attempt is a distinct key and a distinct refund. `refundLoading` (`:381`, `:420`) guards only the in-flight window of a single React state instance; it does not survive a reload, a second tab, or a repeated step-up. The correct key is derived from the order + amount + reason, not from randomness.

Related, same handler: the refund amount is converted in the browser with `Math.round(parseFloat(refundAmount.trim()) * 100)` (`:385-387`) — money parsed as a float on the client. `Math.round` mitigates but does not eliminate the class.

#### 2.3.5 Gift-card disable is a money action with no confirmation — `[HIGH-STAKES]`
`apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:358-365`: the **Disable** button calls `onClick={() => void changeStatus(row, 'disabled')}` directly. There is no `ConfirmDialog`, no typed confirmation, no step-up. Disabling a gift card makes an outstanding customer liability unredeemable. It is guarded only by `disabled={statusBusyId === row.id}` (`:360`), which is a spinner guard, not a confirmation.

#### 2.3.6 No search debouncing anywhere
Five merchant list pages drive a server fetch straight off the search input with the query in the `useCallback`/`useEffect` dependency chain and **zero** `setTimeout`/debounce in the file: `orders/page.tsx` (`loadOrders` deps `:231`, effect `:233`), `customers/page.tsx`, `products/page.tsx`, `products/inventory/page.tsx`, `products/collections/page.tsx`. Every keystroke is a gateway round-trip.

This is not cosmetic here. `services/api-gateway/wrangler.toml` (production vars block) documents that the query-cost rate limiter runs on `RATE_LIMIT_KV_FALLBACK = "on"` because Upstash is not provisioned, with the in-file warning that *"each limited request costs one KV write, so sustained high volume can exhaust it"*. Un-debounced type-ahead is the cheapest way to exhaust that quota.

#### 2.3.7 The merchant dashboard renders upstream failure as ₹0
`apps/merchant-control-plane/src/app/[store]/dashboard/page.tsx:206-249`: each upstream call is individually `.catch(() => null)`, and the whole block is wrapped in `try { … } catch { return emptyDashboardHomeData() }`. `emptyDashboardHomeData()` (`:252-264`) returns `totalRevenue: 0, totalOrders: 0, totalProducts: 0, avgOrderValue: 0`. The only signal is `analyticsAvailable: false`, which renders as an **info**-variant banner titled *"Analytics are still warming up"* (`DashboardClient.tsx:585-589`). A total gateway outage and a brand-new store are visually identical, and the outage is described as "warming up".

#### 2.3.8 Client errors have no sink
`apps/merchant-control-plane/src/app/error.tsx:14-16` does `console.error(error)` and renders a retry. There is no Sentry, no OTel, no error-reporting endpoint anywhere in production source — the only repo-wide hits for `Sentry` are a legal privacy-policy string (`apps/marketing-site/src/lib/legal/content/data.ts:340`) and build artifacts under `.next/`. Every client-side merchant error is lost. The same file also inlines raw `rgb()` fallbacks and inline styles (`:23-27`, `:63-76`), which is defensible for a boundary that cannot rely on providers but is still UI-R5/UI-R7 drift.

#### 2.3.9 Structured-logging helper exists and is used by two frozen apps only
`packages/typescript/ui/src/logging.ts:12-30` exports `createStructuredLogger`. Consumers: `apps/app-marketplace/src/lib/logger.ts:3` and `apps/theme-marketplace/src/lib/logger.ts:3` — **both FROZEN, non-deploy-target apps.** The merchant control plane, the console, and the storefront do not use it. Raw `console.*` counts: gateway 50 (excluding tests), webhook-service 31, merchant app 7, queue-workers 2. CODE-R5 (`AGENTS.md:121`) forbids production `console.log` in favour of structured logging.

### 2.4 Accessibility spot check (shared primitives + high-stakes dialogs — NOT a WCAG audit)

**What is genuinely good** (`IMPLEMENTED_NOT_RUNTIME_VERIFIED`, static reading of the primitives):

| Control | Evidence | Verdict |
|---|---|---|
| `Input` / `Textarea` label association | `packages/typescript/ui/src/input.tsx:42-44,:54-57,:66-68,:89-90` — `useId`-derived `id`, `htmlFor`, `aria-describedby`, `aria-invalid` bound to `error` | ✅ correct |
| Modal / Drawer roles | `overlays.tsx:173-176` (Drawer), `:459-462` (Modal) — `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, conditional `aria-describedby` | ✅ correct |
| Focus trap + outside-tree isolation | `overlay-hooks.ts:79-140` — captures `previouslyFocused`, sets `inert` + `aria-hidden` on every sibling up the ancestor chain (`:31-66`), wraps Tab/Shift-Tab, restores on cleanup | ✅ correct, unusually thorough |
| Escape + outside-pointer dismiss | `overlay-hooks.ts:163-200` (`useDismiss`), wired at `overlays.tsx:439` | ✅ correct |
| Dropdown menu keyboard model | `overlays.tsx:303-398` — `role="menu"`/`menuitem`, roving `tabIndex`, Home/End, Escape | ✅ correct |
| Toast announcements | `feedback.tsx:224`, `:566` — `aria-live="polite"` | ✅ correct |
| Icon-only buttons | `overlays.tsx:163,:189,:479` — `aria-label` present, decorative glyphs `aria-hidden` | ✅ correct |

**Confirmed gaps:**

- **Data tables carry no table semantics.** `packages/typescript/ui/src/table.tsx:303-338`: the `<table>` has no `aria-label` / `<caption>` prop; `<th>` elements have **no `scope="col"`** (`:313-336`); sortable headers render a `<Button>` with **no `aria-sort`** on the header cell. A screen-reader user cannot tell which column is sorted or which direction. This is one component multiplied across every merchant list. (WCAG 1.3.1 / 4.1.2 risk — I assert the defect, not a conformance verdict.)
- **No accessibility testing of any kind exists.** Repo-wide search for `axe`, `jest-axe`, `@axe-core`, `wcag` across `tests/`, `packages/typescript/ui/src`, and `scripts/validators` returns **zero** hits. `tests/` has 26 subdirectories and not one is a11y.
- **The contrast checker that exists has zero callers.** `packages/typescript/ui/src/tokens.ts:1226-1257` implements `validateLetbuyyBrandContrast` with a real WCAG relative-luminance ratio (`:1207-1224`) and 4.5:1 / 3:1 minimums for `--lb-color-primary-text`, `--lb-color-primary-cta-text`, `--lb-color-focus-ring`. It is exported at `index.ts:237` and **never invoked** anywhere in `apps/`, `services/`, `tests/`, or `scripts/`. Merchants can set a brand colour (`createLetbuyyBrandVariables`, `:1259+`) and no contrast gate runs. UI-R4's "MUST meet WCAG AA" has no automated enforcement at all.
- **Mobile ~360px is structurally handled but unverified.** `table.tsx:238-301` renders a card list below `md`, `:220` gives a horizontally scrollable filter strip, `:303` hides the real table above `md`; `AdminShell.tsx:114-130` gives a drawer sidebar with an overlay below `lg`. I could not execute a viewport check — `UNVERIFIED_RUNTIME`.

### 2.5 Timezone, INR, and en-IN formatting

**Timezone — one pinned formatter, used zero times.**
`packages/typescript/ui/src/formatting.ts`:
- `formatDisplayDate` (`:76-93`) — builds `Intl.DateTimeFormat(locale, dateOptions)` with **no `timeZone`**, so it renders in the runtime timezone.
- `formatIndiaDate` (`:94-105`) → `formatDisplayDate` with `locale:'en-IN'` and `INDIA_SHORT_DATE_OPTIONS` — **no `timeZone`**.
- `formatIndiaDateTime` (`:152-170`) — the **only** formatter that sets `timeZone: 'Asia/Kolkata'` (`:167`).

Usage in `apps/merchant-control-plane/src`: `formatIndiaDate(` → **21 call sites**; `formatIndiaDateTime` → **0 call sites**; `formatDisplayDate` → 2.

Consequence: in a React Server Component executing on a UTC edge/serverless runtime, an order placed at `2026-08-05T01:30+05:30` renders as **4 Aug**. Day-boundary errors land directly on order lists, payout dates, coupon expiry, and GST-period edges. In the browser it happens to be right for a merchant physically in India and wrong for anyone else. Note the console *does* use the pinned formatter — `apps/platform-console/src/lib/console-api.ts:9` re-exports `formatIndiaDateTime as formatDateTime`.

**Currency — good shared formatter, 8 bypasses.**
`formatInrCurrency` (`formatting.ts:9-35`) correctly uses `Intl.NumberFormat('en-IN', {style:'currency', currency:'INR'})` and is used 42 times in the merchant app. Hand-rolled bypasses that render `₹` + `toLocaleString` directly:

| Location | Code | Risk |
|---|---|---|
| `customers/segments/page.tsx:140` | `` `Spent ≥ ₹${(rules.min_total_spent / 100).toLocaleString('en-IN')}` `` | divides by 100 (paise→₹) |
| `settings/business/page.tsx:181` | `` `₹${value.toLocaleString('en-IN', {minimumFractionDigits: 2})}` `` | no division |
| `settings/shipping/page.tsx:557` | `` `₹${rate.price.toLocaleString('en-IN')}` `` | no division |
| `products/collections/page.tsx:541` | `₹{product.price.toLocaleString('en-IN')}` | no division |
| `products/purchase-orders/page.tsx:344` | `formatInrCurrency(lineTotal) ?? ` `` `₹${lineTotal}` `` | unformatted fallback |
| `access_account/checkout/select-plan/SelectPlanClient.tsx:35,:37,:41` | three hand-rolled variants, one dividing paise by 100 | inconsistent |

Two of these divide by 100 and four do not, in the same codebase — the unit contract is not enforced at the render boundary. Related, and a genuine ART-10/R-5 deviation: `services/api-gateway/src/routes/shipping.ts:140` computes `amount_minor: Math.round(Number(rate.price || 0) * 100)`, proving **`shipping_rates.price` is stored as a rupee decimal, not `bigint` minor units.** The Constitution requires minor units everywhere. Cross-domain (Agent G / shipping) but recorded here because it is why the UI renders shipping without dividing.

No hardcoded `$` or `USD` was found in the merchant app.

### 2.6 Design-system governance gate — EXECUTED, currently RED

`BUILD_RESULT` — I ran `node scripts/validators/validate-design-system.mjs` (read-only; `--update` not passed) against **the working tree**:

```
HARD invariants: 2 violation(s)
Ratchet metrics: {"appCssRawHex":156,"appCssNakedRgbHsl":822,"tailwindPaletteClasses":537,
 "appLocalLbTokenRedefs":339,"rawPxFontSize":612,"rawPxSpacing":1584,"tsxInlineStyles":673,
 "tsxRawHex":5,"tsxArbitraryRadius":388,"tsxArbitraryShadow":9,"localWorkspaceImplementations":0}
Improvements since baseline: tailwindPaletteClasses: 588 → 537

✖ Design-system governance FAILED:
  - marketing-site: dark mode must be reachable through the canonical provider toggle
  - developer-portal: dark mode must be reachable through the canonical provider toggle
  - RATCHET regression: appCssRawHex rose to 156 (baseline 0)
  - RATCHET regression: appCssNakedRgbHsl rose to 822 (baseline 572)
  - RATCHET regression: appLocalLbTokenRedefs rose to 339 (baseline 112)
  - RATCHET regression: rawPxFontSize rose to 612 (baseline 533)
  - RATCHET regression: rawPxSpacing rose to 1584 (baseline 1365)
  - RATCHET regression: tsxInlineStyles rose to 673 (baseline 635)
  - RATCHET regression: tsxRawHex rose to 5 (baseline 0)
  - RATCHET regression: tsxArbitraryRadius rose to 388 (baseline 327)
  - RATCHET regression: tsxArbitraryShadow rose to 9 (baseline 8)
```

Baseline: `scripts/validators/design-system-baseline.json` (`generatedAt: "2026-06-12"`). The validator **is** wired into the governance suite (`scripts/validate-governance.mjs:21`) and CI (`.github/workflows/ci.yml:90` and `architecture-governance.yml:61` run `pnpm run lint:css`; `validate:design-system` is `package.json:26`). So the ratchet is real and it is currently failing. This directly contradicts the `CLAUDE.md` operational claim *"Keep the 107-validator gate green"*.

Two HARD failures are **UI-R3 dark-mode reachability** violations in `marketing-site` and `developer-portal` — canonical runtimes/frozen apps outside my primary scope but recorded because UI-R3 is my rule.

My own per-app counts for the merchant surface (independent grep, same working tree):

| App | CSS raw hex | app-local `--lb-*` redefs | `rounded-[…]` in TSX | inline `style={{` in TSX |
|---|---|---|---|---|
| `merchant-control-plane` | 40 | **135** | **202** | 82 |
| `platform-console` | 0 | 6 | 32 | 0 |
| `storefront-runtime` | 34 | 9 | 0 | 579 |
| `platform-operations-portal` (frozen) | 0 | 6 | 48 | 0 |

`apps/merchant-control-plane/src/app/globals.css` is **13,895 lines** containing **136 `--lb-*` declarations** that alias the canonical tokens onto app-local variables (`:87-94`, `:108-114`, `:163-167`), plus 492 raw colour literals and 2,660 raw `px` values. Those local variables are themselves defined with raw `rgb()` (`:66`, `:101-102`, `:154`, `:172-173`). This is precisely the *"per-app `--lb-*` redefs"* LEGACY item named in `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md:259`, and it is a live UI-R1 ("one token source") deviation.

One more gap: **`.stylelintrc.cjs` does not enforce UI-R7 at all.** It extends `stylelint-config-standard` and then explicitly disables `color-function-notation`, `alpha-value-notation`, `custom-property-pattern`, `hue-degree-notation`, and `length-zero-no-unit` (`:21-54`). There is no rule banning naked `rgb()`/`hsl()`, raw px, or arbitrary radius. `AGENTS.md:293` says "stylelint is wired into CI" as part of the ratchet — it is wired, but it enforces formatting, not the design-token invariant. The actual enforcement lives entirely in `validate-design-system.mjs`, and that is red.

Page-level token discipline in the merchant app is nonetheless excellent: across all `.tsx` in `apps/merchant-control-plane/src`, only **6** Tailwind palette classes exist and **all 5 material ones are in `[store]/login/page.tsx:23-26`** (`bg-zinc-50 dark:bg-zinc-950`, `border-zinc-300`, `text-zinc-600 dark:text-zinc-400`) — a redirect shim. The drift is concentrated in `globals.css` and in theme-editor controls, not in product pages.

---

## 3. SCOPE B — Observability and Operations

### 3.1 Structured logging and trace correlation

**Gateway — genuinely well built.** `services/api-gateway/src/middleware/observability.ts`:
- request id (`:41-43`) from `X-Request-ID` response → request header → `crypto.randomUUID()`; trace id (`:45-47`) from `X-Trace-ID` → `Traceparent` → request id; `X-Trace-ID` echoed on the response (`:222`).
- JSON structured log per request (`:76-88`, emitted `:257`) with `{level, service:'letbuyy-api', request_id, trace_id, site_id, route, method, status_code, latency_ms, user_id, auth_source}` — level derived from status class.
- Analytics Engine data point per request (`:139-186`) to the `RUNTIME_TELEMETRY` binding, with `siteId`/`requestId`/`traceId` indexes and a 6-value `doubles` vector (count, latency, status, 5xx, 4xx, 2xx).
- DB metric row per request via `ObservabilityExecutionAdapter.recordRuntimeMetric` (`:258-292`) into `runtime_telemetry_metrics`.
- Sampled request-log row into `worker_request_logs` (`:322-357`) — the sampler (`shouldRecordRequestLog`, `:189-211`) **always** records 4xx/5xx, auth routes, payment routes, admin/ops routes, and any authenticated request; only anonymous storefront GETs are sampled at `REQUEST_LOG_SAMPLE_RATE` (default 0.02, production var set to `"0.02"` in `wrangler.toml`).

The Analytics Engine bindings are declared for real in both environments: `services/api-gateway/wrangler.toml` `[[env.production.analytics_engine_datasets]] binding = "RUNTIME_TELEMETRY", dataset = "letbuyy-production-telemetry"` (and the staging equivalent). Cloudflare Workers observability is on with `head_sampling_rate = 0.1` and `invocation_logs = true` for default/staging/production. So the **emission side is CONNECTED-capable**, not "NOT CONNECTED".

**queue-workers — also well built.** `services/queue-workers/src/index.ts`: request/correlation ids derived per message (`:201-202`, `:381`), structured JSON log writer (`:434-438`), Analytics Engine points at `:317-330` (`letbuyy.queue.delivery.batch`) and `:341-350` (`letbuyy.queue.dead_letter.total`), per-batch counters including `dead_lettered` (`:267`, `:283`, `:306`).

**webhook-service — the money-critical path is the least observable runtime.** `services/webhook-service/src/index.ts` uses ad-hoc unstructured strings: `console.info("[Razorpay] Payment captured", {...})` (`:792`), `console.error("[Razorpay] Invalid signature", …)` (`:735`), `console.info(\`[Razorpay] Verified event: ${eventType}\`)` (`:778`), and 28 more. It **never imports `writeRuntimeTelemetryDataPoint`**, emits no Analytics Engine point, and generates no request/trace id (`request_id` appears only as a passthrough field at `:144`, `:630`, `:656`). Its `wrangler.toml` *does* bind `RUNTIME_TELEMETRY` (`:61-63`, `:100-102`) — the binding is provisioned and unused. A payment webhook cannot be correlated with the gateway request that created the order.

**The merchant app breaks correlation at the proxy boundary.** `apps/merchant-control-plane/src/lib/api/client.ts:60` mints a **new** `X-Request-ID` per `merchantApiFetch` call and never propagates a browser-supplied one. The proxy routes return only the JSON body — e.g. `app/api/stores/[store]/orders/[orderId]/refund/route.ts:62` does `NextResponse.json(refundPayload, {status})`, discarding the gateway's `X-Trace-ID` response header. Worse, that one refund action makes **two** `merchantApiFetch` calls (`:26` order lookup, `:49` refund) and therefore produces **two unrelated gateway request ids** for a single merchant intent. Net effect: a merchant who sees "Refund failed" has no reference to give support, and support has no id to search.

**Dead scaffolding with a green test suite.** `services/api-gateway/src/lib/foundation-observability.ts` (99 lines) exports `createFoundationTraceContext`, `foundationStructuredLog`, `appendAuditRelayEnvelope`, `redactFoundationLogFields`, and `createMetricsRegistry`. Repo-wide search for any of those symbols outside the file itself returns **only** `services/api-gateway/src/__tests__/observability.test.ts`. `RUNTIME_OBSERVATION`: I ran `npx tsx --test services/api-gateway/src/__tests__/observability.test.ts` — **8 tests, 8 pass, 0 fail**, including *"foundation trace and audit envelopes carry tenant/channel context with redacted secrets"* and *"foundation metrics registry accumulates counters and observations"*. Green tests over code with zero production callers.

### 3.2 Metrics — emission points vs. queryable sinks

| Sink | Written by | Readable by |
|---|---|---|
| Cloudflare Analytics Engine (`letbuyy-production-telemetry`) | gateway `observability.ts:150-186`; queue-workers `index.ts:317-350` | **nothing in this repo** — no query code, no dashboard, no API route reads it |
| `runtime_telemetry_metrics` (Postgres) | `ObservabilityExecutionAdapter.recordRuntimeMetric` (`observability-execution.adapter.ts:122-142`) | **nothing** — no reader anywhere |
| `operation_metrics` (Postgres) | `recordMetric` (`:105-121`) | **nothing** |
| `worker_request_logs` (Postgres) | `recordRequestLog` (`:78-92`) | `GET /v1/operations/request-logs` only (§3.3) |

Every metric in the platform is write-only in-repo. The emission discipline is real; the read path does not exist.

### 3.3 The request-log query API cannot answer a support question
`services/api-gateway/src/routes/operations.ts:383-408`. It selects `id, site_id, request_id, trace_id, method, path, status_code, latency_ms, user_id, auth_source, error_code, created_at` and supports exactly **two** filters — `status_code` (`:396-400`) and `site_id` (`:402`) — plus `limit`, via `parseListQuery` (`:73-86`) whose schema accepts only `{status, site_id, queue_name, limit}`.

You cannot filter by `request_id`, `trace_id`, `path`, `error_code`, `user_id`, or a time window. The gateway carefully stores a trace id it then makes unqueryable. And **no UI consumes this endpoint at all** — repo-wide search for `request-logs` / `request_logs` across `apps/platform-console/src`, `apps/merchant-control-plane/src`, and `packages/typescript/api-client/src` returns nothing.

### 3.4 Alerting — the whole chain terminates in a dry run

1. Gateway detects a 5xx (`runtime-alerting.ts:110-112`, `alertable = statusCode >= 500`), classifies severity sev2/sev3 with a correct money-path bias (`:96-108`: `/payments`, `/checkout`, `/payouts`, `/settlements`, `/auth` → sev2), builds a dedupe key (`:114-117`), redacts secret-shaped fields (`:13`, `:68-89`), records a `letbuyy.alert.runtime.error` metric, and enqueues to `RUNTIME_QUEUE` (`:220-233`).
2. The job type is `export const RUNTIME_ALERT_JOB_TYPE = 'incident.page.dry_run'` — **`services/api-gateway/src/lib/runtime-alerting.ts:7`.**
3. `services/queue-workers/src/incident-command.ts:196-205` routes it to `processDryRunPage` → `sendIncidentPage` (`:90-124`), which builds `{ mode: 'dry_run', adapter: stringField(input.schedule?.paging_adapter) || 'dry_run', … }`, optionally inserts a `production_incident_events` row, writes an `audit_logs` row with `action: 'incident.page.dry_run.worker'`, and **returns**.

There is no paging adapter, no PagerDuty/Opsgenie/Slack/SMS/email call, and no escalation. `oncall_schedules` is read (`:71-88`) purely to stamp a name into the dry-run payload. Repo-wide search of `.github/workflows/*.yml` for `slack|pagerduty|opsgenie` returns **zero** hits. **Nothing in this system can wake a human.**

`infrastructure/observability/prometheus-rules.yaml` defines three alerts (`LetBuyyApiGatewayHighErrorRate`, `LetBuyyQueueDeadLetterGrowth`, `LetBuyyDeploymentGateFailed`) — but (a) there is no Prometheus or Grafana in the stack (`grep prometheus|grafana` over `infrastructure/cloudflare/*.tf` and all workflows returns nothing; the runtime is Workers + Analytics Engine + Postgres), and (b) the expressions reference metric names the code never emits (`http_server_errors_total`, `letbuyy_queue_dead_letter_total`, `letbuyy_deployment_health_gate_failed_total` vs. the actual `letbuyy.runtime.request`, `letbuyy.queue.dead_letter.total`). The same applies to `infrastructure/observability/grafana-{runtime,queue,incident,deployment}-dashboard.json` and `otel-collector.yaml`, which `config/runtime/observability-platform.json:20-45` declares with `"mustUseLiveTelemetry": true`. These are paper artifacts referencing a stack that is not deployed.

`docs/runbooks/queue-dlq-redrive.md:5` instructs the operator to *"Watch `cloudflare.queue.delivery.lag`"* — a metric name that appears **nowhere** in the repository.

### 3.5 Audit trails

**Which tables exist**

| Table | Definition | Tamper-evident? | Written by |
|---|---|---|---|
| `audit_logs` | `000_baseline.sql:8440-8455` | **No** — no `prev_hash`, no `seq`, no `site_id`, no append-only trigger | 20 call sites, **all operator/system** |
| `audit_activity_events` | `000_baseline.sql` (`audit_activity_events_actor_type_check` at `:8432`) | No | `EventExecutionAdapter.emitAuditEvent` — **2 callers, both theme** (`theme-execution.adapter.ts:1295`, `:1500`) |
| `audit_events` | `159_identity_foundation_core.sql:517-552` — has `seq`, `prev_hash`, `hash`, `correlation_id`, `request_id`, `encrypted_pii`, hash-chain index (`:584`) | **Yes, by design** | **Nothing.** Zero writers. |
| `execution_audit_trail` | `000_baseline.sql` | — | not exercised in merchant paths |

**The canonical tamper-evident layer is dead code.** `services/api-gateway/src/identity-foundation/audit-dual-write.ts` implements a full hash chain: `computeAuditHashChain` (`:179-198`) with stable serialisation (`:163-171`) and SHA-256 over `{row, seq, prev_hash, anchor_kid}`; `prepareCanonicalAuditRow` (`:200-217`); `emitAuditDualWrite` (`:220-245`); PII redaction (`:104-127`). Repo-wide, `emitAuditDualWrite` has **zero callers** — it is only re-exported by `identity-foundation/index.ts:1`. And the boundary that would use it wires a no-op: `repository-implementations.ts:72` sets `auditEmitter: createNoopAuditEmitter()`, whose `emit` returns `{accepted: true, legacyWritten: false, canonicalWritten: false}` (`packages/audit-core/src/index.ts:62-73`). It **reports success while writing nothing** — ANTI-R9 again, in the audit layer. The only part of `identity-foundation/` actually wired into the gateway is `auth-verifier-registry` (`middleware/auth.ts:19`).

**`audit_logs` is forgeable and mutable.**
- `CREATE POLICY audit_insert ON public.audit_logs FOR INSERT WITH CHECK (true);` — `000_baseline.sql:24380`. Any role that can reach the table can insert an arbitrary audit row attributing any action to any actor.
- `ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;` (`:24387`) — **ENABLE only, never FORCE.** There is no `audit_logs FORCE ROW LEVEL SECURITY` anywhere in the migration set (the FORCE statements that do exist are for `payments`, `payment_credentials`, `payment_tokens`, `payment_attempts` in `142_executable_payment_sessions.sql:182-187`, and the loop in `141_…:357`). The gateway calls it as `service_role` via `getSupabaseAdmin`, which bypasses RLS.
- No append-only trigger. `grep "ON public.audit_logs"` across all migrations returns only three indexes and the two policies — no `BEFORE UPDATE`/`BEFORE DELETE` guard.
- No `site_id` column, so a merchant can never be shown their own audit trail and rows cannot be tenant-scoped.

**Merchant staff-lifecycle audit writes are guaranteed to fail, silently.** `services/api-gateway/src/routes/employee.ts:178-200` defines `writeEmployeeAudit`, which inserts into `audit_logs` with **`actor_type: 'merchant'` (`:189`)**. The table's constraint is `CONSTRAINT audit_logs_actor_type_check CHECK ((actor_type = ANY (ARRAY['user','employee','super_admin','system'])))` — `000_baseline.sql:8454` — and no later migration alters it (`grep` for `ALTER`/`ADD CONSTRAINT` on `audit_logs` returns only the PK and the RLS enable). Every insert therefore raises a `23514` check violation, which is swallowed by the surrounding `try { … } catch (err) { console.error(…) }` (`:186-200`, comment: *"Best-effort: an audit failure must never fail the underlying employee mutation"*). Four call sites are affected: `employee.created` (`:361`), `employee.invited` (`:467`), **`employee.updated` (`:580`, carries `{updates}` — i.e. role changes)**, `employee.removed` (`:605`). Staff privilege changes are unauditable and nobody is told.

**Merchant money and security actions have no audit at all.** Grep for `audit` in the merchant-facing gateway routes:

| Route file | `audit` occurrences |
|---|---|
| `routes/payments.ts` | 0 |
| `routes/payouts.ts` | 0 |
| `routes/settlements.ts` | 0 |
| `routes/orders.ts` | 0 |
| `routes/returns.ts` | 0 |
| `routes/wallet.ts` | 0 |
| `routes/commission.ts` | 0 |
| `routes/billing.ts` | 0 |
| `routes/security.ts` (step-up) | 0 |
| `routes/two-factor.ts` | 0 |
| `routes/kyc.ts` | 0 |
| `routes/gift-cards.ts` | 2 — **both are comments** (`:29`, `:170`) describing the *ledger* transactions endpoint |

Every `audit_logs` writer in the gateway is operator-scoped: `middleware/rbac.ts:388` (`logSensitiveRead`, `actor_type: 'employee'`), `routes/admin.ts:128,:167,:330,:354`, `routes/operations.ts:112`, `routes/internal-console.ts:392,:1372`, `routes/internal-console/money-reconciliation.ts:115`, `routes/operations/{trust-safety:160, support:162, rbac:98, risk:132, incident-command:126, marketplace-reviews:128}`, `lib/internal-developer-ops.ts:93`, `lib/internal-compliance.ts:137`, and four queue-workers (`compliance.ts:69`, `support-automation.ts:44`, `executive-analytics.ts:136`, `review-checks.ts:141`, `incident-command.ts:61`).

Merchant money paths do emit **domain events** to `outbox_events` (`lib/payment-route-support.ts:153` `emitPaymentEvent`, `:319` `emitOrderPaidEvent` via `EventExecutionAdapter.emitDomainEvent`). That is a delivery mechanism carrying `actor_id`, not an audit trail: it has no reason field, no IP/UA, no immutability guarantee, and it is consumed and pruned.

**Sensitive merchant actions with NO audit record — the list:**
refund initiation and completion · payout release · settlement recording and `recon_breaks` creation · gift-card issue / disable / reactivate · order cancel and status transitions · staff invite / role change / removal (attempted and silently failing) · step-up token issue and consumption · 2FA enrolment and reset · KYC document submission and refresh · tax/GST configuration change · payment provider credential configuration · product price change · coupon create/disable · custom-domain change · theme publish (this one *is* audited, to `audit_activity_events`).

### 3.6 DLQ, retry, reconciliation — capability exists, operator visibility does not

**The queue infrastructure is real.** `services/queue-workers/wrangler.toml` declares six consumers per environment with explicit `max_retries` and a `dead_letter_queue` on each (events 3, analytics 8, search 8, notifications 6, runtime 8), plus consumers on the two DLQs themselves (`:81-104`, mirrored in `[env.staging.*]` and `[env.production.*]`). `infrastructure/cloudflare/queues.tf` sets `queue_retention_seconds = 1209600` (14 days). `services/queue-workers/src/index.ts:365` marks messages arriving on a `dead-letters` queue as `status: 'dead-lettered'` and every domain handler skips them (`incident-command.ts:196`, `compliance.ts:190`, `risk-scoring.ts:243`, `support-automation.ts:142`, `executive-analytics.ts:454`).

**The operator API is real.** `services/api-gateway/src/routes/operations.ts` exposes `GET /outbox/dead-letters` (`:208`), `POST /outbox/dead-letters/:id/replay` (`:229`), `GET /runtime/queues/:queueName` (`:566`), `POST /runtime/queues/:queueName/recover-leases` (`:578`), `POST /runtime/queues/:queueName/redrive-dead-letters` (`:600`), `GET /webhook-deliveries` (`:282`). All behind `requireRoleCategory('ops')` + `requireSuperAdmin` (`:45`).

**The operator UI is fed by tables nothing writes.** `GET /operations/runtime/overview` (`:464-566`) is the single source for the console Operations page. It reads ten tables. Three of them have **zero writers anywhere in the repository** — no TypeScript insert, no RPC, no migration function, no CI script:

| Table read at | Writers found |
|---|---|
| `runtime_health_projections` — `operations.ts:481` | **none** |
| `queue_operation_snapshots` — `operations.ts:484` | **none** (only the trigger `update_queue_operation_snapshots_updated_at`, `000_baseline.sql:20210`) |
| `runtime_alert_evaluations` — `operations.ts:488` | **none** (only `…_updated_at`, `:20259`) |

The remaining seven (`production_incidents`, `deployment_promotion_runs`, `deployment_health_gate_results`, `production_readiness_gate_runs`, `operational_dashboard_snapshots`, `security_enforcement_events`, `operational_certification_reports`) are written **only** by explicit operator/CI `POST`s to `/operations/runtime/*` which call `record_*` RPCs (`operations.ts:853-1000`). Nothing populates them automatically from a deploy.

`apps/platform-console/src/app/(dashboard)/operations/page.tsx` then renders, from those always-empty arrays:
- `:316` `const dlqMessages = queues.reduce((t, i) => t + Number(i.dead_lettered || 0), 0)` → always `0`
- `:317` `const firingAlerts = alerts.filter(i => i.firing).length` → always `0`
- `:337` `<LeadershipMetric label="Healthy runtimes" value="0/0" />`
- `:340` `<LeadershipMetric label="DLQ messages" value="0" tone="success" />`
- `:341` `<LeadershipMetric label="Firing alerts" value="0" tone="success" />`
- `:355-380` "Runtime Health" and "Queue Diagnostics" `StatusPanel`s with empty item lists

**The operator's dashboard renders green because the data pipeline does not exist.** There is no "NOT CONNECTED" state. This is the single most dangerous finding in Scope B.

**Reconciliation.** `services/queue-workers/src/money-ledger-reconciliation.ts` runs on cron `"17 */6 * * *"` (`wrangler.toml:17`). It scans `sites` (`:54-59`) and calls `refresh_money_ledger_site_reconciliation` per site (`:73-75`), which computes `variance_minor = ledger_account_balance_minor(site,'merchant_payable') − Σ posted wallet_ledger_entries` and upserts `money_ledger_site_reconciliations` with `status = 'verified' | 'mismatch'` (`database/supabase/migrations/160_foundation_money_ledger_authority.sql:198-256`). That table **is** read by the console (`money-reconciliation/page.tsx`) — a genuine, working operator surface. Two defects:
- **Silent partial coverage.** `batchLimit` defaults to 100 and hard-caps at 500 (`:26-30`), and the site scan is `.order('created_at', {ascending: true}).limit(...)`. With more than 100 sites, sites 101+ are **never reconciled**, every run, forever — always the same newest merchants.
- **A mismatch alerts nobody.** The function returns `{checked, verified, mismatches, failed, results}` and `index.ts:638-651` writes it to a log line. No `audit_logs` row, no incident, no alert, no queue job. `recon_breaks` (`151_executable_settlement_ledger.sql:170-191`) is written only by the settlement path (`routes/settlements.ts:403-413`), and **no console page reads `recon_breaks`** — the console reads `money_ledger_site_reconciliations`, a different table.

**Merchant-facing webhooks do not exist as a product.** `find apps/merchant-control-plane/src/app/api -path "*webhook*"` returns nothing, and no merchant page mentions webhooks. `POST /operations/webhook-subscriptions` (`operations.ts:326`) sits behind `requireSuperAdmin`. So the question "a merchant's webhook failed" has no merchant-side subject.

### 3.7 `apps/platform-console` — the ART-24 four gates

Constitution ART-24 (`LETBUYY_CONSTITUTION.md:301-302`) and `AGENTS.md:95` (ARCH-R10) name `apps/platform-console` as the one surviving ops console *"for refund, maker-checker payout, dispute log, and KYC queue workflows"*, gated on a smoke path before `apps/platform-operations-portal` is deleted.

Console pages (24 total): `login`, `mfa`, `analytics`, `audit-logs`, `compliance`, `dashboard`, `developers`, `employees`, `founding`, `incidents`, `marketplace-governance`, `merchants`, `merchants/[id]`, `money-reconciliation`, `operations`, `revenue`, `risk`, `settings`, `stores`, `subscriptions`, `trust-safety`, `users`, plus two shells.

| ART-24 gate | Present in `platform-console`? | Backed by a real endpoint? | Evidence |
|---|---|---|---|
| **Refund** | **NO** — no page, no server action, no `/refund` call. The only "refund" string in the whole console is a filter keyword in `audit-logs/page.tsx:321` | Gateway `POST /payments/:id/refund` exists (`routes/payments.ts:498` `action: 'refund.approve'`) but is **merchant-invoked with step-up**, not operator-invoked | `grep -ri refund apps/platform-console/src` |
| **Maker-checker payout** | **NO for merchant payouts.** `developers/page.tsx:536-543` shows *developer* (marketplace partner) payouts **read-only**, with the comment *"release action intentionally omitted (payout:release / dual-control)"* and body copy *"contact the finance team to trigger a release"* | The only dual-controlled payout release is `POST /operations/developers/:id/payouts/:payoutId/release` (`routes/operations/developers.ts:308-323`) — partner payouts, and its UI lives in the **frozen non-survivor** `platform-operations-portal` | `developers/page.tsx:536-543` |
| **Dispute log** | **NO for merchant payment disputes.** The only dispute UI is *developer payout disputes* in `apps/platform-operations-portal/src/app/(dashboard)/developers/page.tsx:79-110,:291-330` — the non-survivor | `chargeback_events` (`124_internal_os_risk_detection.sql:212-257`) has a table, FKs, indexes, RLS — and **zero TypeScript readers or writers** (only `tenant-tables.registry.ts:500` and a test). `services/webhook-service/src/index.ts:781-893` handles `payment.captured`, `payment.failed`, `refund.created`, `payment.authorized` and nothing else — **no `payment.dispute.*` Razorpay event is handled** | see cited lines |
| **KYC queue** | **NO.** No console page, and **no operator KYC endpoint exists in the gateway** — `grep -ri kyc` over `routes/operations/`, `routes/internal-console/`, `routes/internal-console.ts`, `routes/admin.ts` returns nothing | `routes/kyc.ts` (mounted at `index.ts:783`) is merchant-facing document submission only (`merchant_kyc_documents` at `:140,:152,:217,:260,:270,:315`), running in sandbox provider mode (`:76`) | see cited lines |

**Verdict: 0 of 4 ART-24 gates exist in the survivor.** The console *does* have two adjacent, genuinely working operator surfaces — money-break resolution (`money-reconciliation/page.tsx`, dual-control-flagged, MFA-gated) and merchant moderation with dual control (`merchants/[id]/page.tsx:326`) — plus read-only impersonation with a real audit trail (`internal-console.ts:1129-1200`, `action: 'merchant.impersonation.start'` at `:1185`). But the four named money gates are absent, so the `GATE-OPS-SURVIVOR` smoke path in `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:129-132` cannot pass and `platform-operations-portal` cannot be deleted.

**Dual control is self-attested — `[HIGH-STAKES]`.** `services/api-gateway/src/middleware/rbac.ts:182-207` is the entire mechanism:
```
if (requiresDualControl.has(input.targetAction)
    && (!input.secondaryApproverId || input.secondaryApproverId === input.actorId)) {
  return { ok:false, code:'DUAL_CONTROL_REQUIRED', … };
}
```
The set is `{merchant.suspend, developer.suspend, refund.approve, payout.release, money.reconciliation.resolve, ts.reinstate, runtime.control-command}` (`:191-199`). The only assertions are "present" and "different from me". Repo-wide, `secondary_approver_id` is **never** resolved against `employees`, `super_admin_allowlist`, or any principal table — the 20 hits are all schema declarations and passthroughs. There is no approval record, no second session, no second authentication, no expiry. In the UI it is a free-text field the *same* operator types: `apps/platform-console/src/app/(dashboard)/money-reconciliation/page.tsx:166` `<Input name="secondary_approver_id" placeholder="Second approver ID" />`. One operator with one session satisfies "dual control" by typing any UUID that is not their own.

For contrast, the *merchant*-side step-up on refund/payout **is** real cryptography — `services/api-gateway/src/lib/security-controls.ts` implements a v1 HMAC token (`lb-stepup-v1`, `:31`) with `{action, actor_id, site_id, challenge_id, jti, verified_at, exp}` (`:35-43`), a 10-minute window (`:29`), and a `configuredSecret` guard rejecting `SKIP_NEEDS_HUMAN_` / `replace-with` placeholders and secrets under 32 chars (`:46-51`). The governance concern about a "string-length step-up" is **remediated** on that path. (Whether `jti` replay is actually consumed is Agent G's; I did not verify it — UNKNOWN.)

### 3.8 Support readiness — the three scenarios, traced

**Scenario A: "My payout did not arrive."**
`payouts/page.tsx` fetches `/api/stores/{store}/payouts` (`:68`) with no status filter, no date range, no pagination, and renders a flat list with a Release button gated by `StepUpDialog action="payout.release"` (`:224-233`). If the merchant asks *why* a payout is missing, the merchant surface shows a status badge and nothing else — no settlement reference, no provider reference, no expected date, no reconciliation state. On the operator side there is **no console payout page at all**, and `recon_breaks` — the table that records exactly this failure mode per PAY-R9 — **has no reader in either app**. **GAP. No tool answers this question today.**

**Scenario B: "My invoice is wrong."**
The merchant can view orders; the CSV export carries no tax columns at all (§2.3.1). The console `merchants/[id]` page shows commerce counts and revenue but no invoice list. GST invoice tooling is Agent H's domain; from the ops/support angle the answer is: **no operator tool renders a specific merchant invoice.**

**Scenario C: "A webhook failed."**
Merchants have no webhook feature (§3.6). If this means *"a Razorpay webhook to LetBuyy failed"*, the trail is: `webhook_deliveries` is claimed via `claim_webhook_deliveries` (`services/webhook-service/src/index.ts:641`); `GET /operations/webhook-deliveries` (`operations.ts:282`) exists; **no console page consumes it** (`grep -i webhook apps/platform-console/src` returns one unrelated hit at `compliance/page.tsx:288`). And the webhook-service's own logs carry no request/trace id to join on. **GAP.**

**Scenario D: "It failed — here's what I saw."**
There is no reference id the merchant can read (§3.1), no request-id search (§3.3), no in-app support entry point (`grep -ri "support|helpdesk|contact support"` over `apps/merchant-control-plane/src/components` and `settings/page.tsx` returns only marketing copy: `TrialBanner.tsx:67` "Priority support", `FoundingMerchantCard.tsx:77` "Priority Support" badge, `ThemeUpdatePanel.tsx:520` "Contact support or wait…" with no link), and **no support/ticket page in the surviving console**.

A full support-ticket backend *does* exist — `services/api-gateway/src/routes/operations/support.ts` has `GET /overview`, `GET|POST /tickets`, `POST /tickets/:id/{messages,escalate,resolve,csat}`, `GET|POST /macros` (`:338-750`) over `support_tickets`, `ticket_messages`, `ticket_sla_clocks`, `ticket_csat`, `ticket_macros`, with `audit_logs` writes (`:162`) and auto-escalation to Trust & Safety on fraud/chargeback keywords (`:312`). Its UI lives **only** in `apps/platform-operations-portal` (`(dashboard)/support/page.tsx`, `(dashboard)/tickets/page.tsx`) — the frozen non-survivor. The console's only support view is a read-only 10-row panel inside Merchant 360 (`internal-console.ts:1056-1062`, rendered at `merchants/[id]/page.tsx:236`) with no ability to open or reply.

### 3.9 Backup, recovery, runbooks — documented, largely unproven

**What genuinely exists (`PROVIDER_OR_CONFIG_EVIDENCE`):**
- A real pre-migration logical backup in `.github/workflows/production-deploy.yml:252-268`: `pg_dump --format=custom`, `pg_restore --list` manifest, `gpg --symmetric --cipher-algo AES256`, `sha256sum`, uploaded as an artifact.
- 17 runbooks in `docs/runbooks/` including `incident-sev1.md`, `queue-dlq-redrive.md`, `deployment-rollback.md`, `infra-recovery.md`, `secret-rotation.md`, `production-api-rate-limit-backend.md`.
- A real Worker rollback path: `infrastructure/scripts/deploy/production-rollback.mjs` requiring `--worker` and `--version-id`, asserted by `scripts/validators/rollback-integrity-validator.mjs:25-35`.
- A restore-drill script: `scripts/governance/foundation-restore-drill.mjs`.

**What is missing or unproven:**
- **Backup retention is 7 days** — `production-deploy.yml:267` `retention-days: 7` on the only production backup artifact.
- **There is no scheduled backup.** Only three workflows have a `schedule:` trigger (`branch-lag-monitor.yml`, `full-security-audit.yml`, `hot-table-partition-maintenance.yml`) and none of them backs up. The database is dumped **only** when a production migration deploy runs.
- **PITR is off.** `config/runtime/database-recovery-policy.json` — `"pointInTimeRecovery": {"status":"human-required-paid-tier", "skipId":"SKIP-W0-PITR-TIER", "defaultEnabledByCodex": false}`, with `"RPO/RTO target recorded"` and `"restore timestamp tested in a non-production clone"` listed as *pending* resume evidence. **No RPO or RTO is defined anywhere in the repo.**
- **The restore drill has never proven a shared environment.** `foundation-restore-drill.mjs:13-18` — `assertLocalTarget` throws unless the target URL is `localhost`/`127.0.0.1`/`::1`, and the policy sets `"codexDefaultMode": "plan"`, `"sharedEnvironmentAction": "SKIP-DEPLOY human runbook"`. The procedure is documented; it is not proven.
- **R-23 (paired rollback per migration) is not enforced.** `database/supabase/migrations` holds **126** `.sql` files; `database/supabase/rollback` holds **48**. 78 migrations have no rollback file, starting with `000_baseline` and including every migration from `073` to `091`. `RUNTIME_OBSERVATION`: I ran `node scripts/validators/rollback-integrity-validator.mjs` → *"Rollback integrity validator passed (3 rollback manifests checked)"*, exit 0. Reading it (`:9-40`) confirms it validates `config/runtime/deployment-lineage-manifest.json` and fragments of `production-rollback.mjs` — **it never compares the migrations directory to the rollback directory.** `grep -rln "rollback.sql" scripts/` returns three unrelated validators. The ART-02 "migration↔rollback pairing" gate named in the Constitution (`LETBUYY_CONSTITUTION.md:152`) does not exist.
  - Note: the commander's brief cites 187 `.sql` migrations. My `find database/supabase/migrations -name "*.sql" | wc -l` returns **126** on this working tree. I record the discrepancy rather than reconciling it — see §6.
- **Runbooks reference APIs whose data source is empty.** `docs/runbooks/incident-sev1.md` step 4 says inspect *"runtime health, queue state, deployment gates, active alerts"* via `/v1/operations/runtime/overview` — the endpoint whose three most operational tables have no writers (§3.6). Step 5's "redrive DLQ" is real; step 6's escalation terminates in a dry run (§3.4).

### 3.10 Test coverage for this domain

- `RUNTIME_OBSERVATION`: `npx tsx --test services/api-gateway/src/__tests__/observability.test.ts` → **8 pass / 0 fail**. These are pure-function tests of the sampler and the alert *planner* (`normalizeRequestLogSampleRate`, `shouldRecordRequestLog`, `planRuntimeAlert`, `enqueueRuntimeAlert` fail-closed on a missing binding). They assert nothing about persistence, and two of the eight cover the dead `foundation-observability` module.
- `RUNTIME_OBSERVATION`: `node --test services/api-gateway/src/__tests__/observability-analytics-media.test.ts` → **3 pass / 0 fail**. All three are `assert.match(source, /regex/)` over file contents — structural, not behavioural.
- `tests/operations/` holds 10 `.test.mjs` files including `worker-log-sampling.test.mjs`, `queue-storm-controls.test.mjs`, `rate-limit-collapse.test.mjs`, `rollback-lineage-governance.test.mjs`.
- **E2E is effectively non-existent.** `tests/e2e/merchant-journey.spec.ts:3-13` defaults every URL to `*-staging.letbuyy.com` and `requireReachable` calls `test.skip(...)` when the host is unreachable or 5xx. There is **no `test:e2e` script** in root `package.json` (only `@playwright/test` as a devDependency at `:143`), and no workflow invokes Playwright. The merchant journey suite green-passes by skipping.
- **Zero a11y tests, zero contrast tests, zero visual-regression tests.**

---

## 4. End-to-end traces (my domain)

### Trace 1 — Merchant refunds an order (QA + audit + observability view)
| Link | Evidence | Status |
|---|---|---|
| Merchant entry | `orders/page.tsx` list row → refund form → `StepUpDialog` | present, but **MISSING from `orders/[orderId]`** — the detail page has no refund control |
| Client action | `handleRefundStepUpSuccess` `orders/page.tsx:379-422` | present; **idempotency key randomised `:394`** |
| Same-origin proxy | `app/api/stores/[store]/orders/[orderId]/refund/route.ts` | present; **2 gateway calls, 2 request ids, `X-Trace-ID` discarded `:62`** |
| Typed API client | not used (raw `fetch` + `merchantApiFetch`) | n/a |
| Gateway route | `routes/payments.ts:498` `action:'refund.approve'` | present |
| Auth + step-up | `lib/security-controls.ts` HMAC `lb-stepup-v1` | present, real crypto |
| `verifySiteOwnership` | Agent G's scope | not verified here |
| Server-authoritative amount | Agent G's scope | not verified here |
| RPC + ledger | Agent G's scope | not verified here |
| **Audit record** | `grep audit routes/payments.ts` → **0** | **MISSING** |
| Alerting on failure | 5xx → `incident.page.dry_run` → dry-run worker | **MISSING (dry run only)** |
| Operator visibility | no console refund page | **MISSING** |
| Support reference to merchant | trace id dropped at proxy | **MISSING** |
| Tests | `tests/launch/lb3-refund-backend.test.mjs`, `lb34-stepup-frontend.test.mjs` exist (not executed by me) | partial |
| Runtime observation | none | **MISSING** |

### Trace 2 — A production 5xx reaches a human
`gateway 5xx` → `observability.ts:294-320` `enqueueRuntimeAlert` → `runtime-alerting.ts:110` `alertable` → `:120-176` `planRuntimeAlert` (severity, dedupe, redaction) → `:236` `createCloudflareQueueProducer(RUNTIME_QUEUE).enqueue` → `queue-workers/index.ts` consumer → `incident-command.ts:202` `processDryRunPage` → `:90-124` `sendIncidentPage` writes `{mode:'dry_run'}` to `production_incident_events` + `audit_logs` → **END. No human is contacted.**
Every link exists and is well-engineered. The last link is `MISSING`.

### Trace 3 — An operator investigates queue backlog
`console /operations` → `loadOperationsData` → `GET /v1/operations/runtime/overview` (`operations.ts:464`) → `db.from('queue_operation_snapshots')` (`:484`) → **table has zero writers** → `queues = []` → `dlqMessages = 0` (`operations/page.tsx:316`) → `<LeadershipMetric label="DLQ messages" value="0" tone="success" />` (`:340`).
Runbook `docs/runbooks/queue-dlq-redrive.md:1` says start here. The operator sees green. The redrive endpoint underneath is real and reachable — but the operator has no signal telling them to use it.

### Trace 4 — A merchant exports their orders for GST filing
`export/page.tsx` "Export orders" → `fetch(/api/stores/{store}/orders?limit=100&status=…)` (`:189-190`) → proxy → gateway `GET /orders` returns page 1 of 50-max… → `data.length ≤ 100` rows → CSV built with **no tax columns** (`:205`) and **UTC timestamps** → `downloadCsv` (`:83-91`) → **success toast reporting the truncated count** (`:226-230`).
Every link "works". The outcome is a wrong file presented as a right one.

---

## 5. Gaps

Provisional IDs `G-M-nn`. `[HIGH-STAKES]` = money/payments/refunds/gift cards/payouts/settlements/GST/auth/tenancy/RLS. Confidence reflects the evidence class, not my enthusiasm.

---

### G-M-01 — No alert delivery: every 5xx path ends in `incident.page.dry_run` `[HIGH-STAKES]`
**Domain** Observability/Incident response · **Status** `STUB_OR_MOCK` · **Severity** P0 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Impact** A total payment, checkout, or auth outage produces log lines and a dry-run audit row. Nobody is paged. MTTD is bounded only by a merchant emailing in.
**Evidence** `services/api-gateway/src/lib/runtime-alerting.ts:7` (`RUNTIME_ALERT_JOB_TYPE = 'incident.page.dry_run'`), `:110-176` (planner), `:220-237` (enqueue); `services/queue-workers/src/incident-command.ts:51`, `:90-124` (`mode:'dry_run'`), `:196-205`. Zero `slack|pagerduty|opsgenie` hits across `.github/workflows/*.yml`.
**Expected** A sev1/sev2 5xx on a money route delivers to a real on-call channel within minutes, with acknowledgement.
**Missing link / root cause** No paging adapter was ever implemented; `oncall_schedules.paging_adapter` is read (`incident-command.ts:93`) but no adapter is dispatched.
**Blast radius** Every runtime; every incident.
**Dependencies** G-M-02 (an operator dashboard that could substitute is also blind).
**Remediation approach** Implement one real paging adapter behind the existing `paging_adapter` field, keep `dry_run` as an explicit non-default mode, and make the job type honest (`incident.page`). Fail closed and record a delivery receipt.
**Acceptance criteria** A synthetic sev2 on a staging money route produces a delivery receipt row and a real notification; a missing/misconfigured adapter surfaces as an operator-visible error, never as silence.
**Required tests** unit (adapter selection + fail-closed), integration (queue→adapter→receipt), a staging drill with an evidence artefact.
**Owner** lead engineer + founder (paging vendor is a spend decision).

---

### G-M-02 — Operator ops dashboard reads green from three tables nothing writes `[HIGH-STAKES]`
**Domain** Observability/Operator tooling · **Status** `BROKEN` · **Severity** P0 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Impact** The operator's only queue/health/alert view always renders `DLQ messages 0` and `Firing alerts 0` with a **green success tone**. A real dead-letter storm is indistinguishable from a healthy platform. Violates `ANTI-R9` (`AGENTS.md:322`) on the operations surface itself.
**Evidence** `services/api-gateway/src/routes/operations.ts:481` (`runtime_health_projections`), `:484` (`queue_operation_snapshots`), `:488` (`runtime_alert_evaluations`) — repo-wide search finds **zero writers** for all three (only `update_*_updated_at` triggers in `000_baseline.sql:20210,:20259,:20308` and `tenant-tables.registry.ts` entries). Rendering: `apps/platform-console/src/app/(dashboard)/operations/page.tsx:316-317`, `:337`, `:340-341`, `:355-380`.
**Expected** Either a sampler populates these tables, or the UI renders `NOT CONNECTED` with the exact missing source — never a green zero.
**Missing link / root cause** The read model was built; the sampler/writer never was.
**Blast radius** All operator incident response; the SEV1 runbook step 4 depends on it.
**Dependencies** G-M-01.
**Remediation approach** Two independent changes, in this order: (1) make the UI honest — any panel whose backing array is empty and whose table has no writer renders "Live source not connected: `<table>`", never a success tone; (2) add a scheduled sampler in `queue-workers` that writes `queue_operation_snapshots` from the Cloudflare Queues API and `runtime_health_projections` from a real health probe.
**Acceptance criteria** With no sampler deployed, the console shows NOT CONNECTED for health/queues/alerts. With the sampler deployed, a seeded DLQ message appears in Queue Diagnostics within one sampling interval and the metric tone turns critical.
**Required tests** unit (panel renders NOT CONNECTED on empty+no-writer), integration (sampler writes; overview returns), a staging drill.
**Owner** lead engineer.

---

### G-M-03 — Dual control is a self-typed UUID with no verification `[HIGH-STAKES]` `[IRREVERSIBLE]`
**Domain** Operations/Authorization · **Status** `PARTIAL` · **Severity** P0 · **Likelihood** MEDIUM · **Reversibility** the *control* is reversible; the actions it guards (payout release, suspension, money-break resolution) are not · **Confidence** HIGH
**Impact** A single compromised or malicious operator session satisfies "maker-checker" on `payout.release`, `refund.approve`, `merchant.suspend`, `developer.suspend`, `money.reconciliation.resolve`, `ts.reinstate`, and `runtime.control-command` by typing any UUID other than their own.
**Evidence** `services/api-gateway/src/middleware/rbac.ts:182-207` — the only assertions are presence and `!== actorId`. `secondary_approver_id` is never resolved against `employees`/`super_admin_allowlist` anywhere (20 repo hits, all schema or passthrough). UI: `apps/platform-console/src/app/(dashboard)/money-reconciliation/page.tsx:166` free-text `<Input name="secondary_approver_id">`.
**Expected** The second approver is an authenticated, currently-active, appropriately-permissioned operator who performs an explicit, time-boxed approval in their own session; the approval is recorded immutably.
**Missing link / root cause** No approval-request entity; the field is treated as metadata, not as a control.
**Blast radius** Every money-sensitive operator action.
**Dependencies** G-M-05/G-M-06 (the audit that would detect abuse is also absent/forgeable).
**Remediation approach** Introduce a real two-phase approval: a maker creates a pending request; a distinct authenticated checker approves it in their own session with step-up; the executing call references the approval id, which the gateway verifies for existence, distinctness, active status, permission, and freshness. Never accept a client-supplied approver id as evidence.
**Acceptance criteria** A single operator cannot complete any dual-control action, even with full knowledge of another operator's UUID; an expired or reused approval is rejected; every approval is auditable.
**Required tests** unit (SoD rejects same-actor, unknown actor, inactive actor, expired approval), integration (two-session happy path), a security red-team case.
**Owner** security + ARB.

---

### G-M-04 — Staff-lifecycle audit writes always fail the CHECK constraint and the error is swallowed `[HIGH-STAKES]`
**Domain** Audit/RBAC · **Status** `BROKEN` · **Severity** P0 · **Likelihood** HIGH · **Reversibility** reversible (fix); the lost history is not · **Confidence** HIGH
**Impact** Staff invite, **role change**, and removal produce no audit record. A privilege escalation inside a merchant account is invisible after the fact. The code looks correct, so nobody knows.
**Evidence** `services/api-gateway/src/routes/employee.ts:189` writes `actor_type: 'merchant'`; the table constraint is `CHECK (actor_type = ANY (ARRAY['user','employee','super_admin','system']))` — `database/supabase/migrations/000_baseline.sql:8454`, never altered by any later migration. The insert is wrapped in `try/catch` at `:186-200` with the comment *"an audit failure must never fail the underlying employee mutation"*. Call sites: `:361` `employee.created`, `:467` `employee.invited`, `:580` `employee.updated` (`{updates}`), `:605` `employee.removed`.
**Expected** Every staff mutation writes a durable audit row with a valid actor type; an audit write failure raises an operator-visible alarm rather than being discarded.
**Missing link / root cause** Vocabulary drift between the code's canonical actor taxonomy (`audit-dual-write.ts:3-11` includes `merchant`) and the legacy table's constraint.
**Blast radius** All merchant staff/RBAC history.
**Dependencies** G-M-06, G-M-07.
**Remediation approach** Decide one actor vocabulary. Either widen the constraint via a paired migration+rollback, or map `merchant` → `user` at the write boundary. Then change "best-effort" to "best-effort but observable": on failure emit a structured error metric that a real alert can fire on.
**Acceptance criteria** A staff role change produces exactly one `audit_logs` row with actor, before/after role, IP, UA, and reason; a deliberately invalid audit write produces an error metric.
**Required tests** integration against Postgres asserting the row exists (a mocked insert will not catch this class), plus a validator forbidding actor-type literals not in the constraint.
**Owner** lead engineer.

---

### G-M-05 — No merchant money or security action produces an audit record `[HIGH-STAKES]`
**Domain** Audit · **Status** `NOT_IMPLEMENTED` · **Severity** P0 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Impact** Refunds, payout releases, settlements, gift-card issue/disable, order cancellations, step-up issuance, 2FA changes, KYC submission, GST/tax configuration and payment-credential changes leave no who/when/why/from-where record. Dispute defence, fraud investigation, and any regulator or PA request are unanswerable.
**Evidence** `grep -c audit` = **0** in `routes/{payments,payouts,settlements,orders,returns,wallet,commission,billing,security,two-factor,kyc}.ts`; the 2 hits in `routes/gift-cards.ts` (`:29`, `:170`) are comments. All 20 gateway `audit_logs` writers are operator-scoped (`middleware/rbac.ts:388`, `routes/admin.ts`, `routes/operations*`, `routes/internal-console*`, `lib/internal-*`). `audit_activity_events` has exactly 2 callers, both theme (`theme-execution.adapter.ts:1295,:1500`).
**Expected** Every state-changing merchant action on a money, tax, auth, or tenancy object writes an immutable audit row with actor, action, resource, before/after, reason, IP, UA, request id, and site id.
**Missing link / root cause** Audit was scoped as an operator/compliance feature, not a platform invariant.
**Blast radius** Payments, refunds, payouts, gift cards, GST, auth, staff.
**Dependencies** G-M-06 (integrity), G-M-07 (the built-but-unused canonical writer).
**Remediation approach** Route merchant money/security mutations through the existing canonical audit writer (`prepareCanonicalAuditRow` + hash chain) into `audit_events`, which already carries `site_id`, `request_id`, `correlation_id` and the chain columns. Add a validator asserting audit coverage for a named list of sensitive routes so the gap cannot silently reopen. **Do not** add direct writes to money tables as part of this.
**Acceptance criteria** Every route in the sensitive list produces exactly one audit row per successful mutation, joinable to the request id; a new sensitive route without audit fails CI.
**Required tests** per-route integration assertions; a coverage validator.
**Owner** security + lead engineer.

---

### G-M-06 — `audit_logs` is forgeable, mutable, un-chained, and not tenant-scoped `[HIGH-STAKES]`
**Domain** Audit integrity/RLS · **Status** `PARTIAL` · **Severity** P0 · **Likelihood** MEDIUM · **Reversibility** reversible · **Confidence** HIGH
**Impact** The audit trail is not evidence. Any writer can insert a row attributing any action to any actor; `service_role` (which the gateway uses for everything) can update or delete rows; there is no chain to detect it; and with no `site_id` a merchant can never be shown their own history.
**Evidence** `database/supabase/migrations/000_baseline.sql:8440-8455` (no `site_id`, no `prev_hash`/`seq`/`hash`); `:24380` `CREATE POLICY audit_insert … FOR INSERT WITH CHECK (true)`; `:24387` `ENABLE ROW LEVEL SECURITY` with **no FORCE** anywhere in the migration set; no `BEFORE UPDATE`/`BEFORE DELETE` trigger (`grep "ON public.audit_logs"` returns only 3 indexes + 2 policies).
**Expected** Append-only, tamper-evident, tenant-scoped, FORCE RLS, no blanket-true insert policy.
**Missing link / root cause** `audit_logs` is a baseline-era table; the hardened successor (`audit_events`, `159_…:517-552`) was designed but never adopted (G-M-07).
**Blast radius** All audit evidence.
**Dependencies** G-M-05, G-M-07.
**Remediation approach** Cut over to `audit_events` (it already has `seq`/`prev_hash`/`hash`/`site_id`) rather than patching `audit_logs`; add append-only triggers and FORCE RLS on the target; replace `WITH CHECK (true)` with a role-scoped policy; keep `audit_logs` read-only for history. Paired rollback required.
**Acceptance criteria** An UPDATE or DELETE on the audit table is rejected at the database; a chain-verification query detects a tampered row; a merchant-scoped audit read returns only that site's rows.
**Required tests** Postgres integration (insert/update/delete/tamper), a chain-verification test, an RLS red-team case.
**Owner** security + ARB.

---

### G-M-07 — The tamper-evident audit layer is dead code behind a no-op emitter that reports success `[HIGH-STAKES]`
**Domain** Audit · **Status** `DORMANT_FLAGGED` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Impact** A correct SHA-256 hash-chained audit implementation exists, is exported, and is never called; the boundary that would call it is wired to an emitter that returns `accepted: true` while writing nothing.
**Evidence** `services/api-gateway/src/identity-foundation/audit-dual-write.ts:179-198` (`computeAuditHashChain`), `:200-217` (`prepareCanonicalAuditRow`), `:220-245` (`emitAuditDualWrite`) — zero callers repo-wide, only re-exported at `identity-foundation/index.ts:1`. `identity-foundation/repository-implementations.ts:72` sets `auditEmitter: createNoopAuditEmitter()`; `packages/audit-core/src/index.ts:62-73` returns `{accepted:true, legacyWritten:false, canonicalWritten:false}`. Only `auth-verifier-registry` from this folder is wired into the gateway (`middleware/auth.ts:19`).
**Expected** Either the layer is adopted, or the no-op emitter is renamed and its `accepted: true` corrected so it cannot read as success (ANTI-R9).
**Remediation approach** Adopt it as the writer for G-M-05, and in the interim make `createNoopAuditEmitter` return `accepted: false` with an explicit `reason`.
**Acceptance criteria** No code path can report an audit as accepted without a persisted row.
**Required tests** unit on the emitter contract; a validator forbidding a no-op emitter in a production wiring path.
**Owner** security.

---

### G-M-08 — Merchant CSV export silently truncates at 100 rows and reports success `[HIGH-STAKES]`
**Domain** QA/Data export/GST · **Status** `BROKEN` · **Severity** P0 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Impact** A merchant exporting orders/products/customers for accounting or GST filing receives at most 100 rows and a green "N exported" confirmation. Under-reported turnover filed from a truncated export is a tax exposure the merchant will not detect.
**Evidence** `apps/merchant-control-plane/src/app/[store]/export/page.tsx:151` (products `limit=100`), `:189` (orders `limit: '100'`), `:232` (customers `limit=100`); success toasts `:182-187`, `:226-230`, `:257-261`. No pagination loop, no total check anywhere in the file.
**Expected** Export paginates until exhausted (or streams server-side), and any cap is stated in the UI before download.
**Missing link / root cause** Export reuses the list endpoints' page-1 call with no cursor loop.
**Blast radius** Every merchant with >100 orders/products/customers.
**Dependencies** G-M-09 (same missing pagination consumption).
**Remediation approach** Move export server-side behind a dedicated gateway endpoint that streams the full tenant-scoped result set with an explicit row count; the UI reports the true count and refuses to claim success on a partial result.
**Acceptance criteria** A store with 5,000 orders exports 5,000 rows; a deliberately capped export renders a warning, not a success.
**Required tests** integration on a >100-row fixture asserting row count; a UI test asserting no success toast on truncation.
**Owner** lead engineer (+ CA-tax review of the column set, see G-M-34).

---

### G-M-09 — Merchant list pages have no pagination although the gateway implements it
**Domain** QA/UX · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Impact** A merchant with 51 orders cannot reach order 51. Sorting and filtering apply only to the fetched window, so "highest value order" is wrong. The orders header actively misreports it.
**Evidence** Client caps: `orders/page.tsx:207` (`limit:'50'`), `products/page.tsx:103`, `customers/page.tsx:178`, `coupons/page.tsx:124`, `reviews/page.tsx:116`, `products/inventory/page.tsx:65`, `marketing/page.tsx:229`, `products/purchase-orders/page.tsx:526` (200), `products/transfers`, `products/collections` (200). Gateway capability: `services/api-gateway/src/routes/orders.ts:545`, `:591-592`, `:620-632`. Misleading copy: `orders/page.tsx:616` renders `meta.total` as *"in the current view"* while showing ≤50 rows. Client-only sort over the window: `:432-434`.
**Expected** Server-driven pagination on every list, with an honest "showing X of Y".
**Missing link / root cause** `TableDataProps` has no pagination contract (G-M-13), so each page would have to hand-roll it; 5 of 77 did.
**Blast radius** Orders, products, customers, coupons, reviews, inventory — the merchant's daily surface.
**Remediation approach** Add pagination to the shared `Table` (page/cursor + total + handler), then adopt it. Fix the "current view" copy immediately as a standalone honesty fix.
**Acceptance criteria** A store with 500 orders can reach the last order; sort/filter are server-applied; the count copy matches what is rendered.
**Required tests** component test on the shared table; per-page integration on a >limit fixture.
**Owner** lead engineer.

---

### G-M-10 — Refund idempotency key is randomised on the client, defeating gateway dedupe `[HIGH-STAKES]` `[IRREVERSIBLE]`
**Domain** QA/Payments · **Status** `BROKEN` · **Severity** P1 · **Likelihood** MEDIUM · **Reversibility** a duplicate refund is irreversible without a fresh charge · **Confidence** HIGH
**Impact** Two completed step-ups on the same order produce two distinct idempotency keys and therefore two refunds. Real money leaves the merchant's account twice.
**Evidence** `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:394` — `` idempotency_key: `refund-${refundingOrderId}-${crypto.randomUUID()}` ``. `refundLoading` (`:381`,`:420`) guards only the in-flight window of one component instance.
**Expected** The key is derived from the intent (order + amount + reason), stable across retries, tabs, and reloads; the server is the arbiter.
**Missing link / root cause** The key was written to satisfy the API's required field rather than to express the intent.
**Blast radius** Every refund.
**Dependencies** Agent G owns whether the gateway independently caps cumulative refunds against the order total — if it does, severity drops; if it does not, this is P0. I did not verify that.
**Remediation approach** Derive the key deterministically from the refund intent, disable the confirm control while in flight (G-M-12), and — independently — ensure the server refuses cumulative refunds exceeding the captured amount regardless of key.
**Acceptance criteria** Repeating the same refund intent returns the original refund, not a second one; two different intents on the same order both succeed.
**Required tests** integration (same intent twice → one refund), unit on key derivation, an E2E double-click case.
**Owner** payments lead + security.

---

### G-M-11 — Gift-card disable is a money-affecting destructive action with no confirmation `[HIGH-STAKES]`
**Domain** QA/UX/Gift cards · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** MEDIUM · **Reversibility** re-enable exists, but a customer refused at checkout in the interim is not recoverable · **Confidence** HIGH
**Evidence** `apps/merchant-control-plane/src/app/[store]/products/gift-cards/page.tsx:358-365` — `onClick={() => void changeStatus(row, 'disabled')}` with no `ConfirmDialog`, no typed confirmation, no step-up; only `disabled={statusBusyId === row.id}` (`:360`).
**Impact** A misclick on a dense table row instantly voids an outstanding customer liability. There is also no audit row (G-M-05).
**Expected** A destructive confirmation naming the card and its outstanding balance; ideally step-up, consistent with refund/payout.
**Remediation approach** Wrap in `ConfirmDialog` with `destructive`, showing card last-4 and current derived balance; add an audit record; consider step-up parity.
**Acceptance criteria** Disable requires explicit confirmation showing the balance at risk; the action is audited.
**Required tests** component test asserting no mutation before confirm; integration asserting the audit row.
**Owner** lead engineer.

---

### G-M-12 — `ConfirmDialog` cannot be disabled or shown as loading → systemic double-submit
**Domain** QA/Design system · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** MEDIUM · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `packages/typescript/ui/src/overlays.tsx:496-506` (props), `:530-532` (confirm button with no `loading`/`disabled`), vs `packages/typescript/ui/src/button.tsx:22` (`loading?: boolean` exists).
**Impact** Every confirmed destructive action in both apps — including coupon delete, tax-rate delete, staff removal, order cancel — can be double-fired. Combined with G-M-10 this is a money duplication path.
**Remediation approach** Add `confirmLoading` / `confirmDisabled` to `ConfirmDialogProps`, wire them to the button, and prevent Escape/backdrop dismissal while a confirm is in flight.
**Acceptance criteria** A second click during an in-flight confirm is a no-op; the button shows a loading state.
**Required tests** component test firing two rapid clicks and asserting one handler call.
**Owner** lead engineer.

---

### G-M-13 — The shared `Table` has no error state and no pagination contract
**Domain** QA/Design system · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `packages/typescript/ui/src/table.tsx:48-69` — `loading`, `emptyState`, `emptyMessage`, `savedViews`, `filterChips`, `bulkActions`, `sortKey`, `onSort`, `selectable`; **no `error`, no pagination**.
**Impact** This is the structural root cause of G-M-09 and of the inconsistent error handling in the sample (5 sampled pages have inline-only errors). Every consumer re-derives both, so most skip them.
**Remediation approach** Add `error` + `onRetry` and a pagination contract to the shared table; migrate consumers; add a lint or validator forbidding a data table without an error path.
**Acceptance criteria** A fetch failure inside any migrated list renders a retry affordance without page-specific code.
**Required tests** component tests for loading/empty/error/paginated states.
**Owner** lead engineer.

---

### G-M-14 — Dates render in the runtime timezone, not IST; the only IST-pinned formatter is never used
**Domain** QA/India-first correctness · **Status** `BROKEN` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Impact** Server-rendered merchant pages on a UTC runtime show orders placed after 05:30 IST on the previous calendar day. Day-boundary errors land on order lists, payout dates, coupon expiry, and GST period edges.
**Evidence** `packages/typescript/ui/src/formatting.ts:76-93` (`formatDisplayDate`, no `timeZone`), `:94-105` (`formatIndiaDate`, no `timeZone`), `:152-170` (`formatIndiaDateTime`, `timeZone:'Asia/Kolkata'` at `:167`). Usage in `apps/merchant-control-plane/src`: `formatIndiaDateTime` **0**, `formatIndiaDate(` **21**, `formatDisplayDate` 2. The console does use the pinned one (`apps/platform-console/src/lib/console-api.ts:9`).
**Expected** Every merchant-facing date is rendered in the store's configured timezone (default `Asia/Kolkata`, already stored — `settings/general/page.tsx:86,:232`, `packages/shared-types/src/index.ts:980`).
**Missing link / root cause** The store timezone is captured and never threaded into rendering.
**Blast radius** Every date in the merchant app; GST period boundaries.
**Remediation approach** Pin `timeZone` in the shared date formatters (default `Asia/Kolkata`, overridable from store settings), and add a validator forbidding un-pinned `Intl.DateTimeFormat`/`toLocale*Date*` in app source.
**Acceptance criteria** An order created at 00:30 IST renders as that IST date under `TZ=UTC`.
**Required tests** unit with a forced `TZ=UTC` process; a lint rule.
**Owner** lead engineer (+ CA-tax sign-off on GST period boundaries).

---

### G-M-15 — Eight currency renderings bypass the shared INR formatter with inconsistent minor-unit handling `[HIGH-STAKES]`
**Domain** QA/Money display · **Status** `PARTIAL` · **Severity** P2 · **Likelihood** MEDIUM · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `customers/segments/page.tsx:140` (÷100), `settings/business/page.tsx:181` (no ÷), `settings/shipping/page.tsx:557` (no ÷), `products/collections/page.tsx:541` (no ÷), `products/purchase-orders/page.tsx:344` (unformatted fallback), `access_account/checkout/select-plan/SelectPlanClient.tsx:35,:37,:41` (three variants, one ÷100). Correct path: `formatting.ts:9-35`, used 42 times.
**Impact** Two divide by 100 and four do not; a unit-contract change on any of these fields becomes a 100× display error with no test to catch it.
**Remediation approach** Ban hand-rolled `₹` templates via a lint rule; funnel all money through `formatInrCurrency` with an explicit minor-unit parameter.
**Acceptance criteria** Zero `₹${` templates in app source; a unit test per surface asserting minor→display conversion.
**Owner** lead engineer.

---

### G-M-16 — The design-system governance gate is currently RED (2 hard + 9 ratchet failures)
**Domain** QA/Design system governance · **Status** `BROKEN` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH (executed; **working tree, not clean HEAD**)
**Evidence** Executed `node scripts/validators/validate-design-system.mjs` — full output in §2.5. Baseline `scripts/validators/design-system-baseline.json` (`generatedAt 2026-06-12`). Wiring: `scripts/validate-governance.mjs:21`, `package.json:26`, `.github/workflows/ci.yml:90`.
**Impact** UI-R3 dark-mode reachability fails for `marketing-site` and `developer-portal`; nine ratchet metrics regressed, most sharply `appLocalLbTokenRedefs` 112→339 and `appCssRawHex` 0→156. Directly contradicts `CLAUDE.md`'s "keep the gate green".
**Contributing merchant-surface drift** `apps/merchant-control-plane/src/app/globals.css` — 13,895 lines, 136 app-local `--lb-*` declarations (`:87-94`, `:108-114`, `:163-167`) aliasing canonical tokens onto local `rgb()` values (`:66`,`:101-102`,`:154`,`:172-173`), 492 raw colour literals, 2,660 raw px; plus 202 `rounded-[…]` and 82 inline `style={{` in merchant `.tsx`. This is the LEGACY item named at `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md:259`.
**Secondary finding** `.stylelintrc.cjs` does **not** enforce UI-R7 — it disables `color-function-notation`, `alpha-value-notation`, `custom-property-pattern`, `hue-degree-notation`, `length-zero-no-unit` (`:21-54`) and bans nothing token-related. `AGENTS.md:293`'s "stylelint is wired into CI" is true but does not carry the invariant.
**Remediation approach** Decide whether the regression is intentional (then re-baseline deliberately and record why) or accidental (then burn down before merge). Separately, either move token bans into stylelint or stop describing stylelint as the ratchet.
**Acceptance criteria** `pnpm validate:design-system` exits 0 on the branch that merges.
**Owner** lead engineer + founder (scope call on the burn-down).

---

### G-M-17 — `settings/custom-data` ships a stale "[SKIP - NEEDS BACKEND]" placeholder for a backend that exists
**Domain** QA/Honesty · **Status** `CONTRADICTORY_EVIDENCE` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `apps/merchant-control-plane/src/app/[store]/settings/custom-data/page.tsx:19` asserts *"No `metafields`, `metaobjects`, or custom-data gateway route was found in current services/packages."* But `services/api-gateway/src/routes/metafields.ts` is **501 lines** with `GET|POST /definitions`, `PATCH|DELETE /definitions/:id`, `GET /values`, `PUT /values`, `DELETE /values/:id` (`:278-490`) and is mounted at `services/api-gateway/src/index.ts:799` (`api.route('/metafields', metafieldsRouter)`, imported `:51`).
**Impact** A shipped capability is presented to the merchant as unbuilt, and the placeholder's stated requirement is factually false — this is the exact "documentation drift as product" failure the mission is chartered to find.
**Remediation approach** Build the pane against the existing routes, or at minimum correct the placeholder text. Add a validator that fails when a `BackendNeededPane` names a route that exists in the gateway.
**Acceptance criteria** No shipped pane claims a mounted gateway route does not exist.
**Owner** lead engineer.

---

### G-M-18 — No trace correlation survives the merchant app boundary
**Domain** Observability/Support · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `apps/merchant-control-plane/src/lib/api/client.ts:60` mints a fresh `X-Request-ID` per call and never propagates a client-supplied one; no `X-Trace-ID` is set. Proxies return the body only — `app/api/stores/[store]/orders/[orderId]/refund/route.ts:62`. That one refund makes two `merchantApiFetch` calls (`:26`, `:49`) → two unrelated gateway request ids for one merchant intent. Gateway does echo `X-Trace-ID` (`middleware/observability.ts:222`) — it is discarded.
**Impact** A merchant reporting a failure has no reference; support has no id to search; a single user action cannot be reconstructed from logs.
**Remediation approach** Generate one correlation id per user action in the browser, propagate it through every proxy hop as `X-Trace-ID`, echo the gateway's trace id back to the client, and surface it in error UI as a support reference.
**Acceptance criteria** An error toast shows a reference id that returns the full server-side chain for that action.
**Required tests** integration asserting a single trace id across a multi-hop proxy action.
**Owner** lead engineer.

---

### G-M-19 — The request-log query API cannot filter by request id or trace id, and no UI consumes it
**Domain** Observability/Support · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `services/api-gateway/src/routes/operations.ts:383-408` — filters are `status_code` (`:396-400`) and `site_id` (`:402`) only; `parseListQuery` (`:73-86`) accepts `{status, site_id, queue_name, limit}`. `trace_id` is stored (`:390`) and unqueryable. No consumer in `apps/platform-console/src`, `apps/merchant-control-plane/src`, or `packages/typescript/api-client/src`.
**Impact** The one persisted log store cannot answer "what happened to this request".
**Remediation approach** Add `request_id`, `trace_id`, `path`, `error_code`, and a time-window filter with index support; build a minimal console log search page.
**Acceptance criteria** Given a trace id, an operator retrieves every logged hop within one page load.
**Owner** lead engineer.

---

### G-M-20 — `webhook-service` — the money-critical runtime — has no structured logging or telemetry
**Domain** Observability · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `services/webhook-service/src/index.ts` — 31 unstructured `console.*` calls (`:735`, `:749`, `:758`, `:778`, `:792`, `:826`, `:835`, `:860`, `:888`, `:893`, …); no import of `writeRuntimeTelemetryDataPoint`; no request/trace id generation (`request_id` only as a passthrough at `:144`, `:630`, `:656`). Its `wrangler.toml` binds `RUNTIME_TELEMETRY` (`:61-63`, `:100-102`) and never uses it. Contrast: gateway `middleware/observability.ts:76-88,:150-186`; queue-workers `index.ts:317-350, :434-438`.
**Impact** Razorpay payment/refund webhook processing cannot be correlated with the order it settles, cannot be measured, and cannot trigger the (already dry-run) alert path. CODE-R5 violation.
**Remediation approach** Adopt the gateway's structured-log shape and Analytics Engine emission in `webhook-service`; derive a trace id from the provider event id so provider→order correlation is possible.
**Acceptance criteria** Every webhook invocation emits one JSON log line and one telemetry point carrying `{request_id, trace_id, site_id, provider_event_id, status}`.
**Owner** lead engineer.

---

### G-M-21 — Prometheus/Grafana/OTel observability artifacts describe a stack that is not deployed and metrics that are never emitted
**Domain** Observability · **Status** `STUB_OR_MOCK` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `infrastructure/observability/prometheus-rules.yaml:1-40` alerts on `http_server_errors_total`, `letbuyy_queue_dead_letter_total`, `letbuyy_deployment_health_gate_failed_total`; actual emitted names are `letbuyy.runtime.request` (`middleware/observability.ts:151`), `letbuyy.queue.delivery.batch` and `letbuyy.queue.dead_letter.total` (`queue-workers/index.ts:318,:342`). No Prometheus/Grafana reference exists in `infrastructure/cloudflare/*.tf` or any workflow. `config/runtime/observability-platform.json:20-45` declares four Grafana dashboards with `"mustUseLiveTelemetry": true`.
**Impact** A reader (human or agent) concludes alerting exists. It does not (G-M-01).
**Remediation approach** Either delete/archive these artifacts, or move them behind an explicitly `NOT DEPLOYED` marker naming the exact missing infrastructure — the repository's own live-data law.
**Acceptance criteria** No observability config in the repo asserts a capability that is not deployed.
**Owner** lead engineer.

---

### G-M-22 — A runbook instructs operators to watch a metric that does not exist
**Domain** Operations/Docs · **Status** `CONTRADICTORY_EVIDENCE` · **Severity** P2 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `docs/runbooks/queue-dlq-redrive.md:5` — *"Watch `cloudflare.queue.delivery.lag`, dead-letter growth, and `queue_operation_snapshots`."* `cloudflare.queue.delivery.lag` appears nowhere in the repository; `queue_operation_snapshots` has no writer (G-M-02).
**Remediation approach** Rewrite runbook observation steps against metrics that are actually emitted, and mark the rest NOT CONNECTED.
**Owner** lead engineer.

---

### G-M-23 — All four ART-24 operator gates are absent from `apps/platform-console` `[HIGH-STAKES]`
**Domain** Operations/Governance · **Status** `NOT_IMPLEMENTED` · **Severity** P0 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Impact** LetBuyy cannot operate merchant payments from the console designated to operate them. It also blocks `ART-24`/`ARCH-R10` deletion of `apps/platform-operations-portal`, keeping two ops consoles alive against `ANTI-R1`/`R-15`.
**Evidence** Full matrix in §3.7. Refund: no console page/action (`grep -ri refund apps/platform-console/src` → one filter keyword at `audit-logs/page.tsx:321`). Maker-checker merchant payout: absent; `developers/page.tsx:536-543` is read-only partner payouts with *"contact the finance team"*. Dispute log: absent (only developer payout disputes, in the frozen `platform-operations-portal/(dashboard)/developers/page.tsx:79-110,:291-330`). KYC queue: absent, and **no operator KYC endpoint exists in the gateway**. Governance: `LETBUYY_CONSTITUTION.md:301-302`, `AGENTS.md:95`, `LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md:129-132`.
**Missing link / root cause** The ops-console consolidation stopped after the survivor decision; the sliver was never migrated.
**Remediation approach** Build the four gates in `platform-console` against real endpoints — refund and merchant payout on top of G-M-03's two-phase approval, a KYC review queue over `merchant_kyc_documents`, and a dispute log over `chargeback_events` (G-M-24). Then run the `GATE-OPS-SURVIVOR` smoke path before any deletion.
**Acceptance criteria** Each of the four gates is exercisable end-to-end in staging with a recorded audit trail and dual control where required.
**Owner** founder + ARB (scope), lead engineer (build).

---

### G-M-24 — Payment disputes/chargebacks are entirely unimplemented despite a full table `[HIGH-STAKES]`
**Domain** Payments/Operations · **Status** `NOT_IMPLEMENTED` · **Severity** P1 · **Likelihood** MEDIUM · **Reversibility** reversible; a lost dispute window is not · **Confidence** HIGH
**Evidence** `database/supabase/migrations/124_internal_os_risk_detection.sql:212-257` defines `chargeback_events` with FKs to `orders`/`sites`, indexes, RLS and a status CHECK — and the only TypeScript references repo-wide are `tenant-tables.registry.ts:500` and `services/api-gateway/src/__tests__/internal-os-risk.test.ts:48`. `services/webhook-service/src/index.ts:781-893` handles `payment.captured`, `payment.failed`, `refund.created`, `payment.authorized` — no `payment.dispute.*` case.
**Impact** A Razorpay dispute arrives and is dropped. No merchant notification, no operator queue, no evidence-submission deadline tracking. Under the never-custody model the merchant is merchant-of-record and bears the loss with no tooling.
**Remediation approach** Handle the provider dispute webhook, persist to `chargeback_events`, notify the merchant, and expose an operator dispute log (part of G-M-23).
**Acceptance criteria** A sandbox dispute event produces a `chargeback_events` row, a merchant notification, and an operator-visible entry with the response deadline.
**Owner** payments lead + payments-provider (webhook enablement) + founder.

---

### G-M-25 — The support ticket system exists only in the frozen non-survivor console
**Domain** Operations/Support · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** Backend is real and audited: `services/api-gateway/src/routes/operations/support.ts:338-750` over `support_tickets`, `ticket_messages`, `ticket_sla_clocks`, `ticket_csat`, `ticket_macros`, with `audit_logs` writes (`:162`) and fraud/chargeback auto-escalation (`:312`). UI exists only at `apps/platform-operations-portal/src/app/(dashboard)/{support,tickets}/page.tsx` — the fold-then-delete loser. `apps/platform-console` has no support page; its only view is a read-only 10-row panel inside Merchant 360 (`internal-console.ts:1056-1062` → `merchants/[id]/page.tsx:236`).
**Impact** Deleting the non-survivor (as ART-24 requires) removes the only support UI. Today an operator cannot open or reply to a ticket from the survivor.
**Remediation approach** Migrate the support workspace into `platform-console` as part of the ART-24 fold.
**Owner** lead engineer.

---

### G-M-26 — Merchants have no in-app support entry point
**Domain** Support readiness · **Status** `NOT_IMPLEMENTED` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `grep -ri "support|helpdesk|contact support"` over `apps/merchant-control-plane/src/components` and `settings/page.tsx` returns only marketing copy: `TrialBanner.tsx:67` ("Priority support"), `FoundingMerchantCard.tsx:77` (a badge), `ThemeUpdatePanel.tsx:520` ("Contact support or wait…", with no link). No help menu, no ticket form, no email link, no chat.
**Impact** The plan sells "Priority support" and the product provides no way to reach it. Combined with G-M-18, a merchant cannot report a failure with any usable detail.
**Remediation approach** Add a help entry point that creates a `support_tickets` row via the existing backend, pre-filled with store id, current route, and the correlation id from G-M-18.
**Acceptance criteria** A merchant can raise a ticket in ≤2 clicks and the operator sees it with the trace id attached.
**Owner** founder (support model) + lead engineer.

---

### G-M-27 — The money reconciliation job covers only the oldest 100 sites and alerts nobody on mismatch `[HIGH-STAKES]`
**Domain** Operations/Reconciliation · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** MEDIUM (rises to HIGH past 100 sites) · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `services/queue-workers/src/money-ledger-reconciliation.ts:26-30` (`batchLimit` default 100, cap 500), `:54-59` (`sites` ordered `created_at` ascending, `.limit(batchLimit)`), `:73-75` (RPC per site), `:96-104` (returns counts). `services/queue-workers/src/index.ts:638-651` writes the result to a log line only — no audit row, no incident, no alert. Cron `wrangler.toml:17` `"17 */6 * * *"`. RPC: `database/supabase/migrations/160_foundation_money_ledger_authority.sql:198-256`.
**Impact** Past 100 merchants, the newest merchants are never reconciled — silently, forever. And a detected `variance_minor ≠ 0` on any merchant reaches no human unless someone happens to open the console page.
**Remediation approach** Cursor the site scan so coverage is complete across runs and record the cursor; on any mismatch, raise a real incident/alert (which requires G-M-01) and write an audit record. Surface `recon_breaks` in the console alongside `money_ledger_site_reconciliations`.
**Acceptance criteria** Every non-deleted site is reconciled within a bounded window; a seeded variance produces an operator-visible alert within one cycle.
**Required tests** integration with >100 site fixtures asserting full coverage across runs; a mismatch-alert test.
**Owner** payments lead + lead engineer.

---

### G-M-28 — Backup is pre-migration-only with 7-day retention; PITR is off; restore is never proven `[HIGH-STAKES]`
**Domain** Operations/Recovery · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** MEDIUM · **Reversibility** **IRREVERSIBLE data loss** if it bites · **Confidence** HIGH
**Evidence** `.github/workflows/production-deploy.yml:252-268` — real `pg_dump` + gpg + sha256, `retention-days: 7` (`:267`). No scheduled backup workflow (only `branch-lag-monitor`, `full-security-audit`, `hot-table-partition-maintenance` have `schedule:`). `config/runtime/database-recovery-policy.json` — PITR `"human-required-paid-tier"`, `SKIP-W0-PITR-TIER`, `defaultEnabledByCodex: false`; RPO/RTO listed as *pending* evidence, i.e. **undefined**. `scripts/governance/foundation-restore-drill.mjs:13-18` refuses any non-localhost target; policy sets `"codexDefaultMode":"plan"`.
**Impact** With no PITR and no scheduled dump, the worst-case data loss is "everything since the last production migration deploy". With 7-day artifact retention, a corruption discovered on day 8 has no backup at all.
**Missing link / root cause** PITR is a paid-tier decision that was explicitly deferred to a human and never taken.
**Remediation approach** Founder decision on the PITR tier; add a scheduled encrypted dump independent of deploys with a retention that matches a stated RPO; write down RPO/RTO; run one human restore drill into an isolated environment and record the evidence.
**Acceptance criteria** A written RPO/RTO exists; a restore drill has been executed and evidenced at least once; a backup exists that is not tied to a deploy.
**Owner** founder (tier/spend) + lead engineer (execution).

---

### G-M-29 — R-23 migration↔rollback pairing is unenforced; 78 of 126 migrations have no rollback
**Domain** Operations/Governance · **Status** `PARTIAL` · **Severity** P1 · **Likelihood** MEDIUM · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `find database/supabase/migrations -name "*.sql" | wc -l` → **126**; `find database/supabase/rollback -name "*.sql" | wc -l` → **48**. Unpaired includes `000_baseline` and the entire `073`–`091` range. `RUNTIME_OBSERVATION`: `node scripts/validators/rollback-integrity-validator.mjs` → *"passed (3 rollback manifests checked)"*, exit 0 — reading `:9-40` shows it validates `config/runtime/deployment-lineage-manifest.json` and fragments of `production-rollback.mjs`, never the two directories. `grep -rln "rollback.sql" scripts/` → three unrelated validators. Rule: `LETBUYY_CONSTITUTION.md:424` (R-23), gate promised at `:152` (ART-02).
**Impact** A bad schema change on an unpaired migration has no scripted reverse path — under an incident, with no PITR (G-M-28).
**Remediation approach** Add the pairing validator the Constitution already promises, with an explicit, dated, ARB-approved exemption list for historical migrations; require a paired rollback for every new migration.
**Acceptance criteria** CI fails on a new migration without a rollback; the exemption list only shrinks.
**Owner** ARB + lead engineer.

---

### G-M-30 — `foundation-observability.ts` is dead code with a green test suite
**Domain** Observability/Test integrity · **Status** `DORMANT_FLAGGED` · **Severity** P2 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `services/api-gateway/src/lib/foundation-observability.ts:37-99` exports `createFoundationTraceContext`, `redactFoundationLogFields`, `foundationStructuredLog`, `appendAuditRelayEnvelope`, `createMetricsRegistry` — the only importer repo-wide is `services/api-gateway/src/__tests__/observability.test.ts`. `RUNTIME_OBSERVATION`: that suite passes 8/8, including two tests over this module. No `audit_relay` consumer exists anywhere.
**Impact** Passing tests over unused code inflate the perceived observability posture.
**Remediation approach** Adopt it (it is the natural home for G-M-18's correlation context) or delete it under the deletion gates; do not keep a green suite over dead code.
**Owner** lead engineer.

---

### G-M-31 — Zero accessibility testing; the contrast validator that exists has zero callers
**Domain** QA/Accessibility · **Status** `NOT_IMPLEMENTED` · **Severity** P2 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** Repo-wide search for `axe`, `jest-axe`, `@axe-core`, `wcag` across `tests/`, `packages/typescript/ui/src`, `scripts/validators` → **zero** hits. `packages/typescript/ui/src/tokens.ts:1226-1257` implements `validateLetbuyyBrandContrast` (real relative-luminance ratio at `:1207-1224`, 4.5:1/3:1 thresholds) and is **never invoked** in `apps/`, `services/`, `tests/`, or `scripts/`, despite merchants being able to set brand colours (`createLetbuyyBrandVariables`, `:1259+`).
**Impact** UI-R4 ("MUST meet WCAG AA") and "no migration may regress accessibility" have no enforcement. A merchant can pick a brand colour that renders their own admin unreadable.
**Remediation approach** Call `validateLetbuyyBrandContrast` at the brand-save boundary and block or warn; add axe checks to component tests for the shared primitives; extend the contrast check beyond the three brand tokens to the base palette in both themes.
**Acceptance criteria** A low-contrast brand colour is rejected or warned at save; a11y assertions run in CI for the shared primitives.
**Owner** lead engineer + design.

---

### G-M-32 — The shared data table lacks `scope`, `aria-sort`, and an accessible name
**Domain** QA/Accessibility · **Status** `PARTIAL` · **Severity** P2 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `packages/typescript/ui/src/table.tsx:303-338` — `<table>` with no `aria-label`/`<caption>` prop, `<th>` without `scope="col"` (`:313-336`), sortable headers with no `aria-sort`.
**Impact** Screen-reader users cannot determine sort state or column association across every merchant list. (Defect asserted; no WCAG conformance verdict claimed.)
**Remediation approach** Add `scope="col"`, `aria-sort` bound to `sortKey`/`sortDirection`, and a required accessible-name prop.
**Owner** lead engineer.

---

### G-M-33 — No search debouncing on five list pages, against a KV-quota-limited rate limiter
**Domain** QA/Performance/Operations · **Status** `PARTIAL` · **Severity** P2 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** Zero `debounce`/`setTimeout` in `orders/page.tsx` (fetch deps `:231`, effect `:233`), `customers/page.tsx`, `products/page.tsx`, `products/inventory/page.tsx`, `products/collections/page.tsx`. Operational context: `services/api-gateway/wrangler.toml` production vars document `RATE_LIMIT_KV_FALLBACK = "on"` with the in-file warning that each limited request costs one KV write against a daily quota, because Upstash is not provisioned.
**Impact** Type-ahead is the fastest path to exhausting the production rate-limiter's KV write quota, which previously caused blanket `503 RATE_LIMIT_UNAVAILABLE` on every `/v1` data route (per the same comment).
**Remediation approach** Debounce (250–350 ms) + abort in-flight requests on every search input; independently, provision the intended Redis backend.
**Owner** lead engineer + founder (Upstash spend).

---

### G-M-34 — CSV export: no formula-injection guard, no GST columns, no BOM, no date range `[HIGH-STAKES]`
**Domain** QA/Security/GST · **Status** `PARTIAL` · **Severity** P2 (P1 if merchants file from these exports) · **Likelihood** MEDIUM · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `apps/merchant-control-plane/src/app/[store]/export/page.tsx:93-101` (`toCsvRow` quotes only `,`/`"`/`\n`; no `=`/`+`/`-`/`@` neutralisation), `:205` (orders header — no tax/invoice/HSN/currency/order id), `:83-91` (`downloadCsv` — no BOM; `revokeObjectURL` immediately after `click()`), `:190-191` (only `statusFilter`, no date range), `created_at` emitted raw ISO (UTC).
**Impact** A malicious product or customer name executes as a formula in the merchant's Excel; the export is unusable for GST filing; regional-script names can mangle.
**Remediation approach** Prefix-neutralise leading `=+-@`, add a UTF-8 BOM, include tax/invoice/HSN/currency/id columns, render timestamps in the store timezone, and add a date range. Overlaps with G-M-08's server-side export.
**Owner** lead engineer + CA-tax (column set).

---

### G-M-35 — `platform-console` has no `loading.tsx`, `error.tsx`, or `not-found.tsx`
**Domain** QA/UX · **Status** `PARTIAL` · **Severity** P2 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `find apps/platform-console/src/app -name "loading.tsx" -o -name "error.tsx" -o -name "not-found.tsx"` → **empty**. Server-action throws such as `money-reconciliation/page.tsx:76-78` escape to Next's default error screen. `ConsoleApiErrorPanel` (`components/ConsoleDataTable.tsx:144-151`) has no retry. UI-R3 requires error-with-retry.
**Impact** An operator mid-incident hits an unstyled framework error page.
**Owner** lead engineer.

---

### G-M-36 — UI-R6 provider-mode badge missing on payouts and gift cards
**Domain** QA/Provider honesty · **Status** `PARTIAL` · **Severity** P2 · **Likelihood** MEDIUM · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `ProviderModeBadge` is used only in `settings/payments/page.tsx`, `settings/shipping/page.tsx`, `orders/page.tsx`, and `components/billing/BillingPaymentMethods.tsx`. `payouts/page.tsx` and `products/gift-cards/page.tsx` contain no `provider_mode`/`sandbox`/`ProviderMode` reference. `RUNTIME_OBSERVATION`: `node scripts/validators/provider-mode-badge-validator.mjs` → *"passed"* — reading it (`:91-160`) shows it asserts source **fragments** (e.g. that a page does not fall back to `'mock'`), not surface **coverage**. Rule: `AGENTS.md:293` UI-R6 ("every money/fulfillment surface").
**Impact** Payouts is the single highest-stakes money surface a merchant sees; it does not disclose provider mode. Credit: `settings/business/page.tsx:434` *does* render an honest sandbox notice for KYC.
**Remediation approach** Extend the validator from fragment checks to a coverage check over a declared list of money/fulfillment surfaces; add the badge to payouts and gift cards.
**Owner** lead engineer.

---

### G-M-37 — The merchant dashboard renders upstream failure as ₹0 under an "info" banner
**Domain** QA/Honesty · **Status** `PARTIAL` · **Severity** P2 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `apps/merchant-control-plane/src/app/[store]/dashboard/page.tsx:206-249` (per-call `.catch(() => null)` inside a `try/catch` returning `emptyDashboardHomeData()`), `:252-264` (zeros), `DashboardClient.tsx:585-589` (`<Banner variant="info" title="Analytics are still warming up">`).
**Impact** A gateway outage and a new store look identical on the merchant's landing page, and the outage is described as normal warm-up.
**Remediation approach** Distinguish "no data yet" from "could not load"; render a critical banner with retry for the latter.
**Owner** lead engineer.

---

### G-M-38 — Console correlation id is a timestamp string, not a unique id
**Domain** Observability · **Status** `PARTIAL` · **Severity** P2 · **Likelihood** MEDIUM · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `apps/platform-console/src/lib/console-api.ts:69` — `'X-Request-ID': \`platform-console-${Date.now()}\``. Concurrent calls within the same millisecond collide; the value is not a UUID.
**Related, worth a separate look by Agent F/A** the console authenticates to the gateway with a single shared `PLATFORM_CONSOLE_API_TOKEN` (`:55-58`), so the gateway attributes every operator action to one principal and relies on a client-supplied `actor_id` in the body (`money-reconciliation/page.tsx:87`) for identity. That is an audit-attribution weakness compounding G-M-03.
**Owner** lead engineer (id) + security (token model).

---

### G-M-39 — Client-side merchant errors have no sink
**Domain** Observability · **Status** `NOT_IMPLEMENTED` · **Severity** P2 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `apps/merchant-control-plane/src/app/error.tsx:14-16` (`console.error` only); no error-reporting integration in any production source (the only `Sentry` hits are `apps/marketing-site/src/lib/legal/content/data.ts:340` — a privacy-policy string that **claims** Sentry is in use — and `.next/` build artifacts).
**Impact** Client crashes are invisible. The privacy policy describing an error monitor that does not exist is itself a disclosure inaccuracy worth a compliance look.
**Owner** lead engineer + founder (vendor/spend).

---

### G-M-40 — `shipping_rates.price` is a rupee decimal, not `bigint` minor units `[HIGH-STAKES]`
**Domain** Money units (cross-domain: Agent G / shipping) · **Status** `PARTIAL` · **Severity** P2 (recorded here; owner should re-severity) · **Likelihood** MEDIUM · **Reversibility** reversible · **Confidence** MEDIUM (I verified the conversion site, not the column type)
**Evidence** `services/api-gateway/src/routes/shipping.ts:140` — `amount_minor: Math.round(Number(rate.price || 0) * 100)`, proving `price` is a rupee-scale value; UI renders it unmultiplied at `settings/shipping/page.tsx:557` and parses it with `parseFloat` at `:324`. Rule: ART-10/R-5 — money is `bigint` minor units everywhere.
**Impact** Float money in a shipping cost that flows into an order total; a rounding boundary at every quote.
**Remediation approach** Owner (Agent G / payments lead) to confirm the column type and migrate to `*_minor bigint` with a paired rollback.
**Owner** payments lead + ARB.

---

### G-M-41 — E2E merchant journey tests default to staging and skip themselves; no runner is wired
**Domain** QA/Test integrity · **Status** `STUB_OR_MOCK` · **Severity** P1 · **Likelihood** HIGH · **Reversibility** reversible · **Confidence** HIGH
**Evidence** `tests/e2e/merchant-journey.spec.ts:3-7` (URLs default to `*-staging.letbuyy.com`), `:9-13` (`requireReachable` → `test.skip` when unreachable or ≥500). No `test:e2e` script in root `package.json` (`@playwright/test` is only a devDependency at `:143`); no workflow invokes Playwright. Root `test` (`:107`) runs `tests/*/*.test.mjs` — `.spec.ts` files are not matched.
**Impact** There is no executed end-to-end coverage of any merchant journey. Every "works" claim in this repository about a merchant flow rests on structural assertions. This is why nothing in this report can exceed `IMPLEMENTED_NOT_RUNTIME_VERIFIED`.
**Remediation approach** Add an e2e runner against an ephemeral local stack; make unreachability a **failure**, not a skip, in CI.
**Acceptance criteria** CI runs at least one merchant journey against a real stack and fails when the stack is down.
**Owner** lead engineer.

---

## 6. Contradictions

1. **`CLAUDE.md` claims the validator gate is kept green; the design-system validator fails with 11 errors** on this working tree (§2.5). `CONTRADICTORY_EVIDENCE`. I cannot distinguish "the user's uncommitted work introduced it" from "it has been red at HEAD" without a clean checkout, which I did not perform.
2. **`AGENTS.md:293` (UI-R7) says stylelint is the wired CI ratchet**; `.stylelintrc.cjs:21-54` disables the relevant rules and bans nothing token-related. The real ratchet is `validate-design-system.mjs`. `CONTRADICTORY_EVIDENCE`.
3. **`settings/custom-data` says no metafields route exists**; `routes/metafields.ts` (501 lines) is mounted at `index.ts:799`. `CONTRADICTORY_EVIDENCE` (G-M-17).
4. **Migration count.** The commander's brief states 187 `.sql` migrations, max number 195. My `find` returns **126** files in `database/supabase/migrations`. Highest-numbered file I cited is `161_foundation_session_security.sql`; I also saw `195` referenced in the brief but did not locate it. Unresolved — recorded as-is, not reconciled.
5. **`infrastructure/observability/*` describes a Prometheus/Grafana/OTel stack with `mustUseLiveTelemetry: true`**; no such stack is deployed and the metric names do not match emission. `CONTRADICTORY_EVIDENCE` (G-M-21).
6. **`docs/runbooks/incident-sev1.md` and `queue-dlq-redrive.md` direct operators to data sources with no writers** (G-M-02) and a metric that does not exist (G-M-22). Documented procedure vs. actual capability.
7. **`apps/marketing-site` legal copy states Sentry is used for error monitoring** (`src/lib/legal/content/data.ts:340`); no Sentry integration exists in any production source (G-M-39). A published privacy statement describing a processor that is not in use — flagged for compliance, not resolved by me.
8. **The prior run's Agent M notes** (same run directory, written 2026-08-04 23:40) claim `settings/notifications` is "the only page with any pagination" and that the console is "far worse on dark/light mode". Both are **wrong**: five merchant pages paginate (§2.1) and the console has a full theme provider plus a `ThemeToggleButton` (`(dashboard)/layout.tsx:73`). Corrected here.

---

## 7. Unknowns (honest)

- **Whether any of this is true at runtime.** No service was started. Every status is `IMPLEMENTED_NOT_RUNTIME_VERIFIED` or lower, except the validator/test executions explicitly tagged.
- **Whether the design-system regression exists at clean `ee371182`.** I measured the working tree with ~6,784 modifications.
- **Whether Analytics Engine data is actually being written in production.** The bindings, datasets, and emission code all exist. Verifying data arrival requires Cloudflare credentials — `BLOCKED_EXTERNAL`.
- **Whether the step-up `jti` is consumed to prevent replay.** The token format includes `jti` (`security-controls.ts:41`); I did not trace consumption. Agent G's scope.
- **Whether the gateway independently caps cumulative refunds** against the captured amount. This determines whether G-M-10 is P1 or P0. Agent G's scope.
- **`shipping_rates.price` column type.** I inferred rupee scale from the `* 100` conversion at `shipping.ts:140`, not from the DDL.
- **Actual mobile rendering at 360px.** Structurally handled (`table.tsx:238-301`, `AdminShell.tsx:114-130`); not observed.
- **Real contrast ratios of the shipped `--lb-*` palette in both themes.** The checker covers three brand tokens only and is never called; I did not compute the base palette by hand.
- **Whether any production incident has ever been recorded.** `production_incidents` is written only by an explicit operator POST; I have no visibility into whether that has occurred.
- **Console page count vs. the operator's real workflow.** I sampled 10 of 24; the 14 unsampled pages may contain gates I concluded were absent. My §3.7 conclusion rests on repo-wide greps for `refund`/`kyc`/`dispute`/`maker`, which is strong but not the same as reading all 24.

---

## 8. Blockers

- **`BLOCKED_EXTERNAL` — runtime verification.** Confirming that alerts, telemetry, audit rows, or DLQ counters behave as coded requires starting services and/or provider credentials (Cloudflare Analytics Engine, Supabase). Out of bounds for this phase.
- **`BLOCKED_EXTERNAL` — PITR / backup tier.** `config/runtime/database-recovery-policy.json` marks PITR `human-required-paid-tier` (`SKIP-W0-PITR-TIER`). A founder spend decision, not an engineering one (G-M-28).
- **`BLOCKED_EXTERNAL` — paging vendor.** G-M-01 cannot be closed without choosing and funding a paging destination.
- **`BLOCKED_EXTERNAL` — Razorpay dispute webhook enablement.** G-M-24 needs the provider-side event subscription, which requires provider account access.
- **`BLOCKED_EXTERNAL` — Upstash/Redis provisioning.** The production rate limiter is on a documented temporary KV fallback with a daily write quota (`services/api-gateway/wrangler.toml`, production vars). This bounds G-M-33's remediation.
- **ARB decision required** before G-M-06 (audit table cutover), G-M-29 (pairing validator + exemption list), and G-M-23 (ops-console fold scope).

---

## 9. What is genuinely good (so remediation does not damage it)

Recording this deliberately: the gaps above are real, and so is this.

- `packages/typescript/ui/src/overlay-hooks.ts:31-140` — the focus trap with ancestor-chain `inert` isolation and restore is better than most production design systems ship.
- `packages/typescript/ui/src/overlays.tsx` — dialog roles, `aria-modal`, `useId`-derived labelling, Escape + outside-pointer dismiss, portal theme mirroring with a `MutationObserver` (`:41-63`) so overlays follow the theme toggle.
- `services/api-gateway/src/middleware/observability.ts` — the emission side is careful, deliberate, and correct: trace propagation, status-derived log level, a sampling policy that never drops errors/auth/payment/admin/authenticated requests, three sinks, all failures wrapped in `waitUntil` with their own error logs.
- `services/api-gateway/src/lib/runtime-alerting.ts` — severity classification with a money-path bias, dedupe keys, and a secret-shaped-key redactor (`:13`, `:68-89`) that also scrubs `SKIP_NEEDS_HUMAN_*` markers.
- `services/api-gateway/src/lib/security-controls.ts` — real HMAC step-up with `jti`, `exp`, and a `configuredSecret` guard that rejects placeholder secrets. The governance concern about a "string-length step-up" is remediated.
- `apps/platform-console/src/app/(dashboard)/audit-logs/page.tsx` — server pagination, three filters, and an **honest aggregate-gap flag** (`:66`). This is the pattern every other page should copy.
- Token discipline in merchant page code: **6** Tailwind palette classes across all `.tsx` in `apps/merchant-control-plane/src`, 5 of them in a redirect shim. The drift is in `globals.css`, not in the product surface.
- `apps/merchant-control-plane`'s state coverage: 20 of 22 sampled pages carry a real skeleton→empty→error→retry triad. That is unusually high and should not be lost in any refactor.
