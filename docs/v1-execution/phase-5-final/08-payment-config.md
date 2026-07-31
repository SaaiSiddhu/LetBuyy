# 08 — Payment Configuration

**Exposure: ~85% — functional toggles shipped in Phase 5.75, carried + stable.**

## Shipped (verified, Phase 5.75)
- COD + online-payment toggles are FUNCTIONAL (no longer display-only): `Switch`es with optimistic update + revert + toast, persisting via `PATCH /api/stores/[store]/payment-config` → `stores.update()`.
- Write path made real (additive, not credential code): `cod_enabled`/`online_payment_enabled` in `UpdateStoreSchema` (`packages/tenant-core`) + the `PATCH /stores/:id` allow-list (`stores.ts`) → the real `sites.*` columns.
- **No Razorpay/Stripe credential/provider code touched.** Governance re-verified: canonical-ledger + frozen-path + production-safety PASS.

## Remaining (small follow-up)
- COD reconciliation read view (`cod.overview` — read-only).
- Per-zone/rate COD toggles (the `shipping_zones`/`shipping_rates.cod_enabled` columns exist).
- `settings:write` RBAC on the payment write (see `09-rbac.md`) — wants careful live validation since the `PATCH /stores/:id` route is broad.

**Verdict:** payment method enable/disable is functional end-to-end over the real write path, provider/credential code untouched. No new schema (reuses `sites` columns). The reconciliation view + per-zone toggles are read/additive follow-ups.
