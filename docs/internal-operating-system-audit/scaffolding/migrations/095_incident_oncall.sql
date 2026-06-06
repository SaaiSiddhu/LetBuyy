-- DRAFT SCAFFOLDING — finalize per scaffolding/README.md before moving into database/supabase/migrations/.
-- Migration 095: Incident on-call + postmortems (see docs/internal-operating-system-audit/INCIDENT_RESPONSE_PLATFORM.md)
-- Complements the EXISTING production_incidents / production_incident_events tables.

CREATE TABLE public.oncall_schedules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rotation_name text NOT NULL,                    -- primary | secondary | payments | storefront
    employee_id uuid NOT NULL,                      -- employees.id
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    is_override boolean NOT NULL DEFAULT false,
    notes text,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT oncall_schedules_window_check CHECK (ends_at > starts_at)
);
CREATE INDEX idx_oncall_schedules_window ON public.oncall_schedules USING btree (rotation_name, starts_at, ends_at) WHERE (deleted_at IS NULL);

CREATE TABLE public.incident_postmortems (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    incident_id uuid NOT NULL,                      -- FK -> production_incidents.id
    summary text,
    root_cause text,
    impact text,
    timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
    action_items jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{title, owner, due, status}]
    status text NOT NULL DEFAULT 'draft',           -- draft | published
    authored_by uuid,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT incident_postmortems_status_check CHECK (status = ANY (ARRAY['draft','published']))
);
CREATE INDEX idx_incident_postmortems_incident ON public.incident_postmortems USING btree (incident_id) WHERE (deleted_at IS NULL);

CREATE TRIGGER update_oncall_schedules_updated_at BEFORE UPDATE ON public.oncall_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_incident_postmortems_updated_at BEFORE UPDATE ON public.incident_postmortems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.oncall_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_postmortems ENABLE ROW LEVEL SECURITY;

CREATE POLICY oncall_schedules_service_all ON public.oncall_schedules USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY incident_postmortems_service_all ON public.incident_postmortems USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
