-- Rollback for 155_storefront_session_analytics.sql.

DROP INDEX IF EXISTS public.idx_analytics_rollups_daily_storefront_live;
DROP INDEX IF EXISTS public.idx_analytics_rollups_daily_storefront_source;
DROP INDEX IF EXISTS public.idx_analytics_event_stream_storefront_session;
DROP INDEX IF EXISTS public.idx_analytics_event_stream_storefront_source;

DROP POLICY IF EXISTS analytics_event_stream_tenant_site_guc ON public.analytics_event_stream;
DROP POLICY IF EXISTS analytics_event_stream_service_all ON public.analytics_event_stream;

ALTER TABLE IF EXISTS public.analytics_event_stream NO FORCE ROW LEVEL SECURITY;
