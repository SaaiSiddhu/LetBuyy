# 11 — Commerce Navigation

**Result: every commerce page is reachable — no dead links, routes, buttons, or orphan pages.**

## Main nav (Products group, `merchantNavigation.ts`)
Purchase orders, Transfers, Inventory history, Vendors, Locations — all linked (Phase 5/5.5 additions), all resolve to real pages. Command palette + search derive from this tree (keywords included).

## Settings sub-pages (settings index `itemHrefs`)
The settings index page lists its sub-pages via `itemHrefs`:
- `payments` (line 44 group) → functional payment toggles (this wave).
- `notifications` (line 51 group) → notification ops page (this wave).
Both are reachable from the settings index — no orphans.

## Dead-element check
- Every new page's action buttons (create/ship/receive/toggle/save) call real proxies → gateway → RPCs (verified by per-vertical contract tests). No dead buttons.
- Every nav/settings path resolves to a real `page.tsx` (contract-tested; Phase-4-lock route registry confirmed resolution).

## Not added to nav (correct — they have no real backend yet)
The intelligence/analytics dashboards (`01`,`08`,`09`,`10`), audit system (`04`), reservation explorer (`02`), receipt history (`03`), and smart-collection builder (`07`) are NOT in nav — because their pages are not built (they need absent metrics endpoints / new schema). Adding nav links to non-existent pages would be the dead-navigation the mission forbids.

**Verdict:** navigation is complete + dead-link-free for every shipped commerce page; unbuilt verticals are correctly absent from nav (no orphans, no dead links).
