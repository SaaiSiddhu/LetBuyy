-- DRAFT SCAFFOLDING — finalize per scaffolding/README.md before moving into database/supabase/migrations/.
-- Migration 093: App/Theme review automated checks + appeals
-- (see docs/internal-operating-system-audit/APP_REVIEW_PLATFORM.md + THEME_REVIEW_PLATFORM.md)
-- Builds on the EXISTING marketplace_review_records table; this adds check runs + appeals.

CREATE TABLE public.review_check_runs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    review_record_id uuid NOT NULL,                 -- FK -> marketplace_review_records.id
    submission_type text NOT NULL,                  -- app | theme (mirror of the review record)
    check_key text NOT NULL,                        -- scope_minimization | webhook_signature | oauth_pkce | redirect_allowlist | data_collection | secret_handling | rate_limit | perf_budget | wcag_aa | security_scan | engine_compat | code_quality
    severity text NOT NULL DEFAULT 'info',          -- info | soft_fail | hard_fail
    result text NOT NULL DEFAULT 'pending',         -- pending | pass | fail | error
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,       -- findings, scores (LCP/CLS), evidence
    ran_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT review_check_runs_submission_type_check CHECK (submission_type = ANY (ARRAY['app','theme'])),
    CONSTRAINT review_check_runs_severity_check CHECK (severity = ANY (ARRAY['info','soft_fail','hard_fail'])),
    CONSTRAINT review_check_runs_result_check CHECK (result = ANY (ARRAY['pending','pass','fail','error']))
);
CREATE INDEX idx_review_check_runs_record ON public.review_check_runs USING btree (review_record_id, check_key) WHERE (deleted_at IS NULL);
CREATE INDEX idx_review_check_runs_result ON public.review_check_runs USING btree (result, severity) WHERE (deleted_at IS NULL);

CREATE TABLE public.review_appeals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    review_record_id uuid NOT NULL,
    submission_type text NOT NULL,
    filed_by uuid,                                  -- partner_user_id
    filed_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'pending',         -- pending | upheld | overturned
    reviewer_id uuid,                               -- must differ from original decision reviewer
    decided_at timestamptz,
    decision_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT review_appeals_submission_type_check CHECK (submission_type = ANY (ARRAY['app','theme'])),
    CONSTRAINT review_appeals_status_check CHECK (status = ANY (ARRAY['pending','upheld','overturned']))
);
CREATE INDEX idx_review_appeals_record ON public.review_appeals USING btree (review_record_id);
CREATE INDEX idx_review_appeals_status ON public.review_appeals USING btree (status, filed_at DESC);

CREATE TRIGGER update_review_check_runs_updated_at BEFORE UPDATE ON public.review_check_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_review_appeals_updated_at BEFORE UPDATE ON public.review_appeals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.review_check_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY review_check_runs_service_all ON public.review_check_runs USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY review_appeals_service_all ON public.review_appeals USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
-- NOTE: add a partner-scoped SELECT policy on review_appeals so partners can read their own appeals (mirror marketplace_review_records_partner_read).
