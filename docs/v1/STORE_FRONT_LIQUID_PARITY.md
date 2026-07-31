# Storefront Liquid Parity — Templates, Sections, Drops, Islands (Post-Slice-7)

**Type:** Research / certification — no implementation. **Date:** 2026-06-16. Source: `packages/theme-engine/src/theme-bundle.ts`, `theme-renderer.ts`, `apps/storefront-runtime/src/lib`.

---

## PHASE 5 — Template Inventory

### Page templates that EXIST (10)
| Template | Routed by | Status |
|---|---|---|
| `index` | `/`, `/products`, `/shop` | ✅ routed |
| `product` | `/product/[id]` | ✅ routed |
| `collection` | `/collections/[slug]` | ✅ routed |
| `cart` | `/cart` (slice 6) | ✅ routed |
| `customers/account` | `/account` (slice 7) | ✅ routed |
| `customers/orders` | `/account/orders` (slice 7) | ✅ routed |
| `search` | — | ⚠️ **dormant** (no search route/backend) |
| `customers/login` | — | ⚠️ **dormant** (no `/customers/login` route) |
| `customers/register` | — | ⚠️ **dormant** |
| `customers/order` (detail) | — | ⚠️ **dormant** (no `/account/orders/[id]` route) |

### Templates MISSING (needed for parity, ~8)
`customers/settings`, `customers/wishlist`, `customers/addresses`, `page` (CMS), `blog`, `article`, `policy`, `404`, `checkout` (shell).

**Template coverage: 6 routed / ~18 needed ≈ 33%** (10 exist, 4 dormant, ~8 missing).

---

## PHASE 5 — Section Inventory (32 sections via `createLiquidSectionFile`)

| Group | Sections present | Missing |
|---|---|---|
| Chrome | header, footer, announcement-bar | — |
| Catalog | hero-banner, banner-carousel, marquee, product-grid, **product-detail**, featured-products, category-grid, brand-marquee, trust-badges | — |
| Content | rich-content, about-section, testimonials, cta-section, contact-form, newsletter-signup | faq, instagram, video-hero |
| Portfolio | portfolio-grid, skills-section, services-grid, experience-timeline | — |
| Apps | app-block-slot | — |
| **Customer** | customer-account, customer-orders, customer-order-detail, customer-login, customer-register | **customer-settings, customer-wishlist, customer-addresses, customer-forgot-password** |
| Cart | cart-summary | — |
| **Discovery** | (search-box / collection-product-list present in bundle) | **reviews (standalone), recommendations, recently-viewed, collection-filter/sort** |

**React-only section types** (no Liquid equivalent): `collectionFilter` (schema only, no renderer in either engine), recommendations, recently-viewed.

---

## PHASE 6 — Data Drop Audit (Shopify parity)

| Drop | Fields present | Source | Missing vs Shopify | Parity |
|---|---|---|---|:--:|
| **product** | id, handle, title, description, price, compare_at_price, currency, url, featured_image, images, available, stock, tags, variants, options, **rating, review_count, reviews** (s1), **in_wishlist** (s4) | gateway `listProducts/getProduct` + reviews | price_min/max, vendor, type, media(video), metafields, collections, selling_plan | **75%** |
| **collection** | id, handle, title, description, products | gateway `getCollectionWithProducts` | image, products_count, **filters, sort_options**, paginate | **50%** |
| **cart** | item_count, items, **subtotal, discount_total, shipping_total, tax_total, total/total_price, coupon_codes** (s5), currency, checkout_url (signed) | gateway `/cart` (verbatim) | note, attributes, requires_shipping | **80%** |
| **customer** | id, name, email, phone, tags, total_orders, total_spent, accepts_marketing, default_address (s3), wishlist (s4), orders (s7, route-scoped) | session + `getCustomerByEmail`/`Orders`/`Wishlist` | addresses (plural list), first/last name, has_account | **75%** |
| **order** | id, number, status, total, currency, created_at (list); +line_items/timeline/tracking (detail template, dormant) | `getCustomerOrders` | financial/fulfillment_status, billing_address, line_items on list, refunds | **50%** |
| **shop** | id, name, subdomain, url, locale, currency | store-service | description, policies, money_format, address | **70%** |
| **navigation** | main/footer/policies menus | gateway `navigation` | — | **85%** |
| **settings** | theme settings (color/font/radius/logo) | release + LB-9 appearance | typed schema completeness | **80%** |
| **wishlist** | product_ids[] | `getCustomerWishlist` | **wishlist products** (enriched) | **50%** |
| **reviews** | rating, title, body, images, author, is_verified, helpful_count, created_at | `productReviews` | reply, rating distribution on product | **85%** |

**Average drop parity ≈ 68%.** Money is **always backend-verbatim** (no Liquid/island money calc — verified in slices 5,6).

---

## PHASE 7 — Hydration Island Audit (7 islands)

| Island | Registered | Sanitizer allowlist | Tests | Runtime path |
|---|:--:|:--:|:--:|---|
| `lb-add-to-cart` | ✅ `:1029` | ✅ | ✅ | product-grid/detail |
| `lb-cart-drawer` | ✅ `:1030` | ✅ | ✅ | header / appended |
| `lb-search` | ✅ `:1031` | ✅ | ✅ | header (posts to `/shop?search=` — **dead end**) |
| `lb-variant-picker` | ✅ `:1032` | ✅ | ✅ | product-detail |
| `lb-review-form` | ✅ `:1033` (s2) | ✅ (s6 fix) | parity | product-detail |
| `lb-wishlist-toggle` | ✅ `:1034` (s4) | ✅ (s6 fix) | parity | product-grid/detail |
| `lb-cart` | ✅ `:1035` (s6) | ✅ | parity | cart page |

**All 7 registered + sanitizer-allowlisted** (`LIQUID_HYDRATION_CUSTOM_ELEMENTS`, `theme-renderer.ts:107-115` — slice-6 fix confirmed). 
**Missing islands (needed):** `lb-checkout-payment` (checkout), `lb-customer-auth` (login/register/forgot), `lb-address-manager` (addresses), `lb-wishlist` (wishlist page grid), `lb-analytics` (funnel events), `lb-search-results` (search). `lb-search` exists but its destination performs no search.

---

## Parity summary

| Dimension | Coverage |
|---|:--:|
| Templates routed | 33% (6/~18) |
| Sections (catalog) | ~95% · (customer/discovery) ~50% |
| Drops (avg Shopify parity) | ~68% |
| Islands (built/needed) | 7 / ~13 ≈ 54% |
| **Overall Liquid parity** | **≈ 52%** |
