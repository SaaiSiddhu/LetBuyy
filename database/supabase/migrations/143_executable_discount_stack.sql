-- LetBuyy Executable Architecture V1 Task 007: deterministic discount stacking.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS discount_class text NOT NULL DEFAULT 'order'
    CHECK (discount_class IN ('product', 'order', 'shipping')),
  ADD COLUMN IF NOT EXISTS combines_with jsonb NOT NULL DEFAULT '{"product":false,"order":false,"shipping":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS automatic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0 AND priority <= 10000),
  ADD COLUMN IF NOT EXISTS allocation_method text NOT NULL DEFAULT 'subtotal'
    CHECK (allocation_method IN ('line_item', 'subtotal', 'shipping'));

UPDATE public.coupons
   SET site_id = store_id
 WHERE site_id IS NULL
   AND store_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.discount_allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  cart_id uuid,
  discount_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  discount_code text,
  allocation_class text NOT NULL CHECK (allocation_class IN ('product', 'order', 'shipping')),
  source_type text NOT NULL DEFAULT 'code' CHECK (source_type IN ('code', 'automatic')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  UNIQUE (site_id, order_id, discount_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS coupons_discount_class_idx
  ON public.coupons (COALESCE(site_id, store_id), discount_class, automatic, priority)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS coupons_active_window_idx
  ON public.coupons (COALESCE(site_id, store_id), is_active, starts_at, expires_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS discount_allocations_site_order_idx
  ON public.discount_allocations (site_id, order_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS discount_allocations_site_cart_idx
  ON public.discount_allocations (site_id, cart_id, created_at DESC)
  WHERE cart_id IS NOT NULL AND deleted_at IS NULL;

DO $$
BEGIN
  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_discount_allocations_updated_at ON public.discount_allocations;
    CREATE TRIGGER trg_discount_allocations_updated_at
      BEFORE UPDATE ON public.discount_allocations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.discount_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_allocations FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coupons' AND policyname = 'coupons_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY coupons_tenant_site_guc ON public.coupons USING (COALESCE(site_id, store_id) = public.current_site_id()) WITH CHECK (COALESCE(site_id, store_id) = public.current_site_id())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'discount_allocations' AND policyname = 'discount_allocations_tenant_site_guc'
  ) THEN
    EXECUTE 'CREATE POLICY discount_allocations_tenant_site_guc ON public.discount_allocations USING (site_id = public.current_site_id()) WITH CHECK (site_id = public.current_site_id())';
  END IF;
END;
$$;
