-- Internal OS Wave 10: Compliance data-subject workflow and audit export cursors.
-- Writer: /v1/internal/console/compliance/* and app-store compliance webhooks via services/api-gateway.
-- Audit export cursor advances may also be written by services/queue-workers dry-run automation.

CREATE TABLE IF NOT EXISTS public.data_subject_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
    request_type text NOT NULL CHECK (request_type IN ('access', 'erasure')),
    subject_type text NOT NULL DEFAULT 'customer' CHECK (subject_type IN ('customer', 'shop', 'merchant', 'developer', 'employee', 'other')),
    subject_id text,
    subject_email text,
    subject_display text,
    source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'customers/data_request', 'customers/redact', 'shop/redact', 'support', 'trust_safety', 'system')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'verifying', 'in_progress', 'fulfilled', 'rejected', 'cancelled', 'expired')),
    due_at timestamptz NOT NULL,
    verified_at timestamptz,
    fulfilled_at timestamptz,
    rejected_at timestamptz,
    assignee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    idempotency_key text,
    reason text NOT NULL CHECK (char_length(trim(reason)) >= 8),
    request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    fulfillment_summary text,
    retention_policy_version text NOT NULL DEFAULT 'internal_compliance_v1',
    retention_exempt_tables text[] NOT NULL DEFAULT ARRAY['ts_cases', 'ts_case_events', 'ts_evidence', 'ts_appeals', 'ts_takedowns'],
    purgeable_tables text[] NOT NULL DEFAULT ARRAY['store_customers', 'customer_addresses', 'customer_credentials', 'customer_wishlist', 'orders', 'users_custom', 'sites', 'subscriptions', 'support_tickets', 'ticket_messages'],
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'super_admin' CHECK (actor_type IN ('employee', 'super_admin', 'system', 'webhook', 'worker')),
    actor_id uuid,
    actor_email text,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CHECK (subject_id IS NOT NULL OR subject_email IS NOT NULL OR subject_type = 'shop')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_subject_requests_idempotency_active
    ON public.data_subject_requests (source, idempotency_key)
    WHERE deleted_at IS NULL AND idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_status_due
    ON public.data_subject_requests (status, due_at ASC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_site_due
    ON public.data_subject_requests (site_id, due_at DESC)
    WHERE deleted_at IS NULL AND site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_subject_email
    ON public.data_subject_requests (lower(subject_email))
    WHERE deleted_at IS NULL AND subject_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_assignee
    ON public.data_subject_requests (assignee_id, status, due_at ASC)
    WHERE deleted_at IS NULL AND assignee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.audit_export_cursors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cursor_key text NOT NULL UNIQUE,
    sink_type text NOT NULL DEFAULT 'local_dry_run' CHECK (sink_type IN ('local_dry_run', 'siem', 'worm')),
    sink_name text NOT NULL DEFAULT 'local-dry-run',
    dry_run boolean NOT NULL DEFAULT true,
    status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'failed')),
    last_audit_log_id uuid,
    last_audit_created_at timestamptz,
    last_exported_at timestamptz,
    rows_exported bigint NOT NULL DEFAULT 0 CHECK (rows_exported >= 0),
    checksum text,
    failure_reason text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    actor_type text NOT NULL DEFAULT 'worker' CHECK (actor_type IN ('employee', 'super_admin', 'system', 'worker')),
    actor_id uuid,
    actor_email text,
    request_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

CREATE INDEX IF NOT EXISTS idx_audit_export_cursors_sink_status
    ON public.audit_export_cursors (sink_type, status, updated_at DESC)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_data_subject_requests_updated_at ON public.data_subject_requests;
CREATE TRIGGER update_data_subject_requests_updated_at
    BEFORE UPDATE ON public.data_subject_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_audit_export_cursors_updated_at ON public.audit_export_cursors;
CREATE TRIGGER update_audit_export_cursors_updated_at
    BEFORE UPDATE ON public.audit_export_cursors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.data_subject_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_export_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY data_subject_requests_service_role_all ON public.data_subject_requests
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY audit_export_cursors_service_role_all ON public.audit_export_cursors
    FOR ALL TO service_role
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY data_subject_requests_site_owner_read ON public.data_subject_requests
    FOR SELECT TO authenticated
    USING (
        site_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.sites s
            WHERE s.id = data_subject_requests.site_id
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );

CREATE POLICY data_subject_requests_operator_read ON public.data_subject_requests
    FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM public.employees e
            WHERE e.user_id = auth.uid()
              AND e.status = 'active'
              AND e.deleted_at IS NULL
              AND (data_subject_requests.assignee_id IS NULL OR data_subject_requests.assignee_id = e.id)
        )
    );

CREATE POLICY audit_export_cursors_operator_read ON public.audit_export_cursors
    FOR SELECT TO authenticated
    USING (
        public.is_super_admin()
        OR EXISTS (
            SELECT 1
            FROM public.employees e
            WHERE e.user_id = auth.uid()
              AND e.status = 'active'
              AND e.deleted_at IS NULL
        )
    );
