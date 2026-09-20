# LIQUID_LAUNCH_STRATEGY.md

**Date:** 2026-06-13 · **HEAD:** `140a73db` · code-grounded. One recommendation.

## The two options

### Option A — Hybrid launch
Liquid: home, collections, products, shop, CMS (the merchandising surface). React (engine-agnostic, unchanged): cart page, checkout, account, orders.

- **Effort:** ~4–6 focused weeks (Migration Program phases L0–L2, L4 for index/product/collection, L5, L9 partial, L10, L11; chrome L-chrome).
- **Risk:** **low-medium.** The transactional/money path (checkout, cart backend, account, orders) is untouched — it stays the hardened React+gateway path. Blast radius is the render skin only. Add-to-cart still works on Liquid pages (islands share `lb_cart` state + proxy to the real `cart-routes.ts`).
- **Blockers:** ARB flip; parity-green for browse templates; CSS pipeline; bundle seed.
- **React deletion reachable?** Partial — only the section layer + browse can be deleted; cart/account/order React stays until the tail is migrated later.

### Option B — Full Liquid launch
Everything Liquid, including cart page, account, orders.

- **Effort:** ~10–14 weeks (all of L0–L11 incl. cart/customers/order templates L6–L8 + the portable→Liquid authoring compiler L3 if merchants must edit themes).
- **Risk:** **high.** Rewrites the buyer-funnel tail; parity must be proven for transactional pages; larger surface to validate; conflicts with the V1 "minimum change / foundation frozen / 60-day" mandate.
- **Blockers:** all of Option A + cart/account/order Liquid templates + drop injection + (optionally) the authoring compiler + full 200-cell parity.
- **React deletion reachable?** Yes — full React deletion (L12) becomes possible because every route renders Liquid.

## Why the tail is small but still defers full launch

Corrected from the feasibility report: the cart/account/order **backends already exist and are engine-agnostic** (`cart-routes.ts`, `/api/customer/*`, `/api/orders/*`). So L6–L8 are *template authoring over existing APIs*, ~1 week each — not backend builds. But authoring + parity-validating transactional Liquid templates (cart, account, orders, with the drop injection and the money-adjacent checkout-url handoff) is still real, validation-heavy work that pushes past the V1 window. Hence: ship browse on Liquid first, migrate the tail right after.

## RECOMMENDATION — Option A (Hybrid), then complete the tail post-launch toward full deletion

**Launch V1 as a Liquid storefront with the React checkout (Option A).** This is the fastest *safe* way to put Liquid on V1, it's the industry-standard architecture (Shopify deprecated `checkout.liquid`; checkout is not Liquid there either), and it keeps the money path on the already-hardened, foundation-frozen React+gateway surface — preserving every money/identity/tenancy/governance guarantee by simply not touching them.

Then, **immediately after launch, run L6→L7→L8** (cart, account, orders Liquid templates over the existing APIs) to bring the tail onto Liquid, **followed by L12 React decommission**. This sequences the user's two goals correctly: *Liquid on V1 now* (hybrid), and *React fully deletable* (after the tail templates land + parity is stable).

Do **not** attempt Option B for V1 — it inflates the timeline ~2–3×, puts transactional pages on an unvalidated render path, and violates the minimum-change mandate, for the marginal benefit of deleting React a few weeks earlier (which the post-launch tail track achieves anyway).
