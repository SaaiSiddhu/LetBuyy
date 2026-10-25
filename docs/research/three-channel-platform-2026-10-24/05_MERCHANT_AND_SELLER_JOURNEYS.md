# Merchant and dedicated Seller journeys

## Merchant Storefront application

The primary Merchant product should lead with business setup, catalog, inventory, storefront appearance, orders, customers and clear software billing. Its default launch checklist is proportionate to the actual storefront activity. Marketplace enrollment is optional, and absence of Marketplace approval does not automatically prevent an otherwise eligible merchant from using its own storefront.

Recommended information structure: Overview; Products; Inventory and locations; Orders and returns; Storefront; Customers and support; Growth; Reports; Business and staff; Billing. “Sell on LetBuyy Marketplace” is an enrollment and product-enablement entry, not a second Marketplace operating console hidden inside Merchant. Users can follow an approved deep link into Seller while retaining issuer sign-in.

The products list shows canonical identity, selected channels, stock scope and publication status. An action such as “Enable on Marketplace” previews required changes and opens the correct Seller workflow. It does not silently accept commercial terms or publish unapproved content. Merchant still supports safe bulk edits and catalog export.

## Seller activation state machine

~~~mermaid
stateDiagram-v2
  [*] --> AccountReady
  AccountReady --> BusinessSelected
  BusinessSelected --> ApplicationDraft
  ApplicationDraft --> Submitted
  Submitted --> CorrectionRequired
  CorrectionRequired --> Submitted
  Submitted --> SellerApproved
  SellerApproved --> SellingReady: all required capabilities current
  SellingReady --> Restricted: expiry revocation or suspension
  Restricted --> SellingReady: accepted correction and revalidation
  Submitted --> Rejected
~~~

This overview does not compress all prerequisites into SellerApproved. Store a capability/readiness result for account security, business/entity verification, tax/category applicability, provider beneficiary readiness, pickup/return settings, commercial acceptance and listing approval. The UI can aggregate a checklist, but backend purchase eligibility evaluates the current applicable states.

| Seller step | Reusable facts | New or missing facts | Acceptance |
| --- | --- | --- | --- |
| Sign in | Existing issuer account | New client grant if needed | Same verified person, correct app session |
| Select business | Existing authorized memberships | Verified new-business enrollment if absent | No duplicate tenant or unauthorized business join |
| Verify entity | Current applicable documents/results | Missing, expired or channel-specific evidence | Real approval distinguished from sandbox |
| Configure selling | Existing business addresses | Marketplace pickup/returns/support settings | Supported coverage and actual seller identity |
| Provider readiness | Approved beneficiary mapping where reusable | Provider-specific required onboarding | Platform approval cannot substitute for provider eligibility |
| Accept commercial policy | Existing commitments | Effective category schedule and applicable terms | Authorized acceptance and visible fee preview |
| Prepare listings | Canonical catalog and media | Category/declaration/price overlays | Exact reviewed revision, selected variants |
| Begin trading | Existing order/money owners | Completed eligible purchase path | Normal customer checkout and seller fulfillment verified |

## Existing merchant joins Seller

An existing merchant selects its business after sign-in. The system identifies reusable verified facts and explains missing Marketplace requirements. The merchant selects 50 products, sees which 35 are complete and which 15 need correction, and submits ready listings for review. Stock is immediately the same underlying pool, but buyer visibility waits for all applicable approval. No second product creation is implied by importing.

If a merchant already has an approved category but changes a product's pack, safety declaration or material claim, relevant review is renewed. A generic text-only correction can follow its defined policy. The platform must define materiality centrally rather than letting each client decide whether to bypass review.

## Seller-only business and reverse reuse

A seller can register a business and prepare Marketplace listings without first publishing a storefront. Later, the same authorized business opens LetBuyy Merchant and enables selected products on its own storefront. A storefront theme, domain and checkout configuration are new storefront work; product and stock identities are reused. Products can remain Seller-only or Storefront-only indefinitely.

When a person's two businesses share a login, reverse reuse stops at the legal ownership boundary. A legitimate business-to-business sale, supply arrangement or approved consignment relationship is required before one may sell the other's goods. The UI must not imply common ownership merely from a shared person.

## Seller operating workspace

Recommended tabs/workspaces: Today; Listings; Orders; Inventory; Returns; Payments and statements; Reels and ads; Performance; Support; Business readiness and staff. Show warnings next to the affected action: a stock discrepancy blocks relevant selling, a missing return setting blocks readiness, and an expired bank/provider verification blocks the applicable money capability.

| Operation | Normal path | Failure and recovery |
| --- | --- | --- |
| Create listing | Create/reuse product, complete overlay, submit | Save draft, explain invalid fields, stable retry |
| Change price | Preview effective version and proceeds | Reject stale edit, retain prior active offer |
| Receive order | Display exact promised lines and deadlines | Explain stock/payment exception without local fake success |
| Fulfill | Pack/ship through approved logistics contract | Record refusal, failure, cancellation or return explicitly |
| Return/refund | Receive request, inspect goods where needed, approve eligible intent | Pending provider outcome remains pending; stock separate |
| Understand settlement | Gross, discounts, fees, taxes, holds, refunds and eligible balance | Drill into attributable differences, no unexplained net amount |
| Restriction | Show reason, correction and appeal | Preserve existing-order obligations and historical statements |

## Buyer marketplace behavior

The consumer app supports discovery, search, categories, seller pages, reels, sponsored placements, cart, checkout, owned orders and support. Seller pages show only eligible Marketplace listings. A storefront-only product remains available through its actual merchant website rather than being exposed under a Marketplace seller page.

For multi-seller browsing and cart UX, keep each seller's order, invoice, shipping promise, fees and refunds attributable. Combined collection is allowed only through an approved canonical/provider contract. The initial implementation baseline must establish whether existing multi-seller grouping is complete; a single-seller fixture is not proof of a combined marketplace purchase. The roadmap budgets this as an explicit discovery and acceptance item.

Native shopping uses the existing canonical checkout state machine. The current [payment screen](/Volumes/Projects/LetBuyy/apps/marketplace/mobile/lib/screens/checkout/payment_method_screen.dart:71) calls the COD path; a payment SDK declaration does not prove native prepaid completion. The inherited [payment helper](/Volumes/Projects/LetBuyy/packages/dart/marketplace_services/lib/src/payment_service.dart:77) has placeholder verification and must not become payment authority. Existing research found no active app caller for that helper; this is a reuse hazard, not a verified live exploit.

## Cross-app UX consistency

Both Merchant and Seller show the same product identity and stock source, but each leads with its channel's work. Reuse canonical UI tokens and accessible components without copying a complete Merchant navigation into Seller. Show shared versus channel-only edits before save. Use the same terminology for product, variant, listing, location, available stock, refund pending and eligible settlement. Each app needs a meaningful empty, loading, denied, conflict, offline and recovery state.

## Web additions

Marketplace web is now included alongside the existing customer mobile app, with the same Marketplace/Quick mode and canonical eligibility/stock/payment boundaries. Store Ops web is included alongside Ops mobile for node staff and supervisors. Their responsive customer/operational workflows and shared-code limits are specified in [Volume 16](16_MARKETPLACE_AND_STORE_OPS_WEB.md). Merchant buyer storefronts remain the independent Liquid channel.
