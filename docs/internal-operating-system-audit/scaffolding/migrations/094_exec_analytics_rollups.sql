-- DRAFT SCAFFOLDING — finalize per scaffolding/README.md before moving into database/supabase/migrations/.
-- Migration 094: Executive analytics rollups (see docs/internal-operating-system-audit/EXECUTIVE_ANALYTICS_PLATFORM.md)
-- Populated by nightly queue-workers jobs; never serve stale rollups as green.

-- metric_rollups: generic daily metric store (counts, sums) keyed by metric + dimension.
CREATE TABLE public.metric_rollups (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_key text NOT NULL,                       -- active_stores | new_signups | support_volume | risk_events | ...
    dimension jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {plan, site_type, region, cohort}
    period_date date NOT NULL,
    value numeric NOT NULL DEFAULT 0,
    computed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT metric_rollups_unique UNIQUE (metric_key, dimension, period_date)
);
CREATE INDEX idx_metric_rollups_key_date ON public.metric_rollups USING btree (metric_key, period_date DESC);

-- mrr_arr_rollups: financial truth (paise). net-new/expansion/contraction/churn decomposition.
CREATE TABLE public.mrr_arr_rollups (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    period_date date NOT NULL,
    mrr_paise bigint NOT NULL DEFAULT 0,
    arr_paise bigint NOT NULL DEFAULT 0,
    new_mrr_paise bigint NOT NULL DEFAULT 0,
    expansion_mrr_paise bigint NOT NULL DEFAULT 0,
    contraction_mrr_paise bigint NOT NULL DEFAULT 0,
    churned_mrr_paise bigint NOT NULL DEFAULT 0,
    active_subscriptions integer NOT NULL DEFAULT 0,
    logo_churn_count integer NOT NULL DEFAULT 0,
    definition_version text NOT NULL DEFAULT 'v1',  -- versioned + audited metric definitions
    computed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mrr_arr_rollups_unique UNIQUE (period_date, definition_version)
);
CREATE INDEX idx_mrr_arr_rollups_date ON public.mrr_arr_rollups USING btree (period_date DESC);

-- cohort_snapshots: retention curves by signup cohort.
CREATE TABLE public.cohort_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cohort_month date NOT NULL,                     -- signup cohort (first of month)
    period_index integer NOT NULL,                  -- months since signup (0,1,2,...)
    retained_count integer NOT NULL DEFAULT 0,
    cohort_size integer NOT NULL DEFAULT 0,
    metric_key text NOT NULL DEFAULT 'active_stores',
    computed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cohort_snapshots_unique UNIQUE (cohort_month, period_index, metric_key)
);
CREATE INDEX idx_cohort_snapshots_cohort ON public.cohort_snapshots USING btree (cohort_month, period_index);

-- funnel_steps: activation funnel counts per day (signup -> store -> publish -> first_order -> paying).
CREATE TABLE public.funnel_steps (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    period_date date NOT NULL,
    step_key text NOT NULL,                         -- signup | store_created | published | first_order | paying
    step_index integer NOT NULL,
    count integer NOT NULL DEFAULT 0,
    computed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT funnel_steps_unique UNIQUE (period_date, step_key)
);
CREATE INDEX idx_funnel_steps_date ON public.funnel_steps USING btree (period_date DESC, step_index);

ALTER TABLE public.metric_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrr_arr_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY metric_rollups_service_all ON public.metric_rollups USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY mrr_arr_rollups_service_all ON public.mrr_arr_rollups USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY cohort_snapshots_service_all ON public.cohort_snapshots USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY funnel_steps_service_all ON public.funnel_steps USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY mrr_arr_rollups_super_admin_read ON public.mrr_arr_rollups FOR SELECT USING (public.is_super_admin());
