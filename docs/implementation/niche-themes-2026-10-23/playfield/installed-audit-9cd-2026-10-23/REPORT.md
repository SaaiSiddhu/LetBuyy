# Playfield installed lifecycle: independently audited first pass

Run **9cd50e893016**, immutable Playfield **2.0.0**, Editor's saved ledger at **2026-10-23 17:20:42 UTC**. Acceptance remains **OPEN**. This is an independent audit of actual Editor-controlled merchant/buyer evidence, not a new Playfield browser run or final completion of all fourteen cases.

**Observed dispositions: 1 PASS, 2 FAIL, 4 PARTIAL, 1 BLOCKED, 6 NOT_RUN.** In the requested three-value full-case view, incomplete or blocked cases remain uncredited: **1 PASS, 2 FAIL, 11 NOT_RUN**. The execution-detail column preserves which of those eleven actually have partial evidence or a prerequisite blocker.

| Case | Full-case status | Execution detail | Actual result and outstanding obligation |
| --- | --- | --- | --- |
| PF-I01 | NOT_RUN | PARTIAL | Real product, three variant UUIDs and collection observed. Complete fresh canonical bindings, installed instance, product/cart versions and shipping-rate readbacks were not captured. |
| PF-I02 | NOT_RUN | PARTIAL | Template heading A/B save/reload/publish, anonymous buyer readback, restore A, retained draft B and reapply B are supported by real release IDs and matching hashes. Controller records preview iframe failure; complete install/preview journey is not accepted. |
| PF-I03 | NOT_RUN | PARTIAL | Actual products-route search `Playfield`, age `6-8`, interest `art` returned one product; reload and Newest preserved those values. Interest clear settled with age retained. Age-clear evidence contains its correct target URL but only “Loading storefront”, so its settled result is unproven. Collection scope, pagination and repeated unrelated parameters remain unexecuted. |
| PF-I04 | NOT_RUN | NOT_RUN | No genuine empty age/interest intersection and recovery were exercised. No fabricated facet option is credited. |
| PF-I05 | FAIL | FAIL | Actual UUID cycle Inherited → Unknown → Paper → Inherited updates the selected panel correctly. Outer age, warning, 15-item contents, tray/tile measurements and Wood remain visible for Unknown/Paper. Reload of the bare PDP resets selection and disables Add; exact-selected-edition reload is unproven. |
| PF-I06 | FAIL | FAIL | Normal merchant Clear edition materials → Save returns “This change must originate from this merchant app.” Failed draft is retained; no durable material clear/version advance/readback is established. |
| PF-I07 | PASS | PASS | Real Inherited and Paper lines remain distinct after reload, each quantity 1 at ₹480, total ₹960. Durable IDs, saved options and distinct canonical fact snapshots agree with the UI. Both snapshots validate against the public canonical schema. |
| PF-I08 | NOT_RUN | PARTIAL | Actual quantity 5 attempt for Inherited with observed stock 4 did not change the accepted cart or zero order count. Paper stock-zero mutation/refresh/restore did not run after the save blocker. No paired before/after inventory hash or complete payment/ledger/outbox evidence exists. |
| PF-I09 | NOT_RUN | BLOCKED | Hosted checkout trusted HTTPS and corrected fixture are pending. No Playfield shipping-rate binding, quote or COD order is claimed; no direct API substitute. |
| PF-I10 | NOT_RUN | NOT_RUN | No actual COD confirmation exists to replay with the same key or compare effect counts. |
| PF-I11 | NOT_RUN | NOT_RUN | No accepted old order or separately staged stale-able active cart before editing. |
| PF-I12 | NOT_RUN | NOT_RUN | No actual blue → green edit or stale commit; `CART_FACTS_CHANGED` and zero effects were not exercised. |
| PF-I13 | NOT_RUN | NOT_RUN | No accepted old/new order pair or immutable historical comparison. Current cart snapshots cannot satisfy this case. |
| PF-I14 | NOT_RUN | NOT_RUN | Specific product conflict, invalid facts, no-session, foreign-site and lost-save-reply controls were not executed. A common theme conflict is separate evidence. |

The controller ledger and this audit agree on all fourteen dispositions. The audit narrows PF-I03's age-clear claim because its only saved snapshot is still loading. Failure evidence is retained in `inputs/editor/`; earlier checkpoints are preserved and superseded by `case-results.json` for this first pass.

## Binding and runtime evidence

Editor remains sole browser controller (`01a166eb-66bb-7042-bb47-2aaafef26f53`). This chat opened no browser, runtime, database or build and made no HTTP, SQL, seed or fixture mutation while auditing. The shared run is evidence, not a separate browser handoff to this chat.

| Binding | Actual value |
| --- | --- |
| Candidate | `/private/tmp/theme-editor-candidate-20261023-final02` |
| Candidate source manifest SHA-256 | `c85083b28b6cfc8696679189d682a9e35b93f7603e54117e60a264aa109fcf0a` |
| Database level | Through migration 390; later source/native qualification is not applied to this baseline |
| Playfield bundle SHA-256 | `eb21c6b0e48b40cb11b5f3ba1e45f6f2ec8c50667175e82c8edb6bbe36299efc` (controller's installed-run record) |
| Merchant origin | `http://admin.threadline-9cd50e893016.localhost:57225` |
| Buyer origin | `http://syn-threadline-ui-d11a8917.localhost:57226` |
| Hosted checkout origin | `https://checkout.localhost:57228` |
| Site | `7dfc2cb7-b06e-411c-9b2a-0b44882705be` |
| Product | `db9fdd4f-da77-4d74-806b-759edce71270` |
| Inherited variant | `39b713a7-44a5-4327-ae9f-40d45c76bc2d` |
| Unknown variant | `2fcc0c0f-3551-419b-a72b-cc4bfe012898` |
| Paper variant | `d21309b4-c4a0-4eca-a591-c5a3f01d138f` |
| Collection | `3c8b559a-d10a-49d5-b21d-74ba3a6debdc` |
| Active cart | `20467e3d-c3b3-409f-be6a-ee4874049a91` |
| Installed instance / shipping rate / product version / cart version | Not supplied in reviewed canonical proof; no invented binding |
| Orders | Actual guarded site count 0; no order UUID |

The released origin source repair is absent from this candidate. Candidate guard SHA is `c288af9f88b5919f09c28391625801ee0c1331544085e01a60ad9252e4934631`; workspace repair SHA is `4e1671afcb62bba3dc1d93a3e588b92e58d0d9ba7a3c081e8df4ee6ddb174f96`. This explains why source qualification alone cannot clear PF-I06; live save/reload must be retested in an allocated corrected fixture.

## Independent verification and preservation

`verify-saved-evidence.py` passed eleven bounded verification groups and retained **39 byte-identical sanitized input copies**. It independently checked four real publication release IDs, A/restore-A hash equality, B/reapply-B hash equality, public headings, selected UUIDs, two distinct cart lines and snapshots, overstock cart equality and exact original-cart restoration. The original two-Pink cart was restored at quantity 2, ₹560 each, ₹1120 total, with zero orders. This equality is limited to the approved whitelisted result; no hidden cart token or complete ledger/effect invariance is inferred.

`validate-cart-snapshots.ts` validated both saved cart snapshots with `ProductFactSnapshotSchema`; it made zero live calls. The saved source probe reproduced PF-I05 with the actual factory, mapper, Liquid renderer and controller. That source reproduction demonstrates the defect, not a passing repair or a new installed execution.

Nine relevant factory/facts/picker sources match both their earlier probe pins and the candidate. Read-only hash checks matched **296 pinned artifacts**, including all **113 original M1 files**, 27 original archived inputs and retained static review outputs/screenshots. No frozen production source, original visual, accepted report or archive was edited. This installed evidence contains AX snapshots, not Playfield screenshots; visual screenshot coverage remains unclaimed.

Machine evidence: `case-results.json`, `saved-evidence-verification.json`, `cart-snapshot-schema-validation.json`, `preserved-artifact-verification.json`, `source-pins.json` and `audit-receipt.json`. The finite repair proposal is `SOURCE_REPAIR_PROPOSAL.md`; it implements nothing.

## Remaining allocated work

Continue under the existing shared-runtime owner after explicit corrected-fixture allocation: verify fresh durable bindings, live merchant save and hosted checkout trust, complete the unfinished obligations, retain both failures until actual retest, then run COD/replay/stale-cart/history/security cases through the canonical journeys and approved observability. PF-I05 may remain a documented known failure while other cases proceed; it needs its own named source allocation and candidate delta before repair acceptance.

The follow-up stays active because all fourteen cases have not been executed to completion. No cross-chat message was sent or retried.
