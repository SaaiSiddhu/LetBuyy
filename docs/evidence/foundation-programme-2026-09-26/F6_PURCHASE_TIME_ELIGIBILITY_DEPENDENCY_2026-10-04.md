# F6.5 purchase-time eligibility dependency — 4 October 2026

## Finding

The current Phase 6 review gate cannot be enforced at marketplace purchase time because the canonical marketplace mobile checkout does not yet create an order. The app explicitly reports that order placement is unavailable and retains only the cart/address journey at `apps/marketplace/mobile/lib/screens/checkout/payment_method_screen.dart:79–105`.

The existing cart and hosted checkout `channel` field represents the commerce entry method, not the sales surface. `CommerceChannelSchema` is `web | whatsapp | instagram | pos | api` (`packages/shared-types/src/index.ts:71`). The signed handoff and checkout session carry that value (`services/api-gateway/src/routes/checkout.ts:37–80`); the hosted order command maps cart product/variant/quantity lines without marketplace listing identity or sales-origin (`services/api-gateway/src/routes/checkout.ts:172–184`). A stale cart therefore cannot be classified as a marketplace order from the current server contract.

The marketplace mobile client now preserves the two catalog identities separately in its product and local cart models: marketplace listing ID and underlying catalog product ID. Existing `id`/`productId` remains the listing route identity for compatibility. Feed/detail mapping, product cache serialization and local cart serialization carry the added IDs, including null defaults for legacy cached/cart rows. This is a client data-integrity prerequisite only: the cart remains local, the checkout screen remains unavailable, and no listing ID or sales-origin reaches server order creation yet. Focused model tests pass 3/3, including legacy cart compatibility. The Dart analyzer passes for the changed model/cache/provider sources; `git diff --check` passes. Flutter ran with an isolated writable root under `/private/tmp` and network access disabled. This proves model serialization behavior, not a device checkout or server journey.

## Consequence and next work

Do not use the existing `channel` value to decide storefront-zero versus marketplace-category behavior or whether a product requires marketplace approval. That would conflate acquisition surface with commerce entry method and could apply the wrong policy.

Phase 8 checkout integration must connect the preserved client listing/product IDs to a server-owned cart and separate sales-origin contract, then carry trusted origin and listing identity through the cart-bound handoff, checkout session and immutable order snapshot. The order path must revalidate marketplace listing status/revision at order creation and confirmation, preserve normal seller-storefront purchases, and define recovery for a listing withdrawn after provider capture. Only then can F6.5 be accepted with marketplace and storefront positive/negative journeys.

## Evidence and limits

This is a source-level sequencing finding from the current worktree (`LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`, starting HEAD `0862687a5008d604d0df23357b2eb511293139fa`). The identity-preservation slice changes client model/cache/cart serialization only; no purchase bypass was reproduced, no checkout or payment behavior was changed, and no live transaction/provider environment was used. It records a required Phase 8 dependency; it does not accept F6.5 or Phase 6.

## Dated correction — 4 October 2026

The source-state finding above is superseded for server checkout foundations by [F8.1 cart origin](F8_MARKETPLACE_CART_ORIGIN_2026-10-04.md) and [F8.2 marketplace order binding](F8_MARKETPLACE_ORDER_BINDING_2026-10-04.md). Signed listing identity now reaches a seller-bound server cart and an atomic order transaction that revalidates the approved fingerprint and writes immutable listing snapshots; owned Postgres verifies guest and authenticated COD orders and denial after product withdrawal. The original mobile checkout gap remains: normal marketplace mobile/web UI, multi-seller allocations, provider eligibility/capture/recovery and full F6.5 acceptance are still unverified/open.

## 7 October material-revision checkout regression authored

The owned Gateway/Postgres marketplace-cart suite now includes a purchase-time
negative journey for a material product edit after the buyer has passed the
signed cart handoff, contact, delivery and payment-intent steps. The edit uses
the canonical product update path; the test expects revision invalidation to
return the listing to draft, then expects order confirmation to fail with a
409 and leave the order count, checkout state and inventory reservation
unchanged. This complements the existing post-handoff product-deactivation
case by exercising the F6.1 approval-revision boundary directly.

The earlier run recorded above is historical. Its material-edit test expected
`MARKETPLACE_LISTING_CHANGED`; the 7 October revalidation below corrected that
assertion after inspecting migration 278 and observing the product-edit route
return `MARKETPLACE_LISTING_UNAVAILABLE` for the now-draft listing. The separate
fingerprint-mismatch branch remains mapped to `MARKETPLACE_LISTING_CHANGED`.
The updated native fixture mirrors the observed code; the mobile service retires
the incomplete secure-cart attempt and the screen clears stale totals and
requires another review while retaining the local cart.

**Initial verification record — superseded below:** the regression was authored
but not runtime-verified because the first owned Gateway/Postgres runner
attempt stopped at Docker preflight (0 tests; 0 pass/fail). The Gateway package
TypeScript check and `git diff --check` passed. No database or container was
created by that blocked attempt. See the runtime revalidation below for the
subsequent executable result. Provider capture after eligibility withdrawal,
ordinary storefront continuity, browser/device use and the rest of Phase 6
remain separate work.

### Runtime revalidation — 7 October 2026

The Docker daemon became available through reviewed local access, so the exact
owned Gateway/Postgres suite was run with log capture. Two pre-fix runs exposed
an unrelated buyer-identity update failure: the cart-abandonment queue insert
did not supply the required `platform_queue_jobs.event_id`, returning HTTP 500.
The route now supplies a fresh event UUID and explicit schema version; the
regression also asserts exactly one queued check with a valid event ID. The
rerun passes **13/13**, zero skips/TODOs, using the real Gateway worker,
PostgREST and runner-owned disposable Postgres (`4d207e8bb986`). The previously
authored material-revision case passes in this run: a material product edit
after payment-intent invalidates approval, confirmation returns 409, and no
order or inventory reservation is created. The runner exited successfully
after its labeled-fixture cleanup check. This verifies local owned-database
behavior only; provider capture recovery, ordinary storefront continuity,
browser/device journeys and wider Phase 6 acceptance remain open.

The subsequent classification correction passed the same owned suite **13/13**
(`1a3119505ad9`, zero skips/TODOs); the test now asserts
`MARKETPLACE_LISTING_UNAVAILABLE` for a canonical edit that invalidates approval
to `draft`. Focused mobile service/widget tests pass **5/5**, targeted Flutter
analysis and Gateway typecheck pass, and the runner's labeled cleanup check
passed. The 12/13 run that exposed the stale expectation is preserved in the
work log; it was followed by this successful corrected run.

Command:

```sh
node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/marketplace-cart-origin.postgres.test.ts --kind gateway-db --jobs 1 --log-dir /private/tmp/letbuyy-f6-run-details-20261007
```

## 14 October storefront purchase continuity

Marketplace purchase enforcement must not require marketplace approval for
ordinary products sold only through the merchant's storefront. A new owned
Gateway/Postgres regression creates a synthetic active product with inventory
but no `channel_listings` row, posts a normal storefront cart, and completes
the signed hosted COD steps through order confirmation. It verifies the
checkout session and purchase retain `storefront` origin, the order uses the
storefront purchase channel, and the resulting order item has no marketplace
listing snapshot.

The first run caught a query ambiguity in the new test, then the corrected run
passed the full `marketplace-cart-origin.postgres` suite **14/14**, with zero
skips/TODOs, against the real Gateway worker, PostgREST and runner-owned
disposable Postgres (`ea008a279e55`). The runner completed its labeled cleanup
check. The temporary run log is `/private/tmp/letbuyy-f6-storefront-final-20261014/marketplace-cart-origin.postgres.log`.
This is local owned-database evidence only; it does not verify provider capture
or recovery, multi-seller checkout, browser/device purchase journeys, or the
remaining F6.5/F6.6, Phase 6 and eleven-phase acceptance requirements.
