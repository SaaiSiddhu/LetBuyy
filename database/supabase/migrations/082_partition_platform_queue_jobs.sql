-- Phase 5.4 P3-1: additive partition shadow for platform_queue_jobs.
-- Drain queued/failed/running jobs before live cutover; this migration does not mutate the live queue table.

CREATE TABLE IF NOT EXISTS public.platform_queue_jobs_partitioned (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    outbox_event_id uuid,
    event_id uuid NOT NULL,
    queue_name text NOT NULL,
    job_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 10 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    error_message text,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    trace_id text,
    idempotency_key text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT platform_queue_jobs_partitioned_pkey PRIMARY KEY (id, created_at),
    CONSTRAINT platform_queue_jobs_partitioned_queue_name_check CHECK ((queue_name = ANY (ARRAY['payment-events'::text, 'inventory-jobs'::text, 'webhook-deliveries'::text, 'analytics-events'::text, 'search-indexing'::text, 'fulfillment-jobs'::text, 'bulk-admin-jobs'::text]))),
    CONSTRAINT platform_queue_jobs_partitioned_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'dead'::text, 'cancelled'::text])))
) PARTITION BY RANGE (created_at);

ALTER TABLE public.platform_queue_jobs_partitioned
    ADD CONSTRAINT platform_queue_jobs_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.platform_queue_jobs_partitioned_default
    PARTITION OF public.platform_queue_jobs_partitioned DEFAULT;

CREATE INDEX IF NOT EXISTS idx_platform_queue_jobs_partitioned_claim
    ON public.platform_queue_jobs_partitioned USING btree (queue_name, status, available_at, created_at)
    WHERE ((status = ANY (ARRAY['queued'::text, 'failed'::text])) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_platform_queue_jobs_partitioned_event_id
    ON public.platform_queue_jobs_partitioned USING btree (event_id, created_at)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_platform_queue_jobs_partitioned_site_created
    ON public.platform_queue_jobs_partitioned USING btree (site_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE TRIGGER update_platform_queue_jobs_partitioned_updated_at
    BEFORE UPDATE ON public.platform_queue_jobs_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.platform_queue_jobs_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_queue_jobs_partitioned_owner_read ON public.platform_queue_jobs_partitioned FOR SELECT
    USING (((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = platform_queue_jobs_partitioned.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL))))));

CREATE POLICY platform_queue_jobs_partitioned_service_all ON public.platform_queue_jobs_partitioned
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

SELECT public.upsert_retention_policy(
    'platform_queue_jobs',
    'platform_queue_jobs_partitioned',
    30,
    ARRAY['succeeded'::text, 'dead'::text, 'cancelled'::text],
    'terminal statuses retained for 30 days; queued, running, and failed rows must be drained before live cutover',
    'Platform queue jobs are operationally hot. Drain non-terminal jobs, backfill the shadow, verify counts and claim-query plans, then perform approved maintenance-window cutover.'
);

SELECT public.ensure_monthly_hot_table_partition('platform_queue_jobs', DATE '2026-06-01');
SELECT public.ensure_monthly_hot_table_partition('platform_queue_jobs', DATE '2026-07-01');

COMMENT ON TABLE public.platform_queue_jobs_partitioned IS 'Partitioned shadow for platform_queue_jobs. Queue drains and circuit breakers must be healthy before approved cutover.';
