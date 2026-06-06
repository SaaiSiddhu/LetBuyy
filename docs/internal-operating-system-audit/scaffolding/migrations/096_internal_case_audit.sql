-- DRAFT SCAFFOLDING — finalize per scaffolding/README.md before moving into database/supabase/migrations/.
-- Migration 096: Cross-domain case audit linkage (see master doc §6 + §7)
-- Ties Risk / Trust & Safety / review / support actions into one queryable, immutable audit lineage.
-- This complements (does NOT replace) the existing audit_logs / execution_audit_trail tables.

CREATE TABLE public.case_audit_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    domain text NOT NULL,                           -- risk | trust_safety | review | support | developer | incident | merchant_ops
    case_ref text,                                  -- ts_cases.case_ref / ticket_ref / review record / incident_id
    subject_type text NOT NULL,                     -- merchant | store | app | theme | developer | customer | payment
    subject_id uuid NOT NULL,
    action text NOT NULL,                           -- open | decide | enforce | reinstate | escalate | resolve ...
    actor_type text NOT NULL DEFAULT 'employee',    -- system | employee | super_admin
    actor_id uuid,
    reason text,
    old_values jsonb,
    new_values jsonb,
    request_id text,                                -- X-Request-ID correlation
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now(),  -- append-only; retention-exempt
    CONSTRAINT case_audit_events_domain_check CHECK (domain = ANY (ARRAY['risk','trust_safety','review','support','developer','incident','merchant_ops'])),
    CONSTRAINT case_audit_events_actor_type_check CHECK (actor_type = ANY (ARRAY['system','employee','super_admin']))
);
CREATE INDEX idx_case_audit_events_subject ON public.case_audit_events USING btree (subject_type, subject_id, created_at DESC);
CREATE INDEX idx_case_audit_events_domain ON public.case_audit_events USING btree (domain, created_at DESC);
CREATE INDEX idx_case_audit_events_actor ON public.case_audit_events USING btree (actor_id, created_at DESC);

ALTER TABLE public.case_audit_events ENABLE ROW LEVEL SECURITY;
-- Append-only: service_role may INSERT/SELECT; super_admin may read. No UPDATE/DELETE policy (immutable, retention-exempt).
CREATE POLICY case_audit_events_service_insert ON public.case_audit_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY case_audit_events_service_read ON public.case_audit_events FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY case_audit_events_super_admin_read ON public.case_audit_events FOR SELECT USING (public.is_super_admin());
