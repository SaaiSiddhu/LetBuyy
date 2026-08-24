-- Rollback for 201_narrow_draft_orders_payment_method.sql.
-- Restores the migration-116 draft_orders_payment_method_check exactly
-- (razorpay/stripe/cashfree/cod). Does not restore VALID status beyond
-- what 116 itself had (a plain, validated CHECK -- no existing rows were
-- ever invalidated by 201's NOT VALID constraint, so re-adding 116's wider
-- CHECK validates cleanly against current data).

BEGIN;

ALTER TABLE public.draft_orders
  DROP CONSTRAINT IF EXISTS draft_orders_payment_method_check;

ALTER TABLE public.draft_orders
  ADD CONSTRAINT draft_orders_payment_method_check
  CHECK (payment_method = ANY (ARRAY['razorpay'::text, 'stripe'::text, 'cashfree'::text, 'cod'::text]));

COMMIT;
