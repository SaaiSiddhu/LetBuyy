-- Rollback Task 011 transactional email additions.

DROP POLICY IF EXISTS sender_domains_tenant_site_guc ON public.sender_domains;
DROP POLICY IF EXISTS email_suppressions_tenant_site_guc ON public.email_suppressions;
DROP POLICY IF EXISTS email_logs_tenant_site_guc ON public.email_logs;

DROP TRIGGER IF EXISTS trg_sender_domains_updated_at ON public.sender_domains;
DROP TRIGGER IF EXISTS trg_email_suppressions_updated_at ON public.email_suppressions;
DROP TRIGGER IF EXISTS trg_email_logs_updated_at ON public.email_logs;

DROP INDEX IF EXISTS public.sender_domains_site_status_idx;
DROP INDEX IF EXISTS public.email_suppressions_site_lookup_idx;
DROP INDEX IF EXISTS public.email_logs_site_idempotency_key_uidx;
DROP INDEX IF EXISTS public.email_logs_site_template_created_idx;
DROP INDEX IF EXISTS public.email_logs_site_status_created_idx;

DROP TABLE IF EXISTS public.sender_domains;
DROP TABLE IF EXISTS public.email_suppressions;

DELETE FROM public.email_logs
WHERE email_type <> ALL (ARRAY[
    'verification',
    'magic_link',
    'password_reset',
    'store_created_success',
    'store_created_failure',
    'welcome',
    'order_confirmation',
    'order_shipped',
    'low_stock_alert',
    'subscription_renewal'
]::text[])
   OR status <> ALL (ARRAY['pending','sent','failed','bounced']::text[]);

ALTER TABLE IF EXISTS public.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_email_type_check,
  DROP CONSTRAINT IF EXISTS email_logs_status_check;

ALTER TABLE IF EXISTS public.email_logs
  ADD CONSTRAINT email_logs_email_type_check CHECK (
    email_type = ANY (ARRAY[
      'verification',
      'magic_link',
      'password_reset',
      'store_created_success',
      'store_created_failure',
      'welcome',
      'order_confirmation',
      'order_shipped',
      'low_stock_alert',
      'subscription_renewal'
    ]::text[])
  ),
  ADD CONSTRAINT email_logs_status_check CHECK (
    status = ANY (ARRAY['pending','sent','failed','bounced']::text[])
  );

ALTER TABLE IF EXISTS public.email_logs
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS trace_id,
  DROP COLUMN IF EXISTS request_id,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS provider_attempts,
  DROP COLUMN IF EXISTS provider,
  DROP COLUMN IF EXISTS locale,
  DROP COLUMN IF EXISTS template_key,
  DROP COLUMN IF EXISTS recipient_hash,
  DROP COLUMN IF EXISTS site_id;

ALTER TABLE IF EXISTS public.email_logs NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_email_logs ON public.email_logs;
CREATE POLICY service_role_email_logs ON public.email_logs USING (true) WITH CHECK (true);
