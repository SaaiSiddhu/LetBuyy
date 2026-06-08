-- Wave 6: developer analytics, webhook management, collaborator access,
-- partner tiers, sandbox/demo tooling, and marketplace telemetry sink.

ALTER TABLE public.app_webhooks
    ADD COLUMN IF NOT EXISTS name text,
    ADD COLUMN IF NOT EXISTS event_types text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS last_delivery_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS created_by uuid,
    ADD COLUMN IF NOT EXISTS updated_by uuid,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'app_webhooks_status_check'
    ) THEN
        ALTER TABLE public.app_webhooks
            ADD CONSTRAINT app_webhooks_status_check
            CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'disabled'::text]))) NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_webhooks_updated_at'
    ) THEN
        CREATE TRIGGER update_app_webhooks_updated_at
            BEFORE UPDATE ON public.app_webhooks
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.app_partner_analytics_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid NOT NULL,
    app_id uuid,
    metric_date date NOT NULL,
    installs integer DEFAULT 0 NOT NULL,
    uninstalls integer DEFAULT 0 NOT NULL,
    active_installations integer DEFAULT 0 NOT NULL,
    reviews integer DEFAULT 0 NOT NULL,
    usage_events integer DEFAULT 0 NOT NULL,
    api_requests integer DEFAULT 0 NOT NULL,
    api_errors integer DEFAULT 0 NOT NULL,
    gross_amount_minor bigint DEFAULT 0 NOT NULL,
    partner_amount_minor bigint DEFAULT 0 NOT NULL,
    payout_released_minor bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_partner_analytics_daily_pkey PRIMARY KEY (id),
    CONSTRAINT app_partner_analytics_daily_developer_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE,
    CONSTRAINT app_partner_analytics_daily_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_partner_analytics_daily_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_partner_analytics_daily_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_partner_analytics_daily_currency_check CHECK ((currency = 'INR'::text)),
    CONSTRAINT app_partner_analytics_daily_nonnegative_check CHECK (
        installs >= 0 AND uninstalls >= 0 AND active_installations >= 0 AND reviews >= 0
        AND usage_events >= 0 AND api_requests >= 0 AND api_errors >= 0
        AND gross_amount_minor >= 0 AND partner_amount_minor >= 0 AND payout_released_minor >= 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_partner_analytics_daily_unique
    ON public.app_partner_analytics_daily USING btree (developer_id, COALESCE(app_id, '00000000-0000-0000-0000-000000000000'::uuid), metric_date)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_app_partner_analytics_daily_developer_date
    ON public.app_partner_analytics_daily USING btree (developer_id, metric_date DESC)
    WHERE (deleted_at IS NULL);

CREATE TABLE IF NOT EXISTS public.app_api_usage_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid NOT NULL,
    app_id uuid NOT NULL,
    metric_date date NOT NULL,
    route_group text NOT NULL,
    method text DEFAULT 'GET'::text NOT NULL,
    request_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    avg_latency_ms integer DEFAULT 0 NOT NULL,
    p95_latency_ms integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_api_usage_metrics_pkey PRIMARY KEY (id),
    CONSTRAINT app_api_usage_metrics_developer_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE,
    CONSTRAINT app_api_usage_metrics_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_api_usage_metrics_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_api_usage_metrics_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_api_usage_metrics_nonnegative_check CHECK (
        request_count >= 0 AND error_count >= 0 AND avg_latency_ms >= 0 AND p95_latency_ms >= 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_api_usage_metrics_unique
    ON public.app_api_usage_metrics USING btree (app_id, metric_date, route_group, method)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_app_api_usage_metrics_developer_date
    ON public.app_api_usage_metrics USING btree (developer_id, metric_date DESC)
    WHERE (deleted_at IS NULL);

CREATE TABLE IF NOT EXISTS public.app_collaborator_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid NOT NULL,
    code_prefix text NOT NULL,
    code_hash text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    redeemed_at timestamp with time zone,
    redeemed_by uuid,
    redeemed_site_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_collaborator_codes_pkey PRIMARY KEY (id),
    CONSTRAINT app_collaborator_codes_developer_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE,
    CONSTRAINT app_collaborator_codes_redeemed_by_fkey FOREIGN KEY (redeemed_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_collaborator_codes_site_fkey FOREIGN KEY (redeemed_site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT app_collaborator_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_collaborator_codes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_collaborator_codes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'redeemed'::text, 'expired'::text, 'revoked'::text])))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_collaborator_codes_hash
    ON public.app_collaborator_codes USING btree (code_hash)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_app_collaborator_codes_developer_created
    ON public.app_collaborator_codes USING btree (developer_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE TABLE IF NOT EXISTS public.app_partner_agency_seats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid NOT NULL,
    site_id uuid NOT NULL,
    collaborator_code_id uuid,
    seat_user_id uuid,
    role text DEFAULT 'agency_collaborator'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_partner_agency_seats_pkey PRIMARY KEY (id),
    CONSTRAINT app_partner_agency_seats_developer_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE,
    CONSTRAINT app_partner_agency_seats_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
    CONSTRAINT app_partner_agency_seats_code_fkey FOREIGN KEY (collaborator_code_id) REFERENCES public.app_collaborator_codes(id) ON DELETE SET NULL,
    CONSTRAINT app_partner_agency_seats_user_fkey FOREIGN KEY (seat_user_id) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_partner_agency_seats_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_partner_agency_seats_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_partner_agency_seats_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text, 'expired'::text])))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_partner_agency_seats_unique_active
    ON public.app_partner_agency_seats USING btree (developer_id, site_id)
    WHERE ((status = 'active'::text) AND (deleted_at IS NULL));

CREATE TABLE IF NOT EXISTS public.app_partner_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid NOT NULL,
    tier text DEFAULT 'bronze'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    awarded_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    criteria jsonb DEFAULT '{}'::jsonb NOT NULL,
    metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    reason text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_partner_tiers_pkey PRIMARY KEY (id),
    CONSTRAINT app_partner_tiers_developer_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE,
    CONSTRAINT app_partner_tiers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_partner_tiers_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_partner_tiers_tier_check CHECK ((tier = ANY (ARRAY['bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text]))),
    CONSTRAINT app_partner_tiers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text])))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_partner_tiers_active
    ON public.app_partner_tiers USING btree (developer_id)
    WHERE ((status = 'active'::text) AND (deleted_at IS NULL));

CREATE TABLE IF NOT EXISTS public.app_sandbox_stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid NOT NULL,
    site_id uuid,
    name text NOT NULL,
    subdomain text,
    status text DEFAULT 'requested'::text NOT NULL,
    provisioning_mode text DEFAULT 'sandbox'::text NOT NULL,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_sandbox_stores_pkey PRIMARY KEY (id),
    CONSTRAINT app_sandbox_stores_developer_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE,
    CONSTRAINT app_sandbox_stores_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT app_sandbox_stores_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_sandbox_stores_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_sandbox_stores_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'ready'::text, 'failed'::text, 'expired'::text]))),
    CONSTRAINT app_sandbox_stores_mode_check CHECK ((provisioning_mode = ANY (ARRAY['sandbox'::text, 'test_store'::text, 'manual'::text])))
);

CREATE INDEX IF NOT EXISTS idx_app_sandbox_stores_developer_created
    ON public.app_sandbox_stores USING btree (developer_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE TABLE IF NOT EXISTS public.app_demo_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    developer_id uuid NOT NULL,
    site_id uuid,
    demo_url text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_demo_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT app_demo_sessions_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_demo_sessions_developer_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE,
    CONSTRAINT app_demo_sessions_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT app_demo_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_demo_sessions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_demo_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'disabled'::text])))
);

CREATE INDEX IF NOT EXISTS idx_app_demo_sessions_app_created
    ON public.app_demo_sessions USING btree (app_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE TABLE IF NOT EXISTS public.app_telemetry_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    developer_id uuid,
    app_id uuid,
    site_id uuid,
    event_type text NOT NULL,
    source text DEFAULT 'marketplace'::text NOT NULL,
    session_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_telemetry_events_pkey PRIMARY KEY (id),
    CONSTRAINT app_telemetry_events_developer_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE SET NULL,
    CONSTRAINT app_telemetry_events_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE SET NULL,
    CONSTRAINT app_telemetry_events_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT app_telemetry_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_telemetry_events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_telemetry_events_app_time
    ON public.app_telemetry_events USING btree (app_id, occurred_at DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_app_telemetry_events_type_time
    ON public.app_telemetry_events USING btree (event_type, occurred_at DESC)
    WHERE (deleted_at IS NULL);

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'app_partner_analytics_daily',
        'app_api_usage_metrics',
        'app_collaborator_codes',
        'app_partner_agency_seats',
        'app_partner_tiers',
        'app_sandbox_stores',
        'app_demo_sessions',
        'app_telemetry_events'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'update_' || table_name || '_updated_at'
        ) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', 'update_' || table_name || '_updated_at', table_name);
        END IF;
    END LOOP;
END $$;

ALTER TABLE public.app_partner_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_api_usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_collaborator_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_partner_agency_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_partner_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_sandbox_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_telemetry_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'app_partner_analytics_daily',
        'app_api_usage_metrics',
        'app_collaborator_codes',
        'app_partner_agency_seats',
        'app_partner_tiers',
        'app_sandbox_stores',
        'app_demo_sessions',
        'app_telemetry_events'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = table_name
              AND policyname = table_name || '_service_all'
        ) THEN
            EXECUTE format('CREATE POLICY %I ON public.%I USING ((auth.role() = ''service_role''::text)) WITH CHECK ((auth.role() = ''service_role''::text))', table_name || '_service_all', table_name);
        END IF;
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_webhooks' AND policyname = 'app_webhooks_developer_read') THEN
        CREATE POLICY app_webhooks_developer_read ON public.app_webhooks
            FOR SELECT USING (EXISTS (
                SELECT 1 FROM public.marketplace_apps
                JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
                WHERE marketplace_apps.id = app_webhooks.app_id
                  AND app_developers.user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_partner_analytics_daily' AND policyname = 'app_partner_analytics_daily_developer_read') THEN
        CREATE POLICY app_partner_analytics_daily_developer_read ON public.app_partner_analytics_daily
            FOR SELECT USING (EXISTS (
                SELECT 1 FROM public.app_developers
                WHERE app_developers.id = app_partner_analytics_daily.developer_id
                  AND app_developers.user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_api_usage_metrics' AND policyname = 'app_api_usage_metrics_developer_read') THEN
        CREATE POLICY app_api_usage_metrics_developer_read ON public.app_api_usage_metrics
            FOR SELECT USING (EXISTS (
                SELECT 1 FROM public.app_developers
                WHERE app_developers.id = app_api_usage_metrics.developer_id
                  AND app_developers.user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_collaborator_codes' AND policyname = 'app_collaborator_codes_developer_read') THEN
        CREATE POLICY app_collaborator_codes_developer_read ON public.app_collaborator_codes
            FOR SELECT USING (EXISTS (
                SELECT 1 FROM public.app_developers
                WHERE app_developers.id = app_collaborator_codes.developer_id
                  AND app_developers.user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_partner_agency_seats' AND policyname = 'app_partner_agency_seats_developer_read') THEN
        CREATE POLICY app_partner_agency_seats_developer_read ON public.app_partner_agency_seats
            FOR SELECT USING (EXISTS (
                SELECT 1 FROM public.app_developers
                WHERE app_developers.id = app_partner_agency_seats.developer_id
                  AND app_developers.user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_partner_tiers' AND policyname = 'app_partner_tiers_developer_read') THEN
        CREATE POLICY app_partner_tiers_developer_read ON public.app_partner_tiers
            FOR SELECT USING (EXISTS (
                SELECT 1 FROM public.app_developers
                WHERE app_developers.id = app_partner_tiers.developer_id
                  AND app_developers.user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_sandbox_stores' AND policyname = 'app_sandbox_stores_developer_read') THEN
        CREATE POLICY app_sandbox_stores_developer_read ON public.app_sandbox_stores
            FOR SELECT USING (EXISTS (
                SELECT 1 FROM public.app_developers
                WHERE app_developers.id = app_sandbox_stores.developer_id
                  AND app_developers.user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_demo_sessions' AND policyname = 'app_demo_sessions_public_read') THEN
        CREATE POLICY app_demo_sessions_public_read ON public.app_demo_sessions
            FOR SELECT USING ((status = 'active'::text) AND (deleted_at IS NULL));
    END IF;
END $$;
