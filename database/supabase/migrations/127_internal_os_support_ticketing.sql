-- Internal OS Wave 5: Support ticketing, SLA, macros, escalation, and CSAT.
-- Writer: /v1/operations/support/* via services/api-gateway.

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_ref text NOT NULL UNIQUE,
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    requester_type text NOT NULL DEFAULT 'merchant' CHECK (requester_type IN ('merchant', 'customer', 'employee', 'anonymous', 'system')),
    requester_email text,
    requester_user_id uuid,
    subject text NOT NULL,
    channel text NOT NULL DEFAULT 'in_app' CHECK (channel IN ('email', 'in_app', 'chat', 'phone', 'api')),
    topic text NOT NULL DEFAULT 'general' CHECK (topic IN ('billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps', 'general')),
    priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending_customer', 'pending_internal', 'escalated', 'resolved', 'closed')),
    assignee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    escalated_to text CHECK (escalated_to IS NULL OR escalated_to IN ('risk', 'trust_safety', 'incident', 'finance', 'engineering')),
    linked_risk_score_id uuid REFERENCES public.risk_scores(id) ON DELETE SET NULL,
    linked_ts_case_id uuid REFERENCES public.ts_cases(id) ON DELETE SET NULL,
    linked_incident_id uuid REFERENCES public.production_incidents(id) ON DELETE SET NULL,
    first_response_due_at timestamptz,
    resolution_due_at timestamptz,
    first_response_at timestamptz,
    resolved_at timestamptz,
    closed_at timestamptz,
    last_customer_message_at timestamptz,
    last_agent_message_at timestamptz,
    tags text[] NOT NULL DEFAULT ARRAY[]::text[],
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.ticket_macros (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    topic text NOT NULL DEFAULT 'general' CHECK (topic IN ('billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps', 'general')),
    body text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    tags text[] NOT NULL DEFAULT ARRAY[]::text[],
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    author_type text NOT NULL CHECK (author_type IN ('requester', 'agent', 'system')),
    author_id uuid,
    author_email text,
    visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal')),
    body text NOT NULL,
    macro_id uuid REFERENCES public.ticket_macros(id) ON DELETE SET NULL,
    attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.ticket_sla_clocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    clock_type text NOT NULL CHECK (clock_type IN ('first_response', 'resolution')),
    starts_at timestamptz NOT NULL DEFAULT now(),
    due_at timestamptz NOT NULL,
    paused boolean NOT NULL DEFAULT false,
    paused_at timestamptz,
    resumed_at timestamptz,
    paused_seconds integer NOT NULL DEFAULT 0 CHECK (paused_seconds >= 0),
    breached boolean NOT NULL DEFAULT false,
    satisfied_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE TABLE IF NOT EXISTS public.ticket_csat (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    survey_token text NOT NULL UNIQUE,
    requester_email text,
    score integer CHECK (score IS NULL OR score BETWEEN 1 AND 5),
    comment text,
    sent_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status, priority, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_assignee ON public.support_tickets(assignee_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_site ON public.support_tickets(site_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla_due ON public.support_tickets(first_response_due_at, resolution_due_at) WHERE deleted_at IS NULL AND status NOT IN ('resolved', 'closed');
CREATE INDEX IF NOT EXISTS idx_ticket_macros_active ON public.ticket_macros(is_active, topic, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_sla_clocks_due ON public.ticket_sla_clocks(due_at, clock_type) WHERE deleted_at IS NULL AND satisfied_at IS NULL AND paused IS FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_sla_clocks_unique_active ON public.ticket_sla_clocks(ticket_id, clock_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_csat_ticket ON public.ticket_csat(ticket_id, created_at DESC) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ticket_macros_updated_at ON public.ticket_macros;
CREATE TRIGGER update_ticket_macros_updated_at BEFORE UPDATE ON public.ticket_macros
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ticket_messages_updated_at ON public.ticket_messages;
CREATE TRIGGER update_ticket_messages_updated_at BEFORE UPDATE ON public.ticket_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ticket_sla_clocks_updated_at ON public.ticket_sla_clocks;
CREATE TRIGGER update_ticket_sla_clocks_updated_at BEFORE UPDATE ON public.ticket_sla_clocks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_ticket_csat_updated_at ON public.ticket_csat;
CREATE TRIGGER update_ticket_csat_updated_at BEFORE UPDATE ON public.ticket_csat
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_macros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sla_clocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_csat ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_tickets_service_role_all ON public.support_tickets
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ticket_macros_service_role_all ON public.ticket_macros
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ticket_messages_service_role_all ON public.ticket_messages
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ticket_sla_clocks_service_role_all ON public.ticket_sla_clocks
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY ticket_csat_service_role_all ON public.ticket_csat
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY support_tickets_tenant_owner_read ON public.support_tickets
    FOR SELECT TO authenticated
    USING (
        site_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.sites s
            WHERE s.id = support_tickets.site_id
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY ticket_messages_tenant_owner_read ON public.ticket_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.support_tickets t
            JOIN public.sites s ON s.id = t.site_id
            WHERE t.id = ticket_messages.ticket_id
              AND t.deleted_at IS NULL
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY ticket_sla_clocks_tenant_owner_read ON public.ticket_sla_clocks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.support_tickets t
            JOIN public.sites s ON s.id = t.site_id
            WHERE t.id = ticket_sla_clocks.ticket_id
              AND t.deleted_at IS NULL
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY ticket_csat_tenant_owner_read ON public.ticket_csat
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.support_tickets t
            JOIN public.sites s ON s.id = t.site_id
            WHERE t.id = ticket_csat.ticket_id
              AND t.deleted_at IS NULL
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );
