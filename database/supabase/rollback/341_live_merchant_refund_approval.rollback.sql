-- Fail closed on rollback: remove only the unused merchant wrapper. Never
-- restore the old unbound approval path or remove the canonical money writer.
BEGIN;
LOCK TABLE public.idempotency_keys IN SHARE ROW EXCLUSIVE MODE;
DO $guard$DECLARE p pg_catalog.pg_proc;BEGIN
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE scope LIKE 'owned-refund-complete-v1:%')THEN RAISE EXCEPTION 'rollback341 refuses refund completion history; use forward repair';END IF;
 SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure('public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text)');
 IF p.oid IS NULL OR p.prokind<>'f'OR p.prorettype<>'jsonb'::regtype OR p.proretset OR array_to_string(p.proargnames,',')IS DISTINCT FROM 'p_site_id,p_order_id,p_return_id,p_actor_id,p_intent,p_request_id'OR
 (SELECT count(*)FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='complete_owned_order_refund_v1')<>1 THEN RAISE EXCEPTION 'rollback341 refuses changed completion ABI';END IF;
END $guard$;
DROP FUNCTION public.complete_owned_order_refund_v1(uuid,uuid,uuid,uuid,jsonb,text);
COMMIT;
