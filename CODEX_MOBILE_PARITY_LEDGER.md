# CODEX MOBILE PARITY LEDGER - started 2026-06-04T05:16:22Z

## CURRENT STATUS
- Stage: STAGE 5 - WS8 Mobile Parity.
- Active gate: M0 baseline, environment contracts, and legacy inventory passed pre-commit governance; commit pending.
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

## SKIPPED - NEEDS HUMAN
- Staging Supabase project URL and anon key. Required: governed staging `SUPABASE_URL` and public anon key from the secret manager before replacing `SKIP_NEEDS_HUMAN_STAGING_*` placeholders.
- Production Supabase project URL and anon key. Required: governed production `SUPABASE_URL` and public anon key from the secret manager before replacing `SKIP_NEEDS_HUMAN_PRODUCTION_*` placeholders.
- Staging and production Razorpay public key IDs. Required: approved provider sandbox/live key IDs from the payment owner; do not hardcode private secrets in repository files.
- iOS device signing, simulator/device release proof, and TestFlight/App Store upload. Required: Apple Developer team, signing certificate, provisioning profile, bundle identifier approval, and human permission to perform signed distribution. The no-codesign compile proof passed.

## VALIDATOR LEDGER
- 2026-06-04T05:16:22Z [M0 baseline] Flutter version/pub get/analyze/test/Android debug build/iOS no-codesign build all passed as recorded above.
- 2026-06-04T05:19:33Z [M0 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, `.wrangler`, `Pods`, or `.symlinks` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
