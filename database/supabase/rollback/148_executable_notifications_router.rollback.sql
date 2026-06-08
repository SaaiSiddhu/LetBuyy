-- Rollback Task 010 notification router additions.

DROP POLICY IF EXISTS notification_preferences_tenant_store_guc ON public.notification_preferences;
DROP POLICY IF EXISTS webhook_deliveries_tenant_site_guc ON public.webhook_deliveries;
DROP POLICY IF EXISTS webhook_subscriptions_tenant_site_guc ON public.webhook_subscriptions;
DROP POLICY IF EXISTS notification_suppressions_tenant_site_guc ON public.notification_suppressions;
DROP POLICY IF EXISTS notification_logs_tenant_site_guc ON public.notification_logs;

ALTER TABLE IF EXISTS public.notification_preferences NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_deliveries NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_subscriptions NO FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_notification_suppressions_updated_at ON public.notification_suppressions;
DROP TRIGGER IF EXISTS trg_notification_logs_updated_at ON public.notification_logs;
DROP TRIGGER IF EXISTS trg_webhook_deliveries_set_nonce ON public.webhook_deliveries;
DROP FUNCTION IF EXISTS public.set_webhook_delivery_nonce();

DROP INDEX IF EXISTS public.webhook_deliveries_site_status_nonce_idx;
DROP INDEX IF EXISTS public.notification_suppressions_site_lookup_idx;
DROP INDEX IF EXISTS public.notification_logs_site_channel_category_idx;
DROP INDEX IF EXISTS public.notification_logs_site_status_created_idx;
DROP INDEX IF EXISTS public.notification_preferences_user_store_channel_category_uidx;

ALTER TABLE IF EXISTS public.webhook_subscriptions
  DROP CONSTRAINT IF EXISTS webhook_subscriptions_replay_window_seconds_check,
  DROP COLUMN IF EXISTS replay_window_seconds;

ALTER TABLE IF EXISTS public.webhook_deliveries
  DROP COLUMN IF EXISTS dlq_reason,
  DROP COLUMN IF EXISTS nonce;

DROP TABLE IF EXISTS public.notification_suppressions;
DROP TABLE IF EXISTS public.notification_logs;
