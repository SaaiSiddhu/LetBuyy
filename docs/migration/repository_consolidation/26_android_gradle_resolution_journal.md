# 26 — Phase R Journal: Android Gradle Resolution and APK Proof

**Execution mode: SINGLE AGENT. Subagents invoked: NO. Agent/Task delegation: NO. Background agents: NO. Parallel worktree agents: NO.**

Repository: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, branch `feature/claude-md-durable-architecture-memory`. One git root, no nested repositories.

## Stage table

| Stage | Title | Verdict | Checkpoint SHA |
|---|---|---|---|
| S0 | Preflight, baseline reconciliation, rollback reference | COMPLETE | (this commit) |
| S1 | Determine empirically which files Gradle evaluates | COMPLETE | (this commit) |
| S2 | The applicationId divergence | COMPLETE | (this commit) |
| S3 | Delete the dead duplicates | COMPLETE | `25ad34fa` (customer_app), `e48d9cf1` (admin_app) |
| S4 | Align the toolchain | COMPLETE | `ea96a8da` (customer_app), `e8cec53e` (admin_app) |
| S5 | The stray gradle.properties, and a real APK | COMPLETE | `60d607d9` |
| S6 | Verification | COMPLETE — 3 disclosed findings (below) | `dd6b8943` |
| S7 | Documentation | PENDING | |

---

## S0 — Preflight, baseline reconciliation, rollback reference

### Baseline reconciliation

CTO baseline: `HEAD 27553d81  changed 40  staged 0  untracked 58  deletions 1`. Gate 105/6. Workspace 20/20. Toolchain Flutter 3.44.8 / Dart 3.12.2.

Measured:
```
HEAD:      27553d81b28c5d710c09a529cf3a6628ec541b9f  (EXACT MATCH)
changed:   40                                          (EXACT MATCH)
staged:    0                                            (EXACT MATCH)
deletions: 1                                            (EXACT MATCH)
untracked: 14 git-status lines  (CTO: 58 — the same recurring directory-line-collapsing counting-method artifact diagnosed in every prior phase's own S0 entry since Phase N; not re-derived here)
```

The one non-docs changed file beyond the known 38-other-session set is confirmed to be exactly what the CTO described: `apps/customer_app/android/gradle.properties` has two uncommitted lines appended by Flutter's own Android migrator during Phase Q's build attempt (`android.builtInKotlin=false`, `android.newDsl=false`), both with a code comment crediting the migrator. Disposition is Stage 5's job.

Journal did not exist — fresh start, not a resume.

### Phase 0's open blocker (re-read before starting)

`01_source_inventory.md` line 24 records: three apps (System A's `marketplace`/`admin`/`seller`, the ancestors of this repo's `customer_app`/`admin_app`) each carry both `build.gradle` (Groovy, syntactically correct, per-app-distinct `applicationId`) and `build.gradle.kts` (byte-identical across all three, **Groovy syntax inside a `.kts` extension** — `apply plugin: 'com.android.application'`, `namespace 'com.letbuyy.letbuyy'` with no `=` — which cannot parse as Kotlin DSL). Phase 0's own words: "I did not run a Gradle build to confirm which file Gradle actually evaluates... out of scope." This phase closes that blocker with a real, empirical test (S1).

### Environment setup

```
$ export ANDROID_HOME="$HOME/Library/Android/sdk"
$ export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
$ flutter doctor -v   (Android toolchain section)
[!] Android toolchain - develop for Android devices (Android SDK version 36.0.0)
    • Android SDK at /Users/saai_siddharth/Library/Android/sdk
    • Emulator version 37.1.11.0 (build_id 15917651) (CL:N/A)
    • Platform android-37.0, build-tools 36.0.0
    • ANDROID_HOME = /Users/saai_siddharth/Library/Android/sdk
    • Java binary at: /opt/homebrew/Cellar/openjdk@17/17.0.20/libexec/openjdk.jdk/Contents/Home/bin/java
    • Java version OpenJDK Runtime Environment Homebrew (build 17.0.20+0)
    ! Some Android licenses not accepted. To resolve this, run: flutter doctor --android-licenses
```

`$ANDROID_HOME/licenses/` already contains `android-sdk-license` and `android-sdk-arm-dbt-license` (accepted). The "some licenses not accepted" warning refers to something beyond these two — not diagnosed further because Phase Q's own build attempt already progressed past SDK setup into real Kotlin compilation with this exact environment state, meaning whatever is unaccepted is not blocking the build path this phase needs. **No license was accepted by this session.** If a later stage's build is genuinely blocked by an unaccepted license, that will be reported explicitly rather than silently resolved.

### Rollback reference — every Gradle file, hash and line count, before any change

| File | Lines | SHA-256 |
|---|---|---|
| `customer_app/android/build.gradle` | 32 | `bdc34030c62a959112e08586b4482fd593ce6cf50311aa054be51773305d20d4` |
| `customer_app/android/build.gradle.kts` | 24 | `6a26dba2cb8dfba1e74f540b0d17a89d96c1301d3c3bfda14348bed257fddcba` |
| `customer_app/android/settings.gradle` | 52 | `1d166138585d6f03b037f041b4de255915a4410798dd587322b05fc718f5d95c` |
| `customer_app/android/settings.gradle.kts` | 52 | `6daf905fb1cef2268bdb5366abb5108a2b55d9a20fc6d1de06bf08fe9b06769e` |
| `customer_app/android/app/build.gradle` | 158 | `e7af5ec9fd3462bd76c9f6d8c84fe2b86ec0a63942a10684a81726145b0d54c5` |
| `customer_app/android/app/build.gradle.kts` | 153 | `a05e109a4d81b1171165f51f9a7dac9f10cd056c7cbc20e618a82ec11659608a` |
| `customer_app/android/app/build.gradle.kts.backup` | 47 | `9312de6baf0d966c0609ca37948a85e2e0a437d63e60434a1735845d86abb23e` |
| `admin_app/android/build.gradle` | 32 | `bdc34030c62a959112e08586b4482fd593ce6cf50311aa054be51773305d20d4` (byte-identical to customer_app's) |
| `admin_app/android/build.gradle.kts` | 24 | `6a26dba2cb8dfba1e74f540b0d17a89d96c1301d3c3bfda14348bed257fddcba` (byte-identical to customer_app's — and merchant_app's) |
| `admin_app/android/settings.gradle` | 41 | `12bf7670bec76f111d4df33536cebe3a8b9ae958d1666cddb95ed6f93bfc9385` |
| `admin_app/android/settings.gradle.kts` | 52 | `6daf905fb1cef2268bdb5366abb5108a2b55d9a20fc6d1de06bf08fe9b06769e` (byte-identical to customer_app's) |
| `admin_app/android/app/build.gradle` | 153 | `131e300a269b12554685553ca7da25eca578521045133aa071d1768edcc52591` |
| `admin_app/android/app/build.gradle.kts` | 153 | `a05e109a4d81b1171165f51f9a7dac9f10cd056c7cbc20e618a82ec11659608a` (**byte-identical to customer_app's app/build.gradle.kts** — literally the same file content, carrying customer_app's identity) |
| `admin_app/android/app/build.gradle.kts.backup` | 47 | `9312de6baf0d966c0609ca37948a85e2e0a437d63e60434a1735845d86abb23e` (byte-identical to customer_app's) |
| `merchant_app/android/build.gradle.kts` | 24 | `6a26dba2cb8dfba1e74f540b0d17a89d96c1301d3c3bfda14348bed257fddcba` (byte-identical to the other two apps' root `build.gradle.kts` — template lineage, not app-specific) |
| `merchant_app/android/settings.gradle.kts` | 28 | `ef83a3b123c7c9ab1788519ad6116ccbcb73d5b00f9a7bac6f510b00ad4b2d2c` |
| `merchant_app/android/app/build.gradle.kts` | 97 | `7e2a154aa43226b3418ec0b2d44488a115f77099f2fa40ff6a8b69d709c2584f` |

`merchant_app`'s Gradle tree confirmed clean — only `.kts` files exist, no Groovy duplicates, no `.backup`.

### Identity values recorded from every app-level file

| File | namespace | applicationId |
|---|---|---|
| `customer_app/android/app/build.gradle` | `com.letbuyy.letbuyy` | `com.letbuyy.letbuyy` |
| `customer_app/android/app/build.gradle.kts` | `com.letbuyy.letbuyy` | `com.letbuyy.letbuyy` |
| `customer_app/android/app/build.gradle.kts.backup` | `com.agrimate.agrimate` | `com.agrimate.agrimate` |
| `admin_app/android/app/build.gradle` | `com.letbuyy.letbuyy` | `com.letbuyy.admin` |
| `admin_app/android/app/build.gradle.kts` | `com.letbuyy.letbuyy` | `com.letbuyy.letbuyy` |
| `admin_app/android/app/build.gradle.kts.backup` | `com.agrimate.agrimate` | `com.agrimate.agrimate` |
| `merchant_app/android/app/build.gradle.kts` | `com.letbuyy.store` | `com.letbuyy.store` (noted, out of scope — merchant_app's Gradle tree is not duplicated and not part of this phase's deletion work) |

Both apps' `.gradle`/`.kts` pairs agree on `namespace` (`com.letbuyy.letbuyy` for both apps — see below for why this is correct for admin_app too, not a bug). They **disagree on `applicationId`** only for admin_app: `com.letbuyy.admin` (`.gradle`) vs `com.letbuyy.letbuyy` (`.kts`, byte-identical to customer_app's own file — a mis-copy, not an independent value).

### Stage 2.2/2.3 evidence gathered early (co-located here since it required no Stage-1-gated action, only reading)

**admin_app's real Kotlin source package matches `com.letbuyy.letbuyy`, not `com.letbuyy.admin`:**
```
$ find apps/admin_app/android/app/src/main -iname "MainActivity*"
apps/admin_app/android/app/src/main/kotlin/com/letbuyy/letbuyy/MainActivity.kt
```
This is the **same physical package path** as `customer_app`'s own `MainActivity.kt`. Since Gradle's `namespace` must match the actual Kotlin/Java package directory for `R`/`BuildConfig` class generation to resolve, `namespace 'com.letbuyy.letbuyy'` in **both** admin_app Gradle files is correct relative to the real source tree — not a bug, and not something Stage 2 should "fix" to `com.letbuyy.admin` (doing so would break compilation unless the source directory were also physically moved, which is out of this phase's scope). `namespace` and `applicationId` legitimately differing here is intentional Flutter/Android scaffolding behavior (the app's package identity for the Play Store, controlled by `applicationId`, is independent of its Kotlin package structure, controlled by `namespace`).

**`com.letbuyy.admin` is the correct `applicationId` for admin_app — confirmed via the app's own live Firebase registration, not guessed:**
```
$ python3 -c "... read apps/admin_app/android/app/google-services.json ..."
1:468123057306:android:efd958435543696f187323  ->  com.letbuyy.admin
1:468123057306:android:f55c2dd42bf34cae187323  ->  com.letbuyy.letbuyy
1:468123057306:android:eb93b2548cba39c6187323  ->  com.letbuyy.seller

$ grep -A5 "static const FirebaseOptions android" apps/admin_app/lib/firebase_options.dart
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyC4yrYvhINIP07b4EBadEs_R-T77z-rPvo',
    appId: '1:468123057306:android:efd958435543696f187323',   <-- matches the com.letbuyy.admin client, exactly
    ...
```
The Dart-side `firebase_options.dart` that admin_app actually compiles and runs against references the Firebase Android client registered for `com.letbuyy.admin`, not `com.letbuyy.letbuyy`. If admin_app were ever built with `applicationId "com.letbuyy.letbuyy"` (the `.kts` file's value), the running app's package name would not match any of its own `appId`'s registered client, which is the class of mismatch that causes Firebase initialization failures or misrouted registrations at runtime. **`com.letbuyy.admin` (in `build.gradle`) is correct. `com.letbuyy.letbuyy` (in `build.gradle.kts`) is a mis-copy from the customer_app template — this is independently supported by both the Firebase-registration evidence above and the Stage 1 syntactic evidence that `.kts` is dead (Groovy syntax cannot parse as Kotlin DSL).** Stage 1's empirical Gradle-evaluation test is still required before any file is touched.

**S0 verdict: COMPLETE.**

---

## S1 — Determine empirically which files Gradle evaluates

Method: inserted a distinctive, self-identifying `println` as the first statement of every root- and app-level Gradle candidate file (Groovy: `println "..."`; Kotlin: `println("...")`), ran a strictly read-only Gradle task (`./gradlew --dry-run help`) from each app's `android/` directory, captured full output, then removed every marker and verified every file's SHA-256 against the Stage 0 rollback reference to confirm byte-identical restoration.

**Settings-level files were NOT marker-injected** — a first attempt to prepend a marker to `customer_app/android/settings.gradle` broke the build (`pluginManagement {} block must appear before any other statements`, a real Gradle ordering rule my naive line-1 insertion violated) — this was my own mistake, immediately disclosed, reverted, and not repeated. Settings-level resolution was instead proven via the **existing, unambiguous divergence already present in both files' own content** — `settings.gradle`'s `plugins {}` block declares `com.android.application` at a different version than `settings.gradle.kts`'s (`8.9.1` vs `8.7.3` for both apps), and Gradle's own diagnostic output names the exact AGP version it is actually using.

### customer_app — full command and output

```
$ export ANDROID_HOME="$HOME/Library/Android/sdk"
$ export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
$ cd apps/customer_app/android && ./gradlew --dry-run help

> Configure project :app
PHASE_R_MARKER: customer_app APP build.gradle (Groovy) IS LIVE
...
Both build.gradle and build.gradle.kts exist, so
build.gradle.kts is ignored. This is likely a mistake.
...
Warning: Flutter support for your project's Android Gradle Plugin version (Android Gradle Plugin version 8.9.1) will soon be dropped.
...
Potential fix: Your project's AGP version is typically defined in the plugins block of the `settings.gradle` file (.../apps/customer_app/android/settings.gradle), by a plugin with the id of com.android.application.
...
> Configure project :
PHASE_R_MARKER: customer_app ROOT build.gradle (Groovy) IS LIVE
:help SKIPPED

BUILD SUCCESSFUL in 5s
4 actionable tasks: 4 up-to-date
```

The `app/build.gradle.kts` and root `build.gradle.kts` markers **never appeared anywhere in the output**, at any verbosity level captured.

### admin_app — full command and output (identical pattern)

```
$ cd apps/admin_app/android && ./gradlew --dry-run help

> Configure project :app
PHASE_R_MARKER: admin_app APP build.gradle (Groovy) IS LIVE
...
Both build.gradle and build.gradle.kts exist, so
build.gradle.kts is ignored. This is likely a mistake.
...
Warning: Flutter support for your project's Android Gradle Plugin version (Android Gradle Plugin version 8.9.1) will soon be dropped.
...
Potential fix: ...the plugins block of the `settings.gradle` file (.../apps/admin_app/android/settings.gradle)...
...
> Configure project :
PHASE_R_MARKER: admin_app ROOT build.gradle (Groovy) IS LIVE
:help SKIPPED

BUILD SUCCESSFUL in 1s
4 actionable tasks: 4 up-to-date
```

Same result: both `.kts` markers never printed.

### Verdicts (identical for both apps)

| File | Verdict | Evidence |
|---|---|---|
| `android/settings.gradle` (Groovy) | **LIVE** | Gradle's own reported AGP version (`8.9.1`) matches this file's `plugins{}` block exactly, not `.kts`'s (`8.7.3`); Gradle's "potential fix" text explicitly names this file's path as the place the live AGP version is defined |
| `android/settings.gradle.kts` (Kotlin) | **DEAD** | Its distinct AGP value (`8.7.3`) never appears in any resolved-version warning; never named by Gradle's own diagnostics |
| `android/build.gradle` (Groovy, root) | **LIVE** | Its injected marker printed under `> Configure project :` |
| `android/build.gradle.kts` (Kotlin, root) | **DEAD** | Its injected marker never printed anywhere |
| `android/app/build.gradle` (Groovy) | **LIVE** | Its injected marker printed under `> Configure project :app`; Gradle explicitly confirms this in its own words |
| `android/app/build.gradle.kts` (Kotlin) | **DEAD** | Its injected marker never printed; Gradle's own diagnostic states outright: **"Both build.gradle and build.gradle.kts exist, so build.gradle.kts is ignored. This is likely a mistake."** — Gradle names the exact behavior itself, unprompted |

This closes Phase 0's open blocker (`01_source_inventory.md` line 24: "I did not run a Gradle build to confirm which file Gradle actually evaluates... out of scope") with direct empirical proof, not inference from syntax alone — although the syntax evidence (Stage 0: `app/build.gradle.kts` opens with `apply plugin: 'com.android.application'`, invalid Kotlin DSL syntax) independently pointed the same direction and is corroborating, not contradicting.

**Correction to the CTO's own stated baseline, found as a side effect of this proof:** the brief states "customer_app Gradle 8.12 · AGP 8.7.3 · Kotlin 2.1.0" and "admin_app Gradle 8.12 · AGP 8.9.1 · Kotlin 2.1.0" — customer_app's AGP figure (`8.7.3`) was read from the **dead** `settings.gradle.kts`, not the live `settings.gradle` (which is `8.9.1`, identical to admin_app's already-correct figure). The real, live AGP version for **both** apps is `8.9.1`, not `8.7.3` for customer_app. This is exactly the kind of measurement-over-assumption correction Stage 4.1 anticipates — noted here since it surfaced one stage early, during Stage 1's own proof.

**Restoration confirmed**: every marker was removed and every touched file's SHA-256 re-verified against the Stage 0 rollback-reference table — all six customer_app files and four admin_app files are byte-identical to their pre-Stage-1 state. `git status` on both apps' `android/` trees shows only the already-known, pre-existing `gradle.properties` diff.

**S1 verdict: COMPLETE. Every candidate file has a verdict backed by real Gradle output, for both apps independently. Phase 0's blocker closed.**

---

## S2 — The applicationId divergence

### 2.1 — Full table (from S0, reproduced here for the record)

| App | File | namespace | applicationId |
|---|---|---|---|
| customer_app | `app/build.gradle` (LIVE) | `com.letbuyy.letbuyy` | `com.letbuyy.letbuyy` |
| customer_app | `app/build.gradle.kts` (DEAD) | `com.letbuyy.letbuyy` | `com.letbuyy.letbuyy` |
| customer_app | `app/build.gradle.kts.backup` (dead by definition) | `com.agrimate.agrimate` | `com.agrimate.agrimate` |
| admin_app | `app/build.gradle` (LIVE) | `com.letbuyy.letbuyy` | **`com.letbuyy.admin`** |
| admin_app | `app/build.gradle.kts` (DEAD) | `com.letbuyy.letbuyy` | **`com.letbuyy.letbuyy`** |
| admin_app | `app/build.gradle.kts.backup` (dead by definition) | `com.agrimate.agrimate` | `com.agrimate.agrimate` |

Only admin_app has a real `applicationId` divergence between its two live-candidate files (customer_app's `.gradle`/`.kts` pair agree with each other, byte-for-byte identical in the fields that matter).

### 2.2 — Which value is correct for admin_app: three independent sources agree

1. **Firebase client registration** (decisive, from S0): `apps/admin_app/lib/firebase_options.dart`'s live Android config declares `appId: '1:468123057306:android:efd958435543696f187323'`. Cross-referencing `apps/admin_app/android/app/google-services.json`'s `client[].client_info` array (read via `python3 -c "import json; ..."`, mapping every `mobilesdk_app_id` to its `package_name`) shows this exact `appId` is registered to `package_name: "com.letbuyy.admin"` — not `com.letbuyy.letbuyy` (which has its own, different, registered `appId` in the same file). The app's own compiled-in Firebase configuration only matches one of the two candidate `applicationId` values.
2. **Physical Kotlin source path**: `apps/admin_app/android/app/src/main/kotlin/com/letbuyy/letbuyy/MainActivity.kt` — the real source tree sits under `com/letbuyy/letbuyy`, matching `namespace 'com.letbuyy.letbuyy'` (present, correctly, in **both** the live and dead file) and confirming `namespace` is unrelated to which `applicationId` is correct; it is a compile-path concern, not a Play Store identity concern. `customer_app/android/app/src/main/kotlin/com/letbuyy/letbuyy/MainActivity.kt` sits at the identical path — the same shared-template scaffolding, symmetric between both apps.
3. **The app's own README, written by a prior phase** — `apps/admin_app/README.md:1-6`, quoted in full:
   > `# apps/admin_app`
   >
   > Platform-operator mobile app. `applicationId` `com.letbuyy.admin` (note: the Android `namespace` field still reads `com.letbuyy.letbuyy`, a leftover from the shared Flutter template this app, `marketplace`, and `seller` were all scaffolded from — recorded, not changed, by this move).

   This is a **pre-existing, already-documented decision from an earlier phase**, not new information — it independently confirms both halves of this stage's conclusion: `com.letbuyy.admin` is correct, and `namespace` staying `com.letbuyy.letbuyy` is intentional, already recorded, not a bug to fix now.

**Conclusion**: `com.letbuyy.admin` (found only in the LIVE `app/build.gradle`) is the correct `applicationId`. `com.letbuyy.letbuyy` (found only in the DEAD `app/build.gradle.kts`, byte-identical to customer_app's own file — confirming it is a mis-copy, not an independently-chosen value) is wrong. Three independent sources agree; none conflict. This is not the "two non-identical values both plausibly identify a real registered application" stop condition — one value has a real Firebase registration and a documented provenance note behind it, the other has neither.

### 2.3 — namespace vs applicationId: legitimate divergence, not touched

`namespace` and `applicationId` are two different Gradle/AGP concerns — `namespace` controls where the generated `R`/`BuildConfig` Java/Kotlin classes resolve (must match the physical package directory), `applicationId` controls the Play Store / installed-package identity (can be anything). admin_app's `namespace 'com.letbuyy.letbuyy'` correctly matches its physical `kotlin/com/letbuyy/letbuyy/` source directory — changing it to `com.letbuyy.admin` without also physically moving every Kotlin file to a new package directory would break compilation. The app's own README already documents this as a known, accepted leftover. **Not touched, per that prior decision and this stage's own confirming evidence.**

**S2 verdict: COMPLETE. admin_app's applicationId divergence resolved with three independent, agreeing evidence sources — no blocker, no ambiguity.**

---

## S3 — Delete the dead duplicates

Every file below carries an S1-proven DEAD verdict (the three `.kts` files per app) or is dead by definition (`.backup`, evaluated by nothing). Deleted one at a time, with an explicit literal absolute path (`rm /full/path/to/file` — no variables, no wildcards, no `find -delete`), each preceded by a recorded hash/line-count/identity snapshot and followed immediately by a fresh `./gradlew --dry-run help` run plus a re-read of the surviving live `app/build.gradle`'s `applicationId`, asserted against the Stage 0 record.

### customer_app (4 files, in deletion order)

| File | Lines | SHA-256 (matched Stage 0 record before deletion) | namespace / applicationId (pre-deletion) |
|---|---|---|---|
| `app/build.gradle.kts` | 153 | `a05e109a4d81b1171165f51f9a7dac9f10cd056c7cbc20e618a82ec11659608a` | `com.letbuyy.letbuyy` / `com.letbuyy.letbuyy` |
| `build.gradle.kts` (root) | 24 | `6a26dba2cb8dfba1e74f540b0d17a89d96c1301d3c3bfda14348bed257fddcba` | n/a (no identity fields) |
| `settings.gradle.kts` | 52 | `6daf905fb1cef2268bdb5366abb5108a2b55d9a20fc6d1de06bf08fe9b06769e` | n/a |
| `app/build.gradle.kts.backup` | 47 | `9312de6baf0d966c0609ca37948a85e2e0a437d63e60434a1735845d86abb23e` | `com.agrimate.agrimate` / `com.agrimate.agrimate` |

After each of the 4 deletions: `./gradlew --dry-run help` → `BUILD SUCCESSFUL in 1s, 4 actionable tasks: 4 up-to-date` every time. `app/build.gradle`'s `applicationId "com.letbuyy.letbuyy"` re-read and confirmed unchanged after every single deletion — never differed from the Stage 0 record at any point. `app/build.gradle`'s own SHA-256 also re-verified unchanged (`e7af5ec9...`) after the root `build.gradle.kts` deletion, as an extra check.

Final state: exactly one Gradle file per level survives — `build.gradle` (root), `settings.gradle`, `app/build.gradle`.

### admin_app (4 files, in deletion order — `app/build.gradle.kts` first, since it is the file carrying the wrong, customer_app identity and the highest-priority deletion)

| File | Lines | SHA-256 (matched Stage 0 record before deletion) | namespace / applicationId (pre-deletion) |
|---|---|---|---|
| `app/build.gradle.kts` | 153 | `a05e109a4d81b1171165f51f9a7dac9f10cd056c7cbc20e618a82ec11659608a` (byte-identical to customer_app's own file) | `com.letbuyy.letbuyy` / **`com.letbuyy.letbuyy`** (the wrong value) |
| `build.gradle.kts` (root) | 24 | `6a26dba2cb8dfba1e74f540b0d17a89d96c1301d3c3bfda14348bed257fddcba` | n/a |
| `settings.gradle.kts` | 52 | `6daf905fb1cef2268bdb5366abb5108a2b55d9a20fc6d1de06bf08fe9b06769e` | n/a |
| `app/build.gradle.kts.backup` | 47 | `9312de6baf0d966c0609ca37948a85e2e0a437d63e60434a1735845d86abb23e` | `com.agrimate.agrimate` / `com.agrimate.agrimate` |

After deleting `app/build.gradle.kts` — the dangerous file — both apps were re-checked (not just admin_app): admin_app's surviving `app/build.gradle` reads `applicationId "com.letbuyy.admin"` (correct), and customer_app's own `app/build.gradle` was independently re-read in the same command and still reads `applicationId "com.letbuyy.letbuyy"` (unaffected, as expected — these are separate Gradle projects — but checked anyway given the stakes). After all 4 deletions: `BUILD SUCCESSFUL` every time, `applicationId` confirmed `com.letbuyy.admin` throughout, never `com.letbuyy.letbuyy`.

Final state: exactly one Gradle file per level survives — `build.gradle` (root), `settings.gradle`, `app/build.gradle`.

### Final identity confirmation, both apps, after all 8 deletions

```
$ grep -n 'applicationId "com' apps/admin_app/android/app/build.gradle
32:        applicationId "com.letbuyy.admin"
$ grep -n 'applicationId "com' apps/customer_app/android/app/build.gradle
32:        applicationId "com.letbuyy.letbuyy"
```

**S3 verdict: COMPLETE. All 8 dead files deleted (4 per app), each individually recorded and each followed by a real Gradle configuration success plus an applicationId assertion. Neither app's identity ever moved from its Stage 0 recorded value at any point during deletion.**

---

## S4 — Align the toolchain

### 4.1 — Is merchant_app's version set genuinely proven?

```
$ cd apps/merchant_app && flutter build apk --debug
...
Running Gradle task 'assembleDebug'...                             88.3s
✓ Built build/app/outputs/flutter-apk/app-debug.apk
```

**Yes — genuinely proven, not assumed.** `apps/merchant_app/build/app/outputs/flutter-apk/app-debug.apk`, 179 MB. Confirmed its real live versions directly from source (not trusted from the CTO's brief): `gradle-wrapper.properties` → Gradle **8.14**; `settings.gradle.kts` plugins block → AGP **8.11.1**, Kotlin **2.2.20**. Exact match to the CTO's stated figures — this is the one app in the whole brief whose baseline figures needed no correction. merchant_app has no Gradle duplication (only `.kts` files exist), so there is no live/dead ambiguity to resolve here.

### 4.2/4.3 — customer_app: one variable at a time

First re-confirmed the Phase Q failure still reproduces on the current (post-S3, pre-alignment) tree:
```
$ cd apps/customer_app && flutter build apk --debug
...
e: .../jetified-android-maps-utils-4.1.0-api.jar!/META-INF/library_release.kotlin_module Module was compiled with an incompatible version of Kotlin. The binary version of its metadata is 2.3.0, expected version is 2.1.0.
...
Execution failed for task ':google_maps_flutter_android:compileDebugKotlin'.
BUILD FAILED in 18s
```
Identical failure to Phase Q's. Flutter's own "Fix" hint now correctly names the live `settings.gradle` (not a dead `.kts`) as the place to change the Kotlin version — confirming S3's deletions didn't disturb anything.

Changed one variable at a time, rebuilding after each:

| Step | Change | Result |
|---|---|---|
| 1 | `gradle-wrapper.properties`: `8.12` → `8.14` (AGP/Kotlin untouched) | Same failure — identical `google_maps_flutter_android:compileDebugKotlin` error, `BUILD FAILED in 39s` |
| 2 | `settings.gradle` plugins block: AGP `8.9.1` → `8.11.1` (Kotlin still `2.1.0`) | Same failure again, `BUILD FAILED in 20s` |
| 3 | `settings.gradle` plugins block: Kotlin `2.1.0` → `2.2.20` | **`✓ Built build/app/outputs/flutter-apk/app-debug.apk`** — fixed |

**The Kotlin plugin version was the actual cause** — Gradle/AGP version alone never touched it; both intermediate builds failed with the byte-identical Kotlin-metadata-mismatch error. This lands exactly on the full merchant_app-matching set (Gradle 8.14/AGP 8.11.1/Kotlin 2.2.20); no smaller subset was tested in isolation (only cumulatively), so this is reported as "the full merchant_app set works," not "the provably-minimal fix" — the brief's own stop condition ("if the mismatch resolves before you reach the full merchant_app set, STOP there") did not trigger, since it resolved only once all three matched merchant_app.

Root `build.gradle`'s own `ext.kotlin_version = '2.1.0'` (buildscript-block, old style) was **left unchanged** and the build still succeeded — confirming (consistent with S1's own finding) that `settings.gradle`'s `plugins{}` block, not the old buildscript classpath declaration, is what Gradle actually resolves the applied Kotlin/AGP version from. A residual, cosmetic "Kotlin version (2.1.0) will soon be dropped" warning still appears post-fix — this reads `ext.kotlin_version`, a value this stage deliberately left untouched since changing it is not necessary for the build to succeed and touching more than needed increases risk for no benefit.

**Strongest possible identity verification** — read the actual compiled APK's embedded manifest (not source config) via `aapt dump badging`:
```
$ aapt dump badging apps/customer_app/build/app/outputs/flutter-apk/app-debug.apk
package: name='com.letbuyy.letbuyy' versionCode='4013' versionName='1.0.10-debug' ...
```
`com.letbuyy.letbuyy`, exactly as required. APK: `apps/customer_app/build/app/outputs/flutter-apk/app-debug.apk`, 240 MB.

### 4.4 — admin_app: did it even need the fix?

`google_maps_flutter` is declared only by `customer_app` (confirmed: `grep -n "google_maps_flutter" apps/admin_app/pubspec.yaml apps/customer_app/pubspec.yaml` → one hit, customer_app only). Tested admin_app's build **before** touching its toolchain at all:
```
$ cd apps/admin_app && flutter build apk --debug
...
Warning: Flutter support for your project's Gradle version (8.12.0) will soon be dropped...
Warning: Flutter support for your project's Android Gradle Plugin version (8.9.1) will soon be dropped...
Warning: Flutter support for your project's Kotlin version (2.1.0) will soon be dropped...
Running Gradle task 'assembleDebug'...                             37.9s
✓ Built build/app/outputs/flutter-apk/app-debug.apk
```
**admin_app already built successfully on its unaligned toolchain** — it has no dependency that triggers the Kotlin-metadata mismatch. `aapt dump badging` on this pre-alignment APK confirmed `package: name='com.letbuyy.admin' versionCode='1' versionName='1.0.0-debug'`.

Aligned anyway, per Stage 4.1's explicit instruction ("you should align the other two apps to it") — this is a proactive consistency/future-proofing change, not a bug fix, and is reported as such rather than implying admin_app was broken. Applied the full proven set directly (Gradle 8.14, AGP 8.11.1, Kotlin 2.2.20) rather than repeating the one-variable-at-a-time diagnostic (already established the causal variable via customer_app; admin_app has no failure symptom to diagnose). Rebuilt to confirm the alignment itself introduced no regression:
```
$ cd apps/admin_app && flutter build apk --debug
...
✓ Built build/app/outputs/flutter-apk/app-debug.apk
$ aapt dump badging apps/admin_app/build/app/outputs/flutter-apk/app-debug.apk
package: name='com.letbuyy.admin' versionCode='1' versionName='1.0.0-debug' ...
```
Identity, versionCode and versionName all unchanged after alignment. APK: `apps/admin_app/build/app/outputs/flutter-apk/app-debug.apk`, 240 MB (up from 231 MB pre-alignment — larger due to full recompilation against the newer Kotlin/AGP versions, not a functional concern).

### Side effect noted for Stage 5: gradle.properties auto-modified again

Both admin_app build attempts (before AND after alignment) printed `Upgrading gradle.properties` — Flutter's Android migrator added the same two lines (`android.builtInKotlin=false`, `android.newDsl=false`) to `apps/admin_app/android/gradle.properties` that it already added to `customer_app`'s during Phase Q. This is systematic Flutter tooling behavior triggered by any build attempt on this Gradle/AGP generation, not something this session did deliberately. Both files' disposition is decided together in S5.

### Scope discipline

`git diff 27553d81..HEAD --name-only -- '*pubspec.yaml'` → **empty**. Zero Dart/Flutter package versions changed, anywhere, this entire phase.

**S4 verdict: COMPLETE. customer_app required all three toolchain changes to build (Kotlin was the actual cause, confirmed by isolating each variable); admin_app never needed them but was aligned per instruction, with its pre- and post-alignment builds both independently verified successful and identity-unchanged.**

---

## S5 — The stray gradle.properties, and a real APK

### 5.1 — gradle.properties disposition: tested, not assumed

`apps/customer_app/android/gradle.properties` carried 2 uncommitted lines (`android.builtInKotlin=false`, `android.newDsl=false`) since Phase Q. During this phase's own build attempts, the identical 2 lines were auto-added to `apps/admin_app/android/gradle.properties` too — the same Flutter Android migrator behavior, triggered fresh.

Tested whether they're actually necessary: reverted customer_app's file to its true committed (flag-less) state via `git show HEAD:apps/customer_app/android/gradle.properties > apps/customer_app/android/gradle.properties`, then ran `flutter build apk --debug` again. Result: build succeeded (`✓ Built build/app/outputs/flutter-apk/app-debug.apk`), but the build's own output printed `Upgrading gradle.properties` **twice** and silently re-added the identical two lines during that very build. This is decisive: the flags are not an optional, one-time artifact — Flutter's own tooling unconditionally rewrites them on every `flutter build` invocation for this SDK/AGP generation, regardless of the file's starting state. Restoring the file (`git show HEAD:<path> > <path>`) would be pointless — the very next build reintroduces the same two lines. Leaving it permanently uncommitted is worse (permanent, recurring working-tree drift for the same reason). **Committed both files** (`60d607d9`), each with an explanation citing this exact test.

### 5.2 — Real APK build, all three apps, final committed state

```
$ cd apps/merchant_app && flutter build apk --debug   # exit code 0
Running Gradle task 'assembleDebug'...                             15.4s
✓ Built build/app/outputs/flutter-apk/app-debug.apk

$ cd apps/customer_app && flutter build apk --debug   # exit code 0
Running Gradle task 'assembleDebug'...                              3.8s
✓ Built build/app/outputs/flutter-apk/app-debug.apk

$ cd apps/admin_app && flutter build apk --debug      # exit code 0
Running Gradle task 'assembleDebug'...                              3.5s
✓ Built build/app/outputs/flutter-apk/app-debug.apk
```

| App | APK path | Size | `aapt dump badging` (first line) |
|---|---|---|---|
| merchant_app | `apps/merchant_app/build/app/outputs/flutter-apk/app-debug.apk` | 179 MB (187,660,205 bytes) | `package: name='com.letbuyy.store' versionCode='1' versionName='1.0.0'` |
| customer_app | `apps/customer_app/build/app/outputs/flutter-apk/app-debug.apk` | 240 MB (240,828,129 bytes) | `package: name='com.letbuyy.letbuyy' versionCode='4013' versionName='1.0.10-debug'` |
| admin_app | `apps/admin_app/build/app/outputs/flutter-apk/app-debug.apk` | 231 MB (241,996,811 bytes) | `package: name='com.letbuyy.admin' versionCode='1' versionName='1.0.0-debug'` |

No release build was attempted. No signing occurred (all three are debug builds, using debug keystores per each project's own configuration — untouched by this phase). No `.jks`/`.keystore`/`key.properties`/`google-services.json`/`GoogleService-Info.plist`/`firebase_options.dart` file was read for writing, moved, renamed or modified; `google-services.json` and `firebase_options.dart` were only **read** (S2's identity investigation).

**S5 verdict: COMPLETE. gradle.properties committed with tested justification. All three apps produce a real debug APK, all three identities verified correct via the compiled artifact itself, not source config.**

---

## S6 — Verification

### 6.1 — Play Store identity, asserted not assumed

| Field | customer_app | admin_app |
|---|---|---|
| `applicationId` (compiled APK, `aapt dump badging`) | `com.letbuyy.letbuyy` ✓ | `com.letbuyy.admin` ✓ |
| `signingConfigs` block in `app/build.gradle` | byte-identical to `27553d81` (diff empty) | byte-identical to `27553d81` (diff empty) |
| `key.properties` | untouched — mtime **Dec 14, 2025**, predates this entire session by ~8.5 months (content-blind check, see disclosed incident below) | untouched — mtime **Dec 13, 2025** (content-blind check) |
| `AndroidManifest.xml` (deep-link intent filters + everything else) | byte-identical to `27553d81` (diff empty) | byte-identical to `27553d81` (diff empty) |
| `google-services.json` | hash-identical to `27553d81` | hash-identical to `27553d81` |
| `firebase_options.dart` | hash-identical to `27553d81` | hash-identical to `27553d81` |
| `versionCode`/`versionName` (pubspec.yaml `version:` vs. compiled APK) | `1.0.10+4013` → APK reports `versionCode='4013' versionName='1.0.10-debug'` (`-debug` is the standard Flutter debug-build suffix, not a version change) — matches | `1.0.0+1` → APK reports `versionCode='1' versionName='1.0.0-debug'` — matches |

**Disclosed incident: a secret value was displayed in tool output.** While diffing `customer_app/android/key.properties` against its (nonexistent, since the file was never git-tracked) committed counterpart, `git show` returned empty and the resulting `diff` rendered the **entire file content as "added"** — printing `storePassword=letbuyy123`, `keyPassword=letbuyy123`, `keyAlias=letbuyy`, `storeFile=key.jks` directly into this session's tool output. This is customer_app's **real release-signing keystore password**, not a dead or already-public value like prior incidents earlier in this engagement — the most sensitive class of value this whole phase exists to protect. Disclosed immediately, not minimized. The file itself was never written, modified, deleted, renamed, or read for any purpose other than this one accidental display — confirmed by its mtime (Dec 14, 2025, ~8.5 months before this session) and by a follow-up content-blind hash check. No keytool command was ever run, no signing occurred, no release build was attempted. Switched to strictly content-blind verification (mtime + SHA-256 only, never full-content diff) for every remaining credential-adjacent file this stage, including admin_app's own `key.properties`.

### 6.2 — Workspace resolution

```
$ flutter pub get
Got dependencies!
```
20/20 members (unchanged workspace declaration, `pubspec.yaml`'s `workspace:` list).

### 6.3 — Full regression sweep

| Suite | Result |
|---|---|
| merchant_app (canary) | **172/172 PASS** |
| marketplace_core | 165/165 PASS |
| marketplace_ui_kit | 54/54 PASS |
| customer_app | 13/13 PASS |
| admin_app | 11/11 PASS |

415/415 total, unchanged from baseline.

### 6.4 — `flutter analyze`, all 15 packages and all 5 apps

All 15 `packages/dart` members: **clean** (`No issues found!`, individually confirmed for each). `customer_app`, `admin_app`: **clean**. `phase_2/rider_app`, `phase_2/store_ops_app`: 1 pre-existing error each (`test/widget_test.dart`'s dead `MyApp` boilerplate) — expected, untouched, matches every prior phase's baseline exactly.

**Disclosed finding, not previously checked by any prior phase's own acceptance bar: `merchant_app` shows 80 analyze issues (55 info, 25 warning, 0 error).** Confirmed via `git diff 27553d81..HEAD --name-only -- apps/merchant_app/lib apps/merchant_app/test` returning **empty** that this phase touched zero Dart/lib files in merchant_app — these 80 issues are entirely pre-existing (deprecated Flutter API usage such as `activeColor`→`activeThumbColor`, `value`→`initialValue`, one unused local variable in `section_settings_sheet.dart`, plus a deprecated-API note in its own test file). No prior phase's acceptance criteria ever required merchant_app to analyze clean — Phase Q's own bar was "15 packages + **both** apps" (customer_app/admin_app only). This phase's own acceptance criterion #5 ("all 15 packages and five apps analyze clean") is the first time merchant_app has been held to this bar, and it does not meet it. All 80 issues are info/warning severity, zero errors — consistent with merchant_app's own real APK build succeeding cleanly in S4/S5. Reported honestly rather than silently omitted or worked around; not fixed, since editing merchant_app's Dart source is out of this phase's Gradle-only scope.

### 6.5 — Phase Q's Dart compilation probe, re-run

Rebuilt the same style of temporary kernel-compilation-forcing probe used in Phase Q (`apps/customer_app/test/_phase_r_compile_probe_test.dart`, `apps/admin_app/test/_phase_r_compile_probe_test.dart` — importing each app's real entry point plus its font_awesome-importing production files, touching a symbol from each), to confirm this phase's Gradle-layer changes did not disturb Phase Q's Dart-layer font_awesome_flutter fix:
```
customer_app: 00:00 +1: All tests passed!
admin_app:    00:00 +1: All tests passed!
```
Both probe files deleted immediately after; neither is part of any commit.

### 6.6 — Real governance gate

```
$ node scripts/validate-governance.mjs
TOTALS: PASS=105 FAIL=6 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1
- foundation-antifabrication-gate.mjs: FAIL
- validate-design-system.mjs: FAIL
- sequential-migration-validator.mjs: FAIL
- raw-error-message-validator.mjs: FAIL
- environment-validator.mjs: FAIL
- branch-lag-guard-validator.mjs: FAIL
```
**105 PASS / 6 FAIL — exact match to the CTO's stated baseline, same 6 failures by name, zero new failures.**

node_modules hazard confirmed as documented: 0 per-package `node_modules` survived the gate (down from 51). Restored via `pnpm install --frozen-lockfile` (51 restored, 1.9s). `pnpm-lock.yaml` SHA-256 confirmed **byte-identical** before and after (`b4a8038d...`).

**Third disclosed finding: the gate's cleanup sweep is broader than the brief's own documented hazard.** The brief warns only about `node_modules` deletion. Reading `scripts/governance/validator-orchestrator.mjs`'s actual `GENERATED_DIRECTORY_NAMES` set (line 458) shows it also includes `.next`, `.turbo`, `dist`, `.dart_tool`, and **`build`** — meaning the gate run in this stage also deleted every Flutter `build/` directory repo-wide, including the three debug APKs produced in S5. Discovered when a post-gate sanity re-check for this stage's own final report tried to re-read `apps/customer_app/build/app/outputs/flutter-apk/app-debug.apk` and found the entire `build/` directory gone. This is not a Phase R regression — it's inherent, undocumented-by-the-brief behavior of the gate's own existing cleanup logic, triggered by simply running the gate at all, in the sequence this phase's own stages required (build APKs in S5, then run the gate in S6). Corrective action: rebuilt all three APKs one final time, after the gate had already run, so nothing further deletes them. All three rebuilt APKs are **byte-size-identical** to their S5 counterparts (`187660205`/`240828129`/`241996811` bytes respectively — the build is fully reproducible) and `aapt`-reconfirmed with unchanged identities. This is now the final, currently-existing artifact set (see S5's table, values unchanged) — no further gate run is planned after this point in the phase.

### 6.7 — Full `git status` attribution

Every remaining `M`/`D` line (39 total) is the same, already-known, pre-existing other-session file set (`apps/identity-platform/*` ×13, `apps/merchant_web/*` ×13, `packages/typescript/*` ×5, `services/api-gateway/*` ×7, `docs/.../00b_topology_amendment_draft.md` ×1) — none touched, none committed, none reverted, exactly as required. `apps/customer_app/android/gradle.properties` and `apps/admin_app/android/gradle.properties` no longer appear as modified (both committed in S5).

Untracked (`??`) entries: `.agents/`, `database/supabase/migrations/208-210*.sql` + matching rollback files, `database/supabase/supabase/`, `docs/migration/repository_consolidation/09_pre_restructure_build_baseline.md`, two `docs/research/2026-08-16-*/` directories, `docs/research/LETBUYY_CLAUDE_CODE_ARCHITECTURE_RESEARCH_BRIEF.md`, and two `.zip` files. **None of these were created by this session** — this phase never wrote to `.agents/`, `database/`, or `docs/research/`, and every file this phase created is accounted for above (`docs/migration/repository_consolidation/26_...md`, `27_...md` in S7). Attributed as pre-existing, other-session untracked artifacts, consistent with this whole engagement's well-established pattern of concurrent sessions sharing one checkout.

**S6 verdict: COMPLETE. Three findings disclosed (the key.properties display incident; merchant_app's 80 pre-existing analyze issues, newly surfaced by this phase's stricter "all five apps" bar; the gate's undocumented-by-the-brief `build/`-directory sweep, corrected by a final rebuild) — none caused by a Phase R regression, all reported plainly rather than hidden. Every other check passes at or exactly matching baseline.**
