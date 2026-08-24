-- Phase M4 (W3), DOC 03 row 11 "Payments". Narrows
-- payment_attempts_provider_check and payment_transactions_gateway_check.
--
-- IMPORTANT -- this migration's allowlist is DELIBERATELY WIDER than
-- 203_narrow_orders_payment_columns.sql's razorpay/cod: it is
-- razorpay/upi/cod. Do not "fix" this to match 203; it would break a live
-- flow. Evidence:
--
--   The CURRENT live definition of both constraints is NOT
--   000_baseline.sql's original 5-value array
--   (['stripe','razorpay','paypal','cod','bank_transfer']). Migration 075
--   (075_cashfree_payment_provider.sql) added 'cashfree'; migration 142
--   (142_executable_payment_sessions.sql:85-125), titled for the V1
--   payment-sessions feature, is the LATEST redefinition and is the one
--   actually live today:
--     ARRAY['stripe','razorpay','paypal','cashfree','upi','cod','bank_transfer']
--
--   'upi' is there for a live reason, not residue: services/api-gateway/
--   src/routes/payments.ts:333,422,609 insert
--   `provider: payment.provider` / `gateway: ...` into payment_attempts /
--   payment_transactions directly, sourced from the V1 POST /payments/sessions
--   flow, whose provider schema (V1PaymentProviderSchema /
--   CreatePaymentSessionSchema) was narrowed in Phase M1 to
--   razorpay/upi/cod -- 'upi' included deliberately there as a Razorpay
--   instrument, not a second aggregator (see packages/checkout-core's
--   CheckoutPaymentIntentSchema for the same, already-established pattern).
--   A customer choosing UPI on the V1 session flow genuinely writes
--   provider='upi'/gateway='upi' to these two tables today.
--
--   By contrast, orders.payment_method / orders.payment_gateway (203, prior
--   commit) never receive 'upi': create_checkout_order's guard is
--   razorpay/cod only, and the only other writers
--   (attach_order_payment_reference[_with_ledger],
--   confirm_order_payment[_with_ledger]) are reached exclusively through
--   PaymentExecutionAdapter, whose CapturedPaymentProvider type is the
--   single literal 'razorpay' -- verified against every real call site.
--
-- refund_attempts_provider_check (7 values incl. cashfree/gift_card) is
-- deliberately NOT touched here: complete_order_refund
-- (168_b1_b2_capture_refund_ledgering.sql) copies its provider value
-- forward from historical order/refund data via a CASE expression -- the
-- same historical-read pattern as 000_baseline.sql:1115-1116's explicitly
-- wide refund-method mapping. Refunding a pre-M1 order genuinely paid via
-- 'stripe' is a legitimate, ongoing operation; narrowing this constraint
-- would misrepresent real historical data, not fix anything.
--
-- A column CHECK is used rather than adding guards to the unguarded RPCs,
-- for the same reason as 203: it covers every writer, present and future,
-- not just the ones known today.
--
-- NOT VALID is deliberate: pre-M1 rows may carry a retired rail (stripe,
-- paypal, cashfree, bank_transfer) or the now-superseded 'upi' history is
-- irrelevant here since upi stays allowed. ALTER TABLE ... ADD CONSTRAINT
-- fails outright against any violating row; NOT VALID enforces new/updated
-- rows only. No payment_attempts or payment_transactions row is
-- backfilled, discarded, or mutated by this migration.

BEGIN;

ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_provider_check;

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_provider_check
  CHECK (provider = ANY (ARRAY['razorpay'::text, 'upi'::text, 'cod'::text])) NOT VALID;

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_gateway_check
  CHECK (gateway = ANY (ARRAY['razorpay'::text, 'upi'::text, 'cod'::text])) NOT VALID;

COMMIT;
