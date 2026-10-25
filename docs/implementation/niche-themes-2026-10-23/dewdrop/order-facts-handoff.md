# Historical order-facts presentation support

The shared pure formatter and two thin host components are implemented. They cover all nine niche namespaces, not only Dewdrop. Sixteen focused tests, two no-emit checks and focused buyer/merchant lint pass in `order-facts-verification.json`. The previous 34-test Dewdrop qualification remains separately retained in `verification.json`; it was not overwritten or reinterpreted as order readback acceptance.

## Owned implementation

- `packages/commerce-core/src/product-facts-summary.ts`: `summarizeProductFacts(facts, personalization?, options?)`, `ProductFactSummarySection`, `ProductFactSummaryRow`. These are presentation rows, not Product/Order or snapshot DTOs.
- `packages/commerce-core/test/product-facts-summary.test.ts`: ten behavior tests spanning all nine namespaces, exact units/contents/edition, selected-shade identity, recorded personalization, unknown values, privacy, inert strings and represented-namespace scope.
- `apps/commerce/web/src/components/storefront/niche-order-facts.tsx` and matching `.test.tsx`: named `NicheOrderFacts`, three actual React SSR/DOM tests.
- `apps/merchant/web/src/components/orders/niche-order-facts.tsx` and matching `.test.tsx`: named `NicheOrderFacts`, three actual React SSR/DOM tests.

Both components import only the commerce package's public API and their own React runtime. They share the formatter, inherit their host's typography/tokens, and render native details, associated headings and semantic terms/values. Optional `itemName` provides a useful unique disclosure label among several order lines. No app imports another app. No current product lookup, API call, storage, form or mutation is introduced.

The public summary export was added by the coordinator's assigned commerce-index writer. This allocation did not edit any shared export, order client, route, checkout schema/normalizer or API projection.

## Display contract

Pass only resolved facts and accepted personalization from the same validated immutable order snapshot. Snapshot schema/validation/writing belongs solely to MadeYours; the formatter does not define a second snapshot shape or choose a variant. Until that canonical snapshot is exposed by the shared readback, it accepts the existing public `ProductNicheFacts`, `AcceptedPersonalization` and optional canonical `ProductVariant['options']` types.

Only represented fact namespaces or valid accepted personalization appear. Missing fields within a represented namespace say “Not recorded with this order.” An entirely missing legacy snapshot produces a brief neutral paragraph instead of nine irrelevant unknown sections. No zero quantity, compatibility, medical claim, certification or delivery date is invented.

Examples of preserved meaning:

- Toy and gift contents retain supplied counts; an absent completeness assertion is unknown.
- Electronics distinguish input, output, carrying capacity and pass-through watts. Device references remain references, without a universal compatibility assertion.
- Food net quantity is per sellable item, with its saved g/ml unit. A “500 g” option label never manufactures a missing measurement. Unknown allergen information is not allergen-free.
- Furniture assembled/package dimensions and their original units remain separate. Equipment length/grip/weight units remain explicit; an unconfirmed compatibility status stays unconfirmed.
- Books retain recorded language, format and edition. Stationery page/sheet counts remain separate; one is not derived from the other.
- Beauty chooses a reference only by the exact saved shade option/value, never by RGB or first entry. Identical-colour shades retain separate names/codes. No saved option context means selected shade/code are unknown.
- Accepted personalization displays its saved text and method/style/placement labels. It does not query or reaccept against today's product capabilities. Canonical snapshot validation still belongs to the snapshot owner and must bind accepted choices to its frozen facts revision.

Private metadata is omitted by the existing strict fact readers. All labels and values are ordinary strings rendered by React text escaping. Source references stay plain text, including hostile URL-like input; there are no new links, raw HTML or images in these components.

## Readback trace and missing shared integrations

`order-facts-trace.json` pins source paths/anchors/hashes for the read-only observations below. Shared writers may already be repairing these boundaries; this is evidence, not architecture authority.

| Boundary | Observed behavior and required integration |
| --- | --- |
| `services/api-gateway/src/lib/order-read-compat.ts` `hydrateOrderItems` | Already selects immutable `order_items.product_snapshot` with tenant-derived store/order predicates. Preserve that ownership chain. |
| `packages/checkout-core/src/index.ts` `normalizeOrderItemRecord` | Reads the snapshot for title/image, then drops niche and selected option context. The canonical owner must validate the saved `product_snapshot.niche` with MadeYours' reader and project only its approved envelope. |
| `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts` `loadBuyerOrderDetail` | Hydrates snapshots, then applies a buyer item allowlist. Add only validated niche/option presentation data; retain raw snapshot exclusion and buyer-link/site authorization. Existing owned-db tests assert raw `product_snapshot` is absent. |
| `apps/commerce/web/src/app/api/buyer/orders/route.ts` `ITEM_FIELDS` | Its second allowlist also drops new niche fields. Keep a bounded approved envelope, not raw snapshot metadata. |
| `apps/commerce/web/src/lib/customer-drop.ts` `LiquidCustomerOrderDetail` / `mapOrderDetailDrop` | Both type and mapped line items omit niche. `buyer-order-drop.ts` reuses this mapping for signed buyer detail reads. |
| `apps/commerce/web/src/app/store/[subdomain]/account/orders/[id]/order-detail-client.tsx` | Existing React fallback item type and item render show name/quantity/money only. Bind the buyer wrapper from the parsed saved snapshot when the canonical client is updated. |
| `apps/merchant/web/src/app/[store]/orders/[orderId]/page.tsx` | `OrderLineItem`, `readLineItems` and `LineItemsCard` discard/omit facts. Bind the merchant wrapper under the existing line content after parsed saved niche reaches this mapper. |
| `apps/merchant/web/src/app/api/stores/[store]/orders/[orderId]/route.ts` / API client | Merchant proxy forwards `orders.get`; it is not the original loss. Its transport uses the shared Order contract. |
| `packages/shared-types/src/index.ts` `LineItemSchema` | No canonical niche field exists. Shared-types must not runtime-import commerce-core, which already depends on shared-types. The contract owner may preserve a bounded envelope while the checkout/domain layer validates the actual canonical niche; do not duplicate the snapshot schema. |

The main buyer account order route is Liquid-first: its page calls `resolveAccountLiquid` and only falls back to the React client when the selected plan is not Liquid. `packages/theme-engine/src/theme-bundle.ts` currently renders order item title/quantity/amount only. The app-owned Liquid mapping/template path also needs integration; wiring only the React wrapper would miss the canonical buyer path.

Keep the global Liquid depth budget at four. A nested `order.line_items[].niche.facts` or nested summary sections/rows will be scrubbed at that depth. The app's existing Liquid mapper can reuse this formatter and expose safe scalar text for the order item or another approved existing presentation seam. Do not raise the global depth cap, add a renderer or add a new engine→commerce dependency to fix this display path.

## Saved selected-option context

The MadeYours-owned snapshot file observed in this allocation has `{version, facts, personalization?}`. Its catalog preparation input's selected variant currently includes identity/metadata. Beauty's raw facts still contain several named shade references, so the snapshot/order writer must preserve the actually purchased canonical options in the existing immutable line/snapshot context. `variant_title` alone cannot reliably reconstruct option names. Do not resolve them from a current product or variant API on historical readback.

Bind the wrappers to `parsedSnapshot.facts`, `parsedSnapshot.personalization`, the saved named options record, and the saved line name. Do not pass the entire raw snapshot as `options`. Actual snapshot parsing, transport field names and owner-approved shared schema changes remain with the coordinator and MadeYours.

## Remaining acceptance

The new tests verify pure presentation and actual React escaping/markup; they do not establish immutable persistence, buyer-link/RLS enforcement, normalized HTTP readback, Liquid composed rendering or production fulfillment. Shared owners must wire the losses above, retain privacy/tenant tests, and prove that an order still shows its saved contents/edition/accepted text after its current product is changed or deleted. No DB, browser or full build was used in this allocation.
