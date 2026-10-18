-- Never restore an unguarded merchant claim route. Empty-history rollback
-- removes these unused transport guards and fails closed until forward reapply.
BEGIN;
LOCK TABLE public.audit_logs IN SHARE ROW EXCLUSIVE MODE;
DO $guard$DECLARE e record;p pg_catalog.pg_proc;BEGIN
 IF EXISTS(SELECT 1 FROM public.audit_logs WHERE action IN('merchant.payment_refund.authorized','merchant.payout_release.authorized'))THEN RAISE EXCEPTION 'rollback342 refuses merchant money authorization history; use forward repair';END IF;
 FOR e IN SELECT * FROM(VALUES
 ('reserve_owned_payment_refund_v1','public.reserve_owned_payment_refund_v1(uuid,uuid,uuid,bigint,text,jsonb,text,jsonb)','p_site_id,p_payment_id,p_actor_id,p_amount_minor,p_idempotency_key,p_step_up,p_request_id,p_metadata'),
 ('claim_owned_payout_release_v1','public.claim_owned_payout_release_v1(uuid,uuid,text,uuid,jsonb,text)','p_site_id,p_statement_id,p_idempotency_key,p_actor_id,p_step_up,p_request_id'))v(name,signature,args)LOOP
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(e.signature);
  IF p.oid IS NULL OR p.prokind<>'f'OR p.prorettype<>'jsonb'::regtype OR p.proretset OR array_to_string(p.proargnames,',')IS DISTINCT FROM e.args OR
   (SELECT count(*)FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=e.name)<>1 THEN RAISE EXCEPTION 'rollback342 refuses changed merchant claim ABI';END IF;
 END LOOP;
END $guard$;
DROP FUNCTION public.reserve_owned_payment_refund_v1(uuid,uuid,uuid,bigint,text,jsonb,text,jsonb);
DROP FUNCTION public.claim_owned_payout_release_v1(uuid,uuid,text,uuid,jsonb,text);
COMMIT;
