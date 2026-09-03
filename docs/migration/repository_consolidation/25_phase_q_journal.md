# 25 — Phase Q Journal: Re-Contain Recovered Credentials + Fix the Compile Blocker

**Execution mode: SINGLE AGENT. Subagents invoked: NO. Agent/Task delegation: NO. Background agents: NO. Parallel worktree agents: NO.**

Repository: `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`, branch `feature/claude-md-durable-architecture-memory`. One git root, no nested repositories.

## Stage table

| Stage | Title | Verdict | Checkpoint SHA |
|---|---|---|---|
| S0 | Preflight | COMPLETE | (this commit) |
| S1 | Re-contain the three literal-carrying files (Part A) | COMPLETE | `aedfd9eb` |
| S2 | Investigate the two flagged-but-clean files; environment-validator before/after | COMPLETE — 2 additional real secrets found, contained | `1aa27719` |
| S3 | Part B evidence — the four-option table | PENDING | |
| S4 | Part B execution — migrate all 15 font_awesome_flutter sites | PENDING | |
| S5 | Remove unused font_awesome_flutter declarations (ui_kit, marketplace_ui_kit) | PENDING | |
| S6 | Prove compilation + full regression sweep + governance gate | PENDING | |
| S7 | Documentation | PENDING | |

---

## S0 — Preflight

### Baseline reconciliation

CTO baseline: `HEAD 9420221c  tracked 8365  changed 39  staged 0  untracked 58  deletions 1`. Gate 105/6. Workspace 20/20. Toolchain Flutter 3.44.8 / Dart 3.12.2. Test suites: merchant_app 172, marketplace_core 165, marketplace_ui_kit 54, customer_app 13, admin_app 11 (415 total).

Measured:
```
HEAD:      9420221ca01683ee1274e60a524c040c07b0d69b  (EXACT MATCH)
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

**S1 verdict: COMPLETE. Checkpoint: `aedfd9eb`.**

---

## S2 — Investigate the two flagged-but-clean files; environment-validator before/after

### Validator logic read in full

`scripts/validators/environment-validator.mjs` (242 lines) read completely before touching either file. Two independent secret-detection paths: `hasUnexplainedSecretPattern` (5 key-SHAPE regexes: `sk/pk/rk_live|test_`, `whsec_`, `rzp_live|test_`, `AIza`, PEM headers — exempted only by a `fixtureMarkerPattern` on the containing line) and `hasHardcodedSecretAssignment` (a broader `secret|token|password|private_key|service_role`-adjacent assignment regex, exempted by several value-shape filters including an explicit `lowerValue.includes("test_")` check).

### custom_payment_service.dart — NOT a false positive; contained a real, previously-undiscovered secret

Content-blind `grep -ocE` against all 5 patterns found 3 matches for `rzp_(live|test)_` (0 for the other 4). Line-number/prefix-only extraction (never displaying full lines) found: line 49 = `rzp_live_`, line 89 = `rzp_test_`, line 122 = `rzp_test_`.

- **Line 49** (`openUpiPayment`'s checkout options map): confirmed genuine via content-blind SHA-256 hash comparison against `razorpay_config.dart`'s original pre-fix value (from `git show b2558ba1:...`) — **different hash, i.e. a distinct live Razorpay key**, not a duplicate of the one already fixed. Contained using the existing `RAZORPAY_KEY_ID` name (same purpose, different value).
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

**S2 verdict: COMPLETE — scope expanded beyond the brief's 3 named files by measured evidence (2 additional real secrets found and contained), 2 disclosed process incidents (both assessed low-severity, both non-repeating after correction). Checkpoint: `1aa27719`.**
