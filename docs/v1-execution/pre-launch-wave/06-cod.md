# 06 — COD System (Stream F)

**Readiness: was ~60% (3 critical/high); now ~78% after the inventory + gift-card fix.** Remaining gaps are notification/cron/risk + the live WhatsApp gate.

## Fixed this wave (the critical money/inventory bug)
- **F1 (CRITICAL) — inventory leak on COD cancellation** + **F2 (HIGH) — gift card not restored:** the COD reject (`/cod/confirm` rejected) and `/cod/timeout` paths did a direct `orders.update(status='cancelled')` and never released reserved inventory or restored gift-card balance (the canonical PATCH cancel path does both). Added `releaseCancelledCodOrderResources()` (best-effort `release_order_inventory_with_ledger` + `restore_gift_card_on_refund` via `db.rpc`) and call it on both cancel paths. Contract-tested; canonical-ledger validator passes.

## Open issues (documented)
| ID | Sev | Finding |
|---|---|---|
| F1-queue | HIGH | The **queue auto-expiry** path (`platform-queue-consumer.ts expireCodConfirmationRequest`) also cancels without releasing inventory/GC/email — should call the same logic. (Gateway routes fixed; the worker path is a separate file — apply the same fix there.) |
| F3 | HIGH | Auto-expiry sends no cancellation email (writes a diagnostic `notification_logs` row, not an outbound email). The two route paths DO email. |
| F4 | HIGH | COD confirmation is `provider: 'letbuyy_sandbox'` — live WhatsApp (WABA) never fires. **Human seam** (WABA credentials + approved template). The fraud-prevention loop is structurally present but inoperative live. |
| F5 | HIGH | No dedicated COD-timeout cron; `expireDueCodConfirmations` runs as an event side-effect, so a low-traffic store may breach the 12h window. |
| F6 | HIGH | Risk assessment (`assessOrderRisk`) is not auto-applied at order creation — only via a separate merchant endpoint. Storefront COD orders are never auto-screened. |
| F7 | MED | `assessOrderRisk` has no hard-block action (max risk still `allow`). |
| F8 | MED | `ensureEntriesForCodOrders` insert has no `ON CONFLICT` guard → concurrent reconciliation requests can collide. |

## Compliant
Order creation uses canonical `create_checkout_order` RPC ✅; reconciliation ledger step uses `reconcile_cod_remittance_with_ledger` ✅.

## Verdict
The critical inventory/GC leak is fixed for the route paths. The remaining items (queue-path parity F1-queue, auto-expiry email F3, dedicated cron F5, auto-risk F6) are real pre-launch fixes; the WhatsApp live loop (F4) is a human seam. COD is **not launch-ready** until F1-queue/F3/F5/F6 land and WABA is provisioned.
