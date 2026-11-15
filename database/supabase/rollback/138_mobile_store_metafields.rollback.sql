-- Pre-use recovery only. Retained merchant fields require backup restore or a forward fix.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.store_metafield_definitions, public.store_metafield_values IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM public.store_metafield_values)
    OR EXISTS (SELECT 1 FROM public.store_metafield_definitions) THEN
    RAISE EXCEPTION 'rollback 138 refuses: merchant metafields exist; preserve data and forward-fix'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
DROP TABLE public.store_metafield_values;
DROP TABLE public.store_metafield_definitions;
COMMIT;
