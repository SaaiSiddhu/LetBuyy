# Storefront React Dependency Inventory (Post-Slice-7)

**Type:** Research / certification — no implementation. **Date:** 2026-06-16.
**Classification:** **BLOCKER** = no Liquid path; removing React breaks a core commerce surface · **HIGH** = default render path / needs parity + Liquid-default · **MEDIUM** = has a Liquid analogue but template/drop/island gaps · **LOW** = tooling / Liquid runtime (not a removal target).

---

## 1. React-only surfaces (sole renderer — must be built in Liquid before removal)

| # | Surface | File / route | Why React still required | Liquid replacement available? | Missing | Class |
|---|---|---|---|:--:|---|:--:|
| 1 | **Checkout** | `checkout/checkout-client.tsx` · `/checkout` | Razorpay SDK + COD client flow; signed handoff | partial (cart→`checkout_url` exists) | template + `lb-checkout-payment` island | **BLOCKER** |
| 2 | Checkout success / paypal-return | `checkout/success`, `checkout/paypal-return` | order confirmation UI | no | template + drop | **BLOCKER** |
| 3 | **Account settings** | `account/settings/page.tsx` | profile display/edit (`updateCustomerProfile`) | drop ready (`customer.*`) | `customers/settings` template + `customer-settings` section | **MEDIUM** |
| 4 | **Account wishlist** | `account/wishlist/page.tsx` | wishlist product grid | drop partial (`customer.wishlist` ids) | `customers/wishlist` template + section + product fetch | **MEDIUM** |
| 5 | **Account addresses** | `account/addresses/page.tsx` | address list + edit | drop partial (`default_address` only) | `customers/addresses` template + `customer.addresses` list drop | **MEDIUM** |
| 6 | **Guest order lookup** | `orders/page.tsx` · `/orders` | guest order-by-contact | backend exists (`orderContactSummary`) | template + drop + route wiring | **MEDIUM** |
| 7 | **CMS pages** | `content-resource-renderer.tsx` · `/[...path]` | CMS page render | no | `page` template + content drop | **MEDIUM** |
| 8 | **Blog** | `blog/[slug]/page.tsx` | article render | no | `blog`/`article` templates + drops | **MEDIUM** |
| 9 | **Policy pages** | `privacy/terms/shipping/returns` | static policy render | no | `policy` template (low complexity) | **LOW** |
| 10 | **Order detail** | (no route) | `customer-order-detail` section dormant | template exists, no route | `/account/orders/[id]` route + drop | **MEDIUM** |
| 11 | **Search** | none | no search backend | no | search endpoint + template + drops | **BLOCKER (backend)** |

## 2. React render path (default; needs parity + Liquid-default before removal)

| # | Surface | File | Role | Class |
|---|---|---|---|:--:|
| 12 | React section registry (~20 renderers) | `lib/theme-engine/renderer-registry.tsx` | default render path when Liquid off | **HIGH** |
| 13 | 19 React section components | `components/sections/*.tsx` | catalog sections | **HIGH** |
| 14 | React layout chrome | `app/store/[subdomain]/layout.tsx:218,245` | `liquidPage ? children : <React chrome>` | **HIGH** |
| 15 | React composition fallback | `composition-engine.tsx` `RenderSectionList` | render when Liquid bundle absent | **HIGH** |
| 16 | Product details client | `product/[productId]/product-details-client.tsx` | React product interactivity | **HIGH** |

## 3. React fallback pages (Liquid-branched routes; deletable only after Liquid is default + proven)

| # | Surface | File | Class |
|---|---|---|:--:|
| 17 | Cart React fallback | `cart/cart-client.tsx` | MEDIUM |
| 18 | Orders React fallback | `account/orders/orders-client.tsx` | MEDIUM |
| 19 | Account React chrome | `account/account-chrome-client.tsx` (slice 7) | MEDIUM |
| 20 | React state contexts | `context/{cart,customer-auth,wishlist}-context.tsx` | HIGH (cart/auth), MEDIUM (wishlist) |

## 4. NOT removal targets (Liquid runtime + tooling)

| Surface | File | Note |
|---|---|---|
| Liquid hydration islands (7) | `lib/theme-engine/liquid-hydration-islands.tsx` | the Liquid interactivity runtime — **keep** |
| Editor + preview frame | merchant-control-plane editor; `editor-preview-section-frame.tsx` | merchant tooling — **keep** |
| Turnstile widget | `components/security/turnstile-widget.tsx` | React; mirrored by `lb-review-form` island |

---

## 5. Roll-up

- **BLOCKER (3):** checkout (+success), search backend.
- **HIGH (6):** React registry + components + chrome + composition fallback + product-details-client + cart/auth contexts.
- **MEDIUM (9):** account settings/wishlist/addresses, guest orders, CMS, blog, order detail, cart/orders/account React fallbacks.
- **LOW (2):** policy pages, Liquid islands (keep).

**React dependency ≈ 48%** of customer-facing surfaces (13 React-only routes + the default-path registry + fallbacks). React is **not deletable** — see [STORE_FRONT_REACT_REMOVAL_PLAN.md](STORE_FRONT_REACT_REMOVAL_PLAN.md).
