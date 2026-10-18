-- Never discard the authority behind retained money-break consent or receipts.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:316:money-approval',0));
DO $retention$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.sensitive_action_approvals'::regclass AND attname='protocol_version' AND NOT attisdropped) THEN
   IF EXISTS(SELECT 1 FROM public.sensitive_action_approvals WHERE protocol_version=1 AND action='money.reconciliation.resolve') THEN
    RAISE EXCEPTION 'rollback316 refuses retained money approval evidence; forward recovery is required';
   END IF;
  END IF;
END $retention$;
DROP FUNCTION IF EXISTS public.execute_console_money_resolution_v1(uuid,text,text,uuid,uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.create_console_money_approval_v1(uuid,text,text,uuid,text,uuid,jsonb);
NOTIFY pgrst,'reload schema';
COMMIT;
