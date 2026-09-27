# Phase 1R local integration into `develop` — evidence record

2026-09-27. This document is the evidence record for the third and final owner-directed pass of
Phase 1R: safely integrating the accepted Phase 1R work (`docs/evidence/phase1r-acceptance-2026-09-27/ACCEPTANCE.md`,
verdict A — ACCEPTED) into the local primary `develop` checkout, verifying the integrated result, and
preparing the Phase 2 handoff. It is **not** a copy of `ACCEPTANCE.md` or `CLOSURE.md` — those remain
the record of what Phase 1R built and why. This document is the record of the integration action itself
and of what was verified afterward, from the **primary** checkout, against the **now-merged** tree.

## 1. Authorization and scope

The owner's message explicitly authorized "the LOCAL merge into `develop` described below" and bounded
the work to: preserve all existing primary-checkout work; reconcile it correctly with Phase 1R; merge
locally using repository-approved mechanics; verify the integrated result from the primary checkout;
produce honest evidence of the resulting git/service/Android state; and a precise Phase 2 handoff,
without implementing Phase 2. Not authorized, and not done: any push, remote PR, deploy, `staging`/`main`
promotion, force-push, history rewrite, payment activation, or interference with unrelated services.
Every action below stayed inside that boundary.

## 2. Original state of both checkouts

- **Primary** (`/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy`), branch `develop`, at
  `6eb01d95867e1c7d0eb15c704eeaf2195ca8cc68`, with a disjoint, uncommitted 8-file diff plus one new
  untracked file (`apps/commerce/web/public/.well-known/assetlinks.json`) already characterized in
  `ACCEPTANCE.md`'s integration-overlap analysis, plus two untracked evidence directories
  (`docs/evidence/commerce-2026-09-26/`, `docs/evidence/foundation-programme-2026-09-26/`).
- **Phase branch** `letbuyy/phase1r-firebase-free-marketplace`, worktree
  `/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase1r`, tip `7e23760aa046157e516d4661d292301d3082369c`
  ("docs(evidence): Phase 1R acceptance + integration-readiness pass"), already carrying
  `letbuyy/agrimate-branding-cleanup` folded in (confirmed, not assumed — see §6).

## 3. Preservation strategy and locations

Per the mandate's explicit prohibition on `git add .`/`-A`, blind `stash --all`, or any blanket
reset/clean, primary's own pre-existing work was preserved two ways, both completed **before** the
merge was attempted:

1. **Durable, access-restricted, out-of-repo copy**: `~/.letbuyy/preservation/primary-pre-integration-20260927-181701/`
   (`chmod 700`), containing a real patch of the 8 tracked modifications (`tracked-modifications.patch`,
   verified to apply cleanly with `patch -p1 --dry-run` against a clean `git archive HEAD` extraction —
   not against the already-dirty tree, which would have proven nothing), raw copies of the three
   untracked directories (verified byte-identical to the live content via `diff -rq`), the pre-integration
   `HEAD` SHA, and a `git status` snapshot at preservation time. This directory still exists, unmodified,
   as of this document.
2. **Explicit, attributed commits on `develop`** (not `git add -A`; each file named explicitly),
   made so the merge precondition (a clean working tree) could be met without discarding anything:
   - `d01fcccf` "docs(evidence): preserve untracked planning and Phase 1 closure research" — the two
     untracked evidence directories, 16 files, 1799 insertions.
   - `3b78dbf4` "preserve pre-existing Phase 1 uncommitted work ahead of Phase 1R merge" — the 8
     originally-modified tracked files plus the 1 new untracked file, 9 files, 257 insertions/46 deletions.

Both preservation commits are first-parent ancestors of the merge and remain in `develop`'s history
permanently; nothing was discarded.

## 4. Merge mechanics, exact SHAs

Followed `.claude/skills/letbuyy/references/merge.md` precisely (merges run inside the primary checkout,
D-MERGE-LOCATION, 2026-09-23 owner decision).

```
develop before this merge (= PRE, after the two preservation commits): 3b78dbf4306c72e12da81bc55a530a8defe3a493
merge-base:                                                             6eb01d95867e1c7d0eb15c704eeaf2195ca8cc68
second parent (phase1r branch tip):                                    7e23760aa046157e516d4661d292301d3082369c
merge commit:                                                          ba2d2d957178c58ed1ca0f78234198e45a5c4930
```

Because `develop` had gained two new commits (`d01fcccf`, `3b78dbf4`) since the phase branch forked, this
was **not** a fast-forward — the merge-base was recomputed (`6eb01d9`, the original common ancestor) and
the operation run as a real `--no-ff` merge, not asserted to be "trivial" at any point.

## 5. Conflicts and their resolution — both pre-characterized before the merge was attempted

`ACCEPTANCE.md`'s integration-overlap analysis (built from real 3-way `git merge-file` simulations
against scratch-extracted base/ours/theirs content, before either real checkout was touched) predicted
exactly two conflicts. Both occurred exactly as predicted:

1. **`packages/dart/marketplace_services/lib/src/providers/banner_provider.dart`** (modify/delete).
   Primary's `3b78dbf4` carried an uncommitted error-handling fix to this file; the phase branch deletes
   it entirely, retiring the Firestore-backed banner provider per Phase 1R's own R1.3. **Resolved as
   delete** — the retirement is the accepted decision (Firestore-backed, no canonical successor).
   Verified after resolution: `git rm` applied, 0 remaining imports/exports/consumers anywhere in
   `apps/marketplace` or `packages/dart` (5 textual matches, all retirement-explaining comments). The
   superseded fix is not lost — it survives in commit `3b78dbf4`'s own history and in the out-of-repo
   preservation copy, both independently recoverable.
2. **`services/api-gateway/src/__tests__/storefront-directory-exposure.test.ts`** (content). Both sides
   independently wrote the identical test asserting the identical 503/`DIRECTORY_UNAVAILABLE` behavior;
   only async/await vs. promise-chain style differed. **Resolved in favor of async/await**, matching
   every other test in the same file (verified by reading the whole resolved file, not just the conflict
   hunks). 0 coverage lost — confirmed: the resolved file still has all 10 of its tests, all passing
   (§8).

## 6. `letbuyy/agrimate-branding-cleanup` ancestry — verified, not assumed

The phase branch's own `docs/active/BRANCH_DISPOSITIONS.md` row (written before this integration pass)
claimed the branding-cleanup branch was already folded in. This was independently verified, not taken on
faith: `git merge-base --is-ancestor 8255ffe6 7e23760a` succeeded (exit 0), and the branding branch's own
deletions (`apps/marketplace/mobile/web/`, three dead payment files, the unused splash asset) were
confirmed absent from the phase branch tip by direct path check. It was **not** merged a second time.

## 7. One manual post-merge correction — the "clean auto-merge is not proof of semantic correctness" trap

`config/governance/secret-scan-exceptions.json` merged automatically, with no conflict. A grep after the
merge (per `merge.md`'s own resurrection-check discipline, not trusting the clean auto-merge) found it
had silently kept primary's `apps/marketplace/mobile/web/firebase-messaging-sw.js` exception entry, even
though the branding-cleanup half of this same merge deletes that entire directory. The entry's own
`retire_when` clause ("removed as dead weight") was satisfied by the merge that had just landed, so
carrying it forward would have been stale governance. Removed by hand (Edit tool, not a script) after
confirming: the referenced path no longer exists on disk; the resulting JSON is valid; the other,
unrelated, pre-existing entries (Google Maps key, letbuy-y Firebase key, three Razorpay sample-key
entries) are untouched.

## 8. Verification performed before committing the merge

`git diff --check` (0 conflict markers anywhere); app identity (`com.letbuyy.letbuyy`) and
`signingConfigs` declaration present and unchanged in `android/app/build.gradle`; `merge.md`'s full
retired-path resurrection list re-checked — 0 hits; 0 `*.jks`/`key.properties`/`.dev.vars`/`.env.local`
staged; 0 `node_modules`/`build`/`.dart_tool`/generated material staged; primary's own independent work
(the storefront 503→graceful-unavailable fix, `session-security-validator`'s console-mfa retargeting,
`dev-backend.sh`/`dev-up.sh`) directly confirmed present in the staged result by diffing against the
pre-integration baseline, not assumed present because the merge was clean.

**289 files changed** between `3b78dbf4` (develop before) and `ba2d2d95` (the merge): 9529 insertions(+),
55756 deletions(-) — 54 added, 127 deleted, 108 modified. Breakdown: `apps/marketplace/mobile` 147,
`packages/dart/marketplace_*` 100 (the branding-cleanup ancestry's web-target and duplicate-source
deletions), `docs/evidence` 36 (three new phase1r evidence directories + screenshots),
`config/governance` 2, `docs/active/BRANCH_DISPOSITIONS.md` 1, the one gateway test file 1,
`tests/governance` 1, `pubspec.lock` 1. Confirmed via `git reflog show develop -1` that the commit
recorded as a real merge (`commit (merge)`), not a fast-forward.

## 9. Ledger bookkeeping

Two follow-on commits, per `merge.md`'s own step 9 convention:

- `11ef9314` "docs(repo): record PHASE-1R merged into develop as ba2d2d95" — updated the phase1r row in
  `docs/active/BRANCH_DISPOSITIONS.md` in place (SHA, Status `ACTIVE`→`MERGED_DEVELOP`, Decided date,
  `Merged into`; original "Why" prose preserved verbatim, a new paragraph appended below it) and
  appended one new `PHASE-1R` row to `EXECUTION_LEDGER.md` covering all three passes of this effort.
- `322f2c82` "fix(governance): register the preserved Phase 1 prompt in PROMPTS.md" — see §10.

## 10. Verification from the integrated primary checkout (mandate §10)

Run **after** the merge, **from the primary checkout**, not carried over from the phase branch's own
measurements:

| Check | Result |
|---|---|
| `flutter analyze` (`apps/marketplace/mobile`) | Clean — "No issues found!" |
| `flutter test` (full suite) | **148/148 passed**, 0 failed, 0 skipped — matches the phase branch's own fresh 148/148 exactly |
| `node scripts/validate-governance.mjs --lane=gate` — first run | **113/114 PASS, 1 FAIL** (`prompt-perimeter-validator.mjs`) — a genuine deviation from the phase branch's own 114/114, investigated below |
| `node scripts/validate-governance.mjs --lane=gate` — after the fix | **114/114 PASS, 0 FAIL, 0 BLOCKED** — matches the phase branch's own figure exactly |
| `storefront-directory-exposure.test.ts` (the reconciled file, `tsx --test`) | **10/10 passed** |
| Full gateway `test:unit` (`tsx --test services/api-gateway/src/__tests__/*.test.ts`) | **1106 tests, 1095 pass, 0 fail, 9 skip, 2 todo** |
| `tests/governance/shell-scripts.test.mjs` (covers the reconciled `dev-backend.sh`/`dev-up.sh`) | **3/3 passed** |

**The one deviation, investigated and fixed, not forced:** `prompt-perimeter-validator.mjs` failed
because commit `d01fcccf` (§3) preserved `docs/evidence/foundation-programme-2026-09-26/PHASE_1_CLAUDE_CODE_PROMPT.md`
verbatim, and that file's basename matches the repository's PROMPT-class token, requiring registration in
`PROMPTS.md`. This is a direct, traceable consequence of preservation, not a Phase 1R regression — the
phase branch's own tree never contained this file. The file is a genuinely spent, already-superseded
prompt (its own header says so, naming the sibling `PHASE_1R_FIREBASE_FREE_MARKETPLACE_PLAN.md` as its
replacement) — matching the same situation `PROMPTS.md`'s own pre-existing
`EXECUTED-SAFE-DELETION-CERTIFICATION` row documents for a different file. Fixed with one new
`EXECUTED-DO-NOT-RERUN` registry row (commit `322f2c82`); the file was left in place rather than moved,
since moving it out of the evidence directory it was preserved with would break that directory's own
internal cross-references for no governance benefit.

## 11. Backend/service provenance (mandate §11) — and a second genuine finding, fixed

A healthy server is not proof the *integrated* checkout is what is running. Checked directly, not
assumed:

- **Provenance, confirmed by process inspection**: both the identity-platform (`:9002`) and
  api-gateway (`:9010`) processes' own binary paths and working directories are rooted in the **primary**
  checkout (`/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy/...`), not the phase1r worktree.
- **Currency, confirmed by diff, not assumed**: `git diff --name-only 3b78dbf4..ba2d2d95 -- services/api-gateway apps/platform/identity`
  shows the merge touched **zero** files under `apps/platform/identity` and exactly **one** file under
  `services/api-gateway` — the test file resolved in §5, which is not part of the deployed Worker bundle.
  The already-running processes' actual served source was therefore byte-for-byte unchanged by this
  merge; no restart was needed for *correctness*.
- **A second, genuine, unrelated finding**: attempting to exercise the real sign-in flow (§12) surfaced
  that `services/api-gateway`'s `wrangler dev` process (PID `31864`/`31925`, alive and bound to `:9010`
  since 2026-09-26 17:29, over a day of uptime) was **wedged** — the TCP listener accepted connections but
  never returned an HTTP response (`curl` timed out after 5-10s on every route, including the bare root).
  This is very likely the same class of failure behind this session's own earlier, previously-unexplained
  transient sign-in error (flagged at the time as not to be blamed on Turnstile without proof) — this time
  there is direct, reproducible evidence of a hung gateway, not a guess. **Fixed**: the hung process was
  killed and a fresh one started via `pnpm run dev` (the same way `turbo run dev` starts it), confirmed
  healthy (`HTTP 401` in 54ms on the bare root — a real, fast, application-level response, not a timeout).
  `identity-platform` was also restarted the same way, since its own long uptime made it a second
  reasonable suspect for stale state; after both restarts the real sign-in flow (§12) succeeded cleanly.
  **Not investigated further, and honestly left open**: why the gateway wedged after roughly a day of
  uptime. No stdout/log capture existed for the original process (it predates this session and was not
  launched with output redirected to a file), so no stack trace or error was recoverable from it — only
  its behavior (bound, unresponsive) was observed. This is named explicitly in the Phase 2 handoff (§14).
  `services/mobile-bff`, `services/webhook-service` and `services/queue-workers` were left untouched
  (out of scope — nothing in this integration touches them, and they answered normally throughout).

## 12. Android smoke test — fresh artifact, integrated primary checkout

**Artifact.** Built from the **integrated primary checkout's** own `apps/marketplace/mobile`
(a new build, not the phase1r worktree's APK used earlier in this programme):

```
flutter build apk --debug \
  --dart-define=API_BASE_URL=http://localhost:9010/v1 \
  --dart-define=IDENTITY_BASE_URL=http://localhost:9002 \
  --dart-define=APP_ENV=local \
  --dart-define=LETBUYY_BUYER_SIGN_IN=true
```

`applicationId=com.letbuyy.letbuyy`, `versionCode=4013`, `versionName=1.0.10-debug`, `targetSdkVersion=35`
(`aapt2 dump badging`) — identical identity to every prior build in this programme. SHA-256:
`c77cb43bc94de153cc6a773bdd2f05f11d7d8433471784eaf3f35e8c96ff8f4c`. `git status --porcelain` was
unchanged by the build (Gradle wrote no tracked file).

**Device.** `emulator-5556` re-discovered and its AVD identity **verified, not assumed**:
`adb -s emulator-5556 emu avd name` → `LetBuyy_NewMac_API35` (a second, unrelated AVD, `edynox_family_journey`,
also exists on this machine and was not used). Installed via a clean `adb uninstall` + `adb install`
(not a `-r` reinstall over the phase1r worktree's old build), so every result below reflects this build
alone, with no carried-over app data. `adb reverse tcp:9010 tcp:9010` and `tcp:9002 tcp:9002` set up so
the app's `http://localhost:...` dart-defines resolve correctly from the emulator's network namespace.

**8-item coverage, all exercised live, screenshots in `screenshots/`:**

1. **Cold launch** — real marketplace home screen, teal branding, honest "Special offers coming soon!"
   empty state, no crash (`01-cold-launch-no-firebase-gate.png`). No Firebase-era login gate appears
   anywhere in the flow — the profile tab goes straight to "One account for the LetBuyy app and every
   LetBuyy store" / "Sign in with LetBuyy", confirming Phase 1R's core change end to end.
2. **Canonical sign-in + session restoration** — Buyer D signed in via identity-platform's real Custom
   Tab (`localhost:9002`, Cloudflare Turnstile "Success!" test widget, real, not mocked), landed back in
   the app authenticated (`02-signin-page-buyerd-cached-session.png`). Buyer E signed in via a **fresh**
   password credential (not a cached cookie), Turnstile-gated (`05-buyere-real-turnstile-password-signin.png`).
3. **Profile read + update** — Buyer D's profile ("AcceptanceBuyerD" era name) read correctly; changed to
   "AcceptanceVerified" and saved — real "Profile updated." confirmation
   (`03-profile-updated-confirmation.png`), not a client-side-only change.
4. **Address CRUD** — Buyer D's existing address (221C Baker Street, Bengaluru, Karnataka, 560002)
   correctly displayed with Edit/Remove/Set-as-default/Add affordances, and correctly pre-selected as the
   real checkout flow's delivery address (§12 cart/checkout walkthrough below).
5. **Restart persistence** — `adb shell am force-stop` (a full process kill) + fresh relaunch: session
   still authenticated with no re-sign-in, and the profile-name change from item 3 re-fetched fresh from
   the backend, not a stale local cache (`04-profile-name-persisted-after-restart.png`).
6. **Logout / buyer-switch, bidirectional isolation** — signed out of Buyer D; signed in fresh as Buyer E;
   **Addresses: 0 saved** — correctly isolated, not a leaked view of Buyer D's data
   (`06-buyere-isolated-zero-addresses.png`); signed out, signed back in as Buyer D; **Addresses: 1 saved**
   — correctly restored, not lost (`07-buyerd-restored-one-address-intact.png`). Full round-trip, both
   directions.
7. **Cart / wishlist / shipping spot-check** — a real catalog product ("C5 QA Test Product", ₹499,
   Store One) added to cart with a real "Added to cart!" confirmation
   (`08-added-to-cart-confirmation.png`); the cart honestly shows "Calculating delivery charge…" /
   "Shipping Fee: Calculating…" / "Total Amount: Calculated at checkout" — never a fabricated ₹40 or
   invented total (`09-cart-honest-shipping-calculating.png`). Wishlist independently confirmed empty
   ("0 items") for both buyers, honestly, not fabricated.
8. **Honest unavailable states** — "My Orders: Not available" and "Notifications: Not available yet" on
   the profile screen; on the real checkout → payment-method screen, "Shipping Fee: Pending" /
   "Total Amount: Calculated at checkout", and the "Pay" button itself renders with **no amount**
   (`10-payment-honest-pending-no-fabricated-total.png`) — exactly the `total != null ? ... : "Pay"`
   logic read in `payment_method_screen.dart`'s source. **Per the mandate's explicit instruction, Pay was
   never tapped.** The disabled/unavailable behavior itself is proven by the isolated
   `payment_unavailable_test.dart` widget test (2 tests, part of the 148/148 in §10), which is the
   correct mechanism for this proof — a real device tap was neither needed nor performed.

## 13. Honest limitations, carried forward

- The gateway-wedge root cause (§11) is fixed by restart, not diagnosed to its origin — no log capture
  existed for the original process. Named as a Phase 2 starting point (§14).
- iOS was not built or run this pass (Android only, matching every prior pass of this programme).
- The Flutter web target and its Agrimate-branded assets were deleted by `agrimate-branding-cleanup`
  (already accepted, not reopened here).
- Neither `apps/deferred/delivery/mobile` nor any donor/reserved/frozen root was touched.
- The two `BLOCKED_DECISION`s from earlier SUSTAINED-series work remain open for the owner; nothing here
  resolves them.

## 14. Phase 2 handoff

Not implemented here, per the mandate. Five evidence-backed starting points:

1. **Shared identity/session/token ownership.** `identity-platform` is the sole asymmetric-token issuer
   for the buyer, merchant/staff and platform-operator realms (ART-05/R-14); the marketplace app now
   authenticates through it exclusively (this phase's own core change). The customer-realm HS256 session
   (`CUSTOMER_SESSION_SECRET`) remains a known, unresolved deviation from the sole-issuer target — not
   touched by Phase 1R, still open.
2. **Privacy/account-data boundaries.** `buyer_accounts` is the one cross-store buyer principal
   (D-ONE-BUYER); this pass re-confirmed bidirectional data isolation between two real buyer accounts
   live, end to end, through the now-integrated stack (§12 item 6). No new boundary work was needed or
   attempted.
3. **Staff/operator bootstrap/recovery/MFA/high-risk authorization.** Out of this phase's scope entirely;
   untouched. `apps/internal/console`'s own console-mfa path is the nearest existing surface, referenced
   only incidentally via the reconciled `session-security-validator` retargeting (§7 of `ACCEPTANCE.md`,
   already accepted).
4. **The gateway-wedge finding (§11 of this document).** A `wrangler dev` process, left running roughly a
   day, stopped answering HTTP requests while remaining bound to its port. Reproduced once, fixed by
   restart, root cause not established. Worth a bounded investigation before relying on long-uptime local
   dev servers for future device-testing passes: capture stdout/stderr to a file at process start (this
   session's own restart did so, using `nohup ... > file 2>&1 &`, which future sessions can imitate), and
   consider whether `wrangler dev`'s known behaviors around D1/KV/Queue local-state or its inspector
   socket are implicated.
5. **Decisions open vs. already accepted.** Already accepted and not to be reopened: Firestore-backed
   `BannerProvider` retirement; canonical profile/address/cart/wishlist/guest-transfer behavior; unknown
   shipping stays unknown rather than fabricated; payments stay unavailable pending a real integration;
   app identity/signing preserved; ML Kit's `firebase-components`/`firebase-encoders` dependency is a
   separate, non-Firebase-project concern, never grounds for removal. Still open: both `BLOCKED_DECISION`s
   from the SUSTAINED-series work (staff-membership mechanism, operator identity integration); D-ID
   (commit-identity/trailer policy); the customer-realm HS256-vs-sole-issuer collapse (item 1 above).

## 15. Final verdict

**A — complete and verified.**

- Primary branch/HEAD: `develop` @ `322f2c825d0ae04714dd8af0b3582a3805e0fc11`.
- Phase branch/HEAD: `letbuyy/phase1r-firebase-free-marketplace` @ `7e23760aa046157e516d4661d292301d3082369c`
  (worktree preserved, untouched, at this same SHA).
- Integration/preservation commits created (5, all on `develop`, all attributed): `d01fcccf`, `3b78dbf4`,
  `ba2d2d95` (the merge), `11ef9314`, `322f2c82`.
- Remaining tracked/untracked changes: none tracked (`git status --porcelain` shows only the
  pre-existing, correctly-ignored-in-spirit `apps/deferred/delivery/mobile/ios/Flutter/ephemeral/Packages/`
  build byproduct, present since before this task began, owned by the workspace's own tooling).
- Preservation location and recovery: `~/.letbuyy/preservation/primary-pre-integration-20260927-181701/`
  (§3), verified-recoverable, untouched, still present.
- Automated/governance/backend results actually observed: §10 (148/148 Flutter tests, 114/114 governance
  gate after one genuine fix, 10/10 + 1106-test gateway suites, 3/3 shell-script governance) and §11
  (service provenance confirmed, one genuine wedge found and fixed).
- Android artifact/journeys actually verified: §12, fresh artifact, 8/8 smoke-coverage items, all with
  screenshot evidence, Pay never tapped.
- Remaining blockers/limitations: §13, all named honestly, none blocking this task's own completion.
- Evidence paths: this document; `screenshots/` (10 files) alongside it; the preservation directory in
  §3; `docs/evidence/phase1r-acceptance-2026-09-27/ACCEPTANCE.md` (the prior, still-valid acceptance
  record this integration executed against).
- Exact next Phase 2 task: none prescribed here, per the mandate — §14 names five evidence-backed
  starting points for the owner to sequence.
- **No push, deploy, `staging`/`main` promotion, or payment execution occurred at any point in this pass.**
  Both worktrees (`LetBuyy-phase1r`, `LetBuyy-agrimate-cleanup`) were preserved exactly as instructed,
  untouched. All preservation backups remain intact and recoverable.
