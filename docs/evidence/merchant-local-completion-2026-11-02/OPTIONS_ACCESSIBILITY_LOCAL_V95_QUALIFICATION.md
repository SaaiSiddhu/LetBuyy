# Source95: product-owned options and iOS private-upload accessibility

Implemented and verified bounded option/web and private KYC recovery journeys on Android and iOS. **Full122 whole-feature acceptance remains open; zero whole features are certified.** This is local synthetic qualification, not a production or provider release.

## Source and changes

Branch `codex/merchant-mobile-parity`, HEAD `ab32485092cae0ac19145abf7b5a101fa3ea338e`. Source95 SHA `6a9dffa117db5c1be62f26f57d8f031910f3e599fc966a1eb0cfc87392519a18`,8,519core inputs. Nine changed/new paths relative to source93 are in `verification-2026-11-05/options-accessibility-v95-source93-delta.json`. No application backend, schema, identity, money or provider-policy change.

The existing Product form now supports product-owned option names/values, additions/removals and axis ordering. Sparse matrices remain sparse on first-value extension; existing variant UUIDs, explicit zero quantities, optional price intent, SKU/barcode and unaffected rows stay bound to their original rows. Newly generated combinations begin without an ID and with zero quantity; the canonical server allocates identity. Duplicate combinations, case-colliding names, implicit merges and more than100rows are rejected without losing entered fields. Removal requires explicit confirmation and changes only the draft until product save. Existing server history/reference constraints remain authoritative.

All saves use the existing versioned canonical product command, tenant/permission enforcement and idempotency protocol. Recovery replays the exact earlier body/key, preserves a newer option draft and adopts a conflicting version only after explicit reload. Store/service retirement removes editable private fields.

Complex private KYC upload/recovery now uses the existing canonical full-page editor with a fixed footer, busy/dirty dismissal, locked original reference/type/key and retained-file review. The original shared short-form implementation and Flutter SDK remain unchanged. The original modal geometry mismatch is reproduced in retained baseline diagnostics; semantic-container, render-invalidation, framework-overlay and dialog candidates were rejected and removed. A nonshared KYC FAB no longer starts a duplicate default Hero flight.

## Local gates

- Full Flutter:1,772passed,0failed,0skipped; exact frozen source unchanged.
- Flutter analysis:0issues.
- Owned product API/Postgres:92passed,0failed, current436 plus separately owned historical346 rollback controls. New cases prove rename/extension/reorder/safe axis removal preserve UUID/stock/customer reservations and new zero-stock variant creation/replay has one effect. Cleanup empty.
- Actual governance in a disposable byte-equal capsule:114passed,1not applicable,0failed/blocked/skipped. Original source and staged entries preserved.
- Fourteen mounted option-matrix workflows cover rename/add/remove/order, sparse rows, stable IDs, duplicate/limit errors, store retirement, conflicts and exact pending-save recovery. Full-page geometry tests compare semantic/painted bounds and tap semantic centers at iOS scales1and2.

Counts overlap and must not be added. Source94's five obsolete confirmation-expectation failures remain retained; source95 exercises the new confirmations while preserving their original capability/no-request assertions. Earlier wrong test-label and rejected geometry-candidate attempts remain as diagnostics.

## Android129 and iOS130: actual web roundtrips

[Android129 proof](verification-2026-11-05/native129-final-local-readback.json), run `a3beeda494a0`; [iOS130 proof](verification-2026-11-05/native130-final-local-readback.json), run `cc1180695772`.

Both used normal synthetic Accounts sign-in, fresh normal debug builds, compiled Gateway/BFF, actual Merchant browser and owned PostgreSQL/PostgREST/R2. Existing variant invalid price sends no write; ID and zero stock survive a native value/price save; web reads130, saves140 and native reads140. Native changes Colour to Finish and Green to Emerald, adds Pack/Single, reorders Finish first, saves without replacing either existing variant, then reads the web rename Finish to Material back on native.

Private KYC actually commits201before a deliberately lost503reply; actual app termination/relaunch, locked original bank_proof/reference1234, explicit retained-file use and original-key200replay yield exactly one private object/document, public0, matching wire/storage bytes and denied anonymous asset access. Native and web show the durable pending scan state. This does not imply scanning/provider approval.

Android retained one driver failure caused by Python leaf-element truthiness; a readback-only continuation did not repeat acknowledged saves. iOS retained one driver failure from scrolling away from Add option above the viewport; the exact unsaved option draft was resumed with the actual list direction and unique compiled XCTest control. Original effects and failures were preserved. Photos selection used observed current-run inputs; identical old timestamps were resolved with the exact named Android album and a create-only same-byte, newly timestamped iOS synthetic input.

Android installed APK equals retained SHA `5abfaf520a43089ff9142c4aa5e0f71dbf84dbc40f50277422c883cec05894c1`. All401iOS130installed files equal the retained normally signed debug app. Each native fixture's4,894core/runtime paths equal source95; eight generated diagnostic images match separate manifest custody.

## iOS131: settled accessibility/pixel proof

[Focused proof](verification-2026-11-05/native131-final-local-readback.json), run `8284a7931140`; [pixel analysis](verification-2026-11-05/native131-pixel-accessibility-readback.json).

A second fresh synthetic KYC-only run uses normal auth and ordinary initial/resumed Upload accessibility taps. All phases pass first attempt. After actual restart and saved-file review, the driver waits1.2seconds for animation to settle, captures matching screenshot/AX evidence, performs a regular `.tap()` and proves the same original-command/private-object/web status outcome. No physical-coordinate workaround is used for app Upload. The native OS photo thumbnail alone uses its observed element center.

On the1206×2622screenshot (3pixels/point), the painted Upload center is `(301.1667,800.0)` and the observed accessibility center is `(301.1609,800.0)`: delta `(0.0058,0.0)`points, within1point. The40point visual fill is centered inside the48point touch target with4point top/bottom padding. The first analysis incorrectly required equal fill/target heights; that failed assumption is retained separately. Correct analysis requires aligned centers, symmetric padding and visual fill enclosed by the touch target. An explicitly synthetic32point AX-offset negative control fails; it is not represented as a real native failure.

iOS130's earlier pre-tap screenshot was taken while review dismissal was animating and is explicitly excluded from synchronized pixel measurement. Its functional normal accessibility tap remains valid. These results close the demonstrated recovered full-page KYC action alignment only; generic resizing-modal and all-accessibility acceptance remain open.

## Final custody

[Custody](verification-2026-11-05/source95-final-custody.json): all8,519core inputs unchanged; staged path/mode/blob SHA remains `67a04f878906e4a92b9a852969da907cd465dc8b3df2be0083d6d42262986c9d`. Raw index bytes changed independently after governance and were preserved, never restored. Relevant original framework source is unchanged and the temporary SDK overlay is inactive. All test supervisors are terminal and owned containers/networks/volumes are retired. Local54350–54353listeners are gone. iOS exact simulator restored Shutdown; original Android AVD remains booted, app stopped, original empty ADB mappings restored. Existing files/Photos preserved. Host9002was never contacted/probed/bound/stopped; only the admitted emulator-only reverse9002-to-host54351 was used and removed. No hosted activation, merge, push or release.

## Remaining work

Complete new-product/new-variant creation and retirement workflows, including options before price entry and last-draft-row removal; validate current-role/revocation/store-switch/conflict matrices and actual buyer Liquid/cart outcomes. Broaden private KYC native format/role/store/provider boundaries. Continue every remaining applicable feature's web/mobile/authority/recovery/buyer criteria. Historical camera/MOV/WebM and other feature evidence retains its exact earlier source. No full122, real-provider, physical-device, hosted or signed-release acceptance is inferred. Preserve51frozen,120/121outsideMerchant,122paused.
