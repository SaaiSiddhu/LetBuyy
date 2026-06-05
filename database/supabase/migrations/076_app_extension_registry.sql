-- WS13 X1: per-store app extension and function registry.
-- App declarations remain app-owned; installed extension state is tenant-scoped by site_id.

CREATE TABLE public.app_extension_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    app_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    extension_handle text NOT NULL,
    extension_type text NOT NULL,
    surface text NOT NULL,
    target text NOT NULL,
    renderer text NOT NULL,
    source_url text,
    source_entrypoint text,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    capabilities text[] DEFAULT '{}'::text[] NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    manifest_schema_version text NOT NULL,
    app_version text,
    status text DEFAULT 'enabled'::text NOT NULL,
    enabled_at timestamp with time zone DEFAULT now() NOT NULL,
    disabled_at timestamp with time zone,
    revoked_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_extension_registrations_extension_type_check CHECK ((extension_type = ANY (ARRAY['settings_page'::text, 'dashboard_widget'::text, 'product_action'::text, 'order_action'::text, 'checkout_extension'::text, 'storefront_block'::text]))),
    CONSTRAINT app_extension_registrations_renderer_check CHECK ((renderer = ANY (ARRAY['iframe'::text, 'web_component'::text, 'liquid_app_block'::text]))),
    CONSTRAINT app_extension_registrations_status_check CHECK ((status = ANY (ARRAY['enabled'::text, 'disabled'::text, 'revoked'::text]))),
    CONSTRAINT app_extension_registrations_surface_check CHECK ((surface = ANY (ARRAY['admin.ui'::text, 'checkout.ui'::text, 'theme.app_block'::text])))
);

ALTER TABLE ONLY public.app_extension_registrations
    ADD CONSTRAINT app_extension_registrations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_extension_registrations
    ADD CONSTRAINT app_extension_registrations_installation_handle_key UNIQUE (installation_id, extension_handle);

ALTER TABLE ONLY public.app_extension_registrations
    ADD CONSTRAINT app_extension_registrations_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_extension_registrations
    ADD CONSTRAINT app_extension_registrations_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_extension_registrations
    ADD CONSTRAINT app_extension_registrations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE INDEX idx_app_extension_registrations_installation ON public.app_extension_registrations USING btree (installation_id);
CREATE INDEX idx_app_extension_registrations_site_status ON public.app_extension_registrations USING btree (site_id, status) WHERE (deleted_at IS NULL);
CREATE INDEX idx_app_extension_registrations_surface_target ON public.app_extension_registrations USING btree (surface, target) WHERE (status = 'enabled'::text AND deleted_at IS NULL);

CREATE TRIGGER update_app_extension_registrations_updated_at BEFORE UPDATE ON public.app_extension_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_extension_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_extension_registrations_service_all ON public.app_extension_registrations
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY app_extension_registrations_store_owner_read ON public.app_extension_registrations FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_extension_registrations.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));

CREATE POLICY app_extension_registrations_store_owner_update ON public.app_extension_registrations FOR UPDATE
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_extension_registrations.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_extension_registrations.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));

CREATE TABLE public.app_function_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    app_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    function_handle text NOT NULL,
    name text NOT NULL,
    hooks text[] DEFAULT '{}'::text[] NOT NULL,
    runtime text DEFAULT 'wasm'::text NOT NULL,
    wasm_module_url text NOT NULL,
    wasm_sha256 text NOT NULL,
    wasm_entrypoint text DEFAULT 'run'::text NOT NULL,
    timeout_ms integer DEFAULT 5 NOT NULL,
    memory_limit_kb integer DEFAULT 512 NOT NULL,
    input_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    output_schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    manifest_schema_version text NOT NULL,
    app_version text,
    status text DEFAULT 'enabled'::text NOT NULL,
    enabled_at timestamp with time zone DEFAULT now() NOT NULL,
    disabled_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_function_registrations_memory_check CHECK (((memory_limit_kb >= 64) AND (memory_limit_kb <= 1024))),
    CONSTRAINT app_function_registrations_runtime_check CHECK ((runtime = 'wasm'::text)),
    CONSTRAINT app_function_registrations_sha256_check CHECK ((wasm_sha256 ~ '^[A-Fa-f0-9]{64}$'::text)),
    CONSTRAINT app_function_registrations_status_check CHECK ((status = ANY (ARRAY['enabled'::text, 'disabled'::text, 'revoked'::text]))),
    CONSTRAINT app_function_registrations_timeout_check CHECK (((timeout_ms >= 1) AND (timeout_ms <= 5)))
);

ALTER TABLE ONLY public.app_function_registrations
    ADD CONSTRAINT app_function_registrations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_function_registrations
    ADD CONSTRAINT app_function_registrations_installation_handle_key UNIQUE (installation_id, function_handle);

ALTER TABLE ONLY public.app_function_registrations
    ADD CONSTRAINT app_function_registrations_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_function_registrations
    ADD CONSTRAINT app_function_registrations_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_function_registrations
    ADD CONSTRAINT app_function_registrations_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE INDEX idx_app_function_registrations_hooks ON public.app_function_registrations USING gin (hooks);
CREATE INDEX idx_app_function_registrations_installation ON public.app_function_registrations USING btree (installation_id);
CREATE INDEX idx_app_function_registrations_site_status ON public.app_function_registrations USING btree (site_id, status) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_app_function_registrations_updated_at BEFORE UPDATE ON public.app_function_registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_function_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_function_registrations_service_all ON public.app_function_registrations
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY app_function_registrations_store_owner_read ON public.app_function_registrations FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_function_registrations.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));

CREATE POLICY app_function_registrations_store_owner_update ON public.app_function_registrations FOR UPDATE
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_function_registrations.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_function_registrations.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL)))));
