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
- The `checkout-browser.postgres` result in `checkout-final-04.json`: four
  production-built buyer browser journeys passed:
  COD, changed-price refusal/review, controlled Razorpay capture recovery and
  inventory refusal. Provider responses are controlled in that fixture; no real
  PSP sandbox acceptance is claimed. That older aggregate also retains two red
  sibling suites; it is not an all-green report. Current marketplace-cart and
  shipping-settings reruns subsequently passed 16/16 and 6/6 respectively.
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

`governance-05.log` passed all 114 executed validators (one declared not-applicable
validator); it ran only in a disposable source copy. `typecheck-full-final-02.log`
passed all 81 tasks without cache. `merchant-build-final-01.log` and
`commerce-build-final-01.log` completed production builds; `worker-bundle-final-01.log`
completed the staging Worker dry-run bundle. None activates hosted traffic.

`gateway-db-final-03` completed all 206 suites with 1,853 passing checks and three
failed suites, no skips/cancellations and empty owned-resource cleanup. Two failures
are the exact older native-browser/theme acceptance inputs whose full corrected
runs passed below. The third is buyer support reply recovery: intermittent
development-client runs return a 404 before the reply reaches the Gateway. Both
isolated and concurrent development reruns also passed, so its underlying cause
is not claimed fixed. A separate production-built Identity/Commerce control
passed the complete unchanged recovery journey. The canonical release test now
uses those production client kinds, keeps every original recovery/isolation
assertion and emits safe numeric assertion diagnostics. Both concurrent canonical
production-client runs passed (`support-production-final-01` and `-02`), including
committed-response loss, changed-intent refusal, reload/browser restart recovery,
conversation/actor fences, public-history pagination and private-RPC denial. The
accepted 206-suite coverage uses these three exact full replacement executions
for the three retained red entries; runtime/SQL/dependencies/tooling are identical.
The raw aggregate remains red, and the
development observation remains recorded rather than being hidden by retries.

The full earlier snapshot (`gateway-db-full-02`) terminated red: 205 suites,
11 failed suites, 77 failed assertions, no skipped/cancelled tests. It remains
failure lineage, not final acceptance. Its newly observed native storefront test
still tried to edit the now fixed India field. The current test verifies that
field's value/read-only state, the existing successful BFF response and the real
persisted zone. `native-core-final-02` subsequently passed the full production-built
three-app journey: fresh normal signup/onboarding, shipping setup, Liquid theme
publication, buyer sign-in/order/readback, address/account isolation and password
storefront access. Its database and child processes were owned and disposable.

`native-final-01` passed all 63 native PostgreSQL suites: 320 checks, no failures,
skips or cancellations, and verified empty owned-resource cleanup. This is separate
from the 206-suite gateway/cross-runtime run. `shared-security-final-01.log` passed
50 shared checkout/payment and session-verification checks.

The current broad run caught an exact historical theme source pin for the lockfile.
The only new lockfile delta is the Merchant's checkout-core workspace link; no
registry resolution or theme package changed. The active compatibility record now
retains its prior hash and records that exact successor. `niche-final-01` passed
all five native qualification stages with no skips and verified owned cleanup,
including all nine theme install/save/reload/retry/publish flows and the unchanged
admission/frozen package assertions. No old admission or frozen payload was replaced.

Fresh encrypted staging and production backups each passed the exact managed-role
UP/DOWN/UP rehearsal for migrations 411-413. All 523 original public/auth/storage
tables and rows were hash-preserved, including migration aliases, catalog/defaults,
orders and authentication records. History moved 338 -> 341, rolled back exactly,
then reapplied. Both rehearsals ran in owned network-isolated containers without
installing the old privileged helper. Their private result files live under
`/private/tmp/letbuyy-production-release-20261025/fresh-recovery-20261026/shipping411-{staging,production}/`.

The clean local source checkpoint is `d0afb90600b2c60c296220cdd8e53e757bdb2bf1`.
Exact journaled staging/production migration artifacts and both Worker dry-run
bundles have been prepared. The small follow-up
above changes only test/evidence files, not application, SQL, dependencies or
deployment tooling. The integration revision is
`a2f05798fae5bea3b803586a157489adfd2b1ae6`; its tree matches the initial successor source,
and its runtime/SQL/tooling trees match the qualified checkpoint exactly.

Hosted `develop` and `staging` now point to that integration revision. Staging
migrations 411-413 committed and verified with history 338 -> 341, original
history aliases retained, old order/invoice/catalog/domain hashes preserved and
private command ACLs denied to public tenant roles. Staging API version
`87c604fe-6ee4-43a2-8b56-f156dc911a24` matches all three qualified module hashes;
existing bindings and secret names are preserved.

Staging had no purchasable products or delivery rates. A labelled temporary
synthetic site passed nine hosted backend checks: the actual saved delivery rate,
exclusive and inclusive GST, intra-state components, inter-state IGST, weight-band
and PIN refusal, missing taxable setup refusal and absence of order/invoice side
effects. It is offline/draft again. No email, order, payment or carrier booking
was created. This is not normal hosted Merchant sign-in or real carrier evidence.
The first request was refused before application acceptance; its failure receipt
is retained. The successful run reused the verified offline fixture and supplied
the normal Origin/anonymous CSRF request headers; no security setting was changed.

Both production-target web artifacts are READY for the exact integration revision
with automatic live-domain assignment disabled. Current production aliases are
preserved. Four existing-credential HTTP checks passed: Merchant root and both
settings routes preserve signed-out Accounts redirects; Commerce discovery
renders. These are not authenticated Merchant journeys. Public preview requests
instead redirected to provider sign-in, which was not counted as app acceptance.
The inspection CLI unexpectedly created an empty project; it was verified to have
no deployment, alias or Git link, removed, and the disposable local project link
corrected. No existing project was removed.

Typechecks and standalone production builds are recorded separately. Browser
screenshots are synthetic-fixture UI evidence, not production activation.

## Historical release preparation state (30 October)

Staging promotion, schema deployment and byte-verified API activation are complete
as recorded above. Production `main` remains
`55975acd0da3fd39bcff56168e19b05ff598bc43`. No production migration, Worker
activation, web alias promotion, DNS change or carrier charge has occurred.
Release order remains develop -> staging -> main. GitHub run 40973153523 did not
start its jobs because account billing/spending is blocked; this is not CI
acceptance. Full hosted staging sign-in is unconfigured. Earlier releases'
CI/hosted staging exceptions do not transfer to this candidate. The final support
test follow-up changes only the test and this evidence, not the qualified runtime.
The pending review
must identify this finite scope and the exact unmet smoke gates first.

The three-mode owner decision is preserved. The current source does not yet
implement the first-party connector or LetBuyy carrier execution. Their missing
account/agreement is an external acceptance dependency, not permission to claim
that pending implementation is complete. Manual shipping and the core GST repair
can be qualified independently while that provider integration is prepared.

## Production activation — 1 November 2026 (Asia/Kolkata)

The owner continued the candidate-specific reviewed release and its stated TEST-R8
limitations. The final integration revision is
`77584d19dc3dc557f29f9e2fbc7a967fe38e132c`; the final test/evidence source is
`c305df10bd3e71df55a75824ae2be039dfe986b5`. Its runtime, SQL, dependencies and
deployment tooling match qualified `d0afb90600b2c60c296220cdd8e53e757bdb2bf1`.
Hosted develop and staging were verified at the integration revision before main
was fast-forwarded to it. The primary checkout's older local environment refs
were preserved. This section supersedes the historical not-yet-activated state
above; it does not relabel the retained red raw test runs.

Before production mutation, a new encrypted production export was taken and
verified by decrypt/hash round trip. Its isolated, network-disabled exact-role
UP/DOWN/UP rehearsal preserved all 523 original public/auth/storage tables and
rows, all five migration-history aliases, theme defaults and private command ACLs.
Two missing temporary transport helpers were recovered from their original
same-conversation source, not replaced with a weaker transport. The public
Supabase CA was recovered from its official dashboard download location.
Certificate/hostname verification, one-backend batch acknowledgement, an expected
SQL refusal and connection-lock release were requalified before use.

Migrations 411–413 then committed once in production. The migration journal now
contains 341 entries. Existing history and order/item/invoice/catalog/domain
hashes were preserved. Both tax snapshot columns and the profile command exist;
private quote/order/profile commands remain denied to ordinary client roles;
all ten included catalog themes remain eligible.

The first API activation stopped at a local missing approval-environment flag,
before provider mutation. Readback confirmed the old Worker was still active.
The second script supplied the already recorded scoped approval and retained the
first failure receipt. Production API version
`f5d20b78-e4ba-4c26-95f7-65d5ffc17bfa` is active. All three module hashes match
the qualified production bundle; existing bindings and secrets are preserved.

The exact production-target builds were promoted without rebuilding:

- Merchant: `dpl_F9XK6HGGssAodfUDA7xeFPStAvbm`, serving `admin.letbuyy.com`.
- Commerce: `dpl_6vAjA1PL6jDdbCr5ugYJXG9nu2TT`, serving the discovery domain,
  wildcard stores, connected custom domain and existing checkout domains.

Provider readback verifies both exact revisions and all eight Commerce production
domain aliases. Two staging aliases retain their staging deployment. Initial
inspection assertions mistakenly included those staging aliases and expected a
checkout home page; both failed inspection records are retained. The corrected
readback checks the documented checkout-only root refusal separately from a
positive signed-cart journey. Nine public HTTP checks pass: Merchant routes
preserve the signed-out Accounts redirects, storefronts render, Snaz redirects to
its connected custom domain, and checkout roots deny requests without the
required checkout path/handoff. HTTP status alone is not checkout acceptance.

Six production API checks passed across Snaz and the QA store: public products,
saved delivery options and authoritative quotes. Both stores' actual current tax
collection status is `not_collecting`; zero tax in these quotes reflects those
settings. No merchant GST registration or rate was inferred or changed. The
registered-GST positive/negative cases remain separately evidenced by the owned
database journeys and nine hosted staging checks, not a real production taxable
payment.

In the current Chrome profile, the existing QA cart opened
`checkout.qa-wildcard-20261027.letbuyy.store` through its real signed handoff.
Tamil Nadu / PIN 600001 loaded the saved free-delivery choice. Selecting it showed
subtotal ₹1, free delivery, tax added ₹0 and final total ₹1, with explicit
not-collecting-GST and unconfirmed-carrier messages. Changing to an incomplete
five-digit PIN cleared the prior quote and disabled continuation; restoring the
valid PIN recovered choices and the same quote. Back to Cart preserved the one
item and ₹1 total. No address, payment or order was submitted. Signed URLs and
their tokens are excluded from retained evidence.

A second real browser journey used Snaz's existing custom-domain cart, with one
saved M/Blue variant at ₹3. Its signed handoff reached
`checkout.store.pixlnova.com`, and Tamil Nadu / PIN 600001 returned the actual
₹49 and free delivery choices. Selecting ₹49 was refused as a changed quote.
Read-only diagnosis established that the active, unexpired cart's accepted
product version was 16 and the live product version was 17; the variant remained
available at the same ₹3 price. This is the existing stale-fact guard, not proof
of a variant-pricing regression. The guard was not weakened, the cart was not
edited through the database and no checkout was forced. macOS locked before the
normal cart-review/reacceptance journey could be completed, so that custom-cart
recovery remains explicitly unobserved. The initial diagnostic's undefined
column refusal and the corrected read-only diagnostic are retained separately.

**Still unobserved/open:** the production Merchant session expired and requires
the owner's private sign-in before final signed-in Shipping/Taxes UI readback.
The Mac must also be unlocked to finish the observed Snaz stale-cart recovery.
GitHub CI remains billing-blocked, full hosted staging sign-in is unconfigured,
and real Razorpay sandbox capture/refund with the new tax quote is unobserved.
Shiprocket connector/platform execution, carrier billing/pickup/booking/tracking
and F18 GST credit notes/reporting remain unimplemented. These are not described
as completed or as a production carrier launch. No Queue, DNS, provider
credential, paid-plan, live payment or shipment-booking change occurred.

The sanitized activation receipt is
[PRODUCTION-2026-11-01.json](PRODUCTION-2026-11-01.json). Exact private raw receipts,
guard/inspection failures and recovery evidence remain under
`/private/tmp/letbuyy-shipping-tax-implementation-20261030/` and the dated private
recovery directory. Previous Worker/web versions and encrypted exports remain
available. Do not blindly run DOWN after new immutable financial facts are used;
use a preserving forward repair if required.
