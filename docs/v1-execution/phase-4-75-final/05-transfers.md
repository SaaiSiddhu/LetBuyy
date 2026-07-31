# 05 — Inventory Transfers

**STUB — NOT changed in Phase 4.75.** Honestly disclosed.

The inventory-transfers page is an explicit stub (Phase-4 finding). Like Purchase Orders (`04`), real transfer requests / transfer tracking / warehouse movement need a confirmed multi-location backend (locations + transfer + movement tables/RPCs) and UI that can only be flow-verified on a running stack. LetBuyy's data model is currently effectively single-location for V1 (no confirmed multi-warehouse schema), so this is also partly a **data-model** question, not only UI.

## Path
Decide V1 scope: if multi-location is V1.1 (likely), keep the stub clearly labeled or remove the page; if V1, build the locations + transfer backend first, then the UI with visual verification + `inventory`/`shipping` RBAC.

**Verdict:** not started this phase; remains a labeled stub. Multi-location transfers are most likely V1.1, not a V1 code gap.
