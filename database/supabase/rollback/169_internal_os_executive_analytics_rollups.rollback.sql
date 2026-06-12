-- Rollback migration 169: Internal OS executive analytics rollups.
-- Drops tables created by 169_internal_os_executive_analytics_rollups.sql.

DROP TABLE IF EXISTS public.funnel_steps CASCADE;
DROP TABLE IF EXISTS public.cohort_snapshots CASCADE;
DROP TABLE IF EXISTS public.mrr_arr_rollups CASCADE;
DROP TABLE IF EXISTS public.metric_rollups CASCADE;
