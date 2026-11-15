# Complete store membership discovery — local source3

Current qualified source is `verification-2026-11-05/store-pages-source-v3.source.json`, SHA256 `dee2756c4b94267b7bf2b3b9bcb01a9fcafd87b86643f375b55232523f518e32`,8,454 inputs. This adds to the StoreSwitcher/Staff/Settings repairs in `STORE_SWITCHER_SETTINGS_LOCAL_V3.md`.

Two negative actual SDK/Dio tests first reproduced the old behavior: page two was never requested, and the saved membership53 was replaced by membership1 during normal StoreContext restoration. The negative terminal preserves the unchanged source and the exact failed behavioral assertions.

StoreService now composes explicit50-row actor membership pages through the existing StoresApi. It checks current SDK/session context on every page, stable totals, page/size/end metadata, expected row counts and unique IDs. Only the complete validated population replaces memory/cache. An outage, contradictory page or retired tail reader cannot publish the partial first page. Global discovery alone omits the selected-store hint; later scoped commands retain it. Existing offline projections remain a loaded list and do not grant new authorization.

No new API, database owner, SDK method or schema is introduced. Every other product input remains equal to the preceding qualified source. Existing test transports were updated to provide the real endpoint's pagination metadata; original assertions and golden files are retained. The original Staff regression assertion is byte unchanged.

Local qualification is terminal and green:1,572 full Flutter PASS/0FAIL/0SKIP,0 app analysis issues,114 governance PASS/1NOT_APPLICABLE, normal Android arm64 and explicit iOS simulator debug builds, and independent retained-artifact/font readback. The92 focused checks on source2 have identical product bytes; the final source3 changes only remaining synthetic fixture metadata. Those focused counts overlap the full suite and must not be added to it.

Evidence: `store-pages-negative-v1.terminal.json`, `store-pages-negative-v1.log`, `store-pages-focused-v2.terminal.json`, `store-pages-v3-qualification.terminal.json` and `store-pages-v3-preservation.json` under `verification-2026-11-05/`. Version2 full-suite failures were fixture-contract diagnostics, not accepted results; all were resolved without changing assertions or golden baselines.

Native52 is currently RUNNING on the exact source:53 real local memberships with the Staff-managed Beta store beyond page50, normal Accounts/browser callback, visible store selection and restart, owner store-name sync in both UI directions, Staff product save/web readback, live role downgrade rejection and membership-removal discovery. Real compiled Workerd Gateway/BFF and disposable PostgreSQL provide business behavior. No APK session injection or business response stubs are used. Provider challenge transport is a synthetic local fixture, not hosted anti-bot acceptance.

Do not mark this runtime journey accepted before its actual terminal, source/APK/script hashes, positive and denied calls, database checks, screenshot markers and scoped cleanup are independently reconciled. iOS has compile evidence only. Server Staff-list contracts, native invitation lifecycle, remaining feature/surface work and hosted/provider/signed-release gates remain open.
