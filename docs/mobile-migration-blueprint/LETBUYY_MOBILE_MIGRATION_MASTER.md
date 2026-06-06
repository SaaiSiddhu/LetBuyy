# LETBUYY MOBILE MIGRATION — MASTER BLUEPRINT

**Subject:** Transforming the Flutter Merchant App into a mobile-first commerce operating system
**Compiled:** 2026-06-06
**Verified against branch:** `stream/letbuyy-foundation-v2` (the checked-out working tree)
**Method:** Repository-wide code reading (apps, services, packages, database, infra, config) cross-checked across four independent deep-dive passes and the repo's own prior audits. Every material claim is traceable to a file path.

> ⚠️ **Branch-dependent state.** The findings below describe the *currently checked-out* tree. The Firebase→gateway re-wire is **real here** but is **not** on `develop` (the branch the repo's `FORENSIC_REPORT/` audited). Re-confirm the branch before acting. See §8.

---

## 0. How to read this blueprint

This master ties together eight companion documents. Read in this order:

| # | Document | What it answers |
|---|----------|-----------------|
| — | **LETBUYY_MOBILE_MIGRATION_MASTER.md** (this file) | The whole picture, the premise correction, and the strategy. |
| 1 | **WEB_FEATURE_MATRIX.md** | Everything the merchant *web* app can do (the parity target). |
| 2 | **FLUTTER_CURRENT_STATE.md** | Everything the Flutter merchant app actually is today. |
| 3 | **FEATURE_GAP_ANALYSIS.md** | Web vs mobile, feature by feature, classified. |
| 4 | **FIREBASE_DECOMMISSION_PLAN.md** | What Firebase remains (spoiler: native config + a quarantined backend), how to remove it safely. |
| 5 | **API_ALIGNMENT_MATRIX.md** | Every gateway API: used by mobile, missing, or legacy. |
| 6 | **DESIGN_SYSTEM_ALIGNMENT.md** | Web vs Flutter tokens/components, and how to reach visual parity. |
| 7 | **MOBILE_ARCHITECTURE_V2.md** | Target architecture, mobile-first workflows, theme-editor strategy. |
| 8 | **LETBUYY_MOBILE_V2_IMPLEMENTATION_MASTER.md** | P0–P4 roadmap, migration sequence, and the brutal CTO review. |

---

## 1. Executive summary (TL;DR)

LetBuyy is a **Cloudflare-Workers-first, Supabase-Postgres-backed, Shopify-style multi-tenant commerce platform.** The web control plane (`apps/merchant-control-plane`, Next.js 16) is a mature, ~60-screen merchant admin that talks to a single Hono API gateway (`services/api-gateway`, `api.letbuyy.store/v1`). The Flutter merchant app (`apps/mobile/merchant-app`, 113 Dart files, ~35k LOC) has **already been migrated off Firebase** onto that same gateway — but it is a **thin shell**: roughly 8–10 of ~30 merchant feature areas are genuinely built, the rest are generic data-viewers or `[NEEDS BACKEND]` placeholders.

**The mission's premise — "the Flutter app currently contains legacy Firebase architecture" — is stale.** On this branch, Firebase is gone from the Dart runtime. The work that remains is not a Firebase rip-out; it is **(a) unblocking a mobile-safe auth path to the gateway, (b) building ~18 missing feature surfaces, (c) excising orphaned native Firebase build artifacts, and (d) hardening (tests, real payments, theme-engine alignment).**

If you do one thing first: **build the mobile session bridge** (§6, Blocker #1). Until then, *no* authenticated mobile merchant journey can run against production.

---

## 2. ⚠️ Critical premise correction (read this first)

The brief assumes the Flutter app is "a legacy Firebase app that has fallen behind." The evidence contradicts that on the current branch:

| Claim in the brief | Evidence on `stream/letbuyy-foundation-v2` | Verdict |
|---|---|---|
| "Flutter contains legacy Firebase architecture" | `0` Firebase/Firestore imports in `apps/mobile/merchant-app/lib` and `packages/dart`. The only hit is a *comment* at `lib/services/storage_service.dart:9` ("Replaces Firebase Storage with multipart uploads to the Hono worker"). No `firebase_*` / `supabase_flutter` in `pubspec.yaml`. | **Stale** |
| "Web evolved to Cloudflare/Supabase/Workers; Flutter hasn't" | Flutter `main.dart` builds a Dio `ApiClient` against `AppConfig.apiBaseUrl` (`https://api.letbuyy.store/v1`); `store_auth_service.dart` does cookie/CSRF auth against `accounts.letbuyy.store` and stores `lb_session` in `flutter_secure_storage`; uploads go to R2 via `/v1/upload`. | **Already aligned at the transport layer** |
| Firebase removal is the core task | Firebase survives only as **(1)** a quarantined backend in `legacy/firebase/` (24 TS files, ~15k LOC, governance status "Deprecated") and **(2)** orphaned native config still shipped in the app bundle (`android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`, the `com.google.gms.google-services` Gradle plugin). | **Reframed** — see Doc 4 |

**What is actually true and actually hard:**

1. The production gateway **rejects the mobile app's `lb_session`** on protected `/v1` routes — it accepts only Supabase Bearer JWTs or HMAC-signed internal headers minted by a trusted server. A native app cannot hold the internal secret. **This is the real migration blocker** (the repo's own `CODEX_MOBILE_PARITY_STATUS.md` flags it as "BLOCKED — NEEDS BACKEND: mobile-safe gateway session bridge").
2. The mobile "parity" layer is a **26-route scaffold** (`lib/screens/parity/merchant_feature_definitions.dart`) — many routes render a generic table or a "needs backend" stub, not real UX.
3. The theme engine the mobile preview must mirror is **itself dual/in-transition** (legacy JSON-contract sections vs a newer Liquid renderer).

---

## 3. Repository topology map

A monorepo (pnpm + turbo for TS; a Dart/Flutter workspace via root `pubspec.yaml`). Governance is strict — `AGENTS.md` is the constitution, `node scripts/validate-governance.mjs` enforces topology.

### 3.1 Apps (`apps/`) — all Next.js on Vercel except mobile
| App | Role | Mobile relevance |
|---|---|---|
| `merchant-control-plane` | **The merchant admin / parity target** (`admin`-class, multi-site-type) | ★★★ primary |
| `identity-platform` | Auth: login/signup/OTP/password (`accounts.letbuyy.store`), issues `lb_session` | ★★★ auth source |
| `storefront-runtime` | SSR storefront (`letbuyy.store`) — themes render here | ★★ preview target |
| `theme-marketplace` | Theme discovery (`themes.letbuyy.store`) | ★ link-out |
| `app-marketplace` | App discovery (`apps.letbuyy.store`) | ★ link-out |
| `developer-portal` | 3rd-party app developers | — |
| `platform-console` / `platform-operations-portal` | Internal platform/ops admin | operator app, not merchant |
| `marketing-site` | Public marketing | — |
| `mobile/merchant-app` | **The Flutter app this blueprint targets** (113 Dart files) | ★★★ |
| `mobile/operator-app` | **Stub** — 2 Dart files, stock counter demo (`letbuyy_super_admin`) | future |
| `mobile/shopper-app` | **Stub** — manifest only, 0 Dart files | future |

### 3.2 Services (`services/`) — Cloudflare Workers
| Service | Status | Notes |
|---|---|---|
| `api-gateway` | **Live Worker** `letbuyy-api` (Hono, `/v1`) | The entire REST surface; 33 route files, ~37 mounts; cron-driven outbox dispatch |
| `webhook-service` | **Live Worker** `letbuyy-webhook` | Inbound Razorpay/Stripe/PayPal/Cashfree; outbound signed delivery |
| `queue-workers` | **Live Worker** | Consumes CF Queues (analytics/search/payment/notification) backed by a Postgres outbox |
| `checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, `analytics-pipeline` | **Reserved stubs** (manifest-only) | Capabilities owned by `api-gateway` + `queue-workers` until a human-approved extraction |

### 3.3 Packages (`packages/`)
- **TypeScript cores:** `commerce-core`, `auth-core`, `billing-core`, `checkout-core`, `cms-core`, `payments`, `theme-engine`, `search-core`, `notification-core`, `tenant-core`, `event-core`, `orchestration`, `app-engine`, `extension-host`, `infrastructure` (incl. `storage-adapter` port), `shared-types`, `application-services`, `distributed-runtime`, `projection-runtime`, `runtime-composition`, `typescript/` (incl. `api-client`, `ui` design tokens).
- **Dart packages (`packages/dart/`):** `api_client` (Dio gateway client), `core` (utils/config/storage), `models` (shared contracts), `ui_kit` (design tokens + widgets), `services` (deprecated empty facade).

### 3.4 Infrastructure
- **Compute:** Cloudflare Workers (gateway/webhook/queues) + Vercel (Next apps). Smart placement `ap-south-1` primary.
- **Data:** Supabase Postgres 17 (~200+ tables, baseline `database/supabase/migrations/000_baseline.sql` ~23.7k lines, +migrations 073–089), reached via **Hyperdrive** pooling. RLS defined (230 enables / 352 policies) but the gateway uses the **service-role client** → tenant isolation is enforced in app code.
- **Media:** Cloudflare **R2** (`letbuyy-media-*`) behind `cdn.letbuyy.store`. Supabase Storage is enabled in config but **unused**.
- **Async:** Cloudflare Queues + Postgres transactional outbox; KV cache; D1 (`RUNTIME_DB`) provisioned but near-dormant; one Durable Object (`RUNTIME_COORDINATOR`) for checkpoints; Analytics Engine telemetry.
- **Identity:** **Custom**, not Supabase Auth for merchants. Opaque 32-byte session tokens in `sessions` table (30-day TTL); three cookie domains — `lb_session` (merchant), `lb_customer_session` (shopper), `lb_console_session` (operator).

---

## 4. From "two systems" to "one backend"

The repo's prior audit described LetBuyy as "two different applications wired to two different backends with two different data models and two different auth systems." On this branch that has **converged**:

- **One backend:** all web apps and the Flutter app call the same `api.letbuyy.store/v1` gateway. Zero direct Supabase from the web; zero Firebase/Firestore from Flutter.
- **One data model (mostly):** the Flutter app deserializes the shared `*Contract` types from `packages/dart/models` (`ProductContract`, `OrderContract`, etc.), which mirror the TS `shared-types`. Caveat: several mobile screens still carry legacy `Map` projections and locally-defined models (see Doc 2 / Doc 6).
- **One identity:** `lb_session` issued by `identity-platform`. Caveat: the **gateway won't accept that cookie from a native client** (Blocker #1).

So the strategic frame is **not** "migrate Flutter off Firebase" (done) but **"finish the convergence and complete the surface."**

---

## 5. Current mobile state at a glance

(Full detail in Doc 2 — FLUTTER_CURRENT_STATE.md.)

- **Architecture:** `provider` (only state lib) + `ChangeNotifier` services; Navigator 1.0 named routes via `onGenerateRoute` (no `go_router`); `AuthWrapper` is the real entry gate (login → wizard → 5-tab shell).
- **5-tab shell** (`store_main_screen.dart`): Home, Editor, Theme, Products, Settings.
- **Genuinely built:** create-store wizard (1,800 LOC), products (list/form/import), orders (list/status/fulfill), on-device theme/section editor with native preview + device frames, store settings (details/domains/SEO/payments), subscription/pricing screens, analytics dashboard (**metrics faked client-side** from `/orders`+`/products` — no analytics endpoint consumed).
- **Scaffold only:** 26 `/features/*` routes via a generic `MerchantFeatureScreen` that does `apiClient.get(endpoint)` and renders rows; several are `[NEEDS BACKEND]` placeholders (gift-cards, checkout, business, localization, security, full billing).
- **Single-store assumption** everywhere (`getFirstStore()`).
- **Auth is not production-safe:** hardcoded `turnstileToken: 'dev-bypass-token'`, dev-OTP signup path.
- **Tests:** one placeholder (`test/widget_test.dart`, asserts `true`).
- **Native build risk:** orphaned `google-services.json` + `GoogleService-Info.plist` + active `com.google.gms.google-services` Gradle plugin (parses a placeholder JSON).
- **Config drift:** `dart-defines/{staging,production}.json` still carry unused `SUPABASE_URL` / `SUPABASE_ANON_KEY` placeholders.

---

## 6. The seven real blockers (priority order)

1. **No mobile-safe gateway session.** Protected `/v1` rejects raw `lb_session`; accepts Supabase Bearer JWT or HMAC internal headers a native app can't safely mint. **→ Build a mobile auth bridge** (Supabase JWT path *or* a thin mobile-BFF Worker). *Nothing authenticated ships until this exists.*
2. **~18 missing feature surfaces** vs web (customers detail, collections CRUD, inventory WMS, coupons, gift cards, CMS pages/blog/nav, media library, shipping, taxes, notifications, staff, policies, reviews, form submissions, app marketplace, full billing). Today they are generic tables or stubs.
3. **Orphaned native Firebase artifacts** (build/security hygiene) — remove plists, `google-services.json`, gms Gradle plugin; strip stray Supabase keys.
4. **Payments stubbed on mobile** — `pricing_screen.dart:249` / `upgrade_screen.dart:324` carry `TODO: Integrate Razorpay`; no native checkout completion.
5. **Theme-engine ambiguity** — storefront renders dual engines (JSON-contract vs Liquid); the mobile preview must target the live one. Decide and align.
6. **Near-zero automated tests** + no certified end-to-end mobile journey (no emulator smoke, no signed iOS build).
7. **Single-store + non-production auth assumptions** baked into navigation and `StoreAuthService`.

---

## 7. Strategic recommendation

**Adopt a "thin native client over a mobile BFF" posture and finish the surface — do not rebuild.** The app's foundation (Dio client, shared contracts, provider DI, on-device editor, design tokens) is sound and already Firebase-free. Sequence:

- **P0 (unblock):** mobile session bridge; production auth (drop dev bypasses); remove orphaned Firebase/Supabase artifacts; wire real Razorpay; add CI + smoke tests. *Outcome: a real merchant can log in and transact from a phone.*
- **P1 (core daily ops):** real Customers, Inventory, Orders detail + refunds, Discounts/Coupons, Notifications (push via existing `device_tokens`), real Analytics endpoint. *Outcome: run the store from a phone.*
- **P2 (store building):** CMS pages/blog/navigation, media library, shipping/taxes, theme switching + publish, domains lifecycle. *Outcome: build & configure a store from a phone.*
- **P3 (growth/extensibility):** staff & RBAC, app marketplace + embedded apps, billing/invoices, reviews, SEO.
- **P4 (parity polish & multi-store):** multi-store switching, offline cache, deep links, accessibility, full design-token consumption, operator/shopper apps.

Full roadmap with effort/dependencies and the CTO review: Doc 8.

---

## 8. Evidence base & verification method

- **Primary-source reading**, not assumption: gateway route files, `wrangler.toml`, Supabase migrations, Flutter `lib/**`, Dart packages, `pubspec.yaml`, `dart-defines/*.json`, native build files.
- **Cross-checked** against the repo's prior audits, with explicit staleness flags. Key contradiction surfaced by the repo's own `docs/audit/01-executive-summary.md`: *"The platform's own status reports disagree with the code — in both directions… this audit supersedes them."*
- **Branch caveat (critical):** the Firebase→gateway re-wire and 26-route shell exist on `stream/letbuyy-foundation-v2`, **not** on `develop` (which `FORENSIC_REPORT/` audited at 113 files / 35,199 LOC still pre-rewire in its narrative). The generated `docs/mobile/README.md` and `docs/design-system/README.md` (dated 2026-05-25) still reference deleted files (`firebase_options.dart`, `supabase_config.dart`, `lib/screens/landing/**`) and are **stale**. Treat *live code on the target branch* as ground truth.
- **Known unverifiables (need a human/backend):** live mobile login (session bridge absent), real provider keys (`SKIP_NEEDS_HUMAN_*` placeholders), Android emulator smoke, signed iOS distribution.

---

## 9. One-line index of companion documents

1. **WEB_FEATURE_MATRIX.md** — ~60 merchant web screens across 5 site types; every domain, workflow, API call, and the RBAC model.
2. **FLUTTER_CURRENT_STATE.md** — screens, services, models, packages, routing, theme editor, Firebase remnants, tests.
3. **FEATURE_GAP_ANALYSIS.md** — the master web-vs-mobile table with FULLY/PARTIAL/MISSING/LEGACY/BROKEN classification.
4. **FIREBASE_DECOMMISSION_PLAN.md** — the real Firebase surface (native artifacts + `legacy/firebase/` + unported wallet/KYC/settlement capabilities) with safe-removal, risk, rollback.
5. **API_ALIGNMENT_MATRIX.md** — every gateway endpoint group mapped to mobile usage; the single-backend mandate; the session-bridge contract.
6. **DESIGN_SYSTEM_ALIGNMENT.md** — TS↔Dart token parity (`#8B5CF6`, Inter, 4/8/12/16/24/32 spacing), component mapping, divergences to fix.
7. **MOBILE_ARCHITECTURE_V2.md** — target auth/session/caching/offline/uploads/push/realtime; mobile-first workflows; theme-editor portability classification.
8. **LETBUYY_MOBILE_V2_IMPLEMENTATION_MASTER.md** — P0–P4 priorities, repo/service/API/data/auth change plan, migration/test/deploy/rollback sequence, and the brutal Shopify-CTO review.
