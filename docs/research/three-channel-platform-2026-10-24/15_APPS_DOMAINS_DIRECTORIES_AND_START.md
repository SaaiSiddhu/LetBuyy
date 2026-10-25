# App names owned domains proposed directories and starting milestone

24 October 2026 · Revised recommendation after the owner confirmed ownership of letbuyy.com and letbuyy.store. This is a proposed product/directory plan, not executed app moves, DNS changes or runtime activation. Only this research chat remains resumed.

**Latest scope update:** the owner now includes Marketplace web and Store Ops web. [Volume 16](16_MARKETPLACE_AND_STORE_OPS_WEB.md) is the detailed web scope, reuse and revised estimate.

## Recommended brand assignment

Keep **LetBuyy as the umbrella for both the existing customer Marketplace and the Storefront platform**. Use **LetBuyy Store** for the merchant storefront management product and **LetBuyy Seller** for the dedicated Marketplace selling application. Use **LetKart Quick** as a candidate second brand for Quick, with LetKart Partner Ops and LetKart Delivery as its workforce names, subject to actual name clearance.

This revises the earlier proposal to rename the whole consumer Marketplace LetKart. The existing customer app stays LetBuyy and contains Marketplace and Quick modes. Quick can be presented as LetKart within that same app. There is no need to buy another domain or create another customer binary to begin.

The apps differ by role and work. The fees differ by actual selling channel. A LetBuyy Store sale stays at zero LetBuyy sales commission, a Marketplace purchase follows its eligible category schedule, and Quick follows the actual partner contract. Shared branding never merges those fee rules.

| Surface | Proposed display name | Reuse and required work |
| --- | --- | --- |
| Customer mobile | LetBuyy | Keep apps/marketplace/mobile; add Marketplace/Quick mode contexts and complete native purchase/Quick behavior |
| Customer web | LetBuyy | New proposed apps/marketplace/web using shared UI/contracts and canonical buyer/catalog/checkout APIs |
| Merchant mobile | LetBuyy Store | Keep apps/merchant/mobile; preserve storefront-first operations and bidirectional catalog enablement |
| Merchant web | LetBuyy Store dashboard | Keep apps/merchant/web and existing configured admin hostname; no duplicate merchant OS |
| Marketplace Seller mobile | LetBuyy Seller | New dedicated product/root by adapting reference/apps/marketplace-seller and canonical shared capabilities; no blank-app rewrite required |
| Quick Store Ops mobile | LetKart Partner Ops, working name | Promote reference/apps/store-operations with history; complete canonical auth, location, stock, tasks and custody |
| Quick Store Ops web | LetKart Partner Ops, working name | New proposed apps/quick/store-ops/web using shared TS UI/API contracts and location-scoped operational workflows |
| Delivery mobile | LetKart Delivery, working name | Promote/adapt apps/deferred/delivery/mobile; complete canonical assignment, background tracking, proof and cash recovery |
| Merchant buyer websites | Merchant's own brand, powered by LetBuyy | Keep apps/commerce/web and Liquid/canonical checkout; not another app per merchant |
| Internal web console | LetBuyy Console | Keep apps/internal/console; extend seller review, partner, dispatch and incident workspaces |
| Identity web | LetBuyy Accounts | Keep apps/platform/identity as sole issuer for every app |
| Public marketing web | LetBuyy | Keep apps/marketing/web; add clearly separated shop, storefront and Quick-partner acquisition content |

The target is five mobile products and seven web surfaces. Two web frontends are new: Marketplace customer web and Store Ops web. The other five web surfaces already exist: Merchant, merchant buyer Storefront, Identity, Console and Marketing. A full Seller web workspace remains separately scoped; its information/app-download page can use existing marketing web.

## What is new and what is renamed

New product admission: dedicated Seller plus Marketplace web and Store Ops web frontend roots. New activation/promotion work: Store Ops mobile and Delivery. New features: Quick customer mode, canonical channel enablement, serviceability/fulfillment, native prepaid integration and appropriate readiness/finance/recovery. Existing source is reused for all five mobile products.

Display-name changes are separate from app IDs and filesystem names. Keep the shipped customer Android identity com.letbuyy.letbuyy and its signing continuity. Keep Merchant's existing com.letbuyy.store identity unless a verified release reason requires otherwise. The Seller donor declares com.letbuyy.seller but is not registered as a shipped active app here. Ops/Delivery still have donor identities that need owned release identities and registry admission before publication. A LetKart display name does not require a LetKart company identifier or a new auth issuer.

Do not rename the existing customer folder merely because it gains Quick. Do not rename packages on every marketing adjustment. Promote the actual donor/deferred source only after its target root, manifests, workspace, identity registry, import boundaries and recipient documentation are admitted. Preserve provenance and useful tests; do not leave two permanently active copies.

## Proposed target directory

~~~text
/Volumes/Projects/LetBuyy/
  apps/
    marketplace/
      mobile/                 existing LetBuyy customer app
      web/                    NEW proposed customer Marketplace and Quick web
    merchant/
      mobile/                 existing LetBuyy Store app
      web/                    existing merchant dashboard
    seller/
      mobile/                 PROPOSED: promote preserved Seller source
    quick/
      store-ops/
        mobile/               PROPOSED: promote preserved Store Ops source
        web/                  NEW proposed location-scoped Ops web
      delivery/
        mobile/               PROPOSED: move/adapt deferred Delivery source
    commerce/
      web/                    existing merchant buyer storefront runtime
    platform/
      identity/               existing sole issuer
    internal/
      console/                existing internal console
    marketing/
      web/                    existing public web runtime
    frozen/                   remain frozen; not activated by this plan
    reserved/                 remain empty/reserved
  services/
    api-gateway/              shared commerce modular monolith
    queue-workers/            existing durable async work
    mobile-bff/               existing composition boundary
    webhook-service/          existing callback/webhook boundary
  packages/                   current canonical TS/Dart shared owners
  database/                   canonical schema, RLS and paired migrations
  reference/                  remaining inert donors and provenance
~~~

| Current source | Proposed target | Implementation treatment |
| --- | --- | --- |
| reference/apps/marketplace-seller | apps/seller/mobile | Admit dedicated product, preserve source history, replace donor Firebase/domain authority |
| reference/apps/store-operations | apps/quick/store-ops/mobile | Admit dedicated Ops product, preserve source, replace donor API/auth assumptions |
| apps/deferred/delivery/mobile | apps/quick/delivery/mobile | Admit activation and target path, retain history and integrate canonical contracts |
| Shared UI/API and canonical commerce owners | apps/marketplace/web | New frontend; no new catalog, issuer, order or payment authority |
| Shared UI/API and Merchant presentation patterns | apps/quick/store-ops/web | New frontend; reuse canonical local fulfillment, stock and custody authority |

The seller and quick containers above are proposed additions to the currently approved grouped layout. No such directories have been activated by this task. Align the scoped Constitution/registry/app-ownership/workspace/validator records in P0 before moving source; do not disable validators to make a folder move pass. The owner direction for dedicated products is already established; exact admission artifacts make that direction reviewable and executable.

## Owned domain plan

Ownership of both apexes is owner-reported and accepted for planning. Actual DNS/hosting/TLS configuration is not established by that statement. The inspected current [brand constants](/Volumes/Projects/LetBuyy/packages/shared-types/src/brand.ts:29) already distinguish platform letbuyy.com and storefront letbuyy.store. The [literal policy](/Volumes/Projects/LetBuyy/scripts/validators/storefront-domain-policy.mjs:1) permits the storefront root narrowly; it does not authorize accounts/admin/API on that root.

| Domain or entry | Proposed role | Hosting/source consequence |
| --- | --- | --- |
| www.letbuyy.com, with apex redirect | Proposed customer Marketplace web and Quick mode | New Marketplace frontend; explicitly migrate current marketing homepage routes/links later |
| letbuyy.store | Storefront-platform business/marketing entry | Reuse existing marketing runtime; plan company/legal content and redirects during homepage cutover |
| merchant-handle.letbuyy.store | Individual merchant buyer website | Existing commerce/web runtime, verified host-to-site routing and TLS |
| Merchant-owned custom domain | Individual merchant buyer website | Same commerce/web runtime with domain verification |
| accounts.letbuyy.com | Shared sign-in | Existing identity platform; separate registered clients and scoped sessions |
| admin.letbuyy.com | Merchant dashboard | Preserve existing configured Merchant web hostname; avoid an unnecessary admin-to-merchant URL migration |
| seller.letbuyy.com | Seller enrollment/information/app-download entry initially | Use existing marketing for a landing page; full Seller web workspace is a later scoped decision |
| quick.letbuyy.com | Optional entry/redirect to customer web Quick mode | Same Marketplace web runtime; partner information stays in marketing |
| ops.letbuyy.com | Proposed Store Ops web | New frontend with workforce/location authorization; separate from internal console |
| checkout.letbuyy.com | Existing canonical hosted checkout origin | Preserve cart-bound trusted checkout authority |
| api.letbuyy.com | Shared commerce APIs | Existing api-gateway and current routing contracts |
| console.letbuyy.com | Internal operations | Existing restricted console |

The inspected Vercel mapping still contains legacy buyer-web hostnames under .com. Treat that as a reconciliation item against the current storefront-root constants, not proof that a .store cutover is deployed. The older domain-topology document also has contradictory apex labels and stale auth/frozen-app descriptions. Do not copy that text into a new auth implementation or infer a completed migration from it.

Merchant-controlled storefront content should remain isolated from platform accounts/admin/API. Use host-only scoped cookies and the existing approved issuer handoff; “one login” does not require sharing a parent-domain cookie with every tenant. Both brands can authenticate through accounts.letbuyy.com. Verify host ownership, DNS, TLS, allowed callbacks, tenant routing, CORS and existing bookmarks before a later cutover. [Cloudflare custom-hostname setup](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/) describes provider prerequisites, not LetBuyy's actual enabled configuration.

The public www endpoint was read as a marketing page during this update; attempts to read the .store root and Seller endpoint did not establish their current service state. Ownership is not being disputed, and no DNS change is made.

## How to start

Start with **P0 and a shared-catalog vertical slice covering Merchant, Seller and the first Marketplace web buyer journey**. Finish that loop before a broad visual rename or moving every folder at once. The following is a planning sequence, not execution under this research request.

| Step | Concrete output | Acceptance |
| --- | --- | --- |
| 1 Pin current baseline | Exact source/schema/config observations, preserved app identities and current mandatory predecessor gates | No user work lost; facts distinguish local, hosted and unknown |
| 2 Admit product/directory map | Scoped Seller/Ops/Delivery roots plus Marketplace web and Store Ops web, ownership, workspace and validator changes prepared together | No duplicate backend/domain owners or accidental reference activation |
| 3 Establish account/business entry | Same existing merchant opens Seller through the issuer and selects the existing authorized business | Wrong business/realm and revoked membership fail |
| 4 Enable one product bidirectionally | Existing product/variant gains selected Marketplace listing; reverse flow enables a Seller-origin product on Storefront | Same canonical IDs and actual stock pool; approval still required |
| 5 Prove channel money and stock boundary | Storefront zero commission, Marketplace configured policy snapshot, final-unit cross-channel race | One physical deduction, attributable fees, original refund facts preserved |
| 6 Add Quick progressively | One approved supermarket/node, preserved Ops and Delivery, exact-local-stock ordering | Staff/rider/COD/prepaid failure and recovery accepted before expansion |

Proposed first review checkpoint: one existing merchant, one business, two products created in opposite apps, selected channel listings, a visible readiness blocker, current shared stock and an audited cross-channel purchase fixture. Payment fixtures must respect the existing Marketplace provider guard until actual provider eligibility is resolved; no fake success is acceptable.

Allow roughly two focused days for the initial baseline/admission preparation slice, then re-estimate the first vertical slice from its exact gaps. The expanded programme including both new web frontends uses the conditional 10–16 month controlled-pilot budget in Volumes 11 and 16; this smaller checkpoint is not a promise that all Seller functionality is ready in a week.
