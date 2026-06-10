# Navigation Governance Report — Phase 1.5 Adoption

**Date:** 2026-06-09 · **Mode:** read-only investigation · **State:** post Design-Governance-Recovery.
**Method:** parsed `@letbuyy/ui` import specifiers and enumerated every `layout.tsx` / shell / nav component across the 9 web apps (VM `/sessions/festive-funny-euler/mnt/Letbuyy_Store`). Counts are calculated, not estimated.

## Current adoption

The recovery shipped the canonical shell (`AppNavigation` + `AppFrame`/`Sidebar`/`Navigation` in `packages/typescript/ui/src/navigation`). Adoption of it:

| Metric | Value |
|---|---|
| Apps importing the canonical shell | **2 / 9 = 22%** (`platform-console`, `platform-operations-portal`, both via `AppNavigation`) |
| Apps importing `AppFrame`/`Sidebar`/`Navigation` directly | **0 / 9** |
| Distinct **local** navigation/shell systems still shipping | **~10** |
| Route `layout.tsx` files total | **20** (9 root + 11 nested) |

> **Adoption % (navigation): 22%. Remaining migration: 78%.**

Verified: only `apps/platform-console/src/app/(dashboard)/layout.tsx:19` and `apps/platform-operations-portal/src/app/(dashboard)/layout.tsx:1` import `AppNavigation`. Earlier broad greps suggesting merchant/storefront/theme adoption were false positives (local component *names* `Sidebar`/`Navigation`, not imports).

## File-by-file inventory

| App | Shell/nav file(s) | Type | Canonical? |
|---|---|---|---|
| platform-console | `src/app/(dashboard)/layout.tsx:19` | app-shell | **AppNavigation ✅** |
| platform-operations-portal | `src/app/(dashboard)/layout.tsx:1` | app-shell | **AppNavigation ✅** |
| merchant-control-plane | `src/components/AdminShell.tsx` (140 L) + `Sidebar.tsx` (180 L) + `HeaderBar.tsx` (427 L) + `AISidebar.tsx` (328 L) + `merchantNavigation.ts` | app-shell + 2 sidebars + header | LOCAL |
| merchant-control-plane | `src/components/settings/SettingsShell.tsx` (274 L) | nested 2nd shell | LOCAL |
| app-marketplace | `src/components/Header.tsx` (415 L) mounted per-page ×15+ | topnav (`.appstore-header`) | LOCAL |
| marketing-site | `src/components/Header.tsx` (636 L) | topnav (`.header-nav`) | LOCAL |
| storefront-runtime | `src/components/layout/dynamic-header.tsx` (544 L) | topnav (theme-engine driven) | LOCAL |
| storefront-runtime | `src/app/store/[subdomain]/account/layout.tsx` (142 L) | account sidebar + mobile nav | LOCAL |
| storefront-runtime | `src/app/storefront-landing.tsx` | `landing-nav` | LOCAL |
| theme-marketplace | `src/components/layout/navbar.tsx` (679 L) | topnav | LOCAL |
| theme-marketplace | `src/app/dashboard/layout.tsx` (95 L) | dashboard sidebar + mobile nav | LOCAL |
| developer-portal | `src/components/PortalChrome.tsx` (160 L) | app-shell + header | LOCAL |
| developer-portal | `src/components/_local-ui/developer-docs.tsx:42` `DeveloperHeader` | competing 2nd header | LOCAL |
| identity-platform | none (auth pages; root theme only) | — | — |

Nested route shells that frame pages differently from their app root: `merchant-control-plane/src/app/[store]/layout.tsx`, `.../settings/layout.tsx`, `.../checkout/layout.tsx`; `storefront-runtime/.../[subdomain]/{layout,account,cart,checkout/success}/layout.tsx`; `theme-marketplace/.../dashboard/layout.tsx`.

## Duplicate navigation systems
Counting distinct shell codebases: **1 canonical (`AppNavigation`)** + **10 local** = sidebar widths, active-state strategies, and header layouts still diverge. Active-state is computed ≥5 ways (`usePathname().includes`, `=== href`, `startsWith`, dropdown-open-as-active, none) versus the canonical `isNavItemActive`. Console/ops mount the canonical shell but still render bespoke `ConsoleWorkspace`/`OpsWorkspace` page-containers inside it.

## Target architecture
One shell vocabulary from `@letbuyy/ui`:
- **Admin/operations surfaces** (merchant, console, ops, developer-portal dashboard) → `AppNavigation` with a per-app `sections` array; delete local `AdminShell`/`Sidebar`/`PortalChrome`/inline sidebars.
- **Marketing/storefront surfaces** (marketing, app-marketplace, storefront, theme-marketplace) → a shared `MarketingHeader`/`MarketingFooter` (a new canonical pattern; legitimately distinct from the admin shell but currently 4 forks). Storefront tenant header stays theme-engine-driven but consumes the shared primitive.
- **Identity** → no nav; already minimal.

## File-by-file migration inventory (priority order)
1. **merchant-control-plane** (highest traffic admin) — `AdminShell.tsx` + `Sidebar.tsx` → `AppNavigation`; keep `merchantNavigation.ts` as the `sections` data; fold `HeaderBar` into `topBar`. Impact: removes ~900 lines of shell, adds canonical active-state + width.
2. **developer-portal** — `PortalChrome.tsx` → `AppNavigation`; delete competing `DeveloperHeader` in `_local-ui/developer-docs.tsx`.
3. **Marketing kit** — extract `MarketingHeader`/`MarketingFooter` into `@letbuyy/ui`; migrate `marketing-site/Header.tsx`, `app-marketplace/Header.tsx`, `theme-marketplace/navbar.tsx` (3 forks → 1).
4. **storefront** — `account/layout.tsx` sidebar → `AppNavigation`; tenant `dynamic-header.tsx` consumes the shared marketing header primitive.

**Governance gap:** the design-system validator does not yet flag hand-rolled `<aside>`/`<nav>` shells. Add a nav-adoption check (warn) to `validate:design-system` that fails when an app `(dashboard)`/admin layout defines a local `<aside class=…sidebar…>` instead of importing `AppNavigation`.
