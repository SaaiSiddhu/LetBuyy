# Installed MadeYours buyer lifecycle — prepared matrix

**All 23 runtime cases are `NOT_RUN`.** This contribution contains prepared data and expected assertions only. It starts no database, application, build, browser or provider operation. Backend/core/SDK/factory/discovery remain frozen. Editor owns the existing shared fixture and its two source files; this contribution neither edits them nor creates an execution harness.

The exact machine-readable recipe, request templates, runtime bindings and case states are in [installed-buyer-fixture.plan.json](installed-buyer-fixture.plan.json). Canonical static data validation and expected accepted/snapshot values are in [installed-buyer-fixture-validation.json](installed-buyer-fixture-validation.json). A static `PASS` in that file is field/domain validation, never an installed-browser pass.

**Current execution amendment:** the coordinator restored Editor’s baseline seed. The extra method, choices and zero-stock variant must be authored through ordinary merchant UI after allocation. Use [installed-buyer-ui-setup.plan.json](installed-buyer-ui-setup.plan.json): initial saved setup is facts revision2, purchased history remains revision2, and the later catalog edit advances to revision3. The original proposal is preserved at SHA256 `c3045d3295669dd9c38dea65339857ccd7fb2e63e349b611aa98b1dbad89fd3d`; it is an immutable data reference, not the current seed or a runtime result. [installed-buyer-runtime-results.json](installed-buyer-runtime-results.json) holds the actual execution ledger; all23 cases remain NOT_RUN.

## Fixture contribution for Editor

Keep the existing `personalization` key and synthetic MadeYours lifecycle notebook at ₹690. Preserve Moss/Oat UUID creation through canonical commands, each initially planned at stock4. The proposed recipe adds `print` / “Cover printing”, `serif` / “Serif”, `back` / “Back”, a third `Cover=Slate unavailable` variant with stock0, the existing notebook WebP, and a synthetic private-supplier sentinel. These additions make method/style/placement changes, unavailable selection and projection privacy observable. They do not change the accepted MadeYours storybook or source factory. Current coordinator direction requires authoring the additions through the normal merchant UI in MY-00, then validating persisted readback; a missing prerequisite remains unrun.

The source plan is `docs/implementation/theme-editor-2026-10-23/evidence/fresh-fixture-data.plan.json`. Its personalization recipe is copied as `originalRecipe` for comparison. The plan changed elsewhere during preparation; the source was re-read and the personalization data remained equal. Exact read hashes are recorded. No shared plan or fixture file was modified here.

Creation fields were checked against `CreateProductSchema` with only the actual store UUID deferred; variants and capability facts were parsed by their canonical schemas. The final complete CreateProduct command must still be validated by the existing fixture once it binds the real store and resolves media URLs against its actual commerce origin.

## Bind real runtime values

- Take origins, product ID and shipping-rate ID from the fresh Editor receipt. Resolve variants uniquely by their returned option maps, never title, array index or fabricated UUID. Verify tenant/product ownership and canonical availability before asserting the planned stock4/5 boundary.
- Sign in through normal merchant and buyer UI. Any API prerequisite/setup order remains excluded from buyer-purchase evidence. Do not inject browser cookies, mint credentials, invent session IDs or copy bearer queries into docs.
- Read the actual no-store review endpoint separately for each selected UUID. Echo its exact `facts_revision` and `review_fingerprint` in the strict `personalization` draft. The client supplies no product version, server configuration hash, accepted labels, price or snapshot.
- Capture actual cart line IDs / `data-cart-line-key`. Quantity and removal target that identity. Preserve every retained line in the replacement body. Existing UI replacement is explicit remove plus fresh reviewed add; do not assume an inline configurator in the cart.
- Keep the exact existing checkout handoff query/signature and UI intent keys in private runtime state. The final selected quote and all totals come from the server. No placeholder object in the plan is a wire payload.

## Existing routes and payload shape

| Purpose | Existing route / binding |
| --- | --- |
| Create/edit product | Merchant-authenticated `POST /v1/products`, `PATCH /v1/products/:id`; actual store/version/idempotency UUID and variant IDs |
| Review producer | `GET /v1/storefront/:subdomain/products/:productId/personalization-review?variant_id=:actualVariantUuid`; `Cache-Control: no-store` |
| Browser review proxy | `/api/storefront/:subdomain/products/:productId/personalization-review?variant_id=:actualVariantUuid` |
| Canonical cart | `POST /v1/storefront/:subdomain/cart`, then `PATCH /v1/storefront/:subdomain/cart/:returnedCartToken`; browser uses existing `/api/storefront/...` proxy |
| Cart handoff | `POST /v1/storefront/:subdomain/cart/:returnedCartToken/checkout-url`; retain actual returned signed query |
| Hosted steps | `/v1/checkout/:actualCartId/contact`, `/delivery`, `/payment-intent`, `/confirm`, with the unchanged handoff query and normal buyer binding |
| Buyer order detail | `GET /v1/storefront/buyer/storefront-orders/:orderId` with actual signed site-bound identity; BFF is exactly `GET /api/buyer/orders?order_id=:orderId` |
| Installed Liquid history | `/store/:actualSubdomain/account/orders/:orderId`, existing `customers/order` template and `buyer-order-drop` → `mapOrderDetailDrop` → `niche_facts_text`; use actual host rewriting |
| Merchant history | `GET /v1/orders/:orderId` and the existing merchant order detail UI under real tenant permission |

The current Liquid island sends `{ "lines": [...] }`. Each line contains product/variant UUID, quantity, variant option properties such as `{ "Cover": "Moss" }`, and the strict `personalization` object with method/style/placement/text/revision/server echo. It does not place draft text in generic properties. Same-config Asha is merged client-side to quantity2 before the replacement request; server acceptance remains authoritative. Full exact templates are in the JSON plan.

## Ordered runtime matrix

The rows below retain the original seed-plan assertions. The linked current UI setup amendment overrides their revision numbers and setup method: revision1→2 during MY-00, purchase/history2, post-purchase3. No original assertion is credited as executed.

Execute MY-00 through MY-19, then MY-21, MY-20, MY-22. Network recovery runs while capability facts still exist. All observations, real IDs, response/screenshot references and runtime assertions remain unset until a later explicit resource allocation.

| Case | Action | Required result | Status |
| --- | --- | --- | --- |
| MY-00 | Read fresh setup receipt; normal merchant/buyer login; install and locally publish actual Nova2.0.0; resolve the created product, variants, media, delivery quote and origins. | Fixture setup orders are excluded; store owned by signed merchant, buyer linked normally, intended installed release, baseline stock read from the canonical API. No session or UUID is injected. | `NOT_RUN` |
| MY-01 | Select Moss on the real PDP and observe the no-store review request. | 200 strict context matches actual product/Moss IDs and revision1; no raw version, price or private supplier. Add stays blocked until explicit review. | `NOT_RUN` |
| MY-02 | Request the real review endpoint without a variant for this variant product. | 409 VARIANT_REQUIRED; required configurator cannot fall back to generic cart properties. Record route negative separately if the UI auto-selects a variant. | `NOT_RUN` |
| MY-03 | Select Slate unavailable through the existing variant control. | PDP marks unavailable; Add and Review cannot produce a cart mutation. If a review request is made it returns409 VARIANT_UNAVAILABLE; a suppressed request is not counted as endpoint coverage. | `NOT_RUN` |
| MY-04 | Review Asha, then separately change method engrave→print, style sans→serif and placement front→back. | Each change removes the earlier review/acceptance, retains text, requires a new summary/review, and sends the newly chosen canonical IDs only after review. | `NOT_RUN` |
| MY-05 | Review Moss/Asha, select Oat, then return to Moss. | Old reviewed context is invalidated on every UUID change; actual current-variant no-store context and renewed explicit review are required before Add. | `NOT_RUN` |
| MY-06 | Review valid Hindi आशा with unicode-letters. | Accepted exact NFC text equals आशा; method/style/placement labels are server-fact labels. This is a review case with no purchase claimed. | `NOT_RUN` |
| MY-07 | Type decomposed Jose\u0301, attempt review, explicitly choose Use suggested text, then review José. | Before consent input stays decomposed, NORMALIZE_TEXT appears and Add stays blocked; suggestion is José. The separate affirmative action and review yield exact composed José. No silent normalization. | `NOT_RUN` |
| MY-08 | After a valid preview, type <Asha>, nineteen A letters, then Asha🙂. | Canonical errors appear, exact invalid input stays editable, last valid illustrative preview is identified, and neither cart nor checkout is called. | `NOT_RUN` |
| MY-09 | Review/add Asha1 and separately review/add Kabir1 on the same Moss UUID. | Two server line identities, same product/variant, accepted texts Asha/Kabir, distinct configuration and snapshot hashes. Every request carries strict personalization; properties contains only {Cover:Moss}, never draft text, method, review echo or accepted status. | `NOT_RUN` |
| MY-10 | Review/add Asha1 again with identical method/style/placement/variant. | One Asha line quantity2 and one Kabir line quantity1; no third configuration or extra inventory SKU. | `NOT_RUN` |
| MY-11 | Increase only Asha2→3 with the full cart control. | Only captured Asha line key changes; Kabir stays1. Aggregate Moss quantity4 matches verified baseline availability4; review/configuration identity does not change for quantity alone. | `NOT_RUN` |
| MY-12 | Try increasing Asha3→4 while Kabir remains1. | Aggregate5 exceeds verified Moss availability4:409 INSUFFICIENT_INVENTORY. Canonical cart remains Asha3/Kabir1. UI must recover to accepted state or show explicit unsaved failure; optimistic quantity is not server acceptance. | `NOT_RUN` |
| MY-13 | Remove only Kabir, reload the full cart, re-add reviewed Kabir1, then reduce Asha3→1. | Removal selects captured line key; Asha3 survives exact. Reload keeps that identity/text. Final purchase cart is exactly Asha1/Kabir1; canonical server response supplies money. | `NOT_RUN` |
| MY-14 | Inspect the actual cart and public PDP responses and DOM. | No private supplier marker or catalog_source; no order history, cart bearer token, reviewed buyer text or backend provenance is published through anonymous catalog/Liquid data. | `NOT_RUN` |
| MY-15 | Proceed through the installed cart checkout link, normal signed buyer identity, contact, actual COD delivery quote, COD intent and confirm UI. | One new local COD order containing exactly Asha1/Kabir1. Every existing handoff query/signature is preserved; server cart references and totals are used. Record actual order ID and count delta; setup/API prerequisite orders are not counted. | `NOT_RUN` |
| MY-16 | Retry the same confirm intent/return and reload the confirmation. | Same order ID and captured immutable line facts; one inventory effect, one new purchase order and no duplicate effect. Keep keys/tokens only in existing private runtime state. | `NOT_RUN` |
| MY-17 | Before editing catalog, open own buyer order UI/Liquid order view and authorized merchant order detail. | All authorized views show Asha and Kabir separately, original method/style/placement and Cover=Moss. The strict saved niche_snapshot contains revision1; no extra visible revision label is assumed. | `NOT_RUN` |
| MY-18 | After purchase, open a fresh Oat review for Asha without adding; hold the reviewed draft. Merchant saves the documented revision2 catalog patch; attempt the held Add. | 409 PERSONALIZATION_STALE; no new cart line/order/inventory effect. Failed Asha draft stays, current context refreshes and old review is invalid. Re-review against revision2 and retry once; canonical accepted cart has one Oat/Asha line. | `NOT_RUN` |
| MY-19 | After the revision2 product/name/price/option change, reload the same purchased order on buyer, merchant and Liquid paths. | Old saved snapshot and images are unchanged: Asha/Kabir, revision1, Front engraving/Sans/Front and Cover=Moss. New PDP shows revised product facts/options. No current catalog fallback in historical readback. | `NOT_RUN` |
| MY-20 | Using an unsubmitted reviewed draft, merchant explicitly removes personalization facts through existing product edit; retry current review/Add on the already required configurator. | Review409 PERSONALIZATION_UNAVAILABLE; no generic-properties fallback or new order. Earlier purchased history remains intact. Record any already accepted cart unchanged; do not silently delete or rewrite it. | `NOT_RUN` |
| MY-21 | During a current review-context load only, record a deliberate browser network refusal, restore network, and activate existing Try personalization again. | Unavailable/retry state retains text and disables purchase. Restored real no-store response and renewed review permit Add. Never synthesize a successful context, fingerprint or token. | `NOT_RUN` |
| MY-22 | Sign out, then use a second normally registered buyer to request the first buyer order; check a genuinely unrelated merchant identity if allocated. | Anonymous401; other buyer404 after verified ownership lookup. Merchant must receive the route actual denial under tenant/permission checks. No historical text, selected options or private metadata is exposed. | `NOT_RUN` |

## Purchase and historical oracle

The planned purchase is exactly Asha1 plus Kabir1 on the same actual Moss variant, using `engrave` / `sans` / `front` at revision1. From the planned ₹690 unit price, charge_tax=false and the fixture’s verified ₹20 COD quote, the expected subtotal is ₹1,380 and total ₹1,400. These are conditional arithmetic assertions, not observed prices or counts. Record the real server totals and stop on any prerequisite mismatch. The expected purchase delta is one new matching order and two Moss units; Oat changes by zero. Scope these deltas to the actual product/cart/confirm intent so unrelated shared-fixture orders cannot inflate or invalidate the claim. COD does not imply provider capture or paid status.

Before the catalog edit, save each authorized strict `niche_snapshot`, returned image and actual order identity. Expected frozen facts contain revision1, `Cover=Moss`, exact Asha/Kabir text and labels “Front engraving”, “Sans”, “Front”. The prepared later merchant patch changes the product name/price, capability labels with revision2 and Moss option value to Rain using the same durable variant UUID; stock is omitted to preserve it. Bind the actual current version/key, preserve current metadata siblings, and validate the complete command through the canonical schema before the existing UI save.

After that edit, the old order API, buyer component, merchant component and installed Liquid view must retain the original saved values and money. The strict JSON holds revision1; no extra UI revision label is assumed. `niche_facts_text` is existing escaped presentation, not a raw nested snapshot or current-product lookup. Private supplier sentinels, raw `product_snapshot`, cart token, review fingerprint and private `catalog_source` must not enter customer/Liquid history. Authorized order history is private: a signed-out API read denies access, and another normally signed-in buyer receives no owned order. Record the actual merchant denial under its tenant permissions without inventing a status code.

For the stale race, hold an unsubmitted Oat/Asha review, save the revision2 merchant patch, then attempt Add with that old review. Expect409 `PERSONALIZATION_STALE`, retained draft and no accepted line or order effect. Refresh the real context, explicitly review again and retry once. If an existing accepted line itself becomes stale, do not silently rewrite/remove it or claim retry success; use the existing deliberate remove/re-review path and record the exact usability result.

## Static validation receipt

`validate-installed-buyer-fixture.ts` only reads the two plans, checks canonical schemas/domain functions and frozen source hashes, then writes this docs evidence. It performs no network/DB/browser operation and generates no server review fingerprint. Run it with:

```sh
TSX_TSCONFIG_PATH=docs/implementation/niche-themes-2026-10-23/madeyours/installed-buyer-fixture.tsconfig.json node --import tsx docs/implementation/niche-themes-2026-10-23/madeyours/validate-installed-buyer-fixture.ts
```

The current receipt reports18 static data checks (including the UI setup revision amendment) and23 runtime cases `NOT_RUN`, with zero runtime passes and observations. Full UUID/session/echo-bound commands remain deferred to the real shared fixture. Source-only preparation cannot close installed, hydrated, purchase, privacy or performance acceptance.
