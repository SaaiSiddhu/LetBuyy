# CODEX STOREFRONT LEDGER

## CURRENT STATUS
- Stage: STAGE 4 - WS4 Storefront.
- Branch: `stream/master-execution`.
- Active gate: WS4 Storefront complete.
- Active task: Stage 5 WS8 Mobile Parity is next in the master program.
- Scope lock: source edits are limited to `apps/storefront-runtime/src/**`; root execution ledgers are bookkeeping exceptions. No services, packages, database, governance source, or other app roots may be changed in WS4.

## MISSION CONTEXT READ
- Read `docs/Codex_waves/CODEX_STOREFRONT_MISSION.md`.
- Read root `AGENTS.md` and `apps/storefront-runtime/AGENTS.md`.
- Confirmed mission priority: start with SF2 because the Merchant UX theme editor depends on the storefront preview route.

## SF2 - THEME PREVIEW ROUTE

### SF2.1 Build `/preview` Route
- Status: DONE.
- Source changes:
  - Added `apps/storefront-runtime/src/app/preview/page.tsx` as a dynamic, cache-free storefront preview route.
  - Added `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` to bridge preview readiness, legacy merchant-editor section selection messages, modern section selection/scroll messages, and viewport messages.
  - Updated `apps/storefront-runtime/src/app/globals.css` with preview-canvas sizing, preview-only fixed-header containment, and preview viewport overrides for desktop/tablet/mobile responsive header/grid behavior.
- Behavior covered:
  - SF2.1 `/preview` route renders the existing storefront composition engine with editor section frames enabled.
  - SF2.2 route accepts draft theme settings through `settings_data`, `draft_settings`, and `settings_data_b64` query payloads; draft colors/fonts/radius/booleans are normalized before CSS generation. Existing theme preview token/cookie resolution remains supported via `theme_preview_token`.
  - SF2.3 section highlighting works through modern `letbuyy:theme-editor:section-selected` and legacy `LETBUYY_THEME_EDITOR_SELECTION` messages.
  - SF2.4 section scrolling works through `letbuyy:theme-editor:section-scroll` and the legacy selection message.
  - SF2.5 viewport override supports `desktop`, `tablet`, and `mobile` through query params and `letbuyy:theme-editor:viewport` / `LETBUYY_THEME_EDITOR_VIEWPORT` postMessage events.
- Scoped proof:
  - `pnpm install --frozen-lockfile --force` -> PASS after generated cleanup had removed local workspace dependency links; lockfile unchanged.
  - `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS.
  - `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 23 pre-existing warnings and no errors.
  - `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; route output includes dynamic `/preview`.
  - Source assertion for no `as any` and no inline React `style={{...}}` in `apps/storefront-runtime/src/app/preview/page.tsx`, `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`, and the touched CSS -> PASS. A broader preview-folder assertion found pre-existing inline styles in `apps/storefront-runtime/src/app/preview/coming-soon/page.tsx`, which was not changed in this task.
- Browser/screenshot proof:
  - Production server `pnpm --filter @letbuyy/storefront-runtime exec next start --port 3003` -> PASS after sandbox port binding was escalated.
  - Escalated `node .tmp/ws4-sf2-preview-proof.mjs` -> PASS against `http://localhost:3003/preview?subdomain=urban-kicks-demo&viewport=...&settings_data_b64=<redacted>`.
  - Proof asserted 8 editor sections, selected section id `header`, draft CSS variables `--primary: #DC2626`, `--background: #FFFBEB`, `--radius: 8px`, no horizontal overflow, and viewport canvas widths: desktop 1440, tablet 768, mobile 390.
  - Proof also sent `letbuyy:theme-editor:viewport` from desktop to mobile and asserted `documentElement.dataset.letbuyyPreviewViewport === "mobile"` plus canvas width 390.
  - Screenshot paths: `.tmp/screenshots/ws4-sf2/sf2-preview-desktop.png`, `.tmp/screenshots/ws4-sf2/sf2-preview-tablet.png`, `.tmp/screenshots/ws4-sf2/sf2-preview-mobile.png`, `.tmp/screenshots/ws4-sf2/sf2-preview-viewport-message-mobile.png`.
  - Visual review completed for tablet and viewport-message mobile screenshots after fixing header/canvas and responsive grid behavior; no overlap, clipping, or incoherent horizontal overflow found.
- [SKIP - NEEDS BACKEND] API/session draft settings lookup beyond query payload/token support. Required backend evidence: a versioned preview-session API or session lookup contract that returns draft `settings_data` for an authenticated merchant/store preview without passing the draft payload in the query string.

### GATE SF2 Theme Preview Route
- Status: PASS WITH BACKEND-DATA SKIP.
- Gate proof: `/preview` route works, draft settings work, section highlight/scroll postMessage sync works, viewport override works, desktop/tablet/mobile screenshots are captured, scoped typecheck/lint/build are green, and full governance passed 128/128.

## SF1 - COMPONENT GRAMMAR

### SF1.1 Audit Storefront Pages
- Status: DONE.
- Audit findings:
  - E-commerce storefront sections had repeated product-card and collection-card structures without shared grammar hooks.
  - Cart, checkout empty-cart, order lookup, customer-account orders, wishlist, addresses, and page-level account loading used bespoke empty/loading states.
  - Portfolio, resume, skills, experience, and service section empty states used one-off text/icon blocks instead of the storefront empty-state grammar.
  - Store route tree lacked a segment-level loading skeleton for dynamic storefront navigation.

### SF1.2-SF1.4 Apply Grammar, Skeletons, and Empty States
- Status: DONE.
- Source changes:
  - Added `apps/storefront-runtime/src/components/storefront/storefront-states.tsx` with `StorefrontEmptyState`, `StorefrontLoadingState`, and `StorefrontListLoadingState`, composed from `@letbuyy/ui` `EmptyState` and `Skeleton`.
  - Added `apps/storefront-runtime/src/app/store/[subdomain]/loading.tsx` so the dynamic store segment has a shared storefront skeleton.
  - Updated `apps/storefront-runtime/src/app/globals.css` with shared storefront empty/loading/card grammar CSS, compact storefront empty-state illustration styling, and stable product/collection title wrapping.
  - Added shared product-card hooks to `components/sections/product-grid.tsx` and `components/sections/featured-products.tsx`; added shared collection-card hooks to `components/sections/category-grid.tsx`.
  - Replaced bespoke no-products, featured-products-empty, cart-empty, checkout-empty, order-lookup-empty, account-orders-empty/loading, account-wishlist-empty, account-addresses-empty/loading, account-shell-loading, portfolio-empty, skills-empty, experience-empty, and services-empty states with the shared storefront primitives.
  - Updated checkout success and PayPal return page-level waiting states to use the shared storefront list skeleton while leaving mutation/button spinners intact for SF4.
- Scoped proof:
  - `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS.
  - `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 21 warnings, 0 errors. The account-layout warnings were removed; remaining warnings are pre-existing image/set-state/button-spinner warnings outside the SF1 grammar changes.
  - `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; route output includes `/store/[subdomain]`, account pages, cart, checkout, order, product, shop, policy pages, and `/preview`.
  - Production server `pnpm --filter @letbuyy/storefront-runtime exec next start --port 3003` -> PASS after sandbox port binding escalation.
  - Escalated `node .tmp/ws4-sf1-grammar-proof.mjs` -> PASS against `http://localhost:3003`.
  - Proof asserted no horizontal overflow for desktop/mobile home, mobile featured-products scrolled viewport, desktop shop, desktop/mobile cart-empty, and mobile checkout-empty. It also asserted product-card hooks on home/shop, collection-card hooks on home desktop/mobile, shared cart empty state, and shared checkout empty state.
  - Screenshot paths: `.tmp/screenshots/ws4-sf1/sf1-home-desktop.png`, `.tmp/screenshots/ws4-sf1/sf1-home-mobile.png`, `.tmp/screenshots/ws4-sf1/sf1-featured-mobile.png`, `.tmp/screenshots/ws4-sf1/sf1-shop-desktop.png`, `.tmp/screenshots/ws4-sf1/sf1-cart-empty-desktop.png`, `.tmp/screenshots/ws4-sf1/sf1-cart-empty-mobile.png`, `.tmp/screenshots/ws4-sf1/sf1-checkout-empty-mobile.png`.
  - Visual review completed for mobile home, mobile featured-products, desktop shop, mobile cart-empty, and mobile checkout-empty screenshots; no text overlap, clipping, or incoherent horizontal overflow found.

### GATE SF1 Component Grammar
- Status: PASS.
- Gate proof: storefront grammar, skeletons, and empty states are implemented; scoped storefront checks/build/screenshots are green; generated-artifact cleanup scan was empty; full governance passed 128/128.

## SF3 - CUSTOMER ACCOUNT POLISH

### SF3.1 Profile Page / Account Settings
- Status: DONE.
- Source changes:
  - Updated `apps/storefront-runtime/src/app/store/[subdomain]/account/settings/page.tsx` to call the existing `/api/customer/profile` `PATCH` contract instead of an unsupported `PUT`.
  - Added profile save error/success states, required full-name validation, session refresh after save, phone input formatting, and the existing API-supported marketing preference toggle.
  - Kept password change behavior on the existing customer set-password route while improving the profile form layout and account copy.

### SF3.2 Order History
- Status: DONE WITH BACKEND-DATA SKIP.
- Source changes:
  - Updated `apps/storefront-runtime/src/app/store/[subdomain]/account/orders/page.tsx` with expandable order details, timeline steps, item summaries, date/status display, and accessible detail toggles using only fields already returned by the existing customer orders API.
- [SKIP - NEEDS BACKEND] Live customer order-row screenshot with real status timeline and order details. Required backend evidence: authenticated customer session with at least one order row including status, created date, total, and item details from `/api/customer/orders`.

### SF3.3 Addresses
- Status: DONE WITH BACKEND-DATA SKIP.
- Source changes:
  - Updated `apps/storefront-runtime/src/app/store/[subdomain]/account/addresses/page.tsx` with India phone/PIN input constraints and visible 6-digit PIN helper copy.
  - Preserved existing address CRUD endpoints and did not alter API behavior.
- [SKIP - NEEDS BACKEND] Real PIN-code-to-city/state lookup. Required backend evidence: a governed pincode lookup contract returning city/state/district data for Indian PIN codes; until then, city/state remain merchant/customer-entered and the UI shows a clear backend-needed note.

### SF3.4 Wishlist
- Status: DONE WITH BACKEND-DATA SKIP.
- Source changes:
  - Updated `apps/storefront-runtime/src/app/store/[subdomain]/account/wishlist/page.tsx` to avoid fabricated product names. Saved wishlist IDs now render as honest saved-product cards with a backend-needed detail note while preserving remove and product-link behavior.
- [SKIP - NEEDS BACKEND] Hydrated wishlist product details. Required backend evidence: customer wishlist API payload with product names/images/prices or a storefront batch product lookup for the saved product ids.

### GATE SF3 Customer Account Polish
- Status: PASS WITH BACKEND-DATA SKIPS.
- Scoped proof:
  - `pnpm install --frozen-lockfile --force` -> PASS after generated cleanup removed workspace links; lockfile unchanged.
  - `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS.
  - `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 21 warnings and 0 errors.
  - `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; route output includes customer account settings/orders/addresses/wishlist plus checkout/order/storefront routes.
  - Production server with proof-only `CUSTOMER_SESSION_SECRET` -> PASS for authenticated screenshot proof.
  - Escalated `node .tmp/ws4-sf3-account-proof.mjs` -> PASS against `http://localhost:3003`; asserted authenticated settings/profile, address form with PIN backend-needed helper, orders empty state, wishlist empty state, and no horizontal overflow.
  - Screenshot paths: `.tmp/screenshots/ws4-sf3/sf3-settings-mobile.png`, `.tmp/screenshots/ws4-sf3/sf3-address-form-mobile.png`, `.tmp/screenshots/ws4-sf3/sf3-orders-empty-mobile.png`, `.tmp/screenshots/ws4-sf3/sf3-wishlist-empty-mobile.png`, `.tmp/screenshots/ws4-sf3/sf3-settings-desktop.png`.
  - Visual review completed for settings mobile/desktop, address form mobile, orders empty mobile, and wishlist empty mobile; no text overlap, clipping, or incoherent horizontal overflow found.
- Gate proof: customer account profile/settings, order-history UI, addresses, and wishlist are polished within available frontend/API data. Generated-artifact cleanup scan was empty and full governance passed 128/128. Live order-row detail screenshots, real pincode lookup, and hydrated wishlist product cards remain backend-data skips.

## SF4 - CART & CHECKOUT POLISH

### SF4.1-SF4.4 Cart, Checkout, Payment, and Confirmation
- Status: DONE WITH BACKEND/PROVIDER SKIPS.
- Source changes:
  - Updated `apps/storefront-runtime/src/app/store/[subdomain]/cart/page.tsx` with accessible cart action labels, live quantity feedback, stable quantity controls, and checkout reassurance copy that final taxes/discounts/payment availability are verified during checkout.
  - Updated `apps/storefront-runtime/src/app/store/[subdomain]/checkout/checkout-client.tsx` with saved-address autofill, field normalization, stronger email/phone/PIN validation, inline checkout error banners instead of browser alerts, scroll-to-top behavior for validation/payment/success transitions, payment-method unavailable placeholder, clearer COD copy/security text, and a readable fixed-contrast order-confirmation card.
  - Preserved existing API/client contracts and did not modify backend, database, packages, payment adapters, or service code.
- Scoped proof:
  - `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS.
  - `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 21 warnings and 0 errors.
  - `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; route output includes cart, checkout, checkout provider returns, order lookup, account pages, and storefront routes.
  - Production server `pnpm --filter @letbuyy/storefront-runtime exec next start -p 3003` -> PASS after sandbox port binding escalation.
  - Escalated `node .tmp/ws4-sf4-cart-checkout-proof.mjs` -> PASS against `http://localhost:3003`; asserted cart quantity controls, checkout validation error banner, saved-address autofill, payment method list, selected COD copy, COD confirmation CTA, mocked order-confirmation state, and no horizontal overflow on desktop/mobile proof pages.
  - Screenshot paths: `.tmp/screenshots/ws4-sf4/sf4-cart-desktop.png`, `.tmp/screenshots/ws4-sf4/sf4-cart-mobile.png`, `.tmp/screenshots/ws4-sf4/sf4-checkout-address-error-mobile.png`, `.tmp/screenshots/ws4-sf4/sf4-checkout-payment-mobile.png`, `.tmp/screenshots/ws4-sf4/sf4-checkout-success-mobile.png`.
  - Visual review completed for cart desktop/mobile, checkout validation mobile, checkout payment mobile, and checkout success mobile; no text overlap, clipping, unreadable confirmation state, or incoherent horizontal overflow found after the scroll-position and contrast fixes.
- [SKIP - NEEDS BACKEND] Live saved-address autofill screenshot with real authenticated address rows. Required backend evidence: customer session plus at least one persisted address row returned by `/api/customer/addresses`.
- [SKIP - NEEDS BACKEND] Live persisted COD/order-confirmation screenshot. Required backend evidence: governed seeded cart/order creation path with idempotent test order and safe cleanup or rollback; SF4 proof used a Playwright route fulfillment to verify the UI state without mutating backend data.
- [SKIP - NEEDS HUMAN] Live Razorpay/Stripe/PayPal checkout proof. Required human/provider inputs: configured sandbox provider keys, allowed test charge flow, webhook credentials, and permission to create provider-side payment attempts.

### GATE SF4 Cart & Checkout Polish
- Status: PASS WITH BACKEND/PROVIDER SKIPS.
- Gate proof: cart and checkout UX is polished within storefront scope; scoped storefront typecheck/lint/build and Playwright screenshots passed. Live saved-address data, real persisted order creation, and online provider payment attempts remain logged skips.

## SF5 - RESPONSIVE STOREFRONT

### SF5.1-SF5.4 Product, Cart, Account, and Mobile Navigation
- Status: DONE.
- Source changes:
  - Updated `apps/storefront-runtime/src/components/layout/dynamic-header.tsx` with mobile menu body-scroll locking, stable drawer sizing, dialog semantics, accessible icon-button labels, long brand-name truncation, and no-overflow mobile menu rows.
  - Updated `apps/storefront-runtime/src/app/store/[subdomain]/product/[productId]/product-details-client.tsx` with accessible wishlist/share/thumbnail/variant/quantity controls, live quantity feedback, stacked mobile action buttons, and non-overflowing trust badges.
  - Updated `apps/storefront-runtime/src/app/store/[subdomain]/account/layout.tsx` with long customer-name/email truncation and a two-column mobile account nav so active account tabs remain fully visible at 375px.
  - Preserved existing storefront, API, customer-account, payment, backend, database, package, and contract boundaries.
- Scoped proof:
  - `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS.
  - `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 21 warnings and 0 errors.
  - `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; route output includes shop, product detail, cart, checkout, account pages, mobile storefront routes, and `/preview`.
  - Production server `pnpm --filter @letbuyy/storefront-runtime exec next start -p 3003` -> PASS after sandbox port binding escalation.
  - Escalated `node .tmp/ws4-sf5-responsive-audit.mjs` -> PASS against `http://localhost:3003`; asserted no horizontal overflow at 375px for shop, product detail, cart, checkout, customer account settings, and mobile navigation.
  - Screenshot paths: `.tmp/screenshots/ws4-sf5-audit/sf5-shop-375.png`, `.tmp/screenshots/ws4-sf5-audit/sf5-product-detail-375.png`, `.tmp/screenshots/ws4-sf5-audit/sf5-cart-375.png`, `.tmp/screenshots/ws4-sf5-audit/sf5-checkout-375.png`, `.tmp/screenshots/ws4-sf5-audit/sf5-account-settings-375.png`, `.tmp/screenshots/ws4-sf5-audit/sf5-navigation-375.png`.
  - Visual review completed for the mobile drawer, account settings, product detail, cart, and checkout screenshots; no text overlap, clipped active nav, or incoherent horizontal overflow found after fixing the account tab layout and waiting for the drawer animation in the proof script.

### GATE SF5 Responsive Storefront
- Status: PASS.
- Gate proof: 375px storefront product listing/detail, cart/checkout, customer account, and hamburger navigation screenshots passed automated overflow checks and visual review. Generated-artifact cleanup scan was empty, full governance passed 128/128 before commit, and post-commit governance passed 128/128 after commit `62dd4b8b`.

## VALIDATOR LEDGER
- 2026-06-04T03:08:00Z [WS3 predecessor gate] Post-commit `pnpm run validate:governance` after `82ea1656` -> PASS (128/128 validators). WS4 started from a green governance baseline.
- 2026-06-04T03:33:58Z [SF2 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-04T03:36:45Z [SF2 post-commit governance] Post-commit `pnpm run validate:governance` after `76d3bee3` -> PASS (128/128 validators).
- 2026-06-04T04:00:07Z [SF1 scoped gate] `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS; `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 21 warnings and 0 errors; `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; `node .tmp/ws4-sf1-grammar-proof.mjs` -> PASS with desktop/mobile screenshots and no overflow failures.
- 2026-06-04T04:01:59Z [SF1 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-04T04:05:38Z [SF1 post-commit governance] Post-commit `pnpm run validate:governance` after `79ecd20c` -> PASS (128/128 validators).
- 2026-06-04T04:14:42Z [SF3 scoped gate] `pnpm install --frozen-lockfile --force` -> PASS with lockfile unchanged; `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS; `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 21 warnings and 0 errors; `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; `node .tmp/ws4-sf3-account-proof.mjs` -> PASS with authenticated account screenshots and no overflow failures.
- 2026-06-04T04:16:29Z [SF3 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-04T04:18:54Z [SF3 post-commit governance] Post-commit `pnpm run validate:governance` after `7edc318f` -> PASS (128/128 validators).
- 2026-06-04T04:38:14Z [SF4 scoped gate] `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS; `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 21 warnings and 0 errors; `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; `node .tmp/ws4-sf4-cart-checkout-proof.mjs` -> PASS with cart/checkout/COD screenshots and no overflow failures.
- 2026-06-04T04:40:47Z [SF4 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-04T04:42:40Z [SF4 post-commit governance] Post-commit `pnpm run validate:governance` after `cdb34f92` -> PASS (128/128 validators).
- 2026-06-04T04:55:17Z [SF5 scoped gate] `pnpm --filter @letbuyy/storefront-runtime typecheck` -> PASS; `pnpm --filter @letbuyy/storefront-runtime lint` -> PASS with 21 warnings and 0 errors; `pnpm --filter @letbuyy/storefront-runtime exec next build --webpack` -> PASS; `node .tmp/ws4-sf5-responsive-audit.mjs` -> PASS with 375px shop/product/cart/checkout/account/navigation screenshots and no overflow failures.
- 2026-06-04T04:58:33Z [SF5 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; exact pre-commit rerun `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-04T05:00:08Z [SF5 post-commit governance] Post-commit `pnpm run validate:governance` after `62dd4b8b` -> PASS (128/128 validators). WS4 Storefront is complete; advancing master program to Stage 5 WS8 Mobile Parity.
