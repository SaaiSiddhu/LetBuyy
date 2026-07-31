# 11 — Payment Configuration

**Backend status: REAL.** This closes the Phase-4 "payment toggles are display-only" gap with a real write path that already exists.

## What already exists
- **Columns on `sites`:** `cod_enabled` (bool), `online_payment_enabled` (bool), `payment_settings` jsonb (Razorpay creds at rest). Per-zone/per-rate `cod_enabled` on `shipping_zones`/`shipping_rates` (`145_`).
- **COD lifecycle:** `trg_orders_pending_cod_status` trigger; `cod_reconciliation_entries` + `reconcile_cod_remittance_with_ledger` (SD).
- **Gateway:** `GET/POST /stores/:id/payment-config`; `/payments/*` (sessions/capture/void/refund/razorpay); `/cod/*` (overview/collect/reconcile).
- **api-client:** `stores.paymentConfig.{get,save}`, `cod.{overview,collect,reconcile}`.

## The real gap (exposure — verifiable)
- The merchant settings payment toggles are **display-only**; the write path (`stores.paymentConfig.save` with `cod_enabled`/`online_payment_enabled`) already exists. **Wire the toggles to it** → functional COD / online-payment enable-disable.
- Surface COD reconciliation (`cod.overview`) in the merchant ops UI.

## Implementation spec
Make the settings payment toggles call `paymentConfig.save({ cod_enabled, online_payment_enabled })` via the existing proxy; add a COD reconciliation view over `cod.overview`. Guard writes with `settings:write` RBAC (existing `assertStaffPermission`). Compile + contract verifiable. **No new schema** (the Razorpay/credential handling is OAuth/money-sensitive — do NOT modify it; only toggle the existing booleans).

**Verdict:** payment configuration backend is real incl. the toggle write path; Phase-5 wires the functional toggles + a reconciliation view. No new schema; no payment/OAuth code changes.
