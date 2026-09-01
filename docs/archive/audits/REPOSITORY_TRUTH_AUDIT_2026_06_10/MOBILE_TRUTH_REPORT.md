# MOBILE TRUTH REPORT — Repository Truth Audit 2026-06-10

Axis: mobile (merchant Flutter app, reserved mobile roots, mobile-bff, Dart token bridge, mobile release lanes).
State audited: branch `stepup/main`, HEAD `5cf9e64e` (2026-06-10), **dirty working tree** (Phases A–D13 uncommitted). All paths relative to repo root. Worktree state is the primary subject; HEAD deltas are called out explicitly.

---

## 1. Executive Summary

1. **The app's navigation graph reaches less than half of its screens.** Of 64 screen files in `apps/mobile/merchant-app/lib/screens/`, only **30 are reachable** by a user. **34 are dead** — 25 with zero inbound navigation and 9 more reachable only from dead parents. The deletion of the parity catalog (`lib/screens/parity/*`, D8) removed the only hub that ever linked most feature screens; the `/features/*` routes were remapped onto real screens (satisfying validators) but **nothing in the UI navigates to them**.
2. **The theme editor — historically the app's strongest surface — is now unreachable.** `ThemeScreen` (631 lines), `SectionEditorScreen` (1,200 lines), `ThemeVersionsScreen`, and all 12 `widgets/editor/*` files (device frames, layers drawer, website preview, section sheets) have **zero construction sites** outside themselves. The dashboard's "Customize Design — Edit sections & layout" quick action opens the read-only `LivePreviewScreen` instead (`home_screen.dart:423-426`). The bottom-nav "editor tab" (`StoreMainScreen.goToEditor()` → tab 4) now lands on `SettingsScreen` (`store_main_screen.dart:61,101`).
3. **Production mobile login is, by code analysis, still broken — now by a Turnstile token double-spend.** The app pre-verifies the (single-use) Turnstile token at the BFF (`store_auth_service.dart:379` → POST `/v1/auth/mobile/turnstile/verify`, which calls Cloudflare siteverify and consumes it, `services/mobile-bff/src/index.ts:140-151`), then submits the **same token** to identity `POST /api/auth/login`, which calls siteverify **again** (`apps/identity-platform/src/app/api/auth/login/route.ts:42`, `lib/turnstile.ts`). Cloudflare rejects re-validated tokens (`timeout-or-duplicate`), so the second check fails closed. The alternative failure mode: `services/mobile-bff/wrangler.toml:36-38` states production `TURNSTILE_SECRET_KEY` is an unprovisioned "Wave 7 human-owned SKIP-DEPLOY action," in which case the BFF returns 503 and the Dart client throws before login. Either way the prod login path fails. (Live behavior UNVERIFIED — no network access.)
4. **The old "~10 domains PlatformBlocked" issue is resolved** — `PlatformBlockedService.features` is an empty const list at both HEAD and worktree (`lib/services/platform_blocked_service.dart:26`), and `PlatformBlockedScreen` is itself dead code.
5. **D8/D9 mobile claims verified, all working-tree-only (uncommitted):** composite `/v1/mobile/dashboard` BFF endpoint (real, consumed by `home_screen` via `getMobileDashboardSnapshot`); provider-mode badges on home/money/billing/order-detail; parity catalog removed with no dangling Dart references; money-screen double-submit guard (`_runMoneyAction` + `_pendingMoneyActions`, `money_screen.dart:171-182`); Android release signing fail-closed (HEAD still has `signingConfig = signingConfigs.getByName("debug")` for release builds).
6. **Token bridge is genuinely in sync.** `node scripts/generators/generate-mobile-tokens.mjs --check` → "Mobile tokens are in sync with the DTCG source," exit 0. App-local color authorities deleted; 77 of 154 lib files consume `letbuyy_ui_kit` tokens (473 `LetbuyyColorTokens` + 101 `LetbuyySpacingTokens` refs). Residue: **190 hardcoded `Color(0x…)` literals** remain in app lib (≈63 of them inside dead editor widgets).
7. **ui_kit widget layer is dead weight; tokens are the real product.** The app uses exactly **one** of the kit's 19 exported widgets (`LoadingIndicator`, 1 call site). The kit itself ships internal duplicates (`empty_state.dart` + `empty_state_widget.dart`; `error_widget.dart` + `error_view.dart`).
8. **Tests are a real-but-mixed bag (164 cases):** 158 in one 8,023-line `mobile_services_test.dart` — solid service/widget tests against `_FakeApiClient`, but **42 assertions are source-string reads** (`readAsStringSync` + `contains(...)`), several of which "verify" the **dead** section editor and dead feature routes. 3 golden tests with real PNGs, 1 real integration happy path (login → orders → fulfill), 7 BFF node tests. No test catches the Turnstile double-spend.
9. **Release truth:** Android lane exists (untracked `.github/workflows/mobile-merchant-release.yml`), manual `workflow_dispatch` only, builds a signed AAB as a CI artifact — **no Play Store upload, no iOS lane, no store metadata/fastlane**. iOS project (with Watch app + widget extension targets) uses automatic signing with hardcoded team `67JL323LVY`.
10. **A second, never-mounted navigation system exists.** `lib/app/deep_link_router.dart` declares a GoRouter and a `resolve()` helper; the app runs classic `MaterialApp` + `onGenerateRoute`, `AppDeepLinkRouter` is referenced only by tests, AndroidManifest has no deep-link intent filters, and `PushService` performs no routing. `go_router` (pubspec `^17.0.0`) is a dependency for dead code.

---

## 2. Method

- Full file inventory via `find` (154 Dart files in `lib/`; 64 under `lib/screens/`).
- Navigation graph built from: `lib/app/routes.dart` (route registry), `lib/app/app.dart` (`MaterialApp`, `home: AuthWrapper`, `onGenerateRoute`), `lib/app/auth_wrapper.dart` (state-machine composition), `lib/screens/main/store_main_screen.dart` (5-tab `IndexedStack`), plus exhaustive greps for `pushNamed|pushReplacementNamed|pushNamedAndRemoveUntil|MaterialPageRoute|routeForId|AppRouteId.` and per-class constructor invocation counts (`grep "const X(" | grep -v routes.dart | grep -v "class X"`).
- Server-driven navigation traced into `services/api-gateway/src/routes/stores.ts` (store-health pillar `route:` strings).
- BFF read in full (`services/mobile-bff/src/index.ts`, 449 lines); session signing followed into `packages/auth-core/src/index.ts` and `services/api-gateway/src/middleware/auth.ts`; Turnstile flow followed into `apps/identity-platform/src/app/api/auth/login/route.ts` and `src/lib/turnstile.ts`.
- Token bridge verified by running the generator's read-only `--check` mode.
- HEAD-vs-worktree via `git status --porcelain`, `git diff --stat HEAD -- <file>`, `git show HEAD:<file>`.
- `flutter analyze` / `flutter test` NOT run (Flutter SDK unavailable in sandbox) — marked UNVERIFIED where relevant.

---

## 3. Screen Inventory & Classification (64 files)

Legend: **R** = reachable, **D** = dead (no user path), **D-t** = transitively dead (only inbound is a dead parent). "Real" = service-backed implementation (no stub/`Coming soon`/TODO content was found in any screen; the placeholder class of finding moved from screen content to *reachability*).

### Reachable (30)

| Screen | How reached | Class | Evidence |
|---|---|---|---|
| auth/login_screen (887L) | `AuthWrapper` composes on signed-out | Real | `auth_wrapper.dart:149` |
| auth/otp_screen | pushed from login | Real | `login_screen` pushNamed `AppRoutes.otp` |
| auth/turnstile_challenge_screen | pushed from login when no dart-define token | Real (live CF widget in WebView) | `login_screen.dart:218` |
| auth/error_screen | `AuthWrapper` error state | Real | `auth_wrapper.dart:155` |
| wizard/create_store_wizard | `AuthWrapper` (no store) + `home_screen.dart:877` | Real | `auth_wrapper.dart:151` |
| wizard/store_published_screen | wizard pushReplacement | Real | `create_store_wizard.dart:368` |
| main/store_main_screen | `AuthWrapper` main state; `AppRoutes.main` pushes | Real | `auth_wrapper.dart:153` |
| dashboard/home_screen | tab 0 | Real (composite BFF dashboard + provider badge) | `store_main_screen.dart:97` |
| orders/orders_screen | tab 1 | Real | `store_main_screen.dart:98` |
| products/products_screen | tab 2 | Real | `store_main_screen.dart:99` |
| customers/customers_screen | tab 3 | Real | `store_main_screen.dart:100` |
| settings/settings_screen | tab 4 ("More") | Real | `store_main_screen.dart:101` |
| orders/order_detail_screen | orders list + customer detail | Real (fulfill, refund, shipping labels, provider badge) | `orders_screen.dart:1456` |
| customers/customer_detail_screen | customers list | Real | `customers_screen` pushNamed |
| products/product_form_screen | products screen (direct push) | Real | `products_screen.dart:319,329` |
| products/import_products_screen | products screen | Real | `products_screen.dart:341` |
| analytics/analytics_screen | settings + home | Real (fl_chart over gateway data) | `settings_screen.dart:193`, `home_screen.dart:437` |
| settings/store_details_screen | settings, home, store-health pillar | Real | `settings_screen.dart:154` |
| store_health/store_health_screen | settings | Real (server-scored pillars) | `settings_screen.dart:164` |
| settings/domain_settings_screen | settings + store-health pillar | Real | `settings_screen.dart:171` |
| settings/seo_settings_screen | settings | Real | `settings_screen.dart:178` |
| settings/localization_markets_screen (989L) | settings | Real (9 service refs) | `settings_screen.dart:184` |
| settings/notifications_screen | home bell icon | Real | `home_screen.dart:549` |
| money/money_screen (747L) | home | Real (payouts/wallet/commission/COD tabs, double-submit guard, provider badge) | `home_screen.dart:668` |
| preview/live_preview_screen | home quick action ("Customize Design") | Real (WebView) | `home_screen.dart:423-426` |
| subscription/pricing_screen | settings, hero card, upgrade(dead) | Real | `settings_screen.dart:260`, `hero_store_card.dart:659` |
| subscription/connect_razorpay_screen | settings (professional plan) | Real | `settings_screen.dart:271` |
| subscription/razorpay_checkout_screen | pricing (also dead billing) | Real | `pricing_screen.dart:262` |
| settings/help_screen | settings (×2 tiles) | Static support content (0 service refs — acceptable) | `settings_screen.dart:287,293` |
| marketing/reviews_screen | **server-driven only**: store-health pillar emits `/reviews` | Real | `store_health_screen.dart:224-229` + `services/api-gateway/src/routes/stores.ts:321,330` |

### Dead — zero inbound navigation (25)

All confirmed: constructor appears only in own file declaration and (where noted) `routes.dart`; route path never pushed; not composed anywhere.

| Screen | Routed? | Notes |
|---|---|---|
| splash/splash_screen (209L) | `/splash` (`routes.dart:249`) | Never pushed; `AuthWrapper` (mounted as `home:`) renders its own loader. Splash itself pushes `/` — one-way street. |
| customize/theme_screen (631L) | **not routed** | The theme editor. Only caller of `StoreMainScreen.navigateToEditor()` (`theme_screen.dart:214`), which lands on Settings anyway. |
| editor/section_editor_screen (1,200L) | **not routed** | Section/layout editor incl. AI homepage generation. Sole importer of all 12 `widgets/editor/*` files. |
| platform/platform_blocked_screen (52L) | not routed | Blocked-feature interstitial; `PlatformBlockedService.features = []` (`platform_blocked_service.dart:26`) so nothing could ever route here. |
| premium/upgrade_screen (309L) | `/upgrade` (`routes.dart:314`) | Static plan cards; itself pushes `/pricing` — duplicate of pricing feature. |
| inventory/inventory_screen | `/inventory` + `/features/inventory` | Inventory home; never pushed from any UI. |
| discounts/coupons_screen | `/coupons` + feature route | Never pushed. |
| discounts/gift_cards_screen | `/gift-cards` + feature route | Never pushed. |
| content/pages_screen | `/pages` + feature route | Never pushed. |
| content/blog_screen | `/blog` + feature route | Never pushed. |
| content/navigation_screen | `/navigation` + feature route | Never pushed. |
| content/media_library_screen | `/media` + feature route | Never pushed. |
| settings/staff_screen | `/staff` + `/features/users` | Never pushed. |
| settings/billing_screen | `/billing` + feature route | Never pushed (its provider badge + Razorpay checkout push are unreachable via it). |
| marketing/leads_screen | `/leads` + `/features/form-submissions` | Never pushed. |
| marketing/email_campaigns_screen (539L) | `/email-campaigns` + feature route | Never pushed. |
| apps/apps_screen | `/apps` + `/features/app-marketplace` | App marketplace; never pushed. |
| ai/ai_screen (593L) | `/ai` + feature route | Never pushed; the AI FAB opens `ai_operator_sheet` (a bottom sheet) instead. |
| settings/shipping_screen | `/shipping` + feature route | Never pushed. |
| settings/taxes_screen | `/taxes` + feature route | Never pushed. |
| settings/custom_data_screen (724L) | `/custom-data` + feature route | Never pushed. |
| kyc/kyc_screen (571L) | `/kyc` + feature route | Never pushed — KYC is invisible on mobile. |
| security/two_factor_screen (404L) | `/two-factor` + feature route | Never pushed — 2FA management invisible. |
| orders/returns_screen | `/returns` + feature route | Never pushed — RMA invisible. |
| products/collections_screen | `/collections` + feature route | Never pushed. |

### Transitively dead — only inbound is a dead parent (9)

| Screen | Sole parent | Evidence |
|---|---|---|
| customize/theme_versions_screen | theme_screen (dead) | `theme_screen.dart:203` |
| inventory/locations_screen | inventory_screen | `inventory_screen.dart:220` |
| inventory/suppliers_screen | inventory_screen | `inventory_screen.dart:225` |
| inventory/purchase_orders_screen | inventory_screen | `inventory_screen.dart:230` |
| inventory/transfers_screen | inventory_screen | `inventory_screen.dart:235` |
| discounts/coupon_form_screen | coupons_screen | `coupons_screen.dart:433` |
| content/page_editor_screen | pages_screen | `pages_screen.dart:76` |
| content/post_editor_screen | blog_screen | `blog_screen.dart:104` |
| apps/app_bridge_runtime_screen | apps_screen | `apps_screen.dart:603` |

**Dead widgets (15 files):** all 12 `widgets/editor/*` (sole importer = dead `section_editor_screen.dart`); `widgets/home/activity_timeline.dart` and `widgets/home/quick_actions_grid.dart` (only `widgets/home/stats_row.dart` is imported, by `analytics_screen.dart:9`); `widgets/shared/empty_state.dart` (0 importers).

**Duplicates:**
- `QuickActionsGrid` — two different classes with the same name: `widgets/home/quick_actions_grid.dart` (dead) vs `widgets/dashboard/quick_actions_grid.dart` (used by home).
- `ActivityTimeline` — same pattern (`widgets/home/` dead vs `widgets/dashboard/` used).
- Empty state: app `widgets/shared/empty_state.dart` (dead) vs ui_kit `empty_state.dart` vs ui_kit `empty_state_widget.dart` (kit-internal duplicate). Kit also duplicates `error_widget.dart`/`error_view.dart`.
- Plan upsell: `upgrade_screen` (dead) duplicates `pricing_screen`.
- Theme editing implemented twice (`theme_screen` AND `section_editor_screen`) — both dead.
- Loading overlay: app `widgets/shared/loading_overlay.dart` (used) vs ui_kit `loading_overlay.dart` (exported, unused by app).
- Dashboard data fetched two ways: `AnalyticsService.getStoreAnalytics` (5 sequential gateway calls, analytics screen) vs `getMobileDashboardSnapshot` (1 composite BFF call, home) — intentional split, but two contracts to keep aligned by hand (`analytics_service.dart:371-498`).

No content-level placeholder screens found: grep for `Coming soon|TODO|FIXME|not implemented|Placeholder()` across `lib/screens/` returned zero relevant hits; every reachable screen ≥190 lines and service-backed (e.g., kyc 5, two_factor 4, ai 6, custom_data 5 `context.read<...Service>` refs) — including the dead ones, which makes the unreachability more wasteful, not less.

---

## 4. Navigation Graph Truth

- **Architecture:** classic `Navigator` — `MaterialApp(home: AuthWrapper, onGenerateRoute: AppRoutes.generateRoute)` (`app.dart:54-56`). State machine in `AuthWrapper` (loading → login/wizard/main/error). Main shell = 5-tab `IndexedStack` (Home/Orders/Products/Customers/More).
- **Route registry:** `routes.dart` defines 51 primary + 36 `/features/*` specs = **87 routes**. A typed `AppRouteId` enum + `routeForId()` API exists but is **used by zero callers** outside `routes.dart`.
- **Push census:** 53 navigation sites total (32 `pushNamed`, 9 `push`, 9 `pushReplacementNamed`, 2 `pushNamedAndRemoveUntil`, 1 `of(context).push`), concentrated in `settings_screen` (13), `home_screen` (8), `login_screen` (5).
- **All 36 `/features/*` routes have zero inbound navigation.** They exist to satisfy `scripts/validators/provider-mode-badge-validator.mjs:44-45` (asserts routes don't reference the parity catalog) and source-string tests (e.g., `mobile_services_test.dart:2065` "Money feature routes replace platform-blocked seams"). Governance validates the route *table*; nothing validates *reachability*.
- **Mapping lies inside the feature routes:** `/features/order-detail` → `OrdersScreen` (a list, not a detail; `routes.dart:557-560`); `/features/embedded-app-bridge` → `AppsScreen` rather than `AppBridgeRuntimeScreen` (`routes.dart:662-666`).
- **Editor drift:** `StoreMainScreen.navigateToEditor()` → `switchToTab(4)` = Settings (`store_main_screen.dart:25-27,61`); comment still says "editor tab". Sole caller is the dead `theme_screen.dart:214`.
- **Server-driven navigation:** `store_health_screen.dart:224-229` pushes route strings received from the gateway (`stores.ts:255-330` emits `/store-details`, `/products`, `/orders`, `/domain-settings`, `/reviews`). This is the *only* path to ReviewsScreen — if the backend ever emits a route not in the app's table, the user gets the "Route not found" scaffold (`routes.dart:771-774`).
- **Deep links are dead:** `AppDeepLinkRouter` (GoRouter, `/orders/:orderId`, `/payment-return`, `/share/:storeId`) is never mounted (app uses `MaterialApp`, not `.router`); `resolve()` has no production caller; AndroidManifest has no `scheme`/`host` intent filters; `PushService` does no route handling. `go_router ^17.0.0` is a dependency feeding only `deep_link_router.dart` + tests (`mobile_services_test.dart:3791-3797`).
- **Web-parity drift:** merchant-control-plane (web) ships coupons/inventory/staff/billing/blog/KYC/2FA/returns/etc. surfaces with live nav; mobile *implements* the same screens but exposes no entry points — the route table pretends parity that the navigation graph does not deliver.

---

## 5. State & Contract Truth

**State management:** `provider` (`MultiProvider` with ~35 providers, `main.dart:155-272`); `ChangeNotifier` services + `setState` in screens. No riverpod/bloc. Single `ApiClient` instance injected everywhere; `StoreContext` (SharedPreferences-persisted selected store) is the single tenant-selection authority; session tokens live in `flutter_secure_storage` (`store_auth_service.dart:109-113,477-491`); `CacheService` (Hive box `letbuyy_mobile_cache_v1`) backs offline product/order/customer caches. Models are **not** duplicated: `lib/models/*.dart` are 1–10-line re-exports of `package:letbuyy_models/merchant_contracts.dart`.

**BFF endpoint census (`services/mobile-bff/src/index.ts`, 449 lines):**

| Endpoint | Behavior |
|---|---|
| GET `/health`, `/v1/health` | health/degraded based on `INTERNAL_API_SECRET` + Turnstile secret configuration (`index.ts:85-99,419-420`) |
| GET `/v1/mobile/dashboard` | **composite**: requires session, fans into 6 gateway GETs (`/v1/analytics/dashboard|orders|revenue|top-products|traffic-sources`, `/v1/payouts/summary`) via `Promise.all`, returns merged payload + `provider_mode` + `partial_errors`, HTTP 207 on partial failure, 502 on total failure (`index.ts:296-378`) |
| POST `/v1/auth/mobile/turnstile/verify` | Cloudflare siteverify; **fail-closed**: missing/placeholder secret → 503 `TURNSTILE_NOT_CONFIGURED`; invalid → 403 (`index.ts:118-157,422-445`) |
| ALL `/v1/*` and `*` | proxy to api-gateway service binding behind a **44-prefix allowlist** (`index.ts:25-70`); non-allowlisted → 404 `MOBILE_BFF_ROUTE_NOT_ALLOWED` |

**Session mechanics:** token extracted Bearer → `X-LetBuyy-Session-Token` → `lb_session` cookie (`index.ts:170-181`); BFF strips `Authorization`/`Cookie`, signs `X-LetBuyy-Internal-{Session-Token,Timestamp,JTI,Signature}` via HMAC-SHA256 with `INTERNAL_API_SECRET` (`packages/auth-core/src/index.ts:602-644`); gateway verifies in `services/api-gateway/src/middleware/auth.ts:83-123`. Shared-secret forgery surface (one secret on both sides) persists, consistent with prior foundation findings.

**Auth flow end-to-end (code):** app → GET identity `/login` (CSRF cookie) → resolve Turnstile token (dart-define for dev, else in-app WebView challenge with real site key; prod dart-defines ship `TURNSTILE_TOKEN=SKIP_NEEDS_HUMAN_…` + real `TURNSTILE_SITE_KEY=0x4AAAAAADhK0-QvgZvxNyZE`, `dart-defines/production.json`) → **BFF pre-verify (consumes token)** → POST identity `/api/auth/login` (same token, **re-verified — fails as duplicate**) → on success extract `lb_session` from Set-Cookie → store in secure storage → revalidate via GET `/api/auth/session` (no refresh token; "refresh" = revalidation, `store_auth_service.dart:339-362`) → all data calls go to `bff.letbuyy.com/v1` with the token. Identity dev bypass (`dev-bypass-token`) is hard-gated to non-production (`dev-auth-bypass.ts:20-24`).

**App↔BFF↔gateway contract:** the app uses 37 typed namespaces of the shared `packages/dart/api_client` (3,174-line client); every namespace the merchant app actually calls maps into an allowlisted prefix, and all 44 allowlisted prefixes have gateway routers (spot-checked incl. oddities `portfolio.ts`, `resume.ts`, `employee.ts` — legacy non-commerce routes allowlisted for mobile). The client's ~20 `/storefront/*` endpoints (`api_client.dart:1754-1928`) are **not** BFF-allowlisted, but the merchant app never calls `.storefront.` — latent break reserved for the (unbuilt) shopper app.

**Reserved roots confirmed manifest-only:** `apps/mobile/shopper-app` and `apps/mobile/operator-app` each contain exactly `AGENTS.md` + `runtime.manifest.json` ("Reserved/not-implemented", `runtimeCategory: reserved-mobile-app`). No Flutter source.

---

## 6. Theme / Token Truth

- Generated bridge: `packages/dart/ui_kit/lib/src/tokens/letbuyy_tokens.dart` carries `// GENERATED FILE - DO NOT EDIT. Source: packages/typescript/ui/tokens.json`; `node scripts/generators/generate-mobile-tokens.mjs --check` exits 0 ("in sync with the DTCG source"). D9 verified.
- App-local authorities deleted in worktree: `lib/theme/{dark_theme_colors,letbuyy_color_tokens,light_theme_colors,store_admin_colors}.dart` (git `D`); HEAD's `letbuyy_color_tokens.dart` was generated from the now-deleted `packages/typescript/ui/src/mobile-tokens.ts`. Remaining `lib/theme/app_theme_colors.dart` is a brightness-aware facade over kit tokens; `store_theme.dart` builds `ThemeData`.
- Adoption: 77/154 lib files import `letbuyy_ui_kit`; 473 `LetbuyyColorTokens` + 101 `LetbuyySpacingTokens` references.
- Residue: **190 `Color(0x…)` literals** in app lib. Top: `widgets/editor/device_frames/laptop_frame.dart` 21, `login_screen.dart` 18, `hero_store_card.dart` 17, `compact_settings_sheet.dart` 16 (≈63 sit in dead editor widgets). `settings_screen.dart` also hardcodes status colors (`0xFF2563EB`, `0xFF10B981`, `0xFFEF4444`, `0xFFF59E0B`).
- ui_kit widget layer effectively unused by the app (1 `LoadingIndicator(` call site vs 19 exported widgets), with kit-internal duplicates noted in §3.
- `packages/dart/services` (old `letbuyy_services` package) deleted in worktree; zero remaining references — clean removal.

## 7. Release Lane Truth

- **Android fail-closed signing (worktree, uncommitted)** — `apps/mobile/merchant-app/android/app/build.gradle.kts:81-89`:
  ```kotlin
  gradle.taskGraph.whenReady {
      if (allTasks.any { it.name.contains("Release", ignoreCase = true) } && !releaseSigningReady) {
          throw GradleException("Release signing requires LETBUYY_ANDROID_KEYSTORE_PATH, ...")
      }
  }
  ```
  Secrets pulled from `key.properties`/gradle props/env, placeholder-rejecting (`signingValue` filters `SKIP_NEEDS_HUMAN_`, lines 17-24). **At HEAD the release buildType used `signingConfigs.getByName("debug")`** (`git show HEAD:...build.gradle.kts:36`) — the fail-closed lane is a 52-line uncommitted diff.
- **CI lane:** `.github/workflows/mobile-merchant-release.yml` (untracked): `workflow_dispatch` only; restores keystore from `LETBUYY_ANDROID_KEYSTORE_BASE64`; runs `flutter analyze` + `flutter test`; `flutter build appbundle --release --dart-define-from-file=dart-defines/production.json`; uploads AAB artifact. **No Play upload step, no version bump automation, no iOS job.**
- **iOS:** project present with `Runner`, `LetBuyyMerchantWatch` (watchOS app) and `LetBuyyMerchantWidget` (home-screen widget) targets; `CODE_SIGN_STYLE = Automatic`, `DEVELOPMENT_TEAM = 67JL323LVY` hardcoded in pbxproj; no CI lane, no fastlane, no store metadata anywhere in the app dir.
- Note: regular `ci.yml`/`deploy-staging.yml` deploy the **BFF** worker (staging routes `bff-staging.letbuyy.com`); production BFF deploy exists in `production-deploy.yml:347-357` incl. secret provisioning steps. Whether secrets were actually provisioned is UNVERIFIED (and `wrangler.toml` comments say Turnstile prod key is deliberately not yet provisioned).

## 8. Test Truth

| File | Cases | Nature |
|---|---|---|
| `test/mobile_services_test.dart` (8,023L) | 158 | Mixed: behavioral service tests against `_FakeApiClient extends ApiClient` (asserting request paths/payloads — e.g., OrderService refund lifecycle, InventoryService PO flows); 51 `testWidgets` (incl. StoreMainScreen tab pumping with gateway fakes); **42 `readAsStringSync` source-string assertions** — e.g., lines 947-1008 assert the **dead** `section_editor_screen.dart` contains `'_showAiHomepageSheet'`/viewport strings; 1235 asserts taxes *route table* strings; 1251-1259 assert parity files do not exist; 3791-3797 test the never-mounted deep-link resolver |
| `test/merchant_goldens_test.dart` | 3 | Real golden tests (order detail fulfillment, customers CRM, store health) with checked-in PNGs in `test/goldens/` (33-62 KB each) |
| `test/analytics_model_test.dart` | 1 | model parsing |
| `test/product_contract_test.dart` | 1 | contract shape |
| `integration_test/merchant_happy_path_test.dart` (464L) | 1 | Substantive: fake transport drives login (CSRF + `turnstileToken` asserted) → store load → orders → fulfill → asserts `/orders/order_1/fulfill` hit and no `SKIP_NEEDS_HUMAN` leakage |
| `services/mobile-bff/test/session-token.test.ts` | 7 | token extraction precedence, allowlist, composite fan-in, Turnstile fail-closed + siteverify mapping |

Verdict: **not generated filler** — assertions are specific and load-bearing — but ~27% of the monolith is source-string governance (brittle, and actively "protecting" dead code), and the suite cannot catch the cross-service Turnstile double-spend because each side is tested in isolation. `flutter test` execution: UNVERIFIED (no SDK in sandbox); ledger D8-VERIFY claims it passed.

## 9. Root-level Flutter Residue

- Root `pubspec.yaml` is the **Dart pub workspace + Melos 7 config** (legitimate): workspace = merchant-app + 4 `packages/dart/*`. Defects: melos script `run:super_admin` does `cd apps/mobile/operator-app && flutter run` — **a manifest-only root with no Flutter source**; `build:web` filter (`web/index.html`) matches nothing.
- Local residue at repo root: `build/` (**161 MB**, `native_assets`/`test_cache`/`unit_test_assets`) and `.dart_tool/` (96 KB) — both gitignored (`.gitignore:130,25`), so machine-local only, but a 161 MB test-cache at the monorepo root will confuse non-Flutter tooling and should be cleaned.
- `apps/mobile/merchant-app/AGENTS.md:42` still cites the deleted parity file (`lib/screens/parity/merchant_feature_definitions.dart`) as "payment provider reference" — stale generated doc.

## 10. HEAD vs Worktree (mobile axis)

| Item | HEAD `5cf9e64e` | Worktree (uncommitted) |
|---|---|---|
| `routes.dart` | imports parity catalog; unknown routes fell back to `MerchantFeatureScreen` (`HEAD routes.dart:764-776`) | parity gone; 36 `/features/*` remapped to real screens (none navigable) |
| `lib/screens/parity/*` (2 files) | present | **deleted** |
| Android release signing | `signingConfig = getByName("debug")` | fail-closed GradleException lane |
| `mobile-merchant-release.yml` | absent | **untracked** new workflow |
| `provider_mode_badge.dart` | absent | **untracked** new widget (4 consumers) |
| Theme authorities | 4 app-local token/color files (generated from `mobile-tokens.ts`) | deleted; ui_kit DTCG bridge (+159-line tokens diff, +521-line generator rewrite) |
| `PlatformBlockedService.features` | already `[]` | unchanged (blocked-seams fix was committed earlier, P5) |
| BFF `index.ts`, session test, `packages/dart/*` | older | modified (composite endpoint, provider-mode fan-in) |

Nothing in the D8/D9 mobile hardening is committed; a repo clone at HEAD ships debug-signed releases and the parity catalog.

## 11. Unknowns / UNVERIFIED

- **Live behavior** of login on prod/staging (Turnstile double-spend inference is code-derived; if Cloudflare keys were test "always-pass" keys, duplicates would succeed — site keys in dart-defines are real `0x4…` keys, not test keys).
- Whether `INTERNAL_API_SECRET` / `TURNSTILE_SECRET_KEY` are actually provisioned on deployed workers (wrangler comments say Turnstile prod is deliberately unprovisioned).
- `flutter analyze` / `flutter test` results (no Flutter SDK in sandbox).
- iOS build viability (watch/widget targets, automatic signing) — never exercised by CI.
- Golden PNGs freshness vs current widget code (would need `flutter test --update-goldens` diff).
- Whether any external system (support tooling, QR codes) targets the dead `/features/*` or deep-link paths — none found in-repo.
