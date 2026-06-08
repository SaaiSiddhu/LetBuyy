-- Mobile tax settings parity.
-- Single writer: services/api-gateway/src/routes/shipping-tax.ts -> tax_rates.

ALTER TABLE public.tax_rates
  ADD COLUMN IF NOT EXISTS hsn_code text,
  ADD COLUMN IF NOT EXISTS applies_to text DEFAULT 'all' NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;

UPDATE public.tax_rates
SET applies_to = CASE
  WHEN applies_to IS NOT NULL AND btrim(applies_to) <> '' THEN applies_to
  WHEN is_shipping IS TRUE THEN 'shipping'
  ELSE 'all'
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_rates_applies_to_check'
  ) THEN
    ALTER TABLE public.tax_rates
      ADD CONSTRAINT tax_rates_applies_to_check
      CHECK (applies_to IN ('all', 'shipping', 'products'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_rates_hsn_code_check'
  ) THEN
    ALTER TABLE public.tax_rates
      ADD CONSTRAINT tax_rates_hsn_code_check
      CHECK (hsn_code IS NULL OR length(btrim(hsn_code)) <= 20);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tax_rates_store_applies_active
  ON public.tax_rates (store_id, applies_to, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tax_rates_store_hsn
  ON public.tax_rates (store_id, hsn_code)
  WHERE hsn_code IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_tax_rates_updated_at ON public.tax_rates;
CREATE TRIGGER update_tax_rates_updated_at
  BEFORE UPDATE ON public.tax_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
