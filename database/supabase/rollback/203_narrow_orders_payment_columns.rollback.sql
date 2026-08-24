-- Rollback for 203_narrow_orders_payment_columns.sql.
-- Neither orders.payment_method nor orders.payment_gateway had ANY CHECK
-- constraint before this migration (database/supabase/migrations/
-- 000_baseline.sql: both plain `text`, no CONSTRAINT clause). Restoring
-- "no constraint" is simply dropping the two constraints this migration
-- added -- there is nothing else to re-add.

BEGIN;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_payment_gateway_check;

COMMIT;
