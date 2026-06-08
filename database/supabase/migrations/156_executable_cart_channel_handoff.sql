-- LetBuyy Executable Architecture V1 Task 002 cart extensions.
-- Additive server-authoritative cart metadata: channel, buyer identity,
-- signed checkout handoff evidence, and abandonment-check enqueue marker.

ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS buyer_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS checkout_handoff jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS abandonment_enqueued_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'carts_channel_check'
      AND conrelid = 'public.carts'::regclass
  ) THEN
    ALTER TABLE public.carts
      ADD CONSTRAINT carts_channel_check
      CHECK (channel IN ('web', 'whatsapp', 'instagram', 'pos', 'api'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_carts_store_channel_status
  ON public.carts (store_id, channel, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_carts_buyer_email
  ON public.carts (store_id, lower(buyer_email))
  WHERE buyer_email IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carts_tenant_site_guc ON public.carts;
CREATE POLICY carts_tenant_site_guc
  ON public.carts
  FOR ALL
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());
