-- Apps marketplace merchant spend controls.
-- App-store routes are the single writer; app billing and usage ingest read controls to block over-cap spend.

CREATE TABLE public.app_spend_controls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    monthly_cap_minor integer DEFAULT 0 NOT NULL,
    alert_threshold_minor integer DEFAULT 0 NOT NULL,
    alerts_enabled boolean DEFAULT true NOT NULL,
    enforcement_mode text DEFAULT 'block'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_spend_controls_alert_threshold_check CHECK (alert_threshold_minor >= 0),
    CONSTRAINT app_spend_controls_enforcement_mode_check CHECK (enforcement_mode = ANY (ARRAY['block'::text, 'alert_only'::text])),
    CONSTRAINT app_spend_controls_monthly_cap_check CHECK (monthly_cap_minor >= 0),
    CONSTRAINT app_spend_controls_status_check CHECK (status = ANY (ARRAY['active'::text, 'disabled'::text]))
);

ALTER TABLE ONLY public.app_spend_controls
    ADD CONSTRAINT app_spend_controls_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_spend_controls
    ADD CONSTRAINT app_spend_controls_site_id_key UNIQUE (site_id);

ALTER TABLE ONLY public.app_spend_controls
    ADD CONSTRAINT app_spend_controls_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_spend_controls
    ADD CONSTRAINT app_spend_controls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.app_spend_controls
    ADD CONSTRAINT app_spend_controls_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

CREATE INDEX idx_app_spend_controls_site_status
    ON public.app_spend_controls USING btree (site_id, status)
    WHERE (deleted_at IS NULL);

CREATE TRIGGER update_app_spend_controls_updated_at
    BEFORE UPDATE ON public.app_spend_controls
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_spend_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_spend_controls_service_all ON public.app_spend_controls
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY app_spend_controls_store_owner_read ON public.app_spend_controls FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_spend_controls.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));

CREATE POLICY app_spend_controls_store_owner_insert ON public.app_spend_controls FOR INSERT
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_spend_controls.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));

CREATE POLICY app_spend_controls_store_owner_update ON public.app_spend_controls FOR UPDATE
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_spend_controls.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_spend_controls.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));
