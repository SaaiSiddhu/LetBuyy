-- Keep the deletion clock separate from retry time. A retry must never move a
-- KYC object's 24-hour deadline, and the operator query must expose no keys.
BEGIN;

ALTER TABLE public.kyc_private_object_cleanup_jobs
  ADD COLUMN deletion_requested_at timestamptz;

-- Existing unpublished test receipts may predate this migration. Conservatively
-- retain their earliest recorded request signal instead of starting a new clock.
UPDATE public.kyc_private_object_cleanup_jobs
   SET deletion_requested_at = coalesce(closure_requested_at, retention_expired_at,
     updated_at, created_at)
 WHERE storage_provider = 'aws_s3_mumbai' AND purpose = 'replaced_object';

CREATE FUNCTION public.set_kyc_india_deletion_requested_at_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.deletion_requested_at IS NOT NULL
    AND NEW.deletion_requested_at IS DISTINCT FROM OLD.deletion_requested_at THEN
    RAISE EXCEPTION 'India KYC deletion request time is immutable'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.storage_provider = 'aws_s3_mumbai' AND NEW.purpose = 'replaced_object'
    AND NEW.deletion_requested_at IS NULL THEN
    NEW.deletion_requested_at := now();
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.set_kyc_india_deletion_requested_at_v1()
  FROM PUBLIC, anon, authenticated, app_tenant, service_role;
CREATE TRIGGER kyc_india_deletion_requested_at_v1
  BEFORE INSERT OR UPDATE OF purpose, status, deletion_requested_at
  ON public.kyc_private_object_cleanup_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_kyc_india_deletion_requested_at_v1();

ALTER TABLE public.kyc_private_object_cleanup_jobs
  ADD CONSTRAINT kyc_india_deletion_requested_at_check CHECK (
    storage_provider <> 'aws_s3_mumbai' OR
    (purpose = 'replaced_object') = (deletion_requested_at IS NOT NULL)
  );

CREATE INDEX kyc_india_deletion_deadline_idx
  ON public.kyc_private_object_cleanup_jobs(deletion_requested_at, id)
  WHERE storage_provider = 'aws_s3_mumbai' AND purpose = 'replaced_object'
    AND status IN ('pending', 'deleting') AND deleted_at IS NULL;

CREATE FUNCTION public.kyc_india_cleanup_overdue_v1()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = pg_catalog, public AS $fn$
  SELECT jsonb_build_object(
    'overdue_count', count(*),
    'oldest_due_at', min(due_at)
  )
  FROM (
    SELECT CASE
      WHEN purpose = 'replaced_object' THEN deletion_requested_at + interval '24 hours'
      ELSE intent_expires_at + interval '24 hours'
    END AS due_at
    FROM public.kyc_private_object_cleanup_jobs
    WHERE storage_provider = 'aws_s3_mumbai'
      AND status IN ('pending', 'deleting') AND deleted_at IS NULL
  ) AS pending
  WHERE due_at <= now();
$fn$;
REVOKE ALL ON FUNCTION public.kyc_india_cleanup_overdue_v1()
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.kyc_india_cleanup_overdue_v1()
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
