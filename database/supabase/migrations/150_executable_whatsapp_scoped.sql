-- Task 012: V1 scoped WhatsApp lifecycle, COD confirmation, and DPDP opt-in ledger.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.customer_whatsapp_messages
  DROP CONSTRAINT IF EXISTS customer_whatsapp_messages_template_check;

ALTER TABLE public.customer_whatsapp_messages
  ADD CONSTRAINT customer_whatsapp_messages_template_check
  CHECK (
    template IS NULL OR template = ANY (ARRAY[
      'order_update',
      'order_paid',
      'order_shipped',
      'order_delivered',
      'shipping_update',
      'cod_confirmation',
      'abandoned_cart',
      'custom_message'
    ]::text[])
  );

CREATE TABLE IF NOT EXISTS public.wa_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  category text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT wa_templates_key_check CHECK (
    template_key = ANY (ARRAY[
      'order_update',
      'order_paid',
      'order_shipped',
      'order_delivered',
      'shipping_update',
      'cod_confirmation',
      'abandoned_cart',
      'custom_message'
    ]::text[])
  ),
  CONSTRAINT wa_templates_category_check CHECK (category = ANY (ARRAY['lifecycle','cod_confirmation','cart_abandonment','custom']::text[])),
  CONSTRAINT wa_templates_status_check CHECK (status = ANY (ARRAY['active','paused','archived']::text[])),
  CONSTRAINT wa_templates_site_key UNIQUE (site_id, template_key),
  CONSTRAINT wa_templates_site_idempotency_key UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.wa_optins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_email text,
  customer_phone text NOT NULL,
  consent_status text NOT NULL,
  consent_source text NOT NULL DEFAULT 'manual',
  dpdp_purpose text NOT NULL DEFAULT 'order_lifecycle_notifications',
  accepted_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT wa_optins_status_check CHECK (consent_status = ANY (ARRAY['opted_in','opted_out']::text[])),
  CONSTRAINT wa_optins_source_check CHECK (consent_source = ANY (ARRAY['checkout','order','webhook','manual']::text[])),
  CONSTRAINT wa_optins_phone_not_blank CHECK (length(btrim(customer_phone)) > 0),
  CONSTRAINT wa_optins_site_idempotency_key UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.wa_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  order_id uuid,
  session_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT wa_sessions_type_check CHECK (session_type = ANY (ARRAY['lifecycle','cod_confirmation','cart_abandonment']::text[])),
  CONSTRAINT wa_sessions_status_check CHECK (status = ANY (ARRAY['open','closed','expired','cancelled']::text[])),
  CONSTRAINT wa_sessions_phone_not_blank CHECK (length(btrim(customer_phone)) > 0),
  CONSTRAINT wa_sessions_site_idempotency_key UNIQUE (site_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_email text,
  customer_phone text NOT NULL,
  direction text NOT NULL,
  template_key text,
  body text NOT NULL,
  provider text NOT NULL DEFAULT 'letbuyy_sandbox',
  provider_message_id text,
  status text NOT NULL DEFAULT 'queued',
  order_id uuid,
  event_type text,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT whatsapp_messages_direction_check CHECK (direction = ANY (ARRAY['outbound','inbound']::text[])),
  CONSTRAINT whatsapp_messages_status_check CHECK (status = ANY (ARRAY['queued','sent','delivered','read','failed','received']::text[])),
  CONSTRAINT whatsapp_messages_template_check CHECK (
    template_key IS NULL OR template_key = ANY (ARRAY[
      'order_update',
      'order_paid',
      'order_shipped',
      'order_delivered',
      'shipping_update',
      'cod_confirmation',
      'abandoned_cart',
      'custom_message'
    ]::text[])
  ),
  CONSTRAINT whatsapp_messages_phone_not_blank CHECK (length(btrim(customer_phone)) > 0),
  CONSTRAINT whatsapp_messages_body_not_blank CHECK (length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS wa_templates_site_status_idx
  ON public.wa_templates (site_id, status, template_key)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wa_optins_site_phone_idx
  ON public.wa_optins (site_id, customer_phone, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wa_optins_site_email_idx
  ON public.wa_optins (site_id, customer_email, created_at DESC)
  WHERE customer_email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS wa_sessions_site_type_status_idx
  ON public.wa_sessions (site_id, session_type, status, expires_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_site_phone_idx
  ON public.whatsapp_messages (site_id, customer_phone, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_message_uidx
  ON public.whatsapp_messages (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_site_idempotency_uidx
  ON public.whatsapp_messages (site_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_wa_templates_updated_at ON public.wa_templates;
CREATE TRIGGER trg_wa_templates_updated_at
  BEFORE UPDATE ON public.wa_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_wa_optins_updated_at ON public.wa_optins;
CREATE TRIGGER trg_wa_optins_updated_at
  BEFORE UPDATE ON public.wa_optins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_wa_sessions_updated_at ON public.wa_sessions;
CREATE TRIGGER trg_wa_sessions_updated_at
  BEFORE UPDATE ON public.wa_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_messages_updated_at ON public.whatsapp_messages;
CREATE TRIGGER trg_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.customer_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_whatsapp_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.wa_optins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_optins FORCE ROW LEVEL SECURITY;

ALTER TABLE public.wa_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_whatsapp_messages_service_all ON public.customer_whatsapp_messages;
DROP POLICY IF EXISTS customer_whatsapp_messages_site_owner_all ON public.customer_whatsapp_messages;
DROP POLICY IF EXISTS customer_whatsapp_messages_tenant_site_guc ON public.customer_whatsapp_messages;
CREATE POLICY customer_whatsapp_messages_tenant_site_guc
  ON public.customer_whatsapp_messages
  FOR ALL
  USING (store_id = public.current_site_id())
  WITH CHECK (store_id = public.current_site_id());

DROP POLICY IF EXISTS wa_templates_tenant_site_guc ON public.wa_templates;
CREATE POLICY wa_templates_tenant_site_guc
  ON public.wa_templates
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS wa_optins_tenant_site_guc ON public.wa_optins;
CREATE POLICY wa_optins_tenant_site_guc
  ON public.wa_optins
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS wa_sessions_tenant_site_guc ON public.wa_sessions;
CREATE POLICY wa_sessions_tenant_site_guc
  ON public.wa_sessions
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());

DROP POLICY IF EXISTS whatsapp_messages_tenant_site_guc ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_tenant_site_guc
  ON public.whatsapp_messages
  FOR ALL
  USING (site_id = public.current_site_id())
  WITH CHECK (site_id = public.current_site_id());
