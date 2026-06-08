-- Wave 4 Internal OS Merchant 360: read-only, time-boxed operator impersonation sessions.
-- Writer: /v1/internal/console/merchants/* in services/api-gateway.
-- Tenant identity remains sites.id; do not create a stores table.

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    operator_id uuid NOT NULL,
    operator_email text,
    reason text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    read_only boolean NOT NULL DEFAULT true,
    expires_at timestamptz NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    end_reason text,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT impersonation_sessions_read_only_check CHECK (read_only IS TRUE),
    CONSTRAINT impersonation_sessions_reason_check CHECK (char_length(reason) BETWEEN 8 AND 1000),
    CONSTRAINT impersonation_sessions_expiry_check CHECK (expires_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_site
    ON public.impersonation_sessions(site_id, started_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_operator
    ON public.impersonation_sessions(operator_id, started_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_active
    ON public.impersonation_sessions(site_id, expires_at)
    WHERE ended_at IS NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_impersonation_sessions_updated_at ON public.impersonation_sessions;
CREATE TRIGGER update_impersonation_sessions_updated_at BEFORE UPDATE ON public.impersonation_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY impersonation_sessions_service_role_all ON public.impersonation_sessions
    FOR ALL TO service_role
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY impersonation_sessions_site_owner_read ON public.impersonation_sessions
    FOR SELECT TO authenticated
    USING (
        site_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.sites s
            WHERE s.id = impersonation_sessions.site_id
              AND s.user_id = auth.uid()
              AND s.deleted_at IS NULL
        )
    );
