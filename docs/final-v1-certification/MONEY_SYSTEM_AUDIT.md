# Phase F — Money System Audit

**HEAD `587dc988`. Score: 90/100. Money invariants PRESERVED.**

## Canonical ledger — SOUND
- Double-entry balance enforced by `enforce_ledger_transaction_balance()` (mig `139:172–198`) as a `DEFERRABLE` constraint trigger + inside `post_ledger_transaction`.
- Append-only: `reject_ledger_mutation()` (`139:163–170`) raises on UPDATE/DELETE of `ledger_entries`/`ledger_transactions`; `amount_minor > 0` CHECK; RLS forced; GUC tenant binding required.
- **Zero TS bypass:** no `.insert/.update/.delete` on the canonical ledger tables anywhere in `services/apps/packages` — mutated exclusively via SECURITY DEFINER RPCs. Operational tables (`payments`, `payout_statements`) are written directly but co-locate canonical-ledger evidence per `canonical-ledger-only-validator`.

## Refunds — SOUND
`payments.ts:462–667`: step-up gated (`:492–502`, 428 on fail) **before** provider call; over-refund guard (`:476–484`); idempotent (`:504–515`); **provider refund (`:537–555`) before ledger post (`:558–577`)** — provider failure writes no ledger row.

## Payouts — SOUND
`payouts.ts:553–709` + mig 160: step-up gate; **atomic `claim_payout_statement_release`** with `SELECT ... FOR UPDATE` + idempotency replay (`160:357–421`); **ledger-derived `merchant_payable` balance check** (`160:398–404`); rail hardcoded `razorpay_route` — **no self-custody**.

## Gift cards — SPLIT-BRAIN FIXED (prior bug refuted)
Issuance (`issue_gift_card`, mig 173) and redemption (in `create_checkout_order`, mig 170) both use **`gift_card_accounts` + `gift_card_ledger_entries`** keyed by the **same SHA-256 `code_hash`**. Balance is a ledger projection (no mutable decrement); `FOR UPDATE` + `LEAST(balance, total)` prevents over-redemption. **An issued code IS redeemable** (the only gap is a missing storefront *input*, LB-11).

## GST — SOUND compute, mutable persistence (−)
CGST/SGST/IGST computed server-side (`checkout-core:793–828`) at order creation from `tax_registrations` + `tax_rates`; immutable `gst_invoices` table with reject-mutation trigger (mig `144:126–143`). **−Deduction:** the checkout path persists the invoice to the **mutable `orders.gst_invoice` JSONB**, not the immutable `gst_invoices` table → the shopper's actual invoice lacks the immutability guarantee.

## Shipping charges — DEFECT (−)
Server-authoritative resolver exists (mig 170 in-RPC), but `app/api/orders/route.ts:48–57` **drops `shippingRateId`** → gateway falls back to deliveryOption legacy (standard=**0**/express=99). **Standard orders ship free regardless of the merchant's rate card** — revenue leak. (High.)

## Commission — 0%, validator-locked
`commission-bps-zero-validator` forbids non-zero defaults; mig 162 sets schedules + reconciliation to 0; I5 invariant asserts capture/refund never post `platform_revenue`. **−Low:** payout fee math is data-gated (`payouts.ts:443` reads `commission_bps`, defaults 0) rather than hard-zero — a manual DB row could introduce a fee. No code path produces non-zero.

## Idempotency & replay — SOUND
Every money RPC requires `idempotency_key` + ON CONFLICT; storefront verify calls `assertProviderPaymentNotReplayed` (`payment-route-support.ts:226–258`) + order-binding + server-side HMAC verify.

**−10 total:** shipping-drop (High), GST-on-mutable-column (Med), data-gated commission (Low). The ledger/refund/payout/gift-card spine is certified sound.
