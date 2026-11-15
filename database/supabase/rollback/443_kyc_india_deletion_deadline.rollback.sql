-- Retain a recorded deletion deadline once a Mumbai replacement has been
-- queued. A pre-use rollback removes only the monitor and its empty column.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.kyc_private_object_cleanup_jobs
      WHERE deletion_requested_at IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'India KYC deletion deadlines exist; retain the deadline monitor'
      USING ERRCODE = '55000';
  END IF;
END $guard$;

DROP FUNCTION public.kyc_india_cleanup_overdue_v1();
DROP TRIGGER kyc_india_deletion_requested_at_v1
  ON public.kyc_private_object_cleanup_jobs;
DROP FUNCTION public.set_kyc_india_deletion_requested_at_v1();
DROP INDEX public.kyc_india_deletion_deadline_idx;
ALTER TABLE public.kyc_private_object_cleanup_jobs
  DROP CONSTRAINT kyc_india_deletion_requested_at_check,
  DROP COLUMN deletion_requested_at;

NOTIFY pgrst, 'reload schema';
COMMIT;
