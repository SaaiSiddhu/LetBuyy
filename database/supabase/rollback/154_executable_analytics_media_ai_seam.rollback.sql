-- Rollback for Task 016 analytics/media/AI seam additions.

DROP POLICY IF EXISTS ai_capability_seams_tenant_site_guc ON public.ai_capability_seams;
DROP TRIGGER IF EXISTS update_ai_capability_seams_updated_at ON public.ai_capability_seams;
DROP TABLE IF EXISTS public.ai_capability_seams;

DROP FUNCTION IF EXISTS public.refresh_commerce_analytics_daily_mv();
DROP MATERIALIZED VIEW IF EXISTS public.commerce_analytics_daily_mv;

DROP POLICY IF EXISTS analytics_rollups_daily_tenant_site_guc ON public.analytics_rollups_daily;
ALTER TABLE IF EXISTS public.analytics_rollups_daily NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_assets_tenant_site_guc ON public.media_assets;
ALTER TABLE IF EXISTS public.media_assets NO FORCE ROW LEVEL SECURITY;

DROP INDEX IF EXISTS public.media_assets_site_object_key_idx;
DROP INDEX IF EXISTS public.media_assets_site_status_idx;

ALTER TABLE IF EXISTS public.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_source_channel_check,
  DROP CONSTRAINT IF EXISTS media_assets_processing_status_check,
  DROP CONSTRAINT IF EXISTS media_assets_site_id_fkey;

ALTER TABLE IF EXISTS public.media_assets
  DROP COLUMN IF EXISTS source_channel,
  DROP COLUMN IF EXISTS checksum_sha256,
  DROP COLUMN IF EXISTS processed_at,
  DROP COLUMN IF EXISTS processing_status,
  DROP COLUMN IF EXISTS upload_intent_expires_at,
  DROP COLUMN IF EXISTS upload_token_hash,
  DROP COLUMN IF EXISTS object_key,
  DROP COLUMN IF EXISTS site_id;
