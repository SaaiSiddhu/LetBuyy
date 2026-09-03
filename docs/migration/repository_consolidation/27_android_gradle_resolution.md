# 27 — Android Gradle Resolution and APK Proof (Phase R)

Starting HEAD `4a2217c8148c1c9c0955f60b257945012f3babe7`, final HEAD at commit `df2063c4` and after (see `git log` for the full sequence). Full stage-by-stage evidence, every command and its real output, is in `26_android_gradle_resolution_journal.md` — this document is the reader-facing summary.

## The blocker this phase closes

`01_source_inventory.md` (Phase 0, line 24) found that `customer_app` and `admin_app` each carried two complete Gradle build script trees — `build.gradle`/`settings.gradle`/`app/build.gradle` (Groovy) and `build.gradle.kts`/`settings.gradle.kts`/`app/build.gradle.kts` (nominally Kotlin DSL, but written in Groovy syntax — `apply plugin: 'com.android.application'`, which cannot parse as `.kts`). Phase 0's own words: *"I did not run a Gradle build to confirm which file Gradle actually evaluates... out of scope."* Worse, `admin_app`'s `app/build.gradle.kts` was byte-identical to `customer_app`'s own file — carrying `applicationId "com.letbuyy.letbuyy"`, the **shipped Play Store customer app's identity**, not admin_app's own `com.letbuyy.admin`.

## Stage 1 — which file does Gradle actually evaluate?

Proved empirically, not by inference: inserted a distinctive, self-identifying `println` into every root- and app-level candidate file, ran a strictly read-only `./gradlew --dry-run help`, observed the real output, then removed every marker and re-verified every file's SHA-256 against a pre-recorded rollback reference.

**Result, identical for both apps:** `settings.gradle`, root `build.gradle`, and `app/build.gradle` — all Groovy — are **live**. All three `.kts` counterparts are **dead**. Gradle's own diagnostic output states this outright for the app level, unprompted: *"Both build.gradle and build.gradle.kts exist, so build.gradle.kts is ignored. This is likely a mistake."* For the settings level, the live AGP version Gradle itself reports (`8.9.1`) matches only `settings.gradle`'s declared value, never `settings.gradle.kts`'s (`8.7.3`).

**Side effect**: this also corrected the CTO's own stated baseline — `customer_app`'s real live AGP version is `8.9.1`, not the `8.7.3` the brief stated (which had been read from the dead `.kts` file).

## Stage 2 — the applicationId divergence

Only `admin_app` has a real divergence: `com.letbuyy.admin` (live `build.gradle`) vs. `com.letbuyy.letbuyy` (dead `build.gradle.kts`, a mis-copy of customer_app's own file). Resolved with three independent, agreeing sources:

1. **Firebase client registration** — `firebase_options.dart`'s live Android `appId` maps, via `google-services.json`'s own client list, to exactly the `com.letbuyy.admin` entry, not `com.letbuyy.letbuyy`'s separate one.
2. **Physical Kotlin source path** — `namespace 'com.letbuyy.letbuyy'` (present, correctly, in both files) matches the app's real `kotlin/com/letbuyy/letbuyy/MainActivity.kt` source directory. This is unrelated to `applicationId` and was **not** "fixed" — `namespace` and `applicationId` are legitimately independent Gradle concerns.
3. **The app's own `README.md`**, written by an earlier phase, already documents this exact situation: *"applicationId com.letbuyy.admin (note: the Android namespace field still reads com.letbuyy.letbuyy, a leftover from the shared Flutter template... recorded, not changed, by this move)."*

## Stage 3 — deletion

All 8 dead files (4 per app: root `.kts`, settings `.kts`, app `.kts`, app `.kts.backup`) deleted with an explicit literal path, each preceded by a hash/line-count/identity snapshot and followed by a fresh, successful `./gradlew --dry-run help` plus a re-read of the surviving `applicationId`, asserted unchanged every single time. `app/build.gradle.kts.backup` in both apps carried `com.agrimate.agrimate` — the pre-rename Agrimore lineage identified in Phase 0 — dead by definition, nothing evaluates a `.backup` file.

Both apps now have exactly one Gradle file per level.

## Stage 4 — toolchain alignment

`merchant_app`'s toolchain (Gradle 8.14, AGP 8.11.1, Kotlin 2.2.20) was established as a genuine, evidenced reference by building it first — a real 179 MB APK was produced, not assumed from documentation.

`customer_app` genuinely needed alignment: Phase Q's build failure (`google_maps_flutter_android:compileDebugKotlin`, a Kotlin-metadata mismatch — the plugin's transitive Kotlin stdlib is 2.3.0, the project expected 2.1.0) still reproduced identically on the current tree. Changed one variable at a time, rebuilding after each: Gradle wrapper `8.12→8.14` alone did not fix it; AGP `8.9.1→8.11.1` on top of that did not fix it either; only the final change, Kotlin `2.1.0→2.2.20`, resolved the mismatch. This lands on the full merchant_app-matching set. Root `build.gradle`'s own `ext.kotlin_version = '2.1.0'` (an old-style, separate declaration) was deliberately left untouched — the build succeeds without touching it, confirming `settings.gradle`'s `plugins{}` block, not the buildscript-classpath mechanism, is what Gradle actually resolves the applied version from.

`admin_app` did **not** need this fix — it declares no dependency on `google_maps_flutter` (customer_app-only) and built successfully on its original, unaligned toolchain, verified before any change. Aligned anyway, per this phase's own instruction to bring both apps in line with the one proven reference set — a proactive consistency change, not a bug fix — and rebuilt afterward to confirm zero regression.

Verified via the strongest available evidence for both apps: `aapt dump badging` on the real compiled APK, not source config.

`git diff 4a2217c8..HEAD --name-only -- '*pubspec.yaml'` is **empty** — zero Dart/Flutter package versions changed anywhere in this phase.

## Stage 5 — gradle.properties and real APKs

`apps/customer_app/android/gradle.properties` carried two uncommitted lines (`android.builtInKotlin=false`, `android.newDsl=false`) since Phase Q; the identical two lines were freshly auto-added to `admin_app`'s during this phase's own build attempts. Tested whether they're actually necessary by reverting customer_app's file and rebuilding — the build succeeded, but Flutter's own tooling printed `Upgrading gradle.properties` and silently **re-added the identical two lines during that very build**. This is decisive: it's standard, unconditional, every-build migrator behavior for this SDK/AGP generation, not an optional artifact. Restoring the file would be pointless (the next build reintroduces it); committing was the only disposition that doesn't leave permanent recurring drift.

**Real APK, all three apps, exit code 0 for each:**

| App | Path | Size | Compiled identity (`aapt dump badging`) |
|---|---|---|---|
| merchant_app | `apps/merchant_app/build/app/outputs/flutter-apk/app-debug.apk` | 179 MB | `com.letbuyy.store` v1/1.0.0 |
| customer_app | `apps/customer_app/build/app/outputs/flutter-apk/app-debug.apk` | 240 MB | `com.letbuyy.letbuyy` v4013/1.0.10-debug |
| admin_app | `apps/admin_app/build/app/outputs/flutter-apk/app-debug.apk` | 231 MB | `com.letbuyy.admin` v1/1.0.0-debug |

No release build attempted. No signing occurred (all debug, existing debug keystores untouched). No `.jks`/`.keystore`/`key.properties`/Firebase config file was written, moved, renamed or modified — `google-services.json` and `firebase_options.dart` were only read.

## Stage 6 — verification, and two disclosed findings

Every field of customer_app's Play Store identity — `applicationId`, `signingConfigs` block, `key.properties`, `AndroidManifest.xml` (including deep links), `google-services.json`, `firebase_options.dart`, `versionCode`/`versionName` — confirmed byte-identical or hash-identical to the pre-Phase-R committed state (`4a2217c8`), same for admin_app. Workspace 20/20. Full regression: merchant_app 172/172 (canary), the other 4 suites at exact baseline (415/415 total). All 15 packages + customer_app + admin_app analyze clean; `phase_2` apps retain their 1 pre-existing, untouched error each. Phase Q's Dart compilation probe re-run and still passes for both apps — the Gradle-layer work did not disturb the Dart-layer fix. Governance gate: **105 PASS / 6 FAIL, exact match to baseline, same 6 failures by name, zero new**. node_modules hazard confirmed and restored; `pnpm-lock.yaml` byte-identical before and after. Every `git status` path attributed — the same 39 pre-existing other-session files, plus a handful of untracked artifacts (`.agents/`, migration SQL files, research docs) this session never created or touched.

**Two findings, both disclosed, neither hidden:**

1. **A secret value was displayed in tool output.** A `diff` intended to confirm `customer_app/android/key.properties` was untouched instead printed its full content — including the real release-signing keystore password — because the file (correctly) has no git-tracked counterpart to diff against, so `diff` rendered the whole thing as "added." The file itself was never written, modified, or read for any other purpose (confirmed by its August-2025-predating mtime and a follow-up content-blind hash check). No keytool run, no signing, no release build. Switched to strictly content-blind verification (mtime/hash only) for every remaining credential-adjacent file.
2. **`merchant_app` shows 80 pre-existing `flutter analyze` issues** (55 info, 25 warning, 0 error — deprecated Flutter API usage, one unused variable), never previously checked against this phase's own "all five apps analyze clean" acceptance bar (prior phases only required 2 apps + 15 packages). Confirmed via an empty `git diff` on `apps/merchant_app/lib` and `apps/merchant_app/test` that this phase touched zero files there — entirely pre-existing, unrelated to Gradle/Kotlin/AGP, and consistent with merchant_app's own real APK build succeeding cleanly. Not fixed — out of this phase's Gradle-only scope.

## What is now proven

- All three apps produce a real, working debug APK — `merchant_app`, `customer_app`, `admin_app` — each with exit code 0, each verified via the compiled artifact's own embedded manifest, not source config alone.
- `customer_app`'s Play Store identity (`com.letbuyy.letbuyy`) and every associated field (signing, manifest, Firebase, version) are unchanged from before this phase, at every checkpoint during Gradle-file deletion, not just at the end.
- `admin_app`'s correct identity (`com.letbuyy.admin`) is confirmed by three independent sources and is what its live, surviving Gradle file — and its compiled APK — actually carries. The file that would have shipped it under the wrong (customer_app's) identity is deleted, and was proven dead (never evaluated by Gradle) before deletion.
- Phase 0's "which file does Gradle evaluate" blocker is closed with direct empirical proof.
- The Kotlin-version mismatch Phase Q found and left open is fixed, with the root cause isolated to one specific variable (Kotlin plugin version), not fixed by trial-and-error across all three at once.

## What is still NOT proven

- That either app **runs** correctly on a device or emulator — no `flutter run`, no install, no interactive smoke test was performed. A successful `flutter build apk` proves the build pipeline, not runtime behavior.
- That any screen renders, that Firebase calls succeed at runtime, or that any user flow (checkout, login, admin operations) works.
- That a **release** build succeeds — release builds, signing, and any Play Store upload were explicitly out of scope and never attempted.
- That the two "will soon be dropped" cosmetic warnings referencing `ext.kotlin_version = '2.1.0'` (unchanged, since the build succeeds without touching it) will remain harmless indefinitely — they're currently informational only, not build-blocking, but were not further investigated since doing so was unnecessary to this phase's goal.
- Whether the pre-existing 80 `merchant_app` analyze issues (or the two disclosed findings above) require any follow-up action — recorded, not resolved.

The Play Store identity is the one thing in this repository that cannot be rebuilt. It was checked before, during, and after every risky operation in this phase, and it never moved.
