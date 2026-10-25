# Marketplace web and Store Ops web scope and starting sequence

24 October 2026 · Owner adds Marketplace web and Store Ops web to the target. This supersedes the earlier mobile-first proposal that omitted these web applications. Existing research-only execution boundaries remain unchanged.

## Corrected target

Include apps/marketplace/web for public customer shopping and apps/quick/store-ops/web for authenticated local store operations. These are two new web frontends over existing canonical backend, identity, database and shared packages. They are not additional commerce backends. Current code does not establish that either frontend is already complete.

| Product | Mobile | Web | Main work |
| --- | --- | --- | --- |
| Customer Marketplace and Quick | apps/marketplace/mobile, existing | apps/marketplace/web, new proposed | Marketplace shopping plus Quick mode with trusted location context |
| Merchant Storefront management | apps/merchant/mobile, existing | apps/merchant/web, existing | Storefront-first business management |
| Marketplace Seller | apps/seller/mobile, preserved-source promotion proposed | No additional Seller web runtime in this request | Dedicated seller onboarding, listings and trading |
| Quick Store Ops | apps/quick/store-ops/mobile, preserved-source promotion proposed | apps/quick/store-ops/web, new proposed | Location-scoped receiving, picking, packing, stock, handover and supervision |
| Delivery | apps/quick/delivery/mobile, deferred-source promotion proposed | No Delivery web app required by this request | Rider execution, proof, cash and background location |

The existing merchant buyer runtime apps/commerce/web remains separate from Marketplace web. It renders each merchant's branded Liquid storefront/custom domain. Public Marketplace seller pages expose eligible Marketplace listings rather than every product from those websites. Store Ops web is also separate from the internal console: partner staff operate their granted location; platform operators investigate and supervise through the existing console.

## Proposed directory

~~~text
/Volumes/Projects/LetBuyy/apps/
  marketplace/
    mobile/                 existing LetBuyy customer app
    web/                    NEW proposed customer Marketplace and Quick web
  merchant/
    mobile/                 existing LetBuyy Store
    web/                    existing merchant dashboard
  seller/
    mobile/                 proposed promotion of preserved Seller source
  quick/
    store-ops/
      mobile/               proposed promotion of preserved Store Ops source
      web/                  NEW proposed location-scoped Ops web
    delivery/
      mobile/               proposed move/adaptation of deferred Delivery
  commerce/web/             existing merchant-branded buyer storefront runtime
  platform/identity/        existing sole issuer
  internal/console/         existing platform console
  marketing/web/            existing business/product marketing
~~~

This yields five mobile products and seven web surfaces: Marketplace, Merchant, Store Ops, merchant buyer Storefront, Identity, Console and Marketing. Two web surfaces are new. Existing frozen/reserved roots remain inactive. Source moves and new frontend roots require the scoped topology/ownership/workspace/hosting/validator admission package before creation or deployment. Do not disable the current topology validators or claim the additional runtimes are already admitted.

## Reuse map

| New frontend | Reuse | New presentation and integration |
| --- | --- | --- |
| Marketplace web | Shared TS UI/tokens, canonical API client/types, existing issuer/buyer contracts, catalog/listing/order/checkout/support owners | Responsive customer navigation, feed/search/categories, seller/product pages, cart, native web payment integration, owned orders/support, public metadata and Quick location/mode workflows |
| Store Ops web | Shared TS UI/tokens, inventory/order/location API contracts, reusable Merchant presentation patterns, canonical task/custody commands developed for Ops mobile | Staff/location entry, queue/claim, scan/pick/pack, receiving/counts/quarantine, handover, supervisor exceptions and browser interruption recovery |

The inspected [inventory page](/Volumes/Projects/LetBuyy/apps/merchant/web/src/app/[store]/products/inventory/page.tsx:1) uses shared UI and stock-intent recovery patterns. The [operations dashboard](/Volumes/Projects/LetBuyy/apps/merchant/web/src/app/[store]/products/operations-dashboard/page.tsx:1) uses shared UI/API metrics contracts. These are reuse candidates, not proof of finished Quick fulfillment. The [shared UI package](/Volumes/Projects/LetBuyy/packages/typescript/ui/package.json:1) remains the UI owner.

Apps must not import another app's internal pages/hooks or credentials. Extract genuinely reusable presentation/contracts into existing canonical public packages after review. Do not copy Merchant's broad permissions into Store Ops. Do not represent compiling the Flutter donor for web as sufficient browser support: its storage/plugins, camera/scanner behavior, permissions and recovery need separate acceptance.

## Marketplace web journeys

Provide responsive Marketplace home/search/categories, approved product and seller pages, basket, checkout, owned orders and support. Keep Marketplace and Quick baskets, address contexts and pending attempts separately scoped by current account/mode/seller/node where applicable. Use the same server pricing, listing eligibility, fee snapshots and stock writers as mobile.

Quick mode supports manual/saved addresses when browser location is declined. Both web and mobile use the same trusted resolver and exact-node checkout binding. A public product page may be indexed only under its current public eligibility policy; private carts, orders, addresses, payment attempts and operational pages must not leak through shared caches or indexing. Customer web sign-in uses its own approved issuer client/session, not a copied native refresh token.

Marketplace web must preserve the accepted reel/discovery/advertising and seller-grouped order behavior where included in launch. A website shell showing cards is not a completed Marketplace purchase journey. Test real normal UI checkout, pending payment recovery and customer remedies under the same provider gates as native.

## Store Ops web journeys

Desktop/tablet users select an authorized node after issuer sign-in. Their queue includes only actionable eligible orders for that location. Claim, picking, packing and custody transitions use current assignment/version/idempotency checks. Browser refresh, duplicate tabs and lost responses recover the same durable operation rather than repeating work.

Support receiving, putaway, applicable lot/expiry checks, counts, quarantine, ready packages, rider handover and supervisor exceptions. USB/keyboard scanners and manual entry can form the initial scanning path; camera support is accepted only on tested target browsers/devices. Do not make successful camera access a prerequisite for every workstation. Lost network never converts a local action into authoritative success.

Partner Ops web uses local permissions and least-privilege data. A cashier is not a merchant owner, and a location supervisor is not a platform operator. Revocation must block the next protected action and receipt disclosure. Mobile remains useful on the floor; Delivery mobile remains the execution surface for background rider location.

## Revised domain roles

| Host | Proposed target role | Change from earlier proposal |
| --- | --- | --- |
| www.letbuyy.com | Customer Marketplace web with Quick mode | Future move from the currently observed marketing homepage to the new frontend; not live now |
| letbuyy.com | Redirect to the selected canonical customer host | Avoid duplicate public origins; actual DNS/redirect cutover later |
| letbuyy.store | LetBuyy Store business/marketing entry | Reuse existing marketing runtime on the business-facing domain |
| merchant-handle.letbuyy.store and custom domains | Merchant's own buyer storefront | Existing commerce/web; no Marketplace catalog leakage |
| admin.letbuyy.com | Existing Merchant web dashboard | Preserve current configured name |
| ops.letbuyy.com | New Store Ops web | Explicitly reserve/admit the host and apply workforce/location authorization |
| accounts.letbuyy.com | Shared issuer | Separate registered web/native clients and scoped sessions |
| console.letbuyy.com | Existing internal console | Remains platform-only |
| quick.letbuyy.com | Optional redirect/entry to customer web Quick mode | No separate Quick customer web runtime needed |

Keep checkout/API and existing owned-domain security boundaries. Reconcile the marketing-to-Marketplace homepage change through an explicit route/redirect/content/SEO/hostname plan. Preserve required company/legal/business pages and existing links. Verify DNS/TLS/callback allowlists, reserved labels, cookies, CSP/CORS, hostname routing and deployments for the exact environments. No hostname change is executed by this research.

## Budget change

Add the following focused implementation and immediate verification allowances to the previous base. These are source-informed planning ranges, not measured velocity.

| Additional bucket | Deliverable | Focused days |
| --- | --- | --- |
| PW1 Marketplace web | Responsive customer frontend, session/basket/checkout/orders, public discovery and Quick-mode integration | 20–30 |
| PW2 Store Ops web | Location-scoped operational workspace, scan/claim/pack/stock/handover and recovery | 10–16 |
| PW3 Cross-surface hardening | Browser/device coverage, web/mobile concurrency, session isolation, SEO/private-cache checks and hosting/cutover rehearsal | 5–8 |

The new base is **183–284 focused days**, versus 148–230 previously. With 20% contingency this is **220–341 days**, approximately **44–69 weeks at five focused days/week**, or roughly **10–16 months for the controlled full-scope pilot**. These additions represent about 7–11 focused weeks before contingency. Reforecast after the first accepted slices; unresolved mandatory foundation/provider/operating dependencies can extend the range.

PW1 builds on P1/P2/P3/P7a; its Quick loop is accepted with the completed P5/P6 contracts. PW2 follows P5's canonical fulfillment contracts. PW3 follows both new frontends and the relevant P4–P7 loops. P8/P9 final acceptance includes all three new buckets. No parallel-engineer capacity is assumed.

## Starting sequence and first milestone

1. P0: pin current source/schema/identity/domain facts, preserve user work, and prepare one scoped admission map for all five mobile/seven web surfaces.
2. P1/P2: establish issuer/business/location permissions and one canonical catalog/stock/fee contract before building divergent frontend behavior.
3. First Marketplace web slice: public approved product, normal buyer sign-in, basket and owned order recovery through real canonical APIs; denial/pending states remain honest.
4. First Merchant/Seller slice: reuse products in both directions, prove listing approval, storefront hard-zero commission and exactly one shared-stock effect.
5. First Ops web/mobile slice: one approved node, one staff identity and one order visible consistently; one task claim/pick/pack/handover across both clients with race/lost-response proof.
6. Complete Delivery/provider/cash/returns and cross-surface acceptance before live expansion.

The first P0 preparation slice can be bounded to about two focused days within its larger budget. Its deliverable is a reviewable baseline/admission/task package. It does not promise both websites or production readiness in two days. This request updates the plan; no application scaffolding, source promotion, deployment or other-chat resume is performed.
