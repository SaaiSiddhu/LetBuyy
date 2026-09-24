# reference/apps/marketplace-seller AGENTS.md

Purpose: Local operating rules for `reference/apps/marketplace-seller`. Hand-authored, subordinate to the root `AGENTS.md`.

## Ownership Rules

- Follow the root `AGENTS.md` and the Constitution before making architecture, money, identity, tenancy, or governance changes.
- **REFERENCE class** (Constitution §16, Amendment 3, 2026-09-24): preserved donor source, not an application. Never built, deployed, installed as a pnpm or pub workspace member, or imported by anything outside `reference/` (`reference-isolation-validator`); still secret-scanned with no path exemption. Until 2026-09-24 this tree sat at `apps/phase_2/*`, the Amendment 1 tier, which no longer exists. Capabilities leave only by re-implementation in the recipient named in `README.md`, under its Transfer gates.
- **Not production-ready.** Newest source file predates import by ~8 months (last touched 2026-01-14); unassigned owner; no backend target selected. Never represent as shippable.
- Authorizes no new backend service — any backend work routes through the D-0-selected canonical backend.
- `apps/merchant/mobile` (`letbuyy_store`, `com.letbuyy.store`) remains the governed seller-facing app of the six-app core. This root is a separate, not-yet-scoped capability and does not supersede it.

## Android identity

- Declared identity is **`com.letbuyy.seller`** (namespace and applicationId), in `android/app/build.gradle` (Groovy).
- This app is **not** in `config/governance/android-identity-registry.json`, like the other donor and deferred roots. It has never shipped. If it is ever prepared for release it must be registered there first.
- Never reintroduce `com.letbuyy.letbuyy` (customer_app's shipped Play Store identity) or `com.letbuyy.admin` (retired). Both were present in the pre-import tree and were removed — see Migration Notes.

## Forbidden Imports

- No imports from other app roots, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.

## Migration Notes

- Imported 2026-09-20 from an untracked `apps/seller` tree that had been sitting outside version control. 171 Dart files, 167 of which exist nowhere else in this repository; 0 are byte-identical to `apps/merchant/mobile`.
- The pre-import tree carried **three competing app-level build scripts**. Removed on import:
  - `android/app/build.gradle.kts` — declared `com.letbuyy.letbuyy`, **customer_app's shipped Play Store identity**, in Groovy syntax under a `.kts` filename. This is the exact defect class `android-identity-validator` and `config/governance/android-identity-registry.json` exist to prevent.
  - `android/app/build.gradle.kts.backup` — declared `com.agrimate.agrimate` (not an Agrimore identity either; Agrimore uses `com.agrimore.*`).
  - `android/build.gradle.kts` — duplicate root script alongside the Groovy `build.gradle` that Gradle actually evaluates.
- Also removed on import: `android/app/debug.keystore` (signing material; `*.keystore` is not covered by `.gitignore`), `android/app/google-services.json` and `ios/Runner/GoogleService-Info.plist` (Firebase config retired by FB-1, and both carried `com.letbuyy.letbuyy`), plus `.DS_Store` / `.flutter-plugins-dependencies` build artifacts.
- `android/app/proguard-rules.pro` had three `-keep class com.letbuyy.letbuyy.*` rules; repointed to `com.letbuyy.seller`.
- 2026-09-20, same day: a follow-up pass removed the Firebase/API credentials the first import missed —
  `lib/firebase_options.dart` (keys for **two** projects: `letbuy-y` and Agrimore's `agrii-mate`) and
  `web/firebase-messaging-sw.js` (`agrii-mate`), plus inline Google Maps API keys in `web/index.html`
  and `android/app/src/main/AndroidManifest.xml`, which were replaced with `REMOVED_SEE_AGENTS_MD`.
  A parked capability must not carry live credentials for the production Firebase project, and must
  never carry another product's.
- Consequence: this tree does not build as-is — no Firebase config, and `lib/main.dart` still imports
  the deleted `firebase_options.dart`. That is intentional: it is a parked capability, not a
  deployable app. Reviving it means choosing a backend (D-0) and provisioning its own credentials,
  never restoring the deleted ones.
