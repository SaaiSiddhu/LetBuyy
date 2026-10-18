-- Never discard verification attempts, encrypted buyer artifacts or release evidence.
BEGIN;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.customer_dsr_exports WHERE buyer_account_id IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.step_up_challenges WHERE action='buyer.dsr.export') THEN RAISE EXCEPTION '330 refuses retained buyer export or verification evidence';END IF;
END $guard$;
DROP FUNCTION IF EXISTS public.access_buyer_export_v1(text,uuid,integer,text,uuid,uuid,text);
DROP FUNCTION IF EXISTS public.save_buyer_export_v1(uuid,integer,text,uuid,text,text,text,text);
DROP FUNCTION IF EXISTS public.snapshot_buyer_export_v1(uuid,integer,text,uuid,text);
DROP FUNCTION IF EXISTS public.fail_buyer_export_proof_v1(uuid,uuid,text);
DROP FUNCTION IF EXISTS public.begin_buyer_export_proof_v1(uuid,integer,text,uuid,uuid);
DROP FUNCTION IF EXISTS public.buyer_export_metadata_v1(uuid);
DROP INDEX IF EXISTS public.buyer_export_artifact_key_v1;
ALTER TABLE public.customer_dsr_exports DROP CONSTRAINT customer_dsr_exports_scope_v1_check;
ALTER TABLE public.customer_dsr_exports ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE public.customer_dsr_exports DROP COLUMN buyer_account_id,DROP COLUMN support_ticket_id,DROP COLUMN buyer_step_up_id,DROP COLUMN buyer_request_key,
 DROP COLUMN buyer_session_sha256,DROP COLUMN buyer_session_epoch,DROP COLUMN buyer_verified_at,DROP COLUMN released_at;
DROP INDEX IF EXISTS public.buyer_export_proof_key_v1;
ALTER TABLE public.step_up_challenges DROP CONSTRAINT step_up_challenges_scope_v1_check;
ALTER TABLE public.step_up_challenges ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE public.step_up_challenges DROP CONSTRAINT step_up_challenges_action_check;
ALTER TABLE public.step_up_challenges ADD CONSTRAINT step_up_challenges_action_check CHECK(action IN ('refund.approve','payout.release','customer.dsr.export','customer.dsr.erase'));
ALTER TABLE public.step_up_challenges DROP COLUMN buyer_account_id;
NOTIFY pgrst,'reload schema';
COMMIT;
