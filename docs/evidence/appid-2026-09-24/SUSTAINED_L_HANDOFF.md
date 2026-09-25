# SUSTAINED-L — marketplace account UI, cloud-to-local handoff

Owner-directed, budget-bounded phase: connect `apps/marketplace/mobile`'s profile/address UI to the
canonical buyer APIs and Dart client SUSTAINED-K already built (D5's remaining client-UI gap). Built,
tested, committed, pushed. **Not merged into `develop`** — the full TS-side governance gate
(`gate.sh`) was not re-run, to stay inside the owner's stated budget; only Dart-side verification
(`flutter analyze`, `flutter test`) was run. Per the owner's own instruction ("do not waive gates to
simplify handoff"), this stays a preserved branch until a session verifies it against the real gate.

## Repository and branches

Canonical repository: `https://github.com/SaaiSiddhu/letbuyy.git`

| Branch | SHA | Remote verified | Status |
|---|---|---|---|
| `develop` | `ffcd124` | yes — `origin/develop` = `ffcd124` (`git ls-remote origin` at time of writing) | unchanged by this phase; contains SUSTAINED-J + SUSTAINED-K only |
| `letbuyy/sustained-l-marketplace-account-ui` | `ca0be93` | yes — pushed, `origin/letbuyy/sustained-l-marketplace-account-ui` = `ca0be93` | **ACTIVE, unmerged** — this phase's implementation |
| `letbuyy/checkpoint-theme-cli-mode` | `145e330` | yes — pushed | unrelated, pre-existing, unattributed executable-bit change on `packages/theme-engine/src/theme-cli.ts` (see below) — never merge without the owner's word on whether it was intentional |

`staging`/`main`: unchanged throughout, at `1e6cc4c3` on origin (unchanged from every prior phase this
session; not touched by SUSTAINED-J, K or L).

**Exact branch to resume locally:** `letbuyy/sustained-l-marketplace-account-ui`.

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

## Exact tested SHAs and commands

At `ca0be93` (`letbuyy/sustained-l-marketplace-account-ui`), from `apps/marketplace/mobile`:

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

1. `git fetch origin` from `/Users/saai_siddharth/Projects/Start_Up/LetBuyy` (check `git status` first;
   preserve any local modifications — do not `reset --hard`, force-checkout, or blind-`pull`).
2. Verify you're on the same repository/account this session pushed to (`git remote -v`, confirm
   `SaaiSiddhu/letbuyy`).
3. `git checkout -b letbuyy/sustained-l-marketplace-account-ui origin/letbuyy/sustained-l-marketplace-account-ui`
   (or fetch it into a fresh worktree, per the skill's own branch model — do not build on the primary
   checkout directly, which stays read-only except for merges into `develop`).
4. Read this file and `docs/evidence/appid-2026-09-24/SUSTAINED_K.md` for the fuller D1–D6 picture this
   phase builds on.
5. Run the toolchain checks in order above (steps 2–4 there), then decide: merge as-is if the gate
   passes clean, or fix what it finds first.

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
