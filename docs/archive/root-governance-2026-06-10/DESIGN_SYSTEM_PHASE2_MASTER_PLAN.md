# LetBuyy Design System — Phase 2 Master Plan

**Date:** 2026-06-09 · read-only investigation → execution plan. Builds on `DESIGN_GOVERNANCE_RECOVERY_REPORT.md`. Companion reports: navigation/typography/spacing/component/dashboard/mobile/dark-mode governance, adoption scorecard, Polaris gap, cross-app consistency, shell governance.

---

## Executive summary
The Design Governance Recovery fixed the **architecture** (one theme provider, one token source, governance gates, canonical nav + token interchange). It did **not** fix **adoption**. Measured platform design-system adoption is **~52/100**, distributed **bimodally**: internal-ops apps score 62–87, customer-facing apps score 24–37, and mobile ~33. LetBuyy still feels like separate products because the surfaces users see most (storefront, marketing, identity, app-marketplace, mobile) are the least adopted, three+ token vocabularies prevent component sharing, ~10 navigation shells and 7 dashboard systems coexist, and ~90 component forks plus 5 CSS-class shadow systems bypass governance. Phase 2 is an **adoption + enforcement** program that moves the platform mean from ~52 to ~92.

## Current state (calculated)
- DS file-adoption: **287/625 TSX = 46%**. Typography token-adoption **55%**, spacing **50%**, dark-mode/color tokenization **46%**.
- Canonical shell adoption: **2/9 apps**. Page-container (`Page`): 4 apps use it **0** times.
- Local component forks: **90** declarations + **5 CSS-class systems** (btn-primary 74, app-card 29, marketplace-badge 37, glass-card, stat-card, developer-card).
- Dashboard/metric systems: **7** (1 canonical). Nav shells: **~10 local**.
- Mobile: live `ThemeData` bypasses the generated bridge; **~11.5%** canonical-token adoption; bridge reach **~6%**.
- globals.css size (bespoke-CSS proxy): merchant **10,336**, app-marketplace **7,476**, marketing **5,320**, identity **1,985** vs console **39** / ops **38**.

## What is FIXED (Phase 1, verified)
Single theme provider (`LetbuyyThemeProvider`) in 9/9 apps · single key `letbuyy-theme` · single vocabulary `light|dark|system` · `theme="auto"` cascade bug eliminated · `validate:design-system` + `validate:design-tokens` + `validate:mobile-tokens` gates in CI + pre-commit · DTCG `tokens.json` · `AppNavigation` + `StatusBadge` shipped · console/ops nav migrated · mobile status colors reconciled · authored `docs/design-system/`.

## What is PARTIALLY fixed
- **Navigation:** canonical shell exists, **2/9** adoption.
- **Components:** `StatusBadge` shipped but the 5× `StatusPill` forks not yet migrated; `MetricCard` exists, 6 local metric systems remain.
- **Mobile:** status colors reconciled + parity gate wired, but the live theme still bypasses the generated tokens.
- **Enforcement:** CSS drift ratcheted (frozen, can't worsen) but not yet burned down; stylelint config present but dormant; ESLint color rules still `warn`.

## What is STILL broken
- **Customer-facing adoption** (storefront 29, marketing 24, identity 31, app-marketplace 37) — the user-visible product.
- **Token vocabulary fragmentation** (3 web + 4 mobile) — blocks all component sharing.
- **No enforced page-container/shell** — divergent rhythm/density.
- **CSS-class shadow component systems** — invisible to import-lint.
- **Mobile is effectively a separate design system** (~11% adoption).
- **No design↔code sync, visual-regression, or dark-mode verification.**

## Root cause analysis (why it still feels inconsistent)
1. **Architecture fixed, adoption not** — plumbing unified, composition (shells/containers/components) not.
2. **Bimodal adoption** — 63-point spread; least-adopted apps are the most user-visible.
3. **3+ token vocabularies** — `--lb-*` vs Tailwind aliases (`text-text-muted`, `bg-bg-card`) vs storefront `var(--primary)` vs 4 mobile color classes.
4. **No enforced page-container** — 4 apps frame 0 pages with `Page`; globals.css 38→10,336 lines.
5. **CSS-class shadow systems bypass governance** — import-lint can't see `.btn-primary`/`.app-card`.
6. **Per-app data coupling** — shells/cards wired to app-specific types; lift-and-shift needs adapters.
7. **No adoption process** — forks accrete in `_local-ui` instead of upstreaming; no compliance DoD.

---

## Top 50 design-debt items (ranked)

### CRITICAL (platform blockers / highest user visibility)
1. **storefront-runtime light-locked** — 794 rgb, color tokenization 3%; public storefront. `apps/storefront-runtime/**`.
2. **marketing-site un-tokenized** — type 0%, space 0%, 25 hex; public site. `marketing-site/src/app/globals.css` (5,320 L).
3. **identity-platform un-tokenized** — type 3%, dark 11%; first screen every user sees. `identity-platform/src/app/globals.css` (1,985 L) + 10 auth pages.
4. **Token vocabulary fragmentation** (web) — reconcile Tailwind aliases + storefront vars → `--lb-*`. `config/tailwind`, theme/app-marketplace/storefront globals.css.
5. **Mobile live theme bypasses generated bridge** — `store_theme.dart:16-25,282-292` binds ui_kit, not generated tokens; ~6% reach.
6. **`_local-ui` workspace twins** — `console-workspace.tsx`/`ops-workspace.tsx`; top-6 forks (`Panel` 72, `LeadershipMetric` 66, `StatusPill` 57); `[CONSOLIDATE]` tagged.
7. **No enforced page-container** — `Page` used 0× in 4 apps; divergent rhythm.
8. **CSS-class shadow systems** — `btn-primary` (74), `app-card` (29), `marketplace-badge` (37), `glass-card`, `stat-card`, `developer-card`.
9. **app-marketplace un-tokenized** — space 1% (609 raw), type 12% (234 raw); `globals.css` 7,476 L.
10. **10 hand-rolled nav shells** — 78% unmigrated; merchant/marketing/storefront/theme/developer.

### HIGH
11. merchant `AdminShell`+`Sidebar`+`HeaderBar`+`AISidebar` (1,075 L) → `AppNavigation`.
12. merchant globals.css 578 raw spacing + 184 raw font (10,336 L) → tokens.
13. `StatusPill` re-implemented 5× → `StatusBadge`/`statusToBadgeVariant`.
14. 6 local dashboard/metric systems → `MetricCard` (console/ops run 2 each).
15. `ConsoleDataTable` hand-rolled thead/tbody → `Table`. `platform-console/src/components/ConsoleDataTable.tsx`.
16. Mobile dual `LetbuyyColorTokens` class collision — `letbuyy_tokens.dart:44` vs `letbuyy_color_tokens.dart:13`.
17. Mobile typography 0% — 712 raw `fontSize:`; no type tokens in `mobile-tokens.ts`.
18. Mobile spacing 5.5% — 1,767 raw `EdgeInsets`/`SizedBox`; density 0%.
19. Mobile 4 competing color classes (`AppColors`, `StoreAdminColors`, `Light/DarkThemeColors`).
20. 680 Tailwind palette classes (console 144, storefront 243, theme 150) → token utilities.
21. theme-marketplace `ThemeCard`/`glass-card`/`btn-primary` forks.
22. app-marketplace `app-card`/`marketplace-badge`/`MarketplaceSkeleton`/`MarketplacePagination`/`MarketplaceBreadcrumbs` forks.
23. developer-portal `_local-ui/developer-docs` (15+ table renderers) + competing `DeveloperHeader` + `developer-card`.
24. merchant `CommandPalette`/`StubPage`/`TrialBanner` forks → canonical.
25. 3 marketing-header forks (`marketing/app-marketplace/theme navbar`) → `MarketingHeader`.
26. storefront `dynamic-header` + account layout + `landing-nav` (3 shells).
27. Stylelint dormant (D2) — activate as error gate.
28. ESLint color rules `warn` (D3) — promote to error after burn-down.
29. No nav/shell adoption gate in `validate:design-system`.
30. No shadow-CSS-component gate.
31. inline `Field`/`TextField`/`SelectField` ×5 → `Input`/`Select`.
32. Mobile dark text teal drift (`#D3E4E3`) → slate ramp.
33. Identity 10 auth-page toggles → shared `useTheme()` `AuthThemeToggle` (recovery D4).
34. merchant nested `SettingsShell` (274 L) → nested `Page` section.
35. storefront `StatCard` CSS → `MetricCard`.

### MEDIUM
36. No visual-regression gate (Storybook baselines exist, unused).
37. No Figma↔code token sync from `tokens.json` (no Code Connect).
38. No dark-mode smoke test (3 apps light-locked despite working provider).
39. Density axis unused (product decision pending).
40. `validate:mobile-tokens` checks generated file the theme ignores (relevance ~6%).
41. app-local non-`--lb-` custom props (merchant 124, app-marketplace 80, marketing 71) shadow tokens.
42. `Page`/`PageHeader` adoption uneven (merchant 34 vs console 1, ops 2).
43. Marketing decorative metric tiles (`hero-metric`) — low priority, illustrative.
44. `anonymous-preview-shell` (theme) — fold into shared shell.
45. developer-portal `StatusPill` (`PortalChrome.tsx:70`) → `StatusBadge`.

### LOW
46. `QualityBadge`/`PricingTag` (app-marketplace CSS) → `Badge`/`Chip`.
47. `InfoPlaceholder` (theme) → `EmptyState`.
48. No RFC/contribution workflow for upstreaming patterns.
49. No design-system-compliance "definition of done".
50. No adoption dashboard (metrics computed ad hoc).

---

## App-by-app health
| App | Score | Strength | Top fix |
|---|:---:|---|---|
| platform-operations-portal | 87 | tokens 100% | promote `_local-ui` → DS; kill 44 palette classes |
| platform-console | 83 | tokens 100% | same; 144 palette classes; `ConsoleDataTable`→`Table` |
| theme-marketplace | 69 | type/space high | reconcile Tailwind aliases; `ThemeCard`/`glass-card`/`btn-primary`→DS |
| merchant-control-plane | 65 | deep DS adoption | `AdminShell`→`AppNavigation`; globals.css burn-down |
| developer-portal | 62 | spacing 90% | `PortalChrome`→`AppNavigation`; delete `_local-ui` |
| app-marketplace | 37 | color 56% | globals.css burn-down (7,476 L); CSS-class kill |
| identity-platform | 31 | theme wired | type/spacing/dark burn-down; auth toggles→`useTheme` |
| storefront-runtime | 29 | theme wired | color burn-down (794 rgb); account→`AppNavigation` |
| marketing-site | 24 | theme wired | full token burn-down; `MarketingHeader` |
| mobile/merchant-app | 33 | dark mode UX | theme→generated tokens; type+spacing tokens |

## Governance gaps (what the current gates miss)
The Phase-1 validators catch hex (TSX), theme anti-patterns (hard), and ratchet CSS drift. They do **not** catch: hand-rolled shells/sidebars, CSS-class shadow components, missing `Page` container, light-locked routes (no dark-mode smoke), visual regressions, mobile theme-source bypass, or token-vocabulary divergence. Phase 2 adds these checks.

---

## Migration roadmap

### Phase 2A — Foundation: vocabulary + enforcement (unblocks everything)
- **Reconcile token vocabularies onto `--lb-*`:** extend `config/tailwind/letbuyy-tokens.css` so the Tailwind alias layer (`text-text-muted`, `bg-bg-card`, `bg-surface`) resolves to `--lb-color-*`; map storefront `var(--primary)`/`var(--text-secondary)` to `--lb-*`. Outcome: components become portable.
- **Activate stylelint** (D2) as an error gate; **promote ESLint** `no-tailwind-default-color`/`no-raw-color-functions` to `error` *scoped to already-clean apps* (console/ops/theme), warn elsewhere until burn-down.
- **Add gates to `validate:design-system`:** nav/shell adoption (local `<aside>` sidebar in an admin layout fails), shadow-CSS-component (`.btn-`/`.app-card`/`.*-badge` class defs fail), page-container (admin route without `Page`/`AppNavigation` warns).
- **Enforce `Page`** as the canonical page-container in `docs/design-system` DoD.

### Phase 2B — Customer-facing burn-down (highest user-visible impact)
Order by visibility × debt: **storefront-runtime → marketing-site → identity-platform → app-marketplace.** For each: migrate `globals.css` raw color/px → `--lb-*`; replace CSS-class components (`btn-primary`/`app-card`/`stat-card`/`marketplace-badge`) with `Button`/`Card`/`MetricCard`/`StatusBadge`; adopt `Page`; lower the `validate:design-system` baseline each PR. Lands dark mode + rhythm consistency on the surfaces users actually see.

### Phase 2C — Component + shell consolidation (internal-ops + merchant)
- Promote the workspace grammar (`Workspace`/`MetricGrid`/`Panel`/`ModuleCard`/`LeadershipMetric`+`OpsMetric`→one `MetricCard`/`EmptyDataState`→`EmptyState`) into `@letbuyy/ui`; migrate the 18 console/ops consumer pages; **delete both `_local-ui` twins.**
- merchant `AdminShell`/`Sidebar` → `AppNavigation` (reuse `merchantNavigation.ts` as `sections`); fold `SettingsShell` into `Page`.
- developer-portal `PortalChrome` → `AppNavigation`; delete `DeveloperHeader`/`developer-docs` table forks.
- Extract `MarketingHeader`/`MarketingFooter`; migrate 3 marketing navbars.
- `ConsoleDataTable`→`Table`; inline form fields→`Input`/`Select`.

### Phase 3 — Mobile + design↔code loop + verification
- **Mobile:** resolve the dual `LetbuyyColorTokens` collision; point `store_theme.dart` at the generated tokens; add a type scale to `mobile-tokens.ts` + generator and adopt it; migrate raw `EdgeInsets`/`SizedBox`→spacing tokens; fix dark-text drift; make `validate:mobile-tokens` assert the theme consumes the bridge.
- **Design↔code:** publish a Figma library from `tokens.json` + Code Connect; turn on Storybook **visual-regression** in CI (baselines already exist).
- **Verification:** add a **dark-mode smoke** (render key routes under `data-theme=dark`, assert no light-locked backgrounds); build an **adoption dashboard** from the measurement script; add an **RFC/contribution workflow** + a design-system-compliance DoD.

---

## Exact execution plan (ordered, file-level)

| # | Action | Files / targets | Phase | Expected impact |
|---|---|---|---|---|
| 1 | Map Tailwind aliases + storefront vars → `--lb-*` | `config/tailwind/letbuyy-tokens.css`; theme/app-marketplace/storefront `globals.css` | 2A | components become portable; unblocks 2B/2C |
| 2 | Add nav/shell + shadow-CSS-component + page-container checks | `scripts/validators/validate-design-system.mjs` | 2A | governance can see the remaining 78% drift |
| 3 | Activate stylelint; scope ESLint color rules to error in clean apps | root `package.json`, `eslint.config.mjs`, `.stylelintrc.cjs` | 2A | CSS color governed; prevents new drift |
| 4 | storefront-runtime token burn-down + `Page` + account→`AppNavigation` | `storefront-runtime/src/**`, `account/layout.tsx`, `dynamic-header.tsx` | 2B | +60 score; public storefront themes correctly |
| 5 | marketing-site token burn-down + `MarketingHeader` | `marketing-site/src/app/globals.css`, `Header.tsx` | 2B | +66 score; public site consistent |
| 6 | identity-platform token burn-down + auth toggles→`useTheme` | `identity-platform/src/app/globals.css` + 10 pages | 2B | +59; first-screen consistency + dark mode |
| 7 | app-marketplace burn-down + kill `app-card`/`marketplace-badge` | `app-marketplace/src/app/globals.css`, `AppCard.tsx`, badges | 2B | +53; marketplace cards canonical |
| 8 | Promote workspace grammar; migrate 18 pages; delete twins | new `@letbuyy/ui` `workspace`/`MetricGrid`; `*/_local-ui/*` | 2C | removes top-6 forks; 1 dashboard grammar |
| 9 | merchant `AdminShell`→`AppNavigation`; globals.css burn-down | `merchant/src/components/{AdminShell,Sidebar,HeaderBar}.tsx`, `merchantNavigation.ts`, `globals.css` | 2C | −1,000 L shell; +30 score |
| 10 | developer-portal `PortalChrome`→`AppNavigation`; delete forks | `developer-portal/src/components/PortalChrome.tsx`, `_local-ui/` | 2C | +30; 1 shell |
| 11 | `MarketingHeader/Footer` extraction + 3 navbar migrations | `@letbuyy/ui` + marketing/app-marketplace/theme navbars | 2C | 3 forks → 1 |
| 12 | Mobile: collision + theme→generated tokens + type/spacing tokens | `store_theme.dart`, `letbuyy_tokens.dart`, `mobile-tokens.ts`, generator | 3 | mobile becomes part of the system (~11%→90%) |
| 13 | Figma library + Code Connect from `tokens.json` | `packages/typescript/ui/tokens.json`, Figma | 3 | design↔code parity |
| 14 | Storybook visual-regression + dark-mode smoke in CI | `packages/typescript/ui/storybook-screenshots/`, `.github/workflows` | 3 | regressions + light-locked routes caught |
| 15 | Adoption dashboard + RFC/DoD process | measurement script → dashboard; `docs/governance` | 3 | adoption ratchets up, not down |

**Target outcome:** platform mean ~52 → **~92**; the four customer-facing apps 24–37 → ~90; mobile 33 → ~90; one shell vocabulary, one page-container, one dashboard grammar, one token vocabulary across web + mobile — i.e. LetBuyy finally *feels* like one platform.
