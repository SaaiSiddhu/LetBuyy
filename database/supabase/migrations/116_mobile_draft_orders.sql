-- Mobile merchant draft orders.
-- Writer: services/api-gateway/src/routes/orders.ts

CREATE TABLE IF NOT EXISTS public.draft_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_gstin text,
  shipping_address jsonb DEFAULT '{}'::jsonb NOT NULL,
  payment_method text DEFAULT 'cod'::text NOT NULL,
  shipping_method text DEFAULT 'standard'::text NOT NULL,
  notes text,
  coupon_code text,
  gift_card_code text,
  status text DEFAULT 'draft'::text NOT NULL,
  converted_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  idempotency_key text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT draft_orders_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'converted'::text, 'discarded'::text])),
  CONSTRAINT draft_orders_payment_method_check
    CHECK (payment_method = ANY (ARRAY['razorpay'::text, 'stripe'::text, 'cashfree'::text, 'cod'::text])),
  CONSTRAINT draft_orders_shipping_method_check
    CHECK (shipping_method = ANY (ARRAY['standard'::text, 'express'::text]))
);

CREATE TABLE IF NOT EXISTS public.draft_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_order_id uuid NOT NULL REFERENCES public.draft_orders(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid,
  quantity integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT draft_order_lines_quantity_check CHECK (quantity > 0 AND quantity <= 999)
);

CREATE INDEX IF NOT EXISTS idx_draft_orders_site_status
  ON public.draft_orders(site_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_draft_orders_converted_order
  ON public.draft_orders(converted_order_id)
  WHERE converted_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_orders_site_idempotency
  ON public.draft_orders(site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_draft_order_lines_draft
  ON public.draft_order_lines(draft_order_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_draft_order_lines_site_product
  ON public.draft_order_lines(site_id, product_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_draft_orders_updated_at ON public.draft_orders;
CREATE TRIGGER update_draft_orders_updated_at
  BEFORE UPDATE ON public.draft_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_draft_order_lines_updated_at ON public.draft_order_lines;
CREATE TRIGGER update_draft_order_lines_updated_at
  BEFORE UPDATE ON public.draft_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.draft_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_order_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS draft_orders_service_all ON public.draft_orders;
CREATE POLICY draft_orders_service_all ON public.draft_orders
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS draft_orders_site_owner_all ON public.draft_orders;
CREATE POLICY draft_orders_site_owner_all ON public.draft_orders
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = draft_orders.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = draft_orders.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS draft_order_lines_service_all ON public.draft_order_lines;
CREATE POLICY draft_order_lines_service_all ON public.draft_order_lines
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS draft_order_lines_site_owner_all ON public.draft_order_lines;
CREATE POLICY draft_order_lines_site_owner_all ON public.draft_order_lines
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = draft_order_lines.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = draft_order_lines.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
