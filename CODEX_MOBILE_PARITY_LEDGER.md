# CODEX MOBILE PARITY LEDGER - started 2026-06-04T05:16:22Z

## CURRENT STATUS
- Stage: STAGE 5 - WS8 Mobile Parity.
- Active gate: M3 contract conformance pre-commit governance passed; commit pending.
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
- Status: DONE / PRE-COMMIT GOVERNANCE PASSED.
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

## SKIPPED - NEEDS HUMAN
- Staging Supabase project URL and anon key. Required: governed staging `SUPABASE_URL` and public anon key from the secret manager before replacing `SKIP_NEEDS_HUMAN_STAGING_*` placeholders.
- Production Supabase project URL and anon key. Required: governed production `SUPABASE_URL` and public anon key from the secret manager before replacing `SKIP_NEEDS_HUMAN_PRODUCTION_*` placeholders.
- Staging and production Razorpay public key IDs. Required: approved provider sandbox/live key IDs from the payment owner; do not hardcode private secrets in repository files.
- iOS device signing, simulator/device release proof, and TestFlight/App Store upload. Required: Apple Developer team, signing certificate, provisioning profile, bundle identifier approval, and human permission to perform signed distribution. The no-codesign compile proof passed.

## SKIPPED - NEEDS BACKEND
- M2 live mobile merchant login against protected gateway endpoints. Current gateway auth accepts Supabase bearer tokens or signed internal SSO/session headers for `lb_session`; a mobile app must not possess the internal signing secret, and raw `lb_session` / cookie transport is not accepted by protected `/v1` merchant routes. Required: a mobile-safe gateway session bridge that validates `lb_session` without exposing internal signing secrets, plus refresh/expiry semantics for mobile clients.
- M2 production mobile signup/login CAPTCHA proof. Identity-platform login/signup routes are CSRF + Turnstile protected; local development can use `dev-bypass-token`, but production mobile proof needs an approved mobile Turnstile token flow or a backend-owned mobile identity endpoint that preserves bot protection.

## VALIDATOR LEDGER
- 2026-06-04T05:16:22Z [M0 baseline] Flutter version/pub get/analyze/test/Android debug build/iOS no-codesign build all passed as recorded above.
- 2026-06-04T05:19:33Z [M0 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, or `.symlinks` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-04T05:20:44Z [M0 post-commit governance] Post-commit `pnpm run validate:governance` after `3ecea31a` -> PASS (128/128 validators). M0 is complete; advancing to M1 typed `/v1` API client package.
- 2026-06-04T05:44:45Z [M1 scoped proof] API client package/app wiring proof complete: package tests/analyze, merchant app analyze/test, real-stack local product-list E2E, Android debug build, and iOS no-codesign debug build all passed. Generated-artifact cleanup scan after shutdown -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, or `.symlinks` directories. Full governance pending.
- 2026-06-04T05:46:11Z [M1 pre-commit governance] First `pnpm run validate:governance` failed only because `apps/mobile/merchant-app/runtime.manifest.json` needed the newly introduced `letbuyy_api_client` internal dependency declared. Added the manifest dependency and reran `pnpm run validate:governance` -> PASS (128/128 validators). M1 gate result: PASS.
- 2026-06-04T05:47:27Z [M1 post-commit governance] Post-commit `pnpm run validate:governance` after `90c48342` -> PASS (128/128 validators). M1 is complete; advancing to M2 identity/session migration.
- 2026-06-04T06:04:43Z [M2 scoped proof] Identity/session migration source proof complete: root `flutter pub get`, formatter, Firebase Auth/social-auth source scans, package/app analyzes, API client and merchant app tests, Android debug build, and iOS no-codesign debug build all passed. M2 live protected-gateway login remains `[SKIP - NEEDS BACKEND]` because mobile cannot safely generate the signed internal session headers the gateway currently requires for `lb_session`.
- 2026-06-04T06:08:40Z [M2 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, or `.symlinks` directories; `pnpm run validate:governance` -> PASS (128/128 validators). M2 gate result: PASS WITH BACKEND SKIPS.
- 2026-06-04T06:14:21Z [M2 post-commit governance] Post-commit `pnpm run validate:governance` after `705975f9` -> PASS (128/128 validators). M2 is complete with backend-only skips; advancing to M3 contract conformance.
- 2026-06-04T06:24:11Z [M3 scoped proof] Contract conformance source proof complete: formatter, `packages/dart/models` analyze/test, `packages/dart/services` analyze, and merchant app analyze all passed. Full governance pending after generated-artifact cleanup.
- 2026-06-04T06:25:59Z [M3 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, `.symlinks`, or Flutter plugin metadata files; `pnpm run validate:governance` -> PASS (128/128 validators). M3 gate result: PASS.
