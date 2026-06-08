-- Mobile merchant business profile and invoice address fields.
-- Writer:
--   services/api-gateway/src/routes/stores.ts -> sites

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS business_profile jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS invoice_address jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS invoice_footer text,
  ADD COLUMN IF NOT EXISTS invoice_number_next integer DEFAULT 1 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sites_business_profile_object_check'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT sites_business_profile_object_check
      CHECK (jsonb_typeof(business_profile) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sites_invoice_address_object_check'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT sites_invoice_address_object_check
      CHECK (jsonb_typeof(invoice_address) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sites_invoice_number_next_positive_check'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT sites_invoice_number_next_positive_check
      CHECK (invoice_number_next > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sites_business_profile_gin
  ON public.sites USING gin (business_profile);

CREATE INDEX IF NOT EXISTS idx_sites_invoice_address_gin
  ON public.sites USING gin (invoice_address);
