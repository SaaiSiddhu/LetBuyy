# LIQUID_V1_FINAL_VERDICT.md

**Date:** 2026-06-13 · **HEAD:** `140a73db` · code-verified. Repository truth only.

## Can LetBuyy launch V1 on Liquid?

> **A. Hybrid Liquid (browse Liquid + React checkout/account/orders) — YES, in ~4–6 weeks.** ✅ recommended
> **B. Full Liquid (everything Liquid) — NOT for V1** (~10–14 weeks; violates the minimum-change / 60-day mandate; puts the money path on an unvalidated render skin).
> **C. Neither — NO.** Liquid is genuinely buildable; the engine is real.

## Evidence for the verdict (code wins)

**The engine is real, not theater:** `liquidjs ^10.27.0`; `LiquidRenderer.render` (`theme-renderer.ts:192`) with DOMPurify, hardened opts, real `product`/`collection`/`cart`/`customer` drops (`:443-516`); a ~90% Shopify-style block system; islands (`liquid-hydration-islands.tsx`) that **share cart state** with React (`lb_cart`/`lb_cart_token`) and **proxy to a real server cart** (`cart-routes.ts` via `next.config.ts:107-115` rewrite — correcting the feasibility report's "cart 404").

**But it cannot launch today:** no store ships a `liquidBundle` (urban-kicks seeded React, `urban-kicks-theme.sql`); the layout ships **no CSS** (`theme-bundle.ts:1819-1835`); only `index/header/footer` templates exist (no product/collection/cart/customers/order); the flag is off + validator-pinned + ARB-`deferred` (`theme-governance.ts:14-21`); parity is **0/200** (never run); and `layout.tsx:214,224` renders React chrome over Liquid bodies (CAP-C08).

**The tail is small (corrected):** cart/account/order **backends already exist and are engine-agnostic** (`cart-routes.ts`, `/api/customer/*`, `/api/orders/*`). So L5–L8 are template authoring over existing APIs, not backend builds. This makes Hybrid achievable in the V1 window and Full Liquid a bounded follow-on.

## The most important question — fastest *safe* path to launch V1 on Liquid AND eventually delete React completely

**Two goals, sequenced so neither blocks the other:**

### Phase 1 — Launch V1 on Liquid (Hybrid) · ~4–6 weeks
Do **L0 → L1 (seed urban-kicks bundle) → L2 (CSS pipeline) → L4 (index/product/collection templates) → L5 (real drops) → L-chrome (Liquid header/footer) → L9 browse parity → L10 canary → L11**. Liquid renders home/product/collection/shop; **checkout, cart page, account, orders stay React** (engine-agnostic, foundation-frozen, untouched). Add-to-cart works on Liquid pages (shared state + real cart backend). This is the V1 launch and the **fastest** path, because it ships Liquid over the merchandising surface without rewriting the money path.

**Why it's safe:** the money/identity/tenancy/governance guarantees live entirely in `services/api-gateway` + `database/` + validators — *outside* the render skin. Hybrid changes only the storefront render layer + theme seed. Checkout is the same hardened React+gateway path Shopify-style. Rollback is a per-store canary flag flip (instant revert to React).

### Phase 2 — Make React fully deletable (post-launch) · ~+6–10 weeks
Right after launch, run **L6 (cart) → L7 (account) → L8 (orders)** — author the tail Liquid templates over the existing APIs — then **L9 full parity**, then **L12 React decommission** (staged archival behind the validator lock-web: 20 sections, registry, bespoke tail pages, contexts; each with its lockstep validator edit per `REACT_DELETION_PLAN.md`).

**React can be deleted completely only after every route renders Liquid** (i.e., the tail templates ship and parity is stable in production). The Hybrid launch deliberately defers this; Phase 2 completes it.

## Why not go straight to Full Liquid for V1

It's ~2–3× the timeline, blows the 60-day window, and routes the transactional tail (cart/account/orders) through a render path with **0/200 validated parity** — unnecessary risk for the marginal benefit of deleting React a few weeks sooner, which Phase 2 achieves anyway. Repository evidence does not support a Full-Liquid V1.

## The hard gates (none skippable)

1. Seed a real Liquid bundle (L1) — nothing renders Liquid without it.
2. Ship CSS (L2) — nothing is styled without it.
3. Author page templates (L4) — routes fall back to `index` without them.
4. Parity-green the browse subset (L9) + the **ARB flip** (human) — required to enable Liquid.
5. For full React deletion: the tail templates (L6–L8) + the validator lock-web edits (L12).

## Bottom line

**Launch V1 on Liquid as a hybrid (browse Liquid, React checkout) in ~4–6 weeks; migrate the tail (L6–L8) and decommission React (L12) over the following ~6–10 weeks.** That is the fastest path that is also safe, preserves every foundation guarantee, and ends with React fully deletable. The engine is real and worth it; the work is seeding, styling, template authoring, parity validation, and a governed flag flip — not a rewrite of the money path.
