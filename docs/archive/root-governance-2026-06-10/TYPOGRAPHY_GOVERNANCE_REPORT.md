# Typography Governance Report — Phase 1.5 Adoption

**Date:** 2026-06-09 · read-only · calculated counts (measurement pass over all 9 web apps).
**Definitions:** *token* = `var(--lb-font-size-*)` / `--lb-line-height-*` / the `Text` primitive. *raw* = `font-size: NNpx` in CSS + `text-[NNpx]` / `text-[length:NNpx]` arbitrary classes in TSX. The canonical role scale lives in `packages/typescript/ui/src/tokens.ts` (`typography.fontSize` page-title 24 / section-title 18 / body 14 / caption 12 …) and `docs/design-system/typography.md`.

## Typography Adoption Score (token ÷ (token+raw))

| App | token | raw | **Adoption** | raw font in globals.css |
|---|---:|---:|:---:|---|
| platform-console | 53 | 0 | **100%** | 0 |
| platform-operations-portal | 104 | 0 | **100%** | 0 |
| theme-marketplace | 226 | 42 | **84%** | low |
| merchant-control-plane | 480 | 185 | **72%** | 184 (10,336-line globals.css) |
| developer-portal | 7 | 5 | **58%** | low |
| app-marketplace | 32 | 234 | **12%** | 234 (7,476-line globals.css) |
| storefront-runtime | 2 | 55 | **4%** | mixed |
| identity-platform | 2 | 77 | **3%** | 1,985-line globals.css |
| marketing-site | 0 | 129 | **0%** | 129 (5,320-line globals.css) |
| **PLATFORM** | **906** | **727** | **55%** | — |

> **Typography Adoption: 55%. Typography Debt: 45%** (727 raw declarations). The distribution is **bimodal**: 5 apps are ≥58%, 4 apps are ≤12%. There is no middle.

## Number of typography systems
**Effectively 3.** (1) The canonical role scale via `--lb-font-size-*`/`Text` (console, ops, theme, merchant, developer). (2) Raw-px ladders inside the giant `globals.css` files (marketing, app-marketplace, identity) — each app's own heading scale hand-set in pixels. (3) Mobile (separate; 712 raw `fontSize:`, 0 token — see `MOBILE_DESIGN_SYSTEM_REPORT.md`). The web platform's "actual" heading hierarchy therefore differs per app: marketing/app-marketplace size headings in raw px in CSS; console/ops/theme size them by role token.

## Actual typography hierarchy (as shipped)
- **Token-disciplined apps** inherit the canonical scale and render identical type ramps; density-aware.
- **Raw-px apps** (marketing 0%, app-marketplace 12%, identity 3%, storefront 4%) set sizes ad hoc — this is the single biggest reason headings/body look different across customer-facing surfaces.

## Top offending files
1. `apps/app-marketplace/src/app/globals.css` — 234 raw `font-size:` (platform max).
2. `apps/marketing-site/src/app/globals.css` — 129 raw + the only 25 hex; 0 token usage.
3. `apps/merchant-control-plane/src/app/globals.css` — 184 raw (offset by 480 token uses elsewhere).
4. `apps/identity-platform/src/app/globals.css` — 77 raw, 2 token.
5. `apps/storefront-runtime/**` — 55 raw `text-[NNpx]`/CSS, 2 token.

## Migration plan
**Phase 2A (highest ROI, ratchet down `validate:design-system` `rawPxFontSize` baseline):**
1. `marketing-site` (0% → target 80%): replace the raw-px heading/body ladder in `globals.css` with `--lb-font-size-*`; adopt `Text` in components. Biggest visible win for "feels like one platform."
2. `app-marketplace` (12%): same; 234 declarations.
3. `identity-platform` (3%) + `storefront-runtime` (4%): migrate component-level `text-[NNpx]` → `text-[length:var(--lb-font-size-*)]` or `Text`.

**Phase 2B:** `merchant-control-plane` globals.css 184 raw → token (it's already 72% via components; finish the CSS).

**Enforcement to add:** promote the ESLint `no-tailwind-default-color`-style rule family with a `no-raw-text-size` rule (warn→error after burn-down) catching `text-[NNpx]`; activate stylelint `font-size` allowed-list (only `var(--lb-font-size-*)` + relative units). The `validate:design-system` `rawPxFontSize` ratchet already blocks new raw px — these migrations lower it monotonically.
