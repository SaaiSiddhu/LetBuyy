# Dark Mode Governance Report — Phase 1.5 Adoption

**Date:** 2026-06-09 · read-only · calculated.
**Premise:** the recovery unified the theme *engine* (one `LetbuyyThemeProvider`, resolved-theme fed to `DesignSystemRoot`, 9/9 apps). Dark mode is now *reachable and correct at the plumbing layer*. But a component only flips if its colors are **token-backed**. Hardcoded hex / naked `rgb()` / Tailwind-palette classes **do not respond to `.dark`** — so dark-mode *readiness* equals **color tokenization**, which is far from complete.

## Color tokenization (= dark-mode readiness) per app
*token color* = `var(--lb-color-*)`; *won't-theme* = hex + `rgb()/rgba()` + Tailwind palette classes.

| App | token color refs | won't-theme (hex+rgb+palette) | **Dark-mode readiness** |
|---|---:|---:|:---:|
| platform-operations-portal | 292 | 0+10+44 | **84%** |
| merchant-control-plane | 1,048 | 0+405+7 | **72%** |
| theme-marketplace | 380 | 0+69+150 | **63%** |
| platform-console | 237 | 0+10+144 | **61%** |
| app-marketplace | 318 | 0+252+2 | **56%** |
| developer-portal | 32 | 0+12+13 | **56%** |
| identity-platform | 18 | 0+141+3 | **11%** |
| storefront-runtime | 37 | 0+794+243 | **3%** |
| marketing-site | 6 | 25+355+74 | **1%** |
| **PLATFORM** | **2,368** | **25 + 2,048 + 680** | **46%** |

> **Dark-mode adoption (color tokenization): 46%.** The engine works everywhere; the *content* flips in ~46% of color sites. Three apps are effectively **light-only in practice**: `marketing-site` (1%), `storefront-runtime` (3%), `identity-platform` (11%) — their components hold ~1,500 hardcoded color values that ignore the theme.

## Remaining violations (the won't-theme inventory)
- **2,048 `rgb()/rgba()`** literals (storefront 794, merchant 405, marketing 355, app-marketplace 252, identity 141). Many are `var(--token, rgb(...))` fallbacks (legitimate), but the recovery's own validator measured **~763 naked** `color/background: rgb(...)` with no `var()` — these are hard light-mode locks.
- **680 Tailwind-palette classes** (`bg-gray-*`, `bg-white`, `text-slate-*`): console 144, ops 44, storefront 243, theme 150, marketing 74. These resolve to fixed palette values, not `--lb-color-*`, so they never flip.
- **25 hex** — all in `marketing-site/globals.css`.

## Light-only / dark-only components (critical)
- **marketing-site**, **storefront-runtime**, **identity-platform**: predominantly hardcoded → render light regardless of theme. A user toggling dark in these apps sees a half-dark chrome (token-backed shell) over light-locked content — *worse than no dark mode* for perceived consistency.
- **app-marketplace** nav chrome (`.appstore-header` `rgba(5,7,12,0.98)`) and marketing nav states (`rgb(255 255 255)`) are hardcoded → header doesn't theme even where body does.

## Critical accessibility issues
- **Contrast risk in forked status colors:** `ConsoleDataTable.tsx:89` `StatusBadge` uses raw zinc/emerald rather than the contrast-checked `StatusBadge` tokens → unverified contrast in dark.
- **Mobile dark text drift:** Flutter dark theme uses teal body text (`#D3E4E3/#AED9D8/#89CBCB`) on dark surfaces instead of the slate ramp (`MOBILE_DESIGN_SYSTEM_REPORT.md`) — reduced legibility vs the canonical, WCAG-tuned values.
- The token system *does* ship runtime WCAG validation (`validateLetbuyyBrandContrast`) but it only guards brand injection, not the hardcoded values in the three light-only apps.

## Migration plan
1. **storefront-runtime** + **marketing-site** + **identity-platform** (readiness 1–11%) are the dark-mode blockers — migrate their hardcoded colors to `--lb-color-*`. This is the same burn-down as `TYPOGRAPHY_GOVERNANCE_REPORT.md`/`SPACING_GOVERNANCE_REPORT.md` (the giant globals.css files), so do it once per app.
2. **Tailwind palette → token utilities** in console/ops/theme (144+44+150 classes): `bg-gray-50`→`bg-surface-subdued`, `bg-white`→`bg-surface`, etc. (the `config/tailwind/letbuyy-tokens.css` mapping already exists).
3. Replace forked status badges with `StatusBadge` (contrast-checked).
4. **Mobile:** fix dark-text to the slate ramp as part of the theme→generated-token refactor.

**Enforcement:** the `validate:design-system` ratchet blocks new hardcoded color/palette today. Promote ESLint `no-tailwind-default-color` + `no-raw-color-functions` to `error` after the three light-only apps are migrated, and add a CI "dark-mode smoke" (render each app's key routes under `data-theme=dark` and assert no element computes a light-locked background) for true verification.
