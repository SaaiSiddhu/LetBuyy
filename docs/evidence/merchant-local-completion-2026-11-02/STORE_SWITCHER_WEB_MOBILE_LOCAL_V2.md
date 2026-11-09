# StoreSwitcher and Staff — current web/mobile local source

Current qualified source: `web-mobile-switcher-source-v2`, SHA256 `6b04cb93b05b5cc2a745b8720d44a02e866283be64efc7c831019a3a24491eda`,8,456 inputs. Existing branch/head and unrelated WIP are preserved. This supersedes the source checkpoints in `STORE_SWITCHER_SETTINGS_LOCAL_V3.md` and `STORE_DISCOVERY_PAGINATION_LOCAL_V3.md`; their evidence remains retained.

The source fixes the original Staff namespace regression without changing its assertion; protects current store/account projections from retired discovery; waits for device preference acknowledgement; keeps legitimate Staff Settings usable when owner-only billing/payment reads deny; and exposes current, actionable accessibility semantics and full selector choice names.

Both native discovery and the web header now compose every canonical50-row membership page before exposing their lists. They validate page counts, stable totals and unique membership IDs, and clear the selected-store hint only for actor-wide discovery. Native saved selection beyond page50 no longer falls back to the first store. Offline projections remain a loaded list, not new authorization.

The53-store Android run exposed Refresh below all choices. Two mounted320dp/2.4-text negative tests reproduced the inaccessible initial action. The original Refresh action now appears above choices, through the existing shared form host. The web loader's separate50-only truncation was reproduced by an actual-helper negative test (50returned,53expected), then repaired through the existing SDK. No API, SQL, identity policy, money behavior or shared UI-kit owner was changed.

## Local qualification

- 1,574 full Flutter PASS/0FAIL/0SKIP;94 focused Flutter PASS overlap that suite.
- Entire existing Merchant web test entry plus its new paging file:1,732 executed PASS across606/818/295/13 batches,0FAIL/cancel/skip.10 focused paging checks overlap those results.
- App analysis:0issues; Merchant TypeScript check passes.
- Governance:114PASS/1NOT_APPLICABLE, with existing branch-ref advisories retained. This is not merge or release certification.
- Normal Android arm64 and explicit iOS simulator debug builds pass. Retained APK, all iOS artifact files and MaterialIcons are independently reconciled.
- Eight current53-store widget renders show both themes, normal/large text, initial refresh and last-choice reachability. Representative captures were visually inspected. They are not physical-device or iOS-runtime evidence.
- Fresh owned PostgreSQL Staff lifecycle/invitation35PASS and inventory-setter20PASS remain separately bounded to their unchanged backend inputs.

Exact receipts: `verification-2026-11-05/web-mobile-switcher-v2-qualification.terminal.json`, `web-mobile-switcher-v2-preservation.json`, `switcher-visual-v4.terminal.json`, `native54-prepared.json`.

## Runtime acceptance

Native54 is RUNNING against this exact source. It uses53 real local memberships, Staff Beta beyond page50, normal native/web Accounts login and callback, actual compiled Workerd Gateway/BFF, disposable PostgreSQL, normal selector/restart, owner name saves in both UI directions, actual web-header Beta selection, Staff product save, owner downgrade and removal. Provider challenge transport is a synthetic local fixture; no APK session injection or business-response mocks are used.

Do not accept the runtime from preparation, HTTP200s, screenshots alone or source green. Collect its terminal and independently check the installed APK/source/controller/compiled-script bytes, actual positive→403 observations, database assertions, UI markers and exact scoped cleanup.

Retained diagnostics50/51/52 were input/viewport assumptions, not accepted journeys.53 selected real Beta beyond page50 and saved Alpha natively with web read/save, then failed because Refresh was below the long list. That actual usability defect is repaired in this source. All those failed runners cleaned their own resources/maps and retired synthetic ready credentials. They remain failed evidence, never folded into a passing count.

Remaining work includes native54 acceptance, the possible optional product-edit validation mismatch, unpaginated server Staff-list/error contracts, native invitation delivery/consent, KYC lifetime candidates,45 unreviewed source rows and the unreconciled unique-surface denominator. Full applicable feature, iOS-runtime, hosted/provider/physical-device and signed-release acceptance remains open. Entries120/121 stay excluded,122 paused and51 frozen.
