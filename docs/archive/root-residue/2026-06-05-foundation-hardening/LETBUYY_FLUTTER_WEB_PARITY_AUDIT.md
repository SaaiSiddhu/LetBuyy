# LetBuyy — Flutter Merchant App ↔ Web Merchant App Parity Audit

**Goal:** make the Flutter merchant app a true **cross‑app** of the web merchant admin — same DB, same backend, same contracts, same theme editor — so a merchant can run **end‑to‑end flows on the phone**.
**Verification basis:** direct inspection of `apps/mobile/merchant-app/` (132 Dart files, 24 screens), `packages/dart/{core,models,services,ui_kit}` (160 files), staging/production Dart defines, `lib/config/supabase_config.dart`, and the web `apps/merchant-control-plane` (~56 pages). Findings are evidence‑backed, not assumed.

---

## 0. VERDICT (the one paragraph)

The Flutter merchant app and the web merchant app are **two different applications wired to two different backends with two different data models and two different auth systems.** The web app is now a thin client of the **`api-gateway` (`/v1`) → Supabase** with `lb_session` identity and themes‑as‑data. The Flutter app is a **half‑migrated Firebase app**: it authenticates on **Firebase Auth**, reads/writes mostly through **Firebase/Firestore + a separate Supabase client**, **barely calls the `api-gateway`** (only ~2 endpoints), defines its **own 58 Dart models** (separate from `shared-types`), and ships a **theme editor that is an in-memory visual mock** (edits in‑memory `updateSection`, never persists to `themes`/`theme_releases`). Local Dart define files were retired; the remaining implementation still runs on legacy Firebase. On top of the wiring problem, the Flutter app is **missing ~15 major merchant feature areas** the web app has (customers, discounts, collections, inventory, shipping, tax, checkout, CMS, staff, marketplaces, etc.). To make it a real cross‑app, two things must happen: **(A) re‑wire it onto the one backend** (gateway + Supabase + `lb_session` + generated contracts), and **(B) build the missing features + unify the theme editor** on the themes‑as‑data engine.

---

## 1. THE ROOT PROBLEM — two apps, two backends

```
WEB merchant-control-plane                FLUTTER merchant-app (today)
  React (thin client)                       Flutter
        │ @letbuyy/api-client (typed)              │ FirebaseAuth + supabase_flutter + http
        ▼                                          ▼
  api-gateway  /v1/*  (Hono)        ✗ barely used  Firebase/Firestore  ← primary
        │  lb_session · RBAC                        + a SEPARATE Supabase client
        ▼                                          + Firebase Cloud Function (verifyUpiPayment)
  Supabase (qtrzgnnq… prod)                  Supabase (rvzgkynwhbiksffusqnb… hardcoded) + Firestore
        │                                          │
  shared-types (TS contract)                 packages/dart/models (58 Dart models — separate)
  themes-as-data (renderer registry)         local theme_editor_models + preview_sections (mock)
```

They overlap almost nowhere. Same vision, **disconnected plumbing.**

---

## 2. MISCONFIGURATIONS — the disconnect, ranked

### 🔴 M1 — Auth is Firebase, not the platform identity (`lb_session`)
Flutter uses **`FirebaseAuth`** (25 refs; `signInWithEmailAndPassword`, `signInWithGoogle/Apple/Facebook`, `signInWithCustomToken`, `GoogleSignIn`) plus some `supabase.auth`. There are **zero `lb_session` references** and no use of `identity-platform`/`auth-core`. → A merchant's web login and phone login are **different identity systems**; sessions/roles don't carry across. **Fix:** authenticate via the gateway/`identity-platform` and carry `lb_session`; drop Firebase Auth.

### 🔴 M2 — Backend is Firebase/Firestore, bypassing the `api-gateway`
The data layer (`packages/dart/services`, 51 files) is Firebase‑first: `firestore_data_service.dart`, `fcm_service.dart`, `firebase_auth/storage/analytics`. The app makes only **~2 calls to `/v1`** (`api.letbuyy.store/v1`, `/v1/create-qr-code/`). → It does **not** go through the one Commerce API, so it bypasses RBAC, validation, rate‑limiting, events, and the single source of truth. **Fix:** route all data through `api-gateway` `/v1` via a generated Dart client.

### 🔴 M3 — Two databases (different Supabase project + Firestore)
Code references a hardcoded Supabase project `rvzgkynwhbiksffusqnb.supabase.co` (≠ the web prod project `qtrzgnnq…`) **and** Firestore. Staging/production Dart define files now document the intended gateway configuration, but legacy code still targets Firestore/other projects. → Merchant data written on mobile may land in a **different store** than the web. **Fix:** one Supabase (the platform's), accessed only via the gateway; delete Firestore paths.

### 🟠 M4 — Separate data model → contract drift
`packages/dart/models` defines **58 Dart models** independently of `packages/shared-types` (the TS contract the web/gateway use). → `Product`/`Order`/`Customer`/`Theme` can drift between phone and web. **Fix:** generate Dart models from `shared-types` (one contract, two languages) or hand‑mirror with a conformance test.

### 🟠 M5 — Consumer‑app service layer mixed into the merchant app
`packages/dart/services` is shopper‑flavored: `cart_provider`, `wishlist_provider`, `reel_service`, `reels_preload_provider`, `deals/deal_service`, `loyalty_service`, `sponsored_banner_provider`, `ad_service`, `visual_search_service`, `ai_chat_service`. These belong to the **shopper app**, not the merchant admin. → Bloated, confusing, Firebase‑coupled. **Fix:** split a clean **merchant** service surface (products/orders/customers/themes/settings) over the gateway; keep shopper services in the shopper app.

### 🟠 M6 — Theme editor is a local mock, not themes‑as‑data
The Flutter editor (`screens/editor/section_editor_screen.dart`, `screens/customize/theme_screen.dart`, `widgets/editor/*` incl. its own `preview_sections/preview_{hero,products,about,testimonials,newsletter,footer,header}.dart`, device frames) edits an in‑memory model (`updateSection` only) with **its own `theme_editor_models.dart`** and **its own hardcoded preview sections**. It does **not** read/write the platform `themes`/`theme_releases` tables or render the real theme bundle. → A theme edited on the phone is **not** what the storefront renders. **Fix:** the Flutter editor must read/write the same `theme_packages`/`theme_releases` via `/v1/themes` and preview the **real** storefront (web preview route in a WebView), so web/phone/storefront agree.

### 🟡 M7 — Legacy Firebase still present
`firebase_core`, `firebase_messaging` (FCM), and in `dart/services` `firebase_auth/storage/analytics` (marked "legacy — will be removed") plus a Firebase **Cloud Function** `verifyUpiPayment`. → Dual infra, separate from the gateway's payment path. **Fix:** keep FCM only if push is needed (or move to a platform push); remove Firebase auth/storage/analytics/functions; payments go through the gateway (Razorpay/Cashfree/UPI/COD).

### 🟡 M8 — Mock data & hardcoded demo values
`randomuser.me` avatars, hardcoded WhatsApp `9198…`, demo Firebase web URLs (`myshop-letbuy-y.web.app`, `letbuy-y.web.app`), placeholder cloud‑function URL. → Not production data. **Fix:** replace with real gateway data.

### 🟡 M9 — A marketing landing page shipped inside the app
`lib/screens/landing/**` (hero, pricing, testimonials, footer…) is a full marketing site embedded in the merchant app. → That's `marketing-site`'s job; it bloats the app. **Fix:** remove or gate behind a "logged‑out" splash only.

---

## 3. FEATURE PARITY MATRIX (Web merchant admin vs Flutter)

✅ present · 🟠 partial/mock · ❌ missing

| Merchant feature (web) | Web | Flutter | Notes |
|---|---|---|---|
| Auth / login | ✅ `lb_session` SSO | 🟠 Firebase (different system) | M1 |
| Create‑store wizard | ✅ | ✅ `wizard/` | works (own backend) |
| Dashboard / home | ✅ | 🟠 `dashboard/home` | metrics likely mock/Firestore |
| Products list/create/edit | ✅ | ✅ `products/` (+ import, form) | not via gateway |
| Product CSV import | ✅ | ✅ `import_products` | own path |
| Collections | ✅ | ❌ | **missing** |
| Inventory management | ✅ | ❌ (stock_service only) | **missing screen** |
| Orders list + detail + fulfil/refund | ✅ | 🟠 `orders/` | basic; not gateway |
| Customers + profiles + segments | ✅ | ❌ | **missing** |
| Discounts / Coupons | ✅ | ❌ (coupon_provider only) | **missing screen** |
| Gift cards | ✅ | ❌ | **missing** |
| Reviews management | ✅ | 🟠 (consumer review widgets) | no merchant mgmt screen |
| Analytics / reports | ✅ | 🟠 `analytics/` | basic; own data |
| Online store / Themes (library) | ✅ | 🟠 `customize/` | mock, not library |
| **Theme editor** | ✅ themes‑as‑data | 🟠 **local mock** (M6) | **must unify** |
| Theme marketplace (install) | ✅ | ❌ | **missing** |
| App marketplace (install) | ✅ | ❌ | **missing** |
| CMS: Pages | ✅ | ❌ | **missing** |
| CMS: Blog | ✅ | ❌ | **missing** |
| CMS: Navigation menus | ✅ | ❌ | **missing** |
| Media library | ✅ | ❌ | **missing** |
| Settings: Store details | ✅ | ✅ `settings/store_details` | own path |
| Settings: Domains | ✅ | ✅ `settings/domain_settings` | own path |
| Settings: SEO | ✅ | ✅ `settings/seo_settings` | own path |
| Settings: Payments | ✅ | 🟠 `subscription/connect_razorpay` | partial |
| Settings: Checkout | ✅ | ❌ | **missing** |
| Settings: Shipping & delivery | ✅ | ❌ | **missing** |
| Settings: Taxes (GST) | ✅ | ❌ | **missing** |
| Settings: Notifications | ✅ | ❌ | **missing** |
| Settings: Users & permissions | ✅ | ❌ | **missing** |
| Settings: Policies (legal) | ✅ | ❌ | **missing** |
| Plan & Billing | ✅ | 🟠 `subscription/pricing` + `premium/upgrade` | partial |
| Form submissions / leads | ✅ | ❌ | **missing** |

**Score:** Flutter covers roughly **8–10 of ~30** merchant feature areas, and the ones it has run on a different backend. **~18 feature areas are missing or mock.**

---

## 4. TARGET ARCHITECTURE — one backend, one contract, true cross‑app

The phone must become a **thin Flutter client of the same Commerce API**, exactly like the web is a thin React client. Nothing about the backend changes.

```
  WEB (React)  ─┐
                ├─► @letbuyy/api-client (typed)  ─►  api-gateway /v1/*  ─►  Supabase (one DB)
  FLUTTER (Dart)┘   @letbuyy/dart-client (NEW)        lb_session · RBAC      themes-as-data
                                                      events · webhooks
```

**The 5 unifications (in priority order):**

1. **One identity.** Flutter logs in through `identity-platform`/gateway and carries **`lb_session`** (store it in secure storage; send it on every gateway call). Delete Firebase Auth. A merchant logs in once, same account, web or phone.
2. **One API client.** Create **`packages/dart/api_client`** — a typed Dart mirror of `@letbuyy/api-client` over `/v1/*` (using `dio`, already a dependency). Every screen calls this; **no direct Supabase/Firestore from the app.**
3. **One contract.** Generate `packages/dart/models` from `packages/shared-types` (codegen) — or add a conformance test that fails when Dart and TS models drift. One definition of Product/Order/Customer/Theme.
4. **One database.** Point everything at the platform Supabase **through the gateway**. Remove the hardcoded `rvzgkynwhbiksffusqnb` project and all Firestore reads/writes.
5. **One theme engine.** The Flutter editor reads/writes the **real** theme bundle via `/v1/themes` (settings_schema + `templates/*.json` + sections) and previews the **actual storefront** (load the storefront preview route in a `WebView` with the draft `settings_data`) instead of its hardcoded `preview_sections`. Edits on phone == web == storefront.

> Net effect: the phone and the web become two renderers of the **same** data, contracts, identity, and theme — that is what "cross‑app, end‑to‑end on mobile" means.

---

## 5. THE THEME EDITOR — specifically (M6 deep‑dive)

| | Web theme editor | Flutter editor (today) | Target (unified) |
|---|---|---|---|
| Model | themes‑as‑data (`settings_schema` + `templates/*.json` + section registry) | own `theme_editor_models.dart` | **shared theme bundle** via `/v1/themes` |
| Preview | renders real storefront from data | hardcoded `preview_sections/*` (mock) | **WebView of the real storefront preview route** (draft settings) |
| Persistence | `/v1/themes` → `theme_packages`/`theme_releases` | local `updateSection` only (not saved) | **`/v1/themes`** (same tables) |
| Sections/blocks | data‑described | Flutter‑coded sections | read the **same** section/block schema |
| Device preview | desktop/tablet/mobile | nice device frames ✅ (keep the UX) | keep frames, point at the real preview |

**Keep** the Flutter editor's lovely device‑frame UX (`widgets/editor/device_frames/*`) and section‑tree/drawer interactions — just swap the **data + preview + save** to the platform theme engine. The phone becomes a *better* place to tweak a theme, on the real data.

---

## 6. FULL BUILD LIST — every screen to add for end‑to‑end parity

Build each as a thin Flutter screen over the existing gateway endpoint (no backend work):

**Commerce:** Customers (list + profile + LTV/orders/tags) `/v1/customers` · Collections `/v1/categories|collections` · Inventory management `/v1/inventory` · Discounts/Coupons `/v1/coupons` · Gift cards · Reviews management `/v1/reviews` · Orders detail (timeline, fulfil, refund) `/v1/orders`.

**Online store:** Theme **Library** (current/draft/publish/preview) `/v1/themes` · unified Theme **Editor** (§5) · Theme **Marketplace** (browse/install) · CMS **Pages** `/v1/pages` · **Blog** `/v1/blog` · **Navigation** menus · **Media** library `/v1/media`.

**Apps:** App **Marketplace** (browse/install/consent) `/v1/app-store` · installed‑apps management.

**Settings hub (mirror WS9):** Checkout · Shipping & delivery `/v1/shipping-tax` · Taxes/GST · Notifications `/v1/notifications` · Users & permissions `/v1/employee` · Policies `/v1/pages` · Payments (full, not just Razorpay connect) `/v1/payments` · Plan & Billing (full) `/v1/billing` · Business details · Localization · Security.

**Other:** Form submissions / leads `/v1/form-submissions` · Analytics (real, from `/v1/analytics`).

That's **~22 screens/flows** to reach parity — all UI over endpoints that already exist.

---

## 7. ROADMAP — phased (no backend changes)

**Phase 0 — Re‑wire the plumbing (foundation).** Build `packages/dart/api_client` (dio over `/v1`), wire `lb_session` auth via the gateway/identity, delete Firebase Auth, remove the hardcoded Supabase project + Firestore reads, replace mock data. _Outcome: the phone is now a real client of the one backend._

**Phase 1 — Contract + existing screens.** Generate/align Dart models from `shared-types`; re‑point the screens it already has (dashboard, products, orders, analytics, settings/store/domain/seo, subscription) onto `api_client`. _Outcome: existing features run on the same DB as web._

**Phase 2 — Theme editor unification (flagship).** Swap the editor's data/preview/save to `/v1/themes` + a WebView of the real storefront preview; keep the device‑frame UX. _Outcome: themes match across phone/web/storefront._

**Phase 3 — Missing commerce features.** Customers, collections, inventory, coupons, reviews, gift cards, order detail. _Outcome: full catalog + order ops on mobile._

**Phase 4 — Online store + apps + settings hub.** Theme library + marketplaces, CMS (pages/blog/nav/media), the full settings hub (checkout/shipping/tax/notifications/users/policies/payments/billing). _Outcome: end‑to‑end merchant operation on the phone._

**Phase 5 — Cleanup.** Remove the embedded marketing landing, strip remaining Firebase (keep FCM only if needed), split shopper services out of the merchant surface, add a web↔Dart contract conformance test in CI. _Outcome: lean, consistent cross‑app._

---

## 8. ONE‑LINE NORTH STAR

Make the Flutter app a **second renderer of the same platform** — same identity, same `/v1` gateway, same Supabase, same contracts, same theme engine — so every merchant flow that works on the web works, identically, on the phone.

*Companion docs: `LETBUYY_ENTERPRISE_ARCHITECTURE_AUDIT.md` (platform), `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md` (web UX), and `docs/Codex_waves/CODEX_MOBILE_PARITY_MISSION.md` (WS8 — the executable mission for this work).*
