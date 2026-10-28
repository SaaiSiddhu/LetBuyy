-- Retain delivery receipts and queued intents. A downgrade must stop the new
-- notification consumer before removing its reader; never bulk replay history.
DO $drain$ BEGIN
 IF EXISTS(SELECT 1 FROM public.email_logs WHERE template_key='order_lifecycle_v1'
  AND deleted_at IS NULL AND status IN('pending','failed'))
 OR EXISTS(SELECT 1 FROM public.platform_queue_jobs WHERE job_type='order.lifecycle_email_queued'
  AND deleted_at IS NULL AND status IN('queued','running','failed')) THEN
  RAISE EXCEPTION 'Pending order lifecycle deliveries must drain or be explicitly reconciled before downgrade'; END IF;
END $drain$;
DROP TRIGGER order_lifecycle_email_v1 ON public.orders;
DROP FUNCTION public.capture_order_lifecycle_email_v1();
DROP FUNCTION public.claim_order_email_outbox_v1(uuid,uuid,text);
DROP FUNCTION public.complete_order_lifecycle_email_v1(uuid,text,uuid,text,text);
DROP FUNCTION public.seal_order_lifecycle_email_message_v1(uuid,text,uuid,jsonb);
DROP FUNCTION public.order_lifecycle_email_delivery_v1(uuid,text);
DROP FUNCTION public.recover_expired_order_email_jobs_v1(integer);
