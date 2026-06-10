-- DRAFT SCAFFOLDING — finalize per scaffolding/README.md before moving into database/supabase/migrations/.
-- Migration 092: Support Operations ticketing (see docs/internal-operating-system-audit/SUPPORT_OPERATIONS_PLATFORM.md)
-- Replaces the /v1/employees/tickets stub (currently "not configured") with real persistence.

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_ref text NOT NULL,                       -- e.g. SUP-2026-000456
    site_id uuid,                                   -- merchant context (tenant)
    requester_email text,
    requester_user_id uuid,
    subject text NOT NULL,
    channel text NOT NULL DEFAULT 'email',          -- email | in_app | chat
    topic text,                                     -- billing | technical | abuse | onboarding | other
    priority text NOT NULL DEFAULT 'normal',        -- low | normal | high | urgent
    status text NOT NULL DEFAULT 'open',            -- open | pending | solved | closed
    assigned_to uuid,                               -- employees.id
    first_response_at timestamptz,
    resolved_at timestamptz,
    csat_score integer,                             -- 1-5, set on resolution survey
    linked_ts_case_id uuid,                         -- auto-created Trust & Safety case if abuse/fraud
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT support_tickets_channel_check CHECK (channel = ANY (ARRAY['email','in_app','chat'])),
    CONSTRAINT support_tickets_priority_check CHECK (priority = ANY (ARRAY['low','normal','high','urgent'])),
    CONSTRAINT support_tickets_status_check CHECK (status = ANY (ARRAY['open','pending','solved','closed'])),
    CONSTRAINT support_tickets_csat_check CHECK (csat_score IS NULL OR (csat_score >= 1 AND csat_score <= 5))
);
CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status, priority, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_support_tickets_assignee ON public.support_tickets USING btree (assigned_to, status) WHERE (deleted_at IS NULL);
CREATE INDEX idx_support_tickets_site ON public.support_tickets USING btree (site_id, created_at DESC) WHERE (deleted_at IS NULL);

CREATE TABLE public.ticket_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid NOT NULL,
    author_type text NOT NULL,                      -- requester | agent | system
    author_id uuid,
    visibility text NOT NULL DEFAULT 'public',      -- public (customer-visible) | internal (note)
    body text NOT NULL,
    attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT ticket_messages_author_type_check CHECK (author_type = ANY (ARRAY['requester','agent','system'])),
    CONSTRAINT ticket_messages_visibility_check CHECK (visibility = ANY (ARRAY['public','internal']))
);
CREATE INDEX idx_ticket_messages_ticket ON public.ticket_messages USING btree (ticket_id, created_at) WHERE (deleted_at IS NULL);

CREATE TABLE public.ticket_macros (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    body text NOT NULL,
    topic text,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
CREATE INDEX idx_ticket_macros_active ON public.ticket_macros USING btree (is_active, topic) WHERE (deleted_at IS NULL);

CREATE TABLE public.ticket_sla_clocks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid NOT NULL,
    clock_type text NOT NULL,                       -- first_response | resolution
    due_at timestamptz NOT NULL,
    paused boolean NOT NULL DEFAULT false,          -- pause while pending-customer
    breached boolean NOT NULL DEFAULT false,
    satisfied_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ticket_sla_clocks_type_check CHECK (clock_type = ANY (ARRAY['first_response','resolution']))
);
CREATE INDEX idx_ticket_sla_clocks_due ON public.ticket_sla_clocks USING btree (due_at) WHERE (satisfied_at IS NULL AND paused = false);

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_ticket_macros_updated_at BEFORE UPDATE ON public.ticket_macros FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_ticket_sla_clocks_updated_at BEFORE UPDATE ON public.ticket_sla_clocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sla_clocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_tickets_service_all ON public.support_tickets USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY ticket_messages_service_all ON public.ticket_messages USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY ticket_macros_service_all ON public.ticket_macros USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY ticket_sla_clocks_service_all ON public.ticket_sla_clocks USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
