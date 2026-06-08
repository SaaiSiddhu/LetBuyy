-- Mobile merchant customer segments.
-- Writer: services/api-gateway/src/routes/customers.ts

CREATE TABLE IF NOT EXISTS public.customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT customer_segments_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT customer_segments_rules_object CHECK (jsonb_typeof(rules) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_customer_segments_store_active
  ON public.customer_segments(store_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_segments_store_name_active
  ON public.customer_segments(store_id, lower(name))
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_customer_segments_updated_at ON public.customer_segments;
CREATE TRIGGER update_customer_segments_updated_at
  BEFORE UPDATE ON public.customer_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_segments_service_all ON public.customer_segments;
CREATE POLICY customer_segments_service_all ON public.customer_segments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_segments_site_owner_all ON public.customer_segments;
CREATE POLICY customer_segments_site_owner_all ON public.customer_segments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = customer_segments.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = customer_segments.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
