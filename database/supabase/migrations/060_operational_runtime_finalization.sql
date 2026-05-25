-- ============================================================================
-- Migration 060: Operational Runtime Finalization
-- Adds durable command journals, stream snapshots, projection checkpoints,
-- query snapshots, workflow lifecycle records, queue heartbeats, telemetry,
-- runtime health projections, provider outage records, and queue/lease helper
-- functions for Phase 3 finalization.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CQRS command persistence and event stream snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS runtime_command_journal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id TEXT NOT NULL UNIQUE,
    command_name TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'accepted'
        CHECK (status IN ('accepted', 'completed', 'rejected')),
    idempotency_key TEXT NOT NULL UNIQUE,
    event_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    checkpoint_id TEXT,
    request_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    completed_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_command_journal_site
    ON runtime_command_journal(site_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE runtime_command_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_command_journal_service_all ON runtime_command_journal;
CREATE POLICY runtime_command_journal_service_all
    ON runtime_command_journal FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS event_stream_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_name TEXT NOT NULL REFERENCES distributed_event_streams(stream_name) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    snapshot_version INTEGER NOT NULL DEFAULT 1,
    stream_position BIGINT NOT NULL,
    global_position BIGINT,
    state JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(stream_name, snapshot_version, stream_position)
);

CREATE INDEX IF NOT EXISTS idx_event_stream_snapshots_stream
    ON event_stream_snapshots(stream_name, stream_position DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE event_stream_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_stream_snapshots_service_all ON event_stream_snapshots;
CREATE POLICY event_stream_snapshots_service_all
    ON event_stream_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 2. Projection checkpoints and query snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS projection_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkpoint_id TEXT NOT NULL UNIQUE,
    projection_name TEXT NOT NULL,
    projection_version INTEGER NOT NULL DEFAULT 1,
    owner_runtime TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    cursor JSONB NOT NULL DEFAULT '{}',
    source_global_position BIGINT,
    source_stream_position BIGINT,
    projected_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    request_id TEXT,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projection_checkpoints_identity
    ON projection_checkpoints(projection_name, projection_version, site_id, object_type, object_id, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE projection_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projection_checkpoints_service_all ON projection_checkpoints;
CREATE POLICY projection_checkpoints_service_all
    ON projection_checkpoints FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS query_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_name TEXT NOT NULL,
    query_version INTEGER NOT NULL DEFAULT 1,
    cache_key TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    source_projection_name TEXT NOT NULL,
    source_projection_version INTEGER NOT NULL DEFAULT 1,
    consistency TEXT NOT NULL CHECK (consistency IN ('strong', 'read-your-writes', 'eventual')),
    expires_at TIMESTAMPTZ,
    request_id TEXT,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(query_name, query_version, cache_key, site_id)
);

CREATE INDEX IF NOT EXISTS idx_query_snapshots_expiry
    ON query_snapshots(expires_at)
    WHERE deleted_at IS NULL;

ALTER TABLE query_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS query_snapshots_service_all ON query_snapshots;
CREATE POLICY query_snapshots_service_all
    ON query_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Workflow lifecycle and execution heartbeats
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workflow_lifecycle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id TEXT NOT NULL UNIQUE,
    workflow_name TEXT NOT NULL,
    workflow_version TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    status TEXT NOT NULL
        CHECK (status IN ('pending', 'running', 'waiting', 'completed', 'failed', 'compensating', 'compensated', 'timed-out', 'dead-lettered')),
    current_step TEXT,
    attempt INTEGER NOT NULL DEFAULT 0,
    state JSONB NOT NULL DEFAULT '{}',
    lease_id TEXT,
    fencing_token TEXT,
    timeout_at TIMESTAMPTZ,
    recovery_decision JSONB,
    request_id TEXT,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_lifecycle_status
    ON workflow_lifecycle(status, updated_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE workflow_lifecycle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_lifecycle_service_all ON workflow_lifecycle;
CREATE POLICY workflow_lifecycle_service_all
    ON workflow_lifecycle FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS workflow_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id TEXT NOT NULL REFERENCES workflow_lifecycle(execution_id) ON DELETE CASCADE,
    workflow_name TEXT NOT NULL,
    current_step TEXT,
    owner_id TEXT NOT NULL,
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    request_id TEXT,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_heartbeats_execution
    ON workflow_heartbeats(execution_id, heartbeat_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE workflow_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workflow_heartbeats_service_all ON workflow_heartbeats;
CREATE POLICY workflow_heartbeats_service_all
    ON workflow_heartbeats FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS distributed_queue_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT NOT NULL,
    queue_name TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    fencing_token TEXT NOT NULL,
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    leased_until TIMESTAMPTZ NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_distributed_queue_heartbeats_message
    ON distributed_queue_heartbeats(queue_name, message_id, heartbeat_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE distributed_queue_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS distributed_queue_heartbeats_service_all ON distributed_queue_heartbeats;
CREATE POLICY distributed_queue_heartbeats_service_all
    ON distributed_queue_heartbeats FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 4. Telemetry, health, outage, and control-plane projections
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS runtime_telemetry_spans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    parent_span_id TEXT,
    runtime_name TEXT NOT NULL,
    span_name TEXT NOT NULL,
    span_kind TEXT NOT NULL CHECK (span_kind IN ('server', 'client', 'consumer', 'producer', 'internal')),
    status TEXT NOT NULL CHECK (status IN ('unset', 'ok', 'error')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    attributes JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(trace_id, span_id)
);

CREATE INDEX IF NOT EXISTS idx_runtime_telemetry_spans_trace
    ON runtime_telemetry_spans(trace_id, started_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE runtime_telemetry_spans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_telemetry_spans_service_all ON runtime_telemetry_spans;
CREATE POLICY runtime_telemetry_spans_service_all
    ON runtime_telemetry_spans FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_telemetry_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    runtime_name TEXT,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    dimensions JSONB NOT NULL DEFAULT '{}',
    request_id TEXT,
    correlation_id TEXT,
    trace_id TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_telemetry_metrics_name
    ON runtime_telemetry_metrics(metric_name, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE runtime_telemetry_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_telemetry_metrics_service_all ON runtime_telemetry_metrics;
CREATE POLICY runtime_telemetry_metrics_service_all
    ON runtime_telemetry_metrics FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_structured_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_level TEXT NOT NULL CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    runtime_name TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    attributes JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_structured_logs_runtime
    ON runtime_structured_logs(runtime_name, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE runtime_structured_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_structured_logs_service_all ON runtime_structured_logs;
CREATE POLICY runtime_structured_logs_service_all
    ON runtime_structured_logs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_health_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    runtime_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unavailable')),
    region TEXT,
    dependencies JSONB NOT NULL DEFAULT '[]',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(runtime_name, region)
);

ALTER TABLE runtime_health_projections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_health_projections_service_all ON runtime_health_projections;
CREATE POLICY runtime_health_projections_service_all
    ON runtime_health_projections FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS provider_outage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outage_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    region TEXT,
    status TEXT NOT NULL CHECK (status IN ('detected', 'degraded', 'failed-over', 'resolved')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provider_outage_events_provider
    ON provider_outage_events(provider, operation, started_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE provider_outage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_outage_events_service_all ON provider_outage_events;
CREATE POLICY provider_outage_events_service_all
    ON provider_outage_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_control_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id TEXT NOT NULL UNIQUE,
    operation TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    requested_by UUID,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'accepted'
        CHECK (status IN ('accepted', 'running', 'completed', 'failed', 'cancelled')),
    result JSONB NOT NULL DEFAULT '{}',
    request_id TEXT,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE runtime_control_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_control_commands_service_all ON runtime_control_commands;
CREATE POLICY runtime_control_commands_service_all
    ON runtime_control_commands FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 5. Updated-at triggers
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'runtime_command_journal',
        'event_stream_snapshots',
        'projection_checkpoints',
        'query_snapshots',
        'workflow_lifecycle',
        'workflow_heartbeats',
        'distributed_queue_heartbeats',
        'runtime_telemetry_spans',
        'runtime_telemetry_metrics',
        'runtime_structured_logs',
        'runtime_health_projections',
        'provider_outage_events',
        'runtime_control_commands'
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
-- 6. Queue execution helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_distributed_queue_messages(
    p_queue_name TEXT,
    p_worker_id TEXT,
    p_limit INTEGER DEFAULT 25,
    p_visibility_seconds INTEGER DEFAULT 120
)
RETURNS SETOF distributed_queue_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT id
          FROM distributed_queue_messages
         WHERE queue_name = p_queue_name
           AND status IN ('scheduled', 'available', 'retrying')
           AND available_at <= NOW()
           AND deleted_at IS NULL
         ORDER BY partition_index ASC, available_at ASC, created_at ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 250)
         FOR UPDATE SKIP LOCKED
    )
    UPDATE distributed_queue_messages AS message
       SET status = 'leased',
           attempts = attempts + 1,
           leased_by = p_worker_id,
           leased_until = NOW() + make_interval(secs => GREATEST(COALESCE(p_visibility_seconds, 120), 1)),
           fencing_token = encode(gen_random_bytes(16), 'hex'),
           updated_at = NOW()
      FROM candidates
     WHERE message.id = candidates.id
    RETURNING message.*;
END;
$$;

CREATE OR REPLACE FUNCTION heartbeat_distributed_queue_message(
    p_message_id TEXT,
    p_worker_id TEXT,
    p_fencing_token TEXT,
    p_visibility_seconds INTEGER DEFAULT 120
)
RETURNS distributed_queue_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_message distributed_queue_messages%ROWTYPE;
BEGIN
    UPDATE distributed_queue_messages
       SET leased_until = NOW() + make_interval(secs => GREATEST(COALESCE(p_visibility_seconds, 120), 1)),
           updated_at = NOW()
     WHERE message_id = p_message_id
       AND leased_by = p_worker_id
       AND fencing_token = p_fencing_token
       AND status = 'leased'
       AND deleted_at IS NULL
    RETURNING * INTO updated_message;

    IF updated_message.id IS NULL THEN
        RAISE EXCEPTION 'queue lease heartbeat rejected for message %', p_message_id;
    END IF;

    INSERT INTO distributed_queue_heartbeats (
        message_id,
        queue_name,
        worker_id,
        fencing_token,
        leased_until,
        metadata
    )
    VALUES (
        updated_message.message_id,
        updated_message.queue_name,
        p_worker_id,
        p_fencing_token,
        updated_message.leased_until,
        jsonb_build_object('heartbeat_source', 'queue-runtime')
    );

    RETURN updated_message;
END;
$$;

CREATE OR REPLACE FUNCTION complete_distributed_queue_message(
    p_message_id TEXT,
    p_worker_id TEXT,
    p_fencing_token TEXT,
    p_result JSONB DEFAULT '{}'
)
RETURNS distributed_queue_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_message distributed_queue_messages%ROWTYPE;
BEGIN
    UPDATE distributed_queue_messages
       SET status = 'completed',
           result = COALESCE(p_result, '{}'),
           leased_until = NULL,
           updated_at = NOW()
     WHERE message_id = p_message_id
       AND leased_by = p_worker_id
       AND fencing_token = p_fencing_token
       AND status = 'leased'
       AND deleted_at IS NULL
    RETURNING * INTO updated_message;

    IF updated_message.id IS NULL THEN
        RAISE EXCEPTION 'queue completion rejected for message %', p_message_id;
    END IF;

    RETURN updated_message;
END;
$$;

CREATE OR REPLACE FUNCTION retry_distributed_queue_message(
    p_message_id TEXT,
    p_worker_id TEXT,
    p_fencing_token TEXT,
    p_available_at TIMESTAMPTZ,
    p_error_message TEXT,
    p_result JSONB DEFAULT '{}'
)
RETURNS distributed_queue_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_message distributed_queue_messages%ROWTYPE;
BEGIN
    UPDATE distributed_queue_messages
       SET status = 'retrying',
           available_at = COALESCE(p_available_at, NOW()),
           leased_until = NULL,
           error_message = p_error_message,
           result = COALESCE(p_result, '{}'),
           updated_at = NOW()
     WHERE message_id = p_message_id
       AND leased_by = p_worker_id
       AND fencing_token = p_fencing_token
       AND status = 'leased'
       AND deleted_at IS NULL
    RETURNING * INTO updated_message;

    IF updated_message.id IS NULL THEN
        RAISE EXCEPTION 'queue retry rejected for message %', p_message_id;
    END IF;

    RETURN updated_message;
END;
$$;

CREATE OR REPLACE FUNCTION dead_letter_distributed_queue_message(
    p_message_id TEXT,
    p_worker_id TEXT,
    p_fencing_token TEXT,
    p_error_message TEXT,
    p_result JSONB DEFAULT '{}'
)
RETURNS distributed_queue_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_message distributed_queue_messages%ROWTYPE;
BEGIN
    UPDATE distributed_queue_messages
       SET status = 'dead-lettered',
           leased_until = NULL,
           error_message = p_error_message,
           result = COALESCE(p_result, '{}'),
           updated_at = NOW()
     WHERE message_id = p_message_id
       AND leased_by = p_worker_id
       AND fencing_token = p_fencing_token
       AND status = 'leased'
       AND deleted_at IS NULL
    RETURNING * INTO updated_message;

    IF updated_message.id IS NULL THEN
        RAISE EXCEPTION 'queue dead-letter rejected for message %', p_message_id;
    END IF;

    RETURN updated_message;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Distributed coordination helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_runtime_lease(
    p_resource_type TEXT,
    p_resource_id TEXT,
    p_owner_id TEXT,
    p_ttl_seconds INTEGER,
    p_request_id TEXT,
    p_correlation_id TEXT,
    p_trace_id TEXT DEFAULT NULL
)
RETURNS runtime_leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claimed runtime_leases%ROWTYPE;
    token TEXT := encode(gen_random_bytes(16), 'hex');
BEGIN
    INSERT INTO runtime_leases (
        lease_id,
        resource_type,
        resource_id,
        owner_id,
        fencing_token,
        expires_at,
        request_id,
        correlation_id,
        trace_id
    )
    VALUES (
        p_resource_type || ':' || p_resource_id,
        p_resource_type,
        p_resource_id,
        p_owner_id,
        token,
        NOW() + make_interval(secs => GREATEST(COALESCE(p_ttl_seconds, 60), 1)),
        p_request_id,
        p_correlation_id,
        p_trace_id
    )
    ON CONFLICT (resource_type, resource_id) DO UPDATE
       SET owner_id = EXCLUDED.owner_id,
           fencing_token = EXCLUDED.fencing_token,
           expires_at = EXCLUDED.expires_at,
           request_id = EXCLUDED.request_id,
           correlation_id = EXCLUDED.correlation_id,
           trace_id = EXCLUDED.trace_id,
           updated_at = NOW()
     WHERE runtime_leases.expires_at <= NOW()
        OR runtime_leases.owner_id = p_owner_id
    RETURNING * INTO claimed;

    IF claimed.id IS NULL THEN
        RAISE EXCEPTION 'runtime lease unavailable for %.%', p_resource_type, p_resource_id;
    END IF;

    RETURN claimed;
END;
$$;
