-- DRAFT SCAFFOLDING — finalize per scaffolding/README.md before moving into database/supabase/migrations/.
-- Migration 091: Trust & Safety case lifecycle (see docs/internal-operating-system-audit/TRUST_AND_SAFETY_PLATFORM.md)
-- NOTE: enforcement/decision records are RETENTION-EXEMPT — soft-delete only, never hard-purged.

-- ts_cases: the case is the system of record for a human safety decision.
CREATE TABLE public.ts_cases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    case_ref text NOT NULL,                        -- human-friendly id e.g. TS-2026-000123
    subject_type text NOT NULL,                    -- merchant | store | app | theme | developer | customer
    subject_id uuid NOT NULL,
    site_id uuid,
    category text NOT NULL,                        -- fraud | phishing | counterfeit | illegal | copyright | trademark | abuse | scam | other
    severity text NOT NULL DEFAULT 'medium',       -- critical | high | medium | low
    status text NOT NULL DEFAULT 'open',           -- open | in_review | enforced | appealed | reinstated | closed
    source text NOT NULL DEFAULT 'report',         -- risk_auto | report | proactive | legal
    risk_score_id uuid,                            -- link to risk_scores when escalated from Risk
    assigned_to uuid,
    opened_by uuid,
    decided_by uuid,
    decided_at timestamptz,
    summary text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT ts_cases_subject_type_check CHECK (subject_type = ANY (ARRAY['merchant','store','app','theme','developer','customer'])),
    CONSTRAINT ts_cases_severity_check CHECK (severity = ANY (ARRAY['critical','high','medium','low'])),
    CONSTRAINT ts_cases_status_check CHECK (status = ANY (ARRAY['open','in_review','enforced','appealed','reinstated','closed'])),
    CONSTRAINT ts_cases_source_check CHECK (source = ANY (ARRAY['risk_auto','report','proactive','legal']))
);
CREATE INDEX idx_ts_cases_status ON public.ts_cases USING btree (status, severity, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_ts_cases_subject ON public.ts_cases USING btree (subject_type, subject_id) WHERE (deleted_at IS NULL);

-- ts_case_events: immutable timeline (forever-audit).
CREATE TABLE public.ts_case_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id uuid NOT NULL,
    event_type text NOT NULL,                      -- opened | evidence_added | reviewed | decision | enforced | notified | appeal_filed | reappraised | reinstated | closed
    actor_type text NOT NULL DEFAULT 'employee',
    actor_id uuid,
    reason text,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ts_case_events_case ON public.ts_case_events USING btree (case_id, created_at);

-- ts_evidence: artifacts attached to a case.
CREATE TABLE public.ts_evidence (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id uuid NOT NULL,
    kind text NOT NULL,                            -- screenshot | url | risk_signal | document | note
    reference text,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    added_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE INDEX idx_ts_evidence_case ON public.ts_evidence USING btree (case_id) WHERE (deleted_at IS NULL);

-- ts_takedowns: enforcement actions (retention-exempt).
CREATE TABLE public.ts_takedowns (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id uuid NOT NULL,
    target_type text NOT NULL,                     -- store | app | theme | developer | listing
    target_id uuid NOT NULL,
    action text NOT NULL,                          -- suspend | disable | unpublish | restrict_payouts
    status text NOT NULL DEFAULT 'active',         -- active | reversed
    enforced_by uuid NOT NULL,
    reason text NOT NULL,
    enforced_at timestamptz NOT NULL DEFAULT now(),
    reversed_by uuid,
    reversed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ts_takedowns_action_check CHECK (action = ANY (ARRAY['suspend','disable','unpublish','restrict_payouts'])),
    CONSTRAINT ts_takedowns_status_check CHECK (status = ANY (ARRAY['active','reversed']))
);
CREATE INDEX idx_ts_takedowns_case ON public.ts_takedowns USING btree (case_id);
CREATE INDEX idx_ts_takedowns_target ON public.ts_takedowns USING btree (target_type, target_id, status);

-- ts_appeals: appeal lifecycle with segregation of duty (appeal reviewer != enforcing reviewer).
CREATE TABLE public.ts_appeals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id uuid NOT NULL,
    filed_by uuid,
    filed_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'pending',        -- pending | upheld | overturned
    reviewer_id uuid,                              -- MUST differ from ts_cases.decided_by (enforce in app + check)
    decided_at timestamptz,
    decision_reason text,
    sla_due_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ts_appeals_status_check CHECK (status = ANY (ARRAY['pending','upheld','overturned']))
);
CREATE INDEX idx_ts_appeals_case ON public.ts_appeals USING btree (case_id);
CREATE INDEX idx_ts_appeals_status ON public.ts_appeals USING btree (status, sla_due_at);

CREATE TRIGGER update_ts_cases_updated_at BEFORE UPDATE ON public.ts_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_ts_takedowns_updated_at BEFORE UPDATE ON public.ts_takedowns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_ts_appeals_updated_at BEFORE UPDATE ON public.ts_appeals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ts_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_takedowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ts_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY ts_cases_service_all ON public.ts_cases USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY ts_case_events_service_all ON public.ts_case_events USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY ts_evidence_service_all ON public.ts_evidence USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY ts_takedowns_service_all ON public.ts_takedowns USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY ts_appeals_service_all ON public.ts_appeals USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ts_cases_super_admin_read ON public.ts_cases FOR SELECT USING (public.is_super_admin());
