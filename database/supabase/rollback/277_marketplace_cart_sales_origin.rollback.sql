BEGIN;

DROP INDEX IF EXISTS public.idx_carts_store_sales_origin_status;
ALTER TABLE public.carts
  DROP CONSTRAINT IF EXISTS carts_sales_origin_check,
  DROP COLUMN IF EXISTS sales_origin;
ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_sales_origin_check,
  DROP COLUMN IF EXISTS sales_origin;

COMMIT;
