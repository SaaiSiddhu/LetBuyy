-- Task 010: V1 notification router, delivery logs, suppression, and webhook replay metadata.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id uuid,
  channel text NOT NULL,
  category text NOT NULL DEFAULT 'system',
  template_key text NOT NULL,
  event_type text,
  recipient jsonb NOT NULL DEFAULT '{}'::jsonb,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued',
  provider text,
  provider_message_id text,
  attempt_count integer NOT NULL DEFAULT 0,
  error_message text,
  request_id text,
  trace_id text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT notification_logs_channel_check CHECK (channel = ANY (ARRAY['whatsapp','sms','email','push','in_app']::text[])),
  CONSTRAINT notification_logs_status_check CHECK (status = ANY (ARRAY['queued','sent','failed','suppressed']::text[])),
  CONSTRAINT notification_logs_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT notification_logs_site_idempotency_key UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.notification_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  recipient_hash text NOT NULL,
  channel text NOT NULL,
  category text NOT NULL DEFAULT 'system',
  reason text NOT NULL,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT notification_suppressions_channel_check CHECK (channel = ANY (ARRAY['whatsapp','sms','email','push','in_app']::text[])),
  CONSTRAINT notification_suppressions_site_idempotency_key UNIQUE (site_id, idempotency_key)
);

ALTER TABLE public.webhook_subscriptions
  ADD COLUMN IF NOT EXISTS replay_window_seconds integer NOT NULL DEFAULT 300;

ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS nonce text,
  ADD COLUMN IF NOT EXISTS dlq_reason text;

UPDATE public.webhook_deliveries
SET nonce = COALESCE(nonce, event_id::text)
WHERE nonce IS NULL;

CREATE OR REPLACE FUNCTION public.set_webhook_delivery_nonce()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.nonce = COALESCE(NEW.nonce, NEW.event_id::text);
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'webhook_subscriptions_replay_window_seconds_check'
      AND conrelid = 'public.webhook_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.webhook_subscriptions
      ADD CONSTRAINT webhook_subscriptions_replay_window_seconds_check
      CHECK (replay_window_seconds BETWEEN 60 AND 86400);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_store_channel_category_uidx
  ON public.notification_preferences (user_id, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid), channel, category);

CREATE INDEX IF NOT EXISTS notification_logs_site_status_created_idx
  ON public.notification_logs (site_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_logs_site_channel_category_idx
  ON public.notification_logs (site_id, channel, category, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_suppressions_site_lookup_idx
  ON public.notification_suppressions (site_id, recipient_hash, channel, category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS webhook_deliveries_site_status_nonce_idx
  ON public.webhook_deliveries (site_id, status, nonce, created_at DESC);

DROP TRIGGER IF EXISTS trg_notification_logs_updated_at ON public.notification_logs;
CREATE TRIGGER trg_notification_logs_updated_at
  BEFORE UPDATE ON public.notification_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_notification_suppressions_updated_at ON public.notification_suppressions;
CREATE TRIGGER trg_notification_suppressions_updated_at
  BEFORE UPDATE ON public.notification_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_webhook_deliveries_set_nonce ON public.webhook_deliveries;
CREATE TRIGGER trg_webhook_deliveries_set_nonce
  BEFORE INSERT OR UPDATE ON public.webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_webhook_delivery_nonce();

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notification_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_suppressions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_logs_tenant_site_guc ON public.notification_logs;
CREATE POLICY notification_logs_tenant_site_guc
  ON public.notification_logs
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS notification_suppressions_tenant_site_guc ON public.notification_suppressions;
CREATE POLICY notification_suppressions_tenant_site_guc
  ON public.notification_suppressions
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS webhook_subscriptions_tenant_site_guc ON public.webhook_subscriptions;
CREATE POLICY webhook_subscriptions_tenant_site_guc
  ON public.webhook_subscriptions
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS webhook_deliveries_tenant_site_guc ON public.webhook_deliveries;
CREATE POLICY webhook_deliveries_tenant_site_guc
  ON public.webhook_deliveries
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS notification_preferences_tenant_store_guc ON public.notification_preferences;
CREATE POLICY notification_preferences_tenant_store_guc
  ON public.notification_preferences
  FOR ALL
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());
