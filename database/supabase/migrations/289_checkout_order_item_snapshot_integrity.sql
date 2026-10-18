-- F3.7: checkout order item descriptions, quantities and commercial/tax amounts
-- are immutable after the parent checkout order has been locked. Fulfillment,
-- returns and refund progress remain mutable on their dedicated lifecycle fields.
BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_checkout_order_item_snapshot_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_has_locked_checkout boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.orders AS order_row
       WHERE order_row.id = OLD.order_id
         AND order_row.order_source = 'checkout'
         AND order_row.order_locked_at IS NOT NULL
    ) INTO v_has_locked_checkout;

    IF v_has_locked_checkout THEN
      RAISE EXCEPTION 'checkout order item commercial snapshot is immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.order_id IS DISTINCT FROM NEW.order_id
     OR OLD.product_id IS DISTINCT FROM NEW.product_id
     OR OLD.variant_id IS DISTINCT FROM NEW.variant_id
     OR OLD.name IS DISTINCT FROM NEW.name
     OR OLD.sku IS DISTINCT FROM NEW.sku
     OR OLD.quantity IS DISTINCT FROM NEW.quantity
     OR OLD.price IS DISTINCT FROM NEW.price
     OR OLD.total IS DISTINCT FROM NEW.total
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.variant_title IS DISTINCT FROM NEW.variant_title
     OR OLD.unit_price IS DISTINCT FROM NEW.unit_price
     OR OLD.discount_amount IS DISTINCT FROM NEW.discount_amount
     OR OLD.tax_amount IS DISTINCT FROM NEW.tax_amount
     OR OLD.product_snapshot IS DISTINCT FROM NEW.product_snapshot
     OR OLD.hsn_code IS DISTINCT FROM NEW.hsn_code
     OR OLD.gst_rate IS DISTINCT FROM NEW.gst_rate
     OR OLD.taxable_amount IS DISTINCT FROM NEW.taxable_amount
     OR OLD.cgst_amount IS DISTINCT FROM NEW.cgst_amount
     OR OLD.sgst_amount IS DISTINCT FROM NEW.sgst_amount
     OR OLD.igst_amount IS DISTINCT FROM NEW.igst_amount
     OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    SELECT EXISTS (
      SELECT 1
        FROM public.orders AS order_row
       WHERE order_row.id IN (OLD.order_id, NEW.order_id)
         AND order_row.order_source = 'checkout'
         AND order_row.order_locked_at IS NOT NULL
    ) INTO v_has_locked_checkout;

    IF v_has_locked_checkout THEN
      RAISE EXCEPTION 'checkout order item commercial snapshot is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.prevent_checkout_order_item_snapshot_update() FROM PUBLIC;

CREATE TRIGGER trg_order_items_checkout_snapshot_immutable
  BEFORE UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.prevent_checkout_order_item_snapshot_update();

COMMIT;
