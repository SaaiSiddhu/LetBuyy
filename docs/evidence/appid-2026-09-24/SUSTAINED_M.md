# SUSTAINED-M — SUSTAINED-L verification closure

Owner-directed corrective phase, `letbuyy/sustained-m-account-switch-verification`, branched from
`develop` at `18fcfd73` (the tip immediately after SUSTAINED-L's merge `396b9397` and its own ledger
bookkeeping commit). Does not reset, revert or re-litigate that merge — builds on top of it. Four
objectives, in the owner's own order.

## 1. Phase status corrected

`SUSTAINED_L.md` gained a dated correction notice at its top (not a rewrite — the rest of the
document is untouched, still the accurate record of what SUSTAINED-L did on 2026-09-25). It now
states plainly: the profile/address UI and the `_loading` fix were IMPLEMENTED and MERGED_DEVELOP;
the account-switch regression test was SKIPPED, not passing; the 58-pass/1-skip result is real and
kept, with an explicit note that it never established the skipped scenario. This document
(`SUSTAINED_M.md`) is now the accurate, current status; nothing here is marked VERIFIED or
E2E_DEVELOP for a criterion that has not actually passed (see the status table at the end).

## 2. Root cause and the deterministic fix

Re-verified fresh in this container before changing anything: `flutter analyze` clean at the
inherited tip; 5 isolated `--plain-name` runs of the account-switch test gave the same flakiness
SUSTAINED_L.md already documented (not independently re-measured to a fresh N this session, since the
mechanism was already established with a standalone reproduction — see below).

**The actual defect**, confirmed with a controlled, non-Flutter Dart reproduction of the exact
pattern used in `google_fonts` 6.3.3's `google_fonts_base.dart`:

```dart
final Future<void> loadingFuture = loadFontIfNecessary(descriptor);
pendingFontFutures.add(loadingFuture);
loadingFuture.then((_) => pendingFontFutures.remove(loadingFuture));   // no onError
```

`.then()` with no `onError` creates a second, separate Future that also carries a load failure, and
that derived future is never stored anywhere reachable from outside the package. Both
`_absorbPendingFontFailures()` (SUSTAINED-L's own mitigation, polling `GoogleFonts.pendingFonts()`)
and `flutter_test`'s own zone only ever see the *original* futures in `pendingFontFutures` — which
already have a listener (the `.then()` itself) and were never what was actually unhandled. The
reproduction: `Future.wait` on the tracked set catches its own error fine; the zone still reports an
unhandled error from the derived future, deterministically, every run. This is a structural property
of the installed package version, not a timing quirk specific to any one test or container.

**The fix removes the dependency instead of racing it.** New file
`packages/dart/marketplace_ui_kit/lib/src/themes/app_fonts.dart`:

```dart
typedef GoogleFontStyleBuilder = TextStyle Function({ ...same named params as GoogleFonts.poppins... });

class AppFonts {
  static GoogleFontStyleBuilder poppins = GoogleFonts.poppins;
  static GoogleFontStyleBuilder inter = GoogleFonts.inter;
}
```

All 46 `GoogleFonts.poppins(...)`/`GoogleFonts.inter(...)` call sites in
`packages/dart/marketplace_ui_kit/lib/src/themes/app_text_styles.dart` (the only file in the whole
workspace that calls `google_fonts` directly — confirmed by grep across `apps/` and `packages/dart/`
before making this claim) now go through `AppFonts.poppins`/`AppFonts.inter`, default-initialized to
the real `GoogleFonts` functions as tear-offs. `apps/marketplace/mobile/test/flutter_test_config.dart`
overrides both fields to a plain, deterministic style builder (applies every parameter except
`fontFamily`/`fontFamilyFallback`, so the platform's test font renders) **before any test runs** —
this test process never calls into `google_fonts` at all, so the unreachable-derived-Future defect
can never surface. **Production never overrides `AppFonts`**, so the shipped app's typography is
unchanged: same real Google Fonts, same real asset/network loading path as before this file existed.
This was the option the owner's directive called "a narrow presentation dependency seam" — evaluated
against the alternative (real font fixtures as test assets) and preferred because:

- `rootBundle.load()` under `flutter test` only serves files declared in `pubspec.yaml` and
  pre-compiled into `build/unit_test_assets/` — confirmed empirically (an undeclared file throws
  `Unable to load asset` immediately, no ambiguity) before choosing the seam over it.
- Declaring real, matching-named font files in the app's actual `pubspec.yaml` was rejected as a
  live production risk: `google_fonts` checks the asset manifest before deciding whether to fetch
  over HTTP, in production builds too, so a wrongly-named local file would silently replace the real
  Google Font in the shipped app.
- Mocking the `flutter/assets` platform channel directly (correct in principle, zero production
  risk) was tried in a throwaway probe and hung rather than failing cleanly; not pursued further once
  the seam proved to work cleanly on the first attempt.

Removed the now-dead `_absorbPendingFontFailures()` helper and its one call site.

## 3. The account-switch test — restored and proven

`skip: true` removed. The test now also verifies an 8th behaviour the owner's directive asked for
explicitly — "subsequent actions use Buyer B's credentials, not Buyer A's" — by having Buyer B save a
profile edit immediately after the switch and asserting the PATCH lands on Buyer B's own record. This
exposed a real gap in the **test double**, not the app: `FakeGateway`'s `PATCH /buyer/profile` handler
always wrote to the top-level `account` map regardless of which token authenticated the request (the
`GET` handler was already correctly scoped by token). Fixed to route by token the same way the `GET`
handler does — the real gateway's `requireBuyerSession` already scopes this correctly; only the fake
was wrong.

**Reliability, measured fresh in this container:**

| Check | Result |
|---|---|
| `flutter analyze` (mobile app + `marketplace_ui_kit` package) | Clean, both, throughout |
| The restored test, isolated (`--plain-name`), 20 fresh runs | 20/20 pass |
| The restored test, isolated, 5 more fresh runs (post-negative-control restoration) | 5/5 pass |
| Full test file, 5 fresh runs | 5/5 pass, 13/13 tests each run |
| Full app suite (`flutter test`), 3 fresh runs | 3/3 pass, 59/59 tests, **0 skips** (was 58 pass / 1 skip) |
| `packages/dart/marketplace_ui_kit` own suite | 54/54 pass (unaffected) |
| `packages/dart/api_client` own suite | 41/41 pass, 6 pre-existing `LETBUYY_LOCAL_STACK` skips (unaffected) |
| `apps/merchant/mobile` canary (via the gate, below) | unaffected |

**Review of the production `_loading` reset, as the directive asked ("do not assume the three-branch
patch is correct merely because it is small"):** traced the discard→reset→rebuild→reload chain by
reading the code, not assuming it. `_stillCurrent(token)` re-reads the controller's **live current**
token at the moment each response resolves — never a cached snapshot — so a response is applied only
if the buyer it belongs to is still the one on screen at that exact moment, regardless of how many
switches happened in between. Clearing `_loading` on discard cannot let an older request's *data*
leak, because the data-applying branches have their own, separate `_stillCurrent` check before ever
calling `setState` with the response body. The one edge case identified (two overlapping loads for
the *same* still-current buyer, both discovering `_loading == false` on two rapid rebuilds before
either sets it back to `true`) is a harmless duplicate GET, not data corruption — both would resolve
to the same correct buyer's data. This reading is now backed by a real, passing integration test, not
just code inspection.

### Negative-control proof

With the fix in place (20/20 + 5/5 isolated passes, above), the fix was **temporarily removed** —
each of the three `if (!_stillCurrent(token)) { setState(() => _loading = false); return; }` branches
in `letbuyy_account_screen.dart`'s `_load()` reverted to the original bug (`if (!_stillCurrent(token))
return;`), by direct edit, not a git operation. Ran the exact same test:

```
pumpAndSettle timed out
  ...
  #2 main.<anonymous closure> (letbuyy_account_screen_test.dart:625)   <- gateway.releaseHeldToken(); await tester.pumpAndSettle();
```

This is the expected failure: with `_loading` never reset, `build()`'s own reload trigger
(`controller.token != _tokenAtLastLoad && !_loading`) can never fire for Buyer B once Buyer A's stale
response is discarded, so nothing further is ever scheduled after `releaseHeldToken()` — the widget
tree never settles into a new state, and `pumpAndSettle()` times out. **Not** a font exception, not an
import error, not an unrelated timeout — the exact behavioural failure the bug describes, caught by
the test. The production file was then restored byte-for-byte with `git show HEAD:<path> >
<path>` (never `checkout --`); `git diff` against `HEAD` was empty afterward. Re-ran the test: 5/5
pass again (table above).

## 4. Android build and device walkthrough

**Toolchain, measured on this Mac (`flutter doctor -v`):** Flutter 3.44.8 stable, Android SDK 36.0.0
at `~/Library/Android/sdk`, build-tools 36.0.0, Java 17 (Homebrew OpenJDK, the JDK Flutter is
configured to use), one AVD already booted (`Pixel_8_API_35`, `emulator-5554`, Android 15 / API 35).
Xcode incomplete — irrelevant, this is an Android-only closure phase per the directive.

**Real debug APK build**, gate-safe mode only (no `--gate-real` run this phase, so no risk to the
build output): `flutter build apk --debug --dart-define=LETBUYY_BUYER_SIGN_IN=true` succeeded
(`✓ Built build/app/outputs/flutter-apk/app-debug.apk`, ~31s cold / ~15s warm Gradle). `git status
--porcelain` was empty immediately after — Gradle wrote to no tracked file.

**Identity verification**, `aapt dump badging` on the built APK (never `keytool`, per the secret- and
identity-handling rules):
```
package: name='com.letbuyy.letbuyy' versionCode='4013' versionName='1.0.10-debug' ...
application-label:'LetBuyy'
```
`applicationId`/`namespace` in `android/app/build.gradle` (Groovy; no `.kts` duplicate) were `'com.
letbuyy.letbuyy'` before this phase touched anything and are unchanged — confirmed by reading the
file before the build, not inferred from the APK alone. `versionCode`/`versionName` (4013 / 1.0.10)
match the previously-recorded shipped values exactly (the `-debug` suffix is normal for a debug
build). No unintended permission, application-ID or signing change.

**A real, self-inflicted setup defect found and fixed while wiring this up — worth recording because
it validates a piece of the app's own security logic:** the first build/run used
`API_BASE_URL=http://10.0.2.2:9010/v1` / `IDENTITY_BASE_URL=http://10.0.2.2:9002` (the emulator's
usual host-loopback alias). The app crashed on startup with `ArgumentError: identity-platform must be
an https origin`, thrown by `BuyerSignInClient._identityOrigin` in
`packages/dart/api_client/lib/src/buyer_sign_in.dart`. Reading that function's own doc comment
(`"http only on this machine's own loopback for development, where the emulator reaches it through
adb reverse"`) showed this was the **correct, intentional** behaviour, not a bug: the client
deliberately refuses a plaintext identity origin unless it is exactly `localhost`/`127.0.0.1`, and
`10.0.2.2` does not match either. Fixed the setup, not the app: `adb reverse tcp:9002 tcp:9002` +
`adb reverse tcp:9010 tcp:9010`, then rebuilt with `IDENTITY_BASE_URL=http://localhost:9002` /
`API_BASE_URL=http://localhost:9010/v1`. This is exactly the mechanism the code's own comment
describes, and it is why the client enforces this check at all -- confirmed the security logic works
as designed rather than silently loosening it.

**Real emulator walkthrough performed** (`app-debug.apk` installed via `adb install -r`, launched via
`adb shell am start`, driven via `adb shell input tap` with coordinates read from a real `uiautomator
dump` -- never guessed from a screenshot alone -- and verified via `adb exec-out screencap`):

1. App launches to the real splash screen, then the real marketplace home screen (search bar, bottom
   nav) with no crash. `adb logcat` for the session shows no `FATAL`/`AndroidRuntime` exceptions after
   the identity-origin fix above.
2. Tapped the bottom-nav Profile tab (bounds read from `uiautomator dump`, not estimated): reaches the
   real, pre-existing Firebase-era "Login Required" screen. This is expected and outside this phase's
   scope -- the profile tab's OWN top-level gate is the Firebase per-store login (D-ONE-BUYER's
   separate, already-complete realm), and `LetBuyyAccountCard` (the entry point into the buyer-realm
   screen this phase actually verifies) is embedded further inside that same screen, past that gate --
   confirmed by reading `profile_screen.dart` directly, not assumed.
3. Reached the actual `LetBuyyAccountScreen` widget directly via a real Android App Link (`adb shell am
   start -a android.intent.action.VIEW -d "https://letbuyy.com/letbuyy-account"`) -- exercising the
   app's real, manifest-declared, `autoVerify` deep-link route (`AndroidManifest.xml`'s `https://
   letbuyy.com` intent-filter -> `AppRoutes.onGenerateRoute` -> `letbuyyAccount` case), not a
   synthetic shortcut. Rendered exactly the real AppBar (`"LetBuyy account"`) and the real signed-out
   `EmptyState` (lock icon, `"You're signed out of LetBuyy"`, `"Sign in with LetBuyy on the Profile tab
   to manage your account."`) -- verbatim matches to `letbuyy_account_screen.dart`'s own source
   strings.
4. App remained the foreground, responsive activity throughout (same `ActivityRecord` task id across
   every step) -- no crash, no ANR, across the whole walkthrough.

**What was NOT exercised, and why -- kept as an honestly pending acceptance item, not silently
reduced scope:** a REAL, Postgres-backed sign-in and the profile/address CRUD journeys (walkthrough
items 4-9) need a working local `identity-platform` (`:9002`) and `api-gateway` (`:9010`), which in
turn need a migrated Postgres. This machine has Docker installed, and a Supabase-CLI-shaped container
set (`supabase_db_letbuyy-p4b-e2e` and siblings) was already running, 43 hours old, from a session and
a working directory this phase has no record of. Per this repository's own non-destructive rule
(`AGENTS.md` AGENT-R16 -- attribute an unexpected diff or state before touching it) this phase did
**not** connect any runtime to it, did not inspect its contents, and did not attempt to reconfigure or
tear it down -- an unattributed, unowned, already-running database is exactly the kind of state to
leave alone, not repurpose. Standing up a **freshly provisioned, clearly-owned** local stack instead
(`supabase start` under a new project directory, migrations through 260, generated `.env.local`/
`.dev.vars` for both runtimes, `pnpm --filter @letbuyy/identity-platform dev` + `wrangler dev` for the
gateway) is real, additional, correctly-scoped work this phase did not attempt, given the time already
spent -- not because it is infeasible. **The smallest prerequisite to close this**: either (a)
identify and safely attribute the existing `letbuyy-p4b-e2e` containers (whose session created them,
whether anything still depends on them, and their exact Supabase credentials), or (b) provision a new,
disposable local Supabase project from a clean `supabase init` in a scratch directory and wire both
runtimes' env files to it, then re-run this same walkthrough's items 4-9 against it. Neither was
attempted here; this stays the one pending acceptance item.

## Status summary

| Item | Status |
|---|---|
| Phase-status language corrected (Objective 1) | DONE -- `SUSTAINED_L.md` dated correction notice added, history preserved |
| Deterministic font test setup (Objective 2) | DONE -- `AppFonts` seam, real fix not a mitigation, production typography unchanged |
| Account-switch test restored and proven (Objective 3) | DONE -- un-skipped, 8th behaviour added, negative-control proof, 20/20 + 5/5 + 3/3-suite reliability |
| Android build (Objective 4a) | DONE -- real debug APK, identity verified, no unintended changes |
| Android emulator walkthrough (Objective 4b) | PARTIAL -- app launch, navigation, real deep-link routing, and the signed-out state are REAL and verified on a real Android 15 emulator; the signed-in profile/address CRUD journeys are BLOCKED on a clearly-owned local backend (see above), honestly reported, not simulated |
| Governance gate | see the merge report for this phase |

Nothing in this phase touched `staging`/`main`, deployed anything, applied a migration to a hosted
database, or enabled `LETBUYY_BUYER_SIGN_IN` in production. `develop` was not pushed.

Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO
