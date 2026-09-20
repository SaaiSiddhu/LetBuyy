# CODEX MOBILE PARITY LEDGER - started 2026-06-04T05:16:22Z

## CURRENT STATUS
- Stage: STAGE 5 - WS8 Mobile Parity.
- Active gate: DONE. M0-M8 completed with backend/human skips recorded; post-commit governance after `8850b89d` passed 128/128.
- Scope lock: mobile source work is limited to `apps/mobile/merchant-app/**` and `packages/dart/**` unless the active mission explicitly allows a supporting config/documentation file. Web apps, backend services, database, package-core contracts, shared TypeScript packages, and governance validators remain out of scope for WS8 source changes.

## M0 BASELINE PROOF
- `flutter --version` -> PASS after sandbox escalation: Flutter 3.41.2, Dart 3.11.0.
- `flutter pub get` in `apps/mobile/merchant-app` -> PASS.
- `flutter analyze` in `apps/mobile/merchant-app` -> PASS, `No issues found!`.
- `flutter test` in `apps/mobile/merchant-app` -> PASS, placeholder widget test only.
- `flutter build apk --debug` in `apps/mobile/merchant-app` -> PASS, built `build/app/outputs/flutter-apk/app-debug.apk`.
- `pod install --verbose --no-repo-update` in `apps/mobile/merchant-app/ios` -> PASS after the first Flutter iOS build spent several minutes inside CocoaPods. CocoaPods warning: project custom base configurations mean CocoaPods did not set the Runner target base configuration automatically.
- `flutter build ios --no-codesign --debug` in `apps/mobile/merchant-app` -> PASS after CocoaPods completed, built `build/ios/iphoneos/Runner.app`.
- iOS project maintenance from Flutter/CocoaPods baseline: tracked `ios/Podfile.lock` now includes the declared `app_links` plugin; Flutter updated the tracked iOS runner plist/delegate files for the current toolchain no-codesign build path.

## M0 LEGACY INVENTORY
- Firebase/Firestore/Firebase plugin references are present in 102 files under `apps/mobile/merchant-app` and `packages/dart` before migration.
- Supabase references are present in 17 files under `apps/mobile/merchant-app` and `packages/dart` before migration, including legacy hardcoded project reference `rvzgkynwhbiksffusqnb` in `packages/dart/core/lib/src/config/supabase_config.dart`.
- The merchant app still contains 20 marketing landing files under `apps/mobile/merchant-app/lib/screens/landing/**`; audit classifies this as legacy marketing surface that should be removed after live imports are migrated.
- `packages/dart/services/lib/src` contains 50 service/provider source files, including shopper/customer-oriented services, Firebase-backed providers, analytics/storage/update services, and direct database abstractions that must be migrated behind the governed `/v1` gateway client in later WS8 tasks.
- Existing pre-WS8 user-owned dirty mobile edits remain in place across auth, dashboard, landing, products, wizard, theme, editor, and `packages/dart/ui_kit` files. They were not reverted or staged by M0 unless explicitly listed in the commit.

## M0 ENVIRONMENT CONTRACTS
- Added `apps/mobile/merchant-app/dart-defines/local.json` for local real-stack smoke runs.
- Added `apps/mobile/merchant-app/dart-defines/staging.json` with human-gated staging placeholders.
- Added `apps/mobile/merchant-app/dart-defines/production.json` with human-gated production placeholders.
- Added `apps/mobile/merchant-app/dart-defines/README.md` documenting `flutter run`, Android debug build, and iOS no-codesign build usage with `--dart-define-from-file`.

## M1 API CLIENT PACKAGE
- Status: DONE / PRE-GOVERNANCE PROOF COMPLETE.
- Source changes:
  - Added `packages/dart/api_client` with local `AGENTS.md`, `pubspec.yaml`, analysis options, public `letbuyy_api_client.dart` export, typed request/response primitives, `ApiClient`, auth header interceptor, request-id/store/idempotency headers, retryable request loop, gateway error mapping, pagination helpers, upload helper, and resource groups for stores, auth, products, orders, customers, themes, payments, storefront, analytics, categories, inventory, pages, and coupons.
  - Added package tests for auth/header injection, `/v1` URL normalization, pagination unwrapping, gateway failure mapping, and retryable read responses.
  - Added a gated local gateway test that calls `http://127.0.0.1:8787/v1/storefront/urban-kicks-demo/products?limit=5` through `ApiClient.storefront.listProducts`.
  - Registered `packages/dart/api_client` in the root Dart workspace and added `letbuyy_api_client` to `apps/mobile/merchant-app/pubspec.yaml`.
  - Replaced the app-local HTTP implementation in `apps/mobile/merchant-app/lib/services/api_client.dart` with a compatibility export of the shared package.
  - Updated `apps/mobile/merchant-app/lib/main.dart` to instantiate the shared API client from `AppConfig.apiBaseUrl`, inject the Supabase access-token provider, set the `X-Client` header, generate request ids, and provide it through `Provider<ApiClient>`.
- Scoped proof:
  - `flutter pub get` at repository root -> PASS; `pubspec.lock` updated for the new package/test dependency graph.
  - Escalated `dart format packages/dart/api_client apps/mobile/merchant-app/lib/main.dart apps/mobile/merchant-app/lib/services/api_client.dart` -> PASS after sandbox run formatted files but exited nonzero only on Dart telemetry file permissions.
  - Escalated `flutter test` in `packages/dart/api_client` -> PASS: 3 unit tests passed and 1 local-gateway test skipped without `LETBUYY_API_CLIENT_E2E=1`.
  - Escalated `flutter analyze` in `packages/dart/api_client` -> PASS with no issues.
  - Escalated `flutter analyze` in `apps/mobile/merchant-app` -> PASS with no issues.
  - `pnpm run federation:local:up` attempt 1 failed only because API gateway health did not respond after generated-artifact cleanup had removed JS workspace links; `pnpm run federation:local:down` -> PASS cleanup. Escalated `pnpm install --frozen-lockfile --force` restored links with lockfile unchanged.
  - Escalated `pnpm run federation:local:up` attempt 2 -> PASS; seeded product query ready with HTTP 200 at `/v1/storefront/urban-kicks-demo/products?limit=1`.
  - Escalated `LETBUYY_API_CLIENT_E2E=1 LETBUYY_API_BASE_URL=http://127.0.0.1:8787/v1 LETBUYY_API_CLIENT_SUBDOMAIN=urban-kicks-demo flutter test test/local_gateway_test.dart` in `packages/dart/api_client` -> PASS; real local product list returned at least one product with an id.
  - Escalated `flutter test` in `apps/mobile/merchant-app` -> PASS, placeholder app test.
  - Escalated `flutter build apk --debug --dart-define-from-file=dart-defines/local.json` in `apps/mobile/merchant-app` -> PASS, built `build/app/outputs/flutter-apk/app-debug.apk`.
  - Escalated `flutter build ios --no-codesign --debug --dart-define-from-file=dart-defines/local.json` in `apps/mobile/merchant-app` -> PASS, built `build/ios/iphoneos/Runner.app`.
  - Escalated `pnpm run federation:local:down` -> PASS after the real gateway proof.

## M2 IDENTITY / SESSION MIGRATION
- Status: DONE / COMMITTED / POST-COMMIT GOVERNANCE PASSED WITH BACKEND SKIP.
- Source changes:
  - Added `IDENTITY_BASE_URL` to merchant app dart-define contracts and `AppConfig`.
  - Added `flutter_secure_storage` to the merchant app and removed its direct `supabase_flutter` dependency.
  - Replaced merchant app Supabase Auth wiring with `StoreAuthService`, a LetBuyy identity-session service that fetches CSRF from the identity platform, calls identity login/signup/OTP/set-password routes, extracts `lb_session` from `Set-Cookie`, persists it in secure storage, validates it through the identity platform `/api/auth/session` route, emits local auth events, and signs out through the identity logout route.
  - Updated `main.dart` so the shared `ApiClient` token provider reads the stored `lb_session` and attaches session transport headers/cookie on every gateway request when enabled.
  - Removed Google OAuth UI/handler paths from the merchant login screen and removed Supabase auth-event imports from the app auth wrapper.
  - Added API-client `attachSessionCookie` support and a regression test proving `Authorization`, `X-LetBuyy-Session-Token`, and `Cookie: lb_session=...` are attached.
  - Replaced legacy `packages/dart/services` Firebase Auth / Google Sign-In service behavior with explicit identity-platform handoff stubs and local session compatibility, removed `firebase_auth` and `google_sign_in` from `packages/dart/services/pubspec.yaml`, removed lockfile entries, and removed direct `FirebaseAuth` imports from dependent services/providers.
- Scoped proof:
  - `flutter pub get` at repository root -> PASS; `flutter_secure_storage` added and `firebase_auth` / `google_sign_in` removed from `pubspec.lock`.
  - Escalated `dart format` over touched app/API/services Dart files -> PASS after sandbox run formatted files but exited nonzero only on Dart telemetry file permissions.
  - `rg -n "FirebaseAuth|firebase_auth|google_sign_in|GoogleSignIn|GoogleAuthProvider|signInWithCredential|signInWithCustomToken|customToken|OAuthProvider|signInWithOAuth|signInWithGoogle|signInWithApple|signInWithFacebook" apps/mobile/merchant-app/lib packages/dart/services packages/dart/api_client -S` -> PASS, no matches.
  - `rg -n "supabase_flutter" apps/mobile/merchant-app/pubspec.yaml apps/mobile/merchant-app/lib -S` -> PASS, no matches.
  - `rg -n "firebase_auth|google_sign_in" packages/dart/services/pubspec.yaml apps/mobile/merchant-app/pubspec.yaml pubspec.yaml -S` -> PASS, no matches.
  - `flutter analyze` in `packages/dart/api_client` -> PASS with no issues.
  - `flutter analyze` in `packages/dart/services` -> PASS with no issues.
  - `flutter analyze` in `apps/mobile/merchant-app` -> PASS with no issues.
  - Escalated `flutter test` in `packages/dart/api_client` -> PASS: 4 unit tests passed and 1 local-gateway test skipped without `LETBUYY_API_CLIENT_E2E=1`.
  - Escalated `flutter test` in `apps/mobile/merchant-app` -> PASS, placeholder app test.
  - Escalated `flutter build apk --debug --dart-define-from-file=dart-defines/local.json` in `apps/mobile/merchant-app` -> PASS, built `build/app/outputs/flutter-apk/app-debug.apk`.
  - Escalated `flutter build ios --no-codesign --debug --dart-define-from-file=dart-defines/local.json` in `apps/mobile/merchant-app` -> PASS, built `build/ios/iphoneos/Runner.app`.

## M3 CONTRACT CONFORMANCE
- Status: DONE / COMMITTED / POST-COMMIT GOVERNANCE PASSED.
- Source changes:
  - Added `packages/dart/models/lib/shared_contracts.dart` and `packages/dart/models/lib/src/shared_contracts.dart` as the canonical pure-Dart mirror of `packages/shared-types/src/index.ts` for Address, CustomerAddress, ProductOption, ProductVariant, Product, CollectionRule, Collection, Customer, CartLine, Cart, LineItem, Order, Payment, Coupon, Page, ThemeSettingField, ThemeSettings, ThemeBlock, ThemeSection, ThemeTemplate, ThemeBundle, and Theme.
  - Exported the canonical contract layer from both `letbuyy_models.dart` and `merchant_contracts.dart` without removing legacy model exports; M4/M5 will migrate/delete the Firestore-era models safely.
  - Added `packages/dart/models/test/shared_contracts_conformance_test.dart`, which reads the TypeScript `shared-types` file, extracts Zod/interface top-level fields, compares them with Dart field manifests, and verifies representative gateway JSON round-trips for product, order, and theme bundle data.
- Scoped proof:
  - Escalated `dart format` over the touched model/test files -> PASS after sandbox formatter completed changes but exited nonzero only on Dart telemetry file permissions.
  - Escalated `flutter analyze` in `packages/dart/models` -> PASS with no issues.
  - Escalated `flutter test` in `packages/dart/models` -> PASS: 2 conformance tests passed.
  - Escalated `flutter analyze` in `packages/dart/services` -> PASS with no issues.
  - Escalated `flutter analyze` in `apps/mobile/merchant-app` -> PASS with no issues.

## M4 EXISTING SCREEN API / MODEL REWIRING
- Status: DONE / COMMITTED / POST-COMMIT GOVERNANCE PASSED WITH BACKEND/HUMAN SKIPS.
- Source changes:
  - Extended canonical Dart shared contracts with screen-needed Product, LineItem, and Order getters while preserving gateway JSON shape.
  - Rewired `ProductService`, `OrderService`, `StoreService`, `AnalyticsService`, and `SubscriptionService` onto shared `ApiClient` resource methods and canonical `ProductContract` / `OrderContract` parsing where applicable.
  - Migrated the orders screen to `OrderContract` instead of the legacy merchant-only `OrderModel` / enum, including status, date, customer, total, and item-count helpers.
  - Removed fabricated dashboard revenue/trend/chart data and analytics mock top products/traffic sources; dashboard and analytics now use gateway-derived `StoreAnalytics` where available and render backend-needed placeholders otherwise.
  - Added a Dart design-token mirror in `packages/dart/ui_kit` for web token color, typography, spacing, radius, shadow, and density values; exported it and applied token colors to the merchant app theme shell.
  - Narrowed store details and SEO saves to gateway-supported fields, and replaced hardcoded domain DNS records with a backend-needed domain verification placeholder.
  - Moved subscription service calls from legacy `/stores/:id/subscription` paths to the gateway `/payments/subscription*` contracts; live paid activation still requires provider payloads and approved pricing.
- Scoped proof:
  - `HOME=/private/tmp DART_SUPPRESS_ANALYTICS=true dart format ...` over touched Dart files -> PASS.
  - Escalated `flutter analyze` in `packages/dart/models` -> PASS with no issues.
  - Escalated `flutter analyze` in `packages/dart/ui_kit` -> PASS with no issues.
  - Escalated `flutter analyze` in `apps/mobile/merchant-app` -> PASS with no issues.
  - Escalated `flutter test` in `packages/dart/models` -> PASS: 2 conformance tests passed.
  - Escalated `flutter test` in `apps/mobile/merchant-app` -> PASS: placeholder widget test passed.
  - `rg "Supabase|supabase|FirebaseFirestore|cloud_firestore|Firestore|FirebaseFunctions|FirebaseStorage" ...M4 target screens/services...` -> PASS with no direct runtime usage matches; only historical service comments remain.
  - `rg "1250|\+8%|\+14%|\+23%|\+2\.1%|₹5\.2K|₹1\.5K|Product A|Product B|Product C|cname\.vercel-dns\.com" ...` -> PASS with no matches in the touched dashboard, analytics, revenue chart, or domain settings files.

## M5 LEGACY DELETION
- Status: DONE / COMMITTED / POST-COMMIT GOVERNANCE PASSED WITH HUMAN ANDROID-EMULATOR SKIP.
- Source changes:
  - Removed merchant app Firebase initialization and generated options, replaced the legacy Supabase app config with a provider-neutral `AppConfig`, and removed the app-local `supabase_config.dart` file.
  - Removed routed legacy marketing/download surfaces from the active merchant app route table. Deleted `apps/mobile/merchant-app/lib/screens/download/download_screen.dart`; archived the modified landing tree from `apps/mobile/merchant-app/lib/screens/landing/**` to `docs/archive/flutter-legacy/merchant-app-landing/**` instead of force-deleting user-owned local edits.
  - Removed the app dependency on `letbuyy_services`, removed the unused native `razorpay_flutter` plugin, and pruned Firebase/Messaging/Supabase/Razorpay native entries from the final Flutter and iOS dependency graph.
  - Removed hardcoded Supabase/Firebase constants from `packages/dart/core` and removed their public exports.
  - Reduced `packages/dart/services` to a compatibility facade that only re-exports `SharedPreferencesService`; deleted all legacy service/provider implementation files under `packages/dart/services/lib/src/**`.
  - Slimmed `packages/dart/models` to canonical contracts plus remaining merchant compatibility models; removed Firestore-era exported models and converted remaining timestamp handling to gateway/string-compatible parsing.
  - Removed the legacy update-dialog export and widget from `packages/dart/ui_kit`.
- Deletion / archive log:
  - DELETED `apps/mobile/merchant-app/lib/firebase_options.dart`.
  - DELETED `apps/mobile/merchant-app/lib/config/supabase_config.dart`.
  - DELETED `apps/mobile/merchant-app/lib/screens/download/download_screen.dart`.
  - ARCHIVED `apps/mobile/merchant-app/lib/screens/landing/**` -> `docs/archive/flutter-legacy/merchant-app-landing/**` because the tree contained pre-existing modified local files.
  - DELETED `packages/dart/core/lib/src/config/supabase_config.dart` and `packages/dart/core/lib/src/constants/firebase_constants.dart`.
  - DELETED `packages/dart/services/lib/src/**` legacy service/provider files: ad/admin/AI/analytics/app-update/auth/cache/category/custom-payment/database/deals/FCM/fee/firestore-data/invoice/location/loyalty/notification/order/payment/product-stats/provider/reel/return/seller/stock/storage/Supabase/support/visual-search implementations.
  - DELETED Firestore-era model files under `packages/dart/models/lib/src/**`: ad, address, analytics, app-update, banner, cart, category, chat, commission, coupon, deal, fee, India locations, loyalty, notification, order, payment settings, product, reel, return, review, seller, sponsored banner, support chat, team member, trending search, UPI app, user, timestamp parser, and wishlist models.
  - DELETED `packages/dart/ui_kit/lib/src/widgets/update_dialog.dart`.
- Scoped proof:
  - `flutter pub get` at repository root -> PASS; final graph removed Firebase/Firestore/Firebase messaging/storage/analytics/functions, Supabase/Supabase Flutter, geolocation, legacy notification/update services, `letbuyy_services` app dependency, `razorpay_flutter`, and `eventify`.
  - `HOME=/private/tmp DART_SUPPRESS_ANALYTICS=true dart format ...` over active changed Dart files -> PASS.
  - Active-source scan for Firebase Auth, Firestore, Firebase storage/analytics/functions/core/messaging, `DefaultFirebaseOptions`, Supabase, hardcoded `rvzgkynwhbiksffusqnb`, and `verifyUpiPayment` in `apps/mobile/merchant-app/lib` and `packages/dart` -> PASS with no matches.
  - Active-source/dependency scan for `screens/landing`, `LandingScreen`, `AppRoutes.download`, `DownloadScreen`, `razorpay_flutter`, and `eventify` -> PASS; only `packages/dart/services/pubspec.yaml:name: letbuyy_services` remains as the compatibility package name, with no live app import or dependency.
  - Escalated `flutter analyze` in `apps/mobile/merchant-app`, `packages/dart/core`, `packages/dart/models`, `packages/dart/services`, and `packages/dart/ui_kit` -> PASS with no issues.
  - Escalated `flutter test` in `packages/dart/models` -> PASS (2 conformance tests); escalated `flutter test` in `apps/mobile/merchant-app` -> PASS (placeholder widget test).
  - Escalated `flutter build apk --debug --dart-define-from-file=dart-defines/local.json` in `apps/mobile/merchant-app` -> PASS, built `build/app/outputs/flutter-apk/app-debug.apk`.
  - Escalated `flutter build ios --no-codesign --debug --dart-define-from-file=dart-defines/local.json` in `apps/mobile/merchant-app` -> PASS, built `build/ios/iphoneos/Runner.app`.
  - Escalated `flutter run -d 720BBB11-3F5B-4257-930B-4926520FF590 --debug --dart-define-from-file=dart-defines/local.json` -> PASS after pruning unused `razorpay_flutter`; app built, synced to the iPhone 16e simulator, and exposed Dart VM/DevTools service URLs. Leftover smoke-test processes were terminated and verified.

## M6 THEME EDITOR UNIFICATION
- Status: DONE / COMMITTED / POST-COMMIT GOVERNANCE PASSED WITH BACKEND/HUMAN SKIPS.
- Source changes:
  - Added `ThemesApi.catalogPayload` to the shared Dart API client so mobile can preserve store-scoped `/v1/themes` metadata such as `current_theme` while still using the package API surface.
  - Registered `ThemeService` in the merchant app provider graph and rewired it to typed `ApiClient.themes` methods for catalog, install, editor load, draft save/delete, preview-session, releases, rollback, publish, and duplicate-draft behavior.
  - Replaced the Theme tab's local `StoreThemeModel.defaultThemes` preset editor with a real theme library over `/v1/themes`, including current theme, draft status, preview, duplicate draft, publish, discard draft, and install actions.
  - Rewired `SectionEditorScreen` to load editor state from `/v1/themes/:slug/editor`, preserve the loaded theme bundle map, normalize theme-engine `sections.header/template/footer` slots into Flutter section models, and save edits through `/v1/themes/:slug/editor/draft`.
  - Removed the editor's old `StoreService.updateStore` and `updateHeaderSettings` mutation paths for theme edits; all section/header edits now remain local until saved as a theme draft.
  - Replaced `WebsitePreview`'s hardcoded Flutter `preview_sections/*` renderer with a `webview_flutter` storefront preview pointed at `/preview` with `theme_preview_token`, `viewport`, and `settings_data_b64`, while preserving device-frame controls and section selection/move/add overlays.
  - Added `StoreMainScreen.navigateToEditor()` so Theme tab actions can jump into the existing Editor tab without introducing a parallel route.
- Scoped proof:
  - Escalated `dart format` over touched Dart files -> PASS.
  - Source scan for `preview_sections`, `PreviewHeader`, `PreviewHero`, `PreviewProducts`, `PreviewFooter`, `PreviewAbout`, `PreviewTestimonials`, and `PreviewNewsletter` in the updated preview/editor/theme files -> PASS with no matches.
  - Source scan for old `StoreService.updateStore`, `updateHeaderSettings`, local `StoreThemeModel`, and raw theme endpoint strings in the updated M6 files -> PASS with no matches.
  - Escalated `flutter analyze apps/mobile/merchant-app` -> PASS with no issues.
  - Escalated `dart analyze packages/dart/api_client` -> PASS with no issues.
  - Escalated `flutter test apps/mobile/merchant-app` -> PASS: placeholder widget test passed.
  - Escalated `flutter build apk --debug` in `apps/mobile/merchant-app` -> PASS, built `build/app/outputs/flutter-apk/app-debug.apk`.
  - Escalated `flutter build ios --debug --no-codesign` in `apps/mobile/merchant-app` -> PASS, built `build/ios/iphoneos/Runner.app`.
  - Escalated `flutter devices` -> PASS; detected iPhone 16e simulator, macOS, and Chrome, but no Android device.
  - Escalated `flutter emulators` -> PASS; configured Android AVD `Medium_Phone_API_36.1` exists.
  - Escalated `flutter emulators --launch Medium_Phone_API_36.1` -> LOCAL DEVICE BLOCKER; emulator reported `The Android emulator exited with code 1 during startup`.
  - Escalated `flutter run -d 720BBB11-3F5B-4257-930B-4926520FF590 --debug --pid-file /private/tmp/letbuyy-m6-ios.pid` -> PASS; app built, synced, and launched on the iPhone 16e simulator with VM service at `http://127.0.0.1:57506/dMDjtzgAdn4=/`.
  - Escalated `xcrun simctl io 720BBB11-3F5B-4257-930B-4926520FF590 screenshot /private/tmp/letbuyy-m6-ios-smoke.png` -> PASS; screenshot shows the merchant app launched to the auth screen as expected without a seeded mobile session.

## M7 MISSING FEATURE SCREENS
- Status: DONE / COMMITTED / POST-COMMIT GOVERNANCE PASSED WITH BACKEND/HUMAN SKIPS.
- Required mission scope:
  - Commerce: Customers `/v1/customers`, Collections `/v1/categories`, Inventory `/v1/inventory`, Coupons `/v1/coupons`, Gift cards, Reviews management `/v1/reviews`, and Order detail timeline/fulfill/refund over `/v1/orders`.
  - Online store: Theme Marketplace browse/install, CMS Pages `/v1/pages`, Blog `/v1/blog`, Navigation menus, and Media `/v1/media`.
  - Apps: App Marketplace browse/install/consent over `/v1/app-store`.
  - Settings hub parity: Checkout, Shipping `/v1/shipping-tax`, Taxes/GST, Notifications `/v1/notifications`, Users & permissions `/v1/employees`, Policies `/v1/pages`, Payments `/v1/payments`, Plan & Billing `/v1/billing`, Business, Localization, and Security.
  - Other: Form submissions `/v1/form-submissions` and real Analytics `/v1/analytics`.
  - Gate M7: all missing screens present as real thin Flutter screens or `[SKIP - NEEDS BACKEND]` placeholders; navigation mirrors web mobile IA; both-platform screenshot/build proof; 128/128 governance.
- Source changes:
  - Added `MerchantFeatureDefinitions`, a single mobile IA registry for 26 missing feature routes grouped as Commerce, Online Store, Apps, Settings Hub, and Forms & Analytics.
  - Added `MerchantFeatureScreen`, a reusable thin Flutter screen that calls the shared `ApiClient.get` against `/v1` endpoint definitions, adds `store_id` from `StoreService` for store-scoped routes, extracts list/map responses into bounded rows, supports refresh, and renders explicit `[SKIP - NEEDS BACKEND]` copy for unavailable contracts.
  - Registered the `/features/*` route map in `AppRoutes.generateRoute` without creating app-local service logic or backend changes.
  - Added grouped Settings navigation for the 26 parity routes, preserving existing Settings tiles and payment/plan surfaces.
  - Endpoint-backed routes cover customers, collections/categories, inventory levels, coupons, reviews, orders, themes, pages, blog posts, navigation, media, app marketplace apps, shipping zones, taxes, notification preferences, employees, policies, payment subscription, subscription history, form submissions, and analytics dashboard.
  - Backend-needed placeholders cover gift cards, checkout settings, business details, localization, security, and full billing parity where governed mobile-safe contracts are not present.
- Scoped proof:
  - Escalated `dart format` over the M7 Dart files -> PASS.
  - Source assertion `rg -o "route: '/features/[^']+'" ... | wc -l` -> PASS with `26`.
  - Source assertion for `endpoint: 'employees'` and `Requires /v1/employees` -> PASS.
  - Source assertion for `MerchantFeatureDefinitions.byRoute`, `MerchantFeatureScreen`, and Settings groups `commerce`, `onlineStore`, `apps`, `settingsHub`, `other` -> PASS.
  - Escalated `flutter analyze apps/mobile/merchant-app` -> PASS with no issues.
  - Escalated `flutter test apps/mobile/merchant-app` -> PASS; placeholder widget test passed.
  - Escalated `flutter build apk --debug` in `apps/mobile/merchant-app` -> PASS, built `build/app/outputs/flutter-apk/app-debug.apk`.
  - Escalated `flutter build ios --debug --no-codesign` in `apps/mobile/merchant-app` -> PASS, built `build/ios/iphoneos/Runner.app`.
  - Escalated `flutter run -d 720BBB11-3F5B-4257-930B-4926520FF590 --debug --route /features/customers --pid-file /private/tmp/letbuyy-m7-ios.pid` -> PASS; route opened on the iPhone 16e simulator and attempted store context through `StoreService`.
  - Escalated `xcrun simctl io 720BBB11-3F5B-4257-930B-4926520FF590 screenshot /private/tmp/letbuyy-m7-ios-feature-customers.png` -> PASS; screenshot shows the Customers feature screen, `/v1/customers` endpoint summary, and authenticated-store placeholder instead of a crash.
  - Escalated `flutter devices` -> PASS; detected iPhone 16e simulator, macOS, and Chrome, but no Android device.
  - Escalated `flutter emulators` -> PASS; configured Android AVD `Medium_Phone_API_36.1` exists.
  - Escalated `flutter emulators --launch Medium_Phone_API_36.1` -> LOCAL DEVICE BLOCKER; emulator reported `The Android emulator exited with code 1 during startup`.
  - Escalated post-launch `flutter devices` -> PASS; still no Android device available.

## M8 CROSS-PLATFORM AND ENVIRONMENT HARDENING
- Status: DONE / COMMITTED / POST-COMMIT GOVERNANCE PASSED WITH BACKEND/HUMAN SKIPS.
- Required mission scope:
  - M8.1 full Android emulator smoke: login -> product -> order -> theme edit -> settings with screenshots.
  - M8.2 full iOS simulator smoke for the same journey with screenshots; iOS device/TestFlight signing remains `[SKIP - NEEDS HUMAN]`.
  - M8.3 verify `local`, `staging`, and `production` dart-define builds compile and target the correct gateway/Supabase; real staging/production keys remain `[SKIP - NEEDS HUMAN]`.
  - Final M8 gate: both platforms run the end-to-end merchant journey on the real stack where unblocked; three env builds verified; `flutter analyze` clean; `flutter test` green; 128/128 governance; `CODEX_MOBILE_PARITY_STATUS.md` written.
- Source changes:
  - Fixed `OrdersScreen._loadOrders` so missing/failed store lookup clears `_isLoading` and renders the existing no-store fallback instead of a permanent spinner.
  - Moved `OrderService` initialization into `initState` so later reload paths do not reassign a `late final` service.
  - Added `CODEX_MOBILE_PARITY_STATUS.md` with the M0-M8 result, final proof, and human/backend skip list.
- Scoped proof:
  - Escalated `dart format apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart` -> PASS.
  - Escalated `flutter analyze apps/mobile/merchant-app` -> PASS with no issues.
  - Escalated `flutter test apps/mobile/merchant-app` -> PASS; placeholder widget test passed.
  - `node -e` dart-define contract assertion for `local`, `staging`, and `production` -> PASS.
  - Escalated iOS simulator route smoke with local dart-defines:
    - `/login` -> PASS, screenshot `/private/tmp/letbuyy-m8-ios-login.png`.
    - `/orders` after fallback fix -> PASS, screenshot `/private/tmp/letbuyy-m8-ios-orders-fixed.png`.
    - `/features/inventory` -> PASS, screenshot `/private/tmp/letbuyy-m8-ios-inventory.png`.
    - `/features/theme-marketplace` -> PASS, screenshot `/private/tmp/letbuyy-m8-ios-theme-marketplace.png`.
    - `/features/shipping` -> PASS, screenshot `/private/tmp/letbuyy-m8-ios-shipping.png`.
  - Escalated Android env builds -> PASS:
    - `flutter build apk --debug --dart-define-from-file=dart-defines/local.json`.
    - `flutter build apk --debug --dart-define-from-file=dart-defines/staging.json`.
    - `flutter build apk --debug --dart-define-from-file=dart-defines/production.json`.
  - Escalated iOS env builds -> PASS:
    - `flutter build ios --debug --no-codesign --dart-define-from-file=dart-defines/local.json`.
    - `flutter build ios --debug --no-codesign --dart-define-from-file=dart-defines/staging.json`.
    - `flutter build ios --debug --no-codesign --dart-define-from-file=dart-defines/production.json`.
  - Escalated `flutter devices` -> PASS; detected iPhone 16e simulator, macOS, and Chrome, but no Android device.
  - Escalated `flutter emulators` -> PASS; configured Android AVD `Medium_Phone_API_36.1` exists.
  - Escalated `flutter emulators --launch Medium_Phone_API_36.1` -> LOCAL DEVICE BLOCKER; emulator reported `The Android emulator exited with code 1 during startup`.
  - Escalated post-launch `flutter devices` -> PASS; still no Android device available.

## SKIPPED - NEEDS HUMAN
- Staging Supabase project URL and anon key. Required: governed staging `SUPABASE_URL` and public anon key from the secret manager before replacing `SKIP_NEEDS_HUMAN_STAGING_*` placeholders.
- Production Supabase project URL and anon key. Required: governed production `SUPABASE_URL` and public anon key from the secret manager before replacing `SKIP_NEEDS_HUMAN_PRODUCTION_*` placeholders.
- Staging and production Razorpay public key IDs. Required: approved provider sandbox/live key IDs from the payment owner; do not hardcode private secrets in repository files.
- iOS device signing, simulator/device release proof, and TestFlight/App Store upload. Required: Apple Developer team, signing certificate, provisioning profile, bundle identifier approval, and human permission to perform signed distribution. The no-codesign compile proof passed.
- M4 live subscription pricing/copy and paid plan activation. Required: approved plan names/prices/features/commission policy, Razorpay subscription checkout credentials, signed Razorpay callback payloads, and permission to run provider-side payment attempts. Code now points to gateway `/payments/subscription*` contracts but does not assert unapproved pricing as final.
- M5 Android emulator smoke. Required: a working Android emulator/device on the host. The configured AVD `Medium_Phone_API_36.1` exited with code 1 during startup on two attempts before Flutter could run against it; Android debug APK build passed.
- M6 Android emulator smoke. Required: a working Android emulator/device on the host. `flutter devices` detected no Android device, and `flutter emulators --launch Medium_Phone_API_36.1` reported `The Android emulator exited with code 1 during startup`; Android debug APK build passed.
- M7 Android emulator smoke. Required: a working Android emulator/device on the host. `flutter devices` detected no Android device, and `flutter emulators --launch Medium_Phone_API_36.1` again reported `The Android emulator exited with code 1 during startup`; Android debug APK build passed.
- M8 Android emulator full-journey smoke. Required: a working Android emulator/device on the host. `flutter devices` detected no Android device, and `flutter emulators --launch Medium_Phone_API_36.1` again reported `The Android emulator exited with code 1 during startup`; local/staging/production Android debug APK builds passed.

## SKIPPED - NEEDS BACKEND
- M2 live mobile merchant login against protected gateway endpoints. Current gateway auth accepts Supabase bearer tokens or signed internal SSO/session headers for `lb_session`; a mobile app must not possess the internal signing secret, and raw `lb_session` / cookie transport is not accepted by protected `/v1` merchant routes. Required: a mobile-safe gateway session bridge that validates `lb_session` without exposing internal signing secrets, plus refresh/expiry semantics for mobile clients.
- M2 production mobile signup/login CAPTCHA proof. Identity-platform login/signup routes are CSRF + Turnstile protected; local development can use `dev-bypass-token`, but production mobile proof needs an approved mobile Turnstile token flow or a backend-owned mobile identity endpoint that preserves bot protection.
- M4 protected real-gateway screen smoke for merchant dashboard/products/orders/settings remains blocked by the M2 mobile-safe gateway session bridge skip; the screens are rewired to the shared gateway client but cannot be proven against protected `/v1` merchant routes with raw `lb_session`.
- M4 traffic-source and daily revenue chart data. Required: gateway analytics endpoints for source attribution and periodized daily revenue/visitor series; mobile now renders explicit placeholders instead of fabricated sources or chart values.
- M4 custom-domain verification. Required: gateway-owned domain ownership verification, TXT/CNAME record issuance, SSL activation status, and takeover-prevention workflow before mobile can verify or activate custom domains.
- M4 store selected-product membership/import persistence. Required: gateway-supported store product-selection contract or field in `UpdateStoreSchema`; current gateway `PATCH /stores/:id` rejects unsupported `selected_product_ids`, so import/remove membership remains backend-gated.
- M6 protected real-stack theme parity proof. Required: the M2 mobile-safe gateway session bridge plus a seeded mobile merchant session/store/theme draft. The M6 code now calls protected `/v1/themes` editor/draft/preview/publish contracts, but live phone-edited theme parity with web/storefront cannot be proven from the app because the simulator only reaches the auth screen without a backend-accepted mobile session.
- M7 protected real-stack feature data proof. Required: the M2 mobile-safe gateway session bridge plus a seeded mobile merchant session, owned store, and rows for customers/categories/inventory/coupons/reviews/orders/pages/blog/navigation/media/apps/shipping/taxes/notifications/employees/policies/payments/forms/analytics. The M7 screens call governed `/v1` endpoint definitions and degrade safely, but authenticated live data cannot be proven from the simulator because the gateway rejects raw mobile `lb_session` without the backend bridge.
- M7 missing dedicated mobile-safe contracts. Required: governed `/v1` contracts for gift cards, checkout settings, full business/compliance settings, localization/markets, merchant security/session inventory, and full billing/invoice parity. Current M7 screens render `[SKIP - NEEDS BACKEND]` placeholders for these surfaces rather than fabricating data.
- M8 protected full merchant journey. Required: the M2 mobile-safe gateway session bridge plus seeded merchant/store/product/order/theme/settings data. M8 iOS route-level smoke is proven, but login -> product -> order -> theme edit -> settings cannot be live-certified as a single authenticated real-stack journey until the gateway accepts mobile `lb_session` and seeded store state exists.

## VALIDATOR LEDGER
- 2026-06-04T05:16:22Z [M0 baseline] Flutter version/pub get/analyze/test/Android debug build/iOS no-codesign build all passed as recorded above.
- 2026-06-04T05:19:33Z [M0 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, or `.symlinks` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-04T05:20:44Z [M0 post-commit governance] Post-commit `pnpm run validate:governance` after `1346fca2` -> PASS (128/128 validators). M0 is complete; advancing to M1 typed `/v1` API client package.
- 2026-06-04T05:44:45Z [M1 scoped proof] API client package/app wiring proof complete: package tests/analyze, merchant app analyze/test, real-stack local product-list E2E, Android debug build, and iOS no-codesign debug build all passed. Generated-artifact cleanup scan after shutdown -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, or `.symlinks` directories. Full governance pending.
- 2026-06-04T05:46:11Z [M1 pre-commit governance] First `pnpm run validate:governance` failed only because `apps/mobile/merchant-app/runtime.manifest.json` needed the newly introduced `letbuyy_api_client` internal dependency declared. Added the manifest dependency and reran `pnpm run validate:governance` -> PASS (128/128 validators). M1 gate result: PASS.
- 2026-06-04T05:47:27Z [M1 post-commit governance] Post-commit `pnpm run validate:governance` after `7a8b6c3f` -> PASS (128/128 validators). M1 is complete; advancing to M2 identity/session migration.
- 2026-06-04T06:04:43Z [M2 scoped proof] Identity/session migration source proof complete: root `flutter pub get`, formatter, Firebase Auth/social-auth source scans, package/app analyzes, API client and merchant app tests, Android debug build, and iOS no-codesign debug build all passed. M2 live protected-gateway login remains `[SKIP - NEEDS BACKEND]` because mobile cannot safely generate the signed internal session headers the gateway currently requires for `lb_session`.
- 2026-06-04T06:08:40Z [M2 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, or `.symlinks` directories; `pnpm run validate:governance` -> PASS (128/128 validators). M2 gate result: PASS WITH BACKEND SKIPS.
- 2026-06-04T06:14:21Z [M2 post-commit governance] Post-commit `pnpm run validate:governance` after `e7cfc007` -> PASS (128/128 validators). M2 is complete with backend-only skips; advancing to M3 contract conformance.
- 2026-06-04T06:24:11Z [M3 scoped proof] Contract conformance source proof complete: formatter, `packages/dart/models` analyze/test, `packages/dart/services` analyze, and merchant app analyze all passed. Full governance pending after generated-artifact cleanup.
- 2026-06-04T06:25:59Z [M3 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, `.symlinks`, or Flutter plugin metadata files; `pnpm run validate:governance` -> PASS (128/128 validators). M3 gate result: PASS.
- 2026-06-04T06:28:01Z [M3 post-commit governance] First post-commit `pnpm run validate:governance` after `cffb895f` failed only at stale-artifact validation because app `.next` and app/package-local `node_modules` directories reappeared. Generated-artifact cleanup scan was rerun -> empty; second `pnpm run validate:governance` -> PASS (128/128 validators). M3 is complete; advancing to M4 existing-screen API/model rewiring.
- 2026-06-04T06:53:50Z [M4 scoped proof] Existing-screen API/model rewiring proof complete: formatter, `packages/dart/models` analyze/test, `packages/dart/ui_kit` analyze, merchant app analyze/test, direct runtime source scan, and fabricated metric/DNS scan all passed. Full governance pending after generated-artifact cleanup.
- 2026-06-04T06:57:46Z [M4 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, `.symlinks`, or Flutter plugin metadata files; `pnpm run validate:governance` -> PASS (128/128 validators). M4 gate result: PASS WITH BACKEND/HUMAN SKIPS.
- 2026-06-04T07:00:10Z [M4 post-commit governance] Post-commit `pnpm run validate:governance` after `2fe3d3d5` -> PASS (128/128 validators). M4 is complete with backend/human skips; advancing to M5 legacy deletion.
- 2026-06-04T07:27:50Z [M5 scoped proof] Legacy deletion proof complete: active app/package scans removed Firebase/Firestore/Firebase plugin/Supabase/hardcoded legacy project/unused native Razorpay references; active route table no longer imports landing/download; `flutter analyze` passed for merchant app, core, models, services, and UI kit; model and app tests passed; Android debug APK build passed; iOS no-codesign build passed; iOS simulator smoke passed on iPhone 16e after pruning unused `razorpay_flutter`; Android emulator smoke is `[SKIP - NEEDS HUMAN]` because the configured AVD exits with code 1 during startup.
- 2026-06-04T07:29:52Z [M5 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, `.symlinks`, or Flutter plugin metadata files; `pnpm run validate:governance` -> PASS (128/128 validators). M5 gate result: PASS WITH HUMAN ANDROID-EMULATOR SKIP.
- 2026-06-04T07:32:49Z [M5 post-commit governance] Post-commit `pnpm run validate:governance` after `9e91bc3f` -> PASS (128/128 validators). M5 is complete; advancing to M6 theme editor unification.
- 2026-06-04T07:54:01Z [M6 scoped proof] Theme editor unification proof complete: formatter, old mock-preview/store-mutation scans, merchant app analyze/test, shared API-client analyze, Android debug APK build, iOS no-codesign build, and iOS simulator launch+screenshot passed. Android emulator runtime smoke remains `[SKIP - NEEDS HUMAN]` because the configured AVD exits with code 1 during startup. Protected live theme parity remains `[SKIP - NEEDS BACKEND]` until the M2 mobile-safe gateway session bridge exists.
- 2026-06-04T07:56:34Z [M6 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, `.symlinks`, or Flutter plugin metadata files; `pnpm run validate:governance` -> PASS (128/128 validators). M6 gate result: PASS WITH BACKEND/HUMAN SKIPS.
- 2026-06-04T07:58:24Z [M6 post-commit governance] Post-commit `pnpm run validate:governance` after `f2800ed3` -> PASS (128/128 validators). M6 is complete with backend/human skips; advancing to M7 missing feature screens.
- 2026-06-04T08:12:22Z [M7 scoped proof] Missing feature screen proof complete: formatter, 26-route source assertion, `/v1/employees` endpoint assertion, route/settings wiring assertion, merchant app analyze/test, Android debug APK build, iOS no-codesign build, and iOS simulator `/features/customers` route screenshot passed. Android runtime smoke remains `[SKIP - NEEDS HUMAN]` because the configured AVD exits with code 1 during startup. Protected live feature data and dedicated gift-card/checkout/business/localization/security/full-billing contracts remain `[SKIP - NEEDS BACKEND]`.
- 2026-06-04T08:14:23Z [M7 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, `.symlinks`, or Flutter plugin metadata files; `pnpm run validate:governance` -> PASS (128/128 validators). M7 gate result: PASS WITH BACKEND/HUMAN SKIPS.
- 2026-06-04T08:16:05Z [M7 post-commit governance] Post-commit `pnpm run validate:governance` after `f19f086e` -> PASS (128/128 validators). M7 is complete with backend/human skips; advancing to M8 cross-platform and environment hardening.
- 2026-06-04T08:43:11Z [M8 scoped proof] Cross-platform/environment proof complete: Orders no-store fallback fix, mobile parity status file, formatter, merchant app analyze/test, dart-define JSON assertion, local/staging/production Android APK builds, local/staging/production iOS no-codesign builds, and iOS simulator route screenshots all passed. Android full-journey runtime smoke remains `[SKIP - NEEDS HUMAN]` because the configured AVD exits with code 1 during startup. Protected full merchant journey remains `[SKIP - NEEDS BACKEND]` until the mobile-safe gateway session bridge and seeded store data exist.
- 2026-06-04T08:48:05Z [M8 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, `.symlinks`, or Flutter plugin metadata files; `pnpm run validate:governance` -> PASS (128/128 validators). M8 gate result: PASS WITH BACKEND/HUMAN SKIPS.
- 2026-06-04T08:52:48Z [M8 post-commit governance / WS8 gate] Post-commit `pnpm run validate:governance` after `8850b89d` -> PASS (128/128 validators). WS8 Mobile Parity is complete for all unblocked client work with backend/human skips recorded in `CODEX_MOBILE_PARITY_STATUS.md`.
