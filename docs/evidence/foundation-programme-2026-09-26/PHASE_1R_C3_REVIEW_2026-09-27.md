# Phase 1R C3 continuation review — 27 September 2026

Reviewed clean phase worktree HEAD e6839db9, branch letbuyy/phase1r-firebase-free-marketplace. Read the attached corrective transcript and supplied follow-up reports; inspected source and tests changed since bed78c36. No tests, builds or emulator sessions were run by this review. Prior results are reported evidence, not independently certified results.

## Progress accepted at source level

The four prior C2 concerns have corresponding corrective commits, and focused test files now exist for mapping, cache refresh, address-sheet races and additional consumers. Cart/wishlist now have local persistence; multiple UI actions check mutation outcomes; bulk wishlist moves retain items whose add fails. Address routes converge on the canonical account screen. Header address displays, checkout address reads and add-address writes now use BuyerAddressApi. Fake loyalty membership claims were removed. Preserve this work.

The report's 84/87/89/91 test totals refer to different checkpoints. Record the final current run and scope rather than adding counts or attributing every historical pass to HEAD. A negative control that cannot compile demonstrates API dependency, not necessarily behavioral regression detection; prefer compiling pre-fix behavior with the expected failed assertion where practical.

## Findings requiring closure

1. **Persistence failure still reported as success.** CartProvider._save and WishlistProvider._save catch errors internally and return void; mutation methods then return true. SharedPreferences.setString's success result is not checked. Corrected UI callers cannot show a failure if the provider suppresses it. Decide and implement an honest persistence contract: return durable success, or explicitly report an unsaved in-memory state. Do not lose source wishlist items when a move's destination was not safely saved. Add injected storage-failure tests.

2. **Initialization and concurrent mutation ordering.** Constructors start _load asynchronously, while public mutation methods do not await readiness. A pending load can replace a new mutation with old persisted state; concurrent writes lack explicit serialization. Existing tests wait for initialization before mutations, so they do not establish this behavior. Add deterministic delayed-load and ordered-write tests, plus lifecycle/disposal protection.

3. **Buyer scope is currently device-wide.** Keys local_cart_v1/local_wishlist_v1 and fixed local-device IDs are shared across all buyers; updateUserId is a no-op. This may implement an intentionally shared guest basket, but does not prove account isolation. Local-only persistence does not require a shared namespace. Adopt an explicit policy for guest state, sign-in, logout and A/B switching; preferably partition authenticated state by canonical buyer ID while keeping guest state separate, with a deliberate transfer/merge policy. Do not silently claim existing two-buyer privacy gates cover these providers. The transcript says local storage was owner-directed; this review does not revoke that choice or require server sync now.

4. **Checkout addresses repeat the stale-session gap.** checkout_screen.dart captures a token, awaits list(), and checks only mounted before displaying/selecting results. It does not invalidate selection on identity change; a late A response can populate a still-mounted B checkout. Errors merely stop the spinner, without a distinct error state. add_address_screen.dart likewise checks only mounted before showing success and returning the saved address. Extend the generation/session-aware approach already implemented in the address sheet to these consumers. Test account changes during list/save, logout, errors and an empty reload after the selected address was deleted. Do not present another buyer's mutation result as the current buyer's address.

5. **SDK/native retirement remains incomplete.** App/services still declare Firebase Core/Auth/Firestore/Functions/Storage; models still depend on cloud_firestore. A scoped import search found 71 matching files at review time; the reported 73 used a different point/pattern. Neither raw count is an acceptance gate. Trace consumers, remove dead code, decouple model timestamp serialization, remove dependencies/native configuration and verify the actual marketplace artifact. Preserve unrelated app dependencies, Google Maps, signing assets and backups.

6. **Address save lacks direct behavioral proof.** The report acknowledges the add-address save interaction is not independently widget-tested. Existing tests of another screen are not proof of this adapter, validation, label mapping and navigation. Introduce a narrow injectable map/location boundary or testable save component; verify save failure, field/label mapping and stale-session completion. Do not needlessly build a broad mocking framework.

## Next single bounded continuation

Continue this branch through the remaining C3/C4 work without repeated task-chip pauses:

- Correct persistence, initialization, account transitions and checkout address state with focused tests.
- Complete remaining Firebase source/model/native retirement in the active marketplace graph. Timestamp replacements must preserve nullability, timezone and actual canonical JSON units/formats; do not blindly replace serialization with DateTime.now or delete unrelated legacy consumers.
- Keep local cart prices/stock as display estimates, never payment authority. Working basket/address selection does not establish working checkout/orders/payments. Trace existing canonical cart/checkout APIs before asserting none exist; missing Flutter integration and missing backend capability are different facts. Leave unsupported purchase execution clearly unavailable until its approved phase.
- Run meaningful app composition, active-route, provider and dependency tests, then a fresh artifact build and plugin/APK inspection. A packaged APK that still includes Firebase has not met the owner's removal requirement.
- Produce one corrected evidence matrix at the tested source checkpoint, with exact pass/fail/skip counts and remaining hosted/device gaps.

C5 live-device testing remains paused under the standing instruction. Complete independent work now, then request a controlled resumption when ready; do not silently restart the emulator. On resumption verify ordinary canonical login/profile/address/account-switch/restart/logout against identified backend source versions. Use only necessary owned services and avoid competing build/gate loads.

No merge-as-complete or Phase 2 advancement yet. No deployment, hosted Firebase deletion, production payments, unrelated process termination or backup deletion. Preserve current commits and primary checkout changes.
