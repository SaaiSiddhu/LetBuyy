-- Phase 4 true-live certification verification.

SELECT
    c.relname,
    c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'operational_certification_reports';

SELECT
    proname
FROM pg_proc
WHERE proname = 'record_operational_certification_report';

SELECT
    policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'operational_certification_reports'
  AND policyname = 'operational_certification_reports_service_all';
