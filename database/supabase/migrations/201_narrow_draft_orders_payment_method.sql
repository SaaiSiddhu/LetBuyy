-- Phase M3-REVISED (W2), DOC 03 row 11 "Payments": Razorpay + COD are the
-- only live money-in rails. draft_orders_payment_method_check (migration
-- 116) still permitted 'stripe'/'cashfree' at the storage layer -- and
-- inconsistently omitted 'paypal' while allowing them, evidence this guard
-- was never actively maintained -- and was never narrowed alongside
-- CreateDraftOrderSchema (narrowed to razorpay/cod in Phase M1).
--
-- Uses NOT VALID deliberately: ALTER TABLE ... ADD CONSTRAINT fails
-- outright if any existing row violates it, and pre-M1 drafts may still
-- carry a retired rail. NOT VALID applies the constraint to all NEW and
-- UPDATEd rows without validating existing history, so this migration does
-- not backfill, discard, or mutate any existing draft_orders row -- that
-- remains a separate product/data decision. Historical rows carrying a
-- retired rail are handled at READ time by
-- orders.ts's normalizeDraftOrderPaymentMethod (W1, prior commit), which
-- rejects rather than silently converting them, so this constraint change
-- cannot turn a previously-successful conversion into a hard failure that
-- W1 didn't already intentionally introduce.

BEGIN;

ALTER TABLE public.draft_orders
  DROP CONSTRAINT IF EXISTS draft_orders_payment_method_check;

ALTER TABLE public.draft_orders
  ADD CONSTRAINT draft_orders_payment_method_check
  CHECK (payment_method = ANY (ARRAY['razorpay'::text, 'cod'::text])) NOT VALID;

COMMIT;
