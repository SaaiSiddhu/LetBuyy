# Spacing Governance Report — Phase 1.5 Adoption

**Date:** 2026-06-09 · read-only · calculated counts.
**Definitions:** *token* = `var(--lb-space-*)` / `var(--lb-density-*)`. *raw* = `padding|margin|gap: NNpx` in CSS + `p-[NNpx]`/`m-[NNpx]`/`gap-[NNpx]` arbitrary classes in TSX. Scale in `tokens.ts` (`space` xs 4 … 7xl 96) + `docs/design-system/spacing.md`.

## Spacing Adoption (token ÷ (token+raw))

| App | token | raw | **Adoption** |
|---|---:|---:|:---:|
| platform-console | 294 | 0 | **100%** |
| platform-operations-portal | 235 | 0 | **100%** |
| theme-marketplace | 414 | 13 | **97%** |
| developer-portal | 35 | 4 | **90%** |
| merchant-control-plane | 777 | 578 | **57%** |
| storefront-runtime | 11 | 53 | **17%** |
| identity-platform | 18 | 137 | **12%** |
| app-marketplace | 6 | 609 | **1%** |
| marketing-site | 0 | 370 | **0%** |
| **PLATFORM** | **1,790** | **1,764** | **50%** |

> **Spacing Adoption: 50%. Spacing Debt: 50%** (1,764 raw declarations). Same bimodal split as typography: 4 apps ≥90%, 3 apps ≤17%.

## Actual spacing systems being used
**3.** (1) Canonical `--lb-space-*`/`--lb-density-*` (console, ops, theme, developer, merchant-components). (2) Raw-px in `globals.css` (app-marketplace 609, marketing 370, merchant 578, identity 137). (3) App-local non-`--lb-` custom properties (per the recovery audit: merchant 124, app-marketplace 80, marketing 71 app-own custom props) that define their own spacing constants. The density axis (`compact/comfortable/spacious`) only reaches the token-disciplined apps; the raw-px apps opt out of density entirely.

## Top offending files
1. `apps/app-marketplace/src/app/globals.css` — **609** raw px padding/margin/gap (platform max), 1% token.
2. `apps/marketing-site/src/app/globals.css` — **370** raw, 0 token.
3. `apps/merchant-control-plane/src/app/globals.css` — **578** raw (offset by 777 token uses → 57%).
4. `apps/identity-platform/src/app/globals.css` — **137** raw, 18 token.
5. `apps/storefront-runtime/**` — 53 raw, 11 token.

## Migration order (by leverage = raw count × visibility)
1. **app-marketplace** (609 raw, 1%) — biggest single block; migrate `globals.css` spacing to `var(--lb-space-*)`; prefer `BlockStack`/`InlineStack`/`Box gap` in components.
2. **marketing-site** (370, 0%) — public surface; high visibility.
3. **merchant-control-plane** (578, 57%) — finish the CSS half; components already token-heavy.
4. **identity-platform** (137, 12%) + **storefront-runtime** (53, 17%).

Console/ops/theme/developer are the reference standard (37–294 lines globals.css, ≥90%). Their existence proves the discipline is achievable platform-wide.

**Enforcement:** the `validate:design-system` `rawPxSpacing` ratchet (baseline 1,752) blocks new raw px today; each migration lowers it. Add a stylelint allowed-list for `padding/margin/gap` (permit `var(--lb-*)`, `0`, relative units) once the stylelint binary is installed (`skipped-human-decisions.md` D2). Prefer layout primitives over raw CSS gaps to make density "just work."
