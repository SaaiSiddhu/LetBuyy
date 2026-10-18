BEGIN;

ALTER TABLE public.products
  ADD COLUMN importer_details text,
  ADD CONSTRAINT products_importer_details_length_check
    CHECK (importer_details IS NULL OR char_length(btrim(importer_details)) <= 1000);

COMMENT ON COLUMN public.products.importer_details IS
  'Seller-entered public importer name and contact/address disclosure when applicable; not independently verified.';

COMMIT;
