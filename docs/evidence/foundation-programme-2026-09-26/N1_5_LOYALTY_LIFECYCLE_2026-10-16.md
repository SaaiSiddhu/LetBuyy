# N1.5 loyalty lifecycle — current earning authority, 16 October 2026

The required N1 rewards feature includes merchant configuration, earning/reversal and provider/hosted acceptance. The Android read slice is separately proved; it does not close these remaining requirements. Native coupons/reviews/ratings/banner delivery retains its original N3 disposition. No acceptance package or feature has been reassigned.

## Valid current-source reproduction

Run `293100d796bd`, against the real existing worker and full migration-332 PostgreSQL/PostgREST, passed the legitimate earning/retry/value-snapshot control and failed three actual assertions:

- A completed newest order filled the batch limit, so an older eligible order was skipped forever.
- The canonical award RPC credited 100 points to a buyer who did not own the paid order.
- Reusing an earning receipt with another buyer/order was accepted instead of reporting a conflicting payload.

Run `d34287ac0c93` retained the valid positive control and additionally proved two earning entries for one paid order when the caller changed its key. The prior `293100d796bd` result remains the conflicting-payload reproduction; these overlapping runs are not a unique aggregate pass total.

Earlier run `46a1e6ed9955` failed on a missing fixture brace, and `4e42a7e0f188` failed because synthetic fixture tags exceeded the existing helper limit. They executed no earning scenario and are not behavioral evidence. The direct ESM helper diagnostic is also not a runtime finding. The fixture was corrected to the actual tag/label contracts before the valid reproductions. All owned cleanup was verified.

## Canonical repair

Paired migration 333 and the existing scheduled worker now:

- Select pending work in the database before applying the limit. Completed, unowned, below-minimum and frozen/closed-account orders cannot consume the window. Ordering is deterministic and oldest first; there is no cursor or second mutable balance.
- Share the existing `floor(total * earn_rate_bps / 10000)` calculation between discovery and authoritative posting. The ledger writer still derives amounts and records value-at-earn metadata. No point-valuation policy is selected by this change.
- Recheck and hold the paid order and its explicit buyer-order link inside the money transaction. A subject that changed after the worker read is denied, and a later sweep can credit the current owner.
- Bind a replay to the original order, account owner and earning type. Serialize by order as well as retry key, and enforce one non-null-order earning entry with a unique index. Existing duplicate historical earnings refuse index creation; no immutable row is deleted or rewritten.
- Keep discovery, calculation and posting private to the backend service role. Browser and tenant roles cannot call them. Retain the canonical account lock, active-programme/account checks, metadata and retry behavior.

Four existing executable fixtures now provision explicit buyer-order ownership without weakening their assertions. The frozen-account probe uses a fresh paid order, so it tests a real new award rather than replaying an already earned order. Historical migration-243 rollback/reapply runs at its exact schema snapshot; the current writer is checked unchanged. Applying that historical rollback directly to current HEAD would erase later ownership guards and cannot certify current recovery.

## Current evidence

Evidence is under `Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.5`:

- `loyalty-lifecycle-focused-source-current.log`: 22/22 maintained source/permission/rollback checks, no skips.
- `loyalty-lifecycle-gateway-types-current.log` and `loyalty-lifecycle-worker-types-current.log`: both pass.
- `loyalty-lifecycle-current-db-result.json`, run `b61da795b724`: 49/49 actual database checks across six suites, no failed/cancelled/skipped/TODO cases, 131.4 seconds, empty verified container/network/volume cleanup.
- The worker suite passes 11 cases covering normal posting, backlog eligibility, simultaneous workers, a live owner change, pre-write failure, lost committed reply, malformed/unavailable discovery, actual role denials and paired migration recovery with retained entries/definitions/ACLs. The other five suites preserve programme settings (10), value-at-earn/current redemption behavior (6), refund restoration (7), stored-value fences (9) and current definer-role closure (6).
- `loyalty-lifecycle-source-changes.json`, the before directory, scoped diff and current hashes preserve the implementation boundary. Source/SQL/configuration hashes bind this checkpoint; the earlier native APK and its backend-332 proof retain their separate manifests and verdicts.

## Remaining accepted scope

The completed work is the canonical earning authority and its verified backend recovery. Merchant web/mobile configuration and a normal merchant-to-buyer earning/tender/refund readback journey remain required. A restored-points RPC proof is not a full normal refund journey. Provider-sandbox, hosted, physical-device/distribution, privacy retention/erasure and overall N1 acceptance remain open. Nothing was pushed, deployed or applied to shared/hosted databases.

`D-LOY-REVALUE` is explicitly unresolved in the source authority. One owner question has been presented: block decreases while points remain, allow audited revaluation, or preserve each earning's value. Existing valuation semantics are retained pending that answer; earning, ownership, recovery and other independent work continue. This is not a new decision or approval inferred from silence.
