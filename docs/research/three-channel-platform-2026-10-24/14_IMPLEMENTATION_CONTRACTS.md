# Proposed implementation contracts and worked invariants

This appendix makes the design concrete for future implementation. Field groups and command shapes below are proposals to reconcile with canonical shared types and existing routes. They are not executable migrations, newly active endpoints or permission to build alternative domain owners.

## Channel vocabulary

Use Storefront, Marketplace and Quick as product labels. This plan proposes retaining **instant** as Quick's canonical wire channel/origin value because the existing listing schema already has it. Extend the current two-value cart/checkout origin contract consistently rather than allowing both quick and instant to become competing persisted meanings. Confirm and record that mapping in P0/P2 before source changes.

| Product label | Proposed persisted/wire value | Fee owner | Fulfillment reference |
| --- | --- | --- | --- |
| Storefront | storefront | Hard-zero LetBuyy sales commission plus separately contracted services | Existing merchant shipping/pickup policy |
| Marketplace | marketplace | Approved category/price/effective schedule | Attributable seller order and promise |
| Quick | instant | Active Quick partner contract and distinct actual services | Exact approved seller/node allocation |

Do not accept origin from an arbitrary editable product field. Product creation app, acquisition attribution, current app name and persisted order origin are independent facts.

## Product and listing field dictionary

| Field group | Required facts | Source of authority | Important validation |
| --- | --- | --- | --- |
| Canonical item | Product ID, owner site, base identity/attributes, material revision | Current catalog owner | Tenant-owned, valid current revision |
| Sellable unit | Variant ID, SKU, pack/unit, barcode mappings | Current variant owner | Exact pack and allowed quantity precision |
| Channel publication | Listing ID, product/selected variants, channel, state, visibility, version | Existing listing owner | Owner matches product; transition via approved writer |
| Offer | Currency, price revision, tax/discount context, validity, allowed overrides | Existing pricing/quote owner | No ambiguous active rule; server selects actual price |
| Marketplace review | Reviewed product/listing/media revisions, reviewer, decision/reason | Existing moderation owner | Seller cannot self-approve |
| Quick assortment | Seller variant, node, assortment revision, local eligibility | Canonical local-assortment extension | Approved item at actual authorized location |
| Stock | Owner, variant, location, applicable lot/condition, quantity semantics | Existing inventory kernel | No count per app; no barcode ownership merge |

### Same-business channel enablement example

~~~json
{
  "operation": "enable_catalog_channel",
  "business_selector": "11111111-1111-4111-8111-111111111111",
  "target_channel": "marketplace",
  "items": [
    {
      "product_id": "22222222-2222-4222-8222-222222222222",
      "expected_product_version": 7,
      "variant_ids": ["33333333-3333-4333-8333-333333333333"],
      "expected_listing_version": null
    }
  ]
}
~~~

The operation uses a stable idempotency header bound to actor, resolved business and normalized payload. The business selector chooses a membership to resolve; it does not grant tenant access. The server supplies buyer/workforce identity from the verified session and ignores any attempted identity override.

For bounded bulk operations, define a maximum item count and either atomic-set semantics or explicit per-item transaction receipts. This plan recommends explicit per-item results for catalog enablement, with a stable operation summary and stable item identities, so one malformed product does not require resubmitting every accepted item. Do not invent an unbounded workflow engine to achieve this.

~~~json
{
  "operation_status": "completed_with_pending_readiness",
  "results": [
    {
      "product_id": "22222222-2222-4222-8222-222222222222",
      "variant_ids": ["33333333-3333-4333-8333-333333333333"],
      "channel": "marketplace",
      "listing_state": "draft",
      "missing_requirements": ["category_declaration", "seller_provider_readiness"],
      "inventory_action": "reuse_authorized_physical_pool"
    }
  ]
}
~~~

Reverse reuse changes target_channel to storefront and evaluates applicable storefront readiness. It does not change ownership or clone quantity. A deliberately duplicated product is a separate named action and must not imply shared stock automatically.

## Readiness evaluation

Represent separate underlying states rather than one permanent is_verified boolean. An aggregated result can return capabilities such as prepare_catalog, publish_marketplace, accept_prepaid, accept_cod, fulfill_at_node and view_historical_statements, each with current blockers and revision/context.

~~~json
{
  "channel": "marketplace",
  "capabilities": {
    "prepare_catalog": {"allowed": true, "blockers": []},
    "publish_marketplace": {"allowed": false, "blockers": ["seller_review_pending"]},
    "accept_prepaid": {"allowed": false, "blockers": ["provider_not_eligible"]},
    "view_historical_statements": {"allowed": true, "blockers": []}
  }
}
~~~

Cache this only as a presentation aid. Purchase and sensitive mutations recheck current state. A paid plan, old approval screenshot or sandbox document result cannot mint an allowed capability. Preserve the appropriate historical-order remedies during restrictions.

## Commercial rule selection

~~~text
resolve verified channel entry, seller and eligible listing
if origin is storefront:
    assert LetBuyy sales commission is zero
    select only separately contracted applicable services
if origin is marketplace:
    validate current seller, category and listing revision
    select one approved effective schedule for category, price band and currency
    reject missing or ambiguous selection
    calculate with canonical money and rounding rules
if origin is instant:
    validate assigned node, seller and active Quick agreement
    select eligible actual services and one primary variable basis per service
persist immutable line/service financial snapshot with canonical order
~~~

The contract must define inclusive/exclusive price-band boundaries, time zone/effective timestamps, fallback category policy, minimum/cap, discounts by funder, tax handling and rounding. No accidental “first row returned” chooses a rate. Price-band exceptions and zero-rate policies are deliberate configured rules, not bypasses.

~~~json
{
  "sales_origin": "marketplace",
  "currency": "INR",
  "category_snapshot": "approved-category-reference",
  "fee_policy_snapshot": {
    "schedule_version": "illustrative-policy-v1",
    "fee_kind": "marketplace_sales_commission",
    "basis_minor": 100000,
    "rate_bps": 800,
    "calculated_minor": 8000,
    "rounding_policy": "canonical-reviewed-policy",
    "status": "ARITHMETIC_EXAMPLE_NOT_APPROVED_RATE"
  }
}
~~~

The example demonstrates ₹1,000.00 and ₹80.00 only. It is not a deployable fee schedule. A refund identifies the original snapshot and attributable reversed quantity/value. A new category or rate cannot retroactively change that result. Separate ledger entries explain tax/service/provider adjustments under their applicable owners.

## Shared stock mapping and concurrency

An abstract physical example has 12 eligible on-hand units, 2 active holds, 1 committed unit, 1 quarantined unit and a safety quantity of 1. Its available-to-promise value is 7 if those buckets are disjoint. The implementation must first map these concepts to actual stored counters: if available already equals 7, subtracting the buckets again is wrong. This example defines physical reasoning, not the existing database column formula.

Lock applicable owner/variant/location/lot rows in stable order, validate current available quantity, create/update the canonical allocation, and commit the durable command receipt/audit/outbox in the same transaction. Test under real concurrent transactions, not sequential fake repository calls. External provider work happens after database locks are released.

| Race or interruption | Required outcome |
| --- | --- |
| Storefront and Marketplace buy final unit | One accepted allocation, one typed stock refusal |
| Quick and counter sale race at a shared pool | One coherent physical result through the accepted integration contract |
| Same stock command after lost response | Original durable receipt, no second movement |
| Same key with changed variant/quantity | Conflict, no effect |
| Physical count overlaps sales | Count reconciliation accounts for intervening movements |
| Hold expires while payment succeeds | No restored invalid allocation; explained captured-unfulfillable recovery |
| Revoked location staff replays receipt lookup | Current permission enforced before disclosure |

## Quick assignment and quote context

A serviceability result should carry a trusted reference to the approved node and coverage revision with a bounded lifetime. The quote references that context, exact assortment/price revisions, basket revision and customer address. If implementation uses a signed context, the signature is not permission to skip current store/policy/stock validation.

~~~json
{
  "channel": "instant",
  "serviceability_status": "serviceable",
  "assignment_reference": "server-issued-reference",
  "seller_site_id": "11111111-1111-4111-8111-111111111111",
  "inventory_location_id": "44444444-4444-4444-8444-444444444444",
  "coverage_revision": 3,
  "assignment_rule": "configured_priority_then_distance_then_stable_id",
  "eta_status": "estimate_requires_current_operating_and_routing_inputs"
}
~~~

One initial Quick order resolves to one seller/node. Address changes can require a different basket context, unavailable-line review and new quote. Do not migrate silently. A last-second pause follows a tested accepted-before-close rule or refuses submission without partial order/stock effects.

## Ops and rider transition contract

Commands identify the durable task/order/package/assignment, expected version and relevant proof. Server identity and current permission are implicit from the verified session, never selected by request body. An opaque operation reference supports outcome recovery without repeating the business mutation.

~~~json
{
  "operation": "verify_package_handover",
  "task_id": "55555555-5555-4555-8555-555555555555",
  "package_id": "66666666-6666-4666-8666-666666666666",
  "assignment_id": "77777777-7777-4777-8777-777777777777",
  "expected_task_version": 9,
  "pickup_challenge_reference": "short-lived-assignment-bound-proof"
}
~~~

The writer checks ready package, current accepted rider, matching node/order, proof validity, replay status and version. Custody transfer, state event, audit, outbox and receipt commit atomically. After pickup, ordinary reassignment is denied; a supervised custody transfer is a distinct authorized workflow with attributable goods/cash handover.

## Reconciliation facts and release mapping

| Domain | Independent evidence to reconcile | Failure cannot be hidden by |
| --- | --- | --- |
| Goods | Opening count, receipts, movements, picks, losses and inspected returns | Global product count overwritten from one location |
| Customer money | Captures/refunds, amount/currency/seller binding | SDK callback or always-true verification helper |
| COD | Collection, collector custody, recipient handover and shortage resolution | Setting order delivered or paid locally |
| Seller proceeds | Immutable commercial facts, holds, adjustments and provider settlement | Mutable wallet or zero-clamped debt |
| Partner charges | Actual agreed service/right and effective contract version | A generic percentage on every channel's GMV |
| Advertising | Verified funding, eligible billable event, cap and reversal | Untrusted client click totals |

Every proposed field and command is mapped to a canonical owner before implementation. Add contracts and realistic fixtures for positive, denied, duplicate, conflicting, out-of-order and lost-response cases. Existing source and all accepted app boundaries remain unchanged by these documentation examples.
