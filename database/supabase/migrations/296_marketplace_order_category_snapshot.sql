-- F3.7/F9.2: preserve the approved marketplace category on each purchased line.
-- The category is attribution evidence only; this migration defines no fee rate.
BEGIN;

ALTER TABLE public.order_items
  ADD COLUMN marketplace_category_id uuid
    REFERENCES public.marketplace_categories(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.order_items.marketplace_category_id IS
  'Immutable category identity captured from the approved marketplace listing at checkout; null for storefront and pre-migration orders with no recoverable snapshot.';

CREATE OR REPLACE FUNCTION public.bind_marketplace_order_category_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_category_id uuid;
  v_store_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.marketplace_listing_id IS NOT NULL
       OR NEW.marketplace_approved_fingerprint IS NOT NULL
       OR NEW.marketplace_category_id IS NOT NULL THEN
      RAISE EXCEPTION 'marketplace order identity is bound only by checkout';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.marketplace_category_id IS DISTINCT FROM OLD.marketplace_category_id THEN
    IF OLD.marketplace_listing_id IS NOT NULL
       OR OLD.marketplace_approved_fingerprint IS NOT NULL
       OR OLD.marketplace_category_id IS NOT NULL
       OR NEW.marketplace_listing_id IS NULL
       OR NEW.marketplace_approved_fingerprint IS NULL
       OR current_setting('app.marketplace_order_creation', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'marketplace category snapshot is immutable';
    END IF;
  END IF;

  IF OLD.marketplace_listing_id IS NULL AND NEW.marketplace_listing_id IS NOT NULL THEN
    IF current_setting('app.marketplace_order_creation', true) IS DISTINCT FROM 'on'
       OR OLD.marketplace_approved_fingerprint IS NOT NULL
       OR OLD.marketplace_category_id IS NOT NULL
       OR NEW.marketplace_approved_fingerprint IS NULL THEN
      RAISE EXCEPTION 'marketplace category snapshot is checkout-bound';
    END IF;
    SELECT order_row.store_id INTO v_store_id
      FROM public.orders AS order_row
     WHERE order_row.id = NEW.order_id;
    SELECT listing.marketplace_category_id INTO v_category_id
      FROM public.channel_listings AS listing
     WHERE listing.id = NEW.marketplace_listing_id
       AND listing.site_id = v_store_id
       AND listing.channel = 'marketplace';

    IF NOT FOUND OR v_category_id IS NULL THEN
      RAISE EXCEPTION 'approved marketplace category snapshot is unavailable';
    END IF;
    NEW.marketplace_category_id := v_category_id;
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.bind_marketplace_order_category_snapshot() FROM PUBLIC;

-- PostgreSQL orders same-timing triggers by name: derive the category before the
-- checkout snapshot immutability guard evaluates this one-time checkout binding.
CREATE TRIGGER trg_order_items_00_marketplace_category_snapshot
  BEFORE INSERT OR UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.bind_marketplace_order_category_snapshot();

CREATE OR REPLACE FUNCTION public.prevent_checkout_order_item_snapshot_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_has_locked_checkout boolean;
  v_marketplace_binding boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders AS order_row
       WHERE order_row.id = OLD.order_id
         AND order_row.order_source = 'checkout'
         AND order_row.order_locked_at IS NOT NULL
    ) INTO v_has_locked_checkout;
    IF v_has_locked_checkout THEN
      RAISE EXCEPTION 'checkout order item commercial snapshot is immutable';
    END IF;
    RETURN OLD;
  END IF;

  v_marketplace_binding := OLD.marketplace_listing_id IS NULL
    AND OLD.marketplace_approved_fingerprint IS NULL
    AND OLD.marketplace_category_id IS NULL
    AND NEW.marketplace_listing_id IS NOT NULL
    AND NEW.marketplace_approved_fingerprint IS NOT NULL
    AND NEW.marketplace_category_id IS NOT NULL
    AND current_setting('app.marketplace_order_creation', true) = 'on';

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
     OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
     OR (OLD.marketplace_category_id IS DISTINCT FROM NEW.marketplace_category_id AND NOT v_marketplace_binding) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders AS order_row
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

COMMIT;
