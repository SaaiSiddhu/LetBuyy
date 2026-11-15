-- Reverse only while no merchant metadata would be lost. Dependency checks remain enabled.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.products IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM public.products WHERE metadata IS DISTINCT FROM '{}'::jsonb) THEN
    RAISE EXCEPTION 'rollback 157 refuses: product metadata exists; preserve data and forward-fix'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
DROP INDEX public.idx_products_metadata_gin;
ALTER TABLE public.products DROP CONSTRAINT products_metadata_object_check, DROP COLUMN metadata;
COMMIT;
