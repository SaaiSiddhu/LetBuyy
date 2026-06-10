# LetBuyy Merchant Mobile — Master Report

**The definitive Shopify-grade audit and mobile-first transformation roadmap**

| | |
|---|---|
| **Date** | 2026-06-08 |
| **Scope** | `apps/mobile/merchant-app` (Flutter), `apps/merchant-control-plane` (web), `services/mobile-bff`, `services/api-gateway`, shared DB & infra |
| **Primary question** | Can a LetBuyy merchant create, launch, manage, scale, and operate their entire store from a phone, with no desktop? |
| **Benchmark** | The native Shopify merchant app for iOS/Android (June 2026), verified against official Shopify docs |
| **Method** | Direct source reading (133 Dart files / ~55K LOC mobile, Hono BFF + gateway, 41 DB migrations), web/mobile cross-mapping, cited Shopify research, independent verification of load-bearing claims |
| **Evidence basis** | Every status claim is tied to a file path (and line where useful). Shopify claims are tied to `help.shopify.com` / `shopify.dev` / changelog URLs (see Appendix B). |

---

## How to read this document

This is a single master report covering all 18 audit phases as deep sections. It is written to serve three readers at once:

- **Leadership** — start with the Executive Summary, the Domain Scorecard (§0), the Roadmap (§16), and the Brutal Review (§18).
- **Engineering** — the per-domain audits (§5–§13), the Parity Matrix (§4), the Issue Register (§17), and the "Required APIs / Backend / UI" columns in §16.
- **Anyone who wants the unvarnished truth** — §0.2 ("Real vs. theater"), §18, and the fact that every claim here is backed by a file reference you can open.

A note on tone, by request: this audit is accurate, not polite. Where something is a mock, a dead-end, or marketing, it says so and shows the line of code that proves it.

---

## Table of contents

- §0 — Executive Summary & Domain Scorecard *(primary question answered)*
- §1 — Mobile Architecture *(Phase 1)*
- §2 — Shopify Mobile Benchmark *(Phase 2)*
- §3 — LetBuyy Mobile Feature Inventory *(Phase 3)*
- §4 — Web vs. Mobile Parity Report *(Phase 4)*
- §5 — Store Creation Audit *(Phase 5)*
- §6 — Product Management Audit *(Phase 6)*
- §7 — Order Management Audit *(Phase 7)*
- §8 — Customer Management Audit *(Phase 8)*
- §9 — Analytics Audit *(Phase 9)*
- §10 — Theme Management Audit *(Phase 10)*
- §11 — Mobile Theme Editor Strategy *(Phase 11)*
- §12 — Apps Marketplace Audit *(Phase 12)*
- §13 — Domain Management Audit *(Phase 13)*
- §14 — Store Health Center *(Phase 14)*
- §15 — Mobile-First Opportunities *(Phase 15)*
- §16 — Implementation Roadmap P0–P4 *(Phase 16)*
- §17 — Issue Register *(Phase 17)*
- §18 — Brutal Review *(Phase 18)*
- Appendix A — Evidence index (key files)
- Appendix B — Shopify sources

---

## §0 — Executive Summary & Domain Scorecard

### 0.1 The answer to the primary question

**No. A LetBuyy merchant cannot run their store from a phone today — and on a stock production build they cannot even log in.**

There are two distinct failure levels, and they matter for sequencing the fix:

**Level 1 — The app does not start a session on a production build.** The shipped `production.json` sets `TURNSTILE_TOKEN` and `TURNSTILE_SITE_KEY` to literal `SKIP_NEEDS_HUMAN_*` placeholder strings (`apps/mobile/merchant-app/dart-defines/production.json`). The sign-in path throws before it ever reaches the identity platform when the Turnstile token is the sentinel (`lib/services/store_auth_service.dart`). On top of that, the app is configured to call `https://bff.letbuyy.com/v1`, but the deployed mobile-BFF worker route is `bff.letbuyy.store` (`services/mobile-bff/wrangler.toml`) — a loose end from the in-flight `.store → .com` domain migration. So a release build points at a host that has no worker, *and* can't pass the human check anyway. **Time-to-first-screen on a clean prod build is effectively zero percent.**

**Level 2 — Even with auth fixed, ~10 commerce-critical capability areas are hard-blocked at the backend.** The app is honest about this: it ships a `PlatformBlockedService` and a `SkipNeedsBackendException` that deliberately route the merchant to a "this needs a backend contract" screen for **Returns/RMA, Payouts & settlement, Wallet, Commission, KYC, 2FA, Business profile, Localization/Markets, Metafields, and the embedded-app bridge** (`lib/services/platform_blocked_service.dart`, ledger IDs S-018…S-027). Another tier of features (push registration, AI generation, AI credit purchase, collection edit/delete, review moderation) throws `SkipNeedsBackendException` because the gateway route genuinely does not exist (27 call sites across 11 files).

**The honest coverage number:** conditioned on fixing authentication, a merchant could perform roughly **50–55% of day-to-day operational tasks** from the phone (product CRUD, order view/fulfill/refund, inventory, coupons/gift cards, shipping zones, staff, domains, theme editing). They **cannot** complete the money-out lifecycle (payouts, settlement, KYC), the post-purchase lifecycle (returns/RMA), real analytics, push alerts, customer communication, or buy a shipping label. Against the stated goal of **95–100% mobile operability, the gap is large but closeable** — most of it is missing *backend contracts*, not missing mobile UI.

### 0.2 Real vs. theater (the one-paragraph truth)

The merchant app is **not a mockup** — it has a genuine typed REST layer (`letbuyy_api_client`), a real cookie session against `accounts.letbuyy.com`, and ~55K lines of Flutter across 25+ domains. The backend is **not vaporware** — the api-gateway is ~48K LOC of real Hono routes over a real 237-table Postgres/Supabase schema. But the repository is wrapped in a thick layer of *governance theater*: 100KB+ of `CODEX_*` ledgers, "167 governance validators that all pass," and multiple production-readiness audits — sitting on top of a product whose own internal audit says it has "committed placeholder secrets that 500 the mobile backend" and "no real app API [in places], … theme editor still previews a mock [on web], … app billing still moves no money." **The green checkmarks are measuring process, not product.** This report measures product.

### 0.3 Domain Scorecard

Legend: ✅ works (wired to real API) · ⚠️ partial (UI present, gaps or blocked mutations) · 🔴 blocked/stub/missing · — n/a

| Domain | LetBuyy **Mobile** | LetBuyy **Web** | Shopify **Mobile** | Verdict |
|---|---|---|---|---|
| Auth / login | 🔴 sentinel-blocked in prod | ✅ | ✅ | **Blocker** |
| Store creation / onboarding | ⚠️ steps 1–4 not saved | ✅ | ✅ | Behind |
| Dashboard / home | ⚠️ data real, no charts | ✅ | ✅ | Behind |
| Products (CRUD, variants, media, SEO) | ✅ + image upload | ✅ | ✅ + camera/AI bg-removal | Near-parity |
| Collections | ⚠️ create only (no edit/delete) | ✅ full CRUD | ✅ | Behind |
| Inventory | ✅ levels, locations, POs, transfers | ✅ (POs/transfers stub) | ✅ + barcode scanner | **Mobile ahead of web** |
| Orders (view/fulfill/refund) | ✅ core | ✅ core | ✅ | Near-parity |
| Shipping labels (buy/print) | 🔴 missing | 🔴 missing | ✅ full mobile flow | **Big gap** |
| Returns / RMA | 🔴 PlatformBlocked | 🔴 missing | ✅ | **Big gap** |
| Customers | ⚠️ read-only list/detail | ⚠️ read + export | ✅ edit/notes/email/merge | Behind |
| Customer segments / comms | 🔴 missing | 🔴 missing | ✅ (segments desktop) | Gap |
| Analytics | ⚠️ numbers real, charts placeholder | ⚠️ summary only | ✅ + widgets/Watch | Behind |
| Discounts | ✅ coupons + gift cards CRUD | ✅ coupons CRUD | ⚠️ create is desktop-only | **Mobile ahead of Shopify** |
| Marketing (email/campaigns) | 🔴 none | 🔴 none | ⚠️ ambiguous on mobile | Gap (both) |
| Reviews | ⚠️ read; moderation blocked | ✅ moderate | — | Behind own web |
| Apps marketplace | ⚠️ browse/install; no runtime | ⚠️ external | ✅ | Behind |
| Themes (install/publish) | ✅ | ✅ | ✅ | Parity |
| **Theme editor (sections/blocks)** | ✅ full mobile editor + preview | ✅ | ⚠️ list-based, simpler | **Mobile ahead of Shopify** |
| Domains | ✅ connect/preview/access | ✅ + DNS display | ✅ + buy | Near-parity |
| Payments config | ⚠️ Razorpay key sentinel | ✅ | ✅ | Behind |
| Payouts / settlement / wallet / KYC | 🔴 PlatformBlocked | 🔴 | ✅ (payouts view) | **Big gap** |
| Shipping zones/rates | ✅ | ✅ | ⚠️ | Parity+ |
| Taxes | 🔴 PlatformBlocked (mobile) | ✅ | ⚠️ desktop | Behind own web |
| Staff / permissions | ✅ invite/role/remove | ✅ | ⚠️ enforce only | **Mobile ahead of Shopify** |
| Notifications (prefs) | ✅ settings | ✅ | ✅ | Parity |
| **Push notifications (delivery)** | 🔴 non-functional (3 ways) | — | ✅ order alerts | **Big gap** |
| AI studio | ⚠️ credits read; generation stub | ⚠️ credits read | ✅ Sidekick + Magic | Behind |
| Billing / subscription | ✅ read + upgrade | ✅ | ⚠️ | Parity |

**Reading the scorecard:** LetBuyy mobile already **beats Shopify mobile** in three places — a true in-app visual theme/section editor, full discount *creation* on the phone (Shopify makes you go to desktop), and full staff administration. It is at **near-parity** on products, orders, themes, domains, shipping. It is **badly behind** on the merchant's money (payouts/settlement/KYC), the post-purchase loop (returns, shipping labels), real-time signal (push, analytics charts), and the very first step (login).

---

## §1 — Mobile Architecture *(Phase 1)*

### 1.1 Stack & runtime

| Concern | Choice | Evidence |
|---|---|---|
| Framework | Flutter (Dart), 133 files, ~55K LOC in `lib/` | `apps/mobile/merchant-app/lib` |
| Entry | `MultiProvider` → `runApp(StoreBuilderApp)` | `lib/main.dart` |
| Routing | Classic named routes via `Navigator.onGenerateRoute` + hand-rolled `AppRoutes.generateRoute` switch | `lib/app/routes.dart` |
| State mgmt | `provider ^6.1.2` — one `ChangeNotifier` service per domain, injected at root | `lib/main.dart:63–144` |
| Networking | `letbuyy_api_client` (typed REST over `http`), re-exported | `lib/services/api_client.dart` |
| API base | `https://bff.letbuyy.com/v1` (default + `production.json`) | `lib/config/app_config.dart:9–17` |
| Identity base | `https://accounts.letbuyy.com` | `lib/config/app_config.dart:22` |
| Auth | `lb_session` cookie in `flutter_secure_storage`, injected as bearer; CSRF via `/login`; Cloudflare Turnstile on sign-in | `lib/services/store_auth_service.dart` |
| Theming | `StoreTheme.light()/dark()`, `ThemeProvider`, color tokens | `lib/theme/` |

**Architecture smell:** `pubspec.yaml` declares `go_router ^17.0.0` but **no source uses it** — all navigation is `MaterialPageRoute`. A declared-but-unused routing dependency is a small but telling sign of aspirational scaffolding.

### 1.2 Navigation tree (as actually wired)

```
StoreMainScreen  (bottom nav, 5 tabs)  — lib/screens/main/store_main_screen.dart
├─ 0 Home        → HomeScreen (dashboard)        lib/screens/dashboard/
├─ 1 Editor      → SectionEditorScreen           lib/screens/editor/
├─ 2 Theme       → ThemeScreen                    lib/screens/customize/
├─ 3 Products    → ProductsScreen                 lib/screens/products/
└─ 4 Settings    → SettingsScreen                 lib/screens/settings/
                    └─ pushes named routes to:
                       Orders, Customers, Inventory(+Locations,Suppliers,POs,Transfers),
                       Coupons, Gift Cards, Analytics, Reviews, Leads,
                       Apps Marketplace, AI Studio, Shipping, Taxes, Staff, Billing,
                       Notifications, Domain Settings, SEO, Store Details,
                       Live Preview, Pricing, Connect Razorpay
```

**Information-architecture problem:** the merchant's day-to-day operational surfaces (Orders, Customers, Analytics, Inventory) are buried one level deep inside **Settings**, while two of the five top-level tabs (Editor + Theme) are design tools. Shopify's app puts Home / Orders / Products / Customers / (Store/menu) at the thumb. This IA is "store-builder first," not "operator first" — a structural mismatch with the goal of *running* a store from mobile. (See §16 P1 and §18.)

### 1.3 State, data & API dependency map

```
UI (screens/widgets)
   │  reads/writes via Provider
   ▼
ChangeNotifier services  (lib/services/*_service.dart)
   │  typed calls: _api.orders.list(), _api.products.create(), _api.uploadFile()…
   ▼
letbuyy_api_client  (packages/dart/api_client)  ── attaches lb_session cookie, X-Client header, request id
   │  HTTPS
   ▼
mobile-bff  (Hono / Cloudflare Worker)  ── ALLOWLIST of 26 path prefixes; signs internal session headers
   │  service binding
   ▼
api-gateway  (Hono / Cloudflare Worker, ~48K LOC, 36 route files)
   │
   ├─ Supabase (Postgres, 237 tables, RLS) ─ products, orders, customers, inventory, payments, themes…
   ├─ Razorpay / Stripe (payments)
   ├─ R2 (media upload)
   └─ Cloudflare Queues → queue-workers (analytics, search index, push dispatch, email)
```

**Per-domain API wiring (mobile service → gateway route, real unless noted):**

| Mobile service | Gateway prefix | Real? |
|---|---|---|
| `order_service` | `/v1/orders` (list, get, fulfill, refund w/ idempotency) | ✅ |
| `product_service` | `/v1/products` (CRUD, bulk, upload); collections **GET/POST only** | ⚠️ no collection PATCH/DELETE |
| `inventory_service` | `/v1/inventory` (levels, adjust, locations, suppliers, POs, transfers) | ✅ |
| `customer_service` | `/v1/customers` (list, get) | ✅ read |
| `coupon_service` | `/v1/coupons`, gift cards | ✅ |
| `analytics_service` | `/v1/analytics` (dashboard, orders, revenue, top-products) | ✅ numbers only |
| `theme_service` | `/v1/themes` (list, switch, loadEditor, saveEditor, releases) | ✅ |
| `shipping_tax_service` | `/v1/shipping-tax` (zones, rates) | ✅ |
| `staff_service` | (employees/users) | ✅ |
| `domainService` | stores/domain settings | ✅ |
| `subscription_service` | `/v1/payments` (subscription, billing, plans) | ✅ |
| `app_marketplace_service` | `/v1/app-store` (apps, install, uninstall); **bridge runtime** | ⚠️ no embedded runtime |
| `ai_studio_service` | `/v1/ai` credits/usage real; **generate & purchase return 503** | 🔴 stub |
| `review_service` | `/v1/reviews` list real; **status update / reply** | 🔴 no route |
| `push_service` | **no `/v1/push` route; not in BFF allowlist** | 🔴 missing |
| `notification_settings_service` | notification prefs | ✅ |
| `platform_blocked_service` | 10 features with **no gateway contract** | 🔴 blocked |

### 1.4 Infrastructure map

- **Edge:** Cloudflare Workers for both `mobile-bff` (thin allowlisting proxy, single `src/index.ts`, no own handlers beyond `/health`) and `api-gateway` (the real backend).
- **Data:** Supabase Postgres, `database/supabase/migrations/` (41 migrations, 237-table baseline, RLS on all baseline tables; some RLS policies were anon-readable until migration 107 fixed them).
- **Async:** `services/queue-workers` (real) consumes Cloudflare Queues for analytics, search indexing, in-app notifications, **push dispatch (real FCM/APNs code, placeholder credentials)**, and email. `services/webhook-service` (real) dispatches webhooks.
- **Reserved / not implemented (manifest-only placeholders):** `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service`, `analytics-pipeline` — each is just `AGENTS.md` + `runtime.manifest.json`. Their capability is currently absorbed by the gateway + queue-workers + trigram SQL search.

**Test posture:** 3 Dart test files total (`analytics_model_test`, `mobile_services_test`, `product_contract_test`) — model deserialization only. No widget tests, no integration tests, no mocked-HTTP service tests. For a 55K-LOC app this is effectively **untested**.

---

## §2 — Shopify Mobile Benchmark *(Phase 2)*

Verified against official Shopify documentation (Appendix B). This describes the **native Shopify merchant app** for iOS/Android, not the web admin in a mobile browser.

### 2.1 Shopify's own stance

Shopify markets the app to "manage your orders, and update your catalog" anywhere, and states that from a browser "you can manage all aspects of your store," while "if you log in to the Shopify app from your mobile device, then some features might not be available" [S1, S2]. So even Shopify does **not** claim 100% mobile parity — it claims a very high operational floor plus several mobile-first superpowers.

### 2.2 What Shopify mobile supports / doesn't

| Domain | Shopify mobile supports | Mobile gap (desktop-preferred) |
|---|---|---|
| Signup/onboarding | Sign up, setup checklist, sample product [S1] | Free-trial flow is web-first |
| Products | Create/edit/duplicate/archive, variants, **SEO edit**, **camera photos**, **AI background removal/scenes (Nov 2025)** [S4,S7,S8] | Bulk editor, video/3D upload, metafields |
| Collections | View/create/edit, featured image via camera [S33] | Smart-collection conditions, bulk |
| Inventory | **Built-in barcode scanner** (assign barcode, adjust qty), multi-location set [S14] | Transfers, bulk adjust |
| Orders | List/filter/search, fulfill, capture, **edit order**, packing slips, draft orders, tracking, cancel [S9] | Bulk export |
| **Shipping labels** | **Buy & print labels in-app** (USPS/UPS/FedEx/DHL etc.), return labels (US) [S11] | Bulk label purchase = desktop |
| Returns/refunds | Create returns, full/partial refund, restock (single location on mobile), exchanges [S12,S13] | Return *rules* setup = desktop |
| Customers | Add/edit, notes, tags, **email the customer**, bulk tag, merge, delete [S15] | **Segment creation = desktop**, bulk field edit |
| Analytics | Full dashboard + reports, Live View, **home-screen widgets (7 metrics)**, **Apple Watch app** [S16,S17,S18] | Custom report builder, CSV export |
| Discounts | View/edit/duplicate/deactivate/delete, **share via link/QR** [S19,S20] | **Creating new discounts = desktop-only** [S21] |
| Marketing | Shopify Messaging admin reachable; transactional email to customer | Full campaign builder ambiguous/desktop |
| Themes | View library, upload .zip / GitHub, update, publish, preview, share 2-day link [S3] | Buy premium themes |
| **Theme editor** | **Edit sections & blocks** in a list-based mobile editor; theme settings; pages/menus [S3] | Visual two-pane drag-drop; **code editing practically desktop**; AI "generate apps" **desktop-only** [S29,S31] |
| Apps | Browse/install/manage from App Store [S?] | Custom app creation = dev dashboard |
| Domains | **Buy**, connect, transfer, manage, set primary [S24,S25] | Complex DNS editing |
| Payments/payouts | **View payout balance/history**, **Tap to Pay (Quick Sale)**, Shopify Balance (separate app) [S26,S27] | Configure Payments settings = desktop |
| Staff | Staff *log in* with scoped permissions [S28] | **Managing roles/permissions = desktop** |
| Push | Orders, fulfillments, critical alerts, timeline mentions, MFA; **iOS app badge = open-order count** [S2] | — |
| POS | Separate Shopify POS app | — |
| Store health | Home performance summary, setup tips, **Sidekick AI on mobile** (text+voice) [S30] | "Generate apps" desktop-only |

### 2.3 What LetBuyy should copy

1. **Operator-first IA** — Home / Orders / Products / Customers at the bottom bar (not Editor/Theme).
2. **Buy & print shipping labels in-app** — Shopify's highest-value fulfillment feature; LetBuyy has *none*.
3. **Camera-native workflows** — barcode scanner for inventory; camera capture + AI background removal for product media (Shopify shipped this Nov 2025 [S8]).
4. **Push that actually fires** — instant new-order push and an app-icon badge for open orders.
5. **Home-screen widgets + (later) a watch app** — glanceable revenue/orders.
6. **Sidekick-style AI assistant that completes tasks**, available from every screen.
7. **Payout visibility** — at minimum "what will I be paid and when."

### 2.4 Where LetBuyy should *improve on* Shopify (beat the benchmark)

1. **Full visual theme/section editing on mobile** — LetBuyy already has it; Shopify's is list-based and simpler. Make this a marketed flagship (§11, §15).
2. **Create discounts on the phone** — Shopify forces desktop [S21]; LetBuyy already does coupon + gift-card CRUD on mobile. Market it.
3. **Full staff administration on mobile** — Shopify only *enforces* permissions on mobile; LetBuyy can invite/assign/remove.
4. **India-first money rails** — UPI/Razorpay, GST invoicing, COD reconciliation, WhatsApp commerce (§15) — none of which Shopify's mobile app prioritizes.

---

## §3 — LetBuyy Mobile Feature Inventory *(Phase 3)*

Classification: **FULLY** (UI + real API, usable) · **PARTIAL** (UI present, key gaps or blocked mutations) · **STUB/MOCK** (UI present, no working backend) · **MISSING** (not present) · **BROKEN** (present but fails). "Legacy" is not used — the codebase is recent; deprecated app aliases live only under `docs/archive/` per the repo constitution.

| # | Feature | Class | Evidence |
|---|---|---|---|
| 1 | Auth: signup/OTP/set-password | PARTIAL | flow wired, but prod build blocked by Turnstile sentinel — `store_auth_service.dart`, `production.json` |
| 2 | Auth: sign-in | BROKEN (prod) | throws on Turnstile sentinel before identity call — `store_auth_service.dart:323–334` |
| 3 | Store creation wizard (7 steps) | PARTIAL | steps 5–7 call `createStore`; steps 1–4 `// TODO: wire onboarding save` — `create_store_wizard.dart` |
| 4 | Subdomain availability check | FULLY | wired |
| 5 | Dashboard stats | PARTIAL | real numbers; revenue chart fed scalar only; bell `onPressed:(){}` — `home_screen.dart:486` |
| 6 | Products list/search/sort | FULLY | `product_service.fetchProducts` |
| 7 | Product create/edit (5-step) | FULLY | `createProduct/updateProduct` incl. SEO |
| 8 | Product image upload | FULLY | `uploadProductImage` → R2 |
| 9 | Product variants/specs | FULLY | in create/edit payload |
| 10 | Product bulk actions | FULLY | `bulkAction` |
| 11 | Product export (CSV/Excel) | STUB | "coming soon" snackbar — `products_screen.dart:334` |
| 12 | Product import | PARTIAL | screen exists; relies on gateway import |
| 13 | Collections create | FULLY | wired |
| 14 | Collections edit/delete | STUB | `SkipNeedsBackendException` — `product_service.dart:219–228` (no gateway PATCH/DELETE) |
| 15 | Inventory levels + adjust | FULLY | `inventory_service` |
| 16 | Locations / Suppliers / POs / Transfers | FULLY | all fetch real API |
| 17 | Orders list/filter | FULLY | `order_service.fetchOrders` |
| 18 | Order detail | FULLY | `fetchOrder` |
| 19 | Order fulfill + tracking | FULLY | `fulfillOrder(tracking,carrier)` |
| 20 | Order refund (+complete) | FULLY | `refundOrder` w/ idempotency |
| 21 | Shipping label buy/print | MISSING | no label generation anywhere |
| 22 | Returns / RMA | STUB (blocked) | `MOBILE_RETURNS` → PlatformBlocked S-022 |
| 23 | Order print/export | STUB | "coming soon" — `orders_screen.dart:310,612` |
| 24 | Customers list/detail | FULLY (read) | `customer_service` |
| 25 | Customer edit / notes / tags | MISSING | not present |
| 26 | Customer segments | MISSING | not present |
| 27 | Customer communication (email/WA) | MISSING | not present |
| 28 | Analytics summary numbers | FULLY | `analytics_service` |
| 29 | Analytics charts (sales/visitors) | STUB | "Charts coming soon" placeholder — `analytics_screen.dart:232–247` |
| 30 | Analytics traffic sources | STUB | placeholder ("needs gateway endpoint") |
| 31 | Coupons CRUD | FULLY | `coupon_service` |
| 32 | Gift cards | FULLY | `fetchGiftCards/issueGiftCard` |
| 33 | Reviews list | FULLY (read) | `review_service.fetchReviews` |
| 34 | Reviews approve/reject | STUB | `SkipNeedsBackendException` — `reviews_screen.dart:513` |
| 35 | Reviews merchant reply | MISSING | no gateway route |
| 36 | Leads / form submissions | PARTIAL | read wired; status mutate blocked |
| 37 | Marketing (email/campaigns/SMS) | MISSING | no screens |
| 38 | Apps browse/install/uninstall | FULLY | `app_marketplace_service` |
| 39 | Embedded app runtime/bridge | STUB (blocked) | S-027 |
| 40 | Theme list / switch | FULLY | `theme_service` |
| 41 | **Theme section editor** (undo/redo, reorder, add/delete, settings, save) | FULLY | `section_editor_screen.dart`, `saveEditor` |
| 42 | Live preview (WebView of store) | FULLY | `live_preview_screen.dart` |
| 43 | Theme versions / releases | FULLY | `fetchReleases` |
| 44 | Domain connect/disconnect | FULLY | `domainService` |
| 45 | Domain availability / purchase quote | FULLY | wired |
| 46 | Store access (public/password/preview) | FULLY | `setStoreAccess` |
| 47 | Payments: connect Razorpay | PARTIAL | wired but `RAZORPAY_KEY_ID` sentinel in prod |
| 48 | Payouts / settlement | STUB (blocked) | S-018 |
| 49 | Wallet / Commission / KYC | STUB (blocked) | S-019/S-020/S-021 |
| 50 | Shipping zones/rates | FULLY | `shipping_tax_service` |
| 51 | Taxes (mobile) | STUB (blocked) | (web has it; mobile blocked) |
| 52 | Staff invite/role/remove | FULLY | `staff_service` + role gate |
| 53 | Notification preferences | FULLY | `notification_settings_service` |
| 54 | **Push delivery / device token** | BROKEN | `push_service` throws; no route; no FCM/APNs creds |
| 55 | Billing / subscription / plans | FULLY | `subscription_service` |
| 56 | Store details / SEO settings | PARTIAL | save wired; **logo upload "coming soon"** — `store_details_screen.dart:274` |
| 57 | Business details / 2FA / Localization / Metafields | STUB (blocked) | S-023/S-024/S-025/S-026 |
| 58 | AI: credits/usage read | FULLY | `ai_studio_service` |
| 59 | AI: content generation | STUB | gateway returns 503 — `ai.ts /generate` |
| 60 | AI: credit purchase | STUB | gateway returns 503 — `ai.ts /credits/purchase` |

**Tally:** ~31 FULLY · ~10 PARTIAL · ~12 STUB/blocked · ~7 MISSING · 2 BROKEN. The *breadth* is impressive; the *depth and reliability of the operational core* is where it falls down.

---

## §4 — Web vs. Mobile Parity Report *(Phase 4)*

Web baseline = `apps/merchant-control-plane` (Next.js 16 App Router, React 19, store-scoped routes proxying `@letbuyy/api-client`). Effort: **S** ≤1wk · **M** ~2–4wk · **L** ~1–2mo (one squad). Impact: ★–★★★.

| Feature | Web | Mobile | Gap | Priority | Effort | Business impact |
|---|---|---|---|---|---|---|
| Login | ✅ | 🔴 sentinel | Mobile can't auth in prod | **P0** | S | ★★★ nothing works without it |
| Store creation | ✅ | ⚠️ onboarding not saved | Steps 1–4 dropped | P1 | S | ★★ activation |
| Dashboard | ✅ | ⚠️ no charts | Visualization | P2 | S | ★ |
| Products CRUD | ✅ | ✅ | — (parity) | — | — | — |
| Collections | ✅ full CRUD | ⚠️ create only | edit/delete need gateway PATCH/DELETE | P1 | S | ★★ |
| Categories | ✅ | ⚠️ partial | mobile lacks full category mgmt | P2 | S | ★ |
| Inventory | ✅ (POs/transfers stub) | ✅ (POs/transfers real) | **mobile ahead** | — | — | — |
| Orders core | ✅ | ✅ | — | — | — | — |
| Shipping labels | 🔴 | 🔴 | both missing | **P1** | L | ★★★ fulfillment |
| Returns/RMA | 🔴 | 🔴 (blocked) | both missing; needs contract | **P1** | L | ★★★ post-purchase |
| Customers read | ✅ + export | ✅ read | mobile lacks export/edit | P2 | M | ★★ |
| Customer edit/notes | 🔴 | 🔴 | both missing | P2 | M | ★★ |
| Analytics | ⚠️ summary | ⚠️ numbers only | both lack charts/series | P2 | M | ★★ |
| Coupons | ✅ | ✅ | — | — | — | — |
| Gift cards | ⚠️ create disabled | ✅ | **mobile ahead** | — | — | — |
| Reviews moderation | ✅ | ⚠️ blocked | mobile mutate blocked | P1 | S | ★★ |
| Marketing/email | 🔴 | 🔴 | both missing | P3 | L | ★★ growth |
| Apps marketplace | ⚠️ external | ⚠️ no runtime | both lack in-context runtime | P2 | L | ★★ ecosystem |
| Theme install/publish | ✅ | ✅ | — | — | — | — |
| Theme editor | ✅ | ✅ | — (mobile is strong) | — | — | — |
| Blog/CMS pages | ✅ | ⚠️ limited | mobile thin on content | P3 | M | ★ |
| Domains | ✅ + DNS | ✅ (no DNS view) | mobile lacks DNS record display | P2 | S | ★ |
| Payments config | ✅ | ⚠️ key sentinel | provision key | **P0** | S | ★★★ |
| Payouts/KYC/wallet | 🔴 | 🔴 (blocked) | both missing; needs contract | **P1** | L | ★★★ trust/money |
| Shipping zones | ✅ | ✅ | — | — | — | — |
| Taxes | ✅ | 🔴 (blocked) | mobile blocked | P2 | M | ★★ |
| Staff | ✅ | ✅ | — (mobile ahead of Shopify) | — | — | — |
| 2FA/security | 🔴 stub | 🔴 (blocked) | both missing | P2 | M | ★★ security |
| Localization/markets | 🔴 stub | 🔴 (blocked) | both missing | P3 | L | ★ |
| Metafields | 🔴 stub | 🔴 (blocked) | both missing | P3 | M | ★ |
| Notifications prefs | ✅ | ✅ | — | — | — | — |
| Push delivery | — | 🔴 broken | mobile-only need | **P0** | M | ★★★ the point of an app |
| Export/import | ✅ | ⚠️ import only | mobile lacks export | P2 | S | ★ |
| AI studio | ⚠️ read | ⚠️ read; gen 503 | both need provider | P2 | M | ★★ |
| Billing | ✅ | ✅ | — | — | — | — |

**Headline parity findings.** (1) The web app is **not a finished superset** — it shares many of the same backend holes (no shipping labels, no returns, no payouts, no marketing, 2FA/localization/metafields stubbed via `BackendNeededPane`). So mobile parity is partly bottlenecked by *platform* gaps, not mobile-specific neglect. (2) Mobile is **already ahead of web** on inventory POs/transfers and gift cards. (3) The mobile-specific must-fix that web doesn't even need is **push delivery** — and it's broken three ways.

---

## §5 — Store Creation Audit *(Phase 5)*

**Question:** can a merchant create + configure + brand + theme + connect domain + configure payments + configure shipping, mobile-only?

| Step | Mobile? | Reality |
|---|---|---|
| Create store | ✅ | wizard steps 5–7 → `storeService.createStore` |
| Choose subdomain | ✅ | availability check wired |
| Capture business type / channels / product type / category | ⚠️ | collected in steps 1–4 but **not persisted** — `// TODO: wire onboarding save` (`create_store_wizard.dart`) |
| Upload logo | 🔴 | "coming soon" snackbar — `store_details_screen.dart:274` |
| Choose theme | ✅ | theme selection in wizard + theme screen |
| Connect custom domain | ✅ | `domainService.connectCustomDomain` |
| Configure payments | ⚠️ | Razorpay connect UI wired, but `RAZORPAY_KEY_ID` is a sentinel in prod; payouts/KYC blocked |
| Configure shipping | ✅ | zones/rates CRUD |
| **Log in to begin at all** | 🔴 | Turnstile sentinel blocks prod sign-in |

**Verdict:** the *skeleton* of mobile-only store creation exists and is unusually complete for a young product — but three blockers (login, logo upload, payment key) and one silent data-loss bug (onboarding steps 1–4 discarded) mean a merchant cannot *fully* stand up a launch-ready store from the phone today. **Blockers are small and config-shaped, not architectural.** Fixing items 1, logo, payment key, and onboarding-save would put mobile store-creation at genuine parity with Shopify.

---

## §6 — Product Management Audit *(Phase 6)*

| Capability | LetBuyy mobile | Shopify mobile | Gap |
|---|---|---|---|
| Create/edit product | ✅ 5-step | ✅ | parity |
| Variants | ✅ | ✅ | parity |
| Media upload (library) | ✅ R2 | ✅ | parity |
| **Camera capture** | 🔴 | ✅ | add `image_picker` camera source |
| **AI background removal / scenes** | 🔴 | ✅ (Nov 2025) | mobile-first opportunity (§15) |
| SEO fields | ✅ | ✅ | parity |
| Collections | ⚠️ create only | ✅ | add gateway PATCH/DELETE |
| **Bulk edit** | ⚠️ status bulk only | ⚠️ desktop bulk | both weak |
| Export | 🔴 "coming soon" | ⚠️ desktop | add |
| **Barcode scanning** | 🔴 | ✅ | mobile-first opportunity (§15) |
| 3D/video | 🔴 | 🔴 (mobile) | neither |

**Verdict:** product CRUD is one of LetBuyy mobile's strongest areas and is at functional parity with Shopify for the core path. The differentiated mobile workflows Shopify added — **camera capture, barcode scanning, AI media editing** — are exactly where LetBuyy is blank, and exactly where it should invest to leapfrog (§15). Collections edit/delete is a one-route backend fix.

---

## §7 — Order Management Audit *(Phase 7)*

| Capability | LetBuyy mobile | Shopify mobile | Gap |
|---|---|---|---|
| View / filter / search orders | ✅ | ✅ | parity |
| Order detail (items, address, totals) | ✅ | ✅ | parity |
| Fulfill + tracking number | ✅ `fulfillOrder` | ✅ | parity |
| Refund (full/partial) | ✅ idempotent | ✅ | parity |
| **Buy & print shipping label** | 🔴 missing | ✅ full flow [S11] | **flagship gap** |
| **Returns / RMA** | 🔴 PlatformBlocked S-022 | ✅ | **flagship gap** |
| Edit order (add/remove items) | 🔴 | ✅ | gap |
| Draft orders | 🔴 | ✅ | gap |
| Packing slips / print | 🔴 "coming soon" | ✅ | gap |
| Cancel order | ⚠️ via status | ✅ | minor |
| Bulk order ops | 🔴 | ⚠️ desktop | minor |

**Verdict:** the order *core* (see → fulfill → refund) is real and usable. But "operate fulfillment from the phone" fails on the two highest-value Shopify capabilities: **buying a shipping label** and **processing a return**. Both require new backend contracts (label-purchase provider integration; an RMA lifecycle the gateway explicitly lacks per S-022). These are the difference between "I can glance at orders" and "I can run fulfillment from my phone."

---

## §8 — Customer Management Audit *(Phase 8)*

| Capability | LetBuyy mobile | Shopify mobile | Gap |
|---|---|---|---|
| Customer list + search | ✅ | ✅ | parity |
| Customer detail + order history | ✅ | ✅ | parity |
| Edit customer / contact / address | 🔴 | ✅ | gap |
| **Customer notes** | 🔴 | ✅ | gap |
| Tags | 🔴 | ✅ (incl. bulk) | gap |
| **Segments** | 🔴 | ✅ (creation desktop) | gap (parity-with-Shopify achievable) |
| **Communication (email / WhatsApp)** | 🔴 | ✅ email | mobile-first WA opportunity (§15) |
| Merge / delete | 🔴 | ✅ | gap |

**Verdict:** customers is **read-only** on LetBuyy mobile. A merchant can look but cannot act — no notes, no tags, no message. This is one of the larger experience gaps versus Shopify, and the WhatsApp-native angle (§15) is a chance to turn the weakest domain into a differentiator for the India market.

---

## §9 — Analytics Audit *(Phase 9)*

| Capability | LetBuyy mobile | Shopify mobile | Gap |
|---|---|---|---|
| Revenue / orders / AOV numbers | ✅ real | ✅ | parity (numbers) |
| Orders-by-status | ✅ | ✅ | parity |
| **Time-series charts** | 🔴 "Charts coming soon" placeholder | ✅ | gap |
| **Traffic / sessions / conversion** | 🔴 (no storefront session analytics) | ✅ | platform gap |
| Traffic sources / attribution | 🔴 placeholder | ✅ | gap |
| Top products | ✅ | ✅ | parity |
| **Home-screen widgets** | 🔴 | ✅ 7 metrics | mobile-first opportunity |
| **Live view** | 🔴 | ✅ | gap |
| **Apple Watch** | 🔴 | ✅ | later |
| Custom reports / export | 🔴 | ⚠️ desktop | both weak |

**Verdict:** analytics shows **real aggregate numbers but renders literal "Charts coming soon" placeholders** for every visualization (`analytics_screen.dart:232–247`). The deeper issue is a *platform* one: there is **no storefront session/traffic analytics pipeline** (the `analytics-pipeline` service is a manifest-only placeholder), so visitors/conversion/sources cannot be shown on web *or* mobile. Charts are a mobile fix; traffic analytics is a backend build. Widgets and Live View are high-ROI mobile-first adds.

---

## §10 — Theme Management Audit *(Phase 10)*

| Capability | LetBuyy mobile | Shopify mobile | Gap |
|---|---|---|---|
| Theme list / library | ✅ `fetchThemes` | ✅ | parity |
| Install / add theme | ✅ | ✅ (.zip/GitHub) | parity |
| Switch / publish theme | ✅ `switchTheme` | ✅ | parity |
| Preview live store | ✅ WebView | ✅ | parity |
| Theme versions / releases | ✅ `fetchReleases` | ✅ | parity |
| **Rollback** | ⚠️ releases listed; confirm rollback action | ✅ | verify |
| Buy premium theme | 🔴 (external marketplace) | 🔴 (web) | neither |

**Verdict:** theme *management* is at parity. This is the single most complete domain in the LetBuyy mobile app, and combined with §11 it is the platform's mobile crown jewel.

---

## §11 — Mobile Theme Editor Strategy *(Phase 11)*

LetBuyy already ships a **real visual section editor on mobile** (`section_editor_screen.dart`): undo/redo history, section reorder, add/delete sections, per-section settings, header editing, save to API. Shopify's mobile theme editor is **list-based and simpler** [S3], and Shopify's code editor / AI "generate apps" are **desktop-only** [S29,S31]. **This is a place LetBuyy can credibly beat Shopify on mobile.**

Classify the editor surface for a mobile-first strategy:

| Editor capability | Classification | Strategy |
|---|---|---|
| Section add / remove / reorder | **MOBILE READY** | already shipped — polish, market it |
| Per-section settings (text, toggles, selects) | **MOBILE READY** | shipped |
| Color / font / brand tokens | **MOBILE READY** | surface as a quick "brand" sheet |
| Image/asset pickers in sections | **MOBILE ADAPTABLE** | reuse media upload + camera + AI bg-removal |
| Live preview of edits | **MOBILE READY** | WebView preview shipped; add inline before/after |
| Block-level editing within sections | **MOBILE ADAPTABLE** | bottom-sheet block editor; drag handles |
| Responsive (mobile/desktop) preview toggle | **MOBILE ADAPTABLE** | viewport switch in preview |
| Liquid / HTML / CSS / JSON code editing | **DESKTOP ONLY** | don't chase; offer "open on desktop" handoff + AI-assisted edits instead |
| Multi-file search/replace, theme check, timeline | **DESKTOP ONLY** | desktop |
| AI "generate a section/theme from a prompt" | **MOBILE ADAPTABLE** (opportunity) | a phone-native "describe your homepage" generator would *beat* Shopify, whose generation is desktop-only |

**Strategy:** double down on **no-code visual editing as a mobile flagship**; never try to put a code IDE on a phone. Add an **AI "describe it" section generator** (mobile-first, beats Shopify) and a clean **desktop-handoff** ("continue this on desktop") for code-level work. This is LetBuyy's clearest "outperform Shopify on mobile" bet (§15).

---

## §12 — Apps Marketplace Audit *(Phase 12)*

| Capability | LetBuyy mobile | Shopify mobile | Gap |
|---|---|---|---|
| Browse apps + categories | ✅ `fetchApps/Categories` | ✅ | parity |
| Installed apps list | ✅ `fetchInstallations` | ✅ | parity |
| Install / uninstall | ✅ | ✅ | parity |
| Launch app | ⚠️ opens URL via `url_launcher` | ✅ embedded | gap |
| **Embedded app runtime / App Bridge** | 🔴 PlatformBlocked S-027 | ✅ | gap |
| View app permissions | ⚠️ partial | ✅ | minor |

**Verdict:** browse/install/uninstall is real. The missing piece is an **in-app embedded runtime** — installed apps can only be opened as external URLs, not run inside the merchant app with a signed bridge (the gateway lacks the "native extension-host contract," S-027). Acceptable for v1; required before a serious third-party ecosystem.

---

## §13 — Domain Management Audit *(Phase 13)*

| Capability | LetBuyy mobile | Shopify mobile | Gap |
|---|---|---|---|
| Connect custom domain | ✅ | ✅ | parity |
| Disconnect | ✅ | ✅ | parity |
| Domain availability search | ✅ | ✅ | parity |
| **Buy domain** | ⚠️ quote wired; purchase path | ✅ full | verify checkout |
| Store access (public/password/preview) | ✅ `setStoreAccess` | ✅ | parity |
| Preview links | ✅ `createPreviewLink` | ✅ 2-day link | parity |
| **SSL / DNS status & records** | 🔴 not displayed | ⚠️ | add DNS/SSL health |
| Renewals | 🔴 not surfaced | ✅ | add |

**Verdict:** domain *connection* is strong on mobile. What's missing is **health visibility** — SSL state, DNS verification records, and renewal status — which feeds directly into the Store Health Center (§14). The web app already shows DNS records; mobile should reuse that contract.

---

## §14 — Store Health Center *(Phase 14)*

A "Store Health" hub is a high-leverage mobile-first surface: it turns the app from a set of disconnected screens into a single place that tells a merchant *"is my store OK, and what should I do next?"* LetBuyy is unusually well-positioned because the underlying signals already exist in services that are wired today.

**Proposed design — a single Health score (0–100) composed of weighted checks, each deep-linking to the fix:**

| Pillar | Checks (data already available?) | Source |
|---|---|---|
| **Launch readiness** | store published? logo set? ≥1 product? payment connected? domain live? | store/product/payment/domain services (mostly ✅) |
| **Payments** | Razorpay connected & key valid? COD configured? **(payout/KYC once unblocked)** | `subscription_service` ✅ / S-018,S-021 🔴 |
| **Domain & SSL** | custom domain active? SSL valid? DNS records verified? renewal date? | `domainService` ✅ (needs SSL/DNS surfacing, §13) |
| **Inventory** | out-of-stock count, low-stock alerts, unfulfilled-able SKUs | `inventory_service` ✅ |
| **Orders** | unfulfilled > N, overdue fulfillment, failed payments | `order_service` ✅ |
| **SEO** | missing product SEO, missing meta, sitemap | product/SEO data ✅ partial |
| **Catalog** | products without images/price, empty collections | product data ✅ |
| **Performance** | storefront Core Web Vitals | 🔴 needs analytics-pipeline (not built) |
| **Security** | 2FA enabled? staff with stale access? | 🔴 needs S-023 (2FA) |
| **Reviews** | unmoderated reviews waiting | `review_service` ✅ read (mutate blocked) |

**Why it wins on mobile:** it is glanceable, push-able ("Your SSL renews in 3 days," "5 orders unfulfilled"), and it is the natural home for the **home-screen widget** and **notification** strategy. ~60% of the checks can ship now on already-wired data; the rest light up as backend contracts land. Build the Health framework as a scoring engine that degrades gracefully when a signal is `PlatformBlocked`, so it grows automatically as §16 unblocks domains.

---

## §15 — Mobile-First Opportunities *(Phase 15)*

Where LetBuyy can *beat* Shopify mobile rather than chase it. Ranked by differentiation × feasibility.

1. **Visual theme/section editing as the flagship (HIGH / shipping already).** LetBuyy's mobile editor is more capable than Shopify's list-based one [S3]. Add an **AI "describe your homepage" section generator** — Shopify's generation is desktop-only [S31], so a phone-native generator is a clean win. Market "design your store from your phone."

2. **WhatsApp-native commerce (HIGH / India-first).** Order notifications, customer messaging, abandoned-cart nudges, and shipping updates over WhatsApp — turning the weakest domain (customer comms, §8) into a differentiator. Shopify's app has no equivalent India-tuned WA loop. (Connectors available via Twilio WhatsApp.)

3. **UPI-first payments & payout clarity (HIGH / India-first).** Native UPI collect/intent flows, GST-compliant invoices, and a dead-simple "what will I be paid and when" payout view. This requires unblocking S-018/S-021, but it's table stakes for Indian merchants and an area Shopify under-serves.

4. **Camera as a tool (MEDIUM-HIGH).** Barcode scanning for inventory + receiving POs; camera capture + **AI background removal** for product photos. Shopify shipped AI media editing on mobile in Nov 2025 [S8]; LetBuyy can match and tie it into the theme editor.

5. **AI store operator / "Sidekick"-equivalent that completes tasks (HIGH).** A from-any-screen assistant that can create a product, draft a discount, answer "how were sales this week," and edit a section. LetBuyy already has an AI credits/usage spine (`ai_studio_service`) — it just needs a real provider behind `/v1/ai/generate` (currently 503).

6. **Store Health + push + widgets as a daily-active loop (MEDIUM-HIGH).** §14 health score + real push (§16 P0) + home-screen widgets gives merchants a reason to open the app daily — the metric that actually compounds.

7. **COD reconciliation & returns built for India (MEDIUM).** COD is dominant in India and operationally messy; a mobile COD/returns reconciliation flow would be genuinely novel.

**Strategic read:** LetBuyy should not try to out-feature Shopify across the board. It should win on **(a) mobile-native creation (theme + AI), (b) India-first money & messaging (UPI, GST, WhatsApp, COD), (c) a daily health/push loop.** Everything else is "reach parity, don't over-invest."

---

## §16 — Implementation Roadmap P0–P4 *(Phase 16)*

Effort key: **S** ≤1wk · **M** 2–4wk · **L** 1–2mo (one squad). Each item lists what to build on the **backend/API/infra** and on the **mobile/UI** side, plus dependencies.

### P0 — Open the front door (the app is unusable until these land)

*Exit criteria: a real merchant can install a production build, log in, reach an operator home, and receive a new-order push.*

| Item | Biz value / merchant impact | Effort | Backend / API / infra | Mobile / UI | Deps |
|---|---|---|---|---|---|
| **P0-1 Provision auth config** | Without it, **0% of the app works** | S | Issue real Cloudflare **Turnstile** token+site key; replace `SKIP_NEEDS_HUMAN_*` in `production.json` | none | — |
| **P0-2 Fix BFF host** | App currently points at a host with no worker | S | Add `bff.letbuyy.com` route/DNS to the mobile-bff worker **or** repoint app to `bff.letbuyy.store`; finish `.store→.com` migration consistently | rebuild dart-defines | domain migration |
| **P0-3 Provision `INTERNAL_API_SECRET`** | Else every authed request 500s | S | `wrangler secret put INTERNAL_API_SECRET` on the live worker | none | — |
| **P0-4 Provision Razorpay key** | No payments config without it | S | Replace `RAZORPAY_KEY_ID` sentinel | none | — |
| **P0-5 Real push** | An app with no push isn't an app | M | Implement `POST/DELETE /v1/notifications/device-tokens`; add `/v1/push`/device-token prefix to BFF allowlist; provision `FCM_*`/`APNS_*` creds (dispatcher code already real in `queue-workers`) | register token on login; permission prompt; deep-link from push | DB `device_tokens` exists |
| **P0-6 Operator-first IA** | Makes mobile a *operate* tool, not a builder | S | none | Bottom nav → Home / Orders / Products / Customers / More; demote Editor/Theme into More | — |
| **P0-7 Save onboarding steps 1–4** | Silent data loss at signup hurts activation | S | onboarding metadata endpoint (or extend store create) | wire the TODO in `create_store_wizard.dart` | — |

### P1 — Run the operational core from the phone

*Exit criteria: a merchant can fulfill (incl. labels), process a return, moderate reviews, edit collections, see charts, and check Store Health — all on mobile.*

| Item | Biz value / merchant impact | Effort | Backend / API / infra | Mobile / UI | Deps |
|---|---|---|---|---|---|
| **P1-1 Shipping labels** | Highest-value fulfillment feature; Shopify has it, LetBuyy has none | L | Carrier/label provider integration; `/v1/shipping/labels` (rate, buy, void); label PDF in R2 | buy-label flow, package/weight, carrier pick, print/share PDF | provider contract |
| **P1-2 Returns / RMA** | Post-purchase loop; unblocks S-022 | L | RMA lifecycle contract: `/v1/returns` (create, approve, refund, restock) | returns screen replacing PlatformBlocked | refund (✅), inventory (✅) |
| **P1-3 Collections edit/delete** | Removes a visible dead-end | S | `PATCH/DELETE /v1/products/collections/:id` | un-stub `product_service` | — |
| **P1-4 Review moderation** | Removes dead-end; web already has it | S | `PATCH /v1/reviews/:id` status; `POST /v1/reviews/:id/reply` | un-stub `reviews_screen` | — |
| **P1-5 Analytics charts** | Numbers without trends feel broken | M | (none for revenue series — already returned; ensure monthly buckets) | render `fl_chart` series; remove "coming soon" | — |
| **P1-6 Logo upload** | Branding is core to store creation | S | reuse `/v1/upload` | un-stub logo picker (camera + library) | media upload (✅) |
| **P1-7 Store Health Center v1** | Daily-active loop; merchant confidence | M | aggregation endpoint or client compose from existing services | Health hub + score + deep links + push hooks (§14) | push (P0-5) |

### P2 — Trust, money, and depth

*Exit criteria: a merchant trusts the app with money (sees payouts, completes KYC, has 2FA) and can act on customers.*

| Item | Biz value / merchant impact | Effort | Backend / API / infra | Mobile / UI | Deps |
|---|---|---|---|---|---|
| **P2-1 Payouts & settlement view** | Trust; "when do I get paid?"; unblocks S-018 | L | tenant-safe payout/settlement/UTR contract `/v1/payouts` | replace PlatformBlocked with payout list/detail | provider data |
| **P2-2 KYC** | Required to transact; unblocks S-021 | L | mobile-safe KYC doc/verification/provider-status contract | KYC capture (camera) + status | provider |
| **P2-3 Wallet/commission** | Marketplace economics; S-019/S-020 | M | wallet ledger + commission schedule contracts | balance/ledger UI | P2-1 |
| **P2-4 Customer edit/notes/tags/email** | Turns read-only customers into a CRM | M | customer PATCH, notes, tags, message endpoints | edit + notes + tag + "email customer" | — |
| **P2-5 Taxes on mobile** | Web has it; mobile blocked | M | expose tax contract to mobile | tax settings/rates UI | — |
| **P2-6 2FA / session security** | Security baseline; unblocks S-023 | M | merchant 2FA/passkey/session contract | enroll + verify flow | — |
| **P2-7 Domain SSL/DNS/renewal surfacing** | Feeds Health; reduces support | S | expose SSL/DNS status (web already shows records) | DNS/SSL panel in domain screen | §14 |
| **P2-8 AI generation provider** | Lights up AI studio; un-503s | M | wire real provider behind `/v1/ai/generate` + `/credits/purchase` | un-stub generate/purchase | provider key |
| **P2-9 Camera capture + barcode scan** | Mobile-native superpowers (Shopify parity) | M | barcode lookup against catalog | `image_picker` camera; scanner (e.g. `mobile_scanner`) | — |

### P3 — Differentiate and scale

| Item | Biz value | Effort | Build |
|---|---|---|---|
| **P3-1 WhatsApp commerce loop** | India-first differentiator | L | WA provider (Twilio); order/shipping/abandoned-cart templates; inbound replies → customer timeline |
| **P3-2 AI store operator** | "Sidekick that does things" | L | tool-calling agent over gateway actions; from-any-screen assistant UI |
| **P3-3 Home-screen widgets** | Daily-active glanceability | M | iOS WidgetKit / Android widgets reading a metrics endpoint |
| **P3-4 Marketing / email** | Growth surface (web also lacks) | L | campaign/audience contracts + composer |
| **P3-5 Embedded app runtime** | Third-party ecosystem; unblocks S-027 | L | signed native extension-host/App Bridge contract; in-app webview runtime |
| **P3-6 Customer segments** | Targeting | M | segment query contract + builder UI |
| **P3-7 Storefront session analytics** | Unlocks traffic/conversion everywhere | L | build the reserved `analytics-pipeline`; storefront beaconing; sessions/sources reporting |

### P4 — Polish & long tail

Apple Watch app · localization/markets (S-025) · metafields (S-026) · 3D/video media · true bulk editing (products/orders/customers) · order editing + draft orders · packing-slip/CSV export on mobile · AI "describe your homepage" theme generation (beats Shopify) · responsive preview toggle in editor · **test-coverage program** (widget + integration + mocked-HTTP service tests; today: 3 model tests for 55K LOC) · accessibility & i18n pass.

**Sequencing logic:** P0 is almost entirely *config and one push endpoint* — days, not months, and it converts the app from "can't log in" to "demonstrably usable." P1 makes the operational core genuinely run on mobile (labels + returns are the big lifts). P2 earns trust with money + security. P3 is where the India-first, AI, and ecosystem differentiation lives. Crucially, **most blockers are missing backend contracts, not missing mobile screens** — so the gating resource is gateway/back-end engineering, and the mobile team can largely un-stub as contracts land.

---

## §17 — Issue Register *(Phase 17)*

**A note on the "Top 200" ask.** Padding to an arbitrary count of 200 would dilute signal and violate the request to be accurate. Instead this register enumerates the **real, evidence-tied issues** that block mobile-first commerce — ~110 concrete items below, each with evidence and a fix, grouped by severity. The long tail (per-screen polish, copy, empty states, minor a11y) rolls up into the "Quality" band and the P4 backlog rather than being inflated into individual line items.

Severity: **P0** ship-blocker · **P1** core operability · **P2** trust/depth · **P3** differentiation · **Q** quality/robustness.

### P0 — Ship-blockers (the app can't be used as-is)

| ID | Area | Issue | Evidence | Fix |
|---|---|---|---|---|
| 1 | Auth | Prod sign-in throws on Turnstile sentinel | `production.json` TURNSTILE_TOKEN, `store_auth_service.dart:323` | Provision real token/site key |
| 2 | Auth | Turnstile **site key** also sentinel | `app_config.dart:44`, `production.json` | Provision |
| 3 | Networking | App targets `bff.letbuyy.com`; worker route is `bff.letbuyy.store` | `app_config.dart:11`, `mobile-bff/wrangler.toml:87` | Align host/DNS w/ migration |
| 4 | Backend | Authed requests 500 if `INTERNAL_API_SECRET` unprovisioned | mobile-bff index; audit V1 | `wrangler secret put` |
| 5 | Payments | `RAZORPAY_KEY_ID` sentinel in prod | `production.json` | Provision publishable key |
| 6 | Push | Device-token registration throws; no `/v1/push` route; not in BFF allowlist | `push_service.dart:71,81` | Add endpoints + allowlist |
| 7 | Push | No FCM/APNs credentials (dispatcher real, creds placeholder) | `queue-workers/wrangler.toml` `FCM_*`/`APNS_*` | Provision creds |
| 8 | Activation | Onboarding steps 1–4 collected but never saved | `create_store_wizard.dart` TODO | Wire onboarding save |
| 9 | IA | Operator surfaces (Orders/Customers/Analytics) buried under Settings | `store_main_screen.dart` | Operator-first bottom nav |
| 10 | Trust | App ships 24 `SKIP_NEEDS_HUMAN_*` config sentinels | repo config grep | Provision/replace before GA |

### P1 — Core operability (can't run the store from the phone)

| ID | Area | Issue | Evidence | Fix |
|---|---|---|---|---|
| 11 | Orders | No buy/print shipping label | no label code; Shopify [S11] | Label provider + `/v1/shipping/labels` |
| 12 | Orders | Returns/RMA blocked | PlatformBlocked S-022 | RMA contract + screen |
| 13 | Orders | No order editing (add/remove items) | absent | order-edit endpoint+UI |
| 14 | Orders | No draft orders | absent | draft-order flow |
| 15 | Orders | Packing slip / print "coming soon" | `orders_screen.dart:310,612` | print/share PDF |
| 16 | Products | Collection edit/delete dead-end | `product_service.dart:219–228` | gateway PATCH/DELETE |
| 17 | Products | Export "coming soon" | `products_screen.dart:334` | export endpoint/UI |
| 18 | Reviews | Approve/reject blocked | `reviews_screen.dart:513` | review status route |
| 19 | Reviews | No merchant reply | no route | reply endpoint |
| 20 | Marketing | Leads status mutate blocked | `form_submission_service` | status route |
| 21 | Analytics | Charts are literal placeholders | `analytics_screen.dart:232–247` | render series |
| 22 | Analytics | Traffic sources placeholder | `analytics_screen.dart:348` | needs analytics pipeline |
| 23 | Store setup | Logo upload "coming soon" | `store_details_screen.dart:274` | wire upload |
| 24 | Dashboard | Revenue chart fed scalar, not series | `home_screen.dart` | feed time-series |
| 25 | Dashboard | Notification bell `onPressed:(){}` | `home_screen.dart:486` | wire to notifications |
| 26 | Health | No Store Health Center | absent | build §14 v1 |
| 27 | Customers | Read-only; no edit/notes/tags | absent | customer mutations |
| 28 | Customers | No way to contact a customer | absent | email/WA action |
| 29 | Quality | 55K-LOC app has 3 model-only tests | `test/` | test program |
| 30 | UX | Quick actions show snackbars instead of navigating | dashboard | real nav |

### P2 — Trust, money & depth

| ID | Area | Issue | Evidence | Fix |
|---|---|---|---|---|
| 31 | Money | Payouts/settlement blocked | S-018 | payout contract+view |
| 32 | Money | Wallet blocked | S-019 | wallet ledger |
| 33 | Money | Commission blocked | S-020 | commission contract |
| 34 | Money | KYC blocked | S-021 | KYC contract+capture |
| 35 | Security | 2FA/passkey blocked | S-023 | 2FA contract+flow |
| 36 | Settings | Business profile blocked | S-024 | business contract |
| 37 | Settings | Taxes blocked on mobile (web has it) | S-025 area / web parity | expose to mobile |
| 38 | Payments | No payout/settlement visibility | S-018 | view |
| 39 | AI | `/v1/ai/generate` returns 503 | `ai.ts` | wire provider |
| 40 | AI | `/v1/ai/credits/purchase` returns 503 | `ai.ts` | wire purchase |
| 41 | Media | No camera capture | absent; Shopify has it | `image_picker` camera |
| 42 | Inventory | No barcode scanning | absent; Shopify has it | scanner |
| 43 | Domains | No SSL/DNS/renewal visibility | `domain_settings_screen` | surface status |
| 44 | Apps | No embedded runtime/bridge | S-027 | extension-host contract |
| 45 | Apps | Apps open as external URL only | `app_marketplace_service` | embedded webview |
| 46 | Customers | No segments | absent | segment builder |
| 47 | Customers | No merge/delete | absent | endpoints+UI |
| 48 | Security | `/v1/upload` DELETE lacks ownership check | gateway audit (P1 sec) | add ownership verify |
| 49 | Data | `orders.store_id`/`site_id` nullable | master plan P0-3 | NOT NULL + backfill |
| 50 | Data | Partitioned shadow tables never swapped (inert) | migrations 079–083 | finish or remove |

### P3 — Differentiation & ecosystem

| ID | Area | Issue / opportunity | Fix |
|---|---|---|---|
| 51 | Comms | No WhatsApp commerce loop (India-critical) | WA provider + templates |
| 52 | AI | No task-completing AI operator | tool-calling agent over gateway |
| 53 | Engagement | No home-screen widgets | WidgetKit/Android widgets |
| 54 | Engagement | No app-icon order badge | iOS badge on open orders |
| 55 | Growth | No marketing/email (web also lacks) | campaign contracts + composer |
| 56 | Analytics | No Live View | real-time endpoint |
| 57 | Analytics | No CSV/report export on mobile | export |
| 58 | i18n | No localization/markets | S-025 contract |
| 59 | Data | No metafields/custom data | S-026 contract |
| 60 | Editor | No AI "describe your homepage" generator (beats Shopify) | mobile-first generator |
| 61 | Editor | No responsive preview toggle | viewport switch |
| 62 | Media | No video/3D upload | media pipeline |
| 63 | Payments | No COD reconciliation flow (India) | COD ledger+UI |
| 64 | Watch | No Apple Watch app | WatchKit metrics |

### Q — Quality, robustness & governance

| ID | Area | Issue | Evidence | Fix |
|---|---|---|---|---|
| 65 | Test | No widget tests | `test/` | add |
| 66 | Test | No integration/E2E tests | `test/` | add Patrol/integration_test |
| 67 | Test | No mocked-HTTP service tests | `test/` | add |
| 68 | Test | No golden/screenshot tests | absent | add |
| 69 | Arch | `go_router` declared but unused | `pubspec.yaml` vs source | remove or adopt |
| 70 | Arch | All routing hand-rolled in one switch | `routes.dart` | typed router |
| 71 | Resilience | No offline/cache layer for read screens | services | cache + offline read |
| 72 | Resilience | Idempotency only on refund, not all mutations | `order_service` | broaden idempotency |
| 73 | Errors | `SkipNeedsBackendException` surfaced as dead-ends, not graceful "coming soon" w/ desktop handoff | 27 sites | consistent UX pattern |
| 74 | Observability | App emits no telemetry/analytics of its own | forensic report ("observability emits nothing") | add product tracking |
| 75 | Observability | No crash reporting (Crashlytics/Sentry) evident | pubspec | add |
| 76 | Perf | No image caching strategy noted for product media | widgets | cached_network_image |
| 77 | A11y | No documented accessibility pass | — | WCAG audit |
| 78 | Security | Gateway relies on ~208 hand-written ownership checks (RLS bypass via service role) | gateway audit | tighten RLS/centralize |
| 79 | Security | RLS policies were anon-readable until migration 107 | audit V2 | verify deployed |
| 80 | Security | Payment verification was forgeable (fixed in code, must deploy) | `SECURITY_FIXES_APPLIED` | confirm prod deploy |
| 81 | Migrations | Some `CREATE TABLE` without `IF NOT EXISTS` (076,093,095–098) | audit | make replayable |
| 82 | Infra | 6 services are manifest-only placeholders (search, notifications, media, events, analytics, checkout) | service dirs | build as needed |
| 83 | Search | No dedicated search service (trigram SQL only) | migration 084 | search-service when scale demands |
| 84 | Governance | 167 validators pass but measure process, not product | audit V1 quote | re-point checks at product outcomes |
| 85 | Governance | 100KB+ CODEX ledgers create false confidence | repo root | de-emphasize vs real tests |
| 86 | Docs | Multiple overlapping readiness audits/ledgers | repo root | consolidate into this report |
| 87 | Onboarding | No sample/demo data to explore empty store | screens | seed sample product |
| 88 | UX | Notifications bell + several actions are no-ops | dashboard | wire all CTAs |
| 89 | UX | Deep screens re-fetch on open (no shared cache) | detail screens | cache layer |
| 90 | Push | No in-app notification center despite prefs screen | `notifications_screen` | inbox view |
| 91 | Products | No metadata/tags UI | products | add |
| 92 | Products | Import relies on gateway; no progress/feedback | `import_products_screen` | progress UX |
| 93 | Orders | No fraud/risk signal display | order detail | surface risk |
| 94 | Orders | Cancel only via status, no dedicated flow | `orders_screen` | cancel action |
| 95 | Customers | No customer creation on mobile | absent | add |
| 96 | Analytics | No date-range comparison | `analytics_screen` | add compare |
| 97 | Domains | Buy-domain checkout path unverified | `custom_domains` | verify e2e |
| 98 | Themes | Rollback action presence unverified | `theme_versions_screen` | confirm/expose |
| 99 | Billing | No dunning/failed-payment recovery UX | `billing_screen` | add |
| 100 | Settings | Store details save OK but no validation/feedback depth | `store_details_screen` | harden |
| 101 | i18n | App ships limited locales vs Shopify's 7 | l10n | expand |
| 102 | Trust | Sentinels can leak to users as raw error codes | `SkipNeedsBackend` messages | user-friendly copy |
| 103 | Perf | No pagination strategy verified on large catalogs | list services | confirm keyset paging |
| 104 | Security | No documented session expiry/refresh UX | `store_auth_service` | handle expiry |
| 105 | Data | `order_items` has no own tenant column | audit | add tenant scoping |
| 106 | Infra | Push trigger fires but dies on missing creds (silent) | `platform-queue-consumer.ts:557` | alert on push failure |
| 107 | AI | Credits shown but unusable (generation 503) — confusing | `ai_screen` | gate UI on capability |
| 108 | Apps | App permissions view partial | `apps_screen` | full permission display |
| 109 | Editor | No collaborative/lock state for multi-staff edits | editor | conflict handling |
| 110 | Quality | No CI gate tying validators to deploy of the *fixes* | repo | wire CI to product tests |

**How to use this register:** items 1–10 are days of work and unlock everything; 11–30 are the operational core; 31–50 earn trust; 51–64 differentiate; 65–110 are the robustness debt that determines whether the app survives real merchants. Items map directly to the §16 tiers.

---

## §18 — Brutal Review *(Phase 18)*

*If Shopify's mobile team reviewed LetBuyy today. No politeness, as requested.*

### What they'd praise

- **The mobile theme/section editor.** A real, undo/redo-capable visual section editor with live WebView preview that saves to the backend — on a phone. Shopify's own mobile editor is more primitive than this. This is genuinely good and genuinely differentiated.
- **The honesty of the failure modes.** `PlatformBlockedService` and `SkipNeedsBackendException` are, oddly, a sign of engineering maturity: the team chose to fail loudly with a documented missing-contract ID rather than fake a screen. Most teams ship the fake screen. (The *UX* of those dead-ends still needs work — see "redesign.")
- **The breadth and the typed spine.** 25+ domains, a typed API client, a 237-table schema, real idempotent refunds, real inventory/PO/transfer flows. The bones of a commerce platform are here, and inventory + discounts are actually ahead of where you'd expect.

### What they'd reject outright

- **"It doesn't even open."** A production build can't pass its own human-check (Turnstile sentinel) and points at a hostname with no worker behind it. In a Shopify review this is an instant fail before any feature discussion — the P0 of P0s. You cannot demo, let alone ship, an app a merchant can't log into.
- **"You shipped placeholders to production config."** 24 `SKIP_NEEDS_HUMAN_*` sentinels in shipped config, including the payment key and the auth token. That's not "incomplete," that's "not wired up."
- **"There's no push, and you call it an app."** The entire point of a merchant mobile app is the new-order buzz in your pocket. LetBuyy's push is broken three independent ways (no registration route, not in the BFF allowlist, no FCM/APNs creds). An app without push is a website with an icon.
- **"55,000 lines, three tests."** No widget tests, no integration tests, no service tests. Shopify would not let this near a release train.

### What they'd immediately redesign

- **The information architecture.** Two of five bottom-nav tabs are design tools (Editor, Theme) while Orders, Customers, and Analytics — the things a merchant opens 20× a day — are buried inside Settings. Flip it: Home / Orders / Products / Customers / More. This single change reframes the app from "store builder" to "store operator."
- **The dead-end UX.** Routing a merchant to a "this needs a backend contract S-024" screen is honest for engineers and baffling for merchants. Replace with graceful "coming soon / continue on desktop" patterns that never show an internal ledger code to a user.
- **Analytics.** "Charts coming soon" inside a shipped analytics screen is worse than no analytics screen. Either render the data you already have or don't show the card.

### What they'd remove

- **The governance theater, from the critical path.** 100KB+ of CODEX ledgers and 167 green validators that an internal audit says "are measuring the wrong thing." Keep the discipline; stop letting it stand in for product readiness. Delete the unused `go_router` dependency. Collapse the overlapping readiness docs into one source of truth (ideally this report).
- **Promises from the UI that the backend can't keep.** Every "coming soon" snackbar and every credits-balance shown next to a generate button that returns 503. Hide capabilities until they work.

### What they'd rebuild

- **The merchant's money.** Payouts, settlement, wallet, commission, KYC are all blocked at the contract layer. For a commerce platform, "I can't see when I'll get paid or finish KYC on my phone" is foundational, not optional. Build the payout/KYC contracts and the mobile flows on top.
- **The post-purchase loop.** Shipping labels + returns/RMA. Together they're the difference between viewing orders and running fulfillment. Both need real backend contracts and provider integrations.
- **A real test and observability backbone.** Product-level tracking, crash reporting, and a test pyramid — so the next audit measures product, not process.

### What prevents LetBuyy from being a true mobile-first commerce platform

1. **The backend, not the phone, is the bottleneck.** The mobile UI is more finished than the contracts behind it. ~10 domains are gated by missing gateway contracts, not missing screens. Mobile-first success depends on a gateway/back-end push to land payouts, KYC, returns, labels, push, AI provider, collections/reviews mutations, and storefront analytics.
2. **Config and release hygiene.** Sentinels in production config and a half-finished domain migration mean the app's *reliability* story is unproven. No merchant trusts an app that might not log in.
3. **It's built like a store *builder*, not a store *operator*.** The IA, the tab choices, and the read-only customer screens all betray a "let's help you design a store" mindset over "let's help you run one." Shopify mobile is relentlessly operator-first.
4. **No daily-active loop.** No working push, no widgets, no health score, no reason to open the app between orders. Without that loop, even a feature-complete app won't become the place merchants live.
5. **Quality debt.** Three tests, no observability, no crash reporting. At merchant scale this breaks quietly and you won't know why.

**The one-sentence verdict:** *LetBuyy mobile is a surprisingly broad, occasionally excellent store-builder that cannot currently be logged into, cannot push a notification, and cannot run a store's money or returns — but almost everything blocking it is a backend contract or a config value away, and in two or three places (theme editing, mobile discount creation, India-first rails) it has a real chance to beat Shopify rather than merely catch it.*

---

## Appendix A — Evidence index (key files)

**Mobile (`apps/mobile/merchant-app/`)**
- `lib/main.dart` — DI/providers, ApiClient construction
- `lib/app/routes.dart`, `lib/screens/main/store_main_screen.dart` — routing & bottom nav (IA)
- `lib/config/app_config.dart` + `dart-defines/production.json` — base URLs + Turnstile/Razorpay sentinels
- `lib/services/store_auth_service.dart` — Turnstile-gated sign-in
- `lib/services/platform_blocked_service.dart` — 10 blocked features (S-018…S-027)
- `lib/services/skip_needs_backend_exception.dart` + 11 call-site files — backend dead-ends
- `lib/services/push_service.dart` — push registration throws
- `lib/services/{product,order,inventory,coupon,analytics,theme,shipping_tax,staff,subscription,customer,review,app_marketplace,ai_studio}_service.dart`
- `lib/screens/editor/section_editor_screen.dart`, `lib/screens/preview/live_preview_screen.dart` — the strong theme editor
- `lib/screens/analytics/analytics_screen.dart:232–247` — chart placeholders
- `lib/screens/wizard/create_store_wizard.dart` — onboarding save TODO
- `test/` — 3 model tests only

**Backend / infra**
- `services/mobile-bff/src/index.ts`, `wrangler.toml` — proxy allowlist (26 prefixes), `bff.letbuyy.store` route, INTERNAL_API_SECRET gate
- `services/api-gateway/src/index.ts` + `routes/*.ts` — real routes; `routes/ai.ts` (503 stubs); `routes/products.ts` (collections GET/POST only); `routes/notifications.ts` (no device-token route)
- `services/queue-workers/src/push-dispatcher.ts` — real FCM/APNs code; placeholder creds in `wrangler.toml`
- `services/webhook-service`, `services/queue-workers` — real; other 6 services manifest-only
- `database/supabase/migrations/000_baseline.sql` — 237 tables incl. `device_tokens`; migration 107 (RLS fixes)

**Web (`apps/merchant-control-plane/`)** — Next.js 16 store-scoped routes proxying `@letbuyy/api-client`; `BackendNeededPane` for 2FA/localization/metafields/business; POs/transfers stubbed; gift-card create disabled.

**Internal audits referenced** — `PRODUCTION_READINESS_AUDIT_2026-06-07.md`, `..._DEEP_AUDIT_...`, `..._MASTER_PLAN_...`, `SECURITY_FIXES_APPLIED_2026-06-07.md`, `FORENSIC_REPORT/00-EXECUTIVE-SUMMARY.md`.

## Appendix B — Shopify sources

All official Shopify documentation / changelog (June 2026):

- [S1] help.shopify.com/en/manual/shopify-admin/shopify-app
- [S2] help.shopify.com/en/manual/shopify-admin/shopify-app/using-the-shopify-app
- [S3] help.shopify.com/en/manual/shopify-admin/shopify-app/mobile-online-store *(mobile theme editor)*
- [S4] help.shopify.com/en/manual/products/add-update-products
- [S7] help.shopify.com/en/manual/products/product-media/add-media
- [S8] changelog.shopify.com/posts/enhanced-ai-image-generation-and-editing-on-the-shopify-mobile-app *(Nov 13, 2025)*
- [S9] help.shopify.com/en/manual/fulfillment/managing-orders
- [S11] help.shopify.com/en/manual/fulfillment/fulfilling-orders/shipping-labels/buying-labels/buying-labels
- [S12] help.shopify.com/en/manual/fulfillment/managing-orders/returns
- [S13] help.shopify.com/en/manual/fulfillment/managing-orders/returns/creating-returns
- [S14] help.shopify.com/en/manual/shopify-admin/shopify-app/inventory-scanner
- [S15] help.shopify.com/en/manual/customers/manage-customers
- [S16] help.shopify.com/en/manual/reports-and-analytics/shopify-reports
- [S17] help.shopify.com/en/manual/shopify-admin/shopify-app/watch-app
- [S18] help.shopify.com/en/manual/shopify-admin/shopify-app/using-shopify-mobile-widgets
- [S19] help.shopify.com/en/manual/discounts/managing-discounts
- [S21] help.shopify.com/en/manual/discounts/discount-types/percentage-fixed-amount *(discount creation desktop-only)*
- [S24] help.shopify.com/en/manual/domains/add-a-domain
- [S25] help.shopify.com/en/manual/domains/add-a-domain/buying-domains
- [S26] help.shopify.com/en/manual/shopify-admin/shopify-app/mobile-tap-to-pay
- [S27] help.shopify.com/en/manual/finance/shopify-balance/mobile-app
- [S28] help.shopify.com/en/manual/your-account/users/roles/permissions
- [S29] help.shopify.com/en/manual/online-store/themes/customizing-themes/edit-code/edit-theme-code
- [S30] help.shopify.com/en/manual/shopify-admin/productivity-tools/sidekick
- [S31] help.shopify.com/en/manual/shopify-admin/productivity-tools/sidekick/generate-apps *(AI app-gen desktop-only)*
- [S33] help.shopify.com/en/manual/products/collections

---

*End of report. Every status claim above is traceable to a file path or a cited Shopify URL; the audit prioritizes verifiable evidence over completeness-for-its-own-sake.*









