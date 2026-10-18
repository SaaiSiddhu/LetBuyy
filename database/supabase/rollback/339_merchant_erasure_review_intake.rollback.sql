-- Intake history and the review-only route survive a rollback. No destructive
-- legacy handler or erasure policy is restored by this script.
BEGIN;
DO $guard$DECLARE p pg_catalog.pg_proc;BEGIN
 IF EXISTS(SELECT 1 FROM public.data_subject_requests WHERE metadata->>'policy_hold'='D05.4-8' AND idempotency_key LIKE 'merchant-erasure-review-v1:%')THEN
  RAISE EXCEPTION 'rollback339 refuses review intake history; use forward repair';END IF;
 IF to_regprocedure('public.request_merchant_erasure_review_v1(uuid,uuid,text,text,text,text)')IS NULL OR
  (SELECT count(*)FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='request_merchant_erasure_review_v1')<>1 THEN
  RAISE EXCEPTION 'rollback339 refuses changed review intake ABI';END IF;
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.request_merchant_erasure_review_v1(uuid,uuid,text,text,text,text)');
 IF p.oid IS NULL OR p.prokind<>'f' OR p.prorettype<>'jsonb'::regtype OR p.proretset OR array_to_string(p.proargnames,',')IS DISTINCT FROM 'p_site,p_actor,p_email,p_reason,p_key,p_request_id' THEN
  RAISE EXCEPTION 'rollback339 refuses changed command ABI';END IF;
END $guard$;
DROP FUNCTION public.request_merchant_erasure_review_v1(uuid,uuid,text,text,text,text);
COMMIT;
