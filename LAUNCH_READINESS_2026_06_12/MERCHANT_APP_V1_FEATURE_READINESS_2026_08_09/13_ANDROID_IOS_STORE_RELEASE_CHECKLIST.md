# 13 — ANDROID / iOS STORE RELEASE CHECKLIST

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `ee371182` (`stepup/main`), working tree dirty and user-owned
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.
Generated/LCIS claims carry no authority here; every row is STATIC (source at `ee371182`),
LOCAL RUNTIME (a command run on this machine, output recorded), or HUMAN-PROVIDED.

> **Store-policy facts in this document were read from Apple's and Google's own current
> documentation on 2026-08-09** and are cited inline. Store policy changes without notice —
> re-verify at submission time.

---

## 1. Current release identity (STATIC)

| Item | Value | Source |
|---|---|---|
| Android `applicationId` | `com.letbuyy.store` | `android/app/build.gradle.kts:53` |
| iOS `PRODUCT_BUNDLE_IDENTIFIER` | `com.letbuyy.store` | `ios/Runner.xcodeproj/project.pbxproj:653` |
| iOS test target bundle id | `com.letbuyy.store.RunnerTests` | `project.pbxproj:672,692,710` |
| Flutter version string | `1.0.0+1` | `apps/mobile/merchant-app/pubspec.yaml:3` |
| `APP_RELEASE` telemetry tag | `letbuyy-merchant-mobile@1.0.0+1` | `dart-defines/production.json`, `staging.json` |
| Android `versionCode` / `versionName` | `flutter.versionCode` / `flutter.versionName` (derived from `pubspec.yaml`) | `build.gradle.kts:56-57` |
| iOS `CURRENT_PROJECT_VERSION` | `$(FLUTTER_BUILD_NUMBER)` | `project.pbxproj:645` |
| iOS deployment target | **13.0** | `project.pbxproj:629` |
| Android `compileSdk`/`minSdk`/`targetSdk` | Flutter defaults (`flutter.compileSdkVersion`, `flutter.minSdkVersion`, `flutter.targetSdkVersion`) — **not pinned in-repo** | `build.gradle.kts:38,54-55` |
| Dart SDK constraint | `^3.10.0` | `pubspec.yaml:8` |
| Toolchain used for this audit | Flutter **3.44.8** stable · Dart **3.12.2** | LOCAL RUNTIME: `flutter --version` |

> **`com.letbuyy.store` is permanent.** A bundle/application id cannot be changed after first
> publication on either store. It is a reverse-DNS *identifier*, unrelated to the retired
> `letbuyy.store` **web domain** (DEPLOY-R3) — do not "fix" it. The remaining
> `com.letbuyy.store/...` strings in `app_badge_service.dart:6`, `home_widget_service.dart:93`
> and the iOS app-group `group.com.letbuyy.store` are MethodChannel / app-group identifiers and
> are correct as-is.

## 2. Permissions and privacy strings (STATIC + LOCAL RUNTIME)

### 2.1 Android

| Permission | Declared in | Status |
|---|---|---|
| `android.permission.CAMERA` | `android/app/src/main/AndroidManifest.xml:2` | Declared |
| `android.permission.INTERNET` | `src/debug/AndroidManifest.xml:6`, `src/profile/AndroidManifest.xml:6`, and **now `src/main`** (this program) | See §2.2 |
| `android.permission.ACCESS_NETWORK_STATE` | *No app manifest* — contributed by a plugin library manifest | Merged in |

### 2.2 The INTERNET-permission investigation (a corrected finding — read this)

An auditor reported this as an S0: *"Release Android build ships without
`android.permission.INTERNET` — every network call fails."* The cited evidence was accurate —
`src/main/AndroidManifest.xml` declared only `CAMERA`, while `INTERNET` appeared only in
`src/debug` and `src/profile`, and release builds merge `main` (not `debug`/`profile`).

**The claim is REFUTED.** A release manifest-merge diff was run:

```
LOCAL RUNTIME — pre-fix release merged manifest
  build/app/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml
    android.permission.CAMERA
    android.permission.ACCESS_NETWORK_STATE
    android.permission.INTERNET        <-- present WITHOUT any app-level declaration
```

`INTERNET` reaches the release manifest **transitively from a plugin's library manifest** (the
same source as `ACCESS_NETWORK_STATE`). The release app was never broken.

**What was nonetheless changed, and why:** `INTERNET` is now declared explicitly in
`src/main/AndroidManifest.xml`. The app's core permission was arriving only as a side effect of
a transitive dependency; removing or swapping that plugin would silently drop network access from
**release builds only**, where it is hardest to notice. This is hardening, **not** an S0 fix, and
it is recorded as such in [`07_GAP_BLOCKER_AND_DEPENDENCY_REGISTER.md`](07_GAP_BLOCKER_AND_DEPENDENCY_REGISTER.md).

```
LOCAL RUNTIME — post-fix release merged manifest (same path)
    android.permission.INTERNET
    android.permission.CAMERA
    android.permission.ACCESS_NETWORK_STATE
LOCAL RUNTIME — flutter build apk --release ... -> exit 0, app-release.apk 84.4 MB
LOCAL RUNTIME — flutter analyze -> "No issues found!"
```

> The release build was produced with a **throwaway keystore generated in `/tmp`** solely to get
> past the signing guard for manifest verification. It is not a release key, it is not in the
> repository, and it must never be used to sign a shipped artifact.

### 2.3 iOS

| Key | Present | Source |
|---|---|---|
| `NSCameraUsageDescription` | Yes | `ios/Runner/Info.plist:42` |
| `NSPhotoLibraryUsageDescription` | Yes | `ios/Runner/Info.plist:44` |
| `PrivacyInfo.xcprivacy` | **ABSENT** | `find ios -name "PrivacyInfo.xcprivacy"` → no results |

## 3. BLOCKING store requirements

### 3.1 iOS privacy manifest — **BLOCKER (STORE-01)**

Apple requires a `PrivacyInfo.xcprivacy` privacy manifest for apps (and third-party SDKs) that use
**required-reason APIs**, declaring the APIs used, the reason codes, tracking behaviour, and
third-party data sharing. A missing or incomplete manifest results in **app rejection or a delayed
review**.
*(Source: [Adding a privacy manifest to your app or third-party SDK](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk), accessed 2026-08-09.)*

**This app uses required-reason APIs.** `pubspec.yaml` declares `shared_preferences: ^2.3.4`
(NSUserDefaults), `path_provider: ^2.1.5` (file-timestamp APIs), and
`flutter_secure_storage: ^9.2.4`. There is no privacy manifest anywhere in `ios/`.

**Closure:** author `ios/Runner/PrivacyInfo.xcprivacy` declaring each required-reason API with a
valid Apple reason code, plus `NSPrivacyTracking` and `NSPrivacyCollectedDataTypes`; confirm every
third-party SDK ships its own manifest; verify the aggregate in an Xcode archive report.
**Owner: human (Apple developer account holder) + engineering.**

### 3.2 In-app account deletion — **BLOCKER (STORE-02), both stores**

**Apple, Guideline 5.1.1(v):** *"If your app supports account creation, you must also offer account
deletion within the app."*
*(Source: [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), accessed 2026-08-09.)*

**Google Play, User Data policy:** if an app allows in-app account creation, it must allow users to
request account deletion **both from within the app and through an externally reachable web
resource**; the web route must not require reinstalling the app. Deletion must remove associated
user data — freezing the account is not sufficient — and the deletion route must be declared in the
Play Console **Data safety** form.
*(Sources: [Understanding Google Play's app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en), accessed 2026-08-09.)*

**Current state: NOT IMPLEMENTED ANYWHERE.**

```
grep -rin "delete account|deleteAccount|account_deletion|closeAccount"
  apps/mobile/merchant-app/lib/          -> no results
  services/api-gateway/src/              -> no results
  apps/identity-platform/src/            -> no results
  apps/merchant-control-plane/src/       -> no results
```

The merchant app **does** support account creation (signup → OTP → password), so both policies
apply. A staff-side DSR/compliance surface exists (`services/api-gateway/src/routes/security.ts`,
`routes/internal-console/compliance.ts`) but it is an operator tool, not a user-initiated in-app
deletion path, and it satisfies neither policy.

**Closure:** (a) an in-app "Delete account" flow with confirmation and honest consequence copy;
(b) a server deletion path that actually erases or irreversibly anonymises merchant data, respecting
the append-only ledger (money rows are corrected by reversing entries, never deleted — ART-10/PAY-R6,
so the deletion design must anonymise the actor, not delete ledger history); (c) a public web
deletion resource; (d) the Play Data-safety declaration. **This is a genuine build, not a toggle.**

### 3.3 No iOS release pipeline — **BLOCKER (STORE-03)**

`.github/workflows/mobile-merchant-release.yml` contains exactly one job,
`android-signed-release`. There is **no iOS job at all** — no `macos-latest` runner, no
`xcodebuild`, no `.ipa`, no App Store Connect upload.

CI builds iOS only as `flutter build ios --debug --no-codesign` (`.github/workflows/ci.yml:225`),
which proves compilation and nothing about a signed, submittable artifact.

**Closure:** add a macOS job producing a signed `.ipa` (Apple Distribution certificate, App Store
provisioning profile, exportOptions), plus upload to App Store Connect / TestFlight.
**Owner: human (Apple account, certificates) + engineering.**

## 4. Android signing (STATIC + LOCAL RUNTIME)

Release signing is **fail-closed** and correct:

```
build.gradle.kts:81-88
  gradle.taskGraph.whenReady { if (any task contains "Release" && !releaseSigningReady)
      throw GradleException("Release signing requires LETBUYY_ANDROID_KEYSTORE_PATH,
        LETBUYY_ANDROID_KEY_ALIAS, LETBUYY_ANDROID_KEY_PASSWORD, and
        LETBUYY_ANDROID_STORE_PASSWORD...") }

LOCAL RUNTIME — flutter build apk --release with no signing env -> BUILD FAILED with exactly
that message. It refuses rather than silently debug-signing. This is the right behaviour.
```

The release workflow restores the keystore from `secrets.LETBUYY_ANDROID_KEYSTORE_BASE64`
(`mobile-merchant-release.yml:24-32`) and builds `flutter build appbundle --release
--dart-define-from-file=dart-defines/production.json` (`:53`).

**Required Play signing secrets (names only, none in the repository) — HUMAN-PROVIDED:**
`LETBUYY_ANDROID_KEYSTORE_BASE64`, `LETBUYY_ANDROID_KEYSTORE_PATH`, `LETBUYY_ANDROID_KEY_ALIAS`,
`LETBUYY_ANDROID_KEY_PASSWORD`, `LETBUYY_ANDROID_STORE_PASSWORD`.
Seam of record: `SKIPPED_HUMAN_DECISIONS.md:24`.

## 5. Other release-quality defects found

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| STORE-04 | Android launcher label is the literal string **`store`** — that is the name under the icon on every Android device. | `android/app/src/main/AndroidManifest.xml:5` `android:label="store"` | Blocking for listing quality; **branding decision required (human)** |
| STORE-05 | `minSdk`/`targetSdk`/`compileSdk` are unpinned Flutter defaults. Google Play enforces a rolling `targetSdk` floor for new submissions; an unpinned value makes the submitted level a function of whichever Flutter version CI happened to resolve. | `build.gradle.kts:38,54-55` | Pin before submission |
| STORE-06 | CI resolves Flutter with `channel: stable` and **no version pin** (`ci.yml:137-139`, `:202-204`). A new Flutter stable release changes the toolchain under CI without a commit. This is not hypothetical: Flutter 3.44.8 surfaced a `ListTile`/`DecoratedBox` framework assertion that failed 5 widget tests in this repository (fixed by this program — see doc 09). | `.github/workflows/ci.yml:137-139,202-204`; `mobile-merchant-release.yml:21` uses `${{ env.FLUTTER_CHANNEL }}` | Pin an exact Flutter version for reproducible releases |
| STORE-07 | Crash reporting is **not connected**. `SENTRY_DSN` is the sentinel `SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN` in both `dart-defines/staging.json` and `production.json`; the app then keeps crash reports in a local diagnostics outbox and calls no provider (`dart-defines/README.md`). Shipping to a store with no crash telemetry is a launch risk, not a policy violation. | `dart-defines/production.json`, `staging.json`, `README.md` | Blocking for launch quality |
| STORE-08 | Push notifications are **structurally absent** — no FCM/APNs dependency in `pubspec.yaml`; `MOBILE_PUSH_DEVICE_TOKEN` is a build-time `String.fromEnvironment` constant (`lib/config/app_config.dart:51`) and is empty (`""`) in both dart-define files. Any store listing or marketing copy promising notifications would be false. | `pubspec.yaml`, `app_config.dart:51`, `dart-defines/*.json:11` | Must not be claimed in listing |

## 6. Store listing prerequisites — HUMAN-PROVIDED

None of these exist in the repository and none can be produced by automation.

| # | Item | Both / Apple / Google | Notes |
|---|---|---|---|
| L-1 | Apple Developer Program membership + App Store Connect app record | Apple | Also required for STORE-01/03 |
| L-2 | Google Play Console developer account + app record | Google | |
| L-3 | Play App Signing enrolment + upload key | Google | Pairs with §4 secrets |
| L-4 | Apple Distribution certificate + App Store provisioning profile | Apple | Blocks STORE-03 |
| L-5 | Privacy policy URL — live and reachable | Both | App links `https://letbuyy.com/privacy` (`lib/screens/settings/help_screen.dart:68`); **the page must actually exist and the DNS must resolve** |
| L-6 | Terms of service URL — live and reachable | Both | App links `https://letbuyy.com/terms` (`help_screen.dart:61`) |
| L-7 | Support URL + support contact | Both | |
| L-8 | Account-deletion web resource URL | Google (required), Apple (recommended) | Blocks STORE-02 |
| L-9 | Play **Data safety** form, incl. the data-deletion questions | Google | Depends on STORE-02 |
| L-10 | Apple **App Privacy** ("nutrition label") answers | Apple | Must agree with `PrivacyInfo.xcprivacy` |
| L-11 | Screenshots per required device class, icon, feature graphic, description, category | Both | None in repo |
| L-12 | Content rating questionnaire | Google | |
| L-13 | Export-compliance / encryption answers | Both | App uses HTTPS + Keychain/Keystore |
| L-14 | Internal testing track (Play) / TestFlight group (Apple) with real testers | Both | Pilot prerequisite |
| L-15 | Demo merchant account for store review | Both | Reviewers must be able to sign in; note Turnstile (§7) |

## 7. Review-blocking runtime dependencies

A store reviewer runs the **production** build against **production** infrastructure. The app
cannot pass review while these are unset, regardless of code quality:

| Sentinel present in `dart-defines/production.json` | Consequence at review |
|---|---|
| `RAZORPAY_KEY_ID = SKIP_NEEDS_HUMAN_PRODUCTION_RAZORPAY_KEY_ID` | Payment surfaces cannot function |
| `TURNSTILE_TOKEN = SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN` | Turnstile fails closed → **reviewer cannot log in** → automatic rejection |
| `SENTRY_DSN = SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN` | No crash telemetry (not a rejection, but blind) |

The production endpoints the build targets — `https://bff.letbuyy.com/v1`,
`https://accounts.letbuyy.com`, `https://letbuyy.com` — must be live, DNS-resolving, and serving
before submission. See [`11_INFRA_PROVIDER_AND_ENVIRONMENT_READINESS.md`](11_INFRA_PROVIDER_AND_ENVIRONMENT_READINESS.md).

> The sentinels are **correct engineering** — they are honest, fail-closed placeholders that make
> the missing credential obvious rather than faking success (AGENT-R11, PAY-R10). They are recorded
> here as launch prerequisites, not as defects.

## 8. Submission gate — nothing may be submitted until every row is YES

| # | Gate | State at `ee371182` |
|---|---|---|
| G-1 | `flutter analyze` clean | **YES** — LOCAL RUNTIME, "No issues found!" |
| G-2 | `flutter test` fully green | **YES** — LOCAL RUNTIME, 164/164 (after this program's fix; was 159 with 5 failures) |
| G-3 | Signed Android App Bundle produced by the release workflow | **NO** — signing secrets unprovisioned (§4) |
| G-4 | Signed iOS `.ipa` produced by a release workflow | **NO** — no iOS job exists (STORE-03) |
| G-5 | `PrivacyInfo.xcprivacy` present and accurate | **NO** (STORE-01) |
| G-6 | In-app account deletion + web deletion resource | **NO** (STORE-02) |
| G-7 | Android launcher label is a real product name | **NO** — currently `store` (STORE-04) |
| G-8 | Crash reporting connected | **NO** (STORE-07) |
| G-9 | Production endpoints live and reachable | **NO** — no deployment has occurred; branch lag 291 vs `origin/main` |
| G-10 | Turnstile production keys provisioned | **NO** — reviewer login would fail |
| G-11 | Privacy / Terms / Support URLs live | **NO** — unverified, DNS not cut over |
| G-12 | Store listing assets + Data safety + App Privacy complete | **NO** (L-9…L-12) |
| G-13 | `targetSdk` pinned to a currently-accepted level | **NO** (STORE-05) |
| G-14 | Nothing in the listing claims push notifications | Copy not yet written — constraint recorded (STORE-08) |

**Store-submission verdict: NO-GO.** Two of the fourteen gates are met. G-5, G-6 and G-4 are
genuine engineering builds, not configuration; the rest are human provisioning.
