-- Internal OS Wave 1: fine-grained RBAC spine.
-- Single writer: services/api-gateway /v1/operations/rbac/*.
-- These are internal operator-control records, not tenant-owned commerce data.

CREATE TABLE IF NOT EXISTS public.break_glass_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    scope text NOT NULL,
    reason text NOT NULL,
    granted_by uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT break_glass_grants_pkey PRIMARY KEY (id),
    CONSTRAINT break_glass_grants_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT,
    CONSTRAINT break_glass_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.employees(id) ON DELETE RESTRICT,
    CONSTRAINT break_glass_grants_reason_check CHECK (length(btrim(reason)) >= 8),
    CONSTRAINT break_glass_grants_scope_check CHECK (length(btrim(scope)) >= 3),
    CONSTRAINT break_glass_grants_expiry_check CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS public.access_review_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reviewer_id uuid NOT NULL,
    period text NOT NULL,
    decisions jsonb DEFAULT '{}'::jsonb NOT NULL,
    completed_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT access_review_records_pkey PRIMARY KEY (id),
    CONSTRAINT access_review_records_reviewer_fkey FOREIGN KEY (reviewer_id) REFERENCES public.employees(id) ON DELETE RESTRICT,
    CONSTRAINT access_review_records_period_check CHECK (period ~ '^[0-9]{4}-(Q[1-4]|0[1-9]|1[0-2])$')
);

CREATE INDEX IF NOT EXISTS idx_break_glass_grants_employee_active
    ON public.break_glass_grants USING btree (employee_id, expires_at DESC)
    WHERE (deleted_at IS NULL AND revoked_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_break_glass_grants_scope_active
    ON public.break_glass_grants USING btree (scope, expires_at DESC)
    WHERE (deleted_at IS NULL AND revoked_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_access_review_records_reviewer_period
    ON public.access_review_records USING btree (reviewer_id, period DESC)
    WHERE (deleted_at IS NULL);

DROP TRIGGER IF EXISTS update_break_glass_grants_updated_at ON public.break_glass_grants;
CREATE TRIGGER update_break_glass_grants_updated_at
    BEFORE UPDATE ON public.break_glass_grants
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_access_review_records_updated_at ON public.access_review_records;
CREATE TRIGGER update_access_review_records_updated_at
    BEFORE UPDATE ON public.access_review_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.break_glass_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_review_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS break_glass_grants_service_all ON public.break_glass_grants;
CREATE POLICY break_glass_grants_service_all ON public.break_glass_grants
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS break_glass_grants_employee_read_own ON public.break_glass_grants;
CREATE POLICY break_glass_grants_employee_read_own ON public.break_glass_grants FOR SELECT
    USING ((EXISTS (
        SELECT 1 FROM public.employees
        WHERE employees.id = break_glass_grants.employee_id
          AND employees.user_id = auth.uid()
          AND employees.deleted_at IS NULL
    )));

DROP POLICY IF EXISTS access_review_records_service_all ON public.access_review_records;
CREATE POLICY access_review_records_service_all ON public.access_review_records
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS access_review_records_reviewer_read_own ON public.access_review_records;
CREATE POLICY access_review_records_reviewer_read_own ON public.access_review_records FOR SELECT
    USING ((EXISTS (
        SELECT 1 FROM public.employees
        WHERE employees.id = access_review_records.reviewer_id
          AND employees.user_id = auth.uid()
          AND employees.deleted_at IS NULL
    )));
