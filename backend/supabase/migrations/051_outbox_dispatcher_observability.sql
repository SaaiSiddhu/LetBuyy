-- ============================================================================
-- Migration 051: Outbox Dispatcher, Webhook Delivery, Background Jobs, Logs
-- Production runtime foundation for event-driven commerce operations.
--
-- Design intent:
-- - preserve `sites` as tenant root and keep legacy `store_id` compatibility
-- - make outbox dispatch claimable, retryable, replayable, and dead-lettered
-- - persist queue fanout as durable jobs until Cloudflare Queue bindings exist
-- - persist webhook delivery attempts with idempotency and HMAC signatures
-- - record request/trace metadata without exposing operational tables to clients
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Outbox dispatcher runtime columns
-- ---------------------------------------------------------------------------

ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 10;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS dispatch_metadata JSONB NOT NULL DEFAULT '{}';

UPDATE outbox_events
   SET next_attempt_at = available_at
 WHERE next_attempt_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_events_dispatch_claim
    ON outbox_events(status, next_attempt_at, available_at, created_at)
    WHERE status IN ('queued', 'failed');

CREATE INDEX IF NOT EXISTS idx_outbox_events_locked_by
    ON outbox_events(locked_by, locked_at)
    WHERE locked_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_events_dead_lettered
    ON outbox_events(dead_lettered_at DESC)
    WHERE status = 'dead';

-- ---------------------------------------------------------------------------
-- 2. Dead letters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS outbox_dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    outbox_event_id UUID NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    failure_reason TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    request_id TEXT,
    trace_id TEXT,
    idempotency_key TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    replayed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(outbox_event_id)
);

CREATE INDEX IF NOT EXISTS idx_outbox_dead_letters_site_created
    ON outbox_dead_letters(site_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_outbox_dead_letters_event_type
    ON outbox_dead_letters(event_type, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE outbox_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_dead_letters_service_all ON outbox_dead_letters;
CREATE POLICY outbox_dead_letters_service_all
    ON outbox_dead_letters FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Durable queue job projection
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS platform_queue_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    outbox_event_id UUID REFERENCES outbox_events(id) ON DELETE SET NULL,
    event_id UUID NOT NULL,
    queue_name TEXT NOT NULL
        CHECK (queue_name IN (
            'payment-events',
            'inventory-jobs',
            'webhook-deliveries',
            'analytics-events',
            'search-indexing',
            'fulfillment-jobs',
            'bulk-admin-jobs'
        )),
    job_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead', 'cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 10,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    result JSONB NOT NULL DEFAULT '{}',
    request_id TEXT,
    trace_id TEXT,
    idempotency_key TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(queue_name, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_queue_jobs_claim
    ON platform_queue_jobs(queue_name, status, available_at, created_at)
    WHERE status IN ('queued', 'failed') AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_queue_jobs_site_created
    ON platform_queue_jobs(site_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_queue_jobs_event_id
    ON platform_queue_jobs(event_id)
    WHERE deleted_at IS NULL;

ALTER TABLE platform_queue_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_queue_jobs_owner_read ON platform_queue_jobs;
CREATE POLICY platform_queue_jobs_owner_read
    ON platform_queue_jobs FOR SELECT
    USING (
        site_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = platform_queue_jobs.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS platform_queue_jobs_service_all ON platform_queue_jobs;
CREATE POLICY platform_queue_jobs_service_all
    ON platform_queue_jobs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 4. Webhook subscriptions and delivery attempts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_url TEXT NOT NULL,
    event_types TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
    signing_secret TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'disabled')),
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_site_status
    ON webhook_subscriptions(site_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_events
    ON webhook_subscriptions USING GIN(event_types);

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_subscriptions_service_all ON webhook_subscriptions;
CREATE POLICY webhook_subscriptions_service_all
    ON webhook_subscriptions FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    outbox_event_id UUID REFERENCES outbox_events(id) ON DELETE SET NULL,
    event_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    target_url TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'dead', 'cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 10,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    response_status INTEGER,
    response_body_preview TEXT,
    error_message TEXT,
    request_id TEXT,
    trace_id TEXT,
    idempotency_key TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(subscription_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_claim
    ON webhook_deliveries(status, next_attempt_at, created_at)
    WHERE status IN ('pending', 'failed') AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_site_created
    ON webhook_deliveries(site_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_id
    ON webhook_deliveries(event_id)
    WHERE deleted_at IS NULL;

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_deliveries_service_all ON webhook_deliveries;
CREATE POLICY webhook_deliveries_service_all
    ON webhook_deliveries FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 5. Request logs and operational counters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS worker_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    request_id TEXT NOT NULL,
    trace_id TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    route TEXT,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    user_id UUID,
    auth_source TEXT,
    ip_address TEXT,
    user_agent TEXT,
    error_code TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_worker_request_logs_request_id
    ON worker_request_logs(request_id);

CREATE INDEX IF NOT EXISTS idx_worker_request_logs_site_created
    ON worker_request_logs(site_id, created_at DESC)
    WHERE site_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_worker_request_logs_route_status
    ON worker_request_logs(path, status_code, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE worker_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS worker_request_logs_service_all ON worker_request_logs;
CREATE POLICY worker_request_logs_service_all
    ON worker_request_logs FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS operation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    dimensions JSONB NOT NULL DEFAULT '{}',
    metric_value NUMERIC(16,4) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'count',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    request_id TEXT,
    trace_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_operation_metrics_name_recorded
    ON operation_metrics(metric_name, recorded_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_operation_metrics_site_recorded
    ON operation_metrics(site_id, recorded_at DESC)
    WHERE site_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE operation_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operation_metrics_service_all ON operation_metrics;
CREATE POLICY operation_metrics_service_all
    ON operation_metrics FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 6. Updated-at triggers
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_outbox_dead_letters_updated_at') THEN
        CREATE TRIGGER update_outbox_dead_letters_updated_at
            BEFORE UPDATE ON outbox_dead_letters
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_platform_queue_jobs_updated_at') THEN
        CREATE TRIGGER update_platform_queue_jobs_updated_at
            BEFORE UPDATE ON platform_queue_jobs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_webhook_subscriptions_updated_at') THEN
        CREATE TRIGGER update_webhook_subscriptions_updated_at
            BEFORE UPDATE ON webhook_subscriptions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_webhook_deliveries_updated_at') THEN
        CREATE TRIGGER update_webhook_deliveries_updated_at
            BEFORE UPDATE ON webhook_deliveries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_worker_request_logs_updated_at') THEN
        CREATE TRIGGER update_worker_request_logs_updated_at
            BEFORE UPDATE ON worker_request_logs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_operation_metrics_updated_at') THEN
        CREATE TRIGGER update_operation_metrics_updated_at
            BEFORE UPDATE ON operation_metrics
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. RPC: claim, complete, fail, and replay outbox events
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_outbox_events(
    p_dispatcher_id TEXT,
    p_limit INTEGER DEFAULT 25,
    p_lock_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    site_id UUID,
    event_id UUID,
    aggregate_type TEXT,
    aggregate_id TEXT,
    event_type TEXT,
    payload JSONB,
    idempotency_key TEXT,
    request_id TEXT,
    trace_id TEXT,
    schema_version INTEGER,
    actor_id UUID,
    attempts INTEGER,
    max_attempts INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_dispatcher_id IS NULL OR length(trim(p_dispatcher_id)) = 0 THEN
        RAISE EXCEPTION 'dispatcher id is required';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT outbox_events.id
        FROM outbox_events
        WHERE outbox_events.status IN ('queued', 'failed')
          AND outbox_events.available_at <= NOW()
          AND outbox_events.next_attempt_at <= NOW()
          AND outbox_events.attempts < outbox_events.max_attempts
          AND (
              outbox_events.locked_at IS NULL
              OR outbox_events.locked_at < NOW() - make_interval(secs => p_lock_seconds)
          )
        ORDER BY outbox_events.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
    ),
    claimed AS (
        UPDATE outbox_events
           SET status = 'processing',
               attempts = outbox_events.attempts + 1,
               locked_at = NOW(),
               locked_by = p_dispatcher_id,
               error_message = NULL,
               updated_at = NOW()
          FROM candidates
         WHERE outbox_events.id = candidates.id
         RETURNING outbox_events.*
    )
    SELECT
        claimed.id,
        claimed.store_id,
        COALESCE(claimed.site_id, claimed.store_id) AS site_id,
        claimed.event_id,
        claimed.aggregate_type,
        claimed.aggregate_id,
        claimed.event_type,
        claimed.payload,
        claimed.idempotency_key,
        claimed.request_id,
        claimed.trace_id,
        claimed.schema_version,
        claimed.actor_id,
        claimed.attempts,
        claimed.max_attempts,
        claimed.created_at
    FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION complete_outbox_event(
    p_event_id UUID,
    p_dispatcher_id TEXT,
    p_delivery_count INTEGER DEFAULT 0,
    p_job_count INTEGER DEFAULT 0,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event outbox_events;
BEGIN
    UPDATE outbox_events
       SET status = 'processed',
           locked_at = NULL,
           locked_by = NULL,
           processed_at = NOW(),
           dispatched_at = NOW(),
           error_message = NULL,
           dispatch_metadata = COALESCE(p_metadata, '{}'::JSONB)
               || jsonb_build_object(
                   'delivery_count', COALESCE(p_delivery_count, 0),
                   'job_count', COALESCE(p_job_count, 0),
                   'completed_at', NOW()
               ),
           updated_at = NOW()
     WHERE outbox_events.id = p_event_id
       AND outbox_events.status = 'processing'
       AND outbox_events.locked_by = p_dispatcher_id
     RETURNING * INTO v_event;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'outbox event % is not claimable by dispatcher %', p_event_id, p_dispatcher_id;
    END IF;

    RETURN v_event;
END;
$$;

CREATE OR REPLACE FUNCTION fail_outbox_event(
    p_event_id UUID,
    p_dispatcher_id TEXT,
    p_error_message TEXT,
    p_retry_seconds INTEGER DEFAULT 60,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event outbox_events;
    v_next_status TEXT;
    v_retry_seconds INTEGER;
BEGIN
    SELECT *
      INTO v_event
      FROM outbox_events
     WHERE id = p_event_id
       AND status = 'processing'
       AND locked_by = p_dispatcher_id
     FOR UPDATE;

    IF v_event.id IS NULL THEN
        RAISE EXCEPTION 'outbox event % is not claimable by dispatcher %', p_event_id, p_dispatcher_id;
    END IF;

    v_next_status := CASE WHEN v_event.attempts >= v_event.max_attempts THEN 'dead' ELSE 'failed' END;
    v_retry_seconds := LEAST(GREATEST(COALESCE(p_retry_seconds, 60), 10), 3600);

    IF v_next_status = 'dead' THEN
        INSERT INTO outbox_dead_letters (
            site_id, outbox_event_id, event_id, event_type, aggregate_type, aggregate_id,
            payload, failure_reason, attempts, request_id, trace_id, idempotency_key,
            schema_version, metadata
        )
        VALUES (
            COALESCE(v_event.site_id, v_event.store_id),
            v_event.id,
            v_event.event_id,
            v_event.event_type,
            v_event.aggregate_type,
            v_event.aggregate_id,
            v_event.payload,
            COALESCE(NULLIF(p_error_message, ''), 'Unknown dispatcher failure'),
            v_event.attempts,
            v_event.request_id,
            v_event.trace_id,
            v_event.idempotency_key,
            v_event.schema_version,
            COALESCE(p_metadata, '{}'::JSONB)
        )
        ON CONFLICT (outbox_event_id)
        DO UPDATE SET
            failure_reason = EXCLUDED.failure_reason,
            attempts = EXCLUDED.attempts,
            metadata = EXCLUDED.metadata,
            updated_at = NOW(),
            deleted_at = NULL;
    END IF;

    UPDATE outbox_events
       SET status = v_next_status,
           locked_at = NULL,
           locked_by = NULL,
           available_at = CASE
               WHEN v_next_status = 'dead' THEN available_at
               ELSE NOW() + make_interval(secs => v_retry_seconds)
           END,
           next_attempt_at = CASE
               WHEN v_next_status = 'dead' THEN next_attempt_at
               ELSE NOW() + make_interval(secs => v_retry_seconds)
           END,
           error_message = LEFT(COALESCE(p_error_message, 'Dispatcher failure'), 2000),
           dead_lettered_at = CASE WHEN v_next_status = 'dead' THEN NOW() ELSE dead_lettered_at END,
           dead_letter_reason = CASE WHEN v_next_status = 'dead' THEN LEFT(COALESCE(p_error_message, 'Dispatcher failure'), 2000) ELSE dead_letter_reason END,
           dispatch_metadata = dispatch_metadata || COALESCE(p_metadata, '{}'::JSONB),
           updated_at = NOW()
     WHERE id = v_event.id
     RETURNING * INTO v_event;

    RETURN v_event;
END;
$$;

CREATE OR REPLACE FUNCTION replay_outbox_dead_letter(
    p_dead_letter_id UUID,
    p_request_id TEXT DEFAULT NULL
)
RETURNS outbox_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dead outbox_dead_letters;
    v_event outbox_events;
BEGIN
    SELECT *
      INTO v_dead
      FROM outbox_dead_letters
     WHERE id = p_dead_letter_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF v_dead.id IS NULL THEN
        RAISE EXCEPTION 'dead letter % not found', p_dead_letter_id;
    END IF;

    UPDATE outbox_events
       SET status = 'queued',
           attempts = 0,
           locked_at = NULL,
           locked_by = NULL,
           available_at = NOW(),
           next_attempt_at = NOW(),
           error_message = NULL,
           dead_lettered_at = NULL,
           dead_letter_reason = NULL,
           request_id = COALESCE(p_request_id, request_id),
           updated_at = NOW()
     WHERE id = v_dead.outbox_event_id
     RETURNING * INTO v_event;

    UPDATE outbox_dead_letters
       SET replayed_at = NOW(),
           updated_at = NOW()
     WHERE id = v_dead.id;

    RETURN v_event;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. RPC: claim, complete, and fail webhook deliveries
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_webhook_deliveries(
    p_dispatcher_id TEXT,
    p_limit INTEGER DEFAULT 25,
    p_lock_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
    id UUID,
    site_id UUID,
    subscription_id UUID,
    event_id UUID,
    event_type TEXT,
    target_url TEXT,
    payload JSONB,
    signing_secret TEXT,
    request_id TEXT,
    trace_id TEXT,
    idempotency_key TEXT,
    schema_version INTEGER,
    attempts INTEGER,
    max_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_dispatcher_id IS NULL OR length(trim(p_dispatcher_id)) = 0 THEN
        RAISE EXCEPTION 'dispatcher id is required';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT webhook_deliveries.id
        FROM webhook_deliveries
        JOIN webhook_subscriptions
          ON webhook_subscriptions.id = webhook_deliveries.subscription_id
         AND webhook_subscriptions.status = 'active'
         AND webhook_subscriptions.deleted_at IS NULL
        WHERE webhook_deliveries.status IN ('pending', 'failed')
          AND webhook_deliveries.deleted_at IS NULL
          AND webhook_deliveries.next_attempt_at <= NOW()
          AND webhook_deliveries.attempts < webhook_deliveries.max_attempts
          AND (
              webhook_deliveries.locked_at IS NULL
              OR webhook_deliveries.locked_at < NOW() - make_interval(secs => p_lock_seconds)
          )
        ORDER BY webhook_deliveries.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
    ),
    claimed AS (
        UPDATE webhook_deliveries
           SET status = 'processing',
               attempts = webhook_deliveries.attempts + 1,
               locked_at = NOW(),
               locked_by = p_dispatcher_id,
               error_message = NULL,
               updated_at = NOW()
          FROM candidates
         WHERE webhook_deliveries.id = candidates.id
         RETURNING webhook_deliveries.*
    )
    SELECT
        claimed.id,
        claimed.site_id,
        claimed.subscription_id,
        claimed.event_id,
        claimed.event_type,
        claimed.target_url,
        claimed.payload,
        webhook_subscriptions.signing_secret,
        claimed.request_id,
        claimed.trace_id,
        claimed.idempotency_key,
        claimed.schema_version,
        claimed.attempts,
        claimed.max_attempts
    FROM claimed
    JOIN webhook_subscriptions ON webhook_subscriptions.id = claimed.subscription_id;
END;
$$;

CREATE OR REPLACE FUNCTION complete_webhook_delivery(
    p_delivery_id UUID,
    p_dispatcher_id TEXT,
    p_response_status INTEGER,
    p_response_body_preview TEXT DEFAULT NULL
)
RETURNS webhook_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_delivery webhook_deliveries;
BEGIN
    UPDATE webhook_deliveries
       SET status = 'succeeded',
           locked_at = NULL,
           locked_by = NULL,
           delivered_at = NOW(),
           failed_at = NULL,
           response_status = p_response_status,
           response_body_preview = LEFT(COALESCE(p_response_body_preview, ''), 2000),
           error_message = NULL,
           updated_at = NOW()
     WHERE id = p_delivery_id
       AND status = 'processing'
       AND locked_by = p_dispatcher_id
     RETURNING * INTO v_delivery;

    IF v_delivery.id IS NULL THEN
        RAISE EXCEPTION 'webhook delivery % is not claimable by dispatcher %', p_delivery_id, p_dispatcher_id;
    END IF;

    UPDATE webhook_subscriptions
       SET failure_count = 0,
           last_success_at = NOW(),
           updated_at = NOW()
     WHERE id = v_delivery.subscription_id;

    RETURN v_delivery;
END;
$$;

CREATE OR REPLACE FUNCTION fail_webhook_delivery(
    p_delivery_id UUID,
    p_dispatcher_id TEXT,
    p_error_message TEXT,
    p_response_status INTEGER DEFAULT NULL,
    p_response_body_preview TEXT DEFAULT NULL,
    p_retry_seconds INTEGER DEFAULT 120
)
RETURNS webhook_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_delivery webhook_deliveries;
    v_next_status TEXT;
    v_retry_seconds INTEGER;
BEGIN
    SELECT *
      INTO v_delivery
      FROM webhook_deliveries
     WHERE id = p_delivery_id
       AND status = 'processing'
       AND locked_by = p_dispatcher_id
     FOR UPDATE;

    IF v_delivery.id IS NULL THEN
        RAISE EXCEPTION 'webhook delivery % is not claimable by dispatcher %', p_delivery_id;
    END IF;

    v_next_status := CASE WHEN v_delivery.attempts >= v_delivery.max_attempts THEN 'dead' ELSE 'failed' END;
    v_retry_seconds := LEAST(GREATEST(COALESCE(p_retry_seconds, 120), 30), 7200);

    UPDATE webhook_deliveries
       SET status = v_next_status,
           locked_at = NULL,
           locked_by = NULL,
           failed_at = NOW(),
           response_status = p_response_status,
           response_body_preview = LEFT(COALESCE(p_response_body_preview, ''), 2000),
           error_message = LEFT(COALESCE(p_error_message, 'Webhook delivery failed'), 2000),
           next_attempt_at = CASE
               WHEN v_next_status = 'dead' THEN next_attempt_at
               ELSE NOW() + make_interval(secs => v_retry_seconds)
           END,
           updated_at = NOW()
     WHERE id = v_delivery.id
     RETURNING * INTO v_delivery;

    UPDATE webhook_subscriptions
       SET failure_count = failure_count + 1,
           last_failure_at = NOW(),
           status = CASE WHEN failure_count + 1 >= 25 THEN 'paused' ELSE status END,
           updated_at = NOW()
     WHERE id = v_delivery.subscription_id;

    RETURN v_delivery;
END;
$$;
