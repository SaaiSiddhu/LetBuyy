-- Internal OS Wave 3: Trust & Safety case management.
-- Writer: /v1/operations/trust-safety/* via services/api-gateway.
-- Enforcement records are retention-exempt: soft-delete only; do not hard purge.

CREATE TABLE IF NOT EXISTS public.ts_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_key text NOT NULL,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    title text NOT NULL,
    summary text NOT NULL DEFAULT '',
    category text NOT NULL DEFAULT 'other',
    appeal_window_business_days integer NOT NULL DEFAULT 7 CHECK (appeal_window_business_days BETWEEN 0 AND 90),
    severe_violation_ineligible boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    effective_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    UNIQUE (policy_key, version)
);

CREATE TABLE IF NOT EXISTS public.ts_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    subject_type text NOT NULL CHECK (subject_type IN ('site', 'merchant', 'app', 'theme', 'developer', 'payment', 'order', 'custom')),
    subject_id text NOT NULL,
    category text NOT NULL CHECK (category IN ('fraud', 'illegal_goods', 'counterfeit', 'phishing', 'abuse_report', 'copyright', 'trademark', 'payments', 'platform_integrity', 'other')),
    severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'actioned', 'appealed', 'reinstated', 'closed', 'finalized')),
    title text NOT NULL,
    summary text NOT NULL DEFAULT '',
    assignee_id uuid,
    policy_id uuid REFERENCES public.ts_policies(id) ON DELETE SET NULL,
    opened_by uuid,
    decided_by uuid,
    enforced_by uuid,
    decision text CHECK (decision IS NULL OR decision IN ('no_violation', 'violation', 'needs_more_info')),
    decision_reason text,
    enforcement_action text CHECK (enforcement_action IS NULL OR enforcement_action IN ('none', 'suspend_site', 'takedown_theme', 'disable_app', 'freeze_payouts', 'platform_disable')),
    appeal_due_at timestamptz,
    closed_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.ts_case_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES public.ts_cases(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN ('case_opened', 'risk_handoff', 'evidence_attached', 'decision_recorded', 'enforcement_applied', 'subject_notified', 'appeal_filed', 'appeal_decided', 'reinstated', 'case_closed', 'case_finalized')),
    actor_type text NOT NULL DEFAULT 'employee' CHECK (actor_type IN ('employee', 'super_admin', 'system', 'subject')),
    actor_id uuid,
    reason text NOT NULL,
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.ts_evidence (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES public.ts_cases(id) ON DELETE CASCADE,
    evidence_type text NOT NULL DEFAULT 'manual',
    source text NOT NULL DEFAULT 'operations',
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    risk_score_id uuid REFERENCES public.risk_scores(id) ON DELETE SET NULL,
    risk_action_event_id uuid REFERENCES public.risk_action_events(id) ON DELETE SET NULL,
    uri text,
    content jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.ts_appeals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES public.ts_cases(id) ON DELETE CASCADE,
    filed_by_type text NOT NULL DEFAULT 'subject' CHECK (filed_by_type IN ('subject', 'employee', 'super_admin', 'system')),
    filed_by_id uuid,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'filed' CHECK (status IN ('filed', 'under_review', 'upheld', 'overturned', 'rejected', 'expired')),
    original_reviewer_id uuid,
    appeal_reviewer_id uuid,
    decision_reason text,
    decided_at timestamptz,
    due_at timestamptz NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.ts_takedowns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES public.ts_cases(id) ON DELETE CASCADE,
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    subject_type text NOT NULL CHECK (subject_type IN ('site', 'merchant', 'app', 'theme', 'developer', 'payment', 'order', 'custom')),
    subject_id text NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('suspend_site', 'takedown_theme', 'disable_app', 'freeze_payouts', 'platform_disable')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'reversed')),
    reason text NOT NULL,
    enforced_by uuid,
    enforced_at timestamptz NOT NULL DEFAULT now(),
    reversed_by uuid,
    reversed_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_ts_policies_active ON public.ts_policies(active, policy_key, version) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ts_cases_site_status ON public.ts_cases(site_id, status, severity, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ts_cases_subject ON public.ts_cases(subject_type, subject_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ts_cases_assignee ON public.ts_cases(assignee_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ts_case_events_case ON public.ts_case_events(case_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ts_evidence_case ON public.ts_evidence(case_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ts_appeals_case_status ON public.ts_appeals(case_id, status, due_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ts_takedowns_site_status ON public.ts_takedowns(site_id, status, action_type) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_ts_policies_updated_at ON public.ts_policies;
CREATE TRIGGER update_ts_policies_updated_at BEFORE UPDATE ON public.ts_policies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ts_cases_updated_at ON public.ts_cases;
CREATE TRIGGER update_ts_cases_updated_at BEFORE UPDATE ON public.ts_cases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ts_case_events_updated_at ON public.ts_case_events;
CREATE TRIGGER update_ts_case_events_updated_at BEFORE UPDATE ON public.ts_case_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ts_evidence_updated_at ON public.ts_evidence;
CREATE TRIGGER update_ts_evidence_updated_at BEFORE UPDATE ON public.ts_evidence
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ts_appeals_updated_at ON public.ts_appeals;
CREATE TRIGGER update_ts_appeals_updated_at BEFORE UPDATE ON public.ts_appeals
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ts_takedowns_updated_at ON public.ts_takedowns;
CREATE TRIGGER update_ts_takedowns_updated_at BEFORE UPDATE ON public.ts_takedowns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ts_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_takedowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY ts_policies_service_role_all ON public.ts_policies
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ts_cases_service_role_all ON public.ts_cases
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ts_case_events_service_role_all ON public.ts_case_events
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ts_evidence_service_role_all ON public.ts_evidence
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ts_appeals_service_role_all ON public.ts_appeals
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ts_takedowns_service_role_all ON public.ts_takedowns
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ts_cases_tenant_owner_read ON public.ts_cases
    FOR SELECT TO authenticated
    USING (
        site_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.sites s
            WHERE s.id = ts_cases.site_id
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY ts_case_events_tenant_owner_read ON public.ts_case_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.ts_cases c
            JOIN public.sites s ON s.id = c.site_id
            WHERE c.id = ts_case_events.case_id
              AND c.deleted_at IS NULL
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY ts_evidence_tenant_owner_read ON public.ts_evidence
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.ts_cases c
            JOIN public.sites s ON s.id = c.site_id
            WHERE c.id = ts_evidence.case_id
              AND c.deleted_at IS NULL
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY ts_appeals_tenant_owner_read ON public.ts_appeals
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.ts_cases c
            JOIN public.sites s ON s.id = c.site_id
            WHERE c.id = ts_appeals.case_id
              AND c.deleted_at IS NULL
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY ts_takedowns_tenant_owner_read ON public.ts_takedowns
    FOR SELECT TO authenticated
    USING (
        site_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.sites s
            WHERE s.id = ts_takedowns.site_id
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );

INSERT INTO public.ts_policies (policy_key, version, title, summary, category, appeal_window_business_days, severe_violation_ineligible, active, metadata)
VALUES
    ('fraud-marketplace-integrity', 1, 'Fraud and marketplace integrity', 'Default policy for fraud, payment abuse, and coordinated marketplace integrity violations.', 'fraud', 7, false, true, '{"source":"internal-os-wave-3","needs_legal_signoff":true}'::jsonb),
    ('illegal-goods-severe', 1, 'Illegal and severe safety violations', 'Default severe-violation policy for illegal goods, phishing, and safety-critical abuse.', 'illegal_goods', 7, true, true, '{"source":"internal-os-wave-3","needs_legal_signoff":true}'::jsonb),
    ('ip-counterfeit', 1, 'IP, counterfeit, and trademark violations', 'Default policy for counterfeit, copyright, and trademark complaints.', 'counterfeit', 7, false, true, '{"source":"internal-os-wave-3","needs_legal_signoff":true}'::jsonb)
ON CONFLICT (policy_key, version) DO NOTHING;
