# Implementation roadmap estimates and acceptance

## One stream and expanded scope

The owner selected you plus Codex working through one implementation stream. No parallel-agent staffing or fixed AI speed multiplier is assumed. The plan now includes a dedicated Seller application, Marketplace web, Store Ops web and complete channel interoperability, so the older Quick-only 6–10 month planning range does not describe the expanded programme.

The budgets below include focused implementation and immediate meaningful verification/rework. They are estimates from source gaps, not measured velocity. Assume five focused days per week and timely access to stores, devices, provider sandbox and owner/professional decisions. External waiting time can extend the critical path without consuming the same number of engineering days.

| Package | Deliverable | Dependencies | Focused days |
| --- | --- | --- | --- |
| P0 Baseline and admission | Exact source/schema/provider facts, current mandatory predecessor gates, scoped Seller/Ops promotion and commercial records | Completed research; later implementation authorization | 5–8 |
| P1 Shared identity and business entry | Canonical clients, verified relationships, business/location selection, current permissions and revocation | P0 | 10–15 |
| P2 Shared catalog and inventory | Bidirectional enablement, overlays, material review revisions, shared-pool concurrency and current stock semantics | P0/P1 | 15–25 |
| P3 Merchant and dedicated Seller | Preserve storefront experience; adapt Seller donor screens, readiness, listings, orders and statements | P1/P2 and early fee/readiness contracts | 20–30 |
| P4 Marketplace native purchase and discovery | Eligible search/seller/reel/ad paths, actual cart grouping, native prepaid/COD and recovery | P2/P3, provider eligibility and required P7 contracts | 15–25 |
| P5 Quick location and Store Ops | Exact-node serviceability/assortment/stock, perishable handling, preserved Ops task/packing/handover | P1/P2 and canonical checkout contracts | 25–35 |
| P6 Delivery and partner execution | Preserved Delivery integration, physical GPS/proof/custody, supermarket sync and cash close | P5 and approved partner responsibility matrix | 15–25 |
| P7 Commercial billing and reconciliation | Category snapshots/reversals, Quick contracts, subscriptions, existing COD/ledger/settlement and statements | Early schedule contracts after P0/P2; closure after P3–P6 | 15–25 |
| PW1 Marketplace web | Customer responsive Marketplace/Quick web, web sessions, catalog/cart/checkout/orders and public discovery | P1/P2/P3/P7a; Quick acceptance with P5/P6 | 20–30 |
| PW2 Store Ops web | Location-scoped receiving/queue/scan/pick/pack/handover browser workspace and recovery | P5 | 10–16 |
| PW3 Cross-surface hardening | Browser coverage, web/mobile race/isolation tests, private-cache/SEO controls and hosting cutover rehearsal | PW1/PW2 and P4–P7 | 5–8 |
| P8 Integrated hardening and future-effective readiness | Real-role security, DB races/faults, provider/device evidence, load/soak, privacy, restore/rollback | All functional slices and mandatory shared-platform gates | 20–30 |
| P9 Operating pilot acceptance | Staff/partner rehearsal, exact candidate review and controlled operating validation | P8 plus real sites/SKUs/hours/support | 8–12 |

The sum is **183–284 focused days**, **220–341 rounded days with 20% contingency**, or approximately **44–69 working weeks** at five focused days/week: roughly **10–16 months for a controlled all-three-channel pilot including both new web frontends**. At three focused days/week the same budget becomes about 74–114 weeks. Reforecast after two weeks of accepted slices rather than retaining an estimate contradicted by observed baseline failures.

These are budget buckets, not a rule to finish one row before starting all others. P7's policy/snapshot prerequisites precede affected payment acceptance, while its cash/statement closure follows real operational events. Sequence these tasks in one stream; do not invent parallel capacity to hide dependencies.

Split each bucket into small independently reviewable repository phases, normally around two focused days, using the existing phase/branch/gate process. A budget bucket is not one oversized unreviewed implementation change.

| Milestone | Conditional planning window | Evidence delivered |
| --- | --- | --- |
| Shared-account/catalog and first Marketplace web slice | 8–14 weeks | Existing merchant and Seller vertical slice, same product/stock and denial/recovery |
| Merchant plus Seller controlled candidate | About 5–7 months | Actual approved Marketplace purchase/fulfillment/financial loop with storefront regression |
| All-three-channel local pilot | About 10–16 months | Full buyer–seller–Ops–rider–admin operation accepted for exact scope |
| Broader franchise network | Plan separately from pilot, often requiring another measured expansion period | Actual partner outcomes, staffing, demand and accountable support |

No full-platform launch scope is silently removed. Existing required V1 reels, three ad billing models, merchant, privacy and settlement work remain applicable. P0 identifies which accepted predecessor gates are already satisfied and which must join this release's critical path. If major mandatory foundation work remains unverified, update this schedule explicitly rather than waiving it to keep the date.

## Implementation work-package acceptance

| Package | Positive proof | Negative/failure proof | Completion artifact |
| --- | --- | --- | --- |
| Identity | Same verified owner opens Merchant/Seller/Ops where authorized | Wrong realm, revoked membership, fake business link and stale callback denied | Exact client/session matrix and UI evidence |
| Catalog | Products enabled in both directions with shared IDs | Duplicate key, stale edit, wrong business and unapproved publication rejected | Real worker/DB fixtures and per-item receipts |
| Inventory | Every channel observes actual physical pool | Last-unit race, stale counter feed, wrong node/lot and duplicate movement handled | Reconciled stock equations and concurrency results |
| Seller | Eligible business completes normal onboarding and listing | Sandbox KYC, suspended seller, changed material revision and self-approval blocked | Readiness/review and complete seller journey |
| Purchase | Native customer completes supported prepaid/COD | Lost response, delayed capture, duplicate callback and unsupported provider recover | Actual provider sandbox plus canonical ledger evidence |
| Ops | Staff receive/pick/pack/handover real assigned work | Wrong pack, missing stock, revoked grant, interrupted task and wrong rider refused | Device/backend staff walkthrough |
| Delivery | Current rider accepts/picks/delivers or returns | Expiry, two offers, post-pickup reassignment, missing GPS and offline replay handled | Physical-device and custody evidence |
| Commercial | Correct origin/category fee and statements | Storefront charged commission, wrong effective rate, double royalty and excess refund denied | Reviewed examples, snapshots and reconciliation |
| Operations | Pilot shift opens and closes responsibly | Shortage, failed delivery, unsafe return and provider outage resolved | Staff drill and attributable exceptions |

## Minimum release evidence

1. Exact source/working-file hashes, migration assembly, grants, environment, app builds, flags and provider mode recorded.
2. Canonical issuer and actual normal sign-in UI proven for each released client; verified cross-role links do not grant extra privileges.
3. Positive-control-first tenant tests and same-seller location tests run with actual non-superuser roles; no forged payload or stale grant bypass.
4. Shared product enablement and cross-channel final-unit races prove one product/stock authority; listing and origin leakage regressions pass.
5. Complete prepaid and COD loops include loss/restart and at least one failure/refund/cash-return path. Provider sandbox and local stub evidence remain separate.
6. Ledger balances, PSP/COD reconciliation, physical stock and custody tie to attributable facts; unexplained differences do not pass.
7. Required Android/iOS device scanning, background GPS, permissions and notification flows work on supported builds.
8. Seller review, fresh/chilled handling, support duty, cashier close and partner termination/incident procedures have real accountable owners.
9. Marketplace web and Store Ops web prove normal UI journeys, browser/device/scanner behavior, private-session/cache isolation and web/mobile concurrency; applicable future-effective privacy/consumer requirements, provider contracts and professional decisions are completed for the actual launch date.
10. Load/soak, alert delivery, intake disable, compatible rollback and owned restore are observed on the exact candidate.

## Rollout sequence and rollback

Introduce read-only catalog/channel previews first. Enable reviewed seller/listing operations in an owned environment. Prove normal storefront regression before native Marketplace payment acceptance. Operate Quick against a controlled node/SKU/hours configuration, initially with rehearsed staff and supported tenders. Expand one dimension at a time only after reconciliation and service evidence.

Use server-controlled scoped flags for discovery, new-order intake, fulfillment and dispatch. Disable intake without hiding existing order tracking, support, cash close or refunds. For accepted financial operations, recovery generally uses durable lookup, forward fixes and compensating entries. Do not drop financial tables, restore stale stock over valid sales or forget packages/cash to “roll back.”

## Next bounded implementation task

After a later implementation instruction, start P0: pin exact reusable source and schema state; reproduce one positive/negative Merchant, buyer, listing, stock and money fixture; establish actual provider/environment readiness; record exact app promotion and commercial alignment work. This research does not execute P0, start another chat, resume another programme or release an application.
