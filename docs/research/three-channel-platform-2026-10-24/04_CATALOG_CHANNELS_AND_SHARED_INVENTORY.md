# Bidirectional product reuse channel publication and shared inventory

## Import means enabling a listing

The normal same-business action is “Use these products in Marketplace” or “Use these products in Storefront.” The command reuses canonical product/variant IDs and creates or updates the selected channel listing. It does not export a JSON copy into another app database. App of creation is provenance, while channel of purchase controls eligibility and commercial rules.

The existing [listing schema](/Volumes/Projects/LetBuyy/database/supabase/migrations/217_marketplace_channel_listings.sql:97) already separates site-owned products and selected channels, including storefront, marketplace and instant. The [current listing route](/Volumes/Projects/LetBuyy/services/api-gateway/src/routes/channel-listings.ts:1) resolves owned-site scope and uses real tenant transactions. Extend those owners. Do not create Seller-products and Merchant-products as parallel catalogs.

~~~mermaid
flowchart LR
  M[Created in Merchant or Seller] --> P[One owned product and variants]
  P --> S[Storefront listing and overrides]
  P --> K[Marketplace listing and approval]
  P --> Q[Approved Quick local assortment]
  S --> Pool[Authorized stock pool at physical location]
  K --> Pool
  Q --> Local[Exact Quick location stock pool]
  Pool --> W[Canonical reservation and movement writers]
  Local --> W
~~~

## Shared and channel-specific fields

| Field family | Owner | Editing behavior |
| --- | --- | --- |
| Product identity, brand, base attributes | Canonical owning business | Shared edit audit and optimistic version |
| Variant/pack/unit/barcode mapping | Canonical catalog | Strict mapping; material change can trigger review |
| Base media references | Canonical media ownership | Reuse authorized assets; no cross-tenant exposure |
| Marketplace category and declarations | Listing/compliance contract | Validate current taxonomy and review obligations |
| Listing title/description overrides | Channel overlay where supported | Show when a value overrides the shared base |
| Price, discount window and promotion funder | Channel offer | Effective-dated; never implicit global overwrite |
| Approval and visibility | Channel listing | Independent; hidden is not rejected, approved is not necessarily visible |
| Stock and physical condition | Owner/variant/location/lot | One physical authority, never a per-app count |
| Publication selection | Product/variant channel relationship | Merchant can choose some variants without publishing all |

Example: a merchant has 12 units of variant V at location L, enabled on Storefront and Marketplace. Storefront sells 2: the shared pool decreases by 2, and its LetBuyy sales commission is zero. Marketplace sells 1: the same pool decreases by 1 and the order snapshots the Marketplace fee schedule. Nine units remain before any other holds or adjustments. No nightly two-way synchronization is required because both channels use the same authoritative records.

If five units are physically transferred to a remote Quick node, those five are no longer simultaneously available on the original shelf. The stock transfer records dispatch and actual receipt. Quick orders consume the exact assigned node's stock. Shared product identity does not turn geographically distinct stock into one unrestricted number.

## Bidirectional workflow

1. Resolve current person, business membership and catalog permission.
2. Select existing products and exact variants; show current channel status.
3. Preview shared facts, overrides, required declarations and expected fees.
4. Submit a stable idempotent enablement intent with expected product/listing revisions.
5. Server verifies ownership, channel entitlement and required fields.
6. Create missing listing records once; preserve draft/review states where not eligible.
7. Return per-item results, current revisions and actionable missing steps.
8. Observe the same product IDs and stock in the receiving app.

The reverse Seller-to-Storefront flow uses the same command family with a different requested channel. A Seller-created product need not appear in Storefront until selected. An explicit “Duplicate as new product” action is different: it creates a new identity and does not automatically share inventory. Cross-legal-business import is not this flow and requires an authorized ownership/supply transaction.

## Stock invariants

Use the actual semantics of existing available/reserved/committed counters. Do not apply a generic subtraction formula twice if the stored available value is already net of holds. Document and prove the current equation with real writer fixtures before extending it. Physical stock reconciles to received/dispatched/adjusted movements; saleable stock excludes unsafe, quarantined and applicable safety buffers.

The [reservation kernel](/Volumes/Projects/LetBuyy/database/supabase/migrations/141_executable_inventory_reservations.sql:65) already uses an explicit location and locking. The [current order writer](/Volumes/Projects/LetBuyy/database/supabase/migrations/388_cart_order_fact_snapshots.sql:265) still selects a default location, so exact Quick location binding is new work. The [stock mirror update](/Volumes/Projects/LetBuyy/database/supabase/migrations/216_sync_products_stock_on_checkout_paths.sql:37) must be reconciled before assuming global stock represents every physical pool.

Required concurrency proof: Storefront, Marketplace and Quick simultaneously attempt the final eligible unit from a legitimately shared location. Exactly one accepted allocation results. Each accepted order consumes once, duplicate submits replay one receipt, and a changed payload under the same key conflicts. Row-locking and retry behavior must be tested with actual transactions. [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html), [Isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

## Edits rejection and withdrawal

A price/title correction specific to one channel updates its overlay. A material shared product change invalidates the relevant Marketplace approval until reviewed. A Marketplace formatting rejection need not remove a lawful Storefront product; a real safety recall may block affected goods across all relevant channels. Unpublishing removes channel availability while retaining product, inventory and historical order facts.

Simultaneous edits require expected versions. A draft made in Merchant before a Seller update must return a conflict and reviewable diff, not overwrite the newer value. Bulk enablement must produce per-item durable outcomes so failed items can be retried without duplicating completed ones.

## Supermarket and counter stock

Shared shelves require reliable POS/counter sales capture or a protected Quick stock allocation with physical control. A feed needs source/event IDs, watermark, observation time, replay handling and a freshness bound. A stale absolute count cannot overwrite intervening sales. Pause intake when the stock promise becomes unsafe. A supermarket's existing revenue does not prove its integration or picking capacity.

Multi-owner custody is a later extension with explicit owner and custodian permissions. Same barcode is not common ownership. Receipt, loss, withdrawal, returns and cash settlement remain attributable to the actual owner and applicable agreement.
