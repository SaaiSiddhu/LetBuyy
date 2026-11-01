# Merchant web empty-state inventory - 29 October 2026

## Scope and count

- Scope: all 80 `page.tsx` routes under `apps/merchant/web/src/app` at the current checkout.
- **57 routes** contain explicit no-data UI in the route or its directly rendered component. This includes section-level states, not just whole-page emptiness.
- **1 route** has a no-selection warning only. **22 routes** have no dedicated no-data UI; many are forms, redirects or detail flows.
- This is a source inventory, not a count of empty screens currently visible for one store. The local browser spot check did not complete because the dev server intermittently refused connections. Feature flags, permissions, API state and store data change what appears.

## Route-by-route inventory

| Route | No-data UI | What the code handles | Evidence |
| --- | --- | --- | --- |
| `/{store}/access_account/checkout/checkout` | No | Checkout flow | `apps/merchant/web/src/app/[store]/access_account/checkout/checkout/page.tsx:1` |
| `/{store}/access_account/checkout/select-plan` | Yes | Plans unavailable | `apps/merchant/web/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx:240` |
| `/{store}/ai` | Yes | No AI usage yet | `apps/merchant/web/src/app/[store]/ai/page.tsx:334` |
| `/{store}/analytics` | Yes | Analytics will appear after your first activity | `apps/merchant/web/src/app/[store]/analytics/page.tsx:184` |
| `/{store}/appearance` | No | Configuration form | `apps/merchant/web/src/app/[store]/appearance/page.tsx:1` |
| `/{store}/apps/[installationId]` | No | Installed app bridge | `apps/merchant/web/src/app/[store]/apps/[installationId]/page.tsx:1` |
| `/{store}/apps` | Yes | No apps installed | `apps/merchant/web/src/app/[store]/apps/page.tsx:83` |
| `/{store}/categories` | Yes | No categories yet | `apps/merchant/web/src/app/[store]/categories/page.tsx:406` |
| `/{store}/certifications` | Yes | No certifications yet | `apps/merchant/web/src/app/[store]/certifications/page.tsx:407` |
| `/{store}/comments` | Yes | No comments in this view | `apps/merchant/web/src/app/[store]/comments/page.tsx:173` |
| `/{store}/contact` | Yes | No contact submissions yet | `apps/merchant/web/src/app/[store]/contact/page.tsx:288` |
| `/{store}/content/reels` | Yes | Reel drafts | `apps/merchant/web/src/app/[store]/content/reels/page.tsx:105` |
| `/{store}/coupons` | Yes | No coupons yet | `apps/merchant/web/src/app/[store]/coupons/page.tsx:506` |
| `/{store}/customers/[email]` | Yes | No orders yet | `apps/merchant/web/src/app/[store]/customers/[email]/page.tsx:292` |
| `/{store}/customers` | Yes | No-data or missing-section state | `apps/merchant/web/src/app/[store]/customers/page.tsx:279` |
| `/{store}/customers/segments` | Yes | No segments yet | `apps/merchant/web/src/app/[store]/customers/segments/page.tsx:699` |
| `/{store}/dashboard` | Yes | Recent activity | `apps/merchant/web/src/app/[store]/dashboard/DashboardClient.tsx:717` |
| `/{store}/education` | Yes | No education yet | `apps/merchant/web/src/app/[store]/education/page.tsx:411` |
| `/{store}/experience` | Yes | No experience yet | `apps/merchant/web/src/app/[store]/experience/page.tsx:415` |
| `/{store}/export` | No | Export action form | `apps/merchant/web/src/app/[store]/export/page.tsx:1` |
| `/{store}/gallery` | Yes | No media yet | `apps/merchant/web/src/app/[store]/gallery/page.tsx:287` |
| `/{store}/leads` | Yes | No leads yet | `apps/merchant/web/src/app/[store]/leads/page.tsx:238` |
| `/{store}/login` | No | Redirect to Accounts | `apps/merchant/web/src/app/[store]/login/page.tsx:1` |
| `/{store}/marketing` | Yes | Email Campaigns | `apps/merchant/web/src/app/[store]/marketing/page.tsx:566` |
| `/{store}/online-store` | No | Redirect to themes | `apps/merchant/web/src/app/[store]/online-store/page.tsx:1` |
| `/{store}/online-store/pages` | Yes | No pages yet | `apps/merchant/web/src/app/[store]/online-store/pages/page.tsx:600` |
| `/{store}/online-store/preferences` | No | Unset field values only | `apps/merchant/web/src/app/[store]/online-store/preferences/page.tsx:1` |
| `/{store}/online-store/themes/[themeId]/editor` | Yes | Release history | `apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx:1867` |
| `/{store}/online-store/themes/[themeId]/editor/translations` | No | Translation editor | `apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/translations/page.tsx:1` |
| `/{store}/online-store/themes/marketplace` | Yes | Theme search results | `apps/merchant/web/src/components/theme-library/ThemeMarketplace.tsx:128` |
| `/{store}/online-store/themes` | Yes | Theme library results | `apps/merchant/web/src/components/theme-library/ThemeWorkspace.tsx:138` |
| `/{store}/online-store/themes/update` | Fallback | No theme selected | `apps/merchant/web/src/app/[store]/online-store/themes/update/UpdatePageClient.tsx:179` |
| `/{store}/orders/[orderId]` | Yes | No addresses on this order | `apps/merchant/web/src/app/[store]/orders/[orderId]/page.tsx:333` |
| `/{store}/orders` | Yes | No-data or missing-section state | `apps/merchant/web/src/app/[store]/orders/page.tsx:531` |
| `/{store}/pages` | Yes | No pages yet | `apps/merchant/web/src/app/[store]/pages/page.tsx:415` |
| `/{store}/payouts` | Yes | Payouts | `apps/merchant/web/src/app/[store]/payouts/page.tsx:219` |
| `/{store}/posts` | Yes | No posts in this view | `apps/merchant/web/src/app/[store]/posts/page.tsx:346` |
| `/{store}/products/[productId]` | Yes | Product media (shared editor) | `apps/merchant/web/src/app/[store]/products/new/page.tsx:1001` |
| `/{store}/products/collections` | Yes | No-data or missing-section state | `apps/merchant/web/src/app/[store]/products/collections/page.tsx:516` |
| `/{store}/products/gift-cards` | Yes | Sell or issue gift cards | `apps/merchant/web/src/app/[store]/products/gift-cards/page.tsx:513` |
| `/{store}/products/inventory-history` | Yes | No adjustment records | `apps/merchant/web/src/app/[store]/products/inventory-history/page.tsx:429` |
| `/{store}/products/inventory` | Yes | No-data or missing-section state | `apps/merchant/web/src/app/[store]/products/inventory/page.tsx:355` |
| `/{store}/products/locations` | Yes | No locations yet | `apps/merchant/web/src/app/[store]/products/locations/page.tsx:295` |
| `/{store}/products/new` | Yes | No product media yet | `apps/merchant/web/src/app/[store]/products/new/page.tsx:1001` |
| `/{store}/products/operations-dashboard` | Yes | No data available | `apps/merchant/web/src/app/[store]/products/operations-dashboard/page.tsx:199` |
| `/{store}/products` | Yes | No-data or missing-section state | `apps/merchant/web/src/app/[store]/products/page.tsx:507` |
| `/{store}/products/purchase-orders` | Yes | No purchase orders yet | `apps/merchant/web/src/app/[store]/products/purchase-orders/page.tsx:631` |
| `/{store}/products/receipts` | Yes | No receipts found | `apps/merchant/web/src/app/[store]/products/receipts/page.tsx:265` |
| `/{store}/products/reservations` | Yes | No reservations found | `apps/merchant/web/src/app/[store]/products/reservations/page.tsx:300` |
| `/{store}/products/smart-collections` | Yes | No smart collections yet | `apps/merchant/web/src/app/[store]/products/smart-collections/page.tsx:521` |
| `/{store}/products/suppliers` | Yes | No suppliers yet | `apps/merchant/web/src/app/[store]/products/suppliers/page.tsx:287` |
| `/{store}/products/transfers` | Yes | No transfers yet | `apps/merchant/web/src/app/[store]/products/transfers/page.tsx:733` |
| `/{store}/projects` | Yes | No projects yet | `apps/merchant/web/src/app/[store]/projects/page.tsx:385` |
| `/{store}/reviews` | Yes | Product reviews | `apps/merchant/web/src/app/[store]/reviews/page.tsx:327` |
| `/{store}/settings/apps` | Yes | Installed apps | `apps/merchant/web/src/app/[store]/settings/apps/AppsSettingsClient.tsx:187` |
| `/{store}/settings/billing` | Yes | Your past bills will appear here | `apps/merchant/web/src/app/[store]/settings/billing/page.tsx:385` |
| `/{store}/settings/billing/profile` | Yes | Payment methods | `apps/merchant/web/src/components/billing/BillingPaymentMethods.tsx:113` |
| `/{store}/settings/business` | No | Configuration form | `apps/merchant/web/src/app/[store]/settings/business/page.tsx:1` |
| `/{store}/settings/checkout` | No | Configuration form | `apps/merchant/web/src/app/[store]/settings/checkout/page.tsx:1` |
| `/{store}/settings/custom-data` | No | Backend unavailable panel | `apps/merchant/web/src/app/[store]/settings/custom-data/page.tsx:1` |
| `/{store}/settings/domains` | Yes | Custom domains | `apps/merchant/web/src/app/[store]/settings/domains/page.tsx:223` |
| `/{store}/settings/general` | No | Configuration form | `apps/merchant/web/src/app/[store]/settings/general/page.tsx:1` |
| `/{store}/settings/localization` | No | Redirect to General | `apps/merchant/web/src/app/[store]/settings/localization/page.tsx:1` |
| `/{store}/settings/loyalty` | No | Configuration form | `apps/merchant/web/src/app/[store]/settings/loyalty/page.tsx:1` |
| `/{store}/settings/notifications` | Yes | No delivery logs | `apps/merchant/web/src/app/[store]/settings/notifications/page.tsx:594` |
| `/{store}/settings` | No | Settings landing | `apps/merchant/web/src/app/[store]/settings/page.tsx:1` |
| `/{store}/settings/payments` | No | Payment setup/status | `apps/merchant/web/src/app/[store]/settings/payments/page.tsx:1` |
| `/{store}/settings/plan` | No | Plan configuration | `apps/merchant/web/src/app/[store]/settings/plan/page.tsx:1` |
| `/{store}/settings/policies` | No | Policy configuration | `apps/merchant/web/src/app/[store]/settings/policies/page.tsx:1` |
| `/{store}/settings/security` | Yes | 2FA not configured | `apps/merchant/web/src/app/[store]/settings/security/page.tsx:24` |
| `/{store}/settings/shipping` | Yes | No shipping zones configured | `apps/merchant/web/src/app/[store]/settings/shipping/page.tsx:503` |
| `/{store}/settings/subscribe/checkout` | No | Redirect to checkout | `apps/merchant/web/src/app/[store]/settings/subscribe/checkout/page.tsx:1` |
| `/{store}/settings/taxes` | Yes | No tax rates configured | `apps/merchant/web/src/app/[store]/settings/taxes/page.tsx:628` |
| `/{store}/settings/users` | Yes | Staff members | `apps/merchant/web/src/app/[store]/settings/users/page.tsx:425` |
| `/{store}/skills` | Yes | No skills yet | `apps/merchant/web/src/app/[store]/skills/page.tsx:386` |
| `/{store}/testimonials` | Yes | No testimonials yet | `apps/merchant/web/src/app/[store]/testimonials/page.tsx:402` |
| `/accept-invite` | No | Invitation flow | `apps/merchant/web/src/app/accept-invite/page.tsx:1` |
| `/launching-soon` | No | Store availability page | `apps/merchant/web/src/app/launching-soon/page.tsx:1` |
| `/` | No | Session/store redirect | `apps/merchant/web/src/app/page.tsx:1` |
| `/stores` | Yes | Active/inactive stores | `apps/merchant/web/src/app/stores/AllStoresClient.tsx:83` |

## Review findings

1. Select Plan says "Plans are loading..." even when the plan list is empty, while its body says the database may not be set up. Loading and unavailable data should be separate (`SelectPlanClient.tsx:240`).
2. Reels uses a bare "No reel drafts yet." paragraph. A New draft action is present, but the state has less hierarchy than other collections (`content/reels/page.tsx:105`).
3. Theme Update shows a no-selection warning without a direct link back to the theme library (`UpdatePageClient.tsx:179`).
4. Theme editor release history uses a plain no-history sentence. This is a section-level consistency opportunity (`editor/page.tsx:1867`).
5. Custom Data renders the shared `EmptyState` component for a missing backend contract. It is classified as unavailable functionality, not empty merchant data (`BackendNeededPane.tsx:70`).

## Method

Read every route file; followed direct client-component wrappers and the shared product-editor alias. Counted only user-facing no-data content, not loading skeletons, error banners or fields saying "No image connected." No product code was changed.
