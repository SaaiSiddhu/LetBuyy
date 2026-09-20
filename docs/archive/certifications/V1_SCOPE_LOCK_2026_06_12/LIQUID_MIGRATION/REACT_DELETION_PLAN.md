# REACT_DELETION_PLAN.md

**Date:** 2026-06-13 · **HEAD:** `140a73db` · code-cited. Classifies every React-owned storefront artifact KEEP / MIGRATE / DELETE, with the validator lock that blocks each deletion and the order in which deletion is safe.

## Governance rule for deletion (must follow)

This repo treats source removal as governed: per `typescript-dead-source-validator.mjs:132-134` and the `theme-editor-dead-shell-validator` pattern, **removed source must be re-homed under `docs/archive/dead-code/...` and have zero importers**, and any count/freeze validator that references it must be edited in the **same commit**. "DELETE" below means "archive + de-reference + update the lock," never a bare `rm`.

## Classification

### KEEP (engine-agnostic — Liquid reuses; never delete)
- Render switch + plan: `composition-engine.tsx` (Liquid branch), `template-resolver.ts`, `data-binding-engine.ts`, `product-route.ts`, `content-route.ts`, `types.ts`, `liquid-hydration-islands.tsx`.
- `layout.tsx` provider + `:root` CSS-var shell (`:123-212`).
- All `lib/*-service.ts`, `lib/api/*`, `seo.ts`, `session.ts`, `storefront-access.ts`, `store-paths.ts`, `theme-preview*`.
- All 22 `app/api/*/route.ts` proxies (Liquid + React both call them).
- Composition-engine page wrappers (home/shop/product/collection/CMS/blog) — they render Liquid once a bundle is present.
- Checkout (`checkout-client.tsx`, `checkout/page.tsx`) — **engine-agnostic, stays React by design** (Shopify model). Reclassify to MIGRATE only if a future "Liquid checkout" is scoped (not recommended).

### MIGRATE (reimplement as Liquid, then the React version becomes deletable)
| Artifact | Migrate to | Then deletable after |
|---|---|---|
| 20 section components (`components/sections/*.tsx`) | real `.liquid` sections (fixtures exist as strings; author deployable bundle) | their Liquid section renders + parity-green |
| `layout.tsx` header/footer calls (`:214,224`) | Liquid header/footer chrome (CAP-C08) | Liquid chrome live |
| `renderer-registry.tsx`, `editor-preview-section-frame.tsx`, `composition-engine.tsx` React branch (`RenderSectionList`) | n/a (delete the React branch) | all 20 sections gone |
| `cart/page.tsx` | Liquid `cart` template | L6 cart template live |
| `product-details-client.tsx` | Liquid `product` template body | L4 product template + lock removed |
| `account/*` pages, `orders/orders-client.tsx` | Liquid `customers/*` + order templates | L7/L8 templates live |
| `cart-context.tsx`, `customer-auth-context.tsx`, `wishlist-context.tsx` | island/client hydration | last React consumer gone |

### DELETE-ONLY-AFTER (the lock web — every one is a hard gate)
| To delete | Blocking lock (file:line) | Must do first |
|---|---|---|
| any `components/sections/*.tsx` | `no-new-react-sections-validator.mjs:9-30` (frozen Set) + `theme-governance-validator.mjs:98-101` (count==20) | edit the Set + drop/migrate the count assert in the same commit |
| section's parity | `theme-governance-validator.mjs:69-72` (`THEME_LIQUID_PORTABLE_SECTION_PARITY`==20) | update parity table |
| `renderer-registry.tsx` | `theme-governance-validator.mjs:82-83` (fallback must exist) | remove the fallback requirement |
| `product-details-client.tsx` | `typescript-dead-source-validator.mjs:141-144` (hard `exists()`) | remove the existence assert |
| any storefront `/api/*` route | `domain-boundary-validator.mjs:209` (count==127) | update the count + classification |
| `layout.tsx` edits | `storefront-seo-access-validator.mjs:12` | keep SEO/access asserts satisfied |
| Liquid default flip | `theme-governance-validator.mjs:57-67` (default false / deferred) | ARB decision + edit asserts |

## Deletion order (safe sequence)

1. **Prereq (cannot delete anything before):** per-store Liquid live + parity-green + default flag flipped (Migration Program L1–L11).
2. **Chrome:** author Liquid header/footer → switch `layout.tsx:214,224` → now Liquid pages are fully Liquid-chromed.
3. **Body sections:** per section, parity-green its Liquid twin → archive the React `.tsx` + edit the freeze Set + parity table + section-count assert (same commit). `banner-carousel.tsx`/`marquee.tsx` first (already unreachable in the registry).
4. **Registry + React branch:** after all 20 gone → remove the fallback lock → archive `renderer-registry.tsx` + `editor-preview-section-frame.tsx`; strip `RenderSectionList` from `composition-engine.tsx` (keep the file).
5. **Commerce tail (independent track, needs L6/L7/L8 templates):** `cart/page.tsx` → `account/wishlist` → `product-details-client.tsx` (after removing its `exists()` lock) → `account/{orders,addresses,settings}` → `orders-client.tsx` + `orders/page.tsx` → legal pages.
6. **Contexts:** after the last consumer of each is gone → archive `cart-context` → `wishlist-context` → `customer-auth-context`; remove providers from `layout.tsx:210-212`.
7. **API routes:** keep (Liquid still calls them). Only if one becomes truly unused, update the `===127` count in the same commit.

## What MUST stay even at "full Liquid"

The engine-agnostic backbone: composition-engine (Liquid branch), template-resolver, data-binding, all services, all API proxies, checkout, and the layout provider/CSS shell. **React is fully deletable only after every route (incl. cart/account/orders) renders Liquid** — i.e., after the tail templates (L6/L7/L8) ship. The hybrid launch defers the tail, so it defers full React deletion; that's the trade in the strategy doc.

## Proof of safety for Foundation guarantees

None of the deletable artifacts touch money/identity/tenancy (all in `services/api-gateway` + `database/` + validators). The deletions are confined to `apps/storefront-runtime/src/{components/sections,context,app/store/[subdomain]}` + theme-engine React glue. The gate's money/identity/tenancy validators are unaffected; only the theme/section/route-count validators need lockstep edits as catalogued above.
