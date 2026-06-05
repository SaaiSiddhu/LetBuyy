-- Phase 5.4 P3-1: additive partition shadow for runtime_telemetry_metrics.

CREATE TABLE IF NOT EXISTS public.runtime_telemetry_metrics_partitioned (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_name text NOT NULL,
    metric_value numeric NOT NULL,
    unit text NOT NULL,
    runtime_name text,
    site_id uuid,
    dimensions jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    correlation_id text,
    trace_id text,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT runtime_telemetry_metrics_partitioned_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

ALTER TABLE public.runtime_telemetry_metrics_partitioned
    ADD CONSTRAINT runtime_telemetry_metrics_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.runtime_telemetry_metrics_partitioned_default
    PARTITION OF public.runtime_telemetry_metrics_partitioned DEFAULT;

CREATE INDEX IF NOT EXISTS idx_runtime_telemetry_metrics_partitioned_created
    ON public.runtime_telemetry_metrics_partitioned USING btree (metric_name, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_runtime_telemetry_metrics_partitioned_name
    ON public.runtime_telemetry_metrics_partitioned USING btree (metric_name, recorded_at DESC)
    WHERE (deleted_at IS NULL);

CREATE TRIGGER update_runtime_telemetry_metrics_partitioned_updated_at
    BEFORE UPDATE ON public.runtime_telemetry_metrics_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.runtime_telemetry_metrics_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY runtime_telemetry_metrics_partitioned_service_all ON public.runtime_telemetry_metrics_partitioned
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

SELECT public.upsert_retention_policy(
    'runtime_telemetry_metrics',
    'runtime_telemetry_metrics_partitioned',
    90,
    '{}'::text[],
    'created_at older than retention window',
    'Runtime telemetry metrics retain a longer window than request logs for operational baselines. Backfill and verify before approved maintenance-window cutover.'
);

SELECT public.ensure_monthly_hot_table_partition('runtime_telemetry_metrics', DATE '2026-06-01');
SELECT public.ensure_monthly_hot_table_partition('runtime_telemetry_metrics', DATE '2026-07-01');

COMMENT ON TABLE public.runtime_telemetry_metrics_partitioned IS 'Partitioned shadow for runtime_telemetry_metrics. Live cutover requires staging proof and a maintenance window.';
