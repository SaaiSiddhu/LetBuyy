# Shell Governance Report — Phase 1.5

**Date:** 2026-06-09 · read-only · calculated. Focus: the *frame* around pages — app-shells, page-containers, workspace shells, header/sidebar systems — distinct from the route-level nav inventory in `NAVIGATION_GOVERNANCE_REPORT.md`.

## How many shell systems exist
**1 canonical + ~11 local = ~12 shell systems.** Plus an under-adopted page-container primitive (`Page`/`PageHeader`/`PageContent`) and two workspace page-containers that sit *inside* the canonical shell.

## Shell inventory
| # | Shell system | File | Kind | Canonical? |
|---|---|---|---|---|
| 0 | `AppNavigation` (AppFrame+Sidebar+Navigation) | `@letbuyy/ui` `src/navigation` | app-shell | **CANONICAL** — used by console, ops |
| 1 | `AdminShell` + `Sidebar` + `HeaderBar` + `AISidebar` | `merchant-control-plane/src/components/{AdminShell,Sidebar,HeaderBar,AISidebar}.tsx` | app-shell (140+180+427+328 L) | LOCAL |
| 2 | `SettingsShell` | `merchant-control-plane/src/components/settings/SettingsShell.tsx` (274 L) | nested 2nd shell | LOCAL |
| 3 | `PortalChrome` (`PortalHeader`/`PortalLayout`) | `developer-portal/src/components/PortalChrome.tsx` (160 L) | app-shell | LOCAL |
| 4 | `DeveloperHeader` | `developer-portal/src/components/_local-ui/developer-docs.tsx:42` | competing 2nd header | LOCAL |
| 5 | `Header` (`.appstore-header`) | `app-marketplace/src/components/Header.tsx` (415 L) | topnav shell | LOCAL |
| 6 | `Header` (`.header-nav`) | `marketing-site/src/components/Header.tsx` (636 L) | topnav shell | LOCAL |
| 7 | `dynamic-header` | `storefront-runtime/src/components/layout/dynamic-header.tsx` (544 L) | tenant topnav (theme-engine) | LOCAL |
| 8 | account layout shell | `storefront-runtime/src/app/store/[subdomain]/account/layout.tsx` (142 L) | page-layout + sidebar | LOCAL |
| 9 | `navbar` | `theme-marketplace/src/components/layout/navbar.tsx` (679 L) | topnav shell | LOCAL |
| 10 | dashboard layout shell | `theme-marketplace/src/app/dashboard/layout.tsx` (95 L) | page-layout + sidebar | LOCAL |
| 11 | `anonymous-preview-shell` | `theme-marketplace/src/components/anonymous-preview-shell.tsx` | preview shell | LOCAL |
| — | `ConsoleWorkspace` / `OpsWorkspace` | `*/_local-ui/*-workspace.tsx` | page-container *inside* AppNavigation | LOCAL |

## Page-container governance (the missing middle layer)
`@letbuyy/ui` exports `Page`/`PageHeader`/`PageContent`/`Section` — the intended page-container. Adoption is uneven, so there is no single "this is a page" frame:

| App | `Page`/`PageHeader` usage | Page framing in practice |
|---|---|---|
| merchant-control-plane | ~34 files | canonical (good) |
| theme-marketplace | ~17 | mostly canonical |
| platform-console | 1 | bespoke `ConsoleWorkspace` |
| platform-operations-portal | 2 | bespoke `OpsWorkspace` |
| developer-portal | 4 | `PortalChrome`/CSS |
| app-marketplace / marketing / storefront / identity | 0 | bespoke per-page CSS |

> Four apps frame **zero** pages with the canonical `Page`. This is the deepest cause of cross-app rhythm/density divergence (`CROSS_APP_CONSISTENCY_REPORT.md` root cause 4).

## Duplicate shell systems (themes of duplication)
- **merchant runs 2 shells** (`AdminShell` + nested `SettingsShell`).
- **developer-portal runs 2 headers** (`PortalChrome` + `DeveloperHeader`).
- **theme-marketplace runs 3 shells** (`navbar` + dashboard layout + `anonymous-preview-shell`).
- **storefront runs 3** (`dynamic-header` + account layout + landing-nav).
- **console/ops adopted the shell but kept bespoke page-containers** inside it.

## Target shell architecture
Three shell archetypes, all from `@letbuyy/ui`:
1. **Admin/operations shell** → `AppNavigation` (sidebar + topbar). Owners: merchant, console, ops, developer-portal dashboard. Page body always `Page > Section`.
2. **Marketing/brochure shell** → new `MarketingHeader`/`MarketingFooter` primitive. Owners: marketing, app-marketplace, theme-marketplace public, storefront landing.
3. **Tenant storefront shell** → keep theme-engine-driven `dynamic-header` but consume the marketing primitive + `--lb-*` tokens; account area uses `AppNavigation`.
Plus: **enforce `Page` as the only page-container** (lint: an app route that renders content without a `Page`/canonical shell fails the nav/shell gate).

## Migration order
1. Promote workspace page-containers (`Workspace`/`MetricGrid`/`Panel`) into `@letbuyy/ui`; migrate console/ops pages to `Page` + promoted grammar; delete `_local-ui` twins.
2. merchant `AdminShell`/`Sidebar` → `AppNavigation`; collapse `SettingsShell` into a nested `Page` section.
3. developer-portal `PortalChrome` → `AppNavigation`; delete `DeveloperHeader`.
4. Extract `MarketingHeader/Footer`; migrate marketing/app-marketplace/theme `navbar` (3→1).
5. storefront account → `AppNavigation`; tenant header consumes shared primitive.

**Enforcement gap:** add a shell-adoption check to `validate:design-system` (warn→error) — an app dashboard/admin layout that defines a local `<aside>`/`<header>` shell instead of importing `AppNavigation`, or a route that renders without `Page`, fails.
