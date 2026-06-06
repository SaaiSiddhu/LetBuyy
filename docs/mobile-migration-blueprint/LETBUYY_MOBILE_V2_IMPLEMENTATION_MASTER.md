# LETBUYY MOBILE V2 — IMPLEMENTATION MASTER

Covers Phase 11 (roadmap), Phase 12 (implementation master plan), Phase 13 (brutal CTO review). Read after the other seven documents.

**One-line thesis:** The Flutter app is **already off Firebase and on the gateway** — the job is to **unblock mobile auth, finish ~18 scaffolded surfaces, harden, and align the theme engine**, not to re-platform.

---

## PART 1 — Roadmap (P0–P5)

Effort: **S** ≤1 wk · **M** 1–3 wks · **L** 3–6 wks · **XL** 6+ wks (1–2 eng).

### P0 — UNBLOCK (nothing authenticated ships without this)
| Item | Business value | Complexity | Depends on | Effort |
|---|---|---|---|---|
| **Mobile session bridge** (BFF Worker *or* Supabase JWT) | Enables every authenticated feature | High | backend decision | **L** |
| **Production auth hardening** — remove `dev-bypass-token`, dev-OTP; real Turnstile/OTP | Security; app-store viability | Med | session bridge | M |
| **Wire Razorpay** (`pricing`/`upgrade` TODOs) → real subscription checkout | Revenue | Med | provider keys | M |
| **Excise orphaned Firebase/Supabase native artifacts** | Clean builds, security hygiene | Low | — | S |
| **CI + smoke tests** (analyze, build APK/IPA, 1 golden-path widget/integration test) | Stops regressions | Med | — | M |
| **Real provider/env keys** (replace `SKIP_NEEDS_HUMAN_*`) | Live transactions | Low (human) | secrets | S |

**P0 exit:** a real merchant logs in on a physical device, sees their store, and completes a subscription purchase. *(Today: 401 at login.)*

### P1 — RUN THE STORE FROM A PHONE (daily ops)
| Item | Value | Cx | Effort |
|---|---|---|---|
| **Orders: detail screen + refunds** (`/orders/:id`, `/refund`) | Core ops; leapfrog web | Med | M |
| **Real analytics** — consume `/analytics/dashboard` (retire faked computation) | Truthful metrics | Low | S |
| **Customers: detail + addresses** (leapfrog web) | Support | Med | M |
| **Inventory adjust UI** (`/inventory/adjust`) + low-stock view | Ops | Low | S |
| **Discounts/Coupons CRUD** UI | Marketing | Med | M |
| **Push notifications** (FCM/APNs → `device_tokens` → dispatcher) | Retention; mobile-native | High | L |
| **Notifications settings** real UI | Config | Low | S |

**P1 exit:** a merchant can process orders (incl. refunds), see real numbers, help customers, restock, run discounts, and get pushed on new orders.

### P2 — BUILD & CONFIGURE A STORE FROM A PHONE
| Item | Value | Cx | Effort |
|---|---|---|---|
| **Theme: switch/publish/versions** UI + **WebView authoritative preview** (engine-safe) | Storefront control | Med | M |
| **CMS: Pages + Blog + Navigation builder** | Content | High | L |
| **Media library** (browse/delete over `/media`) | Assets | Med | M |
| **Shipping zones + Taxes** CRUD UI | Setup | Med | M |
| **Domains lifecycle** (DNS records copy + verify + SSL status) | Custom domain | Med | M |
| **Collections CRUD**, **product variant matrix** | Catalog depth | Med | M |
| **Inventory WMS** (locations/suppliers/PO receiving + **barcode scan**) — leapfrog web | Ops power | High | L |

**P2 exit:** a merchant can fully build and configure a store — theme, content, shipping, taxes, domain — without a laptop.

### P3 — GROWTH & EXTENSIBILITY
Staff & RBAC (with client gating), Billing/invoices UI, Reviews moderation, Form submissions/leads, Gift cards, SEO surfaces, AI content (if web matures), App marketplace browse + **deep-link to web** for embedded apps. Effort: **L** total.

### P4 — PARITY POLISH & SCALE
Multi-store switching (replace `getFirstStore()`), offline read cache (Hive), deep links (`go_router`), accessibility (WCAG AA — see `design:accessibility-review`), full design-token consumption (kill hardcoded colors, Inter standardization), localization beyond EN/HI/TA. Effort: **L**.

### P5 — PLATFORM-BLOCKED (needs backend first; not mobile-only)
Payouts/settlement, wallet, commission engine, KYC, returns flow, 2FA, business/localization/custom-data (metafields), embedded App Bridge on mobile. **These cannot be built on mobile until the backend exists** (only in `legacy/firebase/` today). Track as platform dependencies.

---

## PART 2 — Implementation Master Plan

### 2.1 Repository / folder changes (`apps/mobile/merchant-app`)
- **Remove** native Firebase artifacts (gms plugin in `android/app/build.gradle.kts:7` + `android/settings.gradle.kts:24`; `android/app/google-services.json`; both `GoogleService-Info.plist`); strip Supabase keys from `dart-defines/*.json`.
- **Promote `SubscriptionService`, `DomainService`, `PreviewService`** into `MultiProvider` (stop ad-hoc instantiation).
- **Replace the parity scaffold** (`lib/screens/parity/`) with real feature screens incrementally; keep the registry as a feature-flag/index until each is built.
- **Add** `lib/services/push_service.dart`, `lib/services/cache_service.dart` (Hive), a `StoreContext` provider for multi-store.
- **Reconcile models:** delete `product_service` legacy `Map` projection; use `ProductContract` end-to-end.

### 2.2 Service / new-infra changes
- **Mobile session bridge** (Option A): new `services/mobile-bff` CF Worker (governed addition — update `AGENTS.md` runtime map + `validate-governance.mjs`), or extend an existing trusted boundary. *(Option B requires no new service but a Supabase token-issuance flow.)*
- **Push dispatcher:** a `queue-workers` consumer that reads `/notifications` events and delivers to FCM/APNs via `device_tokens`.

### 2.3 API changes (backend asks — mostly *none*; build clients)
- **No new endpoints needed for P0–P2** except the session-bridge contract — the gateway already exposes products/orders/customers/inventory/coupons/analytics/themes/pages/blog/shipping/taxes/media/notifications.
- **New/confirmed contracts required:** mobile-safe **gift-card** issue; **business/localization/security/custom-data** (also missing on web); **payouts/returns** (platform, P5).

### 2.4 Data-model changes
- **None on the server** for P0–P2 (schema already supports it). Client-side: converge on shared `*Contract` types; add a local cache schema for Hive.

### 2.5 Auth changes
- Implement the chosen session bridge; remove dev bypasses; store credential in `flutter_secure_storage`; add `GET /v1/auth/custom/session` health checks; handle 401 → re-auth.

### 2.6 Migration sequence (ordered)
1. Native-artifact cleanup PR (isolated, revertible) → green builds + CI.
2. Session bridge (backend + app) → first authenticated `GET /products` on device.
3. Production auth hardening + real keys.
4. Razorpay checkout.
5. P1 feature build-out (orders detail/refund, analytics, customers, inventory adjust, coupons, push).
6. P2 store-building (theme/CMS/media/shipping/taxes/domains/WMS).
7. P3/P4 polish; P5 as backend unblocks.

### 2.7 Testing sequence
- **Unit:** services (mock Dio) — auth, store, product, order, subscription.
- **Contract:** assert Dart `*Contract` deserialization against gateway response fixtures.
- **Widget:** golden paths (login, create product, fulfill order).
- **Integration:** against a staging gateway with a test merchant (the session bridge makes this possible).
- **Manual/E2E:** physical-device login → transact; Android emulator smoke (the repo notes the AVD currently exits 1 — fix CI image); signed iOS build.

### 2.8 Deployment sequence
- Flutter: staging via `--dart-define-from-file=dart-defines/staging.json` → internal testing tracks (TestFlight / Play Internal) → production with real keys.
- Bridge Worker: wrangler staging → production, gated by governance validation.

### 2.9 Rollback strategy
- **App:** versioned releases; phased rollout (Play staged %, TestFlight); kill-switch via server feature flag; previous build always available.
- **Bridge:** Workers support instant rollback (`wrangler rollback`); the bridge is stateless (reads `sessions`), so rollback is safe.
- **Native cleanup PR:** single `git revert`.
- **No destructive data migrations** in this program — server schema is unchanged.

---

## PART 3 — Brutal CTO Review (if Shopify reviewed this today)

### What they'd PRAISE
- **The hard re-platform is already done.** Off Firebase, onto a single typed gateway with shared contracts — most teams never finish this. The "two apps, two backends, two auth systems" problem has genuinely converged.
- **A real on-device theme editor** with native section renderers, device frames, draft/preview/release plumbing — most commerce mobile apps punt theming to a WebView. This is differentiated.
- **Backend is serious:** Workers + Hono + Hyperdrive + transactional outbox + Queues + R2, with smart placement in-region (India). The data model (~200 tables) is comprehensive and Shopify-shaped (sites/products/variants/orders/fulfillment/refunds/themes/app installs).
- **Strong mobile UX primitives:** glassmorphism, density tokens, shimmer/empty/error states, a polished create-store wizard.
- **Governance discipline** (AGENTS.md, validators, reserved-service manifests) — unusually mature for the stage.

### What they'd REJECT
- **It doesn't actually log in against production.** The gateway rejects the mobile session — so today it's a beautiful shell with no authenticated journey. **Unshippable until the bridge exists.** This is the headline.
- **Security smells:** `turnstileToken:'dev-bypass-token'` hardcoded, dev-OTP signup that trusts a `devOtp` from the response, three identity systems, RLS bypassed via service-role (tenant isolation only in app code). An app-store reviewer and a security reviewer both bounce this.
- **Faked analytics.** Computing "revenue" client-side from 100 orders is misleading and won't scale — reject on data-integrity grounds.
- **~1 test for 35k LOC.** No certified end-to-end mobile journey, no emulator smoke, no signed iOS build. Not production-grade.
- **The "parity" registry is theater.** 26 routes where many render a generic table or a "needs backend" card is *scaffolding presented as features*. Don't claim parity.
- **Status reports that disagree with the code** (the repo's own audit says so). A CTO distrusts a team whose ledgers say "DONE" while the binary 401s.
- **Single-store hardcoding** (`getFirstStore()`) — fine for a demo, wrong for a platform.

### What they'd immediately REWRITE
- **The auth/session layer** — collapse to one mobile-safe path; delete dev bypasses. Non-negotiable, first.
- **`analytics_service`** — replace client-side computation with `/analytics/dashboard`.
- **The parity scaffold** — convert generic viewers into real, typed feature screens or hide them behind flags; stop shipping placeholders as routes.

### What they'd KEEP
- The Dio `api_client` + shared `*Contract` model layer.
- The provider/ChangeNotifier structure (don't churn to bloc/riverpod without cause).
- The on-device theme editor foundation (but make the WebView preview authoritative to dodge engine drift).
- The design-token system and ui_kit.
- The create-store wizard, products, and orders core.

### The one-sentence verdict
> *"You've done the expensive, invisible 70% — the re-platform — and stopped one inch short of the visible 30% that makes it real: a mobile session that the gateway accepts. Build the bridge, delete the dev bypasses, replace the faked data and the placeholder routes with the endpoints you already have, write tests, and you ship a genuinely mobile-first commerce OS. Until the bridge exists, it's a high-fidelity prototype, not a product."*

---

## Appendix — Definition of Done (program-level)
1. A real merchant completes **login → create product → receive order → fulfill → refund → upgrade plan** on a physical device against production.
2. Zero Firebase artifacts in the app bundle; zero stray secrets in `dart-defines`.
3. Analytics, products, and orders read from the gateway only (no client-side business logic).
4. ≥1 automated test per core service + golden-path integration tests in CI; Android+iOS builds gated.
5. Theme preview is authoritative against the live storefront engine.
6. Each `legacy/firebase` ❌-capability (wallet/commission/settlement/KYC/returns) has a logged "re-implement or drop" decision.
7. Docs (`docs/mobile/README.md`, `docs/design-system/README.md`) regenerated to match the current branch.
