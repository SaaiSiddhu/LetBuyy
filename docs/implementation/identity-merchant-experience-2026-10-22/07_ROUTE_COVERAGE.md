# Route coverage inventory

The snapshot inventories 13 identity and 80 merchant `page.tsx` files. It includes entry/redirect and gated routes as well as ordinary pages; it is not a feature count. These hashes describe the research baseline. Changed implementation sources are pinned separately in [the implementation evidence](evidence/implementation/source-snapshot.json); the baseline inventory is not a current acceptance claim. API routes, layouts, loading/error boundaries and shared components are dependencies, not included in the page-file count.

**LIVE** below means selected scenarios were exercised, including failures; it does not mean the entire page or all roles passed. **SOURCE** means targeted implementation inspection. **INVENTORY** means file discovery only, with behavioral/visual acceptance pending. The [test report](05_TEST_AND_COVERAGE.md) specifies actual scenarios. [Machine-readable classification](evidence/route-coverage-classification.json) preserves paths and hashes.

## Route families and required acceptance

| Family | Required beta acceptance / scope decision |
| --- | --- |
| Identity entry/recovery | Canonical issuer, MFA continuation, correct error/retry, safe return, language/accessibility and session interruption |
| Store selection/onboarding | Membership, zero/one/multiple stores, account-scoped draft, availability race, idempotent creation, plan/trial handoff |
| Buyer realm boundary | Retain buyer separation and permitted return; do not turn merchant UX changes into buyer privilege |
| Merchant entry/membership | Root/store picker/legacy redirect, invitation expiry/wrong account, denied store and context recovery |
| Dashboard/analytics | Real setup facts, period/population/freshness, undefined vs zero, drill-through and unavailable read |
| Catalog/inventory/purchasing | Authorized collection matching/pagination, direct details, versions/intents, stock semantics, multi-line lifecycle and recovery |
| Orders | Independent detail, status/payment/fulfillment boundaries, relevant negative cases and governed money/provider acceptance |
| Customers/segments | Privacy/permissions, authorized search/matching, direct profile, segment population and safe return |
| Settings/domains | Consistent capability, role-specific actions, plain copy, addressable DNS/TLS workflow, provider truth |
| Theme library/editor | Instance/release/visibility, schema/control layouts, draft/preview/publication separation, conflict/recovery and security gates |
| Online Store content/preferences | Content/publication/readiness, safe media/HTML, owned pages, reload/return and renderer parity |
| Billing/financial entry | Canonical subscription/ledger/provider authority, amount/period/entitlement truth, original-intent recovery; no real charge in audit |
| Apps/assistance | Keep frozen routes fail closed and entries honest; test current bounded helpers, not marketplace/agent expansion |
| Other content/site-type routes | Verify which are permitted for Online Store vs disabled/deferred formats; route existence does not authorize activation |

## Identity page files

| Route | Family | Coverage | Source |
| --- | --- | --- | --- |
| `/buyer/authorize` | Buyer realm boundary | INVENTORY; pending | [page source](../../../apps/platform/identity/src/app/buyer/authorize/page.tsx) |
| `/buyer/privacy` | Buyer realm boundary | INVENTORY; pending | [page source](../../../apps/platform/identity/src/app/buyer/privacy/page.tsx) |
| `/buyer/recover` | Buyer realm boundary | INVENTORY; pending | [page source](../../../apps/platform/identity/src/app/buyer/recover/page.tsx) |
| `/check-email` | Identity entry and recovery | SOURCE | [page source](../../../apps/platform/identity/src/app/check-email/page.tsx) |
| `/forgot-password` | Identity entry and recovery | SOURCE | [page source](../../../apps/platform/identity/src/app/forgot-password/page.tsx) |
| `/login` | Identity entry and recovery | SOURCE | [page source](../../../apps/platform/identity/src/app/login/page.tsx) |
| `/lookup` | Identity entry and recovery | SOURCE | [page source](../../../apps/platform/identity/src/app/lookup/page.tsx) |
| `/onboarding` | Store onboarding and selection | LIVE selected scenario | [page source](../../../apps/platform/identity/src/app/onboarding/page.tsx) |
| `/` | Identity entry and recovery | INVENTORY; pending | [page source](../../../apps/platform/identity/src/app/page.tsx) |
| `/reset-password` | Identity entry and recovery | SOURCE | [page source](../../../apps/platform/identity/src/app/reset-password/page.tsx) |
| `/select` | Store onboarding and selection | SOURCE | [page source](../../../apps/platform/identity/src/app/select/page.tsx) |
| `/set-password` | Identity entry and recovery | SOURCE | [page source](../../../apps/platform/identity/src/app/set-password/page.tsx) |
| `/signup` | Identity entry and recovery | SOURCE | [page source](../../../apps/platform/identity/src/app/signup/page.tsx) |

## Merchant page files

| Route | Family | Coverage | Source |
| --- | --- | --- | --- |
| `/[store]/access_account/checkout/checkout` | Billing and financial entry | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/access_account/checkout/checkout/page.tsx) |
| `/[store]/access_account/checkout/select-plan` | Billing and financial entry | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/access_account/checkout/select-plan/page.tsx) |
| `/[store]/ai` | Apps and assistance | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/ai/page.tsx) |
| `/[store]/analytics` | Dashboard and analytics | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/analytics/page.tsx) |
| `/[store]/appearance` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/appearance/page.tsx) |
| `/[store]/apps/[installationId]` | Apps and assistance | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/apps/[installationId]/page.tsx) |
| `/[store]/apps` | Apps and assistance | SOURCE | [page source](../../../apps/merchant/web/src/app/[store]/apps/page.tsx) |
| `/[store]/categories` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/categories/page.tsx) |
| `/[store]/certifications` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/certifications/page.tsx) |
| `/[store]/comments` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/comments/page.tsx) |
| `/[store]/contact` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/contact/page.tsx) |
| `/[store]/content/reels` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/content/reels/page.tsx) |
| `/[store]/coupons` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/coupons/page.tsx) |
| `/[store]/customers/[email]` | Customers and segments | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/customers/[email]/page.tsx) |
| `/[store]/customers` | Customers and segments | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/customers/page.tsx) |
| `/[store]/customers/segments` | Customers and segments | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/customers/segments/page.tsx) |
| `/[store]/dashboard` | Dashboard and analytics | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/dashboard/page.tsx) |
| `/[store]/education` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/education/page.tsx) |
| `/[store]/experience` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/experience/page.tsx) |
| `/[store]/export` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/export/page.tsx) |
| `/[store]/gallery` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/gallery/page.tsx) |
| `/[store]/leads` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/leads/page.tsx) |
| `/[store]/login` | Merchant entry and membership | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/login/page.tsx) |
| `/[store]/marketing` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/marketing/page.tsx) |
| `/[store]/online-store` | Online Store pages and preferences | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/online-store/page.tsx) |
| `/[store]/online-store/pages` | Online Store pages and preferences | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/online-store/pages/page.tsx) |
| `/[store]/online-store/preferences` | Online Store pages and preferences | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/online-store/preferences/page.tsx) |
| `/[store]/online-store/themes/[themeId]/editor` | Theme library and editor | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx) |
| `/[store]/online-store/themes/[themeId]/editor/translations` | Theme library and editor | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/translations/page.tsx) |
| `/[store]/online-store/themes/marketplace` | Theme library and editor | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/online-store/themes/marketplace/page.tsx) |
| `/[store]/online-store/themes` | Theme library and editor | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/online-store/themes/page.tsx) |
| `/[store]/online-store/themes/update` | Theme library and editor | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/online-store/themes/update/page.tsx) |
| `/[store]/orders/[orderId]` | Orders | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/orders/[orderId]/page.tsx) |
| `/[store]/orders` | Orders | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/orders/page.tsx) |
| `/[store]/pages` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/pages/page.tsx) |
| `/[store]/payouts` | Billing and financial entry | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/payouts/page.tsx) |
| `/[store]/posts` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/posts/page.tsx) |
| `/[store]/products/[productId]` | Catalog, inventory and purchasing | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/products/[productId]/page.tsx) |
| `/[store]/products/collections` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/collections/page.tsx) |
| `/[store]/products/gift-cards` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/gift-cards/page.tsx) |
| `/[store]/products/inventory` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/inventory/page.tsx) |
| `/[store]/products/inventory-history` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/inventory-history/page.tsx) |
| `/[store]/products/locations` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/locations/page.tsx) |
| `/[store]/products/new` | Catalog, inventory and purchasing | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/products/new/page.tsx) |
| `/[store]/products/operations-dashboard` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/operations-dashboard/page.tsx) |
| `/[store]/products` | Catalog, inventory and purchasing | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/products/page.tsx) |
| `/[store]/products/purchase-orders` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/purchase-orders/page.tsx) |
| `/[store]/products/receipts` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/receipts/page.tsx) |
| `/[store]/products/reservations` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/reservations/page.tsx) |
| `/[store]/products/smart-collections` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/smart-collections/page.tsx) |
| `/[store]/products/suppliers` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/suppliers/page.tsx) |
| `/[store]/products/transfers` | Catalog, inventory and purchasing | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/products/transfers/page.tsx) |
| `/[store]/projects` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/projects/page.tsx) |
| `/[store]/reviews` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/reviews/page.tsx) |
| `/[store]/settings/apps` | Settings and domains | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/settings/apps/page.tsx) |
| `/[store]/settings/billing` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/billing/page.tsx) |
| `/[store]/settings/billing/profile` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/billing/profile/page.tsx) |
| `/[store]/settings/business` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/business/page.tsx) |
| `/[store]/settings/checkout` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/checkout/page.tsx) |
| `/[store]/settings/custom-data` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/custom-data/page.tsx) |
| `/[store]/settings/domains` | Settings and domains | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/settings/domains/page.tsx) |
| `/[store]/settings/general` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/general/page.tsx) |
| `/[store]/settings/localization` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/localization/page.tsx) |
| `/[store]/settings/loyalty` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/loyalty/page.tsx) |
| `/[store]/settings/notifications` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/notifications/page.tsx) |
| `/[store]/settings` | Settings and domains | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/[store]/settings/page.tsx) |
| `/[store]/settings/payments` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/payments/page.tsx) |
| `/[store]/settings/plan` | Settings and domains | SOURCE | [page source](../../../apps/merchant/web/src/app/[store]/settings/plan/page.tsx) |
| `/[store]/settings/policies` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/policies/page.tsx) |
| `/[store]/settings/security` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/security/page.tsx) |
| `/[store]/settings/shipping` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/shipping/page.tsx) |
| `/[store]/settings/subscribe/checkout` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/subscribe/checkout/page.tsx) |
| `/[store]/settings/taxes` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/taxes/page.tsx) |
| `/[store]/settings/users` | Settings and domains | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/settings/users/page.tsx) |
| `/[store]/skills` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/skills/page.tsx) |
| `/[store]/testimonials` | Content and other site-type surfaces | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/[store]/testimonials/page.tsx) |
| `/accept-invite` | Merchant entry and membership | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/accept-invite/page.tsx) |
| `/launching-soon` | Merchant entry and membership | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/launching-soon/page.tsx) |
| `/` | Merchant entry and membership | INVENTORY; pending | [page source](../../../apps/merchant/web/src/app/page.tsx) |
| `/stores` | Merchant entry and membership | LIVE selected scenario | [page source](../../../apps/merchant/web/src/app/stores/page.tsx) |

## How to close coverage

Choose the next applicable journey from the existing programme. Bind it to an actor, owned fixture, source revision, real read/command contract, success result and relevant alternate state. Record keyboard/mobile and recovery evidence where the interaction requires it. Keep denied/unavailable/skipped cases distinct from passed outcomes. A source marker, screenshot, imported component or HTTP 200 alone never closes an operational journey.

Frozen, legacy, alias and non-Online-Store routes must be classified under current authority before adding visible navigation or completing functionality. Prefer convergence on the canonical winner; do not use this inventory as a construction checklist for every existing file.
