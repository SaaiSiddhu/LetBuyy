# Merchant empty-state artwork coverage — 30 October 2026

## Design basis

Merchant light mode uses the shared UI token system: white empty-state/card surfaces, a pale page surface, subtle borders, and the brand-ink purple family. The new transparent PNGs use white and pale lilac forms, lavender outlines, restrained violet depth, and small gold accents for clear contrast on light surfaces. Artwork is decorative (`aria-hidden`); the heading, explanation, and available actions remain accessible text and controls.

The seven primary states for Products, Collections, Inventory, Customers, Reviews, Coupons, and Billing now use their generated scene PNGs too. Two additional PNG scenes cover Settings search and the backend-needed pane; Notifications uses the existing generated notifications scene. The registry has 59 PNG scenes, including separate new-product and product-detail media illustrations.

## Coverage

The source inventory identified 57 routes with explicit no-data UI. All 57 now render a scene through `MerchantEmptyState` or `MerchantEmptyArtwork`. There are 59 individually generated transparent PNG files in `apps/merchant/web/public/empty-states/generated/`: one per route plus two shared-component scenes.

## Generation prompt

All images used the built-in imagegen tool, one call per scene, with `transparent_background: true`. The common prompt was: “One transparent-background raster illustration for the LetBuyy merchant admin empty state named [scene]. Primary request: [scene-specific subject]. Premium soft semi-3D commerce editorial art matching the existing LetBuyy empty-state PNGs; white and pale lilac layered forms, crisp fine lavender outlines, subtle violet depth, tiny restrained warm-gold accents, soft shadows. Compact centered composition, legible at 160 × 110 CSS pixels. Genuine alpha transparency outside objects. No rectangular panel or solid background, text, letters, logos, humans, watermark, or dark colors.” Each scene-specific subject matches its route name and domain.

| Route | Scene | Owning source |
| --- | --- | --- |
| `/{store}/access_account/checkout/select-plan` | `plans` | `apps/merchant/web/src/app/[store]/access_account/checkout/select-plan/SelectPlanClient.tsx` |
| `/{store}/ai` | `ai` | `apps/merchant/web/src/app/[store]/ai/page.tsx` |
| `/{store}/analytics` | `analytics` | `apps/merchant/web/src/app/[store]/analytics/page.tsx` |
| `/{store}/apps` | `apps` | `apps/merchant/web/src/app/[store]/apps/page.tsx` |
| `/{store}/categories` | `categories` | `apps/merchant/web/src/app/[store]/categories/page.tsx` |
| `/{store}/certifications` | `certifications` | `apps/merchant/web/src/app/[store]/certifications/page.tsx` |
| `/{store}/comments` | `comments` | `apps/merchant/web/src/app/[store]/comments/page.tsx` |
| `/{store}/contact` | `contact` | `apps/merchant/web/src/app/[store]/contact/page.tsx` |
| `/{store}/content/reels` | `reels` | `apps/merchant/web/src/app/[store]/content/reels/page.tsx` |
| `/{store}/coupons` | `coupons` | `apps/merchant/web/src/app/[store]/coupons/page.tsx` |
| `/{store}/customers/[email]` | `customer-detail` | `apps/merchant/web/src/app/[store]/customers/[email]/page.tsx` |
| `/{store}/customers` | `customers` | `apps/merchant/web/src/app/[store]/customers/page.tsx` |
| `/{store}/customers/segments` | `segments` | `apps/merchant/web/src/app/[store]/customers/segments/page.tsx` |
| `/{store}/dashboard` | `dashboard` | `apps/merchant/web/src/app/[store]/dashboard/DashboardClient.tsx` |
| `/{store}/education` | `education` | `apps/merchant/web/src/app/[store]/education/page.tsx` |
| `/{store}/experience` | `experience` | `apps/merchant/web/src/app/[store]/experience/page.tsx` |
| `/{store}/gallery` | `gallery` | `apps/merchant/web/src/app/[store]/gallery/page.tsx` |
| `/{store}/leads` | `leads` | `apps/merchant/web/src/app/[store]/leads/page.tsx` |
| `/{store}/marketing` | `marketing` | `apps/merchant/web/src/app/[store]/marketing/page.tsx` |
| `/{store}/online-store/pages` | `store-pages` | `apps/merchant/web/src/app/[store]/online-store/pages/page.tsx` |
| `/{store}/online-store/themes/[themeId]/editor` | `theme-editor` | `apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` |
| `/{store}/online-store/themes/marketplace` | `theme-marketplace` | `apps/merchant/web/src/components/theme-library/ThemeMarketplace.tsx` |
| `/{store}/online-store/themes` | `themes` | `apps/merchant/web/src/components/theme-library/ThemeWorkspace.tsx` |
| `/{store}/orders/[orderId]` | `order-detail` | `apps/merchant/web/src/app/[store]/orders/[orderId]/page.tsx` |
| `/{store}/orders` | `orders` | `apps/merchant/web/src/app/[store]/orders/page.tsx` |
| `/{store}/pages` | `pages` | `apps/merchant/web/src/app/[store]/pages/page.tsx` |
| `/{store}/payouts` | `payouts` | `apps/merchant/web/src/app/[store]/payouts/page.tsx` |
| `/{store}/posts` | `posts` | `apps/merchant/web/src/app/[store]/posts/page.tsx` |
| `/{store}/products/[productId]` | `product-detail` | `apps/merchant/web/src/app/[store]/products/new/page.tsx` |
| `/{store}/products/collections` | `collections` | `apps/merchant/web/src/app/[store]/products/collections/page.tsx` |
| `/{store}/products/gift-cards` | `gift-cards` | `apps/merchant/web/src/app/[store]/products/gift-cards/page.tsx` |
| `/{store}/products/inventory-history` | `inventory-history` | `apps/merchant/web/src/app/[store]/products/inventory-history/page.tsx` |
| `/{store}/products/inventory` | `inventory` | `apps/merchant/web/src/app/[store]/products/inventory/page.tsx` |
| `/{store}/products/locations` | `locations` | `apps/merchant/web/src/app/[store]/products/locations/page.tsx` |
| `/{store}/products/new` | `product-editor` | `apps/merchant/web/src/app/[store]/products/new/page.tsx` |
| `/{store}/products/operations-dashboard` | `operations` | `apps/merchant/web/src/app/[store]/products/operations-dashboard/page.tsx` |
| `/{store}/products` | `products` | `apps/merchant/web/src/app/[store]/products/page.tsx` |
| `/{store}/products/purchase-orders` | `purchase-orders` | `apps/merchant/web/src/app/[store]/products/purchase-orders/page.tsx` |
| `/{store}/products/receipts` | `receipts` | `apps/merchant/web/src/app/[store]/products/receipts/page.tsx` |
| `/{store}/products/reservations` | `reservations` | `apps/merchant/web/src/app/[store]/products/reservations/page.tsx` |
| `/{store}/products/smart-collections` | `smart-collections` | `apps/merchant/web/src/app/[store]/products/smart-collections/page.tsx` |
| `/{store}/products/suppliers` | `suppliers` | `apps/merchant/web/src/app/[store]/products/suppliers/page.tsx` |
| `/{store}/products/transfers` | `transfers` | `apps/merchant/web/src/app/[store]/products/transfers/page.tsx` |
| `/{store}/projects` | `projects` | `apps/merchant/web/src/app/[store]/projects/page.tsx` |
| `/{store}/reviews` | `reviews` | `apps/merchant/web/src/app/[store]/reviews/page.tsx` |
| `/{store}/settings/apps` | `installed-apps` | `apps/merchant/web/src/app/[store]/settings/apps/AppsSettingsClient.tsx` |
| `/{store}/settings/billing` | `billing` | `apps/merchant/web/src/app/[store]/settings/billing/page.tsx` |
| `/{store}/settings/billing/profile` | `payment-methods` | `apps/merchant/web/src/components/billing/BillingPaymentMethods.tsx` |
| `/{store}/settings/domains` | `domains` | `apps/merchant/web/src/app/[store]/settings/domains/page.tsx` |
| `/{store}/settings/notifications` | `notifications` | `apps/merchant/web/src/app/[store]/settings/notifications/page.tsx` |
| `/{store}/settings/security` | `security` | `apps/merchant/web/src/app/[store]/settings/security/page.tsx` |
| `/{store}/settings/shipping` | `shipping` | `apps/merchant/web/src/app/[store]/settings/shipping/page.tsx` |
| `/{store}/settings/taxes` | `taxes` | `apps/merchant/web/src/app/[store]/settings/taxes/page.tsx` |
| `/{store}/settings/users` | `staff` | `apps/merchant/web/src/app/[store]/settings/users/page.tsx` |
| `/{store}/skills` | `skills` | `apps/merchant/web/src/app/[store]/skills/page.tsx` |
| `/{store}/testimonials` | `testimonials` | `apps/merchant/web/src/app/[store]/testimonials/page.tsx` |
| `/stores` | `stores` | `apps/merchant/web/src/app/stores/AllStoresClient.tsx` |

## Verification

- `pnpm typecheck` in `apps/merchant/web`: passed.
- ESLint on changed Merchant TSX files: 0 errors; 38 warnings from existing code patterns in those files. The new artwork component has no lint errors.
- `git diff --check`: passed.
- All 59 generated PNGs report an alpha channel; combined file size is 50,597,183 bytes. No Merchant TSX file references `Emptystate Illustration` after replacing the seven primary overrides.
- Browser spot check on the Products no-match state at 1280 × 800 and 390 × 844: the PNG decoded, message and actions remained visible, and neither width overflowed. Evidence: `.tmp/local-dev/merchant-empty-products-raster-desktop.png` and `.tmp/local-dev/merchant-empty-products-raster-mobile.png` (local, untracked runtime artifacts).
- The source coverage script matched each of the 57 `Yes` rows in the inventory to a unique scene and existing PNG file. Other routes and every possible data/permission state were not browser tested.
- A live check of a formerly overridden primary state could not be completed because navigation to the local Merchant routes timed out; the image override removal was verified by source search and typecheck.
