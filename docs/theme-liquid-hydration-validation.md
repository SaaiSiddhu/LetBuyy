# Liquid Hydration Validation — Phase 5

> Mission Phase 5. Validates `liquid-hydration-islands.tsx` (add-to-cart, quantity, wishlist, search, filters, variant switching). **Static/code-level + bundle inspection.** Runtime browser validation is env-bound and **NOT RUN** (not fabricated).

## Verdict

The hydration **mechanism is sound** (Web Components over server-injected HTML → no React hydration-mismatch class of bug). **Coverage is incomplete:** variant switching, grid/card add-to-cart, wishlist, filters, and in-cart quantity editing are missing or unwired in the Urban Kicks bundle.

## Mechanism (`apps/storefront-runtime/src/lib/theme-engine/liquid-hydration-islands.tsx`)

- Defines 4 custom elements — `lb-add-to-cart`, `lb-cart-drawer`, `lb-search`, `lb-variant-picker` (`registerLiquidHydrationIslands` `:420`). The React component returns `null`; `useEffect` registers the elements over `[data-theme-renderer="liquid"]` (`:438-452`).
- The Liquid HTML is injected via `dangerouslySetInnerHTML` (`composition-engine.tsx:84`) → **React does not hydrate that subtree** → no SSR/CSR reconciliation, so no React hydration-mismatch warnings **by design**.
- Cart state = `localStorage` (`lb_cart`) + server sync (`/cart`) + `CustomEvent`s (`CART_OPEN/CHANGED`, `VARIANT_CHANGED`). SSR cart is empty (Phase 4) → client repopulates on mount (possible `Cart (0)`→`(n)` flash; not a crash).

## Feature coverage — island class vs section actually emitting the hook

| Feature | Island class exists | A section emits the hook? | Status |
|---------|:---:|---|---|
| add-to-cart | ✅ `LbAddToCartElement` | only `product-detail` (1× `lb-add-to-cart`) | ⚠️ **PDP only** — grids/cards have no hook |
| cart drawer | ✅ `LbCartDrawerElement` | none — auto-injected by `ensureLiquidCartDrawer` (`:427`) | ⚠️ works, but toggle is appended to page root, **not** the header; header cart link unwired |
| search | ✅ `LbSearchElement` | ✅ `search-box` + `header` (6×) | ✅ |
| variant switching | ✅ `LbVariantPickerElement` | ⛔ **0 sections** emit `lb-variant-picker` | ⛔ **non-functional** in current bundle |
| quantity update | add-time only | `quantityFromElement` on add; drawer is Remove-only | ⚠️ no in-cart qty edit |
| wishlist | ⛔ none | — | ⛔ not implemented in Liquid |
| filters | ⛔ none | — | ⛔ not implemented in Liquid |

## Crash / mismatch assessment (static)

- `customElements.define` guarded (`:415`) — no double-define crash.
- `escapeHtml` applied to all interpolated cart values (`:48, :313-315, :333`); `CSS.escape` for selectors (`:399, :402`).
- No React reconciliation on the Liquid subtree → no mismatch warnings by design. No obvious crash vectors.

## NOT verified (env-bound)

Real browser interaction — actual add-to-cart click, drawer open/close, search navigation, console errors/warnings — needs a live render of a canary store. **NOT RUN here; not fabricated.**

## Missing links to fix (reuse the existing island runtime — no new engine)

1. Emit `lb-add-to-cart` in `product-grid` / `featured-products` product cards (grid add-to-cart).
2. Emit `lb-variant-picker` in `product-detail` — variant switching is dead without it.
3. Wire the header cart control to `data-lb-cart-toggle` instead of appending the toggle to page root.
4. Add wishlist + filter islands, or formally scope them as React-only.
5. In-cart quantity editing in the drawer.
