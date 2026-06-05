-- Phase 5.4 P3-1: additive partition shadow for outbox_events.
-- Drain queued/failed work before live cutover; the replayable migration does not swap live tables.

CREATE TABLE IF NOT EXISTS public.outbox_events_partitioned (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid,
    aggregate_type text NOT NULL,
    aggregate_id text NOT NULL,
    event_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    idempotency_key text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    processed_at timestamp with time zone,
    error_message text,
    request_id text,
    actor_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    site_id uuid,
    event_id uuid DEFAULT gen_random_uuid(),
    trace_id text,
    schema_version integer DEFAULT 1 NOT NULL,
    max_attempts integer DEFAULT 10 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_by text,
    dispatched_at timestamp with time zone,
    dead_lettered_at timestamp with time zone,
    dead_letter_reason text,
    dispatch_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT outbox_events_partitioned_pkey PRIMARY KEY (id, created_at),
    CONSTRAINT outbox_events_partitioned_event_created_key UNIQUE (event_id, created_at),
    CONSTRAINT outbox_events_partitioned_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'processed'::text, 'failed'::text, 'dead'::text])))
) PARTITION BY RANGE (created_at);

ALTER TABLE public.outbox_events_partitioned
    ADD CONSTRAINT outbox_events_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;

ALTER TABLE public.outbox_events_partitioned
    ADD CONSTRAINT outbox_events_partitioned_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.outbox_events_partitioned_default
    PARTITION OF public.outbox_events_partitioned DEFAULT;

CREATE INDEX IF NOT EXISTS idx_outbox_events_partitioned_dead_lettered
    ON public.outbox_events_partitioned USING btree (dead_lettered_at DESC)
    WHERE (status = 'dead'::text);

CREATE INDEX IF NOT EXISTS idx_outbox_events_partitioned_dispatch_claim
    ON public.outbox_events_partitioned USING btree (status, next_attempt_at, available_at, created_at)
    WHERE (status = ANY (ARRAY['queued'::text, 'failed'::text]));

CREATE INDEX IF NOT EXISTS idx_outbox_events_partitioned_event_id
    ON public.outbox_events_partitioned USING btree (event_id, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_events_partitioned_locked_by
    ON public.outbox_events_partitioned USING btree (locked_by, locked_at)
    WHERE (locked_by IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outbox_events_partitioned_site_status_available
    ON public.outbox_events_partitioned USING btree (site_id, status, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_events_partitioned_status_available
    ON public.outbox_events_partitioned USING btree (status, available_at, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_events_partitioned_store_created
    ON public.outbox_events_partitioned USING btree (store_id, created_at DESC)
    WHERE (store_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outbox_events_partitioned_type_created
    ON public.outbox_events_partitioned USING btree (event_type, created_at DESC);

CREATE TRIGGER update_outbox_events_partitioned_updated_at
    BEFORE UPDATE ON public.outbox_events_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.outbox_events_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY outbox_events_partitioned_service_all ON public.outbox_events_partitioned
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

SELECT public.upsert_retention_policy(
    'outbox_events',
    'outbox_events_partitioned',
    30,
    ARRAY['processed'::text, 'dead'::text],
    'terminal statuses retained for 30 days; queued, processing, and failed rows must be drained before live cutover',
    'Outbox events are operationally hot. Drain non-terminal rows, backfill the shadow, verify counts and claim-query plans, then perform approved maintenance-window cutover.'
);

SELECT public.ensure_monthly_hot_table_partition('outbox_events', DATE '2026-06-01');
SELECT public.ensure_monthly_hot_table_partition('outbox_events', DATE '2026-07-01');

COMMENT ON TABLE public.outbox_events_partitioned IS 'Partitioned shadow for outbox_events. Non-terminal rows must be drained before cutover; outbox_events_legacy is retained for one retention cycle after swap.';
