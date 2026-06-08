-- Mobile merchant metafield definitions and values.
-- Writer: services/api-gateway/src/routes/metafields.ts

CREATE TABLE IF NOT EXISTS public.store_metafield_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  owner_type text NOT NULL,
  namespace text DEFAULT 'custom'::text NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  value_type text NOT NULL,
  validation_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_required boolean DEFAULT false NOT NULL,
  is_public boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT store_metafield_definitions_owner_type_check
    CHECK (owner_type = ANY (ARRAY['store'::text, 'product'::text, 'variant'::text, 'collection'::text, 'customer'::text, 'order'::text, 'page'::text, 'theme'::text])),
  CONSTRAINT store_metafield_definitions_namespace_not_blank CHECK (length(btrim(namespace)) > 0),
  CONSTRAINT store_metafield_definitions_key_not_blank CHECK (length(btrim(key)) > 0),
  CONSTRAINT store_metafield_definitions_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT store_metafield_definitions_value_type_check
    CHECK (value_type = ANY (ARRAY['single_line_text'::text, 'multi_line_text'::text, 'number_integer'::text, 'number_decimal'::text, 'boolean'::text, 'json'::text, 'date'::text, 'url'::text])),
  CONSTRAINT store_metafield_definitions_validation_rules_object CHECK (jsonb_typeof(validation_rules) = 'object'),
  CONSTRAINT store_metafield_definitions_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_store_metafield_definitions_store_owner
  ON public.store_metafield_definitions(store_id, owner_type, sort_order, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_metafield_definitions_store_key_active
  ON public.store_metafield_definitions(store_id, owner_type, lower(namespace), lower(key))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.store_metafield_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES public.store_metafield_definitions(id) ON DELETE CASCADE,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  value jsonb DEFAULT 'null'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT store_metafield_values_owner_type_check
    CHECK (owner_type = ANY (ARRAY['store'::text, 'product'::text, 'variant'::text, 'collection'::text, 'customer'::text, 'order'::text, 'page'::text, 'theme'::text])),
  CONSTRAINT store_metafield_values_owner_id_not_blank CHECK (length(btrim(owner_id)) > 0),
  CONSTRAINT store_metafield_values_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_store_metafield_values_store_owner
  ON public.store_metafield_values(store_id, owner_type, owner_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_metafield_values_definition
  ON public.store_metafield_values(definition_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_metafield_values_definition_owner_active
  ON public.store_metafield_values(definition_id, owner_type, owner_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_store_metafield_definitions_updated_at ON public.store_metafield_definitions;
CREATE TRIGGER update_store_metafield_definitions_updated_at
  BEFORE UPDATE ON public.store_metafield_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_store_metafield_values_updated_at ON public.store_metafield_values;
CREATE TRIGGER update_store_metafield_values_updated_at
  BEFORE UPDATE ON public.store_metafield_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.store_metafield_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_metafield_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_metafield_definitions_service_all ON public.store_metafield_definitions;
CREATE POLICY store_metafield_definitions_service_all ON public.store_metafield_definitions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS store_metafield_values_service_all ON public.store_metafield_values;
CREATE POLICY store_metafield_values_service_all ON public.store_metafield_values
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS store_metafield_definitions_site_owner_all ON public.store_metafield_definitions;
CREATE POLICY store_metafield_definitions_site_owner_all ON public.store_metafield_definitions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = store_metafield_definitions.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = store_metafield_definitions.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS store_metafield_values_site_owner_all ON public.store_metafield_values;
CREATE POLICY store_metafield_values_site_owner_all ON public.store_metafield_values
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = store_metafield_values.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = store_metafield_values.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
