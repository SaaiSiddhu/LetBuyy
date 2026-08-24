-- Rollback for 204_narrow_payment_attempts_transactions_provider.sql.
--
-- Restores the constraint that was ACTUALLY in effect immediately before
-- 204 ran -- migration 142's redefinition
-- (142_executable_payment_sessions.sql:85-125), NOT
-- 000_baseline.sql's original 5-value array. Baseline's version
-- (['stripe','razorpay','paypal','cod','bank_transfer']) was already
-- superseded twice before 204: migration 075 added 'cashfree', migration
-- 142 added 'upi' and re-stated the array. Restoring baseline's stale
-- 5-value version here would silently drop 'cashfree' and 'upi' from the
-- live constraint on rollback -- not a faithful inverse of 204, and a
-- functional regression against migration 142's own intent. This restores
-- exactly what 142 last set, verified by diff against
-- 142_executable_payment_sessions.sql's ALTER TABLE ... ADD CONSTRAINT text.

BEGIN;

ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_provider_check;

ALTER TABLE public.payment_attempts
  ADD CONSTRAINT payment_attempts_provider_check
  CHECK (provider = ANY (ARRAY[
    'stripe'::text,
    'razorpay'::text,
    'paypal'::text,
    'cashfree'::text,
    'upi'::text,
    'cod'::text,
    'bank_transfer'::text
  ]));

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_gateway_check
  CHECK (gateway = ANY (ARRAY[
    'stripe'::text,
    'razorpay'::text,
    'paypal'::text,
    'cashfree'::text,
    'upi'::text,
    'cod'::text,
    'bank_transfer'::text
  ]));

COMMIT;
