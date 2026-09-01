# LIQUID_PARITY_MATRIX.md

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · code-cited. React (live) vs Liquid (built/dormant) parity per capability.

**Parity % = how close the Liquid path is to matching the live React behavior end-to-end** (render + style + data + interactivity), per code. The in-repo `PARITY_MATRIX.md` render-validation matrix is **0/200 cells executed** — so no % below is *validation*-proven; they are code-completeness estimates.

| # | Capability | React | Liquid parity % | Blockers | Dependency |
|---|---|---|---|---|---|
| 1 | Homepage (index) | ✅ full | **~55%** | unstyled; home sections use demo blocks not `collection.products`; no bundle seeded | Gap 1,2,4 |
| 2 | Header | ✅ | **~40%** | Liquid header section exists but layout renders **React** header over Liquid (CAP-C08); unstyled | Gap 11,2 |
| 3 | Footer | ✅ | **~40%** | same CAP-C08; unstyled | Gap 11,2 |
| 4 | Collections | ✅ | **~50%** | `collection` drop discards title/desc (`composition-engine.tsx:301-308`); no `collection` template (falls back to index); unstyled | Gap 3,4,2 |
| 5 | Products (PDP) | ✅ | **~45%** | no `product` template (→index fallback); body is React island; `product-detail.liquid` orphaned; unstyled | Gap 3,2 + product-details lock |
| 6 | Search | ✅ (client filter) | **~30%** | `lb-search` island navigates to `?search=`; no Liquid search template/results | Gap 3 |
| 7 | Filters | ✅ partial | **~20%** | no Liquid filter section/markup | Gap 3 |
| 8 | Sections | ✅ 20 (deep) | **~70% by count / ~50% by depth** | 20 Liquid sections exist but shallow (~8 lines vs 234) + unstyled | Gap 2 |
| 9 | Blocks | n/a (React section-based) | **~90%** | real Shopify-style blocks; no behavioral test | Gap 10 |
| 10 | Theme settings | ✅ (editor→JSON→React) | **~30%** | editor never emits `liquidBundle`; no portable→Liquid compiler | Gap 8 |
| 11 | Appearance | ⚠️ dead island (neither engine) | **~10%** | `site_settings` reaches neither React `:root` nor Liquid layout (LB-9) | Gap 2 + LB-9 |
| 12 | Cart | ✅ full React page | **~35%** | backend + drawer island exist & shared state; **no full-page `cart` Liquid template**; cart drop stubbed | Gap 5,3 |
| 13 | Checkout handoff | ✅ (engine-agnostic) | **100% (by design)** | none — checkout stays React under any engine; Liquid links to it | — |
| 14 | Customer accounts | ✅ full React | **~25%** | backend exists; no `customers/*` Liquid templates; `customer` drop null | Gap 6,3 |
| 15 | Orders | ✅ full React | **~25%** | backend exists; no order Liquid templates | Gap 7,3 |
| 16 | Tracking | ✅ React timeline | **~25%** | backend exists; no Liquid order-status template | Gap 7,3 |

## Aggregate

- **Browse surface (1–9):** ~50% average — engine real, but unstyled + demo data + no page templates + CAP-C08 chrome.
- **Authoring/settings (10–11):** ~20% — no Liquid authoring path; appearance dead.
- **Transactional tail (12–16):** ~40% weighted — **backends 100% present and engine-agnostic; only templates missing** (checkout is 100% by design).
- **Validation:** 0/200 parity cells executed → none of the above is render-verified.

## Critical-path blockers (must clear before ANY Liquid page is launch-grade)

1. **Bundle seeded** (Gap 1) — without it nothing renders Liquid.
2. **CSS shipped** (Gap 2) — without it everything is unstyled.
3. **Page templates authored** (Gap 3) — without them product/collection/cart/etc. fall back to `index`.
4. **Parity run green** (Gap 10) — required before the ARB default flip.
5. **CAP-C08 chrome** (Gap 11) — for a fully-Liquid page.

## Dependency ordering

`Bundle(1) → CSS(2) → Templates(3) + Drops(4) → [Cart(5)/Account(6)/Order(7) templates] → Parity(10) → Canary(9) → ARB flip → Chrome(11) for full-Liquid`. Merchant authoring (8) is an independent, deferrable track.
