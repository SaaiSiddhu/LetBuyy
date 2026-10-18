-- A verified challenge is durable approval history; never downgrade it to an
-- unbound proof or discard encrypted retry custody after use.
BEGIN;
LOCK TABLE public.step_up_challenges IN ACCESS EXCLUSIVE MODE;
DO $guard$DECLARE p pg_catalog.pg_proc;BEGIN
 IF EXISTS(SELECT 1 FROM public.step_up_challenges WHERE merchant_result_ciphertext IS NOT NULL)THEN RAISE EXCEPTION 'rollback340 refuses merchant challenge history; use forward repair';END IF;
 IF(SELECT count(*)FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('issue_merchant_step_up_v1','verify_merchant_step_up_v1'))<>2 THEN RAISE EXCEPTION 'rollback340 refuses changed challenge ABI';END IF;
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('public.issue_merchant_step_up_v1(uuid,uuid,uuid,text,text,text,jsonb)');
 IF p.oid IS NULL OR p.prorettype<>'jsonb'::regtype OR p.proretset OR p.prokind<>'f'OR array_to_string(p.proargnames,',')IS DISTINCT FROM 'p_site,p_actor,p_factor,p_action,p_key,p_factor_sha256,p_proof'THEN RAISE EXCEPTION 'rollback340 refuses changed issuance ABI';END IF;
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('public.verify_merchant_step_up_v1(uuid,uuid,text,jsonb)');
 IF p.oid IS NULL OR p.prorettype<>'boolean'::regtype OR p.proretset OR p.prokind<>'f'OR array_to_string(p.proargnames,',')IS DISTINCT FROM 'p_site,p_actor,p_action,p_evidence'THEN RAISE EXCEPTION 'rollback340 refuses changed verification ABI';END IF;
END $guard$;
DROP FUNCTION public.issue_merchant_step_up_v1(uuid,uuid,uuid,text,text,text,jsonb);
DROP FUNCTION public.verify_merchant_step_up_v1(uuid,uuid,text,jsonb);
ALTER TABLE public.step_up_challenges DROP COLUMN merchant_result_ciphertext;
COMMIT;
