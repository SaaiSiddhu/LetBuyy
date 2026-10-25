# Kindred installed gifts lifecycle preparation

**Preparation only: all 19 live cases are NOT_RUN.** No shared fixture, database, installed app, theme install/publish, identity, cart or order was started. This is a plan for the coordinator's next allocated run. `installed-gifts-lifecycle.plan.json` contains null runtime bindings and source-validation proof; it is not a seed harness.

Use the Editor's **single 14-product plan** and existing `profile=editor` hook. The data-only extraction of `EDITOR_PRODUCT_RECIPES` matches all 14 plan entries exactly. Do not run the Threadline buyer setup unchanged: it creates an apparel API order and selects option2 M. Browser login and a gifts purchase require their own observed UI receipts.

The one gifts row is **Kindred lifecycle gift box, ₹1,100, stock 8, category Gifts, India, tracking on, overselling off, tax off**. It has no product options or variants. Its three contents rows are Mug ×1 / 300 ml / Hand wash.; Notebook ×1; Pen ×1. Open/closed image roles are exactly 0/1 against the two supplied approved Little Pause image paths. These images are fixtures; the M1 demo's ₹1,790 price, wrapping variants and separate Desk Companion product are not this installed purchase oracle.

Before discovery acceptance, edit this same existing product through the normal merchant UI to add occasions birthday/thank-you and recipients friend/colleague. Preserve other metadata and media. This is a proposed merchant edit, not an extra product or silent shared-plan change. The schema accepts both this metadata and the later Mug 250 ml change. Bind full updates to actual saved version/idempotency receipts.

Validation passed for all 14 supplied product fields, canonical gift metadata and image references, duplicate/out-of-range role rejection, exact image-identity reorder/removal and omitted contents. The full CreateProductSchema without a runtime identity fails only at `store_id`, as expected. Full bound create/update execution remains NOT_RUN; the shared canonical command builder must validate again after real site/origin allocation. The local static origin was used only to probe image URL fields. No UUID or token was fabricated.

## Existing execution hooks

| Hook/source | Required use and boundary |
| --- | --- |
| `services/api-gateway/src/__tests__/owned-db/threadline-browser-fixture.ts`: editor profile | Reuse the coordinator's one fresh fixture and allocated origins/ports; no separate fixture startup. |
| `services/api-gateway/src/__tests__/owned-db/threadline-qa-fixture.ts`: `themeEditorFixtureProductCommands`, `prepareThemeEditorQaStore` | Existing pure builder validates all 14 canonical commands, then owner hook POSTs `/v1/products`, GETs actual product versions/variant IDs, creates 13 collections and replaces membership using existing contracts. Bind `products.gifts` and `collections.gifts`; never invent a runtime ID. |
| Same shared hook: search-document planner and Karnataka 560001 COD ₹20 setup | Fixture setup only; do not label this queue indexing or buyer checkout proof. Capture actual rate ID. |
| `apps/merchant/web/src/components/products/niche-facts/kindred-facts-editor.tsx` | Controlled merchant gift draft; actual parent save/reload/conflict evidence still required. |
| `services/api-gateway/src/routes/storefront/cart-routes.ts` | Actual server cart POST/readback, checkout URL and status; use accepted IDs/session/host context from allocation. |
| `apps/commerce/web/src/app/store/[subdomain]/account/orders/[id]/page.tsx` | Actual customer-order Liquid route (`customers/order`) or client branch as selected by installed renderer; capture the real branch. |
| `apps/commerce/web/src/lib/order-fact-readback.ts`; `services/api-gateway/src/lib/order-read-compat.ts`; `apps/merchant/web/src/components/orders/order-line-items.ts` | Approved saved snapshot/readback boundaries, separate from current product data. |

Expected purchase is quantity 1: server subtotal ₹1,100 + actual flat shipping ₹20 = **₹1,120 INR**, discount/tax zero. UI displays rupees; Liquid money internals use 110000/2000/112000 minor units. Record the actual result and reconcile any mismatch. COD remains pending; this plan never authorizes real-money payment.

## Allocation and evidence matrix

All IDs, origins, secrets, cart/order references and fixture lease are currently null. Obtain them from the coordinator's actual run and canonical receipts. Retain status, timestamp, source/package hash, observed route/response, screenshots and redacted durable readback for each case. Do not put credentials or live tokens in this plan.

| Case | Work and acceptance | Status |
| --- | --- | --- |
| G01 — Bind the single shared fixture | Use editor profile and the existing prepareThemeEditorQaStore hook; retain gifts product/collection IDs and shipping-rate ID from actual receipts. Do not run a second seed harness. | NOT_RUN |
| G02 — Install and publish Kindred v2 | Use actual merchant theme UI; record admitted package/release/hash, draft version, save/publish receipt and reload. Installation must not seed catalog content. | NOT_RUN |
| G03 — Edit the existing gifts product | Use normal merchant product page to add birthday/thank-you and friend/colleague to the existing gifts metadata, preserve three contents rows and images, save and reload with actual version/idempotency. | NOT_RUN |
| G04 — Invalid media-role recovery | Attempt an out-of-range role and a duplicated role through available merchant controls/API negative control; no durable mutation. Record actual validation stage/status. | NOT_RUN |
| G05 — Unknown-facts recovery | On the same product, temporarily omit contents and role bindings; no made-up contents, fulfillment or imagery. Restore actual saved base facts before purchase. | NOT_RUN |
| G06 — Collection and search discovery | Use actual admitted options and counts; occasion/recipient/budget/sort combinations on both routes, independent clear URLs, repeated unrelated connector preservation, true empty response and recovery. No fabricated option/count; source-only static QA is separate. | NOT_RUN |
| G07 — PDP and supplied media | Confirm Mug 300 ml/Hand wash., Notebook, Pen; open/closed images from explicit roles. Base fixture has no product options or variants, so no wrapping selector or variant identity may be invented. | NOT_RUN |
| G08 — Keyboard and responsive browsing | Capture actual installed 320/768/1440 layouts and focus/activation, including hydrated header/menu behavior; record outstanding long-brand header defect independently. | NOT_RUN |
| G09 — Server cart and reload | Add one existing gifts product, await canonical server response, reload same owned buyer/store cart: quantity 1, unit price 1100 INR, selected options empty, approved immutable gift facts and saved primary image. | NOT_RUN |
| G10 — Client authority negative | Attempt unsupported price/snapshot fields and allowed display-property spoof separately; record actual contract response and unchanged server price/contents/image. Do not assert a status that was not observed. | NOT_RUN |
| G11 — Buyer identity | Register/sign in through real identity UI, reload account, carry the actual store-scoped session into checkout; do not inject a minted session or copy public-demo identity. | NOT_RUN |
| G12 — Hosted COD checkout | Through actual hosted checkout choose Bengaluru Karnataka 560001 and the shared flat 20 INR rate, confirm COD. Expected server subtotal 1100, shipping 20, discount 0, tax 0, total 1120 INR; reconcile if server differs. COD pending must not appear paid. | NOT_RUN |
| G13 — Idempotent retry | Repeat the same accepted order command with its same actual idempotency key using the existing harness/control; exactly the same order, no duplicate line/reservation/link. Not a second UI purchase claim. | NOT_RUN |
| G14 — Initial saved readback | Record buyer account/order UI, merchant order UI and actual Liquid order detail from the accepted saved order. Facts, quantity, monetary totals and primary image match accepted order; raw/private product snapshot absent. | NOT_RUN |
| G15 — Merchant mutation after purchase | On the same product change Mug detail to 250 ml and reorder/remove the supplied images through normal save. Keep actual receipts. Current catalog changes; saved order keeps original 300 ml/care/contents and accepted primary image. | NOT_RUN |
| G16 — Historical readback after mutation | Reload all three saved readbacks. Exact old snapshot/primary image remains; unavailable historical facts stay unavailable and never fall back to current catalog. | NOT_RUN |
| G17 — Stale cart review | Keep a separate accepted cart before G15; later checkout must follow actual CART_FACTS_CHANGED/review contract, with no second unintended order/reservation. | NOT_RUN |
| G18 — Tenant and buyer isolation | Use owner-allocated Buyer B/foreign-site controls; refuse foreign cart token/order IDs and verify no private facts or raw snapshot leakage. Positive own-order control first. | NOT_RUN |
| G19 — Conflict and resource recovery | Exercise a stale merchant version without overwriting latest edit, then verify cleanup only for allocated run resources and publish a lease-release receipt. | NOT_RUN |

Native static discovery evidence in this folder does not satisfy G06/G08 installed gates or any server, buyer, checkout or historical-readback gate. Variant selection is not applicable to the current approved gifts row; any future option/variant coverage requires an explicit shared plan extension or authorized normal merchant edit, then actual returned IDs.

Source hashes and exact prepared metadata are saved in the companion plan. `prepare-installed-gifts.ts` reads data and canonical schemas only; it does not call the setup hook, network or database.
