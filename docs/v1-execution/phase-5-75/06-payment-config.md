# 06 — Payment Configuration

**Exposure: ~70% → ~85% — SHIPPED this wave.** The display-only toggles are now FUNCTIONAL (closes the Phase-4 gap), via the existing write path — with NO credential/provider code touched.

## Shipped this wave (verified)
- **Functional toggles:** `[store]/settings/payments/page.tsx` — the "Online checkout" + "Cash on delivery" tiles are now `Switch`es with optimistic update + revert-on-failure + toast, persisting via `PATCH /api/stores/[store]/payment-config`.
- **Proxy:** added `PATCH` to `api/stores/[store]/payment-config/route.ts` → `stores.update()` (ownership-checked).
- **Write path made real (additive, not credential code):** `cod_enabled` + `online_payment_enabled` added to `UpdateStoreSchema` (`packages/tenant-core`) + to the `PATCH /stores/:id` allow-list (`stores.ts`). Without these the booleans would be silently dropped — the agent correctly identified this. These map to the real `sites.cod_enabled`/`online_payment_enabled` columns.

## Safety (verified)
**No Razorpay/Stripe credential handling, `payment_settings`, key entry, or provider/verification code was touched** — only the two booleans. Governance re-confirmed: **canonical-ledger + frozen-path + production-safety all PASS** after the stores.ts/tenant-core change. The change is an additive allow-list + schema field (`git diff` shows `+ 'cod_enabled', 'online_payment_enabled',`).

## Remaining
COD reconciliation view (`cod.overview` — read-only, follow-up); per-zone/rate COD toggles; `settings:write` RBAC on the PATCH.

## Verification
4 package typechecks EXIT 0 · contract test (allow-list + PATCH proxy + Switch UI) PASS · launch 196/196 · governance PASS.

**Verdict:** payment method enable/disable is now functional end-to-end over the real write path, with provider/credential code untouched. No new schema (reuses existing `sites` columns).
