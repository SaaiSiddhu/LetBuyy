-- ============================================================================
-- Migration 063: Absolute Production Operationalization
-- Final operational tables and helper functions for production health gates,
-- event-store validation, SRE budgets, security evidence, regional overrides,
-- and dashboard snapshots.
-- ============================================================================

CREATE TABLE IF NOT EXISTS production_readiness_gate_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_run_id TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'running', 'passed', 'failed', 'blocked')),
    gates JSONB NOT NULL DEFAULT '[]',
    failure_summary TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_production_readiness_gate_runs_env
    ON production_readiness_gate_runs(environment, status, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE production_readiness_gate_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_readiness_gate_runs_service_all ON production_readiness_gate_runs;
CREATE POLICY production_readiness_gate_runs_service_all
    ON production_readiness_gate_runs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS deployment_health_gate_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_id TEXT NOT NULL UNIQUE,
    promotion_id TEXT,
    runtime_root TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    gate_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'blocked')),
    observed_value JSONB NOT NULL DEFAULT '{}',
    threshold JSONB NOT NULL DEFAULT '{}',
    evidence_url TEXT,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deployment_health_gate_results_runtime
    ON deployment_health_gate_results(runtime_root, environment, evaluated_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE deployment_health_gate_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deployment_health_gate_results_service_all ON deployment_health_gate_results;
CREATE POLICY deployment_health_gate_results_service_all
    ON deployment_health_gate_results FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS event_store_integrity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_id TEXT NOT NULL UNIQUE,
    stream_name TEXT,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'warning')),
    checked_events INTEGER NOT NULL DEFAULT 0,
    min_stream_position BIGINT,
    max_stream_position BIGINT,
    gap_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    retention_class TEXT,
    result JSONB NOT NULL DEFAULT '{}',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_event_store_integrity_checks_stream
    ON event_store_integrity_checks(environment, stream_name, checked_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE event_store_integrity_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_store_integrity_checks_service_all ON event_store_integrity_checks;
CREATE POLICY event_store_integrity_checks_service_all
    ON event_store_integrity_checks FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_event_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id TEXT NOT NULL UNIQUE,
    retention_class TEXT NOT NULL CHECK (retention_class IN ('hot', 'warm', 'archive', 'legal-hold')),
    minimum_age_days INTEGER NOT NULL CHECK (minimum_age_days >= 0),
    archive_target TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE runtime_event_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_event_retention_policies_service_all ON runtime_event_retention_policies;
CREATE POLICY runtime_event_retention_policies_service_all
    ON runtime_event_retention_policies FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS operational_dashboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id TEXT NOT NULL UNIQUE,
    dashboard_name TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unavailable')),
    source_api TEXT NOT NULL,
    source_projection TEXT NOT NULL,
    panels JSONB NOT NULL DEFAULT '[]',
    sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_operational_dashboard_snapshots_name
    ON operational_dashboard_snapshots(environment, dashboard_name, sampled_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE operational_dashboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operational_dashboard_snapshots_service_all ON operational_dashboard_snapshots;
CREATE POLICY operational_dashboard_snapshots_service_all
    ON operational_dashboard_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS sre_error_budget_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id TEXT NOT NULL UNIQUE,
    runtime_name TEXT NOT NULL,
    slo_id TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    window TEXT NOT NULL,
    target_percent NUMERIC(6,3) NOT NULL,
    observed_percent NUMERIC(8,5) NOT NULL,
    remaining_budget_percent NUMERIC(8,5) NOT NULL,
    burn_rate NUMERIC(10,5) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'watch', 'freeze', 'exhausted')),
    sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sre_error_budget_snapshots_runtime
    ON sre_error_budget_snapshots(environment, runtime_name, sampled_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE sre_error_budget_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sre_error_budget_snapshots_service_all ON sre_error_budget_snapshots;
CREATE POLICY sre_error_budget_snapshots_service_all
    ON sre_error_budget_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS security_enforcement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enforcement_id TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    control_name TEXT NOT NULL,
    runtime_root TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'waived', 'remediated')),
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    evidence JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_security_enforcement_events_status
    ON security_enforcement_events(environment, status, severity, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE security_enforcement_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_enforcement_events_service_all ON security_enforcement_events;
CREATE POLICY security_enforcement_events_service_all
    ON security_enforcement_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS regional_routing_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    override_id TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    tenant_site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    runtime_root TEXT NOT NULL,
    source_region TEXT NOT NULL,
    target_region TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'restored', 'cancelled')),
    expires_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    restored_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_regional_routing_overrides_runtime
    ON regional_routing_overrides(environment, runtime_root, status, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE regional_routing_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regional_routing_overrides_service_all ON regional_routing_overrides;
CREATE POLICY regional_routing_overrides_service_all
    ON regional_routing_overrides FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_distributed_event_store_retention_archive
    ON distributed_event_store(retention_class, occurred_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_distributed_queue_messages_status_available
    ON distributed_queue_messages(queue_name, status, available_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_runtime_telemetry_metrics_created
    ON runtime_telemetry_metrics(metric_name, created_at DESC)
    WHERE deleted_at IS NULL;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'production_readiness_gate_runs',
        'deployment_health_gate_results',
        'event_store_integrity_checks',
        'runtime_event_retention_policies',
        'operational_dashboard_snapshots',
        'sre_error_budget_snapshots',
        'security_enforcement_events',
        'regional_routing_overrides'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'update_' || table_name || '_updated_at'
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
                'update_' || table_name || '_updated_at',
                table_name
            );
        END IF;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION record_production_readiness_gate_run(
    p_gate_run_id TEXT,
    p_environment TEXT,
    p_version TEXT,
    p_status TEXT,
    p_gates JSONB DEFAULT '[]',
    p_failure_summary TEXT DEFAULT NULL
)
RETURNS production_readiness_gate_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    run production_readiness_gate_runs%ROWTYPE;
BEGIN
    INSERT INTO production_readiness_gate_runs (
        gate_run_id, environment, version, status, gates, failure_summary, finished_at
    )
    VALUES (
        p_gate_run_id, p_environment, p_version, p_status, COALESCE(p_gates, '[]'), p_failure_summary,
        CASE WHEN p_status IN ('passed', 'failed', 'blocked') THEN NOW() ELSE NULL END
    )
    ON CONFLICT (gate_run_id) DO UPDATE
       SET status = EXCLUDED.status,
           gates = EXCLUDED.gates,
           failure_summary = EXCLUDED.failure_summary,
           finished_at = EXCLUDED.finished_at,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;

CREATE OR REPLACE FUNCTION record_deployment_health_gate_result(
    p_gate_id TEXT,
    p_promotion_id TEXT,
    p_runtime_root TEXT,
    p_environment TEXT,
    p_gate_name TEXT,
    p_status TEXT,
    p_observed_value JSONB DEFAULT '{}',
    p_threshold JSONB DEFAULT '{}',
    p_evidence_url TEXT DEFAULT NULL
)
RETURNS deployment_health_gate_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    gate deployment_health_gate_results%ROWTYPE;
BEGIN
    INSERT INTO deployment_health_gate_results (
        gate_id, promotion_id, runtime_root, environment, gate_name, status,
        observed_value, threshold, evidence_url
    )
    VALUES (
        p_gate_id, p_promotion_id, p_runtime_root, p_environment, p_gate_name, p_status,
        COALESCE(p_observed_value, '{}'), COALESCE(p_threshold, '{}'), p_evidence_url
    )
    ON CONFLICT (gate_id) DO UPDATE
       SET status = EXCLUDED.status,
           observed_value = EXCLUDED.observed_value,
           threshold = EXCLUDED.threshold,
           evidence_url = EXCLUDED.evidence_url,
           updated_at = NOW()
    RETURNING * INTO gate;

    RETURN gate;
END;
$$;

CREATE OR REPLACE FUNCTION validate_event_stream_consistency(
    p_stream_name TEXT,
    p_environment TEXT DEFAULT 'production',
    p_limit INTEGER DEFAULT 10000
)
RETURNS event_store_integrity_checks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    checked_count INTEGER;
    min_position BIGINT;
    max_position BIGINT;
    gap_count INTEGER;
    duplicate_count INTEGER;
    check_status TEXT;
    check_row event_store_integrity_checks%ROWTYPE;
BEGIN
    SELECT COUNT(*)::INTEGER, MIN(stream_position), MAX(stream_position)
      INTO checked_count, min_position, max_position
      FROM (
          SELECT stream_position
            FROM distributed_event_store
           WHERE stream_name = p_stream_name
             AND deleted_at IS NULL
           ORDER BY stream_position DESC
           LIMIT p_limit
      ) recent;

    SELECT COUNT(*)::INTEGER
      INTO duplicate_count
      FROM (
          SELECT stream_position
            FROM distributed_event_store
           WHERE stream_name = p_stream_name
             AND deleted_at IS NULL
           GROUP BY stream_position
          HAVING COUNT(*) > 1
      ) duplicates;

    gap_count := CASE
        WHEN checked_count = 0 OR min_position IS NULL OR max_position IS NULL THEN 0
        ELSE GREATEST((max_position - min_position + 1 - checked_count)::INTEGER, 0)
    END;

    check_status := CASE WHEN gap_count = 0 AND duplicate_count = 0 THEN 'passed' ELSE 'failed' END;

    INSERT INTO event_store_integrity_checks (
        check_id,
        stream_name,
        environment,
        status,
        checked_events,
        min_stream_position,
        max_stream_position,
        gap_count,
        duplicate_count,
        result
    )
    VALUES (
        'event-store-' || p_stream_name || '-' || extract(epoch from now())::BIGINT,
        p_stream_name,
        p_environment,
        check_status,
        checked_count,
        min_position,
        max_position,
        gap_count,
        duplicate_count,
        jsonb_build_object('limit', p_limit)
    )
    RETURNING * INTO check_row;

    RETURN check_row;
END;
$$;

CREATE OR REPLACE FUNCTION archive_distributed_events(
    p_before TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 10000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    WITH candidates AS (
        SELECT id
          FROM distributed_event_store
         WHERE retention_class IN ('hot', 'warm')
           AND replayable = TRUE
           AND occurred_at < p_before
           AND deleted_at IS NULL
         ORDER BY occurred_at ASC
         LIMIT p_limit
    )
    UPDATE distributed_event_store AS event
       SET retention_class = 'archive',
           updated_at = NOW()
      FROM candidates
     WHERE event.id = candidates.id;

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$;

CREATE OR REPLACE FUNCTION record_operational_dashboard_snapshot(
    p_snapshot_id TEXT,
    p_dashboard_name TEXT,
    p_environment TEXT,
    p_status TEXT,
    p_source_api TEXT,
    p_source_projection TEXT,
    p_panels JSONB DEFAULT '[]'
)
RETURNS operational_dashboard_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    snapshot operational_dashboard_snapshots%ROWTYPE;
BEGIN
    INSERT INTO operational_dashboard_snapshots (
        snapshot_id, dashboard_name, environment, status, source_api, source_projection, panels
    )
    VALUES (
        p_snapshot_id, p_dashboard_name, p_environment, p_status, p_source_api, p_source_projection, COALESCE(p_panels, '[]')
    )
    ON CONFLICT (snapshot_id) DO UPDATE
       SET status = EXCLUDED.status,
           panels = EXCLUDED.panels,
           sampled_at = NOW(),
           updated_at = NOW()
    RETURNING * INTO snapshot;

    RETURN snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION record_sre_error_budget_snapshot(
    p_budget_id TEXT,
    p_runtime_name TEXT,
    p_slo_id TEXT,
    p_environment TEXT,
    p_window TEXT,
    p_target_percent NUMERIC,
    p_observed_percent NUMERIC,
    p_remaining_budget_percent NUMERIC,
    p_burn_rate NUMERIC,
    p_status TEXT
)
RETURNS sre_error_budget_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    snapshot sre_error_budget_snapshots%ROWTYPE;
BEGIN
    INSERT INTO sre_error_budget_snapshots (
        budget_id, runtime_name, slo_id, environment, window, target_percent,
        observed_percent, remaining_budget_percent, burn_rate, status
    )
    VALUES (
        p_budget_id, p_runtime_name, p_slo_id, p_environment, p_window, p_target_percent,
        p_observed_percent, p_remaining_budget_percent, p_burn_rate, p_status
    )
    ON CONFLICT (budget_id) DO UPDATE
       SET observed_percent = EXCLUDED.observed_percent,
           remaining_budget_percent = EXCLUDED.remaining_budget_percent,
           burn_rate = EXCLUDED.burn_rate,
           status = EXCLUDED.status,
           sampled_at = NOW(),
           updated_at = NOW()
    RETURNING * INTO snapshot;

    RETURN snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION record_security_enforcement_event(
    p_enforcement_id TEXT,
    p_environment TEXT,
    p_control_name TEXT,
    p_runtime_root TEXT,
    p_status TEXT,
    p_severity TEXT,
    p_evidence JSONB DEFAULT '{}'
)
RETURNS security_enforcement_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event security_enforcement_events%ROWTYPE;
BEGIN
    INSERT INTO security_enforcement_events (
        enforcement_id, environment, control_name, runtime_root, status, severity, evidence
    )
    VALUES (
        p_enforcement_id, p_environment, p_control_name, p_runtime_root, p_status, p_severity, COALESCE(p_evidence, '{}')
    )
    ON CONFLICT (enforcement_id) DO UPDATE
       SET status = EXCLUDED.status,
           severity = EXCLUDED.severity,
           evidence = EXCLUDED.evidence,
           recorded_at = NOW(),
           updated_at = NOW()
    RETURNING * INTO event;

    RETURN event;
END;
$$;

CREATE OR REPLACE FUNCTION record_regional_routing_override(
    p_override_id TEXT,
    p_environment TEXT,
    p_tenant_site_id UUID,
    p_runtime_root TEXT,
    p_source_region TEXT,
    p_target_region TEXT,
    p_reason TEXT,
    p_status TEXT,
    p_expires_at TIMESTAMPTZ DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS regional_routing_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    override_row regional_routing_overrides%ROWTYPE;
BEGIN
    INSERT INTO regional_routing_overrides (
        override_id, environment, tenant_site_id, runtime_root, source_region, target_region,
        reason, status, expires_at, activated_at, restored_at, metadata
    )
    VALUES (
        p_override_id, p_environment, p_tenant_site_id, p_runtime_root, p_source_region, p_target_region,
        p_reason, p_status, p_expires_at,
        CASE WHEN p_status = 'active' THEN NOW() ELSE NULL END,
        CASE WHEN p_status = 'restored' THEN NOW() ELSE NULL END,
        COALESCE(p_metadata, '{}')
    )
    ON CONFLICT (override_id) DO UPDATE
       SET status = EXCLUDED.status,
           expires_at = EXCLUDED.expires_at,
           activated_at = COALESCE(regional_routing_overrides.activated_at, EXCLUDED.activated_at),
           restored_at = EXCLUDED.restored_at,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
    RETURNING * INTO override_row;

    RETURN override_row;
END;
$$;
