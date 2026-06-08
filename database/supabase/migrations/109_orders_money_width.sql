-- 109_orders_money_width.sql
-- Storefront order money remains numeric(_,2). This widens order totals to the
-- cart precision so a valid cart cannot overflow when copied into orders.

BEGIN;

ALTER TABLE public.orders
  ALTER COLUMN subtotal TYPE numeric(12,2),
  ALTER COLUMN shipping_cost TYPE numeric(12,2),
  ALTER COLUMN tax TYPE numeric(12,2),
  ALTER COLUMN discount TYPE numeric(12,2),
  ALTER COLUMN total TYPE numeric(12,2),
  ALTER COLUMN coupon_discount TYPE numeric(12,2);

COMMIT;
