-- ============================================================================
-- Migration 059: Distributed Runtime Operations Foundation
-- Durable execution, event persistence, queue, projection, coordination, tenant
-- scaling, provider health, cache invalidation, and audit foundations.
--
-- This does not deploy Kafka/EventStoreDB. It gives Supabase-backed runtimes a
-- canonical persistence contract until dedicated distributed infrastructure is
-- introduced behind packages/distributed-runtime and packages/projection-runtime.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Append-only distributed event store
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS distributed_event_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_name TEXT NOT NULL UNIQUE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    partition_key TEXT NOT NULL,
    last_stream_position BIGINT NOT NULL DEFAULT 0,
    last_global_position BIGINT NOT NULL DEFAULT 0,
    stream_version INTEGER NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_distributed_event_streams_site
    ON distributed_event_streams(site_id, stream_name)
    WHERE deleted_at IS NULL;

ALTER TABLE distributed_event_streams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS distributed_event_streams_owner_read ON distributed_event_streams;
CREATE POLICY distributed_event_streams_owner_read
    ON distributed_event_streams FOR SELECT
    USING (
        site_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = distributed_event_streams.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS distributed_event_streams_service_all ON distributed_event_streams;
CREATE POLICY distributed_event_streams_service_all
    ON distributed_event_streams FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS distributed_event_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE,
    stream_name TEXT NOT NULL REFERENCES distributed_event_streams(stream_name) ON DELETE RESTRICT,
    stream_position BIGINT NOT NULL,
    global_position BIGSERIAL NOT NULL UNIQUE,
    partition_key TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    aggregate_type TEXT,
    aggregate_id TEXT,
    event_type TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    source_runtime TEXT NOT NULL,
    producer TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    causation_id TEXT,
    request_id TEXT,
    trace_id TEXT,
    idempotency_key TEXT NOT NULL,
    replayable BOOLEAN NOT NULL DEFAULT TRUE,
    retention_class TEXT NOT NULL DEFAULT 'hot'
        CHECK (retention_class IN ('hot', 'warm', 'archive', 'legal-hold')),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(stream_name, stream_position),
    UNIQUE(stream_name, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_distributed_event_store_site_position
    ON distributed_event_store(site_id, global_position)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_distributed_event_store_type_position
    ON distributed_event_store(event_type, global_position)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_distributed_event_store_stream_position
    ON distributed_event_store(stream_name, stream_position)
    WHERE deleted_at IS NULL;

ALTER TABLE distributed_event_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS distributed_event_store_owner_read ON distributed_event_store;
CREATE POLICY distributed_event_store_owner_read
    ON distributed_event_store FOR SELECT
    USING (
        site_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = distributed_event_store.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS distributed_event_store_service_all ON distributed_event_store;
CREATE POLICY distributed_event_store_service_all
    ON distributed_event_store FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 2. Replay plans and checkpoints
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS runtime_replay_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    replay_id TEXT NOT NULL UNIQUE,
    owner_runtime TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    event_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    cursor JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'authorized', 'running', 'paused', 'completed', 'failed', 'cancelled')),
    dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    requested_by UUID,
    approved_by UUID,
    authorization_expires_at TIMESTAMPTZ,
    reason TEXT NOT NULL,
    result JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_replay_executions_status
    ON runtime_replay_executions(status, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE runtime_replay_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_replay_executions_service_all ON runtime_replay_executions;
CREATE POLICY runtime_replay_executions_service_all
    ON runtime_replay_executions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkpoint_id TEXT NOT NULL UNIQUE,
    owner_runtime TEXT NOT NULL,
    checkpoint_kind TEXT NOT NULL
        CHECK (checkpoint_kind IN ('event-replay', 'queue-consumer', 'workflow', 'projection', 'provider-call')),
    execution_id TEXT NOT NULL,
    step_name TEXT,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    state JSONB NOT NULL DEFAULT '{}',
    cursor JSONB NOT NULL DEFAULT '{}',
    attempt INTEGER NOT NULL DEFAULT 0,
    fencing_token TEXT,
    request_id TEXT,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_checkpoints_execution
    ON runtime_checkpoints(execution_id, checkpoint_kind, recorded_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_runtime_checkpoints_site
    ON runtime_checkpoints(site_id, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE runtime_checkpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_checkpoints_service_all ON runtime_checkpoints;
CREATE POLICY runtime_checkpoints_service_all
    ON runtime_checkpoints FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Durable distributed queues and coordination leases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS distributed_queue_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT NOT NULL UNIQUE,
    queue_name TEXT NOT NULL,
    partition_key TEXT NOT NULL,
    partition_index INTEGER NOT NULL DEFAULT 0,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('scheduled', 'available', 'leased', 'completed', 'retrying', 'dead-lettered', 'cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 10,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    leased_until TIMESTAMPTZ,
    leased_by TEXT,
    fencing_token TEXT,
    idempotency_key TEXT NOT NULL,
    request_id TEXT,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    traceparent TEXT,
    result JSONB NOT NULL DEFAULT '{}',
    error_message TEXT,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(queue_name, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_distributed_queue_messages_claim
    ON distributed_queue_messages(queue_name, partition_index, status, available_at, created_at)
    WHERE status IN ('scheduled', 'available', 'retrying') AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_distributed_queue_messages_site
    ON distributed_queue_messages(site_id, queue_name, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE distributed_queue_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS distributed_queue_messages_service_all ON distributed_queue_messages;
CREATE POLICY distributed_queue_messages_service_all
    ON distributed_queue_messages FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS runtime_leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id TEXT NOT NULL UNIQUE,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    fencing_token TEXT NOT NULL UNIQUE,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    request_id TEXT,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_runtime_leases_expiry
    ON runtime_leases(expires_at)
    WHERE deleted_at IS NULL;

ALTER TABLE runtime_leases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_leases_service_all ON runtime_leases;
CREATE POLICY runtime_leases_service_all
    ON runtime_leases FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 4. Projection persistence and rebuild lifecycle
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS projection_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projection_name TEXT NOT NULL,
    projection_version INTEGER NOT NULL DEFAULT 1,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    read_model JSONB NOT NULL DEFAULT '{}',
    source_event_id UUID,
    source_global_position BIGINT,
    source_stream_position BIGINT,
    projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stale_after TIMESTAMPTZ,
    lifecycle_status TEXT NOT NULL DEFAULT 'active'
        CHECK (lifecycle_status IN ('active', 'stale', 'rebuilding', 'invalidated', 'deleted')),
    cache_key TEXT,
    cache_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(projection_name, projection_version, site_id, object_type, object_id)
);

CREATE INDEX IF NOT EXISTS idx_projection_store_site_projection
    ON projection_store(site_id, projection_name, projection_version, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projection_store_source_event
    ON projection_store(source_event_id)
    WHERE deleted_at IS NULL;

ALTER TABLE projection_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projection_store_owner_read ON projection_store;
CREATE POLICY projection_store_owner_read
    ON projection_store FOR SELECT
    USING (
        site_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = projection_store.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS projection_store_service_all ON projection_store;
CREATE POLICY projection_store_service_all
    ON projection_store FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS projection_rebuilds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rebuild_id TEXT NOT NULL UNIQUE,
    projection_name TEXT NOT NULL,
    projection_version INTEGER NOT NULL DEFAULT 1,
    owner_runtime TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    cursor JSONB NOT NULL DEFAULT '{}',
    scanned INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    requested_by UUID,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projection_rebuilds_status
    ON projection_rebuilds(status, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE projection_rebuilds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projection_rebuilds_service_all ON projection_rebuilds;
CREATE POLICY projection_rebuilds_service_all
    ON projection_rebuilds FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 5. Tenant scalability, provider health, cache invalidation, and audit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tenant_execution_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    max_concurrent_executions INTEGER NOT NULL DEFAULT 25,
    max_queued_jobs INTEGER NOT NULL DEFAULT 10000,
    max_requests_per_minute INTEGER NOT NULL DEFAULT 600,
    burst_multiplier NUMERIC(8,2) NOT NULL DEFAULT 1,
    priority_class TEXT NOT NULL DEFAULT 'standard'
        CHECK (priority_class IN ('standard', 'growth', 'enterprise', 'platform-critical')),
    noisy_neighbor_protection BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id)
);

ALTER TABLE tenant_execution_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_execution_quotas_service_all ON tenant_execution_quotas;
CREATE POLICY tenant_execution_quotas_service_all
    ON tenant_execution_quotas FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS provider_health_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    region TEXT,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unavailable')),
    latency_ms INTEGER,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provider_health_snapshots_provider
    ON provider_health_snapshots(provider, operation, checked_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE provider_health_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_health_snapshots_service_all ON provider_health_snapshots;
CREATE POLICY provider_health_snapshots_service_all
    ON provider_health_snapshots FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS cache_invalidation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_name TEXT NOT NULL,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    source_event_id UUID,
    keys TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    replay_aware BOOLEAN NOT NULL DEFAULT TRUE,
    reason TEXT NOT NULL,
    processed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cache_invalidation_events_claim
    ON cache_invalidation_events(processed_at, created_at)
    WHERE processed_at IS NULL AND deleted_at IS NULL;

ALTER TABLE cache_invalidation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cache_invalidation_events_service_all ON cache_invalidation_events;
CREATE POLICY cache_invalidation_events_service_all
    ON cache_invalidation_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS execution_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id TEXT NOT NULL UNIQUE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    actor_id UUID,
    request_id TEXT NOT NULL,
    correlation_id TEXT NOT NULL,
    trace_id TEXT,
    before_state JSONB,
    after_state JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_execution_audit_trail_site
    ON execution_audit_trail(site_id, recorded_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_execution_audit_trail_resource
    ON execution_audit_trail(resource_type, resource_id, recorded_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE execution_audit_trail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS execution_audit_trail_service_all ON execution_audit_trail;
CREATE POLICY execution_audit_trail_service_all
    ON execution_audit_trail FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 6. Updated-at triggers and append helper
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'distributed_event_streams',
        'distributed_event_store',
        'runtime_replay_executions',
        'runtime_checkpoints',
        'distributed_queue_messages',
        'runtime_leases',
        'projection_store',
        'projection_rebuilds',
        'tenant_execution_quotas',
        'provider_health_snapshots',
        'cache_invalidation_events',
        'execution_audit_trail'
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

CREATE OR REPLACE FUNCTION append_distributed_event(
    p_event_id UUID,
    p_stream_name TEXT,
    p_partition_key TEXT,
    p_site_id UUID,
    p_aggregate_type TEXT,
    p_aggregate_id TEXT,
    p_event_type TEXT,
    p_schema_version INTEGER,
    p_payload JSONB,
    p_metadata JSONB,
    p_source_runtime TEXT,
    p_producer TEXT,
    p_correlation_id TEXT,
    p_causation_id TEXT,
    p_request_id TEXT,
    p_trace_id TEXT,
    p_idempotency_key TEXT,
    p_replayable BOOLEAN,
    p_retention_class TEXT
)
RETURNS TABLE (
    event_id UUID,
    stream_name TEXT,
    stream_position BIGINT,
    global_position BIGINT,
    persisted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_stream_position BIGINT;
    inserted distributed_event_store%ROWTYPE;
BEGIN
    IF p_stream_name IS NULL OR length(trim(p_stream_name)) = 0 THEN
        RAISE EXCEPTION 'stream name is required';
    END IF;

    INSERT INTO distributed_event_streams (
        stream_name,
        site_id,
        partition_key,
        metadata
    )
    VALUES (
        p_stream_name,
        p_site_id,
        p_partition_key,
        jsonb_build_object('created_by_append', TRUE)
    )
    ON CONFLICT (stream_name) DO NOTHING;

    SELECT distributed_event_streams.last_stream_position + 1
      INTO next_stream_position
      FROM distributed_event_streams
     WHERE distributed_event_streams.stream_name = p_stream_name
     FOR UPDATE;

    INSERT INTO distributed_event_store (
        event_id,
        stream_name,
        stream_position,
        partition_key,
        site_id,
        aggregate_type,
        aggregate_id,
        event_type,
        schema_version,
        payload,
        metadata,
        source_runtime,
        producer,
        correlation_id,
        causation_id,
        request_id,
        trace_id,
        idempotency_key,
        replayable,
        retention_class
    )
    VALUES (
        p_event_id,
        p_stream_name,
        next_stream_position,
        p_partition_key,
        p_site_id,
        p_aggregate_type,
        p_aggregate_id,
        p_event_type,
        COALESCE(p_schema_version, 1),
        COALESCE(p_payload, '{}'),
        COALESCE(p_metadata, '{}'),
        p_source_runtime,
        p_producer,
        p_correlation_id,
        p_causation_id,
        p_request_id,
        p_trace_id,
        p_idempotency_key,
        COALESCE(p_replayable, TRUE),
        COALESCE(p_retention_class, 'hot')
    )
    ON CONFLICT (stream_name, idempotency_key) DO NOTHING
    RETURNING * INTO inserted;

    IF inserted.id IS NULL THEN
        SELECT *
          INTO inserted
          FROM distributed_event_store
         WHERE distributed_event_store.stream_name = p_stream_name
           AND distributed_event_store.idempotency_key = p_idempotency_key
         LIMIT 1;
    END IF;

    UPDATE distributed_event_streams
       SET last_stream_position = GREATEST(last_stream_position, inserted.stream_position),
           last_global_position = GREATEST(last_global_position, inserted.global_position),
           updated_at = NOW()
     WHERE distributed_event_streams.stream_name = p_stream_name;

    RETURN QUERY
    SELECT
        inserted.event_id,
        inserted.stream_name,
        inserted.stream_position,
        inserted.global_position,
        inserted.persisted_at;
END;
$$;
