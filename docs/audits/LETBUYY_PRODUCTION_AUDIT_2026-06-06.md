# LetBuyy — Full Production-Readiness Audit & UI/UX Hardening Plan
**Date:** 2026-06-06 · **Auditor role:** Principal Architect / Security / Production Systems
**Scope:** Entire monorepo (3,197 files, 10 apps, 9 service roots, 24 packages) with **primary focus on the Merchant app (web + mobile), UI/UX, and device responsiveness**, benchmarked against Shopify Admin (Winter '26).

> **How to read this.** Findings are evidence-backed with `file:line`. Severity: **P0** = blocks production / data-or-money risk · **P1** = blocks a credible launch · **P2** = quality/scale debt · **P3** = polish. Every claim was verified against source, not inferred.

---

## PART 0 — VERDICT IN ONE PAGE

**What LetBuyy actually is:** a multi-tenant, Shopify-like commerce + site-builder platform. Backend is a single Cloudflare Workers **API gateway** (Hono) over **Supabase Postgres** (233 tables, 352 RLS policies, 361 FKs). Frontends are **Next.js** apps (merchant, storefront, accounts, marketplaces, consoles) plus **Flutter** mobile apps (merchant, shopper, operator). Governance is enforced by `scripts/validate-governance.mjs` (**136 validators**).

**The headline truth — two things are simultaneously true:**

1. **The foundation is much stronger than "lots of issues" implies.** Real typed API client, server-side checkout pricing, a genuine idempotency adapter, 4-provider webhook HMAC + replay protection, bcrypt-12, fail-closed rate limiting, a 10,335-line design-token system, dark mode, and a 136-validator governance gate. This is **not** a mock-data prototype.

2. **But there are specific, verified, launch-blocking gaps** — and they cluster exactly where a merchant *feels* the product: the **theme editor previews fake products**, the **storefront cart lives only in `localStorage`**, **currency is hardcoded to ₹/`en-IN` in 32 files**, the **merchant AI sidebar calls a 404 endpoint**, **4 settings panes are "NEEDS BACKEND" stubs**, **10 of 12 deployable workspaces have no real tests**, and **observability emits zero metrics**.

**Production-ready next week?** Not the *whole* platform — that's a multi-month program (the team's own `CODEX_FOUNDATION_HARDENING_MISSION_V2` agrees). **But a focused, honest "Merchant Admin v1" can be launch-credible in one week** if you scope to: fix the verified P0 bugs, wire currency/locale, harden responsiveness to a real breakpoint system, and *gate or hide* the unfinished surfaces behind flags. Part 7 gives the exact 7-day plan.

**Shopify parity (merchant admin):** the repo's own forensic report scores **~43/90 (≈4.8/10)**. My independent read of the admin shell is **higher on UI craft** (the admin chrome is good) but **agrees on capability gaps**: no bulk editor, no command palette, no segments, no Markets/i18n, no real analytics charts, no metaobjects backend.

---

## PART 1 — SYSTEM OVERVIEW & ARCHITECTURE PHILOSOPHY

### 1.1 Domain (inferred, high confidence)
Multi-tenant **commerce platform + website builder**. The tenant primitive is a **`site`** (the word "store" is UI/URL only — `AGENTS.md` forbids a `stores` table). Each site has a `site_type` ∈ `{store, portfolio, resume, landing, blog}`, and the merchant admin **swaps its navigation per type** (`merchantNavigation.ts:205-211`). This is why you see "anomalous" routes — `ats-score`, `leads`, `gallery`, `testimonials`, `posts` — they are **not junk**; they are the portfolio/resume/landing/blog surfaces of a unified builder. Verified: each is real CRUD except `ats-score` (a single `StubPage`).

### 1.2 Runtime topology (verified against `pnpm-workspace` + manifests)

```
                          ┌─────────────────────────────────────────────┐
   BROWSERS / DEVICES     │            CLOUDFLARE EDGE                   │
 ┌───────────────────┐    │  ┌───────────────────────────────────────┐  │
 │ merchant-control- │────┼─▶│ services/api-gateway  (Hono /v1)       │  │
 │ plane  (Next.js)  │    │  │  • auth (3 credential types)          │  │
 ├───────────────────┤    │  │  • RBAC (5 roles, allowlist-backed)   │  │
 │ storefront-runtime│────┼─▶│  • Zod validation (20 schema files)   │  │
 ├───────────────────┤    │  │  • rate limiting (Upstash/KV, fail-   │  │
 │ identity-platform │────┼─▶│    closed in prod)                    │  │
 ├───────────────────┤    │  │  • idempotency adapter                │  │
 │ app/theme markets │    │  │  • server-side checkout pricing       │  │
 │ developer-portal  │    │  └───────────────┬───────────────────────┘  │
 │ platform consoles │    │                  │ service-role client      │
 ├───────────────────┤    │  ┌───────────────▼───────────────────────┐  │
 │ MOBILE (Flutter)  │    │  │ services/webhook-service  (HMAC+replay)│  │
 │ merchant / shopper│────┼─▶│ services/queue-workers    (5 CF queues)│  │
 │ / operator        │    │  └───────────────┬───────────────────────┘  │
 └───────────────────┘    └──────────────────┼──────────────────────────┘
                                              ▼
                              ┌──────────────────────────────┐
                              │ Supabase Postgres            │
                              │ 233 tables · 352 RLS · 361 FK │
                              │ 178 soft-delete · 13 version  │
                              └──────────────────────────────┘

 RESERVED (manifest-only, ZERO source — confirmed):
   checkout-runtime · search-service · media-service
   notification-service · event-bus · analytics-pipeline
```

**Package graph is a clean acyclic DAG** (verified — no circular imports): `shared-types` (leaf) → `event-core` → domain cores (`commerce/billing/checkout/payments/...`) → `application-services` → `runtime-composition`. Governance validator `circular-import-validator.mjs` actively enforces this.

### 1.3 Architectural philosophy (what the team is going for)
A **modular monolith** behind a single gateway, with strict layering pushed into packages: workflow authority in `application-services`, event/outbox/replay in `orchestration`, read aggregation in `runtime-composition`, provider SDKs in `infrastructure`. **Apps must never import apps; services never import apps; packages never import apps/services.** This is sound and Shopify-like (Shopify is famously a modular Rails monolith). The intent is good; the gaps are in *completion and honesty*, not in the blueprint.

### 1.4 The one architectural smell that matters for the merchant app
`AGENTS.md:176-177` mandates read aggregation live in `packages/runtime-composition`, but the **dashboard server component still computes aggregates inline** (`dashboard/page.tsx:119-308`: `loadSetupStatus`, `loadDashboardHomeData`, currency formatting). This is business logic in the presentation layer — minor today, but it's the seam where the hardcoded-₹ bug lives. Fix it where Part 4 says.

---

## PART 2 — CORE FOUNDATION ISSUES (VERIFIED, SEVERITY-RANKED)

> These are the "the foundation itself has issues" items you suspected. I kept only what I could verify in source. I separated **real bugs** from **honest stubs** (a labeled stub is debt, not a lie; an unlabeled mock that ships is the dangerous kind).

### P0 — Block production

| ID | Issue | Evidence | Why it's P0 |
|----|-------|----------|-------------|
| **F-1** | **Theme editor previews FAKE products.** The merchant designs their storefront against a hardcoded `PREVIEW_PRODUCTS` array, not their catalog. | `apps/merchant-control-plane/.../themes/[themeId]/editor/page.tsx:191`, rendered `:2080,:2104` | Merchants "design blind" and publish a theme they never truly saw. Core builder promise is broken. |
| **F-2** | **Storefront cart is `localStorage`-only.** No server cart; the `public.carts` table is unwired; GraphQL throws `CART_NOT_SUPPORTED`. | `apps/storefront-runtime/src/context/cart-context.tsx:28,43` (`lb_cart`) | Carts don't survive device switch, can't be recovered, no abandoned-cart, no server validation of price/stock at cart time. Revenue + integrity risk. |
| **F-3** | **Internal payment routes fail-OPEN off-production** (team's own regression **N-1**): unauthenticated `payment.confirm/fail/event` accepted when `INTERNAL_API_SECRET` unset **and** `ENVIRONMENT !== 'production'`; base `wrangler.toml` defaults `ENVIRONMENT="staging"`. | `FORENSIC_REPORT/08-error-misconfiguration.md`, `14-risk-assessment.md` (regression ledger). Siblings fail-closed: `app-store.ts:430`, `operations.ts:412` | Money-moving endpoints reachable without auth in any non-prod deploy. Must be fail-closed everywhere. |
| **F-4** | **Plaintext app secrets persisted ~24h** in `idempotency_keys.response_body` (`access_token` + show-once `signing_secret`) (regression **N-2**). | `FORENSIC_REPORT/06-apps-ecosystem.md` | Secret-at-rest exposure with a replay window. |
| **F-5** | **App billing fabricates payment refs** (`rzp_route_test_…`); no real money moves; compliance webhooks (`customers/data_request|redact`, `shop/redact`) **never emitted**. | `FORENSIC_REPORT/06-apps-ecosystem.md` (C-4, C-5) | If the app marketplace is "live," this is a legal/financial integrity gap. Gate it. |

### P1 — Block a credible launch

| ID | Issue | Evidence |
|----|-------|----------|
| **F-6** | **Currency/locale hardcoded to India** (`en-IN` + `INR`) in **32 merchant-web files / 81 occurrences**, even though `settings/general` lets the merchant pick USD/EUR/GBP. A USD store renders ₹. | verified grep = 32 files; `dashboard/page.tsx:303-307`, `analytics/page.tsx:86`, `orders/page.tsx:122,130` |
| **F-7** | **Merchant AI sidebar calls a 404 endpoint.** `/api/store-data?...type=product_count|payment_check` doesn't exist; errors swallowed, so setup todos always read `productCount=0`. The chat itself is a `setTimeout` fake ("AI responses coming soon"). | `AISidebar.tsx:136,145` + confirmed `src/app/api/store-data/` absent |
| **F-8** | **4 settings panes are "NEEDS BACKEND" stubs**: business (legal/GSTIN), localization, custom-data (metafields/metaobjects), security (2FA/passkeys/recovery). | `BackendNeededPane.tsx:34,67`; `settings-navigation.ts:51,59,105,184` |
| **F-9** | **Analytics revenue chart is permanently empty** — API hardcodes `revenueByMonth: []`. | `api/stores/[store]/analytics/route.ts:32` |
| **F-10** | **10/12 deployable workspaces have no real tests** (`echo 'No tests yet'`); the orphaned `.ts` security tests aren't wired to any runner (regression **N-3**). | `FORENSIC_REPORT/08-dead-code.md`; root glob only matches `tests/*/*.test.mjs` |
| **F-11** | **Observability emits no metrics** — `writeDataPoint` never called; no OTel/Prometheus client. You'll be blind in prod. | `FORENSIC_REPORT/14-risk-assessment.md` (C-14) |
| **F-12** | **Two prod deploy workflows race on push-to-main; no migration gate.** | `FORENSIC_REPORT/14` (H-15) |
| **F-13** | **God files**: `storefront.ts` = 4,833 lines; 11 files > 1,500 lines. | `FORENSIC_REPORT/11` |
| **F-14** | **Mobile merchant app: Razorpay unintegrated, order details + product edit are TODOs**; subscription/checkout ~30% complete. | `pricing_screen.dart:249`, `upgrade_screen.dart:324`, `orders_screen.dart:987`, `products_screen.dart:799` |

### P2 — Quality / scale debt
- **No schema validation on Next API routes** — they pass `request.json()` straight to the backend (no Zod at the app boundary; gateway does validate). `products/route.ts:61-65` and peers.
- **No route-level error boundaries** — zero `error.tsx`/`global-error.tsx` anywhere in merchant-web; a render throw shows Next's default white screen.
- **Over-clientization**: 81/101 components are `'use client'`; lists fetch `limit=100` and filter client-side — **no pagination/virtualization**.
- **`getErrorMessage` + currency/date format helpers copy-pasted into ~15 pages** — should be one shared util.
- **PostgREST `.or()` filter injection** on two public endpoints (`app-store.ts:724`, `themes.ts:160`) — `search` interpolated unsanitized (siblings strip `[%(),]` correctly).
- **3 tables without RLS**: `contacts` (PII), `projects`, `employee_permissions`.
- **Non-constant-time secret compares** on internal routes (`internal-secret.ts:12`, `internal-console.ts:56`, `webhook-service/src/index.ts:568,658`).

### What is NOT a problem (so you don't waste the week)
- Auth, session lifecycle, password hashing, webhook verification, idempotency, server-side pricing, rate limiting — **all solid**.
- No committed production secrets (placeholders only; `.gitignore` correct).
- Design-token system + dark mode in merchant-web — **genuinely good**.
- The "weird" resume/portfolio/blog routes — **intentional**, real CRUD.

---

## PART 3 — MERCHANT APP vs SHOPIFY ADMIN (WINTER '26) GAP MATRIX

Benchmark sourced from Shopify Help Center, `shopify.dev`, Polaris token docs, and Editions Summer '25 / Winter '25 / Winter '26 (URLs in Appendix A).

### 3.1 Capability gap matrix (●=present & wired · ◐=partial/stub · ○=absent)

| # | Capability (2026 table-stakes) | Tag | Shopify | LetBuyy web | LetBuyy mobile | Evidence / note |
|---|--------------------------------|-----|:------:|:----------:|:-------------:|-----------------|
| 1 | Product CRUD + variants + media | core | ● | ● | ◐ | web real; mobile edit = TODO (`products_screen.dart:799`) |
| 2 | Collections (manual + automated) | core | ● | ◐ | ○ | manual only |
| 3 | Multi-location inventory + transfers + POs | expected | ● | ● | ○ | web has inventory/transfers/purchase-orders routes |
| 4 | **Bulk editor (inline, column-config) + CSV** | core | ● | ○ | ○ | CSV import/export exists; **no inline bulk editor** |
| 5 | Metafields / **Metaobjects** | expected | ● | ○ | ○ | `custom-data` = NEEDS-BACKEND stub (F-8) |
| 6 | Orders index: saved views, filters, bulk actions | core | ● | ◐ | ◐ | saved views ✓, bulk actions partial |
| 7 | Draft/manual orders | core | ● | ○ | ○ | absent |
| 8 | Abandoned checkout recovery | expected | ● | ○ | ○ | blocked by F-2 (no server cart) |
| 9 | Returns / exchanges / refunds | expected | ● | ◐ | ○ | refund RPCs exist; UI thin |
| 10 | Customer profiles + accounts | core | ● | ● | ◐ | web real |
| 11 | **Customer segments (query-based)** | expected | ● | ○ | ○ | absent |
| 12 | RFM / lifecycle report | diff | ● | ○ | ○ | absent |
| 13 | Discounts (code+auto, prod/order/ship) | core | ● | ◐ | ○ | coupons exist; not full discount engine |
| 14 | Integrated payments | core | ● | ◐ | ◐ | Razorpay wired server-side; mobile TODO (F-14) |
| 15 | **One-page checkout / Shop-Pay-equiv** | expected | ● | ○ | ○ | absent |
| 16 | Gift cards | expected | ● | ● | ○ | `products/gift-cards` route real |
| 17 | Subscriptions | diff | ● | ○ | ◐ | mobile shell only |
| 18 | Automated tax + nexus | expected | ● | ◐ | ○ | tax settings exist; not automated calc |
| 19 | Shipping zones + carrier rates | core | ● | ◐ | ○ | shipping settings exist; no live carrier rates |
| 20 | **Markets: multi-currency/-language** | expected | ● | ○ | ○ | **F-6** hardcodes ₹; localization stub |
| 21 | B2B (companies, price lists, terms) | diff | ● | ○ | ○ | absent |
| 22 | POS / in-person | diff | ● | ○ | ○ | absent |
| 23 | Analytics: overview + Live View + reports | core | ● | ◐ | ◐ | metric cards ✓; **revenue chart empty (F-9)**; no Live View |
| 24 | Query language (ShopifyQL-equiv) | diff | ● | ○ | ○ | absent |
| 25 | **Command-palette search (Cmd+K)** | expected | ● | ○ | ○ | **absent** — big UX gap |
| 26 | Home: tasks + metrics + insights + alerts | expected | ● | ◐ | ◐ | setup checklist ✓ but fed by 404 (F-7); no insights/alerts feed |
| 27 | Staff accounts + **RBAC** | expected | ● | ◐ | ○ | users route ✓; security/2FA = stub (F-8) |
| 28 | Store activity / audit log (UI) | expected | ● | ○ | ○ | audit tables exist in DB; no merchant-facing log |
| 29 | Workflow automation (Flow-equiv) | diff | ● | ○ | ○ | absent |
| 30 | Webhooks + versioned API + Functions | core | ● | ◐ | — | gateway `/v1` ✓; app Functions WASM limit unenforced (H-5) |
| 31 | Conversational AI (Sidekick-equiv) | diff | ● | ○ | ○ | **F-7** sidebar is a fake `setTimeout` |
| 32 | Embedded AI authoring (Magic-equiv) | diff | ● | ○ | ○ | absent |

**Score:** core/expected coverage is roughly **9 ● / 13 ◐ / 10 ○** across 32 lines — directionally matching the repo's own 43/90. The **biggest felt gaps for a merchant** are: command palette (#25), bulk editor (#4), real analytics charts (#23/F-9), segments (#11), Markets/currency (#20/F-6), and a working AI/home (#26/#31).

### 3.2 Shopify mechanics you should copy (cheap, high-impact)
- **Command palette** — `Cmd/Ctrl+K`, ≤7 results then "show more," scoped filters (Orders/Products/Customers/Settings), `?` for shortcuts. This is the single highest-leverage UX addition.
- **Index table → condensed cards at `<490px`** (Polaris `condensed`/`smDown`), bulk-select hidden below 490px. This is *the* responsive pattern you need (Part 4).
- **Home = tasks + metrics + insight cards + alerts bell** with unread counts.
- **Saved views as tabs** on every index (you already have this — keep it).
- **Settings has its own search** that highlights the matched control (you have a `SettingsSearch` — wire highlight).

---

## PART 4 — UI/UX & DEVICE RESPONSIVENESS (PRIMARY FOCUS)

### 4.1 Current state — honest scorecard

**Strengths (keep these):**
- **Real design-token system.** `globals.css` = 10,335 lines of `--lb-*` tokens (spacing/radius/motion/color/type) + a `@theme inline` Tailwind bridge. Components use `text-[var(--lb-color-text)]` etc. **Raw hex is rare.** This is better than most startups ship.
- **Dark mode works** end-to-end with flash-prevention (`layout.tsx:44-61`) and a `.dark` token set.
- **Mobile chrome exists**: fixed 226px sidebar collapses to an overlay drawer + hamburger (`globals.css:291-308,654-665,751-769`; `AdminShell.tsx:46,83-92`); the store-switcher becomes a **bottom sheet with a drag handle** on mobile (`HeaderBar.tsx:198-286`). Touch targets bumped to 32–46px under `@media(max-width:768px)`.
- **Accessibility baseline is real**: `aria-current/expanded/controls/label` on nav, `role="progressbar"` with min/max, `focus-visible:ring`, `sr-only` file inputs, focus-trap in the settings drawer, `<html lang>`, robots noindex.

**Weaknesses (fix these):**

| ID | Weakness | Evidence | Impact |
|----|----------|----------|--------|
| **U-1** | **Responsiveness is uneven & ad-hoc.** Only **43 of ~62 page files** use any `sm/md/lg` class, and many have just 1–2 `md:` breakpoints. Layout responsiveness leans on hand-written CSS media queries, not a shared system. | grep: 43 files | Inconsistent behavior tablet→phone; each page reinvents it. |
| **U-2** | **Index tables don't adapt to mobile.** Lists rely on a shared `IndexTable` and hand-rolled `<table>` wrapped in `overflow-x-auto` (`leads/page.tsx:263`) — i.e. **horizontal scroll**, not Shopify's card-collapse. | `leads`, `products`, `orders` | Tables are the merchant's main surface; horizontal scroll on a phone is the worst pattern. |
| **U-3** | **No route-level error/empty/loading consistency.** One `loading.tsx` (dashboard only); **zero `error.tsx`**; in-component skeletons vary page to page. | Glob: 1 `loading.tsx`, 0 `error.tsx` | A thrown render = unbranded white screen. |
| **U-4** | **No fluid type / no container queries.** Fixed font sizes; magic widths (`226px`, `52px`, `286px minmax(0,840px)`). | `globals.css:48,291,1991` | Doesn't scale to large desktops or small phones gracefully. |
| **U-5** | **2,244-line single-client theme editor** ships entirely to the browser; device-preview toggle exists but previews **fake data** (F-1). | `editor/page.tsx` | Heavy bundle + broken core flow. |
| **U-6** | **Mobile (Flutter) has no tablet layout** and no custom text-scaling; `ResponsiveHelper` exists in `packages/dart/core` but is barely adopted (most screens call `MediaQuery.sizeOf` directly). | `responsive_helper.dart:1-80` (low adoption) | Tablets get stretched phone UI; large-font accessibility breaks layouts. |

### 4.2 The responsive system to adopt (single source of truth)

Stop hand-writing media queries per page. Adopt **one breakpoint scale** (mirroring Polaris so your behavior matches the benchmark) as tokens, and drive **both** Tailwind and CSS from it.

```
TOKEN              MIN-WIDTH   DEVICE INTENT          KEY BEHAVIOR CHANGE
--lb-bp-xs           0px       small phone            single column; cards; bottom-sheet actions
--lb-bp-sm         490px       large phone            index tables COLLAPSE → stacked cards;
                                                        bulk-select hidden below this
--lb-bp-md         768px       tablet / split         sidebar → toggle; 2-col forms; tables show
                                                        priority columns w/ horizontal-scroll fallback
--lb-bp-lg        1040px       laptop                 persistent sidebar; full tables, inline bulk
--lb-bp-xl        1440px       desktop                max content width caps; multi-column dashboards
```

Implementation rules:
1. **Map these into Tailwind** in the `@theme` block so `sm:`/`md:`/`lg:`/`xl:` resolve to *these* px values (Tailwind defaults are 640/768/1024/1280 — re-point them to 490/768/1040/1440 so code and benchmark agree).
2. **Mobile-first (`min-width` / `up`)** everywhere — never `max-width` patches.
3. **Fluid type**: add `--lb-font-step-*` using `clamp()` (e.g. body `clamp(0.875rem, 0.8rem + 0.3vw, 1rem)`), so text scales without per-breakpoint overrides.
4. **Container queries** for self-contained modules (cards, the index table, embedded-app panels) so they adapt to *their* width, not the viewport — matches Shopify's Web-Components direction and fixes the settings split-pane.

### 4.3 The one component that fixes the most: a responsive `IndexTable`

Today's tables horizontal-scroll on phones (U-2). Replace with a single shared `<IndexTable>` that renders **two layouts from one data/columns contract**:

```
DESKTOP (≥ md)                          PHONE (< sm, 490px)
┌──────────────────────────────────┐    ┌────────────────────────────┐
│ ☐ │ Product   │ Status │ Inv │ ₹ │    │ ┌────────────────────────┐ │
│───┼───────────┼────────┼─────┼───│    │ │ Aurora Tee        ● Live│ │  ← card per row
│ ☐ │ Aurora Tee│ ● Live │  42 │399│    │ │ SKU AUR-01 · 42 in stk │ │
│ ☐ │ Boreal Cap│ ◐ Draft│   8 │299│    │ │ ₹399          [• • •] │ │  ← row actions in menu
│───┴───────────┴────────┴─────┴───│    │ └────────────────────────┘ │
│ ◀ 1 2 3 … ▶     showing 1–50/214 │    │ ┌────────────────────────┐ │
└──────────────────────────────────┘    │ │ Boreal Cap       ◐ Draft│ │
  bulk-select visible, inline edit       │ │ SKU BOR-09 · 8 in stk  │ │
                                         │ └────────────────────────┘ │
                                         │  [ Load more ]  1–50 / 214 │
                                         └────────────────────────────┘
  Rule: at < --lb-bp-sm (490px) → cards + hide bulk-select (Shopify parity).
  Always: server-side pagination (you fetch limit=100 and filter client-side today — change to cursor paging).
```

This single change upgrades products, orders, customers, leads, inventory, collections, posts, comments, reviews — every index — at once, and removes the per-page responsive drift (U-1).

### 4.4 Per-screen responsive + states plan (merchant web)

For each, the table gives: **responsive action**, **loading**, **empty**, **error**. (✓ = already adequate; ✗ = add.)

| Screen | Responsive action | Loading | Empty | Error |
|--------|-------------------|:------:|:----:|:----:|
| **Dashboard/Home** | hero `lg:grid-cols-[1fr_280px]`✓; make metric grid `grid-cols-2 md:grid-cols-4`; **fix setup feed (F-7)**; add insight + alerts cards | ✓ skeleton | ✓ | ✗ add `error.tsx` |
| **Products list** | swap to responsive IndexTable (4.3); server paging | ✓ | ✓ | ✗ banner+retry exists, add boundary |
| **Product new/edit** | 2-col → 1-col `md:`; sticky SaveBar already ✓; add price/SKU/number validation (Zod) | ✓ | n/a | ✓ |
| **Orders** | responsive IndexTable; order-detail drawer on mobile | ✓ | ✓ | ✓ |
| **Customers** | responsive IndexTable + avatar; segments later | ✓ | ✓ | ✗ |
| **Analytics** | metric cards `grid-cols-2 md:grid-cols-4`; **wire revenue chart (F-9)**; chart min-height + responsive container | ✓ | ◐ | ✗ |
| **Settings (all)** | `SettingsShell` split-pane → container-query single col `<md`; drawer ✓; **replace 4 NEEDS-BACKEND panes (F-8) or hide via flag** | ✓ | n/a | ✗ |
| **Theme editor** | **fix preview data (F-1)**; code-split the 2,244-line file; device toggle ✓; make panels container-query | ◐ | n/a | ✗ |
| **Appearance/Experience** | forms `md:grid-cols-2`; live preview swatches ✓ | ✓ | n/a | ✓ |

**Global adds (apply once, helps all):**
- `app/[store]/error.tsx` + `app/global-error.tsx` — branded fallback with reset button.
- `app/[store]/loading.tsx` shared skeleton (today only dashboard has one).
- A `<DataState>` wrapper (loading→skeleton, empty→illustration+CTA, error→retry) so every page stops reinventing it.
- **Command palette** (`Cmd/Ctrl+K`) — see Part 3.2.

### 4.5 ASCII wireframes — target responsive admin

**Desktop dashboard (≥ lg):**
```
┌────────────┬──────────────────────────────────────────────────────────────┐
│ ☰ LetBuyy  │  🔎 Search (⌘K)                       🔔3   ◐ dark   ▼ Store  │
│            ├──────────────────────────────────────────────────────────────┤
│ ⌂ Home     │  Good morning, Saai            Plan: Growth · Trial 6d left   │
│ ▤ Orders   │  ┌──────────┬──────────┬──────────┬──────────┐  ┌──────────┐  │
│ ⬚ Products │  │ Revenue  │ Orders   │ Sessions │ Conv.    │  │ SET-UP   │  │
│ ◔ Customers│  │ ₹84,200  │   126    │  3,940   │  2.1%    │  │ ▣▣▣▢▢ 3/5│  │
│ ◰ Discounts│  │ ▲ 12%    │ ▲ 4%     │ ▼ 1%     │ ▲ 0.3pp  │  │ • Add pay │  │
│ ◫ Content  │  └──────────┴──────────┴──────────┴──────────┘  │ • 1st prod│  │
│ ⬡ Markets  │  ┌───────────────────────────────────────────┐  └──────────┘  │
│ ▦ Analytics│  │ Revenue (last 30d)            [▣ line ▾]   │  ┌──────────┐  │
│ ─────────  │  │     ╭╮      ╭─╮                            │  │ ALERTS    │ │
│ ⚙ Settings │  │  ╭──╯╰─╮ ╭──╯ ╰──╮   ╭────                 │  │ ⚠ 2 unpaid│ │
│            │  │ ─╯     ╰─╯       ╰───╯                     │  │ ⓘ tax due │ │
│            │  └───────────────────────────────────────────┘  └──────────┘  │
└────────────┴──────────────────────────────────────────────────────────────┘
```

**Phone dashboard (< sm):**
```
┌──────────────────────────────┐
│ ☰   LetBuyy        🔎  🔔3  ▼ │  ← hamburger opens sidebar drawer; ▼ = bottom-sheet store switch
├──────────────────────────────┤
│ Good morning, Saai           │
│ ┌────────────┬────────────┐  │  ← metrics 2-up, not 4
│ │ ₹84,200 ▲12│ 126 orders │  │
│ ├────────────┼────────────┤  │
│ │ 3,940 sess │ 2.1% conv  │  │
│ └────────────┴────────────┘  │
│ ┌──────────────────────────┐ │
│ │ Set-up   ▣▣▣▢▢  3 of 5   │ │
│ │ • Add a payment provider │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Revenue (30d)            │ │  ← chart full-width, min-height, scrollable legend
│ │   ╭─╮   ╭──╮  ╭───        │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  ⌂      ▤      ⬚      ◔     ⚙ │  ← OPTIONAL bottom tab bar on phone (Home/Orders/Products/Cust/More)
└──────────────────────────────┘
```

**Form validation state (product new):**
```
┌ Title ─────────────────────────────┐   ┌ Price ──────────────┐
│ Aurora Tee                         │   │ ₹ |                 │ ⛔ Required
└────────────────────────────────────┘   └─────────────────────┘
  ⛔ "Enter a price greater than 0"   ← inline, aria-describedby, red token, not just a toast
┌──────────────────────────────────────────────────────────────┐
│  Unsaved changes        [ Discard ]            [ Save ]        │ ← sticky SaveBar, disabled until valid+dirty
└──────────────────────────────────────────────────────────────┘
```

**Empty / error / loading (the `<DataState>` contract):**
```
LOADING            EMPTY                          ERROR
┌────────────┐     ┌──────────────────────────┐   ┌──────────────────────────┐
│ ▥▥▥▥▥▥▥▥   │     │        (illustration)     │   │   ⚠  Couldn't load orders │
│ ▥▥▥▥  ▥▥   │     │  No orders yet            │   │   Network error          │
│ ▥▥▥▥▥▥▥▥   │     │  Orders appear here when   │   │   [ Retry ]   [ Details ] │
│ ▥▥▥  ▥▥▥   │     │  customers buy.           │   │                          │
│            │     │  [ Create draft order ]   │   │                          │
└────────────┘     └──────────────────────────┘   └──────────────────────────┘
 skeleton, not     actionable empty, not blank     retryable, not white-screen
 a bare spinner
```

### 4.6 Flutter (mobile merchant) responsiveness plan
- **Adopt `ResponsiveHelper` everywhere** (`packages/dart/core/.../responsive_helper.dart`) — it already defines mobile<768 / tablet 768–1200 / desktop>1200 and `getGridCount/getPadding/getMaxContentWidth`. Today most screens bypass it.
- **Add a tablet master-detail**: on ≥768dp, products/orders show list + detail side-by-side (`LayoutBuilder`); on phone, push detail as a route. This is the biggest mobile win and removes the "stretched phone UI" smell (U-6).
- **Respect text scaling**: stop hardcoding font sizes in `store_theme.dart`; cap `MediaQuery.textScaler` to a sane range (e.g. 0.9–1.3) and use `Flexible`/`Wrap` so large-font users don't overflow.
- **Wire the TODOs (F-14)**: order detail, product edit, Razorpay subscribe — or hide those entries behind a feature flag for v1.
- **Add offline + retry**: there's no offline handling; at minimum show a retry affordance and cache the last successful list.

### 4.7 Accessibility punch-list (WCAG 2.1 AA — Shopify's bar)
- Run the `design:accessibility-review` skill on the top 6 screens. Quick wins to verify: 4.5:1 contrast on token pairs (audit `--lb-color-text` on every surface incl. dark), focus-visible on **all** interactive elements (cards/rows currently click via `<div>` in places — make them real buttons/links), `aria-live` on toast region, table header `scope`, and `prefers-reduced-motion` honored for the 300–350ms transitions.

---

## PART 5 — CROSS-APP CONFIG LOOPS & DRIFT (what you specifically asked about)

You suspected "loops and cross-app config" problems. Here's the verified picture — the news is **mostly good**, with a few sharp edges.

### 5.1 Dependency loops — NONE (verified)
The `@letbuyy/*` workspace graph is acyclic. `circular-import-validator.mjs` does DFS cycle detection over runtime + package roots and is part of the 136-validator gate. No package transitively imports itself. **This is not where your problem is.**

### 5.2 Config single-source-of-truth — mostly enforced, 3 drift risks

| ID | Drift / loop risk | Evidence | Fix |
|----|-------------------|----------|-----|
| **X-1** | **`ENVIRONMENT` default = "staging"** in base `wrangler.toml` is the trigger for the fail-open payment route (F-3/N-1). A config default creates a security hole. | base `wrangler.toml`; `FORENSIC_REPORT/14` | Make internal-route auth fail-closed **regardless** of env; never branch security on `ENVIRONMENT`. |
| **X-2** | **Duplicated `gateway-events.ts`** (4 copies of internal-fetch boilerplate across webhook-service + queue-workers) — regression **N-5**. Divergence = inconsistent event contracts. | `FORENSIC_REPORT/10-duplication.md` | Extract to one shared package export. |
| **X-3** | **Two production deploy workflows race on push-to-main, no migration gate** (F-12/H-15). | `FORENSIC_REPORT/14` | One deploy workflow; migrations gated before app deploy (Part 7 Day 6). |
| **X-4** | **Nested `database/supabase/supabase/.temp/`** duplicate CLI link state (a stray `supabase link` from the wrong dir). Untracked + gitignored, but leaks prod project/org refs locally. | filesystem scan | Delete the nested dir; confirm `.gitignore` covers both. |

### 5.3 Manifest honesty — enforced
Every runtime root has a local `AGENTS.md` + `runtime.manifest.json`; the 6 reserved services are **manifest-only with zero source** (verified) and validator-locked as `reserved-not-implemented`. Env ownership is centralized in `config/env/ownership/runtime-env-ownership.json` + `staging-production-secret-matrix.json` (which forbids local env files and mandates secret-manager-only). **No contradictory env definitions found across apps.** The governance layer here is genuinely doing its job — your cross-app config is *more* disciplined than typical.

**Net:** the "loops" you feared are not import cycles or config sprawl. The real cross-app hazard is **X-1** (a security default) and **X-3** (deploy race). Both are in Part 7.

---

## PART 6 — DATA, SECURITY, API & TRANSACTION HARDENING

> The DB schema is already production-grade (233 tables, 352 RLS policies, 361 FKs, 178 soft-deletes, audit tables). I am **not** proposing a from-scratch rebuild — that would destroy good work. I list only the **real, verified gaps** plus the exact SQL/endpoint fixes.

### 6.1 Database — targeted fixes (not a rewrite)

**D-1 · Add RLS to the 3 unprotected tables.** `contacts` (PII: name/email/message), `projects`, `employee_permissions` have no RLS while peers do. Latent cross-tenant exposure if any anon/authenticated key path touches them.

```sql
-- migration: 0NN_rls_contacts_projects_employee_permissions.up.sql
ALTER TABLE public.contacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;

-- contacts/projects are site-scoped → mirror the existing store_owner_* pattern
CREATE POLICY site_owner_contacts ON public.contacts
  USING (site_id IN (SELECT s.id FROM public.sites s
                     WHERE s.user_id = auth.uid() OR s.custom_user_id = auth.uid()));
CREATE POLICY site_owner_projects ON public.projects
  USING (site_id IN (SELECT s.id FROM public.sites s
                     WHERE s.user_id = auth.uid() OR s.custom_user_id = auth.uid()));
-- employee_permissions: restrict to the owning org/site admin (adjust to your column)
CREATE POLICY admin_employee_permissions ON public.employee_permissions
  USING (site_id IN (SELECT s.id FROM public.sites s
                     WHERE s.user_id = auth.uid() OR s.custom_user_id = auth.uid()));
```
```sql
-- 0NN_..._down.sql
DROP POLICY IF EXISTS site_owner_contacts ON public.contacts;
DROP POLICY IF EXISTS site_owner_projects ON public.projects;
DROP POLICY IF EXISTS admin_employee_permissions ON public.employee_permissions;
ALTER TABLE public.contacts            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_permissions DISABLE ROW LEVEL SECURITY;
```

**D-2 · Make RLS match the app's auth model.** Existing tenant policies key on `sites.user_id = auth.uid()` **only**, but the app authorizes on `user_id` **OR** `custom_user_id` (internal-SSO users live in `users_custom`, not Supabase `auth.users`). So RLS is a weak backstop for a whole class of users. Add the `custom_user_id` arm to the high-value policies (the snippet in D-1 already shows the pattern). This is defense-in-depth, not the primary boundary (the gateway uses service-role), but you advertised "every table RLS-protected" — make it true.

**D-3 · Server cart table (unblocks F-2).** `public.carts` exists but is unwired. Wire it so cart = server state with a guest token, then localStorage is only a cache.

```sql
-- carts already exist; ensure cart_items + indexes + a single-writer RPC
CREATE TABLE IF NOT EXISTS public.cart_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id      uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  site_id      uuid NOT NULL REFERENCES public.sites(id),
  product_id   uuid NOT NULL REFERENCES public.products(id),
  variant_id   uuid REFERENCES public.product_variants(id),
  quantity     integer NOT NULL CHECK (quantity > 0),
  unit_price   numeric(12,2) NOT NULL,          -- snapshot; re-validated server-side at checkout
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  version      integer NOT NULL DEFAULT 0,       -- optimistic locking
  UNIQUE (cart_id, product_id, variant_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id) WHERE deleted_at IS NULL;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
-- mutate via rpc('cart_upsert_item', ...) so price/stock are validated in one transaction (matches your checkout pattern)
```

### 6.2 Security — the must-fixes (verified)

| ID | Fix | Where | Justification |
|----|-----|-------|---------------|
| **S-1 (P0)** | **Internal routes fail-closed in ALL envs.** Remove the `ENVIRONMENT !== 'production'` bypass; require `INTERNAL_API_SECRET` unconditionally. | payment internal routes (N-1); see X-1 | Unauthenticated money endpoints off-prod. |
| **S-2 (P0)** | **Stop persisting plaintext `access_token`/`signing_secret`** in `idempotency_keys.response_body`; redact before store (you already have `replayable-secret-redaction.ts`). | N-2 | Secret-at-rest + replay window. |
| **S-3 (P1)** | **Sanitize `.or()` search** — `search.replace(/[%(),]/g,'')` before interpolation. | `app-store.ts:724`, `themes.ts:160` (orders/media do it right) | PostgREST filter injection. |
| **S-4 (P1)** | **Constant-time secret compare** on internal routes (use existing `timingSafeEqualText`). | `internal-secret.ts:12`, `internal-console.ts:56`, `webhook-service:568,658` | Timing side-channel. |
| **S-5 (P2)** | **Session rotation.** 30-day fixed-TTL opaque session, no sliding/rotation; only `last_active` bumps. Add rotation on privilege change + sliding expiry. | `auth-core/index.ts:126`; `middleware/auth.ts:146-149` | Stolen-token blast radius. |
| **S-6 (P2)** | **Keep `CUSTOMER_LEGACY_AUTH` OFF in prod** (it enables same-store customer IDOR via `customer_id` query param; store-membership check still blocks cross-store). | `middleware/customer-session.ts:32`; `storefront.ts:4247,4585` | IDOR within a store. |
| **S-7 (P2)** | **Add Zod at the Next API boundary** (today routes pass `request.json()` through). Reuse canonical schemas from domain packages. | `products/route.ts:61-65` & peers | Defense-in-depth + better errors. |

**Already strong (don't touch):** bcrypt-12, 3-credential auth with server-side session expiry+revocation, httpOnly/secure/sameSite cookies, CSRF double-submit, Turnstile on login, 4-provider webhook HMAC + replay (`payment_webhook_events` unique on `provider,provider_event_id`), fail-closed rate limiting, server-side checkout pricing, the idempotency adapter (request-hash mismatch → 409).

### 6.3 API contract — fill the two holes

The gateway is already `/v1`, Zod-validated, paginated. Two endpoint gaps block merchant UX:

**A-1 · `GET /v1/stores/:store/analytics/revenue` must return real series** (fixes F-9). Contract:
```
GET /v1/stores/{store}/analytics/revenue?from=2026-05-01&to=2026-05-31&granularity=day
→ 200 { "currency":"INR", "granularity":"day",
        "series":[{"t":"2026-05-01","revenue":3200.00,"orders":11}, ...],
        "totals":{"revenue":84200.00,"orders":126} }
Auth: store owner. Errors: 401 {error:{code:"UNAUTHENTICATED"}}, 404 store, 422 bad range.
```

**A-2 · `/api/store-data` must exist or AISidebar must stop calling it** (fixes F-7). Either add the Next route proxying `product_count`/`payment_check`, or remove the dead fetches and feed the setup checklist from the existing dashboard loader. Prefer the latter for the week-1 scope.

### 6.4 Transactions — already correct, one rule to keep
Multi-step writes go through Postgres RPCs (`create_checkout_order`, `*_with_ledger`, inventory `adjust_*`) — atomic, server-priced, idempotent, with order-quota checks and fail-closed "migrations required" guards. **Keep enforcing**: every new money/stock mutation must be one RPC + an idempotency key, never multiple client round-trips. The `single-writer-ownership-validator.mjs` already guards this — don't regress it.

---

## PART 7 — THE ONE-WEEK PLAN (realistic, scoped to "Merchant Admin v1")

**Framing:** You cannot make the *entire* platform production-ready in a week (your own mission doc spans F2–F8). You **can** ship a **launch-credible Merchant Admin v1** by fixing verified P0/P1 bugs, nailing responsiveness (your priority), and **gating** unfinished surfaces honestly behind feature flags so nothing ships as a lie. Sequence below assumes 1–2 engineers; each day ends green on `validate:governance`.

```
DAY 1 — STOP THE BLEEDING (P0 security + honesty)
  • S-1 internal routes fail-closed in all envs (X-1)          ▸ services/api-gateway
  • S-2 redact app secrets from idempotency response_body
  • Feature-flag OFF in prod: app-marketplace billing (F-5),
    compliance-webhook claims, mobile Razorpay/subscribe (F-14)
  • Delete nested supabase/.temp (X-4); single deploy workflow stub
  GATE: 136 validators green; no unauth money path.

DAY 2 — CURRENCY/LOCALE + DEAD ENDPOINTS (F-6, F-7, F-9)
  • Replace 32-file en-IN/INR hardcode with store.currency/locale:
       one `formatMoney(amount, store.currency, store.locale)` util,
       delete the 15 copy-pasted helpers.
  • Kill /api/store-data dead fetch; feed setup checklist from
    dashboard loader (A-2). Make AISidebar chat hidden behind flag
    until real (no fake "coming soon" shipping).
  • Wire revenue series endpoint A-1 → analytics chart (F-9).
  GATE: USD store shows $, not ₹; dashboard checklist accurate.

DAY 3 — RESPONSIVE SYSTEM (your #1 priority, part 1)
  • Add --lb-bp-* tokens; re-point Tailwind sm/md/lg/xl to
    490/768/1040/1440; add clamp() fluid type (4.2).
  • Build the responsive <IndexTable> (4.3): cards <490px,
    hide bulk-select, server cursor paging.
  • Roll it into products + orders + customers first.
  GATE: products/orders/customers usable on a 390px phone w/o
        horizontal scroll.

DAY 4 — RESPONSIVE SYSTEM (part 2) + STATES
  • Roll IndexTable into leads/inventory/collections/posts/comments.
  • Add app/[store]/error.tsx + global-error.tsx + shared loading.tsx.
  • Ship <DataState> wrapper (loading/empty/error) and apply to all
    index + detail screens (4.5 wireframes).
  • Settings: container-query single-col <md; HIDE the 4 NEEDS-BACKEND
    panes behind flags (F-8) instead of showing stubs.
  GATE: no white-screen on thrown render; every list has 3 states.

DAY 5 — THEME EDITOR + MOBILE (F-1, U-5, U-6)
  • F-1: feed the editor real catalog (replace PREVIEW_PRODUCTS with a
    fetch of the store's first N products); if backend preview pipe
    isn't ready, label the canvas "Sample data" honestly + flag.
  • Code-split the 2,244-line editor (lazy panels).
  • Flutter: adopt ResponsiveHelper on top 6 screens; tablet
    master-detail for products/orders; cap textScaler (4.6).
  GATE: merchant previews THEIR products; tablet ≠ stretched phone.

DAY 6 — COMMAND PALETTE + A11Y + DEPLOY SAFETY
  • Cmd/⌘K palette: scoped search Orders/Products/Customers/Settings,
    ≤7 results + "show more", ? shortcuts (3.2). Highest UX leverage.
  • Run design:accessibility-review on top 6 screens; fix contrast,
    focus-visible, make clickable <div>s real buttons (4.7).
  • One deploy workflow + migration gate before app deploy (X-3/F-12).
  GATE: keyboard-only nav works; one ordered deploy.

DAY 7 — TEST + VERIFY + STAGE SIGN-OFF
  • Wire orphaned .ts contract tests into a runner; add an off-prod
    auth-failure test that would have caught N-1 (F-10/N-3).
  • Playwright smoke: login → dashboard → create product → place test
    order → see it in orders, at 390px AND 1440px.
  • Lighthouse mobile on dashboard/products/checkout; fix < ~85.
  • S-3 (.or sanitize) + S-4 (constant-time compares) + D-1 (RLS) as
    they land. Tag merchant-admin-v1; write release notes listing
    what's flagged-off so launch is honest.
  GATE: green build/lint/typecheck/governance + smoke passes on
        phone & desktop.
```

### What stays explicitly OUT of week 1 (and should be flagged-off, not faked)
Server cart/abandoned-checkout (F-2 — needs D-3 + storefront work, ~1–2 wks), bulk editor, customer segments, Markets/B2B/POS, real Sidekick AI, metaobjects backend (F-8), one-page checkout, app-marketplace real payouts. **Ship these dark.** A merchant admin that does products/orders/customers/settings/themes *well and responsively* is a credible v1; one that *pretends* to do AI, payouts, and i18n is not.

### Definition of "launch-credible v1"
1. No unauthenticated money path (S-1/S-2). 2. Correct currency everywhere (F-6). 3. No 404-fed or fake UI shipping (F-7); unfinished = flagged-off, not stubbed-in. 4. Every index/detail screen works at 390px and 1440px with loading/empty/error states. 5. Theme editor previews real products (F-1). 6. Command palette + AA accessibility on the top 6 screens. 7. One ordered, migration-gated deploy + a smoke test that exercises the happy path on phone and desktop.

---

## APPENDIX A — Sources

**Repository (file:line cited throughout):** `apps/merchant-control-plane/**`, `apps/mobile/merchant-app/**`, `apps/storefront-runtime/src/context/cart-context.tsx`, `services/api-gateway/**`, `database/supabase/migrations/000_baseline.sql`, `config/**`, `scripts/validate-governance.mjs`, `AGENTS.md`, `FORENSIC_REPORT/**`, `FORENSIC_REPORT_OPERATIONS/**`, `CODEX_FOUNDATION_HARDENING_*`.

**Shopify benchmark (Winter '26):**
- Admin overview · https://help.shopify.com/en/manual/shopify-admin/shopify-admin-overview
- Admin search (Cmd+K, 7/20 results, filters) · https://help.shopify.com/en/manual/shopify-admin/admin-search
- Home (tasks/metrics/insights/alerts) · https://help.shopify.com/en/manual/shopify-admin/shopify-home
- Bulk editing · https://help.shopify.com/en/manual/shopify-admin/productivity-tools/bulk-editing
- Polaris breakpoints (0/490/768/1040/1440) · https://polaris-react.shopify.com/tokens/breakpoints
- Polaris IndexTable (`condensed`/`smDown`) · https://polaris-react.shopify.com/components/tables/index-table
- Polaris color tokens / single palette · https://polaris-react.shopify.com/tokens/color
- Polaris Web Components (GA 2025-10) · https://www.shopify.com/partners/blog/polaris-unified-and-for-the-web
- Sidekick · https://www.shopify.com/sidekick
- Editions Summer '25 / Winter '25 / Winter '26 · https://www.shopify.com/editions/winter2026 · https://changelog.shopify.com/posts/the-winter-25-edition-is-here
- ShopifyQL · https://shopify.dev/docs/api/shopifyql
- Markets/Catalogs API · https://community.shopify.dev/t/release-of-the-new-shopify-markets-changes-to-the-markets-and-catalogs-apis/11817

---

*Severity legend: P0 blocks production · P1 blocks credible launch · P2 quality/scale · P3 polish. All findings verified against source on 2026-06-06.*


