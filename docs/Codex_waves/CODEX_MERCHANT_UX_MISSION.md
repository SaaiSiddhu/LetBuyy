# CODEX MERCHANT UX MISSION — LetBuyy WS2 (Multi-Agent Updated)

**Driver:** Codex agent(s). Reasoning: `xhigh` for theme editor, `medium` for page migrations.
**Mode:** Continuous, autonomous. 2-3 agents parallelizable within this workstream.
**Domain Ownership:** `apps/merchant-control-plane/src/**` ONLY.
**Dependencies:** `@letbuyy/ui` (WS1, consume only), Storefront preview route (WS4/SF2).
**Base Mission:** `CODEX_SHOPIFY_UX_MISSION.md` (phases UX0-UX2 done, UX3 in progress).

---

## 0. DOMAIN OWNERSHIP CLARITY

This mission is the **continuation** of the existing `CODEX_SHOPIFY_UX_MISSION.md`. It owns:
- `apps/merchant-control-plane/src/**` — all pages, components, hooks, lib files

It does NOT own (these have dedicated workstreams):
- `packages/typescript/ui/**` → WS1 (Design System)
- `apps/app-marketplace/**` → WS3 (Marketplace UX)
- `apps/theme-marketplace/**` → WS3 (Marketplace UX)
- `apps/storefront-runtime/**` → WS4 (Storefront)
- `apps/platform-console/**` → WS5 (Operations)
- `apps/platform-operations-portal/**` → WS5 (Operations)
- `apps/identity-platform/**` → WS6 (Identity)
- `apps/marketing-site/**` → WS6 (Marketing)
- `apps/mobile/**` → WS8 (Mobile)

---

## 1. REMAINING WORK (UX3→UX11)

### Status as of 2026-06-02
- **UX0:** ✅ Done (baseline audit, before screenshots)
- **UX1:** ✅ Done (tokens, components, Storybook)
- **UX2:** ✅ Done (layout grammar, 8 major pages migrated)
- **UX3:** 🟠 In Progress (~30 pages migrated, remaining secondary pages need completion)
- **UX4-UX11:** Not started

### UX3 Completion — Feedback System (finish remaining pages)
- Identify any unmigrated pages under `apps/merchant-control-plane/src/app/[store]/`
- Migrate each to shared component grammar with toasts, skeletons, save bars, confirm dialogs
- **GATE:** Every page has feedback; governance 128/128

### UX4 — Empty States
- Apply `EmptyState` to every list/page that can be empty
- **GATE:** Zero blank pages; before/after screenshots

### UX5 — Navigation Restructure
- **UX5.1** Regroup sidebar: ~9 grouped items (Home/Orders/Products/Customers/Marketing/Content/Online Store/Apps/Analytics + Settings)
- **UX5.2** Migrate existing `CommandPalette.tsx` to use shared `@letbuyy/ui` CommandPalette
- **UX5.3** Add ⌘K entity search (products/orders/customers via existing api-client)
- **UX5.4** Add keyboard shortcuts (g+p, g+o, g+c, n)
- **GATE:** Grouped nav + palette; every old route reachable; before/after screenshots

### UX6 — Dashboard Redesign
- **UX6.1** Setup guide checklist (Add product · Customize theme · Set up payment · Connect domain · Launch)
- **UX6.2** MetricCard grid (Revenue, Orders, Visitors, Conversion)
- **UX6.3** Recent activity card
- **UX6.4** Recommended next actions
- **GATE:** Dashboard redesigned; before/after screenshots

### UX7 — Theme Editor (FLAGSHIP — coordinate with WS4)
- **UX7.1** Theme library page: Current theme + Draft themes grid
- **UX7.2** Live preview canvas: iframe pointing to WS4/SF2 preview route
- **UX7.3** Section tree: left rail with drag-drop reorder + add/remove
- **UX7.4** Visual selection: postMessage sync between iframe and settings rail
- **UX7.5** Device toggle: Desktop/Tablet/Mobile
- **DEPENDENCY:** WS4/SF2 must build the storefront preview route first. If not available, build everything except the iframe content and log `[SKIP — NEEDS WS4]`.
- **GATE:** Live preview operational; section manipulation works; screenshots

### UX8 — App Experience (within merchant control plane)
- **UX8.1** In-admin app list redesign (installed apps view)
- **UX8.2** App settings/configuration pages
- **Note:** The marketplace itself is WS3's domain. This covers the merchant's installed-apps view.
- **GATE:** Installed apps view redesigned; before/after screenshots

### UX9 — Productivity
- **UX9.1** IndexTable adoption for Products, Orders, Customers
- **UX9.2** Bulk actions (archive, status, export)
- **UX9.3** Saved views/tabs
- **UX9.4** Filter chips
- **UX9.5** Inline editing where safe
- **GATE:** Lists upgraded; before/after screenshots

### UX10 — Mobile Responsive
- **UX10.1** Mobile nav drawer
- **UX10.2** Bottom-sheet actions
- **UX10.3** Responsive tables → cards at < 640px
- **UX10.4** Responsive forms
- **GATE:** 375px viewport screenshots; critical workflows usable

### UX11 — Visual Polish
- **UX11.1** Typography/spacing/motion consistency pass
- **UX11.2** Replace remaining emoji/ad-hoc SVG with Lucide
- **UX11.3** Accessibility pass (focus order, ARIA, contrast)
- **UX11.4** Final globals.css elimination sweep (target < 1000 lines)
- **GATE FINAL:** consistency audit; all §0 criteria proven; globals.css minimized

---

## 2. PARALLELIZATION WITHIN WS2

This workstream can safely run 2-3 agents simultaneously:

| Agent | Scope | Files |
|-------|-------|-------|
| Agent A | UX3 completion + UX4 | Secondary page files under `[store]/` |
| Agent B | UX5 + UX6 | `Sidebar.tsx`, `CommandPalette.tsx`, `HeaderBar.tsx`, `dashboard/` |
| Agent C | UX7 | `theme-editor/`, `online-store/` |

**Collision rule:** Each agent owns specific files. If two agents need the same file, serialize — the lower-numbered phase goes first.

---

## 3. OPERATING CONTRACT

Same as the base `CODEX_SHOPIFY_UX_MISSION.md` §1, with these additions:
- Touch ONLY `apps/merchant-control-plane/src/**`
- Coordinate with WS4 for preview route availability
- Continue maintaining `CODEX_SHOPIFY_UX_LEDGER.md`

---

## 4. LAUNCH PROMPT (per agent)

```
Read CODEX_MERCHANT_UX_MISSION.md and CODEX_SHOPIFY_UX_MISSION.md in full.
Continue from where UX3 left off. Execute the assigned phases continuously.

Hard rules (same as base mission):
- Touch ONLY apps/merchant-control-plane/src/**.
- Compose every screen from @letbuyy/ui.
- Visual proof: before/after screenshots.
- Keep governance 128/128 green after every commit.
- If the storefront preview route (WS4/SF2) is not yet available, build the theme editor
  UI and log [SKIP — NEEDS WS4] for the iframe content.
- Max 3 attempts per task then BLOCKED.
- Continue maintaining CODEX_SHOPIFY_UX_LEDGER.md.

Begin now.
```
