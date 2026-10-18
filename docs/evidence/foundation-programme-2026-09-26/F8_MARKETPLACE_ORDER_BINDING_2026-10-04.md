# F8.2 marketplace order binding — 4 October 2026

## Delivered locally

Marketplace-origin hosted checkout now carries each listing ID into a dedicated database transaction instead of calling the storefront order RPC directly. Migration 278 adds a `service_role`-only `create_marketplace_checkout_order` RPC. It takes the canonical checkout idempotency lock, locks each listing/product/site, verifies the listing belongs to the seller-bound checkout and still matches the approved SHA-256 product revision, then delegates order pricing, inventory reservations, purchase creation, and optional buyer ownership to the existing canonical checkout RPCs.

The transaction changes the purchase's `channel` to `marketplace` and binds each resulting `order_items` row to its listing ID and approved fingerprint. Pair/format constraints and a database trigger prevent later changes to those snapshot fields. Replays verify the marketplace purchase origin and matching line bindings. The Gateway maps stale/ineligible listings to a recoverable conflict response. Storefront-origin checkouts keep using the existing RPC path.

The supported hosted path is seller-bound: all marketplace cart lines must belong to the store identified by the route. Migration 278 does not remove the single-child-per-purchase index or implement cross-seller allocations. D08 remains unresolved for marketplace collection/provider eligibility and contracting entity, so no online marketplace provider behavior is claimed here.

The hosted payment-intent route now rejects Razorpay for marketplace-origin carts before entering the idempotent payment step. This matters because the storefront Razorpay path creates a pending order before requesting the provider; an owned-Postgres regression confirms the marketplace request leaves checkout at `delivery`, with an empty intent and no additional order. Marketplace COD remains the only available/exercised order method until D08 is accepted.

## Verification

| Check | Result |
|---|---|
| `node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/marketplace-cart-origin.postgres.test.ts --kind gateway-db --jobs 1` | **7/7 passed** through the real Gateway worker, PostgREST and runner-owned disposable Postgres 16 database. Covers approved seller listing checkout, purchase origin, immutable listing/fingerprint identity, authenticated buyer-order ownership, denial when a product is deactivated before order creation, and marketplace Razorpay refusal before order or intent creation. |
| Owned storefront regression suites `hosted-checkout-buyer-ownership.postgres.test.ts` and `authenticated-checkout.postgres.test.ts` | **10/10 passed** with migration 278 applied, confirming existing guest/authenticated storefront checkout remains intact. |
| `pnpm exec tsx --test services/api-gateway/src/__tests__/checkout-d6.test.ts services/api-gateway/src/__tests__/checkout.test.ts` | **18/18 passed.** |
| `pnpm --filter @letbuyy/api-gateway run typecheck` | Passed. |
| `pnpm run validate:migrations` | Passed; migration/rollback pairing safety checked. |
| `git diff --check` | Passed. |

The owned runner created and removed its own isolated resources. Migration 278 was applied only to that disposable database. Earlier suite attempts exposed test-fixture issues (an unsupported listing transition, an overlong synthetic buyer label, and an ambiguous assertion); those were corrected, and the final run is green. No restored/shared/hosted database, provider transaction, browser/device journey, deployment or live order was touched.

## Remaining Phase 8 work

- Resolve D08 with current written provider eligibility, contracting-entity and fund-flow evidence before enabling marketplace online collection.
- Decide and implement cross-seller parent purchase allocations with seller-scoped child orders and buyer privacy; preserve canonical order, inventory, ledger and refund ownership.
- The native marketplace app's mobile and Flutter web-layout carts now use the signed contract for one-seller COD; see [F8.3 native client evidence](F8_MARKETPLACE_NATIVE_COD_CLIENT_2026-10-04.md). Browser/device acceptance and listing-withdrawal/stale-revision recovery UI remain open.
- Connect buyer-facing shipping-rate discovery/selection and pin-code serviceability to the server checkout quote. Until then, the current server's standard method fallback is ₹0 when no rate ID is supplied; this behavior is recorded, not accepted as a commercial shipping policy.
- Verify provider sandbox intent/capture, duplicate and late callbacks, capture after inventory/listing changes, idempotent recovery, fulfillment, partial refunds and buyer complaints.
- Complete Phase 8.7 channel certification and the dependent F6.5 purchase-time/takedown acceptance.

Phase 8, F6.5 and the eleven-phase goal remain open. This is a local, owned-database implementation milestone, not provider, device, legal, hosted or release acceptance.

## 4 October continuation — current owned runtime rerun

The current seller-bound marketplace cart-origin suite passes **9/9** against the real Gateway
worker and a runner-owned Postgres 16 database, including all current listing/origin, buyer-binding,
stale-product and online-provider-denial cases. The runner exited successfully after cleaning its
labeled disposable resources. This reconfirms the one-seller boundary; it does not implement
cross-seller allocations or resolve the pending buyer-facing shipping, COD, refund or privacy policy.

## Cross-seller F8.2 preflight - 4 October 2026

Current source confirms this is not an index-only change:

- Migration 219 defines the canonical `purchases` parent with `origin_site_id NOT NULL`, unique
  `(origin_site_id, idempotency_key)`, platform-only RLS, and intentionally no parent amount/status.
  Its current partial unique index permits one child order per purchase.
- Migration 278's marketplace writer accepts one `p_store_id`, keys the checkout lock to that seller
  and idempotency key, and revalidates every listing against that seller.
- Migration 279 binds one seller-owned shipping rate to the same transaction. The checkout session,
  inventory/pricing call and returned order are seller-scoped.

The current one-seller COD path remains safe, but cannot create one globally idempotent marketplace
parent with correctly seller-scoped children. Picking a cart seller as the parent's origin would
misstate provenance; retaining independent seller purchases would not meet the programme's
multi-seller journey. A candidate canonical direction, subject to owner policy answers, is one
platform-level marketplace purchase with a stable global cart/idempotency identity, no combined
stored total/status, and one server-priced child order per seller. The buyer can group its linked
child orders; merchants continue to read only their own child order.

Buyer-facing grouping, per-seller delivery/COD, and seller-owned refunds need the owner choices
requested in this conversation. Online marketplace payment remains gated independently by D08.
No cross-seller schema or API change was made during this preflight; the existing seller boundary
is preserved rather than silently choosing product or money policy.

## 4 October single-seller regression continuation

Added a mobile checkout regression assertion to the existing single-seller COD service journey:
two currently approved listings belonging to different sellers must produce
`MARKETPLACE_SINGLE_SELLER_REQUIRED` before the mobile app creates a server cart. The existing
positive seller checkout remains in the same test. The assertion is authored but unverified: the
Flutter wrapper could not write its SDK engine cache in this restricted workspace, and invoking the
cached Dart test runner directly could not complete package resolution because this app checkout has
no `.dart_tool/package_config.json`. No multi-seller schema, API or payment behavior was changed.
The owned Gateway/Postgres multi-seller denial and current single-seller COD evidence above remain
the last accepted end-to-end result; run the mobile regression when the Flutter SDK and app package
dependencies are writable/available.

## 4 October production Gateway seller-bound cart regression

Added a focused test that mounts `registerStorefrontCartRoutes` and invokes the
actual `POST /:subdomain/marketplace-cart` handler against a synthetic
PostgREST response. A cart containing approved listings from two different
seller sites returns 409 `MARKETPLACE_LISTING_UNAVAILABLE` before product
hydration, cart persistence, event emission or queue writes. A same-seller
control passes listing ownership validation and reaches product hydration; its
deliberately injected downstream read failure confirms the seller guard did
not reject it.

The Gateway-router regression passes **2/2**, and Gateway typecheck passes.
This is production-handler unit evidence, not a database-backed transaction or
browser journey; the owned Postgres suite remains the last end-to-end proof and
was not rerun because Docker access is denied. Cross-seller allocations remain
unsupported until the open buyer grouping, per-seller COD/shipping, refund and
privacy choices are answered.

## 4 October mobile mixed-seller denial verified

The marketplace mobile checkout service test now executes its mixed-seller
case after the established single-seller success and shipping-recovery controls.
It verifies `MARKETPLACE_SINGLE_SELLER_REQUIRED` and compares the server-cart
request count immediately before and after that attempt, so the intentional
extra cart created by the preceding simulated shipping retry does not weaken
the assertion. Flutter passes **1/1 test** for
`marketplace_checkout_service_test.dart`.

The test ran through the cached Flutter tool snapshot using a temporary SDK
overlay under `/private/tmp`; the original Flutter SDK stayed read-only. The
Flutter test runner needed a local loopback socket, which the execution review
allowed for this test. No package version or lockfile changed. This verifies
the mobile service path locally; no device, browser, or fresh owned Postgres
run is claimed. Together with the production Gateway handler test above, both
client and server refuse cross-seller carts before order creation.

## 4 October canonical writer mixed-seller database denial

Extended `marketplace-cart-origin.postgres.test.ts` with two approved listings owned by separate
synthetic sellers and called migration 278's canonical writer with both lines under one seller
scope. The transaction rejects the foreign seller's line. The test snapshots both sellers' purchase,
order and order-item counts, the target idempotency session, and both products' inventory counters;
all remain unchanged, with explicit foreign-product availability and reservation assertions.

The full owned Gateway/Postgres/PostgREST suite passes **10/10**, zero skips/TODOs, on runner
`c3009fd8958a`; the existing Gateway-driven one-seller COD, buyer-binding and payment-denial
controls remain green. Gateway typecheck and `git diff --check` pass. The new direct SQL call proves
the database writer's seller guard/transaction rollback; it is not a second client/API or browser
journey. Cross-seller allocation remains disabled; buyer grouping, per-seller delivery/COD, refunds
and merchant privacy choices remain unresolved.

## 4 October public Gateway mixed-seller cart refusal

Added a real-worker owned-database regression that submits one approved listing from each of two synthetic sellers to the public marketplace-cart route. The endpoint is intentionally public, so the request uses no buyer identity token. The normal production route resolves both approved listings against the requested seller storefront and returns `409 MARKETPLACE_LISTING_UNAVAILABLE`; cart-row counts and both products' available/reserved inventory remain unchanged.

The repository-owned PostgreSQL 16/PostgREST run passes **11/11**, with zero skips/TODOs (`967520c0bc87`); cleanup was verified by the runner. This complements the direct canonical-writer denial above with public HTTP-route evidence. It does not establish authenticated buyer-session binding, browser/device behavior or multi-seller allocation. Multi-seller checkout remains disabled until buyer grouping, per-seller delivery/COD, refunds and merchant privacy choices are resolved.
