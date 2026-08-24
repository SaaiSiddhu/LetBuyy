-- Phase M4 (W2), DOC 03 row 11 "Payments": Razorpay + COD are the only live
-- money-in rails. Neither orders.payment_method nor orders.payment_gateway
-- (both plain `text`, no CHECK, database/supabase/migrations/000_baseline.sql
-- column list) has ever been constrained at the storage layer, even though
-- Phase M3-REVISED already narrowed create_checkout_order's write-path
-- guard (202_narrow_checkout_order_payment_method.sql) to razorpay/cod.
--
-- attach_order_payment_reference and confirm_order_payment
-- (000_baseline.sql:345-400, :1439-1530) both write payment_method AND
-- payment_gateway from p_provider, with NO guard of their own -- the same
-- app-guard-only inversion Phase M3 fixed one layer down. Their live
-- wrappers (attach_order_payment_reference_with_ledger,
-- confirm_order_payment_with_ledger, record_order_payment_failure_with_ledger
-- -- database/supabase/migrations/168_b1_b2_capture_refund_ledgering.sql)
-- are reached only through services/api-gateway/src/execution/
-- payment-execution.adapter.ts, whose CapturedPaymentProvider type is a
-- single literal ('razorpay') -- verified against every real call site
-- (checkout.ts, payments.ts, internal-payment-routes.ts,
-- checkout-payment-routes.ts), not just the type declaration. So the live
-- write surface for BOTH columns today is exactly razorpay (from these
-- RPCs) plus cod (from create_checkout_order) -- never 'upi', unlike
-- payment_attempts.provider / payment_transactions.gateway, which a
-- separate Phase M4 migration narrows to a wider razorpay/upi/cod set for
-- exactly that reason (the V1 payment-sessions capture flow writes 'upi'
-- there directly).
--
-- A column CHECK is used here rather than adding guards to the two
-- unguarded RPCs, deliberately: a column constraint covers all three RPCs,
-- any direct SQL, and any future writer, without needing every new RPC
-- author to remember this history. Per-RPC guards are what produced the
-- one-guarded/two-not situation this migration closes.
--
-- NOT VALID is deliberate: historical rows legitimately carry
-- 'stripe'/'paypal'/'cashfree' from years before Phase M1 narrowed the
-- application layer (create_checkout_order's guard alone accepted
-- razorpay/stripe/paypal/cod through migration 170). ALTER TABLE ...
-- ADD CONSTRAINT fails outright against any violating row; NOT VALID
-- enforces new/updated rows only. No orders row is backfilled, discarded,
-- or mutated by this migration.

BEGIN;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['razorpay'::text, 'cod'::text])) NOT VALID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_gateway_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_gateway_check
  CHECK (payment_gateway IS NULL OR payment_gateway = ANY (ARRAY['razorpay'::text, 'cod'::text])) NOT VALID;

COMMIT;
