-- Internal OS Wave 2: deterministic risk detection.
-- Risk writes are owned by /v1/operations/risk/* and services/queue-workers risk scoring jobs.

CREATE TABLE public.risk_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    signal_type text NOT NULL,
    predicate jsonb DEFAULT '{}'::jsonb NOT NULL,
    weight integer NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    sandbox boolean DEFAULT true NOT NULL,
    action text DEFAULT 'score'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    activated_by uuid,
    activated_at timestamp with time zone,
    disabled_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT risk_rules_action_check CHECK ((action = ANY (ARRAY['score'::text, 'review'::text, 'restrict'::text]))),
    CONSTRAINT risk_rules_signal_type_check CHECK ((signal_type = ANY (ARRAY['signup_velocity'::text, 'store_creation_velocity'::text, 'disposable_email'::text, 'shared_banned_instrument'::text, 'shared_banned_device'::text, 'failed_auth_burst'::text, 'chargeback_rate_breach'::text, 'country_ip_mismatch'::text, 'vpn_tor'::text, 'manual_review'::text]))),
    CONSTRAINT risk_rules_weight_check CHECK (((weight >= 0) AND (weight <= 100)))
);

ALTER TABLE ONLY public.risk_rules
    ADD CONSTRAINT risk_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.risk_rules
    ADD CONSTRAINT risk_rules_name_key UNIQUE (name);

CREATE INDEX idx_risk_rules_enabled_signal ON public.risk_rules USING btree (enabled, signal_type) WHERE (deleted_at IS NULL);
CREATE INDEX idx_risk_rules_sandbox ON public.risk_rules USING btree (sandbox) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_risk_rules_updated_at BEFORE UPDATE ON public.risk_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY risk_rules_service_all ON public.risk_rules FOR ALL TO service_role
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

INSERT INTO public.risk_rules (name, description, signal_type, predicate, weight, enabled, sandbox, action, metadata)
VALUES
    ('Signup velocity per IP/device', 'Flags bursts of signup attempts from the same IP or device window.', 'signup_velocity', '{"window_seconds":3600,"threshold":5}'::jsonb, 35, true, false, 'review', '{"default_policy":true}'::jsonb),
    ('Store creation velocity per IP/device', 'Flags repeated store creation from one IP or device window.', 'store_creation_velocity', '{"window_seconds":86400,"threshold":3}'::jsonb, 35, true, false, 'review', '{"default_policy":true}'::jsonb),
    ('Disposable email provider', 'Flags known disposable or temporary email domains.', 'disposable_email', '{"domain_list":"operator-maintained"}'::jsonb, 25, true, false, 'score', '{"default_policy":true}'::jsonb),
    ('Shared banned payment instrument', 'Flags payment instruments linked to a banned account.', 'shared_banned_instrument', '{"match":"payment_fingerprint"}'::jsonb, 55, true, false, 'restrict', '{"default_policy":true}'::jsonb),
    ('Shared banned device', 'Flags devices linked to previously banned subjects.', 'shared_banned_device', '{"match":"device_fingerprint"}'::jsonb, 45, true, false, 'restrict', '{"default_policy":true}'::jsonb),
    ('Failed auth burst', 'Flags unusually dense failed authentication attempts.', 'failed_auth_burst', '{"window_seconds":1800,"threshold":8}'::jsonb, 25, true, false, 'review', '{"default_policy":true}'::jsonb),
    ('Chargeback rate breach', 'Flags chargeback rates above the default loss-tolerance threshold.', 'chargeback_rate_breach', '{"window_days":30,"rate_threshold":0.02,"minimum_orders":10}'::jsonb, 45, true, false, 'restrict', '{"default_policy":true}'::jsonb),
    ('Country and IP mismatch', 'Flags merchant country/IP inconsistencies for manual review.', 'country_ip_mismatch', '{"country_source":"merchant_profile"}'::jsonb, 20, true, false, 'score', '{"default_policy":true}'::jsonb),
    ('VPN or TOR heuristic', 'Flags signups or payments routed through anonymizing infrastructure.', 'vpn_tor', '{"source":"operator-maintained-heuristic"}'::jsonb, 20, true, false, 'score', '{"default_policy":true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE public.risk_signals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    signal_type text NOT NULL,
    source text DEFAULT 'operations'::text NOT NULL,
    severity text DEFAULT 'medium'::text NOT NULL,
    weight integer,
    rule_id uuid,
    value numeric,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    observed_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT risk_signals_entity_type_check CHECK ((entity_type = ANY (ARRAY['signup'::text, 'merchant'::text, 'site'::text, 'payment'::text, 'app'::text, 'theme'::text, 'developer'::text]))),
    CONSTRAINT risk_signals_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT risk_signals_signal_type_check CHECK ((signal_type = ANY (ARRAY['signup_velocity'::text, 'store_creation_velocity'::text, 'disposable_email'::text, 'shared_banned_instrument'::text, 'shared_banned_device'::text, 'failed_auth_burst'::text, 'chargeback_rate_breach'::text, 'country_ip_mismatch'::text, 'vpn_tor'::text, 'manual_review'::text]))),
    CONSTRAINT risk_signals_weight_check CHECK (((weight IS NULL) OR ((weight >= 0) AND (weight <= 100))))
);

ALTER TABLE ONLY public.risk_signals
    ADD CONSTRAINT risk_signals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.risk_signals
    ADD CONSTRAINT risk_signals_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.risk_rules(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.risk_signals
    ADD CONSTRAINT risk_signals_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE INDEX idx_risk_signals_entity ON public.risk_signals USING btree (entity_type, entity_id, observed_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_risk_signals_site ON public.risk_signals USING btree (site_id, observed_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_risk_signals_signal_type ON public.risk_signals USING btree (signal_type, observed_at DESC) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_risk_signals_updated_at BEFORE UPDATE ON public.risk_signals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.risk_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY risk_signals_service_all ON public.risk_signals FOR ALL TO service_role
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY risk_signals_site_owner_read ON public.risk_signals FOR SELECT TO authenticated
    USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = risk_signals.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL))))));

CREATE TABLE public.risk_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    score integer NOT NULL,
    band text NOT NULL,
    breakdown jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    manual_decision text,
    decision_reason text,
    decided_by uuid,
    decided_at timestamp with time zone,
    scored_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT risk_scores_band_check CHECK ((band = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT risk_scores_decision_check CHECK (((manual_decision IS NULL) OR (manual_decision = ANY (ARRAY['confirm'::text, 'dismiss'::text, 'manual_block'::text])))),
    CONSTRAINT risk_scores_entity_type_check CHECK ((entity_type = ANY (ARRAY['signup'::text, 'merchant'::text, 'site'::text, 'payment'::text, 'app'::text, 'theme'::text, 'developer'::text]))),
    CONSTRAINT risk_scores_score_check CHECK (((score >= 0) AND (score <= 100))),
    CONSTRAINT risk_scores_status_check CHECK ((status = ANY (ARRAY['open'::text, 'confirmed'::text, 'dismissed'::text, 'restricted'::text])))
);

ALTER TABLE ONLY public.risk_scores
    ADD CONSTRAINT risk_scores_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.risk_scores
    ADD CONSTRAINT risk_scores_entity_key UNIQUE (entity_type, entity_id);

ALTER TABLE ONLY public.risk_scores
    ADD CONSTRAINT risk_scores_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE INDEX idx_risk_scores_band ON public.risk_scores USING btree (band, scored_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_risk_scores_site ON public.risk_scores USING btree (site_id, scored_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_risk_scores_status ON public.risk_scores USING btree (status, scored_at DESC) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_risk_scores_updated_at BEFORE UPDATE ON public.risk_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY risk_scores_service_all ON public.risk_scores FOR ALL TO service_role
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY risk_scores_site_owner_read ON public.risk_scores FOR SELECT TO authenticated
    USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = risk_scores.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL))))));

CREATE TABLE public.velocity_counters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    subject_type text NOT NULL,
    subject_key text NOT NULL,
    metric text NOT NULL,
    window_seconds integer NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    window_start timestamp with time zone NOT NULL,
    window_end timestamp with time zone NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT velocity_counters_count_check CHECK ((count >= 0)),
    CONSTRAINT velocity_counters_window_seconds_check CHECK ((window_seconds > 0))
);

ALTER TABLE ONLY public.velocity_counters
    ADD CONSTRAINT velocity_counters_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.velocity_counters
    ADD CONSTRAINT velocity_counters_key UNIQUE (subject_type, subject_key, metric, window_seconds, window_start);

ALTER TABLE ONLY public.velocity_counters
    ADD CONSTRAINT velocity_counters_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE INDEX idx_velocity_counters_site_metric ON public.velocity_counters USING btree (site_id, metric, window_end DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_velocity_counters_subject ON public.velocity_counters USING btree (subject_type, subject_key, window_end DESC) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_velocity_counters_updated_at BEFORE UPDATE ON public.velocity_counters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.velocity_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY velocity_counters_service_all ON public.velocity_counters FOR ALL TO service_role
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY velocity_counters_site_owner_read ON public.velocity_counters FOR SELECT TO authenticated
    USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = velocity_counters.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL))))));

CREATE TABLE public.chargeback_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    payment_id text,
    order_id uuid,
    provider text NOT NULL,
    amount_minor integer DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    reason_code text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    CONSTRAINT chargeback_events_amount_check CHECK ((amount_minor >= 0)),
    CONSTRAINT chargeback_events_status_check CHECK ((status = ANY (ARRAY['open'::text, 'won'::text, 'lost'::text, 'reversed'::text])))
);

ALTER TABLE ONLY public.chargeback_events
    ADD CONSTRAINT chargeback_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.chargeback_events
    ADD CONSTRAINT chargeback_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.chargeback_events
    ADD CONSTRAINT chargeback_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE INDEX idx_chargeback_events_payment ON public.chargeback_events USING btree (payment_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_chargeback_events_site ON public.chargeback_events USING btree (site_id, occurred_at DESC) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_chargeback_events_updated_at BEFORE UPDATE ON public.chargeback_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.chargeback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY chargeback_events_service_all ON public.chargeback_events FOR ALL TO service_role
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY chargeback_events_site_owner_read ON public.chargeback_events FOR SELECT TO authenticated
    USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = chargeback_events.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL))))));

CREATE TABLE public.risk_action_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action_type text NOT NULL,
    action_status text DEFAULT 'recorded'::text NOT NULL,
    rule_id uuid,
    score_id uuid,
    signal_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    reason text NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    actor_type text DEFAULT 'system'::text NOT NULL,
    actor_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT risk_action_events_action_status_check CHECK ((action_status = ANY (ARRAY['recorded'::text, 'applied'::text, 'failed'::text]))),
    CONSTRAINT risk_action_events_action_type_check CHECK ((action_type = ANY (ARRAY['score'::text, 'auto_restrict'::text, 'manual_decision'::text, 'ts_case_open_requested'::text, 'rule_change'::text]))),
    CONSTRAINT risk_action_events_actor_type_check CHECK ((actor_type = ANY (ARRAY['employee'::text, 'super_admin'::text, 'system'::text]))),
    CONSTRAINT risk_action_events_entity_type_check CHECK ((entity_type = ANY (ARRAY['signup'::text, 'merchant'::text, 'site'::text, 'payment'::text, 'app'::text, 'theme'::text, 'developer'::text])))
);

ALTER TABLE ONLY public.risk_action_events
    ADD CONSTRAINT risk_action_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.risk_action_events
    ADD CONSTRAINT risk_action_events_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.risk_rules(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.risk_action_events
    ADD CONSTRAINT risk_action_events_score_id_fkey FOREIGN KEY (score_id) REFERENCES public.risk_scores(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.risk_action_events
    ADD CONSTRAINT risk_action_events_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE INDEX idx_risk_action_events_entity ON public.risk_action_events USING btree (entity_type, entity_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_risk_action_events_score ON public.risk_action_events USING btree (score_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_risk_action_events_site ON public.risk_action_events USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);

ALTER TABLE public.risk_action_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY risk_action_events_service_all ON public.risk_action_events FOR ALL TO service_role
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY risk_action_events_site_owner_read ON public.risk_action_events FOR SELECT TO authenticated
    USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = risk_action_events.site_id) AND (sites.user_id = auth.uid()) AND (sites.deleted_at IS NULL))))));
