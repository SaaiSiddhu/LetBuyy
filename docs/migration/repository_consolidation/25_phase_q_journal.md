# 25 — Phase Q Journal: Re-Contain Recovered Credentials + Fix the Compile Blocker

**Execution mode: SINGLE AGENT. Subagents invoked: NO. Agent/Task delegation: NO. Background agents: NO. Parallel worktree agents: NO.**

Repository: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, branch `feature/claude-md-durable-architecture-memory`. One git root, no nested repositories.

## Stage table

| Stage | Title | Verdict | Checkpoint SHA |
|---|---|---|---|
| S0 | Preflight | COMPLETE | (this commit) |
| S1 | Re-contain the three literal-carrying files (Part A) | COMPLETE | `fa87d09e` |
| S2 | Investigate the two flagged-but-clean files; environment-validator before/after | COMPLETE — 2 additional real secrets found, contained | `7b867c12` |
| S3 | Part B evidence — the four-option table | COMPLETE | (folded into S4's commit) |
| S4 | Part B execution — migrate all 15 font_awesome_flutter sites | COMPLETE | `f13717bf` |
| S5 | Remove unused font_awesome_flutter declarations (ui_kit, marketplace_ui_kit) | COMPLETE | `924ba5c9` |
| S6 | Prove compilation + full regression sweep + governance gate | COMPLETE — real build blocked by unrelated pre-existing Android toolchain issue; probe fallback used, before/after captured | (this commit) |
| S7 | Documentation | COMPLETE | (this commit) |

---

## S0 — Preflight

### Baseline reconciliation

CTO baseline: `HEAD 21e6d465  tracked 8365  changed 39  staged 0  untracked 58  deletions 1`. Gate 105/6. Workspace 20/20. Toolchain Flutter 3.44.8 / Dart 3.12.2. Test suites: merchant_app 172, marketplace_core 165, marketplace_ui_kit 54, customer_app 13, admin_app 11 (415 total).

Measured:
```
HEAD:      21e6d465eead634b2bbe65ce41ff6ad632ea364a  (EXACT MATCH)
tracked:   8365                                        (EXACT MATCH)
staged:    0                                            (EXACT MATCH)
changed:   38  (CTO: 39 — the same recurring 1-file bookkeeping gap diagnosed in every prior phase's own S0 entry since Phase N; not re-derived here)
untracked: 14 git-status lines  (CTO: 58 — the same recurring directory-line-collapsing artifact diagnosed since Phase N's S0 entry; not re-derived here)
```

**Conclusion:** identical, now well-established reconciliation pattern. The four hard identity signals match exactly. Proceeding as a fresh start.

### Toolchain re-confirmed

```
$ flutter --version
Flutter 3.44.8 • channel stable
Tools • Dart 3.12.2
```

Matches the CTO baseline exactly.

**S0 verdict: COMPLETE.**

---

## S1 — Re-contain the three literal-carrying files (Part A)

### Pattern established

Read the sibling already-fixed files first rather than inventing a pattern: `packages/dart/core/lib/src/config/{razorpay_config,gemini_config}.dart`. The real precedent is simpler than the brief's own A1 template — a direct `static const String x = String.fromEnvironment('NAME');` for class fields, no throw-wrapper. The more defensive throw-based pattern (`apps/customer_app/lib/screens/checkout/payment_method_screen.dart:263-282`) was reserved for the one local-variable case.

### Files fixed

| File | Line | Field | Dart-define name | Name status |
|---|---|---|---|---|
| `marketplace_core/lib/src/config/razorpay_config.dart` | 6 | `keyId` (class field) | `RAZORPAY_KEY_ID` | reused (matches `packages/dart/core`'s already-fixed sibling) |
| `marketplace_core/lib/src/config/razorpay_config.dart` | 7 | `keySecret` (class field) | `RAZORPAY_KEY_SECRET` | **new** — no prior name existed |
| `marketplace_core/lib/src/config/gemini_config.dart` | 3 | `apiKey` (class field) | `GEMINI_API_KEY` | reused |
| `marketplace_services/lib/src/ai_chat_service.dart` | 298 | `apiKey` (local variable) | `GEMINI_API_KEY` | reused |

`ai_chat_service.dart:298` is a local variable inside a method, confirmed via content-blind structural grep before editing (`awk 'NR==298' file \| grep -oE "^\s*(const\|final\|var)\s+\w+"` → `final apiKey`). Per A3: read the safe surrounding lines (285-297, 299-320, explicitly excluding line 298) and found an existing guard at lines 299-306 (`if (apiKey.trim().isEmpty) { ... return ChatMessage.ai(text: 'AI service not configured...') }`) that was previously dead code against the hardcoded literal. It is now live. No new throw-based guard was added — the existing softer degradation path is sufficient and more graceful than the brief's generic template, exactly the outcome A3 anticipated.

### Verification

- `flutter analyze packages/dart/marketplace_core` — clean (0 issues)
- `flutter analyze packages/dart/marketplace_services` — clean (0 issues)
- `flutter test packages/dart/marketplace_core` — 165/165 passed
- `flutter test packages/dart/marketplace_ui_kit` — 54/54 passed (unaffected sibling, run as a regression check)
- `grep -c` for the literal shapes at all three fixed locations — 0

### Disclosed incident — secret values displayed in tool output

A "redact before display" `sed -E "s/(=\s*')[^']*(')/\1[REDACTED]\2/g"` command silently failed to match (root cause not fully diagnosed; consistent with a BSD/macOS `sed -E` backreference quirk) and printed the full, unredacted content of `razorpay_config.dart` and `gemini_config.dart` — including both Razorpay values and the Gemini key — directly into this session's own tool output. Disclosed immediately, not minimized. Both values were already dead (owner-deleted at the provider, per this phase's own stated context) and already exposed in both GitHub remotes' published history, so this created no new external exposure — but it violated this phase's explicit "never display a literal" instruction and repeats a failure-mode this engagement has hit before. Switched to strictly content-blind methods (`grep -c`, `awk 'NR==X' | grep -c`, blind line-anchored `sed -i`) for all remaining Part A/Stage 2 work; no further incident of this specific kind (see S2 below for a second, smaller one).

**S1 verdict: COMPLETE. Checkpoint: `fa87d09e`.**

---

## S2 — Investigate the two flagged-but-clean files; environment-validator before/after

### Validator logic read in full

`scripts/validators/environment-validator.mjs` (242 lines) read completely before touching either file. Two independent secret-detection paths: `hasUnexplainedSecretPattern` (5 key-SHAPE regexes: `sk/pk/rk_live|test_`, `whsec_`, `rzp_live|test_`, `AIza`, PEM headers — exempted only by a `fixtureMarkerPattern` on the containing line) and `hasHardcodedSecretAssignment` (a broader `secret|token|password|private_key|service_role`-adjacent assignment regex, exempted by several value-shape filters including an explicit `lowerValue.includes("test_")` check).

### custom_payment_service.dart — NOT a false positive; contained a real, previously-undiscovered secret

Content-blind `grep -ocE` against all 5 patterns found 3 matches for `rzp_(live|test)_` (0 for the other 4). Line-number/prefix-only extraction (never displaying full lines) found: line 49 = `rzp_live_`, line 89 = `rzp_test_`, line 122 = `rzp_test_`.

- **Line 49** (`openUpiPayment`'s checkout options map): confirmed genuine via content-blind SHA-256 hash comparison against `razorpay_config.dart`'s original pre-fix value (from `git show 1149e12a:...`) — **different hash, i.e. a distinct live Razorpay key**, not a duplicate of the one already fixed. Contained using the existing `RAZORPAY_KEY_ID` name (same purpose, different value).
- **Lines 89, 122** (`openCardPayment`, `openAllPaymentMethods`): confirmed via exact-string `grep -c "rzp_test_1DP5mmOlF5G5ag"` = 2 to be Razorpay's own **publicly-documented sample test key**, already classified as a non-secret in this same engagement's Phase M finding (`12_final_verification.md`'s "Security finding" section, where the identical value was found — and fixed — in `services/compatibility/firebase_bridge/src/razorpayService.ts:21`). Left unchanged in this file, per this phase's own instruction: "If a file is flagged for a pattern that is not a secret, that is a finding to record, not a file to edit." `environment-validator.mjs` still flags this file post-fix — an expected, confirmed false positive on a public value, not a real finding.

**Disclosed incident (second, smaller):** a `Read` call with `offset=78, limit=14` (intended range: lines 78-91, but I misjudged that this range included the flagged line 89) displayed `'key': 'rzp_test_1DP5mmOlF5G5ag',` directly in tool output. Disclosed immediately. Assessed as low-severity — this is the same publicly-documented Razorpay sample key described above, not a real credential — but it repeats the discipline break from S1, and is recorded as such rather than excused because the value happened to be harmless. Tightened back to content-blind-only methods (hash comparison, `awk 'NR==X' | grep -c`) for the remainder of the investigation.

### razorpay_custom_service.dart — NOT a false positive; contained a real, previously-undiscovered secret pair

`hasHardcodedSecretAssignment`'s keyword path matched `testKeySecret` (the identifier itself contains "secret"). Content-blind investigation of the class (`AdvancedRazorpayService`, constructor default parameters) found a second, adjacent field — `testKeyId` — also carrying a hardcoded `rzp_test_`-prefixed value at line 38 (one line above `testKeySecret` at line 39). Confirmed via exact-string match that line 38's value is **not** the known public sample (`rzp_test_1DP5mmOlF5G5ag` count = 0 in this file) — a genuinely distinct, previously-undiscovered test-mode key/secret pair. Contained using two **new** dart-define names (no prior precedent existed for a test-mode pair): `RAZORPAY_TEST_KEY_ID`, `RAZORPAY_TEST_KEY_SECRET`. Both are constructor default-parameter values, which Dart requires to be explicit `const` expressions — `const String.fromEnvironment(...)`, confirmed by a first `flutter analyze` pass that correctly rejected the non-`const` form (`non_constant_default_value`) before the `const` keyword was added.

### Why these two files were never caught before

Root cause is the same bundle-vs-working-tree mechanism already established for the three named files, one layer deeper: `marketplace_services` (the whole package, not just these two files) did not exist in this repository until Phase N's 2026-09-03 System A package recovery. Phase 0.5-0.7's original containment pass predates the package's existence here entirely. Phase M's own later security-verification pass (`12_final_verification.md`, which found and fixed two *other* previously-undiscovered Razorpay key IDs) also predates `marketplace_services`'s arrival — it could not have seen these two files either. This phase (Q) is the first opportunity either file has had to be audited.

### Verification (after both fixes)

- `flutter analyze packages/dart/marketplace_services` — clean (0 issues), after adding `const`
- No test suite exists for `marketplace_services` (pre-existing; not something this fix introduces or removes)
- `marketplace_core` 165/165, `marketplace_ui_kit` 54/54 — run as regression checks, unaffected
- `grep -noE "rzp_(live|test)_"` final inventory across both files: only the two confirmed-benign lines (89, 122) remain

### environment-validator.mjs — before/after

**Before (any Phase Q fix):** flagged `razorpay_config.dart`, `gemini_config.dart`, `ai_chat_service.dart`, `custom_payment_service.dart`, `razorpay_custom_service.dart`, plus 12 Firebase-client-identifier files across both apps and `services/compatibility/firebase_bridge/src/adminAuth.ts`.

**After S1 (three named files fixed):** `razorpay_config.dart`, `gemini_config.dart`, `ai_chat_service.dart` cleared. `custom_payment_service.dart` and `razorpay_custom_service.dart` still flagged (not yet investigated).

**After S2 (both additional files fixed):** `razorpay_custom_service.dart` cleared. `custom_payment_service.dart` **still flagged** — confirmed expected, a false positive on lines 89/122's public sample value only (no genuine secret remains in the file). Full remaining offender list:

```
apps/admin_app/android/app/google-services.json
apps/admin_app/android/app/src/main/AndroidManifest.xml
apps/admin_app/ios/Runner/GoogleService-Info.plist
apps/admin_app/lib/firebase_options.dart
apps/admin_app/web/firebase-messaging-sw.js
apps/admin_app/web/index.html
apps/customer_app/android/app/google-services.json
apps/customer_app/android/app/src/main/AndroidManifest.xml
apps/customer_app/ios/Runner/GoogleService-Info.plist
apps/customer_app/lib/firebase_options.dart
apps/customer_app/web/firebase-messaging-sw.js
apps/customer_app/web/index.html
packages/dart/marketplace_services/lib/src/custom_payment_service.dart
services/compatibility/firebase_bridge/src/adminAuth.ts
```

12 Firebase-client-identifier files (public per Google's documented model, already classified as non-secrets in `00c_credential_exposure_and_rotation.md` and re-confirmed in `12_final_verification.md`) + `adminAuth.ts` (same class, TypeScript, out of this Dart-focused phase's scope) + `custom_payment_service.dart` (the confirmed public-sample false positive above). **The validator does not fully pass** — it was never going to, given these known, pre-existing, already-classified false positives with no exemption mechanism in the validator's own source. This is a validator-tuning question for a later phase, exactly as the brief anticipated.

**S2 verdict: COMPLETE — scope expanded beyond the brief's 3 named files by measured evidence (2 additional real secrets found and contained), 2 disclosed process incidents (both assessed low-severity, both non-repeating after correction). Checkpoint: `7b867c12`.**

---

## S3 — Part B evidence: the four-option table

Re-measured every figure in the CTO's scope claim before touching anything; all matched exactly: 15 files (13 customer_app, 2 admin_app), 79 distinct `FontAwesomeIcons` symbols, 45 `FaIcon(` call sites, 25 `Icon(FontAwesomeIcons.x)` call sites, 0 explicit `IconData x = FontAwesomeIcons...` variables, 14/15 files reference `IconData` in a signature/type, 4 pubspecs declare `^10.7.0` (customer_app, admin_app, ui_kit, marketplace_ui_kit), resolves to 10.12.0, ui_kit/marketplace_ui_kit have zero imports despite declaring it.

| Option | Measured evidence | Verdict |
|---|---|---|
| **1 — bump to `^11.0.0`** | Verified via an isolated scratch pubspec (`/tmp/faf-probe`, outside the real workspace) rather than trusting the CTO's own framing: 11.0.0 has **zero** `extends IconData` sites (10.12.0 has exactly 10 — confirmed by name: `IconDataBrands/Solid/Regular/Light/Duotone/Thin/SharpThin/SharpLight/SharpRegular/SharpSolid`). `FontAwesomeIcons` constants are now a standalone `final class FaIconData`, unrelated to `IconData` by inheritance, but **wraps a real `IconData` via a `.data` getter** — a fact the CTO's brief didn't mention and which changes the real risk profile favourably. `FaIcon extends Icon` unchanged. All 79 used symbols exist unchanged in 11.0.0 (zero rename risk — cross-checked against the FA 7.1.0→7.2.0 icon-set bump the CHANGELOG also documents). SDK requirement (`>=3.9.0`/flutter `>=3.27.0`) satisfied by the installed toolchain and both apps' own `sdk: '^3.10.0'`. **CHOSEN.** |
| **2 — pin Flutter SDK below the final-`IconData` change** | Confirmed 11 of the workspace's pubspecs declare `sdk: flutter` — one shared SDK version across the entire pub workspace; pinning freezes all 20 members, not just the 2 apps that need this fix. Rejected: trades a bounded, already-solved problem (Option 1 exists and works) for an unbounded one (indefinitely blocking every future Flutter upgrade for the whole repo). |
| **3 — drop the dependency, vendor 79 icons as hand-authored `IconData` constants** | No shortcut available — confirmed via the same symbol/call-site count as Option 1's evidence gathering; would require vendoring font assets, pubspec asset declarations, and 79 codepoint constants by hand. Rejected: highest churn, and Option 1 already eliminates the ongoing dependency risk this option exists to avoid, for a fraction of the cost. |
| **4 — fork/patch font_awesome 10.x** | Confirmed via `grep -rn "dependency_overrides"` across every pubspec in the repo: **zero existing precedent** for this pattern here. Rejected: would introduce the repo's first `dependency_overrides`/git-dependency, an ongoing maintenance burden for every future contributor, with no advantage over Option 1 now that a real, compatible upstream fix exists. |

Real per-app churn, measured via `flutter analyze`'s own error list immediately after the pubspec bump (not predicted): **75 errors in customer_app, 7 in admin_app**, spanning all 15 font_awesome-importing files. This is the number Stage S4 actually fixed against — not a guess.

**S3 verdict: COMPLETE. Option 1 chosen; evidence is stronger in its favour than the CTO's own framing anticipated (the `.data` bridge means zero sites needed a rendered-behaviour change).**

---

## S4 — Part B execution: migrate all 15 font_awesome_flutter sites

Bumped `apps/customer_app/pubspec.yaml` and `apps/admin_app/pubspec.yaml` from `^10.7.0` to `^11.0.0`. `flutter pub get` at the workspace root failed at first (`marketplace_ui_kit` still declared `^10.7.0`, and the unified pub workspace solves font_awesome_flutter as exactly one version across all 20 members) — resolved by removing the two unused declarations (see S5) in the same working-tree pass, though committed separately.

Two fix shapes were used, chosen **per site** to preserve exact rendered behaviour — never picked for convenience over correctness:

1. **Retype `IconData` → `FaIconData`** where a helper's `icon` parameter is used exclusively with `FontAwesomeIcons` values and rendered via `FaIcon` (never `Icon`). Zero rendering change: `FaIcon` already required `FaIconData`-shaped data for these call sites to be correct. 11 functions/classes: `_buildStatItem` (coupon_selection_screen), `_buildDeliveryOption`/`_priceRow` (mobile_cart_screen), `_buildQuantityButton` (cart_item_card), `_buildPaymentBadge` (payment_method_screen), `_buildStep` (checkout_steps), `_SocialIconButton` (web_footer), `_socialIcon` (web_mobile_footer), `sort_bottom_sheet`'s `_buildSortOption`.
2. **Append `.data`** where a `FontAwesomeIcons` value flows into Flutter's own `Icon` widget — directly, or via a class/parameter that's *also* used with real `Icons.x` values (mixed usage, so the class stays `IconData`-typed). `FaIconData.data` is font_awesome_flutter's own maintainer-documented compatibility bridge (the 11.0.0 CHANGELOG documents the identical pattern for `find.byIcon(FontAwesomeIcons.foo.data)`) and returns the exact same wrapped `IconData` (same codePoint/fontFamily/fontPackage) the old literal API exposed directly — not a behavioural change, a type-correct unwrap. ~30 sites: `_ContactOption` (help_screen, 1 of 4 call sites), `_HeaderLink`/`_ActionIcon`/3 direct `Icon()` calls (web_header), `_FilterSection` + `_getAttributeIcon`'s 13 returns + 1 direct `Icon()` call (filter_drawer), `_ShareOption` (product_share_widget, 5 sites), `icon_picker_helper.dart`'s `kAppIcons` map (5 entries), `admin_order_details_screen.dart` (1 `_buildCardSection` call + 1 direct `Icon()` call).

One incidental fix, unrelated to font_awesome itself: `icon_picker_helper.dart`'s `kAppIcons` map was declared `const`; `.data` field access on a const `FaIconData` is not itself const-evaluable in this Dart version (`const_eval_property_access`), so the map's modifier was changed `const` → `final`. No observable behaviour change — the map's contents, keys, and lookup semantics are identical; only the theoretical (and here, unused) guarantee of true compile-time immutability is relaxed. Same issue hit once more in `filter_drawer.dart:303` (a single `const Icon(...)` call) — fixed by dropping `const` from that one widget instantiation, again with no observable difference.

Zero sites were left unmigrated. Nothing required a genuine rendered-behaviour trade-off — the `.data` bridge covered every case B1's evidence gathering worried might force one.

**S4 verdict: COMPLETE. Checkpoint: `f13717bf`.**

---

## S5 — Remove unused font_awesome_flutter declarations

Verified (not assumed) via `grep -rl "package:font_awesome_flutter" packages/dart/ui_kit/lib packages/dart/marketplace_ui_kit/lib` returning empty for both — zero imports in either package despite both declaring the dependency at `^10.7.0`. Removed the declaration line from both `pubspec.yaml`s. This was also load-bearing for S4's `pub get` to succeed at all (the unified workspace solver requires one font_awesome_flutter version across all 20 members), but is committed separately per this phase's own separate-concerns instruction, since it is a pure unused-dependency removal, not a functional migration.

**S5 verdict: COMPLETE. Checkpoint: `924ba5c9`.**

---

## S6 — Prove compilation, full regression, governance gate

### 6.1 — Real build attempt

`cd apps/customer_app && flutter build apk --debug` was attempted (Android SDK present, licenses partially unaccepted per `flutter doctor`). It failed — but at `google_maps_flutter_android:compileDebugKotlin`, a **native Android/Kotlin Gradle compilation stage**, downstream of and unrelated to the Dart/font_awesome_flutter fix (a pre-existing Kotlin-Gradle-plugin version mismatch: `google_maps_flutter_android`'s transitive Kotlin metadata is version 2.3.0, the project's Kotlin Gradle plugin expects 2.1.0). This is a real, pre-existing Android toolchain problem this phase did not cause and is out of scope to fix (Phase Q is scoped to font_awesome_flutter only). **This attempt is inconclusive for the Dart-compilation question** — not a pass, not a fail for what Stage 6 is trying to prove. Per the brief's own instruction ("If the Android toolchain is unavailable, say so explicitly and use the fallback"), fell back to 6.2.

### 6.2 — Kernel-compilation-forcing probe (the fallback actually used)

Built one temporary test per app (`_phase_q_compile_probe_test.dart`, deleted after use, never committed):
- **customer_app**: imports the real `letbuyy_marketplace/main.dart` entry point plus 3 font_awesome-importing production screens (`mobile_cart_screen.dart`, `payment_method_screen.dart`, `filter_drawer.dart`), touches a symbol from each.
- **admin_app**: imports `letbuyy_admin/main.dart` plus **both** of admin_app's font_awesome-importing files (`admin_order_details_screen.dart`, `icon_picker_helper.dart`) — admin_app only has 2 such files total, not the "at least three" the brief anticipated, so both (the maximum available) were used instead, noted explicitly rather than silently substituting.

Genuine before/after was captured by temporarily reverting all 18 modified files to their committed HEAD state (`git show HEAD:<path> > <path>` per file, the brief's own sanctioned pattern — never `git checkout`/`restore`/`stash`), saving the uncommitted diff to a patch file first (`git diff ... > patch`, restored via `git apply`), running `flutter pub get` to re-resolve to 10.12.0, running both probes (captured failure), then restoring via `git apply` and re-resolving to 11.0.0 (captured pass):

**Before (10.12.0, unfixed) — both apps, identical failure:**
```
Compilation failed for testPath=.../test/_phase_q_compile_probe_test.dart:
.../font_awesome_flutter-10.12.0/lib/src/icon_data.dart:6:30: Error: The class 'IconData' can't be extended outside of its library because it's a final class.
class IconDataBrands extends IconData {
...(9 more, identical pattern: Solid, Regular, Light, Duotone, Thin, SharpThin, SharpLight, SharpRegular, SharpSolid)
00:00 +0 -1: Some tests failed.
```
Exactly 10 distinct `extends IconData` errors — matching the CTO's own independently-reproduced count precisely.

**After (11.0.0, fixed) — both apps:**
```
customer_app: 00:00 +1: All tests passed!
admin_app:    00:00 +1: All tests passed!
```

Both probe files deleted immediately after the after-pass was captured; neither is part of any commit.

### 6.3 — Full regression sweep

| Check | Result |
|---|---|
| `flutter pub get` (workspace root) | PASS — 20/20 members resolve |
| `flutter test` merchant_app (canary) | **172/172 PASS** — unaffected, matches baseline exactly |
| `flutter test` marketplace_core | 165/165 PASS |
| `flutter test` marketplace_ui_kit | 54/54 PASS |
| `flutter test` customer_app | 13/13 PASS |
| `flutter test` admin_app | 11/11 PASS |
| `flutter analyze` — all 15 `packages/dart` members | 15/15 clean |
| `flutter analyze` customer_app | clean |
| `flutter analyze` admin_app | clean |
| `flutter analyze` phase_2/rider_app, phase_2/store_ops_app | 1 pre-existing error each (dead `widget_test.dart` `MyApp` boilerplate) — expected, untouched, matches baseline exactly |

415/415 total tests across the 5 suites, unchanged from baseline. No suite count moved.

### 6.4 — Real governance gate

Ran `node scripts/validate-governance.mjs` (real gate, not `--plan`). Result: **105 PASS / 6 FAIL** — exact match to the CTO's stated baseline. The 6 failures, by name: `foundation-antifabrication-gate.mjs`, `validate-design-system.mjs`, `sequential-migration-validator.mjs`, `raw-error-message-validator.mjs`, `environment-validator.mjs`, `branch-lag-guard-validator.mjs` — all 6 are the same pre-existing set documented in `17_remaining_migration_backlog.md` §7 before this phase started (`environment-validator.mjs`'s failure is the confirmed-benign `custom_payment_service.dart` public-sample false positive from S2, plus the pre-existing Firebase-client-identifier and `adminAuth.ts` false positives — see S2 above). **Zero new failures.**

Confirmed the documented node_modules hazard fired exactly as described: root `node_modules` survived, all per-package `node_modules` under `apps/`, `packages/`, `services/` were deleted (0 found post-gate, down from 51). Restored via `pnpm install --frozen-lockfile` (51 per-package `node_modules` restored, 2.5s — pnpm's content-addressed store makes this fast). `pnpm-lock.yaml` SHA-256 confirmed **byte-identical** before and after (`b4a8038d...`).

### 6.5 — Scope discipline

`git diff 21e6d465..HEAD --name-only -- '*pubspec.yaml'` → exactly 4 files: `apps/admin_app/pubspec.yaml`, `apps/customer_app/pubspec.yaml`, `packages/dart/marketplace_ui_kit/pubspec.yaml`, `packages/dart/ui_kit/pubspec.yaml`. All 4 are font_awesome_flutter-only changes (2 version bumps, 2 unused-declaration removals) — confirmed via full `git diff` content review, not just the file list. No other pubspec anywhere in the repo was touched.

**S6 verdict: COMPLETE. Real build inconclusive (unrelated pre-existing Android/Kotlin toolchain issue); probe fallback fully proves the Dart-level fix with genuine before-failure/after-pass evidence. Full regression clean. Gate matches baseline exactly, zero new failures. Scope discipline confirmed.**
