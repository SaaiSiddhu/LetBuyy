# Dashboard Governance Report — Phase 1.5 Adoption

**Date:** 2026-06-09 · read-only · calculated.
**Scope:** dashboards, KPI/metric/analytics cards, and workspace layouts across merchant-control-plane, platform-console, platform-operations-portal, identity-platform, app/theme-marketplace, storefront-runtime, marketing-site (+ mobile, see `MOBILE_DESIGN_SYSTEM_REPORT.md`).

## How many dashboard systems exist
**7 distinct metric/dashboard systems: 1 canonical + 6 local.** Canonical `MetricCard` (`@letbuyy/ui` productivity) is adopted on only a handful of pages; every dashboard-bearing app ships its own card/metric grammar.

## Dashboard inventory
| App | System | Evidence | Canonical? |
|---|---|---|---|
| merchant-control-plane | canonical `MetricCard` ×11 | `[store]/dashboard/DashboardClient.tsx:287-305`, `analytics/page.tsx`, `ai/page.tsx` | **CANONICAL ✅** |
| platform-console | `LeadershipMetric`+`MetricGrid`+`Panel`+`ModuleCard`+`StatusPill` | `(dashboard)/dashboard/page.tsx:3-9` → `_local-ui/console-workspace` | LOCAL (dominant) |
| platform-console | canonical `MetricCard` ×4 | `(dashboard)/audit-logs/page.tsx:92-103` | CANONICAL (minority) → **2 systems in one app** |
| platform-operations-portal | `OpsMetric`+`MetricGrid`+`Panel`+`ModuleCard` | `(dashboard)/page.tsx:1-8` → `_local-ui/ops-workspace` | LOCAL (dominant) |
| platform-operations-portal | canonical `MetricCard` ×8 | `operations/communications`, `operations/onboarding` | CANONICAL (minority) → **2 systems in one app** |
| developer-portal | `developer-card` CSS tiles | `app/dashboard/page.tsx:16,31` (17 spans) | LOCAL |
| theme-marketplace | `glass-card` Tailwind stat tiles | `app/dashboard/page.tsx:42-65` (`STATS` array) | LOCAL |
| storefront-runtime | `StatCard` CSS (`stat-card`/`stat-value`) | `app/storefront-landing.tsx:421` | LOCAL |
| marketing-site | `hero-metric`/`mockup-stat-card` decorative | `Hero.tsx:90-96`, `SiteTypes.tsx:66-69` | LOCAL |
| identity-platform | none (auth only) | — | — |

> **Dashboard adoption: ~1 of 7 systems is canonical.** The two internal-ops apps that adopted the canonical *shell* still run **two** metric systems each (local workspace + canonical `MetricCard`), which is the clearest single proof that "architecture fixed, adoption not."

## Duplication map
- **console-workspace.tsx ↔ ops-workspace.tsx** are near-identical twins (same `MetricGrid`/`Panel`/`ModuleCard`/`StatusPill`/`EmptyDataState`/`SkipBackendPanel` grammar, renamed metric component `LeadershipMetric` vs `OpsMetric`). ~190 lines each, ~63-line diff.
- `developer-card`, `glass-card`, `stat-card` are three more independent KPI-tile implementations, all duplicating what `MetricCard` provides (label, value, delta, sparkline area).
- Metric "delta/trend" styling diverges (color, arrow, sparkline) across all six local systems → dashboards look like six products.

## Unified dashboard architecture (target)
One canonical dashboard kit in `@letbuyy/ui`:
- **`MetricCard`** (exists) — the single KPI tile (label, value, delta, trend, optional sparkline).
- **Promote** a `Workspace` + `MetricGrid` + `Panel` layout grammar from the console/ops twins into `@letbuyy/ui` (they generalize `Page`/`Section`/`Card`/`Grid`).
- **Charts** via the existing `Chart` export; status via `StatusBadge`.
- Every dashboard page composes `Page > MetricGrid(MetricCard…) > Panel(Chart/Table)`.

## Migration order
1. **Promote workspace grammar → `@letbuyy/ui`**, migrate console (`dashboard`, `revenue`, `analytics`, `risk`, `stores`, …) + ops (`page`, `operations`, `risk`, `tickets`, `trust-safety`, `developers`) dashboard pages, delete both `_local-ui` twins. Collapses 4 of the 6 local systems and removes the "2 systems per app" contradiction.
2. **theme-marketplace** `glass-card` → `MetricCard` (dashboard `STATS`).
3. **developer-portal** `developer-card` → `MetricCard`.
4. **storefront-landing** `StatCard` → `MetricCard`; marketing decorative tiles can stay (they're illustrative, not data).

**Impact:** dashboards across the 5 data-bearing apps render one KPI grammar; delta/trend/sparkline become consistent; `validate:design-system` gains a check that fails on local `*Metric`/`*Card`/`stat-card` definitions outside `@letbuyy/ui`.
