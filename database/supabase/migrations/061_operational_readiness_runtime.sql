-- ============================================================================
-- Migration 061: Operational Readiness Runtime
-- Deployment topology, queue/replay/workflow operations, telemetry diagnostics,
-- tenant/cache/regional/projection operations, provider recovery plans, and
-- control-plane helper functions for production operational maturity.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Deployment topology and runtime diagnostics
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS runtime_deployment_topology_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topology_version INTEGER NOT NULL,
    runtime_name TEXT NOT NULL,
    runtime_root TEXT NOT NULL,
    deployment_kind TEXT NOT NULL,
    platform TEXT NOT NULL,
    regions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    startup_order INTEGER NOT NULL DEFAULT 0,
    dependencies JSONB NOT NULL DEFAULT '[]',
    scaling JSONB NOT NULL DEFAULT '{}',
    health JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(topology_version, runtime_root)
);

CREATE INDEX IF NOT EXISTS idx_runtime_deployment_topology_startup
    ON runtime_deployment_topology_records(topology_version, startup_order, runtime_name)
    WHERE deleted_at IS NULL;

ALTER TABLE runtime_deployment_topology_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_deployment_topology_records_service_all ON runtime_deployment_topology_records;
CREATE POLICY runtime_deployment_topology_records_service_all
    ON runtime_deployment_topology_records FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diagnostic_id TEXT NOT NULL UNIQUE,
    runtime_name TEXT NOT NULL,
    category TEXT NOT NULL
        CHECK (category IN ('queue', 'replay', 'workflow', 'projection', 'telemetry', 'resilience', 'cache', 'tenant', 'regional', 'coordination', 'deployment', 'provider', 'audit')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    request_id TEXT,
    correlation_id TEXT,
    trace_id TEXT,
    resolved_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_diagnostics_runtime
    ON runtime_diagnostics(runtime_name, category, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE runtime_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_diagnostics_service_all ON runtime_diagnostics;
CREATE POLICY runtime_diagnostics_service_all
    ON runtime_diagnostics FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 2. Queue, replay, and workflow operational projections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS queue_operation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name TEXT NOT NULL,
    partition_key TEXT,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL DEFAULT 0,
    leased INTEGER NOT NULL DEFAULT 0,
    retrying INTEGER NOT NULL DEFAULT 0,
    dead_lettered INTEGER NOT NULL DEFAULT 0,
    oldest_available_at TIMESTAMPTZ,
    newest_completed_at TIMESTAMPTZ,
    sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_queue_operation_snapshots_queue
    ON queue_operation_snapshots(queue_name, sampled_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE queue_operation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS queue_operation_snapshots_service_all ON queue_operation_snapshots;
CREATE POLICY queue_operation_snapshots_service_all
    ON queue_operation_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS queue_recovery_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id TEXT NOT NULL UNIQUE,
    queue_name TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('release-expired-lease', 'retry', 'dead-letter', 'redrive', 'rebalance', 'poison-message')),
    message_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    requested_by UUID,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'failed', 'cancelled')),
    result JSONB NOT NULL DEFAULT '{}',
    request_id TEXT,
    correlation_id TEXT,
    trace_id TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE queue_recovery_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS queue_recovery_operations_service_all ON queue_recovery_operations;
CREATE POLICY queue_recovery_operations_service_all
    ON queue_recovery_operations FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS replay_operation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    replay_id TEXT NOT NULL UNIQUE,
    owner_runtime TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    event_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    cursor JSONB NOT NULL DEFAULT '{}',
    batch_size INTEGER NOT NULL DEFAULT 100,
    dry_run BOOLEAN NOT NULL DEFAULT TRUE,
    impact JSONB NOT NULL DEFAULT '{}',
    rollback_plan JSONB NOT NULL DEFAULT '{}',
    requested_by UUID,
    approved_by UUID,
    authorization_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'authorized', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    request_id TEXT,
    correlation_id TEXT,
    trace_id TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE replay_operation_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS replay_operation_schedules_service_all ON replay_operation_schedules;
CREATE POLICY replay_operation_schedules_service_all
    ON replay_operation_schedules FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS replay_dry_run_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    replay_id TEXT NOT NULL REFERENCES replay_operation_schedules(replay_id) ON DELETE CASCADE,
    scanned INTEGER NOT NULL DEFAULT 0,
    would_dispatch INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    impact JSONB NOT NULL DEFAULT '{}',
    request_id TEXT,
    correlation_id TEXT,
    trace_id TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE replay_dry_run_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS replay_dry_run_results_service_all ON replay_dry_run_results;
CREATE POLICY replay_dry_run_results_service_all
    ON replay_dry_run_results FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS workflow_operation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    running INTEGER NOT NULL DEFAULT 0,
    waiting INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    timed_out INTEGER NOT NULL DEFAULT 0,
    dead_lettered INTEGER NOT NULL DEFAULT 0,
    oldest_updated_at TIMESTAMPTZ,
    sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_operation_snapshots_name
    ON workflow_operation_snapshots(workflow_name, sampled_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE workflow_operation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_operation_snapshots_service_all ON workflow_operation_snapshots;
CREATE POLICY workflow_operation_snapshots_service_all
    ON workflow_operation_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Telemetry, alert, tenant, cache, coordination, regional, and projection ops
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS runtime_alert_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_name TEXT NOT NULL,
    runtime_name TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    firing BOOLEAN NOT NULL DEFAULT FALSE,
    observed_value NUMERIC NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    runbook TEXT,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE runtime_alert_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_alert_evaluations_service_all ON runtime_alert_evaluations;
CREATE POLICY runtime_alert_evaluations_service_all
    ON runtime_alert_evaluations FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS tenant_operation_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    queue_depth INTEGER NOT NULL DEFAULT 0,
    running_executions INTEGER NOT NULL DEFAULT 0,
    throttled_executions INTEGER NOT NULL DEFAULT 0,
    dead_lettered_executions INTEGER NOT NULL DEFAULT 0,
    p95_latency_ms INTEGER NOT NULL DEFAULT 0,
    fairness_score NUMERIC(8,4) NOT NULL DEFAULT 1,
    projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id)
);

ALTER TABLE tenant_operation_projections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_operation_projections_service_all ON tenant_operation_projections;
CREATE POLICY tenant_operation_projections_service_all
    ON tenant_operation_projections FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS cache_operation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_name TEXT NOT NULL,
    cache_key TEXT NOT NULL,
    tenant_key TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('fresh', 'stale', 'expired')),
    tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    size_bytes BIGINT,
    sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cache_operation_snapshots_key
    ON cache_operation_snapshots(cache_name, tenant_key, sampled_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE cache_operation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cache_operation_snapshots_service_all ON cache_operation_snapshots;
CREATE POLICY cache_operation_snapshots_service_all
    ON cache_operation_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS coordination_operation_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    owner_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('owned', 'expired', 'contended', 'unowned')),
    fencing_token TEXT,
    reason TEXT NOT NULL,
    diagnosed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE coordination_operation_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coordination_operation_diagnostics_service_all ON coordination_operation_diagnostics;
CREATE POLICY coordination_operation_diagnostics_service_all
    ON coordination_operation_diagnostics FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS regional_execution_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unavailable')),
    accepts_reads BOOLEAN NOT NULL DEFAULT TRUE,
    accepts_writes BOOLEAN NOT NULL DEFAULT TRUE,
    queue_lag_ms INTEGER NOT NULL DEFAULT 0,
    replication_lag_ms INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    diagnosed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE regional_execution_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regional_execution_diagnostics_service_all ON regional_execution_diagnostics;
CREATE POLICY regional_execution_diagnostics_service_all
    ON regional_execution_diagnostics FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS projection_operation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projection_name TEXT NOT NULL,
    projection_version INTEGER NOT NULL DEFAULT 1,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    object_count INTEGER NOT NULL DEFAULT 0,
    stale_count INTEGER NOT NULL DEFAULT 0,
    rebuilding_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    max_lag_ms INTEGER NOT NULL DEFAULT 0,
    sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE projection_operation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projection_operation_snapshots_service_all ON projection_operation_snapshots;
CREATE POLICY projection_operation_snapshots_service_all
    ON projection_operation_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS provider_recovery_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('hold', 'retry', 'failover', 'degrade', 'restore')),
    retry_after_seconds INTEGER,
    alternate_provider TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'running', 'completed', 'failed', 'cancelled')),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE provider_recovery_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_recovery_plans_service_all ON provider_recovery_plans;
CREATE POLICY provider_recovery_plans_service_all
    ON provider_recovery_plans FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 4. Updated-at triggers
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'runtime_deployment_topology_records',
        'runtime_diagnostics',
        'queue_operation_snapshots',
        'queue_recovery_operations',
        'replay_operation_schedules',
        'replay_dry_run_results',
        'workflow_operation_snapshots',
        'runtime_alert_evaluations',
        'tenant_operation_projections',
        'cache_operation_snapshots',
        'coordination_operation_diagnostics',
        'regional_execution_diagnostics',
        'projection_operation_snapshots',
        'provider_recovery_plans'
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

-- ---------------------------------------------------------------------------
-- 5. Queue operational helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION inspect_distributed_queue(
    p_queue_name TEXT,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    message_id TEXT,
    queue_name TEXT,
    job_type TEXT,
    status TEXT,
    attempts INTEGER,
    available_at TIMESTAMPTZ,
    leased_by TEXT,
    leased_until TIMESTAMPTZ,
    site_id UUID,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        message_id,
        queue_name,
        job_type,
        status,
        attempts,
        available_at,
        leased_by,
        leased_until,
        site_id,
        created_at
      FROM distributed_queue_messages
     WHERE queue_name = p_queue_name
       AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
$$;

CREATE OR REPLACE FUNCTION recover_stuck_distributed_queue_leases(
    p_queue_name TEXT,
    p_recovery_operation_id TEXT,
    p_reason TEXT,
    p_limit INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    recovered_count INTEGER := 0;
BEGIN
    WITH candidates AS (
        SELECT id
          FROM distributed_queue_messages
         WHERE queue_name = p_queue_name
           AND status = 'leased'
           AND leased_until <= NOW()
           AND deleted_at IS NULL
         ORDER BY leased_until ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
         FOR UPDATE SKIP LOCKED
    ),
    recovered AS (
        UPDATE distributed_queue_messages AS message
           SET status = CASE WHEN attempts >= max_attempts THEN 'dead-lettered' ELSE 'retrying' END,
               available_at = NOW(),
               leased_until = NULL,
               leased_by = NULL,
               error_message = COALESCE(error_message, p_reason),
               updated_at = NOW()
          FROM candidates
         WHERE message.id = candidates.id
        RETURNING message.message_id
    )
    SELECT COUNT(*) INTO recovered_count FROM recovered;

    INSERT INTO queue_recovery_operations (
        operation_id,
        queue_name,
        operation,
        message_ids,
        reason,
        status,
        result
    )
    VALUES (
        p_recovery_operation_id,
        p_queue_name,
        'release-expired-lease',
        ARRAY[]::TEXT[],
        p_reason,
        'completed',
        jsonb_build_object('recovered_count', recovered_count)
    )
    ON CONFLICT (operation_id) DO UPDATE
       SET status = EXCLUDED.status,
           result = EXCLUDED.result,
           updated_at = NOW();

    RETURN recovered_count;
END;
$$;

CREATE OR REPLACE FUNCTION redrive_distributed_dead_letters(
    p_queue_name TEXT,
    p_message_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_recovery_operation_id TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
    p_reason TEXT DEFAULT 'manual dead-letter redrive'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    redriven_count INTEGER := 0;
BEGIN
    WITH redriven AS (
        UPDATE distributed_queue_messages
           SET status = 'retrying',
               available_at = NOW(),
               leased_until = NULL,
               leased_by = NULL,
               error_message = NULL,
               updated_at = NOW()
         WHERE queue_name = p_queue_name
           AND status = 'dead-lettered'
           AND deleted_at IS NULL
           AND (
                COALESCE(array_length(p_message_ids, 1), 0) = 0
                OR message_id = ANY(p_message_ids)
           )
        RETURNING message_id
    )
    SELECT COUNT(*) INTO redriven_count FROM redriven;

    INSERT INTO queue_recovery_operations (
        operation_id,
        queue_name,
        operation,
        message_ids,
        reason,
        status,
        result
    )
    VALUES (
        p_recovery_operation_id,
        p_queue_name,
        'redrive',
        COALESCE(p_message_ids, ARRAY[]::TEXT[]),
        p_reason,
        'completed',
        jsonb_build_object('redriven_count', redriven_count)
    )
    ON CONFLICT (operation_id) DO UPDATE
       SET status = EXCLUDED.status,
           result = EXCLUDED.result,
           updated_at = NOW();

    RETURN redriven_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Replay, diagnostics, projection, tenant, provider, and control helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION schedule_runtime_replay_operation(
    p_replay_id TEXT,
    p_owner_runtime TEXT,
    p_site_id UUID,
    p_event_types TEXT[],
    p_cursor JSONB,
    p_batch_size INTEGER,
    p_dry_run BOOLEAN,
    p_requested_by UUID,
    p_reason TEXT,
    p_request_id TEXT,
    p_correlation_id TEXT,
    p_trace_id TEXT DEFAULT NULL
)
RETURNS runtime_replay_executions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    replay runtime_replay_executions%ROWTYPE;
BEGIN
    INSERT INTO runtime_replay_executions (
        replay_id,
        owner_runtime,
        site_id,
        event_types,
        cursor,
        status,
        dry_run,
        requested_by,
        reason
    )
    VALUES (
        p_replay_id,
        p_owner_runtime,
        p_site_id,
        COALESCE(p_event_types, ARRAY[]::TEXT[]),
        COALESCE(p_cursor, '{}'),
        'planned',
        COALESCE(p_dry_run, TRUE),
        p_requested_by,
        p_reason
    )
    ON CONFLICT (replay_id) DO UPDATE
       SET cursor = EXCLUDED.cursor,
           event_types = EXCLUDED.event_types,
           dry_run = EXCLUDED.dry_run,
           reason = EXCLUDED.reason,
           updated_at = NOW()
    RETURNING * INTO replay;

    INSERT INTO replay_operation_schedules (
        replay_id,
        owner_runtime,
        site_id,
        event_types,
        cursor,
        batch_size,
        dry_run,
        requested_by,
        status,
        request_id,
        correlation_id,
        trace_id
    )
    VALUES (
        p_replay_id,
        p_owner_runtime,
        p_site_id,
        COALESCE(p_event_types, ARRAY[]::TEXT[]),
        COALESCE(p_cursor, '{}'),
        LEAST(GREATEST(COALESCE(p_batch_size, 100), 1), 1000),
        COALESCE(p_dry_run, TRUE),
        p_requested_by,
        'planned',
        p_request_id,
        p_correlation_id,
        p_trace_id
    )
    ON CONFLICT (replay_id) DO UPDATE
       SET cursor = EXCLUDED.cursor,
           batch_size = EXCLUDED.batch_size,
           dry_run = EXCLUDED.dry_run,
           request_id = EXCLUDED.request_id,
           correlation_id = EXCLUDED.correlation_id,
           trace_id = EXCLUDED.trace_id,
           updated_at = NOW();

    RETURN replay;
END;
$$;

CREATE OR REPLACE FUNCTION authorize_runtime_replay_operation(
    p_replay_id TEXT,
    p_approved_by UUID,
    p_expires_at TIMESTAMPTZ
)
RETURNS runtime_replay_executions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    replay runtime_replay_executions%ROWTYPE;
BEGIN
    UPDATE runtime_replay_executions
       SET status = 'authorized',
           approved_by = p_approved_by,
           authorization_expires_at = p_expires_at,
           updated_at = NOW()
     WHERE replay_id = p_replay_id
       AND deleted_at IS NULL
    RETURNING * INTO replay;

    IF replay.id IS NULL THEN
        RAISE EXCEPTION 'runtime replay operation not found: %', p_replay_id;
    END IF;

    UPDATE replay_operation_schedules
       SET status = 'authorized',
           approved_by = p_approved_by,
           authorization_expires_at = p_expires_at,
           updated_at = NOW()
     WHERE replay_id = p_replay_id
       AND deleted_at IS NULL;

    RETURN replay;
END;
$$;

CREATE OR REPLACE FUNCTION record_runtime_diagnostic(
    p_diagnostic_id TEXT,
    p_runtime_name TEXT,
    p_category TEXT,
    p_severity TEXT,
    p_site_id UUID,
    p_summary TEXT,
    p_details JSONB,
    p_request_id TEXT,
    p_correlation_id TEXT,
    p_trace_id TEXT DEFAULT NULL
)
RETURNS runtime_diagnostics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    diagnostic runtime_diagnostics%ROWTYPE;
BEGIN
    INSERT INTO runtime_diagnostics (
        diagnostic_id,
        runtime_name,
        category,
        severity,
        site_id,
        summary,
        details,
        request_id,
        correlation_id,
        trace_id
    )
    VALUES (
        p_diagnostic_id,
        p_runtime_name,
        p_category,
        p_severity,
        p_site_id,
        p_summary,
        COALESCE(p_details, '{}'),
        p_request_id,
        p_correlation_id,
        p_trace_id
    )
    ON CONFLICT (diagnostic_id) DO UPDATE
       SET status = 'open',
           summary = EXCLUDED.summary,
           details = EXCLUDED.details,
           updated_at = NOW()
    RETURNING * INTO diagnostic;

    RETURN diagnostic;
END;
$$;

CREATE OR REPLACE FUNCTION record_projection_operation_snapshot(
    p_projection_name TEXT,
    p_projection_version INTEGER,
    p_site_id UUID,
    p_object_count INTEGER,
    p_stale_count INTEGER,
    p_rebuilding_count INTEGER,
    p_failed_count INTEGER,
    p_max_lag_ms INTEGER,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS projection_operation_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    snapshot projection_operation_snapshots%ROWTYPE;
BEGIN
    INSERT INTO projection_operation_snapshots (
        projection_name,
        projection_version,
        site_id,
        object_count,
        stale_count,
        rebuilding_count,
        failed_count,
        max_lag_ms,
        metadata
    )
    VALUES (
        p_projection_name,
        COALESCE(p_projection_version, 1),
        p_site_id,
        COALESCE(p_object_count, 0),
        COALESCE(p_stale_count, 0),
        COALESCE(p_rebuilding_count, 0),
        COALESCE(p_failed_count, 0),
        COALESCE(p_max_lag_ms, 0),
        COALESCE(p_metadata, '{}')
    )
    RETURNING * INTO snapshot;

    RETURN snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION record_tenant_operation_projection(
    p_site_id UUID,
    p_queue_depth INTEGER,
    p_running_executions INTEGER,
    p_throttled_executions INTEGER,
    p_dead_lettered_executions INTEGER,
    p_p95_latency_ms INTEGER,
    p_fairness_score NUMERIC,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS tenant_operation_projections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    projection tenant_operation_projections%ROWTYPE;
BEGIN
    INSERT INTO tenant_operation_projections (
        site_id,
        queue_depth,
        running_executions,
        throttled_executions,
        dead_lettered_executions,
        p95_latency_ms,
        fairness_score,
        projected_at,
        metadata
    )
    VALUES (
        p_site_id,
        COALESCE(p_queue_depth, 0),
        COALESCE(p_running_executions, 0),
        COALESCE(p_throttled_executions, 0),
        COALESCE(p_dead_lettered_executions, 0),
        COALESCE(p_p95_latency_ms, 0),
        COALESCE(p_fairness_score, 1),
        NOW(),
        COALESCE(p_metadata, '{}')
    )
    ON CONFLICT (site_id) DO UPDATE
       SET queue_depth = EXCLUDED.queue_depth,
           running_executions = EXCLUDED.running_executions,
           throttled_executions = EXCLUDED.throttled_executions,
           dead_lettered_executions = EXCLUDED.dead_lettered_executions,
           p95_latency_ms = EXCLUDED.p95_latency_ms,
           fairness_score = EXCLUDED.fairness_score,
           projected_at = EXCLUDED.projected_at,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
    RETURNING * INTO projection;

    RETURN projection;
END;
$$;

CREATE OR REPLACE FUNCTION record_provider_recovery_plan(
    p_provider TEXT,
    p_operation TEXT,
    p_action TEXT,
    p_retry_after_seconds INTEGER,
    p_alternate_provider TEXT,
    p_reason TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS provider_recovery_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    recovery_plan provider_recovery_plans%ROWTYPE;
BEGIN
    INSERT INTO provider_recovery_plans (
        provider,
        operation,
        action,
        retry_after_seconds,
        alternate_provider,
        reason,
        metadata
    )
    VALUES (
        p_provider,
        p_operation,
        p_action,
        p_retry_after_seconds,
        p_alternate_provider,
        p_reason,
        COALESCE(p_metadata, '{}')
    )
    RETURNING * INTO recovery_plan;

    RETURN recovery_plan;
END;
$$;

CREATE OR REPLACE FUNCTION claim_operational_control_command(
    p_owner_id TEXT,
    p_limit INTEGER DEFAULT 25
)
RETURNS SETOF runtime_control_commands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT id
          FROM runtime_control_commands
         WHERE status = 'accepted'
           AND deleted_at IS NULL
         ORDER BY created_at ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
         FOR UPDATE SKIP LOCKED
    )
    UPDATE runtime_control_commands AS command
       SET status = 'running',
           result = jsonb_build_object('owner_id', p_owner_id, 'claimed_at', NOW()),
           updated_at = NOW()
      FROM candidates
     WHERE command.id = candidates.id
    RETURNING command.*;
END;
$$;
