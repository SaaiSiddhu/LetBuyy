# 10 — Notification Hardening

**Readiness: ~80% code; live delivery gated on Resend (H6) + WABA (WhatsApp).**

## Verified
- Order lifecycle emails: `order_confirmation`, `order_shipped`/`shipment_update`, `order_cancelled`, `order_refunded` templates + `enqueueOrderLifecycleEmail` producer + queue-worker dispatch + Resend adapter. COD reject/timeout + refund/complete now emit cancellation/refund emails (Phase-1 + pre-launch wave). Idempotency-keyed queue jobs. `lb10-order-emails` 3/3 + `lb10-dispatch` 6/6 pass.

## Open
- **COD auto-expiry path** sends no email (F3) — bundled with the chipped COD queue-parity fix (`task_a8270a63`).
- **Live email (H6):** requires `RESEND_API_KEY` + SPF/DKIM/DMARC. Without it, sends fail closed (no fabrication). Also blocks platform-console magic-link login.
- **WhatsApp (WABA):** COD confirmation is `letbuyy_sandbox` — live messages need WABA credentials + an approved template (human seam).
- SMS: not on the V1 core path.

**Verdict:** the notification dispatch architecture is sound + idempotent; live delivery is human-seam-gated (H6 + WABA), and the COD auto-expiry email is the one code gap (chipped).
