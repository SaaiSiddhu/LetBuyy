# AGENT B — Merchant Control-Plane UI and Navigation Audit

Run: `docs/merchant-system-discovery/2026-08-04T225330+0530-bf35062e`
Repo: `/Users/saai_siddharth/Projects/Start_Up/Letbuyy_Store` · Branch `stepup/main` · Commit `bf35062e`
Scope: `apps/merchant-control-plane` (web merchant OS) + navigation/IA; `apps/mobile/merchant-app` (Flutter) inventoried separately at route/screen level.

**Method disclosure.** Everything below is STATIC CODE READING plus deterministic scripted analysis of the source tree. I did NOT run the app, did NOT build it, did NOT hit any endpoint, and did NOT observe any runtime behavior or persistence. Therefore **nothing in this report is `VERIFIED_E2E`**; the strongest status I use for working code is `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. Where I say a page "renders" something I mean the JSX unconditionally emits it, not that I saw it on screen.

Governance read before inspecting: `apps/merchant-control-plane/AGENTS.md` (hand-authored, subordinate to root; no additional UI law beyond boundary/import rules).

---

## 0. Executive summary of this domain

The merchant control plane is, structurally, in **much better shape than a typical pre-launch admin**: 77 pages, 130 same-origin proxies, **zero dead navigation links**, **zero direct database access** (no `supabase`/`createClient`/service-role import anywhere in `src/` outside the API-proxy layer — verified by grep), a genuine typed gateway client (`src/lib/api/client.ts`), a real TOTP step-up dialog on refunds and payouts, and a strong honesty culture (`BackendNeededPane`, `NOT-CONNECTED` badge on Liquid, sandbox banner on campaign send, archived dead-code contract tests).

The defects that matter are **not** "the UI is fake". They are:

1. **A handful of specific dead/no-op affordances that sit on the highest-value paths** — the trial-banner "Select a plan" CTA is `href="#"` + `preventDefault()` (revenue), the setup-assistant queries an endpoint that does not exist (onboarding), and the AI Studio badges six capabilities "Available" with no way to invoke any of them.
2. **Silent data truncation in the bulk export** at 100 rows with a green success toast.
3. **Unbacked monetary promises rendered inside the paid-plan checkout** (₹1,500 credit, bonus AI credits) with no implementation anywhere in the repo.
4. **Provider-mode honesty badge coverage is partial** — present on payments/shipping/billing/fulfilment, absent on the refund panel, payouts and gift cards.
5. **Whole merchant capabilities exist in the gateway and in the Flutter app but have no web surface at all** — returns/RMA, GST tax invoice, shipping labels, packing slips.
6. **51 `--lb-*` design tokens are referenced but never defined** (four of them are explicitly deleted by the token layer at runtime), so a set of pages render borders/text/font-sizes from CSS fallbacks rather than the design system.
7. **No permission gating anywhere in the UI** — web *or* Flutter — despite both shipping a role/permission catalogue.

---

## 1. Complete route inventory — `apps/merchant-control-plane/src/app`

**77 `page.tsx` files** (matches commander's count). Nav column derived from `path:` literals in `src/components/merchantNavigation.ts` + `href:` literals in `src/components/settings/settings-navigation.ts`. `lines` = total .tsx LOC in that route folder (page + colocated client components).

Evidence type for the whole table: `UI_CODE` + `PROXY_CODE`.

| # | URL route | LOC | In nav (site types) | Primary data source |
|---|-----------|-----|---------------------|---------------------|
| 1 | `/[store]/access_account/checkout/checkout` | 796 | — (reached from select-plan / settings/plan) | `/api/subscribe`, `/api/subscribe/coupon`, `/api/subscribe/verify` |
| 2 | `/[store]/access_account/checkout/select-plan` | 514 | — (reached from `settings/plan:273`) | `apiClient.payments.plans`, `apiClient.payments.subscription.get`, `apiClient.foundingProgram.remaining` |
| 3 | `/[store]/ai` | 352 | store (Marketing → AI Studio) | `/api/stores/:s/ai` (GET only) |
| 4 | `/[store]/analytics` | 314 | store/portfolio/resume/landing/blog | `/api/stores/:s/analytics?period=` |
| 5 | `/[store]/appearance` | 465 | portfolio/landing/blog | `/api/stores/:s/settings` |
| 6 | `/[store]/apps` | 98 | all (nav item "Add", `g x`) | `apiClient.appStore.installations` |
| 7 | `/[store]/apps/[installationId]` | 29 | — (detail) | `apiClient.appStore.embedSession`, `.extensionRegistry` |
| 8 | `/[store]/categories` | 488 | store (Products→Categories), blog | `/api/stores/:s/categories` |
| 9 | `/[store]/certifications` | 508 | resume | `/api/stores/:s/content/certifications` |
| 10 | `/[store]/comments` | 412 | store (Content), blog | `/api/stores/:s/blog-comments` |
| 11 | `/[store]/contact` | 434 | portfolio (nav label "Marketing") | `/api/stores/:s/form-submissions?type=contact` |
| 12 | `/[store]/coupons` | 601 | store (Marketing group parent) | `/api/stores/:s/coupons` |
| 13 | `/[store]/customers` | 411 | store | `/api/stores/:s/customers` |
| 14 | `/[store]/customers/[email]` | 694 | — (detail) | `/api/stores/:s/customers/:email`, `.../notes` |
| 15 | `/[store]/customers/segments` | 753 | store | `/api/stores/:s/customers/segments`, `/preview` |
| 16 | `/[store]/dashboard` | 1214 | all (`g h`) | server-side `apiClient.analytics.*`, `.orders.list`, `.products.list`, `.shipping.zones.list`, `.stores.paymentConfig.get` |
| 17 | `/[store]/education` | 498 | portfolio/resume | `/api/stores/:s/content/education` |
| 18 | `/[store]/experience` | 502 | resume | `/api/stores/:s/content/work_experience` |
| 19 | `/[store]/export` | 481 | store (Products→Export and import) | `/api/stores/:s/products`, `/orders`, `/customers`, `/products/import` |
| 20 | `/[store]/gallery` | 359 | **portfolio ONLY** | `/api/stores/:s/media` |
| 21 | `/[store]/leads` | 436 | landing | `/api/stores/:s/form-submissions?type=lead` |
| 22 | `/[store]/login` | 31 | — | none (client redirect to accounts) |
| 23 | `/[store]/marketing` | 783 | store (Marketing→Campaigns) | `/api/stores/:s/marketing/campaigns*` |
| 24 | `/[store]/online-store` | 17 | store (`g t`) | none — client redirect to `/online-store/themes` |
| 25 | `/[store]/online-store/pages` | 831 | store | `/api/stores/:s/pages`, `/policies`, `/navigation` |
| 26 | `/[store]/online-store/preferences` | 334 | store | `/api/stores/:s/settings` |
| 27 | `/[store]/online-store/themes` | 684 | store | `/api/themes*` |
| 28 | `/[store]/online-store/themes/[themeId]/editor` | 1811 | — (from themes) | `/api/themes/:id/editor`, `/editor/draft`, `/sections`, `/releases`, `/preview-session` |
| 29 | `/[store]/online-store/themes/[themeId]/editor/translations` | 255 | — | `/api/stores/:s/localization*` |
| 30 | `/[store]/online-store/themes/update` | 301 | **— (NO inbound link anywhere)** | `/api/themes/:id/update-preview`, `/update` |
| 31 | `/[store]/orders` | 924 | store (`g o`) | `/api/stores/:s/orders`, `/orders/:id`, `/orders/:id/refund`, `/shipping/zones` |
| 32 | `/[store]/orders/[orderId]` | 700 | — (detail) | `/api/stores/:s/orders/:id` (GET only — read-only page) |
| 33 | `/[store]/pages` | 527 | store (Content parent), portfolio/landing/blog | `/api/stores/:s/pages` |
| 34 | `/[store]/payouts` | 237 | store (Money→Payouts) | `/api/stores/:s/payouts`, `/payouts/:id/settle` |
| 35 | `/[store]/posts` | 579 | store (Content→Blog posts), blog | `/api/stores/:s/posts` |
| 36 | `/[store]/products` | 444 | store (`g p`) | `/api/stores/:s/products` |
| 37 | `/[store]/products/[productId]` | 2 | — (detail) | `export { default } from '../new/page'` |
| 38 | `/[store]/products/collections` | 556 | store | `/api/stores/:s/collections` |
| 39 | `/[store]/products/gift-cards` | 605 | store (Money→Gift cards) | `/api/stores/:s/gift-cards` |
| 40 | `/[store]/products/inventory` | 382 | store (`g i`) | `/api/stores/:s/inventory/levels`, `/adjust` |
| 41 | `/[store]/products/inventory-history` | 576 | store | `/api/stores/:s/inventory/history`, `/analytics` |
| 42 | `/[store]/products/locations` | 361 | store | `/api/stores/:s/inventory-locations` |
| 43 | `/[store]/products/new` | 1301 | store (`n p`) | `/api/stores/:s/products`, `/upload` |
| 44 | `/[store]/products/operations-dashboard` | 467 | store | `/api/stores/:s/commerce-analytics/*` (4 endpoints) |
| 45 | `/[store]/products/purchase-orders` | 724 | store (Purchasing parent) | `/api/stores/:s/purchase-orders`, `/:id/receive` |
| 46 | `/[store]/products/receipts` | 375 | store | `/api/stores/:s/inventory/receipts` |
| 47 | `/[store]/products/reservations` | 412 | store | `/api/stores/:s/inventory/reservations` |
| 48 | `/[store]/products/smart-collections` | 607 | store | `/api/stores/:s/smart-collections*` |
| 49 | `/[store]/products/suppliers` | 373 | store | `/api/stores/:s/suppliers` |
| 50 | `/[store]/products/transfers` | 859 | store | `/api/stores/:s/transfers`, `/:id/ship`, `/:id/receive` |
| 51 | `/[store]/projects` | 494 | portfolio | `/api/stores/:s/content/projects` |
| 52 | `/[store]/reviews` | 499 | store (Marketing→Reviews, `g r`) | `/api/stores/:s/reviews` |
| 53 | `/[store]/settings` | 212 | all (`g s`) | none (static index over `SETTINGS_NAV_ITEMS`) |
| 54 | `/[store]/settings/apps` | 323 | settings nav | `apiClient.appStore.installations` |
| 55 | `/[store]/settings/billing` | 401 | store (Money parent) + settings nav | `/api/stores/:s/billing`, `/settings` |
| 56 | `/[store]/settings/billing/profile` | 273 | — (linked from billing:263,284) | `/api/stores/:s/billing`, `/settings` |
| 57 | `/[store]/settings/business` | 701 | settings nav | `/api/stores/:s/settings`, `/kyc`, `/commission` |
| 58 | `/[store]/settings/checkout` | 373 | settings nav | `/api/stores/:s/settings` |
| 59 | `/[store]/settings/custom-data` | 24 | settings nav (badged "Needs backend") | none — `BackendNeededPane` |
| 60 | `/[store]/settings/domains` | 281 | settings nav | `/api/stores/:s/domains/*` via `src/lib/domains/client.ts` |
| 61 | `/[store]/settings/general` | 817 | settings nav | `/api/stores/:s/settings`, `/localization*` |
| 62 | `/[store]/settings/localization` | 13 | **— (referenced by a dead `itemHref`)** | none — server `redirect()` to `settings/general` |
| 63 | `/[store]/settings/notifications` | 687 | settings nav | `/api/stores/:s/notifications/preferences`, `/delivery-logs` |
| 64 | `/[store]/settings/payments` | 481 | settings nav | `/api/stores/:s/payment-config` |
| 65 | `/[store]/settings/plan` | 319 | settings nav | `/api/stores/:s/plan`, `/plan/cancel`, `/api/plans` |
| 66 | `/[store]/settings/policies` | 288 | settings nav | `/api/stores/:s/settings` |
| 67 | `/[store]/settings/security` | 282 | settings nav | `/api/stores/:s/security/two-factor*` |
| 68 | `/[store]/settings/shipping` | 621 | settings nav | `/api/stores/:s/shipping/zones`, `/rates` |
| 69 | `/[store]/settings/subscribe/checkout` | 35 | settings nav | none — server `redirect()` to `access_account/checkout/checkout` |
| 70 | `/[store]/settings/taxes` | 678 | settings nav | `/api/stores/:s/taxes` |
| 71 | `/[store]/settings/users` | 527 | settings nav | `/api/stores/:s/users` |
| 72 | `/[store]/skills` | 472 | portfolio/resume | `/api/stores/:s/content/skills` |
| 73 | `/[store]/testimonials` | 484 | portfolio | `/api/stores/:s/content/testimonials` |
| 74 | `/accept-invite` | 121 | — (email link) | `/api/employees/accept-invite` |
| 75 | `/launching-soon` | 40 | — (proxy allow-list only) | none |
| 76 | `/` | 302 | — | server redirect fan-out |
| 77 | `/stores` | 198 | — (HeaderBar "All stores") | server `getUserStores` |

### Layouts
- `src/app/layout.tsx` — root; `LetbuyyThemeProvider` + `ThemeScript` + local fonts + `globals.css`.
- `src/app/[store]/layout.tsx:19-28` — the only real auth/tenancy gate for every merchant page: `getSessionUser()` → redirect to accounts; `getStoreForUser(store, user.id)` → `notFound()`.
- `src/app/[store]/settings/layout.tsx` — swaps in `SettingsShell` (own floating sidebar).
- `src/app/[store]/access_account/checkout/{checkout,select-plan}/layout.tsx`, `settings/subscribe/checkout/layout.tsx` — full-screen flows.
- `src/components/AdminShell.tsx:52-57` bypasses the whole shell for `/access_account/checkout`, `/subscribe/checkout`, `/editor`.

### Middleware
`src/proxy.ts` (Next 16 `proxy.ts` convention; `package.json:21` = `next 16.1.6`). Allow-list at `:18-26` is `/`, `/_next`, `/api`, `/launching-soon`, anything containing `.`. Everything else requires a verified `lb_session` cookie. Note `/accept-invite` is **not** allow-listed, so an invited staffer without a session is bounced to accounts `/lookup?return_to=` first (recoverable, but worth confirming with Agent A that the accounts lookup preserves the invite token).

---

## 2. Navigation coverage — both directions

Definition files:
- `src/components/merchantNavigation.ts` (415 lines) — 5 site-type navs (`store`/`portfolio`/`resume`/`landing`/`blog`), keyboard shortcuts, command-palette items.
- `src/components/settings/settings-navigation.ts` (188 lines) — 6 groups / 16 settings items.
- `src/components/AdminShell.tsx:184-224` — builds `AppNavigation` sections + footer.
- `src/components/CommandPalette.tsx` — ⌘K over `getMerchantCommandItems`.

### (a) DEAD LINKS — nav items pointing at non-existent routes

**ZERO.** All 61 distinct nav/shortcut/quick-action targets resolve to a real `page.tsx`. Verified by script diffing `path:`/`href:`/shortcut/quickAction literals against the 77-page route set. `merchantNavigation.ts:66-69` documents a previously-removed dead link (`orders?view=drafts`) — evidence the team already ran this exercise once.

Status: `IMPLEMENTED_NOT_RUNTIME_VERIFIED` — navigation integrity is genuinely good.

### (b) HIDDEN PAGES — real pages with no navigation entry (12)

| Route | Verdict | Evidence |
|-------|---------|----------|
| `access_account/checkout/checkout` | OK — flow step, reached from `select-plan/SelectPlanClient.tsx:76` | |
| `access_account/checkout/select-plan` | OK — reached from `settings/plan/page.tsx:273` | |
| `apps/[installationId]` | OK — detail from `apps/page.tsx:56` | |
| `customers/[email]` | OK — detail | |
| `login` | OK — redirect shim | |
| `online-store/themes/[themeId]/editor` | OK — from themes | |
| `online-store/themes/[themeId]/editor/translations` | **NO inbound link found** — grep for `editor/translations` across `src/**/*.tsx` returns only the route's own folder | |
| `online-store/themes/update` | **NO inbound link found anywhere** — `grep -rn "themes/update" src` outside its own folder = 0 hits | 301 LOC + `ThemeUpdatePanel.tsx` (real diff/rollback UI) unreachable |
| `orders/[orderId]` | OK — from orders list row click | |
| `products/[productId]` | OK — detail | |
| `settings/billing/profile` | OK — `settings/billing/page.tsx:263,284` | |
| `settings/localization` | Intentional permanent redirect (`page.tsx:9-11`) but **`settings/page.tsx:37` lists `'localization'` in the "Store foundation" phase `itemHrefs`, and `SETTINGS_NAV_ITEMS` has no such item**, so `.filter(Boolean)` at `settings/page.tsx:110` silently drops it — the phase card advertises "language settings" and shows 2/2 instead of 3 | |
| `gallery` | **In `portfolioNavigation` only** (`merchantNavigation.ts:184`) — a `store`-type merchant has a working media library page + `/api/stores/:s/media` proxy with **no nav entry at all** | |

### (c) Orphaned API proxies (defined, never called by UI)

Script-verified against all non-API source:
- `/api/stores/[store]/dashboard/setup` — **fully orphaned**. It returns exactly the data `AISidebar` needs (`productsCount`, `shippingZonesCount`, `pagesCount`) and nothing calls it.
- `/api/themes/[themeId]/sections/reorder` — orphaned; the editor persists ordering via `themes.saveDraft` instead (`editor/page.tsx:1216 moveSection`).
- `/api/stores/[store]/domains/[domain]/[action]` — only the `/verify` action is used (`src/lib/domains/client.ts:52`); the generic `[action]` catch-all is otherwise unused.
- (The four `commerce-analytics/*` proxies flagged by my first pass ARE used — `operations-dashboard/page.tsx:115-121` builds the URLs by concatenation; false positive, corrected.)

---

## 3. Per-page action tracing and classification

I traced every material merchant action. Full trace format (entry → page → proxy → client → gateway → auth → RPC → side effect → test → runtime) applied to the high-stakes paths below. **Every trace terminates at the gateway boundary — the gateway/RPC/RLS legs are outside my scope and are marked `NOT TRACED BY ME (Agent A/D)`.**

### 3.1 Refund (highest-stakes merchant money action) — [HIGH-STAKES]

```
Orders list row → "Refund" button (orders/page.tsx:437)
  → refund panel (orders/page.tsx:800-820) : amount (₹, type=number step 0.01) + reason
  → "Verify and refund" → StepUpDialog(action='refund.approve') (orders/page.tsx:681)
      → GET  /api/stores/:s/security/two-factor            (StepUpDialog.tsx:79)   [real TOTP factor lookup]
      → POST /api/stores/:s/security/two-factor/enroll     (StepUpDialog.tsx:102)  [if no active factor]
      → POST /api/stores/:s/security/step-up               → { token, verifiedAt }
  → POST /api/stores/:s/orders/:id/refund   (orders/page.tsx:388-402)
      body: idempotency_key = `refund-${id}-${crypto.randomUUID()}`,
            amount_minor = Math.round(parseFloat(input)*100)  ← client-supplied, server must cap
            step_up_token, step_up_verified_at
      comment at :398 explicitly omits provider_refund_id so the gateway creates the Razorpay refund (LB-3)
  → proxy: src/app/api/stores/[store]/orders/[orderId]/refund/route.ts → resolveOwnedStoreId → gateway
  → gateway/RPC/ledger/RLS: NOT TRACED BY ME (Agent A/D)
  → UI consequence: success toast "Refund recorded" + loadOrders() refetch
  → tests: tests/launch/lb34-stepup-frontend.test.mjs references merchant-control-plane (contents not read by me)
  → runtime: NOT OBSERVED
```
Status: `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. **Step-up is real cryptography-backed TOTP, not a string-length check** — `StepUpDialog.tsx` performs a genuine factor lookup / enrolment / challenge round-trip and passes the returned token through. This satisfies the spirit of ART-11's step-up requirement at the UI layer.
**MISSING on this surface:** no `ProviderModeBadge` (see G-B-05); no display of the refundable remainder (only the full order total as a placeholder); no confirmation of currency/minor-unit reconciliation shown to the merchant.

### 3.2 Payout release — [HIGH-STAKES]

```
Money → Payouts (payouts/page.tsx) → GET /api/stores/:s/payouts
  → "Release" → StepUpDialog(action='payout.release') (payouts/page.tsx:224)
  → POST /api/stores/:s/payouts/:id/settle  (payouts/page.tsx:90-104)
      body: idempotency_key = `payout-settle-${id}-${crypto.randomUUID()}`, step_up_token, step_up_verified_at
  → gateway/PA-split/statement mirror: NOT TRACED BY ME (Agent D)
```
Status: `IMPLEMENTED_NOT_RUNTIME_VERIFIED`. Payout rows are typed in **minor units** (`gross_amount_minor`, `net_amount_minor`, `platform_fee_minor` — `payouts/page.tsx:16-18`) and divided by 100 for display at `:29`. Consistent with the bigint-paise law.
**MISSING:** no `ProviderModeBadge` (G-B-05); currency formatted with a local `Intl.NumberFormat` rather than `formatInrCurrency` (G-B-09).

### 3.3 Gift card issue / disable — [HIGH-STAKES]

`products/gift-cards/page.tsx` → `POST /api/stores/:s/gift-cards` (issue), `PATCH /api/stores/:s/gift-cards/:id` (status). Uses `formatInrCurrency` (7 call sites). Real server round-trip, real error toasts.
**Observations:** (a) no `ProviderModeBadge`; (b) **gift-card issuance is not step-up gated** while refund/payout are — issuing a gift card creates stored-value liability. Whether the constitution requires step-up here is an ARB question, flagged as an open question, not a confirmed gap.

### 3.4 Order fulfilment

`orders/page.tsx:780-796` — the merchant types a tracking number into a free-text `Input` and clicks "Ship" → `PATCH /api/stores/:s/orders/:id { status:'shipped', tracking_number }`. There is **no carrier integration action** (no rate, no label purchase, no label PDF, no void) even though the gateway exposes all of them (`services/api-gateway/src/routes/shipping-labels.ts:256 /rates`, `:279 POST /`, `:364 /:id/pdf`, `:397 /:id/void`). The merchant app consumes **only** `/provider-mode` from that router — `src/app/api/stores/[store]/shipping/zones/route.ts:20` — purely to render the honesty badge. See G-B-07.

### 3.5 Actions that write ONLY local state (no server persistence)

| Surface | Evidence | Effect |
|---------|----------|--------|
| Setup-assistant checkboxes | `AISidebar.tsx:146-151 toggleTodo` | tick state is `useState` only; resets every time the panel is reopened |
| Trial banner dismiss | `TrialBanner.tsx:13,51 setDismissed` | reappears on every dashboard visit |
| Orders list filters | `orders/page.tsx` local state; `merchantNavigation.ts:66-68` confirms the page never reads `useSearchParams` | filter state is not URL-addressable → no shareable/bookmarkable filtered order views |

### 3.6 No-op / dead affordances

| Surface | Evidence | Verdict |
|---------|----------|---------|
| Dashboard trial banner "Select a plan" | `TrialBanner.tsx:69-75` — `href="#"` + `onClick={(e)=>e.preventDefault()}` | **complete no-op** — G-B-01 |
| Setup-assistant progress source | `AISidebar.tsx:122,131` — fetches `/api/store-data?...` which **does not exist** (`find src/app/api -type d -name store-data` → nothing) | always-404 → G-B-02 |
| AI Studio six tool cards | `ai/page.tsx:49-84` hardcoded array + `:296` unconditional `<Badge label="Available" variant="success"/>`, zero handlers/links on the page | G-B-03 |
| `online-store/themes/update` page | 301 LOC, no inbound link | unreachable feature — G-B-12 |
| `/[store]/online-store` | `page.tsx` client-side `router.replace` returning `null` | blank frame before redirect; should be a server `redirect()` — P3 |

### 3.7 Hardcoded / sample data rendered as real

| Surface | Evidence | Assessment |
|---------|----------|------------|
| Plan checkout "offers included" | `src/lib/billing/plan-ui.ts:208-217` → `CheckoutClient.tsx:645-657` | "₹1,500 in subscription credits", "Bonus AI credits + a free store-setup review". Grep for `domain credit`/`domain_credit`/`subscription_credit`/`onboarding bonus`/`store-setup review` across `services/`, `packages/`, `database/` returns **zero** implementation. G-B-04 [HIGH-STAKES] |
| Plan selection competitor table | `plan-ui.ts:170-185` → `SelectPlanClient.tsx:81` | Hardcoded "Shopify Basic ₹1,994", "annualSavings ₹20,000+" presented as current fact inside the product. Not a code bug; a stale-claim/advertising risk. Owner: founder. |
| Commerce OS plan highlights | `plan-ui.ts:187-196` → `SelectPlanClient.tsx:387` | Sells "B2B catalogs", "AI Copilot", "Enterprise automations", "Dedicated success manager". `grep -rln "b2b" services/api-gateway/src/routes/` returns nothing. Sold-but-unbuilt list on a checkout surface. |
| Trial banner feature list | `TrialBanner.tsx:64-68` | "Unlimited products / Custom domain / Priority support" hardcoded, not plan-derived |
| AI Studio tool catalogue | `ai/page.tsx:49-84` | see G-B-03 |
| Theme palette fallback | `online-store/themes/page.tsx:92-96` | hardcoded `rgb(79 127 240)` etc. — cosmetic fallback only, not presented as store data |

Grep for the classic tells (`TODO`, `FIXME`, `coming soon`, `not implemented`, `placeholder data`, `mock`, `sample data`, `dummy`, `lorem`) across `src/**/*.{ts,tsx}` returned **no fabricated-data residue** — the only "coming soon" strings are data-driven (`SelectPlanClient.tsx:177,217` from `plan.status`) or honest (`settings/page.tsx:151` for `status:'backend-needed'`). This is genuinely clean.

---

## 4. Metrics / charts honesty audit

| Page | Numbers come from | Verdict |
|------|-------------------|---------|
| `/[store]/analytics` | `/api/stores/:s/analytics` → `apiClient.analytics.{dashboard,orders,revenue}` (`src/app/api/stores/[store]/analytics/route.ts:17-21`); monthly buckets aggregated from the real daily series at `:29-41` | **REAL**. Honest `EmptyState` at `:241-246` when buckets are absent, real `Skeleton` loading, real error `Banner`. Best-in-class honesty on this app. |
| `/[store]/dashboard` | server-side `apiClient.analytics.*` (`dashboard/page.tsx:206-224`) | **REAL** — but see G-B-11: the `catch` at `:247` collapses any failure into `emptyDashboardHomeData()` (all zeros) and the only signal is a banner reading "Analytics are still warming up" (`DashboardClient.tsx:585-589`), which describes a hard failure as a benign warm-up. |
| `/[store]/products/operations-dashboard` | four real `commerce-analytics/*` proxies with per-panel loading/error state (`page.tsx:79-107 useFetch`) | **REAL** |
| `/[store]/ai` credits + usage | `/api/stores/:s/ai` → `apiClient.ai.credits`, `.usage` | **REAL** (the credits and history are real; the *tool catalogue* is not — G-B-03) |
| `/[store]/settings/business` fee panel | `/api/stores/:s/commission` | **REAL but two defects**: (i) `page.tsx:400` `commission?.schedule?.commission_bps ?? 0` defaults to **0** when the best-effort commission fetch fails (`:247-252`), so a failed call renders a confident "0%"; (ii) `:623` `(commissionBps/100).toFixed(0)` rounds — 25 bps would render "0%", 50 bps "1%". Copy at `:620` hardcodes "We charge no commission on your sales" independent of the number. |
| `/[store]/marketing` send result | `MarketingEmailSendResult.sandbox` | **HONEST banner** (`page.tsx:612-624` — "no real emails delivered. Configure RESEND_API_KEY to send live") **but the toast at `:388-395` says "Campaign sent — N emails sent" with `variant:'success'` unconditionally**, including in sandbox. Partial ANTI-R9. |

**Confirmed defect — period selector does not scope the order breakdown:**
`analytics/page.tsx:111` tells the merchant the date range is "used by the summary cards **and order breakdown**". The proxy passes `period` to `analytics.dashboard` and `analytics.revenue` but calls `apiClient.analytics.orders({ store_id })` with **no period** (`src/app/api/stores/[store]/analytics/route.ts:19`), and the gateway's breakdown loader takes no period at all (`services/api-gateway/src/routes/analytics.ts:402 loadRollupOrderBreakdown(db, storeId)`). The "Orders by status" card and its percentages are **all-time**, mislabelled as period-scoped. → G-B-08.

No fabricated dashboard number found anywhere. ANTI-R9 is substantially respected on the metric surfaces; the violations are in badges and copy, not in numbers.

---

## 5. Provider-mode honesty badge (UI-R6 / PAY-R10)

`ProviderModeBadge` exists: `src/components/ProviderModeBadge.tsx` (24 lines) — `normalizeProviderMode` maps `'test' → 'sandbox'`, renders `sandbox` (warning tone) / `live` (success tone), and **returns `null` for an unknown/absent mode** (`:14`). That null-return is itself a soft honesty hole: an unresolved provider mode renders no badge rather than an explicit "unknown".

Rule text: `AGENTS.md:254` (PAY-R10) and `AGENTS.md:293` (UI-R6) — *"Every money/fulfillment surface renders a truthful mock/sandbox/live badge"*.

| Money / fulfilment surface | Badge? | Evidence |
|---|---|---|
| `settings/payments` | YES | `page.tsx:365` |
| `settings/shipping` | YES | `page.tsx:459` |
| `settings/billing` (payment methods) | YES | `components/billing/BillingPaymentMethods.tsx:166` |
| `settings/billing/profile` | partial — parses `provider_mode` at `:47` | |
| `settings/business` (KYC) | partial — bespoke `kyc.provider_mode === 'sandbox'` block at `:434`, not the shared badge | |
| Orders → **fulfilment** panel | YES | `orders/page.tsx:784` ("Carrier provider") |
| Orders → **refund** panel | **NO** | `orders/page.tsx:798-825` — highest-stakes money action, no badge |
| `orders/[orderId]` detail | **NO** | zero `ProviderModeBadge` occurrences in the file |
| `payouts` | **NO** | zero occurrences — money-out surface |
| `products/gift-cards` | **NO** | zero occurrences — stored-value liability surface |
| `access_account/checkout/checkout` (plan purchase) | **NO** | zero occurrences — the merchant is *paying* here |
| `marketing` campaign send | no badge (honest banner instead) | acceptable but inconsistent |
| `dashboard` money metrics | **NO** | |

Flutter comparison (`apps/mobile/merchant-app/lib/widgets/shared/provider_mode_badge.dart`): rendered on `settings/billing_screen.dart:250`, `dashboard/home_screen.dart:728`, `money/money_screen.dart:220,227,231`. **Mobile covers payouts; web does not.** → G-B-05.

---

## 6. Design-system compliance spot-check

Pages actually opened and read line-by-line for this section (13, not a full-coverage claim): `analytics`, `dashboard` (+`DashboardClient`), `orders`, `orders/[orderId]`, `payouts`, `products/gift-cards`, `products/operations-dashboard`, `ai`, `marketing`, `export`, `settings/business`, `settings/page.tsx`, `login`. Plus scripted scans across all 142 `.tsx` files.

### 6.1 `@letbuyy/ui` usage — GOOD
Nearly every page composes from `@letbuyy/ui` (`Page`, `PageHeader`, `Card`, `Section`, `Table`, `Badge`, `Banner`, `EmptyState`, `Skeleton`, `MetricCard`, `Drawer`, `SaveBar`, `useToast`). Only 2 of 142 files import nothing from it: `src/app/[store]/login/page.tsx` and `src/components/ProviderModeBadge.tsx`. ESLint enforces `@letbuyy/ui/no-raw-elements` and `no-hardcoded-hex` at **error**; `no-raw-form-controls`, `no-raw-color-functions`, `no-tailwind-default-color` only at **warn** (`eslint.config.mjs:17-21`).

### 6.2 **51 undefined `--lb-*` tokens are referenced** — the biggest systemic finding here

Tokens are injected at runtime by `LetbuyyThemeProvider` from `packages/typescript/ui/src/tokens.ts`; nothing in the repo defines them as static CSS (`grep -rl -- "--lb-space-4:" --include="*.css" .` → 0 hits outside `.next` build output). I diffed every `var(--lb-…)` reference in `apps/merchant-control-plane/src` against the union of tokens emitted by `tokens.ts` and defined in `src/app/globals.css`: **140 referenced, 51 undefined.**

Four of those are undefined *by design*: `packages/typescript/ui/src/tokens.ts:9-21` declares a `deprecatedTokenAliasVariables` set and `:1095-1097` runs `deprecatedTokenAliasVariables.forEach(alias => { delete variables[alias] })` — i.e. `--lb-color-text-primary`, `--lb-color-text-secondary`, `--lb-color-border-subtle`, `--lb-color-danger` are **actively stripped from the emitted variable map**, yet the merchant app still uses them.

Highest-impact offenders (file counts from the scan):

| Undefined token | Files | Notable consumers |
|---|---|---|
| `--lb-font-size-sm` | 13 | `customers/[email]`, `customers/segments`, `marketing`, `orders/[orderId]` |
| `--lb-color-surface-hovered` | 11 | `products/{inventory-history,receipts,reservations}`, `themes/update` |
| `--lb-color-text-secondary` (deprecated) | 9 | `products/{inventory-history,locations,operations-dashboard,…}` |
| `--lb-font-size-xs` | 9 | same cluster |
| `--lb-color-text-primary` (deprecated) | 8 | same cluster |
| `--lb-color-border-subtle` (deprecated) | 8 | same cluster |
| `--lb-size-icon-lg` | 6 | `appearance`, `online-store/pages`, `products/{collections,gift-cards}` |
| `--lb-color-text-tertiary` | 4 | `products/{inventory-history,receipts,reservations,transfers}` |
| `--lb-color-text-critical` | 4 | `settings/notifications`, theme editor/library |
| `--lb-font-size-base` | 4 | `customers/[email]`, `customers/segments`, `marketing`, `orders/[orderId]` |
| `--lb-font-size-label` | 4 | `products/{locations,purchase-orders,suppliers,transfers}` |
| plus 40 more incl. `--lb-font-size-2xl`, `--lb-space-0-5`, `--lb-space-20`, `--lb-size-avatar-md`, `--lb-color-on-primary`, `--lb-radius-pill`, `--lb-shadow-overlay` | | |

Concrete rendering consequence (CSS spec: an unresolvable `var()` with no fallback makes the declaration invalid-at-computed-value-time): `products/operations-dashboard/page.tsx:35` writes `border-[var(--lb-color-border-subtle)]` on every KPI card → `border-color` resolves to `currentColor`, i.e. **the KPI cards draw borders in the text colour instead of a subtle grey**; `:37,39` use `text-[length:var(--lb-font-size-xs)]` / `--lb-font-size-2xl` → font sizes fall back to inherited, so the "2xl" KPI value is not visually a KPI.

Governance hole: none of `scripts/validators/token-source-single-validator.mjs`, `packages/typescript/ui/tests/validators/ui-token-variable-snapshot-validator.mjs`, `ui-no-new-token-alias-validator.mjs`, or the 5 UI ESLint rules (`no-hardcoded-hex`, `no-raw-color-functions`, `no-raw-elements`, `no-raw-form-controls`, `no-tailwind-default-color`) validates that a **consumer's** `var(--lb-*)` reference resolves to a defined token. → G-B-06.

### 6.3 Raw px / arbitrary radius / raw Tailwind palette
Scripted across all 142 `.tsx`: only **23 files** contain any `[Npx]`, `rounded-[` (non-var), or raw Tailwind palette class. Worst: `dashboard/DashboardClient.tsx` (11 raw px), `login/page.tsx` (5 raw Tailwind palette classes: `bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-300`), `products/new/page.tsx` (4). Separately, **26 Tailwind default-scale radius classes** (`rounded-lg` ×16, `rounded-md` ×5, `rounded-sm` ×2, `rounded-full` ×2, `rounded-xl` ×1) across 12 files — including the orders **refund** and **fulfilment** panels (`orders/page.tsx:778,800`). `config/tailwind/letbuyy-tokens.css` maps colours only, not radii, so `rounded-lg` = Tailwind's 0.5rem, not `--lb-radius-lg`. Also inline raw styles: `controls/LiquidControl.tsx:43,68` (`marginLeft: 2`, `fontSize: 12`, hardcoded `"Fira Code"`, `rgb(239 68 68)` fallback).

Overall: **good**, with a small, enumerable tail.

### 6.4 Lucide icons
Two icon systems coexist: Lucide via `@letbuyy/ui` (`Settings`, `Users`, `Truck`, `IndianRupee`, `ShieldCheck`, …) and Material Symbols via `MaterialIcon` (`merchantNavigation.ts` stores Material names — `home`, `shopping_bag`, `inventory_2`, `payments`; `AdminShell.tsx:219,245` renders them). The main sidebar is Material; the settings sidebar is Lucide. Not a rule violation I can cite, but a visible inconsistency between the two primary navigations.

### 6.5 Dark mode
Handled by token swap, not `dark:` variants — `LetbuyyThemeProvider` + `ThemeScript` (`src/app/layout.tsx:3`), user toggle in `HeaderBar.tsx:238-249`, and `globals.css` re-declares tokens for dark at `:271-290`. Most pages therefore need no `dark:` classes and are correct in both themes. **Exception:** `login/page.tsx:23-26` hardcodes `bg-zinc-50 dark:bg-zinc-950` — it opts out of the token system entirely, so it will not follow a token/brand change.

### 6.6 Mobile (~360px)
`config/tailwind/letbuyy-tokens.css:21-22` defines `--breakpoint-xs: 360px` and `--breakpoint-mobile: 480px`. **Neither is used anywhere in the merchant app**: `xs:` = 0 occurrences, `mobile:` = 0 occurrences; only `sm:` (61), `md:` (118), `lg:` (25). `globals.css` has 48 media queries, smallest breakpoints 600/639/640px, plus explicit 360px handling only in three hand-written blocks (`:1997`, `:3508`, `:13794`). Practical effect: at 360px everything collapses to the un-prefixed base layout — probably acceptable, but the declared 360px tier is dead and there is no evidence anyone tested at 360px. `SettingsShell.tsx` does ship a real mobile drawer with focus trap and scroll lock (`:59-89`) — good.

---

## 7. India-first audit

### 7.1 INR — mostly good, with a hole
`formatInrCurrency` is used in 12 files (42 call sites). **Seven files bypass it with a local `Intl.NumberFormat`**:

| File:line | Code | Surface |
|---|---|---|
| `payouts/page.tsx:29` | `new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(minor/100)` | money-out |
| `orders/page.tsx:106` | same, no `/100` (order totals are major units — consistent with the gateway, see §10) | orders + refund placeholder |
| `settings/plan/page.tsx:101` | `…minimumFractionDigits:0…format(amount/100)` | plan pricing |
| `settings/business/page.tsx:179` | `…maximumFractionDigits:2…` | settlement/commission |
| `access_account/checkout/checkout/CheckoutClient.tsx:83` | local formatter | **the merchant's own payment checkout** |
| `dashboard/DashboardClient.tsx:771` | `Intl.NumberFormat('en-IN',{maximumFractionDigits:0})` (count, not currency) | dashboard |

Each is individually `en-IN` so the output is not *wrong*, but six independent money formatters on money surfaces means rounding/symbol/grouping rules can drift silently.

### 7.2 Dates — a real India-first violation on a money surface — [HIGH-STAKES]
`packages/typescript/ui/src/formatting.ts:108-127` defines `formatUsShortDate` / `formatUsLongDate` which format with **`locale: 'en-US'`**. They are used on four merchant surfaces:

- `settings/billing/page.tsx:200` — **invoice dates in the billing history table**
- `settings/billing/page.tsx:254,322` — **next charge date and trial-end date**
- `settings/users/page.tsx:390` — staff "Added" dates
- `online-store/pages/page.tsx:470,528` — page/policy "last updated"
- `components/domains/DomainDetailView.tsx:195,287,319` — DNS check / cert renewal / event timeline

So an Indian merchant reading their invoice history sees `Jun 6, 2026` (US) while the rest of the product uses `6 Jun 2026` (en-IN). **This is contradicted by, not caught by, governance:** `tests/contracts/date-format-single-source.test.ts:29-30` explicitly asserts `formatUsShortDate(value) === 'Jun 6, 2026'` and the test file only forbids *locally-declared* formatter helpers — it blesses the US formatters. Marked `CONTRADICTORY_EVIDENCE`: CLAUDE.md's India-first standard says `en-IN dates`; a green contract test says US formatters are fine. → G-B-10.

Also 10 raw `toLocaleDateString('en-IN', …)` call sites bypass the shared formatter (`experience:77`, `projects:96`, `education:77`, `certifications:74`, `settings/security:190`, `products/gift-cards:343`, `CheckoutClient:182,193,200`, `FoundingMerchantCard:54`) — correct locale, wrong single-source.

### 7.3 GSTIN capture — two surfaces, divergent validation
- `settings/billing/profile/page.tsx:62` defines a full checksum-shaped regex `GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/` and validates the input.
- `settings/business/page.tsx:489` captures GSTIN with **no client-side format validation at all** — `onGstinChange` (`:275-281`) only uppercases and derives the state code via `deriveGstStateCode` (`src/lib/india/gst-states.ts`), then `handleSave` (`:299`) PATCHes `gstin: data.gstin || null` straight to `/api/stores/:s/settings`.

Both write GST identity used for "compliant GST tax invoices" (`settings/business/page.tsx:485`). Whether the gateway rejects a malformed GSTIN is **UNVERIFIED by me** — Agent D/E should confirm. The UI-level inconsistency is confirmed. → G-B-13.

Positives: `settings/business` captures legal name / trade name / entity type / PAN last-4 / GSTIN / GST state code / invoice prefix; `orders/[orderId]/page.tsx:322-324` shows customer GSTIN on the order; `settings/general` captures an `invoice_address` explicitly labelled "Used on invoices, tax documents, and GST filings" (`:548`).

### 7.4 GST invoice — no merchant surface at all
`services/api-gateway/src/routes/tax.ts:119` exposes `GET /invoice/:orderId`. `services/api-gateway/src/routes/orders.ts:913` builds a packing-slip HTML. **Neither has a proxy or a button in the merchant control plane** — grep for `tax.invoice|taxInvoice|packing` in `apps/merchant-control-plane/src` returns only unrelated copy. An Indian merchant cannot view, download or print a GST tax invoice or packing slip for an order from the admin. → G-B-07.

---

## 8. Auth / tenancy / permissions as seen from the UI

- **Single gate.** `src/app/[store]/layout.tsx:19-28`. `getSessionUser()` → `apiClient.auth.session()`; `getStoreForUser(store, userId)` → `apiClient.stores.getByHandle(store)`. Note `src/lib/auth/session.ts:111-113` — the `_userId` parameter is **unused** (underscore-prefixed); ownership is entirely delegated to the gateway. That is architecturally correct *if and only if* the gateway enforces `verifySiteOwnership` on `stores.getByHandle` — **NOT VERIFIED BY ME (Agent A)**.
- **Every proxy re-resolves ownership.** `src/lib/stores/resolve-owned-store.ts` is called by essentially every route under `src/app/api/stores/[store]/**`, converting the handle to a `store_id` through the gateway rather than trusting the URL. Good pattern.
- **Internal HMAC header.** `src/lib/api/client.ts:62-80` mints `createLetbuyyInternalSessionHeaders(sessionToken, getLetbuyyInternalAuthSecret({ INTERNAL_API_SECRET, LETBUYY_INTERNAL_API_SECRET }))` — a **shared symmetric secret between the merchant app and the gateway**. Whether that crosses a trust domain under ART-05 is Agent A's call; I record the env var **names** only (both present as `process.env` reads; values not inspected, not printed).
- **No permission gating in the UI.** `src/lib/staff/roles.ts` defines 12 permissions and 6 roles and `settings/users/page.tsx:199,230` persists `permissionsForRole(role)` on the employee. **Nothing consumes it.** Grep for `hasPermission|canAccess|user.role|currentRole` across `src/` (excluding `app/api`) returns hits only inside `settings/users/page.tsx` (label rendering). Consequence: a `viewer` (permissions: `products:read, orders:read, reports:read`) is served the identical navigation as the owner, including **Money → Payouts**, **Gift cards**, **Settings → Payments**, **Settings → Users**, and the **Refund** button on every paid order. Server-side rejection may exist (`tests/launch/lb-merchant-admin.test.mjs` names a "Staff RBAC enforcement middleware" and "owner-bypass + fail-safe by design" — **not read or verified by me**), but the UI presents no gate. → G-B-14.
- **No feature flags in the UI.** Only `NEXT_PUBLIC_*` base URLs. No canary/theme/Liquid flag is read client-side.

---

## 9. Loading / empty / error state coverage

Scripted over all 77 routes (heuristic: `Skeleton|isLoading|loading ?|Spinner` / `EmptyState|emptyState|emptyMessage` / `Banner…critical|setError|loadError`). 44/77 have all three. The 33 with a gap are mostly settings forms where an empty state is meaningless. Genuinely notable:

- `/[store]/export` — **no loading, no empty, no error UI**; everything is toast-only (`export/page.tsx:157,183,197,226,238,257,265`), plus per-button `loading={exporting === card.type}` (`:400`).
- `/[store]/dashboard` — no error state; failures collapse to zeros + "warming up" banner (G-B-11).
- `/[store]/settings` (home index) — purely static, no state.
- `/[store]/online-store` — renders `null` while redirecting.

Positive: `analytics`, `operations-dashboard`, `ai`, `marketing`, `orders`, `payouts`, `gift-cards` all have real `Skeleton` + `EmptyState` + retry `Banner`.

---

## 10. Cross-domain observations (hand-off, not my verdict)

1. **Order money units.** `packages/checkout-core/src/index.ts:1618-1645` types `Order.total: number` with no `_minor` suffix. `services/api-gateway/src/routes/orders.ts:326-334` reads `total_minor ?? total_amount_minor ?? amount_minor` and otherwise falls back to `Math.round(total * 100)`, and `:1104-1105` writes `subtotal`/`total` rounded to 2 decimals. So the orders API surface is **major units (rupees with decimals)** while payouts are `*_minor` bigint. `orders/page.tsx:106` formats without `/100` and is therefore *consistent with the API*, but the dual representation contradicts "money is bigint minor units (paise) everywhere". `CONTRADICTORY_EVIDENCE` — hand to Agent D.
2. **Frozen runtimes linked from live merchant nav.** `apps/app-marketplace/runtime.manifest.json:… "platform": "frozen-not-deployed"` and `apps/theme-marketplace/runtime.manifest.json:49` same. The merchant UI links out to them 4 times: `apps/page.tsx:42` (the page's *primary action*), `apps/page.tsx:84` (empty-state CTA), `settings/apps/AppsSettingsClient.tsx:26`, and `src/lib/public-urls.ts:4` → `online-store/themes/page.tsx:518,557`. The "Add" item is a top-level nav entry with shortcut `g x`. → G-B-15.
3. **PII in the orders CSV.** `export/page.tsx:205-209` writes `customer_name, customer_email, customer_phone` into a downloadable CSV with no confirmation step and no audit hook visible from the UI. Compliance owner should look at this.
4. **Liquid canary badge is hardcoded.** `src/components/theme-editor/controls/LiquidControl.tsx:71-79` always renders "NOT-CONNECTED — Liquid rendering disabled (canary flag off)" regardless of actual flag state. Honest *today* (ART-17 says Liquid is default-OFF), but it will lie in the opposite direction the moment a per-theme canary flips on. Hand to Agent (theme).

---

## 11. Flutter merchant app — separate inventory (`apps/mobile/merchant-app`)

**Not built, not run.** 151 `.dart` files under `lib/`, 63 screens, 40 services, 5 test files.

### Transport
`lib/config/app_config.dart:9-17` — `bffBaseUrl` and `apiBaseUrl` **both** default to `https://bff.letbuyy.com/v1`. So the Flutter app talks to **`services/mobile-bff`**, not the gateway directly. Correct per topology.

### Route inventory
`lib/app/routes.dart` — `AppRouteId` enum with **91 route ids**: 57 primary routes + 34 `/features/*` aliases (deep-link/entitlement targets that mostly re-mount an existing screen, e.g. `featurePayoutsSettlement → MoneyScreen(initialTab:0)`, `featureWallet → MoneyScreen(initialTab:1)`, `featureCommission → MoneyScreen(initialTab:2)`).

Primary paths (`routes.dart:171-235`): `/` (auth wrapper) · `/splash` · `/login` · `/otp` · `/turnstile-challenge` · `/error` · `/create-store` · `/store-published` · `/onboarding` · `/main` · `/upgrade` · `/live-preview` · `/domain-settings` · `/seo-settings` · `/store-details` · `/store-health` · `/notifications` · `/staff` · `/billing` · `/reviews` · `/leads` · `/email-campaigns` · `/apps` · `/ai` · `/shipping` · `/taxes` · `/localization-markets` · `/custom-data` · `/help` · `/analytics` · `/customers` · `/customers/detail` · `/coupons` · `/coupons/form` · `/gift-cards` · `/pages` · `/blog` · `/navigation` · `/media` · `/inventory` · `/inventory/locations` · `/inventory/suppliers` · `/inventory/purchase-orders` · `/inventory/transfers` · `/collections` · `/products` · `/orders` · `/orders/detail` · `/returns` · `/money` · `/kyc` · `/two-factor` · `/pricing` · `/connect-razorpay`.

Bottom nav (`lib/screens/main/store_main_screen.dart:12`): **Home · Orders · Products · Customers · More** (5 tabs).

Deep links (`routes.dart:213-235`): `orders/:id`, `payment-return?…`, `share/:storeId?url=&name=`.

### Web vs mobile capability delta

**In Flutter, absent from the web merchant control plane:**
| Capability | Flutter | Web |
|---|---|---|
| **Returns / RMA** | `screens/orders/returns_screen.dart` + `services/return_service.dart` (list/status/refund fields) | **NONE** — no page, no proxy; only a read-only `return_status` badge at `orders/[orderId]/page.tsx:544`. Gateway has `services/api-gateway/src/routes/returns.ts` with `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/refund/complete`. → G-B-07 |
| Store health | `screens/store_health/store_health_screen.dart` | none |
| Wallet + commission as first-class tabs | `MoneyScreen` tabs 1 and 2 | commission is buried in `settings/business` |
| Media library on a store-type account | `/media` route in the main router | web `/gallery` is portfolio-nav-only |
| Store creation wizard | `screens/wizard/create_store_wizard.dart` | delegated to the accounts app |
| Live storefront preview | `screens/preview/live_preview_screen.dart` | only inside the theme editor |
| Dedicated KYC screen | `screens/kyc/kyc_screen.dart` | inside `settings/business` |
| `ProviderModeBadge` on the payouts surface | `money_screen.dart:220,227,231` | **missing on web** |

**In web, absent from Flutter:** smart collections; categories; inventory history; reservations; receipts; the operations dashboard; customer segments; blog comment moderation; theme translations; theme safe-update; `settings/policies`; `settings/checkout`; and **all four non-store site types** (portfolio / resume / landing / blog) — mobile is store-only, so a portfolio or blog merchant has no mobile app at all.

### Flutter role gate — defined, effectively unused
`lib/app/role_gate.dart` defines `MerchantStaffRole { owner, admin, manager, editor, support, marketing, staff }` and four capability predicates (`canManageStaff`, `canManageCatalog`, `canManageOrders`, `canReadAnalytics`). Grep for `StaffRoleGate|canManage|canRead` across `lib/` (excluding the file itself) returns **exactly one** hit: `lib/screens/settings/staff_screen.dart:200 StaffRoleGate.labelsFor(member.role)` — a display chip. **No screen gates on role.** Same conclusion as web.

**Role catalogue divergence:** Flutter enumerates `owner/admin/manager/editor/support/marketing/staff`; web `src/lib/staff/roles.ts` enumerates `manager/editor/fulfillment/marketing/support/viewer`. `fulfillment` and `viewer` do not exist in Flutter's enum and fall through to `MerchantStaffRole.staff` (`role_gate.dart:23`); `owner`/`admin` do not exist in the web catalogue. The web file's own comment (`roles.ts:4-5`) says every value MUST be in the `employees.role` CHECK constraint listing `support/sales/marketing/operations/manager/admin/editor/viewer/fulfillment/staff` — which matches **neither** client exactly. → G-B-16.

---

## 12. Gap list

Provisional IDs `G-B-nn`. Commander to renumber to `MCP-DISC-NNN`.

---

### G-B-01 — Dashboard trial-banner "Select a plan" CTA is a hard-coded no-op
- **Domain:** merchant UI / monetisation
- **Status:** `BROKEN`
- **Impact:** Every trialing merchant sees a "Select a plan" button on the dashboard. Clicking it does nothing at all. This is the platform's primary in-product conversion affordance and it is dead. Merchants who want to pay cannot from here.
- **Evidence:** `apps/merchant-control-plane/src/components/TrialBanner.tsx:69-75` —
  ```tsx
  <a href="#" className="admin-trial-toast-btn" onClick={(e) => e.preventDefault()}>Select a plan</a>
  ```
  Rendered only on the dashboard: `apps/merchant-control-plane/src/components/AdminShell.tsx:151-156`. A working destination exists: `apps/merchant-control-plane/src/app/[store]/access_account/checkout/select-plan/page.tsx`, already linked from `apps/merchant-control-plane/src/app/[store]/settings/plan/page.tsx:273`. `UI_CODE`.
- **Expected:** the CTA navigates to `/{store}/access_account/checkout/select-plan`.
- **Root cause:** UNKNOWN — plausibly a placeholder that outlived the build-out of the select-plan route.
- **Also in scope of the same component:** the banner offers "Extend your trial" in copy (`:61`) with no extend action anywhere; the feature list (`:64-68`) is hardcoded rather than plan-derived; `dismissed` (`:13,51`) is local state so the banner returns every visit.
- **Blast radius:** every trialing merchant on every dashboard view.
- **Invariant:** none technically, but revenue-blocking.
- **Severity:** P1 · **Likelihood:** HIGH (unconditional)
- **Dependencies:** none — the destination route already exists.
- **Remediation approach:** point the CTA at the existing select-plan route (or remove the banner's CTA and rely on `settings/plan`); drive the feature bullets from the plan payload; persist dismissal server-side or use a bounded local key.
- **Acceptance:** clicking "Select a plan" lands on the plan selector for the current store; the bullets reflect the merchant's actual plan; a dismissed banner stays dismissed for a defined window.
- **Tests required:** unit assertion that `TrialBanner` renders no `href="#"`; an E2E that clicks the CTA and asserts the resulting URL.
- **Owner:** lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH

---

### G-B-02 — Setup assistant reads a non-existent endpoint; onboarding checklist is permanently wrong
- **Domain:** merchant UI / onboarding
- **Status:** `BROKEN`
- **Impact:** The "Setup assistant" panel derives its checklist from a product count and a payment-configured flag. Both come from `/api/store-data`, **which does not exist in this app**. Both fetches 404, the failures are swallowed, and the fallbacks (`productCount = 0`, `hasPayment = false`) are used forever. The assistant therefore tells every merchant to "add your first product" and "set up payments" even after they have done both.
- **Evidence:**
  - `apps/merchant-control-plane/src/components/AISidebar.tsx:122` — `fetch(\`/api/store-data?store=${store}&type=product_count\`)`
  - `apps/merchant-control-plane/src/components/AISidebar.tsx:131` — `fetch(\`/api/store-data?store=${store}&type=payment_check\`)`
  - `find apps/merchant-control-plane/src/app/api -type d -name "store-data"` → no result; `grep -rn "store-data" src` → only these two lines. `UI_CODE` + `PROXY_CODE` (absence).
  - Failures are swallowed at `:119-127` and `:128-136` (`if (prodRes.ok)` + bare `catch {}`), so there is no error surface.
  - **The correct proxy already exists and is orphaned:** `apps/merchant-control-plane/src/app/api/stores/[store]/dashboard/setup/route.ts:22-27` returns `{ productsCount, shippingZonesCount, pagesCount }` and is called by nothing.
- **Expected:** the checklist reflects real store state.
- **Missing link:** `AISidebar` → `/api/stores/[store]/dashboard/setup` (payment status additionally needs `/api/stores/[store]/payment-config`, which exists and is used by `settings/payments`).
- **Blast radius:** every merchant, every session, from first login onward — this is the first-run experience.
- **Invariant:** none · **Severity:** P2 · **Likelihood:** HIGH (unconditional)
- **Remediation approach:** repoint the two fetches at the existing proxies and surface a visible degraded state instead of silently assuming zero.
- **Acceptance:** a store with ≥1 product and a configured payment method shows those items complete.
- **Tests required:** a contract test asserting `AISidebar` references only routes that exist under `src/app/api` (this class of bug is exactly what the existing `settings-apps-dead-twin` / `theme-editor-dead-shell` tests were written for).
- **Owner:** lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH
- **Related:** the checklist ticks are local-only (`AISidebar.tsx:146-151`) so progress never persists.

---

### G-B-03 — AI Studio badges six capabilities "Available" with no way to invoke any of them
- **Domain:** merchant UI / AI
- **Status:** `UI_ONLY` (generation is `BACKEND_ONLY`)
- **Impact:** The AI Studio page renders six tool cards — Product descriptions, SEO content, Blog drafts, Social posts, Email copy, Image alt text — each with an unconditional green `Available` badge. **The page has no generate button, no input, no link, and no handler for any of them.** It only reads credits and usage history. A merchant on a paid plan sold on "AI features included" finds six advertised tools and no way to use one.
- **Evidence:**
  - Hardcoded catalogue: `apps/merchant-control-plane/src/app/[store]/ai/page.tsx:49-84`
  - Unconditional badge: `apps/merchant-control-plane/src/app/[store]/ai/page.tsx:296` — `<Badge label="Available" variant="success" />`
  - The page's only network call is a GET: `apps/merchant-control-plane/src/app/[store]/ai/page.tsx:123`
  - The only AI proxy is read-only: `apps/merchant-control-plane/src/app/api/stores/[store]/ai/route.ts:5-29` (GET, credits + usage)
  - **The backend is real and complete:** `services/api-gateway/src/routes/ai.ts:616` `POST /generate` — validated, credit-gated (`:648-650` returns 402 `INSUFFICIENT_CREDITS`), provider-adapter-gated, and honest when unconfigured (`:663-689` records a failed `ai_usage` row and returns 503 `genericAiUnavailable()`). `GATEWAY_CODE`.
- **Expected:** either each card invokes `POST /v1/ai/generate` through a proxy, or the badges honestly report the capability's actual state.
- **Missing link:** `POST /api/stores/[store]/ai/generate` proxy + any invocation UI.
- **Blast radius:** every merchant on every plan that advertises AI; `plan-ui.ts:193` also sells "AI Copilot" in the checkout highlights.
- **Invariant:** ANTI-R9 / AGENT-R9 flavour — a non-invocable capability reads as `success`.
- **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** add the generate proxy and wire at least one tool end-to-end; until then drive the badge from a real capability signal (e.g. adapter availability from the gateway) rather than a literal.
- **Acceptance:** the badge state is derived from server truth; any card showing "Available" produces a generation when clicked.
- **Tests required:** contract test that no `variant="success"` capability badge is a string literal on this page; integration test for the generate proxy.
- **Owner:** lead engineer (+ founder on the plan copy) · **Reversibility:** fully reversible · **Confidence:** HIGH

---

### G-B-04 — Unbacked monetary offers rendered inside the paid-plan checkout — [HIGH-STAKES]
- **Domain:** merchant UI / billing / consumer protection
- **Status:** `STUB_OR_MOCK`
- **Impact:** At the moment the merchant is about to pay, the checkout renders an accordion headed "N offers included" containing two promises of monetary value: **"Earn ₹1,500 in subscription credits toward future bills when you connect a custom domain"** and **"Bonus AI credits + a free store-setup review in your first 30 days on any paid plan"**. I could find no implementation of either anywhere in the repository.
- **Evidence:**
  - Definition: `apps/merchant-control-plane/src/lib/billing/plan-ui.ts:208-217`
  - Rendering at the point of payment: `apps/merchant-control-plane/src/app/[store]/access_account/checkout/checkout/CheckoutClient.tsx:645-660` (`{SUBSCRIPTION_OFFERS.length} offers included`)
  - Absence: `grep -rn "domain credit|domain_credit|subscription_credit|onboarding bonus|store-setup review"` across `services/`, `packages/`, `database/`, `apps/merchant-control-plane/src` returns **only the copy string itself**. `UI_CODE` + absence of `SERVICE_CODE`/`DB_SCHEMA`.
  - The file's own comment (`plan-ui.ts:205-207`) concedes these are "Informational/marketing — distinct from coupon codes (which are DB-driven…)".
- **Expected:** any credit/bonus shown at checkout is either backed by a real issuance path or removed.
- **Blast radius:** every paid conversion.
- **Invariant:** **[HIGH-STAKES]** — money promised to a paying customer with no mechanism to honour it. India consumer-protection exposure.
- **Severity:** P1 · **Likelihood:** HIGH (unconditional on every non-free checkout)
- **Dependencies:** a subscription-credit ledger concept (does not exist), or founder sign-off to remove.
- **Remediation approach:** founder decision first — either remove the accordion, or build issuance through the canonical ledger (never a direct money-table write) with an explicit terms page. Do **not** leave the copy while the mechanism is absent.
- **Acceptance:** every offer rendered at checkout resolves to an implemented, auditable issuance path, or the block is gone.
- **Tests required:** a contract test that `SUBSCRIPTION_OFFERS` is empty or every entry maps to a known issuance capability.
- **Owner:** founder (+ legal/CA) · **Reversibility:** reversible (copy removal) · **Confidence:** HIGH on absence-in-repo; MEDIUM on whether an out-of-band manual process exists (I cannot see one).
- **Adjacent, same file, lower severity:** `plan-ui.ts:170-185` hardcodes competitor pricing ("Shopify Basic ₹1,994", "annual savings ₹20,000+") shown as current fact — stale-claim risk, owner: founder. `plan-ui.ts:187-196` sells "B2B catalogs", "Enterprise automations", "Dedicated success manager" — `grep -rln "b2b" services/api-gateway/src/routes/` returns nothing.

---

### G-B-05 — Provider-mode honesty badge missing on refunds, payouts, gift cards and plan checkout — [HIGH-STAKES]
- **Domain:** merchant UI / payments honesty
- **Status:** `PARTIAL`
- **Impact:** UI-R6 / PAY-R10 require a truthful `mock/sandbox/live` badge on **every** money and fulfilment surface. Coverage is partial. A merchant issuing a refund in sandbox sees the same "Refund recorded — submitted successfully" success toast as in live, with no indication the provider is a sandbox.
- **Evidence:**
  - Rule: `AGENTS.md:254` (PAY-R10), `AGENTS.md:293` (UI-R6), `AGENTS.md:322` (ANTI-R9).
  - Component: `apps/merchant-control-plane/src/components/ProviderModeBadge.tsx:13-23`; note `:14` `if (!mode) return null` — unknown mode renders nothing rather than an explicit unknown.
  - **Present:** `settings/payments/page.tsx:365`; `settings/shipping/page.tsx:459`; `components/billing/BillingPaymentMethods.tsx:166`; `orders/page.tsx:784` (fulfilment panel only).
  - **Absent:** `orders/page.tsx:798-825` (**refund panel**); `payouts/page.tsx` (0 occurrences); `products/gift-cards/page.tsx` (0 occurrences); `orders/[orderId]/page.tsx` (0 occurrences); `access_account/checkout/checkout/CheckoutClient.tsx` (0 occurrences); `dashboard/DashboardClient.tsx` (0 occurrences).
  - Flutter covers more: `lib/screens/money/money_screen.dart:220,227,231` (payouts/wallet/commission), `lib/screens/dashboard/home_screen.dart:728`, `lib/screens/settings/billing_screen.dart:250`.
- **Expected:** the badge on every money/fulfilment surface, with an explicit state when the mode is unknown.
- **Blast radius:** all merchant money actions on web.
- **Invariant:** **[HIGH-STAKES]**, **[IRREVERSIBLE]** (a sandbox refund believed to be live leaves the customer unpaid).
- **Severity:** P1 · **Likelihood:** MEDIUM (only bites in sandbox/mock, which is exactly the pre-launch state)
- **Remediation approach:** render `ProviderModeBadge` on the refund panel, payouts page, gift-card surface, order detail and plan checkout, sourcing the mode from the same server field each surface already has access to; make an unresolved mode render an explicit "unknown" rather than nothing.
- **Acceptance:** a validator enumerates money/fulfilment surfaces and fails when one lacks the badge; sandbox refunds visibly read as sandbox.
- **Tests required:** a governance validator listing the money surfaces (extend the existing honesty-validator family) + a UI test asserting the badge is present with `mode='sandbox'`.
- **Owner:** security / payments-provider + lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH

---

### G-B-06 — 51 referenced `--lb-*` design tokens are undefined; 4 are actively deleted by the token layer
- **Domain:** merchant UI / design system
- **Status:** `BROKEN` (visual), `NOT_IMPLEMENTED` (the validator that would catch it)
- **Impact:** Pages reference `var(--lb-…)` names that the runtime token map never emits. Per CSS, an unresolvable `var()` with no fallback invalidates the declaration at computed-value time — border colours fall back to `currentColor`, font sizes to inherited, backgrounds to transparent. Whole clusters of pages therefore render off-design and off-brand, and will not follow a theme or brand change.
- **Evidence:**
  - Scripted diff of every `var(--lb-…)` in `apps/merchant-control-plane/src` against the union of `packages/typescript/ui/src/tokens.ts` emissions and `apps/merchant-control-plane/src/app/globals.css` definitions: **140 used, 51 undefined**.
  - Four are **deliberately stripped**: `packages/typescript/ui/src/tokens.ts:9-21` declares `deprecatedTokenAliasVariables` (incl. `--lb-color-text-primary`, `--lb-color-text-secondary`, `--lb-color-border-subtle`, `--lb-color-danger`) and `packages/typescript/ui/src/tokens.ts:1095-1097` executes `deprecatedTokenAliasVariables.forEach((alias) => { delete variables[alias]; })`.
  - Concrete: `apps/merchant-control-plane/src/app/[store]/products/operations-dashboard/page.tsx:35` `border-[var(--lb-color-border-subtle)]`; `:37` `text-[length:var(--lb-font-size-xs)]`; `:39` `text-[length:var(--lb-font-size-2xl)]` + `text-[var(--lb-color-text-primary)]` — all four undefined on one KPI card.
  - Highest-count offenders: `--lb-font-size-sm` (13 files), `--lb-color-surface-hovered` (11), `--lb-color-text-secondary` (9), `--lb-font-size-xs` (9), `--lb-color-text-primary` (8), `--lb-color-border-subtle` (8), `--lb-size-icon-lg` (6).
  - **No governance covers it:** `scripts/validators/token-source-single-validator.mjs` guards token *authority*; `packages/typescript/ui/tests/validators/ui-token-variable-snapshot-validator.mjs` and `ui-no-new-token-alias-validator.mjs` snapshot the *producer*; the five UI ESLint rules (`packages/typescript/ui/eslint/index.cjs:145`) cover hex/raw-colour/raw-element/raw-form-control/tailwind-default-colour. **Nothing validates that a consumer's token reference resolves.**
- **Expected:** every `var(--lb-*)` reference resolves to an emitted token.
- **Blast radius:** ~30 files including `orders/[orderId]`, `customers/[email]`, `customers/segments`, `marketing`, `products/*` warehousing pages, `settings/notifications`, the theme editor and theme library.
- **Invariant:** none · **Severity:** P2 · **Likelihood:** HIGH (deterministic)
- **Remediation approach:** add a governance validator that extracts emitted token names from `tokens.ts` + app CSS and fails on any unresolved `var(--lb-*)` in app source; then migrate the 51 references to live tokens (the deprecated four have documented replacements). Do not "fix" by re-adding the deprecated aliases — that would reverse a deliberate decision.
- **Acceptance:** the validator is wired into `scripts/validate-governance.mjs` and reports zero unresolved references.
- **Tests required:** the new validator + its self-test.
- **Owner:** lead engineer (design system) · **Reversibility:** fully reversible · **Confidence:** HIGH on the diff; MEDIUM on the exact per-property visual outcome (I did not render the pages).

---

### G-B-07 — Returns/RMA, GST tax invoice, packing slip and shipping labels have gateway support but no web merchant surface
- **Domain:** merchant UI / fulfilment / India compliance
- **Status:** `BACKEND_ONLY`
- **Impact:** Four merchant-critical workflows exist server-side and are unreachable from the merchant web OS:
  1. **Returns / RMA** — the merchant cannot see, approve, reject or refund a return on the web. Only a read-only badge.
  2. **GST tax invoice** — an Indian merchant cannot view or download the GST invoice for an order.
  3. **Packing slip** — cannot print.
  4. **Shipping labels** — cannot rate, buy, print or void; fulfilment is manual tracking-number entry.
- **Evidence:**
  - Returns backend: `services/api-gateway/src/routes/returns.ts:131 GET /`, `:170 GET /:id`, `:186 POST /`, `:214 PATCH /:id`, `:259 POST /:id/refund/complete`. Web: no page, no proxy (130-proxy inventory contains no `returns`); only `apps/merchant-control-plane/src/app/[store]/orders/[orderId]/page.tsx:516,544` renders `return_status` read-only. Flutter **does** have it: `apps/mobile/merchant-app/lib/screens/orders/returns_screen.dart` + `lib/services/return_service.dart`, routed at `lib/app/routes.dart:560`.
  - GST invoice backend: `services/api-gateway/src/routes/tax.ts:119 GET /invoice/:orderId`. Web: `grep -rn "tax.invoice|taxInvoice"` in `apps/merchant-control-plane/src` → 0.
  - Packing slip: `services/api-gateway/src/routes/orders.ts:913` builds packing-slip HTML. Web: `grep -rni "packing"` → 0.
  - Shipping labels: `services/api-gateway/src/routes/shipping-labels.ts:256 POST /rates`, `:279 POST /`, `:364 GET /:id/pdf`, `:397 POST /:id/void`. Web consumes **only** `:266 GET /provider-mode`, at `apps/merchant-control-plane/src/app/api/stores/[store]/shipping/zones/route.ts:20`, purely to render the honesty badge. Fulfilment UI is a free-text tracking input: `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:785-791`.
- **Expected:** each of these reachable from the merchant web OS.
- **Missing link:** proxies + pages/actions. Not a backend gap.
- **Blast radius:** every merchant handling a return or needing a tax invoice; GST invoice access is a statutory expectation in India.
- **Invariant:** **[HIGH-STAKES]** — returns touch refunds (money out); GST invoices are compliance artefacts.
- **Severity:** P1 (returns + GST invoice), P2 (labels + packing slip) · **Likelihood:** HIGH
- **Dependencies:** none technical — the endpoints exist. Sequencing/scope decision required.
- **Remediation approach:** add same-origin proxies mirroring the gateway routes (never write the DB locally); add a Returns page under Orders and an invoice/packing-slip action on the order detail page (which today has **no actions at all** — see G-B-17); decide whether labels are launch scope.
- **Acceptance:** a merchant can approve a return and complete its refund from the web; can open the GST invoice for a paid order.
- **Tests required:** proxy contract tests; E2E for return-approve→refund; an India-compliance test that a paid order exposes an invoice.
- **Owner:** founder (scope) + lead engineer + CA-tax (invoice content) · **Reversibility:** additive · **Confidence:** HIGH

---

### G-B-08 — Analytics period selector does not scope the "Orders by status" breakdown it claims to scope
- **Domain:** merchant UI / analytics honesty
- **Status:** `BROKEN`
- **Impact:** The reporting-period control tells the merchant it governs "the summary cards **and order breakdown**". It does not govern the breakdown: those counts and percentages are all-time regardless of the selection. A merchant reading "Pending 40%" for "Last 7 days" is reading an all-time figure.
- **Evidence:**
  - Claim: `apps/merchant-control-plane/src/app/[store]/analytics/page.tsx:111` — `description="Choose the range used by the summary cards and order breakdown."`
  - Card rendered from `data.ordersByStatus`: `apps/merchant-control-plane/src/app/[store]/analytics/page.tsx:191-212` (percentages at `:203`).
  - Proxy passes `period` to two of three calls only: `apps/merchant-control-plane/src/app/api/stores/[store]/analytics/route.ts:18` (`dashboard`, with period), `:19` (`orders`, **no period**), `:20` (`revenue`, with period).
  - Gateway breakdown takes no period: `services/api-gateway/src/routes/analytics.ts:402` — `async function loadRollupOrderBreakdown(db: AnalyticsDb, storeId: string)`, `:403` `loadRollups(db, storeId, ['orders.status'], undefined, 2000)` (the `undefined` is the since-date).
- **Expected:** the breakdown honours the selected period, or the copy states it is all-time.
- **Blast radius:** the analytics page, all merchants.
- **Invariant:** ANTI-R9 flavour (a metric labelled as something it is not) · **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** thread `period` through the gateway breakdown loader, or relabel the card "All time" until it does.
- **Acceptance:** changing the period changes the breakdown, or the card is explicitly labelled all-time.
- **Tests required:** a gateway test that `/analytics/orders?period=7d` differs from `?period=90d` on seeded data; a UI test on the label.
- **Owner:** lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH

---

### G-B-09 — Bulk export silently truncates at 100 rows and reports success — [HIGH-STAKES]
- **Domain:** merchant UI / data portability / accounting
- **Status:** `BROKEN`
- **Impact:** "Export and import" downloads at most 100 products, 100 orders and 100 customers with **no pagination, no warning, and a green success toast that names the truncated count as though it were the total**. A merchant exporting orders for accounting, GST reconciliation or a platform migration silently loses everything past row 100 and is told the export succeeded.
- **Evidence:**
  - `apps/merchant-control-plane/src/app/[store]/export/page.tsx:151` — `fetch(\`/api/stores/${...}/products?limit=100\`)`
  - `apps/merchant-control-plane/src/app/[store]/export/page.tsx:187` — `new URLSearchParams({ limit: '100' })` for orders
  - `apps/merchant-control-plane/src/app/[store]/export/page.tsx:232` — `customers?limit=100`
  - Success toast presents the truncated count as the result: `:183-187`, `:226-230`, `:257-261` (e.g. `${data.length.toLocaleString('en-IN')} orders were downloaded as CSV`), `variant: 'success'`.
  - No loop over `meta.has_next` / `page` anywhere in the file, although the orders proxy returns `has_next` (`src/app/api/stores/[store]/orders/route.ts:37`).
- **Expected:** the export contains every row, or the merchant is told plainly that it is partial and why.
- **Blast radius:** any store with more than 100 of anything — i.e. any real store.
- **Invariant:** **[HIGH-STAKES]** — the orders CSV is the artefact a merchant hands to an accountant; **[IRREVERSIBLE]** in the sense that a migration performed off a truncated file loses data.
- **Severity:** P1 · **Likelihood:** HIGH
- **Remediation approach:** paginate to completion (or move to a server-side streamed export job), and until then make the toast state the row count **and** whether more remain.
- **Acceptance:** a 250-order store exports 250 rows; a partial export cannot report `variant:'success'` without saying it is partial.
- **Tests required:** integration test over a >100-row fixture asserting full row count; a UI test that a truncated result renders a warning, not a success.
- **Owner:** lead engineer (+ CA-tax on required columns) · **Reversibility:** fully reversible · **Confidence:** HIGH
- **Adjacent:** the orders CSV includes `customer_email` and `customer_phone` (`:205-207`) with no confirmation or visible audit hook — hand to compliance. The orders CSV also has **no tax/GST column** (`:204` header list), so it cannot serve GST filing even when complete.

---

### G-B-10 — US-locale dates on merchant billing and other surfaces, blessed by a governance test — [HIGH-STAKES]
- **Domain:** merchant UI / India-first
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Impact:** An Indian merchant reads invoice dates, next-charge date and trial-end date in US format (`Jun 6, 2026`) while the rest of the product uses `6 Jun 2026`. On money and compliance surfaces this is genuinely ambiguous.
- **Evidence:**
  - Formatters are explicitly `en-US`: `packages/typescript/ui/src/formatting.ts:108-117` (`formatUsShortDate`), `:119-127` (`formatUsLongDate`).
  - Used on money surfaces: `apps/merchant-control-plane/src/app/[store]/settings/billing/page.tsx:200` (invoice date column), `:254` (upcoming charge), `:322` (trial end).
  - Also: `apps/merchant-control-plane/src/app/[store]/settings/users/page.tsx:390`; `apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:470,528`; `apps/merchant-control-plane/src/components/domains/DomainDetailView.tsx:195,287,319`.
  - **The contradiction:** `tests/contracts/date-format-single-source.test.ts:29-30` asserts `formatUsShortDate(value) === 'Jun 6, 2026'` and `formatUsLongDate(value) === 'June 6, 2026'`, and `:38-48` only forbids *locally declared* formatter helpers. Governance therefore sanctions US dates. CLAUDE.md's India-first standard says `en-IN dates`. `UNIT_TEST` vs `DOC_CLAIM`.
  - Separately, 10 call sites bypass the shared formatter with raw `toLocaleDateString('en-IN', …)`: `experience/page.tsx:77`, `projects/page.tsx:96`, `education/page.tsx:77`, `certifications/page.tsx:74`, `settings/security/page.tsx:190`, `products/gift-cards/page.tsx:343`, `CheckoutClient.tsx:182,193,200`, `FoundingMerchantCard.tsx:54`.
- **Expected:** a single decision — either the US formatters are removed from merchant surfaces, or governance explicitly records why US dates are correct for an India-first merchant OS.
- **Blast radius:** billing history, staff admin, domains, CMS.
- **Invariant:** **[HIGH-STAKES]** on billing (invoice dating).
- **Severity:** P2 · **Likelihood:** HIGH · **Confidence:** HIGH on the facts, the resolution is a decision not a bug fix.
- **Remediation approach:** founder/ARB decides; then either migrate the call sites to `formatIndiaDate`/`formatIndiaDateWithTime` and update the contract test, or record the exception in governance with a rationale.
- **Acceptance:** one documented rule; the contract test enforces it; no raw `toLocaleDateString` in app source.
- **Owner:** ARB (decision) + lead engineer (execution) · **Reversibility:** fully reversible

---

### G-B-11 — Dashboard reports a gateway failure as "Analytics are still warming up" and shows zeros
- **Domain:** merchant UI / honesty
- **Status:** `PARTIAL`
- **Impact:** Any failure of the analytics calls (5xx, timeout, auth) is caught and collapsed into all-zero metrics. The only signal is an info-tone banner reading "Analytics are still warming up… Summary cards will update when the analytics endpoint returns store activity." A merchant with real revenue sees ₹0 and a reassuring message.
- **Evidence:** `apps/merchant-control-plane/src/app/[store]/dashboard/page.tsx:247-249` (`catch { return emptyDashboardHomeData() }`), `:252-264` (all zeros, `analyticsAvailable:false`); banner at `apps/merchant-control-plane/src/app/[store]/dashboard/DashboardClient.tsx:585-589`; metric cards render the zeros at `:592-600`.
- **Expected:** distinguish "no activity yet" from "we could not load your analytics" and never render ₹0 as if authoritative when the fetch failed.
- **Blast radius:** the dashboard, every merchant, during any gateway degradation.
- **Invariant:** ANTI-R9 flavour on a money-adjacent surface · **Severity:** P2 · **Likelihood:** MEDIUM (only on failure)
- **Remediation approach:** distinguish the two states in `loadDashboardHomeData` and render an explicit error with retry when the load failed; suppress the money figures rather than showing zeros.
- **Acceptance:** a forced gateway 500 renders an error state, not ₹0.
- **Tests required:** a render test with a failing client.
- **Owner:** lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH
- **Same family, lower severity:** `settings/business/page.tsx:400` defaults `commission_bps` to `0` when the best-effort commission fetch fails (`:247-252`) and renders a confident "0%" at `:623`; and `:623` uses `.toFixed(0)` so 25 bps would display "0%" and 50 bps "1%".

---

### G-B-12 — Theme safe-update page and the theme translations editor are unreachable
- **Domain:** merchant UI / navigation / theme
- **Status:** `UI_ONLY` (built, not reachable)
- **Impact:** `online-store/themes/update` is a 301-line page plus a real `ThemeUpdatePanel` (version diff, apply, rollback) with **no inbound link anywhere in the app**. `online-store/themes/[themeId]/editor/translations` (255 lines) likewise has no inbound link. Merchants cannot reach either feature; the engineering investment is dark.
- **Evidence:** `grep -rn "themes/update" apps/merchant-control-plane/src` excluding the route's own folder → **0 hits**; same for `editor/translations`. Route folders: `apps/merchant-control-plane/src/app/[store]/online-store/themes/update/{page.tsx,UpdatePageClient.tsx}`; `apps/merchant-control-plane/src/components/theme-editor/ThemeUpdatePanel.tsx`. `UI_CODE` (absence).
- **Also in this family:** `apps/merchant-control-plane/src/app/[store]/settings/page.tsx:37` lists `'localization'` in the "Store foundation" phase, but `SETTINGS_NAV_ITEMS` has no such entry, so `:108-110` `.filter(Boolean)` silently drops it — the card advertises "language settings" and renders 2/2. And `/[store]/gallery` (media library) is in `portfolioNavigation` only (`merchantNavigation.ts:184`), so a store-type merchant has a working media library page and `/api/stores/:s/media` proxy with no nav entry.
- **Expected:** every shipped page is reachable, or is archived per the repo's existing dead-code convention (`docs/archive/dead-code/…`, enforced by `tests/contracts/settings-apps-dead-twin.test.ts`).
- **Blast radius:** three unreachable features + one mis-rendered settings card.
- **Invariant:** none · **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** either link them (Themes page → "Update theme"; editor → "Translations"; store nav → Media library) or archive them under the existing dead-code convention. Fix or remove the `'localization'` itemHref.
- **Acceptance:** a validator asserts every `page.tsx` under `[store]` is either nav-reachable, linked from another page, or a documented detail/flow route.
- **Tests required:** the reachability validator (a natural extension of the existing dead-twin family).
- **Owner:** lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH

---

### G-B-13 — Two GSTIN capture surfaces with divergent validation — [HIGH-STAKES]
- **Domain:** merchant UI / India compliance
- **Status:** `PARTIAL`
- **Impact:** GSTIN can be captured in two places. One validates the format; the other does not. A malformed GSTIN saved from Business details flows into GST tax invoices, which are immutable once issued.
- **Evidence:**
  - Validating surface: `apps/merchant-control-plane/src/app/[store]/settings/billing/profile/page.tsx:62` — `const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/`
  - Non-validating surface: `apps/merchant-control-plane/src/app/[store]/settings/business/page.tsx:489` renders the GSTIN input; `:275-281 onGstinChange` only uppercases and derives the state code; `:299` PATCHes `gstin: data.gstin || null`. `grep -n "GSTIN_RE|validateGstin|pattern="` in that file → **0 hits**.
  - Stakes stated in-product: `apps/merchant-control-plane/src/app/[store]/settings/business/page.tsx:485` — "add your GSTIN to issue compliant GST tax invoices".
- **Expected:** one validation rule, applied on both surfaces, and enforced server-side.
- **Unknown:** whether the gateway rejects a malformed GSTIN — **NOT VERIFIED BY ME**; hand to Agent D/E.
- **Invariant:** **[HIGH-STAKES]** (GST) and **[IRREVERSIBLE]** downstream (invoices are immutable).
- **Severity:** P2 (P1 if the server also does not validate) · **Likelihood:** MEDIUM
- **Remediation approach:** move `GSTIN_RE` into a shared India module (`src/lib/india/`) alongside `gst-states.ts`, use it on both surfaces, and confirm/require server-side rejection.
- **Acceptance:** an invalid GSTIN cannot be saved from either surface; a server test rejects it.
- **Tests required:** unit test on the shared validator; gateway contract test; a GST audit assertion.
- **Owner:** CA-tax (rule) + lead engineer (implementation) · **Reversibility:** reversible for capture; downstream invoices are not · **Confidence:** HIGH on the UI divergence, UNKNOWN on server behaviour.

---

### G-B-14 — Staff permissions are defined and persisted but gate nothing in either client — [HIGH-STAKES]
- **Domain:** merchant UI / authorization affordance
- **Status:** `BACKEND_ONLY` (as far as the UI is concerned)
- **Impact:** A merchant invites a `viewer` (read-only) or `editor` (catalogue only). Both are served the identical navigation and the identical action buttons as the owner — including **Money → Payouts** with its "Release" button, **Gift cards**, **Settings → Payments**, **Settings → Users**, and the **Refund** button on every paid order. Even if the gateway rejects the call, the merchant's mental model of "who can do what" is broken, and staff routinely hit 403s on buttons the product offered them.
- **Evidence:**
  - Catalogue exists and is persisted: `apps/merchant-control-plane/src/lib/staff/roles.ts:25-38` (12 permissions), `:46-92` (6 roles), `:108-110 permissionsForRole`; written at `apps/merchant-control-plane/src/app/[store]/settings/users/page.tsx:199` and `:230`.
  - Nothing consumes it: `grep -rn "hasPermission|canAccess|user\.role|currentRole"` across `apps/merchant-control-plane/src` excluding `app/api` → hits only inside `settings/users/page.tsx` (label rendering).
  - The nav builder is role-blind: `apps/merchant-control-plane/src/components/AdminShell.tsx:184-202 buildNavigationSections(store, siteType)` takes only the site type.
  - The session model carries no role: `apps/merchant-control-plane/src/lib/auth/session.ts:82-87 SessionUser = { id, email, fullName, avatarUrl }`.
  - **Flutter is the same:** `apps/mobile/merchant-app/lib/app/role_gate.dart` defines `StaffRoleGate` with four capability predicates; the only consumer in the whole app is a display chip at `apps/mobile/merchant-app/lib/screens/settings/staff_screen.dart:200`.
- **Expected:** navigation and destructive actions reflect the signed-in staffer's permissions.
- **Server-side status:** `tests/launch/lb-merchant-admin.test.mjs` names tests for a "Staff RBAC enforcement middleware… owner-bypass + fail-safe by design" and "products write routes wired to the staff guard" — **I did not read or verify those**, and they are Agent A's domain. The UI-layer gap stands regardless.
- **Blast radius:** every multi-staff store.
- **Invariant:** **[HIGH-STAKES]** — payouts and refunds are exposed to every role in the UI.
- **Severity:** P2 (P1 if server enforcement is also absent — hand to Agent A to resolve) · **Likelihood:** HIGH once merchants add staff
- **Remediation approach:** carry the staff role/permissions on the session, filter `getMerchantNavigation` and the settings nav by permission, and hide/disable destructive actions the role lacks — as a defence-in-depth layer over server enforcement, never as a replacement for it.
- **Acceptance:** a `viewer` session shows no Payouts nav item and no Refund button; a `fulfillment` session shows Orders but not Settings → Payments.
- **Tests required:** UI tests per role; a contract test that the nav builder consumes permissions.
- **Owner:** security + lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH on the UI-layer facts; UNKNOWN on server enforcement.

---

### G-B-15 — Live merchant navigation links out to two frozen, not-deployed runtimes
- **Domain:** merchant UI / governance
- **Status:** `BROKEN` (link targets), `CONTRADICTORY_EVIDENCE` (product vs manifest)
- **Impact:** The top-level "Add" nav item (shortcut `g x`) opens the Apps page whose **primary action** is "Browse marketplace" → `https://apps.letbuyy.com`. The Themes page offers two "theme store" links → `https://themes.letbuyy.com`. Both target runtimes the Constitution and their own manifests declare frozen and not deployed.
- **Evidence:**
  - `apps/app-marketplace/runtime.manifest.json` — `"deploymentAuthority": { "platform": "frozen-not-deployed" }`; `"deploymentOwnership": "Frozen app is not deployed…"`.
  - `apps/theme-marketplace/runtime.manifest.json:49` — `"platform": "frozen-not-deployed"`.
  - Links: `apps/merchant-control-plane/src/app/[store]/apps/page.tsx:42` (PageHeader `primaryAction`), `:84` (empty-state CTA), `apps/merchant-control-plane/src/app/[store]/settings/apps/AppsSettingsClient.tsx:26`; `apps/merchant-control-plane/src/lib/public-urls.ts:4,47-52` → rendered at `apps/merchant-control-plane/src/app/[store]/online-store/themes/page.tsx:518,557`.
  - Nav placement: `apps/merchant-control-plane/src/components/merchantNavigation.ts:42-48` (`appsItem`, section `'apps'`, shortcut `g x`), included in all five site-type navs.
- **Expected:** the merchant OS does not advertise a destination that is not deployed.
- **Blast radius:** every merchant; four visible links; one of them is a top-level nav destination's primary action.
- **Invariant:** none technically; it is an honesty/UX defect and a visible contradiction with the frozen-runtime law.
- **Severity:** P2 · **Likelihood:** HIGH (unconditional)
- **Remediation approach:** gate the outbound links behind a real "marketplace live" signal, or replace them with honest copy about the marketplace's status. Note this is deliberately **not** "unfreeze the marketplace" — that needs ARB.
- **Acceptance:** no merchant surface links to a runtime whose manifest says `frozen-not-deployed`.
- **Tests required:** a governance validator cross-referencing outbound app URLs against `runtime.manifest.json` deployment authority.
- **Owner:** ARB (policy) + lead engineer (implementation) · **Reversibility:** fully reversible · **Confidence:** HIGH

---

### G-B-16 — Staff role catalogues diverge across web, Flutter and the documented DB constraint
- **Domain:** merchant UI / contract drift
- **Status:** `CONTRADICTORY_EVIDENCE`
- **Impact:** Three different role vocabularies. A role assigned on the web that Flutter does not know silently degrades to the least-privileged bucket, so the two clients would disagree about a staffer's capabilities the moment either starts gating on role.
- **Evidence:**
  - Web: `apps/merchant-control-plane/src/lib/staff/roles.ts:46-92` → `manager, editor, fulfillment, marketing, support, viewer`.
  - Flutter: `apps/mobile/merchant-app/lib/app/role_gate.dart:1-9` → `owner, admin, manager, editor, support, marketing, staff`; `:15-23` maps anything unrecognised (including `fulfillment` and `viewer`) to `MerchantStaffRole.staff`.
  - The web file's own comment (`roles.ts:3-5`) states the DB CHECK constraint is `support/sales/marketing/operations/manager/admin/editor/viewer/fulfillment/staff` — which matches **neither** client (`sales` and `operations` appear in neither).
  - Actual DB constraint: **NOT VERIFIED BY ME** — I did not read the migration. Hand to Agent D/E.
- **Expected:** one shared role vocabulary sourced from a single package.
- **Blast radius:** every multi-staff store, both clients.
- **Invariant:** authorization-adjacent → **[HIGH-STAKES]**
- **Severity:** P2 · **Likelihood:** MEDIUM (latent until either client gates on role — see G-B-14)
- **Remediation approach:** define the catalogue once (e.g. `packages/permission-core`), generate the Dart side from it as the token pipeline already does, and assert it against the DB CHECK constraint in a validator.
- **Acceptance:** a validator proves web enum ≡ Flutter enum ≡ DB CHECK constraint.
- **Owner:** security + lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH on the client divergence; UNKNOWN on the DB constraint.

---

### G-B-17 — The order detail page is read-only; every order action requires going back to the list
- **Domain:** merchant UI / order operations
- **Status:** `PARTIAL`
- **Impact:** `/{store}/orders/{orderId}` renders customer, items, totals, refund/return status — and offers **no order action at all**: no confirm, process, ship, deliver, cancel, refund, invoice, packing slip, or label. The only buttons navigate to the customer profile or back to the list. All actions live on the list-row expansion (`orders/page.tsx:742-825`), so a merchant who deep-links to an order (including from the mobile deep link `orders/:id`) must navigate back to act.
- **Evidence:** `apps/merchant-control-plane/src/app/[store]/orders/[orderId]/page.tsx` — the only `onClick` handlers are `:310-315` and `:331-336` (both `router.push` to the customer profile) and `:661,667` (retry / back). The page's only network call is `GET /api/stores/:s/orders/:id` (`:579`). Contrast `apps/merchant-control-plane/src/app/[store]/orders/page.tsx:742-825` where every action lives.
- **Expected:** the detail page is the canonical place to act on one order.
- **Blast radius:** every order workflow; compounds G-B-07 (there is nowhere natural to put invoice/packing-slip/label actions).
- **Invariant:** touches refunds → **[HIGH-STAKES]** by association.
- **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** lift the shared action component out of the list page and mount it on the detail page (single implementation, both surfaces), then hang invoice/packing-slip/returns off it.
- **Acceptance:** every action available on a list row is available on the detail page.
- **Tests required:** a UI test asserting action parity between list row and detail page.
- **Owner:** lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH

---

### G-B-18 — Campaign send toast reports "sent" as success even in sandbox
- **Domain:** merchant UI / honesty
- **Status:** `PARTIAL`
- **Impact:** After sending an email campaign in sandbox the merchant gets a green toast reading "Campaign sent — N emails sent." A correcting banner appears alongside it, but the toast is the immediate, dismissible signal and it is untrue.
- **Evidence:** `apps/merchant-control-plane/src/app/[store]/marketing/page.tsx:388-395` — the `notify({ title:'Campaign sent', description: \`${sentCount} email…s sent.\`, variant:'success' })` fires without consulting `result.sandbox`, which the same handler has in hand (`:373-379`). The honest banner is at `:612-624` ("no real emails delivered. Configure RESEND_API_KEY to send live").
- **Expected:** the toast reflects sandbox.
- **Invariant:** ANTI-R9 (`AGENTS.md:322`) · **Severity:** P3 · **Likelihood:** HIGH while sandbox is the default
- **Remediation approach:** branch the toast on `result.sandbox` (warning tone, "logged in sandbox — no emails delivered"). Consider a `ProviderModeBadge` on the campaigns surface for consistency.
- **Acceptance:** a sandbox send never produces a `variant:'success'` "sent" toast.
- **Owner:** lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH

---

### G-B-19 — Login page opts out of the design system entirely
- **Domain:** merchant UI / design system
- **Status:** `PARTIAL`
- **Impact:** The login/redirect page is styled with raw Tailwind palette classes and raw utilities instead of tokens, so it will not follow a brand or theme change and is the one merchant page whose dark mode is hand-rolled.
- **Evidence:** `apps/merchant-control-plane/src/app/[store]/login/page.tsx:23-26` — `bg-zinc-50 dark:bg-zinc-950`, `text-zinc-600 dark:text-zinc-400`, `border-zinc-300`, `h-8 w-8`, `rounded-full`, `border-2`, `mb-4`. It is one of only two `.tsx` files in the app that import nothing from `@letbuyy/ui`. ESLint's `@letbuyy/ui/no-tailwind-default-color` is set to `"warn"` (`apps/merchant-control-plane/eslint.config.mjs:21`), so this does not fail the build.
- **Blast radius:** one page, but it is the first thing an unauthenticated merchant sees.
- **Severity:** P3 · **Likelihood:** HIGH
- **Remediation approach:** rebuild on `@letbuyy/ui` primitives and `--lb-*` tokens; consider raising `no-tailwind-default-color` to `error` once the tail is cleared (26 raw radius classes across 12 files, 23 files with raw px / raw palette).
- **Owner:** lead engineer · **Reversibility:** fully reversible · **Confidence:** HIGH

---

## 13. Contradictions

1. **India-first dates vs a green contract test.** CLAUDE.md mandates `en-IN` dates; `tests/contracts/date-format-single-source.test.ts:29-30` asserts US-formatted output from `formatUsShortDate`/`formatUsLongDate`, which are used on merchant billing. Both are "authoritative" and they disagree. → G-B-10.
2. **Money units.** Payouts are `*_minor` bigint (`payouts/page.tsx:16-18`); orders are decimal major units (`packages/checkout-core/src/index.ts:1625-1628`, `services/api-gateway/src/routes/orders.ts:326-334,1104-1105`). The constitutional rule is "bigint minor units (paise) everywhere". The UI is consistent with the API on both, so the contradiction lives below me. → Agent D.
3. **Frozen runtimes advertised in live navigation.** `apps/{app-marketplace,theme-marketplace}/runtime.manifest.json` say `frozen-not-deployed`; the merchant UI links to `apps.letbuyy.com` (×3) and `themes.letbuyy.com` (×1), one of them as a nav destination's primary action. → G-B-15.
4. **Staff roles.** Three vocabularies (web / Flutter / the DB constraint quoted in `roles.ts:4-5`), none identical. → G-B-16.
5. **A settings phase references a nav item that does not exist.** `settings/page.tsx:37` lists `'localization'`; `SETTINGS_NAV_ITEMS` has no such entry; `.filter(Boolean)` at `:110` hides the mismatch. → G-B-12.
6. **Deprecated tokens are deleted by the producer and still consumed by the app.** `packages/typescript/ui/src/tokens.ts:1095-1097` deletes four aliases that 4–9 merchant files still reference. → G-B-06.
7. **Provider-mode badge coverage is better on mobile than on web.** Flutter badges the payouts surface (`money_screen.dart:220`); web does not. Same rule (`AGENTS.md:293` names web + Flutter), opposite outcomes. → G-B-05.

---

## 14. Unknowns (honest)

- **All runtime behaviour.** Nothing here was executed. No page was rendered, no proxy was called, no persistence observed. Every "IMPLEMENTED" verdict is a static-reading verdict.
- **Whether the gateway enforces `verifySiteOwnership` on `stores.getByHandle`** — the entire merchant tenancy model rests on it (`src/lib/auth/session.ts:128` passes the handle and ignores `_userId`). Agent A.
- **Whether server-side staff RBAC exists and is complete.** `tests/launch/lb-merchant-admin.test.mjs` names such tests; I did not read them. Agent A.
- **Whether the gateway validates GSTIN format** (G-B-13). Agent D/E.
- **The actual `employees.role` CHECK constraint** (G-B-16) — I did not open the migration.
- **Whether the internal HMAC header** (`src/lib/api/client.ts:62-80`, `INTERNAL_API_SECRET` / `LETBUYY_INTERNAL_API_SECRET`, names only) crosses a trust domain under ART-05. Agent A.
- **Whether the refund `amount_minor` is capped server-side** to the refundable remainder — the UI sends a client-typed amount. Agent D.
- **Whether the export's 100-row limit is also imposed by the gateway** (i.e. whether a client-side fix would even be sufficient). Agent D.
- **Whether any out-of-band manual process honours the checkout offers** in G-B-04 — I can only prove the repo does not implement them.
- **Flutter deeper behaviour** — I inventoried routes, services and the role gate. I did not trace Flutter screen actions to the mobile-BFF, and I did not build or run it (per instruction).
- **Actual rendering impact of the undefined tokens** — I reasoned from the CSS spec, I did not render the pages.
- **Whether `/accept-invite` survives the proxy bounce** — it is not in the `src/proxy.ts:18-26` allow-list, so an invited staffer without a session is redirected to accounts first; whether the invite token survives the round-trip is unverified.

## 15. Blockers

None. This audit was completable read-only. No external authority was required and no `BLOCKED_EXTERNAL` item was hit.
