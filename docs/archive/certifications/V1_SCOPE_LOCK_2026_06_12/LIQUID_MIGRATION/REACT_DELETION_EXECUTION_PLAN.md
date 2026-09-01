# REACT_DELETION_EXECUTION_PLAN.md

**Date:** 2026-06-13 · **HEAD:** `0b8a56e7` · code-cited. The governance for removing React after Full Liquid is validated. **No deletion may occur before parity proof.**

## Supreme rule (Constitution ART-17, `LETBUYY_CONSTITUTION.md:256`)

> Forbids: "**Deleting React before the data decision at the hardening wave.**" And the Liquid default-flip is "gated on a sanitizer + section ports + a parity/security/perf harness."

Therefore React deletion (program phase L17) is permitted **only** when ALL of:
1. **Parity proof** — the 200-cell `PARITY_MATRIX.md` is green for the artifact's surface (no red cell), via an executed `scripts/liquid-parity/run-parity-matrix.mjs` run + real render/island tests (not grep).
2. **Production proof** — the Liquid twin has served the route in production under canary→default for a clean soak (no P0/P1 render, money, or auth regressions).
3. **Hardening-wave data decision** — a recorded decision (the ART-17 "deleted-or-frozen by data" gate) that the React fast-path is no longer needed.
4. **Governance gate green** with the lockstep validator edits applied in the same commit.

## Per-artifact deletion contract

For every React artifact: **Migration prereq** (its Liquid twin) · **Parity requirement** · **Validation requirement** · **Deletion order** · **Rollback** · **Proof-before-deletion**.

### Group A — Section render layer (delete after ALL 20 + chrome are Liquid)
| Artifact | Migration prereq | Parity req | Validation req | Deletion order | Rollback |
|---|---|---|---|---|---|
| 20 `components/sections/*.tsx` | each section's Liquid twin live (L1,L5-L13) | that section's 10 parity cells green | gate green AFTER editing `no-new-react-sections-validator.mjs:9-30` Set + `theme-governance-validator.mjs:69-72,98-101` (parity/count) in same commit | per-section: `banner-carousel`+`marquee` first (already registry-unreachable) → rest | restore from `docs/archive/dead-code/` + revert validator edits |
| `renderer-registry.tsx`, React branch `RenderSectionList`, `editor-preview-section-frame.tsx` | all 20 gone | full browse parity green | remove `theme-governance-validator.mjs:82-83` fallback req first | after all 20 sections | restore file; re-add fallback req |

### Group B — Bespoke commerce pages (delete after each Liquid twin is live + parity-green)
| Artifact | Migration prereq | Parity / proof | Deletion order |
|---|---|---|---|
| `cart/page.tsx` | L8 Liquid cart template live | cart parity green + cart-state E2E | 1st of group |
| `account/wishlist/page.tsx` | L10 wishlist island/template | wishlist E2E | 2nd |
| `product-details-client.tsx` | L5 product template body | product parity green | 3rd — **first remove `typescript-dead-source-validator.mjs:141-144` `exists()` lock** |
| `account/{orders,addresses,settings}/page.tsx` | L10/L11 templates | account E2E + auth-preserved | 4th |
| `orders/orders-client.tsx`+`orders/page.tsx` | L11/L12 templates | order/tracking E2E | 5th |
| policy pages | CMS/Liquid `page` template | content render | 6th |
| **`checkout/*`** | **DO NOT DELETE** — constitutional hosted React origin (§234) | — | never |

### Group C — Contexts (delete after last consumer gone)
`cart-context.tsx` → `wishlist-context.tsx` → `customer-auth-context.tsx`; then remove providers from `layout.tsx:210-212`. Prereq: every page that used the context is now Liquid.

### Group D — API routes (KEEP; delete only if truly unused)
The 22 `app/api/*/route.ts` proxies are reused by Liquid → **KEEP**. Any genuine removal must update `domain-boundary-validator.mjs:209` (count) in the same commit.

## Deletion order (whole-program)

```
L17.1 chrome React removed (after Liquid header/footer/nav live + parity)
L17.2 body sections removed (per-section, parity-gated, validator-lockstep)
L17.3 renderer-registry + React composition branch removed
L17.4 bespoke pages removed (cart→wishlist→product-body→account→orders→policies)   [checkout KEPT]
L17.5 contexts removed (cart→wishlist→customer-auth) + providers unwired
L17.6 runtime-composition package unwired then deleted (ART-18:260)
```

## Rollback order (reverse, per ART-17 React-is-the-fallback)

```
restore contexts → restore bespoke pages → restore registry+React branch → restore sections → restore chrome
+ flip canary OFF (instant render-time revert to React) at any point
```
Because React stays **present and frozen** until the very end (KEEP-TEMP), rollback at any phase ≤L16 is a **canary flag flip** (no redeploy). Only L17 deletions require archive-restore.

## Proof artifacts required before any L17 deletion

1. `PARITY_MATRIX.md` with the relevant cells = PASS (executed harness, not scaffold).
2. Real render tests asserting data binding (`{{ product.title }}`, `collection.products`) + island behavior (add-to-cart→server cart, variant→price) — replacing the current grep-only tests.
3. A production canary soak report (engine = liquid via `X-Lb-Render-Engine` header `proxy.ts:171`) with zero P0/P1.
4. The recorded hardening-wave data decision (ART-17).
5. Gate green at the new validator counts (sections, parity, route count).

**Until all five exist for a given surface, that React artifact is KEEP-TEMP, not DELETE.** This is the constitutional guarantee that React removal happens only after Full Liquid is proven.
