# Canonical session recovery — 1 November 2026

Implementation: `427e949c0ab3605b0075e1a0d82399d76f20315e`; private rendering fence: `aeef87046a497567e8fcfc8b2aacafe896ce4c87`; canonical cookie-format follow-up: `ce8140b092197a06b7cfd940d154cae4353e886d`. This is source qualification and a staging debug artifact, not complete Accounts/device/release acceptance.

## Repaired behavior

The native password and verified-signup flows previously manufactured a signed-in user with an empty ID when the subsequent Accounts session read failed. Accounts also translated upstream database/transport failures into `authenticated:false`, and native restore/refresh erased the saved credential for those failures.

- Accounts now distinguishes explicit canonical denial from an unavailable reader, refused internal proof, malformed response or failed cookie rotation. Unavailability returns sanitized `503 SESSION_UNAVAILABLE`; all responses are private/no-store. The route explicitly executes per request.
- Native sign-in never publishes an empty account. An issued token is kept only in encrypted storage until Accounts confirms a complete current user. Startup and the named login route offer saved-session Retry, without another password submission or a fabricated store selection.
- An unavailable reader hides the cached identity and retires active store presentation while preserving the original encrypted token. Explicit canonical denial retires it. A confirmed rotated cookie replaces the saved credential.
- Auth generations and serialized storage writes fence delayed password/session responses and writes against sign-out. Logout confirmation is attempted even if local deletion fails. Provider HTML/redirects are not reported as an incorrect password. The recovery view uses existing theme tokens, scrolls at large text scale and exposes a real Retry action.
- Unavailability does not emit a successful sign-in or an expiry telemetry event. Issuance, signatures, membership, MFA and revocation remain with the existing canonical identity owners.

## Qualification

| Gate | Result |
| --- | --- |
| Complete Merchant Flutter suite | 765/765 pass |
| Flutter analysis | No issues |
| Focused recovery, MFA and staging cookie tests | 19/19 pass |
| Accounts package suites | 71 + 6 pass at the cookie-format follow-up |
| Canonical auth-core regression | 48/48 pass |
| Accounts typecheck and actual staging build | Pass |
| Final-source governance in disposable clone | 114 pass; 0 fail/blocked/skipped; 1 not applicable |
| Deliberate blank-user negative control | Fails as required; exact source restored; full suite subsequently passes |

The new tests cover password/OTP confirmation failure, process restart under the original token, explicit denial, protection HTML, malformed/blank identity, rotation, late restore/password completion, encrypted-write/sign-out ordering, startup recovery and the separate login route at 2x text scale. They use named HTTP/storage fixtures, not a real hosted password or CAPTCHA.

Initial test-file syntax and sandboxed `tsx` IPC failures were corrected; their failed logs remain in the private evidence root. The corrected normal package scripts completed. No dependency constraint was changed.

## Artifacts and hosted state

The installed staging Android debug APK is **219,865,278 bytes**, SHA-256 **`d76711ba3582c4a5c94ed63e957c73db725407476748e793c6efa3e0fa8f55b9`**. Source is `427e949c0…`; its native subtree is identical at `aeef87046…`. Configuration is the checked-in `dart-defines/staging.json`, SHA-256 `c5ff5aef3a3f879a2e5ddcad963be15bdf3e4d34f4269814a5b7a232270051dd`. Installed bytes were independently pulled and hash-compared on the task-owned `emulator-5580`, isolated ADB port 15038. The prior `13d254de…` production-profile debug APK was preserved with its previously recorded matching hash, and app data was retained.

The new build opens sign-in rather than the previous production store. Its current security-check widget shows a recoverable failure; no credentials were entered, and the current CAPTCHA retry/completion approval remains pending. This is not authenticated native acceptance. Private captures contain the saved email hint and are not committed.

The first Accounts recovery artifact `dpl_C2rKrfMq6WZFGxsm4phkGXG71SwV` became READY after its initial concurrency queue and CLI timeout; it was never resubmitted. Live owner isolation passed, but a malformed staged cookie incorrectly returned an outage. Follow-up `ce8140b09…` uses the existing canonical auth-core cookie-format checker before the reader and before sealing a rotated token. Invalid local credentials now return signed out; upstream refusal or unavailability with a valid-shaped credential still returns sanitized 503 and keeps the original credential.

The follow-up passed 77 Accounts tests, typechecking, 114 governance validators in the disposable clone, an actual staging build and public-static secret scanning. Admitted tree SHA-256 **`eb66ef56418b8132da6a19bfa9f10d4a31873bfa11e632c2d712915409f93a83`**, 343 files. Deployment **`dpl_D7ThevfxEBw887k74Jj3ugVsNS4x`**, `accounts-pq6o9yte4-letbuyy-store-s-projects.vercel.app`, is independently **READY** and assigned to `accounts-staging.letbuyy.com`. CLI used supported `--no-wait`, exited zero, and was not resubmitted. Live owner A/B/A reads return each current identity with private/no-store; malformed and production-named cookies return signed out. Exact preview and custom alias retain anonymous Vercel SSO protection. These are authenticated HTTP checks, not password/CAPTCHA or browser acceptance.

Merchant staging advanced outside this task to **`dpl_A5ws3ZPqWnu73BWcJskie1fuUMhz`**, source **`e4105581e3346041d71694d3db093eb713773e07`**, branch `staging`. Its source differs from the previously qualified warehouse preview. This task has not overwritten it or transferred the older preview's acceptance to the current alias. A local merge calculation identifies ten conflicts to reconcile before a coherent Merchant staging replacement can be admitted.

During this continuation, production aliases advanced outside this task. A preflight stopped before dispatch; readback reconciled Accounts `dpl_HCqdhz5cg6Q144qGDbMyVjnKpE9D` and Merchant `dpl_7wZR8LAxqEhrfqjERGBCRXSt2niM`. Subsequent staging work preserves those observed aliases; historical IDs must not be restored. This chat performed no production application activation, remote push, paid upgrade or migration resubmission.

Private receipts/logs: `/private/tmp/letbuyy-parity-continuation-20261101/`, especially `native-recovery-negative-control.json`, `identity-privacy-governance.json`, `native-staging-artifact.json`, `native-source-equivalence.json`, `accounts-recovery-artifact-admission.json`, `deployment-preflight-reconciliation.json`, `accounts-recovery-deployment-reconciliation.json` and dated queue snapshots. Current actual Dart SDK readback still acknowledges the synthetic staging store, three locations and two suppliers; that is a host Dart VM check, not emulator UI.

Next: reconcile current Merchant source locally without losing either branch's work, finish the current human challenge only when its pending permission arrives, then run the native owner/staff and web/mobile journals through the existing feature ledger. Protected Vercel access is distinct from Turnstile; no provider protection credential was embedded in the app.
