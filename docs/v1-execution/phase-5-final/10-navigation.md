# 10 — Navigation Completion

**Result: every shipped commerce page is reachable — no dead routes, links, buttons, or orphan pages.**

## Products group (`merchantNavigation.ts`) — now 13 children
Add product · Collections · **Smart collections** (new) · Inventory · Inventory history · **Reservations** (new) · Categories · Purchase orders · Transfers · **Receipts** (new) · Vendors · Locations · Gift cards. Every `path` resolves to a real `page.tsx`. Command palette + search derive from this tree (keywords included).

## Settings sub-pages (settings index `itemHrefs`)
`payments` (functional toggles) + `notifications` (ops UI) — reachable from the settings index.

## Dead-element check
- Every nav/settings path → a real page (contract-tested: the `5.5`/`5.9` Navigation tests assert all new paths are present).
- Every new page's action buttons (create/ship/receive/save/preview/toggle) call real proxies → gateway → RPCs (per-vertical contract tests). No dead buttons.

## Correctly NOT in nav (no orphans, no dead links)
The audit system (`04`, net-new schema) and full analytics dashboards (`06`, additive endpoints) are NOT built → NOT linked. Adding links to non-existent pages would be the dead navigation the mission forbids.

**Verdict:** navigation is complete + dead-link-free across every shipped commerce vertical; unbuilt items are correctly absent.
