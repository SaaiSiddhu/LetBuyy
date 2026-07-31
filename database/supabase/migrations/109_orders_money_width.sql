-- 109_orders_money_width.sql
-- Storefront order money remains numeric(_,2). This widens order totals to the
-- cart precision so a valid cart cannot overflow when copied into orders.
-- The trigger trg_orders_pending_cod_status watches UPDATE OF total, so it must
-- be dropped and recreated around the ALTER TABLE.

BEGIN;

DROP TRIGGER IF EXISTS trg_orders_pending_cod_status ON public.orders;

ALTER TABLE public.orders
  ALTER COLUMN subtotal TYPE numeric(12,2),
  ALTER COLUMN shipping_cost TYPE numeric(12,2),
  ALTER COLUMN tax TYPE numeric(12,2),
  ALTER COLUMN discount TYPE numeric(12,2),
  ALTER COLUMN total TYPE numeric(12,2),
  ALTER COLUMN coupon_discount TYPE numeric(12,2);

CREATE TRIGGER trg_orders_pending_cod_status
BEFORE INSERT OR UPDATE OF payment_method, payment_status, total, status
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_pending_cod_order_status();

COMMIT;
