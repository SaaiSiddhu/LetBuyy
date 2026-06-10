# Cross-App UX Consistency Report — Phase 1.5

**Date:** 2026-06-09 · read-only · the **primary-objective** report: *why does LetBuyy still feel like separate products even after Design Governance Recovery?*

## The answer in one sentence
**The recovery unified the plumbing (one theme provider, one token source) but not the composition (shells, page-containers, component vocabulary), and adoption is bimodal — so the platform is two design cultures wearing the same tokens.**

## Root cause 1 — Architecture was fixed; adoption was not
Theme provider: **9/9**. Canonical shell: **2/9**. Component forks: **90** local declarations + **5 CSS-class systems**. Dashboard systems: **7**. A unified token engine with un-unified composition produces apps that share colors but not *form*. (Evidence: `NAVIGATION_GOVERNANCE_REPORT.md`, `COMPONENT_GOVERNANCE_REPORT.md`, `DASHBOARD_GOVERNANCE_REPORT.md`.)

## Root cause 2 — Bimodal adoption (a 63-point spread)
Overall scores: ops 87 / console 83 vs marketing 24 / storefront 29 / identity 31 (`DESIGN_SYSTEM_ADOPTION_SCORECARD.md`). Internal-ops apps are token-disciplined (type/space 100%); customer-facing apps are near-zero (marketing type 0% / space 0% / color 1%). **The surfaces a real user sees most (storefront, marketing, identity, app-marketplace) are the least adopted** — so the *lived* product feels the most inconsistent.

## Root cause 3 — Three+ competing token vocabularies
A component cannot move between apps because the same concept is named differently:
- **Canonical:** `var(--lb-color-*)`, `var(--lb-space-*)` (console, ops, merchant components).
- **Tailwind alias layer:** `text-text-muted`, `bg-surface`, `bg-bg-card`, `glass-card` (theme-marketplace, app-marketplace).
- **Storefront runtime vars:** `var(--primary)`, `var(--text-secondary)` (storefront header/account/landing).
- **Mobile:** 4 Dart color classes (`AppColors`, `StoreAdminColors`, `Light/DarkThemeColors`, 2×`LetbuyyColorTokens`).
Until these reconcile onto `--lb-*`, shared components are impossible and each app re-styles from scratch.

## Root cause 4 — No enforced page-container → divergent rhythm & density
`Page`/`PageHeader` adoption is wildly uneven (merchant 34 files, theme 17, developer 4, console 1, ops 2, marketing/storefront/identity 0). Each app frames pages its own way, so page padding, header height, max-width, and section gaps differ app-to-app. Compounded by **globals.css size** as a proxy for bespoke layout CSS: merchant **10,336**, app-marketplace **7,476**, marketing **5,320**, identity **1,985** vs console **39** / ops **38**. The big-CSS apps each encode their own spatial rhythm.

## Root cause 5 — CSS-class shadow systems bypass governance
`btn-primary` (74 spans), `app-card` (29), `marketplace-badge` (37), `glass-card`, `stat-card`, `developer-card` — primitives re-built as bare CSS classes that never import `@letbuyy/ui`, so import-based lint can't see them and they drift freely. This is why two "buttons" or two "cards" look different across apps.

## Root cause 6 — Per-app data coupling blocks lift-and-shift
Local shells/cards are wired to app-specific types (`AdminShell` needs `SessionUser`/`StoreData`; `AppCard` needs `MarketplaceApp`; `ThemeCard` needs `Theme`), and active state is computed 5 ways. Swapping in canonical components requires a per-app data adapter — which is why only the two greenfield internal-ops apps migrated.

## Dimensions where apps visibly diverge (with the pattern owner)
| Pattern | Divergence | Where |
|---|---|---|
| Page framing / density | 8 different page containers; globals.css 38→10,336 lines | every app |
| Navigation | 10 shells, 4 widths, 5 active-state strategies | all but console/ops |
| Cards | `Card` vs `Panel`/`ModuleCard`/`app-card`/`glass-card`/`ThemeCard`/`developer-card` | 7 systems |
| Metrics/dashboards | `MetricCard` vs 6 local | 5 data apps |
| Buttons | `Button` vs `btn-primary` CSS | theme/marketing/storefront |
| Badges/status | `StatusBadge` vs `StatusPill`/`marketplace-badge`/zinc-emerald | 5 forks |
| Typography rhythm | role tokens vs raw-px ladders | marketing/app-marketplace/identity/storefront |
| Modals/forms | canonical `Modal`/`Input` vs inline `Field`/native `<dialog>` | console/ops/merchant |

## Screens most affected (highest user visibility × lowest adoption)
1. **storefront-runtime** shopper pages (header, account, cart, landing) — color tokenization 3%, the public face of every merchant store.
2. **marketing-site** (home, pricing, create) — 0% type/space, the public face of LetBuyy itself.
3. **identity-platform** auth flows (login/signup/onboarding ×10 pages) — 3% type, 11% dark; the first screen every user sees.
4. **app-marketplace** browse/app detail — CSS `app-card`/`marketplace-badge`, 1% spacing.
5. **mobile merchant-app** all screens — ~11% token adoption, theme bypasses the bridge.

## Migration strategy (to make it feel like one platform)
1. **Reconcile the token vocabularies** first (root cause 3): map the Tailwind alias layer and storefront runtime vars onto `--lb-*`. Without this, nothing else composes.
2. **Enforce one page-container** (`Page`) and **one shell** (`AppNavigation` for admin; `MarketingHeader` for brochure) — fixes rhythm/density divergence (root causes 1, 4).
3. **Burn down the 4 low-adoption customer-facing apps** (storefront, marketing, identity, app-marketplace) — they own ~80% of the debt and the most user visibility.
4. **Kill CSS-class shadow systems** (root cause 5) with a lint gate.
5. **Promote the forked component grammars** (workspace/metric/card/badge) into `@letbuyy/ui` and migrate consumers (root cause 1).
6. **Make mobile consume the bridge** (separate but parallel).

Sequencing + file paths in `DESIGN_SYSTEM_PHASE2_MASTER_PLAN.md`.
