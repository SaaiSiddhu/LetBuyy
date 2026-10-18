# Storefront Connectivity Matrix (V1)

**Type:** Research / certification — no code changes. **Date:** 2026-06-16.
**Legend:** ✅ CONNECTED (code path wired end-to-end) · 🟡 PARTIAL · ❌ DISCONNECTED/ABSENT · — N/A.
**Reminder:** "CONNECTED" = the source code path reaches the gateway/DB. It is **not** a runtime proof — **0/13 live providers are connected** (`graphify-out/connections-intel.json`); no order/payment was executed. Parent: [STOREFRONT_CERTIFICATION_AUDIT.md](STOREFRONT_CERTIFICATION_AUDIT.md).

---

## 1. Pipeline matrix — Merchant feature → DB → API (gateway) → Theme Engine → Storefront → Checkout → Orders

| Merchant feature | DB | API/Gateway | Theme Engine | Storefront | Checkout | Orders | Overall |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Store identity / settings | ✅ `sites` | ✅ `storefront.getStore` | ✅ `mapSupabaseToStore` | ✅ `[subdomain]/page.tsx` | — | — | ✅ |
| Appearance (color/font/radius/logo) | ✅ `site_settings` | ✅ store payload | ✅ LB-9 bridge `store-service.ts:576-605` | ✅ `:root` tokens (layout) | — | — | ✅ |
| Theme (sections/settings) | ✅ `theme_releases`/`store_themes` | ✅ release snapshot | ✅ `template-resolver.ts` | ✅ composition engine | — | — | ✅ |
| Theme editor → publish | ✅ `theme_*` tables | ✅ `publish_theme_release` RPC `theme-execution.adapter.ts:669` | ✅ release snapshot | ✅ reads `current_theme_release` | — | — | ✅ |
| Theme rollback | ✅ `theme_releases` | ✅ `rollbackRelease` `:1416` | ✅ | ✅ | — | — | ✅ |
| Products | ✅ `products`/`product_variants` | ✅ `storefront.listProducts/getProduct` | ✅ product sections | ✅ product/products pages | — | — | ✅ |
| Variants / pricing | ✅ `product_variants` | ✅ product payload | ✅ `productToLiquidDrop` `composition-engine.tsx:229-251` | ✅ `product-service.ts:111-136` | ✅ variant price → cart | — | ✅ |
| Product media | ✅ `images` | ✅ payload | ✅ section images | ✅ `normalizeImages` `:97-109` | — | — | ✅ |
| Inventory (storefront read) | ✅ `stock_quantity` | ✅ payload | 🟡 | 🟡 default **999** `product-service.ts:126`, `cart-context.tsx:92` | 🟡 server-authoritative at order | ✅ reservation in RPC | 🟡 |
| Collections | ✅ `collections`/`collection_products` | ✅ `getCollectionWithProducts` | ✅ collection render | ✅ `collections/[slug]/page.tsx` | — | — | ✅ |
| Collection filter/sort/search | — | ❌ none | ❌ | ❌ not implemented | — | — | ❌ |
| Storefront search | — | ❌ search-service reserved | ❌ | ❌ no route | — | — | ❌ |
| Navigation menus | ✅ nav tables | ✅ `storefront.navigation` | ✅ header/footer | ✅ `fetchWorkerNavigationBundle` `:485-493` | — | — | ✅ |
| CMS pages / blog | ✅ `storefront_pages`/`blog_*` | ✅ `ContentService` | ✅ `ContentResourceRenderer` | ✅ `[...path]/page.tsx` | — | — | ✅ |
| Cart | ✅ `carts` | ✅ `/cart` POST/PATCH | 🟡 Liquid cart drop | 🟡 localStorage + sync, client totals `cart-context.tsx:241` | ✅ feeds checkout | — | 🟡 |
| Checkout (COD) | ✅ `orders`/`checkout_sessions` | ✅ `create_checkout_order` RPC | — | ✅ `CheckoutClient` | ✅ COD server-confirmed `checkout-client.tsx:427,1039` | ✅ | ✅ |
| Checkout (Razorpay) | ✅ `payment_*`/`ledger_*` | ✅ `/payments/razorpay/order`+`/verify` | — | ✅ widget | ✅ signature verify `checkout-client.tsx:494-505` | ✅ | ✅ (live unverified) |
| Coupons / discounts | ✅ discount tables | ✅ `api/coupons/validate/route.ts` | — | ✅ validate route | ✅ applied at order | ✅ | ✅ |
| Shipping rates | ✅ `shipping_rates` | ✅ `api/shipping/rates/route.ts` | — | ✅ | ✅ at order | ✅ | ✅ |
| GST / tax | ✅ gst tables | ✅ server-computed in RPC | — | 🟡 not shown at cart | ✅ server-authoritative | ✅ invoice | 🟡 |
| Orders pipeline | ✅ `orders`/`order_items` | ✅ gateway-owned `order-service.ts:3` | — | ✅ read-only | ✅ | ✅ create→confirm→fulfil | ✅ |
| Order tracking / fulfillment | ✅ `tracking_number` | ✅ order payload | — | ✅ account/orders | — | ✅ `order-service.ts:152-155` | ✅ |
| Customer register/login | ✅ `store_customers`/`customer_credentials` | ✅ `verifyCustomerPassword`; guest auto-create derives fields from a tenant-scoped order | — | ✅ Commerce customer service | ✅ order-bound guest auto-create | ✅ | ✅ |
| Customer profile/addresses | ✅ `customer_addresses` | ✅ `customerAddresses`/`createCustomerAddress` | — | ✅ account pages | ✅ ship-to | — | ✅ |
| Customer order history | ✅ `orders` | ✅ `customerOrders` `:230` | — | ✅ `account/orders` | — | ✅ | ✅ |
| Wishlist | ✅ `wishlists`/`customer_wishlists` | ✅ wishlist CRUD `:169-224` | — | ✅ `wishlist-context.tsx` | — | — | ✅ |
| Reviews | ✅ `product_reviews` | ✅ `storefront.productReviews` | — | ✅ `api/reviews/route.ts` (demo gated `:52`) | — | — | ✅ |
| Custom domains / redirects | ✅ `site_domains` | ✅ `custom-domains.ts`/`vercel-domains.ts` | — | ✅ `proxy.ts:259-285` | — | — | ✅ |
| SSL / certificates | — | ✅ provider (Vercel) | — | 🟡 provider-managed | — | — | 🟡 |
| Email notifications | ✅ outbox | ✅ `order-confirmation-email.ts` + `sendResendEmail` | — | — | ✅ trigger on order | ✅ | ✅ (Resend NOT CONNECTED) |
| Storefront analytics / funnel | ✅ `analytics_events` | 🟡 server-side only | — | ❌ no client emission | — | 🟡 order events | ❌ |
| Marketplace app blocks | ✅ `app_blocks` | ✅ store payload | ✅ `injectAppBlocksIntoSections` `:208` | ✅ app-block-slot | — | — | ✅ |
| Liquid-only rendering | ✅ bundle schema | ✅ release engine flag | 🟡 real but OFF default `theme-governance.ts:14` | 🟡 React fallback | — | — | 🟡 |

---

## 2. Roll-up by status

**✅ CONNECTED (21):** store identity, appearance, theme settings, theme publish, theme rollback, products, variants/pricing, media, collections, navigation, CMS/blog, COD checkout, Razorpay checkout, coupons, shipping rates, orders pipeline, fulfillment/tracking, customer auth, profile/addresses, order history, wishlist, reviews, custom domains, marketplace app blocks, email (live-pending).

**🟡 PARTIAL (6):** inventory (999 default), cart (client totals), GST (not shown pre-order), SSL (provider-managed), Liquid-only rendering (off by default), server analytics (no client funnel).

**❌ DISCONNECTED / ABSENT (3):** storefront **search**, collection **filter/sort**, storefront **client analytics / funnel**.

---

## 3. The two backbones that make most rows ✅

1. **Gateway client** (`apps/storefront-runtime/src/lib/api/client.ts:95-106`) — every `storefront.*` call routes through `@letbuyy/api-client` to the resolved canonical gateway base URL, with customer-session forwarding (`:46-52`) and HMAC-signed internal paths (`:69-93`). This is real, not a mock layer.
2. **Canonical RPCs at the gateway** — orders via `db.rpc('create_checkout_order')` (`services/api-gateway/src/execution/order-execution.adapter.ts:158`), themes via `db.rpc('publish_theme_release')` (`theme-execution.adapter.ts:669`). Money/theme mutations go through SECURITY DEFINER RPCs, consistent with the canonical-ledger rule.

## 4. The weak joints (where the matrix is not green)

- **Search & collection filtering** — absent end-to-end (no DB query path, no API, no UI).
- **Storefront client analytics** — the runtime emits no behavioral events, so the merchant dashboard has no storefront funnel even though the DB/rollup layer exists.
- **Inventory at read** — `999` defaults mask out-of-stock at the storefront read layer (true enforcement happens server-side in the order RPC).
- **Liquid path** — wired but off; the demo-fixture bundle is the fallback.
- **Live integrations** — Razorpay / Supabase / Resend / Turnstile all **NOT CONNECTED** from the repo (deploy-time secrets), so none of the ✅ rows are runtime-proven.

See remediation in [STORE_FRONT_PRODUCTION_GAPS.md](STORE_FRONT_PRODUCTION_GAPS.md).
