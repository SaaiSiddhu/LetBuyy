# SUSTAINED-L — marketplace account UI, cloud-to-local handoff

Owner-directed, budget-bounded phase: connect `apps/marketplace/mobile`'s profile/address UI to the
canonical buyer APIs and Dart client SUSTAINED-K already built (D5's remaining client-UI gap). Built,
tested, committed, pushed. **Not merged into `develop`** — the full TS-side governance gate
(`gate.sh`) was not re-run, to stay inside the owner's stated budget; only Dart-side verification
(`flutter analyze`, `flutter test`) was run. Per the owner's own instruction ("do not waive gates to
simplify handoff"), this stays a preserved branch until a session verifies it against the real gate.

## STOP — Phase 2 (test-reliability task) ended mid-work, budget exhausted

A follow-up task asked this branch to fix a cold-font-cache isolated-test failure noted in Phase 1's
own report below, harden the widget test suite against test-order/font-cache dependence, and add a
genuine account-switch (Buyer A → Buyer B) regression test. That work found and fixed **one real
production bug**, and made real progress on the font-independence goal, but the cloud session ran out
of budget (~$7 remaining, user-directed stop) with the **new test's reliability not established**.
**The commit below (`639ca1b`) is an honest WIP checkpoint, not a verified-green state.** See
"Phase 2 — what actually happened" further down for the full, unvarnished account. Do not treat
anything in the ORIGINAL Phase 1 sections below this notice as re-verified against `639ca1b`.

## Repository and branches

Canonical repository: `https://github.com/SaaiSiddhu/letbuyy.git`

| Branch | SHA | Remote verified | Status |
|---|---|---|---|
| `develop` | `ffcd124` | yes — `origin/develop` = `ffcd124` (`git ls-remote origin` at time of writing) | unchanged; contains SUSTAINED-J + SUSTAINED-K only |
| `letbuyy/sustained-l-marketplace-account-ui` | `639ca1b` | yes — pushed, `origin/letbuyy/sustained-l-marketplace-account-ui` = `639ca1b` (verified via `git ls-remote origin` immediately after this push) | **ACTIVE, unmerged, WIP checkpoint** — Phase 1 implementation (`ca0be93`) + Phase 2's unfinished fix/test (`639ca1b`) |
| `letbuyy/checkpoint-theme-cli-mode` | `145e330` | yes — pushed | unrelated, pre-existing, unattributed executable-bit change on `packages/theme-engine/src/theme-cli.ts` — never merge without the owner's word on whether it was intentional |

`staging`/`main`: unchanged throughout, at `1e6cc4c3` on origin (confirmed via `git ls-remote origin`
in this same stop sequence).

**Exact branch to resume locally:** `letbuyy/sustained-l-marketplace-account-ui`, at `639ca1b`.

## Phase 2 — what actually happened (read this before trusting anything below)

**The production bug found and fixed (real, and the fix is believed correct):** in
`letbuyy_account_screen.dart`'s `_load()`, all three paths that discard a stale response for a
buyer who is no longer current (`if (!_stillCurrent(token)) return;` — one each in the success path,
the `on ApiException catch`, and the generic `catch`) returned **without resetting `_loading` to
`false`**. `build()`'s own reload-trigger (`if (controller.token != _tokenAtLastLoad && !_loading)`)
requires `_loading == false` to fire again. So a genuine account switch — Buyer A's in-flight
response discarded because Buyer B is now signed in — left `_loading` stuck `true` forever, and the
screen never reloaded for Buyer B; it just showed the spinner permanently. Fixed by adding
`setState(() => _loading = false);` before `return;` in all three discard branches. This fix was
traced through step-by-step with temporary diagnostic prints (since removed) and confirmed doing the
right thing: the discard branch correctly fires (`_stillCurrent` returns `false` for Buyer A's stale
token), `_loading` correctly clears, and `build()`'s reload-trigger correctly re-fires `_load()` for
Buyer B's now-current token.

**The new test** (`'a stale in-flight response for Buyer A is never applied once Buyer B is
signed in'`) drives this for real: Buyer A signs in, the screen's own initial load is held open via a
new per-token hold on `FakeGateway` (`holdToken`/`releaseHeldToken`), Buyer B signs in for real
through `BuyerSignInController.signIn()` (not by reaching into private state) while Buyer A's
response is still outstanding, and only then is Buyer A's held response released — asserting it is
discarded and the screen correctly reloads and shows Buyer B's data. Building this required two
supporting test-harness fixes, both real pre-existing bugs in the test file, not new ones:
1. `_MemoryStore.readPending()`/`writePending()` were both no-ops — no test before this one ever
   drove a real `signIn()`, so nobody had noticed the fake session store couldn't actually hold a
   pending sign-in attempt. Fixed to genuinely store/return it.
2. `_ScriptedBrowser`'s default `code` parameter used `'B' * 43`, which is not a valid Dart constant
   expression (String has no `*` operator) — this class had been added but never actually exercised
   by a passing test before now. Fixed to a literal 43-character string.

**The 12 pre-existing tests** in this file were also refactored: every `tester.runAsync(() async {
tap; await Future.delayed(100ms); })` pattern was replaced with `tap; await pumpUntil(tester, () =>
<observable condition>);` — condition-polling on real state (a gateway counter, rendered text) instead
of a fixed sleep. This refactor, plus a new `test/flutter_test_config.dart`
(`GoogleFonts.config.allowRuntimeFetching = false`, preventing real network font fetches), was
verified earlier in this same session to make all 12 of those tests pass individually in fresh
processes, twice in a row for the whole file, and 58/58 for the full app suite. **That verification
was NOT re-run after this checkpoint's changes to shared test helpers** (see "not re-verified" below)
— it should still hold, since the shared helper changes are additive, but this is not proven.

**What is NOT verified — the actual reliability problem.** The new account-switch test's post-release
wait (waiting for Buyer B's reload to render) was flaky across roughly ten isolated `--plain-name`
runs made in the last hour of this session: sometimes passing in ~1-7 seconds, sometimes failing via
an **unhandled `google_fonts` exception** (`"GoogleFonts.config.allowRuntimeFetching is false but
font Poppins-SemiBold was not found in the application assets"` — a real, package-internal unhandled
async rejection, not swallowed on purpose; see "Font-loading test setup" below), and — in several
earlier iterations of this same test, before the current structure — via a request that was
demonstrably issued (confirmed via `print` tracing) but never reached `FakeGateway`'s Dio interceptor
when polled with a manual millisecond-granularity `tester.pump()` loop, even given timeouts up to 120
seconds. **A pure-Dart reproduction script** (no Flutter widgets, no `tester.pump`, run via plain
`dart run` against the same `FakeGateway`/`ApiClient`/`BuyerAccountApi`/`BuyerAddressApi` classes,
same request sequence: Buyer A restore → held load → Buyer B restore → release → Buyer B reload)
**completed correctly in under 1 millisecond** — this is strong evidence the underlying request/fix
logic is correct, and that whatever is unreliable is specific to how this particular test drives
Flutter's widget-test pump/`runAsync` machinery (a known class of subtlety — real-async-zone vs.
fake-async-test-zone boundaries — that this session's own earlier work on the other 12 tests had
already run into once). Switching the final wait from a manual `pumpUntil` loop to
`tester.pumpAndSettle()` measurably helped (multiple clean passes at 1-7s afterward, versus
consistent failure/timeout before), but did not make it reliable — the google_fonts exception still
surfaced on a meaningful fraction of runs afterward. **Do not report this test, or the full suite, as
passing/deterministic without re-running it yourself and observing the actual result.**

**Do not weaken or delete the new test to make it "pass."** It is exercising something real and its
assertions (Buyer B's data appears, Buyer A's does not) are exactly what was asked for. The work
still needed is making its own async plumbing reliable, not changing what it checks.

## What this phase completed

A signed-in LetBuyy buyer (behind the existing `LETBUYY_BUYER_SIGN_IN` flag, **still default-off in
production**) can now, from a new "Manage profile & addresses" button on the existing "LetBuyy
account" card:
1. View their canonical cross-store profile (email, full name, phone).
2. Edit full name and phone through the real `PATCH /storefront/buyer/profile` route.
3. List their canonical cross-store saved addresses.
4. Add an address.
5. Edit an address.
6. Delete an address, with a confirmation dialog.
7. Set an address as the default (the backend contract supports this; the UI exposes it).
8. See loading, empty, validation-failure, server-failure and expired-session states, each with a
   distinct message — no state is ever silently swallowed into a generic "something went wrong".

New file: `apps/marketplace/mobile/lib/screens/profile/letbuyy_account_screen.dart`. This is a
**separate** screen from the pre-existing, Firebase-era `edit_profile_screen.dart` /
`saved_addresses_screen.dart`, which read/write `store_customers`/`customer_addresses` (a different,
already-complete, per-store realm, D-ONE-BUYER) and remain completely untouched.

Small, targeted changes to wire it in:
- `BuyerSignInController` now caches the buyer's session token in memory (mirrors how `email` was
  already cached), cleared at every point `email` already is cleared.
- `buyer_sign_in_wiring.dart` gained `buildBuyerAccountApi()`/`buildBuyerAddressApi()`.
- `main.dart` registers two new lazy `Provider`s (account/address APIs), flag-gated the same way the
  sign-in controller already is.
- `app/routes.dart` gained one new named route, `AppRoutes.letbuyyAccount`.
- `widgets/letbuyy_account_card.dart` gained the entry-point button, shown only when signed in.

Two real bugs were found and fixed while building this (not pre-existing — introduced and fixed
within this same phase, both explained in the commit message on `ca0be93`):
1. `ApiClient` wraps every Dio connection failure as `ApiException(code: 'NETWORK_ERROR')`, never a
   bare exception — the screen's original offline-message branch was unreachable dead code until
   fixed to check `error.code`.
2. The screen's own "reload if the signed-in buyer changed" check only recorded a *successful* load,
   so a *failed* load re-triggered itself on every subsequent rebuild, forever. Fixed by recording the
   attempt regardless of outcome — a retry is now only ever user-initiated (pull-to-refresh, the error
   view's Retry button).

## Font-loading test setup (Phase 2)

`apps/marketplace/mobile/test/flutter_test_config.dart` (new file, applies to every test in `test/`):
```dart
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  GoogleFonts.config.allowRuntimeFetching = false;
  await testMain();
}
```
This prevents real network font downloads, but does **not** prevent `google_fonts` from throwing when
a font isn't found locally either (no font assets are bundled for tests) — that exception is real and
still happens; it's just no longer network-dependent or order-dependent in the way Phase 1's report
described. `letbuyy_account_screen_test.dart` additionally defines `_absorbPendingFontFailures()`,
called on every iteration of the shared `pumpUntil` helper's poll loop:
```dart
void _absorbPendingFontFailures() {
  GoogleFonts.pendingFonts().then((_) {}, onError: (_) {});
}
```
`GoogleFonts.pendingFonts()` is `google_fonts`' own documented testing API
(`Future.wait(pendingFontFutures)`) for adopting its internal fire-and-forget font-load futures. This
call is **not awaited** (fire-and-forget itself, deliberately, since some of these loads do real
device-filesystem I/O that would otherwise stall the poll loop) — it only attaches a handler so the
eventual rejection is "seen" and doesn't get reported as an unhandled zone error. **This measurably
reduces, but does not eliminate, the leaked-exception failures described above** — it is a mitigation
proven partially effective by repeated runs, not a proof of correctness, and two cheaper alternatives
(attaching a handler directly to each individual future; only re-checking when
`pendingFontFutures.length` grows) were tried and empirically rejected as insufficient (see the
helper's own doc comment in the test file for the reasoning). **Do not describe swallowed font errors
as harmless without your own fresh verification** — they may indicate the test is not actually
reaching the state it claims to have reached.

## Remaining arbitrary delays / polling / timeouts — an honest list

- `pumpUntil(tester, condition, {timeout, pumpDuration})` (shared helper): polls `condition()` on a
  loop, `await`ing `tester.pump(pumpDuration)` (default 1ms) between checks, bounded by `timeout`
  (default 5s). This is condition-driven, not a fixed sleep, but the **poll interval itself is a
  tunable magic number** — the new account-switch test passes `pumpDuration: Duration(milliseconds:
  20)` for its two `pumpUntil` calls (vs. the file's default 1ms) as an empirical tweak whose actual
  effect was not conclusively isolated before the stop.
- The account-switch test's final wait uses `tester.pumpAndSettle()` instead of `pumpUntil`, because
  `pumpUntil`'s manual poll loop demonstrably left that specific request stuck (see above).
  `pumpAndSettle()` cannot be used for the *earlier* waits in the same test (waiting for Buyer A's
  held, perpetually-spinning load) because an indeterminate `CircularProgressIndicator`'s repeating
  animation would make `pumpAndSettle()` itself never converge.
- No test in this file uses a bare `Future.delayed`/`sleep` for synchronization anymore (Phase 1's own
  report flagged this as the thing to fix; Phase 2 refactored all 12 pre-existing instances). The
  remaining risk is entirely the font-exception race and the pump/runAsync flakiness above, not
  arbitrary sleeps.
- Test-order/cache dependence: **not independently re-verified in Phase 2.** Phase 1's claim (later
  investigated) was that an isolated run failed on a cold font cache while the full suite passed
  because earlier tests had warmed it. The `pumpUntil` refactor plus `allowRuntimeFetching = false`
  was verified, earlier in this session, to fix that for the original 12 tests specifically (12/12
  pass individually, file passes twice in a row, full suite 58/58) — but that verification predates
  this checkpoint's further changes to the shared `pumpUntil` helper (the `pumpDuration` parameter,
  `_absorbPendingFontFailures`) and predates the 13th test. **Re-run the isolated-test-order sweep
  before trusting it.**

## Exact tested SHAs and commands

At `ca0be93` (`letbuyy/sustained-l-marketplace-account-ui`, **Phase 1 only, before Phase 2's changes**),
from `apps/marketplace/mobile`:

```
flutter analyze
# -> No issues found!

flutter test
# -> 58 tests, All tests passed!
#    (12 of these are new: test/letbuyy_account_screen_test.dart)
```

Both commands were run for real in this container (Flutter 3.44.8 stable, installed this session from
`storage.googleapis.com`). Neither `flutter build apk`, an emulator, a device, nor iOS was run — see
"Known gaps" below.

**At `639ca1b` (current HEAD, Phase 2's checkpoint): `flutter analyze` and a full `flutter test` run
were NOT completed before the stop.** Only the single new test was exercised repeatedly in isolation
(`--plain-name`), with the flaky results described above. This is the single most important gap for
whoever resumes this branch to close first.

## Known failing/skipped/cancelled checks

None newly introduced by this phase in the Dart test suite (58/58 pass). The TS-side governance gate
(`gate.sh`) was **not re-run** for this phase — SUSTAINED-J and SUSTAINED-K's own evidence docs
(`SUSTAINED_J.md`, `SUSTAINED_K.md`) document its pre-existing ambient reds (lint hex-color/frozen-route
findings in unrelated apps, 5 named `validators:sweep` failures, `tests:governance` environment/
stale-artifact/branch-dispositions reds, one `apps/internal/console` MFA-bypass `test:contracts`
failure) — all confirmed pre-existing there, before this phase started. This phase's own diff is
Dart-only and touches none of those files, so there is no specific reason to expect it broke them, but
this was **not independently re-verified** here, which is exactly why this phase is not merged.

## Required hosted migrations — explicitly NOT applied

None. This phase added no migration (migration 260, from SUSTAINED-K, is the last one touching the
buyer realm, and it was already merged to `develop` — still not applied to any hosted database by any
phase this session, always local-disposable-Postgres only).

## Flags — explicitly NOT enabled in production

`LETBUYY_BUYER_SIGN_IN` stays default-off. This entire phase's UI is unreachable in a production build
unless the app is built with `--dart-define=LETBUYY_BUYER_SIGN_IN=true`, unchanged from before this
phase.

## Toolchain requirements (for the Mac)

- Flutter 3.44.8 stable (the pinned version this repo's `pubspec.yaml`/melos workspace expects).
- The Android SDK, if `flutter build apk` or an Android emulator is wanted — **not verified from this
  cloud container**: the Android SDK component download (`dl.google.com`) was denied by this
  container's own egress policy (confirmed via the proxy's `/__agentproxy/status` endpoint), a
  restriction specific to this cloud environment, not necessarily present on the Mac.
- Xcode/iOS toolchain, if an iOS build/simulator run is wanted — **never attempted from this Linux
  container**; no claim of iOS validation is made anywhere in this phase's evidence.
- `pnpm` + Node (for the TS-side `gate.sh`, if that is run before merging this branch).

## Environment variable NAMES only (no values, per this session's own secret-handling rule)

Nothing new. This phase introduced no new environment variable, secret, or config key. The Dart client
continues to read `AppConfig.apiBaseUrl` / `AppConfig.identityBaseUrl` / `AppConfig.buyerSignInEnabled`
— all pre-existing, all sourced from `--dart-define` at build time, unchanged.

## Flutter/Android/iOS checks to run on the Mac

1. `flutter pub get` at the repo root (melos workspace) or inside `apps/marketplace/mobile`.
2. `cd apps/marketplace/mobile && flutter analyze && flutter test` — reproduce the green result above
   on real Mac tooling, not just trust this container's run.
3. `flutter build apk --debug --dart-define=LETBUYY_BUYER_SIGN_IN=true` then
   `aapt dump badging build/app/outputs/flutter-apk/app-debug.apk | grep '^package:'` — confirms the
   app still builds and the package identity (`com.letbuyy.letbuyy`, versionCode/Name) is unchanged, a
   check `SUSTAINED-K` already established as **BLOCKED_INFRA** in every cloud session so far and never
   completed anywhere.
4. Run the debug build on an emulator or device with `LETBUYY_BUYER_SIGN_IN` on, sign in with a real
   or staging identity-platform buyer account, and manually walk the 8 acceptance items above — this
   is real UI/emulator-level verification this phase's evidence explicitly does NOT claim to have.
5. If continuing: run `bash .claude/skills/letbuyy/scripts/gate.sh` (default mode) on
   `letbuyy/sustained-l-marketplace-account-ui`, from a worktree, per the skill's own SELF_GATED
   requirement, then merge into `develop` only if it passes (or fix what it finds first, the same way
   SUSTAINED-J and SUSTAINED-K's own gate.sh runs each caught and fixed one real regression before
   merging).

## Docker on the Mac

This cloud session used a native-Postgres Docker **shim**, not real Docker, for the executable test
suites (a SUSTAINED-J/K concern, not this phase's — this phase touched no database). On a Mac with
real Docker available, prefer real Docker for any future executable-suite or local-stack work — the
shim was a cloud-container-specific workaround, not a design choice to preserve.

## The precise first local task

**Correction to prior guidance in this file:** `git checkout -b <branch> origin/<branch>` does **not**
create a new worktree — it just creates/switches a branch in whichever checkout you run it in. Per
the `/letbuyy` skill's own branch model, the **primary checkout**
(`/Users/saai_siddharth/Projects/Start_Up/LetBuyy`) is meant to stay on `develop` and is read-only for
phase work except merges into `develop` — building a phase branch directly there is exactly what the
skill's worktree model exists to avoid. The actual safe path depends on what's already there, so check
first rather than assuming:

1. From `/Users/saai_siddharth/Projects/Start_Up/LetBuyy`: `git status` (note any local
   modifications — do not discard them) and `git branch --show-current` (confirm it's `develop`, as
   the skill expects) and `git worktree list` (see what worktrees, if any, already exist).
2. `git fetch origin letbuyy/sustained-l-marketplace-account-ui` (fetch just this branch; do not
   blind-`pull`, `reset --hard`, or force-checkout anything).
3. Pick ONE of these, based on what step 1 found:
   - **No existing worktree for this branch, and you want one (recommended, matches the skill's own
     model):** from the primary checkout, run
     `git worktree add ../LetBuyy-sustained-l origin/letbuyy/sustained-l-marketplace-account-ui -b letbuyy/sustained-l-marketplace-account-ui`
     (creates a new directory `../LetBuyy-sustained-l` as a separate worktree, checked out to a new
     local branch tracking the remote one — the primary checkout itself is untouched). Then
     `cd ../LetBuyy-sustained-l`.
   - **A worktree for this branch already exists** (check the `git worktree list` output from step 1
     for its path): `cd` to that path directly, then `git fetch origin` and
     `git merge --ff-only origin/letbuyy/sustained-l-marketplace-account-ui` (fast-forward only — if
     that fails, the local worktree has diverged local commits; stop and reconcile manually, don't
     force).
   - **You don't want a second checkout on disk at all:** if this session's cloud environment supports
     a teleport/resume-into-this-exact-session flow (Claude Code on the web's "Open in" /
     `mcp__Claude_Code_Remote__create_session`-style continuation), use that instead of manual
     worktree surgery — check the tool/UI available to you locally for this option first.
4. Verify you landed on `639ca1b`: `git log -1 --format='%H %s'` should show `639ca1b` and the WIP
   checkpoint commit message.
5. Read this file's "Phase 2 — what actually happened" section above, then start with: `cd
   apps/marketplace/mobile && flutter pub get && flutter analyze`, then investigate and fix the
   font-exception/pump-reliability issue in `letbuyy_account_screen_test.dart` (see "Font-loading test
   setup" and "Remaining arbitrary delays" above) before claiming the new test — or the suite — is
   reliable. Only after that: consider `bash .claude/skills/letbuyy/scripts/gate.sh` and a merge
   decision, per the skill's own SELF_GATED requirement.

## Explicit confirmations

- `staging` and `main` were not touched by this phase, or by SUSTAINED-J/K before it — both remain
  `1e6cc4c3` on origin.
- No hosted database was touched; no migration was applied anywhere but a local, disposable Postgres
  instance (and this phase applied none at all).
- No production flag was changed; `LETBUYY_BUYER_SIGN_IN` remains off by default.
- No claim of production readiness is made. No claim that the wider "unified buyer account" programme
  is complete — D4/D6 remain HTTP-level-only verified (SUSTAINED_K.md), a compiled Flutter
  build/emulator/device run remains unperformed, and this phase's own branch is unmerged pending a
  full governance-gate run.
