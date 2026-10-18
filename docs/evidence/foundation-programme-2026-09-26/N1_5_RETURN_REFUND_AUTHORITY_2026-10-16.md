# N1.5/N1.6 — return/refund authority and recovery

This slice closes reproduced backend ownership, approval and duplicate-posting defects in the V1 order/return completion paths. It also repairs the canonical order-reference trigger because repeated collisions prevented reliable current recovery verification. It does not close N1, N6 or the whole programme.

## Reproductions retained

| Run | Observed result |
| --- | --- |
|e074ad718113|Initial fixture label exceeded the synthetic helper limit;0/1, no route proof. Corrected instead of treating it as a product finding. |
|20e88485a9b8|Real return completion500 before the monetary path: the return loader queried without its tenant predicate. |
|7089cbc2f97f|After only the lookup prerequisite was repaired, a supplied foreign refund produced HTTP200. |
|766a5b6d9855|0/3: foreign merchant refund became succeeded with one canonical posting; absent cryptographic approval still completed; two different request keys produced two postings for one refund. |
|d971b2cec759|Return authority20/20 and336 rollback2/2 passed. Two loyalty cases failed during setup on the existing four-digit order-number collision. No retry-only green claim. |
|4fd3817639c6|Deterministic collision: repeat PostgreSQL's PRNG seed for two real inserts; the existing trigger violated `orders_order_number_key`. No trigger or function was mocked. |
|7246cef7594a|Allocator5/5 passed; one rollback test used an invalid trigger-function overload fixture. The fixture now uses a legal ordinary-function overload, and the rollback checks passed in204036d81364. |
|204036d81364|20/22 authority cases passed; corrupted response hash and missing canonical source pointer were both bypassed by cached successful replies. The two reds were repaired. |
|4867fc57f21b|Both gift-card tender paths, rollback and loyalty checks passed; one assertion exposed missing `site_id` on gateway-emitted refund outbox events. |

The earlier reds remain failed evidence. Latest per-suite results and exact source bindings live in `Verification/LetBuyy-Codex-Continuous-Run-2026-10-14/N1.5/return-refund-evidence.json` outside this checkout.

## Canonical change

`resolveReturnScope` performs a minimal, bounded ID bootstrap only when no tenant is known, then verifies live ownership. Signed store scope wins over a selection header. Subsequent reads use the guarded client with explicit return/site/order predicates. The order FK is checked before customer/order details are loaded; embedded lines and refunds are tenant-filtered. The old schema fallback that removed deletion filtering is retired for the current migrated V1 schema.

Migration336 introduces one private ownership/receipt wrapper around the existing `complete_order_refund` monetary writer. Both completion routes use it. It verifies live site ownership and return/order/refund associations under database locks, binds the actor and full intent to a receipt, and commits that receipt with the financial operation. Missing refund selection is allowed only for one matching source; multiple intents require an explicit choice. The original monetary function remains the one writer and preserves its ABI, source family and canonical ledger.

A succeeded refund reuses its original verified canonical transaction regardless of a new transport key. A conflicting provider reference, missing/corrupt posting or duplicated historical source is refused for review. No historical posting is deleted, silently replaced or automatically plugged. Browser and tenant roles cannot directly execute either private monetary entry point.

Receipt replay checks live ownership, response integrity and source identifiers, then verifies the existing canonical posting. It cannot replace source truth with a cached200. The redundant order completion cache is removed. Source replays do not repeat full-order events or notifications. Both routes require the existing cryptographic `refund.approve` proof; a timestamp alone is insufficient.

Partial refunds retain the spent gift-card tender and do not emit a full-order refund notification. A full order refund attempts the original gift-card restoration once per redemption through the existing ledger writer, alongside loyalty restoration. Returned PostgREST errors are observed and logged as pending. Durable gift-card catch-up across all cancellation/provider paths remains an N6 requirement; this slice does not claim that a best-effort call completes it.

The common gateway event adapter now supplies both `site_id` and `store_id` from the same resolved input. Full-order refund payloads use the actual order row, carrying its reference and total. The owned integration checks prove one correctly tenant-scoped full-order event across different transport keys.

## Order-reference prerequisite

Migration337 retains the existing `set_order_number` trigger and `ORD-YYYYMMDD-` prefix, replacing its four-digit random suffix with a noncycling PostgreSQL bigint sequence. The suffix can grow; it is never truncated. Initialization holds the orders write boundary and reserves above restored numeric history. Existing order references and GST invoice numbering are untouched.

Actual owned tests cover repeated PRNG input,24 concurrent cross-tenant inserts, transaction rollback gaps, role denials for rewind/consumption, bigint exhaustion, preserved historical references, migration round-trip and refusal to roll back after allocation. This is a local stability prerequisite within the full programme, not evidence that N6 checkout is complete.

## Verification scope

The current final backend run409849a7af23 passed48/48 with no skips:25 return/refund authority and recovery cases,2 completion rollback cases,18 loyalty reversal cases and3 existing gift-card money-path cases. Order-reference allocator5/5 and corrected rollback2/2 evidence is retained separately with its unchanged337 source. Sixteen focused source-contract/unit checks and Gateway types passed. The broader Gateway unit lane initially passed1422/1423; its one old resolver-shape assertion was updated to require guarded signed scope and live ownership, and the final lane passed1423/1423 with no skips. All6 domain-event contracts passed. The machine record contains the current governance result and final restored dependency/type checks.

The actual Gateway worker, owned PostgreSQL/PostgREST, canonical ledger, role grants, transaction faults and concurrent requests are in the integration path. Step-up consumption tests use signed synthetic fixture evidence; TOTP issuance remains pending. Paid orders, manual refund references and provider callbacks are synthetic setup. They do not prove normal merchant TOTP enrollment/challenge issuance, real provider fund movement, inbox delivery or a hosted environment.

| Verdict | Current scope |
| --- | --- |
| Implementation/integration | Canonical backend paths implemented; real local worker/database proof. |
| Local | Current48-case run green; allocator/rollback and source checks separately recorded. Governance findings retained honestly. |
| Browser/native | Prior exact artifacts retained with original source. New completion/merchant step-up journeys require current normal UI/device proof. |
| Provider | No real provider transaction or message was sent. Approved sandbox evidence remains mandatory. |
| Hosted | No migration, cutover or deployment was performed. |
| Acceptance | N1.5/N1.6/N1 and the63-package programme remain open; all77 original acceptance and103 feature dispositions are preserved. |

Rollback336 refuses financial completion history and ABI changes, retains the service-only permission fence, and supports empty-history rollback/reapply. Rollback337 refuses any allocated reference, including a reservation from an aborted transaction, and refuses trigger ABI drift. Forward recovery is the safe operational continuation once these histories exist.

## Exact continuation

1. Verify the existing merchant TOTP enrollment and `/security/step-up/challenges` issuer through real normal merchant browser/API flows, then connect the maintained native completion UI and approved BFF transport. Preserve operator-specific custody/reset decisions and actor/store request-context guards.
2. Prove current browser and Android order/return completion, ownership denial, stale actor/store refusal, partial/full tender outcomes and actionable verification/error/retry states. Do not use signed test headers as a replacement for that proof.
3. Implement protected inspection and approved redrive for exhausted platform loyalty jobs. The unrelated distributed-queue redrive endpoint does not satisfy this requirement.
4. Retain N6 checkout loyalty intent, remaining order/payment refund projections, broader gift-card recovery/concurrency and provider/hosted acceptance. The order-number collision itself is repaired locally by337.
5. Continue the accepted programme and resolve the existing governance findings; Resend access and privacy retention/erasure decisions remain pending without repeated questions.
