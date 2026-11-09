BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.support_tickets IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM public.support_tickets WHERE topic = 'privacy') THEN
    RAISE EXCEPTION 'rollback 261 refuses: privacy requests exist; preserve requests and forward-fix'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_topic_check;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_topic_check
  CHECK (topic = ANY (ARRAY['billing'::text, 'technical'::text, 'abuse'::text, 'onboarding'::text, 'payments'::text, 'orders'::text, 'themes'::text, 'apps'::text, 'general'::text]));
COMMIT;
