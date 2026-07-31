# REACT_EXTRACTION_PLAN.md

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · file-level, code-cited. Classification for Full-Liquid target: **KEEP-TEMP** (compatibility fast-path per ART-17, frozen, deleted at hardening wave) · **MIGRATE** (reimplement as Liquid) · **DELETE** (only after parity proof + the hardening-wave data decision). Lines via `wc -l`.

> ART-17 forbids deleting React "before the data decision at the hardening wave." So nothing here is DELETE-now; the React storefront render layer is **KEEP-TEMP → frozen at parity → DELETE at L17 after `REACT_DELETION_EXECUTION_PLAN.md` proof gates pass.** No new React-per-section capability may be added (ART-17 forbids).

## 1. Section render layer — MIGRATE → (KEEP-TEMP frozen) → DELETE@L17

| Artifact | Files | Lines | APIs/hooks/contexts | Tests/validator locks |
|---|---|---|---|---|
| 20 React sections | `apps/storefront-runtime/src/components/sections/*.tsx` | 2,604 | data via `data-binding-engine.ts`→`ProductService` | `no-new-react-sections-validator.mjs:9-30` (frozen Set); `theme-governance-validator.mjs:69-72,98-101` (parity==20 + count==20); `phase-b-validators.test.mjs:108-113` |
| Registry + React branch | `renderer-registry.tsx` (276), `composition-engine.tsx` React branch `RenderSectionList`, `editor-preview-section-frame.tsx` (93) | — | — | `theme-governance-validator.mjs:82-83` (fallback must exist) |

## 2. Bespoke commerce pages — MIGRATE → DELETE@L17

| Page | Files | Lines | APIs called (all EA, KEEP) | hooks/contexts | Lock |
|---|---|---|---|---|---|
| Cart | `cart/page.tsx` | 199 | proxy `/cart`→`cart-routes.ts` | `useCart` | — |
| Product body | `product/[productId]/product-details-client.tsx` | 555 | (context) | `useCart` | **hard `exists()` `typescript-dead-source-validator.mjs:141-144`** |
| Checkout | `checkout/checkout-client.tsx` (1,160) + `checkout/page.tsx` | 1,199 | `/api/orders`,`/api/coupons/validate`,`/api/customer/addresses`,`/api/shipping/rates`,`/api/payments/razorpay/*` | `useCart` | — — **KEEP (constitutional hosted checkout, §234)** |
| Orders lookup | `orders/orders-client.tsx` (447) + `orders/page.tsx` | 466 | `/api/orders/{check,login,set-password}` | — | — |
| Account orders | `account/orders/page.tsx` | 228 | `/api/customer/orders` | customer-auth | — |
| Account addresses | `account/addresses/page.tsx` | 383 | `/api/customer/addresses` | customer-auth | — |
| Account settings | `account/settings/page.tsx` | 296 | `/api/customer/profile`,`/api/customer/set-password` | customer-auth | — |
| Account wishlist | `account/wishlist/page.tsx` | 73 | `/api/customer/wishlist` | useWishlist | — |
| Policies | `privacy/terms/returns/shipping/page.tsx` | 231 | ContentService | — | → CMS/Liquid `page` |

**Note:** checkout is **KEEP** (engine-agnostic hosted `checkout.letbuyy.com` origin per Constitution §234/ART), not MIGRATE — "Full Liquid storefront" does not mean a Liquid checkout (Shopify deprecated `checkout.liquid` too). All other pages MIGRATE.

## 3. Contexts/hooks — MIGRATE → DELETE@L17 (after last consumer)

| Context | File | Lines | API | Replaced by |
|---|---|---|---|---|
| Cart | `context/cart-context.tsx` | 265 | proxy `/cart` (keys `lb_cart`/`lb_cart_token`) | `liquid-hydration-islands.tsx` (`lb-cart-drawer`) — **already shares the same keys** |
| Customer auth | `context/customer-auth-context.tsx` | 221 | `/api/customer/{session,login,logout,check,set-password,wishlist}` | island/client hydration via `/api/customer/session` |
| Wishlist | `context/wishlist-context.tsx` | 92 | `/api/customer/wishlist` | Liquid wishlist island (to build, L10) |

## 4. KEEP-PERMANENT (engine-agnostic — Liquid reuses; never delete)

- **Render backbone:** `composition-engine.tsx` (Liquid branch), `template-resolver.ts`, `data-binding-engine.ts`, `product-route.ts`, `content-route.ts`, `types.ts`, `liquid-hydration-islands.tsx`.
- **Layout shell:** `layout.tsx` provider + `:root` CSS-var block (`:123-212`); **MIGRATE only the header/footer calls (`:214,224`) to Liquid chrome** (CAP-C08, L4).
- **Services:** `store-service.ts`, `product-service.ts`, `order-service.ts`, `customer-service.ts`, `content-service.ts`, `seo.ts`, `session.ts`, `storefront-access.ts`, `lib/api/*`.
- **All 22 `app/api/*/route.ts` proxies** (Liquid + React call them) — locked by `domain-boundary-validator.mjs:209` (count==127).
- **Composition page wrappers** (home/shop/product/collection/CMS/blog `page.tsx`) — they render Liquid once a bundle is present; KEEP.
- **Checkout** (`checkout-client.tsx`, `checkout/page.tsx`) — KEEP (constitutional hosted origin).

## 5. Extraction order (what's safe to touch when)

1. **Freeze** the React section layer (ART-17 already does — `no-new-react-sections`); add nothing.
2. **Migrate** chrome (L4) → product/collection/search (L5-L7) → cart/account/orders/tracking (L8-L12), each authoring the Liquid twin over the EA backends.
3. **Keep React present and frozen** through parity validation (L14) + canary (L15) + production flip (L16). React is the rollback target throughout.
4. **Delete** (L17) only after the deletion-execution proof gates (next doc) + the Constitution's hardening-wave data decision.

## Foundation safety

No extracted/deleted artifact touches money/identity/tenancy (all in `api-gateway`+`database`+validators). The checkout/payments path is KEEP. Deletions are confined to `apps/storefront-runtime/src/{components/sections,context,app/store/[subdomain]}` + theme-engine React glue, each behind a lockstep validator edit.
