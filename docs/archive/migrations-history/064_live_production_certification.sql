-- ============================================================================
-- Migration 064: Live Production Certification
-- Central certification report persistence for Phase 4 true-live execution.
-- ============================================================================

CREATE TABLE IF NOT EXISTS operational_certification_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_id TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    certification_mode TEXT NOT NULL CHECK (certification_mode IN ('plan', 'execute')),
    status TEXT NOT NULL CHECK (status IN ('credential-gated', 'certified', 'failed', 'expired')),
    repository_maturity_score NUMERIC NOT NULL CHECK (repository_maturity_score >= 0 AND repository_maturity_score <= 10),
    live_maturity_score NUMERIC NOT NULL CHECK (live_maturity_score >= 0 AND live_maturity_score <= 10),
    evidence_summary JSONB NOT NULL DEFAULT '{}',
    missing_capabilities TEXT[] NOT NULL DEFAULT '{}',
    report JSONB NOT NULL DEFAULT '{}',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_operational_certification_reports_env
    ON operational_certification_reports(environment, status, generated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_operational_certification_reports_expiry
    ON operational_certification_reports(environment, expires_at)
    WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

ALTER TABLE operational_certification_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operational_certification_reports_service_all ON operational_certification_reports;
CREATE POLICY operational_certification_reports_service_all
    ON operational_certification_reports FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_operational_certification_reports_updated_at'
    ) THEN
        CREATE TRIGGER update_operational_certification_reports_updated_at
            BEFORE UPDATE ON operational_certification_reports
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION record_operational_certification_report(
    p_certification_id TEXT,
    p_environment TEXT,
    p_certification_mode TEXT,
    p_status TEXT,
    p_repository_maturity_score NUMERIC,
    p_live_maturity_score NUMERIC,
    p_evidence_summary JSONB DEFAULT '{}',
    p_missing_capabilities TEXT[] DEFAULT '{}',
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_report JSONB DEFAULT '{}',
    p_actor_id UUID DEFAULT NULL
)
RETURNS operational_certification_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    certification operational_certification_reports%ROWTYPE;
BEGIN
    INSERT INTO operational_certification_reports (
        certification_id,
        environment,
        certification_mode,
        status,
        repository_maturity_score,
        live_maturity_score,
        evidence_summary,
        missing_capabilities,
        expires_at,
        report,
        created_by,
        updated_by
    )
    VALUES (
        p_certification_id,
        p_environment,
        p_certification_mode,
        p_status,
        p_repository_maturity_score,
        p_live_maturity_score,
        COALESCE(p_evidence_summary, '{}'),
        COALESCE(p_missing_capabilities, '{}'),
        p_expires_at,
        COALESCE(p_report, '{}'),
        p_actor_id,
        p_actor_id
    )
    ON CONFLICT (certification_id) DO UPDATE
       SET status = EXCLUDED.status,
           repository_maturity_score = EXCLUDED.repository_maturity_score,
           live_maturity_score = EXCLUDED.live_maturity_score,
           evidence_summary = EXCLUDED.evidence_summary,
           missing_capabilities = EXCLUDED.missing_capabilities,
           expires_at = EXCLUDED.expires_at,
           report = EXCLUDED.report,
           generated_at = NOW(),
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
    RETURNING * INTO certification;

    RETURN certification;
END;
$$;
