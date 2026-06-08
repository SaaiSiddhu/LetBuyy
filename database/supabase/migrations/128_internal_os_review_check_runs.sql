-- Internal OS Wave 6: App and theme review automated check runs.
-- Writer: /v1/operations/marketplace-reviews/* via services/api-gateway and services/queue-workers.

CREATE TABLE IF NOT EXISTS public.review_check_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_record_id uuid NOT NULL REFERENCES public.marketplace_review_records(id) ON DELETE CASCADE,
    submission_type text NOT NULL CHECK (submission_type IN ('app', 'theme')),
    resource_id uuid NOT NULL,
    check_type text NOT NULL CHECK (check_type IN (
        'app_scope_minimization',
        'app_webhook_signature',
        'app_oauth_pkce',
        'app_redirect_uri_allowlist',
        'app_data_collection',
        'app_secret_handling',
        'app_rate_limit_posture',
        'theme_performance_budget',
        'theme_accessibility',
        'theme_security',
        'theme_compatibility',
        'theme_code_quality',
        'post_publish_abuse_monitor'
    )),
    result text NOT NULL CHECK (result IN ('passed', 'warning', 'failed')),
    title text NOT NULL,
    summary text NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    hard_fail boolean NOT NULL DEFAULT false,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('employee', 'super_admin', 'system', 'worker')),
    actor_id uuid,
    request_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_review_check_runs_review
    ON public.review_check_runs (review_record_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_review_check_runs_type_result
    ON public.review_check_runs (submission_type, check_type, result, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_review_check_runs_resource
    ON public.review_check_runs (submission_type, resource_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_check_runs_latest_unique
    ON public.review_check_runs (review_record_id, check_type, started_at)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_review_check_runs_updated_at ON public.review_check_runs;
CREATE TRIGGER update_review_check_runs_updated_at
    BEFORE UPDATE ON public.review_check_runs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.review_check_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY review_check_runs_service_role_all ON public.review_check_runs
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY review_check_runs_partner_owner_read ON public.review_check_runs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.marketplace_review_records r
            WHERE r.id = review_check_runs.review_record_id
              AND r.partner_user_id = auth.uid()
              AND r.deleted_at IS NULL
        )
    );
