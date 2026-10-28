BEGIN;
DO $drain$ BEGIN
 IF EXISTS(SELECT 1 FROM public.platform_queue_jobs WHERE queue_name='notification-jobs'
  AND job_type IN('order.lifecycle_email_queued','email.employee_invite','email.operator_mfa_reset')
  AND status='running' AND deleted_at IS NULL AND locked_at>clock_timestamp()-interval '120 seconds')
  THEN RAISE EXCEPTION '403 rollback requires active notification leases to drain'; END IF;
END $drain$;
DROP FUNCTION public.notification_worker_operation_v1(text,text,uuid,jsonb);
NOTIFY pgrst,'reload schema';
COMMIT;
