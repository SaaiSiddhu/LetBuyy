-- Task 011: V1 transactional email render/send, suppression, failover, and sender-domain controls.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient_hash text,
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en-IN',
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

UPDATE public.email_logs
SET
  template_key = COALESCE(template_key, email_type),
  recipient_hash = COALESCE(recipient_hash, encode(digest(lower(recipient_email), 'sha256'), 'hex')),
  updated_at = COALESCE(updated_at, created_at, now())
WHERE template_key IS NULL
   OR recipient_hash IS NULL
   OR updated_at IS NULL;

ALTER TABLE public.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_email_type_check,
  DROP CONSTRAINT IF EXISTS email_logs_status_check;

ALTER TABLE public.email_logs
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
      'subscription_renewal',
      'passwordless_otp',
      'billing_invoice',
      'shipment_update',
      'cart_abandoned',
      'system'
    ]::text[])
  ),
  ADD CONSTRAINT email_logs_status_check CHECK (
    status = ANY (ARRAY['pending','sent','delivered','failed','bounced','complained','suppressed']::text[])
  );

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  email_hash text NOT NULL,
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT email_suppressions_reason_check CHECK (reason = ANY (ARRAY['bounce','complaint','unsubscribe','manual','suppressed']::text[])),
  CONSTRAINT email_suppressions_site_idempotency_key UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.sender_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  dkim_status text NOT NULL DEFAULT 'pending',
  spf_status text NOT NULL DEFAULT 'pending',
  dmarc_status text NOT NULL DEFAULT 'pending',
  from_rewrite_domain text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT sender_domains_status_check CHECK (status = ANY (ARRAY['pending','verified','failed']::text[])),
  CONSTRAINT sender_domains_dkim_status_check CHECK (dkim_status = ANY (ARRAY['pending','verified','failed']::text[])),
  CONSTRAINT sender_domains_spf_status_check CHECK (spf_status = ANY (ARRAY['pending','verified','failed']::text[])),
  CONSTRAINT sender_domains_dmarc_status_check CHECK (dmarc_status = ANY (ARRAY['pending','verified','failed']::text[])),
  CONSTRAINT sender_domains_domain_lower_check CHECK (domain = lower(domain)),
  CONSTRAINT sender_domains_site_domain UNIQUE (site_id, domain),
  CONSTRAINT sender_domains_site_idempotency_key UNIQUE (site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS email_logs_site_status_created_idx
  ON public.email_logs (site_id, status, created_at DESC)
  WHERE site_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS email_logs_site_template_created_idx
  ON public.email_logs (site_id, template_key, created_at DESC)
  WHERE site_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_logs_site_idempotency_key_uidx
  ON public.email_logs (site_id, idempotency_key)
  WHERE site_id IS NOT NULL AND idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS email_suppressions_site_lookup_idx
  ON public.email_suppressions (site_id, email_hash, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sender_domains_site_status_idx
  ON public.sender_domains (site_id, status, domain)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_email_logs_updated_at ON public.email_logs;
CREATE TRIGGER trg_email_logs_updated_at
  BEFORE UPDATE ON public.email_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_email_suppressions_updated_at ON public.email_suppressions;
CREATE TRIGGER trg_email_suppressions_updated_at
  BEFORE UPDATE ON public.email_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_sender_domains_updated_at ON public.sender_domains;
CREATE TRIGGER trg_sender_domains_updated_at
  BEFORE UPDATE ON public.sender_domains
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sender_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sender_domains FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_email_logs ON public.email_logs;
DROP POLICY IF EXISTS email_logs_tenant_site_guc ON public.email_logs;
CREATE POLICY email_logs_tenant_site_guc
  ON public.email_logs
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS email_suppressions_tenant_site_guc ON public.email_suppressions;
CREATE POLICY email_suppressions_tenant_site_guc
  ON public.email_suppressions
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS sender_domains_tenant_site_guc ON public.sender_domains;
CREATE POLICY sender_domains_tenant_site_guc
  ON public.sender_domains
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());
