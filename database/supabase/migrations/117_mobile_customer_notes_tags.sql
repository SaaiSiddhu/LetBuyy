-- Mobile merchant customer notes and tags.
-- Writer: services/api-gateway/src/routes/customers.ts

CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  note text NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  tag text NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_customer_notes_store_email
  ON public.customer_notes(store_id, customer_email, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_tags_store_email
  ON public.customer_tags(store_id, customer_email, tag)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_tags_store_email_tag_active
  ON public.customer_tags(store_id, customer_email, lower(tag))
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_customer_notes_updated_at ON public.customer_notes;
CREATE TRIGGER update_customer_notes_updated_at
  BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_customer_tags_updated_at ON public.customer_tags;
CREATE TRIGGER update_customer_tags_updated_at
  BEFORE UPDATE ON public.customer_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_notes_service_all ON public.customer_notes;
CREATE POLICY customer_notes_service_all ON public.customer_notes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_notes_site_owner_all ON public.customer_notes;
CREATE POLICY customer_notes_site_owner_all ON public.customer_notes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = customer_notes.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = customer_notes.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS customer_tags_service_all ON public.customer_tags;
CREATE POLICY customer_tags_service_all ON public.customer_tags
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_tags_site_owner_all ON public.customer_tags;
CREATE POLICY customer_tags_site_owner_all ON public.customer_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = customer_tags.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = customer_tags.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
