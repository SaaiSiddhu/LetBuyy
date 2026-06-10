# Component Governance Report — Phase 1.5 Adoption

**Date:** 2026-06-09 · read-only · calculated.
`@letbuyy/ui` adoption (file-level): **287 / 625 TSX files import it = 46%**. But **90 local component declarations** re-implement names the design system already exports, plus several **CSS-class component systems** that bypass import-based governance entirely.

## Adoption snapshot
| App | TSX | importing `@letbuyy/ui` | **DS file-adoption** | local component forks |
|---|---:|---:|:---:|---:|
| theme-marketplace | 67 | 45 | 67% | 10 |
| app-marketplace | 92 | 59 | 64% | 23 |
| developer-portal | 21 | 13 | 62% | 10 |
| platform-operations-portal | 33 | 16 | 48% | 13 |
| platform-console | 37 | 17 | 46% | 15 |
| marketing-site | 22 | 10 | 45% | 1 |
| merchant-control-plane | 165 | 74 | 45% | 11 |
| storefront-runtime | 125 | 42 | 34% | 6 |
| identity-platform | 63 | 11 | 17% | 1 |
| **PLATFORM** | **625** | **287** | **46%** | **90** |

> The headline contradiction: **`platform-console`/`platform-operations-portal` adopted the canonical *shell* (`AppNavigation`) but kept a fully forked component kit inside it** (`_local-ui` workspaces), and even mix in canonical `MetricCard` on a few pages — each runs two component systems simultaneously.

## Shadow component systems (root cause)
**3 `_local-ui/` UI-kit directories** institutionalize forks: `platform-console/src/components/_local-ui/`, `platform-operations-portal/src/components/_local-ui/`, `developer-portal/src/components/_local-ui/`. The console/ops `*-workspace.tsx` files even carry a literal `// [CONSOLIDATE -> @letbuyy/ui]` TODO.

**CSS-class component systems** re-implement primitives as bare classes the import-linter cannot see: `btn-primary` (theme 48 / marketing 20 / storefront 6 spans), `app-card` (app-marketplace 29), `marketplace-badge` (37), `glass-card` (theme dashboard), `stat-card` (storefront), `developer-card` (developer 17), `stub-page`/`admin-trial-toast` (merchant). These never `import` from `@letbuyy/ui`, so they're invisible to governance — the biggest blind spot.

## Top components that must be removed or migrated (ranked by usage)
| # | Fork | File:line | → `@letbuyy/ui` | usages | priority |
|---|---|---|---|---:|---|
| 1 | `Panel` (console+ops twins) | `console-workspace.tsx:72`, `ops-workspace.tsx:72` | `Card` | 72 | **Critical** |
| 2 | `LeadershipMetric` | `console-workspace.tsx:37` | `MetricCard` | 66 | **Critical** |
| 3 | `StatusPill` (twins) | `console-workspace.tsx:143`, `ops-workspace.tsx:138` | `StatusBadge`/`statusToBadgeVariant` | 57 | **Critical** |
| 4 | `EmptyDataState` (twins) | `console-workspace.tsx:193`, `ops-workspace.tsx:180` | `EmptyState` | 49 | High |
| 5 | `btn-primary` (CSS) | theme/marketing/storefront globals.css | `Button` | 74 spans | **Critical** |
| 6 | `OpsMetric` | `ops-workspace.tsx:37` | `MetricCard` | 37 | High |
| 7 | `marketplace-badge` (CSS) | app-marketplace (10 files) | `Badge`/`StatusBadge` | 37 | High |
| 8 | `app-card` (CSS) | `app-marketplace/AppCard.tsx` | `Card` | 29 | High |
| 9 | `MetricGrid` (twins) | `console-workspace.tsx:33`, `ops-workspace.tsx:33` | `Grid`/`Columns` | 25 | High |
| 10 | `ModuleCard` (twins) | `console-workspace.tsx:107`, `ops-workspace.tsx:102` | `Card` | 18 | High |
| 11 | `developer-card` (CSS) | developer-portal | `Card` | 17 | Medium |
| 12 | `StatusBadge` (zinc/emerald) | `ConsoleDataTable.tsx:89` | `StatusBadge` | 14 | High |
| 13 | `ThemeCard` | `theme-marketplace/theme-card.tsx:28` | `Card` | 9 | Medium |
| 14 | `MarketplaceSkeleton` (CSS) | `app-marketplace/MarketplaceSkeleton.tsx` | `Skeleton` | 9 | Medium |
| 15 | `MarketplaceBreadcrumbs` | `app-marketplace/MarketplaceBreadcrumbs.tsx` | `Breadcrumbs` | 6 | Medium |
| 16 | `ConsoleDataTable` | `ConsoleDataTable.tsx:22` (hand-rolled thead/tbody) | `Table` | 5 | High |
| 17 | `StatCard` (CSS) | `storefront-landing.tsx:421` | `MetricCard` | 5 | Medium |
| 18 | `SkipBackendPanel` (twins) | `console-workspace.tsx:167`, `ops-workspace.tsx:153` | `Banner`/`EmptyState` | 4 | Medium |
| 19 | `glass-card` stat tiles | `theme dashboard/page.tsx:59` | `MetricCard`/`Card` | dashboard | Medium |
| 20 | `StatusPill` (developer) | `PortalChrome.tsx:70` | `StatusBadge` | local | Medium |
| 21 | `CommandPalette` | `merchant CommandPalette.tsx:17` | `CommandPalette` | 2 | Medium |
| 22 | `MarketplacePagination` | `app-marketplace/MarketplacePagination.tsx` | `Pagination` | 2 | Medium |
| 23 | `QualityBadge` (CSS) | `app-marketplace/QualityBadge.tsx` | `Badge` | 2 | Low |
| 24 | `PricingTag` (CSS) | `app-marketplace/PricingTag.tsx` | `Badge`/`Chip` | 2 | Low |
| 25 | `StubPage` (CSS) | `merchant/StubPage.tsx` | `EmptyState` | 2 | Low |
| 26 | `TrialBanner` (CSS) | `merchant/TrialBanner.tsx` | `Banner` | 2 | Low |
| 27 | `InfoPlaceholder` | `theme/info-placeholder.tsx` | `EmptyState` | 1 | Low |
| 28-31 | inline `Field`/`TextField`/`SelectField` ×5 | console/ops pages | `Input`/`Select` | inline | Medium |
| 32 | `ConsoleApiErrorPanel`/`ConsoleSearchForm` | `ConsoleDataTable.tsx:113,144` | `Banner`/`FilterBar` | local | Medium |

(Net-new components with no canonical equivalent — `StarRating`, device-frame editor widgets — are correctly local and excluded.)

## Ownership map
| Owner | What it should own | Currently forked in |
|---|---|---|
| `@letbuyy/ui` feedback | Badge/StatusBadge, Banner, EmptyState, Skeleton, Toast | console/ops `StatusPill`+`EmptyDataState`+`SkipBackendPanel`; app-marketplace `marketplace-badge`/`QualityBadge`; merchant `StubPage`/`TrialBanner`; `MarketplaceSkeleton` |
| `@letbuyy/ui` layout | Card, Grid, Columns, Page, Section | console/ops `Panel`+`ModuleCard`+`MetricGrid`; `app-card`/`developer-card`/`glass-card`/`ThemeCard` |
| `@letbuyy/ui` productivity | MetricCard, Pagination, CommandPalette, FilterBar | console/ops `LeadershipMetric`/`OpsMetric`; `MarketplacePagination`; merchant `CommandPalette` |
| `@letbuyy/ui` data | Table | `ConsoleDataTable`; developer `EndpointTable` |
| `@letbuyy/ui` controls | Button, Input, Select, Checkbox… | CSS `btn-primary`; inline `Field`/`TextField`/`SelectField` |

## Migration priority
1. **Promote the workspace grammar** (`Panel`/`MetricGrid`/`ModuleCard`/`LeadershipMetric`/`OpsMetric`/`StatusPill`/`EmptyDataState`) into `@letbuyy/ui` (they overlap `Card`/`MetricCard`/`Grid`/`StatusBadge`/`EmptyState`), migrate the 18 console/ops consumer pages, delete both `_local-ui/*-workspace.tsx` twins. Removes the top-6 most-used forks at once.
2. **Kill the CSS-class systems**: replace `btn-primary`→`Button`, `app-card`/`developer-card`/`glass-card`→`Card`, `marketplace-badge`→`StatusBadge`. Add a stylelint/grep rule that flags `.btn-`, `.app-card`, `.*-badge` class definitions in app `globals.css`.
3. **Tables/breadcrumbs/pagination**: `ConsoleDataTable`→`Table`, `MarketplaceBreadcrumbs`→`Breadcrumbs`, `MarketplacePagination`→`Pagination`.
4. **Marketing forks**: `ThemeCard`/`AppCard` → `Card` wrappers.

**Governance gap:** import-based lint cannot see CSS-class forks. Add a `no-shadow-component-classes` check to `validate:design-system` that fails on class definitions matching button/card/badge/pill/table patterns in app CSS.
