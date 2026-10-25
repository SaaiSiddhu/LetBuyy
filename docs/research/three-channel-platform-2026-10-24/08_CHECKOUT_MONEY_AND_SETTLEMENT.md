# Checkout fee authority payments and settlement

## Origin and financial truth

The server derives sales origin from the trusted channel entry and eligible listing context. A client cannot reduce Marketplace fees by submitting storefront as an arbitrary field. Conversely, a real purchase through the merchant's independent storefront remains a zero-commission storefront sale even if the product was created in Seller or originally discovered through advertising. Acquisition attribution and commercial order origin are different facts.

Existing [cart origin constraints](/Volumes/Projects/LetBuyy/database/supabase/migrations/277_marketplace_cart_sales_origin.sql:10) currently name Storefront and Marketplace. Quick listing vocabulary already includes instant, but that does not complete origin support across checkout, orders, SDKs, reporting and refunds. Extend the end-to-end canonical contract before accepting Quick orders.

## Durable order-line snapshot

For every order line retain the actual seller, product/variant, listing revision, origin, fulfillment location where applicable, quantity/unit, agreed prices/discount funders, tax facts, category evidence and selected commercial policy. Fee facts include effective schedule ID/version, basis, rate or fixed amount, cap/minimum, rounding and computed amount. Preserve provider beneficiary mapping and attributable payment/settlement references.

The [category snapshot migration](/Volumes/Projects/LetBuyy/database/supabase/migrations/296_marketplace_order_category_snapshot.sql:1) supplies historical category evidence; it does not prove fee policy selection and allocation are complete. An existing global store commission or the donor's tier formula is not the new canonical winner.

Money values use integer minor units under existing contracts; no floating-point client calculation is trusted. A ₹1,000.00 illustrative eligible basis at a hypothetical 8% Marketplace rate yields ₹80.00 commission before separately configured tax. The same eligible Storefront basis yields ₹0.00 LetBuyy sales commission. These are arithmetic fixtures, not approved rates.

## Prepaid sequence

~~~mermaid
sequenceDiagram
  participant C as Customer
  participant G as Canonical Gateway
  participant D as PostgreSQL
  participant P as Approved Provider
  participant W as Webhook Service
  C->>G: Submit trusted quote and stable intent key
  G->>D: Validate eligibility and commit order allocation intent receipt outbox
  G->>P: Create bound provider order outside DB transaction
  G->>D: Bind provider reference
  G-->>C: Recoverable payment action
  C->>P: Complete approved provider interaction
  P->>W: Signed provider event
  W->>G: Canonical verification command
  G->>D: One capture outcome ledger and outbox
  C->>G: Recover authoritative outcome
~~~

Do not hold stock row locks during a network call to a PSP. Persist enough durable intent to recover ambiguous provider responses. Same-key same-payload requests replay one result; same key with changed seller/amount/payload conflicts. Authorization is checked before returning a cached receipt.

The current [Marketplace online-payment guard](/Volumes/Projects/LetBuyy/services/api-gateway/src/routes/checkout.ts:814) fails closed while provider eligibility and seller collection remain unresolved. Finish actual approved seller/provider mapping rather than removing the guard to make a demonstration succeed. Public Route/Easy Split documentation establishes possible provider features, not enabled LetBuyy account capability. [Razorpay Route](https://razorpay.com/docs/payments/route/), [Cashfree Easy Split](https://www.cashfree.com/docs/payments/split).

## Late capture and refunds

Allocation can expire while a payment later succeeds. The canonical writer must distinguish captured-and-fulfillable from captured-but-unfulfillable. The latter produces a durable refund-owed or explained suspense obligation with reconciliation; it cannot resell the old allocation or strand the customer charge. Webhook retries, client verification and reconciliation all converge on one writer.

Refund requested, approved, submitted, provider-pending and completed are distinct states. Timeout means unknown until provider lookup or verified evidence resolves it. Refund caps reference original captured amounts and prior refunds. Canceling a line reverses the correct original commercial facts, rather than applying today's category rate. Physical stock return is separately inspected.

## COD and custody

Reuse the [existing COD route](/Volumes/Projects/LetBuyy/services/api-gateway/src/routes/cod-reconciliation.ts:238), [locked collection writer](/Volumes/Projects/LetBuyy/database/supabase/migrations/299_cod_collection_atomicity.sql:6) and [checked remittance binding](/Volumes/Projects/LetBuyy/database/supabase/migrations/298_cod_remittance_request_binding.sql:1). Add assigned collector/location/custody evidence through those owners. Do not create a parallel Quick cash balance or another authoritative COD receipt ledger.

Collection reporting does not itself recognize every cash movement or prove seller remittance. Record exact tender due, collector assignment, collection evidence, handover recipient, shortage/overage, dispute and resolution. A returned package and returned cash are different custody events. A COD refund requires an approved eligible rail and beneficiary verification; a phone field is not authority to pay anyone.

## Settlement and statements

Retain provider-managed weekly eligible settlement as the established direction, subject to actual contracted provider capability. Eligibility accounts for payment/cash remittance, holds, returns, disputes and attributable adjustments. It is separate from “paid.” Batch inclusion must be atomic, stable-key instructions recoverable, and provider completion independently reconciled.

Statements explain gross goods, discounts by funder, commission/royalty/service charges by scope, taxes/withholding, provider/logistics charges, refunds, holds and eligible/finalized settlement. Do not clamp negative obligations to zero or rewrite history. Chargebacks and already-settled returns can create outstanding adjustments that remain explainable.

Subscriptions and advertising use the existing platform-charge verifier and billing history. They do not create fake goods orders or a cross-merchant stored-value wallet. Partner security deposits, if later approved, need a distinct reviewed liability treatment and handling; they are not seller proceeds or operating revenue.

## Money acceptance

Require randomized debit/credit balance tests; concurrent duplicate capture/refund/settle proof; PSP and COD reconciliation; fault injection after external success but before local commit; exact seller/amount/currency binding; append-only schema protections; and user-visible unknown/pending recovery. These are release gates for the exact implementation candidate, not passed by this research.
