-- Mobile product metadata for merchant-managed product specifications.
-- Writer: services/api-gateway/src/routes/products.ts

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_metadata_object_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_metadata_object_check
      CHECK (jsonb_typeof(metadata) = 'object');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_products_metadata_gin
  ON public.products USING gin (metadata)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.products.metadata IS
  'Merchant-managed product metadata such as product specifications. Written only through services/api-gateway/src/routes/products.ts.';
