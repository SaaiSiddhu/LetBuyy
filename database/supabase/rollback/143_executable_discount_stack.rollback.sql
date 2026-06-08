-- Rollback for Task 007 deterministic discount stacking.

DROP POLICY IF EXISTS discount_allocations_tenant_site_guc ON public.discount_allocations;
DROP POLICY IF EXISTS coupons_tenant_site_guc ON public.coupons;

DROP INDEX IF EXISTS public.discount_allocations_site_cart_idx;
DROP INDEX IF EXISTS public.discount_allocations_site_order_idx;
DROP INDEX IF EXISTS public.coupons_active_window_idx;
DROP INDEX IF EXISTS public.coupons_discount_class_idx;

DROP TRIGGER IF EXISTS trg_discount_allocations_updated_at ON public.discount_allocations;
DROP TABLE IF EXISTS public.discount_allocations;

ALTER TABLE IF EXISTS public.coupons
  DROP COLUMN IF EXISTS allocation_method,
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS automatic,
  DROP COLUMN IF EXISTS combines_with,
  DROP COLUMN IF EXISTS discount_class;
