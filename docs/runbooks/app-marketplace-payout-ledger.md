# App Marketplace Payout Ledger Runbook

> Frozen seam runbook. The public app marketplace is not an active production surface; use this only for first-party/private sandbox payout-ledger evidence until an ARB-approved marketplace reopen trigger exists.

Owner: `services/queue-workers` and App Marketplace finance operations.

1. Locate the charge in `app_billing_charges` and the corresponding `partner_payout_ledger_entries` row by `charge_id` or `source_event_id`.
2. Confirm the ledger state is one of `pending`, `processing`, `released`, or `failed`; do not manually skip intermediate states.
3. For test-mode or sandbox charges, use the dry-run transfer adapter path and verify the statement metadata records partner share, platform fee, currency, and idempotency key.
4. For live charges, stop before release unless RazorpayX/Route credentials, payout approval, and the finance run window are approved.
5. When investigating a failed payout, preserve the original ledger entry, append retry metadata, and retry only with the same idempotency key or a documented replacement key.
6. After release, verify `payout.released` event emission and confirm merchant/developer UI status reflects the released ledger state, not the charge state alone.
7. Escalate to finance and incident response if ledger totals do not match charge gross, platform fee, partner share, and currency for any payout batch.
