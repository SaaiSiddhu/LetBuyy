# 03 — COD Hardening

**Readiness: ~78% code** (the critical inventory leak + gift-card on the route paths were fixed in the pre-launch wave).
Detailed audit: `docs/v1-execution/pre-launch-wave/06-cod.md`.

## Verified (done, pre-launch wave)
- `/cod/confirm` (reject) + `/cod/timeout` now release inventory (`release_order_inventory_with_ledger`) + restore gift card (`restore_gift_card_on_refund`) via `db.rpc` (canonical) + send cancellation email. Contract-tested (`lb-checkout-hardening`).

## Open (the remaining COD items)
- **F1-queue (HIGH, chipped):** the queue auto-expiry path (`platform-queue-consumer.ts expireCodConfirmationRequest`) still cancels without inventory release / gift-card restore / email. Needs parity with the route fix — but it crosses the service boundary (the worker must enqueue the email via its own queue, not call the gateway's helper), so it's a focused, verifiable follow-up (spawned task chip `task_a8270a63`), not a blind edit here.
- F5 no dedicated COD-timeout cron (event-side-effect driven). F6 risk assessment not auto-applied at order creation. F7 no hard-block action. F8 reconciliation insert race.
- **F4 (human seam):** COD confirmation is `letbuyy_sandbox` — live WhatsApp (WABA) never fires; the fraud loop is inoperative live until WABA credentials + approved template.

**Verdict:** route-path inventory/GC leak fixed + verified; queue-path parity + auto-risk + WABA remain → COD not launch-complete.
