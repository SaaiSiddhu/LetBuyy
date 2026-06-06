# CODEX MOBILE FOUNDATION — MASTER EXECUTION MISSION (single autonomous run)

> **Paste this entire document into Codex as the mission.** It is self-contained. It drives the LetBuyy codebase to the target state defined by the nine documents in `docs/mobile-migration-blueprint/`. Execute **P0 → P4 in one continuous run**. **Never stop for human input.** When a step genuinely requires a human, write a placeholder, log it in the ledger, and **continue**.

---

## 0. WHO YOU ARE & THE PRIME DIRECTIVE

You are a single autonomous staff-level engineer with these hats at once: **Shopify Mobile Platform Architect, Staff Flutter Engineer, Staff Next.js Engineer, Cloudflare Architect, Supabase Architect**. You have the whole monorepo.

**Prime directive:** Transform the Flutter merchant app (`apps/mobile/merchant-app`) into a fully capable, mobile-first commerce operating system aligned to the live Cloudflare/Supabase/Workers backend — implementing **every issue across all nine blueprint docs (P0–P4)** in one run. A merchant must be able to do *everything* from a phone: create/configure a store, manage products, inventory, orders, customers, domains, themes, pages, discounts, analytics, payments, shipping, apps, settings, staff, subscriptions, and theme customization — **with no laptop**.

**You do not pause.** This is a "full-send" run. You write code, infra, wrangler config, governance manifests, tests, and CI. The only things you may defer are listed in §2; you defer them by placeholder + ledger entry and keep moving.

**Branch:** work on `stream/letbuyy-foundation-v2` (the branch where the Firebase→gateway rewire already landed). If policy requires, cut `stream/mobile-foundation-v1` from it. Record the branch + HEAD in the status file.

**Constitution (obey in this order):** root `AGENTS.md` → nearest local `AGENTS.md` → `docs/governance/**`. After **any** topology/import/package/environment/generated-artifact/governance change, run `node scripts/validate-governance.mjs` and fix until green. **The run is not done until the validator is green.**

---

## 1. GROUND TRUTH (read before you touch anything)

1. The nine blueprint docs in `docs/mobile-migration-blueprint/` are your **spec**. Read all nine first:
   `LETBUYY_MOBILE_MIGRATION_MASTER.md`, `WEB_FEATURE_MATRIX.md`, `FLUTTER_CURRENT_STATE.md`, `FEATURE_GAP_ANALYSIS.md`, `FIREBASE_DECOMMISSION_PLAN.md`, `API_ALIGNMENT_MATRIX.md`, `DESIGN_SYSTEM_ALIGNMENT.md`, `MOBILE_ARCHITECTURE_V2.md`, `LETBUYY_MOBILE_V2_IMPLEMENTATION_MASTER.md`.
2. **Verified premise (do not re-litigate):** Firebase is already removed from the Flutter runtime on this branch (only a comment remains at `lib/services/storage_service.dart:9`). The real blockers are: (a) the gateway rejects the app's `lb_session`; (b) ~18 feature surfaces are scaffolds/stubs; (c) orphaned native Firebase/Supabase artifacts; (d) Razorpay stubbed; (e) faked analytics; (f) near-zero tests; (g) single-store + non-prod auth assumptions.
3. **Read actual code, cite actual files, verify every change.** Do not invent endpoints — every gateway path you call must exist in `services/api-gateway/src/routes/**`. If an endpoint is missing, see §2 (stub + ledger) — do not fabricate behavior.
4. The backend is **one** gateway: `api.letbuyy.store/v1` (Cloudflare Worker `letbuyy-api`, Hono). The mobile app must use **only** this backend (via the BFF in §3). No direct Postgres, no Firebase, no second backend.

---

## 2. THE SKIP-AND-CONTINUE PROTOCOL (read twice)

You implement everything you can. You **defer — never block on — only these categories**:

| Category | What you do instead | Placeholder convention |
|---|---|---|
| Real secret **values** (API keys, `INTERNAL_API_SECRET`, provider keys) | Write the wiring; inject a typed placeholder | `SKIP_NEEDS_HUMAN_<SCOPE>_<KEY>` (matches existing `dart-defines` convention) |
| Production **deploy / DNS / custom-domain activation** | Write the wrangler/CI config fully; do not run the live deploy | `// [SKIP-NEEDS-HUMAN: prod deploy — config ready]` |
| App-store **signing / distribution** | Write build config + CI lanes; do not sign | ledger entry |
| Creating external **provider accounts** (Razorpay, FCM/APNs certs) | Write all code paths + config; reference placeholder creds | `SKIP_NEEDS_HUMAN_*` |
| **Platform product/legal decisions** (wallet, commission, settlement, KYC, returns — only in `legacy/firebase/`, no gateway route) | Build the mobile UI behind a feature flag pointing at a stubbed contract; do not invent the backend | `// [SKIP-NEEDS-BACKEND: <capability> has no gateway route]` + ledger |
| Backend **needs-backend** contracts also missing on web (business/localization/security-2FA/custom-data/gift-card mobile contract) | Build the client + a typed client-side stub; flag the missing contract | ledger |

**Rules:**
- **You never halt.** Blocked → stub with a typed placeholder that compiles → log → next item.
- Every placeholder is greppable (`SKIP_NEEDS_HUMAN` or `SKIP-NEEDS-BACKEND`) and has a **ledger row**.
- Placeholders must **fail loud at runtime if hit in production** (throw `UnimplementedError`/`SkipNeedsHumanException` with the ledger id), never silently no-op.
- Maintain `docs/mobile-migration-blueprint/CODEX_MOBILE_FOUNDATION_LEDGER.md`:

```
| ID | Phase | Item | Why deferred | Placeholder used | Unblock action | Owner |
|----|-------|------|--------------|------------------|----------------|-------|
| S-001 | P0 | INTERNAL_API_SECRET for BFF | secret value | env SKIP_NEEDS_HUMAN_BFF_INTERNAL_API_SECRET | set CF secret + redeploy | human |
```

---

## 3. P0 — AUTH FOUNDATION: the Mobile BFF Worker (Option A) [DO THIS FIRST]

**Problem (verified):** gateway `services/api-gateway/src/middleware/auth.ts` (`:161` onward) accepts only a **Supabase Bearer JWT** (`supabase.auth.getUser`) or **HMAC-signed `X-LetBuyy-Internal-Session-Token`** (`getInternalSessionAuthContext`, `verifyLetbuyyInternalSessionHeaders`). The app sends the opaque `lb_session` as `Authorization: Bearer` + `Cookie` (`packages/dart/api_client/lib/src/api_client.dart:1233-1238`) → **rejected**. Nothing authenticated works until this is fixed.

**Build a new Cloudflare Worker `services/mobile-bff`:**

3.1 **Scaffold (Hono, mirrors gateway conventions):**
- `services/mobile-bff/{package.json, wrangler.toml, tsconfig.json, src/index.ts, runtime.manifest.json}`.
- Service binding to the gateway (`API_GATEWAY_SERVICE`), like `webhook-service` has. Routes: `bff.letbuyy.store` (prod) / `bff-staging.letbuyy.store`. `nodejs_compat`, smart placement `ap-south-1`.
- Secret `INTERNAL_API_SECRET` (same value the gateway verifies) → **placeholder** `SKIP_NEEDS_HUMAN_BFF_INTERNAL_API_SECRET` in `.dev.vars`/wrangler `[vars]`, ledger S-001.

3.2 **Behavior:** the BFF is a thin, trusted re-signer.
- Accepts the app's credential (the `lb_session` opaque token in `Authorization: Bearer` or a custom header).
- Validates it against the `sessions` table (reuse the gateway's `/v1/auth/custom/session` validator path via the service binding, or query `sessions` through the same Supabase service client the gateway uses).
- For each upstream call, injects `X-LetBuyy-Internal-Session-Token` + `X-LetBuyy-Internal-Timestamp` + `X-LetBuyy-Internal-Signature` using `createLetbuyyInternalSessionHeaders(token, secret)` from `@letbuyy/auth-core`, then proxies to the gateway and streams the response back.
- Pass-throughs: every `/v1/**` merchant route the app needs (allow-list mirrors API_ALIGNMENT_MATRIX.md). Public auth (`/auth/*`) and `/upload` handled appropriately.
- Add `GET /health`.

3.3 **Governance:** update `AGENTS.md` Canonical Runtime Map to add `services/mobile-bff`; add wrangler binding/ownership manifests like the other Workers; run `node scripts/validate-governance.mjs` until green (Cloudflare topology/binding/env validators must pass).

3.4 **App side (`apps/mobile/merchant-app`):**
- Add `BFF_BASE_URL` to `lib/config/app_config.dart` + `dart-defines/{staging,production}.json` (default `https://bff.letbuyy.store`). Point `ApiClient.baseUrl` at the BFF (keep `/v1` normalization) **or** add a BFF base distinct from identity.
- **Remove the dev bypasses in `lib/services/store_auth_service.dart`:** delete the hardcoded `turnstileToken:'dev-bypass-token'` (pass a real Turnstile token; if none available in CI, `SKIP_NEEDS_HUMAN_TURNSTILE_TOKEN` + ledger) and the dev-OTP path that trusts `devOtp` from the response.
- Keep `lb_session` in `flutter_secure_storage`. On `401`, clear session + route to login. Health-probe via the BFF→`/v1/auth/custom/session`.

3.5 **Acceptance (must hold or be ledgered):** with a valid `lb_session`, `GET <bff>/v1/products?store_id=…` returns the merchant's catalog (today it 401s). Write an integration test against staging (real login = `SKIP_NEEDS_HUMAN` if no test merchant).

---

## 4. P0 — STRUCTURAL HARDENING (do alongside §3)

4.1 **Excise orphaned native Firebase/Supabase artifacts** (one isolated commit; see FIREBASE_DECOMMISSION_PLAN.md §3):
- Delete line `apps/mobile/merchant-app/android/app/build.gradle.kts:7` → `id("com.google.gms.google-services")`.
- Delete the `com.google.gms.google-services … apply false` line in `android/settings.gradle.kts:24`. **Keep** `google()` at `:14`.
- Delete `android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`, `ios/GoogleService-Info.plist`.
- Remove `SUPABASE_URL` + `SUPABASE_ANON_KEY` from `dart-defines/staging.json` + `dart-defines/production.json` + `dart-defines/README.md`.
- Update the stale comment in `lib/services/storage_service.dart:9`.
- Verify `flutter clean && flutter pub get && flutter build apk --debug … && flutter build ios --no-codesign …` succeed.

4.2 **Retire faked analytics (LEGACY removal):** rewrite `lib/services/analytics_service.dart` to consume gateway `GET /v1/analytics/dashboard` + `/v1/analytics/orders` instead of computing metrics from `/orders`+`/products`. Keep the `StoreAnalytics` model shape; map from the endpoint. Update `analytics_screen.dart` + `home_screen.dart`.

4.3 **Reconcile data models:** delete the legacy camelCase `Map` projection (`_toLegacyProductMap`) in `lib/services/product_service.dart`; use `ProductContract` (from `packages/dart/models`) end-to-end. Audit all services for local model drift; converge on the shared `*Contract` types.

4.4 **DI cleanup:** promote `SubscriptionService`, `DomainService`, `PreviewService` into the `MultiProvider` in `lib/main.dart`; remove ad-hoc `context.read<ApiClient>()` instantiation in screens (`pricing_screen.dart:56`, `connect_razorpay_screen.dart:55`, etc.).

4.5 **Wire Razorpay (BROKEN→DONE):** replace the stubs at `lib/screens/subscription/pricing_screen.dart:249` and `lib/screens/premium/upgrade_screen.dart:324`. Implement subscription checkout against `POST /v1/payments/subscription/order` → Razorpay (add `razorpay_flutter` or a WebView checkout) → `POST /v1/payments/subscription/verify`. Publishable key from `RAZORPAY_KEY_ID` (placeholder `SKIP_NEEDS_HUMAN_*_RAZORPAY_KEY_ID` ok); never embed the secret key.

4.6 **CI + tests (kill the 1-test problem):**
- Add a CI workflow (GitHub Actions or the repo's convention) running: `flutter analyze`, `flutter test`, `flutter build apk --debug`, `flutter build ios --no-codesign`, and `node scripts/validate-governance.mjs`.
- Add real tests: unit tests per service (mock Dio), contract tests deserializing `*Contract` from gateway response fixtures, widget golden-path tests (login, create product, fulfill order), and an integration test scaffold against staging.
- Fix the Android emulator smoke (the repo notes the AVD exits 1) or ledger it.

4.7 **Design-system consumption** (DESIGN_SYSTEM_ALIGNMENT.md §6): replace hardcoded `Color(0xFF8B5CF6)` across screens with `LetbuyyColorTokens`/`AppThemeColors`; standardize on **Inter** (fix `ui_kit/AppTextStyles` Poppins usage); collapse the two Dart color systems (`StoreAdminColors` → alias of token layer); add the `48` spacing step.

4.8 **Regenerate stale docs:** `docs/mobile/README.md` + `docs/design-system/README.md` still reference deleted files (`firebase_options.dart`, `supabase_config.dart`, `lib/screens/landing/**`). Regenerate to match the current branch.

---

## 5. P1 — RUN THE STORE FROM A PHONE (core daily ops)

Convert these from scaffold/faked to **real, typed, token-styled screens**. Each uses an **existing** gateway endpoint (verified). Replace the relevant `/features/*` generic-viewer entries in `lib/screens/parity/merchant_feature_definitions.dart` with first-class screens; keep the registry as a feature index/flag.

| Feature | Endpoint(s) | Build |
|---|---|---|
| **Order detail + refunds** | `GET /v1/orders/:id`, `POST /v1/orders/:id/refund` (+ `…/refund/complete`) | rich detail screen (customer, ship-to, line items, totals, timeline) + refund flow (service `order_service.refund` already exists). **Leapfrogs web.** |
| **Customer detail + addresses** | `GET /v1/customers/:email`, address CRUD | detail screen (orders, addresses, LTV). **Leapfrogs web.** |
| **Inventory adjust** | `GET /v1/inventory/levels`, `POST /v1/inventory/adjust` | adjust UI (+/- with reason); low-stock view |
| **Coupons CRUD** | `/v1/coupons*` (+ `/validate`) | list/create/edit/toggle/delete |
| **Real analytics** | `/v1/analytics/dashboard`, `/orders` | (done in 4.2) wire dashboard cards |
| **Notifications settings** | `/v1/notifications` | real toggles UI |
| **Push notifications** | `device_tokens` table + `/v1/notifications` | FCM (Android) + APNs (iOS) client; register token → `device_tokens`; add a `services/queue-workers` consumer that delivers notification events to FCM/APNs. Certs/keys = `SKIP_NEEDS_HUMAN_*` + ledger; all code + config written. |

**P1 exit:** process orders incl. refunds, see real numbers, help customers, restock, run discounts, receive push on new orders.

---

## 6. P2 — BUILD & CONFIGURE A STORE FROM A PHONE

| Feature | Endpoint(s) | Build |
|---|---|---|
| **Theme switch/publish/versions** | `/v1/themes*` (editor/draft/publish/releases/rollback/preview-session) | finish UI over existing `ThemeService`; **make the WebView preview against the live storefront `/preview` the AUTHORITATIVE preview** (engine-drift safe — see MOBILE_ARCHITECTURE_V2.md Part C); keep native `preview_sections/*` as fast thumbnails only |
| **CMS Pages** | `/v1/pages*` | list/create/edit/delete + rich text |
| **Blog** | `/v1/blog/posts*`, `/blog/comments*` | posts CRUD + comment moderation |
| **Navigation/menu builder** | `/v1/pages/navigation*` | drag-orderable menu builder |
| **Media library** | `/v1/media*`, `/v1/upload`, `DELETE /v1/upload/:key` | browse/upload/delete; reuse R2 upload |
| **Shipping zones + rates** | `/v1/shipping-tax/shipping*` | zones CRUD + rate editor |
| **Taxes (GST)** | `/v1/shipping-tax/taxes*` | rate CRUD + inclusive-pricing toggle |
| **Domains lifecycle** | `/v1/stores/:id/domain`, `/domains/check`, verify | DNS records (copy-to-clipboard + "email me"), verify button, SSL status polling; `DomainService.verifyDomain` exists |
| **Collections CRUD** | `/v1/products/collections` | full CRUD (web is list+create only) |
| **Product variant matrix** | `/v1/products` | per-variant SKU/price/qty grid (web incomplete too — design mobile-first) |
| **Inventory WMS** | `/v1/inventory/{locations,suppliers,purchase-orders,transfers}` (+receive/ship) | locations, suppliers, PO receiving, transfers, **barcode scanning**. **Leapfrogs web.** |

**P2 exit:** fully build/configure a store — theme, content, shipping, taxes, domain — from a phone.

---

## 7. P3 — GROWTH & EXTENSIBILITY

| Feature | Endpoint(s) | Build |
|---|---|---|
| **Staff & RBAC** | `/v1/employees*` | invite/role/remove + **client-side role gating** (web lacks it; mobile should enforce) |
| **Billing / invoices** | `/v1/payments/subscription/history`, billing | subscription + payment method + invoice history |
| **Reviews moderation** | `/v1/reviews*` | approve/reply/delete |
| **Form submissions / leads** | `/v1/form-submissions*` | inbox + status |
| **Gift cards** | (mobile-safe contract — web uses `/v1/products/gift-cards`) | issue/list; if mobile contract missing → `SKIP-NEEDS-BACKEND` + ledger |
| **SEO surfaces** | per-product + storefront prefs | titles/meta/handle + storefront SEO |
| **App marketplace (browse)** | `/v1/app-store/apps`, `/installations` | list installed + browse; **embedded App Bridge = deep-link to web** (native iframe bridge is out of scope — ledger as DESKTOP-ONLY) |
| **AI Studio** | `/v1/ai/*` | credits/usage + generation if backend matures; else ledger |

---

## 8. P4 — PARITY POLISH & SCALE

- **Multi-store switching:** replace pervasive `getFirstStore()` with a `StoreContext` provider + store switcher (`/v1/stores` list). Audit every screen.
- **Offline read cache:** use `hive` (already in `packages/dart/core`) for last-known store/products/orders; cache-then-network; read-only offline.
- **Deep links:** adopt `go_router` (or extend Navigator) for push→order, payment-return, share links.
- **Accessibility:** WCAG 2.1 AA — touch targets, contrast (the brand purple on surfaces), screen-reader labels, focus order.
- **Full token consumption + i18n:** finish design-token migration; extend localization beyond EN/HI/TA via proper `.arb`/intl.
- **Stabilize:** flake-free CI; signed build lanes (signing = `SKIP_NEEDS_HUMAN`).

---

## 9. P5 — PLATFORM-BLOCKED (build the mobile seam, ledger the backend)

These have **no gateway route** (live only in `legacy/firebase/`): **payouts/settlement, wallet, commission engine, KYC, returns flow, 2FA, business/localization/custom-data (metafields), embedded App Bridge runtime.** For each: build the mobile screen behind a feature flag, point it at a typed client-side stub that throws `SkipNeedsBackendException(<id>)` if hit, and ledger the missing backend contract. **Do not invent the backend.** Do not delete `legacy/firebase/` (it's the only spec for these). Continue.

---

## 10. CROSS-CUTTING ENGINEERING STANDARDS (apply throughout)

- **Single backend:** all mobile traffic → BFF → gateway `/v1`. No direct Postgres/Firebase/second backend.
- **Shared contracts:** deserialize `packages/dart/models` `*Contract`; no new local model drift.
- **No secrets in the app:** only publishable keys; internal/HMAC secrets live in the BFF (placeholder if absent).
- **Provider/state:** keep `provider`/`ChangeNotifier` (do not churn to bloc/riverpod). New services follow the same pattern + DI registration.
- **Styling:** every new widget uses tokens (`LetbuyyColorTokens`, spacing/radius/shadow, Inter). No hardcoded hex.
- **Errors/empty/loading:** reuse `ui_kit` `ErrorView`/`EmptyState`/`LoadingOverlay`/`ShimmerLoading`.
- **No realtime:** poll + pull-to-refresh + optimistic UI.
- **Every feature ships with a test** (service unit + at least one widget test).
- **Governance green after every structural change.**

---

## 11. VERIFICATION GATES (must pass before declaring a phase done)

1. `flutter analyze` clean (or ledgered warnings).
2. `flutter test` green; coverage rising (target: every service has ≥1 unit test).
3. Contract tests: Dart `*Contract` deserialize gateway fixtures.
4. `flutter build apk --debug` + `flutter build ios --no-codesign` succeed.
5. `node scripts/validate-governance.mjs` green (incl. new Cloudflare validators for `services/mobile-bff`).
6. No `firebase`/`google-services` remaining under `apps/mobile/merchant-app` (except an intentional history note); no stray Supabase keys.
7. Grep audit: every `SKIP_NEEDS_HUMAN` / `SKIP-NEEDS-BACKEND` has a ledger row.

---

## 12. REPORTING DELIVERABLES (write these as you go)

- `docs/mobile-migration-blueprint/CODEX_MOBILE_FOUNDATION_LEDGER.md` — the skip ledger (§2 format), updated live.
- `docs/mobile-migration-blueprint/CODEX_MOBILE_FOUNDATION_STATUS.md` — branch + HEAD, phase-by-phase status (P0–P5), per-item DONE / DONE-WITH-SKIP / SKIPPED, with **file-path evidence** for each completed item and the exact command outputs for the verification gates.
- A final summary: counts of features moved FULLY/PARTIAL→DONE, list of every skip with unblock action, and the remaining human checklist.

---

## 13. DEFINITION OF DONE (program-level)

1. A real merchant can (against staging, or ledgered if no test creds): **login → create product → receive order → fulfill → refund → upgrade plan** from a device — through the BFF, with the gateway accepting the session.
2. Zero Firebase artifacts in the app bundle; zero stray secrets in `dart-defines`.
3. Analytics, products, orders read from the gateway only (no client-side business logic; faked analytics removed).
4. All P1–P4 feature surfaces are real screens over existing endpoints (P5 seams stubbed + ledgered).
5. Theme preview is authoritative against the live storefront engine.
6. CI runs analyze/test/build/governance on every PR; ≥1 test per core service + golden-path integration tests.
7. `services/mobile-bff` exists, is governed (validator green), and is the app's sole path to the gateway.
8. `CODEX_MOBILE_FOUNDATION_STATUS.md` + `_LEDGER.md` complete; every skip has an unblock action.
9. Regenerated `docs/mobile/README.md` + `docs/design-system/README.md` match the branch.

---

## 14. EXECUTION ORDER (proceed top to bottom; do not stop)

1. Read all nine blueprint docs + the relevant live code. Record branch/HEAD in STATUS.
2. **P0:** §4.1 native cleanup → §3 BFF Worker + app auth seam → §4.4 DI → §4.2 analytics → §4.3 models → §4.5 Razorpay → §4.7 tokens → §4.6 CI+tests → §4.8 doc regen. Run all §11 gates.
3. **P1:** §5 (orders detail/refund, customers, inventory adjust, coupons, notifications, push). Gates.
4. **P2:** §6 (theme/CMS/media/shipping/taxes/domains/collections/variants/WMS). Gates.
5. **P3:** §7. Gates.
6. **P4:** §8. Gates.
7. **P5:** §9 seams + ledger. Final gates + §12 reports + §13 DoD check.
8. Final `node scripts/validate-governance.mjs` → must be green. Write the final summary.

---

## 15. GUARDRAILS — DO NOT

- ❌ Reintroduce Firebase or any second backend; ❌ call Postgres directly from the app.
- ❌ Put internal/HMAC/secret keys in the Flutter app or commit real secret values (placeholder + ledger only).
- ❌ Fabricate gateway endpoints — if missing, stub + `SKIP-NEEDS-BACKEND` + ledger.
- ❌ Delete `legacy/firebase/` (it's the only spec for wallet/KYC/settlement/returns).
- ❌ Churn the state-management library or rewrite the working core (wizard/products/orders/editor) without cause.
- ❌ Claim "done" without the §11 evidence.
- ❌ Leave governance red.
- ❌ **Stop and wait for a human.** Defer via §2 and continue to the next item — always.

---

### One-paragraph mission recap
Bring the LetBuyy Flutter merchant app to full mobile-first parity in a single autonomous run: stand up a `services/mobile-bff` Cloudflare Worker so the gateway accepts mobile sessions, remove the dev-auth bypasses and orphaned Firebase/Supabase artifacts, replace faked analytics and legacy model projections with the real gateway contracts, wire Razorpay, and then build out every P1–P4 feature surface (orders/refunds, customers, inventory+WMS, coupons, push, theme/CMS/media/shipping/taxes/domains, staff/billing/reviews/gift-cards/SEO, multi-store/offline/deep-links/a11y) as real, token-styled, tested screens over endpoints that already exist — stubbing only the genuinely platform-blocked capabilities behind feature flags. Keep governance green, write tests and CI, log every human-gated item in the ledger, and never stop.
