-- Phase 5.4 P3-1: additive partition shadow for worker_request_logs.
-- The live rename-swap is intentionally not performed in a replayable migration.

CREATE TABLE IF NOT EXISTS public.retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_table text NOT NULL,
    shadow_table text NOT NULL,
    retention_days integer NOT NULL,
    partition_interval text DEFAULT 'monthly'::text NOT NULL,
    lifecycle_mode text DEFAULT 'partition-shadow'::text NOT NULL,
    terminal_statuses text[] DEFAULT '{}'::text[] NOT NULL,
    retention_predicate text,
    schedule_expression text DEFAULT '15 2 1 * *'::text NOT NULL,
    notes text,
    last_maintenance_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT retention_policies_lifecycle_mode_check CHECK ((lifecycle_mode = ANY (ARRAY['partition-shadow'::text, 'partition-live'::text, 'detached'::text]))),
    CONSTRAINT retention_policies_partition_interval_check CHECK ((partition_interval = ANY (ARRAY['monthly'::text]))),
    CONSTRAINT retention_policies_retention_days_check CHECK ((retention_days BETWEEN 1 AND 3650)),
    CONSTRAINT retention_policies_target_table_check CHECK ((target_table = ANY (ARRAY['worker_request_logs'::text, 'runtime_telemetry_metrics'::text, 'outbox_events'::text, 'platform_queue_jobs'::text, 'webhook_deliveries'::text])))
);

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_retention_policies_target_table
    ON public.retention_policies USING btree (target_table)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_retention_policies_shadow_table
    ON public.retention_policies USING btree (shadow_table)
    WHERE deleted_at IS NULL;

CREATE TRIGGER update_retention_policies_updated_at
    BEFORE UPDATE ON public.retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY retention_policies_service_all ON public.retention_policies
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE TABLE IF NOT EXISTS public.partition_lifecycle_partitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    target_table text NOT NULL,
    shadow_table text NOT NULL,
    partition_name text NOT NULL,
    partition_start date,
    partition_end date,
    status text DEFAULT 'attached'::text NOT NULL,
    verified_row_count bigint,
    last_verified_at timestamp with time zone,
    detached_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT partition_lifecycle_partitions_status_check CHECK ((status = ANY (ARRAY['attached'::text, 'detached'::text, 'cleanup-required'::text])))
);

ALTER TABLE ONLY public.partition_lifecycle_partitions
    ADD CONSTRAINT partition_lifecycle_partitions_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partition_lifecycle_partitions_target_name
    ON public.partition_lifecycle_partitions USING btree (target_table, partition_name)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_partition_lifecycle_partitions_retention
    ON public.partition_lifecycle_partitions USING btree (target_table, partition_end, status)
    WHERE deleted_at IS NULL;

CREATE TRIGGER update_partition_lifecycle_partitions_updated_at
    BEFORE UPDATE ON public.partition_lifecycle_partitions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.partition_lifecycle_partitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY partition_lifecycle_partitions_service_all ON public.partition_lifecycle_partitions
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE OR REPLACE FUNCTION public.upsert_retention_policy(
    p_target_table text,
    p_shadow_table text,
    p_retention_days integer,
    p_terminal_statuses text[] DEFAULT '{}'::text[],
    p_retention_predicate text DEFAULT NULL::text,
    p_notes text DEFAULT NULL::text
) RETURNS public.retention_policies
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_policy public.retention_policies;
BEGIN
    IF p_target_table IS NULL OR p_shadow_table IS NULL THEN
        RAISE EXCEPTION 'target and shadow tables are required';
    END IF;

    IF p_retention_days IS NULL OR p_retention_days < 1 THEN
        RAISE EXCEPTION 'retention days must be positive';
    END IF;

    INSERT INTO public.retention_policies (
        target_table,
        shadow_table,
        retention_days,
        terminal_statuses,
        retention_predicate,
        notes
    ) VALUES (
        p_target_table,
        p_shadow_table,
        p_retention_days,
        COALESCE(p_terminal_statuses, '{}'::text[]),
        p_retention_predicate,
        p_notes
    )
    ON CONFLICT (target_table) WHERE deleted_at IS NULL
    DO UPDATE SET
        shadow_table = EXCLUDED.shadow_table,
        retention_days = EXCLUDED.retention_days,
        terminal_statuses = EXCLUDED.terminal_statuses,
        retention_predicate = EXCLUDED.retention_predicate,
        notes = EXCLUDED.notes,
        updated_at = now()
    RETURNING * INTO v_policy;

    RETURN v_policy;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_monthly_hot_table_partition(
    p_target_table text,
    p_month date DEFAULT date_trunc('month', now())::date
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_policy public.retention_policies;
    v_month date := date_trunc('month', COALESCE(p_month, now()::date))::date;
    v_month_end date := (date_trunc('month', COALESCE(p_month, now()::date)) + interval '1 month')::date;
    v_partition_name text;
    v_created boolean := false;
BEGIN
    SELECT *
      INTO v_policy
      FROM public.retention_policies
     WHERE target_table = p_target_table
       AND deleted_at IS NULL;

    IF v_policy.id IS NULL THEN
        RAISE EXCEPTION 'retention policy is missing for %', p_target_table;
    END IF;

    IF to_regclass(format('public.%I', v_policy.shadow_table)) IS NULL THEN
        RAISE EXCEPTION 'partition shadow table % is missing', v_policy.shadow_table;
    END IF;

    v_partition_name := v_policy.shadow_table || '_' || to_char(v_month, 'YYYY_MM');

    IF length(v_partition_name) > 63 THEN
        RAISE EXCEPTION 'partition name % exceeds PostgreSQL identifier length', v_partition_name;
    END IF;

    IF to_regclass(format('public.%I', v_partition_name)) IS NULL THEN
        EXECUTE format(
            'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
            v_partition_name,
            v_policy.shadow_table,
            v_month,
            v_month_end
        );
        v_created := true;
    END IF;

    INSERT INTO public.partition_lifecycle_partitions (
        target_table,
        shadow_table,
        partition_name,
        partition_start,
        partition_end,
        status,
        last_verified_at
    ) VALUES (
        v_policy.target_table,
        v_policy.shadow_table,
        v_partition_name,
        v_month,
        v_month_end,
        'attached',
        now()
    )
    ON CONFLICT (target_table, partition_name) WHERE deleted_at IS NULL
    DO UPDATE SET
        shadow_table = EXCLUDED.shadow_table,
        partition_start = EXCLUDED.partition_start,
        partition_end = EXCLUDED.partition_end,
        status = 'attached',
        last_verified_at = now(),
        updated_at = now();

    RETURN jsonb_build_object(
        'target_table', v_policy.target_table,
        'shadow_table', v_policy.shadow_table,
        'partition_name', v_partition_name,
        'partition_start', v_month,
        'partition_end', v_month_end,
        'created', v_created
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_next_hot_table_partitions(
    p_months_ahead integer DEFAULT 2
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_policy public.retention_policies;
    v_index integer;
    v_results jsonb := '[]'::jsonb;
    v_months_ahead integer := LEAST(GREATEST(COALESCE(p_months_ahead, 2), 0), 24);
BEGIN
    FOR v_policy IN
        SELECT *
          FROM public.retention_policies
         WHERE lifecycle_mode IN ('partition-shadow', 'partition-live')
           AND deleted_at IS NULL
         ORDER BY target_table
    LOOP
        FOR v_index IN 0..v_months_ahead LOOP
            v_results := v_results || jsonb_build_array(
                public.ensure_monthly_hot_table_partition(
                    v_policy.target_table,
                    (date_trunc('month', now())::date + (v_index * interval '1 month'))::date
                )
            );
        END LOOP;
    END LOOP;

    UPDATE public.retention_policies
       SET last_maintenance_at = now(),
           updated_at = now()
     WHERE lifecycle_mode IN ('partition-shadow', 'partition-live')
       AND deleted_at IS NULL;

    RETURN jsonb_build_object('partitions', v_results);
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_expired_hot_table_partitions(
    p_as_of timestamp with time zone DEFAULT now()
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_partition record;
    v_detached integer := 0;
    v_cutoff date;
BEGIN
    FOR v_partition IN
        SELECT partitions.*, policies.retention_days
          FROM public.partition_lifecycle_partitions partitions
          JOIN public.retention_policies policies
            ON policies.target_table = partitions.target_table
           AND policies.deleted_at IS NULL
         WHERE partitions.status = 'attached'
           AND partitions.partition_end IS NOT NULL
           AND partitions.deleted_at IS NULL
         ORDER BY partitions.partition_end ASC
    LOOP
        v_cutoff := (p_as_of::date - v_partition.retention_days);

        IF v_partition.partition_end < v_cutoff
           AND to_regclass(format('public.%I', v_partition.shadow_table)) IS NOT NULL
           AND to_regclass(format('public.%I', v_partition.partition_name)) IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE public.%I DETACH PARTITION public.%I',
                v_partition.shadow_table,
                v_partition.partition_name
            );

            UPDATE public.partition_lifecycle_partitions
               SET status = 'cleanup-required',
                   detached_at = now(),
                   updated_at = now()
             WHERE id = v_partition.id;

            v_detached := v_detached + 1;
        END IF;
    END LOOP;

    UPDATE public.retention_policies
       SET last_maintenance_at = now(),
           updated_at = now()
     WHERE lifecycle_mode IN ('partition-shadow', 'partition-live')
       AND deleted_at IS NULL;

    RETURN jsonb_build_object('detached_partitions', v_detached);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_hot_table_partition_shadow(
    p_target_table text,
    p_batch_size integer DEFAULT 10000
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_policy public.retention_policies;
    v_batch_size integer := LEAST(GREATEST(COALESCE(p_batch_size, 10000), 1), 100000);
    v_rows bigint := 0;
BEGIN
    SELECT *
      INTO v_policy
      FROM public.retention_policies
     WHERE target_table = p_target_table
       AND deleted_at IS NULL;

    IF v_policy.id IS NULL THEN
        RAISE EXCEPTION 'retention policy is missing for %', p_target_table;
    END IF;

    EXECUTE format(
        'WITH candidates AS (
             SELECT live_rows.*
               FROM public.%1$I live_rows
              WHERE NOT EXISTS (
                    SELECT 1
                      FROM public.%2$I shadow_rows
                     WHERE shadow_rows.id = live_rows.id
                       AND shadow_rows.created_at = live_rows.created_at
              )
              ORDER BY live_rows.created_at ASC
              LIMIT %3$s
         ), copied AS (
             INSERT INTO public.%2$I
             SELECT * FROM candidates
             ON CONFLICT DO NOTHING
             RETURNING 1
         )
         SELECT count(*) FROM copied',
        v_policy.target_table,
        v_policy.shadow_table,
        v_batch_size
    ) INTO v_rows;

    RETURN jsonb_build_object(
        'target_table', v_policy.target_table,
        'shadow_table', v_policy.shadow_table,
        'copied_rows', COALESCE(v_rows, 0)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_hot_table_partition_shadow(
    p_target_table text
) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_policy public.retention_policies;
    v_live_count bigint := 0;
    v_shadow_count bigint := 0;
    v_partition_count bigint := 0;
    v_parent_is_partitioned boolean := false;
BEGIN
    SELECT *
      INTO v_policy
      FROM public.retention_policies
     WHERE target_table = p_target_table
       AND deleted_at IS NULL;

    IF v_policy.id IS NULL THEN
        RAISE EXCEPTION 'retention policy is missing for %', p_target_table;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I', v_policy.target_table) INTO v_live_count;
    EXECUTE format('SELECT count(*) FROM public.%I', v_policy.shadow_table) INTO v_shadow_count;

    SELECT EXISTS (
        SELECT 1
          FROM pg_partitioned_table
         WHERE partrelid = to_regclass(format('public.%I', v_policy.shadow_table))
    ) INTO v_parent_is_partitioned;

    SELECT count(*)
      INTO v_partition_count
      FROM pg_inherits
     WHERE inhparent = to_regclass(format('public.%I', v_policy.shadow_table));

    UPDATE public.partition_lifecycle_partitions
       SET verified_row_count = NULL,
           last_verified_at = now(),
           updated_at = now()
     WHERE target_table = v_policy.target_table
       AND deleted_at IS NULL;

    RETURN jsonb_build_object(
        'target_table', v_policy.target_table,
        'shadow_table', v_policy.shadow_table,
        'live_count', v_live_count,
        'shadow_count', v_shadow_count,
        'parent_is_partitioned', v_parent_is_partitioned,
        'partition_count', v_partition_count,
        'verified_at', now()
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.configure_hot_table_partition_cron()
RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_has_cron boolean := false;
    v_job_id bigint;
BEGIN
    SELECT EXISTS (
        SELECT 1
          FROM pg_namespace
         WHERE nspname = 'cron'
    ) INTO v_has_cron;

    IF NOT v_has_cron THEN
        RETURN jsonb_build_object(
            'configured', false,
            'reason', 'pg_cron schema unavailable; configure the external scheduler to call public.ensure_next_hot_table_partitions and public.detach_expired_hot_table_partitions'
        );
    END IF;

    EXECUTE 'SELECT cron.schedule($1, $2, $3)'
       INTO v_job_id
      USING
        'letbuyy-hot-table-partition-maintenance',
        '15 2 1 * *',
        'SELECT public.ensure_next_hot_table_partitions(3); SELECT public.detach_expired_hot_table_partitions();';

    RETURN jsonb_build_object('configured', true, 'job_id', v_job_id);
END;
$$;

CREATE TABLE IF NOT EXISTS public.worker_request_logs_partitioned (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    request_id text NOT NULL,
    trace_id text,
    method text NOT NULL,
    path text NOT NULL,
    route text,
    status_code integer NOT NULL,
    latency_ms integer NOT NULL,
    user_id uuid,
    auth_source text,
    ip_address text,
    user_agent text,
    error_code text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT worker_request_logs_partitioned_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

ALTER TABLE public.worker_request_logs_partitioned
    ADD CONSTRAINT worker_request_logs_partitioned_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.worker_request_logs_partitioned_default
    PARTITION OF public.worker_request_logs_partitioned DEFAULT;

CREATE INDEX IF NOT EXISTS idx_worker_request_logs_partitioned_request_id
    ON public.worker_request_logs_partitioned USING btree (request_id);

CREATE INDEX IF NOT EXISTS idx_worker_request_logs_partitioned_route_status
    ON public.worker_request_logs_partitioned USING btree (path, status_code, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_worker_request_logs_partitioned_site_created
    ON public.worker_request_logs_partitioned USING btree (site_id, created_at DESC)
    WHERE ((site_id IS NOT NULL) AND (deleted_at IS NULL));

CREATE TRIGGER update_worker_request_logs_partitioned_updated_at
    BEFORE UPDATE ON public.worker_request_logs_partitioned
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.worker_request_logs_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY worker_request_logs_partitioned_service_all ON public.worker_request_logs_partitioned
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

SELECT public.upsert_retention_policy(
    'worker_request_logs',
    'worker_request_logs_partitioned',
    45,
    '{}'::text[],
    'created_at older than retention window',
    'Worker request logs are append-heavy operational telemetry. Backfill into the shadow table, verify counts and query plans, then perform the approved maintenance-window swap while keeping worker_request_logs_legacy for one retention cycle.'
);

SELECT public.ensure_monthly_hot_table_partition('worker_request_logs', DATE '2026-06-01');
SELECT public.ensure_monthly_hot_table_partition('worker_request_logs', DATE '2026-07-01');

COMMENT ON TABLE public.worker_request_logs_partitioned IS 'Partitioned shadow for worker_request_logs. Live cutover requires the approved maintenance-window rename-swap and one retention cycle with worker_request_logs_legacy retained.';
COMMENT ON FUNCTION public.backfill_hot_table_partition_shadow(text, integer) IS 'Copies live hot-table rows into the partitioned shadow in bounded batches without mutating the live table.';
COMMENT ON FUNCTION public.verify_hot_table_partition_shadow(text) IS 'Reports live/shadow counts and partition state for staging rehearsal and maintenance-window approval.';
