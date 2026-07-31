# 13 — Security

Phase-5 exposure work inherits the existing, verified security model — it adds no new trust boundaries.

## Tenant isolation
- **Every commerce table has RLS** with a GUC policy (`store_id = current_site_id()`), several with FORCE RLS (inventory reservations, notification logs/suppressions): `inventory_levels/reservations/adjustments/events`, `inventory_locations`, `suppliers`, `purchase_orders/_lines/_receipts`, `inventory_transfers/_lines/_receipts`, `smart_collections`, notification tables — all verified in the truth map (`01`).
- **All new merchant proxies are ownership-checked** via `resolveOwnedStoreId` (the same gate as every Phase-4.x proxy) — the browser never reaches the gateway directly.
- The gateway commerce RPCs run `SECURITY DEFINER SET search_path TO 'public'` with explicit tenant GUC checks.

## RBAC
- The `assertStaffPermission` engine (Phase 4.5/4.75, dry-run default) extends to the new commerce writes via the same one-line pattern: PO create/receive → `inventory:write` (or `products:write`), transfer ship/receive → `inventory:write`, payment toggles → `settings:write`. Wiring is additive + dry-run-safe.

## Audit
- **Inventory audit trail is built-in:** `inventory_events` (11 event types) is the canonical movement journal, emitted by every ledgered RPC. Employee lifecycle audit (`audit_logs`) exists from Phase 4.5.

## Controls unchanged
- No payment/OAuth/credential code touched (payment config only toggles existing `cod_enabled`/`online_payment_enabled` booleans via the existing write path). Idempotency keys are enforced on every commerce RPC (reservations, PO receipts, transfer receipts).

**Verdict:** Phase-5 work is tenant-isolated, ownership-checked, RBAC-extendable, and audit-backed by reusing the existing controls. No new trust surface; no security regression.
