# LetBuyy — Navigation Governance Audit

**Auditor:** Principal Design Systems Architect / UI Governance
**Date:** 2026-06-09
**Scope:** Navigation and app-shell consistency across the 9 web apps, benchmarked against the canonical `@letbuyy/ui` shell.
**Method:** Read `app-shell.tsx`; located every app's primary nav/shell; verified zero shell imports and catalogued widths/active-state strategies. No code modified.

> **One-line verdict:** `@letbuyy/ui` ships a clean, token-driven, accessible app-shell (`AppFrame` + `Sidebar` + `Navigation` with built-in active state and `aria-current`) — and **0 of 9 apps use it.** The platform runs **10 hand-rolled navigation implementations** with **4 different sidebar widths**, **5 different active-state strategies**, and 2 apps with no active-state highlight at all. The canonical shell is library theater: well-built, unconsumed.

---

## 1. The canonical shell (unused)

`packages/typescript/ui/src/app-shell.tsx` (111 lines), re-exported at `index.ts:95-96`:

| Export | What it provides |
|---|---|
| `Navigation` (`app-shell.tsx:22`) | Token-driven nav list from `items[]`; built-in active state → `--lb-component-sidebar-active-bg`, `aria-current="page"`, hover, badge, icon sizing, focus ring. |
| `Sidebar` (`app-shell.tsx:78`) | `<aside>` with header/footer slots; widths `sm 220px` / `md 260px` / `lg 320px` (`:72-76`); token border/bg. |
| `AppFrame` (`app-shell.tsx:97`) | Page frame: `sidebar` slot + `topBar` slot + `<main>`; tokens `--lb-color-bg/header/border`. |

It is correct, themable, and a11y-aware. Nothing consumes it.

---

## 2. The reality — 10 implementations

| App | Uses `@letbuyy/ui` shell? | Nav type | Local file(s) | Token-styled? | Active-state |
|---|---|---|---|---|---|
| platform-console | No | Left sidebar | `(dashboard)/layout.tsx` inline `<aside>` + `ConsoleNavLink` | Yes (`bg-[var(--lb-color-surface)]`) | **None** |
| platform-operations-portal | No | Left sidebar | `(dashboard)/layout.tsx` inline `<aside>` + `TeamNavLink` | Yes | **None** |
| merchant-control-plane | No | Sidebar + HeaderBar + CommandPalette + AISidebar | `Sidebar.tsx`, `HeaderBar.tsx`, `AdminShell.tsx`, `merchantNavigation.ts` | Yes (CSS → `var(--lb-*)`) | query-aware `isNavPathActive` + `.active` |
| theme-marketplace | No | Top navbar **and** dashboard sidebar | `navbar.tsx` + `dashboard/layout.tsx` | Mixed (`bg-white/[0.06]`, `rounded-xl`) | `pathname === item.href` |
| app-marketplace | No | Marketing header + mega-menu | `Header.tsx` | Mostly hardcoded (`rgba(5,7,12,0.98)`) | "active" = dropdown-open |
| marketing-site | No | Marketing header + mega-menu | `Header.tsx` | Mostly hardcoded (`rgb(255 255 255)`) | "active" = dropdown-open |
| developer-portal | No | Top header | `PortalChrome.tsx` | Yes (`.developer-*` → `var(--lb-*)`) | header nav |
| storefront-runtime | No | Tenant shopper header **and** account sidebar | `dynamic-header.tsx` + `account/layout.tsx` | Mixed (inline `'white'`, `rgb(...)`) | `usePathname` |
| identity-platform | No | **None** (auth flow only) | — | n/a | n/a |

**Distinct implementations: 10** across 8 apps (storefront and theme-marketplace each have two; identity has none).

---

## 3. Findings

### NAV-1 — 0/9 adoption of the canonical app-shell
**Severity: High** · **Affected: all 8 apps with navigation**

**Root cause.** The shell shipped after apps had already built navigation, and nothing (lint, review checklist, governance validator) requires using it. There is no incentive or gate to converge.

**Code evidence.** `rg "AppFrame|Navigation|Sidebar" apps/*/src --glob '*.tsx'` returns only local components; no import of these from `@letbuyy/ui`. `index.ts:95` exports them; consumers: none.

**Recommended canonical direction.** Adopt `AppFrame`+`Sidebar`+`Navigation` in the three "operations/admin" apps first (console, ops, merchant) — they're already token-styled and closest in shape. Drive nav from a data array (`NavigationItem[]`) per app. Treat the marketing/storefront headers as a separate "marketing nav" pattern (they are legitimately different) but still extract a shared component.

---

### NAV-2 — platform-console & platform-operations-portal sidebars are near-identical twins
**Severity: High** · **Affected: platform-console, platform-operations-portal**

**Root cause.** The two operations apps were forked from one template; their `(dashboard)/layout.tsx` sidebars are effectively the same markup (`<aside className="hidden w-72 border-r border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] lg:block">`), the same brand block, the same per-link component shape — and **both lack any active-route highlight** (server components, no `usePathname`). This pairs with the `_local-ui` workspace twins (`COMPONENT_DUPLICATION_REPORT.md` DUP-3).

**Code evidence.** `platform-console/.../layout.tsx:29` vs `platform-operations-portal/.../layout.tsx:10` (matching `<aside>`); neither imports `usePathname`.

**Recommended canonical direction.** Collapse both into the canonical `Sidebar`+`Navigation` (which gives active state for free) — the single highest-leverage nav consolidation.

---

### NAV-3 — Four sidebar widths for one concept
**Severity: Medium** · **Affected: console/ops (`w-72`), theme-marketplace dashboard (`w-56`), storefront account (`w-64`), canonical default (`w-[260px]`)**

**Root cause.** Each implementation picked its own width literal; the canonical `Sidebar` width scale (`sm/md/lg` = 220/260/320, `app-shell.tsx:72-76`) is unused. Side-by-side, LetBuyy's "left nav" is visibly different per app.

**Recommended canonical direction.** Standardize on the `Sidebar width` prop; pick one default (`md`) for admin/operations surfaces.

---

### NAV-4 — Five active-state strategies; two apps have none
**Severity: Medium** · **Affected: all nav apps**

**Root cause.** No shared active-state contract. Strategies observed: merchant query-aware `isNavPathActive`; theme-marketplace `pathname === href`; storefront `usePathname`; marketing/app-marketplace repurpose "active" to mean dropdown-open; console/ops have none. The canonical `Navigation` already encodes `item.active → aria-current="page"` + active styling (`app-shell.tsx:29-31,49,53`), unused.

**Recommended canonical direction.** Adopt `Navigation`'s `item.active` contract everywhere; compute `active` from `usePathname` in one shared helper.

---

### NAV-5 — Hardcoded colors in marketing/storefront nav chrome
**Severity: Medium** · **Affected: marketing-site, app-marketplace, storefront-runtime, theme-marketplace**

**Root cause.** Marketing/storefront headers predate token discipline and set raw colors: `marketing-site/Header.tsx` nav states use `rgb(255 255 255)`/`rgba(255,255,255,0.55)`; `app-marketplace` `.appstore-header` uses `rgba(5,7,12,0.98)`; storefront header has inline `style={{color: scrolled ? 'var(--text-secondary)' : 'white'}}`; theme-marketplace nav uses `bg-white/[0.06]`. These nav bars will not theme.

**Code evidence.** `marketing-site/src/components/Header.tsx:501,513`; `app-marketplace/src/app/globals.css:276-296`; `storefront-runtime/src/components/layout/dynamic-header.tsx:199,242,464`.

**Recommended canonical direction.** Route nav colors through `--lb-color-*`; covered by the stylelint activation in `DESIGN_TOKEN_AUDIT.md` TOK-1.

---

## 4. Navigation-consistency scorecard (component of the master scorecard)

| Dimension | Rating | Basis |
|---|---|---|
| Canonical shell quality | **4.0 / 5** | Token-driven, a11y, width scale, active state. |
| Shell adoption | **1.0 / 5** | 0/9. |
| Structural consistency (width/layout) | **2.0 / 5** | 4 widths, 10 implementations. |
| Active-state / a11y consistency | **2.0 / 5** | 5 strategies, 2 apps none. |
| Nav theming discipline | **2.5 / 5** | Operations apps clean; marketing/storefront hardcoded. |
| **Navigation consistency (overall)** | **1.5 / 5** | Good shell, near-zero governance. |

See `DESIGN_SYSTEM_MASTER_AUDIT.md` for the consolidated scorecard and remediation order.
