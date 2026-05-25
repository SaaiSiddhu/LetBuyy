-- Phase 4 enterprise SDLC lifecycle verification.

SELECT
    c.relname,
    c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'operational_feature_flags',
    'operational_feature_flag_audit_events',
    'operational_feature_flag_exposures',
    'rollout_stage_evidence',
    'shadow_traffic_comparison_runs',
    'sandbox_provider_contracts'
  );

SELECT
    proname
FROM pg_proc
WHERE proname IN (
    'record_operational_feature_flag_exposure',
    'record_rollout_stage_evidence'
);

SELECT
    tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'operational_feature_flags',
    'operational_feature_flag_audit_events',
    'operational_feature_flag_exposures',
    'rollout_stage_evidence',
    'shadow_traffic_comparison_runs',
    'sandbox_provider_contracts'
  )
  AND policyname LIKE '%_service_all';
