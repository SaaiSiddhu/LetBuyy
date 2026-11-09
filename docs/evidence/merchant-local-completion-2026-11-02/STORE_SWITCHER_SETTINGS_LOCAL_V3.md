# StoreSwitcher, Staff and Settings — current local qualification

Current canonical source: `switcher-settings-source-v3`, SHA256 `8c62c4e5ca146aae5e9f7fb3bc08957b88471cb6962bf820a7d4721df0b8500e`, 8,452 inputs. Existing branch/head and unrelated WIP are preserved. This supersedes the source status in `STORE_SWITCHER_STAFF_LOCAL_V6.md`; that file remains historical evidence.

The original Staff regression passes without changing its assertion. Production and staging invitation/command keys retain their exact deployed representation; local/development use the existing issuer-specific AppConfig namespace. Hosted and other local issuer data are neither adopted nor removed.

StoreSwitcher now uses the shared form sheet, full choice labels, current-scope callbacks, preference acknowledgement, refresh/retry and one actionable accessibility region. Store discovery suppresses the selected-store hint only on the actor-wide membership read. Retired discovery cannot erase a newer store/account selection. Discovery beyond the first page is still open.

Real native testing exposed a separate Staff Settings failure: owner-only payment and subscription denials hid the whole page and switcher. Primary store navigation now remains available while optional panels fail, wait or deny access. Unknown payment values stay disabled, retry is explicit, current401 retires private state, and old-scope responses cannot replace the current store. Server owner/staff policy remains unchanged.

## Qualified gates

- 1,559 unique full Flutter PASS, zero FAIL/SKIP; 79 focused PASS (overlap, not additional full-suite tests).
- App analysis: zero issues. Governance:114PASS/1NOT_APPLICABLE; branch-ref advisories are not merge/release proof.
- Android arm64 and explicit iOS simulator debug compilation pass. Independent retained APK, all377 iOS artifact files and MaterialIcons readback pass.
- Twelve actual Settings widget renders cover both themes and normal/320dp/2.4 text states. These are renderer checks, not physical-device accessibility certification.
- Fresh owned PostgreSQL Staff lifecycle/invitation suites:35PASS/0FAIL/0SKIP; resources cleaned. Prior inventory-setter positive/denial evidence remains separately recorded.
- Preservation readback: only five existing mobile implementations and four new test files differ from utilities4. Backend, SQL, SDK, identity policy, models, shared UI kit and money formulas are unchanged.

See `verification-2026-11-05/switcher-settings-v3-qualification.terminal.json`, `switcher-settings-v3-preservation.json`, `settings-optional-visual-v1.terminal.json` and `staff-current-db-v1.json`.

## Android/web acceptance

Current run51 is in progress against the exact qualified source. It uses normal native/web Accounts login, the real compiled Gateway/BFF, disposable PostgreSQL and synthetic owners/staff. No session injection or business-response mocks are used. A local one-use challenge-provider transport fixture is not real hosted anti-bot acceptance.

Run50 independently observed both store choices, legitimate Staff Settings despite owner-only optional denials, native→web and web→native owner store-name readback, and Staff-store selection restored after app restart. It stopped before product submission because its input helper left two old characters in a synthetic field. The runner correctly failed. No live-role rejection claim is drawn from that run. Its owned resources/maps were cleaned and synthetic ready credentials retired. Run51 adds a focused empty-field precondition before replacement text; product source and permission assertions are unchanged.

Do not mark run51 accepted until its terminal, actual200→403 command observations, removal discovery, database one-effect checks, exact artifacts/source and cleanup are independently reconciled.

## Remaining boundaries

The employee-list endpoint's pagination/error contract, complete membership pagination, native invitation delivery/acceptance, iOS runtime, the remaining surface audits and full applicable feature programme remain open. Hosted/provider/physical-device/signed-release acceptance is excluded from these local results. Entries120/121 remain excluded,122 paused and51 frozen; no reserved capability is activated.
