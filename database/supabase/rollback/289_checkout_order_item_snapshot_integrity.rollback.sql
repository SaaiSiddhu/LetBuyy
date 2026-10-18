-- Rollback for 289_checkout_order_item_snapshot_integrity.sql.
DROP TRIGGER IF EXISTS trg_order_items_checkout_snapshot_immutable ON public.order_items;
DROP FUNCTION IF EXISTS public.prevent_checkout_order_item_snapshot_update();
