-- Preserve retained lifecycle receipts and their audit/effect provenance.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE scope LIKE 'merchant-staff-v1:%') THEN
  RAISE EXCEPTION '322 rollback refused: retained staff lifecycle receipts require compatible recovery';
 END IF;
END $$;
DROP FUNCTION IF EXISTS public.mutate_merchant_staff_v1(uuid,uuid,text,jsonb,text,uuid,timestamptz,text,integer,uuid,text);
DROP FUNCTION IF EXISTS public.merchant_staff_policy_snapshot_v1(uuid,uuid,uuid);
NOTIFY pgrst,'reload schema';
COMMIT;
