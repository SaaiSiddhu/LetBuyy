-- Internal OS Wave 8: Incident command, on-call schedules, and postmortems.
-- Writer: /v1/operations/oncall/* and /v1/operations/postmortems/* via services/api-gateway;
-- queue-workers own dry-run paging and postmortem reminder automation.

CREATE TABLE IF NOT EXISTS public.oncall_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_name text NOT NULL CHECK (char_length(trim(team_name)) BETWEEN 2 AND 120),
    rotation_name text NOT NULL CHECK (char_length(trim(rotation_name)) BETWEEN 2 AND 160),
    primary_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    backup_employee_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
    escalation_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
    timezone text NOT NULL DEFAULT 'Asia/Kolkata',
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz,
    active boolean NOT NULL DEFAULT true,
    paging_adapter text NOT NULL DEFAULT 'dry_run' CHECK (paging_adapter IN ('dry_run', 'pagerduty', 'opsgenie')),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'employee' CHECK (actor_type IN ('employee', 'super_admin', 'system', 'worker')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CONSTRAINT oncall_schedules_window_check CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_oncall_schedules_active_window
    ON public.oncall_schedules (active, starts_at DESC, ends_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_oncall_schedules_primary
    ON public.oncall_schedules (primary_employee_id, starts_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_oncall_schedules_team
    ON public.oncall_schedules (team_name, rotation_name, starts_at DESC)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.incident_postmortems (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id text NOT NULL REFERENCES public.production_incidents(incident_id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'accepted', 'closed')),
    owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    summary text NOT NULL DEFAULT '',
    timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
    contributing_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
    action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
    due_at timestamptz,
    completed_at timestamptz,
    reviewed_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'employee' CHECK (actor_type IN ('employee', 'super_admin', 'system', 'worker')),
    actor_id uuid,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CONSTRAINT incident_postmortems_unique_incident UNIQUE (incident_id),
    CONSTRAINT incident_postmortems_completed_check CHECK (
        (status IN ('accepted', 'closed') AND completed_at IS NOT NULL)
        OR status IN ('draft', 'review')
    )
);

CREATE INDEX IF NOT EXISTS idx_incident_postmortems_status_due
    ON public.incident_postmortems (status, due_at ASC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incident_postmortems_owner
    ON public.incident_postmortems (owner_id, created_at DESC)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_oncall_schedules_updated_at ON public.oncall_schedules;
CREATE TRIGGER update_oncall_schedules_updated_at
    BEFORE UPDATE ON public.oncall_schedules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_incident_postmortems_updated_at ON public.incident_postmortems;
CREATE TRIGGER update_incident_postmortems_updated_at
    BEFORE UPDATE ON public.incident_postmortems
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.oncall_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_postmortems ENABLE ROW LEVEL SECURITY;

CREATE POLICY oncall_schedules_service_role_all ON public.oncall_schedules
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY incident_postmortems_service_role_all ON public.incident_postmortems
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY oncall_schedules_operator_read ON public.oncall_schedules
    FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM public.employees e
            WHERE e.user_id = auth.uid()
              AND e.status = 'active'
              AND e.deleted_at IS NULL
              AND (
                  e.id = oncall_schedules.primary_employee_id
                  OR e.id = ANY(oncall_schedules.backup_employee_ids)
              )
        )
    );

CREATE POLICY incident_postmortems_operator_read ON public.incident_postmortems
    FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM public.employees e
            WHERE e.user_id = auth.uid()
              AND e.status = 'active'
              AND e.deleted_at IS NULL
              AND e.id = incident_postmortems.owner_id
        )
    );
