# 03 — Inventory

**~40% — NOT changed in Phase 4.75.** Carries the Phase-4 status. Honestly disclosed, not fabricated.

## Real (prior phases)
Inventory view + stock adjustments are real (live API, server-authoritative).

## Not built this phase (and why)
Inventory **history**, movement tracking, reservations, and stock audit were **not** implemented in 4.75. These need (a) confirmed backend endpoints/RPCs for ledgered stock movements and (b) UI that can only be flow-verified on a running authenticated stack. Building the UI blind would risk dead UI / fabricated data, which this mission forbids. The verifiable backend RBAC work was prioritized instead (see `07-rbac.md`).

## Path
On a running stack: confirm/extend the stock-movement backend → build the history + reservations + audit UI with visual verification → wire `inventory`-scoped RBAC (same one-line guard). PO + transfers are tracked separately (`04`, `05`).

**Verdict:** view + adjust ship; history/reservations/audit remain real engineering gated on a live stack — not started this phase, not faked.
