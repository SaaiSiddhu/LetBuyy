BEGIN;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_importer_details_length_check,
  DROP COLUMN IF EXISTS importer_details;

COMMIT;
