# 12 — Operations UI

**Pattern:** every ops UI is the proven api-client → proxy → page vertical (4.5/4.75), over the REAL commerce backend. Compile + contract verifiable; flow verification needs a live stack.

## Shipped this phase
- **Purchase Orders** — the proof vertical: api-client `inventory.purchaseOrders/suppliers/locations` + proxies + a real PO list/create/receive page replacing the stub. (See `05`; built + verified — `tsc` EXIT 0 + contract tests.)

## Specced + ready (same pattern, not built this phase)
| UI | Backend | api-client to add | Status |
|---|---|---|---|
| Inventory history/movements + reservations | REAL (`/inventory/history`, `inventory_events`) | `inventory.{history,reserve,commit,release}` | spec ready (`02`) |
| Warehouses/locations | REAL (`/inventory/locations`) | `inventory.locations.*` (added in PO vertical) | spec ready (`03`) |
| Vendors | REAL (`/inventory/suppliers`) | `inventory.suppliers.*` (added in PO vertical) | spec ready (`04`) |
| Transfers (list/create/ship/receive) | REAL | `inventory.transfers.*` | spec ready (`07`) |
| Smart-collection rule builder | table + (new) eval | smart-collection route + client | spec ready (`08`) |
| Notification preferences + delivery logs | REAL | proxies only | spec ready (`10`) |
| Payment toggles (functional) + COD reconciliation | REAL (`paymentConfig.save`, `cod`) | exists | spec ready (`11`) |
| Automation rule builder | **net-new schema** | after migration | blueprint (`09`) |

## Why bounded this phase
Each vertical is a real, multi-file UI that can only be **compile/contract-verified** here (no authenticated stack + DB). I shipped one complete vertical (PO) as verified proof + speced the rest precisely; building all eight UIs blind in one pass — without flow verification — would dilute the verification rigor the mission demands. They are now **unblocked** (backend real, pattern proven) and buildable vertical-by-vertical with a staging stack.

**Verdict:** Operations UI is unblocked and proven (PO shipped + verified); the remaining verticals are specced and follow the identical verifiable pattern.
