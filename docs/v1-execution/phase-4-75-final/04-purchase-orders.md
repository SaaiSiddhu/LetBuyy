# 04 — Purchase Orders

**STUB — NOT changed in Phase 4.75.** Honestly disclosed.

The purchase-orders page is an explicit "not available yet" stub (Phase-4 finding). It was **not** built in 4.75: real PO management (create PO, receiving, status tracking, vendor linking) requires a confirmed backend (PO + line-item + vendor tables/RPCs and receiving logic) and merchant UI that can only be flow-verified on a running stack. There is no verifiable way to ship it here without risking dead UI / fake data.

## Path
On a running stack: confirm/build the PO backend (tables + RPCs for create/receive/status + vendor FK) → build the PO list/detail/receiving UI with visual verification → either remove the stub or replace it with the real flow. Until then the stub should remain clearly labeled (it is) rather than be replaced with non-functional UI.

**Verdict:** not started this phase; correctly remains a labeled stub rather than fabricated completion.
