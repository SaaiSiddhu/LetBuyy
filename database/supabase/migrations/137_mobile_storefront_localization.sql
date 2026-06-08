-- Mobile merchant storefront localization and markets.
-- Writer: services/api-gateway/src/routes/stores-localization.ts

CREATE TABLE IF NOT EXISTS public.store_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  country_code text NOT NULL,
  currency text DEFAULT 'INR'::text NOT NULL,
  locale text DEFAULT 'en-IN'::text NOT NULL,
  is_primary boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  price_adjustment_bps integer DEFAULT 0 NOT NULL,
  rounding_mode text DEFAULT 'standard'::text NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT store_markets_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT store_markets_country_code_check CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT store_markets_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT store_markets_locale_not_blank CHECK (length(btrim(locale)) >= 2),
  CONSTRAINT store_markets_price_adjustment_bounds CHECK (price_adjustment_bps BETWEEN -10000 AND 10000),
  CONSTRAINT store_markets_rounding_mode_check
    CHECK (rounding_mode = ANY (ARRAY['standard'::text, 'up'::text, 'down'::text, 'none'::text])),
  CONSTRAINT store_markets_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_store_markets_store_active
  ON public.store_markets(store_id, is_active, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_markets_store_country_active
  ON public.store_markets(store_id, country_code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_markets_store_primary
  ON public.store_markets(store_id)
  WHERE is_primary = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.storefront_locales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale text NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  published_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT storefront_locales_locale_not_blank CHECK (length(btrim(locale)) >= 2),
  CONSTRAINT storefront_locales_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT storefront_locales_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT storefront_locales_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_storefront_locales_store_status
  ON public.storefront_locales(store_id, status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_locales_store_locale_active
  ON public.storefront_locales(store_id, locale)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_locales_store_default
  ON public.storefront_locales(store_id)
  WHERE is_default = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.storefront_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  field text NOT NULL,
  source_text text,
  translated_text text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  published_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT storefront_translations_locale_not_blank CHECK (length(btrim(locale)) >= 2),
  CONSTRAINT storefront_translations_resource_type_check
    CHECK (resource_type = ANY (ARRAY['store'::text, 'product'::text, 'collection'::text, 'page'::text, 'policy'::text, 'theme'::text, 'navigation'::text])),
  CONSTRAINT storefront_translations_resource_id_not_blank CHECK (length(btrim(resource_id)) > 0),
  CONSTRAINT storefront_translations_field_not_blank CHECK (length(btrim(field)) > 0),
  CONSTRAINT storefront_translations_translated_text_not_blank CHECK (length(btrim(translated_text)) > 0),
  CONSTRAINT storefront_translations_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'needs_review'::text])),
  CONSTRAINT storefront_translations_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_storefront_translations_store_locale_status
  ON public.storefront_translations(store_id, locale, status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_storefront_translations_resource_active
  ON public.storefront_translations(store_id, locale, resource_type, resource_id, field)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_store_markets_updated_at ON public.store_markets;
CREATE TRIGGER update_store_markets_updated_at
  BEFORE UPDATE ON public.store_markets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_storefront_locales_updated_at ON public.storefront_locales;
CREATE TRIGGER update_storefront_locales_updated_at
  BEFORE UPDATE ON public.storefront_locales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_storefront_translations_updated_at ON public.storefront_translations;
CREATE TRIGGER update_storefront_translations_updated_at
  BEFORE UPDATE ON public.storefront_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.store_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_markets_service_all ON public.store_markets;
CREATE POLICY store_markets_service_all ON public.store_markets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS storefront_locales_service_all ON public.storefront_locales;
CREATE POLICY storefront_locales_service_all ON public.storefront_locales
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS storefront_translations_service_all ON public.storefront_translations;
CREATE POLICY storefront_translations_service_all ON public.storefront_translations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS store_markets_site_owner_all ON public.store_markets;
CREATE POLICY store_markets_site_owner_all ON public.store_markets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = store_markets.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = store_markets.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS storefront_locales_site_owner_all ON public.storefront_locales;
CREATE POLICY storefront_locales_site_owner_all ON public.storefront_locales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = storefront_locales.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = storefront_locales.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS storefront_translations_site_owner_all ON public.storefront_translations;
CREATE POLICY storefront_translations_site_owner_all ON public.storefront_translations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = storefront_translations.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = storefront_translations.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
