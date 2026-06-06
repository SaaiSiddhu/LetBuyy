# FEATURE GAP ANALYSIS — Web vs Flutter Merchant

**Comparison:** `apps/merchant-control-plane` (web, parity target) vs `apps/mobile/merchant-app` (Flutter). Scoped to the **`store`** site type (portfolio/resume/blog/landing are out of merchant-mobile scope).

**Classification:**
- **FULLY** — implemented and usable on mobile, comparable to web.
- **PARTIAL** — present but incomplete, faked, or scaffolded (generic viewer / stub).
- **MISSING** — no mobile implementation.
- **LEGACY** — mobile carries old/duplicate logic to retire.
- **BROKEN/BLOCKED** — present but non-functional in production (e.g. blocked by auth bridge or unwired integration).

> **Global blocker:** every authenticated mobile feature is currently **BLOCKED** in production by the missing session bridge (see API_ALIGNMENT_MATRIX.md §0). Statuses below describe the *code* state assuming auth is solved.

---

## 1. Master gap table

| # | Feature | Web | Mobile | Gap | Evidence / notes |
|---|---|---|---|---|---|
| 1 | **Store creation / onboarding** | ✅ (in identity app) | ✅ wizard | **FULLY** | `create_store_wizard.dart` (1,800 LOC) → `POST /stores` + publish; mobile arguably better UX than web's redirect |
| 2 | Store settings (details/SEO/domain string) | ✅ | ✅ | **FULLY** | `store_details_screen`, `seo_settings_screen`, `domain_settings_screen` |
| 3 | **Products** (list/create/edit/media/SEO) | ✅ | ✅ | **FULLY** | `products_screen`, `product_form_screen`; `api.products.*` |
| 4 | Product **variants matrix** | 🟠 options only (sends `variants:[]`) | 🟠 options only | **PARTIAL (both)** | neither generates per-variant SKU/price matrix |
| 5 | Product **import (CSV/catalog)** | ✅ | ✅ | **FULLY** | `import_products_screen` → `/export/import-products` |
| 6 | **Collections** | 🟠 list+create | 🟠 generic viewer | **PARTIAL** | parity route `/features/collections` → `/categories`; no CRUD UI |
| 7 | **Inventory** (levels/adjust) | ✅ basic | 🟠 generic viewer | **PARTIAL** | parity route → `/inventory/levels`; no adjust UI on mobile |
| 8 | Inventory **WMS** (locations/suppliers/POs/transfers) | ❌ stubs | ❌ | **MISSING (both)** | backend has full WMS — mobile can leapfrog |
| 9 | **Orders** (list/status/fulfillment) | ✅ | ✅ | **FULLY** | `orders_screen` (1,456 LOC); fulfill w/ tracking |
| 10 | Order **detail** view | ✅ expandable | 🟠 parity stub `/features/order-detail` | **PARTIAL** | no rich detail screen on mobile |
| 11 | Order **refunds** | ❌ (backend-ready, no web UI) | ❌ (service has `refund()`, no UI) | **MISSING (both)** | `order_service.refund` exists; `POST /orders/:id/refund` ready |
| 12 | **Customers** (list/search) | 🟠 list only | 🟠 generic viewer | **PARTIAL** | both omit detail/addresses the backend supports |
| 13 | Customer **detail + addresses** | ❌ | ❌ | **MISSING (both)** | backend `customers.get` + address CRUD unused |
| 14 | **Discounts / Coupons** | ✅ CRUD | 🟠 generic viewer | **PARTIAL** | `/features/coupons` → `/coupons`; no create/edit/toggle UI |
| 15 | **Gift cards** | ✅ issue | ❌ placeholder (no endpoint) | **MISSING** | parity registry lists gift-cards with no endpoint |
| 16 | **Analytics dashboard** | 🟠 basic real | 🟠 **faked client-side** | **PARTIAL / LEGACY** | `analytics_service` computes from `/orders`+`/products`; should call `/analytics/dashboard` |
| 17 | **Theme: install/switch/publish** | ✅ | ✅ | **FULLY** | `theme_screen.dart` → `ThemeService` |
| 18 | **Theme editor** (sections/blocks/settings) | ✅ (1,891-LOC web editor) | ✅ on-device (976-LOC) | **FULLY (parity, engine caveat)** | mobile has native renderers + device frames; **engine drift risk** (JSON vs Liquid) |
| 19 | Theme editor **versions/rollback** | ✅ | 🟠 fetchReleases/rollback in service | **PARTIAL** | service supports; UI surface thinner than web |
| 20 | **CMS Pages** | ✅ CRUD | 🟠 generic viewer | **PARTIAL** | `/features/pages` → `/pages` |
| 21 | **Blog** (posts/comments) | ✅ | 🟠 generic viewer | **PARTIAL** | `/features/blog` |
| 22 | **Navigation/menus builder** | ✅ | ❌ | **MISSING** | `/features/navigation` registered, no builder UI |
| 23 | **Media library** | ✅ | ❌ (upload only) | **MISSING** | upload works; no browse/delete library |
| 24 | **Shipping** (zones/rates) | ✅ zones | 🟠 generic viewer | **PARTIAL** | `/features/shipping` → `/shipping-tax` |
| 25 | **Taxes (GST)** | ✅ | 🟠 generic viewer | **PARTIAL** | `/features/taxes` |
| 26 | **Payments config** (Razorpay/COD/UPI) | ✅ | ✅ connect-razorpay screen | **FULLY** | `connect_razorpay_screen` → `/stores/{id}/payment-config` |
| 27 | **Payouts / settlement** | ❌ | ❌ | **MISSING (platform gap)** | no backend route anywhere (only `legacy/firebase`) |
| 28 | **Subscriptions / plans** | ✅ Razorpay checkout | 🟠 UI + **BROKEN checkout** | **BROKEN** | `pricing_screen.dart:249` / `upgrade_screen.dart:324` `TODO: Integrate Razorpay` |
| 29 | **Billing / invoices** | ✅ history | ❌ placeholder | **MISSING** | parity registry `billing` = needs-backend stub |
| 30 | **Notifications** (settings) | ✅ toggles | 🟠 generic viewer | **PARTIAL** | `/features/notifications` |
| 31 | **Push notifications** (to device) | n/a (web) | ❌ | **MISSING** | `device_tokens` table + `/notifications` exist; no mobile push client |
| 32 | **Staff & permissions** | 🟠 CRUD, no client gating | 🟠 generic viewer | **PARTIAL** | `/features/users` → `/employees` |
| 33 | **Policies** (refund/privacy/terms) | ✅ | 🟠 generic viewer | **PARTIAL** | `/features/policies` |
| 34 | **Reviews** moderation | ✅ | 🟠 generic viewer | **PARTIAL** | `/features/reviews` |
| 35 | **Form submissions / leads** | ✅ | 🟠 generic viewer | **PARTIAL** | `/features/form-submissions` |
| 36 | **Apps / marketplace** (installed) | ✅ | 🟠 generic viewer | **PARTIAL** | `/features/app-marketplace` → `/app-store/apps` |
| 37 | **Embedded App Bridge** (run apps) | ✅ iframe + postMessage + extensions | ❌ | **MISSING** | hard on mobile; web-only extensibility surface |
| 38 | **Checkout settings** | ✅ | ❌ placeholder | **MISSING** | parity `checkout` = no endpoint |
| 39 | **Business details** (GSTIN/legal) | ❌ needs-backend stub | ❌ placeholder | **MISSING (both)** | backend contract documented, not built |
| 40 | **Localization / markets** | ❌ needs-backend stub | ❌ placeholder | **MISSING (both)** | scaffolded only |
| 41 | **Security (2FA/passkeys)** | ❌ needs-backend stub | ❌ placeholder | **MISSING (both)** | no 2FA anywhere |
| 42 | **Custom data (metafields)** | ❌ needs-backend stub | ❌ | **MISSING (both)** | — |
| 43 | **Domains lifecycle** (DNS/SSL verify) | 🟠 string only | 🟠 `DomainService` has verify, thin UI | **PARTIAL** | `domain_service.dart` has `verifyDomain`; UI minimal |
| 44 | **AI Studio / content gen** | 🟠 read-only credits, stub chat | ❌ | **MISSING / PARTIAL** | web sidebar chat is hardcoded stub |
| 45 | **SEO** (per-product + storefront) | 🟠 | 🟠 `seo_settings_screen` | **PARTIAL** | sitemap/redirects/structured-data absent both |
| 46 | **Live storefront preview** | ✅ iframe | ✅ WebView | **FULLY** | `live_preview_screen.dart` |
| 47 | **Multi-store switching** | ✅ `/stores` picker | ❌ `getFirstStore()` only | **MISSING** | single-store assumption pervasive |
| 48 | **Auth: login/signup** | ✅ (identity app) | 🟠 BROKEN in prod | **BROKEN** | dev-bypass Turnstile + session not gateway-accepted |
| 49 | **Auth: 2FA/SSO** | ❌ | ❌ | **MISSING (both)** | — |
| 50 | **Offline support** | n/a | ❌ | **MISSING** | hive available in `core`, unused |

---

## 2. Tally by classification

| Classification | Count | Examples |
|---|---|---|
| **FULLY** | ~9 | store creation, settings, products, import, orders (core), payments config, theme install/editor, live preview |
| **PARTIAL** (scaffold/faked/thin) | ~20 | collections, inventory, customers, coupons, analytics(faked), pages, blog, shipping, taxes, notifications, staff, policies, reviews, form-submissions, apps, order-detail, theme versions, domains, SEO, navigation builder |
| **MISSING** | ~14 | gift cards, media library, billing, push, app bridge, checkout settings, multi-store, WMS, customer detail, payouts, business/localization/security/custom-data |
| **LEGACY** (retire) | ~2 | faked analytics service, legacy product `Map` projection |
| **BROKEN/BLOCKED** | core | auth (prod), subscription checkout (Razorpay TODO); + *all* authenticated features blocked by session bridge |

**Reading:** the Flutter app is **~30% truly built, ~45% scaffolded, ~25% missing** against web — but the scaffolding (26-route registry + generic viewer + shared contracts) means many PARTIALs are **fast to finish** (the backend exists; it's UI work).

---

## 3. Where mobile can *exceed* web (leapfrog opportunities)

The backend supports more than the web exposes; mobile can ship these first and pressure web to follow:
- **Order refunds** (`POST /orders/:id/refund` ready, web has no UI).
- **Customer detail + addresses** (backend ready, web is list-only).
- **Inventory WMS** (locations/suppliers/POs/transfers exist, web stubs them).
- **Push notifications** (`device_tokens` + `/notifications` exist; inherently a mobile strength).

---

## 4. Where mobile will lag web (accept or de-scope)

- **Embedded App Bridge / Admin UI extensions** — iframe + postMessage + `@letbuyy/extension-host` is desktop-shaped; a true mobile equivalent is a large, separate effort. De-scope to "view installed apps + deep-link to web" initially.
- **Theme editor depth** — schema-driven section editing is portable (mobile already has a strong start) but the long tail of settings forms and the dual-engine preview will lag.
- **Bulk operations / CSV-heavy flows** — import works; large bulk editing is desktop-leaning.
- **Platform gaps that block both** (payouts, 2FA, business/localization/custom-data, metafields) — neither can ship until the backend exists.

---

## 5. Dependency note for sequencing

Most PARTIAL→FULLY conversions depend only on **(a)** the session bridge (P0) and **(b)** building UI over endpoints that already exist. The MISSING items split into **buildable now** (gift cards UI, media library, billing UI, push, multi-store, customer detail, WMS, refunds) vs **blocked upstream** (payouts, 2FA, business/localization/security/custom-data, app bridge). Roadmap in LETBUYY_MOBILE_V2_IMPLEMENTATION_MASTER.md sequences accordingly.
