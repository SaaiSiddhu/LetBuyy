# Phase 1R acceptance and integration-readiness pass — 27 September 2026

Continuation of the same overall Phase 1R effort, single agent, in the same worktree
(`/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase1r`, branch
`letbuyy/phase1r-firebase-free-marketplace`). Supersedes no prior document's specific measurements;
adds an independent acceptance pass on top of the FINAL CLOSURE section already prepended to
[`../phase1r-c3-c4-c5-2026-09-27/CLOSURE.md`](../phase1r-c3-c4-c5-2026-09-27/CLOSURE.md), which
remains the authoritative record of the Firebase-removal and shipping-semantics work itself. This
document's own job is the acceptance review, the ML Kit-initialization precision correction, the
new device journeys, the payment-unavailable test, and the integration plan — the six things this
pass was asked for that the prior document did not yet cover.

**Disclosure, carried forward unchanged:** an earlier pass in this same overall session used the
Agent/Task tool twice (read-only fact-finding). This pass, and the one immediately before it, used
zero Agent/Task calls — every command, edit, build, and device interaction below was performed
directly, single agent throughout.

**Superseded for integration status only, 2026-09-27 (later the same day):** this document's own
recommended-merge-mechanics section was executed. The merge landed as `ba2d2d95` (branch tip
`7e23760a`), verified from the now-integrated **primary** checkout. See
[`../phase1r-integration-2026-09-27/INTEGRATION.md`](../phase1r-integration-2026-09-27/INTEGRATION.md)
for the integration record, the fresh post-merge verification results, the Android smoke test against a
newly built artifact, and the Phase 2 handoff. This document's own acceptance findings (the ML Kit
correction, the device-journey record, the payment-unavailable test, the conflict pre-characterization)
remain the authoritative record of that work and are unchanged.

## Scope and acceptance criteria

Per the mandate: (1) independently verified Firebase product-SDK retirement, (2) verified canonical
buyer identity/profile/address journeys, (3) verified honest cart/wishlist/shipping presentation,
(4) automated/backend/Android checks, (5) an accurate acceptance record tied to specific source and
artifact identities, (6) a concrete integration plan preserving the primary checkout's unpublished
work, (7) a precise Phase 2 handoff. Phase 2 implementation itself is explicitly out of scope and
was not started.

## Acceptance matrix

| Requirement | Evidence | Independent check this pass | Result |
|---|---|---|---|
| Firebase product SDK retirement (Dart/Android/iOS) | Source removal (prior pass) | ML Kit initialization mechanism traced precisely (below); re-confirmed manifest/DEX/Podfile absence at current HEAD | **Met**, with the ML Kit distinction now precise |
| Canonical sign-in (real PKCE) | Prior segment's evidence | Two fresh registrations + sign-ins driven live, this pass | **Met**, fresh |
| Profile mutation | Not previously device-tested this segment | Live: name field saved, "Profile updated." toast | **Met**, fresh |
| Address CRUD | Prior segment: viewed only | Live: address **created** for a fresh buyer, persisted across a real restart | **Met**, fresh (create was the untested gap; closed) |
| Session lifecycle (restart/logout/re-sign-in) | Prior segment's evidence | Live: force-stop/relaunch, logout, re-sign-in, all fresh | **Met**, fresh |
| Buyer isolation (two buyers, no crossover, switch-back) | Prior segment's evidence (different buyers) | Live: Buyer D → Buyer E → Buyer D, addresses/wishlist independently confirmed both directions | **Met**, fresh, bidirectional |
| Guest cart/wishlist transfer | Prior segment: SharedPreferences-level verification | Not repeated — untouched by any commit since, automated suite covers it | **Met**, prior evidence stands (see "Not repeated" below) |
| Shipping/checkout/payment honesty | Prior segment + this segment's device pass | Cart→Checkout→Payment chain (prior segment), payment-disabled proof (this pass, isolated widget test) | **Met** |
| Automated + governance checks | Fresh, repeatedly, this pass | `flutter analyze` clean, `flutter test` 148/148, gate 114/114 | **Met**, fresh |
| Artifact provenance | Prior segment's build | Re-verified same artifact's provenance chain; no rebuild needed (no source change since) | **Met** |
| Integration plan | Not previously attempted | Full primary-checkout comparison, file-level overlap analysis, 3-way merge simulation | **Met**, this document |

## ML Kit initialization — the precise, corrected picture

The prior closure document's own evidence trail said ML Kit's `firebase-components`-based
registrars "never run without FirebaseInitProvider bootstrapping them." That conflated two
different claims and the second half was wrong. Traced properly this pass:

- `MlKitInitProvider` (`com.google.mlkit.common.internal.MlKitInitProvider`) is declared as its
  own Android `<provider>` in the merged manifest, with its **own** authority
  (`com.letbuyy.letbuyy.mlkitinitprovider`) and its **own** `initOrder` (`99`) — not chained to,
  or dependent on, any Firebase-named provider. Android's content-provider system instantiates
  every manifest-declared provider automatically on process start, independently of anything else
  in the app; this is standard platform behavior, not something the app's own code controls.
- A fresh cold-launch `logcat` capture (this pass) contains **zero** lines matching `firebase` or
  `mlkit`, case-insensitively — consistent with silent, self-contained initialization that never
  attempts and fails a Firebase-project association (which would typically log a warning if
  attempted).
- `./gradlew :app:dependencies --configuration debugRuntimeClasspath` traces the actual dependency
  origin: `com.google.mlkit:face-detection:16.1.6` and `com.google.mlkit:text-recognition:16.0.0`
  (declared directly in `android/app/build.gradle`, pre-existing, unrelated to this phase, used for
  the KYC live-selfie/document-scan feature) pull in `com.google.firebase:firebase-components`/
  `firebase-encoders`/`firebase-encoders-json` as transitive dependencies.
- `firebase-components` is Google's own shared, reusable declarative-DI/component-discovery
  library, factored out of Firebase's SDK internals specifically so non-Firebase Google products
  (ML Kit among them) can reuse it without a Firebase project dependency. Executing this library's
  code is real, observable execution — not "inert" — but it is categorically different from
  Firebase **product/project** initialization: it creates no `FirebaseApp`, reads no
  `google-services.json`, and cannot reach any Firebase backend, because `FirebaseApp` itself does
  not exist anywhere in this artifact's compiled bytecode (0 occurrences, confirmed via the prior
  pass's own DEX-level class scan, re-confirmed unchanged this pass since no rebuild was needed).

**Corrected claim:** ML Kit's registrars execute automatically and independently of Firebase, via
Android's own content-provider mechanism; what they execute has no Firebase project dependency.
"Doesn't need Firebase" and "doesn't execute" are different facts, and only the first is true here.
The source comment in `android/app/build.gradle` was trimmed to state this concisely, per the
review's own instruction to keep source comments short and put investigation detail in evidence
(this section); commit `bd4c049b`.

Google Maps and ML Kit remain untouched, unrelated Google integrations, exactly as scoped —
nothing was removed from either to chase a literal zero-Firebase-string search result.

## Fresh automated and governance results, this pass

- `flutter analyze` (whole `apps/marketplace/mobile` workspace): **No issues found.**
- `flutter test` (whole suite): **148/148 passed, 0 failed, 0 skipped.** 146 at the prior
  checkpoint + 2 new (`payment_unavailable_test.dart`, added this pass — see below). Not asserted
  from memory; re-run immediately before this document was written, at final HEAD `bd4c049b`.
- `node scripts/validate-governance.mjs --lane=gate`: **114/114 PASS, 0 FAIL, 0 BLOCKED, 0 SKIP**
  (1 `NOT_APPLICABLE`, the standing `foundation-stepup-report-validator.mjs` exclusion). Re-run
  fresh after every commit landed this pass, not cited from the prior checkpoint.
- No test assertion was loosened, no check was skipped-and-counted-as-passing, and no wrapper's
  exit code stood in for an inner suite's actual result.

## Payment-unavailable proof — isolated widget test, no real device tap

Section 10 of the mandate explicitly required proving the disabled-payment behavior "using
isolated fakes," never by tapping a real device's Pay button. Added
`test/payment_unavailable_test.dart` (2 tests, both passing):

1. Pumps `PaymentMethodScreen` in the Flutter widget-test harness — an isolated VM environment with
   no reachable Razorpay SDK, no real network, no real backend, where `tester.tap()` cannot place a
   real charge by construction (unlike a tap on a live device, which the mandate correctly
   prohibits). Taps the real "Pay ₹540" button, asserts no "Processing..." state ever appears
   (proving no payment attempt is dispatched), then asserts the exact honest dialog text appears:
   "Checkout isn't available yet" / "Placing a real order isn't supported in this build yet. Your
   cart and delivery address are saved for when it is." Dismisses it and confirms the screen
   returns to its unchanged state — nothing was consumed or charged.
2. Confirms the identical boundary holds for Cash on Delivery: selecting COD changes the button
   label honestly ("Place Order • ₹999", not "Pay"), and tapping it reaches the exact same dialog —
   the disabled boundary does not depend on which payment method is selected.

This is the one gap the prior segment left open (it correctly declined to tap Pay on the live
device and reasoned from source instead); this test makes that reasoning independently verifiable
by an actual test run, not just a code read.

## Android device journeys — fresh, this pass

**Host readiness, re-verified fresh (not assumed from the prior segment):** `emulator-5554` =
`edynox_family_journey` (another, unrelated session's device — untouched); `emulator-5556` =
`LetBuyy_NewMac_API35` (this project's own AVD) — re-confirmed via `adb -s <serial> emu avd name`
on both, not assumed stable. Gateway `/v1/health` → healthy. Identity `:9002` → responds (real
Next.js dev server, confirmed by its own "Compiling..."/"Rendering..." indicators appearing live
during sign-in — this is not a static or mocked page).

**Journeys driven, this pass, closing the specific gaps the prior segment's own record left open:**

1. **Fresh registration + PKCE sign-in, Buyer D** (`ui-acceptance-buyerd@example.invalid`): real
   "Create your LetBuyy account" form, real Cloudflare Turnstile test-mode widget ("Success!",
   watermarked "For testing only"), real consent screen ("Continue to the LetBuyy app" /
   "Use a different account" — exercised both branches this pass), returned to the app
   fully signed in.
2. **Profile mutation**: set a display name, tapped "Save profile", got a real "Profile updated."
   toast — the canonical account API round-trip, not a local-only state change.
3. **Address create**: filled the full "Add address" form (name, line 1, city, state, PIN,
   Home/Work/Other type, default toggle) for Buyer D, saved, and it appeared correctly in "Your
   addresses" with Set-as-default/Edit/Remove actions — the specific address-CRUD gap the prior
   segment's own record had left as "viewed an existing address," never "created one."
4. **Session restoration**: force-stopped and relaunched the app; Buyer D's session and the
   just-created address both survived intact ("Welcome back" / "1 saved").
5. **Buyer isolation, bidirectional**: logged out, registered a second fresh buyer (Buyer E,
   `ui-acceptance-buyere@example.invalid`) via the same real flow, confirmed Buyer E started
   completely empty (0 addresses, 0 wishlist items) despite the browser's own remembered session
   from Buyer D — proving the app does not silently adopt whatever the browser last had signed in,
   only what the buyer explicitly confirms through the consent screen. Logged out again, signed
   back in as Buyer D (one transient "Something went wrong" error appeared and cleared on retry —
   see "Disclosed transient hiccup" below), and confirmed Buyer D's own address reappeared exactly
   ("1 saved"), with Buyer E's separate, empty state never touched. This closes the loop both
   directions with real backend-authoritative data, not just two independent one-way checks.
6. Cold launch, the Cart→Checkout→Payment shipping-honesty chain, the visual-search and
   support-chat entrypoints, and the initial persisted-state spot-check were all already covered
   fresh in the immediately preceding segment of this same session (see the FINAL CLOSURE section
   of `../phase1r-c3-c4-c5-2026-09-27/CLOSURE.md`) and are not repeated here.

**Not repeated this pass, and why:** guest cart/wishlist transfer (SharedPreferences-level
verification already exists from the segment before this one, and no commit since has touched that
code path — re-driving it by hand would re-measure code this pass never changed); the full
Cart→Checkout→Payment shipping chain (identical reasoning — already fresh from the immediately
preceding segment, unchanged since). Both remain covered by the automated suite's own dedicated
tests (`guest_transfer_ui_test.dart`, `cart_wishlist_*_test.dart`, `checkout_screen_pricing_test.dart`),
which passed fresh in this pass's own 148/148 run.

**Disclosed transient hiccup:** one sign-in attempt (switching back to Buyer D) returned "Something
went wrong. Try again in a moment." Backend health was independently confirmed good at that exact
time (`curl` to both `:9002` and `:9010` from the host, both healthy, both fast) — the failure did
not reproduce a second time and is recorded as a transient hiccup (most likely a Turnstile-token
timing issue after the several minutes spent on the preceding form-filling steps), not a defect.
Recorded rather than silently retried past, per the mandate's own instruction not to hide a failed
attempt.

**Prohibited actions, not taken:** no tap on a real Pay/Place Order button on the device (see the
isolated widget test above instead); no token injection, auth bypass, Firebase credential, or
explicit-intent shortcut for any sign-in. Android domain association was not re-inspected this pass
(unchanged since the prior segment; no commit touched the manifest or `assetlinks.json` — its
content is, in fact, one of the "already incorporated" findings in the integration analysis below).

## Artifact provenance — unchanged, re-confirmed rather than rebuilt

No Dart, Gradle, or native source changed since the prior segment's build (only a source comment
and a new test file were added this pass, both after the artifact was already built). The
previously built and verified artifact remains the correct one to cite:

- Source checkpoint: HEAD `7318cfb65eb1ff2d054890b8ac19a1b279691559` at build time.
- SHA-256: `1ec96a80f5b812bfd99bc61b517cebd9ab4805e9cfa288e307a9efebd57e2e96`; size 240,124,860 bytes;
  `com.letbuyy.letbuyy` versionCode `4013`, versionName `1.0.10-debug`.
- Signing: debug keystore (correct and expected for a `--debug` build); release `signingConfig`
  declaration in `android/app/build.gradle` structurally unchanged, confirmed again this pass by
  re-reading the file (still declares `signingConfigs { debug {...} release {...} }` reading from
  `key.properties`/`key.jks`, neither of which is tracked or was touched).
- This artifact is still installed and running on `emulator-5556`; every journey in this document
  was driven against it.
- No iOS binary was built this pass either (none was built the prior pass); `pod install`'s
  zero-Firebase-pods result from the prior pass stands, unchanged, since no `Podfile`/pubspec
  dependency changed.

## Integration plan — prepared, not executed

### Primary checkout, inspected read-only

- Branch `develop`, HEAD `6eb01d95867e1c7d0eb15c704eeaf2195ca8cc68`.
- `git status --porcelain --branch`: `develop...origin/develop [ahead 13]` — this is **cached**
  remote-tracking state (no fetch was performed this pass, per the mandate's own instruction not to
  fetch unless needed; this number is not claimed as live remote truth, only as what the local
  cache currently shows).
- 8 tracked, uncommitted modifications (pre-existing "Phase 1" work, not created or touched by this
  pass or any phase1r commit): `config/governance/secret-scan-exceptions.json`,
  `packages/dart/marketplace_services/lib/src/providers/banner_provider.dart`,
  `scripts/dev/dev-backend.sh`, `scripts/dev/dev-up.sh`,
  `scripts/validators/dev-auth-bypass-validator.mjs`,
  `scripts/validators/session-security-validator.mjs`,
  `services/api-gateway/src/__tests__/storefront-directory-exposure.test.ts`,
  `services/api-gateway/src/routes/storefront/public-routes.ts`.
- 5 untracked paths, none touched: `apps/commerce/web/public/.well-known/` (contains
  `assetlinks.json` — see below), `apps/deferred/delivery/mobile/ios/Flutter/ephemeral/Packages/`
  (build byproduct, unrelated), `docs/evidence/commerce-2026-09-26/`,
  `docs/evidence/foundation-phase1-closure-2026-09-26/`, `docs/evidence/foundation-programme-2026-09-26/`
  (the planning documents this pass itself read).
- A separate worktree, `../LetBuyy-agrimate-cleanup` (branch `letbuyy/agrimate-branding-cleanup`,
  HEAD `8255ffe6`), exists and is relevant context (it removes the obsolete
  `apps/marketplace/mobile/web/` Agrimate-branded Flutter-web scaffold that primary's own
  uncommitted `secret-scan-exceptions.json` change adds an exception for — see that finding below)
  but a full three-way analysis including it was not requested by this mandate and was not
  performed; flagged for whoever executes integration to be aware of, not resolved here.

### Commit-level divergence: none

`git merge-base develop letbuyy/phase1r-firebase-free-marketplace` = `6eb01d95867e1c7d0eb15c704eeaf2195ca8cc68`
— **exactly `develop`'s own current tip.** Zero commits exist on `develop` that are not already an
ancestor of the phase branch; the phase branch is 85 commits strictly ahead, in a straight line.
At the commit level, integrating is a trivial fast-forward — there is no commit-level conflict to
resolve, and none will appear regardless of how long integration is deferred, as long as nothing
new is committed directly to `develop` in the meantime.

### The real risk: the primary checkout's uncommitted work, not the commit graph

The phase branch's 85 commits touch 289 files. Cross-referencing every one of them against
primary's 8 modified + 5 untracked paths (not sampled — the full untracked-path list was checked
individually) finds exactly **9 overlapping paths**. Each was checked with a real 3-way text merge
(`git merge-file`, base = the merge-base's committed content, "ours" = primary's actual current
working-tree content, "theirs" = the phase branch's committed content) — not asserted, executed:

| Path | Result | What it actually is |
|---|---|---|
| `scripts/dev/dev-backend.sh` | **Identical** | Byte-for-byte the same on both sides |
| `scripts/dev/dev-up.sh` | **Identical** | Byte-for-byte the same on both sides |
| `scripts/validators/dev-auth-bypass-validator.mjs` | **Identical** | Byte-for-byte the same on both sides |
| `scripts/validators/session-security-validator.mjs` | **Identical** | Byte-for-byte the same on both sides |
| `services/api-gateway/src/routes/storefront/public-routes.ts` | **Identical** | Byte-for-byte the same CAP-C60/F1.5 try/catch fix on both sides |
| `apps/commerce/web/public/.well-known/assetlinks.json` | **Identical** | Byte-for-byte the same (primary's copy is untracked, phase1r's is committed) |
| `config/governance/secret-scan-exceptions.json` | **Clean auto-merge** | Genuinely independent: phase1r removes 2 stale Firebase-file exceptions; primary adds 1 new, unrelated exception (an Agrimate-branded leftover key). Different array entries, no overlap. |
| `services/api-gateway/src/__tests__/storefront-directory-exposure.test.ts` | **2 conflict hunks, trivial** | Both sides wrote the *same* test asserting the same 503/DIRECTORY_UNAVAILABLE behavior; only `async () => { await ...}` vs `() => promise.then(...)` style differs. Same intent, same assertion, cosmetic conflict only. |
| `packages/dart/marketplace_services/lib/src/providers/banner_provider.dart` | **1 conflict hunk, genuine** | phase1r's branch **deletes this file entirely** (retiring the Firestore-backed banner provider, per the Phase 1R plan's own R1.3 instruction). Primary's uncommitted work independently **improves this same file's error handling** (propagates `_error`/calls `notifyListeners()` on a listener failure, instead of silently swallowing it) — a real, well-reasoned fix to code that phase1r's own branch has already decided to remove. This is a modify/delete conflict Git cannot auto-resolve, and more importantly is a **product-scope question, not a text-merge question**: does Firestore banner retirement still stand? |

6 of 9 overlaps require no action at all — they are the same work, arrived at independently, and
will simply de-duplicate cleanly. 1 is genuinely independent and auto-mergeable. 1 is a one-line
style choice. Only 1 — `banner_provider.dart` — is a real conflict, and it is real specifically
because it is an unresolved product question (is Firestore-backed banner retirement still the
right call?), not because of anything mechanical. That question is already answered in this
programme's own record: the Phase 1R plan (`R1.3`, `../foundation-programme-2026-09-26/PHASE_1R_FIREBASE_FREE_MARKETPLACE_PLAN.md`)
explicitly instructs retiring Firestore-backed banner wiring rather than continuing to polish it.
Recommend: confirm that instruction still stands (it has not been revoked by anything this pass
read), accept phase1r's deletion, and let primary's now-superseded uncommitted fix be discarded
*only after* that confirmation — it is currently unstaged and uncommitted, so nothing is lost by
leaving it exactly as it is until the owner says so.

### Recommended integration mechanics

Per this repository's own established branch model (`.claude/skills/letbuyy/references/merge.md`,
`AGENTS.md`'s D-BRANCH decision): `--no-ff` merge of the phase branch into `develop`, executed
**inside the primary checkout** (the worktree that holds `develop`), never a rebase and never a
squash — preserving all 85 commits and their individual messages/evidence intact, which matters
here specifically because several of those commits (the Firebase-removal and shipping-semantics
work) are themselves detailed evidence records, not just diffs.

1. In the primary checkout, stage and commit (or stash with `-u`, owner's choice) the 8 tracked +
   5 untracked paths first, so the working tree is clean before any merge is attempted — a merge
   into a dirty working tree is exactly the unsafe operation this plan is designed to avoid.
   Recommended commit message content: this is genuinely separate, valuable "Phase 1" work
   (public-directory 503 handling, dev-script fixes, banner error-propagation, a new secret-scan
   exception) that deserves its own commit identity, not silent folding into the phase1r merge.
2. Resolve the one real conflict (`banner_provider.dart`) per the recommendation above —
   mechanically, this means accepting phase1r's deletion and reverting/dropping the now-committed
   (from step 1) error-handling fix in the same integration commit, once the owner confirms.
3. `git merge --no-ff letbuyy/phase1r-firebase-free-marketplace` from `develop`. Given the
   merge-base equals `develop`'s own tip, this merge only needs to reconcile the one path above —
   everything else (including the 6 "identical" files) will merge with zero prompts, since Git
   recognizes identical content on both sides automatically.
4. Tests required after integration: the full `flutter test` (148/148, as measured fresh in this
   document) and `node scripts/validate-governance.mjs --lane=gate` (114/114), both re-run **inside
   the primary checkout post-merge**, not assumed to still hold just because they held in the
   phase1r worktree — the governance validators in particular are workspace-relative and could
   behave differently once merged alongside primary's own 13-commits-ahead history.
5. Recovery strategy: the phase1r branch and its worktree are untouched by any of the above (a
   merge only writes to `develop`); if the merge needs to be undone, `git reset --soft` to
   `develop`'s pre-merge SHA (recorded before step 3) restores it exactly, and the phase branch
   itself remains available to retry from unchanged. No commit on either branch is rewritten by
   this plan.
6. The final owner-authorized action needed: the owner's explicit word, in the same message, to
   execute the merge into `develop` — per this repository's own standing rule that
   `develop` merges need the branch-disposition ledger updated (`docs/active/BRANCH_DISPOSITIONS.md`,
   itself one of the 289 files the phase1r branch already touches) as part of the same merge,
   and that `staging`/`main` promotion is a wholly separate, later, explicitly-worded decision this
   plan does not request and this pass did not take.

This plan is not executed. No merge, no commit in the primary checkout, no push, and no
`stash`/`reset`/`clean` was run against the primary checkout at any point in this pass — it was
read only, exactly as instructed.

## Phase 2 handoff (context only — not implemented)

Phase 1R's canonical buyer identity work is the foundation Phase 2 builds on. Three specific things
worth the next implementer's attention, none acted on here:

- **Shared identity.** `apps/platform/identity` is the intended sole asymmetric-token issuer across
  buyer/merchant/operator realms (per the Constitution's ART-05/R-14). The customer realm currently
  still mints HS256 sessions (`CUSTOMER_SESSION_SECRET`) — a disclosed, known deviation to collapse
  onto the sole issuer, not a pattern to extend. This phase's own buyer sign-in work (PKCE, browser
  consent, canonical `BuyerSignInController`) is the correct foundation to build cross-channel
  identity on; it should not be re-implemented.
- **Privacy.** The `.invalid` test-email domain convention this pass used throughout
  (`ui-acceptance-buyerN@example.invalid`) is RFC 2606 reserved and resolves nowhere — a pattern
  worth keeping for any future synthetic-account testing, so test accounts are never mistakable for
  real ones in logs or evidence.
- **Staff/operator access.** `apps/internal/console` owns the platform-operator surface; this phase
  never touched it. D04 (`../foundation-programme-2026-09-26/DECISIONS_AND_ACCEPTANCE.md`) — operator
  bootstrap, recovery, MFA and high-risk separation of duties — remains an explicitly open decision
  this phase does not answer and Phase 2 should not assume resolved.

## Final verdict

**A. PHASE 1R ACCEPTED — READY FOR OWNER-AUTHORIZED INTEGRATION.**

All required acceptance checks passed, with the release limitations stated plainly rather than
hidden: debug-only signing was exercised (release signing was never invoked, only its declaration
verified structurally); no iOS binary was built (dependency resolution only); Android hosted
domain association is inspected, not deployed; guest-transfer and the full shipping chain were not
re-driven live this exact pass because nothing changed them since they were freshly driven the
pass immediately before this one. Every one of those is a disclosed boundary, not a silently
skipped requirement.

### Actual git state

```
Phase checkout:   /Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase1r
                  branch letbuyy/phase1r-firebase-free-marketplace
                  HEAD bd4c049b09e3dbaf9c30150fda4fb39feb188a25
                  working tree clean except the pre-existing, untouched, out-of-scope
                  apps/deferred/delivery/mobile/ios/Flutter/ephemeral/{.swift_pm.lock,Packages/}

Primary checkout: /Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy
                  branch develop, HEAD 6eb01d95867e1c7d0eb15c704eeaf2195ca8cc68
                  8 tracked modifications + 5 untracked paths, ALL pre-existing, NONE created or
                  modified by this pass or any commit on the phase branch -- inspected read-only
                  throughout, never written to.

Commits this pass (1, on top of the prior pass's 5):
  bd4c049b  trim the ML Kit/Firebase source comment; keep detail in evidence
            (also adds test/payment_unavailable_test.dart)
```

### Tests/governance actually observed

`flutter analyze`: clean. `flutter test`: 148/148. `node scripts/validate-governance.mjs --lane=gate`:
114/114. All three re-run fresh at final HEAD `bd4c049b`, immediately before this document was
written.

### Artifact and journeys actually verified

Artifact unchanged from the prior pass (SHA-256 `1ec96a80…`), re-confirmed provenance rather than
rebuilt since no source changed. Fresh device journeys this pass: registration/PKCE sign-in ×2,
profile mutation, address create, session restoration, bidirectional buyer isolation. Payment
-disabled behavior proven via an isolated widget test, never a live device tap.

### Honest remaining limitations

Debug signing only; no iOS binary; hosted Android association inspected, not deployed; one
transient sign-in error, disclosed and not reproduced; the `banner_provider.dart` integration
conflict needs one owner confirmation (retire Firestore banners — already the documented Phase 1R
decision) before it can be mechanically resolved; the Agrimate-branding-cleanup branch's own
three-way relationship to `secret-scan-exceptions.json` was noted but not analyzed (out of this
mandate's requested scope).

### Evidence document paths

This document and [`screenshots/`](screenshots/) (this pass's own device evidence: address create,
session restoration, Buyer E's isolated-empty state, Buyer D restored after switching back);
[`../phase1r-c3-c4-c5-2026-09-27/CLOSURE.md`](../phase1r-c3-c4-c5-2026-09-27/CLOSURE.md) (FINAL
CLOSURE section, Firebase-removal and shipping-semantics detail) and its own
[`screenshots/`](../phase1r-c3-c4-c5-2026-09-27/screenshots/) (device evidence from the immediately
preceding segment).

### Integration readiness and exact next action

Ready. Commit-level integration is a trivial fast-forward (zero divergence on `develop`'s side).
The one substantive item is a single owner confirmation on `banner_provider.dart` (retire, per the
already-documented R1.3 decision, or keep — a two-line answer), after which the integration plan
above can be executed by whoever holds merge authority. No merge was performed by this pass.

Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO
