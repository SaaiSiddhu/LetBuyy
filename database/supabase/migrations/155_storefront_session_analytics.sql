-- Merchant mobile V2 #83: storefront session analytics.
-- Writer: services/api-gateway public storefront beacon route enqueues
-- analytics-events jobs; services/queue-workers projects those jobs into
-- analytics_event_stream and analytics_rollups_daily.

ALTER TABLE public.analytics_event_stream ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_event_stream FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_event_stream_service_all ON public.analytics_event_stream;
CREATE POLICY analytics_event_stream_service_all
  ON public.analytics_event_stream
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS analytics_event_stream_tenant_site_guc ON public.analytics_event_stream;
CREATE POLICY analytics_event_stream_tenant_site_guc
  ON public.analytics_event_stream
  FOR SELECT TO authenticated
  USING (site_id = public.current_site_id());

CREATE INDEX IF NOT EXISTS idx_analytics_event_stream_storefront_source
  ON public.analytics_event_stream (site_id, (properties->>'source'), occurred_at DESC)
  WHERE event_type LIKE 'storefront.%' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_event_stream_storefront_session
  ON public.analytics_event_stream (site_id, (properties->>'session_id'), occurred_at DESC)
  WHERE event_type LIKE 'storefront.%' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_rollups_daily_storefront_source
  ON public.analytics_rollups_daily (site_id, rollup_date DESC, (dimensions->>'source'))
  WHERE metric_name = 'storefront.traffic.source' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_rollups_daily_storefront_live
  ON public.analytics_rollups_daily (site_id, updated_at DESC, metric_name)
  WHERE metric_name LIKE 'storefront.%' AND deleted_at IS NULL;

COMMENT ON INDEX public.idx_analytics_event_stream_storefront_source IS
  'Supports #83 storefront session source attribution from projected analytics events.';

COMMENT ON INDEX public.idx_analytics_rollups_daily_storefront_source IS
  'Supports #83 merchant mobile traffic-source reports from storefront beacon rollups.';
