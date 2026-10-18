-- Preserve committed order evidence; remove only the category snapshot mechanism.
BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('prevent_checkout_order_item_snapshot_update', 'public.prevent_checkout_order_item_snapshot_update()', ARRAY[]::text[], 'trigger', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 296 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 296 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;


DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.order_items WHERE marketplace_category_id IS NOT NULL) THEN
    RAISE EXCEPTION 'migration 296 has committed category snapshots; preserve the column and its evidence';
  END IF;
END;
$guard$;

DROP TRIGGER IF EXISTS trg_order_items_00_marketplace_category_snapshot ON public.order_items;
DROP FUNCTION IF EXISTS public.bind_marketplace_order_category_snapshot();
ALTER TABLE public.order_items DROP COLUMN IF EXISTS marketplace_category_id;

-- Restore migration 289's immutable-check implementation without its later extension.
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
      SELECT 1 FROM public.orders AS order_row
       WHERE order_row.id = OLD.order_id
         AND order_row.order_source = 'checkout'
         AND order_row.order_locked_at IS NOT NULL
    ) INTO v_has_locked_checkout;
    IF v_has_locked_checkout THEN RAISE EXCEPTION 'checkout order item commercial snapshot is immutable'; END IF;
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
      SELECT 1 FROM public.orders AS order_row
       WHERE order_row.id IN (OLD.order_id, NEW.order_id)
         AND order_row.order_source = 'checkout'
         AND order_row.order_locked_at IS NOT NULL
    ) INTO v_has_locked_checkout;
    IF v_has_locked_checkout THEN RAISE EXCEPTION 'checkout order item commercial snapshot is immutable'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
