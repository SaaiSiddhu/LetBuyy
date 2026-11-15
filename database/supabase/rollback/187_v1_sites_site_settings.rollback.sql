BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.sites IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM public.sites WHERE site_settings IS DISTINCT FROM '{}'::jsonb) THEN
    RAISE EXCEPTION 'rollback 187 refuses: saved appearance settings exist; preserve data and forward-fix'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
ALTER TABLE public.sites DROP COLUMN site_settings;
COMMIT;
