# Merchant KYC lifetime: reproduced local repair

Source `kyc-selection-source-v2`: SHA256`9924957f802fbd5b77c395e3ad18b19573d7ad5fbb886a9ad39419b4ba456769`,8,459 inputs. Exact four-path delta from the accepted StoreSwitcher source: the existing KYC screen, one existing test fixture and two new regression files. Canonical backend, SQL, identity, SDK, web, UI-kit, provider/storage behavior and all Staff assertions are byte unchanged.

## Reproduction and repair

Initial selection: the actual StoreContext/SDK populated Alpha control passed. In the controlled frame boundary, selection moved to Beta before the initial ensure continuation, yet the old screen dispatched an Alpha overview request under Beta's frame. Negative v3 retained1PASS/1FAIL. Earlier v1interruption/v2timeouts are fixture scheduling failures, not application proof; the eventual fixture constructs actual asynchronous owners outside the widget fake clock and explicitly drives both clocks.

The existing screen now checks the starting account/selection frame, the current StoreContext identity and the returned store's selected ID before any overview request. A legitimate initial default choice is still allowed. A changed frame shows an explicit reload state and sends no old-store query.

Provider lifetime: four composed cases replaced KycService, StoreContext, both, or the service while an overview reply was pending, keeping their logical key equal. Loaded controls and real request arrivals preceded the negatives; old overview text remained or was accepted late. All four negative assertions failed before repair. The existing screen now observes the providers and invalidates its generation, SDK binding, store, overview and busy read state when their identity changes. Explicit Retry performs a fresh current read; tests prove both retirement and successful recovery. This is presentation lifetime enforcement, not a new authorization system.

The existing synthetic TestStores fixture now exposes the same selected store ID returned by its ensure method. Removing exactly the three inserted getter lines restores its original bytes; no original assertion was removed or weakened.

## Verification

49 focused KYC PASS/0FAIL/0SKIP, including the six new selection/provider cases and all existing containment/India-upload tests. Fresh complete app analysis reports0 issues. The complete Flutter suite freshly passed1,586 tests with0FAIL/0SKIP. These focused counts overlap the full suite.

The ordered qualification is complete: all six steps exited0, the terminal was collected, and source stayed unchanged. Governance passed114validators with1NOT_APPLICABLE and no failures/blocks/skips;211existing advisories remain. Normal Android arm64 and explicit iOS simulator debug builds passed. Independent readback verified the retained APK, all377iOS artifact files, matching Material Icons fonts and the still-Shutdown owned iOS simulator. No native KYC launch or release signing was performed. See `verification-2026-11-05/kyc-selection-v2-qualification.terminal.json` and `kyc-selection-v2-independent-gates-readback.json`. No verifier is running; the source freeze is lifted. The1,732 Merchant web tests/typing are reused only after every web/shared/backend input matched the previously qualified viewport source exactly. Preservation proof: `verification-2026-11-05/kyc-selection-v2-preservation-web-reuse.json`.

## Exact limits

No KYC provider call, real document, upload, hosted change, money/identity/schema change or signed release. These tests do not demonstrate an unauthorized backend effect. Upload-dialog dismissal/uncertain-intent lifetime, malformed list projections, shared UI composition and character-label/visual review remain open. This accepts neither complete KYC nor full 122-feature parity.

Native58's independent normal53membership web/Android StoreSwitcher/Staff story remains at its exact previous99ddsource/APK, with safe durable custody. It includes bidirectional owner-name sync, restart, supported Staff product save/web read, live downgrade403editor retirement, removal discovery and data/effect-once checks. It is not a current KYC native proof. The exact task emulator was gracefully stopped after independent readback; userdata preserved. iOS remains compile-only.

35 surface rows remain unreviewed; the unique surface denominator is null. Staff server-list/invitation, other product fields/media, remaining mobile surfaces and all full-feature/iOS-runtime/hosted/provider/release gates remain open.120/121excluded,122paused,51frozen.
