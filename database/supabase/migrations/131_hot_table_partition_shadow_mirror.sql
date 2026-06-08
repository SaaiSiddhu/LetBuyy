-- 131_hot_table_partition_shadow_mirror.sql
-- Issue #50: the hot-table partition shadows must not sit inert.
-- This migration keeps the replayable expand-first model, but activates
-- live-to-shadow mirroring so new and updated rows feed the partitioned
-- parents before any human-approved rename-swap.

BEGIN;

CREATE OR REPLACE FUNCTION public.mirror_hot_table_partition_shadow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_policy public.retention_policies;
BEGIN
  SELECT *
    INTO v_policy
    FROM public.retention_policies
   WHERE target_table = TG_TABLE_NAME
     AND lifecycle_mode IN ('partition-shadow', 'partition-live')
     AND deleted_at IS NULL;

  IF v_policy.id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF to_regclass(format('public.%I', v_policy.shadow_table)) IS NULL THEN
    RAISE EXCEPTION 'partition shadow table % is missing', v_policy.shadow_table;
  END IF;

  IF TG_OP = 'DELETE' THEN
    EXECUTE format(
      'DELETE FROM public.%I WHERE id = ($1).id AND created_at = ($1).created_at',
      v_policy.shadow_table
    ) USING OLD;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    EXECUTE format(
      'DELETE FROM public.%I WHERE id = ($1).id AND created_at = ($1).created_at',
      v_policy.shadow_table
    ) USING NEW;
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I SELECT ($1).* ON CONFLICT DO NOTHING',
    v_policy.shadow_table
  ) USING NEW;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_hot_table_partition_shadow_mirror_enabled(
  p_enabled boolean DEFAULT true
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_statement text;
  v_trigger record;
  v_state text := CASE WHEN COALESCE(p_enabled, true) THEN 'ENABLE' ELSE 'DISABLE' END;
  v_changed text[] := ARRAY[]::text[];
BEGIN
  FOR v_trigger IN
    SELECT *
      FROM (VALUES
        ('worker_request_logs', 'mirror_worker_request_logs_partition_shadow'),
        ('runtime_telemetry_metrics', 'mirror_runtime_telemetry_metrics_partition_shadow'),
        ('outbox_events', 'mirror_outbox_events_partition_shadow'),
        ('platform_queue_jobs', 'mirror_platform_queue_jobs_partition_shadow'),
        ('webhook_deliveries', 'mirror_webhook_deliveries_partition_shadow')
      ) AS triggers(table_name, trigger_name)
  LOOP
    IF to_regclass(format('public.%I', v_trigger.table_name)) IS NOT NULL THEN
      v_statement := format(
        'ALTER TABLE public.%I %s TRIGGER %I',
        v_trigger.table_name,
        v_state,
        v_trigger.trigger_name
      );
      EXECUTE v_statement;
      v_changed := array_append(v_changed, v_trigger.table_name);
    END IF;
  END LOOP;

  UPDATE public.retention_policies
     SET notes = concat_ws(
           E'\n',
           NULLIF(notes, ''),
           format('Partition shadow mirror triggers %s at %s', lower(v_state), now())
         ),
         updated_at = now()
   WHERE target_table = ANY(v_changed)
     AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'enabled',
    COALESCE(p_enabled, true),
    'tables',
    v_changed
  );
END;
$$;

DROP TRIGGER IF EXISTS mirror_worker_request_logs_partition_shadow ON public.worker_request_logs;
CREATE TRIGGER mirror_worker_request_logs_partition_shadow
AFTER INSERT OR UPDATE OR DELETE ON public.worker_request_logs
FOR EACH ROW
EXECUTE FUNCTION public.mirror_hot_table_partition_shadow();

DROP TRIGGER IF EXISTS mirror_runtime_telemetry_metrics_partition_shadow ON public.runtime_telemetry_metrics;
CREATE TRIGGER mirror_runtime_telemetry_metrics_partition_shadow
AFTER INSERT OR UPDATE OR DELETE ON public.runtime_telemetry_metrics
FOR EACH ROW
EXECUTE FUNCTION public.mirror_hot_table_partition_shadow();

DROP TRIGGER IF EXISTS mirror_outbox_events_partition_shadow ON public.outbox_events;
CREATE TRIGGER mirror_outbox_events_partition_shadow
AFTER INSERT OR UPDATE OR DELETE ON public.outbox_events
FOR EACH ROW
EXECUTE FUNCTION public.mirror_hot_table_partition_shadow();

DROP TRIGGER IF EXISTS mirror_platform_queue_jobs_partition_shadow ON public.platform_queue_jobs;
CREATE TRIGGER mirror_platform_queue_jobs_partition_shadow
AFTER INSERT OR UPDATE OR DELETE ON public.platform_queue_jobs
FOR EACH ROW
EXECUTE FUNCTION public.mirror_hot_table_partition_shadow();

DROP TRIGGER IF EXISTS mirror_webhook_deliveries_partition_shadow ON public.webhook_deliveries;
CREATE TRIGGER mirror_webhook_deliveries_partition_shadow
AFTER INSERT OR UPDATE OR DELETE ON public.webhook_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.mirror_hot_table_partition_shadow();

UPDATE public.retention_policies
   SET notes = concat_ws(
         E'\n',
         NULLIF(notes, ''),
         'Issue #50: partition shadow mirror trigger is active. The live rename-swap remains human-gated and must use the approved maintenance-window runbook.'
       ),
       updated_at = now()
 WHERE target_table = ANY(ARRAY[
       'worker_request_logs',
       'runtime_telemetry_metrics',
       'outbox_events',
       'platform_queue_jobs',
       'webhook_deliveries'
     ])
   AND deleted_at IS NULL;

COMMENT ON FUNCTION public.mirror_hot_table_partition_shadow()
  IS 'Mirrors live hot-table INSERT/UPDATE/DELETE events into governed partition shadows so the shadows are active before the human-approved cutover.';

COMMENT ON FUNCTION public.set_hot_table_partition_shadow_mirror_enabled(boolean)
  IS 'Operational rollback switch for the hot-table shadow mirror triggers. Use only during an approved maintenance or incident window.';

COMMENT ON TRIGGER mirror_worker_request_logs_partition_shadow ON public.worker_request_logs
  IS 'Keeps worker_request_logs_partitioned active before the human-approved live table swap.';

COMMENT ON TRIGGER mirror_runtime_telemetry_metrics_partition_shadow ON public.runtime_telemetry_metrics
  IS 'Keeps runtime_telemetry_metrics_partitioned active before the human-approved live table swap.';

COMMENT ON TRIGGER mirror_outbox_events_partition_shadow ON public.outbox_events
  IS 'Keeps outbox_events_partitioned active before the human-approved live table swap.';

COMMENT ON TRIGGER mirror_platform_queue_jobs_partition_shadow ON public.platform_queue_jobs
  IS 'Keeps platform_queue_jobs_partitioned active before the human-approved live table swap.';

COMMENT ON TRIGGER mirror_webhook_deliveries_partition_shadow ON public.webhook_deliveries
  IS 'Keeps webhook_deliveries_partitioned active before the human-approved live table swap.';

COMMIT;
