# 06 — Payment Configuration

**Exposure: ~70% — NOT advanced this phase (honest).** Backend incl. the write path is REAL; wiring the functional toggles is the remaining (small) exposure.

## Already real (reused)
- `sites.cod_enabled`/`online_payment_enabled`/`payment_settings`; per-zone/rate `cod_enabled`. COD trigger + `cod_reconciliation_entries` + `reconcile_cod_remittance_with_ledger`. Gateway `GET/POST /stores/:id/payment-config`, `/cod/*`. api-client `stores.paymentConfig.{get,save}`, `cod.{overview,collect,reconcile}`.

## Not built this phase (and why)
The merchant settings payment toggles are still **display-only** (Phase-4 finding). The write path (`paymentConfig.save({ cod_enabled, online_payment_enabled })`) already exists — wiring the toggles to it is a small, focused edit to the settings/payments page that was staged to keep this phase's focus on the inventory-ops verticals and to avoid editing the merchant app concurrently with the 3 UI agents.

## Implementation spec (verifiable, no new schema, no payment/OAuth code change)
Make the existing toggles call `paymentConfig.save(...)` via the existing proxy; add a COD reconciliation view over `cod.overview`. Guard with `settings:write` RBAC. **Do NOT touch the Razorpay/credential handling** (money/OAuth-sensitive — only the two booleans).

**Verdict:** the toggle write path is real; wiring the functional toggle + a reconciliation view is the next small exposure step, specced.
