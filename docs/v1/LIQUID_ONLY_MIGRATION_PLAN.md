# Liquid-Only Migration Plan (V1)

**Type:** Research / certification — **a plan, not an executed migration. No code was changed, no React deleted.**
**Date:** 2026-06-16
**Parent:** [LIQUID_PARITY_AUDIT.md](LIQUID_PARITY_AUDIT.md) · [REACT_DEPENDENCY_INVENTORY.md](REACT_DEPENDENCY_INVENTORY.md) · [LIQUID_GAP_MATRIX.md](LIQUID_GAP_MATRIX.md)

---

## Final verdict

> **Can LetBuyy become Liquid-only today? NO.**

React renders the entire **purchase + account + content + discovery** half of the storefront, and those routes never invoke the Liquid renderer. Liquid is production-capable for the **catalog** (home, product, collection, product-grid, header/footer) and is actually **stronger for localization**, but removing React today would break: **checkout, cart page, all account pages, order history, wishlist, reviews, search, blog, and CMS pages.**

### Liquid completeness: **≈ 38% (weighted)**
| Surface group | Weight | Liquid-ready | Contribution |
|---|:--:|:--:|:--:|
| Catalog presentation (home/hero/featured/grid/category/header/footer) | 25% | ~80% | 20% |
| Product detail | 10% | ~75% | 7.5% |
| Collection (display) | 8% | ~70% | 5.6% |
| Localization / theme settings | 7% | ~90% | 6.3% |
| Cart | 10% | ~30% | 3% |
| Checkout | 15% | ~5% | 0.75% |
| Customer account + orders | 12% | ~10% | 1.2% |
| Search + filter | 6% | ~5% | 0.3% |
| Reviews/wishlist/recommendations | 4% | ~0% | 0% |
| Blog / CMS / policy pages | 3% | ~10% | 0.3% |
| **Total** | **100%** | — | **≈ 38%** |

### The exact remaining blockers (from [LIQUID_GAP_MATRIX.md](LIQUID_GAP_MATRIX.md))
1. **Checkout** — React + Razorpay SDK; no Liquid checkout path.
2. **Cart page** — React route; not wired to the (existing) Liquid `cart` template; data is a shell.
3. **Customer account + auth** — React routes; `customer:null` in Liquid drop (`composition-engine.tsx:337`).
4. **Order history** — React; dormant Liquid templates unrouted, no orders drop.
5. **Search** — no backend; island posts to a route that ignores the query.
6. (HIGH) collection filter, wishlist, reviews, blog, CMS pages — no Liquid path.

### What must be built before React can be removed
- Liquid templates **+ route wiring** for: cart, checkout, account (login/register/profile/addresses), orders, search, wishlist, reviews, blog, CMS, policy pages.
- Hydration islands for: checkout (Razorpay/COD), auth/login, wishlist (the island runtime pattern already exists in `liquid-hydration-islands.tsx`).
- Data drops for: `customer`, `customer.orders`, `cart` (real lines/totals), `product.reviews`, `recommendations`; propagate `variant_id` to the server cart.
- A **search backend** + filter/sort/pagination data.
- Per-theme Liquid bundles for **all** themes (today only Urban Kicks); remove the demo-fixture fallback (`store-service.ts:670-673`).
- Flip `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` (`theme-governance.ts:14`) — **last**, after parity.

---

## Staged plan (NO direct deletion — React is the safety net until Phase 5)

### Phase 1 — Liquid parity
**Goal:** every storefront surface has a working Liquid path behind the canary.
**Work:**
- Build the 5 BLOCKER surfaces in Liquid (checkout island, cart page wiring, account+auth, orders, search) + the 5 HIGH (filter, wishlist, reviews, blog, CMS).
- Build the missing data drops (`customer`, `orders`, `reviews`, real `cart`, `recommendations`).
- Author Liquid bundles for all shipped themes.
- Wire React-only routes (`cart`, `checkout`, `account/*`, `orders`, `[...path]`, `blog`) to optionally render via the composition engine when `rendererEngine==='liquid'`.
**Exit criteria:** [LIQUID_GAP_MATRIX.md](LIQUID_GAP_MATRIX.md) shows **0 MISSING** for all in-scope surfaces; per-theme bundle for every theme; demo-fixture fallback removed.
**Gate:** governance validators green; no canonical-ledger/RLS regressions.

### Phase 2 — Traffic shadowing
**Goal:** prove Liquid output ≡ React output without user impact.
**Work:**
- Shadow-render Liquid alongside React for catalog + cart + account on real traffic; diff HTML/semantics + commerce drops; capture the existing `lb:canary:render` telemetry (`composition-engine.tsx:405`) for engine/latency.
- Synthetic end-to-end: browse → add-to-cart → checkout → order → account, on Liquid, per theme.
**Exit criteria:** parity diff under threshold across top themes; checkout success + order creation verified live (requires Razorpay/Supabase connected — see prior audit's NO-GO live gate).

### Phase 3 — Liquid default
**Goal:** make Liquid the default renderer.
**Work:**
- Flip `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=true` (`theme-governance.ts:14`) — staged by theme/merchant canary first (`resolveThemeLiquidRenderingEnabled`).
- Monitor conversion, error rate, latency, the canary render telemetry.
**Exit criteria:** Liquid serves ≥ target % of traffic for a sustained window with no regression; React serves only as fallback.

### Phase 4 — React fallback disabled
**Goal:** stop React from rendering storefront output (but keep the code).
**Work:**
- Make `renderLiquidPlan` returning `null` a hard error/holding page instead of the React `RenderSectionList` fallback (`composition-engine.tsx:426`).
- Keep React modules in the tree (reversible kill-switch).
**Exit criteria:** zero React storefront renders in telemetry over the bake window; instant rollback path verified.

### Phase 5 — React deletion
**Goal:** remove React storefront renderers.
**Work (only after Phase 4 is stable):**
- Delete `renderer-registry.tsx`, `components/sections/*.tsx` (React), React layout chrome branch, React-only pages now served by Liquid, `cart/customer-auth/wishlist` contexts.
- **Keep** `liquid-hydration-islands.tsx` (the Liquid interactivity runtime) and the merchant editor/preview React (tooling).
**Exit criteria:** build passes Liquid-only; no storefront route imports a React renderer; full e2e green.

---

## Reversibility & safety notes

- **Do not skip Phase 2/4.** The storefront has money paths (checkout, ledger RPCs); shadow + fallback-disable-before-delete is the safe order.
- The **Liquid islands are not a deletion target** — they are the runtime a Liquid-only storefront depends on (`liquid-hydration-islands.tsx:427-439`).
- The **editor/preview stay React** (merchant tooling) regardless of storefront renderer — the preview already renders Liquid via the same engine (`preview/page.tsx:370`).
- Live readiness (Razorpay/Supabase/Resend connected + load tests) from the prior audit's **NO-GO** gate must be closed before Phase 2 can be *proven*, not just coded.

---

## One-paragraph answer

LetBuyy is **~38% of the way to a Liquid-only storefront**. The Liquid engine, ~20 catalog section templates, commerce filters, localization, hydration islands, and the editor/preview Liquid path are real and working — catalog browsing can already run on Liquid. But **checkout, cart, customer accounts, orders, search, wishlist, reviews, blog, and CMS pages are React-only routes with no Liquid path and missing data drops** (notably `customer: null`). React **cannot** be removed today. The path is the 5-phase plan above: build parity (Phase 1), shadow + prove (Phase 2), default to Liquid (Phase 3), disable the React fallback (Phase 4), and only then delete React (Phase 5) — never a direct deletion.
