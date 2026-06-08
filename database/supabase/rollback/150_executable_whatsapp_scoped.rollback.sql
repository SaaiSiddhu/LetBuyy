-- Rollback Task 012 scoped WhatsApp additions.

DROP POLICY IF EXISTS whatsapp_messages_tenant_site_guc ON public.whatsapp_messages;
DROP POLICY IF EXISTS wa_sessions_tenant_site_guc ON public.wa_sessions;
DROP POLICY IF EXISTS wa_optins_tenant_site_guc ON public.wa_optins;
DROP POLICY IF EXISTS wa_templates_tenant_site_guc ON public.wa_templates;
DROP POLICY IF EXISTS customer_whatsapp_messages_tenant_site_guc ON public.customer_whatsapp_messages;

DROP TRIGGER IF EXISTS trg_whatsapp_messages_updated_at ON public.whatsapp_messages;
DROP TRIGGER IF EXISTS trg_wa_sessions_updated_at ON public.wa_sessions;
DROP TRIGGER IF EXISTS trg_wa_optins_updated_at ON public.wa_optins;
DROP TRIGGER IF EXISTS trg_wa_templates_updated_at ON public.wa_templates;

DROP INDEX IF EXISTS public.whatsapp_messages_site_idempotency_uidx;
DROP INDEX IF EXISTS public.whatsapp_messages_provider_message_uidx;
DROP INDEX IF EXISTS public.whatsapp_messages_site_phone_idx;
DROP INDEX IF EXISTS public.wa_sessions_site_type_status_idx;
DROP INDEX IF EXISTS public.wa_optins_site_email_idx;
DROP INDEX IF EXISTS public.wa_optins_site_phone_idx;
DROP INDEX IF EXISTS public.wa_templates_site_status_idx;

DROP TABLE IF EXISTS public.whatsapp_messages;
DROP TABLE IF EXISTS public.wa_sessions;
DROP TABLE IF EXISTS public.wa_optins;
DROP TABLE IF EXISTS public.wa_templates;

DELETE FROM public.customer_whatsapp_messages
WHERE template IS NOT NULL
  AND template <> ALL (ARRAY['order_update','shipping_update','abandoned_cart','custom_message']::text[]);

ALTER TABLE IF EXISTS public.customer_whatsapp_messages
  DROP CONSTRAINT IF EXISTS customer_whatsapp_messages_template_check;

ALTER TABLE IF EXISTS public.customer_whatsapp_messages
  ADD CONSTRAINT customer_whatsapp_messages_template_check
  CHECK (
    template IS NULL OR template = ANY (ARRAY[
      'order_update'::text,
      'shipping_update'::text,
      'abandoned_cart'::text,
      'custom_message'::text
    ])
  );

ALTER TABLE IF EXISTS public.customer_whatsapp_messages NO FORCE ROW LEVEL SECURITY;

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
