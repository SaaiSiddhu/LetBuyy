# React Storefront Elimination Study

> **Scope:** Whether and how each storefront-runtime customer-facing route can be converted to full Liquid rendering, and what blocks remain. This document does NOT cover merchant-control-plane routes.

---

## Scope Separation

### Storefront React (target for elimination)

Routes under `apps/storefront-runtime/src/app/store/[subdomain]/` that serve customers at runtime — these are the candidates for Liquid replacement. The composition engine (`composition-engine.tsx`) already supports a dual-path: if `plan.rendererEngine === 'liquid'` and a Liquid bundle is available, it calls `renderLiquidPlan()` and emits raw sanitized HTML + `LiquidHydrationIslands`. Otherwise it falls back to React section rendering via `renderRegisteredSection()`. The canary log event `lb:canary:render` records which path was taken. Every storefront route already passes through `StorefrontCompositionEngine`; the question per route is whether the Liquid path is reachable and complete.

### Admin React (MUST REMAIN)

The merchant-control-plane is entirely React and must stay that way:

- `apps/merchant-control-plane/src/app/[store]/online-store/themes/page.tsx` — live theme management, install/publish/upload flows with `useState`/`useEffect`/`useCallback`/`useRef`, `useToast`, router navigation, and file upload handling (`handleBundleUpload`).
- `apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx` — cross-origin `postMessage` communication with the storefront preview iframe, `useRef` to gate iframe postMessage until `onLoad` fires, `useEffect` for section-select events.
- All other merchant-control-plane pages (settings, billing, products, orders, coupons, etc.) — React is the correct rendering model here; the admin UI is a SPA-style dashboard, not a content page.

### Editor Preview React (partial target)

The editor preview renders the storefront in an `<iframe>` with `?editor=1` appended to the URL. The iframe itself renders through the same `StorefrontCompositionEngine` as a live storefront, meaning any route that goes Liquid will render Liquid in the preview too. However, the editor chrome outside the iframe (section list, settings panel, CenterPanel, section-select highlighting via `postMessage`) is React on the merchant-control-plane side and must remain so. The `EditorPreviewSectionFrame` wrapper inside `composition-engine.tsx` adds `data-section-id`/`data-section-type` attributes around each React section for in-iframe click-selection; the equivalent in full-Liquid mode is the `data-theme-renderer="liquid"` container with `LiquidHydrationIslands` handling click-to-section from within the Liquid HTML via the `letbuyy:theme-editor:section-select` postMessage.

**Verdict:** Editor preview is already Liquid-capable for any route that has a Liquid template. The outer editor chrome is React and stays React.

---

## Route-by-Route Feasibility Analysis

### 1. Home Page (/)

**Current State:** Hybrid — server component issues `StorefrontCompositionEngine` which either takes the Liquid path or the React section-list path depending on `rendererEngine`.

**React Components Used:**
- `DynamicHeader`, `DynamicFooter` (via `renderer-registry.tsx` `core.header`/`core.footer`)
- `HeroSection`, `ProductGrid`, `FeaturedProducts`, `TestimonialsSection`, `AboutSection`, `BrandMarquee`, `TrustBadges`, `CategoryGrid`, `NewsletterSection`, `CtaSection`, `AppBlockSlot`

**What React Is Doing:**
Rendering static layout sections that do not require browser interactivity — hero banners, product grids (read-only links), testimonials, trust badges, brand marquees, CTAs, newsletter subscription form (form with a submission POST). The data is server-resolved at SSR time via `buildSectionDataPlan`. No React state or effects exist in the server component path.

**Can It Be Liquid?** YES

**Blocking Issues:** None architectural. Newsletter form requires a Liquid form action or a Liquid island for submission. The cart-drawer (if present in the header) is already handled by the `lb-cart-drawer` hydration island in `LiquidHydrationIslands`.

**Required Work:**
- Ensure the `index` template key has a corresponding Liquid template in the active theme bundle.
- Migrate newsletter submit to a Liquid `{% form 'newsletter' %}` tag or an `lb-newsletter-signup` island.
- Verify the `lb-cart-drawer`, `lb-customer-auth`, and `lb-wishlist` islands are present in the theme layout.

**Risk Level:** LOW

**Recommendation:** Phase A complete for stores using Liquid themes. React remains the default fallback for stores without a Liquid bundle.

---

### 2. Product Detail (/product/[id])

**Current State:** Hybrid — the server component resolves the product and passes it to `StorefrontCompositionEngine`. For Liquid themes, `renderLiquidPlan` builds a full `product` drop and renders via the theme engine. For React themes, `ProductDetailSection` (which renders `ProductDetailsClient`) is the renderer.

**React Components Used:**
- `ProductDetailsClient` (`'use client'`) — the full interactive product detail UI
- `motion`/`AnimatePresence` from `framer-motion` for image transitions and variant button tap animations
- `useCart()` context hook
- `useRouter()` for "Buy Now" navigation
- `useState` for: selected image index, quantity, specs accordion open/closed, add-to-cart flash state, wishlist toggle, selected variant map

**What React Is Doing:**
- Image gallery carousel with animated transitions between selected images
- Variant selection (Size/Color/etc.) that mutates `selectedVariants` state and re-derives `resolvedVariant`, `displayPrice`, `displayComparePrice`, `displayStock` on each selection
- Quantity stepper (+/- with stock bounds check)
- Add-to-cart (calls `addToCart(product, resolvedVariant)`) and Buy Now (addToCart + router.push to cart)
- Wishlist toggle (local state only — not persisted to backend in this component)
- Specifications accordion collapse/expand

**Can It Be Liquid?** PARTIAL

**Blocking Issues:**
1. **Variant selection and price update:** When a user picks Size=M, the displayed price, compare price, stock, and discount badge must update without a page reload. In Liquid this requires either a full page reload on variant change (like classic Shopify) or a JS island (`lb-variant-selector`) that posts to a local API endpoint returning updated variant data.
2. **Add-to-cart action:** The cart in LetBuyy is browser-owned (token in `localStorage`). `addToCart` calls the `CartContext`. A Liquid theme must emit an `lb-add-to-cart` island (already in scope in `liquid-hydration-islands.tsx`).
3. **Framer Motion animations:** These are pure cosmetic; Liquid can emit static HTML and CSS transitions replace them.
4. **Wishlist toggle:** Liquid can emit a `lb-wishlist-toggle` island.

**Required Work:**
- Implement `lb-variant-selector` island: on option click, fetch `/api/storefront/{subdomain}/products/{id}/variant?options=...`, update price/stock display.
- Implement `lb-add-to-cart` island: wire to CartContext-equivalent JS module.
- Remove framer-motion dependency; use CSS transitions.
- The Liquid `product` drop in `composition-engine.tsx` already includes `variants`, `options`, `compare_at_price`, `stock`, `rating`, `review_count`.

**Risk Level:** MEDIUM

**Recommendation:** Liquid rendering is achievable but requires the `lb-variant-selector` and `lb-add-to-cart` hydration islands before the React version can be retired.

---

### 3. Collection (/collections/[slug])

**Current State:** Hybrid — server component loads collection + products, creates a `StorefrontRenderPlan` with type `collection`, passes to `StorefrontCompositionEngine`. The Liquid path receives the `collection` drop with a `products` array via `buildLiquidCommerceContext`.

**React Components Used:**
- `ProductGrid` — renders a grid of product cards, each linking to `/product/{id}`. No state or effects; purely a presentational component that maps product data to HTML.

**What React Is Doing:** Rendering a read-only grid of product cards. No interactivity required on the page itself (add-to-cart is in the product grid card buttons, which call `useCart`).

**Can It Be Liquid?** PARTIAL

**Blocking Issues:**
1. Product grid cards have "Add to Cart" buttons that call `useCart`. In a Liquid theme these need to be `lb-add-to-cart` islands or submit to a cart-sync endpoint.
2. Filtering/sorting (if added later) would require JS islands; no filtering exists today so this is a future concern.

**Required Work:**
- `lb-product-card` island for add-to-cart buttons within product grid.
- Or accept that product cards in Liquid collections link through to the product detail page (no inline add-to-cart on the grid).

**Risk Level:** LOW

**Recommendation:** Collections page is effectively Liquid-capable today for display. The only blocker is inline add-to-cart on grid cards; this can be deferred or resolved via islands.

---

### 4. Products List (/products and /shop)

**Current State:** Both routes (`/products` and `/shop`) are structurally identical — they call `resolveStorefrontTemplate` with `type: 'collection'` and `resourceSlug: 'all-products'`, then `StorefrontCompositionEngine`. These are pure product listing pages.

**React Components Used:** Same as Collection above (`ProductGrid` or `FeaturedProducts`).

**What React Is Doing:** Identical to Collection route — read-only product listing.

**Can It Be Liquid?** YES (same as Collection)

**Blocking Issues:** Identical to Collection. No distinct blockers.

**Required Work:** Same as Collection.

**Risk Level:** LOW

**Recommendation:** These are already Liquid-capable for display. Treat as equivalent to Collection.

---

### 5. Cart (/cart)

**Current State:** Hybrid with an explicit branch. `cart/page.tsx` checks `plan.rendererEngine === 'liquid'`; if Liquid, it passes an empty `sectionData` map to `StorefrontCompositionEngine` (cart state is browser-hydrated via the `lb-cart-drawer` island); otherwise it falls back to `CartPageClient`.

**React Components Used:**
- `CartPageClient` (`'use client'`) — uses `useCart()` for items, `removeFromCart`, `updateQuantity`, `cartTotal`, `clearCart`; `useParams()` for subdomain; `motion`/`AnimatePresence` for item add/remove animations; `Image` for product thumbnails.

**What React Is Doing:**
- Reads and displays the browser-owned cart (items, quantities, total).
- Remove item, +/- quantity stepper.
- Animated list transitions.
- "Proceed to Checkout" link (static navigation).

**Can It Be Liquid?** YES (with island)

**Blocking Issues:** The cart is browser-owned (`localStorage` token). The Liquid `cart` drop in `collectLiquidCart` explicitly returns `item_count: null` and `source: 'browser_hydrated'` at SSR time. The actual cart UI must be hydrated client-side. The existing code already does this for Liquid themes: it renders the Liquid `cart` template as static HTML, then `LiquidHydrationIslands` mounts `lb-cart-drawer` which hydrates cart state from the gateway's cart endpoint.

**Required Work:**
- Liquid cart template must provide the full cart page layout skeleton; the `lb-cart` island hydrates the item list.
- The `lb-cart` island must support `removeFromCart`, `updateQuantity`, `clearCart` operations against the same gateway cart API.
- This is already partially implemented (the `sync_url` in the cart drop points to `/api/storefront/{subdomain}/cart`).

**Risk Level:** MEDIUM — the cart island requires a more complete JS implementation than a read-only display.

**Recommendation:** The structural Liquid path already exists. Complete the `lb-cart` island to handle CRUD operations, then the React `CartPageClient` fallback can be retired.

---

### 6. Checkout (/checkout) — Special Case

**Current State:** React-only. `checkout/page.tsx` is a server component that resolves the store and unconditionally renders `<CheckoutClient .../>`. There is no Liquid path and no call to `StorefrontCompositionEngine`.

**React Components Used:**
- `CheckoutClient` (`'use client'`) — the most complex React component in the entire storefront

**What React Is Doing (each blocker documented with evidence from `checkout-client.tsx`):**

**1. Multi-step wizard state** (line 156–158): `const [step, setStep] = useState(1)` manages the Address → Payment two-step flow. Each step transition calls `scrollToCheckoutTop()` and `AnimatePresence` drives the CSS transition between panels. Liquid has no built-in multi-step form concept.

**2. Address form with real-time field validation** (lines 313–325): `validateForm()` runs synchronous regex and length checks on `formData` state, populates `errors` state with per-field messages, and blocks `proceedToPayment()` until all fields pass. Liquid's `{% form %}` tag only supports server-side form errors on redirect; it cannot do inline real-time validation.

**3. Saved address autofill** (lines 189–205): `useEffect` on mount fetches `/api/customer/addresses` and sets `savedAddresses` state. Clicking a saved address calls `applySavedAddress()` which merges address fields into `formData`. This is a client-side API call + state mutation that requires JavaScript.

**4. Real-time shipping rates** (lines 213–245): A second `useEffect` fetches `/api/shipping/rates` with the current cart subtotal (`subtotal_minor`) immediately on mount. The response updates `storeRates` state, which is then rendered as radio buttons. The delivery cost in the order summary updates reactively as the user selects a rate. Liquid cannot render a shipping rate widget without a full page reload or a JS island.

**5. Coupon validation** (lines 366–405): `applyCoupon()` calls `/api/coupons/validate` asynchronously, parses the response, and updates `appliedCoupon` state (which in turn updates `discountAmount` and `totalAmount` in the order summary sidebar). Immediate feedback (`couponError`, applied coupon display) requires React state.

**6. Razorpay payment SDK initialization** (lines 444–550): This is the single hardest blocker. The checkout loads the Razorpay SDK via `<Script src="https://checkout.razorpay.com/v1/checkout.js">` (line 622), sets `razorpayLoaded` via `onLoad`. `handlePayment()` then:
   - Creates an order via `POST /api/orders`
   - Creates a Razorpay order via the gateway (`POST /payments/razorpay/order`)
   - Opens `new window.Razorpay(options)` — an imperative call to a third-party SDK object that attaches a modal overlay to `window`
   - The `handler` callback (line 492) receives `{razorpay_order_id, razorpay_payment_id, razorpay_signature}` and must call `/payments/razorpay/verify` server-side to confirm the HMAC signature
   - `modal.ondismiss` (line 534) resets `isProcessing` state

**The Razorpay callback pattern is fundamentally incompatible with Liquid rendering.** Liquid is a server-side template language with no concept of async callbacks, imperative DOM objects, or `window.Razorpay`. The entire payment flow must remain in JavaScript.

**7. COD confirmation** (lines 424–442): While simpler than Razorpay, `handleCODOrder()` posts to `/api/orders`, shows a processing spinner, and then transitions to the success screen — all requiring React state (`isProcessing`, `isSuccess`, `orderNumber`).

**8. In-flow success screen** (lines 553–601): After a successful order, the component re-renders a success card inline (no page navigation), using `isSuccess` and `orderNumber` state. This avoids a separate success page load and maintains cart clearing.

**9. Idempotency key generation** (lines 172, 256–260): `idempotencyKeysRef` uses `useRef` to persist UUIDs across renders without triggering re-renders. Idempotency is a security requirement (prevents duplicate orders on button double-tap).

**10. Client-side cart read** (line 151): `useCart()` reads items and total from `CartContext`. Liquid has no access to the browser cart at render time; cart items must be fetched client-side.

**Can It Be Liquid?** NO

**Blocking Issues:** The entire checkout is a multi-step wizard built around real-time state, the Razorpay JS SDK (which requires an imperative callback), COD order creation, in-flow success rendering, and idempotency keys. None of these are expressible in Liquid templates. Even a "Liquid wrapper with islands" approach would leave the checkout body entirely as a JS island, defeating the purpose.

**Required Work:** None — this route must remain React-only.

**Risk Level:** CRITICAL — any attempt to Liquid-ify checkout would break payments.

**Recommendation:** Explicitly carve out `/checkout` as a permanent React route. The server component (`checkout/page.tsx`) should never call `StorefrontCompositionEngine`; its current direct-to-`CheckoutClient` pattern is correct and must be preserved.

---

### 7. Checkout Success (/checkout/success)

**Current State:** React-only client component (`'use client'`). This page is a tombstone for stale Stripe redirect links; Razorpay success is handled inline within `CheckoutClient` (the `isSuccess` state branch).

**React Components Used:**
- `useEffect` + `useState` to resolve the subdomain from async `params`

**What React Is Doing:** Resolves `subdomain` from the promise-based `params` (Next.js 15 style) via `useEffect`, then renders a static redirect link to `/store/{subdomain}/orders`. This is purely a placeholder — the real success screen lives inside `CheckoutClient`.

**Can It Be Liquid?** PARTIAL

**Blocking Issues:** The async `params` resolution pattern used here is a Next.js client-component workaround. A server component could resolve `params` synchronously.

**Required Work:** This page could be rewritten as a server component redirecting to `/account/orders`. The Liquid version would be a trivial redirect template. However, since the real success UX is inline in `CheckoutClient` and this page is only reached via stale Stripe links (LB-2 deferred), there is low ROI.

**Risk Level:** LOW

**Recommendation:** Keep as-is (the React footprint is trivial). Convert to a server-side redirect if desired.

---

### 8. Account Dashboard (/account)

**Current State:** Hybrid. The server component calls `resolveAccountLiquid()`. If `isLiquid` is true and the customer is authenticated, it renders via `StorefrontCompositionEngine` with the `customers/account` Liquid template. If React, it redirects to `/account/orders`.

**React Components Used:** None in the page itself — the page either serves Liquid output or issues a server-side redirect.

**What React Is Doing:** Nothing directly; the React fallback is a redirect.

**Can It Be Liquid?** YES — already implemented for Liquid themes.

**Blocking Issues:** None. The account dashboard page exists in the Liquid path today.

**Required Work:** Ensure the `customers/account` template exists in theme bundles. The `customer` drop (including `orders` summary) is fetched via `getStorefrontCustomerDrop` in `renderLiquidPlan`.

**Risk Level:** LOW

**Recommendation:** Already Liquid. The React fallback (redirect to orders) is intentional for themes without a customer account template.

---

### 9. Account Orders (/account/orders)

**Current State:** Hybrid. Same `resolveAccountLiquid` pattern: Liquid themes render `customers/orders` template via `StorefrontCompositionEngine`; React themes render `OrdersClient`.

**React Components Used:**
- `OrdersClient` (`'use client'`) — `useEffect` fetches `/api/customer/orders`, `useState` for orders list, loading state, and `expandedOrderId` for accordion-style detail expansion.

**What React Is Doing:**
- Client-side data fetch on mount (order history API call).
- Accordion expand/collapse for order detail view (toggle `expandedOrderId`).
- Order timeline step rendering (derived from `status` string).
- Date formatting with `en-IN` locale.

**Can It Be Liquid?** YES (for Liquid themes)

**Blocking Issues:** The `customer.orders` drop is already fetched server-side in `renderLiquidPlan` when `plan.route.type === 'customer_orders'`. For the React fallback, the client-side accordion and API fetch are not needed if the data is in the Liquid drop.

**Required Work:**
- The `customers/orders` Liquid template needs to handle the accordion pattern via a `<details>`/`<summary>` HTML element or a minimal JS island.
- No structural work needed — the server-side data binding already exists.

**Risk Level:** LOW

**Recommendation:** Already Liquid for Liquid themes. The React `OrdersClient` accordion could be replaced by native `<details>` in the Liquid template.

---

### 10. Account Order Detail (/account/orders/[id])

**Current State:** Hybrid. The server component calls `resolveAccountLiquid` with `customer_order` route type. If Liquid, it renders via `StorefrontCompositionEngine`. If React, there is no React order detail page — it redirects to `/account/orders`.

**React Components Used:** None — the React fallback is a server-side redirect.

**What React Is Doing:** Nothing directly.

**Can It Be Liquid?** YES — already implemented.

**Blocking Issues:** None. The `orderDetail` drop is fetched in `renderLiquidPlan` via `getCustomerOrderDetailDrop` when `route.type === 'customer_order'`.

**Required Work:** Ensure the `customers/order` template handles the individual order detail view including line items, status, shipping address, and payment method.

**Risk Level:** LOW

**Recommendation:** Already Liquid for Liquid themes. No React implementation exists to retire.

---

### 11. Account Settings (/account/settings)

**Current State:** Hybrid. `resolveAccountLiquid` pattern; Liquid renders `customers/settings` template. React renders `SettingsPageClient`.

**React Components Used:**
- `SettingsPageClient` (`'use client'`) — `useState` for form fields (`fullName`, `phone`, `acceptsMarketing`), password fields, show/hide password toggles, loading/success/error states. `useCustomerAuth()` to access `customer` data.

**What React Is Doing:**
- Profile form with controlled inputs (`fullName`, `phone`, `acceptsMarketing` checkbox).
- Password change form with two fields and a show/hide toggle.
- Two separate async `fetch` calls (`PATCH /api/customer/profile`, `POST /api/customer/set-password`).
- Inline success/error feedback without page reload.

**Can It Be Liquid?** PARTIAL

**Blocking Issues:**
1. **Password show/hide toggle:** Requires JavaScript to swap `type="password"` to `type="text"`. This is a small JS island.
2. **Inline validation feedback:** Liquid form tag shows errors on redirect; React shows them inline. This is a UX degradation if migrated.
3. **`useCustomerAuth` for pre-filling email:** Liquid can pre-fill from `{{ customer.email }}` in the template drop.

**Required Work:** The forms can be native HTML `<form>` elements with Liquid rendering. The password toggle becomes a `lb-password-toggle` island (one `<input type="checkbox">` + JS). Error display either uses server-redirect patterns or a small fetch island.

**Risk Level:** MEDIUM — the password toggle and inline error handling need island work.

**Recommendation:** Liquid-capable with islands. Low priority given small user-base for account settings.

---

### 12. Account Wishlist (/account/wishlist)

**Current State:** Hybrid. Liquid renders `customers/wishlist` template. React renders `WishlistPageClient`.

**React Components Used:**
- `WishlistPageClient` (`'use client'`) — `useWishlist()` context hook, `useParams()` for subdomain. `toggleWishlist(productId)` on each card.

**What React Is Doing:** Reads product IDs from `WishlistContext`, renders product stub cards (no real product data — the client acknowledges "Product detail hydration needs backend support"), and allows removing items via `toggleWishlist`.

**Can It Be Liquid?** YES (for Liquid themes)

**Blocking Issues:** The `customer.wishlist_products` array is enriched server-side in `renderLiquidPlan` via `ProductService.getProductsByIds(customer.wishlist)` when `route.type === 'customer_wishlist'`. The Liquid template receives full product drops. The React version uses only product IDs from context (incomplete).

**Required Work:** The Liquid path is actually more complete than the React path. The Liquid wishlist template should render real product cards with images/prices. A `lb-wishlist-toggle` island handles remove actions.

**Risk Level:** LOW

**Recommendation:** Liquid path is better than React path here. Prioritize completing the Liquid template; the React `WishlistPageClient` is a stub and should be deprecated.

---

### 13. Account Addresses (/account/addresses)

**Current State:** Hybrid. Liquid renders `customers/addresses` template. React renders `AddressesPageClient`.

**React Components Used:**
- `AddressesPageClient` (`'use client'`) — `useEffect`/`useCallback` for fetching addresses on mount; `useState` for address list, loading, show/hide form modal, edit form fields (`label`, `full_name`, `address_line1`, etc.), saving spinner, deleting spinner.
- The add/edit form is a modal (`fixed inset-0`) — a full overlay portal.

**What React Is Doing:**
- Fetch addresses on mount (`GET /api/customer/addresses`).
- CRUD: `POST` (add), `PUT` (edit/set-default), `DELETE` (remove) via `fetch`.
- Form modal with animated appearance (CSS `fixed inset-0`).
- Per-field controlled inputs for all address fields.
- Inline saving/deleting spinners with optimistic UI.

**Can It Be Liquid?** PARTIAL

**Blocking Issues:**
1. **Modal form for add/edit:** Liquid cannot render a dynamic modal. This needs a `lb-address-form` island.
2. **CRUD operations without page reload:** Liquid form submissions traditionally redirect. An island handling the API calls + re-rendering the list is needed.
3. **Optimistic delete spinner:** A UX concern; can be degraded to full-page reload.

**Required Work:** A `lb-address-manager` island that handles the full CRUD UI, rendered into a slot in the Liquid template. Essentially the React component becomes a Web Component or a scoped React island.

**Risk Level:** MEDIUM-HIGH — the CRUD modal pattern is complex enough that an island approach would be nearly as complex as keeping React.

**Recommendation:** Keep React for addresses for now. The Liquid path exists but the React fallback is the better UX until dedicated islands are built.

---

### 14. Policy Pages (/privacy, /terms, /shipping, /returns)

**Current State:** Server components using `ContentResourceRenderer` with `ContentService.getPolicy()` or `ContentService.getPageBySlug()`. `ContentResourceRenderer` renders the content through the theme engine (Liquid or React depending on store config).

**React Components Used:** `ContentResourceRenderer` (server component); `RichContent` component for HTML rendering.

**What React Is Doing:** Rendering static text content fetched from the DB. No interactivity.

**Can It Be Liquid?** YES

**Blocking Issues:** None. Policy pages are static prose content. The `page` drop can carry `title`, `content`, `seo` fields.

**Required Work:** Ensure theme bundles include a `page` Liquid template that renders `{{ page.content }}` with appropriate styling.

**Risk Level:** LOW

**Recommendation:** These are the easiest routes to migrate. They are already going through `ContentResourceRenderer` which is Liquid-aware.

---

### 15. Blog (/blog/[slug])

**Current State:** Server component using `ContentResourceRenderer` with `ContentService.getBlogPostBySlug()`. Same pattern as policy pages.

**React Components Used:** `ContentResourceRenderer` (server component); `RichContent` for HTML body rendering.

**What React Is Doing:** Rendering static blog post content. No interactivity.

**Can It Be Liquid?** YES

**Blocking Issues:** None. Blog posts are SSR'd static content.

**Required Work:** Liquid `article` template to render `{{ article.title }}`, `{{ article.content }}`, `{{ article.author }}`, etc.

**Risk Level:** LOW

**Recommendation:** As easy as policy pages. High ROI.

---

### 16. Search/Products List (/products, /shop) — see Route 4

Already covered above under "Products List."

---

### 17. Catch-all ([...path])

**Current State:** Server component `StorefrontDynamicPage` — accepts a single-segment catch-all path and calls `ContentService.getPageBySlug()`. Renders via `ContentResourceRenderer`. Returns `notFound()` for multi-segment paths.

**React Components Used:** `ContentResourceRenderer` (server component).

**What React Is Doing:** Rendering merchant-authored custom pages (same as policy pages).

**Can It Be Liquid?** YES

**Blocking Issues:** None. These are static custom pages from the content service.

**Required Work:** Same `page` Liquid template that handles policy pages would cover these.

**Risk Level:** LOW

**Recommendation:** Treat as equivalent to policy/blog pages.

---

## Checkout Special Analysis

Checkout is the single route that cannot become Liquid, and the reasons are deep:

**1. Razorpay JS SDK (lines 540–545 in `checkout-client.tsx`):**
```ts
const rzp = new window.Razorpay(options);
rzp.on('payment.failed', function () { ... });
rzp.open();
```
`window.Razorpay` is a constructor from an external third-party script loaded at runtime. The `options.handler` callback receives the payment confirmation (`razorpay_payment_id`, `razorpay_signature`) and must call the gateway's HMAC verify endpoint. This imperative SDK interaction pattern — load external script → construct object → open modal → receive async callback → call verification API — has no Liquid equivalent. It requires the browser JavaScript runtime at every step.

**2. Idempotency key generation (lines 256–260):**
```ts
idempotencyKeysRef.current[scope] = `checkout-${scope}-${crypto.randomUUID()}`;
```
`crypto.randomUUID()` is a browser API. Idempotency keys must be generated client-side and persisted across re-renders (via `useRef`) to prevent duplicate orders on form re-submission. Liquid templates regenerate on every request; there is no mechanism to persist client-generated UUIDs across renders.

**3. COD order flow (lines 424–442):** Even COD requires: reading the browser cart, building a multi-field form payload, calling `POST /api/orders`, and handling success/failure inline. The inline success screen (`isSuccess` state) means checkout and confirmation are a single React session — no navigation, no page reload.

**4. Real-time shipping rate fetch (lines 213–245):** Shipping rates depend on `cartTotal` which is browser-owned. The shipping rates API is called with `subtotal_minor` computed from the live cart state. Liquid SSR does not know the cart contents at render time; the shipping rate widget must be a JS island regardless.

**5. Coupon validation (lines 366–405):** The coupon discount is applied to the order summary sidebar in real time. If coupon validation required a page reload, users would lose form data. This requires React state.

**6. Multi-step form without page navigation (lines 156, 328, 676–898):** The two-step flow (Address → Payment) transitions without navigation; `step` state is incremented in memory. A native HTML multi-page form would reload between steps, losing form data.

**Summary:** The checkout process is a payment-critical flow with at least 6 independent reasons it must remain React. No Liquid hydration island architecture can substitute for the Razorpay SDK callback pattern without fundamentally breaking the payment integration.

---

## Islands as the Bridge

The `liquid-hydration-islands.tsx` component mounts a set of custom elements after Liquid HTML is painted:

**Already covered by existing islands:**
- `lb-cart-drawer` — reads browser cart from localStorage/gateway, renders cart item count in header, opens cart drawer.
- `lb-customer-auth` — reads customer session from cookies, renders login/logout state in header.
- `lb-wishlist` — reads wishlist from context/storage.
- `lb-theme-editor-bridge` — listens for `postMessage` from the editor iframe parent and highlights sections.

**Gaps that need new islands for full migration:**
- `lb-add-to-cart` — needed for product detail and product grid add-to-cart buttons.
- `lb-variant-selector` — needed for product detail variant selection (price/stock update without reload).
- `lb-cart` (full CRUD) — needed for the cart page (remove item, update quantity, clear cart).
- `lb-wishlist-toggle` — needed for wishlist add/remove on product pages.
- `lb-address-manager` — needed for the addresses CRUD page.
- `lb-password-toggle` — trivial; needed for the settings password form.
- `lb-newsletter-signup` — needed for the newsletter section form submission.

The island architecture is sound. The gap between current islands (header/auth/cart-count) and full storefront migration is the set of interactive section islands above.

---

## React Components That Cannot Be Liquid

These are specific React patterns from the codebase that are fundamentally incompatible with server-side Liquid rendering:

| Component | Pattern | Why Not Liquid |
|-----------|---------|----------------|
| `checkout-client.tsx` `handlePayment()` | `new window.Razorpay(options); rzp.on('payment.failed', ...); rzp.open()` | Imperative third-party SDK; callback receives async payment tokens from Razorpay servers |
| `checkout-client.tsx` `idempotencyKeysRef` | `useRef` with `crypto.randomUUID()` | Browser-only UUID; must persist across re-renders without state reset |
| `checkout-client.tsx` shipping rates `useEffect` | `fetch('/api/shipping/rates', { body: JSON.stringify({ subtotal_minor }) })` | Cart total is browser-only at checkout time; rates must be fetched client-side |
| `product-details-client.tsx` variant selection | `resolveMatchingVariant()` + `useState(selectedVariants)` → reactive `displayPrice`/`displayStock` | Derived price computation from selected options is a pure client-side reactive pattern |
| `checkout-client.tsx` inline success | `setIsSuccess(true)` → renders success screen in same component | Avoids navigation loss of cart clear; Liquid would require a separate success page |
| `addresses-client.tsx` CRUD modal | `useState(showForm)` + `fixed inset-0` modal | Portal-style modal with controlled CRUD state |
| `CenterPanel.tsx` (admin) | `useRef(iframeRef)`, `postMessage` to iframe | Cross-origin iframe communication; admin-only |

---

## Recommended Migration Order

### Phase A — Already Done
- Home page (Liquid-capable via `rendererEngine === 'liquid'` branch in `composition-engine.tsx`)
- Product detail display (Liquid drop includes all product fields)
- Collection/products/shop listing (Liquid collection drop with products array)
- Account pages: dashboard, orders list, order detail, wishlist — all have `resolveAccountLiquid` dual-path

### Phase B — Quick Wins (low effort, low risk)
1. **Policy pages** (`/privacy`, `/terms`, `/shipping`, `/returns`) — static content, `page` Liquid template, no islands needed
2. **Blog** (`/blog/[slug]`) — static article content, `article` Liquid template
3. **Catch-all custom pages** (`/[...path]`) — same as policy pages
4. **Checkout success stub** — convert to server-side redirect (1 file change)

### Phase C — Medium Effort (needs islands)
1. **Cart page** — build `lb-cart` island with full CRUD (remove, update qty, clear)
2. **Product detail interactive layer** — build `lb-variant-selector` + `lb-add-to-cart` islands
3. **Product grid add-to-cart** — `lb-product-card` island or accept navigation-only cards
4. **Wishlist toggle** — `lb-wishlist-toggle` island on product pages
5. **Newsletter section** — `lb-newsletter-signup` island
6. **Account settings** — `lb-password-toggle` island (trivial) + form island for profile/password submit
7. **Account wishlist** — already better in Liquid; complete the Liquid template

### Phase D — Hard (complex CRUD, needs significant island work)
1. **Account addresses** — `lb-address-manager` island: full CRUD modal with fetch, optimistic UI

### Phase E — Do Not Migrate
1. **Checkout** (`/checkout`) — permanent React. Payment SDK callbacks, idempotency keys, multi-step form, COD flow, and inline success screen are all fundamentally React-only.
2. **Merchant-control-plane** (theme editor, settings, dashboard) — these are React SPAs and must remain React.
3. **Editor preview chrome** (CenterPanel, section list, settings panel) — cross-origin postMessage requires React.

---

## Effort Estimates

| Route | Current | Target | Effort | Blocker |
|-------|---------|--------|--------|---------|
| Home (`/`) | Hybrid | Liquid | None (done) | — |
| Product detail (`/product/[id]`) | Hybrid | Liquid + islands | Medium | `lb-variant-selector`, `lb-add-to-cart` |
| Collection (`/collections/[slug]`) | Hybrid | Liquid | Low | `lb-add-to-cart` on grid cards (optional) |
| Products list (`/products`) | Hybrid | Liquid | Low | Same as collection |
| Shop (`/shop`) | Hybrid | Liquid | Low | Same as collection |
| Cart (`/cart`) | Hybrid | Liquid + island | Medium | `lb-cart` CRUD island |
| Checkout (`/checkout`) | React-only | KEEP REACT | N/A | Payment SDK, COD, idempotency |
| Checkout success (`/checkout/success`) | React | Server redirect | Trivial | — |
| Account dashboard (`/account`) | Hybrid | Liquid | None (done) | — |
| Account orders (`/account/orders`) | Hybrid | Liquid | None (done) | `<details>` accordion in template |
| Account order detail (`/account/orders/[id]`) | Hybrid | Liquid | None (done) | — |
| Account settings (`/account/settings`) | Hybrid | Liquid + island | Medium | `lb-password-toggle`, form handling |
| Account wishlist (`/account/wishlist`) | Hybrid | Liquid | Low | Complete Liquid template |
| Account addresses (`/account/addresses`) | Hybrid | Liquid + island | High | `lb-address-manager` full CRUD modal |
| Privacy policy (`/privacy`) | Hybrid | Liquid | Low | `page` template |
| Terms (`/terms`) | Hybrid | Liquid | Low | `page` template |
| Shipping (`/shipping`) | Hybrid | Liquid | Low | `page` template |
| Returns (`/returns`) | Hybrid | Liquid | Low | `page` template |
| Blog post (`/blog/[slug]`) | Hybrid | Liquid | Low | `article` template |
| Catch-all (`/[...path]`) | Hybrid | Liquid | Low | `page` template |

---

## Summary Verdict

- **Total routes analyzed:** 20
- **Already Liquid (dual-path, Liquid engine active for Liquid themes):** 9 (45%) — home, product, collections, products, shop, account dashboard, account orders, account order detail, account wishlist
- **Can become Liquid (feasible with islands or template work):** 9 (45%) — cart, checkout-success, account settings, account addresses, privacy, terms, shipping, returns, blog, catch-all (10 routes counting all policy variants; 9 distinct route groups)
- **Cannot become Liquid (justified — checkout only):** 1 (5%) — `/checkout`
- **Admin (out of scope, must stay React):** merchant-control-plane routes (not counted)

**Estimated effort to reach 90% Liquid storefront (excluding checkout):**
- Phase B (policy/blog/static pages): 1–2 days — template work only, no new islands
- Phase C (cart page, product detail, wishlist, newsletter, account settings): 2–3 weeks — requires 5–6 new hydration islands with gateway API integration
- Phase D (addresses CRUD): 1 week — complex modal island
- **Total:** approximately 4–5 engineering weeks to retire the React storefront fallback for all non-checkout routes across all themes.

The checkout route (`/checkout`) accounts for the remaining ~5% and must remain React permanently. The Razorpay SDK callback pattern, idempotency key management, and real-time cart-dependent shipping rate fetching collectively make this the correct and safest architectural boundary.
