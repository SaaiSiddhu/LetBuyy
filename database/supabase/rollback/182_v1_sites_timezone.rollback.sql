BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.sites IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM public.sites WHERE timezone IS DISTINCT FROM 'Asia/Kolkata') THEN
    RAISE EXCEPTION 'rollback 182 refuses: saved timezones exist; preserve data and forward-fix'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
ALTER TABLE public.sites DROP CONSTRAINT sites_timezone_nonempty_check, DROP COLUMN timezone;
COMMIT;
