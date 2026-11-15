-- Only the exact predecessor application, with privacy intake stopped, may use
-- this pre-use reverse. Keep the uniqueness guarantee while open requests exist.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.support_tickets IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM public.support_tickets WHERE topic = 'privacy'
    AND status NOT IN ('resolved', 'closed') AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'rollback 262 refuses: open privacy requests exist; retain idempotency enforcement'
      USING ERRCODE = '55000';
  END IF;
END $guard$;
DROP INDEX public.support_tickets_privacy_open_request_uidx;
COMMIT;
