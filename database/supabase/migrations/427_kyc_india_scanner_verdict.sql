-- Bind a scanner verdict to the exact retained Mumbai S3 object version.
-- EventBridge transport authentication remains a separate admission gate.
BEGIN;

ALTER TABLE public.kyc_private_object_cleanup_jobs
  ADD COLUMN scan_event_id uuid,
  ADD COLUMN scan_verdict text,
  ADD COLUMN scan_completed_at timestamptz,
  ADD CONSTRAINT kyc_india_scan_receipt_check CHECK (
    (scan_event_id IS NULL AND scan_verdict IS NULL AND scan_completed_at IS NULL)
    OR (storage_provider = 'aws_s3_mumbai' AND purpose = 'upload_reservation'
      AND status = 'completed' AND outcome = 'retained'
      AND object_version_id IS NOT NULL AND head_verified_at IS NOT NULL
      AND scan_event_id IS NOT NULL AND scan_verdict IN ('clean', 'rejected')
      AND scan_completed_at IS NOT NULL)
  );

CREATE UNIQUE INDEX kyc_india_scan_event_idx
  ON public.kyc_private_object_cleanup_jobs(scan_event_id)
  WHERE scan_event_id IS NOT NULL;

CREATE FUNCTION public.guard_merchant_kyc_india_scan_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF NEW.metadata->>'private_storage_provider' IS DISTINCT FROM 'aws_s3_mumbai'
    OR NEW.metadata->>'malware_scan_status' IS DISTINCT FROM 'clean' THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.kyc_private_object_cleanup_jobs AS j
     WHERE j.id::text = NEW.metadata->>'private_upload_receipt_id'
       AND j.site_id = NEW.site_id AND j.document_type = NEW.document_type
       AND j.object_key = NEW.metadata->>'private_object_key'
       AND j.object_version_id = NEW.metadata->>'private_object_version_id'
       AND j.storage_provider = 'aws_s3_mumbai' AND j.purpose = 'upload_reservation'
       AND j.status = 'completed' AND j.outcome = 'retained'
       AND j.scan_verdict = 'clean' AND j.scan_event_id::text = NEW.metadata->>'scan_event_id'
       AND j.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'India KYC clean status requires a current version-bound scanner receipt'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_merchant_kyc_india_scan_v1() FROM PUBLIC;
CREATE TRIGGER merchant_kyc_india_scan_v1
  BEFORE INSERT OR UPDATE OF metadata, site_id, document_type ON public.merchant_kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_merchant_kyc_india_scan_v1();

-- Called only after a trusted AWS delivery channel validates the full event
-- envelope. The function then atomically checks current evidence and applies
-- a monotonic verdict. A threat can revoke clean; clean cannot erase a threat.
CREATE FUNCTION public.record_kyc_india_scan_v1(
  p_site uuid, p_receipt uuid, p_version text, p_event uuid,
  p_verdict text, p_scanned_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $fn$
DECLARE
  j public.kyc_private_object_cleanup_jobs%ROWTYPE;
  d public.merchant_kyc_documents%ROWTYPE;
BEGIN
  IF p_site IS NULL OR p_receipt IS NULL OR p_event IS NULL OR p_version IS NULL
    OR p_verdict IS NULL OR p_verdict NOT IN ('clean', 'rejected') OR p_scanned_at IS NULL THEN
    RAISE EXCEPTION 'Invalid India KYC scan result' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO j FROM public.kyc_private_object_cleanup_jobs
   WHERE id = p_receipt AND site_id = p_site FOR UPDATE;
  IF NOT FOUND OR j.storage_provider <> 'aws_s3_mumbai'
    OR j.purpose <> 'upload_reservation' OR j.status <> 'completed'
    OR j.outcome <> 'retained' OR j.head_verified_at IS NULL
    OR j.object_version_id IS DISTINCT FROM p_version OR j.deleted_at IS NOT NULL THEN
    RETURN 'stale';
  END IF;
  SELECT * INTO d FROM public.merchant_kyc_documents
   WHERE site_id = p_site AND document_type = j.document_type AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND OR d.metadata->>'private_storage_provider' <> 'aws_s3_mumbai'
    OR d.metadata->>'private_upload_receipt_id' IS DISTINCT FROM j.id::text
    OR d.metadata->>'private_object_key' IS DISTINCT FROM j.object_key
    OR d.metadata->>'private_object_version_id' IS DISTINCT FROM p_version THEN
    RETURN 'stale';
  END IF;
  IF j.scan_event_id = p_event THEN
    IF j.scan_verdict <> p_verdict THEN
      RAISE EXCEPTION 'Conflicting replay of India KYC scan event' USING ERRCODE = '23514';
    END IF;
    RETURN 'replay';
  END IF;
  IF j.scan_verdict = 'rejected' OR j.scan_verdict = 'clean' AND p_verdict = 'clean' THEN
    RETURN 'unchanged';
  END IF;
  UPDATE public.kyc_private_object_cleanup_jobs
     SET scan_event_id = p_event, scan_verdict = p_verdict,
         scan_completed_at = p_scanned_at
   WHERE id = p_receipt AND site_id = p_site;
  UPDATE public.merchant_kyc_documents
     SET metadata = d.metadata || jsonb_build_object(
           'malware_scan_status', p_verdict, 'scan_event_id', p_event::text,
           'scan_completed_at', p_scanned_at),
         status = CASE WHEN p_verdict = 'rejected' THEN 'needs_review' ELSE d.status END,
         verified_at = CASE WHEN p_verdict = 'rejected' THEN NULL ELSE d.verified_at END,
         updated_at = now()
   WHERE id = d.id AND site_id = p_site;
  RETURN 'applied';
END $fn$;
REVOKE ALL ON FUNCTION public.record_kyc_india_scan_v1(uuid,uuid,text,uuid,text,timestamptz)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.record_kyc_india_scan_v1(uuid,uuid,text,uuid,text,timestamptz)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
