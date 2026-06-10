# Polaris Gap Analysis — Phase 1.5

**Date:** 2026-06-09 · read-only. Benchmarks LetBuyy's *governance + adoption* against Shopify Polaris (web), Shopify Admin, and Shopify Mobile (Polaris/Restyle). The token architecture is already at near-parity (see prior `SHOPIFY_BENCHMARK_REPORT.md`); this analysis is about the layers that make Polaris a *single platform in practice*.

## Where LetBuyy already matches Polaris
Tiered tokens (primitive→semantic→component), light/dark/auto, density (LetBuyy exceeds Polaris here), per-tenant brand + runtime WCAG contrast, ~60 components, codemods + deprecations, **one theme provider** (post-recovery), a **DTCG `tokens.json`**, and CI token-parity gates. Foundationally this is Polaris-grade.

## Governance gaps (what's still missing)

### Missing primitives
| Polaris has | LetBuyy gap |
|---|---|
| Enforced `Page`/`Frame`/`Layout` as the *only* way to frame a page | `Page`/`PageHeader` exist but adoption is uneven (merchant 34 files, console 1, marketing/storefront/identity 0); no enforced page-container. |
| Single `Navigation`/`Frame` shell used by the whole admin | `AppNavigation` exists, 2/9 adoption; ~10 local shells remain. |
| A marketing/brochure pattern separate from admin | No `MarketingHeader`/`MarketingFooter` — 3–4 forks. |
| Index/Resource list + filters as one component | `Table`+`FilterBar` exist but `ConsoleDataTable` + bespoke filters fork them. |
| Dashboard/`MetricCard` grammar used everywhere | 1 canonical + 6 local metric systems. |
| Rating, and a complete enforced form-field set | `StarRating` fork; inline `Field`/`TextField`/`SelectField`. |

### Missing enforcement
- **Stylelint is dormant** (no binary) — the `.css` channel (where the giant globals.css drift lives) is governed only by the Node ratchet, not by per-rule CSS lint. (D2 in `skipped-human-decisions.md`.)
- **ESLint color/palette rules are `warn`** (Polaris-equivalents would be errors). 680 palette classes + naked rgb survive.
- **No shadow-CSS-component detection** — `btn-primary`/`app-card`/`glass-card`/`marketplace-badge` (100+ usages) are invisible to import-based lint.
- **No nav/shell adoption gate** — nothing fails when an app hand-rolls a sidebar.
- **No visual-regression gate** — Storybook baselines exist (`packages/typescript/ui/storybook-screenshots/`) but aren't run in CI; Polaris/Shopify gate on visual diff.
- **No dark-mode smoke** — nothing asserts a route actually flips; three apps are light-locked despite a working provider.
- **Mobile theme-source not gated** — `validate:mobile-tokens` checks the *generated file*, which the live theme ignores.

### Missing tooling
- **No Figma↔code token sync.** `tokens.json` (DTCG) exists but there's no published Figma library / Code Connect, so design and code can still diverge. Polaris ships `@shopify/polaris-tokens` consumed by both.
- **No migration codemods for shells/CSS-classes.** Recovery shipped component-rename codemods; there's no codemod to convert local sidebars→`AppNavigation` or `.btn-primary`→`Button`.
- **No adoption dashboard.** The metrics in this report are computed ad hoc; Polaris teams track adoption continuously.

### Missing adoption mechanisms
- **No contribution/RFC workflow** for promoting a local pattern into `@letbuyy/ui` (so forks accrete in `_local-ui` instead of upstreaming).
- **No "definition of done" that includes design-system compliance** (page uses `Page`+canonical shell+tokens) — so new pages re-fork.
- **Density unused** despite being built — no product decision on whether it's user-facing.
- **Token vocabulary not unified at the Tailwind layer** — theme/app-marketplace use a separate alias set (`text-text-muted`, `bg-bg-card`) parallel to `--lb-*`, so components can't move between apps.

## Closing-the-gap priorities (Polaris parity)
1. **Enforce adoption, not just architecture:** nav/shell gate + shadow-CSS-component gate + promote ESLint color rules to error (after burn-down) + activate stylelint.
2. **Ship the missing primitives:** `MarketingHeader/Footer`, promote `Workspace/MetricGrid/Panel`, enforce `Page` as the page-container.
3. **Wire the design↔code loop:** publish the Figma library from `tokens.json` + Code Connect; turn on Storybook visual-regression in CI.
4. **Make mobile real:** point the live `ThemeData` at the generated tokens; add type tokens to the bridge.
5. **Process:** an RFC/contribution path + a "design-system compliant" DoD so adoption ratchets instead of regressing.

**Net:** LetBuyy has Polaris's *foundations* and now Polaris's *theme unification*. It lacks Polaris's *enforcement, primitives-for-every-surface, design↔code sync, and adoption process* — which is precisely why it still feels like separate products. See `DESIGN_SYSTEM_PHASE2_MASTER_PLAN.md`.
