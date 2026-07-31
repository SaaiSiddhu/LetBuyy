# LIQUID_COMPLETION_PARITY_MATRIX.md

**Program:** Full Liquid V1 · **HEAD:** `0b8a56e7` · code-cited. Per capability: React status · Liquid status · Parity % (code-completeness, **not** validation — the render-validation matrix `PARITY_MATRIX.md` is 0/200 executed) · blocking gap · closing phase.

| Capability | React | Liquid | Parity % | Blocking gap | Phase |
|---|---|---|---|---|---|
| Home | ● full | ◐ unstyled/demo | ~55% | bundle+CSS+real drops | L1,L2,L5 |
| Header | ● | ◐ section exists, React chrome used | ~40% | CAP-C08 + nav bind | L4 |
| Footer | ● | ◐ section exists | ~40% | CAP-C08 | L4 |
| Navigation | ● `navigation_menus` | ○ | ~20% | bind menus into Liquid header | L4 |
| Products (PDP) | ● island | ○ template | ~45% | `product` template + variant→price | L5 |
| Collections | ● | ○ template | ~50% | `collection` template + title/desc drop | L6 |
| Search | ◐ client-only | ○ | ~25% | `search` template (+ optional backend) | L7 |
| Filters | ◐ | ○ | ~20% | filter section | L6/L7 |
| Sections | ● 20 deep | ◐ 20 shallow | ~70%/~50% | depth + CSS | L2,L3 |
| Blocks | n/a | ● | ~90% | behavioral test | L14 |
| Cart | ● page | ◐ drawer only | ~35% | `cart` page template (backend exists) | L8 |
| Checkout handoff | ● EA | ● by design | 100% | none — React hosted origin (§234) | — |
| Login | ● | ○ | ~30% | `customers/login` template | L9 |
| Registration | ◐ broken | ○ | ~15% | LB-12 endpoint + `customers/register` | L9 |
| Customer account | ● | ○ | ~25% | `customers/account` + `customer` drop | L10 |
| Addresses | ● | ○ | ~25% | `customers/addresses` template | L10 |
| Wishlist | ● | ○ | ~20% | template + `lb-wishlist` island | L10 |
| Orders / detail | ● | ○ | ~25% | order templates (backend exists) | L11 |
| Order tracking | ● | ○ | ~25% | order-status template | L12 |
| Theme settings | ● editor | ○ Liquid | ~30% | compiler (L3) | L13 |
| Theme customization | ● | ○ Liquid | ~30% | compiler + editor emit | L13 |
| Theme publishing | ● portable | ◐ via import only | ~40% | editor emit liquidBundle | L13 |
| CMS pages | ● | ◐ `[...path]` routed | ~50% | `page` Liquid template | L5/L13 |
| 404 / Policies | ● | ○ | ~20% | `404`+`page` templates | L5/L13 |

## Aggregate

- **Backends:** ~95% engine-agnostic and present (cart/account/orders/checkout/CMS); only thin gaps are **search** (no product-search endpoint) and **registration** (LB-12).
- **Liquid templates:** the dominant gap — present-but-fixture-only for sections + index/header/footer; missing for product/collection/search/cart/login/register/account/addresses/wishlist/orders/detail/tracking/page/404.
- **Validation:** **0/200 cells executed** — none of the above is render-verified; L14 creates the proof. Per ART-17 the flip (L16) and deletion (L17) cannot proceed until this matrix is green.

## Path to 100% parity

`bundle(L1) → CSS(L2) → chrome+nav(L4) → product/collection/search(L5-L7) + cart(L8) + register/account/orders/tracking(L9-L12) → authoring(L3/L13) → execute the 200-cell harness to green(L14)`. Checkout is already 100% (constitutional React origin).
