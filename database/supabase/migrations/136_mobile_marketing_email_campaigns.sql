-- Mobile merchant marketing email campaigns.
-- Writer: services/api-gateway/src/routes/marketing.ts

CREATE TABLE IF NOT EXISTS public.marketing_email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  preview_text text,
  body_text text NOT NULL,
  body_html text,
  status text DEFAULT 'draft'::text NOT NULL,
  audience_type text DEFAULT 'all_marketing'::text NOT NULL,
  audience_segment_id uuid REFERENCES public.customer_segments(id) ON DELETE SET NULL,
  audience_rules jsonb DEFAULT '{}'::jsonb NOT NULL,
  manual_recipients text[] DEFAULT '{}'::text[] NOT NULL,
  recipient_count integer DEFAULT 0 NOT NULL,
  sent_count integer DEFAULT 0 NOT NULL,
  failed_count integer DEFAULT 0 NOT NULL,
  delivery_mode text DEFAULT 'sandbox'::text NOT NULL,
  provider text DEFAULT 'letbuyy_sandbox'::text NOT NULL,
  last_send_idempotency_key text,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT marketing_email_campaigns_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT marketing_email_campaigns_subject_not_blank CHECK (length(btrim(subject)) > 0),
  CONSTRAINT marketing_email_campaigns_body_text_not_blank CHECK (length(btrim(body_text)) > 0),
  CONSTRAINT marketing_email_campaigns_status_check
    CHECK (status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])),
  CONSTRAINT marketing_email_campaigns_audience_type_check
    CHECK (audience_type = ANY (ARRAY['all_marketing'::text, 'segment'::text, 'manual'::text])),
  CONSTRAINT marketing_email_campaigns_delivery_mode_check
    CHECK (delivery_mode = ANY (ARRAY['sandbox'::text, 'live'::text])),
  CONSTRAINT marketing_email_campaigns_audience_rules_object CHECK (jsonb_typeof(audience_rules) = 'object'),
  CONSTRAINT marketing_email_campaigns_manual_recipients_reasonable CHECK (cardinality(manual_recipients) <= 500),
  CONSTRAINT marketing_email_campaigns_counts_non_negative CHECK (recipient_count >= 0 AND sent_count >= 0 AND failed_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_marketing_email_campaigns_store_status
  ON public.marketing_email_campaigns(store_id, status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_email_campaigns_store_updated
  ON public.marketing_email_campaigns(store_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_email_campaigns_store_send_idempotency
  ON public.marketing_email_campaigns(store_id, last_send_idempotency_key)
  WHERE last_send_idempotency_key IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.marketing_email_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_email_campaigns(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_id uuid,
  status text DEFAULT 'queued'::text NOT NULL,
  provider text DEFAULT 'letbuyy_sandbox'::text NOT NULL,
  provider_message_id text,
  error_code text,
  error_message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT marketing_email_recipients_email_not_blank CHECK (length(btrim(customer_email)) > 0),
  CONSTRAINT marketing_email_recipients_status_check
    CHECK (status = ANY (ARRAY['queued'::text, 'sandbox_sent'::text, 'sent'::text, 'failed'::text, 'skipped'::text])),
  CONSTRAINT marketing_email_recipients_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_marketing_email_recipients_campaign
  ON public.marketing_email_recipients(campaign_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketing_email_recipients_store_email
  ON public.marketing_email_recipients(store_id, customer_email, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_email_recipients_campaign_email_active
  ON public.marketing_email_recipients(campaign_id, lower(customer_email))
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_marketing_email_campaigns_updated_at ON public.marketing_email_campaigns;
CREATE TRIGGER update_marketing_email_campaigns_updated_at
  BEFORE UPDATE ON public.marketing_email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_marketing_email_recipients_updated_at ON public.marketing_email_recipients;
CREATE TRIGGER update_marketing_email_recipients_updated_at
  BEFORE UPDATE ON public.marketing_email_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.marketing_email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_email_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_email_campaigns_service_all ON public.marketing_email_campaigns;
CREATE POLICY marketing_email_campaigns_service_all ON public.marketing_email_campaigns
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS marketing_email_recipients_service_all ON public.marketing_email_recipients;
CREATE POLICY marketing_email_recipients_service_all ON public.marketing_email_recipients
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS marketing_email_campaigns_site_owner_all ON public.marketing_email_campaigns;
CREATE POLICY marketing_email_campaigns_site_owner_all ON public.marketing_email_campaigns
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = marketing_email_campaigns.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = marketing_email_campaigns.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS marketing_email_recipients_site_owner_all ON public.marketing_email_recipients;
CREATE POLICY marketing_email_recipients_site_owner_all ON public.marketing_email_recipients
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = marketing_email_recipients.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = marketing_email_recipients.store_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
