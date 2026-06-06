-- DRAFT SCAFFOLDING — finalize per scaffolding/README.md before moving into database/supabase/migrations/.
-- Migration 090: Risk Detection Platform (see docs/internal-operating-system-audit/RISK_DETECTION_PLATFORM.md)
-- House style: id/created_at/updated_at/deleted_at + audit cols; partial indexes on deleted_at; update_updated_at() trigger; RLS service_role + is_super_admin().

-- risk_rules: deterministic, explainable rules; weighted signals → score contribution.
CREATE TABLE public.risk_rules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    entity_type text NOT NULL,                  -- merchant | store | payment | app | theme | developer
    signal_key text NOT NULL,                   -- velocity.signup | payment.chargeback_rate | identity.disposable_email ...
    weight integer NOT NULL DEFAULT 0,          -- contribution to 0-100 score
    threshold jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'sandbox',     -- sandbox | active | retired
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT risk_rules_entity_type_check CHECK (entity_type = ANY (ARRAY['merchant','store','payment','app','theme','developer'])),
    CONSTRAINT risk_rules_status_check CHECK (status = ANY (ARRAY['sandbox','active','retired'])),
    CONSTRAINT risk_rules_weight_check CHECK (weight >= 0 AND weight <= 100)
);
CREATE INDEX idx_risk_rules_active ON public.risk_rules USING btree (entity_type, status) WHERE (deleted_at IS NULL);

-- risk_signals: raw observations feeding the score (append-only event stream).
CREATE TABLE public.risk_signals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    site_id uuid,
    signal_key text NOT NULL,
    value numeric,
    context jsonb NOT NULL DEFAULT '{}'::jsonb, -- ip, device, payment ref, evidence
    observed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT risk_signals_entity_type_check CHECK (entity_type = ANY (ARRAY['merchant','store','payment','app','theme','developer']))
);
CREATE INDEX idx_risk_signals_entity ON public.risk_signals USING btree (entity_type, entity_id, observed_at DESC);
CREATE INDEX idx_risk_signals_key ON public.risk_signals USING btree (signal_key, observed_at DESC);

-- risk_scores: current + historical score per entity, banded, with explainability.
CREATE TABLE public.risk_scores (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    site_id uuid,
    score integer NOT NULL DEFAULT 0,           -- 0-100
    band text NOT NULL DEFAULT 'low',           -- low | medium | high
    contributing_signals jsonb NOT NULL DEFAULT '[]'::jsonb, -- explainability: [{rule_id, signal_key, weight, value}]
    computed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT risk_scores_score_check CHECK (score >= 0 AND score <= 100),
    CONSTRAINT risk_scores_band_check CHECK (band = ANY (ARRAY['low','medium','high']))
);
CREATE INDEX idx_risk_scores_entity ON public.risk_scores USING btree (entity_type, entity_id, computed_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_risk_scores_band ON public.risk_scores USING btree (band, computed_at DESC) WHERE (deleted_at IS NULL);

-- velocity_counters: sliding-window counters (signups, store creation, logins, payment attempts).
CREATE TABLE public.velocity_counters (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    bucket_key text NOT NULL,                    -- e.g. ip:1.2.3.4:signup | device:xyz:store_create
    window_start timestamptz NOT NULL,
    window_seconds integer NOT NULL,
    count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT velocity_counters_count_check CHECK (count >= 0)
);
CREATE UNIQUE INDEX uq_velocity_counters_bucket_window ON public.velocity_counters USING btree (bucket_key, window_start, window_seconds);

-- chargeback_events: payment disputes feeding risk + finance.
CREATE TABLE public.chargeback_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id uuid,
    order_id uuid,
    payment_reference text,
    provider text NOT NULL,
    amount_minor integer NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'INR',
    status text NOT NULL DEFAULT 'opened',       -- opened | won | lost | reversed
    reason_code text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT chargeback_events_currency_check CHECK (currency = 'INR'),
    CONSTRAINT chargeback_events_status_check CHECK (status = ANY (ARRAY['opened','won','lost','reversed']))
);
CREATE INDEX idx_chargeback_events_site ON public.chargeback_events USING btree (site_id, occurred_at DESC) WHERE (deleted_at IS NULL);

-- risk_action_events: every auto/manual restriction, with the rule/signal that caused it (audit + appeals).
CREATE TABLE public.risk_action_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action text NOT NULL,                        -- auto_restrict | manual_block | clear | escalate_ts
    actor_type text NOT NULL DEFAULT 'system',   -- system | employee | super_admin
    actor_id uuid,
    reason text,
    triggered_by jsonb NOT NULL DEFAULT '{}'::jsonb, -- {rule_id, signals[...]} explainability
    ts_case_id uuid,                             -- link to trust & safety case if escalated
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT risk_action_events_actor_type_check CHECK (actor_type = ANY (ARRAY['system','employee','super_admin']))
);
CREATE INDEX idx_risk_action_events_entity ON public.risk_action_events USING btree (entity_type, entity_id, created_at DESC);

-- updated_at triggers
CREATE TRIGGER update_risk_rules_updated_at BEFORE UPDATE ON public.risk_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_risk_scores_updated_at BEFORE UPDATE ON public.risk_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_velocity_counters_updated_at BEFORE UPDATE ON public.velocity_counters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_chargeback_events_updated_at BEFORE UPDATE ON public.chargeback_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: internal-only domain. service_role full; super_admin read. (Tighten to operator scopes per mission §INF-11.)
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.velocity_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chargeback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_action_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY risk_rules_service_all ON public.risk_rules USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY risk_signals_service_all ON public.risk_signals USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY risk_scores_service_all ON public.risk_scores USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY velocity_counters_service_all ON public.velocity_counters USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY chargeback_events_service_all ON public.chargeback_events USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY risk_action_events_service_all ON public.risk_action_events USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY risk_scores_super_admin_read ON public.risk_scores FOR SELECT USING (public.is_super_admin());
CREATE POLICY risk_action_events_super_admin_read ON public.risk_action_events FOR SELECT USING (public.is_super_admin());
