BEGIN;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE scope ~ '^http:(POST|PATCH):/stores/[^/]+/payment-config$'
  AND status='processing' AND locked_until>clock_timestamp() AND deleted_at IS NULL) THEN
  RAISE EXCEPTION '405 rollback requires payment configuration commands to drain';
 END IF;
END $guard$;
DROP FUNCTION public.commit_store_payment_configuration_v1(uuid,uuid,timestamptz,uuid,text,text,jsonb,boolean,jsonb);
NOTIFY pgrst,'reload schema';
COMMIT;
