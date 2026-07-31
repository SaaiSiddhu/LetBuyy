# Storefront Route Matrix (Post-Slice-7)

**Type:** Research / certification — no implementation. **Date:** 2026-06-16. Source: `apps/storefront-runtime/src/app/store/[subdomain]/**`.
Legend — **React**: has a React renderer. **Liquid**: branches to the composition engine when the theme is Liquid (`rendererEngine === 'liquid'`). **Hybrid**: both (Liquid-when-enabled, React fallback). **TB**: Liquid template-backed. **Editor**: theme-editor-composable (section-based).

---

## 1. Route matrix (21 routes)

| Route | Exists | React | Liquid | Hybrid | Cust-facing | TB | Editor | Status |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `/` (home) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ index | ✅ | **Complete (hybrid)** |
| `/products` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ index | ✅ | **Complete (hybrid)** |
| `/shop` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ index | ✅ | **Complete (hybrid)** |
| `/product/[productId]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ product | ✅ | **Complete (hybrid)** |
| `/collections/[slug]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ collection | ✅ | **Complete (hybrid)** |
| `/cart` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ cart (slice 6) | ✅ | **Complete (hybrid)** |
| `/account` (dashboard) | ✅ | redirect | ✅ | partial | ✅ | ✅ customers/account (slice 7) | ✅ | **Liquid-active** |
| `/account/orders` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ customers/orders (slice 7) | ✅ | **Complete (hybrid)** |
| `/account/settings` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only** |
| `/account/wishlist` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only** |
| `/account/addresses` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only** |
| `/checkout` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only (Razorpay island)** |
| `/checkout/success` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only** |
| `/checkout/paypal-return` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only (deferred)** |
| `/orders` (guest lookup) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only** |
| `/[...path]` (CMS pages) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ (ContentResourceRenderer) | ❌ | **React-only** |
| `/blog/[slug]` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only** |
| `/privacy` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only (policy)** |
| `/terms` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only (policy)** |
| `/shipping` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only (policy)** |
| `/returns` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | **React-only (policy)** |

> Layouts (not routes): `[subdomain]/layout.tsx` (Liquid-aware store chrome), `account/layout.tsx` (slice-7 server router → Liquid pass-through / React `AccountChromeClient`), `cart/layout.tsx` (metadata).

---

## 2. Coverage roll-up

- **Liquid-capable routes (8):** `/`, `/products`, `/shop`, `/product/[id]`, `/collections/[slug]`, `/cart`, `/account`, `/account/orders`.
- **React-only routes (13):** account settings/wishlist/addresses, checkout (×3), guest `/orders`, CMS `[...path]`, blog, 4 policy pages.
- **Route coverage = 8 / 21 ≈ 38%.**

| Category | Liquid | React-only | % Liquid |
|---|:--:|:--:|:--:|
| Catalog/browse (5) | 5 | 0 | 100% |
| Cart (1) | 1 | 0 | 100% |
| Account (5) | 2 | 3 | 40% |
| Checkout (3) | 0 | 3 | 0% |
| Orders guest (1) | 0 | 1 | 0% |
| Content/CMS (2) | 0 | 2 | 0% |
| Policies (4) | 0 | 4 | 0% |

---

## 3. Notes
- **"Hybrid" routes** render Liquid only when the store's theme opts in (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`, per-theme `liquidRenderingCanary`); otherwise React. So today, with Liquid off by default, **all routes render React in production** unless a theme enables Liquid (only Urban Kicks ships a bundle).
- **`/account` dashboard** has no React page; the React branch redirects to `/account/orders` (the existing entry).
- **Order detail** (`/account/orders/[id]`) does **not exist** as a route — the `customers/order` template + `customer-order-detail` section are **dormant** (no invoking route).
- Theme-editor compatibility = the Liquid section model; React-only routes are not editor-composable.
