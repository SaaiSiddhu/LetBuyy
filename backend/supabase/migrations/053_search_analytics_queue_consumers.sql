-- ============================================================================
-- Migration 053: Search and Analytics Queue Consumers
-- Turns platform_queue_jobs into claimable durable work and adds projections for
-- event-driven analytics and search indexing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_event_stream (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    aggregate_type TEXT,
    aggregate_id TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id TEXT,
    trace_id TEXT,
    idempotency_key TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    properties JSONB NOT NULL DEFAULT '{}',
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_stream_site_created
    ON analytics_event_stream(site_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_event_stream_type_created
    ON analytics_event_stream(event_type, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE analytics_event_stream ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_event_stream_owner_read ON analytics_event_stream;
CREATE POLICY analytics_event_stream_owner_read
    ON analytics_event_stream FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = analytics_event_stream.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS analytics_event_stream_service_all ON analytics_event_stream;
CREATE POLICY analytics_event_stream_service_all
    ON analytics_event_stream FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS analytics_rollups_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    rollup_date DATE NOT NULL,
    dimensions JSONB NOT NULL DEFAULT '{}',
    metric_value NUMERIC(16,4) NOT NULL DEFAULT 0,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(site_id, metric_name, rollup_date, dimensions)
);

CREATE INDEX IF NOT EXISTS idx_analytics_rollups_daily_site_date
    ON analytics_rollups_daily(site_id, rollup_date DESC, metric_name)
    WHERE deleted_at IS NULL;

ALTER TABLE analytics_rollups_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_rollups_daily_owner_read ON analytics_rollups_daily;
CREATE POLICY analytics_rollups_daily_owner_read
    ON analytics_rollups_daily FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = analytics_rollups_daily.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS analytics_rollups_daily_service_all ON analytics_rollups_daily;
CREATE POLICY analytics_rollups_daily_service_all
    ON analytics_rollups_daily FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS search_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT,
    searchable_text TEXT NOT NULL DEFAULT '',
    attributes JSONB NOT NULL DEFAULT '{}',
    source_event_id UUID,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'hidden', 'deleted')),
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', searchable_text)) STORED,
    UNIQUE(site_id, object_type, object_id)
);

CREATE INDEX IF NOT EXISTS idx_search_documents_site_type
    ON search_documents(site_id, object_type, updated_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_search_documents_vector
    ON search_documents USING GIN(search_vector);

ALTER TABLE search_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_documents_owner_read ON search_documents;
CREATE POLICY search_documents_owner_read
    ON search_documents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = search_documents.site_id
              AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS search_documents_public_active_read ON search_documents;
CREATE POLICY search_documents_public_active_read
    ON search_documents FOR SELECT
    USING (
        status = 'active'
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM sites
            WHERE sites.id = search_documents.site_id
              AND sites.status = 'published'
              AND sites.deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS search_documents_service_all ON search_documents;
CREATE POLICY search_documents_service_all
    ON search_documents FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_analytics_event_stream_updated_at') THEN
        CREATE TRIGGER update_analytics_event_stream_updated_at
            BEFORE UPDATE ON analytics_event_stream
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_analytics_rollups_daily_updated_at') THEN
        CREATE TRIGGER update_analytics_rollups_daily_updated_at
            BEFORE UPDATE ON analytics_rollups_daily
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_search_documents_updated_at') THEN
        CREATE TRIGGER update_search_documents_updated_at
            BEFORE UPDATE ON search_documents
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION claim_platform_queue_jobs(
    p_queue_name TEXT,
    p_worker_id TEXT,
    p_limit INTEGER DEFAULT 25,
    p_lock_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
    id UUID,
    site_id UUID,
    outbox_event_id UUID,
    event_id UUID,
    queue_name TEXT,
    job_type TEXT,
    payload JSONB,
    attempts INTEGER,
    max_attempts INTEGER,
    request_id TEXT,
    trace_id TEXT,
    idempotency_key TEXT,
    schema_version INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_queue_name IS NULL OR length(trim(p_queue_name)) = 0 THEN
        RAISE EXCEPTION 'queue name is required';
    END IF;

    IF p_worker_id IS NULL OR length(trim(p_worker_id)) = 0 THEN
        RAISE EXCEPTION 'worker id is required';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT platform_queue_jobs.id
        FROM platform_queue_jobs
        WHERE platform_queue_jobs.queue_name = p_queue_name
          AND platform_queue_jobs.status IN ('queued', 'failed')
          AND platform_queue_jobs.available_at <= NOW()
          AND platform_queue_jobs.attempts < platform_queue_jobs.max_attempts
          AND platform_queue_jobs.deleted_at IS NULL
          AND (
              platform_queue_jobs.locked_at IS NULL
              OR platform_queue_jobs.locked_at < NOW() - make_interval(secs => p_lock_seconds)
          )
        ORDER BY platform_queue_jobs.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT LEAST(GREATEST(p_limit, 1), 100)
    ),
    claimed AS (
        UPDATE platform_queue_jobs
           SET status = 'running',
               attempts = platform_queue_jobs.attempts + 1,
               locked_at = NOW(),
               locked_by = p_worker_id,
               error_message = NULL,
               updated_at = NOW()
          FROM candidates
         WHERE platform_queue_jobs.id = candidates.id
         RETURNING platform_queue_jobs.*
    )
    SELECT
        claimed.id,
        claimed.site_id,
        claimed.outbox_event_id,
        claimed.event_id,
        claimed.queue_name,
        claimed.job_type,
        claimed.payload,
        claimed.attempts,
        claimed.max_attempts,
        claimed.request_id,
        claimed.trace_id,
        claimed.idempotency_key,
        claimed.schema_version
    FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION increment_analytics_rollup(
    p_site_id UUID,
    p_metric_name TEXT,
    p_rollup_date DATE,
    p_dimensions JSONB DEFAULT '{}'::JSONB,
    p_increment NUMERIC DEFAULT 1
)
RETURNS analytics_rollups_daily
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rollup analytics_rollups_daily;
BEGIN
    INSERT INTO analytics_rollups_daily (
        site_id, metric_name, rollup_date, dimensions, metric_value
    )
    VALUES (
        p_site_id,
        p_metric_name,
        p_rollup_date,
        COALESCE(p_dimensions, '{}'::JSONB),
        COALESCE(p_increment, 1)
    )
    ON CONFLICT (site_id, metric_name, rollup_date, dimensions)
    DO UPDATE SET
        metric_value = analytics_rollups_daily.metric_value + EXCLUDED.metric_value,
        updated_at = NOW(),
        deleted_at = NULL
    RETURNING * INTO v_rollup;

    RETURN v_rollup;
END;
$$;

CREATE OR REPLACE FUNCTION complete_platform_queue_job(
    p_job_id UUID,
    p_worker_id TEXT,
    p_result JSONB DEFAULT '{}'::JSONB
)
RETURNS platform_queue_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job platform_queue_jobs;
BEGIN
    UPDATE platform_queue_jobs
       SET status = 'succeeded',
           locked_at = NULL,
           locked_by = NULL,
           completed_at = NOW(),
           failed_at = NULL,
           error_message = NULL,
           result = COALESCE(p_result, '{}'::JSONB),
           updated_at = NOW()
     WHERE id = p_job_id
       AND status = 'running'
       AND locked_by = p_worker_id
     RETURNING * INTO v_job;

    IF v_job.id IS NULL THEN
        RAISE EXCEPTION 'queue job % is not claimable by worker %', p_job_id, p_worker_id;
    END IF;

    RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION fail_platform_queue_job(
    p_job_id UUID,
    p_worker_id TEXT,
    p_error_message TEXT,
    p_retry_seconds INTEGER DEFAULT 120,
    p_result JSONB DEFAULT '{}'::JSONB
)
RETURNS platform_queue_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job platform_queue_jobs;
    v_next_status TEXT;
    v_retry_seconds INTEGER;
BEGIN
    SELECT *
      INTO v_job
      FROM platform_queue_jobs
     WHERE id = p_job_id
       AND status = 'running'
       AND locked_by = p_worker_id
     FOR UPDATE;

    IF v_job.id IS NULL THEN
        RAISE EXCEPTION 'queue job % is not claimable by worker %', p_job_id, p_worker_id;
    END IF;

    v_next_status := CASE WHEN v_job.attempts >= v_job.max_attempts THEN 'dead' ELSE 'failed' END;
    v_retry_seconds := LEAST(GREATEST(COALESCE(p_retry_seconds, 120), 30), 7200);

    UPDATE platform_queue_jobs
       SET status = v_next_status,
           locked_at = NULL,
           locked_by = NULL,
           failed_at = NOW(),
           available_at = CASE
               WHEN v_next_status = 'dead' THEN available_at
               ELSE NOW() + make_interval(secs => v_retry_seconds)
           END,
           error_message = LEFT(COALESCE(p_error_message, 'Queue job failed'), 2000),
           result = COALESCE(p_result, '{}'::JSONB),
           updated_at = NOW()
     WHERE id = v_job.id
     RETURNING * INTO v_job;

    RETURN v_job;
END;
$$;
