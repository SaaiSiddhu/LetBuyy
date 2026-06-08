-- Mobile merchant WhatsApp commerce timeline.
-- Writer: services/api-gateway/src/routes/whatsapp.ts

CREATE TABLE IF NOT EXISTS public.customer_whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_email text,
  customer_phone text NOT NULL,
  direction text NOT NULL,
  template text,
  message text NOT NULL,
  provider text DEFAULT 'letbuyy_sandbox'::text NOT NULL,
  provider_message_id text,
  status text DEFAULT 'queued'::text NOT NULL,
  idempotency_key text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT customer_whatsapp_messages_direction_check
    CHECK (direction = ANY (ARRAY['outbound'::text, 'inbound'::text])),
  CONSTRAINT customer_whatsapp_messages_status_check
    CHECK (status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'received'::text])),
  CONSTRAINT customer_whatsapp_messages_template_check
    CHECK (template IS NULL OR template = ANY (ARRAY['order_update'::text, 'shipping_update'::text, 'abandoned_cart'::text, 'custom_message'::text])),
  CONSTRAINT customer_whatsapp_messages_phone_not_blank
    CHECK (length(btrim(customer_phone)) > 0),
  CONSTRAINT customer_whatsapp_messages_message_not_blank
    CHECK (length(btrim(message)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_customer_whatsapp_messages_store_email
  ON public.customer_whatsapp_messages(store_id, customer_email, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_whatsapp_messages_store_phone
  ON public.customer_whatsapp_messages(store_id, customer_phone, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_whatsapp_messages_provider_message
  ON public.customer_whatsapp_messages(provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_whatsapp_messages_store_idempotency
  ON public.customer_whatsapp_messages(store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_customer_whatsapp_messages_updated_at ON public.customer_whatsapp_messages;
CREATE TRIGGER update_customer_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.customer_whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.customer_whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_whatsapp_messages_service_all ON public.customer_whatsapp_messages;
CREATE POLICY customer_whatsapp_messages_service_all ON public.customer_whatsapp_messages
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_whatsapp_messages_site_owner_all ON public.customer_whatsapp_messages;
CREATE POLICY customer_whatsapp_messages_site_owner_all ON public.customer_whatsapp_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = customer_whatsapp_messages.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = customer_whatsapp_messages.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
