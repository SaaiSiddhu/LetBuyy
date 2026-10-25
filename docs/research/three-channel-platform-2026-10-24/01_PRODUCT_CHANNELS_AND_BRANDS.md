# Product channels brands and dedicated applications

## The channel contract

A channel answers who offers the goods, where the buyer shops, which eligibility and pricing rules apply, and what fulfillment promise is made. An application answers which actor is working. A brand answers how that experience is presented. A physical node answers where goods are held or handed over. These boundaries must not be collapsed into one channel flag on a user.

| Channel | Primary user system | Buyer surface | Commercial direction | Fulfillment boundary |
| --- | --- | --- | --- | --- |
| Storefront | LetBuyy Merchant mobile/web | Merchant-branded Liquid storefront | 0% LetBuyy sales commission for every merchant | Seller's configured shipping/local pickup or delivery |
| Marketplace | Dedicated LetBuyy Seller app, with an approved web workspace where needed | Marketplace mode in customer mobile and web | Effective-dated category commission and explicitly disclosed other services | Seller and shipping promise on attributable orders |
| Quick | Dedicated LetKart Partner Ops mobile/web and Delivery mobile | Quick mode in customer mobile and web | Contract-specific franchise/platform/fulfillment economics | One assigned local seller/node per initial order |

Storefront remains a complete independent channel. A seller page in the consumer Marketplace shows that seller's eligible Marketplace listings. It does not expose every product on the seller's merchant website. Native shopping means native Marketplace and Quick screens; it does not mean cloning independent Liquid websites into Flutter.

## Two brands over one platform

Revised working architecture: LetBuyy is the umbrella for both Marketplace and the storefront platform. LetBuyy Store names merchant management and LetBuyy Seller names the dedicated Marketplace application. LetKart Quick is a candidate second brand for Quick; Partner Ops and Delivery can carry that name. The existing customer binary stays LetBuyy with Marketplace and Quick modes. This revises the earlier consumer-wide LetKart proposal after the owner confirmed the two owned domains. [Volume 15](15_APPS_DOMAINS_DIRECTORIES_AND_START.md) contains the latest exact map.

The brand family must be tested for spelling, pronunciation, recall, customer confusion, seller trust and available rights. Search-engine results do not establish trademark clearance. Do not buy domains, rename published apps, change issuer domains or advertise franchise rights merely from this proposal. The owner requested two brands; the final cleared names remain a release decision.

| Working consumer name | Product fit | Tradeoff |
| --- | --- | --- |
| LetKart | Candidate Quick brand paired with the LetBuyy umbrella | Requires actual rights and availability clearance |
| LetBuyy Go | Strong connection to the existing platform | Functions more as a sub-brand than an independent second brand |
| LetBuyy Now | Clear local-speed association | Less suitable for ordinary Marketplace shipping promises |

Use LetKart Quick as a candidate Quick name. Keep LetBuyy for the existing Marketplace/customer identity and LetBuyy Store for storefront management; create no additional customer application.

Merchant-created websites use the merchant's own visual identity. Storefront's zero-commission proposition must be precise: zero LetBuyy sales commission. Payment-provider charges, subscribed software features, optional shipping and applicable taxes are different charge types and must be visible rather than hidden inside the word “free.” Marketplace or Quick fees apply only to their attributable transactions or actually contracted services.

## Application boundary

~~~mermaid
flowchart TB
  Merchant[LetBuyy Merchant web and mobile] --> SF[Storefront channel]
  Seller[Dedicated LetBuyy Seller app] --> MP[Marketplace channel]
  Ops[Dedicated preserved Partner Ops app] --> QC[Quick channel]
  Rider[Existing Delivery app] --> QC
  Buyer[Existing customer app] --> MP
  Buyer --> QC
  BuyerWeb[New proposed customer Marketplace web] --> MP
  BuyerWeb --> QC
  OpsWeb[New proposed Store Ops web] --> QC
  BuyerWeb --> ID
  OpsWeb --> ID
  SF --> Web[Merchant branded web storefront]
  Merchant --> ID[Canonical identity platform]
  Seller --> ID
  Ops --> ID
  Rider --> ID
  Buyer --> ID
  Web --> ID
  SF --> Core[One commerce monolith and shared domain packages]
  MP --> Core
  QC --> Core
  Core --> DB[(One canonical PostgreSQL database)]
  Admin[Existing internal console] --> Core
~~~

The internal console remains the sole operator control surface. Marketing web remains the public acquisition surface. Identity remains the sole issuer. A dedicated Seller frontend is not permission to build a second merchant catalog, separate settlement engine or separate identity service.

## Cross-role examples

Anita already owns a LetBuyy merchant business. She opens LetBuyy Seller, signs in through the existing issuer, selects that business, reuses applicable verified facts and completes missing Marketplace requirements. Enabling 40 existing products creates Marketplace listings, not another 40 stock balances. Her storefront continues to sell with zero LetBuyy sales commission.

Anita can also buy groceries as a customer. Her buyer session cannot edit her business merely because the same human owns it. Her staff member may be permitted to pick orders at one node without receiving seller bank access. A franchise operator may manage several approved locations and still be prohibited from inspecting unrelated merchants' sales.

If Anita owns a second legal business, using the same login does not merge their inventory, invoices or tax obligations. Cross-business reuse needs an authorized ownership/supply relationship, not an “import everything from my other account” shortcut.

## Decision boundaries

Confirmed: separate Seller app, dedicated Store Ops mobile/web, existing Delivery reuse, one customer binary with two modes plus Marketplace web, shared backend/database/issuer, bidirectional same-business product enablement, zero storefront commission, Marketplace category fees, franchise/supermarket research and two-brand direction.

Recommended: LetBuyy Marketplace and LetBuyy Store under one umbrella, with LetKart Quick as a candidate Quick brand; supermarket-first operating validation; one primary variable Quick fee per service; isolated app clients under the existing issuer; owner-scoped catalog plus listing overlays.

Still specific inputs before activation: cleared names, actual pilot city/nodes/SKUs/hours, precise fee schedules, provider-contract eligibility, partner responsibility matrix, any multi-owner custody pilot, and actual release artifacts. No repeated approval of the confirmed product direction is needed to finish this research.
