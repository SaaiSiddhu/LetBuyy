-- ============================================================================
-- Migration 062: Production Rollout Operations
-- Production deployment, database operations, incident response, failover,
-- chaos, load testing, SLOs, security operations, and release governance.
-- ============================================================================

CREATE TABLE IF NOT EXISTS production_db_rollout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rollout_id TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
    primary_region TEXT NOT NULL,
    replica_regions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    pitr_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    backup_policy JSONB NOT NULL DEFAULT '{}',
    connection_pooling JSONB NOT NULL DEFAULT '{}',
    migration_policy JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'ready', 'blocked', 'applied', 'rolled-back')),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_production_db_rollout_plans_environment
    ON production_db_rollout_plans(environment, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE production_db_rollout_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_db_rollout_plans_service_all ON production_db_rollout_plans;
CREATE POLICY production_db_rollout_plans_service_all
    ON production_db_rollout_plans FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS database_operation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id TEXT NOT NULL UNIQUE,
    environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
    primary_region TEXT NOT NULL,
    replica_region TEXT,
    connection_pool_state TEXT NOT NULL CHECK (connection_pool_state IN ('healthy', 'degraded', 'unavailable')),
    replication_lag_ms INTEGER NOT NULL DEFAULT 0,
    pitr_status TEXT NOT NULL CHECK (pitr_status IN ('enabled', 'disabled', 'unknown')),
    slow_query_count INTEGER NOT NULL DEFAULT 0,
    migration_status TEXT NOT NULL CHECK (migration_status IN ('idle', 'running', 'blocked', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}',
    sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE database_operation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS database_operation_snapshots_service_all ON database_operation_snapshots;
CREATE POLICY database_operation_snapshots_service_all
    ON database_operation_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS production_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('sev1', 'sev2', 'sev3', 'sev4')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'resolved', 'closed')),
    affected_runtimes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    affected_regions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    customer_impact TEXT NOT NULL,
    commander_id UUID,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    mitigated_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    postmortem_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_production_incidents_status
    ON production_incidents(status, severity, started_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE production_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_incidents_service_all ON production_incidents;
CREATE POLICY production_incidents_service_all
    ON production_incidents FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS production_incident_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id TEXT NOT NULL REFERENCES production_incidents(incident_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'status-change', 'escalation', 'mitigation', 'recovery', 'note')),
    actor_id UUID,
    summary TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_production_incident_events_incident
    ON production_incident_events(incident_id, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE production_incident_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_incident_events_service_all ON production_incident_events;
CREATE POLICY production_incident_events_service_all
    ON production_incident_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS failover_drill_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drill_id TEXT NOT NULL UNIQUE,
    drill_type TEXT NOT NULL CHECK (drill_type IN ('regional', 'provider', 'queue', 'cache', 'telemetry', 'database')),
    source_region TEXT,
    target_region TEXT,
    affected_runtimes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'passed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    rto_seconds INTEGER,
    rpo_seconds INTEGER,
    result JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE failover_drill_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS failover_drill_runs_service_all ON failover_drill_runs;
CREATE POLICY failover_drill_runs_service_all
    ON failover_drill_runs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS chaos_experiment_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id TEXT NOT NULL UNIQUE,
    experiment_type TEXT NOT NULL CHECK (experiment_type IN ('queue-outage', 'provider-outage', 'replay-corruption', 'cache-failure', 'regional-outage', 'workflow-recovery', 'dlq-flood', 'telemetry-outage')),
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    blast_radius TEXT NOT NULL CHECK (blast_radius IN ('single-tenant', 'single-runtime', 'single-region', 'global-readonly')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'approved', 'running', 'passed', 'failed', 'aborted')),
    guardrails JSONB NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    result JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE chaos_experiment_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chaos_experiment_runs_service_all ON chaos_experiment_runs;
CREATE POLICY chaos_experiment_runs_service_all
    ON chaos_experiment_runs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS load_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT NOT NULL UNIQUE,
    test_type TEXT NOT NULL CHECK (test_type IN ('queue', 'replay', 'projection-rebuild', 'tenant-isolation', 'cache-throughput', 'checkout-concurrency', 'workflow-concurrency', 'multi-region-latency')),
    environment TEXT NOT NULL CHECK (environment IN ('staging', 'production')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'passed', 'failed', 'cancelled')),
    tool TEXT NOT NULL CHECK (tool IN ('k6', 'gatling', 'locust')),
    target_rps INTEGER,
    p95_latency_ms INTEGER,
    error_rate NUMERIC(8,6),
    report_url TEXT,
    result JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE load_test_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS load_test_runs_service_all ON load_test_runs;
CREATE POLICY load_test_runs_service_all
    ON load_test_runs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS deployment_promotion_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id TEXT NOT NULL UNIQUE,
    runtime_name TEXT NOT NULL,
    runtime_root TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
    strategy TEXT NOT NULL CHECK (strategy IN ('preview', 'canary', 'blue-green', 'rollback')),
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'blocked', 'promoted', 'rolled-back', 'failed')),
    health_gates JSONB NOT NULL DEFAULT '[]',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE deployment_promotion_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deployment_promotion_runs_service_all ON deployment_promotion_runs;
CREATE POLICY deployment_promotion_runs_service_all
    ON deployment_promotion_runs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_secret_rotation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rotation_id TEXT NOT NULL UNIQUE,
    runtime_name TEXT NOT NULL,
    secret_name TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'rotated', 'verified', 'failed', 'rolled-back')),
    rotated_by UUID,
    rotated_at TIMESTAMPTZ,
    verification JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE runtime_secret_rotation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_secret_rotation_events_service_all ON runtime_secret_rotation_events;
CREATE POLICY runtime_secret_rotation_events_service_all
    ON runtime_secret_rotation_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_slo_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slo_id TEXT NOT NULL UNIQUE,
    runtime_name TEXT NOT NULL,
    sli_name TEXT NOT NULL,
    target_percent NUMERIC(6,3) NOT NULL,
    window TEXT NOT NULL,
    error_budget_policy TEXT NOT NULL,
    alert_policy JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE runtime_slo_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_slo_definitions_service_all ON runtime_slo_definitions;
CREATE POLICY runtime_slo_definitions_service_all
    ON runtime_slo_definitions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'production_db_rollout_plans',
        'database_operation_snapshots',
        'production_incidents',
        'production_incident_events',
        'failover_drill_runs',
        'chaos_experiment_runs',
        'load_test_runs',
        'deployment_promotion_runs',
        'runtime_secret_rotation_events',
        'runtime_slo_definitions'
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

CREATE OR REPLACE FUNCTION record_production_incident(
    p_incident_id TEXT,
    p_title TEXT,
    p_severity TEXT,
    p_affected_runtimes TEXT[],
    p_affected_regions TEXT[],
    p_customer_impact TEXT,
    p_commander_id UUID,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS production_incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    incident production_incidents%ROWTYPE;
BEGIN
    INSERT INTO production_incidents (
        incident_id,
        title,
        severity,
        affected_runtimes,
        affected_regions,
        customer_impact,
        commander_id,
        metadata
    )
    VALUES (
        p_incident_id,
        p_title,
        p_severity,
        COALESCE(p_affected_runtimes, ARRAY[]::TEXT[]),
        COALESCE(p_affected_regions, ARRAY[]::TEXT[]),
        p_customer_impact,
        p_commander_id,
        COALESCE(p_metadata, '{}')
    )
    ON CONFLICT (incident_id) DO UPDATE
       SET title = EXCLUDED.title,
           severity = EXCLUDED.severity,
           affected_runtimes = EXCLUDED.affected_runtimes,
           affected_regions = EXCLUDED.affected_regions,
           customer_impact = EXCLUDED.customer_impact,
           commander_id = EXCLUDED.commander_id,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
    RETURNING * INTO incident;

    INSERT INTO production_incident_events (
        incident_id,
        event_type,
        actor_id,
        summary,
        details
    )
    VALUES (
        p_incident_id,
        'created',
        p_commander_id,
        p_title,
        COALESCE(p_metadata, '{}')
    );

    RETURN incident;
END;
$$;

CREATE OR REPLACE FUNCTION update_production_incident_status(
    p_incident_id TEXT,
    p_status TEXT,
    p_actor_id UUID,
    p_summary TEXT,
    p_details JSONB DEFAULT '{}'
)
RETURNS production_incidents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    incident production_incidents%ROWTYPE;
BEGIN
    UPDATE production_incidents
       SET status = p_status,
           mitigated_at = CASE WHEN p_status = 'mitigating' AND mitigated_at IS NULL THEN NOW() ELSE mitigated_at END,
           resolved_at = CASE WHEN p_status IN ('resolved', 'closed') AND resolved_at IS NULL THEN NOW() ELSE resolved_at END,
           updated_at = NOW()
     WHERE incident_id = p_incident_id
       AND deleted_at IS NULL
    RETURNING * INTO incident;

    IF incident.id IS NULL THEN
        RAISE EXCEPTION 'production incident not found: %', p_incident_id;
    END IF;

    INSERT INTO production_incident_events (
        incident_id,
        event_type,
        actor_id,
        summary,
        details
    )
    VALUES (
        p_incident_id,
        'status-change',
        p_actor_id,
        p_summary,
        COALESCE(p_details, '{}')
    );

    RETURN incident;
END;
$$;

CREATE OR REPLACE FUNCTION record_failover_drill_run(
    p_drill_id TEXT,
    p_drill_type TEXT,
    p_source_region TEXT,
    p_target_region TEXT,
    p_affected_runtimes TEXT[],
    p_status TEXT,
    p_rto_seconds INTEGER,
    p_rpo_seconds INTEGER,
    p_result JSONB DEFAULT '{}'
)
RETURNS failover_drill_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    run failover_drill_runs%ROWTYPE;
BEGIN
    INSERT INTO failover_drill_runs (
        drill_id,
        drill_type,
        source_region,
        target_region,
        affected_runtimes,
        status,
        started_at,
        finished_at,
        rto_seconds,
        rpo_seconds,
        result
    )
    VALUES (
        p_drill_id,
        p_drill_type,
        p_source_region,
        p_target_region,
        COALESCE(p_affected_runtimes, ARRAY[]::TEXT[]),
        p_status,
        NOW(),
        CASE WHEN p_status IN ('passed', 'failed', 'cancelled') THEN NOW() ELSE NULL END,
        p_rto_seconds,
        p_rpo_seconds,
        COALESCE(p_result, '{}')
    )
    ON CONFLICT (drill_id) DO UPDATE
       SET status = EXCLUDED.status,
           finished_at = EXCLUDED.finished_at,
           rto_seconds = EXCLUDED.rto_seconds,
           rpo_seconds = EXCLUDED.rpo_seconds,
           result = EXCLUDED.result,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;

CREATE OR REPLACE FUNCTION record_chaos_experiment_run(
    p_experiment_id TEXT,
    p_experiment_type TEXT,
    p_environment TEXT,
    p_blast_radius TEXT,
    p_status TEXT,
    p_guardrails JSONB DEFAULT '{}',
    p_result JSONB DEFAULT '{}'
)
RETURNS chaos_experiment_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    run chaos_experiment_runs%ROWTYPE;
BEGIN
    INSERT INTO chaos_experiment_runs (
        experiment_id,
        experiment_type,
        environment,
        blast_radius,
        status,
        guardrails,
        started_at,
        finished_at,
        result
    )
    VALUES (
        p_experiment_id,
        p_experiment_type,
        p_environment,
        p_blast_radius,
        p_status,
        COALESCE(p_guardrails, '{}'),
        CASE WHEN p_status = 'running' THEN NOW() ELSE NULL END,
        CASE WHEN p_status IN ('passed', 'failed', 'aborted') THEN NOW() ELSE NULL END,
        COALESCE(p_result, '{}')
    )
    ON CONFLICT (experiment_id) DO UPDATE
       SET status = EXCLUDED.status,
           guardrails = EXCLUDED.guardrails,
           finished_at = EXCLUDED.finished_at,
           result = EXCLUDED.result,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;

CREATE OR REPLACE FUNCTION record_load_test_run(
    p_run_id TEXT,
    p_test_type TEXT,
    p_environment TEXT,
    p_status TEXT,
    p_tool TEXT,
    p_target_rps INTEGER,
    p_p95_latency_ms INTEGER,
    p_error_rate NUMERIC,
    p_report_url TEXT,
    p_result JSONB DEFAULT '{}'
)
RETURNS load_test_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    run load_test_runs%ROWTYPE;
BEGIN
    INSERT INTO load_test_runs (
        run_id,
        test_type,
        environment,
        status,
        tool,
        target_rps,
        p95_latency_ms,
        error_rate,
        report_url,
        result
    )
    VALUES (
        p_run_id,
        p_test_type,
        p_environment,
        p_status,
        p_tool,
        p_target_rps,
        p_p95_latency_ms,
        p_error_rate,
        p_report_url,
        COALESCE(p_result, '{}')
    )
    ON CONFLICT (run_id) DO UPDATE
       SET status = EXCLUDED.status,
           p95_latency_ms = EXCLUDED.p95_latency_ms,
           error_rate = EXCLUDED.error_rate,
           report_url = EXCLUDED.report_url,
           result = EXCLUDED.result,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;

CREATE OR REPLACE FUNCTION record_deployment_promotion_run(
    p_promotion_id TEXT,
    p_runtime_name TEXT,
    p_runtime_root TEXT,
    p_environment TEXT,
    p_strategy TEXT,
    p_version TEXT,
    p_status TEXT,
    p_health_gates JSONB DEFAULT '[]'
)
RETURNS deployment_promotion_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    run deployment_promotion_runs%ROWTYPE;
BEGIN
    INSERT INTO deployment_promotion_runs (
        promotion_id,
        runtime_name,
        runtime_root,
        environment,
        strategy,
        version,
        status,
        health_gates,
        started_at,
        finished_at
    )
    VALUES (
        p_promotion_id,
        p_runtime_name,
        p_runtime_root,
        p_environment,
        p_strategy,
        p_version,
        p_status,
        COALESCE(p_health_gates, '[]'),
        CASE WHEN p_status = 'running' THEN NOW() ELSE NULL END,
        CASE WHEN p_status IN ('promoted', 'rolled-back', 'failed', 'blocked') THEN NOW() ELSE NULL END
    )
    ON CONFLICT (promotion_id) DO UPDATE
       SET status = EXCLUDED.status,
           health_gates = EXCLUDED.health_gates,
           finished_at = EXCLUDED.finished_at,
           updated_at = NOW()
    RETURNING * INTO run;

    RETURN run;
END;
$$;
