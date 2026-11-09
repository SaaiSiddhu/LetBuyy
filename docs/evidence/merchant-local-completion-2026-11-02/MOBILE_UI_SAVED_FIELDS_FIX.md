# Saved shipping/menu fields and reachable actions — 6 November 2026

Current slice source is saved-fields-source-v4, SHA823d816f06cb8b21ecedb637f9ea6dc6cdf390c6caeae5fbb7676cf4231dc37a,8,444 canonical inputs. Exact manifest, original preimages, diffs, preservation proof, negative diagnostics and terminal records are under verification-2026-11-05. Only two application presentation files and two new frontend test files differ from the accepted native41 source; all8,440 other canonical inputs, including services/SDK/backend/domain/identity/persistence and the owned native fixture, remain byte-identical.

## Resulting behavior

- Editing a saved shipping rate's price retains its existing min/max gram limits, including zero and open-ended limits. The saved rate shows its original zone as fixed, matching the existing immutable-zone update contract; creation retains zone selection. All original numeric helpers, units, other flags and request/response serializers remain unchanged.
- Editing a menu label retains the saved parent link and the unedited URL, target/resource, visibility, new-tab flag and ordering. Menu replacement still uses the existing service/SDK and its fresh readback.
- The item editor keeps its text controllers alive until its exit transition has completed. Original presentation themes, barrier behavior and closed-loop traversal are preserved.
- Add and Save occupy a wrapping footer in the existing Scaffold, replacing the floating Add button that intercepted Save. The footer takes only its required height and reserves space for success feedback, so Add/Cancel remains reachable immediately after a save.

## Reproduction and verification

The new mounted-widget tests use the real existing frontend services and typed SDK with isolated controlled transport. They dispatch normal edits and inspect exact requests plus fresh GET/readback; they are not hosted database or native acceptance. Pointer hit-test warnings are fatal, and lazy rows are reached through their real scroll owner.

saved-fields-negative-v1/v2 were initialization diagnostics retired through their exact owned test PIDs before application assertions. Their interrupted Flutter exit0 is **not a pass**. saved-fields-negative-v3 reached the real controller-use-after-disposal bug; its shipping prerequisite assumed one initial read, while the existing selection-keyed screen performs a legitimate reload. saved-fields-negative-v4 reached all four shipping weight-loss assertions and the real floating-Add/Save overlap. After that overlap and editor lifetime were repaired, saved-fields-negative-v5 produced2PASS/6FAIL: four null-weight payload failures and two null-parent failures, with root-item positive controls passing.

The corrected binding/footer source passes **37 focused tests** with0FAIL/0SKIP: eight new saved-field/action tests plus29existing shipping configuration/scope tests. They include existing scope retirement, denial, metadata and pagination controls; no weakening of protected assertions or service policy occurred. Intermediate footer placement/sizing failures are retained in focused-v1/v2/v3; focused-v4 is the successful current-source terminal.

Current-source qualification is complete: analysis0issues; full Flutter1,478PASS/1unchanged protected Staff namespace FAIL/0SKIP; governance114PASS/0FAIL/0BLOCKED/0SKIP/1NA; both normal main.dart debug builds exit0 with independently retained Android APK and377-file arm64 iOS bundle readback. The owned iOS simulator remains Shutdown. The original source/index remained unchanged through the validation-only governance copy. These are local source/compile checks, not runtime, signed-release or integration acceptance for the changed surfaces. Native41 independently passed on its preceding exact source/artifact; these changed shipping/navigation surfaces do not inherit that runtime acceptance.

## Remaining boundaries

Shipping/tax canonical sheets/full-page editors, profile/COD/weight-control parity, navigation scope/query races, complete public storefront propagation, native keyboard/current devices, iOS runtime and hosted integration remain open. This small slice does not certify shipping/tax calculations, all menu hierarchy operations, provider delivery, full119-feature parity or release readiness. The programme exclusions/pauses and the unchanged protected Staff namespace failure remain explicit.
