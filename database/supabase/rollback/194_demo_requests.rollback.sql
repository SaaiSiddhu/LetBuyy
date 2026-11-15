BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.demo_requests IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM public.demo_requests) THEN
    RAISE EXCEPTION 'rollback 194 refuses: demo requests exist; preserve leads and forward-fix'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
DROP TRIGGER demo_requests_touch_updated_at ON public.demo_requests;
DROP TABLE public.demo_requests;
DROP FUNCTION public.touch_demo_requests_updated_at();
COMMIT;
