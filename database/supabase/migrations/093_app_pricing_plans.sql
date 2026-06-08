-- Apps marketplace pricing plans and tiers.
-- Developer routes are the single writer; public catalog and install flows read active plans.

CREATE TABLE public.app_pricing_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    developer_id uuid NOT NULL,
    plan_slug text NOT NULL,
    name text NOT NULL,
    description text,
    pricing_model text DEFAULT 'free'::text NOT NULL,
    billing_mode text,
    currency text DEFAULT 'INR'::text NOT NULL,
    amount_minor integer DEFAULT 0 NOT NULL,
    interval text DEFAULT 'none'::text NOT NULL,
    trial_days integer DEFAULT 0 NOT NULL,
    usage_meter text,
    usage_unit text,
    included_usage integer DEFAULT 0 NOT NULL,
    usage_unit_amount_minor integer DEFAULT 0 NOT NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_pricing_plans_amount_check CHECK ((amount_minor >= 0)),
    CONSTRAINT app_pricing_plans_billing_mode_check CHECK (((billing_mode IS NULL) OR (billing_mode = ANY (ARRAY['recurring'::text, 'one_time'::text, 'usage'::text])))),
    CONSTRAINT app_pricing_plans_currency_check CHECK ((currency = 'INR'::text)),
    CONSTRAINT app_pricing_plans_included_usage_check CHECK ((included_usage >= 0)),
    CONSTRAINT app_pricing_plans_interval_check CHECK ((interval = ANY (ARRAY['none'::text, 'monthly'::text, 'yearly'::text]))),
    CONSTRAINT app_pricing_plans_pricing_model_check CHECK ((pricing_model = ANY (ARRAY['free'::text, 'freemium'::text, 'recurring'::text, 'one_time'::text, 'usage'::text]))),
    CONSTRAINT app_pricing_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text]))),
    CONSTRAINT app_pricing_plans_trial_days_check CHECK (((trial_days >= 0) AND (trial_days <= 365))),
    CONSTRAINT app_pricing_plans_usage_unit_amount_check CHECK ((usage_unit_amount_minor >= 0))
);

ALTER TABLE ONLY public.app_pricing_plans
    ADD CONSTRAINT app_pricing_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_pricing_plans
    ADD CONSTRAINT app_pricing_plans_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_pricing_plans
    ADD CONSTRAINT app_pricing_plans_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_pricing_plans
    ADD CONSTRAINT app_pricing_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.app_pricing_plans
    ADD CONSTRAINT app_pricing_plans_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX app_pricing_plans_app_slug_active_key
    ON public.app_pricing_plans USING btree (app_id, plan_slug)
    WHERE (deleted_at IS NULL);

CREATE UNIQUE INDEX app_pricing_plans_one_default_active_key
    ON public.app_pricing_plans USING btree (app_id)
    WHERE ((is_default = true) AND (status = 'active'::text) AND (deleted_at IS NULL));

CREATE INDEX idx_app_pricing_plans_app_status
    ON public.app_pricing_plans USING btree (app_id, status, sort_order)
    WHERE (deleted_at IS NULL);

CREATE INDEX idx_app_pricing_plans_developer
    ON public.app_pricing_plans USING btree (developer_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE TRIGGER update_app_pricing_plans_updated_at
    BEFORE UPDATE ON public.app_pricing_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_pricing_plans_service_all ON public.app_pricing_plans
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY app_pricing_plans_public_active_read ON public.app_pricing_plans FOR SELECT
    USING (((status = 'active'::text) AND (deleted_at IS NULL)));

CREATE POLICY app_pricing_plans_developer_read ON public.app_pricing_plans FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.app_developers
      WHERE ((app_developers.id = app_pricing_plans.developer_id) AND (app_developers.user_id = auth.uid())))));

CREATE POLICY app_pricing_plans_developer_insert ON public.app_pricing_plans FOR INSERT
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.marketplace_apps
       JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
      WHERE ((marketplace_apps.id = app_pricing_plans.app_id) AND (marketplace_apps.developer_id = app_pricing_plans.developer_id) AND (app_developers.user_id = auth.uid())))));

CREATE POLICY app_pricing_plans_developer_update ON public.app_pricing_plans FOR UPDATE
    USING ((EXISTS ( SELECT 1
       FROM public.app_developers
      WHERE ((app_developers.id = app_pricing_plans.developer_id) AND (app_developers.user_id = auth.uid())))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.marketplace_apps
       JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
      WHERE ((marketplace_apps.id = app_pricing_plans.app_id) AND (marketplace_apps.developer_id = app_pricing_plans.developer_id) AND (app_developers.user_id = auth.uid())))));
