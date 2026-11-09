# StoreSwitcher and Staff local repair — 6 November 2026

Implementation is in `codex/merchant-mobile-parity` at HEAD `ab32485092cae0ac19145abf7b5a101fa3ea338e`. The uncommitted qualified product input set is `8e7cf5dff2b908436420fb53e90e9340968b8506547ffb8445a604f29868e69a` (8,450 inputs). This record closes demonstrated defects only; it does not accept the complete 122-feature programme or authorize hosted changes.

## Implemented

- StaffService now delegates local/development namespace identity to the existing AppConfig persistence authority. Exact deployed production and staging invitation/retry keys remain unchanged. Local issuers cannot adopt, clear, or reuse hosted or other-issuer recovery data. No ambiguous old bucket is migrated or deleted. Staff methods, DTOs, command bodies, actor scoping and original retry keys are preserved.
- StoreContext now rejects a `false` preference acknowledgement. Immediate in-memory scope retirement and the existing serialized preference queue remain unchanged. Failure does not claim durable selection success.
- StoreSwitcher uses the existing canonical form sheet. It supports refresh/discovery in one selector, full names and URLs, selected indicators, close/retry, useful sanitized failures, and long/scaled text in both themes. It describes the loaded list honestly.
- Stale choices, duplicate sheets, retired route/actor/store callbacks, old list objects and late preference completions cannot notify the wrong consumer. Current dispatch still goes through canonical StoreContext membership checks.
- The trigger uses the existing AccessibleTapRegion with the native button's one FocusNode. Its full localized name and tap/focus action belong to one semantic control; duplicate child semantics are excluded. The native observation was reproduced as a missing tap action before this fix. Opening the chooser no longer falsely says a store is already switching.

## Collected evidence

| Gate | Current result |
| --- | --- |
| Original Staff scope assertion | Unchanged; passing |
| Focused StoreSwitcher/Staff/store-session tests | 64 PASS / 0 FAIL / 0 SKIP |
| Full Flutter suite | 1,544 PASS / 0 FAIL / 0 SKIP |
| App analysis | 0 issues |
| Two explicit local issuer configurations | 10 isolation checks pass in each configuration; repeated configurations are not additional unique full-suite tests |
| Current widget render | Six actual renderer captures; light/dark, normal and 320dp/2.4 text; scroll to final choice and Close |
| Real owned Staff database/API | 35 PASS / 0 FAIL / 0 SKIP; lifecycle/invitation, atomic retries, concurrency, live revocation and rollback; run `cc9c48163929`, cleanup empty |
| Governance | 114 PASS / 0 FAIL / 1 NOT_APPLICABLE after generated-password fixture correction; original source/index unchanged; branch-reference advisories remain |
| Android/iOS current v6 artifacts | Both normal debug builds PASS; APK and all 377 iOS retained files independently read back; owned iOS simulator remains Shutdown, compile only |
| Current two-store native/web sync | v45 running, not yet accepted |

The Staff database/API source is byte-equal across the current UI-only revision. These are owned local tests on PostgreSQL 16, not hosted/provider PostgreSQL acceptance. See `verification-2026-11-05/staff-current-db-v1.json` and its logs.

## Evidence custody and failures

All terminal/log/source receipts remain under `verification-2026-11-05`. The initial full-suite interruption ended without a final result and is not accepted. The v4 checkpoint passed but is superseded by the current accessible control.

Native fixture v42 rejected an unsupported test permission before login; the fixture now uses server-owned manager defaults. v43 correctly reached the normal two-store picker, which the one-store companion had not anticipated. v44 reached Settings and exposed separate labelled/non-clickable and tappable semantic nodes. None is accepted as a completed native sync journey. The semantic negative v2 failed on the missing tap action, and the current regression exercises the real semantic action, busy disabling, current selection and acknowledgement. Early missing test-path and semantics-handle diagnostics are retained as test setup failures, not application defects.

Original fixture bytes before correcting password generation are retained with hashes in `verification-2026-11-05/switcher-fixture-password-custody.json`. No secret-scanner exception or validator weakening was introduced.

## Remaining acceptance boundaries

- Complete the current two-real-membership emulator journey: normal Accounts login, both switcher choices, saved selection after restart, mobile settings save/web readback, web update/mobile readback, and live Staff downgrade/removal.
- Native invitation submission/acceptance, wrong-account/restart consent flows and delivery remain distinct from namespace unit checks and local backend invitation tests.
- StoreService currently consumes one accessible-store page. The selector truthfully labels its loaded list; this is not acceptance of discovery beyond that page or a complete global membership population.
- Existing Staff list pagination, schema-unavailable empty fallback and raw database error branches require their separate backend/consumer repair and acceptance. They were read and remain open; the namespace fix does not certify them.
- Full 119-applicable-feature acceptance remains open; 120/121 excluded, 122 paused, 51 frozen. The surface ledger has nonadditive discovery rows and an unreconciled unique denominator. Current tests/builds never substitute for missing source, browser, native, provider or release journeys.
- iOS runtime, physical-device/performance, real-provider, hosted and signed-release acceptance are not established by these debug artifacts. No push, merge, deployment, hosted migration or real message was performed.
