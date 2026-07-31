# 08 — Navigation Integration

**Result: every new commerce page is reachable — no dead navigation, no dead buttons.**

## Nav entries added (`components/merchantNavigation.ts`, Products group)
| Page | Nav label | Status |
|---|---|---|
| `products/inventory-history` | Inventory history | **NEW this phase** |
| `products/suppliers` | Vendors | **NEW this phase** |
| `products/locations` | Locations | **NEW this phase** |
| `products/transfers` | Transfers | existing nav entry; stub → real page this phase |
| `products/purchase-orders` | Purchase orders | existing (Phase 5) |

## Command palette + search
`getMerchantCommandItems` derives palette/search entries from the nav tree + children, so all new pages are also command-palette + search addressable (with keywords: movements/ledger/audit, supplier/vendor, warehouse/location).

## Dead-link / dead-button check
- Every nav `path` resolves to a real `page.tsx` (contract-tested: `5.5 Navigation` test asserts the 3 new paths are present; the Phase-4-lock route-registry check confirmed all paths resolve).
- New pages' action buttons (create/ship/receive) call real proxies → gateway → RPCs (no dead buttons; verified by the per-vertical contract tests).

**Verdict:** navigation, command palette, and search include every new commerce page; no dead links or buttons introduced.
