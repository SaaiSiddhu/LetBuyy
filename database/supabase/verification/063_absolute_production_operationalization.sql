-- Phase 4 ultimate operational verification.
-- Execute against the Supabase production database after migration 063 is applied.

DO $$
DECLARE
  missing_table TEXT;
  missing_function TEXT;
BEGIN
  FOREACH missing_table IN ARRAY ARRAY[
    'production_readiness_gate_runs',
    'deployment_health_gate_results',
    'event_store_integrity_checks',
    'runtime_event_retention_policies',
    'operational_dashboard_snapshots',
    'sre_error_budget_snapshots',
    'security_enforcement_events',
    'regional_routing_overrides'
  ]
  LOOP
    IF to_regclass('public.' || missing_table) IS NULL THEN
      RAISE EXCEPTION 'missing production operational table: %', missing_table;
    END IF;
  END LOOP;

  FOREACH missing_function IN ARRAY ARRAY[
    'record_production_readiness_gate_run',
    'record_deployment_health_gate_result',
    'validate_event_stream_consistency',
    'archive_distributed_events',
    'record_operational_dashboard_snapshot',
    'record_sre_error_budget_snapshot',
    'record_security_enforcement_event',
    'record_regional_routing_override'
  ]
  LOOP
    IF to_regprocedure('public.' || missing_function || '(text,text,text,text,jsonb,text)') IS NULL
       AND missing_function = 'record_production_readiness_gate_run' THEN
      RAISE EXCEPTION 'missing production operational function: %', missing_function;
    END IF;
    IF missing_function <> 'record_production_readiness_gate_run'
       AND NOT EXISTS (
         SELECT 1
           FROM pg_proc
          WHERE pronamespace = 'public'::regnamespace
            AND proname = missing_function
       ) THEN
      RAISE EXCEPTION 'missing production operational function: %', missing_function;
    END IF;
  END LOOP;
END;
$$;

SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'production_readiness_gate_runs',
     'deployment_health_gate_results',
     'event_store_integrity_checks',
     'runtime_event_retention_policies',
     'operational_dashboard_snapshots',
     'sre_error_budget_snapshots',
     'security_enforcement_events',
     'regional_routing_overrides'
   )
 ORDER BY table_name;

SELECT tablename
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN (
     'production_readiness_gate_runs',
     'deployment_health_gate_results',
     'event_store_integrity_checks',
     'runtime_event_retention_policies',
     'operational_dashboard_snapshots',
     'sre_error_budget_snapshots',
     'security_enforcement_events',
     'regional_routing_overrides'
   )
 GROUP BY tablename
 ORDER BY tablename;

SELECT validate_event_stream_consistency('phase4-ultimate-verification', 'production', 1);
