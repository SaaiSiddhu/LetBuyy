# Storefront UX Certification (Post-Slice-7)

**Type:** Research / certification — no implementation. **Date:** 2026-06-16. Static source audit; runtime UNVERIFIED (0/13 live).

---

## PHASE 3 — Customer Experience Audit

| Capability | Current impl | Liquid support | Backend support | Missing |
|---|---|:--:|:--:|---|
| Authentication (session) | HS256 customer cookie, `getSession` | ✅ (drop resolve) | ✅ | — |
| Registration | React + `customers/register` template | ⚠️ template dormant | ✅ `findOrCreateCustomer` | route + `lb-customer-auth` island |
| Login | React `customer-auth-context` + `customers/login` template | ⚠️ template dormant | ✅ `verifyCustomerPassword`+Turnstile | route + island |
| Forgot password | React | ❌ no Liquid template | ✅ `request/confirmCustomerPasswordReset` | template + island |
| Addresses | React `account/addresses` | ❌ | ✅ `customerAddresses` CRUD | `customers/addresses` template + `customer.addresses` drop |
| Wishlist | React page + `lb-wishlist-toggle` (Liquid) | 🟡 toggle only | ✅ `customerWishlist` | `customers/wishlist` template + product enrichment |
| Orders (history) | **Liquid** `customers/orders` (slice 7) + React | ✅ | ✅ `getCustomerOrders` | order **detail** route |
| Profile | = settings (no separate profile) | ❌ | ✅ `updateCustomerProfile` | `customers/settings` template |
| Settings | React `account/settings` | ❌ | ✅ | `customers/settings` template |

**Customer parity ≈ 45%** (auth + orders Liquid; registration/login templates dormant; settings/wishlist/addresses/forgot React-only).

---

## PHASE 4 — Commerce Experience Audit

| Capability | Status | Evidence |
|---|:--:|---|
| Storefront (home/landing) | ✅ Implemented (Liquid) | index template + sections |
| Collections | ✅ Implemented (Liquid) | `getCollectionWithProducts` |
| **Search** | ❌ **Missing** | no storefront search endpoint (gateway `/search` = domains/admin only); `lb-search` posts to `/shop?search=` which is ignored |
| Filters | ❌ Missing | `collectionFilter` schema has no renderer |
| Sort | ❌ Missing | collection page has no sort |
| Recommendations | ❌ Missing | no engine/endpoint/section |
| Reviews | ✅ Implemented (read+write, Liquid) | slices 1,2 |
| Recently viewed | ❌ Missing | no storage/section |
| Cart | ✅ Implemented (Liquid, backend totals) | slices 5,6 |
| Checkout | 🟡 Partial | React + Razorpay island (server-authoritative); not Liquid |
| Order tracking | 🟡 Partial | tracking on order detail (dormant); guest `/orders` React |

**Commerce parity ≈ 55%** (catalog+cart+reviews done; search/filter/sort/recommendations/recently-viewed absent; checkout React).

---

## PHASE 9 — Customer Journey UX Scores

Scores are **structural** (code presence + correctness), not runtime-measured.

| Journey step | UI | UX | Perf | Trust | Conversion | Notes / weaknesses |
|---|:--:|:--:|:--:|:--:|:--:|---|
| Landing (home) | 8 | 8 | 7 | 8 | 7 | Liquid hero/featured; demo-theme default identity |
| Collection | 7 | 6 | 7 | 8 | 6 | **no filters/sort/pagination** → poor at scale |
| Product | 8 | 8 | 7 | 8 | 7 | reviews + variant + wishlist + add-to-cart islands |
| Add to cart | 8 | 8 | 8 | 8 | 8 | island + server sync |
| Cart | 8 | 7 | 7 | 8 | 7 | **backend totals (GST/shipping)**; item line-price omitted in Liquid page |
| Checkout | 7 | 7 | 7 | 9 | 7 | React + Razorpay; **signed handoff**; not Liquid |
| Order success | 6 | 6 | 7 | 8 | 6 | React; minimal |
| Account | 6 | 6 | 7 | 7 | 6 | dashboard+orders Liquid; settings/wishlist/addresses React (no chrome on Liquid stores) |

**Weakest links (exact):**
1. **Collection has no search/filter/sort/pagination** — the single biggest UX/conversion gap (browse breaks at >~50 products).
2. **No storefront search** — shoppers cannot find products.
3. **No recommendations / recently-viewed** — no cross-sell/upsell.
4. **Account settings/wishlist/addresses render without account chrome on a Liquid store** (slice-7 layout pass-through; templates not yet built).
5. **No client analytics** → no funnel/conversion measurement.
6. **Checkout is React-only** (acceptable — even Shopify checkout isn't Liquid), but order-success UX is thin.

---

## Trust & integrity (strong points)
- Money is **server-authoritative everywhere** (cart/checkout/orders) — no client money math (verified slices 5,6).
- Checkout uses **signed handoff** + Razorpay signature verify + idempotency (preserved through slice 6).
- Sanitizer (DOMPurify) locked; all islands allowlisted (slice-6 fix).
- Tenant-safe customer drop (session storeId match, slice 3).
