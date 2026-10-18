# F3.7 ledger idempotency payload integrity — 5 October 2026

## Phase 10 ad-credit replay integrity — 5 October continuation

Migration `291_ad_credit_idempotency_payload_conflict.sql` carries the
payload-conflict rule into LetBuyy's separate prepaid ad-credit ledger. D-5
defines those credits as a non-withdrawable, non-transferable service
entitlement with its own liability ledger; migration 291 preserves that
business boundary. A replay for an existing key now also has to match the
original purchase amount and funding reference, allocated amount and campaign,
metered campaign/event/quantity, or released campaign and release mode/amount.
Legacy release rows are compared by their effective amount when the old request
mode was not persisted. The paired rollback restores the preceding RPC bodies.

The owned-Postgres test performs a negative control against the prior bodies,
then proves all four changed requests fail and all four exact retries return
the original result without another ledger entry. Migration history validation,
migration safety/replay tests (4/4), and JavaScript syntax checks pass.

This closes only replay integrity. The current Gateway already has
`/billing/ad-credits/intent` and `/billing/ad-credits/verify` handlers. They
create a server-side Razorpay order, scope the `billing_history` row to the
owned site, verify against its stored provider-order reference, and call
`record_ad_credit_purchase` with the stored amount and provider payment ID.
Migration `292_atomic_ad_credit_purchase_finalization.sql` now supplies the
service-role-only SQL finalizer. It locks the stored billing row and atomically
records a unique provider payment reference, posts the ad-credit entry, and
marks the row paid. A second payment for that billing row, a duplicate payment
reference on another row, a foreign site, and a conflicting credit replay all
fail without leaving partial billing state. Exact retries return the original
credit. The owned-Postgres suite also applies rollback and reapply; the additive
payment-reference column and unique index are retained on rollback as audit
evidence. Gateway route contracts pass 8/8 and Gateway typecheck passes. The
real Gateway Worker to owned PostgREST/Postgres suite passes **1/1** (run
`b4b06355a749`) with a synthetic Razorpay order response, valid and invalid
signatures, exact replay, second payment rejection and cross-tenant denial; all
owned database and container resources were cleaned. This is local provider
adapter evidence, not Razorpay sandbox acceptance.

### Canonical funding posting — 5 October continuation

Migration `293_ad_credit_purchase_canonical_liability.sql` now posts the
verified purchase through the source-resolved canonical ledger in the same SQL
transaction as billing finalization and D-5 entitlement issuance. The journal
debits `pa_clearing` and credits the explicit `ad_credit_liability` account;
merchant sales payable is untouched. `billing_history` links to the canonical
transaction. The resolver verifies that each `ad_credit_purchase` source is a
real billing row at the requested site. A same-payment retry also repairs the
canonical link for purchases finalized before migration 293, while the existing
entitlement key prevents a second credit. A ledger failure, entitlement
failure, or billing update failure rolls the complete transaction back.

The owned Postgres proof passes 1/1 and covers balanced account lines,
merchant-payable separation, legacy paid-row repair, exact replay, changed
payment rejection, cross-tenant rejection, source ownership, failure atomicity,
rollback and migration reapply. The real Gateway Worker → owned PostgREST →
PostgreSQL purchase journey passes 1/1 (runner `233c600c1ac3`) with the same
ledger-line and liability assertions; the runner verified cleanup. Gateway
route contracts pass 8/8, Gateway typecheck passes, and migration safety plus
the canonical-ledger-only validator pass. Rollback retains canonical postings
and the new account/source vocabulary as financial audit evidence.

This closes the purchase cash/liability journal for verified top-ups. Full
provider statement reconciliation and sandbox evidence, accounting for ad
credit consumption and any approved reversal policy, purchase attribution, and
complete merchant campaign journeys remain open under Phase 10. Spend cannot
yet be recognized against the new liability account: D-5 permits both
Razorpay-funded purchases and grants, but the current fungible balance and
`spent` entries do not retain which funding source was consumed. The next
accounting change must preserve that provenance and follow an explicit
allocation/expiry/reversal contract; treating every spend as paid-liability
release would misstate granted credits.

## Result

Migration `288_ledger_idempotency_payload_conflict.sql` hardens the canonical
`public.post_ledger_transaction` writer. A repeated
`(site_id, source_type, source_id, idempotency_key)` returns the original ledger
transaction only when the stored currency, ordered accounting lines, and stable
transaction metadata match the new request. Ordered line identity includes
account code, debit/credit side, integer minor-unit amount, sequence, memo, and
line metadata. A mismatch raises SQLSTATE `23505` with a generic conflict
message. The paired rollback restores the prior function definition.

`request_id` is transport-level correlation and is deliberately not part of
accounting identity. Top-level `provider_event_id` is also excluded: caller
inspection found verify and webhook paths can carry different authenticated
event IDs for the same capture. The first event ID remains on the ledger row;
individual delivery receipts remain recorded by the payment webhook/event
tables. Other metadata remains part of the stable request comparison.

## Field ownership traced in the current checkout and money path

| Contract field | Current owner and persisted representation | Boundary / remaining work |
|---|---|---|
| Acquisition/entry channel | Cart creation owns `carts.channel`; checkout handoff copies it to `checkout_sessions.channel` and `orders.channel`. The accepted vocabulary is `web`, `whatsapp`, `instagram`, `pos`, and `api`. | Keep separate from the sales surface. Validate every cart creator and checkout recovery caller against the same vocabulary. |
| Sales surface | The selected server-side route assigns `carts.sales_origin`; `checkout_sessions.sales_origin` is copied from it. Canonical `purchases.channel` records `storefront`, `marketplace`, or `instant`. | Marketplace order creation binds parent origin transactionally. Complete remaining origins and retry/recovery tests across callers. |
| Listing revision | The listing review system owns `channel_listings.approved_product_fingerprint`; migration 278 copies the listing ID and accepted fingerprint to each `order_items` row under the checkout transaction. Migration 289 now prevents later mutation of that item snapshot. | Storefront items do not yet carry the same explicit catalog-revision identifier; define whether their product snapshot is sufficient before adding fields. |
| Financial source | `ledger_transactions` owns `site_id`, constrained `source_type`, `source_id`, `idempotency_key`, currency and normalized ledger entries. `request_id` is correlation only. Capture, refund, settlement, COD remittance, payout, reversal and ad-credit purchase are distinct source types. D-5 keeps prepaid advertising entitlements in `ad_credit_ledger_entries`, with a matching canonical `ad_credit_liability` account for funded purchases. | Reconcile provider statements; define and implement recognition when ad service is consumed; continue the remaining money-writer census. |
| Provider delivery identity | Payment-event/webhook records own provider event receipts and delivery state. `provider_event_id` in ledger metadata is reference metadata, not the unique accounting source. The ad-credit route binds the shared signature verifier to a stored Razorpay order ID; migrations 292–293 bind finalization and canonical purchase posting to one provider payment ID per billing row. | Prove provider duplicate/out-of-order behavior and sandbox reconciliation before activation. |
| Checkout money snapshot | A locked checkout `orders` row owns subtotal, shipping, tax, discount, total, currency and buyer/contact/order-line snapshots. `order_items` owns item description, quantity, price, discount, tax, HSN/GST and product snapshot. Checkout parent `purchases` deliberately has no competing money totals. | Check immutable coverage for all downstream tax, coupon, shipping, fee and refund allocation inputs; never make parent and child totals competing authorities. |
| Promotion/ad attribution | Existing cart/checkout source channel is not a promotion attribution record. No canonical ad-campaign attribution field was found in this checkout-to-ledger path. | Phase 10 must define an event owner, qualifying window, deduplication and refund reversal contract before attributing a purchase to CPC/CPM/purchase billing. |

### Checkout line snapshot correction

The order-level guard in migration 147 already protects locked checkout
commercial fields on `orders`, while migration 278 protects marketplace listing
identity. Before migration 289, ordinary writes could still alter or delete a
linked `order_items` row's price, quantity, tax, or product snapshot after
checkout. The new trigger checks for a locked checkout parent and rejects
changes to the line's order/product/variant identity, customer-facing product
snapshot, quantity, unit and line prices, discount/tax/GST values, or deletion.
It allows fulfillment status/quantity and return/refund progress fields to
change, and it does not freeze draft or non-checkout orders. The marketplace
route continues to bind its listing ID/fingerprint through the same
transaction; the Gateway owned-database regression verifies that path after
migration 289.

### Canonical writer privilege correction

The writer census also found that `post_ledger_transaction` is a
`SECURITY DEFINER` function that validates tenant GUC equality but does not
resolve the caller's money-source ownership. PostgreSQL's default `PUBLIC`
execute privilege therefore let an `anon` role set `app.site_id` and invoke
the writer directly with fabricated balanced capture lines, bypassing
`post_settlement_ledger_transaction` and its source-row resolver.

Migration 290 revokes execution of the low-level writer from `PUBLIC`,
`anon`, `authenticated`, `app_tenant`, and `service_role`; it remains callable
inside the owner-rights source-resolved wrapper. The wrapper is revoked from
`PUBLIC`, `anon`, `authenticated`, and `app_tenant`, then explicitly granted to
`service_role` for the existing server-side Gateway helper. Its legacy grant
state is restored by the paired rollback. All direct app source references
were reads; SQL capture/refund/settlement business functions call the canonical
wrapper. Gateway's service-role refund journey remains green after the ACL
change.

## Verification

The test-first red control failed as intended against the previous writer:
reusing the key with a changed accounting line did not throw (`Missing expected
exception`). After migration 288, the test verifies a new request ID and a
distinct provider event ID replay the same transaction, preserve the first
event ID, and reject a changed amount or stable order metadata. The same
executable test applies the paired rollback and checks the restored definition.

The order-item red control then failed on the expected missing exception when
attempting to change a locked checkout item's unit price (run
`af574866374e`). After migration 289, the real-Postgres order suite passes 1/1
(`479ea2468d95`) with assertions for price/product-snapshot edits and deletion
denied, fulfillment progress allowed, draft-item editing preserved, and
rollback. The production Gateway marketplace cart/order suite passes 11/11
(`b2c5d13c7cf8`), including the transaction that adds immutable listing
fingerprints. Both disposable runners report successful cleanup; the Gateway
runner logged one upstream proxy error among 374 forwarded requests, with zero
refused requests and all 11 tests passing. Migration validation, migration
safety/replay (4/4) and `git diff --check` pass.

The ledger privilege red control exposed that `anon` had `EXECUTE` on the
low-level `SECURITY DEFINER` writer before migration 290 (`02890a208641`). The
final owned-Postgres regression suite demonstrates the pre-migration forged
posting inside a rolled-back transaction, applies 290, denies the same call,
checks every API/service role's privileges, and rolls back to the former ACL
(`cf7ae9039d5d`, 1/1). The production Gateway refund suite asserts
`anon`/`authenticated`/`app_tenant` cannot call either writer, `service_role`
can call only the source-resolved wrapper, and real refund accounting still
posts through it (`507cf74393eb`, 10/10). The canonical-ledger validator passes
and focused B1/B2/D5 contracts pass 11/11. Both runners report zero
failures/skips/TODOs/cancellations and successful cleanup.

The separate owned Gateway checkout suite also passes 3/3 (`634d62a84c1f`),
including synthetic provider capture through canonical ledger posting and
normal order/outbox effects after the ACL change. Its runner logged one
upstream proxy error among 543 forwarded requests, with zero refused requests;
all three assertions passed and owned resources were cleaned.

The executable owned-Postgres regression command covered:

```sh
node scripts/governance/run-executable-suites.mjs --suite tests/executable/money-ledger-postgres.test.mjs --suite tests/executable/late-capture-after-release-postgres.test.mjs --suite tests/executable/money-rpc-idempotency-sweep-postgres.test.mjs --suite tests/executable/foundation-wave1-money-postgres.test.mjs --jobs 1 --log-dir /private/tmp/letbuyy-f37-money-regressions --json-out /private/tmp/letbuyy-f37-money-regressions.json
```

Result: **18/18 passed**, zero failures, skips, cancellations, or TODOs; runner
ID `720f6f281d6b`. The production Gateway worker refund/reconciliation
regression command was:

```sh
node scripts/governance/run-executable-suites.mjs --kind gateway-db --suite services/api-gateway/src/__tests__/owned-db/payment-refund-reconciliation.postgres.test.ts --jobs 1 --log-dir /private/tmp/letbuyy-f37-refund-regression --json-out /private/tmp/letbuyy-f37-refund-regression.json
```

Result: **9/9 passed**, zero skips; runner ID `03870b8aa64d`. Both runners
reported empty container, network, and volume cleanup with no cleanup failures.
`pnpm run validate:migrations`,
`node --test tests/migrations/migration-safety.test.mjs tests/migrations/v2-migration-replayability.test.mjs`
(4/4), and `git diff --check` passed. The red control and sanitized green-run
record are in the paired JSON evidence.

## Scope still open

The ledger and ad-credit payload-conflict, locked checkout line-snapshot, and
direct writer privilege gaps now have local database proof, and the current
ownership map records the discovered source boundaries. The source census
classified `ad_credit_ledger_entries` as the dedicated D-5 prepaid-entitlement
ledger rather than another commerce-ledger table. It confirmed the existing
ad-credit payment handlers, found that their former credit and paid-state
updates were separate, and fixed that race with migration 292. The SQL
finalizer has owned-Postgres and real Gateway Worker payment-to-credit evidence.
The census also found payout-route wallet credits written as compatibility rows
before a canonical release debit. Migration 294 now prevents concurrent
statement claims from spending the same canonical merchant payable and keeps
the in-flight amount reserved until its canonical payout transaction exists;
see the [Phase 9 payout claim evidence](F9_PAYOUT_CLAIM_RESERVATION_2026-10-05.md).
The accounting meaning and source linkage of the pending wallet credits still
need a source-to-ledger trace.
F3.7 remains open: this is not yet a
complete field/event contract across all checkout channels, storefront catalog
revisions, payment writers, advertising attribution, partial/full refunds and
reversals. In particular, Phase 10 attribution policy and the remaining
legacy payout-projection census must be resolved before claiming the matrix
complete. **5 October payout-release follow-up:** migration 301 now makes
post-adapter release/failure finalization atomic across payout statement,
canonical ledger, wallet debit and settlement instruction, verified through
the real owner route with a local provider HTTP stub. Its covered release path
is closed for local transaction integrity; pending payout-wallet credit source
semantics, unknown provider outcomes, reversal and provider reconciliation
remain open. See [F9 payout-release evidence](F9_PAYOUT_RELEASE_FINALIZATION_ATOMICITY_2026-10-05.md).
**5 October payout projection source-link correction:** the source trace now
confirms that pending `wallet_ledger_entries` payout credits are a compatibility
projection, not a second canonical balance posting. `/wallet` derives
`available_minor` from the reconciled canonical `merchant_payable` account and
exposes pending projection rows separately. Manual order-backed statements use
`payout_statement_id` plus `reference_type=payout_statement` /
`reference_id=<statement>` and `payout-credit:<statement>`; settlement-backed
statements use `payout_statement_id` plus `reference_type=settlement` /
`reference_id=<settlement>` and `settlement-payout-credit:<settlement>`. The
generic payout replay path formerly appended a second manual-key credit for a
settlement-backed statement. A real Gateway/owned-Postgres regression first
reproduced two rows, then passed after replay was changed to validate the
existing settlement-scoped source projection and fail closed if it is absent
(run `a68db73f7cf1`). This closes that replay seam; it does not decide weekly
eligibility or make the compatibility `pending_minor` a separate payable.

**5 October payout-credit/reversal writer census:** the active database
writers are now traced across migrations 165, 295 and 301 plus the Gateway
payout route. COD remittance credits are posted and linked to their canonical
remittance transaction by migration 165. Migration 295 creates payout-statement
credits atomically with the statement and source reservation; these remain
pending projections and carry source order IDs or a source-settlement ID, but
are not separate canonical ledger postings. The legacy/manual replay repair
in `payouts.ts` can restore a missing order-backed projection; settlement-backed
replays fail closed if their atomic projection is missing. Migration 301 creates
the posted payout debit and its canonical payout transaction atomically. Refund
flows in migrations 168/282 post under the distinct `refund` source type and
link that transaction to refund/payment records; they do not mutate the payout
projection. The ownership resolver recognizes `reversal`, but no active payout
reversal writer was found in the current source census. Do not infer a general
reversal policy from refund entries. The remaining source-order linkage noted
by this census was subsequently implemented by migration 304; see [Phase 9
source-lineage evidence](F9_PAYOUT_SOURCE_LEDGER_LINEAGE_2026-10-05.md). Approved
treatment of a transfer later reversed or disputed by its provider remains
open.

**5 October payment-capture resolver correction:** the resolver replacement in
migration 303 had dropped the pre-existing `payment_transactions` source branch.
Forward migration 305 restores it and rejects an `order_id` that disagrees with
the payment transaction's owning order. The real Gateway checkout capture suite
passes 3/3, the provider-refund suite passes 11/11, and the payout lineage suite
passes 1/1 through rollback/reapply; details and runner IDs are in [Phase 9
source-lineage evidence](F9_PAYOUT_SOURCE_LEDGER_LINEAGE_2026-10-05.md).

The same follow-up probe exposed a reconciliation defect: the refresh function
sums only posted wallet rows, while a canonical payout fee assessment debits
`merchant_payable` without a matching wallet debit. With a 10,000-paise posted
projection and a 400-paise canonical fee, `assert_money_ledger_site_reconciliation`
raises `variance_minor=-400`. Provider-confirmed refunds similarly debit
canonical merchant payable in migrations 168/282 without a linked wallet
projection. `/wallet` requires zero variance, so it fails closed after such a
reconciliation. Add owned-Postgres regressions for fee and refund paths, project
each recognized canonical delta atomically, and preserve mismatch detection for
unexplained drift.

**5 October reconciliation correction:** migration 303 now projects recognized
canonical fee assessments and provider refunds to one linked posted wallet
adjustment in the same transaction, repairs historical recognized entries, and
preserves mismatch detection for unexplained drift. The owned PostgreSQL
regression and real Gateway refund/PostgREST/PostgreSQL journey both pass; see
[Phase 9 wallet projection evidence](F9_WALLET_PROJECTION_RECONCILIATION_2026-10-05.md).
The current bounded money task is to resolve payout eligibility for missing or
short canonical source lineage and partial refunds before changing payout
amounts or release gates. The detailed evidence is recorded in [Phase 9
source-lineage evidence](F9_PAYOUT_SOURCE_LEDGER_LINEAGE_2026-10-05.md).
Approved provider-reversal/recovery accounting also remains open. Phase 10 still needs
canonical recognition of ad-service consumption, purchased-versus-granted
credit provenance and approved reversal policy, CPC/CPM/purchase attribution,
and complete campaign UI journeys.
**5 October cart acquisition-channel preservation:** the shared channel schema
has a `web` default, so using it as an optional field on the buyer-identity
update still overwrote an existing `whatsapp` channel when the request omitted
`channel`. Cart creation now applies `web` only when neither the request nor an
existing cart supplies a channel; partial identity updates preserve the stored
channel and sales origin. The route-level regression test passes with an
existing `whatsapp`/`marketplace` cart and an empty identity update. Focused
cart and checkout contract tests pass **12/12**, Gateway typecheck passes, and
`git diff --check` passes. The owned marketplace-cart/Postgres suite was added
to assert the same persisted behavior, but the runner could not start because
no real Docker daemon answers `docker info` (runner `642b45c78581`); database
acceptance remains unverified. No hosted database, external provider,
production payment, or live refund was used. Phase 3 and the eleven-phase
programme remain active.

## 5 October route-to-ledger and immutable-snapshot census

Recorded 5 October 2026 (Asia/Kolkata) against source HEAD
`0862687a5008d604d0df23357b2eb511293139fa` in worktree
`/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase2`, branch
`letbuyy/phase2-shared-buyer-identity`.

This is a source census of the current checkout, financial writers, and
advertising attribution seams. It records implementation ownership without
choosing commercial policy or treating a compatibility projection as money
truth.

| Journey/source | Current authority and transition | Verified boundary / open item |
|---|---|---|
| Checkout entry and sales surface | Cart owns the acquisition `channel`; the server-selected route owns `sales_origin`; checkout copies both to the order. Marketplace checkout binds the approved listing ID and fingerprint to the order item in migration 278. | Preserve the distinction between channel attribution and sales surface. Storefront item data has no separate catalog revision ID; the locked product/commercial snapshot is retained, but whether that is sufficient for future revision-level attribution is not decided. |
| Locked order snapshot | The order owns checkout totals, shipping, tax, discount, currency, and buyer/order snapshot. Order items own product, variant, quantity, unit/line price, discount, tax/GST and product snapshot; migration 289 prevents commercial edits/deletion after checkout locks the parent. Migrations 279/281 bind the selected seller shipping-rate snapshot. Marketplace category provenance is persisted immutably by migration 296. | Fulfillment and return/refund progress remain mutable. No duplicate parent purchase totals are introduced. Any additional immutable field needs a named consumer and must not create a competing source of truth. |
| Online capture | Payment confirmation and provider-event handling post `payment_capture` through the source-resolved writer; the source resolver supports canonical `payments` and legacy `payment_transactions` linkage. Migrations 252/305 preserve late-capture and transaction-to-order checks. | Local owned Gateway/Postgres checkout evidence covers capture, retry, late-capture and tenant boundaries. This does not establish a live provider account or hosted readiness. |
| COD collection/remittance | COD collection records the canonical order payment state; remittance posts `cod_remittance` from a tenant-scoped `cod_reconciliation_entries` source and atomically links its canonical transaction (migrations 165, 297–299). | Owned Postgres collection/replay evidence is recorded in the dated F3.7 COD records. Carrier remittance and physical cash operations are not externally verified. |
| Provider/manual refund | Provider-confirmed refunds and manual provider-referenced refunds post a distinct `refund` transaction only after the matching attempt/payment, amount and provider reference pass validation (migrations 168/282). Cumulative over-refund is rejected. Recognized canonical merchant-payable deltas receive one linked wallet compatibility projection in migration 303. | Refund is not a payout reversal. The legacy order-level refund path without a canonical payment attempt still lacks a proven exact source bridge; its compatibility behavior is recorded as owner-policy pending in [F8 refund lifecycle evidence](F8_REFUND_PROVIDER_LIFECYCLE_2026-10-04.md#5-october-review--legacy-order-refund-compatibility-decision-pending). |
| Payout, fee and reversal | Payout statement creation reserves source payable and records source-order lineage (migrations 294/295/304); provider release finalization records the canonical payout debit atomically (301). Recognized fee and refund/reversal deltas project to wallet compatibility rows (303). `reversal` is an allowed canonical source type and resolver input, but a search of current migrations and Gateway writers found no active payout-transfer reversal writer. | Do not infer reversal semantics from refund entries. Provider dispute/reversal recovery, unknown outcomes and payout eligibility for missing or partial source lineage remain owner/provider decisions. Existing statement detail reports lineage but does not enforce eligibility. |
| Advertising top-up, spend and purchase attribution | Verified ad-credit purchase has its own D-5 entitlement ledger and canonical liability posting (`pa_clearing` → `ad_credit_liability`, migrations 291–293), separate from merchant proceeds. Current cart channel and `sales_origin` do not represent an ad campaign attribution. | No canonical purchase-attribution event owner or persisted campaign-to-order binding was found. Before implementing a paid conversion, the contract needs an owner-approved qualifying event, attribution window, deduplication rule, refund/reversal treatment, consent/retention scope, and purchased-versus-granted credit consumption order. No attribution or ad spend policy is implied by this census. |

The census closes the route/snapshot inventory portion of F3.7, not the full
transaction/evidence contract. The focused source-level money and settlement
contracts pass **14/14** (`money-b1-b2-ledger`, `money-d5-ledger`, and
`settlements`). `pnpm run validate:migrations` and the migration-safety/replay
suite pass (**4/4**). A fresh owned-Postgres rerun was not available in this
turn because the host Docker API returned permission denied; the existing
owned-run evidence cited above remains historical evidence, not a rerun.
Remaining F3.7/Phase 9/10 work includes owner-approved payout and reversal
rules, the exact legacy refund bridge, ad-credit funding provenance and service
consumption, and purchase-attribution policy and journeys. Phase 3 and the
eleven-phase programme remain active.
