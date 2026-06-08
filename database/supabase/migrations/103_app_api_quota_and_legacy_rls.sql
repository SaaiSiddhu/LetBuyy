-- Wave 7: app OAuth/API hardening, per-install quota accounting,
-- and additive tenant isolation for legacy marketplace tables.

ALTER TABLE public.app_categories
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.app_extensions
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.app_installations
    ADD COLUMN IF NOT EXISTS site_id uuid,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.app_reviews
    ADD COLUMN IF NOT EXISTS site_id uuid,
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.marketplace_apps
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

UPDATE public.app_installations
   SET site_id = store_id
 WHERE site_id IS NULL
   AND store_id IS NOT NULL;

UPDATE public.app_reviews
   SET site_id = store_id
 WHERE site_id IS NULL
   AND store_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'app_installations_site_id_fkey'
    ) THEN
        ALTER TABLE public.app_installations
            ADD CONSTRAINT app_installations_site_id_fkey
            FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'app_reviews_site_id_fkey'
    ) THEN
        ALTER TABLE public.app_reviews
            ADD CONSTRAINT app_reviews_site_id_fkey
            FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL NOT VALID;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_installations_site
    ON public.app_installations USING btree (site_id)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_app_reviews_site
    ON public.app_reviews USING btree (site_id)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_marketplace_apps_published
    ON public.marketplace_apps USING btree (status, updated_at DESC)
    WHERE (deleted_at IS NULL);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_categories_updated_at') THEN
        CREATE TRIGGER update_app_categories_updated_at
            BEFORE UPDATE ON public.app_categories
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_extensions_updated_at') THEN
        CREATE TRIGGER update_app_extensions_updated_at
            BEFORE UPDATE ON public.app_extensions
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_installations_updated_at') THEN
        CREATE TRIGGER update_app_installations_updated_at
            BEFORE UPDATE ON public.app_installations
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.app_api_quotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    installation_id uuid,
    site_id uuid,
    route_group text DEFAULT '*'::text NOT NULL,
    limit_per_day integer DEFAULT 10000 NOT NULL,
    used_count integer DEFAULT 0 NOT NULL,
    reset_at timestamp with time zone NOT NULL,
    last_request_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_api_quotas_pkey PRIMARY KEY (id),
    CONSTRAINT app_api_quotas_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_api_quotas_installation_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE CASCADE,
    CONSTRAINT app_api_quotas_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
    CONSTRAINT app_api_quotas_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_api_quotas_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_api_quotas_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'disabled'::text]))),
    CONSTRAINT app_api_quotas_nonnegative_check CHECK ((limit_per_day > 0) AND (used_count >= 0))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_api_quotas_unique_scope
    ON public.app_api_quotas USING btree (
        app_id,
        COALESCE(installation_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid),
        route_group
    )
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_app_api_quotas_installation
    ON public.app_api_quotas USING btree (installation_id, route_group)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_app_api_quotas_site
    ON public.app_api_quotas USING btree (site_id, route_group)
    WHERE (deleted_at IS NULL);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_api_quotas_updated_at') THEN
        CREATE TRIGGER update_app_api_quotas_updated_at
            BEFORE UPDATE ON public.app_api_quotas
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;
END $$;

ALTER TABLE public.marketplace_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_api_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_marketplace_apps ON public.marketplace_apps;
DROP POLICY IF EXISTS service_role_app_developers ON public.app_developers;
DROP POLICY IF EXISTS service_role_app_categories ON public.app_categories;
DROP POLICY IF EXISTS service_role_app_extensions ON public.app_extensions;
DROP POLICY IF EXISTS service_role_app_installations ON public.app_installations;
DROP POLICY IF EXISTS service_role_app_reviews ON public.app_reviews;
DROP POLICY IF EXISTS service_role_app_webhooks ON public.app_webhooks;

CREATE POLICY service_role_marketplace_apps ON public.marketplace_apps
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_app_developers ON public.app_developers
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_app_categories ON public.app_categories
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_app_extensions ON public.app_extensions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_app_installations ON public.app_installations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_app_reviews ON public.app_reviews
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_app_webhooks ON public.app_webhooks
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY app_api_quotas_service_all ON public.app_api_quotas
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_categories_public_active_read ON public.app_categories;
CREATE POLICY app_categories_public_active_read ON public.app_categories
    FOR SELECT USING ((is_active = true) AND (deleted_at IS NULL));

DROP POLICY IF EXISTS app_developers_owner_all ON public.app_developers;
CREATE POLICY app_developers_owner_all ON public.app_developers
    FOR ALL USING ((user_id = auth.uid()))
    WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS app_developers_public_approved_read ON public.app_developers;
CREATE POLICY app_developers_public_approved_read ON public.app_developers
    FOR SELECT USING ((status = 'approved'::text));

DROP POLICY IF EXISTS marketplace_apps_public_published_read ON public.marketplace_apps;
CREATE POLICY marketplace_apps_public_published_read ON public.marketplace_apps
    FOR SELECT USING ((status = 'published'::text) AND (deleted_at IS NULL));

DROP POLICY IF EXISTS marketplace_apps_developer_owner_all ON public.marketplace_apps;
CREATE POLICY marketplace_apps_developer_owner_all ON public.marketplace_apps
    FOR ALL USING (EXISTS (
        SELECT 1
          FROM public.app_developers
         WHERE app_developers.id = marketplace_apps.developer_id
           AND app_developers.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1
          FROM public.app_developers
         WHERE app_developers.id = marketplace_apps.developer_id
           AND app_developers.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS app_extensions_public_published_read ON public.app_extensions;
CREATE POLICY app_extensions_public_published_read ON public.app_extensions
    FOR SELECT USING (EXISTS (
        SELECT 1
          FROM public.marketplace_apps
         WHERE marketplace_apps.id = app_extensions.app_id
           AND marketplace_apps.status = 'published'::text
           AND marketplace_apps.deleted_at IS NULL
    ));

DROP POLICY IF EXISTS app_extensions_developer_owner_all ON public.app_extensions;
CREATE POLICY app_extensions_developer_owner_all ON public.app_extensions
    FOR ALL USING (EXISTS (
        SELECT 1
          FROM public.marketplace_apps
          JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
         WHERE marketplace_apps.id = app_extensions.app_id
           AND app_developers.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1
          FROM public.marketplace_apps
          JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
         WHERE marketplace_apps.id = app_extensions.app_id
           AND app_developers.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS app_installations_site_owner_read ON public.app_installations;
CREATE POLICY app_installations_site_owner_read ON public.app_installations
    FOR SELECT USING (EXISTS (
        SELECT 1
          FROM public.sites
         WHERE sites.id = COALESCE(app_installations.site_id, app_installations.store_id)
           AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid()))
           AND sites.deleted_at IS NULL
    ));

DROP POLICY IF EXISTS app_installations_site_owner_mutate ON public.app_installations;
CREATE POLICY app_installations_site_owner_mutate ON public.app_installations
    FOR UPDATE USING (EXISTS (
        SELECT 1
          FROM public.sites
         WHERE sites.id = COALESCE(app_installations.site_id, app_installations.store_id)
           AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid()))
           AND sites.deleted_at IS NULL
    ))
    WITH CHECK (EXISTS (
        SELECT 1
          FROM public.sites
         WHERE sites.id = COALESCE(app_installations.site_id, app_installations.store_id)
           AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid()))
           AND sites.deleted_at IS NULL
    ));

DROP POLICY IF EXISTS app_reviews_public_published_read ON public.app_reviews;
CREATE POLICY app_reviews_public_published_read ON public.app_reviews
    FOR SELECT USING ((status = 'published'::text) AND (deleted_at IS NULL));

DROP POLICY IF EXISTS app_reviews_site_or_developer_read ON public.app_reviews;
CREATE POLICY app_reviews_site_or_developer_read ON public.app_reviews
    FOR SELECT USING (
        EXISTS (
            SELECT 1
              FROM public.sites
             WHERE sites.id = COALESCE(app_reviews.site_id, app_reviews.store_id)
               AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid()))
               AND sites.deleted_at IS NULL
        )
        OR EXISTS (
            SELECT 1
              FROM public.marketplace_apps
              JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
             WHERE marketplace_apps.id = app_reviews.app_id
               AND app_developers.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS app_reviews_site_owner_mutate ON public.app_reviews;
CREATE POLICY app_reviews_site_owner_mutate ON public.app_reviews
    FOR UPDATE USING (EXISTS (
        SELECT 1
          FROM public.sites
         WHERE sites.id = COALESCE(app_reviews.site_id, app_reviews.store_id)
           AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid()))
           AND sites.deleted_at IS NULL
    ))
    WITH CHECK (EXISTS (
        SELECT 1
          FROM public.sites
         WHERE sites.id = COALESCE(app_reviews.site_id, app_reviews.store_id)
           AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid()))
           AND sites.deleted_at IS NULL
    ));

DROP POLICY IF EXISTS app_webhooks_developer_owner_all ON public.app_webhooks;
CREATE POLICY app_webhooks_developer_owner_all ON public.app_webhooks
    FOR ALL USING (EXISTS (
        SELECT 1
          FROM public.marketplace_apps
          JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
         WHERE marketplace_apps.id = app_webhooks.app_id
           AND app_developers.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1
          FROM public.marketplace_apps
          JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
         WHERE marketplace_apps.id = app_webhooks.app_id
           AND app_developers.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS app_api_quotas_developer_read ON public.app_api_quotas;
CREATE POLICY app_api_quotas_developer_read ON public.app_api_quotas
    FOR SELECT USING (EXISTS (
        SELECT 1
          FROM public.marketplace_apps
          JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
         WHERE marketplace_apps.id = app_api_quotas.app_id
           AND app_developers.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS app_api_quotas_site_owner_read ON public.app_api_quotas;
CREATE POLICY app_api_quotas_site_owner_read ON public.app_api_quotas
    FOR SELECT USING (EXISTS (
        SELECT 1
          FROM public.sites
         WHERE sites.id = app_api_quotas.site_id
           AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid()))
           AND sites.deleted_at IS NULL
    ));
