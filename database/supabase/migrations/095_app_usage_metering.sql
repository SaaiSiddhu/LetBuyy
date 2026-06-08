-- Apps marketplace usage metering.
-- app-api routes are the single writer for app_usage_events and app_usage_meter_rollups.

CREATE TABLE public.app_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    app_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    pricing_plan_id uuid,
    charge_id uuid,
    meter_name text NOT NULL,
    quantity numeric(18, 4) NOT NULL,
    billable_quantity numeric(18, 4) DEFAULT 0 NOT NULL,
    usage_unit text DEFAULT 'unit'::text NOT NULL,
    unit_amount_minor integer DEFAULT 0 NOT NULL,
    amount_minor integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    billing_status text DEFAULT 'metered'::text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    idempotency_key text NOT NULL,
    source text DEFAULT 'app_api'::text NOT NULL,
    resource_type text,
    resource_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_usage_events_amount_minor_check CHECK (amount_minor >= 0),
    CONSTRAINT app_usage_events_billable_quantity_check CHECK (billable_quantity >= 0),
    CONSTRAINT app_usage_events_billing_status_check CHECK (billing_status = ANY (ARRAY['metered'::text, 'trial_included'::text, 'blocked'::text])),
    CONSTRAINT app_usage_events_currency_check CHECK (currency = 'INR'::text),
    CONSTRAINT app_usage_events_period_check CHECK (period_end > period_start),
    CONSTRAINT app_usage_events_quantity_check CHECK (quantity > 0),
    CONSTRAINT app_usage_events_unit_amount_minor_check CHECK (unit_amount_minor >= 0)
);

ALTER TABLE ONLY public.app_usage_events
    ADD CONSTRAINT app_usage_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_usage_events
    ADD CONSTRAINT app_usage_events_installation_id_idempotency_key_key UNIQUE (installation_id, idempotency_key);

ALTER TABLE ONLY public.app_usage_events
    ADD CONSTRAINT app_usage_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_usage_events
    ADD CONSTRAINT app_usage_events_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_usage_events
    ADD CONSTRAINT app_usage_events_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_usage_events
    ADD CONSTRAINT app_usage_events_pricing_plan_id_fkey FOREIGN KEY (pricing_plan_id) REFERENCES public.app_pricing_plans(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.app_usage_events
    ADD CONSTRAINT app_usage_events_charge_id_fkey FOREIGN KEY (charge_id) REFERENCES public.app_billing_charges(id) ON DELETE SET NULL;

CREATE TABLE public.app_usage_meter_rollups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    app_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    pricing_plan_id uuid,
    charge_id uuid,
    meter_name text NOT NULL,
    usage_unit text DEFAULT 'unit'::text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    quantity numeric(18, 4) DEFAULT 0 NOT NULL,
    included_quantity numeric(18, 4) DEFAULT 0 NOT NULL,
    billable_quantity numeric(18, 4) DEFAULT 0 NOT NULL,
    unit_amount_minor integer DEFAULT 0 NOT NULL,
    amount_minor integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    last_event_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_usage_meter_rollups_amount_minor_check CHECK (amount_minor >= 0),
    CONSTRAINT app_usage_meter_rollups_billable_quantity_check CHECK (billable_quantity >= 0),
    CONSTRAINT app_usage_meter_rollups_currency_check CHECK (currency = 'INR'::text),
    CONSTRAINT app_usage_meter_rollups_included_quantity_check CHECK (included_quantity >= 0),
    CONSTRAINT app_usage_meter_rollups_period_check CHECK (period_end > period_start),
    CONSTRAINT app_usage_meter_rollups_quantity_check CHECK (quantity >= 0),
    CONSTRAINT app_usage_meter_rollups_unit_amount_minor_check CHECK (unit_amount_minor >= 0)
);

ALTER TABLE ONLY public.app_usage_meter_rollups
    ADD CONSTRAINT app_usage_meter_rollups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_usage_meter_rollups
    ADD CONSTRAINT app_usage_meter_rollups_installation_meter_period_key UNIQUE (installation_id, meter_name, period_start, period_end);

ALTER TABLE ONLY public.app_usage_meter_rollups
    ADD CONSTRAINT app_usage_meter_rollups_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_usage_meter_rollups
    ADD CONSTRAINT app_usage_meter_rollups_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_usage_meter_rollups
    ADD CONSTRAINT app_usage_meter_rollups_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_usage_meter_rollups
    ADD CONSTRAINT app_usage_meter_rollups_pricing_plan_id_fkey FOREIGN KEY (pricing_plan_id) REFERENCES public.app_pricing_plans(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.app_usage_meter_rollups
    ADD CONSTRAINT app_usage_meter_rollups_charge_id_fkey FOREIGN KEY (charge_id) REFERENCES public.app_billing_charges(id) ON DELETE SET NULL;

CREATE INDEX idx_app_usage_events_app_created
    ON public.app_usage_events USING btree (app_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX idx_app_usage_events_installation_meter_created
    ON public.app_usage_events USING btree (installation_id, meter_name, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX idx_app_usage_events_site_created
    ON public.app_usage_events USING btree (site_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX idx_app_usage_meter_rollups_app_period
    ON public.app_usage_meter_rollups USING btree (app_id, period_start DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX idx_app_usage_meter_rollups_site_period
    ON public.app_usage_meter_rollups USING btree (site_id, period_start DESC)
    WHERE (deleted_at IS NULL);

CREATE TRIGGER update_app_usage_events_updated_at
    BEFORE UPDATE ON public.app_usage_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_app_usage_meter_rollups_updated_at
    BEFORE UPDATE ON public.app_usage_meter_rollups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_usage_meter_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_usage_events_service_all ON public.app_usage_events
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY app_usage_events_store_owner_read ON public.app_usage_events FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_usage_events.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));

CREATE POLICY app_usage_events_developer_read ON public.app_usage_events FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.marketplace_apps
       JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
      WHERE ((marketplace_apps.id = app_usage_events.app_id) AND (app_developers.user_id = auth.uid())))));

CREATE POLICY app_usage_meter_rollups_service_all ON public.app_usage_meter_rollups
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY app_usage_meter_rollups_store_owner_read ON public.app_usage_meter_rollups FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_usage_meter_rollups.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));

CREATE POLICY app_usage_meter_rollups_developer_read ON public.app_usage_meter_rollups FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.marketplace_apps
       JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
      WHERE ((marketplace_apps.id = app_usage_meter_rollups.app_id) AND (app_developers.user_id = auth.uid())))));
