-- Mobile merchant KYC document capture.
-- Writer:
--   services/api-gateway/src/routes/kyc.ts -> merchant_kyc_documents

CREATE TABLE IF NOT EXISTS public.merchant_kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  provider text DEFAULT 'letbuyy_sandbox_kyc'::text NOT NULL,
  provider_mode text DEFAULT 'sandbox'::text NOT NULL,
  provider_reference text,
  document_number_last4 text,
  file_url text,
  file_name text,
  rejection_reason text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  submitted_by uuid,
  reviewed_by uuid,
  submitted_at timestamp with time zone,
  verified_at timestamp with time zone,
  rejected_at timestamp with time zone,
  created_by uuid,
  updated_by uuid,
  deleted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone,
  CONSTRAINT merchant_kyc_documents_type_check
    CHECK (document_type = ANY (ARRAY[
      'business_pan'::text,
      'gst_certificate'::text,
      'bank_proof'::text,
      'address_proof'::text,
      'identity_proof'::text
    ])),
  CONSTRAINT merchant_kyc_documents_status_check
    CHECK (status = ANY (ARRAY[
      'draft'::text,
      'submitted'::text,
      'needs_review'::text,
      'verified'::text,
      'rejected'::text
    ])),
  CONSTRAINT merchant_kyc_documents_provider_mode_check
    CHECK (provider_mode = ANY (ARRAY['sandbox'::text, 'live'::text])),
  CONSTRAINT merchant_kyc_documents_last4_check
    CHECK (document_number_last4 IS NULL OR document_number_last4 ~ '^[A-Za-z0-9]{2,8}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_kyc_documents_site_type
  ON public.merchant_kyc_documents(site_id, document_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_kyc_documents_site_status
  ON public.merchant_kyc_documents(site_id, status, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_kyc_documents_provider_reference
  ON public.merchant_kyc_documents(provider, provider_reference)
  WHERE provider_reference IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_merchant_kyc_documents_updated_at ON public.merchant_kyc_documents;
CREATE TRIGGER update_merchant_kyc_documents_updated_at
  BEFORE UPDATE ON public.merchant_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.merchant_kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS merchant_kyc_documents_service_all ON public.merchant_kyc_documents;
CREATE POLICY merchant_kyc_documents_service_all ON public.merchant_kyc_documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS merchant_kyc_documents_site_owner_all ON public.merchant_kyc_documents;
CREATE POLICY merchant_kyc_documents_site_owner_all ON public.merchant_kyc_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = merchant_kyc_documents.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sites
      WHERE sites.id = merchant_kyc_documents.site_id
        AND (sites.user_id = auth.uid() OR sites.custom_user_id = auth.uid())
        AND sites.deleted_at IS NULL
    )
  );
