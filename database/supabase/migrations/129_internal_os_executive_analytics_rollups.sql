-- Internal OS Wave 7: Executive analytics rollups.
-- Writer: services/queue-workers executive analytics rollup job.

CREATE TABLE IF NOT EXISTS public.metric_rollups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_key text NOT NULL,
    dimension jsonb NOT NULL DEFAULT '{}'::jsonb,
    period_date date NOT NULL,
    value numeric NOT NULL DEFAULT 0,
    unit text NOT NULL DEFAULT 'count',
    definition_version text NOT NULL DEFAULT 'internal_exec_v1',
    computed_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'worker', 'super_admin')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CONSTRAINT metric_rollups_unique UNIQUE (metric_key, dimension, period_date, definition_version)
);

CREATE INDEX IF NOT EXISTS idx_metric_rollups_key_date
    ON public.metric_rollups (metric_key, period_date DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_metric_rollups_definition
    ON public.metric_rollups (definition_version, computed_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.mrr_arr_rollups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date date NOT NULL,
    mrr_paise bigint NOT NULL DEFAULT 0,
    arr_paise bigint NOT NULL DEFAULT 0,
    new_mrr_paise bigint NOT NULL DEFAULT 0,
    expansion_mrr_paise bigint NOT NULL DEFAULT 0,
    contraction_mrr_paise bigint NOT NULL DEFAULT 0,
    churned_mrr_paise bigint NOT NULL DEFAULT 0,
    active_subscriptions integer NOT NULL DEFAULT 0,
    logo_churn_count integer NOT NULL DEFAULT 0,
    subscription_revenue_paise bigint NOT NULL DEFAULT 0,
    app_revenue_paise bigint NOT NULL DEFAULT 0,
    theme_revenue_paise bigint NOT NULL DEFAULT 0,
    partner_payout_liability_paise bigint NOT NULL DEFAULT 0,
    definition_version text NOT NULL DEFAULT 'internal_exec_v1',
    computed_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'worker', 'super_admin')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CONSTRAINT mrr_arr_rollups_unique UNIQUE (period_date, definition_version)
);

CREATE INDEX IF NOT EXISTS idx_mrr_arr_rollups_date
    ON public.mrr_arr_rollups (period_date DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mrr_arr_rollups_computed
    ON public.mrr_arr_rollups (computed_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.cohort_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_month date NOT NULL,
    period_index integer NOT NULL CHECK (period_index >= 0),
    metric_key text NOT NULL DEFAULT 'active_stores',
    cohort_size integer NOT NULL DEFAULT 0 CHECK (cohort_size >= 0),
    retained_count integer NOT NULL DEFAULT 0 CHECK (retained_count >= 0),
    conversion_count integer NOT NULL DEFAULT 0 CHECK (conversion_count >= 0),
    definition_version text NOT NULL DEFAULT 'internal_exec_v1',
    computed_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'worker', 'super_admin')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CONSTRAINT cohort_snapshots_unique UNIQUE (cohort_month, period_index, metric_key, definition_version)
);

CREATE INDEX IF NOT EXISTS idx_cohort_snapshots_cohort
    ON public.cohort_snapshots (cohort_month DESC, period_index)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cohort_snapshots_metric
    ON public.cohort_snapshots (metric_key, computed_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.funnel_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_date date NOT NULL,
    step_key text NOT NULL CHECK (step_key IN ('signup', 'store_created', 'store_published', 'first_order', 'paying')),
    step_index integer NOT NULL CHECK (step_index >= 0),
    count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
    conversion_rate_bps integer NOT NULL DEFAULT 0 CHECK (conversion_rate_bps >= 0 AND conversion_rate_bps <= 10000),
    definition_version text NOT NULL DEFAULT 'internal_exec_v1',
    computed_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('system', 'worker', 'super_admin')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CONSTRAINT funnel_steps_unique UNIQUE (period_date, step_key, definition_version)
);

CREATE INDEX IF NOT EXISTS idx_funnel_steps_date
    ON public.funnel_steps (period_date DESC, step_index)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_funnel_steps_key
    ON public.funnel_steps (step_key, computed_at DESC)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_metric_rollups_updated_at ON public.metric_rollups;
CREATE TRIGGER update_metric_rollups_updated_at
    BEFORE UPDATE ON public.metric_rollups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_mrr_arr_rollups_updated_at ON public.mrr_arr_rollups;
CREATE TRIGGER update_mrr_arr_rollups_updated_at
    BEFORE UPDATE ON public.mrr_arr_rollups
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_cohort_snapshots_updated_at ON public.cohort_snapshots;
CREATE TRIGGER update_cohort_snapshots_updated_at
    BEFORE UPDATE ON public.cohort_snapshots
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_funnel_steps_updated_at ON public.funnel_steps;
CREATE TRIGGER update_funnel_steps_updated_at
    BEFORE UPDATE ON public.funnel_steps
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.metric_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrr_arr_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY metric_rollups_service_role_all ON public.metric_rollups
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY mrr_arr_rollups_service_role_all ON public.mrr_arr_rollups
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY cohort_snapshots_service_role_all ON public.cohort_snapshots
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY funnel_steps_service_role_all ON public.funnel_steps
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY metric_rollups_super_admin_read ON public.metric_rollups
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

CREATE POLICY mrr_arr_rollups_super_admin_read ON public.mrr_arr_rollups
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

CREATE POLICY cohort_snapshots_super_admin_read ON public.cohort_snapshots
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

CREATE POLICY funnel_steps_super_admin_read ON public.funnel_steps
    FOR SELECT TO authenticated
    USING (public.is_super_admin());
