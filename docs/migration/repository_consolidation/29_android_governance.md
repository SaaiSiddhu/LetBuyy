# 29 — Android Identity Governance (Phase S)

Starting HEAD `72ec82f96c7d94d1fafa8c615e9b57c1d8e6dc72`, final HEAD `a7b24e7e` and after. Full stage-by-stage evidence, every command and its real output, is in `28_android_governance_journal.md` — this document is the reader-facing summary.

## The measurement that opened this phase

```
$ grep -rl "android/\|gradle\|applicationId" scripts/validators/*.mjs | wc -l
0
```

Zero of the 115 validators on disk at the start of this phase referenced Android, Gradle, or `applicationId` in any form. The one asset in this repository that cannot be rebuilt — a shipped Play Store application ID — had no automated protection. Phase R fixed the specific breach by hand, diffing two files. This phase makes the same class of breach a hard gate failure.

## What is now enforced, and what is deliberately not

| Enforced | Not enforced (with reason) |
|---|---|
| `applicationId` matches an independent declaration, per app | `versionCode`/`versionName` — changes every release by design; asserting an exact value would need editing on every release, worse than no check |
| `namespace` matches the same declaration | `signingConfig` structural wiring — the real risk (tracked keystore material) is already covered directly; verifying block *shape* without reading values adds parsing complexity for low incremental signal |
| No duplicate `build.gradle`/`build.gradle.kts` at any level (root, settings, app) | `AndroidManifest.xml` permissions — legitimately grows as features are added; not an invariant |
| No `*.jks`/`*.keystore`/`key.properties` tracked in git (path-only) | |
| Declared `applicationId` is registered as a client in the app's own `google-services.json`, when one exists (added beyond the brief's own "at minimum" list — this exact cross-reference was Phase R's own decisive evidence for resolving admin_app's identity) | |

## Where the declaration lives, and why

`config/governance/android-identity-registry.json` — a new file, **not** a new field on `apps/<app>/runtime.manifest.json`. Both candidates were investigated before choosing:

- `runtime.manifest.json`'s schema (`config/runtime/runtime-manifest.schema.json`, 380 lines) is `"additionalProperties": false` at the top level and is actively enforced by `architecture-validator.mjs` across all 5 runtime manifests in the repo. Adding a structured field would require real schema surgery with blast radius across every runtime, not just the 3 apps this phase cares about — rejected.
- `config/governance/*.json` is the established, precedented home for exactly this kind of ratchet registry (`web-v1-scope-registry.json` plays the same role for a different domain). No external schema constrains it. No other validator scans the directory generically — confirmed by grep, not assumed — so a new file here is invisible to every existing check until deliberately wired.

The registry's values were measured fresh from the live Gradle files at commit time, not transcribed from any prior report. One assumption was caught and corrected before commit: `merchant_app`'s "shipped" status was initially guessed `false` by analogy with `admin_app`'s `debug.keystore` evidence, then corrected to `"unknown"` after checking merchant_app's actual signing setup — a different, environment-variable-driven `releaseKeystorePath` mechanism with no `key.properties` file at all. Recorded honestly as unverified rather than guessed.

## Stage 4 — anti-theatre controls

A validator that has never been observed to fail is not evidence of anything. Four controls, each: induce the breach, run the validator alone, capture the exact output, fully revert.

1. **Reintroduced the exact Phase R breach** — `apps/admin_app/android/app/build.gradle.kts` carrying `applicationId "com.letbuyy.letbuyy"`. First pass caught it via the duplicate-file check but only named the file, not the wrong value; enhanced the validator to also surface the dead file's own declared identity, re-verified passing on the correct state first, then re-ran the control:
   ```
   admin_app: both apps/admin_app/android/app/build.gradle and apps/admin_app/android/app/build.gradle.kts exist (app build script) -- Gradle silently ignores the .kts file when both are present ("This is likely a mistake" -- Gradle's own diagnostic). The dead file declares applicationId 'com.letbuyy.letbuyy' -- WRONG, does not match this app's declared identity 'com.letbuyy.admin'. Delete the dead one.
   ```
   Deleted; validator passed again.
2. **Corrupted customer_app's `applicationId`** (Groovy dialect) in the working tree only. Failed with the exact wrong/expected values named. Restored via `git show HEAD:<path> > <path>` — never `git checkout`/`restore` — and confirmed byte-identical by SHA-256 before and after.
3. **Corrupted merchant_app's `applicationId`** (Kotlin DSL dialect) the same way — proving the Kotlin-DSL regex path is genuinely exercised, not silently skipped by a validator that only understands Groovy. Same fail → restore → byte-identical-hash pattern.
4. **Keystore assertion** — proven live without ever staging real or synthetic signing material: tested the validator's own exact regex (`/\.jks$|\.keystore$|(^|\/)key\.properties$/`, confirmed byte-identical to the source) against synthetic path *strings* only, no file created, no `git add`. All expected-to-trip paths matched; all expected-to-pass paths did not.
5. **Residue check** after all four controls: `git status` showed only the one intentional file (the validator's own message enhancement, already committed) plus the same 39 pre-existing other-session files — zero trace of any induced breach.

## The new gate baseline — state this prominently; do not cite 105/6 after this phase

| | Before this phase | After this phase |
|---|---|---|
| **PASS** | 105 | **106** |
| **FAIL** | 6 | **6 (same six, by name, unchanged)** |
| Selected | 111 | 112 |
| Discovered on disk | 115 | 116 |

The six pre-existing failures — `foundation-antifabrication-gate.mjs`, `validate-design-system.mjs`, `sequential-migration-validator.mjs`, `raw-error-message-validator.mjs`, `environment-validator.mjs`, `branch-lag-guard-validator.mjs` — are unchanged, by name, from Phase R's own baseline. No seventh failure was introduced. `android-identity-validator.mjs` appears explicitly as `PASS` in the gate's own output, not merely inferred from the aggregate count moving.

## Full regression

merchant_app 172/172 (canary), the other 4 suites at exact baseline (415/415 total). All 15 `packages/dart` members + customer_app + admin_app analyze clean. Workspace `pub get` resolves cleanly. `git diff 72ec82f9..HEAD -- 'apps/*/android/app/build.gradle' 'apps/*/android/app/build.gradle.kts'` is empty — this phase adds governance, it changes zero app identity. Rebuilt all three debug APKs after the gate (so nothing further deletes them) and re-confirmed via `aapt dump badging`: `com.letbuyy.store` / `com.letbuyy.letbuyy` / `com.letbuyy.admin`, unchanged. `pnpm-lock.yaml` byte-identical before and after the gate; node_modules restored (0 → 51).

## What this does NOT protect

- **iOS bundle identifiers.** All three apps (`customer_app`, `admin_app`, `merchant_app`) have a real `ios/Runner.xcodeproj` declaring `PRODUCT_BUNDLE_IDENTIFIER` — confirmed by direct grep this phase (`apps/customer_app/ios/Runner.xcodeproj/project.pbxproj` declares `com.letbuyy.letbuyy` across multiple build configurations, same identity as Android). This is the same class of ungoverned, irreplaceable-if-wrong value, in a different file format (`.pbxproj`), with no duplicate-script hazard analogous to Gradle's `.kts`-vs-`.gradle` split but with its own real risk surface (multiple build configurations — Debug/Release/Profile — each declaring the identifier independently, which is itself a drift opportunity this phase did not investigate further). iOS remains entirely unbuilt and untested in this environment (no Xcode toolchain — confirmed in Phase Q/R). **Recorded as a finding; not implemented this phase, per explicit instruction.**
- **Play Store upload-key material and release signing.** This governance checks that no keystore is *tracked in git* — it says nothing about whether the actual, untracked keystore file is backed up, escrowed, or recoverable if lost. That is a separate, already-tracked concern (`~/LetBuyy-signing-recovery-2026-08-29/`, referenced in prior phases) outside this validator's scope.
- **Anything that only manifests at build time.** This validator reads static Gradle source text — it does not run Gradle, does not resolve variable interpolation beyond the literal patterns it matches, and would not catch an identity computed dynamically (e.g., from an environment variable or a `gradle.properties` lookup) rather than declared as a literal. All three apps currently declare their identity as a literal; if that ever changes, this validator's regex-based extraction would need revisiting.
- **`versionCode`/`versionName` correctness.** Deliberately excluded (see table above) — a real release-process concern, but a different one from identity governance.

## What is now proven, and what is not

**Proven:** the exact Phase R breach, reintroduced, is caught by a real, registered, gate-lane validator with an informative failure message — independently observed to fail, not assumed. Both Gradle dialects (Groovy and Kotlin DSL) are genuinely exercised. The keystore-tracking check's logic is correct by direct regex-vs-source comparison. The gate baseline moved by exactly the predicted delta with zero new failures. All three apps' shipped/declared identities are unchanged and independently re-verified via a real compiled APK.

**Not proven / not attempted:** whether this validator would catch a *third* dialect (e.g. a hypothetical Groovy `build.gradle.kts` mixed differently, or a future AGP version-catalog `libs.versions.toml`-driven declaration) — only the two dialects actually present in this repository were tested. Whether the `google-services.json` cross-reference check would correctly handle a future app with multiple valid client entries for the same `applicationId` (not currently the case for any of the three apps). iOS protection, as recorded above, is a finding only.
