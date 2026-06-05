-- Phase 5.4 P3-1: additive partition shadow for webhook_deliveries.

CREATE TABLE IF NOT EXISTS public.webhook_deliveries_partitioned (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    subscription_id uuid NOT NULL,
    outbox_event_id uuid,
    event_id uuid NOT NULL,
    event_type text NOT NULL,
    target_url text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 10 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    locked_by text,
    delivered_at timestamp with time zone,
    failed_at timestamp with time zone,
    response_status integer,
    response_body_preview text,
    error_message text,
    request_id text,
    trace_id text,
    idempotency_key text NOT NULL,
    schema_version integer DEFAULT 1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT webhook_deliveries_partitioned_pkey PRIMARY KEY (id, created_at),
    CONSTRAINT webhook_deliveries_partitioned_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'succeeded'::text, 'failed'::text, 'dead'::text, 'cancelled'::text])))
) PARTITION BY RANGE (created_at);

ALTER TABLE public.webhook_deliveries_partitioned
    ADD CONSTRAINT webhook_deliveries_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

ALTER TABLE public.webhook_deliveries_partitioned
    ADD CONSTRAINT webhook_deliveries_partitioned_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.webhook_deliveries_partitioned_default
    PARTITION OF public.webhook_deliveries_partitioned DEFAULT;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_partitioned_claim
    ON public.webhook_deliveries_partitioned USING btree (status, next_attempt_at, created_at)
    WHERE ((status = ANY (ARRAY['pending'::text, 'failed'::text])) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_partitioned_event_id
    ON public.webhook_deliveries_partitioned USING btree (event_id, created_at)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_partitioned_site_created
    ON public.webhook_deliveries_partitioned USING btree (site_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE TRIGGER update_webhook_deliveries_partitioned_updated_at
    BEFORE UPDATE ON public.webhook_deliveries_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.webhook_deliveries_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_deliveries_partitioned_service_all ON public.webhook_deliveries_partitioned
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

SELECT public.upsert_retention_policy(
    'webhook_deliveries',
    'webhook_deliveries_partitioned',
    90,
    ARRAY['succeeded'::text, 'dead'::text, 'cancelled'::text],
    'terminal statuses retained for 90 days; pending, processing, and failed rows must be drained before live cutover',
    'Webhook deliveries retain a longer audit window. Backfill, verify delivery claim plans, and cut over only in an approved maintenance window.'
);

SELECT public.ensure_monthly_hot_table_partition('webhook_deliveries', DATE '2026-06-01');
SELECT public.ensure_monthly_hot_table_partition('webhook_deliveries', DATE '2026-07-01');

COMMENT ON TABLE public.webhook_deliveries_partitioned IS 'Partitioned shadow for webhook_deliveries. Pending and failed deliveries must be drained or intentionally quarantined before approved cutover.';
