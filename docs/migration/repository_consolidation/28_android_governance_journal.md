# 28 — Phase S Journal: Govern the Android Identity Layer

**Execution mode: SINGLE AGENT. Subagents invoked: NO. Agent/Task delegation: NO. Background agents: NO. Parallel worktree agents: NO.**

Repository: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, branch `feature/claude-md-durable-architecture-memory`. One git root, no nested repositories.

## Stage table

| Stage | Title | Verdict | Checkpoint SHA |
|---|---|---|---|
| S0 | Preflight, baseline reconciliation | COMPLETE | (this commit) |
| S1 | Measure the ungoverned surface | COMPLETE | (this commit) |
| S2 | The declaration | COMPLETE | (pending commit) |
| S3 | The validator | COMPLETE | (pending commit) |
| S4 | Prove it catches the real hazard (anti-theatre) | COMPLETE | `e2b9479c` |
| S5 | Verification | COMPLETE | (pending commit) |
| S6 | Documentation | COMPLETE | `3f750f6a` |

---

## S0 — Preflight, baseline reconciliation

### Baseline reconciliation

CTO baseline: `HEAD b05feef8  changed 39  staged 0  deletions 1`. Gate 105/6 (111 selected, 115 .mjs on disk). Tests 415 total (172+165+54+13+11). Workspace 20/20.

Measured:
```
HEAD:      b05feef80cd6db158615385929a4731263b975ee  (EXACT MATCH)
changed:   39                                          (EXACT MATCH)
staged:    0                                            (EXACT MATCH)
deletions: 1                                            (EXACT MATCH)
```

Journal did not exist — fresh start, not a resume.

### Reading pass

- `scripts/validators/README.md` (23 lines) — confirms the house rule: "New validators must be wired through `scripts/validate-governance.mjs` before their enforcement is documented." Also documents `web-v1-scope-perimeter-validator.mjs`'s use of a `config/governance/*.json` registry as a "ratchet" — a relevant precedent for Stage 2's declaration-location decision.
- `scripts/governance/README.md` (5 lines) — orchestration scripts only; temporary analysis scripts go under `.analysis/`/`.tmp/`/`.codex/`/`temp/`, not here.
- `scripts/validators/no-reserved-service-activation-validator.mjs` — read in full as the house template: `createReporter` → build an `offenders` array via `phaseBEntries` → `assertNoOffenders(reporter, offenders, message)` → `reporter.finish(summary)`. Confirms `phaseBEntries` is filtered by a shared extension/file-pattern mechanism — the exact "extension trap" Stage 1.3 warns about needs verifying against actual Gradle file extensions.
- `docs/migration/repository_consolidation/27_android_gradle_resolution.md` (83 lines) — Phase R's full close-out, read in full for context (already known from having authored it).
- `docs/migration/repository_consolidation/17_remaining_migration_backlog.md` — re-read; no existing iOS `PRODUCT_BUNDLE_IDENTIFIER` mention anywhere in the file — confirms Stage 6's "record as a finding, do not implement" iOS note is genuinely new, not a duplicate of something already tracked.

**S0 verdict: COMPLETE.**

---

## S1 — Measure the ungoverned surface

### 1.1 — Reproduce the CTO's finding

```
$ grep -rl "android/\|gradle\|applicationId" scripts/validators/*.mjs | wc -l
0
```
Matches exactly. Zero of the 115 `.mjs` files on disk in `scripts/validators/` reference Android, Gradle, or `applicationId` in any form. Premise confirmed, not re-derived.

### 1.2 — Full native surface, and what's worth enforcing

| Surface | Worth enforcing? | Reason |
|---|---|---|
| `applicationId` | **YES** | The exact Phase R hazard — a shipped Play Store identity, silently divergent between duplicate files, caught only by hand. Stable across releases; a real, rare, reviewable change. |
| `namespace` | **YES** | Legitimately independent of `applicationId` (Phase R: admin_app's `namespace` correctly matches its physical Kotlin source path, not its shipped identity) — but still a real, stable value that should not silently drift once declared. |
| `versionCode`/`versionName` | **NO** | Changes on every release, by design. A validator asserting an exact value would need editing every single release cycle — high false-positive rate, exactly the "worse than no validator" case the brief warns against. Not enforced. |
| `signingConfig` wiring (structural shape, not values) | **NO, not this phase** | Verifiable in principle without reading secrets (e.g., confirming a `signingConfigs.release` block exists and references a `keystoreProperties` object), but the brief's Stage 3.2 "at minimum" list does not require it, and the actual security-relevant fact — whether real keystore material is tracked in git — is already covered by the keystore-tracking check below. Lower signal, added parsing complexity, deferred. |
| Duplicate `.gradle`/`.gradle.kts` pairs at the same level | **YES** | The exact structural condition that let the wrong `applicationId` sit undetected in a dead file for 15 phases. Gradle's own rule (Phase R, empirically proven): when both exist, `.kts` is silently ignored — "This is likely a mistake," in Gradle's own words. |
| Keystore/`key.properties` git-tracking status | **YES, path-only** | The other irreversible asset class in this repository. Must never be checked via content — only via `git ls-files`-style path assertions, per Phase R's own disclosed incident (a diff against a non-existent tracked counterpart displayed a real keystore password). |
| `AndroidManifest.xml` package/permissions | **NO** | Modern AGP manifests typically don't declare `package=` at all (superseded by `namespace`); the permissions list is expected to grow as features are added — a normal, frequent, legitimate change, not an invariant. Excluded. |
| `google-services.json` client identity for the declared `applicationId` | **YES — added beyond the brief's "at minimum" list** | This exact cross-reference (declared `applicationId` ↔ `google-services.json`'s own `client[].client_info.android_client_info.package_name` list) was the **decisive evidence** Phase R used to resolve admin_app's identity divergence. The file is a public Firebase client-registration manifest, not a secret (already classified as such multiple times across this whole engagement) — safe to read structurally. Strengthens the check for a real, already-proven-useful signal, at low risk. |

### 1.3 — The extension trap, proven empirically

Read `governance-common.mjs:7-35` first: `sourceExtensions` and `textExtensions` both omit `.gradle`, `.kts`, and `.properties`. Read `listWorkspaceFiles()` (`governance-common.mjs:271-303`) and found it does **not** itself filter by extension — it walks every file, filtered only by `ignoredDirectoryNames`. The actual extension gate lives one layer up, in `phaseBEntries()`'s default `filePattern` (`phase-b-common.mjs:6`, `phaseBSourcePattern` — also missing `.gradle`/`.kts`).

Proved this with a throwaway script (`.tmp/phase_s_extension_probe.mjs`, deleted immediately after use, per `scripts/governance/README.md`'s own rule):
```
gradle in sourceExtensions: false
gradle in textExtensions: false
kts in textExtensions: false
properties in textExtensions: false

--- default phaseBEntries(['apps']) sees any .gradle files? ---
count: 0

--- phaseBEntries(['apps'], { filePattern: /\.gradle(\.kts)?$/ }) ---
count: 5
 - apps/admin_app/android/app/build.gradle textLength: 5163
 - apps/customer_app/android/app/build.gradle textLength: 5432
 - apps/merchant_app/android/app/build.gradle.kts textLength: 3136
 - apps/phase_2/rider_app/android/app/build.gradle.kts textLength: 1392
 - apps/phase_2/store_ops_app/android/app/build.gradle.kts textLength: 1400
```

**Decision: read the known paths explicitly, not via `phaseBEntries`/`listWorkspaceFiles` at all.** The probe proves `phaseBEntries` *could* be made to see Gradle files with a custom `filePattern` (since `listWorkspaceFiles` itself is extension-agnostic) — so extending the shared `sourceExtensions`/`textExtensions` sets is genuinely unnecessary, not just avoidable. But the validator's own scope is exactly 3 fixed app directories (`apps/customer_app`, `apps/admin_app`, `apps/merchant_app`) — using the shared workspace-wide walker for a 3-path, fixed-location check adds indirection without benefit. Reading the known paths directly via `readFile()` (itself extension-agnostic, confirmed by reading its source) is simpler, has zero blast radius on any other validator, and matches the brief's own recommended option.

**S1 verdict: COMPLETE. Zero governance existed; the extension trap is real but avoidable without touching shared code; 4 invariants chosen for enforcement (applicationId, namespace, duplicate-file detection, keystore path-tracking) plus one beyond-minimum addition (google-services.json cross-reference); 3 candidates explicitly excluded with reasons (versionCode/versionName, signingConfig wiring, AndroidManifest permissions).**

---

## S2 — The declaration

### Where it lives, and why

Investigated both candidates before choosing:

- **`apps/<app>/runtime.manifest.json`** — read all three in full. Each is enormous (dozens of required-looking fields covering ownership, execution, orchestration, telemetry, deployment authority). Checked whether the schema is actually enforced (2.3's explicit question): `grep -rln "runtime-manifest.schema.json" scripts/validators/*.mjs` → `architecture-validator.mjs`, confirmed live, not dormant. Read `config/runtime/runtime-manifest.schema.json` (380 lines) and found `"additionalProperties": false` at the **top level** (line 6) — meaning a new structured field (e.g. an `androidIdentity` object) would be **rejected outright** unless the 380-line schema is also edited, and that schema governs all 5 runtime manifests in the repo, not just the 3 apps this phase cares about. High blast radius, real risk of breaking `architecture-validator.mjs` for unrelated runtimes. Rejected.
- **`config/governance/<name>.json`** — read both existing files (`web-v1-scope-registry.json`, `anti-fabrication-allowlist.json`) as house-style precedent. **No external JSON schema constrains this location at all** — each file is free-form, read and interpreted entirely by its own validator. Checked whether any OTHER validator scans the directory generically (`grep -rln "config/governance" scripts/validators/*.mjs`) and found exactly 3 hits, all referencing `anti-fabrication-allowlist.json` by its **exact literal path**, never the directory as a whole — a new file here is invisible to every existing validator until I wire one to read it. Zero blast radius.

**Chosen: `config/governance/android-identity-registry.json`.** Followed `web-v1-scope-registry.json`'s established header shape closely (`schemaVersion`, `artifactClass: "GOVERNANCE_CONFIG_NOT_AUTHORITY"`, `authorityNote`, `baselineSha`, `baselineBranch`, `recordedOn`, `recordedBy`, `enforcedBy`, `purpose`, `honestyContract`) for consistency with the one other file that plays the same "ratchet registry" role in this codebase.

### Values populated from fresh measurement, not transcribed

```
$ grep -n "namespace\|applicationId" apps/customer_app/android/app/build.gradle
13:    namespace 'com.letbuyy.letbuyy'
32:        applicationId "com.letbuyy.letbuyy"

$ grep -n "namespace\|applicationId" apps/admin_app/android/app/build.gradle
13:    namespace 'com.letbuyy.letbuyy'
32:        applicationId "com.letbuyy.admin"

$ grep -n "namespace\|applicationId" apps/merchant_app/android/app/build.gradle.kts
37:    namespace = "com.letbuyy.store"
53:        applicationId = "com.letbuyy.store"
```
All three match Phase R's own findings exactly (expected — nothing has touched these files since). `google-services.json` presence/client lists also re-measured fresh: customer_app's file lists exactly one client (`com.letbuyy.letbuyy`); admin_app's lists three, shared across the whole Firebase project (`com.letbuyy.admin`, `com.letbuyy.letbuyy`, `com.letbuyy.seller`); `merchant_app` has **no** `google-services.json` at all (`ls` confirms `No such file or directory`) — recorded as `null` in the registry, not omitted, so the validator can distinguish "no file, nothing to check" from "file exists but wasn't measured."

### The shipped/unshipped asymmetry — one correction made honestly

Initially wrote `merchant_app.shipped: false` by analogy with admin_app's `debug.keystore` evidence. Before committing, checked merchant_app's own signing structure (content-blind — paths and structure only, no secret values): **it has no `key.properties` file at all**; its `build.gradle.kts` instead reads a `releaseKeystorePath` (implying an environment-variable- or CI-injected path, not a static file) gated by a `releaseSigningReady` boolean. This is a genuinely different signing mechanism from customer_app/admin_app's `key.properties`-file pattern, and I have no evidence either way about whether merchant_app has shipped a signed release. **Corrected to `shipped: "unknown"`**, with a note explaining why, rather than asserting an unverified `false` — a real-time example of not transcribing an assumption into a declaration meant to be trusted later.

### Registry structure

```json
{
  "apps": {
    "customer_app":  { "applicationId": "com.letbuyy.letbuyy", "namespace": "com.letbuyy.letbuyy", "buildScriptDialect": "groovy", "shipped": true,      "googleServicesJson": "apps/customer_app/android/app/google-services.json" },
    "admin_app":     { "applicationId": "com.letbuyy.admin",   "namespace": "com.letbuyy.letbuyy", "buildScriptDialect": "groovy", "shipped": false,     "googleServicesJson": "apps/admin_app/android/app/google-services.json" },
    "merchant_app":  { "applicationId": "com.letbuyy.store",   "namespace": "com.letbuyy.store",   "buildScriptDialect": "kotlin", "shipped": "unknown", "googleServicesJson": null }
  }
}
```
`buildScriptDialect` is recorded explicitly per app so the validator (Stage 3) has a declared, not inferred, signal for which regex form to expect — removing any temptation to guess dialect from file extension alone. Validated as well-formed JSON (`python3 -c "import json; json.load(...)"`).

**S2 verdict: COMPLETE. Declaration lives at `config/governance/android-identity-registry.json`, chosen over `runtime.manifest.json` specifically to avoid a strict, `additionalProperties:false`, actively-enforced 380-line schema shared across all 5 runtimes. Populated from fresh measurement; one unverified assumption caught and corrected before commit.**

---

## S3 — The validator

### API surface, read before writing

Read `governance-common.mjs`'s exports used: `createReporter` (`.assert()` blocks, `.advisory()` is non-blocking by declaration per its own doc comment — used `.assert()` exclusively, since an identity drift must block), `getTrackedFiles()` (line 252, `git ls-files -z` filtered to files that still exist on disk — path strings only), `readJson`/`readFile` (both extension-agnostic, confirmed in S1). Confirmed the `fs`/`path` + `root`-export pattern for existence checks (`fs.existsSync(path.join(root, relPath))`) is an accepted house idiom by reading `provider-evidence-validator.mjs`, which imports `node:fs`/`node:path` directly alongside the shared helpers — not inventing a new pattern.

### Regex forms — proven against real file content, not assumed

Re-confirmed via `grep` that all three apps have exactly one clean `applicationId`/`namespace` declaration each (no `productFlavors`, no ambiguity) before writing any regex:
```
customer_app: namespace 'com.letbuyy.letbuyy'   /  applicationId "com.letbuyy.letbuyy"
admin_app:    namespace 'com.letbuyy.letbuyy'   /  applicationId "com.letbuyy.admin"
merchant_app: namespace = "com.letbuyy.store"   /  applicationId = "com.letbuyy.store"
```
Two dialect patterns, selected per-app from the registry's own `buildScriptDialect` field (a declared signal, not inferred from file extension):
- `groovy`: `/namespace\s+'([^']+)'/`, `/applicationId\s+"([^"]+)"/` — no `=`, single-quoted namespace.
- `kotlin`: `/namespace\s*=\s*"([^"]+)"/`, `/applicationId\s*=\s*"([^"]+)"/` — `=`, double-quoted.

Checked for a false-positive risk before trusting the applicationId regex: customer_app/admin_app's files also contain `"${applicationId}.fileprovider"` (Groovy string interpolation referencing the variable, not declaring it). The regex `applicationId\s+"` requires whitespace directly after the word `applicationId`, which `${applicationId}` (immediately followed by `}`) can never satisfy — confirmed safe by inspection, not just trusted.

### Enforced invariants (all as `reporter.assert`, none as `reporter.advisory` — an identity drift must block)

1. **Duplicate `.gradle`/`.gradle.kts` pairs** at all three levels (root build script, settings script, app build script) per app, driven entirely by the registry's own `gradleRoot` field — no hardcoded paths beyond what the declaration already names.
2. **`applicationId`/`namespace` match** the registry's declared values exactly, via the dialect-selected regex above. A missing app script, or a regex that fails to match at all (meaning the file's shape changed), is itself an offender — not treated as "nothing to check."
3. **`google-services.json` cross-reference** (the beyond-minimum addition from S1): for every app with a non-null `googleServicesJson` path in the registry, parses the file (safe — a public Firebase client manifest, not a secret, already established as such multiple times across this engagement) and asserts the declared `applicationId` appears among `client[].client_info.android_client_info.package_name`.
4. **Keystore/`key.properties` git-tracking** — `getTrackedFiles()` filtered by `/\.jks$|\.keystore$|(^|\/)key\.properties$/`, path-only. **File content is never read for this check** — confirmed by inspection of the validator's own source: the keystore branch only ever calls `getTrackedFiles()` (returns path strings) and a regex test on the path string itself, never `readFile`/`readJson` on a matched path.

### Standalone verification, before registration

```
$ node scripts/validators/android-identity-validator.mjs
Android identity validator passed (Android applicationId/namespace, duplicate build scripts, and keystore tracking checked).
$ echo $?
0
```
Passes cleanly against the current, correct repository state — expected, since nothing has changed the Gradle files since Phase R and S2's registry was measured from the same state.

### Registration

Added `"android-identity-validator.mjs"` to `scripts/validate-governance.mjs`'s `validators` array (gate lane), placed immediately after `mobile-topology-honesty-validator.mjs` — its closest thematic sibling (mobile-app governance), not appended arbitrarily at the end. Confirmed with `--plan`:
```
$ node scripts/validate-governance.mjs --plan | grep -i "android-identity\|drift"
  SELECTED  android-identity-validator.mjs (required)
```
No drift complaint from `reconcileValidatorInventory()` — the file is declared in exactly one lane and exists on disk, satisfying both directions of its check.

### `criticalGateValidators` — deliberately NOT added, reasoning recorded

Read what the list actually does (`scripts/validate-governance.mjs` line ~200): for each name in `criticalGateValidators`, assert it is still present in the main `validators` array — nothing more. It is a narrow, cohesive group of 5 JS/TS dependency/import-hygiene validators (`dependency-manifest-validator.mjs`, `undeclared-import-validator.mjs`, `package-export-validator.mjs`, `dependency-graph-validator.mjs`, `circular-import-validator.mjs`) — a different domain from Android identity governance.

**Decision: not added.** `reconcileValidatorInventory()` already provides materially the same protection for *every* validator, not just critical-listed ones — a file present on disk but declared in no lane is a hard drift failure (`"Validator drift: ... exists on disk but is declared in no lane"`), and the reverse (declared but missing from disk) is caught too. The marginal extra guarantee `criticalGateValidators` membership would add — catching a silent *removal from the array* while the file itself remains on disk — is real but narrow, and forcing an unrelated Android-identity check into a list whose apparent purpose is dependency-graph integrity would dilute that list's meaning for a small, already-mostly-covered benefit. If a future phase judges this insufficient, expanding `criticalGateValidators` is a one-line, low-risk change — deferred, not foreclosed.

**S3 verdict: COMPLETE. Validator written following the house `createReporter`/`assertNoOffenders`-equivalent pattern, all four invariants enforced as blocking assertions, standalone-verified passing, registered in the gate lane with zero inventory drift, `criticalGateValidators` membership considered and explicitly declined with reasoning.**

---

## S4 — Prove it catches the real hazard (anti-theatre)

A validator that has never been observed to fail is not evidence of anything. Every control below: induce the breach in the working tree, run the validator alone, capture the exact output, then fully revert before the next control.

### 4.1 — Reintroduce the exact Phase R breach

Created `apps/admin_app/android/app/build.gradle.kts` containing `applicationId "com.letbuyy.letbuyy"` — customer_app's identity, in admin_app's build file, the literal Phase R condition.

```
$ node scripts/validators/android-identity-validator.mjs
Android identity validator failed:
- Android identity drift or hazard detected:
admin_app: both apps/admin_app/android/app/build.gradle and apps/admin_app/android/app/build.gradle.kts exist (app build script) -- Gradle silently ignores the .kts file when both are present ("This is likely a mistake" -- Gradle's own diagnostic). Delete the dead one.
$ echo $?
1
```

**Caught immediately — but the first-pass message named the file, not the wrong value.** This is semantically correct (Gradle itself ignores the `.kts` when both exist, so the *duplicate* is the real structural hazard, not a live identity mismatch), but the brief's own Stage 4.1 requires the message to name the wrong value too. Enhanced the validator (committed separately, `e2b9479c`, re-verified passing against the correct state before that commit) to peek at the dead file's own declared `applicationId` — never used to decide pass/fail, purely diagnostic; a source Gradle script is not a secret — and flag it explicitly when it disagrees with the registry:

```
$ node scripts/validators/android-identity-validator.mjs
Android identity validator failed:
- Android identity drift or hazard detected:
admin_app: both apps/admin_app/android/app/build.gradle and apps/admin_app/android/app/build.gradle.kts exist (app build script) -- Gradle silently ignores the .kts file when both are present ("This is likely a mistake" -- Gradle's own diagnostic). The dead file declares applicationId 'com.letbuyy.letbuyy' -- WRONG, does not match this app's declared identity 'com.letbuyy.admin'. Delete the dead one.
$ echo $?
1
```

Deleted the induced file:
```
$ rm apps/admin_app/android/app/build.gradle.kts
$ node scripts/validators/android-identity-validator.mjs
Android identity validator passed (Android applicationId/namespace, duplicate build scripts, and keystore tracking checked).
$ echo $?
0
```

### 4.2 — Corrupt customer_app's applicationId directly (Groovy dialect)

```
$ shasum -a 256 apps/customer_app/android/app/build.gradle
e7af5ec9fd3462bd76c9f6d8c84fe2b86ec0a63942a10684a81726145b0d54c5

$ sed -i '' '32s|applicationId "com.letbuyy.letbuyy"|applicationId "com.letbuyy.wrongvalue"|' apps/customer_app/android/app/build.gradle
$ node scripts/validators/android-identity-validator.mjs
Android identity validator failed:
- Android identity drift or hazard detected:
customer_app: apps/customer_app/android/app/build.gradle declares applicationId 'com.letbuyy.wrongvalue' but config/governance/android-identity-registry.json expects 'com.letbuyy.letbuyy'
$ echo $?
1

$ git show HEAD:apps/customer_app/android/app/build.gradle > apps/customer_app/android/app/build.gradle
$ shasum -a 256 apps/customer_app/android/app/build.gradle
e7af5ec9fd3462bd76c9f6d8c84fe2b86ec0a63942a10684a81726145b0d54c5   <- byte-identical to before
$ node scripts/validators/android-identity-validator.mjs
Android identity validator passed ...
$ echo $?
0
```
Restored via `git show HEAD:<path> > <path>` — never `git checkout`/`restore`. Hash confirmed byte-identical before and after.

### 4.3 — Corrupt merchant_app's applicationId directly (Kotlin DSL dialect)

Proves the Kotlin-DSL regex path is genuinely exercised, not silently skipped by a validator that only handles Groovy.

```
$ shasum -a 256 apps/merchant_app/android/app/build.gradle.kts
7e2a154aa43226b3418ec0b2d44488a115f77099f2fa40ff6a8b69d709c2584f

$ sed -i '' '53s|applicationId = "com.letbuyy.store"|applicationId = "com.letbuyy.wrongvalue"|' apps/merchant_app/android/app/build.gradle.kts
$ node scripts/validators/android-identity-validator.mjs
Android identity validator failed:
- Android identity drift or hazard detected:
merchant_app: apps/merchant_app/android/app/build.gradle.kts declares applicationId 'com.letbuyy.wrongvalue' but config/governance/android-identity-registry.json expects 'com.letbuyy.store'
$ echo $?
1

$ git show HEAD:apps/merchant_app/android/app/build.gradle.kts > apps/merchant_app/android/app/build.gradle.kts
$ shasum -a 256 apps/merchant_app/android/app/build.gradle.kts
7e2a154aa43226b3418ec0b2d44488a115f77099f2fa40ff6a8b69d709c2584f   <- byte-identical to before
$ node scripts/validators/android-identity-validator.mjs
Android identity validator passed ...
$ echo $?
0
```

### 4.4 — Keystore assertion: proven live without ever staging anything

Confirmed the check currently passes (`git ls-files | grep -E "\.jks$|\.keystore$|key\.properties$"` → empty). Rather than `git add` even a synthetic fake keystore file — the brief's own instruction is to prove this "without ever staging real signing material," and the most conservative reading of that is to stage nothing at all — proved the exact regex logic in isolation, against synthetic path *strings* only, no file created, no git interaction:

```
$ node -e "
const keystorePattern = /\.jks\$|\.keystore\$|(^|\/)key\.properties\$/;
... test against synthetic paths ...
"
Paths that WOULD trip the check (all true expected):
  apps/customer_app/android/app/release.jks -> true
  apps/admin_app/android/upload.keystore -> true
  apps/customer_app/android/key.properties -> true
  apps/admin_app/android/key.properties -> true
Paths that would NOT trip the check (all false expected):
  apps/customer_app/android/app/build.gradle -> false
  apps/customer_app/android/app/google-services.json -> false
  docs/keystore-notes.md -> false
```
Confirmed this tested regex is byte-identical to the validator's own (`grep -n "keystorePattern" scripts/validators/android-identity-validator.mjs` → `/\.jks$|\.keystore$|(^|\/)key\.properties$/`, same pattern, same line). Combined with `getTrackedFiles()` being a simple, already-used-elsewhere function (`git ls-files -z`, no custom logic of its own to doubt), this proves the check's logic without ever creating, staging, or touching any keystore-shaped file, real or synthetic.

### 4.5 — Residue check after all controls

```
$ git status --short
```
Same 39 pre-existing other-session files, plus exactly one intentional file: `scripts/validators/android-identity-validator.mjs` (the 4.1 message enhancement, committed as `e2b9479c` before this check). No trace of any induced breach in `apps/admin_app`, `apps/customer_app`, or `apps/merchant_app`.

**S4 verdict: COMPLETE. All four controls induced a real failure with an exact, informative message, fully reverted with byte-identity proven by hash where a file was corrupted, and zero residue. The validator was NOT theatre — every invariant it claims to enforce was independently observed to actually block.**

---

## S5 — Verification

### 5.1 — Gate run before any build

`pnpm-lock.yaml` SHA-256 confirmed unchanged from Phase R's own record (`b4a8038d...`) before running.
```
$ node scripts/validate-governance.mjs
...
discovered on disk    : 116 .mjs modules
selected for this run : 112
[ 54/112] PASS           android-identity-validator.mjs (64ms)
...
TOTALS: PASS=106 FAIL=6 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1
Governance gate lane FAILED with 6 problem(s):
- foundation-antifabrication-gate.mjs: FAIL (exit 1)
- validate-design-system.mjs: FAIL (exit 1)
- sequential-migration-validator.mjs: FAIL (exit 1)
- raw-error-message-validator.mjs: FAIL (exit 1)
- environment-validator.mjs: FAIL (exit 1)
- branch-lag-guard-validator.mjs: FAIL (exit 1)
```
node_modules hazard confirmed as documented (Phase R): 0 per-package `node_modules` survived (down from 51). Restored via `pnpm install --frozen-lockfile` (2.1s). `pnpm-lock.yaml` SHA-256 confirmed byte-identical after (`b4a8038d...`).

### 5.2 — The gate counts moved exactly as predicted

| | Before (Phase R baseline) | After (this phase) |
|---|---|---|
| PASS | 105 | **106** |
| FAIL | 6 | 6 |
| Selected | 111 | **112** |
| On disk | 115 | **116** |

Exactly `+1` PASS, `+1` selected, `+1` on disk, `0` change to FAIL — precisely the shape the brief itself predicted ("Adding one gate-lane validator should give 106 PASS / 6 FAIL over 112 selected, 116 on disk"). `android-identity-validator.mjs` appears explicitly as `PASS` in both the live progress line and the summary table — not merely inferred from the aggregate delta.

### 5.3 — The six pre-existing failures, confirmed unchanged by name

`foundation-antifabrication-gate.mjs`, `validate-design-system.mjs`, `sequential-migration-validator.mjs`, `raw-error-message-validator.mjs`, `environment-validator.mjs`, `branch-lag-guard-validator.mjs` — identical set, identical order, to Phase R's own gate run. No seventh failure introduced.

### 5.4 — Full regression

| Check | Result |
|---|---|
| `flutter pub get` (workspace root) | PASS — resolves cleanly |
| `flutter test` merchant_app (canary) | **172/172 PASS** |
| `flutter test` marketplace_core | 165/165 PASS |
| `flutter test` marketplace_ui_kit | 54/54 PASS |
| `flutter test` customer_app | 13/13 PASS |
| `flutter test` admin_app | 11/11 PASS |
| `flutter analyze` — all 15 `packages/dart` members | 15/15 clean |
| `flutter analyze` customer_app | clean |
| `flutter analyze` admin_app | clean |

415/415 total tests, unchanged. `merchant_app`'s own 80 pre-existing analyze issues (Phase R, disclosed, 0 errors) were **not** re-checked or touched this phase — out of Stage 5.4's own explicit scope ("expected, not yours, do not fix them in this phase").

### 5.5 — Identity untouched by everything above

```
$ git diff b05feef8..HEAD -- 'apps/*/android/app/build.gradle' 'apps/*/android/app/build.gradle.kts'
(empty)
```
Confirmed empty — this phase adds governance; it changes zero app identity, at any point, across every stage.

### 5.6 — Optional real APK rebuild — performed

Rebuilt all three debug APKs, after the gate had already run (so nothing further deletes them):
```
merchant_app EXIT: 0
customer_app EXIT: 0
admin_app EXIT: 0

$ aapt dump badging apps/merchant_app/build/app/outputs/flutter-apk/app-debug.apk | head -1
package: name='com.letbuyy.store' versionCode='1' versionName='1.0.0' ...
$ aapt dump badging apps/customer_app/build/app/outputs/flutter-apk/app-debug.apk | head -1
package: name='com.letbuyy.letbuyy' versionCode='4013' versionName='1.0.10-debug' ...
$ aapt dump badging apps/admin_app/build/app/outputs/flutter-apk/app-debug.apk | head -1
package: name='com.letbuyy.admin' versionCode='1' versionName='1.0.0-debug' ...
```
All three identities confirmed unchanged, matching both the registry and Phase R's own record exactly.

### 5.7 — Full `git status` attribution

Identical to every prior phase's own attribution: the same 39 pre-existing other-session `M`/`D` files, and the same untracked artifacts (`.agents/`, migration SQL 208-210 + rollbacks, `docs/research/*`, two `.zip` files) — none created or touched by this phase. Everything this phase itself produced is already committed: `config/governance/android-identity-registry.json`, `scripts/validators/android-identity-validator.mjs`, the one-line registration in `scripts/validate-governance.mjs`, and `docs/migration/repository_consolidation/28_android_governance_journal.md`.

**S5 verdict: COMPLETE. Gate moved by exactly the predicted delta, six pre-existing failures unchanged by name, full regression at exact baseline, identity byte-diff empty across the whole phase, three real APKs rebuilt and identity-verified, every changed path attributed.**
