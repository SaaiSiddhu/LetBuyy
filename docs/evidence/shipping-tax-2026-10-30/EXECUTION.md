# Shipping and GST implementation - 30 October 2026

Owner scope: repair the audited backend and Merchant/buyer UI, qualify complete
journeys through staging, and release to production. Baseline `391b780b2`;
branch `codex/shipping-tax-correctness`. One agent, existing canonical runtimes.

The read-only audit is retained at
`/private/tmp/letbuyy-shipping-tax-audit-20261030/`. Its 34 existing checks and
eight probes are baseline evidence, not repair or release acceptance.

## Delivery contract

- F01-F10: one percentage contract; authoritative tax calculation shared by the
  reviewed quote and atomic order path; inclusive/exclusive, jurisdiction,
  shipping applicability, deterministic priority and exact line allocations;
  configuration failure remains unavailable rather than becoming zero tax.
- F11-F14: complete supported zone/rate/profile inputs and consumers, range and
  COD validation, deterministic bounded reads, clear quote eligibility and ETA.
- F15-F16: complete the existing Shiprocket adapter and reachable fulfillment
  workflow with explicit remote-effect recovery. Real account access, booking
  and carrier delivery are separate gates; no fabricated live result.
- F17-F18: coherent immutable invoice/adjustment facts, order-total parity and
  visible downstream failure/recovery; ordinary GST invoice and mock IRP remain
  separate states under the Constitution.
- F19-F20: behavioral UI/API/PostgreSQL tests, failure/concurrency controls,
  truthful professional settings, staging and production operating evidence.

No universal GST rate or merchant legal registration is inferred. Existing tax
rates are not multiplied or historical orders rewritten by a guessed backfill.
Global Markets/duties and additional carrier platforms remain out of scope.

## Acceptance lanes

1. Focused positive/negative reproductions and shared-contract checks.
2. Owned PostgreSQL worker/browser journeys; same reviewed and saved financial
   facts across COD/PSP, receipts and invoices; tenant and rollback safeguards.
3. Required governance, money/reconciliation/security suites and web artifacts.
4. Exact staging schema/config/artifacts and meaningful hosted journeys.
5. Authorized develop -> staging -> main promotion and production smoke.

Unobserved gates stay unobserved. Earlier release-specific CI/staging exceptions
do not waive this release's gaps. No production mutation has occurred in this
implementation at initialization.

## Owner delivery-mode decision

The owner confirmed all three modes: Manual shipping and LetBuyy Shipping are
built-in choices; a merchant's own Shiprocket account is a first-party installed
connector. This does not authorize a third-party marketplace, an additional
runtime, a shipping wallet or an unapproved carrier charge. Each profile must name
its fulfilment mode; provider account, credential revision, pickup identity and
remote shipment identity must be bound to the order/booking intent. Platform
shipping stays unavailable until the Shiprocket agreement, billing terms,
credentials and pickup locations are established. The user currently has no
active API account to test against. Do not claim carrier acceptance or delivery.

## Current repair observations (not release acceptance)

The manual shipping/GST candidate includes migrations 411-413 with paired DOWN
files. It changes the canonical quote/order/invoice path, shared contracts, thin
proxies and existing Merchant/Commerce components. No historical financial facts
are rewritten, no shipping provider is activated and no new runtime is added.

| Finding | Current source disposition |
| --- | --- |
| F01 | Merchant percentage points convert once to the stored fraction; browser entry of 18 produces 18% in the actual SQL quote. |
| F02-F05 | SQL-authoritative quote and atomic order share saved product, coupon, delivery and inclusive/exclusive GST facts; shipping consideration and applicable shipping GST reach the invoice. |
| F06-F10 | Unsupported compound GST is refused; country/state/HSN/priority/effective rates, paise allocations and setup failures are explicit. Missing taxable setup cannot become zero tax. |
| F11-F14 | Weight/value bands, product profiles, default profile, handling fee, state/PIN/COD controls, active status, edit/clear and zero-day ranges are connected. Mixed profiles require separate orders; multi-origin allocation is not implemented. |
| F15-F16 | Open: real Shiprocket connector, platform carrier configuration/billing/pickup, booking/AWB, cancellation, tracking ingestion and cost reconciliation. Production simulated labels are refused. |
| F17 | Immutable invoice copies the original supplier address, line discounts/tax components and complete gross consideration, atomically with the new order. |
| F18 | Open: legally qualified linked GST credit notes and tax reconciliation/reporting. Cash refund alone must not invent a tax adjustment. |
| F19 | Selected worker/DB/browser tests pass; full current-candidate qualification, recovery and hosted gates remain separate. |
| F20 | Carrier absence, manual-rate availability, registration and included/added tax are represented distinctly; unsupported features are not called ready. |

Observed logs are under
`/private/tmp/letbuyy-shipping-tax-implementation-20261030/`:

- `gateway-unit-final-06.log`: 1,847 gateway unit checks passed.
- `commerce-unit-full-04.log`: all five Commerce unit segments passed (199,
  173, 1,607, 185 and 27); these are segment counts, not deduplicated coverage.
- `merchant-unit-full-01.log`: Merchant unit command passed all segments.
- `contracts-final-02.log`: 362 contract checks passed. The earlier command's
  tsx IPC sandbox refusal was infrastructure, not a product test result.
- `settings-final-07.json`: 8 owned DB/browser checks passed, including real
  normal Merchant password login, tax/profile/zone/rate create/edit/reload/delete,
  and 24 missing/foreign-Origin refusals across all 12 settings mutation verbs.
- `checkout-final-04.json`: four production-built buyer browser journeys passed:
  COD, changed-price refusal/review, controlled Razorpay capture recovery and
  inventory refusal. Provider responses are controlled in that fixture; no real
  PSP sandbox acceptance is claimed.
- `order-discovery-final-02.json`: all 9 buyer-order scope/receipt checks passed;
  collection browsing still returned an intermittent metadata-unavailable 503.
  A diagnostic rerun passed 4/4, but that alone does not close the intermittency.
- `regression-final-05.json`: all 115 current inventory/tenant/historical-retirement
  and collection checks passed. The earlier broad source snapshot
  failed fixtures attempting old rollback before retiring its GST successors;
  guards were preserved and fixtures now retire/reapply successors in order.
- `gateway-db-full-02`: broad 205-suite run covers an earlier explicit source
  snapshot. Its red results are not final-source acceptance; each repair must
  retain lineage and execute the affected current checks.

`governance-03.log` passed all 114 executed validators (one declared not-applicable
validator); it ran only in a disposable source copy. `typecheck-full-final-02.log`
passed all 81 tasks without cache. `merchant-build-final-01.log` and
`commerce-build-final-01.log` completed production builds; `worker-bundle-final-01.log`
completed the staging Worker dry-run bundle. None activates hosted traffic.

`gateway-db-final-03` is the complete rerun on the final repaired source snapshot;
its terminal result is still pending. Earlier red broad-run results stay recorded.

Typechecks and standalone production builds are recorded separately. Browser
screenshots are synthetic-fixture UI evidence, not production activation.

## Release state and remaining work

No push, branch promotion, hosted migration, Worker deployment, web alias
promotion, DNS change or carrier charge has occurred in this phase. The intended
release order remains develop -> staging -> main. Earlier releases' CI/hosted
staging exceptions do not transfer to this candidate. A qualified release must
identify its finite scope and any exact unmet provider/staging gates first.

The three-mode owner decision is preserved. The current source does not yet
implement the first-party connector or LetBuyy carrier execution. Their missing
account/agreement is an external acceptance dependency, not permission to claim
that pending implementation is complete. Manual shipping and the core GST repair
can be qualified independently while that provider integration is prepared.
