-- Mobile merchant shipping labels.
-- Writer: services/api-gateway/src/routes/shipping-labels.ts

CREATE TABLE IF NOT EXISTS public.shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL,
  carrier text NOT NULL,
  provider_shipment_id text,
  tracking_number text,
  tracking_url text,
  label_url text,
  label_object_key text,
  status text DEFAULT 'label_created'::text NOT NULL,
  test_mode boolean DEFAULT true NOT NULL,
  package jsonb DEFAULT '{}'::jsonb NOT NULL,
  idempotency_key text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT shipping_labels_status_check
    CHECK (status = ANY (ARRAY['label_created'::text, 'ready_to_ship'::text, 'voided'::text, 'cancelled'::text]))
);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_site_order
  ON public.shipping_labels(site_id, order_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipping_labels_site_idempotency
  ON public.shipping_labels(site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_shipping_labels_updated_at ON public.shipping_labels;
CREATE TRIGGER update_shipping_labels_updated_at
  BEFORE UPDATE ON public.shipping_labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipping_labels_service_all ON public.shipping_labels;
CREATE POLICY shipping_labels_service_all ON public.shipping_labels
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS shipping_labels_site_owner_all ON public.shipping_labels;
CREATE POLICY shipping_labels_site_owner_all ON public.shipping_labels
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = shipping_labels.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = shipping_labels.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
