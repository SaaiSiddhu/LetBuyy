-- LetBuyy Executable Architecture V1 Task 016.
-- Right-sized observability/analytics/media finalization: in-DB commerce
-- analytics materialized view, signed media upload metadata on the existing
-- media_assets table, and an AI capability seam with no model execution.

ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS site_id uuid,
  ADD COLUMN IF NOT EXISTS object_key text,
  ADD COLUMN IF NOT EXISTS upload_token_hash text,
  ADD COLUMN IF NOT EXISTS upload_intent_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS checksum_sha256 text,
  ADD COLUMN IF NOT EXISTS source_channel text NOT NULL DEFAULT 'web';

UPDATE public.media_assets
SET site_id = store_id
WHERE site_id IS NULL;

UPDATE public.media_assets
SET object_key = storage_path
WHERE object_key IS NULL;

ALTER TABLE public.media_assets
  ALTER COLUMN site_id SET NOT NULL,
  ALTER COLUMN object_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_site_id_fkey'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_processing_status_check'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_processing_status_check
      CHECK (processing_status IN ('pending', 'processed', 'failed', 'deleted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'media_assets_source_channel_check'
      AND conrelid = 'public.media_assets'::regclass
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_source_channel_check
      CHECK (source_channel IN ('web', 'whatsapp', 'instagram', 'pos', 'api'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS media_assets_site_status_idx
  ON public.media_assets(site_id, processing_status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS media_assets_site_object_key_idx
  ON public.media_assets(site_id, object_key)
  WHERE deleted_at IS NULL;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS media_assets_tenant_site_guc ON public.media_assets;
CREATE POLICY media_assets_tenant_site_guc
  ON public.media_assets
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

ALTER TABLE public.analytics_rollups_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_rollups_daily FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analytics_rollups_daily_tenant_site_guc ON public.analytics_rollups_daily;
CREATE POLICY analytics_rollups_daily_tenant_site_guc
  ON public.analytics_rollups_daily
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP MATERIALIZED VIEW IF EXISTS public.commerce_analytics_daily_mv;
CREATE MATERIALIZED VIEW public.commerce_analytics_daily_mv AS
SELECT
  site_id,
  rollup_date,
  COALESCE(SUM(metric_value) FILTER (WHERE metric_name = 'orders.created'), 0)::numeric(16,4) AS orders_created,
  COALESCE(SUM(metric_value) FILTER (WHERE metric_name = 'orders.paid'), 0)::numeric(16,4) AS orders_paid,
  COALESCE(SUM(metric_value) FILTER (WHERE metric_name = 'revenue.paid_minor'), 0)::numeric(16,4) AS revenue_paid_minor,
  COALESCE(SUM(metric_value) FILTER (WHERE metric_name = 'media.processed'), 0)::numeric(16,4) AS media_processed,
  COALESCE(SUM(metric_value) FILTER (WHERE metric_name = 'media.size_bytes'), 0)::numeric(16,4) AS media_size_bytes,
  MAX(updated_at) AS refreshed_from_rollups_at
FROM public.analytics_rollups_daily
WHERE deleted_at IS NULL
GROUP BY site_id, rollup_date;

CREATE UNIQUE INDEX commerce_analytics_daily_mv_site_date_idx
  ON public.commerce_analytics_daily_mv(site_id, rollup_date);

CREATE OR REPLACE FUNCTION public.refresh_commerce_analytics_daily_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.commerce_analytics_daily_mv;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ai_capability_seams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  mode text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'ready_for_interface',
  model_calls_enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'none',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT ai_capability_seams_mode_check CHECK (mode IN ('sandbox', 'live')),
  CONSTRAINT ai_capability_seams_status_check CHECK (status IN ('ready_for_interface', 'human_required', 'disabled')),
  CONSTRAINT ai_capability_seams_provider_check CHECK (provider IN ('none', 'human_required')),
  CONSTRAINT ai_capability_seams_no_model_calls_check CHECK (model_calls_enabled = false),
  UNIQUE (site_id, feature_key)
);

CREATE INDEX IF NOT EXISTS ai_capability_seams_site_status_idx
  ON public.ai_capability_seams(site_id, status, feature_key)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_ai_capability_seams_updated_at ON public.ai_capability_seams;
CREATE TRIGGER update_ai_capability_seams_updated_at
  BEFORE UPDATE ON public.ai_capability_seams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.ai_capability_seams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_capability_seams FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_capability_seams_tenant_site_guc ON public.ai_capability_seams;
CREATE POLICY ai_capability_seams_tenant_site_guc
  ON public.ai_capability_seams
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());
